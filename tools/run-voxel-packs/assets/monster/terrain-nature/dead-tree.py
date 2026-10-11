"""Dead oak, in the Pirate Nation haunted style.

After PN environment-3x3-spookytree: a tall twisted trunk of angled
hexagonal segments (sheared frustums, true slopes) on a flared root base
and a small dirt mound with moss. Four big clawing branches of square
bars end in curled spiral tips; the trunk tip curls too. A knot burl on
the front carries a painted hollow face with two glowing toxic eyes. One
iconic accent: a toxic-green lantern that hangs on a chain from the right
branch. Bark is painted purple-grey (never near-black). About 86 tall.
Faces -Z.
"""
import math

import numpy as np

import paint as P
from _kit import single
from _life import coords, front, last, moss_top, plan, quad, side, slope_paint, stamp
import pnshapes
from voxgrid import C, Grid

S = (64, 92, 44)
CX, CZ = 30.0, 22.0
BARK = "purple"
BASE = 5


def bark(g, mask, frame):
    """Soft bark: vertical strips of +-1 shade with a few short dark
    furrows (no busy seams, rule S3)."""
    U, V = P.uv(g, frame)
    strip = U // 3
    shade = BASE + P._jitter(P._hash(strip, (V + (P._hash(strip, seed=4) % np.uint64(7)).astype(np.int64)) // 7, seed=3))
    furrow = (U % 3 == 0) & ((P._hash(strip, V // 4, seed=5) % np.uint64(3)) == 0)
    shade = np.where(furrow, BASE - 1, shade)
    P._paint(g, mask, BARK, shade)


def spiral(p, ang, lengths, turn):
    """Points of a square-ish spiral: start at p heading `ang` degrees,
    each segment `lengths[k]` long, turning `turn` degrees after each."""
    pts = [p]
    a = ang
    for ln in lengths:
        x, y = pts[-1]
        pts.append((x + ln * math.cos(math.radians(a)), y + ln * math.sin(math.radians(a))))
        a += turn
    return pts


def bars(g, axis, pts, radii, lo, hi):
    """A chain of thick faceted segments through pts (in the plane across
    `axis`), extruded over [lo, hi). Returns the solids it added."""
    start = len(g.solids)
    for k, (p0, p1) in enumerate(zip(pts, pts[1:])):
        g.prism(axis, quad(p0, p1, radii[k], radii[k + 1], cap=0.7), lo, hi, C(BARK, BASE))
    return g.solids[start:]


def build():
    g = Grid(*S)
    X, Y, Z = coords(g)
    solids = []

    # dirt mound: a low faceted frustum with painted clods and moss
    ring = [(CX + 13 * math.cos(a) * (1.0 + 0.12 * math.sin(3 * a)), CZ + 10.5 * math.sin(a) * (1.0 + 0.1 * math.cos(2 * a))) for a in np.linspace(0, 2 * math.pi, 9)[:-1]]
    top = [(CX + (x - CX) * 0.72, CZ + (z - CZ) * 0.72) for x, z in ring]
    mound = plan(g, ring, 0, 3, "skindark", 3, top=top)
    P.mottle(g, mound, "skindark", 3, cell=2, seed=1)
    moss_top(g, mound, depth=1, seed=2)
    P.flat(g, mound & ((P._hash(np.floor(X).astype(int) // 2, np.floor(Z).astype(int) // 2, seed=5) % np.uint64(9)) == 0) & (Y > 2), "stone", 6)

    # flared roots: plan wedges that slope down and out from the trunk foot
    for ang, ln, h in ((200, 12, 8), (-35, 11, 7), (95, 9, 6), (150, 10, 7), (20, 12, 8), (-100, 8, 6)):
        a = math.radians(ang)
        dx, dz = math.cos(a), math.sin(a)
        nx, nz = -dz, dx
        root = [(CX + dx * 2 + nx * 2.8, CZ + dz * 2 + nz * 2.8), (CX + dx * ln + nx * 0.8, CZ + dz * ln + nz * 0.8),
                (CX + dx * (ln + 1.2), CZ + dz * (ln + 1.2)), (CX + dx * ln - nx * 0.8, CZ + dz * ln - nz * 0.8),
                (CX + dx * 2 - nx * 2.8, CZ + dz * 2 - nz * 2.8)]
        rtop = [(CX + (x - CX) * 0.35, CZ + (z - CZ) * 0.35) for x, z in root]
        plan(g, root, 1, 1 + h, BARK, BASE, top=rtop)
        solids.append(g.solids[-1])

    # the trunk: stacked sheared hexagonal frustums that zigzag left and right
    path = [(CX, 0, CZ), (CX + 0.6, 9, CZ), (CX - 2.0, 22, CZ + 0.4), (CX + 2.2, 36, CZ - 0.3), (CX - 1.6, 50, CZ + 0.3), (CX + 2.2, 62, CZ), (CX + 0.4, 71, CZ)]
    radii = [8.0, 5.8, 5.2, 4.3, 3.5, 2.8, 2.2]
    for k, ((p0, r0), (p1, r1)) in enumerate(zip(zip(path, radii), zip(path[1:], radii[1:]))):
        turn = 0.35 * k
        hexa = lambda cx, cz, r: [(cx + r * math.cos(turn + math.pi * j / 3), cz + r * math.sin(turn + math.pi * j / 3)) for j in range(6)]  # noqa: E731
        plan(g, hexa(p0[0], p0[2], r0), p0[1], p1[1], BARK, BASE, top=hexa(p1[0], p1[2], r1))
        solids.append(g.solids[-1])

    thin = [1.2, 1.1, 1.0, 1.0, 1.0, 1.0]
    # the trunk tip: a zigzag up, then a big square spiral
    tip = [(CX + 0.4, 69.0), (CX + 3.5, 75.0), (CX + 0.5, 80.0)] + spiral((CX + 0.5, 80.0), 90, [7.0, 5.5, 4.2, 2.8], -90)[1:]
    solids += bars(g, "z", tip, [2.0, 1.6, 1.3] + thin, CZ - 1.5, CZ + 1.5)

    # big clawing branches (square bars in the front plane) that jut out
    # sideways in zigzags and end in curled spiral tips (PN spooky tree)
    lb = [(CX - 2, 36.0), (CX - 10, 37.5), (CX - 12, 44.0), (CX - 19, 46.0)] + spiral((CX - 19, 46.0), 95, [6.5, 5.0, 3.8, 2.6], -90)[1:]
    solids += bars(g, "z", lb, [2.3, 1.9, 1.6, 1.3] + thin, CZ - 1.5, CZ + 1.5)
    rb = [(CX + 2, 45.0), (CX + 14, 47.0), (CX + 15, 53.0), (CX + 20, 56.0)] + spiral((CX + 20, 56.0), 85, [6.5, 5.0, 3.8, 2.6], 90)[1:]
    solids += bars(g, "z", rb, [2.3, 1.9, 1.6, 1.3] + thin, CZ - 1.5, CZ + 1.5)
    hb = [(CX - 1, 57.0), (CX - 7, 59.0), (CX - 9, 65.0)] + spiral((CX - 9, 65.0), 180, [5.5, 4.2, 3.2, 2.2], -90)[1:]
    solids += bars(g, "z", hb, [1.9, 1.5, 1.3] + thin, CZ - 1.5, CZ + 1.5)
    # a branch reaching back (side plane) for depth
    bb = [(40.0, CZ), (46.0, CZ + 9), (51.0, CZ + 11)] + spiral((51.0, CZ + 11), 90, [6.0, 4.6, 3.4, 2.2], -90)[1:]
    start = len(g.solids)
    radii_b = [2.0, 1.6, 1.3] + thin
    for k, (p0, p1) in enumerate(zip(bb, bb[1:])):
        g.prism("x", quad(p0, p1, radii_b[k], radii_b[k + 1], cap=0.7), CX - 1.5, CX + 1.5, C(BARK, BASE))
    solids += g.solids[start:]

    # the knot burl on the front: an octagonal slab with a painted hollow face
    burl_z = CZ - 6.0
    burl = front(g, [(CX - 6, 24), (CX - 4, 21.5), (CX + 4, 21.5), (CX + 6, 24), (CX + 6, 31), (CX + 4, 33.5), (CX - 4, 33.5), (CX - 6, 31)], burl_z, CZ, BARK, BASE)
    solids.append(g.solids[-1])

    slope_paint(g, solids, bark)
    P.flat(g, burl, BARK, BASE + 1)
    P.outline(g, burl, BARK, BASE - 1, normal="z")
    # soft light on the upper trunk, a shade darker near the ground
    wood = np.logical_or.reduce([s.mask(g.shape) for s in solids])
    P.darken(g, wood & (Y < 8) & ((P._hash(np.floor(X + Z).astype(int), np.floor(Y).astype(int) // 2, seed=9) % np.uint64(3)) != 0))

    face = [
        "..rrrrrrr..",
        ".rhhhhhhhr.",
        "rhwgghwgghr",
        "rhggghggghr",
        "rhhgghhgghr",
        "rhhhhhhhhhr",
        "rhhmhmhmhhr",
        ".rhhmhmhhr.",
        "..rrrrrrr..",
    ]
    legend = {"r": C(BARK, 6), "h": C("purple", 1), "g": C("toxic", 6), "w": C("toxic", 7), "m": C("toxic", 5)}
    stamp(g, "-z", int(burl_z), int(CX - 5.5), 23, face, legend, depth=3)

    # the accent: a hanging toxic lantern on a chain from the right branch
    lx, lz = int(CX + 12), int(CZ)
    lan = pnshapes.lantern(g, lx, 25, lz, s=6, body=8, glass="toxic", roof="purple", frame="wood", seed=4)
    for k, y in enumerate(range(lan["top"] - 1, 46, 2)):  # links that turn 90 degrees each step
        if k % 2:
            g.box(lx - 1, y, lz, lx + 1, y + 2, lz + 1, C("gray", 5))
        else:
            g.box(lx, y, lz - 1, lx + 1, y + 2, lz + 1, C("gray", 6))
    return single("dead-tree", "terrain-nature", "Dead Oak", g)
