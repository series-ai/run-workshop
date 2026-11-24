"""Street and stadium structures for Last Light."""

from random import Random

from creature_kit import Sculpt
from level_geometry import box, span
from .common import BODY, DARK, GLASS, GLOW, GREEN, JOINT, MARK, METAL, RUBBER, STONE, WOOD


def tenement_windows(width, seed):
    rng = Random(seed)
    shape = box(width, 33, 4, BODY)
    for x, y, reach in ((-22, 3, 19), (9, 19, 23), (17, 2, 12)):
        for row in range(4):
            length = reach - row * 3
            box(length, 2, 1, WOOD, x=x + row, y=y + row * 2, z=-2, sculpt=shape)
            box(1, 1, 1, JOINT, x=x + (row % 2) * 3, y=y + row * 2, z=-2, sculpt=shape)
    for i, x in enumerate(range(-width // 2 + 10, width // 2 - 4, 18)):
        shape.cut(span(11, x), (7, 24), (-3, 3))
        for side in (-6, 6):
            box(2, 18, 5, STONE, x=x + side, y=7, sculpt=shape)
        box(15, 2, 7, STONE, x=x, y=6, sculpt=shape)
        box(15, 2, 5, STONE, x=x, y=25, sculpt=shape)
        box(11, 1, 1, DARK, x=x, y=18, z=1, sculpt=shape)
        box(1, 17, 1, DARK, x=x, y=8, z=1, sculpt=shape)
        box(5, rng.randint(3, 6), 1, GLASS, x=x + 3, y=19, z=2, sculpt=shape)
        if i % 3 == 1:
            box(4, 10, 1, GREEN, x=x - 3, y=9, z=2, sculpt=shape)
    for y, depth, mat in ((0, 5, JOINT), (29, 6, STONE), (31, 8, STONE), (32, 7, DARK)):
        box(width, 1, depth, mat, y=y, sculpt=shape)
    return shape


def dispensary_front():
    shape = box(77, 32, 5, GREEN)
    shape.cut(span(20), (0, 23), (-5, 6))
    for x in (-24, 24):
        shape.cut(span(20, x), (5, 22), (-5, 5))
        box(21, 2, 6, STONE, x=x, y=4, sculpt=shape)
        box(20, 1, 2, METAL, x=x, y=18, sculpt=shape)
        box(1, 17, 2, METAL, x=x + 4, y=6, sculpt=shape)
        box(15, 4, 1, GLASS, x=x - 2, y=19, z=1, sculpt=shape)
        for y in (1, 3, 25):
            box(22, 1, 1, DARK, x=x, y=y, z=-2, sculpt=shape)
    for x in (-37, -12, 12, 37):
        box(2, 24, 5, STONE, x=x, sculpt=shape)
        box(3, 4, 6, JOINT, x=x, sculpt=shape)
    box(77, 2, 9, DARK, y=24, sculpt=shape)
    box(75, 5, 6, GREEN, y=26, sculpt=shape)
    box(77, 1, 9, STONE, y=31, sculpt=shape)
    letters = {
        'P': ('##.', '#.#', '##.', '#..', '#..'), 'H': ('#.#', '#.#', '###', '#.#', '#.#'),
        'A': ('.#.', '#.#', '###', '#.#', '#.#'), 'R': ('##.', '#.#', '##.', '#.#', '#.#'),
        'M': ('#...#', '##.##', '#.#.#', '#...#', '#...#'), 'C': ('.##', '#..', '#..', '#..', '.##'),
        'Y': ('#.#', '#.#', '.#.', '.#.', '.#.'),
    }
    x = 29
    for letter in 'PHARMACY':
        rows = letters[letter]
        for row, line in enumerate(rows):
            for col, pixel in enumerate(line):
                if pixel == '#':
                    box(1, 1, 1, STONE, x=x-col, y=30-row, z=-3, sculpt=shape)
        x -= len(rows[0]) + 2
    return shape


def blade_sign():
    shape = Sculpt()
    for y in (0, 13):
        box(3, 2, 16, DARK, y=y, sculpt=shape)
    box(3, 15, 13, GREEN, z=-2, sculpt=shape)
    for x in (-2, 2):
        box(1, 9, 3, GLOW, x=x, y=3, z=-2, sculpt=shape)
        box(1, 3, 9, GLOW, x=x, y=6, z=-2, sculpt=shape)
    return shape


def stocked_cabinet():
    shape = box(25, 23, 2, GREEN, z=4)
    for x in (-12, 12):
        box(2, 24, 9, STONE, x=x, sculpt=shape)
    rng = Random(14)
    for row, y in enumerate((2, 9, 16)):
        box(25, 1, 9, METAL, y=y, sculpt=shape)
        for i, x in enumerate((-9, -5, 0, 5, 9)):
            if (i + row) % 5 == 2:
                continue
            h = rng.randint(3, 5)
            box(3, h, 4, (WOOD, STONE, BODY)[(i + row) % 3], x=x, y=y + 1, sculpt=shape)
            box(2, 1, 2, STONE, x=x, y=y + h + 1, sculpt=shape)
            if (i+row)%3 != 1:
                box(3, 2, 1, STONE if i%2 else GREEN, x=x, y=y+2, z=-2, sculpt=shape)
    return shape


def broken_floor():
    shape = Sculpt()
    for x in range(-34, 38, 9):
        box(3, 3, 72, WOOD, x=x, sculpt=shape)
    for i, reach in enumerate((70, 71, 70, 49, 37, 31, 40, 46, 64, 70, 72, 70)):
        shape.box((-36 + i * 6, -31 + i * 6), (3, 4), (35 - reach, 35), (BODY, WOOD, WOOD)[i % 3])
    return shape


def roof_tank():
    shape = Sculpt()
    for x in (-9, 9):
        for z in (-9, 9):
            box(2, 17, 2, DARK, x=x, z=z, sculpt=shape)
        for i in range(9):
            box(1, 2, 3, METAL, x=x, y=2 + i, z=-8 + i * 2, sculpt=shape)
    box(26, 2, 25, WOOD, y=16, sculpt=shape)
    for y, thick, reach, breadth, mat in ((18, 20, 26, 12, WOOD), (19, 1, 28, 14, DARK),
                                            (27, 1, 28, 14, DARK), (36, 2, 28, 14, DARK),
                                            (38, 2, 26, 12, METAL), (40, 2, 20, 10, METAL),
                                            (42, 2, 12, 6, METAL), (44, 1, 5, 5, DARK)):
        box(reach, thick, breadth, mat, y=y, sculpt=shape)
        box(breadth, thick, reach, mat, y=y, sculpt=shape)
        corner = (reach + breadth) // 2
        box(corner, thick, corner, mat, y=y, sculpt=shape)
    for x in (-5, 2, 5):
        box(1, 17, 1, BODY, x=x, y=20, z=-13, sculpt=shape)
    return shape


def sidewalk(seed):
    rng = Random(seed)
    shape = box(80, 1, 17, JOINT)
    for row in range(2):
        boundaries = (-40, -27, -9, 9, 24, 40) if row else (-40, -18, 0, 19, 40)
        for a, b in zip(boundaries, boundaries[1:]):
            shape.box((a + 1, b - 1), (1, 1), (-6 + row * 7, row * 7), rng.choice((STONE, STONE, METAL)))
    for x in range(-35, 40, 10):
        box(9, 2, 2, STONE if x != 15 else JOINT, x=x, z=-8, sculpt=shape)
    return shape


def verge(seed):
    shape = Sculpt()
    rng = Random(seed)
    for i in range(11):
        x, z = rng.randint(-14, 14), rng.randint(-5, 6)
        h = rng.randint(2, 9)
        box(3, 1, 3, WOOD, x=x, z=z, sculpt=shape)
        box(1, h, 1, GREEN, x=x, z=z, sculpt=shape)
        box(3, 2, 2, GREEN if i % 3 else BODY, x=x, y=h // 2, z=z, sculpt=shape)
        box(1, 2, 1, MARK if i % 4 == 0 else BODY, x=x + 1, y=h - 1, z=z, sculpt=shape)
    return shape


def street_tree(seed):
    rng = Random(seed)
    shape = box(8, 3, 7, WOOD)
    for i in range(5):
        box(5 - i // 2, 8, 5 - i // 2, WOOD, x=i // 2, y=i * 7, sculpt=shape)
    for index, (x, z, h, radius) in enumerate(((-12, -4, 29, 11), (10, 4, 31, 12), (-3, 11, 31, 10),
                                                (5, -9, 33, 11), (-3, -2, 39, 13))):
        for k in range(6):
            box(4, 4, 4, WOOD, x=round(x*k/5), y=h-13+k*2, z=round(z*k/5), sculpt=shape)
        for k, width in enumerate((radius, radius * 2, radius + 5, radius - 1)):
            color = (DARK, GREEN, GREEN, BODY)[k] if index % 3 else (DARK, DARK, GREEN, BODY)[k]
            dx, dz = rng.choice((-1, 0, 1)), rng.choice((-1, 0, 1))
            box(width, 3, width - 5, color, x=x+dx, y=h-4+k*2, z=z+dz, sculpt=shape)
            box(width - 6, 3, width, color, x=x+dx, y=h-4+k*2, z=z+dz, sculpt=shape)
    return shape


def intake_tent():
    shape = Sculpt()
    # Each cloth strip follows the ribs across the tent.
    profile = ((0, 23, 1), (1, 23, 6), (7, 22, 6), (13, 20, 5), (18, 17, 4),
               (22, 13, 3), (25, 8, 2), (27, 3, 2))
    for y, x, h in profile:
        for side in (-1, 1):
            for z0, z1, mat in ((-25, -23, GREEN), (-22, -8, STONE), (-7, -6, GREEN),
                                (-5, 9, STONE), (10, 11, GREEN), (12, 23, STONE), (24, 25, GREEN)):
                width = 2 if y < 13 else 5 if y < 22 else 8
                shape.box(span(width, side*x), (y, y+h-1), (z0, z1), mat)
            if y >= 22:
                shape.box((-x, x), (y, y+1), (23, 24), GREEN)
    for x in (-17, 17):
        box(10, 20, 2, GREEN, x=x, z=23, sculpt=shape)
        for y in (8, 12, 15):
            box(2, 1, 49, RUBBER, x=x * 23 // 17, y=y, sculpt=shape)
    return shape


def cantilever():
    shape = Sculpt()
    for x in (-32, 32):
        for i in range(8):
            box(3, 7, 3, METAL, x=x, y=i*6, z=-13-i//3, sculpt=shape)
        box(4, 2, 47, DARK, x=x, y=46, z=1, sculpt=shape)
        for i in range(12):
            box(3, 3, 4, METAL, x=x, y=33+i, z=-10+i*2, sculpt=shape)
    for i in range(6):
        w = (69, 69, 62, 67, 58, 64)[i]
        box(w, 1, 8, GREEN if i % 3 else BODY, x=(69-w)//2, y=48+i//3, z=-16+i*8, sculpt=shape)
    for z in (-16, 1, 19):
        box(70, 2, 2, DARK, y=46, z=z, sculpt=shape)
    return shape


def lattice_lights():
    shape = box(12, 3, 12, STONE)
    for x in (-4, 4):
        for z in (-4, 4):
            box(2, 69, 2, METAL, x=x, y=3, z=z, sculpt=shape)
        for i in range(5):
            for k in range(4):
                box(1, 3, 3, DARK, x=x, y=5+i*13+k*3, z=(-3+k*2)*(-1)**i, sculpt=shape)
    for y in range(6, 70, 13):
        box(10, 1, 10, DARK, y=y, sculpt=shape)
    box(28, 2, 10, DARK, y=71, sculpt=shape)
    for x in (-10, -3, 4, 11):
        for y in (73, 79):
            box(6, 5, 5, METAL, x=x, y=y, sculpt=shape)
            for z in (-3, 3):
                box(4, 3, 1, GLOW, x=x, y=y+1, z=z, sculpt=shape)
    return shape


def climbing_ivy():
    shape = Sculpt()
    for x, y, height in ((-9, 0, 28), (-5, 20, 18), (3, 28, 15), (9, 27, 11), (-14, 13, 11)):
        for i in range(0, height, 3):
            center = x + i // 5
            box(2, 4, 2, WOOD, x=center, y=y+i, sculpt=shape)
            side = 1 if i % 2 else -1
            box(5, 3, 3, GREEN, x=center + 2 * side, y=y+i+2, sculpt=shape)
            box(3, 2, 2, BODY, x=center + 4 * side, y=y+i+3, z=1, sculpt=shape)
    return shape


def dispensary_service_wall():
    shape = box(77, 31, 5, STONE)
    box(77, 5, 5, GREEN, sculpt=shape)
    box(77, 2, 7, JOINT, y=29, sculpt=shape)
    for x in (-20, 2):
        shape.cut(span(14, x), (11, 24), (-3, 3))
        box(14, 2, 7, JOINT, x=x, y=10, sculpt=shape)
        box(14, 13, 1, GLASS, x=x, y=12, z=-2, sculpt=shape)
        for y in (15, 19, 23):
            box(15, 1, 2, METAL, x=x, y=y, z=2, sculpt=shape)
        box(1, 14, 2, METAL, x=x, y=11, z=2, sculpt=shape)
    for x in (-34, 31):
        box(2, 28, 2, DARK, x=x, y=1, z=4, sculpt=shape)
        for y in (5, 17, 27):
            box(4, 1, 2, METAL, x=x, y=y, z=4, sculpt=shape)
    for row, reach in enumerate((17, 21, 15, 9)):
        for x in range(9 + row % 2 * 3, 9+reach, 6):
            box(5, 2, 1, WOOD, x=x, y=5+row*2, z=2, sculpt=shape)
    return shape


def triage_portal():
    shape = Sculpt()
    for x in (-17, 17):
        box(2, 32, 4, METAL, x=x, sculpt=shape)
        box(3, 5, 5, GREEN, x=x, sculpt=shape)
    box(37, 9, 4, GREEN, y=25, sculpt=shape)
    for x in (-13, 13):
        box(5, 1, 1, STONE, x=x, y=29, z=-2, sculpt=shape)
        box(1, 5, 1, STONE, x=x, y=27, z=-2, sculpt=shape)
    box(2, 5, 1, MARK, x=2, y=27, z=-2, sculpt=shape)
    for y, dx in ((27, 0), (28, -1), (29, -2), (30, -1), (31, 0)):
        box(2, 1, 1, MARK, x=-2+dx, y=y, z=-2, sculpt=shape)
    return shape


def clinic_light():
    shape = box(14, 2, 5, DARK)
    for z in (-1, 1):
        box(12, 1, 1, GLOW, z=z, sculpt=shape)
    return shape


def linoleum():
    shape = box(70, 1, 72, STONE)
    for row in range(6):
        for col in range(7):
            if (row + col) % 2 == 0:
                shape.box((-35+col*10, -26+col*10), 0, (-36+row*12, -25+row*12), GREEN)
    return shape


def staff_wing_bay():
    shape = tenement_windows(73, 7)
    for i, x in enumerate(range(-73 // 2 + 10, 73 // 2 - 4, 18)):
        box(11, 17, 1, GLASS if i % 3 else DARK, x=x, y=8, z=2, sculpt=shape)
        box(11, 1, 2, WOOD, x=x, y=17, z=1, sculpt=shape)
        box(1, 17, 2, WOOD, x=x, y=8, z=1, sculpt=shape)
    return shape


def press_box():
    shape = box(66, 2, 28, METAL)
    box(65, 8, 27, GREEN, y=2, sculpt=shape)
    box(65, 18, 2, WOOD, y=10, z=-12, sculpt=shape)
    for x in (-32, 32):
        box(2, 17, 25, GREEN, x=x, y=10, sculpt=shape)
    for x in (-27, -16, -5, 6, 17, 28):
        box(9, 10, 1, GLASS, x=x, y=13, z=10, sculpt=shape)
        box(2, 14, 3, METAL, x=x-4, y=11, z=12, sculpt=shape)
    box(67, 2, 30, STONE, y=10, sculpt=shape)
    box(67, 3, 31, DARK, y=24, sculpt=shape)
    for x in (-24, 24):
        box(3, 3, 2, MARK, x=x, y=4, z=13, sculpt=shape)
    return shape


def balcony():
    shape = box(32, 2, 13, STONE)
    for x in (-14, 0, 14):
        box(2, 9, 2, DARK, x=x, y=2, z=-5, sculpt=shape)
    for x in (-15, 15):
        box(1, 1, 13, METAL, x=x, y=10, sculpt=shape)
    for y in (5, 10):
        box(31, 1, 2, METAL, y=y, z=-5, sculpt=shape)
    for x in (6, 11):
        box(4, 4, 6, WOOD, x=x, y=2, sculpt=shape)
        box(5, 2, 5, GREEN, x=x, y=6, sculpt=shape)
    return shape


def dispensary_till():
    shape = box(9, 2, 6, DARK)
    box(8, 1, 4, METAL, y=2, sculpt=shape)
    box(2, 3, 2, DARK, y=2, sculpt=shape)
    box(8, 4, 2, DARK, y=4, z=1, sculpt=shape)
    box(6, 2, 1, GLASS, y=5, z=0, sculpt=shape)
    return shape
