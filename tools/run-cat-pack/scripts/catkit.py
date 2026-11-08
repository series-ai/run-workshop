"""Shared helpers for the cat build scripts (run inside Blender)."""
import math

import bmesh
import bpy

import slim
from mathutils import Vector

# One texture tile of the surface patterns (spots, merle, brindle) covers this
# much of the normalised dog length (body length = 1).
UV_TILE = 0.5
# Face/detail tags, written to COLOR_0 as an RGB code the viewer decodes:
# nose (1,0,0), eye iris (0,1,0), ink = pupils and mouth (0,0,1),
# shine = eye highlights (1,1,1), inner = inside of the ears (1,0,1).
TAGS = {'nose': 1, 'eye': 2, 'ink': 3, 'shine': 4, 'inner': 5}
TAG_RGB = {0: (0, 0, 0), 1: (1, 0, 0), 2: (0, 1, 0), 3: (0, 0, 1), 4: (1, 1, 1), 5: (1, 0, 1)}


def ring_points(center, tangent, w, h, sides, exp=2.4, keel=0.0, flat_top=False):
    """Cross-section ring: a superellipse with a vertex on the top ridge, or a
    flat edge across the top when flat_top (boxy heads)."""
    tangent = tangent.normalized()
    side = Vector((0, 1, 0))
    up = tangent.cross(side).normalized()
    side = up.cross(tangent).normalized()
    pts = []
    for k in range(sides):
        a = math.pi / 2 + 2 * math.pi * (k + (0.5 if flat_top else 0)) / sides
        c, s = math.cos(a), math.sin(a)
        x = math.copysign(abs(c) ** (2 / exp), c) * w
        z = math.copysign(abs(s) ** (2 / exp), s) * h
        if s < 0:
            z -= keel * h * (1 - abs(c))  # deeper keel under the chest
        pts.append(center + side * x + up * z)
    return pts


class Builder:
    """bmesh wrapper that tags faces (body / nose / eye) as it builds."""

    def __init__(self):
        self.bm = bmesh.new()
        self.tag = self.bm.faces.layers.int.new('tag')

    def faces(self, verts_lists, tag=None):
        out = [self.bm.faces.new(vs) for vs in verts_lists]
        for f in out:
            f[self.tag] = TAGS.get(tag, 0)
        return out

    def tube(self, rings, cap_start=True, cap_end=True, tag=None):
        vs = [[self.bm.verts.new(p) for p in r] for r in rings]
        n = len(rings[0])
        quads = [(a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]) for a, b in zip(vs, vs[1:]) for k in range(n)]
        if cap_start:
            quads.append(tuple(reversed(vs[0])))
        if cap_end:
            quads.append(tuple(vs[-1]))
        self.faces(quads, tag)
        return vs

    def tag_new(self, verts, tag):
        for f in {f for v in verts for f in v.link_faces}:
            f[self.tag] = TAGS.get(tag, 0)

    def to_object(self, name):
        """Triangulate, write tags into COLOR_0 (see TAG_RGB), flat shade."""
        bmesh.ops.triangulate(self.bm, faces=self.bm.faces)
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        obj = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(obj)
        for p in me.polygons:
            p.use_smooth = False
        col = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
        tags = [0] * len(me.polygons)
        me.attributes['tag'].data.foreach_get('value', tags)
        for p in me.polygons:
            t = tags[p.index]
            for li in p.loop_indices:
                col.data[li].color_srgb = (*map(float, TAG_RGB[t]), 1.0)
        me.attributes.remove(me.attributes['tag'])
        me.color_attributes.active_color = col
        me.color_attributes.render_color_index = 0
        return obj


def even_uvs(obj, units_per_tile):
    """Smart-project UVs, then scale so one UV unit covers `units_per_tile` of
    surface. Even density means tiling patterns keep the same size everywhere."""
    me = obj.data
    me.uv_layers.new(name='UVMap')
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    uv = [0.0] * (len(me.loops) * 2)
    me.uv_layers.active.data.foreach_get('uv', uv)
    area_3d = sum(p.area for p in me.polygons)
    area_uv = 0.0
    for p in me.polygons:
        a, b, c = ((uv[2 * i], uv[2 * i + 1]) for i in p.loop_indices)
        area_uv += abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2
    k = math.sqrt(area_3d / area_uv) / units_per_tile
    me.uv_layers.active.data.foreach_set('uv', [x * k for x in uv])


def export(path):
    # Only the tag layer as COLOR_0 (the default adds a white set first);
    # extras carry socket metadata (projection UV for region patterns).
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True,
                              export_vertex_color='ACTIVE', export_all_vertex_colors=False,
                              export_extras=True)
    slim.slim(path)   # redundant keys out, weights / tag colours to bytes (scripts/slim.py)


def split_jaw(B, is_jaw, hinge, name='jaw'):
    """Move the faces where is_jaw(face_center) is true out of builder B into a
    separate `jaw` object whose origin is the hinge, so it can rotate open. The
    head is left with an opening there; viewers draw the head's back faces as
    the inside of the mouth. Returns the jaw object (call before B.to_object)."""
    faces = [f for f in B.bm.faces if f[B.tag] == 0 and is_jaw(f.calc_center_median())]
    J = Builder()
    vmap = {}
    for f in faces:
        vs = []
        for v in f.verts:
            if v not in vmap:
                vmap[v] = J.bm.verts.new(v.co - hinge)
            vs.append(vmap[v])
        J.bm.faces.new(vs)[J.tag] = 0
    bmesh.ops.delete(B.bm, geom=faces, context='FACES_ONLY')
    loose = [v for v in B.bm.verts if not v.link_faces]
    bmesh.ops.delete(B.bm, geom=loose, context='VERTS')
    jaw = J.to_object(name)
    jaw.location = hinge
    return jaw
