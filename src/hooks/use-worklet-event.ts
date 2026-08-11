import { useEffect, useState } from 'react';

/**
 * One-way channel for pushing values from a worklet runtime to the JS thread.
 *
 * The frame worklet runs on VisionCamera's own thread, so it cannot call a
 * React callback directly — it hands the value to `deliver` through
 * `scheduleOnRN`. `deliver` is created once and never changes identity, which
 * matters: `useFrameOutput` re-registers the frame callback whenever `onFrame`
 * changes, so anything captured in that closure has to be stable or the camera
 * thread is handed a new worklet on every render.
 */
export interface WorkletEvent<TArgs extends unknown[]> {
  /** Stable dispatcher. Capture this in a worklet and call it via `scheduleOnRN`. */
  deliver(...args: TArgs): void;
  /** Points the channel at a new handler, or detaches with `null`. */
  setListener(listener: ((...args: TArgs) => void) | null): void;
}

export function createWorkletEvent<
  TArgs extends unknown[],
>(): WorkletEvent<TArgs> {
  let listener: ((...args: TArgs) => void) | null = null;

  return {
    deliver: (...args: TArgs): void => {
      listener?.(...args);
    },
    setListener: (next: ((...args: TArgs) => void) | null): void => {
      listener = next;
    },
  };
}

/** Creates a stable {@link WorkletEvent} for the producer side of the bridge. */
export function useWorkletEvent<TArgs extends unknown[]>(): WorkletEvent<
  TArgs
> {
  const [event] = useState(() => createWorkletEvent<TArgs>());

  return event;
}

/**
 * Routes a {@link WorkletEvent} to `listener` for as long as the caller is
 * mounted.
 *
 * Deliberately has no dependency array: `listener` closes over the current
 * render's state, and re-pointing the channel is a single field assignment, so
 * refreshing it every render is cheaper than memoizing it.
 */
export function useWorkletEventListener<TArgs extends unknown[]>(
  event: WorkletEvent<TArgs>,
  listener: (...args: TArgs) => void,
): void {
  useEffect(() => {
    // Subscribing to an external system, not lifting state: this hands the
    // channel a function to call later and renders nothing by itself.
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent
    event.setListener(listener);
    return () => event.setListener(null);
  });
}
