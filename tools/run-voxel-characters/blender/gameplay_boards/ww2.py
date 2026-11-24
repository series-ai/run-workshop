"""Estuary Front, a period vehicle crossing, airfield, and harbor board."""

from random import Random

import build_level_props as lp
from creature_kit import Sculpt
from level_geometry import box
from .common import (BODY, DARK, GLOW, GREEN, JOINT, MARK, METAL, STONE, WOOD, action,
                     arch, barricade, color_profile, create_board, floors, fractured_wall,
                     roof_bay, rubble, shelf, slab)
from . import estuary_dressing, estuary_north, estuary_repair
from . import estuary as shore
from . import estuary_village as village
from .fleet import roster


def runway(seed, *, markings=False):
    shape = slab(80, 80, face=JOINT, joint=STONE, seed=seed)
    for x in (-20, 20):
        shape.paint((x, x), 2, (-40, 39), DARK)
    shape.paint((-40, 39), 2, (7, 7), DARK)
    for i in range(7):
        box(5, 1, 1, STONE, x=4 + i * 3, y=2, z=-28 + i, sculpt=shape)
    if markings:
        for x in (-21, 19):
            box(24, 1, 2, MARK, x=x, y=2, sculpt=shape)
        for z in (-36, 36):
            box(80, 1, 1, MARK, y=2, z=z, sculpt=shape)
    return shape


def track_bed(depth):
    shape = box(31, 2, depth, JOINT)
    for x in (-10, 10):
        box(2, 2, depth, METAL, x=x, y=3, sculpt=shape)
    for z in range(-depth // 2 + 2, depth // 2, 5):
        box(26, 1, 2, WOOD, y=2, z=z, sculpt=shape)
    return shape


def sandbag_run(width, rows=4):
    shape = Sculpt()
    for row in range(rows):
        for x in range(-width // 2 + 3 + 3 * (row % 2), width // 2 - 2, 6):
            color = MARK if (x + row * 3) % 7 < 4 else WOOD
            box(5, 2, 6, color, x=x, y=row * 2, sculpt=shape)
            box(3, 1, 7, color, x=x, y=row * 2, sculpt=shape)
    return shape


def trench_panel(width):
    shape = box(width, 3, 8, WOOD)
    box(width, 10, 3, WOOD, y=3, sculpt=shape)
    for x in range(-width // 2 + 2, width // 2, 5):
        box(1, 12, 2, DARK, x=x, y=1, z=2, sculpt=shape)
    for x, (bottom, top), z, code, filled in sandbag_run(width, 2).ops:
        shape.ops.append((x, (bottom + 12, top + 12), z, code, filled))
    return shape


def stone_bridge():
    shape = box(80, 4, 53, JOINT)
    for x in range(-38, 40, 7):
        box(1, 1, 51, STONE, x=x, y=3, sculpt=shape)
    for z in (-25, 25):
        box(80, 7, 3, STONE, y=4, z=z, sculpt=shape)
        box(80, 1, 4, JOINT, y=11, z=z, sculpt=shape)
        for x in (-35, -17, 0, 17, 35):
            box(4, 10, 4, STONE, x=x, y=4, z=z, sculpt=shape)
    for x in (-26, 26):
        box(12, 11, 8, STONE, x=x, z=-20, sculpt=shape)
        box(12, 11, 8, STONE, x=x, z=20, sculpt=shape)
    return shape


def water(seed):
    shape = slab(80, 80, face=GREEN, joint=DARK, seed=seed)
    rng = Random(seed)
    for _ in range(11):
        x, z = rng.randrange(-35, 34), rng.randrange(-37, 38)
        box(rng.randint(3, 9), 1, 1, BODY, x=x, y=2, z=z, sculpt=shape)
    return shape


def dock():
    shape = box(79, 3, 36, WOOD, y=7)
    for x in range(-38, 40, 4):
        box(1, 1, 36, DARK, x=x, y=9, sculpt=shape)
    for x in (-34, -17, 17, 34):
        for z in (-16, 16):
            box(4, 10, 4, WOOD, x=x, z=z, sculpt=shape)
            box(5, 2, 5, METAL, x=x, y=10, z=z, sculpt=shape)
    return shape


def make_board():
    board = create_board('ww2', 'Estuary Front', 'Restore the bridge, secure the airstrip, and load the landing craft.',
                         ('#868679', '#3e4946', '#727950', '#796347', '#c9be97', '#889594',
                          '#e9b158', '#839598', '#323736', '#5d7052'),
                         color_profile('#527fa5', '#dbd4be', '#ffe0ab', strength=7.0, direction=(2.8, 6.3, 7.6)),
                         'village', 'extract')
    board.environment.update(skyFill='#c0d5ee', fillIntensity=1.23, fogDensity=0.010,
                             reviewSkyGradientTop=0.24)
    a, place = board.add, board.place
    grid = [(x, z) for x in range(-36, 45, 8) for z in range(-36, 29, 8)]
    estuary = [p for p in grid if p[0] >= 36 or p[0] == 12 and p[1] >= -12]
    airfield = [p for p in grid if p not in estuary and p[0] >= -4 and p[1] < -12]
    lane = [p for p in grid if p not in estuary + airfield and
            (p[1] == 4 or p[0] in (-20, 20) or p[1] == 20 and p[0] >= -12)]
    field = [p for p in grid if p not in estuary + airfield + lane]
    floors(board, 'Estuary water tile', water(12), estuary[::2], y=-0.95)
    floors(board, 'Harbor wake tile', water(27), estuary[1::2], y=-0.95)
    for label in ('Estuary water tile', 'Harbor wake tile'):
        board.surfaces[board.prop_id(label)] = 'water'
        board.set_palette(label, detail='#4d7a82', primary='#669298', skin='#456971', secondary='#39555c')
    floors(board, 'Runway concrete', runway(8), [p for p in airfield if p[1] != -28])
    floors(board, 'Runway stripe tile', runway(12, markings=True),
           [p for p in airfield if p[1] == -28])
    lane_crossings = [(x, z) for x, z in lane if x in (-20, 20) and z in (4, 20)]
    lane_straights = [p for p in lane if p not in lane_crossings]
    first_x, first_z = lane_straights[0]
    a('Rutted supply lane', village.rutted_lane(), first_x, first_z, int(first_z in (4, 20)), -0.3)
    for x, z in lane_straights[1:]:
        place('Rutted supply lane', x, z, int(z in (4, 20)), -0.3)
    floors(board, 'Crossing wheel ruts', village.rutted_lane(crossing=True), lane_crossings)
    rows = [p for p in field if p[0] <= -12 and p[1] not in (4, 12)]
    floors(board, 'Meadow sod', village.grassland(13), [p for p in field if p not in rows])
    floors(board, 'Scuffed grass', village.grassland(27, furrows=True), rows)
    board.set_palette('Runway concrete', skin='#809090', secondary='#686e6c')
    board.set_palette('Runway stripe tile', skin='#586466', trim='#c8c3a7', secondary='#484f50')
    for label in ('Rutted supply lane', 'Crossing wheel ruts'):
        board.set_palette(label, leather='#8a7459', skin='#786851', secondary='#86785c', detail='#7c8050')
    board.set_palette('Meadow sod', detail='#78834e', primary='#859258')
    board.set_palette('Scuffed grass', detail='#848658', primary='#716f47')
    a('Estuary stone bridge', stone_bridge(), 12, 4, height=-0.4)
    a('Riveted bridge girder', village.bridge_girder(), 12, 1.55, height=0.65)
    place('Riveted bridge girder', 12, 6.45, 2, 0.65)
    board.set_palette('Riveted bridge girder', primary='#4c7776', metal='#6a8780',
                      secondary='#455c5a', trim='#ae9672')
    a('Pontoon repair deck', box(80, 3, 29, WOOD), 12, 20, height=-0.3)
    a('Bridge keeper arch', arch(51, 39, 13, 33), 17.3, 4, 1)
    a('Bridge control locker', lp.case(14, 18, 11, BODY, METAL, screen=True), 8, 6.4, 3)
    a('Crated bridge fittings', lp.cargo_rack(METAL), 8.8, 1.75)
    a('Fieldstone barn front', fractured_wall(81, 33, 7, door=31, holes=2, seed=2), -30, 23)
    a('Village stone return', fractured_wall(71, 32, 7, door=23, holes=4, seed=21), -34, 26, 1)
    for x, z, turn in ((-26, 26, 1), (-31, 11, 1), (-34.5, 3.1, 0), (-28.5, 0, 2), (-24.6, 4.8, 1)):
        place('Village stone return', x, z, turn)
    a('Upper village window wall', lp.window_wall(STONE, WOOD, brick=True), -30, 23, height=3.3)
    place('Upper village window wall', -26.3, 23, height=3.3)
    a('Slate cottage roof', lp.pitched_roof(86, 59, DARK, STONE), -30, 26.4, height=4.8)
    a('Village signal signpost', village.waypost(), -26.7, 16.3)
    place('Village signal signpost', -13.4, -3.1, 1)
    place('Village signal signpost', 21, 14.4, 2)
    board.set_palette('Village signal signpost', primary='#4f7471', secondary='#824e43', trim='#decfac')
    a('Medic field canopy', roof_bay(49, 45, 30, face=MARK), -31, 7)
    a('Field stretcher', lp.platform(12, 24, 7, WOOD, METAL), -31.4, 8.6)
    a('Torn stone pile', rubble(34, 28, seed=41), -35.4, 11.4)
    for x, z, turn in ((-15, 6, 2), (-7.9, 8.0, 1), (7.3, 10, 1), (6, 24, 0),
                       (20.5, 11.1, 2), (23.1, 0, 3), (14.9, -13, 1), (-4, -14, 2)):
        place('Torn stone pile', x, z, turn)
    a('Rail ballast and ties', track_bed(80), -33, -10, 1, -0.18)
    for x in (-25, -17, -9):
        place('Rail ballast and ties', x, -10, 1, -0.18)
    a('Rail depot loading platform', lp.platform(55, 28, 9, STONE, WOOD), -22, -12.8)
    a('Rail shed roof frame', roof_bay(64, 35, 36, face=DARK), -23, -13.1)
    a('Stacked ration cases', lp.cargo_rack(WOOD), -24.9, -12.4)
    a('Depot booking hall', shore.station_wall(), -23.1, -14.8)
    board.set_palette('Depot booking hall', primary='#9d6552', leather='#b0856d', visor='#6a898b')
    a('Rail stop block', barricade(27, face=METAL, stripe=MARK), -5, -10, 1)
    a('Rail yard signal', shore.semaphore(), -11.9, -8.1)
    board.set_palette('Rail yard signal', primary='#a04e40', trim='#d5ccad')
    a('Sandbag firing step', sandbag_run(39), -5.7, 11.7)
    for x, z, turn in ((-7.1, 16, 1), (1.7, 16, 2), (4.5, 17.1, 0), (4, 25, 0), (10, 11, 1),
                       (24, 9, 2), (24, 3, 1), (30, 1, 2), (-5, -5, 1), (-10, 2.9, 3)):
        place('Sandbag firing step', x, z, turn)
    a('Dugout timber wall', trench_panel(56), -5, 18.7)
    place('Dugout timber wall', 1.8, 18.7)
    a('Dugout shelter', roof_bay(48, 41, 27, face=WOOD), -4, 21)
    a('Field radio cabinet', lp.case(15, 14, 10, METAL, BODY, screen=True), -4.6, 21.5)
    a('Checkpoint hedge', rubble(51, 15, face=GREEN, seed=12), -21, 1.8)
    for x, z, turn in ((-31, 13, 2), (-33, 28, 1), (-23, 22, 1), (-11, 14, 2), (1, 25, 0),
                       (5, 8, 1), (20, 28, 0), (31, 26, 1), (-4, -4, 1), (-2, -14, 1)):
        place('Checkpoint hedge', x, z, turn)
    a('Field hangar roof', shore.hangar_roof(), 20, -36.1, height=4.2)
    a('Field hangar upright', shore.hangar_shell(), 20, -35.9)
    for label in ('Field hangar upright', 'Field hangar roof'):
        board.set_palette(label, primary='#617a77', secondary='#3f5556', metal='#81918b', trim='#d4c395')
    a('Airfield watch office', shore.signal_tower(), 8.8, -34.8)
    board.set_palette('Airfield watch office', primary='#9a7650', leather='#846244', visor='#6c969b',
                      secondary='#445957', trim='#cfba8e')
    a('Hangar tool bench', lp.counter(32, 12, WOOD, METAL, shelf=True), 14.9, -34.2, 1)
    a('Fuel drum pallet', shore.fuel_bowser(), 11.7, -18.6)
    board.set_palette('Fuel drum pallet', primary='#818e83', metal='#9da99e')
    place('Fuel drum pallet', 21.4, -15.8)
    a('Landing marker lamp', shore.edge_lamp(), -3.5, -31.85)
    for x in (-3.5, 4, 8, 22.8):
        if x != -3.5:
            place('Landing marker lamp', x, -31.85)
        place('Landing marker lamp', x, -24.35)
    a('Battery concrete apron', slab(56, 42, face=JOINT, seed=19), 29, 14.3, height=0.01)
    a('Coastal battery back wall', barricade(59, face=STONE, stripe=JOINT), 29, 15.6)
    a('Coastal observation slit', fractured_wall(44, 19, 7, holes=2, seed=3), 30.1, 15.6, height=1.1)
    a('Battery supply shelf', shelf(28, 12, 19, face=BODY), 28.6, 15.4)
    a('Harbor timber pier', dock(), 36, 14, height=-0.7)
    place('Harbor timber pier', 36, 1, height=-0.7)
    place('Harbor timber pier', 36, -10, height=-0.7)
    ramp = Sculpt()
    for step in range(3):
        box(6, step + 1, 25, WOOD, x=-6 + step * 6, sculpt=ramp)
    a('Dock approach ramp', ramp, 31.4, 14.7)
    a('Pier cleat', box(9, 3, 4, METAL), 39.2, 14.9, height=0.3)
    for x, z in ((33, 13), (36.1, 14.9), (39, 1.8), (35, 1.8), (39, -9.1)):
        place('Pier cleat', x, z, height=0.3)
    a('Harbor cargo tackle', lp.repair_gantry(), 33.5, 13.7)
    a('Crated cargo spool', lp.drum(10, 15, WOOD, METAL), 32.95, 12.7)
    a('Loading dock storage', shore.dock_crates(), 35, 12.95, height=0.3)
    place('Loading dock storage', 36.4, -10.8, 2, 0.3)
    place('Loading dock storage', 34.3, 0.2, 1, 0.3)
    board.set_palette('Loading dock storage', primary='#936f4d', trim='#b69b74', leather='#836345')
    a('Harbor bollard', lp.post(9, METAL, MARK), 39.7, 13.5, height=0.3)
    place('Harbor bollard', 39.6, 1, height=0.3)
    a('Field lookout lamp', lp.post(18, METAL, GLOW), 6.8, 5.8)
    for x, z in ((-27, 18), (-24.2, -11.6), (6.8, 5.8), (18, 6.2), (25, -18.4), (33.9, 14.2)):
        if (x, z) != (6.8, 5.8):
            place('Field lookout lamp', x, z)
        board.light(x, 2.3, z, '#ffce83', 16, 6)

    a('Twin stone cottage wall', shore.cottage_front(), -36, 18.6, 2)
    a('Clay cottage roof', shore.cottage_roof(65, 54), -36, 21, height=3.15)
    a('Cottage return stone', fractured_wall(49, 32, 6, seed=17), -39, 21, 1)
    place('Cottage return stone', -33, 21, 3)
    place('Cottage return stone', -36, 23.5, 2)
    for x, z in ((-35, -1), (-36, -18.4)):
        place('Twin stone cottage wall', x, z - 2.4, 2)
        place('Clay cottage roof', x, z, height=3.15)
        place('Cottage return stone', x - 3, z, 1)
        place('Cottage return stone', x + 3, z, 3)
        place('Cottage return stone', x, z + 2.5, 2)
    a('Orchard timber lodge', village.orchard_lodge(), -17, 24, 1)
    board.set_palette('Orchard timber lodge', skin='#c5b89a', leather='#594b3d', primary='#686e73',
                      secondary='#48575d', visor='#839a97', trim='#c2af89')
    a('Rail wheelwright shed', village.cart_shed(), -29.6, -18.5)
    board.set_palette('Rail wheelwright shed', primary='#7b8580', metal='#939690', secondary='#55594d',
                      leather='#9e8563', trim='#c4a277')
    a('Village lime kiln', village.lime_kiln(), -36.2, 27.3, 1)
    board.set_palette('Village lime kiln', skin='#ada493', leather='#976f59')
    a('Drainage ditch poplar', village.poplar(), -11.2, -31.7)
    board.set_palette('Drainage ditch poplar', primary='#576945', detail='#798453', leather='#806f57')
    a('Orchard pollard tree', shore.alder(19), -37.5, 12.2)
    a('Wind-shaped field tree', shore.alder(37), -15.2, 16.2)
    for x, z, turn in ((-37.7, 8, 2), (-21, 12, 0), (-15.1, 13.5, 1), (-14.2, 18.1, 0),
                       (-15.5, 21, 1), (-10.5, 23.7, 2), (-7.2, 26.7, 0), (21.9, 21.6, 0),
                       (22, 25.5, 3), (25.3, 25.2, 1), (29.7, 21.7, 2)):
        place('Orchard pollard tree', x, z, turn)
    for x, z, turn in ((-38, -13.9, 1), (-22, -17.2, 3), (27.3, 23.2, 0), (2.5, 26.6, 2)):
        place('Wind-shaped field tree', x, z, turn)
    a('Corrugated shore warehouse', shore.cottage_roof(65, 56), 30.1, -2.5, height=3.65)
    a('Warehouse shutter bay', shore.warehouse_front(), 30.1, 0)
    a('Warehouse wall return', shore.workshop_side(), 33.2, -2.6, 1)
    place('Warehouse wall return', 27.3, -2.6, 3)
    place('Warehouse wall return', 30.1, -5.1, 2)
    a('Wooden hedgerow fence', lp.fence(59, 9, WOOD), -17, 12.2)
    for x, z, turn in ((-14, 16, 1), (-11.4, 23, 1), (22.4, 27, 2), (31.7, 19.5, 1),
                       (-16, -20, 1), (-10, -21, 1), (-34.8, 2.0, 1)):
        place('Wooden hedgerow fence', x, z, turn)
    a('Coastal concrete block', barricade(24, face=STONE, stripe=JOINT), 32, 17)
    for x, z, turn in ((31.2, 12.3, 1), (30.2, 17, 0), (33, 11.5, 0), (28.2, 17.7, 1)):
        place('Coastal concrete block', x, z, turn)
    a('Airstrip wind sock pole', shore.windsock(), 8.6, -18.8)
    a('Scattered airfield equipment', lp.cargo_rack(METAL), 23.9, -16.4)
    place('Scattered airfield equipment', 32, -17.8, 2)

    board.set_palette('Airstrip wind sock pole', primary='#bc5e38', trim='#e7d7a9')
    board.set_palette('Twin stone cottage wall', skin='#b9ae96', leather='#817662', visor='#708a88')
    board.set_palette('Clay cottage roof', primary='#92594a', secondary='#734a40', leather='#8e5847')
    for label in ('Warehouse shutter bay', 'Warehouse wall return'):
        board.set_palette(label, primary='#9e5947', leather='#844b3e', visor='#789b99',
                          secondary='#455457', metal='#778385', trim='#ddc99d')
    board.set_palette('Corrugated shore warehouse', primary='#576665', secondary='#4b5859', skin='#a46b51')
    for label in ('Orchard pollard tree', 'Wind-shaped field tree'):
        board.set_palette(label, detail='#72834d', primary='#576f49', leather='#76664e')
    for x, z, turn in ((-37, -35, 0), (-34, -36, 1), (-37.5, -22.6, 1), (-34.7, -31.8, 0),
                       (-8, -36.2, 3), (-4.5, -37.6, 0), (0, -36.6, 2), (29, -37, 2), (-37, 30, 1)):
        place('Wind-shaped field tree', x, z, turn)
    for x, z, turn in ((-29, -35.8, 2), (-21, -37, 0), (-18, -35.6, 1), (-14, -35.9, 1),
                       (4.6, -38, 1), (26.8, -37, 2), (31, -36.1, 3), (23.4, 26.2, 1), (25.7, 26.6, 2)):
        place('Drainage ditch poplar', x, z, turn)
    a('Airfield perimeter hedge', shore.airfield_hedge(), -35.5, -37.1)
    for x, z in ((-30.8, -37.3), (-17.6, -38.8), (-11.8, -37.2), (-4.0, -37.0), (3.7, -37.4), (29.5, -38)):
        place('Airfield perimeter hedge', x, z)
    board.set_palette('Airfield perimeter hedge', primary='#586c48', detail='#788554', leather='#77684d')
    a('Riveted tidal quay', shore.seawall(), 31.85, -28, height=-1.5)
    for z in (-36, -20, -12, -4, 4, 12, 20, 28):
        place('Riveted tidal quay', 31.85, z, height=-1.5)
    crane = shore.crane()
    parked_crane = crane.rest()
    board.finish('Dockside lifting crane', parked_crane)
    board.vehicle('Dockside lifting crane', 'dock-crane', crane, 32.7, 4.2, parked=parked_crane,
                  primary='#bc834d', visor='#6c999e', secondary='#47575a')
    a('Tidal channel bank', shore.river_bank(39), 8.3, -12, height=-0.9)
    for z in (-12, -4, 4, 12, 20, 28):
        if z != -12:
            place('Tidal channel bank', 8.3, z, height=-0.9)
        place('Tidal channel bank', 15.7, z, 2, -0.9)
    place('Tidal channel bank', 12, -15.7, 3, -0.9)
    board.set_palette('Tidal channel bank', detail='#718252', leather='#796c50', skin='#78785e')
    a('Salt marsh rushes', shore.tidal_grass(15), 10.1, -12.8, 1, -0.67)
    for x, z, turn in ((9, -8, 1),(9, 0, 1),(14.1, 8.1, 1),(14.8, 12, 1),(9, 24, 1),(9.4, 27.3, 1),
                       (32.7, 18.6, 1),(32.8, 23, 1),(32.6, 28, 1),(33, -17, 1),(33, -21, 1)):
        place('Salt marsh rushes', x, z, turn, -0.67)
    board.set_palette('Salt marsh rushes', detail='#738052', trim='#a29265', skin='#655f46')

    a('Tide mill wheelhouse', village.mill_house(), 18.05, -4.1, 3)
    board.set_palette('Tide mill wheelhouse', primary='#647d73', leather='#92816a', skin='#978776',
                      secondary='#4f5957', trim='#d2c19e', visor='#78979a')
    a('Tide mill lantern roof', village.mill_roof(), 18.15, -4.1, 3, 4.5)
    board.set_palette('Tide mill lantern roof', primary='#995f4b', secondary='#805241', metal='#778582',
                      leather='#79664f', trim='#c5ac82')
    a('Mill paddle wheel', village.paddle_wheel(), 15.55, -4.75, height=-0.65)
    board.set_palette('Mill paddle wheel', primary='#8a6850', leather='#986f51',
                      secondary='#50564b', metal='#63706d')
    a('Mill tide staff', village.tide_gauge(), 15.35, -7.5, 3, -0.7)
    board.set_palette('Mill tide staff', leather='#7a6c57', trim='#ded3ad', secondary='#554c43')
    fleet = {
        item.role: board.vehicle(item.label, item.role, item.build(), *item.position, primary=item.paint)
        for item in roster()
    }
    for label in ('Single engine fighter', 'Twin engine transport', 'Twin engine bomber'):
        board.set_palette(label, accent='#cbbe91', secondary='#527a80')
    board.set_palette('Single engine fighter', accent='#c9ad62', secondary='#587783', trim='#cecfbd')
    board.set_palette('Infantry landing craft', primary='#768982', secondary='#586960',
                      visor='#668486', leather='#a58161', metal='#9b9a89')
    board.set_palette('Harbor supply barge', trim='#b5a279', leather='#8b7050', secondary='#536864')
    board.set_palette('Coastal patrol launch', secondary='#587d84', trim='#b5a98b')
    board.set_palette('Staff car', secondary='#63808a', trim='#a6a6a0')
    board.set_palette('Rail depot locomotive', primary='#526461', secondary='#3e5051', accent='#a85c49', metal='#91938c')
    board.point('village', 'Village command post', -27.8, 18, actions=(
        action('player-spawn'), action('loadout', assets=('bolt_action', 'field_radio', 'field_map')),
        action('briefing', assets=('field_officer',))))
    board.point('aid', 'Field aid station', -29.5, 9.8, actions=(
        action('resupply', assets=('field_medic', 'medical_pouch', fleet['medical']), reward='aid_supplies'),))
    board.point('rail', 'Rail supply depot', -17.6, -7.4, actions=(
        action('transfer', assets=(fleet['rail'], fleet['cargo'], 'repair_case'), reward='bridge_parts'),))
    board.point('bridge', 'Estuary bridge control', 7, 4, actions=(
        action('repair', requires=('bridge_parts',), assets=(board.prop_id('Bridge control locker'), fleet['engineering']),
               reward='bridge_ready'),))
    board.point('dugout', 'Forward dugout', -1.55, 19.5, actions=(
        action('relay', assets=('rifleman', 'flare_pistol', 'field_binoculars'), reward='pontoon_orders'),
        action('vehicle-spawn', assets=(fleet['medium'], fleet['carrier'], fleet['heavy']))))
    board.point('airstrip', 'Airstrip control apron', 16.8, -14.5, actions=(
        action('secure', assets=(fleet['fighter'], fleet['transport'], fleet['bomber'],
                                 'signal_flare', 'field_radio'), reward='airstrip_clear'),))
    board.point('battery', 'Coastal battery', 28.3, 12, actions=(
        action('disable', assets=(board.prop_id('Coastal observation slit'), 'charge_satchel'),
               reward='shore_clear'),))
    board.point('docks', 'Cargo landing pier', 36, 14, y=0.3, actions=(
        action('load', assets=(fleet['landing'], fleet['barge'], 'supply_crate'), requires=('shore_clear',),
               reward='cargo_loaded'),))
    board.point('extract', 'Harbor lift-off', 39.3, 14, y=0.3, actions=(
        action('extract', assets=(fleet['landing'], fleet['patrol']), requires=('cargo_loaded', 'airstrip_clear')),))
    board.link('village', 'aid', [-27.8, 0, 13.4])
    board.link('aid', 'rail', [-25, 0, 9], [-23, 0, 9], [-17.6, 0, 4])
    board.link('village', 'dugout', [-17, 0, 19.5], [-8.6, 0, 19.5])
    board.link('rail', 'dugout', [-14, 0, 2], [-9.4, 0, 11], [-3.1, 0, 16.4], [-1.55, 0, 18.0])
    board.link('rail', 'bridge', [-15.5, 0, 0.4], [0, 0, 0.4], [6, 0, 2])
    board.link('bridge', 'battery', [12, 0, 4], [19, 0, 4], [23, 0, 11], requires=('bridge_ready',))
    board.link('dugout', 'battery', [-1.55, 0, 17.4], [6.9, 0, 18], [8, 0, 20], [16, 0, 20], [21, 0, 17], requires=('pontoon_orders',))
    board.link('rail', 'airstrip', [-12, 0, -6.3], [-6.4, 0, -6.4], [3.4, 0, -16.5], [16.7, 0, -16.8])
    board.link('airstrip', 'battery', [19.7, 0, -13.4], [25.8, 0, -9], [26.6, 0, 7], requires=('bridge_ready',))
    board.link('battery', 'docks', [30.6, 0, 14.8], [33, 0.3, 14.8], [35, 0.3, 14.2], requires=('shore_clear',))
    board.link('docks', 'extract', requires=('cargo_loaded', 'airstrip_clear'))
    board.shot('Board overview', [102, 103, 123], [3, 0, 33])
    board.shot('Rail and village', [-15.4, 1.7, -5.2], [-22, 1.65, -10.8])
    board.shot('Airstrip lineup', [-4.3, 1.7, -13.7], [1.8, 1.8, -21.5])
    board.shot('Tide mill crossing', [6.7, 1.7, -10.8], [16.3, 1.95, -3.5])
    board.shot('Harbor landing', [39.3, 2, 14], [32.1, 2.8, 1])
    estuary_north.expand(board)
    estuary_dressing.dress(board)
    estuary_repair.dress(board)
    return board
