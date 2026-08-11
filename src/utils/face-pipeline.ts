import type {
  EnrollFaceStatus,
  FaceRecognizer,
} from 'react-native-vision-camera-face-recognizer';
import type { Frame } from 'react-native-vision-camera';
import { scheduleOnRN, type Synchronizable } from 'react-native-worklets';
import {
  MAX_FACES,
  type Mode,
  type OverlayState,
  type RecognitionState,
} from '../types';
import { applyStableFaceSlots } from './face-slots';
import {
  createMatchesFromFaces,
  formatRecognitionStatus,
  selectBestMatchFromMatches,
} from './recognition-matching';
import type { VersionedValue } from '../hooks/use-synchronizable';

interface OrientedFrameSize {
  frameWidth: number;
  frameHeight: number;
}

interface RecognitionSlotVisibility {
  visibleFaceCount: number;
  visibleFaceSlots: boolean[];
}

export interface FacePipelineState {
  /** Latest face overlay state published from the frame worklet. */
  overlay: Synchronizable<VersionedValue<OverlayState>>;
  /** Latest recognition summary published from the frame worklet. */
  recognition: Synchronizable<VersionedValue<RecognitionState>>;
  /** Pending enrollment id requested by the JS thread. */
  enrollRequest: Synchronizable<string | null>;
  /**
   * Pushes an enrollment result to the JS thread as soon as the frame that
   * produced it is processed. Must be a stable reference — it is captured in
   * the frame worklet's closure.
   */
  onEnrollResult(id: string, status: EnrollFaceStatus): void;
  /** Current example mode read directly from the frame worklet. */
  mode: Synchronizable<Mode>;
  /** Monotonic result version used to avoid redundant JS/UI updates. */
  faceResultVersion: Synchronizable<number>;
}

function getOrientedFrameSize(frame: Frame): OrientedFrameSize {
  'worklet';

  const isSideways =
    frame.orientation === 'left' || frame.orientation === 'right';
  return {
    frameWidth: isSideways ? frame.height : frame.width,
    frameHeight: isSideways ? frame.width : frame.height,
  };
}

function createRecognitionSlotVisibility(
  faces: OverlayState['faces'],
): RecognitionSlotVisibility {
  'worklet';

  const visibleFaceSlots: boolean[] = [];
  let visibleFaceCount = 0;
  for (let index = 0; index < MAX_FACES; index += 1) {
    const isVisible = faces[index] != null;
    visibleFaceSlots.push(isVisible);
    if (isVisible) {
      visibleFaceCount += 1;
    }
  }

  return {
    visibleFaceCount,
    visibleFaceSlots,
  };
}

function areMatchValuesEqual(
  previous: RecognitionState['match'],
  next: RecognitionState['match'],
): boolean {
  'worklet';

  if (previous == null || next == null) {
    return previous === next;
  }

  return (
    previous.id === next.id &&
    previous.similarity === next.similarity &&
    previous.faceIndex === next.faceIndex
  );
}

function areMatchListsEqual(
  previous: RecognitionState['matches'],
  next: RecognitionState['matches'],
): boolean {
  'worklet';

  for (let index = 0; index < MAX_FACES; index += 1) {
    if (!areMatchValuesEqual(previous[index] ?? null, next[index] ?? null)) {
      return false;
    }
  }

  return true;
}

function areVisibleFaceSlotsEqual(
  previous: boolean[],
  next: boolean[],
): boolean {
  'worklet';

  for (let index = 0; index < MAX_FACES; index += 1) {
    if ((previous[index] === true) !== (next[index] === true)) {
      return false;
    }
  }

  return true;
}

function isRecognitionStateCurrent(
  previous: RecognitionState,
  matches: RecognitionState['matches'],
  slotVisibility: RecognitionSlotVisibility,
  status: string,
): boolean {
  'worklet';

  return (
    previous.status === status &&
    previous.visibleFaceCount === slotVisibility.visibleFaceCount &&
    areVisibleFaceSlotsEqual(
      previous.visibleFaceSlots,
      slotVisibility.visibleFaceSlots,
    ) &&
    areMatchListsEqual(previous.matches, matches)
  );
}

function publishRecognitionResult(
  state: FacePipelineState,
  version: number,
  frameSize: OrientedFrameSize,
  faces: OverlayState['faces'],
  status: string,
): void {
  'worklet';

  const matches = createMatchesFromFaces(faces, version);
  const slotVisibility = createRecognitionSlotVisibility(faces);
  state.overlay.setBlocking({
    value: {
      frameWidth: frameSize.frameWidth,
      frameHeight: frameSize.frameHeight,
      version,
      faces,
    },
    version,
  });

  const previousRecognition = state.recognition.getDirty().value;
  if (
    isRecognitionStateCurrent(
      previousRecognition,
      matches,
      slotVisibility,
      status,
    )
  ) {
    return;
  }

  state.recognition.setBlocking(previous => {
    const recognitionVersion = previous.value.version + 1;
    return {
      value: {
        match: selectBestMatchFromMatches(matches),
        matches,
        visibleFaceCount: slotVisibility.visibleFaceCount,
        visibleFaceSlots: slotVisibility.visibleFaceSlots,
        version: recognitionVersion,
        status,
      },
      version: previous.version + 1,
    };
  });
}

export function setRecognitionStatus(
  recognition: Synchronizable<VersionedValue<RecognitionState>>,
  status: string,
): void {
  'worklet';

  recognition.setBlocking(previous => ({
    value: {
      match: previous.value.match,
      matches: previous.value.matches,
      visibleFaceCount: previous.value.visibleFaceCount,
      visibleFaceSlots: previous.value.visibleFaceSlots,
      version: previous.value.version + 1,
      status,
    },
    version: previous.version + 1,
  }));
}

/**
 * Processes one camera frame on the VisionCamera worklet runtime.
 *
 * Enrollment requests take priority over recognition so a requested capture
 * consumes exactly one frame. Normal recognition publishes stable overlay slots
 * and only increments recognition state when visible UI data changes.
 */
export function processFaceFrame(
  recognizer: FaceRecognizer,
  frame: Frame,
  state: FacePipelineState,
): void {
  'worklet';

  const pendingEnrollmentId = state.enrollRequest.getDirty();
  if (pendingEnrollmentId != null) {
    state.enrollRequest.setBlocking(null);
    const result = recognizer.enrollFace(pendingEnrollmentId, frame);
    scheduleOnRN(state.onEnrollResult, pendingEnrollmentId, result.status);
    return;
  }

  const version = state.faceResultVersion.getDirty() + 1;
  state.faceResultVersion.setBlocking(version);

  const frameSize = getOrientedFrameSize(frame);
  const recognizedFaces = recognizer.recognizeFaces(frame);
  const faces = applyStableFaceSlots(
    {
      faces: recognizedFaces,
      frameSize,
      recognition: null,
    },
    state.overlay.getDirty().value.faces,
  ).faces;
  const status =
    state.mode.getDirty() === 'register'
      ? 'Ready to capture samples.'
      : formatRecognitionStatus(recognizedFaces);

  publishRecognitionResult(state, version, frameSize, faces, status);
}

/**
 * Runs one camera frame end to end on the worklet runtime, always disposing the
 * frame afterwards. Kept as a module-scope worklet (not inline in the hook) so
 * the `try/finally` here doesn't opt the enclosing component out of React
 * Compiler optimization.
 */
export function runFaceFrame(
  recognizer: FaceRecognizer | null | undefined,
  frame: Frame,
  state: FacePipelineState,
): void {
  'worklet';

  try {
    if (recognizer == null) {
      return;
    }
    processFaceFrame(recognizer, frame, state);
  } catch (workletError) {
    const message =
      workletError instanceof Error
        ? workletError.message
        : String(workletError);
    setRecognitionStatus(state.recognition, `Error: ${message}`);
  } finally {
    frame.dispose();
  }
}
