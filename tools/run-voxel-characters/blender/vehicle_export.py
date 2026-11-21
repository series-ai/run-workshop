"""Write a vehicle GLB with rigid pivots, physical surfaces, and lamps."""

from dataclasses import dataclass

import numpy as np

import voxchar as vk
from creature_kit import Sculpt
from level_geometry import CELL, grounded_center, make_mesh, vertex_colors
from level_vehicles import LAMP, TAIL
from vehicle_surfaces import apply_vehicle_wear


def physical_material(name, roughness, metalness=0):
    return {
        'name': name,
        'pbrMetallicRoughness': {
            'baseColorFactor': [1, 1, 1, 1],
            'roughnessFactor': roughness,
            'metallicFactor': metalness,
        },
    }


MATERIALS = (
    physical_material('Vehicle Paint', 0.62),
    physical_material('Vehicle Rubber', 0.94),
    physical_material('Vehicle Metal', 0.43, 0.65),
    physical_material('Vehicle Glass', 0.19, 0.08),
    physical_material('Vehicle Wood', 0.86),
    physical_material('Vehicle Lens', 0.28),
    physical_material('Vehicle Dust', 0.96),
    physical_material('Vehicle Oxide', 0.88),
)
REGION_MATERIALS = {'hair': 1, 'metal': 2, 'visor': 3, 'leather': 4, 'skin': 6, 'detail': 7}
MATERIAL_BY_REGION = np.array([REGION_MATERIALS.get(region, 0) for region in vk.REGIONS])
LENS_MATERIAL = 5
NEIGHBORS = ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))
LIGHT_EXTENSION = 'KHR_lights_punctual'


@dataclass(frozen=True)
class LampLook:
    name: str
    color: tuple
    intensity: float
    reach: float


LAMP_LOOK = {
    LAMP: LampLook('headlamp', (1, 0.88, 0.69), 250, 11),
    TAIL: LampLook('taillamp', (1, 0.06, 0.025), 13, 4),
}


def lamp_patches(cells, color):
    matching = {point for point, material in cells.items() if material == color}
    while matching:
        first = min(matching)
        matching.remove(first)
        patch = [first]
        for x, y, z in patch:
            for dx, dy, dz in NEIGHBORS:
                neighbor = (x + dx, y + dy, z + dz)
                if neighbor in matching:
                    matching.remove(neighbor)
                    patch.append(neighbor)
        yield patch


def split_lamps(shape):
    if not any(op[3] in LAMP_LOOK for op in shape.ops):
        return shape, []
    cells = shape.cells()
    patches = [(color, patch) for color in LAMP_LOOK for patch in lamp_patches(cells, color)]
    body = Sculpt()
    body.ops.extend(shape.ops)
    for _, patch in patches:
        for x, y, z in patch:
            body.cut(x, y, z)
    return body if len(cells) > sum(len(patch) for _, patch in patches) else None, patches


def material_groups(mesh):
    indices = mesh.indices.reshape(-1, 3)
    region = np.floor(mesh.uvs[indices[:, 0], 0] * len(vk.REGIONS)).astype(int)
    material = MATERIAL_BY_REGION[region]
    return [(int(index), indices[material == index].flatten()) for index in np.unique(material)]


def add_child(builder, parent, node):
    if parent is None:
        builder.doc['scenes'][0]['nodes'].append(node)
    else:
        builder.doc['nodes'][parent].setdefault('children', []).append(node)


def add_part(builder, name, shape, cell, pivot, parent, palette):
    if shape is None:
        index = len(builder.doc['nodes'])
        builder.doc['nodes'].append({'name': name})
        add_child(builder, parent, index)
        return index
    mesh = make_mesh(name, shape, pivot, cell=cell)
    index = builder.add_mesh(mesh, colors=vertex_colors(mesh, palette), material_groups=material_groups(mesh))
    if parent is not None:
        builder.doc['scenes'][0]['nodes'].remove(index)
        add_child(builder, parent, index)
    return index


def add_lamp(builder, parent, name, color, patch, pivot, cell, forward, palette):
    style = LAMP_LOOK[color]
    lens = Sculpt()
    for x, y, z in patch:
        lens.box(x, y, z, color)
    mesh = make_mesh(f'{name}_lens', lens, pivot, cell=cell)
    lens_index = builder.add_mesh(
        mesh, {'emissiveOn': list(style.color)}, colors=vertex_colors(mesh, palette),
        material_groups=[(LENS_MATERIAL, mesh.indices)],
    )
    builder.doc['scenes'][0]['nodes'].remove(lens_index)
    add_child(builder, parent, lens_index)

    extension = builder.doc.setdefault('extensions', {}).setdefault(LIGHT_EXTENSION, {'lights': []})
    lights = extension['lights']
    light_name = f'{name}_light'
    lights.append({
        'name': light_name,
        'type': 'spot',
        'color': list(style.color),
        'intensity': 0,
        'range': style.reach,
        'spot': {'innerConeAngle': 0.22, 'outerConeAngle': 0.51},
    })
    points = np.asarray(patch)
    center = (points.min(axis=0) + points.max(axis=0) + 1) * 0.5
    if forward:
        center[2] = points[:, 2].max() + 1.25
    else:
        center[2] = points[:, 2].min() - 0.25
    light_index = len(builder.doc['nodes'])
    builder.doc['nodes'].append({
        'name': light_name,
        'translation': [round(float(axis) * cell, 6) for axis in center - pivot],
        'rotation': [0, 1, 0, 0] if forward else [0, 0, 0, 1],
        'extensions': {LIGHT_EXTENSION: {'light': len(lights) - 1}},
        'extras': {'intensityOn': style.intensity},
    })
    add_child(builder, parent, light_index)
    return light_name


def write_vehicle(path, name, vehicle, palette):
    builder = vk.GlbBuilder()
    doc = builder.doc
    doc['materials'] = list(MATERIALS)
    palette = {**palette, 'visor': '#566c78'}
    origin = grounded_center(vehicle.rest())
    indices = {}
    pivots = {}
    lights = []

    def add_rigid_part(part_name, shape, center, cell, parent_name=None):
        pivot = np.asarray(center) * (CELL / cell)
        body, lamp_parts = split_lamps(shape) if shape.ops else (None, [])
        if body is not None:
            body = apply_vehicle_wear(name, part_name, body, pivot)
        parent = indices.get(parent_name)
        index = add_part(builder, part_name, body, cell, pivot, parent, palette)
        indices[part_name] = index
        pivots[part_name] = center
        if parent_name is not None:
            doc['nodes'][index]['translation'] = [
                round((axis - previous) * CELL, 6)
                for axis, previous in zip(center, pivots[parent_name])
            ]
        for number, (color, patch) in enumerate(lamp_parts, 1):
            world_z = sum(point[2] + 0.5 for point in patch) / len(patch) * cell
            forward = color != TAIL and world_z >= origin[2] * CELL
            light_name = f'{part_name}_{LAMP_LOOK[color].name}_{number:02d}'
            lights.append(add_lamp(builder, index, light_name, color, patch, pivot, cell, forward, palette))
        return index

    root = add_rigid_part('vehicle_root', vehicle.detailed_chassis(), origin, CELL)
    doc['nodes'][root].setdefault('extras', {}).update(
        {'assetId': name, 'forward': '+Z', 'up': '+Y', 'wheelRadiusMeters': vehicle.radius},
    )
    for part in vehicle.parts:
        add_rigid_part(part.name, part.shape, part.pivot, part.cell, part.parent)
    if lights:
        doc['extensionsUsed'] = [LIGHT_EXTENSION]

    doc['animations'] = []
    for name, tracks in vehicle.clips.items():
        animation = {'name': name, 'samplers': [], 'channels': []}
        for track in tracks:
            node = indices[track.part]
            values = np.array(track.values, dtype=np.float32)
            if track.path == 'translation':
                values += doc['nodes'][node]['translation']
            input_index = builder._accessor(np.array(track.times, dtype=np.float32), 'SCALAR', bounds=True)
            output_index = builder._accessor(values, 'VEC4' if track.path == 'rotation' else 'VEC3')
            sampler = len(animation['samplers'])
            animation['samplers'].append({'input': input_index, 'output': output_index, 'interpolation': 'LINEAR'})
            animation['channels'].append({'sampler': sampler, 'target': {'node': node, 'path': track.path}})
        doc['animations'].append(animation)
    builder.write(path)
    return lights
