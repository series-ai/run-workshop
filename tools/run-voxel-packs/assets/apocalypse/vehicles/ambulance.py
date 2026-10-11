"""A fortified rescue ambulance with a working warning beacon."""
import numpy as np

import paint as P
import pnglyph
import pnpaint as PP
import pnshapes as S
from _bld import bloom, label, rig, wheel_grid
from pnkit import box, edges
from voxgrid import C, Asset, Grid

GW, GH, GD = 62, 78, 112
X0, X1 = 10, 52
Z0, Z1 = 5, 104
REAR = 101  # the rear face of the body profile; rear parts start here
R, TW = 11, 8


def build() -> Asset:
    g = Grid(GW, GH, GD)
    X, Y, Z = S.coords(g)
    profile = [(10, 12), (10, 29), (15, 34), (29, 37), (37, 57), (42, 61), (96, 61), (101, 56), (101, 12)]
    g.prism("x", [(y, z) for z, y in profile], X0, X1, C("bone", 6))
    shell = S.last(g)
    side = shell & ((X < X0+1) | (X >= X1-1))
    P.plates(g, shell, "bone", 6, size=(16, 12), seed=2)
    P.flat(g, shell & (Y < 21), "steel", 5)
    P.flat(g, shell & (Y >= 21) & (Y < 26), "red", 5)
    P.flat(g, shell & (Y >= 58), "bone", 7)
    # Windshield and side windows fit the cabin slopes.
    windshield = shell & (Z >= 25) & (Z < 36) & (Y >= 38) & (Y < 54) & (X > X0 + 3) & (X < X1 - 3)
    P.flat(g, windshield, "sky", 5)
    P.flat(g, windshield & (Y % 5 == 0), "steel", 4)
    side_window = side & (Y >= 40) & (Y < 55) & (Z >= 47) & (Z < 67)
    P.flat(g, side_window, "sky", 5)
    P.flat(g, side_window & (Z % 4 == 0), "steel", 4)
    for z in (71, 85):
        win = side & (Y >= 35) & (Y < 49) & (Z >= z) & (Z < z + 10)
        P.flat(g, win, "navy", 2)
        P.flat(g, win & ((Y + Z) % 7 < 2), "sky", 4)
        P.outline(g, win, "steel", 5, normal="x")
    cab_window=side & (Y >= 38) & (Y < 55) & (Z >= 37) & (Z < 49)
    P.flat(g,cab_window,"navy",3)
    P.outline(g,cab_window,"steel",5,normal="x")
    doorseam=side & (Y > 23) & (Y < 54) & ((np.abs(Z-37)<1) | (np.abs(Z-50)<1))
    P.flat(g,doorseam,"steel",3)
    for xx in (9,52):
        box(g,xx,32,45,xx+1,34,49,"gold",5)
    # Large rescue cross and readable side label.
    for x in (X0, X1 - 1):
        xface = "+x" if x == X1 - 1 else "-x"
        pnglyph.icon(g, xface, X1 if x == X1 - 1 else X0, 73, 30, "cross", "red", 4)
        label(g, xface, X1 if x == X1 - 1 else X0, 39, 29, "RESCUE", "red", 5, scale=2)
    # Reinforced nose, grille, glass lamps and hazard bumper.
    grille = box(g, 20, 13, Z0 - 1, 42, 25, Z0, "steel", 6)
    P.flat(g, grille & ((X - 20) % 3 == 0), "iron", 4)
    P.outline(g, grille, "steel", 3, normal="z")
    for x in (15, 47):
        S.disc(g, "z", x, 21, 4, 1, 5, "gold", 7, n=8)
    bumper = box(g, X0 - 3, 6, 0, X1 + 3, 12, 7, "steel", 5)
    PP.hazard(g, bumper, period=7)
    P.flat(g, edges(bumper), "steel", 3)
    # Rear doors, step, spare tyre and roof equipment.
    P.flat(g, shell & (Z >= 100) & (Y >= 27) & (Y < 54) & (np.abs(X - 31) < 2), "red", 5)
    P.flat(g,shell & (Z >= 100) & (np.abs(X-31)<1.0),"steel",3)
    for xx in (27,34):
        box(g,xx,32,101,xx+3,35,103,"gold",5)
    # The step and the spare tyre sit flush on the rear face (no gap).
    step = box(g, X0 + 2, 10, REAR, X1 - 2, 14, REAR + 4, "steel", 5)
    P.flat(g, step & (Y > 13), "steel", 6)
    P.flat(g, edges(step), "steel", 3)
    S.tyre(g, "z", 31, 36, 8, REAR, REAR + 5, rubber=("gray", 3), hub=("red", 5), n=8)
    rack = box(g, 15, 61, 60, 47, 64, 91, "steel", 5)
    P.flat(g, rack & (Z % 5 == 0), "steel", 3)
    box(g, 21, 64, 68, 41, 69, 83, "red", 5)
    # Beacon lights on a raised, armored light bar.
    box(g, 18, 62, 43, 44, 65, 50, "steel", 5)
    box(g, 20, 65, 43, 27, 70, 50, "red", 6)
    box(g, 35, 65, 43, 42, 70, 50, "blue", 6)
    socket_beacon = (23.5, 70, 46.5)
    pipe = S.disc(g, "y", 50, 96, 2, 18, 58, "iron", 5, n=8)
    P.flat(g, pipe & (Y > 53), "darkwood", 4)
    bloom(g, shell, 5, ((X0, 12, Z0), (X1, 57, Z1)), r=(2.0, 3.5), ramp="rust", shades=(5, 4), seed=4)
    wheels = [wheel_grid(g.shape, x0, x0 + TW, z, R, rim=("steel", 5), hub=("red", 5), spokes=6, tyre=("gray", 3))
              for z in (25, 82) for x0 in (X0 - 5, X1 - 3)]
    root, clips, sockets = rig("ambulance", g, wheels, (50, 58, 96), spin_s=0.9, bounce=0.4,
                               extra_sockets=[("socket-beacon", socket_beacon)])
    return Asset(id="apocalypse-vehicles-ambulance", pack="apocalypse", category="vehicles", name="Fortified Ambulance",
                 root=root, clips=clips, sockets=sockets,
                 pfx=[{"effectId": "rvx-apocalypse-engine-smoke", "socket": "socket-exhaust", "trigger": "clip:move", "size": 22},
                      {"effectId": "rvx-apocalypse-lamp-flicker", "socket": "socket-beacon", "trigger": "idle", "size": 18}])
