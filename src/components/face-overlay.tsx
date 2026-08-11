import React from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import {
  EMPTY_LAYOUT,
  MAX_FACES,
  type OverlayLayout,
  type OverlayState,
} from '../types';
import { FaceFrame } from './face-frame';

interface FaceOverlayProps {
  overlayFaces: SharedValue<OverlayState>;
  matchNames: (string | null)[];
  hasEnrollments: boolean;
}

const FACE_SLOTS = Array.from({ length: MAX_FACES }, (_, index) => index);

export function FaceOverlay({
  overlayFaces,
  matchNames,
  hasEnrollments,
}: FaceOverlayProps): React.JSX.Element {
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
      {FACE_SLOTS.map(faceIndex => (
        <FaceFrame
          key={faceIndex}
          faceIndex={faceIndex}
          layout={layout}
          overlayFaces={overlayFaces}
          matchName={matchNames[faceIndex] ?? null}
          hasEnrollments={hasEnrollments}
        />
      ))}
    </View>
  );
}
