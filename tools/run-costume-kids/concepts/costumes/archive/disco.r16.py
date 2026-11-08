"""Disco: the kid with a giant round afro, a shiny purple flared jumpsuit
with a huge white pointy collar, sparkles, a big gold belt buckle and a gold
medallion, silver platform boots on chunky red soles. Arms hanging (the toy
rig's pose): the right mitt points a finger at you, the left holds a mirror
ball out at its side (no bucket, both hands are busy)."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
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

SUIT, SUIT_L, COLLAR, GOLD = (0.62, 0.22, 0.92), (0.80, 0.55, 1.0), (0.99, 0.99, 1.0), (1.0, 0.80, 0.20)
HAIR, BOOT, SOLE = (0.18, 0.11, 0.08), (0.84, 0.86, 0.92), (0.95, 0.20, 0.35)
MIRROR, MIRROR_L, MIRROR_D = (0.78, 0.82, 0.90), (1.0, 1.0, 1.0), (0.50, 0.55, 0.68)


def sparkle(x, y, z, size=0.1, rgb=WHITE):
    for a in (0, 90):
        box(x, y, z, size * 0.3, 0.03, size, rgb, rot=(0, R(a + 45), 0))


def build():
    body(shirt=SUIT, pants=SUIT, leg_colour=SUIT, shoe=BOOT, arms=False)
    # platform boots: tall silver tops, chunky red soles under the shoes
    for s in (-1, 1):
        fx = s * TW * 0.24
        sd = "l" if s > 0 else "r"
        with part(f"foot.{sd}"):
            box(fx, -FOOT * 0.25, 0.06, FOOT * 0.8, FOOT * 1.2, 0.12, SOLE, bevel=0.03)
            box(fx, 0.05, FOOT * 0.62, 0.3, 0.3, 0.3, BOOT, bevel=0.06)
        with part(f"leg.{sd}"):  # the flares over the boots
            can(fx, -0.02, FOOT * 0.9, 0.3, 0.32, SUIT, n=8, r2=0.13)
    # the open V neck with a gold medallion, a big belt buckle, sparkles
    fy = FRONT - 0.02
    with part("chest"):
        prism([(-0.22, TOP + 0.01), (0.22, TOP + 0.01), (0, TOP - 0.42)], fy - 0.02, fy + 0.1, SKIN, bevel=0.0)
        limb((-0.12, fy - 0.06, TOP), (0, fy - 0.07, TOP - 0.3), 0.02, GOLD)
        limb((0.12, fy - 0.06, TOP), (0, fy - 0.07, TOP - 0.3), 0.02, GOLD)
        can(0, fy - 0.09, TOP - 0.36, 0.11, 0.04, GOLD, n=10, rot=(R(90), 0, 0))
        for x, z in ((-0.3, TOP - 0.25), (0.32, HIP + 0.55)):
            sparkle(x, fy - 0.03, z)
        # the huge pointy white collar, out over the shoulders
        for s in (-1, 1):
            prism([(s * 0.1, TOP + 0.04), (s * 0.95, TOP - 0.05), (s * 0.3, TOP - 0.32)], fy - 0.08, fy + 0.2, COLLAR, bevel=0.03)
        box(0, 0.1, TOP + 0.08, TW * 0.9, TD * 0.6, 0.18, COLLAR, bevel=0.05)
    with part("body"):  # the belt, the big buckle, a sparkle on the trousers
        box(0, 0, HIP + 0.32, TW + 0.06, TD + 0.06, 0.12, GOLD, bevel=0.03)
        box(0, fy - 0.06, HIP + 0.32, 0.36, 0.06, 0.24, GOLD, bevel=0.05)
        box(0, fy - 0.1, HIP + 0.32, 0.18, 0.04, 0.1, SUIT_L)
        sparkle(-0.25, fy - 0.03, HIP + 0.1)
    # standard hanging arms (the rig swings any posed arm down to this pose anyway):
    # the right mitt points at you, the left holds the mirror ball out at its side
    for s_ in (-1, 1):
        sd = "l" if s_ > 0 else "r"
        with part(f"arm.{sd}"):
            limb((s_ * SX, 0, TOP - 0.15), (s_ * (SX + 0.16), -0.05, TOP - ARM_DROP), 0.13, SUIT)
            if s_ > 0:  # the white cuff
                can(SX + 0.15, -0.05, TOP - ARM_DROP + 0.06, 0.17, 0.12, COLLAR, n=8)
    rh = hand_points()[1]
    with part("hand.l"):  # the mitt and the finger pointing at you
        hand_mitt(*rh, 1, MITT, SKIN)
        box(rh[0] - 0.04, rh[1] - 0.36, rh[2] + 0.06, 0.13, 0.5, 0.14, SKIN, bevel=0.04)
    lh = hand_points()[-1]
    with part("hand.r"):
        hand_mitt(*lh, -1, MITT, SKIN)
    with part("prop.r"):  # the mirror ball, its tiles and glints
        bx, by, bz, br = lh[0] - 0.52, lh[1] - 0.05, lh[2] - 0.18, 0.36
        ball(bx, by, bz, br * 2, br * 2, br * 2, MIRROR, seg=12, ring=8)
        import random
        rnd = random.Random(3)
        for k in range(18):
            a, e = rnd.uniform(-2.6, 0.6), rnd.uniform(-1.0, 1.0)
            c = MIRROR_L if k % 2 else MIRROR_D
            px, py, pz = math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)
            box(bx + px * br * 0.96, by + py * br * 0.96, bz + pz * br * 0.96, 0.1, 0.1, 0.1, c, rot=(e, 0, a))
        for (dx, dy, dz), sz in (((-0.75, -0.45, 0.5), 0.22), ((0.1, -0.8, 0.4), 0.18), ((-0.6, -0.7, -0.4), 0.16)):
            d = math.sqrt(dx * dx + dy * dy + dz * dz)   # glints stuck on the ball's surface, not floating
            sparkle(bx + dx / d * (br + 0.02), by + dy / d * (br + 0.02), bz + dz / d * (br + 0.02), sz, (1.0, 0.95, 0.5))
    # the head: the kid under a giant round afro
    with part("head"):
        head_skin()
        face(0, HEAD_Z - HEAD * 0.05, FY, HEAD)
        cap(HAIR)
        ball(0, 0.15, CAP_Z + 0.35, HEAD * 1.55, HEAD * 1.35, HEAD * 1.0, HAIR, seg=14, ring=9)
        for s in (-1, 1):  # sideburns
            box(s * 1.28, -0.35, HEAD_Z - 0.2, 0.22, 0.6, 0.9, HAIR, bevel=0.08)


if __name__ == "__main__" or True:
    run({"disco": build})
