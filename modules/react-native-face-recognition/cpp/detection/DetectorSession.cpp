#include "DetectorSession.hpp"

#include <array>
#include <cstddef>
#include <cstdint>
#include <stdexcept>
#include <string>
#include <vector>

#include "BufferMemory.hpp"
#include "DetectionGeometry.hpp"
#include "FaceEngineProfiling.hpp"
#include "FaceEngineSession.hpp"
#include "FrameSampler.hpp"
#include "ModelFile.hpp"
#include "ModelLoader.hpp"
#include "YoloxDecoder.hpp"

namespace margelo::nitro::facerecognizer {

DetectorSession::DetectorSession(const FaceEngineConfig& config,
                                 const Ort::MemoryInfo& memoryInfo)
    : _modelByteSize(0),
      _inputSize(config.detectorInputSize),
      _anchorCount(anchorCountForInputSize(config.detectorInputSize)) {
  FaceProfileScope profile(FaceProfileStage::LoadDetector);
  const std::string detectorPath = bundledDetectorModelPath();
  _modelByteSize = checkedModelFileByteSize(detectorPath, "detector");
  // The bundled YOLOX export has a fully static input shape, so there are no
  // symbolic dimensions to override.
  _session = createSession(detectorPath,
                           config.detectorThreads,
                           config.executionProvider,
                           /*useSharedArena=*/true,
                           {});
  configure(memoryInfo);
}

void DetectorSession::configure(const Ort::MemoryInfo& memoryInfo) {
  Ort::AllocatorWithDefaultOptions allocator;
  _inputName = _session->GetInputNameAllocated(0, allocator).get();
  validateInputSize();
  bindInput(memoryInfo);
  bindOutput(memoryInfo);
}

void DetectorSession::validateInputSize() const {
  const std::vector<int64_t> inputShape =
      _session->GetInputTypeInfo(0).GetTensorTypeAndShapeInfo().GetShape();
  if (inputShape.size() != 4) {
    throw std::runtime_error(
        "FaceRecognizer detector model input must be a four-dimensional "
        "NCHW tensor.");
  }
  const int64_t modelHeight = inputShape[2];
  const int64_t modelWidth = inputShape[3];
  if ((modelHeight > 0 && modelHeight != _inputSize) ||
      (modelWidth > 0 && modelWidth != _inputSize)) {
    throw std::runtime_error(
        "FaceRecognizer configured detection.inputSize=" +
        std::to_string(_inputSize) +
        ", but the YOLOX model has a fixed input shape of " +
        std::to_string(modelWidth) + "x" + std::to_string(modelHeight) +
        ". Configure the matching size or export a dynamic-shape model.");
  }
}

void DetectorSession::bindInput(const Ort::MemoryInfo& memoryInfo) {
  const std::size_t planeStride = static_cast<std::size_t>(_inputSize) *
                                  static_cast<std::size_t>(_inputSize);
  // Letterbox margins are never written by the per-pixel mapping loop, so the
  // padding value has to be seeded here and preserved across frames.
  _input.assign(planeStride * 3, kLetterboxPadValue);
  const std::array<int64_t, 4> inputShape{1, 3, _inputSize, _inputSize};
  _inputValue = Ort::Value::CreateTensor<float>(memoryInfo,
                                                _input.data(),
                                                _input.size(),
                                                inputShape.data(),
                                                inputShape.size());
}

void DetectorSession::bindOutput(const Ort::MemoryInfo& memoryInfo) {
  if (_session->GetOutputCount() != 1) {
    throw std::runtime_error(
        "FaceRecognizer expects a single-output YOLOX model, but the bundled "
        "model exposes " +
        std::to_string(_session->GetOutputCount()) +
        " outputs. Provide a YOLOX ONNX export.");
  }

  Ort::AllocatorWithDefaultOptions allocator;
  _outputName = _session->GetOutputNameAllocated(0, allocator).get();

  const std::vector<int64_t> outputShape =
      _session->GetOutputTypeInfo(0).GetTensorTypeAndShapeInfo().GetShape();
  if (outputShape.size() != 3) {
    throw std::runtime_error(
        "FaceRecognizer YOLOX output must be a three-dimensional "
        "[1, anchors, values] tensor.");
  }
  // Anchor count is derived from the configured input size; a mismatch means
  // the weights disagree with the stride table and the decode would silently
  // read the wrong cells.
  if (outputShape[1] > 0 &&
      static_cast<std::size_t>(outputShape[1]) != _anchorCount) {
    throw std::runtime_error(
        "FaceRecognizer expected " + std::to_string(_anchorCount) +
        " YOLOX anchors for inputSize=" + std::to_string(_inputSize) +
        ", but the model emits " + std::to_string(outputShape[1]) + ".");
  }
  if (outputShape[2] > 0 &&
      static_cast<std::size_t>(outputShape[2]) != kYoloxValuesPerAnchor) {
    throw std::runtime_error(
        "FaceRecognizer expected " + std::to_string(kYoloxValuesPerAnchor) +
        " values per YOLOX anchor (4 box + 1 objectness + " +
        std::to_string(kYoloxClassCount) + " COCO classes), but the model "
        "emits " + std::to_string(outputShape[2]) + ".");
  }

  _output.assign(_anchorCount * kYoloxValuesPerAnchor, 0.0f);
  const std::array<int64_t, 3> shape{
      1,
      static_cast<int64_t>(_anchorCount),
      static_cast<int64_t>(kYoloxValuesPerAnchor)};
  _outputValue = Ort::Value::CreateTensor<float>(memoryInfo,
                                                 _output.data(),
                                                 _output.size(),
                                                 shape.data(),
                                                 shape.size());
}

std::vector<DetectedBox> DetectorSession::detect(
    const FrameSampler& sampler,
    const FaceEngineConfig& config,
    int maxObjects) {
  FaceProfileScope profile(FaceProfileStage::DetectObjects);
  if (_session == nullptr) {
    throw std::logic_error(
        "FaceRecognizer detector network must be loaded before detection.");
  }

  LetterboxTransform letterbox{};
  sampler.createDetectorInput(_inputSize, letterbox, _input, _inputCache);

  const char* inputNames[1] = {_inputName.c_str()};
  const char* outputNames[1] = {_outputName.c_str()};
  _session->Run(Ort::RunOptions{nullptr},
                inputNames,
                &_inputValue,
                1,
                outputNames,
                &_outputValue,
                1);

  const YoloxDecodeParams params{_inputSize,
                                 config.detectionThreshold,
                                 config.detectionMinObjectSize,
                                 letterbox.scale};
  const std::vector<DetectionCandidate> selected =
      suppressOverlaps(decodeYoloxOutput(_output.data(), _anchorCount, params),
                       kNmsIouThreshold,
                       maxObjects);

  std::vector<DetectedBox> detected;
  detected.reserve(selected.size());
  for (const DetectionCandidate& candidate : selected) {
    detected.push_back(DetectedBox{
        mapCandidateBounds(candidate, sampler, letterbox),
        candidate.confidence,
        candidate.classId,
    });
  }
  profile.setItemCount(static_cast<double>(detected.size()));
  return detected;
}

void DetectorSession::release() noexcept {
  _outputValue = Ort::Value{nullptr};
  _inputValue = Ort::Value{nullptr};
  _session.reset();
  _inputName.clear();
  _outputName.clear();
  clearFloatVector(_input);
  clearFloatVector(_output);
  _inputCache.releaseMemory();
  _modelByteSize = 0;
}

std::size_t DetectorSession::externalMemorySize() const noexcept {
  return modelResidencyEstimate(_modelByteSize) +
         vectorCapacityByteSize(_input) + vectorCapacityByteSize(_output) +
         vectorCapacityByteSize(_inputCache.pixelMappings);
}

}  // namespace margelo::nitro::facerecognizer
