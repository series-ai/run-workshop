"""Modular spaceship hull bulkhead wall, in the Pirate Nation mecha style.

One iconic shape (rule K3): an interior corridor bulkhead wall segment flanked
by thick dark structural pillars (F3). The wall face is built from riveted
white hull armor plates (F2, S2). A recessed horizontal conduit raceway runs
across the midsection, revealing bundles of heavy copper and glowing cyan power
lines. A hazard-striped kickplate protects the base. A bulkhead intercom and
emergency oxygen breather cabinet is mounted on the front face, and a recessed
cyan light bar illuminates the top eave beam. Detail is paint (S1). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnglyph
import pnpaint
from _pn import pipe
from _props import dots, hull, panel
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

# One storey (44) so that a 36-voxel person cannot see over it (Art Director repair).
W, H, D = 32, 44, 10
Z0, Z1 = 2, 8


def wall() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    # Base deck sill plate (Y=0 to 3)
    sill = box(g, 0, 0, Z0 - 1, W, 3, Z1 + 1, "iron", 4)
    P.flat(g, edges(sill), "iron", 3)
    pnpaint.hazard(g, sill & (coords(g)[2] < Z0 + 1), period=4, a=("orange", 5), b=("iron", 4))

    # Two heavy end pillars (X=0 to 4 and X=28 to 32, full height H)
    for x0, x1 in ((0, 4), (28, 32)):
        pillar = box(g, x0, 0, Z0 - 1, x1, H, Z1 + 1, "steel", 4)
        P.plates(g, pillar, "steel", 4, size=(6, 8))
        P.flat(g, edges(pillar), "steel", 3)
        # Pillar mounting bracket bolts
        P.flat(g, pillar & (np.floor(Y) % 5 == 1) & (coords(g)[2] < Z0), "rust", 6)
        # Top pillar caps
        P.flat(g, pillar & (Y > H - 2), "iron", 5)

    # Main wall bulkhead body (X=4 to 28, Y=3 to H - 3, Z=Z0 to Z1)
    wall_body = box(g, 4, 3, Z0, 28, H - 3, Z1, "bone", 5)
    hull(g, wall_body, "bone", 5, size=(8, 7), seed=8)
    P.flat(g, edges(wall_body), "bone", 3)

    # Recessed horizontal conduit raceway across midsection (Y=18 to 22, indented on -Z)
    trench = wall_body & (Y >= 18) & (Y <= 22) & (Z < Z0 + 2)
    P.flat(g, trench, "iron", 3)
    P.flat(g, edges(trench), "iron", 2)

    # Bundled power cables inside the trench (X=4 to 28)
    # Cable 1: copper bus bar
    c1 = wall_body & (Y == 19) & (Z == Z0) & (X >= 4) & (X <= 28)
    P.flat(g, c1, "rust", 5)
    # Cable 2: glowing cyan conduit
    c2 = wall_body & (Y == 20) & (Z == Z0) & (X >= 4) & (X <= 28)
    P.flat(g, c2, "cyan", 6)
    P.flat(g, c2 & (np.floor(X) % 3 == 0), "cyan", 7)
    # Cable 3: orange high-voltage line
    c3 = wall_body & (Y == 21) & (Z == Z0) & (X >= 4) & (X <= 28)
    P.flat(g, c3, "orange", 5)

    # Conduit bracket clamps holding cables every 6 units
    for cx in (9, 15, 21):
        clamp = box(g, cx - 0.5, 17.5, Z0 - 0.5, cx + 0.5, 22.5, Z0 + 1.5, "steel", 6)
        P.flat(g, clamp, "steel", 6)
        P.flat(g, clamp & (coords(g)[1] == 20), "gold", 6)

    # Top bulkhead cross-beam header (Y=H - 3 to H)
    header = box(g, 4, H - 3, Z0 - 1, 28, H, Z1 + 1, "steel", 4)
    P.flat(g, edges(header), "steel", 3)
    # Recessed cyan corridor lighting strip on underside of header
    light_strip = header & (Y == H - 3) & (Z < Z0 + 2) & (X >= 6) & (X <= 26)
    P.flat(g, light_strip, "cyan", 6)
    P.flat(g, light_strip & (np.floor(X) % 4 == 0), "cyan", 7)

    # Wall-mounted emergency life-support / intercom box on front face (X=7 to 13, Y=15 to 22)
    box_m = box(g, 7, 25, Z0 - 2, 14, 32, Z0, "steel", 4)
    P.flat(g, edges(box_m), "steel", 3)
    # Green cross / oxygen symbol
    P.flat(g, box_m & (Z < Z0 - 1.2) & (X >= 9) & (X <= 12) & (Y >= 27) & (Y <= 30), "teal", 6)
    dots(g, box_m, "-z", [(8.5, 26.5)], 0.8, "red", 6)  # E-stop/alarm
    dots(g, box_m, "-z", [(12.5, 26.5)], 0.8, "gold", 6)

    # A dark vent grille with slats in the upper wall panel.
    vent = wall_body & (X >= 8) & (X < 24) & (Y >= 34) & (Y < 39) & (Z < Z0 + 1)
    P.flat(g, vent, "iron", 3)
    P.flat(g, vent & (np.floor(Y) % 2 == 0), "steel", 5)
    # A hazard-striped kick panel above the sill.
    kick = wall_body & (Y >= 3) & (Y < 8) & (Z < Z0 + 1)
    pnpaint.hazard(g, kick, period=4, a=("orange", 5), b=("iron", 3))

    # Bulkhead designation stencil text painted on right side of wall
    pnglyph.text(g, "-z", Z0 - 1, 5, 10, "B-04", "steel", 3, depth=2, reach=1)

    return g


def build() -> Asset:
    root = Part("hull-wall", wall())
    return Asset(id="space-props-hull-wall", pack="space", category="props", name="Bulkhead Corridor Hull Wall", root=root)
