"""Netted cargo pallet, in the Pirate Nation mecha style.

One iconic shape (rule K3): a steel pallet with solid hazard-orange corner
guards carrying three clearly separated containers — a big white hull crate,
a copper canister with steel hoops and a cyan gauge, and a small crate with
a teal lid. A real cargo net of thin dark steel straps is modelled over the
big crate, so the net reads as straps and not as painted checker (S1, S3).
Every box is framed dark (S4). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnpaint
from _props import cham_prism, dots, hull, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

W, H, D = 34, 32, 26
PY = 3  # pallet top


def pile() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    # The pallet: a steel deck with painted bearers and solid corner guards.
    deck = box(g, 0, 0, 0, W, PY, D, "steel", 4)
    P.flat(g, deck & (Y > PY - 1.5), "steel", 5)
    P.flat(g, deck & (Y > PY - 1.5) & (np.floor(Z) % 5 == 0), "steel", 3)
    P.flat(g, deck & (Y < 1), "iron", 3)
    P.flat(g, edges(deck), "steel", 2)
    for x0 in (0, W - 4):
        for z0 in (0, D - 4):
            gu = box(g, x0, 0, z0, x0 + 4, PY + 1, z0 + 4, "orange", 5)
            P.flat(g, gu & (Y > PY - 0.5), "orange", 6)
            P.flat(g, gu & (Y < 1.5), "orange", 3)

    # The big white hull crate, framed dark, with one orange band.
    cham_prism(g, "y", 2, 3, 21, 23, 2.0, PY, PY + 16, "bone", 6)
    crate = g.solids[-1].mask(g.shape)
    for m, fr in facets(g, g.solids[-1:]):
        P.plates(g, m, "bone", 6, size=(8, 8), rivets=False, frame=fr)
    P.flat(g, edges(crate), "steel", 2)
    P.flat(g, crate & (Y > PY + 13) & (Y < PY + 15), "orange", 5)
    P.flat(g, crate & (np.abs(Y - (PY + 14)) < 0.4), "orange", 3)
    P.flat(g, crate & (Y > PY + 15), "bone", 7)
    P.flat(g, crate & (np.abs(Y - (PY + 0.5)) < 0.6), "steel", 3)
    lab = crate & (Z < 4) & (X > 6) & (X < 17) & (Y > PY + 4) & (Y < PY + 10)
    P.flat(g, lab, "cyan", 2)
    P.flat(g, lab & (X > 7) & (X < 16) & (Y > PY + 5) & (Y < PY + 9), "cyan", 5)
    P.flat(g, lab & (np.floor(Y) % 2 == 0) & (X > 7) & (X < 16) & (Y > PY + 5) & (Y < PY + 9), "cyan", 6)

    # A real cargo net: one-voxel dark steel straps over the crate and down
    # its four sides, with copper buckles where they meet the pallet.
    net = np.zeros(g.shape, dtype=bool)
    for xx in (7, 15):
        net |= box(g, xx, PY + 16, 2, xx + 1, PY + 17, 24, "iron", 5)
        net |= box(g, xx, PY, 2, xx + 1, PY + 17, 3, "iron", 5)
        net |= box(g, xx, PY, 23, xx + 1, PY + 17, 24, "iron", 5)
    for zz in (8, 17):
        net |= box(g, 1, PY + 16, zz, 22, PY + 17, zz + 1, "iron", 5)
        net |= box(g, 1, PY, zz, 2, PY + 17, zz + 1, "iron", 5)
        net |= box(g, 21, PY, zz, 22, PY + 17, zz + 1, "iron", 5)
    P.flat(g, net, "iron", 5)
    P.flat(g, net & (Y > PY + 16), "iron", 6)
    P.flat(g, net & (Z < 3), "iron", 6)
    for xx in (7, 15):
        bk = box(g, xx - 1, PY, 1, xx + 2, PY + 3, 3, "rust", 5)
        P.flat(g, bk & (Y > PY + 1.5), "rust", 6)

    # The copper canister: steel hoops, a cyan gauge, a valve cap.
    can = ngon_prism(g, "y", 27.0, 8.0, 4.6, PY, PY + 15, "rust", 5, n=8)
    P.flat(g, can, "rust", 5)
    P.flat(g, can & (Z < 6.0), "rust", 6)
    for yy in (PY + 2, PY + 7, PY + 12):
        P.flat(g, can & (np.abs(Y - yy) < 1.1), "steel", 4)
        P.flat(g, can & (np.abs(Y - yy) < 0.4), "steel", 5)
    P.flat(g, can & (Y > PY + 3) & (Y < PY + 6) & (Z < 4.4) & (np.abs(X - 27) < 1.6), "cyan", 6)
    cap = ngon_prism(g, "y", 27.0, 8.0, 3.2, PY + 15, PY + 17, "steel", 4, n=8)
    P.flat(g, cap & (Y > PY + 16), "steel", 5)
    P.flat(g, cap & (np.hypot(X - 27, Z - 8) < 1.4) & (Y > PY + 16), "cyan", 7)

    # The small crate with a teal lid, set clear of the others.
    sm = cham_prism(g, "y", 23, 15, 33, 25, 1.5, PY, PY + 8, "steel", 5)
    for m, fr in facets(g, g.solids[-1:]):
        P.plates(g, m, "steel", 5, size=(6, 6), rivets=False, frame=fr)
    P.flat(g, edges(sm), "steel", 2)
    P.flat(g, sm & (Y > PY + 6), "teal", 5)
    P.flat(g, sm & (Y > PY + 7) & (X > 24) & (X < 32) & (Z > 16) & (Z < 24), "teal", 6)
    P.flat(g, sm & (np.abs(Y - (PY + 6)) < 0.5), "iron", 2)
    P.flat(g, sm & (Y > PY + 7) & (np.abs(X - 28) < 1.1), "teal", 3)
    lt = box(g, 27, PY + 5, 15, 29, PY + 8, 16, "rust", 5)
    P.flat(g, lt & (Y > PY + 6.5), "rust", 6)
    P.flat(g, sm & (Z < 16.5) & (X > 25) & (X < 31) & (Y > PY + 2) & (Y < PY + 5), "orange", 5)
    dots(g, sm & (Z < 16.5), "-z", [(28.0, PY + 3.5)], 1.0, "cyan", 7)
    return g


def build() -> Asset:
    root = Part("cargo-net-pile", pile())
    return Asset(id="space-props-cargo-net-pile", pack="space", category="props", name="Netted Cargo Pallet", root=root)
