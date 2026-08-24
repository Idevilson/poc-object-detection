import type { DetectedObject } from 'react-native-vision-camera-face-recognizer';

/**
 * Objects detected and drawn at once.
 *
 * Shared by the native `maxObjects` option and the overlay's rendered slot
 * count: every slot is a pre-mounted animated component, so this is a real UI
 * cost, not just a cap on results.
 */
export const MAX_OBJECTS = 12;

/** Sentinel class id for an empty slot. */
export const NO_CLASS_ID = -1;

export interface OverlayLayout {
  width: number;
  height: number;
}

/**
 * An object as the overlay consumes it. Bounds are already oriented into
 * upright display coordinates by the native engine.
 */
export type OverlaySlot = DetectedObject | null;

export interface OverlayState {
  objects: OverlaySlot[];
  frameWidth: number;
  frameHeight: number;
  version: number;
}

/**
 * Detection summary mirrored to the JS thread for the labels and the HUD.
 *
 * Only the class id crosses over, not the label string: resolving the name in
 * React keeps per-frame string work off the worklet, and the version guard
 * means a steady scene stops re-rendering entirely.
 */
export interface DetectionState {
  /** Class id per overlay slot, or `NO_CLASS_ID` when the slot is empty. */
  classIds: number[];
  /** Confidence per overlay slot, or `0` when the slot is empty. */
  confidences: number[];
  objectCount: number;
  version: number;
  status: string;
}

export const EMPTY_OVERLAY_STATE: OverlayState = {
  objects: [],
  frameWidth: 0,
  frameHeight: 0,
  version: 0,
};

export const INITIAL_DETECTION_STATE: DetectionState = {
  classIds: [],
  confidences: [],
  objectCount: 0,
  version: 0,
  status: 'Point the camera at a scene.',
};

export const EMPTY_LAYOUT: OverlayLayout = {
  width: 0,
  height: 0,
};
