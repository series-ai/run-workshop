"""Crystal cluster, in the Pirate Nation terrain style.

A claimed crystal deposit on a pale moon-dust pad. Oversized hexagonal
crystals, violet and glowing cyan, grow out of a bed of chunky blue-grey
rocks: each crystal is a tapered hex prism with a pointed tip (true
slopes), set at its own tilt (rest rotations), with its base buried in a
rock so nothing floats. Each facet is painted like a PN gem: a dark edge
frame, a bright highlight stripe, stepped growth lines and a lit upper
end. A survey stake with a hazard-orange flag and a cyan lamp is driven
into a boulder, and a steel sample case sits on the pad, so the piece
belongs to the space set. No clips. Faces -Z.
"""
import math

import numpy as np

import pnpaint
from _life import P, Grid, Rig, asset, coords, facet_paint, light_top, mask_of, ngon_y, rock
from pnkit import box, edges
from pnshapes import bar, flat_ngon, ngon_radius, seams
from voxgrid import C

S = (64, 60, 64)
CX, CZ = 32, 32
PAD = 2  # pad top
# rocks: (dx, dz, flat radius, height, seed)
ROCKS = [(0, 1, 14.0, 10, 5), (-13, 7, 7.5, 9, 11), (13, 9, 6.5, 8, 12), (9, -12, 7.0, 8, 13),
         (-11, -10, 5.5, 7, 14), (17, -2, 4.5, 6, 15), (-4, -14, 4.0, 5, 16)]
# crystals: (dx, dz, radius, body height, tilt about x, tilt about z, glow?, base y)
CRYSTALS = [
    (0, 2, 7.0, 30, -5, -4, False, 6),
    (9, -3, 5.0, 19, -12, -22, True, 5),
    (-9, -2, 5.2, 21, -10, 22, False, 5),
    (5, 9, 4.4, 15, 20, -14, True, 5),
    (-6, 9, 4.0, 13, 18, 18, False, 5),
    (-13, 7, 3.2, 10, 8, 32, True, 5),
    (13, 9, 3.0, 8, 14, -30, False, 4),
    (9, -12, 3.4, 10, -26, -10, True, 4),
    (1, -9, 3.6, 11, -28, 4, False, 5),
    (-11, -10, 2.4, 7, -20, 25, True, 3),
    (17, -2, 2.2, 6, 0, -40, False, 2),
]
STAKE = (CX + 14.5, CZ + 9)  # survey stake foot (x, z), in the right boulder


def pad(g: Grid) -> None:
    X, Y, Z = coords(g)
    m = ngon_y(g, CX, CZ, 28, 0, PAD, "sand", 5, n=10, r_top=26.5)
    rr = np.hypot(X - CX, Z - CZ)
    ang = np.arctan2(Z - CZ, X - CX)
    P.flat(g, m, "sand", 6)
    P.flat(g, m & (Y < 1), "sand", 4)                       # dark lower edge
    P.flat(g, m & (Y >= 1) & (ngon_radius(g, "y", CX, CZ, 10) > 25.6), "sand", 5)
    rays = m & (Y >= 1) & (rr > 15) & (rr < 25) & (np.abs(((ang / (2 * math.pi) * 9 + 0.15) % 1) - 0.5) < 0.07)
    P.flat(g, rays, "sand", 7)
    P.flat(g, m & (Y >= 1) & (rr < 17), "sand", 5)          # dust shadow under the rocks
    # a few pebbles seated in the dust
    for k, (px, pz, pr) in enumerate(((CX - 21, CZ + 4, 2.6), (CX + 6, CZ - 21, 2.4), (CX - 4, CZ + 21, 2.8), (CX + 22, CZ + 12, 2.3), (CX - 17, CZ - 16, 2.2))):
        p = mask_of(g, rock(g, px, pz, 1, pr, 3, "stone", 4, n=5, seed=40 + k))
        P.flat(g, p, "stone", 4)
        light_top(g, p, "stone", 5)


def rock_paint(g: Grid, solids, seed: int) -> np.ndarray:
    """Blue-grey rock: lit tops, dark edge lines between facets, sparse grain."""
    m = mask_of(g, solids)
    P.flat(g, m, "stone", 3)
    light_top(g, m, "stone", 4)
    X, Y, Z = coords(g)
    P.flat(g, m & seams(g, solids, 0.5) & ~light_mask(g, m), "stone", 2)
    P.flat(g, m & (Y < 2), "stone", 2)
    return m


def light_mask(g: Grid, m: np.ndarray) -> np.ndarray:
    """Voxels of `m` with open air above them (the lit tops)."""
    up = np.zeros_like(m)
    up[:, :-1, :] = m[:, :-1, :] & (g.a[:, 1:, :] == 0)
    return up


def bed(g: Grid) -> None:
    for (dx, dz, r, h, seed) in ROCKS:
        solids = rock(g, CX + dx, CZ + dz, 1, r, h, "stone", 4, n=7, seed=seed, squash=0.9)
        rock_paint(g, solids, seed)


def stake(g: Grid) -> None:
    """Survey stake: a steel pole with a copper clamp, a hazard flag and a lamp."""
    X, Y, Z = coords(g)
    sx, sz = STAKE
    top = 30
    bar(g, "z", (sx, 2), (sx + 2.5, top), 1.8, sz - 0.9, sz + 0.9, "steel", 4)
    pole = g.solids[-1].mask(g.shape)
    P.flat(g, pole, "steel", 5)
    P.flat(g, pole & (np.floor(Y) % 6 == 0), "steel", 3)
    g.prism("y", flat_ngon(sx + 0.5, sz, 1.6, 6), 6, 8, C("rust", 4))   # copper clamp ring
    clamp = g.solids[-1].mask(g.shape)
    P.flat(g, clamp, "rust", 4)
    P.flat(g, clamp & (Y > 7), "rust", 5)
    # the flag: a hazard-striped pennant with a dark edge
    fx = sx + 2.4
    g.prism("z", [(fx, top - 1.5), (fx + 10, top - 3.5), (fx + 10, top - 8.5), (fx, top - 9.5)], sz - 0.5, sz + 0.5, C("orange", 4))
    flag = g.solids[-1].mask(g.shape)
    pnpaint.hazard(g, flag, period=4, a=("orange", 5), b=("steel", 2), frame="z")
    P.flat(g, flag & (X > fx + 9), "steel", 2)
    # the lamp on top
    g.prism("y", flat_ngon(sx + 2.5, sz, 1.4, 6), top - 0.5, top + 2, C("plasma", 6))
    lamp = g.solids[-1].mask(g.shape)
    P.flat(g, lamp, "plasma", 6)
    P.flat(g, lamp & (Y > top + 1), "plasma", 7)


def case(g: Grid) -> None:
    """A small steel sample case on the pad (white lid, orange band, cyan window)."""
    X, Y, Z = coords(g)
    x0, z0 = CX - 22, CZ - 9
    body = box(g, x0, PAD - 0.5, z0, x0 + 7, PAD + 4, z0 + 5, "steel", 4)
    P.plates(g, body, "steel", 4, size=(7, 5), rivets=False)
    P.flat(g, body & edges(body), "steel", 2)
    lid = box(g, x0 - 0.5, PAD + 4, z0 - 0.5, x0 + 7.5, PAD + 5.5, z0 + 5.5, "bone", 6)
    P.flat(g, lid, "bone", 6)
    P.flat(g, lid & (Y < PAD + 4.5), "bone", 4)
    P.flat(g, body & (np.abs(Y - (PAD + 2.5)) < 0.5), "orange", 4)
    P.flat(g, body & (Z < z0 + 0.5) & (np.abs(X - (x0 + 3.5)) < 1.2) & (np.abs(Y - (PAD + 2.5)) < 1.2), "plasma", 6)


def crystal(dx, dz, r, h, glow, by) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    cx, cz = CX + dx, CZ + dz
    ramp, edge = ("plasma", ("cyan", 2)) if glow else ("purple", ("purple", 2))
    base = 4
    n0 = len(g.solids)
    body = ngon_y(g, cx, cz, r, max(0.5, by - 3), by + h, ramp, base, n=6, r_top=r * 0.9)
    tip = ngon_y(g, cx, cz, r * 0.9, by + h, by + h + r * 1.7, ramp, base + 2, n=6, r_top=0)
    solids = g.solids[n0:]
    m = body | tip
    ang = (np.degrees(np.arctan2(Z - cz, X - cx)) + 120.0) % 360.0
    side = np.floor(ang / 60.0).astype(int) % 6        # 0 = the facet facing -Z
    t = (ang % 60.0) / 60.0                            # across the facet
    lit = (side == 0) | (side == 5)
    dark = (side == 2) | (side == 3)
    P.flat(g, m, ramp, base)
    P.flat(g, body & lit, ramp, base + 1)
    P.flat(g, body & dark, ramp, base - 1)
    P.flat(g, body & (Y > by + h * 0.6), ramp, base + 1)
    P.flat(g, body & (Y > by + h * 0.6) & lit, ramp, base + 2)
    # stepped growth lines (offset per facet, so they step round the crystal)
    step = 7 if r > 3 else 5
    grow = body & ((np.floor(Y - by) + side * 3) % step == 0) & (t > 0.36) & (t < 0.94) & (Y > by + 2) & (Y < by + h - 2)
    P.flat(g, grow, ramp, base - 1)
    # a bright highlight stripe up every facet, brightest on the lit ones
    P.flat(g, body & (t > 0.16) & (t < 0.3) & (Y > by + 1), ramp, base + 2)
    P.flat(g, body & lit & (t > 0.16) & (t < 0.3) & (Y > by + 1), ramp, 7)
    # the tip: pale, lit facets brightest
    P.flat(g, tip, ramp, base + 2)
    P.flat(g, tip & lit, ramp, 7)
    P.flat(g, tip & dark, ramp, base + 1)
    # dark frame on the body edges and where the tip meets the body (rule S4)
    P.flat(g, body & seams(g, solids[:1], 0.8) & (Y < by + h - 0.5), *edge)
    P.flat(g, body & (Y > by + h - 1), *edge)
    return g


def build():
    g = Grid(*S)
    pad(g)
    bed(g)
    stake(g)
    case(g)
    rig = Rig()
    rig.add("crystal-cluster", g, (CX, 0, CZ))
    for k, (dx, dz, r, h, tx, tz, glow, by) in enumerate(CRYSTALS):
        rig.add(f"crystal-{k}", crystal(dx, dz, r, h, glow, by), (CX + dx, by, CZ + dz), "crystal-cluster", rot=(tx, 0.0, tz))
    return asset("terrain-nature", "crystal-cluster", "Crystal Cluster", rig.root)
