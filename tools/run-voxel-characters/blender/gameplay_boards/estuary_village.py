"""Tide mill, crossing, village trades, and field surfaces for Estuary Front."""

from math import cos, pi, sin
from random import Random

from creature_kit import Sculpt
from level_geometry import box
from .common import BODY, DARK, GLASS, GREEN, JOINT, MARK, METAL, STONE, WOOD


def mill_house():
    shape = box(67, 15, 46, STONE)
    box(69, 2, 48, JOINT, y=14, sculpt=shape)
    box(67, 29, 46, BODY, y=16, sculpt=shape)
    for y in range(19, 43, 5):
        box(68, 1, 47, WOOD, y=y, sculpt=shape)
    for x in (-32, -16, 16, 31):
        box(2, 28, 2, MARK, x=x, y=16, z=23, sculpt=shape)
    for x in (-23, 24):
        box(13, 16, 2, DARK, x=x, y=22, z=23, sculpt=shape)
        for xx in (-3, 3):
            for y in (24, 31):
                box(5, 6, 1, GLASS, x=x + xx, y=y, z=24, sculpt=shape)
        box(15, 2, 4, MARK, x=x, y=20, z=24, sculpt=shape)
    box(16, 22, 2, WOOD, y=18, z=23, sculpt=shape)
    for y in (21, 34):
        box(15, 2, 2, DARK, y=y, z=24, sculpt=shape)
    box(30, 3, 10, WOOD, y=15, z=25, sculpt=shape)
    for x in (-12, 12):
        box(3, 15, 3, DARK, x=x, z=28, sculpt=shape)
    for x in (-28, -19):
        for y in (3, 8):
            box(7, 3, 1, JOINT, x=x + (y % 2), y=y, z=23, sculpt=shape)
    return shape


def mill_roof():
    shape = Sculpt()
    for z in range(-25, 27, 2):
        rise = (26 - abs(z)) * 2 // 3
        box(74, 2, 2, DARK if rise % 5 == 0 else BODY, y=rise, z=z, sculpt=shape)
        if rise:
            for x in (-32, 32):
                box(3, rise, 2, WOOD, x=x, z=z, sculpt=shape)
    box(73, 2, 4, METAL, y=17, sculpt=shape)
    box(12, 12, 13, MARK, x=-16, y=13, sculpt=shape)
    for x in (-18, -14):
        box(2, 5, 1, DARK, x=x, y=18, z=7, sculpt=shape)
    for step in range(5):
        box(18 - step * 3, 2, 19 - step * 3, METAL, x=-16, y=25 + step, sculpt=shape)
    return shape


def paddle_wheel():
    shape = Sculpt()
    for x in (-5, 5):
        for step in range(48):
            angle = 2 * pi * step / 48
            y, z = round(20 * sin(angle)), round(20 * cos(angle))
            box(2, 4, 4, DARK, x=x, y=20 + y, z=z, sculpt=shape)
    for step in range(12):
        angle = 2 * pi * step / 12
        for r in range(3, 21, 2):
            y, z = round(r * sin(angle)), round(r * cos(angle))
            box(2, 3, 3, WOOD, x=-5, y=20 + y, z=z, sculpt=shape)
        y, z = round(21 * sin(angle)), round(21 * cos(angle))
        box(13, 4, 4, BODY, y=20 + y, z=z, sculpt=shape)
    box(25, 5, 5, METAL, y=19, sculpt=shape)
    box(3, 9, 9, DARK, x=-8, y=17, sculpt=shape)
    return shape


def bridge_girder():
    shape = box(80, 3, 3, DARK)
    for x in (-36, -18, 0, 18, 36):
        h = 22 - abs(x) // 5
        box(3, h, 3, BODY, x=x, sculpt=shape)
    for x in range(-39, 40, 3):
        h = 21 - abs(x) // 5
        box(4, 3, 4, BODY, x=x, y=h, sculpt=shape)
    for i, post in enumerate((-36, -18, 0, 18)):
        for step in range(9):
            x = post + step * 2
            y = 3 + (step if i % 2 == 0 else 8 - step) * 2
            box(3, 3, 2, METAL, x=x, y=min(y, 20 - abs(x) // 5), sculpt=shape)
    for x in (-36, -18, 0, 18, 36):
        box(5, 4, 5, DARK, x=x, y=1, sculpt=shape)
        box(1, 1, 1, MARK, x=x, y=3, z=3, sculpt=shape)
    return shape


def poplar():
    shape = box(4, 49, 4, WOOD)
    for x, y, z, width in ((-4, 25, 2, 13), (4, 32, 1, 17), (-3, 41, -2, 17),
                            (3, 51, 0, 14), (-2, 60, -1, 9), (0, 67, 1, 5)):
        box(width, 8, width - 3, BODY, x=x, y=y, z=z, sculpt=shape)
        box(width - 3, 11, width - 2, GREEN, x=x + 1, y=y + 3, z=z - 1, sculpt=shape)
    return shape


def lime_kiln():
    shape = box(48, 4, 44, JOINT)
    for y, width in ((4, 44), (10, 40), (16, 32), (22, 26), (28, 22), (34, 20), (40, 19)):
        box(width, 6, width - 4, STONE, y=y, sculpt=shape)
        box(width - 6, 6, width, STONE, y=y, sculpt=shape)
    box(21, 3, 17, WOOD, y=46, sculpt=shape)
    box(17, 3, 21, WOOD, y=46, sculpt=shape)
    shape.cut((-5, 5), (46, 49), (-5, 5))
    for y, w in ((4, 13), (9, 11), (13, 7)):
        shape.cut((-w // 2, w // 2), (y, y + 3), (6, 22))
    for x, y in ((-12, 10), (11, 8), (7, 24), (-6, 34)):
        box(4, 2, 2, JOINT, x=x, y=y, z=16 if y < 20 else 10, sculpt=shape)
    return shape


def cart_shed():
    shape = box(60, 4, 38, JOINT)
    box(58, 27, 3, WOOD, y=4, z=-16, sculpt=shape)
    for x in (-27, 27):
        box(3, 26, 34, BODY, x=x, y=4, sculpt=shape)
        box(4, 29, 4, DARK, x=x, y=4, z=15, sculpt=shape)
    for x in (-26, -13, 0, 13, 26):
        box(3, 27, 3, DARK, x=x, y=4, z=-14, sculpt=shape)
    for z in range(-19, 21, 2):
        rise = (z + 19) // 4
        box(64, 2, 2, METAL if z % 6 == 1 else BODY, y=28 + rise, z=z, sculpt=shape)
    box(62, 3, 4, WOOD, y=36, z=17, sculpt=shape)
    for z in (-8, 0, 8):
        box(10, 4, 5, WOOD, x=-17, y=4, z=z, sculpt=shape)
        box(12, 4, 5, MARK, x=-17, y=8, z=z, sculpt=shape)
    return shape


def orchard_lodge():
    shape = box(47, 22, 38, STONE)
    for x in (-20, -2, 20):
        box(3, 22, 40, WOOD, x=x, sculpt=shape)
    box(48, 3, 40, WOOD, y=20, sculpt=shape)
    for i in range(7):
        for sign in (-1, 1):
            box(3, 3, 1, WOOD, x=sign * (3 + i * 2), y=4 + i * 2, z=20, sculpt=shape)
    for x in (-10, 10):
        box(8, 9, 2, DARK, x=x, y=9, z=20, sculpt=shape)
        box(5, 6, 1, GLASS, x=x, y=10, z=21, sculpt=shape)
    for x in range(-25, 27, 2):
        y = 23 + (26 - abs(x)) * 3 // 4
        box(2, 3, 43, BODY if (x + 25) % 8 else DARK, x=x, y=y, sculpt=shape)
        if y > 23:
            for z in (-18, 18):
                box(2, y - 23, 2, MARK, x=x, y=23, z=z, sculpt=shape)
    box(6, 19, 6, WOOD, x=13, y=28, z=-9, sculpt=shape)
    box(8, 2, 8, JOINT, x=13, y=46, z=-9, sculpt=shape)
    return shape


def rutted_lane(crossing=False):
    shape = box(80, 3, 80, WOOD)
    for side in (-1, 1):
        for i, extent in enumerate((9, 11, 10, 8, 7, 9, 8, 9)):
            z = i * 10 - 35
            if crossing and abs(z) < 25:
                continue
            box(extent, 1, 10, GREEN, x=side * (40 - (extent + 1) // 2), y=2, z=z, sculpt=shape)

    def rut(along_x):
        for side in (-1, 1):
            for i, slip in enumerate((0, 1, 2, 1, 0, -1, 0, 0)):
                x, z = side * 10 + slip, i * 10 - 35
                w, d = (5, 10)
                if along_x:
                    x, z, w, d = z, x, d, w
                box(w, 1, d, JOINT, x=x, y=2, z=z, sculpt=shape)
                if i in (1, 4, 7):
                    box(w - 1, 1, d - 1, STONE, x=x, y=2, z=z, sculpt=shape)
    rut(False)
    if crossing:
        rut(True)
    rng = Random(42)
    for _ in range(29):
        x, z = rng.randrange(-37, 38), rng.randrange(-37, 38)
        box(rng.randint(1, 4), 1, 2, DARK, x=x, y=2, z=z, sculpt=shape)
    return shape


def grassland(seed, *, furrows=False):
    shape = box(80, 3, 80, GREEN)
    rng = Random(seed)
    for z in range(-35, 37, 9):
        if furrows:
            for x in range(-32, 34, 16):
                box(16, 1, 2, BODY, x=x, y=2, z=z + rng.choice((-1, 0, 1)), sculpt=shape)
        else:
            for _ in range(3):
                x, size = rng.randrange(-28, 29), rng.randrange(4, 15)
                box(size, 1, 3, BODY, x=x, y=2, z=z, sculpt=shape)
                box(size - 2, 1, 3, BODY, x=x + 2, y=2, z=z + 2, sculpt=shape)
    return shape


def tide_gauge():
    shape = box(5, 35, 5, WOOD)
    box(5, 28, 2, MARK, y=5, z=3, sculpt=shape)
    for y in range(6, 33, 3):
        box(4 if y % 2 == 0 else 2, 1, 1, DARK, y=y, z=4, sculpt=shape)
    box(7, 2, 7, METAL, y=34, sculpt=shape)
    return shape


def waypost():
    shape = box(7, 2, 7, STONE)
    box(3, 28, 3, WOOD, y=2, sculpt=shape)
    for x, y, length, face in ((4, 23, 16, DARK), (-4, 18, 14, BODY)):
        box(length, 4, 2, face, x=x, y=y, z=2, sculpt=shape)
        end = x + (length // 2 if x > 0 else -length // 2)
        box(2, 2, 2, face, x=end, y=y + 1, z=2, sculpt=shape)
        box(length - 6, 1, 1, MARK, x=x, y=y + 2, z=3, sculpt=shape)
    return shape
