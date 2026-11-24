#!/usr/bin/env bash
# The shareable trailer, after promo/render.sh: a cover (the end card, the title
# over the crowd facing camera, frame 1345 = 44.8 s) as a portrait poster and a
# square crop, and the video re-encoded smaller (H.264 CRF 22, AAC 128k, fast
# start) with the cover embedded as its thumbnail. Writes promo/release/.
#   promo/release.sh        (run from tools/run-costume-kids)
set -euo pipefail
cd "$(dirname "$0")"
FRAME="${FRAME:-01345}"
mkdir -p release
python3 - "$FRAME" <<'PY'
import sys
from PIL import Image
im = Image.open(f'frames/{sys.argv[1]}.jpg').convert('RGB')
im.save('release/boo-brigade-trailer-cover.jpg', quality=90, optimize=True, progressive=True)
y = 0     # the wordmark and the crowd behind it
im.crop((0, y, 1080, y + 1080)).save('release/boo-brigade-trailer-cover-square.jpg', quality=90, optimize=True, progressive=True)
PY
nice -n 15 ffmpeg -y -loglevel error -threads 2 -i out/trailer.mp4 -i release/boo-brigade-trailer-cover.jpg -map 0:v -map 0:a -map 1 \
  -c:v:0 libx264 -preset slow -crf 22 -profile:v:0 high -pix_fmt:v:0 yuv420p -c:a aac -b:a 128k \
  -c:v:1 mjpeg -disposition:v:1 attached_pic -movflags +faststart \
  -metadata title="Boo Brigade" release/boo-brigade-trailer.mp4
ls -la release
