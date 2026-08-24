import type React from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import type { SlotView } from '../hooks/use-detection-view-state';
import {
  EMPTY_LAYOUT,
  MAX_OBJECTS,
  type OverlayLayout,
  type OverlayState,
} from '../types';
import { ObjectFrame } from './object-frame';

interface ObjectOverlayProps {
  overlayObjects: SharedValue<OverlayState>;
  slots: (SlotView | null)[];
}

// Every slot is mounted up front: an animated component cannot be created from
// the worklet that produces detections, so the pool is fixed and slots are
// simply empty when unused.
const SLOT_INDEXES = Array.from({ length: MAX_OBJECTS }, (_, index) => index);

export function ObjectOverlay({
  overlayObjects,
  slots,
}: ObjectOverlayProps): React.JSX.Element {
  const layout = useSharedValue<OverlayLayout>(EMPTY_LAYOUT);

  const onLayout = (event: LayoutChangeEvent): void => {
    const next = event.nativeEvent.layout;
    const previous = layout.get();
    if (next.width !== previous.width || next.height !== previous.height) {
      layout.set({ width: next.width, height: next.height });
    }
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={onLayout}
    >
      {SLOT_INDEXES.map(slotIndex => (
        <ObjectFrame
          key={slotIndex}
          slotIndex={slotIndex}
          layout={layout}
          overlayObjects={overlayObjects}
          slot={slots[slotIndex] ?? null}
        />
      ))}
    </View>
  );
}
