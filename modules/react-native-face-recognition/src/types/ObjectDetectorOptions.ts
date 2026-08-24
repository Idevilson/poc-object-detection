/**
 * ONNX Runtime execution provider requested by the native detector.
 *
 * - `auto` requests NNAPI on Android with XNNPACK CPU fallback, CoreML on iOS.
 * - `gpu` requests GPU execution; Android falls back to NNAPI/XNNPACK when QNN
 *   is unavailable.
 * - `cpu` forces XNNPACK CPU execution.
 */
export type DetectorExecutionProvider = 'auto' | 'gpu' | 'cpu'

/**
 * Runtime options consumed by the bundled native object-detection pipeline.
 *
 * These values are captured when a detector is created. Create a new detector
 * to apply option changes; frame processors must not mutate this object while
 * detection is running.
 */
export interface ObjectDetectorOptions {
  /** Requested ONNX Runtime provider for the detector model. */
  provider: DetectorExecutionProvider
  /** Intra-op threads for detection, the only inference stage in the pipeline. */
  threads: number
  /** Detector policy. */
  detection: ObjectDetectionOptions
}

/**
 * Controls native object detection filtering.
 *
 * The detector runs on every processed frame, so `inputSize` is the dominant
 * cost knob. Prefer the smallest size that still resolves the objects at your
 * camera distance.
 */
export interface ObjectDetectionOptions {
  /**
   * Maximum objects returned per frame, after NMS.
   *
   * A scene view can legitimately contain dozens of objects, so this doubles as
   * the overlay budget.
   */
  maxObjects: number
  /**
   * Minimum score from `0` to `1`, where score is `objectness * classScore`.
   *
   * Around `0.3` is a reasonable starting point for YOLOX-Nano: lower values
   * surface more small objects along with more false positives.
   */
  threshold: number
  /** Minimum box width and height in source-frame pixels. */
  minObjectSize: number
  /**
   * Square detector input size in pixels.
   *
   * The bundled YOLOX-Nano export has a fixed `416x416` input, so this must be
   * `416` unless you swap in a dynamic-shape model.
   */
  inputSize: number
}
