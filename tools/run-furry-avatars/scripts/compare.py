"""Side by side: the concept's two views next to the model's renders, same height."""
import sys
from PIL import Image
species, out = sys.argv[1], sys.argv[2]
BG = (238, 238, 240)
con = Image.open(f"concepts/2d/{species}.png").convert("RGB")
w, h = con.size
halves = [con.crop((0, 0, w // 2, h)), con.crop((w // 2, 0, w, h))]


def flat(p):
    im = Image.open(p)
    bg = Image.new("RGB", im.size, BG)
    bg.paste(im, mask=im.split()[3])
    return bg.crop(bg.getbbox() if False else im.getbbox())


def fit(im, H):
    return im.resize((int(im.width * H / im.height), H))


H = 900
row = [fit(halves[0].crop(halves[0].getbbox()), H), fit(flat(f"out/review/{species}-34.png"), H),
       fit(halves[1], H), fit(flat(f"out/review/{species}-side.png"), H),
       fit(flat(f"out/review/{species}-posed.png"), H)]
W = sum(i.width for i in row) + 20 * len(row)
sheet = Image.new("RGB", (W, H + 20), BG)
x = 10
for im in row:
    sheet.paste(im, (x, 10)); x += im.width + 20
sheet.thumbnail((2000, 2000))
sheet.save(out, quality=88)
