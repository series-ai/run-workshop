"""Every species head, 3/4 and side, big enough to judge the snouts."""
import json
import sys
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1]
only = sys.argv[2:]
sp = [s for s in json.load(open("kit/species.json"))["species"] if not only or s in only]
F = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 28)
BG = (238, 238, 242)
C = 300
cols = 4
rows = (len(sp) + cols - 1) // cols
sheet = Image.new("RGB", (cols * C * 2, rows * (C + 36)), BG)
d = ImageDraw.Draw(sheet)
for i, name in enumerate(sp):
    x, y = (i % cols) * C * 2, (i // cols) * (C + 36)
    for j, v in enumerate(("head", "headside")):
        im = Image.open(f"out/review/species-{name}-{v}.png")
        im = im.crop(im.getbbox())
        im.thumbnail((C - 8, C - 8))
        sheet.paste(im, (x + j * C + (C - im.width) // 2, y + 36 + (C - im.height) // 2), im)
    d.text((x + 8, y + 4), name, fill=(30, 30, 40), font=F)
sheet.save(out)
