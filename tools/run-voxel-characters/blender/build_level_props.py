"""Export grounded voxel level pieces and their demo placements."""

import json
import math
import sys
from dataclasses import dataclass, field
from pathlib import Path
from re import fullmatch
from shutil import copyfile

sys.path.insert(0, str(Path(__file__).resolve().parent))

import voxchar as vk
from creature_kit import Sculpt

from level_geometry import (CELL, ENVIRONMENTS, PALETTES, WATER_LABELS, box, make_grid,
                            mesh_from_grid, overview_bounds, span, vertex_colors)
from level_finish_glb import FINISHES, add_level_mesh, lamp_color, level_builder
from level_scene_glb import append_environment
from level_voxels import encode_prefab, write_voxel_scene
from prop_surfaces import apply_finish
import level_vehicles as vehicles
from vehicle_export import write_vehicle
from level_districts import build_district
MASONRY = vk.vox('skin', 0)
JOINT = vk.vox('skin', -0.2, mottle=False)
CAP = vk.vox('trim', 0.15, mottle=False)
BODY = vk.vox('primary', 0)
WOOD = vk.vox('leather', 0.2)
DARK = vk.vox('secondary', -0.1)
DECK_JOINT = vk.vox('secondary', -0.24)
RUBBER = vk.vox('hair', 0, mottle=False)
METAL = vk.vox('metal', 0, mottle=False)
MARK = vk.vox('accent', 0.1, mottle=False)
DETAIL = vk.vox('detail', 0, mottle=False)
LIGHT = vk.vox('visor', 0.25, mottle=False)
PATINA = vk.vox('skin', -0.35)
GRIT = vk.vox('primary', -0.32)
SOIL = vk.vox('leather', -0.15)
LAMP = vk.vox('trim', 0.45, emissive=True)


def paving(width, depth, surface, seam, accent):
    shape = box(width, 2, depth, surface)
    z_min, z_max = span(depth)
    bands = [z_min - 1, *range(z_min + 8, z_max - 4, 12), z_max + 1]
    for row, (start, end) in enumerate(zip(bands, bands[1:])):
        if end <= z_max:
            box(width, 1, 1, seam, y=1, z=end, sculpt=shape)
        for x in range(-width // 2 + 5 + (row % 2) * 4, width // 2 - 1, 12):
            box(1, 1, end - start - 1, seam, x=x, y=1, z=(start + end + 1) // 2, sculpt=shape)
    for x in (-width // 2 + 1, width // 2 - 2):
        box(2, 1, 2, accent, x=x, y=1, z=depth // 2 - 2, sculpt=shape)
    for x, z in ((-0.28, 0.24), (0.2, -0.3), (0.34, 0.15)):
        box(4, 1, 2, seam, x=int(width * x), y=1, z=int(depth * z), sculpt=shape)
    return shape


def inlay(width, depth, face, trim):
    shape = box(width + 2, 2, depth + 2, DARK)
    box(width, 1, depth, face, y=1, sculpt=shape)
    for x in range(-width // 2 + 1, width // 2 - 1, 4):
        box(1, 1, depth, trim, x=x, y=1, sculpt=shape)
    return shape


def panel(width, height, thickness, face, trim, *, opening=0, rows=False):
    shape = box(width, height, thickness, face)
    if rows:
        for row, y in enumerate(range(4, height - 1, 5)):
            box(width, 1, thickness, JOINT, y=y, sculpt=shape)
            for x in range(-width // 2 + 4 + (row % 2) * 3, width // 2 - 1, 8):
                box(1, 3, thickness, JOINT, x=x, y=y + 1, sculpt=shape)
    else:
        for x in (-width // 2 + 1, width // 2 - 2):
            box(2, height, thickness + 2, trim, x=x, sculpt=shape)
    box(width, 2, thickness + 2, trim, y=height - 2, sculpt=shape)
    if opening:
        x0, x1 = span(opening)
        z0, z1 = span(thickness + 2)
        shape.cut((x0, x1), (0, height - 6), (z0, z1))
        for x in (x0 - 1, x1 + 1):
            box(2, height - 4, thickness + 2, trim, x=x, sculpt=shape)
    return shape


def fence(width, height, material, *, mesh=False):
    shape = box(width, 1, 2, material)
    box(width, 1, 2, material, y=height - 1, sculpt=shape)
    for x in (-width // 2 + 1, width // 2 - 2):
        box(2, height + 1, 3, material, x=x, sculpt=shape)
    if mesh:
        for x in range(-width // 2 + 3, width // 2 - 2, 5):
            box(1, height - 1, 1, METAL, x=x, y=1, sculpt=shape)
        for y in range(7, height - 1, 7):
            box(width - 4, 1, 1, METAL, y=y, sculpt=shape)
    else:
        box(width, 2, 2, material, y=height // 2, sculpt=shape)
    return shape


def step_run(width, rise, count, body, edge):
    shape = Sculpt()
    for index in range(count):
        y = index + 1
        z = (count // 2 - index) * rise
        box(width, y, rise, body, z=z, sculpt=shape)
        box(width, 1, 1, edge, y=y - 1, z=z + rise // 2 - 1, sculpt=shape)
    return shape


def platform(width, depth, height, top, support):
    shape = box(width, 2, depth, top, y=height - 2)
    for x in (-width // 2 + 2, width // 2 - 2):
        for z in (-depth // 2 + 2, depth // 2 - 2):
            box(3, height - 2, 3, support, x=x, z=z, sculpt=shape)
    return shape


def crate(width, height, depth, face, frame):
    shape = box(width, height, depth, face)
    for y in (0, height - 2):
        box(width + 2, 2, depth + 2, frame, y=y, sculpt=shape)
    for x in (-width // 2 + 1, width // 2 - 1):
        for z in (-depth // 2 + 1, depth // 2 - 1):
            box(2, height, 2, frame, x=x, z=z, sculpt=shape)
    return shape


def latched_case(width, height, depth, face, frame, label):
    shape = crate(width, height, depth, face, frame)
    front = (depth - 1) // 2
    grip = height - 4
    shape.cut((-1, 1), (grip, grip + 1), front)
    box(3, 2, 1, RUBBER, y=grip, z=front - 1, sculpt=shape)
    for x in (-width // 4 - 1, width // 4 + 1):
        box(2, 2, 1, METAL, x=x, y=grip + 1, z=front, sculpt=shape)
        box(1, 1, 1, PATINA, x=x, y=grip + 1, z=front, sculpt=shape)
    box(3, 2, 1, label, x=width // 4, y=grip, z=-depth // 2, sculpt=shape)
    return shape


def salvage_crate():
    shape = crate(13, 11, 12, WOOD, METAL)
    for y in (3, 6):
        shape.cut((-4, 4), y, 5)
        box(9, 1, 1, DARK, y=y, z=4, sculpt=shape)
    box(1, 7, 1, PATINA, x=-2, y=2, z=5, sculpt=shape)
    box(1, 7, 1, PATINA, x=3, y=2, z=5, sculpt=shape)
    box(4, 2, 1, CAP, x=1, y=4, z=-6, sculpt=shape)
    return shape


def drum(width, height, face, rim):
    shape = box(width, height, width - 4, face)
    box(width - 4, height, width, face, sculpt=shape)
    for y in (0, height // 2, height - 1):
        box(width + 2, 1, width - 4, rim, y=y, sculpt=shape)
        box(width - 4, 1, width + 2, rim, y=y, sculpt=shape)
    box(2, 1, 2, rim, x=1, y=height, sculpt=shape)
    return shape


def feed_bucket():
    shape = drum(7, 6, WOOD, METAL)
    shape.cut(span(3), (3, 6), span(3))
    box(3, 1, 3, SOIL, y=2, sculpt=shape)
    box(1, 2, 5, PATINA, x=-2, y=4, sculpt=shape)
    return shape


def cooper_barrel():
    shape = drum(10, 11, WOOD, METAL)
    grain = vk.vox('leather', -0.55, mottle=False)
    for x in (-2, 1):
        shape.paint(x, (2, 8), 4, grain)
        shape.paint(x, (2, 8), -5, grain)
    for z in (-2, 1):
        shape.paint(-5, (2, 8), z, grain)
        shape.paint(4, (2, 8), z, grain)
    box(2, 1, 1, CAP, x=1, y=5, z=4, sculpt=shape)
    return shape


def post(height, body, top, *, arm=False):
    shape = box(5, 2, 5, DARK)
    box(2, height - 2, 2, body, y=2, sculpt=shape)
    box(5, 3, 5, top, y=height - 2, sculpt=shape)
    if arm:
        box(8, 2, 3, body, x=3, y=height - 4, sculpt=shape)
        box(4, 2, 4, LIGHT, x=6, y=height - 4, sculpt=shape)
    return shape


def counter(width, depth, color, trim, *, shelf=False):
    shape = platform(width, depth, 10, trim, color)
    if shelf:
        box(width - 2, 2, depth - 2, color, y=3, sculpt=shape)
        box(width, 1, depth // 2, trim, y=15, z=-depth // 4, sculpt=shape)
        for x in (-width // 2 + 1, width // 2 - 2):
            box(1, 5, 1, color, x=x, y=10, z=-depth // 2 + 1, sculpt=shape)
    return shape


def case(width, height, depth, shell, insert, *, screen=False):
    shape = box(width, height, depth, shell)
    box(width + 2, 2, depth + 2, DARK, sculpt=shape)
    box(width, 1, depth, METAL, y=height - 1, sculpt=shape)
    box(width - 2, height - 5, 1, insert, y=3, z=depth // 2, sculpt=shape)
    if screen:
        box(width - 4, max(2, height // 4), 1, LIGHT, y=height - 6, z=depth // 2 + 1, sculpt=shape)
    else:
        box(3, 1, 1, CAP, y=height // 2, z=depth // 2 + 1, sculpt=shape)
    return shape


def tree(height, width, trunk, crown, *, conifer=False):
    shape = box(3, height - 3, 3, trunk)
    box(6, 3, 5, trunk, sculpt=shape)
    if conifer:
        for tier, spread in enumerate((width, width - 4, width - 8, width - 12)):
            low = height - 22 + tier * 5
            box(spread, 4, spread - 2, crown, x=tier % 2, y=low, sculpt=shape)
            box(spread - 3, 3, spread - 5, BODY, x=tier % 2, y=low + 3, sculpt=shape)
        box(3, 4, 3, crown, y=height - 3, sculpt=shape)
    else:
        for x, z, lift, size in ((-4, -2, -8, width - 8), (4, 3, -11, width - 8), (1, -2, -3, width - 9)):
            y = height + lift
            box(8, 2, 3, trunk, x=x // 2, y=y - 3, z=z, sculpt=shape)
            box(size, 5, size - 2, crown, x=x, y=y, z=z, sculpt=shape)
            box(size - 4, 3, size - 5, BODY, x=x, y=y + 4, z=z, sculpt=shape)
    return shape


def rocks(width, height, depth, body):
    shape = box(width, max(2, height // 3), depth - 2, body)
    box(width - 4, height - 1, depth, body, x=-1, sculpt=shape)
    box(width - 9, 2, depth - 3, CAP, x=-2, y=height - 2, sculpt=shape)
    return shape


def bench(width, material):
    shape = platform(width, 6, 5, material, DARK)
    box(width, 3, 2, material, y=7, z=-2, sculpt=shape)
    for x in (-width // 2 + 2, width // 2 - 2):
        box(2, 3, 1, DARK, x=x, y=5, z=-2, sculpt=shape)
    return shape


def street_lamp():
    return post(25, METAL, LIGHT, arm=True)


def vault_door():
    shape = case(20, 20, 5, MASONRY, METAL)
    box(10, 1, 1, MARK, y=10, z=4, sculpt=shape)
    box(1, 9, 1, MARK, y=6, z=4, sculpt=shape)
    box(3, 3, 2, DARK, y=9, z=4, sculpt=shape)
    return shape


def pallet(width, depth, deck, feet):
    shape = Sculpt()
    for x in (-width // 2 + 1, 0, width // 2 - 1):
        box(2, 2, depth, feet, x=x, sculpt=shape)
    for z in range(-depth // 2 + 1, depth // 2, 3):
        box(width, 1, 2, deck, y=2, z=z, sculpt=shape)
    box(width, 1, 2, CAP, y=2, z=-depth // 2 + 1, sculpt=shape)
    return shape


def machine_press():
    shape = box(21, 3, 15, METAL)
    for x in (-8, 8):
        box(3, 18, 5, DARK, x=x, y=3, sculpt=shape)
    box(21, 5, 15, BODY, y=21, sculpt=shape)
    box(7, 7, 7, METAL, y=14, sculpt=shape)
    box(12, 2, 11, MARK, y=5, sculpt=shape)
    box(3, 3, 2, LIGHT, x=6, y=22, z=7, sculpt=shape)
    return shape


def drainage_grate():
    shape = box(17, 1, 12, DARK)
    for x in range(-7, 8, 3):
        box(1, 1, 12, METAL, y=1, x=x, sculpt=shape)
    for z in (-5, 5):
        box(17, 1, 2, CAP, y=1, z=z, sculpt=shape)
    return shape


def well():
    shape = box(15, 2, 15, MASONRY)
    for y, width, material in ((2, 13, JOINT), (3, 13, MASONRY), (8, 15, CAP)):
        height = 5 if y == 3 else 1
        for x in (-width // 2 + 1, width // 2 - 1):
            box(2, height, width, material, x=x, y=y, sculpt=shape)
        for z in (-width // 2 + 1, width // 2 - 1):
            box(width, height, 2, material, z=z, y=y, sculpt=shape)
    box(10, 1, 10, LIGHT, y=2, sculpt=shape)
    return shape


def gate_house():
    shape = panel(40, 28, 16, MASONRY, CAP, opening=20, rows=True)
    box(42, 2, 18, DARK, y=27, sculpt=shape)
    for x in (-17, -8, 1, 10, 19):
        box(4, 3, 17, MASONRY, x=x, y=29, sculpt=shape)
    return shape


def awning():
    shape = platform(27, 15, 22, WOOD, WOOD)
    for x in range(-12, 13, 6):
        box(3, 1, 17, DETAIL, x=x, y=22, sculpt=shape)
    box(28, 1, 2, CAP, y=20, z=8, sculpt=shape)
    return shape


def turret():
    shape = crate(18, 8, 17, DARK, MASONRY)
    box(12, 10, 12, BODY, y=8, sculpt=shape)
    box(14, 4, 8, METAL, y=18, sculpt=shape)
    box(8, 3, 3, LIGHT, y=18, z=5, sculpt=shape)
    return shape


def bridge():
    shape = platform(28, 16, 8, WOOD, DARK)
    for x in range(-13, 14, 4):
        box(1, 1, 16, CAP, x=x, y=7, sculpt=shape)
    for z in (-8, 8):
        box(28, 2, 1, WOOD, y=13, z=z, sculpt=shape)
        for x in (-13, 0, 13):
            box(2, 7, 2, WOOD, x=x, y=8, z=z, sculpt=shape)
    return shape


def window_wall(face, frame, *, brick=False):
    shape = box(40, 29, 6, face)
    box(40, 2, 8, frame, y=27, sculpt=shape)
    if brick:
        for y in (4, 8, 24):
            box(40, 1, 6, JOINT, y=y, sculpt=shape)
    for x in (-10, 10):
        shape.cut(span(13, x), (10, 22), (-3, 2))
        box(15, 1, 8, frame, x=x, y=9, sculpt=shape)
        box(15, 1, 7, frame, x=x, y=23, sculpt=shape)
        box(1, 13, 3, frame, x=x, y=10, sculpt=shape)
    return shape


def roof(width=40, depth=36, material=DARK):
    shape = box(width, 2, depth, material)
    box(width, 1, 2, METAL, y=2, z=depth // 2 - 1, sculpt=shape)
    for x in range(-width // 2 + 3, width // 2 - 2, 8):
        box(2, 1, depth, METAL, x=x, y=2, sculpt=shape)
    for x in (-width // 4, width // 4):
        box(9, 1, 2, LAMP, x=x, z=3, sculpt=shape)
    return shape


def deep_arch(width, height, depth, span_width, material=MASONRY, edge=CAP):
    shape = box(width, height, depth, material)
    rear, front = span(depth)
    for y0, y1, opening in ((0, height - 9, span_width), (height-8, height-6, span_width-4), (height-5, height-4, span_width-8)):
        shape.cut(span(opening), (y0, y1), (rear, front))
    for x in (-width // 2 + 3, width // 2 - 4):
        box(5, 3, depth + 2, edge, x=x, sculpt=shape)
        box(5, height - 4, 2, edge, x=x, y=3, z=front, sculpt=shape)
    box(width, 2, depth + 2, edge, y=height - 2, sculpt=shape)
    return shape


def curb(width=40):
    shape = box(width, 3, 9, DARK)
    box(width, 1, 9, MASONRY, y=2, sculpt=shape)
    box(width, 2, 2, CAP, y=1, z=4, sculpt=shape)
    for x in range(-width // 2 + 4, width // 2, 8):
        box(1, 1, 9, PATINA, x=x, y=2, sculpt=shape)
    return shape


def street_surface():
    shape = box(40, 2, 40, DARK)
    box(40, 1, 2, GRIT, y=1, z=-18, sculpt=shape)
    for x, z, w in ((-12, -9, 8), (4, 13, 12), (14, 2, 7), (-4, 5, 6)):
        box(w, 1, 2, PATINA, x=x, y=1, z=z, sculpt=shape)
        box(w - 2, 1, 2, RUBBER, x=x+1, y=1, z=z+2, sculpt=shape)
    box(13, 1, 1, MARK, y=1, z=-2, sculpt=shape)
    return shape


def truss():
    shape = box(40, 2, 5, DARK)
    box(40, 2, 5, METAL, y=9, sculpt=shape)
    for index, x in enumerate((-17, -6, 6, 17)):
        box(2, 8, 3, METAL, x=x, y=1, sculpt=shape)
        box(4, 2, 5, MARK if index in (0, 3) else DARK, x=x, y=3, sculpt=shape)
    return shape


def service_pipes():
    shape = box(38, 2, 4, METAL, z=-3)
    box(38, 3, 3, DETAIL, y=3, z=2, sculpt=shape)
    box(38, 2, 3, BODY, y=7, z=-2, sculpt=shape)
    for x in (-16, 0, 16):
        box(2, 10, 10, DARK, x=x, sculpt=shape)
        box(3, 1, 11, METAL, x=x, y=9, sculpt=shape)
    return shape


def booth():
    shape = box(24, 2, 19, DARK)
    box(24, 24, 3, BODY, z=-8, sculpt=shape)
    for x in (-11, 10):
        box(3, 24, 18, BODY, x=x, sculpt=shape)
    box(24, 8, 3, DARK, z=8, sculpt=shape)
    shape.cut((-4, 3), (0, 7), (7, 9))
    for x in (-11, 10):
        box(2, 17, 2, CAP, x=x, y=7, z=8, sculpt=shape)
    box(26, 3, 21, METAL, y=22, sculpt=shape)
    box(12, 1, 1, LAMP, y=21, z=6, sculpt=shape)
    return shape


def rock_bank():
    shape = box(40, 2, 40, SOIL)
    for z, unit in ((-20, 25), (5, 4), (16, 4)):
        height = 3 if z == -20 else 1
        depth = unit
        center = z + depth // 2
        box(40, height, depth, MASONRY if z == -20 else GRIT, y=1, z=center, sculpt=shape)
    for x, z in ((-15, -12), (-3, -8), (9, -15), (14, -7)):
        box(5, 1, 6, BODY, x=x, y=3, z=z, sculpt=shape)
    return shape


def split_bank():
    shape = box(40, 1, 40, SOIL)
    for x, width in ((-19, 2), (17, 6)):
        box(width, 2, 38, MASONRY, x=x, sculpt=shape)
    box(39, 2, 22, GRIT, z=-9, sculpt=shape)
    for x,z in ((-12,-12), (7,-15), (13,-7),(-5,-6)):
        box(6, 1, 3, BODY, x=x, y=1, z=z, sculpt=shape)
    return shape


def rough_rock():
    shape = Sculpt()
    for width, height, depth, x, z, material in (
        (28, 6, 18, 0, 0, MASONRY), (18, 5, 14, -3, -2, MASONRY),
        (10, 5, 10, 7, 3, PATINA), (7, 3, 9, -10, -3, BODY),
    ):
        box(width, height, depth, material, x=x, z=z, sculpt=shape)
    box(10, 2, 6, PATINA, x=-6, y=6, z=-3, sculpt=shape)
    box(7, 1, 4, BODY, x=-8, y=8, z=-3, sculpt=shape)
    box(8, 2, 10, MASONRY, x=5, y=5, z=3, sculpt=shape)
    return shape


def broken_column():
    shape = box(9, 3, 9, MASONRY)
    box(7, 18, 7, MASONRY, y=3, sculpt=shape)
    box(2, 17, 2, JOINT, x=-3, y=3, z=2, sculpt=shape)
    box(6, 3, 5, PATINA, x=-1, y=20, z=0, sculpt=shape)
    box(4, 2, 3, BODY, x=-1, y=23, z=-1, sculpt=shape)
    return shape


def clad_wall(width, height, depth, face, trim):
    shape = box(width, height, depth, face)
    front = span(depth)[1] + 1
    for y in range(3, height - 1, 4):
        box(width, 1, 1, trim, y=y, z=front, sculpt=shape)
    box(width, 2, depth + 2, DARK, sculpt=shape)
    box(width, 2, depth + 2, trim, y=height - 2, sculpt=shape)
    return shape


def pitched_roof(width, depth, face, trim):
    shape = Sculpt()
    for step in range(7):
        left, right = span(width - step * 4)
        box(right - left + 1, 1, depth - 2, face, y=step, sculpt=shape)
        for x in (left + 1, right - 1):
            box(3, 1, depth, trim, x=x, y=step, sculpt=shape)
    box(width - 26, 2, depth + 2, trim, y=7, sculpt=shape)
    return shape


def target_backstop():
    shape = box(54, 34, 6, MASONRY)
    box(54, 3, 6, PATINA, y=31, sculpt=shape)
    for x in (-17, 0, 17):
        box(11, 15, 1, DARK, x=x, y=10, z=2, sculpt=shape)
        box(7, 11, 1, CAP, x=x, y=12, z=2, sculpt=shape)
        box(3, 5, 1, DETAIL, x=x, y=15, z=2, sculpt=shape)
    box(54, 2, 6, MARK, y=4, sculpt=shape)
    return shape


def repair_gantry():
    shape = Sculpt()
    for x in (-17, 17):
        box(7, 2, 10, DARK, x=x, sculpt=shape)
        box(3, 26, 5, METAL, x=x, y=2, sculpt=shape)
        box(5, 6, 6, BODY, x=x, y=6, sculpt=shape)
    box(39, 4, 6, DARK, y=28, sculpt=shape)
    box(39, 1, 4, MARK, y=32, sculpt=shape)
    box(8, 5, 5, BODY, x=8, y=23, sculpt=shape)
    box(2, 4, 2, METAL, x=8, y=19, sculpt=shape)
    return shape


def cargo_rack(load):
    shape = Sculpt()
    for x in (-8, 8):
        for z in (-4, 4):
            box(2, 18, 2, DARK, x=x, z=z, sculpt=shape)
    for y in (2, 10, 17):
        box(18, 1, 10, METAL, y=y, sculpt=shape)
    box(6, 5, 8, load, x=-4, y=3, sculpt=shape)
    box(7, 4, 8, CAP, x=4, y=3, sculpt=shape)
    box(11, 5, 7, load, x=1, y=11, sculpt=shape)
    return shape


def breached_upper_bay():
    shape = panel(40, 29, 7, BODY, MASONRY, rows=True)
    for left, right, low, high in ((-9, 9, 0, 9), (-7, 11, 10, 16), (-4, 7, 17, 20)):
        shape.cut((left, right), (low, high), span(9))
    for x, y, length in ((-13, 1, 12), (-9, 5, 15), (11, 2, 11)):
        box(2, 2, length, WOOD, x=x, y=y, z=4, sculpt=shape)
    box(10, 2, 3, MASONRY, x=-12, y=15, z=4, sculpt=shape)
    return shape


def corner_shopfront():
    shape = panel(40, 29, 8, BODY, MASONRY, opening=22)
    box(6, 29, 17, BODY, x=-17, z=-4, sculpt=shape)
    box(12, 15, 2, DARK, x=6, y=6, z=-4, sculpt=shape)
    box(11, 1, 4, CAP, x=6, y=5, z=-3, sculpt=shape)
    box(1, 15, 3, METAL, x=5, y=6, z=-3, sculpt=shape)
    box(35, 3, 7, DARK, y=24, z=6, sculpt=shape)
    box(33, 1, 1, LAMP, y=23, z=6, sculpt=shape)
    return shape


def ore_hopper():
    shape = Sculpt()
    for x in (-11, 11):
        for z in (-8, 8):
            box(4, 33, 4, DARK, x=x, z=z, sculpt=shape)
    for y, w, d, height in ((13, 8, 8, 4), (17, 14, 13, 4), (21, 22, 19, 4), (25, 30, 25, 13)):
        box(w, height, d, BODY, y=y, sculpt=shape)
    box(31, 2, 26, DARK, y=36, sculpt=shape)
    box(24, 1, 18, GRIT, y=38, sculpt=shape)
    box(5, 7, 8, METAL, x=2, y=8, z=3, sculpt=shape)
    return shape


def hopper_conveyor():
    shape = Sculpt()
    for index, z in enumerate(range(-13, 14, 5)):
        height = 12 - index * 2
        box(12, 3, 6, DARK, y=height, z=z, sculpt=shape)
        box(9, 1, 5, RUBBER, y=height + 3, z=z, sculpt=shape)
        for x in (-5, 5):
            box(1, height, 2, METAL, x=x, z=z, sculpt=shape)
            box(1, 2, 6, BODY, x=x, y=height + 2, z=z, sculpt=shape)
    return shape


def ore_skip(load=None):
    shape = box(16, 2, 12, DARK)
    for x in (-7, 7):
        box(2, 8, 12, BODY, x=x, y=2, sculpt=shape)
    for z in (-5, 5):
        box(16, 8, 2, BODY, y=2, z=z, sculpt=shape)
    if load is not None:
        for x, z in ((-4, 2), (0, 0), (3, -3)):
            box(5, 2, 4, load, x=x, y=4, z=z, sculpt=shape)
    return shape


def glazed_inspection_booth():
    shape = booth()
    box(24, 1, 4, METAL, y=9, z=8, sculpt=shape)
    for x in (-7, 7):
        box(1, 10, 2, DARK, x=x, y=10, z=8, sculpt=shape)
    box(11, 3, 7, METAL, x=-4, y=8, z=5, sculpt=shape)
    box(8, 4, 2, LIGHT, x=-4, y=11, z=3, sculpt=shape)
    return shape


def lane_signal_beam():
    shape = box(34, 5, 6, DARK)
    box(34, 1, 4, METAL, y=5, sculpt=shape)
    for x in (-10, 10):
        box(6, 3, 1, LIGHT if x < 0 else DETAIL, x=x, y=1, z=3, sculpt=shape)
    box(7, 1, 1, LAMP, y=2, z=3, sculpt=shape)
    return shape


def barrier_arm():
    shape = box(5, 10, 6, DARK, x=-9)
    box(21, 2, 2, CAP, y=8, sculpt=shape)
    for x in (-5, 1, 7):
        box(2, 2, 3, DETAIL, x=x, y=8, sculpt=shape)
    return shape


def lookout_deck():
    shape = platform(31, 26, 21, WOOD, SOIL)
    for x in (-13, 13):
        for step in range(5):
            box(2, 4, 3, WOOD, x=x, y=step * 3 + 3, z=step * 3 - 6, sculpt=shape)
        box(3, 21, 3, WOOD, x=x, y=20, z=-10, sculpt=shape)
    box(30, 3, 3, WOOD, y=28, z=-10, sculpt=shape)
    box(30, 2, 3, SOIL, y=38, z=-10, sculpt=shape)
    return shape


def shale_escarpment(moss):
    shape = Sculpt()
    for width, height, depth, x, y, z, material in (
        (40, 8, 23, 0, 0, 0, MASONRY), (37, 8, 19, -1, 7, -2, PATINA),
        (32, 11, 16, -3, 13, -3, MASONRY), (22, 9, 13, -4, 24, -4, JOINT),
        (16, 7, 10, -7, 32, -5, MASONRY), (15, 2, 12, 9, 13, -2, moss),
        (14, 3, 14, 8, 21, -5, PATINA), (13, 2, 10, -7, 39, -5, moss),
        (9, 2, 6, -13, 23, 0, moss), (8, 5, 6, 14, 3, 9, PATINA),
    ):
        box(width, height, depth, material, x=x, y=y, z=z, sculpt=shape)
    return shape


def reeds():
    shape = box(10, 1, 8, SOIL)
    for x, z, y in ((-4, -3, 5), (-2, 2, 7), (0, 0, 4), (2, -3, 6), (4, 1, 4)):
        box(1, y, 1, BODY, x=x, y=1, z=z, sculpt=shape)
        box(1, 2, 1, WOOD, x=x, y=y, z=z, sculpt=shape)
    return shape


def shallow_water():
    water = vk.vox('visor', -0.25, mottle=False)
    ripple = vk.vox('visor', 0, mottle=False)
    shadow = vk.vox('visor', -0.55, mottle=False)
    shape = box(40, 2, 18, water)
    for x, z, width in ((-14, -3, 8), (-8, 4, 7), (-4, 0, 3), (8, -6, 9), (11, 2, 8), (2, 6, 6)):
        box(width, 1, 1, ripple, x=x, y=1, z=z, sculpt=shape)
    box(40, 1, 2, shadow, y=1, z=-8, sculpt=shape)
    return shape


def gate_tower_cap():
    shape = box(42, 3, 15, PATINA)
    box(39, 15, 13, MASONRY, y=3, sculpt=shape)
    for x in (-13, 0, 13):
        shape.cut(span(3, x), (7, 15), span(13))
        box(5, 1, 2, CAP, x=x, y=6, z=7, sculpt=shape)
    box(43, 2, 16, CAP, y=17, sculpt=shape)
    for x in (-18, -9, 0, 9, 18):
        box(5, 4, 15, MASONRY, x=x, y=19, sculpt=shape)
    return shape


def stall_frame():
    shape = Sculpt()
    for x in (-13, 12):
        for z in (-7, 7):
            box(2, 24, 2, WOOD, x=x, z=z, sculpt=shape)
            box(3, 3, 3, MASONRY, x=x, z=z, sculpt=shape)
    for z in (-7, 7):
        box(28, 2, 3, WOOD, y=22, z=z, sculpt=shape)
    return shape


def produce_bin(fill=None):
    shape = box(14, 3, 10, WOOD)
    for x in (-6, 6):
        box(2, 3, 10, CAP, x=x, y=3, sculpt=shape)
    for z in (-4, 4):
        box(14, 3, 2, CAP, y=3, z=z, sculpt=shape)
    if fill is not None:
        box(10, 2, 6, fill, y=3, sculpt=shape)
        for x, z in ((-4, -1), (0, 2), (4, -2)):
            box(2, 1, 2, fill, x=x, y=5, z=z, sculpt=shape)
    return shape


@dataclass
class Kit:
    key: str
    title: str
    use: str
    material: int
    trim: int
    props: list = field(default_factory=list)
    placements: list = field(default_factory=list)
    vehicles: dict = field(default_factory=dict)
    palettes: dict = field(default_factory=dict)
    surfaces: dict = field(default_factory=dict)

    def prop_id(self, label):
        slug = label.lower().replace(' ', '_').replace('-', '_')
        return f'prop_{self.key}_{slug}'

    def set_palette(self, label, **colors):
        prop_id = self.prop_id(label)
        if not any(asset == prop_id for asset, _, _ in self.props):
            raise ValueError(f'Unknown prop for palette: {label}.')
        for region, color in colors.items():
            if region not in vk.REGIONS or not fullmatch(r'#[0-9a-fA-F]{6}', color):
                raise ValueError(f'{label}: invalid palette entry {region}={color}.')
        self.palettes.setdefault(prop_id, {}).update(colors)

    def add(self, label, sculpt, x, z, turn=0, height=0, *, vehicle=None, surface=None):
        prop_id = self.prop_id(label)
        finish = surface or ('water' if label in WATER_LABELS else None)
        if finish:
            self.surfaces[prop_id] = finish
        if vehicle is None:
            apply_finish(self.key, label, sculpt)
        else:
            self.vehicles[prop_id] = vehicle
        self.props.append((prop_id, label, sculpt))
        self.place(label, x, z, turn, height)
        return prop_id

    def add_vehicle(self, label, vehicle, x, z, turn=0):
        self.add(label, vehicle.rest(), x, z, turn, vehicle=vehicle)

    def place(self, label, x, z, turn=0, height=0):
        self.placements.append({
            'propId': self.prop_id(label),
            'position': [x, height, z],
            'turn': turn,
        })

    def placement_at(self, label, x, z, *, height=None):
        def close(a, b):
            return math.isclose(a, b, rel_tol=0, abs_tol=1e-6)

        prop_id = self.prop_id(label)
        matches = []
        for placement in self.placements:
            px, py, pz = placement['position']
            if (placement['propId'] == prop_id and close(px, x) and close(pz, z)
                    and (height is None or close(py, height))):
                matches.append(placement)
        if len(matches) != 1:
            raise ValueError(f'{label} at X {x}, Z {z}, Y {height}: expected one placement, found {len(matches)}.')
        return matches[0]

    def remove_at(self, label, x, z, *, height=None):
        placement = self.placement_at(label, x, z, height=height)
        self.placements.remove(placement)

    def shell(self, floor_label, wall_label, entry_label, cover_label, stair_label, rail_label, *, masonry=False):
        material, trim = self.material, self.trim
        joint = DECK_JOINT if material == DARK else JOINT
        self.add(floor_label, paving(40, 40, material, joint, trim), 0, 0, height=-0.2)
        for x, z in ((-4, 0), (4, 0), (-4, -4), (0, -4), (4, -4), (-4, 4), (0, 4), (4, 4)):
            self.place(floor_label, x, z, height=-0.2)
        self.add(wall_label, panel(40, 25, 3, material, trim, rows=masonry), -4, -5.8)
        perimeter = {
            'core': [(4, -8.85, 0)],
            'heist': [(4, -5.8, 0), (-5.8, -3.8, 1), (-5.8, 0.2, 1)],
            'industrial': [(4, -5.8, 0), (5.8, -3.8, 1), (5.8, 2.9, 1)],
            'security': [(4, -5.8, 0), (-5.8, -3.8, 1), (3.3, -3.7, 1)],
            'creatures': [(5.3, -3.8, 1)],
            'fantasy': [(4, -5.8, 0), (-5.8, -3.8, 1), (5.8, -3.8, 1)],
        }
        for x, z, turn in perimeter[self.key]:
            self.place(wall_label, x, z, turn)
        self.add(entry_label, panel(40, 26, 4, material, trim, opening=20, rows=masonry), 0, -5.8)
        self.add(cover_label, panel(24, 8, 5, material, trim, rows=masonry), -2.9, 1.55)
        self.place(cover_label, 2.85, 0.5, 1)
        self.add(stair_label, step_run(16, 3, 6, material, trim), 3.9, -0.7)
        self.add(rail_label, fence(30, 11, trim), -5.6, 1.4, 1)
        if self.key == 'fantasy':
            self.place(rail_label, 8.9, 0.4, 1)
        else:
            self.place(rail_label, 5.6, 2.1, 1)

        extra_tiles = {
            'core': [(-8, -4), (-8, 0), (-8, 4)],
            'heist': [(-4, 8), (0, 8), (4, 8), (8, 4), (8, 0), (8, -4), (8, 8)],
            'industrial': [(8, -4), (8, 0), (8, 4)],
            'security': [(-4, -8), (0, -8), (4, -8)],
            'creatures': [(-8, -4), (-8, 0), (-8, 4), (-8, 8), (-4, 8), (0, 8), (4, 8)],
            'fantasy': [(8, -4), (8, 0), (8, 4), (4, 8), (0, 8)],
        }
        for x, z in extra_tiles[self.key]:
            self.place(floor_label, x, z, height=-0.2)

    def move(self, label, x, z, turn=0, height=0):
        slug = label.lower().replace(' ', '_').replace('-', '_')
        prop_id = f'prop_{self.key}_{slug}'
        placement = next(item for item in self.placements if item['propId'] == prop_id)
        placement.update(position=[x, height, z], turn=turn)

    def extend(self, label, columns):
        for x in columns:
            self.place(label, x, -8, height=-0.2)


def core_kit():
    kit = Kit('core', 'Training yard', 'Use the center lane or pass behind cover to reach the landing.', MASONRY, CAP)
    kit.shell('Concrete floor', 'Training wall', 'Open doorway', 'Low cover', 'Short steps', 'Handrail')
    a = kit.add
    a('Raised landing', platform(25, 17, 8, MASONRY, DARK), 3.9, -2.45)
    a('Cover block', crate(13, 11, 11, BODY, DARK), -1.85, -1.2, 1)
    a('Short pillar', post(12, MASONRY, CAP), -1.1, -2.8)
    a('High pillar', post(25, MASONRY, CAP), 1.2, -3.92)
    a('Ramp wedge', step_run(14, 3, 8, MASONRY, CAP), -4.05, -0.25, 2)
    a('Test plinth', platform(17, 14, 9, MASONRY, DARK), -3.95, 3.8)
    a('Marker cone', post(6, MARK, CAP), -0.9, 3.2)
    a('Stripe bollard', post(14, MARK, DARK), 1.18, 2.7)
    a('Equipment shelf', counter(18, 7, DARK, CAP, shelf=True), -4.2, -4.85)
    a('Training bench', bench(17, CAP), 4.1, 3)
    a('Utility cabinet', case(9, 17, 7, DARK, BODY), 4.7, -4.7)
    a('Storage bin', crate(8, 6, 8, DARK, CAP), -4.75, 2.2)
    a('Field case', latched_case(11, 6, 8, BODY, DARK, CAP), -3.9, -3.25)
    kit.set_palette('Field case', primary='#657067', secondary='#3f4743', metal='#adb0a4')
    a('Barrel marker', drum(8, 10, BODY, CAP), 4.85, 1.45)
    a('Site light', street_lamp(), -5.45, 4.85, 1)
    a('Training board', case(15, 18, 4, MASONRY, DARK, screen=True), -2.25, -4.8)
    a('Lane stripe', inlay(21, 2, MARK, CAP), 0, 2.35, height=-0.1)
    a('Floor hatch', inlay(13, 12, METAL, CAP), 0.65, -2, height=-0.1)
    a('Checkpoint arch', panel(29, 23, 3, BODY, CAP, opening=19), 0, 4.68)
    kit.move('Open doorway', -6, -1.9)
    kit.move('Training wall', -9.75, -3.8, 1)
    kit.move('Training board', -5.8, -5.15)
    kit.move('Equipment shelf', -7.15, -4.85)
    kit.move('Utility cabinet', -8.2, -3.05)
    kit.move('Training bench', -7.7, -0.45, 1)
    kit.move('Checkpoint arch', -0.2, 3.9)
    a('Workshop window wall', window_wall(MASONRY, METAL), -5.8, -5.8)
    a('Workshop roof section', roof(material=DARK), -6.0, -3.8, height=2.6)
    a('Workshop column', broken_column(), -8.2, -2.1)
    a('Bay divider', panel(31, 21, 4, BODY, METAL, opening=14), -7.55, 1.8, 1)
    a('Concrete edge unit', curb(), -7.8, 3.39)
    kit.extend('Concrete floor', (-8, -4, 0, 4))
    kit.move('Checkpoint arch', -4.1, 3.05, 1)
    kit.move('Test plinth', -3.4, 5.23)
    kit.move('Open doorway', -5.45, -1.9)
    kit.move('Cover block', -2.45, -2.3, 1)
    kit.move('High pillar', 5.3, -3.32)
    a('Target backstop', target_backstop(), -0.25, -5.35)
    a('Repair gantry', repair_gantry(), 3.86, -6.83)
    a('Corrugated storage wall', clad_wall(40, 32, 5, BODY, DARK), 5.85, -6, 1)
    kit.place('Corrugated storage wall', 5.85, -2, 1)
    a('Workshop pitched roof', pitched_roof(42, 38, DARK, METAL), -6, -4.35, height=2.98)
    a('Loaded parts rack', cargo_rack(MARK), 4.45, -5.2)
    a('Heavy work table', counter(26, 11, DARK, WOOD, shelf=True), -8.6, -6.9)
    a('Oil pan', ore_skip(RUBBER), 3.2, -6.4)
    a('Concrete floor patch', paving(18, 25, PATINA, JOINT, DARK), 2.3, 1.1, height=-0.15)
    a('Training barrier end', panel(9, 13, 7, BODY, METAL), -1.65, -0.5, 1)
    a('Flatbed tool cart', platform(15, 10, 5, DARK, RUBBER), 4.8, -4.23)
    kit.add_vehicle('Utility pickup', vehicles.pickup(), -7.9, 4.97, 1)

    return kit


def heist_kit():
    kit = Kit('heist', 'Demolition block', 'Follow the street to the vault or enter by the service alley.', MASONRY, BODY)
    kit.shell('Asphalt tile', 'Brick facade', 'Service opening', 'Damaged parapet', 'Loading stairs', 'Street railing', masonry=True)
    a = kit.add
    a('Vault frame', panel(34, 29, 8, MASONRY, METAL, opening=20), 0, -4.5)
    a('Vault slab', vault_door(), 0, -5)
    a('Concrete jersey', panel(19, 9, 6, MASONRY, MARK), 2.48, 2.4)
    a('Breach rubble', rocks(17, 7, 13, MASONRY), -1.8, -3.45)
    a('Junk dumpster', crate(18, 12, 13, DARK, BODY), -4.25, -0.6)
    a('Drain grate', drainage_grate(), 0.8, -1, height=-0.12)
    a('Roller shutter', panel(24, 23, 3, METAL, DARK, rows=True), 4.15, -5.35)
    a('Timber loading dock', platform(24, 16, 8, WOOD, DARK), 3.95, -2.45)
    a('Road trench plate', inlay(21, 13, METAL, MARK), 0.3, 1.43, height=-0.1)
    a('Pallet stack', pallet(12, 10, WOOD, DARK), -3.87, 2.52)
    a('Roadwork beacon', post(14, RUBBER, MARK), -1.33, 1.95)
    a('Street lamp', street_lamp(), 5.35, 4.31, 3)
    a('Roadside kiosk', case(13, 18, 10, DARK, DETAIL, screen=True), 4.53, 3.67, 3)
    a('Fuel drum', drum(9, 9, DETAIL, DARK), 2.9, -4.13)
    a('Cable reel', drum(11, 7, WOOD, DARK), -4.54, -3.55)
    a('Crated salvage', salvage_crate(), -3.75, 4.38)
    a('Access ladder', fence(8, 23, METAL, mesh=True), -4.55, -5.05)
    a('Overhead sign', panel(28, 22, 2, DARK, MARK, opening=22), 0, 4.9)
    kit.move('Overhead sign', 6.05, 4.8, 1)
    kit.move('Service opening', 5.9, -2.4, 1)
    kit.move('Roller shutter', 6.02, -5.72, 1)
    kit.move('Roadside kiosk', 7.55, 3.65, 3)
    kit.move('Junk dumpster', 7.55, -2.95, 1)
    kit.move('Loading stairs', 4.5, -0.7)
    kit.move('Timber loading dock', 4.5, -2.45)
    a('Worn road section', street_surface(), -4, 8, height=-0.17)
    for x in (0, 4, 8):
        kit.place('Worn road section', x, 8, height=-0.17)
    a('Sidewalk curb', curb(), -4, 6.17, height=-0.2)
    for x in (0, 4, 8):
        kit.place('Sidewalk curb', x, 6.17, height=-0.2)
    a('Upper brick windows', window_wall(BODY, MASONRY, brick=True), 0, -5.8, height=2.5)
    kit.place('Upper brick windows', 4, -5.8, height=2.5)
    a('Loading canopy', roof(35, 24), 5.75, -2.5, height=2.65)
    a('Recessed shop bay', deep_arch(38, 30, 11, 24, BODY, MASONRY), -3.25, -4.7)
    a('Alley wall return', panel(36, 26, 7, BODY, JOINT, rows=True), 9.45, -3.2, 1)
    kit.extend('Asphalt tile', (-4, 0, 4, 8))
    kit.move('Brick facade', -4, -8.15)
    kit.move('Recessed shop bay', -3.9, -7.28)
    kit.move('Upper brick windows', -3.9, -5.82, height=2.87)
    kit.move('Breach rubble', -0.8, -4.95)
    kit.move('Roadwork beacon', 6.9, 1.85)
    kit.move('Concrete jersey', 1.75, -1.57)
    a('Breached upper bay', breached_upper_bay(), 0, -5.77, height=2.51)
    a('Corner shopfront', corner_shopfront(), -3.75, -5.38)
    a('Alley lintel variant', deep_arch(33, 32, 13, 19, BODY, PATINA), 7.45, -5.86)
    a('Rooftop air unit', case(12, 9, 9, METAL, PATINA), -4.8, -7.4, height=5.74)
    a('Flat brick coping', roof(40, 33, DARK), -3.9, -7.34, height=5.75)
    kit.place('Flat brick coping', 0.05, -7.34, height=5.35)
    kit.add_vehicle('Street hatchback', vehicles.hatchback(), -2.03, 7.4, 1)
    kit.add_vehicle('Panel van', vehicles.panel_van(), 8.45, 8.0, 2)
    a('Stacked salvage rack', cargo_rack(WOOD), 6.35, -6.3, 1)
    a('Plaster breach rubble', rough_rock(), 0.16, -4.41, 1)
    a('Alley utility pipes', service_pipes(), 8.75, -3.9, 1, 2.62)
    a('Road repair patch', paving(14, 24, DARK, RUBBER, GRIT), 4.85, 7.41, height=-0.15)

    return kit


def industrial_kit():
    kit = Kit('industrial', 'Foundry yard', 'Move stock through the loading lane. Use the steps to reach the machine bay.', DARK, METAL)
    kit.shell('Workshop deck', 'Ribbed wall', 'Service frame', 'Machine guard', 'Steel steps', 'Safety rail')
    a = kit.add
    a('Work catwalk', platform(24, 15, 8, METAL, DARK), 3.9, -2.45)
    a('Power cabinet', case(12, 19, 8, METAL, DARK, screen=True), -4.75, -4.58)
    a('Conveyor bed', platform(29, 13, 9, DARK, METAL), -2.15, -2.6)
    a('Tool trolley', counter(12, 8, BODY, METAL, shelf=True), -4.18, 2.7)
    a('Material rack', counter(22, 11, METAL, BODY, shelf=True), -4.32, -4.15, 1)
    a('Loading pallet', pallet(14, 12, WOOD, DARK), -2.8, 3.4)
    a('Pressure vessel', drum(15, 21, METAL, DARK), 4.03, -4.81)
    a('Pipe riser', post(24, METAL, DETAIL, arm=True), 2.75, -4.18)
    a('Pipe rack', fence(23, 19, METAL, mesh=True), 0.65, -4.16)
    a('Floor grate', inlay(15, 14, METAL, JOINT), 0.2, 1.85, height=-0.1)
    a('Safety drum', drum(8, 10, DETAIL, METAL), 4.12, 2.21)
    a('Striped bollard', post(12, MARK, RUBBER), 2.11, 3.38)
    a('Shipping case', latched_case(15, 12, 12, BODY, METAL, MARK), 4.38, 3.9)
    kit.set_palette('Shipping case', primary='#687471', metal='#89938c')
    a('Hoist frame', panel(34, 31, 5, METAL, MARK, opening=26), 0.1, 4.76)
    a('Foundry press', machine_press(), 0.95, -3.44)
    a('Vent duct', crate(10, 18, 10, METAL, DARK), 5.27, -4.9)
    a('Warning stanchion', post(16, RUBBER, MARK), -1.53, 1.97)
    a('Maintenance bench', counter(17, 9, BODY, METAL), -4.36, 4.62)
    kit.move('Hoist frame', 7.97, 0.85)
    kit.move('Shipping case', 8.98, 1.5, 1)
    kit.move('Material rack', 7.8, -2.95, 1)
    kit.move('Vent duct', -2.4, -7.38)
    kit.move('Machine guard', -4.75, 1.87, 1)
    kit.move('Steel steps', -3.4, 0.8)
    kit.move('Work catwalk', -3.4, -0.95)
    a('Process bay opening', deep_arch(42, 37, 12, 28, DARK, METAL), 0, -1.5)
    a('Roof truss section', truss(), -0.1, -3.1, height=3.3)
    kit.place('Roof truss section', -2.6, -4.75, height=3.3)
    a('Process shed roof', roof(42, 33, BODY), -0.1, -3.9, height=4.25)
    a('Overhead service pipes', service_pipes(), 3.5, -4.8, height=2.65)
    a('Loading apron strip', street_surface(), 8, 4, height=-0.18)
    a('Loading sill', curb(38), 7.3, 0.0, 1, height=-0.1)
    kit.extend('Workshop deck', (-4, 0, 4, 8))
    kit.move('Process bay opening', -2.65, -2.5)
    kit.move('Process shed roof', -2.6, -4.1, height=4.25)
    kit.move('Roof truss section', -2.6, -3.13, height=3.3)
    kit.move('Conveyor bed', -3.7, -3.6)
    kit.move('Striped bollard', 4.42, 3.05)
    kit.move('Safety drum', 5.22, 2.5)
    kit.move('Warning stanchion', -2.7, 1.15)
    kit.move('Power cabinet', -5.1, -1.2)
    kit.move('Foundry press', -2.5, -5.15)
    kit.move('Pipe rack', -1.07, -4.65, 1)
    kit.move('Pipe riser', 5.15, -4.1)
    a('Ore hopper', ore_hopper(), 1.75, -4.28)
    a('Hopper conveyor', hopper_conveyor(), 2.0, -2.35)
    a('Ore receiving skip', ore_skip(MASONRY), 2.0, -0.8)
    a('Metal scrap skip', ore_skip(METAL), 5, -3.35, 1)
    a('Empty ore skip', ore_skip(), 7.4, -2.35, 1)
    a('High sheet metal wall', clad_wall(40, 44, 6, DARK, GRIT), 1.72, -6.65)
    kit.place('High sheet metal wall', 5.72, -6.65)
    a('Loading truss canopy', pitched_roof(44, 31, BODY, DARK), 6.88, -4.82, height=3.27)
    a('Loaded steel rack', cargo_rack(METAL), 7.35, -1.1, 1)
    a('Line drain cover', drainage_grate(), 0.3, -0.25, height=-0.18)
    a('Tank feed pipes', service_pipes(), 4.7, -4.95, 1, 2.7)
    a('Foundry loading ramp', step_run(20, 3, 4, DARK, METAL), 6.07, -0.45, 1)
    kit.place('High sheet metal wall', -4.6, -4.48, 1)
    kit.add_vehicle('Yard crane', vehicles.yard_crane(), 8.07, 3.7, 3)
    kit.add_vehicle('Warehouse forklift', vehicles.forklift(), 8.88, -6.95)

    return kit


def security_kit():
    kit = Kit('security', 'Transit checkpoint', 'Use the inspection lane or the side gate to reach the control room.', DARK, METAL)
    kit.shell('Station tile', 'Secure divider', 'Access doorway', 'Lane divider', 'Service steps', 'Queue rail')
    a = kit.add
    a('Inspection deck', platform(24, 15, 8, DARK, METAL), 3.9, -2.45)
    a('Scanner arch', panel(30, 27, 5, BODY, LIGHT, opening=18), 0, 2.95)
    a('People counter', post(18, DARK, LIGHT), 1.5, 3.85)
    a('Ticket kiosk', case(10, 19, 8, BODY, DARK, screen=True), -4.66, 3.6)
    a('Control desk', counter(25, 11, BODY, CAP, shelf=True), -3.88, -4.52)
    a('Equipment cabinet', case(13, 21, 9, BODY, DARK), 4.17, -4.83)
    a('Battery locker', crate(11, 15, 10, DETAIL, DARK), 2.75, -4.27)
    a('Guard booth', panel(21, 25, 7, BODY, CAP, opening=12), -3.95, -2.9, 1)
    a('Survey mast', street_lamp(), 5.32, 4.58, 3)
    a('Waiting bench', bench(18, CAP), -3.82, 1.85)
    a('Metal fence', fence(26, 21, DARK, mesh=True), -5.3, 4.08, 1)
    a('Gate post', post(17, METAL, DETAIL), 2.2, 4.88)
    a('Camera pod', post(24, DARK, LIGHT, arm=True), -2.31, -3.28)
    a('Server bank', case(12, 24, 10, DARK, BODY, screen=True), 4.94, -4.15)
    a('Evidence case', latched_case(12, 7, 9, BODY, DARK, DETAIL), -4.78, -0.5)
    kit.set_palette('Evidence case', primary='#526e73', secondary='#344a53', detail='#bea96b')
    a('Knee barrier', panel(19, 6, 6, METAL, DARK), 3.36, 1.77)
    a('Indicator plate', inlay(18, 3, LIGHT, MARK), 0, 0.3, height=-0.1)
    a('Rotor pod', turret(), 4.03, 3.77)
    kit.move('Access doorway', 0, -7.7)
    kit.move('Scanner arch', -0.55, 1.5)
    kit.move('Control desk', 4.7, -8.67, 1)
    kit.move('Guard booth', -3.3, -4.4)
    kit.move('Server bank', 4.1, -7.2, 3)
    kit.move('Lane divider', 1.9, 1.8, 1)
    a('Control room shell', booth(), 2.65, -6.35)
    a('Inspection hall canopy', roof(38, 36, BODY), -0.45, -0.15, height=2.95)
    a('Partition windows', window_wall(BODY, METAL), -2.55, -1.7, 1)
    kit.place('Partition windows', 4.95, -2.0, 1)
    a('Service bulkhead', deep_arch(32, 30, 9, 19, DARK, METAL), -1.5, -5.25, 1)
    a('Wall lights', service_pipes(), 0, -6.6, height=2.4)
    a('Inspection lane floor', paving(20, 40, METAL, BODY, LIGHT), -0.35, 2.15, height=-0.17)
    kit.move('Scanner arch', -0.62, 1.2)
    kit.move('Control room shell', 3.0, -7.94)
    kit.move('Guard booth', -4.75, -4.4)
    kit.move('Rotor pod', 4.36, -3.76)
    kit.move('Waiting bench', -3.97, 0.55, 1)
    a('Glazed inspection booth', glazed_inspection_booth(), 1.89, -2.3, 3)
    a('Lane signal beam', lane_signal_beam(), -0.4, -2.5, height=2.48)
    a('Parking barrier arm', barrier_arm(), 0.9, -0.74)
    a('Recessed service door', deep_arch(28, 29, 9, 16, BODY, METAL), -0.43, -4.6)
    a('Fabrication wall return', clad_wall(36, 31, 5, DARK, BODY), -3.28, -3.7, 1)
    a('Terminal wall panel', window_wall(DARK, METAL), 1.3, -9.65)
    a('Inspector storage rack', cargo_rack(DETAIL), -4.65, -2.95)
    a('Transit bench island', bench(25, METAL), -3.34, 2.6)
    a('Utility ceiling spine', service_pipes(), -0.67, -2.23, 1, 3.12)
    a('Inspection row marker', inlay(13, 5, LIGHT, DARK), -0.08, -2.05, height=-0.16)
    kit.place('Inspection hall canopy', -0.45, 3.45, height=2.95)
    kit.place('Partition windows', -2.3, 2.23, 1)
    kit.place('Fabrication wall return', 1.57, 2.97, 1)
    kit.place('Fabrication wall return', -3.05, 4.42, 1)
    kit.move('People counter', 2.63, 4.0)
    kit.move('Knee barrier', 3.36, 1.08)
    kit.move('Survey mast', 5.63, 4.52, 3)
    kit.add_vehicle('Patrol rover', vehicles.patrol_rover(), 4.38, 3.25)

    return kit


def creatures_kit():
    kit = Kit('creatures', 'Ranger outpost', 'Cross the stream and pass through the pen to reach the field station.', MASONRY, WOOD)
    kit.shell('Packed earth', 'Rock face', 'Pen gateway', 'Stone cover', 'Trail steps', 'Split rail', masonry=True)
    a = kit.add
    a('Watch platform', platform(24, 15, 8, WOOD, DARK), 3.9, -2.45)
    a('Trail bridge', bridge(), 0.05, 1.8, 1)
    a('Shallow water', shallow_water(), 0, 1.8, height=-0.23)
    a('Tall pine', tree(51, 23, WOOD, DARK, conifer=True), -4.9, -4.87)
    a('Alder tree', tree(27, 19, WOOD, BODY), -4.8, 4.6)
    a('Dead snag', post(22, WOOD, DARK, arm=True), -4.8, -2.95)
    a('Brush clump', rocks(15, 8, 12, BODY), -3.55, 3.85)
    a('Stream boulder', rocks(17, 10, 14, MASONRY), 2.5, 2.45)
    a('Nest mound', rocks(13, 5, 11, WOOD), -1.65, -3.48)
    a('Forage trough', crate(17, 6, 9, WOOD, CAP), 3.5, -4.95)
    a('Animal transport', crate(16, 13, 11, DARK, METAL), 4.66, 3.87)
    a('Supply shelf', counter(18, 8, WOOD, CAP, shelf=True), -4.36, -0.45)
    a('Warmth lamp', post(17, WOOD, MARK), 1.35, -3.48)
    a('Trail marker', post(14, WOOD, CAP), 1.35, 4.55)
    a('Feed bucket', feed_bucket(), 4.73, 2.45)
    a('Field station', case(15, 18, 11, DARK, METAL, screen=True), -4.6, 2.05)
    a('Observation screen', fence(25, 18, WOOD, mesh=True), 4.89, -4.67, 1)
    a('Shelter canopy', awning(), -2.71, -3.63)
    kit.move('Shelter canopy', -7.15, -2.1)
    kit.move('Field station', -7.2, -2.1)
    kit.move('Supply shelf', -7.1, -2.65)
    kit.move('Pen gateway', 2.6, -4.65)
    kit.move('Observation screen', 4.6, -4.65, 1)
    kit.move('Trail bridge', -0.45, 1.55, 1, -0.48)
    kit.move('Tall pine', -7.6, -4.92)
    kit.move('Rock face', -6.0, -5.8)
    kit.move('Alder tree', -7.95, 4.6)
    kit.move('Brush clump', -5.25, 3.85)
    water_tiles = {(-8,0),(-4,0),(0,0),(4,0),(-8,4),(-4,4),(0,4),(4,4)}
    kit.placements = [
        p for p in kit.placements
        if p['propId'] != 'prop_creatures_packed_earth'
        or (p['position'][0],p['position'][2]) not in water_tiles
    ]
    a('Upper creek bank', rock_bank(), -8, 0, height=-0.4)
    a('Lower creek bank', split_bank(), -8, 4, 2, -0.2)
    for x in (-4, 0, 4):
        kit.place('Upper creek bank', x, 0, height=-0.4)
        kit.place('Lower creek bank', x, 4, 2, -0.2)
    for x in (-8, -4, 4):
        kit.place('Shallow water', x, 1.8, height=-0.23)
    a('Creek approach steps', step_run(17, 4, 3, WOOD, CAP), -0.45, 3.38)
    kit.place('Creek approach steps', -0.45, -0.3, 2)
    a('Uneven rock shelf', rough_rock(), -7.0, 0.43)
    kit.place('Uneven rock shelf', 4.8, 2.9, 2)
    kit.place('Tall pine', -5.5, 6.2, 2)
    kit.place('Tall pine', -8.4, 0.2, 3)
    kit.place('Alder tree', 5.1, 6.85)
    kit.place('Brush clump', -6.3, 6.7, 1)
    kit.place('Brush clump', -3.31, 4.92, 2)
    a('Trail terrace', paving(28, 22, SOIL, GRIT, MASONRY), -3.05, 6.2, height=-0.13)
    kit.extend('Packed earth', (-8, -4, 0, 4))
    kit.move('Pen gateway', 3.6, -4.3)
    kit.move('Rock face', 4.98, -6.0, 1)
    kit.move('Forage trough', 5.0, -4.95)
    kit.move('Trail steps', 3.9, -0.81)
    kit.move('Warmth lamp', 1.13, -4.03)
    a('Lookout deck', lookout_deck(), -1.76, -4.45)
    a('Lookout shake roof', pitched_roof(34, 24, SOIL, WOOD), -1.76, -4.45, height=3.97)
    a('Lookout timber stairs', step_run(12, 2, 20, WOOD, SOIL), -5.0, -4.32, 3)
    a('Shale escarpment', shale_escarpment(BODY), -5.68, -6.72)
    kit.place('Shale escarpment', -8.45, -3.85, 1)
    a('Shale return', shale_escarpment(DARK), 2.44, -7.55, 2)
    kit.place('Shale return', -1.84, -8.53, 1, -0.2)
    kit.place('Tall pine', -0.65, -8.8, 1)
    kit.place('Tall pine', 4.55, -7.8, 3)
    kit.place('Alder tree', -3.35, -7.85, 3)
    a('Stream reeds', reeds(), -2.15, 1.46, height=-0.13)
    for x, z, turn in ((-4.2, 2.7, 1), (-3.3, 1.13, 2), (1.6, 1.29, 2), (3.65, 2.58, 3)):
        kit.place('Stream reeds', x, z, turn, height=-0.13)
    a('Low willow', tree(28, 25, SOIL, BODY), -4.7, 2.45)
    a('Shore alder', tree(38, 24, WOOD, DARK), 3.6, 4.35)
    a('Bridge timber footing', box(7, 10, 8, SOIL), -1.38, 1.09, height=-0.35)
    for x, z in ((0.42, 1.09), (-1.38, 1.95), (0.42, 1.95)):
        kit.place('Bridge timber footing', x, z, height=-0.35)
    a('Shallow stepping stones', rough_rock(), 2.9, 1.65, 1, -0.53)
    kit.add_vehicle('Ranger truck', vehicles.pickup(ranger=True), 2.45, 7.7, 1)

    return kit


def fantasy_kit():
    kit = Kit('fantasy', 'Market keep', 'Enter the market, pass the stalls, and climb to the shrine.', MASONRY, CAP)
    kit.shell('Flagstone tile', 'Keep wall', 'Stone doorframe', 'Battlement cover', 'Stone steps', 'Timber rail', masonry=True)
    a = kit.add
    a('Shrine landing', platform(25, 17, 8, MASONRY, DARK), 3.9, -2.45)
    a('Castle gatehouse', gate_house(), 0, -4.88)
    a('Market awning', awning(), -3.8, -0.3)
    a('Merchant counter', counter(20, 8, WOOD, CAP, shelf=True), -3.85, 0.1)
    a('Rune monument', case(11, 24, 9, MASONRY, BODY, screen=True), 3.9, -2.4, 0, 0.8)
    a('Courtyard well', well(), -3.55, -3.45)
    a('Wooden bridge', bridge(), 0, 3.05)
    a('Barrel stand', cooper_barrel(), -4.55, 2.55)
    a('Market crate', crate(10, 8, 10, WOOD, CAP), -3.22, 2.9)
    a('Guild sign', post(22, WOOD, DETAIL, arm=True), -5.15, 4.1)
    a('Courtyard brazier', post(13, METAL, MARK), 2.04, 4.53)
    a('Stone tomb', crate(18, 9, 10, MASONRY, CAP), 4.15, -4.65)
    kit.add_vehicle('Wagon frame', vehicles.market_wagon(), 4.5, 3.8)
    a('Old stone pile', rocks(16, 8, 13, MASONRY), -1.95, -3.52)
    a('Wooden bookcase', counter(14, 7, WOOD, CAP, shelf=True), -4.5, -4.77)
    a('Square lantern', post(20, DARK, MARK), 5.3, 1.2, 3)
    a('Banner support', panel(15, 25, 2, BODY, CAP, opening=7), 2.21, -4.12)
    a('Market bench', bench(17, WOOD), -4.4, 4.71)
    kit.move('Market awning', 5.4, 1.7, 3)
    kit.move('Merchant counter', 5.55, 1.65, 3)
    kit.move('Courtyard well', -3.2, 0.5)
    kit.move('Castle gatehouse', -1.15, -3.2)
    kit.move('Banner support', 6.65, -3.05, 1)
    kit.move('Wooden bridge', 2.4, 4.4)
    kit.move('Wagon frame', 9.0, 5.6)
    kit.move('Stone tomb', 6.7, -2.0)
    kit.move('Wooden bookcase', -4.15, -3.95, 1)
    kit.move('Stone steps', 3.9, -0.7)
    a('Shrine arcade', deep_arch(31, 35, 14, 20), 4.0, -3.69)
    a('Arcade roof slab', roof(34, 24, MASONRY), 4.0, -3.7, height=3.5)
    a('Weathered stone column', broken_column(), -3.65, -1.55)
    kit.place('Weathered stone column', 7.5, 3.6, 2)
    a('Limestone terrace wall', panel(40, 11, 8, MASONRY, CAP, rows=True), 7.8, -3.8, 1)
    a('Market stone lane', paving(28, 40, CAP, PATINA, MASONRY), 0, 6.35, height=-0.17)
    a('Lower gate passage', deep_arch(29, 26, 15, 17, MASONRY, BODY), 1.9, 6.25)
    kit.extend('Flagstone tile', (-4, 0, 4, 8))
    kit.move('Castle gatehouse', -4.6, -4.9)
    kit.move('Lower gate passage', -4.6, 3.2, 1)
    kit.move('Merchant counter', 5.15, 1.65, 3)
    kit.move('Wooden bridge', 6.65, 4.85, 1)
    kit.move('Market bench', -3.6, 5.9)
    kit.move('Rune monument', 4.4, -2.13, height=0.8)
    kit.move('Shrine landing', 3.9, -2.11)
    kit.move('Battlement cover', -4.85, -1.1, 1)
    kit.move('Square lantern', 5.45, -0.05, 3)
    a('Gate tower foot', deep_arch(43, 36, 15, 22, MASONRY, PATINA), 0.25, -4.55)
    a('Gate tower cap', gate_tower_cap(), 0.25, -4.55, height=3.6)
    a('Keep high window bay', window_wall(MASONRY, PATINA, brick=True), -3.9, -5.78, height=2.5)
    a('Stone stair return', deep_arch(28, 26, 10, 16, PATINA, MASONRY), 6.0, -6.72, 2)
    a('Keep outer return', clad_wall(39, 33, 7, MASONRY, JOINT), 4.9, -7.27)
    a('Terracotta market awning', pitched_roof(30, 20, DETAIL, WOOD), -2.7, 1.52, height=2.3)
    a('Produce stall frame', stall_frame(), -2.7, 1.44)
    a('Spice box', produce_bin(MARK), -2.65, 2.1, height=0.98)
    a('Cloth goods box', produce_bin(DETAIL), 4.91, 1.8, 3, 0.98)
    a('Empty market bin', produce_bin(), -3.64, 2.52, 1)
    a('Market table', counter(20, 8, WOOD, CAP), -2.76, 2.04)
    a('Damaged wall end', shale_escarpment(PATINA), 8.55, -5.94, 2)
    kit.place('Keep outer return', 0.19, -8.75)
    kit.place('Keep wall', -3.85, -8.75)
    kit.place('Battlement cover', 1.7, -6.4, 1)

    return kit


LEVEL_FACTORIES = (core_kit, heist_kit, industrial_kit, security_kit, creatures_kit, fantasy_kit)


def write_demo(path, kit, models, layout):
    builder = level_builder()
    source_nodes = {}
    scene_nodes = builder.doc['scenes'][0]['nodes']
    nodes = builder.doc['nodes']
    for placement in kit.placements:
        prop_id = placement['propId']
        if prop_id not in source_nodes:
            mesh, colors, surface, lamp = models[prop_id]
            node_index = add_level_mesh(builder, mesh, colors, surface, lamp)
            source_nodes[prop_id] = node_index
        else:
            node_index = len(nodes)
            nodes.append({'mesh': nodes[source_nodes[prop_id]]['mesh']})
            scene_nodes.append(node_index)
        angle = placement['turn'] * math.pi / 4
        nodes[node_index].update({
            'name': f'{prop_id}_{node_index:02d}',
            'translation': placement['position'],
            'rotation': [0, math.sin(angle), 0, math.cos(angle)],
        })
    builder.doc['scenes'][0]['name'] = kit.title
    append_environment(builder.doc, layout)
    builder.write(path)


def main():
    args = vk.script_args('Export the Cubix level kits.', 'stage', 'meta')
    scenes = {}
    entries = {}
    for factory in LEVEL_FACTORIES:
        kit = factory()
        tour, fixtures = build_district(kit, sys.modules[__name__])
        leaf = 'world'
        folder = vk.leaf_dir(args.stage, kit.key, leaf)
        (folder / 'level-kit').mkdir(parents=True, exist_ok=True)
        props = []
        known = set()
        models = {}
        prefabs = {}
        palette = PALETTES[kit.key]
        for prop_id, label, sculpt in kit.props:
            if prop_id in known:
                raise ValueError(f'Duplicate prop {prop_id}.')
            known.add(prop_id)
            grid = make_grid(sculpt)
            prefab = encode_prefab(grid)
            overrides = kit.palettes.get(prop_id)
            surface = kit.surfaces.get(prop_id)
            if overrides:
                prefab['palette'] = overrides
            if surface:
                prefab['surface'] = surface
            prefabs[prop_id] = prefab
            mesh = mesh_from_grid(prop_id, grid)
            relative = f'level-kit/{prop_id}.glb'
            prop_palette = {**palette, **(overrides or {})}
            colors = vertex_colors(mesh, prop_palette)
            lamp = lamp_color(mesh, prop_palette)
            models[prop_id] = mesh, colors, surface, lamp
            builder = level_builder()
            add_level_mesh(builder, mesh, colors, surface, lamp)
            size = builder.write(folder / relative)
            entry = vk.prop_entry(mesh, kit.key, label, relative, size)
            entry['leaf'] = leaf
            if overrides:
                entry['palette'] = overrides
            if surface:
                entry['surface'] = surface
            if prop_id in kit.vehicles:
                vehicle = kit.vehicles[prop_id]
                motion_path = f'vehicles/{prop_id}.glb'
                lights = write_vehicle(folder / motion_path, prop_id, vehicle, prop_palette)
                entry['motion'] = {'relativePath': motion_path, 'clips': list(vehicle.clips), 'lights': lights}
            props.append(entry)
        entries[kit.key] = props
        scene = {
            'title': kit.title, 'route': kit.use, 'placements': kit.placements,
            'view': {**overview_bounds(kit.placements, prefabs), 'eye': tour[0]['eye'],
                     'target': tour[0]['target'], 'stops': tour[1:]},
            'fixtures': fixtures,
            'environment': ENVIRONMENTS[kit.key],
        }
        scenes[kit.key] = scene
        demo_path = folder / 'level-kit/demo.glb'
        write_demo(demo_path, kit, models, scene)
        write_voxel_scene(folder / 'level-kit/demo.voxels.json', kit.key, CELL, palette, prefabs, scene,
                          finishes=FINISHES)
        demo_dir = args.meta.parent / 'level-demos'
        demo_dir.mkdir(parents=True, exist_ok=True)
        copyfile(demo_path, demo_dir / f'{kit.key}.glb')
        print(f'{kit.key}: {len(kit.props)} props and {len(kit.placements)} placements.')
    (args.meta / 'level-props.json').write_text(json.dumps(entries, indent=2) + '\n')
    (args.meta / 'level-scenes.json').write_text(json.dumps(scenes, indent=2) + '\n')


if __name__ == '__main__':
    main()
