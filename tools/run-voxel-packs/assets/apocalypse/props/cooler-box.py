"""Scavenged cool box, in the Pirate Nation style.

One chunky icon (rule K3): a battered steel chest on stubby feet with
oversized end handles (rule F4). Its lid is hinged on the back top edge and
stands ajar on that hinge (rule F5), showing ice slabs and bottles packed
inside. A signal-red band with an ICE stencil and a zombie-teal lid panel
carry the accents (rule C3); rust is grouped on the edges and bleeds down
the plates (rules S1–S3).
"""
import numpy as np

import paint as P
import pnglyph
from _props import asset, child, chips, root, rust_runs, seam_rust
from pnkit import box, edges, on_face
from pnshapes import coords, disc
from voxgrid import Grid

GW, GH, GD = 26, 16, 20
X0, X1, Z0, Z1 = 4, 22, 3, 15  # the box: 18 wide and 12 deep (a person is 36)
Y0, Y1 = 2, 12  # the feet are 2 high, the body 10 high
LID_OPEN = 38.0  # degrees: the lid stands ajar, so the box stays low


def lid() -> Grid:
    """The hinged lid: a plated slab with a teal top panel and a hasp tab."""
    g = Grid(X1 - X0 + 2, 4, Z1 - Z0 + 2)
    w, d = X1 - X0 + 2, Z1 - Z0 + 2
    m = box(g, 0, 0, 0, w, 3, d, "steel", 5)
    P.plates(g, m, "steel", 5, size=(7, 5), seed=3)
    panel = P.region(g, 3, 2, 3, w - 3, 3, d - 3)
    P.flat(g, panel, "teal", 4)
    P.flat(g, panel & (np.floor(coords(g)[0]) % 4 == 0), "teal", 5)
    P.outline(g, panel, "teal", 2, normal="y")
    P.flat(g, edges(m), "steel", 2)
    rim = P.region(g, 0, 0, 0, w, 1, d) & ~P.region(g, 2, 0, 2, w - 2, 1, d - 2)
    P.flat(g, rim, "steel", 4)  # the sealing rim on the underside
    P.flat(g, P.region(g, 2, 0, 2, w - 2, 1, d - 2), "steel", 6)  # the liner inside it
    P.outline(g, rim, "steel", 2, normal="y")
    tab = box(g, w // 2 - 2, 0, 0, w // 2 + 2, 3, 2, "steel", 6)  # the hasp tab
    P.flat(g, tab, "steel", 6)
    P.flat(g, tab & (np.abs(coords(g)[0] - w / 2) < 1.2), "gold", 4)
    P.flat(g, edges(tab), "steel", 3)
    return g


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    for fx in (X0 + 1, X1 - 4):
        for fz in (Z0 + 1, Z1 - 4):
            f = box(g, fx, 0, fz, fx + 3, Y0, fz + 3, "darkwood", 5)
            P.flat(g, edges(f), "darkwood", 4)
    body = box(g, X0, Y0, Z0, X1, Y1, Z1, "steel", 5)
    P.plates(g, body, "steel", 5, size=(8, 6), seed=2)
    P.flat(g, edges(body), "steel", 2)
    seam_rust(g, body, (Y0 + 1, Y1 - 1), shade=4)
    rust_runs(g, body, ((X0, Y1 - 2, Z0 + 3, 2.4), (X1, Y1 - 1, Z1 - 3, 2.2)), base=5, drip=4, seed=5)
    P.grime(g, body, height=2, seed=4)
    # the signal-red band with the ICE stencil: the one loud accent
    band = body & (Y > Y0 + 1) & (Y < Y1 - 1)
    P.flat(g, band, "red", 5)
    P.flat(g, band & (Y > Y1 - 2), "red", 6)  # the lit top row of the band
    chips(g, band, ((X1, Y0 + 4, Z1 - 3, 2.0),), "rust", 4, seed=8)
    tw, _ = pnglyph.text_size("ICE")
    pnglyph.text(g, "-z", Z0, X0 + (X1 - X0 - tw) // 2, Y0 + 1, "ICE", "bone", 7)
    pnglyph.text(g, "+z", Z1, X0 + (X1 - X0 - tw) // 2, Y0 + 1, "ICE", "bone", 7)
    # a grip on each end, on two short brackets: 2 voxels proud of the box
    for face, plane in (("-x", X0), ("+x", X1)):
        for bz in (Z0 + 2, Z1 - 4):
            br = box(g, *on_face(face, plane, bz, bz + 2, Y0 + 5, Y0 + 7, 0, 1), "steel", 4)
            P.flat(g, br, "steel", 4)
        h = box(g, *on_face(face, plane, Z0 + 2, Z1 - 2, Y0 + 5, Y0 + 7, 1, 2), "steel", 6)
        P.flat(g, h, "steel", 6)
        P.flat(g, h & (Y > Y0 + 6), "steel", 7)  # the lit top of the grip
        P.flat(g, h & (Z > Z0 + 4) & (Z < Z1 - 4), "steel", 5)  # the worn middle, where a hand goes
    # the hasp on the front, under the lid edge
    hx = (X0 + X1) // 2
    hasp = box(g, hx - 2, Y1 - 2, Z0 - 1, hx + 2, Y1, Z0, "steel", 6)
    P.flat(g, hasp, "steel", 6)
    P.flat(g, hasp & (np.abs(X - (X0 + X1) / 2) < 1.2), "gold", 4)
    # the contents: ice slabs at the back and two bottles at the front,
    # where the open lid stands well clear of them
    for ix, iw, ih in ((X0 + 1, 6, 3), (X0 + 7, 5, 2), (X1 - 6, 5, 3)):
        ice = box(g, ix, Y1 - ih, Z0 + 5, ix + iw, Y1, Z1 - 1, "sky", 6)
        P.flat(g, ice & (np.floor(X + Z) % 4 == 0), "sky", 7)
        P.flat(g, edges(ice), "sky", 5)
    for bx, ramp in ((X0 + 4.0, "teal"), (X1 - 5.0, "red")):
        b = disc(g, "y", bx, Z0 + 2.5, 1.8, Y1 - 6, Y1 + 2, ramp, 4)
        P.flat(g, b & (Y > Y1), ramp, 3)
        P.flat(g, b & (Y > Y1 - 2) & (Y < Y1), "bone", 7)  # the label
        box(g, int(bx) - 1, Y1 + 2, Z0 + 2, int(bx) + 1, Y1 + 3, Z0 + 4, "gold", 5)
    r = root("cooler-box", g)
    child(r, "lid", lid(), pivot=(0.0, 0.0, float(Z1 - Z0 + 2)), at_grid=(float(X0 - 1), float(Y1), float(Z1 + 1)), rot=(LID_OPEN, 0.0, 0.0))
    return asset("cooler-box", "Cool Box", r)
