"""Variant board: the concept, then each variant in 3/4 and side, dressed and bare."""
import sys
from PIL import Image, ImageDraw, ImageFont
species, out, variants = sys.argv[1], sys.argv[2], sys.argv[3:]
BG = (238, 238, 240)
F = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 34)


def flat(p):
    im = Image.open(p)
    bg = Image.new("RGB", im.size, BG)
    bg.paste(im, mask=im.split()[3])
    return bg


H = 640
con = Image.open(f"concepts/2d/{species}.png").convert("RGB")
w, h = con.size
cells = [("concept", con.crop((0, 0, w // 2, h)).crop((250, 0, w // 2 - 250, h)))]
for v in variants:
    for k in ("34", "side", "bare34"):
        im = Image.open(f"out/review/{species}-{v}-{k}.png")
        cells.append((f"{v} {k.replace('bare34', 'bare')}", flat(f"out/review/{species}-{v}-{k}.png").crop(im.getbbox())))
W = sum(int(im.width * H / im.height) for _, im in cells) + 12 * len(cells)
sheet = Image.new("RGB", (W, H + 60), BG)
d = ImageDraw.Draw(sheet)
x = 6
for label, im in cells:
    im = im.resize((int(im.width * H / im.height), H))
    sheet.paste(im, (x, 54))
    d.text((x + 8, 10), label, fill=(40, 40, 50), font=F)
    x += im.width + 12
sheet.save(out)
