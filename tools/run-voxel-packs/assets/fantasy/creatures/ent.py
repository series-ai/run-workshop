"""Elder ent in the Pirate Nation creature style.

A walking tree built like the PN trees: a stout curved faceted trunk (a
barrel body) under a clump of big chamfered leaf blocks with pink
blossoms, on two stumpy trunk legs with root toes. A big bark face: a
heavy V brow, glowing gold eyes in dark hollows, a knot nose, a groaning
mouth and a hanging moss beard; red shelf mushrooms on its side. Long
sloped branch arms with a leaf tuft at the elbow end in big twig claws.
Trunks, limbs, leaves, brow, nose and beard are true slopes; bark, moss,
face and blossoms are painted.
Clips: idle (sway and creak), attack (raises both arms and slams), hit
(reels), death (topples backward). Faces -Z.
"""
import math

import numpy as np

import paint as P
from _life import asset, bark, coords, facet_paint, front, keys, leaf_block, limb, ngon, pfx, plan, rig, side, trunk, up_faces
from voxgrid import Clip, Grid, Socket

SH = (76, 80, 64)
CX, CZ = 38.0, 30.0
BARK, BARK_B = "wood", 4
LEAF, LEAF_B = "leaf", 5
T8 = math.pi / 8  # octagons with a flat side to the front
HIP_Y = 17.0
WAIST_Y = 21.0
SHOULDER_Y = 43.0
CROWN_Y = 48.0


def bark_on(g: Grid, start: int, base: int = BARK_B, seed: int = 0) -> None:
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: bark(gg, mm, BARK, base, frame=fr, seed=seed))


def leg(s: int) -> Grid:
    g = Grid(*SH)
    X, Y, Z = coords(g)
    lx = CX + s * 8.5
    st = len(g.solids)
    foot = plan(g, ngon(lx, CZ - 1, 7.0, 6, 0.2, jitter=[1.0, 0.9, 1.1, 0.95, 1.05, 0.9]), 0, 3, BARK, BARK_B, top=ngon(lx, CZ - 0.5, 5.0, 6, 0.2))
    bark_on(g, st, seed=1 + s)
    trunk(g, [(lx, 2.5, CZ - 0.5), (lx + s * 0.6, 10, CZ + 0.3), (lx + s * 0.2, HIP_Y + 1.5, CZ)], [5.2, 4.4, 4.8], ramp=BARK, base=BARK_B, n=6, turn=0.3, seed=2 + s)
    # root toes: sloped branches splaying out and down to the ground
    toes = limb(g, "x", (3.4, CZ - 3), (1.5, CZ - 11), 2.3, 1.3, lx - 1.6, lx + 1.6, BARK, BARK_B, seed=3)
    toes |= limb(g, "z", (lx, 3.4), (lx + s * 10, 1.5), 2.2, 1.2, CZ - 2.5, CZ + 0.5, BARK, BARK_B, seed=4)
    toes |= limb(g, "x", (3.2, CZ + 2), (1.5, CZ + 8.5), 2.0, 1.2, lx - 1.3, lx + 1.3, BARK, BARK_B, seed=5)
    P.flat(g, (foot | toes) & (Y < 1), BARK, 2)
    # a moss sock around the ankle (a band in y)
    P.flat(g, foot & (Y > 2.2), "moss", 5)
    return g


def hips() -> Grid:
    """The root: the wide base of the trunk that the legs hang from."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    m = trunk(g, [(CX, 14.5, CZ), (CX, WAIST_Y + 1, CZ)], [10.5, 12.2], ramp=BARK, base=BARK_B, n=8, turn=T8, seed=6)
    P.flat(g, m & (Y < 15.5), BARK, 2)
    return g


def body() -> Grid:
    g = Grid(*SH)
    X, Y, Z = coords(g)
    m = trunk(g, [(CX, WAIST_Y, CZ), (CX + 0.6, 32, CZ - 0.8), (CX - 0.4, 43, CZ - 0.3), (CX, CROWN_Y + 1, CZ)], [12.2, 13.2, 12.4, 10.2], ramp=BARK, base=BARK_B, n=8, turn=T8, seed=7)
    # moss on the shoulders (a band on the upper slope) and dark root ring
    P.flat(g, m & (Y > 45.5), "moss", 5)
    P.flat(g, m & (Y > 44.5) & (Y <= 45.5) & ((np.floor(X + Z) % 3) == 0), "moss", 4)
    fz = CZ - 12.0  # about the front face of the trunk
    front_m = m & (Z < fz + 3.5)
    # glowing gold eyes in dark hollows (painted, rule C3)
    for sx in (-1, 1):
        ex = CX + sx * 5.2
        hollow = front_m & (np.abs(X - ex) < 3.8) & (np.abs(Y - 34.5) < 2.8)
        P.flat(g, hollow, "darkwood", 1)
        P.flat(g, hollow & (np.abs(X - ex) < 2.7) & (np.abs(Y - 34.5) < 1.8), "gold", 6)
        P.flat(g, hollow & (np.abs(X - ex + sx * 0.6) < 1.1) & (np.abs(Y - 35) < 1.1), "gold", 7)
    # a groaning knot mouth
    mouth = front_m & (np.abs(X - CX) < 3.6) & (np.abs(Y - 28.5) < 1.8)
    P.flat(g, mouth, "darkwood", 1)
    P.flat(g, mouth & (np.abs(Y - 28.5) > 1.2), BARK, 2)
    # the heavy V brow and the knot nose (proud bark prisms)
    st = len(g.solids)
    brow = front(g, [(CX - 11, 38.6), (CX - 2, 37.4), (CX, 36.6), (CX + 2, 37.4), (CX + 11, 39.2), (CX + 11, 42.4), (CX, 40), (CX - 11, 41.8)], fz - 2.5, fz + 4, BARK, BARK_B)
    side(g, [(34.5, fz + 1), (33.5, fz - 3.5), (31, fz - 4), (30.5, fz - 1.5), (31, fz + 1)], CX - 2.2, CX + 2.2, BARK, BARK_B)
    bark_on(g, st, BARK_B, seed=8)
    P.flat(g, up_faces(g, brow), BARK, BARK_B + 2)  # a lit top edge on the brow
    P.flat(g, brow & (Y < 38.2), BARK, BARK_B - 2)  # its shadow line
    # a hanging moss beard under the mouth (jagged, true slopes)
    st = len(g.solids)
    beard = front(g, [(CX - 8.5, 27), (CX + 8.5, 27), (CX + 7.5, 22), (CX + 5, 24), (CX + 3.2, 18.5), (CX + 1.2, 22.5), (CX - 1, 17.5), (CX - 3, 22), (CX - 5.2, 19), (CX - 7.2, 23.5)], fz - 1.6, fz + 3, "moss", 5)
    facet_paint(g, g.solids[st:], lambda gg, mm, fr: P.thatch(gg, mm, "moss", 5, band=40, frame=fr, seed=9))
    P.flat(g, beard & (Y > 26), "moss", 4)
    # two red shelf mushrooms on the right side (an accent, rule C1)
    for my, mz, r in ((29.0, CZ + 2.0, 3.4), (34.5, CZ + 5.5, 2.6)):
        mx = CX + 12.5
        cap = plan(g, ngon(mx, mz, r, 7, 0.3), my, my + 1.6, "red", 5, top=ngon(mx - 0.4, mz, r * 0.7, 7, 0.3))
        P.flat(g, cap & (Y < my + 0.8), "red", 3)
        P.flat(g, up_faces(g, cap) & ((np.floor(X) + np.floor(Z)) % 3 == 0), "bone", 7)
    return g


def arm(s: int) -> Grid:
    g = Grid(*SH)
    X, Y, Z = coords(g)
    sx = CX + s * 10
    ex, ey = CX + s * 20.5, 34.0  # elbow
    hx, hy = CX + s * 23.5, 20.0  # wrist
    limb(g, "z", (sx, SHOULDER_Y + 1), (ex, ey), 3.8, 3.1, CZ - 3.3, CZ + 3.3, BARK, BARK_B, seed=10 + s)
    limb(g, "z", (ex, ey + 1), (hx, hy), 3.1, 2.6, CZ - 2.9, CZ + 2.9, BARK, BARK_B, seed=12 + s)
    st = len(g.solids)
    wrist = plan(g, ngon(hx, CZ, 3.6, 6, 0.2), hy - 3, hy + 1.5, BARK, BARK_B, top=ngon(hx, CZ, 3.0, 6, 0.2))
    bark_on(g, st, seed=14 + s)
    # big twig claws: three splaying down and out, one forward
    claws = limb(g, "z", (hx, hy - 2), (hx + s * 5.5, 10.5), 1.7, 0.8, CZ - 1.4, CZ + 1.4, BARK, BARK_B - 1, cap=0.8, seed=15)
    claws |= limb(g, "z", (hx, hy - 2), (hx + s * 0.8, 8.5), 1.7, 0.8, CZ - 1.4, CZ + 1.4, BARK, BARK_B - 1, cap=0.8, seed=16)
    claws |= limb(g, "z", (hx, hy - 2), (hx - s * 4.5, 10.5), 1.6, 0.8, CZ - 1.3, CZ + 1.3, BARK, BARK_B - 1, cap=0.8, seed=17)
    claws |= limb(g, "x", (hy - 2, CZ), (11, CZ - 7), 1.6, 0.8, hx - 1.3, hx + 1.3, BARK, BARK_B - 1, cap=0.8, seed=18)
    P.flat(g, claws & (Y < 12), BARK, 5)  # pale worn tips
    P.flat(g, wrist & (Y > hy + 0.6), "moss", 5)
    # a leaf tuft sprouting from the elbow
    leaf_block(g, ex + s * 0.5, ey + 4.5, CZ + 0.5, 9, 6.5, 9, LEAF, LEAF_B, bevel=1.8, lean=(s * 1.0, 0.0), seed=19 + s)
    return g


def crown() -> Grid:
    g = Grid(*SH)
    X, Y, Z = coords(g)
    # branches from the trunk top into the clump (true slopes)
    limb(g, "z", (CX - 2, CROWN_Y - 2), (CX - 11, 57), 2.8, 1.9, CZ - 2.2, CZ + 2.2, BARK, BARK_B, seed=20)
    limb(g, "z", (CX + 3, CROWN_Y - 2), (CX + 12, 58), 2.8, 1.9, CZ - 2.2, CZ + 2.2, BARK, BARK_B, seed=21)
    leaves = np.zeros(g.shape, dtype=bool)
    for k, (cx, cy, cz, sx, sy, sz, lean, base) in enumerate([
        (CX + 0.5, 59.5, CZ + 1.5, 30, 13, 26, (0.5, 0.0), LEAF_B),
        (CX - 15.5, 54.5, CZ + 1.0, 16, 11, 18, (-1.0, 0.0), LEAF_B - 1),
        (CX + 15.5, 56.5, CZ - 1.0, 17, 12, 18, (1.0, -0.5), LEAF_B),
        (CX + 6.0, 67.5, CZ + 4.0, 17, 9, 15, (1.0, 0.5), LEAF_B + 1),
        (CX - 8.0, 65.0, CZ - 4.0, 14, 8, 12, (-1.0, -0.5), LEAF_B),
        (CX - 3.0, 57.0, CZ + 12.0, 18, 10, 12, (-0.5, 1.0), LEAF_B - 1),
    ]):
        leaves |= leaf_block(g, cx, cy, cz, sx, sy, sz, LEAF, base, bevel=2.6, lean=lean, seed=30 + k)
    # pink blossoms as 3×3 flowers on the lit tops (a sparse motif)
    Xi, Zi = np.floor(X).astype(int), np.floor(Z).astype(int)
    tops = up_faces(g, leaves)
    cell = (P._hash(Xi // 3, Zi // 3, seed=41) % np.uint64(9)) == 0
    bloom = tops & cell & ~((Xi % 3 == 1) & (Zi % 3 == 1))
    P.flat(g, bloom, "pink", 6)
    P.flat(g, tops & cell & (Xi % 3 == 1) & (Zi % 3 == 1), "gold", 6)  # a gold heart
    return g


def build():
    root, to_root = rig([
        ("ent", hips(), None, None),
        ("leg-l", leg(-1), (CX - 8.5, HIP_Y, CZ), None),
        ("leg-r", leg(1), (CX + 8.5, HIP_Y, CZ), None),
        ("trunk", body(), (CX, WAIST_Y, CZ), None),
        ("crown", crown(), (CX, CROWN_Y - 2, CZ), "trunk"),
        ("arm-l", arm(-1), (CX - 10, SHOULDER_Y, CZ), "trunk"),
        ("arm-r", arm(1), (CX + 10, SHOULDER_Y, CZ), "trunk"),
    ])
    idle = {"trunk": {"rot": keys((0, 0, 0, 0), (1.5, 0, 0, 3), (3.0, 0, 0, 0), (4.5, 0, 0, -3), (6.0, 0, 0, 0))},
            "crown": {"rot": keys((0, 0, 0, 0), (1.5, 0, 0, -4), (3.0, 0, 0, 0), (4.5, 0, 0, 4), (6.0, 0, 0, 0))},
            "arm-l": {"rot": keys((0, 0, 0, 0), (3.0, 8, 0, 0), (6.0, 0, 0, 0))},
            "arm-r": {"rot": keys((0, 0, 0, 0), (3.0, -8, 0, 0), (6.0, 0, 0, 0))}}
    attack = {"arm-l": {"rot": keys((0, 0, 0, 0), (0.5, 150, 0, 20), (0.75, 45, 0, 0), (0.9, 40, 0, 0), (1.3, 0, 0, 0))},
              "arm-r": {"rot": keys((0, 0, 0, 0), (0.5, 150, 0, -20), (0.75, 45, 0, 0), (0.9, 40, 0, 0), (1.3, 0, 0, 0))},
              "trunk": {"rot": keys((0, 0, 0, 0), (0.5, 10, 0, 0), (0.75, -14, 0, 0), (1.3, 0, 0, 0))},
              "crown": {"rot": keys((0, 0, 0, 0), (0.5, 6, 0, 0), (0.8, -10, 0, 0), (1.3, 0, 0, 0))},
              "ent": {"loc": keys((0, 0, 0, 0), (0.5, 0, 1.5, 0), (0.75, 0, -1, 0), (1.0, 0, 0, 0))}}
    hit = {"trunk": {"rot": keys((0, 0, 0, 0), (0.15, 8, 0, -5), (0.6, 0, 0, 0))},
           "crown": {"rot": keys((0, 0, 0, 0), (0.2, 8, 0, 6), (0.7, 0, 0, 0))},
           "arm-l": {"rot": keys((0, 0, 0, 0), (0.15, -15, 0, -10), (0.6, 0, 0, 0))},
           "arm-r": {"rot": keys((0, 0, 0, 0), (0.15, -15, 0, 10), (0.6, 0, 0, 0))}}
    death = {"ent": {"rot": keys((0, 0, 0, 0), (0.4, -6, 0, 0), (1.4, 84, 0, 0), (1.6, 80, 0, 0), (1.8, 84, 0, 0)),
                     "loc": keys((0, 0, 0, 0), (1.4, 0, 9, 6), (1.8, 0, 9, 6))},
             "crown": {"rot": keys((0, 0, 0, 0), (1.4, 10, 0, 0), (1.6, -4, 0, 0))},
             "arm-l": {"rot": keys((0, 0, 0, 0), (1.4, 0, 0, -50))}, "arm-r": {"rot": keys((0, 0, 0, 0), (1.4, 0, 0, 50))},
             "leg-l": {"rot": keys((0, 0, 0, 0), (1.4, -20, 0, 0))}}
    return asset("creatures", "ent", "Elder Ent", root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 # leaves fall from under the canopy, which they follow as it sways
                 sockets=[Socket("socket-slam", at=to_root((CX, 1.0, CZ - 16))), Socket("socket-canopy", at=to_root((CX, CROWN_Y + 4, CZ)), parent="crown")],
                 fx=[pfx("rvx-fantasy-dust-slam", "socket-slam", "clip:attack", size=44, at=0.52), pfx("rvx-fantasy-leaf-fall", "socket-canopy", "idle", size=40)])
