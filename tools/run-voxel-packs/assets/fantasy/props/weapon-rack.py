"""Weapon rack in the Pirate Nation style.

A thick darkwood A-frame (true-diagonal legs) with a slotted top bar and a
low foot rail holds a row of chunky weapons leaning back a little: two
swords, a spear, a battle axe and a halberd. A round blue shield with a
gold boss leans on the end (rule F5). About 34 wide and 32 tall.
"""

import numpy as np

import paint as P
from _props import brace, coords, sword
from pnkit import box
from pnshapes import disc, last, radial
from voxgrid import C, Asset, Grid, Part

W, H, D = 40, 36, 22
Z0 = 9  # front of the rack bars


def pole(g: Grid, x, y0, y1, z, ramp="wood", base=5):
    m = box(g, x - 1, y0, z, x + 1, y1, z + 2, ramp, base)
    P.planks(g, m, ramp, base, width=2, across="x", nails=False)
    return m


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    # end frames: two legs each, splayed front to back
    for x in (3, 31):
        brace(g, "x", (1.4, Z0 - 3), (24, Z0 + 2), 2.4, x, x + 3, "darkwood", 5)
        brace(g, "x", (1.4, Z0 + 7), (24, Z0 + 2), 2.4, x, x + 3, "darkwood", 5)
    top = box(g, 2, 22, Z0 + 1, 35, 25, Z0 + 4, "darkwood", 4)
    P.planks(g, top, "darkwood", 4, width=3, across="y", nails=True, seed=1)
    rail = box(g, 2, 3, Z0 - 2, 35, 5, Z0 + 1, "darkwood", 4)
    P.planks(g, rail, "darkwood", 4, width=2, across="y", nails=True, seed=2)
    # weapons standing on the rail, leaning back on the top bar
    sword(g, 9, 5, Z0 - 1, 24, t=1, tilt=0.0)
    sword(g, 14, 5, Z0 - 1, 22, t=1, tilt=-3.0)
    # a spear: a long shaft and a steel leaf tip (true slopes)
    pole(g, 19, 3, 30, Z0 - 1)
    g.prism("z", [(19, 30), (21, 31.5), (20, 33.5), (19, 34), (18, 33.5), (17, 31.5)], Z0 - 1, Z0 + 1, C("steel", 6))
    box(g, 18, 29, Z0 - 1, 20, 30, Z0 + 1, "gold", 5)
    # a battle axe: a shaft and a crescent head
    pole(g, 24, 3, 28, Z0 - 1)
    g.prism("z", [(25, 21), (29, 19), (30, 23), (29, 27), (25, 25)], Z0 - 1, Z0 + 1, C("steel", 5))
    head = last(g)
    P.flat(g, head & (X > 28.5), "steel", 7)
    # a halberd: a shaft, an axe blade and a spike
    pole(g, 28, 3, 31, Z0 - 1, "darkwood", 5)
    g.prism("z", [(27, 24), (24, 22), (23, 26), (24, 29), (27, 28)], Z0 - 1.5, Z0 + 0.5, C("steel", 5))
    g.prism("z", [(27, 31), (29, 31), (28, 34)], Z0 - 1, Z0 + 1, C("steel", 6))
    # the round shield leaning on the +x end frame
    sh = disc(g, "x", 9, Z0 + 1, 7.5, 34.5, 36.5, "blue", 4, n=8)
    rr = radial(g, "x", 9, Z0 + 1)
    P.flat(g, sh & (rr > 6.3), "gold", 5)
    P.flat(g, sh & (rr < 2.2), "gold", 6)
    P.flat(g, sh & (np.abs(Z - (Z0 + 1)) < 0.6) & (rr > 2.2) & (rr < 6.3), "blue", 6)
    root = Part("weapon-rack", g)
    return Asset(id="fantasy-props-weapon-rack", pack="fantasy", category="props", name="Weapon Rack", root=root)
