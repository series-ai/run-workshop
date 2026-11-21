"""Write Cubix scene data without discarding interior cells."""

import json
from itertools import groupby

import voxchar as vk


def encode_prefab(grid):
    size = grid.data.shape
    # A run contains consecutive occupied cells along the local X axis.
    runs = []
    for y in range(size[1]):
        for z in range(size[2]):
            x = 0
            for code, cells in groupby(map(int, grid.data[:, y, z])):
                length = sum(1 for _ in cells)
                if code:
                    runs.append((x, y, z, length, code))
                x += length
    origin = [round(world - pivot * grid.voxel_size, 9)
              for world, pivot in zip(grid.origin_world, grid.pivot_vox)]
    return {'origin': origin, 'size': size, 'runs': runs}


def write_voxel_scene(path, pack, cell, palette, prefabs, scene, *, finishes):
    document = {
        'format': 'cubix-level-voxels',
        'version': 1,
        'pack': pack,
        'voxelSize': cell,
        'regions': vk.REGIONS,
        'palette': palette,
        'finishes': finishes,
        'prefabs': prefabs,
        'scene': scene,
    }
    path.write_text(json.dumps(document, separators=(',', ':')) + '\n', encoding='utf-8')
