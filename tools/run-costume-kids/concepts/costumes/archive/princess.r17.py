"""Princess: the kid in a puffy pink ball gown (a big bell skirt in two
ruffled tiers, a bodice with a gold trim and puff sleeves), long golden
hair, a huge pink cone hennin (taller than the kid) with gold bands and jewels,
a veil draping behind and a long ribbon streamer flying off the tip, a little gold tiara at the front,
and a star wand held up. The full bucket in the other mitten."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

PINK, PINK_L, PINK_D, GOLD = (1.0, 0.52, 0.74), (1.0, 0.80, 0.90), (0.88, 0.32, 0.58), (1.0, 0.80, 0.18)
VEIL, HAIR, JEWEL, WAND = (0.86, 0.80, 1.0), (0.98, 0.78, 0.30), (0.45, 0.75, 1.0), (1.0, 0.95, 0.4)

X90 = (math.radians(90), 0, 0)


def arm(s, hand, sleeve, r=0.11, mitt=True):
    """A sleeve from the shoulder to a mitten at `hand`."""
    sh = (s * (TW * 0.5 + 0.08), 0, TOP - 0.15)
    d = [h - a for a, h in zip(sh, hand)]
    L = math.sqrt(sum(c * c for c in d))
    limb(sh, tuple(h - c / L * 0.14 for h, c in zip(hand, d)), r, sleeve)
    if mitt:
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


def veil(base, axis):
    """The veil: a soft rounded drape pinned round the back of the hennin,
    widening as it falls over the back of the hair to the shoulders, in a
    few gentle rounded folds with a scalloped hem."""
    # rows (height, centre y, half-width, depth): the top hugs the cone, the rest clears the hair
    t = (5.5 - base.z) * axis.length / axis.z
    c = base + axis * t
    rows = [(5.5, c.y, 0.82, 0.82), (4.6, 0.3, 1.22, 1.06), (3.9, 0.35, 1.58, 1.3), (3.0, 0.38, 1.7, 1.38), (2.05, 0.42, 1.8, 1.44)]
    zs = [z for z, *_ in rows]
    NR, NC, FOLDS = 12, 28, 5
    verts, faces = [], []
    for i in range(NR + 1):
        z = zs[0] + (zs[-1] - zs[0]) * i / NR
        k = max(j for j in range(len(rows) - 1) if rows[j][0] >= z) if z > zs[-1] else len(rows) - 2
        f = (rows[k][0] - z) / (rows[k][0] - rows[k + 1][0])
        _, yc, rx, ry = [a + (b - a) * f for a, b in zip(rows[k], rows[k + 1])]
        cx = c.x * (1 - i / NR)
        fold = 0.1 * (i / NR) ** 0.8          # folds deepen as the veil falls
        for j in range(NC + 1):
            th = math.pi * j / NC
            rr = 1 + fold * math.cos(2 * FOLDS * th)
            zz = z - (0.16 * (1 - math.cos(2 * FOLDS * th)) * 0.5 if i == NR else 0)   # the scalloped hem
            verts.append((cx + rx * rr * math.cos(th), yc + ry * rr * math.sin(th), zz))
            if i and j:
                a = (i - 1) * (NC + 1) + j
                faces.append((a - 1, a, a + NC + 1, a + NC))
    o = mesh_obj(verts, faces, VEIL, 0.1)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def tilt(objs, at, deg):
    """Turn objs about the y axis through `at` (positive leans their tops towards +x)."""
    from mathutils import Matrix
    M = Matrix.Translation(at) @ Matrix.Rotation(math.radians(deg), 4, "Y") @ Matrix.Translation([-v for v in at])
    for o in objs:
        o.matrix_world = M @ o.matrix_world


def build():
    body(shirt=PINK, pants=PINK, leg_colour=PINK, shoe=PINK_D, legs=False, torso=False, arms=False)  # the legs are hidden in the skirt
    with part("body"):  # the bell skirt and its bows
        # the bell skirt: two ruffled tiers, a hem ruffle
        can(0, 0, 0.3, 1.08, 0.5, PINK, n=12, r2=0.86)
        can(0, 0, 0.08, 1.14, 0.14, PINK_L, n=12)
        can(0, 0, 0.57, 0.92, 0.12, PINK_L, n=12)
        can(0, 0, 0.78, 0.82, 0.42, PINK, n=12, r2=0.58)  # slim enough that the swinging bucket clears it
        for i in range(12):                                   # little bows around the hem
            a = i * math.pi / 6 + math.pi / 12
            ball(1.1 * math.cos(a), 1.1 * math.sin(a), 0.24, 0.16, 0.16, 0.16, PINK_D, seg=6, ring=4)
    for sd, s in (("l", 1), ("r", -1)):  # hidden ankles up into the skirt, so the shoes stay on the kid
        with part(f"foot.{sd}"):
            can(s * 0.23, -0.06, 0.17, 0.12, 0.3, PINK_D, n=6)
    with part("chest"):  # the bodice and its trims
        # the bodice, a gold trim and a pendant
        box(0, 0, 1.15, 0.86, 0.66, 0.5, PINK, bevel=0.08)
        can(0, 0, 0.98, 0.6, 0.08, GOLD, n=10)
        can(0, 0, 1.38, 0.5, 0.08, PINK_L, n=10)
        ball(0, -0.37, 1.2, 0.16, 0.08, 0.2, JEWEL, seg=6, ring=4)
    # puff sleeves
    for s in (-1, 1):
        with part("arm.l" if s > 0 else "arm.r"):
            ball(s * 0.55, 0, 1.22, 0.46, 0.46, 0.4, PINK, seg=8, ring=6)
    # right mitten holds up the star wand; left carries the bucket
    rh = (1.45, -0.45, 1.3)
    with part("arm.l"):
        arm(1, rh, PINK_L, r=0.1, mitt=False)
    before = set(bpy.data.objects)
    with part("prop.l"):  # the whole star wand: stick, ribbon, star and sparkles
        limb((rh[0] + 0.02, rh[1] - 0.05, rh[2] - 0.35), (rh[0] + 0.15, rh[1] - 0.12, rh[2] + 1.05), 0.04, WHITE)
        for k in range(4):
            z = rh[2] + 0.0 + k * 0.28
            limb((rh[0] + 0.02 + k * 0.037, rh[1] - 0.06, z), (rh[0] + 0.03 + k * 0.037, rh[1] - 0.07, z + 0.07), 0.05, PINK)
        star(rh[0] + 0.16, rh[1] - 0.13, rh[2] + 1.32, 0.38, 0.1, WAND)
        ball(rh[0] + 0.16, rh[1] - 0.2, rh[2] + 1.32, 0.12, 0.06, 0.12, WHITE, seg=6, ring=4)
        for dx, dz in ((0.45, 0.2), (-0.35, 0.45), (0.3, -0.3)):
            star(rh[0] + 0.16 + dx, rh[1] - 0.13, rh[2] + 1.32 + dz, 0.1, 0.04, WAND, n=4, inner=0.35)
    tilt(set(bpy.data.objects) - before, rh, 55)  # the wand leans out, clear of the head
    with part("hand.l"):
        hand_mitt(*rh, 1, MITT, SKIN)
    lh = (-0.78, -0.4, 0.8)
    with part("arm.r"):
        arm(-1, lh, PINK_L, r=0.1, mitt=False)
    with part("hand.r"):
        hand_mitt(*lh, -1, MITT, SKIN)
    bucket(lh, full=True, size=0.58)
    # the head: golden hair, long down the back
    w = HEAD
    kid_head(hair=HAIR)
    with part("head"):  # hair, tiara, the hennin with its veil, streamer and sparkles
        box(0, w * 0.38, HEAD_Z - 0.3, w * 0.96, 0.6, w * 0.95, HAIR, bevel=0.25, segs=2)
        for s in (-1, 1):
            box(s * (w * 0.5 + 0.02), 0.1, HEAD_Z - 0.1, 0.24, w * 0.7, 1.7, HAIR, bevel=0.1)
            ball(s * (w * 0.5 + 0.02), -0.25, HEAD_Z - 1.0, 0.36, 0.4, 0.36, HAIR, seg=6, ring=4)
        # the tiara at the front of the hair
        tz = HEAD_Z + 0.9
        box(0, -w * 0.47 - 0.04, tz, 1.1, 0.08, 0.1, GOLD)
        for x, h in ((-0.35, 0.22), (0.0, 0.36), (0.35, 0.22)):
            can(x, -w * 0.47 - 0.04, tz + h * 0.5 + 0.03, 0.09, h, GOLD, n=4, r2=0.0)
        ball(0, -w * 0.47 - 0.1, tz + 0.06, 0.14, 0.06, 0.14, JEWEL, seg=6, ring=4)
        # the huge cone hennin, tipped back a little, gold bands, a gold ball on
        # the tip, a veil draping behind the head and a long streamer flying out
        base = Vector((0, 0.15, HEAD_Z + w * 0.44))
        axis = Vector((0.06, 0.22, 1.0)).normalized()
        L, R0 = 4.3, 1.12
        tip = base + axis * L
        veil(base, axis)
        bar(base, tip, R0, 0.05, PINK, n=12)
        bar(base - axis * 0.04, base + axis * 0.24, R0 + 0.07, R0 * 0.96, GOLD, n=12)
        for k, f in enumerate((0.22, 0.44, 0.66)):
            c = base + axis * (L * f)
            r = R0 * (1 - f) + 0.05 * f
            bar(c, c + axis * 0.14, r + 0.05, r * 0.97, GOLD if k == 1 else PINK_D, n=12)
        for k in range(5):  # jewels round the gold band
            a = math.radians(-90 + (k - 2) * 28)
            ball(base.x + (R0 + 0.06) * math.cos(a), base.y + (R0 + 0.06) * math.sin(a), base.z + 0.12, 0.18, 0.18, 0.18, JEWEL if k % 2 == 0 else PINK_D, seg=6, ring=4)
        ball(tip.x, tip.y, tip.z, 0.36, 0.36, 0.36, GOLD, seg=8, ring=5)
        # the streamer: a long ribbon flying out from the tip in a lazy S
        pts = [tip + Vector(d) for d in ((0, 0, 0), (0.7, 0.15, -0.3), (1.5, 0.3, -0.9), (2.05, 0.4, -1.8), (2.15, 0.45, -2.8), (1.85, 0.5, -3.7), (2.1, 0.55, -4.6), (2.6, 0.6, -5.2))]
        verts, faces = [], []
        for i, p in enumerate(pts):
            d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)])
            n = Vector((-d.z, 0, d.x)).normalized()
            wd = 0.3 + i * 0.07
            verts += [tuple(p - n * wd), tuple(p + n * wd)]
            if i:
                faces.append((2 * i - 2, 2 * i - 1, 2 * i + 1, 2 * i))
        mesh_obj(verts, faces, (1.0, 0.70, 0.86), 0.06)
        for i in range(1, len(pts) - 1, 2):  # a few gold sparkles along the ribbon
            ball(pts[i].x, pts[i].y - 0.08, pts[i].z, 0.32, 0.1, 0.32, GOLD, seg=6, ring=4)


if __name__ == "__main__" or True:
    render_costume("princess", build, sys.argv[sys.argv.index("--") + 1], ortho=10.5, target_z=4.3)
