"""Charred stumps on a bed of ash, in the Pirate Nation style.

Three low burnt stumps (10-15 tall, under half a person) and one snapped
trunk (about 34 tall, under one person) stand on a patch of grey ash. Each
stump is a tapered faceted frustum (true slopes, rule F2) with a jagged
top of two or three shards at irregular angles, so the tops read as
broken wood and not as a crown. Root wedges grip the ash. A burnt log lies
across the bed. The alligator char, the ember cores, the pale splinters
and the scorch rings are paint (rule S1). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import blob, ctr, limb, make, plan, tuft
from _rep_terrain import char, ring_angles, soft_ground
from voxgrid import Grid, Part

SIZE = (70, 40, 64)
GROUND = 2.0


def stump(g: Grid, cx: float, cz: float, r: float, h: float, seed: int, shards=((0.55, 4.0), (0.45, 2.0)), lean=(0.0, 0.0)):
    """A burnt stump: a frustum to `h` and a jagged top of shards. Each
    shard is (radius as a part of r, rise above h). Returns the wood mask."""
    X, Y, Z = ctr(g)
    turn = 0.37 * seed
    base = S.flat_ngon(cx, cz, r, 7, turn)
    top = [(cx + lean[0] + (x - cx) * 0.78, cz + lean[1] + (z - cz) * 0.78) for x, z in base]
    trunk = plan(g, base, GROUND - 0.5, h, "darkwood", 3, top=top)
    wood = trunk.copy()
    tx, tz, tr = cx + lean[0], cz + lean[1], r * 0.78
    # Shards rise from the rim at irregular angles; each leans in a little.
    for (part, rise), a in zip(shards, ring_angles(len(shards), seed)):
        bx, bz = tx + math.cos(a) * tr * 0.42, tz + math.sin(a) * tr * 0.42
        wood |= limb(g, (bx, h - 1.0, bz), (bx - math.cos(a) * 0.8, h + rise, bz - math.sin(a) * 0.8),
                     tr * part, 0.3, "darkwood", 3, n=4, facing=a)
    # Root wedges at irregular angles grip the ash.
    for k, a in enumerate(ring_angles(4, seed + 50)):
        p0 = (cx + math.cos(a) * r * 0.5, GROUND + 3.5, cz + math.sin(a) * r * 0.5)
        p1 = (cx + math.cos(a) * r * (1.55 + 0.2 * (k % 2)), GROUND + 0.3, cz + math.sin(a) * r * (1.55 + 0.2 * (k % 2)))
        wood |= limb(g, p0, p1, 2.2, 0.6, "darkwood", 3, n=4)
    # Paint: bark grain low down, alligator char above, pale wood in the
    # splits of the shards and a glowing ember core on the cut face.
    char(g, wood, base=4, seed=seed)
    bark = wood & (Y < GROUND + (h - GROUND) * 0.4)
    PP.fur(g, bark, "darkwood", 5, stroke=3, frame="wall", seed=seed)
    P.flat(g, wood & (Y < GROUND + 1.0), "darkwood", 5)
    P.flat(g, wood & (Y > h + 1.5), "wood", 3)  # paler wood shows on the broken shards
    cut = trunk & (Y > h - 1.0) & (Y < h)
    d = np.hypot(X - tx, Z - tz)
    P.flat(g, cut, "darkwood", 3)
    P.flat(g, cut & (d < tr * 0.55), "ember", 3)
    P.flat(g, cut & (d < tr * 0.28), "ember", 5)
    return wood


def build():
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    patch = blob(35, 32, 32, 28, n=10, jitter=0.1, seed=1)
    ground = plan(g, patch, 0, GROUND, "gray", 4, top=[(35 + (x - 35) * 0.95, 32 + (z - 32) * 0.95) for x, z in patch])
    soft_ground(g, ground, "gray", 4, [(24, 22, 12, 9, 1), (50, 46, 10, 8, 1), (12, 44, 7, 6, -1), (58, 30, 6, 9, 2)],
                35, 32, 25)
    stands = (
        # (x, z, radius, height, seed, shards, lean)
        (22.0, 26.0, 6.5, 24.0, 3, ((0.42, 10.0), (0.3, 5.0), (0.26, 2.5)), (1.6, -0.8)),  # the snapped trunk
        (46.0, 39.0, 6.0, 12.0, 4, ((0.55, 3.0), (0.4, 1.5)), (0.0, 0.0)),
        (56.0, 17.0, 4.8, 8.0, 5, ((0.6, 3.0),), (-0.4, 0.3)),
        (15.0, 47.0, 4.4, 10.0, 6, ((0.5, 2.5), (0.4, 1.2)), (0.3, 0.3)),
    )
    for x, z, r, h, seed, shards, lean in stands:
        # A scorch ring of darker ash round every stump.
        P.flat(g, ground & (np.hypot(X - x, Z - z) < r * 2.0), "gray", 3)
        P.flat(g, ground & (np.hypot(X - x, Z - z) < r * 1.4), "gray", 2)
        stump(g, x, z, r, h, seed, shards, lean)
    # Pale splinters on the snapped trunk: the fresh break under the char.
    for k, a in enumerate(ring_angles(3, 9)):
        bx, bz = 23.6 + math.cos(a) * 3.0, 25.2 + math.sin(a) * 3.0
        limb(g, (bx, 23.0, bz), (bx + math.cos(a) * 0.8, 26.5 + 1.5 * k, bz + math.sin(a) * 0.8), 0.8, 0.2, "bone", 5, n=4)
    # A burnt log lies on the ash and ends in pale splinters.
    log = limb(g, (29.0, GROUND + 3.0, 54.0), (56.0, GROUND + 2.6, 49.0), 3.4, 2.8, "darkwood", 3, n=6)
    char(g, log, base=4, seed=7)
    P.flat(g, log & (Y < GROUND + 1.0), "darkwood", 5)
    for k in range(3):
        limb(g, (55.5, GROUND + 2.6, 49.0), (59.0 + k, GROUND + 2.0 + k * 1.2, 47.0 + k * 1.5), 1.2, 0.2, "bone", 6, n=4)
    P.flat(g, log & (np.abs(X - 42) < 1.2) & (Y > GROUND + 4), "ember", 3)  # one ember split along the top
    for k, (tx, tz) in enumerate(((8, 16), (34, 54), (64, 42), (36, 9), (63, 8))):
        tuft(g, tx, tz, GROUND, 6, blades=4, spread=3, ramp="khaki", shade=4, seed=10 + k)
    # Teal-green shoots mark the first regrowth after the fire.
    for x0, z0 in ((31, 40), (49, 9), (8, 33)):
        limb(g, (x0, GROUND, z0), (x0 + 1, GROUND + 7, z0 + 1), 1.3, 0.35, "leaf", 5, n=4)
    return make("terrain-nature", "charred-stumps", "Charred Stumps", Part("charred-stumps", g))
