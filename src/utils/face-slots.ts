import { MAX_FACES, type OverlayState } from '../types';

export type OverlayFace = NonNullable<OverlayState['faces'][number]>;

interface FaceWithBounds {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface FaceSlotCandidate {
  slotIndex: number;
  faceIndex: number;
}

interface FaceSlotResult {
  faces: OverlayState['faces'];
}

const FACE_SLOT_MIN_JUMP_PX = 72;
const FACE_SLOT_JUMP_RATIO = 1.35;

export function getFaceCenterX(face: FaceWithBounds): number {
  'worklet';

  return face.bounds.x + face.bounds.width * 0.5;
}

export function getFaceCenterY(face: FaceWithBounds): number {
  'worklet';

  return face.bounds.y + face.bounds.height * 0.5;
}

function getFaceArea(face: FaceWithBounds): number {
  'worklet';

  return face.bounds.width * face.bounds.height;
}

function getDistanceSquaredToFace(
  face: FaceWithBounds,
  centerX: number,
  centerY: number,
): number {
  'worklet';

  const deltaX = getFaceCenterX(face) - centerX;
  const deltaY = getFaceCenterY(face) - centerY;
  return deltaX * deltaX + deltaY * deltaY;
}

export function getCompatibleFaceDistanceSquared(
  width: number,
  height: number,
): number {
  'worklet';

  const distance = Math.max(
    FACE_SLOT_MIN_JUMP_PX,
    Math.max(width, height) * FACE_SLOT_JUMP_RATIO,
  );
  return distance * distance;
}

function getCompatibleFacePairDistanceSquared(
  previousFace: OverlayFace,
  currentFace: OverlayFace,
): number {
  'worklet';

  return getCompatibleFaceDistanceSquared(
    Math.max(previousFace.bounds.width, currentFace.bounds.width),
    Math.max(previousFace.bounds.height, currentFace.bounds.height),
  );
}

export function hasVisibleFaces(faces: OverlayState['faces']): boolean {
  'worklet';

  for (let index = 0; index < faces.length; index += 1) {
    if (faces[index] != null) {
      return true;
    }
  }
  return false;
}

function createEmptyFaceSlots(): OverlayState['faces'] {
  'worklet';

  const slots: OverlayState['faces'] = [];
  for (let index = 0; index < MAX_FACES; index += 1) {
    slots.push(null);
  }
  return slots;
}

function selectLargestUnusedFaceIndex(
  faces: OverlayState['faces'],
  usedFaceIndexes: boolean[],
): number {
  'worklet';

  let selectedIndex = -1;
  let selectedArea = -1;
  for (let index = 0; index < faces.length; index += 1) {
    const face = faces[index];
    if (face == null || usedFaceIndexes[index] === true) {
      continue;
    }
    const area = getFaceArea(face);
    if (area > selectedArea) {
      selectedArea = area;
      selectedIndex = index;
    }
  }
  return selectedIndex;
}

function selectBestCompatibleFaceSlotCandidate(
  faces: OverlayState['faces'],
  previousFaces: OverlayState['faces'],
  usedFaceIndexes: boolean[],
  usedSlotIndexes: boolean[],
): FaceSlotCandidate | null {
  'worklet';

  let selectedCandidate: FaceSlotCandidate | null = null;
  let selectedDistanceSquared = Number.POSITIVE_INFINITY;
  for (let slotIndex = 0; slotIndex < MAX_FACES; slotIndex += 1) {
    const previousFace = previousFaces[slotIndex];
    if (previousFace == null || usedSlotIndexes[slotIndex] === true) {
      continue;
    }

    const lockedCenterX = getFaceCenterX(previousFace);
    const lockedCenterY = getFaceCenterY(previousFace);
    for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
      const face = faces[faceIndex];
      if (face == null || usedFaceIndexes[faceIndex] === true) {
        continue;
      }

      const distanceSquared = getDistanceSquaredToFace(
        face,
        lockedCenterX,
        lockedCenterY,
      );
      const maxDistanceSquared = getCompatibleFacePairDistanceSquared(
        previousFace,
        face,
      );
      if (distanceSquared > maxDistanceSquared) {
        continue;
      }
      if (distanceSquared < selectedDistanceSquared) {
        selectedDistanceSquared = distanceSquared;
        selectedCandidate = { slotIndex, faceIndex };
      }
    }
  }

  return selectedCandidate;
}

function assignStableFaceSlots(
  nextFaces: OverlayState['faces'],
  faces: OverlayState['faces'],
  previousFaces: OverlayState['faces'],
  usedFaceIndexes: boolean[],
): void {
  'worklet';

  const usedSlotIndexes: boolean[] = [];
  for (let index = 0; index < MAX_FACES; index += 1) {
    usedSlotIndexes.push(false);
  }

  let selectedCandidate = selectBestCompatibleFaceSlotCandidate(
    faces,
    previousFaces,
    usedFaceIndexes,
    usedSlotIndexes,
  );
  while (selectedCandidate != null) {
    const slotIndex = selectedCandidate.slotIndex;
    const faceIndex = selectedCandidate.faceIndex;
    nextFaces[slotIndex] = faces[faceIndex];
    usedFaceIndexes[faceIndex] = true;
    usedSlotIndexes[slotIndex] = true;
    selectedCandidate = selectBestCompatibleFaceSlotCandidate(
      faces,
      previousFaces,
      usedFaceIndexes,
      usedSlotIndexes,
    );
  }
}

function fillEmptyFaceSlots(
  nextFaces: OverlayState['faces'],
  faces: OverlayState['faces'],
  usedFaceIndexes: boolean[],
  preservePreviousSlots: boolean,
  previousFaces: OverlayState['faces'],
): void {
  'worklet';

  for (let slotIndex = 0; slotIndex < MAX_FACES; slotIndex += 1) {
    if (
      nextFaces[slotIndex] != null ||
      (preservePreviousSlots && previousFaces[slotIndex] != null)
    ) {
      continue;
    }

    const faceIndex = selectLargestUnusedFaceIndex(faces, usedFaceIndexes);
    if (faceIndex >= 0) {
      nextFaces[slotIndex] = faces[faceIndex];
      usedFaceIndexes[faceIndex] = true;
    }
  }
}

/**
 * Maps freshly detected faces into stable overlay slots.
 *
 * Existing slots are preserved when a new face is close enough to the previous
 * bounds; remaining slots are filled by largest face first. This avoids UI
 * labels jumping between people when the detector changes result order.
 */
export function applyStableFaceSlots<TResult extends FaceSlotResult>(
  result: TResult,
  previousFaces: OverlayState['faces'],
): TResult {
  'worklet';

  if (result.faces.length === 0) {
    return result;
  }

  const nextFaces = createEmptyFaceSlots();
  const usedFaceIndexes: boolean[] = [];
  for (let index = 0; index < result.faces.length; index += 1) {
    usedFaceIndexes.push(false);
  }

  assignStableFaceSlots(
    nextFaces,
    result.faces,
    previousFaces,
    usedFaceIndexes,
  );
  fillEmptyFaceSlots(
    nextFaces,
    result.faces,
    usedFaceIndexes,
    true,
    previousFaces,
  );
  fillEmptyFaceSlots(
    nextFaces,
    result.faces,
    usedFaceIndexes,
    false,
    previousFaces,
  );

  if (!hasVisibleFaces(nextFaces)) {
    const faceIndex = selectLargestUnusedFaceIndex(
      result.faces,
      usedFaceIndexes,
    );
    if (faceIndex >= 0) {
      nextFaces[0] = result.faces[faceIndex];
    }
  }

  return {
    ...result,
    faces: nextFaces,
  };
}
