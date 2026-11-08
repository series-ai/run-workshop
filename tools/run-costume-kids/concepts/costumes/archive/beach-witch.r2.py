"""Beach witch: the same giant crooked witch hat (purple, green band, gold
buckle) now with a pink flower tucked in the band, on a kid in pink
sunglasses. A long-sleeved teal
rash guard, baggy orange board shorts with flowers, orange arm floaties,
bare legs and flip-flops. One mitten swings a blue sand bucket full of sand,
the other a yellow spade. Rendered with the taller witch camera."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403

HAT, HAT_D, BAND, GOLD = (0.46, 0.24, 0.66), (0.32, 0.15, 0.48), (0.36, 0.80, 0.30), (1.0, 0.78, 0.22)
RASH, RASH_D, SHORTS, FLOWER = (0.15, 0.76, 0.80), (0.08, 0.50, 0.62), (1.0, 0.52, 0.18), (1.0, 0.92, 0.35)
FLOATY, FRAME, LENS = (1.0, 0.42, 0.20), (1.0, 0.36, 0.62), (0.10, 0.12, 0.22)
HAIR, SOLE = (0.98, 0.80, 0.38), (0.98, 0.30, 0.55)
PAIL, PAIL_RIM, SAND, SPADE = (0.22, 0.52, 0.98), (1.0, 0.85, 0.15), (0.98, 0.86, 0.58), (1.0, 0.84, 0.12)
HIBISCUS = (1.0, 0.35, 0.55)


def bar(p0, p1, r0, r1, rgb, n=8):
    """A tapered bar from p0 (radius r0) to p1 (radius r1)."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def ring(x, y, z, R, r, rgb, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=10, minor_segments=6, location=(x, y, z), rotation=rot)
    return finish(bpy.context.object, rgb)


def witch_hat(bz):
    """The giant crooked witch hat sitting on the head, brim at z = bz (as in witch.py)."""
    rz = math.radians(22.5)
    can(0, 0, bz, 2.15, 0.16, HAT_D, n=12)                                   # the brim
    can(0, 0, bz + 0.1, 1.95, 0.08, HAT, n=12)
    can(0, 0, bz + 0.75, 1.5, 1.5, HAT, n=8, r2=0.98, rot=(0, 0, rz))
    can(0, 0, bz + 0.32, 1.48, 0.46, BAND, n=8, r2=1.35, rot=(0, 0, rz))        # the band
    pts = [(0, 0, bz + 1.5), (0.12, 0.2, bz + 2.6), (0.42, 0.42, bz + 3.45), (0.95, 0.5, bz + 3.95), (1.5, 0.4, bz + 3.85)]
    rad = [0.98, 0.68, 0.42, 0.22, 0.04]
    for i in range(len(pts) - 1):
        bar(pts[i], pts[i + 1], rad[i], rad[i + 1], HAT, n=8)
        if 0 < i + 1 < len(pts) - 1:
            ball(*pts[i + 1], rad[i + 1] * 2, rad[i + 1] * 2, rad[i + 1] * 2, HAT, seg=8, ring=6)
    ball(0, 0, bz + 1.5, 1.96, 1.96, 0.5, HAT, seg=8, ring=4)
    box(0.4, -0.8, bz + 1.95, 0.32, 0.05, 0.28, BAND, rot=(math.radians(14), 0, math.radians(20)))
    by = -1.42 * math.cos(rz) - 0.04
    box(0, by, bz + 0.32, 0.6, 0.07, 0.5, GOLD, bevel=0.04)
    box(0, by - 0.03, bz + 0.32, 0.34, 0.07, 0.26, BAND)
    # a big pink beach flower tucked in the band at the side
    fx, fy, fz = -1.0, -0.95, bz + 0.42
    for k in range(5):
        a = 2 * math.pi * k / 5
        ball(fx + 0.2 * math.cos(a), fy - 0.05, fz + 0.2 * math.sin(a), 0.32, 0.12, 0.32, HIBISCUS, seg=6, ring=4)
    ball(fx, fy - 0.12, fz, 0.14, 0.1, 0.14, FLOWER, seg=6, ring=4)


def floaty(x, y, z, rot):
    """An inflatable arm band on the upper arm."""
    ring(x, y, z, 0.2, 0.15, FLOATY, rot=rot)
    ball(x, y - 0.3, z + 0.02, 0.1, 0.12, 0.1, WHITE, seg=6, ring=4)  # the valve


def build():
    body(shirt=RASH, sleeve=RASH, pants=SHORTS, leg_colour=SKIN, shoe=SKIN, arms=False)
    # flip-flops: a pink sole under each bare foot and a V strap
    for s in (-1, 1):
        fx = s * TW * 0.24
        box(fx, -FOOT * 0.25, 0.02, FOOT * 0.86, FOOT * 1.26, 0.06, SOLE, bevel=0.02)
        for k in (-1, 1):
            limb((fx, -FOOT * 0.62, 0.22), (fx + k * FOOT * 0.33, -FOOT * 0.18, 0.22), 0.035, SOLE)
        for k in (-1, 0, 1):
            box(fx + k * 0.11, -FOOT * 0.25 - FOOT * 0.58, 0.12, 0.08, 0.04, 0.08, (0.9, 0.62, 0.5))  # toes
    # baggy board shorts down to the knees, with flowers and a drawstring
    for s in (-1, 1):
        box(s * 0.22, 0, HIP - 0.04, 0.44, TD * 0.9, 0.32, SHORTS, bevel=0.06)
    fy = -TD * 0.5 - 0.02
    for x, z in ((-0.28, HIP - 0.05), (0.3, HIP + 0.12), (0.05, HIP - 0.12)):
        ball(x, fy - 0.02, z, 0.14, 0.04, 0.14, FLOWER, seg=6, ring=4)
    box(0, fy, HIP + TH * 0.34, 0.06, 0.04, 0.14, WHITE)
    # the rash guard: a contrast stripe across the chest and down the sleeves
    box(0, fy, HIP + TH * 0.72, TW + 0.02, 0.04, 0.14, RASH_D)
    floaty(TW * 0.5 + 0.15, -0.02, TOP - 0.36, (0, math.radians(22), 0))
    floaty(-TW * 0.5 - 0.3, -0.1, TOP - 0.16, (0, math.radians(90), math.radians(-32)))
    # right mitten: the spade
    hx, hy, hz = hand_points()[1]
    limb((TW * 0.5 + 0.08, 0, TOP - 0.15), (TW * 0.5 + 0.24, -0.05, TOP - ARM_DROP), 0.11, RASH)
    hand_mitt(hx, hy, hz, 1, MITT, SKIN)
    limb((hx + 0.05, hy - 0.05, hz + 0.3), (hx + 0.15, hy - 0.15, hz - 0.55), 0.045, SPADE)
    box(hx + 0.17, hy - 0.17, hz - 0.65, 0.3, 0.06, 0.32, SPADE, bevel=0.06, rot=(0, math.radians(-10), 0))
    box(hx + 0.05, hy - 0.05, hz + 0.34, 0.24, 0.08, 0.08, SPADE)
    # left arm raised a little, swinging the sand pail
    sx = TW * 0.5 + 0.08
    bx, by, bz = -1.15, -0.3, TOP - 0.2
    limb((-sx, 0, TOP - 0.15), (bx + 0.12, by, bz + 0.05), 0.11, RASH)
    hand_mitt(bx, by, bz, -1, MITT, SKIN)
    top = bz - 0.32
    can(bx, by, top - 0.3, 0.26, 0.58, PAIL, n=8, r2=0.34)
    can(bx, by, top + 0.01, 0.36, 0.08, PAIL_RIM, n=8)
    ball(bx, by, top + 0.08, 0.62, 0.62, 0.3, SAND, seg=8, ring=4)
    for s in (-1, 1):
        limb((bx + s * 0.34, by, top), (bx + s * 0.18, by, bz + 0.3), 0.04, PAIL_RIM)
    limb((bx - 0.18, by, bz + 0.3), (bx + 0.18, by, bz + 0.3), 0.04, PAIL_RIM)
    ball(bx + 0.15, by - 0.36, top - 0.32, 0.18, 0.06, 0.18, WHITE, seg=6, ring=4)  # a starfish sticker
    # the head: beachy blonde hair, long down the sides
    w = HEAD
    box(0, 0, HEAD_Z, w, w * 0.92, w * 0.9, SKIN, bevel=w * 0.14, segs=2)
    box(0, w * 0.05, HEAD_Z + 0.62, w * 1.04, w * 0.98, 0.6, HAIR, bevel=0.2, segs=2)
    box(0, 0.3, HEAD_Z - 0.1, w * 1.08, w * 0.7, w * 0.95, HAIR, bevel=0.3, segs=2)
    for s in (-1, 1):
        box(s * w * 0.5, -0.45, HEAD_Z - 0.55, 0.36, 0.5, 1.0, HAIR, bevel=0.14, segs=2)
        box(s * w * 0.5, -0.45, HEAD_Z - 1.1, 0.3, 0.42, 0.3, HAIR, bevel=0.1, rot=(0, s * math.radians(25), 0))
    face(0, HEAD_Z - w * 0.05, -w * 0.46, w)
    # big pink sunglasses over the eyes and a white sunscreen stripe on the nose
    gy, gz = -w * 0.46 - 0.06, HEAD_Z + 0.02
    for s in (-1, 1):
        box(s * 0.55, gy, gz, 0.82, 0.08, 0.6, FRAME, bevel=0.14, segs=2)
        box(s * 0.55, gy - 0.05, gz - 0.01, 0.64, 0.06, 0.44, LENS, bevel=0.1, segs=2)
        box(s * 0.42, gy - 0.09, gz + 0.1, 0.14, 0.03, 0.08, WHITE)
        limb((s * 0.95, gy, gz + 0.1), (s * 1.24, -0.4, gz + 0.12), 0.04, FRAME)
    box(0, gy, gz + 0.08, 0.32, 0.08, 0.1, FRAME)
    witch_hat(HEAD_Z + 0.95)


if __name__ == "__main__" or True:
    out = sys.argv[sys.argv.index("--") + 1]
    render_costume("beach-witch", build, out, ortho=9.6, target_z=3.9)
