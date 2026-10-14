"""Disco snail: a glittery mirror-ball shell on the kid's back, faceted in
silver, lilac and purple, with sparkle glints flying off it; snail eye-stalks
on a sparkly pink headband; a purple sequinned bell-bottom suit with a huge
white disco collar and a gold medallion; gold platform shoes; a little
glittery snail tail trailing behind. One mitt is flung up in a disco pose,
the other carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import random
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

SUIT, SUIT_D, SEQUIN, BAND = (0.6, 0.28, 0.9), (0.45, 0.18, 0.72), (0.9, 0.85, 1.0), (1.0, 0.4, 0.75)
GOLD, PLATFORM, COLLAR, HAIR = (1.0, 0.8, 0.2), (1.0, 0.4, 0.75), (0.99, 0.98, 0.96), (0.3, 0.17, 0.09)
FACETS = [(0.88, 0.9, 0.96), (0.72, 0.75, 0.84), (0.98, 0.98, 1.0), (0.6, 0.38, 0.92), (0.8, 0.66, 1.0), (0.55, 0.58, 0.68)]
STALK = (0.75, 0.55, 0.95)


def mirror_ball(x, y, z, d):
    """A faceted disco ball: every face a random silver or purple tile."""
    o = ball(x, y, z, d, d, d, FACETS[0], seg=20, ring=12)
    for c in FACETS[1:]:
        o.data.materials.append(mat(c))
    rnd = random.Random(5)
    for p in o.data.polygons:
        p.material_index = rnd.choice((0, 0, 1, 2, 3, 4, 5, 1))
    return o


def sparkle(x, y, z, r, rgb=WHITE):
    box(x, y, z, r * 2, 0.05, r * 0.35, rgb)
    box(x, y, z, r * 0.35, 0.05, r * 2, rgb)
    box(x, y, z, 0.05 + r * 0.3, r * 2, r * 0.35, rgb)
    ball(x, y, z, r * 0.6, r * 0.6, r * 0.6, rgb, seg=4, ring=2)


def build():
    body(shirt=SUIT, pants=SUIT, leg_colour=SUIT, shoe=GOLD, arms=False)
    for s in (-1, 1):
        fx = s * TW * 0.24
        box(fx, -FOOT * 0.25, 0.08, FOOT * 0.82, FOOT * 1.2, 0.16, PLATFORM, bevel=0.04)       # platform soles
        can(fx, 0, 0.42, 0.33, 0.36, SUIT, n=8, r2=0.14)                                        # bell bottoms
        for k in range(4):
            a = k * math.pi / 2 + 0.4
            ball(fx + 0.27 * math.cos(a), 0.27 * math.sin(a), 0.3, 0.07, 0.07, 0.07, SEQUIN, seg=4, ring=3)
    fy = -TD * 0.5
    # sequins on the suit
    rnd = random.Random(2)
    for i in range(14):
        ball(rnd.uniform(-0.4, 0.4), fy - 0.02, rnd.uniform(HIP + 0.05, TOP - 0.1), 0.07, 0.04, 0.07, SEQUIN, seg=4, ring=3)
    # the huge white disco collar points and the gold medallion
    for s in (-1, 1):
        can(s * 0.3, fy - 0.03, TOP - 0.2, 0.32, 0.05, COLLAR, n=3, rot=(math.radians(90), 0, math.radians(180 + s * 25)))
    limb((-0.15, fy - 0.06, TOP - 0.05), (0, fy - 0.07, TOP - 0.45), 0.025, GOLD)
    limb((0.15, fy - 0.06, TOP - 0.05), (0, fy - 0.07, TOP - 0.45), 0.025, GOLD)
    can(0, fy - 0.08, TOP - 0.52, 0.14, 0.05, GOLD, n=8, rot=(math.radians(90), 0, 0))
    # the right arm strikes the disco point, the left carries the bucket
    sx = TW * 0.5 + 0.08
    rh = (1.75, -0.25, 3.0)
    limb((sx, 0, TOP - 0.15), rh, 0.12, SUIT)
    ball(sx + 0.55, -0.1, TOP + 0.3, 0.28, 0.28, 0.28, SUIT, seg=8, ring=6)
    hand_mitt(*rh, 1, MITT, SKIN)
    limb((-sx, 0, TOP - 0.15), (-sx - 0.16, -0.05, TOP - ARM_DROP), 0.12, SUIT)
    lh = hand_points()[-1]
    hand_mitt(*lh, -1, MITT, SKIN)
    bucket(lh, full=True, size=0.62)
    # the shell straps over the shoulders
    for s in (-1, 1):
        box(s * 0.32, 0, TOP - 0.02, 0.18, TD + 0.08, 0.1, SUIT_D)
    # the glittery snail tail trailing behind on the ground
    box(0, 1.35, 0.17, 0.95, 2.2, 0.34, SUIT_D, bevel=0.15, segs=2)
    box(0, 2.6, 0.11, 0.6, 0.7, 0.22, SUIT_D, bevel=0.1, segs=2)
    for k in range(5):
        ball(-0.3 + 0.15 * k, 1.0 + 0.35 * k, 0.36, 0.08, 0.08, 0.08, SEQUIN, seg=4, ring=3)
    # the kid's head with a sparkly headband and eye stalks
    kid_head(hair=HAIR)
    w = HEAD
    box(0, 0.05, HEAD_Z + w * 0.2, w * 1.07, w * 1.0, 0.2, BAND, bevel=0.06)
    for s in (-1, 1):
        base = (s * 0.55, -0.1, HEAD_Z + w * 0.48)
        tip = (s * 0.95, -0.35, HEAD_Z + w * 0.48 + 1.15)
        limb(base, tip, 0.1, STALK, n=8)
        ball(*base, 0.34, 0.34, 0.2, BAND, seg=8, ring=5)
        ball(*tip, 0.5, 0.5, 0.5, WHITE, seg=10, ring=7)
        ball(tip[0] + s * 0.02, tip[1] - 0.2, tip[2] + 0.02, 0.24, 0.12, 0.26, DARK, seg=8, ring=5)
        ball(tip[0] - 0.04, tip[1] - 0.26, tip[2] + 0.08, 0.07, 0.04, 0.07, WHITE, seg=6, ring=4)
    # the mirror-ball shell on the back, with a hanging hook ring and glints
    cx, cy, cz, d = 0, 1.5, 2.7, 3.3
    mirror_ball(cx, cy, cz, d)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.18, minor_radius=0.05, major_segments=10, minor_segments=4,
                                     location=(cx, cy, cz + d / 2 + 0.12), rotation=(0, math.radians(90), 0))
    finish(bpy.context.object, (0.72, 0.75, 0.84))
    for (x, y, z, r) in ((-2.0, 1.2, 4.2, 0.22), (1.95, 1.7, 4.4, 0.18), (-2.15, 1.0, 2.1, 0.16), (2.1, 1.4, 1.5, 0.2), (0.9, 2.2, 4.75, 0.15)):
        sparkle(x, y, z, r)


if __name__ == "__main__" or True:
    render_costume("disco-snail", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
