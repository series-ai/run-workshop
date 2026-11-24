"""Wearables fitted to one rigged dog: a collar with a tag, and a bandana. Called from rig.py
after the dog is skinned; each is written as its own GLB (the dog's skeleton + one skinned
mesh) to rigged/wear/<slug>--collar.glb and --bandana.glb.

Fitting: the neck is sliced across, perpendicular to the neck bone, by casting rays out from
the bone in a circle. The collar is a strap laid just outside that outline; the bandana is a
band on the same outline plus a triangle of cloth laid down the chest (rays cast forward onto
the body below the collar). Every vertex copies the skin weights of the nearest dog vertex,
so they ride the neck and chest exactly as the fur does.

Blender space here: z up, dog facing -y.
"""
import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

from cloth import cloth_patterns

SEGS = 28
PLAIN_UV = (0.0527, 1 - 0.0527)   # where every cloth pattern is 0 (glTF flips v): band and knot take color A


def _material(name, rgb, rough=0.6, metal=0.0, image=None):
    old = bpy.data.materials.get(name)   # an earlier wearable's: free the name (games look materials up
    if old is not None:                  # by it: 'collar', 'tag', 'bandana'), not 'collar.001'
        old.name = name + '-done'
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = False
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if image is not None:
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = image
        mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def _cloth_image():
    """Default bandana texture (red with cream dots), for viewers without the tint shader."""
    pat = cloth_patterns()[..., 0]
    size = pat.shape[0]
    img = bpy.data.images.new('bandana', size, size)
    red, cream = np.array((0.62, 0.08, 0.07)), np.array((0.95, 0.93, 0.88))
    px = np.ones((size, size, 4))
    px[..., :3] = red + (cream - red) * pat[..., None]
    img.pixels = px.ravel()
    img.pack()
    return img


class Fitter:
    def __init__(self, mesh, arm_obj):
        self.mesh, self.arm = mesh, arm_obj
        verts = [v.co.copy() for v in mesh.data.vertices]
        self.bvh = BVHTree.FromPolygons(verts, [list(p.vertices) for p in mesh.data.polygons])
        self.kd = KDTree(len(verts))
        for i, v in enumerate(verts):
            self.kd.insert(v, i)
        self.kd.balance()
        bones = arm_obj.data.bones
        mw = arm_obj.matrix_world
        n0, n1 = mw @ bones['neck'].head_local, mw @ bones['neck'].tail_local
        mouth = mw @ bones['mouth'].head_local
        head_group = mesh.vertex_groups['head'].index
        # Collar: the narrowest slice across the neck that stays on neck (not head) and
        # passes under the mouth. Mostly perpendicular to the neck bone; tilted toward level
        # when the neck is buried in a ruff (Pomeranian).
        best = None
        neck_axis = (n1 - n0).normalized()
        for tilt in (0.0, 0.3, 0.6):
            self.set_axis(neck_axis.lerp(Vector((0, 0, 1)), tilt).normalized())
            for t in np.linspace(0.0, 0.85, 18):
                c = n0 + (n1 - n0) * t
                r = self.outline(c)
                if r is None:
                    continue
                pts = [c + self.dir(2 * math.pi * k / SEGS) * r[k] for k in range(SEGS)]
                on_head = np.mean([self.head_weight(p, head_group) for p in pts])
                over_mouth = max(pts[0].z - (mouth.z - 0.03), 0)
                score = float(np.mean(r)) + 1.5 * max(on_head - 0.2, 0) + 4 * over_mouth + 0.02 * tilt
                if os.environ.get('WEAR_DEBUG'):
                    print('WEAR', tilt, round(t, 2), round(float(np.mean(r)), 3), round(float(on_head), 2), round(over_mouth, 3), round(score, 3))
                if best is None or score < best[0] - 0.003:
                    best = (score, c, r, self.axis)
        _, self.c, self.r, axis = best
        self.set_axis(axis)
        self.radius = float(np.mean(self.r))
        self.chest = mw @ bones['chest'].head_local

    def set_axis(self, axis):
        # Frame around the neck: f points forward/down the throat, s to the dog's side.
        self.axis = axis
        self.s = axis.cross(Vector((0, -1, 0))).normalized()
        self.f = self.s.cross(axis).normalized()
        if self.f.y > 0:
            self.f, self.s = -self.f, -self.s

    def head_weight(self, p, group):
        _, i, _ = self.kd.find(p)
        return next((g.weight for g in self.mesh.data.vertices[i].groups if g.group == group), 0.0)

    def dir(self, th):
        return self.f * math.cos(th) + self.s * math.sin(th)

    def outline(self, c):
        """Distance from c to the neck surface around the neck (smoothed), or None."""
        r = []
        for k in range(SEGS):
            hit, *_ = self.bvh.ray_cast(c, self.dir(2 * math.pi * k / SEGS), 1.0)
            if hit is None:
                return None
            r.append((hit - c).length)
        r = np.array(r)
        for _ in range(2):
            r = (np.roll(r, 1) + 2 * r + np.roll(r, -1)) / 4
        return r

    def weights_for(self, ob):
        gname = {g.index: g.name for g in self.mesh.vertex_groups}
        for v in ob.data.vertices:
            _, i, _ = self.kd.find(v.co)
            for ge in self.mesh.data.vertices[i].groups:
                if ge.weight > 1e-4:
                    g = ob.vertex_groups.get(gname[ge.group]) or ob.vertex_groups.new(name=gname[ge.group])
                    g.add([v.index], ge.weight, 'REPLACE')

    def finish(self, bm, name, mats):
        me = bpy.data.meshes.new(name)
        bm.normal_update()
        bm.to_mesh(me)
        bm.free()
        for m in mats:
            me.materials.append(m)
        for p in me.polygons:
            p.use_smooth = True
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        self.weights_for(ob)
        ob.parent = self.arm
        mod = ob.modifiers.new('armature', 'ARMATURE')
        mod.object = self.arm
        return ob

    def ring(self, bm, rows, segs_closed=True):
        """Quads between consecutive rows of verts (each row loops around the neck)."""
        faces = []
        for a, b in zip(rows, rows[1:]):
            n = len(a)
            for k in range(n if segs_closed else n - 1):
                faces.append(bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k])))
        return faces

    # ------------------------------------------------------------ helpers
    def tube(self, bm, prof, segs=SEGS, out0=0.0):
        """A strap around the neck: profile points (out, up) swept round the outline."""
        rows = []
        for out, up in prof:
            rows.append([bm.verts.new(self.c + self.dir(2 * math.pi * k / segs) * (self.r[k * SEGS // segs] + out0 + out) +
                                      self.axis * up) for k in range(segs)])
        return self.ring(bm, rows + [rows[0]]), rows

    def puck(self, bm, centre, normal, up, radius, thick, segs=12, mat=0):
        """A chunky rounded disc (tag, knot): bevelled edge, domed faces."""
        side = up.cross(normal).normalized()
        rows = []
        for z, rr in ((-thick / 2, 0.75), (-thick * 0.35, 1.0), (thick * 0.35, 1.0), (thick / 2, 0.75)):
            rows.append([bm.verts.new(centre + normal * z + (side * math.cos(a) + up * math.sin(a)) * radius * rr)
                         for a in np.linspace(0, 2 * math.pi, segs, endpoint=False)])
        faces = self.ring(bm, rows)
        for row, sgn in ((rows[0], -1), (rows[-1], 1)):
            cap = bm.verts.new(centre + normal * sgn * thick * 0.65)
            n = len(row)
            for k in range(n):
                tri = (row[k], row[(k + 1) % n], cap) if sgn > 0 else (row[(k + 1) % n], row[k], cap)
                faces.append(bm.faces.new(tri))
        for f in faces:
            f.material_index = mat
        return faces

    # ------------------------------------------------------------ collar
    def collar(self):
        """A thick rounded strap with a chunky tag on a ring under the throat."""
        w = min(max(0.5 * self.radius, 0.03), 0.06)       # strap width along the neck
        t = min(max(0.22 * self.radius, 0.016), 0.028)    # strap thickness
        bm = bmesh.new()
        prof = [(0.4 * t * (1 - math.cos(a)) + 0.004, 0.5 * w * math.sin(a)) for a in np.linspace(-math.pi * 0.5, math.pi * 0.5, 5)]
        prof = [(0.003, -0.42 * w)] + [(0.004 + t * (0.55 + 0.45 * math.cos(a)), 0.5 * w * math.sin(a))
                                        for a in np.linspace(-math.pi / 2, math.pi / 2, 4)] + [(0.003, 0.42 * w)]
        self.tube(bm, prof, segs=18)
        front = self.c + self.dir(0) * (self.r[0] + 0.004 + t)
        down = (Vector((0, 0, -1)) - self.dir(0) * 0.25).normalized()
        tag_r = min(max(0.45 * self.radius, 0.022), 0.04)
        ring_r = 0.35 * tag_r
        fwd = Vector((0, -1, 0))
        # D-ring: a small torus-ish loop, then the tag hanging below it
        ring_c = front + down * ring_r * 0.8
        self.puck(bm, ring_c, fwd, Vector((0, 0, 1)), ring_r, 0.006, 6, mat=1)
        self.puck(bm, ring_c + down * (ring_r + tag_r * 0.95) + fwd * 0.006, fwd, Vector((0, 0, 1)), tag_r,
                  max(0.3 * tag_r, 0.008), 10, mat=1)
        return self.finish(bm, 'collar', [_material('collar', (0.55, 0.06, 0.05), 0.45),
                                           _material('tag', (0.9, 0.62, 0.18), 0.3, 1.0)])

    # ------------------------------------------------------------ bell collar (cats)
    def bell_collar(self):
        """A slimmer strap than the dog collar with a round jingle bell under the throat. The
        strap is white so a game tints it any colour (material.color); the bell is brass."""
        w = min(max(0.48 * self.radius, 0.03), 0.055)
        t = min(max(0.22 * self.radius, 0.016), 0.026)
        bm = bmesh.new()
        prof = [(0.003, -0.42 * w)] + [(0.004 + t * (0.55 + 0.45 * math.cos(a)), 0.5 * w * math.sin(a))
                                        for a in np.linspace(-math.pi / 2, math.pi / 2, 4)] + [(0.003, 0.42 * w)]
        self.tube(bm, prof, segs=18)
        front = self.c + self.dir(0) * (self.r[0] + 0.004 + t)
        down = (Vector((0, 0, -1)) - self.dir(0) * 0.25).normalized()
        fwd = Vector((0, -1, 0))
        bell_r = min(max(0.62 * self.radius, 0.032), 0.055)   # big and chunky: a toy bell, not a real one
        ring_r = 0.3 * bell_r
        ring_c = front + down * ring_r * 0.8
        self.puck(bm, ring_c, fwd, Vector((0, 0, 1)), ring_r, 0.005, 6, mat=1)
        # the bell: a ball with a slot across its lower half and a little bead on top
        bc = ring_c + down * (ring_r + bell_r * 0.95) + fwd * 0.004
        made = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=bell_r)['verts']
        for v in made:
            v.co = bc + v.co
        for f in {f for v in made for f in v.link_faces}:
            f.material_index = 1
        self.puck(bm, bc + down * bell_r * 0.35 + fwd * bell_r * 0.82, fwd, Vector((0, 0, 1)), bell_r * 0.42, 0.004, 8, mat=2)
        return self.finish(bm, 'bell_collar', [_material('collar', (0.9, 0.9, 0.9), 0.5),
                                               _material('tag', (0.92, 0.66, 0.2), 0.28, 1.0),
                                               _material('slot', (0.08, 0.06, 0.04), 0.6)])

    # ------------------------------------------------------------ neckerchief (cats)
    def neckerchief(self):
        """A scout-style neckerchief: a rolled band round the neck, gathered under the throat by a
        round slide (woggle), with two short ends hanging down the chest, a little apart. Cloth uses
        the shared pattern texture (tintCloth: any two colours, dots / gingham / stripes / plain);
        the slide is its own material."""
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new('UVMap')
        band = min(max(0.4 * self.radius, 0.025), 0.045)
        thick = min(max(0.16 * self.radius, 0.012), 0.022)
        prof = [(0.003, -0.45 * band)] + [(0.004 + thick * (0.5 + 0.5 * math.cos(a)), 0.5 * band * math.sin(a))
                                           for a in np.linspace(-math.pi / 2, math.pi / 2, 4)] + [(0.003, 0.45 * band)]
        self.tube(bm, prof, segs=18)
        fwd, side = self.dir(0), self.s
        down = (Vector((0, 0, -1)) - fwd * fwd.dot(Vector((0, 0, -1)))).normalized()
        throat = self.c + fwd * (self.r[0] + 0.004 + thick)
        # the slide: a chunky ring a little below the band, facing forward
        sr = min(max(0.5 * self.radius, 0.026), 0.042)
        slide_c = throat + down * (0.5 * band + 0.6 * sr) + fwd * 0.006
        self.puck(bm, slide_c, fwd, -down, sr, max(0.45 * sr, 0.01), 12, mat=1)
        # the two ends: strips draped down the chest from the slide, splayed apart. Sized from the
        # chest, like the bandana (sized from the neck they vanished under the big cat heads).
        probe = throat - fwd * (self.r[0] + 0.02) + down * 0.04
        widths = [(hit - probe).length for d in (side, -side)
                  for hit in [self.bvh.ray_cast(probe, d, 1.0)[0]] if hit is not None]
        hw = min(max(0.9 * (sum(widths) / len(widths) if widths else 0.12), 0.11), 0.2)
        L = 1.15 * hw
        W = 0.42 * hw
        N = 6
        for sgn in (-1, 1):
            rows = []
            for i in range(N + 1):
                a_ = i / N
                c = slide_c + down * (0.6 * sr + L * a_) + side * sgn * (0.45 * sr + 0.9 * W * a_)   # a clear V
                w = W * (1 - 0.15 * a_)
                row = []
                for j, b_ in enumerate((-0.5, 0.0, 0.5)):
                    p = c + side * (b_ * w)
                    hit, *_ = self.bvh.ray_cast(p + fwd * 0.4, -fwd, 0.8)
                    if hit is not None and (hit - p).dot(fwd) > -0.12:
                        p = hit + fwd * (0.014 + 0.008 * a_)
                    else:
                        p = p + fwd * 0.016
                    # the tips are cut on a slant, like the points of a folded scarf
                    if i == N:
                        p = p + down * (0.25 * W * sgn * b_)
                    row.append(p)
                rows.append(row)
            # smooth along and across the strip: rays onto a lumpy chest made the ends zig-zag
            for _ in range(3):
                rows = [[(rows[i][j] * 2 + rows[max(i - 1, 0)][j] + rows[min(i + 1, N)][j]) / 4 if 0 < i < N else rows[i][j]
                         for j in range(3)] for i in range(N + 1)]
                rows = [[row[0], (row[0] + row[1] * 2 + row[2]) / 4, row[2]] for row in rows]
            front_ = [[bm.verts.new(p + fwd * thick * 0.5) for p in row] for row in rows]
            back_ = [[bm.verts.new(p - fwd * thick * 0.5) for p in row] for row in rows]
            uvs = [[(0.5 + 0.3 * (j - 1), 0.2 + 0.6 * i / N) for j in range(3)] for i in range(N + 1)]
            for sheet, flip in ((front_, False), (back_, True)):
                for i in range(N):
                    for j in range(2):
                        q = (sheet[i][j], sheet[i][j + 1], sheet[i + 1][j + 1], sheet[i + 1][j])
                        t = (uvs[i][j], uvs[i][j + 1], uvs[i + 1][j + 1], uvs[i + 1][j])
                        f = bm.faces.new(q[::-1] if flip else q)
                        for lp, tt in zip(f.loops, t[::-1] if flip else t):
                            lp[uv].uv = tt
            for path in ([(i, 0) for i in range(N + 1)], [(i, 2) for i in range(N + 1)], [(N, j) for j in range(3)]):
                for (i0, j0), (i1, j1) in zip(path, path[1:]):
                    try:
                        bm.faces.new((front_[i0][j0], front_[i1][j1], back_[i1][j1], back_[i0][j0]))
                    except ValueError:
                        pass
        for f in bm.faces:   # band, slide and hems: plain colour A
            for lp in f.loops:
                if not lp[uv].uv.length:
                    lp[uv].uv = PLAIN_UV
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        img = _cloth_image()
        return self.finish(bm, 'neckerchief', [_material('bandana', (1, 1, 1), 0.85, image=img),
                                               _material('tag', (0.86, 0.6, 0.2), 0.35, 0.8)])

    # ------------------------------------------------------------ bandana
    def bandana(self):
        """Thick cloth: a rolled band round the neck, a knot at the back, and a triangle that
        hangs in front of the chest (falls down, pushed out of the body, never stuck to it)."""
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new('UVMap')
        band = min(max(0.5 * self.radius, 0.03), 0.055)
        thick = min(max(0.14 * self.radius, 0.012), 0.02)
        prof = [(0.004 + thick * (0.5 + 0.5 * math.cos(a)), 0.5 * band * math.sin(a)) for a in np.linspace(-math.pi / 2, math.pi / 2, 4)]
        prof = [(0.003, -0.45 * band)] + prof + [(0.003, 0.45 * band)]
        band_faces, rows = self.tube(bm, prof, segs=18)
        for f in band_faces:
            for lp in f.loops:
                lp[uv].uv = PLAIN_UV
        # knot at the back of the neck
        k = SEGS // 2
        back = self.c + self.dir(math.pi) * (self.r[k] + 0.004 + thick)
        out = self.dir(math.pi)
        kr = 0.7 * band
        for sgn in (-1, 1):
            f0 = len(bm.faces)
            self.puck(bm, back + out * kr * 0.25 + self.s * sgn * kr * 0.55, out, self.axis, kr * 0.6, kr * 0.45, 7)
        self.puck(bm, back + out * kr * 0.35, out, self.axis, kr * 0.45, kr * 0.6, 7)
        for f in bm.faces:
            for lp in f.loops:
                if not lp[uv].uv.length:
                    lp[uv].uv = PLAIN_UV
        # the triangle: a wide, soft panel draped over the chest. Sized from the chest (not the
        # neck, which on slim dogs left a sliver): its top spans most of the chest's width,
        # it hangs about as deep as it is wide, with a rounded tip, and it is laid onto the
        # body by casting rays back from in front of it, standing just off the fur.
        fwd = self.dir(0)
        side = self.s
        down = (Vector((0, 0, -1)) - fwd * fwd.dot(Vector((0, 0, -1)))).normalized()
        top = self.c - self.axis * (0.1 * band) + fwd * (self.r[0] + 0.004 + thick)
        # chest half-width just below the collar: rays out sideways from inside the body
        probe = top - fwd * (self.r[0] + 0.02) + down * 0.04
        widths = [(hit - probe).length for d in (side, -side)
                  for hit in [self.bvh.ray_cast(probe, d, 1.0)[0]] if hit is not None]
        hw = min(max(0.9 * (sum(widths) / len(widths) if widths else 0.12), 0.115), 0.2)   # slim chests still get a real bandana
        depth = 1.3 * hw
        N, M = 6, 10
        grid = []
        for i in range(N + 1):
            a_ = i / N
            # width down the panel: straight sides into a rounded tip
            w = hw * (1 - a_) if a_ < 0.75 else hw * 0.25 * math.sqrt(max(0.0, 1 - ((a_ - 0.75) / 0.25) ** 2))
            row = []
            for j in range(M + 1):
                b_ = (j / M - 0.5) * 2
                p = top + side * (b_ * w) + down * (depth * a_)
                # lay it on the body: from in front, back along -fwd, onto the fur, plus a gap
                hit, n, *_ = self.bvh.ray_cast(p + fwd * 0.4, -fwd, 0.8)
                gap = 0.012 + 0.01 * a_
                if hit is not None and (hit - p).dot(fwd) > -0.12:   # thick ruffs: sit on the fur, not inside it
                    p = hit + fwd * gap
                else:   # past the chest: hang a little forward
                    p = p + fwd * (gap + 0.02 * a_)
                row.append((p, (0.5 + 0.5 * b_ * (w / hw if hw else 0), 0.1 + 0.85 * a_)))
            grid.append(row)
        # smooth the sheet so the drape is soft, not lumpy
        P = [[Vector(q[0]) for q in row] for row in grid]
        for _ in range(3):
            Q = [[v.copy() for v in row] for row in P]
            for i in range(1, N):
                for j in range(1, M):
                    Q[i][j] = (P[i][j] * 4 + P[i - 1][j] + P[i + 1][j] + P[i][j - 1] + P[i][j + 1]) / 8
            P = Q
        # puff: the middle of the cloth bulges out a little (it's a padded toy bandana)
        for i in range(1, N):
            for j in range(1, M):
                e = min(i / N, (N - i) / N, j / M, (M - j) / M) * 2
                P[i][j] = P[i][j] + fwd * (0.35 * thick * min(1.0, e * 2))
        thick = thick * 1.4
        # thickness: a front sheet, a back sheet and a rolled hem joining them
        normals = []
        for i in range(N + 1):
            nrow = []
            for j in range(M + 1):
                du = P[i][min(j + 1, M)] - P[i][max(j - 1, 0)]
                dv = P[min(i + 1, N)][j] - P[max(i - 1, 0)][j]
                nn = du.cross(dv)
                if nn.length < 1e-9:
                    nn = self.dir(0)
                nn.normalize()
                if nn.dot(self.dir(0)) < 0:
                    nn = -nn
                nrow.append(nn)
            normals.append(nrow)
        front = [[bm.verts.new(P[i][j] + normals[i][j] * thick * 0.5) for j in range(M + 1)] for i in range(N + 1)]
        backv = [[bm.verts.new(P[i][j] - normals[i][j] * thick * 0.5) for j in range(M + 1)] for i in range(N + 1)]
        for sheet, flip in ((front, False), (backv, True)):
            for i in range(N):
                for j in range(M):
                    q = (sheet[i][j], sheet[i][j + 1], sheet[i + 1][j + 1], sheet[i + 1][j])
                    uvs = (grid[i][j][1], grid[i][j + 1][1], grid[i + 1][j + 1][1], grid[i + 1][j][1])
                    if flip:
                        q, uvs = q[::-1], uvs[::-1]
                    f = bm.faces.new(q)
                    for lp, t in zip(f.loops, uvs):
                        lp[uv].uv = t
        # hem along the two slanted edges and the top
        edge = [(i, 0) for i in range(N + 1)] + [(N - i, M) for i in range(N + 1)]
        for path in ([(i, 0) for i in range(N + 1)], [(i, M) for i in range(N + 1)], [(0, j) for j in range(M + 1)]):
            for (i0, j0), (i1, j1) in zip(path, path[1:]):
                q = (front[i0][j0], front[i1][j1], backv[i1][j1], backv[i0][j0])
                try:
                    f = bm.faces.new(q)
                except ValueError:
                    continue
                for lp in f.loops:
                    lp[uv].uv = grid[i0][j0][1]
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        img = _cloth_image()
        return self.finish(bm, 'bandana', [_material('bandana', (1, 1, 1), 0.85, image=img)])


def export_wear(arm_obj, ob, path):
    bpy.ops.object.select_all(action='DESELECT')
    arm_obj.select_set(True)
    ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_animations=False,
                              export_def_bones=False, export_extras=False, export_image_format='JPEG')
