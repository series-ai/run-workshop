"""Street, workshop, and courtyard dressing for Alderwick."""

from random import Random

from creature_kit import Sculpt
from level_geometry import box, span

from . import medieval_buildings as town
from . import medieval_landscape as landscape
from .common import BODY, DARK, GLASS, GLOW, GREEN, JOINT, MARK, METAL, STONE, WOOD, arch

COURT_HEIGHT = 3.6
HALL_HEIGHT = 3.2


def place_group(board, label, shape, positions, **colors):
    first, *rest = positions
    board.add(label, shape, *first)
    for position in rest:
        board.place(label, *position)
    if colors:
        board.set_palette(label, **colors)


def planter():
    shape = box(22, 2, 11, WOOD)
    box(21, 3, 10, DARK, y=2, sculpt=shape)
    for x in (-9, 9):
        box(2, 4, 11, WOOD, x=x, y=1, sculpt=shape)
    for x, z, y in ((-7, -1, 5), (-3, 2, 8), (0, -2, 6), (4, 1, 9), (7, -1, 7)):
        box(3, y - 3, 2, GREEN, x=x, z=z, y=4, sculpt=shape)
        box(2, 2, 2, BODY if x % 2 else MARK, x=x, z=z, y=y, sculpt=shape)
    return shape


def barrel():
    shape = box(7, 13, 7, WOOD)
    box(9, 9, 9, WOOD, y=2, sculpt=shape)
    for y, width in ((1, 9), (4, 11), (9, 11), (11, 9)):
        box(width, 1, width, DARK, y=y, sculpt=shape)
    box(4, 1, 4, MARK, y=13, sculpt=shape)
    return shape


def sacks():
    shape = Sculpt()
    for x, z, w, h in ((-6, 1, 8, 7), (1, -2, 8, 9), (7, 2, 6, 6), (-5, 1, 5, 4)):
        bottom = 5 if (x, z) == (-5, 1) else 0
        box(w, h, 7, MARK, x=x, z=z, y=bottom, sculpt=shape)
        box(max(2, w - 3), 2, 5, WOOD, x=x, z=z, y=bottom + h - 1, sculpt=shape)
        box(2, 1, 2, DARK, x=x, z=z, y=bottom + h + 1, sculpt=shape)
    return shape


def cloth_line(length, height, *, seed):
    rng = Random(seed)
    shape = Sculpt()
    ends = (-length // 2, length // 2)
    for x in ends:
        box(3, height + 2, 3, DARK, x=x, sculpt=shape)
        box(5, 2, 5, WOOD, x=x, y=height, sculpt=shape)
    for x in range(ends[0], ends[1] + 1):
        y = height - round(5 * (1 - (2 * x / length) ** 2))
        box(1, 1, 1, DARK, x=x, y=y, sculpt=shape)
        if (x + length // 2) % 8 < 6:
            size = 2 + (6 - (x + length // 2) % 8) // 2
            color = (BODY, MARK, GLASS, GREEN)[((x + length // 2) // 8) % 4]
            box(1, size, 2, color, x=x, y=y-size, sculpt=shape)
        if x % 13 == 0:
            box(2, 2, 2, GLOW, x=x, y=y-rng.choice((1, 2)), z=1, sculpt=shape)
    return shape


def fountain():
    shape = Sculpt()
    for h, size in ((0, 26), (1, 24), (7, 24)):
        box(size, 2, size-6, STONE, y=h, sculpt=shape)
        box(size-6, 2, size, STONE, y=h, sculpt=shape)
    for x in (-10, 10):
        box(3, 5, 18, STONE, x=x, y=2, sculpt=shape)
    for z in (-10, 10):
        box(18, 5, 3, STONE, z=z, y=2, sculpt=shape)
    shape.cut(span(17), (6, 9), span(17))
    box(17, 1, 17, GLASS, y=5, sculpt=shape)
    box(6, 10, 6, JOINT, y=5, sculpt=shape)
    box(12, 2, 12, STONE, y=14, sculpt=shape)
    box(9, 1, 9, GLASS, y=16, sculpt=shape)
    box(3, 7, 3, STONE, y=15, sculpt=shape)
    box(5, 1, 3, MARK, y=22, sculpt=shape)
    for x in (-4, 4):
        box(1, 7, 1, GLASS, x=x, y=8, sculpt=shape)
    return shape


def flower_stand():
    shape = box(4, 29, 4, DARK, x=-4)
    box(5, 3, 5, STONE, x=-4, sculpt=shape)
    box(14, 3, 3, WOOD, x=1, y=26, sculpt=shape)
    box(1, 6, 1, METAL, x=5, y=22, sculpt=shape)
    box(9, 3, 8, WOOD, x=5, y=19, sculpt=shape)
    box(11, 2, 10, MARK, x=5, y=21, sculpt=shape)
    for x, z, y in ((2, 1, 23), (6, 2, 25), (7, -1, 23), (4, -2, 26)):
        box(3, 4, 3, GREEN, x=x, z=z, y=22, sculpt=shape)
        box(2, 2, 2, BODY, x=x, z=z, y=y, sculpt=shape)
    return shape


def delivery_cart():
    shape = Sculpt()
    box(16, 3, 25, DARK, y=6, sculpt=shape)
    box(19, 2, 26, WOOD, y=8, sculpt=shape)
    for x in (-9, 9):
        box(2, 6, 26, WOOD, x=x, y=9, sculpt=shape)
        box(2, 1, 27, MARK, x=x, y=14, sculpt=shape)
        box(2, 2, 14, DARK, x=x, z=-16, y=8, sculpt=shape)
    for z in (-8, 9):
        box(24, 2, 2, METAL, z=z, y=4, sculpt=shape)
        for x in (-11, 11):
            for dy, dz, width, height in ((-4, 0, 6, 1), (-3, -3, 2, 2), (-3, 3, 2, 2),
                                          (-2, -4, 1, 5), (-2, 4, 1, 5), (3, -3, 2, 2),
                                          (3, 3, 2, 2), (4, 0, 6, 1)):
                box(2, height, width, DARK, x=x, z=z+dz, y=4+dy, sculpt=shape)
            box(1, 1, 7, WOOD, x=x, z=z, y=4, sculpt=shape)
            box(1, 7, 1, WOOD, x=x, z=z, y=1, sculpt=shape)
    for x, z, y in ((0, 6, 13), (4, -6, 10), (-5, -3, 14)):
        box(8, y-7, 8, MARK, x=x, z=z, y=10, sculpt=shape)
        box(2, y-7, 9, WOOD, x=x, z=z, y=10, sculpt=shape)
    return shape


def shrubs(seed, *, berries=False):
    rng = Random(seed)
    shape = Sculpt()
    for x, z, height in ((-7, 2, 8), (0, -1, 11), (8, 1, 7)):
        box(2, height, 2, WOOD, x=x, z=z, sculpt=shape)
        box(11, 5, 10, GREEN, x=x, z=z, y=height-4, sculpt=shape)
        box(7, 4, 8, GREEN, x=x, z=z, y=height, sculpt=shape)
        for _ in range(4):
            dx, dz = rng.randrange(-4, 5), rng.randrange(-4, 5)
            box(2, 2, 2, BODY if berries else MARK, x=x+dx, z=z+dz, y=height+2, sculpt=shape)
    return shape


def split_rail(depth):
    shape = Sculpt()
    for x in (-depth // 2 + 3, 0, depth // 2 - 3):
        box(4, 12, 4, DARK, x=x, sculpt=shape)
        box(3, 2, 3, MARK, x=x, y=12, sculpt=shape)
    for y in (4, 9):
        box(depth, 2, 2, WOOD, y=y, sculpt=shape)
    return shape


def chimney():
    shape = Sculpt()
    town.masonry(shape, 0, 0, 12, 12, 24)
    box(15, 3, 15, STONE, y=23, sculpt=shape)
    shape.cut(span(6), (22, 26), span(6))
    box(12, 2, 12, JOINT, y=18, sculpt=shape)
    return shape


def storage_loft(width, depth):
    shape = Sculpt()
    for x in (-width//2 + 2, width//2 - 2):
        for z in (-depth//2 + 3, depth//2 - 3):
            box(3, 32, 4, DARK, x=x, z=z, sculpt=shape)
    for z in (-depth//2 + 2, depth//2 - 2):
        box(width, 4, 5, DARK, y=28, z=z, sculpt=shape)
    box(width, 2, depth, WOOD, y=31, sculpt=shape)
    for x in range(-width//2 + 2, width//2 - 2, 6):
        box(3, 2, depth, DARK, x=x, y=31, sculpt=shape)
    return shape


def iron_rack():
    shape = Sculpt()
    for x in (-10, 10):
        box(3, 20, 4, DARK, x=x, sculpt=shape)
    box(24, 3, 4, WOOD, y=18, sculpt=shape)
    box(24, 3, 7, WOOD, y=1, sculpt=shape)
    for x, height in ((-7, 13), (-3, 15), (1, 11), (6, 17)):
        box(2, height, 2, METAL, x=x, z=-3, y=3, sculpt=shape)
        box(4, 2, 3, (DARK if x < 0 else METAL), x=x, z=-3, y=height+2, sculpt=shape)
    return shape


def hang_herbs():
    shape = box(29, 2, 2, WOOD, y=13)
    for i, x in enumerate(range(-11, 12, 4)):
        n = 3 + ((5*i) % 3)
        box(1, 6, 1, MARK, x=x, y=7, sculpt=shape)
        box(3, n, 3, GREEN, x=x, y=7-n, sculpt=shape)
        box(2, 2, 2, BODY if i % 2 else MARK, x=x, y=7-n, z=1, sculpt=shape)
    return shape


def tabletop():
    shape = Sculpt()
    for x, z, tint in ((-5, -8, MARK), (-4, 8, GREEN), (4, 3, BODY)):
        box(6, 1, 6, tint, x=x, z=z, sculpt=shape)
        box(4, 2, 4, MARK, x=x, z=z, y=1, sculpt=shape)
    for x, z in ((-4, -2), (4, -6), (4, 9)):
        box(3, 4, 3, METAL, x=x, z=z, sculpt=shape)
        box(2, 2, 2, DARK, x=x, z=z, y=2, sculpt=shape)
    return shape


def sconces():
    shape = box(5, 14, 2, DARK)
    box(4, 2, 6, WOOD, z=-2, y=7, sculpt=shape)
    box(7, 2, 7, METAL, z=-5, y=7, sculpt=shape)
    box(3, 6, 3, MARK, z=-5, y=9, sculpt=shape)
    box(2, 3, 2, GLOW, z=-5, y=14, sculpt=shape)
    return shape


def quay_boat():
    shape = Sculpt()
    for z in range(-16, 17, 2):
        beam = 7 - abs(z)//3
        box(2*beam+1, 2, 2, WOOD, z=z, sculpt=shape)
        for x in (-beam, beam):
            box(2, 3, 2, DARK, x=x, z=z, y=2, sculpt=shape)
    for z in (-6, 4):
        box(12, 2, 3, WOOD, z=z, y=3, sculpt=shape)
    for i in range(8):
        box(2, 1, 2, WOOD, x=-5+i, z=8-i, y=5, sculpt=shape)
    return shape


def cargo_hoist():
    shape = box(6, 35, 6, DARK)
    box(32, 4, 5, WOOD, x=12, y=31, sculpt=shape)
    for i in range(11):
        box(3, 3, 4, WOOD, x=i, y=17+i, sculpt=shape)
    box(1, 16, 1, METAL, x=26, y=15, sculpt=shape)
    box(4, 2, 3, DARK, x=26, y=14, sculpt=shape)
    box(3, 5, 2, DARK, x=27, y=10, sculpt=shape)
    box(5, 1, 4, MARK, y=35, sculpt=shape)
    return shape


def shop_dressing(board):
    a, place, colors = board.add, board.place, board.set_palette
    place_group(board, 'Wine barrels', barrel(), ((-8.9, -16.8), (-8.0, -16.3), (7.0, -10.4),
                (8.2, -15.7), (-14.8, -20.9), (-2.9, -17.8), (3.25, -15.7), (-32, 9.9), (-31.6, 8.7), (-12.0, 29.8),
                (13.7, 34.3), (-36.0, -11.7), (15.6, -8.8)),
                leather='#a1784e', secondary='#5a3e30', trim='#c49a5e')
    place_group(board, 'Rye and flour sacks', sacks(), ((-7.6, -14.8), (7.4, -5.6), (-31.4, 11.8),
                (-28.5, 7), (14.4, -14.2), (7.0, -16.0), (7.5, 34.7), (-2.5, -16.1)), trim='#c0ac85')
    place_group(board, 'Shopfront flower trough', planter(), ((-8.2, 5.1, 3, 1.25),
                (-8.2, 0.8, 3, 1.25), (-13.8, -22.8, 3, 1.25), (-13.8, -17.1, 3, 1.25),
                (13.5, -14.85, 1, 1.25), (14.5, 9.2, 0, 1.0), (24.7, -28.6, 0, 1.0)),
                primary='#d67f53', detail='#7e9e4b', trim='#ddd08c')
    place_group(board, 'Hung flower stands', flower_stand(), ((-2.35, 14.7, 0),
                (2.35, 14.7, 2), (-7.4, 4.8, 0), (-6.5, -14.1, 0), (6.7, -5.0, 2)),
                primary='#d37b55', detail='#8ba257')
    a('Postern lane threshold', box(25, 2, 9, STONE), 16, 16, height=-0.16)
    colors('Postern lane threshold', skin='#a19f8b')
    a('Market stone fountain', fountain(), -3.0, -9.3)
    colors('Market stone fountain', visor='#8aaeb2', skin='#afb29d', trim='#c3a273')
    a('Market cloth and lantern line', cloth_line(77, 44, seed=4), 0, -10.3)
    place('Market cloth and lantern line', 0, 6.1)
    colors('Market cloth and lantern line', primary='#b15c43', detail='#8f994c',
           visor='#638d8d', trim='#f2c376')
    a('Long fair bunting', cloth_line(111, 51, seed=12), 0, -18.5)
    colors('Long fair bunting', primary='#a85540', detail='#829247',
           visor='#719f9a', trim='#e6bd76')
    place_group(board, 'Wagon with market cargo', delivery_cart(), ((-8.8, -3.3, 1),
                (8.7, -20.8, 2), (4.95, -18.7, 2), (-37.8, -1.5, 0), (13.3, 33.2, 3), (24, -33, 1)),
                leather='#815335', trim='#c09c66', secondary='#503829')
    place_group(board, 'Lane flower fence', split_rail(45), ((-4.8, 11.8, 1), (3.4, 19.35, 1),
                (-3, 18.9, 1), (-7.6, -2.9, 1), (7.6, -2.6, 1), (24, 8.3), (30.9, 6.3)),
                leather='#876951', secondary='#503a30')
    for x, z in ((-3.9, -10.33), (3.9, -10.33), (-5.55, -18.5), (5.55, -18.5)):
        board.light(x, 2.55, z, '#ffcf83', 155, 5)
    place_group(board, 'Stone flues', chimney(), ((-17.4, -17.9, 0, 6.1), (23.2, -10.6, 0, 4.9),
                (-14.4, 5.8, 0, 6.2), (-31, 6.7, 0, 7.1), (10.95, -32.2, 0, 6.83),
                (24.9, -25.9, 0, 5.4), (-22.8, -34.1, 0, 3.9)), skin='#a28a71')
    a('Smithy coal loft', storage_loft(37, 15), 23.2, -14.8, 1)
    a('Forged iron rack', iron_rack(), 22.3, -8.8, 1)
    place('Forged iron rack', 24.0, -13.3, 2)
    place('Rye and flour sacks', 23.3, -14.8, height=3.3)
    a('Drying herbs above the shop', hang_herbs(), -12.3, 3.8, 1, 2.62)
    place('Drying herbs above the shop', -12.9, 1.0, 2, 2.65)
    colors('Drying herbs above the shop', detail='#87a857', primary='#91597b', trim='#ccb785')
    a('Herbal mixing dishes', tabletop(), -11.4, 1.05, 2, 1.1)
    colors('Herbal mixing dishes', primary='#8b4a3c', detail='#76935e', metal='#abb2a7')
    for x, y, z, color, intensity in ((18.1, 2.75, -11.3, '#ffe6c4', 1250),
             (21.7, 2.65, -13.9, '#e8a373', 800), (-10.4, 2.65, 2.1, '#ffe2c1', 1450),
             (-14.0, 2.8, 4.8, '#dfecdc', 830), (-17.6, 2.9, -19.7, '#f8dab4', 2500)):
        board.light(x, y, z, color, intensity, 7)


def outskirts(board):
    a, place, colors = board.add, board.place, board.set_palette
    a('South road masonry gate', arch(91, 63, 16, 48), 0, -42)
    colors('South road masonry gate', skin='#a4aa97', trim='#bec4ab')
    a('South road coping', town.curtain(70), -7.8, -42)
    place('South road coping', 7.8, -42)
    place('Castle gate banner', -3.2, -43.1, height=2.6)
    place('Castle gate banner', 3.2, -43.1, height=2.6)
    place_group(board, 'Alder hedge', shrubs(12), ((-11, -43), (-15, -43), (-19, -43), (-24, -43),
                (13, -42), (17, -42), (21, -42), (25, -42), (29, -42), (37, -43),
                (-24.5, 13.3, 1), (-22.5, 18, 1), (-24, 33, 1), (38.3, 22, 1), (37, 28, 1),
                (-37, 37, 1), (38, 36, 1), (-29.2, 38, 1)), detail='#697e48',
                trim='#84955c', primary='#a18352')
    place_group(board, 'Berry hedge', shrubs(29, berries=True), ((-11.2, 13.3, 1), (-19.2, 17.1),
                (-36.8, 19.4, 1), (-36.5, 21.7, 1), (-35.9, 39, 1), (26, -39, 1), (33, -35, 1),
                (39.7, -39, 1), (40.6, 6, 1), (32.5, 15.3, 1), (-33, 20, 1)),
                detail='#657c46', primary='#aa5749')
    place_group(board, 'Farm lane fence', split_rail(78), ((-14, -40), (-22, -40), (-30, -40),
                (19, -39), (27, -39), (35, -39), (39, -35, 1), (39, -27, 1), (39, -19, 1),
                (38.0, 19, 1), (37, 26, 1), (37, 34, 1), (-32, 35, 1)),
                secondary='#62503a', leather='#8a7152')
    for x, z in ((-27, -36), (-29, -32), (-25, -30), (-35, -38), (-30, -15),
                 (15, -35), (20.4, -37.1), (29, -38.2), (36, -34), (38, -40),
                 (38, -23), (33, -21), (38.1, 29), (42, 36), (35, 43), (-33, 41)):
        place('Young alder', x, z)
    a('Harvest store frame', storage_loft(51, 26), 32.6, -33.2)
    a('Harvest store roof', town.pitched_roof(59, 33, 15), 32.6, -33.2, height=3.25)
    colors('Harvest store roof', primary='#98654b', secondary='#664e38')
    for x, z in ((31.8, -32.8), (34.1, -33.3), (27.8, -37.4), (-23, -39),
                 (36, -36), (36.4, -37.8), (39.5, 30.5)):
        place('Rye and flour sacks', x, z)
    a('River shore mooring skiff', quay_boat(), -42.2, 7.4, height=-0.38)
    place('River shore mooring skiff', -41.6, -16.4, 2, -0.38)
    place('River shore mooring skiff', -42.3, 28.1, 2, -0.38)
    colors('River shore mooring skiff', leather='#937051', secondary='#5e5341')
    a('Quay cargo hoist', cargo_hoist(), -38.7, 10.9, 2)
    place('Quay cargo hoist', -37.8, 28.4, 2)
    a('River loading landing', box(49, 3, 35, WOOD), -39.7, 27.5, height=-0.3)
    for x, z in ((-37.8, 26.7), (-38.6, 28.7), (-38.2, 11.0), (-37.5, -7.7)):
        place('Wine barrels', x, z)


def lift_group(board, placement_start, fixture_start, height):
    for placement in board.placements[placement_start:]:
        placement['position'][1] += height
    for fixture in board.fixtures[fixture_start:]:
        fixture['position'][1] += height


def roof_streamer():
    shape = box(2, 27, 2, WOOD, x=-6)
    for x in range(-5, 6):
        bottom = 20 - abs(x + 2)//2
        box(1, 27 - bottom - abs(x)//3, 1, BODY, x=x, y=bottom, sculpt=shape)
        box(1, 1, 1, MARK, x=x, y=bottom, sculpt=shape)
    box(3, 2, 3, METAL, x=-6, y=26, sculpt=shape)
    return shape


def upper_ward_foundation():
    shape = Sculpt()
    town.masonry(shape, 0, 0, 168, 111, 32)
    for x in (-75, -52, 52, 75):
        box(6, 13, 10, STONE, x=x, z=-50, sculpt=shape)
        box(3, 18, 5, JOINT, x=x, z=-53, sculpt=shape)
    box(167, 3, 111, STONE, y=28, sculpt=shape)
    return shape


def ward_register():
    shape = Sculpt()
    for x in (-3, 3):
        for z in (-4, 4):
            box(2, 10, 2, DARK, x=x, z=z, sculpt=shape)
        box(2, 2, 9, WOOD, x=x, y=3, sculpt=shape)
    box(9, 2, 12, WOOD, y=9, sculpt=shape)
    box(9, 1, 1, METAL, y=9, z=-6, sculpt=shape)
    box(7, 1, 8, BODY, y=11, z=1, sculpt=shape)
    for x in (-2, 2):
        box(3, 1, 6, MARK, x=x, y=11, z=1, sculpt=shape)
        for z in (0, 2):
            box(2, 1, 1, STONE, x=x, y=11, z=z, sculpt=shape)
    box(2, 1, 2, DARK, y=11, z=-4, sculpt=shape)
    box(1, 2, 1, METAL, y=12, z=-4, sculpt=shape)
    return shape


def ward_notice_post():
    shape = box(5, 3, 5, STONE)
    box(3, 27, 3, WOOD, y=3, sculpt=shape)
    box(5, 2, 5, METAL, y=28, sculpt=shape)
    box(10, 2, 3, WOOD, x=-3, y=25, sculpt=shape)
    box(7, 10, 2, BODY, x=-4, y=15, sculpt=shape)
    box(5, 4, 1, MARK, x=-4, y=19, z=-1, sculpt=shape)
    box(1, 3, 1, DARK, x=-4, y=19, z=-2, sculpt=shape)
    return shape


def stone_stair(width, length, rise):
    shape = Sculpt()
    start = -(length // 2)
    for z in range(start, start + length):
        top = round(rise * (z - start + 0.5) / length)
        box(width, top+1, 1, JOINT, z=z, sculpt=shape)
        box(width - 2, 1, 1, STONE, z=z, y=top, sculpt=shape)
        for x in (-width // 2 - 2, width // 2 + 2):
            box(4, top+7, 1, STONE, x=x, z=z, sculpt=shape)
            box(4, 2, 1, MARK, x=x, z=z, y=top+6, sculpt=shape)
    return shape


def quarried_plinth(width, depth):
    shape = box(width, 36, depth, STONE)
    for z, h in ((-(depth // 2), 5), (depth - depth // 2 - 1, 8)):
        for x in range(-width // 2 + 4, width // 2 - 4, 8):
            box(6, 3, 1, JOINT, x=x, z=z, y=h + (x % 3), sculpt=shape)
        box(width, 1, 1, JOINT, y=24, z=z, sculpt=shape)
    box(width, 1, depth, STONE, y=35, sculpt=shape)
    for z in range(-depth // 2 + 4, depth // 2 - 3, 9):
        for x in range(-width // 2 + 5, width // 2 - 4, 10):
            if (x + z) % 3:
                box(6, 1, 5, MARK, x=x, z=z, y=35, sculpt=shape)
    return shape


def court_terrace(board):
    a, place, palette = board.add, board.place, board.set_palette
    a('Ward quarried terrace', quarried_plinth(80, 80), -16, 28.5)
    for z in (28.5, 36.5, 44.5):
        for x in (-16, -8, 0, 8, 16):
            if (x, z) != (-16, 28.5):
                place('Ward quarried terrace', x, z)
    palette('Ward quarried terrace', skin='#93866f', trim='#afa387')
    a('Ward outer bank', quarried_plinth(40, 80), -22, 28.5)
    for x, z in ((22, 28.5), (-22, 36.5), (22, 36.5), (-22, 44.5), (22, 44.5)):
        place('Ward outer bank', x, z)
    palette('Ward outer bank', skin='#93866f', trim='#afa387')
    a('Ward long rock footing', quarried_plinth(80, 50), -20, 22)
    place('Ward long rock footing', -12, 22)
    a('Ward short rock footing', quarried_plinth(60, 50), -5, 22)
    place('Ward short rock footing', 5, 22)
    place('Ward short rock footing', 11, 22)
    place('Ward short rock footing', 20.4, 22)
    for label in ('Ward long rock footing', 'Ward short rock footing'):
        palette(label, skin='#918774', trim='#b2a38c')
    a('Gate dressed stair', stone_stair(39, 55, 36), 0, 19.25, height=-0.1)
    a('Gate portal footing', quarried_plinth(40, 28), 0, 23.25, height=-0.01)
    a('Postern dressed stair', stone_stair(23, 64, 36), 16, 18.4, height=-0.1)
    a('Postern portal footing', quarried_plinth(25, 32), 16, 23.05, height=-0.01)
    for label in ('Gate dressed stair', 'Gate portal footing', 'Postern dressed stair', 'Postern portal footing'):
        palette(label, skin='#a9967c', trim='#c0ad91')
    for x, z in ((-12.8, 18.7), (-10.6, 18.4), (-15.3, 19.25), (10.8, 18.5),
                 (12.5, 18.2), (13.6, 19.1), (18.9, 19.0)):
        place('Alder hedge', x, z, 1)


def stone_shelf(seed, *, low=False):
    rng = Random(seed)
    shape = Sculpt()
    contours = ((78, 68, 13, 0, 0), (69, 61, 15, 3, 1), (60, 58, 16, 3, 4),
                (51, 46, 17, 6, 6), (40, 38, 17, 7, 9), (29, 27, 19, 8, 9))
    bottom = 0
    for width, depth, height, x, z in contours[:4 if low else 6]:
        town.masonry(shape, x, z, width, depth, height, bottom=bottom)
        for _ in range(8):
            flank = rng.choice((-1, 1))
            xx = rng.randrange(-width//2+3, width//2-3)
            p = max(2, min(8, height-3))
            c = rng.choice((JOINT, DARK, STONE))
            box(rng.randrange(3, 7), p, 2, c, x=x+xx, y=bottom+rng.randrange(0, height-p),
                z=z+flank*(depth//2-1), sculpt=shape)
        edge = bottom + height - 1
        box(width, 2, depth-1, GREEN, x=x, y=edge, z=z, sculpt=shape)
        bottom += height
    return shape


def hillsides(board):
    a, place, colors = board.add, board.place, board.set_palette
    a('Alder ridge escarpment', landscape.escarpment(44), -33.0, 40.45)
    place('Alder ridge escarpment', 35.6, 41.4)
    colors('Alder ridge escarpment', skin='#777d7c', detail='#71875a')
    for x, z, y in ((-31.6, 42.0, 11.5), (37.0, 42.9, 11.5), (-35.4, 37.6, 1.5),
                    (39.1, 38.5, 1.5), (-37.3, 32.9, 0), (-37.4, 20.0, 0),
                    (-37.3, -17.7, 0), (-36.2, -26.9, 0), (37.5, -31.9, 0),
                    (31.2, -39.1, 0), (39.8, 25.3, 0), (43.3, 35.3, 0)):
        place('Alder tree', x, z, height=y)
    for x, z in ((-39.2, 14.9), (-39.15, 18.4), (-39.1, 23.9), (-39.15, 34.8),
                 (-39.15, -22.2), (-39.1, -28.8), (-39.2, -34.5), (-37.6, -39.4)):
        place('Young alder', x, z)
    place_group(board, 'Riverbank sedges', landscape.river_sedge(), (
        (-40.5, -32.0, 1, -0.31), (-40.3, -25.5, 1, -0.31), (-40.5, -14.4, 1, -0.31),
        (-40.6, -6.8, 1, -0.31), (-40.4, 14.1, 1, -0.31), (-40.5, 17.9, 1, -0.31),
        (-40.3, 20.9, 1, -0.31), (-40.6, 33.5, 1, -0.31), (-40.5, 41.2, 1, -0.31)),
        detail='#6e8b4b', trim='#b9aa6c')
    a('Fern rise', stone_shelf(12, low=True), 34.2, 30.5, 1)
    place('Fern rise', -28.6, 34.0, 1)
    place('Fern rise', 39, 34.1, 3)
    colors('Fern rise', detail='#7d8b50', skin='#858b78', secondary='#746f61')
    a('North alder crag', stone_shelf(27), 42.4, 38.85)
    place('North alder crag', -25.75, 43.75, 1)
    colors('North alder crag', detail='#839452', skin='#93917c', secondary='#736d65')
    a('River market slope', stone_shelf(47, low=True), -31.8, -28.3, 3)
    colors('River market slope', detail='#6c7d47', skin='#909581', secondary='#6f705f')
    for x, z, _, y in ((43.2, 39.8, 0, 9.8), (-24.85, 43.15, 0, 9.8),
                       (34.8, 29.9, 0, 6.2), (39.8, 33.5, 0, 6.2),
                       (-28.0, 33.4, 0, 6.2), (-32.4, -27.7, 0, 6.2)):
        place('Alder tree', x, z, height=y)
    a('Rampart bronze alder', landscape.woodland_tree(71, 49, 314), -9.2, 13.5)
    place('Rampart bronze alder', -35.8, 35.7)
    place('Rampart bronze alder', 30.1, 34.9)
    a('Square orchard tree', landscape.woodland_tree(62, 46, 215), 4.25, 4.35)
    colors('Square orchard tree', detail='#9ca85a', leather='#6e5a3d')
    place('Berry hedge', -8.4, 13.5)
    place('Berry hedge', 4.25, 4.35, 1)
    place('Shopfront flower trough', -5.6, 17.15, 1)
    place('Shopfront flower trough', 7.55, 19.5)
    colors('Rampart bronze alder', detail='#bc9953', leather='#6a5a3c')
    place_group(board, 'Riverside flowering rock', shrubs(121, berries=True), (
        (-29.5, -29.2, 1, 1.4), (34.7, 28.0, 1, 1.4), (37.7, 37.4, 1, 1.4),
        (-30.2, 42.3, 1, 1.4), (-24.9, 34.4, 1)), detail='#7c8b58', primary='#aa6963')


def keep_dressing(board):
    a, place, colors = board.add, board.place, board.set_palette
    a('Raised ward plinth', upper_ward_foundation(), 0, 39.55)
    colors('Raised ward plinth', skin='#a4a48e', trim='#c5c194')
    a('Broad court approach stair', stone_stair(38, 60, 32), 0, 31.0, height=-0.1)
    colors('Broad court approach stair', skin='#a5a595', trim='#c8c4a2')
    a('High ward tower', town.watchtower(), -10.3, 41, height=0)
    place('High ward tower', 10.5, 42.0)
    a('Ward tower cap', town.pitched_roof(53, 55, 46), -10.3, 41, height=8.1)
    place('Ward tower cap', 10.5, 42.0, height=8.1)
    place('Ward tower cap', -21.5, 22.65, height=8.1)
    place('Ward tower cap', 22, 22.65, height=8.1)
    colors('Ward tower cap', primary='#697f78', secondary='#3f6564', leather='#9b855f')
    place_group(board, 'Roof pennant staff', roof_streamer(), ((-10.1, 41, 0, 12.98),
                (10.7, 42, 0, 12.98), (-21.3, 22.65, 0, 12.98),
                (22.2, 22.65, 0, 12.98)), primary='#aa5244', trim='#d3b37c')
    a('Courtyard standards', cloth_line(59, 35, seed=5), -8.3, 26.2, 1)
    place('Courtyard standards', 9.2, 26.0, 1)
    colors('Courtyard standards', primary='#913e43', detail='#a9884c', visor='#698797', trim='#d2ae72')
    a('Gate iron sconces', sconces(), -3.6, 20.6, 0, 1.8)
    place('Gate iron sconces', 3.6, 20.6, 0, 1.8)
    a('Ward record desk', ward_register(), -3.78, 29.6)
    colors('Ward record desk', trim='#eee3b7', leather='#a57644', primary='#754744')
    a('Ward notice post', ward_notice_post(), -6.65, 32.0)
    colors('Ward notice post', primary='#924c49', trim='#e5c685', leather='#886446')
    place('Wagon with market cargo', 4.6, 30.65)
    place('Rye and flour sacks', 5.4, 32.45, 1)
    place('Wine barrels', -5.64, 32.5)
    place('Shopfront flower trough', 5.35, 33.45, 1)
    hall_start = len(board.placements), len(board.fixtures)
    a('Hall flame sconces', sconces(), -6.25, 38, 3, 2.32)
    place('Hall flame sconces', -6.25, 41.8, 3, 2.32)
    place('Hall flame sconces', 6.25, 38, 1, 2.32)
    place('Hall flame sconces', 6.25, 41.8, 1, 2.32)
    for x, z in ((-5.82, 38), (-5.82, 42), (5.82, 38), (5.82, 42)):
        board.light(x, 3.32, z, '#fdd9aa', 940, 8)
    a('Banquet plates and cups', tabletop(), -3.2, 39.8, 0, 1.1)
    place('Banquet plates and cups', 3.2, 39.8, 2, 1.1)
    a('Court wall hangings', town.banner(24, 32), -6.38, 38.0, 3, 1.45)
    for x, z, yaw in ((6.38, 38.0, 1), (-6.38, 42.1, 3), (6.38, 42.1, 1)):
        place('Court wall hangings', x, z, yaw, 1.45)
    colors('Court wall hangings', primary='#97483f', trim='#dfb67a')
    a('Hall firewood rack', storage_loft(19, 10), -5.2, 43.1)
    place('Rye and flour sacks', -5.3, 43.3, height=3.25)
    place('Wine barrels', -5.1, 42.7)
    place('Wine barrels', 5.3, 43.2)
    board.light(0.12, 2.5, 36.7, '#e9e3c4', 790, 7)
    lift_group(board, *hall_start, HALL_HEIGHT)
    for x, z in ((-8.4, 35.2), (-13.4, 28.1), (15.3, 35.1), (9.6, 37.8)):
        place('Shopfront flower trough', x, z)


def fabric_display():
    shape = Sculpt()
    for x in (-10, 10):
        box(3, 22, 3, DARK, x=x, sculpt=shape)
    for y in (5, 13, 21):
        box(23, 2, 4, WOOD, y=y, sculpt=shape)
    for x, z, h, width, ink in ((-6, -1, 12, 6, BODY), (0, 1, 10, 5, MARK),
                                (6, -1, 9, 5, GLASS), (-1, -2, 6, 11, GREEN)):
        top = 21 if h > 6 else 12
        box(width, h, 2, ink, x=x, z=z, y=top-h, sculpt=shape)
        box(width, 1, 1, MARK, x=x, z=z-1, y=top-h+2, sculpt=shape)
    return shape


def pots_on_display():
    shape = town.workbench(21, 10)
    for x, z, h, w, tint in ((-6, -1, 6, 6, BODY), (0, 3, 7, 6, GLASS), (5, -1, 5, 5, MARK)):
        box(w - 2, h, w - 1, tint, x=x, z=z, y=11, sculpt=shape)
        box(w, h - 3, w, tint, x=x, z=z, y=12, sculpt=shape)
        box(w, 1, w, WOOD, x=x, z=z, y=11+h, sculpt=shape)
        shape.cut(span(w-2, x), (10+h, 11+h), span(w-2, z))
    return shape


def lane_overhang(width, depth):
    shape = Sculpt()
    for x in (-width//2 + 2, width//2 - 2):
        for z in (-depth//2 + 2, depth//2 - 2):
            box(3, 34, 3, DARK, x=x, z=z, sculpt=shape)
    for x in range(-width//2, width//2, 5):
        color = BODY if x % 2 else MARK
        for z in range(-depth//2, depth//2, 4):
            y = 31 + (z + depth//2) // 6
            box(5, 2, 4, color, x=x, z=z, y=y, sculpt=shape)
        box(5, 4, 1, color, x=x, z=-depth//2-1, y=28, sculpt=shape)
    return shape


def market_lane(board):
    """Build a trading space along both edges of the cart road."""
    a, place, palette = board.add, board.place, board.set_palette
    a('Dyers cloth rack', fabric_display(), 6.25, -19.6, 1)
    place('Dyers cloth rack', -6.35, -17.1, 3)
    place('Dyers cloth rack', 6.55, -6.1, 1)
    palette('Dyers cloth rack', primary='#aa4941', trim='#e4b970', visor='#468486', detail='#81974f')
    a('Pottery counter', pots_on_display(), 2.85, -17.4, 3)
    place('Pottery counter', -3.65, -16.45, 1)
    palette('Pottery counter', primary='#a85e46', trim='#e3bb7d', visor='#5b8989')
    a('Market awning over pottery', lane_overhang(33, 22), 6.25, -19.5, 1)
    place('Market awning over pottery', -5.5, -18.75, 3)
    place('Market awning over pottery', 4.3, -4.65, 1)
    palette('Market awning over pottery', primary='#8e3b3f', trim='#c89e6c')
    place('Rye and flour sacks', 3.35, -20.1, 1)
    place('Rye and flour sacks', -4.25, -17.9, 1)
    place('Wine barrels', 2.35, -14.1)
    place('Wine barrels', -2.15, -19.05)
    place('Dyers cloth rack', -3.45, -0.5, 3)
    place('Pottery counter', 2.25, -7.85, 1)
    place('Shopfront flower trough', -4.0, -13.95, 3)
    place('Shopfront flower trough', 2.2, -10.65)
    place('Wagon with market cargo', 3.75, -9.3, 2)
    a('Fair golden maple', landscape.woodland_tree(59, 45, 455), -4.35, 0.4)
    palette('Fair golden maple', detail='#bf9f4f', leather='#705339')
    place('Fair golden maple', 8.7, -2.9, 3)
    place('Berry hedge', -5.6, 0.16, 3)
    place('Berry hedge', 8.8, -5.9, 2)
    place('Pottery counter', 10.25, -5.25)
    place('Market grain crate', 13.28, -.05)
    place('Rye and flour sacks', -3.72, -5.5, 1)
