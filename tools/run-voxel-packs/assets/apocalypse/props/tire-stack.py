"""Stack of worn tyres, in the Pirate Nation style.

Three fat octagonal tyres stacked a little off-centre (rule F5). Each tyre
bulges: two true frustums meet at the tread, so the stack reads as rubber
rings, not a pillar. The middle tyre wears faded hazard paint (a road
barricade); bright weeds and three flowers (gold and pink) burst out of the top hole. A spare wheel on a
red rim leans on the side. Tread, holes and paint are paint (rule S1).
"""
import numpy as np

import paint as P
from _props import asset, child, root, tuft
from pnkit import box
from pnshapes import coords, flat_ngon, ngon_radius, wheel
from voxgrid import C, Grid

TH = 6  # tyre thickness
R = 9.5  # tread flat radius
BULGE = 1.6  # the sidewalls slope in by this much


def tyre_ring(g: Grid, cx, cz, y0, k: int) -> np.ndarray:
    """One tyre: a lower and an upper frustum (true slopes), painted."""
    mid = y0 + TH / 2
    g.prism("y", flat_ngon(cx, cz, R - BULGE, 8), y0, mid, C("gray", 4), top=flat_ngon(cx, cz, R, 8))
    m = g.solids[-1].mask(g.shape)
    g.prism("y", flat_ngon(cx, cz, R, 8), mid, y0 + TH, C("gray", 4), top=flat_ngon(cx, cz, R - BULGE, 8))
    m |= g.solids[-1].mask(g.shape)
    X, Y, Z = coords(g)
    d = ngon_radius(g, "y", cx, cz)
    ang = np.arctan2(Z - cz, X - cx)
    tread = m & (d > R - 2.2) & (np.abs(Y - mid) < 1.6)
    blocks = (np.floor((ang + np.pi) / (2 * np.pi) * 24).astype(int) + (Y > mid).astype(int)) % 2 == 0
    P.flat(g, tread & blocks, "gray", 3)
    P.flat(g, m & (np.abs(Y - mid) < 0.5) & (d > R - 1.2), "gray", 3)  # the centre groove
    top = m & (Y > y0 + TH - 1)
    P.flat(g, top & (d > R - BULGE - 1.2), "gray", 5)  # the sidewall catches light
    P.flat(g, top & (d <= 5.0), "gray", 3)  # the hole
    P.flat(g, top & (d > 5.0) & (d < 6.0), "gray", 6)  # the bead
    if k == 2:  # the top tyre is painted teal: a survivor's planter
        side = m & ~(tread & blocks) & ~(top & (d <= 6.0))
        P.flat(g, side, "teal", 5)
        P.flat(g, side & top & (d > R - BULGE - 1.2), "teal", 6)
        P.flat(g, m & (np.abs(Y - mid) < 0.5) & (d > R - 1.2), "teal", 3)
    if k == 1:  # faded hazard paint on the tread of the middle tyre
        band = m & (d > R - 2.4)
        stripe = (np.floor((ang + np.pi) / (2 * np.pi) * 12).astype(int) % 2) == 0
        P.flat(g, band & stripe, "gold", 5)
        P.flat(g, band & ~stripe, "red", 5)
    return m


def build():
    g = Grid(28, 3 * TH + 8, 28)
    # a patch of dusty sand under the stack (1 voxel thick)
    pts = [(13 + r * np.cos(a), 13 + r * np.sin(a)) for a, r in zip(np.linspace(0, 2 * np.pi, 10)[:-1], (13, 11.5, 12.8, 11, 13.4, 12, 11.2, 13, 12.2))]
    g.prism("y", pts, 0, 1, C("sand", 5))
    dust = g.solids[-1].mask(g.shape)
    P.mottle(g, dust, "sand", 5, cell=3, seed=9)
    stack = ((13, 14), (14, 13), (13, 13))
    for k, (cx, cz) in enumerate(stack):
        tyre_ring(g, cx, cz, 1 + k * TH, k)
    # weeds burst from the hole of the top tyre, and grow at the foot
    cx, cz = stack[2]
    y = 1 + 3 * TH
    for dx, dz, h, sh in ((0, 0, 6, 5), (-2, 1, 4, 4), (2, -1, 5, 6), (1, 2, 3, 4), (-1, -2, 4, 5), (3, 1, 3, 5), (-3, -1, 3, 6)):
        box(g, cx + dx, y - 1, cz + dz, cx + dx + 1, y - 1 + h, cz + dz + 1, "toxic", sh)
    for dx, dz, top_y, ramp, shade in ((0, 0, 6, "gold", 6), (2, -1, 5, "pink", 4), (-2, 1, 4, "gold", 5)):  # planter flowers
        box(g, cx + dx - 0.5, y - 1 + top_y - 1, cz + dz - 0.5, cx + dx + 1.5, y - 1 + top_y + 1, cz + dz + 1.5, ramp, shade)
    for x, z, k in ((2, 4, 0), (22, 22, 1), (3, 22, 2)):
        tuft(g, x, z, 1, seed=k)
    r = root("tire-stack", g)
    # a spare wheel on a red rim leans on the +x side of the stack
    sg = Grid(6, 18, 18)
    wheel(sg, "x", 9, 0, 8.5, 1, 5, spokes=5, tyre=("gray", 4), rim=("red", 4), spoke=("red", 5), hub=("gold", 6), hub_out=1.0)
    child(r, "spare-wheel", sg, pivot=(1.0, 0.0, 9.0), at_grid=(24, 1, 11), rot=(0.0, -10.0, 14.0))
    return asset("tire-stack", "Tyre Stack", r)
