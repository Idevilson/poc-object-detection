import { useMemo, useSyncExternalStore } from 'react'
import { ObjectDetection } from '../ObjectDetection'
import type { ObjectDetector } from '../specs/ObjectDetector.nitro'
import type { ObjectDetectorOptions } from '../types/ObjectDetectorOptions'

export interface UseObjectDetectorOptions extends ObjectDetectorOptions {
  /**
   * Controls the native detector lifecycle.
   *
   * When `false`, the hook releases the current detector and clears the result.
   * Native resources are disposed after any in-flight worklet releases its
   * reference. Set this from camera/app foreground state so model memory is not
   * held while frames are not being processed.
   */
  isActive: boolean
}

export interface UseObjectDetectorResult {
  /**
   * Ready native detector, or `undefined` while inactive, loading, or after an
   * initialization failure.
   */
  detector: ObjectDetector | undefined
  /** Initialization error from the latest creation attempt. */
  error: Error | undefined
  /** `true` while the native model is being loaded for the active options. */
  isLoading: boolean
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

const INACTIVE: UseObjectDetectorResult = {
  detector: undefined,
  error: undefined,
  isLoading: false,
}

const LOADING: UseObjectDetectorResult = {
  detector: undefined,
  error: undefined,
  isLoading: true,
}

class ObjectDetectorStore {
  private readonly options: ObjectDetectorOptions | undefined
  private readonly listeners = new Set<() => void>()
  private snapshot: UseObjectDetectorResult
  private runId = 0

  constructor(options: ObjectDetectorOptions | undefined) {
    this.options = options
    this.snapshot = options === undefined ? INACTIVE : LOADING
  }

  readonly subscribe = (onStoreChange: () => void): (() => void) => {
    this.listeners.add(onStoreChange)
    if (this.listeners.size === 1) {
      this.start()
    }

    return () => {
      this.listeners.delete(onStoreChange)
      if (this.listeners.size === 0) {
        this.stop()
      }
    }
  }

  readonly getSnapshot = (): UseObjectDetectorResult => this.snapshot

  readonly getServerSnapshot = (): UseObjectDetectorResult => INACTIVE

  private start(): void {
    const options = this.options
    if (options === undefined) {
      return
    }

    const runId = ++this.runId

    ObjectDetection.create(options)
      .then((detector: ObjectDetector) => {
        if (runId !== this.runId) {
          detector.dispose()
          return
        }
        this.publish({ detector, error: undefined, isLoading: false })
      })
      .catch((creationError: unknown) => {
        if (runId !== this.runId) {
          return
        }
        this.publish({
          detector: undefined,
          error: toError(creationError),
          isLoading: false,
        })
      })
  }

  private stop(): void {
    this.runId++
    this.snapshot = this.options === undefined ? INACTIVE : LOADING
  }

  private publish(next: UseObjectDetectorResult): void {
    this.snapshot = next
    for (const listener of this.listeners) {
      listener()
    }
  }
}

export function useObjectDetector(
  options: UseObjectDetectorOptions
): UseObjectDetectorResult {
  const { isActive, provider, threads } = options
  const { inputSize, maxObjects, minObjectSize, threshold } = options.detection

  // Not a perf optimization: store identity *is* the native detector's
  // lifetime, and `bob` ships this package without React Compiler, so
  // memoization has to be explicit here.
  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const store = useMemo(
    () =>
      new ObjectDetectorStore(
        isActive
          ? {
              provider,
              threads,
              detection: { inputSize, maxObjects, minObjectSize, threshold },
            }
          : undefined
      ),
    [
      isActive,
      provider,
      threads,
      inputSize,
      maxObjects,
      minObjectSize,
      threshold,
    ]
  )

  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )
}
