"""Fit check: the costume's front and 3/4 views with the blank mannequin's
outline (red) on top. The kid's head must match the outline's head (same
size, same place), or a hood/helmet/hat must enclose it.

    python3 costumes/fitcheck.py <slug> [<ortho, default 6.6>]   -> out/<slug>-fit.png
"""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import sys
from PIL import Image, ImageChops, ImageFilter
slug = sys.argv[1]
o = sys.argv[2] if len(sys.argv) > 2 else None
man = "mannequin" if o in (None, "6.6") else f"mannequin-o{o}"
D = _PKG + "/concepts/costumes/renders"
row = []
for v in ("front", "34"):
    a = Image.open(f"{D}/{man}-{v}.png").split()[3].point(lambda x: 255 if x > 128 else 0)
    edge = ImageChops.subtract(a.filter(ImageFilter.MaxFilter(5)), a)
    im = Image.open(f"{D}/{slug}-{v}.png").convert("RGBA")
    bg = Image.new("RGBA", im.size, (236, 229, 216, 255)); bg.alpha_composite(im)
    bg.paste(Image.new("RGBA", im.size, (230, 20, 60, 255)), (0, 0), edge)
    row.append(bg.convert("RGB"))
m = Image.new("RGB", (sum(r.width for r in row), row[0].height))
x = 0
for r in row:
    m.paste(r, (x, 0)); x += r.width
m.save(f"{D}/{slug}-fit.png")
print(f"{D}/{slug}-fit.png")
