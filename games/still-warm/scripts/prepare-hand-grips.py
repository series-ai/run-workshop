"""Add grip shape keys to copies of the two provider pickup clips.

Run with Blender --background --python scripts/prepare-hand-grips.py.
The source GLBs stay unchanged. Coordinates below use each wrist's bind space.
"""
from pathlib import Path
import json
import math
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source-assets/assembled/animations/expanded'
OUTPUT = ROOT / 'source-assets/assembled/hand-grips'
# Seconds in the original clips: open, close, hold, release.
TIMINGS = {
    276: {'Right': (1.30, 1.70, 5.20, 5.85)},
    284: {'Right': (1.20, 1.65, 3.25, 3.75), 'Left': (2.80, 3.35, 4.30, 4.80)},
}


def smooth(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def closed_hand(point):
    x, y, z = point
    length = max(0.0, y - 12.0)
    curvature = 0.22
    angle = min(length * curvature, 2.8)
    if length:
        curled = Vector((
            x * (1.0 - 0.1 * smooth(length / 10.0)),
            12.0 + math.sin(angle) / curvature - z * math.sin(angle),
            (1.0 - math.cos(angle)) / curvature + z * math.cos(angle),
        ))
    else:
        curled = point.copy()
    thumb = smooth((x - 3.0) / 5.0) * smooth((20.0 - y) / 4.0)
    pivot = Vector((4.0, 7.0, 0.0))
    thumb_pose = pivot + Matrix.Rotation(0.7, 3, 'Z') @ Matrix.Rotation(-0.6, 3, 'Y') @ (point - pivot)
    return curled.lerp(thumb_pose, thumb * smooth((y - 4.0) / 6.0))


def add_grip(mesh, armature, side):
    group = mesh.vertex_groups[side + 'Hand'].index
    wrist = armature.data.bones[side + 'Hand']
    to_hand = wrist.matrix_local.inverted() @ armature.matrix_world.inverted() @ mesh.matrix_world
    to_mesh = to_hand.inverted()
    shape = mesh.shape_key_add(name=side + 'Grip')
    mirror = 1.0 if side == 'Right' else -1.0
    changed = 0
    for vertex in mesh.data.vertices:
        weight = next((group_ref.weight for group_ref in vertex.groups if group_ref.group == group), 0.0)
        if weight < 0.01:
            continue
        point = to_hand @ vertex.co
        point.x *= mirror
        posed = closed_hand(point)
        posed.x *= mirror
        shape.data[vertex.index].co = vertex.co.lerp(to_mesh @ posed, weight)
        if (shape.data[vertex.index].co - vertex.co).length > 0.00001:
            changed += 1
    return shape, changed


def amount(time, timing):
    start, close, hold, release = timing
    return smooth((time - start) / (close - start)) * (1.0 - smooth((time - hold) / (release - hold)))


def build(action_id, hands):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 30
    bpy.ops.import_scene.gltf(filepath=str(SOURCE / f'anim_{action_id}.glb'))
    armature = next(obj for obj in scene.objects if obj.type == 'ARMATURE')
    mesh = next(obj for obj in scene.objects if obj.type == 'MESH')
    original_action = armature.animation_data.action
    end = round(original_action.frame_range[1])
    scene.frame_start = 0
    scene.frame_end = end
    scene.name = original_action.name
    mesh.shape_key_add(name='Basis')
    counts = {}
    for side, timing in hands.items():
        shape, counts[side] = add_grip(mesh, armature, side)
        for frame in range(end + 1):
            shape.value = amount(frame / 30.0, timing)
            shape.keyframe_insert(data_path='value', frame=frame)
    scene.frame_set(0)
    filepath = OUTPUT / f'anim_{action_id}_grip.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(filepath), export_format='GLB',
        export_animation_mode='SCENE', export_anim_scene_split_object=False,
        export_frame_range=True, export_frame_step=1,
        export_animations=True, export_morph=True, export_morph_animation=True,
        export_skins=True, export_morph_normal=True,
        export_draco_mesh_compression_enable=True,
    )
    return {'actionId': action_id, 'source': f'../animations/expanded/anim_{action_id}.glb',
            'output': filepath.name, 'duration': end / 30.0, 'changedVertices': counts,
            'timings': hands, 'bytes': filepath.stat().st_size}


OUTPUT.mkdir(parents=True, exist_ok=True)
records = [build(action_id, hands) for action_id, hands in TIMINGS.items()]
(OUTPUT / 'build.json').write_text(json.dumps(records, indent=2) + '\n')
print(json.dumps(records, indent=2))
