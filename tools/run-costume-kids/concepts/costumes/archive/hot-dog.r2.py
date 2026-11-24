"""Hot dog suit: a giant sausage standing up the middle, rising way past the
head, with the kid's face poking out a round hole in it; two big tan bun
halves hug it from the sides; a yellow mustard zigzag runs down the front.
The stub legs, shoes and mitts poke out below. Carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

SAUSAGE, SAUSAGE_D, BUN, CRUST = (0.86, 0.32, 0.22), (0.66, 0.2, 0.14), (1.0, 0.78, 0.45), (0.82, 0.5, 0.22)
MUSTARD = (1.0, 0.85, 0.1)


def build():
    body(shirt=SAUSAGE, pants=(0.95, 0.95, 0.92), shoe=(0.95, 0.85, 0.15), torso=False, arms=False)
    # the sausage: a tall upright capsule
    r, z0, z1 = 1.05, 1.0, 4.6
    can(0, 0, (z0 + z1) / 2, r, z1 - z0, SAUSAGE, n=12)
    ball(0, 0, z1, r * 2, r * 2, 1.3, SAUSAGE, seg=12, ring=8)
    ball(0, 0, z0, r * 2, r * 2, 1.1, SAUSAGE, seg=12, ring=8)
    can(0, 0, z1 + 0.68, 0.14, 0.2, SAUSAGE_D, n=6)  # the tied end
    # the bun halves, one on each side, crust on the outside
    for s in (-1, 1):
        box(s * 1.05, 0, 2.05, 0.85, 2.5, 2.9, BUN, bevel=0.42, segs=3)
        box(s * 1.28, 0, 2.08, 0.55, 2.6, 3.0, CRUST, bevel=0.27, segs=3)
    # the face hole: a darker rim, the kid's face in it
    fz, fy = 3.15, -r
    can(0, fy, fz, 0.88, 0.2, SAUSAGE_D, n=12, rot=(math.radians(90), 0, 0))
    can(0, fy - 0.05, fz, 0.75, 0.2, SKIN, n=12, rot=(math.radians(90), 0, 0))
    box(0, fy - 0.16, fz + 0.48, 0.95, 0.1, 0.22, (0.3, 0.17, 0.09), bevel=0.04)  # fringe
    face(0, fz + 0.05, fy - 0.15, 1.5, eye=0.16, gap=0.2)
    # mustard zigzag: above the face to the top, and below it down the belly
    for zs, ze in ((3.95, 4.85), (1.15, 2.3)):
        n = 4
        pts = []
        for k in range(n + 1):
            z = zs + (ze - zs) * k / n
            pts.append(((-0.45 if k % 2 else 0.45), -r - 0.04, z))
        for a, b in zip(pts, pts[1:]):
            limb(a, b, 0.1, MUSTARD)
        for p in pts:
            ball(*p, 0.2, 0.2, 0.2, MUSTARD, seg=6, ring=4)
    # the mitts poke out under the bun; the right one holds the bucket
    lh = (-1.8, -0.3, 0.9)
    limb((-1.2, -0.1, 1.0), lh, 0.11, SAUSAGE)
    hand_mitt(*lh, -1, MITT, SKIN)
    rh = (1.95, -0.35, 1.25)
    limb((1.2, -0.1, 1.2), rh, 0.11, SAUSAGE)
    hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.7)


if __name__ == "__main__" or True:
    run({"hot-dog": build})
