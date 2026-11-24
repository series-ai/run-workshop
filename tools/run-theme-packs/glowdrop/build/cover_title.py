"""Bloom the cover render and set the Glowdrop Critters logo along the bottom.

    python3 cover_title.py <render dir> <out.png>

No scrim: the glow is the point, so the logo reads through its own outline and halo.
"""
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, "..", "..", "..", "run-costume-kids", "packs", "fonts", "LilitaOne-Regular.ttf")
INK = (16, 18, 58)

src, dst = sys.argv[1], sys.argv[2]
fg = Image.open(os.path.join(src, "rgb.png")).convert("RGBA")
W, H = fg.size

# sky: a moonlit indigo, lighter toward the horizon
sky = Image.new("RGB", fg.size)
sd = ImageDraw.Draw(sky)
for y in range(H):
    k = y / H
    sd.line([(0, y), (W, y)], fill=(int(30 + 46 * k), int(32 + 34 * k), int(92 + 60 * k)))
sky.paste(fg, (0, 0), fg)

# bloom from the emission-only pass, straight onto the glowing parts
em = Image.open(os.path.join(src, "emit.png")).convert("RGB")
# (ImageChops.add's scale divides the whole sum, so dim the glow layers themselves instead)
img = ImageChops.add(sky, em.filter(ImageFilter.GaussianBlur(6)).point(lambda v: int(v * 0.5)))
img = ImageChops.add(img, em.filter(ImageFilter.GaussianBlur(22)).point(lambda v: int(v * 0.55)))


def gradient(size, top, bottom):
    g = Image.new("RGB", size)
    d = ImageDraw.Draw(g)
    for y in range(size[1]):
        k = y / max(1, size[1] - 1)
        d.line([(0, y), (size[0], y)], fill=tuple(int(a + (b - a) * k) for a, b in zip(top, bottom)))
    return g


def droplet(size, top, bottom):
    """A fat teardrop, point up, as a mask (size = (w, h))."""
    w, h = size
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    r = w // 2
    d.ellipse([0, h - 2 * r, w, h], fill=255)
    d.polygon([(w * 0.5, 0), (w * 0.06, h - r * 1.15), (w * 0.94, h - r * 1.15)], fill=255)
    return m


S = 2  # draw the logo at 2x and scale down for clean edges
LW, LH = W * S, 330 * S
logo = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
f_big, f_small = ImageFont.truetype(FONT, 200 * S), ImageFont.truetype(FONT, 66 * S)
stroke = 15 * S

# "Glowdr" + droplet (as the o) + "p", measured so the word stays centred
left, right = "Glowdr", "p"
wl = f_big.getbbox(left)[2]
wr = f_big.getbbox(right)[2]
dw, dh = int(108 * S), int(150 * S)
gap = int(6 * S)
total = wl + gap + dw + gap + wr
x0, ybase = (LW - total) // 2, 30 * S

text_mask = Image.new("L", (LW, LH), 0)
outline = Image.new("L", (LW, LH), 0)
for word, x in ((left, x0), (right, x0 + wl + gap + dw + gap)):
    ImageDraw.Draw(text_mask).text((x, ybase), word, font=f_big, fill=255)
    ImageDraw.Draw(outline).text((x, ybase), word, font=f_big, fill=255, stroke_width=stroke, stroke_fill=255)
o_box = f_big.getbbox("o")
drop_x = x0 + wl + gap
drop_y = ybase + o_box[3] - dh  # sits on the baseline, rises above the x-height
dm = droplet((dw, dh), None, None)
drop_mask = Image.new("L", (LW, LH), 0)
drop_mask.paste(dm, (drop_x, drop_y))
drop_outline = drop_mask.filter(ImageFilter.MaxFilter(2 * (stroke // 2) + 1))

# CRITTERS: amber, letter-spaced, centred under the word
sub = "CRITTERS"
spacing = 10 * S
widths = [f_small.getbbox(ch)[2] for ch in sub]
sw = sum(widths) + spacing * (len(sub) - 1)
sx, sy = (LW - sw) // 2, ybase + 196 * S
sub_mask = Image.new("L", (LW, LH), 0)
sub_out = Image.new("L", (LW, LH), 0)
x = sx
for ch, w in zip(sub, widths):
    ImageDraw.Draw(sub_mask).text((x, sy), ch, font=f_small, fill=255)
    ImageDraw.Draw(sub_out).text((x, sy), ch, font=f_small, fill=255, stroke_width=11 * S, stroke_fill=255)
    x += w + spacing

all_out = ImageChops.lighter(ImageChops.lighter(outline, drop_outline), sub_out)
# halo, then the ink outline, then gradient fills
halo = Image.new("RGBA", (LW, LH), (90, 230, 255, 0))
halo.putalpha(all_out.filter(ImageFilter.GaussianBlur(26 * S)).point(lambda v: int(v * 0.85)))
logo.alpha_composite(halo)
shadow = Image.new("RGBA", (LW, LH), INK + (0,))
shadow.putalpha(ImageChops.offset(all_out, 0, 7 * S))
logo.alpha_composite(shadow)
ink = Image.new("RGBA", (LW, LH), INK + (0,))
ink.putalpha(all_out)
logo.alpha_composite(ink)
word_fill = gradient((LW, LH), (232, 255, 255), (70, 205, 255)).convert("RGBA")
word_fill.putalpha(text_mask)
logo.alpha_composite(word_fill)
drop_fill = gradient((LW, LH), (255, 170, 240), (150, 110, 255)).convert("RGBA")
drop_fill.putalpha(drop_mask)
logo.alpha_composite(drop_fill)
drop_halo = Image.new("RGBA", (LW, LH), (255, 140, 240, 0))  # the droplet glows like the critters
drop_halo.putalpha(drop_mask.filter(ImageFilter.GaussianBlur(18 * S)).point(lambda v: int(v * 0.7)))
logo.alpha_composite(drop_halo)
shine = Image.new("RGBA", (LW, LH), (255, 255, 255, 0))  # a glint on the droplet
ImageDraw.Draw(shine).ellipse([drop_x + dw * 0.22, drop_y + dh * 0.5, drop_x + dw * 0.42, drop_y + dh * 0.72], fill=(255, 255, 255, 200))
logo.alpha_composite(shine)
sub_fill = gradient((LW, LH), (255, 236, 150), (255, 150, 60)).convert("RGBA")
sub_fill.putalpha(sub_mask)
logo.alpha_composite(sub_fill)

logo = logo.resize((W, LH // S), Image.LANCZOS)
out = img.convert("RGBA")
out.alpha_composite(logo, (0, H - logo.height - 18))
out.convert("RGB").save(dst)
print(dst, out.size)
