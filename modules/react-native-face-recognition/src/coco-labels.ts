/**
 * COCO class names in the exact order the bundled YOLOX weights emit them.
 *
 * The index is the `classId` on a `DetectedObject`. Order is load-bearing:
 * shifting an entry silently mislabels every detection, so this is the standard
 * 80-class COCO ordering used by the YOLOX reference implementation.
 */
export const COCO_LABELS = [
  'person',
  'bicycle',
  'car',
  'motorcycle',
  'airplane',
  'bus',
  'train',
  'truck',
  'boat',
  'traffic light',
  'fire hydrant',
  'stop sign',
  'parking meter',
  'bench',
  'bird',
  'cat',
  'dog',
  'horse',
  'sheep',
  'cow',
  'elephant',
  'bear',
  'zebra',
  'giraffe',
  'backpack',
  'umbrella',
  'handbag',
  'tie',
  'suitcase',
  'frisbee',
  'skis',
  'snowboard',
  'sports ball',
  'kite',
  'baseball bat',
  'baseball glove',
  'skateboard',
  'surfboard',
  'tennis racket',
  'bottle',
  'wine glass',
  'cup',
  'fork',
  'knife',
  'spoon',
  'bowl',
  'banana',
  'apple',
  'sandwich',
  'orange',
  'broccoli',
  'carrot',
  'hot dog',
  'pizza',
  'donut',
  'cake',
  'chair',
  'couch',
  'potted plant',
  'bed',
  'dining table',
  'toilet',
  'tv',
  'laptop',
  'mouse',
  'remote',
  'keyboard',
  'cell phone',
  'microwave',
  'oven',
  'toaster',
  'sink',
  'refrigerator',
  'book',
  'clock',
  'vase',
  'scissors',
  'teddy bear',
  'hair drier',
  'toothbrush',
] as const

/** Number of classes the bundled weights can emit. */
export const COCO_CLASS_COUNT = COCO_LABELS.length

/**
 * Resolves a `classId` into its COCO label.
 *
 * Returns a `class <id>` placeholder for out-of-range ids so an unexpected id
 * from a swapped model shows up in the UI instead of crashing the overlay.
 */
export function cocoLabel(classId: number): string {
  return COCO_LABELS[classId] ?? `class ${classId}`
}
