#pragma once

#include "Rect.hpp"

namespace margelo::nitro::facerecognizer {

/**
 * One detected object in frame coordinates.
 *
 * `classId` indexes the COCO class table the detector was trained on. The
 * human-readable label is resolved on the JS side so no per-frame string
 * marshalling crosses the bridge.
 */
struct DetectedObject final {
  Rect bounds;
  double confidence;
  int classId;
};

}  // namespace margelo::nitro::facerecognizer
