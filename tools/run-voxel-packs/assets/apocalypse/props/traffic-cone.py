"""Traffic cones, in the Pirate Nation style.

Two chunky icons (rule K3): an upright octagonal cone (a true frustum) in
bright hazard orange with two wide reflective bands on a square base
plate, and a second cone knocked over beside it, lying at an angle (rule
F5). Scuffs, the cracked base and the bands are paint (rule S1).
"""
import numpy as np

import paint as P
from _props import asset, child, root
from pnkit import box, edges
from pnshapes import cone, coords, disc
from voxgrid import Grid

H = 17  # cone height above the plate


def paint_cone(g: Grid, m, lo: float, h: float, axis: str, center: float) -> None:
    """Paint clean reflective bands, dark facet lines and deliberate wear."""
    X, Y, Z = coords(g)
    along = {"x": X, "y": Y}[axis]
    t = (along - lo) / h
    P.flat(g, m, "orange", 5)
    upper = m & (t > 0.28) & (t < 0.44)
    lower = m & (t > 0.58) & (t < 0.70)
    P.flat(g, upper | lower, "bone", 7)
    P.flat(g, m & (t > 0.9), "orange", 6)
    # Keep only a thin dark edge at the foot of the shell.
    P.flat(g, m & (t < 0.055), "orange", 3)
    # A few chips interrupt the reflective paint in a planned pattern.
    cross = X if axis == "y" else Y
    front = Z < center
    chip_a = (t > 0.34) & (t < 0.40) & (np.abs(cross - center) < 2)
    chip_b = (t > 0.62) & (t < 0.68) & (np.abs(cross - center - 1) < 1.5)
    chips = m & front & (chip_a | chip_b) & (upper | lower)
    P.flat(g, chips, "orange", 4)
    # One rust streak reaches the lower rim. Keep the rest of each face clean.
    rust = m & front & (t < 0.18) & (np.abs(cross - center - 2) < 1.5)
    P.flat(g, rust, "red", 4)
    P.flat(g, rust & (t < 0.08) & (np.abs(cross - center - 2) < 0.6), "orange", 5)


def plate(g: Grid, x0, y0, z0, s: int) -> np.ndarray:
    m = box(g, x0, y0, z0, x0 + s, y0 + 2, z0 + s, "steel", 3)
    P.flat(g, edges(m), "steel", 2)
    X, Y, Z = coords(g)
    P.flat(g, m & (Y > y0 + 1) & (np.abs((X - x0) - (Z - z0) * 0.7 - 2) < 0.6), "steel", 5)  # a crack catches light
    top = m & (Y > y0 + 1)
    for bx in (x0 + 1.5, x0 + s - 1.5):
        for bz in (z0 + 1.5, z0 + s - 1.5):
            bolt = top & (np.hypot(X - bx, Z - bz) < 1.0)
            P.flat(g, bolt, "steel", 6)
    return m


def upright() -> Grid:
    g = Grid(14, H + 2, 14)
    plate(g, 1, 0, 1, 12)
    # A dark rubber foot sits between the cone shell and its steel plate.
    foot = disc(g, "y", 7, 7, 5.8, 2, 4, "steel", 3)
    P.flat(g, foot & (coords(g)[1] == 3.5), "steel", 2)
    m = cone(g, "y", 7, 7, 5.5, 3, 2 + H, "orange", 5, n=8, r_top=1.2)
    paint_cone(g, m, 3, H - 1, "y", 7)
    return g


def knocked() -> Grid:
    """A cone that lost its plate, built lying along +x; the part turns
    it so its lower slant facet rests on the ground."""
    g = Grid(H, 14, 14)
    collar = cone(g, "x", 7, 7, 6.1, 0, 2, "steel", 3, n=8, r_top=5.5)
    P.flat(g, collar & (coords(g)[0] == 1.5), "steel", 2)
    X, Y, Z = coords(g)
    mouth_face = collar & (X < 1) & (np.hypot(Y - 7, Z - 7) < 5.2)
    P.flat(g, mouth_face, "steel", 1)
    P.flat(g, mouth_face & (np.hypot(Y - 7, Z - 7) < 3.6), "rust", 2)
    c = cone(g, "x", 7, 7, 5.5, 2, H, "orange", 5, n=8, r_top=1.2)
    paint_cone(g, c, 2, H - 2, "x", 7)
    # The open mouth has a dark inner lip and a visible orange inner wall.
    mouth = c & (X < 4) & (np.hypot(Y - 7, Z - 7) < 4.5)
    P.flat(g, mouth, "rust", 2)
    P.flat(g, mouth & (np.hypot(Y - 7, Z - 7) < 3.2), "orange", 4)
    return g


def build():
    g = Grid(36, 20, 30)
    base = upright()
    g.paste(base, 2, 0, 2)
    r = root("traffic-cone", g)
    # the knocked cone: its plate edge on the ground, its tip resting low
    slope = float(np.degrees(np.arctan2(6.1 - 1.2, H)))
    # The cone axis drops by the radius loss, so its lower facet rests at y=0.
    # The base mouth clears the smaller plate and meets the standing cone.
    child(r, "fallen-cone", knocked(), pivot=(0.0, 0.9, 7.0), at_grid=(20.5, 0.0, 14.0), rot=(0.0, -32.0, -slope))
    return asset("traffic-cone", "Traffic Cones", r)
