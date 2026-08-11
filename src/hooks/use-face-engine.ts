import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  type EnrollFaceStatus,
  type FaceRecognizer,
  useFaceRecognizer,
} from 'react-native-vision-camera-face-recognizer';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import type { Synchronizable } from 'react-native-worklets';
import {
  type CameraDevice,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
} from 'react-native-vision-camera';
import {
  EMPTY_OVERLAY_STATE,
  INITIAL_RECOGNITION_STATE,
  type Mode,
  type OverlayState,
  type RecognitionState,
} from '../types';
import { type FacePipelineState, runFaceFrame } from '../utils/face-pipeline';
import {
  createVersionedValue,
  useSynchronizable,
  useVersionedSharedValueMirror,
  type VersionedValue,
} from './use-synchronizable';
import { useWorkletEvent, type WorkletEvent } from './use-worklet-event';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface FaceEngine {
  device: CameraDevice | undefined;
  hasPermission: boolean;
  isForeground: boolean;
  error: string | undefined;
  recognizer: FaceRecognizer | undefined;
  frameOutput: ReturnType<typeof useFrameOutput>;
  overlayFaces: SharedValue<OverlayState>;
  enrollRequest: Synchronizable<string | null>;
  enrollResults: WorkletEvent<[id: string, status: EnrollFaceStatus]>;
  recognitionOut: SharedValue<RecognitionState>;
  modeSync: Synchronizable<Mode>;
}

export function useFaceEngine(): FaceEngine {
  const device = useCameraDevice('front');
  const permission = useCameraPermission();
  const [permissionError, setPermissionError] = useState<string>();
  const [isForeground, setIsForeground] = useState(
    AppState.currentState === 'active',
  );

  const overlayFaces = useSharedValue<OverlayState>(EMPTY_OVERLAY_STATE);
  const recognitionOut = useSharedValue<RecognitionState>(
    INITIAL_RECOGNITION_STATE,
  );

  const overlaySync = useSynchronizable<VersionedValue<OverlayState>>(
    createVersionedValue(EMPTY_OVERLAY_STATE, EMPTY_OVERLAY_STATE.version),
  );
  const recognitionSync = useSynchronizable<VersionedValue<RecognitionState>>(
    createVersionedValue(INITIAL_RECOGNITION_STATE, 0),
  );
  const enrollRequest = useSynchronizable<string | null>(null);
  const enrollResults =
    useWorkletEvent<[id: string, status: EnrollFaceStatus]>();
  const modeSync = useSynchronizable<Mode>('recognize');
  const faceResultVersion = useSynchronizable<number>(0);

  const faceRecognition = useFaceRecognizer({
    isActive: isForeground,
    provider: 'auto',
    threads: 4,
    detection: {
      maxFaces: 4,
      threshold: 0.6,
      minFaceSize: 32,
      inputSize: 128,
    },
    recognition: {
      candidateRetrieval: 'centroid',
      threshold: 0.5,
      minimumMargin: 0.05,
      samplesPerDecision: 5,
      interval: 10,
      matchedInterval: 45,
      minFaceSize: 56,
    },
    tracking: {
      enabled: true,
      detectionInterval: 10,
    },
    liveness: {
      enabled: true,
      threshold: 0.5,
    },
  });

  const recognizer = faceRecognition.recognizer;
  const error =
    permissionError ??
    (faceRecognition.error == null
      ? undefined
      : getErrorMessage(faceRecognition.error));

  const { canRequestPermission, requestPermission } = permission;
  useEffect(() => {
    if (canRequestPermission) {
      requestPermission().catch((requestError: unknown) => {
        setPermissionError(getErrorMessage(requestError));
      });
    }
  }, [canRequestPermission, requestPermission]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      setIsForeground(next === 'active');
    });
    return () => subscription.remove();
  }, []);

  useVersionedSharedValueMirror(overlaySync, overlayFaces);
  useVersionedSharedValueMirror(recognitionSync, recognitionOut);

  const pipelineState: FacePipelineState = {
    overlay: overlaySync,
    recognition: recognitionSync,
    enrollRequest,
    onEnrollResult: enrollResults.deliver,
    mode: modeSync,
    faceResultVersion,
  };

  const frameOutput = useFrameOutput({
    targetResolution: { width: 640, height: 480 },
    pixelFormat: 'yuv',
    enablePhysicalBufferRotation: Platform.OS === 'ios',
    enablePreviewSizedOutputBuffers: true,
    allowDeferredStart: true,
    onFrame(frame) {
      'worklet';

      runFaceFrame(recognizer, frame, pipelineState);
    },
  });

  return {
    device,
    hasPermission: permission.hasPermission,
    isForeground,
    error,
    recognizer,
    frameOutput,
    overlayFaces,
    enrollRequest,
    enrollResults,
    recognitionOut,
    modeSync,
  };
}
