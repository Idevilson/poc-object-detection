#pragma once

#include "FaceEngine.hpp"
#include "HybridObjectDetectorSpec.hpp"

#include <cstddef>
#include <memory>
#include <vector>

namespace margelo::nitro::facerecognizer {

class HybridObjectDetector final : public HybridObjectDetectorSpec {
public:
  explicit HybridObjectDetector(const ObjectDetectorOptions& options);

  std::vector<DetectedObject> detectObjects(
      const std::shared_ptr<margelo::nitro::camera::HybridFrameSpec>& frame)
      override;
  void dispose() override;

protected:
  size_t getExternalMemorySize() noexcept override;

private:
  FaceEngine _engine;
};

}  // namespace margelo::nitro::facerecognizer
