import { StyleSheet } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { C, MONO } from '../constants/theme';
import { useFaceFrameTracking } from '../hooks/use-face-frame-tracking';
import type { OverlayLayout, OverlayState } from '../types';

interface FaceFrameProps {
  overlayFaces: SharedValue<OverlayState>;
  layout: SharedValue<OverlayLayout>;
  faceIndex: number;
  matchName: string | null;
  hasEnrollments: boolean;
}

const MATCH_IN_MS = 140;
const MATCH_OUT_MS = 260;

export function FaceFrame({
  overlayFaces,
  layout,
  faceIndex,
  matchName,
  hasEnrollments,
}: FaceFrameProps): React.JSX.Element {
  const {
    opacityStyle,
    targetSizeStyle,
    positionStyle,
    displayScaleStyle,
    readoutTrackingStyle,
  } = useFaceFrameTracking({
    overlayFaces,
    layout,
    faceIndex,
  });

  const matchStyle = useAnimatedStyle(() => {
    const isMatched = matchName != null;
    const duration = isMatched ? MATCH_IN_MS : MATCH_OUT_MS;
    return {
      borderColor: withTiming(isMatched ? C.hud : C.neutral, { duration }),
      color: withTiming(isMatched ? C.hud : C.whiteDim, { duration }),
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.frame,
        opacityStyle,
        targetSizeStyle,
        positionStyle,
      ]}
    >
      <Animated.View style={[styles.tracker, displayScaleStyle]}>
        <Animated.View style={[styles.corner, styles.cornerTL, matchStyle]} />
        <Animated.View style={[styles.corner, styles.cornerTR, matchStyle]} />
        <Animated.View style={[styles.corner, styles.cornerBL, matchStyle]} />
        <Animated.View style={[styles.corner, styles.cornerBR, matchStyle]} />
      </Animated.View>
      <Animated.View style={[styles.readout, readoutTrackingStyle]}>
        <Animated.Text style={[styles.text, matchStyle]} numberOfLines={1}>
          ◇ {matchName ?? (hasEnrollments ? 'ANALYZING' : 'FACE DETECTED')}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const CORNER = 20;

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
    top: -20,
    height: 16,
    width: 220,
  },
  text: {
    position: 'absolute',
    left: 0,
    top: 0,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
});
