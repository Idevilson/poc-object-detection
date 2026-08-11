import { useState } from 'react';
import {
  type SharedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import {
  createSynchronizable,
  type Synchronizable,
} from 'react-native-worklets';

export interface VersionedValue<TValue> {
  value: TValue;
  version: number;
}

export function createVersionedValue<TValue>(
  value: TValue,
  version: number,
): VersionedValue<TValue> {
  return { value, version };
}

export function useSynchronizable<TValue>(
  initialValue: TValue,
): Synchronizable<TValue> {
  const [synchronizable] = useState(() => createSynchronizable(initialValue));
  return synchronizable;
}

export function useVersionedSharedValueMirror<TValue>(
  source: Synchronizable<VersionedValue<TValue>>,
  target: SharedValue<TValue>,
): void {
  const lastVersion = useSharedValue(-1);
  useFrameCallback(() => {
    'worklet';

    const next = source.getDirty();
    if (next.version !== lastVersion.get()) {
      lastVersion.set(next.version);
      target.set(next.value);
    }
  });
}
