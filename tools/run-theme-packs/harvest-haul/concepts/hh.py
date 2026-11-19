"""Harvest Haul shared bits: palette, soil mound, leaves, the Gourd body system
and surface decals (stripes, warts, carved faces). Built on shared/kit.py."""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "shared"))
import bmesh  # noqa: E402
from kit import *  # noqa: E402,F401,F403
import kit  # noqa: E402
from mathutils import Vector  # noqa: E402

# ---------------------------------------------------------------- palette
ORANGE = C(252, 128, 30)
ORANGE_D = C(214, 100, 36)
MUSTARD = C(230, 180, 58)
RED = C(186, 60, 48)          # barn red
TOMATO = C(226, 66, 50)
SAGE = C(150, 178, 118)
CREAM = C(246, 236, 212)
BROWN = C(150, 104, 70)
SOIL = C(140, 96, 66)
SOIL_D = C(104, 70, 50)
SOIL_WET = C(92, 62, 48)
WOOD = C(200, 150, 98)
WOOD_D = C(158, 110, 72)
WOOD_L = C(222, 186, 136)
STRAW = C(238, 206, 120)
STRAW_D = C(212, 172, 86)
LEAF = C(112, 168, 74)
LEAF_L = C(156, 204, 96)
LEAF_D = C(80, 132, 62)
STEM = C(120, 140, 70)
DRY = C(184, 140, 84)
DRY_D = C(146, 106, 66)
DARK = C(70, 42, 32)
GOLD = C(232, 182, 70)
PLUM = C(108, 54, 110)
MAGENTA = C(170, 46, 88)
BLUE = C(84, 124, 184)
TWINE = C(196, 150, 96)

D2R = math.pi / 180


def P(*a):
    return Vector(a[0]) if len(a) == 1 else Vector(a)


# ---------------------------------------------------------------- soil mound (shared crop footprint)
MOUND = [(0.47, 0), (0.47, 0.035), (0.44, 0.085), (0.35, 0.135), (0.19, 0.158), (0, 0.162)]
MOUND_TOP = 0.16


def mz(r):
    """Height of the mound surface at radius r."""
    pts = MOUND[::-1]
    for (r0, z0), (r1, z1) in zip(pts, pts[1:]):
        if r0 <= r <= r1:
            f = (r - r0) / max(1e-6, r1 - r0)
            return z0 + (z1 - z0) * f
    return 0.0


def mound(col=SOIL):
    lathe(MOUND, (0, 0, 0), col, n=12)


def on_mound(x, y, dz=0.0):
    return (x, y, mz(math.hypot(x, y)) + dz)


# ---------------------------------------------------------------- leaves
LEAF_W = 1.3   # chubby leaves
STEM_K, STEM_MIN = 1.45, 0.028  # chubby stems
LANCE = [(0, 0.12), (0.4, 0.5), (0.75, 0.4), (1, 0)]
ROUND = [(0, 0.15), (0.25, 0.46), (0.6, 0.5), (0.88, 0.3), (1, 0)]
STRAP = [(0, 0.35), (0.5, 0.5), (0.85, 0.4), (1, 0)]
HEART = [(0, 0.3), (0.2, 0.5), (0.55, 0.42), (0.85, 0.2), (1, 0)]


def leaf(base, yaw, length, width, elev, col, droop=0.0, shape=LANCE, t=0.014, n=6, curl=0.0):
    """A faceted leaf from base, heading yaw (deg around z) and elev (deg up),
    drooping by droop * length at the tip. curl lifts the edges (cupped leaves)."""
    base = P(base)
    y, e = yaw * D2R, elev * D2R
    d = P(math.cos(e) * math.cos(y), math.cos(e) * math.sin(y), math.sin(e))
    side = P(-math.sin(y), math.cos(y), 0)
    width *= LEAF_W
    t = max(t, 0.02)
    rings = []
    for f, wf in shape:
        p = base + d * length * f - P(0, 0, droop * length * f * f)
        rings.append((p, width * wf, t if wf > 0 else 0))
    return loft(rings, col, n=n, side=side)


def stalk(pts, r0, r1, col, n=6, rings=8):
    """A tapering stem along control points. Chubby: never thinner than STEM_MIN."""
    r0, r1 = max(r0 * STEM_K, STEM_MIN), max(r1 * STEM_K, STEM_MIN * 0.85)
    return tube(pts, lambda t: r0 + (r1 - r0) * t, col, rings=rings, n=n)


def oriented(loc, direction, s=1.0):
    """at() whose local +z points along direction."""
    e = P(direction).normalized().to_track_quat("Z", "Y").to_euler("XYZ")
    return at(loc, math.degrees(e.x), math.degrees(e.y), math.degrees(e.z), s=s)


# ---------------------------------------------------------------- Gourd: lathe body with a surface map

class Gourd:
    """A lathe body (profile [(r, z)]) with lobes, plus surface lookups so stripes,
    warts, speckles and carved faces sit on the actual faceted skin."""

    def __init__(self, prof, lobes=8, depth=0.1, n=None, sx=1.0, sy=1.0, twist=0.0):
        self.prof, self.lobes, self.depth = prof, lobes, depth
        self.n = n or (max(10, lobes * 2) if lobes else 10)
        self.sx, self.sy, self.twist = sx, sy, twist
        i0 = min(range(min(3, len(prof))), key=lambda i: prof[i][1])
        self.outer = [prof[i0]]
        for p in prof[i0 + 1:]:
            if p[1] >= self.outer[-1][1]:
                self.outer.append(p)
            else:
                break
        self.top = max(z for _, z in prof)

    def build(self, col, col2=None, split=0.5, **m):
        """Lathe it. col2 + split (fraction of height) paints the top part another colour."""
        kw = dict(n=self.n, lobes=self.lobes, lobe_depth=self.depth, sx=self.sx, sy=self.sy, **m)
        if col2 is None:
            return lathe(self.prof, (0, 0, 0), col, **kw)
        zs = self.top * split
        lo, hi, crossed = [], [], False
        for i, (r, z) in enumerate(self.prof):
            if not crossed and z <= zs:
                lo.append((r, z))
                continue
            if not crossed:
                r0, z0 = self.prof[i - 1]
                rr = r0 + (r - r0) * (zs - z0) / max(1e-6, z - z0)
                lo.append((rr, zs))
                hi.append((rr, zs))
                crossed = True
            hi.append((r, z))
        lathe(lo + [(0, zs)], (0, 0, 0), col, **kw)
        return lathe(hi, (0, 0, 0), col2, **kw)

    def r_at(self, z):
        o = self.outer
        if z <= o[0][1]:
            return o[0][0]
        for (r0, z0), (r1, z1) in zip(o, o[1:]):
            if z0 <= z <= z1:
                return r0 + (r1 - r0) * (z - z0) / max(1e-6, z1 - z0)
        return o[-1][0]

    def lobe(self, th):
        if not self.lobes:
            return 1.0
        # match the faceted lathe: linear between ring vertices
        n = self.n
        step = 2 * math.pi / n
        tw = 0.0
        a = (th - tw) % (2 * math.pi)
        j = int(a // step)
        f = (a - j * step) / step

        def lf(t):
            return 1.0 - self.depth * (0.5 - 0.5 * math.cos(self.lobes * t + math.pi))
        return lf(j * step) * (1 - f) + lf((j + 1) * step) * f

    def surf(self, th, z):
        """Point and outward normal on the skin at angle th (rad) and height z."""
        r = self.r_at(z) * self.lobe(th)
        p = P(r * math.cos(th) * self.sx, r * math.sin(th) * self.sy, z)
        dz = 0.01
        slope = (self.r_at(z + dz) - self.r_at(z - dz)) / (2 * dz)
        nrm = P(math.cos(th) / self.sx, math.sin(th) / self.sy, -slope).normalized()
        return p, nrm

    def stripes(self, col, k=None, w=0.035, z0=0.08, z1=0.92, phase=0.0):
        """Stripes down the grooves between lobes."""
        k = k or self.lobes
        for i in range(k):
            th = 2 * math.pi * i / k + phase
            pts = []
            for j in range(9):
                z = self.top * (z0 + (z1 - z0) * j / 8)
                p, nrm = self.surf(th, z)
                pts.append(p + nrm * w * 0.15)
            tube(pts, lambda t: (w * (0.45 + 0.55 * math.sin(math.pi * t)), w * 0.35), col, rings=9, n=6,
                 side=(-math.sin(th), math.cos(th), 0))

    def bumps(self, col, count, size, seed=1, z0=0.15, z1=0.85, ratio=0.65, seg=6):
        r = rng(seed)
        for _ in range(count):
            th = r.uniform(0, 2 * math.pi)
            z = self.top * r.uniform(z0, z1)
            p, nrm = self.surf(th, z)
            s = size * r.uniform(0.6, 1.25)
            with oriented(p, nrm):
                ell((0, 0, 0), (s, s, s * ratio * 1.4), col, seg=seg, ring=4)

    def speckles(self, col, count, size, seed=2, z0=0.1, z1=0.9):
        self.bumps(col, count, size, seed, z0, z1, ratio=0.18, seg=6)


def resample(poly, step):
    out = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        a, b = P(a[0], a[1], 0), P(b[0], b[1], 0)
        k = max(1, int((b - a).length / step))
        for i in range(k):
            q = a + (b - a) * (i / k)
            out.append((q.x, q.y))
    return out


def decal(polys, surf, rgb, proud=0.012, depth=0.08, step=0.03, cuts=2, **m):
    """2D shapes [(u, v), ...] wrapped onto a surface: surf(u, v) -> (point, normal).
    The slab stands `proud` above the skin and sinks `depth` into it: carved faces."""
    bm = bmesh.new()
    for poly in polys:
        pts = resample(poly, step)
        bm.faces.new([bm.verts.new((u, v, 0)) for u, v in pts])
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    if cuts:
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
    res = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:] + bm.edges[:] + bm.verts[:], use_keep_orig=True)
    for v in res["geom"]:
        if isinstance(v, bmesh.types.BMVert):
            v.co.z = -1.0
    for v in bm.verts:
        p, nrm = surf(v.co.x, v.co.y)
        v.co = p + nrm * (proud if v.co.z > -0.5 else -depth)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return kit._bm_obj(bm, "decal", rgb, **m)


def gourd_surf(g, th_c, zc):
    """A (u, v) -> surface map centred on angle th_c (deg) and height zc."""
    thc = th_c * D2R

    def f(u, v):
        z = zc + v
        r = max(0.05, g.r_at(z))
        return g.surf(thc + u / r, z)
    return f


FRONT = -65.0  # deg: the skin angle that faces the 3/4 camera


def zoom_fit(fn, size=0.85, base=0.0):
    """Build fn(), then scale and move everything so its largest side is `size` and it stands on
    z = base, centred: used to show a small produce item at a readable size in a crop row."""
    import bpy
    from mathutils import Matrix
    before = set(bpy.data.objects)
    fn()
    objs = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    bpy.context.view_layer.update()
    lo, hi = P(1e9, 1e9, 1e9), P(-1e9, -1e9, -1e9)
    for o in objs:
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            lo = P(min(lo.x, p.x), min(lo.y, p.y), min(lo.z, p.z))
            hi = P(max(hi.x, p.x), max(hi.y, p.y), max(hi.z, p.z))
    k = size / max(1e-6, max(hi - lo))
    ctr = (lo + hi) * 0.5
    M = Matrix.Translation(P(0, 0, base)) @ Matrix.Scale(k, 4) @ Matrix.Translation(P(-ctr.x, -ctr.y, -lo.z))
    for o in objs:
        o.matrix_world = M @ o.matrix_world


def measure(fn):
    """Build fn(), return its bounding box size, and delete what it built."""
    import bpy
    before = set(bpy.data.objects)
    fn()
    objs = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
    lo = P(min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))
    hi = P(max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    return hi - lo
