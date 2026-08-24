#include "YoloxDecoder.hpp"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <vector>

namespace margelo::nitro::facerecognizer {
namespace {

float intersectionOverUnion(const DetectionCandidate& candidate,
                            const DetectionCandidate& keptCandidate) {
  const float left = std::max(candidate.left, keptCandidate.left);
  const float top = std::max(candidate.top, keptCandidate.top);
  const float right = std::min(candidate.left + candidate.width,
                               keptCandidate.left + keptCandidate.width);
  const float bottom = std::min(candidate.top + candidate.height,
                                keptCandidate.top + keptCandidate.height);
  const float intersectionWidth = std::max(0.0f, right - left);
  const float intersectionHeight = std::max(0.0f, bottom - top);
  const float intersection = intersectionWidth * intersectionHeight;
  const float unionArea = candidate.width * candidate.height +
                          keptCandidate.width * keptCandidate.height -
                          intersection;
  return unionArea > 0.0f ? intersection / unionArea : 0.0f;
}

}  // namespace

std::vector<DetectionCandidate> decodeYoloxOutput(
    const float* output,
    std::size_t anchorCount,
    const YoloxDecodeParams& params) {
  std::vector<DetectionCandidate> candidates;
  candidates.reserve(32);

  const double minObjectSizeInInput =
      static_cast<double>(params.minObjectSize) * params.letterboxScale;

  std::size_t anchor = 0;
  for (const int stride : kYoloxStrides) {
    const int grid = params.inputSize / stride;
    for (int row = 0; row < grid; ++row) {
      for (int col = 0; col < grid; ++col) {
        if (anchor >= anchorCount) {
          return candidates;
        }
        const float* values = output + anchor * kYoloxValuesPerAnchor;
        ++anchor;

        // Class scores are probabilities, so `objectness * class <= objectness`.
        // Rejecting on objectness first skips the 80-way argmax for the large
        // majority of anchors.
        const float objectness = values[kYoloxObjectnessOffset];
        if (objectness < params.detectionThreshold) {
          continue;
        }

        const float* classScores = values + kYoloxClassScoreOffset;
        std::size_t bestClass = 0;
        float bestClassScore = classScores[0];
        for (std::size_t index = 1; index < kYoloxClassCount; ++index) {
          if (classScores[index] > bestClassScore) {
            bestClassScore = classScores[index];
            bestClass = index;
          }
        }

        const float confidence = objectness * bestClassScore;
        if (confidence < params.detectionThreshold) {
          continue;
        }

        // YOLOX encodes the box relative to its grid cell: the center is a cell
        // offset and the size is in log space, both scaled by the stride.
        const float centerX = (values[0] + static_cast<float>(col)) *
                              static_cast<float>(stride);
        const float centerY = (values[1] + static_cast<float>(row)) *
                              static_cast<float>(stride);
        const float width = std::exp(values[2]) * static_cast<float>(stride);
        const float height = std::exp(values[3]) * static_cast<float>(stride);
        if (static_cast<double>(width) < minObjectSizeInInput ||
            static_cast<double>(height) < minObjectSizeInInput) {
          continue;
        }

        candidates.push_back(DetectionCandidate{
            centerX - width * 0.5f,
            centerY - height * 0.5f,
            width,
            height,
            confidence,
            static_cast<int>(bestClass),
        });
      }
    }
  }
  return candidates;
}

std::vector<DetectionCandidate> suppressOverlaps(
    std::vector<DetectionCandidate> candidates,
    float nmsThreshold,
    int maxObjects) {
  std::sort(candidates.begin(),
            candidates.end(),
            [](const DetectionCandidate& candidate,
               const DetectionCandidate& otherCandidate) {
              return candidate.confidence > otherCandidate.confidence;
            });

  std::vector<DetectionCandidate> kept;
  kept.reserve(
      std::min(candidates.size(), static_cast<std::size_t>(maxObjects)));
  for (const DetectionCandidate& candidate : candidates) {
    const bool overlaps = std::any_of(
        kept.begin(), kept.end(), [&](const DetectionCandidate& keptCandidate) {
          return keptCandidate.classId == candidate.classId &&
                 intersectionOverUnion(candidate, keptCandidate) >=
                     nmsThreshold;
        });
    if (overlaps) {
      continue;
    }
    kept.push_back(candidate);
    if (kept.size() == static_cast<std::size_t>(maxObjects)) {
      break;
    }
  }
  return kept;
}

}  // namespace margelo::nitro::facerecognizer
