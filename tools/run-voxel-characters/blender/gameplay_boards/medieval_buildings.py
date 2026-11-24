"""Masonry, timber shops, and workshop fittings for Alderwick."""

from random import Random

import build_level_props as lp
from creature_kit import Sculpt
from level_geometry import box, span

from .common import BODY, DARK, GLASS, GLOW, GREEN, JOINT, MARK, METAL, STONE, WOOD, arch


def masonry(shape, x, z, width, depth, height, *, bottom=0):
    box(width, height, depth, STONE, x=x, y=bottom, z=z, sculpt=shape)
    for y in range(bottom + 4, bottom + height, 5):
        for edge_z in span(depth, z):
            box(width, 1, 1, JOINT, x=x, y=y, z=edge_z, sculpt=shape)
        for edge_x in span(width, x):
            box(1, 1, depth, JOINT, x=edge_x, y=y, z=z, sculpt=shape)


def timber_house(width, depth, height, door=25):
    shape = Sculpt()
    west, east = span(width)
    front, back = span(depth)
    for z in (front + 2, back - 2):
        box(width, height, 5, MARK, z=z, sculpt=shape)
        box(width, 8, 5, STONE, z=z, sculpt=shape)
        for x in (west + 2, east - 2, -width // 4, width // 4):
            box(5, height, 5, DARK, x=x, z=z, sculpt=shape)
    for x in (west + 2, east - 2):
        box(5, height, depth, MARK, x=x, sculpt=shape)
        box(5, 8, depth, STONE, x=x, sculpt=shape)
        for z in (front + 2, back - 2, 0):
            box(5, height, 6, DARK, x=x, z=z, sculpt=shape)
    for y in (7, 30, height - 4):
        for z in (front + 2, back - 2):
            box(width, 4, 5, DARK, y=y, z=z, sculpt=shape)
        for x in (west + 2, east - 2):
            box(5, 4, depth, DARK, x=x, y=y, sculpt=shape)
    shape.cut(span(door), (0, 28), (front, front + 5))
    for x in (-width // 3, width // 3):
        shape.cut(span(12, x), (14, 25), (front, front + 5))
        box(14, 2, 5, WOOD, x=x, y=13, z=front + 2, sculpt=shape)
        box(2, 11, 2, WOOD, x=x, y=15, z=front + 2, sculpt=shape)
        box(10, 10, 1, GLASS, x=x, y=15, z=front + 4, sculpt=shape)
    for step in range(6):
        for side in (-1, 1):
            x = side * (width // 2 - 8 - step * 2)
            box(3, 3, 1, WOOD, x=x, y=32 + 2 * step, z=front, sculpt=shape)
    return shape


def pitched_roof(width, depth, rise, *, ridge=BODY):
    shape = Sculpt()
    for step in range(rise):
        half = max(1, round(width / 2 * (rise - step) / rise))
        box(half * 2, 2, depth, ridge, y=step, sculpt=shape)
        if step % 4 == 0:
            for x in (-half, half - 1):
                box(1, 1, depth, DARK, x=x, y=step + 1, sculpt=shape)
    box(4, 3, depth + 2, WOOD, y=rise, sculpt=shape)
    for z in (-depth // 2, depth // 2 - 1):
        for step in range(0, rise, 2):
            half = max(1, round(width / 2 * (rise - step) / rise))
            for x in (-half, half - 1):
                box(3, 2, 2, DARK, x=x, y=step, z=z, sculpt=shape)
    return shape


def watchtower():
    shape = Sculpt()
    masonry(shape, 0, 0, 45, 45, 77)
    for x in (-20, 19):
        for z in (-20, 19):
            box(6, 78, 6, STONE, x=x, z=z, sculpt=shape)
    for y in (5, 62, 74):
        box(49, 3, 49, STONE, y=y, sculpt=shape)
    for y in (38, 54):
        shape.cut(span(4), (y, y + 9), (-22, -18))
        box(4, 9, 1, DARK, y=y, z=-20, sculpt=shape)
    for x in (-18, 0, 18):
        for z in (-22, 22):
            box(9, 9, 5, STONE, x=x, y=76, z=z, sculpt=shape)
    for z in (-13, 0, 13):
        for x in (-22, 22):
            box(5, 9, 8, STONE, x=x, y=76, z=z, sculpt=shape)
    return shape


def curtain(width):
    shape = lp.panel(width, 48, 12, STONE, JOINT, rows=True)
    box(width, 3, 15, STONE, y=42, sculpt=shape)
    for x in range(-width // 2 + 5, width // 2 - 3, 11):
        box(6, 8, 13, STONE, x=x, y=48, sculpt=shape)
    return shape


def keep_shell():
    width, depth, height = 140, 106, 59
    shape = Sculpt()
    masonry(shape, 0, -50, width, 6, height)
    masonry(shape, 0, 50, width, 6, height)
    for x in (-67, 67):
        masonry(shape, x, 0, 6, 94, height)
    shape.cut(span(28), (0, 31), (-53, -46))
    shape.cut(span(22), (32, 36), (-53, -46))
    for x in (-43, 43):
        shape.cut(span(11, x), (27, 43), (-53, -46))
        box(2, 14, 1, DARK, x=x, y=29, z=-49, sculpt=shape)
        box(12, 2, 7, STONE, x=x, y=26, z=-50, sculpt=shape)
    for x in (-64, -21, 21, 64):
        box(6, 56, 7, STONE, x=x, z=-51, sculpt=shape)
        box(8, 6, 8, STONE, x=x, y=48, z=-51, sculpt=shape)
    return shape


def banner(width=12, height=33):
    shape = box(width + 6, 2, 3, WOOD, y=height)
    for column in range(-width // 2, width // 2):
        bottom = abs(column) // 2
        box(1, height - bottom, 2, BODY, x=column, y=bottom, sculpt=shape)
        if column in (-width // 2 + 1, width // 2 - 2):
            box(1, height - bottom, 1, MARK, x=column, y=bottom, z=-1, sculpt=shape)
    for y in range(9, 23):
        w = max(1, 8 - abs(15 - y))
        box(w, 1, 1, MARK, y=y, z=-1, sculpt=shape)
    box(1, 5, 1, DARK, y=13, z=-2, sculpt=shape)
    return shape


def smith_hearth():
    shape = arch(28, 32, 16, 15)
    box(20, 3, 23, JOINT, y=0, z=-1, sculpt=shape)
    box(13, 2, 10, DARK, y=3, z=-3, sculpt=shape)
    for x, z, h in ((-4, -5, 4), (4, -4, 5), (0, -6, 7), (3, 0, 3)):
        box(4, h, 3, GLOW, x=x, y=4, z=z, sculpt=shape)
    box(18, 14, 14, JOINT, y=28, z=2, sculpt=shape)
    box(20, 2, 16, STONE, y=42, z=2, sculpt=shape)
    return shape


def workbench(width, depth, *, tools=False):
    shape = box(width, 3, depth, WOOD, y=8)
    for x in (-width // 2 + 2, width // 2 - 2):
        for z in (-depth // 2 + 2, depth // 2 - 2):
            box(3, 8, 3, DARK, x=x, z=z, sculpt=shape)
    if tools:
        box(8, 1, 3, WOOD, x=-4, y=11, sculpt=shape)
        box(3, 3, 4, METAL, x=-8, y=11, sculpt=shape)
        box(5, 3, 4, DARK, x=7, y=11, sculpt=shape)
        for x in (6, 8):
            box(1, 2, 6, METAL, x=x, y=13, sculpt=shape)
    return shape


def apothecary_shelf():
    shape = Sculpt()
    for x in (-13, 13):
        box(3, 23, 10, DARK, x=x, sculpt=shape)
    for row, y in enumerate((3, 10, 17)):
        box(29, 2, 11, WOOD, y=y, sculpt=shape)
        for i, x in enumerate(range(-10, 11, 4)):
            h = 2 + (i + 2 * row) % 3
            box(3, h, 4, (GLASS, GREEN, BODY)[(row + i) % 3], x=x, y=y + 2, sculpt=shape)
            box(1, 1, 2, MARK, x=x, y=y + 2 + h, sculpt=shape)
            box(2, 1, 1, MARK, x=x, y=y + 3, z=-3, sculpt=shape)
    return shape


def produce_bed(width, depth, seed, *, flowers=False):
    rng = Random(seed)
    shape = box(width, 3, depth, DARK)
    for x in (-width // 2 + 1, width // 2 - 1):
        box(2, 4, depth, WOOD, x=x, sculpt=shape)
    for z in (-depth // 2 + 1, depth // 2 - 1):
        box(width, 4, 2, WOOD, z=z, sculpt=shape)
    for x in range(-width // 2 + 4, width // 2 - 3, 5):
        for z in range(-depth // 2 + 4, depth // 2 - 3, 6):
            h = rng.randrange(2, 6)
            box(3, h, 3, GREEN, x=x, y=3, z=z, sculpt=shape)
            if flowers and rng.randrange(3):
                box(2, 1, 2, (BODY, MARK)[rng.randrange(2)], x=x, y=3 + h, z=z, sculpt=shape)
    return shape


def market_stall(width=29):
    depth = 25
    shape = Sculpt()
    for x in (-width // 2 + 2, width // 2 - 2):
        for z in (-10, 10):
            box(3, 24, 3, DARK, x=x, z=z, sculpt=shape)
    box(width, 2, depth, WOOD, y=24, sculpt=shape)
    for x in range(-width // 2, width // 2, 5):
        color = BODY if x % 2 else MARK
        box(5, 2, depth + 2, color, x=x, y=25, sculpt=shape)
        box(5, 3, 2, color, x=x, y=23, z=-13, sculpt=shape)
    box(width - 3, 9, 8, WOOD, z=4, sculpt=shape)
    for i, x in enumerate(range(-width // 2 + 5, width // 2 - 3, 6)):
        box(5, 2, 7, DARK, x=x, y=9, z=4, sculpt=shape)
        for z in (2, 5):
            box(3, 2, 3, (GREEN, MARK, BODY)[i % 3], x=x, y=11, z=z, sculpt=shape)
    return shape


def raised_gate():
    shape = Sculpt()
    for x in range(-16, 18, 4):
        box(2, 19, 2, WOOD, x=x, y=2, sculpt=shape)
        box(2, 2, 2, METAL, x=x, sculpt=shape)
    for y in (6, 14, 19):
        box(36, 2, 3, DARK, y=y, sculpt=shape)
        for x in range(-16, 18, 4):
            box(1, 1, 1, METAL, x=x, y=y, z=-2, sculpt=shape)
    return shape


def chapel_shell():
    shape = Sculpt()
    for z in (-43, 43):
        masonry(shape, 0, z, 70, 6, 52)
    for x in (-33, 33):
        masonry(shape, x, 0, 6, 81, 52)
    shape.cut(span(19), (0, 27), (-47, -39))
    shape.cut(span(13), (28, 32), (-47, -39))
    for x in (-33, 33):
        for z in (-22, 0, 22):
            shape.cut(span(7, x), (20, 37), span(9, z))
            box(1, 15, 7, GLASS, x=x, y=21, z=z, sculpt=shape)
            box(8, 2, 11, STONE, x=x, y=19, z=z, sculpt=shape)
    for x in (-32, 32):
        for z in (-42, 42):
            box(7, 40, 8, STONE, x=x, z=z, sculpt=shape)
    return shape


def belfry():
    shape = Sculpt()
    masonry(shape, 0, 0, 26, 26, 66)
    box(29, 3, 29, STONE, y=63, sculpt=shape)
    for x in (-11, 11):
        for z in (-11, 11):
            box(5, 19, 5, STONE, x=x, y=65, z=z, sculpt=shape)
    box(29, 2, 29, STONE, y=82, sculpt=shape)
    box(24, 2, 3, WOOD, y=78, sculpt=shape)
    return shape


def bell():
    shape = box(11, 2, 10, MARK)
    box(8, 3, 8, METAL, y=2, sculpt=shape)
    box(6, 3, 6, METAL, y=5, sculpt=shape)
    box(3, 4, 3, DARK, y=8, sculpt=shape)
    return shape


def chandelier():
    shape = Sculpt()
    for x in (-7, 7):
        box(2, 3, 15, METAL, x=x, sculpt=shape)
    for z in (-7, 7):
        box(15, 3, 2, METAL, z=z, sculpt=shape)
    box(14, 1, 2, DARK, y=1, sculpt=shape)
    box(2, 1, 14, DARK, y=1, sculpt=shape)
    box(2, 24, 2, DARK, y=1, sculpt=shape)
    for x in (-7, 7):
        for z in (-7, 0, 7):
            box(3, 1, 3, WOOD, x=x, y=3, z=z, sculpt=shape)
            box(2, 3, 2, MARK, x=x, y=4, z=z, sculpt=shape)
            box(1, 2, 1, GLOW, x=x, y=7, z=z, sculpt=shape)
    return shape
