# Face Recognition

A mobile face recognition app that detects, enrolls, and recognizes faces fully
offline on-device.

https://github.com/user-attachments/assets/9dfabd37-8201-476a-88d2-c81d7ecd9c8b

## Requirements

Use a physical device with a front camera. Simulator and emulator runs are not
part of the supported setup.

| Platform | Required device | Minimum version |
| --- | --- | --- |
| iOS | Real iPhone with a front camera | iOS 15.1+ |
| Android | Real `arm64-v8a` device with a front camera | API 24+ |

You also need reasonable lighting and a live person. Passive liveness detection
is enabled for enrollment and recognition.

## Prerequisites

- Node `>= 22.11.0`
- [Bun](https://bun.sh)
- iOS: macOS, Xcode 16.1+, Ruby `>= 2.6.10`, and Bundler
- Android: JDK 17+, Android SDK 36, and NDK `27.1.12297006`

Use Bun for this repo. Do not mix in npm or Yarn.

## Setup

```bash
git clone https://github.com/Idevilson/poc-face.git
cd poc-face
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
3. Point the front camera at a face and confirm an unlabeled face box appears.
4. Tap `ENROLL`, enter a name, tap `START CAPTURE`, and follow the capture
   prompts.
5. Return to the scanner and confirm the enrolled face is labeled.
6. Force-quit and reopen the app, then confirm the identity still matches.

## Checks

```bash
bun run lint
bunx tsc --noEmit
bun run --cwd modules/react-native-face-recognition typecheck
bun run --cwd modules/react-native-face-recognition format:cpp:check
bun run --cwd modules/react-native-face-recognition lint:cpp
```
