"""Beach witch: the same giant crooked witch hat (purple, green band, gold
buckle) now with a pink flower tucked in the band, on a kid in pink
sunglasses. A plain little-kid teal one-piece swimsuit with yellow polka
dots and a frilly skirt, bare arms and legs, orange arm floaties and
flip-flops. One mitten swings a blue sand pail full of sand, the other the
pumpkin candy bucket. Rendered with the taller witch camera."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket  # noqa: E402

HAT, HAT_D, BAND, GOLD = (0.46, 0.24, 0.66), (0.32, 0.15, 0.48), (0.36, 0.80, 0.30), (1.0, 0.78, 0.22)
RASH, RASH_D, SHORTS, FLOWER = (0.15, 0.76, 0.80), (0.08, 0.50, 0.62), (1.0, 0.52, 0.18), (1.0, 0.92, 0.35)
FLOATY, FRAME, LENS = (1.0, 0.42, 0.20), (1.0, 0.36, 0.62), (0.10, 0.12, 0.22)
HAIR, SOLE = (0.98, 0.80, 0.38), (0.98, 0.30, 0.55)
PAIL, PAIL_RIM, SAND, SPADE = (0.22, 0.52, 0.98), (1.0, 0.85, 0.15), (0.98, 0.86, 0.58), (1.0, 0.84, 0.12)
HIBISCUS = (1.0, 0.35, 0.55)
SUIT, SUIT_D, FRILL, DOT = (0.10, 0.74, 0.78), (0.05, 0.50, 0.58), (0.55, 0.92, 0.90), (1.0, 0.92, 0.30)


def bar(p0, p1, r0, r1, rgb, n=8):
    """A tapered bar from p0 (radius r0) to p1 (radius r1)."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def sweep(pts, radii, rgb, m=6):
    """One round tube through `pts` (a ring of m corners at each point, mitred so
    the bends keep their thickness), capped at both ends: the whole hat cone in one
    cheap piece instead of a bar and a ball per segment."""
    verts, faces = [], []
    for i, p in enumerate(pts):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
        t, k = (b - a).normalized(), 1.0
        if 0 < i < len(pts) - 1:
            t0, t1 = (p - a).normalized(), (b - p).normalized()
            t = (t0 + t1).normalized()
            k = 1.0 / max(0.5, t0.dot(t))  # mitre: keep the tube's thickness through the bend
        u = t.cross(Vector((0, -1, 0)))
        if u.length < 1e-4:
            u = t.cross(Vector((0, 0, 1)))
        u.normalize()
        v = u.cross(t).normalized()
        for j in range(m):
            ang = 2 * math.pi * (j + 0.5) / m
            verts.append(p + (u * math.cos(ang) * k + v * math.sin(ang)) * radii[i])
    for i in range(len(pts) - 1):
        for j in range(m):
            faces.append((i * m + j, i * m + (j + 1) % m, (i + 1) * m + (j + 1) % m, (i + 1) * m + j))
    faces.append(tuple(range(m - 1, -1, -1)))
    faces.append(tuple((len(pts) - 1) * m + j for j in range(m)))
    me = bpy.data.meshes.new("tube")
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    ob = bpy.data.objects.new("tube", me)
    bpy.context.scene.collection.objects.link(ob)
    return finish(ob, rgb)


def ring(x, y, z, R, r, rgb, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=8, minor_segments=4, location=(x, y, z), rotation=rot)
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
    sweep([Vector(p) for p in pts], rad, HAT, m=8)  # the crooked cone in one bent tube
    ball(0, 0, bz + 1.5, 1.96, 1.96, 0.5, HAT, seg=8, ring=4)
    box(0.4, -0.8, bz + 1.95, 0.32, 0.05, 0.28, BAND, rot=(math.radians(14), 0, math.radians(20)))
    by = -1.42 * math.cos(rz) - 0.04
    box(0, by, bz + 0.32, 0.6, 0.07, 0.5, GOLD, bevel=0.04)
    box(0, by - 0.03, bz + 0.32, 0.34, 0.07, 0.26, BAND)
    # a big pink beach flower tucked in the band at the side
    fx, fy, fz = -1.0, -0.95, bz + 0.42
    for k in range(5):
        a = 2 * math.pi * k / 5
        ball(fx + 0.2 * math.cos(a), fy - 0.05, fz + 0.2 * math.sin(a), 0.32, 0.12, 0.32, HIBISCUS, seg=6, ring=3)
    ball(fx, fy - 0.12, fz, 0.14, 0.1, 0.14, FLOWER, seg=6, ring=4)


def floaty(x, y, z, rot):
    """An inflatable arm band on the upper arm."""
    ring(x, y, z, 0.2, 0.15, FLOATY, rot=rot)
    ball(x, y - 0.3, z + 0.02, 0.1, 0.12, 0.1, WHITE, seg=6, ring=4)  # the valve


def build():
    body(shirt=SUIT, sleeve=SKIN, pants=SUIT, leg_colour=SKIN, shoe=SKIN, arms=False, torso=False)
    # flip-flops: a pink sole under each bare foot and a V strap
    for s in (-1, 1):
        fx = s * TW * 0.24
        with part("foot.l" if s > 0 else "foot.r"):
            box(fx, -FOOT * 0.25, 0.02, FOOT * 0.86, FOOT * 1.26, 0.06, SOLE, bevel=0.02)
            for k in (-1, 1):
                limb((fx, -FOOT * 0.62, 0.22), (fx + k * FOOT * 0.33, -FOOT * 0.18, 0.22), 0.035, SOLE)
            for k in (-1, 0, 1):
                box(fx + k * 0.11, -FOOT * 0.25 - FOOT * 0.58, 0.12, 0.08, 0.04, 0.08, (0.9, 0.62, 0.5))  # toes
    # a little kid's one-piece swimsuit: bare shoulders and arms, two wide straps,
    # a frilly skirt at the hips and big polka dots
    with part("chest"):
        box(0, 0, TOP - TH * 0.12, TW * 0.96, TD * 0.94, TH * 0.24, SKIN, bevel=0.08)              # shoulders
        box(0, 0, HIP + TH * 0.4, TW + 0.02, TD + 0.02, TH * 0.8, SUIT, bevel=0.08)                  # the suit
        for s in (-1, 1):
            box(s * TW * 0.26, 0, TOP - TH * 0.1, 0.2, TD + 0.04, TH * 0.24, SUIT, bevel=0.04)        # straps
        box(0, -TD * 0.5 - 0.02, HIP + TH * 0.78, TW * 0.5, 0.04, 0.05, SUIT_D)                     # neckline trim
    with part("body"):
        can(0, 0, HIP + 0.06, TW * 0.6, 0.22, FRILL, n=10, r2=TW * 0.5)                             # the frill skirt
        for k in range(8):
            a = 2 * math.pi * (k + 0.5) / 8
            ball(TW * 0.6 * math.cos(a), TW * 0.6 * math.sin(a) * 0.98, HIP - 0.04, 0.18, 0.18, 0.1, FRILL, seg=6, ring=3)
    with part("chest"):
        fy = -TD * 0.5 - 0.03
        for x, z in ((-0.26, HIP + TH * 0.6), (0.24, HIP + TH * 0.42), (0.02, HIP + TH * 0.68), (-0.08, HIP + TH * 0.3), (0.32, HIP + TH * 0.7)):
            can(x, fy, z, 0.07, 0.03, DOT, n=6, rot=(math.radians(90), 0, 0))
    with part("arm.l"):
        floaty(TW * 0.5 + 0.15, -0.02, TOP - 0.36, (0, math.radians(22), 0))
    with part("arm.r"):
        floaty(-TW * 0.5 - 0.3, -0.1, TOP - 0.16, (0, math.radians(90), math.radians(-32)))
    # right mitten: the pumpkin candy bucket
    hx, hy, hz = hand_points()[1]
    with part("arm.l"):
        limb((TW * 0.5 + 0.08, 0, TOP - 0.15), (TW * 0.5 + 0.24, -0.05, TOP - ARM_DROP), 0.11, SKIN)
    with part("hand.l"):
        hand_mitt(hx, hy, hz, 1, MITT, SKIN)
    bucket((hx, hy, hz), full=True, size=0.65)
    # left arm raised a little, swinging the sand pail
    sx = TW * 0.5 + 0.08
    bx, by, bz = -1.15, -0.3, TOP - 0.2
    with part("arm.r"):
        limb((-sx, 0, TOP - 0.15), (bx + 0.12, by, bz + 0.05), 0.11, SKIN)
    with part("hand.r"):
        hand_mitt(bx, by, bz, -1, MITT, SKIN)
    with part("prop.r"):
        top = bz - 0.32
        can(bx, by, top - 0.3, 0.26, 0.58, PAIL, n=8, r2=0.34)
        can(bx, by, top + 0.01, 0.36, 0.08, PAIL_RIM, n=8)
        ball(bx, by, top + 0.08, 0.62, 0.62, 0.3, SAND, seg=8, ring=4)
        for s in (-1, 1):
            limb((bx + s * 0.34, by, top), (bx + s * 0.18, by, bz + 0.3), 0.04, PAIL_RIM)
        limb((bx - 0.18, by, bz + 0.3), (bx + 0.18, by, bz + 0.3), 0.04, PAIL_RIM)
        ball(bx + 0.15, by - 0.36, top - 0.32, 0.18, 0.06, 0.18, WHITE, seg=6, ring=4)  # a starfish sticker
    with part("head"):
        # the head: beachy blonde hair, long down the sides
        w = HEAD
        box(0, 0, HEAD_Z, w, w * 0.92, w * 0.9, SKIN, bevel=w * 0.14, segs=2)
        box(0, w * 0.05, HEAD_Z + 0.62, w * 1.04, w * 0.98, 0.6, HAIR, bevel=0.2, segs=2)
        box(0, 0.3, HEAD_Z + 0.02, w * 1.06, w * 0.7, w * 0.86, HAIR, bevel=0.3)
        for s in (-1, 1):
            box(s * w * 0.5, -0.45, HEAD_Z - 0.55, 0.36, 0.5, 1.0, HAIR, bevel=0.14)
            box(s * w * 0.5, -0.45, HEAD_Z - 1.1, 0.3, 0.42, 0.3, HAIR, bevel=0.1, rot=(0, s * math.radians(25), 0))
        face(0, HEAD_Z - w * 0.05, -w * 0.46, w)
        # big pink sunglasses over the eyes and a white sunscreen stripe on the nose
        gy, gz = -w * 0.46 - 0.06, HEAD_Z + 0.02
        for s in (-1, 1):
            box(s * 0.55, gy, gz, 0.82, 0.08, 0.6, FRAME, bevel=0.14)
            box(s * 0.55, gy - 0.05, gz - 0.01, 0.64, 0.06, 0.44, LENS, bevel=0.1)
            box(s * 0.42, gy - 0.09, gz + 0.1, 0.14, 0.03, 0.08, WHITE)
            limb((s * 0.95, gy, gz + 0.1), (s * 1.24, -0.4, gz + 0.12), 0.04, FRAME)
        box(0, gy, gz + 0.08, 0.32, 0.08, 0.1, FRAME)
        witch_hat(HEAD_Z + 0.95)


if __name__ == "__main__" or True:
    out = sys.argv[sys.argv.index("--") + 1]
    render_costume("beach-witch", build, out, ortho=9.6, target_z=3.9)
