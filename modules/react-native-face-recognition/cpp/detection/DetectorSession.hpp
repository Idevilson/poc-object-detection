#pragma once

#include <cstddef>
#include <memory>
#include <string>
#include <vector>

#include "DetectedBox.hpp"
#include "DetectionConstants.hpp"
#include "DetectorInputCache.hpp"
#include "FaceEngineConfig.hpp"
#include "onnxruntime_cxx_api.h"

namespace margelo::nitro::facerecognizer {

class FrameSampler;

/**
 * YOLOX-Nano detector ONNX session with reusable input/output buffers.
 *
 * The session stays loaded for the engine lifetime: it is the only model in the
 * pipeline, so releasing it between frames would just pay the load cost again.
 * Input pixel mappings are cached while the frame layout is stable.
 */
class DetectorSession final {
public:
  DetectorSession(const FaceEngineConfig& config,
                  const Ort::MemoryInfo& memoryInfo);

  DetectorSession(const DetectorSession&) = delete;
  DetectorSession& operator=(const DetectorSession&) = delete;
  DetectorSession(DetectorSession&&) = delete;
  DetectorSession& operator=(DetectorSession&&) = delete;

  std::vector<DetectedBox> detect(const FrameSampler& sampler,
                                    const FaceEngineConfig& config,
                                    int maxObjects);
  void release() noexcept;
  std::size_t externalMemorySize() const noexcept;

private:
  void configure(const Ort::MemoryInfo& memoryInfo);
  void validateInputSize() const;
  void bindInput(const Ort::MemoryInfo& memoryInfo);
  void bindOutput(const Ort::MemoryInfo& memoryInfo);

  std::unique_ptr<Ort::Session> _session;
  std::size_t _modelByteSize;
  int _inputSize;
  std::size_t _anchorCount;
  std::string _inputName;
  std::string _outputName;
  std::vector<float> _input;
  Ort::Value _inputValue{nullptr};
  DetectorInputCache _inputCache;
  std::vector<float> _output;
  Ort::Value _outputValue{nullptr};
};

}  // namespace margelo::nitro::facerecognizer
