#pragma once

#include <array>
#include <cstddef>

namespace margelo::nitro::facerecognizer {

/**
 * YOLOX-Nano input contract.
 *
 * The bundled export has a fixed `[1, 3, 416, 416]` input, so the configured
 * size must match exactly. The bounds stay here so JS option validation and
 * native tensor allocation agree on the same fast path.
 */
inline constexpr int kDefaultDetectorInputSize = 416;
inline constexpr int kDetectorInputMultiple = 32;
inline constexpr int kMinDetectorInputSize = 64;
inline constexpr int kMaxDetectorInputSize = 1280;

/**
 * Padding written into the letterbox margins.
 *
 * YOLOX trains with `114` grey padding (see `preproc` in the reference repo).
 * Feeding black bars instead shifts the input distribution at the borders, so
 * the value is matched here rather than left at zero.
 */
inline constexpr float kLetterboxPadValue = 114.0f;

/**
 * Feature-map strides, in the order the exported graph concatenates them.
 *
 * The single output tensor is a concatenation of per-stride grids, so anchor
 * index ranges are derived from this order and nothing else.
 */
inline constexpr std::array<int, 3> kYoloxStrides{8, 16, 32};

/** COCO class count baked into the bundled weights. */
inline constexpr std::size_t kYoloxClassCount = 80;

/**
 * Values per anchor: 4 box deltas, 1 objectness, then one score per class.
 *
 * Box deltas are grid-relative (`(delta + cell) * stride`) with log-space
 * width/height, and objectness/class scores already have sigmoid applied inside
 * the graph, so the decoder must not re-apply it.
 */
inline constexpr std::size_t kYoloxBoxValueCount = 4;
inline constexpr std::size_t kYoloxObjectnessOffset = kYoloxBoxValueCount;
inline constexpr std::size_t kYoloxClassScoreOffset = kYoloxBoxValueCount + 1;
inline constexpr std::size_t kYoloxValuesPerAnchor =
    kYoloxClassScoreOffset + kYoloxClassCount;

/** Non-maximum suppression overlap threshold for detector candidates. */
inline constexpr float kNmsIouThreshold = 0.45f;

/**
 * Total anchors emitted for `inputSize`, summed across every stride grid.
 *
 * At the default 416 input this is 52*52 + 26*26 + 13*13 = 3549, matching the
 * exported output shape.
 */
inline constexpr std::size_t anchorCountForInputSize(int inputSize) noexcept {
  std::size_t total = 0;
  for (const int stride : kYoloxStrides) {
    const std::size_t grid = static_cast<std::size_t>(inputSize / stride);
    total += grid * grid;
  }
  return total;
}

}  // namespace margelo::nitro::facerecognizer
