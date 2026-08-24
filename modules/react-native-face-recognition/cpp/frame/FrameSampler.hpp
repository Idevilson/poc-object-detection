#pragma once

#include <VisionCamera/HybridFrameSpec.hpp>
#include <array>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <vector>

#include "LetterboxTransform.hpp"
#include "Point.hpp"

namespace margelo::nitro::facerecognizer {

struct DetectorInputCache;
struct DetectorInputLayout;

/**
 * Read-only frame adapter for detector input.
 *
 * The sampler centralizes YUV plane access, orientation, mirroring, and color
 * conversion. It never owns the frame; callers must keep the
 * `HybridFrameSpec` alive for the sampler lifetime.
 */
class FrameSampler final {
public:
  explicit FrameSampler(
      const std::shared_ptr<margelo::nitro::camera::HybridFrameSpec>& frame);

  /** Raw frame width before orientation is applied. */
  int getFrameWidth() const noexcept;
  /** Raw frame height before orientation is applied. */
  int getFrameHeight() const noexcept;
  /** Display width after orientation is applied. */
  int getUprightWidth() const noexcept;
  /** Display height after orientation is applied. */
  int getUprightHeight() const noexcept;

  /**
   * Builds a square BGR letterboxed detector tensor, reusing cached
   * YUV-to-tensor pixel mappings when the frame layout is unchanged.
   *
   * Only pixels covered by the frame are written, so the caller must seed the
   * letterbox margins with the model's padding value before the first frame.
   */
  void createDetectorInput(int inputSize,
                           LetterboxTransform& transform,
                           std::vector<float>& output,
                           DetectorInputCache& cache) const;

  /** Reverses detector letterbox coordinates into frame coordinates. */
  Point detectorToFrame(const Point& point,
                        const LetterboxTransform& transform) const;

  /** Converts a frame point into upright display coordinates. */
  Point frameToUpright(const Point& point) const;

private:
  struct YuvPlane final {
    std::shared_ptr<margelo::nitro::ArrayBuffer> buffer;
    const uint8_t* data = nullptr;
    int bytesPerRow = 0;
    int pixelStride = 0;
  };

  struct BgrColor final {
    float blue;
    float green;
    float red;
  };

  void initializeUprightBasis();
  BgrColor yuvToBgr(float luminance, float blueColor, float redColor) const;
  DetectorInputLayout detectorInputLayout(int inputSize) const;
  void rebuildDetectorInputCache(int inputSize,
                                 DetectorInputCache& cache) const;
  Point cachedUprightToFrame(double uprightX, double uprightY) const noexcept;
  Point uprightToFrame(double uprightX, double uprightY) const;
  uint8_t readPlane(const YuvPlane& plane,
                    int pixelX,
                    int pixelY,
                    int componentOffset) const;

  int _frameWidth;
  int _frameHeight;
  int _uprightWidth;
  int _uprightHeight;
  int _colorPlaneWidth;
  int _colorPlaneHeight;
  bool _isMirrored;
  bool _isFullRange;
  bool _hasInterleavedColor;
  margelo::nitro::camera::CameraOrientation _orientation;
  Point _uprightFrameOrigin;
  Point _uprightFrameXStep;
  Point _uprightFrameYStep;
  std::array<YuvPlane, 3> _planes;
};

}  // namespace margelo::nitro::facerecognizer
