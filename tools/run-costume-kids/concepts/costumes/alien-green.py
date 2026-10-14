"""Little green alien: a big green head-hood with the kid's face in a pale
green-rimmed opening, two big glossy black alien eyes on the forehead and two
wobbly antennae with glowing balls; a shiny silver suit with a pointy retro
collar, a green belt with a ringed buckle and green boots; a retro ray gun
(red barrel, yellow rings, a glowing tip) in one mitt and the full bucket in
the other."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket, mount

GREEN, GREEN_D, LIME = (0.42, 0.86, 0.3), (0.26, 0.66, 0.2), (0.8, 1.0, 0.45)
SILVER, SILVER_D = (0.82, 0.85, 0.92), (0.6, 0.64, 0.74)
RED, YEL, GLOW, PINK = (0.95, 0.25, 0.25), (1.0, 0.84, 0.15), (0.75, 1.0, 0.35), (1.0, 0.55, 0.7)
X90 = (math.radians(90), 0, 0)
Y90 = (0, math.radians(90), 0)


def ray_gun(x, y, z):
    """A retro ray gun held in a mitt at (x, y, z), pointing forward (-y)."""
    gy = y - 0.35
    gz = z - 0.02
    box(x, y - 0.02, z - 0.02, 0.16, 0.2, 0.42, RED_D if False else (0.6, 0.12, 0.15), bevel=0.05)  # grip in the mitt
    can(x, gy, gz, 0.17, 0.95, RED, n=10, rot=X90)                       # barrel
    ball(x, gy + 0.52, gz, 0.46, 0.4, 0.46, YEL, seg=10, ring=6)         # round back bulb
    for k in range(3):
        can(x, gy - 0.12 - k * 0.18, gz, 0.24, 0.07, YEL, n=10, rot=X90)  # cooling rings
    can(x, gy - 0.6, gz, 0.1, 0.25, SILVER, n=8, r2=0.17, rot=X90)      # flared nozzle
    ball(x, gy - 0.74, gz, 0.2, 0.12, 0.2, GLOW, seg=8, ring=6)          # glowing tip
    o = can(x, gy + 0.05, gz + 0.22, 0.14, 0.1, SILVER_D, n=4, r2=0.0, rot=(0, 0, math.radians(45)))  # a fin on top


def build():
    body(shirt=SILVER, pants=SILVER, leg_colour=SILVER, shoe=GREEN_D, arms=False)
    fy = -TD * 0.5
    # the belt and buckle, and a pointy retro collar
    with part("chest"):
        box(0, 0, TOP - 0.04, TW * 0.7, TD + 0.04, 0.1, GREEN_D, bevel=0.03)  # collar band
    with part("body"):
        box(0, 0, HIP + 0.3, TW + 0.06, TD + 0.06, 0.14, GREEN, bevel=0.03)
        can(0, fy - 0.04, HIP + 0.3, 0.13, 0.08, YEL, n=10, rot=X90)
        can(0, fy - 0.08, HIP + 0.3, 0.07, 0.04, RED, n=10, rot=X90)
    with part("chest"):
        for s in (-1, 1):
            can(s * 0.22, fy - 0.03, TOP - 0.18, 0.2, 0.05, GREEN_D, n=3, rot=(math.radians(90), s * math.radians(-30), 0))
            box(s * 0.2, fy - 0.01, HIP + 0.6, 0.1, 0.03, 0.1, GREEN)  # little round chest dots
    # arms: the right points the ray gun, the left carries the full bucket
    sx = TW * 0.5 + 0.08
    rh = (sx + 0.32, -0.35, TOP - 0.45)
    with part("arm.l"):
        limb((sx, 0, TOP - 0.15), (rh[0] - 0.05, rh[1] + 0.15, rh[2] + 0.15), 0.11, SILVER)
        can(sx + 0.24, -0.25, TOP - 0.38, 0.13, 0.1, GREEN, n=8)  # green cuffs
    with part("hand.l"):
        hand_mitt(*rh, 1, MITT, SKIN)
    # the ray gun points forward and out, tipped down, so it never swings into the hood
    mount(lambda: ray_gun(0, -0.05, 0), rh, tilt=(25, 0, 45))
    lh = (-sx - 0.18, -0.08, TOP - 0.66)
    with part("arm.r"):
        limb((-sx, 0, TOP - 0.15), (-sx - 0.16, -0.05, TOP - ARM_DROP), 0.11, SILVER)
        can(-sx - 0.15, -0.05, TOP - 0.5, 0.13, 0.1, GREEN, n=8)
    with part("hand.r"):
        hand_mitt(*lh, -1, MITT, SKIN)
    bucket(lh, full=True, size=0.65)
    with part("head"):
        _hood()


def _hood():
    # the green head-hood with the kid's face in the opening
    box(0, 0.2, HEAD_Z + 0.2, HEAD * 1.04, HEAD * 0.96, HEAD * 1.06, GREEN, bevel=0.55, segs=3)
    fz = HEAD_Z - 0.38
    box(0, -0.2, fz, HEAD * 0.76, HEAD * 0.76, HEAD * 0.56, LIME, bevel=0.36, segs=2)
    box(0, -0.27, fz, HEAD * 0.68, HEAD * 0.76, HEAD * 0.48, SKIN, bevel=0.32, segs=2)
    ffy = -0.27 - HEAD * 0.38
    face(0, fz + 0.02, ffy, HEAD * 0.72)
    # big glossy black alien eyes on the forehead, tilted
    hfy = 0.2 - HEAD * 0.48
    for s in (-1, 1):
        ex, ez = s * 0.62, HEAD_Z + 0.62
        ball(ex, hfy - 0.02, ez, 0.95, 0.24, 0.62, DARK, seg=12, ring=8, rot=(0, s * math.radians(-25), 0))
        ball(ex - 0.18 * s - 0.04, hfy - 0.13, ez + 0.1, 0.22, 0.06, 0.15, WHITE, seg=8, ring=4, rot=(0, s * math.radians(-25), 0))
        ball(ex + 0.2 * s, hfy - 0.12, ez - 0.12, 0.09, 0.05, 0.08, WHITE, seg=6, ring=4)
    # antennae: wobbly stalks with glowing balls
    top = HEAD_Z + 0.08 + HEAD * 0.55
    for s in (-1, 1):
        p0 = (s * 0.45, 0.15, top - 0.08)
        p1 = (s * 0.62, 0.05, top + 0.45)
        p2 = (s * 0.95, 0.0, top + 0.85)
        limb(p0, p1, 0.06, GREEN_D)
        limb(p1, p2, 0.06, GREEN_D)
        ball(*p1, 0.12, 0.12, 0.12, GREEN_D, seg=6, ring=4)
        ball(*p2, 0.42, 0.42, 0.42, GLOW if s < 0 else PINK, seg=10, ring=8)
        ball(p2[0] - 0.08, p2[1] - 0.17, p2[2] + 0.08, 0.1, 0.05, 0.1, WHITE, seg=6, ring=4)


if __name__ == "__main__" or True:
    run({"alien-green": build})
