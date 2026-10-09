"""A wasteland motor home (a Class C camper), in the Pirate Nation style.

Its own massing, not the ambulance van: a narrow cab with a long sloped
hood and windscreen sits under a cab-over bunk that bulges forward over
the windscreen. Behind the cab a long, flat-sided living box runs back on
three axles (one front, a tandem pair at the rear). A roll-out awning on
the +x side hangs from a roller case at the roof edge; a roof air
conditioner, a vent and a rear ladder sit on top. Two-tone paint: a cream
upper box over brown ribbed siding, with three retro stripes that sweep
up over the bunk nose (rule S1). Rear parts sit flush on the rear face.
Wheels roll on `move`, the body idles on `idle`, and the awning dips on
`active`. Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _bld import bloom, label, rig, wheel_grid
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Socket

GW, GH, GD = 72, 86, 134
X0, X1 = 8, 54  # the living box sides
CX0, CX1 = 11, 51  # the cab sides (narrower than the box)
NOSE, REAR = 5, 128  # the cab nose and the rear face
FLOOR = 14  # the living box underside
BELT = 34  # the two-tone line on the living box
ROOF = 76
R, TW = 11, 8
AXLES = (19, 92, 115)
# side profiles as (z, y), front to back
BOX = [(42, FLOOR), (42, 52), (24, 55), (19, 60), (19, 68), (23, 74), (30, ROOF), (122, ROOF), (REAR, 71), (REAR, FLOOR)]
CAB = [(NOSE, 12), (NOSE, 27), (NOSE + 3, 31), (20, 33), (31, 56), (44, 56), (44, 12)]
HINGE = (float(X1 + 2), 70.0, 76.0)  # the awning roller axis point
LAMP = (float(X1 + 3), 58.0, 68.0)  # the porch lamp face


def windscreen_z(y):
    """z of the windscreen slope at height y (from (20, 33) to (31, 56))."""
    return 20 + (y - 33) * 11 / 23


def build() -> Asset:
    g = Grid(GW, GH, GD)
    X, Y, Z = S.coords(g)

    # ---- the living box with the cab-over bunk (one prism across x)
    g.prism("x", [(y, z) for z, y in BOX], X0, X1, C("bone", 6))
    living = S.last(g)
    side = living & ((X < X0 + 1) | (X >= X1 - 1))
    # cream upper box: soft panels framed by vertical seams every 20 (rule S4)
    P.mottle(g, living, "bone", 6, cell=16, seed=3)
    P.flat(g, side & (np.floor(Z) % 20 == 0) & (Y > BELT), "bone", 4)
    P.flat(g, living & (Y > ROOF - 1), "steel", 6)  # the roof skin
    P.flat(g, living & (Y > ROOF - 1) & (np.floor(Z) % 12 == 0), "steel", 5)
    # brown ribbed siding below the belt line
    low = living & (Y < BELT)
    PP.corrugate(g, low, "wood", 4, period=3, sheet=12, length=26, frame=((0, 1, 0), (0, 0, 1)), seed=4)
    P.flat(g, living & (Y < FLOOR + 1), "wood", 2)
    # three retro stripes along the belt; they sweep up over the bunk nose
    yb = BELT + np.clip(42 - Z, 0, 30) * 1.15
    for k, (ramp, shade) in enumerate((("orange", 5), ("gold", 5), ("rust", 4))):
        P.flat(g, living & (Y >= yb + k * 2) & (Y < yb + k * 2 + 2), ramp, shade)

    # ---- the cab: a narrower prism with a long hood under the bunk
    g.prism("x", [(y, z) for z, y in CAB], CX0, CX1, C("wood", 4))
    cab = S.last(g)
    cab_side = cab & ((X < CX0 + 1) | (X >= CX1 - 1))
    P.mottle(g, cab, "bone", 6, cell=16, seed=5)
    P.flat(g, cab & (Y < 27), "wood", 4)
    P.flat(g, cab & (Y >= 25) & (Y < 27), "orange", 5)
    P.flat(g, cab & (Y >= 27) & (Y < 28), "gold", 5)
    P.flat(g, cab & (Y > 30) & (Z < 20), "bone", 7)  # the hood top
    windscreen = cab & (Y >= 35) & (Y < 53) & (Z < windscreen_z(Y) + 2) & (Z >= 21) & (X > CX0 + 2) & (X < CX1 - 3)
    P.flat(g, windscreen, "sky", 5)
    P.flat(g, windscreen & ((X - Y) % 19 < 2), "sky", 7)  # a glare streak
    cab_glass = cab_side & (Y >= 36) & (Y < 51) & (Z >= 30) & (Z < 40)
    P.flat(g, cab_glass, "sky", 4)
    P.outline(g, cab_glass, "steel", 4, normal="x")
    P.flat(g, cab_side & (np.abs(Z - 41) < 0.6) & (Y > 14) & (Y < 52), "wood", 2)  # the door seam
    for xx in (CX0 - 1, CX1):
        box(g, xx, 30, 36, xx + 1, 32, 39, "steel", 6)  # door handles
        box(g, xx - (2 if xx < CX0 else -1), 42, 26, xx + (1 if xx < CX0 else 3), 46, 29, "steel", 4)  # mirrors

    # ---- glass on the box: bunk windows, living windows with curtains, a door
    bunk_front = living & (Z < 24) & (Y >= 61) & (Y < 70) & (np.abs(X - (X0 + X1) / 2) < 14)
    P.flat(g, bunk_front, "navy", 4)
    P.flat(g, bunk_front & ((X + Y) % 11 < 2), "sky", 5)
    P.outline(g, bunk_front, "steel", 5, normal="z")
    for zw0, zw1 in ((27, 38),):
        win = side & (Y >= 60) & (Y < 70) & (Z >= zw0) & (Z < zw1)
        P.flat(g, win, "navy", 4)
        P.outline(g, win, "steel", 5, normal="x")

    def window(face_x: str, z0: int, z1: int, y0: int = 44, y1: int = 62) -> None:
        on = side & ((X < X0 + 1) if face_x == "-x" else (X >= X1 - 1))
        win = on & (Y >= y0) & (Y < y1) & (Z >= z0) & (Z < z1)
        P.flat(g, win, "navy", 4)
        P.flat(g, win & ((Z - z0) < 4), "gold", 5)  # a half-drawn curtain
        P.flat(g, win & ((Z - z0) < 4) & (Y % 3 == 0), "gold", 4)
        P.flat(g, win & ((Z - z0) >= 4) & ((Y + Z) % 13 < 2), "sky", 5)
        P.outline(g, win, "steel", 5, normal="x")

    window("-x", 50, 70)
    window("-x", 78, 96)
    window("-x", 104, 116, 48, 62)
    window("+x", 48, 64)
    window("+x", 92, 110)
    # the entry door on the +x side, under the awning
    door = side & (X >= X1 - 1) & (Y >= FLOOR + 1) & (Y < 62) & (Z >= 70) & (Z < 84)
    P.flat(g, door, "bone", 5)
    P.flat(g, door & (Y >= 46) & (Y < 57) & (Z >= 72) & (Z < 82), "navy", 4)
    P.outline(g, door, "wood", 2, normal="x")
    box(g, X1, 34, 81, X1 + 1, 37, 83, "steel", 6)  # the door handle
    step = box(g, X1, 9, 70, X1 + 4, 14, 84, "steel", 5)  # a fold-down step, flush on the side
    P.flat(g, step & (Y > 13), "steel", 6)
    P.flat(g, edges(step), "steel", 3)
    # storage hatches in the siding
    for face_x in (X0, X1 - 1):
        hatch = side & (np.floor(X) == face_x) & (Y >= FLOOR + 2) & (Y < BELT - 3) & (Z >= 100) & (Z < 110)
        P.flat(g, hatch, "wood", 5)
        P.outline(g, hatch, "wood", 2, normal="x")
    # a flat name plaque on the -x siding (text on the ribs does not read)
    plaque = side & (X < X0 + 1) & (Y >= FLOOR + 4) & (Y < FLOOR + 15) & (Z >= 48) & (Z < 74)
    P.flat(g, plaque, "bone", 6)
    P.outline(g, plaque, "wood", 2, normal="x")
    label(g, "-x", X0, 61, FLOOR + 6, "HOME", "rust", 3, scale=1)

    # ---- nose: a chrome grille, square lamps and a chrome bumper
    grille = box(g, 19, 13, NOSE - 1, 43, 24, NOSE, "steel", 6)
    P.flat(g, grille & (Y % 3 == 0), "steel", 4)
    P.outline(g, grille, "steel", 3, normal="z")
    for lx in (13, 44):
        lamp = box(g, lx, 16, NOSE - 1, lx + 6, 22, NOSE, "gold", 7)
        P.outline(g, lamp, "steel", 4, normal="z")
    bumper = box(g, CX0 - 2, 6, NOSE - 3, CX1 + 2, 12, NOSE, "steel", 6)
    P.flat(g, bumper & (Y < 8), "steel", 4)
    P.outline(g, bumper, "steel", 3, normal="z")

    # ---- flared fenders over the wheels (true slopes)
    for z0, z1 in ((AXLES[0] - 14, AXLES[0] + 14), (AXLES[1] - 14, AXLES[2] + 14)):
        for fx0, fx1 in ((X0 - 3, X0), (X1, X1 + 3)):
            if z0 < 30:  # the cab is narrower: the front fender reaches its side
                fx0, fx1 = (CX0 - 4, CX0) if fx0 < X0 else (CX1, CX1 + 4)
            g.prism("x", [(22, z0), (27, z0 + 4), (27, z1 - 4), (22, z1)], fx0, fx1, C("wood", 3))
            f = S.last(g)
            P.flat(g, f & (Y >= 26), "wood", 4)

    # ---- the rear: flush window, tail lights, bumper, ladder and hitch
    rear = living & (Z >= REAR - 1)
    rwin = rear & (Y >= 48) & (Y < 62) & (X >= 22) & (X < 40)
    P.flat(g, rwin, "navy", 4)
    P.outline(g, rwin, "steel", 5, normal="z")
    for tx in (X0 + 2, X1 - 6):
        P.flat(g, rear & (X >= tx) & (X < tx + 4) & (Y >= 18) & (Y < 28), "red", 5)
    rb = box(g, X0, 9, REAR, X1, 15, REAR + 3, "steel", 5)
    P.outline(g, rb, "steel", 3, normal="z")
    box(g, 29, 8, REAR + 3, 33, 11, REAR + 6, "iron", 5)  # the tow hitch, on the bumper
    for lx in (X0 + 3, X0 + 9):  # the ladder rails stand on the bumper and touch the rear face
        S.bar(g, "z", (lx, 15), (lx, ROOF + 2), 1.4, REAR, REAR + 2, "steel", 5)
    for ly in range(20, ROOF, 7):
        S.bar(g, "x", (ly, REAR), (ly, REAR + 2), 1.0, X0 + 3, X0 + 10, "steel", 6)

    # ---- the roof: an air conditioner, a vent and the awning roller case
    ac = box(g, 22, ROOF, 70, 40, ROOF + 6, 88, "bone", 6)
    P.flat(g, edges(ac), "steel", 5)
    P.flat(g, ac & (Y > ROOF + 5), "bone", 7)
    for face_z in (70, 87):
        P.flat(g, ac & (np.floor(Z) == face_z) & (Y > ROOF + 1) & (Y < ROOF + 5) & (X % 2 == 0), "steel", 4)  # grille slots
    fan = S.disc(g, "y", 31, 79, 4.5, ROOF + 6, ROOF + 7, "steel", 5, n=8)
    P.flat(g, fan & (np.hypot(X - 31, Z - 79) < 1.5), "steel", 7)
    vent = box(g, 36, ROOF, 104, 44, ROOF + 3, 112, "steel", 5)
    P.flat(g, vent & (Y > ROOF + 2), "sky", 4)
    case = box(g, X1, 68, 48, X1 + 4, 72, 104, "steel", 5)
    P.flat(g, case & (Y > 71), "steel", 6)
    P.flat(g, edges(case), "steel", 3)
    # the porch lamp on the +x wall, under the awning
    S.disc(g, "x", LAMP[1], LAMP[2], 2.2, X1, X1 + 2, "steel", 5, n=8)
    lamp = S.disc(g, "x", LAMP[1], LAMP[2], 1.4, X1 + 2, LAMP[0], "gold", 7, n=8)
    P.flat(g, lamp & (X > X1 + 2.5), "bone", 7)

    # ---- the exhaust: a stub under the rear overhang, touching the floor
    pipe = S.disc(g, "z", X1 - 8, FLOOR - 1.5, 1.6, REAR - 8, REAR + 2, "iron", 5, n=8)
    P.flat(g, pipe & (Z > REAR), "darkwood", 4)
    exhaust = (X1 - 8, FLOOR - 1.5, REAR + 2)

    shell = living | cab
    bloom(g, shell & (Y < BELT), 6, ((X0, FLOOR, NOSE), (X1, BELT, REAR)), r=(2.0, 3.5), ramp="rust", shades=(5, 4), seed=7)
    P.grime(g, shell & (Y < FLOOR + 4), height=3, seed=9)

    wheels = [wheel_grid(g.shape, x0, x0 + TW, z, R, rim=("steel", 6), hub=("bone", 6), spokes=5, tyre=("gray", 3))
              for z in AXLES for x0 in ((CX0 - 6, CX1 - 2) if z < 30 else (X0 - 4, X1 - 4))]
    root, clips, sockets = rig("rv-camper", g, wheels, exhaust, spin_s=1.0, bounce=0.4,
                               body_parts=[("awning", awning_grid(), HINGE, (0.0, 0.0, 0.0), None, None)],
                               extra_sockets=[("socket-awning-lamp", LAMP)])
    awning_point = (float(X1 + 15), 63.5, 76.0)  # the middle of the canopy's outer edge
    sockets.append(Socket("socket-awning", at=tuple(awning_point[i] - root.pivot[i] for i in range(3)), parent="awning"))
    open_awning = [(0.0, (0.0, 0.0, 0.0)), (0.5, (0.0, 0.0, -12.0)), (1.0, (0.0, 0.0, -12.0)), (1.5, (0.0, 0.0, 0.0))]
    clips.append(Clip("active", {"awning": {"rot": open_awning}}))
    return Asset(id="apocalypse-vehicles-rv-camper", pack="apocalypse", category="vehicles", name="Wasteland Camper",
                 root=root, clips=clips, sockets=sockets,
                 pfx=[{"effectId": "rvx-apocalypse-exhaust-smoke", "socket": "socket-exhaust", "trigger": "clip:move", "size": 24},
                      {"effectId": "rvx-apocalypse-lamp-flicker", "socket": "socket-awning-lamp", "trigger": "idle", "size": 14}])


def awning_grid() -> Grid:
    """The rolled-out canopy: it leaves the roller case and slopes down and
    out, with striped cloth, end arms and a scalloped valance."""
    g = Grid(GW, GH, GD)
    X, Y, Z = S.coords(g)
    hx, hy = HINGE[0], HINGE[1]
    g.prism("z", [(hx - 1, hy - 1), (X1 + 16, 63), (X1 + 16, 65), (hx - 1, hy + 1)], 50, 102, C("orange", 5))
    cloth = S.last(g)
    P.flat(g, cloth & ((np.floor(Z / 6) % 2) == 0), "bone", 6)
    P.flat(g, cloth & (X > X1 + 14), "orange", 3)  # the valance
    P.flat(g, cloth & (X > X1 + 14) & (np.floor(Z) % 3 == 0), "orange", 2)  # its scallops
    for z in (50, 100):  # the end arms in the canopy plane
        S.bar(g, "z", (hx, hy), (X1 + 16, 64), 1.4, z, z + 2, "steel", 5)
    return g
