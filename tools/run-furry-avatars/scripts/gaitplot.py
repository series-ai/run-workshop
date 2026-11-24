"""Onion-skin plots of a baked gait (from build.py --render, the *-gait.json files).

Left: the near leg over one cycle, in place: blue while planted, orange through the swing
(lighter = later), with the paths of the heel, ball and toe tip. Right: the same frames
spread out at walking speed, so a planted paw should stay put on the ground (any slide
shows as a smear), with the far leg in grey."""
import json
import sys
from PIL import Image, ImageDraw

files, out = sys.argv[1:-1], sys.argv[-1]
S = 620   # pixels per metre
panels = []
for fn in files:
    g = json.load(open(fn))
    fr = g["frames"]
    n = len(fr)
    # walking speed from the planted paw's slide: it should move back exactly as fast as the body goes forward
    st = g["stance"]
    i0, i1 = 0, max(1, int(st * n) - 1)
    speed = abs(fr[i0]["legs"]["L"]["pts"][3][0] - fr[i1]["legs"]["L"]["pts"][3][0]) / ((i1 - i0) / n)
    W, H = 2000, 760
    im = Image.new("RGB", (W, H), (246, 246, 248))
    d = ImageDraw.Draw(im)
    gy = H - 60
    d.line([(0, gy), (W, gy)], fill=(120, 120, 130), width=2)
    d.text((10, 10), f"{g['name']}  stance {st:.2f}  frames {n}  speed {speed:.2f} m/cycle", fill=(30, 30, 30))

    def P(pt, bob, ox, dy=0.0):
        return (ox + (-(pt[0] + dy)) * S, gy - (pt[1] + bob) * S)

    trails = {2: [], 3: [], 4: []}
    for k, f in enumerate(fr):
        L = f["legs"]["L"]
        col = (60, 110, 230) if L["planted"] else (240, int(120 + 100 * k / n), 40)
        pts = [P(p, f["bob"], 300) for p in L["pts"]]
        if k % 2 == 0:
            d.line(pts, fill=col, width=2)
        for j in trails:
            trails[j].append(pts[j])
    for j, c in ((2, (200, 60, 160)), (3, (40, 160, 90)), (4, (20, 20, 20))):
        d.line(trails[j] + [trails[j][0]], fill=c, width=1)
    # spread out: the body moves forward at `speed`; planted paws should stay fixed
    for k in range(0, n, max(1, n // 12)):
        f = fr[k]
        ox = 640 + (k / n) * speed * S
        for s, col in (("R", (170, 170, 178)), ("L", (60, 110, 230) if f["legs"]["L"]["planted"] else (240, 140, 40))):
            pts = [P(p, f["bob"], ox) for p in f["legs"][s]["pts"]]
            d.line(pts, fill=col, width=3 if s == "L" else 2)
        hip = P(f["legs"]["L"]["pts"][0], f["bob"], ox)
        d.ellipse([hip[0] - 4, hip[1] - 4, hip[0] + 4, hip[1] + 4], fill=(30, 30, 30))
    panels.append(im)
sheet = Image.new("RGB", (panels[0].width, sum(p.height for p in panels)), (255, 255, 255))
y = 0
for p in panels:
    sheet.paste(p, (0, y)); y += p.height
sheet.save(out)
