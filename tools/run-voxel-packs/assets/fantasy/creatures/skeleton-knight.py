"""Skeleton knight in the Pirate Nation creature style.

A chunky caricature: a big bone skull (almost half the height) with glowing
magic-cyan eyes, under an open steel helm with a gold band and a tall red
crest. A steel breastplate with a gold sun over a bone ribcage and spine,
a royal-blue tabard with gold trim, big sloped steel pauldrons, thick bone
limbs in steel greaves and sabatons, big bony hands. The right fist holds
a longsword leaning forward, the left arm a royal-blue kite shield with a gold
cross. Limbs, pauldrons, helm, crest, tabard and blade are true-slope
prisms; ribs, joints, plates and trims are painted.
Clips: idle (sway, look), attack (overhead chop), hit, death (collapses,
the skull rolls off). Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _life import asset, chamfer_rect, coords, facet_paint, front, keys, pfx, plan, rig, side
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket

SH = (52, 48, 40)
CX, CZ = 26.0, 20.0
BONE, BONE_B = "bone", 5
PLATE, PLATE_B = "steel", 5
CLOTH = "blue"
HIP_Y = 13.0
WAIST_Y = 15.0
NECK_Y = 25.0
SKULL = dict(cx=CX, y0=24.0, cz=CZ - 0.5, s=12)  # cranium yc0=27, yc1=34, yc2=39; front z = cz - 5.4
SHOULDER_Y = 24.0


ENAMEL, ENAMEL_B = "blue", 4  # royal-blue lacquered helm and pauldrons


def plate_paint(g: Grid, m: np.ndarray, base: int = PLATE_B, frame=None, ramp: str = PLATE) -> None:
    """Plate armour: a lighter top face, soft ±1 patches in 4×3 cells."""
    if frame == "top":
        P.flat(g, m, ramp, base + 1)
        return
    U, V = P.uv(g, frame)
    h = P._hash(U // 4, V // 3) % np.uint64(7)
    P._paint(g, m, ramp, base + np.where(h == 0, -1, np.where(h == 1, 1, 0)))


def plates(g: Grid, start: int, base: int = PLATE_B, ramp: str = PLATE) -> None:
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: plate_paint(gg, mm, base, fr, ramp))


def bone_paint(g: Grid, m: np.ndarray, frame=None, seed: int = 0) -> None:
    U, V = P.uv(g, frame)
    h = P._hash(U // 3, V // 3, seed=seed) % np.uint64(8)
    P._paint(g, m, BONE, BONE_B + np.where(h == 0, -1, 0) + (1 if frame == "top" else 0))


def bones(g: Grid, start: int, seed: int = 0) -> None:
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: bone_paint(gg, mm, fr, seed))


def leg(s: int) -> Grid:
    g = Grid(*SH)
    X, Y, Z = coords(g)
    lx = CX + s * 4.5
    st = len(g.solids)
    side(g, S.quad((HIP_Y, CZ + 0.5), (9.5, CZ), 2.2, 2.0), lx - 2.2, lx + 2.2, BONE, BONE_B)  # thigh bone
    side(g, S.quad((10, CZ), (3, CZ + 0.5), 1.9, 1.7), lx - 1.9, lx + 1.9, BONE, BONE_B)  # shin bone
    bones(g, st, seed=1 + s)
    st = len(g.solids)
    sab = side(g, [(0, CZ - 7), (0, CZ + 4), (4.2, CZ + 4), (4.8, CZ + 0.5), (2.5, CZ - 7)], lx - 3.2, lx + 3.2, PLATE, PLATE_B)
    greave = side(g, [(3.5, CZ - 2.8), (8.6, CZ - 2.4), (8.6, CZ + 2), (3.5, CZ + 2)], lx - 2.7, lx + 2.7, PLATE, PLATE_B)
    knee = side(g, [(8.6, CZ - 3.2), (10.2, CZ - 3.6), (12, CZ - 2.6), (12, CZ + 0.5), (8.6, CZ + 0.5)], lx - 2.4, lx + 2.4, PLATE, PLATE_B)
    plates(g, st)
    # lames across the sabaton, a gold rivet on the knee, a dark sole
    P.flat(g, sab & (np.floor(Z) % 3 == 0) & (Z < CZ + 1) & (Y > 1), PLATE, PLATE_B - 1)
    P.flat(g, sab & (Y < 1), PLATE, 2)
    P.flat(g, greave & (Y > 7.8), "gold", 5)
    P.flat(g, knee & (np.abs(X - lx) < 0.8) & (np.abs(Y - 10.3) < 0.8) & (Z < CZ - 2.5), "gold", 7)
    return g


def pelvis() -> Grid:
    """The root: a bone pelvis, a leather belt and a royal-blue tabard."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    st = len(g.solids)
    pel = front(g, [(CX - 7, 11), (CX + 7, 11), (CX + 6, 15), (CX - 6, 15)], CZ - 3, CZ + 3, BONE, BONE_B)
    bones(g, st, seed=3)
    P.flat(g, pel & (Y < 12), BONE, 4)
    belt = box(g, int(CX) - 7, 14, int(CZ) - 4, int(CX) + 7, 16, int(CZ) + 4, "darkwood", 4)
    P.flat(g, edges(belt), "darkwood", 3)
    buckle = box(g, int(CX) - 2, 13, int(CZ) - 5, int(CX) + 2, 17, int(CZ) - 4, "gold", 5)
    P.flat(g, buckle & (Y > 16), "gold", 7)
    st = len(g.solids)
    tab = side(g, [(15, CZ - 4.6), (15, CZ - 2.8), (4.5, CZ - 4.2), (4.5, CZ - 6.2)], CX - 4.5, CX + 4.5, CLOTH, 4)
    tab |= side(g, [(15, CZ + 2.8), (15, CZ + 4.6), (5.5, CZ + 6.4), (5.5, CZ + 4.4)], CX - 4.5, CX + 4.5, CLOTH, 4)
    facet_paint(g, g.solids[st:], lambda gg, mm, fr: P.mottle(gg, mm, CLOTH, 4, cell=3, seed=4))
    P.flat(g, tab & (np.abs(np.abs(X - CX) - 3.9) < 0.6), "gold", 5)  # gold side trims
    P.flat(g, tab & (Y < 6.6), "gold", 5)  # gold hem
    P.flat(g, tab & (Y < 6.6) & (np.floor(X) % 3 == 1), CLOTH, 2)  # torn hem notches
    cross = tab & (Z < CZ) & (((np.abs(X - CX) < 1) & (Y > 7.5) & (Y < 13.5)) | ((np.abs(Y - 11.2) < 0.9) & (np.abs(X - CX) < 2.6)))
    P.flat(g, cross, "gold", 6)
    return g


def torso() -> Grid:
    g = Grid(*SH)
    X, Y, Z = coords(g)
    st = len(g.solids)
    spine = box(g, int(CX) - 1, 13, int(CZ) + 1, int(CX) + 2, 20, int(CZ) + 4, BONE, BONE_B)
    ribs = plan(g, chamfer_rect(CX - 4.5, CZ - 3, CX + 4.5, CZ + 3, 1.5), 16, 20.5, BONE, BONE_B, top=chamfer_rect(CX - 6, CZ - 3.8, CX + 6, CZ + 3.8, 1.8))
    bones(g, st, seed=5)
    # ribs: dark gaps every other row, the sternum stays whole
    P.flat(g, ribs & (np.floor(Y) % 2 == 0) & (np.abs(X - CX) > 1.2), "darkwood", 3)
    P.flat(g, spine & (np.floor(Y) % 2 == 0), BONE, 4)
    st = len(g.solids)
    chest = plan(g, chamfer_rect(CX - 6.5, CZ - 4, CX + 6.5, CZ + 4, 1.8), 20, 23.5, PLATE, PLATE_B, top=chamfer_rect(CX - 8.5, CZ - 5, CX + 8.5, CZ + 4.8, 2.2))
    chest |= plan(g, chamfer_rect(CX - 8.5, CZ - 5, CX + 8.5, CZ + 4.8, 2.2), 23.5, 26, PLATE, PLATE_B, top=chamfer_rect(CX - 6.5, CZ - 3.5, CX + 6.5, CZ + 3.5, 1.8))
    plates(g, st)
    P.flat(g, chest & (Y < 20.8), "gold", 4)  # gold lower rim
    P.flat(g, chest & (np.abs(X - CX) < 0.6) & (Z < CZ - 3), PLATE, 6)  # the ridge line
    # a gold sun on the chest
    sun = chest & (Z < CZ - 3.5) & ((np.abs(X - CX) + np.abs(Y - 22.8)) < 2.6)
    P.flat(g, sun, "gold", 6)
    P.flat(g, sun & ((np.abs(X - CX) + np.abs(Y - 22.8)) < 1.1), "gold", 7)
    neck = box(g, int(CX) - 1, 25, int(CZ) - 1, int(CX) + 2, 28, int(CZ) + 2, BONE, 5)
    P.flat(g, neck & (np.floor(Y) % 2 == 0), BONE, 4)
    return g


def head() -> Grid:
    g = Grid(*SH)
    X, Y, Z = coords(g)
    sk = S.skull(g, SKULL["cx"], SKULL["y0"], SKULL["cz"], s=SKULL["s"], ramp=BONE, base=BONE_B, eyes=("cyan", 7), socket=("navy", 2), seed=6)
    fz = SKULL["cz"] - 5.4
    # glow rims around the pupils (magic cyan, rule C3)
    for sx in (-1, 1):
        ex = CX + sx * 2.64
        ring = sk & (Z < fz + 1.2) & (np.abs(X - ex) < 1.6) & (np.abs(Y - 30.85) < 1.6) & ~((np.abs(X - ex) < 0.8) & (np.abs(Y - 30.85) < 0.8))
        P.flat(g, ring & (np.abs(Y - 30.85) < 1.0), "cyan", 5)
    # an open steel helm over the cranium, a gold band, a cheek guard each side
    st = len(g.solids)
    cz = SKULL["cz"]
    helm = plan(g, chamfer_rect(CX - 7, cz - 6.2, CX + 7, cz + 6.2, 2.2), 33, 37, PLATE, PLATE_B)
    helm |= plan(g, chamfer_rect(CX - 7, cz - 6.2, CX + 7, cz + 6.2, 2.2), 37, 40.5, PLATE, PLATE_B, top=chamfer_rect(CX - 4, cz - 3.6, CX + 4, cz + 3.6, 1.4))
    for sx in (-1, 1):
        helm |= front(g, [(CX + sx * 7, 33.5), (CX + sx * 7, 28), (CX + sx * 5.6, 26.5), (CX + sx * 5.6, 33.5)], cz - 4, cz + 5.5, PLATE, PLATE_B)
    plates(g, st, ENAMEL_B, ENAMEL)
    P.flat(g, helm & (Y < 33) & (Y > 27.5) & ((np.floor(Y) % 2) == 0), ENAMEL, ENAMEL_B - 1)  # cheek guard lames
    band = helm & (Y > 33) & (Y < 35)
    P.flat(g, band, "gold", 5)
    P.flat(g, band & (np.floor(X + Z) % 4 == 0), "gold", 7)
    P.flat(g, helm & (Y < 33.8) & (Y > 33) & (Z < cz - 5.5), "gold", 4)
    # a nose guard down the middle of the brow
    ng = box(g, int(CX) - 1, 30, int(fz) - 1, int(CX) + 1, 35, int(fz) + 1, PLATE, PLATE_B + 1)
    P.flat(g, ng & (Y < 31), "gold", 5)
    # the tall red crest (a true-slope fan) on a gold socket
    box(g, int(CX) - 1, 40, int(cz) - 1, int(CX) + 1, 42, int(cz) + 2, "gold", 5)
    st = len(g.solids)
    crest = side(g, [(40.5, cz - 5.5), (43.5, cz - 3), (43.6, cz + 3), (41.5, cz + 8), (39.5, cz + 7.5), (40, cz + 3)], CX - 1.3, CX + 1.3, "red", 4)
    facet_paint(g, g.solids[st:], lambda gg, mm, fr: P.flat(gg, mm, "red", 5 if fr == "top" else 4))
    P.flat(g, crest & (np.floor(Z) % 3 == 0) & (Y < 43), "red", 3)  # feather streaks
    return g


def arm(s: int) -> Grid:
    g = Grid(*SH)
    X, Y, Z = coords(g)
    sx = CX + s * 9
    st = len(g.solids)
    front(g, S.quad((sx + s * 1, SHOULDER_Y), (sx + s * 2.2, 15.5), 2.0, 1.8), CZ - 2, CZ + 2, BONE, BONE_B)
    front(g, S.quad((sx + s * 2.2, 16), (sx + s * 2.6, 10), 1.8, 1.7), CZ - 1.8, CZ + 1.8, BONE, BONE_B)
    bones(g, st, seed=7 + s)
    hx = sx + s * 2.6
    # a big bony hand with dark finger splits
    hand = box(g, int(round(hx)) - 3, 6, int(CZ) - 3, int(round(hx)) + 2, 11, int(CZ) + 2, BONE, BONE_B)
    bone_paint(g, hand, seed=9)
    P.flat(g, hand & (np.floor(X) % 2 == 0) & (Y < 9) & (Z < CZ - 2), BONE, 3)
    st = len(g.solids)
    vam = plan(g, chamfer_rect(hx - 2.8, CZ - 2.8, hx + 2.8, CZ + 2.8, 1), 11, 15, PLATE, PLATE_B, top=chamfer_rect(hx - 3.2, CZ - 3.2, hx + 3.2, CZ + 3.2, 1))
    # a big sloped pauldron: a frustum dome over the shoulder, gold rim
    px = sx + s * 1.5
    pau = plan(g, chamfer_rect(px - 5, CZ - 5, px + 5, CZ + 5, 2), 20, 23, PLATE, PLATE_B, top=chamfer_rect(px - 5.2, CZ - 5.2, px + 5.2, CZ + 5.2, 2))
    pau |= plan(g, chamfer_rect(px - 5.2, CZ - 5.2, px + 5.2, CZ + 5.2, 2), 23, 27, PLATE, PLATE_B, top=chamfer_rect(px - 2 + s * 1.5, CZ - 2.5, px + 2 + s * 1.5, CZ + 2.5, 1))
    plates(g, st)
    plates(g, len(g.solids) - 2, ENAMEL_B, ENAMEL)
    P.flat(g, vam & (Y > 14.2), "gold", 5)
    P.flat(g, pau & (Y < 21), "gold", 5)
    P.flat(g, pau & (Y < 21) & (np.floor(X + Z) % 3 == 0), "gold", 7)
    P.flat(g, pau & (Y > 23) & (Y < 24), ENAMEL, ENAMEL_B - 1)  # a lame line
    if s > 0:
        # a longsword in the fist: the pommel under the fist, the grip through
        # it, the gold guard sitting right on top of it, and the blade leaning
        # forward so it clears the pauldron and reads as held
        ix = int(round(hx)) - 1
        box(g, ix - 1, 4, int(CZ) - 2, ix + 2, 6, int(CZ) + 1, "gold", 6)
        box(g, ix - 1, 6, int(CZ) - 2, ix + 2, 11, int(CZ) + 1, "darkwood", 4)
        guard = box(g, ix - 2, 11, int(CZ) - 5, ix + 3, 13, int(CZ) + 4, "gold", 5)
        P.flat(g, guard & (Y > 12), "gold", 7)
        st = len(g.solids)
        blade = side(g, S.quad((13, CZ - 0.5), (31, CZ - 12.5), 2.3, 1.7, cap=1.2), ix - 0.3, ix + 1.3, "steel", 6)
        facet_paint(g, g.solids[st:], lambda gg, mm, fr: P.flat(gg, mm, "steel", 6))
        # a darker fuller down the middle, bright edges
        t = (Y - 13) / 18.0
        mid = CZ - 0.5 - 12 * t
        P.flat(g, blade & (np.abs(Z - mid) < 0.55) & (Y < 28), "steel", 4)
        P.flat(g, blade & (np.abs((Z - mid) * 0.83 + (Y - 13 - 18 * t) * 0.55) > 1.4), "steel", 7)
    else:
        # a royal-blue kite shield with a gold rim and a gold cross, facing -z
        st = len(g.solids)
        kite = front(g, [(hx - 6.5, 24), (hx + 6.5, 24), (hx + 6.5, 13), (hx, 3.5), (hx - 6.5, 13)], CZ - 6, CZ - 3.5, CLOTH, 4)
        facet_paint(g, g.solids[st:], lambda gg, mm, fr: P.mottle(gg, mm, CLOTH, 4, cell=3, seed=10))
        P.outline(g, kite & (Z < CZ - 5), "gold", 5, normal="z")
        rim = kite & (Z >= CZ - 5)
        P.flat(g, rim, CLOTH, 2)
        cross = kite & (Z < CZ - 5) & (((np.abs(X - hx) < 1.1) & (Y > 8) & (Y < 22)) | ((np.abs(Y - 18) < 1.1) & (np.abs(X - hx) < 4.6)))
        P.flat(g, cross, "gold", 6)
        P.flat(g, cross & (np.abs(X - hx) < 0.6) & (np.abs(Y - 18) < 0.6), "gold", 7)
    return g


def build():
    parts = {"skeleton-knight": pelvis(), "torso": torso(), "head": head(), "arm-l": arm(-1), "arm-r": arm(1), "leg-l": leg(-1), "leg-r": leg(1)}
    root, to_root = rig([
        ("skeleton-knight", parts["skeleton-knight"], None, None),
        ("leg-l", parts["leg-l"], (CX - 4.5, HIP_Y, CZ), None),
        ("leg-r", parts["leg-r"], (CX + 4.5, HIP_Y, CZ), None),
        ("torso", parts["torso"], (CX, WAIST_Y, CZ), None),
        ("head", parts["head"], (CX, NECK_Y, CZ), "torso"),
        ("arm-l", parts["arm-l"], (CX - 9.5, SHOULDER_Y, CZ), "torso"),
        ("arm-r", parts["arm-r"], (CX + 9.5, SHOULDER_Y, CZ), "torso"),
    ])
    idle = {"torso": {"rot": keys((0, 0, 0, 0), (1.0, 3, 0, 3), (2.0, 0, 0, 0))},
            "head": {"rot": keys((0, 0, 0, 0), (0.6, 0, 0, -8), (1.1, 0, 12, -8), (1.5, 0, 0, 0), (2.0, 0, 0, 0))},
            "arm-r": {"rot": keys((0, 0, 0, 0), (1.0, 6, 0, 0), (2.0, 0, 0, 0))},
            "arm-l": {"rot": keys((0, 0, 0, 0), (1.0, -4, 0, 0), (2.0, 0, 0, 0))}}
    attack = {"arm-r": {"rot": keys((0, 0, 0, 0), (0.3, -150, 0, 10), (0.45, 55, 0, 0), (0.55, 50, 0, 0), (0.9, 0, 0, 0))},
              "torso": {"rot": keys((0, 0, 0, 0), (0.3, 10, -14, 0), (0.45, -18, 12, 0), (0.9, 0, 0, 0))},
              "head": {"rot": keys((0, 0, 0, 0), (0.3, 8, 0, 0), (0.45, -10, 0, 0), (0.9, 0, 0, 0))},
              "arm-l": {"rot": keys((0, 0, 0, 0), (0.3, -20, 0, 0), (0.45, 15, 0, 0), (0.9, 0, 0, 0))}}
    hit = {"torso": {"rot": keys((0, 0, 0, 0), (0.1, 15, 0, -8), (0.45, 0, 0, 0))},
           "head": {"rot": keys((0, 0, 0, 0), (0.1, 25, 0, 10), (0.2, 18, 0, 12), (0.45, 0, 0, 0))},
           "arm-l": {"rot": keys((0, 0, 0, 0), (0.1, 25, 0, -10), (0.45, 0, 0, 0))}}
    death = {"torso": {"loc": keys((0, 0, 0, 0), (0.3, 0, -3, 0), (0.8, 0, -10, 1)), "rot": keys((0, 0, 0, 0), (0.8, -28, 0, 18))},
             "head": {"loc": keys((0, 0, 0, 0), (0.35, 0, 3, 0), (0.9, 8, -21, -6), (1.2, 12, -21, -7)), "rot": keys((0, 0, 0, 0), (0.9, 70, 40, 0), (1.2, 80, 110, 0))},
             "arm-l": {"rot": keys((0, 0, 0, 0), (0.8, 0, 0, -80))}, "arm-r": {"rot": keys((0, 0, 0, 0), (0.8, 30, 0, 85))},
             "leg-l": {"rot": keys((0, 0, 0, 0), (0.8, -50, 0, -25))}, "leg-r": {"rot": keys((0, 0, 0, 0), (0.8, -50, 0, 25))},
             "skeleton-knight": {"loc": keys((0, 0, 0, 0), (0.8, 0, -4, 0))}}
    eyes = (CX, 30.85, SKULL["cz"] - 5.4)
    return asset("creatures", "skeleton-knight", "Skeleton Knight", root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 sockets=[Socket("socket-eyes", at=to_root(eyes), parent="head")],
                 fx=[pfx("rvx-fantasy-bone-poof", "socket-eyes", "clip:death", size=34, at=0.24)])
