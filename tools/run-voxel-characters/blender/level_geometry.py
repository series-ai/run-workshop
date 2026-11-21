"""Geometry shared by the Cubix level kits."""

import numpy as np

import voxchar as vk
from creature_kit import Sculpt

CELL = 0.1
PALETTES = vk.load_json('level-palettes.json')


def span(size, center=0):
    start = center - size // 2
    return start, start + size - 1


def box(width, height, depth, color, *, x=0, y=0, z=0, sculpt=None):
    shape = Sculpt() if sculpt is None else sculpt
    return shape.box(span(width, x), (y, y + height - 1), span(depth, z), color)


def grounded_center(sculpt):
    (x0, x1), (y0, _), (z0, z1) = sculpt.bounds()
    return (x0 + x1 + 1) / 2, y0, (z0 + z1 + 1) / 2


def make_grid(sculpt, pivot=None, *, cell=CELL):
    (x0, x1), (y0, y1), (z0, z1) = sculpt.bounds()
    center = grounded_center(sculpt) if pivot is None else pivot
    grid = vk.VoxelGrid(x0, x1, y0, y1, z0, z1, voxel_size=cell,
                       origin_world=tuple(-coordinate * cell for coordinate in center))
    sculpt.write(grid)
    return grid


def mesh_from_grid(name, grid):
    part = vk.VoxelPart(name)
    part.add_grid(grid)
    return part.to_mesh(static=True)


def make_mesh(name, sculpt, pivot=None, *, cell=CELL):
    return mesh_from_grid(name, make_grid(sculpt, pivot, cell=cell))


def vertex_colors(mesh, palette):
    colors = np.array([
        [int(palette[region][i:i + 2], 16) / 255 for i in (1, 3, 5)]
        for region in vk.REGIONS
    ], dtype=np.float32)
    linear = np.where(colors <= 0.04045, colors / 12.92, ((colors + 0.055) / 1.055) ** 2.4)
    regions = np.floor(mesh.uvs[:, 0] * len(vk.REGIONS)).astype(int)
    shade = np.clip((mesh.uvs[:, 1] - 0.15) / 0.7, 0, 1) ** 0.85
    return np.clip(linear[regions] * (0.44 + 0.76 * shade[:, None]), 0, 1)
