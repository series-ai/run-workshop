#!/usr/bin/env bash
# Check frames without a full render: a contact sheet of moments, or one full-size still.
#   promo/still.sh sheet 1.0,4.2,9.5      -> promo/out/still-sheet.jpg  (six across, quarter size)
#   promo/still.sh at 25.8                -> promo/out/still-at.jpg     (full size)
# Needs promo/server.py running on PORT (default 8798).
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-8798}"
MODE="$1"; ARG="$2"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
F="promo/out/still-$MODE.jpg"
rm -f "$F"
PROFILE="$(mktemp -d)"
"$CHROME" --headless=new --user-data-dir="$PROFILE" --window-size=1080,1920 --hide-scrollbars \
  --use-angle=metal --enable-gpu-rasterization --ignore-gpu-blocklist --mute-audio --enable-logging=stderr --v=0 \
  "http://127.0.0.1:$PORT/promo/?$MODE=$ARG&save=1${EXTRA:-}" >/dev/null 2>promo/out/chrome.log & CH=$!
for _ in $(seq 1 600); do [ -f "$F" ] && break; grep -q "Uncaught" promo/out/chrome.log && break; sleep 0.5; done
sleep 0.2; grep "CONSOLE" promo/out/chrome.log | sed 's/, source.*//' | cut -c1-300 >&2 || true
sleep 0.3
kill $CH 2>/dev/null || true
rm -rf "$PROFILE" 2>/dev/null || true
[ -f "$F" ] && echo "$F" || { echo "no still" >&2; exit 1; }
