"""Northern orchards, the canal exchange, and the outer harbor of Estuary Front."""

from creature_kit import Sculpt
from level_geometry import box
from level_vehicles import parked_wheel
from .common import BODY, DARK, GLASS, GLOW, GREEN, JOINT, MARK, METAL, STONE, WOOD, action
from .estuary_village import rutted_lane


def apple_tree():
    shape = box(4, 23, 4, WOOD)
    for x, z, h in ((-8, -2, 21), (7, 3, 23), (-2, 6, 28), (3, -6, 30)):
        box(10, 3, 3, WOOD, x=x // 2, y=h - 4, z=z, sculpt=shape)
        box(13, 6, 12, BODY, x=x, y=h, z=z, sculpt=shape)
        box(10, 4, 11, GREEN, x=x - 1, y=h + 6, z=z, sculpt=shape)
        box(2, 2, 2, MARK, x=x - 5, y=h + 1, z=z + 6, sculpt=shape)
        box(2, 2, 2, MARK, x=x + 6, y=h + 2, z=z + 2, sculpt=shape)
    return shape


def press_house():
    shape = box(56, 6, 37, STONE)
    box(54, 25, 3, BODY, z=-16, y=6, sculpt=shape)
    for x in (-24, 24):
        box(3, 25, 32, BODY, x=x, y=6, sculpt=shape)
        box(4, 28, 4, WOOD, x=x, y=6, z=15, sculpt=shape)
    # The screw and press bed face the orchard lane.
    for x in (-7, 7):
        box(3, 21, 5, DARK, x=x, y=6, z=8, sculpt=shape)
    box(20, 3, 7, WOOD, y=25, z=8, sculpt=shape)
    box(3, 15, 3, METAL, y=13, z=8, sculpt=shape)
    box(13, 3, 11, WOOD, y=12, z=8, sculpt=shape)
    box(16, 5, 13, WOOD, y=6, z=8, sculpt=shape)
    for z in range(-21, 22, 3):
        h = (21 - abs(z)) // 2
        box(61, 3, 3, BODY if z % 2 == 0 else DARK, y=32 + h, z=z, sculpt=shape)
    box(62, 2, 3, WOOD, y=42, sculpt=shape)
    return shape


def cooperative_counter():
    shape = box(31, 3, 16, JOINT)
    box(27, 10, 13, BODY, y=3, sculpt=shape)
    box(31, 2, 17, WOOD, y=13, sculpt=shape)
    for x in (-13, 13):
        box(2, 25, 2, DARK, x=x, y=3, z=-5, sculpt=shape)
        box(1, 12, 1, WOOD, x=x, y=14, z=8, sculpt=shape)
    for x in range(-16, 17, 4):
        for z in range(-8, 12, 4):
            box(4, 2, 4, MARK if x % 8 else BODY, x=x, y=28 - (z + 8) // 8, z=z, sculpt=shape)
        box(4, 4, 2, MARK if x % 8 else BODY, x=x, y=23, z=11, sculpt=shape)
    for x in (-8, 6):
        box(10, 2, 7, WOOD, x=x, y=15, sculpt=shape)
        for dx in (-3, 0, 3):
            for z in (-2, 1):
                box(2, 2 + (dx == 0), 2, GREEN if z < 0 else MARK, x=x + dx, y=17, z=z, sculpt=shape)
    for x in (-10, 4):
        box(5, 4, 1, DARK, x=x, y=13, z=9, sculpt=shape)
        box(3, 1, 1, MARK, x=x, y=15, z=10, sculpt=shape)
    return shape


def weighing_office():
    shape = box(56, 5, 36, JOINT)
    box(54, 30, 34, BODY, y=5, sculpt=shape)
    for x in (-21, -8, 7):
        box(12, 16, 2, MARK, x=x, y=15, z=17, sculpt=shape)
        box(8, 12, 1, GLASS, x=x, y=17, z=18, sculpt=shape)
        box(1, 12, 1, WOOD, x=x, y=17, z=19, sculpt=shape)
    box(11, 22, 2, WOOD, x=21, y=5, z=17, sculpt=shape)
    box(7, 8, 2, GLASS, x=21, y=16, z=18, sculpt=shape)
    box(61, 3, 40, DARK, y=34, sculpt=shape)
    box(44, 8, 9, MARK, x=-5, y=37, sculpt=shape)
    for x in range(-23, 17, 6):
        box(4, 4, 1, GLASS, x=x, y=39, z=5, sculpt=shape)
    box(47, 2, 13, DARK, x=-5, y=45, sculpt=shape)
    return shape


def lock_headstock():
    shape = Sculpt()
    for x in (-16, 16):
        box(7, 5, 10, STONE, x=x, sculpt=shape)
        box(4, 25, 6, BODY, x=x, y=5, sculpt=shape)
        box(4, 4, 7, METAL, x=x, y=18, sculpt=shape)
    box(39, 4, 8, BODY, y=28, sculpt=shape)
    for y in (3, 6, 9):
        box(30, 3, 3, WOOD, y=y, z=1, sculpt=shape)
    box(2, 26, 2, METAL, y=6, sculpt=shape)
    box(6, 3, 6, DARK, y=32, sculpt=shape)
    for x in (-5, 5):
        box(2, 8, 2, WOOD, x=x, y=32, z=3, sculpt=shape)
    for y in (32, 39):
        box(12, 2, 2, WOOD, y=y, z=3, sculpt=shape)
    return shape


def net_loft():
    shape = Sculpt()
    for x in (-22, 22):
        for z in (-15, 15):
            box(4, 15, 4, WOOD, x=x, z=z, sculpt=shape)
    box(54, 3, 40, WOOD, y=13, sculpt=shape)
    box(47, 24, 32, BODY, y=16, sculpt=shape)
    shape.cut((-13, 11), (16, 34), (5, 20))
    for x in (-22, 21):
        box(2, 23, 34, WOOD, x=x, y=16, sculpt=shape)
    for y in range(18, 40, 5):
        for x in (-18, 17):
            box(8, 1, 2, MARK, x=x, y=y, z=16, sculpt=shape)
    for z in range(-20, 22, 3):
        rise = (20 - abs(z)) // 2
        box(54, 3, 3, DARK, y=40 + rise, z=z, sculpt=shape)
    for x in range(-15, 19, 3):
        box(1, 10, 1, MARK, x=x, y=18 + abs(x) // 4, z=19, sculpt=shape)
    for y in (21, 25, 29):
        for x in range(-15, 16, 5):
            box(5, 1, 1, WOOD, x=x, y=y + abs(x) // 4, z=19, sculpt=shape)
    return shape


def beacon_tower():
    shape = Sculpt()
    for y in range(0, 88, 4):
        radius = 18 - y // 10
        face = MARK if y < 28 or y >= 56 else BODY
        for inset, width in ((0, radius), (radius // 2, radius * 2)):
            box(width, 4, 2 * radius - inset, face, y=y, sculpt=shape)
            box(2 * radius - inset, 4, width, face, y=y, sculpt=shape)
    box(18, 25, 3, STONE, y=1, z=16, sculpt=shape)
    box(11, 22, 3, WOOD, y=2, z=18, sculpt=shape)
    box(7, 6, 1, GLASS, y=15, z=20, sculpt=shape)
    box(17, 3, 5, DARK, y=24, z=17, sculpt=shape)
    box(17, 2, 7, JOINT, z=18, sculpt=shape)
    for y in (36, 64):
        half = 18 - y // 10
        box(6, 9, 3, DARK, y=y, z=half, sculpt=shape)
        box(4, 6, 1, GLASS, y=y + 2, z=half + 1, sculpt=shape)
    box(30, 3, 30, DARK, y=88, sculpt=shape)
    for x in (-13, 0, 13):
        for z in (-13, 13):
            box(1, 7, 1, METAL, x=x, y=91, z=z, sculpt=shape)
    for z in (-13, 13):
        box(28, 1, 1, METAL, y=97, z=z, sculpt=shape)
    for x in (-13, 13):
        box(1, 1, 27, METAL, x=x, y=97, sculpt=shape)
    box(15, 3, 15, BODY, y=91, sculpt=shape)
    box(7, 8, 7, GLOW, y=94, sculpt=shape)
    for x in (-7, 7):
        for z in (-7, 7):
            box(2, 10, 2, DARK, x=x, y=94, z=z, sculpt=shape)
    for i in range(5):
        box(21 - i * 4, 2, 21 - i * 4, DARK, y=104 + i * 2, sculpt=shape)
    return shape


def transfer_tank():
    shape = box(29, 3, 29, STONE)
    for y in range(3, 32):
        radius = 12 if 5 <= y <= 29 else 10
        material = METAL if y in (8, 24) else BODY
        box(radius * 2, 1, radius + 6, material, y=y, sculpt=shape)
        box(radius + 6, 1, radius * 2, material, y=y, sculpt=shape)
    box(9, 3, 9, METAL, y=32, sculpt=shape)
    for x in (-2, 2):
        box(1, 29, 1, WOOD, x=x, y=4, z=13, sculpt=shape)
    for y in range(6, 32, 4):
        box(5, 1, 1, METAL, y=y, z=13, sculpt=shape)
    box(4, 4, 9, DARK, x=6, y=5, z=14, sculpt=shape)
    return shape


def mooring_skiff():
    shape = Sculpt()
    for z in range(-17, 19, 2):
        width = max(4, 13 - max(0, abs(z) - 7))
        box(width - 2, 2, 2, DARK, y=0, z=z, sculpt=shape)
        box(width, 2, 2, BODY, y=2, z=z, sculpt=shape)
        for x in (-width // 2, width // 2):
            box(1, 3, 2, MARK, x=x, y=4, z=z, sculpt=shape)
    for z in (-7, 4, 11):
        box(10, 1, 2, WOOD, y=5, z=z, sculpt=shape)
    return shape


def orchard_cart():
    shape = box(16, 2, 23, WOOD, y=6)
    for x in (-8, 8):
        shape.ops.extend(parked_wheel((x, 5, -4), 5, wagon=True, bevel=True, hub=True).ops)
        box(2, 4, 22, BODY, x=x, y=8, sculpt=shape)
        box(2, 2, 14, WOOD, x=x, y=6, z=14, sculpt=shape)
    for z in (-8, 2):
        box(10, 4, 7, MARK, y=8, z=z, sculpt=shape)
        box(7, 2, 5, MARK, y=12, z=z, sculpt=shape)
    box(3, 6, 3, DARK, y=0, z=7, sculpt=shape)
    return shape


def rescue_station():
    shape = box(20, 2, 7, STONE)
    for x in (-7, 7):
        box(2, 25, 3, WOOD, x=x, y=2, sculpt=shape)
    box(19, 12, 2, BODY, y=14, sculpt=shape)
    for x in (-5, 5):
        box(3, 7, 2, MARK, x=x, y=15, z=2, sculpt=shape)
    for y in (13, 22):
        box(9, 3, 2, MARK, y=y, z=2, sculpt=shape)
        box(3, 3, 2, STONE, y=y, z=2, sculpt=shape)
    box(21, 2, 6, DARK, y=27, sculpt=shape)
    return shape


def extend_ground(board):
    east_lane = rutted_lane()
    east_lane.ops = [(z, y, x, color, filled) for x, y, z, color, filled in east_lane.ops]
    board.add('Coastal cart road', east_lane, -36, 44, height=-0.3)
    board.set_palette('Coastal cart road', leather='#8a7459', skin='#786851', secondary='#86785c', detail='#7c8050')
    for x in range(-36, 45, 8):
        for z in range(36, 101, 8):
            if (x, z) == (-36, 44):
                continue
            if x == 12 or x >= 36:
                label = 'Harbor wake tile' if (x + z) % 16 == 0 else 'Estuary water tile'
                board.place(label, x, z, height=-0.95)
            elif x in (-12, 20) and z in (44, 68, 84):
                board.place('Crossing wheel ruts', x, z, height=-0.3)
            elif x in (-12, 20) or z in (44, 68, 84):
                label = 'Rutted supply lane' if x in (-12, 20) else 'Coastal cart road'
                board.place(label, x, z, height=-0.3)
            else:
                farm = x < -12 and z <= 68 or -12 <= x < 8 and z >= 84
                board.place('Scuffed grass' if farm else 'Meadow sod', x, z, height=-0.3)
    for z in range(36, 101, 8):
        board.place('Tidal channel bank', 8.3, z, height=-0.9)
        board.place('Tidal channel bank', 15.7, z, 2, -0.9)
        board.place('Riveted tidal quay', 31.85, z, height=-1.5)
    for x, z in ((8.8, 37), (9, 48), (14.8, 54), (9.1, 60), (15, 79),
                 (8.9, 88), (14.8, 94), (9, 99), (33, 40), (32.8, 82), (33, 98)):
        board.place('Salt marsh rushes', x, z, 1, -0.67)


def furnish_orchard(board):
    a, p = board.add, board.place
    a('Orchard cider press', press_house(), -11.3, 50.1, 2)
    board.set_palette('Orchard cider press', primary='#916748', secondary='#625e50',
                      leather='#a18057', skin='#ab9980', metal='#777d72')
    a('Bramley orchard tree', apple_tree(), -35.5, 37)
    for row, x in enumerate((-36, -31, -20.6, -16.3)):
        for column, z in enumerate((37, 42, 48, 54, 59)):
            if row == column == 0:
                continue
            p('Bramley orchard tree', x + (column % 2) * 0.6, z + (row % 2) * 0.7,
              (row + column) % 4)
    board.set_palette('Bramley orchard tree', primary='#5e7547', detail='#81944d',
                      leather='#806348', trim='#b96e46')
    for x, z, turn in ((-38.5, 39, 1), (-38.5, 45, 1), (-38.5, 51, 1), (-37, 61.6, 0),
                       (-31, 61.6, 0), (-19, 61.6, 0), (-15.1, 58.3, 1)):
        p('Wooden hedgerow fence', x, z, turn)
    p('Rail wheelwright shed', -32.2, 65.5, 1)
    p('Orchard timber lodge', -6.2, 39.2, 1)
    p('Loading dock storage', -12.1, 54.2)
    p('Loading dock storage', -9, 50.3, 3)
    p('Village signal signpost', -14.2, 44, 1)
    for x, z, turn in ((-36.5, 77, 1), (-33, 77.6, 0), (-2.1, 52.6, 1),
                       (3.3, 47.4, 2), (3.8, 59, 0), (-38, 94, 0), (-36, 98, 1)):
        p('Wind-shaped field tree', x, z, turn)
    for x, z in ((-37, 86), (-36, 90), (-30, 100), (-25, 98), (-21, 100),
                 (-13, 95), (-9, 98), (3.8, 96), (4.3, 91)):
        p('Drainage ditch poplar', x, z, 1)
    a('Market produce counter', cooperative_counter(), -22.4, 69.7, 2)
    board.set_palette('Market produce counter', primary='#98624c', trim='#d6bf88',
                      leather='#94714f', detail='#939e59', secondary='#685947')
    a('Canvas seed stall', cooperative_counter(), -28.7, 69.4, 2)
    board.set_palette('Canvas seed stall', primary='#587a74', trim='#d0bd90',
                      leather='#987953', detail='#ac8052', secondary='#4e5c54')
    p('Canvas seed stall', -26.4, 75.4, 1)
    a('Orchard sack cart', orchard_cart(), -25.4, 70.5, 1)
    board.set_palette('Orchard sack cart', primary='#79815b', trim='#b9a476', leather='#8c704f')
    p('Orchard sack cart', -13, 54.8, 3)
    p('Orchard sack cart', -10.4, 87.7, 2)
    p('Orchard timber lodge', -31.8, 74.8)
    p('Clay cottage roof', -20.4, 79, height=3.15)
    p('Twin stone cottage wall', -20.4, 76.6, 2)
    p('Cottage return stone', -23.4, 79, 1)
    p('Cottage return stone', -17.4, 79, 3)
    p('Cottage return stone', -20.4, 81.5, 2)
    p('Loading dock storage', -24.8, 72.1)
    p('Village signal signpost', -20, 65.5, 1)
    a('Canal weighing office', weighing_office(), -6.5, 87.8, 2)
    board.set_palette('Canal weighing office', primary='#a46b54', trim='#d0b48a', leather='#6e5b4b',
                      visor='#7e9996', secondary='#4b5b5a')
    p('Depot booking hall', -2.1, 90.4, 1)
    p('Rail shed roof frame', -2.2, 90.3, 1)
    p('Loading dock storage', -1.6, 85.6, 1)
    p('Rail wheelwright shed', -27.6, 90.4, 1)
    p('Stacked ration cases', -28.1, 85.5)
    p('Rail yard signal', -8.7, 82.5)
    for x in (-34, -26, -18, -10, -2):
        p('Rail ballast and ties', x, 82, 1, -0.18)
    p('Rail stop block', 1.8, 82, 1)
    p('Rail depot loading platform', -5.8, 83.8)
    p('Market produce counter', -26.5, 93.9, 1)
    p('Orchard timber lodge', -33.1, 90.6, 2)
    for x, z, turn in ((-2.7, 101, 0), (5, 101, 0), (-37, 99.5, 0), (4.3, 37.8, 1),
                       (3.9, 44, 1), (-38, 67.8, 1), (-38, 74, 1)):
        p('Airfield perimeter hedge', x, z, turn)


def furnish_harbor(board):
    a, p = board.add, board.place
    a('Canal lock headstock', lock_headstock(), 6.3, 70.5, 1)
    board.set_palette('Canal lock headstock', primary='#62807b', leather='#9c7453',
                      secondary='#55615e', metal='#86938a', skin='#a69b86')
    p('Pontoon repair deck', 12, 68, height=-0.3)
    p('Riveted bridge girder', 12, 66.5, height=0.05)
    p('Riveted bridge girder', 12, 69.5, 2, 0.05)
    p('Mill tide staff', 15.1, 65.5, 3, -0.7)
    p('Canal weighing office', 3.1, 74, 2)
    p('Riveted tidal quay', 7.9, 72, height=-1.5)
    p('Riveted tidal quay', 7.9, 80, height=-1.5)
    p('Harbor timber pier', 10.4, 76.4, 1, -0.7)
    p('Loading dock storage', 10.1, 77.8, 1, 0.3)
    a('Coastal transfer tank', transfer_tank(), 28, 55.4)
    board.set_palette('Coastal transfer tank', primary='#82968b', metal='#aaa895',
                      secondary='#526665', leather='#716857', skin='#989287')
    for x, z in ((28, 59.4), (23.5, 55.1), (24, 64.5)):
        p('Coastal transfer tank', x, z)
    for x, z, turn in ((29.2, 62.5, 1), (27.6, 50.3, 0), (21.2, 51.5, 1)):
        p('Wooden hedgerow fence', x, z, turn)
    p('Fuel drum pallet', 29.2, 52.5)
    p('Hangar tool bench', 30.1, 64.5)
    p('Harbor cargo tackle', 30.9, 60.4, 1)
    p('Scattered airfield equipment', 30.5, 56.2)
    p('Rail wheelwright shed', 19.1, 48.3, 1)
    p('Riveted tidal quay', 15.8, 48, 2, -1.5)
    p('Village signal signpost', 20.5, 58.1, 2)
    a('Harbor net loft', net_loft(), 32.6, 72.8, 1, -0.65)
    board.set_palette('Harbor net loft', primary='#698685', trim='#c6b996', leather='#89765c',
                      secondary='#56635f')
    p('Harbor net loft', 34, 43, 1, -0.65)
    a('Mooring skiff', mooring_skiff(), 36.7, 72, height=-0.75)
    board.set_palette('Mooring skiff', primary='#7b5146', trim='#c9b790', leather='#866b4e')
    p('Mooring skiff', 36, 45.5, 2, -0.75)
    p('Mooring skiff', 38.5, 86, 1, -0.75)
    for z in (47, 59.6, 77, 89):
        p('Harbor timber pier', 35.9, z, height=-0.7)
        p('Pier cleat', 38.2, z + 0.8, height=0.3)
        p('Harbor bollard', 33.8, z + 1, height=0.3)
    for x, z in ((33.6, 46.4), (35.4, 59.1), (34.4, 77.3), (32.5, 88.7)):
        p('Loading dock storage', x, z, 1, 0.3)
    p('Crated cargo spool', 33.8, 58.7, height=0.3)
    p('Harbor cargo tackle', 32.4, 75.8)
    p('Warehouse shutter bay', 24.4, 74.7, 2)
    p('Corrugated shore warehouse', 24.4, 77.3, height=3.65)
    p('Warehouse wall return', 21.5, 77.3, 3)
    p('Warehouse wall return', 27.4, 77.3, 1)
    p('Warehouse wall return', 24.4, 79.8)
    a('Outer harbor beacon', beacon_tower(), 26.5, 93.6, 2)
    board.set_palette('Outer harbor beacon', primary='#a84f41', trim='#d3c4a6', leather='#685a49',
                      secondary='#4b5759', visor='#718f93', accent='#ffe0a0')
    a('Harbor rescue station', rescue_station(), 30.1, 90.4, 2)
    board.set_palette('Harbor rescue station', primary='#63807f', trim='#bb684b', skin='#cfbea1',
                      leather='#8e785c', secondary='#4f5c5b')
    p('Harbor rescue station', 29.9, 70.4, 3)
    p('Wooden hedgerow fence', 19.6, 89.8)
    p('Wooden hedgerow fence', 18.1, 95.2, 1)
    p('Orchard timber lodge', 20.2, 93, 1)
    p('Dock approach ramp', 31.2, 89)
    p('Coastal concrete block', 28.8, 101.5)
    p('Coastal concrete block', 31.2, 99.2, 1)
    p('Wind-shaped field tree', 22.6, 99.1, 1)
    for z in (37, 41.3, 83.4, 86.5):
        p('Drainage ditch poplar', 17.6, z, 1)
    for x, z in ((3.6, 74.2), (-6.3, 86.4), (26.7, 92.2), (31.4, 72.5)):
        board.light(x, 2.6, z, '#ffdca8', 18, 6)


def expand(board):
    extend_ground(board)
    furnish_orchard(board)
    furnish_harbor(board)
    # Fit the old mill with a sluice and a receiving shed.
    board.place('Canal lock headstock', 15.4, -9.9, 3, -0.4)
    board.place('Mill tide staff', 15.1, -10.5, 3, -0.7)
    board.place('Rail wheelwright shed', 22.7, -5.9, 3)
    board.place('Loading dock storage', 22.8, -6.4, 2)
    board.place('Mooring skiff', 13.8, -11.3, 1, -0.75)

    board.point('press', 'Orchard pressing yard', -11.5, 46, actions=(
        action('transfer', assets=(board.prop_id('Orchard cider press'), 'supply_crate'), reward='orchard_consignments'),))
    board.point('market', 'Produce cooperative', -22, 66.6, actions=(
        action('resupply', requires=('orchard_consignments',), assets=(board.prop_id('Market produce counter'), 'medical_pouch'),
               reward='market_receipt'),))
    board.point('weigh', 'Canal weigh office', -8.1, 85.6, actions=(
        action('transfer', requires=('market_receipt',), assets=(board.prop_id('Canal weighing office'), 'rail_signal_flag'),
               reward='freight_manifest'),))
    board.point('lock', 'Northern canal lock', 4.6, 65.5, actions=(
        action('repair', assets=(board.prop_id('Canal lock headstock'), 'repair_case'), reward='lock_service'),))
    board.point('fuel', 'Coastal transfer yard', 25.1, 59, actions=(
        action('resupply', assets=(board.prop_id('Coastal transfer tank'), 'fuel_can', 'depot_tool_roll'), reward='beacon_fuel'),))
    board.point('beacon', 'Outer harbor light', 26.6, 90.8, actions=(
        action('relay', requires=('beacon_fuel', 'freight_manifest'), assets=(board.prop_id('Outer harbor beacon'), 'range_card'),
               reward='channel_lit'),))

    board.link('village', 'press', [-25.2, 0, 18.4], [-25.2, 0, 32], [-25.2, 0, 43], [-12.8, 0, 43])
    board.link('press', 'market', [-12.3, 0, 47.2], [-14.65, 0, 47.5], [-14.65, 0, 64], [-20.4, 0, 64.7])
    board.link('market', 'weigh', [-18.3, 0, 66.5], [-12.2, 0, 69.8], [-12.2, 0, 85.6])
    board.link('weigh', 'lock', [-11, 0, 85.6], [-11, 0, 80], [0.4, 0, 72], [4.6, 0, 71.5])
    board.link('lock', 'press', [1.7, 0, 64], [-7.9, 0, 60.4], [-7.9, 0, 48], [-8.7, 0, 46])
    board.link('dugout', 'lock', [-1.55, 0, 17.4], [6.9, 0, 18], [7.9, 0, 20],
               [7.9, 0, 33], [6.3, 0, 54])
    board.link('lock', 'fuel', [5, 0, 68], [8, 0, 68], [16, 0, 68], [19.8, 0, 63.5],
               [20.6, 0, 61.3], [24.6, 0, 60], requires=('bridge_ready', 'lock_service'))
    board.link('fuel', 'beacon', [25.6, 0, 62.1], [28.9, 0, 68.4], [29.4, 0, 82], [28.8, 0, 88])
    board.link('battery', 'fuel', [27.2, 0, 11], [25.6, 0, 12], [23.6, 0, 15.8], [23.6, 0, 23.6], [26.5, 0, 24.4], [26.5, 0, 30.2],
               [22.8, 0, 31.8], [22.8, 0, 45], [22, 0, 53], [21.2, 0, 59.5])
    board.shot('Orchard exchange', [-24.5, 1.7, 62.1], [-26, 1.75, 69.8])
    board.shot('Outer harbor light', [30.6, 1.7, 78.6], [26.1, 5.1, 93.5])
