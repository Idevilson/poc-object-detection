import { useEffect } from 'react';
import type React from 'react';
import type { FaceEngine } from '../hooks/use-face-engine';
import { useProfilesStore } from '../hooks/use-profiles-store';
import { useRecognitionViewState } from '../hooks/use-recognition-view-state';
import { FaceOverlay } from './face-overlay';
import { Hud } from './hud';

interface FaceRecognitionLayerProps {
  engine: FaceEngine;
}

export function FaceRecognitionLayer({
  engine,
}: FaceRecognitionLayerProps): React.JSX.Element {
  const profiles = useProfilesStore();
  const recognition = useRecognitionViewState(
    engine.recognitionOut,
    profiles,
  );
  const recognizer = engine.recognizer;
  const { restoreEnrollments } = profiles;
  const hasEnrollments = profiles.list.length > 0;

  useEffect((): void => {
    if (recognizer != null) {
      restoreEnrollments(recognizer);
    }
  }, [restoreEnrollments, recognizer]);

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
