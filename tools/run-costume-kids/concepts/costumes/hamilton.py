"""Hamilton: the kid in a navy colonial long coat (big red cuffs, gold
buttons, tails at the back), a cream waistcoat, a big white jabot ruffle,
buff breeches, white stockings and black buckle shoes, a black tricorn with
a gold trim and a cockade, auburn hair tied back in a ponytail with a black
ribbon. A big quill in the right mitten, the full bucket in the left."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

COAT, CUFF, GOLD = (0.13, 0.20, 0.52), (0.85, 0.18, 0.18), (1.0, 0.78, 0.18)
VEST, BREECH, STOCK = (1.0, 0.94, 0.78), (0.86, 0.74, 0.52), (0.98, 0.98, 0.98)
HAIR, RIBBON, HAT, SHOE_B = (0.62, 0.28, 0.12), (0.08, 0.07, 0.09), (0.10, 0.09, 0.12), (0.10, 0.08, 0.10)


def bar(p0, p1, r0, r1, rgb, n=6):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def tricorn(z, r):
    """A three-cornered hat sitting at z, one corner to the front (-y)."""
    rz = math.pi
    can(0, 0, z + 0.22, r, 0.44, HAT, n=3, r2=r * 0.86, rot=(0, 0, rz))
    can(0, 0, z + 0.47, r * 0.88, 0.07, GOLD, n=3, rot=(0, 0, rz))
    can(0, 0, z + 0.54, r * 0.76, 0.1, HAT, n=3, rot=(0, 0, rz))
    can(0, 0.1, z + 0.72, r * 0.46, 0.4, HAT, n=8, r2=r * 0.34)
    return -r


def build():
    body(shirt=VEST, pants=BREECH, leg_colour=STOCK, shoe=SHOE_B, arms=False)
    # gold shoe buckles
    for s in (-1, 1):
        with part("foot.l" if s > 0 else "foot.r"):
            box(s * TW * 0.24, -FOOT * 0.5, FOOT * 0.42, 0.22, 0.12, 0.08, GOLD)
            box(s * TW * 0.24, -FOOT * 0.5 - 0.01, FOOT * 0.42, 0.1, 0.12, 0.04, SHOE_B)
    # the coat: back and sides over the torso, open at the front on the waistcoat
    cz = HIP + TH * 0.62
    fy = -TD * 0.5
    with part("chest"):
        box(0, 0.08, cz, TW + 0.1, TD - 0.05, TH * 0.82, COAT, bevel=0.07)
        for s in (-1, 1):
            box(s * (TW * 0.5 - 0.06), fy - 0.02, cz, 0.24, 0.12, TH * 0.82, COAT, bevel=0.03)
            for z in (cz - 0.22, cz, cz + 0.22):
                ball(s * (TW * 0.5 - 0.17), fy - 0.09, z, 0.1, 0.07, 0.1, GOLD, seg=6, ring=4)
        # waistcoat buttons
        for z in (cz - 0.15, cz + 0.05):
            ball(0, fy - 0.03, z, 0.07, 0.05, 0.07, GOLD, seg=6, ring=4)
        # the jabot: a big white ruffle under the chin
        for i, (z, r) in enumerate(((TOP + 0.02, 0.2), (TOP - 0.15, 0.24), (TOP - 0.32, 0.2))):
            can(0, fy - 0.12 - i * 0.02, z, r, 0.2, STOCK, n=6, r2=r * 0.55, rot=(math.radians(180), 0, 0))
        can(0, 0, TOP + 0.05, 0.42, 0.18, STOCK, n=8)  # the stock (collar)
    with part("body"):
        for s in (-1, 1):
            # the coat skirts at the sides, falling to the knees
            box(s * (TW * 0.5 - 0.02), 0.08, HIP - 0.02, 0.2, TD - 0.05, 0.62, COAT, bevel=0.04, rot=(0, s * math.radians(-8), 0))
        # the tails at the back, split in two
        for s in (-1, 1):
            box(s * 0.22, TD * 0.5 + 0.08, HIP - 0.02, 0.4, 0.1, 0.66, COAT, bevel=0.03, rot=(math.radians(10), 0, 0))
    # right arm: the quill
    sx = TW * 0.5 + 0.08
    with part("arm.l"):
        limb((sx, 0, TOP - 0.15), (sx + 0.16, -0.05, TOP - ARM_DROP), 0.12, COAT)
        can(sx + 0.17, -0.06, TOP - 0.47, 0.18, 0.18, CUFF, n=6)
    rx, ry, rz = sx + 0.18, -0.08, TOP - 0.66
    with part("hand.l"):
        hand_mitt(rx, ry, rz, 1, MITT, SKIN)
    with part("prop.l"):  # the quill: shaft, feather and nib
        # it leans well out to the side, the feather clear of the head
        bar((rx - 0.08, ry - 0.2, rz - 0.15), (rx + 0.8, ry - 0.4, rz + 0.8), 0.03, 0.02, (0.9, 0.85, 0.7), n=4)
        ball(rx + 0.55, ry - 0.36, rz + 0.52, 0.4, 0.1, 1.0, STOCK, seg=6, ring=6, rot=(math.radians(-10), math.radians(42), 0))
        can(rx - 0.12, ry - 0.18, rz - 0.26, 0.035, 0.12, DARK, n=4, r2=0.0, rot=(math.radians(170), math.radians(-42), 0))  # the nib
    # left arm up with the full bucket
    hx, hy, hz = -1.15, -0.3, TOP - 0.2
    with part("arm.r"):
        limb((-sx, 0, TOP - 0.15), (hx + 0.12, hy, hz + 0.05), 0.12, COAT)
        bar((hx + 0.3, hy + 0.0, hz + 0.05), (hx + 0.15, hy, hz + 0.05), 0.2, 0.2, CUFF)
    with part("hand.r"):
        hand_mitt(hx, hy, hz, -1, MITT, SKIN)
    bucket((hx, hy, hz), full=True, size=0.6)
    # the head: the default kid with auburn hair, tied back
    kid_head(hair=HAIR)
    with part("head"):  # the ponytail, its ribbon, the tricorn and the cockade
        bz = HEAD_Z + 0.25
        by = HEAD * 0.5 + 0.08
        o = bar((0, by - 0.1, bz), (0, by + 0.1, bz - 1.0), 0.26, 0.1, HAIR, n=6)  # the ponytail
        for s in (-1, 1):
            o = can(s * 0.2, by + 0.05, bz, 0.2, 0.3, RIBBON, n=4, r2=0.06, rot=(0, s * math.radians(-90), 0))
        ball(0, by + 0.06, bz, 0.16, 0.16, 0.16, RIBBON, seg=6, ring=4)
        # the hat, with a black cockade on the side
        hz = HEAD_Z + HEAD * 0.45 + 0.1
        tricorn(hz, 2.5)
        ball(-0.85, -1.22, hz + 0.3, 0.46, 0.2, 0.46, RIBBON, seg=8, ring=5, rot=(0, 0, math.radians(-30)))
        ball(-0.9, -1.32, hz + 0.3, 0.16, 0.1, 0.16, GOLD, seg=6, ring=4)


if __name__ == "__main__" or True:
    run({"hamilton": build})
