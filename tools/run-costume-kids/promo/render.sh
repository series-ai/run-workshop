#!/usr/bin/env bash
# Render the trailer: frames from headless Chrome, synthesized music + sfx, one mp4.
#   OUT=promo/out/trailer.mp4 promo/render.sh        (run from tools/run-costume-kids)
# PORT picks the server port (default 8798); if something else is already listening
# there, the script stops rather than record the wrong page.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-8798}"
OUT="${OUT:-promo/out/trailer.mp4}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
ours() { local page; page="$(curl -s "http://127.0.0.1:$PORT/promo/index.html" 2>/dev/null || true)"; [[ "$page" == *"Boo Brigade"* ]]; }
rm -rf promo/frames promo/out/events.json
mkdir -p promo/out
if ! ours; then
  if curl -s -o /dev/null "http://127.0.0.1:$PORT/"; then
    echo "port $PORT is serving something else; pick another: PORT=8802 $0" >&2
    exit 1
  fi
  python3 promo/server.py "$PORT" & SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT
  until ours; do sleep 0.3; done
fi
PROFILE="$(mktemp -d)"
"$CHROME" --headless=new --user-data-dir="$PROFILE" --window-size=1080,1920 --hide-scrollbars \
  --use-angle=metal --enable-gpu-rasterization --ignore-gpu-blocklist --mute-audio \
  "http://127.0.0.1:$PORT/promo/?record=1" >/dev/null 2>&1 & CH=$!
until [ -f promo/out/events.json ]; do
  sleep 2
  printf '\r%s frames' "$(ls promo/frames 2>/dev/null | wc -l | tr -d ' ')"
  kill -0 $CH 2>/dev/null || { echo; echo "chrome exited before the recording finished" >&2; exit 1; }
done
echo
kill $CH 2>/dev/null || true
rm -rf "$PROFILE" 2>/dev/null || true
TOTAL="$(python3 -c 'import json;print(json.load(open("promo/out/events.json"))["total"])')"
python3 promo/music.py promo/out/music.wav "$TOTAL" promo/out/events.json
python3 promo/sfx.py promo/out/events.json promo/out/mix.wav promo/out/music.wav 0.7
nice -n 10 ffmpeg -y -loglevel error -framerate 30 -i promo/frames/%05d.jpg -i promo/out/mix.wav \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart -shortest "$OUT"
echo "wrote $OUT"
