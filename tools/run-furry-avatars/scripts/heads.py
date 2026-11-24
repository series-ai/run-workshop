"""Concept head vs model head, side and 3/4, at the same head height."""
import sys
from PIL import Image
species, variant, out = sys.argv[1], sys.argv[2], sys.argv[3]
BG = (238, 238, 240)
con = Image.open(f"concepts/2d/{species}.png").convert("RGB")
w, h = con.size


def model(view):
    a = Image.open(f"out/review/{species}-{variant}-{view}.png")
    bg = Image.new("RGB", a.size, BG)
    bg.paste(a, mask=a.split()[3])
    return bg


H = 520
cells = [con.crop((w // 2 + 230, 0, w // 2 + 820, 560)), model("headside"), con.crop((480, 0, 1120, 600)), model("head34")]
cells = [c.resize((int(c.width * H / c.height), H)) for c in cells]
sheet = Image.new("RGB", (sum(c.width for c in cells) + 15 * len(cells), H + 20), BG)
x = 8
for c in cells:
    sheet.paste(c, (x, 10)); x += c.width + 15
sheet.save(out)
