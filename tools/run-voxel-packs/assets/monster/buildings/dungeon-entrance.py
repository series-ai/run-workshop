"""Dungeon entrance, in the Pirate Nation haunted style.

A squat grey stone gatehouse that guards the stairs down into the
dungeon. At the front, a massive light stone gate with a round arch (true
facets), a giant skull keystone with glowing eyes (the oversized function
prop, F4 and F6), a raised iron portcullis with spiked teeth and painted
stairs that go down into a pumpkin-orange glow. Behind the gate, a stone
hall under a steep purple slate gable with magenta rose windows, sloped
buttresses, barred cellar grates that glow orange, and a round watch tower
with a tall purple spire and a bat vane at one back corner (F5: never
symmetric). A few big clean faceted boulders hold the hall into its
rocky ground; ivy climbs one side. Two skull-topped pillars carry
toxic-green fire bowls; steps, bones and pumpkins lie at the foot.
Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _bld import bat, coords, course, crow, mushroom, piers, plinth, roof_paint, rounded, stone
from _pn import blotch, lancet, pumpkin, rose, tombstone
from _props import TOXIC, pn_flame
from pnkit import box, gable_roof
from voxgrid import C, Asset, Grid, Part

W, H, D = 124, 132, 126
CX = 62.0
GZ0, GZ1 = 38, 52  # gate front and back
GX0, GX1 = 32, 92  # gate outer width
AX0, AX1 = 44, 80  # arch opening
SPRING = 38  # the arch springs here; the crown is at SPRING + half the opening
GTOP = 66
FLOOR = 8  # landing height
HX0, HX1, HZ0, HZ1 = 38, 86, 50, 104  # the hall behind the gate
WALL = 50  # hall wall top
RIDGE = 92
TX, TZ, TR = 34.0, 104.0, 10.0  # the watch tower (back-left corner)
TTOP = 80

# big clean boulders round the hall foot: (x, z, radius, height, moss)
ROCKS = [
    (101, 70, 14, 17, True),  # right: a big stone and a small one at its foot
    (110, 84, 8, 8, False),
    (97, 104, 15, 21, True),  # back right, against the hall corner
    (82, 116, 8, 9, False),
    (58, 114, 11, 12, True),  # back
    (17, 74, 14, 16, True),  # left, in front of the tower
    (25, 59, 7, 7, False),
]


def boulder(g: Grid, cx, cz, r: float, h: float, moss: bool = True, seed: int = 0) -> np.ndarray:
    """A chunky faceted boulder (an irregular 7-gon that bulges a little
    above its foot and closes to a broad, turned top: true slopes). Each
    facet is one broad flat tone (S3: no speckle), lit tops lighter; the
    facet edges get a darker seam, a few long painted cracks break the big
    planes, and some boulders carry a moss cap that spills over the top."""
    rng = np.random.default_rng(seed)
    n = 7
    radii = [r * rng.uniform(0.8, 1.0) for _ in range(n)]
    a0 = rng.uniform(0, 2 * math.pi)
    sx, sz = rng.uniform(-0.12, 0.12) * r, rng.uniform(-0.12, 0.12) * r

    def ring(scale, twist, dx=0.0, dz=0.0):
        return [(cx + dx + scale * radii[k] * math.cos(a0 + twist + 2 * math.pi * k / n),
                 cz + dz + scale * radii[k] * math.sin(a0 + twist + 2 * math.pi * k / n)) for k in range(n)]

    base, belly, top = ring(0.9, 0.0), ring(1.0, math.radians(6)), ring(0.45, math.radians(20), 1.6 * sx, 1.6 * sz)
    yb = h * 0.35
    start = len(g.solids)
    g.prism("y", base, 0, yb, C("stone", 5), top=belly)
    g.prism("y", belly, yb, h, C("stone", 5), top=top)
    solids = g.solids[start:]
    m = np.logical_or.reduce([sd.mask(g.shape) for sd in solids])
    X, Y, Z = coords(g)
    tops = np.zeros(g.shape, dtype=bool)
    for k, (fm, fr) in enumerate(S.facets(g, solids)):
        if fr == "top":
            P.flat(g, fm, "stone", 6)
            tops |= fm
            continue
        u = np.asarray(fr[0])
        nx, nz = -u[2], u[0]  # the facet's outward direction in plan
        lit = (-0.6 * nx - 0.8 * nz) > 0.2  # toward the front-left light
        shade = 5 if lit else 4
        if abs(fr[1][1]) < 0.75:  # a flat-ish upper slope catches the light
            shade += 1
            tops |= fm
        P.flat(g, fm, "stone", shade)
        # one long painted crack across the bigger facets
        if fm.sum() > 60 and (seed + k) % 3 == 0:
            U, V = P.uv(g, fr)
            uc = int(np.median(U[fm]))
            crack = fm & (np.abs(U - uc - ((V // 2) % 2)) < 0.5) & ((V % 7) < 5)
            P.flat(g, crack, "stone", shade - 2)
    P.flat(g, m & S.seams(g, solids, 0.8), "stone", 3)
    if moss:
        cap = tops & (Y > h * 0.7)
        P.flat(g, cap, "moss", 5)
        blotch(g, m & ~cap & (Y > h * 0.5), "moss", 5, cell=3, chance=0.18, seed=seed + 2)
        blotch(g, cap, "moss", 6, cell=2, chance=0.2, seed=seed + 3)
    return m


def fire_bowl(g: Grid, cx, y0, cz, r: float = 6) -> np.ndarray:
    """An iron fire bowl (an upturned octagon frustum on a short stem) with
    glowing coals and a cursed toxic fire (the shared PN flame)."""
    m = S.cone(g, "y", cx, cz, r * 0.45, y0, y0 + 3, "gray", 3, r_top=r * 0.3)
    bowl = S.cone(g, "y", cx, cz, r * 0.55, y0 + 3, y0 + 7, "gray", 3, r_top=r)
    _X, Y, _Z = coords(g)
    P.flat(g, bowl & (Y > y0 + 6), "gray", 5)
    m |= bowl
    m |= box(g, cx - r + 1.5, y0 + 6, cz - r + 1.5, cx + r - 1.5, y0 + 7.5, cz + r - 1.5, "toxic", 5)
    m |= pn_flame(g, cx, cz, y0 + 7, r * 1.6, r * 2.2, colors=TOXIC, cross=0.8)
    return m


def arch_frame(x0, x1, xi0, xi1, top, spring, y0, n: int = 8):
    """A gate outline in (x, y) with a round arch opening, as one simple polygon."""
    r = (xi1 - xi0) / 2
    cu = (xi0 + xi1) / 2
    pts = [(x0, y0), (x0, top), (x1, top), (x1, y0), (xi1, y0), (xi1, spring)]
    pts += [(cu + r * math.cos(math.pi * k / n), spring + r * math.sin(math.pi * k / n)) for k in range(1, n)]
    pts += [(xi0, spring), (xi0, y0)]
    return pts


def grate(g: Grid, face: str, plane, u0, u1, v0, v1) -> np.ndarray:
    """A barred cellar grate low on a wall: an orange-lit opening one voxel
    proud in a light stone frame, with dark iron bars painted across it
    (the dungeon below shows from every side)."""
    from pnkit import on_face

    pane = box(g, *on_face(face, plane, u0, u1, v0, v1, 0, 1), "ember", 4)
    X, Y, Z = np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")
    U = X if face[1] == "z" else Z
    P.flat(g, pane & (Y >= v1 - 2), "orange", 3)
    P.flat(g, pane & ((U - int(u0)) % 3 == 1), "gray", 2)
    fr = box(g, *on_face(face, plane, u0 - 2, u1 + 2, v1, v1 + 2, 0, 2), "gray", 6)
    fr |= box(g, *on_face(face, plane, u0 - 2, u0, v0, v1, 0, 2), "gray", 6)
    fr |= box(g, *on_face(face, plane, u1, u1 + 2, v0, v1, 0, 2), "gray", 6)
    P.stone(g, fr, "gray", 6, block=(4, 2), seed=31)
    return pane


def vines(g: Grid, mask: np.ndarray, along: str, u0, u1, top_fn, seed: int = 0) -> np.ndarray:
    """Ivy on a wall: a few wavy stems climbing from the ground in the
    surface `mask`, leaf clusters on each, and a toxic-green glint here and
    there. `along` is the wall's horizontal axis ('x' or 'z'); top_fn(u)
    gives each stem's top height."""
    rng = np.random.default_rng(seed)
    X, Y, Z = coords(g)
    U = X if along == "x" else Z
    out = np.zeros(g.shape, dtype=bool)
    u = u0 + rng.uniform(1, 4)
    while u < u1:
        top = top_fn(u)
        wav = u + 1.6 * np.sin(Y / 4.0 + u)
        stem = mask & (np.abs(U - wav) < 0.8) & (Y < top)
        leaf = mask & (np.abs(U - wav) < 2.6) & (Y < top + 2) & ((np.floor(Y / 3) + np.floor(U / 2)) % 3 == 0)
        out |= stem | leaf
        u += rng.uniform(5, 9)
    P.flat(g, out, "moss", 5)
    blotch(g, out, "moss", 6, cell=2, chance=0.25, seed=seed + 1)
    blotch(g, out, "toxic", 3, cell=2, chance=0.1, seed=seed + 2)
    return out


def entrance() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    cu, r = (AX0 + AX1) / 2, (AX1 - AX0) / 2
    # ---- the hall behind the gate: plinth, walls, piers, string course
    plinth(g, HX0, HZ0, HX1, HZ1, h=6, out=3, seed=1)
    walls = stone(g, HX0, 6, HZ0, HX1, WALL, HZ1, "gray", 5, block=(8, 4), seed=2)
    piers(g, HX0, HX1, HZ0, HZ1, 6, WALL, size=6, seed=3, corners=("br",))
    course(g, HX0, HZ0, HX1, HZ1, 30, 33, seed=4)
    # sloped buttresses on the long sides (true slopes, F2)
    for zb in (HZ0 + 14, HZ0 + 32):
        for s, xf in ((-1, HX0), (1, HX1)):
            g.prism("z", [(xf, 6), (xf + s * 8, 6), (xf + s * 8, 14), (xf, 40)], zb, zb + 6, C("gray", 6))
            P.stone(g, S.last(g), "gray", 6, block=(5, 4), seed=5)
    # glowing windows: toxic lancets on the sides, a magenta rose high on the back
    for zz in (HZ0 + 22, HZ0 + 40):
        lancet(g, "+x", HX1, zz, zz + 7, 34, 48, glass="toxic", shade=5, seed=6)
        lancet(g, "-x", HX0, zz, zz + 7, 34, 48, glass="magenta", shade=5, seed=7)
    lancet(g, "+z", HZ1, CX + 4, CX + 14, 14, 40, glass="toxic", shade=5, seed=8)
    # barred cellar grates glowing orange: the dungeon under the hall
    for zz in (HZ0 + 6, HZ0 + 26):
        grate(g, "+x", HX1, zz, zz + 6, 8, 13)
        grate(g, "-x", HX0, zz, zz + 6, 8, 13)
    grate(g, "+z", HZ1, CX - 14, CX - 4, 8, 13)
    # the steep purple slate gable, its end turned to the front (as the set)
    roof = gable_roof(g, HX0 - 1, HX1 + 1, HZ0 + 2, HZ1, WALL, RIDGE, ramp="purple", thick=4, overhang=4, trim="gray", gable="gray", ridge="z", trim_shade=6, seed=9)
    roof_paint(g, roof, "z", 10)
    rose(g, "+z", HZ1, CX, WALL + 16, 6, glass="magenta", shade=6)
    rose(g, "-z", HZ0 + 2, CX, WALL + 28, 5, glass="magenta", shade=6)
    blotch(g, roof["slabs"] & (Y < WALL + 7), "moss", 5, cell=3, chance=0.07, seed=11)
    S.cross(g, CX, RIDGE + 6, HZ1 - 2, h=14, arm=5)
    # ---- the round watch tower at the back-left corner
    tw = S.cone(g, "y", TX, TZ, TR, 0, TTOP, "gray", 5, r_top=TR)
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.stone(gg, mm, "gray", 5, block=(6, 4), cracks=0.06, frame=fr, seed=12))
    for y0, y1, rr in ((0, 6, TR + 2), (44, 47, TR + 1)):
        S.cone(g, "y", TX, TZ, rr, y0, y1, "gray", 6, r_top=rr)
        S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.stone(gg, mm, "gray", 6, block=(6, 3), frame=fr, seed=13))
    S.cone(g, "y", TX, TZ, TR, TTOP - 4, TTOP, "gray", 6, r_top=TR + 2)  # corbelled lip
    S.cone(g, "y", TX, TZ, TR + 2, TTOP, TTOP + 4, "gray", 6, r_top=TR + 2)
    S.paint_facets(g, g.solids[-2:], lambda gg, mm, fr: P.stone(gg, mm, "gray", 6, block=(5, 2), frame=fr, seed=14))
    sp = S.spire(g, TX, TZ, TTOP + 4, TR + 1, 32, ramp="purple", base=4, n=8, overhang=1.5, seed=15)
    P.flat(g, sp & S.seams(g, g.solids[-1:], 0.8), "gray", 6)
    P.flat(g, sp & (Y < TTOP + 6), "gray", 6)
    lancet(g, "-x", TX - TR + 0.5, TZ - 3, TZ + 3, 56, 72, glass="toxic", shade=6, seed=16)
    lancet(g, "+z", TZ + TR - 0.5, TX - 3, TX + 3, 20, 36, glass="toxic", shade=6, seed=17)
    box(g, TX - 1, TTOP + 30, TZ - 1, TX + 1, TTOP + 40, TZ + 1, "purple", 2)
    bat(g, TX, TTOP + 40, TZ - 1, span=11, t=2)
    # ---- the boulders that sit the hall into its rocky ground
    for k, (x, z, rr, hh, mo) in enumerate(ROCKS):
        boulder(g, x, z, rr, hh, moss=mo, seed=40 + k)
    # ---- the landing and front steps
    land = stone(g, GX0 - 6, 0, GZ0 - 16, GX1 + 6, FLOOR, GZ1, "stone", 5, block=(9, 4), seed=20)
    stone(g, AX0 - 2, 0, GZ0 - 26, AX1 + 2, 4, GZ0 - 16, "stone", 5, block=(6, 4), seed=21)
    # ---- the gate: chunky piers and a faceted round arch, light stone
    g.prism("z", arch_frame(GX0, GX1, AX0, AX1, GTOP, SPRING, FLOOR), GZ0, GZ1, C("gray", 6))
    frame = [g.solids[-1]]
    S.paint_facets(g, frame, lambda gg, mm, fr: P.stone(gg, mm, "gray", 6, block=(6, 5), cracks=0.1, frame=fr, seed=22))
    fm = S.last(g)
    # voussoirs: painted radial joints round the arch (S1)
    ang = np.arctan2(Y - SPRING, X - cu)
    rad = np.hypot(X - cu, Y - SPRING)
    ring = fm & (Z < GZ0 + 1) & (Y > SPRING) & (rad < r + 7)
    P.flat(g, ring, "gray", 7)
    P.flat(g, ring & ((np.abs(((ang / math.pi * 9) % 1) - 0.5) > 0.42) | (np.abs(rad - r - 7) < 0.6)), "gray", 4)
    cap = stone(g, GX0 - 3, GTOP, GZ0 - 2, GX1 + 3, GTOP + 5, GZ1 + 2, "gray", 6, block=(10, 5), seed=23)
    # a crenellated parapet on the gate cap (a fortified gatehouse
    # silhouette); its back wall rises behind the skull keystone
    stone(g, GX0 - 3, GTOP + 5, GZ1 - 2, GX1 + 3, GTOP + 8, GZ1 + 2, "gray", 6, block=(8, 3), seed=24)
    for x0, x1 in ((GX0 - 3, GX0 + 3), (GX0 + 7, GX0 + 13), (GX1 - 13, GX1 - 7), (GX1 - 3, GX1 + 3)):
        stone(g, x0, GTOP + 5, GZ0 - 2, x1, GTOP + 11, GZ1 + 2, "gray", 6, block=(6, 3), seed=24)
    # a pointed pediment behind the skull keystone, with a magenta oculus
    g.prism("z", [(CX - 16, GTOP + 5), (CX + 16, GTOP + 5), (CX + 16, GTOP + 9), (CX, GTOP + 22), (CX - 16, GTOP + 9)], GZ1 - 4, GZ1 + 2, C("gray", 6))
    ped = [g.solids[-1]]
    S.paint_facets(g, ped, lambda gg, mm, fr: P.stone(gg, mm, "gray", 6, block=(6, 3), frame=fr, seed=24))
    P.flat(g, S.last(g) & S.seams(g, ped, 0.8) & (Y > GTOP + 9), "gray", 4)
    rose(g, "+z", GZ1 + 2, CX, GTOP + 12, 3, glass="magenta", shade=6)
    # the dark stair well: a painted opening going down into orange light
    g.prism("z", rounded(AX0, AX1, FLOOR, SPRING + r, n=8), GZ0 + 3, GZ1, C("purple", 2))
    well = S.last(g)
    t = (Y - FLOOR) / (SPRING + r - FLOOR)
    P.flat(g, well & (t < 0.62), "purple", 3)
    for k in range(6):
        yk = FLOOR + k * 3.2
        band = well & (Y >= yk) & (Y < yk + 2.2) & (np.abs(X - cu) < r - k * 1.2)
        P.flat(g, band, "orange", max(2, 6 - k))
        P.flat(g, well & (Y >= yk + 2.2) & (Y < yk + 3.2) & (np.abs(X - cu) < r - k * 1.2), "orange", max(1, 4 - k))
    P.flat(g, well & (Y < FLOOR + 3), "ember", 6)
    P.stone(g, well & (Z > GZ1 - 1), "gray", 5, block=(6, 5), seed=25)
    # the raised portcullis: iron bars with spiked teeth in the arch top
    for u in range(int(AX0) + 2, int(AX1) - 1, 5):
        top = SPRING + math.sqrt(max(0.0, r * r - (u + 1 - cu) ** 2)) - 1
        bot = SPRING + 4
        if top - bot < 3:
            continue
        box(g, u, bot, GZ0 + 1, u + 2, top, GZ0 + 3, "gray", 3)
        g.prism("y", [(u, GZ0 + 1), (u + 2, GZ0 + 1), (u + 2, GZ0 + 3), (u, GZ0 + 3)], bot - 4, bot, C("gray", 5), top=[(u + 1, GZ0 + 2)] * 4)
    for yy in (SPRING + 6, SPRING + 13):
        half = math.sqrt(max(0.0, r * r - (yy + 1 - SPRING) ** 2))
        box(g, cu - half, yy, GZ0, cu + half, yy + 2, GZ0 + 1, "gray", 3)
    # the giant skull keystone with glowing eyes
    S.skull(g, cu, SPRING + r - 8, GZ0 - 6, s=22, eyes=("toxic", 7), socket=("purple", 1), seed=26)
    # hanging chains on the piers (painted links on proud straps)
    for x in (GX0 + 5, GX1 - 7):
        strap = box(g, x, 24, GZ0 - 1, x + 2, GTOP - 4, GZ0, "gray", 3)
        P.flat(g, strap & ((Y.astype(int) // 2) % 2 == 0), "gray", 5)
        box(g, x - 1, GTOP - 6, GZ0 - 2, x + 3, GTOP - 3, GZ0, "gray", 4)
    # skull-topped pillars with toxic fire bowls
    for px in (GX0 - 16, GX1 + 8):
        stone(g, px, 0, GZ0 - 18, px + 8, 34, GZ0 - 10, "gray", 6, block=(4, 5), seed=27)
        stone(g, px - 1, 0, GZ0 - 19, px + 9, 4, GZ0 - 9, "gray", 5, block=(5, 4), seed=28)
        w, _h = pnglyph.icon_size("skull")
        pnglyph.icon(g, "-z", GZ0 - 18, int(px + 4 - w / 2), 20, "skull", "bone", 6, inks={".": ("gray", 6)})
        fire_bowl(g, px + 4, 34, GZ0 - 14, r=6)
    # bones, a skull, tombstones and pumpkins at the foot (K1)
    S.skull(g, CX - 26, 0, GZ0 - 20, s=8, eyes=("toxic", 6), seed=29)
    for x0, z0, x1, z1 in ((CX - 32, GZ0 - 26, CX - 20, GZ0 - 24), (CX - 30, GZ0 - 22, CX - 27, GZ0 - 14)):
        box(g, x0, 0, z0, x1, 2, z1, "bone", 6)
    pumpkin(g, CX + 30, 0, GZ0 - 28, w=12, h=9, seed=30)
    pumpkin(g, CX + 40, 0, GZ0 - 22, w=9, h=7, seed=31)
    pumpkin(g, GX0 - 12, FLOOR, GZ0 + 4, w=10, h=8, seed=32)
    pumpkin(g, HX1 + 6, 0, HZ1 + 4, w=10, h=8, seed=33)
    tombstone(g, 110, 46, w=8, h=12, lean=8, seed=34)
    tombstone(g, 12, 46, w=7, h=10, lean=-6, glyph="", seed=35)
    crow(g, GX1, GTOP + 11, GZ0 + 1, facing=-1)
    # glowing toadstools at the rock feet (C3 accents)
    for k, (x, z, h) in enumerate(((10, 30, 7), (16, 26, 5), (8, 24, 4), (112, 30, 6), (108, 26, 4), (108, 72, 5), (28, 90, 5))):
        mushroom(g, x, 0, z, h=h, r=2.5 + h * 0.3, cap=("toxic", 6) if k % 3 else ("magenta", 6))
    # ivy up the left hall wall and the tower (one side only, F5)
    side = (g.a > 0) & ~g.solid_mask() & (X < HX0 + 1) & (X > HX0 - 1.5) & (Z > HZ0 + 4) & (Z < HZ1 - 12)
    vines(g, side, "z", HZ0 + 4, HZ1 - 12, lambda u: 22 + 14 * math.sin(u / 7.0) ** 2, seed=36)
    front = (g.a > 0) & ~g.solid_mask() & (Z > HZ1 - 1) & (Z < HZ1 + 1.5) & (X > HX0 + 2) & (X < CX - 18)
    vines(g, front, "x", HX0 + 2, CX - 18, lambda u: 18 + (u % 7) * 2, seed=37)
    # moss on the landing edge and the gate cap, dirt at the foot
    up = np.zeros(g.shape, dtype=bool)
    up[:, :-1, :] = g.a[:, 1:, :] == 0
    blotch(g, (cap | land) & up, "moss", 5, cell=3, chance=0.12, seed=38)
    P.grime(g, (g.a > 0) & (Y < 10) & ~g.solid_mask() & (walls | land | fm), height=4, seed=39)
    return g


def build() -> Asset:
    root = Part("dungeon-entrance", entrance(), pivot=(0.0, 0.0, 0.0))
    return Asset(id="monster-buildings-dungeon-entrance", pack="monster", category="buildings", name="Dungeon Entrance", root=root)
