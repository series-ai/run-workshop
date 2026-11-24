"""Render the published GLB and preview actors from the authored camera stops."""

import argparse
import json
import math
import sys
from bisect import bisect_right
from pathlib import Path

import bpy
from mathutils import Quaternion

sys.path.insert(0, str(Path(__file__).resolve().parent))

from level_finish_glb import GRAIN_SIZE
from level_scene_glb import linear_color


def keep_grain_sharp():
    # The Blender importer uses the minification filter for both directions.
    for material in bpy.data.materials:
        if not material.node_tree:
            continue
        for node in material.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image and tuple(node.image.size) == (GRAIN_SIZE, GRAIN_SIZE):
                node.interpolation = 'Closest'


def make_world(profile):
    world = bpy.data.worlds.new('Cubix sky')
    world.use_nodes = True
    nodes = world.node_tree.nodes
    link = world.node_tree.links.new
    output = nodes['World Output']
    diffuse = nodes['Background']
    diffuse.inputs['Color'].default_value = [*linear_color(profile['skyFill']), 1]
    diffuse.inputs['Strength'].default_value = profile['fillIntensity'] * 0.48

    coords = nodes.new('ShaderNodeTexCoord')
    axis = nodes.new('ShaderNodeSeparateXYZ')
    link(coords.outputs['Normal'], axis.inputs['Vector'])
    sky = nodes.new('ShaderNodeValToRGB')
    altitude = axis.outputs['Z']
    if gradient_top := profile.get('reviewSkyGradientTop'):
        upward = nodes.new('ShaderNodeMath')
        upward.operation = 'MULTIPLY'
        upward.inputs[1].default_value = -1
        link(altitude, upward.inputs[0])
        altitude = upward.outputs[0]
        sky.color_ramp.elements[0].position = 0.0
        sky.color_ramp.elements[1].position = gradient_top
    else:
        sky.color_ramp.elements[0].position = 0.06
        sky.color_ramp.elements[1].position = 0.72
    sky.color_ramp.elements[0].color = [*linear_color(profile['horizon']), 1]
    sky.color_ramp.elements[1].color = [*linear_color(profile['zenith']), 1]
    link(altitude, sky.inputs['Fac'])
    backdrop = nodes.new('ShaderNodeBackground')
    link(sky.outputs['Color'], backdrop.inputs['Color'])

    ray = nodes.new('ShaderNodeLightPath')
    mix = nodes.new('ShaderNodeMixShader')
    link(ray.outputs['Is Camera Ray'], mix.inputs[0])
    link(diffuse.outputs[0], mix.inputs[1])
    link(backdrop.outputs[0], mix.inputs[2])
    link(mix.outputs[0], output.inputs['Surface'])
    return world


def sample_rotation(track, seconds):
    times = track['times']
    sample = min(seconds, times[-1])
    end = bisect_right(times, sample, lo=1, hi=len(times) - 1)
    fraction = (sample - times[end - 1]) / (times[end] - times[end - 1])
    before, after = (Quaternion((w, x, -z, y))
                     for x, y, z, w in track['values'][end - 1:end + 1])
    return before.slerp(after, fraction)


def apply_actor_rotations(objects, armature, rotations):
    if armature is not None:
        armature.animation_data_clear()
        for name, rotation in rotations.items():
            bone = armature.pose.bones[name]
            basis = bone.bone.matrix_local.to_quaternion()
            bone.rotation_mode = 'QUATERNION'
            bone.rotation_quaternion = basis.inverted() @ rotation @ basis
        return
    parts = {obj.name.split('.')[0]: obj for obj in objects}
    for name, rotation in rotations.items():
        part = parts[name]
        part.animation_data_clear()
        part.rotation_mode = 'QUATERNION'
        part.rotation_quaternion = rotation


def place_actor(folder, asset, position, yaw, *, pose=None):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(folder / asset['files']['motion']))
    objects = set(bpy.data.objects) - before
    armature = next((obj for obj in objects if obj.type == 'ARMATURE'), None)
    root = armature if armature is not None else next(obj for obj in objects if obj.parent is None)
    x, y, z = position
    root.location = (x, -z, y)
    root.rotation_mode = 'XYZ'
    root.rotation_euler.z = math.radians(yaw)
    if pose is not None:
        raw = json.loads((folder / asset['files']['voxels']).read_bytes())
        rotations = {track['part']: sample_rotation(track, pose['seconds'])
                     for track in raw['clips'][pose['clip']]}
        apply_actor_rotations(objects, armature, rotations)
    elif asset['role'] == 'infected':
        reach = {'left_shoulder': -0.62, 'right_shoulder': -1.12,
                 'left_elbow': -0.32, 'head': 0.19}
        apply_actor_rotations(objects, armature,
                              {name: Quaternion((1, 0, 0), angle) for name, angle in reach.items()})


def spawn_actors(folder, board):
    staged = set()
    for anchor in board.get('ambientActors', []):
        actor_id = anchor['asset']
        place_actor(folder, board['assets'][actor_id], anchor['position'], anchor['yaw'],
                    pose=anchor.get('pose'))
        staged.add(actor_id)
    spawned = set()
    for point in board['points']:
        actor_ids = list(dict.fromkeys(asset for action in point['actions'] for asset in action['assets']
                                      if asset in board['actors'] and asset not in staged))
        for index, actor_id in enumerate(actor_ids):
            if actor_id in spawned and len(actor_ids) == 1:
                continue
            spawned.add(actor_id)
            x, y, z = point['position']
            offset = (index - (len(actor_ids) - 1) / 2) * 1.2
            place_actor(folder, board['assets'][actor_id], (x + offset, y, z), -28 + index * 22)


def set_review_lighting(scene, profile):
    scene.world = make_world(profile)
    for light in bpy.data.lights:
        if light.type == 'SUN':
            # Match the Cubix preview scale after Blender converts glTF sunlight to watts.
            light.energy = 0.45 * profile['sunIntensity']
            light.angle = math.radians(3)
        elif light.type == 'POINT':
            light.shadow_soft_size = 0.12


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--leaf', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--shot', action='append')
    parser.add_argument('--draft', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(args.leaf / 'level-kit/demo.glb'))
    layout = json.loads((args.leaf / 'level-kit/demo.voxels.json').read_bytes())['scene']
    scene = bpy.context.scene
    profile = layout['environment']
    if 'gameplay' in layout:
        spawn_actors(args.leaf, layout['gameplay'])
    keep_grain_sharp()

    set_review_lighting(scene, profile)
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 12 if args.draft else 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1440
    scene.render.resolution_percentage = 67 if args.draft else 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = 0.7
    args.output.mkdir(parents=True, exist_ok=True)
    cameras = [obj for obj in scene.objects if obj.type == 'CAMERA']
    for camera in cameras:
        label = 'Board overview' if camera.name == 'Approach' else camera.name
        if args.shot and label not in args.shot:
            continue
        scene.camera = camera
        scene.render.resolution_y = 960 if label == 'Board overview' else 810
        scene.render.filepath = str(args.output / (label.lower().replace(' ', '-') + '.png'))
        bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
