#include "HybridObjectDetectorFactory.hpp"

#include "HybridObjectDetector.hpp"

namespace margelo::nitro::facerecognizer {

HybridObjectDetectorFactory::HybridObjectDetectorFactory()
    : HybridObject(TAG) {}

std::shared_ptr<Promise<std::shared_ptr<HybridObjectDetectorSpec>>>
HybridObjectDetectorFactory::create(const ObjectDetectorOptions& options) {
  return Promise<std::shared_ptr<HybridObjectDetectorSpec>>::async(
      [options]() -> std::shared_ptr<HybridObjectDetectorSpec> {
        return std::make_shared<HybridObjectDetector>(options);
      });
}

}  // namespace margelo::nitro::facerecognizer
