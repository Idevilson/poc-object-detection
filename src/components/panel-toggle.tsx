import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { C, MONO, S } from '../constants/theme';

interface PanelToggleProps {
  expanded: boolean;
  onToggle: () => void;
}

const DURATION_MS = 220;

/**
 * Top-right control that expands the enrollment panel and collapses back to the
 * scanner. The glyph rotates 45° so the `+` reads as an `×` while expanded.
 */
export function PanelToggle({
  expanded,
  onToggle,
}: PanelToggleProps): React.JSX.Element {
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect((): void => {
    progress.set(withTiming(expanded ? 1 : 0, { duration: DURATION_MS }));
  }, [expanded, progress]);

  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [C.panel, C.hud]),
    borderColor: interpolateColor(progress.get(), [0, 1], [C.hairline, C.hud]),
  }));

  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.get() * 45}deg` }],
  }));

  const barStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [C.white, C.bg]),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.get(), [0, 1], [C.white, C.bg]),
  }));

  return (
    <Pressable
      onPress={onToggle}
      hitSlop={S.sm}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={
        expanded ? 'Close enrollment panel' : 'Open enrollment panel'
      }
    >
      <Animated.View style={[styles.shell, shellStyle]}>
        <Animated.View style={[styles.glyph, glyphStyle]}>
          <Animated.View style={[styles.bar, styles.barH, barStyle]} />
          <Animated.View style={[styles.bar, styles.barV, barStyle]} />
        </Animated.View>
        <Animated.Text style={[styles.label, labelStyle]}>
          {expanded ? 'CLOSE' : 'ENROLL'}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    height: 36,
    paddingHorizontal: S.md,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  glyph: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    borderRadius: 1,
  },
  barH: {
    width: 12,
    height: 2,
  },
  barV: {
    width: 2,
    height: 12,
  },
  label: {
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
});
