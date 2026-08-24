import { MAX_OBJECTS, type OverlaySlot } from '../types';

export type OverlayObject = NonNullable<OverlaySlot>;

interface SlotCandidate {
  slotIndex: number;
  objectIndex: number;
}

interface SlotResult {
  objects: OverlaySlot[];
}

const SLOT_MIN_JUMP_PX = 72;
const SLOT_JUMP_RATIO = 1.35;

export function getObjectCenterX(object: OverlayObject): number {
  'worklet';

  return object.bounds.x + object.bounds.width * 0.5;
}

export function getObjectCenterY(object: OverlayObject): number {
  'worklet';

  return object.bounds.y + object.bounds.height * 0.5;
}

function getObjectArea(object: OverlayObject): number {
  'worklet';

  return object.bounds.width * object.bounds.height;
}

function getDistanceSquaredToObject(
  object: OverlayObject,
  centerX: number,
  centerY: number,
): number {
  'worklet';

  const deltaX = getObjectCenterX(object) - centerX;
  const deltaY = getObjectCenterY(object) - centerY;
  return deltaX * deltaX + deltaY * deltaY;
}

function getCompatibleDistanceSquared(width: number, height: number): number {
  'worklet';

  const distance = Math.max(
    SLOT_MIN_JUMP_PX,
    Math.max(width, height) * SLOT_JUMP_RATIO,
  );
  return distance * distance;
}

function getCompatiblePairDistanceSquared(
  previousObject: OverlayObject,
  currentObject: OverlayObject,
): number {
  'worklet';

  return getCompatibleDistanceSquared(
    Math.max(previousObject.bounds.width, currentObject.bounds.width),
    Math.max(previousObject.bounds.height, currentObject.bounds.height),
  );
}

export function hasVisibleObjects(objects: OverlaySlot[]): boolean {
  'worklet';

  for (let index = 0; index < objects.length; index += 1) {
    if (objects[index] != null) {
      return true;
    }
  }
  return false;
}

function createEmptySlots(): OverlaySlot[] {
  'worklet';

  const slots: OverlaySlot[] = [];
  for (let index = 0; index < MAX_OBJECTS; index += 1) {
    slots.push(null);
  }
  return slots;
}

function selectLargestUnusedObjectIndex(
  objects: OverlaySlot[],
  usedObjectIndexes: boolean[],
): number {
  'worklet';

  let selectedIndex = -1;
  let selectedArea = -1;
  for (let index = 0; index < objects.length; index += 1) {
    const object = objects[index];
    if (object == null || usedObjectIndexes[index] === true) {
      continue;
    }
    const area = getObjectArea(object);
    if (area > selectedArea) {
      selectedArea = area;
      selectedIndex = index;
    }
  }
  return selectedIndex;
}

function selectBestCompatibleCandidate(
  objects: OverlaySlot[],
  previousObjects: OverlaySlot[],
  usedObjectIndexes: boolean[],
  usedSlotIndexes: boolean[],
): SlotCandidate | null {
  'worklet';

  let selectedCandidate: SlotCandidate | null = null;
  let selectedDistanceSquared = Number.POSITIVE_INFINITY;
  for (let slotIndex = 0; slotIndex < MAX_OBJECTS; slotIndex += 1) {
    const previousObject = previousObjects[slotIndex];
    if (previousObject == null || usedSlotIndexes[slotIndex] === true) {
      continue;
    }

    const lockedCenterX = getObjectCenterX(previousObject);
    const lockedCenterY = getObjectCenterY(previousObject);
    for (
      let objectIndex = 0;
      objectIndex < objects.length;
      objectIndex += 1
    ) {
      const object = objects[objectIndex];
      if (object == null || usedObjectIndexes[objectIndex] === true) {
        continue;
      }
      // A slot keeps its identity only within one class. Letting a `person`
      // slot adopt a nearby `chair` would swap the rendered label while the
      // box barely moved, which reads as a glitch rather than a new detection.
      if (object.classId !== previousObject.classId) {
        continue;
      }

      const distanceSquared = getDistanceSquaredToObject(
        object,
        lockedCenterX,
        lockedCenterY,
      );
      if (
        distanceSquared >
        getCompatiblePairDistanceSquared(previousObject, object)
      ) {
        continue;
      }
      if (distanceSquared < selectedDistanceSquared) {
        selectedDistanceSquared = distanceSquared;
        selectedCandidate = { slotIndex, objectIndex };
      }
    }
  }

  return selectedCandidate;
}

function assignStableSlots(
  nextObjects: OverlaySlot[],
  objects: OverlaySlot[],
  previousObjects: OverlaySlot[],
  usedObjectIndexes: boolean[],
): void {
  'worklet';

  const usedSlotIndexes: boolean[] = [];
  for (let index = 0; index < MAX_OBJECTS; index += 1) {
    usedSlotIndexes.push(false);
  }

  let selectedCandidate = selectBestCompatibleCandidate(
    objects,
    previousObjects,
    usedObjectIndexes,
    usedSlotIndexes,
  );
  while (selectedCandidate != null) {
    const slotIndex = selectedCandidate.slotIndex;
    const objectIndex = selectedCandidate.objectIndex;
    nextObjects[slotIndex] = objects[objectIndex];
    usedObjectIndexes[objectIndex] = true;
    usedSlotIndexes[slotIndex] = true;
    selectedCandidate = selectBestCompatibleCandidate(
      objects,
      previousObjects,
      usedObjectIndexes,
      usedSlotIndexes,
    );
  }
}

function fillEmptySlots(
  nextObjects: OverlaySlot[],
  objects: OverlaySlot[],
  usedObjectIndexes: boolean[],
  preservePreviousSlots: boolean,
  previousObjects: OverlaySlot[],
): void {
  'worklet';

  for (let slotIndex = 0; slotIndex < MAX_OBJECTS; slotIndex += 1) {
    if (
      nextObjects[slotIndex] != null ||
      (preservePreviousSlots && previousObjects[slotIndex] != null)
    ) {
      continue;
    }

    const objectIndex = selectLargestUnusedObjectIndex(
      objects,
      usedObjectIndexes,
    );
    if (objectIndex >= 0) {
      nextObjects[slotIndex] = objects[objectIndex];
      usedObjectIndexes[objectIndex] = true;
    }
  }
}

/**
 * Maps freshly detected objects into stable overlay slots.
 *
 * An existing slot is preserved when a new detection of the same class is close
 * enough to the previous bounds; remaining slots are filled largest-first. This
 * keeps a box and its label pinned to the same physical object even when the
 * detector changes result order between frames.
 */
export function applyStableObjectSlots<TResult extends SlotResult>(
  result: TResult,
  previousObjects: OverlaySlot[],
): TResult {
  'worklet';

  const nextObjects = createEmptySlots();
  if (result.objects.length === 0) {
    return { ...result, objects: nextObjects };
  }

  const usedObjectIndexes: boolean[] = [];
  for (let index = 0; index < result.objects.length; index += 1) {
    usedObjectIndexes.push(false);
  }

  assignStableSlots(
    nextObjects,
    result.objects,
    previousObjects,
    usedObjectIndexes,
  );
  fillEmptySlots(
    nextObjects,
    result.objects,
    usedObjectIndexes,
    true,
    previousObjects,
  );
  fillEmptySlots(
    nextObjects,
    result.objects,
    usedObjectIndexes,
    false,
    previousObjects,
  );

  return { ...result, objects: nextObjects };
}
