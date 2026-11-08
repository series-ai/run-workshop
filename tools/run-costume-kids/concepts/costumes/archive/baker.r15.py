"""Baker: the kid in a towering, huge puffy white chef's toque (a band over
the hair, a tall pleated column and a giant cloud of a puff), a white chef's
jacket with a red neckerchief, a sky-blue apron dusted with flour (and a
flour smudge on one cheek), checked trousers and black clogs. A rolling pin
in the left mitten, a tall three-tier pink cake held up high in the right."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403

CHEF, CHEF_D, APRON, FLOUR = (0.99, 0.99, 0.97), (0.86, 0.87, 0.9), (0.40, 0.70, 0.98), (0.97, 0.96, 0.92)
CHECK, RED, WOOD, WOOD_D = (0.22, 0.22, 0.26), (0.92, 0.18, 0.2), (0.86, 0.62, 0.36), (0.62, 0.40, 0.2)
CAKE, CAKE_D, CREAM, CHERRY, HAIR = (1.0, 0.62, 0.74), (0.95, 0.45, 0.6), (1.0, 0.97, 0.92), (0.9, 0.08, 0.15), (0.40, 0.22, 0.10)

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


def build():
    body(shirt=CHEF, pants=CHECK, leg_colour=CHECK, shoe=DARK, arms=False)
    fy = -TD * 0.5
    # checks on the trousers
    with part("body"):
        for x in (-0.3, 0.0, 0.3):
            box(x, fy - 0.02, HIP + TH * 0.18, 0.12, 0.04, TH * 0.34, WHITE)
    # the apron: a bib and a skirt on the front, ties at the sides, flour dust
    with part("chest"):
        box(0, fy - 0.04, HIP + TH * 0.62, TW * 0.7, 0.06, TH * 0.7, APRON, bevel=0.02)
        for x, z, w in ((-0.2, HIP + 0.6, 0.22), (0.18, HIP + 0.38, 0.16), (0.05, HIP + 0.78, 0.12)):
            ball(x, fy - 0.1, z, w, 0.06, w * 0.7, FLOUR, seg=6, ring=4)
        # the red neckerchief
        can(0, 0, TOP + 0.04, 0.42, 0.16, RED, n=8)
        can(0, fy - 0.12, TOP - 0.12, 0.2, 0.06, RED, n=3, rot=(math.radians(90), 0, math.radians(180)))
    with part("body"):
        box(0, fy - 0.08, HIP + 0.02, TW * 0.92, 0.06, 0.6, APRON, bevel=0.02)
        box(0, fy - 0.12, HIP + 0.05, 0.42, 0.04, 0.24, (0.30, 0.58, 0.9), bevel=0.02)  # the pocket
        for x, z, w in ((0.27, HIP - 0.12, 0.2), (-0.28, HIP - 0.08, 0.13)):
            ball(x, fy - 0.1, z, w, 0.06, w * 0.7, FLOUR, seg=6, ring=4)
    # left mitten: a rolling pin, held diagonally
    lh = (-0.74, -0.3, 0.72)
    with part("arm.r"):
        arm(-1, lh, CHEF, mitt=False)
    with part("hand.r"):
        hand_mitt(*lh, -1, MITT, SKIN)
    with part("prop.r"):
        d = Vector((-0.45, -0.8, 0.3)).normalized()  # pointing out and forward, clear of the head
        c = Vector(lh)
        bar(c - d * 0.55, c + d * 0.55, 0.15, 0.15, WOOD, n=8)
        for k in (-1, 1):
            bar(c + d * k * 0.55, c + d * k * 0.8, 0.06, 0.06, WOOD_D, n=6)
            b = c + d * k * 0.84
            ball(b.x, b.y, b.z, 0.14, 0.14, 0.14, WOOD_D, seg=6, ring=4)
        ball(c.x - 0.02, c.y - 0.16, c.z + 0.2, 0.14, 0.05, 0.1, FLOUR, seg=6, ring=4)
    # right mitten: carrying a two-tier cake on a plate by its rim, out at the side (clear of the head)
    rh = hand_points()[1]
    with part("arm.l"):
        arm(1, rh, CHEF, mitt=False)
    with part("hand.l"):
        hand_mitt(*rh, 1, MITT, SKIN)
    with part("prop.l"):
        _cake(rh)
    # the head, with a flour smudge on one cheek
    kid_head(hair=HAIR)
    with part("head"):
        ball(-0.62, -HEAD * 0.46 - 0.02, HEAD_Z - 0.5, 0.34, 0.05, 0.2, FLOUR, seg=8, ring=4)
        _hat()


def _cake(rh):
    cx, cy = rh[0] + 0.7, rh[1]
    pz = rh[2] - 0.26
    can(cx, cy, pz, 0.68, 0.06, CHEF_D, n=12)
    z = pz + 0.03
    for r, h in ((0.4, 0.26), (0.27, 0.22)):
        can(cx, cy, z + h / 2, r, h, CAKE, n=12)
        can(cx, cy, z + h * 0.42, r + 0.02, 0.1, CAKE_D, n=12)             # a jam stripe
        can(cx, cy, z + h + 0.03, r + 0.03, 0.08, CREAM, n=12)             # the frosting lip
        for i in range(6):                                                   # cream drips
            a = i * math.pi / 3 + 0.3
            box(cx + (r + 0.02) * math.cos(a), cy + (r + 0.02) * math.sin(a), z + h - 0.05, 0.1, 0.1, 0.16, CREAM, bevel=0.03)
        z += h + 0.06
    ball(cx, cy, z + 0.12, 0.26, 0.26, 0.26, CHERRY, seg=8, ring=6)
    limb((cx, cy, z + 0.2), (cx + 0.08, cy, z + 0.42), 0.02, (0.3, 0.55, 0.2))
    for s in (-1, 1):
        can(cx + s * 0.13, cy, z + 0.1, 0.035, 0.24, (0.4, 0.75, 1.0) if s < 0 else (1.0, 0.85, 0.2), n=6)
        can(cx + s * 0.13, cy, z + 0.28, 0.04, 0.1, (1.0, 0.6, 0.1), n=4, r2=0.0)


def _hat():
    # the enormous puffy chef's hat: a band hugging the hair, a tall pleated
    # column flaring out, and a giant cloud of a puff on top
    bz = HEAD_Z + HEAD * 0.41                        # band centre, over the hair
    box(0, 0.05, bz, HEAD * 1.1, HEAD * 1.02, 0.7, CHEF, bevel=0.22, segs=2)
    box(0, 0.05, bz - 0.3, HEAD * 1.11, HEAD * 1.03, 0.1, CHEF_D, bevel=0.04)
    box(0, -HEAD * 0.46 - 0.02, bz - 0.42, HEAD * 0.78, 0.1, 0.26, HAIR, bevel=0.08)        # the fringe under the band
    for k in (-1, 1):
        box(k * HEAD * 0.5, -0.2, bz - 0.5, 0.2, 1.4, 0.5, HAIR, bevel=0.07)                   # tufts over the ears
    z0, z1 = bz + 0.3, 5.45
    octa(0, 0.05, (z0 + z1) / 2, 1.45, z1 - z0, CHEF, r2=1.75)
    for i in range(8):                                # pleats down the column
        a = i * math.pi / 4 + math.pi / 8
        o = bar((1.47 * math.cos(a), 0.05 + 1.47 * math.sin(a), z0), (1.7 * math.cos(a), 0.05 + 1.7 * math.sin(a), z1 - 0.05), 0.07, 0.07, CHEF_D, n=4)
    pz = 5.9
    ball(0, 0.05, pz, 3.9, 3.5, 1.7, CHEF, seg=14, ring=8)
    for i in range(8):
        a = i * math.pi / 4 + math.pi / 8
        ball(1.4 * math.cos(a), 0.05 + 1.2 * math.sin(a), pz + 0.05, 1.75, 1.7, 1.45, CHEF, seg=10, ring=7)
    for i in range(3):
        a = i * 2 * math.pi / 3 + 0.4
        ball(0.6 * math.cos(a), 0.05 + 0.55 * math.sin(a), pz + 0.45, 1.6, 1.6, 1.25, CHEF, seg=10, ring=7)


if __name__ == "__main__" or True:
    render_costume("baker", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
