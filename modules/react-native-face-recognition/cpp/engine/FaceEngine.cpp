#include "FaceEngine.hpp"

#include "DetectionGeometry.hpp"
#include "FrameSampler.hpp"

#include <stdexcept>
#include <utility>
#if defined(__ANDROID__)
#include <dlfcn.h>
#include <malloc.h>
#endif

namespace margelo::nitro::facerecognizer {

FaceEngine::FaceEngine(const ObjectDetectorOptions& options)
    : _config(validateObjectDetectorOptions(options)),
      _memoryInfo(
          Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault)),
      _detector(_config, _memoryInfo),
      _isDisposed(false) {}

FaceEngine::~FaceEngine() {
  dispose();
}

void FaceEngine::ensureActiveLocked() const {
  if (_isDisposed) {
    throw std::runtime_error(
        "ObjectDetector native engine has been disposed and cannot be reused.");
  }
}

std::vector<DetectedObject> FaceEngine::detectObjects(
    const std::shared_ptr<margelo::nitro::camera::HybridFrameSpec>& frame) {
  std::lock_guard<std::mutex> lock(_inferenceMutex);
  ensureActiveLocked();

  const FrameSampler sampler(frame);
  std::vector<DetectedBox> boxes =
      _detector.detect(sampler, _config, _config.maxObjects);

  // The detector works in frame space; overlays consume upright display space.
  std::vector<DetectedObject> detected;
  detected.reserve(boxes.size());
  for (DetectedBox& box : boxes) {
    toUprightBox(sampler, box);
    detected.push_back(DetectedObject{
        box.bounds, box.confidence, static_cast<double>(box.classId)});
  }
  return detected;
}

void FaceEngine::dispose() noexcept {
  std::lock_guard<std::mutex> lock(_inferenceMutex);
  releaseResourcesLocked();
}

void FaceEngine::releaseResourcesLocked() noexcept {
  if (_isDisposed) {
    return;
  }
  _detector.release();
  trimNativeHeapLocked();
  _isDisposed = true;
}

void FaceEngine::trimNativeHeapLocked() const noexcept {
  // minSdk predates the NDK's mallopt() declaration (API 26), so the symbol
  // must be resolved at runtime; it is cached after the first lookup. Bionic
  // ignores unknown mallopt options, so M_PURGE_ALL is safe to pass on OS
  // versions that predate it.
#if defined(__ANDROID__) && defined(M_PURGE_ALL)
  using MalloptFunction = int (*)(int, int);
  static const MalloptFunction malloptFunction =
      reinterpret_cast<MalloptFunction>(dlsym(RTLD_DEFAULT, "mallopt"));
  if (malloptFunction != nullptr) {
    (void)malloptFunction(M_PURGE_ALL, 0);
  }
#endif
}

std::size_t FaceEngine::externalMemorySize() const noexcept {
  const std::unique_lock<std::mutex> lock(_inferenceMutex, std::try_to_lock);
  if (lock.owns_lock()) {
    _lastKnownExternalMemorySize.store(_detector.externalMemorySize(),
                                       std::memory_order_relaxed);
  }
  return _lastKnownExternalMemorySize.load(std::memory_order_relaxed);
}

}  // namespace margelo::nitro::facerecognizer
