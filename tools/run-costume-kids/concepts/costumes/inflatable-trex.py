"""Inflatable T-rex: the blow-up dino suit, built from big puffy rounded cubes.
A fat rounded-cube dino body sits on the kid's stub legs and shoes; the kid's
whole head is in a big green hood and the face looks out of the open dino
mouth: the T-rex's upper jaw (teeth hanging down) is the hood's brim, a toothy
lower jaw is the chin strap. The big cranium with googly eyes sits on top.
Tiny useless dino arms (one dangles the full bucket), orange spikes down the
back and a chunky tail of rounded-cube segments on the ground.
Pairs with the reverse mermaid: same hood face, same big head on top."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import _bucket

GREEN, GREEN_D, BELLY = (0.36, 0.76, 0.24), (0.24, 0.56, 0.16), (0.88, 0.94, 0.5)
SPIKE, MOUTH, TOOTH = (1.0, 0.6, 0.12), (0.85, 0.3, 0.35), (1, 1, 0.95)
HAIR = (0.3, 0.17, 0.09)


def hood_face(colour, rim, hood_y=0.1, hood_h=HEAD * 1.06):
    """A hood enclosing the standard head; the full-size kid face in its opening."""
    box(0, hood_y, HEAD_Z + 0.04, HEAD * 1.14, HEAD * 1.04, hood_h, colour, bevel=0.5, segs=2)
    fz = HEAD_Z - HEAD * 0.05
    box(0, -0.3, fz, HEAD * 0.98, HEAD * 0.8, HEAD * 0.84, rim, bevel=0.22, segs=2)
    box(0, -0.37, fz - 0.03, HEAD * 0.86, HEAD * 0.76, HEAD * 0.74, SKIN, bevel=0.14, segs=2)
    ffy = -0.37 - HEAD * 0.38
    box(0, ffy + 0.05, fz + HEAD * 0.29, HEAD * 0.66, 0.2, HEAD * 0.12, HAIR, bevel=0.06)  # fringe
    face(0, fz, ffy, HEAD * 0.86)
    return fz, ffy


def tooth(x, y, z, down=True, h=0.24):
    can(x, y, z, 0.1, h, TOOTH, n=4, r2=0.0, rot=(math.pi if down else 0, 0, math.radians(45)))


def build():
    body(pants=GREEN, leg_colour=GREEN, shoe=(0.95, 0.25, 0.3), torso=False, arms=False)
    with part("body"):
        # the puffy dino body: a big rounded cube around the torso, a pale belly panel
        bz0, bz1 = 0.62, 2.3
        bzc, bd = (bz0 + bz1) / 2, 2.2
        box(0, 0.15, bzc, 3.2, bd, bz1 - bz0, GREEN, bevel=0.6, segs=3)
        fy = 0.15 - bd / 2
        box(0, fy + 0.05, bzc - 0.1, 2.2, 0.2, 1.3, BELLY, bevel=0.4, segs=3)
    # tiny useless arms, with claws; the right one dangles the bucket
    az = bzc + 0.05
    for s in (-1, 1):
        with part("body"):
            box(s * 1.6, fy + 0.35, az, 0.4, 0.5, 0.32, GREEN, bevel=0.12)
        with part("body"):  # the little claws are the suit's: they ride the body
            box(s * 1.7, fy + 0.05, az - 0.12, 0.34, 0.32, 0.36, GREEN, bevel=0.12)
            for k in (-1, 1):
                can(s * 1.7 + k * 0.08, fy - 0.02, az - 0.35, 0.05, 0.16, WHITE, n=4, r2=0.0, rot=(math.pi, 0, 0))
    with part("body"):  # the bucket dangles from a claw of the suit, so it rides the body too
        _bucket((1.7, fy + 0.05, az - 0.12), True, 0.62)
    with part("head"):
        # the hood around the kid's head: the face looks out of the dino's open mouth
        fz, ffy = hood_face(GREEN, MOUTH)
        # lower jaw: a dark chin band under the face, little teeth pointing up
        jz = fz - HEAD * 0.42
        box(0, -0.75, jz, HEAD * 1.04, 1.3, 0.45, GREEN_D, bevel=0.2, segs=2)
        for i in range(6):
            tooth(-0.8 + i * 0.32, -1.3, jz + 0.32, down=False, h=0.22)
        # upper jaw: the snout juts out over the face like a brim, teeth hanging down
        top = HEAD_Z + 0.04 + HEAD * 0.53
        sz, sy = top - 0.05, -1.15
        box(0, sy + 0.2, sz - 0.5, HEAD * 1.06, 1.6, 0.3, MOUTH, bevel=0.1, segs=2)  # pink mouth lining
        box(0, sy, sz, HEAD * 1.18, 2.0, 1.0, GREEN, bevel=0.4, segs=3)
        tip = sy - 1.0
        for i in range(8):
            tooth(-0.98 + i * 0.28, tip + 0.2, sz - 0.58, h=0.28)
        for s in (-1, 1):
            ball(s * 0.36, tip - 0.01, sz + 0.2, 0.2, 0.08, 0.13, GREEN_D, seg=6, ring=4)  # nostrils
            box(s * 1.05, tip + 0.1, sz - 0.12, 0.3, 0.04, 0.13, CHEEK)                    # blush
        # the big cranium on top, googly eyes on it
        hz = top + 0.75
        box(0, 0.35, hz, 3.0, 2.2, 1.7, GREEN, bevel=0.55, segs=3)
        for s in (-1, 1):
            ex, ey, ez = s * 0.68, -0.3, hz + 0.75
            ball(ex, ey, ez, 0.9, 0.8, 0.9, WHITE, seg=8, ring=6)
            ball(ex + s * 0.03, ey - 0.35, ez, 0.4, 0.14, 0.44, DARK, seg=8, ring=5)
            ball(ex - 0.04, ey - 0.43, ez + 0.1, 0.11, 0.05, 0.11, WHITE, seg=6, ring=4)
    # orange spikes from the top of the head, down the back, onto the tail
    for y, z, h in ((1.3, hz + 0.3, 0.55), (1.35, HEAD_Z + 0.7, 0.55), (1.35, HEAD_Z - 0.4, 0.5), (1.25, bzc - 0.1, 0.5)):
        with part("head" if z > HEAD_Z - 1.0 else "body"):  # the hood's spikes ride the head, the back's the body
            can(0, y + h * 0.5 - 0.08, z, 0.26, h, SPIKE, n=4, r2=0.0, rot=(math.radians(-90), 0, math.radians(45)))
    with part("body"):
        # the chunky tail: rounded-cube segments shrinking along the ground
        for i, (y, z, w) in enumerate(((1.45, 0.6, 1.25), (2.15, 0.42, 0.9), (2.7, 0.3, 0.6))):
            box(0, y, z, w, w * 0.95, w * 0.85, GREEN, bevel=w * 0.25, segs=2)
            can(0, y + 0.1, z + w * 0.42 + 0.12, 0.18 * w + 0.04, 0.3 * w + 0.05, SPIKE, n=4, r2=0.0, rot=(0, 0, math.radians(45)))


if __name__ == "__main__" or True:
    render_costume("inflatable-trex", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
