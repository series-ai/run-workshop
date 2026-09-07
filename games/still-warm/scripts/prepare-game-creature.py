"""Combine the reviewed clips on one mesh with hand and mouth shape keys."""
from pathlib import Path
import importlib.util
import json
import bpy

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source-assets/assembled'
OUTPUT = ROOT / 'public/assets/creature.glb'
spec = importlib.util.spec_from_file_location('grips', Path(__file__).with_name('prepare-hand-grips.py'))
grips = importlib.util.module_from_spec(spec)
spec.loader.exec_module(grips)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
bpy.ops.import_scene.gltf(filepath=str(SOURCE / 'scream-mouth/anim_386_mouth.glb'))
rig = next(obj for obj in scene.objects if obj.type == 'ARMATURE')
mesh = next(obj for obj in scene.objects if obj.type == 'MESH' and obj.data.shape_keys)
rig.animation_data_clear()
mesh.data.shape_keys.animation_data_clear()
for shape in mesh.data.shape_keys.key_blocks:
    shape.value = 0
for side in ('Right', 'Left'):
    grips.add_grip(mesh, rig, side)
original_objects = set(scene.objects)
rig.animation_data_create()
keys = mesh.data.shape_keys

clips = {'idle': SOURCE / 'animations/anim_idle.glb'}
for name, action_id in [('walk',112), ('pickup',276), ('collect',284), ('push',262),
                        ('kneel',365), ('scream',386), ('left',576), ('right',586)]:
    clips[name] = SOURCE / f'animations/expanded/anim_{action_id}.glb'
records = []
for name, path in clips.items():
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = set(scene.objects) - original_objects
    source_rig = next(obj for obj in imported if obj.type == 'ARMATURE')
    source_action = source_rig.animation_data.action
    end = round(source_action.frame_range[1])
    # Export changes bone-local rest transforms. Transfer world poses.
    # Local curves from another rig can turn the limbs in the wrong direction.
    for old_track in rig.animation_data.nla_tracks:
        old_track.mute = True
    rig.animation_data.action = None
    for frame in range(end + 1):
        scene.frame_set(frame)
        poses = {bone.name: source_rig.matrix_world @ bone.matrix.copy()
                 for bone in source_rig.pose.bones}
        for bone in rig.pose.bones:
            bone.matrix = rig.matrix_world.inverted() @ poses[bone.name]
            bone.rotation_mode = 'QUATERNION'
            bone.keyframe_insert(data_path='location', frame=frame)
            bone.keyframe_insert(data_path='rotation_quaternion', frame=frame)
            bone.keyframe_insert(data_path='scale', frame=frame)
            bpy.context.view_layer.update()
    action = rig.animation_data.action
    action.name = name
    rig.animation_data.action = None
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 0, action)
    strip.action_slot = action.slots[0]
    track.mute = True
    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)

    # All clips key every shape. This prevents a grip or scream from surviving a blend.
    keys.animation_data_create()
    keys.animation_data.action = None
    for frame in range(end + 1):
        time = frame / 30.0
        for shape in list(keys.key_blocks)[1:]:
            value = 0.0
            if shape.name == 'ScreamOpen' and name == 'scream':
                value = grips.smooth((time - .30) / .35) * (1 - grips.smooth((time - 2.05) / .52))
            action_id = {'pickup': 276, 'collect': 284}.get(name)
            side = shape.name.removesuffix('Grip')
            if action_id and side in grips.TIMINGS[action_id]:
                value = grips.amount(time, grips.TIMINGS[action_id][side])
            shape.value = value
            shape.keyframe_insert(data_path='value', frame=frame)
    shape_action = keys.animation_data.action
    shape_action.name = name + '_face_hands'
    keys.animation_data.action = None
    shape_track = keys.animation_data.nla_tracks.new()
    shape_track.name = name
    shape_strip = shape_track.strips.new(name, 0, shape_action)
    shape_strip.action_slot = shape_action.slots[0]
    records.append({'name': name, 'source': str(path.relative_to(ROOT)), 'duration': end / 30})

for track in rig.animation_data.nla_tracks:
    track.mute = False
scene.frame_set(0)
bpy.ops.object.select_all(action='DESELECT')
for obj in original_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='NLA_TRACKS',
    export_morph=True, export_morph_animation=True, export_skins=True,
    export_image_format='JPEG', export_image_quality=90,
    export_draco_mesh_compression_enable=True,
)
(OUTPUT.with_suffix('.json')).write_text(json.dumps({'clips': records, 'bytes': OUTPUT.stat().st_size}, indent=2) + '\n')
print('CREATURE_BUILD', json.dumps(records))
