"""Ice cream cone: the kid's own head wears a gigantic double scoop as a hat:
a fat mint-choc-chip scoop with a lumpy scooped lip, drips running down
over the brim onto the brow and sides, and a smaller strawberry scoop
stacked on top, crowned with rainbow sprinkles and a big glossy cherry.
The body is the waffle cone: a golden cone suit tapering down to the legs,
criss-crossed with darker waffle ridges and a rolled rim at the shoulders;
waffle sleeves, mitts out, the right one holding the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import random
import sys
import bpy
from mathutils import Vector
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

MINT, MINT_D, CHIP = (0.62, 0.95, 0.78), (0.48, 0.86, 0.68), (0.36, 0.2, 0.12)
BERRY, BERRY_D = (1.0, 0.62, 0.72), (0.94, 0.48, 0.6)
CONE, CONE_D, CONE_L = (0.93, 0.68, 0.34), (0.74, 0.47, 0.2), (0.98, 0.8, 0.48)
CHERRY, STEM = (0.9, 0.08, 0.15), (0.35, 0.55, 0.15)
SPRINKLES = [(1.0, 0.95, 0.3), (0.3, 0.7, 1.0), (1.0, 1.0, 1.0), (0.7, 0.4, 0.95), (1.0, 0.45, 0.2), (0.45, 0.85, 0.35)]
HEAD_TOP = HEAD_Z + HEAD * 0.45


def on_top(rnd, cx, cz, w, d, h, n, colours, size=(0.22, 0.07, 0.07), zmin=0.2, zmax=0.85):
    """Bits scattered over the upper part of an ellipsoid, mostly on the front."""
    for i in range(n):
        a = rnd.uniform(-math.pi * 0.95, -math.pi * 0.05) if i % 3 else rnd.uniform(0, 2 * math.pi)
        e = rnd.uniform(zmin, zmax)
        ce = math.sqrt(1 - e * e)
        x, y, z = cx + w / 2 * ce * math.cos(a), d / 2 * ce * math.sin(a), cz + h / 2 * e
        box(x, y, z, *size, colours[i % len(colours)], rot=(rnd.uniform(0, 3.1), rnd.uniform(0, 3.1), rnd.uniform(0, 3.1)))


def tube(pts, r, m=6, caps=True):
    """The vertex rings and faces of a round bar swept through `pts`, capped."""
    verts, faces = [], []
    up = Vector((0, 0, 1))
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        u = t.cross(up).normalized()
        v = u.cross(t).normalized()
        for j in range(m):
            a = 2 * math.pi * j / m
            verts.append(p + (u * math.cos(a) + v * math.sin(a)) * r)
    for i in range(len(pts) - 1):
        for j in range(m):
            faces.append((i * m + j, i * m + (j + 1) % m, (i + 1) * m + (j + 1) % m, (i + 1) * m + j))
    if caps:
        faces.append(tuple(range(m - 1, -1, -1)))
        faces.append(tuple((len(pts) - 1) * m + j for j in range(m)))
    return verts, faces


def waffle_cone(z0, z1, r0, r1, n=16, ribs=12):
    """A cone from (z0, r0) up to (z1, r1), criss-crossed with waffle ridges.
    Each ridge is a straight line on the unrolled cone, swept along the
    cone's own flat facets, so it hugs the surface all the way round (no
    chords cutting in or floating off at the sides), and the twist is exactly one rib step, so the ridges meet
    point-to-point at the top and bottom and cross halfway: one even lattice."""
    cone = can(0, 0, (z0 + z1) / 2, r0, z1 - z0, CONE, n=n, r2=r1)
    v0 = cone.data.vertices[0].co
    phase = math.atan2(v0.y, v0.x)          # where the cone's first corner sits
    step = 2 * math.pi / n
    twist = 2 * math.pi / ribs

    def on_cone(ang, z, lift=0.025):
        rr = r0 + (r1 - r0) * (z - z0) / (z1 - z0)
        d = ((ang - phase) % step) - step / 2       # angle from the facet's middle
        mid = ang - d
        rs = rr * math.cos(step / 2) / math.cos(d)  # on the flat facet
        return Vector((rs * math.cos(ang) + lift * math.cos(mid), rs * math.sin(ang) + lift * math.sin(mid), z))

    # the cone unrolled: slant distance from the apex and the unrolled angle
    sin_b = (r1 - r0) / math.hypot(r1 - r0, z1 - z0)

    def flat(ang, z):
        rr = r0 + (r1 - r0) * (z - z0) / (z1 - z0)
        rho, psi = rr / sin_b, ang * sin_b
        return Vector((rho * math.cos(psi), rho * math.sin(psi), 0))

    def unflat(q):
        rho, psi = q.length, math.atan2(q.y, q.x)
        rr = rho * sin_b
        return psi / sin_b, z0 + (rr - r0) / (r1 - r0) * (z1 - z0)

    verts, faces = [], []
    za, zb = z0 + 0.05, z1 + 0.02      # bottom edge up under the rolled rim

    def facet(t, pa, pb):
        return math.floor((unflat(pa.lerp(pb, t))[0] - phase) / step)

    for k in range(ribs):
        a = twist * k
        for sgn in (-1, 1):
            # a straight line on the cone unrolled flat (so it reads as a straight
            # diagonal ridge), wrapped back onto the facets: straight on each facet,
            # so it only needs a ring where it crosses from one facet to the next
            pa, pb = flat(a, za), flat(a + sgn * twist, zb)
            ts, n_s = [0.0], 24
            for i in range(n_s):
                t0, t1 = i / n_s, (i + 1) / n_s
                if facet(t0, pa, pb) != facet(t1, pa, pb):
                    for _ in range(20):  # bisect to the facet edge
                        tm = (t0 + t1) / 2
                        if facet(tm, pa, pb) == facet(t0, pa, pb):
                            t0 = tm
                        else:
                            t1 = tm
                    ts.append((t0 + t1) / 2)
            ts.append(1.0)
            pts = [on_cone(*unflat(pa.lerp(pb, t))) for t in ts]
            tv, tf = tube(pts, 0.06, m=3, caps=False)  # a three-sided ridge, its ends tucked under the rims
            o = len(verts)
            verts += tv
            faces += [tuple(i + o for i in f) for f in tf]
    me = bpy.data.meshes.new("waffle")
    me.from_pydata(verts, [], faces)
    ob = bpy.data.objects.new("waffle", me)
    bpy.context.scene.collection.objects.link(ob)
    finish(ob, CONE_D)


def build():
    rnd = random.Random(3)
    body(shirt=CONE, pants=CONE, leg_colour=(0.97, 0.97, 0.97), shoe=(0.45, 0.8, 0.95), torso=False, arms=False)
    with part("body"):
        # the waffle cone suit, tapering down towards the legs, with a rolled rim
        z0, z1, r0, r1 = 0.45, 1.85, 0.55, 1.3
        waffle_cone(z0, z1, r0, r1)
        can(0, 0, z1 + 0.02, r1 + 0.14, 0.3, CONE_L, n=12)
        can(0, 0, z1 + 0.14, r1 + 0.04, 0.06, CONE_D, n=12)
    # waffle sleeves; the right mitt holds the bucket
    with part("hand.r"):
        lh = (-1.75, -0.3, 1.2)
        limb((-1.0, -0.05, 1.6), lh, 0.13, CONE)
        hand_mitt(*lh, -1, MITT, SKIN)
    with part("hand.l"):
        rh = (1.8, -0.35, 1.25)
        limb((1.0, -0.05, 1.6), rh, 0.13, CONE)
        hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.68)
    with part("head"):
        # the head: bare skin, no hair (the ice cream sits on it)
        box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)
        face(0, HEAD_Z - HEAD * 0.05, -HEAD * 0.46, HEAD)
        # scoop one: a fat mint-choc-chip scoop sitting on the head
        sz = HEAD_TOP + 0.95
        ball(0, 0.05, sz, 4.3, 3.9, 2.7, MINT, seg=12, ring=7)
        # the lumpy scooped lip round its bottom
        for k in range(12):
            a = 2 * math.pi * k / 12 + 0.1
            ball(2.05 * math.cos(a), 0.05 + 1.85 * math.sin(a), sz - 0.85 + 0.08 * (k % 2), 1.05, 1.05, 0.78, MINT if k % 2 else MINT_D, seg=6, ring=4)
        # drips running down over the brow and the sides of the head
        for x, h in ((-1.5, 0.8), (-0.6, 0.35), (0.25, 0.55), (1.15, 0.75)):
            y = -1.25
            limb((x, y, sz - 0.9), (x, y, sz - 0.9 - h), 0.17, MINT, n=5)
            ball(x, y, sz - 0.92 - h, 0.4, 0.4, 0.42, MINT, seg=6, ring=4)
        for s in (-1, 1):
            x = s * 1.33
            limb((x, -0.2, sz - 0.9), (x, -0.2, sz - 1.75), 0.17, MINT, n=5)
            ball(x, -0.2, sz - 1.77, 0.4, 0.4, 0.42, MINT, seg=6, ring=4)
        on_top(rnd, 0, sz, 4.3, 3.9, 2.7, 12, [CHIP], size=(0.24, 0.2, 0.18), zmin=-0.3, zmax=0.5)  # below the top scoop, where they show
        # scoop two: a smaller strawberry scoop stacked on top, nudged a little
        s2 = sz + 1.85
        ball(0.12, 0.05, s2, 3.1, 2.8, 2.1, BERRY, seg=10, ring=7)
        for k in range(9):
            a = 2 * math.pi * k / 9
            ball(0.12 + 1.45 * math.cos(a), 0.05 + 1.3 * math.sin(a), s2 - 0.6, 0.85, 0.85, 0.62, BERRY if k % 2 else BERRY_D, seg=6, ring=4)
        for x, h in ((-0.8, 0.5), (0.5, 0.65)):
            y = -1.15
            limb((x, y, s2 - 0.6), (x, y, s2 - 0.6 - h), 0.14, BERRY, n=5)
            ball(x, y, s2 - 0.62 - h, 0.34, 0.34, 0.36, BERRY, seg=6, ring=4)
        on_top(rnd, 0.12, s2, 3.1, 2.8, 2.1, 16, SPRINKLES, zmin=0.0)
        # the cherry
        ball(0.12, 0.0, s2 + 1.35, 0.95, 0.95, 0.9, CHERRY, seg=10, ring=6)
        ball(-0.08, -0.4, s2 + 1.55, 0.18, 0.08, 0.16, WHITE, seg=6, ring=4)
        limb((0.12, 0, s2 + 1.75), (0.4, 0.08, s2 + 2.2), 0.05, STEM)


if __name__ == "__main__" or True:
    render_costume("ice-cream-cone", build, sys.argv[sys.argv.index("--") + 1], ortho=10.5, target_z=4.3)
