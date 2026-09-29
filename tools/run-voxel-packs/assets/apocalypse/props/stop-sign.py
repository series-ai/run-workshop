"""Bent stop sign, in the Pirate Nation style.

An oversized octagonal plate (rule F4) in signal red with a bone border
and a big STOP, bent over on a kinked steel post: the lower post stands
in a cracked chunk of kerb concrete, the upper post leans off on a true
diagonal and the plate hangs turned and tipped (rule F5). Bullet holes,
a teal sticker, punched holes and cracks are paint (rule S1).
"""
import numpy as np

import paint as P
import pnglyph
from _props import asset, child, rock, root, tuft
from pnkit import box
from pnshapes import bar, coords, disc, ngon_radius
from voxgrid import Grid

PX, PZ = 13, 12  # post foot centre
KINK = 14  # the post bends here
LEAN = 5.0  # the upper post leans this far to +x


def plate() -> Grid:
    """The stop plate facing -z, centre (14, 14), 3 thick."""
    g = Grid(28, 28, 3)
    m = disc(g, "z", 14, 14, 13.5, 0, 3, "red", 4)
    d = ngon_radius(g, "z", 14, 14)
    X, Y, Z = coords(g)
    P.mottle(g, m, "red", 4, cell=3, seed=1)
    P.flat(g, m & (d > 11.6), "bone", 7)
    P.flat(g, m & (d > 12.8), "red", 3)
    P.flat(g, m & (Z > 2), "steel", 5)  # the grey back
    tw, th = pnglyph.text_size("STOP")
    pnglyph.text(g, "-z", 0, 14 - tw // 2, 14 - th // 2, "STOP", "bone", 7)
    for bx, by in ((7.5, 20.5), (20.5, 8.5), (18.5, 21.5)):  # bullet holes with a bright rim
        P.flat(g, m & (np.hypot(X - bx, Y - by) < 1.3), "steel", 6)
        P.flat(g, m & (np.hypot(X - bx, Y - by) < 0.7), "steel", 2)
    P.flat(g, m & (Z < 1) & (np.abs(X - 21) < 2) & (np.abs(Y - 5) < 1.5), "teal", 6)  # sticker
    return g


def build():
    g = Grid(28, 27, 24)
    X, Y, Z = coords(g)
    # the kerb chunk the post is set in
    rock(g, PX + 0.5, PZ, 0, 8.5, 5, n=6, seed=4, ramp="sand", base=5)
    k = rock(g, PX + 6, PZ + 4, 0, 4.5, 3, n=5, seed=7, ramp="sand", base=6)
    P.flat(g, k & (Y > 2), "gold", 5)  # a painted kerb edge
    # lower post, straight, 3 × 2, with punched holes
    post = box(g, PX - 1, 3, PZ - 1, PX + 2, KINK, PZ + 1, "steel", 5)
    P.flat(g, post & (Z < PZ) & (np.floor(Y) % 3 == 0) & (np.abs(X - PX - 0.5) < 0.6), "steel", 3)
    # upper post: a true diagonal from the kink
    up = bar(g, "z", (PX + 0.5, KINK - 1), (PX + 0.5 + LEAN, 20.0), 3.0, PZ - 1, PZ + 1, "steel", 5)
    P.flat(g, up & (np.abs(X - PX - 0.5 - (Y - KINK) * 0.25) < 0.5), "steel", 6)
    tuft(g, PX - 7, PZ - 6, 0, seed=1)
    tuft(g, PX + 8, PZ - 4, 0, seed=2)
    r = root("stop-sign", g)
    # the plate hangs off the post top, turned and tipped back
    child(r, "plate", plate(), pivot=(14.0, 8.0, 3.0), at_grid=(PX + 0.5 + LEAN, 18.5, PZ - 1), rot=(-8.0, -14.0, -10.0))
    return asset("stop-sign", "Bent Stop Sign", r)
