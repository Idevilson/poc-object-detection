#pragma once

namespace margelo::nitro::facerecognizer {

/**
 * Internal 2D point used by frame sampling and letterbox math.
 *
 * This is deliberately not a Nitro-generated type: points no longer cross the
 * bridge now that the pipeline returns boxes without landmarks, so keeping it
 * local avoids exposing geometry plumbing in the public spec.
 */
struct Point final {
  double x;
  double y;
};

}  // namespace margelo::nitro::facerecognizer
