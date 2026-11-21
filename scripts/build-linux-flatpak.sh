#!/usr/bin/env bash
# Build Djie Shell sebagai Flatpak (GNOME runtime) dan pasang untuk user saat ini.
#
# Butuh: flatpak, flatpak-builder, dan remote flathub:
#   flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
# Hasil: terpasang sebagai com.djieshell.app + bundle dist/Djie-Shell-Linux.flatpak
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/apps/linux/flatpak/com.djieshell.app.yml"
BUILD="$ROOT/apps/linux/build-flatpak"
REPO="$ROOT/dist/flatpak-repo"

flatpak-builder --user --install-deps-from=flathub --force-clean --install \
  --state-dir="$ROOT/apps/linux/.flatpak-builder" --repo="$REPO" "$BUILD" "$MANIFEST"
mkdir -p "$ROOT/dist"
flatpak build-bundle "$REPO" "$ROOT/dist/Djie-Shell-Linux.flatpak" com.djieshell.app
echo "Selesai. Jalankan: flatpak run com.djieshell.app"
