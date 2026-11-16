"""Skeleton knight in the Pirate Nation creature style.

A chunky caricature: a big bone skull (almost half the height) with glowing
magic-cyan eyes, under an open steel helm with a gold band and a tall red
crest. A steel breastplate with a gold sun over a bone ribcage and spine,
a royal-blue tabard with gold trim, big sloped steel pauldrons, thick bone
limbs in steel greaves and sabatons, big bony hands. The right fist holds
a longsword leaning forward, the left arm a royal-blue kite shield with a gold
cross. Limbs, pauldrons, helm, crest, tabard and blade are true-slope
prisms; ribs, joints, plates and trims are painted.
Clips: idle (sway, look), attack (overhead chop), hit, death (clatters
over backwards, the skull bounces and rolls off). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _falls_flyers import axis_m, euler_m, lunge, m_euler, shove_hit, slerp_m, smooth_at
from _life import asset, chamfer_rect, coords, facet_paint, front, keys, pfx, plan, rig, side
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket
from _move_gaits import Gait, cyc, per_frame, thump, turn_loop

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
    # The right fingers close around the sword grip.
    if s > 0:
        hand = box(g, int(round(hx)) - 3, 6, int(CZ), int(round(hx)) + 2, 11, int(CZ) + 2, BONE, BONE_B)
        hand |= box(g, int(round(hx)) - 3, 8, int(CZ) - 3, int(round(hx)) - 1, 11, int(CZ) + 1, BONE, BONE_B)
        for finger_y in (7, 9):
            hand |= box(g, int(round(hx)) - 2, finger_y, int(CZ) - 3,
                        int(round(hx)) + 2, finger_y + 1, int(CZ) + 1, BONE, BONE_B)
    else:
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
    if s < 0:
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


# the right fist (arm(1)): the longsword's wrist hinge sits in the middle of the grip
SWORD_X = int(round(CX + 9 + 2.6)) - 1
WRIST_R = (SWORD_X + 0.5, 8.5, CZ - 0.5)


def longsword() -> Grid:
    """A longsword in the right fist, a separate part on a wrist hinge so the
    attack can turn the blade through the cut: the pommel under the fist,
    the grip through it, the gold guard right on top of it, and the blade
    leaning forward so it clears the pauldron and reads as held."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    ix = SWORD_X
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
    return g


# ------------------------------------------------------------------ death
ARM_L_REST = (48.0, -70.0, -90.0)  # the shield arm lying spread, the shield flat on its face
LEG_REST = -11.0  # the legs lying flat, the sabatons on the floor
TORSO_LAND = 12.0  # the chest bent back onto the floor as it lies
# measured on the built model: how far the rolling skull still sits off the
# floor (or, negative, dips into it) on each frame of the roll, trimmed out
ROLL_TRIM = {35: -0.1, 36: -0.0, 37: 0.08, 38: 0.08, 39: 0.05, 40: 0.04, 41: 0.03, 42: 0.04, 43: 0.05, 44: 0.08, 45: 0.14, 46: 0.16, 47: 0.17, 48: 0.2, 49: 0.22, 50: 0.25, 51: 0.27, 52: 0.3, 53: 0.32, 54: 0.35, 55: 0.37, 56: 0.39, 57: 0.35, 58: 0.27, 59: 0.22, 60: 0.17, 61: 0.15, 62: 0.14}
DEBUG = None  # set to {} to collect each part's lowest point per frame (before the lift)

def knight_death(parts: dict, to_root):
    """The death, baked one key a frame so the loose skull can be keyed in
    the WORLD (it is a child of the torso) and roll in one motion.

    A blow rocks it back on its heels and knocks the skull loose on its
    neck; it teeters forward onto its toes and, still drifting (a moving
    hold), tips over backwards (toward +Z, away from the attacker) about
    its heels, falling with gravity (the angle grows as t^2, fastest at the
    impact) onto its back: a heavy thud with a squash (f27), one small
    bounce, a hard settle. The arms fly up and slam down spread a frame
    late, the sword clatters, the legs kick and drop. The skull comes off
    the neck as it goes, lands two frames after the body, bounces once and
    rolls away to the side in ONE continuous, slowing roll (rolling on its
    rim, so it never stops and starts again). Every pose is keyed AT the
    floor from the real geometry: nothing sinks and nothing floats.
    Returns (clip_keys, impact seconds)."""
    F = 1 / 30
    END = 70
    IMP = 27  # the body hits the floor
    TOP = 15  # the last of the teeter: the fall starts here
    DET = 17  # the skull leaves the neck
    HLAND = IMP + 2  # the skull hits the floor two frames after the body
    ROLL_END = 62  # the skull stops rolling

    def pts(name):
        """The part's voxel centres in the shared frame."""
        nz = np.nonzero(parts[name].a)
        return np.stack([nz[0] + 0.5, nz[1] + 0.5, nz[2] + 0.5], 1).astype(float)

    waist = np.array((CX, WAIST_Y, CZ))
    neck = np.array((CX, NECK_Y, CZ))
    hips = {"leg-l": np.array((CX - 4.5, HIP_Y, CZ)), "leg-r": np.array((CX + 4.5, HIP_Y, CZ))}
    origin = -np.asarray(to_root((0.0, 0.0, 0.0)))  # the root pivot in the shared frame
    pelvis_p = pts("skeleton-knight") - origin
    torso_p = pts("torso") - waist
    leg_p = {k: pts(k) - v for k, v in hips.items()}
    head_p = pts("head") - neck
    torso_at = waist - origin
    hip_at = {k: v - origin for k, v in hips.items()}
    head_at = neck - waist
    # the sabatons' heel and toe on the floor (root space), the pins as it rocks
    heel = np.array(to_root((CX, 0.0, CZ + 4.0)))
    toe = np.array(to_root((CX, 0.0, CZ - 7.0)))

    # the root's pitch (back = +x): rocked back, teeter forward, a slow drift
    # back off the toes, then the fall: -2.5 + v0 t + c t^2 onto 90 at IMP
    def pitch(fr):
        if fr <= 10:
            return smooth_at([(0, (0.0,)), (4, (6.0,)), (10, (-4.0,))], fr)[0]
        if fr <= TOP:
            return -4.0 + 1.5 * ((fr - 10) / 5) ** 2
        if fr <= IMP:
            t = fr - TOP
            v0 = 2 * 1.5 / 5
            c = (92.5 - v0 * (IMP - TOP)) / (IMP - TOP) ** 2
            return -2.5 + v0 * t + c * t * t
        return smooth_at([(IMP, (90.0,)), (IMP + 2, (88.5,)), (IMP + 4, (90.0,)), (END, (90.0,))], fr)[0]

    def fall_u(fr):
        return max(0.0, min(1.0, (fr - TOP) / (IMP - TOP)))

    def root_rot(fr):
        u = fall_u(fr)
        return (pitch(fr), 4.0 * u * u, 3.0 * u * u)

    def root_scale(fr):
        return smooth_at([(0, (1, 1, 1)), (IMP - 1, (1, 1, 1)), (IMP, (1.04, 1.03, 0.9)), (IMP + 2, (0.99, 0.99, 1.03)), (IMP + 5, (1, 1, 1)), (END, (1, 1, 1))], fr) \
            if fr >= IMP - 1 else (1.0, 1.0, 1.0)

    def torso_rot(fr):
        if fr <= TOP:
            return smooth_at([(0, (0, 0, 0)), (4, (12, 0, -3)), (10, (-8, 0, 2)), (TOP, (-12, 0, 0))], fr)
        if fr <= IMP:
            u = fall_u(fr)
            return (-12 + (12 + TORSO_LAND) * u ** 1.6, 0.0, 0.0)
        tl = TORSO_LAND
        return smooth_at([(IMP, (tl, 0, 0)), (IMP + 2, (tl - 1, 0, 0)), (IMP + 5, (tl + 0.5, 0, 0)), (IMP + 8, (tl, 0, 0)), (END, (tl, 0, 0))], fr)

    # the legs kick up as it lands and drop flat, the sabatons lying on the
    # floor (after the kick every key only goes down: no second hump)
    leg_rows = {"leg-l": [(0, (0, 0, 0)), (TOP, (0, 0, 0)), (22, (3, 0, -2)), (IMP, (6, 0, -4)), (IMP + 2, (12, 0, -6)), (IMP + 5, (LEG_REST, 0, -6)),
                          (END, (LEG_REST, 0, -6))],
                "leg-r": [(0, (0, 0, 0)), (TOP, (0, 0, 0)), (23, (2, 0, 2)), (IMP, (4, 0, 5)), (IMP + 3, (10, 0, 6)), (IMP + 6, (LEG_REST - 2, 0, 6)),
                          (END, (LEG_REST - 2, 0, 6))]}

    def bounce(fr):
        return smooth_at([(IMP, (0.0,)), (IMP + 2, (0.7,)), (IMP + 4, (0.0,)), (END, (0.0,))], fr)[0] if fr >= IMP else 0.0

    a = 12.0  # the arms rest a little up off the floor, spread wide
    arm_rows = {"arm-l": [(0, (0, 0, 0)), (4, (-20, 0, -18)), (10, (20, 0, -10)), (21, (75, 0, -40)), (IMP - 2, (66, 20, -50)),
                          (IMP, ARM_L_REST), (IMP + 2, (ARM_L_REST[0] + 9, ARM_L_REST[1] - 14, ARM_L_REST[2] + 8)),
                          (IMP + 6, (ARM_L_REST[0], ARM_L_REST[1] + 2, ARM_L_REST[2] - 2)), (IMP + 9, ARM_L_REST), (END, ARM_L_REST)],
                "arm-r": [(0, (0, 0, 0)), (4, (-18, 0, 16)), (10, (16, 0, 12)), (22, (68, 0, 46)), (IMP - 2, (60, 0, 52)),
                          (IMP, (a, 0, 64)), (IMP + 2, (a + 8, 0, 56)), (IMP + 6, (a, 0, 66)), (IMP + 9, (a, 0, 64)), (END, (a, 0, 64))]}
    # the sword swings up as it lands and clatters down a few frames late
    sword_rows = [(0, (0, 0, 0)), (10, (8, 0, 0)), (22, (-20, 0, 0)), (IMP - 1, (-28, 0, 0)), (IMP + 2, (-8, 0, 0)), (IMP + 7, (29, 0, 0)), (END, (29, 0, 0))]
    shoulders = {"arm-l": np.array((CX - 9.5, SHOULDER_Y, CZ)), "arm-r": np.array((CX + 9.5, SHOULDER_Y, CZ))}
    arm_p = {k: pts(k) - v for k, v in shoulders.items()}
    sword_p = pts("longsword") - np.array(WRIST_R)
    wrist_at = np.array(WRIST_R) - shoulders["arm-r"]

    def limbs(fr):
        """The arms and the sword in the torso's frame (from the waist)."""
        out = {}
        for k in arm_p:
            ra = euler_m(smooth_at(arm_rows[k], fr))
            out[k] = (shoulders[k] - waist) + arm_p[k] @ ra.T
            if k == "arm-r":
                out["longsword"] = (shoulders[k] - waist) + (wrist_at + sword_p @ euler_m(smooth_at(sword_rows, fr)).T) @ ra.T
        return out

    def body_world(fr):
        """(root loc, root linear map, torso origin, torso linear map) with
        the lowest point of the pelvis, the legs and the torso on the floor
        and the pinned foot kept in place along the floor."""
        r = euler_m(root_rot(fr))
        lin = r @ np.diag(root_scale(fr))
        tr = euler_m(torso_rot(fr))
        named = {"pelvis": pelvis_p, "torso": torso_at + torso_p @ tr.T}
        for k in leg_p:
            named[k] = hip_at[k] + leg_p[k] @ euler_m(smooth_at(leg_rows[k], fr)).T
        for k, v in limbs(fr).items():
            named[k] = torso_at + v @ tr.T
        cloud = list(named.values())
        if DEBUG is not None:
            DEBUG.setdefault(fr, {k: float((v @ lin.T)[:, 1].min()) for k, v in named.items()})
        # voxel centres: the faces are half a voxel out, the sloped tabard a
        # little more once it lies on it
        low = min(float((c @ lin.T)[:, 1].min()) for c in cloud) - 0.5 + 0.2 * max(0.0, min(1.0, (pitch(fr) - 45) / 45))
        pin = heel if pitch(fr) > 0 else toe
        dz = pin[2] - (lin @ pin)[2]
        loc = np.array([0.0, -low + bounce(fr), dz])
        return loc, lin, loc + lin @ torso_at, lin @ tr

    root_k, torso_k, scale_k, leg_k = [], [], [], {k: [] for k in leg_rows}
    head_rot, head_loc = [], []
    pre_rot = [(0, (0, 0, 0)), (3, (18, 0, 4)), (8, (-12, 6, 0)), (13, (10, -6, 4)), (DET, (-16, 8, 0))]
    pre_loc = [(0, (0, 0, 0)), (3, (0, 1.6, 0)), (8, (0, 1.0, 0.3)), (13, (0, 2.0, 0)), (DET, (0, 2.4, -0.4))]

    def head_world(fr, lrot, lloc):
        _, _, o, m = body_world(fr)
        return m @ euler_m(lrot), o + m @ (head_at + np.asarray(lloc))

    head_c = head_p.mean(axis=0)  # the skull's centre, from the neck: it rolls about this

    def support(q):
        """How high the skull's centre sits when it rests on the floor."""
        return 0.5 - float(((head_p - head_c) @ q.T)[:, 1].min())

    # where and how the skull lands: tumbled onto its cheek (the crown
    # pointing off to the side, the face up) past the top of the head, so
    # it rolls away from the body over its face and the back of the helm,
    # the crest along the axis it rolls about (it never digs in)
    q_att_land, p_att_land = head_world(HLAND, pre_rot[-1][1], pre_loc[-1][1])
    q_land = axis_m((1, 0, 0), 20) @ np.array([[0.0, 1.0, 0.0], [0.0, 0.0, -1.0], [-1.0, 0.0, 0.0]])
    c_att_land = p_att_land + q_att_land @ head_c
    c_land = c_att_land + np.array([1.5, 0.0, 5.0])
    c_land[1] = support(q_land)
    # how far it rolls, and its rolling radius: it lands tipped 20 degrees and
    # rolls 160 more, so it stops a half turn over, flat on its face
    RR = 6.6
    D = math.radians(160.0) * RR
    q_det, p_det = head_world(DET, pre_rot[-1][1], pre_loc[-1][1])
    c_det = p_det + q_det @ head_c
    grav = 2 * (c_det[1] + 0.3 * (HLAND - DET) - c_land[1]) / (HLAND - DET) ** 2

    for fr in range(0, END + 1):
        loc, lin, o, m = body_world(fr)
        root_k.append((fr * F, root_rot(fr)))
        scale_k.append((fr * F, root_scale(fr)))
        torso_k.append((fr * F, torso_rot(fr)))
        for k in leg_rows:
            leg_k[k].append((fr * F, smooth_at(leg_rows[k], fr)))
        if fr <= DET:
            head_rot.append((fr * F, smooth_at(pre_rot, fr)))
            head_loc.append((fr * F, smooth_at(pre_loc, fr)))
            # the root's location goes in below, after the floor pass
            root_k[-1] = (fr * F, root_rot(fr), tuple(loc))
            continue
        q_att, p_att = head_world(fr, pre_rot[-1][1], pre_loc[-1][1])
        if fr <= HLAND:
            w = ((fr - DET) / (HLAND - DET)) ** 2
            q = slerp_m(q_att, q_land, w)
            # it flies off the neck on its own arc: along the floor it goes
            # with the fall, up and down it falls with gravity from a little
            # pop, so it is still in the air when the body lands
            t = fr - DET
            s_ = t / (HLAND - DET)
            c = c_det + (c_land - c_det) * (s_ * (2 - s_) * 0.5 + s_ * 0.5)
            c[1] = c_det[1] + 0.3 * t - 0.5 * grav * t * t
            c[1] = max(c[1], support(q))
        else:
            r = min(1.0, (fr - HLAND) / (ROLL_END - HLAND))
            d = D * (1 - (1 - r) ** 2)
            # rolling back (+z) about the world x axis, drifting a little to the side
            q = axis_m((1, 0, 0), math.degrees(d / RR)) @ q_land
            b = fr - HLAND
            hop = 1.8 * (1 - ((b - 3) / 3) ** 2) if b < 6 else 0.0
            c = c_land + np.array([0.25 * d, 0.0, d])
            # voxel centres overstate the chamfered rim when it rolls over a
            # corner (45 degrees off a flat face): sit it that much lower there
            ang = math.radians(20.0) + d / RR
            c[1] = support(q) - 0.15 * abs(math.sin(2 * ang)) - ROLL_TRIM.get(fr, 0.0) + hop
        # into the torso's frame (its linear map carries the root's squash:
        # keep the rotation part)
        p = c - q @ head_c  # the neck hinge
        inv = np.linalg.inv(m)
        u_, _, vt = np.linalg.svd(inv @ q)
        head_rot.append((fr * F, m_euler(u_ @ vt)))
        head_loc.append((fr * F, tuple(inv @ (p - o) - head_at)))
        root_k[-1] = (fr * F, root_rot(fr), tuple(loc))
    out = {"skeleton-knight": {"rot": [(t, r) for t, r, _ in root_k], "loc": [(t, l) for t, _, l in root_k], "scale": scale_k},
           "torso": {"rot": torso_k}, "head": {"rot": head_rot, "loc": head_loc},
           "leg-l": {"rot": leg_k["leg-l"]}, "leg-r": {"rot": leg_k["leg-r"]},
           "arm-l": {"rot": [(fr * F, v) for fr, v in arm_rows["arm-l"]]}, "arm-r": {"rot": [(fr * F, v) for fr, v in arm_rows["arm-r"]]},
           "longsword": {"rot": [(fr * F, v) for fr, v in sword_rows]}}
    return out, IMP * F


def march_move(root) -> dict:
    """move: a stiff armoured march, 32 frames (two steps). The legs swing
    straight from the hip (high, square lifts) and stamp down flat,
    accelerating; the armour jolts down 1 frame past each stamp and locks.
    The torso stays upright and square (no sway, only a small set of the
    shoulders over the planted foot); the arms swing stiffly from the
    shoulder, the sword arm short and held, the shield arm fuller, and
    the skull jolts with the body (no lag: a skeleton has no give).
    Authored with contacts on f8 and f24; turn_loop then starts the loop
    where no channel turns at the seam."""
    T, CL, CR = 32, 8, 24
    gait = Gait(root, "skeleton-knight", ["leg-l", "leg-r"])
    th = thump(T, [CL, CR], depth=1.1, fall=4, past=1)
    s = gait.walk(T, {"leg-l": CL / T, "leg-r": CR / T}, duty=0.58, stride=9.0, lift=3.5, height=lambda f: 0.3 - th(f), carry=0.7, land=0.25)
    sq = thump(T, [CL, CR], depth=1.0, fall=1, past=1, rise=3)

    def z(*v):
        return np.array(v, float)
    s["torso"] = {"rot": [r + z(-2 * sq(f), 0, 0) for f, r in enumerate(
        cyc([(0, z(-2, 0, 0)), (CL + 1, z(-2, 4, 2), "snap"), (14, z(-2, 4, 2)), (16, z(-2, 0, 0)), (CR + 1, z(-2, -4, -2), "snap"), (30, z(-2, -4, -2))], T))]}
    s["head"] = {"rot": [z(-3 * sq((f - 1) % T), 0, 0) for f in range(T + 1)]}
    # stiff pendulums: they snap to each end and hold it until the next step
    s["arm-l"] = {"rot": cyc([(0, z(0, 0, 0)), (CL + 1, z(-18, 0, 0), "snap"), (14, z(-16, 0, 0)), (CR + 1, z(18, 0, 0), "snap"), (30, z(16, 0, 0))], T)}
    s["arm-r"] = {"rot": cyc([(0, z(0, 0, 0)), (CL + 1, z(8, 0, 0), "snap"), (14, z(7, 0, 0)), (CR + 1, z(-8, 0, 0), "snap"), (30, z(-7, 0, 0))], T)}
    s, _ = turn_loop(s, T)
    return per_frame(s)


def build():
    parts = {"skeleton-knight": pelvis(), "torso": torso(), "head": head(), "arm-l": arm(-1), "arm-r": arm(1), "longsword": longsword(), "leg-l": leg(-1), "leg-r": leg(1)}
    root, to_root = rig([
        ("skeleton-knight", parts["skeleton-knight"], None, None),
        ("leg-l", parts["leg-l"], (CX - 4.5, HIP_Y, CZ), None),
        ("leg-r", parts["leg-r"], (CX + 4.5, HIP_Y, CZ), None),
        ("torso", parts["torso"], (CX, WAIST_Y, CZ), None),
        ("head", parts["head"], (CX, NECK_Y, CZ), "torso"),
        ("arm-l", parts["arm-l"], (CX - 9.5, SHOULDER_Y, CZ), "torso"),
        ("arm-r", parts["arm-r"], (CX + 9.5, SHOULDER_Y, CZ), "torso"),
        ("longsword", parts["longsword"], WRIST_R, "arm-r"),
    ])
    idle = {"torso": {"rot": keys((0, 0, 0, 0), (1.0, 3, 0, 3), (2.0, 0, 0, 0))},
            "head": {"rot": keys((0, 0, 0, 0), (0.6, 0, 0, -8), (1.1, 0, 12, -8), (1.5, 0, 0, 0), (2.0, 0, 0, 0))},
            "arm-r": {"rot": keys((0, 0, 0, 0), (1.0, 6, 0, 0), (2.0, 0, 0, 0))},
            "arm-l": {"rot": keys((0, 0, 0, 0), (1.0, -4, 0, 0), (2.0, 0, 0, 0))}}
    # a diagonal slash, as on the goblin: the wind-up lifts the fist above the shoulder with the
    # blade up and back; the cut drives the fist across the belly while the wrist sweeps the blade
    # from over the helm, across the front, to the left hip. The keys were solved for tip and fist
    # targets (the cut crosses the front, so it reads from the preview camera on the shield side);
    # each key step stays under 150 degrees, as the export takes the shortest way between keys.
    # the hold after the cut keeps moving: the blade drives on past the
    # contact (f18), rebounds (f20) and sags (f22) while the torso, the head
    # and the shield arm keep swinging; the recovery overshoots rest (f28)
    attack = {"arm-r": {"rot": keys((0, 0, 0, 0), (0.2, 0, -30, 66), (0.3667, 66, -56, 61), (0.4333, 71, -60, 61), (0.5333, 46, 36, 12), (0.6, 40, 42, 6),
                                    (0.6667, 47, 33, 13), (0.7333, 42, 40, 8), (0.9333, -6, -4, -6), (1.0333, 0, 0, 0))},
              "longsword": {"rot": keys((0, 0, 0, 0), (0.2, 21, -10, -53), (0.3667, -18, -38, -53), (0.4333, -22, -42, -54), (0.5333, -91, -11, -20), (0.6, -84, -7, -17),
                                        (0.6667, -86, -13, -22), (0.7333, -93, -9, -18), (0.9333, 6, 2, 4), (1.0333, 0, 0, 0))},
              "torso": {"rot": keys((0, 0, 0, 0), (0.2, 5, -9, 0), (0.3667, 11, -20, 0), (0.4333, 12, -23, 0), (0.5333, -18, 18, 0), (0.6, -28, 27, 0), (0.6667, -15, 15, 0),
                                    (0.7333, -19, 19, 0), (0.9, 4, -4, 0), (1.0333, 0, 0, 0))},
              "head": {"rot": keys((0, 0, 0, 0), (0.4333, 10, 6, 0), (0.5667, -11, -6, 0), (0.6333, -15, -9, 3), (0.7, -6, -2, -2), (0.7667, -11, -6, 0), (0.9333, 4, 2, 0),
                                   (1.0333, 0, 0, 0))},
              "arm-l": {"rot": keys((0, 0, 0, 0), (0.4333, -22, 0, 0), (0.5667, 18, 0, 0), (0.6333, 24, 0, -4), (0.7, 10, 0, 2), (0.8, 18, 0, 0), (0.9333, -5, 0, 0),
                                    (1.0333, 0, 0, 0))},
              "skeleton-knight": {"loc": keys((0, 0, 0, 0), (0.3667, 0, 0, 1.7), (0.4333, 0, 0, 2.0), (0.5333, 0, 0, -4.5), (0.6, 0, 0, -6.4), (0.7333, 0, 0, -4.5), (1.0333, 0, 0, 0))}}
    # the chop steps in: the left foot plants forward on the cut, the right
    # stays put, and both step home after the hold (feet never slide)
    # a shorter lunge keeps the rigid rear leg from tipping its toes into the floor
    attack["skeleton-knight"]["loc"] = [(tt, (x, y, z * 0.8)) for tt, (x, y, z) in attack["skeleton-knight"]["loc"]]
    legs, attack["skeleton-knight"]["loc"] = lunge(attack["skeleton-knight"]["loc"], L=12.0, stride=-7.0, lift_t=0.3667, plant_t=0.5333, back_t=0.7333, home_t=0.9333)
    # the rigid lead leg reaches forward with its sole tipped up, so its heel
    # would hover: sink it into the hip while it is planted (the tabard hides
    # the joint) so the heel stands on the floor
    legs["leg-l"]["loc"] = [(t, (x, y - ((1.25 if abs(t - 0.6) < 0.02 else 0.9) if 0.53 <= t <= 0.74 else 0.0), z)) for t, (x, y, z) in legs["leg-l"]["loc"]]
    attack.update(legs)
    # more wind-up and more follow-through in the torso and the head (the
    # lunge reads deadlier): the body and head swings are pushed 25% further
    for part in ("torso", "head"):
        attack[part]["rot"] = [(t, (x * 1.25, y * 1.25, z * 1.25)) for t, (x, y, z) in attack[part]["rot"]]
    # hit: a rattling shove back and up off its feet, the skull knocked
    # loose on its neck for a beat, then it steps back in
    hit, _ = shove_hit("skeleton-knight", L=12.0, push=3.5, pop=2.0, k=0.95, body="torso", weapon="longsword")
    hit["head"]["loc"] = keys((0, 0, 0, 0), (2 / 30, 0, 1.2, 0.5), (6 / 30, 0, 2.0, 0.8), (10 / 30, 0, 0.3, 0), (13 / 30, 0, 0.8, 0), (18 / 30, 0, 0, 0), (28 / 30, 0, 0, 0))

    death, LAND = knight_death(parts, to_root)
    eyes = (CX, 30.85, SKULL["cz"] - 5.4)
    # the longsword tip, as drawn in longsword(): blade x centre SWORD_X + 0.5, from (y 13, z CZ - 0.5) to (y 31, z CZ - 12.5)
    blade_tip = (SWORD_X + 0.5, 31.0, CZ - 12.5)
    return asset("creatures", "skeleton-knight", "Skeleton Knight", root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False, impact=0.5333), Clip("hit", hit, loop=False), Clip("death", death, loop=False, impact=LAND, ease=0),
                        Clip("move", march_move(root), ease=0.0, floor=False)],
                 sockets=[Socket("socket-eyes", at=to_root(eyes), parent="head"), Socket("socket-blade", at=to_root(blade_tip), parent="longsword")],
                 # The slash spans the longsword: from the hilt (offset back from the tip socket) along the blade.
                 # It starts as the cut leaves the wind-up (0.43 s): the trail takes a frame or two to start, and the
                 # end of the wind-up is too slow to draw, so the wind-up leaves no trail.
                 fx=[pfx("rvx-fantasy-bone-poof", "socket-eyes", "clip:death", size=34, at=0.24),
                     pfx("rvx-fantasy-slash-arc", "socket-blade", "clip:attack", size=21.6, aim=(0.0, 0.832, -0.555), offset=(0.0, -18.0, 12.0), at=0.4)])
