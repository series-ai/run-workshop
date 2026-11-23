"""Rock formations and machines for the Emberdeep mining districts."""

from math import cos, isqrt, pi, sin
from random import Random

from creature_kit import Sculpt
from level_geometry import box
from .cavern_masonry import ASH, BASALT, COPPER, FIREBRICK, IRON, PATINA, SHALE
from .common import GLOW, JOINT, MARK, METAL, STONE, WOOD


def ore_face():
    rock = Sculpt()
    for strip in range(13):
        x = -48 + strip * 8
        rise = min(strip, 8) * 2 - max(0, strip - 8) * 4
        front = (4, 7, 11, 10, 7, 4, 8, 10, 9, 7, 5, 2, 1)[strip]
        top = (35, 42, 48, 56, 60, 63, 62, 58, 55, 47, 40, 33, 25)[strip]
        rock.box((x, x + 7), (0, top), (-12, front - 1), BASALT)
        for lo, high, mat, offset in ((4, 9, SHALE, 3), (11, 13, COPPER, 2), (14, 19, FIREBRICK, 1),
                                      (21, 31, STONE, 3), (33, 34, ASH, 4), (35, 39, SHALE, 1)):
            if lo + rise < top:
                rock.box((x, x + 7), (lo + rise, min(top, high + rise)),
                         (-12, front + offset), mat)
        rock.box((x + 1, x + 6), (top, top + 2), (-9, front - 4), JOINT)
    return rock


def flowstone():
    rock = Sculpt()
    for x, z, height, radius in ((-15, -2, 30, 9), (-8, -6, 57, 9), (3, -5, 78, 10),
                                  (11, -3, 52, 7), (19, 2, 25, 6), (-5, 7, 28, 8)):
        for y in range(0, height, 5):
            r = max(1, round(radius * (1 - y / height) ** 1.35))
            drift = y // 14
            box(r * 2 + 1, min(5, height - y), r + 1, STONE, x=x + drift, y=y, z=z, sculpt=rock)
            box(r + 1, min(5, height - y), r * 2 + 1, ASH, x=x + drift, y=y, z=z, sculpt=rock)
            if y < height * 0.65 and r > 3:
                box(2, 4, 2, SHALE, x=x + drift - r // 2, y=y, z=z + r, sculpt=rock)
    return rock


def rail_apron():
    rng = Random(12)
    shape = box(80, 3, 80, BASALT)
    for i in range(53):
        x, z = rng.randint(-34, 34), rng.randint(-35, 35)
        box(rng.randrange(3, 10), 1, rng.randrange(2, 7), (SHALE, JOINT, WOOD)[i % 3],
            x=x, y=2, z=z, sculpt=shape)
    for z in range(-39, 40, 5):
        length = rng.randrange(12, 18)
        shape.box((17, 17 + length), 2, (z, z + 3), WOOD if z % 3 else FIREBRICK)
        shape.box(20, 2, z + 2, METAL)
    return shape


def foundry_floor():
    shape = box(80, 3, 80, JOINT)
    rng = Random(62)
    for row in range(10):
        for x in range(-40 - 6 * (row % 2), 40, 13):
            left, right = max(x + 1, -40), min(x + 12, 39)
            if left <= right:
                shape.box((left, right), 2, (row * 8 - 40, row * 8 - 34),
                          rng.choice((WOOD, FIREBRICK, STONE, FIREBRICK)))
    shape.box((-11, -3), 2, (-40, 39), IRON)
    for z in range(-39, 39, 4):
        shape.box((-10, -4), 2, (z, z + 1), METAL)
    return shape


def vault_pavers():
    shape = box(80, 3, 80, IRON)
    for z in range(-39, 40, 10):
        for x in range(-39, 40, 10):
            shape.box((x, x + 8), 2, (z, z + 8), PATINA if (x + z) % 20 == 2 else BASALT)
    for z in range(-37, 39, 3):
        for radius in (14, 32):
            x = radius - abs(z)
            if x >= 0:
                for side in (-1, 1):
                    box(3, 1, 3, MARK, x=side * x, y=2, z=z, sculpt=shape)
    return shape


def tipple():
    shape = Sculpt()
    for side in (-1, 1):
        for z in (-16, 16):
            x = side * 20
            box(8, 4, 8, STONE, x=x, z=z, sculpt=shape)
            box(5, 52, 5, WOOD, x=x, y=4, z=z, sculpt=shape)
            for y in (7, 31, 50):
                box(6, 2, 6, IRON, x=x, y=y, z=z, sculpt=shape)
        for j in range(8):
            box(4, 5, 6, FIREBRICK, x=side * 20, y=8 + 3 * j, z=-12 + 4 * j, sculpt=shape)
    for z in (-16, 16):
        box(47, 4, 6, WOOD, y=32, z=z, sculpt=shape)
    for level in range(5):
        w, d = 15 + level * 6, 12 + level * 5
        box(w, 4, d, IRON if level in (0, 3) else WOOD, y=27 + 4 * level, sculpt=shape)
    box(43, 2, 33, FIREBRICK, y=47, sculpt=shape)
    for x in (-12, -4, 5, 12):
        box(7, 4 + x % 3, 10, COPPER, x=x, y=47, z=x % 7 - 4, sculpt=shape)
    for i in range(9):
        z = 7 + 3 * i
        box(12, 2, 4, METAL, y=29 - 2 * i, z=z, sculpt=shape)
        for side in (-1, 1):
            box(2, 5, 4, IRON, x=side * 6, y=29 - 2 * i, z=z, sculpt=shape)
    for i in range(9):
        box(6, 2, 42, PATINA if i % 3 else IRON, x=-23 + 6 * i, y=57 - i, z=-2, sculpt=shape)
    return shape


def winding_wheel():
    shape = Sculpt()
    center = 34
    for row in range(-30, 31, 3):
        outer = isqrt(31 ** 2 - row ** 2)
        inner = isqrt(max(0, 26 ** 2 - row ** 2))
        for side in (-1, 1):
            edge = sorted((side * inner, side * outer))
            shape.box(tuple(edge), (center + row, center + row + 2), (-5, 5), WOOD)
            shape.box(tuple(edge), (center + row, center + row + 2), 6, COPPER)
    box(55, 4, 6, FIREBRICK, y=center - 1, sculpt=shape)
    box(4, 55, 6, FIREBRICK, y=center - 26, sculpt=shape)
    for i in range(-6, 7):
        for side in (-1, 1):
            box(5, 5, 5, FIREBRICK, x=i * 3, y=center + side * i * 3, sculpt=shape)
    for i in range(12):
        theta = i * pi / 6
        x, y = round(29 * cos(theta)), center + round(29 * sin(theta))
        box(4, 4, 15, IRON, x=x, y=y, sculpt=shape)
        box(2, 2, 1, MARK, x=x, y=y + 1, z=8, sculpt=shape)
    for w, h in ((20, 9), (16, 15), (10, 19)):
        box(w, h, 18, IRON, y=center - h // 2, sculpt=shape)
    box(8, 8, 25, METAL, y=center - 2, sculpt=shape)
    return shape


def drum_bearings():
    shape = Sculpt()
    center = 34
    for x in (-21, 21):
        box(13, 4, 32, STONE, x=x, sculpt=shape)
    for z in (-12, 12):
        for i in range(8):
            for side in (-1, 1):
                box(5, 5, 4, WOOD, x=side * (21 - i * 2), y=3 + 4 * i, z=z, sculpt=shape)
        box(16, 5, 6, PATINA, y=center, z=z, sculpt=shape)
    return shape


def brake_house():
    shape = Sculpt()
    for x in (-28, 28):
        for z in (-16, 16):
            box(8, 4, 8, STONE, x=x, z=z, sculpt=shape)
            box(5, 35, 5, WOOD, x=x, y=4, z=z, sculpt=shape)
    box(60, 4, 36, WOOD, y=18, sculpt=shape)
    for x in range(-27, 29, 5):
        box(4, 16, 2, PATINA if x % 3 else SHALE, x=x, y=21, z=-16, sculpt=shape)
    for x in (-28, 28):
        box(4, 3, 32, WOOD, x=x, y=32, sculpt=shape)
        for i in range(6):
            box(3, 5, 4, FIREBRICK, x=x, y=5 + 4 * i, z=12 - 4 * i, sculpt=shape)
    for i in range(8):
        for side in (-1, 1):
            z = side * (i * 3)
            box(68, 2, 4, PATINA if i % 3 else COPPER, y=48 - i * 2, z=z, sculpt=shape)
    for z in (-17, 17):
        box(63, 3, 3, WOOD, y=34, z=z, sculpt=shape)
    return shape


def suspension_span():
    shape = Sculpt()
    for x in range(-40, 40, 4):
        depth = 24 + (x // 4 % 3)
        box(4, 2, depth, WOOD if x % 12 else FIREBRICK, x=x + 2, sculpt=shape)
    for side in (-1, 1):
        z = side * 12
        box(80, 2, 2, IRON, y=1, z=z, sculpt=shape)
        box(3, 24, 3, WOOD, x=-38, z=z, sculpt=shape)
        box(4, 2, 4, MARK, x=-38, y=20, z=z, sculpt=shape)
        for x in range(-40, 40, 4):
            y = 8 + round(13 * ((40 - x) / 80) ** 2)
            y_next = 8 + round(13 * ((36 - x) / 80) ** 2)
            box(4, y - y_next + 1, 1, WOOD, x=x + 2, y=y_next, z=z, sculpt=shape)
            if x % 12 == 0 or x == -40:
                box(1, y - 2, 1, IRON, x=x + 2, y=2, z=z, sculpt=shape)
    return shape


def forge_monitor():
    shape = Sculpt()
    for side in (-1, 1):
        for i in range(8):
            box(6, 2, 83, PATINA if i % 3 else COPPER, x=side * (7 + i * 5), y=8 - i,
                sculpt=shape)
    for z in range(-36, 40, 12):
        for x in (-7, 7):
            box(2, 9, 3, IRON, x=x, y=9, z=z, sculpt=shape)
    box(22, 2, 82, COPPER, y=18, sculpt=shape)
    for z in (-35, -5, 24):
        box(24, 1, 2, MARK, y=20, z=z, sculpt=shape)
    return shape


def casting_moulds():
    shape = box(28, 4, 13, BASALT)
    for x in (-9, 0, 9):
        box(6, 5, 8, IRON, x=x, y=4, sculpt=shape)
        box(4, 1, 6, GLOW if x == -9 else COPPER, x=x, y=8, sculpt=shape)
    for x in (-13, 13):
        box(2, 5, 13, FIREBRICK, x=x, y=2, sculpt=shape)
    return shape


def pouring_crucible():
    shape = box(26, 3, 17, BASALT)
    for x in (-11, 11):
        box(4, 16, 6, IRON, x=x, y=3, sculpt=shape)
        box(6, 3, 7, COPPER, x=x, y=16, sculpt=shape)
    for y, width in ((6, 9), (9, 13), (12, 17), (16, 19), (20, 19)):
        box(width, 4, width - 5, IRON if y in (9, 20) else FIREBRICK, y=y, sculpt=shape)
        box(width - 5, 4, width, IRON if y in (9, 20) else FIREBRICK, y=y, sculpt=shape)
    shape.cut((-6, 6), (21, 24), (-5, 5))
    shape.box((-5, 5), 21, (-4, 4), GLOW)
    box(8, 2, 5, IRON, y=20, z=9, sculpt=shape)
    box(4, 1, 4, GLOW, y=21, z=9, sculpt=shape)
    box(2, 5, 2, GLOW, y=16, z=11, sculpt=shape)
    box(29, 3, 3, MARK, y=16, sculpt=shape)
    for y, depth in ((12, 4), (14, 8), (18, 8), (20, 4)):
        box(2, 2, depth, COPPER, x=15, y=y, sculpt=shape)
    return shape


def winding_drum():
    shape = Sculpt()
    for z in range(-13, 15, 3):
        cap = z in (-13, 14)
        radius = 16 if cap else 12
        color = PATINA if cap else (METAL if z % 2 else IRON)
        for x, height in ((radius * 2, radius), (radius * 2 - 4, radius + 8),
                          (radius * 2 - 11, radius * 2)):
            box(x, height, 3, color, y=radius - height // 2 + (0 if cap else 4), z=z, sculpt=shape)
    box(6, 6, 34, MARK, y=13, sculpt=shape)
    return shape


def return_sheave():
    shape = Sculpt()
    for x in (-9, 9):
        box(8, 4, 12, STONE, x=x, sculpt=shape)
        for step in range(7):
            box(5, 6, 6, WOOD, x=x, y=4 + step * 6, z=step, sculpt=shape)
        box(6, 3, 8, IRON, x=x, y=41, z=6, sculpt=shape)
    box(26, 4, 7, IRON, y=46, z=5, sculpt=shape)
    for w, h in ((10, 5), (8, 9), (4, 11)):
        box(5, h, w, COPPER, y=47 - h // 2, z=5, sculpt=shape)
    box(2, 20, 2, IRON, y=24, z=10, sculpt=shape)
    box(9, 12, 6, IRON, y=13, z=10, sculpt=shape)
    box(10, 2, 7, COPPER, y=16, z=10, sculpt=shape)
    return shape


def haul_cable():
    shape = Sculpt()
    for z in range(-35, 35, 5):
        y = round(3 * (z / 35) ** 2)
        box(2, 2, 5, IRON, y=y, z=z + 2, sculpt=shape)
    return shape
