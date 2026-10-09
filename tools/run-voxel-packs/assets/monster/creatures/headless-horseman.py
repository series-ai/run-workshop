"""Headless horseman, in the Pirate Nation creature style.

A chunky caricature (rules F1, F4): a short-coupled black-violet horse with
a heavy barrel, thick legs, bone hooves and a long wedge head with a
magenta mane and one toxic-green eye, under a blood-red gold-trimmed
blanket and a leather saddle. On its back rides a headless captain in a
heavy grey greatcoat with gold buttons, a flared skirt, big cuffs and a
ragged collar that glows toxic where the head should be (rule C3). He
carries his own grinning jack-o'-lantern head under the left arm (the
oversized function prop, rule F6) and a curved steel sabre in the right.

Parts: body (root), neck (head and mane), tail, four legs, rider, arm-l
(the lantern) and arm-r (the sabre). Clips: move (a gallop), attack (the
sabre sweeps down across the front), idle (breathing, a nod, a swishing
tail), hit and death. Sockets: socket-lantern in the pumpkin,
socket-neck in the collar, socket-blade at the sabre tip. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _kit import keys, pfx, world
from _life import assemble, coords, front, last, quad, side
from _pn import fur, pumpkin, stamp
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket

SZ = (56, 92, 100)
CX = 28.0
HIDE, HIDE_BASE = "purple", 2
BARREL = (32.0, 70.0, 30.0, 50.0)  # z0, z1, y0, y1
LEG_TOP = 34.0
LEGS = {"leg-fl": (-1, 38.0), "leg-fr": (1, 38.0), "leg-bl": (-1, 64.0), "leg-br": (1, 64.0)}
WITHERS = (CX, 46.0, 36.0)  # the neck joint
TAIL_J = (CX, 46.0, 68.0)
SEAT = (CX, 50.0, 52.0)  # the rider's hips
SHOULDER = {"arm-l": (CX - 9.0, 66.0, 50.0), "arm-r": (CX + 9.0, 66.0, 50.0)}
LANTERN = (CX - 13.0, 44.0, 26.0)  # the jack-o'-lantern's low corner centre
BLADE_TIP = (CX + 14.5, 85.0, 75.0)

FACE = [
    "rrrr..rrrr",
    "ryyr..ryyr",
    "rywr..rywr",
    "rrrr..rrrr",
    "....rr....",
    "...ryyr...",
    "...rrrr...",
    "r........r",
    "ryrrrrrryr",
    "ryyoyyyoyr",
    ".rryyyyrr.",
]


def hooves(g: Grid, x0: float, x1: float, z: float) -> None:
    m = box(g, x0 - 0.5, 0, z - 3.5, x1 + 0.5, 5, z + 2.5, "bone", 5)
    _X, Y, _Z = coords(g)
    P.flat(g, m & (Y > 3), "bone", 4)
    P.flat(g, m & (Y < 1), "bone", 6)


def leg(s: int, z0: float) -> Grid:
    """One thick horse leg: a tapered thigh, a cannon and a bone hoof
    (true slopes), with a feathered fetlock."""
    g = Grid(*SZ)
    x = CX + s * 7.0
    m = side(g, quad((LEG_TOP, z0), (19, z0 + 2), 4.2, 2.8, cap=0.5), x - 4, x + 4, HIDE, HIDE_BASE)
    m |= side(g, quad((19, z0 + 2), (6, z0 - 1), 2.6, 2.0, cap=0.5), x - 3, x + 3, HIDE, HIDE_BASE)
    fur(g, m, HIDE, HIDE_BASE, seed=int(z0) + s)
    _X, Y, Z = coords(g)
    P.flat(g, m & (Y < 11), HIDE, HIDE_BASE - 1)
    feather = side(g, [(10, z0 - 3.0), (10, z0 + 2.5), (5, z0 + 3.5), (5, z0 - 4.0)], x - 3.2, x + 3.2, HIDE, HIDE_BASE - 1)
    P.flat(g, feather & (Y < 7), "magenta", 3)
    P.flat(g, feather & (Y < 6), "magenta", 5)
    hooves(g, x - 3, x + 3, z0)
    return g


def body() -> Grid:
    """The barrel, chest and rump, the blanket and the saddle."""
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    z0, z1, y0, y1 = BARREL
    m = side(g, [(y0 + 2, z0 - 2), (y1 - 1, z0 + 2), (y1, z0 + 12), (y1, z1 - 10), (y1 - 2, z1 + 2), (y0 + 4, z1 + 2), (y0, z1 - 10), (y0 - 1, z0 + 8)], CX - 10, CX + 10, HIDE, HIDE_BASE)
    chest = front(g, [(CX - 9, y0 + 2), (CX + 9, y0 + 2), (CX + 8, y1 - 2), (CX - 8, y1 - 2)], z0 - 4, z0 + 6, HIDE, HIDE_BASE)
    rump = front(g, [(CX - 9, y0 + 4), (CX + 9, y0 + 4), (CX + 8, y1 - 1), (CX - 8, y1 - 1)], z1 - 8, z1 + 3, HIDE, HIDE_BASE)
    hide = m | chest | rump
    fur(g, hide, HIDE, HIDE_BASE, seed=1)
    P.flat(g, hide & (Y < y0 + 6), HIDE, HIDE_BASE - 1)  # the shaded belly
    P.flat(g, hide & (Y > y1 - 3), HIDE, HIDE_BASE + 1)  # the lit back
    # painted ribs and a hip bone, so the horse reads lean (rule S1)
    for rz in (z0 + 10, z0 + 15, z0 + 20):
        P.flat(g, hide & (np.abs(Z - rz) < 0.6) & (Y > y0 + 4) & (Y < y1 - 6) & (np.abs(X - CX) > 6), HIDE, HIDE_BASE + 1)
    P.flat(g, hide & (np.hypot(X - (CX - 9), Z - (z1 - 8)) < 3.0) & (Y > y1 - 8), HIDE, HIDE_BASE + 1)
    # the blanket: blood red with a gold border and a painted skull badge
    bl = side(g, [(y1 - 1, z0 + 10), (y1 - 1, z1 - 4), (y0 + 1, z1 - 6), (y0 + 2, z0 + 12)], CX - 11, CX + 11, "blood", 4)
    P.mottle(g, bl, "blood", 4, cell=3, seed=2)
    P.flat(g, bl & ((Y < y0 + 5) | (Z > z1 - 7) | (Z < z0 + 13)), "gold", 4)
    P.flat(g, bl & (Y < y0 + 4) & (((Z.astype(int)) % 4) == 0), "gold", 6)  # a fringe
    for s in (-1, 1):
        stamp(g, "-x" if s < 0 else "+x", int(CX + s * 11) - (1 if s < 0 else 0), int(z0 + 24), int(y0 + 10), ["rrrrr", "rwwwr", "rwdwr", "rwwwr", ".rrr."], {"r": C("blood", 2), "w": C("bone", 6), "d": C("purple", 1)}, depth=2)
    # a dark leather saddle with a high cantle and gold studs
    sd = side(g, [(y1 - 1, z0 + 12), (y1 + 4, z0 + 11), (y1 + 3, z0 + 16), (y1 + 1, z0 + 22), (y1 + 5, z0 + 27), (y1 - 1, z0 + 28)], CX - 8, CX + 8, "wood", 3)
    P.flat(g, sd, "wood", 3)
    P.flat(g, sd & (Y > y1 + 1), "wood", 4)
    P.flat(g, sd & (((X + Z).astype(int) % 5) == 0) & (Y > y1), "gold", 4)
    for s in (-1, 1):  # stirrup leathers and iron stirrups
        box(g, CX + s * 9 - 1, y1 - 10, z0 + 16, CX + s * 9 + 1, y1, z0 + 19, "wood", 3)
        st = box(g, CX + s * 9 - 2.5, y1 - 14, z0 + 15, CX + s * 9 + 2.5, y1 - 10, z0 + 20, "gray", 4)
        P.flat(g, st & (np.abs(X - (CX + s * 9)) < 1.4) & (Y > y1 - 13), "gray", 2)
    return g


def neck() -> Grid:
    """A thick arched neck, a long wedge head with a bone blaze, small
    toxic eyes and a magenta mane standing along the crest (true slopes)."""
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    nk = side(g, quad((44, 38), (60, 22), 6.0, 4.6, cap=0.6), CX - 5, CX + 5, HIDE, HIDE_BASE)
    head = side(g, [(64, 21), (65, 14), (62, 7), (57, 4), (53, 7), (52, 15), (56, 23)], CX - 4, CX + 4, HIDE, HIDE_BASE)
    fur(g, nk | head, HIDE, HIDE_BASE, seed=3)
    P.flat(g, head & (Z < 13) & (np.abs(X - CX) < 2.0), "bone", 5)  # the blaze down the face
    P.flat(g, head & (Z < 7), HIDE, HIDE_BASE - 1)  # the dark muzzle
    P.flat(g, head & (Z < 6) & (Y > 56) & (np.abs(X - CX) > 1.2) & (np.abs(X - CX) < 3.0), "magenta", 3)  # nostrils
    P.flat(g, head & (Y > 62) & (Z > 14), HIDE, HIDE_BASE + 1)  # the lit top of the skull
    for s in (-1, 1):
        ex = CX + s * 3.0
        eye = head & (np.abs(X - ex) < 1.6) & (np.abs(Y - 61) < 2.2) & (Z > 11) & (Z < 16)
        P.flat(g, eye, "purple", 1)
        P.flat(g, eye & (np.abs(Y - 61) < 1.2) & (Z > 12) & (Z < 15), "toxic", 6)
        P.flat(g, eye & (np.abs(Y - 61.5) < 0.6) & (Z > 13) & (Z < 14.5), "toxic", 7)
        ear = front(g, [(ex - s * 2.6, 64), (ex + s * 2.6, 64), (ex + s * 1.6, 72), (ex - s * 0.4, 72)], 16, 20, HIDE, HIDE_BASE - 1)
        P.flat(g, ear & (Z < 18), "magenta", 3)
    # the mane: leaning tufts standing on the crest of the neck (rule F2)
    for k in range(5):
        t = 0.10 + k * 0.20
        cy, cz = 50.0 + 13.0 * t, 37.0 - 15.0 * t
        tuft = side(g, [(cy, cz), (cy + 9, cz + 3), (cy + 4, cz + 5), (cy + 7, cz + 8), (cy + 1, cz + 7)], CX - 3.4, CX + 3.4, "magenta", 4)
        P.flat(g, tuft, "magenta", 4 if k % 2 else 5)
        P.flat(g, tuft & (Y > cy + 5), "toxic", 5)
        P.outline(g, tuft, "magenta", 2, normal="x")
    box(g, CX - 4.5, 52, 6, CX + 4.5, 54, 12, "wood", 3)  # a leather noseband
    box(g, CX - 5, 56, 11, CX + 5, 58, 24, "wood", 3)  # the cheek strap
    return g


def tail() -> Grid:
    """A long magenta tail sweeping back and down, tipped toxic."""
    g = Grid(*SZ)
    _X, Y, Z = coords(g)
    m = side(g, quad((46, 68), (34, 79), 3.8, 3.0, cap=0.6), CX - 3.5, CX + 3.5, "magenta", 3)
    m |= side(g, quad((34, 79), (22, 86), 3.0, 1.8, cap=0.8), CX - 3, CX + 3, "magenta", 3)
    P.mottle(g, m, "magenta", 3, cell=2, seed=4)
    P.flat(g, m & (((Y + Z).astype(int) % 5) == 0), "magenta", 5)  # painted hair strands
    P.flat(g, m & (Y < 27), "toxic", 4)
    P.flat(g, m & (Y < 25), "toxic", 6)
    return g


def rider() -> Grid:
    """The headless captain: a flared greatcoat with gold buttons and a
    blood lining, big cuffs, a sash, and a ragged collar glowing toxic
    where the head should be."""
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    coat = front(g, [(CX - 7, 50), (CX + 7, 50), (CX + 9, 62), (CX + 8, 70), (CX - 8, 70), (CX - 9, 62)], 44, 58, "gray", 5)
    skirt = side(g, [(52, 42), (52, 62), (38, 66), (36, 60), (36, 46), (38, 40)], CX - 9, CX + 9, "gray", 5)
    m = coat | skirt
    P.mottle(g, m, "gray", 5, cell=3, seed=5)
    P.flat(g, m & (Y < 41), "gray", 3)
    P.flat(g, m & edges(m), "gray", 2)
    P.flat(g, skirt & (Z > 62), "blood", 3)  # the lining of the flying tails
    P.flat(g, m & (Z < 45) & (np.abs(X - CX) < 2.0) & (Y > 50) & (Y < 68), "gray", 7)  # the front placket
    for by in (52, 56, 60, 64):  # gold buttons in two rows
        for s in (-1, 1):
            P.flat(g, m & (np.abs(X - (CX + s * 3.5)) < 1.0) & (np.abs(Y - by) < 1.0) & (Z < 45), "gold", 5)
    sash = side(g, [(66, 42), (68, 44), (50, 58), (48, 56)], CX - 10, CX + 10, "blood", 5)
    P.flat(g, sash, "blood", 5)
    P.flat(g, sash & (((Y + Z).astype(int) % 4) == 0), "blood", 6)
    # the collar: a ragged standing band, hollowed out, with the cut neck
    # glowing toxic inside it (rule C3: the accent carries the function)
    col = front(g, [(CX - 9, 67), (CX + 9, 67), (CX + 8, 78), (CX + 3, 74), (CX - 1, 79), (CX - 5, 73), (CX - 9, 77)], 44, 58, "gray", 5)
    P.flat(g, col, "gray", 5)
    P.flat(g, col & edges(col), "gray", 2)
    P.flat(g, col & (Y < 70), "gold", 4)
    g.box(CX - 5, 69, 47, CX + 5, 82, 55, 0)  # hollow the collar
    stump = box(g, CX - 4.5, 62, 47.5, CX + 4.5, 73, 54.5, "toxic", 3)
    P.flat(g, stump & (Y > 70), "toxic", 5)
    P.flat(g, stump & (Y > 72), "toxic", 7)
    P.flat(g, stump & (np.abs(X - CX) < 2.0) & (Z > 49.5) & (Z < 52.5) & (Y > 72), "bone", 7)  # the severed bone
    for s in (-1, 1):  # gold epaulettes on the shoulders
        ep = box(g, CX + s * 10 - 3, 64, 46, CX + s * 10 + 2, 68, 56, "gold", 4)
        P.flat(g, ep & (Y > 66), "gold", 6)
        P.flat(g, ep & (Y < 65), "gold", 2)
    return g


def arm(s: int) -> Grid:
    """One arm: a coat sleeve with a big turned cuff and a bone hand.
    The left (-x) arm cradles the jack-o'-lantern; the right holds the
    sabre up and back."""
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    sx = CX + s * 9.0
    if s < 0:
        m = side(g, quad((66, 50), (56, 36), 4.4, 3.4, cap=0.5), sx - 4, sx + 4, "gray", 5)
        cuff = side(g, quad((57, 37), (54, 32), 4.8, 4.2, cap=0.3), sx - 5, sx + 5, "gray", 6)
        hand = box(g, sx - 3.5, 48, 28, sx + 3.5, 54, 34, "bone", 5)
    else:
        m = side(g, quad((66, 50), (74, 58), 4.4, 3.4, cap=0.5), sx - 4, sx + 4, "gray", 5)
        cuff = side(g, quad((73, 57), (76, 61), 4.8, 4.2, cap=0.3), sx + 1, sx + 10, "gray", 6)
        hand = box(g, sx + 2, 74, 58, sx + 9, 80, 64, "bone", 5)
    P.mottle(g, m, "gray", 5, cell=3, seed=6 + s)
    P.flat(g, cuff, "gray", 6)
    P.outline(g, cuff, "gray", 2, normal="x")
    P.flat(g, hand & (Y > (52 if s < 0 else 78)), "bone", 6)
    if s < 0:
        lx, ly, lz = LANTERN
        pumpkin(g, lx, ly, lz, w=16, h=12, ramp="orange", base=4, seed=7)
        panel = box(g, lx - 5, ly + 1, lz - 8, lx + 5, ly + 11, lz - 5, "orange", 4)
        P.planks(g, panel, "orange", 4, width=4, across="x", length=(40, 41), nails=False, seed=8)
        legend = {"r": C("orange", 1), "y": C("gold", 4), "w": C("ember", 7), "o": C("orange", 3)}
        stamp(g, "-z", int(lz - 8), int(lx - 5), int(ly + 2), FACE, legend, depth=3)
    else:
        guard = box(g, sx + 2, 79, 57, sx + 9, 81, 65, "gold", 4)
        P.flat(g, guard & (Y > 80), "gold", 6)
        blade = side(g, [(81, 59), (84, 64), (86, 72), (84, 76), (83, 71), (80, 64), (79, 60)], sx + 4, sx + 7, "steel", 6)
        P.flat(g, blade, "steel", 6)
        P.flat(g, blade & (Z > 65), "steel", 7)  # the honed outer edge
        P.flat(g, blade & (Y > 84), "steel", 7)
        P.outline(g, blade, "steel", 3, normal="x")
    return g


def build():
    parts = {"body": body(), "neck": neck(), "tail": tail(), "rider": rider(), "arm-l": arm(-1), "arm-r": arm(1)}
    joints = [("body", None, (CX, 30.0, 50.0)), ("neck", "body", WITHERS), ("tail", "body", TAIL_J), ("rider", "body", SEAT),
              ("arm-l", "rider", SHOULDER["arm-l"]), ("arm-r", "rider", SHOULDER["arm-r"])]
    for name, (s, z0) in LEGS.items():
        parts[name] = leg(s, z0)
        joints.append((name, "body", (CX + s * 7.0, LEG_TOP, z0)))
    root = assemble(parts, joints)
    z3 = (0.0, 0.0, 0.0)

    def swing(phase: int, amp: float = 26.0, T: float = 0.8):
        k = [(0.0, amp), (T / 4, 0.0), (T / 2, -amp), (3 * T / 4, 0.0), (T, amp)]
        return {"rot": keys(*[(t, (a if phase == 0 else -a, 0.0, 0.0)) for t, a in k])}

    move = {"leg-fl": swing(0), "leg-br": swing(0), "leg-fr": swing(1), "leg-bl": swing(1),
            "body": {"loc": keys((0.0, z3), (0.2, (0.0, 2.0, 0.0)), (0.4, z3), (0.6, (0.0, 2.0, 0.0)), (0.8, z3)),
                     "rot": keys((0.0, (3.0, 0.0, 0.0)), (0.4, (-3.0, 0.0, 0.0)), (0.8, (3.0, 0.0, 0.0)))},
            "neck": {"rot": keys((0.0, (-6.0, 0.0, 0.0)), (0.4, (6.0, 0.0, 0.0)), (0.8, (-6.0, 0.0, 0.0)))},
            "tail": {"rot": keys((0.0, (-10.0, 0.0, 0.0)), (0.4, (-20.0, 0.0, 0.0)), (0.8, (-10.0, 0.0, 0.0)))},
            "rider": {"rot": keys((0.0, (-2.0, 0.0, 0.0)), (0.4, (3.0, 0.0, 0.0)), (0.8, (-2.0, 0.0, 0.0)))},
            "arm-r": {"rot": keys((0.0, (0.0, 0.0, -4.0)), (0.4, (0.0, 0.0, 4.0)), (0.8, (0.0, 0.0, -4.0)))}}
    idle = {"body": {"rot": keys((0.0, z3), (1.5, (1.5, 0.0, 0.0)), (3.0, z3))},
            "neck": {"rot": keys((0.0, z3), (0.9, (8.0, -5.0, 0.0)), (1.8, (2.0, 4.0, 0.0)), (3.0, z3))},
            "tail": {"rot": keys((0.0, z3), (0.75, (0.0, 0.0, 9.0)), (1.5, z3), (2.25, (0.0, 0.0, -9.0)), (3.0, z3))},
            "rider": {"rot": keys((0.0, z3), (1.5, (-2.0, 3.0, 0.0)), (3.0, z3))},
            "arm-l": {"rot": keys((0.0, z3), (1.5, (3.0, 0.0, 0.0)), (3.0, z3))},
            "arm-r": {"rot": keys((0.0, z3), (1.0, (-5.0, 0.0, 3.0)), (2.0, (3.0, 0.0, -2.0)), (3.0, z3))},
            "leg-fr": {"rot": keys((0.0, z3), (2.2, z3), (2.45, (-26.0, 0.0, 0.0)), (2.7, z3), (3.0, z3))}}
    attack = {"arm-r": {"rot": keys((0.0, z3), (0.18, (-40.0, 0.0, -12.0)), (0.42, (120.0, 0.0, 18.0)), (0.62, (96.0, 0.0, 10.0)), (0.9, z3))},
              "rider": {"rot": keys((0.0, z3), (0.18, (8.0, 10.0, 0.0)), (0.42, (-14.0, -14.0, 0.0)), (0.9, z3))},
              "body": {"rot": keys((0.0, z3), (0.2, (-10.0, 0.0, 0.0)), (0.5, (6.0, 0.0, 0.0)), (0.9, z3))},
              "leg-fl": {"rot": keys((0.0, z3), (0.2, (36.0, 0.0, 0.0)), (0.55, z3), (0.9, z3))},
              "leg-fr": {"rot": keys((0.0, z3), (0.2, (30.0, 0.0, 0.0)), (0.55, z3), (0.9, z3))}}
    hit = {"body": {"rot": keys((0.0, z3), (0.12, (10.0, -6.0, 0.0)), (0.5, z3))},
           "neck": {"rot": keys((0.0, z3), (0.12, (-18.0, 8.0, 0.0)), (0.5, z3))},
           "rider": {"rot": keys((0.0, z3), (0.12, (12.0, 0.0, 6.0)), (0.5, z3))}}
    death = {"body": {"rot": keys((0.0, z3), (0.35, (-8.0, 0.0, 0.0)), (1.0, (0.0, 0.0, 62.0)), (1.4, (0.0, 0.0, 58.0))),
                      "loc": keys((0.0, z3), (1.0, (-10.0, -14.0, 0.0)), (1.4, (-10.0, -14.0, 0.0)))},
             "neck": {"rot": keys((0.0, z3), (0.6, (26.0, 0.0, 0.0)), (1.4, (34.0, -12.0, 0.0)))},
             "rider": {"rot": keys((0.0, z3), (0.5, (-20.0, 0.0, -10.0)), (1.0, (-70.0, 0.0, -24.0)), (1.4, (-70.0, 0.0, -24.0)))},
             "arm-l": {"rot": keys((0.0, z3), (1.0, (-50.0, 0.0, 0.0)), (1.4, (-50.0, 0.0, 0.0)))},
             "arm-r": {"rot": keys((0.0, z3), (1.0, (70.0, 0.0, 0.0)), (1.4, (70.0, 0.0, 0.0)))}}
    # sockets in each parent's joint space
    lantern = (LANTERN[0] - SHOULDER["arm-l"][0], LANTERN[1] + 6.0 - SHOULDER["arm-l"][1], LANTERN[2] - SHOULDER["arm-l"][2])
    collar = (0.0, 73.0 - SEAT[1], 51.0 - SEAT[2])
    tip = (BLADE_TIP[0] - SHOULDER["arm-r"][0], BLADE_TIP[1] - SHOULDER["arm-r"][1], BLADE_TIP[2] - SHOULDER["arm-r"][2])
    return world("headless-horseman", "creatures", "Headless Horseman", root,
                 clips=[Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False), Clip("idle", idle)],
                 sockets=[Socket("socket-lantern", at=lantern, parent="arm-l"),
                          Socket("socket-neck", at=collar, parent="rider"),
                          Socket("socket-blade", at=tip, parent="arm-r")],
                 pfx=[pfx("rvx-monster-candle-flame", "socket-lantern", "idle", size=14),
                      pfx("rvx-monster-ghost-wisps", "socket-neck", "idle", size=22),
                      pfx("rvx-monster-reaper-slash", "socket-blade", "clip:attack", size=34, at=0.42)])
