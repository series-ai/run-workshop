"""Decontamination shower, in the Pirate Nation mecha style.

One iconic shape (rule K3): an open booth of thick dark steel corner posts
and a closed top canopy (F3), filled with white hull panels that carry
painted seams, a copper band and a hazard-orange kickplate (S1, S4). The
oversized function prop is the canopy shower head: a copper stack inside a
glowing cyan nozzle ring (F4). A grated steel floor drains into a copper
sump; a big cyan control screen sits on one post. Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnpaint
from _pn import pipe
from _props import dots, hull, ngon_prism, screen
from pnkit import box, edges
from pnshapes import coords
from voxgrid import Asset, Grid, Part, Socket

W, H, D = 28, 40, 24
X0, X1, Z0, Z1 = 0, 28, 0, 24
P0 = 4  # post thickness
TOP = 32  # underside of the canopy


def booth() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    # Floor pan: a grated steel deck with a copper sump and a hazard rim.
    pan = box(g, X0, 0, Z0, X1, 3, Z1, "steel", 4)
    P.flat(g, pan & (Y > 2), "steel", 5)
    grate = pan & (Y > 2) & (X > P0) & (X < X1 - P0) & (Z > P0 - 2) & (Z < Z1 - P0)
    P.flat(g, grate, "steel", 3)
    P.flat(g, grate & (np.floor(X) % 3 == 0), "steel", 2)
    rad = np.hypot(X - 14.0, Z - 13.0)
    P.flat(g, grate & (rad < 4.0), "rust", 5)
    P.flat(g, grate & (rad < 2.4), "rust", 3)
    P.flat(g, grate & (rad < 1.2), "cyan", 6)
    pnpaint.hazard(g, pan & (Y > 0.5) & (Y < 2.5), period=6, a=("orange", 5), b=("iron", 4), frame="wall")
    P.flat(g, edges(pan), "iron", 2)

    # Three white hull walls between thick steel posts; the front stays open.
    walls = np.zeros(g.shape, dtype=bool)
    walls |= box(g, X0, 3, Z1 - P0, X1, TOP, Z1, "bone", 6)          # back
    walls |= box(g, X0, 3, Z0, P0, TOP, Z1, "bone", 6)               # -x
    walls |= box(g, X1 - P0, 3, Z0, X1, TOP, Z1, "bone", 6)          # +x
    hull(g, walls, "bone", 6, size=(8, 7), edge=3, seed=9)
    P.flat(g, walls & (Y > 17) & (Y < 20), "rust", 5)                # copper band
    P.flat(g, walls & (np.abs(Y - 18.5) < 0.6), "rust", 6)
    P.flat(g, walls & (Y > 3) & (Y < 6), "orange", 5)                # kickplate
    P.flat(g, walls & (np.abs(Y - 4.5) < 0.6), "orange", 3)

    # Thick dark steel corner posts, carried from the pan to the canopy.
    posts = np.zeros(g.shape, dtype=bool)
    for x0 in (X0, X1 - P0):
        for z0 in (Z0, Z1 - P0):
            posts |= box(g, x0, 3, z0, x0 + P0, TOP + 4, z0 + P0, "steel", 4)
    P.plates(g, posts, "steel", 4, size=(6, 8))
    P.flat(g, edges(posts), "steel", 2)

    # The canopy: a closed top frame that joins all four posts.
    cap = np.zeros(g.shape, dtype=bool)
    cap |= box(g, X0, TOP, Z0, X1, TOP + 4, Z0 + P0, "steel", 4)
    cap |= box(g, X0, TOP, Z1 - P0, X1, TOP + 4, Z1, "steel", 4)
    cap |= box(g, X0, TOP, Z0, P0, TOP + 4, Z1, "steel", 4)
    cap |= box(g, X1 - P0, TOP, Z0, X1, TOP + 4, Z1, "steel", 4)
    P.plates(g, cap, "steel", 4, size=(7, 7))
    P.flat(g, edges(cap), "steel", 2)
    P.flat(g, cap & (Y > TOP + 2.5), "steel", 5)
    P.flat(g, cap & (np.abs(Y - (TOP + 0.5)) < 0.6), "cyan", 6)

    # The oversized shower head: a copper stack in a glowing cyan ring.
    box(g, 12, TOP + 2, 11, 16, TOP + 6, 15, "rust", 4)  # the mast above the frame
    stack = ngon_prism(g, "y", 14.0, 13.0, 3.4, TOP + 1, TOP + 4, "rust", 5, n=8)
    P.flat(g, stack, "rust", 5)
    P.flat(g, stack & (Y > TOP + 3), "rust", 6)
    ring = ngon_prism(g, "y", 14.0, 13.0, 7.2, TOP - 1, TOP + 2, "steel", 4, n=8)
    P.flat(g, ring, "steel", 4)
    rad = np.hypot(X - 14.0, Z - 13.0)
    P.flat(g, ring & (Y > TOP + 1) & (rad < 6.2), "cyan", 6)
    P.flat(g, ring & (Y > TOP + 1) & (rad < 4.0), "cyan", 7)
    lens = ngon_prism(g, "y", 14.0, 13.0, 5.8, TOP - 2, TOP - 1, "cyan", 5, n=8)
    P.flat(g, lens, "cyan", 5)
    P.flat(g, ngon_prism(g, "y", 14.0, 13.0, 3.6, TOP - 2, TOP - 1, "cyan", 7, n=8), "cyan", 7)

    # A copper feed pipe down the back corner into the canopy.
    pipe(g, [(X1 - 6, TOP - 2, Z1 - 6), (X1 - 6, 6, Z1 - 6)], s=3, ramp="rust", base=5)

    # The control panel on the +x post, with a big cyan screen.
    pad = box(g, X1 - P0 - 3, 14, Z0 + 2, X1 - P0, 26, Z0 + 10, "steel", 5)
    P.flat(g, edges(pad), "steel", 2)
    screen(g, "-x", X1 - P0 - 3, Z0 + 3, 16, Z0 + 9, 24, glass=("cyan", 5), line=("cyan", 7), rim=("steel", 2), d=1)
    dots(g, pad, "-x", [(Z0 + 4.5, 15.5), (Z0 + 7.5, 15.5)], 1.0, "orange", 6)

    # A hand shower and a hose hanging on the back wall.
    hose = box(g, 5, 20, Z1 - P0 - 2, 7, 30, Z1 - P0, "rust", 4)
    P.flat(g, hose & (np.floor(Y) % 3 == 0), "rust", 6)
    head = box(g, 4, 18, Z1 - P0 - 3, 8, 20, Z1 - P0, "steel", 5)
    P.flat(g, head & (Y < 19), "cyan", 6)
    outer = walls & ((Z > Z1 - 1) | (X < X0 + 1) | (X > X1 - 1))
    louvre = outer & (Y > 23) & (Y < 29) & (((X > 8) & (X < 20)) | ((Z > 8) & (Z < 16)))
    P.flat(g, louvre, "steel", 5)
    P.flat(g, louvre & (np.floor(Y) % 2 == 0), "steel", 3)
    P.flat(g, louvre & ((Y < 24) | (Y > 28)), "steel", 2)
    for cu, col in ((-5, "cyan"), (5, "orange")):
        lamp = walls & (Z > Z1 - 1) & (np.abs(X - (14 + cu)) < 2.2) & (Y > 9) & (Y < 13)
        P.flat(g, lamp, "steel", 2)
        P.flat(g, lamp & (np.abs(X - (14 + cu)) < 1.2) & (Y > 10) & (Y < 12), col, 6)
    return g


def build() -> Asset:
    root = Part("decon-shower", booth())
    # The spray falls from the nozzle ring, so the mist starts under it.
    spray = Socket("socket-spray", at=(14.0, float(TOP) - 3.0, 13.0))
    return Asset(
        id="space-props-decon-shower", pack="space", category="props", name="Decontamination Shower", root=root,
        sockets=[spray],
        pfx=[{"effectId": "rvx-space-launch-steam", "socket": "socket-spray", "trigger": "idle", "size": 14}],
    )
