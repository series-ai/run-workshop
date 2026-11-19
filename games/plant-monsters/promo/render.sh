#!/usr/bin/env bash
# Render the Terra Tots trailer: frames from headless Chrome (the page on the Vite dev server), the score and sound
# effects synthesized from the page's cues, one mp4.
#   promo/render.sh            (run from games/plant-monsters, with `npx vite --port 5321` running)
set -euo pipefail
cd "$(dirname "$0")/.."
VITE="${VITE:-http://localhost:5321}"
PORT="${PORT:-8797}"
OUT="${OUT:-promo/out/terra-tots-trailer.mp4}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
rm -rf promo/frames promo/out/events.json
mkdir -p promo/out
python3 promo/server.py "$PORT" & SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 0.5
"$CHROME" --headless=new --user-data-dir="$(mktemp -d)" --window-size=1080,1920 --hide-scrollbars \
  --use-angle=metal --enable-gpu-rasterization --ignore-gpu-blocklist --mute-audio \
  "$VITE/promo/index.html?record=1&save=http://127.0.0.1:$PORT" >/dev/null 2>&1 & CH=$!
until [ -f promo/out/events.json ]; do sleep 2; printf '\r%s frames' "$(ls promo/frames 2>/dev/null | wc -l | tr -d ' ')"; done
echo
kill $CH 2>/dev/null || true
python3 promo/music.py promo/out/events.json promo/out/music.wav
python3 promo/sfx.py promo/out/events.json promo/out/mix.wav promo/out/music.wav 0.55
nice -n 19 ffmpeg -y -loglevel error -threads 1 -framerate 30 -i promo/frames/%05d.jpg -i promo/out/mix.wav \
  -af loudnorm=I=-15:TP=-1.5:LRA=11 -ar 48000 -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest "$OUT"
echo "wrote $OUT"
