#!/usr/bin/env bash
# Render the promo: frames from headless Chrome, a synthesized sound track, one mp4.
#   TITLE="CRITTER CUBES" OUT=promo/out/promo.mp4 promo/render.sh        (run from tools/run-dice-animals)
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-8796}"
TITLE="${TITLE:-CRITTER CUBES}"
OUT="${OUT:-promo/out/promo.mp4}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
rm -rf promo/frames promo/out/events.json
mkdir -p promo/out
if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/promo/"; then
  python3 promo/server.py "$PORT" & SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT
  until curl -s -o /dev/null "http://127.0.0.1:$PORT/promo/"; do sleep 0.3; done
fi
URL="http://127.0.0.1:$PORT/promo/?record=1&title=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$TITLE")"
"$CHROME" --headless=new --user-data-dir="$(mktemp -d)" --window-size=1080,1920 --hide-scrollbars \
  --use-angle=metal --enable-gpu-rasterization --ignore-gpu-blocklist --mute-audio "$URL" >/dev/null 2>&1 & CH=$!
until [ -f promo/out/events.json ]; do sleep 1; printf '\r%s frames' "$(ls promo/frames 2>/dev/null | wc -l | tr -d ' ')"; done
echo
kill $CH 2>/dev/null || true
TOTAL="$(python3 -c 'import json;print(json.load(open("promo/out/events.json"))["total"])')"
python3 promo/music.py promo/out/music.wav "$TOTAL"
python3 promo/sfx.py promo/out/events.json promo/out/sfx.wav promo/out/music.wav 0.4
ffmpeg -y -loglevel error -framerate 30 -i promo/frames/%05d.jpg -i promo/out/sfx.wav \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest "$OUT"
echo "wrote $OUT"
