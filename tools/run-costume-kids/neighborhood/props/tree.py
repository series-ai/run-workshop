"""Three bare, twisted spooky trees (concepts/street-scene.png, street-props.png):
a chunky faceted trunk with flared roots, boughs that fork into crooked
pointed twigs, and a few orange / red leaves left at the tips.

Branches are continuous faceted tubes (streetkit.tube) grown by a small seeded
recursive generator, so each tree is a fixed shape. Budget <= 1,500 tris.

    Blender -b -t 1 --factory-startup --python neighborhood/props/tree.py -- neighborhood/renders [slug ...]
"""
import math
import os
import random
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from streetkit import *  # noqa: E402,F403
from mathutils import Matrix, Vector  # noqa: E402

BARK = (0.40, 0.27, 0.19)
BARK_DK = (0.33, 0.22, 0.16)
LEAVES = [(0.93, 0.47, 0.13), (0.82, 0.24, 0.14), (0.95, 0.66, 0.18)]


def bend(d, rng, amount, up=0.0):
    """Turn direction d by a random amount (radians), nudged upward by `up`."""
    axis = d.cross(Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))).normalized()
    d2 = Matrix.Rotation(amount, 3, axis) @ d
    d2.z += up
    return d2.normalized()


def leaf(p, d, rng):
    rgb = rng.choice(LEAVES)
    o = box(p.x + d.x * 0.15, p.y + d.y * 0.15, p.z + d.z * 0.15, 0.85, 0.12, 0.6, rgb,
            rot=(rng.uniform(-0.8, 0.8), rng.uniform(-0.8, 0.8), rng.uniform(0, 3.1)))
    return o


class Tree:
    def __init__(self, seed, leaf_p=0.6):
        self.rng = random.Random(seed)
        self.leaf_p = leaf_p

    def bough(self, p, d, length, r, depth, kids=(2, 3), spread=(0.55, 0.95), segs=3, wobble=0.35, up=0.18):
        """A crooked branch from p along d; forks `depth` more times."""
        rng = self.rng
        pts, radii = [p], [r]
        step = length / segs
        for i in range(segs):
            d = bend(d, rng, rng.uniform(0.1, wobble), up)
            pts.append(pts[-1] + d * step)
            radii.append(r * (1 - 0.3 * (i + 1) / segs))
        tip = depth == 0
        if tip:                                   # twigs end in a crooked point
            radii[-1] = 0.0
        n = 6 if r > 0.45 else 5 if r > 0.2 else 4
        tube(pts, radii, BARK, n=n, tip=tip)
        end = pts[-1]
        if tip:
            if rng.random() < self.leaf_p:
                leaf(end, d, rng)
            return
        nk = rng.randint(*kids)
        base_a = rng.uniform(0, 2 * math.pi)
        for k in range(nk):
            a = base_a + 2 * math.pi * k / nk
            side = Vector((math.cos(a), math.sin(a), 0))
            side = (side - d * side.dot(d)).normalized()
            cd = (d * math.cos(rng.uniform(*spread)) + side * math.sin(rng.uniform(*spread))).normalized()
            cd.z += up * 0.6
            cd.normalize()
            start = end - d * radii[-1] * 1.1
            self.bough(start, cd, length * rng.uniform(0.62, 0.8), max(0.22, radii[-1] * rng.uniform(0.78, 0.88)),
                       depth - 1, kids, spread, max(2, segs - (1 if depth < 3 else 0)), wobble, up)

    def trunk(self, pts, radii, n=7):
        tube([Vector(p) for p in pts], radii, BARK, n=n, tip=False)

    def roots(self, r, count=4, reach=2.0, twist=0.0):
        rng = self.rng
        for k in range(count):
            a = twist + 2 * math.pi * (k + rng.uniform(-0.15, 0.15)) / count
            c, s = math.cos(a), math.sin(a)
            far = reach * rng.uniform(0.8, 1.15)
            tube([(c * r * 0.3, s * r * 0.3, r * 1.4), (c * r * 0.9, s * r * 0.9, r * 0.45),
                  (c * far, s * far, 0.05)], [r * 0.7, r * 0.5, r * 0.22], BARK_DK, n=5, tip=False)


def gnarled():
    """The big one (~18 tall): thick leaning trunk, three boughs that fork twice, like the concept's left tree."""
    t = Tree(7)
    t.roots(1.1, 4, 2.6)
    trunk = [(0, 0, 0), (0.15, 0.05, 2.2), (-0.25, 0.1, 4.4), (0.1, -0.1, 6.6), (0.5, 0, 8.0)]
    t.trunk(trunk, [1.25, 1.0, 0.9, 0.78, 0.7])
    top = Vector(trunk[-1])
    for d, L, r in (((-0.9, 0.1, 0.55), 5.2, 0.5), ((0.7, -0.3, 0.75), 5.6, 0.52), ((0.1, 0.6, 1.0), 4.5, 0.42)):
        t.bough(top - Vector((0, 0, 0.4)), Vector(d).normalized(), L, r * 1.25, 3 if L > 5 else 2, kids=(2, 2))
    t.bough(Vector((0.05, 0.0, 5.0)), Vector((-1, -0.4, 0.45)).normalized(), 3.4, 0.45, 2, kids=(2, 2))


def leaning():
    """Medium (~14): a crooked trunk leaning hard to one side, boughs reaching back over it."""
    t = Tree(23, leaf_p=0.7)
    t.roots(0.95, 3, 2.2, twist=0.6)
    trunk = [(0, 0, 0), (0.4, 0, 2.0), (1.2, 0.1, 3.8), (1.6, -0.1, 5.6), (1.4, 0, 7.0)]
    t.trunk(trunk, [1.05, 0.85, 0.72, 0.62, 0.55], n=6)
    top = Vector(trunk[-1])
    t.bough(top, Vector((-0.6, 0.1, 1)).normalized(), 4.8, 0.6, 3, kids=(2, 2))
    t.bough(top, Vector((0.8, 0.2, 0.7)).normalized(), 3.8, 0.5, 2, kids=(2, 2))
    t.bough(Vector((1.0, 0.05, 3.6)), Vector((-1, -0.3, 0.35)).normalized(), 3.2, 0.45, 2, kids=(2, 2))


def forked():
    """Tall and thin (~16): the trunk splits low into a twisted Y, each arm forking into twigs."""
    t = Tree(41, leaf_p=0.65)
    t.roots(1.0, 4, 2.3, twist=0.3)
    trunk = [(0, 0, 0), (-0.1, 0.05, 1.8), (0.1, 0, 3.6), (0, 0, 4.6)]
    t.trunk(trunk, [1.1, 0.9, 0.8, 0.74])
    top = Vector(trunk[-1])
    t.bough(top, Vector((-0.45, -0.1, 1)).normalized(), 6.5, 0.72, 3, kids=(2, 2), segs=4, up=0.22)
    t.bough(top, Vector((0.5, 0.15, 1)).normalized(), 7.2, 0.74, 3, kids=(2, 2), segs=4, up=0.22)


TREES = {"tree-gnarled": gnarled, "tree-leaning": leaning, "tree-forked": forked}

main_for(TREES, "tree")
