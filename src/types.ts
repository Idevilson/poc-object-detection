import type { RecognizedFace } from 'react-native-vision-camera-face-recognizer';

export type Mode = 'register' | 'recognize';

/**
 * Maximum number of faces detected/recognized and drawn at once. Shared by the
 * native `maxFaces` option and the overlay's rendered slot count.
 */
export const MAX_FACES = 4;

export interface OverlayLayout {
  width: number;
  height: number;
}

/**
 * A face as the overlay consumes it. Bounds and landmarks are already oriented
 * into upright display coordinates by the native engine.
 */
export type OverlayFaceSlot = RecognizedFace | null;

export interface OverlayState {
  faces: OverlayFaceSlot[];
  frameWidth: number;
  frameHeight: number;
  version: number;
}

export interface Profile {
  id: string;
  fullName: string;
  enrolledAt: number;
  sampleCount: number;
}

export type MatchOut = {
  id: string;
  similarity: number;
  version: number;
  faceIndex: number;
} | null;

export interface RecognitionState {
  match: MatchOut;
  matches: MatchOut[];
  visibleFaceCount: number;
  visibleFaceSlots: boolean[];
  version: number;
  status: string;
}

export const EMPTY_OVERLAY_STATE: OverlayState = {
  faces: [],
  frameWidth: 0,
  frameHeight: 0,
  version: 0,
};

export const INITIAL_RECOGNITION_STATE: RecognitionState = {
  match: null,
  matches: [],
  visibleFaceCount: 0,
  visibleFaceSlots: [],
  version: 0,
  status: 'Point the camera at a face.',
};

export const EMPTY_LAYOUT: OverlayLayout = {
  width: 0,
  height: 0,
};
