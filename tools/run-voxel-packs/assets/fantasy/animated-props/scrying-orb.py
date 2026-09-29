"""Scrying orb in the Pirate Nation style.

One iconic shape (rule K3): an oversized faceted crystal ball with a
painted eye, held by four gold claws in a gold cup on a chunky carved
wooden column and a stone foot. Two gold astrolabe hoops with cyan rune
studs circle the orb at a tilt. On `idle` the eye looks left and right and
the hoops turn; on `active` the orb spins and swells and the hoops whirl.
Magic cyan and royal blue mark the magic (C3). About 30 wide and 36 tall
(PN small props are one tile; this is an oversized one). Faces -Z.
"""
import math

import numpy as np

import paint as P
from _life import asset, coords, facet_paint, keys, pfx, plan, rig
from pnglyph import stamp
from pnshapes import flat_ngon, quad, seams
from voxgrid import C, Clip, Grid, Socket, turn

S = (32, 40, 32)
CX = CZ = 16.0
OY = 26.0  # orb centre height
R = 8.0  # orb flat radius
HOOPS = {"ring-a": (14.0, (42.0, 0.0, 0.0)), "ring-b": (11.5, (-30.0, 0.0, 0.0))}  # radius, rest tilt


def ball(g: Grid, cx, cy, cz, r, lats=(-90, -58, -22, 22, 58, 90), n: int = 8, ramp: str = "cyan", shade: int = 5):
    """A faceted ball: n-gon frustums between latitudes (degrees), a flat
    side to the front; the band across the equator is upright so a glyph
    can be painted on it. Returns (mask, solids)."""
    start = len(g.solids)
    m = np.zeros(g.shape, dtype=bool)

    def ring(lat):
        rr = r * math.cos(math.radians(lat))
        return flat_ngon(cx, cz, rr, n) if rr > 1e-3 else [(cx, cz)] * n

    for a, b in zip(lats, lats[1:]):
        m |= plan(g, ring(a), cy + r * math.sin(math.radians(a)), cy + r * math.sin(math.radians(b)), ramp, shade, top=ring(b))
    return m, g.solids[start:]


def hoop(g: Grid, cx, cy, cz, r, w: float = 2.0, t: float = 2.0, n: int = 12):
    """A flat ring of n trapezoid segments in the xz plane (outer radius r,
    width w, thickness t). Returns (mask, solids)."""
    start = len(g.solids)
    m = np.zeros(g.shape, dtype=bool)
    for k in range(n):
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
        pts = [(cx + r * math.cos(a0), cz + r * math.sin(a0)), (cx + r * math.cos(a1), cz + r * math.sin(a1)),
               (cx + (r - w) * math.cos(a1), cz + (r - w) * math.sin(a1)), (cx + (r - w) * math.cos(a0), cz + (r - w) * math.sin(a0))]
        m |= plan(g, pts, cy - t / 2, cy + t / 2, "gold", 5)
    return m, g.solids[start:]


def stand() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    ang = np.arctan2(Z - CZ, X - CX)
    # stone foot (a low octagon frustum) with cyan rune studs on its top
    foot = plan(g, flat_ngon(CX, CZ, 9.0, 8), 0, 3, "stone", 5, top=flat_ngon(CX, CZ, 8.0, 8))
    facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(5, 3), frame=fr, seed=2))
    P.flat(g, foot & (Y < 1), "stone", 3)
    rr = np.hypot(X - CX, Z - CZ)
    stud = foot & (Y > 2) & (np.abs(rr - 6.8) < 0.9) & ((np.floor((ang + math.pi) / (math.pi / 4) + 0.5) % 2) == 0) & (np.abs(((ang + math.pi) / (math.pi / 4) + 0.5) % 1 - 0.5) < 0.22)
    P.flat(g, stud, "cyan", 6)
    # a dark wood collar with a gold rim
    collar = plan(g, flat_ngon(CX, CZ, 6.2, 8), 3, 5, "darkwood", 4, top=flat_ngon(CX, CZ, 5.4, 8))
    P.flat(g, collar & (Y > 4), "gold", 5)
    P.flat(g, collar & seams(g, [g.solids[-1]], 0.7) & (Y < 4), "darkwood", 3)
    # the column: two frustums (a carved baluster), vertical grain, a royal blue band
    start = len(g.solids)
    col = plan(g, flat_ngon(CX, CZ, 3.2, 8), 5, 10, "wood", 5, top=flat_ngon(CX, CZ, 4.2, 8))
    col |= plan(g, flat_ngon(CX, CZ, 4.2, 8), 10, 16, "wood", 5, top=flat_ngon(CX, CZ, 3.0, 8))
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.planks(gg, mm, "wood", 5, width=2, across="x", nails=False, frame=fr, seed=4))
    P.flat(g, col & seams(g, g.solids[start:], 0.6) & (Y > 5) & (Y < 16), "wood", 3)
    band = col & (Y > 9) & (Y < 12)
    P.flat(g, band, "blue", 4)
    P.flat(g, band & ((Y < 10) | (Y > 11)), "gold", 5)
    P.flat(g, band & (Y > 10) & (Y < 11) & ((np.floor((ang + math.pi) / (math.pi / 4)) % 2) == 0), "gold", 7)
    # the gold cup and four claws that grip the orb
    cup = plan(g, flat_ngon(CX, CZ, 3.0, 8), 16, 19, "gold", 5, top=flat_ngon(CX, CZ, 5.6, 8))
    facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.flat(gg, mm, "gold", 4 if fr == "top" else 5))
    P.flat(g, cup & (Y > 18), "gold", 6)
    P.flat(g, cup & seams(g, [g.solids[-1]], 0.6) & (Y < 18.5), "gold", 7)
    claws = np.zeros(S, dtype=bool)
    for s in (-1, 1):
        pts = quad((CX + s * 4.4, 17.5), (CX + s * 6.6, 23.2), 1.1, 0.8, cap=1.3)
        g.prism("z", pts, CZ - 1, CZ + 1, C("gold", 5))
        claws |= g.solids[-1].mask(S)
        pts = quad((17.5, CZ + s * 4.4), (23.2, CZ + s * 6.6), 1.1, 0.8, cap=1.3)
        g.prism("x", pts, CX - 1, CX + 1, C("gold", 5))
        claws |= g.solids[-1].mask(S)
    P.flat(g, claws & (Y > 21), "gold", 7)
    P.flat(g, claws & (Y < 19.5), "gold", 4)
    return g


def orb() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m, solids = ball(g, CX, OY, CZ, R, ramp="cyan", shade=5)
    # a swirl of mist: twisted sectors of ±1 shade, royal blue at the bottom, light at the top
    ang = np.arctan2(Z - CZ, X - CX)
    sector = np.floor((ang + (Y - OY) * 0.28) / (math.pi / 3)).astype(int)
    P._paint(g, m, "cyan", 4 + (sector % 2))
    P.flat(g, m & (sector % 2 == 1) & (np.abs(Y - OY) < 2.5), "plasma", 5)
    low = m & (Y < OY - 4.5)
    P._paint(g, low, "blue", np.where(sector % 2 == 0, 4, 5))
    P.flat(g, m & (Y < OY - 6.8), "blue", 3)
    P.flat(g, m & (Y > OY + 4.5), "cyan", 6)
    P.flat(g, m & (Y > OY + 6.9), "cyan", 7)
    P.flat(g, m & seams(g, solids, 0.55) & (Y > OY - 3.5) & (Y < OY + 3.5), "cyan", 6)
    # a glint high on the front left
    gx, gy, gz = CX - 4.0, OY + 5.0, CZ - 5.5
    P.flat(g, m & (np.abs(X - gx) < 1.6) & (np.abs(Y - gy) < 1.1) & (Z < CZ - 2), "bone", 7)
    # the eye on the front facet (reads left to right from the front)
    rows = [
        "..####..",
        ".#++++#.",
        "#+@oo@+#",
        "#+@oo@+#",
        ".#++++#.",
        "..####..",
    ]
    eye = {"#": C("blue", 2), "+": C("bone", 7), "@": C("gold", 6), "o": C("navy", 2)}
    stamp(g, "-z", CZ - R, int(CX) - 4, int(OY) - 3, rows, eye)
    return g


def hoop_grid(r: float) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m, solids = hoop(g, CX, OY, CZ, r)
    ang = np.arctan2(Z - CZ, X - CX)
    facet_paint(g, solids, lambda gg, mm, fr: P.flat(gg, mm, "gold", 6 if fr == "top" else 5))
    k = (ang + math.pi) / (2 * math.pi / 12)
    stud = m & (np.abs(k % 1 - 0.5) < 0.2) & (np.floor(k) % 3 == 0)
    P.flat(g, stud, "cyan", 6)
    P.flat(g, stud & (Y > OY), "cyan", 7)
    return g


def build():
    c = (CX, OY, CZ)
    parts = [("scrying-orb", stand(), None, None), ("orb", orb(), c, None)]
    for name, (r, _tilt) in HOOPS.items():
        parts += [(name, None, c, None), (f"{name}-band", hoop_grid(r), c, name)]
    root, to_root = rig(parts)
    for p in root.walk():
        if p.name.endswith("-band"):
            p.rot = HOOPS[p.name[: -len("-band")]][1]
    idle = {
        "orb": {"rot": keys((0, 0, 0, 0), (1.2, 0, 32, 0), (2.4, 0, 32, 0), (3.6, 0, -32, 0), (4.8, 0, -32, 0), (6.0, 0, 0, 0))},
        "ring-a": {"rot": turn(6.0, "y", 60)},
        "ring-b": {"rot": turn(6.0, "y", -60)},
    }
    active = {
        "orb": {"rot": turn(1.5, "y", 240), "scale": keys((0, 1, 1, 1), (0.75, 1.12, 1.12, 1.12), (1.5, 1, 1, 1))},
        "ring-a": {"rot": turn(1.5, "y", 480)},
        "ring-b": {"rot": turn(1.5, "y", -480)},
    }
    return asset("animated-props", "scrying-orb", "Scrying Orb", root,
                 clips=[Clip("idle", idle), Clip("active", active)],
                 sockets=[Socket("socket-orb", at=to_root(c), parent="orb")],
                 fx=[pfx("rvx-fantasy-arcane-orbit", "socket-orb", "clip:active", size=28)])
