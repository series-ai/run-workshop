"""Ostrich rider: the classic "riding" costume. The kid sits in a big fluffy
black ostrich body round the waist (white wing tips and a white tail plume);
a long pink S-neck rises from the front, swung out to one side so the kid's
face stays clear, up to a little ostrich head with googly lashed eyes and an
orange beak. Fake little kid legs in jeans and red sneakers dangle over the
sides; the kid's real legs, in pink tights, and grey shoes are the ostrich's
legs and feet. One mitt holds the reins, the other the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

FEATHER, FEATHER_L, PLUME = (0.16, 0.14, 0.17), (0.28, 0.25, 0.3), (0.98, 0.97, 0.95)
NECK, NECK_D, BEAK, FOOTC = (1.0, 0.72, 0.68), (0.9, 0.56, 0.54), (1.0, 0.6, 0.15), (0.55, 0.52, 0.56)
JEANS, SNEAK, SHIRT, REIN = (0.25, 0.42, 0.78), (0.95, 0.25, 0.3), (1.0, 0.82, 0.15), (0.6, 0.3, 0.12)


def chain(pts, r, rgb):
    for a, b in zip(pts, pts[1:]):
        limb(a, b, r, rgb, n=8)
    for p in pts:
        ball(*p, r * 2, r * 2, r * 2, rgb, seg=8, ring=6)


def build():
    body(pants=NECK, leg_colour=NECK, shoe=FOOTC, torso=False, arms=False)
    for s in (-1, 1):  # toe claws on the "ostrich feet"
        for k in (-1, 0, 1):
            can(s * TW * 0.24 + k * 0.12, -FOOT * 0.25 - FOOT * 0.6, 0.08, 0.06, 0.16, DARK, n=4, r2=0.0, rot=(math.radians(90), 0, 0))
    # the fluffy body round the kid's waist
    bz = 1.25
    box(0, 0.3, bz, 3.0, 3.1, 1.35, FEATHER, bevel=0.6, segs=3)
    import random
    rnd = random.Random(3)
    for i in range(16):  # feather fluff along the rim
        a = 2 * math.pi * i / 16
        x, y = 1.45 * math.cos(a), 0.3 + 1.5 * math.sin(a)
        ball(x, y, bz + rnd.uniform(-0.35, 0.1), 0.55, 0.55, 0.5, FEATHER_L if i % 2 else FEATHER, seg=7, ring=5)
    for s in (-1, 1):  # white wing tips
        box(s * 1.45, 0.75, bz + 0.15, 0.4, 1.7, 0.95, FEATHER_L, bevel=0.18, segs=2, rot=(math.radians(-12), 0, 0))
        ball(s * 1.6, 1.45, bz + 0.0, 0.42, 0.9, 0.75, PLUME, seg=8, ring=6)
        ball(s * 1.6, 1.85, bz + 0.2, 0.36, 0.6, 0.55, PLUME, seg=8, ring=6)
    # the white tail plume, fanning up behind
    for k, (dx, dz, sz) in enumerate(((0, 0.55, 0.75), (-0.38, 0.4, 0.6), (0.38, 0.4, 0.6), (0, 0.95, 0.55), (-0.25, 0.85, 0.45), (0.25, 0.85, 0.45))):
        ball(dx * 1.3, 1.85 + dz * 0.3, bz + dz * 1.3, sz * 1.25, sz, sz * 1.25, PLUME, seg=8, ring=6)
    # a saddle-blanket stripe the kid sits in
    box(0, 0.0, bz + 0.6, 1.3, 1.2, 0.2, SHIRT, bevel=0.08)
    # the fake legs dangling over the sides, jeans and red sneakers
    for s in (-1, 1):
        k = (s * 1.75, -0.45, bz + 0.25)
        limb((s * 0.8, -0.45, bz + 0.55), k, 0.13, JEANS)
        ball(*k, 0.27, 0.27, 0.27, JEANS, seg=8, ring=6)
        f = (s * 1.82, -0.52, bz - 0.5)
        limb(k, f, 0.12, JEANS)
        box(f[0], f[1] - 0.12, f[2] - 0.12, 0.3, 0.46, 0.24, SNEAK, bevel=0.07, segs=2)
    # the kid's arms: the left holds the reins, the right the bucket
    lh = (-0.85, -0.95, 1.85)
    limb((-0.55, -0.2, 1.75), lh, 0.11, SHIRT)
    hand_mitt(*lh, -1, MITT, SKIN)
    rh = (1.55, -0.65, 1.75)
    limb((0.55, -0.2, 1.75), rh, 0.11, SHIRT)
    hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.6)
    # the kid's head
    kid_head(hair=(0.3, 0.17, 0.09))
    # the long S-neck from the front of the body, swung out to the left
    neck = [(-0.5, -1.2, 1.5), (-1.45, -1.6, 2.0), (-1.9, -1.75, 2.95), (-1.85, -1.85, 3.95)]
    chain(neck, 0.25, NECK)
    for k in range(5):  # a fluffy ruff at the neck base
        a = math.radians(-60 + 30 * k)
        ball(-0.5 + 0.45 * math.sin(a), -1.1 - 0.3 * math.cos(a), 1.6, 0.5, 0.5, 0.45, FEATHER, seg=7, ring=5)
    limb(lh, (-1.45, -1.6, 2.05), 0.035, REIN)
    # the ostrich head: a little egg with googly eyes, a beak and a tuft
    hx, hy, hz = -1.85, -2.05, 4.45
    S = 1.45
    ball(hx, hy, hz, 0.8 * S, 0.85 * S, 0.75 * S, NECK, seg=10, ring=7)
    box(hx, hy - 0.55 * S, hz - 0.1 * S, 0.5 * S, 0.6 * S, 0.22 * S, BEAK, bevel=0.1, segs=2)
    box(hx, hy - 0.5 * S, hz - 0.24 * S, 0.42 * S, 0.5 * S, 0.1 * S, (0.9, 0.48, 0.1), bevel=0.04)
    for s in (-1, 1):
        ex = hx + s * 0.18 * S
        ball(ex, hy - 0.33 * S, hz + 0.18 * S, 0.3 * S, 0.12 * S, 0.34 * S, WHITE, seg=8, ring=6)
        ball(ex, hy - 0.39 * S, hz + 0.15 * S, 0.15 * S, 0.06 * S, 0.2 * S, DARK, seg=8, ring=5)
        for j in (-1, 0, 1):  # lashes
            limb((ex + j * 0.08 * S, hy - 0.36 * S, hz + 0.33 * S), (ex + j * 0.13 * S, hy - 0.4 * S, hz + 0.45 * S), 0.025, DARK, n=4)
    for j in (-1, 0, 1):  # a scruffy tuft
        limb((hx, hy, hz + 0.3 * S), (hx + j * 0.2, hy + 0.05, hz + 0.85), 0.06, FEATHER_L, n=5)
        ball(hx + j * 0.2, hy + 0.05, hz + 0.88, 0.18, 0.18, 0.18, FEATHER_L, seg=6, ring=4)


if __name__ == "__main__" or True:
    render_costume("ostrich-rider", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
