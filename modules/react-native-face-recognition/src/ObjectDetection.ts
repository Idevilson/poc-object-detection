import { NitroModules } from 'react-native-nitro-modules'
import type { ObjectDetectorFactory } from './specs/ObjectDetectorFactory.nitro'
import type { ObjectDetector } from './specs/ObjectDetector.nitro'
import type { ObjectDetectorOptions } from './types/ObjectDetectorOptions'

const NativeObjectDetectorFactory =
  NitroModules.createHybridObject<ObjectDetectorFactory>(
    'ObjectDetectorFactory'
  )

/**
 * Entry point for creating native object-detection engines.
 *
 * Each detector owns a loaded native model session. Create one detector for an
 * active camera session and dispose it when the session ends.
 */
export const ObjectDetection = {
  /**
   * Loads the bundled native detector model and returns a ready engine.
   *
   * Model loading is asynchronous, but frame processing on the returned
   * detector is synchronous so it can run from VisionCamera frame processors.
   * Rejects when native initialization fails, for example when a requested
   * execution provider is unavailable.
   */
  create(options: ObjectDetectorOptions): Promise<ObjectDetector> {
    return NativeObjectDetectorFactory.create(options)
  },
}
