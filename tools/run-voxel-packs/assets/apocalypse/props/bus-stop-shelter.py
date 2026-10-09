"""Ruined bus stop shelter, in the Pirate Nation style.

One person-size icon (rule K3): four fat rust-steel posts on a cracked
concrete pad carry a sloped corrugated steel roof, rust-eaten (a true-slope prism, rule F2).
The back wall is three glass panes in a dark frame; the middle one is gone,
so the silhouette reads through, and the +x pane is smashed with painted
cracks. The oversized function prop (rules F4, K1) is a tilted red BUS
board bolted over the roof (rule F5), with a timetable case, a slatted
bench, a toppled bin and weeds at the feet. Glass, grime, a toxic-green
tag and the scrawled stops are paint (rule S1). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint as PP
import pnshapes as S
from _props import asset, child, root, tuft
from pnkit import box, edges
from voxgrid import Grid

GW, GH, GD = 46, 50, 28
PX1 = 44  # the pad across x
PAD = 3  # the top of the concrete pad
ZB0, ZB1 = 21, 24  # the back wall
POST = ((1, 3), (40, 3), (1, 21), (40, 21))  # (x0, z0) of the four posts
TOP = 32  # the roof underside at the front (z = 0)


def pane(g: Grid, x0: int, x1: int, y0: int, y1: int, z0: int, z1: int, cracked: bool, seed: int) -> np.ndarray:
    """A glass pane in a dark frame: a flat sky tone with two glint
    streaks, and painted cracks round a hole when `cracked`."""
    X, Y, Z = S.coords(g)
    frame = box(g, x0, y0, z0, x1, y1, z1, "steel", 3)
    P.flat(g, edges(frame), "steel", 2)
    glass = box(g, x0 + 2, y0 + 2, z0, x1 - 2, y1 - 2, z1, "sky", 2)
    for k, off in enumerate((0.0, 7.0)):  # two diagonal glints
        P.flat(g, glass & (np.abs((Y - y0) - 0.8 * (X - x0) - off - 4) < 1.2), "sky", 4)
    P.flat(g, glass & (Y < y0 + 4), "sky", 1)
    if cracked:
        cx, cy = (x0 + x1) / 2 + 2, (y0 + y1) / 2 + 3
        rr = np.hypot(X - cx, Y - cy)
        ang = np.arctan2(Y - cy, X - cx)
        P.flat(g, glass & (rr < 3.2), "steel", 1)
        P.flat(g, glass & (rr > 3.2) & (np.abs(((ang / (2 * np.pi) * 7) % 1) - 0.5) * rr < 0.45), "bone", 7)
    return frame | glass


def shelter() -> Grid:
    g = Grid(GW, GH, GD)
    X, Y, Z = S.coords(g)

    # ---- the concrete pad, cracked and stained
    pad = box(g, 0, 0, 2, PX1, PAD, 26, "sand", 5)
    PP.concrete(g, pad, "sand", 5, size=13, cracks=6, frame="top", seed=1)
    P.flat(g, pad & (Y < PAD - 1), "sand", 4)
    P.outline(g, pad, "sand", 3, normal="y")
    P.flat(g, pad & (Y > PAD - 1) & (np.hypot(X - 30, (Z - 8) * 1.3) < 5), "sand", 3)  # an oil stain

    # ---- four fat posts (rule F3), splayed a little at the feet
    posts = np.zeros(g.shape, dtype=bool)
    for px, pz in POST:
        posts |= box(g, px, PAD - 1, pz, px + 3, TOP + 4, pz + 3, "steel", 4)
        posts |= box(g, px - 1, PAD - 1, pz - 1, px + 4, PAD + 2, pz + 4, "steel", 3)  # the base plate
    P.plates(g, posts, "steel", 4, size=(3, 12), rivets=False, seed=2)
    P.flat(g, edges(posts), "steel", 2)
    PP.blotch(g, posts, "rust", 5, cell=5, chance=0.05, seed=3)

    # ---- the back wall: three panes, the middle one gone
    glazed = pane(g, 3, 17, PAD + 4, TOP + 2, ZB0, ZB1, False, 4)
    glazed |= pane(g, 29, 43, PAD + 4, TOP + 2, ZB0, ZB1, False, 5)
    box(g, 17, PAD + 4, ZB0, 29, PAD + 7, ZB1, "steel", 3)  # the sill of the gone pane
    for mx in (17, 27):  # the bare mullions of the gone pane
        box(g, mx, PAD + 4, ZB0, mx + 2, TOP + 2, ZB1, "steel", 3)
    glazed |= pane(g, 40, 44, PAD + 4, TOP + 2, 5, 19, True, 6)  # the smashed +x end pane
    P.flat(g, glazed & (Y < PAD + 7), "steel", 2)  # grime along the foot of the glass

    # ---- the roof: one sloped corrugated prism with a dark eave lip
    g.prism("x", [(TOP, 0), (TOP + 4, 0), (TOP + 7, GD), (TOP + 3, GD)], 0, PX1, S.C("steel", 5))
    roof = S.last(g)
    for m, fr in S.facets(g, [g.solids[-1]]):
        PP.corrugate(g, m, "steel", 5, period=3, sheet=11, length=44, frame=fr, seed=7)
    for bx, bz, br in ((7.0, 6.0, 7.0), (26.0, 21.0, 6.0), (39.0, 11.0, 5.0)):  # rust eating the sheet
        bl = roof & (np.hypot(X - bx, (Z - bz) * 0.9) < br)
        P.flat(g, bl, "rust", 5)
        P.flat(g, bl & (np.hypot(X - bx, (Z - bz) * 0.9) < br * 0.55), "rust", 4)
    PP.blotch(g, roof, "rust", 6, cell=4, chance=0.1, seed=17)
    P.flat(g, roof & ((X < 1) | (X > PX1 - 1)), "steel", 3)
    P.flat(g, roof & ((Z < 1) | (Z > GD - 1)), "darkwood", 4)  # the barge lip
    for dx, dz, dr in ((11.0, 9.0, 4.5), (33.0, 19.0, 3.6)):  # two rust-eaten dents
        dent = roof & (Y > TOP + 2) & (np.hypot(X - dx, (Z - dz) * 0.8) < dr)
        P.flat(g, dent, "steel", 3)
        P.flat(g, dent & (np.hypot(X - dx, (Z - dz) * 0.8) < dr * 0.5), "darkwood", 3)

    # ---- the bench: slats on two steel brackets
    for bx in (7, 33):
        box(g, bx, PAD, ZB0 - 5, bx + 3, PAD + 11, ZB0, "steel", 4)
    bench = box(g, 5, PAD + 10, ZB0 - 7, 39, PAD + 13, ZB0, "wood", 5)
    P.planks(g, bench, "wood", 5, width=3, across="z", nails=True, frame="top", seed=9)
    P.flat(g, edges(bench), "darkwood", 3)
    back = box(g, 5, PAD + 13, ZB0 - 2, 39, PAD + 20, ZB0, "wood", 4)
    P.planks(g, back, "wood", 4, width=3, across="y", nails=True, seed=10)
    P.flat(g, edges(back), "darkwood", 3)

    # ---- the timetable case on the -x pane, and a toxic tag on the glass
    case = box(g, 4, PAD + 16, ZB0 - 1, 16, TOP, ZB0 + 1, "steel", 4)
    P.flat(g, edges(case), "steel", 2)
    sheet = box(g, 6, PAD + 18, ZB0 - 2, 14, TOP - 2, ZB0 - 1, "bone", 7)
    P.flat(g, sheet & (np.floor(Y) % 3 == 0), "bone", 5)
    pnglyph.text(g, "-z", ZB0 - 2, 7, TOP - 9, "BUS", "red", 4)
    tag = glazed & (Z < ZB0 + 1) & (X > 30) & (X < 42) & (np.abs((Y - 20) - 3.0 * np.sin((X - 30) * 0.55)) < 1.2)
    P.flat(g, tag, "toxic", 6)

    # ---- small props at the feet: a toppled bin and weeds
    S.drum(g, 24, 6, PAD, 13, 4.5, ramp="khaki", base=4, band=("darkwood", 4), wear=True, seed=11)
    box(g, 20, PAD, 4, 24, PAD + 3, 8, "steel", 3)
    for k, (tx, tz) in enumerate(((2, 6), (42, 24), (6, 25), (34, 4))):
        tuft(g, tx, tz, PAD, "khaki", seed=k)
    return g


def board() -> Grid:
    """The oversized BUS board: a red slab with a bone rim and a stop list."""
    g = Grid(26, 10, 4)
    X, Y, Z = S.coords(g)
    m = box(g, 0, 0, 0, 26, 9, 3, "red", 4)
    P.mottle(g, m, "red", 4, cell=3, seed=12)
    P.flat(g, edges(m), "darkwood", 3)
    P.flat(g, m & ((Y < 1) | (Y > 8)), "darkwood", 3)
    pnglyph.text(g, "-z", 0, 4, 1, "BUS", "bone", 7, gap=2)
    pnglyph.text(g, "+z", 2, 4, 1, "BUS", "bone", 7, gap=2)
    return g


def build():
    g = shelter()
    r = root("bus-stop-shelter", g)
    child(r, "sign", board(), pivot=(13.0, 0.0, 1.5), at_grid=(21.0, float(TOP + 7), 11.0), rot=(0.0, 0.0, 7.0))
    return asset("bus-stop-shelter", "Ruined Bus Stop", r)
