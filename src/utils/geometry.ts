import type { OverlayLayout, OverlayState } from '../types';

export interface OverlayRect {
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
 * Projects a native object rectangle onto the cover-scaled preview layout.
 *
 * Returns `null` when the slot is empty, the frame/layout dimensions are
 * invalid, or the scaled rectangle is fully outside the visible preview.
 */
export function computeObjectRect(
  state: OverlayState,
  layout: OverlayLayout,
  slotIndex: number,
): OverlayRect | null {
  'worklet';
  const object = state.objects[slotIndex];
  if (
    object == null ||
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

  const scaledLeft = object.bounds.x * scale + offsetX;
  const scaledTop = object.bounds.y * scale + offsetY;
  const scaledRight = scaledLeft + object.bounds.width * scale;
  const scaledBottom = scaledTop + object.bounds.height * scale;
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
