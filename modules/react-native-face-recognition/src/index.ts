export { ObjectDetection } from './ObjectDetection'
export { COCO_CLASS_COUNT, COCO_LABELS, cocoLabel } from './coco-labels'
export type { ObjectDetector } from './specs/ObjectDetector.nitro'
export type { ObjectDetectorFactory } from './specs/ObjectDetectorFactory.nitro'
export type { DetectedObject } from './types/DetectedObject'
export type {
  DetectorExecutionProvider,
  ObjectDetectionOptions,
  ObjectDetectorOptions,
} from './types/ObjectDetectorOptions'
export type { Rect } from './types/Rect'
export {
  type UseObjectDetectorOptions,
  type UseObjectDetectorResult,
  useObjectDetector,
} from './hooks/useObjectDetector'
