"""Shared procedural toolkit for the theme-pack concept boards (Glowdrop Critters,
Harvest Haul, Bolt-On Racers, Caravan Kingdoms). Everything is plain geometry,
flat shaded and low-poly, so the concepts look like what the real kits will be.

Blender units, z up, ground z = 0, things face -y. A pack script describes its
boards as data and hands them to run():

    BOARDS = [
        ("01-mushrooms", "Mushrooms: growth stages", {"dark": True}, [
            ("Lantern cap", [("pin", lambda: mushroom(0)), ("button", lambda: mushroom(1))]),
        ]),
    ]
    kit.run(BOARDS)

    Blender -b --factory-startup -t 1 --python pack.py -- <out dir> [board-prefix ...]
    python3 shared/board.py <out dir>

Cells in one row share a scale and a ground line, so growth stages read true.
Pass {"shared": False} as the board options to frame each cell on its own.
"""
import json
import math
import os
import sys
from contextlib import contextmanager

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

# ---------------------------------------------------------------- colour + materials

_mats = {}


def C(r, g, b):
    return (r / 255, g / 255, b / 255)


def mat(rgb, rough=0.8, emit=0.0, metal=0.0):
    """Principled material. emit > 0 makes it glow in its own colour (Glow pack)."""
    key = (tuple(round(c, 3) for c in rgb), rough, emit, metal)
    if key not in _mats or _mats[key].name not in bpy.data.materials:
        m = bpy.data.materials.new(f"m{len(_mats)}")
        m.diffuse_color = (*rgb, 1.0)
        m.use_nodes = True
        b = m.node_tree.nodes.get("Principled BSDF")
        lin = tuple(c ** 2.2 for c in rgb)
        b.inputs["Base Color"].default_value = (*lin, 1.0)
        b.inputs["Roughness"].default_value = rough
        b.inputs["Metallic"].default_value = metal
        if emit:
            b.inputs["Emission Color"].default_value = (*lin, 1.0)
            b.inputs["Emission Strength"].default_value = emit
        _mats[key] = m
    return _mats[key]


# ---------------------------------------------------------------- transform stack
# Everything built inside `with at(...)` is placed by that transform, so parts
# compose: with at((0, 0, 1), rz=30): cap(...)

_xf = [Matrix.Identity(4)]


def V(*a):
    return Vector(a[0]) if len(a) == 1 else Vector(a)


def _m(loc=(0, 0, 0), rx=0.0, ry=0.0, rz=0.0, s=1.0):
    S = Matrix.Diagonal((*(s if isinstance(s, (tuple, list)) else (s, s, s)), 1.0))
    R = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), "XYZ").to_matrix().to_4x4()
    return Matrix.Translation(V(loc)) @ R @ S


@contextmanager
def at(loc=(0, 0, 0), rx=0.0, ry=0.0, rz=0.0, s=1.0):
    _xf.append(_xf[-1] @ _m(loc, rx, ry, rz, s))
    try:
        yield
    finally:
        _xf.pop()


def _obj(name, me, rgb, rough=0.8, emit=0.0, metal=0.0, smooth=False):
    me.transform(_xf[-1])
    if _xf[-1].determinant() < 0:
        me.flip_normals()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    me.materials.append(mat(rgb, rough, emit, metal))
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def _bm_obj(bm, name, rgb, **m):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return _obj(name, me, rgb, **m)


_local = _m


# ---------------------------------------------------------------- primitives
# All take loc plus optional rx/ry/rz (degrees) and the material kwargs
# rough / emit / metal.


def box(size, loc, rgb, bevel=0.0, rx=0, ry=0, rz=0, **m):
    """A box centred on loc. bevel > 0 chamfers the edges (one segment, chunky)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=V(size), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=min(bevel, min(size) * 0.45), segments=1, affect="EDGES")
    bmesh.ops.transform(bm, matrix=_local(loc, rx, ry, rz, 1.0), verts=bm.verts)
    return _bm_obj(bm, "box", rgb, **m)


def cyl(r, h, loc, rgb, n=8, r2=None, rx=0, ry=0, rz=0, cap=True, **m):
    """An n-sided prism standing on loc (its base), radius r tapering to r2 at the top."""
    r2 = r if r2 is None else r2
    return lathe([(r, 0), (r2, h)], loc, rgb, n=n, rx=rx, ry=ry, rz=rz, cap=cap, **m)


def cone(r, h, loc, rgb, n=8, rx=0, ry=0, rz=0, **m):
    return lathe([(r, 0), (0, h)], loc, rgb, n=n, rx=rx, ry=ry, rz=rz, **m)


def ell(c, r, rgb, seg=8, ring=6, rx=0, ry=0, rz=0, **m):
    """An ellipsoid at c with radii r (a number or (rx, ry, rz))."""
    r = (r, r, r) if isinstance(r, (int, float)) else r
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=1.0)
    bmesh.ops.transform(bm, matrix=_local(c, rx, ry, rz, tuple(r)), verts=bm.verts)
    return _bm_obj(bm, "ell", rgb, **m)


def lathe(profile, loc, rgb, n=10, rx=0, ry=0, rz=0, lobes=0, lobe_depth=0.0, cap=True, sx=1.0, sy=1.0, twist=0.0, **m):
    """Revolve a profile [(radius, z), ...] around z. Radius 0 points become poles.
    lobes > 0 ribs the surface (pumpkins, gourds, melon domes): the radius dips by
    lobe_depth between ribs. sx/sy squash it into an oval. twist (deg) spins each
    ring a little more than the last."""
    verts, rings = [], []
    for k, (rad, z) in enumerate(profile):
        if rad < 1e-5:
            rings.append([len(verts)])
            verts.append((0.0, 0.0, z))
            continue
        ring = []
        tw = math.radians(twist) * k / max(1, len(profile) - 1)
        for j in range(n):
            th = 2 * math.pi * j / n + tw
            rr = rad
            if lobes:
                rr *= 1.0 - lobe_depth * (0.5 - 0.5 * math.cos(lobes * th + math.pi))
            ring.append(len(verts))
            verts.append((rr * math.cos(th) * sx, rr * math.sin(th) * sy, z))
        rings.append(ring)
    faces = []
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            faces += [(a[0], b[j], b[(j + 1) % n]) for j in range(n)]
        elif len(b) == 1:
            faces += [(a[j], a[(j + 1) % n], b[0]) for j in range(n)]
        else:
            faces += [(a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]) for j in range(n)]
    if cap and len(rings[0]) > 1:
        faces.append(tuple(rings[0][::-1]))
    if cap and len(rings[-1]) > 1:
        faces.append(tuple(rings[-1]))
    me = bpy.data.meshes.new("lathe")
    me.from_pydata(verts, [], faces)
    me.transform(_local(loc, rx, ry, rz, 1.0))
    return _obj("lathe", me, rgb, **m)


def torus(R, r, loc, rgb, n=12, k=6, rx=0, ry=0, rz=0, arc=360.0, **m):
    """A ring of radius R, tube radius r, lying flat. arc < 360 makes a partial ring."""
    verts, faces = [], []
    full = arc >= 359.9
    steps = n if full else n + 1
    for i in range(steps):
        a = math.radians(arc) * i / n
        for j in range(k):
            b = 2 * math.pi * j / k
            d = R + r * math.cos(b)
            verts.append((d * math.cos(a), d * math.sin(a), r * math.sin(b)))
    for i in range(n):
        i2 = (i + 1) % steps if full else i + 1
        for j in range(k):
            j2 = (j + 1) % k
            faces.append((i * k + j, i2 * k + j, i2 * k + j2, i * k + j2))
    if not full:
        faces.append(tuple(range(k))[::-1])
        faces.append(tuple(n * k + j for j in range(k)))
    me = bpy.data.meshes.new("torus")
    me.from_pydata(verts, [], faces)
    me.transform(_local(loc, rx, ry, rz, 1.0))
    return _obj("torus", me, rgb, **m)


def frame(t, side=(1, 0, 0)):
    t = V(t).normalized()
    s = V(side)
    u = s - t * s.dot(t)
    if u.length < 1e-4:
        s = V(0, 0, 1) if abs(t.z) < 0.9 else V(0, 1, 0)
        u = s - t * s.dot(t)
    u.normalize()
    return u, t.cross(u)


def loft(rings, rgb, n=8, side=(1, 0, 0), **m):
    """A tube through rings [(centre, a, b)]; a = b = 0 makes a point. Capped."""
    pts = [V(r[0]) for r in rings]
    verts, idx = [], []
    for i, (p, a, b) in enumerate(rings):
        p = V(p)
        if i == 0:
            t = pts[1] - pts[0]
        elif i == len(pts) - 1:
            t = pts[-1] - pts[-2]
        else:
            t = (pts[i + 1] - pts[i]).normalized() + (pts[i] - pts[i - 1]).normalized()
        u, v = frame(t, side)
        if a < 1e-5 and b < 1e-5:
            idx.append([len(verts)])
            verts.append(tuple(p))
            continue
        ring = []
        for j in range(n):
            th = math.pi / n + 2 * math.pi * j / n
            ring.append(len(verts))
            verts.append(tuple(p + u * a * math.cos(th) + v * b * math.sin(th)))
        idx.append(ring)
    faces = []
    for r0, r1 in zip(idx, idx[1:]):
        if len(r0) == 1 and len(r1) == 1:
            continue
        if len(r0) == 1:
            faces += [(r0[0], r1[j], r1[(j + 1) % n]) for j in range(n)]
        elif len(r1) == 1:
            faces += [(r0[j], r1[0], r0[(j + 1) % n]) for j in range(n)]
        else:
            faces += [(r0[j], r0[(j + 1) % n], r1[(j + 1) % n], r1[j]) for j in range(n)]
    if len(idx[0]) > 1:
        faces.append(tuple(idx[0][::-1]))
    if len(idx[-1]) > 1:
        faces.append(tuple(idx[-1]))
    me = bpy.data.meshes.new("loft")
    me.from_pydata(verts, [], faces)
    return _obj("loft", me, rgb, **m)


def spline(ctrl, n):
    """n points along a Catmull-Rom curve through the control points."""
    P = [V(p) for p in ctrl]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out, segs = [], len(P) - 3
    for i in range(n):
        t = i / (n - 1) * segs
        k = min(int(t), segs - 1)
        f = t - k
        p0, p1, p2, p3 = P[k:k + 4]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * f ** 3))
    return out


def tube(ctrl, prof, rgb, rings=10, n=6, side=(1, 0, 0), **m):
    """A tube along a spline through ctrl; prof(t) -> radius or (a, b), t in 0..1."""
    pts = spline(ctrl, rings)
    rr = []
    for i, p in enumerate(pts):
        w = prof(i / (rings - 1))
        a, b = (w, w) if isinstance(w, (int, float)) else w
        rr.append((p, a, b))
    return loft(rr, rgb, n=n, side=side, **m)


def slab(poly, depth, loc, rgb, rx=0, ry=0, rz=0, bevel=0.0, **m):
    """Extrude a 2D outline [(x, y), ...] (in the xz plane, facing -y) by depth."""
    bm = bmesh.new()
    front = [bm.verts.new((x, -depth / 2, y)) for x, y in poly]
    back = [bm.verts.new((x, depth / 2, y)) for x, y in poly]
    n = len(poly)
    bm.faces.new(front[::-1])
    bm.faces.new(back)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[i], front[j], back[j], back[i]))
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=1, affect="EDGES")
    bmesh.ops.transform(bm, matrix=_local(loc, rx, ry, rz, 1.0), verts=bm.verts)
    return _bm_obj(bm, "slab", rgb, **m)


def blade(base, tip, w, rgb, side=(1, 0, 0), bend=0.0, t=0.01, **m):
    """A flat leaf / petal / fin: base -> tip, width w, thickness t, with an
    optional bend (lift of the middle along `side` x tip direction)."""
    base, tip = V(base), V(tip)
    d = tip - base
    u, v = frame(d, side)
    mid = base + d * 0.45 + v * bend
    return loft([(base, w * 0.15, t), (mid, w * 0.5, t), (base + d * 0.8 + v * bend * 0.6, w * 0.32, t), (tip, 0, 0)], rgb, n=4, side=side, **m)


def face(c, look=(0, -1, 0), size=0.06, gap=1.6, blush=None, smile=True, rgb=(0.08, 0.07, 0.1)):
    """A cute face stuck on a surface at c, looking along `look`: two bead eyes
    with shines, an optional smile and blush dots."""
    n = V(look).normalized()
    u, v = frame(n, (0, 0, 1))  # u: up-ish, v: across
    if abs(v.x) < abs(u.x):
        u, v = v, u
    if v.x < 0:
        v = -v
    up = n.cross(v).normalized()
    if up.z < 0:
        up = -up
    for s in (-1, 1):
        e = V(c) + v * s * size * gap
        ell(e, (size * 0.75, size * 0.75, size), rgb, seg=8, ring=6, rough=0.3)
        ell(e + n * size * 0.55 + up * size * 0.35 + v * size * 0.2, size * 0.28, (1, 1, 1), seg=6, ring=4)
        if blush:
            ell(V(c) + v * s * size * gap * 1.9 - up * size * 1.2 - n * size * 0.1, (size * 0.6, size * 0.6, size * 0.4), blush, seg=6, ring=4)
    if smile:
        sm = V(c) - up * size * 1.3 + n * size * 0.1
        verts, faces, k, steps = [], [], 4, 7
        for i in range(steps):
            a = math.pi * (1.1 + 0.8 * i / (steps - 1))
            ctr = sm + (v * math.cos(a) + up * (math.sin(a) + 0.75)) * size * 0.75
            for j in range(k):
                b = 2 * math.pi * j / k
                verts.append(tuple(ctr + (n * math.cos(b) + up * math.sin(b)) * size * 0.16))
        for i in range(steps - 1):
            for j in range(k):
                faces.append((i * k + j, (i + 1) * k + j, (i + 1) * k + (j + 1) % k, i * k + (j + 1) % k))
        me = bpy.data.meshes.new("smile")
        me.from_pydata(verts, [], faces)
        _obj("smile", me, rgb, rough=0.4)
    return


def ring_of(n, r, z=0.0, phase=0.0):
    """n points around a circle: (x, y, z, angle_deg)."""
    for i in range(n):
        a = phase + 2 * math.pi * i / n
        yield (r * math.cos(a), r * math.sin(a), z, math.degrees(a))


def rng(seed):
    import random
    return random.Random(seed)


# ---------------------------------------------------------------- framing + render

VIEW = V(0.7, -1.3, 0.85).normalized()  # 3/4 from the front right, looking down a little
CELL = 420


def _clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for me in list(bpy.data.meshes):
        bpy.data.meshes.remove(me)
    _xf[:] = [Matrix.Identity(4)]


def _setup(dark):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.view_settings.view_transform = "Standard"
    scene.render.film_transparent = True
    scene.render.resolution_x = scene.render.resolution_y = CELL
    try:
        scene.eevee.taa_render_samples = 16
    except AttributeError:
        pass
    w = bpy.data.worlds.get("w") or bpy.data.worlds.new("w")
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    if dark:
        bg.inputs["Color"].default_value = (0.35, 0.4, 0.75, 1)
        bg.inputs["Strength"].default_value = 0.75
    else:
        bg.inputs["Color"].default_value = (1.0, 0.98, 1.0, 1)
        bg.inputs["Strength"].default_value = 0.7
    scene.world = w
    sun_data = bpy.data.lights.get("sun") or bpy.data.lights.new("sun", "SUN")
    sun_data.energy = 1.8 if dark else 2.6
    sun_data.color = (0.75, 0.8, 1.0) if dark else (1.0, 0.97, 0.92)
    sun_data.angle = math.radians(12)
    sun = bpy.data.objects.new("sun", sun_data)
    sun.rotation_euler = (math.radians(40), math.radians(14), math.radians(32))
    scene.collection.objects.link(sun)
    return scene


def _cam_basis():
    f = -VIEW
    right = f.cross(V(0, 0, 1)).normalized()
    return right, right.cross(f).normalized()


def _extent():
    """Projected bounds of every mesh in camera space: (x0, x1, y0, y1)."""
    R, U = _cam_basis()
    xs, ys = [], []
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            xs.append(p.dot(R))
            ys.append(p.dot(U))
    if not xs:
        return (-1, 1, -1, 1)
    return (min(xs), max(xs), min(ys), max(ys))


def _shoot(scene, path, cx, cy, scale):
    R, U = _cam_basis()
    cam_data = bpy.data.cameras.get("cam") or bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = scale
    cam_data.clip_end = 400
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = R * cx + U * cy + VIEW * 120
    cam.rotation_euler = (-VIEW).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def run(boards, argv=None):
    argv = sys.argv[sys.argv.index("--") + 1:] if argv is None and "--" in sys.argv else (argv or [])
    out = os.path.abspath(argv[0] if argv else "renders")
    only = argv[1:]
    os.makedirs(out, exist_ok=True)
    ipath = os.path.join(out, "index.json")
    index = json.load(open(ipath)) if os.path.exists(ipath) else {}
    for slug, title, opts, rows in boards:
        if only and not any(slug.startswith(o) for o in only):
            continue
        dark = opts.get("dark", False)
        shared = opts.get("shared", True)
        pad = opts.get("pad", 1.15)
        bd = os.path.join(out, slug)
        os.makedirs(bd, exist_ok=True)
        entry = {"title": title, "dark": dark, "note": opts.get("note", ""), "rows": []}
        for ri, row_t in enumerate(rows):
            label, cells = row_t[0], row_t[1]
            shared = (row_t[2] if len(row_t) > 2 else {}).get("shared", opts.get("shared", True))
            # measure every cell, then render with a scale shared across the row
            ext = []
            for _, fn in cells:
                _clear()
                fn()
                ext.append(_extent())
            if shared:
                y0 = min(e[2] for e in ext)
                scale = max(max(e[1] - e[0], e[3] - y0) for e in ext) * pad
            row = {"label": label, "cells": []}
            for ci, ((clabel, fn), e) in enumerate(zip(cells, ext)):
                _clear()
                scene = _setup(dark)
                fn()
                s = scale if shared else max(e[1] - e[0], e[3] - e[2]) * pad
                cx = (e[0] + e[1]) / 2
                if shared:
                    # one ground line for the whole row, 6% up from the bottom
                    cy = y0 + s * (0.5 - 0.06)
                else:
                    cy = (e[2] + e[3]) / 2
                png = os.path.join(bd, f"{ri:02d}-{ci:02d}.png")
                _shoot(scene, png, cx, cy, s)
                if dark:
                    # emission-only pass: the board blooms from this, not from lit colour
                    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.0
                    bpy.data.lights["sun"].energy = 0.0
                    scene.render.filepath = png[:-4] + "_e.png"
                    bpy.ops.render.render(write_still=True)
                row["cells"].append({"png": os.path.relpath(png, out), "label": clabel})
            entry["rows"].append(row)
        index[slug] = entry
        json.dump(index, open(ipath, "w"), indent=1)
        print(f"[kit] board {slug}: {sum(len(r['cells']) for r in entry['rows'])} cells")
