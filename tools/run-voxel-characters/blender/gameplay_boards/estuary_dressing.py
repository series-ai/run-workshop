"""Working yards, road edges, and dock detail for Estuary Front."""

from random import Random

import build_level_props as lp
from creature_kit import Sculpt
from level_geometry import CELL, box, grounded_center, span
from .common import BODY, DARK, GLASS, GLOW, GREEN, JOINT, MARK, METAL, STONE, WOOD, arch, glyph
from .estuary import alder


def packhouse(width, depth, height):
    shape = box(width, 3, depth, STONE)
    for z in (-depth // 2 + 2, depth // 2 - 2):
        box(width, height, 3, BODY, y=3, z=z, sculpt=shape)
        for y in range(7, height, 4):
            box(width, 1, 1, WOOD, y=y, z=z + (2 if z > 0 else -2), sculpt=shape)
    for x in (-width // 2 + 1, width // 2 - 1):
        box(3, height, depth, BODY, x=x, y=3, sculpt=shape)
        box(5, 4, depth, JOINT, x=x, sculpt=shape)
    front = depth // 2 - 2
    shape.cut(span(26, 7), (3, 27), (front - 2, front + 3))
    for x in (-width // 2 + 3, -6, 20, width // 2 - 3):
        box(3, height, 5, DARK, x=x, y=3, z=front, sculpt=shape)
    for x in (-width // 2 + 10, -width // 2 + 23):
        box(11, 12, 5, DARK, x=x, y=15, z=front, sculpt=shape)
        for y in (17, 22):
            for dx in (-2, 2):
                box(3, 4, 1, GLASS, x=x + dx, y=y, z=front + 3, sculpt=shape)
        box(12, 2, 6, MARK, x=x, y=14, z=front + 1, sculpt=shape)
    box(width - 4, 2, depth - 4, WOOD, y=height + 1, sculpt=shape)
    return shape


def ribbed_roof(width, depth, rise):
    shape = Sculpt()
    for x in range(-width // 2, width // 2, 2):
        y = max(0, (width // 2 - abs(x)) * rise // (width // 2))
        box(2, 3, depth, METAL if x % 8 == 0 else BODY, x=x, y=y, sculpt=shape)
    for z in (-depth // 2 + 1, depth // 2 - 1):
        for x in range(-width // 2, width // 2, 2):
            y = max(0, (width // 2 - abs(x)) * rise // (width // 2))
            box(2, 2, 2, DARK, x=x, y=y - 1, z=z, sculpt=shape)
    box(4, 3, depth + 2, DARK, y=rise + 2, sculpt=shape)
    return shape


def awning(width, depth, *, canvas=False):
    shape = Sculpt()
    for x in (-width // 2 + 2, width // 2 - 2):
        for z in (-depth // 2 + 2, depth // 2 - 2):
            box(4, 29, 4, WOOD, x=x, z=z, sculpt=shape)
            box(5, 4, 5, JOINT, x=x, z=z, sculpt=shape)
    for x in range(-width // 2 + 3, width // 2, 6):
        box(6, 2, depth, MARK if canvas and x % 4 else BODY, x=x, y=30, sculpt=shape)
        box(3, 1, depth + 2, DARK, x=x, y=32, sculpt=shape)
        box(6, 3, 2, BODY, x=x, y=27, z=depth // 2, sculpt=shape)
    for z in (-depth // 2 + 2, depth // 2 - 2):
        box(width, 3, 3, WOOD, y=27, z=z, sculpt=shape)
    return shape


def crate_bank(seed, *, produce=False):
    rng = Random(seed)
    shape = box(30, 2, 16, DARK)
    for x, bottom, width, depth in ((-8, 2, 12, 12), (6, 2, 13, 14), (-8, 9, 11, 10)):
        box(width, 7, depth, WOOD, x=x, y=bottom, sculpt=shape)
        box(width + 1, 1, depth + 1, MARK, x=x, y=bottom + 1, sculpt=shape)
        for z in (-depth // 2 - 1, depth // 2):
            for dx in (-width // 2 + 1, width // 2 - 1):
                box(2, 7, 2, DARK, x=x + dx, y=bottom, z=z, sculpt=shape)
        if produce:
            box(width - 1, 1, depth - 1, DARK, x=x, y=bottom + 7, sculpt=shape)
            for j in range(9):
                box(2, rng.randrange(1, 3), 2, GREEN if j % 2 else BODY,
                    x=x + rng.randrange(-4, 5), y=bottom + 8, z=rng.randrange(-3, 4), sculpt=shape)
        else:
            box(width - 2, 1, depth - 1, WOOD, x=x, y=bottom + 7, sculpt=shape)
        box(4, 3, 1, MARK, x=x, y=bottom + 3, z=depth // 2 + 1, sculpt=shape)
    return shape


def notice_board(rows, width):
    shape = Sculpt()
    for x in (-width // 2 + 2, width // 2 - 2):
        box(2, 19, 3, WOOD, x=x, sculpt=shape)
    box(width, 9, 3, DARK, y=13, sculpt=shape)
    box(width - 2, 7, 1, BODY, y=14, z=2, sculpt=shape)
    glyph(shape, rows, -len(rows[0]) // 2, 15, 3, MARK)
    return shape


def post_lamp():
    shape = box(6, 2, 6, JOINT)
    box(2, 31, 2, WOOD, y=2, sculpt=shape)
    box(10, 2, 2, METAL, x=4, y=31, sculpt=shape)
    box(5, 2, 5, DARK, x=8, y=29, sculpt=shape)
    box(4, 1, 4, GLOW, x=8, y=28, sculpt=shape)
    return shape


def reed_strip(seed):
    rng = Random(seed)
    shape = Sculpt()
    for _ in range(19):
        x, z = rng.randrange(-17, 19), rng.randrange(-3, 4)
        height = rng.randrange(2, 8)
        box(1, height, 2, GREEN if height < 6 else MARK, x=x, z=z, sculpt=shape)
        if height > 5:
            box(2, 2, 1, BODY, x=x, y=height - 1, z=z, sculpt=shape)
    return shape


def orchard_windbreak(seed):
    rng = Random(seed)
    shape = Sculpt()
    for x in range(-31, 35, 8):
        height = rng.randrange(7, 14)
        box(9, height - 2, 9, BODY, x=x, z=rng.randrange(-2, 3), sculpt=shape)
        box(6, 4, 7, GREEN, x=x - 1, y=height - 4, sculpt=shape)
        box(7, 2, 3, GREEN, x=x - 1, y=height - 6, z=5, sculpt=shape)
    for x in (-26, 1, 27):
        box(2, 13, 2, WOOD, x=x, z=5, sculpt=shape)
    for y in (5, 10):
        box(68, 1, 1, WOOD, y=y, z=6, sculpt=shape)
    return shape


def produce_scales():
    shape = box(21, 3, 11, WOOD)
    for x in (-8, 8):
        box(3, 12, 3, DARK, x=x, y=3, sculpt=shape)
    box(21, 2, 12, MARK, y=13, sculpt=shape)
    box(7, 2, 7, METAL, x=-5, y=15, sculpt=shape)
    box(5, 5, 5, BODY, x=-5, y=17, sculpt=shape)
    box(5, 4, 1, MARK, x=-5, y=18, z=3, sculpt=shape)
    box(1, 3, 1, DARK, x=-5, y=18, z=4, sculpt=shape)
    box(6, 1, 6, METAL, x=5, y=15, sculpt=shape)
    for x, z in ((4, 1), (6, -1), (8, 2)):
        box(2, 3, 2, GREEN, x=x, y=16, z=z, sculpt=shape)
    return shape


def hay_rick():
    shape = box(31, 9, 21, JOINT)
    for y in (2, 10):
        for x in (-10, 0, 10):
            box(10, 6, 20, MARK, x=x, y=y, sculpt=shape)
            box(9, 2, 18, MARK, x=x, y=y + 6, sculpt=shape)
            for dx in (-3, 3):
                box(1, 5, 21, WOOD, x=x + dx, y=y + 1, sculpt=shape)
    for x in (-5, 5):
        box(10, 7, 15, MARK, x=x, y=17, sculpt=shape)
        box(1, 6, 17, WOOD, x=x + 2, y=17, sculpt=shape)
    return shape


def goods_barrows():
    shape = crate_bank(17)
    for x in (-11, 12):
        for z in (-8, 8):
            box(1, 6, 5, DARK, x=x, z=z, sculpt=shape)
            box(3, 1, 3, METAL, x=x, y=2, z=z, sculpt=shape)
    box(33, 2, 14, WOOD, y=5, sculpt=shape)
    for z in (-4, 4):
        box(10, 2, 2, DARK, x=18, y=6, z=z, sculpt=shape)
    return shape


def utility_pole():
    shape = box(5, 3, 5, JOINT)
    box(3, 56, 3, WOOD, y=2, sculpt=shape)
    box(24, 2, 3, WOOD, y=51, sculpt=shape)
    for x in (-10, -4, 4, 10):
        box(2, 5, 2, METAL, x=x, y=53, sculpt=shape)
        box(4, 2, 3, MARK, x=x, y=56, sculpt=shape)
    return shape


def signal_cable(length, sag):
    shape = Sculpt()
    for x in range(-length // 2, length // 2, 2):
        g = 2 * x / length
        y = round(sag * g * g)
        for z in (-10, 10):
            box(2, 1, 1, DARK, x=x, y=y, z=z, sculpt=shape)
    return shape


def slipway_net():
    shape = Sculpt()
    for x in (-13, 13):
        box(3, 27, 3, WOOD, x=x, sculpt=shape)
        box(5, 3, 5, STONE, x=x, sculpt=shape)
    box(30, 2, 3, WOOD, y=25, sculpt=shape)
    for x in range(-11, 12, 3):
        sag = 6 + abs(x) // 4
        box(1, 23 - sag, 1, DARK, x=x, y=sag, sculpt=shape)
    for y in (10, 13, 16, 19, 22):
        box(24, 1, 1, WOOD, y=y, sculpt=shape)
    for x in (-10, 0, 10):
        box(2, 2, 1, MARK, x=x, y=14, z=1, sculpt=shape)
    return shape


def rescue_buoy():
    shape = box(12, 3, 12, DARK)
    box(8, 5, 8, BODY, y=3, sculpt=shape)
    box(5, 3, 5, MARK, y=7, sculpt=shape)
    box(2, 9, 2, DARK, y=10, sculpt=shape)
    box(5, 4, 4, BODY, y=17, sculpt=shape)
    box(1, 1, 1, GLOW, y=21, sculpt=shape)
    return shape


def firewood_stack():
    shape = box(26, 3, 14, DARK)
    for y, inset in ((3, 0), (7, 2), (11, 4)):
        for x in range(-10 + inset, 12 - inset, 4):
            box(4, 4, 12, WOOD, x=x, y=y, sculpt=shape)
            box(3, 3, 1, MARK, x=x, y=y, z=6, sculpt=shape)
            box(1, 1, 1, DARK, x=x, y=y + 1, z=7, sculpt=shape)
    return shape


def signal_gantry():
    shape = Sculpt()
    for x in (-24, 24):
        box(13, 4, 13, STONE, x=x, sculpt=shape)
        for z in (-5, 5):
            box(3, 55, 3, METAL, x=x, y=4, z=z, sculpt=shape)
        for y in range(10, 55, 9):
            box(5, 2, 12, DARK, x=x, y=y, sculpt=shape)
    box(53, 3, 13, METAL, y=54, sculpt=shape)
    box(55, 2, 15, DARK, y=57, sculpt=shape)
    for x in range(-24, 25, 6):
        box(2, 7, 3, METAL, x=x, y=58, sculpt=shape)
    box(53, 2, 3, METAL, y=64, sculpt=shape)
    for x, color in ((-10, MARK), (8, GLOW)):
        box(6, 12, 5, DARK, x=x, y=60, z=2, sculpt=shape)
        box(4, 4, 1, color, x=x, y=66, z=5, sculpt=shape)
    return shape


def wing_trestle():
    shape = Sculpt()
    for x in (-12, 12):
        for z in (-6, 6):
            box(3, 10, 3, DARK, x=x, z=z, sculpt=shape)
        box(4, 2, 14, METAL, x=x, y=10, sculpt=shape)
    box(30, 2, 12, WOOD, y=12, sculpt=shape)
    for x, z, width in ((-8, 3, 5), (3, 2, 12), (10, -1, 4)):
        box(width, 2, 4, METAL, x=x, y=14, z=z, sculpt=shape)
    return shape


def tool_trolley():
    shape = lp.crate(15, 10, 11, BODY, DARK)
    for x in (-6, 6):
        for z in (-5, 5):
            box(3, 3, 2, DARK, x=x, z=z, sculpt=shape)
    for y in (4, 7, 10):
        box(11, 1, 1, METAL, y=y, z=6, sculpt=shape)
    box(18, 2, 12, WOOD, y=12, sculpt=shape)
    box(4, 3, 4, METAL, x=-3, y=14, sculpt=shape)
    box(7, 2, 4, DARK, x=4, y=14, sculpt=shape)
    box(2, 8, 2, MARK, x=8, y=5, z=3, sculpt=shape)
    return shape


def shelter_rack():
    shape = awning(47, 28)
    for x in (-12, 12):
        box(16, 10, 13, DARK, x=x, z=-4, sculpt=shape)
        box(14, 2, 14, WOOD, x=x, y=10, z=-4, sculpt=shape)
        for dx in (-5, 3):
            box(4, 5, 5, METAL, x=x + dx, y=12, z=-4, sculpt=shape)
    return shape


def customs_wall(width, stories, *, ruined=False, storefront=False, doorway=True):
    height = 29 * stories + 4
    shape = box(width, height, 5, BODY)
    for y in range(4, height, 29):
        box(width, 2, 6, STONE, y=y, sculpt=shape)
    for x in (-width // 2 + 1, width // 2 - 2):
        box(4, height, 7, STONE, x=x, sculpt=shape)
        for y in range(8, height, 9):
            box(7, 3, 7, MARK, x=x, y=y, sculpt=shape)
    for story in range(stories):
        for i, x in enumerate((-width // 3, 0, width // 3)):
            y = 8 + story * 29
            if story == 0 and x == 0 and doorway:
                shape.cut(span(23), (0, 23), (-5, 5))
                for side in (-12, 12):
                    box(3, 24, 6, MARK, x=side, sculpt=shape)
                box(25, 3, 7, STONE, y=24, sculpt=shape)
            else:
                pane = 16 if story == 0 and storefront else 11
                shape.cut(span(pane, x), (y, y + 13), (-4, 4))
                box(pane + 4, 2, 7, STONE, x=x, y=y - 1, sculpt=shape)
                box(pane + 4, 2, 7, MARK, x=x, y=y + 14, sculpt=shape)
                if not ruined or (i + story) % 3 == 1:
                    box(pane, 14, 1, GLASS, x=x, y=y, z=-1, sculpt=shape)
                    box(1, 14, 2, MARK, x=x, y=y, sculpt=shape)
                    box(pane, 1, 3, WOOD, x=x, y=y + 7, sculpt=shape)
                elif (story + i) % 2:
                    box(pane, 2, 2, WOOD, x=x, y=y + 4, z=1, sculpt=shape)
                    box(pane, 2, 2, WOOD, x=x, y=y + 10, z=1, sculpt=shape)
    if ruined:
        for x, width, bottom in ((-18, 17, height - 28), (-7, 10, height - 37),
                                 (1, 8, height - 42), (10, 12, height - 25),
                                 (17, 6, height - 13)):
            shape.cut(span(width, x), (bottom, height + 3), (-6, 6))
    return shape


def salvage_fascia():
    shape = box(36, 12, 4, DARK)
    box(34, 10, 1, BODY, y=1, z=2, sculpt=shape)
    for x in (-14, 14):
        box(2, 5, 7, METAL, x=x, y=8, z=-4, sculpt=shape)
    for y in (1, 10):
        box(34, 1, 1, MARK, y=y, z=3, sculpt=shape)
    return glyph(shape, ('##..###.###.###.###.##.',
                         '#.#.#...#.#.#.#..#..#.#',
                         '##..##..###.###..#..##.',
                         '#.#.#...#...#.#..#..#.#',
                         '#.#.###.#...#.#.###.#.#'), -11, 3, 4, MARK)


def freight_breach(shape):
    # Two courses of brick survive below the exposed beams.
    for x, width, bottom in ((-25, 5, 35), (-20, 6, 26), (-14, 7, 18),
                             (-8, 6, 24), (-2, 6, 31), (4, 6, 39)):
        for z in (-3, 2):
            box(width + 2, 4, 1, JOINT, x=x, y=bottom - 4, z=z, sculpt=shape)
            box(width, 3, 1, STONE, x=x - 1, y=bottom - 9, z=z, sculpt=shape)
        shape.cut(span(width, x), (bottom, 94), (-7, 7))
    for x, y, depth in ((-21, 39, 19), (-12, 42, 16), (-5, 39, 27), (1, 37, 16)):
        box(3, 3, depth, WOOD, x=x, y=y, z=-depth // 4, sculpt=shape)
        box(2, 1, depth // 3, DARK, x=x, y=y + 2, z=-depth // 4, sculpt=shape)
    return shape


def customs_side(depth, stories, *, ruined=False, breach=False):
    height = stories * 29 + 4
    shape = box(depth, height, 5, BODY)
    for y in range(4, height, 29):
        box(depth, 2, 6, STONE, y=y, sculpt=shape)
    for x in (-depth // 2 + 2, depth // 2 - 3):
        box(4, height, 6, STONE, x=x, sculpt=shape)
    for story in range(1, stories):
        y = 12 + story * 29
        for x in (-depth // 4, depth // 4):
            shape.cut(span(9, x), (y, y + 12), (-5, 5))
            box(11, 2, 6, MARK, x=x, y=y - 1, sculpt=shape)
            if not ruined:
                box(9, 13, 1, GLASS, x=x, y=y, sculpt=shape)
                box(1, 13, 2, DARK, x=x, y=y, sculpt=shape)
    if ruined:
        shape.cut((-15, 4), (height - 29, height + 3), (-5, 5))
        shape.cut((5, 13), (height - 19, height + 3), (-5, 5))
        shape.cut((-22, -16), (height - 17, height + 3), (-5, 5))
    return freight_breach(shape) if breach else shape


def slate_roof(width, depth, rise, *, ruined=False):
    shape = Sculpt()
    for x in range(-width // 2, width // 2, 2):
        y = max(0, (width // 2 - abs(x)) * rise // (width // 2))
        if not ruined or abs(x + 3) > width // 3:
            box(2, 3, depth, BODY if y % 4 else DARK, x=x, y=y, sculpt=shape)
        else:
            box(2, 2, depth // 4, BODY, x=x, y=y, z=-depth // 2 + depth // 8, sculpt=shape)
            if x % 4 == -width // 2 % 4:
                box(2, 2, depth, WOOD, x=x, y=y, sculpt=shape)
    if not ruined:
        box(4, 2, depth + 2, MARK, y=rise, sculpt=shape)
    for x, z, y in ((-width // 4, -depth // 5, rise // 2),
                    (width // 3, depth // 4, rise // 3)):
        box(8, 18, 8, STONE, x=x, y=y, z=z, sculpt=shape)
        box(10, 2, 10, JOINT, x=x, y=y + 15, z=z, sculpt=shape)
        for dx in (-2, 2):
            box(2, 3, 2, BODY, x=x + dx, y=y + 18, z=z, sculpt=shape)
    return shape


def ruined_joists(width, depth):
    shape = Sculpt()
    for x in range(-width // 2 + 2, width // 2, 5):
        length = depth - (x % 11) * 2
        box(2, 3, length, WOOD, x=x, z=-(depth - length) // 2, sculpt=shape)
    box(width, 4, 4, DARK, z=-depth // 2, sculpt=shape)
    box(width // 3, 2, depth - 9, WOOD, x=-width // 3, y=3, sculpt=shape)
    return shape


def road_debris(seed):
    rng = Random(seed)
    shape = Sculpt()
    for i in range(21):
        x = rng.randrange(-21, 22)
        z = rng.randrange(-11, 12)
        h = rng.randrange(2, 7)
        box(rng.randrange(4, 9), h, rng.randrange(3, 7), (STONE, MARK, BODY)[i % 3],
            x=x, z=z, sculpt=shape)
        if i % 4 == 0:
            box(3, 1, 6, JOINT, x=x + 1, y=h, z=z, sculpt=shape)
    for x, z in ((-17, 3), (-6, 0), (9, -4), (17, 4)):
        box(15, 2, 3, WOOD, x=x, y=2, z=z, sculpt=shape)
    return shape


def pavement(width, depth):
    shape = box(width, 2, depth, JOINT)
    for row,z in enumerate(range(-depth // 2 + 2, depth // 2 - 1, 5)):
        for x in range(-width // 2 + 4 + row % 2 * 3, width // 2 - 4, 7):
            box(6, 1, 4, (STONE, STONE, MARK)[(x + 2 * z) % 3],
                x=x, y=1, z=z, sculpt=shape)
    for x in (-width // 2 + 1, width // 2 - 1):
        box(2, 2, depth, STONE, x=x, y=2, sculpt=shape)
    return shape


def add_wall(board, label, wall, positions, colors, *, height=0):
    center_x, _, center_z = grounded_center(wall)
    _, (_, top), _ = wall.bounds()
    for level, floor in enumerate(range(0, top, 29)):
        upper = top if top - floor < 33 else floor + 28
        piece = Sculpt()
        piece.ops = [(x, (max(floor, bottom), min(upper, high)), z, code, paint)
                     for x, (bottom, high), z, code, paint in wall.ops if bottom <= upper and high >= floor]
        local_x, base_y, local_z = grounded_center(piece)
        dx = (local_x - center_x) * CELL
        dz = (local_z - center_z) * CELL
        name = f'{label} course {level + 1}'
        for index, (x, z, turn) in enumerate(positions):
            shift_x, shift_z = ((dx, dz), (dz, -dx), (-dx, -dz), (-dz, dx))[turn]
            if index == 0:
                board.add(name, piece, x + shift_x, z + shift_z, turn, height + base_y * CELL)
                board.set_palette(name, **colors)
            else:
                board.place(name, x + shift_x, z + shift_z, turn, height + base_y * CELL)
        if upper == top:
            break


def customs_clock():
    shape = box(13, 13, 3, DARK)
    box(11, 11, 2, MARK, y=1, z=2, sculpt=shape)
    for x, y, size in ((-4, 6, 2), (4, 6, 2), (0, 3, 2), (0, 10, 2)):
        box(size, 1, 1, METAL, x=x, y=y, z=3, sculpt=shape)
    box(1, 4, 1, DARK, y=6, z=4, sculpt=shape)
    box(4, 1, 1, DARK, x=1, y=6, z=4, sculpt=shape)
    return shape


def wicker_grain_patch(seed):
    rng = Random(seed)
    shape = Sculpt()
    for x in range(-11, 12, 4):
        for z in range(-23, 24, 4):
            if rng.randrange(6) == 0:
                continue
            y = rng.randrange(3, 8)
            box(1, y, 1, WOOD, x=x, z=z, sculpt=shape)
            box(1, 3, 2, MARK, x=x, y=y - 1, z=z + 1, sculpt=shape)
    return shape


def dressed_crop_row(board):
    board.add('Harvest stubble row', wicker_grain_patch(21), -35.5, 33.8)
    board.set_palette('Harvest stubble row', leather='#9c824e', trim='#b79857')
    for x, z, turn in ((-32.1, 33.6, 0), (-28.9, 33.8, 0), (-35.5, 60.0, 0),
                       (-4.4, 30.0, 1), (-4.3, 33.4, 1), (0.5, 32.6, 1),
                       (-35.9, 80.5, 0), (-32.2, 80.6, 0), (-29.1, 80.4, 0),
                       (-16.4, 90.5, 1), (5.1, 96.2, 1)):
        board.place('Harvest stubble row', x, z, turn)


def low_clock_wall(shape):
    shape.ops = [(x, (low * 3 // 5, high * 3 // 5), z, color, paint)
                 for x, (low, high), z, color, paint in shape.ops]
    return shape


def brick_court(board):
    a, p, palette = board.add, board.place, board.set_palette
    a('Customs road cobbles', pavement(62, 70), -24, -24, 0, -0.11)
    p('Customs road cobbles', -24, -31, 0, -0.11)
    a('Customs road end cobbles', pavement(62, 55), -24, -37.25, 0, -0.11)
    for label in ('Customs road cobbles', 'Customs road end cobbles'):
        palette(label, skin='#a5a298', trim='#989183')
    custom = dict(primary='#a96d52', skin='#9a8671', trim='#c8b294', visor='#5b7d84', leather='#7b6554')
    add_wall(board, 'Customs house road front', customs_wall(57, 3, storefront=True),
             [(-29.7, -27.3, 1)], custom)
    add_wall(board, 'Customs house side return', customs_side(55, 3),
             [(-32.8, -24.6, 0), (-32.8, -30.0, 0), (-35.6, -27.3, 1)], custom)
    a('Customs slate roof', slate_roof(66, 57, 16), -32.65, -27.3, 1, 9.03)
    palette('Customs slate roof', primary='#5d6569', skin='#a38570', trim='#8f877b', secondary='#45494e')

    freight = dict(primary='#a1957e', skin='#887663', trim='#ceba9b', visor='#79898e', leather='#765339')
    add_wall(board, 'Damaged freight office front', customs_wall(53, 3, ruined=True),
             [(-19.9, -25.7, 3)], freight)
    add_wall(board, 'Freight office broken return', customs_side(56, 3, ruined=True, breach=True),
             [(-16.85, -28.28, 0), (-16.85, -23.12, 0)], freight)
    add_wall(board, 'Freight office east wall', customs_side(53, 3),
             [(-14.01, -25.7, 3)], freight)
    a('Broken freight slate roof', slate_roof(59, 65, 18, ruined=True), -16.85, -25.7, 3, 9.03)
    palette('Broken freight slate roof', primary='#6f655e', skin='#aa8873', leather='#8d694d', secondary='#595751')
    a('Exposed freight floor joists', ruined_joists(55, 46), -16.85, -25.7, 3, 5.86)
    p('Exposed freight floor joists', -16.85, -25.7, 3, 2.92)

    chandlery = dict(primary='#69847e', skin='#979587', trim='#c0ad91', visor='#819289')
    add_wall(board, 'Chandlery road front', customs_wall(52, 2, storefront=True),
             [(-19.3, -32.6, 3)], chandlery)
    add_wall(board, 'Chandlery side return', customs_side(53, 2),
             [(-16.55, -35.18, 0), (-16.55, -30.0, 0), (-13.8, -32.6, 3)], chandlery)
    a('Chandlery clay roof', slate_roof(58, 60, 16), -16.55, -32.6, 3, 6.15)
    palette('Chandlery clay roof', primary='#a56a55', skin='#ad8b72', secondary='#79584c', trim='#8b8171')
    coach = dict(primary='#a38067', skin='#a19a88', trim='#b8ae99', visor='#6e827e')
    add_wall(board, 'Brick coach house road front', customs_wall(48, 2),
             [(-29.4, -33.6, 1)], coach)
    add_wall(board, 'Brick coach house return', customs_side(48, 2),
             [(-32, -31.2, 0), (-32, -36.0, 0), (-34.65, -33.6, 1)], coach)
    a('Coach house slate roof', slate_roof(55, 57, 18), -32.0, -33.6, 1, 6.15)
    palette('Coach house slate roof', primary='#646765', skin='#947b67', secondary='#4d5558')
    a('Street breach masonry', road_debris(27), -20.8, -25.4, 1, 0.035)
    for x, z, turn in ((-20.9, -28.3, 2), (-26.95, -32.1, 3), (-29.1, -22.5, 1)):
        p('Street breach masonry', x, z, turn, 0.035)
    palette('Street breach masonry', primary='#ab7863', skin='#a39988', trim='#b9aa95')
    a('Salvage handcart', goods_barrows(), -21.1, -33.0, 2, 0.12)
    palette('Salvage handcart', leather='#886b4f', trim='#ac9879', secondary='#645649')
    p('Field stretcher', -27.8, -25.1, 1)
    p('Staff car', -22.39, -28.86)
    p('Wooden hedgerow fence', -27.8, -37.3)

    a('Customs sign', salvage_fascia(), -29.17, -26.8, 1, 2.54)
    palette('Customs sign', primary='#2f5d61', trim='#f1cca0', secondary='#384642')
    a('Customs gooseneck lamp', post_lamp(), -28.2, -22.45, 1)
    p('Customs gooseneck lamp', -27.5, -30.7, 1)
    p('Customs gooseneck lamp', -20.25, -31.6, 3)
    for x, z in ((-28.2, -22.45), (-27.5, -30.7), (-20.25, -31.6)):
        board.light(x, 2.65, z, '#ffcf8e', 120, 5.5)
    a('Customs toll arch', arch(58, 52, 16, 34), -24.4, -34.1)
    palette('Customs toll arch', skin='#8e9185', trim='#a9a48a')
    clock_wall = dict(primary='#9f8263', skin='#ada493', trim='#c7b492', visor='#788e8d')
    add_wall(board, 'Street end clock tower front', low_clock_wall(customs_wall(42, 2, doorway=False)),
             [(-24.5, -34.6, 0)], clock_wall, height=3.4)
    add_wall(board, 'Street end clock tower return', low_clock_wall(customs_side(36, 2)),
             [(-26.48, -35.05, 1), (-22.53, -35.05, 1)], clock_wall, height=3.4)
    a('Customs square clock', customs_clock(), -24.5, -34.1, 0, 5.52)
    palette('Customs square clock', trim='#d7c7a3', metal='#957952')
    infill = box(42, 4, 6, WOOD, y=-4)
    for y in range(15):
        box(max(2, 42 - y * 3), 1, 4, BODY, y=y, sculpt=infill)
    a('Customs clock gable', infill, -24.5, -33.15, height=6.70)
    palette('Customs clock gable', primary='#9f8263')
    a('Customs clock slate cap', slate_roof(50, 42, 15), -24.5, -34.7, 0, 7.08)
    palette('Customs clock slate cap', primary='#57706c', skin='#807869', secondary='#48544c')
    a('Bonded customs warehouse', packhouse(67, 27, 47), -24.45, -38.5)
    palette('Bonded customs warehouse', primary='#738b87', secondary='#445954', leather='#879287',
            skin='#a7a193', trim='#dfc9a6', visor='#71949e')
    a('Bonded warehouse copper roof', ribbed_roof(71, 33, 14), -24.45, -38.29, height=4.84)
    palette('Bonded warehouse copper roof', primary='#86614c', metal='#aa8469', secondary='#665447')
    shutter = box(23, 26, 5, DARK)
    for y in range(1, 25, 3):
        box(22, 2, 2, METAL, y=y, z=3, sculpt=shutter)
    box(24, 2, 6, JOINT, y=25, sculpt=shutter)
    box(6, 2, 2, WOOD, y=11, z=4, sculpt=shutter)
    a('Bonded warehouse loading shutter', shutter, -23.76, -37.1)
    palette('Bonded warehouse loading shutter', metal='#718580', leather='#9a7756', secondary='#4a5550')
    p('Salvage handcart', -26.85, -36.4, 3, 0.12)
    p('Customs gooseneck lamp', -25.6, -36.7)
    board.light(-24.9, 2.85, -36.3, '#ffd2a3', 510, 5.5)
    board.shot('Customs breach', [-24.15, 5.7, -17.6], [-23.65, 5.35, -30.6])
    board.shot('Customs street', [-23.85, 1.75, -22], [-23.9, 2.06, -30])


def farm_and_market(board):
    a, p, palette = board.add, board.place, board.set_palette
    a('Orchard packing house', packhouse(68, 55, 42), -16.9, 74.5, 2)
    a('Packing house ribbed roof', ribbed_roof(75, 63, 16), -16.9, 74.4, 2, 4.36)
    palette('Orchard packing house', primary='#895547', skin='#a59274',
            leather='#ad7960', trim='#dec69e', visor='#749392')
    palette('Packing house ribbed roof', primary='#54716c', metal='#6c8677', secondary='#445956')
    p('Orchard packing house', -2.0, 57.0, 1)
    p('Packing house ribbed roof', -1.99, 57.1, 1, 4.36)
    p('Orchard packing house', -26.5, 97.4, 2)
    p('Packing house ribbed roof', -26.5, 97.3, 2, 4.36)
    a('Cooperative service arcade', awning(74, 35, canvas=True), -21.9, 73.2, 2)
    palette('Cooperative service arcade', primary='#9b683b', trim='#e1bd7f', leather='#99835d')
    p('Cooperative service arcade', -33.6, 68.8, 1)
    p('Cooperative service arcade', -11.4, 53.1, 1)
    a('Live produce crates', crate_bank(7, produce=True), -26.9, 65.55, 2)
    palette('Live produce crates', primary='#bb744f', detail='#829347',
            trim='#bfa774', leather='#917354')
    for x, z, turn in ((-27.9, 66.2, 1), (-19.15, 69.5, 2), (-17.2, 71.3, 1),
                       (-27.2, 77.5, 2), (-32.1, 67.5, 3), (-10.2, 51.2, 3),
                       (-17.25, 56.4, 3), (-35.5, 45.4, 1), (-35.2, 50.5, 0),
                       (-33.7, 93.5, 3), (-21.8, 92.5, 1)):
        p('Live produce crates', x, z, turn)
    a('Cooperative weigh table', produce_scales(), -23.3, 67.9, 2)
    p('Cooperative weigh table', -27.65, 74.3, 1)
    p('Cooperative weigh table', -4.4, 84.9, 2)
    palette('Cooperative weigh table', primary='#4b776e', trim='#c7b698', metal='#a8a28b')
    a('Cooperative order notice', notice_board(('###.###.###.###',
                                                '#.#.#.#.#....#.',
                                                '###.###.##...#.',
                                                '#...#.#.#....#.',
                                                '#...#.#.###..#.'), 24), -29.0, 66.55, 2)
    palette('Cooperative order notice', primary='#516462', trim='#eed4a2')
    p('Cooperative order notice', -19.9, 69.65, 2)
    p('Cooperative order notice', -10, 43.4, 3)
    a('Orchard harvest rick', hay_rick(), -34.4, 57.4, 2)
    palette('Orchard harvest rick', trim='#cfaa60', leather='#9e875b')
    for x, z, turn in ((-35.5, 63.0, 1), (-29.5, 60.3, 1), (-19.4, 57.0, 3),
                       (-18.2, 31.0, 2), (-11.4, 35.1, 3), (-5, 31.6, 0),
                       (-35.2, -22.5, 1), (-36.4, -31.6, 1), (-37.3, 89.2, 2),
                       (-29.8, 96.5, 3), (-16, 94.6, 2)):
        p('Orchard harvest rick', x, z, turn)
    a('Post and hawthorn hedge', orchard_windbreak(37), -38.2, 57.5, 1)
    palette('Post and hawthorn hedge', primary='#687846', detail='#859754', leather='#6f5946')
    for x, z, turn in ((-39, 71.1, 1), (-39, 85.4, 1), (-31.4, 99.9, 0), (-17, 101, 0),
                       (-13.0, 92.0, 1), (-7.1, 73.9, 0), (2.7, 54.0, 1),
                       (-2.5, 42.5, 1), (-15.2, 34, 0), (-19.1, 31.4, 0),
                       (-35.8, -28.0, 1), (-36.4, -20, 0), (-36.8, 17, 1)):
        p('Post and hawthorn hedge', x, z, turn)
    a('Tall farmyard alder', alder(71), -31.7, 77.9)
    palette('Tall farmyard alder', detail='#8a9e58', primary='#667d4b', leather='#867156')
    for x, z, turn in ((-17.05, 79.3, 1), (-7.5, 82.2, 2), (-18, 96.9, 0),
                       (-33.2, 95.5, 0), (-3.3, 95.4, 2), (-1.6, 72.6, 2),
                       (1.6, 56.9, 1), (-2.5, 43.0, 3), (-18.2, 35.5, 2),
                       (-37.6, -26.4, 3), (-37.6, -32.1, 1)):
        p('Tall farmyard alder', x, z, turn)
    a('Farmyard firewood', firewood_stack(), -17.3, 76.5, 2)
    palette('Farmyard firewood', trim='#b89667', leather='#8d6b4c', secondary='#5d513e')
    for x, z, turn in ((-35.6, 69.8, 1), (-34.8, 66.7, 1), (-3.6, 39.6, 1),
                       (-14.1, 25.1, 3), (-27.1, 24.0, 3), (-33, -2.2, 2),
                       (-28.7, -21.2, 1), (-21.4, -35.7, 2)):
        p('Farmyard firewood', x, z, turn)


def depot_and_airfield(board):
    a, p, palette = board.add, board.place, board.set_palette
    a('Freight coal arrival shed', packhouse(65, 46, 37), -33.8, -16.7)
    a('Freight coal shed ribbed roof', ribbed_roof(70, 51, 16), -33.8, -16.55, 0, 3.89)
    palette('Freight coal arrival shed', primary='#73665b', skin='#a39377',
            leather='#8e7c66', trim='#c2ae86', visor='#718b8d')
    palette('Freight coal shed ribbed roof', primary='#757875', metal='#979b88', secondary='#505350')
    p('Freight coal arrival shed', -4.5, 88.64, 2)
    p('Freight coal shed ribbed roof', -4.5, 88.55, 2, 3.89)
    a('Rail freight signal gantry', signal_gantry(), -29.8, -10, 1)
    palette('Rail freight signal gantry', metal='#7d867a', secondary='#524e44', trim='#a36549')
    p('Rail freight signal gantry', -23.5, 82, 1)
    a('Goods unloading pallet', crate_bank(37), -21.6, -7.8, 2)
    palette('Goods unloading pallet', leather='#826951', trim='#b2986a', secondary='#584a3e')
    for x, z, turn in ((-20.7, -6.45, 0), (-27.5, -5.6, 1), (-29.2, -13.5, 2),
                       (-35.0, -13.4, 3), (-34.65, -19.7, 0), (-27.9, -20.8, 1),
                       (-5.9, 85.4, 1)):
        p('Goods unloading pallet', x, z, turn)
    a('Flight maintenance awning', shelter_rack(), -6.3, -24.5)
    palette('Flight maintenance awning', primary='#5e7364', trim='#c1ab72',
            leather='#8b7456', secondary='#485852')
    p('Flight maintenance awning', 26.9, -30.7, 1)
    p('Flight maintenance awning', 25.3, -20.9, 1)
    p('Flight maintenance awning', 13.5, -34.6)
    a('Airframe wing trestle', wing_trestle(), -4.7, -21.0, 2)
    palette('Airframe wing trestle', metal='#818e84', leather='#9a815a')
    p('Airframe wing trestle', 23.5, -20.4, 1)
    p('Airframe wing trestle', 27.1, -27.8, 3)
    a('Mechanic tool trolley', tool_trolley(), -2.7, -18, 1)
    palette('Mechanic tool trolley', primary='#a15442', metal='#909b92',
            leather='#9b815f', trim='#cdae74')
    for x, z, turn in ((-5.9, -22.3, 3), (-2.8, -21.5, 2), (24.2, -20, 2),
                       (27.6, -28.6, 2), (24.9, -34.6, 3), (8.7, -22.7, 3),
                       (30.1, 54.0, 1), (29.6, 60.6, 1)):
        p('Mechanic tool trolley', x, z, turn)
    a('Airfield communications hut', packhouse(57, 46, 35), -3.2, -31.3)
    a('Airfield communications roof', ribbed_roof(62, 52, 12), -3.2, -31.2, 0, 3.66)
    palette('Airfield communications hut', primary='#927850', skin='#aaa183',
            leather='#877154', trim='#d2bc87', visor='#76999b')
    palette('Airfield communications roof', primary='#66817a', metal='#86968b', secondary='#516560')
    a('Field distribution pole', utility_pole(), -0.5, -28.9)
    palette('Field distribution pole', leather='#7c6a54', metal='#8a8f82', trim='#bca47c')
    for x, z, turn in ((-0.5, -22.6, 0), (5.8, -28.9, 0), (5.8, -22.6, 0),
                       (-27.8, -4.1, 1), (-21.5, -4.1, 1), (-15.2, -4.1, 1),
                       (-30.45, 63.0, 0), (-30.45, 69.3, 0), (-30.45, 75.6, 0)):
        p('Field distribution pole', x, z, turn)
    a('Bowed service cable span', signal_cable(64, 8), -24.65, -4.1, 0, 4.91)
    palette('Bowed service cable span', secondary='#54564b')
    for x, z, turn in ((-18.35, -4.1, 0), (-0.5, -25.75, 1), (5.8, -25.75, 1),
                       (-30.45, 66.15, 1), (-30.45, 72.45, 1)):
        p('Bowed service cable span', x, z, turn, 4.91)
    for x, z in ((-33.6, -14.75), (-7.3, -23.2), (27.0, -29.8), (-22.1, 71.7)):
        p('Customs gooseneck lamp', x, z)
        board.light(x + 0.65, 2.78, z, '#ffd49a', 85, 5.0)


def water_and_freight(board):
    a, p, palette = board.add, board.place, board.set_palette
    a('Riverside machine shop', packhouse(58, 43, 41), 22.6, -0.65, 1)
    a('Riverside shop glazed ridge', ribbed_roof(65, 49, 20), 22.6, -0.5, 1, 4.28)
    palette('Riverside machine shop', primary='#638078', skin='#a09580',
            leather='#819283', trim='#d0c29b', visor='#7caaa4')
    palette('Riverside shop glazed ridge', primary='#986c59', metal='#af8972', secondary='#615548')
    p('Riverside machine shop', 27.7, 37.2, 1)
    p('Riverside shop glazed ridge', 27.85, 37.2, 1, 4.28)
    p('Riverside machine shop', 18.55, 78.1, 3)
    p('Riverside shop glazed ridge', 18.45, 78.18, 3, 4.28)
    a('Tide mill timber work canopy', awning(42, 28), 18.8, -9.3, 3)
    palette('Tide mill timber work canopy', primary='#758177', secondary='#42534e',
            leather='#836e52')
    p('Tide mill timber work canopy', 23.8, 83.6, 1)
    p('Farmyard firewood', 19.2, -9.5, 1)
    p('Goods unloading pallet', 20.1, -10.5, 3)
    p('Goods unloading pallet', 23.0, -0.75, 1)
    p('Mechanic tool trolley', 21.9, -1.3, 1)
    a('Quay tarpaulin lot', awning(66, 32, canvas=True), 32.2, -9.4, 1)
    palette('Quay tarpaulin lot', primary='#597974', trim='#bc9f6d', leather='#836c56')
    for x, z, turn in ((33.8, -8.3, 1), (32.5, 8.5, 1), (35.4, 1.0, 0),
                       (30.5, 39.25, 2), (31.2, 52.1, 3), (30.8, 64.8, 3),
                       (32.0, 83.5, 1), (24.15, 89.8, 3), (24.45, 84.8, 1)):
        p('Goods unloading pallet', x, z, turn, 0.3 if x > 33 else 0)
    a('Harbor net drying frame', slipway_net(), 31.35, 84.7, 1)
    palette('Harbor net drying frame', leather='#8e7457', trim='#aa895d')
    for x, z, turn, height in ((32.6, 88.5, 1, 0.2), (34.9, 73.5, 1, 0.3),
                               (32.1, 41.5, 1, 0), (33.4, 6.5, 1, 0.2), (31.3, -5.9, 1, 0)):
        p('Harbor net drying frame', x, z, turn, height)
    a('Estuary channel marker buoy', rescue_buoy(), 41.4, 7.5, height=-0.7)
    palette('Estuary channel marker buoy', primary='#b75548', trim='#ead0a4', accent='#ffc98b')
    for x, z, turn in ((45.6, 12.9, 2), (41.7, -13.9, 1), (43.9, 44.75, 1),
                       (38.95, 65.3, 1), (40.5, 90.5, 2), (44.0, 99.6, 1)):
        p('Estuary channel marker buoy', x, z, turn, -0.7)
    a('Canal fringe reeds', reed_strip(89), 11.1, -5.25, 1, -0.56)
    palette('Canal fringe reeds', detail='#819053', trim='#ad9764', primary='#74634d')
    for x, z, turn in ((10.8, -1.5, 1), (10.3, 8.8, 1), (9.8, 14.45, 1),
                       (14.1, 17.3, 1), (11.3, 27.1, 1), (14.9, 31.7, 1),
                       (10.15, 37.2, 1), (14.65, 46.3, 1), (9.9, 55, 1),
                       (13.9, 58.3, 1), (14.7, 73.5, 1), (9.75, 87.2, 1),
                       (15.0, 93.25, 1), (33.5, 92.35, 1), (34.65, 95.2, 1)):
        p('Canal fringe reeds', x, z, turn, -0.56)
    for x, z, turn in ((24.1, 85.5, 1), (32.1, 92.7, 1), (30.1, 96.45, 3),
                       (29.1, 46.65, 2), (19.2, 62.5, 0), (25.15, 51.5, 1),
                       (30.2, 11.12, 3), (31.25, -3.35, 2)):
        p('Customs gooseneck lamp', x, z, turn)
        board.light(x, 2.7, z, '#ffe1a3', 60, 5)


def dress(board):
    brick_court(board)
    farm_and_market(board)
    depot_and_airfield(board)
    water_and_freight(board)
    dressed_crop_row(board)
