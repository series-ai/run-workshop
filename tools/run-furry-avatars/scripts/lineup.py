"""Species board: each species' head over its body, labelled, in a grid."""
import json
import sys
from PIL import Image, ImageDraw, ImageFont
out, cols = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 8
sp = list(json.load(open("kit/species.json"))["species"])
F = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 30)
BG = (238, 238, 242)
W, HH, HB = 300, 300, 420
rows = (len(sp) + cols - 1) // cols
sheet = Image.new("RGB", (cols * W, rows * (HH + HB + 40)), BG)
d = ImageDraw.Draw(sheet)
for i, name in enumerate(sp):
    x, y = (i % cols) * W, (i // cols) * (HH + HB + 40)
    for f, top, h in ((f"out/review/species-{name}-head.png", y + 40, HH), (f"out/review/species-{name}-body.png", y + 40 + HH, HB)):
        im = Image.open(f)
        im = im.crop(im.getbbox())
        im.thumbnail((W - 10, h - 10))
        sheet.paste(im, (x + (W - im.width) // 2, top + (h - im.height) // 2), im)
    d.text((x + 10, y + 6), name, fill=(30, 30, 40), font=F)
sheet.save(out)
