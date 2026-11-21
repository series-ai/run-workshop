"""Verify that a built level archive preserves the authored voxel grids."""

import json
import math
import struct
import sys
from pathlib import Path
from zipfile import ZipFile

import numpy as np
from mathutils import Quaternion, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_level_props as props
import voxchar as vk
from level_districts import build_district
from level_geometry import CELL, ENVIRONMENTS, PALETTES, make_grid, mesh_from_grid, overview_bounds, vertex_colors
from level_finish_glb import (EMISSIVE_STRENGTH, FINISHES, GRAIN_REPEAT, GRAIN_TRANSFORM,
                              finish_png, grain_png, lamp_color, lamp_png)
from level_scene_glb import LIGHT_EXTENSION, linear_color


def require(valid, message):
    if not valid:
        raise ValueError(message)


def read_glb(data):
    require(data[:4] == b'glTF', 'Expected a GLB file')
    length = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + length]), data[28 + length:]


def read_accessor(doc, data, slot, components):
    accessor = doc['accessors'][slot]
    view = doc['bufferViews'][accessor['bufferView']]
    dtype = {5123: '<u2', 5125: '<u4', 5126: '<f4'}[accessor['componentType']]
    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    return np.frombuffer(data, dtype=dtype, count=accessor['count'] * components,
                         offset=offset).reshape(-1, components)


def check_mesh(doc, data, index, mesh, colors, surface, lamp, label):
    glb_mesh = doc['meshes'][index]
    require(glb_mesh['name'] == mesh.name, f'{label}: GLB model name differs')
    primitive, = glb_mesh['primitives']
    attrs = primitive['attributes']
    for name, expected in (('POSITION', mesh.positions), ('NORMAL', mesh.normals),
                           ('COLOR_0', colors), ('TEXCOORD_0', mesh.uvs), ('TEXCOORD_1', mesh.uv1s)):
        attribute = read_accessor(doc, data, attrs[name], expected.shape[1])
        require(expected.shape == attribute.shape
                and np.allclose(expected, attribute, atol=1e-6, rtol=0), f'{label}: {name} differs')
    indices = read_accessor(doc, data, primitive['indices'], 1).ravel()
    require(np.array_equal(mesh.indices, indices), f'{label}: indices differ')
    material = doc['materials'][primitive['material']]
    pbr = material['pbrMetallicRoughness']
    require(pbr['metallicFactor'] == pbr['roughnessFactor'] == 1,
            f'{label}: GLB finish factors differ')
    alpha = FINISHES['glassOpacity'] if surface == 'glass' else 1
    require(pbr['baseColorFactor'] == [1, 1, 1, alpha]
            and material.get('alphaMode', 'OPAQUE') == ('BLEND' if surface == 'glass' else 'OPAQUE')
            and material['doubleSided'] == (surface == 'glass'), f'{label}: GLB opacity differs')
    check_texture(doc, data, pbr['metallicRoughnessTexture'], 0, 9728, 33071, finish_png(surface), label)
    grain = pbr['baseColorTexture']
    require(GRAIN_TRANSFORM in doc['extensionsUsed']
            and grain['extensions'][GRAIN_TRANSFORM] == GRAIN_REPEAT, f'{label}: GLB grain size differs')
    check_texture(doc, data, grain, 1, 9987, 10497, grain_png(), label)
    if lamp:
        require(material['emissiveFactor'] == linear_color(lamp)
                and EMISSIVE_STRENGTH in doc['extensionsUsed']
                and material['extensions'][EMISSIVE_STRENGTH]['emissiveStrength'] == FINISHES['emissiveStrength'],
                f'{label}: GLB lamp differs')
        check_texture(doc, data, material['emissiveTexture'], 0, 9728, 33071, lamp_png(), label)
    else:
        require('emissiveTexture' not in material, f'{label}: unexpected GLB lamp')


def check_texture(doc, data, info, uv, min_filter, wrap, png, label):
    require(info.get('texCoord', 0) == uv, f'{label}: GLB texture coordinates differ')
    texture = doc['textures'][info['index']]
    sampler = doc['samplers'][texture['sampler']]
    require(sampler['magFilter'] == 9728 and sampler['minFilter'] == min_filter
            and sampler['wrapS'] == sampler['wrapT'] == wrap, f'{label}: GLB texture sampler differs')
    image = doc['images'][texture['source']]
    view = doc['bufferViews'][image['bufferView']]
    start = view.get('byteOffset', 0)
    require(image['mimeType'] == 'image/png'
            and data[start:start + view['byteLength']] == png,
            f'{label}: GLB texture pixels differ')


def check_direction(node, direction):
    x, y, z, w = node['rotation']
    forward = Quaternion((w, x, y, z)) @ Vector((0, 0, -1))
    require((forward - Vector(direction).normalized()).length < 1e-5,
            f'{node["name"]}: GLB direction differs')


def check_scene_environment(doc, layout):
    scene = doc['scenes'][doc['scene']]
    profile = layout['environment']
    require(scene['extras']['cubixEnvironment'] == profile, 'GLB atmosphere differs')
    require(LIGHT_EXTENSION in doc['extensionsUsed'], 'GLB lights are missing')
    lights = doc['extensions'][LIGHT_EXTENSION]['lights']
    light_nodes = [doc['nodes'][i] for i in scene['nodes']
                   if LIGHT_EXTENSION in doc['nodes'][i].get('extensions', {})]
    sun, *fixtures = light_nodes

    def light_of(node):
        return lights[node['extensions'][LIGHT_EXTENSION]['light']]

    light = light_of(sun)
    require(light['type'] == 'directional' and light['color'] == linear_color(profile['sunColor'])
            and light['intensity'] == profile['sunIntensity'], 'GLB sun differs')
    check_direction(sun, -Vector(profile['sunDirection']))
    for node, fixture in zip(fixtures, layout['fixtures'], strict=True):
        light = light_of(node)
        require(light['type'] == 'point' and light['color'] == linear_color(fixture['color'])
                and light['intensity'] == fixture['intensity'] and light['range'] == fixture['distance']
                and node['translation'] == fixture['position'], f'{node["name"]}: GLB fixture differs')

    view = layout['view']
    shots = [{'label': 'Approach', 'eye': view['eye'], 'target': view['target']}, *view['stops']]
    cameras = [doc['nodes'][i] for i in scene['nodes'] if 'camera' in doc['nodes'][i]]
    for node, shot in zip(cameras, shots, strict=True):
        camera = doc['cameras'][node['camera']]
        require(camera['name'] == shot['label'] and camera['type'] == 'perspective'
                and node['translation'] == shot['eye'], f'{node["name"]}: GLB camera differs')
        check_direction(node, Vector(shot['target']) - Vector(shot['eye']))


def restore(asset, data, size_m, expected_size):
    require(tuple(data['size']) == expected_size, f'{asset}: wrong grid size')
    width, height, depth = data['size']
    grid = vk.VoxelGrid(0, width - 1, 0, height - 1, 0, depth - 1,
                        origin_world=data['origin'], voxel_size=size_m)
    for x, y, z, length, code in data['runs']:
        require(0 <= x < x + length <= width and 0 <= y < height and 0 <= z < depth,
                f'{asset}: run outside the grid')
        require(code > 0 and not grid.data[x:x + length, y, z].any(),
                f'{asset}: invalid or overlapping run')
        grid.data[x:x + length, y, z] = code
    return grid


def check_pack(archive, layouts, factory):
    kit = factory()
    build_district(kit, props)
    layout = layouts[kit.key]
    voxel = json.loads(archive.read(f'{kit.key}/demo.voxels.json'))
    require(voxel['format'] == 'cubix-level-voxels' and voxel['version'] == 1,
            f'{kit.key}: wrong voxel format')
    require(voxel['pack'] == kit.key and voxel['voxelSize'] == CELL, f'{kit.key}: wrong pack or cell size')
    require(voxel['regions'] == list(vk.REGIONS) and voxel['palette'] == PALETTES[kit.key],
            f'{kit.key}: wrong material palette')
    require(voxel.get('finishes') == FINISHES, f'{kit.key}: raw scene material finishes differ')
    require(voxel['scene'] == layout and layout['placements'] == kit.placements,
            f'{kit.key}: scene layout differs')
    require(layout['environment'] == ENVIRONMENTS[kit.key], f'{kit.key}: atmosphere differs')
    require(set(voxel['prefabs']) == {asset for asset, _, _ in kit.props}, f'{kit.key}: prefab list differs')
    require(all(layout['view'][key] == value
                for key, value in overview_bounds(layout['placements'], voxel['prefabs']).items()),
            f'{kit.key}: GLB overview frame differs from voxel extents')
    catalog = json.loads(archive.read(f'{kit.key}/props.json'))
    entries = {entry['id']: entry for entry in catalog['props']}
    require(catalog['version'] == 1 and catalog['pack'] == kit.key
            and len(entries) == len(catalog['props']) and set(entries) == set(voxel['prefabs']),
            f'{kit.key}: archive prop catalog differs')

    demo, demo_data = read_glb(archive.read(f'{kit.key}/demo.glb'))
    demo_meshes = {mesh['name']: index for index, mesh in enumerate(demo['meshes'])}
    require(len(demo_meshes) == len(demo['meshes']) and set(demo_meshes) == set(voxel['prefabs']),
            f'{kit.key}: demo GLB prefab list differs')
    scene = demo['scenes'][demo['scene']]
    model_nodes = [demo['nodes'][i] for i in scene['nodes'] if 'mesh' in demo['nodes'][i]]
    for node, placement in zip(model_nodes, layout['placements'], strict=True):
        name = placement['propId']
        require(demo['meshes'][node['mesh']]['name'] == name, f'{name}: GLB model differs')
        require(node['translation'] == placement['position'], f'{name}: GLB translation differs')
        half_angle = placement['turn'] * math.pi / 4
        require(node['rotation'] == [0, math.sin(half_angle), 0, math.cos(half_angle)],
                f'{name}: GLB rotation differs')
    check_scene_environment(demo, layout)

    cells = 0
    for asset, label, sculpt in kit.props:
        expected = make_grid(sculpt)
        prefab = voxel['prefabs'][asset]
        overrides = prefab.get('palette', {})
        require(overrides == kit.palettes.get(asset, {}), f'{asset}: palette differs')
        surface = prefab.get('surface')
        require(surface == kit.surfaces.get(asset), f'{asset}: surface differs')
        restored = restore(asset, prefab, voxel['voxelSize'], expected.data.shape)
        require(np.array_equal(restored.data, expected.data), f'{asset}: cell data differs')
        corner = [origin + CELL * index for origin, index in zip(expected.origin_world, expected.min_c)]
        require(np.allclose(restored.origin_world, corner, atol=1e-9, rtol=0), f'{asset}: origin differs')
        cells += np.count_nonzero(restored.data)

        mesh = mesh_from_grid(asset, restored)
        palette = {**voxel['palette'], **overrides}
        colors = vertex_colors(mesh, palette)
        lamp = lamp_color(mesh, palette)
        entry = entries[asset]
        path = f'props/{asset}.glb'
        require(entry['relativePath'] == path and entry['nodeName'] == asset
                and entry['label'] == label and entry['triangles'] == mesh.triangles
                and entry.get('surface') == surface and entry.get('palette', {}) == overrides,
                f'{asset}: archive prop entry differs')
        if asset in kit.vehicles:
            motion = entry['motion']
            require(motion['relativePath'] == f'vehicles/{asset}.glb'
                    and motion['clips'] == list(kit.vehicles[asset].clips)
                    and f'{kit.key}/{motion["relativePath"]}' in archive.namelist(), f'{asset}: archive vehicle differs')
        else:
            require('motion' not in entry, f'{asset}: unexpected archive vehicle')
        glb, data = read_glb(archive.read(f'{kit.key}/{path}'))
        check_mesh(glb, data, 0, mesh, colors, surface, lamp, asset)
        check_mesh(demo, demo_data, demo_meshes[asset], mesh, colors, surface, lamp, f'{asset} in demo')
    print(f'{kit.key}: {len(kit.props)} prefabs, {len(kit.placements)} placements, {cells:,} occupied cells')


def verify_archive(path):
    with ZipFile(path) as archive:
        corrupt = archive.testzip()
        require(corrupt is None, f'Invalid archive entry: {corrupt}')
        layouts = json.loads(archive.read('level-scenes.json'))
        for factory in props.LEVEL_FACTORIES:
            check_pack(archive, layouts, factory)


if __name__ == '__main__':
    args = vk.script_args('Verify the Cubix voxel scene archive.', 'archive')
    verify_archive(args.archive)
