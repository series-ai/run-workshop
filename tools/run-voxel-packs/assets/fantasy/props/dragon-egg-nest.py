"""Dragon egg nest in the Pirate Nation style.

A woven ring of chunky branches on a mossy earth pad holds a straw bed and
three oversized eggs (rule F4). The hero egg is cream with a jagged
ember-orange crack and a glowing fissure (rule C3); the others are arcane
magenta and sky-blue with gold speckle bands. Gold coins and two gems lie
in the straw. The fairy-motes effect plays at socket-glow over the crack.
About 32 across and 22 tall.
"""

import math

import numpy as np

import paint as P
from _props import coords, gem
from pnshapes import cone, disc, last, quad, radial
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 32, 24, 32
CX, CZ = 16, 16


def branch(g: Grid, ang: float, r: float, half: float, thick: float, y0: float, y1: float, shade: int) -> np.ndarray:
    """One chunky stick laid tangent to the nest ring at angle `ang`."""
    px, pz = CX + r * math.cos(ang), CZ + r * math.sin(ang)
    dx, dz = -math.sin(ang), math.cos(ang)
    p0 = (px - dx * half, pz - dz * half)
    p1 = (px + dx * half, pz + dz * half)
    g.prism("y", quad(p0, p1, thick / 2, thick / 2, cap=0.8), y0, y1, C("darkwood", shade))
    return last(g)


EGG_PROFILE = [  # (fraction of the height, flat radius as a fraction of r)
    (0.00, 0.45), (0.18, 0.85), (0.42, 1.00), (0.62, 0.96),
    (0.80, 0.72), (0.92, 0.44), (1.00, 0.18),
]


def egg(g: Grid, cx: float, cz: float, y0: float, r: float, h: float, ramp: str, base: int) -> np.ndarray:
    """A chunky faceted egg: a round foot, a full belly and a domed crown."""
    m = np.zeros(g.shape, bool)
    for (t0, s0), (t1, s1) in zip(EGG_PROFILE, EGG_PROFILE[1:]):
        lo, hi = y0 + h * t0, y0 + h * t1
        if hi - lo < 1:
            continue
        if s1 >= s0:
            m |= cone(g, "y", cx, cz, r * s1, lo, hi, ramp, base, n=8, r_top=r * s0, tip="lo")
        else:
            m |= cone(g, "y", cx, cz, r * s0, lo, hi, ramp, base, n=8, r_top=r * s1)
    _X, Y, _Z = coords(g)
    P.flat(g, m & (Y > y0 + h * 0.8), ramp, min(7, base + 1))
    P.flat(g, m & (Y < y0 + h * 0.18), ramp, max(1, base - 2))
    return m


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # the earth pad with a mossy rim
    pad = disc(g, "y", CX, CZ, 15.0, 0, 2, "darkwood", 4, n=8)
    P.mottle(g, pad, "darkwood", 4, cell=3, seed=1)
    d = np.hypot(X - CX, Z - CZ)
    P.flat(g, pad & (Y > 1) & (d > 11.5), "moss", 4)
    P.flat(g, pad & (Y > 1) & (d < 11.5), "darkwood", 5)

    # the nest: three woven rings of chunky branches
    for layer, (y0, y1, rr, shade) in enumerate(((2, 5, 11.5, 4), (5, 8, 12.0, 5), (8, 11, 11.0, 3))):
        for k in range(7):
            a = 2 * math.pi * k / 7 + layer * 0.3
            m = branch(g, a, rr, 7.0, 2.6, y0, y1, shade)
            P.planks(g, m, "darkwood", shade, width=3, across="y", frame="wall", nails=False, seed=layer * 10 + k)
            P.flat(g, m & (Yi == y1 - 1), "wood", 4)  # lit tops separate the sticks

    # the straw bed inside the ring
    straw = disc(g, "y", CX, CZ, 10.0, 2, 5, "gold", 5, n=8)
    P.thatch(g, straw, "gold", 5, band=4, frame="top", seed=2)
    P.flat(g, straw & (d > 8.6), "gold", 4)

    # the hero egg: cream shell, a jagged ember crack and a glowing fissure
    hero = egg(g, 15, 14, 5, 6.2, 16, "bone", 7)
    hr = np.hypot(X - 15, Z - 14)
    P.flat(g, hero & ((Xi + Zi) % 6 == 0) & (Y > 8) & (Y < 18), "bone", 6)  # shell plates
    zig = 15 + np.where(Yi % 6 < 3, 1, -1) + (Yi % 3) - 1
    crack = hero & (Y > 7) & (Y < 19) & (np.abs(Xi - zig) < 1.6) & (Z < 15)
    P.flat(g, crack, "orange", 4)
    P.flat(g, crack & (np.abs(Xi - zig) < 0.9), "orange", 6)
    P.flat(g, crack & (np.abs(Xi - zig) < 0.9) & (Y > 10) & (Y < 16), "gold", 7)
    P.flat(g, hero & (Y > 19), "bone", 7)
    P.flat(g, hero & (Y < 8), "sand", 6)

    # the arcane magenta egg and the sky-blue egg
    for (ex, ez, er, eh, ramp, base, band) in (
        (25, 12, 4.8, 13, "magenta", 5, "gold"),
        (16, 24, 4.4, 12, "cyan", 5, "blue"),
    ):
        m = egg(g, ex, ez, 5, er, eh, ramp, base)
        P.flat(g, m & ((Yi - 5) % 4 == 0) & (Y > 7) & (Y < 5 + eh - 1), band, 6)
        P.flat(g, m & ((Yi - 5) % 4 == 0) & ((Xi + Zi) % 3 == 0) & (Y > 7), band, 7)
        P.flat(g, m & (np.hypot(X - ex + 2, Z - ez + 2) < 1.6) & (Y > 5 + eh * 0.5) & (Y < 5 + eh * 0.8), ramp, 7)

    # gold coins and two gems bedded in the straw
    for ox, oz in ((9, 22), (11, 24), (8, 20), (22, 22), (24, 20)):
        c = disc(g, "y", ox, oz, 1.4, 5, 6, "gold", 6, n=6)
        P.flat(g, c & (Y > 5.4), "gold", 7)
    gem(g, 7, 5, 14, r=1.8, h=3.0, ramp="cyan", shade=5)
    gem(g, 22, 5, 9, r=1.6, h=2.6, ramp="red", shade=5)

    root = Part("dragon-egg-nest", g)
    return Asset(id="fantasy-props-dragon-egg-nest", pack="fantasy", category="props", name="Dragon Egg Nest",
                 root=root, sockets=[Socket("socket-glow", at=(15.0, 17.0, 10.0))],
                 pfx=[{"effectId": "rvx-fantasy-fairy-motes", "socket": "socket-glow", "trigger": "idle", "size": 10}])
