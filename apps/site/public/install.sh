#!/bin/sh
# BibleOS installer for macOS and Linux.
#
#   curl -fsSL https://bible.roobi.dev/install.sh | sh
#
# Downloads the latest BibleOS from the project's GitHub releases and installs it:
#   macOS: copies BibleOS.app into /Applications (Apple Silicon and Intel)
#   Linux: puts the AppImage in ~/.local/bin and adds BibleOS to the app menu
# Files fetched with curl aren't flagged by the browser, so macOS doesn't show its
# "could not verify" warning. Updates later arrive inside the app.
set -eu

REPO="roobiwebdev/BibleOS-releases"
API="https://api.github.com/repos/$REPO/releases/latest"

say() { printf '  %s\n' "$1"; }
fail() { printf '  Error: %s\n' "$1" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || fail "curl is required."

# The first download URL in the release JSON that ends with the given suffix.
asset_url() {
  printf '%s' "$RELEASE" | grep -o '"browser_download_url": *"[^"]*'"$1"'"' | head -n 1 | sed 's/.*"\(https[^"]*\)"$/\1/'
}

printf '\n  BibleOS\n'
say "Finding the latest version..."
RELEASE=$(curl -fsSL -H "User-Agent: BibleOS-installer" "$API") || fail "couldn't reach GitHub. Check your internet connection."
VERSION=$(printf '%s' "$RELEASE" | grep -o '"tag_name": *"[^"]*"' | head -n 1 | sed 's/.*"v\{0,1\}\([^"]*\)"$/\1/')
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

case "$(uname -s)" in
  Darwin)
    URL=$(asset_url "_universal.dmg")
    [ -n "$URL" ] || fail "no macOS download in the latest release."
    say "Downloading BibleOS $VERSION..."
    curl -fL --progress-bar "$URL" -o "$TMP/BibleOS.dmg"
    say "Installing into Applications..."
    MOUNT=$(hdiutil attach -nobrowse -readonly -noautoopen "$TMP/BibleOS.dmg" 2>/dev/null | tail -n 1 | awk -F '\t' '{print $NF}')
    [ -d "$MOUNT/BibleOS.app" ] || { hdiutil detach "$MOUNT" -quiet; fail "the download didn't contain BibleOS.app."; }
    DEST="${BIBLEOS_INSTALL_DIR:-/Applications}"
    osascript -e 'quit app "BibleOS"' >/dev/null 2>&1 || true
    rm -rf "$DEST/BibleOS.app"
    ditto "$MOUNT/BibleOS.app" "$DEST/BibleOS.app"
    hdiutil detach "$MOUNT" -quiet || true
    say "Done. Opening BibleOS..."
    [ -n "${BIBLEOS_NO_OPEN:-}" ] || open "$DEST/BibleOS.app"
    ;;
  Linux)
    [ "$(uname -m)" = "x86_64" ] || fail "BibleOS for Linux needs a 64-bit Intel or AMD computer (x86_64)."
    URL=$(asset_url "_amd64.AppImage")
    [ -n "$URL" ] || fail "no Linux download in the latest release."
    say "Downloading BibleOS $VERSION..."
    BIN="$HOME/.local/bin"
    mkdir -p "$BIN" "$HOME/.local/share/applications" "$HOME/.local/share/icons/hicolor/256x256/apps"
    curl -fL --progress-bar "$URL" -o "$TMP/BibleOS.AppImage"
    chmod +x "$TMP/BibleOS.AppImage"
    mv "$TMP/BibleOS.AppImage" "$BIN/BibleOS.AppImage"
    curl -fsSL "https://bible.roobi.dev/apple-touch-icon.png" -o "$HOME/.local/share/icons/hicolor/256x256/apps/bibleos.png" || true
    cat > "$HOME/.local/share/applications/bibleos.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=BibleOS
Comment=Read and study the Bible in Amharic and English
Exec=$BIN/BibleOS.AppImage
Icon=bibleos
Categories=Education;Office;
Terminal=false
EOF
    say "Done. BibleOS is in your app menu."
    if ! ldconfig -p 2>/dev/null | grep -q 'libfuse.so.2'; then
      say "If it doesn't open, install FUSE 2 once (Ubuntu: sudo apt install libfuse2)."
    fi
    [ -n "${BIBLEOS_NO_OPEN:-}" ] || { nohup "$BIN/BibleOS.AppImage" >/dev/null 2>&1 & }
    ;;
  *)
    fail "this installer is for macOS and Linux. On Windows, run: irm https://bible.roobi.dev/install.ps1 | iex"
    ;;
esac
printf '\n'
