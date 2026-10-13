"""Firefighter: the kid in a big red fire helmet (long back brim, ribbed
dome, a gold shield badge standing up at the front), a yellow turnout coat
with silver reflective stripes and black clasps, tall black boots, a coil
of red hose in the left mitten with its brass nozzle poking forward (one
prop), and the full bucket in the right."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

YEL, YEL_D, STRIPE, LIME = (1.0, 0.80, 0.08), (0.88, 0.64, 0.05), (0.84, 0.87, 0.9), (0.80, 1.0, 0.25)
RED, RED_D, GOLD, BRASS, BOOT = (0.9, 0.12, 0.12), (0.66, 0.07, 0.08), (1.0, 0.78, 0.18), (0.95, 0.70, 0.25), (0.12, 0.11, 0.12)
HOSE, HAIR = (0.80, 0.12, 0.10), (0.32, 0.18, 0.09)

X90 = (math.radians(90), 0, 0)


def arm(s, hand, sleeve, r=0.11, mitt=True):
    """A sleeve from the shoulder to a mitten at `hand`."""
    sh = (s * (TW * 0.5 + 0.08), 0, TOP - 0.15)
    d = [h - a for a, h in zip(sh, hand)]
    L = math.sqrt(sum(c * c for c in d))
    sd = "l" if s > 0 else "r"
    with part(f"arm.{sd}"):
        limb(sh, tuple(h - c / L * 0.14 for h, c in zip(hand, d)), r, sleeve)
    if mitt:
        with part(f"hand.{sd}"):
            hand_mitt(*hand, s, MITT, SKIN)


def bar(p0, p1, r0, r1, rgb, n=6):
    """A tapered bar between two points."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def mesh_obj(verts, faces, rgb, t=0.0):
    me = bpy.data.meshes.new("m")
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new("m", me)
    bpy.context.scene.collection.objects.link(o)
    if t:
        sol = o.modifiers.new("s", "SOLIDIFY")
        sol.thickness = t
        sol.offset = 0
    return finish(o, rgb)


def star(cx, y, cz, r, t, rgb, n=5, inner=0.45, spin=0.0):
    """A flat n-pointed star facing -y."""
    v = [(cx, y, cz)]
    for i in range(2 * n):
        a = math.pi / 2 + spin + i * math.pi / n
        rr = r if i % 2 == 0 else r * inner
        v.append((cx + rr * math.cos(a), y, cz + rr * math.sin(a)))
    return mesh_obj(v, [(0, 1 + i, 1 + (i + 1) % (2 * n)) for i in range(2 * n)], rgb, t)


def slab(pts, t, rgb):
    """A flat quad (4 corner points) given thickness t."""
    return mesh_obj(pts, [(0, 1, 2, 3)], rgb, t)


def hose(pts, r=0.12):
    for a, b in zip(pts, pts[1:]):
        limb(a, b, r, HOSE, n=8)
    for p in pts[1:-1]:
        ball(*p, r * 2.1, r * 2.1, r * 2.1, HOSE, seg=8, ring=5)


def build():
    body(shirt=YEL, pants=YEL, leg_colour=BOOT, shoe=BOOT, torso=False, arms=False)
    # tall boots: a cuff on each leg
    for s in (-1, 1):
        with part("leg.l" if s > 0 else "leg.r"):
            can(s * TW * 0.24, 0, HIP - 0.23, 0.18, 0.2, BOOT, n=8)
            can(s * TW * 0.24, 0, HIP - 0.15, 0.2, 0.06, YEL, n=8)
    # the coat: long, flaring a little, with silver stripes and black clasps.
    # The hem (the flared skirt of the coat, its stripe and lower clasp) rides the hips, all round;
    # the upper coat with its stripe, the zip, the upper clasp and the collar rides the chest
    fy = -(TD + 0.05) / 2
    with part("body"):
        can(0, 0, HIP + 0.1, TW * 0.68, 0.4, YEL, n=8, r2=TW * 0.6)
        z = HIP - 0.02
        box(0, 0, z, TW + 0.12, TD + 0.12, 0.13, STRIPE, bevel=0.03)
        box(0, 0, z + 0.075, TW + 0.1, TD + 0.1, 0.03, LIME)
        box(0, 0, z - 0.075, TW + 0.1, TD + 0.1, 0.03, LIME)
        box(0, fy - 0.04, HIP + 0.25, 0.26, 0.06, 0.08, DARK, bevel=0.02)
    with part("chest"):
        box(0, 0, HIP + TH * 0.6, TW + 0.05, TD + 0.05, TH * 0.8, YEL, bevel=0.08)
        z = HIP + TH * 0.5
        box(0, 0, z, TW + 0.12, TD + 0.12, 0.13, STRIPE, bevel=0.03)
        box(0, 0, z + 0.075, TW + 0.1, TD + 0.1, 0.03, LIME)
        box(0, 0, z - 0.075, TW + 0.1, TD + 0.1, 0.03, LIME)
        box(0, fy - 0.01, HIP + 0.55, 0.04, 0.04, 0.6, YEL_D)                   # the zip
        box(0, fy - 0.04, HIP + 0.72, 0.26, 0.06, 0.08, DARK, bevel=0.02)
        can(0, 0, TOP + 0.06, 0.5, 0.2, YEL, n=8)                               # the stand-up collar
    # standard hanging arms with reflective cuffs. The left mitt carries the hose: the coil,
    # its tail and the brass nozzle are one prop; the right mitt carries the bucket
    lh, rh = hand_points()[-1], hand_points()[1]
    for s_, h in ((-1, lh), (1, rh)):
        arm(s_, h, YEL, r=0.13)
        with part("arm.l" if s_ > 0 else "arm.r"):
            sh = (s_ * (TW * 0.5 + 0.08), 0, TOP - 0.15)
            cf = tuple(a + (b - a) * 0.72 for a, b in zip(sh, h))
            bar(tuple(a + (b - a) * 0.66 for a, b in zip(sh, h)), cf, 0.15, 0.15, STRIPE, n=8)
    bucket(rh, full=True, size=0.6)
    with part("prop.r"):
        cx, cy, cz, R0 = lh[0] - 0.04, lh[1] - 0.02, lh[2] - 0.27, 0.25
        for k in range(3):   # three loops hanging from the mitt, slightly fanned
            bpy.ops.mesh.primitive_torus_add(major_radius=R0 - k * 0.015, minor_radius=0.09, major_segments=14, minor_segments=6,
                                             location=(cx + (k - 1) * 0.03, cy + (k - 1) * 0.1, cz + (k - 1) * 0.015),
                                             rotation=(math.radians(90), 0, math.radians(18 + (k - 1) * 8)))
            finish(bpy.context.object, HOSE if k != 1 else RED_D)
        # the hose's free end comes off the coil and the brass nozzle points forward
        a0 = (cx - 0.12, cy - 0.12, cz - R0 + 0.06)
        a1 = (cx - 0.22, cy - 0.42, cz - 0.08)
        hose([a0, a1], r=0.09)
        bar(a1, (a1[0] - 0.02, a1[1] - 0.3, a1[2] + 0.03), 0.1, 0.1, BRASS, n=8)
        bar((a1[0] - 0.02, a1[1] - 0.3, a1[2] + 0.03), (a1[0] - 0.03, a1[1] - 0.62, a1[2] + 0.06), 0.09, 0.04, BRASS, n=8)
        can(a1[0] - 0.01, a1[1] - 0.14, a1[2] + 0.01, 0.13, 0.08, DARK, n=8, rot=(math.radians(90), 0, 0))
    # the head
    with part("head"):
        kid_head(hair=HAIR)
        # the helmet: a big tall ribbed dome on a wide brim that runs long at the back
        w = HEAD
        hz = HEAD_Z + 0.95
        box(0, 0.55, hz - 0.36, w * 1.55, w * 1.95, 0.16, RED, bevel=0.42, segs=2, rot=(math.radians(-7), 0, 0))
        db, dh = hz - 0.43, 1.85                      # dome bottom and height
        box(0, 0.08, db + dh / 2, w * 1.14, w * 1.08, dh, RED, bevel=0.6, segs=3)
        for x in (-0.55, 0.0, 0.55):                  # ribs running front to back over the crown
            box(x, 0.1, db + dh - 0.02, 0.18, w * 0.9, 0.2, RED_D, bevel=0.06)
        # the shield badge standing up at the front, big and bold
        by, bz = -w * 0.54 - 0.2, hz + 0.72
        box(0, by, bz, 1.45, 0.14, 1.2, GOLD, bevel=0.08, rot=(math.radians(12), 0, 0))
        box(0, by + 0.1, bz - 0.52, 0.9, 0.13, 0.9, GOLD, bevel=0.05, rot=(math.radians(12), math.radians(45), 0))
        box(0, by - 0.07, bz + 0.04, 1.08, 0.08, 0.86, WHITE, bevel=0.04, rot=(math.radians(12), 0, 0))
        box(0, by - 0.12, bz + 0.04, 0.2, 0.06, 0.66, RED, rot=(math.radians(12), 0, 0))           # a big "1"
        box(-0.15, by - 0.13, bz + 0.26, 0.26, 0.06, 0.11, RED, rot=(math.radians(12), math.radians(35), 0))

if __name__ == "__main__" or True:
    render_costume("firefighter", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
