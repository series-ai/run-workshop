"""Alien egg clutch, in the Pirate Nation mecha style.

One chunky icon (rule K3): a xeno egg incubator. Three alien eggs stand
in steel cradle cups with copper rims on a plated steel deck. Their steel
shells have white armor panels, dark seams and cyan life-sign windows.
The largest shell has split into four cyan energy petals around a bright
core. A steel incubator unit feeds the main cradle through a copper pipe.
Its screen and warning lamp make the function clear. Detail is paint (S1).
Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnpaint
from _pn import pipe
from _props import cham_prism, lamp, ngon_prism
from pnkit import box
from pnshapes import coords, seams
from voxgrid import C, Asset, Grid, Part

W, H, D = 34, 26, 30
DECK = 3  # deck top
# eggs: (x, z, radius, height, open top)
BIG = (15.0, 14.0, 6.0, 12.0)
EGGS = [(25.5, 8.0, 3.6, 10.0), (6.5, 8.0, 3.2, 9.0), (26.5, 21.0, 3.0, 8.0)]
UNIT = (3, 20, 11, 27)  # incubator unit x0, z0, x1, z1


def deck(g: Grid) -> None:
    X, Y, Z = coords(g)
    skirt = cham_prism(g, "y", 1, 1, 33, 29, 5, 0, DECK, "steel", 3)
    pnpaint.hazard(g, skirt & (Y < DECK - 1), period=4, a=("orange", 4), b=("steel", 2))
    P.flat(g, skirt & (Y < 0.6), "steel", 2)
    top = cham_prism(g, "y", 2, 2, 32, 28, 4.5, DECK - 1, DECK, "steel", 4)
    P.plates(g, top, "steel", 4, size=(8, 7), seed=3)
    P.flat(g, top & ~skirt_top(g, top), "steel", 4)
    P.flat(g, skirt & (Y > DECK - 1), "steel", 3)
    # floor marks: a cyan light strip along the front and orange corner chevrons
    lit = skirt_top(g, top)
    P.flat(g, lit & (np.abs(Z - 3.5) < 0.5) & (X > 11) & (X < 21), "plasma", 6)
    hatch = lit & (X > 13) & (X < 20) & (Z > 5) & (Z < 8)
    hatch_edge = hatch & ((X < 14.5) | (X > 18.5) | (Z < 6) | (Z > 7))
    P.flat(g, hatch_edge, "iron", 4)
    P.flat(g, hatch & ~hatch_edge, "steel", 5)
    for hx, hz in ((14, 5.5), (19, 5.5), (14, 7.5), (19, 7.5)):
        P.flat(g, hatch & (np.hypot(X - hx, Z - hz) < 0.55), "orange", 5)
    for cx, cz, sx, sz in ((4.5, 26.0, 1, -1), (29.5, 26.0, -1, -1), (29.5, 4.0, -1, 1), (4.5, 4.0, 1, 1)):
        P.flat(g, lit & (((np.abs(Z - cz) < 0.5) & ((X - cx) * sx >= 0) & ((X - cx) * sx < 4)) | ((np.abs(X - cx) < 0.5) & ((Z - cz) * sz >= 0) & ((Z - cz) * sz < 4))), "orange", 4)


def skirt_top(g: Grid, m: np.ndarray) -> np.ndarray:
    up = np.zeros_like(m)
    up[:, :-1, :] = m[:, :-1, :] & (g.a[:, 1:, :] == 0)
    return up


def cup(g: Grid, cx, cz, r) -> None:
    """A steel cradle cup with a copper rim; the egg sits down inside it."""
    X, Y, Z = coords(g)
    c = ngon_prism(g, "y", cx, cz, r * 0.8, DECK - 0.5, DECK + 2.5, "steel", 4, r_top=r + 0.9)
    P.flat(g, c, "steel", 4)
    P.flat(g, c & seams(g, [g.solids[-1]], 0.6), "steel", 2)
    P.flat(g, c & (np.abs(Y - (DECK + 1.0)) < 0.5), "iron", 4)
    rim = ngon_prism(g, "y", cx, cz, r + 0.9, DECK + 2.5, DECK + 3.5, "rust", 4)
    P.flat(g, rim, "rust", 4)
    P.flat(g, rim & skirt_top(g, rim), "rust", 5)
    ang = np.arctan2(Z - cz, X - cx)
    clamps = rim & (Y > DECK + 2.5) & (np.abs(np.sin(ang * 4)) > 0.94)
    P.flat(g, clamps, "orange", 5)


def egg(g: Grid, cx, cz, r, h, open_top: bool = False) -> np.ndarray:
    """An egg of three octagonal frustums, widest a third of the way up,
    seated in its cup (its foot is below the cup rim)."""
    y0 = DECK + 0.5
    y1, y2 = y0 + h * 0.35, y0 + h * 0.7
    n0 = len(g.solids)
    ngon_prism(g, "y", cx, cz, r * 0.62, y0, y1, "steel", 4, r_top=r)
    ngon_prism(g, "y", cx, cz, r, y1, y2, "steel", 4, r_top=r * 0.86)
    if not open_top:
        ngon_prism(g, "y", cx, cz, r * 0.86, y2, y0 + h, "steel", 4, r_top=r * 0.34)
    solids = g.solids[n0:]
    m = np.logical_or.reduce([s.mask(g.shape) for s in solids])
    X, Y, Z = coords(g)
    deg = (np.degrees(np.arctan2(Z - cz, X - cx)) + 90 + 22.5) % 360
    side = np.floor(deg / 45).astype(int) % 8
    t = (deg % 45) / 45
    P.flat(g, m, "steel", 5)
    P.flat(g, m & ((side == 0) | (side == 7) | (side == 1)), "steel", 6)
    P.flat(g, m & (Y > y0 + h * 0.62), "bone", 5)
    P.flat(g, m & (Y > y0 + h * 0.62) & ((side == 0) | (side == 7)), "bone", 6)
    P.flat(g, m & (Y > y0 + h * 0.86), "bone", 7)
    P.flat(g, m & seams(g, solids, 0.25), "iron", 4)
    plate_band = m & (Y > y0 + h * 0.25) & (Y < y0 + h * 0.78)
    P.flat(g, plate_band & ((side == 0) | (side == 1) | (side == 7)), "bone", 5)
    P.flat(g, plate_band & ((side == 0) | (side == 1) | (side == 7)) & (t > 0.18) & (t < 0.82), "bone", 6)
    # Cyan life-sign windows sit inside dark shell panels.
    wy = y1 + (y2 - y1) * 0.35
    bezel = m & (side % 2 == 0) & (np.abs(t - 0.5) < 0.4) & (np.abs(Y - wy) < 1.5)
    glass = m & (side % 2 == 0) & (np.abs(t - 0.5) < 0.25) & (np.abs(Y - wy) < 1.0)
    P.flat(g, bezel, "iron", 4)
    P.flat(g, glass, "cyan", 6)
    P.flat(g, glass & (Y > wy), "cyan", 7)
    if r > 3.3:
        status = m & (side % 2 == 1) & (np.abs(t - 0.5) < 0.16) & (np.abs(Y - (y2 + 0.2)) < 0.6)
        P.flat(g, status, "plasma", 6)
    return m


def unit(g: Grid) -> None:
    """The incubator unit: steel cabinet, screen, gauge, warning lamp."""
    X, Y, Z = coords(g)
    x0, z0, x1, z1 = UNIT
    y1 = DECK + 8
    cab = cham_prism(g, "y", x0, z0, x1, z1, 1.5, DECK - 0.5, y1, "steel", 5)
    P.plates(g, cab, "steel", 5, size=(9, 5), rivets=False, seed=7)
    P.flat(g, cab & seams(g, [g.solids[-1]], 0.6), "steel", 3)
    cap = cham_prism(g, "y", x0 - 0.5, z0 - 0.5, x1 + 0.5, z1 + 0.5, 1.8, y1, y1 + 1.5, "bone", 6)
    P.flat(g, cap, "bone", 6)
    P.flat(g, cap & (Y < y1 + 0.5), "bone", 4)
    # front screen with a pulse line (faces -Z)
    scr = box(g, x0 + 1, DECK + 3, z0 - 1, x1 - 1, DECK + 7, z0, "navy", 2)
    screen_face = scr & (Z < z0)
    P.flat(g, screen_face, "navy", 2)
    frame = screen_face & ((X < x0 + 2.5) | (X > x1 - 2.5) | (Y < DECK + 4.5) | (Y > DECK + 5.5))
    P.flat(g, frame, "steel", 4)
    U = X - (x0 + 1)
    screen = screen_face & ~frame
    pulse_y = DECK + 4.5 + (np.floor(U) % 3 == 1)
    P.flat(g, screen & (np.abs(Y - pulse_y) < 0.7), "plasma", 7)
    # an orange band and a green-lit status dot under it
    P.flat(g, cab & (np.abs(Y - (DECK + 1.5)) < 0.5), "orange", 4)
    # a gauge on the outer side (-x) and vents on the back
    P.flat(g, cab & (X < x0 + 0.5) & (np.hypot(Z - (z0 + 3.5), Y - (DECK + 5)) < 2.2), "steel", 2)
    P.flat(g, cab & (X < x0 + 0.5) & (np.hypot(Z - (z0 + 3.5), Y - (DECK + 5)) < 1.5), "bone", 6)
    P.flat(g, cab & (X < x0 + 0.5) & (np.abs(Z - (z0 + 3.5) - (Y - (DECK + 5))) < 0.6) & (np.hypot(Z - (z0 + 3.5), Y - (DECK + 5)) < 1.5), "red", 4)
    P.flat(g, cab & (Z > z1 - 0.5) & (np.floor(Y) % 2 == 0) & (Y > DECK + 3) & (Y < DECK + 7) & (np.abs(X - (x0 + x1) / 2) < 2.5), "steel", 3)
    # warning lamp on the cap
    lamp(g, (x0 + x1) / 2, y1 + 1.5, (z0 + z1) / 2, r=1.6, h=2, glass=("orange", 5))


def clutch() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    deck(g)
    unit(g)
    bx, bz, br, bh = BIG
    # copper feed pipe from the unit into the big cradle
    pipe(g, [(UNIT[2] - 0.5, DECK + 1.5, 23.0), (bx, DECK + 1.5, 23.0), (bx, DECK + 1.5, bz + br)], s=2, ramp="rust", base=5, flange=False)
    cup(g, bx, bz, br)
    egg(g, bx, bz, br, bh, open_top=True)
    # the glowing core in the open egg
    y2 = DECK + 0.5 + bh * 0.7
    core = ngon_prism(g, "y", bx, bz, br * 0.72, y2 - 0.5, y2 + 3, "plasma", 5, r_top=br * 0.32)
    P.flat(g, core, "plasma", 5)
    P.flat(g, core & (Y > y2 + 1), "plasma", 7)
    P.flat(g, core & (Y > y2 + 2.5) & (np.hypot(X - bx, Z - bz) < 1.0), "bone", 7)
    for (cx, cz, r, h) in EGGS:
        cup(g, cx, cz, r)
        egg(g, cx, cz, r, h)
    return g


def petal() -> Grid:
    """One petal of the split shell: a pointed leaf, thick as a shell,
    leaned out by its part rotation."""
    g = Grid(8, 10, 2)
    g.prism("z", [(0.5, 0), (7.5, 0), (7.6, 3.5), (5.6, 7.0), (4.0, 9.5), (2.4, 7.0), (0.4, 3.5)], 0.2, 1.8, C("cyan", 5))
    X, Y, Z = coords(g)
    m = g.a > 0
    P.flat(g, m, "plasma", 4)
    P.flat(g, m & (Y > 4), "plasma", 5)
    P.flat(g, m & (Y > 7), "cyan", 6)
    P.flat(g, m & (np.abs(X - 4.0) < 0.5) & (Y > 1) & (Y < 8), "iron", 3)
    P.flat(g, m & (Z < 1.0), "cyan", 5)
    P.flat(g, m & (Z < 1.0) & (Y > 5), "cyan", 7)
    P.flat(g, m & (Y < 1.2), "iron", 3)
    return g


def build() -> Asset:
    root = Part("alien-eggs", clutch())
    bx, bz, br, bh = BIG
    y2 = DECK + 0.5 + bh * 0.7
    rim = br + 0.4
    for k, ry in enumerate((45.0, 135.0, 225.0, 315.0)):
        a = math.radians(ry)
        at = (bx + rim * math.sin(a), y2 - 2.7, bz + rim * math.cos(a))
        root.add(Part(f"petal-{k}", petal(), pivot=(4.0, 0.5, 1.0), at=at, rot=(38.0, ry, 0.0)))
    return Asset(id="space-props-alien-eggs", pack="space", category="props", name="Alien Egg Clutch", root=root)
