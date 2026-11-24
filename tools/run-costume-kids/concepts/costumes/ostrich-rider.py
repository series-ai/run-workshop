"""Ostrich rider: the classic "riding" costume. The kid sits in a big fluffy
black ostrich body round the waist (white wing tips and a white tail plume);
a long pink S-neck rises from the front, swung out to one side so the kid's
face stays clear, up to a little ostrich head with googly lashed eyes and an
orange beak. Fake little kid legs in jeans and red sneakers dangle over the
sides; the kid's real legs, in pink tights, and grey shoes are the ostrich's
legs and feet. The rider wears red-and-yellow racing silks and a giant silly
jockey cap (quartered dome, long red bill, goggles, a huge pom-pom). One mitt
holds the reins, the other the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from mathutils import Vector
from props import _bucket

FEATHER, FEATHER_L, PLUME = (0.16, 0.14, 0.17), (0.28, 0.25, 0.3), (0.98, 0.97, 0.95)
NECK, NECK_D, BEAK, FOOTC = (1.0, 0.55, 0.72), (0.88, 0.4, 0.58), (1.0, 0.6, 0.15), (0.55, 0.52, 0.56)
JEANS, SNEAK, SHIRT, REIN = (0.25, 0.42, 0.78), (0.95, 0.25, 0.3), (1.0, 0.82, 0.15), (0.6, 0.3, 0.12)
SILK, SILK2 = (0.95, 0.2, 0.3), (1.0, 0.82, 0.15)


def sweep(pts, radii, rgb, m=6):
    """One round tube through `pts` (a ring of m corners at each point, mitred so
    the bends keep their thickness), capped at both ends: the whole neck in one
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


def chain(pts, r, rgb):
    """The neck: one smooth tube through the points, a round knob at the base."""
    sweep([Vector(p) for p in pts], [r] * len(pts), rgb, m=8)
    ball(*pts[0], r * 2, r * 2, r * 2, rgb, seg=8, ring=5)

def build():
    body(pants=NECK, leg_colour=NECK, shoe=FOOTC, torso=False, arms=False)
    for s in (-1, 1):  # toe claws on the "ostrich feet"
        for k in (-1, 0, 1):
            with part("foot.l" if s > 0 else "foot.r"):
                can(s * TW * 0.24 + k * 0.12, -FOOT * 0.25 - FOOT * 0.6, 0.08, 0.06, 0.16, DARK, n=4, r2=0.0, rot=(math.radians(90), 0, 0))
    with part("body"):
        # the fluffy body round the kid's waist
        bz = 1.05  # its top stays under the kid's head, so the head never dips into it
        box(0, 0.3, bz, 3.0, 3.1, 0.9, FEATHER, bevel=0.44, segs=2)
        import random
        rnd = random.Random(3)
        for i in range(8):  # feather fluff along the rim
            a = 2 * math.pi * i / 8 + 0.2
            x, y = 1.45 * math.cos(a), 0.3 + 1.5 * math.sin(a)
            ball(x, y, bz + rnd.uniform(-0.35, 0.1), 0.85, 0.85, 0.62, FEATHER_L if i % 2 else FEATHER, seg=6, ring=4)
        for s in (-1, 1):  # white wing tips
            box(s * 1.45, 0.75, bz - 0.06, 0.4, 1.7, 0.95, FEATHER_L, bevel=0.18, rot=(math.radians(-12), 0, 0))
            ball(s * 1.6, 1.45, bz + 0.0, 0.42, 0.9, 0.75, PLUME, seg=6, ring=4)
        # the white tail plume, fanning up behind
        for k, (dx, dz, sz) in enumerate(((0, 0.55, 0.8), (-0.38, 0.4, 0.66), (0.38, 0.4, 0.66), (0, 0.95, 0.62))):
            ball(dx * 1.3, 1.85 + dz * 0.3, bz + dz * 1.3, sz * 1.25, sz, sz * 1.25, PLUME, seg=6, ring=4)
        # a saddle-blanket stripe the kid sits in
        box(0, 0.0, bz + 0.5, 1.3, 1.2, 0.2, SHIRT, bevel=0.08)
        # the fake legs dangling over the sides, jeans and red sneakers
        for s in (-1, 1):
            k = (s * 1.75, -0.45, bz + 0.25)
            limb((s * 0.8, -0.45, bz + 0.55), k, 0.13, JEANS)
            f = (s * 1.82, -0.52, bz - 0.5)
            limb(k, f, 0.12, JEANS)
            box(f[0], f[1] - 0.12, f[2] - 0.12, 0.3, 0.46, 0.24, SNEAK, bevel=0.07)
    # the kid's arms: the left holds the reins, the right the bucket
    # they rest on the ostrich, so they ride its body (and the bucket with them)
    lh = (-0.85, -0.95, 1.65)
    rh = (1.75, -0.65, 1.62)
    with part("body"):
        limb((-0.55, -0.2, 1.65), lh, 0.11, SILK)
        limb((0.55, -0.2, 1.65), rh, 0.11, SILK)
        hand_mitt(*lh, -1, MITT, SKIN)
        hand_mitt(*rh, 1, MITT, SKIN)
        _bucket(rh, True, 0.6)
    with part("head"):
        # the kid's head (no hair: the jockey cap covers it)
        box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)
        face(0, HEAD_Z - HEAD * 0.05, -HEAD * 0.46, HEAD)
        # a giant silly jockey cap: a tall quartered dome, a long red bill, a huge pom-pom
        cz0 = HEAD_Z + HEAD * 0.25
        box(0, 0.03, cz0 + 0.55, HEAD * 1.08, HEAD * 1.0, 1.5, SILK2, bevel=0.55, segs=2)
        box(0, 0.03, cz0 + 1.2, HEAD * 0.86, HEAD * 0.8, 0.7, SILK2, bevel=0.32)
        for x in (-0.55, 0.55):  # red quarters running front to back over the dome
            box(x, 0.03, cz0 + 0.62, 0.55, HEAD * 1.02, 1.5, SILK, bevel=0.2)
            box(x * 0.8, 0.03, cz0 + 1.22, 0.45, HEAD * 0.82, 0.72, SILK, bevel=0.15)
        box(0, -HEAD * 0.5 - 0.35, cz0 - 0.18, HEAD * 0.9, 1.0, 0.16, SILK, bevel=0.06, rot=(math.radians(-8), 0, 0))  # the bill
        ball(0, 0.03, cz0 + 1.85, 0.95, 0.95, 0.9, SILK, seg=8, ring=6)  # pom-pom
        box(0, -HEAD * 0.5 - 0.02, cz0 - 0.08, HEAD * 1.04, 0.08, 0.14, DARK)  # cap band
        for s in (-1, 1):  # goggles pushed up on the cap
            can(s * 0.48, -HEAD * 0.5 - 0.05, cz0 + 0.62, 0.34, 0.16, DARK, n=8, rot=(math.radians(90), 0, 0))
            can(s * 0.48, -HEAD * 0.5 - 0.12, cz0 + 0.62, 0.24, 0.06, (0.6, 0.9, 1.0), n=8, rot=(math.radians(90), 0, 0))
        box(0, -HEAD * 0.5 - 0.05, cz0 + 0.62, 0.3, 0.08, 0.1, DARK)
    with part("body"):
        # the long S-neck from the front of the body, swung out to the left
        neck = [(-0.5, -1.2, 1.5), (-1.5, -1.6, 2.0), (-1.95, -1.75, 3.0), (-1.95, -1.7, 4.1), (-1.7, -1.6, 4.85)]
        chain(neck, 0.3, NECK)
        for k in range(3):  # a fluffy ruff at the neck base
            a = math.radians(-50 + 50 * k)
            ball(-0.5 + 0.45 * math.sin(a), -1.1 - 0.3 * math.cos(a), 1.6, 0.6, 0.6, 0.5, FEATHER, seg=6, ring=4)
    with part("body"):  # the rein, from the mitt to the neck
        limb(lh, (-1.5, -1.6, 2.05), 0.045, REIN)
    with part("body"):
        # the ostrich head: a little egg with googly eyes, a beak and a tuft
        hx, hy, hz = -1.7, -1.75, 5.45
        S = 2.1
        ball(hx, hy, hz, 0.8 * S, 0.85 * S, 0.75 * S, NECK, seg=8, ring=6)
        box(hx, hy - 0.5 * S, hz - 0.1 * S, 0.5 * S, 0.45 * S, 0.22 * S, BEAK, bevel=0.1)
        box(hx, hy - 0.47 * S, hz - 0.24 * S, 0.42 * S, 0.38 * S, 0.1 * S, (0.9, 0.48, 0.1), bevel=0.04)
        for s in (-1, 1):
            ex = hx + s * 0.18 * S
            ball(ex, hy - 0.33 * S, hz + 0.18 * S, 0.3 * S, 0.12 * S, 0.34 * S, WHITE, seg=8, ring=4)
            ball(ex, hy - 0.39 * S, hz + 0.15 * S, 0.15 * S, 0.06 * S, 0.2 * S, DARK, seg=6, ring=4)
        for j in (-1, 0, 1):  # a scruffy tuft
            limb((hx, hy, hz + 0.3 * S), (hx + j * 0.3, hy + 0.05, hz + 1.2), 0.08, FEATHER, n=5)
            ball(hx + j * 0.3, hy + 0.05, hz + 1.24, 0.26, 0.26, 0.26, FEATHER, seg=6, ring=4)


if __name__ == "__main__" or True:
    render_costume("ostrich-rider", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
