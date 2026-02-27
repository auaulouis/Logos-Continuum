#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_ICON="$ROOT_DIR/public/Real Logo.png"
BUILD_DIR="$ROOT_DIR/build"
ICONSET_DIR="$BUILD_DIR/icon.iconset"
OUTPUT_ICON="$BUILD_DIR/icon.icns"

if [ ! -f "$SOURCE_ICON" ]; then
  echo "Missing source icon: $SOURCE_ICON"
  exit 1
fi

mkdir -p "$ICONSET_DIR"

sips --cropToHeightWidth 1024 1024 "$SOURCE_ICON" --out "$BUILD_DIR/icon-square.png" >/dev/null
sips -z 16 16 "$BUILD_DIR/icon-square.png" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
sips -z 32 32 "$BUILD_DIR/icon-square.png" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
sips -z 32 32 "$BUILD_DIR/icon-square.png" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
sips -z 64 64 "$BUILD_DIR/icon-square.png" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
sips -z 128 128 "$BUILD_DIR/icon-square.png" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
sips -z 256 256 "$BUILD_DIR/icon-square.png" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "$BUILD_DIR/icon-square.png" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
sips -z 512 512 "$BUILD_DIR/icon-square.png" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
sips -z 512 512 "$BUILD_DIR/icon-square.png" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null
sips -z 1024 1024 "$BUILD_DIR/icon-square.png" --out "$ICONSET_DIR/icon_512x512@2x.png" >/dev/null
iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_ICON"

echo "Generated $OUTPUT_ICON"
