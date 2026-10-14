#!/usr/bin/env bash
# Render the trailer: frames from headless Chrome, synthesized music + sfx, one mp4.
#   OUT=promo/out/trailer.mp4 promo/render.sh        (run from tools/run-cat-pack)
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-8806}"
OUT="${OUT:-promo/out/trailer.mp4}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
rm -rf promo/frames promo/out/events.json
mkdir -p promo/out
if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/promo/"; then
  python3 promo/server.py "$PORT" & SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT
  until curl -s -o /dev/null "http://127.0.0.1:$PORT/promo/"; do sleep 0.3; done
fi
"$CHROME" --headless=new --user-data-dir="$(mktemp -d)" --window-size=1080,1920 --hide-scrollbars \
  --use-angle=metal --enable-gpu-rasterization --ignore-gpu-blocklist --mute-audio \
  "http://127.0.0.1:$PORT/promo/?record=1" >/dev/null 2>&1 & CH=$!
until [ -f promo/out/events.json ]; do sleep 2; printf '\r%s frames' "$(ls promo/frames 2>/dev/null | wc -l | tr -d ' ')"; done
echo
kill $CH 2>/dev/null || true
TOTAL="$(python3 -c 'import json;print(json.load(open("promo/out/events.json"))["total"])')"
python3 promo/music.py promo/out/music.wav "$TOTAL"
python3 promo/sfx.py promo/out/events.json promo/out/mix.wav promo/out/music.wav 0.55
ffmpeg -y -loglevel error -framerate 30 -i promo/frames/%05d.jpg -i promo/out/mix.wav \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest "$OUT"
echo "wrote $OUT"
