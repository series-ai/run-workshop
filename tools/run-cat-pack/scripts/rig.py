"""Shared dog skeleton and skinning (run inside Blender, used by build_dog.py).

Every build gets the same bones with the same names and the same local axes,
so one animation clip plays on every breed:

    root
     └ spine (loin → ribs)
        ├ pelvis (loin → rump) ─ thigh.L/R ─ shin ─ hock ─ hind_paw
        │                       └ tail
        └ chest (ribs → front of chest) ─ upperarm.L/R ─ forearm ─ wrist ─ paw
           └ neck (base of neck → top of neck) ─ head

All bones lie in a plane parallel to XZ and are rolled so their local X axis
points to the dog's right (-Y). That makes "pitch" (nodding, bending a leg
forward/back) a rotation about local X on every bone; local Z bends sideways.
"""
import bpy
from mathutils import Vector, kdtree

SIDE = Vector((0, 1, 0))


def build_armature(bones):
    """bones: list of (name, head, tail, parent) in dog space. Returns the armature object."""
    arm_data = bpy.data.armatures.new('rig')
    arm = bpy.data.objects.new('rig', arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones
    for name, head, tail, parent in bones:
        b = eb.new(name)
        b.head, b.tail = Vector(head), Vector(tail)
        d = (b.tail - b.head).normalized()
        z = d.cross(SIDE)
        if z.length < 1e-4:          # bone pointing sideways (shouldn't happen)
            z = Vector((0, 0, 1))
        b.align_roll(z.normalized())
        if parent:
            b.parent = eb[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def skin(obj, arm, weights):
    """weights: {vertex_index: {bone: weight}}. Adds vertex groups and an armature modifier."""
    groups = {}
    for vi, bw in weights.items():
        total = sum(bw.values()) or 1.0
        for bone, w in bw.items():
            if bone not in groups:
                groups[bone] = obj.vertex_groups.new(name=bone)
            groups[bone].add([vi], w / total, 'REPLACE')
    attach(obj, arm)


def attach(obj, arm):
    mod = obj.modifiers.new('rig', 'ARMATURE')
    mod.object = arm
    obj.parent = arm


def copy_weights(target, source):
    """Give each vertex of `target` (a coat shell) the weights of the nearest `source` vertex."""
    src = source.data
    kd = kdtree.KDTree(len(src.vertices))
    for v in src.vertices:
        kd.insert(v.co, v.index)
    kd.balance()
    names = {g.index: g.name for g in source.vertex_groups}
    groups = {}
    for v in target.data.vertices:
        _, i, _ = kd.find(v.co)
        for g in src.vertices[i].groups:
            n = names[g.group]
            if n not in groups:
                groups[n] = target.vertex_groups.new(name=n)
            groups[n].add([v.index], g.weight, 'REPLACE')


def parent_to_bone(obj, arm, bone):
    """Parent an empty to a bone, keeping its world transform."""
    world = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    bpy.context.view_layer.update()
    obj.matrix_world = world


def segment_weights(p, segments, k=2, power=4):
    """Inverse-distance weights of point p to the k nearest bone segments."""
    def dist(a, b):
        ab = b - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
        return (a + ab * t - p).length
    ds = sorted((dist(Vector(a), Vector(b)), n) for n, a, b in segments)[:k]
    w = {n: 1.0 / (d + 1e-3) ** power for d, n in ds}
    s = sum(w.values())
    return {n: x / s for n, x in w.items()}
