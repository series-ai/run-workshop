"""Write the level's lights and tour cameras into the demo GLB."""

from collections import defaultdict
from math import floor, radians

import numpy as np

from mathutils import Matrix, Vector


LIGHT_EXTENSION = 'KHR_lights_punctual'
INSTANCE_EXTENSION = 'EXT_mesh_gpu_instancing'
INSTANCE_CELL_METERS = 24
INSTANCED_DEMO = 'level-kit/demo.instanced.glb'
LEVEL_YFOV = radians(54)


def look_rotation(direction):
    forward = Vector(direction)
    if forward.length_squared == 0:
        raise ValueError('An export camera or sun needs a direction.')
    back = -forward.normalized()
    up = Vector((0, 1, 0)) if abs(back.y) < 0.999 else Vector((0, 0, 1))
    right = up.cross(back).normalized()
    up = back.cross(right)
    q = Matrix((right, up, back)).transposed().to_quaternion()
    return [q.x, q.y, q.z, q.w]


def linear_color(hex_color):
    srgb = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]


def append_environment(doc, layout):
    scene = doc['scenes'][doc['scene']]
    profile = layout['environment']
    scene.setdefault('extras', {})['cubixEnvironment'] = profile

    def add_node(**node):
        scene['nodes'].append(len(doc['nodes']))
        doc['nodes'].append(node)

    lights = []
    extensions = doc.setdefault('extensions', {})
    extensions[LIGHT_EXTENSION] = {'lights': lights}
    doc.setdefault('extensionsUsed', []).append(LIGHT_EXTENSION)

    def add_light(name, kind, color, intensity, transform, **properties):
        index = len(lights)
        lights.append({'name': name, 'type': kind, 'color': linear_color(color),
                       'intensity': intensity, **properties})
        add_node(name=name, extensions={LIGHT_EXTENSION: {'light': index}}, **transform)

    add_light('Sun', 'directional', profile['sunColor'], profile['sunIntensity'],
              {'rotation': look_rotation([-axis for axis in profile['sunDirection']])})
    for index, fixture in enumerate(layout['fixtures'], start=1):
        add_light(f'Fixture {index}', 'point', fixture['color'], fixture['intensity'],
                  {'translation': fixture['position']}, range=fixture['distance'])

    view = layout['view']
    tour = [{'label': 'Approach', 'eye': view['eye'], 'target': view['target']}, *view['stops']]
    cameras = []
    doc['cameras'] = cameras
    for index, shot in enumerate(tour):
        cameras.append({'name': shot['label'], 'type': 'perspective',
                        'perspective': {'yfov': LEVEL_YFOV, 'znear': 0.04, 'zfar': view.get('far', 100)}})
        add_node(name=shot['label'], camera=index, translation=shot['eye'],
                 rotation=look_rotation(Vector(shot['target']) - Vector(shot['eye'])))


def write_instanced_scene(builder, path):
    doc = builder.doc
    scene = doc['scenes'][doc['scene']]
    materials = doc['materials']
    opaque_meshes = {
        index for index, mesh in enumerate(doc['meshes'])
        if all(materials[primitive['material']].get('alphaMode') != 'BLEND'
               for primitive in mesh['primitives'])
    }
    static_groups = defaultdict(list)
    output_nodes = []
    for index in scene['nodes']:
        node = doc['nodes'][index]
        mesh = node.get('mesh')
        if mesh not in opaque_meshes:
            output_nodes.append(node)
            continue
        x, _, z = node['translation']
        region = (floor(x / INSTANCE_CELL_METERS), floor(z / INSTANCE_CELL_METERS))
        static_groups[mesh, region].append(node)

    has_batches = False
    for group in static_groups.values():
        source = group[0]
        if len(group) == 1:
            output_nodes.append(source)
            continue
        has_batches = True
        attributes = {
            attribute: builder._accessor(np.array([node[field] for node in group], dtype=np.float32), kind)
            for attribute, field, kind in (
                ('TRANSLATION', 'translation', 'VEC3'),
                ('ROTATION', 'rotation', 'VEC4'),
            )
        }
        batch = {key: value for key, value in source.items() if key not in ('translation', 'rotation')}
        batch['extensions'] = {**source.get('extensions', {}), INSTANCE_EXTENSION: {'attributes': attributes}}
        output_nodes.append(batch)

    doc['nodes'] = output_nodes
    scene['nodes'] = list(range(len(output_nodes)))
    if has_batches:
        doc.setdefault('extensionsUsed', []).append(INSTANCE_EXTENSION)
        doc.setdefault('extensionsRequired', []).append(INSTANCE_EXTENSION)
    builder.write(path)
