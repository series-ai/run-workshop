"""Wizard tower in the Pirate Nation style.

Three crooked, stacked octagonal drums of warm sandstone (each set a
little off the one below, F5) with glowing cyan rune bands and round cyan
windows, a planked balcony on dark brackets with a brass telescope, and
the oversized function prop: a huge bent royal-blue wizard hat (four
stacked frustums that curl to one side, true slopes) with a gold band and
painted gold stars. Two big magic-cyan crystals orbit the hat on `idle`;
arcane bolts fire from the spire tip (PFX). A crystal cluster and a crate
of potions sit at the foot. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _bld import FRONT, arch_door, drum, idx, round_window, sandstone_painter
from pnkit import box, crate
from voxgrid import C, Asset, Clip, Grid, Part, Socket, turn

W, H, D = 72, 170, 72
CX, CZ = 36, 36
DRUMS = [  # (centre dx, dz, flat radius, y0, y1)
    (0, 0, 16, 6, 52),
    (2, -1, 13, 52, 88),
    (0, 1, 11, 88, 110),
]
HAT = [  # (centre dx, dz, radius) at each ring height of the bent hat
    (0, 1, 19, 110), (0, 1, 18, 113), (1, 1, 13, 128), (5, 2, 8, 141), (12, 3, 4.5, 149), (19, 4, 0, 153),
]
ORBIT_Y, ORBIT_R = 136, 24


def rune_band(g: Grid, mask: np.ndarray, y0: int, seed: int = 0) -> None:
    """A 5-voxel band of glowing cyan rune strokes on dark stone."""
    X, Y, Z = idx(g)
    band = mask & (Y >= y0) & (Y < y0 + 5)
    P.flat(g, band, "blue", 2)
    u = X + Z
    h = P._hash(u // 4, seed=seed) % np.uint64(4)
    stroke = band & (((u % 4 == 1) & (Y != y0 + 2)) | ((Y == y0 + 2) & (u % 4 != 0)) | ((h == np.uint64(0)) & (Y == y0 + 1)))
    P.flat(g, stroke & (Y > y0) & (Y < y0 + 4), "cyan", 7)


def tower() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = idx(g)
    drum(g, CX, CZ, 0, 6, 19, "sand", 3, r_top=17, painter=sandstone_painter(3, (8, 4), 0.0, seed=1))
    for k, (dx, dz, r, y0, y1) in enumerate(DRUMS):
        m = drum(g, CX + dx, CZ + dz, y0, y1, r, "sand", 4, painter=sandstone_painter(4, (7, 5), seed=2 + k))
        rune_band(g, m, y1 - 9, seed=k)
        ledge = drum(g, CX + dx, CZ + dz, y1 - 3, y1, r + 1.5, "gold", 4,
                     painter=lambda gg, mm, fr: P.planks(gg, mm, "gold", 4, width=3, across="x", nails=False, frame=fr))
    # balcony on dark brackets round the second drum
    dx, dz, r, y0, _ = DRUMS[1]
    drum(g, CX + dx, CZ + dz, y0 - 8, y0 - 3, DRUMS[0][2], "darkwood", 4, r_top=r + 7,
         painter=lambda gg, mm, fr: P.planks(gg, mm, "darkwood", 4, width=3, across="x", nails=False, frame=fr))
    deck = drum(g, CX + dx, CZ + dz, y0 - 3, y0, r + 7, "wood", 5,
                painter=lambda gg, mm, fr: P.planks(gg, mm, "wood", 5, width=3, across="y", frame=fr))
    for k in range(8):  # rail posts on the deck corners
        a = FRONT + math.pi / 8 + 2 * math.pi * k / 8
        rr = S.corner(r + 6, 8)
        px, pz = CX + dx + rr * math.cos(a), CZ + dz + rr * math.sin(a)
        box(g, round(px) - 1, y0, round(pz) - 1, round(px) + 1, y0 + 8, round(pz) + 1, "darkwood", 3)
    rail = drum(g, CX + dx, CZ + dz, y0 + 8, y0 + 10, r + 6.5, "darkwood", 3,
                painter=lambda gg, mm, fr: P.planks(gg, mm, "darkwood", 3, width=2, across="y", nails=False, frame=fr))
    # the telescope on the balcony, aimed up at the sky (a true slope)
    tx, tz = CX + dx + r + 1, CZ + dz - 6
    g.prism("z", S.quad((tx - 2, y0 + 4), (tx + 8, y0 + 16), 1.8, 2.6), tz - 2, tz + 2, C("gold", 5))
    tm = g.solids[-1].mask(g.shape)
    P.flat(g, tm & (Y > y0 + 13), "gold", 3)
    box(g, tx - 3, y0, tz - 1, tx - 1, y0 + 5, tz + 1, "darkwood", 3)
    # the bent wizard hat: a brim, then stacked frustums that curl to +x
    start = len(g.solids)
    for (ax, az, ra, ya), (bx, bz, rb, yb) in zip(HAT, HAT[1:]):
        poly = S.flat_ngon(CX + ax, CZ + az, ra, 8, FRONT)
        top = S.flat_ngon(CX + bx, CZ + bz, rb, 8, FRONT) if rb > 0 else [(CX + bx, CZ + bz)] * 8
        g.prism("y", poly, ya, yb, C("blue", 4), top=top)
    hat = np.logical_or.reduce([s.mask(g.shape) for s in g.solids[start:]])
    P.flat(g, hat, "blue", 4)
    P.flat(g, hat & S.seams(g, g.solids[start:], 0.9), "blue", 5)
    P.flat(g, hat & (Y < HAT[1][3]), "blue", 2)  # brim edge
    P.flat(g, hat & (Y >= HAT[1][3]) & (Y < HAT[1][3] + 4), "gold", 5)  # hat band
    P.flat(g, hat & (Y == HAT[1][3] + 1), "gold", 6)
    # painted gold stars and a crescent moon on the hat
    for sx, sy, sz in ((CX - 7, 121, None), (CX + 6, 133, None), (None, 124, CZ + 5), (None, 137, CZ - 4), (CX + 1, 126, None)):
        near = hat & (np.abs(Y - sy) <= 2) & (Y >= HAT[1][3] + 4)
        if sx is not None:  # a star seen on the front and back
            plus = near & (((np.abs(X - sx) <= 2) & (Y == sy)) | ((X == sx) & (np.abs(Y - sy) <= 2)) | ((np.abs(X - sx) == 1) & (np.abs(Y - sy) == 1)))
        else:  # a star seen on the sides
            plus = near & (((np.abs(Z - sz) <= 2) & (Y == sy)) | ((Z == sz) & (np.abs(Y - sy) <= 2)) | ((np.abs(Z - sz) == 1) & (np.abs(Y - sy) == 1)))
        P.flat(g, plus, "gold", 6)
    # door and windows
    dx0, dz0, r0 = DRUMS[0][0], DRUMS[0][1], DRUMS[0][2]
    front = CZ + dz0 - r0
    arch_door(g, "-z", front, CX - 7, CX + 7, 6, 32, leaf=("blue", 4), frame=("sand", 6), studs=("gold", 6), seed=12)
    steps = box(g, CX - 10, 0, front - 8, CX + 10, 3, front - 2, "sand", 3) | box(g, CX - 9, 3, front - 5, CX + 9, 6, front - 2, "sand", 3)
    P.stone(g, steps, "sand", 3, block=(6, 3), frame="top", seed=13)
    for (ddx, ddz, r, y0, y1), wy in zip(DRUMS, (32, 68, 96)):
        round_window(g, "+x", CX + ddx + r, CZ + ddz, wy, 3.5, glass=("cyan", 6), frame=("gold", 4))
        round_window(g, "-x", CX + ddx - r, CZ + ddz, wy - 6, 3.5, glass=("cyan", 6), frame=("gold", 4))
    round_window(g, "-z", CZ + DRUMS[1][1] - DRUMS[1][2], CX + DRUMS[1][0], 70, 4.5, glass=("cyan", 6), frame=("gold", 4))
    round_window(g, "-z", CZ + DRUMS[2][1] - DRUMS[2][2], CX + DRUMS[2][0], 98, 3.5, glass=("cyan", 6), frame=("gold", 4))
    # a crystal cluster and a potion crate at the foot (K1)
    for (cx, cz, h, lean) in ((CX + 17, CZ - 20, 14, 8), (CX + 22, CZ - 16, 10, -10), (CX + 13, CZ - 24, 8, 14)):
        crystal_at(g, cx, cz, 0, h, 2.6, lean)
    crate(g, CX - 26, 0, CZ - 22, 10, seed=14)
    for k, ramp in enumerate(("magenta", "cyan", "leaf")):
        px = CX - 24 + k * 3
        box(g, px, 10, CZ - 20, px + 2, 14, CZ - 18, ramp, 5)
    P.grime(g, (g.a > 0) & (Y < 10) & ~g.solid_mask(), height=4, seed=15)
    return g


def crystal_at(g: Grid, cx, cz, y0, h, r, lean: float = 0.0) -> np.ndarray:
    """A faceted cyan crystal standing on y0: a hexagonal prism with a
    pointed top, tipped `lean` degrees about z (a true slope)."""
    pts = [(cx - r, y0), (cx + r, y0), (cx + r, y0 + h * 0.7), (cx, y0 + h), (cx - r, y0 + h * 0.7)]
    pts = S.rotate(pts, cx, y0, lean)
    pts = [(u, max(float(y0), v)) for u, v in pts]
    g.prism("z", pts, cz - r, cz + r, C("cyan", 5))
    m = g.solids[-1].mask(g.shape)
    X, Y, Z = idx(g)
    P.flat(g, m & (X + 0.5 < cx), "cyan", 6)
    P.outline(g, m, "cyan", 3, normal="z")
    return m


def crystal(phase: float) -> tuple[Grid, tuple]:
    """An orbiting magic crystal: a big cyan bipyramid (two octagonal
    pyramids, true slopes) with a lit side."""
    n = 16
    g = Grid(n, 30, n)
    c = n / 2
    ring = S.flat_ngon(c, c, 6.5, 6, FRONT)
    g.prism("y", [(c, c)] * 6, 1, 11, C("cyan", 5), top=ring)
    g.prism("y", ring, 11, 29, C("cyan", 5), top=[(c, c)] * 6)
    m = g.a > 0
    X, Y, Z = S.coords(g)
    S.paint_facets(g, g.solids, lambda gg, mm, fr: P.flat(gg, mm, "cyan", 6 if fr != "top" and fr[0][0] > 0 else 5))
    P.flat(g, m & S.seams(g, g.solids, 0.8), "cyan", 7)
    P.flat(g, m & (Y > 9) & (Y < 13), "plasma", 6)
    cx = CX + ORBIT_R * math.cos(phase)
    cz = CZ + ORBIT_R * math.sin(phase)
    o = (round(cx - c), ORBIT_Y - 14, round(cz - c))
    return g, o


def build() -> Asset:
    g = tower()
    root = Part("wizard-tower", g)
    hub = (CX, ORBIT_Y, CZ)
    orbit = root.add(Part("orbit", None, pivot=(0.0, 0.0, 0.0), at=hub))
    for name, phase in (("crystal-a", 0.4), ("crystal-b", 0.4 + math.pi)):
        cg, o = crystal(phase)
        # the crystal sits on the model grid; its pivot is the orbit hub (in its own grid voxels)
        orbit.add(Part(name, cg, pivot=(hub[0] - o[0], hub[1] - o[1], hub[2] - o[2]), at=(0.0, 0.0, 0.0)))
    tip = HAT[-1]
    idle = {"orbit": {"rot": turn(5.0, "y", 72)}}
    return Asset(id="fantasy-buildings-wizard-tower", pack="fantasy", category="buildings", name="Wizard Tower", root=root,
                 clips=[Clip("idle", idle)], sockets=[Socket("socket-spire", at=(CX + tip[0], tip[3] + 1, CZ + tip[1]))],
                 pfx=[{"effectId": "rvx-fantasy-arcane-orbit", "socket": "socket-spire", "trigger": "idle", "size": 44}])
