import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, MONO, S, TYPE } from '../constants/theme';
import type { Mode } from '../types';
import { PanelToggle } from './panel-toggle';

interface TopBarProps {
  mode: Mode;
  expanded: boolean;
  onToggle: () => void;
}

export function TopBar({
  mode,
  expanded,
  onToggle,
}: TopBarProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { paddingTop: insets.top + S.sm }]}
    >
      <View style={styles.row} pointerEvents="box-none">
        <View style={styles.identity} pointerEvents="none">
          <Text style={styles.brand}>
            FACE<Text style={styles.brandAccent}>·</Text>ID
          </Text>
          <View style={styles.bars}>
            <View style={[styles.bar, styles.barOn]} />
            <View style={[styles.bar, styles.barOn]} />
            <View style={styles.bar} />
            <View style={styles.globe} />
          </View>
        </View>
        <PanelToggle expanded={expanded} onToggle={onToggle} />
      </View>
      <Text style={TYPE.micro} pointerEvents="none">
        {mode === 'register' ? 'ENROLLMENT TERMINAL' : 'BIOMETRIC SCANNER'} ·
        SECURE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: S.lg,
    gap: S.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
  },
  brand: {
    fontFamily: MONO,
    fontSize: 16,
    letterSpacing: 3,
    color: C.white,
    fontWeight: '700',
  },
  brandAccent: {
    color: C.hud,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bar: {
    width: 16,
    height: 4,
    backgroundColor: C.neutral,
  },
  barOn: {
    backgroundColor: C.hud,
  },
  globe: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: C.whiteDim,
    marginLeft: 2,
  },
});
