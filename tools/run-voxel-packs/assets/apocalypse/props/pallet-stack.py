"""Leaning stack of shipping pallets, in the Pirate Nation style.

Four warm plank pallets, each turned a little on the one below (rule F5),
with a teal tarp half pulled over the top and draped down one side on a
true slope, tied with a rope. A red crowbar lies on top. Boards, nail
dots, the tarp's creases and the rope are paint (rule S1).
"""
import numpy as np

import paint as P
from _props import asset, child, pallet, root
from pnkit import box
from pnshapes import bar, coords
from voxgrid import C, Grid

PW = 24


def one_pallet(seed: int, ramp: str = "sand", base: int = 5) -> Grid:
    g = Grid(PW, 4, PW)
    pallet(g, 0, 0, 0, PW, PW, ramp=ramp, base=base, seed=seed)
    return g


def tarp() -> Grid:
    """A tarp lying on the top pallet and draping down its +x side."""
    g = Grid(PW + 8, 22, PW - 4)
    X, Y, Z = coords(g)
    g.prism("z", [(8, 17.5), (PW + 1.5, 17.5), (PW + 6, 0), (PW + 4, 0), (PW - 0.5, 16), (8, 16)], 2, PW - 5, C("teal", 5))
    m = g.solids[-1].mask(g.shape)
    P.flat(g, m & (np.floor(Z) % 5 == 0), "teal", 4)  # creases
    P.flat(g, m & (Y > 16) & (X < 10), "teal", 3)  # the pulled-back edge
    P.flat(g, m & (np.abs(Z - 9) < 0.6), "sand", 6)  # the rope over it
    P.flat(g, m & (Y > 16) & (X > 12) & (X < 17), "teal", 6)  # a lit fold
    return g


def build():
    g = Grid(PW + 2, 5, PW + 2)
    pallet(g, 0, 0, 0, PW, PW, ramp="sand", base=5, seed=1)
    r = root("pallet-stack", g)
    turns = ((4, 6.0, 0.5, 0.5, "sand", 6), (8, -5.0, -0.5, 1.0, "wood", 6), (12, 9.0, 1.0, -0.5, "sand", 4))
    for k, (y, rot, dx, dz, ramp, shade) in enumerate(turns):
        child(r, f"pallet-{k + 2}", one_pallet(k + 2, ramp, shade), pivot=(PW / 2, 0.0, PW / 2), at_grid=(PW / 2 + dx, y, PW / 2 + dz), rot=(0.0, rot, 0.0))
    child(r, "tarp", tarp(), pivot=(0.0, 0.0, 0.0), at_grid=(0.0, 0.0, 3.0))
    cb = Grid(22, 3, 3)
    m = bar(cb, "z", (0.5, 1.0), (20.5, 1.5), 1.8, 0, 3, "red", 5)
    P.flat(cb, m & (coords(cb)[0] > 18), "steel", 6)
    box(cb, 0, 1, 0, 2, 3, 3, "steel", 5)
    child(r, "crowbar", cb, pivot=(11.0, 0.0, 1.5), at_grid=(4.5, 16, 13.0), rot=(0.0, -70.0, 0.0))
    return asset("pallet-stack", "Pallet Stack", r)
