import { useEffect, useRef, useState } from 'react';
import type { Synchronizable } from 'react-native-worklets';
import type {
  EnrollFaceStatus,
  FaceRecognizer,
} from 'react-native-vision-camera-face-recognizer';
import {
  useWorkletEventListener,
  type WorkletEvent,
} from './use-worklet-event';

export const TARGET_SAMPLES = 5;

const CAPTURE_INTERVAL_MS = 650;
const FIRST_CAPTURE_DELAY_MS = 120;
const FINALIZE_DELAY_MS = 120;

const MAX_MISSES = 15;

/**
 * How soon to look again after the device was out of position. Shorter than a
 * normal capture interval so the run resumes the moment the operator corrects
 * the pose.
 */
const POSTURE_RETRY_MS = 200;

const POSTURE_HINT = 'Hold the device in the required position.';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface EnrollJob {
  /** Stable identity key used by native enrollment and persisted storage. */
  slug: string;
  /** Display name shown after registration. */
  fullName: string;
}

/**
 * Where a guided enrollment run currently is. The UI renders one step per
 * phase, so the operator never has to guess what the app expects next.
 */
export type EnrollmentPhase =
  | 'idle'
  | 'capturing'
  | 'finalizing'
  | 'success'
  | 'error';

export interface EnrollmentSession {
  /** Starts a guided multi-sample enrollment run for one identity. */
  start(job: EnrollJob): void;

  /** Restarts the run that just failed, reusing the same identity. */
  retry(): void;

  /** Abandons the run (or clears a finished one) and returns to idle. */
  cancel(): void;

  /** Current step of the guided run. */
  phase: EnrollmentPhase;

  /** Identity being captured, or the one a finished run belongs to. */
  job: EnrollJob | null;

  /** Number of accepted samples captured for the active identity. */
  captured: number;

  /** Number of accepted samples required before finalizing enrollment. */
  target: number;

  /** `true` while frames are still being captured or saved. */
  busy: boolean;

  /** Current operator-facing capture hint. */
  hint: string;
}

/**
 * Pose asked for before each sample. Index `n` is shown once `n` samples have
 * been accepted, so the operator always reads one concrete instruction.
 */
const CAPTURE_POSES = [
  'Look straight at the camera.',
  'Turn your head slightly left.',
  'Turn your head slightly right.',
  'Lift your chin a little.',
  'Lower your chin a little.',
];

function getPoseHint(captured: number): string {
  const pose = CAPTURE_POSES[captured];
  return pose ?? 'Hold still.';
}

interface RetryPolicy {
  hint: string;
  failureHint: string | null;
  countMiss: boolean;
}

const RETRY_POLICIES = {
  redundant: {
    hint: 'Hold a new angle — that pose is already captured.',
    failureHint: null,
    countMiss: false,
  },
  noFace: {
    hint: 'Center your face in the frame.',
    failureHint: 'No face detected — move into good light and try again.',
    countMiss: true,
  },
  multipleFaces: {
    hint: 'Only one face in frame, please.',
    failureHint: 'Multiple faces — capture with only one person in frame.',
    countMiss: true,
  },
  spoof: {
    hint: 'Spoof detected — use your real face, not a photo.',
    failureHint: 'Spoof detected — capture with a real, live face.',
    countMiss: true,
  },
  lowQuality: {
    hint: 'Face the camera directly and keep your expression neutral.',
    failureHint: 'Face angle is too extreme — face the camera and try again.',
    countMiss: true,
  },
} satisfies Partial<Record<EnrollFaceStatus, RetryPolicy>>;

type RetryableEnrollFaceStatus = keyof typeof RETRY_POLICIES;

function isRetryableEnrollFaceStatus(
  status: EnrollFaceStatus,
): status is RetryableEnrollFaceStatus {
  return status in RETRY_POLICIES;
}

function getRetryPolicy(status: RetryableEnrollFaceStatus): RetryPolicy {
  return RETRY_POLICIES[status];
}

interface EnrollmentState {
  phase: EnrollmentPhase;
  job: EnrollJob | null;
  captured: number;
  hint: string;
}

const IDLE_STATE: EnrollmentState = {
  phase: 'idle',
  job: null,
  captured: 0,
  hint: '',
};

export interface EnrollmentHandlers {
  /** Called once a run captured every sample and the payload is ready. */
  onRegistered(
    job: EnrollJob,
    enrollment: ArrayBuffer,
    sampleCount: number,
  ): void;

  /**
   * Called when a run ends without registering. Samples already accepted by the
   * native recognizer belong to nobody at that point, so the owner has to drop
   * or restore them.
   */
  onDiscarded(job: EnrollJob, capturedSamples: number): void;
}

export function useEnrollment(
  recognizer: FaceRecognizer,
  enrollRequest: Synchronizable<string | null>,
  enrollResults: WorkletEvent<[id: string, status: EnrollFaceStatus]>,
  handlers: EnrollmentHandlers,
  canCapture: () => boolean,
): EnrollmentSession {
  const [state, setState] = useState<EnrollmentState>(IDLE_STATE);
  const job = useRef<EnrollJob | null>(null);
  const misses = useRef(0);
  const capturedRef = useRef(0);
  const activeRunId = useRef(0);
  const captureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = (): void => {
    if (captureTimer.current != null) {
      clearTimeout(captureTimer.current);
      captureTimer.current = null;
    }
  };

  const requestCapture = (slug: string): void => {
    enrollRequest.setBlocking(slug);
  };

  const scheduleCapture = (
    slug: string,
    runId: number,
    delayMs: number,
  ): void => {
    clearTimer();
    captureTimer.current = setTimeout((): void => {
      if (activeRunId.current !== runId || job.current?.slug !== slug) {
        return;
      }

      // A wrong device pose is "not yet", not a failed attempt. Reschedule
      // without touching the miss counter so the run waits for the operator
      // instead of aborting under MAX_MISSES.
      if (!canCapture()) {
        setState(previous =>
          previous.hint === POSTURE_HINT
            ? previous
            : { ...previous, hint: POSTURE_HINT },
        );
        scheduleCapture(slug, runId, POSTURE_RETRY_MS);
        return;
      }

      requestCapture(slug);
    }, delayMs);
  };

  const scheduleNextCapture = (slug: string, runId: number): void => {
    scheduleCapture(slug, runId, CAPTURE_INTERVAL_MS);
  };

  const discard = (
    discarded: EnrollJob,
    capturedSamples: number,
  ): string | null => {
    try {
      handlers.onDiscarded(discarded, capturedSamples);
      return null;
    } catch (error: unknown) {
      return getErrorMessage(error);
    }
  };

  const finish = (completed: EnrollJob, sampleCount: number): void => {
    clearTimer();
    const finishingRunId = activeRunId.current;
    setState({
      phase: 'finalizing',
      job: completed,
      captured: sampleCount,
      hint: 'Saving identity…',
    });
    captureTimer.current = setTimeout((): void => {
      captureTimer.current = null;
      if (activeRunId.current !== finishingRunId || job.current !== completed) {
        return;
      }

      try {
        const enrollment = recognizer.getEnrollment(completed.slug);
        handlers.onRegistered(completed, enrollment, sampleCount);
        job.current = null;
        setState({
          phase: 'success',
          job: completed,
          captured: sampleCount,
          hint: `${completed.fullName} can now be recognized.`,
        });
      } catch (error: unknown) {
        fail(completed, `Failed to save identity: ${getErrorMessage(error)}`);
      }
    }, FINALIZE_DELAY_MS);
  };

  const fail = (failed: EnrollJob, message: string): void => {
    clearTimer();
    activeRunId.current += 1;
    job.current = null;
    const capturedSamples = capturedRef.current;
    const discardError =
      capturedSamples > 0 ? discard(failed, capturedSamples) : null;
    setState({
      phase: 'error',
      job: failed,
      captured: capturedSamples,
      hint:
        discardError == null
          ? message
          : `${message} Cleanup failed: ${discardError}`,
    });
  };

  const start = (next: EnrollJob): void => {
    clearTimer();
    const runId = activeRunId.current + 1;
    activeRunId.current = runId;
    job.current = next;
    misses.current = 0;
    capturedRef.current = 0;

    setState({
      phase: 'capturing',
      job: next,
      captured: 0,
      hint: getPoseHint(0),
    });
    scheduleCapture(next.slug, runId, FIRST_CAPTURE_DELAY_MS);
  };

  const retry = (): void => {
    const previous = state.job;
    if (previous != null) {
      start(previous);
    }
  };

  const cancel = (): void => {
    clearTimer();
    activeRunId.current += 1;
    const aborted = job.current;
    job.current = null;
    const capturedSamples = capturedRef.current;
    const discardError =
      aborted != null && capturedSamples > 0
        ? discard(aborted, capturedSamples)
        : null;
    capturedRef.current = 0;
    setState(
      aborted != null && discardError != null
        ? {
            phase: 'error',
            job: aborted,
            captured: capturedSamples,
            hint: `Failed to cancel enrollment: ${discardError}`,
          }
        : IDLE_STATE,
    );
  };

  // Each result is delivered once from the frame that produced it. Ignore
  // results after their job was cancelled or replaced.
  const handleResult = (id: string, status: EnrollFaceStatus): void => {
    const active = job.current;
    if (active == null || id !== active.slug) {
      return;
    }

    if (status === 'enrolled') {
      misses.current = 0;
      const nextCaptured = capturedRef.current + 1;
      capturedRef.current = nextCaptured;
      if (nextCaptured >= TARGET_SAMPLES) {
        finish(active, nextCaptured);
      } else {
        setState({
          phase: 'capturing',
          job: active,
          captured: nextCaptured,
          hint: getPoseHint(nextCaptured),
        });
        scheduleNextCapture(active.slug, activeRunId.current);
      }
      return;
    }

    if (!isRetryableEnrollFaceStatus(status)) {
      throw new Error(`Unsupported enrollment status: ${status}`);
    }

    const policy = getRetryPolicy(status);
    if (policy.countMiss) {
      misses.current += 1;
    }
    if (
      policy.failureHint != null &&
      policy.countMiss &&
      misses.current >= MAX_MISSES
    ) {
      fail(active, policy.failureHint);
      return;
    }
    setState({
      phase: 'capturing',
      job: active,
      captured: capturedRef.current,
      hint: policy.hint,
    });
    scheduleNextCapture(active.slug, activeRunId.current);
  };

  const busy = state.phase === 'capturing' || state.phase === 'finalizing';

  useWorkletEventListener(enrollResults, handleResult);

  useEffect(() => {
    return () => {
      if (captureTimer.current != null) {
        clearTimeout(captureTimer.current);
        captureTimer.current = null;
      }
    };
  }, []);

  return {
    start,
    retry,
    cancel,
    phase: state.phase,
    job: state.job,
    captured: state.captured,
    target: TARGET_SAMPLES,
    busy,
    hint: state.hint,
  };
}
