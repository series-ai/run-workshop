"""Viking: the kid in a round steel helmet with a gold band and two HUGE
curling ivory horns in gold cuffs, two chunky ginger braids hanging to the shoulders, a shaggy
brown fur vest with a fluffy collar over a green tunic, a belt with a gold
buckle, fur-wrapped boots. A big round painted shield (red with a yellow
cross, a steel boss) on the left arm, the full bucket in the right."""
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

STEEL, STEEL_D, GOLD, HORN, HORN_T = (0.70, 0.73, 0.77), (0.48, 0.51, 0.56), (1.0, 0.78, 0.18), (0.98, 0.94, 0.82), (0.80, 0.72, 0.56)
HAIR, TIE = (0.92, 0.45, 0.14), (0.45, 0.28, 0.14)
FUR, FUR_L, TUNIC, BELT, PANTS_V = (0.50, 0.32, 0.18), (0.88, 0.84, 0.76), (0.25, 0.62, 0.32), (0.30, 0.18, 0.10), (0.48, 0.36, 0.26)
SH_RED, SH_YEL, WOOD = (0.90, 0.18, 0.16), (1.0, 0.82, 0.2), (0.58, 0.36, 0.18)


def horn(s, x, z, k=1.0):
    """A big curved horn: fat tapering segments sweeping out, up and curling in at the tip."""
    offs = [(0, 0, 0), (0.45, -0.05, 0.12), (0.82, -0.1, 0.42), (1.0, -0.13, 0.85), (0.95, -0.14, 1.25), (0.75, -0.14, 1.55)]
    pts = [(x + s * dx * k, dy * k, z + dz * k) for dx, dy, dz in offs]
    rs = [0.42, 0.36, 0.29, 0.21, 0.13, 0.05, 0.0]
    for i, (p0, p1) in enumerate(zip(pts, pts[1:])):
        bar(p0, p1, rs[i], rs[i + 1], HORN if i < 3 else HORN_T, n=8)
        if i < len(pts) - 2:
            ball(*p1, rs[i + 1] * 2.05, rs[i + 1] * 2.05, rs[i + 1] * 2.05, HORN if i < 2 else HORN_T, seg=8, ring=5)
    can(x + s * 0.02, 0, z, 0.46, 0.3, GOLD, n=10, rot=(0, R(90), 0))   # a gold cuff where the horn meets the helmet


def dome(x, y, z, sx, sy, sz, rgb):
    """The top half of a ball centred at z."""
    import bmesh
    o = ball(x, y, z, sx, sy, sz, rgb, seg=16, ring=10)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < z - 0.01], context="VERTS")
    bmesh.ops.contextual_create(bm, geom=[e for e in bm.edges if e.is_boundary])
    bm.to_mesh(o.data)
    bm.free()
    return o


def build():
    body(shirt=TUNIC, pants=PANTS_V, leg_colour=FUR_L, shoe=BELT, arms=False)
    # fur-wrapped boots: fluffy cuffs and criss-cross straps
    for s in (-1, 1):
        fx = s * TW * 0.24
        side = "l" if s > 0 else "r"
        with part(f"foot.{side}"):
            can(fx, -0.02, FOOT * 0.48, 0.2, 0.16, FUR_L, n=8)
        with part(f"leg.{side}"):
            for z in (0.35, 0.45):
                box(fx, -0.1, z, 0.24, 0.04, 0.04, BELT, rot=(0, R(30 if z < 0.4 else -30), 0))
    with part("chest"):
        # the fur vest: shaggy panels at the sides and back, open over the tunic
        cz = HIP + TH * 0.62
        box(0, 0.08, cz, TW + 0.14, TD - 0.02, TH * 0.82, FUR, bevel=0.1)
        for s in (-1, 1):
            box(s * (TW * 0.5 - 0.08), FRONT - 0.02, cz, 0.28, 0.12, TH * 0.82, FUR, bevel=0.06)
            for z in (HIP + 0.12, HIP + 0.28):
                can(s * (TW * 0.5 - 0.08), FRONT - 0.04, z - 0.08, 0.08, 0.16, FUR, n=4, r2=0.0, rot=(R(180), 0, 0))
        # a fluffy fur collar round the shoulders
        for k in range(12):
            a = 2 * math.pi * k / 12
            ball(0.56 * math.cos(a), 0.42 * math.sin(a), TOP + 0.02, 0.4, 0.4, 0.32, FUR_L, seg=6, ring=4)
    with part("body"):
        # tunic skirt and belt with a gold buckle
        can(0, 0, HIP + 0.08, TW * 0.6, 0.3, TUNIC, n=8, r2=TW * 0.52)
        box(0, 0, HIP + 0.3, TW + 0.16, TD + 0.14, 0.14, BELT, bevel=0.03)
        box(0, FRONT - 0.08, HIP + 0.3, 0.24, 0.06, 0.2, GOLD, bevel=0.03)
    # both arms hang, fur cuffs at the wrists
    hp = hand_points()
    for s in (-1, 1):
        side = "l" if s > 0 else "r"
        with part(f"arm.{side}"):
            limb((s * SX, 0, TOP - 0.15), (s * SX + s * 0.16, -0.05, TOP - ARM_DROP), 0.11, TUNIC)
        with part(f"hand.{side}"):
            can(s * SX + s * 0.16, -0.05, TOP - 0.5, 0.15, 0.14, FUR_L, n=6)
            hand_mitt(*hp[s], s, MITT, SKIN)
    # the left mitt (+x): the bucket
    bucket(hp[1], full=True, size=0.6)
    # the right mitt (-x): the round shield held by its grip, facing out front-left
    with part("prop.r"):
        hx, hy, hz = hp[-1]
        box(hx, hy - 0.26, hz, 0.14, 0.36, 0.14, WOOD, bevel=0.03)  # the grip
        sh_c = (hx - 0.4, hy - 0.52, hz - 0.14)
        rot = (R(90), 0, R(-18))
        can(*sh_c, 0.68, 0.1, WOOD, n=16, rot=rot)
        can(sh_c[0] - 0.012, sh_c[1] - 0.04, sh_c[2], 0.6, 0.06, SH_RED, n=16, rot=rot)
        fy = sh_c[1] - 0.09
        for ang in (0, 90):  # a yellow cross
            box(sh_c[0], fy, sh_c[2], 1.2, 0.04, 0.2, SH_YEL, rot=(0, R(ang + 45), R(-18)))
        can(sh_c[0] - 0.02, fy - 0.06, sh_c[2], 0.26, 0.14, STEEL, n=10, r2=0.18, rot=(R(90), 0, R(-18)))
        ball(sh_c[0] - 0.03, fy - 0.14, sh_c[2], 0.26, 0.14, 0.26, STEEL_D, seg=8, ring=5)
    with part("head"):
        # the head: the kid with a ginger fringe and two big braids, which end above the shoulders
        head_skin()
        face(0, HEAD_Z - HEAD * 0.05, FY, HEAD)
        box(0, FY + 0.1, HEAD_Z + 0.42, HEAD * 0.95, 0.4, 0.3, HAIR, bevel=0.08)
        for s in (-1, 1):
            x = s * 1.18
            ball(x, -0.2, HEAD_Z - 0.2, 0.55, 0.6, 0.6, HAIR, seg=8, ring=6)
            z = HEAD_Z - 0.6
            for i in range(4):
                ball(x, -0.35 - i * 0.02, z, 0.48, 0.46, 0.4, HAIR, seg=8, ring=5, rot=(0, R(s * (18 if i % 2 else -18)), 0))
                z -= 0.3
            can(x, -0.47, z + 0.14, 0.16, 0.16, TIE, n=8)
            can(x, -0.47, z - 0.06, 0.2, 0.3, HAIR, n=6, r2=0.05, rot=(R(180), 0, 0))
        # the helmet: a steel dome with a gold band, a ridge and a short nose guard
        hz = CAP_Z + 0.42
        dome(0, 0.04, hz - 0.62, 3.6, 3.4, 2.9, STEEL)
        can(0, 0.04, hz - 0.62, 1.82, 0.4, GOLD, n=16)
        for k in (-1, 0, 1):
            ball(k * 0.8, -1.68, hz - 0.62, 0.18, 0.12, 0.18, STEEL_D, seg=6, ring=4)
        for s in (-1, 1):
            horn(s, s * 1.55, hz - 0.15, k=1.45)


if __name__ == "__main__" or True:
    render_costume("viking", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
