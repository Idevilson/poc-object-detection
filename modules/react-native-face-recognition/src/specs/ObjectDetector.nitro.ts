import type { HybridObject } from 'react-native-nitro-modules'
import type { Frame } from 'react-native-vision-camera'
import type { DetectedObject } from '../types/DetectedObject'

/**
 * Processes VisionCamera frames using a ready native object detector.
 *
 * The caller retains ownership of every frame and must dispose it after the
 * synchronous operation returns.
 *
 * @see {@linkcode ObjectDetectorFactory.create}
 */
export interface ObjectDetector
  extends HybridObject<{
    ios: 'c++'
    android: 'c++'
  }> {
  /**
   * Detects every object in a frame that passes the configured score and size
   * filters.
   *
   * This is synchronous so VisionCamera frame processors can call it without
   * scheduling JS work. Detection runs on every call: there is no tracking or
   * result reuse across frames, so the returned boxes always describe the frame
   * that was passed in.
   */
  detectObjects(frame: Frame): DetectedObject[]
}
