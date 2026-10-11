"""Flower meadow in the Pirate Nation style.

A wide, low patch of turf with a soft rise on the right and a trodden
earth path across it. The flowers grow in drifts, not in a grid: tall
blue and violet lupin spikes (tapered frustums with painted florets), a
drift of red tulip cups, three daisy cushions painted with white and gold
heads, and two tall sunflowers that face the viewer (rule F4: the
oversized flowers). A straw bee skep on a stump at the left edge is the
one story prop; the bee-swarm PFX plays over it. Every flower is a few
true-slope prisms; the detail is paint (rule S1). About 62 wide and 21
tall. Faces -Z.
"""
import math

import numpy as np

import paint as P
from _fterrain import ground, noise, outline, shrink
from _kit import prop
from _life import coords, facet_paint, foliage, front, grass, ngon, plan, trunk
from voxgrid import Grid

SZ = (70, 26, 52)
CX, CZ = 35.0, 26.0
G = 2  # the turf top
RISE = (47.0, 31.0)  # the centre of the soft rise
RISE_TOP = 3.5
SKEP = (11.5, 30.5)


def stem(g, x, z, y0, y1, ramp="forest", base=4) -> np.ndarray:
    """A thin square stem from y0 to y1."""
    return plan(g, [(x - 0.6, z - 0.6), (x + 0.6, z - 0.6), (x + 0.6, z + 0.6), (x - 0.6, z + 0.6)], y0, y1, ramp, base)


def lupin(g, x, z, y0, h, ramp: str, seed: int) -> None:
    """A lupin: a short stem under a tall tapered spike of florets."""
    X, Y, Z = coords(g)
    stem(g, x, z, y0 - 0.5, y0 + 3.0)
    spike = plan(g, ngon(x, z, 1.7, 6, seed * 0.4), y0 + 3.0, y0 + 3.0 + h, ramp, 4, top=ngon(x, z, 0.5, 6, seed * 0.4))
    P.flat(g, spike & ((np.floor(Y).astype(int) % 2) == 0), ramp, 6)  # rows of florets
    P.flat(g, spike & (Y > y0 + 2.0 + h), ramp, 7)  # the pale buds at the tip
    P.flat(g, spike & (Y < y0 + 4.0), "forest", 4)  # the green neck


def tulip(g, x, z, y0, h, ramp: str, seed: int) -> None:
    """A tulip: a stem and a five-sided cup that opens upward."""
    X, Y, Z = coords(g)
    stem(g, x, z, y0 - 0.5, y0 + h)
    cup = plan(g, ngon(x, z, 1.2, 5, seed), y0 + h - 0.5, y0 + h + 2.5, ramp, 5, top=ngon(x, z, 1.8, 5, seed))
    P.flat(g, cup & (Y > y0 + h + 1.5), ramp, 6)
    P.flat(g, cup & (Y < y0 + h + 0.5), ramp, 3)


def sunflower(g, x, z, y0, h) -> None:
    """A tall sunflower: a stem, two sloped leaves and a flat head that
    faces -z (gold petals round a brown seed disc)."""
    X, Y, Z = coords(g)
    stem(g, x, z, y0 - 0.5, y0 + h, "forest", 5)
    for side, yy in ((-1, 0.45), (1, 0.6)):
        plan(g, [(x, z - 0.8), (x + side * 4.5, z - 0.4), (x + side * 4.5, z + 0.6), (x, z + 0.8)], y0 + h * yy, y0 + h * yy + 1.2, "leaf", 4,
             top=[(x, z - 0.6), (x + side * 3.5, z - 0.2), (x + side * 3.5, z + 0.4), (x, z + 0.6)])
    head = front(g, ngon(x, y0 + h + 3.0, 4.2, 10, 0.1), z - 1.6, z - 0.4, "gold", 5)
    d = np.hypot(X - x, Y - (y0 + h + 3.0))
    P.flat(g, head & (d < 2.4), "wood", 3)
    P.flat(g, head & (d < 2.4) & (((np.floor(X) + np.floor(Y)) % 2) == 0), "wood", 2)
    P.flat(g, head & (d > 3.4), "gold", 6)


def daisies(g, x, z, y0, sx, sz, seed: int) -> None:
    """A low leaf cushion (one bevelled frustum) carrying painted daisy
    heads: 2 x 2 white dots with a gold eye."""
    X, Y, Z = coords(g)
    lo = [(x - sx / 2, z - sz / 2 + 1.5), (x - sx / 2 + 1.5, z - sz / 2), (x + sx / 2 - 1.5, z - sz / 2), (x + sx / 2, z - sz / 2 + 1.5),
          (x + sx / 2, z + sz / 2 - 1.5), (x + sx / 2 - 1.5, z + sz / 2), (x - sx / 2 + 1.5, z + sz / 2), (x - sx / 2, z + sz / 2 - 1.5)]
    m = plan(g, lo, y0, y0 + 3.4, "forest", 5, top=shrink(lo, x, z, 1.8))
    facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: foliage(gg, mm, "forest", 5, frame=fr, seed=seed))
    U, V = P.uv(g, None)  # tops use (x, z), sides use (x + z, y): heads on every face
    dot = m & (Y > y0 + 1.0) & ((U % 4) >= 1) & ((U % 4) <= 2) & ((V % 4) >= 1) & ((V % 4) <= 2) & ((P._hash(U // 4, V // 4, seed=seed) % np.uint64(4)) != 0)
    P.flat(g, dot, "bone", 7)
    P.flat(g, dot & ((U % 4) == 2) & ((V % 4) == 1), "gold", 6)


def skep(g) -> None:
    """A straw bee skep on a short stump: stacked frustums with tie bands
    and a dark entrance at the front foot."""
    X, Y, Z = coords(g)
    sx, sz = SKEP
    stump = trunk(g, [(sx, G - 0.5, sz), (sx, G + 4.0, sz)], [3.6, 3.3], "wood", 4, n=8, seed=61)
    P.flat(g, stump & (Y > G + 3.2), "wood", 6)
    y = G + 4.0
    start = len(g.solids)
    m = np.zeros(g.shape, dtype=bool)
    for r0, r1, hh in ((3.7, 4.0, 2.4), (4.0, 3.4, 2.4), (3.4, 2.3, 2.2), (2.3, 0.6, 1.8)):
        m |= plan(g, ngon(sx, sz, r0, 10, 0.1), y, y + hh, "sand", 5, top=ngon(sx, sz, r1, 10, 0.1))
        y += hh
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.thatch(gg, mm, "sand", 5, band=3, frame=fr, seed=62))
    P.flat(g, m & ((np.floor((Y - G - 4.0) * 1.0).astype(int) % 3) == 0), "sand", 3)  # the tie bands
    door = m & (Z < sz - 2.5) & (np.abs(X - sx) < 1.3) & (Y < G + 5.6)
    P.flat(g, door, "wood", 1)


def build():
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    pad, turf = ground(g, outline(CX, CZ, 31.0, 21.0, 14, seed=81, wobble=0.12, turn=0.15), CX, CZ, seed=81, top_y=G, cell=8.0)
    # the soft rise: a low grass tier on the right
    rise = outline(RISE[0], RISE[1], 13.0, 9.0, 10, seed=82, wobble=0.1)
    hill = plan(g, rise, G - 0.5, RISE_TOP, "leaf", 4, top=shrink(rise, RISE[0], RISE[1], 2.5))
    P._paint(g, hill, "leaf", np.where(noise(X, Z, 5.0, 83) > 0.5, 5, 4))
    P.flat(g, hill & (Y < G + 0.5), "leaf", 3)
    # the trodden path across the meadow (soft edges, no stepping stones)
    wob = noise(X, Z, 4.0, 84) * 2.0
    path = turf & (np.abs(Z - (6.0 + (X - 4.0) * 0.55)) < 2.2 + wob) & (X < 25)
    P.flat(g, path, "wood", 5)
    P.flat(g, path & (noise(X, Z, 2.5, 85) > 0.6), "wood", 4)
    P.flat(g, path & (noise(X, Z, 2.0, 86) > 0.75), "sand", 5)

    # lupin drifts (blue at the back left, violet on the rise)
    for k, (x, z, h, ramp) in enumerate(((20.5, 37.5, 9, "blue"), (24.5, 40.5, 11, "blue"), (17.5, 41.5, 8, "blue"),
                                         (45.5, 33.5, 10, "purple"), (50.5, 31.5, 8, "purple"), (48.5, 36.5, 12, "arcane"))):
        y0 = RISE_TOP if math.hypot((x - RISE[0]) / 10.5, (z - RISE[1]) / 6.5) < 1.0 else G
        lupin(g, x, z, y0, h, ramp, seed=k)
    # a drift of red tulips in the front right
    for k, (x, z, h) in enumerate(((40.5, 12.5, 4), (43.5, 10.5, 5), (46.5, 13.5, 4), (42.5, 15.5, 6), (49.5, 11.5, 5), (52.5, 15.5, 4))):
        tulip(g, x, z, G, h, "red" if k % 3 else "orange", seed=k)
    # daisy cushions and the two tall sunflowers
    daisies(g, 30.0, 24.0, G - 0.5, 9.0, 7.0, seed=87)
    daisies(g, 12.0, 15.0, G - 0.5, 8.0, 6.0, seed=88)
    daisies(g, 56.0, 23.0, G - 0.5, 7.0, 8.0, seed=89)
    sunflower(g, 36.5, 33.5, G, 13)
    sunflower(g, 58.5, 30.5, G, 10)
    skep(g)
    grass(g, [(8, G, 22), (61, G, 17), (40, G, 42)], "leaf", 5)
    return prop("fantasy-terrain-nature-flower-meadow", "Flower Meadow", g,
                sockets_at={"socket-function": (SKEP[0], G + 18.0, SKEP[1])},
                pfx=[{"effectId": "rvx-fantasy-bee-swarm", "socket": "socket-function", "trigger": "idle", "size": 18}])
