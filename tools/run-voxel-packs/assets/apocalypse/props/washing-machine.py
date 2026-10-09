"""Scavenged washing machine, in the Pirate Nation style.

One chunky icon (rule K3): a pale steel appliance box on a dark plinth
under an overhanging lid, at real appliance scale (19 high), with an oversized porthole on the front so
the prop reads at thumbnail size (rules F4, F6). The door is a dark
faceted rim round bright zombie-teal glass with a bundle of rags behind
it, and a hazard-yellow bar handle bolted to the rim. Above it a dark
control band carries two big dials and three lamps; the side wears a
hazard-yellow H2O plate over a painted vent grille, and the back a bolted
service hatch with the drain hose on two clamps. Plate seams, bolts, rust blooms and the mould at the
foot are all paint (rule S1), grouped on seams and edges, never speckled
over a face.
"""
import numpy as np

import paint as P
import pnpaint
from _props import asset, chips, root, rust_runs, seam_rust
from pnkit import box, edges
from pnshapes import coords, disc
from voxgrid import Grid

# Real scale: a washer is about 0.85 m high and 0.6 m wide. The person is
# 36 voxels (1.8 m), so the machine is 19 high and 16 wide (class appliance).
GW, GH, GD = 22, 22, 24
X0, X1 = 3, 19  # the body
Z0, Z1 = 6, 21
YP, YB, YL = 2, 17, 19  # plinth top, body top, lid top
DCX, DCY, DR = 11.0, 8.5, 6.0  # the porthole


def _porthole(g: Grid) -> None:
    """The oversized front door: three stepped rings round bright teal glass."""
    X, Y, Z = coords(g)
    d = np.hypot(X - DCX, Y - DCY)
    rim = disc(g, "z", DCX, DCY, DR, Z0 - 3, Z0 + 1, "steel", 4)
    P.flat(g, rim & (d > DR - 1.2), "steel", 2)  # the dark outer band
    P.flat(g, rim & (Z < Z0 - 2) & (d < DR - 1.2), "steel", 5)
    bez = disc(g, "z", DCX, DCY, DR - 1.3, Z0 - 4, Z0 + 1, "steel", 5)
    P.flat(g, bez & (Z < Z0 - 3), "steel", 7)  # the lit bezel face
    for k in range(6):
        a = k * np.pi / 3 + 0.4
        P.flat(g, bez & (Z < Z0 - 3) & (np.abs(X - DCX - (DR - 2.0) * np.cos(a)) < 0.7) & (np.abs(Y - DCY - (DR - 2.0) * np.sin(a)) < 0.7), "steel", 4)
    glass = disc(g, "z", DCX, DCY, DR - 2.4, Z0 - 5, Z0 + 1, "teal", 6)
    P.flat(g, glass & (d > DR - 3.3), "teal", 4)  # the glass darkens at the rim
    P.flat(g, glass & (X - DCX < -0.8) & (Y - DCY > 0.8) & (d < DR - 3.3), "teal", 7)
    rag = glass & (Y < DCY - 0.4) & (d < DR - 3.0)
    P.flat(g, rag, "bone", 7)
    P.flat(g, rag & (Y < DCY - 2.0), "red", 5)  # a red sock at the bottom of the drum
    # the hazard-yellow bar handle, on two brackets bolted to the bezel
    for hy in (DCY - 3.0, DCY + 1.0):
        box(g, X1 - 4, hy, Z0 - 5, X1 - 2, hy + 2, Z0 - 3, "steel", 3)
    h = box(g, X1 - 4, DCY - 4, Z0 - 7, X1 - 1, DCY + 4, Z0 - 4, "gold", 6)
    P.flat(g, h & (X < X1 - 3), "gold", 7)  # the lit edge of the bar
    P.flat(g, h & (Y < DCY - 3) | (h & (Y > DCY + 3)), "gold", 4)  # the two bolted ends
    P.flat(g, edges(h), "darkwood", 4)


def _panel(g: Grid) -> None:
    """The control band: a dark inset with two oversized dials and lamps."""
    X, Y, Z = coords(g)
    band = P.region(g, X0 + 1, YB - 3, Z0 - 2, X1 - 1, YB, Z0 + 2)
    P.flat(g, band, "steel", 4)
    P.flat(g, P.region(g, X0 + 1, YB - 1, Z0 - 2, X1 - 1, YB, Z0 + 1), "steel", 6)
    for cx, ramp in ((X0 + 3.0, "gold"), (X0 + 7.5, "red")):
        dial = disc(g, "z", cx, YB - 1.5, 1.8, Z0 - 2, Z0, ramp, 6)
        rr = np.hypot(X - cx, Y - (YB - 1.5))
        P.flat(g, dial & (rr > 1.2), ramp, 4)
    for k, (ramp, sh) in enumerate((("teal", 6), ("gold", 7), ("red", 6))):
        P.flat(g, P.region(g, X1 - 6 + k * 2, YB - 2, Z0 - 2, X1 - 5 + k * 2, YB - 1, Z0 + 1), ramp, sh)


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    # the dark plinth, the enamel body and the overhanging lid
    plinth = box(g, X0, 0, Z0, X1, YP, Z1, "rust", 4)
    P.flat(g, plinth & (Y < 1), "rust", 3)
    P.flat(g, plinth & (Y > YP - 1), "rust", 5)
    body = box(g, X0, YP, Z0, X1, YB, Z1, "steel", 6)
    P.plates(g, body, "steel", 6, size=(8, 8), seed=3)
    P.flat(g, edges(body), "steel", 3)
    lid = box(g, X0 - 1, YB, Z0 - 1, X1 + 1, YL, Z1 + 1, "steel", 7)
    P.flat(g, lid & (Y < YL - 1), "steel", 5)
    P.flat(g, edges(lid), "steel", 3)
    # the bolted service hatch on the back, so no face is blank
    hatch = P.region(g, X0 + 2, YP + 3, Z1 - 1, X1 - 7, YB - 3, Z1)
    P.flat(g, hatch, "steel", 4)
    P.outline(g, hatch, "steel", 3, normal="z")
    for bx in (X0 + 3, X1 - 9):
        for by in (YP + 4, YB - 4):
            P.flat(g, P.region(g, bx, by, Z1 - 1, bx + 1, by + 1, Z1), "steel", 7)
    # wear that follows the construction: seams, three blooms, mould at the foot
    seam_rust(g, body | lid, (YP + 0.5, YB - 0.5), shade=5)
    rust_runs(g, body, ((X1, YB - 4, Z1 - 4, 3.0), (X0, YP + 4, Z0 + 9, 2.6), (X0 + 11, YB, Z1, 2.4)), base=5, drip=4, seed=4)
    chips(g, body | plinth, ((X0, YP, Z0 + 5, 2.6),), "teal", 3, seed=5)
    _porthole(g)
    _panel(g)
    # the +x side: a vent grille, a clean hazard band and the water plate
    for vy in (YP + 1, YP + 3):
        P.flat(g, P.region(g, X1 - 1, vy, Z0 + 3, X1, vy + 1, Z1 - 3), "steel", 4)
    pnpaint.hazard(g, P.region(g, X1 - 1, YP + 5, Z0 + 1, X1, YP + 7, Z1 - 1), period=4, a=("gold", 6), b=("darkwood", 3), frame="x")
    plate = P.region(g, X1 - 1, YP + 7, Z0 + 2, X1, YB - 1, Z1 - 2)
    P.flat(g, plate, "gold", 6)
    P.flat(g, plate & (Y > YB - 2), "gold", 4)
    P.outline(g, plate, "darkwood", 4, normal="x")
    P.flat(g, plate & (np.abs(Z - (Z0 + 7.5)) < 1.6) & (Y > YP + 8) & (Y < YB - 3), "teal", 3)  # a drop mark
    # the drain hose: a ribbed pipe down the back on two clamps, to a brass coupler
    hose = box(g, X1 - 5, YP + 2, Z1, X1 - 2, YB - 2, Z1 + 2, "steel", 4)
    P.flat(g, hose & (np.floor(Y) % 3 == 0), "steel", 6)
    P.flat(g, edges(hose), "steel", 3)
    for cy in (YP + 4, YB - 5):
        c = box(g, X1 - 6, cy, Z1, X1 - 1, cy + 1, Z1 + 3, "steel", 4)
        P.flat(g, edges(c), "steel", 3)
    cap = box(g, X1 - 5, YP, Z1, X1 - 2, YP + 2, Z1 + 2, "gold", 6)
    P.flat(g, edges(cap), "darkwood", 4)
    P.grime(g, plinth, height=2, seed=7)
    return asset("washing-machine", "Scavenged Washing Machine", root("washing-machine", g))
