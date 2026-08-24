import type { HybridObject } from 'react-native-nitro-modules'
import type { ObjectDetector } from './ObjectDetector.nitro'
import type { ObjectDetectorOptions } from '../types/ObjectDetectorOptions'

/**
 * Nitro factory responsible for creating native detector instances.
 *
 * The factory itself is lightweight. Each detector returned from
 * {@linkcode create} owns a loaded model session.
 */
export interface ObjectDetectorFactory
  extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  /**
   * Initializes a native detector using the bundled model asset and supplied
   * runtime options.
   *
   * Rejects when model loading, provider selection, or native session creation
   * fails.
   */
  create(options: ObjectDetectorOptions): Promise<ObjectDetector>
}
