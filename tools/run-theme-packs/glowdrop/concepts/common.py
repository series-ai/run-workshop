"""Glowdrop palette and helpers shared by every board module."""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "shared"))
from kit import *  # noqa: F401,F403,E402
import kit as _k  # noqa: E402
from kit import C, V, at, rng, face  # noqa: E402

# A notch more facets than the kit defaults: chunky, but not crude.
POLY, RING = 1.5, 1.34


def _n(n, lobes=0):
    m = max(3, round(n * POLY))
    if lobes:
        m = lobes * max(2, round(m / lobes))
    return m


def ell(c, r, rgb, seg=8, ring=6, **k):
    return _k.ell(c, r, rgb, seg=_n(seg), ring=max(3, round(ring * RING)), **k)


def lathe(profile, loc, rgb, n=10, **k):
    return _k.lathe(profile, loc, rgb, n=_n(n, k.get("lobes", 0)), **k)


def cyl(r, h, loc, rgb, n=8, **k):
    return _k.cyl(r, h, loc, rgb, n=_n(n), **k)


def cone(r, h, loc, rgb, n=8, **k):
    return _k.cone(r, h, loc, rgb, n=_n(n), **k)


def torus(R, r, loc, rgb, n=12, k=6, **kw):
    return _k.torus(R, r, loc, rgb, n=_n(n), k=max(4, round(k * RING)), **kw)


def tube(ctrl, prof, rgb, rings=10, n=6, **k):
    return _k.tube(ctrl, prof, rgb, rings=round(rings * 1.3), n=_n(n), **k)


def loft(rings, rgb, n=8, **k):
    return _k.loft(rings, rgb, n=_n(n), **k)

# Night bodies: mid-saturated so they still read under moonlight.
INDIGO, TEAL, PLUM, MOSS = C(76, 66, 150), C(40, 112, 140), C(118, 62, 132), C(52, 96, 78)
BARK, STONE, STEM, SAND = C(104, 80, 92), C(96, 102, 132), C(214, 210, 236), C(150, 140, 160)
DEEP, SILVER, ROSE = C(36, 48, 96), C(170, 182, 210), C(196, 92, 140)

# Glows: the emissive accent colours.
CYAN, MINT, MAGENTA, LIME = C(90, 236, 255), C(120, 255, 200), C(255, 110, 220), C(196, 255, 96)
AMBER, LAVENDER, CORAL, ICE = C(255, 196, 92), C(196, 164, 255), C(255, 140, 120), C(214, 240, 255)
EYE = C(24, 20, 34)
BLUSH = C(255, 150, 190)

GLOW = 1.3      # accents
SOFT = 0.35     # whole glowing bodies


_part_stack = []


class part:
    """Tag everything built inside as one animatable part (a bone-like node for
    export). pivot is the joint it turns about, in the current local space.
    Parts nest: a part built inside another becomes its child.

        with part("tail", pivot=(-0.15, 0, 0.3)):
            tail("fork", ...)
    """

    def __init__(self, name, pivot=(0, 0, 0)):
        self.name, self.pivot = name, pivot

    def __enter__(self):
        import bpy
        self.before = set(bpy.data.objects.keys())
        self.world_pivot = _k._xf[-1] @ V(self.pivot)
        self.parent = _part_stack[-1].name if _part_stack else None
        _part_stack.append(self)
        return self

    def __exit__(self, *a):
        import bpy
        _part_stack.pop()
        for name in set(bpy.data.objects.keys()) - self.before:
            o = bpy.data.objects[name]
            if "part" not in o:  # innermost part wins
                o["part"] = self.name
                o["pivot"] = list(self.world_pivot)
                o["parent_part"] = self.parent or ""


def lerp(a, b, t):
    return a + (b - a) * t


def mix(p0, p1, t):
    """Blend two profiles [(r, z), ...] of equal length."""
    return [(lerp(a[0], b[0], t), lerp(a[1], b[1], t)) for a, b in zip(p0, p1)]


def pad(r=0.34, rgb=MOSS, dots=0, glow=MINT, seed=0):
    """The little moss mound every ground-growing thing sits on (shared footprint)."""
    lathe([(r, 0), (r * 0.96, 0.035), (r * 0.72, 0.065), (r * 0.3, 0.075), (0, 0.075)], (0, 0, 0), rgb, n=9)
    R = rng(seed)
    for i in range(dots):
        a = R.uniform(0, 2 * math.pi)
        d = R.uniform(0.45, 0.85) * r
        ell((d * math.cos(a), d * math.sin(a), 0.045), 0.022, glow, seg=6, ring=4, emit=GLOW)


def sparkles(c, n, spread, size, rgb, seed=1, lift=0.0):
    """Floating glowing motes (spores, pollen, bubbles)."""
    R = rng(seed)
    for i in range(n):
        p = V(c) + V(R.uniform(-1, 1) * spread, R.uniform(-1, 1) * spread, R.uniform(0, 1) * spread + lift)
        ell(p, size * R.uniform(0.6, 1.2), rgb, seg=6, ring=4, emit=GLOW * 1.2)


def critter_eyes(c, look=(0.35, -1, 0.1), size=0.04, gap=1.7, blush=False, smile=False):
    """Just a pair of bead eyes: no blush, no smile (style rule: no stuck-on faces)."""
    face(c, look, size=size, gap=gap, blush=None, smile=False, rgb=EYE)


def head_eyes(c, r, fwd=(1, 0, 0), size=None, up=0.25, spread=0.7):
    """Eyes where a real head has them: on the left and right sides, a little forward."""
    f = V(fwd).normalized()
    side = f.cross(V(0, 0, 1)).normalized()
    size = size or r * 0.28
    for s in (-1, 1):
        p = V(c) + f * r * 0.55 + side * s * r * spread + V(0, 0, r * up)
        out = (f * 0.4 + side * s).normalized()
        ell(p, size, EYE, seg=8, ring=6, rough=0.3)
        ell(p + out * size * 0.6 + V(0, 0, size * 0.4), size * 0.32, (1, 1, 1), seg=5, ring=4)
