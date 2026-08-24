#pragma once

#include "HybridObjectDetectorFactorySpec.hpp"

namespace margelo::nitro::facerecognizer {

class HybridObjectDetectorFactory final
    : public HybridObjectDetectorFactorySpec {
public:
  HybridObjectDetectorFactory();

  std::shared_ptr<Promise<std::shared_ptr<HybridObjectDetectorSpec>>> create(
      const ObjectDetectorOptions& options) override;
};

}  // namespace margelo::nitro::facerecognizer
