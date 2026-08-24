# Object Detection

A mobile app that detects objects in real time, fully offline on-device, drawing
a labeled box around each one.

Point the phone at a scene; every detected object gets a corner-bracket box and
a label with its class and confidence, and the HUD lists what is currently in
view.

## What it detects

The bundled weights are **YOLOX-Nano** (Apache-2.0, 3.5 MB) trained on **COCO**,
so the vocabulary is those 80 classes: person, bicycle, car, motorcycle,
airplane, bus, train, truck, boat, traffic light, fire hydrant, stop sign,
parking meter, bench, bird, cat, dog, horse, sheep, cow, elephant, bear, zebra,
giraffe, backpack, umbrella, handbag, tie, suitcase, frisbee, skis, snowboard,
sports ball, kite, baseball bat, baseball glove, skateboard, surfboard, tennis
racket, bottle, wine glass, cup, fork, knife, spoon, bowl, banana, apple,
sandwich, orange, broccoli, carrot, hot dog, pizza, donut, cake, chair, couch,
potted plant, bed, dining table, toilet, tv, laptop, mouse, remote, keyboard,
cell phone, microwave, oven, toaster, sink, refrigerator, book, clock, vase,
scissors, teddy bear, hair drier, toothbrush.

Anything outside that list will not be detected. To cover a different domain,
either fine-tune a single-class or custom-class detector, or swap in weights
trained on a larger vocabulary such as Open Images V7 (~600 classes).

## How it works

One inference stage per frame, in C++ through ONNX Runtime:

| Stage | Detail |
| --- | --- |
| Preprocess | YUV frame -> letterboxed 416x416 BGR NCHW, raw `[0,255]`, margins padded with `114` to match YOLOX training |
| Inference | YOLOX-Nano, single `[1, 3549, 85]` output; CoreML on iOS, NNAPI/QNN/XNNPACK on Android |
| Decode | Grid-relative centers, log-space sizes, `objectness * classScore`, then class-wise NMS |

Boxes are mapped into upright display space natively, then assigned to a fixed
pool of animated overlay slots. A slot only keeps its identity within one class,
so a box and its label stay pinned to the same physical object instead of
swapping labels when the detector reorders results.

There is no tracking and no cross-frame reuse: the detector runs on every
processed frame, so the boxes always describe the frame they came from.

## Requirements

Use a physical device with a rear camera. Simulator and emulator runs are not
part of the supported setup.

| Platform | Required device | Minimum version |
| --- | --- | --- |
| iOS | Real iPhone with a rear camera | iOS 15.1+ |
| Android | Real `arm64-v8a` device with a rear camera | API 24+ |

## Prerequisites

- Node `>= 22.11.0`
- [Bun](https://bun.sh)
- iOS: macOS, Xcode 16.1+, Ruby `>= 2.6.10`, and Bundler
- Android: JDK 17+, Android SDK 36, and NDK `27.1.12297006`

Use Bun for this repo. Do not mix in npm or Yarn.

## Setup

```bash
bun install --frozen-lockfile
```

For iOS, install pods:

```bash
bun run pod
```

Before the first iOS device build, open the workspace:

```bash
open ios/FaceRecognition.xcworkspace
```

Select the `FaceRecognition` target, then choose your Apple development team
under **Signing & Capabilities**. If Xcode reports that the bundle identifier is
unavailable, change it to a unique value.

The detector weights and the Android ONNX Runtime library are both committed, so
there is nothing to download:

- `modules/react-native-face-recognition/models/yolox_nano.onnx` (3.5 MB)
- `modules/react-native-face-recognition/third_party/onnxruntime/android/arm64-v8a/libonnxruntime.so`

If the weights go missing, restore them with
`bash modules/react-native-face-recognition/scripts/fetch-models.sh`; the ONNX
Runtime library has a matching `fetch-onnxruntime-android.sh` next to it.

## Run

Start Metro in one terminal:

```bash
bun start
```

In another terminal, build and launch on a connected physical device.

iOS:

```bash
bun run ios --device
```

Android:

```bash
bun run android
```

On first launch, allow camera permission. If permission is denied, re-enable it
in system settings and relaunch the app.

## Smoke test

1. Launch the app.
2. Confirm the camera preview appears.
3. Point the rear camera at an everyday object from the COCO list — a cup, a
   chair, a laptop, a person — and confirm a labeled box appears.
4. Confirm the label reads the class and a confidence percentage, and that the
   HUD lists the same objects.
5. Move the phone and confirm boxes track without the labels swapping between
   objects.
6. Aim at a blank wall and confirm the boxes clear.

## Tuning

Detector options live in `src/hooks/use-detector-engine.ts`:

- `threshold` — raise it to cut false positives on textured backgrounds, lower
  it to surface more small objects. `0.3` is the starting point.
- `maxObjects` — also the overlay slot count, since every slot is a mounted
  animated component.
- `minObjectSize` — drops boxes smaller than this many source-frame pixels.
- `inputSize` — must stay `416`; the bundled export has a fixed input shape.

## Checks

```bash
bun run lint
bunx tsc --noEmit
bun run --cwd modules/react-native-face-recognition typecheck
bun run --cwd modules/react-native-face-recognition format:cpp:check
bun run --cwd modules/react-native-face-recognition lint:cpp
```

## Known naming debt

The native module directory, the pod, the Android library, and the C++ namespace
are still named after the face-recognition project this was forked from
(`react-native-face-recognition`, `FaceRecognizer`, `facerecognizer`). The
public API is object-oriented (`ObjectDetection.create`, `detectObjects`,
`DetectedObject`, `useObjectDetector`); only the build artifact names lag. They
are a mechanical rename plus a `nitrogen` run and a `pod install`.
