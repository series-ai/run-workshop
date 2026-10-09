"""Cyclops shepherd giant in the Pirate Nation creature style.

An upright giant more than twice a person tall, taller than the troll and
not hunched like it. It stands straight on long legs in leather sandals
with bare toes. A sheepskin kilt with a dangling hoof, a red belt and a
grey wolf pelt over the left shoulder show the shepherd. The pot belly and the broad
chest are bare tan skin. The head is a rounded block (rule F4) with one
huge blue eye under a heavy single brow, a broad flat nose, a wide mouth
with two snaggle teeth, round ears and a dark topknot.

The oversized function prop is the club (rule F4): a tapered log, thick
end up, studded with flint stones and bound with iron. The right hand
holds it upright in front of the shoulder, so its head rises beside the
face in the silhouette (F6). Limbs, brow, nose, ears and stones are
true-slope prisms (F2); skin, wool, leather, bark and the face are paint
(S1).

Clips: idle (it breathes, the club rocks), attack (an overhead smash: the
club goes back over the head and down into the ground in front, with a
dust burst), hit, death (it topples back). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _fcreature_giants import frame_edges, fur_strokes, on_facets, patches, seam_frame, wool
from _life import asset, chamfer_rect, coords, front, keys, ngon, pfx, plan, rig, side
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket

SH = (112, 96, 88)
CX, CZ = 56.0, 46.0
SKIN, SKIN_B = "skin", 4
WOOL, WOOL_B = "bone", 5
HAIR = "darkwood"
PELT, PELT_B = "stone", 5  # a grey wolf pelt over the left shoulder
HIP_Y = 34.0
WAIST_Y = 37.0
SHOULDER_Y = 60.0
SH_X = 19.0  # shoulder hinge offset from the centre line
NECK_Y = 62.0
HEAD_Y0, HEAD_Y1 = 60.5, 80.0
FACE_Z = CZ - 10.0
HW = 11.0  # head half width
EYE = (CX, 71.5)
WRIST_R = (CX + 23.5, 36.0, CZ - 16.0)
CLUB_TOP = (CX + 23.5, 80.0, CZ - 10.5)


def skin(g: Grid, start: int, base: int = SKIN_B, seed: int = 0) -> None:
    on_facets(g, start, lambda gg, mm, fr: patches(gg, mm, SKIN, base, frame=fr, seed=seed))


# ------------------------------------------------------------------ legs
def leg(s: int) -> Grid:
    """A long straight leg: a thick thigh, a calf that swells at the back,
    and a bare foot on a leather sandal with straps that cross up the shin."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    lx = CX + s * 9.5
    start = len(g.solids)
    thigh = side(g, [(19, CZ - 5.5), (HIP_Y + 1, CZ - 7), (HIP_Y + 2, CZ + 6), (19, CZ + 5.5)], lx - 6.2, lx + 6.2, SKIN, SKIN_B)
    shin = side(g, [(4, CZ - 3.5), (21, CZ - 5.5), (21, CZ + 5.5), (14, CZ + 7), (6, CZ + 3.5), (4, CZ + 3)], lx - 5.2, lx + 5.2, SKIN, SKIN_B)
    foot = side(g, [(1.5, CZ - 15), (1.5, CZ + 5.5), (6, CZ + 5.5), (7, CZ + 1), (5, CZ - 9), (3.5, CZ - 15)], lx - 5.6, lx + 5.6, SKIN, SKIN_B)
    skin(g, start, SKIN_B, seed=1 + s)
    seam_frame(g, start, SKIN, SKIN_B - 2)
    # the knee cap and the shin bone, lit; a dark crease behind the knee
    P.flat(g, shin & (Z < CZ - 4.5) & (Y > 17) & (Y < 21), SKIN, SKIN_B + 1)
    P.flat(g, shin & (Z > CZ + 5) & (Y > 18), SKIN, SKIN_B - 2)
    # bare toes: dark splits and bone nails at the tips
    toes = foot & (Z < CZ - 9)
    P.flat(g, toes & (np.abs(((X - lx + 5.6) % 2.8) - 0.2) < 0.45), SKIN, SKIN_B - 2)
    P.flat(g, toes & (Z < CZ - 14) & (Y > 2.5) & (np.abs(((X - lx + 5.6) % 2.8) - 1.4) < 0.6), SKIN, SKIN_B + 2)  # small pale nails
    # the sandal: a thick leather sole, an instep strap with an iron ring,
    # and straps that cross up the shin to below the knee
    sstart = len(g.solids)
    sole = side(g, [(0, CZ - 16), (0, CZ + 6.5), (1.8, CZ + 6.5), (1.8, CZ - 16)], lx - 6.2, lx + 6.2, "wood", 3)
    on_facets(g, sstart, lambda gg, mm, fr: P.flat(gg, mm, "wood", 3))
    P.flat(g, sole & (Y < 1), "darkwood", 2)
    seam_frame(g, sstart, "darkwood", 2)
    strap = foot & (np.abs(Z - (CZ - 6)) < 1.5) & (Y > 1.5)
    P.flat(g, strap, "wood", 4)
    P.flat(g, strap & (np.abs(Z - (CZ - 6)) > 0.8), "darkwood", 2)
    P.flat(g, foot & (Z > CZ - 1) & (Y > 3), "wood", 4)  # the heel cup
    for wy in (7.0, 11.0):  # two leather wraps round the ankle and the shin
        wrap = shin & (np.abs(Y - wy) < 0.9)
        P.flat(g, wrap, "wood", 4)
        P.flat(g, wrap & (Y < wy - 0.2), "darkwood", 2)
    P.flat(g, shin & (Y < 15) & (Z < CZ - 3) & (np.abs(X - lx) < 0.6), "wood", 3)  # the lace up the front
    tie = shin & (np.abs(Y - 15.5) < 1.0)
    P.flat(g, tie, "wood", 4)
    P.flat(g, tie & (np.abs(Y - 15.5) > 0.4), "darkwood", 2)
    ring = box(g, int(lx - 1.5), 4, int(CZ - 8), int(lx + 1.5), 7, int(CZ - 6), "iron", 5)
    P.flat(g, ring & (Y > 6), "iron", 6)
    return g


# ------------------------------------------------------------------ root
def pelvis() -> Grid:
    """The root: the hips under a sheepskin kilt, a red cloth belt with a big
    bone toggle, a pouch on the left hip and a dangling hoof at the front."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    start = len(g.solids)
    plan(g, chamfer_rect(CX - 15, CZ - 9, CX + 15, CZ + 8, 3), 30, WAIST_Y + 1, SKIN, SKIN_B)
    skin(g, start, seed=3)
    kstart = len(g.solids)
    kilt = plan(g, chamfer_rect(CX - 17.5, CZ - 12.5, CX + 17.5, CZ + 11.5, 4), 21, WAIST_Y + 0.5, WOOL, WOOL_B,
                top=chamfer_rect(CX - 15.5, CZ - 10.5, CX + 15.5, CZ + 9.5, 3))
    on_facets(g, kstart, lambda gg, mm, fr: wool(gg, mm, WOOL, WOOL_B, frame=fr, seed=4))
    # a ragged hem: dark tufts that hang in uneven points
    ang = np.arctan2(Z - CZ, X - CX)
    hem = 24.5 + 2.2 * np.sin(ang * 9) + 1.0 * np.sin(ang * 23)
    P.flat(g, kilt & (Y < hem), "sand", 4)
    P.flat(g, kilt & (Y < hem - 1.5), "sand", 2)
    seam_frame(g, kstart, WOOL, WOOL_B - 2)
    # the pelt's front flap with a sheep's hoof that hangs from it
    fstart = len(g.solids)
    flap = front(g, [(CX - 7, 26), (CX + 7, 26), (CX + 4.5, 17), (CX + 1, 14.5), (CX - 3, 16), (CX - 6, 19)], CZ - 13.5, CZ - 11, WOOL, WOOL_B)
    on_facets(g, fstart, lambda gg, mm, fr: wool(gg, mm, WOOL, WOOL_B, frame=fr, seed=5))
    P.outline(g, flap, WOOL, WOOL_B - 2)
    hoof = front(g, [(CX - 1.5, 16), (CX + 3.0, 16), (CX + 3.5, 11), (CX + 1, 9.5), (CX - 1.5, 11)], CZ - 13.8, CZ - 11.2, "darkwood", 2)
    P.flat(g, hoof & (Y < 12), "iron", 3)
    P.flat(g, hoof & (np.abs(X - CX - 1.0) < 0.5) & (Y < 12), "iron", 1)  # the split of the hoof
    # the red cloth belt, dark under, with a big bone toggle
    belt = plan(g, chamfer_rect(CX - 16.5, CZ - 11.5, CX + 16.5, CZ + 10.5, 3.5), WAIST_Y - 1.5, WAIST_Y + 2.5, "red", 4)
    P.flat(g, belt & ((np.floor(X + Z + Y).astype(int) % 4) == 0), "red", 5)  # the twisted folds of the cloth
    P.flat(g, belt & ((np.floor(X + Z + Y).astype(int) % 8) == 2), "red", 3)
    P.flat(g, belt & (Y < WAIST_Y - 0.5), "red", 2)
    tstart = len(g.solids)
    toggle = side(g, [(WAIST_Y - 0.5, CZ - 12.5), (WAIST_Y + 1.5, CZ - 13.5), (WAIST_Y + 1.5, CZ - 11), (WAIST_Y - 0.5, CZ - 11)], CX - 4.5, CX + 4.5, "bone", 6)
    on_facets(g, tstart, lambda gg, mm, fr: P.flat(gg, mm, "bone", 6))
    P.flat(g, toggle & (Y > WAIST_Y + 0.8), "bone", 7)
    P.flat(g, edges(toggle) | (toggle & (np.abs(np.abs(X - CX) - 4.0) < 0.5)), "bone", 4)
    # a leather pouch on the left hip with a flap and a bone button
    pouch = box(g, int(CX - 19), 26, int(CZ - 5), int(CX - 14), 35, int(CZ + 3), "wood", 4)
    P.flat(g, pouch & (Y > 31.5), "wood", 5)
    P.flat(g, pouch & (np.abs(Y - 31.5) < 0.5), "darkwood", 2)
    P.flat(g, edges(pouch), "darkwood", 2)
    P.flat(g, pouch & (X < CX - 18) & (np.abs(Y - 30.5) < 0.6) & (np.abs(Z - CZ + 1) < 1.0), "bone", 7)
    return g


# ------------------------------------------------------------------ body
def body() -> Grid:
    """An upright torso: a round pot belly, a broad chest and wide sloped
    shoulders. A grey wolf pelt goes over the left shoulder, a leather strap
    holds it, and the bare skin carries a scar and a few hairs."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    start = len(g.solids)
    torso = side(g, [(WAIST_Y - 1, CZ - 11), (WAIST_Y - 1, CZ + 9), (50, CZ + 11), (59, CZ + 10.5), (64.5, CZ + 6), (64.5, CZ - 5),
                     (57, CZ - 11), (47, CZ - 14.5), (41, CZ - 13.5)], CX - 15.5, CX + 15.5, SKIN, SKIN_B)
    torso |= front(g, [(CX - 14.5, WAIST_Y - 1), (CX + 14.5, WAIST_Y - 1), (CX + 17, 46), (CX + 20.5, 56), (CX + 19.5, 62), (CX + 11, 65),
                       (CX - 11, 65), (CX - 19.5, 62), (CX - 20.5, 56), (CX - 17, 46)], CZ - 10, CZ + 9, SKIN, SKIN_B)
    skin(g, start, seed=6)
    # the lit pot belly and the chest, framed by the darker sides
    belly = torso & (Z < CZ - 9) & (((X - CX) / 12.5) ** 2 + ((Y - 46) / 8.5) ** 2 < 1)
    P.flat(g, belly, SKIN, SKIN_B + 1)
    P.flat(g, belly & (((X - CX) / 12.5) ** 2 + ((Y - 46) / 8.5) ** 2 > 0.8), SKIN, SKIN_B)
    P.flat(g, torso & (Z < CZ - 9) & (np.abs(X - CX) < 0.8) & (np.abs(Y - 45) < 0.8), SKIN, SKIN_B - 2)  # navel
    for sx in (-1, 1):  # the lower line of each pectoral
        P.flat(g, torso & (Z < CZ - 8) & (np.abs(Y - (55.5 - np.abs(X - CX - sx * 7) * 0.25)) < 0.55) & (np.abs(X - CX - sx * 7) < 6) & (sx * (X - CX) > 1), SKIN, SKIN_B - 1)
    seam_frame(g, start, SKIN, SKIN_B - 2)
    P.flat(g, torso & (Y > 63.5), SKIN, SKIN_B - 2)  # a dark collar under the head
    P.flat(g, torso & (Z > CZ + 8) & (np.abs(X - CX) < 1.0) & (Y > 42) & (Y < 62), SKIN, SKIN_B - 1)  # the spine
    # a pale scar across the right of the belly, with stitch marks
    scar = torso & (Z < CZ - 8) & (np.abs((Y - 48) - (X - CX - 8) * 0.55) < 0.55) & (np.abs(X - CX - 8) < 5)
    P.flat(g, scar, SKIN, SKIN_B + 2)
    P.flat(g, torso & (Z < CZ - 8) & (np.abs((Y - 48) - (X - CX - 8) * 0.55) < 1.5) & (np.abs(X - CX - 8) < 5) & ((np.floor(X).astype(int) % 2) == 0) & ~scar, SKIN, SKIN_B - 2)
    # the wool pelt over the left shoulder, down to the right hip, all round
    d = ((X - CX + 18.0) * 24.0 + (Y - 64.0) * 30.0) / 38.4
    pelt = torso & (np.abs(d) < 6.5) & ~((X > CX + 10) & (Y > 52))
    fur_strokes(g, pelt, PELT, PELT_B, frame="wall", seed=7)
    P.flat(g, pelt & (d < -4.5), PELT, PELT_B + 1)  # the lit upper edge of the fur
    P.flat(g, torso & (np.abs(np.abs(d) - 6.5) < 0.9) & ~((X > CX + 10) & (Y > 52)), PELT, PELT_B - 3)  # its dark edges
    P.flat(g, pelt & (np.abs(d - 4.8) < 0.6), "wood", 3)  # the leather lace along it
    P.flat(g, pelt & (np.abs(d - 4.8) < 0.6) & ((np.floor(X - Y).astype(int) % 4) == 0), "darkwood", 2)
    # a cord with a ram's horn whistle across the right side of the chest
    cord = torso & (Z < CZ - 6) & (np.abs((Y - 58) + (X - CX - 6) * 0.9) < 0.6) & (X > CX + 1) & (Y > 50)
    P.flat(g, cord, "darkwood", 2)
    hstart = len(g.solids)
    front(g, S.quad((CX + 4.0, 52.0), (CX + 9.5, 49.0), 1.6, 0.8, cap=0.6), CZ - 12.5, CZ - 9.5, "bone", 5)
    on_facets(g, hstart, lambda gg, mm, fr: P.flat(gg, mm, "bone", 5))
    horn = (g.a > 0) & (Z < CZ - 9.2) & (X > CX + 2.5) & (X < CX + 11) & (Y > 47) & (Y < 54) & ~torso
    P.flat(g, horn & (((np.floor(X).astype(int)) % 2) == 0), "bone", 4)  # its rings
    P.flat(g, horn & (X < CX + 4.5), "bone", 7)
    return g


# ------------------------------------------------------------------ head
def head() -> Grid:
    """A rounded block head: one huge blue eye under a heavy single brow,
    a broad flat nose, a wide mouth with two snaggle teeth, round ears and
    a dark topknot tied with leather."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    start = len(g.solids)
    plan(g, chamfer_rect(CX - HW + 1.5, FACE_Z - 0.8, CX + HW - 1.5, CZ + 6, 3), HEAD_Y0, 64.5, SKIN, SKIN_B,
         top=chamfer_rect(CX - HW, FACE_Z - 0.8, CX + HW, CZ + 8.5, 4))
    plan(g, chamfer_rect(CX - HW, FACE_Z, CX + HW, CZ + 8.5, 4), 64.5, 77.5, SKIN, SKIN_B)
    plan(g, chamfer_rect(CX - HW, FACE_Z, CX + HW, CZ + 8.5, 4), 77.5, HEAD_Y1, SKIN, SKIN_B,
         top=chamfer_rect(CX - HW + 4, FACE_Z + 3.5, CX + HW - 4, CZ + 5, 2.5))
    skin(g, start, seed=8)
    skull = g.a > 0
    seam_frame(g, start, SKIN, SKIN_B - 2)
    P.flat(g, skull & (Y < HEAD_Y0 + 1), SKIN, SKIN_B - 2)  # the dark underside of the jaw
    # dark hair round the back and the sides, below a bald crown
    hair = skull & (Z > CZ - 1) & (Y > 64) & (Y < 79.5)
    U = np.floor(X + Z).astype(int)
    P.flat(g, hair, HAIR, 2)
    P.flat(g, hair & ((U % 3) == 0), HAIR, 1)
    P.flat(g, hair & ((U % 5) == 1) & (Y > 70), HAIR, 3)
    P.flat(g, skull & (Z > CZ - 1) & (np.abs(Y - (64 + ((U % 4) == 0) * 1.0)) < 0.8), HAIR, 2)  # a ragged lower edge
    # the cheeks and the chin, lit
    P.flat(g, skull & (Z < FACE_Z + 0.5) & (np.abs(np.abs(X - CX) - 7.5) < 2) & (np.abs(Y - 66.5) < 1.5), SKIN, SKIN_B + 1)
    # the heavy single brow, proud of the face (a true-slope prism)
    bstart = len(g.solids)
    brow = front(g, [(CX - HW + 1.0, 76.0), (CX - 4, 77.6), (CX, 77.0), (CX + 4, 77.6), (CX + HW - 1.0, 76.0), (CX + HW - 1.5, 79.0), (CX, 80.0), (CX - HW + 1.5, 79.0)],
                 FACE_Z - 2.6, FACE_Z + 1.0, SKIN, SKIN_B - 1)
    skin(g, bstart, SKIN_B - 1, seed=9)
    bU = np.floor(X).astype(int)
    P.flat(g, brow & (Y > 77) & (Z < FACE_Z), HAIR, 3)  # the bushy eyebrow
    P.flat(g, brow & (Y > 77) & (Z < FACE_Z) & ((bU % 3) == 0), HAIR, 2)
    P.flat(g, brow & (Y > 78.5) & (Z < FACE_Z) & ((bU % 4) == 1), HAIR, 4)
    P.flat(g, brow & (Y < 76.2), SKIN, SKIN_B - 2)  # the shadow under the brow
    # the eye: a big white disc, a blue iris, a dark pupil, a lit glint and a
    # heavy upper lid
    eye = front(g, ngon(EYE[0], EYE[1], 5.8, 8, math.pi / 8), FACE_Z - 1.6, FACE_Z + 1.0, "bone", 7)
    r = np.hypot(X - EYE[0], Y - EYE[1])
    P.flat(g, eye, "bone", 7)
    P.flat(g, eye & (r > 4.6), "bone", 5)
    P.flat(g, eye & (r < 3.6), "sky", 4)
    P.flat(g, eye & (r < 3.6) & (r > 2.8), "blue", 3)
    P.flat(g, eye & (r < 1.8), "navy", 1)
    P.flat(g, eye & (np.hypot(X - EYE[0] + 1.4, Y - EYE[1] - 1.4) < 0.75), "bone", 7)
    P.flat(g, eye & (Y > EYE[1] + 3.4), SKIN, SKIN_B)  # the heavy upper lid
    P.flat(g, eye & (np.abs(Y - EYE[1] - 3.4) < 0.5), SKIN, SKIN_B - 3)  # the lash line
    P.flat(g, eye & (r > 5.3), SKIN, SKIN_B - 2)  # the dark rim of the socket
    # a broad flat nose
    nstart = len(g.solids)
    nose = side(g, [(63.8, FACE_Z), (67.8, FACE_Z), (66.5, FACE_Z - 4.2), (64.0, FACE_Z - 4.4)], CX - 3.5, CX + 3.5, SKIN, SKIN_B)
    skin(g, nstart, SKIN_B, seed=10)
    P.flat(g, nose & (Z < FACE_Z - 3.5), SKIN, SKIN_B + 1)
    P.flat(g, nose & (np.abs(np.abs(X - CX) - 1.8) < 0.7) & (Y < 64.8), SKIN, 1)  # nostrils
    # round ears with a dark inside and a bone ring
    for s in (-1, 1):
        ostart = len(g.solids)
        ear = front(g, [(CX + s * (HW - 0.5), 67), (CX + s * (HW + 3.5), 66), (CX + s * (HW + 4.5), 70), (CX + s * (HW + 3), 74), (CX + s * (HW - 0.5), 74)],
                    CZ - 3, CZ + 0.5, SKIN, SKIN_B)
        skin(g, ostart, SKIN_B, seed=11 + s)
        P.flat(g, ear & (Z < CZ - 2.4) & (np.abs(X - CX) > HW + 0.8) & (np.abs(X - CX) < HW + 3.2) & (Y > 67.5) & (Y < 73), SKIN, SKIN_B - 2)
        seam_frame(g, ostart, SKIN, SKIN_B - 2)
    ring = box(g, int(CX - HW - 3), 64, int(CZ - 2), int(CX - HW - 1), 67, int(CZ), "gold", 5)
    P.flat(g, ring & (Y < 65), "gold", 4)
    # the wide mouth with two snaggle teeth, and a dark chin dimple
    ink = {"m": C("darkwood", 1), "t": C("bone", 7), "u": C("bone", 5), "s": C(SKIN, SKIN_B - 2), "l": C(SKIN, SKIN_B + 1)}
    mouth = [".sllllllllllllllllls.",
             "smmmmmmmmmmmmmmmmmmms",
             "smmtmmmmmmmmmmmmtumms",
             ".smtsmmmmmmmmmmmtssm.",
             "..sssssssssssssss...."]
    pnglyph.stamp(g, "-z", FACE_Z - 0.8, int(CX - 10.5), 60, mouth, ink)
    # the topknot: a tuft of dark hair tied with a leather band
    kstart = len(g.solids)
    knot = plan(g, ngon(CX, CZ + 3.0, 3.2, 6, 0.3), HEAD_Y1 - 0.5, HEAD_Y1 + 1.8, HAIR, 3, top=ngon(CX, CZ + 4.0, 2.4, 6, 0.3))
    tuft = plan(g, ngon(CX, CZ + 4.0, 2.4, 6, 0.3), HEAD_Y1 + 1.8, HEAD_Y1 + 3.8, HAIR, 3, top=ngon(CX, CZ + 6.0, 3.6, 6, 0.3))
    on_facets(g, kstart, lambda gg, mm, fr: P.flat(gg, mm, HAIR, 3))
    P.flat(g, (knot | tuft) & ((np.floor(X + Z).astype(int) % 3) == 0), HAIR, 2)
    P.flat(g, tuft & (Y > HEAD_Y1 + 3.0), HAIR, 4)
    P.flat(g, knot & (Y > HEAD_Y1 + 0.6), "wood", 5)  # the leather tie
    return g


# ------------------------------------------------------------------ arms
def arm(s: int) -> Grid:
    """A long heavy arm with a leather bracer. The left hangs with a big
    fist. The right bends at the elbow and holds the club in front."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    sx = CX + s * SH_X
    start = len(g.solids)
    front(g, S.quad((sx, SHOULDER_Y + 2.5), (sx + s * 4.0, 45.0), 6.6, 5.6, cap=0.35), CZ - 6, CZ + 6, SKIN, SKIN_B)
    if s < 0:
        front(g, S.quad((sx - 4.0, 46.0), (sx - 5.0, 31.0), 5.6, 4.8, cap=0.3), CZ - 6.5, CZ + 5, SKIN, SKIN_B)
        hx, hy, hz = sx - 5.0, 26.0, CZ - 1.0
    else:
        side(g, S.quad((46.0, CZ + 0.5), (37.5, CZ - 12.0), 5.0, 4.6, cap=0.3), sx + 4.0 - 5.2, sx + 4.0 + 5.2, SKIN, SKIN_B)
        hx, hy, hz = WRIST_R[0], WRIST_R[1], WRIST_R[2]
    skin(g, start, seed=12 + s)
    limb = g.a > 0
    seam_frame(g, start, SKIN, SKIN_B - 2)
    P.flat(g, limb & (np.abs(X - CX) < 14.5), SKIN, SKIN_B - 2)  # a dark inner edge against the chest
    P.flat(g, limb & (Y > SHOULDER_Y) & (np.abs(X - sx) < 4), SKIN, SKIN_B + 1)  # the lit top of the shoulder
    # a blue woad tattoo band round the upper arm: a zigzag between two lines
    zz = 51.0 + np.abs(((X + Z) % 4) - 2.0) * 0.9
    band = limb & (Y > 48.5) & (Y < 55.5)
    P.flat(g, band & ((np.abs(Y - 49.0) < 0.5) | (np.abs(Y - 55.0) < 0.5)), "blue", 3)
    P.flat(g, band & (np.abs(Y - zz) < 0.6), "blue", 4)
    # the fist: knuckles, finger splits, nails
    if s < 0:
        fist = box(g, int(hx) - 5, int(hy) - 6, int(hz) - 6, int(hx) + 5, int(hy) + 5, int(hz) + 5, SKIN, SKIN_B)
        P.flat(g, fist, SKIN, SKIN_B)
        P.flat(g, fist & (Z < hz - 5) & ((np.floor(X).astype(int) % 3) == 0) & (Y < hy + 2), SKIN, SKIN_B - 2)
        P.flat(g, fist & (Z < hz - 5) & (Y > hy + 3), SKIN, SKIN_B + 1)  # the lit knuckles
        bracer_y, bx, bz = (hy + 5, hy + 11), hx, hz
    else:
        fist = box(g, int(hx) - 5, int(hy) - 5, int(hz) - 5, int(hx) + 6, int(hy) + 5, int(hz) + 5, SKIN, SKIN_B)
        P.flat(g, fist, SKIN, SKIN_B)
        P.flat(g, fist & (X < hx - 4) & ((np.floor(Y).astype(int) % 3) == 0), SKIN, SKIN_B - 2)  # finger splits round the club
        P.flat(g, fist & (X < hx - 4) & (Z < hz - 3), SKIN, SKIN_B + 1)
        P.flat(g, fist & (X > hx + 5) & (Y > hy + 1) & (Z < hz - 1), "bone", 6)  # the thumb nail
        bracer_y, bx, bz = None, None, None
    frame_edges(g, fist, SKIN, SKIN_B - 2)
    # a leather bracer on the forearm, wrapped straps with iron studs
    if s < 0:
        br = box(g, int(bx) - 6, int(bracer_y[0]), int(bz) - 6, int(bx) + 6, int(bracer_y[1]), int(bz) + 5, "wood", 4)
    else:
        bstart = len(g.solids)
        side(g, S.quad((43.5, CZ - 3.5), (39.5, CZ - 9.5), 5.6, 5.2), hx - 5.8, hx + 5.8, "wood", 4)
        br = g.solids[bstart].mask(g.shape)
    Xi, Yi, Zi = (np.floor(v).astype(int) for v in (X, Y, Z))
    P.flat(g, br, "wood", 4)
    P.flat(g, br & (((Xi + Zi + Yi * 2) % 6) < 3), "wood", 5)
    P.flat(g, br & (((Xi + Zi + Yi * 2) % 6) == 0), "darkwood", 2)
    P.flat(g, edges(br), "darkwood", 1)
    P.flat(g, br & (((Xi * 3 + Yi + Zi * 2) % 11) == 0), "iron", 5)
    return g


# ------------------------------------------------------------------ club
def club() -> Grid:
    """A tapered log, thick end up, held upright in the right fist: a
    leather grip, bark with knots, two iron bands and five flint stones
    driven into the head."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    hx, hy, hz = WRIST_R
    tx, ty, tz = CLUB_TOP

    def at(y):
        f = (y - 28.0) / (ty - 28.0)
        return hz - 1.0 + f * (tz - hz + 1.0)

    start = len(g.solids)
    plan(g, ngon(hx, at(28), 2.6, 8, math.pi / 8), 28, 46, "darkwood", 4, top=ngon(hx, at(46), 3.4, 8, math.pi / 8))
    plan(g, ngon(hx, at(46), 3.4, 8, math.pi / 8), 46, ty - 6, "darkwood", 4, top=ngon(hx, at(ty - 6), 6.4, 8, math.pi / 8))
    plan(g, ngon(hx, at(ty - 6), 6.4, 8, math.pi / 8), ty - 6, ty, "darkwood", 4, top=ngon(hx, at(ty), 4.2, 8, math.pi / 8))
    log = g.a > 0

    def bark(gg, mm, fr):
        U, V = P.uv(gg, fr)
        plate = U // 3
        shade = 4 + P._jitter(P._hash(plate, V // 6, seed=21))
        shade = np.where(U % 3 == 0, 3, shade)
        knot = (P._hash(plate, V // 5, seed=22) % np.uint64(19)) == 0
        shade = np.where(knot & (V % 5 < 2), 2, shade)
        P._paint(gg, mm, "darkwood", np.clip(shade, 1, 7))

    on_facets(g, start, bark)
    P.flat(g, log & (Y > ty - 0.8), "wood", 6)  # the cut end grain
    P.flat(g, log & (Y > ty - 0.8) & (np.abs(np.hypot(X - hx, Z - at(ty)) - 2.2) < 0.5), "wood", 4)  # a growth ring
    P.flat(g, edges(log) & (Y > ty - 6.2), "darkwood", 2)
    # the leather grip: whole turns with a dark seam
    grip = log & (Y < 40)
    Yi = np.floor(Y).astype(int)
    P.flat(g, grip, "wood", 4)
    P.flat(g, grip & ((Yi % 2) == 0), "wood", 5)
    P.flat(g, grip & ((Yi % 4) == 0), "darkwood", 2)
    P.flat(g, log & (Y < 29), "darkwood", 1)
    # two iron bands round the head
    for by in (ty - 16.0, ty - 8.0):
        band = log & (np.abs(Y - by) < 1.1)
        P.flat(g, band, "iron", 4)
        P.flat(g, band & (Y > by + 0.4), "iron", 6)
        P.flat(g, band & ((np.floor(X + Z).astype(int) % 4) == 0) & (np.abs(Y - by) < 0.5), "steel", 7)  # rivets
    # five flint stones driven into the thick part (true-slope wedges)
    sstart = len(g.solids)
    zc = at(ty - 12)
    side(g, [(ty - 14, zc - 5.0), (ty - 10, zc - 5.0), (ty - 12.5, zc - 10.0)], hx - 2.0, hx + 2.0, "stone", 4)
    side(g, [(ty - 5, at(ty - 3) - 5.5), (ty - 1, at(ty - 3) - 5.0), (ty - 1.5, at(ty - 3) - 9.0)], hx - 1.8, hx + 1.8, "stone", 4)
    front(g, [(hx + 5.5, ty - 13), (hx + 5.5, ty - 9), (hx + 10.5, ty - 10.5)], zc - 2.0, zc + 2.0, "stone", 4)
    front(g, [(hx - 5.5, ty - 6), (hx - 5.5, ty - 2), (hx - 10.0, ty - 3.0)], at(ty - 4) - 1.8, at(ty - 4) + 1.8, "stone", 4)
    side(g, [(ty - 12, zc + 5.0), (ty - 8, zc + 5.0), (ty - 9, zc + 9.5)], hx - 2.0, hx + 2.0, "stone", 4)
    stones = np.zeros(g.shape, dtype=bool)
    for sd in g.solids[sstart:]:
        stones |= sd.mask(g.shape)
    on_facets(g, sstart, lambda gg, mm, fr: P.flat(gg, mm, "stone", 4))
    P.flat(g, stones & S.seams(g, g.solids[sstart:], 0.7), "stone", 6)  # the lit chipped arrises
    P.flat(g, stones & ~log & (np.hypot(X - hx, Z - zc) < 6.6), "stone", 2)  # the dark root of each stone
    return g


# ------------------------------------------------------------------ build
def build():
    grids = {"cyclops": pelvis(), "body": body(), "head": head(), "arm-l": arm(-1), "arm-r": arm(1),
             "club": club(), "leg-l": leg(-1), "leg-r": leg(1)}
    waist = (CX, WAIST_Y, CZ)
    neck = (CX, NECK_Y, CZ - 1)
    sh = {s: (CX + s * SH_X, SHOULDER_Y, CZ) for s in (-1, 1)}
    hips = {s: (CX + s * 9.5, HIP_Y, CZ) for s in (-1, 1)}
    root, to_root = rig([
        ("cyclops", grids["cyclops"], None, None),
        ("leg-l", grids["leg-l"], hips[-1], None),
        ("leg-r", grids["leg-r"], hips[1], None),
        ("body", grids["body"], waist, None),
        ("head", grids["head"], neck, "body"),
        ("arm-l", grids["arm-l"], sh[-1], "body"),
        ("arm-r", grids["arm-r"], sh[1], "body"),
        ("club", grids["club"], WRIST_R, "arm-r"),
    ])
    idle = {"body": {"rot": keys((0, 0, 0, 0), (1.2, -2, 0, 1), (2.4, 0, 0, 0))},
            "head": {"rot": keys((0, 0, 0, 0), (0.6, 0, 14, 0), (1.2, 3, 0, 0), (1.8, 0, -14, 0), (2.4, 0, 0, 0))},
            "arm-l": {"rot": keys((0, 0, 0, 0), (1.2, 5, 0, -3), (2.4, 0, 0, 0))},
            "arm-r": {"rot": keys((0, 0, 0, 0), (1.2, 4, 0, 2), (2.4, 0, 0, 0))},
            "club": {"rot": keys((0, 0, 0, 0), (1.2, -5, 0, -3), (2.4, 0, 0, 0))}}
    # the overhead smash: the arm lifts the club up and back behind the head,
    # then swings forward and down, and the wrist turns the club head over
    # into the ground in front of the feet. Each key step stays under 150
    # degrees, as the export takes the short way between keys.
    attack = {"arm-r": {"rot": keys((0, 0, 0, 0), (0.22, 70, 0, 6), (0.42, 150, 0, 10), (0.56, 112, 0, 6), (0.66, 32, 0, 2), (0.80, 30, 0, 2), (1.30, 0, 0, 0))},
              "club": {"rot": keys((0, 0, 0, 0), (0.22, -20, 0, 0), (0.42, -55, 0, 0), (0.56, -110, 0, 0), (0.66, -172, 0, 0), (0.80, -170, 0, 0), (1.30, 0, 0, 0))},
              "body": {"rot": keys((0, 0, 0, 0), (0.42, 9, -8, 0), (0.66, -14, 6, 0), (0.80, -12, 4, 0), (1.30, 0, 0, 0))},
              "head": {"rot": keys((0, 0, 0, 0), (0.42, -6, 0, 0), (0.66, 10, 0, 0), (1.30, 0, 0, 0))},
              "arm-l": {"rot": keys((0, 0, 0, 0), (0.42, -18, 0, -14), (0.66, 30, 0, -8), (1.30, 0, 0, 0))},
              "cyclops": {"loc": keys((0, 0, 0, 0), (0.42, 0, 0, 1.5), (0.66, 0, 0, -3.0), (0.80, 0, 0, -3.0), (1.30, 0, 0, 0))}}
    hit = {"body": {"rot": keys((0, 0, 0, 0), (0.10, 12, 0, 6), (0.50, 0, 0, 0))},
           "head": {"rot": keys((0, 0, 0, 0), (0.10, 16, -12, 4), (0.50, 0, 0, 0))},
           "arm-l": {"rot": keys((0, 0, 0, 0), (0.10, -14, 0, -18), (0.50, 0, 0, 0))},
           "arm-r": {"rot": keys((0, 0, 0, 0), (0.10, -10, 0, 14), (0.50, 0, 0, 0))},
           "cyclops": {"loc": keys((0, 0, 0, 0), (0.10, 0, 0, 3.0), (0.50, 0, 0, 0))}}
    death = {"cyclops": {"rot": keys((0, 0, 0, 0), (0.35, -8, 0, 0), (1.00, 80, 0, 4), (1.15, 75, 0, 4), (1.35, 78, 0, 4)),
                         "loc": keys((0, 0, 0, 0), (1.00, 0, 14, 12), (1.35, 0, 14, 12))},
             "head": {"rot": keys((0, 0, 0, 0), (1.00, -20, 0, 0), (1.35, -10, 24, 0))},
             "arm-l": {"rot": keys((0, 0, 0, 0), (1.00, 20, 0, -50))},
             "arm-r": {"rot": keys((0, 0, 0, 0), (1.00, 20, 0, 50))},
             "club": {"rot": keys((0, 0, 0, 0), (1.00, 30, 0, -30))},
             "leg-l": {"rot": keys((0, 0, 0, 0), (1.00, 14, 0, -8))},
             "leg-r": {"rot": keys((0, 0, 0, 0), (1.00, 4, 0, 8))}}
    head_pt = (CLUB_TOP[0], CLUB_TOP[1] - 8.0, CLUB_TOP[2])
    return asset("creatures", "cyclops", "Cyclops", root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 sockets=[Socket("socket-function", at=to_root(head_pt), parent="club")],
                 fx=[pfx("rvx-fantasy-dust-slam", "socket-function", "clip:attack", size=34, at=0.64)])
