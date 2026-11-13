"""Starship pressure door bulkhead frame, in the Pirate Nation mecha style.

One iconic shape (rule K3): an oversized pressurized bulkhead portal archway.
The massive structural arch features thick side pillars and a heavy header
beam (F3) clad in riveted white hull armor plates with chamfered portal corners
(F2). The walk-through opening is framed by recessed orange pressure gaskets,
yellow hazard teeth along the threshold, and exposed hydraulic locking pins.
The top header mounts dual red/green airlock status lights and an emergency
pressure override lever (F4, F5). The right jamb pillar houses an access keypad
with glowing cyan keys. Detail is paint (S1). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import cham_prism, dots, hull, panel
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

W, H, D = 34, 40, 10
X_OPEN_L, X_OPEN_R = 8, 26
Y_OPEN_TOP = 30
CHAM = 5


def door_frame() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    # Base sill runner along floor (Y=0 to 2, full width)
    sill = box(g, 0, 0, 0, W, 2, D, "iron", 4)
    P.flat(g, edges(sill), "iron", 3)
    # Hazard teeth along threshold opening (X=8 to 26, Y=0 to 2)
    pnpaint.hazard(g, sill & (coords(g)[0] >= X_OPEN_L) & (coords(g)[0] <= X_OPEN_R), period=8, a=("orange", 5), b=("iron", 4), frame="top")

    # LEFT PILLAR (X=0 to 8, Y=2 to H, Z=0 to D)
    pillar_l = box(g, 0, 2, 0, X_OPEN_L, H, D, "bone", 5)
    hull(g, pillar_l, "bone", 5, size=(8, 10), seed=3)
    P.flat(g, edges(pillar_l), "bone", 3)
    # Steel corner trims on left pillar
    trim_l = box(g, 0, 0, 0, 2, H, D, "steel", 4)
    P.flat(g, edges(trim_l), "steel", 3)
    P.flat(g, trim_l & (np.floor(Y) % 6 == 0), "rust", 6)

    # RIGHT PILLAR (X=26 to 34, Y=2 to H, Z=0 to D)
    pillar_r = box(g, X_OPEN_R, 2, 0, W, H, D, "bone", 5)
    hull(g, pillar_r, "bone", 5, size=(8, 10), seed=4)
    P.flat(g, edges(pillar_r), "bone", 3)
    trim_r = box(g, W - 2, 0, 0, W, H, D, "steel", 4)
    P.flat(g, edges(trim_r), "steel", 3)
    P.flat(g, trim_r & (np.floor(Y) % 6 == 0), "rust", 6)

    # HEADER BEAM (X=0 to W, Y=Y_OPEN_TOP to H, Z=0 to D)
    header = box(g, 0, Y_OPEN_TOP, 0, W, H, D, "bone", 5)
    hull(g, header, "bone", 5, size=(10, 6), seed=5)
    P.flat(g, edges(header), "bone", 3)
    # Heavy steel top cross eave beam (Y=H - 3 to H)
    top_beam = box(g, 0, H - 3, 0, W, H, D, "steel", 4)
    P.flat(g, edges(top_beam), "steel", 3)
    P.flat(g, top_beam & (coords(g)[1] == H - 1) & (np.floor(X) % 4 == 0), "rust", 6)

    # CHAMFERED PORTAL CORNERS (true 45-degree slope brackets, F2):
    # Left portal chamfer: triangle filling (8, 25) to (13, 30)
    poly_cham_l = [(25, 8), (30, 8), (30, 13)]
    g.prism("z", [(8, 25), (8, 30), (13, 30)], 0, D, P.C("steel", 4))
    m_cham_l = g.solids[-1].mask(g.shape)
    P.flat(g, edges(m_cham_l), "steel", 3)

    # Right portal chamfer: triangle filling (26, 25) to (21, 30)
    g.prism("z", [(26, 25), (26, 30), (21, 30)], 0, D, P.C("steel", 4))
    m_cham_r = g.solids[-1].mask(g.shape)
    P.flat(g, edges(m_cham_r), "steel", 3)

    # INNER REVEAL & PRESSURE GASKET:
    # Recessed groove around the doorway portal rim with orange rubber seal
    # Left inner jamb
    jamb_l = box(g, X_OPEN_L - 1, 2, 3, X_OPEN_L, 25, 7, "rust", 4)
    P.flat(g, jamb_l, "orange", 5)
    # Right inner jamb
    jamb_r = box(g, X_OPEN_R, 2, 3, X_OPEN_R + 1, 25, 7, "rust", 4)
    P.flat(g, jamb_r, "orange", 5)
    # Top inner lintel
    jamb_t = box(g, 13, Y_OPEN_TOP - 1, 3, 21, Y_OPEN_TOP, 7, "rust", 4)
    P.flat(g, jamb_t, "orange", 5)

    # Hydraulic locking deadbolts protruding from the jambs
    for by in (8, 16, 23):
        # Left deadbolt
        bolt_l = box(g, X_OPEN_L, by, 4, X_OPEN_L + 2, by + 2, 6, "gold", 6)
        P.flat(g, bolt_l, "gold", 6)
        # Right deadbolt
        bolt_r = box(g, X_OPEN_R - 2, by, 4, X_OPEN_R, by + 2, 6, "gold", 6)
        P.flat(g, bolt_r, "gold", 6)

    # HEADER INSTRUMENTATION & CONTROLS:
    # Dual status beacon lamps on header (left = green, right = red)
    dots(g, header, "-z", [(13.0, 35.0)], 1.4, "toxic", 6)  # Safe
    dots(g, header, "-z", [(21.0, 35.0)], 1.4, "red", 6)    # Locked/Vacuum
    P.flat(g, header & (coords(g)[2] < 1) & (np.hypot(X - 13.0, Y - 35.0) < 0.6), "lime", 7)
    P.flat(g, header & (coords(g)[2] < 1) & (np.hypot(X - 21.0, Y - 35.0) < 0.6), "orange", 7)

    # Stencil designation plate on center header
    pnglyph.text(g, "-z", 0, 5, 32, "GATE", "orange", 6, depth=1, reach=1)

    # Access keypad on right pillar (-Z face, X=28 to 32, Y=14 to 22)
    keypad = box(g, 28, 14, -1, 32, 22, 1, "steel", 4)
    P.flat(g, edges(keypad), "steel", 3)
    # Glowing cyan key grid
    keys = keypad & (coords(g)[2] < 0) & (coords(g)[1] >= 15) & (coords(g)[1] <= 19) & (coords(g)[0] >= 29) & (coords(g)[0] <= 31)
    P.flat(g, keys, "cyan", 6)
    P.flat(g, keys & (np.floor(X + Y) % 2 == 0), "cyan", 7)
    # Identity scanner strip below keys
    dots(g, keypad, "-z", [(30.0, 20.5)], 0.8, "teal", 6)

    return g


def override_lever() -> Grid:
    # Manual emergency airlock release lever on the header (F4, F5)
    lw, lh, ld = 4, 6, 4
    g = Grid(lw, lh, ld)
    # Mounting bracket
    base = box(g, 1, 2, 2, 3, 5, 4, "iron", 4)
    # Angled red release lever handle
    arm = box(g, 1, 0, 0, 3, 4, 2, "red", 5)
    P.flat(g, edges(arm), "red", 4)
    # Grip knob in gold
    knob = box(g, 0, 0, 0, 4, 2, 2, "gold", 6)
    return g


def build() -> Asset:
    root = Part("pressure-door-frame", door_frame())
    # Add emergency override lever mounted on header beside the sign, angled
    root.add(Part("lever", override_lever(), pivot=(2.0, 4.0, 3.0), at=(17.0, 33.0, 0.0), rot=(0.0, 0.0, -15.0)))
    return Asset(id="space-props-pressure-door-frame", pack="space", category="props", name="Bulkhead Pressure Door Frame", root=root)
