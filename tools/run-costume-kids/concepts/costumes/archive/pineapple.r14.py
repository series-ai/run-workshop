"""Pineapple: a big rounded-cube pineapple body suit in golden yellow,
criss-crossed with a diamond pattern of brown ridges and little green-brown
eyes in each diamond. The kid's own head shows, wearing a snug pineapple-skin
cap from which a HUGE spiky crown of green leaves bursts upward and outward,
two shades of green, the tallest leaves in the middle. Yellow sleeves, mitts
out the sides, the right one holding the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

PINE, PINE_D, RIDGE, EYE = (1.0, 0.8, 0.22), (0.92, 0.66, 0.15), (0.72, 0.45, 0.12), (0.5, 0.36, 0.12)
LEAF, LEAF_D, LEAF_L = (0.3, 0.72, 0.28), (0.18, 0.55, 0.22), (0.5, 0.85, 0.35)
HEAD_TOP = HEAD_Z + HEAD * 0.45


def leaf(base, length, width, tilt, az, rgb, flat=0.32):
    """A spiky leaf: a flattened 4-sided cone from `base`, tipped `tilt`
    radians from upright towards azimuth `az`, flat face outwards."""
    d = (math.sin(tilt) * math.cos(az), math.sin(tilt) * math.sin(az), math.cos(tilt))
    c = tuple(b + di * length / 2 for b, di in zip(base, d))
    o = can(*c, width, length, rgb, n=4, r2=0.0, rot=(0, tilt, az))
    o.scale = (flat, 1.0, 1.0)
    return o


def diamonds(w, d, z0, z1, size=0.5):
    """The pineapple skin on the front and side faces of the suit box: staggered
    rows of raised diamond scales, each with a brown rim and a little eye."""
    q = size / math.sqrt(2)
    for face_ in ("front", "left", "right"):
        span = (w if face_ == "front" else d) - 0.7
        nu = int(span / size)
        row = 0
        z = z0
        while z <= z1:
            off = 0.5 * size if row % 2 else 0.0
            for i in range(-nu, nu + 1):
                u = i * size + off
                if abs(u) > span / 2:
                    continue
                for c, sz_, dy in ((RIDGE, q, 0.0), (PINE_D, q - 0.07, 0.03), (EYE, 0.1, 0.06)):
                    if face_ == "front":
                        box(u, -d / 2 - 0.02 - dy, z, sz_, 0.06, sz_, c, rot=(0, math.radians(45), 0))
                    else:
                        sx = -1 if face_ == "left" else 1
                        box(sx * (w / 2 - 0.015 + dy), u, z, 0.04, sz_, sz_, c, rot=(math.radians(45), 0, 0))
            row += 1
            z += size * 0.5


def build():
    body(shirt=PINE, pants=PINE, leg_colour=LEAF_D, shoe=(0.35, 0.22, 0.1), torso=False, arms=False)
    # the pineapple suit: a big rounded cube round the body, every diamond scale on it
    w, d, z0, z1 = 3.0, 2.5, 0.38, 2.05
    with part("body"):
        box(0, 0, (z0 + z1) / 2, w, d, z1 - z0, PINE, bevel=0.45, segs=3)
        box(0, 0, z0 + 0.02, w - 0.4, d - 0.4, 0.1, PINE_D, bevel=0.04)
        diamonds(w, d, z0 + 0.4, z1 - 0.2)
    # sleeves; the right mitt holds the bucket
    for s in (-1, 1):
        side = "l" if s > 0 else "r"
        hand = (s * 1.95, -0.35, 1.05)
        with part(f"hand.{side}"):  # a stub sleeve out of the suit: it flaps with its mitt (an arm tag would swing it inside the suit)
            limb((s * 1.4, -0.1, 1.4), hand, 0.13, PINE)
            hand_mitt(*hand, s, MITT, SKIN)
    bucket((1.95, -0.35, 1.05), full=True, size=0.68)
    # the head with a pineapple-skin cap
    kid_head(hair=PINE_D)
    with part("head"):
        for x in (-0.75, 0.0, 0.75):
            box(x, -HEAD * 0.44, HEAD_Z + HEAD * 0.4, 0.14, 0.06, 0.14, RIDGE, rot=(0, math.radians(45), 0))
        # the crown: a leafy rosette on the cap, bursting into a huge spiky fan
        zc = HEAD_TOP + 0.05
        can(0, 0.05, zc + 0.1, 0.9, 0.4, LEAF_D, n=8, r2=0.6)
        ring = [  # (count, tilt deg, length, width, colour, azimuth offset)
            (9, 64, 2.4, 0.85, LEAF_D, 0.0),
            (8, 42, 3.2, 0.8, LEAF, 0.35),
            (6, 22, 3.9, 0.75, LEAF_L, 0.1),
            (4, 8, 4.4, 0.7, LEAF, 0.8),
        ]
        for n, tilt, L, wd, c, off in ring:
            for k in range(n):
                az = 2 * math.pi * k / n + off
                leaf((0.3 * math.cos(az), 0.05 + 0.3 * math.sin(az), zc + 0.15), L, wd, math.radians(tilt), az, c)
        leaf((0, 0.05, zc + 0.2), 4.9, 0.5, 0.0, 0.0, LEAF_L)

if __name__ == "__main__" or True:
    render_costume("pineapple", build, sys.argv[sys.argv.index("--") + 1], ortho=10.5, target_z=4.3)
