"""Tech CEO: the kid in a black turtleneck, jeans and chunky white sneakers,
a conference lanyard with a big badge, a headset mic on one cheek and a
VR headset pushed up on the head. Holds up a tablet showing a rising chart
(the big reveal) in the right mitten; the empty bucket in the left. No real
person, no logos."""
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

TURTLE, JEANS, SNEAK, SOLE = (0.10, 0.10, 0.12), (0.32, 0.48, 0.80), (0.99, 0.99, 0.99), (0.78, 0.80, 0.84)
HAIR, VR, VR_D, VISOR = (0.36, 0.24, 0.14), (0.97, 0.97, 0.98), (0.70, 0.72, 0.78), (0.14, 0.16, 0.22)
LANY, BADGE, TAB, SCREEN, CHART = (0.20, 0.55, 0.98), (1.0, 1.0, 1.0), (0.18, 0.18, 0.20), (0.22, 0.30, 0.48), (0.35, 0.95, 0.55)
MIC = (0.15, 0.15, 0.17)


def build():
    body(shirt=TURTLE, pants=JEANS, shoe=SNEAK)  # turtleneck sleeves hanging, mitts
    # sneakers: a grey sole and a little swoosh-free stripe
    for s in (-1, 1):
        fx = s * TW * 0.24
        with part("foot.l" if s > 0 else "foot.r"):
            box(fx, -FOOT * 0.25, 0.04, FOOT * 0.8, FOOT * 1.2, 0.08, SOLE, bevel=0.02)
            box(fx + s * FOOT * 0.38, -FOOT * 0.25, FOOT * 0.24, 0.03, FOOT * 0.6, 0.08, LANY)
    with part("chest"):
        # the turtleneck: a tall rolled neck
        can(0, 0, TOP + 0.08, 0.42, 0.28, TURTLE, n=10)
        # the lanyard and badge
        fy = FRONT - 0.03
        for s in (-1, 1):
            limb((s * 0.32, fy, TOP + 0.05), (s * 0.06, fy - 0.03, TOP - 0.38), 0.03, LANY)
        box(0, fy - 0.06, TOP - 0.55, 0.32, 0.04, 0.4, BADGE, bevel=0.03)
        box(0, fy - 0.09, TOP - 0.42, 0.32, 0.02, 0.1, LANY)
        box(0, fy - 0.09, TOP - 0.58, 0.14, 0.02, 0.14, SKIN)       # a tiny photo
        box(0, fy - 0.09, TOP - 0.7, 0.22, 0.02, 0.03, (0.4, 0.4, 0.45))
    hp = hand_points()
    # the right mitt (-x): the empty bucket
    bucket(hp[-1], full=False, size=0.6)
    # the left mitt (+x): the tablet held up at the side, screen to the audience
    with part("prop.l"):
        rx, ry, rz = hp[1]
        tx, ty, tz = rx + 0.5, ry - 0.2, rz + 0.16
        box(tx, ty, tz, 1.15, 0.08, 0.82, TAB, bevel=0.06)
        box(tx, ty - 0.05, tz, 1.0, 0.04, 0.68, SCREEN, bevel=0.02)
        for k, h in enumerate((0.16, 0.24, 0.36, 0.5)):  # a chart, up and to the right
            box(tx - 0.3 + k * 0.2, ty - 0.08, tz - 0.3 + h / 2, 0.12, 0.03, h, CHART)
        bar((tx - 0.42, ty - 0.1, tz - 0.12), (tx + 0.38, ty - 0.1, tz + 0.26), 0.025, 0.025, (1.0, 0.85, 0.3), n=4)
        can(tx + 0.4, ty - 0.1, tz + 0.27, 0.08, 0.14, (1.0, 0.85, 0.3), n=3, rot=(R(90), 0, R(0)), r2=None)
    with part("head"):
        # the head: short neat hair, a headset mic, a VR headset pushed up
        head_skin()
        face(0, HEAD_Z - HEAD * 0.05, FY, HEAD)
        cap(HAIR)
        box(-0.35, FY + 0.02, CAP_Z - 0.18, 1.3, 0.2, 0.3, HAIR, bevel=0.08, rot=(0, R(-6), 0))  # a side swoop
        limb((1.3, -0.4, HEAD_Z + 0.1), (0.75, FY - 0.08, HEAD_Z - 0.55), 0.035, MIC)
        ball(0.7, FY - 0.1, HEAD_Z - 0.58, 0.16, 0.14, 0.16, MIC, seg=6, ring=4)
        box(1.3, -0.3, HEAD_Z + 0.1, 0.12, 0.3, 0.3, MIC, bevel=0.04)
        # the VR headset: a chunky visor tipped up on the hair, a strap round the head
        vz = CAP_Z + 0.42
        box(0, -0.85, vz, 1.9, 0.75, 0.8, VR, bevel=0.22, segs=2, rot=(R(-35), 0, 0))
        box(0, -1.12, vz + 0.22, 1.6, 0.2, 0.55, VISOR, bevel=0.12, rot=(R(-35), 0, 0))
        box(0, 0.05, CAP_Z + 0.08, HEAD * 1.08, HEAD * 0.98, 0.18, VR_D, bevel=0.08)
        box(0, -0.06, CAP_Z + 0.5, 0.25, HEAD * 0.95, 0.12, VR_D, bevel=0.04)
        can(0.8, -1.1, vz + 0.58, 0.07, 0.04, CHART, n=8, rot=(R(55), 0, 0))  # a status light


if __name__ == "__main__" or True:
    run({"tech-ceo": build})
