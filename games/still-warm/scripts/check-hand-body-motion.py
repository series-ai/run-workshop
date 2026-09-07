"""Compare body transforms in the source and hand-grip GLBs.

Run with Blender --background --python-exit-code 1 --python this-file.py.
"""
from pathlib import Path
import json
import bpy

ROOT = Path(__file__).resolve().parents[1]


def sample(file):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 30
    bpy.ops.import_scene.gltf(filepath=str(file))
    armature = next(obj for obj in scene.objects if obj.type == 'ARMATURE')
    end = round(armature.animation_data.action.frame_range[1])
    rows = []
    for frame in range(0, end + 1, 5):
        scene.frame_set(frame)
        rows.append({bone.name: armature.matrix_world @ bone.matrix for bone in armature.pose.bones})
    return rows


results = []
for action_id in (276, 284):
    original = sample(ROOT / f'source-assets/assembled/animations/expanded/anim_{action_id}.glb')
    grip = sample(ROOT / f'source-assets/assembled/hand-grips/anim_{action_id}_grip.glb')
    position_error = 0.0
    angle_error = 0.0
    assert len(original) == len(grip)
    for source_frame, grip_frame in zip(original, grip):
        assert set(source_frame) == set(grip_frame)
        for bone in source_frame:
            source_matrix = source_frame[bone]
            grip_matrix = grip_frame[bone]
            position_error = max(position_error, (source_matrix.translation - grip_matrix.translation).length)
            angle_error = max(angle_error, source_matrix.to_quaternion().rotation_difference(grip_matrix.to_quaternion()).angle)
    assert position_error < 0.001, f'{action_id}: body translation changed'
    assert angle_error < 0.005, f'{action_id}: body rotation changed'
    results.append({
        'actionId': action_id,
        'maxBonePositionErrorMeters': position_error,
        'maxBoneAngleErrorRadians': angle_error,
        'framesChecked': len(original),
    })
output = ROOT / 'source-assets/assembled/hand-grips/verification.json'
output.write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps(results, indent=2))
