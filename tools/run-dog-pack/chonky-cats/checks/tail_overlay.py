"""Draw each body's tails.json trace (centreline + radius, and 2x radius where the tail set may
grow) over its side render from checks/tail_side.py, to check a trace before rigging.

python3 checks/tail_overlay.py <side.png> <body> <out.png>
"""
import json
import os
import sys

from PIL import Image, ImageDraw

png, body, out = sys.argv[1:4]
t = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tails.json')))[body]
im = Image.open(png).convert('RGB')
d = ImageDraw.Draw(im)
to_px = lambda y, z: (350 + (y - 0.1) / 0.002, 350 - (z - 0.55) / 0.002)  # noqa: E731
pts = [to_px(*p) for p in t['path']]
d.line(pts, fill=(255, 220, 0), width=2)
for (x, y), r in zip(pts, t['r']):
    for k, c in ((1, (0, 220, 0)), (2, (0, 120, 255))):
        R = k * r / 0.002
        d.ellipse([x - R, y - R, x + R, y + R], outline=c, width=1)
im.save(out)
