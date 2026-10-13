"""Sports player (soccer): the kid in a red kit with a big white number 10
on the front and a bigger one on the back, a white collar, white shorts, red
socks with white bands, white shin guards, black boots with studs and a stripe,
a sweatband, and a black-and-white soccer ball held out in the right mitten.
Empty bucket in the left."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

KIT, KIT_D, SHORTS, SOCK, GUARD, BOOT = (0.92, 0.16, 0.20), (0.7, 0.08, 0.12), (0.98, 0.98, 0.98), (0.92, 0.16, 0.20), (0.9, 0.96, 0.98), (0.12, 0.12, 0.14)
STUD, HAIR, BALL_W, BALL_B = (0.85, 0.85, 0.88), (0.85, 0.55, 0.2), (0.99, 0.99, 0.99), (0.1, 0.1, 0.12)

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

SEG = {"0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg"}


def digit(ch, cx, y, cz, h, rgb, depth=0.04):
    """A chunky 7-segment digit on a plane at y (readable from -y or +y; segments are symmetric enough)."""
    w, t = h * 0.55, h * 0.2
    segs = {"a": (0, h / 2 - t / 2, w, t), "d": (0, -h / 2 + t / 2, w, t), "g": (0, 0, w, t),
            "b": (w / 2 - t / 2, h / 4, t, h / 2), "c": (w / 2 - t / 2, -h / 4, t, h / 2),
            "f": (-w / 2 + t / 2, h / 4, t, h / 2), "e": (-w / 2 + t / 2, -h / 4, t, h / 2)}
    for k in SEG[ch]:
        dx, dz, sx, sz = segs[k]
        box(cx + dx, y, cz + dz, sx, depth, sz, rgb)


def number(txt, cx, y, cz, h, rgb, back=False):
    gap = h * 0.72
    xs = [cx + (i - (len(txt) - 1) / 2) * gap for i in range(len(txt))]
    if back:
        xs = xs[::-1]
    for ch, x in zip(txt, xs):
        digit(ch, x, y, cz, h, rgb)


def build():
    body(shirt=KIT, pants=SHORTS, leg_colour=SOCK, shoe=BOOT, arms=False)
    fy = -TD * 0.5
    # socks with white bands, shin guards on the front, studs and a stripe on the boots
    for s in (-1, 1):
        x = s * TW * 0.24
        can(x, 0, HIP - 0.06, 0.135, 0.08, WHITE, n=8)
        box(x, -0.13, FOOT * 0.4 + 0.15, 0.2, 0.06, 0.26, GUARD, bevel=0.03)
        box(x, -0.17, FOOT * 0.4 + 0.15, 0.12, 0.03, 0.16, KIT)
        box(x + s * FOOT * 0.38, -FOOT * 0.3, FOOT * 0.24, 0.03, FOOT * 0.6, 0.06, WHITE, rot=(math.radians(15), 0, 0))
        for yy in (-0.5, -0.25, 0.1):
            for xx in (-0.14, 0.14):
                can(x + xx, yy, 0.0, 0.05, 0.08, STUD, n=6)
    # shorts: a little stripe at the sides
    for s in (-1, 1):
        box(s * (TW * 0.5 + 0.005), 0, HIP + TH * 0.18, 0.02, 0.12, TH * 0.34, KIT)
    # the kit: white collar, a big number on the front and the back
    can(0, 0, TOP + 0.03, 0.4, 0.12, WHITE, n=8)
    number("10", 0, fy - 0.02, HIP + TH * 0.6, 0.5, WHITE)
    number("10", 0, TD * 0.5 + 0.02, HIP + TH * 0.6, 0.5, WHITE, back=True)
    # sleeves with white cuffs; left mitten with the bucket, right holds out the ball
    lh = (-0.82, -0.2, 0.75)
    arm(-1, lh, KIT, r=0.12)
    can(-0.78, -0.17, 0.98, 0.15, 0.08, WHITE, n=8)
    bucket(lh, full=False, size=0.6)
    rh = (0.95, -0.4, 0.95)
    arm(1, rh, KIT, r=0.12)
    can(0.9, -0.35, 1.18, 0.15, 0.08, WHITE, n=8, rot=(math.radians(-25), math.radians(20), 0))
    c = Vector((rh[0] + 0.15, rh[1] - 0.35, rh[2] - 0.15))
    R = 0.42
    ball(c.x, c.y, c.z, R * 2, R * 2, R * 2, BALL_W, seg=14, ring=10)
    phi = (1 + 5 ** 0.5) / 2
    dirs = [(0, 1, phi), (0, -1, phi), (0, 1, -phi), (0, -1, -phi), (1, phi, 0), (-1, phi, 0), (1, -phi, 0), (-1, -phi, 0),
            (phi, 0, 1), (-phi, 0, 1), (phi, 0, -1), (-phi, 0, -1)]
    for d in dirs:
        d = Vector(d).normalized()
        p = c + d * (R - 0.01)
        o = can(p.x, p.y, p.z, R * 0.33, 0.06, BALL_B, n=5)
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = d.to_track_quat("Z", "Y")
    hand_mitt(*rh, 1, MITT, SKIN)
    # the head and a sweatband
    w = HEAD
    kid_head(hair=HAIR)
    box(0, 0.0, HEAD_Z + 0.4, w * 1.04, w * 0.96, 0.42, WHITE, bevel=0.15, segs=2)
    box(0, -w * 0.48 - 0.01, HEAD_Z + 0.4, w * 0.7, 0.04, 0.1, KIT)
    # a spiky tuft of hair on top
    for x, y, h, t in ((-0.45, -0.3, 0.5, 18), (0.0, -0.45, 0.62, -6), (0.42, -0.3, 0.5, -24), (0.1, 0.3, 0.45, -12)):
        can(x, y, HEAD_Z + w * 0.48 + h * 0.4, 0.3, h, HAIR, n=4, r2=0.0, rot=(0, math.radians(t), math.radians(45)))

if __name__ == "__main__" or True:
    run({"sports-player": build})
