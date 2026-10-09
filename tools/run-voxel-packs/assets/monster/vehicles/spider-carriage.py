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
import pnglyph
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
    # The thorax sits under the cabin as a dark, plated connector.
    thorax = S.disc(g, "y", CX, 56, 17, 26, CAB_Y0, "moss", 4)
    P.flat(g, thorax & S.seams(g, [g.solids[-1]], 1.2), "moss", 2)
    P.flat(g, thorax & (Y < 29), "gray", 3)
    # The abdomen is a stepped, armored sac with a bold magenta hourglass.
    start = len(g.solids)
    g.prism("y", S.flat_ngon(CX, 96, 9, 8), 22, 32, C("purple", 5), top=S.flat_ngon(CX, 97, 14, 8))
    g.prism("y", S.flat_ngon(CX, 97, 14, 8), 32, 44, C("purple", 5), top=S.flat_ngon(CX, 98, 12, 8))
    g.prism("y", S.flat_ngon(CX, 98, 12, 8), 44, 52, C("purple", 5), top=S.flat_ngon(CX, 98, 5, 8))
    ab = np.logical_or.reduce([sd.mask(g.shape) for sd in g.solids[start:]])
    P.flat(g, ab, "purple", 5)
    P.flat(g, ab & S.seams(g, g.solids[start:], 1.2), "purple", 2)
    P.flat(g, ab & ((Y < 24) | ((Y > 49) & (Y < 51))), "gray", 4)
    # A large bone skull gives the rear shell a clear focal mark.
    pnglyph.icon(g, "+z", 110, int(CX - 7), 30, "skull", "bone", 6, scale=2, depth=2, reach=4)
    head = box(g, CX - 11, 23, 13, CX + 11, 41, 31, "gray", 4)
    P.flat(g, head & S.seams(g, [g.solids[-1]], 1.1), "gray", 2)
    # Two large eyes sit on a clean dark face panel.
    face = head & (Z < 15) & (Y > 28) & (Y < 39) & (np.abs(X - CX) < 9)
    P.flat(g, face, "purple", 2)
    for ex in (-5, 5):
        socket = head & (Z < 15) & (np.abs(X - CX - ex) <= 3) & (np.abs(Y - 34) <= 3)
        P.flat(g, socket, "moss", 2)
        eye = socket & (Z < 14) & (np.abs(X - CX - ex) <= 2) & (np.abs(Y - 34) <= 2)
        P.flat(g, eye, "toxic", 6)
        P.flat(g, eye & (np.abs(X - CX - ex - 0.5) < 1) & (np.abs(Y - 34 - 0.5) < 1), "toxic", 7)
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
    P.flat(g, wm, "gray", 5)
    P.flat(g, wm & S.seams(g, walls, 1.2), "gray", 2)
    for k, (m, fr) in enumerate(S.facets(g, walls)):
        if fr == "top":
            continue
        u, _v = fr
        if abs(u[2]) > 0.5:  # the long side facets
            P.planks(g, m, "gray", 5, width=5, across="y", nails=False, grain=False, frame=fr, seed=4)
            facet_window(g, m, fr, CAB_Y0 + 6, CAB_Y1 - 4, 9, glass=("magenta", 6), rim=("gold", 5))
    P.flat(g, wm & ((Y < CAB_Y0 + 2) | (Y > CAB_Y1 - 2)), "gold", 4)
    P.flat(g, wm & S.seams(g, walls, 1.2), "gold", 4)
    # Dark hip sockets join each leg to the lower coffin frame.
    for side in (-1, 1):
        for hz in HIP_Z:
            hx = CX + side * HIP_X
            mount = box(g, hx - 4, 31, hz - 4, hx + 4, 38, hz + 4, "purple", 2)
            P.flat(g, mount & (Y > 33) & (Y < 36), "magenta", 4)
    top = coffin_poly(CX, CAB_Z0 + 3, CAB_W - 8, CAB_L - 6)
    start = len(g.solids)
    g.prism("y", [(u, v) for u, v in coffin_poly(CX, CAB_Z0 - 1, CAB_W + 2, CAB_L + 2)], CAB_Y1, CAB_Y1 + 10, C("purple", 6), top=top)
    def roof_courses(gg, mm, fr):
        u, v = P.uv(gg, fr)
        P.flat(gg, mm, "purple", 5)
        P.flat(gg, mm & (v % 4 == 3), "purple", 3)
        P.flat(gg, mm & (u % 5 == 0) & (v % 4 != 3), "purple", 4)

    S.paint_facets(g, g.solids[start:], roof_courses)
    lid = S.last(g)
    P.flat(g, lid & (Y < CAB_Y1 + 1.5), "gold", 5)
    lidtop = lid & (Y > CAB_Y1 + 9)
    P.flat(g, lidtop, "purple", 5)
    cc = CAB_Z0 + CAB_L * 0.6
    P.flat(g, lidtop & (((np.abs(X - CX) < 1.1) & (np.abs(Z - cc) < 12)) | ((np.abs(Z - cc - 4) < 1.1) & (np.abs(X - CX) < 6))), "gold", 5)
    # two magenta lamps on brackets at the front corners
    for s in (-1, 1):
        x = CX + s * (CX - LAMP_L[0])
        attach_x = CX + s * 11
        box(g, min(x, attach_x), CAB_Y1 - 8, CAB_Z0 - 3, max(x, attach_x), LAMP_L[1] + 1, CAB_Z0 + 3, "gold", 4)
        lamp = box(g, x - 2.5, LAMP_L[1] - 4, LAMP_L[2] - 2.5, x + 2.5, LAMP_L[1] + 3, LAMP_L[2] + 2.5, "magenta", 6)
        P.flat(g, lamp & (np.abs(X - x) > 1.6) & (np.abs(Z - LAMP_L[2]) > 1.6), "gold", 4)
        g.prism("y", [(x - 3, LAMP_L[2] - 3), (x + 3, LAMP_L[2] - 3), (x + 3, LAMP_L[2] + 3), (x - 3, LAMP_L[2] + 3)], LAMP_L[1] + 2, LAMP_L[1] + 7, C("purple", 5), top=[(x, LAMP_L[2])] * 4)
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
    g.prism("z", S.quad((hx, HIP_Y), knee, 3.5, 3.0), hz - 3, hz + 3, C("purple", 5))
    g.prism("z", S.quad(knee, foot, 3.0, 1.8), hz - 2.5, hz + 2.5, C("purple", 5))
    box(g, knee[0] - 2.8, knee[1] - 2.8, hz - 3.1, knee[0] + 2.8, knee[1] + 2.8, hz + 3.1, "purple", 5)
    m = (g.a > 0)
    P.flat(g, m, "purple", 5)
    # Place broad bands along each bent segment, not along the full hip-to-foot span.
    def segment_coords(a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]
        length2 = dx * dx + dy * dy
        t = ((X - a[0]) * dx + (Y - a[1]) * dy) / length2
        dist = np.abs((X - a[0]) * dy - (Y - a[1]) * dx) / np.sqrt(length2)
        return t, dist

    upper_t, upper_d = segment_coords((hx, HIP_Y), knee)
    lower_t, lower_d = segment_coords(knee, foot)
    P.flat(g, m & (upper_d < 4.0) & (upper_t > 0.13) & (upper_t < 0.23), "magenta", 5)
    P.flat(g, m & (upper_d < 4.0) & (upper_t > 0.78) & (upper_t < 0.9), "gray", 5)
    P.flat(g, m & (lower_d < 3.4) & (lower_t > 0.50) & (lower_t < 0.64), "magenta", 5)
    P.flat(g, m & S.seams(g, [g.solids[-1]], 1.0), "purple", 2)
    pin = m & (np.abs(X - knee[0]) <= 1) & (np.abs(Y - knee[1]) <= 1) & (np.abs(Z - hz) <= 3)
    P.flat(g, pin, "magenta", 5)
    g.prism("z", S.quad((foot[0] - side * 0.6, foot[1] + 3), (foot[0] + side * 1.2, 0.2), 1.3, 0.6), hz - 1.5, hz + 1.5, C("bone", 6))
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
        pfx=[{"effectId": "rvx-monster-ghost-lantern", "socket": "socket-lamp", "trigger": "idle", "size": 32},
             {"effectId": "rvx-monster-ghost-lantern", "socket": "socket-lamp-r", "trigger": "idle", "size": 32}],
    )
