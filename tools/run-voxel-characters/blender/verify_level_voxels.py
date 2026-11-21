"""Verify that a built level archive preserves the authored voxel grids."""

import json
import math
import struct
import sys
from pathlib import Path
from zipfile import ZipFile

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_level_props as props
import voxchar as vk
from level_districts import build_district
from level_geometry import CELL, PALETTES, make_grid, mesh_from_grid, vertex_colors


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


def check_mesh(doc, data, index, mesh, colors, label):
    glb_mesh = doc['meshes'][index]
    require(glb_mesh['name'] == mesh.name, f'{label}: GLB model name differs')
    primitive, = glb_mesh['primitives']
    attrs = primitive['attributes']
    for name, expected in (('POSITION', mesh.positions), ('NORMAL', mesh.normals), ('COLOR_0', colors)):
        attribute = read_accessor(doc, data, attrs[name], 3)
        require(expected.shape == attribute.shape
                and np.allclose(expected, attribute, atol=1e-6, rtol=0), f'{label}: {name} differs')
    indices = read_accessor(doc, data, primitive['indices'], 1).ravel()
    require(np.array_equal(mesh.indices, indices), f'{label}: indices differ')


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
    require(voxel['scene'] == layout and layout['placements'] == kit.placements,
            f'{kit.key}: scene layout differs')
    require(set(voxel['prefabs']) == {asset for asset, _, _ in kit.props}, f'{kit.key}: prefab list differs')

    demo, demo_data = read_glb(archive.read(f'{kit.key}/demo.glb'))
    demo_meshes = {mesh['name']: index for index, mesh in enumerate(demo['meshes'])}
    require(len(demo_meshes) == len(demo['meshes']) and set(demo_meshes) == set(voxel['prefabs']),
            f'{kit.key}: demo GLB prefab list differs')
    for node, placement in zip(demo['nodes'], layout['placements'], strict=True):
        name = placement['propId']
        require(demo['meshes'][node['mesh']]['name'] == name, f'{name}: GLB model differs')
        require(node['translation'] == placement['position'], f'{name}: GLB translation differs')
        half_angle = placement['turn'] * math.pi / 4
        require(node['rotation'] == [0, math.sin(half_angle), 0, math.cos(half_angle)],
                f'{name}: GLB rotation differs')

    cells = 0
    for asset, _, sculpt in kit.props:
        expected = make_grid(sculpt)
        restored = restore(asset, voxel['prefabs'][asset], voxel['voxelSize'], expected.data.shape)
        require(np.array_equal(restored.data, expected.data), f'{asset}: cell data differs')
        corner = [origin + CELL * index for origin, index in zip(expected.origin_world, expected.min_c)]
        require(np.allclose(restored.origin_world, corner, atol=1e-9, rtol=0), f'{asset}: origin differs')
        cells += np.count_nonzero(restored.data)

        mesh = mesh_from_grid(asset, restored)
        colors = vertex_colors(mesh, PALETTES[kit.key])
        glb, data = read_glb(archive.read(f'{kit.key}/props/{asset}.glb'))
        check_mesh(glb, data, 0, mesh, colors, asset)
        check_mesh(demo, demo_data, demo_meshes[asset], mesh, colors, f'{asset} in demo')
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
