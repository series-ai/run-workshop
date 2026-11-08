"""UFO: a kid wearing a flying saucer. A wide silver saucer ring round the
waist on two shoulder straps, with a teal band and coloured bulbs all round
the rim and a glowing underside; no dome (no glass): the kid's own head and
shoulders are the pilot sitting up out of the saucer, wearing a teal pilot
headband with two tall springy antennae topped with glowing bulbs. A little
green alien plush rides on the rim, waving. Carries the empty bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket
import bmesh  # noqa: E402


METAL, METAL_D, TEAL, GLOW = (0.80, 0.83, 0.90), (0.58, 0.62, 0.72), (0.2, 0.8, 0.75), (0.6, 1.0, 0.55)
SHIRT, PLUSH, PLUSH_D = (0.45, 0.32, 0.85), (0.45, 0.85, 0.35), (0.3, 0.65, 0.22)
BULBS = [(1.0, 0.3, 0.35), (1.0, 0.85, 0.15), (0.3, 0.75, 1.0), (0.45, 0.95, 0.4)]
HAIR = (0.3, 0.17, 0.09)


def lamp(o, rgb, strength=1.5):
    """An opaque glowing material (emission, not transparency) on o."""
    m = bpy.data.materials.new("lamp")
    m.use_nodes = True
    m.diffuse_color = (*rgb, 1.0)
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    lin = (*[c ** 2.2 for c in rgb], 1.0)
    bsdf.inputs["Base Color"].default_value = lin
    bsdf.inputs["Emission Color"].default_value = lin
    bsdf.inputs["Emission Strength"].default_value = strength
    o.data.materials.clear()
    o.data.materials.append(m)
    return o


def plush(x, y, z):
    """A tiny alien plush sitting on the rim: a bean body, a big head, one eye, antennae, a waving arm."""
    box(x, y, z + 0.18, 0.32, 0.28, 0.36, PLUSH, bevel=0.1, segs=2)
    box(x, y, z + 0.6, 0.56, 0.48, 0.48, PLUSH, bevel=0.16, segs=2)
    ball(x, y - 0.24, z + 0.62, 0.26, 0.06, 0.26, WHITE, seg=8, ring=4)
    ball(x, y - 0.27, z + 0.61, 0.13, 0.04, 0.13, DARK, seg=6, ring=4)
    box(x, y - 0.25, z + 0.46, 0.12, 0.03, 0.03, DARK)
    for s in (-1, 1):
        limb((x + s * 0.12, y, z + 0.8), (x + s * 0.24, y, z + 1.06), 0.025, PLUSH_D)
        ball(x + s * 0.24, y, z + 1.08, 0.1, 0.1, 0.1, GLOW, seg=6, ring=4)
        box(x + s * 0.09, y - 0.1, z + 0.02, 0.13, 0.2, 0.08, PLUSH_D, bevel=0.03)  # feet dangling
    limb((x + 0.16, y, z + 0.28), (x + 0.32, y - 0.05, z + 0.48), 0.05, PLUSH)   # waving arm
    limb((x - 0.16, y, z + 0.28), (x - 0.26, y - 0.05, z + 0.1), 0.05, PLUSH)


def build():
    body(shirt=SHIRT, pants=METAL_D, shoe=METAL_D, arms=False)
    sz, R = HIP + 0.3, 1.95
    with part("body"):
        # the saucer ring round the waist: an upper and a lower dish, a teal band, bulbs
        can(0, 0, sz + 0.24, R, 0.26, METAL, n=16, r2=R * 0.68)
        can(0, 0, sz + 0.47, R * 0.68, 0.2, SHIRT, n=16, r2=R * 0.45)
        can(0, 0, sz - 0.13, R * 0.5, 0.26, METAL_D, n=16, r2=R)
        can(0, 0, sz - 0.3, R * 0.4, 0.1, GLOW, n=16)
        can(0, 0, sz + 0.03, R + 0.04, 0.22, TEAL, n=16)
        for k in range(12):
            a = 2 * math.pi * (k + 0.5) / 12
            ball((R + 0.06) * math.cos(a), (R + 0.06) * math.sin(a), sz + 0.03, 0.26, 0.26, 0.26, BULBS[k % 4], seg=6, ring=4)
        for k in range(6):  # glowing ports underneath
            a = 2 * math.pi * k / 6
            ball(R * 0.72 * math.cos(a), R * 0.72 * math.sin(a), sz - 0.16, 0.2, 0.2, 0.1, GLOW, seg=6, ring=3)
        # the alien plush riding on the rim, front right
        a = math.radians(-50)
        plush(R * 0.8 * math.cos(a), R * 0.8 * math.sin(a), sz + 0.18)
    with part("chest"):
        # shoulder straps holding it up
        for s in (-1, 1):
            box(s * 0.28, -TD * 0.5 - 0.02, (sz + TOP) / 2 + 0.05, 0.14, 0.05, TOP - sz + 0.1, METAL_D)
            box(s * 0.28, TD * 0.5 + 0.02, (sz + TOP) / 2 + 0.05, 0.14, 0.05, TOP - sz + 0.1, METAL_D)
            box(s * 0.28, 0, TOP + 0.02, 0.14, TD + 0.09, 0.05, METAL_D)
    # arms out of the saucer's dome, over the rim: the left rests on the saucer, the right
    # reaches out past the rim with the empty bucket. Each sleeve comes out of the dome and
    # moves with its mitt (a hanging arm would sink into the saucer)
    rh = (1.7, -0.4, 1.14)
    with part("hand.l"):
        limb((0.95, -0.12, TOP - 0.05), (rh[0] - 0.15, rh[1] + 0.05, rh[2]), 0.11, SHIRT)
        hand_mitt(*rh, 1, MITT, SKIN)
    lh = (-2.2, -0.35, TOP - 0.02)
    with part("hand.r"):
        limb((-0.9, -0.1, TOP - 0.1), (lh[0] + 0.15, lh[1] + 0.05, lh[2] + 0.05), 0.11, SHIRT)
        hand_mitt(*lh, -1, MITT, SKIN)
    bucket(lh, full=False, size=0.55)
    with part("head"):
        # the pilot: the kid's standard head sitting up out of the saucer, a teal
        # headband with two tall springy antennae and glowing bulbs
        head_cube(0, HEAD_Z, HEAD, SKIN, HAIR)
        hb = HEAD_Z + HEAD * 0.3
        box(0, HEAD * 0.05, hb, HEAD * 1.1, HEAD * 1.04, 0.26, TEAL, bevel=0.08, segs=2)
        box(0, -HEAD * 0.5, hb, 0.5, 0.1, 0.34, METAL, bevel=0.05)        # a badge on the band
        can(0, -HEAD * 0.5 - 0.06, hb, 0.1, 0.06, (1.0, 0.3, 0.35), n=8, rot=(math.radians(90), 0, 0))
        top = HEAD_Z + HEAD * 0.48
        for s in (-1, 1):
            x0 = s * HEAD * 0.32
            pts = [(x0, 0.1, top - 0.05), (x0 + s * 0.2, 0.1, top + 0.35), (x0 + s * 0.45, 0.05, top + 0.62), (x0 + s * 0.68, 0.0, top + 0.85)]
            can(x0, 0.1, top, 0.2, 0.14, METAL_D, n=10)
            for k, (a_, b_) in enumerate(zip(pts, pts[1:])):
                limb(a_, b_, 0.06, METAL_D, n=6)
                ball(*b_, 0.2, 0.2, 0.2, TEAL if k < 2 else METAL_D, seg=6, ring=4)   # spring coils
            lamp(ball(*pts[-1], 0.5, 0.5, 0.5, BULBS[3], seg=8, ring=6), BULBS[3], 0.6)


if __name__ == "__main__" or True:
    run({"ufo": build})
