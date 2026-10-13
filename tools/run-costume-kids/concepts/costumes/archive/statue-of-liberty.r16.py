"""Statue of Liberty: the kid as the copper-green statue. A giant spiked
crown: a mint band with little blue windows and seven huge pointed rays
fanning out around the head. A long mint-green robe to the floor with fold
ridges and a drape over the left shoulder, mint sandals. One mitt
holds the torch up and out (a gold cup and a big orange flame); the other
holds the tablet against the robe. Both hands busy, so no bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403

R = math.radians
FY = -HEAD * 0.46
SX = TW * 0.5 + 0.08
MINT, MINT_L, MINT_D = (0.50, 0.86, 0.72), (0.68, 0.95, 0.82), (0.32, 0.68, 0.56)
WINDOW, GOLD, FLAME, FLAME_IN = (0.20, 0.38, 0.62), (1.0, 0.80, 0.20), (1.0, 0.50, 0.10), (1.0, 0.88, 0.25)


def bar(p0, p1, r0, r1, rgb, n=6):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def build():
    body(shirt=MINT, pants=MINT, leg_colour=MINT, shoe=MINT_D, arms=False, torso=False)
    # the robe: a long mint column to the floor, fold ridges, a drape across
    with part("body"):
        can(0, 0, 0.9, 0.46, 0.6, MINT, n=10)  # a straight column past the mitts
        can(0, 0, 0.52, 0.5, 0.2, MINT, n=10, r2=0.8, rot=(R(180), 0, 0))  # the flared hem, clear of the shoes
        for k in range(-2, 3):
            x = k * 0.18
            bar((x * 1.6, -0.74, 0.45), (x * 0.8, -0.44, 1.05), 0.07, 0.05, MINT_D, n=6)
    with part("chest"):
        box(0, 0, HIP + TH * 0.6, TW * 0.95, TD * 0.92, TH * 0.85, MINT, bevel=0.1)
        box(0.05, -TD * 0.5 - 0.04, HIP + 0.55, 0.34, 0.1, 1.15, MINT_L, bevel=0.05, rot=(0, R(-40), 0))
        box(0.05, TD * 0.5 + 0.04, HIP + 0.55, 0.34, 0.1, 1.15, MINT_L, bevel=0.05, rot=(0, R(40), 0))
        can(0, 0, TOP + 0.03, 0.5, 0.14, MINT_L, n=10, r2=0.38)
    hp = hand_points()
    for s in (-1, 1):  # mint sleeves hanging in the standard pose, a shoulder puff, skin mitts
        sx = s * SX
        side = "l" if s > 0 else "r"
        with part(f"arm.{side}"):
            limb((sx, 0, TOP - 0.15), (sx + s * 0.16, -0.05, TOP - ARM_DROP), 0.12, MINT)
            ball(sx + s * 0.05, 0, TOP - 0.1, 0.4, 0.4, 0.34, MINT_L, seg=8, ring=5)
        with part(f"hand.{side}"):
            hand_mitt(*hp[s], s, MITT, SKIN)
    # the left mitt holds the torch up and out past the crown: a handle, a gold cup and a big flame
    with part("prop.l"):
        g = Vector(hp[1])
        d = Vector((math.sin(R(68)), 0, math.cos(R(68))))
        top = g + d * 1.3
        bar(g - d * 0.3, top, 0.11, 0.17, MINT_D, n=8)  # the handle
        tx, ty, tz = top.x + 0.05, g.y, top.z
        can(tx, ty, tz + 0.05, 0.2, 0.22, MINT_L, n=8, r2=0.28)  # the knob
        can(tx, ty, tz + 0.27, 0.28, 0.24, GOLD, n=10, r2=0.4)  # the cup
        can(tx, ty, tz + 0.41, 0.43, 0.07, GOLD, n=10)  # the rim
        # the flame: a teardrop, an orange outside and a yellow heart
        ball(tx, ty, tz + 0.85, 0.75, 0.68, 0.88, FLAME, seg=10, ring=7)
        can(tx + 0.04, ty, tz + 1.48, 0.3, 0.72, FLAME, n=8, r2=0.0, rot=(0, R(-8), 0))
        ball(tx, ty - 0.2, tz + 0.8, 0.44, 0.4, 0.52, FLAME_IN, seg=8, ring=6)
        can(tx + 0.02, ty - 0.2, tz + 1.17, 0.16, 0.4, FLAME_IN, n=6, r2=0.0)
    # the right mitt holds the tablet up against the robe
    with part("prop.r"):
        rx, ry, rz = hp[-1]
        t = (R(-8), R(10), 0)
        tb = (rx - 0.3, ry - 0.22, rz - 0.15)
        box(*tb, 0.78, 0.18, 0.95, MINT_L, bevel=0.06, rot=t)
        for k, w in enumerate((0.42, 0.32, 0.5)):
            box(tb[0], tb[1] - 0.11, tb[2] + 0.24 - k * 0.22, w, 0.04, 0.07, MINT_D, rot=t)
    with part("head"):
        # the head, mint hair
        box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)
        face(0, HEAD_Z - HEAD * 0.05, FY, HEAD)
        box(0, HEAD * 0.06, HEAD_Z + HEAD * 0.3, HEAD * 1.06, HEAD * 1.0, HEAD * 0.4, MINT_D, bevel=HEAD * 0.14, segs=2)
        box(0, 0.35, HEAD_Z - 0.15, HEAD * 1.04, 0.8, HEAD * 0.7, MINT_D, bevel=0.3, segs=2)
        # the crown: a band with windows over the hair, seven huge rays fanning out
        cz = HEAD_Z + HEAD * 0.42
        box(0, 0.05, cz, HEAD * 1.12, HEAD * 1.06, 0.55, MINT, bevel=0.18, segs=2)
        box(0, 0.05, cz + 0.32, HEAD * 0.9, HEAD * 0.86, 0.2, MINT_L, bevel=0.08)
        for k in range(7):
            x = (k - 3) * 0.32
            box(x, 0.05 - HEAD * 0.53 - 0.02, cz, 0.18, 0.06, 0.2, WINDOW)
        ball(0, 0.05 - HEAD * 0.53 - 0.08, cz + 0.02, 0.28, 0.14, 0.28, MINT_L, seg=8, ring=5)  # a front stud
        hub = Vector((0, 0.2, cz - 0.2))
        for k in range(7):
            a = R(-78 + k * 26)
            d = Vector((math.sin(a), 0.12, math.cos(a))).normalized()
            p0 = hub + Vector((math.sin(a) * 1.15, 0, math.cos(a) * 0.5 + 0.2))
            L = 2.4 if k != 3 else 2.7
            bar(p0, p0 + d * L, 0.42, 0.02, MINT_L if k % 2 == 0 else MINT, n=4)


if __name__ == "__main__" or True:
    render_costume("statue-of-liberty", build, sys.argv[sys.argv.index("--") + 1], ortho=10.5, target_z=4.3)
