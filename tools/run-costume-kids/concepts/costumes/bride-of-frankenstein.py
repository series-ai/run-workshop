"""Bride of Frankenstein: the kid under a towering black hair column (taller
than the kid, gently wavy, a big round puff on top) with two white
lightning-bolt streaks shooting up it from the temples. A white wrapped
bandage gown to the floor with a pale-green sash, little stitches on one
cheek and the brow. A bouquet of black roses in one mitten, the full
pumpkin bucket held out in the other, clear of the gown. Framed tall for the hair."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket, mount

R = math.radians
FY = -HEAD * 0.46
SX = TW * 0.5 + 0.08
HAIR, HAIR_D = (0.10, 0.09, 0.12), (0.18, 0.16, 0.22)
GOWN, GOWN_D, WRAP = (0.99, 0.98, 0.96), (0.86, 0.87, 0.90), (0.93, 0.93, 0.95)
MINT, MINT_D = (0.72, 0.95, 0.74), (0.52, 0.84, 0.58)
ROSE, ROSE_D, LEAF = (0.16, 0.10, 0.20), (0.40, 0.18, 0.42), (0.36, 0.62, 0.36)
STITCH = (0.25, 0.18, 0.22)


def squash(o, sx=1.0, sy=1.0, sz=1.0):
    o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    return o


def bar(p0, p1, r0, r1, rgb, n=6):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def prism(pts, t, rgb, bevel=0.03):
    """A flat polygon (x, z points) extruded along y by t, centred on y = 0."""
    n = len(pts)
    verts = [(x, -t / 2, z) for x, z in pts] + [(x, t / 2, z) for x, z in pts]
    faces = [list(range(n))[::-1], list(range(n, 2 * n))] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    me = bpy.data.meshes.new("prism")
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new("prism", me)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    finish(o, rgb, bevel)
    o.modifiers["b"].limit_method = "ANGLE"
    return o


def bolt(cx, cy, cz, ang, h, w, rgb):
    """A white lightning bolt standing up, height h, laid on a surface facing
    the direction `ang` (radians about z; 0 = facing -y, the camera)."""
    u = w
    pts = [(-0.2 * u, 0), (0.55 * u, 0.42 * h), (0.05 * u, 0.42 * h), (0.6 * u, h),
           (-0.45 * u, 0.5 * h), (0.05 * u, 0.5 * h), (-0.7 * u, 0.06 * h)]
    o = prism([(x, z - h / 2) for x, z in pts], 0.14, rgb)
    o.rotation_euler = (0, 0, ang)
    o.location = (cx, cy, cz)
    return o


def rose(x, y, z, s=1.0):
    ball(x, y, z, 0.3 * s, 0.3 * s, 0.26 * s, ROSE, seg=8, ring=5)
    can(x, y - 0.02, z + 0.08 * s, 0.09 * s, 0.06, ROSE_D, n=6, rot=(R(90), 0, 0))


def build():
    body(shirt=GOWN, pants=GOWN, leg_colour=GOWN, shoe=GOWN_D, arms=False, torso=False, legs=False)
    for o in [o for o in bpy.data.objects if str(o.get("part", "")).startswith("foot")]:
        bpy.data.objects.remove(o, do_unlink=True)  # the gown sweeps the floor: no shoes inside it to poke out
    # the gown: a long white bell to the floor, wrapped round in bandage bands
    with part("body"):
        can(0, 0, 0.53, 0.62, 1.06, GOWN, n=10, r2=1.0, rot=(R(180), 0, 0))  # down to the floor, over the shoes
        for k, z in enumerate((0.18, 0.46, 0.74)):
            r = 1.0 - 0.38 * z / 1.06 - 0.02  # the gown bell's radius at this height
            o = can(0, 0, z, r + 0.05, 0.14, WRAP if k % 2 else GOWN_D, n=10, rot=(R(6 if k % 2 else -6), 0, 0))
    with part("chest"):
        box(0, 0, HIP + TH * 0.55, TW * 0.95, TD * 0.92, TH * 0.95, GOWN, bevel=0.1)
        for k, z in enumerate((HIP + 0.3, HIP + 0.55, HIP + 0.8)):
            box(0, 0, z, TW * 1.0, TD * 0.98, 0.12, WRAP if k % 2 else GOWN_D, bevel=0.04, rot=(0, R(10 if k % 2 else -10), 0))
        # a high white collar
        can(0, 0, TOP + 0.04, 0.5, 0.16, WRAP, n=10, r2=0.4)
    # the pale-green sash with a bow at the hip
    with part("body"):
        box(0, 0, HIP + 0.1, TW * 1.04, TD * 1.02, 0.16, MINT, bevel=0.05)
        for t in (-1, 1):
            can(0.3 + t * 0.16, -TD * 0.5 - 0.06, HIP + 0.1, 0.13, 0.22, MINT, n=4, r2=0.03, rot=(0, R(t * 90), 0))
        ball(0.3, -TD * 0.5 - 0.08, HIP + 0.1, 0.13, 0.12, 0.13, MINT_D, seg=6, ring=4)
        bar((0.34, -TD * 0.5 - 0.06, HIP + 0.05), (0.42, -TD * 0.5 - 0.12, HIP - 0.4), 0.05, 0.07, MINT, n=4)
    hp = hand_points()[-1]
    BH = (hp[0] - 0.26, hp[1] - 0.24, hp[2] + 0.14)  # held out and forward, ~0.38 off the hand point, clear of the gown
    # arms: long wrapped sleeves; one holds black roses, the other the bucket
    for s, hand in ((-1, BH), (1, (1.1, -0.45, TOP - 0.3))):
        side = "l" if s > 0 else "r"
        with part("arm." + side):
            limb((s * SX, 0, TOP - 0.15), (hand[0] - s * 0.12, hand[1] + 0.05, hand[2] + 0.04), 0.12, GOWN)
            can(hand[0] - s * 0.3, hand[1] + 0.03, hand[2] + 0.07, 0.14, 0.08, GOWN_D, n=8, rot=(0, R(s * 70), 0))
        with part("hand." + side):
            hand_mitt(*hand, s, MITT, SKIN)
    # the bouquet (stems, paper wrap and roses) is one held prop, leaning out away from the head
    mount(_bouquet, (1.1, -0.45, TOP - 0.3), tilt=(0, 110, 0))
    bucket(BH, full=True, size=0.55)
    with part("head"):
        _head()


def _bouquet():
    """Black roses in a mint paper wrap, built round the grip (the origin)."""
    hx, hy, hz = 0, 0, 0
    for dx, dz, dy in ((-0.05, 0.12, 0), (0.2, 0.0, 0.05)):
        bar((hx, hy, hz - 0.25), (hx + dx, hy + dy, hz + 0.45 + dz), 0.03, 0.03, LEAF)
    bar((hx, hy, hz - 0.3), (hx + 0.1, hy, hz + 0.35), 0.1, 0.18, MINT, n=6)  # paper wrap
    for dx, dz, dy in ((0.0, 0.6, 0.0), (-0.22, 0.48, 0.05), (0.24, 0.5, 0.0), (0.08, 0.78, 0.08), (-0.12, 0.72, -0.08)):
        rose(hx + dx, hy - 0.05 + dy, hz + dz, 0.95)


def _head():
    # the head: the kid's face with a few cute stitches
    box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)
    face(0, HEAD_Z - HEAD * 0.05, FY, HEAD)
    for k in range(4):  # a little stitch line on the left cheek
        x = -0.98 + k * 0.13
        box(x, FY - 0.02, HEAD_Z - 0.62 + k * 0.07, 0.04, 0.04, 0.16, STITCH)
    box(-0.78, FY - 0.02, HEAD_Z - 0.51, 0.42, 0.03, 0.035, STITCH, rot=(0, R(-28), 0))
    # the hair: a black cap, a fringe swept back, side puffs over the ears (rounded cubes, like the head)
    box(0, HEAD * 0.06, HEAD_Z + HEAD * 0.3, HEAD * 1.06, HEAD * 1.0, HEAD * 0.4, HAIR, bevel=HEAD * 0.14, segs=2)
    for s in (-1, 1):
        box(s * 1.25, 0.25, HEAD_Z + 0.15, 0.6, 1.6, 1.5, HAIR, bevel=0.22, segs=2)
    box(0, 0.25, HEAD_Z - 0.2, HEAD * 1.0, 0.9, HEAD * 0.8, HAIR, bevel=0.3, segs=2)  # back of the hair
    # the tower: a tall stack of rounded cubes, each a little twisted and shifted so
    # it wobbles as it rises, flaring out into one big rounded-cube puff on top
    cy, yd = 0.2, 2.1
    for k, (z, w, h, dx, tw) in enumerate(((4.3, 2.3, 0.85, 0.0, 0), (5.05, 2.05, 0.8, 0.1, 7), (5.8, 2.15, 0.8, -0.08, -6), (6.55, 2.3, 0.8, 0.08, 5))):
        box(dx, cy, z, w, yd, h, HAIR, bevel=0.3, segs=2, rot=(0, 0, R(tw)))
    box(0, cy, 7.7, 3.0, yd + 0.2, 1.7, HAIR, bevel=0.55, segs=3)            # the big puff
    box(0.0, cy - 1.2, 8.1, 0.8, 0.7, 0.8, HAIR_D, bevel=0.25, segs=2, rot=(0, R(45), 0))  # a front curl
    # the two white lightning-bolt streaks: up the front of the tower from the temples to the puff
    for s in (-1, 1):
        h, w = 3.7, 0.95
        pts = [(0.15, 0.0), (0.55, 0.0), (0.45, 0.3), (0.9, 0.3), (0.3, 0.6), (0.75, 0.6), (0.25, 1.0),
               (0.3, 0.68), (-0.15, 0.68), (0.4, 0.38), (-0.05, 0.38)]
        pts = [(s * (x - 0.35) * w, z * h - h / 2) for x, z in pts]
        o = prism(pts, 0.12, WHITE)
        o.rotation_euler = (0, 0, s * R(12))
        o.location = (s * 0.62, cy - yd / 2 - 0.08, 5.75)

if __name__ == "__main__" or True:
    render_costume("bride-of-frankenstein", build, sys.argv[sys.argv.index("--") + 1], ortho=10.5, target_z=4.3)
