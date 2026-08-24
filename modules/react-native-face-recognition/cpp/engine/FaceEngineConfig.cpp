#include "FaceEngineConfig.hpp"

#include "DetectionConstants.hpp"

#include <cmath>
#include <stdexcept>
#include <string>

namespace margelo::nitro::facerecognizer {
namespace {

int checkedInteger(double value, int minimum, int maximum, const char* name) {
  if (!std::isfinite(value) || std::trunc(value) != value || value < minimum ||
      value > maximum) {
    throw std::invalid_argument(
        "ObjectDetector option '" + std::string(name) +
        "' must be an integer between " + std::to_string(minimum) + " and " +
        std::to_string(maximum) + "; received " + std::to_string(value) + ".");
  }
  return static_cast<int>(value);
}

int checkedDetectorInputSize(double requestedSize, const char* name) {
  if (!std::isfinite(requestedSize) ||
      std::trunc(requestedSize) != requestedSize ||
      requestedSize < kMinDetectorInputSize ||
      requestedSize > kMaxDetectorInputSize ||
      static_cast<int>(requestedSize) % kDetectorInputMultiple != 0) {
    throw std::invalid_argument(
        "ObjectDetector option '" + std::string(name) +
        "' must be a multiple of " + std::to_string(kDetectorInputMultiple) +
        " between " + std::to_string(kMinDetectorInputSize) + " and " +
        std::to_string(kMaxDetectorInputSize) + "; received " +
        std::to_string(requestedSize) + ".");
  }
  return static_cast<int>(requestedSize);
}

float checkedUnitInterval(double value, const char* name) {
  if (!std::isfinite(value) || value < 0.0 || value > 1.0) {
    throw std::invalid_argument("ObjectDetector option '" + std::string(name) +
                                "' must be between 0 and 1; received " +
                                std::to_string(value) + ".");
  }
  return static_cast<float>(value);
}

}  // namespace

FaceEngineConfig validateObjectDetectorOptions(
    const ObjectDetectorOptions& options) {
  if (!std::isfinite(options.detection.minObjectSize) ||
      options.detection.minObjectSize < 1.0) {
    throw std::invalid_argument(
        "ObjectDetector option 'detection.minObjectSize' must be at least 1 "
        "pixel; received " +
        std::to_string(options.detection.minObjectSize) + ".");
  }
  return FaceEngineConfig{
      .executionProvider = options.provider,
      .detectorThreads = checkedInteger(options.threads, 1, 6, "threads"),
      .maxObjects = checkedInteger(
          options.detection.maxObjects, 1, 100, "detection.maxObjects"),
      .detectionThreshold = checkedUnitInterval(options.detection.threshold,
                                                "detection.threshold"),
      .detectionMinObjectSize =
          static_cast<float>(options.detection.minObjectSize),
      .detectorInputSize = checkedDetectorInputSize(options.detection.inputSize,
                                                    "detection.inputSize"),
  };
}

}  // namespace margelo::nitro::facerecognizer
