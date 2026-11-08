"""Lamp: a harmless sight gag on the "sexy lamp" joke. A giant cream
lampshade with pink trim and bobble fringe sits over the kid's head (face
visible underneath), a glowing bulb with light rays pops out the top, a pull
cord with a brass bead hangs by the cheek. The body is a teal ceramic lamp
base on a wooden foot; a fluffy pink feather boa drapes over the shoulders,
one mitt on the hip in a pose, the other with the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
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
    # the lamp base: a wooden foot, a ceramic vase body, a brass neck
    can(0, 0, 0.62, 1.0, 0.16, WOOD, n=12)
    can(0, 0, 0.95, 0.7, 0.5, CERAMIC, n=12, r2=0.95)
    can(0, 0, 1.4, 0.95, 0.4, CERAMIC, n=12, r2=0.55)
    can(0, 0, 1.2, 0.97, 0.08, CERAMIC_D, n=12)
    can(0, 0, 1.7, 0.32, 0.25, BRASS, n=10)
    # arms: one mitt on the hip, elbow out; the other holds the bucket
    limb((-0.8, 0, 1.5), (-1.3, -0.05, 1.2), 0.12, CERAMIC)
    limb((-1.3, -0.05, 1.2), (-0.98, -0.12, 1.0), 0.12, CERAMIC)
    hand_mitt(-0.95, -0.12, 0.98, 1, MITT, SKIN)
    rh = (1.45, -0.25, 1.2)
    limb((0.8, 0, 1.5), rh, 0.12, CERAMIC)
    hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.66)
    # the feather boa: a fluffy chain over the shoulders, sagging across the front, ends hanging down
    pts = []
    for k in range(13):
        t = k / 12
        a = math.pi * (1 - t)
        pts.append((1.05 * math.cos(a), -0.72 * math.sin(a) - 0.05, 1.62 - 0.3 * math.sin(a)))
    pts += [(1.15, -0.2, 1.38), (1.2, -0.25, 1.12)]
    pts = [(-1.15, -0.15, 1.3), (-1.1, -0.2, 1.05)][::-1] + pts
    for i, p in enumerate(pts):
        ball(*p, 0.36, 0.36, 0.34, BOA if i % 2 else BOA_D, seg=6, ring=4)
        for j in range(3):
            a = (i * 2.3 + j * 2.1)
            limb(p, (p[0] + 0.24 * math.cos(a), p[1] - 0.1, p[2] + 0.24 * math.sin(a)), 0.05, BOA, n=4)
    # the head, the hair hidden under the shade
    box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)
    face(0, HEAD_Z - HEAD * 0.05, -HEAD * 0.46, HEAD)
    box(0, -HEAD * 0.44, 3.42, HEAD * 0.7, 0.14, 0.18, (0.25, 0.15, 0.09), bevel=0.05)   # a fringe peeking out
    # the lampshade: a cream frustum with pink trim and bobble fringe
    z0, z1, r0, r1 = 3.5, 4.6, 1.9, 1.25
    can(0, 0, (z0 + z1) / 2, r0, z1 - z0, SHADE, n=12, r2=r1)
    can(0, 0, z0 + 0.06, r0 + 0.04, 0.12, TRIM, n=12, r2=r0 - 0.02)
    can(0, 0, z1 - 0.05, r1 + 0.06, 0.1, TRIM, n=12, r2=r1 + 0.02)
    for k in range(12):
        a = 2 * math.pi * (k + 0.5) / 12
        x, y = (r0 - 0.08) * math.cos(a), (r0 - 0.08) * math.sin(a)
        limb((x, y, z0), (x, y, z0 - 0.16), 0.02, TRIM, n=4)
        ball(x, y, z0 - 0.2, 0.14, 0.14, 0.14, TRIM, seg=6, ring=4)
    # the socket, the glowing bulb and cartoon light rays
    can(0, 0, z1 + 0.1, 0.18, 0.2, BRASS, n=10)
    b = ball(0, 0, z1 + 0.4, 0.5, 0.5, 0.54, BULB, seg=10, ring=8)
    glow(b, 0.8)
    bc = (0, -0.1, z1 + 0.4)
    for deg in (10, 45, 90, 135, 170):
        a = math.radians(deg)
        r = limb((bc[0] + 0.4 * math.cos(a), bc[1], bc[2] + 0.38 * math.sin(a)), (bc[0] + 0.62 * math.cos(a), bc[1], bc[2] + 0.56 * math.sin(a)), 0.05, RAY, n=4)
        glow(r, 0.6)
    # the pull cord with a brass bead, hanging by the cheek
    limb((1.15, -1.25, z0 + 0.05), (1.15, -1.25, 2.6), 0.025, (0.9, 0.85, 0.7), n=4)
    ball(1.15, -1.25, 2.5, 0.2, 0.2, 0.2, BRASS, seg=8, ring=6)


if __name__ == "__main__" or True:
    run({"lamp": build})
