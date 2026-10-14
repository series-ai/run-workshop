"""Disco snail: a glittery mirror-ball shell on the kid's back, faceted in
silver, lilac and purple, with sparkle glints on it; snail eye-stalks
on a sparkly pink headband; a purple sequinned bell-bottom suit with a huge
white disco collar and a gold medallion; gold platform shoes; a little
glittery snail tail sewn on at the seat, drooping behind. Arms hang at the sides;
one mitt carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import random
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

SUIT, SUIT_D, SEQUIN, BAND = (0.6, 0.28, 0.9), (0.45, 0.18, 0.72), (0.9, 0.85, 1.0), (1.0, 0.4, 0.75)
GOLD, PLATFORM, COLLAR, HAIR = (1.0, 0.8, 0.2), (1.0, 0.4, 0.75), (0.99, 0.98, 0.96), (0.3, 0.17, 0.09)
FACETS = [(0.88, 0.9, 0.96), (0.72, 0.75, 0.84), (0.98, 0.98, 1.0), (0.6, 0.38, 0.92), (0.8, 0.66, 1.0), (0.55, 0.58, 0.68)]
STALK = (0.75, 0.55, 0.95)


def sweep(pts, radii, rgb, m=6):
    """One round tube through `pts` (a ring of m corners at each point, mitred so
    the bends keep their thickness), capped at both ends: the whole tail in one
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


def mirror_ball(x, y, z, d):
    """A faceted disco ball: every face a random silver or purple tile."""
    o = ball(x, y, z, d, d, d, FACETS[0], seg=16, ring=10)
    for c in FACETS[1:]:
        o.data.materials.append(mat(c))
    rnd = random.Random(5)
    for p in o.data.polygons:
        p.material_index = rnd.choice((0, 0, 1, 2, 3, 4, 5, 1))
    return o


def sparkle(x, y, z, r, rgb=WHITE):
    box(x, y, z, r * 2, 0.05, r * 0.35, rgb)
    box(x, y, z, r * 0.35, 0.05, r * 2, rgb)
    box(x, y, z, 0.05 + r * 0.3, r * 2, r * 0.35, rgb)
    ball(x, y, z, r * 0.6, r * 0.6, r * 0.6, rgb, seg=4, ring=2)


def build():
    body(shirt=SUIT, pants=SUIT, leg_colour=SUIT, shoe=GOLD, arms=False)
    for s in (-1, 1):
        fx = s * TW * 0.24
        sd = "l" if s > 0 else "r"
        with part(f"foot.{sd}"):
            box(fx, -FOOT * 0.25, 0.08, FOOT * 0.82, FOOT * 1.2, 0.16, PLATFORM, bevel=0.04)       # platform soles
        with part(f"leg.{sd}"):
            can(fx, 0, 0.42, 0.33, 0.36, SUIT, n=8, r2=0.14)                                        # bell bottoms
            for k in range(4):
                a = k * math.pi / 2 + 0.4
                ball(fx + 0.27 * math.cos(a), 0.27 * math.sin(a), 0.3, 0.07, 0.07, 0.07, SEQUIN, seg=4, ring=3)
    fy = -TD * 0.5
    with part("chest"):  # sequins, collar points and medallion sit on the shirt
        # sequins on the suit
        rnd = random.Random(2)
        for i in range(8):
            ball(rnd.uniform(-0.4, 0.4), fy - 0.02, rnd.uniform(HIP + 0.05, TOP - 0.1), 0.09, 0.04, 0.09, SEQUIN, seg=4, ring=3)
        # the huge white disco collar points and the gold medallion
        for s in (-1, 1):
            can(s * 0.3, fy - 0.03, TOP - 0.2, 0.32, 0.05, COLLAR, n=3, rot=(math.radians(90), 0, math.radians(180 + s * 25)))
        limb((-0.15, fy - 0.06, TOP - 0.05), (0, fy - 0.07, TOP - 0.45), 0.025, GOLD)
        limb((0.15, fy - 0.06, TOP - 0.05), (0, fy - 0.07, TOP - 0.45), 0.025, GOLD)
        can(0, fy - 0.08, TOP - 0.52, 0.14, 0.05, GOLD, n=8, rot=(math.radians(90), 0, 0))
    # the standard hanging arms (no raised pose: the old raised arm read as a
    # purple bar up the side of the head); the left mitt carries the bucket
    sx = TW * 0.5 + 0.08
    for s_ in (-1, 1):
        with part("arm.l" if s_ > 0 else "arm.r"):
            limb((s_ * sx, 0, TOP - 0.15), (s_ * (sx + 0.16), -0.05, TOP - ARM_DROP), 0.12, SUIT)
    with part("hand.l"):
        hand_mitt(*hand_points()[1], 1, MITT, SKIN)
    lh = hand_points()[-1]
    with part("hand.r"):
        hand_mitt(*lh, -1, MITT, SKIN)
    bucket(lh, full=True, size=0.62)
    # the shell straps: over the shoulders and down the back to the padded
    # saddle the shell sits on, like a backpack
    SH_Y, SH_Z, SH_D = 2.2, 1.15, 2.0     # the mirror-ball shell: centre (y, z) and size
    with part("chest"):
        for s in (-1, 1):
            box(s * 0.32, 0, TOP - 0.02, 0.18, TD + 0.08, 0.1, SUIT_D)
            box(s * 0.32, TD * 0.5 + 0.03, (TOP + HIP + 0.35) / 2, 0.18, 0.08, TOP - HIP - 0.35, SUIT_D)
        box(0, (TD * 0.5 + SH_Y - SH_D * 0.5) / 2 + 0.05, SH_Z - 0.1, 0.9, SH_Y - SH_D * 0.5 - TD * 0.5 + 0.2, 0.62, SUIT_D, bevel=0.12, segs=2)
    # the glittery snail tail: sewn on at the seat of the suit, running back low
    # under the shell and curling up at the tip, clear of the ground
    with part("body"):
        box(0, TD * 0.5 - 0.02, HIP + 0.12, 0.7, 0.2, 0.42, SUIT_D, bevel=0.08)       # the seam patch on the seat
        tail = [(0, TD * 0.5, HIP + 0.1, 0.3), (0, 1.05, 0.4, 0.27), (0, 1.75, 0.3, 0.22), (0, 2.4, 0.32, 0.16), (0, 2.85, 0.5, 0.1)]
        sweep([Vector(t[:3]) for t in tail], [t[3] * 1.02 for t in tail], SUIT_D, m=8)  # one smooth tapering tail
        ball(*tail[-1][:3], tail[-1][3] * 2.05, tail[-1][3] * 2.05, tail[-1][3] * 1.7, SUIT_D, seg=6, ring=4)
        for k in range(5):
            x, y, z, r = tail[k]
            ball(0.12 * (-1) ** k, y + 0.1, z + r * 0.8, 0.08, 0.08, 0.08, SEQUIN, seg=4, ring=3)
    # the kid's head with a sparkly headband and eye stalks
    kid_head(hair=HAIR)
    with part("head"):
        w = HEAD
        box(0, 0.05, HEAD_Z + w * 0.2, w * 1.07, w * 1.0, 0.2, BAND, bevel=0.06)
        for s in (-1, 1):
            base = (s * 0.55, -0.1, HEAD_Z + w * 0.48)
            tip = (s * 0.95, -0.35, HEAD_Z + w * 0.48 + 1.15)
            limb(base, tip, 0.1, STALK, n=8)
            ball(*base, 0.34, 0.34, 0.2, BAND, seg=6, ring=4)
            ball(*tip, 0.5, 0.5, 0.5, WHITE, seg=8, ring=6)
            ball(tip[0] + s * 0.02, tip[1] - 0.2, tip[2] + 0.02, 0.24, 0.12, 0.26, DARK, seg=6, ring=4)
            ball(tip[0] - 0.04, tip[1] - 0.26, tip[2] + 0.08, 0.07, 0.04, 0.07, WHITE, seg=6, ring=4)
    # the mirror-ball shell worn low on the back (on its saddle, under the
    # head's overhang), with a hanging hook ring and glints
    with part("chest"):  # the shell is worn on the back: ball, hook ring and glints
        cx, cy, cz, d = 0, SH_Y, SH_Z, SH_D
        mirror_ball(cx, cy, cz, d)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.18, minor_radius=0.05, major_segments=10, minor_segments=4,
                                         location=(cx, cy, cz + d / 2 + 0.12), rotation=(0, math.radians(90), 0))
        finish(bpy.context.object, (0.72, 0.75, 0.84))
        # glints sitting right on the shell's surface (no loose sparkles in the air)
        from mathutils import Vector as V
        for (dx, dy, dz, r) in ((-0.8, -0.2, 0.6, 0.24), (0.85, 0.1, 0.5, 0.2), (-0.9, 0.0, -0.4, 0.18), (0.9, 0.2, -0.3, 0.22), (0.3, 0.5, 0.8, 0.17)):
            p = V((cx, cy, cz)) + V((dx, dy, dz)).normalized() * (d / 2 + 0.02)
            sparkle(p.x, p.y, p.z, r)


if __name__ == "__main__" or True:
    render_costume("disco-snail", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
