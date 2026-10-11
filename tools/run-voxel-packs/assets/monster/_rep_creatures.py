"""Art-director repair models (group: creatures).

Each creature has its own body code, its own proportions and one signature
shape. No two creatures share a chassis, legs or a cape:

- imp: the smallest (30 tall), a large head, bat wings and a spade tail.
- lich: tall and thin, a floating robe hem with no feet, a large staff.
- phantom knight: long legs, layered plate pauldrons, a big upright sword,
  ghost-teal trim and a cape that fades to teal.
- scarecrow fiend: thin pole legs, straw tufts, arms tied on a crossbar.
- swamp creature: hunched, long arms to the floor, fins on the back, head,
  forearms and calves.
- patchwork giant: a giant (about 75 tall) with mismatched arms and
  stitched skin patches.
- bone hound: a skeleton dog with a long skull snout, an open jaw with
  fangs, sunken glowing eye sockets and a spine ridge.

Detail is paint (S1, S2): robe folds, plate armour with rivets, scale
rows, straw streaks, patch seams and bone cracks, with dark frame lines
(S4). Every part faces -Z. Clips: idle, attack, hit, death. No clip pose
puts a part below the floor.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _kit import keys, pfx, world
from _life import assemble, bark, chunk, claw, coords, eyes, front, limb, octo, plan, rotate, side
from pnkit import box
from voxgrid import C, Clip, Grid, Socket

Z3 = (0.0, 0.0, 0.0)


# ------------------------------------------------------------------ painters


def folds(g: Grid, m: np.ndarray, ramp: str, base: int, period: int = 4, seed: int = 0) -> None:
    """Cloth folds: vertical bands with a lit ridge and a dark crease (S2)."""
    U, V = P.uv(g)
    ph = (U + seed) % period
    shade = base + np.where(ph == 0, -1, np.where(ph == period // 2, 1, 0))
    kink = (P._hash(U // period, V // 6, seed=seed) % np.uint64(4)) == 0
    shade = np.where(kink & (ph == 1), base - 1, shade)
    P._paint(g, m, ramp, shade)


def scales(g: Grid, m: np.ndarray, ramp: str, base: int, row: int = 3, width: int = 4, seed: int = 0) -> None:
    """Scale rows in running bond: a dark lower lip, a dark side line and a
    lit crown on each scale (S2, S4)."""
    U, V = P.uv(g)
    r = V // row
    u = U + (r % 2) * (width // 2)
    shade = base + P._jitter(P._hash(r, u // width, seed=seed))
    shade = np.where(u % width == 0, base - 1, shade)
    shade = np.where(V % row == 0, base - 2, shade)
    shade = np.where((V % row == row - 1) & (u % width == width // 2), base + 1, shade)
    P._paint(g, m, ramp, shade)


def patches(g: Grid, m: np.ndarray, skins, seed: int = 0, cell=(7, 6), seam=("blood", 3), stitch=("bone", 6)) -> None:
    """Mismatched stitched patches: each cell takes one skin from `skins`,
    with a dark seam and bone stitch dots on every border (S2, S4)."""
    U, V = P.uv(g)
    cw, ch = cell
    col = U // cw
    vv = V + (col % 2) * (ch // 2)
    row = vv // ch
    pick = (P._hash(col, row, seed=seed) % np.uint64(len(skins))).astype(np.int64)
    for i, (ramp, base) in enumerate(skins):
        P.mottle(g, m & (pick == i), ramp, base, cell=2, seed=seed + i)
    line = (U % cw == 0) | (vv % ch == 0)
    P.flat(g, m & line, *seam)
    P.flat(g, m & line & (((U + V) % 2) == 0), *stitch)


def bone(g: Grid, m: np.ndarray, base: int = 6, seed: int = 0) -> None:
    """Bone: soft mottle with a few short dark cracks."""
    P.mottle(g, m, "bone", base, cell=2, seed=seed)
    U, V = P.uv(g)
    cell = (P._hash(U // 6, V // 6, seed=seed + 1) % np.uint64(4)) == 0
    crack = cell & (((U % 6) - (V % 6)) == 0) & ((U % 6) > 0)
    P.flat(g, m & crack, "bone", base - 3)


def skin(g: Grid, m: np.ndarray, ramp: str, base: int, seed: int = 0) -> None:
    """Hide: soft mottle with a few darker warts."""
    P.mottle(g, m, ramp, base, cell=2, seed=seed)
    X, Y, Z = coords(g)
    wart = (P._hash(X // 2, Y // 2, Z // 2, seed=seed + 3) % np.uint64(23)) == 0
    P.flat(g, m & wart, ramp, base - 1)


def armour(g: Grid, m: np.ndarray, base: int = 5, size=(6, 5), seed: int = 0, ramp: str = "steel") -> None:
    """Plate armour: plates with a dark border and rivet dots (S2, S4)."""
    P.plates(g, m, ramp, base, size=size, seed=seed)


def straw(g: Grid, m: np.ndarray, base: int = 5, seed: int = 0) -> None:
    """Straw: vertical streaks with a darker tie band."""
    P.thatch(g, m, "gold", base, band=4, seed=seed)


def burlap(g: Grid, m: np.ndarray, base: int = 5, seed: int = 0) -> None:
    """Burlap sack cloth: woven rows and soft patches."""
    U, V = P.uv(g)
    shade = base + P._jitter(P._hash(U // 3, V // 2, seed=seed))
    shade = np.where(V % 3 == 0, base - 1, shade)
    P._paint(g, m, "sand", shade)


def loose(slug: str, parts: dict[str, Grid]) -> None:
    """Fail loudly if a part grid is empty (a typo in a coordinate)."""
    for name, g in parts.items():
        if not g.a.any():
            raise ValueError(f"{slug}: part {name!r} has no voxels")


def clips(idle, attack, hit, death) -> list[Clip]:
    return [Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)]


def rel(p, root) -> tuple[float, float, float]:
    """A point in the shared frame, in root pivot space."""
    return (p[0] - root[0], p[1] - root[1], p[2] - root[2])


# ------------------------------------------------------------------ imp


def _imp():
    """A small magenta imp: a big head with an angry brow, a wide fanged
    grin, pointed ears and horns, a pot belly, bat wings and a spade tail."""
    size = (46, 34, 38)
    CX, CZ = 23.0, 16.0
    SK = "magenta"
    HIP = (CX, 8.0, CZ)
    NECK = (CX, 15.5, CZ)
    SH = {-1: (CX - 5.0, 14.5, CZ), 1: (CX + 5.0, 14.5, CZ)}
    WING = {-1: (CX - 2.5, 15.5, CZ + 4.8), 1: (CX + 2.5, 15.5, CZ + 4.8)}
    TAIL = (CX, 7.5, CZ + 5.0)

    body = Grid(*size)
    X, Y, Z = coords(body)
    belly = chunk(body, CX, CZ, 5.5, 16.5, 6.5, 5.5, 2.0, SK, 4, taper=1.5)
    legs = np.zeros(body.shape, dtype=bool)
    feet = np.zeros(body.shape, dtype=bool)
    for s in (-1, 1):
        x = CX + s * 3.2
        legs |= side(body, S.quad((8, CZ), (4.5, CZ - 2.5), 2.4, 2.0, cap=0.5), x - 2.1, x + 2.1, SK, 4)
        legs |= side(body, S.quad((4.6, CZ - 2.5), (1.8, CZ + 0.5), 1.8, 1.5, cap=0.5), x - 1.6, x + 1.6, SK, 4)
        feet |= box(body, x - 2.2, 0, CZ - 3.5, x + 2.2, 2, CZ + 1.5, SK, 3)
        for xx in (x - 1.1, x + 1.1):
            claw(body, "x", (1.2, CZ - 3.0), (0.2, CZ - 6.0), 1.0, xx - 0.6, xx + 0.6, "bone", 6)
    cloth = front(body, [(CX - 4, 9.5), (CX + 4, 9.5), (CX + 3.5, 5), (CX + 1.5, 6.5), (CX, 4), (CX - 1.5, 6.5), (CX - 3.5, 5)], CZ - 6.2, CZ - 4.6, "purple", 3)
    skin(body, belly | legs, SK, 4, seed=1)
    P.mottle(body, feet, SK, 3, cell=2, seed=2)
    # A segmented pink belly plate and a rope belt (S2).
    plate = belly & (Z < CZ - 2.5) & (np.abs(X + 0.5 - CX) < 4.2) & (Y > 9) & (Y < 15)
    P.flat(body, plate, "pink", 5)
    P.flat(body, plate & (Y % 2 == 0), "pink", 4)
    P.outline(body, plate, SK, 3, normal="z")
    band = belly & (Y >= 8) & (Y < 9.5)
    P.flat(body, band, "sand", 4)
    P.flat(body, band & ((X + Z) % 3 == 0), "sand", 2)
    folds(body, cloth, "purple", 3, period=3, seed=3)
    P.flat(body, cloth & (Y >= 8.5), "gold", 4)
    P.flat(body, legs & (Y < 5) & (Z < CZ - 3), SK, 5)  # lit knees

    head = Grid(*size)
    X, Y, Z = coords(head)
    skull = chunk(head, CX, CZ - 0.5, 15.5, 26.5, 8.0, 6.5, 2.5, SK, 4, taper=1.2)
    brow = front(head, [(CX - 7.4, 24.4), (CX + 7.4, 24.4), (CX + 7.0, 26.3), (CX + 1.0, 25.2), (CX - 1.0, 25.2), (CX - 7.0, 26.3)], CZ - 7.6, CZ - 4.0, SK, 3)
    ears = np.zeros(head.shape, dtype=bool)
    horns = np.zeros(head.shape, dtype=bool)
    for s in (-1, 1):
        ears |= front(head, [(CX + s * 7.6, 24.0), (CX + s * 7.6, 19.5), (CX + s * 14.5, 25.5)], CZ - 2.0, CZ + 1.0, SK, 3)
        horns |= front(head, [(CX + s * 2.5, 25.8), (CX + s * 6.0, 25.8), (CX + s * 7.2, 30.0), (CX + s * 5.2, 28.2)], CZ - 1.5, CZ + 1.5, "bone", 5)
    skin(head, skull, SK, 4, seed=4)
    P.mottle(head, brow, SK, 3, cell=2, seed=5)
    P.flat(head, ears, SK, 4)
    P.flat(head, ears & (Z < CZ - 1.0) & (Y > 20.5) & (np.abs(X + 0.5 - CX) > 8.6), "purple", 3)  # inner ear
    P.mottle(head, horns, "bone", 5, cell=2, seed=6)
    P.flat(head, horns & (Y.astype(int) % 2 == 0), "bone", 4)  # horn rings
    P.flat(head, horns & (Y > 28.5), "bone", 7)
    eyes(head, "-z", CZ - 6.6, int(CX - 6), 19, 2, size=3, glow=("toxic", 6), rim=("purple", 1), depth=3)
    grin = ["rrrrrrrrrr", "rwrrrrrrwr", ".rrwrrwrr."]
    pnglyph.stamp(head, "-z", CZ - 7.0, int(CX - 5), 16, grin, {"r": C("blood", 2), "w": C("bone", 7)}, depth=2, reach=3)
    pnglyph.stamp(head, "-z", CZ - 7.0, int(CX - 1), 18, ["k..k"], {"k": C(SK, 2)}, depth=1, reach=3)  # nostrils

    arms = {}
    for s, name in ((-1, "arm-l"), (1, "arm-r")):
        g = Grid(*size)
        X, Y, Z = coords(g)
        x = CX + s * 8.0
        m = limb(g, "z", (CX + s * 5.0, 14.8), (x, 10.5), 1.7, 1.4, CZ - 1.5, CZ + 1.5, SK, 4)
        m |= limb(g, "x", (11.0, CZ), (8.6, CZ - 5.0), 1.4, 1.2, x - 1.3, x + 1.3, SK, 4)
        hand = box(g, x - 1.5, 7, CZ - 7.5, x + 1.5, 10, CZ - 4.5, SK, 3)
        for k in range(3):
            xx = int(x - 1.5) + k + 0.5
            claw(g, "x", (7.8, CZ - 7.0), (5.6, CZ - 9.6), 0.8, xx - 0.5, xx + 0.5, "bone", 6)
        skin(g, m, SK, 4, seed=7 + s)
        P.mottle(g, hand, SK, 3, cell=2, seed=9 + s)
        P.flat(g, hand & (Z < CZ - 6.5), "toxic", 5)  # a cursed glow in the palms (C3)
        P.flat(g, hand & (Z < CZ - 6.5) & (Y == 8), "toxic", 7)
        arms[name] = g

    wings = {}
    for s, name in ((-1, "wing-l"), (1, "wing-r")):
        g = Grid(*size)
        pts = [(2.5, 13), (7, 10.5), (10.5, 6.5), (13, 11.5), (18.5, 10), (17, 15.5), (21, 18.5), (18, 21.5), (20, 27), (10, 26), (2.5, 17.5)]
        web = front(g, [(CX + s * dx, y) for dx, y in pts], CZ + 4.2, CZ + 5.4, "purple", 3)
        P.mottle(g, web, "purple", 3, cell=3, seed=11 + s)
        P.outline(g, web, "purple", 2, normal="z")  # a dark rim on the scalloped edge (S4)
        X, Y, Z = coords(g)
        P.flat(g, web & (np.abs(X + 0.5 - CX) < 6), "magenta", 3)  # warm root near the back
        bones = S.bar(g, "z", (CX + s * 2.5, 16), (CX + s * 10, 25.5), 1.6, CZ + 3.9, CZ + 5.9, "bone", 6)
        for tx, ty in ((20, 27), (21, 18.5), (18.5, 10), (10.5, 6.5)):
            bones |= S.bar(g, "z", (CX + s * 10, 25.5), (CX + s * tx, ty), 1.2, CZ + 3.9, CZ + 5.9, "bone", 5)
        bones |= claw(g, "z", (CX + s * 10, 25.5), (CX + s * 11.5, 29.5), 0.9, CZ + 3.9, CZ + 5.9, "bone", 6)
        P.mottle(g, bones, "bone", 5, cell=2, seed=13 + s)
        P.flat(g, bones & (np.abs(X + 0.5 - (CX + s * 10)) < 1.2) & (np.abs(Y - 25.5) < 1.2), "bone", 7)  # wrist knuckle
        wings[name] = g

    tail = Grid(*size)
    X, Y, Z = coords(tail)
    t = limb(tail, "x", (7.5, CZ + 5), (4.0, CZ + 10), 1.4, 1.2, CX - 1.2, CX + 1.2, SK, 4)
    t |= limb(tail, "x", (4.0, CZ + 10), (5.5, CZ + 15), 1.2, 1.0, CX - 1.0, CX + 1.0, SK, 4)
    t |= limb(tail, "x", (5.5, CZ + 15), (10.0, CZ + 18), 1.0, 0.9, CX - 1.0, CX + 1.0, SK, 4)
    spade = side(tail, [(9.0, CZ + 17), (11.5, CZ + 16.5), (15.0, CZ + 20.5), (11.0, CZ + 20.0)], CX - 1.8, CX + 1.8, "purple", 3)
    skin(tail, t, SK, 4, seed=15)
    P.flat(tail, spade, "purple", 3)
    P.outline(tail, spade, "purple", 2, normal="x")
    P.flat(tail, spade & (Y > 13.5), "toxic", 5)

    parts = {"body": body, "head": head, "arm-l": arms["arm-l"], "arm-r": arms["arm-r"], "wing-l": wings["wing-l"], "wing-r": wings["wing-r"], "tail": tail}
    loose("imp", parts)
    root = assemble(parts, [
        ("body", None, HIP), ("head", "body", NECK),
        ("arm-l", "body", SH[-1]), ("arm-r", "body", SH[1]),
        ("wing-l", "body", WING[-1]), ("wing-r", "body", WING[1]), ("tail", "body", TAIL),
    ])
    idle = {"body": {"loc": keys((0, Z3), (0.6, (0, 0.5, 0)), (1.2, Z3))},
            "head": {"rot": keys((0, (0, 0, 5)), (0.6, (0, 0, -5)), (1.2, (0, 0, 5)))},
            "wing-l": {"rot": keys((0, Z3), (0.3, (0, 0, -14)), (0.6, Z3), (0.9, (0, 0, -14)), (1.2, Z3))},
            "wing-r": {"rot": keys((0, Z3), (0.3, (0, 0, 14)), (0.6, Z3), (0.9, (0, 0, 14)), (1.2, Z3))},
            "tail": {"rot": keys((0, (0, -12, 0)), (0.6, (0, 12, 0)), (1.2, (0, -12, 0)))}}
    attack = {"body": {"rot": keys((0, Z3), (0.24, (6, 18, -14)), (0.45, (-12, -18, 16)), (0.62, (-4, 8, -8)), (0.9, Z3)),
                       "loc": keys((0, Z3), (0.24, (-2, 2.5, 2)), (0.45, (3, 1.5, -5)), (0.62, (-1, 2, -3)), (0.9, Z3))},
              "arm-l": {"rot": keys((0, Z3), (0.24, (55, 0, -18)), (0.45, (90, 0, -25)), (0.62, (35, 0, 12)), (0.9, Z3))},
              "arm-r": {"rot": keys((0, Z3), (0.24, (110, 0, 18)), (0.45, (45, 0, -12)), (0.62, (15, 0, 0)), (0.9, Z3))},
              "wing-l": {"rot": keys((0, Z3), (0.24, (0, 0, -38)), (0.45, (0, 0, 18)), (0.62, (0, 0, -20)), (0.9, Z3))},
              "wing-r": {"rot": keys((0, Z3), (0.24, (0, 0, 22)), (0.45, (0, 0, -32)), (0.62, (0, 0, 16)), (0.9, Z3))},
              "head": {"rot": keys((0, Z3), (0.24, (0, -12, 8)), (0.45, (-10, 12, -8)), (0.9, Z3))}}
    hit = {"body": {"rot": keys((0, Z3), (0.1, (12, 0, 8)), (0.45, Z3)), "loc": keys((0, Z3), (0.1, (0, 1.2, 1.5)), (0.45, Z3))},
           "head": {"rot": keys((0, Z3), (0.1, (-14, 8, 0)), (0.45, Z3))}}
    death = {"body": {"rot": keys((0, Z3), (0.35, (10, 0, 0)), (0.8, (-84, 0, 0)), (1.0, (-82, 0, 0))),
                      "loc": keys((0, Z3), (0.35, (0, 1.5, 0)), (0.8, (0, 1.0, -5)), (1.0, (0, 1.0, -5)))},
             "wing-l": {"rot": keys((0, Z3), (1.0, (0, 0, 22)))}, "wing-r": {"rot": keys((0, Z3), (1.0, (0, 0, -22)))},
             "head": {"rot": keys((0, Z3), (1.0, (10, 0, 20)))}, "tail": {"rot": keys((0, Z3), (1.0, (-30, 0, 0)))}}
    sockets = [Socket("socket-chest", at=rel((CX, 12.5, CZ - 5.0), HIP), parent="body"),
               Socket("socket-mouth", at=rel((CX, 17.0, CZ - 7.0), HIP), parent="head"),
               Socket("socket-hands", at=rel((CX, 8.5, CZ - 10.0), HIP), parent="body")]
    return world("imp", "creatures", "Imp", root, clips=clips(idle, attack, hit, death), sockets=sockets,
                 pfx=[pfx("rvx-monster-curse-cloud", "socket-hands", "clip:attack", size=24, at=0.45)])


# ------------------------------------------------------------------ lich


def _lich():
    """A tall thin lich: a crowned skull, a high fan collar, a robe that
    flares to a tattered hem above the floor (no feet), bony hands and a
    staff taller than the lich with a teal orb."""
    size = (36, 46, 30)
    CX, CZ = 17.0, 15.0
    ROBE = "purple"
    BODY = (CX, 3.0, CZ)
    NECK = (CX, 30.0, CZ)
    SH = {-1: (CX - 6.0, 28.5, CZ), 1: (CX + 6.0, 28.5, CZ)}

    body = Grid(*size)
    X, Y, Z = coords(body)
    skirt = plan(body, octo(CX, CZ, 7.5, 5.5, 2.2), 4.5, 18, ROBE, 3, top=octo(CX, CZ, 5.0, 4.0, 1.5))
    chest = plan(body, octo(CX, CZ, 5.0, 4.0, 1.5), 18, 28, ROBE, 3, top=octo(CX, CZ + 0.3, 6.5, 4.5, 2.0))
    yoke = plan(body, octo(CX, CZ + 0.3, 6.5, 4.5, 2.0), 28, 31, ROBE, 3, top=octo(CX, CZ + 0.5, 4.0, 3.5, 1.2))
    tatters = np.zeros(body.shape, dtype=bool)
    hem = [(CX - 5, CZ - 4.7), (CX - 2, CZ - 4.7), (CX + 1, CZ - 4.7), (CX + 4, CZ - 4.7),
           (CX - 4, CZ + 4.7), (CX - 1, CZ + 4.7), (CX + 2, CZ + 4.7), (CX + 5, CZ + 4.7),
           (CX - 6.7, CZ - 1.6), (CX - 6.7, CZ + 1.8), (CX + 6.7, CZ - 1.6), (CX + 6.7, CZ + 1.8)]
    for k, (px, pz) in enumerate(hem):
        tip = 2.0 + (k % 3) * 0.6
        tatters |= plan(body, [(px, pz)] * 4, tip, 5.0, ROBE, 2, top=[(px - 1.3, pz - 0.9), (px + 1.3, pz - 0.9), (px + 1.3, pz + 0.9), (px - 1.3, pz + 0.9)])
    collar = front(body, [(CX - 6, 29), (CX + 6, 29), (CX + 9.5, 39.5), (CX + 6, 37), (CX + 3, 39), (CX, 36.5), (CX - 3, 39), (CX - 6, 37), (CX - 9.5, 39.5)], CZ + 3.6, CZ + 5.4, ROBE, 2)
    robe = skirt | chest | yoke
    folds(body, robe, ROBE, 3, period=4, seed=1)
    folds(body, tatters, ROBE, 2, period=3, seed=2)
    P.flat(body, yoke & (Y > 29.5), ROBE, 4)  # lit shoulders
    # The gold hem trim with a dark line above it (S4).
    P.flat(body, skirt & (Y < 6.5), "gold", 4)
    P.flat(body, skirt & (Y < 6.5) & ((X + Z) % 4 == 0), "gold", 6)
    P.flat(body, skirt & (Y >= 6.5) & (Y < 7.5), ROBE, 1)
    # A magenta front panel with gold rune dots down the skirt.
    panel = skirt & (Z < CZ - 3) & (np.abs(X + 0.5 - CX) < 2.2) & (Y >= 7.5)
    P.flat(body, panel, "magenta", 4)
    P.flat(body, panel & (np.abs(X + 0.5 - CX) >= 1.6), "gold", 4)
    P.flat(body, panel & (np.abs(X + 0.5 - CX) < 0.8) & (Y % 3 == 0), "gold", 6)
    # A bone sash with vertebra marks.
    sash = (skirt | chest) & (Y >= 17) & (Y < 19)
    P.flat(body, sash, "bone", 5)
    P.flat(body, sash & ((X + Z) % 2 == 0), "bone", 3)
    # The open chest shows the ribs and the glowing phylactery (C3).
    ribs = chest & (Z < CZ - 3.0) & (np.abs(X + 0.5 - CX) < 3.0) & (Y >= 20) & (Y < 27)
    P.flat(body, ribs, ROBE, 1)
    P.flat(body, ribs & (Y % 2 == 0) & (np.abs(X + 0.5 - CX) > 0.6), "bone", 6)
    P.flat(body, ribs & (np.abs(X + 0.5 - CX) < 0.6), "bone", 5)
    P.flat(body, ribs & (Y >= 22) & (Y < 24) & (np.abs(X + 0.5 - CX) < 1.6), "teal", 7)
    P.outline(body, ribs, "gold", 4, normal="z")
    # The fan collar: a dark inside with a gold rim and bone ribs.
    P.flat(body, collar, ROBE, 2)
    P.flat(body, collar & (X.astype(int) % 3 == 0) & (Y > 31), "bone", 5)
    P.outline(body, collar, "gold", 4, normal="z")

    head = Grid(*size)
    X, Y, Z = coords(head)
    sk = S.skull(head, CX, 30, CZ - 0.5, s=8, eyes=("teal", 7), socket=("purple", 1), seed=3)
    U, V = P.uv(head)
    P.flat(head, sk & (Y > 37) & (((U % 5) - (V % 5)) == 0) & (U % 5 > 1), "bone", 3)  # skull cracks
    crown = plan(head, octo(CX, CZ - 0.5, 4.4, 3.9, 1.6), 37, 38.5, "gold", 4)
    spikes = np.zeros(head.shape, dtype=bool)
    for dx, top in ((-3.0, 41.6), (0.0, 43.4), (3.0, 41.6)):
        spikes |= front(head, [(CX + dx - 1.1, 38.4), (CX + dx + 1.1, 38.4), (CX + dx, top)], CZ - 4.5, CZ - 3.1, "gold", 5)
    for s in (-1, 1):
        spikes |= side(head, [(38.4, CZ - 2.5), (38.4, CZ + 1.5), (41.0, CZ - 0.5)], CX + s * 4.0 - 0.7, CX + s * 4.0 + 0.7, "gold", 5)
    P.flat(head, crown & ((X + Z) % 3 == 0), "gold", 6)
    P.flat(head, crown & (Y < 37.5), "gold", 2)
    P.flat(head, crown & (Z < CZ - 4) & (np.abs(X + 0.5 - CX) < 1.2), "teal", 7)
    P.flat(head, spikes & (Y > 40), "gold", 6)

    arms = {}
    for s, name in ((-1, "arm-l"), (1, "arm-r")):
        g = Grid(*size)
        X, Y, Z = coords(g)
        end = (CX + s * 9.0, 19.5) if s < 0 else (CX + s * 9.5, 21.5)
        sleeve = limb(g, "z", (CX + s * 6.0, 28.5), end, 1.8, 3.0, CZ - 2.6, CZ + 2.6, ROBE, 3, cap=0.2)
        folds(g, sleeve, ROBE, 3, period=3, seed=4 + s)
        P.flat(g, sleeve & (Y < end[1] + 1.5), "gold", 4)  # cuff trim
        P.flat(g, sleeve & (Y >= end[1] + 1.5) & (Y < end[1] + 2.5), ROBE, 1)
        if s < 0:
            hand = box(g, CX - 11, 15, CZ - 1, CX - 8, 18.5, CZ + 2, "bone", 6)
            fingers = np.zeros(g.shape, dtype=bool)
            for xx in (CX - 10.5, CX - 9.5, CX - 8.5):
                fingers |= claw(g, "z", (xx, 15.2), (xx, 12.2), 0.7, CZ - 1.0, CZ + 1.0, "bone", 6)
            bone(g, hand, 6, seed=6)
            P.flat(g, fingers, "bone", 6)
            P.flat(g, fingers & (Y < 14), "teal", 6)  # cold magic on the finger tips
        else:
            SX = CX + 11.0
            staff = S.bar(g, "z", (SX, 0), (SX, 39.5), 2.0, CZ - 2.6, CZ - 0.6, "darkwood", 4)
            bark(g, staff, "darkwood", 4, seed=7)
            for y0 in (9, 30, 36):
                P.flat(g, staff & (Y >= y0) & (Y < y0 + 1), "gold", 5)
            hand = box(g, SX - 2, 19, CZ - 3.6, SX + 2, 23, CZ + 0.4, "bone", 6)
            bone(g, hand, 6, seed=8)
            P.flat(g, hand & (Y == 21), "bone", 4)  # knuckle line
            prongs = claw(g, "z", (SX - 1.6, 38.0), (SX - 2.6, 43.4), 0.9, CZ - 2.4, CZ - 0.8, "gold", 5)
            prongs |= claw(g, "z", (SX + 1.6, 38.0), (SX + 2.6, 43.4), 0.9, CZ - 2.4, CZ - 0.8, "gold", 5)
            P.flat(g, prongs & (Y > 41), "gold", 7)
            orb = S.disc(g, "z", SX, 41.1, 2.3, CZ - 3.0, CZ - 0.2, "teal", 6, n=8)
            P.outline(g, orb, "teal", 4, normal="z")
            P.flat(g, orb & (X < SX) & (Y > 41.5) & (Y < 43), "teal", 7)
        arms[name] = g

    parts = {"body": body, "head": head, "arm-l": arms["arm-l"], "arm-r": arms["arm-r"]}
    loose("lich", parts)
    root = assemble(parts, [("body", None, BODY), ("head", "body", NECK), ("arm-l", "body", SH[-1]), ("arm-r", "body", SH[1])])
    idle = {"body": {"loc": keys((0, Z3), (1.2, (0, 1.0, 0)), (2.4, Z3))},
            "head": {"rot": keys((0, Z3), (0.6, (0, 8, 0)), (1.8, (0, -8, 0)), (2.4, Z3))},
            "arm-l": {"rot": keys((0, Z3), (1.2, (10, 0, -6)), (2.4, Z3))}}
    attack = {"arm-l": {"rot": keys((0, Z3), (0.3, (-115, -12, -20)), (0.5, (-90, 18, -30)), (0.68, (-85, 8, -18)), (1.05, Z3))},
              "arm-r": {"rot": keys((0, Z3), (0.3, (-4, 0, 10)), (0.5, (2, 0, -8)), (1.05, Z3))},
              "body": {"rot": keys((0, Z3), (0.3, (0, -14, 0)), (0.5, (-7, 18, 0)), (1.05, Z3)),
                       "loc": keys((0, Z3), (0.5, (0, 3.0, -2)), (0.68, (0, 3.0, -2)), (1.05, Z3))},
              "head": {"rot": keys((0, Z3), (0.3, (0, -14, 0)), (0.5, (-8, 18, 0)), (1.05, Z3))}}
    hit = {"body": {"rot": keys((0, Z3), (0.1, (10, 0, -6)), (0.45, Z3)), "loc": keys((0, Z3), (0.1, (0, 0.6, 1)), (0.45, Z3))},
           "head": {"rot": keys((0, Z3), (0.1, (-16, 10, 0)), (0.45, Z3))}}
    death = {"body": {"rot": keys((0, Z3), (0.4, (-12, 0, 0)), (0.9, (-82, 0, 0))),
                      "loc": keys((0, Z3), (0.4, (0, 0.8, 0)), (0.9, (0, 2.0, -6)))},
             "head": {"rot": keys((0, Z3), (0.9, (30, 0, 15)))},
             "arm-r": {"rot": keys((0, Z3), (0.9, (0, 0, 35)))}, "arm-l": {"rot": keys((0, Z3), (0.9, (40, 0, -20)))}}
    sockets = [Socket("socket-chest", at=rel((CX, 23.0, CZ - 4.5), BODY), parent="body"),
               Socket("socket-mouth", at=rel((CX, 32.5, CZ - 4.2), BODY), parent="head"),
               Socket("socket-hands", at=rel((CX - 9.5, 14.0, CZ - 2.0), BODY), parent="body")]
    return world("lich", "creatures", "Lich", root, clips=clips(idle, attack, hit, death), sockets=sockets,
                 pfx=[pfx("rvx-monster-soul-burst", "socket-chest", "clip:death", size=54, at=0.85)])


# ------------------------------------------------------------------ phantom knight


def _phantom_knight():
    """A tall phantom knight: long plate legs, a flared plate skirt, a
    V-shaped breastplate, layered pauldrons, a great helm with a glowing
    visor and a ghost plume, a big upright sword, and a cape that fades
    to ghost teal."""
    size = (46, 46, 36)
    CX, CZ = 23.0, 18.0
    AR = "steel"
    HIP = (CX, 21.0, CZ)
    LEGJ = {-1: (CX - 4.2, 20.0, CZ), 1: (CX + 4.2, 20.0, CZ)}
    WAIST = (CX, 22.0, CZ)
    NECK = (CX, 32.5, CZ - 0.5)
    SH = {-1: (CX - 9.5, 30.0, CZ), 1: (CX + 9.5, 30.0, CZ)}
    CAPE = (CX, 32.0, CZ + 5.5)
    SX, SZ = CX + 12.0, CZ - 7.0  # the sword axis

    legs = {}
    for s, name in ((-1, "leg-l"), (1, "leg-r")):
        g = Grid(*size)
        X, Y, Z = coords(g)
        x = CX + s * 4.2
        thigh = limb(g, "x", (21, CZ), (11.5, CZ - 0.6), 2.8, 2.4, x - 2.6, x + 2.6, AR, 5, cap=0.3)
        shin = limb(g, "x", (11, CZ - 0.6), (3.2, CZ + 0.2), 2.4, 2.1, x - 2.4, x + 2.4, AR, 5, cap=0.3)
        knee = plan(g, octo(x, CZ - 1.2, 2.9, 2.6, 1.0), 9.8, 13.2, AR, 6, top=octo(x, CZ - 1.2, 2.3, 2.1, 0.8))
        foot = side(g, [(0, CZ - 7), (0, CZ + 3), (4, CZ + 3), (4.2, CZ - 2.5), (1.8, CZ - 7)], x - 2.6, x + 2.6, AR, 4)
        armour(g, thigh | shin, 5, size=(5, 4), seed=1 + s)
        scales(g, foot, AR, 4, row=2, width=6, seed=2 + s)
        P.mottle(g, knee, AR, 6, cell=2, seed=3)
        P.flat(g, knee & (Y < 10.8), "teal", 5)
        P.flat(g, knee & (Z < CZ - 3.4) & (np.abs(X + 0.5 - x) < 0.8) & (np.abs(Y - 11.5) < 0.8), "gold", 5)
        P.flat(g, shin & (Y < 4.5), "teal", 5)  # greave trim
        P.flat(g, shin & (Y >= 9.5) & (Y < 10.5), "teal", 7)  # the ghost glows through the knee gap
        P.flat(g, foot & (Y >= 3.2), "teal", 5)
        legs[name] = g

    hips = Grid(*size)
    X, Y, Z = coords(hips)
    faulds = plan(hips, octo(CX, CZ, 7.6, 5.2, 2.0), 14.5, 22.5, AR, 5, top=octo(CX, CZ, 6.4, 4.6, 1.6))
    belt = plan(hips, octo(CX, CZ, 6.8, 4.9, 1.7), 21.5, 23.2, "gold", 4)
    scales(hips, faulds, AR, 5, row=3, width=8, seed=4)
    P.flat(hips, faulds & (Y < 15.5), "teal", 5)
    P.flat(hips, belt & ((X + Z) % 3 == 0), "gold", 6)
    P.flat(hips, belt & (Z < CZ - 4.5) & (np.abs(X + 0.5 - CX) < 1.2), "teal", 7)

    torso = Grid(*size)
    X, Y, Z = coords(torso)
    breast = plan(torso, octo(CX, CZ, 6.2, 4.4, 1.8), 22, 30, AR, 5, top=octo(CX, CZ - 0.4, 8.6, 5.2, 2.4))
    gorget = plan(torso, octo(CX, CZ - 0.4, 8.6, 5.2, 2.4), 30, 32.6, AR, 5, top=octo(CX, CZ, 4.8, 3.8, 1.4))
    armour(torso, breast, 5, size=(7, 4), seed=5)
    scales(torso, gorget, AR, 6, row=2, width=9, seed=6)
    P.flat(torso, breast & (Z < CZ - 3.5) & (np.abs(X + 0.5 - CX) < 0.8), AR, 7)  # the centre ridge
    P.flat(torso, breast & (Y >= 29), "teal", 5)
    sigil = ["..g..", ".gGg.", "gGGGg", ".gGg.", "..g.."]
    pnglyph.stamp(torso, "-z", CZ - 4.8, int(CX - 2), 23, sigil, {"g": C("teal", 6), "G": C("teal", 7)}, depth=2, reach=3)

    head = Grid(*size)
    X, Y, Z = coords(head)
    helm = chunk(head, CX, CZ - 0.5, 32.2, 40.2, 4.6, 4.6, 1.5, AR, 5, taper=0.6)
    plume = side(head, [(39.5, CZ - 3.0), (41.8, CZ - 4.2), (43.8, CZ - 1.5), (42.6, CZ + 0.5), (43.6, CZ + 3.2), (41.6, CZ + 5.5), (42.6, CZ + 8.5), (39.5, CZ + 4.5)], CX - 1.1, CX + 1.1, "teal", 5)
    armour(head, helm, 5, size=(5, 4), seed=7)
    front_face = helm & (Z < CZ - 3.8)
    P.flat(head, front_face & (Y >= 35.5) & (Y < 37) & (np.abs(X + 0.5 - CX) < 3.6), "teal", 7)  # the visor slit
    P.flat(head, front_face & (((Y >= 34.8) & (Y < 35.5)) | ((Y >= 37) & (Y < 37.6))) & (np.abs(X + 0.5 - CX) < 4.2), AR, 2)
    P.flat(head, front_face & (Y >= 33) & (Y < 34.5) & (X % 2 == 0) & (np.abs(X + 0.5 - CX) < 3), AR, 2)
    P.flat(head, helm & (Y >= 39.2), "teal", 5)
    U, V = P.uv(head)
    P.flat(head, plume & (Y > 42), "teal", 7)
    P.flat(head, plume & (Y <= 42) & (((U + V) % 3) == 0), "teal", 6)
    P.outline(head, plume, "teal", 3, normal="x")

    arms = {}
    for s, name in ((-1, "arm-l"), (1, "arm-r")):
        g = Grid(*size)
        X, Y, Z = coords(g)
        p1 = plan(g, octo(CX + s * 10.2, CZ, 4.3, 5.0, 1.6), 29.6, 34.0, AR, 6, top=octo(CX + s * 9.4, CZ, 2.6, 3.4, 1.0))
        p2 = plan(g, octo(CX + s * 11.0, CZ, 4.4, 5.2, 1.6), 27.6, 29.8, AR, 5)
        p3 = plan(g, octo(CX + s * 11.8, CZ, 4.0, 4.8, 1.5), 25.6, 27.8, AR, 5)
        armour(g, p1, 6, size=(5, 4), seed=8 + s)
        scales(g, p2 | p3, AR, 5, row=2, width=7, seed=9 + s)
        for lame, y0 in ((p1, 29.6), (p2, 27.6), (p3, 25.6)):
            P.flat(g, lame & (Y < y0 + 1), "teal", 5)
        P.flat(g, p1 & (Y > 32.6), AR, 7)
        upper = limb(g, "z", (CX + s * 10.8, 27), (CX + s * 11.6, 20.5), 2.1, 1.9, CZ - 2, CZ + 2, AR, 4)
        elbow = plan(g, octo(CX + s * 11.6, CZ - 0.3, 2.4, 2.4, 0.9), 19.2, 22, AR, 6)
        armour(g, upper, 4, size=(4, 4), seed=10 + s)
        P.mottle(g, elbow, AR, 6, cell=2, seed=11)
        P.flat(g, elbow & (Y < 20), "teal", 6)
        if s < 0:
            fore = limb(g, "z", (CX - 11.6, 20.5), (CX - 11.8, 14), 1.9, 1.7, CZ - 2, CZ + 2, AR, 4)
            fist = box(g, CX - 14, 10, CZ - 2, CX - 10, 14.5, CZ + 2, AR, 4)
            armour(g, fore, 4, size=(4, 3), seed=12)
            scales(g, fist, AR, 4, row=2, width=4, seed=13)
            P.flat(g, fore & (Y < 15.5), "teal", 5)
        else:
            fore = limb(g, "x", (20.5, CZ), (18.0, CZ - 6.5), 1.9, 1.7, CX + 11.6 - 2.0, CX + 11.6 + 2.0, AR, 4)
            fist = box(g, SX - 2, 16, SZ - 2, SX + 2, 20, SZ + 2, AR, 4)
            armour(g, fore, 4, size=(4, 3), seed=12)
            scales(g, fist, AR, 4, row=2, width=4, seed=13)
            grip = box(g, SX - 1, 13, SZ - 1, SX + 1, 22, SZ + 1, "darkwood", 3)
            P.flat(g, grip & (Y % 2 == 0), "darkwood", 4)
            pommel = plan(g, octo(SX, SZ, 1.6, 1.6, 0.6), 11.6, 13.2, "gold", 5)
            guard = front(g, [(SX - 4.5, 22), (SX + 4.5, 22), (SX + 5.0, 23.6), (SX - 5.0, 23.6)], SZ - 1.2, SZ + 1.2, "gold", 4)
            blade = front(g, [(SX - 2.2, 23.6), (SX + 2.2, 23.6), (SX + 1.8, 40), (SX, 43.4), (SX - 1.8, 40)], SZ - 0.8, SZ + 0.8, "steel", 6)
            P.flat(g, pommel, "gold", 6)
            P.flat(g, guard & ((X + Y) % 3 == 0), "gold", 6)
            P.outline(g, guard, "gold", 2, normal="z")
            P.flat(g, guard & (np.abs(X + 0.5 - SX) < 1.0), "teal", 7)
            P.flat(g, blade & (np.abs(X + 0.5 - SX) > 1.3), "steel", 7)  # honed edges
            fuller = blade & (np.abs(X + 0.5 - SX) < 0.8) & (Y < 39)
            P.flat(g, fuller, "steel", 4)
            P.flat(g, fuller & (Y % 4 == 0), "teal", 7)  # ghost runes in the fuller
        arms[name] = g

    cape = Grid(*size)
    X, Y, Z = coords(cape)
    pts = [(CX - 7.5, 32.5), (CX + 7.5, 32.5), (CX + 9, 9), (CX + 7, 11.5), (CX + 5, 7), (CX + 3, 10.5), (CX + 1, 6),
           (CX - 1, 9.5), (CX - 3, 6.5), (CX - 5, 10.5), (CX - 7, 7), (CX - 9, 9.5)]
    cloth = front(cape, pts, CZ + 5.6, CZ + 7.0, "purple", 3)
    clasp = plan(cape, octo(CX, CZ + 4.6, 5.5, 1.4, 0.5), 30.5, 32.8, "gold", 4)
    folds(cape, cloth & (Y > 21), "purple", 3, period=4, seed=14)
    folds(cape, cloth & (Y <= 21) & (Y > 13), "teal", 3, period=4, seed=14)
    folds(cape, cloth & (Y <= 13), "teal", 5, period=4, seed=14)
    P.flat(cape, cloth & (Y <= 9), "teal", 6)
    P.flat(cape, cloth & (Y > 21) & (Y <= 22), "teal", 4)
    P.flat(cape, clasp & (X % 2 == 0), "gold", 6)

    parts = {"hips": hips, "leg-l": legs["leg-l"], "leg-r": legs["leg-r"], "torso": torso, "head": head,
             "arm-l": arms["arm-l"], "arm-r": arms["arm-r"], "cape": cape}
    loose("phantom-knight", parts)
    root = assemble(parts, [
        ("hips", None, HIP), ("leg-l", "hips", LEGJ[-1]), ("leg-r", "hips", LEGJ[1]),
        ("torso", "hips", WAIST), ("head", "torso", NECK),
        ("arm-l", "torso", SH[-1]), ("arm-r", "torso", SH[1]), ("cape", "torso", CAPE),
    ])
    idle = {"torso": {"rot": keys((0, (0, -3, 0)), (1.2, (0, 3, 0)), (2.4, (0, -3, 0)))},
            "head": {"rot": keys((0, Z3), (0.6, (0, 8, 0)), (1.8, (0, -8, 0)), (2.4, Z3))},
            "cape": {"rot": keys((0, Z3), (1.2, (-6, 0, 0)), (2.4, Z3))},
            "arm-l": {"rot": keys((0, Z3), (1.2, (4, 0, 0)), (2.4, Z3))}}
    attack = {"arm-r": {"rot": keys((0, Z3), (0.26, (-115, -12, 24)), (0.42, (-50, 8, 8)), (0.54, (28, 18, -28)), (0.68, (20, 10, -20)), (1.05, Z3))},
              "arm-l": {"rot": keys((0, Z3), (0.26, (-12, 0, -16)), (0.54, (-28, 0, 16)), (1.05, Z3))},
              "torso": {"rot": keys((0, Z3), (0.26, (5, -18, 0)), (0.54, (-15, 18, 0)), (1.05, Z3))},
              "cape": {"rot": keys((0, Z3), (0.54, (-18, -12, 0)), (1.05, Z3))},
              "head": {"rot": keys((0, Z3), (0.26, (0, -12, 0)), (0.54, (-8, 10, 0)), (1.05, Z3))}}
    hit = {"torso": {"rot": keys((0, Z3), (0.1, (12, 6, 0)), (0.45, Z3))},
           "head": {"rot": keys((0, Z3), (0.1, (-14, -10, 0)), (0.45, Z3))},
           "cape": {"rot": keys((0, Z3), (0.1, (-12, 0, 0)), (0.45, Z3))}}
    death = {"hips": {"rot": keys((0, Z3), (0.4, (-10, 0, 0)), (1.0, (-85, 0, 0))),
                      "loc": keys((0, Z3), (0.4, (0, 0.5, 0)), (1.0, (0, -12.0, -8)))},
             "head": {"rot": keys((0, Z3), (1.0, (20, 0, 18)))},
             "arm-r": {"rot": keys((0, Z3), (1.0, (-40, 0, 25)))},
             "cape": {"rot": keys((0, Z3), (1.0, (-30, 0, 0)))}}
    sockets = [Socket("socket-chest", at=rel((CX, 27.0, CZ - 5.0), HIP), parent="torso"),
               Socket("socket-mouth", at=rel((CX, 36.0, CZ - 5.2), HIP), parent="head"),
               Socket("socket-hands", at=rel((SX, 33.0, SZ), HIP), parent="arm-r")]
    return world("phantom-knight", "creatures", "Phantom Knight", root, clips=clips(idle, attack, hit, death), sockets=sockets,
                 pfx=[pfx("rvx-monster-silver-slash", "socket-hands", "clip:attack", size=40, at=0.4)])


# ------------------------------------------------------------------ scarecrow fiend


def _scarecrow_fiend():
    """A scarecrow fiend: thin pole legs on straw feet, ragged patched
    trousers and shirt, arms tied along a wooden crossbar with twig claws,
    a burlap sack head with glowing eyes and a stitched grin, and a
    crooked hat."""
    size = (50, 46, 30)
    CX, CZ = 25.0, 15.0
    BASE = (CX, 0.0, CZ)
    WAIST = (CX, 18.0, CZ)
    NECK = (CX, 30.5, CZ - 1.0)
    SH = {-1: (CX - 5.5, 28.6, CZ + 1.0), 1: (CX + 5.5, 28.6, CZ + 1.0)}

    body = Grid(*size)
    X, Y, Z = coords(body)
    poles = np.zeros(body.shape, dtype=bool)
    hay = np.zeros(body.shape, dtype=bool)
    ties = np.zeros(body.shape, dtype=bool)
    for s in (-1, 1):
        poles |= S.bar(body, "z", (CX + s * 4.2, 0.6), (CX + s * 2.6, 17.0), 2.2, CZ - 1.1, CZ + 1.1, "wood", 4)
        xb = CX + s * 4.1
        hay |= front(body, [(xb - 3.0, 0), (xb + 3.0, 0), (xb + 1.4, 4.5), (xb - 1.4, 4.5)], CZ - 2.2, CZ + 2.2, "gold", 5)
        ties |= plan(body, octo(xb - s * 0.1, CZ, 1.6, 1.6, 0.6), 4.0, 5.2, "sand", 3)
    pants = plan(body, octo(CX, CZ, 5.8, 3.6, 1.2), 12.5, 19.5, "purple", 4, top=octo(CX, CZ, 5.2, 3.4, 1.0))
    rags = np.zeros(body.shape, dtype=bool)
    for k, x in enumerate((CX - 4.5, CX - 1.5, CX + 1.5, CX + 4.5)):
        rags |= claw(body, "z", (x, 12.9), (x + 0.4, 10.4 - (k % 2)), 1.0, CZ - 3.3, CZ + 3.3, "purple", 3)
    for x in (CX - 3.0, CX, CX + 3.0):
        hay |= claw(body, "z", (x, 12.9), (x - 0.5, 9.6), 0.8, CZ - 2.7, CZ + 2.7, "gold", 5)
    bark(body, poles, "wood", 4, seed=1)
    P.flat(body, poles & (Y % 7 == 3), "wood", 2)  # knots in the poles
    straw(body, hay, 5, seed=2)
    P.flat(body, ties, "sand", 3)
    P.flat(body, ties & ((X + Y + Z) % 2 == 0), "sand", 5)
    patches(body, pants | rags, [("purple", 4), ("purple", 3), ("moss", 4)], seed=3, cell=(5, 4), seam=("purple", 2))

    torso = Grid(*size)
    X, Y, Z = coords(torso)
    shirt = plan(torso, octo(CX, CZ, 5.4, 3.6, 1.2), 18.5, 29.5, "rust", 4, top=octo(CX, CZ, 6.6, 4.0, 1.5))
    flaps = np.zeros(torso.shape, dtype=bool)
    for x in (CX - 4, CX - 1, CX + 2, CX + 4.5):
        flaps |= claw(torso, "z", (x, 18.8), (x + 0.6, 16.4), 1.1, CZ - 3.8, CZ + 3.8, "rust", 3)
    belt = plan(torso, octo(CX, CZ, 5.8, 3.9, 1.3), 18.2, 19.6, "sand", 3)
    collar = front(torso, [(CX - 4, 29), (CX + 4, 29), (CX + 5.5, 31.5), (CX + 2.5, 30.5), (CX, 32), (CX - 2.5, 30.5), (CX - 5.5, 31.5)], CZ - 3, CZ + 3, "gold", 5)
    bar = S.bar(torso, "z", (CX - 21, 27.4), (CX + 21, 28.6), 2.6, CZ + 3.6, CZ + 6.0, "wood", 5)
    post = S.bar(torso, "z", (CX, 16.0), (CX - 0.3, 35.5), 2.4, CZ + 3.8, CZ + 5.8, "darkwood", 4)
    lash = plan(torso, octo(CX, CZ + 4.8, 2.0, 1.8, 0.6), 26.4, 29.8, "sand", 3)
    patches(torso, shirt | flaps, [("rust", 4), ("orange", 3), ("rust", 3), ("purple", 4)], seed=4, cell=(6, 5), seam=("darkwood", 2))
    P.flat(torso, belt, "sand", 3)
    P.flat(torso, belt & ((X + Y) % 3 == 0), "sand", 5)
    straw(torso, collar, 5, seed=5)
    P.planks(torso, bar, "wood", 5, width=3, across="y", nails=True, seed=6)
    bark(torso, post, "darkwood", 4, seed=7)
    P.flat(torso, lash, "sand", 3)
    P.flat(torso, lash & ((X + Y) % 2 == 0), "sand", 5)

    head = Grid(*size)
    X, Y, Z = coords(head)
    sack = chunk(head, CX, CZ - 1.2, 30.2, 38.6, 5.2, 4.4, 1.8, "sand", 5, taper=0.4)
    tie = plan(head, octo(CX, CZ - 1.2, 4.0, 3.4, 1.2), 30.0, 31.6, "sand", 3)
    brim = S.disc(head, "y", CX, CZ - 1.2, 8.2, 38.2, 39.4, "darkwood", 3, n=8)
    crown = chunk(head, CX, CZ - 1.2, 39.2, 43.6, 3.6, 3.6, 1.2, "darkwood", 3, taper=2.6, lean=(1.6, 1.2))
    band = plan(head, octo(CX, CZ - 1.2, 3.8, 3.8, 1.3), 39.2, 40.4, "purple", 4)
    tufts = np.zeros(head.shape, dtype=bool)
    for s in (-1, 1):
        tufts |= front(head, [(CX + s * 4.6, 38.4), (CX + s * 7.6, 38.4), (CX + s * 7.2, 34.5), (CX + s * 6.2, 36.0), (CX + s * 5.4, 34.0)], CZ - 2.6, CZ + 1.6, "gold", 5)
    burlap(head, sack, 5, seed=8)
    P.flat(head, tie, "sand", 3)
    P.flat(head, tie & ((X + Y) % 2 == 0), "sand", 5)
    P.mottle(head, brim | crown, "darkwood", 3, cell=2, seed=9)
    P.outline(head, brim, "darkwood", 2, normal="y")
    P.flat(head, band, "purple", 4)
    P.flat(head, band & (Z < CZ - 4.5) & (np.abs(X + 0.5 - CX) < 1.2), "gold", 5)
    straw(head, tufts, 5, seed=10)
    face = CZ - 1.2 - 4.4
    glare = ["kkkk...kkkk", "kGgk...kgGk", ".kgk...kgk.", "..k.....k.."]
    pnglyph.stamp(head, "-z", face, int(CX - 5), 34, glare, {"k": C("darkwood", 2), "g": C("toxic", 6), "G": C("toxic", 7)}, depth=2, reach=3)
    grin = ["k.k.k.k.k", "kkkkkkkkk", "k.k.k.k.k"]
    pnglyph.stamp(head, "-z", face, int(CX - 4), 31, grin, {"k": C("darkwood", 2)}, depth=1, reach=3)
    # A stitched patch on the cheek.
    cheek = sack & (Z < face + 1) & (X >= CX + 2) & (X < CX + 5) & (Y >= 35.5) & (Y < 37.5)
    P.flat(head, cheek, "khaki", 4)
    P.outline(head, cheek, "darkwood", 2, normal="z")

    arms = {}
    for s, name in ((-1, "arm-l"), (1, "arm-r")):
        g = Grid(*size)
        X, Y, Z = coords(g)
        sleeve = limb(g, "z", (CX + s * 5.5, 28.6), (CX + s * 16.5, 27.9), 2.3, 1.9, CZ - 0.8, CZ + 3.0, "rust", 4)
        tuft = front(g, [(CX + s * 16, 25), (CX + s * 16, 31), (CX + s * 19.5, 32.5), (CX + s * 18.5, 29.5), (CX + s * 20.5, 28), (CX + s * 18.5, 26.5), (CX + s * 19.5, 23.5)], CZ - 0.5, CZ + 2.8, "gold", 5)
        twigs = np.zeros(g.shape, dtype=bool)
        for tip in ((22.5, 24.5), (23.0, 28.6), (22.0, 32.5)):
            twigs |= S.bar(g, "z", (CX + s * 18.0, 28.4), (CX + s * tip[0], tip[1]), 1.2, CZ + 0.2, CZ + 1.8, "darkwood", 3)
        patches(g, sleeve, [("rust", 4), ("orange", 3), ("rust", 3)], seed=11 + s, cell=(6, 5), seam=("darkwood", 2))
        P.flat(g, sleeve & (np.abs(X + 0.5 - (CX + s * 11.0)) < 1.0), "sand", 3)  # a rope tie
        straw(g, tuft, 5, seed=13 + s)
        P.flat(g, twigs, "darkwood", 3)
        P.flat(g, twigs & (np.abs(X + 0.5 - CX) > 21.5), "bone", 6)  # sharp pale tips
        arms[name] = g

    parts = {"body": body, "torso": torso, "head": head, "arm-l": arms["arm-l"], "arm-r": arms["arm-r"]}
    loose("scarecrow-fiend", parts)
    root = assemble(parts, [("body", None, BASE), ("torso", "body", WAIST), ("head", "torso", NECK),
                            ("arm-l", "torso", SH[-1]), ("arm-r", "torso", SH[1])])
    idle = {"torso": {"rot": keys((0, (0, 0, -3)), (1.2, (0, 0, 3)), (2.4, (0, 0, -3)))},
            "head": {"rot": keys((0, (0, 0, 10)), (1.2, (0, 0, -6)), (2.4, (0, 0, 10)))},
            "arm-l": {"rot": keys((0, Z3), (1.2, (6, 0, 0)), (2.4, Z3))},
            "arm-r": {"rot": keys((0, Z3), (1.2, (-6, 0, 0)), (2.4, Z3))}}
    attack = {"torso": {"rot": keys((0, Z3), (0.24, (0, -20, -18)), (0.5, (-12, 30, 18)), (0.7, (-5, 14, 8)), (1.0, Z3))},
              "arm-l": {"rot": keys((0, Z3), (0.24, (35, 0, -42)), (0.5, (85, 0, 18)), (0.7, (40, 0, 8)), (1.0, Z3))},
              "arm-r": {"rot": keys((0, Z3), (0.24, (60, 0, -12)), (0.5, (30, 0, 38)), (0.7, (15, 0, 18)), (1.0, Z3))},
              "head": {"rot": keys((0, Z3), (0.24, (0, -25, 18)), (0.5, (-20, 15, -20)), (1.0, Z3))}}
    hit = {"torso": {"rot": keys((0, Z3), (0.1, (6, 0, 10)), (0.45, Z3))},
           "head": {"rot": keys((0, Z3), (0.1, (-10, 0, -20)), (0.45, Z3))}}
    death = {"torso": {"rot": keys((0, Z3), (0.5, (-25, 0, 8)), (1.0, (-40, 0, 12)))},
             "head": {"rot": keys((0, Z3), (1.0, (25, 0, 30)))},
             "body": {"rot": keys((0, Z3), (0.5, (-8, 0, 0)), (1.0, (-70, 0, 0))),
                      "loc": keys((0, Z3), (1.0, (0, 3.0, -6)))},
             "arm-l": {"rot": keys((0, Z3), (1.0, (0, 0, 25)))}, "arm-r": {"rot": keys((0, Z3), (1.0, (0, 0, -25)))}}
    sockets = [Socket("socket-chest", at=rel((CX, 24.0, CZ - 4.2), BASE), parent="torso"),
               Socket("socket-mouth", at=rel((CX, 32.0, CZ - 5.6), BASE), parent="head"),
               Socket("socket-hands", at=rel((CX, 24.0, CZ - 10.0), BASE), parent="torso")]
    return world("scarecrow-fiend", "creatures", "Scarecrow Fiend", root, clips=clips(idle, attack, hit, death), sockets=sockets,
                 pfx=[pfx("rvx-monster-rot-poof", "socket-chest", "clip:death", size=40, at=0.85)])


# ------------------------------------------------------------------ swamp creature


def _swamp_creature():
    """A hunched swamp creature: a heavy forward-leaning body with a
    spined dorsal fin, a low wide head with bulging toxic eyes, gill fins
    and an underbite, long arms that reach the floor with finned forearms,
    and short bowed legs on webbed feet."""
    size = (56, 50, 50)
    CX, CZ = 28.0, 25.0
    MOSS = "moss"
    HIP = (CX, 15.0, CZ + 3.0)
    WAIST = (CX, 19.0, CZ + 3.0)
    NECK = (CX, 30.0, CZ - 6.0)
    SH = {-1: (CX - 12.5, 33.5, CZ - 3.0), 1: (CX + 12.5, 33.5, CZ - 3.0)}

    hips = Grid(*size)
    X, Y, Z = coords(hips)
    pelvis = chunk(hips, CX, CZ + 3, 11, 20, 9.5, 6.8, 2.6, MOSS, 4, taper=0.8)
    hide = pelvis.copy()
    fins = np.zeros(hips.shape, dtype=bool)
    toes = np.zeros(hips.shape, dtype=bool)
    for s in (-1, 1):
        x = CX + s * 7.5
        hide |= limb(hips, "x", (15, CZ + 3), (8, CZ - 1.5), 4.2, 3.6, x - 3.8, x + 3.8, MOSS, 4, cap=0.4)
        hide |= limb(hips, "x", (8.5, CZ - 1.5), (3.2, CZ + 2), 3.4, 3.0, x - 3.2, x + 3.2, MOSS, 4, cap=0.4)
        foot = side(hips, [(0, CZ - 7.5), (0, CZ + 5.5), (3.6, CZ + 5.5), (4.4, CZ - 0.5), (2.2, CZ - 7.5)], x - 4.6, x + 4.6, MOSS, 3)
        P.mottle(hips, foot, MOSS, 3, cell=2, seed=1)
        P.flat(hips, foot & (Z < CZ - 3) & ((X.astype(int) % 3) == 0), "teal", 3)  # webbing lines
        for k in range(3):
            xx = x - 3 + k * 3
            toes |= claw(hips, "x", (1.4, CZ - 7.2), (0.3, CZ - 10.2), 1.0, xx - 0.7, xx + 0.7, "bone", 6)
        fins |= side(hips, [(11, CZ + 2.2), (4.5, CZ + 5.0), (6.0, CZ + 9.5)], x - 0.6, x + 0.6, "teal", 4)
    scales(hips, hide, MOSS, 4, seed=2)
    P.flat(hips, hide & (Z < CZ - 2) & (Y > 11) & (np.abs(X + 0.5 - CX) < 5), "khaki", 4)
    P.mottle(hips, fins, "teal", 4, cell=2, seed=3)
    P.outline(hips, fins, "teal", 2, normal="x")

    torso = Grid(*size)
    X, Y, Z = coords(torso)
    back = side(torso, [(17, CZ - 4.5), (17, CZ + 9), (27, CZ + 11), (36, CZ + 8), (40.5, CZ + 1.5), (38.5, CZ - 6.5), (31.5, CZ - 10.5), (24, CZ - 8.5)], CX - 11, CX + 11, MOSS, 4)
    belly = side(torso, [(18, CZ - 5.5), (24.5, CZ - 9.6), (31, CZ - 11.5), (33, CZ - 9.5), (25, CZ - 5), (19, CZ - 3)], CX - 8, CX + 8, "khaki", 5)
    yoke = front(torso, [(CX - 15, 33), (CX - 10, 39), (CX + 10, 39), (CX + 15, 33), (CX + 11, 27), (CX - 11, 27)], CZ - 7, CZ + 4, MOSS, 4)
    dorsal = side(torso, [(20, CZ + 8), (22.5, CZ + 13), (25, CZ + 11.5), (28.5, CZ + 16.5), (31, CZ + 10.5), (34, CZ + 14), (36.5, CZ + 8),
                          (41.5, CZ + 8.5), (40.6, CZ + 4), (45.5, CZ + 2.5), (40.5, CZ + 0.5), (37, CZ + 4), (31, CZ + 7.5), (24, CZ + 8.5)], CX - 1.1, CX + 1.1, "teal", 4)
    hide = back | yoke
    scales(torso, hide, MOSS, 4, seed=4)
    P.flat(torso, hide & (Z > CZ + 6) & (Y % 6 == 0), MOSS, 2)  # dark bands across the back
    # Glowing toxic pores in rows along the flanks (C3).
    P.flat(torso, hide & (np.abs(X + 0.5 - CX) > 9.5) & (Y % 4 == 1) & (Z % 4 == 0) & (Y > 22), "toxic", 6)
    P.mottle(torso, belly, "khaki", 5, cell=2, seed=5)
    P.flat(torso, belly & (Y % 3 == 0), "khaki", 3)
    P.flat(torso, belly & (np.abs(X + 0.5 - CX) < 0.6), "khaki", 4)
    U, V = P.uv(torso)
    P.mottle(torso, dorsal, "teal", 4, cell=2, seed=6)
    P.flat(torso, dorsal & ((U + V) % 3 == 0), "teal", 2)  # fin spines
    P.flat(torso, dorsal & ((Y > 43) | (Z > CZ + 15.5) | ((Y > 40) & (Z > CZ + 7.5))), "bone", 6)  # pale spine tips
    P.outline(torso, dorsal, "teal", 2, normal="x")

    head = Grid(*size)
    X, Y, Z = coords(head)
    skull = chunk(head, CX, CZ - 12, 25.5, 33.5, 7.0, 5.8, 2.4, MOSS, 5, taper=1.2, lean=(0, -0.6))
    jaw = front(head, [(CX - 6.5, 25.2), (CX + 6.5, 25.2), (CX + 7.0, 27.6), (CX - 7.0, 27.6)], CZ - 18.4, CZ - 8.0, "khaki", 4)
    teeth = np.zeros(head.shape, dtype=bool)
    for xx in (CX - 4.5, CX - 1.5, CX + 1.5, CX + 4.5):
        teeth |= claw(head, "z", (xx, 27.4), (xx + 0.3, 29.6), 0.8, CZ - 18.4, CZ - 17.2, "bone", 7)
    bulbs = np.zeros(head.shape, dtype=bool)
    gills = np.zeros(head.shape, dtype=bool)
    for s in (-1, 1):
        bulbs |= chunk(head, CX + s * 4.2, CZ - 13.5, 32.5, 35.6, 2.2, 2.2, 0.8, MOSS, 5, taper=0.4)
        gills |= front(head, [(CX + s * 6.6, 32.5), (CX + s * 6.6, 26.5), (CX + s * 12.5, 25), (CX + s * 10, 28.5), (CX + s * 13, 30.5), (CX + s * 10, 31.5), (CX + s * 12.5, 34.5)], CZ - 11, CZ - 9.6, "teal", 4)
    crest = side(head, [(32.5, CZ - 15), (35.5, CZ - 13), (34.4, CZ - 11), (37, CZ - 8.5), (33, CZ - 7)], CX - 0.6, CX + 0.6, "teal", 5)
    scales(head, skull | bulbs, MOSS, 5, row=2, width=3, seed=7)
    P.mottle(head, jaw, "khaki", 4, cell=2, seed=8)
    P.flat(head, jaw & (Y >= 27), "blood", 2)  # the dark gape above the lip
    P.flat(head, skull & (Z < CZ - 17) & (Y < 27.6), "blood", 2)
    for s in (-1, 1):
        ex = CX + s * 4.2
        eye = bulbs & (Z < CZ - 14.7) & (np.abs(X + 0.5 - ex) < 1.8) & (Y >= 33) & (Y < 35.5)
        P.flat(head, eye, "toxic", 6)
        P.flat(head, eye & (Y >= 34.5), "toxic", 7)
        P.flat(head, eye & (np.abs(X + 0.5 - ex) < 0.6), "purple", 1)  # slit pupil
    P.flat(head, skull & (Z < CZ - 16.5) & (Y >= 30) & (Y < 31) & (np.abs(X + 0.5 - CX) < 2.5) & (np.abs(X + 0.5 - CX) > 0.8), MOSS, 2)  # nostrils
    U, V = P.uv(head)
    P.mottle(head, gills | crest, "teal", 4, cell=2, seed=9)
    P.flat(head, (gills | crest) & ((U + V) % 3 == 0), "teal", 2)
    P.outline(head, gills, "teal", 2, normal="z")
    P.outline(head, crest, "teal", 2, normal="x")

    arms = {}
    for s, name in ((-1, "arm-l"), (1, "arm-r")):
        g = Grid(*size)
        X, Y, Z = coords(g)
        m = limb(g, "z", (CX + s * 12.5, 34), (CX + s * 17, 21), 3.6, 3.0, CZ - 6, CZ + 0.5, MOSS, 4, cap=0.4)
        m |= limb(g, "z", (CX + s * 17, 21.5), (CX + s * 17.8, 7.5), 3.0, 2.6, CZ - 6.2, CZ + 0.2, MOSS, 4, cap=0.4)
        hand = chunk(g, CX + s * 18, CZ - 3.5, 2.0, 8.0, 3.4, 3.6, 1.2, MOSS, 3, taper=0.8)
        claws = np.zeros(g.shape, dtype=bool)
        for k in (-1, 0, 1):
            xx = CX + s * 18 + k * 2.2
            claws |= claw(g, "x", (2.6, CZ - 6.6), (0.6, CZ - 9.6), 0.9, xx - 0.7, xx + 0.7, "bone", 6)
        fin = front(g, [(CX + s * 19.6, 20), (CX + s * 25, 15.5), (CX + s * 24, 12), (CX + s * 20.4, 9.5)], CZ - 3.6, CZ - 2.2, "teal", 4)
        scales(g, m, MOSS, 4, seed=10 + s)
        P.flat(g, m & (np.abs(X + 0.5 - CX) < 16.5) & (Y < 30) & (Z < CZ - 4.5), "khaki", 4)  # pale inner forearm
        P.mottle(g, hand, MOSS, 3, cell=2, seed=12)
        P.flat(g, hand & (Z < CZ - 6) & ((X.astype(int) % 2) == 0), "teal", 3)  # webbing
        U, V = P.uv(g)
        P.mottle(g, fin, "teal", 4, cell=2, seed=13)
        P.flat(g, fin & ((U + V) % 3 == 0), "teal", 2)
        P.outline(g, fin, "teal", 2, normal="z")
        arms[name] = g

    parts = {"hips": hips, "torso": torso, "head": head, "arm-l": arms["arm-l"], "arm-r": arms["arm-r"]}
    loose("swamp-creature", parts)
    root = assemble(parts, [("hips", None, HIP), ("torso", "hips", WAIST), ("head", "torso", NECK),
                            ("arm-l", "torso", SH[-1]), ("arm-r", "torso", SH[1])])
    idle = {"torso": {"rot": keys((0, Z3), (1.3, (3, 0, 0)), (2.6, Z3))},
            "head": {"rot": keys((0, Z3), (0.65, (0, -8, 0)), (1.95, (0, 8, 0)), (2.6, Z3))},
            "arm-l": {"rot": keys((0, Z3), (1.3, (6, 0, 0)), (2.6, Z3))},
            "arm-r": {"rot": keys((0, (6, 0, 0)), (1.3, Z3), (2.6, (6, 0, 0)))}}
    attack = {"torso": {"rot": keys((0, Z3), (0.25, (10, 16, 0)), (0.45, (-20, -15, 0)), (0.65, (-8, -8, 0)), (1.0, Z3)),
                        "loc": keys((0, Z3), (0.25, (0, 1, 2)), (0.45, (0, 1, -5)), (0.65, (0, 1, -4)), (1.0, Z3))},
              "head": {"rot": keys((0, Z3), (0.25, (14, -10, 0)), (0.45, (-28, 6, 0)), (0.65, (-15, 0, 0)), (1.0, Z3))},
              "arm-l": {"rot": keys((0, Z3), (0.25, (35, 0, -30)), (0.45, (65, 0, -18)), (1.0, Z3))},
              "arm-r": {"rot": keys((0, Z3), (0.25, (28, 0, 25)), (0.45, (55, 0, 10)), (1.0, Z3))}}
    hit = {"torso": {"rot": keys((0, Z3), (0.1, (12, 8, 0)), (0.5, Z3))},
           "head": {"rot": keys((0, Z3), (0.1, (14, -12, 0)), (0.5, Z3))}}
    death = {"hips": {"rot": keys((0, Z3), (0.4, (6, 0, 0)), (1.2, (-80, 0, 0))),
                      "loc": keys((0, Z3), (0.4, (0, 0.5, 0)), (1.2, (0, -3.0, -8)))},
             "arm-l": {"rot": keys((0, Z3), (1.2, (-60, 0, -20)))}, "arm-r": {"rot": keys((0, Z3), (1.2, (-60, 0, 20)))},
             "head": {"rot": keys((0, Z3), (1.2, (20, 0, 25)))}}
    sockets = [Socket("socket-chest", at=rel((CX, 30.0, CZ - 11.0), HIP), parent="torso"),
               Socket("socket-mouth", at=rel((CX, 28.0, CZ - 18.4), HIP), parent="head"),
               Socket("socket-hands", at=rel((CX, 10.0, CZ - 12.0), HIP), parent="hips")]
    return world("swamp-creature", "creatures", "Swamp Creature", root, clips=clips(idle, attack, hit, death), sockets=sockets,
                 pfx=[pfx("rvx-monster-venom-spit", "socket-mouth", "clip:attack", size=44, at=0.45)])


# ------------------------------------------------------------------ patchwork giant


def _patchwork_giant():
    """A patchwork giant about twice the height of a person: a huge
    stitched torso in a torn vest, a small flat-top head with neck bolts,
    a heavy left arm from a teal corpse and a smaller pale right arm,
    patched trousers and big boots."""
    size = (68, 84, 48)
    CX, CZ = 34.0, 24.0
    HIP = (CX, 26.0, CZ)
    LEGJ = {-1: (CX - 8.5, 25.0, CZ), 1: (CX + 8.5, 25.0, CZ)}
    WAIST = (CX, 30.0, CZ)
    NECK = (CX, 58.5, CZ - 1.0)
    SH = {-1: (CX - 17.5, 53.0, CZ + 0.5), 1: (CX + 16.5, 53.0, CZ + 0.5)}
    PANTS = [("purple", 4), ("purple", 3), ("moss", 4), ("khaki", 4)]

    legs = {}
    for s, name in ((-1, "leg-l"), (1, "leg-r")):
        g = Grid(*size)
        X, Y, Z = coords(g)
        x = CX + s * 8.5
        m = limb(g, "x", (26, CZ), (13.5, CZ - 1), 5.6, 5.0, x - 5.2, x + 5.2, "purple", 4, cap=0.3)
        m |= limb(g, "x", (14, CZ - 1), (6, CZ + 0.5), 4.8, 4.4, x - 4.8, x + 4.8, "purple", 4, cap=0.3)
        boot = side(g, [(0, CZ - 10), (0, CZ + 6.5), (7.5, CZ + 6.5), (8.0, CZ - 3.5), (4.5, CZ - 10)], x - 6, x + 6, "wood", 3)
        patches(g, m, PANTS, seed=1 + s, cell=(8, 7), seam=("purple", 2))
        P.mottle(g, boot, "wood", 3, cell=2, seed=3 + s)
        P.flat(g, boot & (Y < 1.5), "darkwood", 2)  # the sole
        P.flat(g, boot & (Y >= 7.0), "wood", 4)  # the turned top
        cap = boot & (Z < CZ - 6) & (Y < 5)
        armour(g, cap, 4, size=(4, 3), seed=5, ramp="gray")  # an iron toe cap
        P.flat(g, boot & (Z < CZ - 3) & (Y >= 4.5) & (np.abs(X + 0.5 - x) < 2.5) & (Y.astype(int) % 2 == 0), "bone", 6)  # laces
        legs[name] = g

    hips = Grid(*size)
    X, Y, Z = coords(hips)
    seat = plan(hips, octo(CX, CZ, 13, 8.5, 3), 21, 31, "purple", 4, top=octo(CX, CZ, 13.5, 8.6, 3))
    belt = plan(hips, octo(CX, CZ, 14, 9.1, 3.2), 28.5, 31.2, "wood", 3)
    buckle = box(hips, CX - 2, 28, CZ - 10, CX + 2, 31.8, CZ - 8.6, "gold", 4)
    patches(hips, seat, PANTS, seed=6, cell=(8, 7), seam=("purple", 2))
    P.planks(hips, belt, "wood", 3, width=3, across="y", length=(12, 18), nails=True, seed=7)
    P.flat(hips, buckle, "gold", 4)
    P.outline(hips, buckle, "gold", 2, normal="z")

    torso = Grid(*size)
    X, Y, Z = coords(torso)
    chest = plan(torso, octo(CX, CZ, 13.5, 9, 3.5), 30, 50, "gray", 5, top=octo(CX, CZ + 0.5, 18, 10.5, 4))
    traps = plan(torso, octo(CX, CZ + 0.5, 18, 10.5, 4), 50, 57, "gray", 5, top=octo(CX, CZ + 1, 11, 8, 3))
    neck = plan(torso, octo(CX, CZ - 0.5, 5.5, 5, 1.8), 55, 61, "gray", 5)
    bolts = np.zeros(torso.shape, dtype=bool)
    tips = np.zeros(torso.shape, dtype=bool)
    for s in (-1, 1):
        lo, hi = (CX + 5, CX + 9) if s > 0 else (CX - 9, CX - 5)
        bolts |= S.disc(torso, "x", 58.5, CZ - 0.5, 1.3, lo, hi, "steel", 5, n=6)
        tlo, thi = (CX + 8.2, CX + 9.6) if s > 0 else (CX - 9.6, CX - 8.2)
        tips |= S.disc(torso, "x", 58.5, CZ - 0.5, 2.0, tlo, thi, "steel", 6, n=6)
    flesh = chest | traps | neck
    patches(torso, flesh, [("gray", 5), ("skin", 5), ("teal", 5), ("bone", 5)], seed=8, cell=(8, 7))
    # The torn rust vest covers the sides and the back; its edge is ragged.
    vest = (chest | traps) & ((np.abs(X + 0.5 - CX) > 7 + (Y.astype(int) % 3)) | (Z > CZ + 2)) & (Y > 34 + ((X + Z).astype(int) % 3))
    P.mottle(torso, vest, "rust", 4, cell=3, seed=9)
    P.flat(torso, vest & ((X + Z).astype(int) % 6 == 0) & (Y % 2 == 0), "rust", 2)  # coarse weave
    P.outline(torso, vest, "rust", 2)
    P.flat(torso, vest & (Z > CZ + 4) & (Y > 40) & (Y < 46) & (np.abs(X + 0.5 - (CX + 4)) < 3), "purple", 4)  # a patch on the back
    # A long stitched scar down the chest.
    scar = flesh & (Z < CZ - 6) & (Y >= 32) & (Y < 54)
    P.flat(torso, scar & (np.abs(X + 0.5 - CX) < 0.6), "blood", 3)
    P.flat(torso, scar & (np.abs(X + 0.5 - CX) < 1.6) & (np.abs(X + 0.5 - CX) >= 0.6) & (Y % 2 == 0), "bone", 6)
    P.flat(torso, bolts, "steel", 5)
    P.flat(torso, tips, "steel", 6)
    P.outline(torso, tips, "steel", 3, normal="x")
    P.flat(torso, tips & (np.abs(Y - 58.5) < 0.8) & (np.abs(Z + 0.5 - (CZ - 0.5)) < 0.8), "toxic", 7)  # a spark in each bolt

    head = Grid(*size)
    X, Y, Z = coords(head)
    skull = chunk(head, CX, CZ - 1.5, 60, 73, 7.2, 6.6, 2.0, "teal", 5, taper=0.4)
    brow = front(head, [(CX - 7.6, 66.5), (CX + 7.6, 66.5), (CX + 7.6, 68.6), (CX - 7.6, 68.6)], CZ - 9.2, CZ - 6.5, "teal", 4)
    jaw = front(head, [(CX - 6.5, 59.5), (CX + 6.5, 59.5), (CX + 7.2, 63.5), (CX - 7.2, 63.5)], CZ - 8.8, CZ - 5.0, "teal", 4)
    hair = plan(head, octo(CX, CZ - 1.5, 7.6, 7.0, 2.2), 72, 75.5, "purple", 2, top=octo(CX, CZ - 1.5, 7.2, 6.6, 2.0))
    fringe = front(head, [(CX - 7.6, 70.5), (CX - 5.5, 72.5), (CX - 3.5, 70.0), (CX - 1.5, 72.5), (CX + 0.5, 70.5), (CX + 2.5, 72.5),
                          (CX + 4.5, 70.0), (CX + 6.0, 72.5), (CX + 7.6, 70.5), (CX + 7.6, 75.0), (CX - 7.6, 75.0)], CZ - 9.0, CZ - 7.5, "purple", 2)
    face = skull | brow | jaw
    patches(head, face, [("teal", 5), ("gray", 5), ("skin", 4)], seed=10, cell=(6, 5))
    P.mottle(head, hair | fringe, "purple", 2, cell=2, seed=11)
    P.flat(head, (hair | fringe) & ((X + Z).astype(int) % 3 == 0), "purple", 3)
    P.flat(head, brow & (Y < 67.3), "teal", 3)  # brow shadow
    fz = CZ - 8.1
    eye = {"k": C("teal", 2), "w": C("bone", 7), "p": C("purple", 1), "g": C("toxic", 6), "G": C("toxic", 7)}
    rows = ["kkkkk...kkk.", "kwwwk...kGk.", "kwppk...kgk.", "kwppk...kkk.", "kkkkk......."]
    pnglyph.stamp(head, "-z", fz, int(CX - 6), 62, rows, eye, depth=2, reach=3)
    mouth = ["k.k.k.k.k.k", "kkkkkkkkkkk", "k.k.k.k.k.k"]
    pnglyph.stamp(head, "-z", CZ - 8.8, int(CX - 5), 60, mouth, {"k": C("blood", 2)}, depth=1, reach=3)

    arms = {}
    for s, name in ((-1, "arm-l"), (1, "arm-r")):
        g = Grid(*size)
        X, Y, Z = coords(g)
        if s < 0:
            delt = chunk(g, CX - 18, CZ + 0.5, 47, 56.5, 6.4, 6.2, 2.2, "teal", 4, taper=1.6)
            m = limb(g, "z", (CX - 18.5, 50), (CX - 23.5, 36), 6.0, 5.2, CZ - 5, CZ + 6, "teal", 4, cap=0.3)
            m |= limb(g, "z", (CX - 23.5, 37), (CX - 25, 24), 5.4, 5.0, CZ - 5.5, CZ + 6.5, "teal", 4, cap=0.3)
            fist = chunk(g, CX - 25.5, CZ + 0.5, 12, 24, 6.2, 6.5, 2.2, "teal", 3, taper=0.6)
            cuff = plan(g, octo(CX - 25, CZ + 0.5, 6.4, 6.6, 2.0), 24, 27.5, "gray", 4)
            patches(g, delt | m, [("teal", 4), ("teal", 5), ("moss", 4)], seed=12, cell=(9, 8))
            P.mottle(g, fist, "teal", 3, cell=2, seed=13)
            P.flat(g, fist & (Z < CZ - 5) & (Y < 21) & ((X.astype(int) % 3) == 0), "teal", 2)  # finger lines
            P.flat(g, fist & (Z < CZ - 5) & (Y >= 19.5) & (Y < 21), "teal", 5)  # knuckles
            armour(g, cuff, 4, size=(5, 3), seed=14, ramp="gray")
            seam_y = 47.5
        else:
            delt = chunk(g, CX + 17, CZ + 0.5, 48, 56, 5.2, 5.4, 2.0, "skin", 5, taper=1.2)
            m = limb(g, "z", (CX + 17.5, 51), (CX + 21.5, 38.5), 4.6, 4.0, CZ - 4, CZ + 5, "skin", 5)
            m |= limb(g, "z", (CX + 21.5, 39), (CX + 22.5, 28), 4.0, 3.6, CZ - 4, CZ + 5, "skin", 5)
            fist = chunk(g, CX + 23, CZ + 0.5, 20, 28.5, 4.4, 4.0, 1.5, "skin", 4, taper=0.4)
            for k in range(4):
                xx = CX + 20.2 + k * 1.9
                fist |= claw(g, "z", (xx, 20.4), (xx + 0.3, 16.6), 0.9, CZ - 1.5, CZ + 2.5, "skin", 4)
            patches(g, delt | m, [("skin", 5), ("skin", 4), ("bone", 5)], seed=15, cell=(7, 6))
            P.mottle(g, fist, "skin", 4, cell=2, seed=16)
            P.flat(g, fist & (Y < 18), "bone", 6)  # pale nails
            seam_y = 48.5
        ring = (delt | m) & (Y >= seam_y) & (Y < seam_y + 1)
        P.flat(g, ring, "blood", 3)
        P.flat(g, ring & ((X + Z).astype(int) % 2 == 0), "bone", 6)  # the stitched shoulder seam
        arms[name] = g

    parts = {"hips": hips, "leg-l": legs["leg-l"], "leg-r": legs["leg-r"], "torso": torso, "head": head,
             "arm-l": arms["arm-l"], "arm-r": arms["arm-r"]}
    loose("patchwork-giant", parts)
    root = assemble(parts, [
        ("hips", None, HIP), ("leg-l", "hips", LEGJ[-1]), ("leg-r", "hips", LEGJ[1]),
        ("torso", "hips", WAIST), ("head", "torso", NECK), ("arm-l", "torso", SH[-1]), ("arm-r", "torso", SH[1]),
    ])
    idle = {"torso": {"rot": keys((0, (0, 0, -2)), (1.4, (0, 0, 2)), (2.8, (0, 0, -2)))},
            "head": {"rot": keys((0, Z3), (0.7, (0, 10, -4)), (2.1, (0, -10, 4)), (2.8, Z3))},
            "arm-l": {"rot": keys((0, Z3), (1.4, (-5, 0, 0)), (2.8, Z3))},
            "arm-r": {"rot": keys((0, Z3), (1.4, (5, 0, 0)), (2.8, Z3))}}
    attack = {"arm-l": {"rot": keys((0, Z3), (0.18, (65, 0, 8)), (0.35, (125, 0, 10)), (0.6, (35, 0, 0)), (1.1, Z3))},
              "arm-r": {"rot": keys((0, Z3), (0.35, (45, 0, -10)), (0.6, (20, 0, 0)), (1.1, Z3))},
              "torso": {"rot": keys((0, Z3), (0.35, (8, 0, 0)), (0.6, (-14, 0, 0)), (1.1, Z3))},
              "head": {"rot": keys((0, Z3), (0.35, (10, 0, 0)), (0.6, (-10, 0, 0)), (1.1, Z3))}}
    hit = {"torso": {"rot": keys((0, Z3), (0.12, (10, -8, 0)), (0.5, Z3))},
           "head": {"rot": keys((0, Z3), (0.12, (-16, 12, 0)), (0.5, Z3))}}
    death = {"hips": {"rot": keys((0, Z3), (0.5, (-8, 0, 0)), (1.4, (-84, 0, 0))),
                      "loc": keys((0, Z3), (0.5, (0, 0.5, 0)), (1.4, (0, -14.0, -12)))},
             "arm-l": {"rot": keys((0, Z3), (1.4, (-70, 0, -15)))}, "arm-r": {"rot": keys((0, Z3), (1.4, (-70, 0, 15)))},
             "head": {"rot": keys((0, Z3), (1.4, (25, 0, 20)))}}
    sockets = [Socket("socket-chest", at=rel((CX, 46.0, CZ - 10.0), HIP), parent="torso"),
               Socket("socket-mouth", at=rel((CX, 61.0, CZ - 8.8), HIP), parent="head"),
               Socket("socket-hands", at=rel((CX, 30.0, CZ - 16.0), HIP), parent="hips")]
    return world("patchwork-giant", "creatures", "Patchwork Giant", root, clips=clips(idle, attack, hit, death), sockets=sockets,
                 pfx=[pfx("rvx-monster-blood-splat", "socket-chest", "clip:hit", size=48)])


# ------------------------------------------------------------------ bone hound


def _bone_hound():
    """A skeleton hound 55 long: a skull with a long snout, a heavy brow
    over sunken glowing sockets and an open lower jaw with fangs; a spine
    with a ridge of spikes, ribs around a glowing toxic core, a pelvis,
    four jointed bone legs and a bone tail."""
    size = (34, 36, 62)
    CX = 17.0
    BODY = (CX, 18.0, 31.0)
    HEAD = (CX, 23.0, 19.0)
    JAW = (CX, 22.2, 15.0)
    TAIL = (CX, 21.5, 47.0)
    LEGJ = {"leg-fl": (-1, (CX - 6.2, 18.5, 23.0)), "leg-fr": (1, (CX + 6.2, 18.5, 23.0)),
            "leg-bl": (-1, (CX - 6.2, 20.5, 44.0)), "leg-br": (1, (CX + 6.2, 20.5, 44.0))}

    body = Grid(*size)
    X, Y, Z = coords(body)
    spine = S.bar(body, "x", (22.5, 20.5), (24.5, 30), 2.8, CX - 1.5, CX + 1.5, "bone", 6)
    spine |= S.bar(body, "x", (24.5, 30), (23.0, 46), 2.8, CX - 1.5, CX + 1.5, "bone", 6)
    spine |= S.bar(body, "x", (22.5, 21.5), (24.0, 16.5), 2.6, CX - 1.3, CX + 1.3, "bone", 6)  # the neck
    ridge = np.zeros(body.shape, dtype=bool)
    for zz in range(21, 46, 3):
        top = 22.5 + 2.0 * (zz - 20.5) / 9.5 if zz < 30 else 24.5 - 1.5 * (zz - 30) / 16
        h = 3.6 if 24 <= zz <= 33 else 2.6
        ridge |= side(body, [(top + 0.4, zz - 0.9), (top + 0.4, zz + 0.9), (top + 1.4 + h, zz + 1.8)], CX - 0.7, CX + 0.7, "bone", 7)
    ribs = np.zeros(body.shape, dtype=bool)
    for k, zz in enumerate((22.0, 25.5, 29.0, 32.5, 36.0)):
        w = 7.2 - max(0, k - 2) * 0.8
        lo = 12.0 + max(0, k - 2) * 1.2
        for s in (-1, 1):
            ribs |= S.bar(body, "z", (CX, 23.5), (CX + s * w, 19.5), 1.5, zz, zz + 1.6, "bone", 6)
            ribs |= S.bar(body, "z", (CX + s * w, 19.5), (CX + s * (w - 0.6), lo), 1.5, zz, zz + 1.6, "bone", 6)
            ribs |= S.bar(body, "z", (CX + s * (w - 0.6), lo), (CX + s * 1.5, 9.8 + max(0, k - 2) * 1.0), 1.5, zz, zz + 1.6, "bone", 5)
    sternum = S.bar(body, "x", (9.6, 21.5), (11.4, 37.6), 1.8, CX - 1.6, CX + 1.6, "bone", 5)
    core = chunk(body, CX, 29, 13, 19.5, 3.2, 3.6, 1.2, "toxic", 6, taper=0.6)
    blades = np.zeros(body.shape, dtype=bool)
    for s in (-1, 1):
        blades |= side(body, [(23, 20.5), (23, 25.5), (15, 24.0), (15.5, 21.0)], CX + s * 7.6 - 0.8, CX + s * 7.6 + 0.8, "bone", 5)
    pelvis = front(body, [(CX - 7, 24), (CX + 7, 24), (CX + 5.5, 18), (CX + 2, 16.5), (CX - 2, 16.5), (CX - 5.5, 18)], 41.5, 47, "bone", 5)
    bone(body, spine | ribs | sternum | blades | pelvis, 6, seed=1)
    P.flat(body, spine & (Z.astype(int) % 3 == 0), "bone", 4)  # vertebra joints
    P.flat(body, ridge, "bone", 7)
    P.flat(body, ridge & (Y < 25.5), "bone", 5)
    P.flat(body, ribs & (Y < 13.5), "bone", 5)
    P.flat(body, sternum & (Z.astype(int) % 3 == 0), "bone", 3)
    P.outline(body, blades, "bone", 4, normal="x")
    P.flat(body, pelvis & (np.abs(np.abs(X + 0.5 - CX) - 4.2) < 1.2) & (Y >= 19.5) & (Y < 22), "purple", 2)  # hip sockets
    P.flat(body, core, "toxic", 6)
    P.flat(body, core & (np.abs(X + 0.5 - CX) < 1.6) & (np.abs(Z + 0.5 - 29) < 1.6), "toxic", 7)

    head = Grid(*size)
    X, Y, Z = coords(head)
    cranium = chunk(head, CX, 14.5, 21.5, 31, 5.4, 5.0, 2.0, "bone", 6, taper=1.4)
    snout = side(head, [(22.5, 1.0), (25.2, 1.0), (27.4, 4.0), (29.2, 11.0), (22.5, 11.0)], CX - 2.8, CX + 2.8, "bone", 6)
    brow = front(head, [(CX - 5.8, 27.4), (CX + 5.8, 27.4), (CX + 5.2, 29.4), (CX - 5.2, 29.4)], 8.6, 11.5, "bone", 5)
    horns = np.zeros(head.shape, dtype=bool)
    fangs = np.zeros(head.shape, dtype=bool)
    for s in (-1, 1):
        horns |= side(head, [(29.5, 14), (29.5, 17.5), (33.0, 20.5)], CX + s * 3.4 - 0.7, CX + s * 3.4 + 0.7, "bone", 7)
        for zz in (2.4, 6.4):
            fangs |= claw(head, "x", (22.8, zz), (19.6, zz + 0.4), 0.7, CX + s * 2.0 - 0.6, CX + s * 2.0 + 0.6, "bone", 7)
    bone(head, cranium | snout, 6, seed=2)
    P.flat(head, brow, "bone", 5)
    P.flat(head, brow & (Y >= 28.6), "bone", 7)
    P.flat(head, horns & (Y > 31), "bone", 5)
    P.flat(head, fangs, "bone", 7)
    P.flat(head, snout & (Y < 23.5) & (Z < 10.5), "bone", 7)  # the upper tooth row
    P.flat(head, snout & (Y < 23.5) & (Z < 10.5) & (Z.astype(int) % 2 == 0), "purple", 2)
    P.flat(head, snout & (Z < 1.8) & (Y >= 23.5) & (np.abs(X + 0.5 - CX) < 1.6), "purple", 1)  # the nose hole
    P.flat(head, snout & (Y > 26) & (Z.astype(int) % 4 == 0), "bone", 4)  # snout plate seams
    # Sunken eye sockets under the brow with a toxic glow (C3).
    for s in (-1, 1):
        ex = CX + s * 4.1
        sock = cranium & (Z < 10.5) & (np.abs(X + 0.5 - ex) < 1.6) & (Y >= 24.5) & (Y < 27.4)
        P.flat(head, sock, "purple", 1)
        P.flat(head, sock & (np.abs(X + 0.5 - ex) < 0.6) & (Y >= 25) & (Y < 26.5), "toxic", 7)
        P.flat(head, sock & (np.abs(X + 0.5 - ex) >= 0.6) & (Y >= 25) & (Y < 26), "toxic", 5)

    jaw = Grid(*size)
    X, Y, Z = coords(jaw)
    open_deg = -22.0
    shape = rotate([(22.2, 2.2), (22.2, 15.5), (19.6, 15.5), (18.0, 9.5), (19.4, 2.2)], JAW[1], JAW[2], open_deg)
    mandible = side(jaw, shape, CX - 2.4, CX + 2.4, "bone", 5)
    low_fangs = np.zeros(jaw.shape, dtype=bool)
    for zz in (3.0, 7.0):
        (ty, tz), = rotate([(22.0, zz)], JAW[1], JAW[2], open_deg)
        for s in (-1, 1):
            low_fangs |= claw(jaw, "x", (ty - 0.3, tz), (ty + 2.4, tz + 0.3), 0.6, CX + s * 1.8 - 0.6, CX + s * 1.8 + 0.6, "bone", 7)
    bone(jaw, mandible, 5, seed=3)
    (gy, gz), = rotate([(22.2, 9.0)], JAW[1], JAW[2], open_deg)
    top_row = mandible & (Y >= np.floor(gy - 1.6 + (Z - gz) * 0.37)) & (Z < 13)
    P.flat(jaw, top_row, "bone", 7)
    P.flat(jaw, top_row & (Z.astype(int) % 2 == 0), "blood", 2)
    P.flat(jaw, low_fangs, "bone", 7)

    legs = {}
    for name, (s, (lx, ly, lz)) in LEGJ.items():
        g = Grid(*size)
        X, Y, Z = coords(g)
        x = lx
        if lz < 30:
            m = limb(g, "x", (ly, lz), (10.5, lz + 2.5), 2.0, 1.7, x - 1.4, x + 1.4, "bone", 6, cap=0.5)
            m |= limb(g, "x", (10.5, lz + 2.5), (3.2, lz), 1.7, 1.5, x - 1.2, x + 1.2, "bone", 6, cap=0.5)
            knobs = chunk(g, x, lz + 2.4, 9.2, 12.0, 1.7, 1.7, 0.6, "bone", 7)
            knobs |= chunk(g, x, lz, 2.6, 4.8, 1.6, 1.6, 0.6, "bone", 7)
            paw_z = lz
        else:
            m = limb(g, "x", (ly, lz), (12.0, lz - 4.0), 2.2, 1.8, x - 1.5, x + 1.5, "bone", 6, cap=0.5)
            m |= limb(g, "x", (12.0, lz - 4.0), (6.0, lz + 3.0), 1.8, 1.5, x - 1.3, x + 1.3, "bone", 6, cap=0.5)
            m |= limb(g, "x", (6.0, lz + 3.0), (2.4, lz + 1.0), 1.4, 1.3, x - 1.1, x + 1.1, "bone", 6, cap=0.5)
            knobs = chunk(g, x, lz - 4.0, 10.7, 13.4, 1.8, 1.8, 0.6, "bone", 7)
            knobs |= chunk(g, x, lz + 3.0, 4.8, 7.2, 1.6, 1.6, 0.6, "bone", 7)
            paw_z = lz + 1.0
        toes = np.zeros(g.shape, dtype=bool)
        for k in (-1, 0, 1):
            xx = x + k * 1.1
            toes |= S.bar(g, "x", (2.2, paw_z), (0.9, paw_z - 4.0), 1.0, xx - 0.5, xx + 0.5, "bone", 6)
            toes |= claw(g, "x", (1.0, paw_z - 3.8), (0.0, paw_z - 5.8), 0.6, xx - 0.5, xx + 0.5, "bone", 7)
        bone(g, m, 6, seed=4 + int(lz))
        P.mottle(g, knobs, "bone", 7, cell=2, seed=5)
        P.flat(g, knobs & (Y.astype(int) % 2 == 0), "bone", 5)  # joint bands
        P.flat(g, toes, "bone", 6)
        legs[name] = g

    tail = Grid(*size)
    X, Y, Z = coords(tail)
    t = S.bar(tail, "x", (21.5, 46.5), (18.0, 52.0), 2.2, CX - 1.1, CX + 1.1, "bone", 6)
    t |= S.bar(tail, "x", (18.0, 52.0), (16.5, 57.5), 1.6, CX - 0.8, CX + 0.8, "bone", 6)
    t |= claw(tail, "x", (16.6, 57.0), (17.5, 60.0), 0.8, CX - 0.8, CX + 0.8, "bone", 7)
    bone(tail, t, 6, seed=6)
    P.flat(tail, t & (Z.astype(int) % 2 == 0), "bone", 4)  # tail vertebrae

    parts = {"body": body, "head": head, "jaw": jaw, "tail": tail, **legs}
    loose("bone-hound", parts)
    joints = [("body", None, BODY), ("head", "body", HEAD), ("jaw", "head", JAW), ("tail", "body", TAIL)]
    joints += [(name, "body", LEGJ[name][1]) for name in ("leg-fl", "leg-fr", "leg-bl", "leg-br")]
    root = assemble(parts, joints)
    idle = {"body": {"loc": keys((0, Z3), (0.7, (0, 0.5, 0)), (1.4, Z3))},
            "tail": {"rot": keys((0, (0, -12, 0)), (0.35, (0, 12, 0)), (0.7, (0, -12, 0)), (1.05, (0, 12, 0)), (1.4, (0, -12, 0)))},
            "jaw": {"rot": keys((0, Z3), (0.35, (8, 0, 0)), (0.7, Z3), (1.05, (8, 0, 0)), (1.4, Z3))},
            "head": {"rot": keys((0, Z3), (0.7, (-6, 6, 0)), (1.4, Z3))}}
    attack = {"head": {"loc": keys((0, Z3), (0.25, (0, 0.5, -5)), (0.5, (0, 0, 1)), (0.8, Z3)),
                       "rot": keys((0, Z3), (0.25, (6, 0, 0)), (0.5, Z3))},
              "jaw": {"rot": keys((0, Z3), (0.15, (-14, 0, 0)), (0.35, (22, 0, 0)), (0.6, Z3))},
              "body": {"loc": keys((0, Z3), (0.25, (0, 0.5, -3)), (0.8, Z3))},
              "leg-fl": {"rot": keys((0, Z3), (0.25, (25, 0, 0)), (0.6, Z3))},
              "leg-fr": {"rot": keys((0, Z3), (0.25, (25, 0, 0)), (0.6, Z3))}}
    hit = {"body": {"loc": keys((0, Z3), (0.1, (0, 1.0, 2)), (0.5, Z3))},
           "head": {"rot": keys((0, Z3), (0.1, (-14, 10, 0)), (0.5, Z3))}}
    death = {"body": {"loc": keys((0, Z3), (0.4, (0, 1.0, 0)), (1.2, (0, -7.0, 0))),
                      "rot": keys((0, Z3), (1.2, (0, 0, 18)))},
             "leg-fl": {"rot": keys((0, Z3), (1.2, (0, 0, -70)))}, "leg-bl": {"rot": keys((0, Z3), (1.2, (0, 0, -70)))},
             "leg-fr": {"rot": keys((0, Z3), (1.2, (0, 0, 70)))}, "leg-br": {"rot": keys((0, Z3), (1.2, (0, 0, 70)))},
             "head": {"rot": keys((0, Z3), (1.2, (10, 0, 20)))}, "jaw": {"rot": keys((0, Z3), (1.2, (-10, 0, 0)))},
             "tail": {"rot": keys((0, Z3), (1.2, (-20, 0, 0)))}}
    sockets = [Socket("socket-fangs", at=rel((CX, 21.5, 2.5), BODY), parent="head")]
    return world("bone-hound", "creatures", "Bone Hound", root, clips=clips(idle, attack, hit, death), sockets=sockets,
                 pfx=[pfx("rvx-monster-claw-slash", "socket-fangs", "clip:attack", size=30, at=0.35)])


BUILDERS = {
    "imp": _imp,
    "lich": _lich,
    "phantom-knight": _phantom_knight,
    "scarecrow-fiend": _scarecrow_fiend,
    "swamp-creature": _swamp_creature,
    "patchwork-giant": _patchwork_giant,
    "bone-hound": _bone_hound,
}


def build(category, slug):
    if category != "creatures" or slug not in BUILDERS:
        raise KeyError(f"_rep_creatures has no model {category}/{slug}")
    return BUILDERS[slug]()
