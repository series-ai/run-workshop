"""Space cat: the spaceman crossover. The same puffy white suit, backpack and
fishbowl helmet, but in pink trim: the bowl has two white cat ears with pink
insides on top, the kid inside has whiskers and a pink nose painted on, a
puffy suit tail curls out the back, and the little flag has a fish on it.
Carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

# the spaceman's suit, helmet and arms (its source, minus its run line)
_src = open(_PKG + "/concepts/costumes/spaceman.py").read()
exec(compile(_src[: _src.rindex("\nif __name__")], "spaceman.py", "exec"))

PINK, PINK_D, NOSE, FISH = (1.0, 0.55, 0.72), (0.9, 0.38, 0.6), (0.95, 0.42, 0.55), (0.3, 0.75, 0.95)


def squash(o, sx=1.0, sy=1.0, sz=1.0):
    o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    return o


def fish(x, y, z):
    """A little fish on the flag: a body, a tail fin and an eye."""
    ball(x + 0.05, y - 0.05, z, 0.34, 0.06, 0.22, FISH, seg=8, ring=6)
    can(x - 0.2, y - 0.05, z, 0.12, 0.05, FISH, n=3, rot=(math.radians(90), 0, math.radians(90)))
    can(x + 0.14, y - 0.09, z + 0.03, 0.025, 0.03, DARK, n=6, rot=X90)


def build():
    suit(trim=PINK)
    arms_flag_bucket(flag=PINK, emblem=fish)
    cz = HEAD_Z + 0.15
    r = 1.6
    helmet(cz, r, collar_rgb=PINK)
    # whiskers and a pink nose painted on the kid inside
    fz, fy = cz - 0.05 - 2.1 * 0.05, -2.1 * 0.46
    can(0, fy - 0.03, fz - 0.14, 0.09, 0.05, NOSE, n=3, rot=(math.radians(90), 0, math.radians(180)))
    for s in (-1, 1):
        for k, ang in ((-1, -12), (1, 12)):
            box(s * 0.62, fy - 0.03, fz - 0.24 + k * 0.08, 0.36, 0.03, 0.035, DARK, rot=(0, s * math.radians(ang), 0))
    # cat ears on the bowl: chunky white ears with pink insides (built like the cat onesie's)
    for s in (-1, 1):
        ex, ez = s * 0.95, cz + r * 0.78
        o = can(ex, 0.05, ez + 0.35, 0.62, 0.95, SUIT, n=4, r2=0.0, rot=(0, s * math.radians(-22), math.radians(45)))
        squash(o, 1.0, 0.5, 1.0)
        o = can(ex + s * 0.02, -0.12, ez + 0.28, 0.36, 0.58, PINK, n=4, r2=0.0, rot=(0, s * math.radians(-22), math.radians(45)))
        squash(o, 1.0, 0.4, 1.0)
    # a puffy suit tail curling out of the back, pink tip
    pts = [(0.0, 0.5, HIP + 0.15), (0.1, 1.0, HIP + 0.0), (0.2, 1.45, HIP + 0.2), (0.25, 1.65, HIP + 0.6), (0.15, 1.55, HIP + 0.95)]
    for i, (p0, p1) in enumerate(zip(pts, pts[1:])):
        limb(p0, p1, 0.14, SUIT, n=8)
        ball(*p1, 0.34, 0.34, 0.34, PINK if i == len(pts) - 2 else SUIT, seg=8, ring=6)


if __name__ == "__main__" or True:
    run({"space-cat": build})
