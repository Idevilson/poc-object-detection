#pragma once

#include "DetectedObject.hpp"
#include "DetectorSession.hpp"
#include "FaceEngineConfig.hpp"

#include "onnxruntime_cxx_api.h"
#include <VisionCamera/HybridFrameSpec.hpp>

#include <atomic>
#include <cstddef>
#include <memory>
#include <mutex>
#include <vector>

namespace margelo::nitro::facerecognizer {

/**
 * Owns the native detector session and its frame-processing entry point.
 *
 * Public methods are serialized by `_inferenceMutex` because the ONNX session
 * and its reusable tensors are mutable. A single instance is intended for one
 * active camera pipeline.
 */
class FaceEngine final {
public:
  explicit FaceEngine(const ObjectDetectorOptions& options);
  ~FaceEngine();

  FaceEngine(const FaceEngine&) = delete;
  FaceEngine& operator=(const FaceEngine&) = delete;
  FaceEngine(FaceEngine&&) = delete;
  FaceEngine& operator=(FaceEngine&&) = delete;

  /**
   * Detects objects in one frame and returns them in upright display space.
   *
   * This method is synchronous so VisionCamera frame processors can call it
   * without scheduling JS work. The caller remains responsible for disposing
   * the frame after the call returns.
   *
   * Every call runs the detector: there is no tracking or cross-frame reuse, so
   * the result always describes the frame that was passed in.
   */
  std::vector<DetectedObject> detectObjects(
      const std::shared_ptr<margelo::nitro::camera::HybridFrameSpec>& frame);

  void dispose() noexcept;
  std::size_t externalMemorySize() const noexcept;

private:
  void releaseResourcesLocked() noexcept;
  void trimNativeHeapLocked() const noexcept;
  void ensureActiveLocked() const;

  FaceEngineConfig _config;
  Ort::MemoryInfo _memoryInfo;
  DetectorSession _detector;
  mutable std::mutex _inferenceMutex;
  /**
   * Last memory estimate observed under the lock. `externalMemorySize()` is
   * called from the JS GC and must never block behind a frame in flight, so it
   * refreshes this only when the lock is free.
   */
  mutable std::atomic<std::size_t> _lastKnownExternalMemorySize{0};
  bool _isDisposed;
};

}  // namespace margelo::nitro::facerecognizer
