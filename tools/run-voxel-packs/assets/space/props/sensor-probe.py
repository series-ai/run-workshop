"""Survey probe, in the Pirate Nation mecha style.

One chunky icon (rule K3), with a face: a big red camera eye in an iron
barrel under an orange visor, turned toward the viewer. A faceted
white ball body (three octagonal frustums, true slopes, F2) with an orange
equator band, on three bent spider legs with orange foot pads. Twin whip
antennas with lit tips lean back at different angles and a small scoop arm
reaches forward (F5). Detail is paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
from _props import ngon_prism
from pnkit import box, edges
from pnshapes import bar, coords, disc, facets
from voxgrid import Asset, Clip, Grid, Part, sway

B = 16  # body grid size
YB = 8  # body bottom above the ground


def body() -> Grid:
    g = Grid(B, B, B + 6)
    X, Y, Z = coords(g)
    c = B / 2
    cz = c + 6  # the ball centre; the camera sticks out in front of it
    ngon_prism(g, "y", c, cz, 4.0, 0, 4, "bone", 5, r_top=7.2)
    ngon_prism(g, "y", c, cz, 7.2, 4, 9, "bone", 5)
    ngon_prism(g, "y", c, cz, 7.2, 9, 13, "bone", 5, r_top=4.0)
    m = g.a > 0
    for f, fr in facets(g, g.solids):
        P.plates(g, f, "bone", 5, size=(6, 5), rivets=False, frame=fr)
    P.flat(g, m & (Y > 4) & (Y < 6), "orange", 5)
    P.flat(g, m & (Y > 12), "bone", 7)
    P.flat(g, m & (Y < 1.5), "steel", 4)
    # the big red camera eye: an iron barrel standing proud of the front,
    # a glowing red lens with a hot core and a glint, and an orange visor
    cy = 7.5
    barrel = disc(g, "z", c, cy, 4.6, 2, cz - 4, "iron", 4)
    P.flat(g, barrel, "iron", 4)
    P.flat(g, barrel & (Y > cy + 3.2), "iron", 5)
    lens = disc(g, "z", c, cy, 3.6, 1, 2, "red", 5)
    rr = np.hypot(X - c, Y - cy)
    P.flat(g, lens, "red", 4)
    P.flat(g, lens & (rr < 2.8), "red", 5)
    P.flat(g, lens & (rr < 1.8), "red", 6)
    P.flat(g, lens & (rr < 0.9), "ember", 7)
    P.flat(g, lens & (np.hypot(X - (c - 1.5), Y - (cy + 1.5)) < 0.8), "bone", 7)
    visor = box(g, c - 5, cy + 4, 1, c + 5, cy + 6, cz - 4, "orange", 6)
    P.flat(g, visor & (Y > cy + 5), "orange", 7)
    P.flat(g, visor & (Z < 1.5) & (Y < cy + 5), "orange", 4)
    # a teal status strip on the back
    P.flat(g, m & (Z > cz + 6.2) & (Y > 6) & (Y < 8) & (np.abs(X - c) < 2.5), "cyan", 6)
    return g


def leg() -> Grid:
    """A bent leg in the (y, z) plane: hip at the top, foot pad at +z."""
    g = Grid(3, 14, 14)
    bar(g, "x", (12.5, 1.0), (7.0, 9.0), 2.4, 0, 3, "steel", 5)
    bar(g, "x", (7.0, 9.0), (1.0, 11.5), 2.2, 0.5, 2.5, "steel", 4)
    X, Y, Z = coords(g)
    P.flat(g, (g.a > 0) & (np.hypot(Y - 7, Z - 9) < 1.5), "rust", 4)  # the knee
    pad = box(g, 0, 0, 9, 3, 2, 14, "orange", 5)
    P.flat(g, pad & (Y < 1), "orange", 3)
    return g


def antenna(h: int) -> Grid:
    g = Grid(3, h + 2, 3)
    box(g, 1, 0, 1, 2, h, 2, "steel", 6)
    t = box(g, 0, h - 1, 0, 3, h + 2, 3, "cyan", 6)
    P.flat(g, t & (coords(g)[1] > h + 1), "cyan", 7)
    return g


def scoop() -> Grid:
    g = Grid(4, 4, 12)
    arm = box(g, 1, 1, 3, 3, 3, 12, "steel", 5)
    cup = box(g, 0, 0, 0, 4, 4, 4, "rust", 4)
    P.flat(g, cup & (coords(g)[1] > 3), "rust", 2)
    return g


def build() -> Asset:
    root = Part("probe", None)
    root.add(Part("body", body(), pivot=(B / 2, 0.0, B / 2 + 6), at=(0.0, float(YB), 0.0), rot=(0.0, -24.0, 4.0)))
    for k, ry in enumerate((60.0, 180.0, 300.0)):
        root.add(Part(f"leg-{k}", leg(), pivot=(1.5, 12.5, 0.0), at=(0.0, float(YB) + 4.0, 0.0), rot=(0.0, ry, 0.0)))
    root.add(Part("antenna-l", antenna(12), pivot=(1.5, 0.0, 1.5), at=(3.0, YB + 12.0, 2.0), rot=(-18.0, 0.0, 14.0)))
    root.add(Part("antenna-r", antenna(9), pivot=(1.5, 0.0, 1.5), at=(-3.0, YB + 12.0, 3.0), rot=(-26.0, 0.0, -20.0)))
    root.add(Part("scoop", scoop(), pivot=(2.0, 2.0, 12.0), at=(-3.0, YB + 4.0, -5.0), rot=(-35.0, 25.0, 0.0)))
    return Asset(id="space-props-sensor-probe", pack="space", category="props", name="Survey Probe", root=root,
                 # the two antennas twitch as the probe listens
                 clips=[Clip("idle", {"antenna-l": {"rot": sway(2.4, amp=(3.0, 0.0, 4.0), phase=(0.0, 0.0, 1.5))},
                                      "antenna-r": {"rot": sway(2.4, amp=(4.0, 0.0, 3.0), phase=(2.0, 0.0, 3.5), cycles=(1, 1, 2))}})])
