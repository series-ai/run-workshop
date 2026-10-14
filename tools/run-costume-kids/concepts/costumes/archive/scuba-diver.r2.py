"""Scuba diver: the kid in a black wetsuit with teal panels, a big orange
dive mask over the eyes (the eyes look through the blue glass), a yellow
snorkel up the side of the giant head, a yellow air tank on the back with a
silver valve and black straps, a weight belt and huge yellow flippers that
slap out in front like clown shoes. Full bucket in the right mitten."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

SUIT, TEAL, FLIP, FLIP_D = (0.13, 0.14, 0.18), (0.10, 0.78, 0.82), (1.0, 0.85, 0.1), (0.95, 0.62, 0.08)
MASK, GLASS, TANK, SILVER = (1.0, 0.42, 0.18), (0.62, 0.88, 1.0), (1.0, 0.82, 0.12), (0.78, 0.8, 0.84)
SNORK, HAIR = (1.0, 0.85, 0.1), (0.15, 0.09, 0.06)

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


def eyes(cz, fy, w=HEAD, eye=0.16, gap=0.22):
    for s in (-1, 1):
        ex = s * w * gap
        can(ex, fy - 0.02, cz, w * eye * 0.5, 0.06, DARK, n=10, rot=X90)
        can(ex - w * 0.03, fy - 0.06, cz + w * 0.04, w * eye * 0.17, 0.04, WHITE, n=6, rot=X90)


def build():
    body(shirt=SUIT, pants=SUIT, leg_colour=SUIT, shoe=FLIP, arms=False)
    fy = -TD * 0.5
    # teal panels on the wetsuit and a zip
    for s in (-1, 1):
        box(s * (TW * 0.5 - 0.02), 0, HIP + TH * 0.62, 0.08, TD * 0.8, TH * 0.6, TEAL)
    box(0, fy - 0.02, HIP + TH * 0.68, TW * 0.9, 0.04, 0.12, TEAL)
    box(0, fy - 0.03, HIP + TH * 0.45, 0.05, 0.04, TH * 0.7, SILVER)
    # the weight belt
    box(0, 0, HIP + 0.12, TW + 0.08, TD + 0.08, 0.16, DARK, bevel=0.03)
    for x in (-0.3, 0.3):
        box(x, fy - 0.07, HIP + 0.12, 0.2, 0.08, 0.2, SILVER, bevel=0.03)
    box(0, fy - 0.07, HIP + 0.12, 0.16, 0.06, 0.13, (0.95, 0.75, 0.2))
    # huge flippers slapping out in front, like clown shoes
    for s in (-1, 1):
        fx = s * TW * 0.27
        box(fx, -0.5, FOOT * 0.08, 0.66, 1.3, 0.1, FLIP, bevel=0.04, rot=(math.radians(-3), 0, 0))
        box(fx + s * 0.04, -1.25, FOOT * 0.08, 0.84, 0.55, 0.08, FLIP_D, bevel=0.05, segs=2)
        for k in (-1, 0, 1):
            box(fx + k * 0.22, -0.9, FOOT * 0.15, 0.06, 0.6, 0.05, FLIP_D)
    # arms: left out with a teal cuff, right with the bucket
    lh = (-0.82, -0.2, 0.75)
    arm(-1, lh, SUIT, r=0.12)
    rh = (0.95, -0.25, 0.8)
    arm(1, rh, SUIT, r=0.12)
    for s, h in ((-1, lh), (1, rh)):
        can(h[0] - s * 0.05, h[1] + 0.03, h[2] + 0.2, 0.15, 0.09, TEAL, n=8)
    bucket(rh, full=True, size=0.6)
    # the air tank on the back, valve on top, straps over the shoulders
    ty = TD * 0.5 + 0.3
    can(0, ty, 0.95, 0.34, 1.05, TANK, n=10)
    ball(0, ty, 1.47, 0.68, 0.68, 0.24, TANK, seg=10, ring=5)
    can(0, ty, 1.58, 0.08, 0.16, SILVER, n=6)
    box(0, ty, 1.6, 0.3, 0.12, 0.1, SILVER, bevel=0.03)
    for z in (0.65, 1.25):
        can(0, ty, z, 0.36, 0.1, DARK, n=10)
    for s in (-1, 1):
        box(s * 0.28, 0, TOP - 0.05, 0.14, TD + 0.08, 0.08, DARK)
        box(s * 0.28, fy - 0.03, TOP - 0.3, 0.14, 0.06, 0.5, DARK)
    # the regulator hose from the valve over the shoulder
    limb((0.15, ty, 1.6), (0.55, 0.2, 1.55), 0.06, DARK)
    limb((0.55, 0.2, 1.55), (0.62, -0.38, 1.3), 0.06, DARK)
    ball(0.62, -0.42, 1.28, 0.2, 0.16, 0.2, DARK, seg=6, ring=4)
    # the head: hair, a smile and cheeks; the eyes go behind the mask glass
    w = HEAD
    box(0, 0, HEAD_Z, w, w * 0.92, w * 0.9, SKIN, bevel=w * 0.14, segs=2)
    box(0, w * 0.05, HEAD_Z + w * 0.3, w * 1.04, w * 0.98, w * 0.36, HAIR, bevel=w * 0.14, segs=2)
    face(0, HEAD_Z - w * 0.05, -w * 0.46, w)     # (eyes covered by the mask; cheeks and smile show)
    # the mask strap around the head and the mask itself
    mz = HEAD_Z + 0.1
    box(0, 0.02, mz, w * 1.03, w * 0.95, 0.26, DARK, bevel=0.1)
    my = -w * 0.46
    box(0, my - 0.1, mz, 2.05, 0.24, 1.05, MASK, bevel=0.22, segs=2)
    box(0, my - 0.2, mz, 1.7, 0.14, 0.8, GLASS, bevel=0.14, segs=2)
    box(0, my - 0.24, mz - 0.22, 0.3, 0.12, 0.28, MASK, bevel=0.08)                 # the nose pocket
    box(-0.6, my - 0.3, mz + 0.26, 0.2, 0.04, 0.08, WHITE)                          # a glint
    eyes(mz + 0.02, my - 0.27)
    # the snorkel up the side of the head, clipped to the strap
    sx = -w * 0.5 - 0.15
    limb((sx, -0.55, mz - 0.25), (sx, -0.55, HEAD_Z + 1.6), 0.13, SNORK, n=8)
    can(sx, -0.55, HEAD_Z + 1.65, 0.17, 0.2, MASK, n=8)
    limb((sx, -0.55, mz - 0.25), (sx + 0.2, -1.1, HEAD_Z - 0.55), 0.13, SNORK, n=8)
    ball(sx, -0.55, mz - 0.25, 0.27, 0.27, 0.27, SNORK, seg=8, ring=5)
    limb((sx + 0.2, -1.1, HEAD_Z - 0.55), (-0.35, -w * 0.46 - 0.12, HEAD_Z - 0.55), 0.13, SNORK, n=8)
    ball(sx + 0.2, -1.1, HEAD_Z - 0.55, 0.27, 0.27, 0.27, SNORK, seg=8, ring=5)
    box(sx + 0.02, -0.55, mz, 0.2, 0.3, 0.2, DARK, bevel=0.04)
    box(-0.3, -w * 0.46 - 0.22, HEAD_Z - 0.55, 0.22, 0.12, 0.3, DARK, bevel=0.05)        # the mouthpiece                          # the clip


if __name__ == "__main__" or True:
    run({"scuba-diver": build})
