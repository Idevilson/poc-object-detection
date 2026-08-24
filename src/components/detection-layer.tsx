import type React from 'react';
import type { DetectorEngine } from '../hooks/use-detector-engine';
import { useDetectionViewState } from '../hooks/use-detection-view-state';
import { Hud } from './hud';
import { ObjectOverlay } from './object-overlay';

interface DetectionLayerProps {
  engine: DetectorEngine;
}

export function DetectionLayer({
  engine,
}: DetectionLayerProps): React.JSX.Element {
  const detection = useDetectionViewState(engine.detectionOut);

  return (
    <>
      <ObjectOverlay
        overlayObjects={engine.overlayObjects}
        slots={detection.slots}
      />
      <Hud
        status={detection.status}
        objectCount={detection.objectCount}
        slots={detection.slots}
      />
    </>
  );
}
