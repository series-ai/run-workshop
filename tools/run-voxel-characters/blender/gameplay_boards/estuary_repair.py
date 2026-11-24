"""The customs repair terrace and rail service yard."""

from random import Random

from creature_kit import Sculpt
from level_geometry import box
from .common import BODY, DARK, GLOW, JOINT, MARK, METAL, STONE, WOOD, glyph
from .estuary_dressing import add_wall, customs_side, customs_wall, packhouse, ribbed_roof, slate_roof


def terrace():
    shape = Sculpt()
    for x in (-15, 15):
        for z in (-17, 16):
            support = -9 if x < 0 and z < 0 else x
            box(5, 61, 5, WOOD, x=support, z=z, sculpt=shape)
            box(8, 4, 8, JOINT, x=support, z=z, sculpt=shape)
            for y in (13, 36, 55):
                box(6, 3, 6, METAL, x=support, y=y, z=z, sculpt=shape)
    for x in (-14, 14):
        for y in (24, 55):
            box(4, 4, 38, DARK, x=x, y=y, sculpt=shape)
        for row in range(8):
            z = -15 + row * 4
            for y in (8 + row * 3, 33 + row * 3):
                box(3, 5, 3, WOOD, x=x, y=y, z=z, sculpt=shape)
    for x in range(-16, 17, 4):
        box(4, 3, 37, WOOD, x=x, y=59, sculpt=shape)
        if x % 3 == 0:
            box(1, 1, 31, MARK, x=x + 1, y=61, sculpt=shape)
    for z in (-18, 17):
        box(39, 3, 3, DARK, y=58, z=z, sculpt=shape)
    return shape


def stair_flight():
    shape = Sculpt()
    for row in range(30):
        z = -25 + row * 2
        h = 59 - row * 2
        box(24, 2, 2, WOOD, y=h, z=z, sculpt=shape)
        if row % 5 == 0:
            box(22, 1, 1, MARK, y=h + 1, z=z, sculpt=shape)
        if row % 6 == 0:
            for x in (-11, 11):
                box(4, h - 1, 4, WOOD, x=x, z=z, sculpt=shape)
                box(3, 9, 3, WOOD, x=x, y=h + 2, z=z, sculpt=shape)
    for row in range(0, 30, 3):
        for x in (-11, 11):
            box(2, 6, 6, WOOD, x=x, y=69 - row * 2, z=-24 + 2 * row, sculpt=shape)
    return shape


def breastwork():
    shape = Sculpt()
    heights = (7, 9, 12, 12, 8, 7, 14, 17, 12, 9, 5)
    for j, h in enumerate(heights):
        x = -25 + j * 5
        box(5, h, 9, STONE if j % 3 else BODY, x=x, sculpt=shape)
        for y in range(4, h, 4):
            box(4, 1, 1, JOINT, x=x, y=y, z=5, sculpt=shape)
        if j % 2:
            box(4, 2, 8, MARK, x=x - 1, y=h, z=0, sculpt=shape)
    box(22, 2, 5, WOOD, x=8, z=6, y=5, sculpt=shape)
    for x in (-18, 19):
        box(4, 8, 7, JOINT, x=x, z=4, sculpt=shape)
    return shape


def chain_hoist():
    shape = Sculpt()
    for x in (-18, 18):
        for z in (-8, 8):
            box(4, 35, 4, WOOD, x=x, z=z, sculpt=shape)
            box(7, 2, 7, JOINT, x=x, z=z, sculpt=shape)
            for y in (4, 30):
                box(5, 2, 5, METAL, x=x, y=y, z=z, sculpt=shape)
        box(5, 3, 23, DARK, x=x, y=35, sculpt=shape)
        box(5, 3, 24, WOOD, x=x, y=13, sculpt=shape)
        for y in range(19, 35, 2):
            offset = (y - 19) // 4
            box(3, 2, 3, WOOD, x=x, y=y, z=7 - offset, sculpt=shape)
    box(44, 4, 6, WOOD, y=37, sculpt=shape)
    box(43, 1, 7, METAL, y=37, sculpt=shape)
    for x in (-17, 17):
        box(5, 4, 7, METAL, x=x, y=39, sculpt=shape)
        box(1, 1, 1, MARK, x=x, y=40, z=4, sculpt=shape)
    box(7, 4, 8, DARK, x=7, y=33, sculpt=shape)
    box(5, 2, 6, MARK, x=7, y=31, sculpt=shape)
    for y in range(25, 32):
        box(2, 1, 1 + y % 2, METAL, x=7, y=y, sculpt=shape)
    box(3, 2, 2, METAL, x=7, y=24, sculpt=shape)
    for x in (1, 13):
        box(1, 6, 1, DARK, x=x, y=19, sculpt=shape)
    box(14, 7, 13, BODY, x=7, y=15, sculpt=shape)
    for x in (2, 12):
        box(2, 8, 15, DARK, x=x, y=14, sculpt=shape)
        box(2, 1, 1, METAL, x=x, y=16, z=8, sculpt=shape)
    box(11, 1, 14, WOOD, x=7, y=14, sculpt=shape)
    box(6, 3, 1, MARK, x=7, y=17, z=7, sculpt=shape)
    return shape


def bench_tools():
    shape = box(33, 2, 14, JOINT)
    for x in (-13, 13):
        for z in (-5, 5):
            box(3, 10, 3, WOOD, x=x, y=2, z=z, sculpt=shape)
    box(34, 2, 16, WOOD, y=12, sculpt=shape)
    box(31, 2, 1, DARK, y=12, z=8, sculpt=shape)
    box(14, 4, 7, BODY, x=6, y=14, z=-3, sculpt=shape)
    box(10, 1, 5, MARK, x=6, y=18, z=-3, sculpt=shape)
    box(9, 3, 6, METAL, x=-11, y=14, z=4, sculpt=shape)
    box(3, 8, 3, DARK, x=-13, y=12, z=7, sculpt=shape)
    box(4, 2, 8, METAL, x=-13, y=19, z=7, sculpt=shape)
    for x, z, w in ((-3, 4, 7), (0, 3, 3), (6, 5, 9), (11, 4, 3)):
        box(w, 1, 1, METAL, x=x, y=14, z=z, sculpt=shape)
    return shape


def canvas_bundle():
    shape = Sculpt()
    for x, z, w, h, d in ((-8, -2, 14, 7, 11), (6, 1, 13, 12, 12), (1, 6, 12, 7, 8)):
        box(w, h - 2, d, JOINT, x=x, z=z, sculpt=shape)
        box(w - 2, 2, d - 2, BODY, x=x, y=h - 2, z=z, sculpt=shape)
        box(w - 1, 2, d - 1, BODY, x=x, y=h - 4, z=z, sculpt=shape)
        for dx in (-w // 3, w // 3):
            box(1, h - 2, d + 1, WOOD, x=x + dx, y=1, z=z, sculpt=shape)
            box(1, 1, d - 2, WOOD, x=x + dx, y=h, z=z, sculpt=shape)
    return shape


def coal_hopper():
    shape = Sculpt()
    for x in (-19, 19):
        for z in (-11, 11):
            box(6, 3, 6, STONE, x=x, z=z, sculpt=shape)
            box(4, 42, 4, METAL, x=x, y=3, z=z, sculpt=shape)
        box(4, 3, 27, METAL, x=x, y=42, sculpt=shape)
        box(4, 3, 27, DARK, x=x, y=12, sculpt=shape)
    for y in range(31, 47):
        width = 17 + (y - 31) * 2
        depth = 12 + (y - 31)
        box(width, 1, depth, BODY, y=y, sculpt=shape)
    for x in (-18, -9, 0, 9, 18):
        box(2, 2, 27, METAL, x=x, y=46, sculpt=shape)
    box(46, 2, 28, DARK, y=48, sculpt=shape)
    box(8, 6, 8, METAL, x=-4, y=27, z=3, sculpt=shape)
    for i in range(7):
        box(4, 2, 4, BODY, x=-4, y=24 - i, z=6 + i, sculpt=shape)
    return shape


def shaft_rack():
    shape = box(27, 3, 13, DARK)
    for x in (-10, 10):
        for z in (-4, 4):
            box(3, 19, 3, WOOD, x=x, y=3, z=z, sculpt=shape)
        for y in (7, 16):
            box(3, 2, 11, WOOD, x=x, y=y, sculpt=shape)
    for y in (9, 18):
        for z in (-4, 0, 4):
            box(26, 2, 2, METAL, y=y, z=z, sculpt=shape)
            for x in (-12, 12):
                box(3, 3, 3, DARK, x=x, y=y - 1, z=z, sculpt=shape)
    box(27, 2, 4, MARK, y=20, z=1, sculpt=shape)
    return shape


def overhead_inspection():
    shape = Sculpt()
    for x in (-25, 25):
        for z in (-15, 15):
            box(4, 31, 4, METAL, x=x, z=z, sculpt=shape)
            box(7, 4, 7, JOINT, x=x, z=z, sculpt=shape)
        box(4, 3, 34, DARK, x=x, y=30, sculpt=shape)
    for x in range(-25, 27, 4):
        rise = (26 - abs(x)) // 3
        box(4, 2, 35, BODY if x % 8 else METAL, x=x, y=32 + rise, sculpt=shape)
    box(54, 3, 4, WOOD, y=30, z=15, sculpt=shape)
    for x in (-17, 17):
        box(9, 3, 6, METAL, x=x, y=26, z=8, sculpt=shape)
        box(7, 2, 5, GLOW, x=x, y=25, z=8, sculpt=shape)
    return shape


def yard_sign():
    shape = box(25, 9, 4, DARK)
    box(23, 7, 1, BODY, y=1, z=2, sculpt=shape)
    return glyph(shape, ('###.#.#.###.###',
                         '#...#.#.#.#.#.#',
                         '###.###.#.#.###',
                         '..#.#.#.#.#.#..',
                         '###.#.#.###.#..'), -7, 2, 3, MARK)


def split_masonry(seed):
    rng = Random(seed)
    shape = Sculpt()
    for index in range(18):
        x, z = rng.randrange(-13, 15), rng.randrange(-7, 9)
        bottom = 1 + (index % 3)
        box(rng.randrange(3, 7), bottom, rng.randrange(3, 6),
            (STONE, JOINT, BODY)[index % 3], x=x, z=z, sculpt=shape)
    for x, z in ((-10, 3), (2, 0), (8, -5)):
        box(10, 2, 3, WOOD, x=x, y=1, z=z, sculpt=shape)
    return shape


def timber_passage():
    shape = Sculpt()
    for x in (-28, 28):
        for z in (-9, 9):
            box(5, 34, 5, WOOD, x=x, z=z, sculpt=shape)
            box(7, 3, 7, JOINT, x=x, z=z, sculpt=shape)
        box(5, 3, 24, DARK, x=x, y=32, sculpt=shape)
    for z in (-9, 9):
        box(62, 5, 5, WOOD, y=33, z=z, sculpt=shape)
    for x in range(-28, 30, 4):
        box(3, 2, 24, WOOD, x=x, y=38, sculpt=shape)
    for x in (-18, 14):
        box(14, 2, 24, METAL, x=x, y=39, sculpt=shape)
    box(12, 8, 2, DARK, x=9, y=26, z=10, sculpt=shape)
    box(10, 6, 1, MARK, x=9, y=27, z=12, sculpt=shape)
    return shape


def battered_sidewalk():
    shape = box(24, 2, 61, JOINT)
    for index, z in enumerate(range(-27, 29, 9)):
        for x in (-8, 1, 8):
            box(7, 1, 8, STONE if (index + x) % 4 else MARK, x=x, y=2, z=z, sculpt=shape)
        if index in (0, 2, 5):
            box(6, 1, 9, BODY, x=-3, y=2, z=z + 1, sculpt=shape)
        if index != 4:
            box(3, 2, 8, STONE, x=10, y=2, z=z, sculpt=shape)
    return shape


def repair_ledge():
    shape = Sculpt()
    for z in (-10, 10):
        box(6, 2, 5, DARK, x=6, z=z, sculpt=shape)
        box(12, 2, 5, METAL, x=3, y=2, z=z, sculpt=shape)
        box(18, 2, 5, WOOD, y=4, z=z, sculpt=shape)
    box(20, 2, 23, WOOD, y=6, sculpt=shape)
    for z in (-6, 0, 6):
        box(19, 1, 1, MARK, y=7, z=z, sculpt=shape)
    box(2, 3, 23, DARK, x=-9, y=6, sculpt=shape)
    return shape


def smouldering_rubble():
    shape = split_masonry(88)
    for x, z, w, h, d in ((-5, -3, 12, 5, 7), (2, 1, 13, 7, 9), (9, 3, 8, 4, 5)):
        box(w, h, d, DARK, x=x, y=1, z=z, sculpt=shape)
        box(w - 2, 2, 2, WOOD, x=x, y=h, z=z, sculpt=shape)
    for x, z in ((-8, -1), (-4, 0), (1, 4), (7, 3), (11, 0)):
        box(2, 1, 2, GLOW, x=x, y=5 + (x % 2), z=z, sculpt=shape)
    return shape


def fallen_masonry():
    shape = split_masonry(21)
    for x, y, z, width, depth in ((-9, 3, 2, 13, 9), (0, 6, 0, 16, 11), (10, 2, -4, 11, 9)):
        box(width, 3, depth, STONE, x=x, y=y, z=z, sculpt=shape)
        box(width - 3, 2, depth - 2, BODY, x=x + 1, y=y + 3, z=z - 1, sculpt=shape)
        box(4, 1, 3, MARK, x=x, y=y + 5, z=z, sculpt=shape)
    for row in range(7):
        box(5, 3, 5, WOOD, x=-14 + row * 3, y=2 + row, z=-8 + row,
            sculpt=shape)
    box(7, 2, 4, DARK, x=8, y=9, z=-4, sculpt=shape)
    return shape


def transfer_trolley():
    shape = box(17, 2, 12, DARK, y=2)
    for x in (-6, 6):
        for z in (-4, 4):
            box(3, 3, 3, METAL, x=x, z=z, sculpt=shape)
            box(2, 5, 2, WOOD, x=x, y=3, z=z, sculpt=shape)
    box(17, 2, 13, WOOD, y=8, sculpt=shape)
    for x in (-7, 6):
        box(2, 4, 14, DARK, x=x, y=10, sculpt=shape)
    box(12, 5, 9, BODY, y=10, sculpt=shape)
    box(12, 1, 10, MARK, y=14, sculpt=shape)
    for x in (-4, 4):
        box(1, 4, 1, METAL, x=x, y=11, z=5, sculpt=shape)
    box(3, 2, 1, MARK, x=1, y=11, z=5, sculpt=shape)
    box(4, 2, 4, DARK, x=-6, y=13, z=-4, sculpt=shape)
    box(3, 3, 3, GLOW, x=-6, y=15, z=-4, sculpt=shape)
    box(4, 1, 4, METAL, x=-6, y=18, z=-4, sculpt=shape)
    return shape


def salvage_manifest_crate():
    shape = box(14, 2, 12, DARK)
    for x in (-5, 5):
        box(2, 2, 12, WOOD, x=x, y=1, sculpt=shape)
    for z in (-5, 5):
        box(13, 9, 2, WOOD, y=3, z=z, sculpt=shape)
        box(12, 1, 2, DARK, y=7, z=z, sculpt=shape)
    for x in (-6, 6):
        box(2, 9, 10, WOOD, x=x, y=3, sculpt=shape)
        box(2, 1, 11, METAL, x=x, y=11, sculpt=shape)
    box(11, 2, 9, BODY, y=4, sculpt=shape)
    box(5, 5, 7, MARK, x=-3, y=6, z=1, sculpt=shape)
    box(2, 3, 6, STONE, x=1, y=6, z=-1, sculpt=shape)
    box(4, 1, 6, DARK, x=4, y=11, z=1, sculpt=shape)
    box(3, 1, 5, STONE, x=4, y=12, z=1, sculpt=shape)
    for z in (0, 2):
        box(2, 1, 1, METAL, x=4, y=13, z=z, sculpt=shape)
    box(9, 5, 1, BODY, y=5, z=6, sculpt=shape)
    glyph(shape, ('###.###', '#...#.#', '#.#.###', '#.#...#', '###.###'), -3, 5, 7, STONE)
    return shape


def aftermath(board):
    add, place, palette = board.add, board.place, board.set_palette
    place('Sandbag firing step', -26.7, -26.83, 1, 0.07)
    place('Sandbag firing step', -21.0, -29.75, 1, 0.07)
    place('Sandbag firing step', -26.25, -34.4, 1, 0.08)
    place('Sandbag firing step', -22.1, -34.9, 1, 0.08)
    add('Customs bank smouldering rubble', smouldering_rubble(), -26.53, -29.85, 1, 0.08)
    palette('Customs bank smouldering rubble', primary='#775c4e', secondary='#4b4743',
            accent='#e99549', leather='#716050')
    add('Customs fallen lintel and brick', fallen_masonry(), -26.9, -31.54, 1, 0.09)
    palette('Customs fallen lintel and brick', primary='#a4674a', skin='#beaa91', trim='#d3b68a',
            leather='#7f654d')
    add('Customs cargo transfer trolley', transfer_trolley(), -26.23, -27.6, height=0.09)
    palette('Customs cargo transfer trolley', primary='#587569', trim='#d3b384',
            leather='#8d684e', metal='#827e6b', accent='#ffd3a0')
    add('Open customs salvage crate and manifest', salvage_manifest_crate(), -24.55, -25.27)
    palette('Open customs salvage crate and manifest', primary='#526750', leather='#9f7551',
            skin='#e8d8aa', trim='#bf9e67', secondary='#594d3c', metal='#7b8076')
    board.placement_at('Staff car', -22.39, -28.86)['position'] = [-22.1, 0, -35.4]
    board.light(-25.83, 1.79, -28.61, '#ffd09c', 750, 4.8)
    board.light(-23.28, 3.85, -23.52, '#ffddb0', 3550, 8)
    board.light(-27.05, 3.8, -26.55, '#d0e5ff', 1950, 7)


def customs_terrace(board):
    add, place, palette = board.add, board.place, board.set_palette
    add('Customs repair scaffold landing', terrace(), -20.15, -20.9)
    palette('Customs repair scaffold landing', leather='#987756', trim='#a88d68', metal='#777d77')
    add('Customs timber stair flight', stair_flight(), -20.33, -16.05)
    palette('Customs timber stair flight', leather='#8d7054', trim='#b08c63', secondary='#665649')
    add('Freight office fractured terrace return', breastwork(), -18.68, -21.03, 1, 6.2)
    palette('Freight office fractured terrace return', primary='#98694e', skin='#9c8c77',
            trim='#ac9d82', leather='#816345')
    place('Freight office fractured terrace return', -29.65, -21.4, 1)
    add('Customs salvage timber hoist', chain_hoist(), -23.30, -30.53)
    palette('Customs salvage timber hoist', primary='#4b766e', leather='#876650', trim='#e4b963',
            metal='#7e8b83', secondary='#554d43', skin='#8e8577')
    add('Customs salvage inspection bench', bench_tools(), -20.75, -26.85, 1)
    palette('Customs salvage inspection bench', primary='#8e5144', leather='#8e6f54',
            trim='#c4ab86', metal='#8c9991')
    place('Customs salvage inspection bench', -28.12, -29.55, 3, 0.09)
    add('Covered salvage supplies', canvas_bundle(), -27.10, -25.82, 1, 0.10)
    palette('Covered salvage supplies', primary='#617867', leather='#a39168', skin='#a49b89')
    place('Covered salvage supplies', -26.45, -31.85, 1, 0.1)
    place('Covered salvage supplies', -22.65, -35.46, 3, 0.10)
    add('Broken brick and lath', split_masonry(56), -26.15, -22.95, height=0.10)
    for x, z, turn in ((-27.08, -24.5, 3), (-22.35, -23.6, 2),
                       (-28.13, -28.6, 3), (-22.1, -29.7, 2),
                       (-26.25, -32.1, 0), (-21.44, -34.1, 2)):
        place('Broken brick and lath', x, z, turn, 0.10)
    palette('Broken brick and lath', primary='#a26b54', skin='#9b907d', leather='#886749')
    add('Freight office scaffold canopy', timber_passage(), -18.2, -24.55, 1, 2.2)
    palette('Freight office scaffold canopy', leather='#8d7053', trim='#cfb378', metal='#778982')
    add('South freight annex frontage', packhouse(58, 24, 61), -17.7, -38.5)
    add('South freight annex enamel roof', ribbed_roof(61, 28, 19), -17.7, -38.52, height=6.25)
    palette('South freight annex frontage', primary='#657e76', secondary='#4e5f59', trim='#bdaf91',
            leather='#89917f', skin='#a89c89', visor='#6b8b87')
    palette('South freight annex enamel roof', primary='#594c48', metal='#857269', secondary='#4c403c')
    raised = dict(primary='#926450', skin='#9f927e', trim='#c5b69d', visor='#557473')
    add_wall(board, 'Customs back court salvage store front', customs_wall(53, 3),
             [(-31.35, -38.27, 0)], raised)
    add_wall(board, 'Customs back court salvage store return', customs_side(20, 3),
             [(-33.99, -39.12, 1), (-28.68, -39.12, 3)], raised)
    add('Customs back court slate ridge', slate_roof(59, 25, 15), -31.35, -38.66, height=9.03)
    palette('Customs back court slate ridge', primary='#5e6867', skin='#9c816e', secondary='#474e4c')
    add('Fractured customs sidewalk', battered_sidewalk(), -27.49, -24.0, height=-0.09)
    place('Fractured customs sidewalk', -27.49, -30.1, height=-0.09)
    place('Fractured customs sidewalk', -27.49, -36.2, height=-0.09)
    place('Fractured customs sidewalk', -20.43, -24.0, 2, -0.09)
    place('Fractured customs sidewalk', -20.43, -30.1, 2, -0.09)
    palette('Fractured customs sidewalk', primary='#8e705e', skin='#a99883', trim='#bba181')
    board.light(-23.12, 2.57, -30.21, '#f6bd82', 430, 7)
    board.light(-20.1, 2.34, -24.7, '#e9bd95', 150, 6)
    add('Freight office repair ledge', repair_ledge(), -20.77, -25.22, height=3.42)
    palette('Freight office repair ledge', leather='#8e7258', trim='#b19772', metal='#849188')
    aftermath(board)
    board.shot('Customs salvage terrace', [-24.65, 2.65, -18.65], [-23.9, 3.08, -30.9])


def rail_lookout_step():
    shape = box(14, 2, 16, JOINT)
    for x in (-5, 5):
        for z in (-6, 6):
            box(3, 4, 3, WOOD, x=x, y=2, z=z, sculpt=shape)
    box(15, 2, 17, WOOD, y=5, sculpt=shape)
    box(14, 2, 5, WOOD, y=3, z=10, sculpt=shape)
    box(14, 2, 5, DARK, y=1, z=14, sculpt=shape)
    for z in (-6, -2, 2, 6):
        box(14, 1, 1, MARK, y=6, z=z, sculpt=shape)
    return shape


def rail_work(board):
    add, place, palette = board.add, board.place, board.set_palette
    add('Rail coal feed hopper', coal_hopper(), -34.36, -7.09)
    palette('Rail coal feed hopper', primary='#775b4b', secondary='#53493f', metal='#75847b',
            skin='#a29a88')
    add('Rail inspection shelter', overhead_inspection(), -30.3, -5.05, 3)
    palette('Rail inspection shelter', primary='#6e8980', metal='#87958a',
            leather='#93785d', secondary='#52615b')
    place('Rail inspection shelter', -28.8, -15.76)
    add('Track hardware racks', shaft_rack(), -30.44, -4.47, 1)
    palette('Track hardware racks', leather='#8c7559', trim='#a99270', metal='#858d7f')
    place('Track hardware racks', -32.48, -15.42)
    place('Track hardware racks', -23.75, -9.22)
    place('Customs salvage inspection bench', -27.64, -5.81, 1)
    place('Covered salvage supplies', -27.44, -8.23, 3)
    place('Covered salvage supplies', -33.1, -5.6)
    place('Covered salvage supplies', -35.15, -12.22)
    place('Broken brick and lath', -24.2, -6.5)
    place('Broken brick and lath', -33.7, -6.45, 2)
    add('Rail inspection shift board', yard_sign(), -29.62, -3.3, 1, 2.08)
    palette('Rail inspection shift board', primary='#4f6b62', trim='#d4bf97')
    add('Coal yard locker hut', packhouse(45, 28, 37), -37.17, -4.22)
    add('Coal yard locker hut roof', ribbed_roof(49, 33, 15), -37.17, -4.18, height=3.87)
    palette('Coal yard locker hut', primary='#637671', skin='#a89a82', leather='#7f887c',
            trim='#c9b08c', visor='#7d938e')
    palette('Coal yard locker hut roof', primary='#6e5148', metal='#997563', secondary='#584741')
    add('Rail buffer dispatch store', packhouse(56, 21, 47), -38.76, -9.42, 1)
    add('Rail buffer dispatch roof', ribbed_roof(60, 25, 12), -38.63, -9.42, 1, 4.83)
    palette('Rail buffer dispatch store', primary='#7e7665', secondary='#4f5952',
            skin='#a39c89', trim='#d0b998', visor='#71928c')
    palette('Rail buffer dispatch roof', primary='#58706c', metal='#7b8a7f', secondary='#43534e')
    board.light(-30.34, 2.44, -3.82, '#ffd49e', 320, 7)
    board.light(-28.7, 2.40, -15.4, '#f0bd8f', 260, 6)
    add('Rail foreman lookout step', rail_lookout_step(), -18.73, -6.10)
    palette('Rail foreman lookout step', leather='#90765e', trim='#ac926f', skin='#908a7d')
    board.shot('Rail repair yard', [-16.45, 2.86, -4.65], [-29.5, 2.20, -9.88])


def dock_receiving_float():
    shape = Sculpt()
    for x in (-17, 0, 17):
        for z in (-14, 14):
            box(4, 9, 4, DARK, x=x, z=z, sculpt=shape)
        box(3, 3, 35, WOOD, x=x, y=6, sculpt=shape)
    for x in range(-18, 19, 4):
        box(4, 2, 35, WOOD, x=x, y=8, sculpt=shape)
        if x % 3:
            box(1, 1, 33, JOINT, x=x+1, y=9, sculpt=shape)
    for x in (-18, 18):
        for z in (-13, 13):
            box(4, 4, 4, METAL, x=x, y=8, z=z, sculpt=shape)
    return shape


def crane_slung_crate():
    shape = box(16, 10, 13, WOOD)
    for y in (0, 9):
        box(16, 1, 14, DARK, y=y, sculpt=shape)
    for x in (-6, 6):
        box(2, 10, 15, METAL, x=x, sculpt=shape)
        for index in range(4):
            reach = x - (index if x > 0 else -index)
            box(1, 2, 1, MARK, x=reach, y=10 + index, z=5, sculpt=shape)
            box(1, 2, 1, MARK, x=reach, y=10 + index, z=-4, sculpt=shape)
    box(8, 1, 11, DARK, y=14, sculpt=shape)
    box(2, 3, 2, METAL, y=15, sculpt=shape)
    box(8, 4, 1, BODY, y=4, z=7, sculpt=shape)
    box(5, 2, 1, MARK, x=1, y=5, z=8, sculpt=shape)
    return shape


def landing_deck_load():
    shape = Sculpt()
    for z in (-15, 15):
        for x in (-15, -4, 7, 16):
            box(1, 7, 2, METAL, x=x, z=z, sculpt=shape)
            box(2, 2, 3, DARK, x=x, z=z, sculpt=shape)
        box(32, 1, 2, METAL, y=6, z=z, sculpt=shape)
    for x, z, width, depth, height in ((-9, -6, 11, 8, 7), (4, -7, 10, 7, 6),
                                          (13, -6, 8, 8, 5)):
        box(width, height, depth, WOOD, x=x, z=z, sculpt=shape)
        box(width, 1, depth + 1, MARK, x=x, y=height - 1, z=z, sculpt=shape)
        for side in (-1, 1):
            box(1, height, depth + 1, DARK, x=x + side * (width // 2 - 1), z=z, sculpt=shape)
    box(17, 8, 2, BODY, x=-5, y=1, z=16, sculpt=shape)
    glyph(shape, ('#...###.###', '#...#.....#', '#...#....#.',
                  '#...#....#.', '###.###..#.'), -10, 2, 17, MARK)
    return shape


def harbor_transfer(board):
    add, palette = board.add, board.set_palette
    add('Harbor crane receiving float', dock_receiving_float(), 35.22, 4.55, height=-0.7)
    palette('Harbor crane receiving float', leather='#957857', skin='#a3947d',
            secondary='#604e3b', metal='#73847f')
    add('Slung harbor crate', crane_slung_crate(), 35.25, 4.2, height=1.75)
    palette('Slung harbor crate', primary='#73866a', leather='#ba8758',
            trim='#e9c77d', metal='#79877a', secondary='#695342')
    add('Landing craft rail and deck load', landing_deck_load(), 39.45, 12.2, height=0.30)
    palette('Landing craft rail and deck load', primary='#607970', leather='#8d775b',
            trim='#e0c88d', metal='#879491', secondary='#4e5c57')
    board.light(39.1, 4.0, 7.8, '#ffdfb8', 4600, 11)
    board.shot('Harbor transfer overview', [43.8, 4.1, 14.5], [34.5, 2.15, 5.15])

def dress(board):
    customs_terrace(board)
    rail_work(board)
    harbor_transfer(board)
    board.stage_actor('field_officer', -21.19, -25.62, y=4.23, yaw=292)
    board.stage_actor('field_medic', -23.50, -25.53, yaw=302, pose=('Reach', 0.36))
    board.stage_actor('rifleman', -25.73, -25.37, yaw=90, pose=('Reach', 0.36))
    board.stage_actor('rifleman', -25.0, -35.45, y=0.09, yaw=130)
    board.stage_actor('field_officer', 34.08, 4.58, y=0.3, yaw=57, pose=('Reach', 0.36))
    board.stage_actor('rifleman', 36.46, 4.52, y=0.3, yaw=248, pose=('Reach', 0.36))
    board.stage_actor('field_medic', -26.6, 67.06, yaw=154)
    board.stage_actor('rifleman', 39.18, 12.34, y=0.3, yaw=170, pose=('Reach', 0.36))
