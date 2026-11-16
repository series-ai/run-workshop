"""Paint the sky behind a cover render and set the pack logo along the bottom.

    python3 covers/cover_title.py <render.png> <theme> <subtitle> <out.png>
    python3 covers/cover_title.py --flat <bg.png> <theme> <subtitle> <out.png>   (a 2D background, no sky)

No scrim: the logo reads through its own outline, drop shadow and halo (see the
pack-cover direction). The logo is the pack word in Lilita One with a gradient fill
and a heavy ink outline, a voxel cube as its mark, and a letter-spaced subtitle.
"""
from __future__ import annotations

import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, "fonts", "LilitaOne-Regular.ttf")  # SIL Open Font License, see fonts/LilitaOne-OFL.txt

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
    S = 2
    word = theme["word"]
    size = 200 if len(word) <= 7 else 160
    f_big, f_small = ImageFont.truetype(FONT, size * S), ImageFont.truetype(FONT, 58 * S)
    LW, LH = W * S, 300 * S
    stroke = 15 * S
    ww = f_big.getbbox(word)[2]
    x0, ybase = (LW - ww) // 2, 10 * S
    text, outline = Image.new("L", (LW, LH), 0), Image.new("L", (LW, LH), 0)
    ImageDraw.Draw(text).text((x0, ybase), word, font=f_big, fill=255)
    ImageDraw.Draw(outline).text((x0, ybase), word, font=f_big, fill=255, stroke_width=stroke, stroke_fill=255)
    # the subtitle, letter-spaced, with a voxel cube at each end
    spacing = 9 * S
    widths = [f_small.getbbox(ch)[2] for ch in subtitle]
    sw = sum(widths) + spacing * (len(subtitle) - 1)
    cs = 52 * S
    gap = 22 * S
    total = cs + gap + sw + gap + cs
    sx = (LW - total) // 2
    sy = ybase + int(size * 0.98) * S
    sub, sub_out = Image.new("L", (LW, LH), 0), Image.new("L", (LW, LH), 0)
    x = sx + cs + gap
    for ch, w in zip(subtitle, widths):
        ImageDraw.Draw(sub).text((x, sy), ch, font=f_small, fill=255)
        ImageDraw.Draw(sub_out).text((x, sy), ch, font=f_small, fill=255, stroke_width=11 * S, stroke_fill=255)
        x += w + spacing
    cm, ccol = cube_layers(cs, theme["cube"])
    cubes, cube_col = Image.new("L", (LW, LH), 0), Image.new("RGB", (LW, LH))
    cy = sy + f_small.getbbox("V")[1] + (f_small.getbbox("V")[3] - f_small.getbbox("V")[1] - cm.height) // 2
    for cx in (sx, sx + cs + gap + sw + gap):
        cubes.paste(cm, (cx, cy), cm)
        cube_col.paste(ccol, (cx, cy), cm)
    cube_out = cubes.filter(ImageFilter.MaxFilter(2 * (9 * S // 2) + 1))
    edge = ImageChops.lighter(ImageChops.lighter(outline, sub_out), cube_out)

    out = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
    halo = Image.new("RGBA", (LW, LH), theme["halo"] + (0,))
    halo.putalpha(edge.filter(ImageFilter.GaussianBlur(24 * S)).point(lambda v: int(v * 0.8)))
    out.alpha_composite(halo)
    shadow = Image.new("RGBA", (LW, LH), theme["ink"] + (0,))
    shadow.putalpha(ImageChops.offset(edge, 0, 8 * S))
    out.alpha_composite(shadow)
    ink = Image.new("RGBA", (LW, LH), theme["ink"] + (0,))
    ink.putalpha(edge)
    out.alpha_composite(ink)
    # the word: a top-to-bottom gradient over its own height, with a light band near the top
    top, bot = f_big.getbbox(word)[1] + ybase, f_big.getbbox(word)[3] + ybase
    wf = Image.new("RGB", (LW, LH), theme["fill"][1])
    wf.paste(gradient((LW, bot - top), *theme["fill"]), (0, top))
    wf = wf.convert("RGBA")
    wf.putalpha(text)
    out.alpha_composite(wf)
    shine = Image.new("RGBA", (LW, LH), (255, 255, 255, 0))
    band = Image.new("L", (LW, LH), 0)
    ImageDraw.Draw(band).rectangle([0, top + (bot - top) * 0.12, LW, top + (bot - top) * 0.24], fill=90)
    shine.putalpha(ImageChops.multiply(band, text))
    out.alpha_composite(shine)
    sf = gradient((LW, LH), *theme["sub"]).convert("RGBA")
    sf.putalpha(sub)
    out.alpha_composite(sf)
    cc = cube_col.convert("RGBA")
    cc.putalpha(cubes)
    out.alpha_composite(cc)
    return out.resize((W, LH // S), Image.LANCZOS)


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
