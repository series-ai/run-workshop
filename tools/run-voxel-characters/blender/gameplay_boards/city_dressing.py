"""Street frontage, civic yards, and gathering places for Last Light."""

from random import Random

from creature_kit import Sculpt
from level_geometry import box, span
from .common import BODY, DARK, GLASS, GLOW, GREEN, JOINT, MARK, METAL, RUBBER, STONE, WOOD, glyph


def shop_level(*, service=False):
    shape = Sculpt()
    for x in (-30, 30):
        box(3, 31, 59, STONE if service else BODY, x=x, sculpt=shape)
        for z in (-25, -6, 14, 25):
            box(4, 31, 2, JOINT, x=x, z=z, sculpt=shape)
    box(61, 31, 3, BODY, z=29, sculpt=shape)
    for x in (-24, -9, 9, 24):
        box(3, 28, 5, STONE, x=x, z=-29, sculpt=shape)
    for x in (-18, 18):
        box(18, 8, 2, JOINT, x=x, z=-29, sculpt=shape)
        box(18, 3, 4, GREEN, x=x, y=8, z=-29, sculpt=shape)
        box(16, 18, 2, GLASS if service else DARK, x=x, y=10, z=-28, sculpt=shape)
        box(2, 18, 2, METAL, x=x, y=10, z=-30, sculpt=shape)
        box(15, 2, 2, METAL, x=x, y=21, z=-30, sculpt=shape)
    for y, h, color in ((27, 3, GREEN), (30, 1, MARK), (31, 1, JOINT)):
        box(64, h, 5, color, y=y, z=-29, sculpt=shape)
    for x in (-28, 27):
        box(3, 12, 3, METAL, x=x, y=1, z=-31, sculpt=shape)
    box(63, 2, 64, STONE, y=31, sculpt=shape)
    return shape


def upper_level(*, damaged=False):
    shape = Sculpt()
    for z in (-29, 29):
        box(63, 30, 4, BODY, z=z, sculpt=shape)
        for x in (-21, -5, 12, 24):
            if damaged and x == 12 and z < 0:
                shape.cut(span(14, x), (6, 28), (z - 2, z + 1))
                continue
            shape.cut(span(8, x), (8, 22), (z - 2, z + 1))
            box(12, 2, 6, STONE, x=x, y=7, z=z, sculpt=shape)
            box(8, 15, 1, DARK, x=x, y=8, z=z, sculpt=shape)
            box(2, 13, 1, METAL, x=x, y=9, z=z - 2, sculpt=shape)
            if (x + z) % 3:
                box(4, 10, 1, GLASS, x=x - 2, y=11, z=z - 1, sculpt=shape)
            if (x + z) % 2:
                box(7, 2, 2, WOOD, x=x + 1, y=14, z=z - 3, sculpt=shape)
    for x in (-30, 30):
        box(3, 30, 56, BODY, x=x, sculpt=shape)
        for z in (-16, 7, 20):
            box(1, 14, 7, GLASS, x=x + (-2 if x < 0 else 2), y=9, z=z, sculpt=shape)
            box(3, 2, 11, STONE, x=x, y=8, z=z, sculpt=shape)
    for y, depth, color in ((0, 62, JOINT), (25, 64, STONE), (28, 66, JOINT)):
        for z in (-29, 29):
            box(depth, 2, 5, color, y=y, z=z, sculpt=shape)
        for x in (-31, 31):
            box(5, 2, 59, color, x=x, y=y, sculpt=shape)
    return shape


def parapet_roof():
    shape = box(66, 3, 64, JOINT)
    for x in (-31, 31):
        box(3, 6, 64, BODY, x=x, y=3, sculpt=shape)
        box(5, 1, 64, STONE, x=x, y=9, sculpt=shape)
    for z in (-30, 30):
        box(61, 6, 3, BODY, y=3, z=z, sculpt=shape)
        box(61, 1, 5, STONE, y=9, z=z, sculpt=shape)
    for x, z in ((-10, 13), (-7, 13), (10, -9)):
        box(6, 11, 7, DARK, x=x, y=3, z=z, sculpt=shape)
        box(8, 3, 8, METAL, x=x, y=13, z=z, sculpt=shape)
    box(12, 12, 20, BODY, x=16, y=3, z=17, sculpt=shape)
    box(14, 2, 22, STONE, x=16, y=15, z=17, sculpt=shape)
    return shape


def utility_span(width, sag):
    shape = Sculpt()
    half = width // 2
    for x in range(-half, half, 2):
        drop = round(sag * (1 - (x / half) ** 2))
        for z in (-7, 7):
            box(2, 1, 1, DARK, x=x, y=sag - drop, z=z, sculpt=shape)
        if x % 8 == 0:
            box(1, 1, 15, METAL, x=x, y=sag - drop, sculpt=shape)
    for x in (-half, half):
        box(2, 4, 15, DARK, x=x, y=sag - 1, sculpt=shape)
    return shape


def rail_moss(seed):
    shape = Sculpt()
    rng = Random(seed)
    for i in range(20):
        x = rng.randrange(-27, 28)
        z = rng.randrange(-11, 12)
        height = rng.randrange(3, 10)
        box(3, 1, 3, WOOD, x=x, z=z, sculpt=shape)
        box(1, height, 1, GREEN, x=x, z=z, sculpt=shape)
        color = MARK if i % 5 == 0 else BODY if i % 3 == 0 else GREEN
        box(3, 2, 1, color, x=x + 1, y=height // 2 + 1, z=z, sculpt=shape)
    return shape


def staging_carts():
    shape = Sculpt()
    for x, z, height in ((-9, 5, 12), (9, -5, 9)):
        for dx in (-5, 4):
            for dz in (-5, 5):
                box(2, 3, 3, RUBBER, x=x + dx, z=z + dz, sculpt=shape)
        box(14, 2, 14, METAL, x=x, y=2, z=z, sculpt=shape)
        for i, y in enumerate(range(4, height + 6, 5)):
            box(12 - i, 4, 10, WOOD if i % 2 else BODY, x=x, y=y, z=z, sculpt=shape)
            box(12 - i, 1, 1, MARK, x=x, y=y + 1, z=z - 5, sculpt=shape)
    return shape


def cable_shelf():
    shape = box(27, 3, 13, STONE)
    for x in (-10, 9):
        for y, h, w in ((3, 2, 12), (5, 6, 8), (11, 2, 13)):
            box(w, h, w, WOOD if y != 5 else DARK, x=x, y=y, sculpt=shape)
        for z in (-4, 4):
            box(8, 1, 1, METAL, x=x, y=7, z=z, sculpt=shape)
        box(2, 1, 2, METAL, x=x, y=13, sculpt=shape)
    return shape


def battered_sign(rows, *, arrow=False):
    shape = Sculpt()
    for x in (-9, 9):
        box(2, 23, 2, METAL, x=x, sculpt=shape)
    box(23, 9, 3, DARK, y=19, sculpt=shape)
    box(21, 7, 1, BODY, y=20, z=2, sculpt=shape)
    glyph(shape, rows, -7, 21, 3, STONE)
    if arrow:
        glyph(shape, ('..#.', '####', '..#.'), 3, 22, 3, MARK)
    return shape


def terrace_lamp():
    shape = box(8, 4, 8, STONE)
    box(3, 38, 3, METAL, y=4, sculpt=shape)
    box(14, 2, 2, METAL, x=5, y=40, sculpt=shape)
    box(9, 3, 4, DARK, x=10, y=37, sculpt=shape)
    box(7, 1, 2, GLOW, x=10, y=36, sculpt=shape)
    return shape


def faded_mural():
    shape = box(51, 19, 3, JOINT)
    box(49, 17, 1, GREEN, y=1, z=-2, sculpt=shape)
    for x in (-21, 21):
        box(2, 17, 2, BODY, x=x, y=1, z=-2, sculpt=shape)
    glyph(shape, ('..###..', '.#####.', '#######', '..###..', '..###..'), -8, 4, -3, MARK, 2)
    for x in range(-20, 21, 4):
        box(2, 1, 1, STONE, x=x, y=(x + 22) % 6, z=-3, sculpt=shape)
    return shape


def damaged_duct_bridge():
    shape = Sculpt()
    for x in (-33, 33):
        for z in (-9, 9):
            box(4, 45, 4, METAL, x=x, z=z, sculpt=shape)
        box(5, 6, 22, STONE, x=x, sculpt=shape)
    for z in (-9, 9):
        box(66, 3, 3, DARK, y=42, z=z, sculpt=shape)
        for i, x in enumerate(range(-28, 30, 7)):
            box(2, 13, 2, METAL, x=x, y=44, z=z, sculpt=shape)
            box(5, 2, 2, METAL, x=x, y=47 + 4 * (i % 2), z=z, sculpt=shape)
    for i, x in enumerate(range(-28, 29, 8)):
        if i in (3, 6):
            continue
        box(8, 5, 12, GREEN if i % 2 else METAL, x=x, y=45, sculpt=shape)
        box(2, 7, 14, JOINT, x=x, y=44, sculpt=shape)
    return shape


def breaker_cabinet():
    shape = box(14, 4, 8, JOINT)
    box(12, 22, 7, GREEN, y=4, sculpt=shape)
    box(10, 15, 1, DARK, y=7, z=-4, sculpt=shape)
    for x in (-3, 2):
        box(3, 3, 1, MARK, x=x, y=17, z=-5, sculpt=shape)
    box(2, 5, 2, METAL, x=3, y=9, z=-5, sculpt=shape)
    return shape


def block_frontage(board):
    add, place = board.add, board.place
    add('Boarded street shop', shop_level(), -8, 28.2)
    add('Utility frontage bay', shop_level(service=True), 25.4, 29.2)
    add('Red brick walk-up floor', upper_level(), -8, 28.2, height=3.3)
    add('Damaged pearl brick floor', upper_level(damaged=True), 25.4, 29.2, height=3.3)
    add('Tenement roof and vents', parapet_roof(), -8, 28.2, height=9.3)
    for x, z, turn, stories, industrial in (
        (-8, 28.2, 0, 2, False), (3.4, 29.4, 0, 2, True), (25.4, 29.2, 0, 3, True),
        (-8.5, 6.5, 1, 2, True), (-24.2, -10.8, 0, 3, False),
        (-32, -32.6, 0, 2, False), (35.4, -28.4, 3, 2, True),
        (-22.5, -32.6, 2, 2, False), (-7.5, -34.7, 0, 3, True),
        (8.9, -31.8, 1, 2, False), (16.5, -33.1, 1, 3, True),
        (-32.9, -60, 1, 2, True), (-25.9, -58.4, 2, 3, False),
        (5.4, -55.4, 2, 2, True), (34.4, -59.5, 3, 3, False),
        (-33.5, -77.7, 1, 2, False), (-24, -80.8, 3, 2, True),
        (10, -93.1, 2, 2, True), (18.5, -86.1, 2, 2, False),
    ):
        key = 'Utility frontage bay' if industrial else 'Boarded street shop'
        if (x, z) not in ((-8, 28.2), (25.4, 29.2)):
            place(key, x, z, turn)
        for floor in range(stories):
            key = 'Damaged pearl brick floor' if industrial or floor == stories - 1 else 'Red brick walk-up floor'
            if floor == 0 and (x, z) in ((-8, 28.2), (25.4, 29.2)):
                continue
            place(key, x, z, turn, 3.3 + 3 * floor)
        if (x, z) != (-8, 28.2):
            place('Tenement roof and vents', x, z, turn, 3.3 + 3 * stories)
    board.set_palette('Boarded street shop', primary='#9d6652', detail='#3e7168', skin='#b8ad96')
    board.set_palette('Utility frontage bay', primary='#62594e', detail='#596f67', skin='#c5bca5')
    board.set_palette('Red brick walk-up floor', primary='#a46b56', skin='#c6b28e', visor='#688e8d')
    board.set_palette('Damaged pearl brick floor', primary='#ad9e86', skin='#cfbb99', visor='#6a9190')
    board.set_palette('Tenement roof and vents', primary='#7a6151', skin='#817d71', metal='#898c82')
    add('Weathered relief mural', faded_mural(), -11.55, 6.7, 1, 1.1)
    for x, z, turn, y in ((-24.9, -55.2, 2, .9), (8.8, -35.05, 0, 1.6), (22.9, 29.2, 1, 3.8),
                        (-21.8, -80.3, 3, 1.2), (18.3, -83, 2, 1.1)):
        place('Weathered relief mural', x, z, turn, y)
    board.set_palette('Weathered relief mural', detail='#507773', primary='#aa674a', trim='#c6ac72')
    for x, z, y in ((-8, 28.2, 10.2), (25.5, 29.2, 12.3), (-7.5, -34.7, 12.4), (-26.3, -58, 12.4), (35, -59.5, 12.4)):
        place('Pharmacy water tower', x, z, 0, y)


def street_fittings(board):
    add, place = board.add, board.place
    spans = ((-21.6, 15.8, 0), (-22.2, -39.5, 0), (25.5, -58.8, 0), (-9.8, -88, 1))
    x, z, turn = spans[0]
    add('Buckled utility cable span', utility_span(76, 8), x, z, turn, 3.75)
    add('Utility cable spoke pole', cable_pole(), x - 3.8, z)
    place('Utility cable spoke pole', x + 3.8, z)
    for x, z, turn in spans[1:]:
        place('Buckled utility cable span', x, z, turn, 3.75)
        dx, dz = (0, 3.8) if turn else (3.8, 0)
        for side in (-1, 1):
            place('Utility cable spoke pole', x + side * dx, z + side * dz, turn)
    add('Battered municipal lamp', terrace_lamp(), -26.0, 15.1, 2)
    for x, z, turn in ((-16.9, 15.8, 2), (-12.3, 15.8, 0), (5.8, 12, 1), (8.8, 17.7, 1), (17.7, 17.3, 1),
                      (-20.4, -38.8, 2), (-11.8, -40.6, 3), (-14.2, -52.8, 3), (21.5, -51, 2), (26, -58.2, 1),
                      (29, -67.1, 1), (28.9, -79.7, 2), (-18.7, -70.1, 1), (2.8, -81, 2), (-2.9, -94, 1)):
        place('Battered municipal lamp', x, z, turn)
    board.set_palette('Battered municipal lamp', accent='#ffcd8e', metal='#7f8b83')
    add('Rail verge with seedheads', rail_moss(23), -28.5, 15.6)
    for x, z, turn in ((-32.4, 15.4, 0), (-17.2, 11.55, 0), (-8.2, 16.4, 0), (4.2, 10.5, 1), (8, 13.5, 0),
                      (19.4, 16.9, 0), (27.0, 17.6, 1), (-19.1, -7, 1), (-23.6, -14.4, 1), (4, -19, 0),
                      (-10.6, -29.8, 0), (-8.5, -41.5, 1), (-22, -45, 1), (-23.6, -55, 1), (-18.3, -56, 1),
                      (-23, -66, 1), (-21.3, -74, 1), (-17.8, -82, 1), (6.3, -74.6, 0), (3.8, -77.9, 1),
                      (26.9, -67, 1), (30.2, -64.2, 0), (27.6, -84, 0), (32.8, -90, 1), (8.6, -85, 1)):
        place('Rail verge with seedheads', x, z, turn)
    board.set_palette('Rail verge with seedheads', detail='#718550', primary='#71804f', trim='#c6ab6a')
    add('Abandoned stretcher and supply trolley', staging_carts(), 4.6, 18.8)
    for x, z, turn in ((-26.9, 15.6, 0), (5.1, 22.4, 1), (24.2, -11.1, 1), (-20.6, -47.8, 1), (26, -45.8, 2),
                      (18.7, -66.8, 1), (-17.7, -74.5, 1), (2.15, -85.3, 0), (1.8, -93.5, 1)):
        place('Abandoned stretcher and supply trolley', x, z, turn)
    board.set_palette('Abandoned stretcher and supply trolley', primary='#9a5947', leather='#a5875b', metal='#8e9a8c')
    add('Stacked maintenance cable drums', cable_shelf(), 6.1, -19.9)
    for x, z, turn in ((-20.6, -8.6, 2), (-20.7, -39.8, 1), (-18.3, -50.1, 2), (25, -57.8, 0), (28.5, -65.8, 1),
                      (19.7, -72.4, 1), (34, -85.3, 1), (-17, -83.4, 0), (4.6, -91.1, 2)):
        place('Stacked maintenance cable drums', x, z, turn)
    add('Striped transformer rack', breaker_cabinet(), 7.2, 18.1)
    for x, z, turn in ((-19.3, -9.2, 1), (11.4, -31.2, 0), (-19.1, -47.8, 0), (27.9, -69.2, 2),
                      (27.7, -73, 2), (-16.2, -73.5, 3), (9, -84.8, 2)):
        place('Striped transformer rack', x, z, turn)
    add('Fractured water mains bridge', damaged_duct_bridge(), 25.5, -65.4)
    place('Fractured water mains bridge', 25.7, -81.7, 2)
    board.set_palette('Fractured water mains bridge', detail='#687e72', metal='#818f87', secondary='#3c4a47')
    add('Triage wayfinding sign', battered_sign(('###.#..', '.#..#..', '.#..###'), arrow=True), 5.4, 13.8, 2)
    place('Triage wayfinding sign', 26.3, -9.5, 1)
    board.set_palette('Triage wayfinding sign', primary='#a06442', skin='#ece1c6')
    add('South Line track marker', battered_sign(('####.##', '.#.#.#.', '####.#.'), arrow=True), -19.3, -43.4, 1)
    place('South Line track marker', -17.4, -51.9, 1)
    board.set_palette('South Line track marker', primary='#557b6f', skin='#e2d9c3')


def cable_pole():
    shape = box(5, 5, 5, JOINT)
    box(3, 44, 3, DARK, y=4, sculpt=shape)
    box(2, 2, 18, METAL, y=44, sculpt=shape)
    for z in (-7, 7):
        box(3, 4, 3, STONE, y=44, z=z, sculpt=shape)
    return shape


def checkpoint_deck():
    shape = Sculpt()
    for x in (-21, 21):
        for z in (-13, 13):
            box(4, 5, 5, STONE, x=x, z=z, sculpt=shape)
            box(3, 61, 3, METAL, x=x, z=z, sculpt=shape)
        for i in range(12):
            box(2, 4, 3, DARK, x=x, y=5 + i * 3, z=-13 + i * 2, sculpt=shape)
    box(49, 4, 31, JOINT, y=39, sculpt=shape)
    for z in (-14, 14):
        for x in (-21, -7, 7, 21):
            box(1, 11, 1, METAL, x=x, y=42, z=z, sculpt=shape)
        box(47, 2, 2, METAL, y=51, z=z, sculpt=shape)
        box(47, 1, 1, DARK, y=46, z=z, sculpt=shape)
    for x, width, z, length in ((-11, 28, -4, 35), (13, 16, 0, 31), (22, 5, -3, 26)):
        box(width, 3, length, GREEN if x < 0 else WOOD, x=x, y=60, z=z, sculpt=shape)
    for x in (-16, 8):
        box(8, 4, 4, DARK, x=x, y=54, z=-14, sculpt=shape)
        box(6, 3, 1, GLOW, x=x, y=54, z=-16, sculpt=shape)
    return shape


def shelter_screen():
    shape = box(51, 3, 14, JOINT)
    box(47, 31, 9, STONE, y=3, sculpt=shape)
    box(49, 3, 10, DARK, y=31, sculpt=shape)
    box(46, 4, 10, STONE, y=34, sculpt=shape)
    for x in (-22, 22):
        box(5, 32, 12, BODY, x=x, y=2, sculpt=shape)
    for i, x in enumerate(range(-18, 20, 3)):
        box(3, 2, 1, MARK if i % 2 else RUBBER, x=x, y=29, z=-5, sculpt=shape)
    for i, x in enumerate((-14, -8, -6, 8, 16)):
        box(3 + 2 * (i % 2), 4 + 2 * (i % 3), 1, (MARK, WOOD, GREEN)[i%3], x=x, y=12 + i % 3, z=-5, sculpt=shape)
    return shape


def patched_sheet():
    shape = Sculpt()
    for i, x in enumerate(range(-17, 19, 2)):
        rise = abs(x) // 7
        length = (19, 21, 20, 23, 24, 23, 24, 24, 25, 24, 22, 20, 22, 19, 18, 19, 19, 18)[i]
        box(2, length, 2, BODY, x=x, y=3 + rise, z=rise // 2, sculpt=shape)
        if i % 4 == 0:
            box(1, length - 2, 1, WOOD, x=x, y=4 + rise, z=-1 + rise // 2, sculpt=shape)
    box(36, 1, 2, METAL, y=27, sculpt=shape)
    glyph(shape, ('..#..', '..#..', '#####', '..#..', '..#..'), -4, 9, -2, STONE, 2)
    return shape


def sideline_rack():
    shape = box(41, 3, 16, JOINT)
    for x in (-18, 18):
        for z in (-7, 7):
            box(2, 31, 2, METAL, x=x, z=z, sculpt=shape)
    for height in (6, 16, 25):
        box(36, 2, 14, WOOD, y=height, sculpt=shape)
        for i, x in enumerate((-12, 0, 12)):
            if (height + i) % 4 == 0:
                continue
            box(9, 6, 9, (GREEN, BODY, STONE)[i], x=x, y=height + 2, z=1, sculpt=shape)
            box(8, 1, 1, MARK, x=x, y=height + 4, z=-5, sculpt=shape)
    box(41, 2, 18, GREEN, y=30, sculpt=shape)
    return shape


def checkpoint_and_stadium(board):
    add, place = board.add, board.place
    add('Quarantine observer platform', checkpoint_deck(), -1.72, 17.8)
    place('Quarantine observer platform', 7.41, 17.8, 2)
    place('Quarantine observer platform', 35.6, 20.9, 1)
    board.set_palette('Quarantine observer platform', detail='#43796f', metal='#7b8c87', accent='#ffe1a3')
    add('Inspection wall and notices', shelter_screen(), -2.47, 15.8)
    place('Inspection wall and notices', 7.05, 15.8)
    place('Inspection wall and notices', 35.0, 17.4, 1)
    place('Inspection wall and notices', 29.1, 20.7, 1)
    board.set_palette('Inspection wall and notices', primary='#9b6f57', trim='#deab66', skin='#a59f86')
    add('Quarantine cloth marker', patched_sheet(), -2.5, 15.07, height=0.66)
    place('Quarantine cloth marker', 6.7, 15.07, height=.67)
    board.set_palette('Quarantine cloth marker', primary='#ca7846', leather='#9b5b34', skin='#e9d5b7')
    add('Stadium relief supply rack', sideline_rack(), 16.7, 3.4)
    place('Stadium relief supply rack', 12.0, 8.3, 2)
    place('Stadium relief supply rack', 23.7, -11.4, 2)
    place('Stadium relief supply rack', -20.45, -38.5, 3)
    place('Stadium relief supply rack', -13.7, -85.4, 3)
    board.set_palette('Stadium relief supply rack', primary='#ab6a4c', detail='#627666', trim='#e2b575')
    for x, z, turn in ((-0.2, 17.4, 1), (3.7, 21.2, 1), (6.3, 21.6, 0), (17.5, 3.1, 1),
                     (13.1, 7.0, 0), (22.1, -11.9, 0), (-18.6, -39.5, 1), (-18.6, -51.5, 0),
                     (26.35, -68.9, 1), (28.6, -73.9, 3), (3.9, -90.6, 1)):
        place('Stadium medical pallet', x, z, turn)
        place('Sidewalk container', x, z, turn, .28)
    for x, y, z, color, power, reach in (
        (-1.7, 5.5, 15.8, '#ffe2ab', 2400, 9),
        (6.95, 5.5, 16, '#ffce88', 2550, 9),
        (1.45, 2.56, 21, '#afdcc0', 1800, 6),
        (-23.8, 3.54, -44.8, '#cdf1e0', 1500, 6),
        (-23.0, 3.52, -46.8, '#a4dcce', 1400, 5),
        (18.2, 3.6, 4.7, '#ffd894', 1180, 7),
    ):
        board.light(x, y, z, color, power, reach)
