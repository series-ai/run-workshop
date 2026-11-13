"""Apple cart in the Pirate Nation style.

A market handcart: a planked body with flared, iron-strapped sideboards
(true slopes) slung between two big spoked wheels, two long shafts that
rest on the ground at the front and a prop leg under the tail. The
oversized function prop is the fruit (rule F4): a heaped mound of apples
rises over the rail with seven big faceted apples standing proud on it, a
wicker basket of them leans on the near wheel, a crate of them stands at
the tail and two have rolled onto the ground. A painted apple and a chalk
price board hang on the sideboard (rule S1: detail is paint). About 39
long and 28 tall. Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import brace, coords, glyph, plank_box
from pnkit import box, edges
from voxgrid import C, Asset, Grid, Part

W, H, D = 38, 36, 42
CX = 19.0
WR = 8.0  # wheel flat radius
AY, AZ = 8.0, 24.0  # axle centre
BED0, RAIL = 12, 22  # bed floor and sideboard top
BZ0, BZ1 = 14, 32  # bed front and tail boards
HALF0, HALF1 = 8.5, 11.0  # body half width at the floor and at the rail


def _mask(g: Grid, start: int) -> np.ndarray:
    return np.logical_or.reduce([s.mask(g.shape) for s in g.solids[start:]])


def apple(g: Grid, cx: float, cy: float, cz: float, r: float = 2.4, ramp: str = "red", shade: int = 5, leaf: bool = True, ground: bool = False) -> np.ndarray:
    """A chunky apple: two octagonal frustums that round over to a narrow
    crown (true slopes), so it reads as an apple and not as a pumpkin. A
    lit cheek, a dark underside, a short stalk and a little leaf.
    `ground`: a dark contact band at the foot, so it beds on the ground."""
    start = len(g.solids)
    g.prism("y", S.flat_ngon(cx, cz, r * 0.60, 8), cy - r * 0.95, cy - r * 0.35, C(ramp, shade), top=S.flat_ngon(cx, cz, r, 8))
    g.prism("y", S.flat_ngon(cx, cz, r, 8), cy - r * 0.35, cy + r * 0.55, C(ramp, shade), top=S.flat_ngon(cx, cz, r * 0.66, 8))
    m = _mask(g, start)
    X, Y, Z = coords(g)
    P.flat(g, m & (Y > cy + r * 0.25), ramp, min(7, shade + 1))  # the lit shoulder
    P.flat(g, m & (Y < cy - r * 0.45), ramp, max(1, shade - 2))  # the shaded belly
    P.flat(g, m & (X < cx - r * 0.4) & (Z < cz - r * 0.15) & (Y > cy - r * 0.3) & (Y < cy + r * 0.5), ramp, min(7, shade + 2))
    P.flat(g, m & (Y > cy + r * 0.40), ramp, min(7, shade + 2))  # the lit crown
    P.flat(g, m & (Y > cy + r * 0.40) & (np.abs(X - cx) < 0.6) & (np.abs(Z - cz) < 0.6), ramp, max(1, shade - 1))  # the stalk well
    g.box(cx - 0.5, cy + r * 0.55, cz - 0.5, cx + 0.5, cy + r * 0.55 + 1, cz + 0.5, C("darkwood", 3))  # the stalk
    if leaf:
        g.box(cx + 0.5, cy + r * 0.55, cz - 0.5, cx + 2.0, cy + r * 0.55 + 1, cz + 0.5, C("leaf", 5))
    if ground:
        P.flat(g, m & (Y < cy - r * 0.75), ramp, max(1, shade - 3))  # the contact shadow on the ground
    return m


def gear(g: Grid) -> None:
    """Axle, bolsters, shafts, hand bar and the prop leg under the tail."""
    X, Y, Z = coords(g)
    ax = S.disc(g, "x", AY, AZ, 1.8, int(CX - 15), int(CX + 15), "darkwood", 3)
    P.flat(g, ax & (np.abs(np.abs(X - CX) - 12.5) < 1.2), "iron", 4)  # axle collars
    for s in (-1, 1):
        bo = box(g, CX + s * 10 - 3, AY + 1, AZ - 4, CX + s * 10 + 3, BED0, AZ + 4, "darkwood", 4)
        P.planks(g, bo, "darkwood", 4, width=2, across="y", nails=False, seed=3)
    for s in (-1, 1):  # two long shafts down to the ground (true slopes)
        sx = CX + s * 6.0
        brace(g, "x", (BED0 + 1, BZ0 + 1), (2.6, 5.0), 2.0, sx - 1.5, sx + 1.5, "wood", 5)
        g.box(sx - 2, 0, 3, sx + 2, 2, 9, C("darkwood", 3))
    hb = box(g, int(CX) - 8, 2, 4, int(CX) + 8, 5, 7, "darkwood", 3)  # the hand bar
    P.planks(g, hb, "darkwood", 3, width=3, across="y", nails=True, seed=4)
    P.flat(g, hb & (Y > 4), "darkwood", 5)
    leg = brace(g, "x", (BED0, BZ1 - 3), (0.8, BZ1 + 1.0), 2.0, CX - 1.5, CX + 1.5, "darkwood", 4)
    P.flat(g, leg & (Y < 2), "iron", 4)


def body(g: Grid) -> None:
    """The planked body: a flared box of boards with visible seams and nail
    dots, a dark darkwood frame (sill, corner stiles, capping rail), iron
    corner brackets with rivets and a deep red market panel between them."""
    X, Y, Z = coords(g)
    Zi, Yi = np.floor(Z).astype(int), np.floor(Y).astype(int)
    poly = [(CX - HALF0, BED0), (CX + HALF0, BED0), (CX + HALF1, RAIL), (CX - HALF1, RAIL)]
    g.prism("z", poly, BZ0, BZ1, C("wood", 5))
    side = S.last(g)
    for m, fr in S.facets(g, [g.solids[-1]]):
        P.planks(g, m, "wood", 5, width=3, across="y" if fr != "top" else "x", length=(9, 13), nails=True, frame=fr, seed=1)
    # the long flanks carry the paint; the head and tail boards stay dark wood
    ends = side & ((Z < BZ0 + 2.5) | (Z > BZ1 - 2.5))
    flank = side & ~ends
    # the sky-blue market panel on the boards, in a gold border (rules S4,
    # C3). It wraps all four boards, so the biggest face is never plain.
    # Blue keeps the body well away from the colour of the fruit.
    panel = side & (Y >= BED0 + 1) & (Y < RAIL - 2)
    P.flat(g, panel, "sky", 4)
    seam = (((Zi - BZ0) % 7) < 1) | (((np.floor(X).astype(int) - int(CX)) % 7) == 3)
    P.flat(g, panel & seam, "sky", 3)  # the plank seams under the paint
    P.flat(g, panel & (Y >= RAIL - 3), "gold", 4)  # the gold band that tops the panel
    P.flat(g, panel & (Y >= RAIL - 3) & (Y < RAIL - 2.5), "gold", 6)
    # the dark frame: a sill at the foot, corner stiles, a capping rail
    P.flat(g, side & (Y < BED0 + 1), "darkwood", 3)  # the sill
    P.flat(g, ends & (Y >= BED0 + 1) & (Y < RAIL - 2) & (np.abs(X - CX) < 1.5), "darkwood", 3)  # the tailgate stile
    P.flat(g, side & (Y >= RAIL - 2) & (Y < RAIL - 1), "darkwood", 3)  # under the cap
    P.flat(g, side & (Y >= RAIL - 1), "gold", 5)  # the gold capping
    # iron corner brackets with rivet glints (the hardware the reviewers missed)
    out = np.abs(X - CX) > HALF0 - 2.5
    corner = side & out & (((Zi - BZ0) < 2) | ((Zi - BZ0) >= BZ1 - BZ0 - 2)) & \
        (((Y >= BED0 + 1) & (Y < BED0 + 3)) | ((Y >= RAIL - 5) & (Y < RAIL - 3)))
    P.flat(g, corner, "iron", 5)
    P.flat(g, corner & ((Yi % 2) == 0) & ((Zi % 2) == 0), "steel", 7)
    strap = side & (((Zi - BZ0 - 4) % 9) < 1) & (Y > BED0 + 1) & (Y < RAIL - 2)
    strap |= ends & (np.abs(np.abs(X - CX) - 6.5) < 0.6) & (Y > BED0 + 1) & (Y < RAIL - 2)
    P.flat(g, strap, "iron", 5)
    P.flat(g, strap & ((Yi % 3) == 1), "steel", 7)  # rivet glints
    floor = side & (Y == RAIL - 1) & (np.abs(X - CX) < HALF1 - 1.5) & (Z > BZ0 + 1.5) & (Z < BZ1 - 1.5)
    P.planks(g, floor, "wood", 6, width=3, across="x", length=(22, 26), frame="top", seed=2)
    # the painted apple and the chalk price board on the sideboards
    for face, plane in (("-x", CX - HALF1 + 0.5), ("+x", CX + HALF1 - 1.5)):
        glyph(g, face, plane, BZ0 + 6, BED0 + 4, "fleur", "gold", 6, reach=3)
    sl = box(g, int(CX - HALF1) - 1, BED0 + 3, BZ0 + 12, int(CX - HALF1) + 1, BED0 + 9, BZ0 + 18, "darkwood", 2)
    P.flat(g, edges(sl), "darkwood", 4)
    pnglyph.text(g, "-x", CX - HALF1 - 0.5, BZ0 + 14, BED0 + 5, "3", "bone", 7, reach=3)


def heap(g: Grid) -> None:
    """The load: a low solid core painted as the shadow between the fruit,
    covered by twelve chunky apples that overlap one another, so every
    apple in the heap reads as its own volume (rules F1, F6)."""
    X, Y, Z = coords(g)
    start = len(g.solids)
    lo = [(CX - HALF1 + 1.5, BZ0 + 2), (CX + HALF1 - 1.5, BZ0 + 2), (CX + HALF1 - 1.5, BZ1 - 2), (CX - HALF1 + 1.5, BZ1 - 2)]
    mid = [(CX - HALF1 + 0.5, BZ0 + 1), (CX + HALF1 - 0.5, BZ0 + 1), (CX + HALF1 - 0.5, BZ1 - 1), (CX - HALF1 + 0.5, BZ1 - 1)]
    hi = [(CX - 4.5, BZ0 + 5), (CX + 5.0, BZ0 + 5), (CX + 4.5, BZ1 - 5), (CX - 5.0, BZ1 - 5)]
    g.prism("y", lo, RAIL - 2, RAIL + 0.5, C("red", 1), top=mid)
    g.prism("y", mid, RAIL + 0.5, RAIL + 2.5, C("red", 1), top=hi)
    m = _mask(g, start)
    # a calm two-tone fill, not a checker: a deep red bed that lifts a
    # little at the crown, so the gaps between the apples read as shadow
    P.flat(g, m, "darkwood", 1)  # the shadow the fruit sits in
    P.flat(g, m & (Y > RAIL + 1.0), "red", 1)  # deep red where the fruit packs together
    # the apples themselves: three rows that overlap, biggest at the crown
    for cx, cz, cy, r, ramp, shade, lf in (
            (CX - 7.4, BZ0 + 3.2, RAIL + 1.9, 2.6, "red", 5, False), (CX - 1.0, BZ0 + 2.4, RAIL + 2.1, 2.5, "red", 6, True),
            (CX + 5.6, BZ0 + 3.0, RAIL + 1.9, 2.6, "leaf", 5, False), (CX + 8.0, BZ0 + 8.0, RAIL + 2.1, 2.4, "red", 5, False),
            (CX - 8.2, BZ0 + 9.0, RAIL + 2.1, 2.5, "red", 6, False), (CX + 7.2, BZ0 + 13.8, RAIL + 1.9, 2.5, "red", 5, True),
            (CX - 7.0, BZ0 + 14.8, RAIL + 1.9, 2.6, "leaf", 5, False), (CX + 0.4, BZ0 + 16.2, RAIL + 2.1, 2.5, "red", 5, False),
            (CX - 3.6, BZ0 + 7.4, RAIL + 4.6, 2.8, "red", 6, True), (CX + 2.6, BZ0 + 6.6, RAIL + 4.8, 2.7, "red", 5, False),
            (CX + 3.0, BZ0 + 12.0, RAIL + 4.6, 2.8, "leaf", 5, True), (CX - 3.0, BZ0 + 12.4, RAIL + 4.8, 2.7, "red", 6, False),
            (CX - 0.2, BZ0 + 9.4, RAIL + 6.9, 2.6, "red", 5, True)):
        apple(g, cx, cy, cz, r, ramp, shade, leaf=lf)


def props_at_foot(g: Grid) -> None:
    """A wicker basket on the near wheel, a crate of apples at the tail and
    two apples on the ground (rule K1)."""
    X, Y, Z = coords(g)
    Xi, Yi, Zi = np.floor(X).astype(int), np.floor(Y).astype(int), np.floor(Z).astype(int)
    bx, bz = CX - 13.5, 12.0
    start = len(g.solids)
    g.prism("y", S.flat_ngon(bx, bz, 3.4, 8), 0, 8, C("sand", 5), top=S.flat_ngon(bx, bz, 4.4, 8))
    wick = _mask(g, start)
    P._paint(g, wick, "sand", 5 - (Yi % 3 == 0).astype(np.int64) + ((Zi + Xi + Yi // 3) % 3 == 0).astype(np.int64))
    P.flat(g, wick & (Y < 1), "sand", 3)
    P.flat(g, wick & (Y > 6.6), "darkwood", 4)  # the dark rim
    for ax, az, r, ramp in ((bx - 1.4, bz - 1.4, 2.0, "red"), (bx + 1.6, bz + 0.6, 2.1, "red"), (bx - 0.6, bz + 2.4, 1.9, "leaf")):
        apple(g, ax, 9.2, az, r, ramp, 6, leaf=(ramp == "red"))
    g.prism("z", [(bx - 4.4, 2), (bx + 4.4, 2), (bx + 4.4, 5), (bx - 4.4, 5)], bz - 0.6, bz + 0.6, C("darkwood", 4))
    # a crate of apples at the tail
    cx0, cz0, s = int(CX) - 5, BZ1 + 1, 9
    cr = plank_box(g, cx0, 0, cz0, cx0 + s, 2, cz0 + s, "wood", 4, across="y", width=3, seed=5)
    for x0, z0, x1, z1 in ((cx0, cz0, cx0 + s, cz0 + 2), (cx0, cz0 + s - 2, cx0 + s, cz0 + s), (cx0, cz0, cx0 + 2, cz0 + s), (cx0 + s - 2, cz0, cx0 + s, cz0 + s)):
        cr |= plank_box(g, x0, 0, z0, x1, 9, z1, "wood", 5, across="y", width=3, seed=6)
    P.flat(g, edges(cr), "darkwood", 3)
    for ax, az, ramp in ((cx0 + 3.0, cz0 + 3.0, "red"), (cx0 + 6.0, cz0 + 4.0, "leaf"), (cx0 + 4.5, cz0 + 6.5, "red")):
        apple(g, ax, 4.2, az, 2.1, ramp, 6, leaf=False)
    apple(g, cx0 + 4.5, 8.0, cz0 + 4.5, 2.4, "red", 6, leaf=True)
    # two apples rolled onto the ground: each leans on a prop it touches and
    # carries a dark contact band, so neither reads as floating
    apple(g, cx0 - 2.6, 2.1, cz0 + 2.0, 2.2, "red", 6, leaf=False, ground=True)
    apple(g, bx + 5.0, 2.0, bz + 1.6, 2.1, "red", 6, leaf=True, ground=True)


def build() -> Asset:
    g = Grid(W, H, D)
    gear(g)
    body(g)
    heap(g)
    props_at_foot(g)
    for s in (-1, 1):  # the two big spoked wheels, their rims standing on y = 0
        x0 = CX + s * 11.0 + (0 if s > 0 else -3)
        # a thin grey-blue iron tyre on a warm wood felloe, twelve sides so
        # the rim steps are small, and a big gold hub on a visible axle stub
        S.wheel(g, "x", AZ, 0, WR, int(x0), int(x0) + 3, n=12, spokes=8, gaps=True, tyre=("steel", 3), rim=("wood", 5),
                spoke=("wood", 6), hub=("gold", 5), rim_w=1.6, hub_r=2.4, hub_out=1.5)
        xa = int(x0) + (3 if s > 0 else -1)  # the axle stub and its iron cap
        S.disc(g, "x", AY, AZ, 1.5, xa, xa + 1, "darkwood", 3)
        S.disc(g, "x", AY, AZ, 1.1, xa + (1 if s > 0 else -1), xa + (2 if s > 0 else 0), "iron", 5)
    return Asset(id="fantasy-props-apple-cart", pack="fantasy", category="props", name="Apple Cart", root=Part("apple-cart", g))
