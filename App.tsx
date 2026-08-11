import type React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { KeyboardController } from 'react-native-keyboard-controller';
import { Camera, type Constraint } from 'react-native-vision-camera';
import { CenteredMessage } from './src/components/centered-message';
import { FaceRecognitionLayer } from './src/components/face-recognition-layer';
import { C } from './src/constants/theme';
import { useFaceEngine } from './src/hooks/use-face-engine';

function dismissKeyboard(): void {
  KeyboardController.dismiss();
}

function App(): React.JSX.Element {
  const engine = useFaceEngine();
  const cameraConstraints = [
    { resolutionBias: engine.frameOutput },
    { fps: 30 },
  ] satisfies Constraint[];
  const cameraOutputs = [engine.frameOutput];

  if (engine.error != null) {
    return <CenteredMessage message={engine.error} />;
  }

  if (!engine.hasPermission || engine.device == null) {
    return <CenteredMessage message="Preparing face recognition…" />;
  }

  return (
    <View style={styles.root}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={engine.device}
        isActive={engine.isForeground}
        mirrorMode={engine.device.position === 'front' ? 'on' : 'off'}
        orientationSource="interface"
        constraints={cameraConstraints}
        outputs={cameraOutputs}
      />
      {engine.recognizer == null ? (
        <View style={styles.preparing}>
          <CenteredMessage message="Preparing face recognition…" />
        </View>
      ) : (
        <>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismissKeyboard}
          />
          <View style={styles.vignette} pointerEvents="none" />
          <FaceRecognitionLayer engine={engine} />
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
