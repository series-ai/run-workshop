"""Goblin raider in the Pirate Nation creature style.

It echoes the PN goblin totem: a huge boxy green head (almost half the
height) with a jutting underbite, two tusks, huge cream eyes under an
angry V brow, a big hooked orange nose and long pointed ears. A red pirate
bandana with a knot and tails, a gold earring. A small pot-bellied body in
a stitched leather vest with a bandolier, a rope belt and a flap kilt;
short thick legs in bandages on big wedge feet; big hands. The right hand
holds a notched scimitar pointing up and forward, the left arm a round
wooden buckler with a gold boss. Limbs, nose, ears, brow, feet and blade
are true-slope prisms; the face, cloth and leather are painted.
Clips: idle (breathe, look around), attack (a slash), hit, death (falls
back). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _life import asset, chamfer_rect, coords, facet_paint, front, keys, ngon, pfx, plan, rig, side
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket

SH = (48, 42, 40)
CX, CZ = 23.0, 20.0
SKIN, SKIN_B = "leaf", 5
LEATHER = "wood"
HIP_Y = 11.5
HEAD_Y0, HEAD_Y1 = 21.0, 35.0
FACE_Z = CZ - 8  # the front face of the head
HW = 10.0  # head half width
SHOULDER_Y = 21.5
HEAD_TILT = 13.0  # rest tilt of the head, degrees back (clip keys compose on it)


def skin(g: Grid, m: np.ndarray, base: int = SKIN_B, frame=None, seed: int = 0, ramp: str = SKIN) -> None:
    """Painted goblin hide: flat base with soft 3×3 patches of ±1 shade."""
    U, V = P.uv(g, frame)
    h = P._hash(U // 3, V // 3, seed=seed) % np.uint64(9)
    shade = base + np.where(h == 0, -1, np.where(h == 1, 1, 0))
    P._paint(g, m, ramp, shade)


def skin_facets(g: Grid, start: int, base: int = SKIN_B, seed: int = 0) -> None:
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: skin(gg, mm, base, frame=fr, seed=seed))


def leg(s: int) -> Grid:
    g = Grid(*SH)
    X, Y, Z = coords(g)
    lx = CX + s * 4.5
    start = len(g.solids)
    # a big wedge foot: flat sole, sloped instep down to the toes
    foot = side(g, [(0, CZ - 8), (0, CZ + 5), (4.5, CZ + 5), (5, CZ + 1), (3, CZ - 8)], lx - 4, lx + 4, SKIN, SKIN_B)
    shin = side(g, S.quad((HIP_Y + 0.5, CZ + 1), (3.5, CZ), 3.3, 2.9), lx - 3, lx + 3, SKIN, SKIN_B)
    skin_facets(g, start, SKIN_B - 1, seed=1 + s)
    # three toes: dark splits and bone nails on the toe tips
    toes = foot & (Z < CZ - 4)
    P.flat(g, toes & (np.abs(np.abs(X - lx) - 1.35) < 0.5), SKIN, SKIN_B - 2)
    P.flat(g, toes & (Z < CZ - 7) & (Y > 1) & (np.abs(np.abs(X - lx) - 1.35) > 0.5), "bone", 6)
    P.flat(g, foot & (Y < 1), SKIN, SKIN_B - 2)  # sole shadow
    # dirty bandage wraps on the shin (bands follow y, so no stairs)
    wrap = shin & (Y > 4) & (Y < 9.5)
    P.flat(g, wrap, "sand", 5)
    P.flat(g, wrap & (np.floor(Y) % 2 == 0), "sand", 4)
    P.flat(g, wrap & (np.abs(Y - 7.5) < 0.5) & (X - lx < -1.5 * s), "sand", 3)
    return g


def pelvis() -> Grid:
    """The root: a flap kilt (a frustum) under a rope belt."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    kilt = plan(g, chamfer_rect(CX - 9, CZ - 6, CX + 9, CZ + 6.5, 2), 8, 13.5, LEATHER, 4, top=chamfer_rect(CX - 7.5, CZ - 5, CX + 7.5, CZ + 5.5, 2))
    ang = np.floor((np.arctan2(Z - CZ, X - CX) + np.pi) / (2 * np.pi) * 14).astype(int)
    P.flat(g, kilt, LEATHER, 4)
    P.flat(g, kilt & (ang % 2 == 0), LEATHER, 3)  # alternating leather flaps
    P.flat(g, kilt & (ang % 2 == 1) & (Y < 9.2), "red", 3)  # a red rag under every other flap
    P.flat(g, kilt & (ang % 3 == 0) & (Y < 9.2), LEATHER, 2)
    belt = plan(g, chamfer_rect(CX - 8, CZ - 5.5, CX + 8, CZ + 6, 2), 12.5, 14.5, "sand", 4)
    P.flat(g, belt & ((np.floor(X + Y) % 3) == 0), "sand", 3)  # twisted rope
    buckle = box(g, int(CX) - 2, 12, int(CZ - 7), int(CX) + 2, 15, int(CZ - 5), "gold", 5)
    P.flat(g, edges(buckle), "gold", 3)
    P.flat(g, buckle & (Y > 14), "gold", 7)
    return g


def body() -> Grid:
    g = Grid(*SH)
    X, Y, Z = coords(g)
    start = len(g.solids)
    torso = side(g, [(12.5, CZ - 5.5), (12.5, CZ + 5), (21, CZ + 6), (24, CZ + 3.5), (24, CZ - 3.5), (20.5, CZ - 6.5), (16, CZ - 7.5)], CX - 7, CX + 7, LEATHER, 4)
    torso |= front(g, [(CX - 10, 19.5), (CX + 10, 19.5), (CX + 8, 24.5), (CX - 8, 24.5)], CZ - 4, CZ + 4.5, LEATHER, 4)
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.mottle(gg, mm, LEATHER, 4, cell=3, seed=3))
    # the open vest shows a green pot belly
    belly = torso & (np.abs(X - CX) < 3.6 + (22 - Y) * 0.12) & (Z < CZ - 2) & (Y < 22.5)
    skin(g, belly, SKIN_B + 1, seed=4)
    P.flat(g, belly & (np.abs(X - CX) < 0.6) & (np.abs(Y - 16) < 0.6), SKIN, SKIN_B - 1)  # navel
    # stitched vest edges (bone dashes) and a darker hem
    edge = torso & ~belly & (Z < CZ - 2) & (np.abs(np.abs(X - CX) - (4.1 + (22 - Y) * 0.12)) < 0.6)
    P.flat(g, edge, LEATHER, 2)
    P.flat(g, edge & (np.floor(Y) % 2 == 0), "bone", 6)
    P.flat(g, torso & ~belly & (Y < 13.5), LEATHER, 2)
    # a bandolier from the left shoulder to the right hip, with a gold buckle
    band = torso & ~belly & (np.abs((X - CX) + (Y - 18.5) * 0.9) < 1.3)
    band |= torso & belly & (np.abs((X - CX) + (Y - 18.5) * 0.9) < 1.3)
    P.flat(g, band, "darkwood", 3)
    P.flat(g, band & (np.abs(Y - 18.5) < 1) & (Z < CZ - 4), "gold", 6)
    P.flat(g, band & (Z > CZ + 3) & (np.floor(Y) % 3 == 0), "darkwood", 5)
    # a patch on the back
    P.flat(g, torso & (Z > CZ + 4.5) & (np.abs(X - CX - 2) < 2.5) & (np.abs(Y - 17) < 2), "blue", 4)
    P.outline(g, torso & (Z > CZ + 4.5) & (np.abs(X - CX - 2) < 2.5) & (np.abs(Y - 17) < 2), "blue", 2)
    return g


def head() -> Grid:
    g = Grid(*SH)
    X, Y, Z = coords(g)
    start = len(g.solids)
    # a huge chamfered box head with a bevelled top and a jutting underbite
    skull = plan(g, chamfer_rect(CX - HW, FACE_Z, CX + HW, CZ + 6, 2), HEAD_Y0 + 2, HEAD_Y1, SKIN, SKIN_B)
    skull |= plan(g, chamfer_rect(CX - HW, FACE_Z, CX + HW, CZ + 6, 2), HEAD_Y1, HEAD_Y1 + 2, SKIN, SKIN_B, top=chamfer_rect(CX - HW + 2, FACE_Z + 2, CX + HW - 2, CZ + 4, 1.5))
    jaw = side(g, [(HEAD_Y0, FACE_Z - 1.5), (HEAD_Y0, CZ + 3), (HEAD_Y0 + 5, CZ + 4), (HEAD_Y0 + 5.5, FACE_Z - 1.5)], CX - 8.5, CX + 8.5, SKIN, SKIN_B)
    skin_facets(g, start, seed=5)
    P.flat(g, jaw & (Y < HEAD_Y0 + 1), SKIN, SKIN_B - 2)  # chin shadow
    # the angry V brow (a true-slope prism, one voxel proud)
    bstart = len(g.solids)
    brow = front(g, [(CX - HW - 0.2, 32.6), (CX - 1, 30.4), (CX, 29.8), (CX + 1, 30.4), (CX + HW + 0.2, 33.0), (CX + HW + 0.2, 34.8), (CX, 32), (CX - HW - 0.2, 34.4)], FACE_Z - 1.2, FACE_Z + 3, SKIN, SKIN_B - 1)
    skin_facets(g, bstart, SKIN_B - 1, seed=6)
    # the big hooked nose (echo of the PN goblin totem)
    nstart = len(g.solids)
    nose = side(g, [(30.2, FACE_Z + 1), (30.4, FACE_Z - 2.5), (27.8, FACE_Z - 7), (25, FACE_Z - 6.5), (24.2, FACE_Z - 3.5), (25, FACE_Z + 1)], CX - 3, CX + 3, "orange", 4)
    facet_paint(g, g.solids[nstart:], lambda gg, mm, fr: P.flat(gg, mm, "orange", 5 if fr != "top" and fr[1][1] > -0.75 else 4))
    P.flat(g, nose & (Y < 25.4), "orange", 3)
    P.flat(g, nose & (Z < FACE_Z - 5.2) & (Y > 26), "orange", 6)  # a lit tip
    P.flat(g, nose & (np.abs(np.abs(X - CX) - 1.5) < 0.6) & (Y < 25.6) & (Z < FACE_Z - 3), "red", 2)  # nostrils
    # long pointed ears with orange insides and a gold earring
    for s in (-1, 1):
        estart = len(g.solids)
        ear = front(g, [(CX + s * (HW - 0.5), 27), (CX + s * (HW - 0.5), 33), (CX + s * (HW + 11), 36), (CX + s * (HW + 7), 31.5)], CZ - 3, CZ + 1, SKIN, SKIN_B)
        skin_facets(g, estart, seed=7 + s)
        inner = ear & (Z < CZ - 2) & (np.abs(X - CX) > HW + 1) & (np.abs(X - CX) < HW + 7.5) & (Y > 29.5 + (np.abs(X - CX) - HW - 1) * 0.2) & (Y < 32.5 + (np.abs(X - CX) - HW - 1) * 0.3)
        P.flat(g, inner, "orange", 4)
        P.flat(g, ear & (np.abs(X - CX) > HW + 4) & (np.abs(X - CX) < HW + 5) & (Y > 33.8), SKIN, SKIN_B - 2)  # a notch
    ring = box(g, int(CX + HW + 1), 25, int(CZ - 2), int(CX + HW + 3), 28, int(CZ), "gold", 6)
    P.flat(g, ring & (Y < 26), "gold", 4)
    # the red pirate bandana with white dots, a knot and two tails at the back
    # a thin band high on the head, above the brow, so the face stays clear
    band = plan(g, chamfer_rect(CX - HW - 0.6, FACE_Z - 0.6, CX + HW + 0.6, CZ + 6.6, 2.2), 34.2, 35.9, "red", 5)
    P.flat(g, band & (Y < 34.9), "red", 4)
    P.flat(g, band & (Y > 35.2), "red", 6)
    P.flat(g, band & (np.abs(Y - 35.1) < 0.6) & (((np.floor(X) + np.floor(Z)) % 6) == 0), "bone", 7)
    # a bald green crown with a few painted dark bristles
    top = skull & (Y > HEAD_Y1 + 1.2)
    P.flat(g, top & (np.abs(X - CX + 3 - (Z - CZ) * 0.2) < 0.6) & (Z < CZ + 2), SKIN, SKIN_B - 2)
    P.flat(g, top & (np.abs(X - CX - 3 - (Z - CZ) * 0.1) < 0.6) & (Z > CZ - 3), SKIN, SKIN_B - 2)
    knot = box(g, int(CX) - 2, 33, int(CZ + 6), int(CX) + 2, 38, int(CZ + 9), "red", 5)
    tails = side(g, S.quad((35.5, CZ + 8), (28.5, CZ + 12.5), 1.4, 1.2), CX - 2.5, CX - 0.5, "red", 4)
    tails |= side(g, S.quad((35, CZ + 8), (30, CZ + 13), 1.3, 1.1), CX + 0.5, CX + 2.5, "red", 5)
    P.flat(g, (knot | tails) & (Y < 31), "red", 3)
    # the painted face (rows read left to right as seen from the front)
    face = {"w": C("bone", 6), "c": C("bone", 4), "p": C("darkwood", 1), "h": C("bone", 7), "m": C("red", 2), "t": C("bone", 6), "g": C(SKIN, SKIN_B - 2)}
    eyes = [
        "cwwwwwwc....gggggggg",
        "wwwwwwww....cwwwwwwc",
        "wwwhppww....wwhppwww",
        "wwwpppww....wwpppwww",
        "wwwpppww....cwpppwwc",
        "cwwwwwwc....ccwwwwcc",
    ]
    pnglyph.stamp(g, "-z", FACE_Z, int(CX - HW), 25, eyes, face)
    mouth = [
        "gmmmmmmmmmmmmmmg",
        "mttmmmmmmmmmmttm",
        ".gmmmmmmmmmmmmg.",
    ]
    pnglyph.stamp(g, "-z", FACE_Z - 1.5, int(CX - 8), 21, mouth, face)
    # two tusks from the underbite (proud, bone)
    for tx in (CX - 6, CX + 4.4):
        t = side(g, [(HEAD_Y0 + 4.5, FACE_Z - 2.6), (HEAD_Y0 + 4.5, FACE_Z - 0.8), (HEAD_Y0 + 8.2, FACE_Z - 1.2)], tx, tx + 1.6, "bone", 6)
        P.flat(g, t & (Y > HEAD_Y0 + 6.5), "bone", 7)
    return g


def arm(s: int) -> Grid:
    g = Grid(*SH)
    X, Y, Z = coords(g)
    sx = CX + s * 9.5
    start = len(g.solids)
    upper = front(g, S.quad((sx, SHOULDER_Y + 1), (sx + s * 2.5, 13.5), 3.0, 2.6, cap=0.4), CZ - 2.5, CZ + 2.5, SKIN, SKIN_B)
    skin_facets(g, start, seed=9 + s)
    hx = sx + s * 3
    hand = box(g, int(hx) - 3, 8, int(CZ) - 4, int(hx) + 3, 14, int(CZ) + 2, SKIN, SKIN_B)
    skin(g, hand, SKIN_B, seed=11 + s)
    P.flat(g, hand & (Z < CZ - 3) & ((np.floor(X) % 2) == 0) & (Y < 12), SKIN, SKIN_B - 2)  # finger splits
    P.flat(g, hand & (Y < 9), SKIN, SKIN_B - 1)
    # a leather bracer with gold studs
    brace = box(g, int(hx) - 3, 14, int(CZ) - 3, int(hx) + 3, 17, int(CZ) + 2, LEATHER, 3)
    P.flat(g, edges(brace), LEATHER, 2)
    P.flat(g, brace & (np.abs(Y - 15.5) < 0.6) & ((np.floor(X + Z) % 3) == 0), "gold", 6)
    if s < 0:
        # a round wooden buckler with a red rim and a gold boss, facing -z
        bstart = len(g.solids)
        disc = front(g, ngon(hx - 1, 12, 7.2, 8, 0.39), CZ - 7, CZ - 4.5, "wood", 4)
        facet_paint(g, g.solids[bstart:], lambda gg, mm, fr: P.planks(gg, mm, "wood", 4, width=3, across="x", length=(20, 24), nails=False, frame=fr, seed=13))
        r = S.ngon_radius(g, "z", hx - 1, 12, 8, facing=0.39)
        P.flat(g, disc & (r > 5.6), "red", 4)
        P.flat(g, disc & (r > 5.6) & (Z > CZ - 5.5), "red", 3)
        P.flat(g, disc & (r > 5.0) & (r <= 5.6), "darkwood", 3)
        boss = box(g, int(hx) - 3, 10, int(CZ) - 9, int(hx) + 1, 14, int(CZ) - 7, "gold", 5)
        P.flat(g, edges(boss), "gold", 4)
        P.flat(g, boss & (Y > 13), "gold", 7)
    return g


# the right hand (arm(1)): the scimitar's wrist hinge sits in the middle of the fist
HAND_R = CX + 9.5 + 3
WRIST_R = (int(HAND_R) + 0.5, 11.0, CZ - 2.0)


def scimitar() -> Grid:
    """A notched scimitar pointing up and forward, a separate part on a wrist
    hinge so the attack can turn the blade forward through the cut."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    hx = HAND_R
    box(g, int(hx) - 1, 10, int(CZ) - 7, int(hx) + 1, 12, int(CZ) + 3, "darkwood", 3)  # grip
    guard = box(g, int(hx) - 2, 9, int(CZ) - 8, int(hx) + 2, 13, int(CZ) - 6, "gold", 5)
    P.flat(g, guard & (Y > 12), "gold", 7)
    bstart = len(g.solids)
    blade = side(g, [(11, CZ - 8), (13, CZ - 7.5), (26, CZ - 9.5), (30.5, CZ - 13), (26, CZ - 13.5), (16, CZ - 11.5)], hx - 0.9, hx + 0.9, "steel", 6)
    facet_paint(g, g.solids[bstart:], lambda gg, mm, fr: P.flat(gg, mm, "steel", 6))
    # a bright cutting edge on the front curve, a darker spine at the back and two notches
    P.flat(g, blade & (Z < CZ - 8.3 - (Y - 11) * 0.2), "steel", 7)
    P.flat(g, blade & (Z > CZ - 8.6 - (Y - 13) * 0.16), "steel", 4)
    for ny in (17.5, 22.5):
        P.flat(g, blade & (np.abs(Y - ny) < 0.7) & (Z < CZ - 9.6 - (ny - 11) * 0.1), "steel", 3)
    return g


def build():
    grids = {"goblin": pelvis(), "body": body(), "head": head(), "arm-l": arm(-1), "arm-r": arm(1), "scimitar": scimitar(), "leg-l": leg(-1), "leg-r": leg(1)}
    waist = (CX, 13.0, CZ)
    neck = (CX, HEAD_Y0 + 1, CZ - 1)
    sh = {s: (CX + s * 9.5, SHOULDER_Y + 1, CZ) for s in (-1, 1)}
    hips = {s: (CX + s * 4.5, HIP_Y, CZ + 1) for s in (-1, 1)}
    root, to_root = rig([
        ("goblin", grids["goblin"], None, None),
        ("leg-l", grids["leg-l"], hips[-1], None),
        ("leg-r", grids["leg-r"], hips[1], None),
        ("body", grids["body"], waist, None),
        ("head", grids["head"], neck, "body"),
        ("arm-l", grids["arm-l"], sh[-1], "body"),
        ("arm-r", grids["arm-r"], sh[1], "body"),
        ("scimitar", grids["scimitar"], WRIST_R, "arm-r"),
    ])
    # the head rests tilted back so the big face reads from above (rule F4)
    next(p for p in root.walk() if p.name == "head").rot = (HEAD_TILT, 0.0, 0.0)
    idle = {"body": {"rot": keys((0, 0, 0, 0), (0.8, 4, 0, 0), (1.6, 0, 0, 0))},
            "head": {"rot": keys((0, 0, 0, 0), (0.4, 0, 14, 3), (0.8, -3, 0, 0), (1.2, 0, -14, -3), (1.6, 0, 0, 0))},
            "arm-l": {"rot": keys((0, 0, 0, 0), (0.8, 6, 0, -4), (1.6, 0, 0, 0))},
            "arm-r": {"rot": keys((0, 0, 0, 0), (0.8, -6, 0, 5), (1.6, 0, 0, 0))}}
    # a diagonal slash. The wind-up lifts the hand above the shoulder with the blade up and back;
    # the cut drives the hand across the belly while the wrist sweeps the blade from over the head,
    # across the front, to the left hip. The keys were solved for tip and hand targets (the cut
    # crosses the front, so it reads from the preview camera on the shield side); each key step
    # stays under 150 degrees, as the export takes the shortest way between keys.
    attack = {"arm-r": {"rot": keys((0, 0, 0, 0), (0.2, 25, -42, 35), (0.42, 78, -37, 43), (0.49, 64, 13, 35), (0.55, 3, 33, -14), (0.65, 3, 33, -14), (1.05, 0, 0, 0))},
              "scimitar": {"rot": keys((0, 0, 0, 0), (0.2, 11, -14, -32), (0.42, -10, -30, -44), (0.49, -59, -14, -21), (0.55, -64, -2, -8), (0.65, -64, -2, -8), (1.05, 0, 0, 0))},
              "body": {"rot": keys((0, 0, 0, 0), (0.2, 3, -10, 0), (0.42, 6, -20, 0), (0.49, -4, 0, 0), (0.55, -14, 22, 0), (1.05, 0, 0, 0))},
              "head": {"rot": keys((0, 0, 0, 0), (0.42, 8, 10, 0), (0.55, -8, -8, 0), (1.05, 0, 0, 0))},
              "arm-l": {"rot": keys((0, 0, 0, 0), (0.42, 20, 0, -10), (0.55, -10, 0, 0), (1.05, 0, 0, 0))},
              "goblin": {"loc": keys((0, 0, 0, 0), (0.2, 0, 0, 0.7), (0.42, 0, 0, 1.5), (0.49, 0, 0, -0.7), (0.55, 0, 0, -3), (1.05, 0, 0, 0))}}
    hit = {"body": {"rot": keys((0, 0, 0, 0), (0.1, 18, 0, 8), (0.45, 0, 0, 0))},
           "head": {"rot": keys((0, 0, 0, 0), (0.1, 16, -12, 6), (0.45, 0, 0, 0))},
           "arm-l": {"rot": keys((0, 0, 0, 0), (0.1, -20, 0, -25), (0.45, 0, 0, 0))},
           "arm-r": {"rot": keys((0, 0, 0, 0), (0.1, -20, 0, 25), (0.45, 0, 0, 0))},
           "goblin": {"loc": keys((0, 0, 0, 0), (0.1, 0, 0, 2.5), (0.45, 0, 0, 0))}}
    death = {"goblin": {"rot": keys((0, 0, 0, 0), (0.25, -8, 0, 0), (0.75, 84, 0, 6), (0.9, 78, 0, 6), (1.1, 82, 0, 6)),
                        "loc": keys((0, 0, 0, 0), (0.75, 0, 7, 6), (1.1, 0, 7, 6))},
             "head": {"rot": keys((0, 0, 0, 0), (0.75, -20, 0, 0), (1.1, -10, 25, 0))},
             "arm-l": {"rot": keys((0, 0, 0, 0), (0.75, -30, 0, -70))},
             "arm-r": {"rot": keys((0, 0, 0, 0), (0.75, -40, 0, 80))},
             "leg-l": {"rot": keys((0, 0, 0, 0), (0.75, -25, 0, -10))},
             "leg-r": {"rot": keys((0, 0, 0, 0), (0.75, -45, 0, 10))}}
    tip = (CX + 12.5, 30.0, CZ - 13.0)
    return asset("creatures", "goblin", "Goblin Raider", root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 sockets=[Socket("socket-blade", at=to_root(tip), parent="scimitar")],
                 # The trail spans the blade: from the hilt (offset back from the tip socket) along the blade to the tip.
                 # It starts with the cut (0.42 s), so the wind-up leaves no trail.
                 fx=[pfx("rvx-fantasy-slash-arc", "socket-blade", "clip:attack", size=19.6, aim=(0.0, 0.967, -0.254), offset=(0.0, -19.0, 5.0), at=0.42)])
