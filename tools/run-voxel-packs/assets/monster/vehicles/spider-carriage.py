"""Spider carriage, in the Pirate Nation haunted style.

A giant spider carries a coffin-shaped cabin: mid-violet lacquer (lit
values, so it reads beside PN; the dark is kept for seams) with gold
trim, painted pointed windows glowing magenta, a door, a sloped coffin lid
roof (true slopes) with a gold cross, and two magenta lamps at the front.
The spider is a chunky caricature (rule F4): a big faceted abdomen with a
painted magenta hourglass, a head with eight glowing eyes and bone fangs,
a driver's perch on its head, and eight long jointed legs (true slopes)
banded magenta with bone claws. `move`: the legs step in two alternating
sets and the cabin bobs; `idle`: the cabin breathes and two legs tap.
Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import coffin_poly, coords, facet_window, parts
from pnkit import box
from voxgrid import C, Asset, Clip, Grid, Socket

G = (108, 88, 112)
CX = 54.0
HIP_Y = 34.0
HIP_Z = (38.0, 50.0, 62.0, 74.0)
HIP_X = 12.0  # hip offset from the centre line
YAW = (34.0, 12.0, -12.0, -34.0)  # leg fan for the left side, degrees (right: mirrored)
CAB_Z0, CAB_L, CAB_W = 30, 58, 34
CAB_Y0, CAB_Y1 = 36, 62
LAMP_L = (CX - 17.0, 58.0, 30.0)


def cabin() -> Grid:
    g = Grid(*G)
    X, Y, Z = coords(g)
    # the spider: thorax, abdomen with an hourglass, head with eyes and fangs
    S.disc(g, "y", CX, 56, 17, 26, CAB_Y0, "purple", 4)
    P.mottle(g, S.last(g), "purple", 4, cell=3, seed=1)
    start = len(g.solids)
    g.prism("y", S.flat_ngon(CX, 96, 10, 8), 22, 32, C("purple", 6), top=S.flat_ngon(CX, 97, 15, 8))
    g.prism("y", S.flat_ngon(CX, 97, 15, 8), 32, 44, C("purple", 5), top=S.flat_ngon(CX, 98, 12, 8))
    g.prism("y", S.flat_ngon(CX, 98, 12, 8), 44, 52, C("purple", 5), top=S.flat_ngon(CX, 98, 5, 8))
    ab = np.logical_or.reduce([sd.mask(g.shape) for sd in g.solids[start:]])
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.mottle(gg, mm, "purple", 6, cell=3, seed=2))
    P.flat(g, ab & S.seams(g, g.solids[start:], 0.9), "purple", 5)
    hg = ab & (Z > 99) & (Y > 26) & (Y < 50) & (np.abs(X - CX) < 1.5 + np.abs(Y - 38) * 0.5)
    P.flat(g, hg, "magenta", 5)
    head = box(g, CX - 10, 24, 14, CX + 10, 40, 30, "purple", 6)
    P.mottle(g, head, "purple", 6, cell=3, seed=3)
    for ex, ey, r, ramp in ((-4, 34, 2, "toxic"), (4, 34, 2, "toxic"), (-8, 32, 1, "magenta"), (8, 32, 1, "magenta"), (-2, 29, 1, "toxic"), (2, 29, 1, "toxic"), (-6, 37, 1, "magenta"), (6, 37, 1, "magenta")):
        eye = head & (Z < 15) & (np.abs(X - CX - ex) <= r) & (np.abs(Y - ey) <= r)
        P.flat(g, eye, ramp, 6)
        P.flat(g, eye & (np.abs(X - CX - ex - 0.5) < 0.6) & (np.abs(Y - ey - 0.5) < 0.6), ramp, 7)
    for s in (-1, 1):
        g.prism("x", [(25, 16), (25, 20), (14, 13)], CX + s * 4 - 1.5, CX + s * 4 + 1.5, C("bone", 6))
    # the driver's perch on the head
    seat = box(g, CX - 7, 40, 18, CX + 7, 43, 28, "purple", 6)
    P.outline(g, seat, "gold", 4, normal="y")
    box(g, CX - 7, 43, 26, CX + 7, 51, 28, "purple", 5)
    # the coffin cabin: lacquered walls with painted windows, a door, a lid roof
    poly = coffin_poly(CX, CAB_Z0, CAB_W, CAB_L)
    g.prism("y", [(u, v) for u, v in poly], CAB_Y0, CAB_Y1, C("purple", 6))
    walls = [g.solids[-1]]
    wm = S.last(g)
    P.mottle(g, wm, "purple", 6, cell=4, seed=4)
    for k, (m, fr) in enumerate(S.facets(g, walls)):
        if fr == "top":
            continue
        u, _v = fr
        if abs(u[2]) > 0.5:  # the long side facets
            facet_window(g, m, fr, CAB_Y0 + 6, CAB_Y1 - 4, 9, glass=("magenta", 6), rim=("gold", 5))
    P.flat(g, wm & ((Y < CAB_Y0 + 2) | (Y > CAB_Y1 - 2)), "gold", 4)
    P.flat(g, wm & S.seams(g, walls, 1.2), "gold", 4)
    top = coffin_poly(CX, CAB_Z0 + 3, CAB_W - 8, CAB_L - 6)
    start = len(g.solids)
    g.prism("y", [(u, v) for u, v in coffin_poly(CX, CAB_Z0 - 1, CAB_W + 2, CAB_L + 2)], CAB_Y1, CAB_Y1 + 10, C("purple", 6), top=top)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.tiles(gg, mm, "purple", 6, row=3, width=4, frame=fr, seed=5))
    lid = S.last(g)
    P.flat(g, lid & (Y < CAB_Y1 + 1.5), "gold", 5)
    lidtop = lid & (Y > CAB_Y1 + 9)
    P.flat(g, lidtop, "purple", 5)
    cc = CAB_Z0 + CAB_L * 0.6
    P.flat(g, lidtop & (((np.abs(X - CX) < 1.1) & (np.abs(Z - cc) < 12)) | ((np.abs(Z - cc - 4) < 1.1) & (np.abs(X - CX) < 6))), "gold", 5)
    # two magenta lamps on brackets at the front corners
    for s in (-1, 1):
        x = CX + s * (CX - LAMP_L[0])
        box(g, x - 1, CAB_Y1 - 8, CAB_Z0 + 2, x + 1, CAB_Y1 - 6, CAB_Z0 + 8, "gold", 4)
        lamp = box(g, x - 2.5, LAMP_L[1] - 4, LAMP_L[2] - 2.5, x + 2.5, LAMP_L[1] + 3, LAMP_L[2] + 2.5, "magenta", 6)
        P.flat(g, lamp & (np.abs(X - x) > 1.6) & (np.abs(Z - LAMP_L[2]) > 1.6), "gold", 4)
        g.prism("y", [(x - 3, LAMP_L[2] - 3), (x + 3, LAMP_L[2] - 3), (x + 3, LAMP_L[2] + 3), (x - 3, LAMP_L[2] + 3)], LAMP_L[1] + 3, LAMP_L[1] + 7, C("purple", 5), top=[(x, LAMP_L[2])] * 4)
    return g


def leg(side: int, k: int) -> Grid:
    """One jointed leg in the x-y plane: a femur up to a high knee, a long
    tibia down to a bone claw (true slopes), magenta bands at the joints."""
    g = Grid(*G)
    X, Y, Z = coords(g)
    hx, hz = CX + side * HIP_X, HIP_Z[k]
    reach = 40 - abs(k - 1.5) * 2
    knee = (hx + side * reach * 0.5, HIP_Y + 22)
    foot = (hx + side * reach, 3.0)
    g.prism("z", S.quad((hx, HIP_Y), knee, 3.2, 2.8), hz - 2.5, hz + 2.5, C("purple", 6))
    g.prism("z", S.quad(knee, foot, 2.8, 1.6), hz - 2, hz + 2, C("purple", 6))
    m = (g.a > 0)
    P.mottle(g, m, "purple", 6, cell=3, seed=10 + k)
    P.flat(g, m & (np.hypot(X - knee[0], Y - knee[1]) < 3.6), "magenta", 5)
    P.flat(g, m & (np.hypot(X - hx, Y - HIP_Y) < 3.8), "magenta", 5)
    mid = ((knee[0] + foot[0]) / 2, (knee[1] + foot[1]) / 2)
    P.flat(g, m & (np.hypot(X - mid[0], Y - mid[1]) < 1.6), "magenta", 4)
    g.prism("z", S.quad((foot[0] - side * 0.6, foot[1] + 3), (foot[0] + side * 1.2, 0.2), 1.3, 0.6), hz - 1.5, hz + 1.5, C("bone", 6))
    box(g, knee[0] - 3, knee[1] - 3, hz - 3, knee[0] + 3, knee[1] + 3, hz + 3, "magenta", 4)
    return g


def build() -> Asset:
    grids = {"cabin": cabin()}
    joints = [("cabin", None, (CX, 0.0, 60.0))]
    rest = {}
    for side, tag in ((-1, "l"), (1, "r")):
        for k in range(4):
            name = f"leg-{tag}{k}"
            grids[name] = leg(side, k)
            joints.append((name, "cabin", (CX + side * HIP_X, HIP_Y, HIP_Z[k])))
            rest[name] = side * YAW[k]
    root = parts(grids, joints)
    for p in root.walk():
        if p.name in rest:
            p.rot = (0.0, rest[p.name], 0.0)

    def gait(side, phase):
        """Local keys: swing about y (forward/back), lift about z (raise the foot)."""
        s = -1 if side == "l" else 1
        keys = []
        for i in range(9):
            t = 0.8 * i / 8
            a = (i / 8 + phase) % 1.0
            swing = 10 * np.cos(2 * np.pi * a) * (-s)
            lift = 16 * max(0.0, np.sin(2 * np.pi * a)) * s
            keys.append((t, (0.0, float(swing), float(lift))))
        return {"rot": keys}

    move = {}
    for k in range(4):
        move[f"leg-l{k}"] = gait("l", 0.0 if k % 2 == 0 else 0.5)
        move[f"leg-r{k}"] = gait("r", 0.5 if k % 2 == 0 else 0.0)
    move["cabin"] = {"loc": [(t, (0.0, y, 0.0)) for t, y in ((0, 0.0), (0.2, 1.2), (0.4, 0.0), (0.6, 1.2), (0.8, 0.0))]}
    tap = [(t, (0.0, 0.0, a)) for t, a in ((0, 0.0), (1.4, 0.0), (1.6, 14.0), (1.8, 0.0), (2.0, 14.0), (2.2, 0.0), (3.0, 0.0))]
    tap_r = [(t, (0.0, 0.0, a)) for t, a in ((0, 0.0), (0.4, 0.0), (0.6, 14.0), (0.8, 0.0), (3.0, 0.0))]
    idle = {
        "cabin": {"loc": [(t, (0.0, y, 0.0)) for t, y in ((0, 0.0), (1.5, 1.5), (3.0, 0.0))]},
        "leg-l0": {"rot": [(t, (0.0, 0.0, -a)) for t, (_x, _y, a) in tap]},
        "leg-r0": {"rot": [(t, (0.0, 0.0, a)) for t, (_x, _y, a) in tap_r]},
    }
    rel = lambda p: (p[0] - CX, p[1], p[2] - 60.0)  # noqa: E731
    lamp_r = (2 * CX - LAMP_L[0], LAMP_L[1], LAMP_L[2])
    return Asset(
        id="monster-vehicles-spider-carriage", pack="monster", category="vehicles", name="Spider Carriage", root=root,
        clips=[Clip("move", move), Clip("idle", idle)],
        sockets=[Socket("socket-lamp", at=rel(LAMP_L), parent="cabin"), Socket("socket-lamp-r", at=rel(lamp_r), parent="cabin")],
        pfx=[{"effectId": "rvx-monster-ghost-lantern", "socket": "socket-lamp", "trigger": "idle", "size": 24}],
    )
