"""Hippie: the kid with long straight brown hair from a middle part, a
flower headband, round orange-tinted glasses, a rainbow tie-dye t-shirt with
a swirl, a big peace-sign medallion, flared denim bell-bottoms with patches,
and sandals. The right hand flashes a peace sign, the left carries the
full bucket."""
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

HAIR, BAND, LENS, FRAME = (0.48, 0.30, 0.16), (0.55, 0.30, 0.65), (1.0, 0.62, 0.25), (0.95, 0.75, 0.25)
DENIM, DENIM_D, PATCH = (0.36, 0.55, 0.88), (0.26, 0.42, 0.72), (1.0, 0.45, 0.6)
TIE = [(0.95, 0.25, 0.45), (1.0, 0.60, 0.15), (1.0, 0.90, 0.25), (0.35, 0.80, 0.45), (0.30, 0.60, 0.95), (0.65, 0.40, 0.90)]
SILVER, SANDAL = (0.85, 0.86, 0.90), (0.62, 0.40, 0.20)
PETALS = [(1.0, 0.55, 0.75), (1.0, 0.92, 0.35), (0.55, 0.80, 1.0), (1.0, 0.55, 0.35), (1.0, 1.0, 1.0)]


def flower(x, y, z, size, petal, centre=(1.0, 0.85, 0.2)):
    for k in range(5):
        a = 2 * math.pi * k / 5 + 0.3
        ball(x + size * 0.38 * math.cos(a), y, z + size * 0.38 * math.sin(a), size * 0.5, size * 0.25, size * 0.5, petal, seg=6, ring=4)
    ball(x, y - 0.04, z, size * 0.36, size * 0.2, size * 0.36, centre, seg=6, ring=4)


def build():
    body(shirt=TIE[0], pants=DENIM, leg_colour=DENIM, shoe=SANDAL, arms=False, torso=False)
    # bell-bottoms: flares over the shoes
    for s in (-1, 1):
        fx = s * TW * 0.24
        with part("leg.l" if s > 0 else "leg.r"):
            can(fx, -0.05, FOOT * 0.62, 0.3, 0.35, DENIM, n=8, r2=0.14)
            box(fx + s * 0.06, -0.33, FOOT * 0.62, 0.14, 0.04, 0.14, PATCH if s > 0 else (1.0, 0.85, 0.3), rot=(R(10), 0, 0))
    with part("body"):
        box(0, 0, HIP + TH * 0.18, TW, TD, TH * 0.36, DENIM, bevel=0.06)
    with part("chest"):  # the tee, its swirl and the peace medallion
        # the tie-dye tee: banded colours, a swirl on the front
        z0, z1 = HIP + TH * 0.3, TOP
        n = 5
        for i in range(n):
            za = z0 + (z1 - z0) * i / n
            box(0, 0, za + (z1 - z0) / n * 0.5, TW + 0.02, TD + 0.02, (z1 - z0) / n * 1.04, TIE[(i * 2) % 6], bevel=0.05)
        cz = HIP + TH * 0.62
        for k, r in enumerate((0.44, 0.35, 0.26, 0.17, 0.08)):
            can(0, FRONT - 0.03 - k * 0.012, cz, r, 0.03, TIE[(k + 3) % 6], n=10, rot=(R(90), 0, 0))
        # the peace medallion on a leather cord
        for s in (-1, 1):
            limb((s * 0.26, FRONT - 0.05, TOP + 0.04), (s * 0.04, FRONT - 0.12, TOP - 0.3), 0.02, SANDAL)
        my, mz = FRONT - 0.16, TOP - 0.42
        can(0, my, mz, 0.2, 0.05, SILVER, n=12, rot=(R(90), 0, 0))
        can(0, my - 0.03, mz, 0.15, 0.04, TIE[4], n=12, rot=(R(90), 0, 0))
        box(0, my - 0.06, mz, 0.04, 0.04, 0.3, SILVER)
        for s in (-1, 1):
            box(s * 0.055, my - 0.06, mz - 0.07, 0.04, 0.04, 0.16, SILVER, rot=(0, s * R(-45), 0))
    # standard hanging arms: the left with the bucket, the right flashing a peace sign at you
    for s_ in (-1, 1):
        sd = "l" if s_ > 0 else "r"
        hp = hand_points()[s_]
        with part(f"arm.{sd}"):
            limb((s_ * SX, 0, TOP - 0.15), (hp[0] - s_ * 0.02, hp[1] + 0.05, hp[2] + 0.12), 0.11, SKIN)
            bar((s_ * SX, 0, TOP - 0.12), (s_ * (SX + 0.08), -0.03, TOP - 0.3), 0.16, 0.16, TIE[2] if s_ < 0 else TIE[4])
    lh, rh = hand_points()[-1], hand_points()[1]
    with part("hand.r"):
        hand_mitt(*lh, -1, MITT, SKIN)
    bucket(lh, full=True, size=0.6)
    with part("hand.l"):
        hand_mitt(*rh, 1, MITT, SKIN)
        for s in (-1, 1):  # the V: two fingers spread, pointing forward and up
            box(rh[0] + s * 0.1, rh[1] - 0.3, rh[2] + 0.18, 0.12, 0.42, 0.14, SKIN, bevel=0.04, rot=(R(-35), 0, R(s * -14)))
    # the head: middle part, long straight hair down the sides and back
    with part("head"):
        head_skin()
        face(0, HEAD_Z - HEAD * 0.05, FY, HEAD)
        cap(HAIR, lift=0.02, back=0.1)
        for s in (-1, 1):
            prism([(s * 0.02, CAP_Z + 0.4), (s * 1.32, CAP_Z + 0.4), (s * 1.32, CAP_Z - 0.55), (s * 0.12, CAP_Z - 0.05)][::s], FY - 0.07, FY + 0.5, HAIR)
            box(s * 1.33, 0.1, HEAD_Z - 0.4, 0.3, HEAD * 0.8, 2.1, HAIR, bevel=0.12)
            for k in range(3):
                can(s * 1.33, -0.3 + k * 0.4, HEAD_Z - 1.45, 0.16, 0.3, HAIR, n=4, r2=0.0, rot=(R(180), 0, 0))
        box(0, HEAD * 0.48, HEAD_Z - 0.4, HEAD * 1.06, 0.36, 2.1, HAIR, bevel=0.12)
        # the round tinted glasses: lenses sit behind the eyes, gold rims
        for s in (-1, 1):
            can(s * 0.55, FY - 0.03, HEAD_Z, 0.36, 0.02, LENS, n=14, rot=(R(90), 0, 0))
            bpy.ops.mesh.primitive_torus_add(major_radius=0.39, minor_radius=0.045, major_segments=16, minor_segments=4,
                                             location=(s * 0.55, FY - 0.05, HEAD_Z), rotation=(R(90), 0, 0))
            finish(bpy.context.object, FRAME)
        box(0, FY - 0.05, HEAD_Z + 0.08, 0.32, 0.04, 0.05, FRAME)
        # the flower headband
        box(0, 0.0, CAP_Z - 0.15, HEAD * 1.08, HEAD * 1.0, 0.14, BAND, bevel=0.05)
        for k, x in enumerate((-1.05, -0.55, 0.0, 0.55, 1.05)):
            flower(x, FY - 0.15, CAP_Z - 0.12 + (0.06 if k % 2 else 0), 0.42, PETALS[k])
        for s in (-1, 1):
            flower(s * 1.38, -0.5, CAP_Z - 0.12, 0.38, PETALS[(s + 3) % 5])


if __name__ == "__main__" or True:
    run({"hippie": build})
