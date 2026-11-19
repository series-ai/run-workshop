"""Compose the cells a pack script rendered into labelled board PNGs.

    python3 board.py <out dir> [board-prefix ...]

Writes <out dir>/<slug>.png per board plus a small /tmp preview jpg.
Dark boards get a soft bloom so emissive parts read as glowing."""
import json
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

out = sys.argv[1]
only = sys.argv[2:]
index = json.load(open(os.path.join(out, "index.json")))
F = lambda n: ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", n)  # noqa: E731
CW, PAD, MAXC = 300, 18, 8
LIGHT = dict(bg=(241, 238, 232), ink=(44, 40, 52), sub=(110, 104, 118), card=(250, 248, 244))
DARK = dict(bg=(18, 20, 40), ink=(232, 236, 255), sub=(150, 160, 200), card=(28, 32, 60))


def bloom(rgb, emit_path):
    """Add a soft glow around the emissive pixels (from the emission-only pass)."""
    if not os.path.exists(emit_path):
        return rgb
    em = Image.open(emit_path).convert("RGBA").resize(rgb.size, Image.LANCZOS)
    glow = Image.new("RGB", rgb.size)
    glow.paste(em.convert("RGB"), mask=em.split()[3])
    g1 = glow.filter(ImageFilter.GaussianBlur(5))
    g2 = glow.filter(ImageFilter.GaussianBlur(16))
    return ImageChops.add(ImageChops.add(rgb, g1, scale=1.5), g2, scale=1.1)


def cell(path, pal, dark):
    im = Image.open(os.path.join(out, path)).convert("RGBA")
    im = im.resize((CW, CW), Image.LANCZOS)
    card = Image.new("RGBA", (CW, CW), pal["card"] + (255,))
    card.alpha_composite(im)
    card = card.convert("RGB")
    return bloom(card, os.path.join(out, path[:-4] + "_e.png")) if dark else card


for slug, b in index.items():
    if only and not any(slug.startswith(o) for o in only):
        continue
    pal = DARK if b["dark"] else LIGHT
    ncol = min(MAXC, max(len(r["cells"]) for r in b["rows"]))
    W = PAD + ncol * (CW + PAD)
    lines = []  # (row label or None, cells)
    for r in b["rows"]:
        cs = r["cells"]
        for k in range(0, len(cs), MAXC):
            lines.append((r["label"] if k == 0 else None, cs[k:k + MAXC]))
    head = 96 + (40 if b.get("note") else 0)
    LH = 44 + CW + 40
    sheet = Image.new("RGB", (W, head + len(lines) * LH + PAD), pal["bg"])
    d = ImageDraw.Draw(sheet)
    d.text((PAD, 22), b["title"], fill=pal["ink"], font=F(50))
    if b.get("note"):
        d.text((PAD, 86), b["note"], fill=pal["sub"], font=F(26))
    y = head
    for label, cs in lines:
        if label:
            d.text((PAD, y + 6), label, fill=pal["ink"], font=F(32))
        for i, c in enumerate(cs):
            x = PAD + i * (CW + PAD)
            sheet.paste(cell(c["png"], pal, b["dark"]), (x, y + 44))
            d.text((x + CW // 2, y + 44 + CW + 8), c["label"], fill=pal["sub"], font=F(22), anchor="ma")
        y += LH
    sheet.save(os.path.join(out, f"{slug}.png"))
    pv = sheet.copy()
    pv.thumbnail((1800, 2600))
    pv.save(f"/tmp/tp-{slug}.jpg", quality=86)
    print(f"[board] {slug}.png  {sheet.size[0]}x{sheet.size[1]}")
