"""Buildings, waterfront works, and vegetation for Estuary Front."""

from random import Random

from creature_kit import Sculpt
from level_geometry import box
from level_vehicles import Part, Track, Vehicle, angle_track, offset_track
from .common import BODY, DARK, GLASS, GLOW, GREEN, JOINT, MARK, METAL, STONE, WOOD, glyph


def crane():
    base = box(25, 4, 23, STONE, x=-13)
    box(21, 4, 19, DARK, x=-13, y=4, sculpt=base)
    shape = box(18, 12, 17, BODY, x=-15, y=8)
    box(11, 7, 16, GLASS, x=-11, y=18, sculpt=shape)
    box(20, 2, 19, DARK, x=-14, y=25, sculpt=shape)
    for x in (-16, -10, -6):
        box(1, 7, 17, METAL, x=x, y=18, sculpt=shape)
    for z in (-5, 5):
        for i in range(20):
            x, y = -9 + 2 * i, 23 + 2 * i
            box(3, 3, 2, BODY, x=x, y=y, z=z, sculpt=shape)
            box(3, 3, 2, BODY, x=x, y=y + 9, z=z, sculpt=shape)
            if i % 4 == 0:
                box(2, 9, 2, DARK, x=x, y=y + 2, z=z, sculpt=shape)
                box(2, 2, 12, BODY, x=x, y=y + 9, sculpt=shape)
    box(6, 4, 13, DARK, x=29, y=67, sculpt=shape)
    cable = box(1, 35, 1, METAL, x=29, y=32)
    hook = box(4, 4, 4, BODY, x=29, y=29)
    box(2, 3, 2, DARK, x=29, y=26, sculpt=hook)
    parked_raise = 9
    parked_cable = box(1, 35 - parked_raise, 1, METAL, x=29, y=32 + parked_raise)
    parked_hook = Sculpt()
    parked_hook.ops.extend((x, (low + parked_raise, high + parked_raise), z, color, filled)
                           for x, (low, high), z, color, filled in hook.ops)
    times = (0, 1.2, 2.4, 3.6)
    reach = (1, 0.68, 0.68, 1)
    return Vehicle(base, [
        Part('crane_slew', (-13, 8, 0), shape),
        Part('crane_cable', (29, 67, 0), cable, 'crane_slew', parked=parked_cable),
        Part('crane_hook', (29, 32, 0), hook, 'crane_slew', parked=parked_hook),
    ], {
        'Slew crane': [angle_track('crane_slew', 1, times, (0, 35, -35, 0))],
        'Raise hook': [
            offset_track('crane_hook', 1, times, tuple(3.5 * (1 - scale) for scale in reach)),
            Track('crane_cable', 'scale', times, tuple((1, scale, 1) for scale in reach)),
        ],
    })


def seawall():
    shape = box(7, 16, 80, JOINT)
    box(9, 2, 80, STONE, y=14, sculpt=shape)
    for z in range(-37, 39, 9):
        box(3, 12, 2, DARK, x=3, y=1, z=z, sculpt=shape)
        box(1, 3, 2, WOOD, x=5, y=9, z=z, sculpt=shape)
    for z in (-22, 20):
        box(3, 13, 5, WOOD, x=5, z=z, sculpt=shape)
        box(4, 2, 6, METAL, x=5, y=10, z=z, sculpt=shape)
    return shape


def warehouse_front():
    shape = box(61, 37, 4, BODY)
    shape.cut((-14, 14), (0, 25), (-3, 3))
    for x in range(-28, 31, 4):
        box(1, 36 if abs(x) > 15 else 11, 1, WOOD, x=x,
            y=1 if abs(x) > 15 else 26, z=2, sculpt=shape)
    for x in (-18, 18):
        box(10, 24, 2, DARK, x=x, z=3, sculpt=shape)
        for y in range(2, 24, 3):
            box(10, 1, 1, METAL, x=x, y=y, z=4, sculpt=shape)
    box(50, 2, 4, DARK, y=25, z=3, sculpt=shape)
    box(24, 8, 2, MARK, y=27, z=3, sculpt=shape)
    glyph(shape, ('###.##...#..###', '#...#.#.##....#', '##..##...#...#.', '#...#.#..#..#..', '#...##..###.###'), -8, 28, 4, DARK)
    return shape


def workshop_side():
    shape = box(50, 37, 4, BODY)
    box(50, 4, 6, JOINT, sculpt=shape)
    for x in range(-24, 25, 4):
        box(1, 33, 1, WOOD, x=x, y=4, z=2, sculpt=shape)
    for x in (-12, 10):
        box(18, 13, 3, DARK, x=x, y=15, z=2, sculpt=shape)
        for dx in (-5, 0, 5):
            for y in (17, 22):
                box(4, 4, 1, GLASS, x=x + dx, y=y, z=4, sculpt=shape)
        box(18, 1, 4, METAL, x=x, y=14, z=3, sculpt=shape)
    box(50, 2, 5, DARK, y=35, sculpt=shape)
    return shape


def signal_tower():
    shape = box(28, 3, 27, JOINT)
    box(25, 37, 24, BODY, y=3, sculpt=shape)
    for y in range(5, 39, 4):
        box(25, 1, 25, WOOD, y=y, sculpt=shape)
    box(10, 20, 1, DARK, x=-4, y=3, z=13, sculpt=shape)
    box(6, 7, 1, GLASS, x=-4, y=14, z=14, sculpt=shape)
    box(39, 3, 32, DARK, y=39, sculpt=shape)
    box(30, 5, 26, MARK, y=42, sculpt=shape)
    box(30, 12, 26, GLASS, y=47, sculpt=shape)
    for x in (-15, -5, 5, 14):
        for z in (-13, 13):
            box(2, 12, 2, MARK, x=x, y=47, z=z, sculpt=shape)
    for x in (-15, 14):
        box(2, 12, 2, MARK, x=x, y=47, sculpt=shape)
    box(36, 3, 32, DARK, y=59, sculpt=shape)
    box(28, 2, 24, BODY, y=62, sculpt=shape)
    box(1, 13, 1, METAL, x=10, y=64, sculpt=shape)
    box(4, 2, 4, GLOW, x=-8, y=64, sculpt=shape)
    return shape


def hangar_roof():
    shape = Sculpt()
    for x in range(-68, 69, 4):
        rise = 26 - abs(x) // 3
        depth = 72 if x % 12 else 74
        box(4, 3, depth, METAL if x % 12 == 0 else BODY, x=x, y=rise, sculpt=shape)
    return shape


def hangar_shell():
    shape = Sculpt()
    for x in range(-68, 69, 4):
        rise = 26 - abs(x) // 3
        box(4, 38 + rise, 2, DARK, x=x, z=-34, sculpt=shape)
        box(4, 2 + rise, 3, BODY, x=x, y=38, z=34, sculpt=shape)
    for x in (-68, 68):
        box(3, 43, 70, BODY, x=x, sculpt=shape)
        for z in range(-31, 35, 7):
            box(5, 40, 2, METAL, x=x, y=1, z=z, sculpt=shape)
        box(20, 37, 3, DARK, x=x * 6 // 7, z=34, sculpt=shape)
    box(137, 2, 4, DARK, y=38, z=35, sculpt=shape)
    for x in (-57, 57):
        for y in range(3, 36, 4):
            box(18, 1, 1, METAL, x=x, y=y, z=36, sculpt=shape)
    box(23, 11, 2, MARK, y=44, z=37, sculpt=shape)
    glyph(shape, ('##..###', '.#....#', '.#...#.', '.#..#..', '###.#..'), -7, 45, 38, DARK, 2)
    return shape


def windsock():
    shape = box(7, 2, 7, JOINT)
    box(2, 38, 2, METAL, y=2, sculpt=shape)
    for i, size in enumerate((8, 7, 6, 5, 4, 3)):
        box(4, size, size, BODY if i % 2 == 0 else MARK,
            x=1 + i * 4, y=36 - i // 2, sculpt=shape)
    return shape


def alder(seed):
    rng = Random(seed)
    shape = box(4, 34, 4, WOOD)
    for direction, z, reach, top in ((-1, -4, 14, 41), (1, 5, 11, 46), (1, -9, 6, 51)):
        for i in range(5):
            box(4, 5, 4, WOOD, x=direction * reach * i // 4, y=top - 23 + i * 4, z=z * i // 4, sculpt=shape)
        for j in range(7):
            x = direction * reach + rng.randint(-8, 8)
            depth = z + rng.randint(-8, 8)
            h = top + rng.randint(-5, 4)
            width = rng.randint(11, 18)
            for k, trim in ((-3, 5), (0, 1), (3, 4)):
                box(width - trim, 4, width - trim, GREEN if j % 3 else BODY,
                    x=x + (k == 3), y=h + k, z=depth, sculpt=shape)
    return shape


def tidal_grass(seed):
    rng = Random(seed)
    shape = box(37, 1, 13, JOINT)
    for _ in range(38):
        x, z, h = rng.randint(-18, 18), rng.randint(-6, 6), rng.randint(2, 10)
        box(2, h, 2, GREEN, x=x, z=z, sculpt=shape)
        box(1, 2, 1, MARK, x=x + 1, y=h - 1, z=z, sculpt=shape)
    return shape


def cottage_roof(width, depth):
    shape = Sculpt()
    for x in range(-width // 2 + 1, width // 2 + 1, 2):
        rise = (width // 2 - abs(x)) // 2
        box(2, 2, depth, BODY if rise % 4 else DARK, x=x, y=rise, sculpt=shape)
        if rise:
            for z in (-depth // 2 + 2, depth // 2 - 3):
                box(2, rise, 3, STONE, x=x, z=z, sculpt=shape)
    box(5, 23, 6, WOOD, x=-11, z=-9, sculpt=shape)
    box(7, 2, 8, JOINT, x=-11, y=23, z=-9, sculpt=shape)
    return shape


def cottage_front():
    shape = box(60, 32, 4, STONE)
    shape.cut((-5, 5), (0, 20), (-3, 3))
    for x in (-19, 17):
        box(14, 15, 2, WOOD, x=x, y=10, z=2, sculpt=shape)
        for dx in (-3, 2):
            for y in (12, 18):
                box(4, 5, 1, GLASS, x=x + dx, y=y, z=3, sculpt=shape)
        box(16, 2, 4, MARK, x=x, y=8, z=3, sculpt=shape)
    for x in (-29, 28):
        for y in range(1, 31, 5):
            box(4, 3, 5, JOINT, x=x, y=y, sculpt=shape)
    box(15, 2, 6, WOOD, y=20, sculpt=shape)
    return shape


def fuel_bowser():
    shape = box(19, 2, 35, JOINT)
    for z in (-11, 11):
        box(16, 5, 5, DARK, y=2, z=z, sculpt=shape)
    for y, width in enumerate((8, 12, 16, 18, 20, 20, 20, 18, 16, 12, 8)):
        box(width, 1, 33, BODY, y=y + 6, sculpt=shape)
        for z in (-10, 10):
            box(width + 2, 1, 2, METAL, y=y + 6, z=z, sculpt=shape)
    box(6, 2, 7, DARK, y=17, sculpt=shape)
    box(4, 2, 4, MARK, y=19, sculpt=shape)
    box(3, 6, 3, METAL, x=6, y=7, z=18, sculpt=shape)
    box(6, 2, 4, BODY, x=6, y=12, z=18, sculpt=shape)
    return shape


def dock_crates():
    shape = Sculpt()
    for x, z, y, width in ((-6, 1, 0, 12), (6, 0, 0, 12), (-6, 1, 11, 10)):
        box(width, 10, 13, WOOD, x=x, y=y, z=z, sculpt=shape)
        for dx in (-width // 2 + 1, width // 2 - 2):
            box(2, 11, 15, BODY, x=x+dx, y=y, z=z, sculpt=shape)
        for step in range(5):
            box(2, 2, 1, MARK, x=x - 4 + step * 2, y=y + 1 + step * 2, z=z + 7, sculpt=shape)
        box(3, 3, 1, STONE, x=x + 2, y=y + 2, z=z + 7, sculpt=shape)
    return shape


def edge_lamp():
    shape = box(5, 2, 5, DARK)
    box(3, 3, 3, METAL, y=2, sculpt=shape)
    box(3, 2, 3, GLOW, y=5, sculpt=shape)
    box(5, 1, 5, DARK, y=7, sculpt=shape)
    return shape


def semaphore():
    shape = box(8, 3, 8, JOINT)
    box(3, 34, 3, MARK, y=3, sculpt=shape)
    box(3, 9, 3, DARK, y=3, sculpt=shape)
    for i in range(5):
        box(4, 4, 2, BODY if i != 3 else MARK, x=3*i-1, y=31+i, z=2, sculpt=shape)
    box(5, 8, 3, DARK, x=-3, y=26, z=2, sculpt=shape)
    box(2, 2, 1, GLOW, x=-3, y=28, z=4, sculpt=shape)
    return shape


def river_bank(seed):
    rng = Random(seed)
    shape = Sculpt()
    for z in range(-40, 40, 4):
        lip = rng.randrange(6, 10)
        shape.box((-5, lip + 2), (0, 3), (z, z + 3), JOINT)
        shape.box((-5, lip), (4, 6), (z, z + 3), WOOD)
        shape.box((-5, lip - 4), 7, (z, z + 3), GREEN)
        if rng.random() < 0.55:
            box(4, 3, 3, STONE, x=lip, y=2, z=z + 1, sculpt=shape)
    return shape


def station_wall():
    shape = box(66, 35, 4, BODY)
    for x in (-22, 17):
        box(14, 16, 2, DARK, x=x, y=10, z=2, sculpt=shape)
        for dx in (-3, 3):
            for y in (12, 19):
                box(5, 5, 1, GLASS, x=x+dx, y=y, z=3, sculpt=shape)
        box(17, 2, 4, STONE, x=x, y=8, z=3, sculpt=shape)
    box(10, 22, 2, DARK, y=1, z=2, sculpt=shape)
    box(6, 8, 1, GLASS, y=12, z=3, sculpt=shape)
    box(11, 9, 2, MARK, y=24, z=3, sculpt=shape)
    glyph(shape, ('.###.', '#.#.#', '#.###', '#...#', '.###.'), -2, 26, 4, DARK)
    for y in range(2, 34, 5):
        for x in (-31, 30):
            box(5, 2, 5, WOOD, x=x, y=y, sculpt=shape)
    return shape


def airfield_hedge():
    shape = Sculpt()
    rng = Random(17)
    for x in range(-36, 40, 7):
        h, d = rng.randint(7, 13), rng.randint(8, 14)
        box(3, 6, 3, WOOD, x=x, sculpt=shape)
        box(10, h, d, BODY, x=x, y=3, sculpt=shape)
        box(8, 3, d - 3, GREEN, x=x - 1, y=h + 3, sculpt=shape)
    return shape
