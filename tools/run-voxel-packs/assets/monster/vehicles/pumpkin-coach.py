"""Pumpkin coach, in the Pirate Nation haunted style.

A fairy-tale coach that went bad: a giant ribbed pumpkin cab (the
oversized function prop, rules F4 and K3) on a dark chassis with gold
scrollwork. The cab is carved, not modelled (rule S1): an arched door
with a gold frame and a step on the +x side, a round window of glowing
magenta glass on the -x side, and a grinning carved face at the back
with ember light behind it. A hooked stem and a gold crescent finial sit
on the crown. The driver's box in front carries a buttoned seat, two
silver lanterns and a purple pennant on a crooked staff (rule F5); the
empty shafts reach out for a team that is not there. Four octagonal
spoked wheels with gold rims, the rear pair oversized.

Parts: coach (root), four wheels, lamp-l and lamp-r (which sway) and the
pennant. Clips: move (the wheels roll, the coach rocks, the lanterns
swing and the pennant streams), idle (the coach settles, the lanterns
sway slowly). Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import coords, parts
from _pn import pumpkin, stamp
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Socket, turn

G = (64, 92, 116)
CX = 32.0
BED = (18.0, 26.0)  # the chassis bed, y0 and y1
FZ, FR = 30.0, 11.0  # front axle z, wheel radius
RZ, RR = 88.0, 15.0
WX = {"l": (CX - 25, CX - 21), "r": (CX + 21, CX + 25)}
CAB = (CX, 26.0, 64.0)  # the pumpkin's centre x, foot y, centre z
CAB_W, CAB_H = 44, 34
BOX_Z = (24.0, 40.0)  # the driver's box
LAMP = {"lamp-l": (CX - 20.0, 48.0, 26.0), "lamp-r": (CX + 20.0, 48.0, 26.0)}
STAFF = (CX + 15.0, 44.0, 30.0)

BACK_FACE = [
    "rrrr....rrrr",
    "ryyyr..ryyyr",
    "rywyyr.yywyr",
    ".rrrrr.rrrr.",
    ".....rr.....",
    "....ryyr....",
    "....rrrr....",
    "r..........r",
    "ryrrrrrrrryr",
    "ryyoyyyyoyyr",
    ".rryyyyyyrr.",
]


def chassis(g: Grid) -> None:
    """The bed, the axles, the bolsters and the gold scroll valance."""
    X, Y, Z = coords(g)
    y0, y1 = BED
    bed = box(g, CX - 17, y0, 22, CX + 17, y1, 94, "purple", 2)
    P.planks(g, bed, "purple", 2, width=4, across="x", nails=True, seed=1)
    P.flat(g, bed & (Y > y1 - 2), "purple", 3)
    P.flat(g, bed & edges(bed), "purple", 1)
    for az, r in ((FZ, FR), (RZ, RR)):  # axles and bolsters
        box(g, CX - 22, r - 2, az - 2, CX + 22, r + 2, az + 2, "gray", 3)
        box(g, CX - 10, r + 2, az - 4, CX + 10, y0, az + 4, "purple", 2)
    for s in (-1, 1):  # gold scroll valance along each side of the bed
        sx = CX + s * 17
        val = box(g, sx - 1.5, y0 - 4, 24, sx + 1.5, y1, 92, "gold", 3)
        P.flat(g, val & (Y > y0 - 1), "gold", 5)
        P.flat(g, val & (((Z.astype(int)) % 6) < 2) & (Y < y0), "gold", 5)
        P.flat(g, val & (((Z.astype(int)) % 6) == 3) & (Y < y0 - 2), "gold", 2)
    # the shafts: two poles reaching out in front for a team that is not there
    for s in (-1, 1):
        sx = CX + s * 9
        S.bar(g, "x", (y0 + 2, 24.0), (14.0, 2.0), 2.6, sx - 1.5, sx + 1.5, "purple", 2)
        box(g, sx - 2.5, 13, 2, sx + 2.5, 17, 7, "gold", 4)


def cab(g: Grid) -> None:
    """The pumpkin body: three stacked ten-sided frustums (true slopes, so
    the belly really swells), painted rib grooves, a carved arched door and
    a round window on the sides, a grinning face at the back, a hooked stem
    and a gold crescent finial."""
    X, Y, Z = coords(g)
    cx, cy, cz = CAB
    R, H = CAB_W / 2.0, CAB_H
    first = len(g.solids)
    S.cone(g, "y", cx, cz, R * 0.60, cy, cy + H * 0.26, "orange", 4, n=10, r_top=R)
    S.cone(g, "y", cx, cz, R, cy + H * 0.26, cy + H * 0.70, "orange", 4, n=10, r_top=R)
    S.cone(g, "y", cx, cz, R, cy + H * 0.70, cy + H, "orange", 4, n=10, r_top=R * 0.55)
    shell = g.solids[first:]
    body = np.logical_or.reduce([sd.mask(g.shape) for sd in shell])
    S.paint_facets(g, shell, lambda gg, mm, fr: P.planks(gg, mm, "orange", 4, width=5, across="y", length=(40, 41), nails=False, frame=fr, seed=2))
    ang = np.arctan2(Z - cz, X - cx)
    P.flat(g, body & (np.cos(ang * 10) > 0.86), "orange", 2)  # the rib grooves
    P.flat(g, body & (np.cos(ang * 10) > 0.55) & (np.cos(ang * 10) < 0.86), "orange", 3)
    P.flat(g, body & (Y > cy + H - 4), "orange", 5)  # the lit crown
    P.flat(g, body & (Y < cy + 4), "orange", 2)  # the shaded foot
    P.flat(g, body & S.seams(g, shell, 0.9), "orange", 3)
    half = R - 1.0
    # a broad flat panel on each side carries the carved opening (rule S1)
    for s, kind in ((1, "door"), (-1, "window")):
        px = cx + s * half
        panel = box(g, min(px, px + s * 3), cy + 3, cz - 13, max(px, px + s * 3), cy + H - 5, cz + 13, "orange", 4)
        P.planks(g, panel, "orange", 4, width=5, across="z", length=(40, 41), nails=False, seed=3 + s)
        P.flat(g, panel & edges(panel), "orange", 2)
        if kind == "door":
            arch = panel & (np.abs(Z - cz) < 8) & (Y > cy + 5) & (Y < cy + 25) & ((Y < cy + 18) | (np.abs(Z - cz) < 8 - (Y - (cy + 18))))
            P.flat(g, arch, "gold", 4)
            inner = arch & (np.abs(Z - cz) < 6) & (Y < cy + 23) & (Y > cy + 7)
            P.flat(g, inner, "purple", 3)
            P.flat(g, inner & (Y < cy + 15), "magenta", 5)
            P.flat(g, inner & (Y < cy + 11), "magenta", 6)
            P.flat(g, inner & (np.abs(Z - cz) < 0.8), "gold", 4)
            P.flat(g, panel & (np.abs(Z - cz) < 2.0) & (np.abs(Y - (cy + 15)) < 1.2), "gold", 6)  # the handle
            step = box(g, px, cy - 5, cz - 6, px + s * 7, cy - 2, cz + 6, "gray", 4)  # a folding step
            P.flat(g, step & (Y > cy - 3), "gray", 6)
        else:
            rr = np.hypot(Y - (cy + 18), Z - cz)
            P.flat(g, panel & (rr < 9), "gold", 4)
            P.flat(g, panel & (rr < 7.5), "magenta", 5)
            P.flat(g, panel & (rr < 7.5) & (rr > 5.0), "magenta", 4)
            P.flat(g, panel & (rr < 7.5) & ((np.abs(Y - (cy + 18)) < 0.8) | (np.abs(Z - cz) < 0.8)), "gold", 4)
            P.flat(g, panel & (rr < 3.0), "magenta", 7)
    # the carved grin at the back, lit from inside
    rear = box(g, cx - 9, cy + 4, cz + R - 3, cx + 9, cy + 26, cz + R, "orange", 4)
    P.planks(g, rear, "orange", 4, width=5, across="x", length=(40, 41), nails=False, seed=5)
    P.flat(g, rear & edges(rear), "orange", 2)
    legend = {"r": C("orange", 1), "y": C("gold", 4), "w": C("ember", 7), "o": C("orange", 3)}
    stamp(g, "+z", int(cz + R), int(cx - 6), int(cy + 6), BACK_FACE, legend, depth=3)
    # the hooked stem and a gold crescent finial on the crown
    g.prism("z", [(cx - 2.6, cy + H), (cx + 2.6, cy + H), (cx + 3.4, cy + H + 7), (cx - 1.0, cy + H + 8)], cz - 2.6, cz + 2.6, C("moss", 3))
    st = S.last(g)
    P.flat(g, st & (Y > cy + H + 5), "moss", 5)
    S.cone(g, "y", cx, cz, 3.4, cy + H + 7, cy + H + 12, "gold", 4, n=6, r_top=1.4)
    crest = box(g, cx - 8, cy + H + 11, cz - 1.5, cx + 8, cy + H + 14, cz + 1.5, "gold", 4)
    P.flat(g, crest & (np.abs(X - cx) > 5.5), "gold", 6)
    P.flat(g, crest & (np.abs(X - cx) < 1.6), "gold", 2)


def driver(g: Grid) -> None:
    """The driver's box: a planked footboard, a buttoned seat with a high
    back, gold rails and the lantern posts."""
    X, Y, Z = coords(g)
    z0, z1 = BOX_Z
    bx = box(g, CX - 15, BED[1], z0, CX + 15, BED[1] + 10, z1, "purple", 2)
    P.planks(g, bx, "purple", 2, width=4, across="x", nails=True, seed=6)
    P.flat(g, bx & edges(bx), "purple", 1)
    seat = box(g, CX - 13, BED[1] + 10, z0 + 2, CX + 13, BED[1] + 14, z1, "blood", 4)
    P.mottle(g, seat, "blood", 4, cell=3, seed=7)
    P.flat(g, seat & (((X.astype(int) - 2) % 7) == 0) & (((Z.astype(int)) % 6) == 0) & (Y > BED[1] + 12), "gold", 5)  # buttons
    back = box(g, CX - 13, BED[1] + 14, z1 - 4, CX + 13, BED[1] + 26, z1, "purple", 3)
    P.planks(g, back, "purple", 3, width=4, across="x", nails=False, seed=8)
    P.flat(g, back & (Y > BED[1] + 24), "gold", 4)
    P.flat(g, back & (np.abs(X - CX) < 1.5), "gold", 4)
    g.prism("x", [(BED[1], z0), (BED[1] + 6, z0), (BED[1] + 2, z0 - 9), (BED[1] - 3, z0 - 8)], CX - 13, CX + 13, C("purple", 2))
    foot = S.last(g)
    P.planks(g, foot, "purple", 2, width=4, across="x", nails=True, seed=9)
    P.flat(g, foot & (Y > BED[1] + 2), "purple", 3)
    for s in (-1, 1):  # gold rails and the lantern posts
        rx = CX + s * 14
        P.flat(g, box(g, rx - 1, BED[1] + 10, z0 + 2, rx + 1, BED[1] + 20, z1 - 3, "gold", 4), "gold", 4)
        box(g, rx + s * 5 - 1, BED[1] + 8, z0 - 2, rx + s * 5 + 1, 46, z0 + 1, "gray", 3)
        box(g, rx + s * 5 - 2, 44, z0 - 6, rx + s * 5 + 2, 46, z0 + 1, "gray", 4)


def coach() -> Grid:
    g = Grid(*G)
    chassis(g)
    cab(g)
    driver(g)
    return g


def wheel(side: str, az: float, r: float) -> Grid:
    g = Grid(*G)
    x0, x1 = WX[side]
    S.wheel(g, "x", az, 0, r, x0, x1, n=8, spokes=8 if r > 12 else 6, gaps=True,
            tyre=("gray", 4), rim=("purple", 2), spoke=("gold", 4), hub=("gold", 6))
    return g


def lamp(name: str) -> Grid:
    """A silver coach lantern with a toxic flame and a pyramid cap."""
    g = Grid(*G)
    X, Y, Z = coords(g)
    lx, ly, lz = LAMP[name]
    box(g, lx - 0.5, ly + 3, lz - 0.5, lx + 0.5, ly + 5, lz + 0.5, "gray", 5)
    body = box(g, lx - 3, ly - 4, lz - 3, lx + 3, ly + 3, lz + 3, "toxic", 6)
    P.flat(g, body & ((np.abs(X - lx) > 1.8) & (np.abs(Z - lz) > 1.8)), "gray", 5)
    P.flat(g, body & ((Y < ly - 3) | (Y > ly + 2)), "gray", 5)
    P.flat(g, body & (np.abs(Y - ly) < 1.4) & (np.abs(X - lx) < 1.4), "toxic", 7)
    S.cone(g, "y", lx, lz, 4.0, ly + 3, ly + 6, "gray", 4, n=4)
    P.flat(g, S.last(g) & (Y < ly + 4), "gray", 6)
    box(g, lx - 3.5, ly - 6, lz - 3.5, lx + 3.5, ly - 4, lz + 3.5, "gray", 4)
    return g


def pennant() -> Grid:
    """A crooked staff with a torn purple pennant and a painted bone cross."""
    g = Grid(*G)
    X, Y, Z = coords(g)
    sx, sy, sz = STAFF
    S.bar(g, "z", (sx, sy), (sx + 3, sy + 26), 2.0, sz - 1, sz + 1, "wood", 4)
    g.prism("z", [(sx + 2, sy + 24), (sx + 2, sy + 10), (sx + 13, sy + 14), (sx + 9, sy + 17), (sx + 16, sy + 21)], sz - 1.0, sz + 1.0, C("purple", 5))
    m = S.last(g)
    P.mottle(g, m, "purple", 5, cell=2, seed=10)
    P.outline(g, m, "purple", 3, normal="z")
    P.flat(g, m & (np.abs(X - (sx + 6)) < 1.0) & (Y > sy + 13) & (Y < sy + 21), "bone", 6)
    P.flat(g, m & (np.abs(Y - (sy + 18)) < 1.0) & (X > sx + 3) & (X < sx + 10), "bone", 6)
    box(g, sx + 2, sy + 26, sz - 1.5, sx + 5, sy + 29, sz + 1.5, "gold", 5)
    return g


def build() -> Asset:
    grids = {"coach": coach(), "pennant": pennant()}
    joints = [("coach", None, (CX, RR, RZ)), ("pennant", "coach", STAFF)]
    for name in LAMP:
        grids[name] = lamp(name)
        joints.append((name, "coach", (LAMP[name][0], LAMP[name][1] + 5.0, LAMP[name][2])))
    wheels = {}
    for side in ("l", "r"):
        for end, az, r in (("f", FZ, FR), ("b", RZ, RR)):
            name = f"wheel-{side}{end}"
            grids[name] = wheel(side, az, r)
            joints.append((name, "coach", ((WX[side][0] + WX[side][1]) / 2, r, az)))
            wheels[name] = {"rot": turn(1.2, "x", -300)}
    root = parts(grids, joints)
    z3 = (0.0, 0.0, 0.0)
    move = dict(wheels)
    move["coach"] = {"rot": [(t, (a, 0.0, 0.0)) for t, a in ((0.0, 0.0), (0.3, -1.8), (0.6, 0.0), (0.9, 1.8), (1.2, 0.0))],
                     "loc": [(t, (0.0, y, 0.0)) for t, y in ((0.0, 0.0), (0.3, 0.8), (0.6, 0.0), (0.9, 0.8), (1.2, 0.0))]}
    for name in LAMP:
        move[name] = {"rot": [(t, (0.0, 0.0, a)) for t, a in ((0.0, 0.0), (0.3, 11.0), (0.6, 0.0), (0.9, -11.0), (1.2, 0.0))]}
    move["pennant"] = {"rot": [(t, (0.0, a, 0.0)) for t, a in ((0.0, -6.0), (0.4, 7.0), (0.8, -4.0), (1.2, -6.0))]}
    idle = {"coach": {"rot": [(t, (a, 0.0, 0.0)) for t, a in ((0.0, 0.0), (1.5, 0.8), (3.0, 0.0))]}}
    for k, name in enumerate(LAMP):
        idle[name] = {"rot": [(t, (0.0, 0.0, a)) for t, a in ((0.0, 0.0), (0.75 + k * 0.1, 5.0), (1.5, 0.0), (2.25 - k * 0.1, -5.0), (3.0, 0.0))]}
    idle["pennant"] = {"rot": [(t, (0.0, a, 0.0)) for t, a in ((0.0, 0.0), (1.0, 5.0), (2.0, -4.0), (3.0, 0.0))]}

    def rel(p, j=(CX, RR, RZ)):
        return (p[0] - j[0], p[1] - j[1], p[2] - j[2])

    cx, cy, cz = CAB
    return Asset(
        id="monster-vehicles-pumpkin-coach", pack="monster", category="vehicles", name="Pumpkin Coach", root=root,
        clips=[Clip("move", move), Clip("idle", idle)],
        sockets=[Socket("socket-lamp-l", at=(0.0, -5.0, 0.0), parent="lamp-l"),
                 Socket("socket-lamp-r", at=(0.0, -5.0, 0.0), parent="lamp-r"),
                 Socket("socket-cab", at=rel((cx, cy + 18.0, cz + 24.0)), parent="coach")],
        pfx=[{"effectId": "rvx-monster-candle-flame", "socket": "socket-lamp-l", "trigger": "idle", "size": 12},
             {"effectId": "rvx-monster-candle-flame", "socket": "socket-lamp-r", "trigger": "idle", "size": 12},
             {"effectId": "rvx-monster-ghost-wake", "socket": "socket-cab", "trigger": "clip:move", "size": 40}],
    )
