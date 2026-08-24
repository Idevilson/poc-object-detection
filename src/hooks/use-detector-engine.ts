import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  type ObjectDetector,
  useObjectDetector,
} from 'react-native-vision-camera-face-recognizer';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import {
  type CameraDevice,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
} from 'react-native-vision-camera';
import {
  EMPTY_OVERLAY_STATE,
  INITIAL_DETECTION_STATE,
  MAX_OBJECTS,
  type DetectionState,
  type OverlayState,
} from '../types';
import {
  type DetectionPipelineState,
  runDetectionFrame,
} from '../utils/detection-pipeline';
import {
  createVersionedValue,
  useSynchronizable,
  useVersionedSharedValueMirror,
  type VersionedValue,
} from './use-synchronizable';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface DetectorEngine {
  device: CameraDevice | undefined;
  hasPermission: boolean;
  isForeground: boolean;
  error: string | undefined;
  detector: ObjectDetector | undefined;
  frameOutput: ReturnType<typeof useFrameOutput>;
  overlayObjects: SharedValue<OverlayState>;
  detectionOut: SharedValue<DetectionState>;
}

export function useDetectorEngine(): DetectorEngine {
  // Back camera: the point is to aim the handset at a scene, not at yourself.
  const device = useCameraDevice('back');
  const permission = useCameraPermission();
  const [permissionError, setPermissionError] = useState<string>();
  const [isForeground, setIsForeground] = useState(
    AppState.currentState === 'active',
  );

  const overlayObjects = useSharedValue<OverlayState>(EMPTY_OVERLAY_STATE);
  const detectionOut = useSharedValue<DetectionState>(
    INITIAL_DETECTION_STATE,
  );

  const overlaySync = useSynchronizable<VersionedValue<OverlayState>>(
    createVersionedValue(EMPTY_OVERLAY_STATE, EMPTY_OVERLAY_STATE.version),
  );
  const detectionSync = useSynchronizable<VersionedValue<DetectionState>>(
    createVersionedValue(INITIAL_DETECTION_STATE, 0),
  );
  const resultVersion = useSynchronizable<number>(0);

  const objectDetection = useObjectDetector({
    isActive: isForeground,
    provider: 'auto',
    threads: 4,
    detection: {
      maxObjects: MAX_OBJECTS,
      // YOLOX-Nano scores are objectness * class probability. Below ~0.3 the
      // COCO tail starts hallucinating on textured backgrounds.
      threshold: 0.3,
      minObjectSize: 24,
      // The bundled export has a fixed 416x416 input.
      inputSize: 416,
    },
  });

  const detector = objectDetection.detector;
  const error =
    permissionError ??
    (objectDetection.error == null
      ? undefined
      : getErrorMessage(objectDetection.error));

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

  useVersionedSharedValueMirror(overlaySync, overlayObjects);
  useVersionedSharedValueMirror(detectionSync, detectionOut);

  const pipelineState: DetectionPipelineState = {
    overlay: overlaySync,
    detection: detectionSync,
    resultVersion,
  };

  const frameOutput = useFrameOutput({
    targetResolution: { width: 640, height: 480 },
    pixelFormat: 'yuv',
    enablePhysicalBufferRotation: Platform.OS === 'ios',
    enablePreviewSizedOutputBuffers: true,
    allowDeferredStart: true,
    onFrame(frame) {
      'worklet';

      runDetectionFrame(detector, frame, pipelineState);
    },
  });

  return {
    device,
    hasPermission: permission.hasPermission,
    isForeground,
    error,
    detector,
    frameOutput,
    overlayObjects,
    detectionOut,
  };
}
