"""Shared helpers for the street prop families (trees, lamps, fences, ground,
jack-o'-lanterns, yard decorations, candy): kit.py plus a few extra shapes.

    from streetkit import *     # kit's box/ball/can/limb/hull/glow ... plus tube, dome, ship, main_for
"""
import math
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from kit import *  # noqa: E402,F401,F403
import kit  # noqa: E402
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

GLOW = kit.GLOW_RGB


def _obj(bm, rgb, name="piece"):
    me = bpy.data.meshes.new(name)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return finish(o, rgb)


def tube(points, radii, rgb, n=6, tip=True, twist=0.0):
    """A faceted tube along a polyline (one continuous mesh, no caps between
    segments): rings of n sides, radius per point. tip=True closes the end in a point."""
    pts = [Vector(p) for p in points]
    bm = bmesh.new()
    rings = []
    t0 = (pts[1] - pts[0]).normalized()
    ref = Vector((0, 0, 1)) if abs(t0.z) < 0.9 else Vector((1, 0, 0))
    u = t0.cross(ref).normalized()
    for i, p in enumerate(pts):
        if i == 0:
            t = t0
        elif i == len(pts) - 1:
            t = (pts[i] - pts[i - 1]).normalized()
        else:
            t = ((pts[i] - pts[i - 1]).normalized() + (pts[i + 1] - pts[i]).normalized()).normalized()
        u = (u - t * u.dot(t)).normalized()            # parallel transport
        v = t.cross(u)
        last = i == len(pts) - 1
        if last and tip:
            rings.append([bm.verts.new(p)])
            continue
        r = radii[i]
        ring = []
        for k in range(n):
            a = 2 * math.pi * k / n + twist * i
            ring.append(bm.verts.new(p + (u * math.cos(a) + v * math.sin(a)) * r))
        rings.append(ring)
    bm.faces.new(rings[0][::-1])
    for a, b in zip(rings, rings[1:]):
        if len(b) == 1:
            for k in range(n):
                bm.faces.new((a[k], a[(k + 1) % n], b[0]))
        else:
            for k in range(n):
                bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))
    if len(rings[-1]) > 1:
        bm.faces.new(rings[-1])
    return _obj(bm, rgb, "tube")


def dome(x, y, z0, sx, sy, sz, rgb, seg=8, ring=4, base=0.0):
    """The upper half of an ellipsoid (sx, sy wide, sz tall) standing on z0, closed flat underneath.
    base > 0 drops the cut below the equator by that fraction of sz (a fuller dome)."""
    bm = bmesh.new()
    rings = []
    a0 = -math.asin(min(base * 2, 0.95))
    for j in range(ring + 1):
        a = a0 + (math.pi / 2 - a0) * j / ring
        if j == ring:
            rings.append([bm.verts.new((x, y, z0 + sz))])
            break
        ring_v = []
        for k in range(seg):
            t = 2 * math.pi * (k + 0.5) / seg
            ring_v.append(bm.verts.new((x + math.cos(t) * math.cos(a) * sx / 2,
                                        y + math.sin(t) * math.cos(a) * sy / 2,
                                        z0 + (math.sin(a) - math.sin(a0)) / (1 - math.sin(a0)) * sz)))
        rings.append(ring_v)
    bm.faces.new(rings[0][::-1])
    for a, b in zip(rings, rings[1:]):
        if len(b) == 1:
            for k in range(seg):
                bm.faces.new((a[k], a[(k + 1) % seg], b[0]))
        else:
            for k in range(seg):
                bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    return _obj(bm, rgb, "dome")


def poly_slab(pts2d, y, depth, rgb, axis="y"):
    """A flat extruded polygon (convex) in the xz plane at y, depth thick (front face at y)."""
    pts = [(px, y, pz) for px, pz in pts2d] + [(px, y + depth, pz) for px, pz in pts2d]
    return hull(pts, rgb)


def ship(slug, kind, build, out_dir, recentre=True, render=True):
    """Fresh scene -> build() -> one mesh -> GLB (+ sheet). Returns the index entry."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    kit._mats.clear()
    build()
    tris = kit.finish_prop(slug, recentre=recentre)
    calls = kit.export_prop(slug, os.path.join(kit.GLB_DIR, f"{slug}.glb"))
    if render:
        kit.render_sheet(slug, out_dir)
    print(f"PROP {slug}: {tris} tris, {calls} draw calls")
    return {"slug": slug, "tris": tris, "kind": kind}


def main_for(props, kind, recentre=()):
    """Run a family: `props` maps slug -> build(). Args after '--': out_dir [slug ...] [--norender]."""
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    render = "--norender" not in args
    args = [a for a in args if a != "--norender"]
    out = args[0] if args else os.path.join(kit.HERE, "renders")
    only = args[1:]
    entries = []
    for slug, build in props.items():
        if only and slug not in only:
            continue
        entries.append(ship(slug, kind, build, out, recentre=slug not in recentre, render=render))
    kit.update_index(entries)
    for e in entries:
        print(f"TRIS {e['slug']:22s} {e['tris']}")
