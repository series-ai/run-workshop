"""Paw height over a gait cycle (from build.py's *-gait.json): heel, ball and toe tip of the
near leg in world height, with the planted frames shaded. A hop shows as a bump or a step
where the paw should sit flat."""
import json
import sys
from PIL import Image, ImageDraw

files, out = sys.argv[1:-1], sys.argv[-1]
W, H, S = 1400, 360, 1800
panels = []
for fn in files:
    g = json.load(open(fn))
    fr = g["frames"]
    n = len(fr)
    im = Image.new("RGB", (W, H), (248, 248, 250))
    d = ImageDraw.Draw(im)
    gy = H - 40
    cw = (W - 80) / n
    for k, f in enumerate(fr):
        if f["legs"]["L"]["planted"]:
            d.rectangle([40 + k * cw, 20, 40 + (k + 1) * cw, gy], fill=(225, 232, 248))
    d.line([(40, gy), (W - 40, gy)], fill=(120, 120, 130), width=1)
    for j, col, name in ((2, (200, 60, 160), "heel"), (3, (40, 160, 90), "ball"), (4, (20, 20, 20), "toe tip")):
        pts = [(40 + (k + 0.5) * cw, gy - (f["legs"]["L"]["pts"][j][1] + f["bob"]) * S) for k, f in enumerate(fr)]
        d.line(pts, fill=col, width=2)
        for p in pts:
            d.ellipse([p[0] - 3, p[1] - 3, p[0] + 3, p[1] + 3], fill=col)
        d.text((W - 160, 20 + 14 * j), name, fill=col)
    bobs = [(40 + (k + 0.5) * cw, 120 - f["bob"] * S) for k, f in enumerate(fr)]
    d.line(bobs, fill=(240, 140, 40), width=2)
    d.text((10, 4), f"{g['name']}: near-leg heights (blue = planted), orange = body bob", fill=(30, 30, 30))
    panels.append(im)
sheet = Image.new("RGB", (W, H * len(panels)), (255, 255, 255))
for i, p in enumerate(panels):
    sheet.paste(p, (0, i * H))
sheet.save(out)
