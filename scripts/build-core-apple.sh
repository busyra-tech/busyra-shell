#!/usr/bin/env bash
# Build djie-core untuk macOS (arm64 + x86_64) → DjieCoreFFI.xcframework + binding Swift.
# Output: apps/macos/Frameworks/DjieCoreFFI.xcframework dan apps/macos/DjieShell/Core/Generated/djie_core.swift
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

ROOT="$PWD"
CORE="$ROOT/core"
OUT="$ROOT/apps/macos/Frameworks"
GEN="$ROOT/apps/macos/DjieShell/Core/Generated"
TMP="$CORE/target/apple"
export MACOSX_DEPLOYMENT_TARGET=14.0

rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null

cd "$CORE"
cargo build --release --lib --target aarch64-apple-darwin
cargo build --release --lib --target x86_64-apple-darwin

rm -rf "$TMP" && mkdir -p "$TMP/headers" "$TMP/lib" "$GEN" "$OUT"

# Binding Swift dibuat dari library (mode proc-macro UniFFI)
cargo run --quiet --release --features bindgen --bin uniffi-bindgen -- \
  generate --library "target/aarch64-apple-darwin/release/libdjie_core.dylib" \
  --language swift --out-dir "$TMP/bindings"

cp "$TMP/bindings/djie_core.swift" "$GEN/"
cp "$TMP/bindings/djie_coreFFI.h" "$TMP/headers/"
cp "$TMP/bindings/djie_coreFFI.modulemap" "$TMP/headers/module.modulemap"

lipo -create \
  target/aarch64-apple-darwin/release/libdjie_core.a \
  target/x86_64-apple-darwin/release/libdjie_core.a \
  -output "$TMP/lib/libdjie_core.a"

rm -rf "$OUT/DjieCoreFFI.xcframework"
xcodebuild -create-xcframework \
  -library "$TMP/lib/libdjie_core.a" -headers "$TMP/headers" \
  -output "$OUT/DjieCoreFFI.xcframework" >/dev/null

echo "✓ DjieCoreFFI.xcframework + djie_core.swift siap"
