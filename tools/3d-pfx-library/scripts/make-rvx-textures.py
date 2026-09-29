"""Draws the RUN voxel pack particle textures into assets/run-voxel/
(Series Entertainment, RUN License: see THIRD_PARTY_NOTICES.md).

Style: the Pirate Nation VFX look. Shapes are hard-edged, faceted
silhouettes (like PN's smoke poofs), white so the emitter colour tints them,
with one darker facet for a toon light side and shadow side. Glyphs (runes,
skull, bat) are pixel art, scaled up with nearest-neighbour so the pixels
stay square. Deterministic: run it again and the files do not change.

    python3 scripts/make-rvx-textures.py
"""
from __future__ import annotations

import math
import os
import random

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "run-voxel")
S = 256  # cell size for shapes
SHADE = (196, 196, 196, 255)  # the shadow facet: about 77% of the tint
WHITE = (255, 255, 255, 255)


def blank(w: int = S, h: int = S) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def poly_blob(rng: random.Random, cx: float, cy: float, r: float, points: int, jitter: float) -> list[tuple[float, float]]:
    out = []
    for i in range(points):
        a = (i + rng.uniform(-0.25, 0.25)) / points * math.tau
        rr = r * (1 + rng.uniform(-jitter, jitter))
        out.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    return out


def puff(seed: int) -> Image.Image:
    """A faceted poof: three or four merged polygon lobes, lower-right lobes in the shadow tone."""
    rng = random.Random(seed)
    im = blank()
    d = ImageDraw.Draw(im)
    lobes = [(128 + rng.uniform(-30, 30), 128 + rng.uniform(-22, 22), rng.uniform(62, 76)) for _ in range(rng.choice([3, 4]))]
    lobes.sort(key=lambda l: l[0] + l[1])
    for i, (x, y, r) in enumerate(lobes):
        d.polygon(poly_blob(rng, x, y + 6, r, 7, 0.12), fill=SHADE)
    for i, (x, y, r) in enumerate(lobes):
        d.polygon(poly_blob(rng, x - 6, y - 6, r * 0.86, 7, 0.1), fill=WHITE)
    return im


def flame(seed: int) -> Image.Image:
    """A flame tongue: a faceted teardrop (tip up) with a lighter inner core."""
    rng = random.Random(seed)
    im = blank()
    d = ImageDraw.Draw(im)
    lean = rng.uniform(-28, 28)
    tip = (128 + lean, rng.uniform(14, 34))
    outer = [tip, (180, 120), (196, 178), (170, 228), (128, 244), (86, 228), (60, 178), (76, 120)]
    outer = [(x + rng.uniform(-6, 6), y + rng.uniform(-6, 6)) if i else (x, y) for i, (x, y) in enumerate(outer)]
    d.polygon(outer, fill=SHADE)
    inner = [(128 + lean * 0.6, tip[1] + 60), (160, 150), (164, 196), (128, 222), (92, 196), (96, 150)]
    d.polygon(inner, fill=WHITE)
    return im


def sheet(cells: list[Image.Image], columns: int) -> Image.Image:
    rows = math.ceil(len(cells) / columns)
    out = blank(S * columns, S * rows)
    for i, c in enumerate(cells):
        out.alpha_composite(c, ((i % columns) * S, (i // columns) * S))
    return out


def ring() -> Image.Image:
    """A hard 16-sided ring, thick, with a lighter inner edge."""
    im = blank()
    d = ImageDraw.Draw(im)
    n = 16
    outer = [(128 + 124 * math.cos(i / n * math.tau), 128 + 124 * math.sin(i / n * math.tau)) for i in range(n)]
    inner = [(128 + 96 * math.cos(i / n * math.tau), 128 + 96 * math.sin(i / n * math.tau)) for i in range(n)]
    inner2 = [(128 + 88 * math.cos(i / n * math.tau), 128 + 88 * math.sin(i / n * math.tau)) for i in range(n)]
    d.polygon(outer, fill=SHADE)
    d.polygon(inner, fill=WHITE)
    d.polygon(inner2, fill=(0, 0, 0, 0))
    return im


def slash() -> Image.Image:
    """A crescent swipe: thick at the lead (right), thin at the tail (left), bright leading edge."""
    im = blank()
    d = ImageDraw.Draw(im)
    outer, inner = [], []
    steps = 14
    for i in range(steps + 1):
        t = i / steps
        a = math.radians(200 + 150 * t)
        width = 10 + 58 * t ** 1.4
        outer.append((128 + 118 * math.cos(a), 150 + 118 * math.sin(a)))
        inner.append((128 + (118 - width) * math.cos(a), 150 + (118 - width) * math.sin(a) + width * 0.35))
    d.polygon(outer + inner[::-1], fill=SHADE)
    edge = []
    for i in range(steps + 1):
        t = i / steps
        a = math.radians(200 + 150 * t)
        edge.append((128 + (118 - 4 - 18 * t) * math.cos(a), 150 + (118 - 4 - 18 * t) * math.sin(a)))
    d.polygon(outer + edge[::-1], fill=WHITE)
    return im


def star() -> Image.Image:
    """A hard four-point glint with a shadow-tone lower-right half."""
    im = blank()
    d = ImageDraw.Draw(im)
    c, long, short = 128, 124, 22
    pts = []
    for i in range(8):
        a = i / 8 * math.tau - math.pi / 2
        r = long if i % 2 == 0 else short
        pts.append((c + r * math.cos(a), c + r * math.sin(a)))
    d.polygon(pts, fill=WHITE)
    d.polygon([(c, c), pts[2], pts[3], pts[4], pts[5], pts[6]], fill=SHADE)
    d.polygon([(c, c - 34), (c + 34, c), (c, c + 34), (c - 34, c)], fill=WHITE)
    return im


def streak() -> Image.Image:
    """A long diamond (drawn along +Y) for stretched sparks and bolts: white core, shadow rim."""
    im = blank()
    d = ImageDraw.Draw(im)
    d.polygon([(128, 2), (188, 128), (128, 254), (68, 128)], fill=SHADE)
    d.polygon([(128, 18), (160, 128), (128, 238), (96, 128)], fill=WHITE)
    return im


def leaf() -> Image.Image:
    im = blank()
    d = ImageDraw.Draw(im)
    d.polygon([(128, 12), (206, 96), (196, 170), (128, 244), (60, 170), (50, 96)], fill=WHITE)
    d.polygon([(128, 12), (206, 96), (196, 170), (128, 244)], fill=SHADE)
    d.line([(128, 30), (128, 236)], fill=(150, 150, 150, 255), width=10)
    return im


def bubble() -> Image.Image:
    """A bubble: a hard rim, a see-through middle and a highlight chip."""
    im = blank()
    d = ImageDraw.Draw(im)
    n = 14
    rim = [(128 + 120 * math.cos(i / n * math.tau), 128 + 120 * math.sin(i / n * math.tau)) for i in range(n)]
    hole = [(128 + 98 * math.cos(i / n * math.tau), 128 + 98 * math.sin(i / n * math.tau)) for i in range(n)]
    d.polygon(rim, fill=SHADE)
    d.polygon(hole, fill=(255, 255, 255, 90))
    d.polygon([(70, 92), (96, 64), (118, 74), (88, 110)], fill=WHITE)
    return im


def shard() -> Image.Image:
    """A crystal or glass shard: a faceted spike, one lit face and one shadow face."""
    im = blank()
    d = ImageDraw.Draw(im)
    d.polygon([(128, 4), (178, 150), (128, 252), (80, 150)], fill=WHITE)
    d.polygon([(128, 4), (178, 150), (128, 252)], fill=SHADE)
    return im


def drop() -> Image.Image:
    """A droplet (tip up) for goo, blood and water."""
    im = blank()
    d = ImageDraw.Draw(im)
    n = 12
    body = [(128 + 84 * math.cos(i / n * math.tau), 168 + 76 * math.sin(i / n * math.tau)) for i in range(n)]
    d.polygon(body, fill=SHADE)
    d.polygon([(128, 8), (190, 140), (66, 140)], fill=SHADE)
    d.polygon([(128, 30), (170, 150), (128, 214), (86, 150)], fill=WHITE)
    return im


def beam() -> Image.Image:
    """A beam column: hard sides, a bright centre stripe, fading out toward the top."""
    im = blank(128, 256)
    px = im.load()
    for y in range(256):
        fade = min(1.0, y / 255 * 1.6)  # image top = beam top: clear there, solid at the base
        for x in range(128):
            edge = abs(x - 63.5) / 64
            if edge > 0.92:
                continue
            core = edge < 0.3
            a = int(255 * fade * (1 if core else 0.62))
            v = 255 if core else 214
            px[x, y] = (v, v, v, a)
    return im


def trail() -> Image.Image:
    """A blade trail (ribbon): u = age (left fresh, right old), image top = blade
    tip. Hard bands, toon style: brightest at the tip and at the fresh edge,
    stepping down in alpha toward the hilt and with age."""
    im = blank(256, 128)
    px = im.load()
    for y in range(128):
        v = 1 - y / 127  # 1 at the tip (image top)
        across = 1.0 if v > 0.78 else 0.72 if v > 0.45 else 0.38 if v > 0.12 else 0.0
        for x in range(256):
            u = x / 255
            along = 1.0 if u < 0.3 else 0.62 if u < 0.62 else 0.28
            a = across * along
            if a <= 0:
                continue
            bright = v > 0.78 or u < 0.06
            c = 255 if bright else 214
            px[x, y] = (c, c, c, int(255 * a))
    return im


def pixel_art(rows: list[str], scale: int) -> Image.Image:
    """'#' = white, '+' = shadow tone, '.' = clear."""
    h, w = len(rows), len(rows[0])
    im = blank(w, h)
    px = im.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "#":
                px[x, y] = WHITE
            elif ch == "+":
                px[x, y] = SHADE
    return im.resize((w * scale, h * scale), Image.NEAREST)


RUNES = [
    [
        "................",
        "......####......",
        ".....#....#.....",
        "....#..##..#....",
        "...#..#..#..#...",
        "..#...#..#...#..",
        "..#....##....#..",
        "..#..........#..",
        "..############..",
        "..#....##....#..",
        "..#....##....#..",
        "...#...##...#...",
        "....#..##..#....",
        ".....#.##.#.....",
        "......####......",
        "................",
    ],
    [
        "................",
        ".......##.......",
        ".......##.......",
        "...##..##..##...",
        "....##.##.##....",
        ".....######.....",
        ".......##.......",
        "..############..",
        ".......##.......",
        ".....######.....",
        "....##.##.##....",
        "...##..##..##...",
        ".......##.......",
        ".......##.......",
        "................",
        "................",
    ],
    [
        "................",
        "..##........##..",
        "..###......###..",
        "...###....###...",
        "....###..###....",
        ".....######.....",
        "......####......",
        "......####......",
        ".....######.....",
        "....###..###....",
        "...###....###...",
        "..###......###..",
        "..##........##..",
        "................",
        "................",
        "................",
    ],
    [
        "................",
        "......####......",
        "....##....##....",
        "...#........#...",
        "..#..##..##..#..",
        "..#..##..##..#..",
        "..#..........#..",
        "..#....##....#..",
        "...#..#..#..#...",
        "....##....##....",
        "......####......",
        ".......##.......",
        ".....######.....",
        ".......##.......",
        "................",
        "................",
    ],
]

SKULL = [
    "................",
    ".....######.....",
    "...##########...",
    "..############..",
    "..############..",
    "..##...##...##..",
    "..##...##...##..",
    "..#####..#####..",
    "...####..####...",
    "....########....",
    ".....#.##.#.....",
    ".....######.....",
    "......+..+......",
    "................",
    "................",
    "................",
]

BATS = [
    [
        "................",
        "................",
        "#.............#.",
        "##...........##.",
        "###...#.#...###.",
        "####..###..####.",
        "#####+###+#####.",
        "######...######.",
        "#.###.....###.#.",
        "...#.......#....",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
    ],
    [
        "................",
        "................",
        "................",
        "................",
        "................",
        "......#.#.......",
        "......###.......",
        "...###+#+###....",
        "..#####.#####...",
        ".######.######..",
        ".##.##...##.##..",
        ".#..#.....#..#..",
        "................",
        "................",
        "................",
        "................",
    ],
]


def pixel_sheet(frames: list[list[str]], columns: int) -> Image.Image:
    cells = [pixel_art(f, 8) for f in frames]
    rows = math.ceil(len(cells) / columns)
    out = blank(128 * columns, 128 * rows)
    for i, c in enumerate(cells):
        out.alpha_composite(c, ((i % columns) * 128, (i // columns) * 128))
    return out


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    files = {
        "puff": sheet([puff(s) for s in (1, 2, 3, 4)], 2),
        "flame": sheet([flame(s) for s in (5, 6, 7, 8)], 2),
        "ring": ring(),
        "slash": slash(),
        "star": star(),
        "streak": streak(),
        "leaf": leaf(),
        "bubble": bubble(),
        "shard": shard(),
        "drop": drop(),
        "beam": beam(),
        "trail": trail(),
        "runes": pixel_sheet(RUNES, 2),
        "skull": pixel_art(SKULL, 8),
        # Eight frames, wings up and down in turn: a bat flaps four times per life.
        "bat": pixel_sheet(BATS * 4, 4),
    }
    for name, im in files.items():
        im.save(os.path.join(OUT, f"{name}.png"), optimize=True)
        print(f"assets/run-voxel/{name}.png {im.size[0]}x{im.size[1]}")


if __name__ == "__main__":
    main()
