"""UFO: a kid wearing a flying saucer. A wide silver saucer ring round the
waist on two shoulder straps, with a teal band and coloured bulbs all round
the rim and a glowing underside; a clear glass dome over the kid's head on a
saucer-style collar with little lights, and a tiny antenna on top. A little
green alien plush rides on the rim, waving. Carries the empty bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket
import bmesh  # noqa: E402

# glass() and glint() from the spaceman (its source, minus its run line)
_src = open(_PKG + "/concepts/costumes/spaceman.py").read()
exec(compile(_src[: _src.rindex("\nif __name__")], "spaceman.py", "exec"))

METAL, METAL_D, TEAL, GLOW = (0.80, 0.83, 0.90), (0.58, 0.62, 0.72), (0.2, 0.8, 0.75), (0.6, 1.0, 0.55)
SHIRT, PLUSH, PLUSH_D = (0.45, 0.32, 0.85), (0.45, 0.85, 0.35), (0.3, 0.65, 0.22)
BULBS = [(1.0, 0.3, 0.35), (1.0, 0.85, 0.15), (0.3, 0.75, 1.0), (0.45, 0.95, 0.4)]
HAIR = (0.3, 0.17, 0.09)


def dome(z, r, h, segs=20):
    """A glass half-ellipsoid standing on z (radius r, height h)."""
    o = ball(0, 0, 0, 2 * r, 2 * r, 2 * h, WHITE, seg=segs, ring=14)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context="VERTS")
    bm.to_mesh(o.data)
    bm.free()
    o.location = (0, 0, z)
    glass(o)
    o.data.materials[0].use_backface_culling = True
    return o


def dome_glint(z, r, h):
    """A curved white streak lying on the dome's upper left front."""
    for k in range(11):
        az, el = math.radians(-140 + 1.6 * k), math.radians(14 + 4.6 * k)
        u = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
        p = Vector((u.x * r, u.y * r, z + u.z * h)) * 1.0
        n = Vector((u.x / r, u.y / r, u.z / h)).normalized()
        o = box(0, 0, 0, 0.13, 0.27, 0.03, WHITE)
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = n.to_track_quat("Z", "Y")
        o.location = p + n * 0.02


def plush(x, y, z):
    """A tiny alien plush sitting on the rim: a bean body, a big head, one eye, antennae, a waving arm."""
    box(x, y, z + 0.18, 0.32, 0.28, 0.36, PLUSH, bevel=0.1, segs=2)
    box(x, y, z + 0.6, 0.56, 0.48, 0.48, PLUSH, bevel=0.16, segs=2)
    ball(x, y - 0.24, z + 0.62, 0.26, 0.06, 0.26, WHITE, seg=10, ring=6)
    ball(x, y - 0.27, z + 0.61, 0.13, 0.04, 0.13, DARK, seg=8, ring=6)
    box(x, y - 0.25, z + 0.46, 0.12, 0.03, 0.03, DARK)
    for s in (-1, 1):
        limb((x + s * 0.12, y, z + 0.8), (x + s * 0.24, y, z + 1.06), 0.025, PLUSH_D)
        ball(x + s * 0.24, y, z + 1.08, 0.1, 0.1, 0.1, GLOW, seg=6, ring=4)
        box(x + s * 0.09, y - 0.1, z + 0.02, 0.13, 0.2, 0.08, PLUSH_D, bevel=0.03)  # feet dangling
    limb((x + 0.16, y, z + 0.28), (x + 0.32, y - 0.05, z + 0.48), 0.05, PLUSH)   # waving arm
    limb((x - 0.16, y, z + 0.28), (x - 0.26, y - 0.05, z + 0.1), 0.05, PLUSH)


def build():
    body(shirt=SHIRT, pants=METAL_D, shoe=METAL_D, arms=False)
    # the saucer ring round the waist: an upper and a lower dish, a teal band, bulbs
    sz, R = HIP + 0.3, 1.95
    can(0, 0, sz + 0.24, R, 0.26, METAL, n=24, r2=R * 0.68)
    can(0, 0, sz + 0.47, R * 0.68, 0.2, SHIRT, n=24, r2=R * 0.45)
    can(0, 0, sz - 0.13, R * 0.5, 0.26, METAL_D, n=24, r2=R)
    can(0, 0, sz - 0.3, R * 0.4, 0.1, GLOW, n=24)
    can(0, 0, sz + 0.03, R + 0.04, 0.22, TEAL, n=24)
    for k in range(12):
        a = 2 * math.pi * (k + 0.5) / 12
        ball((R + 0.06) * math.cos(a), (R + 0.06) * math.sin(a), sz + 0.03, 0.24, 0.24, 0.24, BULBS[k % 4], seg=8, ring=6)
    for k in range(6):  # glowing ports underneath
        a = 2 * math.pi * k / 6
        ball(R * 0.72 * math.cos(a), R * 0.72 * math.sin(a), sz - 0.16, 0.2, 0.2, 0.1, GLOW, seg=8, ring=4)
    # shoulder straps holding it up
    for s in (-1, 1):
        box(s * 0.28, -TD * 0.5 - 0.02, (sz + TOP) / 2 + 0.05, 0.14, 0.05, TOP - sz + 0.1, METAL_D)
        box(s * 0.28, TD * 0.5 + 0.02, (sz + TOP) / 2 + 0.05, 0.14, 0.05, TOP - sz + 0.1, METAL_D)
        box(s * 0.28, 0, TOP + 0.02, 0.14, TD + 0.09, 0.05, METAL_D)
    # arms out under the dome: the right rests on the saucer, the left reaches out past the rim with the empty bucket
    sx = TW * 0.5 + 0.08
    rh = (sx + 0.85, -0.35, TOP - 0.02)
    limb((sx, 0, TOP - 0.15), (rh[0] - 0.15, rh[1] + 0.05, rh[2]), 0.11, SHIRT)
    hand_mitt(*rh, 1, MITT, SKIN)
    lh = (-2.2, -0.35, TOP - 0.02)
    limb((-sx, 0, TOP - 0.15), (lh[0] + 0.15, lh[1] + 0.05, lh[2] + 0.05), 0.11, SHIRT)
    hand_mitt(*lh, -1, MITT, SKIN)
    bucket(lh, full=False, size=0.55)
    # the alien plush riding on the rim, front right
    a = math.radians(-50)
    plush(R * 0.8 * math.cos(a), R * 0.8 * math.sin(a), sz + 0.18)
    # the kid's head under a glass dome on a saucer collar with lights
    cz = HEAD_Z - 0.05
    head_cube(0, cz, 1.95, SKIN, HAIR)
    base = cz - 1.1
    dr, dh = 1.8, 3.0
    bpy.ops.mesh.primitive_torus_add(major_radius=dr, minor_radius=0.09, major_segments=28, minor_segments=6, location=(0, 0, base))
    finish(bpy.context.object, TEAL)
    can(0, 0, base - 0.12, 0.75, 0.2, METAL_D, n=16)  # the neck ring
    dome(base, dr, dh)
    dome_glint(base, dr, dh)
    # a little antenna through the top
    limb((0, 0, base + dh - 0.05), (0, 0, base + dh + 0.35), 0.04, METAL_D)
    ball(0, 0, base + dh + 0.42, 0.2, 0.2, 0.2, (1.0, 0.3, 0.35), seg=8, ring=6)


if __name__ == "__main__" or True:
    run({"ufo": build})
