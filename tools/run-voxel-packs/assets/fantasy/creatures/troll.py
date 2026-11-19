"""Cave troll in the Pirate Nation creature style.

A hulking, hunched brute almost twice a person tall, built from few big
volumes (rule F1): a barrel chest that swells into huge sloping shoulders,
a blunt head that sits forward on them with a heavy brow, gold eyes, a
jutting underbite and two bone tusks, long heavy arms that hang past the
knees with blocky fists, and short bowed legs on wide wedge feet. Limbs,
brow, jaw, ears, feet and club are true-slope prisms (F2); the mossy hide,
the sand belly, the warts, the hide kilt, the red sash and the bone
necklace are painted (S1). Moss and three toadstools grow on its back.

The oversized function prop is the club it drags (rule F4): a torn tree
trunk, as long as the troll is tall, capped by a lumpy boulder with three
iron spikes, its head resting on the ground in front of the right foot so
it reads in the silhouette (F6). Clips: idle (it breathes and sways),
attack (it swings the club up, over and down, throwing dust, PFX), hit,
death (it teeters and
crashes over backwards). Faces -Z.
"""
import numpy as np

from _falls_brutes import frames, knock_hit_base, step_in, topple_back

import paint as P
import pnglyph
import pnshapes as S
from _life import asset, chamfer_rect, coords, facet_paint, front, keys, ngon, pfx, plan, rig, side
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket
from _move_gaits import Gait, World, cyc, per_frame, solve_low, thump, turn_loop
from _quad_falls import _soles

SH = (96, 76, 84)
CX, CZ = 48.0, 44.0
HIDE, HIDE_B = "moss", 4  # an olive hide, not a saturated grass green (C1)
BELLY = "sand"
HIP_Y = 24.0
LEG_H, TOE, HEEL = 24.0, -16.0, 6.0  # hip height; the foot's toe and heel z from the hip
# death rest pose: extra root height, arm x angles overhead, head pitch, club keys, legs
TROLL_REST, ARM_UP, HEAD_BACK, LEG_REST = 0.34, (183.0, 160.0), 20.0, -23.0
W_FALL_DEF = (0.0, 30.0, 0.0)
W_LAND, W_FALL, W_HOP = (-30.0, 45.0, 0.0), W_FALL_DEF, (-28.0, 45.0, 0.0)
ARM_PRE = 15.0
ARM_SPREAD = (16.0, 16.0)
FLAT, BODY_LAND, LEG_LAG = 90.0, 2.0, 22.0
ATK_ARM, HIT_ARM = (31.5, 41.0, 34.5), (40.0, 46.0, 20.0)  # club arm keys that keep the club head ON the floor
SHOULDER_Y = 44.0
BODY_TOP = 50.0
HEAD_Y0, HEAD_Y1 = 46.0, 64.0
FACE_Z = CZ - 15.0  # the front of the head
HW = 10.0  # head half width
WRIST_R = (CX + 20.0, 13.0, CZ - 5.0)


def hide(g: Grid, m: np.ndarray, base: int = HIDE_B, frame=None, seed: int = 0, ramp: str = HIDE) -> None:
    """Troll hide: two close tones in big deliberate patches (about 6x5
    voxels), the darker tone along the lower edge of each patch, and a very
    few warts. No per-voxel camo (rule S3)."""
    U, V = P.uv(g, frame)
    cell = P._hash(U // 6, V // 5, seed=seed) % np.uint64(5)
    shade = np.where(cell == 0, base - 1, base)
    shade = np.where((cell < np.uint64(2)) & ((V % 5) == 0), base - 1, shade)  # the patch edges
    wart = (P._hash(U // 3, V // 3, seed=seed + 40) % np.uint64(41)) == 0
    shade = np.where(wart, base - 2, shade)
    P._paint(g, m, ramp, np.clip(shade, 1, 7))


def frame_edges(g: Grid, m: np.ndarray, delta: int = -2, ramp: str = HIDE, base: int = HIDE_B) -> None:
    """Darken the arrises of a volume, so every part reads as its own shape
    against the one behind it (rules S4, F3; the reviewers' rear views)."""
    P.flat(g, edges(m), ramp, max(1, base + delta))


def hide_facets(g: Grid, start: int, base: int = HIDE_B, seed: int = 0) -> None:
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: hide(gg, mm, base, frame=fr, seed=seed))


def leg(s: int) -> Grid:
    """A short bowed leg on a wide wedge foot with three bone claws."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    lx = CX + s * 8.0
    start = len(g.solids)
    foot = side(g, [(0, CZ - 15), (0, CZ + 7), (6.5, CZ + 7), (7.5, CZ + 1), (4.0, CZ - 15)], lx - 7, lx + 7, HIDE, HIDE_B)
    shin = side(g, S.quad((HIP_Y - 2.0, CZ + 1.5), (6.0, CZ - 0.5), 5.4, 4.6), lx - 5, lx + 5, HIDE, HIDE_B)
    hide_facets(g, start, HIDE_B - 1, seed=1 + s)
    toes = foot & (Z < CZ - 10)
    P.flat(g, toes & (np.abs(np.abs(X - lx) - 2.4) < 0.7), HIDE, HIDE_B - 2)  # the splits between the toes
    claw = toes & (Z < CZ - 13.0) & (Y > 1.5) & (Y < 4.0) & ((np.floor(X - lx + 6).astype(int) % 5) == 1)
    P.flat(g, claw, "bone", 6)
    P.flat(g, claw & (Z < CZ - 14.0), "bone", 7)
    P.flat(g, foot & (Y < 1), HIDE, HIDE_B - 2)
    P.flat(g, shin & (Y > 8) & (Y < 16) & (Z < CZ - 4), BELLY, 4)  # the pale shin
    return g


def pelvis() -> Grid:
    """The root: hips under a hide kilt with a rope belt and an iron buckle."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    start = len(g.solids)
    plan(g, chamfer_rect(CX - 13, CZ - 10, CX + 13, CZ + 10, 3), 18, 24, HIDE, HIDE_B)
    hide_facets(g, start, seed=3)
    kstart = len(g.solids)
    kilt = plan(g, chamfer_rect(CX - 12, CZ - 11, CX + 12, CZ + 11, 3), 12, 26, "wood", 4,
                top=chamfer_rect(CX - 14, CZ - 12, CX + 14, CZ + 12, 3))
    facet_paint(g, g.solids[kstart:], lambda gg, mm, fr: P.flat(gg, mm, "wood", 4))
    ang = np.floor((np.arctan2(Z - CZ, X - CX) + np.pi) / (2 * np.pi) * 12).astype(int)
    P.flat(g, kilt & (ang % 2 == 0), "wood", 5)  # alternating leather flaps, lit and shaded
    P.flat(g, kilt & (ang % 6 == 0), "darkwood", 2)  # the dark seam between flaps
    P.flat(g, kilt & (Y < 13), "darkwood", 2)  # the ragged hem
    frame_edges(g, kilt, -2, "wood", 4)
    belt = plan(g, chamfer_rect(CX - 13, CZ - 11, CX + 13, CZ + 11, 3), 24, 27, "wood", 3)
    P.flat(g, belt & (Y > 26), "wood", 4)  # the lit top of the leather belt
    P.flat(g, belt & (Y < 25), "darkwood", 2)
    buckle = box(g, int(CX) - 3, 24, int(CZ - 12), int(CX) + 3, 28, int(CZ - 9), "iron", 4)
    P.flat(g, edges(buckle), "iron", 2)
    P.flat(g, buckle & (Y > 26), "iron", 6)
    return g


def body() -> Grid:
    """A barrel chest that swells into huge sloping shoulders, with a mossy
    hunched back, three toadstools on it, a bone necklace and a red sash."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    start = len(g.solids)
    torso = side(g, [(22, CZ - 11), (22, CZ + 10), (34, CZ + 13), (44, CZ + 15), (BODY_TOP, CZ + 9), (BODY_TOP, CZ - 7), (40, CZ - 13), (28, CZ - 13)], CX - 13, CX + 13, HIDE, HIDE_B)
    torso |= front(g, [(CX - 13, 24), (CX + 13, 24), (CX + 20, 40), (CX + 18, BODY_TOP), (CX - 18, BODY_TOP), (CX - 20, 40)], CZ - 11, CZ + 12, HIDE, HIDE_B)
    hide_facets(g, start, seed=5)
    # a pale sand belly and chest, narrow enough to leave a green frame
    bl = torso & (Z < CZ - 6) & (np.abs(X - CX) < 7.5 + (40 - Y) * 0.10) & (Y < 42)
    hide(g, bl, 6, seed=6, ramp=BELLY)
    P.flat(g, bl & (np.abs(X - CX) < 1.0) & (Y > 26) & (Y < 34), BELLY, 4)
    for ry in (36.5, 39.5):
        P.flat(g, bl & (np.abs(Y - ry) < 0.6) & (np.abs(X - CX) > 2.0), BELLY, 5)
    # dark seams where the shoulders meet the arms and the head, so every
    # part reads apart from the one behind it, even from the back
    frame_edges(g, torso, -2)
    P.flat(g, torso & (np.abs(X - CX) > 16.0) & (Y > 34), HIDE, max(1, HIDE_B - 3))
    P.flat(g, torso & (Y > BODY_TOP - 2.5), HIDE, max(1, HIDE_B - 3))  # a dark collar under the head
    P.flat(g, torso & (Z > CZ + 11.5), HIDE, max(1, HIDE_B - 2))  # the dark rim of the hunched back
    P.flat(g, torso & (Y > 44) & (Z > CZ + 2), "moss", 6)  # moss on the hunched back
    P.flat(g, torso & (Y > 40) & (Z > CZ + 8), "moss", 6)
    P.flat(g, torso & (Y > 42) & (Z > CZ + 10) & ((np.floor(X + Y).astype(int) % 5) == 0), "forest", 4)
    # three toadstools growing out of the moss
    for tx, ty, tz, r in ((CX - 8.0, BODY_TOP, CZ + 11.0, 3.4), (CX + 5.0, 47.0, CZ + 13.0, 2.9), (CX + 12.0, 43.0, CZ + 12.0, 2.4)):
        g.box(tx - 0.8, ty, tz - 0.8, tx + 0.8, ty + 2, tz + 0.8, C("bone", 6))
        cap = plan(g, ngon(tx, tz, r, 8, 0.2), ty + 2, ty + 4, "red", 4, top=ngon(tx, tz, r * 0.4, 8, 0.2))
        P.flat(g, cap, "red", 5)
        P.flat(g, cap & (Y > ty + 3), "red", 6)
        P.flat(g, cap & (np.abs(X - tx - r * 0.4) < 0.8) & (Y > ty + 2.5), "bone", 7)
    nk = torso & (Z < CZ - 5) & (np.abs((Y - 43) + np.abs(X - CX) * 0.42) < 1.2) & (np.abs(X - CX) < 13)
    P.flat(g, nk, "sand", 3)
    P.flat(g, nk & ((np.floor(X).astype(int) % 3) == 0), "bone", 7)
    sash = torso & (np.abs((X - CX) * 0.62 + (Y - 38) * 0.5 - 6.0) < 2.6) & (Y > 26) & (Y < BODY_TOP - 1.5)
    P.flat(g, sash, "red", 4)
    P.flat(g, sash & ((np.floor(X + Y).astype(int) % 4) == 0), "red", 5)
    P.flat(g, sash & ((np.floor(X + Y).astype(int) % 8) == 0), "red", 2)  # its dark folds
    # a warm leather baldric the other way, with iron rings (rule C1)
    belt = torso & (np.abs((X - CX) * 0.60 - (Y - 36) * 0.52 + 4.0) < 1.5) & (Y > 26) & (Y < BODY_TOP - 2.5)
    P.flat(g, belt, "wood", 4)
    P.flat(g, belt & ((np.floor(X - Y).astype(int) % 5) == 0), "darkwood", 2)
    P.flat(g, belt & ((np.floor(X - Y).astype(int) % 9) == 0), "iron", 5)  # the iron rings on it
    return g


def head() -> Grid:
    """The head, set forward on the shoulders: a heavy brow over gold eyes,
    a squat nose, a jutting underbite with two bone tusks and torn ears."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    start = len(g.solids)
    plan(g, chamfer_rect(CX - HW, FACE_Z, CX + HW, CZ + 6, 3), HEAD_Y0 + 4, HEAD_Y1 - 2, HIDE, HIDE_B)
    plan(g, chamfer_rect(CX - HW, FACE_Z, CX + HW, CZ + 6, 3), HEAD_Y1 - 2, HEAD_Y1, HIDE, HIDE_B,
         top=chamfer_rect(CX - HW + 3, FACE_Z + 3, CX + HW - 3, CZ + 4, 2))
    jaw = side(g, [(HEAD_Y0, FACE_Z - 3), (HEAD_Y0, CZ + 2), (HEAD_Y0 + 5, CZ + 3), (HEAD_Y0 + 6, FACE_Z - 3)], CX - 9, CX + 9, HIDE, HIDE_B)
    hide_facets(g, start, seed=7)
    frame_edges(g, g.a > 0, -2)
    P.flat(g, (g.a > 0) & (Y < HEAD_Y0 + 1), HIDE, max(1, HIDE_B - 3))  # the dark underside of the head
    P.flat(g, jaw & (Y < HEAD_Y0 + 1), HIDE, HIDE_B - 2)
    P.flat(g, jaw & (Z < FACE_Z - 1.4), BELLY, 4)  # the pale chin
    # the heavy brow, proud of the face (a true-slope prism)
    bstart = len(g.solids)
    front(g, [(CX - HW - 0.8, HEAD_Y1 - 4.0), (CX - 1.6, HEAD_Y1 - 6.0), (CX + 1.6, HEAD_Y1 - 6.0), (CX + HW + 0.8, HEAD_Y1 - 3.4),
              (CX + HW + 0.8, HEAD_Y1 - 0.4), (CX - HW - 0.8, HEAD_Y1 - 1.0)], FACE_Z - 2.0, FACE_Z + 3.0, HIDE, HIDE_B - 1)
    hide_facets(g, bstart, HIDE_B - 1, seed=8)
    # a squat nose between the eyes and the mouth
    nstart = len(g.solids)
    nose = side(g, [(HEAD_Y0 + 6.0, FACE_Z + 1), (HEAD_Y0 + 10.5, FACE_Z + 1), (HEAD_Y0 + 9.5, FACE_Z - 5.0), (HEAD_Y0 + 5.0, FACE_Z - 4.0)], CX - 3.0, CX + 3.0, HIDE, HIDE_B)
    hide_facets(g, nstart, HIDE_B, seed=9)
    P.flat(g, nose & (Z < FACE_Z - 3.2), HIDE, HIDE_B + 1)
    P.flat(g, nose & (np.abs(np.abs(X - CX) - 1.6) < 0.7) & (Y < HEAD_Y0 + 7.4), HIDE, 1)  # nostrils
    # two torn ears
    for s in (-1, 1):
        estart = len(g.solids)
        ear = front(g, [(CX + s * (HW - 0.5), HEAD_Y0 + 6), (CX + s * (HW - 0.5), HEAD_Y0 + 13), (CX + s * (HW + 9), HEAD_Y0 + 15), (CX + s * (HW + 7), HEAD_Y0 + 7)], CZ - 5, CZ, HIDE, HIDE_B)
        hide_facets(g, estart, seed=10 + s)
        P.flat(g, ear & (np.abs(X - CX) > HW + 1.5) & (Z < CZ - 3.5), BELLY, 4)
        P.flat(g, ear & (np.abs(X - CX) > HW + 5.5) & (Y > HEAD_Y0 + 13), HIDE, HIDE_B - 2)  # a torn notch
    # the painted face: big gold eyes under the brow, a wide mouth of teeth
    ink = {"g": C("gold", 6), "G": C("gold", 7), "p": C("darkwood", 1), "m": C("darkwood", 1), "t": C("bone", 7), "s": C(HIDE, HIDE_B - 2)}
    eyes = ["sgggggs......sgggggs", "ggGppgg......ggppGgg", "sgggggs......sgggggs"]
    pnglyph.stamp(g, "-z", FACE_Z, int(CX - 10), int(HEAD_Y0 + 10), eyes, ink)
    mouth = ["mmmmmmmmmmmmmmmmm", "mttmmttmmttmmttmm", "smmmmmmmmmmmmmmms", ".smmmmmmmmmmmmms."]
    pnglyph.stamp(g, "-z", FACE_Z - 3.0, int(CX - 8.5), int(HEAD_Y0 + 1), mouth, ink)
    # two tusks rising from the underbite, below the eyes
    for tx in (CX - 8.0, CX + 5.0):
        t = side(g, [(HEAD_Y0 + 4.0, FACE_Z - 4.4), (HEAD_Y0 + 4.0, FACE_Z - 1.4), (HEAD_Y0 + 9.5, FACE_Z - 3.0)], tx, tx + 3.0, "bone", 6)
        P.flat(g, t & (Y > HEAD_Y0 + 7), "bone", 7)
        P.flat(g, t & (Y < HEAD_Y0 + 5.5), "sand", 4)
    return g


def arm(s: int) -> Grid:
    """A long heavy arm: a tapered upper arm and forearm (true slopes) and a
    blocky fist with painted knuckles and bone nails."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    sx = CX + s * 18.0
    start = len(g.solids)
    front(g, S.quad((sx, SHOULDER_Y + 2), (sx + s * 3.0, 28.0), 6.4, 5.0, cap=0.4), CZ - 7, CZ + 6, HIDE, HIDE_B)
    front(g, S.quad((sx + s * 3.0, 29.0), (sx + s * 2.0, 16.0), 5.0, 4.2, cap=0.3), CZ - 8, CZ + 4, HIDE, HIDE_B)
    hide_facets(g, start, seed=12 + s)
    hx = sx + s * 2.0
    fist = box(g, int(hx) - 5, 8, int(CZ) - 10, int(hx) + 5, 17, int(CZ) + 2, HIDE, HIDE_B)
    hide(g, fist, HIDE_B, seed=14 + s)
    P.flat(g, fist & (Z < CZ - 9) & ((np.floor(X).astype(int) % 3) == 0) & (Y < 15), HIDE, HIDE_B - 2)  # finger splits
    P.flat(g, fist & (Z < CZ - 9) & ((np.floor(X).astype(int) % 3) == 1) & (Y > 14), "bone", 6)  # nails
    P.flat(g, fist & (Y < 9), HIDE, HIDE_B - 2)
    frame_edges(g, g.a > 0, -2)
    P.flat(g, (g.a > 0) & (np.abs(X - CX) < 13.5), HIDE, max(1, HIDE_B - 3))  # a dark inner edge against the chest
    # a leather bracer on both arms: wrapped straps with iron studs, in the
    # warm half of the theme (no masonry pattern, rule S2)
    br = box(g, int(hx) - 6, 17, int(CZ) - 10, int(hx) + 6, 23, int(CZ) + 3, "wood", 4)
    Xi, Yi, Zi = (np.floor(v).astype(int) for v in (X, Y, Z))
    P.flat(g, br & (((Xi + Zi + Yi * 2) % 6) < 3), "wood", 5)  # the diagonal wrap of the strap
    P.flat(g, br & (((Xi + Zi + Yi * 2) % 6) == 0), "darkwood", 2)  # the dark seam of each turn
    P.flat(g, edges(br), "darkwood", 1)
    P.flat(g, br & (np.abs(Y - 20) < 0.6) & ((np.floor(X + Z).astype(int) % 5) == 0), "iron", 5)
    return g


def club() -> Grid:
    """The club the troll drags: a torn tree trunk that slopes down and
    forward from the fist, capped by a lumpy boulder with three iron spikes
    whose weight rests on the ground."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    hx, hz = WRIST_R[0], WRIST_R[2]
    start = len(g.solids)
    # the shaft, a tapering trunk in the (y, z) plane (a true slope)
    shaft = side(g, S.quad((19.5, hz + 7.0), (11.0, hz - 16.0), 4.2, 6.2), hx - 5.0, hx + 5.0, "darkwood", 4)
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.planks(gg, mm, "darkwood", 4, width=3, across="y", length=(22, 26), nails=False, frame=fr, seed=20))
    P.flat(g, shaft & (Z > hz + 4.5), "wood", 6)  # the torn end grain
    P.flat(g, shaft & (Z > hz - 4) & (Z < hz), "wood", 5)  # a bark scar
    hstart = len(g.solids)
    head_m = S.disc(g, "x", 11.0, hz - 22.0, 7.4, hx - 8.0, hx - 2.0, "stone", 3, n=7)
    head_m |= S.disc(g, "x", 10.5, hz - 24.0, 10.0, hx - 6.0, hx + 5.0, "stone", 3, n=7)
    head_m |= S.disc(g, "x", 11.0, hz - 21.0, 7.4, hx + 3.0, hx + 8.0, "stone", 3, n=7)
    # a clear stone boulder in a dark frame, with two iron bands: it must
    # never share the colour of the fist that holds it (finding A3)
    facet_paint(g, g.solids[hstart:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 3, block=(6, 4), cracks=0.10, frame=fr, seed=21))
    P.flat(g, head_m & S.seams(g, g.solids[hstart:], 0.8), "stone", 1)  # the dark arrises of the boulder
    P.flat(g, edges(head_m), "stone", 1)
    P.flat(g, head_m & (Y > 17), "stone", 5)  # the lit crown, not a green cap
    P.flat(g, head_m & (Y < 3.5), "stone", 1)
    for bz in (hz - 27.5, hz - 19.5):  # two iron bands that lash it to the trunk
        band = head_m & (np.abs(Z - bz) < 1.1)
        P.flat(g, band, "iron", 4)
        P.flat(g, band & ((np.floor(X + Y).astype(int) % 4) == 0), "iron", 6)
    # three iron spikes driven into the boulder (true-slope wedges)
    spikes = [side(g, [(15.0, hz - 31.0), (20.0, hz - 28.0), (11.0, hz - 38.0)], hx - 2.5, hx + 2.5, "iron", 4),
              front(g, [(hx + 6.0, 6.0), (hx + 6.0, 12.0), (hx + 16.0, 8.0)], hz - 27.0, hz - 22.0, "iron", 4),
              front(g, [(hx - 6.0, 9.0), (hx - 6.0, 15.0), (hx - 16.0, 12.5)], hz - 28.0, hz - 23.0, "iron", 4)]
    for sp in spikes:
        P.flat(g, sp, "iron", 4)
        P.flat(g, sp & (Y > 11.0), "steel", 6)
    # a leather lashing round the grip: whole turns of hide with a dark
    # seam between them, not a brick course (finding A5)
    grip = (g.a > 0) & (Z > hz + 2.0) & (Z < hz + 8.0) & (Y > 13)
    Zi = np.floor(Z).astype(int)
    P.flat(g, grip, "wood", 4)
    P.flat(g, grip & ((Zi % 2) == 0), "wood", 5)
    P.flat(g, grip & ((Zi % 4) == 0), "darkwood", 2)
    P.flat(g, grip & (Z > hz + 7.0), "darkwood", 1)  # the dark end of the wrap
    return g


def lumber_move(root) -> dict:
    """move: a slow, heavy lumber, 44 frames (two steps). The short legs
    take wide stomps (the big wedge feet strike heel first and roll off the
    toe); the bulk heaves up over the passing leg and falls with gravity
    into each footfall, keeps sinking 2 frames past it and stops dead. The
    hunched torso rolls its whole weight over the planted foot and twists
    with the free arm, whose fist swings low past the knee. The club is
    dragged: its head stays on the floor in front of the right foot (the
    club arm is solved a frame at a time so it never digs in or lifts) and
    it jolts on each footfall. Authored with contacts on f11 and f33;
    turn_loop then starts the loop mid-stroke."""
    T, CL, CR = 44, 11, 33
    gait = Gait(root, "troll", ["leg-l", "leg-r"])
    th = thump(T, [CL, CR], depth=2.4, fall=6, past=2)
    s = gait.walk(T, {"leg-l": CL / T, "leg-r": CR / T}, duty=0.62, stride=12.0, lift=4.0, height=lambda f: 0.5 - th(f), carry=0.75, land=0.3)
    sq = thump(T, [CL, CR], depth=1.0, fall=1, past=2, rise=5)
    k = [sq(f) for f in range(T + 1)]

    def z(*v):
        return np.array(v, float)
    s["body"] = {"rot": [r + z(-3 * kk, 0, 0) for r, kk in zip(
                     cyc([(0, z(0, 4, -2)), (CL + 2, z(0, 7, 7), "snap"), (22, z(1, 0, 2)), (CR + 2, z(0, -7, -7), "snap")], T), k)],
                 "scale": [z(1 + 0.025 * kk, 1 - 0.05 * kk, 1 + 0.025 * kk) for kk in k]}
    s["head"] = {"rot": [r + z(-6 * sq((f - 1) % T), 0, 0) for f, r in enumerate(
                     cyc([(0, z(0, -3, 1)), (CL + 3, z(2, -6, -4), "snap"), (22, z(0, 2, -1)), (CR + 3, z(2, 6, 4), "snap")], T))]}
    # the free arm hangs and swings like a pendulum, a beat behind the shoulders
    s["arm-l"] = {"rot": cyc([(0, z(10, 0, -2)), (CL + 3, z(-20, 0, -4), "snap"), (22, z(-6, 0, -3)), (CR + 3, z(24, 0, -2), "snap")], T)}
    s["club"] = {"rot": [z(-3 * sq((f - 1) % T), 0, 0) for f in range(T + 1)]}
    s["arm-r"] = {"rot": [z(0, 0, 0) for _ in range(T + 1)]}
    world = World(root)
    pts = _soles(world.parts["club"])
    for f in range(T + 1):
        solve_low(world, s, f, "club", pts, "arm-r", 0, 0.0, lo=-30.0, hi=40.0)
    s, _ = turn_loop(s, T)
    return per_frame(s)


def build():
    grids = {"troll": pelvis(), "body": body(), "head": head(), "arm-l": arm(-1), "arm-r": arm(1),
             "club": club(), "leg-l": leg(-1), "leg-r": leg(1)}
    waist = (CX, 24.0, CZ)
    neck = (CX, HEAD_Y0 + 2, CZ + 1)
    sh = {s: (CX + s * 18.0, SHOULDER_Y + 2, CZ) for s in (-1, 1)}
    hips = {s: (CX + s * 8.0, HIP_Y, CZ + 1) for s in (-1, 1)}
    root, to_root = rig([
        ("troll", grids["troll"], None, None),
        ("leg-l", grids["leg-l"], hips[-1], None),
        ("leg-r", grids["leg-r"], hips[1], None),
        ("body", grids["body"], waist, None),
        ("head", grids["head"], neck, "body"),
        ("arm-l", grids["arm-l"], sh[-1], "body"),
        ("arm-r", grids["arm-r"], sh[1], "body"),
        ("club", grids["club"], WRIST_R, "arm-r"),
    ])
    # the head hangs forward off the hunched shoulders (rule F4)
    next(p for p in root.walk() if p.name == "head").rot = (14.0, 0.0, 0.0)
    idle = {"body": {"rot": keys((0, 0, 0, 0), (1.0, 3, 0, 0), (2.0, 0, 0, 0))},
            "head": {"rot": keys((0, 0, 0, 0), (0.5, 2, 12, 0), (1.0, -2, 0, 0), (1.5, 2, -12, 0), (2.0, 0, 0, 0))},
            "arm-l": {"rot": keys((0, 0, 0, 0), (1.0, 7, 0, -5), (2.0, 0, 0, 0))},
            "arm-r": {"rot": keys((0, 0, 0, 0), (1.0, -5, 0, 4), (2.0, 0, 0, 0))},
            "club": {"rot": keys((0, 0, 0, 0), (1.0, 4, 0, 0), (2.0, 0, 0, 0))}}
    # The smash. Wind-up (0-0.43 s): it rears right back and twists away, the
    # club hauled up high over the shoulder, the head tipped up after it, the
    # free arm thrown forward for balance. Strike (4 frames, 0.43-0.567 s):
    # everything drives down at once, the body slamming forward and down
    # onto the stepping foot, the club smashing into the ground in front
    # (impact). Follow-through: the body keeps folding 15-20% past the
    # contact while the club bounces a little off the ground; a moving hold
    # with the head shaking and the free arm still swinging; then it hauls
    # itself up, leaning back past rest before it settles.
    attack = {"arm-r": {"rot": keys((0, 0, 0, 0), (0.2, 74, 0, -18), (0.3667, 146, 0, -30), (0.4333, 152, 0, -30),
                                    (0.5667, ATK_ARM[0], 0, -6), (0.6333, ATK_ARM[1], 0, -4), (0.7667, ATK_ARM[2], 0, -4), (0.95, 6, 0, -1), (1.1333, 0, 0, 0))},
              "club": {"rot": keys((0, 0, 0, 0), (0.3667, 16, 0, 0), (0.4333, 24, 0, 0), (0.5667, 0, 0, 0), (0.6333, -3, 0, 0), (0.7667, 1, 0, 0), (1.1333, 0, 0, 0))},
              "arm-l": {"rot": keys((0, 0, 0, 0), (0.3667, 34, 0, -14), (0.4333, 40, 0, -18), (0.5667, -26, 0, 14), (0.6667, -34, 0, 18), (0.8, -12, 0, 8), (0.95, 8, 0, -2), (1.1333, 0, 0, 0))},
              "body": {"rot": keys((0, 0, 0, 0), (0.2, 10, -6, 0), (0.3667, 20, -12, 0), (0.4333, 22, -14, 0), (0.5667, -24, 8, 0), (0.6333, -29, 9, 0), (0.7667, -24, 6, 0), (0.9667, 5, 0, 0), (1.1333, 0, 0, 0))},
              "head": {"rot": keys((0, 0, 0, 0), (0.3667, 14, -6, 0), (0.4667, 18, -8, 0), (0.6, -18, 4, 0), (0.6667, -24, 10, 0), (0.7333, -20, -8, 0), (0.8, -22, 6, 0), (0.9, -6, 0, 0), (1.0, 4, 0, 0), (1.1333, 0, 0, 0))},
              # the weight: rocks back on the wind-up, drives forward and DOWN
              # onto the planted lead foot on the blow (the legs take it), the
              # whole bulk squashing into the ground
              "troll": {"loc": keys((0, 0, 0, 0), (0.3667, 0, 0, 1.6), (0.4333, 0, 0, 1.8), (0.5667, 0, -1.6, -3.4), (0.6333, 0, -2.0, -3.9), (0.7667, 0, -1.4, -3.4),
                                    (0.9667, 0, 0, 0.4), (1.1333, 0, 0, 0)),
                        "scale": keys((0, 1, 1, 1), (0.4333, 0.98, 1.03, 0.98), (0.5667, 1.05, 0.94, 1.05), (0.6667, 0.99, 1.01, 0.99), (0.8, 1, 1, 1), (1.1333, 1, 1, 1))}}
    # the smash is a deliberate step: the left foot lifts at the top of the
    # wind-up, swings forward and plants WITH the blow, the right stays
    # planted (soles solved flat on the floor every frame), both step home
    legs, attack["troll"]["loc"] = step_in(attack["troll"]["loc"], H=LEG_H, toe=TOE, heel=HEEL, stride=-7.0, lift_t=0.4, plant_t=0.5667, back_t=0.7667, home_t=1.0, lift=3.0)
    attack.update(legs)
    # hit: a blow to the gut. The heaviest: shoved back only a little off its
    # feet, the belly squashed, the head snapped back and the long arms flung
    # forward; then it folds over its winded belly as it steps back in, head
    # hanging, and hauls itself upright, the weight rocking back past rest
    hit = knock_hit_base("troll", LEG_H, TOE, HEEL, k=1.25, push=9.0, pop=1.8, home="steps", squash=0.08, end=34)
    hit.update({
        "body": {"rot": frames(1.25, [(0, (0, 0, 0)), (1, (14, 0, 3)), (5, (24, 0, 5)), (9, (12, 0, 2)), (13, (-10, 0, -2)), (17, (-23, 0, -3)), (22, (-14, 0, -1)), (27, (5, 0, 0)), (33, (0, 0, 0))]),
                 "scale": frames(1.25, [(0, (1, 1, 1)), (1, (1.08, 0.92, 0.94)), (5, (0.97, 1.03, 1.02)), (9, (1.02, 0.98, 1.0)), (14, (1, 1, 1)), (33, (1, 1, 1))])},
        "head": {"rot": frames(1.25, [(0, (0, 0, 0)), (1, (18, 6, 4)), (6, (32, 10, 6)), (10, (6, 4, 2)), (14, (-20, 0, 0)), (19, (-30, -8, 0)), (24, (-10, 5, 0)), (29, (4, 0, 0)), (34, (0, 0, 0))])},
        "arm-l": {"rot": frames(1.25, [(0, (0, 0, 0)), (1, (16, 0, -10)), (6, (34, 0, -18)), (10, (12, 0, -8)), (15, (-12, 0, 2)), (20, (-6, 0, 0)), (26, (6, 0, 0)), (33, (0, 0, 0))])},
        "arm-r": {"rot": frames(1.25, [(0, (0, 0, 0)), (1, (14, 0, 8)), (6, (30, 0, 14)), (10, (16, 0, 6)), (15, (HIT_ARM[0], 0, 2)), (20, (HIT_ARM[1], 0, 0)), (26, (HIT_ARM[2], 0, 0)), (33, (0, 0, 0))])},
        "club": {"rot": frames(1.25, [(0, (0, 0, 0)), (2, (8, 0, 0)), (6, (16, 0, 3)), (11, (4, 0, 0)), (17, (6, 0, 0)), (24, (2, 0, 0)), (33, (0, 0, 0))])},
    })
    # death, heaviest: a short teeter, then it crashes over backwards about
    # its heels, gathering speed hard (power 3) into a heavy slam flat on its
    # back: a deep squash and barely a bounce; the arms are flung up and
    # slammed down overhead, the club and the head land last
    death, LAND = topple_back("troll", hip=to_root((CX, HIP_Y, CZ + 1))[1:], H=LEG_H, heel=HEEL, beats=(5, 13, 18, 31), power=3.0, bounce=0.3, rock=0.2,
                              body_flex=1.0, rest_lift=TROLL_REST, squash=0.15,
                              weapon="club", weapon_land=W_LAND, weapon_fall=W_FALL, weapon_hop=W_HOP, arm_up=ARM_UP, arm_spread=ARM_SPREAD,
                              head_back=HEAD_BACK, head_yaw=10.0, leg_rest=LEG_REST, leg_lag=LEG_LAG, flat=FLAT, body_land=BODY_LAND, arm_pre=ARM_PRE, arm_flop=3.0, leg_bump=2.0)
    # the club head rests on the floor in front: the club arm never swings
    # back before the landing (that would drive the club into the floor and
    # lever the troll off its feet)
    death["arm-r"]["rot"] = [(tt, (max(x, 4.0) if tt < LAND else x, y, z)) for tt, (x, y, z) in death["arm-r"]["rot"]]
    head_pt = (WRIST_R[0], 10.0, WRIST_R[2] - 24.0)
    return asset("creatures", "troll", "Cave Troll", root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False, impact=0.5667), Clip("hit", hit, loop=False), Clip("death", death, loop=False, impact=LAND),
                        Clip("move", lumber_move(root), ease=0.0, floor=False)],
                 sockets=[Socket("socket-club", at=to_root(head_pt), parent="club")],
                 fx=[pfx("rvx-fantasy-dust-slam", "socket-club", "clip:attack", size=32, at=0.5667)])
