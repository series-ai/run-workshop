"""Dwarf mine entrance in the Pirate Nation style.

A rocky hillside with a grassy crown. A broad front cliff (a battered
slab: its sides slope back, true facets) is cut by a tall tunnel mouth,
22 wide and 34 high, so a dwarf or a person walks in. A heavy timber
portal frames the mouth: two posts, a lintel with knee braces and a
carved board with crossed hammers. Inside, two more timber sets step
back into the dark, and the walls and floor fade to near black; a back
wall closes the tunnel inside the hill. Mine rails on wooden sleepers run
from the yard into the tunnel and end in the dark.

The hill behind is three stacked faceted rock masses (true slopes), so
the hill rises over the portal and closes the tunnel at the back. Rock
is painted as broken strata: horizontal beds of close tones with dark
bedding lines and a few vertical fractures (rules S2, S3), with grass
and moss on the upward faces. A torch on the left post (PFX), an ore
heap with gold nuggets, crates, a pick and a shovel finish it (rule K1).
Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import icon, icon_size
from _fbld_rural import idx
from _life import leaf_block
from _props import flame_tongue
from pnkit import box, crate, edges
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 112, 96, 100
FZ, DEPTH = 36, 16  # the front face of the cliff and the depth of the tunnel
PAD = 3  # the yard pad top
TX0, TX1, TTOP = 44, 68, PAD + 34  # the tunnel mouth (24 wide, 34 high): x range and the top of its arch
TORCH = (39.0, 32.0, float(FZ - 6))  # the torch flame base (x, y, z)


def strata(g: Grid, mask: np.ndarray, base: int = 4, frame=None, seed: int = 0) -> None:
    """Broken rock beds (rules S2, S3): horizontal beds 5 voxels high,
    each split into long slabs of one tone (base -1..+1), a dark bedding
    line under every bed, short vertical fractures at slab ends and a lit
    lip on the top row of each bed."""
    U, V = P.uv(g, frame)
    _X, Y, _Z = idx(g)
    bed = Y // 5
    vb = Y % 5
    span = 12 + (P._hash(bed, seed=seed + 1) % np.uint64(10)).astype(np.int64)
    off = (P._hash(bed, seed=seed + 2) % np.uint64(11)).astype(np.int64)
    slab = (U + off) // span
    tone = base + np.array([-1, 0, 0, 1, 0])[(P._hash(bed, slab, seed=seed + 3) % np.uint64(5)).astype(np.int64)]
    tone = np.where(vb == 4, tone + 1, tone)  # the lit lip of the bed
    line = (P._hash(bed, slab, seed=seed + 4) % np.uint64(3)) != 0
    tone = np.where((vb == 0) & line, base - 2, tone)  # the bedding line, broken
    frac = ((U + off) % span == 0) & (vb > 0) & (vb < 4) & (P._hash(bed, slab, seed=seed + 5) % np.uint64(2) == 0)
    tone = np.where(frac, base - 2, tone)
    P._paint(g, mask, "stone", np.clip(tone, 1, 7))


def rock(g: Grid, start: int, base: int = 4, seed: int = 0) -> np.ndarray:
    """Paint every facet of the prisms added since `start` as rock beds
    and return their mask."""
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: strata(gg, mm, base, frame=fr, seed=seed))
    return np.logical_or.reduce([sd.mask(g.shape) for sd in g.solids[start:]])


def cliff_poly(scale: float) -> list[tuple[float, float]]:
    """The front cliff outline (x, y) with the tunnel notch cut from its
    foot. `scale` widens and raises the outer outline (the battered back
    face); the notch stays the same, so the tunnel walls are straight."""
    cx = 56.0

    def sc(p):
        return (cx + (p[0] - cx) * scale, PAD + (p[1] - PAD) * scale)

    notch = [(TX0, PAD), (TX0, PAD + 27), (TX0 + 3, PAD + 31.5), (TX0 + 8, TTOP), (TX1 - 8, TTOP), (TX1 - 3, PAD + 31.5), (TX1, PAD + 27), (TX1, PAD)]
    crown = [(98, PAD), (90, 37), (76, 57), (56, 64), (36, 58), (24, 40), (14, PAD)]
    return notch + [sc(p) for p in crown]


def hill(g: Grid) -> None:
    """The yard pad, the front cliff with the tunnel notch, the hill masses
    behind it and the grass crown."""
    X, Y, Z = idx(g)
    pad = [(8, 4), (104, 4), (110, 14), (110, 92), (102, 98), (10, 98), (2, 90), (2, 12)]
    g.prism("y", pad, 0, PAD, C("sand", 3), top=[(9, 5), (103, 5), (109, 15), (109, 91), (101, 97), (11, 97), (3, 89), (3, 13)])
    pm = S.last(g)
    P.stone(g, pm, "sand", 3, block=(7, 5), cracks=0.05, frame="top", seed=1)
    P.flat(g, pm & (Y < PAD - 1), "sand", 2)
    # the front cliff: a frustum along z, battered back, notch kept straight
    start = len(g.solids)
    front = cliff_poly(1.0)
    back = cliff_poly(1.12)
    g.prism("z", front, FZ, FZ + DEPTH + 2, C("stone", 4), top=back)
    # the hill behind: three stacked rock masses, each narrower than the one
    # under it, so grassy ledges step up the hill (true slopes, rule F5)
    foot = [(6, 52), (30, 50), (58, 53), (86, 50), (106, 56), (104, 84), (80, 94), (30, 94), (8, 84)]

    def shrink(poly, k, dx=0.0):
        return [(56 + (x - 56) * k + dx, 52 + (z - 52) * k) for x, z in poly]

    layers = ((0, 30, 1.0, 0.92, 0.0), (30, 56, 0.82, 0.74, 2.0), (56, 76, 0.62, 0.38, -3.0))
    for y0, y1, k0, k1, dx in layers:
        g.prism("y", shrink(foot, k0, dx), y0, y1, C("stone", 4), top=shrink(foot, k1, dx))
    rocks = rock(g, start, base=4, seed=2)
    # Grass grows only on faces that look mostly up (flat tops and gentle
    # slopes); the steep rock faces keep their beds. A clean moss band
    # hangs 2 voxels under each grass edge.
    grass = np.zeros(g.shape, dtype=bool)
    for m, fr in S.facets(g, g.solids[start:]):
        if fr == "top" or abs(fr[1][1]) < 0.8:
            grass |= m
    # the flat ledges where one mass steps in from the one under it
    air_above = np.zeros_like(grass)
    air_above[:, :-1, :] = g.a[:, 1:, :] == 0
    grass |= rocks & air_above & np.isin(Y, (29, 55, 75))
    grass &= Y > PAD + 3
    P.flat(g, grass, "leaf", 3)
    P.flat(g, grass & (((X // 3) + (Z // 3)) % 4 == 0), "leaf", 4)
    edge = np.zeros_like(grass)
    for dy in (1, 2):
        shifted = np.zeros_like(grass)
        shifted[:, :-dy, :] = grass[:, dy:, :]
        edge |= shifted
    for ax in (0, 2):
        for st in (1, -1):
            edge |= np.roll(grass, st, axis=ax) & np.roll(np.roll(grass, st, axis=ax), 0, axis=1)
    P.flat(g, rocks & edge & ~grass & ~(Y < PAD + 4), "moss", 4)
    # shrubs on the crown and the ledges (each bottom sits on a top face)
    for cx, cy, cz, sx, sy, sz, sd in ((46, 79.5, 60, 13, 9, 11, 4), (64, 79, 58, 11, 8, 10, 5), (89, 59.5, 66, 8, 7, 9, 6), (15, 33, 70, 7, 6, 8, 7)):
        leaf_block(g, cx, cy, cz, sx, sy, sz, ramp="leaf", base=3, bevel=2.5, seed=sd)


def tunnel(g: Grid) -> None:
    """The dark tunnel: a back wall, near-black walls and floor that get
    darker with depth, two inner timber sets and the rail ends."""
    X, Y, Z = idx(g)
    zb = FZ + DEPTH
    back = box(g, TX0 - 1, PAD, zb, TX1 + 1, TTOP + 1, zb + 3, "darkwood", 0)
    P.flat(g, back, "darkwood", 0)
    near = (g.a > 0) & (X >= TX0 - 1) & (X <= TX1) & (Y <= TTOP) & (Z >= FZ) & (Z < zb + 1)
    d = Z - FZ
    P.flat(g, near & (d >= 0), "stone", 2)
    P.flat(g, near & (d >= 3), "stone", 1)
    P.flat(g, near & (d >= 6), "darkwood", 1)
    P.flat(g, near & (d >= 10), "darkwood", 0)
    P.flat(g, near & (d < 3) & (Y == PAD - 1), "sand", 2)  # the lit floor at the mouth
    # inner timber sets, darker as they step back
    for k, tz in enumerate((FZ + 5, FZ + 11)):
        sh = 3 - k
        tm = box(g, TX0, PAD, tz, TX0 + 3, PAD + 28, tz + 3, "darkwood", sh)
        tm |= box(g, TX1 - 3, PAD, tz, TX1, PAD + 28, tz + 3, "darkwood", sh)
        tm |= box(g, TX0, PAD + 28, tz, TX1, PAD + 31, tz + 3, "darkwood", sh)
        P.planks(g, tm, "darkwood", sh, width=3, across="y", nails=False, seed=10 + k)
    # a small lamp hangs from the first set and shows how deep the dark goes
    cx = (TX0 + TX1) // 2
    box(g, cx, PAD + 24, FZ + 6, cx + 1, PAD + 28, FZ + 7, "iron", 2)
    lamp = box(g, cx - 1, PAD + 20, FZ + 5, cx + 2, PAD + 24, FZ + 8, "gold", 6)
    P.flat(g, lamp & (Y == PAD + 23), "iron", 2)
    # rails and sleepers from the yard into the dark; the rails end before the back wall
    for rx in (50, 61):
        rail = box(g, rx, PAD + 1, 6, rx + 2, PAD + 3, zb - 2, "iron", 5)
        P.flat(g, rail & (Y == PAD + 2), "iron", 6)
        P.flat(g, rail & (Z >= FZ + 4), "iron", 3)
        P.flat(g, rail & (Z >= FZ + 12), "iron", 1)
        box(g, rx, PAD + 1, zb - 3, rx + 2, PAD + 4, zb - 2, "darkwood", 2)  # the end stop
    for sz in range(8, zb - 3, 6):
        sl = box(g, 47, PAD, sz, 66, PAD + 1, sz + 3, "wood", 4)
        P.planks(g, sl, "wood", 4, width=3, across="z", nails=True, frame="top", seed=sz)
        if sz >= FZ:
            P.flat(g, sl, "darkwood", 2 if sz < FZ + 6 else 1)


def portal(g: Grid) -> None:
    """The timber portal in front of the mouth: posts, lintel, knee
    braces and the hammers board. Every timber stays in front of the cliff
    or inside its front 3 voxels, so nothing shows at the back."""
    X, Y, Z = idx(g)
    tm = box(g, TX0 - 4, PAD, FZ - 4, TX0, TTOP + 4, FZ + 2, "darkwood", 4)
    tm |= box(g, TX1, PAD, FZ - 4, TX1 + 4, TTOP + 4, FZ + 2, "darkwood", 4)
    P.planks(g, tm, "darkwood", 4, width=4, across="x", nails=False, seed=20)
    P.flat(g, edges(tm), "darkwood", 2)
    lt = box(g, TX0 - 9, TTOP + 2, FZ - 5, TX1 + 9, TTOP + 8, FZ + 2, "wood", 4)
    P.planks(g, lt, "wood", 4, width=3, across="y", nails=True, seed=21)
    P.flat(g, edges(lt), "darkwood", 2)
    for p0, p1 in (((TX0 - 1, TTOP - 8), (TX0 + 6, TTOP + 2)), ((TX1 + 1, TTOP - 8), (TX1 - 6, TTOP + 2))):
        S.bar(g, "z", p0, p1, 3.0, FZ - 3, FZ - 1, "darkwood", 3)
    # the carved board with crossed hammers on the lintel
    bw, bh = icon_size("hammers", 1)
    cx = (TX0 + TX1) // 2
    bd = box(g, cx - 8, TTOP + 8, FZ - 4, cx + 8, TTOP + 19, FZ - 1, "wood", 5)
    P.planks(g, bd, "wood", 5, width=3, across="y", nails=False, seed=22)
    P.outline(g, bd, "darkwood", 2, normal="z")
    icon(g, "-z", FZ - 4, cx - bw // 2, TTOP + 9, "hammers", "iron", 5)
    # the torch on the left post: an iron bracket, a stick and the flame
    tx, ty, tz = TORCH
    box(g, int(tx) - 1, ty - 8, int(tz), TX0 - 2, ty - 6, FZ - 3, "iron", 3)
    stick = box(g, int(tx) - 1, ty - 10, int(tz) - 1, int(tx) + 1, ty, int(tz) + 1, "wood", 3)
    P.flat(g, stick & (Y >= ty - 2), "darkwood", 2)
    flame_tongue(g, tx, ty, tz, 2.2, 7, lean=0.6, seed=23)


def yard(g: Grid) -> None:
    """Ore heap, crates, a pick and a shovel (rule K1)."""
    X, Y, Z = idx(g)
    # the ore heap: a faceted cone of grey ore with gold nuggets
    heap = S.cone(g, "y", 84, 22, 9.0, PAD, PAD + 9, "stone", 3, n=7, r_top=2.5)
    P.flat(g, heap & ((X + 2 * Z + Y) % 5 == 0), "stone", 5)
    for nx, ny, nz in ((80, 7, 17), (86, 9, 19), (90, 6, 22), (83, 11, 22), (78, 5, 24)):
        box(g, nx, ny, nz, nx + 2, ny + 2, nz + 2, "gold", 6)
    # crates, one open with gold ore in it
    crate(g, 18, PAD, 16, 12, seed=30)
    crate(g, 21, PAD + 12, 19, 9, seed=31)
    crate(g, 92, PAD, 32, 10, seed=32)
    gold = box(g, 93, PAD + 9, 33, 101, PAD + 10, 41, "gold", 5)
    P.flat(g, gold & ((X + Z) % 2 == 0), "gold", 7)
    # a pick and a shovel lean on the right post
    g.prism("z", S.quad((TX1 + 9, PAD), (TX1 + 7, PAD + 26), 0.9), FZ - 8, FZ - 6, C("wood", 5))
    g.prism("z", [(TX1 + 2, PAD + 25), (TX1 + 13, PAD + 27), (TX1 + 13, PAD + 28), (TX1 + 2, PAD + 27)], FZ - 8, FZ - 6, C("iron", 5))
    g.prism("z", S.quad((TX1 + 13, PAD + 6), (TX1 + 11, PAD + 30), 0.9), FZ - 10, FZ - 8, C("wood", 4))
    blade = box(g, TX1 + 11, PAD, FZ - 11, TX1 + 16, PAD + 7, FZ - 8, "steel", 5)
    P.flat(g, blade & (Y < PAD + 2), "steel", 3)
    # a few loose rocks
    for rx, rz, r in ((10, 30, 3.0), (100, 14, 2.6), (30, 10, 2.2)):
        st = S.cone(g, "y", rx, rz, r, PAD, PAD + 3, "stone", 4, n=6, r_top=r * 0.5)
        P.flat(g, st & (Y == PAD + 2), "stone", 6)


def build() -> Asset:
    g = Grid(W, H, D)
    hill(g)
    tunnel(g)
    portal(g)
    yard(g)
    tx, ty, tz = TORCH
    return Asset(
        id="fantasy-buildings-mine-entrance", pack="fantasy", category="buildings", name="Dwarf Mine Entrance",
        root=Part("mine-entrance", g),
        sockets=[Socket("socket-function", at=(tx, ty + 3, tz))],
        pfx=[{"effectId": "rvx-fantasy-torch-flame", "socket": "socket-function", "trigger": "idle", "size": 22}],
    )
