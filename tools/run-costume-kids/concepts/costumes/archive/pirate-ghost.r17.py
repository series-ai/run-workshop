"""Pirate ghost captain: a pale mint ghost kid (lighter glow rim, an eye
patch) under a huge black tricorn with a gold trim and a skull, in a tattered
navy captain's coat with gold buttons and epaulettes. A wispy curling tail
instead of legs (no shoes, floats). A cutlass in the right mitten, the full
bucket in the left."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

GHOST, GLOW, GHOST_D = (0.60, 0.92, 0.84), (0.84, 1.0, 0.96), (0.42, 0.78, 0.72)
NAVY, NAVY_D, GOLD = (0.13, 0.17, 0.42), (0.08, 0.10, 0.28), (1.0, 0.78, 0.18)
HAT, BONE, STEEL = (0.10, 0.09, 0.12), (0.97, 0.95, 0.88), (0.85, 0.88, 0.92)


def bar(p0, p1, r0, r1, rgb, n=6):
    """A tapered bar from p0 to p1."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def strip(rows, rgb, t):
    """A curved band from a list of (bottom, top) point pairs, given thickness t."""
    verts, faces = [], []
    for i, (lo, hi) in enumerate(rows):
        verts += [tuple(lo), tuple(hi)]
        if i:
            faces.append((2 * i - 2, 2 * i, 2 * i + 1, 2 * i - 1))
    me = bpy.data.meshes.new("strip")
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new("strip", me)
    bpy.context.scene.collection.objects.link(o)
    sol = o.modifiers.new("s", "SOLIDIFY")
    sol.thickness = t
    sol.offset = 0
    return finish(o, rgb)


def tricorn(zb, r, cy=0.15, hat=HAT, trim=GOLD, k=1.0):
    """A classic pirate tricorn seated on the head: a rounded crown over the
    head top and a brim cocked up on three sides into curled flaps that bow
    outward and rise to three points (one over the face). Gold trim runs along
    the upturned edges. k scales the flaps (height, bow, trim). Returns the
    front point."""
    ch = 1.15 * k                                                                        # crown height
    box(0, 0.08, zb - 0.125 + ch / 2, HEAD * 1.06, HEAD * 0.98, ch, hat, bevel=0.42, segs=3)    # the rounded crown
    V = [Vector((r * math.sin(a), cy - r * math.cos(a), zb)) for a in (0, 2 * math.pi / 3, 4 * math.pi / 3)]
    c = Vector((0, cy, zb))
    up = Vector((0, 0, 1))
    N = 12
    base = []
    for i in range(3):
        A, B = V[i], V[(i + 1) % 3]
        mid = (A + B) / 2
        out = (mid - c)
        out.z = 0
        out.normalize()
        rows, tops = [], []
        for j in range(N + 1):
            t = j / N
            bow = math.sin(math.pi * t)
            lo = A.lerp(B, t) + out * (0.35 * k * bow)
            h = k * (0.6 + 0.75 * (2 * t - 1) ** 2)              # low in the middle, curling up to the points
            corner = (A if t < 0.5 else B) - c
            corner.z = 0
            corner.normalize()
            hi = lo + out * (0.5 * k * bow) + corner * (0.35 * k * (1 - bow)) + up * h
            rows.append((lo, hi))
            tops.append(hi)
            if j < N:
                base.append(lo)
        strip(rows, hat, 0.26 * k)
        for j in range(N):                                  # gold trim along the upturned edge
            limb(tuple(tops[j]), tuple(tops[j + 1]), 0.11 * k, trim)
        for j in (0, N):
            ball(*tops[j], 0.3 * k, 0.3 * k, 0.3 * k, trim, seg=8, ring=5)
    # the brim floor joining the flaps
    me = bpy.data.meshes.new("brim")
    me.from_pydata([tuple(p) for p in base], [], [list(range(len(base)))])
    me.update()
    o = bpy.data.objects.new("brim", me)
    bpy.context.scene.collection.objects.link(o)
    sol = o.modifiers.new("s", "SOLIDIFY")
    sol.thickness = 0.22
    finish(o, hat)
    return V[0]


def tilt(objs, at, deg):
    """Turn objs about the y axis through `at` (positive leans their tops towards +x)."""
    from mathutils import Matrix
    M = Matrix.Translation(at) @ Matrix.Rotation(math.radians(deg), 4, "Y") @ Matrix.Translation([-v for v in at])
    for o in objs:
        o.matrix_world = M @ o.matrix_world


def build():
    # the torso and arms only: a ghost has no legs or shoes
    cz = HIP + TH * 0.62
    with part("chest"):
        box(0, 0, cz, TW + 0.06, TD + 0.04, TH * 0.78, NAVY, bevel=0.08)
    with part("body"):
        # the coat skirt flaring down, tattered at the hem
        can(0, 0, HIP - 0.05, TW * 0.6, 0.5, NAVY, n=8, r2=TW * 0.55)
        for k in range(8):
            a = 2 * math.pi * (k + 0.5) / 8
            can(TW * 0.58 * math.cos(a), TW * 0.58 * math.sin(a), HIP - 0.38, 0.13, 0.22, NAVY, n=4, r2=0.0, rot=(math.radians(180), 0, a))
        # the wispy tail: tapering, curling out to the side, all of it hanging from the coat
        pts = [(0, 0, HIP - 0.2, 0.52), (0.08, 0.12, 0.3, 0.42), (0.35, 0.3, 0.12, 0.3), (0.75, 0.4, 0.14, 0.2), (1.05, 0.4, 0.4, 0.12), (1.0, 0.35, 0.68, 0.06), (0.85, 0.3, 0.72, 0.01)]
        for i, ((x0, y0, z0, r0), (x1, y1, z1, r1)) in enumerate(zip(pts, pts[1:])):
            bar((x0, y0, z0), (x1, y1, z1), r0, r1, GHOST if i < 3 else GLOW, n=8)
    # coat front: a gold placket, two rows of buttons, a belt with a buckle
    fy = -TD * 0.5 - 0.04
    with part("chest"):
        for s in (-1, 1):
            for z in (cz - 0.18, cz + 0.05, cz + 0.26):
                ball(s * 0.2, fy, z, 0.11, 0.08, 0.11, GOLD, seg=6, ring=4)
    with part("body"):
        box(0, fy + 0.01, HIP + 0.12, TW + 0.1, 0.06, 0.13, (0.35, 0.2, 0.1))
        box(0, fy - 0.02, HIP + 0.12, 0.2, 0.04, 0.17, GOLD)
    # epaulettes with a fringe
    sx = TW * 0.5 + 0.08
    with part("chest"):
        for s in (-1, 1):
            box(s * (sx - 0.05), 0, TOP + 0.02, 0.42, 0.42, 0.1, GOLD, bevel=0.03)
            for k in (-1, 0, 1):
                can(s * (sx + 0.13), k * 0.13, TOP - 0.1, 0.04, 0.16, GOLD, n=4)
    # the kid's left arm (+x): the cutlass
    with part("arm.l"):
        limb((sx, 0, TOP - 0.15), (sx + 0.16, -0.05, TOP - ARM_DROP), 0.12, NAVY)
        can(sx + 0.17, -0.06, TOP - 0.5, 0.15, 0.12, GOLD, n=6)  # gold cuff
    rx, ry, rz = sx + 0.18, -0.08, TOP - 0.66
    with part("hand.l"):
        hand_mitt(rx, ry, rz, 1, MITT, GHOST)
    before = set(bpy.data.objects)
    with part("prop.l"):  # the whole cutlass: guard and blade
        ball(rx, ry - 0.25, rz + 0.05, 0.42, 0.12, 0.36, GOLD, seg=8, ring=4)  # the hand guard
        blade = [(rx, ry - 0.32, rz + 0.1), (rx + 0.06, ry - 0.55, rz + 0.55), (rx + 0.12, ry - 0.62, rz + 1.0), (rx + 0.22, ry - 0.5, rz + 1.35)]
        for i, (a, b) in enumerate(zip(blade, blade[1:])):
            bar(a, b, 0.13 - i * 0.03, 0.1 - i * 0.035, STEEL, n=4)
    tilt(set(bpy.data.objects) - before, (rx, ry, rz), 40)  # the blade leans out, clear of the head
    # the other arm hangs with the full bucket
    hx, hy, hz = -sx - 0.18, -0.08, TOP - 0.66
    with part("arm.r"):
        limb((-sx, 0, TOP - 0.15), (-sx - 0.16, -0.05, TOP - ARM_DROP), 0.12, NAVY)
    with part("hand.r"):
        hand_mitt(hx, hy, hz, -1, MITT, GHOST)
    bucket((hx, hy, hz), full=True, size=0.6)
    # the head: a glow rim behind a mint head, a big friendly face and an eye patch
    with part("head"):
        box(0, 0.12, HEAD_Z - 0.12, HEAD * 1.07, HEAD * 0.92, HEAD * 0.8, GLOW, bevel=HEAD * 0.16, segs=2)
        box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, GHOST, bevel=HEAD * 0.14, segs=2)
        fy = -HEAD * 0.46
        face(0, HEAD_Z - 0.18, fy, HEAD, cheeks=False)
        for s in (-1, 1):
            box(s * HEAD * 0.33, fy - 0.01, HEAD_Z - 0.38, HEAD * 0.12, 0.04, HEAD * 0.06, (0.55, 0.85, 0.95))
        # the patch over the right eye (kid's left)
        ex, ez = HEAD * 0.22, HEAD_Z - 0.18 + HEAD * 0.05
        can(ex, fy - 0.07, ez, 0.3, 0.06, HAT, n=8, rot=(math.radians(90), 0, 0))
        box(0.05, fy - 0.05, ez + 0.3, HEAD * 0.9, 0.04, 0.1, HAT, rot=(0, math.radians(-24), 0))
        # the hat
        hz = HEAD_Z + HEAD * 0.3  # the brim floor rests across the top of the head
        HR, HK = 2.55, 0.85  # tricorn radius and flap scale (15% smaller than r5)
        tricorn(hz, HR, k=HK)
        # the skull and crossbones on the front point, over the face
        sk = (0, 0.15 - HR - 0.3 * HK, hz + 0.75 * HK)
        ball(sk[0], sk[1] - 0.05, sk[2], 0.42, 0.3, 0.36, BONE, seg=8, ring=6)
        box(sk[0], sk[1] - 0.05, sk[2] - 0.18, 0.24, 0.24, 0.12, BONE)
        for s in (-1, 1):
            ball(sk[0] + s * 0.09, sk[1] - 0.2, sk[2] + 0.02, 0.11, 0.06, 0.12, HAT, seg=6, ring=4)
            box(sk[0], sk[1] - 0.02, sk[2] - 0.12, 0.62, 0.08, 0.08, BONE, rot=(0, s * math.radians(30), 0))

if __name__ == "__main__" or True:
    render_costume("pirate-ghost", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
