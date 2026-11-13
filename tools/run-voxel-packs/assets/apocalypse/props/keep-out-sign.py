"""Hand-painted KEEP OUT sign, in the Pirate Nation style.

A chunky board of three salvaged planks (one still teal from an old
fence) nailed to two thick posts with sharpened tops (true slopes), hung
crooked (rule F5). KEEP OUT in big red brush letters and a red skull are
paint (rule S1). A hub cap is nailed to a post as a warning, a loose
board crosses the foot on a true diagonal and barbed wire zigzags along
the top.
"""
import numpy as np

import paint as P
import pnglyph
from _props import asset, child, root, tuft
from pnkit import box
from pnshapes import bar, coords, disc, ngon_radius, pyramid
from voxgrid import Grid

W = 36
POSTS = (4, 29)  # post x (3 wide)
TOP = 30  # post top (before the point)


def board() -> Grid:
    """The three planks: x 0..W, y 0..24, 2 thick; the front is z = 0."""
    g = Grid(W, 26, 2)
    X, Y, Z = coords(g)
    planks = ((0, 9, 0, W, "sand", 6), (9, 17, 1, W - 1, "teal", 5), (17, 25, 0, W - 2, "sand", 6))
    for y0, y1, x0, x1, ramp, shade in planks:
        m = box(g, x0, y0, 0, x1, y1, 2, ramp, shade)
        P.planks(g, m, ramp, shade, width=y1 - y0, across="y", length=(60, 61), seed=y0)
        P.flat(g, m & ((Y < y0 + 1) | (Y > y1 - 1)), ramp, shade - 2)
        for px in POSTS:  # nail heads over the posts
            P.flat(g, m & (np.abs(X - px - 1.5) < 0.6) & (np.abs(Y - (y0 + y1) / 2) < 0.6), "steel", 6)
    # the teal plank is weathered: bare wood shows through
    P.flat(g, (g.a > 0) & (Y > 10) & (Y < 16) & (((X > 2) & (X < 6)) | ((X > 27) & (X < 30)) | ((X > 14) & (X < 16) & (Y < 12))), "sand", 5)
    tw, _ = pnglyph.text_size("KEEP")
    pnglyph.text(g, "-z", 0, 16 - tw // 2, 18, "KEEP", "red", 4)
    tw, _ = pnglyph.text_size("OUT")
    pnglyph.text(g, "-z", 0, 16 - tw // 2, 10, "OUT", "red", 5)
    iw, _ih = pnglyph.icon_size("skull")
    pnglyph.icon(g, "-z", 0, W - iw - 2, 0, "skull", "red", 4)
    return g


def build():
    g = Grid(W + 2, 36, 8)
    X, Y, Z = coords(g)
    for k, px in enumerate(POSTS):
        post = box(g, px, 0, 4, px + 3, TOP, 7, "rust", 4)
        P.planks(g, post, "rust", 4, width=3, across="x", nails=False, seed=k)
        pyramid(g, px, 4, px + 3, 7, TOP, 3, "rust", 5)
        tuft(g, px - 2 + 4 * k, 2, 0, seed=k)
    # a loose board nailed across the foot of the posts (a true diagonal)
    b = bar(g, "z", (2.0, 3.0), (34.0, 10.0), 3.0, 2, 4, "wood", 5)
    P.planks(g, b, "wood", 5, width=3, across="y", nails=True, seed=5)
    # barbed wire zigzags along the post tops, with painted barbs
    for k in range(6):
        x0 = POSTS[0] + 1.5 + k * (POSTS[1] - POSTS[0]) / 6
        x1 = POSTS[0] + 1.5 + (k + 1) * (POSTS[1] - POSTS[0]) / 6
        y0, y1 = (TOP + 1.0, TOP + 2.2) if k % 2 == 0 else (TOP + 2.2, TOP + 1.0)
        w = bar(g, "z", (x0, y0), (x1, y1), 0.9, 5, 6, "steel", 5)
    # a hub cap nailed to the right post as a warning (seen from the front)
    hub = disc(g, "z", POSTS[0] + 1.5, 7, 4.5, 2, 4, "steel", 6)
    d = ngon_radius(g, "z", POSTS[0] + 1.5, 7)
    P.flat(g, hub & (d > 3.6), "steel", 4)
    P.flat(g, hub & (d < 1.4), "red", 4)
    P.flat(g, hub & (d > 1.4) & (d < 3.6) & ((X - POSTS[0]) % 3 < 1), "rust", 5)
    r = root("keep-out-sign", g)
    child(r, "board", board(), pivot=(W / 2, 0.0, 2.0), at_grid=(W / 2 + 1, 5, 4), rot=(0.0, 0.0, 3.5))
    return asset("keep-out-sign", "Keep Out Sign", r)
