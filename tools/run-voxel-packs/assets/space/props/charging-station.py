"""Robot and suit charging station, in the Pirate Nation mecha style.

One iconic shape (rule K3): an upright charging pylon and induction alcove for
service droids and powered exosuits. A floor-standing octagonal induction pad
with copper charging coils and hazard perimeter anchors the base (F3). A tall
central power tower in riveted white hull panels (F2) houses high-voltage
rectifiers, dual heavy bus conduits, and an oversized illuminated lightning
charge meter with cyan power segments (F4). A heavy magnetic umbilical charging
cable hangs ready from a copper junction box, swinging slightly askew (F5).
Top transformer coils and an amber beacon finish the pylon. Detail is paint
(S1). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnglyph
import pnpaint
from _pn import pipe
from _props import cham_prism, dots, hull, ngon_prism, panel
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part, Socket

W, H, D = 24, 38, 22
CX = 12.0
Z0, Z1 = 2, 20
Y_PAD = 4


def station() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    # Base floor induction charge pad (Y=0 to Y_PAD, X=2 to 22, Z=2 to 20)
    pad = cham_prism(g, "y", 2, Z0, 22, Z1, 3, 0, Y_PAD, "iron", 4)
    for f, fr in facets(g, g.solids[-1:]):
        pnpaint.hazard(g, f, period=4, a=("orange", 5), b=("iron", 4), frame=fr)
    P.flat(g, pad & (coords(g)[1] > Y_PAD - 1), "steel", 4)
    P.flat(g, edges(pad), "iron", 3)

    # Concentric copper induction coils inlaid on the floor pad surface
    cz_pad = 9.0
    R_coil = np.hypot(X - CX, Z - cz_pad)
    P.flat(g, pad & (coords(g)[1] == Y_PAD - 1) & (np.abs(R_coil - 5.5) < 0.6), "rust", 5)
    P.flat(g, pad & (coords(g)[1] == Y_PAD - 1) & (np.abs(R_coil - 3.0) < 0.6), "rust", 6)
    P.flat(g, pad & (coords(g)[1] == Y_PAD - 1) & (R_coil < 1.4), "gold", 6)

    # Vertical back charging pylon tower (X=5 to 19, Y=Y_PAD to 34, Z=13 to 20)
    tower = cham_prism(g, "y", 5, 13, 19, 20, 2.5, Y_PAD, 34, "bone", 5)
    hull(g, tower, "bone", 5, size=(6, 8), seed=6)
    P.flat(g, edges(tower), "bone", 3)

    # Structural iron side columns flanking the pylon (F3)
    col_l = box(g, 4, Y_PAD, 13, 7, 34, 18, "iron", 5)
    P.flat(g, edges(col_l), "iron", 3)
    P.flat(g, col_l & (np.floor(Y) % 6 == 0), "rust", 6)

    col_r = box(g, 17, Y_PAD, 13, 20, 34, 18, "iron", 5)
    P.flat(g, edges(col_r), "iron", 3)
    P.flat(g, col_r & (np.floor(Y) % 6 == 0), "rust", 6)

    # Front recessed power display panel on pylon (-Z face, Y=14 to 28, X=8 to 16)
    disp_frame = box(g, 7, 13, 12, 17, 29, 14, "steel", 4)
    P.flat(g, edges(disp_frame), "steel", 3)

    # Glowing cyan lightning / high voltage battery meter
    disp = box(g, 8, 14, 11, 16, 28, 13, "teal", 4)
    P.flat(g, disp, "teal", 4)

    # Lit energy level bars (green/cyan)
    for by in range(15, 27, 2):
        bar = disp & (coords(g)[1] >= by) & (coords(g)[1] <= by + 1)
        P.flat(g, bar, "cyan", 6)
        P.flat(g, bar & (coords(g)[2] < 12), "cyan", 7)

    # Gold lightning bolt stencil glyph in the middle of display
    P.flat(g, disp & (coords(g)[2] < 12) & (coords(g)[1] == 21) & (np.abs(X - CX) < 1.6), "gold", 7)
    P.flat(g, disp & (coords(g)[2] < 12) & (coords(g)[1] == 22) & (np.abs(X - (CX + 0.8)) < 1.0), "gold", 7)
    P.flat(g, disp & (coords(g)[2] < 12) & (coords(g)[1] == 20) & (np.abs(X - (CX - 0.8)) < 1.0), "gold", 7)

    # Voltage readout / status lamps
    dots(g, disp_frame, "-z", [(9.5, 27.5)], 0.7, "toxic", 6)
    dots(g, disp_frame, "-z", [(14.5, 27.5)], 0.7, "gold", 6)

    # Heavy high-voltage copper bus conduit on +X side climbing into top transformer
    pts_pipe = [
        (18.5, Y_PAD + 1, 15.5),
        (21.0, Y_PAD + 1, 15.5),
        (21.0, 32.0, 15.5),
        (18.0, 32.0, 15.5),
    ]
    pipe(g, pts_pipe, s=2, ramp="rust", base=5, flange=True)

    # Top power transformer cap (Y=34 to 38, X=6 to 18, Z=12 to 20)
    top_cap = cham_prism(g, "y", 6, 12, 18, 20, 2.0, 34, 37, "steel", 4)
    P.flat(g, edges(top_cap), "steel", 3)
    P.flat(g, top_cap & (coords(g)[1] > 36), "steel", 5)

    # Copper cooling radiator fins on top
    for fx in (8, 11, 14):
        fin = box(g, fx, 36, 13, fx + 1, 38, 19, "rust", 5)
        P.flat(g, fin, "rust", 5)

    # Amber rotating beacon lamp at top centre
    beacon = ngon_prism(g, "y", CX, 16.0, 1.8, 36, 38, "orange", 6, n=8)
    P.flat(g, beacon, "orange", 6)
    P.flat(g, beacon & (coords(g)[1] == 37), "gold", 7)

    # Front stencil "POWER"
    pnglyph.text(g, "-z", 13, 8, 8, "PWR", "orange", 6, depth=2, reach=1)

    return g


def charging_cable() -> Grid:
    # Heavy flexible charging umbilical and magnetic coupling plug head (F4, F5)
    cw, ch, cd = 8, 16, 10
    g = Grid(cw, ch, cd)
    X, Y, Z = coords(g)

    # Upper junction box on pylon wall (at top back: X=2 to 6, Y=12 to 16, Z=7 to 10)
    jbox = box(g, 2, 12, 7, 6, 16, 10, "rust", 4)
    P.flat(g, edges(jbox), "rust", 3)

    # Hanging braided cable loop (hanging down from (4, 13, 8) to (4, 4, 3))
    pts = [
        (4.0, 13.0, 8.0),
        (3.0, 9.0, 7.0),
        (3.5, 5.0, 5.0),
        (4.5, 4.0, 3.0),
    ]
    for (x0, y0, z0), (x1, y1, z1) in zip(pts, pts[1:]):
        steps = 8
        for s in range(steps + 1):
            t = s / steps
            cx = x0 + t * (x1 - x0)
            cy = y0 + t * (y1 - y0)
            cz = z0 + t * (z1 - z0)
            seg = box(g, cx - 1.0, cy - 1.0, cz - 1.0, cx + 1.0, cy + 1.0, cz + 1.0, "orange", 5)
            P.flat(g, seg, "orange", 5)

    # Magnetic coupling plug connector at end (X=3 to 6, Y=1 to 5, Z=0 to 3)
    plug = box(g, 3, 1, 0, 6, 5, 3, "rust", 5)
    P.flat(g, edges(plug), "rust", 4)
    # Glowing cyan magnetic contact prongs
    prongs = box(g, 3.5, 1.5, 0, 5.5, 4.5, 1, "cyan", 6)
    P.flat(g, prongs, "cyan", 7)
    dots(g, plug, "-x", [(1.5, 3.0)], 0.7, "gold", 6)

    return g


def build() -> Asset:
    root = Part("charging-station", station())
    # Add magnetic umbilical cable hanging from the left of the pylon, swinging forward
    root.add(Part("cable", charging_cable(), pivot=(4.0, 13.0, 8.0), at=(6.0, 10.0, 6.0), rot=(0.0, -12.0, 6.0)))
    # Socket for electrical charge sparks at the coupling plug
    socket_sparks = Socket("socket-sparks", at=(8.0, 12.0, 7.0))
    return Asset(
        id="space-props-charging-station",
        pack="space",
        category="props",
        name="Exosuit and Droid Charging Station",
        root=root,
        sockets=[socket_sparks],
        pfx=[{"effectId": "rvx-space-stun-arc", "socket": "socket-sparks", "trigger": "idle", "size": 14}],
    )
