"""Harpy in the Pirate Nation creature style.

A winged woman a little taller than a person: a big human head (rule F4)
with a pale face, fierce cyan eyes under angry brows, violet war paint, a
snarl with two small fangs and a wild mane of dark violet hair that
spikes back. A slim human torso in a bandeau of dark feathers with a bone
necklace and a bare midriff. Her arms are wings: grey-brown feather
panels with pale coverts, long dark primaries with violet tips and a
hooked claw at each wrist. Below a skirt of feathers, feathered thighs
end in thin scaly bird legs and splayed talons with dark hooked claws,
and a fan of tail feathers spreads behind. No orange, red or gold: those
stay with the phoenix.

Wings, limbs, toes, claws, nose, hair spikes and tail are true-slope
prisms (F2); feathers, scales, skin, hair and the face are paint (S1).
The talons are the function: the socket sits on the right foot.

Clips: idle (wings breathe, the head turns), attack (a talon dive: she
crouches, springs up with the wings raised, beats them down and dives
forward with both feet thrown out in front, with a slash arc at the
talons), hit, death (she falls back, the wings slump). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _fcreature_giants import feathers, frame_edges, on_facets, patches, scales, seam_frame
from _life import asset, chamfer_rect, coords, front, keys, ngon, pfx, plan, rig, side
from pnkit import box
from voxgrid import C, Clip, Grid, Socket

SH = (60, 52, 44)
CX, CZ = 30.0, 22.0
SKIN, SKIN_B = "skin", 5
FEATHER, FEATHER_B = "stone", 4  # grey-brown, not the phoenix's orange
TIP = "purple"  # violet feather tips, hair and war paint
HAIR = "purple"
LEG = "sand"
CLAW = "iron"
HIP_Y = 17.0
WAIST_Y = 20.5
SHOULDER = {s: (CX + s * 6.5, 29.5, CZ + 1.5) for s in (-1, 1)}
NECK = (CX, 31.0, CZ)
FACE_Z = CZ - 5.0


def feathered(g: Grid, start: int, base: int = FEATHER_B, seed: int = 0, width: int = 4, row: int = 3) -> None:
    on_facets(g, start, lambda gg, mm, fr: feathers(gg, mm, FEATHER, base, frame=fr, seed=seed, width=width, row=row))


def skin(g: Grid, start: int, base: int = SKIN_B, seed: int = 0) -> None:
    on_facets(g, start, lambda gg, mm, fr: patches(gg, mm, SKIN, base, frame=fr, seed=seed, cell=(4, 3)))


# ------------------------------------------------------------------ legs
def leg(s: int) -> Grid:
    """A feathered thigh, a thin scaly tarsus that slopes forward to the
    foot, three splayed front toes and one back toe, each with a dark
    hooked claw."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    lx = CX + s * 4.0
    start = len(g.solids)
    thigh = plan(g, ngon(lx, CZ + 0.5, 3.0, 8, math.pi / 8), 9.0, HIP_Y + 1.0, FEATHER, FEATHER_B, top=ngon(lx, CZ + 0.5, 3.8, 8, math.pi / 8))
    feathered(g, start, FEATHER_B, seed=1 + s)
    # the ragged lower edge of the thigh feathers, with violet tips
    U = np.floor(X + Z).astype(int)
    hem = 9.0 + 1.5 * ((U % 3) == 0)
    P.flat(g, thigh & (Y < hem + 1.0), FEATHER, FEATHER_B - 1)
    P.flat(g, thigh & (Y < hem), TIP, 3)
    tstart = len(g.solids)
    tarsus = side(g, S.quad((10.0, CZ + 2.0), (1.5, CZ - 0.5), 1.5, 1.3), lx - 1.4, lx + 1.4, LEG, 4)
    on_facets(g, tstart, lambda gg, mm, fr: scales(gg, mm, LEG, 4, frame=fr))
    P.flat(g, tarsus & (Z < CZ - 0.5) & (Y > 3), LEG, 5)  # the lit front of the shin
    # the toes: three splayed forward and one back (true-slope wedges)
    ostart = len(g.solids)
    tips = []
    for dx, dz in ((-2.8, -5.0), (0.0, -6.0), (2.8, -5.0), (0.0, 3.8)):
        plan(g, S.quad((lx, CZ - 0.5), (lx + dx, CZ - 0.5 + dz), 1.1, 0.8), 0.0, 1.8, LEG, 4)
        tips.append((lx + dx, CZ - 0.5 + dz, 1 if dz > 0 else -1))
    toes = np.zeros(g.shape, dtype=bool)
    for sd in g.solids[ostart:]:
        toes |= sd.mask(g.shape)
    on_facets(g, ostart, lambda gg, mm, fr: scales(gg, mm, LEG, 4, frame=fr))
    P.flat(g, toes & (Y < 0.8), LEG, 2)
    knuckle = toes & ((np.floor(np.hypot(X - lx, Z - CZ + 0.5)).astype(int) % 2) == 0) & (Y > 1.0)
    P.flat(g, knuckle, LEG, 3)  # the joints of the toes
    # dark hooked claws at the toe tips (wedges that curl down to the ground)
    cstart = len(g.solids)
    for tx, tz, d in tips:
        side(g, [(0.0, tz + d * 1.8), (2.3, tz - d * 0.4), (1.2, tz - d * 1.0), (0.0, tz + d * 0.6)], tx - 0.7, tx + 0.7, CLAW, 3)
    claws = np.zeros(g.shape, dtype=bool)
    for sd in g.solids[cstart:]:
        claws |= sd.mask(g.shape)
    on_facets(g, cstart, lambda gg, mm, fr: P.flat(gg, mm, CLAW, 3))
    P.flat(g, claws & (Y > 1.6), CLAW, 5)
    P.flat(g, claws & (Y < 0.6), "bone", 4)  # the worn pale points
    return g


# ------------------------------------------------------------------ root
def pelvis() -> Grid:
    """The root: hips in a skirt of feathers with violet tips, a cord
    belt with a bone charm, and a fan of tail feathers behind."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    start = len(g.solids)
    skirt = plan(g, chamfer_rect(CX - 7.5, CZ - 4.5, CX + 7.5, CZ + 5.0, 2), 13.0, WAIST_Y + 0.5, FEATHER, FEATHER_B,
                 top=chamfer_rect(CX - 5.0, CZ - 3.5, CX + 5.0, CZ + 3.5, 1.5))
    feathered(g, start, FEATHER_B + 1, seed=4)
    U = np.floor(X + Z).astype(int)
    hem = 13.0 + 2.0 * ((U % 4) < 2)
    P.flat(g, skirt & (Y < hem + 1.0), FEATHER, FEATHER_B - 1)
    P.flat(g, skirt & (Y < hem), TIP, 4)
    P.flat(g, skirt & (Y < hem) & ((U % 4) == 0), TIP, 2)
    seam_frame(g, start, FEATHER, FEATHER_B - 2)
    cord = skirt & (np.abs(Y - 19.6) < 0.6)
    P.flat(g, cord, "wood", 4)
    P.flat(g, cord & ((U % 3) == 0), "wood", 2)
    charm = box(g, int(CX - 1), 16, int(CZ - 5), int(CX + 1), 19, int(CZ - 4), "bone", 6)
    P.flat(g, charm & (Y < 17), "bone", 4)
    # a fan of five tail feathers spreading back and down from the hips
    fstart = len(g.solids)
    for k, a in enumerate((-34.0, -17.0, 0.0, 17.0, 34.0)):
        r = math.radians(a)
        tx, tz = CX + math.sin(r) * 9.0, CZ + 4.0 + math.cos(r) * 9.0
        plan(g, S.quad((CX + math.sin(r) * 2.0, CZ + 4.0), (tx, tz), 1.3, 2.1, cap=0.7), 12.5 - abs(a) * 0.05, 14.5 - abs(a) * 0.05, FEATHER, 3)
    fan = np.zeros(g.shape, dtype=bool)
    for sd in g.solids[fstart:]:
        fan |= sd.mask(g.shape)
    on_facets(g, fstart, lambda gg, mm, fr: P.flat(gg, mm, FEATHER, 3))
    dist = np.hypot(X - CX, Z - CZ - 4.0)
    P.flat(g, fan & (dist > 6.5), TIP, 3)
    P.flat(g, fan & (dist > 8.0), TIP, 5)
    P.flat(g, fan & (np.abs(dist - 5.0) < 0.6), FEATHER, 5)  # a pale bar across the fan
    return g


# ------------------------------------------------------------------ body
def body() -> Grid:
    """A slim human torso: bare skin with collarbones and a navel, a
    bandeau of dark feathers with violet edges, and a necklace of bone
    beads."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    start = len(g.solids)
    torso = side(g, [(WAIST_Y - 0.5, CZ - 3.2), (WAIST_Y - 0.5, CZ + 3.0), (26.0, CZ + 3.6), (31.0, CZ + 3.0), (31.5, CZ - 2.8),
                     (28.0, CZ - 4.4), (24.5, CZ - 3.6)], CX - 5.5, CX + 5.5, SKIN, SKIN_B)
    torso |= front(g, [(CX - 4.2, WAIST_Y - 0.5), (CX + 4.2, WAIST_Y - 0.5), (CX + 5.4, 26.0), (CX + 7.2, 29.5), (CX + 6.4, 31.5),
                       (CX - 6.4, 31.5), (CX - 7.2, 29.5), (CX - 5.4, 26.0)], CZ - 3.4, CZ + 3.0, SKIN, SKIN_B)
    skin(g, start, seed=5)
    seam_frame(g, start, SKIN, SKIN_B - 2)
    P.flat(g, torso & (Z < CZ - 3.0) & (np.abs(X - CX) < 0.6) & (np.abs(Y - 22.5) < 0.6), SKIN, SKIN_B - 2)  # navel
    P.flat(g, torso & (Z < CZ - 2.4) & (np.abs(Y - (30.0 + np.abs(X - CX) * 0.2)) < 0.5) & (np.abs(X - CX) > 1.0) & (np.abs(X - CX) < 5.0), SKIN, SKIN_B - 1)  # collarbones
    P.flat(g, torso & (Y > WAIST_Y + 1.5) & (Y < 25.0) & (np.abs(np.abs(X - CX) - 2.2) < 0.5) & (Z < CZ - 3.0), SKIN, SKIN_B - 1)  # the line of the belly
    # the feather bandeau round the chest
    band = torso & (Y > 25.0) & (Y < 29.0)
    feathers(g, band, FEATHER, 3, frame="wall", seed=6, width=3, row=2)
    P.flat(g, torso & ((np.abs(Y - 25.0) < 0.6) | (np.abs(Y - 29.0) < 0.6)), TIP, 3)  # its violet edges
    P.flat(g, torso & (np.abs(Y - 25.0) < 0.6) & ((np.floor(X + Z).astype(int) % 2) == 0), TIP, 5)
    # a necklace of bone beads with one fang in the middle
    beads = torso & (Z < CZ - 1.5) & (np.abs(Y - (30.4 - (X - CX) ** 2 * 0.05)) < 0.6) & (np.abs(X - CX) < 5)
    P.flat(g, beads, "wood", 2)
    P.flat(g, beads & ((np.floor(X).astype(int) % 2) == 0), "bone", 6)
    fang = box(g, int(CX), 28, int(CZ - 4), int(CX + 1), 30, int(CZ - 3), "bone", 7)
    P.flat(g, fang & (Y < 29), "bone", 5)
    return g


# ------------------------------------------------------------------ head
def head() -> Grid:
    """A big human head: a pale face with fierce cyan eyes, angry brows,
    violet war paint, a sharp nose and a snarl with two fangs, under a wild
    mane of dark violet hair with a fringe and three spikes."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    start = len(g.solids)
    plan(g, chamfer_rect(CX - 3.6, FACE_Z + 0.4, CX + 3.6, CZ + 2.5, 1.5), 31.0, 33.5, SKIN, SKIN_B,
         top=chamfer_rect(CX - 5.0, FACE_Z, CX + 5.0, CZ + 4.0, 1.8))
    plan(g, chamfer_rect(CX - 5.0, FACE_Z, CX + 5.0, CZ + 4.0, 1.8), 33.5, 40.0, SKIN, SKIN_B)
    plan(g, chamfer_rect(CX - 5.0, FACE_Z, CX + 5.0, CZ + 4.0, 1.8), 40.0, 41.5, SKIN, SKIN_B,
         top=chamfer_rect(CX - 3.6, FACE_Z + 1.2, CX + 3.6, CZ + 3.0, 1.2))
    skin(g, start, seed=7)
    skull = g.a > 0
    seam_frame(g, start, SKIN, SKIN_B - 2)
    P.flat(g, skull & (Y < 31.8), SKIN, SKIN_B - 2)  # the shadow under the jaw
    # a sharp nose (a true-slope wedge)
    nstart = len(g.solids)
    nose = side(g, [(34.0, FACE_Z + 0.5), (36.5, FACE_Z + 0.5), (34.2, FACE_Z - 1.6)], CX - 0.9, CX + 0.9, SKIN, SKIN_B)
    on_facets(g, nstart, lambda gg, mm, fr: P.flat(gg, mm, SKIN, SKIN_B))
    P.flat(g, nose & (Y < 34.6), SKIN, SKIN_B - 2)
    # the painted face (rows read left to right as seen from the front)
    ink = {"b": C(HAIR, 1), "w": C("bone", 7), "c": C("cyan", 5), "k": C("navy", 1), "v": C(TIP, 4), "V": C(TIP, 3),
           "m": C("magenta", 2), "l": C("magenta", 4), "t": C("bone", 7), "s": C(SKIN, SKIN_B - 1)}
    face = ["bb......bb",
            ".bbb..bbb.",
            "wcck..kccw",
            "swws..swws",
            "v.v....v.v",
            "V.V....V.V",
            "..........",
            "..lmmmml..",
            "...t..t..."]
    pnglyph.stamp(g, "-z", FACE_Z, int(CX - 5), 31, face, ink)
    # the hair: a cap over the crown and the back, a jagged fringe, long
    # locks down the back of the neck, and three spikes that sweep back
    hstart = len(g.solids)
    plan(g, chamfer_rect(CX - 5.8, FACE_Z + 2.0, CX + 5.8, CZ + 5.0, 2.0), 35.0, 41.0, HAIR, 3,
         top=chamfer_rect(CX - 5.2, FACE_Z + 1.0, CX + 5.2, CZ + 4.6, 1.8))
    plan(g, chamfer_rect(CX - 5.2, FACE_Z + 1.0, CX + 5.2, CZ + 4.6, 1.8), 41.0, 42.5, HAIR, 3,
         top=chamfer_rect(CX - 3.6, FACE_Z + 2.4, CX + 3.6, CZ + 3.4, 1.2))
    front(g, [(CX - 5.6, 42.0), (CX + 5.6, 42.0), (CX + 5.6, 39.0), (CX + 3.5, 38.0), (CX + 2.0, 39.5), (CX, 37.8), (CX - 2.0, 39.4), (CX - 3.8, 38.0), (CX - 5.6, 39.2)],
          FACE_Z - 0.6, FACE_Z + 2.5, HAIR, 3)
    side(g, [(27.0, CZ + 2.0), (37.0, CZ + 2.0), (37.0, CZ + 6.5), (30.0, CZ + 7.5), (26.0, CZ + 5.0)], CX - 5.4, CX + 5.4, HAIR, 3)
    for sx, sy in ((-3.0, 41.0), (0.0, 42.0), (3.0, 41.0)):
        side(g, S.quad((sy, CZ + 2.0), (sy + 2.5, CZ + 10.5), 1.8, 0.4, cap=0.8), CX + sx - 1.2, CX + sx + 1.2, HAIR, 3)
    hair = np.zeros(g.shape, dtype=bool)
    for sd in g.solids[hstart:]:
        hair |= sd.mask(g.shape)
    U = np.floor(X + Z).astype(int)
    P.flat(g, hair, HAIR, 3)
    P.flat(g, hair & ((U % 3) == 0), HAIR, 2)  # dark strands
    P.flat(g, hair & ((U % 5) == 1) & (Y > 36.0), HAIR, 5)  # lit strands
    P.flat(g, hair & (Y > 42.0), HAIR, 4)
    seam_frame(g, hstart, HAIR, 1)
    # a bone ring in each side lock
    for s in (-1, 1):
        ring = box(g, int(CX + s * 6.0) - (1 if s < 0 else 0), 33, int(CZ), int(CX + s * 6.0) + (0 if s < 0 else 1), 35, int(CZ + 2), "bone", 6)
        P.flat(g, ring & (Y < 34), "bone", 4)
    return g


# ------------------------------------------------------------------ wings
def wing(s: int) -> Grid:
    """An arm that is a wing: a thick leading edge from the shoulder to a
    clawed wrist, pale coverts along it, and long primaries that fan down
    to a serrated trailing edge with violet tips."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    sx, sy, sz = SHOULDER[s]
    wr = (CX + s * 16.0, 35.0)
    tip = (CX + s * 23.5, 32.0)
    trail = [(CX + s * 22.0, 25.5), (CX + s * 19.5, 20.5), (CX + s * 16.0, 17.0), (CX + s * 12.5, 18.0), (CX + s * 9.5, 21.0)]
    root = (CX + s * 6.8, 24.5)
    poly = [(sx, sy + 1.5), wr, tip]
    prev = tip
    for p in trail + [root]:
        mid = ((prev[0] + p[0]) / 2, (prev[1] + p[1]) / 2)
        poly.append((mid[0] + (wr[0] - mid[0]) * 0.12, mid[1] + (wr[1] - mid[1]) * 0.12))  # a notch between two feathers
        poly.append(p)
        prev = p
    if s < 0:
        poly = poly[::-1]
    flight = front(g, poly, sz - 0.8, sz + 0.8, FEATHER, 3)
    # the primaries: strips that fan out from the wrist, a dark shaft
    # between them, a pale bar across, and violet tips at the trailing edge
    ang = np.arctan2(Y - wr[1], (X - wr[0]) * s)
    dist = np.hypot(X - wr[0], Y - wr[1])
    strip = np.floor(ang / 0.22).astype(np.int64)
    shade = 3 + (strip % 2)
    P._paint(g, flight, FEATHER, shade)
    P.flat(g, flight & (np.abs(ang / 0.22 - np.round(ang / 0.22)) < 0.10), FEATHER, 2)
    P.flat(g, flight & (np.abs(dist - 9.0) < 0.6), FEATHER, 5)
    P.flat(g, flight & (dist > 13.0), TIP, 3)
    P.flat(g, flight & (dist > 15.5), TIP, 5)
    # the coverts: a thicker panel of pale feather rows along the arm
    cstart = len(g.solids)
    cov = [(sx, sy + 1.5), wr, (CX + s * 20.0, 31.5), (CX + s * 15.5, 28.0), (CX + s * 10.5, 25.5), (sx, 25.5)]
    if s < 0:
        cov = cov[::-1]
    front(g, cov, sz - 1.4, sz + 1.4, FEATHER, 5)
    on_facets(g, cstart, lambda gg, mm, fr: feathers(gg, mm, FEATHER, 5, frame=fr, seed=8 + s, width=4, row=3))
    seam_frame(g, cstart, FEATHER, 3)
    # the leading edge (the arm bone) and the hooked claw at the wrist
    astart = len(g.solids)
    front(g, S.quad((sx, sy + 0.5), wr, 2.2, 1.6), sz - 1.8, sz + 1.8, FEATHER, 2)
    front(g, S.quad(wr, tip, 1.5, 0.6, cap=0.8), sz - 1.2, sz + 1.2, FEATHER, 2)
    arm = np.zeros(g.shape, dtype=bool)
    for sd in g.solids[astart:]:
        arm |= sd.mask(g.shape)
    on_facets(g, astart, lambda gg, mm, fr: feathers(gg, mm, FEATHER, 2, frame=fr, seed=10 + s, width=3, row=2))
    edge_y = sy + 0.5 + (X - sx) / (wr[0] - sx) * (wr[1] - sy - 0.5)
    P.flat(g, arm & (Y > edge_y + 0.8) & ((X - sx) * s < (wr[0] - sx) * s), FEATHER, 4)  # the lit top of the arm
    # the bare human shoulder where the wing grows from the body
    P.flat(g, arm & (np.abs(X - sx) < 2.6), SKIN, SKIN_B)
    P.flat(g, arm & (np.abs(np.abs(X - sx) - 2.6) < 0.6), TIP, 3)  # a violet band where the feathers start
    kstart = len(g.solids)
    front(g, [(wr[0] - s * 0.8, wr[1] + 0.5), (wr[0] + s * 1.2, wr[1] + 0.5), (wr[0] + s * 1.6, wr[1] + 3.2), (wr[0] - s * 0.6, wr[1] + 4.2)],
          sz - 3.0, sz - 1.0, CLAW, 3)
    on_facets(g, kstart, lambda gg, mm, fr: P.flat(gg, mm, CLAW, 3))
    P.flat(g, g.solids[kstart].mask(g.shape) & (Y > wr[1] + 3.4), "bone", 5)
    return g


# ------------------------------------------------------------------ build
def build():
    grids = {"harpy": pelvis(), "body": body(), "head": head(), "wing-l": wing(-1), "wing-r": wing(1),
             "leg-l": leg(-1), "leg-r": leg(1)}
    waist = (CX, WAIST_Y, CZ)
    hips = {s: (CX + s * 4.0, HIP_Y, CZ + 0.5) for s in (-1, 1)}
    root, to_root = rig([
        ("harpy", grids["harpy"], None, None),
        ("leg-l", grids["leg-l"], hips[-1], None),
        ("leg-r", grids["leg-r"], hips[1], None),
        ("body", grids["body"], waist, None),
        ("head", grids["head"], NECK, "body"),
        ("wing-l", grids["wing-l"], SHOULDER[-1], "body"),
        ("wing-r", grids["wing-r"], SHOULDER[1], "body"),
    ])
    idle = {"body": {"rot": keys((0, 0, 0, 0), (0.8, 3, 0, 0), (1.6, 0, 0, 0))},
            "head": {"rot": keys((0, 0, 0, 0), (0.4, 0, 18, 4), (0.8, -4, 0, 0), (1.2, 0, -18, -4), (1.6, 0, 0, 0))},
            "wing-l": {"rot": keys((0, 0, 0, 0), (0.8, 0, 8, -10), (1.6, 0, 0, 0))},
            "wing-r": {"rot": keys((0, 0, 0, 0), (0.8, 0, -8, 10), (1.6, 0, 0, 0))}}
    # the talon dive: crouch (0.18), spring up with the wings raised
    # (0.36), beat the wings down and throw both feet forward (0.52), rake
    # (0.60), land (0.80) and settle.
    attack = {"harpy": {"loc": keys((0, 0, 0, 0), (0.18, 0, 0, 1.0), (0.36, 0, 12, 2.0), (0.52, 0, 10, -8.0), (0.60, 0, 7, -12.0), (0.80, 0, 0, -6.0), (1.10, 0, 0, 0)),
                        "rot": keys((0, 0, 0, 0), (0.18, 0, 0, 0), (0.36, 10, 0, 0), (0.52, 24, 0, 0), (0.60, 20, 0, 0), (0.80, 0, 0, 0))},
              "body": {"rot": keys((0, 0, 0, 0), (0.18, -16, 0, 0), (0.36, -6, 0, 0), (0.52, -30, 0, 0), (0.60, -30, 0, 0), (0.80, -8, 0, 0), (1.10, 0, 0, 0))},
              "head": {"rot": keys((0, 0, 0, 0), (0.18, 12, 0, 0), (0.52, 20, 0, 0), (0.80, 4, 0, 0), (1.10, 0, 0, 0))},
              "leg-l": {"rot": keys((0, 0, 0, 0), (0.18, -10, 0, 0), (0.36, 30, 0, 0), (0.52, 60, 0, -6), (0.60, 70, 0, -6), (0.80, 10, 0, 0), (1.10, 0, 0, 0))},
              "leg-r": {"rot": keys((0, 0, 0, 0), (0.18, -10, 0, 0), (0.36, 30, 0, 0), (0.52, 64, 0, 6), (0.60, 74, 0, 6), (0.80, 10, 0, 0), (1.10, 0, 0, 0))},
              "wing-l": {"rot": keys((0, 0, 0, 0), (0.18, 0, 10, 10), (0.36, 0, 20, -40), (0.52, 0, -10, 30), (0.60, 0, -6, 20), (0.80, 0, 0, -10), (1.10, 0, 0, 0))},
              "wing-r": {"rot": keys((0, 0, 0, 0), (0.18, 0, -10, -10), (0.36, 0, -20, 40), (0.52, 0, 10, -30), (0.60, 0, 6, -20), (0.80, 0, 0, 10), (1.10, 0, 0, 0))}}
    hit = {"body": {"rot": keys((0, 0, 0, 0), (0.10, 16, 0, 8), (0.45, 0, 0, 0))},
           "head": {"rot": keys((0, 0, 0, 0), (0.10, 18, -12, 6), (0.45, 0, 0, 0))},
           "wing-l": {"rot": keys((0, 0, 0, 0), (0.10, 0, 0, -24), (0.45, 0, 0, 0))},
           "wing-r": {"rot": keys((0, 0, 0, 0), (0.10, 0, 0, 24), (0.45, 0, 0, 0))},
           "harpy": {"loc": keys((0, 0, 0, 0), (0.10, 0, 0, 2.5), (0.45, 0, 0, 0))}}
    death = {"harpy": {"rot": keys((0, 0, 0, 0), (0.25, -8, 0, 0), (0.80, 82, 0, 6), (0.95, 76, 0, 6), (1.15, 80, 0, 6)),
                       "loc": keys((0, 0, 0, 0), (0.80, 0, 6, 6), (1.15, 0, 6, 6))},
             "head": {"rot": keys((0, 0, 0, 0), (0.80, -16, 0, 0), (1.15, -8, 24, 0))},
             "wing-l": {"rot": keys((0, 0, 0, 0), (0.80, 30, 0, 24))},
             "wing-r": {"rot": keys((0, 0, 0, 0), (0.80, 30, 0, -30))},
             "leg-l": {"rot": keys((0, 0, 0, 0), (0.80, 20, 0, -8))},
             "leg-r": {"rot": keys((0, 0, 0, 0), (0.80, 36, 0, 8))}}
    talons = (CX + 4.0, 1.0, CZ - 6.5)
    return asset("creatures", "harpy", "Harpy", root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 sockets=[Socket("socket-function", at=to_root(talons), parent="leg-r")],
                 fx=[pfx("rvx-fantasy-slash-arc", "socket-function", "clip:attack", size=18, at=0.46)])
