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
death (it topples back). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _life import asset, chamfer_rect, coords, facet_paint, front, keys, ngon, pfx, plan, rig, side
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket

SH = (96, 76, 84)
CX, CZ = 48.0, 44.0
HIDE, HIDE_B = "moss", 4  # an olive hide, not a saturated grass green (C1)
BELLY = "sand"
HIP_Y = 24.0
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
    # Lift the club, strike down, then recover. Keep the shoulder within one arc.
    attack = {"arm-r": {"rot": keys((0, 0, 0, 0), (0.16, 45, 0, -12), (0.34, 105, 0, -25), (0.44, 120, 0, -28),
                                    (0.52, 95, 0, -22), (0.62, 0, 0, -8), (0.70, 8, 0, -4), (0.86, 4, 0, 0), (1.15, 0, 0, 0))},
              "club": {"rot": keys((0, 0, 0, 0), (0.34, 5, 0, 0), (0.44, 5, 0, 0), (0.62, 0, 0, 0), (1.15, 0, 0, 0))},
              "arm-l": {"rot": keys((0, 0, 0, 0), (0.44, 22, 0, -12), (0.62, -12, 0, 8), (1.15, 0, 0, 0))},
              "body": {"rot": keys((0, 0, 0, 0), (0.34, -9, 0, 0), (0.44, -12, 0, 0), (0.62, 16, 0, 0), (0.70, 12, 0, 0), (1.15, 0, 0, 0))},
              "head": {"rot": keys((0, 0, 0, 0), (0.44, -8, 0, 0), (0.62, 12, 0, 0), (1.15, 0, 0, 0))},
              "troll": {"loc": keys((0, 0, 0, 0), (0.44, 0, 0, 1.5), (0.62, 0, 0, -2.5), (0.70, 0, 0, -1.0), (1.15, 0, 0, 0))}}
    hit = {"body": {"rot": keys((0, 0, 0, 0), (0.10, 16, 0, 7), (0.50, 0, 0, 0))},
           "head": {"rot": keys((0, 0, 0, 0), (0.10, 14, -10, 5), (0.50, 0, 0, 0))},
           "arm-l": {"rot": keys((0, 0, 0, 0), (0.10, -18, 0, -22), (0.50, 0, 0, 0))},
           "arm-r": {"rot": keys((0, 0, 0, 0), (0.10, -18, 0, 22), (0.50, 0, 0, 0))},
           "troll": {"loc": keys((0, 0, 0, 0), (0.10, 0, 0, 3.0), (0.50, 0, 0, 0))}}
    death = {"troll": {"rot": keys((0, 0, 0, 0), (0.30, 10, 0, 0), (0.90, 80, 0, 5), (1.05, 74, 0, 5), (1.25, 78, 0, 5)),
                       "loc": keys((0, 0, 0, 0), (0.20, 0, 5, 0), (0.30, 0, 5, 0), (0.45, 0, 14, 2.5),
                                   (0.60, 0, 22, 5), (0.75, 0, 30, 7.5), (0.90, 0, 34, 10), (1.25, 0, 34, 10))},
             "head": {"rot": keys((0, 0, 0, 0), (0.90, -24, 0, 0), (1.25, -12, 22, 0))},
             "arm-l": {"rot": keys((0, 0, 0, 0), (0.90, -34, 0, -60))},
             "arm-r": {"rot": keys((0, 0, 0, 0), (0.90, -44, 0, 70))},
             "club": {"rot": keys((0, 0, 0, 0), (0.90, -30, 0, 20))},
             "leg-l": {"rot": keys((0, 0, 0, 0), (0.90, -28, 0, -10))},
             "leg-r": {"rot": keys((0, 0, 0, 0), (0.90, -48, 0, 10))}}
    head_pt = (WRIST_R[0], 10.0, WRIST_R[2] - 24.0)
    return asset("creatures", "troll", "Cave Troll", root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 sockets=[Socket("socket-club", at=to_root(head_pt), parent="club")],
                 fx=[pfx("rvx-fantasy-dust-slam", "socket-club", "clip:attack", size=32, at=0.62)])
