import type { OverlayLayout, OverlayState } from '../types';

export interface FaceRect {
  /** Left edge in preview layout pixels. */
  left: number;
  /** Top edge in preview layout pixels. */
  top: number;
  /** Width in preview layout pixels. */
  width: number;
  /** Height in preview layout pixels. */
  height: number;
}

/**
 * Projects a native face rectangle onto the cover-scaled preview layout.
 *
 * Returns `null` when the face or frame/layout dimensions are invalid, or when
 * the scaled rectangle is fully outside the visible preview.
 */
export function computeFaceRect(
  state: OverlayState,
  layout: OverlayLayout,
  faceIndex: number,
): FaceRect | null {
  'worklet';
  const face = state.faces[faceIndex];
  if (
    face == null ||
    state.frameWidth <= 0 ||
    state.frameHeight <= 0 ||
    layout.width <= 0 ||
    layout.height <= 0
  ) {
    return null;
  }

  const scale = Math.max(
    layout.width / state.frameWidth,
    layout.height / state.frameHeight,
  );
  const offsetX = (layout.width - state.frameWidth * scale) * 0.5;
  const offsetY = (layout.height - state.frameHeight * scale) * 0.5;

  const scaledLeft = face.bounds.x * scale + offsetX;
  const scaledTop = face.bounds.y * scale + offsetY;
  const scaledRight = scaledLeft + face.bounds.width * scale;
  const scaledBottom = scaledTop + face.bounds.height * scale;
  if (
    scaledRight <= 0 ||
    scaledBottom <= 0 ||
    scaledLeft >= layout.width ||
    scaledTop >= layout.height
  ) {
    return null;
  }

  return {
    left: scaledLeft,
    top: scaledTop,
    width: scaledRight - scaledLeft,
    height: scaledBottom - scaledTop,
  };
}
