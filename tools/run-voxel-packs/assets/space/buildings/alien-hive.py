"""Alien hive, in the Pirate Nation style (the space pack's alien motif).

One iconic shape in three colours (violet resin, bone and toxic glow): a
giant onion-shaped pod of violet resin, ribbed with bone, swells up from a
creep of moss and narrows to a leaning neck (stacked 10-sided frustums,
true slopes). Its front is a huge fanged mouth door: a glowing toxic membrane
inside a bone jaw with fangs and two curved tusks. Three curved horn spires of different
heights lean out of the pod (true slopes). Clusters of big glowing eggs
sit in resin cups at its feet, so it reads as the place the xenos breed.
The function prop is oversized: a glowing toxic heart bulb on the crown
that pulses on `idle` and spits goo (socket-spores). Detail is painted.
Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _bld import coords, facet_paint
from voxgrid import C, Asset, Clip, Grid, Part, Socket

W, H, D = 136, 110, 136
CX, CZ = 68.0, 68.0
N = 10
# the pod: (y, flat radius, centre shift x, centre shift z), bottom to top
POD = [(0, 40, 0, 0), (12, 45, 0, 0), (30, 46, 0, 0), (50, 39, 1, 1), (66, 27, 3, 2), (80, 15, 5, 3), (90, 10, 6, 3)]
TOP = (CX + 6, 90, CZ + 3)  # crown (x, y, z)
FRONT = CZ - 46  # the front of the pod at its widest


def ring(r: float, dx: float = 0.0, dz: float = 0.0):
    return S.flat_ngon(CX + dx, CZ + dz, r, N, -math.pi / 2)


def resin(base: int = 4, seed: int = 0):
    """Facet painter: violet resin with soft blotches and fine vertical grain."""
    def paint(gg, mm, fr):
        U, V = P.uv(gg, fr)
        P.mottle(gg, mm, "purple", base, cell=4, seed=seed)
        P.flat(gg, mm & (U % 9 == 4) & (V % 4 != 0), "purple", base - 1)
    return paint


def pod(g: Grid) -> np.ndarray:
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    for (y0, r0, x0, z0), (y1, r1, x1, z1) in zip(POD, POD[1:]):
        g.prism("y", ring(r0, x0, z0), max(1, y0), y1, C("purple", 4), top=ring(r1, x1, z1))
    solids = g.solids[n0:]
    facet_paint(g, solids, resin(4, seed=2))
    for ys, sh in ((34, 5), (58, 5)):
        mm = np.logical_or.reduce([sd.mask(g.shape) for sd in solids]) & (Y >= ys)
        P.mottle(g, mm, "purple", sh, cell=4, seed=ys)
    m = np.logical_or.reduce([s.mask(g.shape) for s in solids])
    # bone ribs up every corner of the pod (a ribcage)
    shift_x = np.interp(Y, [p[0] for p in POD], [p[2] for p in POD])
    shift_z = np.interp(Y, [p[0] for p in POD], [p[3] for p in POD])
    ang = np.arctan2(Z - CZ - shift_z, X - CX - shift_x)
    a0 = -math.pi / 2 + math.pi / N
    step = 2 * math.pi / N
    off = np.abs(((ang - a0 + step / 2) % step) - step / 2)
    rad = np.hypot(X - CX - shift_x, Z - CZ - shift_z)
    corner_k = np.round((ang - a0) / step).astype(int) % N
    rib = m & (off * rad < 2.4) & (corner_k % 2 == 0)
    P.flat(g, rib, "bone", 5)
    P.flat(g, rib & (off * rad < 1.0), "bone", 6)
    # a darker band where the pod meets the ground and a lit crown
    P.flat(g, m & (Y < 5) & ~rib, "purple", 3)
    P.flat(g, m & (Y > 70) & ~rib, "purple", 5)
    # glowing veins running up from the ground between the ribs
    vein = m & ~rib & (np.abs(np.sin(ang * N + Y * 0.11 + np.sin(Y * 0.2) * 0.6)) < 0.09) & (Y < 50) & (Y > 3)
    P.flat(g, vein, "toxic", 5)
    return m


def mouth(g: Grid, m: np.ndarray) -> np.ndarray:
    """The mouth door and the eye windows on the front of the pod."""
    X, Y, Z = coords(g)
    face = m & (Z < CZ - 20)
    # the throat: a glowing membrane plug in a tall arch, bright at its heart
    arch_pts = [(CX - 18, 1), (CX + 18, 1), (CX + 18, 26), (CX + 12, 39), (CX, 44), (CX - 12, 39), (CX - 18, 26)]
    g.prism("z", arch_pts, FRONT, FRONT + 14, C("toxic", 5))
    plug = S.last(g)
    q = np.hypot((X - CX) / 16, (Y - 8) / 34)
    P.flat(g, plug, "toxic", 4)
    P.flat(g, plug & (q < 0.85), "toxic", 5)
    P.flat(g, plug & (q < 0.6), "toxic", 6)
    P.flat(g, plug & (q < 0.35), "toxic", 7)
    P.flat(g, plug & (np.abs(X - CX) < 0.8) & (Y > 3), "toxic", 4)  # the slit where it opens
    # a bone jaw around it: lip bars (true slopes) and fangs pointing in
    jaw = [(CX - 22, 1), (CX - 22, 27), (CX - 15, 42), (CX, 48), (CX + 15, 42), (CX + 22, 27), (CX + 22, 1)]
    lip = np.zeros(g.shape, dtype=bool)
    for p0, p1 in zip(jaw, jaw[1:]):
        lip |= S.bar(g, "z", p0, p1, 6, FRONT - 3, FRONT + 12, "bone", 6)
    P.flat(g, lip, "bone", 6)
    P.flat(g, lip & (Z < FRONT - 1.5), "bone", 7)
    fangs = np.zeros(g.shape, dtype=bool)
    for (x, y, dx, dy, ln) in ((CX - 9, 42, 0.3, -1, 10), (CX + 9, 42, -0.3, -1, 10), (CX, 45, 0, -1, 7),
                               (CX - 18, 30, 1, -0.4, 8), (CX + 18, 30, -1, -0.4, 8), (CX - 19, 14, 1, 0.1, 7), (CX + 19, 14, -1, 0.1, 7)):
        n = math.hypot(dx, dy)
        ux, uy = dx / n, dy / n
        tri = [(x - uy * 2.8, y + ux * 2.8), (x + uy * 2.8, y - ux * 2.8), (x + ux * ln, y + uy * ln)]
        fangs |= _tri(g, tri, FRONT - 1, FRONT + 3)
    P.flat(g, fangs, "bone", 7)
    # two curved tusks flanking the door
    for s in (-1, 1):
        t = S.bar(g, "z", (CX + s * 24, 2), (CX + s * 31, 20), 6, FRONT + 1, FRONT + 7, "bone", 6)
        t |= S.bar(g, "z", (CX + s * 31, 20), (CX + s * 29, 34), 4, FRONT + 2, FRONT + 6, "bone", 6)
        t |= _tri(g, [(CX + s * 27, 33), (CX + s * 31, 33), (CX + s * 25, 42)], FRONT + 2.5, FRONT + 5.5, "bone", 7)
        P.flat(g, t & (Y < 6), "bone", 4)
    return lip | fangs


def _tri(g: Grid, pts, z0, z1, ramp: str = "bone", shade: int = 7) -> np.ndarray:
    g.prism("z", pts, z0, z1, C(ramp, shade))
    return S.last(g)


def spires(g: Grid) -> None:
    """Three curved horn spires leaning out of the pod (three frustums each,
    the centres shifting outward, so every face is a true slope)."""
    X, Y, Z = coords(g)
    for (cx, cz, r, h, ox, oz, y0) in ((30, 88, 13, 104, -14, 12, 20), (106, 76, 11, 84, 14, 6, 16), (40, 42, 9, 66, -12, -10, 20)):
        n0 = len(g.solids)
        stages = [(y0, r, 0, 0), (y0 + (h - y0) * 0.45, r * 0.7, ox * 0.25, oz * 0.25), (y0 + (h - y0) * 0.8, r * 0.38, ox * 0.7, oz * 0.7), (h, 0.0, ox, oz)]
        for (ya, ra, xa, za), (yb, rb, xb, zb) in zip(stages, stages[1:]):
            top = S.flat_ngon(cx + xb, cz + zb, rb, 6) if rb > 0 else [(cx + xb, cz + zb)] * 6
            g.prism("y", S.flat_ngon(cx + xa, cz + za, ra, 6), round(ya), round(yb), C("purple", 4), top=top)
        facet_paint(g, g.solids[n0:], resin(4, seed=cx))
        m = np.logical_or.reduce([s.mask(g.shape) for s in g.solids[n0:]])
        P.flat(g, m & S.seams(g, g.solids[n0:], 0.8), "purple", 3)
        ht = y0 + (h - y0) * np.array([0.3, 0.55, 0.72])
        for yy in ht:
            P.flat(g, m & (np.abs(Y - yy) < 1.1), "bone", 5)  # bone rings
        P.flat(g, m & (Y > y0 + (h - y0) * 0.8), "bone", 6)
        P.flat(g, m & (Y > y0 + (h - y0) * 0.92), "bone", 7)


def eggs(g: Grid) -> None:
    X, Y, Z = coords(g)
    for (cx, cz, r) in ((22, 26, 7), (32, 16, 6), (14, 38, 5.5), (108, 22, 7.5), (118, 34, 6), (98, 12, 5), (112, 104, 7), (20, 110, 6)):
        cup = S.cone(g, "y", cx, cz, r + 2.5, 0, 3, "purple", 3, n=8, r_top=r + 1)
        P.flat(g, cup, "purple", 3)
        P.flat(g, cup & (Y > 2), "purple", 5)
        e = S.cone(g, "y", cx, cz, r, 2, 2 + r * 0.9, "toxic", 5, n=8, r_top=r * 0.72, tip="lo")
        e |= S.cone(g, "y", cx, cz, r, 2 + r * 0.9, 2 + r * 2.3, "toxic", 5, n=8, r_top=r * 0.35)
        P.flat(g, e, "toxic", 5)
        P.flat(g, e & (X < cx - r * 0.1), "toxic", 6)
        P.flat(g, e & (Y > 2 + r * 1.4) & (X < cx) & (Z < cz), "toxic", 7)
        P.flat(g, e & (np.abs(Y - 2 - r * 1.1) < 0.7), "toxic", 3)


def body() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    creep = S.disc(g, "y", CX, CZ, 64, 0, 2, "moss", 4, n=12)
    P.mottle(g, creep, "moss", 4, cell=4, seed=1)
    rr = np.hypot(X - CX, Z - CZ)
    P.flat(g, creep & (np.abs(np.sin(np.arctan2(Z - CZ, X - CX) * 7 + rr * 0.15)) < 0.12) & (rr > 46), "toxic", 5)
    P.flat(g, creep & (rr > 60), "moss", 3)
    m = pod(g)
    mouth(g, m)
    spires(g)
    eggs(g)
    blisters(g)
    return g


def blisters(g: Grid) -> None:
    """Glowing egg sacs bulging out of the pod walls (half buried)."""
    X, Y, Z = coords(g)
    for deg, y0, r, h in ((200, 26, 11, 26), (340, 30, 10, 24), (95, 34, 12, 26), (250, 50, 8, 18)):
        a = math.radians(deg)
        rad = float(np.interp(y0 + h / 2, [p[0] for p in POD], [p[1] for p in POD])) - 2
        cx, cz = CX + rad * math.cos(a), CZ + rad * math.sin(a)
        e = S.cone(g, "y", cx, cz, r, y0, y0 + h * 0.45, "toxic", 5, n=8, r_top=r * 0.55, tip="lo")
        e |= S.cone(g, "y", cx, cz, r, y0 + h * 0.45, y0 + h, "toxic", 5, n=8, r_top=r * 0.4)
        P.mottle(g, e, "toxic", 5, cell=3, seed=deg)
        P.flat(g, e & (Y > y0 + h * 0.7), "toxic", 7)
        ang = np.degrees(np.arctan2(Z - cz, X - cx))
        P.flat(g, e & (np.abs(((ang + 360) % 60) - 30 - (Y - y0) * 1.2) < 1.3), "purple", 3)
        P.flat(g, e & (Y < y0 + 1.5), "purple", 3)


def heart() -> Grid:
    """The pulsing heart bulb: faceted toxic frustums with violet veins."""
    g = Grid(44, 40, 44)
    X, Y, Z = coords(g)
    c = 22
    n0 = len(g.solids)
    lo = S.cone(g, "y", c, c, 20, 0, 13, "toxic", 5, n=8, r_top=12, tip="lo")
    lo |= S.cone(g, "y", c, c, 20, 13, 31, "toxic", 5, n=8, r_top=6)
    facet_paint(g, g.solids[n0:], lambda gg, mm, fr: P.mottle(gg, mm, "toxic", 5, cell=3, seed=5))
    ang = np.degrees(np.arctan2(Z - c, X - c))
    vein = lo & (np.abs(((ang + 360) % 45) - 22.5 - (Y - 8) * 1.5) < 1.6)
    P.flat(g, vein, "purple", 3)
    P.flat(g, lo & (Y > 26), "toxic", 7)
    P.flat(g, lo & (Y < 2), "purple", 4)
    tip = S.cone(g, "y", c, c, 6, 31, 39, "bone", 6, n=8, r_top=1.5)
    P.flat(g, tip & (Y > 35), "bone", 7)
    return g


def pulse():
    keys = []
    for i in range(9):
        t = i * 1.4 / 8
        s = 1.0 + 0.14 * (0.5 - 0.5 * math.cos(2 * math.pi * i / 8)) * (1 if i % 4 != 3 else 0.6)
        keys.append((t, (s, s * 0.95 + 0.05, s)))
    return keys


def build() -> Asset:
    g = body()
    root = Part("alien-hive", g)
    root.add(Part("heart", heart(), pivot=(22.0, 0.0, 22.0), at=(TOP[0], TOP[1] - 3, TOP[2])))
    return Asset(
        id="space-buildings-alien-hive", pack="space", category="buildings", name="Alien Hive", root=root,
        clips=[Clip("idle", {"heart": {"scale": pulse()}})],
        sockets=[Socket("socket-spores", at=(TOP[0], TOP[1] + 37, TOP[2]))],
        pfx=[{"effectId": "rvx-space-spore-drift", "socket": "socket-spores", "trigger": "idle", "size": 60}],
    )
