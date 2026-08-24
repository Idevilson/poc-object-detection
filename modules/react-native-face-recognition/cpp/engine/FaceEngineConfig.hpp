#pragma once

#include "DetectorExecutionProvider.hpp"
#include "ObjectDetectorOptions.hpp"

namespace margelo::nitro::facerecognizer {

/**
 * Validated native runtime configuration.
 *
 * Values in this struct are safe for hot-path use: numeric ranges are checked
 * and integer options are already narrowed before inference starts.
 */
struct FaceEngineConfig final {
  DetectorExecutionProvider executionProvider;
  /**
   * Intra-op threads for the detector.
   *
   * Detection is now the only inference stage, so it gets the full requested
   * pool. The previous two-thread cap existed to stop the detector competing
   * with the embedding stage, which no longer exists.
   */
  int detectorThreads;
  int maxObjects;
  float detectionThreshold;
  float detectionMinObjectSize;
  int detectorInputSize;
};

FaceEngineConfig validateObjectDetectorOptions(
    const ObjectDetectorOptions& options);

}  // namespace margelo::nitro::facerecognizer
