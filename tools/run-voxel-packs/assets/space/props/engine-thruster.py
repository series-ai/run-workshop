"""Starship engine thruster on maintenance cradle, in the Pirate Nation mecha style.

One iconic shape (rule K3): an oversized starship rocket bell nozzle resting on
a wheeled engine shop stand. The assembly features an octagonal converging-
diverging rocket nozzle (F2) in heat-tinted steel plates with copper injector
manifold hoops and gimbal pivot actuators (F3, F4). Inside the bell lies a
glowing cyan plasma ignition core. A copper propellant feed line and high-
pressure turbopump sit at the combustion chamber head. The tubular steel
cradle stand has four heavy caster wheels and yellow hazard rails. Sockets at
the nozzle exhaust emit drive plume effects. Detail is paint (S1). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnpaint
from _pn import pipe
from _props import dots, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part, Socket

W, H, D = 22, 22, 28
CX, CY = 11.0, 13.0
Z_NOZZLE_LIP = 4
Z_THROAT = 17
Z_HEAD = 26


def thruster() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    # Wheeled engine cradle stand (Y=0 to 8):
    # 4 Caster wheels at corners
    for wx, wz in ((3.5, 6.5), (W - 3.5, 6.5), (3.5, D - 4.5), (W - 3.5, D - 4.5)):
        wheel = ngon_prism(g, "y", wx, wz, 2.2, 0, 3, "iron", 4, n=8)
        P.flat(g, wheel, "iron", 4)
        P.flat(g, wheel & (np.floor(X + Z) % 2 == 0), "iron", 3)
        # Wheel axle pin
        dots(g, wheel, "top", [(wx, wz)], 0.8, "gold", 6)

    # Cradle longitudinal rails and crossbars (Y=3 to 6)
    rail_l = box(g, 2, 3, 4, 5, 5, D - 2, "steel", 4)
    P.flat(g, edges(rail_l), "steel", 3)
    pnpaint.hazard(g, rail_l & (coords(g)[0] < 3), period=4, a=("orange", 5), b=("iron", 4))

    rail_r = box(g, W - 5, 3, 4, W - 2, 5, D - 2, "steel", 4)
    P.flat(g, edges(rail_r), "steel", 3)
    pnpaint.hazard(g, rail_r & (coords(g)[0] > W - 3), period=4, a=("orange", 5), b=("iron", 4))

    # Cross beams at front and back
    cross_f = box(g, 2, 3, 5, W - 2, 5, 8, "steel", 4)
    P.flat(g, edges(cross_f), "steel", 3)
    cross_b = box(g, 2, 3, D - 6, W - 2, 5, D - 3, "steel", 4)
    P.flat(g, edges(cross_b), "steel", 3)

    # V-shaped cradle saddles supporting the thruster bell and chamber
    # Saddle 1: under the throat (Z=15 to 18, Y=5 to 10)
    saddle1 = box(g, CX - 5, 5, 15, CX + 5, 9, 18, "iron", 5)
    # V cutout
    inner1 = box(g, CX - 3, 7, 15, CX + 3, 10, 18, "steel", 1)
    saddle1 &= ~inner1
    P.flat(g, saddle1, "iron", 5)
    P.flat(g, edges(saddle1), "iron", 3)

    # Saddle 2: under the chamber (Z=21 to 24, Y=5 to 10)
    saddle2 = box(g, CX - 6, 5, 21, CX + 6, 9, 24, "iron", 5)
    inner2 = box(g, CX - 4, 7, 21, CX + 4, 10, 24, "steel", 1)
    saddle2 &= ~inner2
    P.flat(g, saddle2, "iron", 5)
    P.flat(g, edges(saddle2), "iron", 3)

    # THRUSTER ROCKET BELL NOZZLE (along Z axis):
    # Diverging bell: Z=Z_NOZZLE_LIP (4) to Z_THROAT (17)
    # At Z=4: radius 8.0. At Z=17: radius 4.2. (true slopes F2)
    bell = ngon_prism(g, "z", CX, CY, 8.0, Z_NOZZLE_LIP, Z_THROAT, "steel", 4, n=8, r_top=4.2)
    P.flat(g, edges(bell), "steel", 3)
    # Heat discolouration banding on bell: copper/heat-temper near throat
    R = np.hypot(X - CX, Y - CY)
    P.flat(g, bell & (Z > 12), "rust", 4)
    P.flat(g, bell & (Z > 14), "rust", 5)
    # Bell reinforcement hoop ring at Z=8 to 10
    hoop_bell = ngon_prism(g, "z", CX, CY, 7.2, 8, 10, "rust", 5, n=8, r_top=6.4)
    P.flat(g, edges(hoop_bell), "rust", 4)
    P.flat(g, hoop_bell & (np.floor(X + Y) % 3 == 0), "rust", 6)

    # Inside nozzle cavity: recessed interior with glowing plasma injector core
    cavity = ngon_prism(g, "z", CX, CY, 6.5, Z_NOZZLE_LIP, Z_THROAT - 2, "steel", 2, n=8, r_top=2.8)
    P.flat(g, cavity, "steel", 3)
    P.flat(g, cavity & (Z > Z_NOZZLE_LIP + 2), "cyan", 3)
    P.flat(g, cavity & (Z > Z_NOZZLE_LIP + 5), "cyan", 5)
    P.flat(g, cavity & (Z > Z_NOZZLE_LIP + 8), "cyan", 6)
    # Plasma injector hub at the center of the throat
    injector = ngon_prism(g, "z", CX, CY, 2.5, Z_THROAT - 4, Z_THROAT, "cyan", 6, n=8)
    P.flat(g, injector, "cyan", 6)
    P.flat(g, injector & (Z == Z_THROAT - 4), "cyan", 7)
    P.flat(g, injector & (R < 1.2), "cyan", 7)
    # The bell mouth reads as an open nozzle: a steel lip around a glowing core.
    lip = (g.a != 0) & (Z < Z_NOZZLE_LIP + 1) & (R < 8.5)
    P.flat(g, lip, "steel", 5)
    P.flat(g, lip & (R < 7.0), "steel", 3)
    P.flat(g, lip & (R < 6.2), "cyan", 2)
    P.flat(g, lip & (R < 4.6), "cyan", 4)
    P.flat(g, lip & (R < 3.0), "cyan", 6)
    P.flat(g, lip & (R < 1.6), "cyan", 7)

    # COMBUSTION CHAMBER (Z=Z_THROAT to Z_HEAD):
    # Cylindrical chamber (radius 5.5, Z=17 to 25)
    chamber = ngon_prism(g, "z", CX, CY, 5.5, Z_THROAT, 25, "bone", 5, n=8)
    P.flat(g, edges(chamber), "bone", 3)
    P.plates(g, chamber, "bone", 5, size=(6, 5))

    # Copper injector manifold ring at chamber forward head (Z=20 to 22)
    ring = ngon_prism(g, "z", CX, CY, 6.2, 20, 22, "rust", 5, n=8)
    P.flat(g, edges(ring), "rust", 3)
    P.flat(g, ring & (np.floor(X + Y) % 2 == 0), "rust", 6)

    # Dome head closure on back (Z=25 to 27)
    head_dome = ngon_prism(g, "z", CX, CY, 4.5, 25, 27, "steel", 4, n=8, r_top=2.5)
    P.flat(g, edges(head_dome), "steel", 3)

    # Propellant turbopump and bypass piping on top-right:
    # High pressure pump block on chamber head (X=CX+3 to CX+7, Y=CY+2 to CY+6, Z=21 to 25)
    pump_block = box(g, CX + 3, CY + 2, 21, CX + 7, CY + 6, 25, "rust", 5)
    P.flat(g, edges(pump_block), "rust", 3)
    dots(g, pump_block, "+z", [(CX + 5, CY + 4)], 1.0, "gold", 6)

    # Turbopump feed pipe looping down to chamber
    pts = [
        (CX + 5.0, CY + 4.0, 23.0),
        (CX + 5.0, CY + 7.5, 23.0),
        (CX, CY + 7.5, 21.0),
        (CX, CY + 5.5, 21.0),
    ]
    pipe(g, pts, s=2, ramp="rust", base=5, flange=True)

    # Gimbal hydraulic actuator struts on left and bottom (steel/copper cylinders)
    gimbal_l = box(g, CX - 7, CY - 1, 18, CX - 5, CY + 1, 23, "steel", 5)
    P.flat(g, edges(gimbal_l), "steel", 3)
    rod_l = box(g, CX - 6.5, CY - 0.5, 15, CX - 5.5, CY + 0.5, 18, "rust", 6)

    return g


def build() -> Asset:
    root = Part("engine-thruster", thruster())
    # Sockets for rocket engine exhaust plume at nozzle exit (Z=Z_NOZZLE_LIP)
    socket_exhaust = Socket("socket-exhaust", at=(float(CX), float(CY), float(Z_NOZZLE_LIP)))
    return Asset(
        id="space-props-engine-thruster",
        pack="space",
        category="props",
        name="Starship Engine Thruster",
        root=root,
        sockets=[socket_exhaust],
        pfx=[{"effectId": "rvx-space-engine-exhaust", "socket": "socket-exhaust", "trigger": "idle", "size": 16}],
    )
