import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { C, MONO, S } from '../constants/theme';
import type { DevicePosture, PostureGuidance } from '../hooks/use-device-posture';

interface PostureGuideProps {
  posture: DevicePosture;
}

/** Height of the level window, and how far the horizon may travel inside it. */
const FRAME_HEIGHT = 64;
const HORIZON_TRAVEL_PX = 22;

/** Beyond this the line would read as noise rather than as a correction. */
const MAX_VISUAL_ROLL_DEG = 45;

const COLOR_MS = 160;

const CAPTIONS: Record<PostureGuidance, string> = {
  ready: 'DEVICE LEVEL',
  holdUpright: 'HOLD THE PHONE MORE UPRIGHT',
  straighten: 'STRAIGHTEN THE PHONE',
};

function clamp(value: number, limit: number): number {
  'worklet';

  return Math.min(limit, Math.max(-limit, value));
}

/**
 * Live level indicator for the capture pose.
 *
 * The horizon rotates with sideways roll and slides with forward/back lean, so
 * the operator sees which way to correct instead of only being told "no". It
 * reads the sensor on the UI runtime, so it tracks the handset at display rate
 * without waking the JS thread.
 */
export function PostureGuide({
  posture,
}: PostureGuideProps): React.JSX.Element | null {
  const { reading, limits } = posture;
  const { maxScreenTiltDeg, maxInPlaneRollDeg } = limits;

  const horizonStyle = useAnimatedStyle(() => {
    const current = reading.get();
    if (current == null) {
      return {};
    }

    const isLevel =
      Math.abs(current.screenTiltDeg) <= maxScreenTiltDeg &&
      Math.abs(current.inPlaneRollDeg) <= maxInPlaneRollDeg;

    // The limit sits at half travel, so the line still moves visibly while the
    // operator is outside the accepted range.
    const tiltRatio = clamp(current.screenTiltDeg / (maxScreenTiltDeg * 2), 1);

    return {
      backgroundColor: withTiming(isLevel ? C.hud : C.neutral, {
        duration: COLOR_MS,
      }),
      transform: [
        { translateY: tiltRatio * HORIZON_TRAVEL_PX },
        { rotateZ: `${clamp(current.inPlaneRollDeg, MAX_VISUAL_ROLL_DEG)}deg` },
      ],
    };
  });

  const referenceStyle = useAnimatedStyle(() => {
    const current = reading.get();
    const isLevel =
      current != null &&
      Math.abs(current.screenTiltDeg) <= maxScreenTiltDeg &&
      Math.abs(current.inPlaneRollDeg) <= maxInPlaneRollDeg;

    return {
      borderColor: withTiming(isLevel ? C.hud : C.hairline, {
        duration: COLOR_MS,
      }),
    };
  });

  if (!posture.isAvailable) {
    return null;
  }

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={styles.frame}>
        <Animated.View style={[styles.corner, styles.cornerTL, referenceStyle]} />
        <Animated.View style={[styles.corner, styles.cornerTR, referenceStyle]} />
        <Animated.View style={[styles.corner, styles.cornerBL, referenceStyle]} />
        <Animated.View style={[styles.corner, styles.cornerBR, referenceStyle]} />

        <View style={styles.reference} />
        <Animated.View style={[styles.horizon, horizonStyle]} />
      </View>

      <Text style={styles.caption}>{CAPTIONS[posture.guidance]}</Text>
    </View>
  );
}

const CORNER = 12;

const styles = StyleSheet.create({
  root: {
    gap: S.sm,
  },
  frame: {
    height: FRAME_HEIGHT,
    borderRadius: 4,
    backgroundColor: 'rgba(245,245,242,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  /** Fixed target the horizon lines up with when the pose is accepted. */
  reference: {
    position: 'absolute',
    width: 36,
    height: 1,
    backgroundColor: C.hairline,
  },
  horizon: {
    position: 'absolute',
    width: '70%',
    height: 2,
    borderRadius: 1,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderStyle: 'solid',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 1,
    borderLeftWidth: 1,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 1,
    borderRightWidth: 1,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 1,
    borderRightWidth: 1,
  },
  caption: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 1.6,
    color: C.whiteDim,
    textAlign: 'center',
  },
});
