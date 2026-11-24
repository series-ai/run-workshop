"""Stitch the gallery shots (pack/gallery.mjs) into Previews/*.webp: square-ish sheets on the editor's
background, names in Lilita One, each under 1 MiB."""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

out = sys.argv[1]
FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "run-costume-kids", "packs", "fonts", "LilitaOne-Regular.ttf")
BG = (236, 235, 240)
man = json.load(open(os.path.join(out, "_manifest.json")))
for name, sh in man.items():
    cols, (cw, ch), shots = sh["cols"], sh["cell"], sh["shots"]
    rows = (len(shots) + cols - 1) // cols
    sheet = Image.new("RGB", (cw * cols, ch * rows), BG)
    d = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(FONT, 30)
    for i, s in enumerate(shots):
        im = Image.open(s["file"]).convert("RGB")
        w, h = im.size
        # crop to the cell's aspect around the middle (the character is centred in the editor view)
        ar = cw / ch
        cwid = min(w, int(h * ar))
        chgt = int(cwid / ar)
        x0, y0 = (w - cwid) // 2, max(0, (h - chgt) // 2 - int(h * 0.02))
        im = im.crop((x0, y0, x0 + cwid, y0 + chgt)).resize((cw, ch), Image.LANCZOS)
        cx, cy = (i % cols) * cw, (i // cols) * ch
        sheet.paste(im, (cx, cy))
        if s["label"]:
            tw = d.textlength(s["label"], font=font)
            d.text((cx + (cw - tw) / 2, cy + ch - 46), s["label"], font=font, fill=(40, 42, 70))
        os.remove(s["file"])
    sheet.thumbnail((1600, 1600), Image.LANCZOS)
    path = os.path.join(out, f"{name}.webp")
    q = 88
    while True:
        sheet.save(path, quality=q, method=6)
        if os.path.getsize(path) < 900 * 1024 or q < 50:
            break
        q -= 8
    print(name, sheet.size, os.path.getsize(path) // 1024, "KB")
os.remove(os.path.join(out, "_manifest.json"))
