"""Atmospheric oxygen scrubber unit, in the Pirate Nation mecha style.

One iconic shape (rule K3): a life-support CO2 scrubber and air recycler unit.
A heavy dark iron intake plenum base with suction louvers and hazard striping
(F3) draws cabin air. Dual upright octagonal canister towers in riveted white
hull plating (F2) contain chemical scrubbing matrices, bound by copper clamp
hoops. An illuminated central telemetry console features an analog pressure
gauge dial and glowing cyan "O2 OK" status readout. An overhead copper exhaust
cowl collects purified air into an angled discharge vent with steam relief
effects (F4). Detail is paint (S1). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnglyph
import pnpaint
from _pn import pipe
from _props import dots, ngon_prism, panel
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part, Socket

W, H, D = 24, 32, 18
X0, X1 = 2, 22
Z0, Z1 = 2, 16
CZ = 9.0
C1_X = 7.5
C2_X = 16.5
R_CAN = 4.2


def scrubber() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    # Base intake plenum cabinet (Y=0 to 6)
    base = box(g, X0, 0, Z0, X1, 6, Z1, "iron", 4)
    P.flat(g, edges(base), "iron", 3)
    pnpaint.hazard(g, base & (coords(g)[2] < Z0 + 1) & (coords(g)[1] < 3), period=4, a=("orange", 5), b=("iron", 4))

    # Intake suction louvers on front face (-Z face, Y=1 to 5, X=5 to 19)
    louvers = base & (Z < Z0 + 1) & (Y >= 1) & (Y <= 5) & (X >= 5) & (X <= 19)
    P.flat(g, louvers & (np.floor(Y) % 2 == 0), "iron", 2)
    P.flat(g, louvers & (np.floor(Y) % 2 != 0), "steel", 5)

    # DUAL OCTAGONAL SCRUBBER CANISTERS (Y=6 to 23):
    # Left canister:
    can_l = ngon_prism(g, "y", C1_X, CZ, R_CAN, 6, 23, "bone", 5, n=8)
    for f, fr in facets(g, g.solids[-1:]):
        P.plates(g, f, "bone", 5, size=(6, 8), frame=fr, seed=1)
    P.flat(g, edges(can_l), "bone", 3)

    # Right canister:
    can_r = ngon_prism(g, "y", C2_X, CZ, R_CAN, 6, 23, "bone", 5, n=8)
    for f, fr in facets(g, g.solids[-1:]):
        P.plates(g, f, "bone", 5, size=(6, 8), frame=fr, seed=2)
    P.flat(g, edges(can_r), "bone", 3)

    # Copper retaining hoops around both canisters (Y=9 to 11 and Y=18 to 20)
    for y0, y1 in ((9, 11), (18, 20)):
        h_l = ngon_prism(g, "y", C1_X, CZ, R_CAN + 0.6, y0, y1, "rust", 5, n=8)
        P.flat(g, edges(h_l), "rust", 3)
        P.flat(g, h_l & (coords(g)[2] < CZ), "rust", 6)

        h_r = ngon_prism(g, "y", C2_X, CZ, R_CAN + 0.6, y0, y1, "rust", 5, n=8)
        P.flat(g, edges(h_r), "rust", 3)
        P.flat(g, h_r & (coords(g)[2] < CZ), "rust", 6)

        # Cross connector bar linking the two canisters
        cross = box(g, C1_X + 2, y0, CZ - 1, C2_X - 2, y1, CZ + 1, "rust", 5)
        P.flat(g, edges(cross), "rust", 3)

    # Copper balance piping between canisters (bottom and top)
    pipe(g, [(C1_X, 7, CZ - 3), (C1_X + 2, 7, CZ - 4.5), (C2_X - 2, 7, CZ - 4.5), (C2_X, 7, CZ - 3)], s=2, ramp="rust", base=5, flange=False)

    # Central control & telemetry console between canisters (X=9 to 15, Y=11 to 21, Z=4 to 7)
    console = box(g, 9, 11, 4, 15, 21, 7, "steel", 4)
    P.flat(g, edges(console), "steel", 3)

    # Analog circular pressure dial at top of console (Y=16 to 20)
    dial = ngon_prism(g, "z", 12.0, 18.0, 2.5, 3, 4, "bone", 6, n=8)
    P.flat(g, dial, "bone", 6)
    P.flat(g, edges(dial), "rust", 4)
    # Dial needle in gold pointing to safe zone
    P.flat(g, dial & (coords(g)[0] >= 12.0) & (coords(g)[1] >= 18.0) & (np.abs((X - 12) - (Y - 18)) < 0.6), "gold", 7)
    P.flat(g, dial & (np.hypot(X - 12.0, Y - 18.0) < 0.7), "rust", 4)

    # Glowing cyan digital status readout at lower console (Y=12 to 15)
    scr = box(g, 10, 12, 3, 14, 15, 4, "cyan", 6)
    P.flat(g, scr, "cyan", 6)
    P.flat(g, scr & (coords(g)[1] == 13), "cyan", 7)
    dots(g, console, "-z", [(10.0, 11.5)], 0.6, "toxic", 6)
    dots(g, console, "-z", [(14.0, 11.5)], 0.6, "orange", 6)

    # OVERHEAD EXHAUST COWL HOOD (Y=23 to 30):
    # Hood bridging both canisters, tapering upward (F2, F4)
    poly_cowl = [(23, Z0 + 1), (23, Z1 - 1), (29, Z1 - 3), (29, Z0 + 3)]
    g.prism("x", poly_cowl, X0, X1, P.C("steel", 4))
    hood = g.solids[-1].mask(g.shape)
    for f, fr in facets(g, g.solids[-1:]):
        P.plates(g, f, "steel", 4, size=(8, 6), frame=fr)
    P.flat(g, edges(hood), "steel", 3)

    # Exhaust duct nozzle on top center (Y=29 to 32, X=9 to 15, Z=6 to 12)
    duct = ngon_prism(g, "y", 12.0, CZ, 3.2, 29, 32, "rust", 5, n=8)
    P.flat(g, edges(duct), "rust", 4)
    # Interior exhaust dark grill
    P.flat(g, duct & (coords(g)[1] == 31) & (np.hypot(X - 12.0, Z - CZ) < 2.4), "iron", 2)

    # Front stencil "O2" on right canister
    pnglyph.text(g, "-z", CZ - R_CAN, C2_X - 2, 14, "O2", "cyan", 6, depth=2, reach=1)

    return g


def build() -> Asset:
    root = Part("oxygen-scrubber", scrubber())
    socket_vent = Socket("socket-vent", at=(12.0, float(H), float(CZ)))
    return Asset(
        id="space-props-oxygen-scrubber",
        pack="space",
        category="props",
        name="Atmospheric Oxygen Scrubber",
        root=root,
        sockets=[socket_vent],
        pfx=[{"effectId": "rvx-space-launch-steam", "socket": "socket-vent", "trigger": "idle", "size": 16}],
    )
