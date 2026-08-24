import type { ViewStyle } from 'react-native';
import {
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { OverlayLayout, OverlayState } from '../types';
import { computeObjectRect } from '../utils/geometry';
import { smoothTrackingValue } from '../utils/tracking';

interface ObjectFrameTrackingParams {
  overlayObjects: SharedValue<OverlayState>;
  layout: SharedValue<OverlayLayout>;
  slotIndex: number;
}

type AnimatedViewStyle = ReturnType<typeof useAnimatedStyle<ViewStyle>>;

interface ObjectFrameTrackingStyles {
  opacityStyle: AnimatedViewStyle;
  targetSizeStyle: AnimatedViewStyle;
  positionStyle: AnimatedViewStyle;
  displayScaleStyle: AnimatedViewStyle;
  readoutTrackingStyle: AnimatedViewStyle;
}

const VISIBILITY_MS = 70;
const TARGET_POSITION_EPSILON_PX = 5;
const TARGET_SIZE_MIN_DELTA_PX = 4;
const TARGET_SIZE_RATIO = 0.025;
const DISPLAY_POSITION_EPSILON_PX = 0.5;
const DISPLAY_SIZE_EPSILON_PX = 0.5;
const DISPLAY_POSITION_RESPONSE_PX = 90;
const DISPLAY_SIZE_RESPONSE_PX = 110;
const MIN_DISPLAY_ALPHA = 0.08;
const MAX_DISPLAY_ALPHA = 0.28;
const MIN_FRAME_SIZE_PX = 1;

function shouldUpdateSizeTarget(
  currentSize: number,
  nextSize: number,
): boolean {
  'worklet';

  const delta = Math.abs(nextSize - currentSize);
  const threshold = Math.max(
    TARGET_SIZE_MIN_DELTA_PX,
    currentSize * TARGET_SIZE_RATIO,
  );
  return delta > threshold;
}

function getFrameSize(size: number): number {
  'worklet';

  return Math.max(size, MIN_FRAME_SIZE_PX);
}

function getDisplayScale(displaySize: number, targetSize: number): number {
  'worklet';

  return displaySize / getFrameSize(targetSize);
}

function smoothPositionValue(current: number, next: number): number {
  'worklet';

  return smoothTrackingValue(
    current,
    next,
    DISPLAY_POSITION_EPSILON_PX,
    DISPLAY_POSITION_RESPONSE_PX,
    MIN_DISPLAY_ALPHA,
    MAX_DISPLAY_ALPHA,
  );
}

function smoothSizeValue(current: number, next: number): number {
  'worklet';

  return smoothTrackingValue(
    current,
    next,
    DISPLAY_SIZE_EPSILON_PX,
    DISPLAY_SIZE_RESPONSE_PX,
    MIN_DISPLAY_ALPHA,
    MAX_DISPLAY_ALPHA,
  );
}

export function useObjectFrameTracking({
  overlayObjects,
  layout,
  slotIndex,
}: ObjectFrameTrackingParams): ObjectFrameTrackingStyles {
  const visible = useSharedValue(0);
  const targetCenterX = useSharedValue(0);
  const targetCenterY = useSharedValue(0);
  const targetWidth = useSharedValue(0);
  const targetHeight = useSharedValue(0);
  const displayCenterX = useSharedValue(0);
  const displayCenterY = useSharedValue(0);
  const displayWidth = useSharedValue(0);
  const displayHeight = useSharedValue(0);

  useAnimatedReaction(
    () => computeObjectRect(overlayObjects.get(), layout.get(), slotIndex),
    rect => {
      if (rect == null) {
        visible.set(withTiming(0, { duration: VISIBILITY_MS }));
        return;
      }

      const nextCenterX = rect.left + rect.width * 0.5;
      const nextCenterY = rect.top + rect.height * 0.5;

      if (visible.get() === 0) {
        targetCenterX.set(nextCenterX);
        targetCenterY.set(nextCenterY);
        targetWidth.set(rect.width);
        targetHeight.set(rect.height);
        displayCenterX.set(nextCenterX);
        displayCenterY.set(nextCenterY);
        displayWidth.set(rect.width);
        displayHeight.set(rect.height);
      } else {
        if (
          Math.abs(nextCenterX - targetCenterX.get()) >
          TARGET_POSITION_EPSILON_PX
        ) {
          targetCenterX.set(nextCenterX);
        }
        if (
          Math.abs(nextCenterY - targetCenterY.get()) >
          TARGET_POSITION_EPSILON_PX
        ) {
          targetCenterY.set(nextCenterY);
        }
        if (shouldUpdateSizeTarget(targetWidth.get(), rect.width)) {
          targetWidth.set(rect.width);
        }
        if (shouldUpdateSizeTarget(targetHeight.get(), rect.height)) {
          targetHeight.set(rect.height);
        }
      }

      visible.set(withTiming(1, { duration: VISIBILITY_MS }));
    },
  );

  useFrameCallback(() => {
    'worklet';

    if (visible.get() === 0) {
      return;
    }

    displayCenterX.set(
      smoothPositionValue(displayCenterX.get(), targetCenterX.get()),
    );
    displayCenterY.set(
      smoothPositionValue(displayCenterY.get(), targetCenterY.get()),
    );
    displayWidth.set(smoothSizeValue(displayWidth.get(), targetWidth.get()));
    displayHeight.set(
      smoothSizeValue(displayHeight.get(), targetHeight.get()),
    );
  });

  const opacityStyle = useAnimatedStyle<ViewStyle>(() => {
    return {
      opacity: visible.get(),
    };
  });

  const targetSizeStyle = useAnimatedStyle<ViewStyle>(() => {
    return {
      width: getFrameSize(targetWidth.get()),
      height: getFrameSize(targetHeight.get()),
    };
  });

  const positionStyle = useAnimatedStyle<ViewStyle>(() => {
    return {
      transform: [
        {
          translateX:
            displayCenterX.get() - getFrameSize(targetWidth.get()) * 0.5,
        },
        {
          translateY:
            displayCenterY.get() - getFrameSize(targetHeight.get()) * 0.5,
        },
      ],
    };
  });

  const displayScaleStyle = useAnimatedStyle<ViewStyle>(() => {
    return {
      transform: [
        { scaleX: getDisplayScale(displayWidth.get(), targetWidth.get()) },
        { scaleY: getDisplayScale(displayHeight.get(), targetHeight.get()) },
      ],
    };
  });

  const readoutTrackingStyle = useAnimatedStyle<ViewStyle>(() => {
    return {
      transform: [
        {
          translateX:
            (getFrameSize(targetWidth.get()) - displayWidth.get()) * 0.5,
        },
        {
          translateY:
            (getFrameSize(targetHeight.get()) - displayHeight.get()) * 0.5,
        },
      ],
    };
  });

  return {
    opacityStyle,
    targetSizeStyle,
    positionStyle,
    displayScaleStyle,
    readoutTrackingStyle,
  };
}
