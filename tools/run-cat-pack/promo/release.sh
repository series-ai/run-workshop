#!/usr/bin/env bash
# The shareable trailer, after promo/render.sh: a cover (the title over the
# crowd, frame 135 = 4.5 s) as a portrait poster and a square crop, and the
# video re-encoded smaller (H.264 CRF 22, AAC 128k, fast start) with the cover
# embedded as its thumbnail. Writes promo/release/.
#   promo/release.sh        (run from tools/run-cat-pack)
set -euo pipefail
cd "$(dirname "$0")"
FRAME="${FRAME:-00135}"
mkdir -p release
python3 - "$FRAME" <<'PY'
import sys
from PIL import Image
im = Image.open(f'frames/{sys.argv[1]}.jpg').convert('RGB')
im.save('release/facet-fauna-cats-trailer-cover.jpg', quality=90, optimize=True, progressive=True)
y = 880 - 540   # centred on the wordmark
im.crop((0, y, 1080, y + 1080)).save('release/facet-fauna-cats-trailer-cover-square.jpg', quality=90, optimize=True, progressive=True)
PY
ffmpeg -y -loglevel error -i out/trailer.mp4 -i release/facet-fauna-cats-trailer-cover.jpg -map 0:v -map 0:a -map 1 \
  -c:v:0 libx264 -preset slow -crf 22 -profile:v:0 high -pix_fmt:v:0 yuv420p -c:a aac -b:a 128k \
  -c:v:1 mjpeg -disposition:v:1 attached_pic -movflags +faststart \
  -metadata title="Facet Fauna: Cats" release/facet-fauna-cats-trailer.mp4
ls -la release
