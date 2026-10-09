"""Minotaur in the Pirate Nation creature style.

A broad bull-man almost twice a person tall: a massive wedge chest under
a high hump of neck muscle, a bull head held low and forward with a pale
muzzle, a gold nose ring, small red eyes under a dark brow, floppy ears
and two big curved horns that sweep out and up. It stands on digitigrade
legs (thigh forward, shin back, a high hock) on cloven iron-dark hooves,
and a tufted tail hangs behind. It wears a blue loincloth with a gold
hem, a heavy belt with a bronze boss, crossed leather harness straps and
one spiked steel pauldron on the left shoulder.

The oversized function prop is a double-bit axe (a labrys, rule F4) held
up in front of the right side of the chest, its two crescent blades
facing the viewer so it reads in the silhouette (F6). Limbs, horns, ears,
muzzle and blades are true-slope prisms (F2); fur, cloth, leather, iron
and the face are paint (S1).

Clips: idle (it breathes and snorts, the axe rocks), attack (a diagonal
axe swing from over the right shoulder down across the body, with a slash
arc), hit, death (it topples back). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _fcreature_giants import frame_edges, fur_strokes, on_facets, patches, seam_frame
from _life import asset, chamfer_rect, coords, front, keys, ngon, pfx, plan, rig, side
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket

SH = (104, 84, 84)
CX, CZ = 52.0, 44.0
FUR, FUR_B = "rust", 4
MUZZLE = "sand"
TAIL_HINGE = (CX, 30.0, CZ + 9.0)
CLOTH = "blue"
HOOF = "iron"
HIP_Y = 31.0
WAIST_Y = 32.0
SHOULDER_Y = 52.0
SH_X = 20.0
NECK = (CX, 54.0, CZ - 7.0)
FACE_Z = CZ - 17.0
WRIST_R = (CX + 23.5, 32.0, CZ - 14.0)
AXE_HEAD = (CX + 19.5, 55.0)  # (x, y) of the axe head centre on the haft
AXE_Z = (CZ - 16.0, CZ - 12.0)


def hide(g: Grid, m: np.ndarray, base: int = FUR_B, frame=None, seed: int = 0, ramp: str = FUR) -> None:
    """Short bull hair: soft cells, then sparse short strokes over them."""
    patches(g, m, ramp, base, frame=frame, seed=seed, cell=(5, 4))
    U, V = P.uv(g, frame)
    h = P._hash(U, (V + U % 2) // 2, seed=seed + 7) % np.uint64(12)
    P.flat(g, m & (h == 0), ramp, max(1, base - 1))


def fur(g: Grid, start: int, base: int = FUR_B, seed: int = 0, ramp: str = FUR) -> None:
    on_facets(g, start, lambda gg, mm, fr: hide(gg, mm, base, frame=fr, seed=seed, ramp=ramp))


# ------------------------------------------------------------------ legs
def leg(s: int) -> Grid:
    """A digitigrade bull leg: a thick thigh that slopes forward to the
    knee, a shin that slopes back to a high hock, a short cannon bone down
    to the fetlock, and a cloven hoof."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    lx = CX + s * 8.0
    start = len(g.solids)
    thigh = side(g, S.quad((HIP_Y + 1.0, CZ + 1.5), (21.0, CZ - 4.0), 6.6, 5.0, cap=0.3), lx - 6.0, lx + 6.0, FUR, FUR_B)
    shin = side(g, S.quad((22.0, CZ - 4.0), (11.0, CZ + 4.5), 4.6, 3.4, cap=0.3), lx - 4.6, lx + 4.6, FUR, FUR_B)
    cannon = side(g, S.quad((12.0, CZ + 4.5), (4.0, CZ + 1.0), 3.2, 3.0, cap=0.2), lx - 3.6, lx + 3.6, FUR, FUR_B - 1)
    fur(g, start, FUR_B, seed=1 + s)
    seam_frame(g, start, FUR, FUR_B - 2)
    P.flat(g, shin & (Z > CZ + 2) & (Y < 15), FUR, FUR_B - 2)  # the dark back of the hock
    P.flat(g, thigh & (Z < CZ - 6) & (Y < 26), FUR, FUR_B + 1)  # the lit knee
    # a pale shaggy fetlock tuft above the hoof
    tuft = cannon & (Y < 7.5)
    fur_strokes(g, tuft, MUZZLE, 4, frame="wall", seed=3 + s)
    P.flat(g, tuft & (Y < 5.0) & ((np.floor(X + Z).astype(int) % 2) == 0), MUZZLE, 3)
    # the cloven hoof: two toes split down the middle, lit on top
    hstart = len(g.solids)
    hoof = side(g, [(0, CZ - 7.0), (0, CZ + 4.0), (4.5, CZ + 4.0), (5.0, CZ + 1.5), (4.0, CZ - 5.5)], lx - 4.4, lx + 4.4, HOOF, 3)
    on_facets(g, hstart, lambda gg, mm, fr: P.flat(gg, mm, HOOF, 3))
    P.flat(g, hoof & (Y > 3.5), HOOF, 5)
    P.flat(g, hoof & (Y < 1), HOOF, 1)
    P.flat(g, hoof & (np.abs(X - lx) < 0.6) & (Z < CZ + 1), HOOF, 1)  # the split between the two toes
    P.flat(g, edges(hoof), HOOF, 2)
    return g


# ------------------------------------------------------------------ root
def pelvis() -> Grid:
    """The root: furred hips, a heavy belt with a bronze boss, a blue
    loincloth front and back with a gold hem, and a tufted bull tail."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    start = len(g.solids)
    plan(g, chamfer_rect(CX - 14, CZ - 9, CX + 14, CZ + 9, 3), 25, WAIST_Y + 1, FUR, FUR_B)
    fur(g, start, seed=4)
    # the loincloth: a front and a back flap that taper and hang in folds
    for zf, z0, z1 in ((-1, CZ - 11.0, CZ - 9.0), (1, CZ + 9.0, CZ + 11.0)):
        cstart = len(g.solids)
        flap = front(g, [(CX - 8.5, WAIST_Y), (CX + 8.5, WAIST_Y), (CX + 7, 15.5), (CX + 2.5, 14.0), (CX - 2, 15.0), (CX - 7, 14.5)], z0, z1, CLOTH, 4)
        on_facets(g, cstart, lambda gg, mm, fr: P.flat(gg, mm, CLOTH, 4))
        Xi = np.floor(X).astype(int)
        P.flat(g, flap & ((Xi % 5) == 0), CLOTH, 3)  # the folds
        P.flat(g, flap & ((Xi % 5) == 2), CLOTH, 5)
        P.flat(g, flap & (Y < 18.0), "gold", 5)  # the gold hem
        P.flat(g, flap & (Y < 18.0) & ((Xi % 3) == 0), "gold", 3)
        P.flat(g, flap & (np.abs(Y - 18.3) < 0.5), CLOTH, 2)
        P.outline(g, flap, CLOTH, 2)
    # a heavy leather belt with iron rivets and a round bronze boss
    belt = plan(g, chamfer_rect(CX - 15, CZ - 10.5, CX + 15, CZ + 10.5, 3.5), WAIST_Y - 2.0, WAIST_Y + 3.0, "darkwood", 3)
    P.flat(g, belt & (Y > WAIST_Y + 2.0), "darkwood", 4)
    P.flat(g, belt & (Y < WAIST_Y - 1.0), "darkwood", 2)
    P.flat(g, belt & (np.abs(Y - WAIST_Y - 0.5) < 0.5) & ((np.floor(X + Z).astype(int) % 4) == 0), "iron", 6)
    bstart = len(g.solids)
    boss = front(g, ngon(CX, WAIST_Y + 0.5, 4.2, 8, math.pi / 8), CZ - 12.5, CZ - 10.0, "gold", 4)
    on_facets(g, bstart, lambda gg, mm, fr: P.flat(gg, mm, "gold", 4))
    r = np.hypot(X - CX, Y - WAIST_Y - 0.5)
    P.flat(g, boss & (r < 2.4), "gold", 6)
    P.flat(g, boss & (r < 1.0), "gold", 7)
    P.flat(g, boss & (r > 3.4), "gold", 2)
    return g


def tail() -> Grid:
    """The bull tail: a thin furred rope that hangs back and down to a
    dark tuft."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    ty, tz = TAIL_HINGE[1], TAIL_HINGE[2]
    tstart = len(g.solids)
    rope = side(g, S.quad((ty, tz - 1.0), (16.0, tz + 6.0), 1.6, 1.2), CX - 1.4, CX + 1.4, FUR, FUR_B)
    fur(g, tstart, seed=6)
    P.flat(g, rope & (Y > ty - 3), FUR, FUR_B - 2)
    qstart = len(g.solids)
    side(g, S.quad((17.5, tz + 5.6), (9.5, tz + 7.5), 2.4, 1.0, cap=0.8), CX - 2.2, CX + 2.2, FUR, 2)
    on_facets(g, qstart, lambda gg, mm, fr: fur_strokes(gg, mm, FUR, 2, frame=fr, seed=7))
    return g


# ------------------------------------------------------------------ body
def body() -> Grid:
    """A wedge chest that swells into huge shoulders and a high hump of
    neck muscle, a pale chest blaze, ridged belly fur, crossed leather
    harness straps with a bronze ring, and a spiked steel pauldron."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    start = len(g.solids)
    torso = side(g, [(WAIST_Y - 1, CZ - 9), (WAIST_Y - 1, CZ + 8), (44, CZ + 11), (53, CZ + 12), (59.5, CZ + 7), (59.5, CZ - 3),
                     (53, CZ - 11), (43, CZ - 12.5), (37, CZ - 11)], CX - 14, CX + 14, FUR, FUR_B)
    torso |= front(g, [(CX - 12, WAIST_Y - 1), (CX + 12, WAIST_Y - 1), (CX + 17, 41), (CX + 22, 50), (CX + 21, 55), (CX + 12, 59.5),
                       (CX - 12, 59.5), (CX - 21, 55), (CX - 22, 50), (CX - 17, 41)], CZ - 10, CZ + 9.5, FUR, FUR_B)
    fur(g, start, seed=8)
    seam_frame(g, start, FUR, FUR_B - 2)
    P.flat(g, torso & (Y > 58.5), FUR, FUR_B - 1)  # the dark crest of the hump
    # a pale blaze on the chest and the belly, framed by the darker fur
    blaze = torso & (Z < CZ - 9) & (np.abs(X - CX) < 3.0 + (Y - WAIST_Y) * 0.36) & (Y < 52)
    fur_strokes(g, blaze, FUR, FUR_B + 2, frame="wall", seed=9)
    for ry in (36.0, 39.5, 43.0):  # the ridges of the belly
        P.flat(g, blaze & (np.abs(Y - ry) < 0.55) & (np.abs(X - CX) > 1.0), FUR, FUR_B)
    P.flat(g, blaze & (np.abs(X - CX) < 0.6) & (Y < 45), FUR, FUR_B)
    for sx in (-1, 1):  # the lower line of each pectoral
        P.flat(g, torso & (Z < CZ - 9) & (np.abs(Y - (47.0 - np.abs(X - CX - sx * 8) * 0.22)) < 0.6) & (np.abs(X - CX - sx * 8) < 7) & (sx * (X - CX) > 1), FUR, FUR_B - 1)
    # crossed leather harness straps with iron rivets and a bronze ring
    for sx in (-1, 1):
        strap = torso & (np.abs((X - CX) * sx * 0.82 + (Y - 46.0) * 0.57) < 1.6) & (Y > WAIST_Y + 1)
        P.flat(g, strap, "darkwood", 3)
        P.flat(g, strap & (np.abs((X - CX) * sx * 0.82 + (Y - 46.0) * 0.57) > 1.0), "darkwood", 2)
        P.flat(g, strap & ((np.floor(Y).astype(int) % 4) == 0) & (np.abs((X - CX) * sx * 0.82 + (Y - 46.0) * 0.57) < 0.5), "iron", 6)
    ring = torso & (Z < CZ - 8) & (np.abs(np.hypot(X - CX, Y - 46.0) - 2.6) < 0.9)
    P.flat(g, ring, "gold", 5)
    P.flat(g, ring & (Y > 46.5), "gold", 7)
    # the spiked steel pauldron on the left shoulder
    pstart = len(g.solids)
    plan(g, chamfer_rect(CX - 26.5, CZ - 7.5, CX - 14.5, CZ + 7.5, 3), 51.0, 55.0, "steel", 4,
         top=chamfer_rect(CX - 24, CZ - 6, CX - 16, CZ + 6, 2.5))
    plan(g, chamfer_rect(CX - 27.0, CZ - 8.5, CX - 15.5, CZ + 8.5, 3), 48.0, 51.0, "steel", 4)
    pad = np.zeros(g.shape, dtype=bool)
    for sd in g.solids[pstart:]:
        pad |= sd.mask(g.shape)
    on_facets(g, pstart, lambda gg, mm, fr: P.plates(gg, mm, "steel", 4, size=(6, 3), rivets=True, frame=fr, seed=10))
    P.flat(g, pad & (Y > 54.2), "steel", 5)
    P.flat(g, edges(pad), "steel", 2)
    P.flat(g, pad & (np.abs(Y - 49.5) < 0.6), "gold", 5)  # a bronze trim on the lower plate
    sstart = len(g.solids)
    spike = plan(g, ngon(CX - 20.0, CZ, 2.0, 4, math.pi / 4), 55.0, 60.5, "steel", 5, top=ngon(CX - 21.0, CZ, 0.3, 4, math.pi / 4))
    on_facets(g, sstart, lambda gg, mm, fr: P.flat(gg, mm, "steel", 5))
    P.flat(g, spike & (X > CX - 20.0), "steel", 7)
    return g


# ------------------------------------------------------------------ head
def head() -> Grid:
    """A bull head held low and forward: a broad brow, a long pale muzzle
    with dark nostrils and a gold ring, small red eyes, floppy ears, a dark
    forelock and two big horns that sweep out and up."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    start = len(g.solids)
    plan(g, chamfer_rect(CX - 8.5, FACE_Z, CX + 8.5, CZ - 2, 3), 53.0, 63.5, FUR, FUR_B - 1)
    plan(g, chamfer_rect(CX - 8.5, FACE_Z, CX + 8.5, CZ - 2, 3), 63.5, 66.0, FUR, FUR_B - 1,
         top=chamfer_rect(CX - 6.5, FACE_Z + 2, CX + 6.5, CZ - 4, 2))
    fur(g, start, FUR_B - 1, seed=11)
    skull = g.a > 0
    seam_frame(g, start, FUR, FUR_B - 3)
    # the long muzzle, sloped down and forward (a true-slope prism)
    mstart = len(g.solids)
    muzzle = side(g, [(48.5, FACE_Z + 1), (56.5, FACE_Z + 1), (55.5, FACE_Z - 5.5), (50.0, FACE_Z - 7.0), (48.5, FACE_Z - 6.0)], CX - 5.8, CX + 5.8, FUR, FUR_B + 1)
    fur(g, mstart, FUR_B + 1, seed=12)
    seam_frame(g, mstart, FUR, FUR_B - 1)
    pad = muzzle & (Z < FACE_Z - 4.6)
    P.flat(g, pad, MUZZLE, 3)  # the grey-tan nose pad
    P.flat(g, pad & (Y > 54.5), MUZZLE, 4)
    P.outline(g, pad, MUZZLE, 1)
    P.flat(g, muzzle & (Y < 49.5), FUR, FUR_B - 2)  # the dark chin
    P.flat(g, pad & (np.abs(Y - 50.8) < 0.5), "darkwood", 1)  # the mouth line
    for s in (-1, 1):  # two big dark nostrils on the front of the nose pad
        P.flat(g, pad & (Z < FACE_Z - 6.0) & (np.abs(X - CX - s * 2.6) < 1.1) & (np.abs(Y - 53.4) < 1.1), "darkwood", 1)
    # a gold ring through the nose that hangs over the mouth: two side bars
    # and a lower bar, proud of the nose pad
    nr = box(g, int(CX - 2), 48, int(FACE_Z - 8), int(CX + 2), 49, int(FACE_Z - 7), "gold", 6)
    nr |= box(g, int(CX - 2), 48, int(FACE_Z - 8), int(CX - 1), 53, int(FACE_Z - 7), "gold", 5)
    nr |= box(g, int(CX + 1), 48, int(FACE_Z - 8), int(CX + 2), 53, int(FACE_Z - 7), "gold", 5)
    P.flat(g, nr & (Y < 48.6), "gold", 7)
    # small red eyes under a heavy dark brow
    bstart = len(g.solids)
    front(g, [(CX - 9.0, 61.0), (CX - 2.0, 59.5), (CX, 60.5), (CX + 2.0, 59.5), (CX + 9.0, 61.0), (CX + 9.0, 63.5), (CX - 9.0, 63.5)], FACE_Z - 1.6, FACE_Z + 2.0, FUR, 2)
    on_facets(g, bstart, lambda gg, mm, fr: fur_strokes(gg, mm, FUR, 2, frame=fr, seed=13))
    ink = {"w": C("bone", 6), "r": C("red", 5), "R": C("red", 7), "k": C("darkwood", 1), "d": C(FUR, 1)}
    eyes = ["ddddd.....ddddd",
            "dwRrk.....krRwd",
            ".dkkd.....dkkd."]
    pnglyph.stamp(g, "-z", FACE_Z, int(CX - 7.5), 57, eyes, ink)
    # a dark forelock between the horns
    P.flat(g, skull & (Y > 63.0) & (np.abs(X - CX) < 4.5) & (Z < CZ - 6) & ((np.floor(X).astype(int) % 2) == 0), FUR, 1)
    P.flat(g, skull & (Y > 63.0) & (np.abs(X - CX) < 4.5) & (Z < CZ - 6) & ((np.floor(X).astype(int) % 2) == 1), FUR, 2)
    # floppy ears below the horns, with a pale inside
    for s in (-1, 1):
        estart = len(g.solids)
        ear = front(g, S.quad((CX + s * 8.0, 59.5), (CX + s * 14.5, 57.0), 2.0, 1.4, cap=0.6), CZ - 9.5, CZ - 7.0, FUR, FUR_B - 1)
        fur(g, estart, FUR_B - 1, seed=14 + s)
        P.flat(g, ear & (Z < CZ - 9.0) & (np.abs(X - CX) > 9.5) & (np.abs(X - CX) < 13.5) & (Y < 59.5) & (Y > 56.5), "skin", 4)
        seam_frame(g, estart, FUR, FUR_B - 3)
    # two big horns: a pale bone sweep out and up, with dark rings at the root
    for s in (-1, 1):
        hstart = len(g.solids)
        front(g, S.quad((CX + s * 6.5, 62.0), (CX + s * 15.0, 62.5), 2.6, 2.2), CZ - 12.0, CZ - 7.0, "bone", 5)
        front(g, S.quad((CX + s * 14.5, 62.2), (CX + s * 20.0, 66.0), 2.2, 1.6), CZ - 11.5, CZ - 7.5, "bone", 6)
        front(g, S.quad((CX + s * 19.6, 65.5), (CX + s * 20.0, 68.5), 1.6, 0.4, cap=1.0), CZ - 11.0, CZ - 8.0, "bone", 6)
        horn = np.zeros(g.shape, dtype=bool)
        for sd in g.solids[hstart:]:
            horn |= sd.mask(g.shape)
        on_facets(g, hstart, lambda gg, mm, fr: P.flat(gg, mm, "bone", 6))
        d = np.abs(X - CX)
        P.flat(g, horn & (d < 13.0), "bone", 5)
        P.flat(g, horn & (d < 10.0), "sand", 4)
        P.flat(g, horn & ((np.floor(d).astype(int) % 3) == 0) & (d < 15.5), "sand", 3)  # the growth rings
        P.flat(g, horn & (Y > 66.8), "bone", 7)
        P.flat(g, horn & (Z > CZ - 8.0), "bone", 4)  # the shaded back of the horn
    return g


# ------------------------------------------------------------------ arms
def arm(s: int) -> Grid:
    """A massive arm with an iron bracer. The left hangs with a big fist.
    The right bends at the elbow and holds the axe up in front."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    sx = CX + s * SH_X
    start = len(g.solids)
    front(g, S.quad((sx, SHOULDER_Y + 2.5), (sx + s * 3.5, 40.0), 6.4, 5.4, cap=0.35), CZ - 6, CZ + 6, FUR, FUR_B)
    if s < 0:
        front(g, S.quad((sx - 2.5, 41.0), (sx - 2.5, 27.0), 5.0, 4.2, cap=0.3), CZ - 5.5, CZ + 5, FUR, FUR_B)
        hx, hy, hz = sx - 2.5, 23.0, CZ - 0.5
    else:
        side(g, S.quad((41.0, CZ + 0.5), (32.5, CZ - 10.0), 4.8, 4.4, cap=0.3), WRIST_R[0] - 5.0, WRIST_R[0] + 5.0, FUR, FUR_B)
        hx, hy, hz = WRIST_R
    fur(g, start, seed=16 + s)
    limb = g.a > 0
    seam_frame(g, start, FUR, FUR_B - 2)
    P.flat(g, limb & (np.abs(X - CX) < 15.0), FUR, FUR_B - 2)  # a dark inner edge against the chest
    # a big furred fist with dark knuckles
    if s < 0:
        fist = box(g, int(hx) - 4, int(hy) - 6, int(hz) - 6, int(hx) + 5, int(hy) + 4, int(hz) + 5, FUR, FUR_B)
        fur_strokes(g, fist, FUR, FUR_B, frame="wall", seed=18)
        P.flat(g, fist & (Z < hz - 5) & ((np.floor(X).astype(int) % 3) == 0) & (Y < hy + 1), FUR, FUR_B - 2)
        P.flat(g, fist & (Z < hz - 5) & (Y > hy + 2), FUR, FUR_B + 1)
        br = box(g, int(hx) - 5, int(hy) + 4, int(hz) - 6, int(hx) + 6, int(hy) + 9, int(hz) + 6, "iron", 4)
    else:
        fist = box(g, int(hx) - 5, int(hy) - 5, int(hz) - 5, int(hx) + 5, int(hy) + 5, int(hz) + 5, FUR, FUR_B)
        fur_strokes(g, fist, FUR, FUR_B, frame="wall", seed=19)
        P.flat(g, fist & (X < hx - 4) & ((np.floor(Y).astype(int) % 3) == 0), FUR, FUR_B - 2)  # finger splits round the haft
        P.flat(g, fist & (X < hx - 4) & (Z < hz - 3), FUR, FUR_B + 1)
        bstart = len(g.solids)
        side(g, S.quad((39.0, CZ - 2.5), (35.5, CZ - 7.5), 5.4, 5.0), hx - 5.6, hx + 5.6, "iron", 4)
        br = g.solids[bstart].mask(g.shape)
    frame_edges(g, fist, FUR, FUR_B - 2)
    # an iron bracer with a bronze rim and rivets
    P.flat(g, br, "iron", 4)
    P.flat(g, br & ((np.floor(X + Z).astype(int) % 6) < 3), "iron", 5)
    P.flat(g, edges(br), "gold", 4)
    P.flat(g, br & (((np.floor(X).astype(int) * 3 + np.floor(Y).astype(int) + np.floor(Z).astype(int) * 2) % 9) == 0), "steel", 7)
    return g


# ------------------------------------------------------------------ axe
def axe() -> Grid:
    """A double-bit axe: a wrapped haft with a bronze pommel and a spike on
    top, a bronze collar, and two steel crescent blades with a bright edge
    and an engraved line."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    hx = WRIST_R[0]
    ax, ay = AXE_HEAD
    z0, z1 = AXE_Z
    zc = (z0 + z1) / 2
    start = len(g.solids)
    haft = front(g, S.quad((hx, 20.0), (ax - 0.4, ay + 9.0), 1.4, 1.2), zc - 1.4, zc + 1.4, "darkwood", 4)
    on_facets(g, start, lambda gg, mm, fr: P.planks(gg, mm, "darkwood", 4, width=3, across="y", length=(30, 40), nails=False, frame=fr, seed=20))
    Yi = np.floor(Y).astype(int)
    P.flat(g, haft & (Y > 24) & (Y < 42) & ((Yi % 3) == 0), "wood", 5)  # the leather wrap of the grip
    P.flat(g, haft & (Y > 24) & (Y < 42) & ((Yi % 3) == 1), "darkwood", 2)
    pommel = box(g, int(hx) - 2, 17, int(zc) - 2, int(hx) + 2, 20, int(zc) + 2, "gold", 4)
    P.flat(g, pommel & (Y < 18), "gold", 2)
    tstart = len(g.solids)
    spike = front(g, [(ax - 1.6, ay + 8.5), (ax + 1.0, ay + 8.5), (ax - 0.6, ay + 13.0)], zc - 1.2, zc + 1.2, "steel", 6)
    on_facets(g, tstart, lambda gg, mm, fr: P.flat(gg, mm, "steel", 6))
    P.flat(g, spike & (X > ax - 0.6), "steel", 4)
    collar = box(g, int(ax) - 2, int(ay) - 3, int(z0) - 1, int(ax) + 2, int(ay) + 4, int(z1) + 1, "gold", 4)
    P.flat(g, collar & ((np.floor(Y).astype(int) % 3) == 0), "gold", 6)
    P.flat(g, edges(collar), "gold", 2)
    # the two crescent blades (true-slope polygons, mirrored about the haft)
    for s in (-1, 1):
        bstart = len(g.solids)
        pts = [(ax + s * 2.0, ay - 2.5), (ax + s * 5.0, ay - 3.5), (ax + s * 8.0, ay - 8.0), (ax + s * 9.4, ay - 5.5),
               (ax + s * 10.0, ay - 2.0), (ax + s * 10.0, ay + 2.0), (ax + s * 9.4, ay + 5.5), (ax + s * 8.0, ay + 8.0),
               (ax + s * 5.0, ay + 3.5), (ax + s * 2.0, ay + 2.5)]
        blade = front(g, pts if s > 0 else pts[::-1], z0, z1, "steel", 6)
        on_facets(g, bstart, lambda gg, mm, fr: P.flat(gg, mm, "steel", 6))
        d = (X - ax) * s
        rr = np.hypot((X - ax) * s - 1.0, (Y - ay) * 1.05)
        P.flat(g, blade & (rr > 8.0), "steel", 7)  # the bright curved cutting edge
        P.flat(g, blade & (rr > 7.2) & (rr <= 8.0), "steel", 4)
        P.flat(g, blade & (np.abs(rr - 5.0) < 0.5) & (d > 3.5), "steel", 4)  # an engraved arc
        P.flat(g, blade & (d < 3.5), "steel", 5)
        P.outline(g, blade, "steel", 3)
    return g


# ------------------------------------------------------------------ build
def build():
    grids = {"minotaur": pelvis(), "body": body(), "head": head(), "arm-l": arm(-1), "arm-r": arm(1),
             "axe": axe(), "leg-l": leg(-1), "leg-r": leg(1), "tail": tail()}
    waist = (CX, WAIST_Y, CZ)
    sh = {s: (CX + s * SH_X, SHOULDER_Y, CZ) for s in (-1, 1)}
    hips = {s: (CX + s * 8.0, HIP_Y, CZ + 1.0) for s in (-1, 1)}
    root, to_root = rig([
        ("minotaur", grids["minotaur"], None, None),
        ("leg-l", grids["leg-l"], hips[-1], None),
        ("leg-r", grids["leg-r"], hips[1], None),
        ("tail", grids["tail"], TAIL_HINGE, None),
        ("body", grids["body"], waist, None),
        ("head", grids["head"], NECK, "body"),
        ("arm-l", grids["arm-l"], sh[-1], "body"),
        ("arm-r", grids["arm-r"], sh[1], "body"),
        ("axe", grids["axe"], WRIST_R, "arm-r"),
    ])
    idle = {"body": {"rot": keys((0, 0, 0, 0), (1.0, -3, 0, 0), (2.0, 0, 0, 0))},
            "head": {"rot": keys((0, 0, 0, 0), (0.5, 6, 10, 0), (0.8, -4, 0, 0), (1.0, 6, 0, 0), (1.5, 0, -10, 0), (2.0, 0, 0, 0))},
            "arm-l": {"rot": keys((0, 0, 0, 0), (1.0, 6, 0, -4), (2.0, 0, 0, 0))},
            "arm-r": {"rot": keys((0, 0, 0, 0), (1.0, 4, 0, 3), (2.0, 0, 0, 0))},
            "axe": {"rot": keys((0, 0, 0, 0), (1.0, 0, 8, -4), (2.0, 0, 0, 0))},
            "tail": {"rot": keys((0, 0, 0, 0), (0.5, 0, 0, 14), (1.0, 0, 0, 0), (1.5, 0, 0, -14), (2.0, 0, 0, 0))}}
    # a diagonal swing: the arm lifts the axe up and back over the right
    # shoulder, then drives it down and across the body to the left hip.
    # Each key step stays under 150 degrees (the export takes the short way).
    attack = {"arm-r": {"rot": keys((0, 0, 0, 0), (0.22, 70, 0, 28), (0.40, 135, 0, 40), (0.50, 95, -10, 10), (0.58, 45, -20, -20), (0.70, 40, -20, -22), (1.10, 0, 0, 0))},
              "axe": {"rot": keys((0, 0, 0, 0), (0.22, -10, 0, 0), (0.40, -40, 0, 0), (0.50, -80, 0, 0), (0.58, -110, 0, 0), (0.70, -105, 0, 0), (1.10, 0, 0, 0))},
              "body": {"rot": keys((0, 0, 0, 0), (0.40, 6, -16, 0), (0.58, -10, 22, 0), (0.70, -8, 20, 0), (1.10, 0, 0, 0))},
              "head": {"rot": keys((0, 0, 0, 0), (0.40, -8, 8, 0), (0.58, 10, -10, 0), (1.10, 0, 0, 0))},
              "arm-l": {"rot": keys((0, 0, 0, 0), (0.40, 20, 0, -20), (0.58, -16, 0, -6), (1.10, 0, 0, 0))},
              "minotaur": {"loc": keys((0, 0, 0, 0), (0.40, 0, 0, 1.5), (0.58, 0, 0, -3.0), (0.70, 0, 0, -3.0), (1.10, 0, 0, 0))}}
    hit = {"body": {"rot": keys((0, 0, 0, 0), (0.10, 14, 0, 6), (0.45, 0, 0, 0))},
           "head": {"rot": keys((0, 0, 0, 0), (0.10, 18, -10, 6), (0.45, 0, 0, 0))},
           "arm-l": {"rot": keys((0, 0, 0, 0), (0.10, -14, 0, -20), (0.45, 0, 0, 0))},
           "arm-r": {"rot": keys((0, 0, 0, 0), (0.10, -10, 0, 16), (0.45, 0, 0, 0))},
           "minotaur": {"loc": keys((0, 0, 0, 0), (0.10, 0, 0, 3.0), (0.45, 0, 0, 0))}}
    death = {"minotaur": {"rot": keys((0, 0, 0, 0), (0.30, -8, 0, 0), (0.90, 80, 0, 5), (1.05, 74, 0, 5), (1.25, 78, 0, 5)),
                          "loc": keys((0, 0, 0, 0), (0.90, 0, 12, 10), (1.25, 0, 12, 10))},
             "head": {"rot": keys((0, 0, 0, 0), (0.90, -16, 0, 0), (1.25, -8, 22, 0))},
             "arm-l": {"rot": keys((0, 0, 0, 0), (0.90, 20, 0, -50))},
             "arm-r": {"rot": keys((0, 0, 0, 0), (0.90, 20, 0, 50))},
             "axe": {"rot": keys((0, 0, 0, 0), (0.90, 20, 0, -30))},
             "leg-l": {"rot": keys((0, 0, 0, 0), (0.90, 14, 0, -8))},
             "leg-r": {"rot": keys((0, 0, 0, 0), (0.90, 4, 0, 8))},
             "tail": {"rot": keys((0, 0, 0, 0), (0.90, 70, 0, 0))}}
    edge = (AXE_HEAD[0] + 10.0, AXE_HEAD[1], (AXE_Z[0] + AXE_Z[1]) / 2)
    return asset("creatures", "minotaur", "Minotaur", root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 sockets=[Socket("socket-function", at=to_root(edge), parent="axe")],
                 fx=[pfx("rvx-fantasy-slash-arc", "socket-function", "clip:attack", size=26, at=0.42)])
