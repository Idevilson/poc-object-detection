import { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';

/** Anything the scheduler can call off before it runs. */
interface Cancelable {
  cancel(): void;
}

export interface Scheduler {
  /**
   * Runs `action` after `delayMs`. Re-using a key restarts that timer, so the
   * most recent request always gets a full window.
   */
  after(key: string, delayMs: number, action: () => void): void;
  /**
   * Runs `action` once UI interactions settle, so native gallery writes do not
   * compete with an in-flight animation. Re-using a key replaces the pending
   * action.
   */
  afterInteractions(key: string, action: () => void): void;
  /** Calls off the pending action for `key`, if there is one. */
  cancel(key: string): void;
}

/**
 * Owns cancelable background work for a component lifecycle.
 *
 * Work is scheduled from the event handler that caused it rather than reacted
 * to in an effect, and anything still pending is cancelled on unmount.
 */
export function useScheduler(): Scheduler {
  const pending = useRef<Map<string, Cancelable>>(new Map());

  useEffect(() => {
    const actions = pending.current;
    return () => {
      for (const action of actions.values()) {
        action.cancel();
      }
      actions.clear();
    };
  }, []);

  const cancel = (key: string): void => {
    const action = pending.current.get(key);
    if (action != null) {
      action.cancel();
      pending.current.delete(key);
    }
  };

  return {
    after(key: string, delayMs: number, action: () => void): void {
      cancel(key);
      const timer = setTimeout((): void => {
        pending.current.delete(key);
        action();
      }, delayMs);
      pending.current.set(key, { cancel: () => clearTimeout(timer) });
    },

    afterInteractions(key: string, action: () => void): void {
      cancel(key);
      pending.current.set(
        key,
        InteractionManager.runAfterInteractions((): void => {
          pending.current.delete(key);
          action();
        }),
      );
    },

    cancel,
  };
}
