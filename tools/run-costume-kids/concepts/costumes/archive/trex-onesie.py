"""T-rex onesie (kigurumi): the kid in a green dino onesie. The hood is a dino
head: the upper jaw with a row of teeth and googly eyes sits on top, the lower
jaw with teeth juts out under the chin, and the kid's face looks out of the
open mouth. Orange spikes down the back, a stubby tail, a pale belly patch,
dino-claw slippers. Carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

GREEN, GREEN_D, BELLY = (0.36, 0.76, 0.24), (0.24, 0.56, 0.16), (0.88, 0.94, 0.5)
SPIKE, MOUTH, TOOTH = (1.0, 0.6, 0.12), (0.85, 0.3, 0.35), (1, 1, 0.95)


def tooth(x, y, z, down=True, h=0.26):
    can(x, y, z, 0.11, h, TOOTH, n=4, r2=0.0, rot=(math.pi if down else 0, 0, math.radians(45)))


def build():
    body(shirt=GREEN, pants=GREEN, sleeve=GREEN, leg_colour=GREEN, shoe=GREEN_D, arms=False)
    box(0, -TD * 0.5 - 0.02, HIP + 0.42, TW * 0.6, 0.06, 0.6, BELLY, bevel=0.05)  # belly patch
    for s in (-1, 1):  # slipper claws
        for k in (-1, 0, 1):
            can(s * TW * 0.24 + k * 0.11, -FOOT * 0.25 - 0.6, 0.12, 0.06, 0.16, TOOTH, n=4, r2=0.0, rot=(math.radians(90), 0, 0))
    # arms: left down, right holding the bucket out
    lh = (-(TW * 0.5 + 0.26), -0.08, TOP - 0.66)
    limb((-(TW * 0.5 + 0.08), 0, TOP - 0.15), (lh[0] + 0.02, -0.05, lh[2] + 0.12), 0.12, GREEN)
    hand_mitt(*lh, -1, MITT, SKIN)
    rh = (1.3, -0.3, 1.2)
    limb((TW * 0.5 + 0.08, 0, TOP - 0.15), rh, 0.12, GREEN)
    hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.7)
    # the head: the kid's face in a pink mouth lining, inside the green hood
    hz = HEAD_Z - 0.1
    box(0, 0.2, hz, HEAD * 1.06, HEAD * 0.92, HEAD * 0.95, GREEN, bevel=0.35, segs=2)       # the hood
    box(0, -0.98, hz - 0.05, HEAD * 0.86, 0.3, HEAD * 0.66, MOUTH, bevel=0.1)                # mouth lining
    box(0, -1.05, hz - 0.05, HEAD * 0.7, 0.3, HEAD * 0.52, SKIN, bevel=0.15, segs=2)         # the kid's face
    box(0, -1.13, hz + 0.5, HEAD * 0.66, 0.2, 0.3, (0.3, 0.17, 0.09), bevel=0.06)            # fringe
    face(0, hz - 0.12, -1.2, 1.9, eye=0.15, gap=0.2)
    # the upper jaw: a long snout over the top of the head, teeth hanging down
    jz = hz + HEAD * 0.42
    box(0, -0.5, jz, HEAD * 1.06, HEAD * 1.05, 0.95, GREEN, bevel=0.3, segs=2)
    for i in range(7):
        tooth(-0.9 + i * 0.3, -1.65, jz - 0.55)
    for s in (-1, 1):
        ball(s * 0.32, -1.85, jz + 0.15, 0.16, 0.08, 0.1, GREEN_D, seg=6, ring=4)  # nostrils
        # googly eyes on top of the snout
        ex, ey, ez = s * 0.75, -0.5, jz + 0.55
        ball(ex, ey, ez, 0.75, 0.7, 0.75, WHITE, seg=10, ring=8)
        ball(ex + s * 0.03, ey - 0.3, ez + 0.02, 0.34, 0.14, 0.38, DARK, seg=8, ring=6)
        ball(ex - 0.04, ey - 0.38, ez + 0.1, 0.1, 0.05, 0.1, WHITE, seg=6, ring=4)
    # the lower jaw: juts out under the chin, teeth pointing up
    lz = hz - HEAD * 0.42
    box(0, -0.45, lz, HEAD * 1.0, HEAD * 0.95, 0.5, GREEN_D, bevel=0.18, segs=2)
    for i in range(6):
        tooth(-0.75 + i * 0.3, -1.5, lz + 0.35, down=False, h=0.22)
    # spikes down the back of the hood and the back, then a stubby tail
    for z, h in ((hz + 0.85, 0.6), (hz + 0.15, 0.6), (hz - 0.55, 0.5)):
        can(0, 1.35 + h * 0.5 - 0.08, z, 0.26, h, SPIKE, n=4, r2=0.0, rot=(math.radians(-90), 0, math.radians(45)))
    for z in (TOP - 0.15, HIP + 0.45):
        can(0, TD * 0.5 + 0.12, z, 0.16, 0.3, SPIKE, n=4, r2=0.0, rot=(math.radians(-90), 0, math.radians(45)))
    can(0, TD * 0.5 + 0.45, HIP + 0.15, 0.36, 1.0, GREEN, n=8, r2=0.05, rot=(math.radians(-110), 0, 0))


if __name__ == "__main__" or True:
    run({"trex-onesie": build})
