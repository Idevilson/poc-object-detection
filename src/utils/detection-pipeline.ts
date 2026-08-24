import type { ObjectDetector } from 'react-native-vision-camera-face-recognizer';
import type { Frame } from 'react-native-vision-camera';
import type { Synchronizable } from 'react-native-worklets';
import {
  MAX_OBJECTS,
  NO_CLASS_ID,
  type DetectionState,
  type OverlaySlot,
  type OverlayState,
} from '../types';
import { applyStableObjectSlots } from './object-slots';
import type { VersionedValue } from '../hooks/use-synchronizable';

interface OrientedFrameSize {
  frameWidth: number;
  frameHeight: number;
}

export interface DetectionPipelineState {
  /** Latest object overlay state published from the frame worklet. */
  overlay: Synchronizable<VersionedValue<OverlayState>>;
  /** Latest detection summary published from the frame worklet. */
  detection: Synchronizable<VersionedValue<DetectionState>>;
  /** Monotonic result version used to avoid redundant JS/UI updates. */
  resultVersion: Synchronizable<number>;
}

/**
 * Confidence quantization step used for change detection.
 *
 * Raw scores jitter every frame, so publishing them unrounded would make the
 * version guard useless and re-render the labels continuously. Rounding to 5%
 * keeps the readout informative while letting a steady scene settle.
 */
const CONFIDENCE_STEP = 0.05;

function getOrientedFrameSize(frame: Frame): OrientedFrameSize {
  'worklet';

  const isSideways =
    frame.orientation === 'left' || frame.orientation === 'right';
  return {
    frameWidth: isSideways ? frame.height : frame.width,
    frameHeight: isSideways ? frame.width : frame.height,
  };
}

function quantizeConfidence(confidence: number): number {
  'worklet';

  return Math.round(confidence / CONFIDENCE_STEP) * CONFIDENCE_STEP;
}

function formatStatus(objectCount: number): string {
  'worklet';

  if (objectCount === 0) {
    return 'No objects detected.';
  }
  if (objectCount === 1) {
    return '1 object detected.';
  }
  return `${objectCount} objects detected.`;
}

function areNumberListsEqual(previous: number[], next: number[]): boolean {
  'worklet';

  for (let index = 0; index < MAX_OBJECTS; index += 1) {
    if ((previous[index] ?? NO_CLASS_ID) !== (next[index] ?? NO_CLASS_ID)) {
      return false;
    }
  }
  return true;
}

function publishDetectionResult(
  state: DetectionPipelineState,
  version: number,
  frameSize: OrientedFrameSize,
  objects: OverlaySlot[],
): void {
  'worklet';

  // The overlay is always republished: the boxes have to follow the scene even
  // when the class list is unchanged.
  state.overlay.setBlocking({
    value: {
      frameWidth: frameSize.frameWidth,
      frameHeight: frameSize.frameHeight,
      version,
      objects,
    },
    version,
  });

  const classIds: number[] = [];
  const confidences: number[] = [];
  let objectCount = 0;
  for (let slotIndex = 0; slotIndex < MAX_OBJECTS; slotIndex += 1) {
    const object = objects[slotIndex];
    if (object == null) {
      classIds.push(NO_CLASS_ID);
      confidences.push(0);
      continue;
    }
    classIds.push(object.classId);
    confidences.push(quantizeConfidence(object.confidence));
    objectCount += 1;
  }

  const previous = state.detection.getDirty().value;
  if (
    previous.objectCount === objectCount &&
    areNumberListsEqual(previous.classIds, classIds) &&
    areNumberListsEqual(previous.confidences, confidences)
  ) {
    return;
  }

  const status = formatStatus(objectCount);
  state.detection.setBlocking(previousValue => ({
    value: {
      classIds,
      confidences,
      objectCount,
      version: previousValue.value.version + 1,
      status,
    },
    version: previousValue.version + 1,
  }));
}

export function setDetectionStatus(
  detection: Synchronizable<VersionedValue<DetectionState>>,
  status: string,
): void {
  'worklet';

  detection.setBlocking(previous => ({
    value: {
      classIds: previous.value.classIds,
      confidences: previous.value.confidences,
      objectCount: previous.value.objectCount,
      version: previous.value.version + 1,
      status,
    },
    version: previous.version + 1,
  }));
}

/**
 * Processes one camera frame on the VisionCamera worklet runtime.
 *
 * Detection runs on every frame; the previous slot assignment is read back so a
 * box and its label stay pinned to the same physical object.
 */
export function processDetectionFrame(
  detector: ObjectDetector,
  frame: Frame,
  state: DetectionPipelineState,
): void {
  'worklet';

  const version = state.resultVersion.getDirty() + 1;
  state.resultVersion.setBlocking(version);

  const detected = detector.detectObjects(frame);
  const objects = applyStableObjectSlots(
    { objects: detected as OverlaySlot[] },
    state.overlay.getDirty().value.objects,
  ).objects;

  publishDetectionResult(state, version, getOrientedFrameSize(frame), objects);
}

/**
 * Runs one camera frame end to end on the worklet runtime, always disposing the
 * frame afterwards. Kept as a module-scope worklet (not inline in the hook) so
 * the `try/finally` here doesn't opt the enclosing component out of React
 * Compiler optimization.
 */
export function runDetectionFrame(
  detector: ObjectDetector | null | undefined,
  frame: Frame,
  state: DetectionPipelineState,
): void {
  'worklet';

  try {
    if (detector == null) {
      return;
    }
    processDetectionFrame(detector, frame, state);
  } catch (workletError) {
    const message =
      workletError instanceof Error
        ? workletError.message
        : String(workletError);
    setDetectionStatus(state.detection, `Error: ${message}`);
  } finally {
    frame.dispose();
  }
}
