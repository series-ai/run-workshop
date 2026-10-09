"""Town stone fountain in the Pirate Nation style.

One iconic shape (rule K3): an octagonal basin of grey-blue stone on a
stepped apron, its coursed wall battered out to a moulded rim (true
slopes), every course framed in a dark grey-blue mortar, full of sky-blue
water with a ripple ring, a glint and three thrown gold coins. A fluted
pedestal carries a flared upper bowl; four big gargoyle heads look out
from it over clear dark gaps and pour bright arcs of water into the basin
below, each arc landing in its own splash ring. The oversized function
prop is the gold finial orb on a slim stem above the bowl (rules F4, F6).
The warm side of the theme comes back as a rust-and-sand carved frieze,
gold rings and lip bands, and an oak water bucket and pail at the foot.
Moss creeps up the basin from the wet apron; two mossy stones and the
grass tufts are seated on the apron, well inside its edge. Detail is
paint (rule S1). About 35 wide and 39 tall. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _life import boulder, grass
from _props import coords
from pnkit import box, edges
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 38, 48, 38
CX, CZ = 19.0, 19.0
APRON = 15.0  # apron flat radius
R_OUT, R_TOP = 12.0, 13.0  # basin wall at the foot and under the rim
R_IN = 10.0  # water radius
WALL0, WALL1 = 2, 12  # basin wall y
RIM = (12, 15)  # the moulded rim
WATER = 12.5  # the water surface inside the basin
PED = 4.0  # pedestal flat radius
BOWL = 26  # upper bowl floor
SPOUT = 22.5  # the spout mouths

STONE, FIELD = "stone", 4  # the body of the stone
DARK = ("steel", 2)  # the theme's grey-blue, used for every mortar and frame


def _mask(g: Grid, start: int) -> np.ndarray:
    return np.logical_or.reduce([s.mask(g.shape) for s in g.solids[start:]])


def ring(g: Grid, r_out: float, r_in: float, y0: float, y1: float, ramp: str = STONE, shade: int = FIELD, n: int = 8):
    """An n-gon ring built from two C-shaped prisms (so the inside is open)."""
    outer = S.flat_ngon(CX, CZ, r_out, n)
    inner = S.flat_ngon(CX, CZ, r_in, n)
    start = len(g.solids)
    for half in (range(0, n // 2 + 1), range(n // 2, n + 1)):
        ks = [k % n for k in half]
        g.prism("y", [outer[k] for k in ks] + [inner[k] for k in reversed(ks)], y0, y1, C(ramp, shade))
    return _mask(g, start), g.solids[start:]


def fall_ribbon(r0: float, y0: float, r1: float, y1: float, thick: float = 1.8, steps: int = 5):
    """A thin falling ribbon of water as (radius, y) points: it leaves the
    mouth level, bends out and drops, so the stream reads as water and not
    as a masonry pillar. Returns one closed polygon (out, then back)."""
    outer, inner = [], []
    for i in range(steps + 1):
        t = i / steps
        r = r0 + (r1 - r0) * t
        y = y0 - (y0 - y1) * t * t
        outer.append((r + thick / 2, y))
        inner.append((r - thick / 2, y))
    return outer + inner[::-1]


def basin(g: Grid) -> None:
    X, Y, Z = coords(g)
    rr = np.hypot(X - CX, Z - CZ)
    # the stepped apron, paved on top, framed in dark grey-blue (rule S4)
    start = len(g.solids)
    g.prism("y", S.flat_ngon(CX, CZ, APRON, 8), 0, 2, C(STONE, FIELD), top=S.flat_ngon(CX, CZ, APRON - 0.8, 8))
    apron = _mask(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, STONE, FIELD, block=(5, 2) if fr != "top" else (5, 5), frame=fr, seed=1))
    U, V = P.uv(g, "top")
    P.flat(g, apron & (Y > 1), STONE, 3)  # the paving, a shade under the basin wall
    P.flat(g, apron & (Y > 1) & (((U % 6) == 0) | ((V % 6) == 0)), STONE, 2)  # its joints
    P.flat(g, apron & (Y < 1), *DARK)
    P.flat(g, apron & (Y > 1) & (rr > APRON - 1.6), *DARK)  # the dark lip of the step
    P.flat(g, apron & (Y > 1) & (rr > APRON - 4.0) & (rr < APRON - 1.6), "sand", 5)  # a warm paved ring
    # the battered basin wall: one solid frustum, hollowed above the floor
    start = len(g.solids)
    g.prism("y", S.flat_ngon(CX, CZ, R_OUT, 8), WALL0, WALL1, C(STONE, FIELD), top=S.flat_ngon(CX, CZ, R_TOP, 8))
    wall = _mask(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, STONE, FIELD, block=(6, 3), cracks=0.08, frame=fr, seed=2))
    for m, fr in S.facets(g, g.solids[start:]):  # a dark mortar line on every course (S2, S4)
        U, V = P.uv(g, fr)
        P.flat(g, m & ((V % 4) == 0), STONE, 2)
        P.flat(g, m & ((U % 7) == 0) & ((V % 4) != 0), STONE, 3)
    P.flat(g, wall & S.seams(g, g.solids[start:], 0.7), *DARK)  # the dark arris between facets
    # a carved frieze round the basin: a warm sand band with a rust wave run
    band = wall & (Y >= WALL1 - 5) & (Y < WALL1 - 1)
    aw = np.floor((np.arctan2(Z - CZ, X - CX) + math.pi) / (2 * math.pi) * 64).astype(np.int64)
    P.flat(g, band, "sand", 5)
    P.flat(g, band & (Y >= WALL1 - 2.2), "sand", 6)
    P.flat(g, wall & (Y >= WALL1 - 6) & (Y < WALL1 - 5), *DARK)  # the dark frame of the frieze
    P.flat(g, wall & (Y >= WALL1 - 1) & (Y < WALL1), *DARK)
    P.flat(g, band & (Y < WALL1 - 2.2) & ((aw % 6) < 3), "rust", 5)  # the wave run, in warm rust
    P.flat(g, band & (Y < WALL1 - 3.2) & ((aw % 6) >= 3), "rust", 5)
    g.carve(wall & (rr < R_IN) & (Y > WALL0))
    rim, rsolids = ring(g, R_TOP + 1.2, R_IN - 0.5, RIM[0], RIM[1])
    S.paint_facets(g, rsolids, lambda gg, mm, fr: P.stone(gg, mm, STONE, 5, block=(5, 3), frame=fr, seed=4))
    P.flat(g, rim & (Y > RIM[1] - 1), STONE, 6)  # the lit top of the moulding
    P.flat(g, rim & (Y >= RIM[1] - 2) & (Y < RIM[1] - 1) & (rr > R_TOP - 0.5), "gold", 4)  # a gold band round the rim
    P.flat(g, rim & (Y < RIM[0] + 1), *DARK)
    # the basin floor and the water standing on it
    g.prism("y", S.flat_ngon(CX, CZ, R_IN, 8), WALL0, WALL0 + 2, C(STONE, 2))
    P.stone(g, S.last(g), STONE, 2, block=(5, 5), frame="top", seed=9)
    g.prism("y", S.flat_ngon(CX, CZ, R_IN, 8), WALL0 + 2, int(WATER) + 1, C("sky", 4))
    water = S.last(g)
    P.flat(g, water & (Y > WATER - 1), "sky", 4)
    P.flat(g, water & (Y > WATER - 1) & (np.abs(rr - 8.0) < 0.9), "sky", 5)  # a ripple ring
    P.flat(g, water & (Y > WATER - 1) & (np.abs(rr - 5.0) < 0.7), "sky", 3)
    P.flat(g, water & (Y > WATER - 1) & (np.abs(X - CX + 5) < 1.2) & (np.abs(Z - CZ + 5) < 2.2), "sky", 7)  # a glint
    P.flat(g, water & (Y <= WATER - 1), "sky", 2)  # the dark water under the surface
    for coin in ((CX - 7.5, CZ + 4.0), (CX + 6.5, CZ + 6.5), (CX + 8.0, CZ - 3.0)):
        P.flat(g, water & (Y > WATER - 1) & (np.hypot(X - coin[0], Z - coin[1]) < 1.3), "gold", 5)
    # moss creeping up the wet stone from the apron
    ang = np.floor((np.arctan2(Z - CZ, X - CX) + math.pi) / (2 * math.pi) * 20).astype(np.int64)
    lift = (P._hash(ang, seed=5) % np.uint64(3)).astype(np.int64)
    P.flat(g, wall & (Y < WALL0 + 1.4 + lift), "moss", 4)
    P.flat(g, wall & (Y < WALL0 + 0.9 + lift * 0.5), "moss", 3)


def column(g: Grid) -> tuple[float, float, float]:
    """The fluted pedestal, four gargoyle heads with falling water, the
    flared upper bowl and the gold finial orb. Returns the water socket."""
    X, Y, Z = coords(g)
    rr = np.hypot(X - CX, Z - CZ)
    ang = np.arctan2(Z - CZ, X - CX)
    # the pedestal: a moulded foot and a fluted shaft (true slopes)
    start = len(g.solids)
    g.prism("y", S.flat_ngon(CX, CZ, PED + 2.4, 8), WALL0 + 1, WALL0 + 4, C(STONE, FIELD), top=S.flat_ngon(CX, CZ, PED, 8))
    g.prism("y", S.flat_ngon(CX, CZ, PED, 8), WALL0 + 4, SPOUT - 3, C(STONE, 5), top=S.flat_ngon(CX, CZ, PED - 0.8, 8))
    shaft = _mask(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, STONE, 5, block=(4, 4), frame=fr, seed=6))
    flute = (np.floor((ang + math.pi) / (2 * math.pi) * 16).astype(np.int64) % 2) == 0
    P.flat(g, shaft & flute & (Y > WALL0 + 4) & (Y < SPOUT - 3), *DARK)  # the dark flutes
    P.flat(g, shaft & (Y < WALL0 + 2), *DARK)
    P.flat(g, shaft & S.seams(g, g.solids[start:], 0.6), *DARK)
    # the capital the heads grow out of, with a gold astragal
    start = len(g.solids)
    g.prism("y", S.flat_ngon(CX, CZ, PED - 0.8, 8), SPOUT - 3, SPOUT - 1, C(STONE, FIELD), top=S.flat_ngon(CX, CZ, PED + 2.2, 8))
    g.prism("y", S.flat_ngon(CX, CZ, PED + 2.2, 8), SPOUT - 1, SPOUT + 3, C(STONE, FIELD))
    cap = _mask(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, STONE, FIELD, block=(5, 3), frame=fr, seed=7))
    P.flat(g, cap & (Y > SPOUT + 1.6), STONE, 5)
    P.flat(g, cap & (np.abs(Y - SPOUT - 2.6) < 0.7), "gold", 5)
    P.flat(g, cap & (Y < SPOUT - 2.4), *DARK)
    # four gargoyle heads: a chunky muzzle (true slopes) inside a dark
    # outline, a gold lip ring, a dark open mouth and gold eyes, each over
    # a falling jet. The dark outline keeps every head apart (finding B2).
    for dx, dz in ((0, -1), (0, 1), (-1, 0), (1, 0)):
        axis = "x" if dx else "z"
        lo = CX + dx * (PED + 1.0) if dx else CZ + dz * (PED + 1.0)
        hi = CX + dx * (PED + 3.8) if dx else CZ + dz * (PED + 3.8)
        a, b = (min(lo, hi), max(lo, hi))
        cu, cv = (SPOUT + 0.5, CZ) if dx else (CX, SPOUT + 0.5)
        wide = S.flat_ngon(cu, cv, 3.2, 4, 0.0 if dx else -math.pi / 2)
        thin = S.flat_ngon(cu, cv, 2.4, 4, 0.0 if dx else -math.pi / 2)
        start = len(g.solids)
        g.prism(axis, wide if (dx > 0 or dz > 0) else thin, a, b, C(STONE, 5), top=thin if (dx > 0 or dz > 0) else wide)
        snout = S.last(g)
        S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, STONE, 5, block=(4, 3), frame=fr, seed=11))
        out = (np.abs(X - CX) > PED + 3.2) if dx else (np.abs(Z - CZ) > PED + 3.2)
        across = Z if dx else X
        ac = CZ if dx else CX
        P.flat(g, snout & (np.abs(across - ac) > 2.3), *DARK)  # a dark edge: a clear gap to the next head
        P.flat(g, snout & (Y > SPOUT + 2.1), *DARK)  # the dark top arris
        P.flat(g, snout & (Y < SPOUT - 1.7), *DARK)  # the dark under-jaw
        P.flat(g, snout & (np.abs(Y - SPOUT - 2.0) < 0.6) & (np.abs(across - ac) < 2.4), STONE, 2)  # the heavy brow
        P.flat(g, snout & out & (np.abs(across - ac) < 1.9) & (np.abs(Y - SPOUT - 0.1) < 1.7), "gold", 5)  # the gold lip ring
        P.flat(g, snout & out & (np.abs(across - ac) < 1.2) & (np.abs(Y - SPOUT - 0.1) < 1.0), STONE, 0)  # the open mouth
        near = ((np.abs(X - CX) < PED + 3.2) if dx else (np.abs(Z - CZ) < PED + 3.2))
        far_ = ((np.abs(X - CX) > PED + 2.2) if dx else (np.abs(Z - CZ) > PED + 2.2))
        eye = snout & near & far_ & (np.abs(Y - SPOUT - 1.1) < 0.7) & (np.abs(np.abs(across - ac) - 1.7) < 0.7)
        P.flat(g, eye, "gold", 6)  # two gold eyes under the brow, on the stone of the head
        # a thick jet that leans out from the mouth and falls into the basin
        pts = fall_ribbon(PED + 2.8, SPOUT + 0.3, PED + 5.0, WATER - 0.8, 1.6)
        if dx:
            g.prism("z", [(CX + dx * r, y) for r, y in pts], CZ - 2.0, CZ + 1.0, C("cyan", 4))
            col = np.floor(Z).astype(np.int64) - int(CZ)
        else:
            g.prism("x", [(y, CZ + dz * r) for r, y in pts], CX - 2.0, CX + 1.0, C("cyan", 4))
            col = np.floor(X).astype(np.int64) - int(CX)
        jet = S.last(g)
        # the water reads as water, not as masonry: no cross bands, vivid
        # magic cyan, one lit edge and one shaded edge down the whole fall
        # (a directional highlight, rule S3 and finding B1)
        P.flat(g, jet, "cyan", 4)
        P.flat(g, jet & (col == 0), "cyan", 6)
        P.flat(g, jet & (col == -2), "cyan", 2)
        P.flat(g, jet & (Y > SPOUT - 1.0), "cyan", 7)  # the bright lip of the fall
        P.flat(g, jet & (Y < WATER + 1.0), "cyan", 7)  # the splash foot
        # the splash ring the jet makes where it lands
        sx = CX + dx * (PED + 4.6)
        sz = CZ + dz * (PED + 4.6)
        sr = np.hypot(X - sx, Z - sz)
        surf = (g.a > 0) & (Y > WATER - 1) & (Y < WATER + 1) & (rr < R_IN)
        P.flat(g, surf & (sr < 3.2), "sky", 5)
        P.flat(g, surf & (sr < 1.8), "cyan", 6)
    # the upper bowl: a wide flared tazza with a gold rim and water in it
    start = len(g.solids)
    g.prism("y", S.flat_ngon(CX, CZ, 2.6, 8), SPOUT + 3, BOWL, C(STONE, 5), top=S.flat_ngon(CX, CZ, 3.4, 8))
    g.prism("y", S.flat_ngon(CX, CZ, 3.4, 8), BOWL, BOWL + 5, C(STONE, 5), top=S.flat_ngon(CX, CZ, 9.0, 8))
    bowl = _mask(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, STONE, 5, block=(4, 3), frame=fr, seed=8))
    P.flat(g, bowl & S.seams(g, g.solids[start:], 0.6), *DARK)
    P.flat(g, bowl & (Y > BOWL + 3.6) & (rr < 7.0), "sky", 3)
    P.flat(g, bowl & (Y > BOWL + 3.6) & (rr < 4.2), "sky", 4)
    P.flat(g, bowl & (Y > BOWL + 3.6) & (rr < 1.8), "sky", 6)
    P.flat(g, bowl & (Y > BOWL + 3.6) & (rr > 7.0), STONE, 5)  # the bowl lip
    P.flat(g, bowl & (Y > BOWL + 3.6) & (rr > 8.2), "gold", 5)  # the gold rim
    P.flat(g, bowl & (Y >= BOWL + 3.0) & (Y < BOWL + 3.6) & (rr > 7.6), "gold", 3)  # its dark under-edge
    P.flat(g, bowl & (Y < BOWL + 1), *DARK)
    # the gold finial: a slim stem and a round faceted orb (rules F4, F6)
    g.box(CX - 1, BOWL + 5, CZ - 1, CX + 1, BOWL + 6, CZ + 1, C("gold", 4))
    start = len(g.solids)
    g.prism("y", S.flat_ngon(CX, CZ, 1.8, 8), BOWL + 6, BOWL + 8, C("gold", 5), top=S.flat_ngon(CX, CZ, 3.4, 8))
    g.prism("y", S.flat_ngon(CX, CZ, 3.4, 8), BOWL + 8, BOWL + 11, C("gold", 5), top=S.flat_ngon(CX, CZ, 3.4, 8))
    g.prism("y", S.flat_ngon(CX, CZ, 3.4, 8), BOWL + 11, BOWL + 13, C("gold", 5), top=S.flat_ngon(CX, CZ, 1.4, 8))
    orb = _mask(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.flat(gg, mm, "gold", 6 if fr == "top" else 5))
    P.flat(g, orb & (X < CX - 1.0) & (Z < CZ - 0.6) & (Y > BOWL + 8) & (Y < BOWL + 11.5), "gold", 7)
    P.flat(g, orb & (Y < BOWL + 7.5), "gold", 3)
    P.flat(g, orb & (Y > BOWL + 11.8), "gold", 7)
    return (CX, WATER + 1.0, CZ)


def bucket(g: Grid, cx: float, cz: float, y0: float, r: float = 3.0, h: int = 6, seed: int = 0) -> None:
    """An oak water bucket on the apron: staves in warm wood under two iron
    hoops, with a dark rim and an iron bail (the warm accent, rule C1)."""
    X, Y, Z = coords(g)
    start = len(g.solids)
    g.prism("y", S.flat_ngon(cx, cz, r * 0.84, 8), y0, y0 + h, C("wood", 4), top=S.flat_ngon(cx, cz, r, 8))
    m = _mask(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.planks(gg, mm, "wood", 4, width=2, across="x", nails=False, frame=fr, seed=seed))
    P.flat(g, m & (np.abs(Y - y0 - 1.5) < 0.6), "iron", 4)  # the hoops
    P.flat(g, m & (np.abs(Y - y0 - h + 1.5) < 0.6), "iron", 4)
    P.flat(g, m & (Y > y0 + h - 1), "darkwood", 2)  # the dark rim
    P.flat(g, m & (Y < y0 + 1), "darkwood", 2)
    P.flat(g, m & (Y > y0 + h - 2) & (np.hypot(X - cx, Z - cz) < r * 0.6), "sky", 5)  # the water in it
    for s in (-1, 1):  # the iron bail
        g.box(cx + s * (r - 0.8), y0 + h - 1, cz - 0.5, cx + s * (r - 0.8) + 1, y0 + h + 2, cz + 0.5, C("iron", 5))
    g.box(cx - r + 0.6, y0 + h + 2, cz - 0.5, cx + r - 0.6, y0 + h + 3, cz + 0.5, C("iron", 5))


def build() -> Asset:
    g = Grid(W, H, D)
    basin(g)
    at = column(g)
    # the warm props at the foot, both seated on the apron (rule K1)
    bucket(g, CX - APRON + 4.0, CZ + 9.5, 2, 3.0, 6, seed=3)
    bucket(g, CX + APRON - 4.5, CZ - 8.5, 2, 2.4, 5, seed=4)
    # two mossy stones and the grass, all well inside the edge of the apron
    for bx, bz, r, h, seed in ((CX - 9.5, CZ + 10.5, 2.4, 4.0, 2), (CX + 10.0, CZ + 8.0, 1.9, 3.0, 5)):
        boulder(g, bx, bz, 2, r, h, ramp=STONE, base=3, n=6, seed=seed, moss="moss", moss_drape=0.4)
    grass(g, [(int(CX - 12), 2, int(CZ - 6)), (int(CX + 8), 2, int(CZ + 11)), (int(CX - 3), 2, int(CZ + 12)),
              (int(CX + 11), 2, int(CZ + 1))], "leaf", 5)
    return Asset(id="fantasy-props-stone-fountain", pack="fantasy", category="props", name="Stone Fountain", root=Part("stone-fountain", g),
                 sockets=[Socket("socket-water", at=at)],
                 pfx=[{"effectId": "rvx-fantasy-waterfall-mist", "socket": "socket-water", "trigger": "idle", "size": 20}])
