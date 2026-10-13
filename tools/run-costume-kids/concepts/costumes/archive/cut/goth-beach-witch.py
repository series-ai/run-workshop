"""Goth beach witch: the beach witch gone gloomy, all in black. A giant
crooked black witch hat with a charcoal band, a silver-white buckle, a white
bow, white lace scallops round the brim and a little spider dangling off it,
on a black-haired kid in black sunglasses. A modest black kids' two-piece
(tankini top with wide straps, white dots and lace hem; frilly swim bottoms),
black floaties and flip-flops. One mitten holds up a black lace parasol, the
other the pumpkin candy bucket. Rendered with the taller witch camera."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../../.."))  # tools/run-costume-kids
import math
from mathutils import Euler, Vector
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket, mount  # noqa: E402

# all black, in a few blacks and charcoals so the shapes still read, plus little white accents
HAT, HAT_D, BAND, GOLD = (0.11, 0.10, 0.12), (0.05, 0.05, 0.06), (0.24, 0.24, 0.26), (0.92, 0.92, 0.94)
FLOATY, FRAME, LENS = (0.16, 0.16, 0.18), (0.04, 0.04, 0.05), (0.20, 0.20, 0.23)
HAIR, SOLE = (0.07, 0.07, 0.08), (0.08, 0.08, 0.09)
LACE, WEB = (0.97, 0.97, 0.97), (0.85, 0.85, 0.88)
SPIDER = (0.03, 0.03, 0.04)
SUIT, SUIT_D, FRILL, DOT = (0.10, 0.10, 0.11), (0.20, 0.20, 0.22), (0.17, 0.17, 0.19), (0.97, 0.97, 0.97)


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
    # a big white bow tied on the band at the side
    fx, fy, fz = -1.0, -0.98, bz + 0.36
    for k in (-1, 1):
        box(fx + k * 0.3, fy, fz, 0.54, 0.12, 0.44, LACE, bevel=0.06, rot=(0, k * math.radians(18), 0))
        limb((fx + k * 0.05, fy - 0.02, fz - 0.08), (fx + k * 0.2, fy - 0.02, fz - 0.42), 0.06, LACE)
    box(fx, fy - 0.06, fz, 0.16, 0.12, 0.18, LACE, bevel=0.04)
    lace_and_spider(bz)


def lace_and_spider(bz):
    """White lace scallops round the brim edge and a spider on a thread."""
    for k in range(16):
        a = 2 * math.pi * (k + 0.5) / 16
        ball(2.12 * math.cos(a), 2.12 * math.sin(a), bz - 0.1, 0.36, 0.36, 0.22, LACE, seg=6, ring=4)
    sx, sy = 1.55, -1.35
    limb((sx, sy, bz - 0.08), (sx, sy, bz - 0.95), 0.012, WEB)
    ball(sx, sy, bz - 1.05, 0.26, 0.22, 0.22, SPIDER, seg=8, ring=5)
    ball(sx, sy - 0.08, bz - 0.92, 0.16, 0.14, 0.14, SPIDER, seg=6, ring=4)
    for s in (-1, 1):
        for k in range(3):
            z = bz - 1.0 - k * 0.06
            limb((sx + s * 0.1, sy, z), (sx + s * 0.3, sy, z - 0.12 + k * 0.05), 0.02, SPIDER)
        ball(sx + s * 0.05, sy - 0.17, bz - 0.9, 0.05, 0.03, 0.05, WHITE, seg=6, ring=4)


def parasol():
    """A black lace parasol around its grip: the stick runs along +z."""
    L = 3.5
    limb((0, 0, -0.3), (0, 0, L), 0.05, FRAME)
    ball(0.08, 0, -0.38, 0.16, 0.16, 0.16, FRAME, seg=6, ring=4)
    can(0, 0, L - 0.2, 1.3, 0.5, HAT, n=8, r2=0.85)
    can(0, 0, L + 0.25, 0.85, 0.4, HAT, n=8, r2=0.1)
    can(0, 0, L - 0.45, 1.32, 0.06, BAND, n=8)
    for k in range(8):
        a = 2 * math.pi * (k + 0.5) / 8
        ball(1.22 * math.cos(a), 1.22 * math.sin(a), L - 0.5, 0.42, 0.42, 0.26, LACE, seg=6, ring=4)
    ball(0, 0, L + 0.5, 0.18, 0.18, 0.22, BAND, seg=6, ring=4)


def floaty(x, y, z, rot):
    """An inflatable arm band on the upper arm."""
    ring(x, y, z, 0.2, 0.15, FLOATY, rot=rot)
    ball(x, y - 0.3, z + 0.02, 0.1, 0.12, 0.1, WHITE, seg=6, ring=4)  # the valve
    m = Euler(rot).to_matrix()
    for k in range(8):  # white polka dots round the outside of the band
        a = 2 * math.pi * k / 8
        for zz in (-0.1, 0.1):
            p = Vector((x, y, z)) + m @ Vector((0.33 * math.cos(a), 0.33 * math.sin(a), zz))
            ball(p.x, p.y, p.z, 0.07, 0.07, 0.07, LACE, seg=6, ring=4)


def build():
    body(shirt=SUIT, sleeve=SKIN, pants=SUIT, leg_colour=SKIN, shoe=SKIN, arms=False, torso=False)
    # flip-flops: a pink sole under each bare foot and a V strap
    for s in (-1, 1):
        fx = s * TW * 0.24
        box(fx, -FOOT * 0.25, 0.02, FOOT * 0.86, FOOT * 1.26, 0.06, SOLE, bevel=0.02)
        for k in (-1, 1):
            limb((fx, -FOOT * 0.62, 0.22), (fx + k * FOOT * 0.33, -FOOT * 0.18, 0.22), 0.035, SOLE)
        for k in (-1, 0, 1):
            box(fx + k * 0.11, -FOOT * 0.25 - FOOT * 0.58, 0.12, 0.08, 0.04, 0.08, SKIN)  # toes
    # a modest little-kid two-piece: a tankini top with wide straps covering the
    # chest and most of the tummy, swim bottoms with a frill skirt, white dots
    box(0, 0, HIP + TH * 0.5, TW * 0.96, TD * 0.94, TH * 0.96, SKIN, bevel=0.08)               # the kid
    box(0, 0, HIP + TH * 0.58, TW + 0.03, TD + 0.03, TH * 0.66, SUIT, bevel=0.08)               # tankini top
    for s in (-1, 1):
        box(s * TW * 0.27, 0, TOP - TH * 0.12, 0.3, TD + 0.05, TH * 0.28, SUIT, bevel=0.05)       # wide straps
    box(0, -TD * 0.5 - 0.03, HIP + TH * 0.88, TW * 0.5, 0.04, 0.05, LACE)                      # white neckline trim
    for k in range(7):                                                                          # lace hem
        x = -TW * 0.45 + k * TW * 0.15
        ball(x, -TD * 0.5 - 0.03, HIP + TH * 0.25, 0.13, 0.05, 0.08, LACE, seg=6, ring=4)
    box(0, 0, HIP + TH * 0.04, TW + 0.04, TD + 0.04, TH * 0.22, SUIT_D, bevel=0.06)             # swim bottoms
    can(0, 0, HIP - 0.02, TW * 0.6, 0.2, FRILL, n=10, r2=TW * 0.52)                             # the frill skirt
    for k in range(10):
        a = 2 * math.pi * (k + 0.5) / 10
        ball(TW * 0.6 * math.cos(a), TW * 0.6 * math.sin(a) * 0.98, HIP - 0.1, 0.16, 0.16, 0.1, FRILL, seg=6, ring=4)
    fy = -TD * 0.5 - 0.04
    for x, z in ((-0.26, HIP + TH * 0.62), (0.24, HIP + TH * 0.45), (0.02, HIP + TH * 0.72), (-0.1, HIP + TH * 0.4), (0.3, HIP + TH * 0.74)):
        can(x, fy, z, 0.065, 0.03, DOT, n=8, rot=(math.radians(90), 0, 0))
    floaty(TW * 0.5 + 0.15, -0.02, TOP - 0.36, (0, math.radians(22), 0))
    floaty(-TW * 0.5 - 0.3, -0.1, TOP - 0.16, (0, math.radians(90), math.radians(-32)))
    # right mitten: the pumpkin candy bucket
    hx, hy, hz = hand_points()[1]
    limb((TW * 0.5 + 0.08, 0, TOP - 0.15), (TW * 0.5 + 0.24, -0.05, TOP - ARM_DROP), 0.11, SKIN)
    hand_mitt(hx, hy, hz, 1, MITT, SKIN)
    bucket((hx, hy, hz), full=True)
    # left arm raised a little, holding up the parasol
    sx = TW * 0.5 + 0.08
    bx, by, bz = -1.15, -0.3, TOP - 0.2
    limb((-sx, 0, TOP - 0.15), (bx + 0.12, by, bz + 0.05), 0.11, SKIN)
    hand_mitt(bx, by, bz, -1, MITT, SKIN)
    mount(parasol, (bx, by, bz), tilt=(-24, -30, 0))
    # the head: a violet bob, long down the sides
    w = HEAD
    box(0, 0, HEAD_Z, w, w * 0.92, w * 0.9, SKIN, bevel=w * 0.14, segs=2)
    box(0, w * 0.05, HEAD_Z + 0.62, w * 1.04, w * 0.98, 0.6, HAIR, bevel=0.2, segs=2)
    box(0, 0.3, HEAD_Z - 0.1, w * 1.08, w * 0.7, w * 0.95, HAIR, bevel=0.3, segs=2)
    for s in (-1, 1):
        box(s * w * 0.5, -0.45, HEAD_Z - 0.55, 0.36, 0.5, 1.0, HAIR, bevel=0.14, segs=2)
        box(s * w * 0.5, -0.45, HEAD_Z - 1.1, 0.3, 0.42, 0.3, HAIR, bevel=0.1, rot=(0, s * math.radians(25), 0))
    face(0, HEAD_Z - w * 0.05, -w * 0.46, w)
    # big black sunglasses over the eyes and a white sunscreen stripe on the nose
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
    render_costume("goth-beach-witch", build, out, ortho=9.6, target_z=3.9)
