"""South Line transit, food distribution, and waterworks for Last Light."""

from collections import defaultdict
from random import Random

from creature_kit import Sculpt
from level_geometry import box, span
from .common import (
    BODY,
    DARK,
    GLASS,
    GLOW,
    GREEN,
    JOINT,
    MARK,
    METAL,
    RUBBER,
    STONE,
    WOOD,
    action,
    floors,
    slab,
)


def tramway():
    shape = slab(80, 80, face=JOINT, joint=STONE, seed=31)
    for z in range(-37, 40, 6):
        box(27, 1, 3, WOOD, y=2, z=z, sculpt=shape)
    for x in (-8, 8):
        box(2, 1, 80, METAL, x=x, y=2, sculpt=shape)
        box(1, 1, 80, DARK, x=x + 1, y=2, sculpt=shape)
    return shape


def tram_body():
    shape = box(23, 4, 86, DARK, y=2)
    for z in (-29, 29):
        for x in (-11, 11):
            box(3, 5, 8, RUBBER, x=x, z=z, sculpt=shape)
    box(26, 10, 89, GREEN, y=5, sculpt=shape)
    box(26, 2, 89, MARK, y=13, sculpt=shape)
    for z in (-42, 42):
        box(21, 17, 3, STONE, y=15, z=z, sculpt=shape)
        box(17, 11, 1, GLASS, y=18, z=z + (z // 42) * 2, sculpt=shape)
        box(2, 11, 1, METAL, y=18, z=z + (z // 42) * 3, sculpt=shape)
        for x in (-7, 7):
            box(3, 2, 2, GLOW, x=x, y=9, z=z + (z // 42) * 3, sculpt=shape)
    for x in (-12, 12):
        for i, z in enumerate(range(-34, 37, 10)):
            if i == 5:
                box(2, 19, 9, DARK, x=x, y=6, z=z, sculpt=shape)
                box(2, 10, 3, GLASS, x=x, y=16, z=z + 1, sculpt=shape)
            else:
                box(2, 11, 8, GLASS, x=x, y=17, z=z, sculpt=shape)
            box(3, 15, 2, STONE, x=x, y=15, z=z - 4, sculpt=shape)
    for y, width, length in ((29, 28, 91), (31, 24, 89), (33, 18, 83)):
        box(width, 2, length, GREEN if y == 29 else METAL, y=y, sculpt=shape)
    for x in (-3, 3):
        for i in range(6):
            box(1, 2, 3, DARK, x=x, y=35 + i, z=-8 + i * 2, sculpt=shape)
            box(1, 2, 3, DARK, x=x, y=40 - i, z=3 + i * 2, sculpt=shape)
    box(12, 1, 3, METAL, y=42, z=3, sculpt=shape)
    return shape


def platform_canopy():
    shape = Sculpt()
    for z in (-32, 32):
        box(5, 4, 6, JOINT, sculpt=shape, z=z)
        box(3, 35, 4, GREEN, y=4, z=z, sculpt=shape)
        for side in (-1, 1):
            for i in range(7):
                box(3, 3, 2, METAL, x=side * (2 + i * 2), y=24 + i * 2, z=z, sculpt=shape)
    for i in range(-9, 10):
        box(3, 2, 79, GREEN if i % 4 else METAL, x=i * 3, y=37 + abs(i) // 2, sculpt=shape)
    for x in (-24, 24):
        box(2, 2, 80, WOOD, x=x, y=39, sculpt=shape)
    for z in (-18, 19):
        box(3, 1, 10, GLOW, x=6, y=35, z=z, sculpt=shape)
    return shape


def departure_clock():
    shape = box(6, 3, 6, STONE)
    box(3, 24, 3, GREEN, y=3, sculpt=shape)
    box(15, 11, 4, DARK, y=28, sculpt=shape)
    box(11, 15, 4, DARK, x=0, y=26, sculpt=shape)
    for z in (-2, 2):
        box(11, 9, 1, STONE, y=29, z=z, sculpt=shape)
        box(7, 13, 1, STONE, y=27, z=z, sculpt=shape)
        box(1, 5, 1, DARK, y=33, z=z, sculpt=shape)
        box(4, 1, 1, DARK, x=1, y=33, z=z, sculpt=shape)
    box(6, 2, 5, GREEN, y=41, sculpt=shape)
    return shape


def overhead_mast():
    shape = box(7, 5, 7, JOINT)
    box(4, 54, 4, METAL, y=5, sculpt=shape)
    box(28, 2, 3, DARK, x=10, y=57, sculpt=shape)
    for i in range(9):
        box(3, 2, 2, METAL, x=i * 2, y=40 + i * 2, sculpt=shape)
    for x in (16, 22):
        box(2, 4, 2, STONE, x=x, y=54, sculpt=shape)
    return shape


def cold_room():
    shape = Sculpt()
    for x in (-38, 38):
        box(3, 35, 63, STONE, x=x, sculpt=shape)
        for z in (-27, -11, 5, 21):
            box(4, 30, 1, METAL, x=x, y=2, z=z, sculpt=shape)
    box(76, 34, 3, STONE, z=30, sculpt=shape)
    for x in (-29, 29):
        box(18, 33, 3, STONE, x=x, z=-30, sculpt=shape)
        box(18, 5, 4, GREEN, x=x, y=6, z=-30, sculpt=shape)
    for i in range(5):
        box(42, 2, 3, METAL if i % 2 else DARK, y=24 + i * 2, z=-30, sculpt=shape)
    box(81, 3, 67, DARK, y=34, sculpt=shape)
    box(39, 2, 14, GREEN, y=26, z=-37, sculpt=shape)
    for x in (-15, 15):
        box(2, 2, 10, METAL, x=x, y=24, z=-36, sculpt=shape)
    return shape


def cooling_bank():
    shape = box(39, 14, 16, METAL)
    for x in (-11, 11):
        box(14, 12, 2, DARK, x=x, y=1, z=-8, sculpt=shape)
        for delta in (-4, -1, 2, 5):
            box(1, 10, 2, METAL, x=x + delta, y=2, z=-9, sculpt=shape)
    for z in (-4, 3):
        box(27, 3, 3, WOOD, y=14, z=z, sculpt=shape)
    return shape


def pump_engine():
    shape = box(54, 3, 27, STONE)
    for x in (-17, 17):
        box(10, 6, 17, DARK, x=x, y=3, sculpt=shape)
        for w, y, h in ((9, 8, 2), (14, 10, 6), (10, 16, 3)):
            box(16, h, w, GREEN, x=x, y=y, sculpt=shape)
        box(8, 9, 8, METAL, x=x, y=18, sculpt=shape)
        box(11, 2, 11, DARK, x=x, y=23, sculpt=shape)
    box(37, 5, 6, GREEN, y=23, sculpt=shape)
    for x in (-7, 8):
        box(2, 7, 2, WOOD, x=x, y=28, sculpt=shape)
        box(11, 2, 7, BODY, x=x, y=34, sculpt=shape)
        shape.cut(span(5, x), (34, 35), span(3))
        box(1, 2, 6, BODY, x=x, y=34, sculpt=shape)
    return shape


def filter_basin():
    shape = box(65, 3, 60, STONE)
    box(59, 1, 54, GLASS, y=3, sculpt=shape)
    for x in (-31, 31):
        box(3, 9, 60, JOINT, x=x, sculpt=shape)
        box(3, 2, 60, STONE, x=x, y=8, sculpt=shape)
    for z in (-29, 28):
        box(59, 9, 3, JOINT, z=z, sculpt=shape)
    box(65, 2, 7, METAL, y=10, sculpt=shape)
    for x in (-28, -12, 4, 20, 29):
        box(1, 9, 1, DARK, x=x, y=12, z=3, sculpt=shape)
    box(62, 1, 1, METAL, y=20, z=3, sculpt=shape)
    return shape


def clarifier_tower():
    shape = Sculpt()
    for x in (-14, 14):
        for z in (-14, 14):
            box(4, 33, 4, STONE, x=x, z=z, sculpt=shape)
        for i in range(10):
            box(2, 3, 4, DARK, x=x, y=7 + i * 2, z=-12 + i * 3, sculpt=shape)
    for y, height, diameter, color in (
        (28, 5, 27, DARK),
        (33, 5, 34, METAL),
        (38, 23, 42, GREEN),
        (42, 2, 44, METAL),
        (56, 2, 44, METAL),
        (61, 3, 44, STONE),
        (64, 3, 37, METAL),
        (67, 3, 24, METAL),
        (70, 2, 12, DARK),
    ):
        for w, d in ((diameter, diameter - 12), (diameter - 5, diameter - 5), (diameter - 12, diameter)):
            if min(w, d) > 0:
                box(w, height, d, color, y=y, sculpt=shape)
    return shape


def glasshouse():
    shape = Sculpt()
    profile = ((19, 0, 10), (18, 10, 5), (16, 15, 4), (13, 19, 4), (9, 23, 3), (5, 26, 2), (1, 28, 2))
    for x, y, h in profile:
        for side in (-1, 1):
            width = 2 if y < 15 else 5
            for z0, z1 in ((-29, -17), (-15, -2), (1, 14), (17, 28)):
                if y == 0:
                    shape.box(span(width, side * x), (0, 2), (z0, z1), GLASS)
                elif (z0 + side + y) % 4 == 0:
                    shape.box(span(width, side * x), (y, y + h - 1), (z0, z1 - 5), GLASS)
            for z in (-30, -16, 0, 16, 29):
                box(width, h, 2, GREEN, x=side * x, y=y, z=z, sculpt=shape)
    for x in (-18, 18):
        box(3, 3, 61, STONE, x=x, sculpt=shape)
    for x in (-8, 8):
        box(2, 21, 3, GREEN, x=x, z=-29, sculpt=shape)
    box(19, 2, 3, GREEN, y=20, z=-29, sculpt=shape)
    return shape


def seed_bed(seed):
    rng = Random(seed)
    shape = box(35, 4, 16, WOOD)
    box(31, 1, 12, DARK, y=4, sculpt=shape)
    for x in range(-12, 13, 6):
        for z in (-3, 3):
            h = rng.randint(4, 8)
            box(1, h, 1, BODY, x=x, y=5, z=z, sculpt=shape)
            box(5, 2, 2, GREEN, x=x, y=5 + h // 2, z=z, sculpt=shape)
            box(2, 2, 4, GREEN, x=x + 1, y=4 + h, z=z, sculpt=shape)
            box(2, 2, 2, MARK if seed % 2 else BODY, x=x - 1, y=4 + h // 2, z=z, sculpt=shape)
    return shape


def market_booth(*, covered):
    shape = Sculpt()
    for x in (-20, 20):
        for z in (-13, 13):
            box(2, 29, 2, WOOD, x=x, z=z, sculpt=shape)
    for i in range(-5, 6):
        color = MARK if i % 3 == 0 else GREEN
        box(4, 2, 31, color, x=i * 4, y=29 - abs(i), sculpt=shape)
        if i != -3:
            box(4, 3 + (i % 3), 2, color, x=i * 4, y=25 - abs(i), z=-15, sculpt=shape)
    box(40, 2, 10, WOOD, y=9, z=-8, sculpt=shape)
    if covered:
        box(38, 15, 2, GREEN, y=8, z=12, sculpt=shape)
    for x in (-13, 0, 13):
        box(10, 3, 7, WOOD, x=x, y=11, z=-9, sculpt=shape)
        box(8, 2, 5, BODY if x else MARK, x=x, y=14, z=-9, sculpt=shape)
    box(3, 2, 3, GLOW, y=26, sculpt=shape)
    return shape


def shelter_bunks():
    shape = Sculpt()
    for x in (-11, 11):
        for z in (-5, 5):
            box(1, 23, 1, METAL, x=x, z=z, sculpt=shape)
    for y in (3, 15):
        box(22, 1, 11, DARK, y=y, sculpt=shape)
        box(21, 2, 10, STONE, y=y + 1, sculpt=shape)
        box(13, 1, 10, GREEN, x=3, y=y + 3, sculpt=shape)
        box(5, 2, 8, STONE, x=-7, y=y + 3, sculpt=shape)
    return shape


def bunting():
    shape = Sculpt()
    for x in (-39, 39):
        box(3, 4, 4, JOINT, x=x, sculpt=shape)
        box(2, 36, 2, WOOD, x=x, y=3, sculpt=shape)
    for i in range(9):
        x = -36 + i * 9
        y = 33 + abs(i - 4)
        box(9, 1, 1, DARK, x=x, y=y, sculpt=shape)
        color = (BODY, GREEN, MARK)[i % 3]
        box(5, 2, 1, color, x=x, y=y - 2, sculpt=shape)
        box(3, 2, 1, color, x=x, y=y - 4, sculpt=shape)
        box(1, 1, 1, color, x=x, y=y - 5, sculpt=shape)
    return shape


def cooperative_office():
    shape = box(72, 32, 3, BODY, z=9)
    for x in (-35, 35):
        box(3, 32, 21, BODY, x=x, sculpt=shape)
    for x in (-27, -10, 9, 27):
        box(4, 31, 3, WOOD, x=x, z=-9, sculpt=shape)
    for x in (-19, 18):
        box(15, 13, 2, GREEN, x=x, y=11, z=8, sculpt=shape)
        for y in (13, 17, 21):
            box(12, 1, 2, STONE, x=x, y=y, z=7, sculpt=shape)
    box(66, 4, 2, GREEN, y=25, z=-10, sculpt=shape)
    for z in range(-12, 12, 3):
        box(75, 2, 3, METAL if z % 2 else GREEN, y=31 + (z + 12) // 6, z=z, sculpt=shape)
    return shape


def radio_map():
    shape = box(21, 14, 2, WOOD)
    box(19, 12, 1, STONE, y=1, z=-1, sculpt=shape)
    for x, z in ((-7, 3), (-4, 5), (0, 7), (4, 8), (7, 10)):
        box(4, 1, 1, GREEN, x=x, y=z, z=-2, sculpt=shape)
    box(3, 3, 1, BODY, x=-6, y=2, z=-2, sculpt=shape)
    box(2, 2, 1, MARK, x=6, y=9, z=-2, sculpt=shape)
    return shape


def field_receiver():
    shape = box(10, 7, 6, GREEN)
    box(5, 3, 1, DARK, x=-2, y=1, z=-3, sculpt=shape)
    box(2, 2, 1, MARK, x=3, y=3, z=-3, sculpt=shape)
    box(3, 1, 1, GLOW, x=-2, y=5, z=-3, sculpt=shape)
    for i in range(5):
        box(1, 2, 1, METAL, x=3 - i // 2, y=7 + i * 2, z=1, sculpt=shape)
    return shape


def route_board():
    shape = box(33, 17, 3, GREEN)
    box(29, 13, 1, STONE, y=2, z=-2, sculpt=shape)
    for z, sign in ((-3, 1), (2, -1)):
        for x in range(-10, 13, 5):
            box(5, 1, 1, BODY, x=x, y=8 + (x + 10) // 5, z=z, sculpt=shape)
            box(2, 3, 1, DARK, x=x * sign, y=7 + (x + 10) // 5, z=z, sculpt=shape)
        for x in (-10, -2, 7):
            box(5, 1, 1, WOOD, x=x, y=4, z=z, sculpt=shape)
    for x in (-12, 12):
        box(2, 8, 2, METAL, x=x, y=17, sculpt=shape)
    return shape


def market_cobbles():
    shape = box(80, 3, 80, JOINT)
    rng = Random(71)
    for row in range(10):
        for column in range(-1, 7):
            left = column * 14 - 40 + 7 * (row % 2)
            start, end = max(-40, left), min(39, left + 12)
            if start <= end:
                shape.box((start, end), 2, (-40 + row * 8, -34 + row * 8), rng.choice((STONE, STONE, WOOD)))
    return shape


def harvest_crate():
    shape = box(13, 5, 9, WOOD)
    box(11, 2, 7, DARK, y=3, sculpt=shape)
    for x in (-4, 0, 4):
        for z in (-2, 2):
            box(3, 3, 3, MARK if (x + z) % 3 else BODY, x=x, y=4, z=z, sculpt=shape)
            box(1, 1, 1, GREEN, x=x, y=7, z=z, sculpt=shape)
    return shape


def add_ground(board):
    regions = defaultdict(list)
    for x in range(-36, 37, 8):
        for z in range(-92, -35, 8):
            if x in (-36, -28):
                label = 'South Line tram track'
            elif z in (-92, -84) and x in (-4, 4):
                label = 'Ration market cobbles'
            elif z in (-60, -84):
                label = 'Faded junction marking'
            elif x in (-4, 4):
                label = 'Crosstown center stripe'
            elif x <= -12 and z <= -68:
                label = 'South allotment soil'
            elif x >= 12 and z <= -68:
                label = 'Waterworks apron'
            else:
                label = 'Cracked concrete yard'
            regions[label].append((x, z))
    surfaces = {
        'Ration market cobbles': market_cobbles(),
        'South Line tram track': tramway(),
        'South allotment soil': slab(80, 80, face=GREEN, joint=WOOD, seed=32),
        'Waterworks apron': slab(80, 80, face=JOINT, joint=DARK, seed=8),
    }
    for label, tiles in regions.items():
        if label in surfaces:
            floors(board, label, surfaces[label], tiles)
        else:
            for x, z in tiles:
                board.place(label, x, z, height=-0.3)
    board.set_palette('Ration market cobbles', skin='#a9957b', leather='#99826c')
    board.set_palette('South allotment soil', detail='#78734e', leather='#685648')
    board.set_palette('Waterworks apron', skin='#899491')


def ticket_tower():
    shape = box(28, 4, 27, JOINT)
    box(24, 54, 23, BODY, y=4, sculpt=shape)
    for x in (-11, 11):
        for z in (-11, 11):
            box(3, 51, 3, STONE, x=x, y=5, z=z, sculpt=shape)
    for y in (23, 32, 56):
        box(27, 2, 27, STONE, y=y, sculpt=shape)
    for z in (-12, 12):
        box(15, 13, 1, DARK, y=38, z=z, sculpt=shape)
        box(11, 15, 1, DARK, y=37, z=z, sculpt=shape)
        box(11, 11, 1, MARK, y=39, z=z, sculpt=shape)
        box(1, 4, 1, DARK, y=44, z=z, sculpt=shape)
        box(5, 1, 1, DARK, x=2, y=44, z=z, sculpt=shape)
    for i in range(7):
        box(30 - i * 4, 3, 30 - i * 4, GREEN if i % 3 else METAL, y=58 + i * 3, sculpt=shape)
    box(2, 6, 2, METAL, y=78, sculpt=shape)
    return shape


def pump_hall_front():
    shape = Sculpt()
    for x in (-38, -14, 14, 38):
        box(7, 48, 6, BODY, x=x, sculpt=shape)
        box(9, 6, 7, JOINT, x=x, sculpt=shape)
        box(9, 3, 8, STONE, x=x, y=34, sculpt=shape)
    for x in (-26, 26):
        box(20, 11, 5, BODY, x=x, sculpt=shape)
        box(18, 20, 1, GLASS, x=x, y=12, z=0, sculpt=shape)
        for y in (11, 20, 28, 35):
            box(21, 2, 5, STONE, x=x, y=y, sculpt=shape)
        for dx in (-5, 4):
            box(1, 22, 2, GREEN, x=x + dx, y=12, z=-1, sculpt=shape)
    box(82, 9, 6, BODY, y=38, sculpt=shape)
    for i in range(5):
        box(81 - i * 12, 2, 7, STONE if i == 0 else BODY, y=47 + i * 2, sculpt=shape)
    box(7, 5, 7, METAL, y=56, sculpt=shape)
    shape.box((-4, -1), (43, 45), -3, MARK)
    return shape


def scene(board):
    a, place = board.add, board.place
    add_ground(board)

    a('South Line streetcar', tram_body(), -28, -47)
    place('South Line streetcar', -36, -82, 2)
    a('Riveted station canopy', platform_canopy(), -22.4, -44)
    for z in (-52, -70, -78):
        place('Riveted station canopy', -22.4, z)
    a('Station departure clock', departure_clock(), -17.8, -47.7)
    place('Station departure clock', -20, -74, 2)
    a('South Line clock tower', ticket_tower(), -15.8, -51.6)
    place('Stadium ticket bay', -13, -52.6, 2)
    place('Stadium ticket bay', -10, -52.6, 2)
    place('Team sideline bench', -19.8, -42, 1)
    place('Team sideline bench', -19.8, -50, 1)
    a('South Line route diagram', route_board(), -21.8, -49.6, 3, 1.35)
    place('South Line route diagram', -22.4, -76, 3, 1.35)
    for z in (-55.6, -62.3):
        place('Stripped warehouse rafters', -35.7, z, 0, 3.65)
        for x in (-39.2, -32.1):
            place('Brick warehouse return', x, z, 1)
    place('Brick warehouse loading bay', -35.7, -65.5)
    a('Tram overhead line mast', overhead_mast(), -31, -37, 2)
    for z in (-49, -61, -73, -85, -93):
        place('Tram overhead line mast', -31, z, 2)
    for z in (-36, -43.4, -50.8, -58.2, -65.6, -73, -80.4, -87.8):
        place('Dispensary service windows', -38.9, z, 1)
    for x, z, turn in ((-13, -37, 1), (-22, -37, 0), (-33, -57, 0), (-37, -67, 1), (-33, -91, 1)):
        place('Lightning-struck elm', x, z, turn)
    for x, z in ((-18.4, -43), (-18.4, -52), (-20.3, -69), (-20.3, -79)):
        place('Quarantine warning lamp', x, z)
    for x, z, turn in ((-11, -36.8, 1), (-11, -50, 2), (-33, -72, 1), (-33, -87, 1)):
        place('Abandoned hatchback', x, z, turn)
    for x, z, turn in ((-8, -39, 1), (-8, -52, 0), (-15, -58, 0), (-5, -67, 2)):
        place('Torn street light', x, z, turn)

    a('Insulated cold store bay', cold_room(), 17, -42.6)
    for x in (25, 33):
        place('Insulated cold store bay', x, -42.6)
    a('Cold store compressor bank', cooling_bank(), 16.6, -41.3, height=3.7)
    place('Cold store compressor bank', 25.2, -41.7, 2, 3.7)
    for x in (15.4, 23.4, 31.4):
        place('Medicine shelf', x, -40.4)
        place('Stadium medical pallet', x + 2, -44.2)
        place('Sidewalk container', x + 2, -44.2, 0, 0.35)
    for x, z in ((22, -47.3), (29.9, -48.5), (31.5, -49.9), (9.5, -38)):
        place('Stadium medical pallet', x, z)
        place('Stadium medical pallet', x, z, 0, 0.35)
    place('Stadium forklift', 27, -48.5, 1)
    place('Salvage pickup', 32, -54.3, 3)
    place('Inspection desk', 16.6, -44.3, 2)
    place('Intake lockers', 11.2, -44.7, 1)
    place('Clerestory shop roof', 9, -40.3, 0, 3.75)
    place('Brick warehouse loading bay', 9, -43.6)
    for x in (4.8, 13.1):
        place('Brick warehouse return', x, -40.3, 1)
    for x, z in ((7, -50), (19, -50.5), (34, -46.7), (36, -56)):
        place('Torn street light', x, z)
    for x, z in ((9, -55.4), (18, -54.2), (24, -53.5), (36, -52.2)):
        place('Fireweed and dock', x, z, 1)

    a('Waterworks arched front', pump_hall_front(), 24, -73.5)
    place('Waterworks arched front', 24, -80.1, 2)
    place('Brick warehouse return', 19.9, -76.8, 1)
    place('Brick warehouse return', 28.1, -76.8, 3)
    place('Clerestory shop roof', 24, -76.8, 0, 4.7)
    a('Waterworks valve engine', pump_engine(), 24, -75.9)
    a('Settling basin and gantry', filter_basin(), 33, -68.7)
    for x, z in ((33, -77), (13, -77), (13, -69)):
        place('Settling basin and gantry', x, z, 2 if z < -72 else 0)
    a('High clarifier tank', clarifier_tower(), 33.4, -87.7)
    place('High clarifier tank', 24.6, -88.9)
    for x, z, turn in ((11.8, -64.8, 0), (16.4, -78.9, 1), (30.7, -63.8, 0), (36.3, -72.6, 1)):
        place('Stadium service enclosure', x, z, turn)
    place('Utility shutoff panel', 21.5, -74.2)
    place('Portable generator', 27.4, -71.8)
    place('District boiler chimney', 36, -91.7)
    place('Sapling in cracked pavement', 8, -71.5)
    for x, z in ((19.7, -70.7), (28.9, -82), (32, -61.9), (20.3, -82.3)):
        place('Quarantine warning lamp', x, z)
    board.light(24, 3.6, -75.9, '#f5d597', 2300, 7)

    a('Winter garden glasshouse', glasshouse(), -14.3, -77.8)
    for x, z, turn in ((-8.4, -77.8, 0), (-14.3, -68.7, 2), (-8.4, -68.7, 2)):
        place('Winter garden glasshouse', x, z, turn)
    a('Allotment tomato bed', seed_bed(17), -15.3, -78.3, 1)
    a('Allotment chard bed', seed_bed(28), -13.3, -78.3, 1)
    for x, z in ((-9.4, -78.3), (-15.3, -68.7), (-9.4, -68.7), (-9.6, -87.5), (-9.6, -92.2)):
        place('Allotment tomato bed', x, z, 1)
        place('Allotment chard bed', x + 2, z, 1)
    for x, z in ((-19, -66), (-19, -71), (-19, -80.8), (-26.7, -91.4)):
        place('Sapling in cracked pavement', x, z)
    for x, z in ((-16.5, -66), (-11.5, -80.5), (-6.8, -65.8), (-19.4, -82.5), (-20.5, -89)):
        place('Fireweed and dock', x, z)
    for x, z in ((-23.2, -87), (-17.6, -91.2), (-20, -87), (-15.5, -88.4)):
        place('Stadium medical pallet', x, z)
        place('Sidewalk container', x, z, 0, 0.35)
    place('Esplanade bus shelter', -14, -92.5, 2)
    place('Quarantine canopy', -8.1, -57.9, 2)

    a('Striped ration stall', market_booth(covered=True), 4.3, -89.5, 1)
    a('Produce exchange stall', market_booth(covered=False), -4.3, -89.5, 3)
    for x, z, turn in ((4.3, -84.9, 1), (4.3, -94.1, 1), (-4.3, -94.1, 3)):
        place('Striped ration stall' if x > 0 else 'Produce exchange stall', x, z, turn)
    for x, z, turn in ((9.6, -85.8, 1), (11.5, -88.2, 2), (8.5, -93, 0), (-2, -80, 2)):
        place('Sidewalk container', x, z, turn)
        place('Stadium medical pallet', x + 1.8, z, turn)
    place('Team sideline bench', -5.3, -82.2)
    a('Cooperative packing office', cooperative_office(), 0, -94.65, 2)
    a('Ration day pennants', bunting(), 0, -86.7)
    place('Ration day pennants', 0, -91.9, 2)
    place('Medicine shelf', -1.4, -94.8, 2)
    place('Inspection desk', 1.8, -94.1, 1)
    place('Station departure clock', 2.6, -85.1)
    a('Orchard harvest crate', harvest_crate(), -2.5, -85.7, 1)
    for x, z in ((2.6, -87.4), (-2.7, -91.8), (-2.5, -87.2), (2.5, -89.2)):
        place('Orchard harvest crate', x, z, 1)
    place('Orchard harvest crate', -2.5, -87.2, 1, 0.8)
    board.set_palette('Orchard harvest crate', trim='#d78a49', primary='#ad553e', detail='#698148')
    for x, z in ((7.9, -90.2), (-6.4, -85.4), (5.8, -94.3)):
        place('Fireweed and dock', x, z, 2)
    place('Evacuation truck', 15, -91.3, 1)
    place('Abandoned hatchback', 6, -64, 3)
    place('Insulated cold store bay', 10.7, -58.7, 2)
    place('Cold store compressor bank', 10.7, -58.7, 0, 3.7)
    for x, z, turn in ((-4, -86.8, 1), (6, -82.4, 3), (15, -85.4, 1), (-4, -68.7, 0)):
        place('Torn street light', x, z, turn)
    for x, z, color in ((3.5, -89.5, '#ffc587'), (-3.6, -89.5, '#fbdfad'), (3.5, -94, '#ffc587')):
        board.light(x, 2.1, z, color, 640, 5)

    board.set_palette(
        'South Line streetcar', detail='#4e8580', skin='#d9c5a2', trim='#cd984f', metal='#707a77'
    )
    board.set_palette('Riveted station canopy', detail='#547870', metal='#839082', leather='#6e5846')
    board.set_palette(
        'South Line clock tower', primary='#a86952', skin='#d3bd9c', detail='#588277', trim='#eadbbb'
    )
    board.set_palette('Insulated cold store bay', skin='#bacac4', metal='#809897', detail='#668c87')
    board.set_palette('Waterworks arched front', primary='#ab7262', skin='#d4bca1', detail='#527e77')
    board.set_palette('Waterworks valve engine', detail='#477c75', primary='#b96949', skin='#b0a18b')
    board.set_palette('High clarifier tank', detail='#72968b', metal='#a7b2a7', skin='#b8aa99')
    board.set_palette('Settling basin and gantry', visor='#60948a', metal='#989b8b')
    board.set_palette('Winter garden glasshouse', detail='#6b887b', skin='#aba58b', visor='#a3beb1')
    board.set_palette('Allotment tomato bed', detail='#60834a', primary='#738b45', trim='#be7152')
    board.set_palette('Allotment chard bed', detail='#71925a', primary='#917648')
    board.set_palette('Striped ration stall', detail='#ae5748', trim='#dac79b', primary='#d19653')
    board.set_palette('Produce exchange stall', detail='#568476', trim='#ccb579', primary='#929f4a')

    board.set_palette('Cooperative packing office', primary='#ac7a52', detail='#596e60', metal='#8b9180')
    board.set_palette('Ration day pennants', primary='#b56350', trim='#dbb96d', detail='#55887f')

    # The old safehouse contains a lit bunkroom and a radio desk.
    a('Safehouse steel bunks', shelter_bunks(), -36.0, -12.4, 1)
    place('Safehouse steel bunks', -36, -10, 1)
    place('Dispensary service windows', -34, -14.5, 2)
    place('Dispensary service windows', -37.6, -12.7, 1)
    a('Safehouse route map', radio_map(), -33.1, -14.15, 2, 1.55)
    a('Safehouse field receiver', field_receiver(), -32.6, -13.5, 2, 1.0)
    place('Broken pharmacy floorboards', -34, -12.6, 0, 3.15)
    place('Inspection desk', -32.8, -13.5, 2)
    place('Intake lockers', -31.2, -13.6, 2)
    place('Dispensary strip light', -34, -12.2, 0, 2.8)
    board.light(-34, 2.45, -12.2, '#ffe4b4', 3700, 7)
    board.set_palette('Safehouse route map', skin='#d4c39a', detail='#617b70', primary='#b66650')
    board.set_palette('Safehouse steel bunks', detail='#617b70', skin='#d8ccb2', metal='#8a9085')


def gameplay(board):
    prop = board.prop_id
    board.point(
        'tram_exchange',
        'South Line interchange',
        -16,
        -46.1,
        actions=(
            action(
                'search', assets=(prop('Station departure clock'), 'tram_service_key'), reward='transit_key'
            ),
        ),
    )
    board.point(
        'cold_store',
        'Cold store dispatch',
        16.6,
        -46.9,
        actions=(
            action(
                'unlock',
                assets=('tram_service_key', prop('Cold store compressor bank'), 'battery_pack'),
                requires=('transit_key',),
                reward='pump_battery',
            ),
        ),
    )
    board.point(
        'waterworks',
        'Municipal waterworks',
        23.9,
        -71.8,
        actions=(
            action(
                'restore',
                assets=('battery_pack', prop('Waterworks valve engine'), 'water_test_kit'),
                requires=('pump_battery',),
                reward='clean_water',
            ),
        ),
    )
    board.point(
        'winter_garden',
        'Glasshouse allotment',
        -14.3,
        -73.8,
        actions=(
            action(
                'harvest',
                assets=(prop('Allotment tomato bed'), 'water_test_kit'),
                requires=('clean_water',),
                reward='produce_crates',
            ),
        ),
    )
    board.point(
        'ration_market',
        'South ration market',
        0,
        -89.4,
        actions=(
            action(
                'deliver',
                assets=(prop('Produce exchange stall'), 'field_rations'),
                requires=('produce_crates',),
                reward='south_district_fed',
            ),
        ),
    )
    board.link(
        'alley',
        'tram_exchange',
        [-15, 0, -4],
        [-15, 0, -18],
        [-14.4, 0, -23],
        [-14.4, 0, -33],
        [-16, 0, -36],
        [-16, 0, -43],
    )
    board.link(
        'culvert', 'cold_store', [-7.9, 0, -13.9], [-3.6, 0, -14.5], [0, 0, -22], [0, 0, -48], [16.6, 0, -48]
    )
    board.link('tram_exchange', 'cold_store', [-16, 0, -48], [-7, 0, -48], [6, 0, -48], [13.5, 0, -48])
    board.link(
        'cold_store',
        'waterworks',
        [16.6, 0, -48.8],
        [20.6, 0, -48.8],
        [21, 0, -57],
        [21, 0, -64],
        [22, 0, -68.5],
    )
    board.link('waterworks', 'winter_garden', [23.9, 0, -63], [-2, 0, -63], [-2, 0, -73.8], [-11.6, 0, -73.8])
    board.link(
        'winter_garden', 'ration_market', [-11.5, 0, -73.8], [-11.5, 0, -82.7], [0, 0, -83], [0, 0, -89.4]
    )
    board.link(
        'ration_market',
        'tram_exchange',
        [0, 0, -72],
        [-2, 0, -58.4],
        [-5, 0, -55],
        [-5, 0, -47.8],
        [-16, 0, -47.8],
    )
