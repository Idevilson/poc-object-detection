#!/usr/bin/env bash
# Re-fetches the bundled detector model.
#
#   YOLOX-Nano (object detection) -> models/yolox_nano.onnx  (~3.5 MB)
#
# The model is committed, so this is only needed to restore a deleted file or to
# repoint the build at a mirror. Override the URL via the env var below.
#
# YOLOX is Apache-2.0 (https://github.com/Megvii-BaseDetection/YOLOX). The
# bundled export has a fixed 416x416 input and emits a single [1, 3549, 85]
# tensor: 4 box deltas, 1 objectness, and 80 COCO class scores per anchor.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/models"
mkdir -p "$DEST"

YOLOX_NANO_URL="${YOLOX_NANO_URL:-https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_nano.onnx}"

echo "Downloading YOLOX-Nano -> $DEST/yolox_nano.onnx"
curl -fSL "$YOLOX_NANO_URL" -o "$DEST/yolox_nano.onnx"

echo "Done. Model in $DEST."
