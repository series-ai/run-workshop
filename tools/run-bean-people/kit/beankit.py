"""Bean kit: procedural mix-and-match bean people with gadget-screen faces.

Everything is generated in Blender from code. A character is
    body type   a lathed, superellipse-section body (pill, potato, pear, brick ...)
  + colours     separate slots: body_top, body_bottom (shirt / pants split),
                arms, hands, legs, feet, bezel, LED colour
  + face        a pixel-LED expression texture on a bezelled screen that is
                moulded onto the body's front

    Blender -b --factory-startup --python beankit.py -- <out dir> [what ...]

`what`: bodies, faces, mix, crowd, glb (default: all). Ground is z = 0; a
character faces -y. Materials keep their slot names so a game can recolour
them, and the screen's face texture is a white-on-black mask tinted by the LED
colour, so faces and colours swap independently.
"""
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

pi = math.pi
OUT = None

# --------------------------------------------------------------------------
# body types
# w: half-widths sampled evenly from bottom to top (smoothly interpolated)
# h: body height; d: depth / width; n: section squareness (2 = round)
# cb, ct: bottom / top rounding (metres); noise: potato lumps; bend: lean
# split: shirt / pants line as a fraction of h; screen: (z frac, half-width)
# arm: (z frac, length, radius, hand r); leg: (length, radius, spacing); foot
# --------------------------------------------------------------------------
BODIES = {
    "classic": dict(h=1.45, w=[0.52, 0.53, 0.51, 0.48], d=0.86, n=2.4, cb=0.26, ct=0.44, split=0.42,
                    screen=(0.7, 0.3), arm=(0.52, 0.34, 0.085, 0.12), leg=(0.24, 0.1, 0.2), foot=(0.15, 0.2, 0.1)),
    "slim": dict(h=1.85, w=[0.38, 0.39, 0.38, 0.36], d=0.88, n=2.2, cb=0.2, ct=0.34, split=0.45,
                 screen=(0.76, 0.24), arm=(0.56, 0.42, 0.07, 0.1), leg=(0.36, 0.085, 0.16), foot=(0.13, 0.19, 0.09)),
    "squat": dict(h=0.95, w=[0.62, 0.63, 0.6, 0.55], d=0.84, n=2.3, cb=0.22, ct=0.42, split=0.38,
                  screen=(0.64, 0.3), arm=(0.48, 0.26, 0.08, 0.11), leg=(0.12, 0.1, 0.24), foot=(0.15, 0.2, 0.09)),
    "potato": dict(h=1.3, w=[0.5, 0.6, 0.58, 0.5, 0.42], d=0.8, n=2.0, cb=0.34, ct=0.46, noise=0.075, bend=0.08,
                   seed=3, split=0.4, screen=(0.66, 0.27), arm=(0.5, 0.3, 0.08, 0.115), leg=(0.2, 0.095, 0.2),
                   foot=(0.15, 0.2, 0.095)),
    "pear": dict(h=1.5, w=[0.6, 0.66, 0.55, 0.42, 0.34], d=0.86, n=2.1, cb=0.3, ct=0.34, split=0.36,
                 screen=(0.74, 0.24), arm=(0.56, 0.3, 0.075, 0.11), leg=(0.2, 0.1, 0.24), foot=(0.15, 0.2, 0.1)),
    "brick": dict(h=1.45, w=[0.5, 0.5, 0.5, 0.5], d=0.7, n=4.5, cb=0.12, ct=0.18, split=0.44,
                  screen=(0.7, 0.33), arm=(0.56, 0.32, 0.085, 0.12), leg=(0.24, 0.1, 0.24), foot=(0.15, 0.21, 0.1)),
    "gumdrop": dict(h=1.35, w=[0.64, 0.6, 0.5, 0.38, 0.28], d=0.88, n=2.0, cb=0.16, ct=0.3, split=0.35,
                    screen=(0.6, 0.25), arm=(0.48, 0.28, 0.075, 0.11), leg=(0.12, 0.1, 0.26), foot=(0.15, 0.2, 0.09)),
    "bruiser": dict(h=1.55, w=[0.42, 0.5, 0.6, 0.64, 0.6], d=0.82, n=2.6, cb=0.22, ct=0.4, split=0.42,
                    screen=(0.72, 0.3), arm=(0.62, 0.42, 0.11, 0.16), leg=(0.26, 0.11, 0.18), foot=(0.16, 0.22, 0.1)),
    "mochi": dict(h=1.05, w=[0.6, 0.62, 0.6], d=0.92, n=2.0, cb=0.42, ct=0.5, split=0.4,
                  screen=(0.56, 0.3), arm=(0.42, 0.18, 0.07, 0.1), leg=(0.04, 0.08, 0.24), foot=(0.14, 0.18, 0.09)),
    "yam": dict(h=1.7, w=[0.36, 0.45, 0.46, 0.42, 0.3], d=0.84, n=2.0, cb=0.3, ct=0.3, noise=0.05, bend=0.22,
                seed=11, split=0.42, screen=(0.7, 0.24), arm=(0.52, 0.32, 0.07, 0.1), leg=(0.28, 0.085, 0.16),
                foot=(0.13, 0.19, 0.09)),
    "peanut": dict(h=1.6, w=[0.52, 0.54, 0.42, 0.47, 0.48, 0.44], d=0.86, n=2.0, cb=0.3, ct=0.42, split=0.42,
                   screen=(0.74, 0.27), arm=(0.62, 0.3, 0.075, 0.11), leg=(0.22, 0.095, 0.22), foot=(0.14, 0.2, 0.095)),
    "boxy-tall": dict(h=1.75, w=[0.44, 0.45, 0.45, 0.46], d=0.62, n=3.6, cb=0.16, ct=0.26, split=0.4,
                      screen=(0.78, 0.3), arm=(0.6, 0.4, 0.075, 0.105), leg=(0.34, 0.09, 0.2), foot=(0.14, 0.2, 0.09)),
}

# --------------------------------------------------------------------------
# colours
# --------------------------------------------------------------------------
INK = (0.13, 0.13, 0.16)
WHITE = (0.96, 0.95, 0.93)
CYAN = (0.35, 0.95, 1.0)


def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def scheme(top, bottom=None, arms=None, hands=None, legs=None, feet=None, bezel=INK, led=CYAN):
    """Fill in a colour scheme. Unset slots follow the body: bottom = top,
    arms = top, hands = arms, legs = bottom, feet = legs."""
    bottom = bottom or top
    arms = arms or top
    legs = legs or bottom
    return dict(body_top=top, body_bottom=bottom, arms=arms, hands=hands or arms, legs=legs, feet=feet or legs,
                bezel=bezel, led=led)


# --------------------------------------------------------------------------
# faces: 20 x 14 LED grids, drawn procedurally, saved as masks
# --------------------------------------------------------------------------
GW, GH = 20, 14
FACES = ["happy", "laugh", "surprised", "angry", "sad", "sleepy", "love", "dizzy", "wink", "cool"]


def face_grid(name):
    g = np.zeros((GH, GW), bool)

    def px(*pts):
        for x, y in pts:
            if 0 <= x < GW and 0 <= y < GH:
                g[y, x] = True

    def block(x0, y0, w, h):
        px(*[(x, y) for x in range(x0, x0 + w) for y in range(y0, y0 + h)])

    def mirror(*pts):
        px(*pts)
        px(*[(GW - 1 - x, y) for x, y in pts])

    smile = [(6, 5), (7, 4), (8, 3), (9, 3)]
    frown = [(6, 2), (7, 3), (8, 4), (9, 4)]
    if name == "happy":
        mirror((5, 7), (6, 7), (5, 8), (6, 8), (5, 9), (6, 9), *smile)
    elif name == "laugh":
        mirror((4, 8), (5, 9), (6, 9), (7, 8))
        for y, (a, b) in zip((5, 4, 3), ((6, 13), (7, 12), (8, 11))):
            px(*[(x, y) for x in range(a, b + 1)])
    elif name == "surprised":
        mirror((5, 7), (6, 7), (5, 8), (6, 8), (5, 9), (6, 9), (9, 5), (8, 4), (8, 3), (9, 2))
    elif name == "angry":
        mirror((5, 6), (6, 6), (5, 7), (6, 7), (3, 10), (4, 10), (5, 9), (6, 9), (7, 8), *frown)
    elif name == "sad":
        mirror((5, 7), (6, 7), (5, 8), (6, 8), (4, 10), (5, 10), (6, 11), *frown)
        px((5, 5), (5, 4))
    elif name == "sleepy":
        mirror((4, 7), (5, 7), (6, 7), (7, 7))
        px((9, 3), (10, 3), (15, 12), (16, 12), (17, 12), (16, 11), (15, 10), (16, 10), (17, 10))
    elif name == "love":
        heart = [(1, 3), (3, 3), (0, 2), (1, 2), (2, 2), (3, 2), (4, 2), (1, 1), (2, 1), (3, 1), (2, 0)]
        mirror(*[(3 + x, 7 + y) for x, y in heart], *smile)
    elif name == "dizzy":
        mirror((4, 9), (6, 9), (5, 8), (4, 7), (6, 7))
        px(*[(x, 3 + (x % 2)) for x in range(6, 14)])
    elif name == "wink":
        px((5, 7), (6, 7), (5, 8), (6, 8), (5, 9), (6, 9), (12, 8), (13, 9), (14, 9), (15, 8))
        mirror(*smile)
    elif name == "cool":
        block(3, 6, 6, 3)
        block(11, 6, 6, 3)
        px(*[(x, 8) for x in range(3, 17)])
        px((8, 3), (9, 3), (10, 3), (11, 3), (12, 4))
    return g


def _box_blur(a, r):
    for axis in (0, 1):
        c = np.cumsum(np.pad(a, [(r + 1, r) if i == axis else (0, 0) for i in range(2)], mode="constant"), axis=axis)
        a = (np.take(c, range(2 * r + 1, c.shape[axis]), axis=axis) - np.take(c, range(0, c.shape[axis] - 2 * r - 1),
                                                                              axis=axis)) / (2 * r + 1)
    return a


def face_image(name, cell=24):
    """A white-on-black LED mask (lit dots, faint unlit dots, glow)."""
    path = os.path.join(OUT, "faces", f"{name}.png")
    if name in bpy.data.images:
        return bpy.data.images[name]
    g = face_grid(name)
    W, H = GW * cell, GH * cell
    ys, xs = np.mgrid[0:H, 0:W]
    ix, iy = xs // cell, (H - 1 - ys) // cell
    lx, ly = (xs % cell) / cell - 0.5, (ys % cell) / cell - 0.5
    d = np.sqrt(lx * lx + ly * ly)
    dot = np.clip((0.42 - d) / 0.08, 0, 1)
    lit = g[iy, ix].astype(float)
    glow = _box_blur(_box_blur(lit * dot, cell // 2), cell // 3)
    v = np.clip(lit * dot + 0.07 * (1 - lit) * dot + 0.55 * glow, 0, 1)
    v = v[::-1]  # Blender images are bottom-up
    rgba = np.stack([v, v, v, np.ones_like(v)], axis=-1).astype(np.float32)
    img = bpy.data.images.new(name, W, H, alpha=False)
    img.pixels.foreach_set(rgba.ravel())
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    return img


# --------------------------------------------------------------------------
# materials
# --------------------------------------------------------------------------
def plastic(name, rgb, rough=0.36, coat=0.35):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (*rgb, 1)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*[lin(c) for c in rgb], 1)
    b.inputs["Roughness"].default_value = rough
    if "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = 0.12
    return m


def screen_mat(face, led, for_export=False):
    m = bpy.data.materials.new("screen")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.008, 0.01, 0.018, 1)
    b.inputs["Roughness"].default_value = 0.08
    if "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = 1.0
        b.inputs["Coat Roughness"].default_value = 0.03
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = face_image(face)
    tex.interpolation = "Linear"
    if for_export:
        nt.links.new(tex.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = 1.0
    else:
        mul = nt.nodes.new("ShaderNodeMix")
        mul.data_type, mul.blend_type = "RGBA", "MULTIPLY"
        mul.inputs["Factor"].default_value = 1.0
        nt.links.new(tex.outputs["Color"], mul.inputs[6])
        mul.inputs[7].default_value = (*[lin(c) for c in led], 1)
        nt.links.new(mul.outputs[2], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = 3.5
    return m


# --------------------------------------------------------------------------
# geometry
# --------------------------------------------------------------------------
def _interp(ws, t):
    n = len(ws) - 1
    x = min(max(t, 0.0), 1.0) * n
    i = min(int(x), n - 1)
    f = x - i
    p0, p1, p2, p3 = ws[max(i - 1, 0)], ws[i], ws[i + 1], ws[min(i + 2, n)]
    return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f ** 3)


def _sp(c, n):
    return math.copysign(abs(c) ** (2.0 / n), c)


class Body:
    def __init__(self, spec):
        self.s = s = dict(spec)
        self.z0 = s["leg"][0] + s["foot"][2] * 0.6
        rnd = random.Random(s.get("seed", 1))
        self.waves = [(rnd.randint(1, 3), rnd.uniform(0.6, 2.2), rnd.uniform(0, 2 * pi), rnd.uniform(0.4, 1.0))
                      for _ in range(5)]

    def radius(self, t):
        s = self.s
        h = s["h"]
        z = t * h
        r = _interp(s["w"], t)
        if z < s["cb"]:
            r *= math.sqrt(max(1 - ((s["cb"] - z) / s["cb"]) ** 2, 0))
        if z > h - s["ct"]:
            r *= math.sqrt(max(1 - ((z - (h - s["ct"])) / s["ct"]) ** 2, 0))
        return r

    def point(self, th, t):
        s = self.s
        r = self.radius(t)
        a = s.get("noise", 0.0)
        if a:
            r *= 1 + a * sum(w * math.sin(k * th + f * t * 2 * pi + ph) for k, f, ph, w in self.waves) / 2.2
        x = r * _sp(math.cos(th), s["n"])
        y = r * s["d"] * _sp(math.sin(th), s["n"])
        x += s.get("bend", 0.0) * (t - 0.5) ** 2 * 2
        return Vector((x, y, self.z0 + t * s["h"]))

    def build(self, segs=72, rings=80, groove=0.0, inset=0.0):
        """groove > 0 cuts a hard V seam that deep (metres) round the body at the colour split: a vinyl
        toy's part line, flat-shaded so it stays crisp at any resolution. inset > 0 makes the top half that
        much smaller all round than the bottom (a two-part toy: the top steps in at the seam)."""
        s = self.s
        ts = [0.5 - 0.5 * math.cos(pi * i / rings) for i in range(rings + 1)]
        split = s["split"]
        g = 0.007 / s["h"] if groove else 0.0
        ts = sorted(set(ts + [split] + ([split - g, split + g] if groove else [])))
        if groove:
            ts = [t for t in ts if not (0 < abs(t - split) < g * 2.5) or abs(abs(t - split) - g) < 1e-9]
        bm = bmesh.new()
        grid = []
        for t in ts:
            if t <= 0.0 or t >= 1.0:
                grid.append([bm.verts.new((s.get("bend", 0.0) * (t - 0.5) ** 2 * 2, 0, self.z0 + t * s["h"]))])
            else:
                ring = []
                for j in range(segs):
                    p = self.point(2 * pi * j / segs, t)
                    ax = Vector((s.get("bend", 0.0) * (t - 0.5) ** 2 * 2, 0, p.z))
                    r = (p - ax).length
                    pull = 0.0
                    if groove and abs(t - split) < 1e-9:          # the bottom of the V, pulled in toward the axis
                        pull = groove + 0.5 * inset
                    elif inset and t > split:                      # the top half steps in
                        pull = inset * min(1.0, r / 0.05)          # fades out at the very top (no pinch at the pole)
                    if pull:
                        p = ax + (p - ax) * max(0.0, 1 - pull / max(r, 1e-6))
                    ring.append(bm.verts.new(p))
                grid.append(ring)
        for i, (A, B) in enumerate(zip(grid, grid[1:])):
            mid = (ts[i] + ts[i + 1]) / 2
            mi = 0 if mid >= split else 1
            in_groove = groove and abs(mid - split) < g
            for j in range(segs):
                k = (j + 1) % segs
                if len(A) == 1:
                    f = bm.faces.new((A[0], B[k], B[j]))
                elif len(B) == 1:
                    f = bm.faces.new((A[j], A[k], B[0]))
                else:
                    f = bm.faces.new((A[j], A[k], B[k], B[j]))
                f.material_index = mi
                f.smooth = not in_groove
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        self.bvh = BVHTree.FromBMesh(bm)
        return bm

    def front(self, x, z):
        hit = self.bvh.ray_cast(Vector((x, -5, z)), Vector((0, 1, 0)))
        return hit[0], hit[1]

    def side(self, sgn, z):
        hit = self.bvh.ray_cast(Vector((sgn * 5, 0, z)), Vector((-sgn, 0, 0)))
        return hit[0], hit[1]


def _mesh(name, bm, mats, parent):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = parent
    return ob


def _squircle(a, b, phi, n=4.0):
    return _sp(math.cos(phi), n) * a, _sp(math.sin(phi), n) * b


def build_screen(body, mats, parent):
    s = body.s
    zf, a = s["screen"]
    b = a * 0.72
    cz = body.z0 + zf * s["h"]
    bez = 0.055
    NP = int(globals().get("SCREEN_NP", 72))

    def proj(x, z, off):
        loc, nor = body.front(x, z)
        if loc is None:
            return Vector((x, -0.2, z))
        return loc + nor * off

    phis = [2 * pi * i / NP for i in range(NP)]
    inner = [_squircle(a, b, p) for p in phis]
    outer = [_squircle(a + bez, b + bez, p) for p in phis]
    # bezel: inset wall, flat face, rolled outer edge
    rows = [(0.0, 0.028), (0.0, 0.05), (0.12, 0.06), (0.5, 0.064), (0.88, 0.06), (1.0, 0.05), (1.06, 0.015),
            (1.08, -0.03)]
    bm = bmesh.new()
    loops = []
    for mix, off in rows:
        loops.append([bm.verts.new(proj(ix + (ox - ix) * mix, cz + iz + (oz - iz) * mix, off))
                      for (ix, iz), (ox, oz) in zip(inner, outer)])
    for A, B in zip(loops, loops[1:]):
        for j in range(NP):
            k = (j + 1) % NP
            f = bm.faces.new((A[j], A[k], B[k], B[j]))
            f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    flat = [f for f in bm.faces if f.calc_center_median().y < -0.05 and abs(f.normal.y) > 0.7]
    if flat and sum(f.normal.y for f in flat) > 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    _mesh("bezel", bm, [mats["bezel"]], parent)
    # glass: concentric squircles, planar UVs from the front
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    K = int(globals().get("SCREEN_K", 10))
    loops = []
    for k in range(K, 0, -1):
        sc = k / K
        loops.append([(bm.verts.new(proj(x * sc, cz + z * sc, 0.028)), (x * sc, z * sc)) for x, z in inner])
    centre = (bm.verts.new(proj(0, cz, 0.028)), (0.0, 0.0))
    for A, B in zip(loops, loops[1:]):
        for j in range(NP):
            k = (j + 1) % NP
            f = bm.faces.new((A[j][0], A[k][0], B[k][0], B[j][0]))
            f.smooth = True
            for l, (_, (x, z)) in zip(f.loops, (A[j], A[k], B[k], B[j])):
                l[uv].uv = (x / (2 * a) + 0.5, z / (2 * b) + 0.5)
    B = loops[-1]
    for j in range(NP):
        k = (j + 1) % NP
        f = bm.faces.new((B[j][0], B[k][0], centre[0]))
        f.smooth = True
        for l, (_, (x, z)) in zip(f.loops, (B[j], B[k], centre)):
            l[uv].uv = (x / (2 * a) + 0.5, z / (2 * b) + 0.5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.y > 0:
            f.normal_flip()
    _mesh("screen", bm, [mats["screen"]], parent)


def _capsule(bm, a, b, r, r2=None, segs=20, rings=8):
    """Add a capsule (tube with round ends) from a to b into bm."""
    r2 = r if r2 is None else r2
    a, b = Vector(a), Vector(b)
    axis = (b - a).normalized()
    q = axis.to_track_quat("Z", "Y")
    L = (b - a).length
    prof = []
    for i in range(rings + 1):
        an = -pi / 2 + pi / 2 * i / rings
        prof.append((math.cos(an) * r, math.sin(an) * r))
    for i in range(rings + 1):
        an = pi / 2 * i / rings
        prof.append((math.cos(an) * r2, L + math.sin(an) * r2))
    grid = []
    for pr, pz in prof:
        if pr < 1e-5:
            grid.append([bm.verts.new(a + q @ Vector((0, 0, pz)))])
        else:
            grid.append([bm.verts.new(a + q @ Vector((pr * math.cos(2 * pi * j / segs), pr * math.sin(2 * pi * j / segs),
                                                      pz))) for j in range(segs)])
    faces = []
    for A, B in zip(grid, grid[1:]):
        for j in range(segs):
            k = (j + 1) % segs
            if len(A) == 1:
                faces.append(bm.faces.new((A[0], B[k], B[j])))
            elif len(B) == 1:
                faces.append(bm.faces.new((A[j], A[k], B[0])))
            elif A[0] is not B[0]:
                faces.append(bm.faces.new((A[j], A[k], B[k], B[j])))
    return faces


def _ellipsoid(bm, c, sc, segs=24, rings=14):
    res = bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    bmesh.ops.scale(bm, vec=sc, verts=res["verts"])
    bmesh.ops.translate(bm, vec=c, verts=res["verts"])
    return list({f for v in res["verts"] for f in v.link_faces})


def build_character(kind, colours, face="happy", pose="idle", loc=(0, 0, 0), rz=0.0, for_export=False):
    """Build one character; returns its root empty."""
    spec = BODIES[kind]
    body = Body(spec)
    root = bpy.data.objects.new(f"bean-{kind}", None)
    bpy.context.scene.collection.objects.link(root)
    mats = {k: plastic(k, colours[k]) for k in ("body_top", "body_bottom", "arms", "hands", "legs", "feet")}
    mats["bezel"] = plastic("bezel", colours["bezel"], rough=0.3, coat=0.6)
    mats["screen"] = screen_mat(face, colours["led"], for_export)
    _mesh("body", body.build(), [mats["body_top"], mats["body_bottom"]], root)
    build_screen(body, mats, root)
    s = body.s
    az, alen, ar, hr = s["arm"]
    arms, hands = bmesh.new(), bmesh.new()
    for sgn in (-1, 1):
        z = body.z0 + az * s["h"]
        p, _ = body.side(sgn, z)
        p = p - Vector((sgn * ar * 0.9, 0, 0))
        if pose == "wave" and sgn == 1:
            d = Vector((0.55, -0.1, 0.85)).normalized()
        elif pose == "hips":
            d = Vector((0.9, 0.0, -0.45)).normalized()
        else:
            d = Vector((sgn * 0.55, -0.12, -0.85)).normalized()
        if pose != "wave" or sgn != 1:
            d.x = sgn * abs(d.x)
        e = p + d * alen
        for f in _capsule(arms, p, e, ar):
            f.smooth = True
        for f in _ellipsoid(hands, e + d * hr * 0.35, (hr, hr * 0.9, hr)):
            f.smooth = True
    _mesh("arms", arms, [mats["arms"]], root)
    _mesh("hands", hands, [mats["hands"]], root)
    llen, lr, lx = s["leg"]
    fr, fl, fh = s["foot"]
    legs, feet = bmesh.new(), bmesh.new()
    for sgn in (-1, 1):
        x = sgn * lx
        top = Vector((x, 0.0, body.z0 + 0.12))
        bot = Vector((x, -0.01, fh * 0.7))
        if llen > 0.06:
            for f in _capsule(legs, top, bot, lr):
                f.smooth = True
        for f in _ellipsoid(feet, (x * 1.05, -fl * 0.35, fh * 0.5), (fr, fl, fh * 0.5)):
            f.smooth = True
    if len(legs.verts):
        _mesh("legs", legs, [mats["legs"]], root)
    else:
        legs.free()
    _mesh("feet", feet, [mats["feet"]], root)
    root.location = loc
    root.rotation_euler = (0, 0, rz)
    return root


# --------------------------------------------------------------------------
# stage + render
# --------------------------------------------------------------------------
def _cyc(colour, back=9.0, bend=9.0):
    prof = [(-60.0, 0.0), (back, 0.0)]
    prof += [(back + bend * math.sin(t), bend - bend * math.cos(t)) for t in [pi / 2 * i / 16 for i in range(1, 17)]]
    prof.append((back + bend, 60.0))
    bm = bmesh.new()
    cols = [[bm.verts.new((x, y, z)) for (y, z) in prof] for x in (-80.0, 80.0)]
    for i in range(len(prof) - 1):
        f = bm.faces.new((cols[0][i], cols[1][i], cols[1][i + 1], cols[0][i + 1]))
        f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    _mesh("cyc", bm, [plastic("cyc", colour, rough=0.9, coat=0.0)], None)


def stage(bg=(0.95, 0.94, 0.96)):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.view_settings.view_transform = "Standard"
    for attr, v in (("taa_render_samples", 64), ("use_raytracing", True), ("shadow_ray_count", 2)):
        try:
            setattr(sc.eevee, attr, v)
        except Exception:
            pass
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (*[lin(c) for c in bg], 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.85
    sc.world = w
    _cyc(bg)
    for name, energy, ang, rot, col in (("key", 3.2, 14, (48, -12, -32), (1, 0.98, 0.95)),
                                        ("rim", 1.5, 20, (-60, 0, 20), (0.9, 0.95, 1.0))):
        l = bpy.data.objects.new(name, bpy.data.lights.new(name, "SUN"))
        l.data.energy, l.data.angle, l.data.color = energy, math.radians(ang), col
        l.rotation_euler = [math.radians(a) for a in rot]
        sc.collection.objects.link(l)
    return sc


def camera(sc, loc, target, lens=50):
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.lens, cam.data.clip_end = lens, 300
    sc.collection.objects.link(cam)
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam


def render(sc, name, w, h):
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = int(os.environ.get("BEAN_PCT", "100"))
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print("WROTE", sc.render.filepath)


# --------------------------------------------------------------------------
# the concept sheets
# --------------------------------------------------------------------------
LINEUP = [
    ("classic", scheme((0.45, 0.85, 0.72), feet=WHITE), "happy", "idle"),
    ("slim", scheme((1.0, 0.82, 0.25), (0.2, 0.25, 0.45), feet=WHITE), "cool", "idle"),
    ("squat", scheme((0.72, 0.6, 0.95), feet=(0.45, 0.3, 0.75)), "laugh", "wave"),
    ("potato", scheme((0.82, 0.62, 0.42), led=(1.0, 0.72, 0.3)), "surprised", "idle"),
    ("pear", scheme((1.0, 0.58, 0.3), (0.22, 0.62, 0.66), feet=WHITE), "wink", "hips"),
    ("brick", scheme((0.5, 0.6, 0.75), arms=(0.95, 0.3, 0.3), legs=INK, feet=INK, bezel=WHITE), "angry", "idle"),
    ("gumdrop", scheme((1.0, 0.55, 0.72), feet=WHITE, led=(1.0, 0.6, 0.85)), "love", "wave"),
    ("bruiser", scheme((0.9, 0.25, 0.25), (0.3, 0.3, 0.36), hands=WHITE, feet=WHITE), "angry", "hips"),
    ("mochi", scheme(WHITE, feet=(1.0, 0.6, 0.7), bezel=(1.0, 0.6, 0.7), led=(1.0, 0.55, 0.75)), "sleepy", "idle"),
    ("yam", scheme((0.75, 0.38, 0.48), feet=(0.4, 0.2, 0.25)), "dizzy", "idle"),
    ("peanut", scheme((0.55, 0.78, 0.4), (0.78, 0.68, 0.5), feet=(0.4, 0.3, 0.2)), "happy", "wave"),
    ("boxy-tall", scheme((0.25, 0.3, 0.42), arms=(1.0, 0.75, 0.2), hands=(1.0, 0.75, 0.2), bezel=(1.0, 0.75, 0.2),
                         led=(1.0, 0.75, 0.25)), "sad", "idle"),
]


def card(i):
    kind, col, face, pose = LINEUP[i]
    sc = stage()
    build_character(kind, col, face, pose, rz=0.32)
    camera(sc, (1.05, -4.5, 1.35), (0, 0, 1.0), lens=50)
    render(sc, f"body-{i + 1:02d}-{kind}.png", 640, 820)


def faces():
    sc = stage()
    col = scheme((0.35, 0.62, 1.0), feet=WHITE)
    for i, f in enumerate(FACES):
        r, c = divmod(i, 5)
        build_character("classic", col, f, "idle", loc=((c - 2) * 1.55 + (0.78 if r else 0.0) - 0.39, r * 1.7, 0), rz=0.0)
    camera(sc, (0, -11.0, 4.6), (0, 0.85, 0.95), lens=50)
    render(sc, "faces.png", 1920, 1080)


MIX = [
    scheme((0.98, 0.45, 0.4)),
    scheme((0.98, 0.45, 0.4), (0.25, 0.3, 0.45)),
    scheme(WHITE, (0.98, 0.45, 0.4), arms=(0.98, 0.45, 0.4)),
    scheme((0.98, 0.45, 0.4), hands=WHITE, feet=WHITE),
    scheme((0.3, 0.75, 0.7), (0.98, 0.45, 0.4), legs=(0.3, 0.75, 0.7), feet=(0.98, 0.45, 0.4)),
    scheme((0.2, 0.2, 0.25), arms=(1.0, 0.8, 0.2), feet=(1.0, 0.8, 0.2), bezel=(1.0, 0.8, 0.2), led=(1.0, 0.8, 0.3)),
    scheme((1.0, 0.85, 0.3), (0.35, 0.5, 0.95), arms=(0.35, 0.5, 0.95), hands=WHITE, bezel=WHITE),
    scheme((0.7, 0.55, 0.95), feet=(0.25, 0.25, 0.3), led=(0.6, 1.0, 0.5)),
]


def mix():
    sc = stage()
    fs = ["happy", "cool", "wink", "laugh", "surprised", "angry", "love", "sleepy"]
    for i, col in enumerate(MIX):
        build_character("classic", col, fs[i], "idle", loc=((i - 3.5) * 1.35, 0, 0), rz=0.12)
    camera(sc, (1.6, -17.5, 2.2), (0, 0, 0.95), lens=55)
    render(sc, "mix.png", 1920, 800)


def crowd():
    sc = stage(bg=(0.98, 0.93, 0.86))
    rows = [[8, 1, 11, 9], [4, 0, 7, 3], [5, 2, 10, 6]]
    for r, idxs in enumerate(rows):
        for c, i in enumerate(idxs):
            kind, col, face, pose = LINEUP[i]
            x = (c - 1.5) * 1.75 + (0.85 if r == 1 else 0.0)
            build_character(kind, col, face, pose, loc=(x, (2 - r) * 1.5, 0), rz=0.3 - 0.08 * c)
    camera(sc, (3.4, -12.5, 4.0), (0.4, 1.4, 1.0), lens=50)
    render(sc, "crowd.png", 1920, 1080)


def glb():
    d = os.path.join(OUT, "glb")
    os.makedirs(d, exist_ok=True)
    for kind, col, face, pose in LINEUP:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        build_character(kind, col, face, "idle", for_export=True)
        bpy.ops.export_scene.gltf(filepath=os.path.join(d, f"{kind}.glb"), export_format="GLB")
        print("WROTE", kind)


def main():
    global OUT
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    OUT = os.path.abspath(argv[0] if argv else os.path.join(os.path.dirname(__file__), "out"))
    os.makedirs(OUT, exist_ok=True)
    for w in argv[1:] or ["bodies", "faces", "mix", "crowd", "glb"]:
        if w == "bodies":
            for i in range(len(LINEUP)):
                card(i)
        elif w.startswith("body"):
            card(int(w[4:]) - 1)
        elif w == "faces":
            faces()
        elif w == "mix":
            mix()
        elif w == "crowd":
            crowd()
        elif w == "glb":
            glb()


main()
