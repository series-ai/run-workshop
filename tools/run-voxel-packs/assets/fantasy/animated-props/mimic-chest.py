"""Mimic chest in the Pirate Nation style.

The treasure chest's evil twin (same family: planked wood, thick gold corner
caps and foot band, iron straps, a faceted barrel lid), turned into a
monster (rule K3): big bone fangs on the lid rim and the body rim that
meet across the seam, a long pink tongue that lolls over the front, two
big bulging yellow eyes with slit pupils under angry brows on the lid, and
stubby clawed feet. A few bait coins lie on the ground in front. All teeth,
brows, claws and the tongue are true-slope prisms; the rest is paint.
Clips: idle (chomp and breathe), attack (lunge and snap), hit (recoil),
death (tips over, lid flops open). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S_
from _life import asset, coords, facet_paint, keys, pfx, rig, side
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket

S = (34, 34, 34)
X0, X1 = 6, 28  # body x
Z0, Z1 = 9, 25  # body z
FY = 3  # the feet lift the body
H = FY + 11  # body top
LID_TOP = H + 9
CX = (X0 + X1) / 2
STRAPS = ((10, 12), (22, 24))
GAP = (CX - 3.5, CX + 3.5)  # no teeth where the tongue comes out


def front_teeth(g: Grid, xs, y_base: float, y_tip: float, z0: float, z1: float, w: float) -> np.ndarray:
    """A row of triangular fangs across the front (prisms along z)."""
    m = np.zeros(g.shape, dtype=bool)
    for x in xs:
        g.prism("z", [(x - w / 2, y_base), (x + w / 2, y_base), (x + 0.3, y_tip)], z0, z1, C("bone", 6))
        m |= g.solids[-1].mask(g.shape)
    return m


def side_teeth(g: Grid, zs, y_base: float, y_tip: float, x0: float, x1: float, w: float) -> np.ndarray:
    """A row of fangs along a side (prisms across x)."""
    m = np.zeros(g.shape, dtype=bool)
    for z in zs:
        g.prism("x", [(y_base, z - w / 2), (y_base, z + w / 2), (y_tip, z + 0.3)], x0, x1, C("bone", 6))
        m |= g.solids[-1].mask(g.shape)
    return m


def paint_teeth(g: Grid, m: np.ndarray, root_y: float, up: bool) -> None:
    _X, Y, _Z = coords(g)
    P.flat(g, m, "bone", 6)
    near = (Y < root_y + 1.2) if up else (Y > root_y - 1.2)
    P.flat(g, m & near, "bone", 4)
    tip = (Y > root_y + 2.5) if up else (Y < root_y - 2.5)
    P.flat(g, m & tip, "bone", 7)


def body() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = box(g, X0, FY, Z0, X1, H, Z1, "wood", 5)
    P.planks(g, m, "wood", 5, width=3, across="y", length=(8, 12), seed=13)
    P.flat(g, edges(m), "darkwood", 3)
    # the mouth: a red gullet on the top face (shows when the lid opens)
    top = m & (Y > H - 1) & (X > X0 + 1) & (X < X1 - 1) & (Z > Z0 + 1) & (Z < Z1 - 1)
    P.flat(g, top, "red", 3)
    P.flat(g, top & (np.abs(X - CX) < 5) & (Z > Z0 + 5) & (Z < Z1 - 4), "blood", 2)
    # gold corner caps, a gold foot band and iron straps, as on the treasure chest
    caps = np.zeros(S, dtype=bool)
    for cx in (X0 - 1, X1 - 2):
        for cz in (Z0 - 1, Z1 - 2):
            caps |= box(g, cx, FY, cz, cx + 3, H, cz + 3, "gold", 5)
    foot = box(g, X0 - 1, FY, Z0 - 1, X1 + 1, FY + 2, Z1 + 1, "gold", 4)
    P.flat(g, caps & (Y > H - 1), "gold", 7)
    P.flat(g, edges(caps | foot), "gold", 3)
    for sx0, sx1 in STRAPS:
        for zf, zb in ((Z0 - 1, Z0), (Z1, Z1 + 1)):
            strap = box(g, sx0, FY + 2, zf, sx1, H, zb, "iron", 6)
            P.flat(g, strap & ((np.floor(Y).astype(int) % 3) == 1), "steel", 6)
    P.grime(g, m, height=2, seed=16)
    # stubby clawed feet under the corners
    feet = np.zeros(S, dtype=bool)
    for fx in (X0 + 1, X1 - 5):
        for fz in (Z0 + 1, Z1 - 5):
            feet |= box(g, fx, 0, fz, fx + 4, FY, fz + 4, "darkwood", 3)
            for k in range(3):  # three hooked claws forward
                cxk = fx + 0.7 + k * 1.3
                side(g, [(FY - 0.5, fz + 0.5), (0.0, fz + 0.5), (0.0, fz - 2.0)], cxk - 0.6, cxk + 0.6, "bone", 5)
    P.flat(g, feet & (Y > FY - 1), "darkwood", 2)
    # lower fangs: up from the body rim, across the front and along the sides
    fx = [x for x in np.arange(X0 + 3.5, X1 - 2, 3.0) if not (GAP[0] - 1 < x < GAP[1] + 1)]
    teeth = front_teeth(g, fx, H - 1.5, H + 2.5, Z0 - 2, Z0, 2.6)
    zs = list(np.arange(Z0 + 4.5, Z1 - 3, 3.0))
    teeth |= side_teeth(g, zs, H - 1.5, H + 2.0, X0 - 2, X0, 2.4)
    teeth |= side_teeth(g, zs, H - 1.5, H + 2.0, X1, X1 + 2, 2.4)
    paint_teeth(g, teeth, H - 1.5, up=True)
    return g


def lid() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    prof = [(H, Z0 - 0.5), (H + 4, Z0 + 0.5), (LID_TOP, Z0 + 4.5), (LID_TOP, Z1 - 4.5), (H + 4, Z1 - 0.5), (H, Z1 + 0.5)]
    m = side(g, prof, X0 - 0.5, X1 + 0.5, "wood", 5)
    facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.planks(gg, mm, "wood", 5, width=3, across="y", length=(8, 12), frame=fr, seed=17))
    inner = (X > X0 + 1) & (X < X1 - 1) & (Z > Z0 + 1) & (Z < Z1 - 1)
    P.flat(g, m & (Y < H + 1) & inner, "red", 4)  # the palate
    P.flat(g, m & (Y < H + 1) & inner & (np.abs(X - CX) < 0.8), "red", 2)
    ends = m & ((X < X0 + 2.5) | (X > X1 - 2.5))
    P.flat(g, ends, "gold", 5)
    P.flat(g, ends & (Y > LID_TOP - 1), "gold", 7)
    P.flat(g, m & (Y < H + 1) & ~inner, "gold", 4)
    for sx0, sx1 in STRAPS:
        strap = m & (X > sx0) & (X < sx1)
        P.flat(g, strap, "iron", 6)
        P.flat(g, strap & (Y > LID_TOP - 1) & ((np.floor(Z).astype(int) % 4) == 1), "steel", 6)
    # upper fangs hang from the lid rim over the body's front and sides
    fx = [x for x in np.arange(X0 + 2.0, X1 - 1, 3.0) if not (GAP[0] - 1 < x < GAP[1] + 1)]
    teeth = front_teeth(g, fx, H + 1.5, H - 3.0, Z0 - 2.5, Z0 - 0.5, 2.8)
    zs = list(np.arange(Z0 + 3.0, Z1 - 3, 3.0))
    teeth |= side_teeth(g, zs, H + 1.5, H - 2.5, X0 - 2.5, X0 - 0.5, 2.6)
    teeth |= side_teeth(g, zs, H + 1.5, H - 2.5, X1 + 0.5, X1 + 2.5, 2.6)
    paint_teeth(g, teeth, H + 1.5, up=False)
    # two big bulging eyes on the lid front, slit pupils, angry brows
    ey = H + 7.0
    for s in (-1, 1):
        ex = CX + s * 5.5
        eye = S_.disc(g, "z", ex, ey, 4.0, Z0 - 2, Z0 + 5, "bone", 7)
        d = S_.ngon_radius(g, "z", ex, ey)
        P.flat(g, eye & (d > 3.2), "bone", 5)
        P.flat(g, eye & (d <= 2.9), "gold", 6)
        P.flat(g, eye & (d <= 2.9) & (Y < ey - 1.0), "gold", 5)
        P.flat(g, eye & (np.abs(X - ex - s * 0.5) < 0.7) & (np.abs(Y - ey) < 2.6), "darkwood", 1)
        P.flat(g, eye & (np.abs(X - (ex - 1.8)) < 0.6) & (np.abs(Y - (ey + 1.6)) < 0.6), "bone", 7)
        brow = S_.bar(g, "z", (ex - s * 4.6, ey + 5.0), (ex + s * 3.4, ey + 3.0), 1.8, Z0 - 3, Z0 + 1, "darkwood", 3)
        P.flat(g, brow & (Y > ey + 4.2), "darkwood", 4)
    return g


def tongue() -> Grid:
    """A long tongue from the back of the mouth, over the front rim and down
    the front, the tip curling out (one sloped prism strip, true slopes)."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    path = [(H - 0.8, Z0 + 5.0), (H + 0.6, Z0 - 1.0), (H - 2.5, Z0 - 3.8), (FY + 2.5, Z0 - 4.6), (FY + 0.8, Z0 - 7.5)]
    widths = [1.3, 1.5, 1.5, 1.5, 1.2]
    m = np.zeros(S, dtype=bool)
    for (p0, r0), (p1, r1) in zip(zip(path, widths), zip(path[1:], widths[1:])):
        g.prism("x", S_.quad(p0, p1, r0, r1), GAP[0] + 0.5, GAP[1] - 0.5, C("pink", 4))
        m |= g.solids[-1].mask(S)
    for (y, z), r in zip(path[1:-1], widths[1:-1]):  # round knuckles fill the bends
        m |= S_.disc(g, "x", y, z, r, GAP[0] + 0.5, GAP[1] - 0.5, "pink", 4)
    P.flat(g, m, "pink", 4)
    P.flat(g, m & (np.abs(X - CX) < 0.6), "pink", 2)  # the middle groove
    P.flat(g, m & (np.abs(X - CX) > 2.4), "pink", 5)
    P.flat(g, m & (Z < Z0 - 6), "pink", 5)
    return g


def coins() -> Grid:
    g = Grid(*S)
    X, _Y, Z = coords(g)
    for k, (cx, cz) in enumerate(((X0 - 1.0, Z0 - 6.0), (X1 - 2.0, Z0 - 5.0), (X1 + 1.0, Z0 - 1.0))):
        c = S_.disc(g, "y", cx, cz, 1.6, 0, 1, "gold", 6, n=8)
        P.flat(g, c & (np.hypot(X - cx, Z - cz) < 0.8), "gold", 7)
    return g


def build():
    b, lg, tg, cg = body(), lid(), tongue(), coins()
    base = (CX, float(FY), (Z0 + Z1) / 2)  # the body rocks on its bottom centre
    hinge = (CX, float(H), Z1 + 0.5)  # the back bottom edge of the lid
    root_tongue = (CX, H - 0.5, Z0 + 5.0)  # the back of the tongue
    root, to_root = rig([("mimic", cg, None, None), ("body", b, base, None), ("lid", lg, hinge, "body"), ("tongue", tg, root_tongue, "body")])
    idle = {"lid": {"rot": keys((0, 0, 0, 0), (0.5, 14, 0, 0), (0.8, 0, 0, 0), (1.3, 9, 0, 0), (1.6, 0, 0, 0), (2.4, 0, 0, 0))},
            "tongue": {"rot": keys((0, 0, 0, 0), (0.6, 0, 0, 7), (1.2, 0, 0, 0), (1.8, 0, 0, -7), (2.4, 0, 0, 0))},
            "body": {"scale": keys((0, 1, 1, 1), (1.2, 1.03, 0.96, 1.03), (2.4, 1, 1, 1))}}
    attack = {"body": {"loc": keys((0, 0, 0, 0), (0.15, 0, 0, 2), (0.32, 0, 4, -7), (0.5, 0, 0, -5), (0.9, 0, 0, 0)),
                       "rot": keys((0, 0, 0, 0), (0.15, -10, 0, 0), (0.32, 14, 0, 0), (0.5, 0, 0, 0), (0.9, 0, 0, 0))},
              "lid": {"rot": keys((0, 0, 0, 0), (0.15, 30, 0, 0), (0.3, 75, 0, 0), (0.4, 0, 0, 0), (0.5, 18, 0, 0), (0.62, 0, 0, 0))},
              "tongue": {"rot": keys((0, 0, 0, 0), (0.25, 25, 0, 0), (0.4, -10, 0, 0), (0.7, 0, 0, 0))}}
    hit = {"body": {"loc": keys((0, 0, 0, 0), (0.1, 0, 1, 3), (0.45, 0, 0, 0)),
                    "rot": keys((0, 0, 0, 0), (0.1, -10, 0, 7), (0.45, 0, 0, 0))},
           "lid": {"rot": keys((0, 0, 0, 0), (0.1, 32, 0, 0), (0.3, 0, 0, 0), (0.38, 6, 0, 0), (0.45, 0, 0, 0))},
           "tongue": {"rot": keys((0, 0, 0, 0), (0.1, 0, 0, 15), (0.45, 0, 0, 0))}}
    death = {"body": {"rot": keys((0, 0, 0, 0), (0.3, 0, 0, 14), (0.75, 0, 0, 88), (0.9, 0, 0, 82), (1.2, 0, 0, 85)),
                      "loc": keys((0, 0, 0, 0), (0.3, 0, 2, 0), (0.75, -2, 12, 0), (1.2, -2, 12, 0))},
             "lid": {"rot": keys((0, 0, 0, 0), (0.5, 60, 0, 0), (0.8, 105, 0, 0), (1.0, 95, 0, 0), (1.2, 100, 0, 0))},
             "tongue": {"rot": keys((0, 0, 0, 0), (0.8, 0, 0, -30), (1.2, -20, 0, -35))}}
    mouth = to_root((CX, H + 1.0, Z0 - 1.0))
    return asset("animated-props", "mimic-chest", "Mimic Chest", root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 sockets=[Socket("socket-mouth", at=mouth, parent="body")],
                 fx=[pfx("rvx-fantasy-metal-clang", "socket-mouth", "clip:attack", size=20, at=0.36)])
