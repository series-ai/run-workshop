"""Alderwick, a walled market town and riverside castle."""

from random import Random

import build_level_props as lp
from level_geometry import box

from . import estuary_village as village
from . import medieval_buildings as town
from . import medieval_dressing as dressing
from . import medieval_landscape as landscape
from .common import (BODY, DARK, GLASS, GLOW, GREEN, JOINT, MARK, METAL, STONE, WOOD,
                     action, arch, color_profile, create_board, floors, glyph, slab)

BANNER = {'primary': '#823c3f', 'trim': '#e0b579'}
SLATE = {'primary': '#435860', 'secondary': '#34424d'}
TILE = {'primary': '#975b47', 'secondary': '#563e36'}


def road(seed, *, yard=False):
    rng = Random(seed)
    shape = box(80, 3, 80, JOINT)
    width = 12 if yard else 8
    for row, z in enumerate(range(-36, 39, 8)):
        for x in range(-40 + row % 2 * (width // 2), 40, width):
            start = max(-40, x)
            end = min(40, x + width - 1)
            if end <= start:
                continue
            color = rng.choices((STONE, MARK, DARK), weights=(82, 12, 6))[0]
            shape.box((start, end - 1), (2, 2), (z - 3, z + 3), color)
    return shape


def terrain(board):
    grid = [(x, z) for x in range(-44, 45, 8) for z in range(-44, 45, 8)]
    water = [(x, z) for x, z in grid if x == -44]
    stone = [(x, z) for x, z in grid if -12 <= x <= 12 and -20 <= z <= 20]
    upper = [(x, z) for x, z in grid if -20 <= x <= 20 and z >= 28]
    paths = [(x, z) for x, z in grid if (x in (-36, -4, 4, 28) or z in (-28, 4))
             and (x, z) not in water + stone + upper]
    grass = [p for p in grid if p not in water + stone + upper + paths]
    floors(board, 'River current', slab(80, 80, face=GLASS, joint=GREEN, seed=8), water, y=-0.64)
    floors(board, 'Market cobbles', road(16), stone)
    floors(board, 'Keep courtyard paving', road(42, yard=True), upper)
    floors(board, 'Rutted cart lane', village.rutted_lane(crossing=True), paths)
    for label, positions, seed in (('Low meadow', grass[::2], 11), ('Town green', grass[1::2], 28)):
        floors(board, label, village.grassland(seed), positions)
    board.surfaces[board.prop_id('River current')] = 'water'
    board.set_palette('River current', visor='#4e7e7d', detail='#67959a', skin='#3d6165')
    board.set_palette('Market cobbles', skin='#a29e91', trim='#b6aa93', secondary='#8b8477')
    board.set_palette('Keep courtyard paving', skin='#a2a8a2', trim='#bbb5a2', secondary='#878f87')
    board.set_palette('Rutted cart lane', skin='#9c846b', leather='#8e755d', detail='#697649')
    for z in range(-44, 45, 8):
        label = 'Riverbank retaining blocks'
        if z == -44:
            board.add(label, lp.panel(80, 6, 10, STONE, JOINT, rows=True), -39.7, z, 1, -0.51)
        else:
            board.place(label, -39.7, z, 1, -0.51)


def room_floor(width, depth, seed, *, stone=False):
    rng = Random(seed)
    shape = box(width, 1, depth, JOINT if stone else DARK)
    for row, x in enumerate(range(-width // 2 + 2, width // 2 - 2, 4)):
        for z in range(-depth // 2 + 6 + 3 * (row % 2), depth // 2 - 6, 12):
            color = rng.choices((STONE, MARK, DARK) if stone else (WOOD, BODY, MARK),
                                weights=(82, 12, 6))[0]
            box(3, 1, 11, color, x=x, z=z, sculpt=shape)
    return shape


def house(board, label, x, z, turn, dims, *, plaster, roof, door=26):
    width, depth, height, rise = dims
    board.add(label, town.timber_house(width, depth, height, door), x, z, turn)
    board.set_palette(label, trim=plaster)
    title = label + ' roof'
    board.add(title, town.pitched_roof(width + 8, depth + 10, rise), x, z, turn, (height - 1) / 10)
    board.set_palette(title, **roof)


def lantern():
    shape = box(7, 1, 7, METAL)
    box(5, 6, 5, GLOW, y=1, sculpt=shape)
    for x in (-2, 2):
        for z in (-2, 2):
            box(1, 6, 1, DARK, x=x, y=1, z=z, sculpt=shape)
    box(8, 2, 8, DARK, y=7, sculpt=shape)
    box(4, 2, 4, METAL, y=9, sculpt=shape)
    return shape


def sign(emblem):
    shape = box(2, 11, 2, METAL)
    box(18, 2, 2, DARK, y=11, sculpt=shape)
    box(14, 9, 2, BODY, sculpt=shape)
    return glyph(shape, emblem, -3, 2, -2, MARK)


def smith_anvil():
    shape = box(9, 6, 8, WOOD)
    box(10, 1, 8, DARK, y=6, sculpt=shape)
    box(6, 3, 5, METAL, y=7, sculpt=shape)
    box(10, 2, 6, METAL, y=10, sculpt=shape)
    for x, depth in ((6, 4), (8, 2)):
        box(3, 1, depth, METAL, x=x, y=10, sculpt=shape)
    return shape


def streets(board):
    a, place, palette = board.add, board.place, board.set_palette
    house(board, 'Alder inn', -19, -20, 3, (91, 101, 64, 31), plaster='#c8a174', roof=TILE)
    house(board, 'Blacksmith shop', 20, -12, 1, (87, 119, 43, 23), plaster='#ba9d7d', roof=SLATE, door=39)
    house(board, 'Apothecary shop', -13, 3, 3, (77, 98, 47, 30), plaster='#d0c9a8', roof=SLATE, door=31)
    house(board, 'Steward lodge', 10.8, 12.3, 0, (63, 86, 47, 27), plaster='#dbc3a4', roof=TILE)
    house(board, 'Riverside granary', -32, 5, 3, (92, 99, 67, 28), plaster='#bb9f76', roof=TILE, door=30)
    house(board, 'Weaver cottage', 24, -25, 0, (61, 67, 46, 22), plaster='#ba9b8b', roof=TILE)
    house(board, 'Carters cottage', -12, -33, 3, (65, 67, 39, 23), plaster='#d9c4a3', roof=SLATE)
    house(board, 'Carved gable dwelling', 11, -31, 1, (69, 76, 73, 30), plaster='#dbc8a2', roof=TILE)
    house(board, 'Greengrocer cottage', 22, 3, 1, (69, 80, 68, 26), plaster='#bec8a7', roof=SLATE)
    house(board, 'Riverside cottage', -33, -11, 3, (72, 82, 47, 23), plaster='#cfb3a2', roof=TILE)
    house(board, 'Fuller workshop', -28, 23, 3, (68, 85, 41, 24), plaster='#b0bac0', roof=SLATE)
    house(board, 'East granary', 32, 23, 1, (80, 72, 47, 20), plaster='#d7c19c', roof=TILE)
    for x, z, turn in ((-22, -36, 0), (-20, -1, 0), (31, -7, 1), (38, 9, 1), (-34, 32, 0)):
        place('Carters cottage', x, z, turn)
        place('Carters cottage roof', x, z, turn, 3.8)

    a('Inn plank floor', room_floor(86, 96, 42), -19, -20, 3, -0.06)
    palette('Inn plank floor', leather='#87694e', primary='#735442', trim='#987b58')
    a('Blacksmith floor slabs', room_floor(82, 114, 13, stone=True), 20, -12, 1, -0.06)
    palette('Blacksmith floor slabs', skin='#766958', trim='#837060')
    a('Apothecary plank floor', room_floor(72, 93, 14), -13, 3, 3, -0.06)
    palette('Apothecary plank floor', leather='#92745a', primary='#7a5b4a', trim='#aa8d72')
    a('Alder inn sign', sign(('.###.', '##.##', '#####', '.###.')), -13.8, -21.8, 3, 2.36)
    palette('Alder inn sign', primary='#793c38', trim='#e4ba72')
    a('Smith tongs sign', sign(('#...#', '.#.#.', '..#..', '..#..')), 13.8, -10.1, 1, 2.42)
    palette('Smith tongs sign', primary='#454e55', trim='#ebe0c8')
    a('Apothecary sprig sign', sign(('..#..', '.###.', '#####', '..#..')), -7.7, 4.7, 3, 2.38)
    palette('Apothecary sprig sign', primary='#49705d', trim='#e0ce88')

    a('Market fruit stall', town.market_stall(37), -5.6, -15.1, 3)
    place('Market fruit stall', 5.8, -7.8, 1)
    palette('Market fruit stall', primary='#9d4541', trim='#e4bc79', detail='#7c9344')
    a('Covered market grain stall', town.market_stall(32), 5.4, -16.4, 1)
    place('Covered market grain stall', -6.1, -7.4, 3)
    palette('Covered market grain stall', primary='#597b77', trim='#ddd0aa', detail='#a89050')
    a('Market linen stall', town.market_stall(30), 5.6, -2.6, 1)
    palette('Market linen stall', primary='#856374', trim='#dbcbac', detail='#6e8b64')
    a('Market draw well', lp.well(), -3.5, -3.3)
    a('Market grain crate', lp.crate(12, 10, 10, WOOD, DARK), 7.1, -18)
    for x, z in ((-7, -17), (-7.9, -14.4), (7.8, -6.5), (-27.3, 2.7), (-28.7, 3.8), (9.4, 19.3)):
        place('Market grain crate', x, z)
    a('Lunch benches', town.workbench(23, 6), -9.1, -22.5)
    for x, z in ((-16.7, -22.6), (3.1, -2.4), (8.8, 11.8), (-12, 14.7)):
        place('Lunch benches', x, z)
    a('Inn common table', town.workbench(29, 14), -18.7, -21.8)
    place('Inn common table', -18.7, -18.2)
    a('Inn window lantern', lantern(), -15.2, -21.7, height=2.15)
    for x, y, z in ((-15.1, 2.15, -18.6), (17.3, 2.25, -9.6), (-10.1, 2.32, 5.4),
                    (9.6, 2.30, 9.5), (-7.8, 2.25, 1.4), (4.1, 2.45, 20.2)):
        place('Inn window lantern', x, z, height=y)
        board.light(x, y - 0.14, z, '#ffd695', 23, 9)

    a('Smithy hearth', town.smith_hearth(), 23.5, -12, 1)
    palette('Smithy hearth', accent='#ff9038', skin='#746457')
    board.light(22.0, 1.32, -12, '#ff9d55', 1600, 9)
    board.light(19.8, 2.75, -10.9, '#ffe1b7', 1940, 7)
    board.light(17.4, 2.8, -13.1, '#c3d2d3', 650, 6)
    a('Smith bench and tools', town.workbench(29, 13, tools=True), 20.7, -8.9, 1)
    a('Blacksmith anvil', smith_anvil(), 20.2, -10.1, 1)
    a('Water quench trough', lp.crate(16, 6, 13, GLASS, WOOD), 20.9, -15.1, 1)
    palette('Water quench trough', visor='#6d9695')
    a('Iron stock and fittings', lp.crate(13, 8, 9, METAL, WOOD), 21.1, -13.8)
    a('Charcoal storage bin', lp.crate(18, 13, 15, DARK, WOOD), 23.7, -14.5)
    a('Apothecary bottles', town.apothecary_shelf(), -14.8, 3, 3)
    board.light(-11.2, 2.8, 3.3, '#ffe7bd', 1770, 7)
    board.light(-14.1, 2.6, 4.1, '#e6cb9f', 810, 6)
    board.light(-17.4, 2.75, -19.4, '#ffdfad', 1300, 7)
    place('Apothecary bottles', -14.0, 5.7, 2)
    place('Apothecary bottles', -11.7, 5.9, 2)
    palette('Apothecary bottles', visor='#72b1ae', detail='#87a25e', primary='#b97365')
    a('Apothecary mixing table', town.workbench(24, 14, tools=True), -11.4, 1.05, 2)
    a('Herb and flower bed', town.produce_bed(24, 32, 8, flowers=True), -19, 11)
    place('Herb and flower bed', -19, 15)
    palette('Herb and flower bed', detail='#739955', primary='#ac786e', trim='#d5bf82')
    a('Leaf herb bed', town.produce_bed(25, 34, 17), -12.8, 11)
    place('Leaf herb bed', -12.8, 15)
    a('Garden drying table', town.workbench(26, 11), -16.1, 16.8)
    a('Village kitchen garden', town.produce_bed(30, 39, 13, flowers=True), 10, -24)
    for x, z in ((15, -23), (28, -17), (31.7, -17), (-16, -26.1), (-23, 11.2), (23, 10.4)):
        place('Village kitchen garden', x, z)


def riverside(board):
    a, place, palette = board.add, board.place, board.set_palette
    a('Mill wheel', village.paddle_wheel(), -37.1, 5, height=-0.35)
    palette('Mill wheel', primary='#846346', leather='#a5815d')
    a('Mill race plank deck', box(39, 6, 34, WOOD), -37.9, 9.3, height=-0.6)
    a('Millside goods rack', town.apothecary_shelf(), -28.3, 8.9, 3)
    palette('Millside goods rack', visor='#a68c60', detail='#767b64', primary='#8b674e')
    a('Riverside loading trestle', town.workbench(28, 13), -32, 10.3)
    a('Riverside bollard', box(4, 9, 4, WOOD), -39, 10.6)
    for z in (-32, -16, 8, 12.7, 17, 27, 32):
        place('Riverside bollard', -39, z)
    a('Alder tree', landscape.woodland_tree(55, 44, 171), -35, 15.8)
    a('Young alder', landscape.woodland_tree(41, 33, 291), -30.5, 15.2)
    a('Tall bank willow', landscape.woodland_tree(69, 39, 193), -37.5, -19.7)
    for label, coords in (
        ('Alder tree', ((-36, -35), (-34, 33), (29, 34), (37, -28), (-31, -3), (19, 8), (32, -39), (-22, 42))),
        ('Young alder', ((-35, 23), (25, 32), (36, -25), (38, -7), (40, 13), (-33, -28), (27, -37))),
        ('Tall bank willow', ((-37.8, -10), (-37.7, 30), (-36.8, 39), (40, 32), (33, 41), (-30, 42))),
    ):
        for x, z in coords:
            place(label, x, z)
    palette('Alder tree', detail='#657941')
    palette('Young alder', detail='#849651')
    palette('Tall bank willow', detail='#686d42', primary='#7a7947')


def castle(board):
    castle_start = len(board.placements), len(board.fixtures)
    a, place, palette = board.add, board.place, board.set_palette
    a('Castle gate arch', arch(66, 58, 31, 35), 0, 22.25)
    a('Square curtain tower', town.watchtower(), -5.15, 22.4)
    for x, z in ((5.15, 22.4), (-21.5, 22.65), (22, 22.65), (-21.5, 44.75), (22, 44.75)):
        place('Square curtain tower', x, z, 1 if x > 18 else 0)
    a('Castle curtain wall', town.curtain(145), -13.65, 22.25)
    for x in (-14.3, 0, 14.3):
        place('Castle curtain wall', x, 45.15)
    a('Castle side curtain', town.curtain(184), -21.5, 33.7, 1)
    place('Castle side curtain', 22, 33.7, 1)
    a('Postern flank wall', town.curtain(64), 10.5, 22.25)
    a('Postern arch', arch(46, 44, 16, 24), 16, 22.25)
    a('Postern east wall', town.curtain(26), 19.0, 22.25)
    a('Castle gate banner', town.banner(), -5.15, 19.85, height=3.25)
    place('Castle gate banner', 5.15, 19.85, height=3.25)
    place('Castle gate banner', 16.0, 21.3, height=3.9)
    palette('Castle gate banner', **BANNER)
    a('Raised portcullis', town.raised_gate(), 0, 22.0, height=2.8)
    hall_start = len(board.placements), len(board.fixtures)
    a('Great hall shell', town.keep_shell(), 0, 39.2)
    a('Great hall slate roof', town.pitched_roof(146, 118, 36), 0, 39.2, height=5.76)
    palette('Great hall slate roof', **SLATE)
    a('Hall heraldic hanging', town.banner(16, 36), 0, 44.05, height=1.2)
    palette('Hall heraldic hanging', **BANNER)
    a('Great hall side hanging', town.banner(), -4.4, 33.7, height=1.8)
    place('Great hall side hanging', 4.4, 33.7, height=1.8)
    palette('Great hall side hanging', **BANNER)
    a('Seal dais', box(20, 7, 13, STONE), 0, 42.7)
    a('Court seal chest', lp.crate(12, 8, 8, BODY, MARK), 0, 42.7, height=0.7)
    palette('Court seal chest', **BANNER)
    a('Great hall banquet table', town.workbench(14, 35), -3.2, 39.75)
    place('Great hall banquet table', 3.2, 39.75)
    for x, z in ((-4.7, 38), (4.7, 38), (-3.1, 42), (3.1, 42), (-3.4, 33.7), (3.4, 33.7)):
        place('Inn window lantern', x, z, height=2.2)
        board.light(x, 2.85, z + 0.24, '#ffd098', 550, 8)
    a('Great hall candle crown', town.chandelier(), 0, 38.5, height=3.45)
    place('Great hall candle crown', 0, 42, height=3.45)
    board.light(0, 3.28, 38.5, '#ffdcad', 1800, 10)
    board.light(0, 3.28, 42, '#ffe1b9', 1350, 8)
    a('Court flagstone aisle', box(20, 1, 80, BODY), 0, 38.25, height=-0.015)
    palette('Court flagstone aisle', primary='#88454c')
    dressing.lift_group(board, *hall_start, dressing.HALL_HEIGHT)
    a('Courtyard patrol shelter', lp.awning(), 9.2, 33.9, 2)
    place('Courtyard patrol shelter', -9.4, 33.9, 2)
    a('Courtyard water basin', lp.well(), -8.45, 29.2)
    a('Courtyard issue chest', lp.crate(20, 12, 12, BODY, DARK), 6.4, 34.1)
    place('Courtyard issue chest', -9.1, 32.55)
    dressing.lift_group(board, *castle_start, dressing.COURT_HEIGHT)
    a('Gate repair bench', town.workbench(22, 12, tools=True), -3.45, 17.8)


def chapel(board):
    a, place, palette = board.add, board.place, board.set_palette
    a('Stone chapel', town.chapel_shell(), 29, 12)
    a('Chapel flagstone floor', room_floor(65, 83, 52, stone=True), 29, 12, height=-0.06)
    a('Chapel steep roof', town.pitched_roof(76, 96, 34), 29, 12, height=5.08)
    palette('Chapel steep roof', primary='#56595f', secondary='#323d41')
    a('Chapel belfry', town.belfry(), 31.5, 14.65)
    a('Belfry cap', town.pitched_roof(32, 33, 26), 31.5, 14.65, height=8.3)
    palette('Belfry cap', **SLATE)
    a('Chapel bell', town.bell(), 31.5, 14.65, height=7.45)
    palette('Chapel bell', metal='#947554', trim='#c39759')
    a('Chapel pew', town.workbench(20, 6), 26.9, 12.8)
    for x in (26.9, 31.1):
        for z in (10.8, 14.3):
            place('Chapel pew', x, z)
    a('Chapel candle table', town.workbench(21, 10), 29, 15.4)
    place('Inn window lantern', 29, 15.4, height=1.1)
    board.light(29, 2.7, 12.6, '#ffe9bf', 980, 7)


def gameplay(board):
    prop = board.prop_id
    board.point('road', 'South cart road', 0, -38, actions=(
        action('player-spawn'), action('loadout', assets=('tallow_lantern', 'alderwick_map')),
        action('extract', requires=('court_seal',))))
    board.point('market', 'Market square', 0, -12, actions=(
        action('trade', assets=('town_vendor', 'grain_sack', prop('Covered market grain stall')), reward='market_grain'),))
    board.point('inn', 'Alder inn', -16.6, -20, actions=(
        action('resupply', assets=('tallow_lantern', prop('Inn common table'))),))
    board.point('smithy', 'Blacksmith shop', 18, -12, actions=(
        action('craft', assets=('blacksmith', 'smith_hammer', 'iron_billet', 'gate_hinge', prop('Blacksmith anvil')),
               requires=('iron_stock',), reward='forged_hinge'),))
    board.point('mill', 'Riverside mill and granary', -26, 5, actions=(
        action('transfer', assets=('grain_sack', 'iron_billet', prop('Mill wheel')),
               requires=('market_grain',), reward='iron_stock'),))
    board.point('apothecary', 'Apothecary shop', -12, 3, actions=(
        action('craft', assets=('town_herbalist', 'herb_bunch', 'cordial_flask', prop('Apothecary mixing table')),
               requires=('gathered_herbs',), reward='herbal_cordial'),))
    board.point('garden', 'Apothecary herb garden', -16, 12, actions=(
        action('gather', assets=('herb_bunch', prop('Herb and flower bed')), reward='gathered_herbs'),))
    board.point('steward', 'Steward lodge', 10.8, 7, actions=(
        action('trade', assets=('town_steward', 'cordial_flask', 'seal_letter'),
               requires=('herbal_cordial',), reward='steward_pass'),))
    board.point('chapel', 'Chapel and bell tower', 29, 10.8, actions=(
        action('signal', assets=(prop('Chapel bell'),)),))
    board.point('gate', 'Castle gatehouse', 0, 16.12, radius=4, actions=(
        action('repair', assets=('gate_hinge', prop('Gate repair bench'), prop('Raised portcullis')),
               requires=('forged_hinge',), reward='gate_repaired'),))
    postern_y = dressing.COURT_HEIGHT * (20.4 - 15.2) / 6.4
    board.point('postern', 'Castle postern', 16, 20.4, y=postern_y, actions=(
        action('unlock', assets=('seal_letter', prop('Postern arch')),
               requires=('steward_pass',), reward='postern_open'),))
    board.point('castle', 'Castle courtyard', 0, 28, y=dressing.COURT_HEIGHT, actions=(
        action('resupply', assets=('castle_guard', 'alder_shield', prop('Courtyard issue chest'))),))
    board.point('hall', 'Great hall', 0, 39.6, y=dressing.COURT_HEIGHT + dressing.HALL_HEIGHT, actions=(
        action('gather', assets=('court_signet', prop('Court seal chest')), reward='court_seal'),))
    board.link('road', 'market')
    board.link('road', 'inn', [-4, 0, -27], [-12, 0, -23], [-12, 0, -20])
    board.link('market', 'inn', [-9, 0, -13], [-12, 0, -17], [-12, 0, -20])
    board.link('market', 'smithy')
    board.link('market', 'apothecary', [0, 0, 3], [-6, 0, 3])
    board.link('apothecary', 'garden', [-5.5, 0, 3], [-5.5, 0, 8.6], [-16, 0, 8.6])
    board.link('mill', 'garden', [-26, 0, 8.6], [-16, 0, 8.6])
    board.link('market', 'mill', [-6, 0, -12], [-11.5, 0, -10], [-25, 0, -10], [-26, 0, -3])
    board.link('market', 'gate')
    board.link('smithy', 'steward', [12, 0, -12], [11.7, 0, 4])
    board.link('gate', 'steward', [4.7, 0, 15.9], [4.7, 0, 7])
    board.link('steward', 'chapel', [22, 0, 6.86], [29, 0, 6.84])
    board.link('steward', 'postern', [16, 0, 7], [16, 0, 15.2])
    court = dressing.COURT_HEIGHT
    board.link('gate', 'castle', [0, 0, 16.5], [0, court, 22.0], requires=('gate_repaired',))
    board.link('postern', 'castle', [16, court, 21.6], [16, court, 27.8], [4, court, 27.2],
               [0, court, 27.2], requires=('postern_open',))
    board.link('castle', 'hall', [0, court + dressing.HALL_HEIGHT, 34.0])


def stage_people(board):
    for actor, x, z, yaw, pose in (
        ('town_vendor', 9.2, -3.9, 142, ('Reach', .36)),
        ('town_herbalist', 10.18, -6.95, 14, ('Reach', .36)),
        ('town_steward', 11.05, -6.45, -58, ('Idle', .8)),
        ('town_vendor', 12.85, -.92, 24, ('Reach', .36)),
        ('blacksmith', 14.35, -.88, -62, ('Idle', .8)),
        ('town_vendor', -4.75, -6.15, 58, ('Reach', .36)),
        ('town_herbalist', -2.6, -5.65, -82, ('Reach', .36)),
        ('castle_guard', -3.8, 16.1, 165, ('Idle', .8)),
        ('town_herbalist', -10.5, 3.9, 100, ('Reach', .36)),
        ('blacksmith', 18.8, -13, -135, ('Reach', .36)),
    ):
        board.stage_actor(actor, x, z, yaw=yaw, pose=pose)
    court = dressing.COURT_HEIGHT
    for actor, x, z, yaw, pose in (
        ('town_steward', -4.42, 29.6, 90, ('Reach', .33)),
        ('castle_guard', -3.14, 29.6, -90, ('Reach', .36)),
        ('town_vendor', -5.76, 30.35, 110, ('Walk', .28)),
    ):
        board.stage_actor(actor, x, z, y=court, yaw=yaw, pose=pose)
    board.stage_actor('town_vendor', 1.15, 31.05, y=court + 1.6, yaw=8, pose=('Walk', .30))
    board.stage_actor('castle_guard', .45, 35, y=court + dressing.HALL_HEIGHT, yaw=180, pose=('Idle', .8))


def make_board():
    board = create_board(
        'medieval', 'Alderwick', 'Trade in the town and bring the court seal out of the castle.',
        ('#a49884', '#524941', '#985a48', '#816348', '#dec9a3', '#777b77',
         '#ffc478', '#789b99', '#473a30', '#778b51'),
        {**color_profile('#527ca0', '#87a5be', '#ffdaa0', strength=8.05, direction=(-8, 4.7, -7)),
         'fillIntensity': 1.04, 'skyFill': '#c9def7'},
        'road', 'road',
    )
    terrain(board)
    streets(board)
    riverside(board)
    castle(board)
    chapel(board)
    dressing.shop_dressing(board)
    dressing.market_lane(board)
    dressing.outskirts(board)
    keep_start = len(board.placements), len(board.fixtures)
    dressing.keep_dressing(board)
    dressing.lift_group(board, *keep_start, dressing.COURT_HEIGHT)
    dressing.court_terrace(board)
    dressing.hillsides(board)
    landscape.far_banks(board)
    gameplay(board)
    stage_people(board)
    board.shot('Board overview', [-67, 64, -71], [0, 2, 0])
    board.shot('Fair beneath the ward', [9.1, 7.2, -19.35], [-.25, 2.1, 19.8])
    board.shot('Market terraces', [12.75, 8.2, -24.4], [-0.5, 3.55, 8.8])
    board.shot('Town panorama', [-44, 26, -43], [0, 2.6, 11])
    board.shot('Castle approach', [-7.8, 1.78, 8.2], [0.5, 3.9, 24])
    board.shot('Market square', [2.7, 1.72, -20.8], [-1.6, 2.1, -5.4])
    board.shot('Blacksmith hearth', [16.2, 1.71, -12.7], [22.8, 1.55, -11.4])
    board.shot('Apothecary interior', [-8.5, 1.72, 3.1], [-14.6, 1.45, 3.8])
    board.shot('Riverside mill', [-41.5, 1.7, 11.5], [-34.9, 2.45, 5.3])
    board.shot('Chapel lane', [33.5, 1.72, 1.3], [29.5, 4.2, 12.4])
    board.shot('Ward stair', [0, 0.18 + dressing.COURT_HEIGHT, 22.20], [-0.9, 10.56, 37.2])
    board.shot('Great hall', [0, 1.78 + dressing.COURT_HEIGHT + dressing.HALL_HEIGHT, 34.6], [0, 2.6 + dressing.COURT_HEIGHT + dressing.HALL_HEIGHT, 42.7])
    return board
