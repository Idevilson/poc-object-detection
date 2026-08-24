#include "HybridObjectDetector.hpp"

namespace margelo::nitro::facerecognizer {

HybridObjectDetector::HybridObjectDetector(const ObjectDetectorOptions& options)
    : HybridObject(TAG), _engine(options) {}

std::vector<DetectedObject> HybridObjectDetector::detectObjects(
    const std::shared_ptr<margelo::nitro::camera::HybridFrameSpec>& frame) {
  return _engine.detectObjects(frame);
}

void HybridObjectDetector::dispose() {
  _engine.dispose();
}

size_t HybridObjectDetector::getExternalMemorySize() noexcept {
  return _engine.externalMemorySize();
}

}  // namespace margelo::nitro::facerecognizer
