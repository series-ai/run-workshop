"""Shared helpers for the prop and wearable build scripts (run inside Blender).

Props are built in metres, Blender axes: +X is the prop's front (the same way
the dogs face), +Z up, origin on the floor at the centre of the footprint.
Every face gets a palette material by name (`oak`, `linen`, `sage`...), so an
engine can recolour a prop by material name; the glTF has one primitive per
material. Everything is flat shaded with chamfered edges for the faceted,
papercraft look of the dogs.
"""
import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

# Scandi palette: pale woods, warm whites, oatmeal and muted sage / dusty blue /
# terracotta / mustard, with a few brighter toy colours. Linear-ish sRGB hex.
PALETTE = {
    'oak': '#d8b48a', 'oak_dark': '#b68a5e', 'birch': '#ead6b4', 'walnut': '#8c5c3e', 'bark': '#7a5a3e',
    'white': '#f3f0e9', 'linen': '#e7ddcc', 'oatmeal': '#d6c8ae', 'sand': '#cdb791', 'stone': '#bdb8ae',
    'grey': '#9c9a96', 'charcoal': '#4b4a4e', 'ink': '#2d2c30',
    'sage': '#a7b897', 'moss': '#7b8c66', 'dusty_blue': '#9fb5c6', 'navy': '#44586d', 'terracotta': '#cf8a68',
    'rust': '#b8693f', 'mustard': '#dfb558', 'blush': '#eab9ad', 'rose': '#d98d8a', 'lilac': '#b9add0',
    'red': '#d8584a', 'orange': '#e8904a', 'yellow': '#f0cf5a', 'tennis': '#d3df5a', 'teal': '#5fa7a0',
    'steel': '#c4c8cc', 'brass': '#c9a25a', 'water': '#9cc9dc', 'kibble': '#9a6236', 'kibble_light': '#c08a52',
    'meat': '#c9675a', 'biscuit': '#d9a868', 'glass': '#d9ebee', 'leaf': '#6f9a62', 'leaf_dark': '#557d4c',
    'soil': '#5e4636', 'black': '#2a2a2c',
    # House
    'wall': '#f2eee6', 'floor_oak': '#dcc09a', 'floor_oak2': '#cfb088', 'tile': '#eeebe5', 'grout': '#c7c2b8',
    'porcelain': '#f8f7f3', 'screen': '#2e3135', 'olive': '#9aa58a', 'cactus': '#6f8f62', 'coir': '#b9955f',
    # Wearables: materials named by role so a game recolours a collar by tinting `collar`.
    'collar': '#cf8a68', 'bandana': '#9fb5c6', 'bandana_trim': '#f3f0e9', 'strap': '#44586d', 'pad': '#a7b897',
    'vest': '#dfb558', 'trim': '#f3f0e9', 'knit': '#b8693f', 'knit_stripe': '#f3f0e9', 'hardware': '#c4c8cc',
}
METAL = {'steel', 'brass', 'hardware'}
DOUBLE_SIDED = set()   # filled per build for cloth materials


def srgb(hexstr):
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1.0]


def material(name):
    """Palette material (created once). `name@2s` gives a double-sided copy for cloth."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    key = name.split('@')[0]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = srgb(PALETTE[key])
    bsdf.inputs['Roughness'].default_value = 0.45 if key in METAL else (0.15 if key in ('water', 'glass') else 0.85)
    bsdf.inputs['Metallic'].default_value = 0.7 if key in METAL else 0.0
    m.use_backface_culling = not name.endswith('@2s')
    return m


def deg(rot):
    """4x4 rotation from Euler angles in degrees."""
    return Euler([math.radians(a) for a in rot]).to_matrix().to_4x4()


def frame(axis):
    """Two unit vectors perpendicular to `axis` (and to each other)."""
    axis = Vector(axis).normalized()
    ref = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))
    u = axis.cross(ref).normalized()
    v = axis.cross(u).normalized()
    return u, v


class Prop:
    """bmesh wrapper: primitives tagged with palette materials, then exported."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.old = self.bm.verts.layers.int.new('old')   # 1 = existed before the current primitive
        self.trusted = self.bm.faces.layers.int.new('trusted')   # 1 = winding is already right
        self.mats = []
        self.sockets = {}

    # ---- bookkeeping ----
    def mi(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def _faces(self, faces, mat):
        i = self.mi(mat)
        for f in faces:
            f.material_index = i
        return faces

    def _quads(self, rings, mat, closed=True, cap_start=False, cap_end=False):
        """Faces between consecutive rings of BMVerts."""
        n = len(rings[0])
        out = []
        for a, b in zip(rings, rings[1:]):
            for k in range(n if closed else n - 1):
                k2 = (k + 1) % n
                out.append(self.bm.faces.new((a[k], a[k2], b[k2], b[k])))
        if cap_start:
            out.append(self.bm.faces.new(tuple(reversed(rings[0]))))
        if cap_end:
            out.append(self.bm.faces.new(tuple(rings[-1])))
        return self._faces(out, mat)

    def _begin(self):
        for v in self.bm.verts:
            v[self.old] = 1

    def _fresh(self):
        """Verts created since _begin (bevel copies the flag from the verts it replaces)."""
        return [v for v in self.bm.verts if not v[self.old]]

    def _new(self, geom_fn, mat, bevel=0.0, matrix=None, edge_filter=None):
        self._begin()
        geom_fn()
        verts = self._fresh()
        faces = list({f for v in verts for f in v.link_faces})
        self._faces(faces, mat)
        if bevel:
            self.chamfer(verts, bevel, edge_filter=edge_filter)
            verts = self._fresh()
            self._faces(list({f for v in verts for f in v.link_faces}), mat)   # chamfer faces
        if matrix is not None:
            bmesh.ops.transform(self.bm, matrix=matrix, verts=verts)
        return verts

    def chamfer(self, verts, width, segments=1, edge_filter=None):
        vs = set(verts)
        edges = [e for e in self.bm.edges if e.verts[0] in vs and e.verts[1] in vs
                 and (edge_filter is None or edge_filter(e))]
        bmesh.ops.bevel(self.bm, geom=edges, offset=width, offset_type='OFFSET', segments=segments,
                        profile=0.5, affect='EDGES', clamp_overlap=True)

    # ---- primitives ----
    def box(self, size, center=(0, 0, 0), mat='oak', bevel=0.0, taper=(1.0, 1.0), rot=None):
        """Box of `size` (x, y, z) centred at `center`; `taper` scales the top face (x, y)."""
        sx, sy, sz = size

        def make():
            res = bmesh.ops.create_cube(self.bm, size=1.0)
            for v in res['verts']:
                top = v.co.z > 0
                v.co.x *= sx * (taper[0] if top else 1)
                v.co.y *= sy * (taper[1] if top else 1)
                v.co.z *= sz
        m = Matrix.Translation(center) @ (deg(rot) if rot is not None else Matrix())
        return self._new(make, mat, min(bevel, min(size) * 0.45) if bevel else 0, m)

    def cyl(self, r, h, base=(0, 0, 0), mat='oak', sides=10, r_top=None, bevel=0.0, axis=(0, 0, 1),
            cap=True):
        """Cylinder / cone from `base` along `axis` (length h)."""
        r_top = r if r_top is None else r_top

        def make():
            bot = [self.bm.verts.new((r * math.cos(a), r * math.sin(a), 0)) for a in
                   (2 * math.pi * k / sides for k in range(sides))]
            top = [self.bm.verts.new((r_top * math.cos(a), r_top * math.sin(a), h)) for a in
                   (2 * math.pi * k / sides for k in range(sides))]
            self._quads([bot, top], mat, cap_start=cap, cap_end=cap)
        # Chamfer only the cap rims (edges within one ring), not the side edges.
        return self._new(make, mat, bevel, self._axis_matrix(base, axis),
                         edge_filter=lambda e: abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6)

    def lathe(self, profile, base=(0, 0, 0), mat='oak', sides=12, axis=(0, 0, 1), cap_start=True,
              cap_end=True, mats=None):
        """Revolve a profile of (radius, height) points. `mats` gives a material per
        profile segment (len(profile) - 1) for banded objects (bowls with a rim)."""
        def make():
            rings = []
            for r, z in profile:
                if r < 1e-5:
                    rings.append(None)
                    continue
                rings.append([self.bm.verts.new((r * math.cos(2 * math.pi * k / sides),
                                                 r * math.sin(2 * math.pi * k / sides), z)) for k in range(sides)])
            for i, (a, b) in enumerate(zip(rings, rings[1:])):
                m = mats[i] if mats else mat
                if a is None and b is None:
                    continue
                if a is None or b is None:   # fan to the axis
                    ring, z = (b, profile[i][1]) if a is None else (a, profile[i + 1][1])
                    c = self.bm.verts.new((0, 0, z))
                    fs = []
                    for k in range(sides):
                        k2 = (k + 1) % sides
                        tri = (c, ring[k2], ring[k]) if a is None else (c, ring[k], ring[k2])
                        fs.append(self.bm.faces.new(tri))
                    self._faces(fs, m)
                else:
                    self._quads([a, b], m)
            if cap_start and rings[0] is not None:
                self._faces([self.bm.faces.new(tuple(reversed(rings[0])))], mats[0] if mats else mat)
            if cap_end and rings[-1] is not None:
                self._faces([self.bm.faces.new(tuple(rings[-1]))], mats[-1] if mats else mat)
        self._begin()
        make()
        verts = self._fresh()
        bmesh.ops.transform(self.bm, matrix=self._axis_matrix(base, axis), verts=verts)
        return verts

    def sphere(self, r, center=(0, 0, 0), mat='red', subdiv=1, scale=(1, 1, 1)):
        def make():
            res = bmesh.ops.create_icosphere(self.bm, subdivisions=subdiv, radius=r)
            for v in res['verts']:
                v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
        return self._new(make, mat, 0, Matrix.Translation(center))

    def uvsphere(self, r, center=(0, 0, 0), mat='red', seg=8, rings=6, scale=(1, 1, 1)):
        def make():
            res = bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=rings, radius=r)
            for v in res['verts']:
                v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
        return self._new(make, mat, 0, Matrix.Translation(center))

    def torus(self, R, r, center=(0, 0, 0), mat='steel', seg=12, sides=6, axis=(0, 0, 1), scale=(1, 1)):
        """Ring of radius R (tube radius r), lying in the plane perpendicular to axis."""
        def make():
            rings = []
            for i in range(seg):
                a = 2 * math.pi * i / seg
                c = Vector((R * math.cos(a) * scale[0], R * math.sin(a) * scale[1], 0))
                out = Vector((math.cos(a), math.sin(a), 0))
                rings.append([self.bm.verts.new(c + out * (r * math.cos(b)) + Vector((0, 0, r * math.sin(b))))
                              for b in (2 * math.pi * k / sides for k in range(sides))])
            rings.append(rings[0])
            self._quads(rings, mat)
        return self._new(make, mat, 0, self._axis_matrix(center, axis))

    def sweep(self, path, radius, mat='oak', sides=6, closed=False, cap=True, profile=None, twist=0.0):
        """Tube along a polyline. `radius` is a number, a list (one per point), or
        (w, h) pairs; `profile` is an optional list of 2D points (unit size) for
        flat straps etc. Frames are parallel-transported so tubes don't twist."""
        pts = [Vector(p) for p in path]
        n = len(pts)
        rad = radius if isinstance(radius, (list, tuple)) and len(radius) == n else [radius] * n
        prof = profile or [(math.cos(2 * math.pi * k / sides), math.sin(2 * math.pi * k / sides))
                           for k in range(sides)]

        def tangent(i):
            if closed:
                return (pts[(i + 1) % n] - pts[i - 1]).normalized()
            return (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()

        u, v = frame(tangent(0))
        rings = []
        for i, p in enumerate(pts):
            t = tangent(i)
            u = (u - t * u.dot(t)).normalized()
            v = t.cross(u).normalized()
            rw, rh = rad[i] if isinstance(rad[i], (list, tuple)) else (rad[i], rad[i])
            tw = twist * i / max(n - 1, 1)
            cu, cv = u * math.cos(tw) + v * math.sin(tw), v * math.cos(tw) - u * math.sin(tw)
            rings.append([self.bm.verts.new(p + cu * (x * rw) + cv * (y * rh)) for x, y in prof])
        if closed:
            rings.append(rings[0])
        return self._quads(rings, mat, cap_start=cap and not closed, cap_end=cap and not closed)

    def sheet(self, w, d, nx, ny, height=lambda x, y: 0.0, center=(0, 0, 0), mat='linen', thick=0.01,
              outline=None, top_mat=None):
        """Cloth / cushion slab: a grid displaced by height(x, y) (local metres), with
        a bottom face `thick` below and side walls. `outline(x, y)` can pull edge
        points in (rounded corners). Returns the top grid verts."""
        top_mat = top_mat or mat

        def pos(i, j):
            x, y = (i / nx - 0.5) * w, (j / ny - 0.5) * d
            if outline:
                x, y = outline(x, y)
            return x, y

        grid = [[None] * (ny + 1) for _ in range(nx + 1)]
        low = [[None] * (ny + 1) for _ in range(nx + 1)]
        cx, cy, cz = center
        for i in range(nx + 1):
            for j in range(ny + 1):
                x, y = pos(i, j)
                h = height(x, y)
                grid[i][j] = self.bm.verts.new((cx + x, cy + y, cz + h))
                edge = i in (0, nx) or j in (0, ny)
                low[i][j] = self.bm.verts.new((cx + x, cy + y, cz + h - thick)) if edge else None
        tops = []
        for i in range(nx):
            for j in range(ny):
                tops.append(self.bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1])))
        self._faces(tops, top_mat)
        # Border loop (counter-clockwise from above), walls down, then a bottom n-gon.
        loop = ([(i, 0) for i in range(nx)] + [(nx, j) for j in range(ny)]
                + [(i, ny) for i in range(nx, 0, -1)] + [(0, j) for j in range(ny, 0, -1)])
        walls = []
        for k, (i, j) in enumerate(loop):
            i2, j2 = loop[(k + 1) % len(loop)]
            walls.append(self.bm.faces.new((grid[i2][j2], grid[i][j], low[i][j], low[i2][j2])))
        walls.append(self.bm.faces.new(tuple(low[i][j] for i, j in reversed(loop))))
        self._faces(walls, mat)
        return [v for row in grid for v in row]

    def strip(self, points, width, normal_hint=(0, 0, 1), mat='linen', thick=0.004):
        """Flat ribbon through points (straps, ribbons). Width across `normal_hint` x tangent."""
        pts = [Vector(p) for p in points]
        nh = Vector(normal_hint)
        rings = []
        for i, p in enumerate(pts):
            t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            side = t.cross(nh).normalized()
            up = side.cross(t).normalized()
            rings.append([self.bm.verts.new(p + side * s * width / 2 + up * h * thick / 2)
                          for s, h in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
        return self._quads(rings, mat, cap_start=True, cap_end=True)

    def pillow(self, w, d, t, center=(0, 0, 0), mat='linen', nx=6, ny=6, boxy=3.0, corner=4.0, rot=None,
               seam_mat=None):
        """Closed puffy cushion: w along x, d along y, t thick, pinched to a seam
        all round. `boxy` > 2 flattens the top (sofa cushions), `corner` rounds
        the outline (superellipse exponent; large = square)."""
        def xy(i, j):
            u, v = 2 * i / nx - 1, 2 * j / ny - 1
            m = max(abs(u), abs(v))
            if m > 0 and corner < 50:
                k = m / (abs(u) ** corner + abs(v) ** corner) ** (1 / corner)
                u, v = u * k, v * k
            return u, v

        def h(u, v):
            return t / 2 * max(0.0, 1 - abs(u) ** boxy) ** 0.5 * max(0.0, 1 - abs(v) ** boxy) ** 0.5

        def make():
            top = [[None] * (ny + 1) for _ in range(nx + 1)]
            bot = [[None] * (ny + 1) for _ in range(nx + 1)]
            for i in range(nx + 1):
                for j in range(ny + 1):
                    u, v = xy(i, j)
                    x, y = u * w / 2, v * d / 2
                    if i in (0, nx) or j in (0, ny):
                        top[i][j] = bot[i][j] = self.bm.verts.new((x, y, 0))
                    else:
                        top[i][j] = self.bm.verts.new((x, y, h(u, v)))
                        bot[i][j] = self.bm.verts.new((x, y, -h(u, v)))
            fs = []
            for i in range(nx):
                for j in range(ny):
                    fs.append(self.bm.faces.new((top[i][j], top[i + 1][j], top[i + 1][j + 1], top[i][j + 1])))
                    fs.append(self.bm.faces.new((bot[i][j + 1], bot[i + 1][j + 1], bot[i + 1][j], bot[i][j])))
            self._faces(fs, mat)
            # The pinched seam confuses recalc_face_normals (it flipped every
            # cushion top), and this winding is right by construction.
            for f in fs:
                f[self.trusted] = 1
        m = Matrix.Translation(center) @ (deg(rot) if rot is not None else Matrix())
        return self._new(make, mat, 0, m)

    def prism(self, poly, x0, x1, mat='oak', axis='x'):
        """Extrude a 2D outline (in the plane across `axis`) from x0 to x1. For
        axis 'x' the outline is (y, z); 'y' -> (x, z); 'z' -> (x, y)."""
        def place(a, b, s):
            return {'x': (s, a, b), 'y': (a, s, b), 'z': (a, b, s)}[axis]

        front = [self.bm.verts.new(place(a, b, x1)) for a, b in poly]
        back = [self.bm.verts.new(place(a, b, x0)) for a, b in poly]
        fs = [self.bm.faces.new(tuple(front)), self.bm.faces.new(tuple(reversed(back)))]
        n = len(poly)
        for k in range(n):
            k2 = (k + 1) % n
            fs.append(self.bm.faces.new((back[k], back[k2], front[k2], front[k])))
        self._faces(fs, mat)
        return front + back

    def mark(self):
        """Start a group of primitives to recolour with paint(since(mark))."""
        lay = self.bm.faces.layers.int.get('mark') or self.bm.faces.layers.int.new('mark')
        for f in self.bm.faces:
            f[lay] = 1
        return lay

    def since(self, lay):
        return [f for f in self.bm.faces if not f[lay]]

    def paint(self, faces, fn):
        """Recolour faces: fn(face_centre) -> material name or None (keep)."""
        for f in faces:
            m = fn(f.calc_center_median())
            if m:
                f.material_index = self.mi(m)

    def embed(self, build, matrix):
        """Draw another prop's builder into this one, transformed (toys in a basket)."""
        self._begin()
        saved = dict(self.sockets)
        stamp = self.bm.faces.layers.int.get('embed') or self.bm.faces.layers.int.new('embed')
        for f in self.bm.faces:
            f[stamp] = 1
        build(self)
        self.sockets = saved
        # Nested primitives re-flag everything as old, so find the embedded geometry by its faces.
        verts = {v for f in self.bm.faces if not f[stamp] for v in f.verts}
        self.transform(list(verts), matrix)

    def socket(self, name, pos, rot=(0, 0, 0)):
        """Named attachment point (exported as an empty node)."""
        self.sockets[name] = (Vector(pos), rot)

    @staticmethod
    def _axis_matrix(base, axis):
        axis = Vector(axis).normalized()
        q = Vector((0, 0, 1)).rotation_difference(axis)
        return Matrix.Translation(base) @ q.to_matrix().to_4x4()

    def transform(self, verts, matrix):
        bmesh.ops.transform(self.bm, matrix=matrix, verts=verts)

    def jitter(self, verts, amount, seed=1):
        """Small deterministic wobble so cloth / plush reads hand-made."""
        s = seed
        for v in verts:
            for a in range(3):
                s = (s * 16807) % 2147483647
                v.co[a] += (s / 2147483647 - 0.5) * 2 * amount

    # ---- output ----
    def to_object(self):
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-6)
        bmesh.ops.recalc_face_normals(self.bm, faces=[f for f in self.bm.faces if not f[self.trusted]])
        bmesh.ops.triangulate(self.bm, faces=self.bm.faces)
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        obj = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(obj)
        for p in me.polygons:
            p.use_smooth = False
        for m in self.mats:
            me.materials.append(material(m))
        return obj


def clear_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)


def export_prop(prop, path, extras=None):
    """One prop (plus its sockets as empties) to a GLB. Returns (tris, size)."""
    clear_scene()
    obj = prop.to_object()
    obj['prop'] = extras or {}
    for name, (pos, rot) in prop.sockets.items():
        e = bpy.data.objects.new(f'socket_{name}', None)
        e.location = pos
        e.rotation_euler = rot
        e.parent = obj
        bpy.context.scene.collection.objects.link(e)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_extras=True,
                              export_apply=True,
                              export_animations=False)
    tris = len(obj.data.polygons)
    co = [obj.matrix_world @ v.co for v in obj.data.vertices]
    lo = [min(c[a] for c in co) for a in range(3)]
    hi = [max(c[a] for c in co) for a in range(3)]
    return tris, lo, hi
