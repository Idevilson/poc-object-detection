import type React from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, type Constraint } from 'react-native-vision-camera';
import { CenteredMessage } from './src/components/centered-message';
import { DetectionLayer } from './src/components/detection-layer';
import { C } from './src/constants/theme';
import { useDetectorEngine } from './src/hooks/use-detector-engine';

function App(): React.JSX.Element {
  const engine = useDetectorEngine();
  const cameraConstraints = [
    { resolutionBias: engine.frameOutput },
    { fps: 30 },
  ] satisfies Constraint[];
  const cameraOutputs = [engine.frameOutput];

  if (engine.error != null) {
    return <CenteredMessage message={engine.error} />;
  }

  if (!engine.hasPermission || engine.device == null) {
    return <CenteredMessage message="Preparing object detection…" />;
  }

  return (
    <View style={styles.root}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={engine.device}
        isActive={engine.isForeground}
        orientationSource="interface"
        constraints={cameraConstraints}
        outputs={cameraOutputs}
      />
      {engine.detector == null ? (
        <View style={styles.preparing}>
          <CenteredMessage message="Loading detector…" />
        </View>
      ) : (
        <>
          <View style={styles.vignette} pointerEvents="none" />
          <DetectionLayer engine={engine} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  preparing: {
    ...StyleSheet.absoluteFill,
  },
  vignette: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10,10,11,0.18)',
  },
});

export default App;
