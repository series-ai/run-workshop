"""Blob alien: a squishy purple one-eyed blob suit. A big rounded blob body
from the knees up, lighter purple spots, the kid's face in a clear window in
the middle, and a single giant googly eye on top (green iris, a big shine)
on a short stalk. Wiggly tentacles hang round the hem with pink suction-cup
dots, two curl out of the back, and the kid's arms are tentacle sleeves: one
waves, the other carries the full bucket. Pairs with the inflatable T-rex:
the same face window."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

PURPLE, PURPLE_D, SPOT, SUCK = (0.62, 0.36, 0.9), (0.45, 0.22, 0.7), (0.78, 0.6, 1.0), (1.0, 0.6, 0.78)
IRIS, WIN, HAIR = (0.4, 0.9, 0.35), (0.72, 0.9, 1.0), (0.3, 0.17, 0.09)


def face_window(cz, fy, frame, w=1.3, h=1.15):
    """The kid's face in a clear rounded-square window on a costume front at y=fy."""
    box(0, fy + 0.02, cz, w + 0.26, 0.2, h + 0.26, frame, bevel=0.2, segs=2)      # the frame
    box(0, fy - 0.04, cz, w, 0.2, h, WIN, bevel=0.16, segs=2)                     # the clear plastic
    box(0, fy - 0.1, cz - 0.04, w * 0.84, 0.2, h * 0.82, SKIN, bevel=0.16, segs=2)  # the kid's face
    box(0, fy - 0.2, cz + h * 0.3, w * 0.78, 0.12, h * 0.2, HAIR, bevel=0.05)      # fringe
    face(0, cz - 0.06, fy - 0.2, 1.4, eye=0.16, gap=0.2)
    box(-w * 0.3, fy - 0.15, cz + h * 0.32, 0.12, 0.04, 0.1, WHITE)               # a glint on the plastic


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
    # the blob: a big squishy rounded cube with a soft rounded top
    bz0, bz1 = 0.65, 3.55
    bzc = (bz0 + bz1) / 2
    box(0, 0.05, bzc, 2.7, 2.1, bz1 - bz0, PURPLE, bevel=0.85, segs=3)
    ball(0, 0.05, bz1 - 0.25, 2.5, 1.95, 1.3, PURPLE, seg=12, ring=8)
    fy = 0.05 - 1.05
    face_window(bzc - 0.1, fy - 0.02, PURPLE_D)
    # lighter spots on the blob
    for x, z, d in ((-1.0, 3.1, 0.45), (1.05, 2.5, 0.5), (-1.08, 1.4, 0.38), (0.95, 1.2, 0.3), (0.6, 3.35, 0.32)):
        ball(x, fy + 0.14, z, d, 0.12, d, SPOT, seg=8, ring=6)
    for s in (-1, 1):
        ball(s * 1.36, 0.3, 2.3, 0.18, 0.6, 0.6, SPOT, seg=8, ring=6)
    # the single giant eye on a short stalk on top
    ez = bz1 + 0.75
    can(0, 0.1, bz1 + 0.15, 0.45, 0.6, PURPLE, n=10, r2=0.35)
    ball(0, 0.05, ez, 1.85, 1.7, 1.7, WHITE, seg=14, ring=10)
    ball(0, -0.66, ez - 0.05, 1.0, 0.4, 1.0, IRIS, seg=12, ring=8)
    ball(0, -0.83, ez - 0.05, 0.52, 0.2, 0.5, DARK, seg=10, ring=6)
    ball(-0.18, -0.92, ez + 0.14, 0.2, 0.06, 0.2, WHITE, seg=8, ring=4)
    for k in (-1, 0, 1):  # three curly lashes on top of the eye
        limb((k * 0.32, -0.3, ez + 0.66), (k * 0.5, -0.45, ez + 1.05), 0.06, PURPLE_D)
        ball(k * 0.5, -0.45, ez + 1.05, 0.14, 0.14, 0.14, PURPLE_D, seg=6, ring=4)
    # fat tentacles hanging round the hem, curling out at the tips
    for k in range(6):
        a = math.radians(-150 + 60 * k) if k else math.radians(-150)
        a = math.radians([-145, -35, 15, 165, 65, 115][k])
        dx, dy = math.cos(a), math.sin(a)
        x, y = 1.05 * dx, 0.05 + 0.85 * dy
        tentacle([(x, y, bz0 + 0.3), (x + dx * 0.2, y + dy * 0.2, bz0 - 0.15), (x + dx * 0.45, y + dy * 0.45, 0.18),
                  (x + dx * 0.75, y + dy * 0.75, 0.3), (x + dx * 0.85, y + dy * 0.85, 0.55)], 0.24, 0.12, cups=(dy < 0))
    # two tentacles curling up out of the back
    for s in (-1, 1):
        tentacle([(s * 0.7, 0.95, 2.5), (s * 1.0, 1.4, 2.8), (s * 1.15, 1.55, 3.25), (s * 1.0, 1.45, 3.55), (s * 0.82, 1.3, 3.45)], 0.22, 0.11, cups=False)
    # tentacle sleeves: the right waves, the left carries the full bucket
    rh = (1.85, -0.25, 2.75)
    tentacle([(1.25, 0, 2.0), (1.65, -0.1, 2.15), (1.85, -0.2, 2.4)], 0.2, 0.16)
    hand_mitt(*rh, 1, MITT, SKIN)
    lh = (-1.8, -0.3, 1.55)
    tentacle([(-1.25, 0, 2.0), (-1.6, -0.1, 1.9), (-1.8, -0.25, 1.8)], 0.2, 0.16)
    hand_mitt(*lh, -1, MITT, SKIN)
    bucket(lh, full=True, size=0.62)


if __name__ == "__main__" or True:
    run({"alien-blob": build})
