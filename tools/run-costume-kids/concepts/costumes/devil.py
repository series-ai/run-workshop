"""Little devil: a red onesie with a black belt, the kid's own head with a red
headband carrying two huge curved glossy red horns (the silhouette), a long
red tail curling up behind with a big arrowhead tip, and a golden pitchfork
held up in the right mitt, tilted out past the head. Carries the full bucket
in the left."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts/costumes")
from _kit5 import *  # noqa: F401,F403
from props import mount

RED, RED_D, HORN, HORN_D = (0.92, 0.16, 0.18), (0.70, 0.08, 0.12), (0.98, 0.24, 0.22), (0.80, 0.10, 0.14)
GOLD, GOLD_D, BLK, HAIR = (1.0, 0.78, 0.18), (0.88, 0.58, 0.10), (0.15, 0.12, 0.14), (0.20, 0.12, 0.08)

def pitchfork():
    """Around its grip: the pole runs along +z, three prongs on top."""
    limb((0, 0, -0.5), (0, 0, 2.6), 0.1, GOLD)
    can(0, 0, -0.55, 0.13, 0.14, GOLD_D, n=6)
    z = 2.6
    box(0, 0, z, 1.2, 0.2, 0.22, GOLD, bevel=0.07)
    for x, h in ((-0.52, 0.8), (0.0, 1.05), (0.52, 0.8)):
        limb((x, 0, z), (x, 0, z + h - 0.25), 0.09, GOLD)
        plate([(x - 0.2, z + h - 0.3), (x + 0.2, z + h - 0.3), (x, z + h + 0.2)], "y", 0, 0.16, GOLD)
    can(0, 0, z - 0.18, 0.15, 0.14, GOLD_D, n=6)


def build():
    body(shirt=RED, pants=RED, leg_colour=RED, shoe=BLK, arms=False)
    fy = -TD * 0.5
    with part("body"):
        box(0, 0, HIP + TH * 0.36, TW + 0.04, TD + 0.04, 0.14, BLK, bevel=0.03)   # belt
        box(0, fy - 0.04, HIP + TH * 0.36, 0.2, 0.04, 0.16, GOLD, bevel=0.02)       # buckle
    with part("chest"):
        box(0, 0, TOP - 0.05, TW + 0.06, TD + 0.06, 0.12, RED_D, bevel=0.04)       # collar
    arms(RED, full=True, hang=True)
    # the right (hanging) mitt holds the pitchfork, leaning well out past the head
    mount(pitchfork, HANG, tilt=(0, 40, 0))
    # the long tail: out of the back, curling up behind, an arrowhead tip
    with part("body"):
        pts = [(0.0, 0.32, HIP + 0.2), (0.05, 0.8, HIP + 0.05), (-0.45, 1.2, HIP + 0.2), (-1.15, 1.2, HIP + 0.6),
               (-1.65, 0.95, HIP + 1.2), (-1.8, 0.7, HIP + 1.85)]
        chain(pts, 0.12, 0.09, RED, n=6)
        tx, ty, tz = pts[-1]
        plate([(tx, tz + 0.8), (tx + 0.5, tz - 0.12), (tx, tz + 0.08), (tx - 0.5, tz - 0.12)], "y", ty, 0.16, RED_D)
    # the kid's own head, a red headband and two huge curved horns
    kid_head(hair=HAIR)
    with part("head"):
        top = HEAD_Z + HEAD * 0.48
        box(0, 0.1, top + 0.06, HEAD * 0.98, 0.42, 0.16, RED_D, bevel=0.06)
        for s in (-1, 1):
            box(s * HEAD * 0.53, 0.1, HEAD_Z + 0.68, 0.16, 0.42, 1.3, RED_D, bevel=0.06)
        for s in (-1, 1):
            pts = [(s * 0.72, 0.1, top - 0.05), (s * 0.95, 0.05, top + 0.55), (s * 1.12, 0.0, top + 1.15),
                   (s * 1.1, 0.0, top + 1.7), (s * 0.88, 0.05, top + 2.1), (s * 0.55, 0.1, top + 2.3)]
            chain(pts, 0.5, 0.04, HORN, n=8)

if __name__ == "__main__" or True:
    render_costume("devil", build, out_dir(), ortho=8.5, target_z=3.0)
