"""Set the Furries Unleashed logo along the bottom of the cover render, then write the pack images.

    python3 scripts/cover_title.py out/cover-render.png out/

Per the pack-cover direction: the crowd fills the frame fully lit, no scrim; the logo reads through its own
outline, drop shadow and halo. Lilita One, gradient fills, a heavy navy outline, a paw print as the dot on
the i, and a letter-spaced subtitle in a contrasting colour. Writes cover.png (2048), cover.webp (1024) and
preview.webp (512).
"""
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, "..", "..", "run-costume-kids", "packs", "fonts", "LilitaOne-Regular.ttf")
INK = (22, 24, 64)

src, outdir = sys.argv[1], sys.argv[2]
img = Image.open(src).convert("RGBA")
W, H = img.size


def gradient(size, top, bottom):
    g = Image.new("RGB", size)
    d = ImageDraw.Draw(g)
    for y in range(size[1]):
        k = y / max(1, size[1] - 1)
        d.line([(0, y), (size[0], y)], fill=tuple(int(a + (b - a) * k) for a, b in zip(top, bottom)))
    return g


def paw(size):
    """A paw print mask: a big pad and four toe beans (size = (w, h))."""
    w, h = size
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    # (everything inset from the edges, so the toe beans and the outline around them aren't clipped)
    k, o = 0.8, 0.1
    d.ellipse([w * (o + k * 0.18), h * (o + k * 0.42), w * (o + k * 0.82), h * (o + k * 0.98)], fill=255)
    for cx, cy, r in ((0.12, 0.42, 0.13), (0.34, 0.18, 0.14), (0.66, 0.18, 0.14), (0.88, 0.42, 0.13)):
        d.ellipse([w * (o + k * (cx - r)), h * (o + k * (cy - r * 1.15)), w * (o + k * (cx + r)), h * (o + k * (cy + r * 1.15))], fill=255)
    return m


S = 2
LW, LH = W * S, 640 * S
f_big, f_small = ImageFont.truetype(FONT, 300 * S), ImageFont.truetype(FONT, 104 * S)
stroke = 22 * S

# "Furr" + dotless i (an "ı" stem drawn as a rounded bar) + "es"; the paw print sits where the dot goes
left, right = "Furr", "es"
wl, wr = f_big.getbbox(left)[2], f_big.getbbox(right)[2]
i_box = f_big.getbbox("i")
iw = i_box[2] - i_box[0]
gap = int(8 * S)
total = wl + gap + iw + gap + wr
x0 = (LW - total) // 2
r_box = f_big.getbbox("r")
pw = int(iw * 2.3)   # the paw print (drawn inset in its box)
ybase = max(70 * S, pw + 6 * S - r_box[1] + stroke * 2)   # leave room above the word for the paw and its outline + halo

text_mask = Image.new("L", (LW, LH), 0)
outline = Image.new("L", (LW, LH), 0)
for word, x in ((left, x0), (right, x0 + wl + gap + iw + gap)):
    ImageDraw.Draw(text_mask).text((x, ybase), word, font=f_big, fill=255)
    ImageDraw.Draw(outline).text((x, ybase), word, font=f_big, fill=255, stroke_width=stroke, stroke_fill=255)
# the i's stem: from x-height to the baseline (measured off "r" so it matches the lowercase letters)
ix = x0 + wl + gap
stem = Image.new("L", (LW, LH), 0)
ImageDraw.Draw(stem).rounded_rectangle([ix + iw * 0.12, ybase + r_box[1], ix + iw * 0.88, ybase + r_box[3]], radius=int(iw * 0.22), fill=255)
text_mask = ImageChops.lighter(text_mask, stem)
outline = ImageChops.lighter(outline, stem.filter(ImageFilter.MaxFilter(2 * (stroke // 2) + 1)))
# the paw print dot, bigger than a dot, tilted a touch
pm = paw((pw, pw)).rotate(-12, resample=Image.BICUBIC, expand=False)
paw_mask = Image.new("L", (LW, LH), 0)
paw_x, paw_y = int(ix + iw / 2 - pw / 2), int(ybase + r_box[1] - pw + 4 * S)
paw_mask.paste(pm, (paw_x, paw_y))
paw_out = paw_mask.filter(ImageFilter.MaxFilter(2 * (stroke // 2) + 1))

# UNLEASHED: letter-spaced, centred under the word
sub = "UNLEASHED"
spacing = 16 * S
widths = [f_small.getbbox(ch)[2] for ch in sub]
sw = sum(widths) + spacing * (len(sub) - 1)
sx, sy = (LW - sw) // 2, ybase + 298 * S
sub_mask = Image.new("L", (LW, LH), 0)
sub_out = Image.new("L", (LW, LH), 0)
x = sx
for ch, w in zip(sub, widths):
    ImageDraw.Draw(sub_mask).text((x, sy), ch, font=f_small, fill=255)
    ImageDraw.Draw(sub_out).text((x, sy), ch, font=f_small, fill=255, stroke_width=16 * S, stroke_fill=255)
    x += w + spacing

logo = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
all_out = ImageChops.lighter(ImageChops.lighter(outline, paw_out), sub_out)
halo = Image.new("RGBA", (LW, LH), (255, 250, 240, 0))
halo.putalpha(all_out.filter(ImageFilter.GaussianBlur(30 * S)).point(lambda v: int(v * 0.9)))
logo.alpha_composite(halo)
shadow = Image.new("RGBA", (LW, LH), INK + (0,))
shadow.putalpha(ImageChops.offset(all_out, 0, 10 * S))
logo.alpha_composite(shadow)
ink = Image.new("RGBA", (LW, LH), INK + (0,))
ink.putalpha(all_out)
logo.alpha_composite(ink)
word_fill = gradient((LW, LH), (255, 214, 92), (255, 110, 64)).convert("RGBA")   # sunny orange, like a fox
word_fill.putalpha(text_mask)
logo.alpha_composite(word_fill)
paw_fill = gradient((LW, LH), (255, 160, 200), (225, 80, 150)).convert("RGBA")    # pink toe-bean paw
paw_fill.putalpha(paw_mask)
logo.alpha_composite(paw_fill)
gloss = Image.new("RGBA", (LW, LH), (255, 255, 255, 0))                           # a soft shine across the top of the word
gm = Image.new("L", (LW, LH), 0)
ImageDraw.Draw(gm).rectangle([0, 0, LW, ybase + r_box[1] + (r_box[3] - r_box[1]) * 0.35], fill=90)
gloss.putalpha(ImageChops.multiply(gm, ImageChops.lighter(text_mask, paw_mask)))
logo.alpha_composite(gloss)
sub_fill = gradient((LW, LH), (140, 240, 230), (40, 170, 190)).convert("RGBA")   # teal, contrasting
sub_fill.putalpha(sub_mask)
logo.alpha_composite(sub_fill)

bbox = logo.getbbox()
logo = logo.crop((0, 0, LW, bbox[3] + 4 * S)).resize((W, (bbox[3] + 4 * S) // S), Image.LANCZOS)
img.alpha_composite(logo, (0, H - logo.height - 28))
out = img.convert("RGB")
os.makedirs(outdir, exist_ok=True)
out.save(os.path.join(outdir, "cover.png"))
out.resize((1024, 1024), Image.LANCZOS).save(os.path.join(outdir, "cover.webp"), quality=90)
out.resize((512, 512), Image.LANCZOS).save(os.path.join(outdir, "preview.webp"), quality=90)
print("wrote", outdir, out.size)
