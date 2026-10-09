"""Witch cauldron, in the Pirate Nation haunted style.

One iconic shape (rule K3): a pot-bellied iron cauldron of stacked
octagonal frustums (true slopes) with riveted bands, a bone skull on its
belly, a thick octagonal rim and two lugs, full of glowing toxic brew. It
stands on four stubby legs over a fire of two crossed logs with licking
flames (the shared PN flame) round its belly. A big wooden ladle sticks out of the brew and
stirs round; chunky toxic bubbles rise, swell and pop. Iron is mid grey
(rule C2); rivets, grain and swirls are paint (rule S1).

Parts: cauldron (root), ladle (stirs round the pot axis), bubble-0 ..
bubble-3 (rise, swell and pop by scale and loc). Clip idle loops. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _kit import pfx, turn, world
from _life import bark
from _pn import assemble, coords, last
from _props import pn_flame
from pnkit import box
from voxgrid import C, Clip, Grid, Socket

SIZE = (36, 40, 36)
CX = CZ = 18.0
BREW = 21  # the brew surface (y)
RIM_TOP = 24
DOWN = -math.pi / 2
SKULL = ["..#####..", ".#######.", "#########", "#oo###oo#", "#oo###oo#", "####.####", ".#######.", "..#.#.#.."]
BUBBLES = [(-3.5, -2.5, 0.0), (3.0, 1.5, 0.3), (-1.0, 4.0, 0.55), (4.0, -3.5, 0.8)]  # (dx, dz, phase)


def grab(g: Grid, start: int):
    return g.solids[start:]


def qc(p0, p1, r0, r1, cap=0.0):
    """S.quad, clamped to the grid floor."""
    return [(u, max(0.0, v)) for u, v in S.quad(p0, p1, r0, r1, cap=cap)]


def qc_x(p0, p1, r0, r1, cap=0.0):
    """S.quad in the (y, z) plane, clamped to the grid floor."""
    return [(max(0.0, u), v) for u, v in S.quad(p0, p1, r0, r1, cap=cap)]


def ring(n: int = 8):
    return lambda r: S.flat_ngon(CX, CZ, r, n, DOWN)


def cauldron() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = coords(g)
    o = ring()
    # the fire: two crossed logs lying on the diagonals, shared PN flames
    s0 = len(g.solids)
    for a in (math.pi / 4, 3 * math.pi / 4):
        d = (math.cos(a), math.sin(a))
        n = (-d[1] * 1.8, d[0] * 1.8)
        L = 15.5
        pts = [(CX - d[0] * L + n[0], CZ - d[1] * L + n[1]), (CX + d[0] * L + n[0], CZ + d[1] * L + n[1]),
               (CX + d[0] * L - n[0], CZ + d[1] * L - n[1]), (CX - d[0] * L - n[0], CZ - d[1] * L - n[1])]
        g.prism("y", pts, 0, 3.5 if a < 1 else 3.0, C("wood", 5))
    logs = grab(g, s0)
    S.paint_facets(g, logs, lambda gg, m, fr: bark(gg, m, "wood", 5, frame=fr, seed=1))
    logm = np.logical_or.reduce([sd.mask(g.shape) for sd in logs])
    rad = np.hypot(X + 0.5 - CX, Z + 0.5 - CZ)
    P.flat(g, logm & (rad > L - 1.6), "sand", 5)  # cut ends
    P.flat(g, logm & (rad > L - 0.8), "sand", 6)
    P.flat(g, logm & (rad < 6) & (Y == 2), "rust", 3)  # charred middle
    for k, (ang, h) in enumerate(((22.5, 9.0), (112.5, 10.5), (202.5, 8.0), (292.5, 10.0), (157.5, 7.0), (337.5, 7.5))):
        a = math.radians(ang)
        rr = 11.5 if k < 4 else 10.0
        pn_flame(g, CX + rr * math.cos(a), CZ + rr * math.sin(a), 1.0, 7.0 if k < 4 else 5.0, h + 2.5, kind="big" if k < 4 else "small",
                 axis="x" if abs(math.cos(a)) > 0.6 else "z")
    # four stubby legs (true slopes) on the axes
    s1 = len(g.solids)
    for sgn in (-1, 1):
        g.prism("z", qc((CX + sgn * 6.5, 6.0), (CX + sgn * 9.5, 0.6), 1.8, 1.5, cap=0.3), CZ - 1.5, CZ + 1.5, C("gray", 4))
        g.prism("x", qc_x((6.0, CZ + sgn * 6.5), (0.6, CZ + sgn * 9.5), 1.8, 1.5, cap=0.3), CX - 1.5, CX + 1.5, C("gray", 4))
    legm = np.logical_or.reduce([sd.mask(g.shape) for sd in grab(g, s1)])
    P.flat(g, legm, "gray", 4)
    P.flat(g, legm & (Y < 2), "gray", 3)
    # the pot: stacked octagonal frustums
    s2 = len(g.solids)
    g.prism("y", o(6.5), 4, 9, C("gray", 4), top=o(12.0))
    g.prism("y", o(12.0), 9, 17, C("gray", 4))
    g.prism("y", o(12.0), 17, BREW, C("gray", 4), top=o(9.5))
    pot = grab(g, s2)
    potm = np.logical_or.reduce([sd.mask(g.shape) for sd in pot])
    P.mottle(g, potm, "gray", 4, cell=3, seed=3)
    ang = np.arctan2(Z + 0.5 - CZ, X + 0.5 - CX)
    dr = S.ngon_radius(g, "y", CX, CZ)
    for by in (9, 16):  # riveted bands
        band = potm & (Y == by)
        P.flat(g, band, "gray", 3)
        P.flat(g, band & (np.cos(ang * 16) > 0.93), "gray", 6)
    P.flat(g, potm & S.seams(g, pot, 0.7) & (Y > 9) & (Y < 16), "gray", 5)  # lit facet edges
    P.flat(g, potm & (Y >= 17) & (Y < BREW - 1), "gray", 5)  # the lit shoulder
    P.flat(g, potm & (Y < 6), "rust", 3)  # soot and heat
    # a bone skull on the front facet, with glowing eyes
    pnglyph.stamp(g, "-z", CZ - 12.0, int(CX) - 4, 8 + 1, SKULL, {"#": C("bone", 7), "o": C("toxic", 6)}, depth=2)
    # the brew: glowing toxic, painted swirls
    brew = potm & (Y == BREW - 1) & (dr < 9.5)
    P.flat(g, brew, "toxic", 5)
    swirl = np.sin(ang * 2 + rad * 0.9)
    P.flat(g, brew & (swirl > 0.6), "toxic", 6)
    P.flat(g, brew & (swirl < -0.8), "toxic", 4)
    P.flat(g, brew & (rad < 1.6), "toxic", 7)
    # the thick rim: eight faceted segments, lit on top
    s3 = len(g.solids)
    outer, inner = o(11.2), o(8.0)
    for k in range(8):
        g.prism("y", [outer[k], outer[(k + 1) % 8], inner[(k + 1) % 8], inner[k]], BREW, RIM_TOP, C("gray", 5))
    rimm = np.logical_or.reduce([sd.mask(g.shape) for sd in grab(g, s3)])
    P.flat(g, rimm & (Y == RIM_TOP - 1), "gray", 6)
    P.flat(g, rimm & (Y == BREW), "gray", 4)
    P.flat(g, rimm & (Y == RIM_TOP - 1) & (dr < 8.9), "toxic", 6)  # brew light on the inner lip
    # two lugs on the sides, with a painted eye
    for sgn in (-1, 1):
        x0 = int(CX + sgn * 11.5) - (3 if sgn < 0 else 0)
        lug = box(g, x0, BREW - 1, int(CZ) - 2, x0 + 3, RIM_TOP, int(CZ) + 2, "gray", 5)
        P.flat(g, lug & (Z >= int(CZ) - 1) & (Z < int(CZ) + 1) & (Y >= BREW) & (Y < RIM_TOP - 1), "gray", 2)
    return g


def ladle() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = coords(g)
    p0, p1 = (CX + 2.5, BREW - 3.0), (CX + 10.0, 35.0)
    g.prism("z", S.quad(p0, p1, 1.3, 1.1), CZ - 1.2, CZ + 1.2, C("wood", 6))
    h = last(g)
    S.paint_facets(g, [g.solids[-1]], lambda gg, m, fr: P.planks(gg, m, "wood", 6, width=3, across="x", nails=False, frame=fr, seed=2))
    P.flat(g, h & (Y >= 29) & (Y < 31), "purple", 4)  # a cloth grip
    P.flat(g, h & (Y >= BREW - 2) & (Y < BREW + 2), "toxic", 4)  # brew stain
    knob = S.disc(g, "y", p1[0] + 0.3, CZ, 1.8, 35.0, 37.0, "wood", 6)
    P.flat(g, knob & (Y == 36), "wood", 7)
    return g


def bubble(k: int) -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = coords(g)
    dx, dz, _ph = BUBBLES[k]
    bx, bz = CX + dx, CZ + dz
    r = 2.2 if k % 2 == 0 else 1.7
    octa = lambda rr: S.flat_ngon(bx, bz, rr, 8, DOWN)  # noqa: E731
    s0 = len(g.solids)
    g.prism("y", octa(r * 0.5), BREW, BREW + 0.6 * r, C("toxic", 6), top=octa(r))
    g.prism("y", octa(r), BREW + 0.6 * r, BREW + 1.4 * r, C("toxic", 6))
    g.prism("y", octa(r), BREW + 1.4 * r, BREW + 2 * r, C("toxic", 6), top=octa(r * 0.5))
    m = np.logical_or.reduce([sd.mask(g.shape) for sd in grab(g, s0)])
    P.flat(g, m & (Y >= BREW + 1.4 * r), "toxic", 7)
    return g


def bubble_keys(phase: float, period: float = 2.4, steps: int = 24):
    """Rise, swell and pop, then rest hidden in the brew (loops cleanly)."""
    def state(u: float):
        if u < 0.15:
            return 0.05, 0.0
        if u < 0.6:
            t = (u - 0.15) / 0.45
            return 0.05 + 0.95 * t, 1.2 * t
        if u < 0.8:
            t = (u - 0.6) / 0.2
            return 1.0 + 0.4 * t, 1.2 + 1.0 * t
        if u < 0.86:
            t = (u - 0.8) / 0.06
            return 1.4 - 1.35 * t, 2.2 + 0.4 * t
        return 0.05, 0.0

    scale, loc = [], []
    for i in range(steps + 1):
        s, y = state(((i / steps) + phase) % 1.0)
        t = period * i / steps
        scale.append((t, (s, s, s)))
        loc.append((t, (0.0, y, 0.0)))
    return {"scale": scale, "loc": loc}


def build():
    parts = {"cauldron": cauldron(), "ladle": ladle()}
    joints = [("cauldron", None, (CX, 0.0, CZ)), ("ladle", "cauldron", (CX, float(BREW), CZ))]
    for k, (dx, dz, _ph) in enumerate(BUBBLES):
        parts[f"bubble-{k}"] = bubble(k)
        joints.append((f"bubble-{k}", "cauldron", (CX + dx, float(BREW), CZ + dz)))
    root = assemble(parts, joints)
    idle = {"ladle": {"rot": turn(4.8, "y", 75.0)}}
    for k, (_dx, _dz, ph) in enumerate(BUBBLES):
        idle[f"bubble-{k}"] = bubble_keys(ph)
    return world("witch-cauldron", "animated-props", "Witch Cauldron", root,
                 clips=[Clip("idle", idle)],
                 sockets=[Socket("socket-brew", at=(0.0, float(BREW), 0.0))],
                 pfx=[pfx("rvx-monster-witch-brew", "socket-brew", "idle", size=26)])
