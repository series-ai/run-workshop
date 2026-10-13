"""Bowling dude: a laid-back bowler parody. Shaggy shoulder-length hair, a
fake goatee and moustache, little dark sunglasses, a long striped bathrobe
hanging open (belt loose) over a white t-shirt and plaid shorts, bare legs
and aqua jelly sandals. A swirly purple bowling ball in the right mitten, a
short glass of milky drink in the left (no bucket: both hands are busy)."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

R = math.radians
FY = -HEAD * 0.46          # the face's front plane
CAP_Z = HEAD_Z + HEAD * 0.3
FRONT = -TD * 0.5
SX = TW * 0.5 + 0.08       # shoulder x


def bar(p0, p1, r0, r1, rgb, n=6):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def prism(pts, y0, y1, rgb, bevel=0.04):
    """A flat polygon (x, z points) extruded along y from y0 to y1."""
    n = len(pts)
    verts = [(x, y0, z) for x, z in pts] + [(x, y1, z) for x, z in pts]
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
    return finish(o, rgb, bevel)


def arm(s, hand, rgb, r=0.11, mitt=True):
    """An arm from the shoulder on side s to a mitten centred at `hand`."""
    x, y, z = hand
    limb((s * SX, 0, TOP - 0.15), (x - s * 0.02, y + 0.05, z + 0.12), r, rgb)
    if mitt:
        hand_mitt(x, y, z, s, MITT, SKIN)


def head_skin():
    box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)


def cap(hair, lift=0.0, back=0.0):
    box(0, HEAD * 0.05 + back * 0.5, CAP_Z + lift, HEAD * 1.04, HEAD * 0.98 + back, HEAD * 0.36, hair, bevel=HEAD * 0.14, segs=2)


def shades(rgb=DARK, lens=None, frame=None, w=0.62, h=0.42, y=FY - 0.06, z=HEAD_Z + 0.02, round_=False):
    """Sunglasses over the eyes (they hide the eyes)."""
    for s in (-1, 1):
        if round_:
            can(s * 0.55, y, z, w * 0.5, 0.08, lens or rgb, n=12, rot=(R(90), 0, 0))
        else:
            box(s * 0.55, y, z, w, 0.1, h, lens or rgb, bevel=0.1, segs=2)
    box(0, y, z + 0.08, 0.5, 0.08, 0.08, frame or rgb)
    for s in (-1, 1):
        box(s * 1.2, y + 0.4, z + 0.08, 0.08, 0.9, 0.08, frame or rgb)

ROBE, ROBE_S, TEE, SHORTS, PLAID = (0.86, 0.72, 0.52), (0.62, 0.42, 0.28), (0.98, 0.98, 0.96), (0.45, 0.62, 0.72), (0.88, 0.40, 0.30)
HAIR, BEARD, JELLY, JELLY_D = (0.45, 0.30, 0.18), (0.40, 0.26, 0.15), (0.45, 0.88, 0.95), (0.25, 0.70, 0.85)
BALL, BALL_S, GLASS, MILK = (0.36, 0.22, 0.62), (0.62, 0.40, 0.88), (0.80, 0.92, 1.0), (0.99, 0.97, 0.90)


def build():
    body(shirt=TEE, pants=SHORTS, leg_colour=SKIN, shoe=SKIN, arms=False, torso=False)
    # jelly sandals: an aqua sole and woven straps over the bare foot
    for s in (-1, 1):
        fx = s * TW * 0.24
        box(fx, -FOOT * 0.25, 0.05, FOOT * 0.82, FOOT * 1.22, 0.1, JELLY_D, bevel=0.03)
        for k in range(3):
            box(fx, -FOOT * 0.62 + k * 0.17, FOOT * 0.3, FOOT * 0.8, 0.08, FOOT * 0.24, JELLY, bevel=0.03)
        box(fx, -FOOT * 0.25, FOOT * 0.3, 0.08, FOOT * 0.9, FOOT * 0.24, JELLY, bevel=0.02)
    # plaid shorts and the white tee
    box(0, 0, HIP + TH * 0.12, TW, TD, TH * 0.5, SHORTS, bevel=0.06)
    for s in (-1, 1):
        box(s * TW * 0.24, 0, HIP - 0.04, 0.34, 0.34, 0.2, SHORTS, bevel=0.05)
    for x in (-0.28, 0.0, 0.28):
        box(x, 0, HIP + TH * 0.12, 0.06, TD + 0.02, TH * 0.5, PLAID)
    box(0, 0, HIP + TH * 0.66, TW, TD, TH * 0.68, TEE, bevel=0.08)
    # the bathrobe: back and sides to the knees, open at the front, stripes, a loose belt
    cz = HIP + TH * 0.42
    box(0, 0.08, cz, TW + 0.16, TD, TH * 1.25, ROBE, bevel=0.08)
    for s in (-1, 1):
        box(s * (TW * 0.5 - 0.02), FRONT - 0.02, cz, 0.24, 0.14, TH * 1.25, ROBE, bevel=0.04)
        box(s * (TW * 0.5 - 0.02), FRONT - 0.1, cz - 0.15, 0.08, 0.03, TH * 0.9, ROBE_S)
        box(s * 0.24, FRONT - 0.05, TOP - 0.15, 0.2, 0.08, 0.4, ROBE, bevel=0.03, rot=(0, s * R(-35), 0))  # shawl collar
    for z in (cz - 0.35, cz + 0.05):
        box(0, 0.09, z, TW + 0.18, TD + 0.02, 0.06, ROBE_S)
    box(0, 0, HIP + 0.4, TW + 0.24, TD + 0.14, 0.1, ROBE_S, bevel=0.03)  # the belt
    for dx, a in ((-0.1, 15), (0.12, -20)):
        box(0.3 + dx, FRONT - 0.12, HIP + 0.18, 0.08, 0.04, 0.4, ROBE_S, rot=(0, R(a), 0))
    # right arm: the bowling ball
    rh = (1.15, -0.3, TOP - 0.35)
    limb((SX, 0, TOP - 0.15), (rh[0] - 0.1, rh[1] + 0.05, rh[2] + 0.1), 0.13, ROBE)
    bar((rh[0] - 0.3, rh[1] + 0.06, rh[2] + 0.2), (rh[0] - 0.14, rh[1] + 0.04, rh[2] + 0.12), 0.17, 0.2, ROBE)
    hand_mitt(*rh, 1, MITT, SKIN)
    bx, by, bz = rh[0] + 0.12, rh[1] - 0.25, rh[2] - 0.45
    ball(bx, by, bz, 0.8, 0.8, 0.8, BALL, seg=12, ring=8)
    ball(bx - 0.18, by - 0.22, bz - 0.1, 0.3, 0.2, 0.22, BALL_S, seg=6, ring=4)
    ball(bx + 0.2, by - 0.12, bz + 0.2, 0.26, 0.2, 0.18, BALL_S, seg=6, ring=4)
    for dx, dz in ((-0.06, 0.12), (0.1, 0.12), (0.02, -0.05)):
        can(bx + dx, by - 0.38, bz + dz, 0.05, 0.04, DARK, n=6, rot=(R(90), 0, 0))
    # left arm: the milky drink
    lh = (-1.15, -0.35, TOP - 0.1)
    limb((-SX, 0, TOP - 0.15), (lh[0] + 0.1, lh[1] + 0.05, lh[2] + 0.05), 0.13, ROBE)
    bar((lh[0] + 0.3, lh[1] + 0.06, lh[2] + 0.1), (lh[0] + 0.14, lh[1] + 0.04, lh[2] + 0.05), 0.17, 0.2, ROBE)
    hand_mitt(*lh, -1, MITT, SKIN)
    gx, gy, gz = lh[0], lh[1] - 0.2, lh[2] + 0.35
    can(gx, gy, gz, 0.24, 0.5, GLASS, n=10, r2=0.28)
    can(gx, gy, gz + 0.04, 0.25, 0.38, MILK, n=10, r2=0.27)
    can(gx, gy, gz + 0.18, 0.272, 0.02, MILK, n=10)
    for k in range(2):
        box(gx - 0.08 + k * 0.14, gy, gz + 0.3, 0.1, 0.1, 0.1, (0.92, 0.96, 1.0))  # ice cubes
    # the head: shaggy hair, goatee, little shades
    head_skin()
    face(0, HEAD_Z - HEAD * 0.05, FY, HEAD)
    shades(DARK, w=0.5, h=0.34, z=HEAD_Z + 0.03)
    cap(HAIR, lift=0.06, back=0.1)
    for x, h, t in ((-0.95, 0.5, 10), (-0.4, 0.35, 0), (0.25, 0.42, -8), (0.85, 0.5, -14)):  # a messy middle-part fringe
        tx = x + math.sin(R(t)) * h
        prism([(x - 0.3, CAP_Z + 0.36), (x + 0.3, CAP_Z + 0.36), (x + 0.3, CAP_Z - 0.32), (tx, CAP_Z - 0.32 - h), (x - 0.3, CAP_Z - 0.32)], FY - 0.07, FY + 0.48, HAIR)
    for s in (-1, 1):
        box(s * 1.32, 0.1, HEAD_Z - 0.35, 0.34, HEAD * 0.82, 1.9, HAIR, bevel=0.12)
        for k in range(3):
            can(s * 1.32, -0.35 + k * 0.45, HEAD_Z - 1.4, 0.18, 0.35, HAIR, n=4, r2=0.0, rot=(R(180), 0, 0))
    box(0, HEAD * 0.48, HEAD_Z - 0.35, HEAD * 1.06, 0.36, 1.9, HAIR, bevel=0.12)
    # goatee and moustache
    my = FY - 0.05
    box(0, my, HEAD_Z - 0.62, 0.34, 0.1, 0.32, BEARD, bevel=0.06)
    can(0, my, HEAD_Z - 0.84, 0.15, 0.18, BEARD, n=4, r2=0.0, rot=(R(180), 0, R(45)))
    for s in (-1, 1):
        box(s * 0.18, my, HEAD_Z - 0.3, 0.34, 0.1, 0.1, BEARD, bevel=0.03, rot=(0, s * R(-12), 0))


if __name__ == "__main__" or True:
    run({"bowling-dude": build})
