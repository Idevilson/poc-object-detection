#pragma once

#include "DetectionConstants.hpp"

#include <cstddef>
#include <vector>

namespace margelo::nitro::facerecognizer {

/** Decoded YOLOX candidate in detector-input space, before NMS. */
struct DetectionCandidate final {
  float left;
  float top;
  float width;
  float height;
  float confidence;
  int classId;
};

/** Runtime parameters needed to decode one YOLOX output tensor. */
struct YoloxDecodeParams final {
  int inputSize;
  float detectionThreshold;
  /** Minimum box side in source-frame pixels, before letterbox scaling. */
  float minObjectSize;
  double letterboxScale;
};

/**
 * Decodes the single `[1, anchors, 85]` YOLOX output into candidates.
 *
 * Anchors are laid out as the concatenation of the per-stride grids in
 * `kYoloxStrides` order, each in row-major order, which is what the exported
 * graph produces. Objectness and class scores already carry sigmoid, so they
 * are consumed as probabilities.
 */
std::vector<DetectionCandidate> decodeYoloxOutput(
    const float* output,
    std::size_t anchorCount,
    const YoloxDecodeParams& params);

/**
 * Applies class-wise NMS, sorts by confidence, and caps the returned count.
 *
 * Suppression is per class so overlapping objects of different classes (a
 * person in front of a chair) both survive.
 */
std::vector<DetectionCandidate> suppressOverlaps(
    std::vector<DetectionCandidate> candidates,
    float nmsThreshold,
    int maxObjects);

}  // namespace margelo::nitro::facerecognizer
