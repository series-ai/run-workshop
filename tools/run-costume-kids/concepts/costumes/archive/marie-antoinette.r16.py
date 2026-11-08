"""Marie Antoinette: the kid under a towering powdered wig, taller than the
kid, piled in three rounded tiers with curls, pink bows and a pearl string,
and a little sailing ship on top. A huge pastel pink gown with side panniers,
frilly hem and blue bows, lace cuffs; a pink layer cake on a plate held out in the right mitten,
held low and out to the side, well clear of the head. Framed wider so the wig fits."""
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

POWDER, POWDER_D, PINK, PINK_L = (0.95, 0.95, 1.0), (0.80, 0.82, 0.94), (1.0, 0.62, 0.78), (1.0, 0.82, 0.90)
BOW, LACE, PEARL = (0.45, 0.70, 1.0), (1.0, 1.0, 1.0), (0.98, 0.96, 0.90)
HULL, SAIL, FLAG = (0.58, 0.34, 0.16), (1.0, 0.98, 0.92), (0.92, 0.2, 0.3)
CAKE, ICING, CHERRY, PLATE = (1.0, 0.70, 0.82), (1.0, 0.98, 0.94), (0.88, 0.08, 0.18), (0.85, 0.92, 1.0)


def squashed(o, sx=1.0, sy=1.0, sz=1.0):
    o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    return o


def bow(x, y, z, size, rgb, rot_y=0.0):
    for t in (-1, 1):
        can(x + t * size * 0.55, y, z, size * 0.5, size * 0.8, rgb, n=4, r2=size * 0.1, rot=(0, R(t * 90), 0))
    ball(x, y - 0.02, z, size * 0.4, size * 0.4, size * 0.4, rgb, seg=6, ring=4)


def ship(x, z):
    """A little three-masted ship, side on to the camera, sitting on the wig."""
    hull = [(-0.75, 0.25), (0.75, 0.25), (0.9, 0.45), (0.55, 0.05), (-0.55, 0.05), (-0.9, 0.45)]
    prism([(px + x, pz + z) for px, pz in hull], -0.25, 0.25, HULL, bevel=0.03)
    box(x, -0.26, z + 0.28, 1.4, 0.04, 0.06, (1.0, 0.85, 0.3))  # a gold stripe on the hull
    for mx, h in ((-0.4, 0.9), (0.08, 1.2), (0.5, 0.8)):
        limb((x + mx, 0, z + 0.2), (x + mx, 0, z + 0.3 + h), 0.03, HULL)
        for k, sw in enumerate((0.5, 0.4)):
            box(x + mx, 0, z + 0.45 + k * h * 0.38, sw * (h / 1.2), 0.06, h * 0.32, SAIL, bevel=0.03)
        can(x + mx + 0.1, 0, z + 0.3 + h, 0.1, 0.03, FLAG, n=3, rot=(R(90), 0, R(-90)))


def build():
    body(shirt=PINK, pants=PINK, leg_colour=PINK, shoe=(0.98, 0.55, 0.72), arms=False, torso=False, legs=False)
    with part("body"):
        # the gown: a narrow waist down past the hands, then a huge flared bell
        # skirt with panniers (wide in x) and a frilly hem
        o = can(0, 0, 0.8, 0.6, 0.7, PINK, n=12, r2=0.42)
        squashed(o, 1.25, 0.95, 1.0)
        o = can(0, 0, 0.3, 1.0, 0.36, PINK, n=12, r2=0.58)
        squashed(o, 1.35, 0.95, 1.0)
        o = can(0, 0, 0.16, 1.02, 0.16, PINK_L, n=12)
        squashed(o, 1.35, 0.95, 1.0)
        for k in range(14):  # scallops round the hem
            a = 2 * math.pi * (k + 0.5) / 14
            ball(1.38 * math.cos(a), 0.97 * math.sin(a), 0.2, 0.36, 0.36, 0.26, PINK_L, seg=6, ring=4)
        # an apron panel down the front of the waist with blue bows
        box(0, -0.5, 0.8, 0.5, 0.06, 0.66, PINK_L, bevel=0.03, rot=(R(-14), 0, 0))
        for z, y in ((0.98, -0.49), (0.62, -0.58)):
            bow(0, y - 0.04, z, 0.24, BOW)
    with part("chest"):
        # the bodice and lace neckline
        box(0, 0, HIP + TH * 0.6, TW * 0.92, TD * 0.9, TH * 0.8, PINK, bevel=0.08)
        box(0, FRONT + 0.02, HIP + TH * 0.5, 0.28, 0.06, TH * 0.6, PINK_L, bevel=0.03)
        bow(0, FRONT - 0.04, TOP - 0.18, 0.24, BOW)
        can(0, 0, TOP + 0.02, 0.5, 0.14, LACE, n=10, r2=0.36)
    # arms: the standard hanging arms in puffy sleeves with lace cuffs, mitts at
    # the hand points. Right: the cake on a plate held out by its rim, well
    # away from the head; the left mitt rests on the skirt (a bucket would vanish into the panniers)
    hp = hand_points()
    for s_ in (-1, 1):
        hx, hy, hz = hp[s_]
        sh = (s_ * SX, 0, TOP - 0.15)
        el = (s_ * SX + s_ * 0.16, -0.05, TOP - ARM_DROP)
        with part("arm.l" if s_ > 0 else "arm.r"):  # the sleeve, its puff and lace cuff
            limb(sh, el, 0.11, PINK)
            ball(s_ * (SX + 0.08), 0, TOP - 0.12, 0.46, 0.46, 0.4, PINK_L, seg=8, ring=5)
            bar((el[0] - s_ * 0.06, el[1] + 0.03, el[2] + 0.16), (hx - s_ * 0.01, hy + 0.01, hz + 0.14), 0.12, 0.2, LACE, n=8)
        with part("hand.l" if s_ > 0 else "hand.r"):
            hand_mitt(hx, hy, hz, s_, MITT, SKIN)
    with part("prop.l"):
        # the cake on a plate, the plate's rim in the right mitten, cake out to the side
        hx, hy, hz = hp[1]
        k_ = 0.9
        cx, cy, cz = hx + 0.66, hy - 0.14, hz - 0.12  # held out low, clear of the head
        can(cx, cy, cz, 0.64, 0.06, PLATE, n=12)
        can(cx, cy, cz + 0.15 * k_, 0.32 * k_, 0.24 * k_, CAKE, n=10)
        can(cx, cy, cz + 0.29 * k_, 0.34 * k_, 0.06 * k_, ICING, n=10)
        can(cx, cy, cz + 0.43 * k_, 0.22 * k_, 0.2 * k_, CAKE, n=10)
        can(cx, cy, cz + 0.55 * k_, 0.24 * k_, 0.06 * k_, ICING, n=10)
        for k in range(8):
            a = 2 * math.pi * k / 8
            ball(cx + 0.3 * k_ * math.cos(a), cy + 0.3 * k_ * math.sin(a), cz + 0.3 * k_, 0.14, 0.14, 0.14, ICING, seg=6, ring=4)
        ball(cx, cy, cz + 0.68 * k_, 0.24, 0.24, 0.24, CHERRY, seg=8, ring=5)
    with part("head"):
        # the head, with a beauty spot
        head_skin()
        face(0, HEAD_Z - HEAD * 0.05, FY, HEAD)
        ball(0.62, FY - 0.03, HEAD_Z - 0.45, 0.07, 0.04, 0.07, DARK, seg=6, ring=4)
        # the wig: a powdered cap, sausage curls down the sides, then three tiers up
        cap(POWDER, lift=0.05)
        for s in (-1, 1):
            for k, z in enumerate((HEAD_Z + 0.35, HEAD_Z - 0.15, HEAD_Z - 0.65)):
                can(s * 1.42, -0.15, z, 0.26, 1.3, POWDER if k % 2 == 0 else POWDER_D, n=8, rot=(R(90), 0, 0))
        tiers = ((4.6, 2.75, 1.45), (5.85, 2.3, 1.3), (6.95, 1.8, 1.05))
        for z, w, h in tiers:
            box(0, 0.1, z, w, w * 0.85, h, POWDER, bevel=0.4, segs=3)
            for s in (-1, 1):  # a roll curl at each side of each tier
                can(s * w * 0.5, -0.05, z - h * 0.25, 0.24, w * 0.65, POWDER_D, n=8, rot=(R(90), 0, 0))
        # curls dotted on the front
        for x, z in ((-0.7, 4.3), (0.0, 4.15), (0.7, 4.3), (-0.45, 5.6), (0.45, 5.6), (0.0, 6.8)):
            ball(x, -1.05 + (z - 4) * 0.12, z, 0.45, 0.3, 0.45, POWDER_D, seg=8, ring=5)
        # a pearl string looping across the front
        for i in range(11):
            t = i / 10
            x = -1.15 + 2.3 * t
            z = 5.1 - 0.35 * math.sin(math.pi * t)
            ball(x, -1.08, z, 0.15, 0.15, 0.15, PEARL, seg=6, ring=4)
        # pink bows
        bow(-0.95, -1.0, 6.25, 0.4, PINK)
        bow(0.95, -1.02, 4.85, 0.36, PINK)
        # the ship on top
        ship(0.0, 7.45)


if __name__ == "__main__" or True:
    out = sys.argv[sys.argv.index("--") + 1]
    render_costume("marie-antoinette", build, out, ortho=10.5, target_z=4.3)
