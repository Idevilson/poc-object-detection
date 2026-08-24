#pragma once

#include "Rect.hpp"

namespace margelo::nitro::facerecognizer {

/**
 * One detected object in frame coordinates, internal to the native pipeline.
 *
 * This is deliberately distinct from the Nitro-generated `DetectedObject` that
 * crosses the bridge: the class id is a real integer here, and the detector can
 * work in frame space before the engine maps results into upright display
 * space.
 */
struct DetectedBox final {
  Rect bounds;
  double confidence;
  int classId;
};

}  // namespace margelo::nitro::facerecognizer
