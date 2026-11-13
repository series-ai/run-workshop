"""Stable hitching post in the Pirate Nation style.

Two heavy timber posts on grey-blue footing stones carry a sagging top rail
and a lower rail (true slopes, rule F5). The left post is crowned by an
oversized carved horse head — the one iconic feature (rules F4 and K3) —
with a dark mane, a gold brow band and a painted eye. Two chunky iron tie
rings hang on the rail and the post; a hemp rope runs from the first ring
to a coil on the ground, a royal-blue saddle blanket with gold trim is
folded over the rail, and a feed bucket, hay and grass dress the base.
Detail is paint (rule S1). About 38 long and 33 tall.
"""

import numpy as np

import paint as P
import pnglyph
from _props import coords, stone_box, tufts
from pnkit import box, edges
from pnshapes import bar, cone, flat_ngon, last
from voxgrid import C, Asset, Grid, Part

W, H, D = 38, 34, 16
PZ0, PZ1 = 6, 10          # the post plane
LX, RX = 4, 26            # the post corners (4 wide)
LTOP, RTOP = 24, 21       # the post tops
RAIL = ((3.0, 17.6), (32.0, 16.2))   # the sagging top rail
HORSESHOE = [
    ".###.",
    "#-.-#",
    "#...#",
    "#...#",
    "#...#",
    "#...#",
]


def ring(g: Grid, cx: float, cy: float, r: float, z0: float, z1: float, thick: float = 1.8, n: int = 8) -> np.ndarray:
    """A chunky iron tie ring in the x-y plane: `n` true-slope bars around an
    n-gon, lit on the top arc and dark underneath."""
    pts = flat_ngon(cx, cy, r, n)
    m = np.zeros(g.shape, dtype=bool)
    for p0, p1 in zip(pts, pts[1:] + pts[:1]):
        m |= bar(g, "z", p0, p1, thick, z0, z1, "iron", 4)
    _, Y, Z = coords(g)
    P.flat(g, m, "iron", 4)
    P.flat(g, m & (Y > cy + r * 0.45), "iron", 6)
    P.flat(g, m & (Y < cy - r * 0.45), "iron", 2)
    P.flat(g, m & (Z < z0 + 1.0), "iron", 5)
    return m


def timber_post(g: Grid, x0: int, y1: int, seed: int) -> np.ndarray:
    """A 4-thick planked post with a framed edge and two iron bands."""
    m = box(g, x0, 3, PZ0, x0 + 4, y1, PZ1, "wood", 5)
    P.planks(g, m, "wood", 5, width=2, across="x", nails=False, seed=seed)
    P.flat(g, edges(m), "darkwood", 3)
    _, Y, _ = coords(g)
    for by in (6, y1 - 6):
        band = m & (Y > by) & (Y < by + 2)
        P.flat(g, band, "iron", 4)
        P.flat(g, band & (Y > by + 1), "iron", 6)
    return m


def horse_head(g: Grid) -> None:
    """The carved horse head on the left post: a long muzzle, a brow bump
    and two ears, all true-slope prisms in the y-z plane (rule F2)."""
    X, Y, Z = coords(g)
    cx = LX + 2.0
    # the neck and skull as one profile, extruded 5 wide (it overhangs the post)
    g.prism("x", [(LTOP - 1, 5.2), (LTOP + 0.2, 2.4), (LTOP + 1.6, 0.6), (LTOP + 4.2, 1.0),
                  (LTOP + 5.8, 3.4), (LTOP + 7.2, 6.6), (LTOP + 6.0, 9.8), (LTOP + 3.0, 11.2),
                  (LTOP - 1, 10.6)], cx - 2.5, cx + 2.5, C("wood", 4))
    head = last(g)
    P.flat(g, head, "wood", 4)
    P.flat(g, head & (Y > LTOP + 5.4), "wood", 5)                 # the lit crown
    P.flat(g, head & (Y < LTOP + 1.0), "wood", 3)                 # the shaded jaw
    P.flat(g, head & (Z < 3.0), "wood", 5)                        # the lit muzzle front
    P.flat(g, edges(head), "darkwood", 3)
    # the mane: a dark painted band down the back of the neck and skull
    mane = head & (Z > 8.4)
    P.flat(g, mane, "darkwood", 4)
    P.flat(g, mane & (np.floor(Y).astype(int) % 3 == 0), "darkwood", 3)
    P.flat(g, head & (Z > 7.2) & (Y > LTOP + 5.0), "darkwood", 4)
    # two ears, turned a little apart (rule F5)
    for sx, lean in ((-1.6, -0.9), (1.6, 0.6)):
        g.prism("x", [(LTOP + 6.8, 5.8), (LTOP + 9.2, 6.4 + lean), (LTOP + 7.2, 8.0)],
                cx + sx - 1.0, cx + sx + 1.0, C("wood", 5))
        ear = last(g)
        P.flat(g, ear, "wood", 5)
        P.flat(g, ear & (Y > LTOP + 7.8), "wood", 6)
        P.outline(g, ear, "darkwood", 3, normal="x")
    # a gold brow band across the skull (accent, rule C3)
    brow = head & (np.floor(Y).astype(int) == LTOP + 5) & (Z > 3.2) & (Z < 7.8)
    P.flat(g, brow, "gold", 5)
    P.flat(g, brow & (Z < 5.4), "gold", 6)
    # the eye and the nostril, painted on both cheeks and the muzzle front
    for px in (cx - 2.5, cx + 1.5):
        eye = head & (np.floor(X) == np.floor(px)) & (np.abs(Y - (LTOP + 3.4)) < 1.0) & (np.abs(Z - 5.6) < 1.0)
        P.flat(g, eye, "darkwood", 1)
        P.flat(g, eye & (Y > LTOP + 3.4) & (Z < 5.6), "bone", 7)
    nose = head & (Z < 2.6) & (np.abs(Y - (LTOP + 2.4)) < 0.9) & (np.abs(X - cx) < 1.6)
    P.flat(g, nose, "darkwood", 2)


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # footing stones under both posts
    for fx in (LX - 2, RX - 2):
        pad = stone_box(g, fx, 0, PZ0 - 2, fx + 8, 3, PZ1 + 2, "stone", 4, block=(5, 3), rim=-2, seed=fx)
        P.flat(g, pad & (Yi == 2), "stone", 5)
    box(g, LX + 7, 0, PZ0 - 3, LX + 11, 2, PZ0, "stone", 3)   # a loose kerb stone (rule F5)

    left = timber_post(g, LX, LTOP, 2)
    timber_post(g, RX, RTOP, 7)
    # a chamfered cap on the right post
    g.prism("z", [(RX - 1, RTOP), (RX + 5, RTOP), (RX + 3.4, RTOP + 3.0), (RX + 0.6, RTOP + 3.0)],
            PZ0 - 1, PZ1 + 1, C("wood", 6))
    cap = last(g)
    P.flat(g, cap, "wood", 6)
    P.outline(g, cap, "darkwood", 3, normal="z")

    # the two rails: the top one sags to the right, the lower one is straighter
    top_rail = bar(g, "z", RAIL[0], RAIL[1], 3.2, PZ0 + 0.5, PZ1 - 0.5, "wood", 6)
    P.planks(g, top_rail, "wood", 6, width=4, across="y", nails=True, frame="wall", seed=3)
    rail_top = RAIL[0][1] + 1.6 + (RAIL[1][1] - RAIL[0][1]) * (X - RAIL[0][0]) / (RAIL[1][0] - RAIL[0][0])
    P.flat(g, top_rail & (Y > rail_top - 1.2), "wood", 6)
    P.flat(g, edges(top_rail), "darkwood", 3)
    low_rail = bar(g, "z", (4.0, 8.4), (31.0, 7.8), 2.6, PZ0 + 0.8, PZ1 - 0.8, "wood", 5)
    P.planks(g, low_rail, "wood", 5, width=3, across="y", nails=True, frame="wall", seed=4)
    P.flat(g, edges(low_rail), "darkwood", 3)
    # iron straps where the rails cross the posts
    for px in (LX, RX):
        for lo, hi in ((15, 20), (6, 11)):
            P.flat(g, (g.a > 0) & (Xi >= px) & (Xi < px + 4) & (Yi >= lo) & (Yi < hi)
                   & (Zi >= PZ0 - 1) & (Zi < PZ0 + 1), "iron", 4)

    horse_head(g)

    # a tie ring on the rail and a second one on the right post
    ring(g, 12.0, 12.6, 3.4, PZ0 - 1.0, PZ0 + 1.0)
    ring(g, 28.0, 12.4, 2.6, PZ0 - 1.0, PZ0 + 0.6, thick=1.6, n=6)
    # a khaki rope from the first ring to a coil on the ground
    rope = np.zeros(g.shape, dtype=bool)
    for p0, p1 in (((12.0, 9.4), (9.6, 5.4)), ((9.6, 5.4), (14.4, 1.6)), ((14.4, 1.6), (18.0, 1.0))):
        rope |= bar(g, "z", p0, p1, 1.6, PZ0 - 0.8, PZ0 + 0.6, "khaki", 4)
    P.flat(g, rope, "khaki", 4)
    P.flat(g, rope & ((Xi + Yi) % 3 == 0), "khaki", 5)
    P.flat(g, rope & ((Xi + Yi) % 3 == 1), "khaki", 3)
    coil = np.zeros(g.shape, dtype=bool)
    for p0, p1 in zip(flat_ngon(19.5, PZ0 - 1.0, 3.0, 6), flat_ngon(19.5, PZ0 - 1.0, 3.0, 6)[1:] + flat_ngon(19.5, PZ0 - 1.0, 3.0, 6)[:1]):
        coil |= bar(g, "y", p0, p1, 1.8, 0, 2, "khaki", 4)
    P.flat(g, coil, "khaki", 4)
    P.flat(g, coil & (Yi == 1), "khaki", 5)
    P.flat(g, coil & ((Xi + Zi) % 3 == 0), "khaki", 3)

    # a royal-blue saddle blanket folded over the rail (accent, rule C1)
    bl = bar(g, "z", (16.0, 19.8), (25.0, 19.3), 1.9, PZ0 - 1, PZ1 + 1, "blue", 3)
    bl |= box(g, 16, 11, PZ0 - 1, 25, 19, PZ0, "blue", 3)       # the long front fall
    bl |= box(g, 16, 13, PZ1, 25, 19, PZ1 + 1, "blue", 3)       # the shorter back fall
    P.flat(g, bl, "blue", 3)
    P.flat(g, bl & (Y > 20.0), "blue", 4)                       # the lit fold over the rail
    P.flat(g, bl & (Zi < PZ0), "blue", 3)
    P.flat(g, bl & (Zi >= PZ1), "blue", 2)
    P.flat(g, bl & (Xi % 4 == 0) & (Yi < 19), "blue", 2)        # painted folds
    P.flat(g, bl & (Xi % 4 == 1) & (Yi < 19), "blue", 4)
    # gold trim on the hems and the side edges only (a full outline would
    # paint the whole top face, which is one voxel row)
    P.flat(g, bl & (Yi == 11) & (Zi < PZ0), "gold", 5)
    P.flat(g, bl & (Yi == 13) & (Zi >= PZ1), "gold", 5)
    P.flat(g, bl & (Yi < 19) & ((Xi == 16) | (Xi == 24)), "gold", 5)
    pnglyph.stamp(g, "-z", PZ0 - 1, 19, 13, ["..#..", ".###.", "#.#.#", "#####", "..#.."],
                  {"#": C("gold", 6)}, 1, 2, 2)

    # a feed bucket with hay, and a horseshoe nailed to the right post
    bk = cone(g, "y", 34.0, PZ0 + 1.0, 2.8, 0, 7, "wood", 5, n=8, r_top=3.6)
    P.planks(g, bk, "wood", 5, width=2, across="x", nails=False, seed=8)
    P.flat(g, bk & (Yi >= 6), "darkwood", 2)
    for hy in (1, 5):
        P.flat(g, bk & (Yi == hy), "iron", 4)
    for hx, hz, hh in ((32, PZ0, 10), (35, PZ0 + 3, 9), (34, PZ0 - 1, 11)):
        hay = box(g, hx, 6, hz, hx + 2, hh, hz + 2, "gold", 6)
        P.flat(g, hay & (Yi >= hh - 1), "gold", 7)
    pnglyph.stamp(g, "-z", PZ0, RX + 1, 13, HORSESHOE, {"#": C("iron", 5), "-": C("iron", 2)}, 1, 2, 2)

    tufts(g, [(LX - 3, PZ1 + 2), (RX + 5, PZ0 - 4), (19, PZ1 + 3)],
          flowers=[("gold", 6), ("red", 5), ("sky", 6)])
    root = Part("hitching-post", g)
    return Asset(id="fantasy-props-hitching-post", pack="fantasy", category="props",
                 name="Hitching Post", root=root)
