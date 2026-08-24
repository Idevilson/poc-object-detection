import { useRef, useState } from 'react';
import { type SharedValue, useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { cocoLabel } from 'react-native-vision-camera-face-recognizer';
import { classColor } from '../constants/theme';
import { MAX_OBJECTS, NO_CLASS_ID, type DetectionState } from '../types';

/** Everything the overlay needs to render one occupied slot. */
export interface SlotView {
  label: string;
  color: string;
}

type LabelList = (SlotView | null)[];

const INITIAL_STATUS = 'Point the camera at a scene.';

export interface DetectionViewState {
  status: string;
  /** Label and color per overlay slot, or `null` when the slot is empty. */
  slots: LabelList;
  objectCount: number;
}

function createEmptyLabels(): LabelList {
  const labels: LabelList = [];
  for (let index = 0; index < MAX_OBJECTS; index += 1) {
    labels.push(null);
  }
  return labels;
}

function didLabelsChange(previous: LabelList, next: LabelList): boolean {
  for (let index = 0; index < next.length; index += 1) {
    const previousSlot = previous[index] ?? null;
    const nextSlot = next[index] ?? null;
    if (previousSlot == null || nextSlot == null) {
      if (previousSlot !== nextSlot) {
        return true;
      }
      continue;
    }
    if (
      previousSlot.label !== nextSlot.label ||
      previousSlot.color !== nextSlot.color
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Mirrors the worklet's detection summary into React state.
 *
 * The reaction body runs on the UI thread, so it only forwards plain numbers;
 * `cocoLabel` is ordinary JS and is applied here, on the React side. Combined
 * with the worklet's version guard this recomputes labels a handful of times a
 * second at most rather than once per frame.
 */
export function useDetectionViewState(
  detectionOut: SharedValue<DetectionState>,
): DetectionViewState {
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [objectCount, setObjectCount] = useState(0);
  const [slots, setSlots] = useState<LabelList>(createEmptyLabels);
  const labelsRef = useRef<LabelList>(slots);

  const publish = (
    nextStatus: string,
    nextCount: number,
    classIds: number[],
    confidences: number[],
  ): void => {
    setStatus(nextStatus);
    setObjectCount(nextCount);

    const nextLabels: LabelList = [];
    for (let slotIndex = 0; slotIndex < MAX_OBJECTS; slotIndex += 1) {
      const classId = classIds[slotIndex] ?? NO_CLASS_ID;
      if (classId === NO_CLASS_ID) {
        nextLabels.push(null);
        continue;
      }
      const confidence = Math.round((confidences[slotIndex] ?? 0) * 100);
      nextLabels.push({
        label: `${cocoLabel(classId).toUpperCase()} ${confidence}%`,
        color: classColor(classId),
      });
    }

    if (didLabelsChange(labelsRef.current, nextLabels)) {
      labelsRef.current = nextLabels;
      setSlots(nextLabels);
    }
  };

  useAnimatedReaction(
    () => detectionOut.get().version,
    (version, previousVersion) => {
      if (version === previousVersion) {
        return;
      }

      const state = detectionOut.get();
      scheduleOnRN(
        publish,
        state.status,
        state.objectCount,
        state.classIds,
        state.confidences,
      );
    },
  );

  return { status, slots, objectCount };
}
