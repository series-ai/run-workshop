"""Observatory, in the Pirate Nation mecha style.

A plated steel drum two storeys tall on a hazard plinth, with thick dark
bands, a wide blast door under a striped awning and rows of glowing teal
windows. Its oversized function prop is the dome: a white hull cupola on
copper ribs (true slopes, F2) with a deep shutter slit, and a huge white
telescope tube leaning out of it. A lab annex with a steep steel gable
roof, an OBS sign and a roof satellite dish leans on the +X side; a copper
pipe run, chemical drums, crates and a beacon fill the yard. On `idle` the
dome turns and the telescope nods. Detail is paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
import pnkit
import pnshapes as S
from _bld import band, beacon, big_gear, blast_door, coords, corner_posts, crate, facet_paint, fuel_drum, hull_box, hull_on, plates_on, sign, steel_box, steel_roof, window
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part

W, H, D = 132, 104, 96
G = 4  # ground slab top
DX, DZ, DR = 42, 48, 30  # the drum
YD = 58  # the drum top: the dome turns here
AX0, AX1, AZ0, AZ1 = 80, 126, 26, 70  # the annex
AW, AR = 46, 70  # annex wall top and ridge


def body() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    slab = box(g, 2, 0, 2, W - 2, G, D - 2, "steel", 4)
    P.plates(g, slab, "steel", 4, size=(16, 16), rivets=False, seed=1)
    P.flat(g, edges(slab), "steel", 2)
    drum(g)
    annex(g)
    yard(g)
    return g


def drum(g: Grid) -> None:
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    plinth = S.disc(g, "y", DX, DZ, DR + 2, G, G + 5, "iron", 4, n=12)
    facet_paint(g, g.solids[n0:], lambda gg, mm, fr: P.plates(gg, mm, "iron", 4, size=(10, 5), frame=fr, seed=2))
    P.flat(g, plinth & (Y > G + 3.5), "iron", 6)
    n1 = len(g.solids)
    lower = S.disc(g, "y", DX, DZ, DR, G + 5, 30, "steel", 5, n=12)
    facet_paint(g, g.solids[n1:], plates_on("steel", 5, size=(12, 9), seed=3))
    n2 = len(g.solids)
    upper = S.disc(g, "y", DX, DZ, DR - 1, 34, YD, "bone", 6, n=12)
    facet_paint(g, g.solids[n2:], hull_on("bone", 6, size=(12, 9), seed=4))
    mid = S.disc(g, "y", DX, DZ, DR + 2, 30, 34, "iron", 4, n=12)
    P.flat(g, mid, "iron", 4)
    P.flat(g, mid & (Y > 32.5), "iron", 6)
    P.flat(g, mid & (np.floor(X + Z) % 7 == 0) & (Y > 31) & (Y < 32.5), "gold", 6)
    cornice = S.disc(g, "y", DX, DZ, DR + 1, YD - 4, YD, "iron", 4, n=12)
    P.flat(g, cornice, "iron", 4)
    P.flat(g, cornice & (Y > YD - 1.5), "iron", 6)
    del lower, upper
    # the wide blast door with a striped awning, and lamps beside it
    # The door leaf is 28 high (door grammar 24-36): a notch in the plinth
    # takes the threshold down to one voxel above the ground slab.
    notch = (X > DX - 15) & (X < DX + 15) & (Y >= G + 1) & (Y < G + 5) & (Z < DZ - DR + 1)
    g.a[notch] = 0
    blast_door(g, "-z", DZ - DR + 1, DX - 11, DX + 11, G + 1, G + 29, seed=5)
    pnkit.awning(g, "-z", DZ - DR + 1, DX - 16, DX + 16, G + 35, depth=9, drop=6, ramps=("orange", "bone"), stripe=3)
    for sx in (DX - 19, DX + 19):
        lampbox = box(g, sx - 2, 24, DZ - DR - 1, sx + 2, 30, DZ - DR + 2, "iron", 4)
        P.flat(g, lampbox & (Z < DZ - DR), "gold", 7)
        P.flat(g, edges(lampbox), "iron", 2)
    # glowing teal windows round both storeys
    for face, plane in (("-x", DX - DR + 1), ("+x", DX + DR - 1)):
        for zc in (DZ - 13, DZ + 13):
            window(g, face, plane, zc - 6, zc + 6, 14, 26)
            window(g, face, plane, zc - 6, zc + 6, 40, 52, bar=False)
    for u0 in (DX - 24, DX + 12):
        window(g, "-z", DZ - DR + 1, u0, u0 + 12, 40, 52, bar=False)
    window(g, "+z", DZ + DR - 1, DX - 7, DX + 7, 16, 28)
    big_gear(g, "+z", DZ + DR - 1, DX - 20, 24, 9, teeth=10)
    S.pipe(g, [(DX + 23, G + 5, DZ + 20), (DX + 23, 54, DZ + 20)], s=4, ramp="rust", base=4)
    # an outside stair rail and a service hatch on the upper storey
    hatch = box(g, DX + 10, 38, DZ - DR + 1, DX + 22, 50, DZ - DR + 2, "steel", 4)
    P.flat(g, edges(hatch), "steel", 2)
    P.flat(g, hatch & (np.floor(coords(g)[0]) % 4 == 0), "steel", 6)


def annex(g: Grid) -> None:
    X, Y, Z = coords(g)
    steel_box(g, AX0, G, AZ0, AX1, 28, AZ1, seed=6)
    hull_box(g, AX0, 28, AZ0, AX1, AW, AZ1, seed=7)
    corner_posts(g, AX0, AX1, AZ0, AZ1, G, AW)
    band(g, AX0 - 2, 27, AZ0 - 2, AX1 + 2, 31, AZ1 + 2)
    band(g, AX0 - 2, AW - 3, AZ0 - 2, AX1 + 2, AW, AZ1 + 2)
    roof = steel_roof(g, AX0, AX1, AZ0, AZ1, AW, AR, ridge="x", overhang=4, seed=8)
    field = roof["slabs"] & (X > AX0 - 1) & (X < AX1 + 1)
    P.flat(g, field, "teal", 5)
    P.flat(g, field & (np.floor(Y) % 4 == 0), "teal", 4)
    P.flat(g, field & (np.floor(Y) % 4 == 2), "teal", 6)
    P.flat(g, field & (np.floor(Y) % 12 == 5), "rust", 5)
    P.flat(g, roof["slabs"] & ((X < AX0 - 1) | (X > AX1 + 1)), "iron", 3)
    P.flat(g, roof["ridge"], "rust", 5)
    P.flat(g, edges(roof["ridge"]), "rust", 3)
    sign(g, "-z", AZ0, (AX0 + AX1) / 2, AW + 4, "OBS", scale=2, pad=2)
    blast_door(g, "-z", AZ0, AX0 + 14, AX0 + 32, G, G + 28, seed=9)
    for u0 in (AX0 + 2, AX0 + 36):
        window(g, "-z", AZ0, u0, u0 + 8, 12, 24, bar=False)
    for u0 in (AX0 + 2, AX0 + 36):
        window(g, "-z", AZ0, u0, u0 + 8, 33, 43)
    for zc in (AZ0 + 13, AZ1 - 13):
        window(g, "+x", AX1, zc - 5, zc + 5, 33, 43)
    # a vent stack on the ridge and a roof satellite dish
    v = steel_box(g, AX0 + 6, AR - 6, AZ0 + 16, AX0 + 16, AR + 10, AZ0 + 26, seed=10)
    P.flat(g, v & (Y > AR + 7), "orange", 5)
    P.flat(g, v & (np.abs(Y - (AR + 2)) < 1), "rust", 5)
    mastx, mastz = AX1 - 14, AZ0 + 12
    S.bar(g, "x", (AW, mastz), (AW + 14, mastz), 3, mastx - 1.5, mastx + 1.5, "steel", 4)
    n0 = len(g.solids)
    dishm = S.cone(g, "z", mastx, AW + 16, 9, mastz - 4, mastz + 1, "bone", 6, n=8, r_top=3.5, tip="hi")
    P.flat(g, dishm, "bone", 6)
    P.flat(g, dishm & (S.ngon_radius(g, "z", mastx, AW + 16, 8) > 7.4), "orange", 5)
    del n0


def yard(g: Grid) -> None:
    X, Y, Z = coords(g)
    crate(g, 10, G, 76, 10)
    crate(g, 11, G + 10, 78, 7, ramp="steel", base=5, stripe=("orange", 5))
    crate(g, 24, G, 78, 8, ramp="bone", base=6, stripe=("cyan", 6))
    fuel_drum(g, 44, 86, G, h=13, r=5)
    fuel_drum(g, 56, 84, G, h=13, r=5, ramp="steel")
    beacon(g, 118, G, 12, h=16)
    beacon(g, 8, G, 16, h=14)
    S.pipe(g, [(72, 18, 48), (76, 18, 48), (76, 18, AZ0 + 6), (AX0 - 1, 18, AZ0 + 6)], s=4, ramp="rust", base=4)
    # a low bench and two marker posts in front of the drum
    bench = box(g, 20, G, 14, 40, G + 5, 22, "steel", 4)
    P.flat(g, bench, "steel", 4)
    P.flat(g, bench & (Y > G + 3.5), "bone", 6)
    P.flat(g, edges(bench), "steel", 2)
    for mx in (62, 70):
        m = box(g, mx, G, 12, mx + 3, G + 11, 15, "orange", 5)
        P.flat(g, edges(m), "orange", 3)
        P.flat(g, m & (coords(g)[1] > G + 9), "cyan", 7)


def dome() -> Grid:
    """The cupola: a faceted white hull dome on copper ribs with a deep
    shutter slit cut through the front."""
    r, h = DR - 2, 26
    n = r * 2 + 8
    g = Grid(n, h + 8, n)
    c = n / 2
    X, Y, Z = coords(g)
    skirt = S.disc(g, "y", c, c, r + 1, 0, 4, "iron", 4, n=12)
    P.flat(g, skirt, "iron", 4)
    P.flat(g, skirt & (Y > 2.5), "iron", 6)
    P.flat(g, skirt & (np.floor(X + Z) % 6 == 0) & (Y > 1) & (Y < 2.5), "gold", 6)

    def shell(gg, mm, fr):
        U, V = P.uv(gg, fr)
        P.mottle(gg, mm, "bone", 6, cell=4, seed=11)
        P.flat(gg, mm & ((U % 11 == 0) | (V % 8 == 0)), "bone", 4)
        P.flat(gg, mm & (U % 11 == 3) & (V % 8 == 3), "bone", 7)

    dm = S.dome(g, c, c, 4, r, h=h, n=12, rings=3, ramp="bone", base=6, cap_r=6, painter=shell, ribs=("rust", 4))
    P.flat(g, dm & ((np.abs(Y - 14.5) < 0.6) | (np.abs(Y - 23.5) < 0.6)), "rust", 4)  # copper hoops
    cap = S.disc(g, "y", c, c, 7, 4 + h - 1, 4 + h + 3, "rust", 4, n=10)
    P.flat(g, cap, "rust", 4)
    P.flat(g, cap & (Y > 4 + h + 1.5), "rust", 6)
    # the shutter slot: a dark recess up the front with copper rails
    slot = dm & (np.abs(X - c) < 6) & (Z < c)
    P.flat(g, slot, "iron", 2)
    P.flat(g, slot & (np.abs(X - c) < 2) & (np.floor(Y) % 5 == 0), "iron", 3)
    rail = dm & (np.abs(X - c) >= 6) & (np.abs(X - c) < 8) & (Z < c)
    P.flat(g, rail, "rust", 4)
    P.flat(g, rail & (np.floor(Y) % 4 == 0), "rust", 6)
    P.flat(g, dm & (np.abs(X - c) >= 8) & (np.abs(X - c) < 10) & (Z < c), "orange", 5)
    # the shutter motors flanking the slot on the skirt
    for s_ in (-1, 1):
        mb = box(g, c + s_ * 10 - 3, 2, c - r - 1, c + s_ * 10 + 3, 9, c - r + 5, "steel", 5)
        P.flat(g, mb, "steel", 5)
        P.flat(g, edges(mb), "steel", 3)
        P.flat(g, mb & (Z < c - r + 0.5) & (np.abs(Y - 6) < 1.6), "cyan", 6)
    # the trunnion yoke the telescope swings in
    yoke = box(g, c - 11, 14, c - 23, c + 11, 20, c - 15, "iron", 5)
    P.flat(g, yoke, "iron", 5)
    P.flat(g, edges(yoke), "iron", 3)
    P.flat(g, yoke & (np.abs(X - c) > 9) & (np.abs(Y - 17) < 2), "gold", 6)
    return g


def scope() -> Grid:
    """The oversized telescope: a faceted white tube with copper rings, a
    glowing cyan objective and a finder box."""
    g = Grid(20, 52, 20)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    tube = S.disc(g, "y", 10, 10, 8, 4, 46, "bone", 6, n=10)
    facet_paint(g, g.solids[n0:], hull_on("bone", 6, size=(10, 11), seed=12))
    P.flat(g, edges(tube), "bone", 4)
    for yy in (10, 26, 40):
        P.flat(g, tube & (np.abs(Y - yy) < 1.6), "rust", 5)
        P.flat(g, tube & (np.abs(Y - yy) < 1.6) & (np.floor(X + Z) % 4 == 0), "rust", 6)
    cell = S.disc(g, "y", 10, 10, 9, 44, 48, "iron", 4, n=10)
    P.flat(g, cell, "iron", 4)
    P.flat(g, cell & (Y > 46.5), "iron", 2)
    lens = S.disc(g, "y", 10, 10, 7, 47, 48, "cyan", 5, n=10)
    P.flat(g, lens, "cyan", 5)
    P.flat(g, lens & (S.ngon_radius(g, "y", 10, 10, 10) < 4), "cyan", 6)
    P.flat(g, lens & (S.ngon_radius(g, "y", 10, 10, 10) < 2), "cyan", 7)
    base = S.disc(g, "y", 10, 10, 6, 0, 5, "steel", 5, n=10)
    P.flat(g, base, "steel", 5)
    P.flat(g, base & (Y < 1.5), "steel", 3)
    fs = box(g, 8, 30, 17, 13, 42, 20, "steel", 5)
    P.flat(g, fs, "steel", 5)
    P.flat(g, edges(fs), "steel", 3)
    P.flat(g, fs & (Y > 41), "cyan", 6)
    P.flat(g, fs & (np.abs(Y - 33) < 0.7), "orange", 5)
    return g


def build() -> Asset:
    root = Part("observatory", body())
    cup = root.add(Part("dome", dome(), pivot=(float(DR + 2), 0.0, float(DR + 2)), at=(float(DX), float(YD), float(DZ))))
    cup.add(Part("scope", scope(), pivot=(10.0, 2.0, 10.0), at=(0.0, 17.0, -19.0), rot=(-44.0, 0.0, 0.0)))
    idle = {
        "dome": {"rot": [(0.0, (0.0, -26.0, 0.0)), (6.0, (0.0, 26.0, 0.0)), (12.0, (0.0, -26.0, 0.0))]},
        "scope": {"rot": [(0.0, (-44.0, 0.0, 0.0)), (6.0, (-52.0, 0.0, 0.0)), (12.0, (-44.0, 0.0, 0.0))]},
    }
    return Asset(
        id="space-buildings-observatory", pack="space", category="buildings", name="Observatory", root=root,
        clips=[Clip("idle", idle)],
    )
