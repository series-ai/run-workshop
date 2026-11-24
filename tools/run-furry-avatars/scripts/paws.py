"""Hands and feet next to the concept's: concept hand, model hand, concept feet, model feet, model foot side."""
import sys
from PIL import Image
species, variant, out = sys.argv[1], sys.argv[2], sys.argv[3]
BG = (238, 238, 240)
con = Image.open(f"concepts/2d/{species}.png").convert("RGB")
w, h = con.size
H = 460


def flat(p):
    im = Image.open(p)
    bg = Image.new("RGB", im.size, BG)
    bg.paste(im, mask=im.split()[3])
    return bg.crop(im.getbbox())


cells = [con.crop((w // 2 + 300, 780, w // 2 + 700, 1080)), flat(f"out/review/{species}-{variant}-hand.png"),
         con.crop((640, 1150, 1100, 1536)), flat(f"out/review/{species}-{variant}-foot.png"),
         con.crop((w // 2 + 300, 1150, w // 2 + 760, 1536)), flat(f"out/review/{species}-{variant}-footside.png")]
cells = [c.resize((int(c.width * H / c.height), H)) for c in cells]
sheet = Image.new("RGB", (sum(c.width for c in cells) + 15 * len(cells), H + 20), BG)
x = 8
for c in cells:
    sheet.paste(c, (x, 10)); x += c.width + 15
sheet.save(out)
