import { useEffect, useRef } from 'react';
import type React from 'react';
import type { FaceRecognizer } from 'react-native-vision-camera-face-recognizer';
import type { FaceEngine } from '../hooks/use-face-engine';
import { useProfilesStore } from '../hooks/use-profiles-store';
import { useRecognitionViewState } from '../hooks/use-recognition-view-state';
import { FaceOverlay } from './face-overlay';
import { Hud } from './hud';

interface FaceRecognitionLayerProps {
  engine: FaceEngine;
}

interface RestoredGallery {
  recognizer: FaceRecognizer;
  generation: number;
}

export function FaceRecognitionLayer({
  engine,
}: FaceRecognitionLayerProps): React.JSX.Element {
  const profiles = useProfilesStore();
  const recognition = useRecognitionViewState(engine.recognitionOut, profiles);
  const recognizer = engine.recognizer;
  const hasEnrollments = profiles.list.length > 0;

  const { restoreEnrollments, status, generation } = profiles;
  // Pushing the gallery into native is not idempotent in cost: it parses and
  // renormalizes every template. Do it once per (recognizer, gallery) pair
  // rather than on every render this layer happens to make.
  const restored = useRef<RestoredGallery | null>(null);

  useEffect((): void => {
    if (recognizer == null || status !== 'ready') {
      return;
    }
    if (
      restored.current?.recognizer === recognizer &&
      restored.current.generation === generation
    ) {
      return;
    }

    restored.current = { recognizer, generation };
    restoreEnrollments(recognizer);
  }, [recognizer, status, generation, restoreEnrollments]);

  if (recognizer == null) {
    return <></>;
  }

  return (
    <>
      <FaceOverlay
        overlayFaces={engine.overlayFaces}
        matchNames={recognition.matchNames}
        hasEnrollments={hasEnrollments}
      />
      <Hud
        engine={engine}
        recognizer={recognizer}
        profiles={profiles}
        recognitionStatus={recognition.status}
      />
    </>
  );
}
