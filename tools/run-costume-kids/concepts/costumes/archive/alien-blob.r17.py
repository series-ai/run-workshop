"""Blob alien: a squishy purple one-eyed blob suit. A big rounded blob body
from the knees up that swallows the kid's whole head, lighter purple spots,
the kid's full face peeking out of an opening in the front, and a single giant googly eye on top (green iris, a big shine)
on a short stalk. Wiggly tentacles hang round the hem with pink suction-cup
dots, two curl out of the back, and the kid's arms are tentacle sleeves: one
waves, the other carries the full bucket. Pairs with the inflatable T-rex:
the same hood face."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

PURPLE, PURPLE_D, SPOT, SUCK = (0.62, 0.36, 0.9), (0.45, 0.22, 0.7), (0.78, 0.6, 1.0), (1.0, 0.6, 0.78)
IRIS, WIN, HAIR = (0.4, 0.9, 0.35), (0.72, 0.9, 1.0), (0.3, 0.17, 0.09)


def hood_face(rim, y0=-0.3):
    """The kid's full-size face in an opening of the suit that encloses the standard head."""
    fz = HEAD_Z - HEAD * 0.05
    box(0, y0, fz, HEAD * 0.98, HEAD * 0.8, HEAD * 0.84, rim, bevel=0.22, segs=2)
    box(0, y0 - 0.07, fz - 0.03, HEAD * 0.86, HEAD * 0.76, HEAD * 0.74, SKIN, bevel=0.14, segs=2)
    ffy = y0 - 0.07 - HEAD * 0.38
    box(0, ffy + 0.04, fz + HEAD * 0.29, HEAD * 0.86, 0.2, HEAD * 0.16, HAIR, bevel=0.06)  # fringe
    face(0, fz, ffy, HEAD * 0.86)


def tentacle(pts, r0, r1, rgb=PURPLE, cups=True):
    """A tapering wiggly tentacle along points, balls at the joints, sucker dots."""
    n = len(pts) - 1
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        r = r0 + (r1 - r0) * (i + 0.5) / n
        limb(a, b, r, rgb, n=8)
        ball(*b, r * 2.1, r * 2.1, r * 2.1, rgb, seg=8, ring=6)
        if cups and i < n - 1:
            m = [(p + q) / 2 for p, q in zip(a, b)]
            ball(m[0], m[1] - r * 0.9, m[2], r * 0.8, r * 0.4, r * 0.8, SUCK, seg=6, ring=4)


def build():
    body(pants=PURPLE, leg_colour=PURPLE, shoe=PURPLE_D, torso=False, arms=False)
    # a little kid torso under the blob: purple shorts from the leg tops up into the suit, so the
    # legs never end in empty space when they swing (they ride the hips with the blob)
    with part("body"):
        box(0, 0, (HIP - 0.16 + 1.15) / 2, TW + 0.08, TD + 0.06, 1.15 - (HIP - 0.16), PURPLE_D, bevel=0.1, segs=2)
    # the blob: a big squishy rounded cube from the knees up over the kid's head, a soft dome on top.
    # The whole blob (face, spots, eye, tentacles) is the suit: it rides the hips as one block.
    bz0, bz1 = 0.65, HEAD_Z + HEAD * 0.5
    bzc = (bz0 + bz1) / 2
    with part("body"):
        box(0, 0.1, bzc, 3.1, 2.65, bz1 - bz0, PURPLE, bevel=0.95, segs=3)
        ball(0, 0.1, bz1 - 0.2, 2.9, 2.45, 1.5, PURPLE, seg=12, ring=8)
        hood_face(PURPLE_D, y0=-0.33)
        fy = 0.1 - 1.32
        # lighter spots on the blob, round the face
        for x, z, d in ((1.45, 3.1, 0.42), (-1.25, 1.3, 0.36), (1.2, 1.2, 0.3), (0.7, 4.35, 0.34), (-0.5, 4.45, 0.26)):
            ball(x, fy + 0.22 + max(0, abs(x) - 0.9) * 0.7 + max(0, z - 4.1) * 0.8, z, d, 0.14, d, SPOT, seg=8, ring=6)
        for s in (-1, 1):
            ball(s * 1.56, 0.4, 2.7, 0.18, 0.6, 0.6, SPOT, seg=8, ring=6)
        # the single giant eye on a short stalk on top
        top = bz1 + 0.5
        ez = top + 0.95
        can(0, 0.1, top + 0.1, 0.5, 0.6, PURPLE, n=10, r2=0.38)
        ball(0, 0.05, ez, 2.2, 2.0, 2.0, WHITE, seg=14, ring=10)
        ball(0, -0.78, ez - 0.05, 1.2, 0.46, 1.2, IRIS, seg=12, ring=8)
        ball(0, -0.98, ez - 0.05, 0.62, 0.22, 0.6, DARK, seg=10, ring=6)
        ball(-0.22, -1.08, ez + 0.17, 0.24, 0.07, 0.24, WHITE, seg=8, ring=4)
        for k in (-1, 0, 1):  # three curly lashes on top of the eye
            limb((k * 0.38, -0.35, ez + 0.78), (k * 0.6, -0.5, ez + 1.25), 0.07, PURPLE_D)
            ball(k * 0.6, -0.5, ez + 1.25, 0.17, 0.17, 0.17, PURPLE_D, seg=6, ring=4)
        # fat tentacles hanging round the hem, curling out at the tips
        for k in range(6):
            a = math.radians([-145, -35, 15, 165, 65, 115][k])
            dx, dy = math.cos(a), math.sin(a)
            x, y = 1.15 * dx, 0.1 + 0.95 * dy
            tentacle([(x, y, bz0 + 0.3), (x + dx * 0.2, y + dy * 0.2, bz0 - 0.15), (x + dx * 0.45, y + dy * 0.45, 0.18),
                      (x + dx * 0.75, y + dy * 0.75, 0.3), (x + dx * 0.85, y + dy * 0.85, 0.55)], 0.24, 0.12, cups=(dy < 0))
        # two tentacles curling up out of the back
        for s in (-1, 1):
            tentacle([(s * 0.8, 1.25, 3.0), (s * 1.1, 1.7, 3.3), (s * 1.25, 1.85, 3.75), (s * 1.1, 1.75, 4.05), (s * 0.92, 1.6, 3.95)], 0.22, 0.11, cups=False)
    # tentacle sleeves: the right waves, the left carries the full bucket. The sleeves are the
    # blob's own tentacles (they ride the hips); the kid's mitts flap at their tips
    rh = (2.15, -0.25, 2.1)
    with part("body"):
        tentacle([(1.4, 0, 1.25), (1.85, -0.1, 1.45), (2.1, -0.2, 1.75)], 0.2, 0.16)
    with part("hand.l"):
        hand_mitt(*rh, 1, MITT, SKIN)
    lh = (-2.25, -0.3, 0.95)
    with part("body"):
        tentacle([(-1.4, 0, 1.3), (-1.85, -0.1, 1.2), (-2.15, -0.25, 1.1)], 0.2, 0.16)
    with part("hand.r"):
        hand_mitt(*lh, -1, MITT, SKIN)
    bucket(lh, full=True, size=0.62)

if __name__ == "__main__" or True:
    render_costume("alien-blob", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
