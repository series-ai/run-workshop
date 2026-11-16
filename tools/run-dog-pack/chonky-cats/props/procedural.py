"""Procedural cat props, for simple geometric toys Hunyuan3D mangled (a half ring for the hair tie,
a crumpled blob for the springs, a noisy ball track): models/<slug>.glb + previews/<slug>.png.

blender -b -t 1 --factory-startup -P procedural.py -- [slug ...]     (default: all of them)

Same conventions as ../../chunky-toy/optimize.py output: centred, standing on z = 0, sized to
the height in props.csv, chunky rounded shapes with flat matte colours (no texture).
"""
import csv
import math
import os
import sys

import bpy

here = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
heights = {r['slug']: float(r['height']) for r in csv.DictReader(open(os.path.join(here, 'props.csv')))}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, hexcol, rough=0.7):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    rgb = tuple(((int(hexcol[i:i + 2], 16) / 255 + 0.055) / 1.055) ** 2.4 for i in (1, 3, 5))
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    m.diffuse_color = (*rgb, 1)   # the viewport / preview colour
    return m


def smooth(ob):
    for p in ob.data.polygons:
        p.use_smooth = True


def torus(major, minor, mat_, loc=(0, 0, 0), rot=(0, 0, 0), maj_seg=32, min_seg=12):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=maj_seg,
                                     minor_segments=min_seg, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.data.materials.append(mat_)
    smooth(ob)
    return ob


def sphere(r, mat_, loc):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=8, ring_count=5, location=loc)
    ob = bpy.context.object
    ob.data.materials.append(mat_)
    smooth(ob)
    return ob


def cylinder(r, depth, mat_, loc, verts=24):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=loc)
    ob = bpy.context.object
    ob.data.materials.append(mat_)
    bev = ob.modifiers.new('bevel', 'BEVEL')
    bev.width, bev.segments = min(r, depth) * 0.25, 1
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier='bevel')
    smooth(ob)
    return ob


def coil(mat_, loc, turns=4, radius=0.18, pitch=0.14, wire=0.05, axis_rot=(0, math.pi / 2, 0)):
    """A chunky plastic spring: a curve swept with a round profile, lying on its side."""
    cu = bpy.data.curves.new('coil', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = wire
    cu.bevel_resolution = 0   # a 4-sided profile, smooth-shaded: reads round at this size
    sp = cu.splines.new('POLY')
    n = turns * 8
    sp.points.add(n)
    for i in range(n + 1):
        a = 2 * math.pi * turns * i / n
        sp.points[i].co = (radius * math.cos(a), radius * math.sin(a), pitch * turns * (i / n - 0.5), 1)
    ob = bpy.data.objects.new('coil', cu)
    bpy.context.scene.collection.objects.link(ob)
    ob.location, ob.rotation_euler = loc, axis_rot
    ob.data.materials.append(mat_)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    smooth(ob)
    return ob


def hair_tie():
    torus(0.5, 0.17, mat('band', '#1f1f22', 0.5), maj_seg=24, min_seg=8)


def spring_toys():
    for (x, y, rz), col in zip(((-0.42, 0.1, 0.2), (0.0, -0.25, -0.5), (0.4, 0.2, 0.9)), ('#5bbf4f', '#ef7fb2', '#9a6fe0')):
        ob = coil(mat('spring', col, 0.45), (x, y, 0.23))
        ob.rotation_euler[2] = rz


def ball_track():
    white = mat('plastic', '#f4f2ee', 0.5)
    for k, (r, z) in enumerate(((0.95, 0.0), (0.78, 0.42), (0.6, 0.84))):
        # each level: a flat base disc and a round-section ring track on top of it
        cylinder(r * 1.05, 0.12, white, (0, 0, z + 0.06), verts=20)
        torus(r * 0.82, 0.13, white, loc=(0, 0, z + 0.2), maj_seg=24, min_seg=6)
        for j, col in enumerate(('#e2453c', '#3b7de0', '#4cc35a')[: 2 if k else 3]):
            a = 2 * math.pi * (j / 3 + 0.17 * k)
            sphere(0.15, mat('ball', col, 0.35), (r * 0.82 * math.cos(a), r * 0.82 * math.sin(a), z + 0.3))
    cylinder(0.32, 0.2, white, (0, 0, 1.12), verts=16)   # the cap on top


def lumpy(ob, amount, seed):
    """Push vertices in and out a little so a primitive reads as organic."""
    import random
    rnd = random.Random(seed)
    for v in ob.data.vertices:
        v.co *= 1 + rnd.uniform(-amount, amount)


def cat_poop():
    """Two little cartoon logs, slightly bent, one resting against the other."""
    brown = mat('poop', '#6b4426', 0.55)
    for k, (x, y, rz, L) in enumerate(((0.0, 0.0, 0.3, 1.0), (0.42, 0.28, -0.9, 0.75))):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, segments=12, ring_count=7, location=(x, y, 0.22 - 0.03 * k))
        ob = bpy.context.object
        ob.scale = (0.42 * L * 2.2, 0.42, 0.36)
        ob.rotation_euler = (0, 0.12 * (1 - 2 * k), rz)
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        lumpy(ob, 0.06, k)
        ob.data.materials.append(brown)
        smooth(ob)


def litter_clump():
    grey = mat('clump', '#9a9590', 0.95)
    for k, (x, y, r) in enumerate(((0, 0, 0.5), (0.35, 0.12, 0.36), (-0.3, 0.18, 0.32), (0.05, -0.3, 0.3))):
        bpy.ops.mesh.primitive_ico_sphere_add(radius=r, subdivisions=2, location=(x, y, r * 0.55))
        ob = bpy.context.object
        ob.scale.z = 0.7
        bpy.ops.object.transform_apply(scale=True)
        lumpy(ob, 0.12, 10 + k)
        ob.data.materials.append(grey)
        smooth(ob)


def pee_spot():
    """A flat wobbly puddle: a disc with a noisy rim, see-through yellow (alpha blend)."""
    import random
    rnd = random.Random(3)
    m = mat('pee', '#e8c84a', 0.08)
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Alpha'].default_value = 0.55
    n = 28
    harm = [(rnd.uniform(0, 6.28), rnd.uniform(0.05, 0.14), f) for f in (2, 3, 5)]
    verts = [(0, 0, 0.05)]
    for i in range(n):
        a = 2 * math.pi * i / n
        r = 1 + sum(h * math.sin(f * a + p) for p, h, f in harm)
        verts.append((r * math.cos(a), 0.8 * r * math.sin(a), 0.0))
    faces = [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)]
    me = bpy.data.meshes.new('pee')
    me.from_pydata(verts, [], faces)
    ob = bpy.data.objects.new('pee', me)
    bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(m)
    smooth(ob)


def mushroom_tree():
    """One big mushroom cat tree: a wide round grass base, a tall cream stem with a band of rope to
    scratch, and a domed red cap with big white spots whose top is a shallow dish a cat can lie in.
    Proportions in units of the total height (1.2): the cap is 1.0 across, wide enough for the
    biggest cat curled up."""
    from mathutils import Vector
    red, white, cream, rope, grass = (mat('cap', '#d8463c', 0.6), mat('spots', '#f6f2ea', 0.6),
                                       mat('stem', '#efe4cc', 0.7), mat('rope', '#c9a877', 0.9),
                                       mat('grass', '#6cb24a', 0.8))
    cylinder(0.55, 0.08, grass, (0, 0, 0.04), verts=28)                   # base
    bpy.ops.mesh.primitive_cone_add(radius1=0.2, radius2=0.14, depth=0.84, vertices=16, location=(0, 0, 0.5))
    stem = bpy.context.object                                              # stem, flared at the foot
    stem.data.materials.append(cream)
    smooth(stem)
    for k in range(6):                                                     # a band of rope to scratch
        torus(0.175 - 0.008 * k, 0.045, rope, loc=(0, 0, 0.26 + 0.075 * k), maj_seg=12, min_seg=4)
    # the cap: a domed half-ellipsoid with a rolled rim, its top flattened into a shallow dish
    RX, RZ, CZ = 0.5, 0.3, 0.86
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=20, ring_count=10, location=(0, 0, CZ))
    cap = bpy.context.object
    cap.scale = (RX, RX, RZ)
    bpy.ops.object.transform_apply(scale=True)
    top = CZ + 0.78 * RZ
    for v in cap.data.vertices:
        if v.co.z < CZ - 0.25 * RZ:                                        # underside: tucked up flat
            v.co.z = CZ - 0.25 * RZ
        if v.co.z > top:                                                   # a shallow dish on top
            r = math.hypot(v.co.x, v.co.y)
            v.co.z = top - 0.04 * (1 - r / (RX * 0.62))
    cap.data.materials.append(red)
    smooth(cap)
    def spot(e, a, r):                                                     # a flat white disc on the cap
        n = Vector((math.cos(e) * math.cos(a) / RX, math.cos(e) * math.sin(a) / RX, math.sin(e) / RZ)).normalized()
        p = Vector((RX * math.cos(e) * math.cos(a), RX * math.cos(e) * math.sin(a), CZ + RZ * math.sin(e)))
        # a shallow dome sunk into the cap (flat discs stuck out like tabs at the rim)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=10, ring_count=5, location=p - n * 0.2 * r)
        ob = bpy.context.object
        ob.scale.z = 0.3
        ob.rotation_euler = n.to_track_quat('Z', 'Y').to_euler()
        ob.data.materials.append(white)
        smooth(ob)
    for k in range(8):
        spot(math.radians(18 + 14 * (k % 2)), 2 * math.pi * k / 8 + 0.2 * (k % 2), 0.1 - 0.02 * (k % 2))
    for k, (e, a) in enumerate(((50, 0.4), (52, 2.5), (48, 4.4))):
        spot(math.radians(e), a, 0.07)


def bottle_cap():
    """A plastic bottle cap lying open side down: a short cylinder with a ridged side."""
    red = mat('cap', '#d63a2f', 0.4)
    cylinder(0.5, 0.42, red, (0, 0, 0.21), verts=24)
    for k in range(18):                                                    # grip ridges round the side
        a = 2 * math.pi * k / 18
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.49 * math.cos(a), 0.49 * math.sin(a), 0.2), rotation=(0, 0, a))
        ob = bpy.context.object
        ob.scale = (0.035, 0.05, 0.3)   # shallow: a grip, not teeth
        ob.data.materials.append(red)


BUILD = {'bottle-cap': bottle_cap, 'mushroom-tree': mushroom_tree, 'hair-tie': hair_tie, 'spring-toys': spring_toys, 'ball-track': ball_track,
         'cat-poop': cat_poop, 'litter-clump': litter_clump, 'pee-spot': pee_spot}


def finish(slug):
    """Join, sit on the floor, scale to the props.csv height, export and preview."""
    obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    ob = bpy.context.object
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    zs = [v.co.z for v in ob.data.vertices]
    xs = [v.co.x for v in ob.data.vertices]
    ys = [v.co.y for v in ob.data.vertices]
    s = heights[slug] / (max(zs) - min(zs))
    for v in ob.data.vertices:
        v.co.x = (v.co.x - (min(xs) + max(xs)) / 2) * s
        v.co.y = (v.co.y - (min(ys) + max(ys)) / 2) * s
        v.co.z = (v.co.z - min(zs)) * s
    ob.name = slug
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    bpy.ops.export_scene.gltf(filepath=os.path.join(here, 'models', slug + '.glb'), export_format='GLB')
    # preview, framed on the object
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.color_type = 'MATERIAL'
    scene.render.resolution_x = scene.render.resolution_y = 512
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.type = 'ORTHO'
    size = max(max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)) * s
    cam.data.ortho_scale = size * 1.8
    from mathutils import Vector
    centre = Vector((0, 0, heights[slug] / 2))
    cam.location = centre + Vector((1.0, -1.2, 0.9)).normalized() * size * 4
    cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(here, 'previews', slug + '.png')
    bpy.ops.render.render(write_still=True)
    print('PROCEDURAL', slug, tris, 'tris')


for slug in (args or list(BUILD)):
    reset()
    BUILD[slug]()
    finish(slug)
