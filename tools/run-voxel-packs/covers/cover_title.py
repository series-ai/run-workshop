"""Paint the sky behind a cover render and set the pack logo along the bottom.

    python3 covers/cover_title.py <render.png> <theme> <subtitle> <out.png>
    python3 covers/cover_title.py --flat <bg.png> <theme> <subtitle> <out.png>   (a 2D background, no sky)

No scrim: the logo reads through its own outline, drop shadow and halo (see the
pack-cover direction). The logo is pixel lettering to match the voxel models: the pack
word in Pixelify Sans Bold with a stepped gradient fill and a square-cornered ink
outline, a voxel cube at each end of a letter-spaced Silkscreen subtitle.
"""
from __future__ import annotations

import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
# SIL Open Font License: see fonts/PixelifySans-OFL.txt and fonts/Silkscreen-OFL.txt
WORD_FONT = os.path.join(HERE, "fonts", "PixelifySans.ttf")
SMALL_FONT = os.path.join(HERE, "fonts", "Silkscreen-Bold.ttf")


def font(path: str, size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(path, size)
    if bold and path == WORD_FONT:
        f.set_variation_by_name("Bold")  # a variable font
    return f


def stepped(size, top, bottom, steps: int = 5):
    """A top-to-bottom gradient in a few flat bands, like a pixel-art ramp."""
    g = Image.new("RGB", size)
    d = ImageDraw.Draw(g)
    for i in range(steps):
        k = i / (steps - 1)
        c = tuple(int(a + (b - a) * k) for a, b in zip(top, bottom))
        d.rectangle([0, round(size[1] * i / steps), size[0], round(size[1] * (i + 1) / steps)], fill=c)
    return g


def grow(mask: Image.Image, r: int) -> Image.Image:
    """Grow a mask by r pixels with square corners (a blocky outline, not a round stroke)."""
    return mask.filter(ImageFilter.MaxFilter(2 * r + 1))

THEMES = {
    "fantasy": dict(word="Fantasy", ink=(40, 22, 70), sky=((92, 168, 255), (214, 238, 255)), 
                    fill=((255, 246, 170), (255, 170, 40)), sub=((150, 255, 210), (40, 200, 160)), halo=(255, 230, 140),
                    cube=((255, 214, 90), (230, 150, 30), (180, 100, 20))),
    "space": dict(word="Space", ink=(16, 18, 58), sky=((22, 26, 80), (110, 80, 190)),
                  fill=((215, 255, 255), (70, 190, 255)), sub=((255, 220, 120), (255, 140, 60)), halo=(120, 220, 255),
                  cube=((140, 230, 255), (70, 160, 240), (40, 100, 200))),
    "monster": dict(word="Monster", ink=(30, 14, 46), sky=((60, 40, 120), (220, 120, 140)),
                    fill=((215, 255, 120), (90, 210, 60)), sub=((255, 205, 110), (255, 120, 40)), halo=(200, 255, 140),
                    cube=((190, 140, 255), (140, 90, 220), (90, 50, 160))),
    "apocalypse": dict(word="Apocalypse", ink=(44, 22, 10), sky=((150, 120, 90), (255, 200, 130)),
                       fill=((255, 230, 120), (240, 110, 30)), sub=((255, 240, 90), (240, 190, 20)), halo=(255, 200, 110),
                       cube=((240, 200, 60), (200, 150, 30), (150, 100, 20))),
}


def gradient(size, top, bottom):
    g = Image.new("RGB", size)
    d = ImageDraw.Draw(g)
    for y in range(size[1]):
        k = y / max(1, size[1] - 1)
        d.line([(0, y), (size[0], y)], fill=tuple(int(a + (b - a) * k) for a, b in zip(top, bottom)))
    return g


def cube_layers(s: int, faces):
    """An isometric voxel cube of width s: (mask, colour image), three shaded faces."""
    h = int(s * 1.12)
    m = Image.new("L", (s, h), 0)
    col = Image.new("RGB", (s, h))
    d, dc = ImageDraw.Draw(m), ImageDraw.Draw(col)
    q = s / 4
    top = [(s / 2, 0), (s, q), (s / 2, 2 * q), (0, q)]
    left = [(0, q), (s / 2, 2 * q), (s / 2, h), (0, h - q)]
    right = [(s, q), (s / 2, 2 * q), (s / 2, h), (s, h - q)]
    for poly, c in zip((top, left, right), faces):
        d.polygon(poly, fill=255)
        dc.polygon(poly, fill=c)
    return m, col


def logo(W: int, theme: dict, subtitle: str) -> Image.Image:
    word = theme["word"]
    LW, LH = W, 290
    # the word as large as fits 88% of the width, rendered at a pixel-font-friendly size
    size = 190
    while font(WORD_FONT, size).getbbox(word)[2] > LW * 0.88 and size > 60:
        size -= 6
    f_big, f_small = font(WORD_FONT, size), font(SMALL_FONT, 54)
    bb = f_big.getbbox(word)
    x0, ybase = (LW - (bb[2] - bb[0])) // 2 - bb[0], 6 - bb[1] + 6
    text = Image.new("L", (LW, LH), 0)
    ImageDraw.Draw(text).text((x0, ybase), word, font=f_big, fill=255)
    top, bot = bb[1] + ybase, bb[3] + ybase
    # the subtitle, letter-spaced, with a voxel cube at each end
    spacing = 3
    widths = [f_small.getbbox(ch)[2] for ch in subtitle]
    sw = sum(widths) + spacing * (len(subtitle) - 1)
    cs, gap = 50, 16
    total = cs + gap + sw + gap + cs
    sx = (LW - total) // 2
    sy = bot + 22
    sub = Image.new("L", (LW, LH), 0)
    x = sx + cs + gap
    for ch, w in zip(subtitle, widths):
        ImageDraw.Draw(sub).text((x, sy), ch, font=f_small, fill=255)
        x += w + spacing
    sbb = sub.getbbox() or (0, sy, 1, sy + 30)
    cm, ccol = cube_layers(cs, theme["cube"])
    cubes, cube_col = Image.new("L", (LW, LH), 0), Image.new("RGB", (LW, LH))
    cy = (sbb[1] + sbb[3]) // 2 - cm.height // 2
    for cx in (sx, sx + cs + gap + sw + gap):
        cubes.paste(cm, (cx, cy), cm)
        cube_col.paste(ccol, (cx, cy), cm)
    edge = ImageChops.lighter(ImageChops.lighter(grow(text, 9), grow(sub, 6)), grow(cubes, 5))

    out = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
    halo = Image.new("RGBA", (LW, LH), theme["halo"] + (0,))
    halo.putalpha(edge.filter(ImageFilter.GaussianBlur(18)).point(lambda v: int(v * 0.7)))
    out.alpha_composite(halo)
    shadow = Image.new("RGBA", (LW, LH), theme["ink"] + (0,))
    shadow.putalpha(ImageChops.offset(edge, 0, 7))
    out.alpha_composite(shadow)
    ink = Image.new("RGBA", (LW, LH), theme["ink"] + (0,))
    ink.putalpha(edge)
    out.alpha_composite(ink)
    wf = Image.new("RGB", (LW, LH), theme["fill"][1])
    wf.paste(stepped((LW, bot - top), *theme["fill"]), (0, top))
    wf = wf.convert("RGBA")
    wf.putalpha(text)
    out.alpha_composite(wf)
    # a one-band highlight across the top of the letters
    hi = Image.new("L", (LW, LH), 0)
    ImageDraw.Draw(hi).rectangle([0, top + (bot - top) * 0.1, LW, top + (bot - top) * 0.2], fill=110)
    shine = Image.new("RGBA", (LW, LH), (255, 255, 255, 0))
    shine.putalpha(ImageChops.multiply(hi, text))
    out.alpha_composite(shine)
    sf = stepped((LW, LH), *theme["sub"], steps=3).convert("RGBA")
    sf.putalpha(sub)
    out.alpha_composite(sf)
    cc = cube_col.convert("RGBA")
    cc.putalpha(cubes)
    out.alpha_composite(cc)
    return out.crop((0, 0, LW, (edge.getbbox() or (0, 0, LW, LH))[3] + 10))


def main() -> None:
    flat = sys.argv[1] == "--flat"
    args = sys.argv[2:] if flat else sys.argv[1:]
    src, theme_name, subtitle, dst = args
    theme = THEMES[theme_name]
    fg = Image.open(src).convert("RGBA")
    W, H = fg.size
    if flat:
        img = fg
    else:
        img = gradient((W, H), *theme["sky"]).convert("RGBA")
        img.alpha_composite(fg)
    lg = logo(W, theme, subtitle)
    img.alpha_composite(lg, (0, H - lg.height - 6))
    img.convert("RGB").save(dst)
    print(dst, img.size)


if __name__ == "__main__":
    main()
