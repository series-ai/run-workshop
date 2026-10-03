"""Weeping willow of the marsh, in the Pirate Nation haunted style.

After PN deco-tree-zombie: a leaning split trunk (two twisting stacks of
sheared hexagonal frustums, true slopes) with mossy bark, on flared roots
in a small dark-teal pool with a mud and stone rim and lily pads. Above
the fork, a domed crown of big chamfered leaf clumps (faceted beads in
moss, khaki and teal greys) and long drooping curtains of fronds: thin
slabs that slope out from the crown and hang down past a person's head,
with ragged pointed ends. Parts: willow (root: pool, roots, trunk) and
crown (boughs, clumps and curtains) that sways on idle. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnpaint
from _kit import keys, world
from _life import assemble, chunk, coords, moss_top, plan, quad, slope_paint
from voxgrid import C, Clip, Grid

S = (80, 90, 72)
CX, CZ = 40.0, 36.0
FORK = (CX + 1.0, 44.0, CZ)
BARK = "wood"


def bark(g, mask, frame):
    U, V = P.uv(g, frame)
    strip = U // 3
    shade = 4 + P._jitter(P._hash(strip, V // 6, seed=3))
    shade = np.where((U % 3 == 0) & ((P._hash(strip, V // 4, seed=5) % np.uint64(3)) == 0), 3, shade)
    P._paint(g, mask, BARK, shade)


def leafy(ramp, base, seed):
    """Leaf-scale painter for a facet: overlapping rows of leaves with a
    darker lower lip (like PN leaf blocks), soft +-1 ramp."""
    def paint(g, mask, frame):
        U, V = P.uv(g, frame)
        h = P._hash(U // 2, V // 2, seed=seed) % np.uint64(9)
        shade = np.where(h == 0, base + 1, np.where(h == 1, base - 1, base))
        lip = (V % 4 == 3) & ((P._hash(U // 3, V // 4, seed=seed + 1) % np.uint64(3)) == 0)
        P._paint(g, mask, ramp, np.where(lip, base - 1, shade))
    return paint


def hexa(cx, cz, r, turn):
    return [(cx + r * math.cos(turn + math.pi * j / 3), cz + r * math.sin(turn + math.pi * j / 3)) for j in range(6)]


def stem(g, path, radii, turn0):
    start = len(g.solids)
    for k, ((p0, r0), (p1, r1)) in enumerate(zip(zip(path, radii), zip(path[1:], radii[1:]))):
        t = turn0 + 0.4 * k
        plan(g, hexa(p0[0], p0[2], r0, t), p0[1], p1[1], BARK, 4, top=hexa(p1[0], p1[2], r1, t))
    return g.solids[start:]


def willow() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    # the pool: a low mud mound, its top painted as dark-teal water inside a
    # ragged mud and stone rim
    ring = [(CX + 22 * math.cos(a) * (1 + 0.1 * math.sin(3 * a + 1)), CZ + 18 * math.sin(a) * (1 + 0.08 * math.cos(2 * a))) for a in np.linspace(0, 2 * math.pi, 11)[:-1]]
    top = [(CX + (x - CX) * 0.9, CZ + (z - CZ) * 0.9) for x, z in ring]
    pool = plan(g, ring, 0, 2, "skindark", 3, top=top)
    P.mottle(g, pool, "skindark", 3, cell=2, seed=1)
    dx, dz = (X + 0.5 - CX) / 17.0, (Z + 0.5 - CZ) / 13.5
    ang = np.arctan2(dz, dx)
    water = pool & (Y == 1) & (dx ** 2 + dz ** 2 < (1 + 0.08 * np.sin(5 * ang)) ** 2)
    P.flat(g, water, "teal", 3)
    ripple = water & (np.abs(np.hypot(dx, dz) * 6 % 2 - 1) < 0.12) & ((P._hash(np.floor(ang * 5).astype(int), seed=2) % np.uint64(2)) == 0)
    P.flat(g, ripple, "teal", 5)
    shore = pool & (Y == 1) & ~water
    moss_top(g, shore, depth=1, seed=3)
    # rim stones and lily pads (a magenta flower on one)
    for k, (a, r, s) in enumerate(((0.5, 1.0, 3.0), (2.2, 0.98, 2.5), (3.4, 1.0, 3.5), (4.6, 0.95, 2.6), (5.6, 1.0, 2.2))):
        sx, sz = CX + 18.5 * r * math.cos(a), CZ + 15 * r * math.sin(a)
        oct8 = [(sx + s * math.cos(t), sz + s * math.sin(t)) for t in np.linspace(0.3, 0.3 + 2 * math.pi, 9)[:-1]]
        st = plan(g, oct8, 1, 3 + (k % 2), "gray", 5, top=[(sx + (x - sx) * 0.55, sz + (z - sz) * 0.55) for x, z in oct8])
        P.flat(g, st & (Y >= 3), "gray", 6)
    for k, (px, pz) in enumerate(((CX - 11, CZ - 7), (CX + 9, CZ - 9), (CX + 12, CZ + 6))):
        pad = plan(g, [(px + 2.6 * math.cos(t), pz + 2.6 * math.sin(t)) for t in np.linspace(0.6, 0.6 + 2 * math.pi * 0.85, 8)] + [(px, pz)], 2, 3, "moss", 6)
        if k == 1:
            g.box(int(px), 3, int(pz), int(px) + 2, 4, int(pz) + 2, C("magenta", 6))
    # flared roots that slope down into the water
    for ang_d, ln, h in ((200, 11, 7), (-40, 10, 6), (100, 8, 6), (150, 9, 6), (15, 11, 7), (-100, 8, 5)):
        a = math.radians(ang_d)
        ux, uz = math.cos(a), math.sin(a)
        nx, nz = -uz, ux
        root = [(CX + ux * 2 + nx * 3, CZ + uz * 2 + nz * 3), (CX + ux * ln + nx, CZ + uz * ln + nz), (CX + ux * (ln + 1.5), CZ + uz * (ln + 1.5)),
                (CX + ux * ln - nx, CZ + uz * ln - nz), (CX + ux * 2 - nx * 3, CZ + uz * 2 - nz * 3)]
        plan(g, root, 1, 1 + h, BARK, 4, top=[(CX + (x - CX) * 0.35, CZ + (z - CZ) * 0.35) for x, z in root])
        slope_paint(g, [g.solids[-1]], bark)
    # the split trunk: two stems that lean and twist around each other
    a = stem(g, [(CX - 4, 1, CZ), (CX - 2.5, 14, CZ + 1), (CX + 2.5, 28, CZ), (CX + 5, 40, CZ - 1), (CX + 4, 46, CZ - 1)], [6.0, 4.4, 3.8, 3.2, 3.0], 0.2)
    b = stem(g, [(CX + 4, 1, CZ), (CX + 3, 12, CZ - 1), (CX - 1, 26, CZ), (CX - 3, 38, CZ + 1), (CX - 2, 46, CZ + 1)], [5.2, 3.8, 3.4, 3.0, 2.8], 0.7)
    slope_paint(g, a + b, bark)
    wood = np.logical_or.reduce([s.mask(g.shape) for s in a + b])
    # moss creeping up the bark on the north side, a shade lighter above
    creep = wood & (Z >= CZ) & (Y < 20 + 6 * np.sin(X * 0.7)) & ((P._hash(X // 2, Y // 3, seed=7) % np.uint64(3)) != 0)
    P.flat(g, creep, "moss", 5)
    pnpaint.blotch(g, creep, "moss", 6, cell=2, chance=0.2, seed=8)
    return g


CLUMPS = [  # (cx, cz, y0, ym, y1, hx, hz, ramp, base)
    (CX + 1, CZ, 50, 58, 70, 18, 15, "moss", 5),
    (CX - 2, CZ + 1, 66, 71, 81, 12, 10, "khaki", 4),
    (CX - 18, CZ - 1, 50, 55, 64, 10, 10, "khaki", 4),
    (CX + 20, CZ + 2, 48, 53, 62, 10, 9, "moss", 6),
    (CX + 3, CZ - 15, 50, 54, 63, 11, 7, "khaki", 5),
    (CX - 4, CZ + 16, 52, 56, 66, 12, 7, "teal", 4),
    (CX + 12, CZ - 7, 62, 66, 74, 8, 7, "moss", 6),
    (CX - 12, CZ + 5, 60, 64, 72, 8, 7, "khaki", 5),
]


def crown() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    # boughs from the fork up into the clumps (true slopes)
    boughs = []
    for p0, p1, r in (((CX + 4, 44), (CX + 14, 58), 2.4), ((CX - 2, 44), (CX - 13, 57), 2.4), ((CX + 1, 44), (CX, 62), 2.6)):
        g.prism("z", quad(p0, p1, r, r * 0.8, cap=0.6), CZ - 2, CZ + 2, C(BARK, 4))
        boughs.append(g.solids[-1])
    slope_paint(g, boughs, bark)
    # the domed crown: chamfered leaf beads (a flared lower frustum and a
    # tapered upper one), each a little off-centre and leaning
    for k, (cx, cz, y0, ym, y1, hx, hz, ramp, base) in enumerate(CLUMPS):
        start = len(g.solids)
        chunk(g, cx, cz, y0, ym, hx - 4, hz - 4, 3.0, ramp, base, taper=-4.0)
        chunk(g, cx, cz, ym, y1, hx, hz, 4.5, ramp, base, taper=4.5, lean=(0.8 * (k % 3 - 1), 0.6))
        solids = g.solids[start:]
        slope_paint(g, solids, leafy(ramp, base, 10 + k))
        m = np.logical_or.reduce([s.mask(g.shape) for s in solids])
        # a darker underside and a sunlit crown (soft ramps)
        P.darken(g, m & (Y < ym - 1))
        moss_top(g, m & (Y > ym + 2), depth=1, ramp=ramp, shade=min(7, base + 1), seed=20 + k)
    # drooping curtains of fronds: thin slabs that slope out from the rim
    # of the crown and hang down, split into strands of different lengths
    rng = np.random.default_rng(134)
    strands = []
    for side in ("-z", "+z", "-x", "+x"):
        span = range(-18, 19, 5) if side[1] == "z" else range(-14, 15, 5)
        for k, off in enumerate(span):
            top_y = 58 - abs(off) * 0.25
            drop = float(rng.integers(22, 36))
            out0 = (15 if side[1] == "z" else 21) - abs(off) * 0.2
            out1 = out0 + 5 + rng.random() * 2
            sgn = -1 if side[0] == "-" else 1
            ramp = ("khaki", "moss", "teal")[k % 3]
            shade = (4, 5, 3)[k % 3]
            # the strand's side profile: a 2-thick slab from the rim, down
            # and out, to a pointed tip
            prof = [(top_y, out0), (top_y, out0 + 2.2), (top_y - drop * 0.55, out1 + 1.6), (top_y - drop, out1 + 0.6), (top_y - drop + 2.5, out1 - 0.8), (top_y - drop * 0.55, out1 - 0.6)]
            w = 3 + (k % 2)
            if side[1] == "z":
                pts = [(y, CZ + sgn * o) for y, o in prof]
                g.prism("x", pts, CX + off, CX + off + w, C(ramp, shade))
            else:
                pts = [(CX + sgn * o, y) for y, o in prof]
                g.prism("z", pts, CZ + off, CZ + off + w, C(ramp, shade))
            strands.append((g.solids[-1], ramp, shade, top_y - drop))
    for solid, ramp, shade, tip in strands:
        m = solid.mask(g.shape)
        U, V = X + Z, Y
        streak = (U % 3 == 0)
        P._paint(g, m, ramp, np.where(streak, shade - 1, shade))
        P.flat(g, m & (Y < tip + 4), ramp, min(7, shade + 1))  # pale frond tips
    return g


def build():
    root = assemble({"willow": willow(), "crown": crown()}, [
        ("willow", None, (CX, 0.0, CZ)),
        ("crown", "willow", FORK),
    ])
    idle = {"crown": {"rot": keys((0, (0, 0, 0)), (1.25, (1.5, 0, 2.0)), (2.5, (0, 0, 3.0)), (3.75, (-1.5, 0, 1.0)), (5.0, (0, 0, 0)))}}
    return world("weeping-willow", "terrain-nature", "Weeping Willow", root, clips=[Clip("idle", idle)])
