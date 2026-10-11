"""Elven treehouse in the Pirate Nation style.

A giant living tree carries two round pods. The trunk is PN tree style: a
curved, faceted trunk (sheared 8-sided frustums through a gentle S-curve,
true slopes) with painted bark, a mossy foot and five sloped roots. The
pods are pale wood drums with leaf-green cone roofs (tile rows down the
slopes, gold hips) on planked decks and dark brackets; a ladder leans on
the lower deck. The oversized function prop is the huge crown (rule F4):
ten big chamfered leaf blocks that overlap into one rounded cloud, like
the PN cherry blossom and oak, with white blossoms on the tops; four
sloped limbs carry it and it sways on `idle`. Three glowing cyan moon
lanterns hang from the pod eaves and bob on `idle`; leaves swirl from the
crown (PFX). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _bld import FRONT, arch_door, cone_roof, drum, idx, round_window, sub_part, wave
from _life import leaf_block, up_faces
from _life import trunk as tree_trunk
from pnkit import box
from voxgrid import C, Asset, Clip, Grid, Part, Socket

W, H, D = 72, 166, 72
CX, CZ = 36, 36
TRUNK_TOP = 124
POD = (CX, CZ, 17, 40, 64)  # centre x, z, radius, y0, y1
POD2 = (CX + 1, CZ + 2, 11, 86, 104)
CANOPY_Y = 112
# the trunk path (x, y, z) and corner radii: a gentle S-curve
PATH = [(CX, 0, CZ), (CX + 0.5, 8, CZ), (CX - 1.5, 30, CZ + 0.5), (CX + 1.5, 62, CZ - 0.5), (CX - 1.0, 92, CZ + 0.5), (CX + 0.5, CANOPY_Y + 2, CZ)]
RADII = [14.0, 10.5, 9.4, 8.8, 8.2, 7.4]
# crown blocks: (dx, cy, dz, sx, sy, sz, ramp, base, lean)
BLOCKS = [
    (0, 140, 2, 36, 20, 34, "leaf", 4, (0.5, 0.0)),
    (-22, 126, 4, 26, 18, 28, "leaf", 5, (-1.0, 0.4)),
    (22, 128, -2, 26, 18, 28, "forest", 6, (1.0, -0.4)),
    (3, 124, 21, 30, 16, 20, "forest", 6, (0.4, 1.0)),
    (-2, 135, -19, 26, 14, 18, "leaf", 6, (0.0, -1.0)),
    (-13, 152, 6, 24, 14, 22, "leaf", 5, (-0.6, 0.4)),
    (13, 151, -6, 22, 14, 20, "leaf", 6, (0.6, -0.4)),
    (1, 161, 1, 16, 9, 16, "leaf", 5, (0.3, 0.0)),
    (-27, 112, -6, 14, 12, 14, "forest", 6, (-0.5, -0.3)),
    (27, 114, 8, 14, 12, 14, "leaf", 5, (0.5, 0.3)),
    (-9, 113, 24, 16, 10, 14, "leaf", 5, (-0.3, 0.6)),
]
# limbs from the trunk top into the crown: (dx, y1, dz, r1)
LIMBS = [(-26, 110, -6, 2.6, 101), (26, 112, 8, 2.6, 103), (-20, 124, 4, 3.0, 106), (20, 126, -2, 3.0, 108), (-9, 110, 22, 2.4, 102), (-10, 146, 6, 2.6, 112), (10, 146, -6, 2.6, 112)]  # (dx, y1, dz, r1, y0)
LANTERNS = [(CX - 14, 58, CZ - 16, 65), (CX + 19, 58, CZ - 10, 65), (CX - 10, 99, CZ - 7, 105)]


def bark(g: Grid, mask: np.ndarray, frame=None, seed: int = 0) -> None:
    """Vertical bark strips in warm wood with dark cracks and a mossy foot."""
    P.planks(g, mask, "wood", 4, width=3, across="x", length=(18, 30), nails=False, frame=frame, seed=seed)


def trunk() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = idx(g)
    tree_trunk(g, PATH, RADII, ramp="wood", base=4, n=8, turn=0.2, seed=1)
    # sloped roots that rise from the ground into the flared foot
    for k, (ang, reach, r0) in enumerate(((0.4, 21, 3.8), (1.7, 19, 3.4), (2.9, 22, 4.0), (4.1, 19, 3.4), (5.3, 21, 3.8))):
        ex, ez = CX + reach * math.cos(ang), CZ + reach * math.sin(ang)
        mx, mz = CX + 10 * math.cos(ang), CZ + 10 * math.sin(ang)
        tree_trunk(g, [(ex, 0, ez), (mx, 13, mz)], [r0, 7.0], ramp="wood", base=4, n=5, turn=ang, seed=10 + k)
    P.flat(g, (g.a > 0) & (Y < 5) & (P._hash(X // 2, Z // 2, seed=2) % np.uint64(3) != 0), "moss", 5)
    # the main pod: brackets, deck, pale wood walls, leaf roof
    px, pz, pr, py0, py1 = POD
    drum(g, px, pz, py0 - 10, py0 - 3, 9, "darkwood", 3, r_top=pr + 5, painter=lambda gg, mm, fr: P.planks(gg, mm, "darkwood", 3, width=3, across="x", nails=False, frame=fr))
    drum(g, px, pz, py0 - 3, py0, pr + 5, "wood", 5, painter=lambda gg, mm, fr: P.planks(gg, mm, "wood", 5, width=3, across="y", frame=fr))
    walls = drum(g, px, pz, py0, py1, pr, "sand", 6, painter=lambda gg, mm, fr: P.planks(gg, mm, "sand", 6, width=3, across="x", length=(40, 41), nails=False, frame=fr))
    P.flat(g, walls & S.seams(g, [g.solids[-1]], 1.6), "gold", 4)
    P.flat(g, walls & (Y >= py1 - 3), "gold", 4)
    cone_roof(g, px, pz, py1, pr + 6, 26, "blue", 4, lean=(-2.0, -1.0), trim=("gold", 5), eave=("blue", 2), seed=4)
    arch_door(g, "-z", pz - pr, px - 6, px + 6, py0, py0 + 20, leaf=("leaf", 4), frame=("gold", 4), studs=("gold", 6), seed=5)
    for face, plane in (("-x", px - pr), ("+x", px + pr)):
        round_window(g, face, plane, pz, py0 + 12, 4, glass=("cyan", 6), frame=("gold", 4))
    round_window(g, "+z", pz + pr, px, py0 + 12, 4, glass=("cyan", 6), frame=("gold", 4))
    # the small upper pod
    qx, qz, qr, qy0, qy1 = POD2
    drum(g, qx, qz, qy0 - 3, qy0, qr + 4, "wood", 5, r_top=qr + 4, painter=lambda gg, mm, fr: P.planks(gg, mm, "wood", 5, width=3, across="y", frame=fr))
    drum(g, qx, qz, qy0 - 9, qy0 - 3, 7, "darkwood", 3, r_top=qr + 4, painter=lambda gg, mm, fr: P.planks(gg, mm, "darkwood", 3, width=3, across="x", nails=False, frame=fr))
    w2 = drum(g, qx, qz, qy0, qy1, qr, "sand", 6, painter=lambda gg, mm, fr: P.planks(gg, mm, "sand", 6, width=3, across="x", length=(40, 41), nails=False, frame=fr))
    P.flat(g, w2 & S.seams(g, [g.solids[-1]], 1.6), "gold", 4)
    cone_roof(g, qx, qz, qy1, qr + 7, 18, "blue", 4, lean=(2.0, 0.0), trim=("gold", 5), eave=("blue", 2), seed=6)
    round_window(g, "-z", qz - qr, qx, qy0 + 9, 3.5, glass=("cyan", 6), frame=("gold", 4))
    # a ladder leaning on the deck (a true slope): dark rails, light rungs
    lz0, lz1 = pz - 4, pz + 4
    g.prism("z", [(px + 29, 0), (px + 33, 0), (px + 22, py0), (px + 18, py0)], lz0, lz1, C("darkwood", 2))
    lm = g.solids[-1].mask(g.shape)
    P.flat(g, lm & ((Y % 5 == 0) | (Y % 5 == 1)), "wood", 6)
    P.flat(g, lm & ((Z == lz0) | (Z == lz1 - 1)), "darkwood", 4)
    return g


def canopy() -> tuple[Grid, tuple]:
    """The crown: sloped limbs from the trunk top and big chamfered leaf
    blocks that overlap into one rounded cloud (PN tree style), with white
    blossoms with gold hearts painted on the block tops."""
    oy = CANOPY_Y - 14
    o = (0, oy, 0)
    g = Grid(W, H - oy, D)
    X, Y, Z = idx(g)
    tx, tz = PATH[-1][0], PATH[-1][2]
    for k, (dx, y1, dz, r1, y0) in enumerate(LIMBS):
        ex, ez = CX + dx, CZ + dz
        tree_trunk(g, [(tx + dx * 0.1, y0 - oy, tz + dz * 0.1), (tx + dx * 0.5, (y0 + y1) / 2 - oy + 1.5, tz + dz * 0.5), (ex, y1 - oy, ez)], [4.6, 3.6, r1],
                   ramp="wood", base=4, n=5, turn=0.4 * k, seed=20 + k)
    crown = np.zeros(g.shape, dtype=bool)
    for k, (dx, cy, dz, sx, sy, sz, ramp, base, lean) in enumerate(BLOCKS):
        crown |= leaf_block(g, CX + dx, cy - oy, CZ + dz, sx, sy, sz, ramp, base, bevel=3.5, lean=lean, seed=40 + k)
    tops = up_faces(g, crown)
    cell = P._hash(X // 3, Z // 3, seed=9) % np.uint64(7)
    flower = tops & (cell == 0) & (X % 3 < 2) & (Z % 3 < 2)
    P.flat(g, flower, "bone", 7)
    P.flat(g, flower & (X % 3 == 0) & (Z % 3 == 0), "gold", 7)
    return g, o


def lantern(x, y, z) -> tuple[Grid, tuple]:
    """A small glowing moon lantern hanging from a gold ring."""
    g = Grid(10, 16, 10)
    c = 5
    box(g, c - 1, 13, c - 1, c + 1, 16, c + 1, "gold", 4)  # hanger
    S.disc(g, "y", c, c, 3.4, 11, 13, "gold", 5)
    body = S.disc(g, "y", c, c, 3.8, 3, 11, "cyan", 6)
    X, Y, Z = idx(g)
    P.flat(g, body & ((Y == 6) | (Y == 7)), "cyan", 7)
    S.disc(g, "y", c, c, 2.6, 1, 3, "gold", 4)
    o = (x - c, y - 16, z - c)
    return g, o


def build() -> Asset:
    g = trunk()
    cg, co = canopy()
    root = Part("elven-treehouse", g)
    hinge = (CX, CANOPY_Y, CZ)
    root.add(sub_part("canopy", cg, hinge, co))
    idle = {"canopy": {"rot": wave(5.0, "z", 1.5)}}
    for i, (x, y, z, eave) in enumerate(LANTERNS):
        lg, lo = lantern(x, y, z)
        name = f"lantern-{i}"
        root.add(sub_part(name, lg, (x, y, z), lo))
        box(g, x - 1, y, z - 1, x + 1, eave, z + 1, "gold", 4)  # hook up into the eave
        idle[name] = {"rot": wave(2.5, "x", 8, phase=i)}
    return Asset(id="fantasy-buildings-elven-treehouse", pack="fantasy", category="buildings", name="Elven Treehouse", root=root,
                 clips=[Clip("idle", idle)], sockets=[Socket("socket-canopy", at=(CX, 140, CZ), parent="canopy")],
                 pfx=[{"effectId": "rvx-fantasy-leaf-fall", "socket": "socket-canopy", "trigger": "idle", "size": 100}])
