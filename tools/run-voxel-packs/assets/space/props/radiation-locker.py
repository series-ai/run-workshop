"""Lead-lined radiation containment locker, in the Pirate Nation mecha style.

One iconic shape (rule K3): an imposing reinforced heavy hazard vault for
radioactive isotopes, fuel rods, and contaminated survey samples. A chamfered
iron plinth with yellow-and-black hazard chevron perimeter anchors the base (F3).
The main lead-lined vault cabinet is cast in thick steel plates with corner
gussets and dog-clamp compression latches (F2). The recessed vault door features
a prominent stencil radiation trefoil symbol in warning gold (F4), an oversized
3-spoke copper vault handwheel, and an analog rad-counter dial. On top, an amber
purge beacon and a filtered HEPA exhaust vent. On the flank, a portable Geiger
counter wand sits in an exterior holster with coiled cable (F5).
Detail is paint (S1). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import cham_prism, dots, hull, ngon_prism, panel
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part, Socket

W, H, D = 22, 38, 18
CX = 11.0
CY_BASE = 3
CY_TOP = 32


def locker_body() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    # Base heavy plinth (Y=0 to 3, X=2 to 20, Z=2 to 16)
    base = cham_prism(g, "y", 2, 2, 20, 16, 2.5, 0, CY_BASE, "iron", 4)
    for f, fr in facets(g, g.solids[-1:]):
        pnpaint.hazard(g, f, period=4, a=("orange", 5), b=("iron", 4), frame=fr)
    P.flat(g, edges(base), "iron", 3)

    # Main reinforced vault cabinet body (Y=3 to 33, X=3 to 19, Z=3 to 15)
    body = cham_prism(g, "y", 3, 3, 19, 15, 2.0, CY_BASE, CY_TOP, "steel", 4)
    hull(g, body, "steel", 4, size=(6, 8), seed=19)
    P.flat(g, edges(body), "steel", 3)

    # Heavy corner gussets / reinforcement armor bands
    for by in (CY_BASE + 1, 17, CY_TOP - 2):
        band = box(g, 2.5, by - 0.8, 2.5, 19.5, by + 0.8, 15.5, "steel", 5)
        P.flat(g, band & body, "steel", 5)
        P.flat(g, edges(band & body), "iron", 4)

    # Recessed vault door on front (-Z face: X=5 to 17, Y=5 to 31, Z=2 to 4)
    door_frame = box(g, 5, 5, 2, 17, 31, 4, "iron", 4)
    P.flat(g, edges(door_frame), "iron", 3)

    door_panel = box(g, 6, 6, 2, 16, 30, 3, "steel", 4)
    P.flat(g, door_panel, "steel", 4)
    P.flat(g, edges(door_panel), "steel", 3)

    # Heavy hinges on -X flank of door (X=4 to 6, Z=2 to 4, Y=8..11 and Y=24..27)
    for hy in (9, 25):
        hinge = box(g, 4, hy - 1.5, 2, 6, hy + 1.5, 4, "rust", 5)
        P.flat(g, hinge, "rust", 5)
        P.flat(g, edges(hinge), "rust", 4)
        dots(g, hinge, "-z", [(5.0, hy)], 0.6, "gold", 6)

    # Heavy dog clamp latches on +X flank (X=16 to 18, Z=2 to 4, Y=9, 18, 27)
    for ly in (9, 18, 27):
        latch = box(g, 16, ly - 1, 2, 18, ly + 1, 3.5, "iron", 5)
        P.flat(g, latch, "iron", 5)
        P.flat(g, edges(latch), "iron", 4)
        dots(g, latch, "+x", [(2.8, ly)], 0.5, "rust", 6)

    # --- Radiation Trefoil Symbol (CY=23 on front door, Z in [2, 3]) ---
    cy_trefoil = 23.0
    r_trefoil = np.hypot(X - CX, Y - cy_trefoil)
    ang_trefoil = np.arctan2(Y - cy_trefoil, X - CX)
    door_surf = door_panel & (Z >= 2) & (Z < 3)

    # Dark contrast circular plate behind trefoil
    P.flat(g, door_surf & (r_trefoil <= 4.5), "iron", 4)

    # Center circle of trefoil
    P.flat(g, door_surf & (r_trefoil <= 1.3), "orange", 6)

    # 3 fan blades at angles: -90 deg (down), 30 deg (up-right), 150 deg (up-left)
    angles = [-np.pi / 2, np.pi / 6, 5 * np.pi / 6]
    for a in angles:
        diff = np.abs((ang_trefoil - a + np.pi) % (2 * np.pi) - np.pi)
        blade_mask = (r_trefoil >= 1.8) & (r_trefoil <= 4.5) & (diff < np.pi / 6)
        P.flat(g, door_surf & blade_mask, "orange", 6)

    # Keep text clear of the three fan blades.

    # --- 3-Spoke Vault Locking Handwheel (CY=12 on front door, Z in [1, 2]) ---
    cy_wheel = 12.0
    r_wheel = np.hypot(X - CX, Y - cy_wheel)
    wheel_ring = box(g, CX - 4, cy_wheel - 4, 1, CX + 4, cy_wheel + 4, 2, "rust", 5)
    r_w = np.hypot(X - CX, Y - cy_wheel)
    P.flat(g, wheel_ring & (np.abs(r_w - 3.2) <= 0.8), "rust", 5)
    g.a[wheel_ring & (np.abs(r_w - 3.2) > 0.8)] = 0

    # 3 spokes at angles: 90 deg (up), 210 deg (down-left), 330 deg (down-right)
    ang_wheel = np.arctan2(Y - cy_wheel, X - CX)
    spoke_angles = [np.pi / 2, -5 * np.pi / 6, -np.pi / 6]
    for sa in spoke_angles:
        sdiff = np.abs((ang_wheel - sa + np.pi) % (2 * np.pi) - np.pi)
        spoke_mask = (Z >= 1) & (Z < 2) & (r_wheel <= 3.2) & (sdiff < 0.38)
        P.flat(g, spoke_mask, "rust", 5)

    # Central locking hub spindle
    hub = ngon_prism(g, "z", CX, cy_wheel, 1.4, 0, 3, "rust", 6, n=8)
    P.flat(g, hub, "rust", 6)
    P.flat(g, hub & (Z < 1), "rust", 7)

    # Analog pressure/radiation gauge dial next to wheel (X=7 to 9, Y=12 to 14)
    dots(g, door_panel, "-z", [(7.5, 13.5)], 1.1, "bone", 6)
    dots(g, door_panel, "-z", [(7.5, 13.5)], 0.4, "rust", 5)

    # Status LED cluster on door (X=14 to 15, Y=13 to 15)
    dots(g, door_panel, "-z", [(14.5, 14.5)], 0.6, "toxic", 6)
    dots(g, door_panel, "-z", [(14.5, 12.5)], 0.6, "orange", 6)

    # --- Top Roof Features (Y=33 to 37) ---
    # Top beveled cap
    roof = cham_prism(g, "y", 3, 3, 19, 15, 1.8, CY_TOP, CY_TOP + 2, "steel", 4)
    P.flat(g, edges(roof), "steel", 3)

    # Filtered HEPA exhaust / purge vent on left roof (X=5 to 9, Z=7 to 11)
    vent = ngon_prism(g, "y", 7.0, 9.0, 2.0, CY_TOP + 1, CY_TOP + 4, "iron", 4, n=8)
    P.flat(g, vent, "iron", 4)
    P.flat(g, vent & (coords(g)[1] == CY_TOP + 3), "steel", 5)
    P.flat(g, edges(vent), "iron", 3)

    # Amber rotating purge warning beacon on right roof (X=13 to 17, Z=7 to 11)
    beacon_base = ngon_prism(g, "y", 15.0, 9.0, 1.8, CY_TOP + 1, CY_TOP + 2, "iron", 5, n=8)
    P.flat(g, beacon_base, "iron", 5)
    beacon = ngon_prism(g, "y", 15.0, 9.0, 1.5, CY_TOP + 2, CY_TOP + 5, "orange", 6, n=8)
    P.flat(g, beacon, "orange", 6)
    P.flat(g, beacon & (coords(g)[1] == CY_TOP + 4), "gold", 7)

    # Exterior wand holster bracket on +X flank (X=18 to 21, Y=14 to 20, Z=7 to 11)
    holster_bottom = box(g, 18, 14, 7, 21, 15, 11, "steel", 4)
    holster_walls = (
        box(g, 18, 15, 7, 21, 20, 8, "steel", 4)
        | box(g, 18, 15, 10, 21, 20, 11, "steel", 4)
        | box(g, 20, 15, 8, 21, 20, 10, "steel", 4)
    )
    holster = holster_bottom | holster_walls
    P.flat(g, holster, "steel", 4)
    P.flat(g, edges(holster), "steel", 3)

    return g


def geiger_wand() -> Grid:
    # Portable Geiger-Mueller detector wand with ribbed handle and coiled cord (F4, F5)
    gw, gh, gd = 6, 16, 6
    g = Grid(gw, gh, gd)
    X, Y, Z = coords(g)

    # Detector wand cylinder (X=2 to 4, Z=2 to 4, Y=4 to 15)
    wand = ngon_prism(g, "y", 3.0, 3.0, 1.3, 4, 15, "rust", 5, n=8)
    P.flat(g, wand, "rust", 5)
    # Ribbed grip
    for gy in (6, 8, 10):
        P.flat(g, wand & (coords(g)[1] == gy), "iron", 3)
    # Sensor head (top: Y=12 to 15)
    P.flat(g, wand & (coords(g)[1] >= 12), "gold", 6)
    dots(g, wand, "top", [(3.0, 3.0)], 0.8, "teal", 5)

    # Coiled connection cable below wand (Y=0 to 4)
    cable = box(g, 2, 0, 2, 4, 4, 4, "orange", 5)
    P.flat(g, cable, "orange", 5)
    for cy in (0, 2):
        P.flat(g, cable & (coords(g)[1] == cy), "rust", 5)

    return g


def build() -> Asset:
    root = Part("locker", locker_body())
    # Add Geiger wand resting in the side holster, tilted slightly askew (F5)
    root.add(Part("geiger-wand", geiger_wand(), pivot=(3.0, 6.0, 3.0), at=(18.0, 12.0, 7.5), rot=(8.0, 4.0, -10.0)))
    # Purge vent exhaust socket
    socket_vent = Socket("socket-vent", at=(7.0, CY_TOP + 4.0, 9.0))
    return Asset(
        id="space-props-radiation-locker",
        pack="space",
        category="props",
        name="Lead-Lined Radiation Locker",
        root=root,
        sockets=[socket_vent],
        pfx=[{"effectId": "rvx-space-launch-steam", "socket": "socket-vent", "trigger": "idle", "size": 8}],
    )
