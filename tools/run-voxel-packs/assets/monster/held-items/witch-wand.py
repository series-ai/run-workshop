"""Witch's wand: a solid blackthorn haft with a violet leather grip, a
shaped grey pommel cap, two violet ring collars, and a big octagonal
toxic-green crystal clasped at the tip by four bone claws in a grey cup.
Every part is one face-connected solid (no loose voxels); the crystal
faces are painted in four tones with bright upper edges and a glowing
point, so its form reads at thumbnail size.
Held-item frame: +X forward (tip), origin = Hand.R joint."""
import numpy as np

from _kit import C, Grid, held, pfx

L = 36
c = 6  # the haft is 2x2, on y and z in [c - 1, c + 1)


def ring(g: Grid, x0: int, x1: int, r: int, col: int) -> None:
    """A square collar r voxels out from the haft axis, its corners cut
    (an octagon-like ring that wraps the haft)."""
    g.box(x0, c - r, c - r + 1, x1, c + r, c + r - 1, col)
    g.box(x0, c - r + 1, c - r, x1, c + r - 1, c + r, col)


def build():
    g = Grid(L, 2 * c + 1, 2 * c + 1)
    X, Y, Z = np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")
    yc, zc = Y + 0.5 - c, Z + 0.5 - c  # voxel centre offsets from the axis
    quad = (yc > 0).astype(int) * 2 + (zc > 0).astype(int)  # which side of the haft
    # the haft: one straight 2x2 solid from the pommel into the crystal cup
    g.box(1, c - 1, c - 1, 23, c + 1, c + 1, C("wood", 4))
    haft = (g.a > 0)
    # wood grain: a slow dark spiral and lit upper faces
    g.a[haft & (X >= 13) & ((X + quad) % 5 == 0)] = C("wood", 3)
    g.a[haft & (X >= 13) & (yc > 0) & ((X + quad) % 5 != 0)] = C("wood", 5)
    # the violet leather grip: a spiral wrap with a dark lower edge
    grip = haft & (X >= 4) & (X < 12)
    g.a[grip] = C("purple", 4)
    g.a[grip & (yc > 0)] = C("purple", 5)
    g.a[grip & ((X + quad) % 4 == 0)] = C("purple", 2)
    # a knot on the haft (attached, one voxel proud)
    g.box(16, c + 1, c - 1, 18, c + 2, c, C("wood", 3))
    g.set(16, c + 1, c - 1, C("wood", 5))
    # the pommel: a grey cap with a dark rim and a bone nub
    ring(g, 1, 4, 2, C("gray", 4))
    g.box(1, c - 2, c - 1, 2, c + 2, c + 1, C("gray", 2)).box(1, c - 1, c - 2, 2, c + 1, c + 2, C("gray", 2))  # dark rim
    g.a[(g.a == C("gray", 4)) & (yc > 1.2)] = C("gray", 6)  # lit top
    g.box(0, c - 1, c - 1, 1, c + 1, c + 1, C("bone", 6))
    g.set(0, c, c - 1, C("bone", 7))
    # two violet collars with a lit top edge
    for x0 in (12, 20):
        ring(g, x0, x0 + 2, 2, C("purple", 5))
        top = (g.a > 0) & (X >= x0) & (X < x0 + 2) & (yc > 1.2)
        bot = (g.a > 0) & (X >= x0) & (X < x0 + 2) & (yc < -1.2)
        g.a[top] = C("purple", 7)
        g.a[bot] = C("purple", 3)
    # the grey cup that holds the crystal
    ring(g, 21, 23, 3, C("gray", 4))
    cup = (g.a > 0) & (X >= 21) & (X < 23) & ((np.abs(yc) > 1.2) | (np.abs(zc) > 1.2))
    g.a[cup & (X == 22)] = C("gray", 6)
    g.a[cup & (yc < -2.2)] = C("gray", 3)
    # the crystal: a big octagonal gem along +X that swells out of the cup
    # and steps down to a point; eight facets, each one painted tone (lit
    # top, dark underside), a glint, and a glowing point
    ay, az = np.abs(yc), np.abs(zc)
    gem = np.zeros(g.shape, dtype=bool)
    for x0, x1, r in ((23, 25, 3), (25, 30, 4), (30, 32, 3), (32, 34, 2), (34, 35, 1)):
        gem |= (X >= x0) & (X < x1) & (ay < r) & (az < r) & (ay + az < 1.4 * r)
    ang = np.degrees(np.arctan2(yc, -zc)) % 360  # 0 = front (-z), 90 = top
    octant = ((ang + 22.5) // 45).astype(int) % 8
    for k, sh in enumerate((3, 4, 5, 4, 2, 1, 1, 2)):
        g.a[gem & (octant == k)] = C("toxic", sh)
    g.a[gem & (X == 29) & (yc < 0)] = C("toxic", 0)  # shadow under the shoulder
    g.a[gem & (X == 25) & ((ay >= 3) | (az >= 3) | (ay + az >= 4.2))] = C("toxic", 1)  # dark rim where it swells out
    g.a[gem & (X >= 26) & (X <= 28) & (yc > 2) & (yc < 4) & (zc < 0) & (zc > -2)] = C("toxic", 7)  # glint
    g.a[gem & (X >= 33)] = C("toxic", 6)  # glowing point
    g.a[gem & (X >= 30) & (X < 32) & (octant == 2)] = C("toxic", 6)
    # four bone claws from the cup, gripping the gem's flanks
    for axis, s in (("y", 1), ("y", -1), ("z", 1), ("z", -1)):
        for x0, x1, off in ((22, 25, 3), (24, 28, 4)):
            lo, hi = (c + off, c + off + 1) if s > 0 else (c - off - 1, c - off)
            if axis == "y":
                g.box(x0, lo, c - 1, x1, hi, c + 1, C("bone", 6))
            else:
                g.box(x0, c - 1, lo, x1, c + 1, hi, C("bone", 6))
    claws = ((g.a // 8) == (C("bone", 0) // 8)) & (X >= 22)
    g.a[claws & (X == 27)] = C("bone", 7)  # claw tips
    g.a[claws & (X == 24)] = C("bone", 4)  # knuckle line
    return held("witch-wand", "Witch's Wand", g, (7, c, c), {"socket-tip": (32, c, c)},
                pfx=[pfx("rvx-monster-curse-cloud", "socket-tip", "manual", size=0.35)])
