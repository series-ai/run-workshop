"""Traffic cone: the kid wears a giant traffic cone as a hat, its square
base sitting on the kid's head like a mortarboard and the cone towering way
up with two white reflective bands and a dark hollow tip. The body is a
little cone too: an orange flared cone dress with a white band, standing on
its own square base round the shoes. Orange sleeves, mitts out the sides,
the right one with the full bucket. The kid's own head and face show."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import _bucket

ORANGE, ORANGE_D, STRIPE, HOLE = (1.0, 0.45, 0.08), (0.86, 0.32, 0.04), (0.97, 0.97, 0.95), (0.25, 0.1, 0.04)
HAIR = (0.3, 0.17, 0.09)
HEAD_TOP = HEAD_Z + HEAD * 0.5 + 0.1


def cone(z0, z1, r0, r1, bands, n=16):
    """A cone from (z0, r0) to (z1, r1) with white bands [(za, zb)]."""
    r_at = lambda z: r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    can(0, 0, (z0 + z1) / 2, r0, z1 - z0, ORANGE, n=n, r2=r1)
    for za, zb in bands:
        can(0, 0, (za + zb) / 2, r_at(za) + 0.04, zb - za, STRIPE, n=n, r2=r_at(zb) + 0.04)
    return r_at


def build():
    body(shirt=ORANGE, pants=ORANGE, leg_colour=(0.22, 0.22, 0.25), shoe=(0.2, 0.5, 0.95), arms=False)
    kid_head(hair=HAIR)
    with part("head"):
        # the cone hat: a square base on the head, the cone towering up
        z0 = HEAD_TOP
        box(0, 0.05, z0 + 0.1, HEAD * 1.22, HEAD * 1.18, 0.26, ORANGE_D, bevel=0.1, segs=2)
        z1 = 7.0
        cone(z0 + 0.2, z1, 1.3, 0.3, ((4.95, 5.4), (5.9, 6.25)))
        can(0, 0, z0 + 0.28, 1.34, 0.16, ORANGE_D, n=16, r2=1.3)
        can(0, 0, z1 + 0.005, 0.24, 0.02, HOLE, n=16)          # the hollow tip
    with part("body"):
        # the cone dress round the body, on its own little square base
        box(0, 0, 0.36, 2.5, 2.5, 0.16, ORANGE_D, bevel=0.06, segs=2)
        cone(0.44, 1.75, 1.15, 0.6, ((0.95, 1.2),))
    # arms out of the dress; the left mitt (+x) holds the bucket. The sleeves, mitts
    # and bucket are fixed to the cone dress (a mitt swinging from a hidden arm would
    # cut through the dress and the head)
    with part("body"):
        for s in (-1, 1):
            hand = (s * 1.45, -0.35, 1.0)
            limb((s * 0.95, -0.15, 0.85), (hand[0] - s * 0.12, hand[1], hand[2] + 0.1), 0.12, ORANGE)
            can(s * 1.05, -0.24, 1.07, 0.14, 0.12, STRIPE, n=8, rot=(0, math.radians(90) - s * 0.15, 0))
            hand_mitt(*hand, s, MITT, SKIN)
        _bucket((1.45, -0.35, 1.0), True, 0.68)


if __name__ == "__main__" or True:
    render_costume("traffic-cone", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
