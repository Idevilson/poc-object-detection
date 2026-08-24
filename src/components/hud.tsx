import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, MONO, S, TYPE } from '../constants/theme';
import type { SlotView } from '../hooks/use-detection-view-state';

interface HudProps {
  status: string;
  objectCount: number;
  slots: (SlotView | null)[];
}

export function Hud({
  status,
  objectCount,
  slots,
}: HudProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const detected = slots.filter((slot): slot is SlotView => slot != null);

  return (
    <View
      style={[styles.root, { paddingBottom: insets.bottom + S.lg }]}
      pointerEvents="none"
    >
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={TYPE.micro}>DETECTED</Text>
          <Text style={TYPE.microBright}>{objectCount}</Text>
        </View>
        <View style={styles.divider} />
        {detected.length === 0 ? (
          <Text style={styles.status}>{status}</Text>
        ) : (
          <View style={styles.list}>
            {detected.map((slot, index) => (
              <View key={`${slot.label}-${index}`} style={styles.row}>
                <View style={[styles.swatch, { backgroundColor: slot.color }]} />
                <Text style={styles.label} numberOfLines={1}>
                  {slot.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: S.lg,
  },
  panel: {
    backgroundColor: C.panel,
    borderColor: C.panelBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: S.sm,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: S.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.hairline,
    marginBottom: S.sm,
  },
  status: {
    ...TYPE.micro,
    paddingBottom: S.xs,
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: S.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs,
    paddingVertical: 2,
  },
  swatch: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  label: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 1.2,
    color: C.white,
  },
});
