"""Inflatable T-rex: the blow-up dino suit, built from big puffy rounded cubes
like the T-rex onesie. A fat rounded-cube dino body sits on the kid's stub
legs and shoes; the kid's own face looks out a clear window in the middle of
it; a big rounded-cube T-rex head (googly eyes, toothy grin) rises out of the
top above the kid. Tiny useless dino arms (one dangles the full bucket), orange
spikes down the back and a chunky tail of rounded-cube segments on the ground.
Pairs with the reverse mermaid: same face window, same big head on top."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

GREEN, GREEN_D, BELLY = (0.36, 0.76, 0.24), (0.24, 0.56, 0.16), (0.88, 0.94, 0.5)
SPIKE, MOUTH, TOOTH = (1.0, 0.6, 0.12), (0.85, 0.3, 0.35), (1, 1, 0.95)
WIN, HAIR = (0.72, 0.9, 1.0), (0.3, 0.17, 0.09)


def face_window(cz, fy, frame, w=1.3, h=1.15):
    """The kid's face in a clear rounded-square window on a costume front at y=fy."""
    box(0, fy + 0.02, cz, w + 0.26, 0.2, h + 0.26, frame, bevel=0.2, segs=2)      # the frame
    box(0, fy - 0.04, cz, w, 0.2, h, WIN, bevel=0.16, segs=2)                     # the clear plastic
    box(0, fy - 0.1, cz - 0.04, w * 0.84, 0.2, h * 0.82, SKIN, bevel=0.16, segs=2)  # the kid's face
    box(0, fy - 0.2, cz + h * 0.3, w * 0.78, 0.12, h * 0.2, HAIR, bevel=0.05)      # fringe
    face(0, cz - 0.06, fy - 0.2, 1.4, eye=0.16, gap=0.2)
    box(-w * 0.3, fy - 0.15, cz + h * 0.32, 0.12, 0.04, 0.1, WHITE)               # a glint on the plastic


def tooth(x, y, z, down=True, h=0.24):
    can(x, y, z, 0.1, h, TOOTH, n=4, r2=0.0, rot=(math.pi if down else 0, 0, math.radians(45)))


def build():
    body(pants=GREEN, leg_colour=GREEN, shoe=(0.95, 0.25, 0.3), torso=False, arms=False)
    # the puffy dino body: a big rounded cube, a pale belly panel on the front
    bz0, bz1 = 0.75, 3.2
    bzc, bd = (bz0 + bz1) / 2, 2.0
    box(0, 0.05, bzc, 2.7, bd, bz1 - bz0, GREEN, bevel=0.6, segs=3)
    fy = 0.05 - bd / 2
    box(0, fy + 0.05, bzc - 0.1, 1.95, 0.2, 2.05, BELLY, bevel=0.45, segs=3)
    face_window(bzc + 0.25, fy - 0.02, GREEN_D)
    # tiny useless arms, with claws; the right one dangles the bucket
    for s in (-1, 1):
        box(s * 1.35, fy + 0.25, bzc - 0.1, 0.36, 0.5, 0.32, GREEN, bevel=0.12, segs=2)
        box(s * 1.45, fy - 0.05, bzc - 0.22, 0.34, 0.32, 0.36, GREEN, bevel=0.12, segs=2)
        for k in (-1, 1):
            can(s * 1.45 + k * 0.08, fy - 0.12, bzc - 0.45, 0.05, 0.16, WHITE, n=4, r2=0.0, rot=(math.pi, 0, 0))
    bucket((1.45, fy - 0.05, bzc - 0.22), full=True, size=0.62)
    # the giant head rising out of the top: a big cranium and a long snout jutting forward
    hz = bz1 + 1.0
    box(0, 0.25, bz1 + 0.1, 1.6, 1.3, 0.7, GREEN, bevel=0.28, segs=2)                # a short neck
    box(0, 0.1, hz + 0.05, 2.5, 1.8, 1.5, GREEN, bevel=0.5, segs=3)                # cranium
    sz, sy = hz + 0.05, -0.95                                                       # snout centre
    box(0, sy, sz, 2.2, 1.4, 0.9, GREEN, bevel=0.36, segs=3)                       # upper jaw
    tip = sy - 0.7
    # the open mouth: a pink lining in the gap between the jaws
    box(0, sy + 0.15, sz - 0.62, 1.9, 1.2, 0.5, MOUTH, bevel=0.12, segs=2)
    for i in range(7):
        tooth(-0.78 + i * 0.26, tip + 0.14, sz - 0.5, h=0.26)
    # the lower jaw: a smaller dark rounded cube, teeth pointing up, grinning
    lz = sz - 0.92
    box(0, sy + 0.1, lz, 2.0, 1.4, 0.42, GREEN_D, bevel=0.18, segs=2)
    for i in range(6):
        tooth(-0.65 + i * 0.26, tip + 0.22, lz + 0.3, down=False, h=0.22)
    for s in (-1, 1):
        ball(s * 0.32, tip - 0.01, sz + 0.2, 0.18, 0.08, 0.12, GREEN_D, seg=6, ring=4)  # nostrils
        box(s * 0.82, tip - 0.01, sz - 0.12, 0.28, 0.04, 0.12, CHEEK)                   # blush
        # googly eyes up on the cranium
        ex, ey, ez = s * 0.6, -0.1, hz + 0.8
        ball(ex, ey, ez, 0.8, 0.72, 0.8, WHITE, seg=10, ring=8)
        ball(ex + s * 0.03, ey - 0.31, ez, 0.36, 0.14, 0.4, DARK, seg=8, ring=6)
        ball(ex - 0.04, ey - 0.39, ez + 0.09, 0.1, 0.05, 0.1, WHITE, seg=6, ring=4)
    # orange spikes from the top of the head, down the back, onto the tail
    for y, z, h in ((0.9, hz + 0.45, 0.5), (0.9, hz - 0.3, 0.5), (1.05, bz1 - 0.3, 0.5), (1.05, bzc - 0.4, 0.5)):
        can(0, y + h * 0.5 - 0.08, z, 0.24, h, SPIKE, n=4, r2=0.0, rot=(math.radians(-90), 0, math.radians(45)))
    # the chunky tail: rounded-cube segments shrinking along the ground
    for i, (y, z, w) in enumerate(((1.3, 0.6, 1.2), (1.95, 0.42, 0.85), (2.45, 0.3, 0.58))):
        box(0, y, z, w, w * 0.95, w * 0.85, GREEN, bevel=w * 0.25, segs=2)
        can(0, y + 0.1, z + w * 0.42 + 0.12, 0.18 * w + 0.04, 0.3 * w + 0.05, SPIKE, n=4, r2=0.0, rot=(0, 0, math.radians(45)))


if __name__ == "__main__" or True:
    run({"inflatable-trex": build})
