"""Asteroid mining rig, in the Pirate Nation mecha style.

The function prop is an oversized hazard-orange derrick (rule F4): an
A-frame lattice tower whose legs and braces are true diagonals, topped by
a copper crown block with a big sheave gear and a beacon. Inside it the
drill string (a striped kelly on a copper rotary-table gear) spins and
bobs on `idle`. It stands on a plated drill deck over a faceted asteroid
rock with glowing crystal ore. A crew cabin with a steep steel gable roof
sits at the front left; an ore hopper on legs fed by an inclined conveyor
at the front right. Detail is painted. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import beacon, big_gear, blast_door, coords, corner_posts, facet_paint, fuel_drum, hull_box, plates_on, sign, steel_box, steel_roof, window
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part, turn

W, H, D = 70, 136, 66
DK = 14  # deck top
DX, DZ = 36, 41  # drill axis
FZ0, FZ1 = 30, 52  # derrick front and back frames (z)
TOPY = 104


def body() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    # the asteroid rock: a faceted, lopsided frustum
    n0 = len(g.solids)
    g.prism("y", [(4, 0), (58, 0), (70, 12), (70, 54), (60, 66), (8, 66), (0, 52), (0, 10)], 0, 10, C("gray", 4),
            top=[(9, 5), (56, 4), (65, 14), (66, 52), (57, 62), (11, 61), (4, 50), (4, 13)])
    facet_paint(g, g.solids[n0:], plates_on("steel", 4, size=(10, 7), seed=1))
    rock = S.last(g)
    P.flat(g, rock & (Y < 2.5), "iron", 3)
    P.flat(g, rock & (Y > 2) & (Y < 4) & ((np.floor(X + Z) // 3) % 2 == 0), "orange", 5)
    crystals(g)
    deck(g)
    derrick(g)
    cabin(g)
    hopper(g)
    return g


def crystals(g: Grid) -> None:
    """Oversized glowing ore crystals (rule F4): faceted shards, lit on one side."""
    X, Y, Z = coords(g)
    for (cx, cz, h, ang, ramp, w) in ((37, 4, 24, 10, "cyan", 3.5), (43, 5, 16, -22, "cyan", 3), (31, 5, 14, 28, "teal", 2.5),
                                     (6, 56, 22, 16, "teal", 3.5), (4, 46, 14, -8, "cyan", 2.5), (63, 42, 18, -18, "cyan", 3)):
        pts = S.rotate([(cx - w, 3), (cx + w, 3), (cx + w, 3 + h * 0.72), (cx, 3 + h), (cx - w, 3 + h * 0.72)], cx, 3, ang)
        pts = [(min(W - 0.5, max(0.5, u)), max(0.0, v)) for u, v in pts]
        g.prism("z", pts, cz - w, cz + w, C(ramp, 5))
        m = S.last(g)
        P.flat(g, m & (X < cx), ramp, 6)
        P.flat(g, m & (Y > 3 + h * 0.62), ramp, 7)
        P.flat(g, m & (np.abs(X - cx) < 0.6), ramp, 4)


def deck(g: Grid) -> None:
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    g.prism("y", [(8, 8), (62, 8), (62, 60), (8, 60)], 9, DK, C("steel", 4), top=[(10, 10), (60, 10), (60, 58), (10, 58)])
    facet_paint(g, g.solids[n0:], plates_on("steel", 5, size=(11, 11), rivets=True, seed=2))
    d = S.last(g)
    top = d & (Y > DK - 1)
    P.flat(g, top & ((X < 12) | (X > 58) | (Z < 12) | (Z > 56)) & ((np.floor(X + Z) // 3) % 2 == 0), "orange", 5)
    P.flat(g, top & (np.hypot(X - DX, Z - DZ) < 7), "steel", 3)  # the well
    fuel_drum(g, 56, 48, DK, h=12, r=4.5)
    fuel_drum(g, 56, 38, DK, h=10, r=4, ramp="steel")


def derrick(g: Grid) -> None:
    X, Y, Z = coords(g)
    lx0, lx1, tx0, tx1 = 14, 58, 29, 43  # leg feet and heads (x)
    for z0 in (FZ0, FZ1):
        # Heavy steel legs with broad orange faces and dark ends.
        for foot, head in ((lx0 + 2, tx0 + 2), (lx1 - 2, tx1 - 2)):
            leg = S.bar(g, "z", (foot, DK), (head, TOPY), 6.5, z0, z0 + 5, "steel", 4)
            P.flat(g, leg & (Y > DK + 2) & (Y < TOPY - 2), "orange", 5)
            P.flat(g, leg & ((Y < DK + 2) | (Y > TOPY - 2)), "iron", 3)
            center_distance = np.abs((head - foot) * (Y - DK) - (TOPY - DK) * (X - foot)) / np.hypot(head - foot, TOPY - DK)
            P.flat(g, leg & (center_distance > 2.0), "iron", 3)
        # Four regular X bays. Each brace meets the leg at a beam node.
        ys = [DK + 3, 44, 70, 96, TOPY - 2]
        for ya, yb in zip(ys, ys[1:]):
            fa = (ya - DK) / (TOPY - DK)
            fb = (yb - DK) / (TOPY - DK)
            la, ra = lx0 + 4 + (tx0 - lx0) * fa, lx1 - 4 - (lx1 - tx1) * fa
            lb, rb = lx0 + 4 + (tx0 - lx0) * fb, lx1 - 4 - (lx1 - tx1) * fb
            for p0, p1 in (((la, ya), (rb, yb)), ((ra, ya), (lb, yb))):
                brace = S.bar(g, "z", p0, p1, 4.5, z0, z0 + 5, "steel", 4)
                P.flat(g, brace & (Y > ya + 2) & (Y < yb - 2), "orange", 5)
                x0, y0 = p0
                x1, y1 = p1
                brace_edge = np.abs((x1 - x0) * (Y - y0) - (y1 - y0) * (X - x0)) / np.hypot(x1 - x0, y1 - y0)
                P.flat(g, brace & (brace_edge > 1.35), "iron", 3)
            for y, f in ((ya, fa), (yb, fb)):
                left = lx0 + 4 + (tx0 - lx0) * f
                right = lx1 - 4 - (lx1 - tx1) * f
                girder = box(g, left, y - 2, z0, right, y + 2, z0 + 5, "steel", 4)
                P.flat(g, girder & (Y > y - 1) & (Y < y + 1), "orange", 4)
    # Side ties make the front and rear frames read as one derrick.
    for y in (44, 70, 96):
        f = (y - DK) / (TOPY - DK)
        for x in (lx0 + 2 + (tx0 - lx0) * f, lx1 - 2 - (lx1 - tx1) * f):
            box(g, x - 1, y - 1, FZ0 + 3, x + 2, y + 1, FZ1 + 2, "iron", 3)
            box(g, x, y, FZ0 + 3, x + 1, y + 1, FZ1 + 2, "orange", 4)
    # the crown block with a big sheave gear
    crown = steel_box(g, tx0 - 2, TOPY, FZ0 - 1, tx1 + 2, TOPY + 6, FZ1 + 5, seed=3)
    P.flat(g, crown & (Y < TOPY + 1.5), "orange", 5)
    big_gear(g, "-z", FZ0 - 1, DX, TOPY + 3, 8, teeth=9, thick=2)
    beacon(g, tx1, TOPY + 6, FZ1 + 2, h=5)
    # a copper line from the cabin up the derrick
    S.pipe(g, [(30, DK + 30, 22), (30, DK + 30, FZ0 - 2), (lx0 + 12, DK + 30, FZ0 - 2)], s=3, ramp="rust", base=4)


def cabin(g: Grid) -> None:
    cx0, cx1, cz0, cz1, cy1 = 7, 36, 6, 25, DK + 29
    hull_box(g, cx0, DK, cz0, cx1, cy1, cz1, seed=4)
    corner_posts(g, cx0, cx1, cz0, cz1, DK, cy1, size=3)
    steel_roof(g, cx0, cx1, cz0, cz1, cy1 + 1, cy1 + 16, ridge="z", overhang=3, seed=5)
    blast_door(g, "-z", cz0, 14, 28, DK, DK + 18, seed=6)
    sign(g, "-z", cz0, (cx0 + cx1) / 2, cy1 + 2, "ORE", pad=2)
    window(g, "-x", cx0, 14, 24, DK + 8, DK + 18)


def hopper(g: Grid) -> None:
    X, Y, Z = coords(g)
    hx0, hx1, hz0, hz1 = 44, 62, 10, 26
    for x, z in ((hx0 + 1, hz0 + 1), (hx1 - 3, hz0 + 1), (hx0 + 1, hz1 - 3), (hx1 - 3, hz1 - 3)):
        box(g, x, DK, z, x + 2, 36, z + 2, "steel", 3)
    n0 = len(g.solids)
    g.prism("y", [(hx0 + 5, hz0 + 5), (hx1 - 5, hz0 + 5), (hx1 - 5, hz1 - 5), (hx0 + 5, hz1 - 5)], 28, 42, C("orange", 5), top=[(hx0, hz0), (hx1, hz0), (hx1, hz1), (hx0, hz1)])
    facet_paint(g, g.solids[n0:], plates_on("orange", 5, size=(6, 5), seed=7))
    bin_ = steel_box(g, hx0, 42, hz0, hx1, 46, hz1, seed=8)
    # Three large cyan ore chunks make the hopper fill read at thumbnail size.
    for cx, cz, radius, height in ((50, 16, 4.5, 5), (56, 19, 3.5, 4), (58, 13, 3, 3)):
        chunk = S.cone(g, "y", cx, cz, radius, 45, 45 + height, "cyan", 6, n=6, r_top=1.5)
        P.flat(g, chunk & (Y > 45 + height - 1), "cyan", 7)
        P.flat(g, chunk & (X < cx - 1), "teal", 5)
    chute = box(g, (hx0 + hx1) / 2 - 2, 22, hz0 + 6, (hx0 + hx1) / 2 + 2, 28, hz0 + 10, "steel", 3)
    # the inclined conveyor from the derrick foot up to the bin
    belt = S.bar(g, "x", (DK + 2, FZ0 + 2), (46, hz1 - 1), 4, 50, 56, "orange", 5)
    P.flat(g, belt & ((np.floor(Y + Z) // 3) % 2 == 0), "orange", 3)
    P.flat(g, belt & (np.floor(Z) % 6 == 1) & (X > 51) & (X < 55), "cyan", 6)  # ore lumps
    box(g, 52, DK, 36, 54, 22, 38, "steel", 3)


def drill() -> Grid:
    """Drill string: a striped kelly on a copper rotary-table gear, a swivel
    and a hook block at the top."""
    c = 11
    g = Grid(22, 98, 22)
    X, Y, Z = coords(g)
    S.gear(g, "y", c, c, 7, 0, 3, teeth=10, depth=2.5, ramp="rust", base=4)
    kelly = box(g, c - 2, 3, c - 2, c + 2, 88, c + 2, "steel", 5)
    P.flat(g, kelly & ((np.floor(Y + X + Z) // 3) % 2 == 0), "orange", 5)
    sw = box(g, c - 4, 88, c - 4, c + 4, 96, c + 4, "orange", 5)
    P.flat(g, edges(sw), "orange", 3)
    P.flat(g, sw & (Y > 91) & (Y < 93), "steel", 3)
    box(g, c - 1, 96, c - 1, c + 1, 98, c + 1, "steel", 3)
    return g


def build() -> Asset:
    g = body()
    root = Part("mining-rig", g)
    root.add(Part("drill", drill(), pivot=(11.0, 0.0, 11.0), at=(DX, DK, DZ)))
    bobk = [(0.0, (0.0, 0.0, 0.0)), (0.5, (0.0, -2.0, 0.0)), (1.0, (0.0, 0.0, 0.0))]
    return Asset(
        id="space-buildings-mining-rig", pack="space", category="buildings", name="Asteroid Mining Rig", root=root,
        clips=[Clip("idle", {"drill": {"rot": turn(1.0, "y", 360.0), "loc": bobk}})],
    )
