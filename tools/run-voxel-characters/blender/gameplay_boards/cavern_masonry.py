"""Stonework, furnace parts, and lava for Emberdeep."""

from math import cos, pi, sin
from random import Random

import voxchar as vk
from creature_kit import Sculpt
from level_geometry import box, span
from .common import DARK, GLOW, JOINT, MARK, METAL, STONE, WOOD, glyph

ASH = vk.vox('skin', 0.65)
BASALT = vk.vox('primary', -0.45)
SHALE = vk.vox('primary', 0.55)
FIREBRICK = vk.vox('leather', 0.3)
COPPER = vk.vox('trim', -0.45)
PATINA = vk.vox('detail', -0.22)
IRON = vk.vox('secondary', 0.4)


def flags(seed):
    rng = Random(seed)
    shape = box(80, 3, 80, JOINT)
    for row in range(8):
        x = -40
        while x < 40:
            width = min(rng.randrange(12, 25), 40 - x)
            color = rng.choice((STONE, ASH, STONE, SHALE))
            shape.box((x, x + width - 1), 2, (row * 10 - 39, row * 10 - 31), color)
            shape.box(x, 2, (row * 10 - 39, row * 10 - 31), JOINT)
            if width > 16:
                shape.box((x + 2, x + rng.randint(4, 9)), 2, row * 10 - 39, ASH)
            x += width
    return shape


def lava_tile(seed):
    rng = Random(seed)
    shape = box(80, 3, 80, FIREBRICK)
    for strip, center in enumerate((-29, -8, 19)):
        for iz in range(-40, 40, 4):
            wave = sin(2 * pi * (iz + 40) / 80 + strip + seed / 3)
            x = center + round(wave * (7 + strip) + 2 * sin(4 * pi * iz / 80 + seed))
            width = 4 + round(2 * cos(2 * pi * iz / 80 + strip))
            shape.box((max(-40, x - width), min(39, x + width)), 2, (iz, iz + 3), COPPER)
            if wave > -0.6 or strip == 1:
                w = 1 + int(wave > 0.75)
                shape.box((x - w, x + w - 1), 2, (iz, iz + 3), GLOW)
            if 0 < iz < 28 and strip == 1:
                fork = x + iz // 2
                shape.box((fork - 2, fork + 2), 2, (iz, iz + 3), COPPER)
                shape.box(fork, 2, (iz, iz + 3), GLOW)
    for _ in range(24):
        x, z = rng.randint(-31, 29), rng.randint(-33, 31)
        w, d = rng.randint(4, 9), rng.randint(3, 6)
        shape.box((x - w, x + w), 2, (z - d + 1, z + d - 1), BASALT)
        shape.box((x - w + 3, x + w - 2), 2, (z - d, z + d), DARK)
        shape.box((x - w + 2, x - w + 4), 2, (z - d + 1, z + d - 1), WOOD)
    return shape


def basalt(width, height, depth, seed):
    rng = Random(seed)
    rock = Sculpt()
    x = -width // 2
    while x < width // 2:
        w = min(rng.randint(6, 15), width // 2 - x)
        h = rng.randint(max(5, height * 3 // 5), height)
        z = rng.randint(-depth // 5, depth // 5)
        d = max(5, depth - rng.randint(0, max(1, depth // 4)))
        front = z + d // 2
        rear = z - d // 2
        cap = rng.choice((STONE, SHALE, ASH))
        rock.box((x, x + w - 1), (0, h - 1), (rear, front - 2), BASALT)
        for y in range(0, h - 2, 9):
            lip = rng.randint(0, 3)
            color = rng.choice((BASALT, SHALE, STONE))
            rock.box((x, x + w - 1), (y, min(y + 7, h - 1)), (rear, front + lip), color)
        rock.box((x, x + w - 1), (h - 3, h), (rear, front), cap)
        if w > 6:
            rock.box((x + 2, x + w - 3), (h, h + 2), (rear + 1, front - 2), cap)
        x += w
    return rock


def bank_tongue():
    rock = Sculpt()
    for x, z, width, depth, height in ((0, 0, 58, 32, 12), (-12, 12, 34, 20, 9),
                                        (12, 16, 24, 24, 7), (5, 26, 15, 15, 5),
                                        (-24, 8, 18, 20, 6), (19, -2, 21, 18, 14)):
        box(width, height, depth, BASALT, x=x, z=z, sculpt=rock)
        box(width - 2, 2, depth - 3, SHALE, x=x, y=height - 2, z=z, sculpt=rock)
        box(width - 8, 2, depth - 7, STONE, x=x - 1, y=height, z=z - 1, sculpt=rock)
    return rock


def firebox():
    shape = box(45, 3, 39, IRON)
    for row, width in enumerate((43, 43, 41, 41, 39, 37, 35, 31)):
        y = 3 + row * 4
        d = width - 6
        box(width, 4, d, FIREBRICK if row % 3 else WOOD, y=y, sculpt=shape)
        for x in range(-width // 2 + 6 + row % 2 * 5, width // 2 - 1, 10):
            box(1, 3, 1, JOINT, x=x, y=y, z=(d - 1) // 2, sculpt=shape)
    for y in (4, 8, 12, 16, 20, 24, 28, 32):
        depth = (43, 43, 41, 41, 39, 37, 35, 31)[(y - 4) // 4] - 6
        front = (depth - 1) // 2
        shape.paint((-22, 22), y, front, COPPER)
    for y, w in ((3, 25), (9, 27), (17, 23), (20, 19), (23, 13)):
        shape.cut(span(w), (y, y + (5 if y < 17 else 2)), (0, 22))
    shape.cut((-12, 12), (14, 17), (0, 22))
    shape.box((-12, 12), (3, 17), 0, vk.vox('primary', 0.15))
    hot = vk.vox('visor', 0.4)
    for x, z, width, height in ((-9, 3, 5, 8), (-4, 4, 6, 13), (1, 2, 7, 10),
                                (6, 4, 5, 15), (10, 3, 4, 6), (-2, 8, 8, 5)):
        box(width, height, 3, hot, x=x, y=3, z=z, sculpt=shape)
        box(max(2, width - 2), height - 2, 2, GLOW, x=x, y=3, z=z + 2, sculpt=shape)
        box(2, 2, 2, hot, x=x + 1, y=height + 3, z=z + 1, sculpt=shape)
    for x in range(-11, 12, 3):
        box(3, 3 + (x + 11) % 4, 4, IRON if x % 2 else COPPER, x=x, y=3, z=11, sculpt=shape)
    for x in range(-11, 12, 4):
        box(1, 7, 2, IRON, x=x, y=4, z=13, sculpt=shape)
    for x in (-17, 17):
        box(4, 19, 5, ASH, x=x, y=3, z=15, sculpt=shape)
        for y in (6, 15):
            box(5, 2, 6, COPPER, x=x, y=y, z=15, sculpt=shape)
    for x, y in ((-13, 20), (-9, 23), (-4, 25), (1, 25), (6, 24), (11, 22), (14, 19)):
        box(5, 5, 5, ASH, x=x, y=y, z=14, sculpt=shape)
    for y, width, depth in ((34, 31, 26), (36, 25, 22), (38, 19, 17), (40, 15, 14)):
        box(width, 3, depth, IRON, y=y, sculpt=shape)
        box(width, 1, depth, COPPER, y=y + 2, sculpt=shape)
    box(13, 19, 12, PATINA, y=42, sculpt=shape)
    for y in (44, 53, 60):
        box(15, 2, 14, MARK, y=y, sculpt=shape)
    box(29, 3, 9, BASALT, y=2, z=18, sculpt=shape)
    return shape


def hall_rib(width, height):
    shape = Sculpt()
    half = width // 2
    for side in (-1, 1):
        x = (half - 5) * side
        box(11, 4, 12, BASALT, x=x, sculpt=shape)
        box(8, height - 8, 8, STONE, x=x, y=4, sculpt=shape)
        box(3, height - 11, 2, ASH, x=x, y=5, z=4, sculpt=shape)
        for y in range(9, height - 13, 7):
            box(8, 1, 9, JOINT, x=x, y=y, sculpt=shape)
        for y in (5, height - 15, height - 8):
            box(10, 2, 11, COPPER, x=x, y=y, sculpt=shape)
        for step in range(5):
            box(9, 5, 8, ASH, x=x - side * (step * 3 + 2), y=height - 13 + 2 * step, sculpt=shape)
    box(width, 5, 10, STONE, y=height - 4, sculpt=shape)
    box(width - 3, 1, 11, COPPER, y=height, sculpt=shape)
    box(8, 6, 12, ASH, y=height - 6, sculpt=shape)
    return shape


def wall_bay():
    shape = box(46, 48, 6, BASALT)
    for row in range(7):
        y = row * 7
        for x in range(-24 - row % 2 * 7, 23, 14):
            shape.box((max(-23, x + 1), min(22, x + 13)), (y, min(47, y + 5)), 3,
                      (STONE, JOINT, SHALE)[(x // 7 + row) % 3])
    for x in (-17, 17):
        box(6, 50, 5, STONE, x=x, z=4, sculpt=shape)
        box(7, 2, 6, COPPER, x=x, y=31, z=4, sculpt=shape)
    return shape


def roof_bay():
    shape = box(39, 2, 83, IRON)
    for side in (-1, 1):
        for step in range(5):
            x = side * (21 + step * 5)
            box(6, 2, 83, BASALT, x=x, y=4 - step, sculpt=shape)
    for z in (-40, -13, 13, 40):
        box(82, 2, 2, COPPER, y=1, z=z, sculpt=shape)
    return shape


def draught_main():
    shape = Sculpt()
    for z in (-22, 22):
        box(9, 4, 10, BASALT, z=z, sculpt=shape)
        box(6, 39, 6, IRON, y=4, z=z, sculpt=shape)
        box(14, 3, 9, MARK, y=40, z=z, sculpt=shape)
    for w, h, bottom in ((7, 14, 43), (11, 10, 45), (15, 6, 47)):
        box(w, h, 56, PATINA, y=bottom, sculpt=shape)
    for z in (-26, -13, 0, 13, 26):
        box(14, 12, 2, COPPER, y=44, z=z, sculpt=shape)
        box(17, 8, 2, MARK, y=46, z=z, sculpt=shape)
    for z in (-20, 20):
        box(3, 12, 4, COPPER, x=5, y=34, z=z, sculpt=shape)
    return shape


def sill_lamp():
    shape = box(8, 4, 9, BASALT)
    box(5, 9, 5, COPPER, y=4, sculpt=shape)
    box(8, 2, 8, IRON, y=13, sculpt=shape)
    box(3, 6, 3, GLOW, y=15, sculpt=shape)
    for x in (-3, 3):
        for z in (-3, 3):
            box(1, 8, 1, IRON, x=x, y=15, z=z, sculpt=shape)
    box(8, 2, 8, MARK, y=22, sculpt=shape)
    box(5, 2, 5, IRON, y=24, sculpt=shape)
    return shape


def vault_seal():
    shape = box(36, 37, 7, IRON)
    for x in range(-16, 18, 5):
        box(4, 32, 2, PATINA, x=x, y=2, z=4, sculpt=shape)
    for x in (-17, 17):
        box(2, 37, 4, MARK, x=x, z=5, sculpt=shape)
    for y in (2, 33):
        box(33, 2, 4, MARK, y=y, z=5, sculpt=shape)
    for step in range(48):
        angle = step * pi / 24
        x, y = round(12 * cos(angle)), round(12 * sin(angle)) + 18
        box(3, 3, 3, COPPER, x=x, y=y, z=6, sculpt=shape)
    for side in (-1, 1):
        for step in range(7):
            box(2, 2, 4, MARK, x=side * (step + 3), y=18 + step, z=7, sculpt=shape)
            box(2, 2, 4, MARK, x=side * (step + 3), y=18 - step, z=7, sculpt=shape)
    box(7, 7, 4, IRON, y=16, z=7, sculpt=shape)
    glyph(shape, ('.#.', '#.#', '.#.'), -2, 16, 10, MARK, 2)
    return shape


def cavern_crown(seed):
    rng = Random(seed)
    rock = Sculpt()
    for x in range(-50, 46, 13):
        z = rng.randint(-8, 7)
        bottom = rng.randint(7, 17)
        reach = rng.randint(34, 55)
        rock.box((x, x + 18), (bottom, 25), (z - 28, z + reach), BASALT)
        rock.box((x - 2, x + 20), (21, 27), (z - 25, z + reach - 4), SHALE)
        ridge = rng.randint(3, 15)
        rock.box((x, x + 17), (27, 27 + ridge), (z - 21, z + reach - 11), STONE)
        rock.box((x + 2, x + 13), (27 + ridge, 29 + ridge), (z - 14, z + reach - 17), ASH)
        rock.box((x + 3, x + 14), (bottom - 4, bottom - 1), (z - 15, z + reach - 5), STONE)
        if x % 3:
            front = z + reach - rng.randint(9, 19)
            for width, drop in ((8, 4), (5, 7), (2, 10)):
                box(width, drop, width, JOINT, x=x + 8, y=bottom - 3 - drop, z=front, sculpt=rock)
    return rock


def bridge_spandrel():
    shape = Sculpt()
    for side in (-1, 1):
        z = side * 14
        for x in range(-40, 40, 4):
            depth = 3 + (abs(x + 2) // 8) ** 2 // 2
            shape.box((x, x + 3), (14 - depth, 14), (z - 2, z + 2), STONE)
            shape.box((x, x + 3), 14 - depth, (z - 3, z + 3), ASH)
        box(80, 2, 7, COPPER, y=14, z=z, sculpt=shape)
    return shape


def slag_floor():
    rng = Random(32)
    shape = box(80, 3, 80, STONE)
    for _ in range(18):
        x, z = rng.randint(-31, 31), rng.randint(-32, 32)
        w = rng.randint(5, 9)
        for j in range(3):
            shape.box((x - w + j * 2, x + w), 2, (z + j * 2, z + j * 2 + 1),
                      (JOINT, SHALE, JOINT)[j])
    return shape



def lava_tunnel():
    rng = Random(41)
    shape = Sculpt()
    for x in range(-96, 96, 8):
        edge = abs(x + 4)
        sill = max(0, 36 - max(0, edge - 18) // 3)
        if edge > 56:
            sill = max(0, 22 - (edge - 56))
        reach = rng.randrange(12, 31)
        top = rng.randrange(50, 59) + max(0, edge - 56) // 3
        shape.box((x, x + 7), (sill, top), (-18, reach - 5), BASALT)
        shape.box((x, x + 7), (sill + 2, top - 2), (reach - 5, reach), SHALE)
        shape.box((x, x + 7), (top - 2, top + 2), (-16, reach - 2), STONE)
        shape.box((x, x + 7), (sill, sill + 2), (2, reach + 1), JOINT)
        if edge > 52:
            shape.box((x, x + 7), (2, 9), (reach - 9, reach + 7), BASALT)
    return shape


def smiths_anvil():
    shape = box(15, 3, 13, BASALT)
    for width, depth, height, y in ((13, 13, 5, 3), (12, 12, 4, 8)):
        box(width, height, depth, WOOD, y=y, sculpt=shape)
    box(14, 2, 14, IRON, y=6, sculpt=shape)
    box(12, 2, 9, METAL, y=12, sculpt=shape)
    box(7, 3, 7, IRON, y=14, sculpt=shape)
    box(18, 3, 8, METAL, y=17, sculpt=shape)
    for i in range(3):
        box(3, 3 - i, 6 - i * 2, METAL, x=9 + i * 2, y=17 + i, sculpt=shape)
    box(4, 2, 4, IRON, x=-4, y=20, sculpt=shape)
    box(2, 1, 8, WOOD, x=-4, y=20, z=5, sculpt=shape)
    return shape


def cooling_bath():
    shape = box(24, 3, 11, BASALT)
    box(22, 6, 9, PATINA, y=3, sculpt=shape)
    shape.cut((-9, 8), (6, 8), (-3, 2))
    shape.box((-9, 8), 6, (-3, 2), vk.vox('visor', -0.35))
    for x in (-8, 7):
        for z in (-5, 4):
            box(2, 8, 1, COPPER, x=x, y=1, z=z, sculpt=shape)
    return shape


def hanging_standard():
    shape = box(16, 1, 2, MARK, y=27)
    for x in (-5, 5):
        box(1, 4, 2, COPPER, x=x, y=28, sculpt=shape)
    for x in range(-6, 7):
        low = abs(x) // 2
        shape.box(x, (low, 26), 0, PATINA)
        shape.box(x, (low, low + 1), 1, MARK)
    for x in (-6, 6):
        box(1, 25, 1, MARK, x=x, y=2, z=1, sculpt=shape)
    glyph(shape, ('..#..', '.#.#.', '#.#.#', '.#.#.', '..#..', '..#..'), -4, 7, 1, MARK, 2)
    return shape


def brass_sconce():
    shape = box(8, 2, 7, BASALT)
    box(4, 8, 4, IRON, y=2, sculpt=shape)
    box(5, 8, 5, COPPER, y=9, sculpt=shape)
    for width, y in ((7, 15), (9, 17), (11, 19)):
        box(width, 2, width, MARK, y=y, sculpt=shape)
    box(7, 2, 7, WOOD, y=21, sculpt=shape)
    for x, z, h in ((-2, 0, 3), (0, -1, 5), (2, 1, 2)):
        box(2, h, 2, GLOW, x=x, y=22, z=z, sculpt=shape)
    return shape


def pressure_regulator():
    shape = box(14, 3, 13, BASALT)
    for x in (-5, 5):
        box(3, 7, 7, IRON, x=x, y=3, sculpt=shape)
    for width, depth in ((11, 15), (15, 11)):
        box(width, 18, depth, PATINA, y=8, sculpt=shape)
    for y in (9, 23):
        box(12, 2, 16, COPPER, y=y, sculpt=shape)
        box(16, 2, 12, MARK, y=y, sculpt=shape)
    box(10, 3, 10, COPPER, y=26, sculpt=shape)
    box(5, 12, 5, PATINA, y=29, sculpt=shape)
    box(13, 4, 5, PATINA, x=4, y=38, sculpt=shape)
    box(3, 6, 7, COPPER, x=9, y=37, sculpt=shape)
    for x, y in ((0, 29), (-3, 26), (3, 26), (-3, 23), (3, 23), (0, 21)):
        box(3, 3, 2, MARK, x=x, y=y, z=8, sculpt=shape)
    box(6, 1, 3, MARK, y=26, z=8, sculpt=shape)
    box(2, 6, 3, MARK, y=23, z=8, sculpt=shape)
    box(1, 8, 2, ASH, x=-4, y=12, z=7, sculpt=shape)
    return shape


def pendant():
    shape = Sculpt()
    for y, width, color in ((0, 5, IRON), (1, 7, COPPER), (7, 9, IRON),
                            (8, 7, COPPER), (9, 5, COPPER), (10, 3, MARK)):
        box(width, 1, width, color, y=y, sculpt=shape)
    box(3, 5, 3, GLOW, y=2, sculpt=shape)
    for x, z in ((-2, -2), (-2, 2), (2, -2), (2, 2)):
        box(1, 5, 1, IRON, x=x, y=2, z=z, sculpt=shape)
    box(1, 10, 1, IRON, y=11, sculpt=shape)
    return shape


def lava_spring():
    rock = Sculpt()
    rng = Random(62)
    for x in range(-86, 86, 9):
        rise = rng.randint(31, 43)
        z = rng.randint(-2, 4)
        rock.box((x, x + 8), (0, rise), (-5, z + 4), BASALT)
        if -30 < x < 40:
            height = rng.randint(4, 14)
            rock.box((x + 1, x + 5), (0, height), (z + 4, z + 5), WOOD)
            rock.box((x + 2, x + 3), (0, height - 2), z + 6, GLOW)
    return rock
