"""Lamp: a harmless sight gag on the "sexy lamp" joke. A giant cream
lampshade with pink trim and bobble fringe swallows the kid's whole head down
to the shoulders (just the kid's eyes peek out of two little holes), a glowing
bulb with light rays pops out the top, a pull cord with a brass bead hangs
from under the shade. The body is the lamp stand: a fat
teal ceramic belly with a brass neck on a round wooden foot on the ground, one mitt on the
hip in a sassy pose, the other with the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

SHADE, TRIM, BOA, BOA_D = (1.0, 0.92, 0.74), (0.95, 0.42, 0.6), (1.0, 0.55, 0.78), (0.95, 0.4, 0.68)
CERAMIC, CERAMIC_D, WOOD, BRASS = (0.2, 0.72, 0.72), (0.14, 0.56, 0.58), (0.45, 0.28, 0.15), (0.92, 0.72, 0.26)
BULB, RAY = (1.0, 0.88, 0.35), (1.0, 0.8, 0.2)


def glow(o, strength=2.5):
    m = o.data.materials[0].copy()
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    for name in ("Emission Color", "Emission"):
        if name in bsdf.inputs:
            bsdf.inputs[name].default_value = (1.0, 0.85, 0.35, 1.0)
            break
    if "Emission Strength" in bsdf.inputs:
        bsdf.inputs["Emission Strength"].default_value = strength
    o.data.materials[0] = m


def build():
    body(shirt=CERAMIC, pants=CERAMIC, leg_colour=(0.97, 0.97, 0.97), shoe=WOOD, torso=False, arms=False)
    # the lamp base: a round wooden foot, a fat ceramic belly, a brass neck up into the shade
    can(0, 0, 0.07, 1.2, 0.14, WOOD, n=12, r2=1.05)
    can(0, 0, 0.17, 1.0, 0.07, BRASS, n=12)
    can(0, 0, 0.5, 0.42, 0.3, BRASS, n=10, r2=0.6)
    ball(0, 0, 1.1, 1.6, 1.35, 1.15, CERAMIC, seg=12, ring=8)
    can(0, 0, 1.12, 0.79, 0.12, CERAMIC_D, n=12)
    for k in range(6):  # little dots round the belly
        a = 2 * math.pi * (k + 0.5) / 6
        ball(0.78 * math.cos(a), 0.66 * math.sin(a), 1.32, 0.14, 0.14, 0.14, WHITE, seg=6, ring=4)
    can(0, 0, 1.68, 0.2, 0.36, BRASS, n=10)
    # arms: one mitt on the hip, elbow out (a sassy pose); the other holds the bucket
    limb((-0.6, 0, 1.3), (-1.2, -0.05, 1.1), 0.12, CERAMIC)
    limb((-1.2, -0.05, 1.1), (-0.85, -0.15, 0.92), 0.12, CERAMIC)
    hand_mitt(-0.82, -0.15, 0.92, 1, MITT, SKIN)
    rh = (1.45, -0.25, 1.05)
    limb((0.6, 0, 1.3), rh, 0.12, CERAMIC)
    hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.66)
    # the head is under there (hidden): the standard head box
    box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)
    # the giant lampshade over the whole head, from the shoulders up: cream, pink trim, bobble fringe
    z0, z1, r0, r1 = HEAD_Z - HEAD * 0.47, HEAD_Z + HEAD * 0.6, 2.05, 1.4
    rz = (0, 0, math.radians(15))      # a flat panel facing the camera
    can(0, 0, (z0 + z1) / 2, r0, z1 - z0, SHADE, n=12, r2=r1, rot=rz)
    can(0, 0, z0 + 0.07, r0 + 0.05, 0.14, TRIM, n=12, r2=r0 - 0.02, rot=rz)
    can(0, 0, z1 - 0.06, r1 + 0.07, 0.12, TRIM, n=12, r2=r1 + 0.02, rot=rz)
    can(0, 0, z1 + 0.005, r1 - 0.02, 0.01, (0.95, 0.82, 0.6), n=12, rot=rz)
    for k in range(12):
        a = 2 * math.pi * k / 12 + math.radians(15)
        x, y = (r0 - 0.1) * math.cos(a), (r0 - 0.1) * math.sin(a)
        limb((x, y, z0), (x, y, z0 - 0.1), 0.025, TRIM, n=4)
        ball(x, y, z0 - 0.14, 0.14, 0.14, 0.14, TRIM, seg=6, ring=4)
    # the kid's eyes peeking through two little holes in the shade, at the kid's eye height
    tilt = math.atan((r0 - r1) / (z1 - z0))
    ez = HEAD_Z - HEAD * 0.05 + HEAD * 0.05
    rf = r0 - (r0 - r1) * (ez - z0) / (z1 - z0)
    fy = -rf * math.cos(math.radians(15)) - 0.02
    for sx in (-1, 1):
        ex = sx * HEAD * 0.22
        ball(ex, fy, ez, 0.62, 0.1, 0.5, (0.2, 0.12, 0.08), seg=10, ring=6, rot=(-tilt, 0, 0))
        ball(ex, fy - 0.04, ez - 0.02, 0.32, 0.08, 0.32, DARK, seg=8, ring=6, rot=(-tilt, 0, 0))
        ball(ex - 0.07, fy - 0.08, ez + 0.06, 0.1, 0.04, 0.1, WHITE, seg=6, ring=4)
    # the socket, the glowing bulb and cartoon light rays
    can(0, 0, z1 + 0.1, 0.2, 0.2, BRASS, n=10)
    b = ball(0, 0, z1 + 0.42, 0.56, 0.56, 0.6, BULB, seg=10, ring=8)
    glow(b, 0.8)
    bc = (0, -0.1, z1 + 0.42)
    for deg in (10, 50, 90, 130, 170):
        a = math.radians(deg)
        r = limb((bc[0] + 0.42 * math.cos(a), bc[1], bc[2] + 0.4 * math.sin(a)), (bc[0] + 0.64 * math.cos(a), bc[1], bc[2] + 0.58 * math.sin(a)), 0.05, RAY, n=4)
        glow(r, 0.6)
    # the pull cord with a brass bead, hanging from under the shade
    limb((1.15, -1.3, z0 + 0.05), (1.15, -1.3, 1.0), 0.03, (0.9, 0.85, 0.7), n=4)
    ball(1.15, -1.3, 0.9, 0.24, 0.24, 0.24, BRASS, seg=8, ring=6)


if __name__ == "__main__" or True:
    run({"lamp": build})
