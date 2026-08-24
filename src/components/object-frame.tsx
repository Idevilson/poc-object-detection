import type React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { C, MONO } from '../constants/theme';
import { useObjectFrameTracking } from '../hooks/use-object-frame-tracking';
import type { SlotView } from '../hooks/use-detection-view-state';
import type { OverlayLayout, OverlayState } from '../types';

interface ObjectFrameProps {
  overlayObjects: SharedValue<OverlayState>;
  layout: SharedValue<OverlayLayout>;
  slotIndex: number;
  slot: SlotView | null;
}

const COLOR_MS = 140;

export function ObjectFrame({
  overlayObjects,
  layout,
  slotIndex,
  slot,
}: ObjectFrameProps): React.JSX.Element {
  const {
    opacityStyle,
    targetSizeStyle,
    positionStyle,
    displayScaleStyle,
    readoutTrackingStyle,
  } = useObjectFrameTracking({ overlayObjects, layout, slotIndex });

  const color = slot?.color ?? C.neutral;
  const colorStyle = useAnimatedStyle(() => {
    return {
      borderColor: withTiming(color, { duration: COLOR_MS }),
      color: withTiming(color, { duration: COLOR_MS }),
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.frame, opacityStyle, targetSizeStyle, positionStyle]}
    >
      <Animated.View style={[styles.tracker, displayScaleStyle]}>
        <Animated.View style={[styles.corner, styles.cornerTL, colorStyle]} />
        <Animated.View style={[styles.corner, styles.cornerTR, colorStyle]} />
        <Animated.View style={[styles.corner, styles.cornerBL, colorStyle]} />
        <Animated.View style={[styles.corner, styles.cornerBR, colorStyle]} />
      </Animated.View>
      <Animated.View style={[styles.readout, readoutTrackingStyle]}>
        <Animated.Text style={[styles.text, colorStyle]} numberOfLines={1}>
          {slot?.label ?? ''}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const CORNER = 18;

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
  },
  tracker: {
    ...StyleSheet.absoluteFill,
  },
  readout: {
    position: 'absolute',
    left: 0,
    top: -18,
    height: 16,
    width: 220,
  },
  text: {
    position: 'absolute',
    left: 0,
    top: 0,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
  },
  cornerTL: { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 },
});
