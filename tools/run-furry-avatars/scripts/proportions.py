"""Concept vs model at the same height, with guide lines every 5% of height,
for the side and 3/4 views. Silhouettes are cut from the concept's grey
background by colour distance."""
import sys
from PIL import Image, ImageDraw, ImageChops
species, variant, out = sys.argv[1], sys.argv[2], sys.argv[3]
BG = (238, 238, 240)
con = Image.open(f"concepts/2d/{species}.png").convert("RGB")
w, h = con.size


def concept_view(box):
    im = con.crop(box)
    bg = Image.new("RGB", im.size, im.getpixel((5, 5)))
    diff = ImageChops.difference(im, bg).convert("L").point(lambda v: 255 if v > 18 else 0)
    return im.crop(diff.getbbox())


def model_view(p):
    im = Image.open(p)
    flat = Image.new("RGB", im.size, BG)
    flat.paste(im, mask=im.split()[3])
    return flat.crop(im.getbbox())


H = 1000
pairs = [(concept_view((0, 0, w // 2, h)), model_view(f"out/review/{species}-{variant}-34.png")),
         (concept_view((w // 2, 0, w, h)), model_view(f"out/review/{species}-{variant}-side.png"))]
cells = []
for a, b in pairs:
    for im in (a, b):
        cells.append(im.resize((int(im.width * H / im.height), H)))
W = sum(c.width for c in cells) + 40 * len(cells)
sheet = Image.new("RGB", (W, H + 40), BG)
x = 20
for c in cells:
    sheet.paste(c, (x, 20)); x += c.width + 40
d = ImageDraw.Draw(sheet)
for i in range(21):
    y = 20 + int(H * i / 20)
    d.line([(0, y), (W, y)], fill=(255, 80, 80) if i % 2 == 0 else (255, 180, 180), width=1)
    d.text((2, y + 2), f"{100 - i * 5}", fill=(200, 40, 40))
sheet.save(out)
