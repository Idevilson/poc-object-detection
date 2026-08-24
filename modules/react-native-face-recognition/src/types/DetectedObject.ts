import type { Rect } from './Rect'

/**
 * One object detected in a frame.
 *
 * Coordinates are already transformed by native code into upright display
 * space, so overlays can map them straight onto the displayed camera preview.
 *
 * The class is reported as a numeric id rather than a string: detection runs in
 * a worklet on every frame, and resolving the label on the render side keeps
 * per-frame string work off the hot path. Use `cocoLabel` to resolve it.
 */
export interface DetectedObject {
  /** Bounding rectangle in oriented upright-display pixels. */
  bounds: Rect
  /** Detection score from `0` to `1` (`objectness * classScore`). */
  confidence: number
  /** Index into the COCO class table the bundled weights were trained on. */
  classId: number
}
