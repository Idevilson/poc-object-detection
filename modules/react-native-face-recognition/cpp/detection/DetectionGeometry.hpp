#pragma once

#include "DetectedBox.hpp"
#include "FrameSampler.hpp"
#include "YoloxDecoder.hpp"

#include <algorithm>
#include <array>

namespace margelo::nitro::facerecognizer {

inline Rect axisAlignedBounds(const std::array<Point, 4>& corners) {
  double minX = corners[0].x;
  double minY = corners[0].y;
  double maxX = corners[0].x;
  double maxY = corners[0].y;
  for (size_t index = 1; index < corners.size(); ++index) {
    minX = std::min(minX, corners[index].x);
    minY = std::min(minY, corners[index].y);
    maxX = std::max(maxX, corners[index].x);
    maxY = std::max(maxY, corners[index].y);
  }
  return Rect{minX, minY, maxX - minX, maxY - minY};
}

/**
 * Maps a detector-space YOLOX candidate back into frame pixel coordinates.
 *
 * The detector runs on a letterboxed square tensor. This function reverses the
 * letterbox transform, accounts for frame orientation/mirroring through
 * `FrameSampler`, then clamps the result to the frame.
 */
inline Rect mapCandidateBounds(const DetectionCandidate& candidate,
                               const FrameSampler& sampler,
                               const LetterboxTransform& letterbox) {
  const std::array<Point, 4> corners{
      sampler.detectorToFrame(Point{candidate.left, candidate.top}, letterbox),
      sampler.detectorToFrame(
          Point{candidate.left + candidate.width, candidate.top}, letterbox),
      sampler.detectorToFrame(
          Point{candidate.left, candidate.top + candidate.height}, letterbox),
      sampler.detectorToFrame(Point{candidate.left + candidate.width,
                                    candidate.top + candidate.height},
                              letterbox),
  };
  Rect bounds = axisAlignedBounds(corners);
  const double frameWidth = static_cast<double>(sampler.getFrameWidth());
  const double frameHeight = static_cast<double>(sampler.getFrameHeight());
  const double minX = std::clamp(bounds.x, 0.0, frameWidth);
  const double minY = std::clamp(bounds.y, 0.0, frameHeight);
  const double maxX = std::clamp(bounds.x + bounds.width, 0.0, frameWidth);
  const double maxY = std::clamp(bounds.y + bounds.height, 0.0, frameHeight);
  return Rect{minX, minY, maxX - minX, maxY - minY};
}

inline Rect toUprightBounds(const FrameSampler& sampler, const Rect& bounds) {
  const std::array<Point, 4> corners{
      sampler.frameToUpright(Point{bounds.x, bounds.y}),
      sampler.frameToUpright(Point{bounds.x + bounds.width, bounds.y}),
      sampler.frameToUpright(Point{bounds.x, bounds.y + bounds.height}),
      sampler.frameToUpright(
          Point{bounds.x + bounds.width, bounds.y + bounds.height}),
  };
  return axisAlignedBounds(corners);
}

/** Rewrites a box's bounds from frame space into upright display space. */
inline void toUprightBox(const FrameSampler& sampler, DetectedBox& box) {
  box.bounds = toUprightBounds(sampler, box.bounds);
}

}  // namespace margelo::nitro::facerecognizer
