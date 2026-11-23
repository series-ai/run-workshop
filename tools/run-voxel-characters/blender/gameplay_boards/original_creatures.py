"""Animal observation and water surveys beyond the ranger outpost."""

import build_level_props as lp
import voxchar as vk
from creature_kit import Sculpt
from level_geometry import box

from . import equipment as eq
from .actors import Actor
from .common import (BODY, DARK, GLASS, GREEN, JOINT, MARK, METAL, STONE, WOOD,
                     action, floors, glyph, slab)

ACTORS = {
    'fen_ranger': Actor('Fen ranger', 'officer', 'human', 'soft_cap',
                        {'skin': '#b27e59', 'hair': '#55372f', 'primary': '#617451',
                         'secondary': '#424f43', 'detail': '#d8a45c'}),
    'habitat_keeper': Actor('Habitat keeper', 'worker', 'human', 'rag',
                             {'skin': '#92614c', 'hair': '#49362d',
                              'primary': '#9c714b', 'secondary': '#5f5944', 'detail': '#d3af6b'}),
    'wetland_observer': Actor('Wetland observer', 'civilian', 'human', 'bonnet',
                               {'skin': '#bc9274', 'hair': '#594035', 'primary': '#487a73',
                                'secondary': '#47584d', 'detail': '#b0b184'}),
    'field_recorder': Actor('Field recorder', 'merchant', 'human', 'cap',
                             {'skin': '#ad7852', 'hair': '#44322c', 'primary': '#807144',
                              'secondary': '#585b45', 'detail': '#b5a16e'}),
}

ITEMS = {
    'fen_route_map': eq.Item('Fen route map', 'document', eq.folded_map()),
    'habitat_compass': eq.Item('Habitat compass', 'tool', eq.survey_compass()),
    'sighting_scope': eq.Item('Field binoculars', 'tool', eq.binoculars(), (0, 2, 0)),
    'water_sample': eq.Item('Water sample vial', 'sample', eq.sample_vial()),
    'stream_test_case': eq.Item('Stream sampling case', 'tool', eq.water_test_kit()),
    'feeding_measure': eq.Item('Feed measure', 'tool', lp.feed_bucket(), (0, 5, 0)),
    'field_notebook': eq.Item('Field notebook', 'document', eq.range_card()),
    'survey_battery': eq.Item('Survey battery', 'supply', eq.battery_pack()),
    'ranger_marker': eq.Item('Trail marker flag', 'tool', eq.rail_signal_flag(), (0, 4, 0)),
    'observation_radio': eq.Item('Observation radio', 'communications', eq.radio(), (0, 5, 0)),
}

PINE = dict(primary='#526948', secondary='#3d4f3b', leather='#7e6446', trim='#cfb074',
            detail='#7e9055', skin='#969078', metal='#768785', visor='#689997', accent='#dfc784')
CHALK = dict(primary='#879365', secondary='#565b43', leather='#8f7353', trim='#d3bd87',
             detail='#aab16b', skin='#bab092', metal='#92928a', visor='#70948a')
FEN = dict(primary='#748552', secondary='#495f47', leather='#82724d', trim='#bc9d63',
           detail='#9e9c50', skin='#716d53', metal='#84968c', visor='#497875', accent='#bee0bc')
FIELD = dict(primary='#54817d', secondary='#4e5d54', leather='#927354', trim='#e6b873',
             detail='#8a9c63', skin='#a6a08a', metal='#849794', visor='#6ca3a0', accent='#d9d78e')


def add_set(board, pieces):
    for label, shape, x, z, turn, y, palette in pieces:
        board.add(label, shape, x, z, turn, y)
        board.set_palette(label, **palette)


def reed_mats(height, width):
    shape = Sculpt()
    for x in range(-width // 2 + 1, width // 2, 2):
        z = (x * 23) % 11 - 5
        stem = 4 + (x * 5) % (height - 3)
        box(1, stem, 1, GREEN if x % 3 else BODY, x=x, y=1, z=z, sculpt=shape)
        box(1, 2, 1, MARK if x % 3 else WOOD, x=x, y=stem, z=z, sculpt=shape)
        if x % 3:
            box(2, 1, 1, BODY, x=x + 1, y=stem // 2, z=z, sculpt=shape)
    return shape


def fern_bank():
    shape = box(15, 1, 13, DARK)
    for x, z, height in ((-4, -3, 6), (3, 2, 9), (1, -4, 7)):
        box(1, height, 1, WOOD, x=x, y=1, z=z, sculpt=shape)
        for i in range(1, height):
            w = 2 * (height - i) // 3 + 1
            box(w, 1, 1, GREEN, x=x, y=i + 1, z=z, sculpt=shape)
            box(1, 1, w, BODY, x=x, y=i + 1, z=z, sculpt=shape)
    return shape


def floating_leaves():
    shape = Sculpt()
    for x, z, size in ((-3, 2, 5), (2, -2, 4), (4, 3, 2)):
        box(size, 2, size - 1, GREEN, x=x, y=-1, z=z, sculpt=shape)
        box(max(1, size - 2), 2, size + 1, BODY, x=x, y=-1, z=z, sculpt=shape)
    return shape


def wildlife_pool():
    shape = box(40, 2, 40, vk.vox('visor', -.42, mottle=False))
    box(40, 1, 40, vk.vox('visor', -.24, mottle=False), y=1, sculpt=shape)
    for x, z, width in ((-16, -15, 6), (6, -15, 8), (2, -5, 11), (14, 3, 8),
                        (-2, 8, 6), (-12, 11, 7), (8, 16, 10)):
        box(width, 1, 1, GLASS, x=x, y=1, z=z, sculpt=shape)
    return shape


def boardwalk(width, depth):
    shape = Sculpt()
    for x in (-width // 2 + 2, width // 2 - 2):
        box(3, 3, depth, DARK, x=x, sculpt=shape)
    for z in range(-depth // 2 + 1, depth // 2, 3):
        box(width, 2, 3, WOOD, y=3, z=z, sculpt=shape)
        box(width - 4, 1, 1, MARK, y=4, z=z - 1, sculpt=shape)
    return shape


def blind(width, height, depth, *, screened):
    shape = Sculpt()
    for x in (-width // 2 + 1, width // 2 - 1):
        for z in (-depth // 2 + 2, depth // 2 - 2):
            box(3, height + 2, 3, DARK, x=x, z=z, sculpt=shape)
            box(5, 4, 5, STONE, x=x, z=z, sculpt=shape)
    for z in (-depth // 2 + 1, depth // 2 - 1):
        for y in (height - 6, height - 3):
            box(width, 2, 2, WOOD, y=y, z=z, sculpt=shape)
    for x in range(-width // 2, width // 2, 3):
        box(3, 2, depth + 5, BODY if x % 2 else GREEN, x=x, y=height, sculpt=shape)
    box(width, height - 1, 1, BODY, y=2, z=-depth // 2 + 1, sculpt=shape)
    for y in range(3, height - 6, 3):
        box(width - 4, 2, 2, WOOD, y=y, z=-depth // 2 + 2, sculpt=shape)
    if screened:
        for x in range(-width // 2 + 2, width // 2 - 1, 3):
            box(1, 9, 2, WOOD, x=x, y=2, z=depth // 2 - 1, sculpt=shape)
        box(width - 4, 2, 3, DARK, y=11, z=depth // 2 - 1, sculpt=shape)
    return shape


def pelican(*, fishing=False):
    shape = Sculpt()
    for x, z in ((-2, -1), (2, 2)):
        box(1, 7, 1, WOOD, x=x, z=z, sculpt=shape)
        box(2, 1, 3, WOOD, x=x, z=z + 1, sculpt=shape)
    box(6, 5, 9, STONE, y=7, sculpt=shape)
    for x in (-3, 3):
        box(1, 3, 7, METAL, x=x, y=8, z=-1, sculpt=shape)
    box(4, 2, 4, METAL, y=9, z=-6, sculpt=shape)
    if fishing:
        for step in range(5):
            box(3, 3, 3, STONE, y=10 - step, z=3 + step, sculpt=shape)
        box(3, 3, 4, STONE, y=5, z=8, sculpt=shape)
        box(2, 5, 2, MARK, y=1, z=10, sculpt=shape)
        return shape
    box(3, 7, 3, STONE, y=10, z=3, sculpt=shape)
    box(3, 4, 4, STONE, y=15, z=4, sculpt=shape)
    box(2, 2, 6, MARK, y=15, z=8, sculpt=shape)
    for x in (-1, 1):
        box(1, 1, 1, DARK, x=x, y=17, z=5, sculpt=shape)
    return shape


def marsh_deer(*, antlers=False):
    shape = Sculpt()
    for x in (-2, 2):
        for z in (-5, 4):
            box(2, 7 + (z > 0), 2, WOOD, x=x, z=z, sculpt=shape)
            box(2, 1, 2, DARK, x=x, z=z, sculpt=shape)
    box(6, 6, 14, WOOD, y=7, sculpt=shape)
    box(4, 3, 12, MARK, y=8, sculpt=shape)
    box(6, 3, 11, BODY, y=11, z=-1, sculpt=shape)
    box(4, 7, 4, WOOD, y=10, z=5, sculpt=shape)
    box(4, 4, 6, WOOD, y=15, z=7, sculpt=shape)
    box(3, 2, 1, DARK, y=15, z=10, sculpt=shape)
    box(3, 2, 3, MARK, y=11, z=-7, sculpt=shape)
    for x in (-2, 2):
        box(2, 2, 2, MARK, x=x, y=18, z=6, sculpt=shape)
        box(1, 1, 1, DARK, x=x, y=17, z=8, sculpt=shape)
        if antlers:
            side = 1 if x > 0 else -1
            for i in range(3):
                box(1, 3, 2, MARK, x=x + side * i, y=19 + 2 * i, z=6 - i, sculpt=shape)
            box(1, 3, 1, MARK, x=x + side, y=21, z=7, sculpt=shape)
    return shape


def field_scope():
    shape = box(4, 1, 2, METAL)
    for x in (-1, 1):
        box(1, 2, 3, DARK, x=x, sculpt=shape)
        box(1, 1, 1, GLASS, x=x, y=1, z=2, sculpt=shape)
    return shape


def feed_pail():
    shape = lp.feed_bucket()
    for x in (-3, 3):
        box(1, 4, 1, METAL, x=x, y=6, sculpt=shape)
    box(7, 1, 1, MARK, y=10, sculpt=shape)
    return shape


def turtle_roost():
    shape = box(22, 3, 7, WOOD)
    box(22, 1, 5, MARK, y=2, sculpt=shape)
    for x, z in ((-5, 1), (4, -1)):
        box(5, 3, 6, DARK, x=x, y=3, z=z, sculpt=shape)
        box(3, 2, 5, BODY, x=x, y=5, z=z, sculpt=shape)
        box(2, 2, 2, GREEN, x=x + 1, y=3, z=z + 4, sculpt=shape)
    return shape


def survey_marker(symbol, *, height=24, width=13):
    shape = box(3, height, 3, WOOD)
    box(width, 8, 2, BODY, y=height - 7, z=1, sculpt=shape)
    glyph(shape, symbol, -1, height - 6, 2, MARK)
    return shape


def flow_gauge():
    shape = box(28, 3, 10, STONE)
    for x in (-11, 11):
        box(4, 22, 4, WOOD, x=x, y=3, sculpt=shape)
        box(5, 1, 5, METAL, x=x, y=25, sculpt=shape)
    box(26, 2, 5, DARK, y=23, sculpt=shape)
    box(3, 22, 2, MARK, y=3, z=2, sculpt=shape)
    for y in range(5, 24, 3):
        box(2, 1, 1, DARK, y=y, z=3, sculpt=shape)
    return shape


def station_desk():
    shape = lp.counter(24, 11, WOOD, MARK, shelf=True)
    box(16, 5, 4, BODY, y=10, z=-2, sculpt=shape)
    box(11, 1, 6, GLASS, y=13, z=0, sculpt=shape)
    for x in (-4, 1, 4):
        box(2, 1, 2, MARK, x=x, y=14, z=0, sculpt=shape)
    box(3, 3, 3, METAL, x=8, y=10, z=2, sculpt=shape)
    return shape


def terrain(board):
    path = [(0, z) for z in range(20, 45, 4)]
    fen = [(x, z) for x in (8, 12) for z in (24, 28, 32)]
    ground = [(x, z) for x in range(-12, 17, 4) for z in range(20, 45, 4)
              if (x, z) not in path and (x, z) not in fen]
    floors(board, 'Reed fen meadow', slab(40, 40, face=BODY, joint=GREEN, seed=161), ground)
    board.set_palette('Reed fen meadow', **FEN)
    for z in (20, 24, 28, 32, 36):
        board.place('Reed fen meadow', -16, z, height=-.3)
    floors(board, 'East ridge trail shoulder', slab(40, 40, face=BODY, joint=GREEN, seed=174),
           [(20, z) for z in (12, 16, 20, 24)])
    board.set_palette('East ridge trail shoulder', **FEN)
    floors(board, 'Gravel survey trail', slab(40, 40, face=STONE, joint=JOINT, seed=162), path)
    board.set_palette('Gravel survey trail', **CHALK)
    floors(board, 'Fen pool bed', slab(40, 40, face=DARK, joint=GREEN, seed=166), fen, y=-.55)
    board.set_palette('Fen pool bed', **FEN)
    (x, z), *other = fen
    board.add('Fen observation pool', wildlife_pool(), x, z, height=-.40, surface='water')
    board.set_palette('Fen observation pool', **FEN)
    for x, z in other:
        board.place('Fen observation pool', x, z, height=-.40)


def reception(board):
    add_set(board, (
        ('East ridge trail marker', survey_marker(('.#.', '.##', '###', '.##', '.#.')),
         15.25, 13.45, 1, 0, FIELD),
        ('Ranger gear pavilion', blind(50, 32, 35, screened=False), -5.25, 21.9, 0, 0, PINE),
        ('Survey delivery table', station_desk(), -5.25, 21.5, 0, 0, FIELD),
        ('Dry maps wall shelf', lp.counter(26, 8, WOOD, MARK, shelf=True), -6.5, 21.95, 1, 0, CHALK),
        ('Route map rack', lp.case(15, 20, 8, WOOD, STONE, screen=True), -7.3, 21.5, 1, 0, FIELD),
        ('Outgoing sample case', lp.latched_case(14, 6, 9, BODY, METAL, MARK), -5.9, 21.65, 0, .95, FIELD),
        ('Observation trail notice', survey_marker(('###', '#.#', '###', '#..', '#..')), -2.1, 20.5, 0, 0, FIELD),
        ('Meadow rest bench', lp.bench(18, WOOD), -3.5, 22.2, 1, 0, CHALK),
        ('Ranger radio mast', lp.post(39, WOOD, METAL, arm=True), -7.9, 22.4, 1, 0, FIELD),
        ('Filled animal feed tray', lp.produce_bin(GREEN), -8.04, 27.15, 0, 0, CHALK),
        ('Handwheel feeding hatch', lp.deep_arch(25, 25, 7, 17, WOOD, MARK), -8.95, 25.1, 1, 0, PINE),
        ('Marsh deer rest shelter', blind(44, 30, 30, screened=False), -10.65, 28.5, 1, 0, PINE),
        ('Reed fen deer', marsh_deer(antlers=True), -9.62, 28.1, 1, 0,
         dict(CHALK, primary='#bb8352', leather='#d5a376', trim='#f5dfb6')),
        ('Deer forage pile', lp.rocks(16, 5, 14, GREEN), -9.85, 29.9, 0, 0, FEN),
        ('Field pen keeper bench', lp.counter(21, 9, WOOD, MARK), -8.15, 25.2, 1, 0, CHALK),
        ('Field pen wash basin', lp.drum(9, 7, WOOD, METAL), -8.14, 24.6, 1, .9, FIELD),
        ('Habitat fence rail', lp.fence(37, 12, WOOD), -9.2, 24.1, 0, 0, CHALK),
        ('Meadow brush island', fern_bank(), -7.85, 24.8, 2, 0, FEN),
        ('Fen boundary boulder', lp.shale_escarpment(GREEN), -11.2, 33.2, 1, 0, FEN),
        ('Survey sample drying rack', lp.cargo_rack(GREEN), -7.75, 31.5, 1, 0, CHALK),
        ('Warden route post', survey_marker(('.#.', '.##', '###', '.##', '.#.')), -7.65, 32.7, 1, 0, FIELD),
    ))
    board.add('Fen doe', marsh_deer(), -10.1, 26.3, 2)
    board.set_palette('Fen doe', **dict(CHALK, primary='#b8855a', leather='#c1976c'))
    for x, z, turn in ((-11.8, 28.8, 1), (-11.55, 30.3, 3)):
        board.place('Fen doe', x, z, turn)
    for x, z, turn in ((-11.8, 25.85, 1), (-11.8, 29.55, 1), (-9.9, 31.5, 0)):
        board.place('Habitat fence rail', x, z, turn)
    for x, z in ((-9, 22.5), (-12, 23.9), (-11.5, 35), (-10.5, 40), (13.3, 22.85)):
        board.place('Tall pine', x, z)
        board.place('Meadow brush island', x + .7, z + .4)
    for x, z in ((16.5, 23.0), (16.1, 26.5), (15.8, 29.5), (16.0, 32.2), (15.9, 35.5)):
        board.place('Ridge fir', x, z)
        board.place('Meadow brush island', x - 1.1, z + .5)
    for x, z, turn in ((-16.0, 21.0, 1), (-15.25, 24.0, 0), (-15.5, 28.4, 2),
                       (-16.0, 31.0, 3), (-15.9, 34.25, 2)):
        board.place('Ridge fir', x, z, turn)
        board.place('Ridge broadleaf', x - .8, z + 1.15, turn)
    board.place('Forage trough', -9.6, 25.9, 1)
    board.add('Keeper grain pail', feed_pail(), -7.94, 27.92, height=.19)
    board.set_palette('Keeper grain pail', **FIELD)
    board.place('Ranger truck', -9.75, 20.25, 1)


def wetland(board):
    pin = ('.#.', '###', '###', '###', '.#.')
    add_set(board, (
        ('Fen bird blind', blind(46, 32, 29, screened=True), 6.66, 24.6, 3, -.13, PINE),
        ('Blind viewing bench', lp.bench(23, WOOD), 6.5, 25.25, 1, 0, PINE),
        ('Fen viewing boardwalk', boardwalk(28, 39), 5.95, 25.2, 0, -.5, CHALK),
        ('Bird sighting ledger', station_desk(), 5.7, 25.8, 3, 0, FIELD),
        ('Bird survey trail sign', survey_marker(pin), 5.2, 23.7, 3, 0, FIELD),
        ('Fen marsh pelican', pelican(), 9.85, 25.65, 1, -.43, CHALK),
        ('Pelican haul out rock', lp.rough_rock(), 13.13, 26.4, 1, -.42, FEN),
        ('Fishing marsh pelican', pelican(fishing=True), 10.95, 27.3, 3, -.44, CHALK),
        ('Fen observation pier', boardwalk(15, 29), 7.4, 28.1, 1, -.5, CHALK),
        ('Bird count binoculars', field_scope(), 8.36, 28.15, 1, 1.59, FIELD),
        ('Basking turtle log', turtle_roost(), 10.8, 30.2, 1, -.22, FEN),
        ('Fen driftwood branch', lp.post(17, WOOD, DARK, arm=True), 7.2, 27.6, 3, -.19, FEN),
        ('Fen high reeds', reed_mats(13, 22), 7.4, 23.35, 1, -.20, FEN),
        ('Fen low rushes', reed_mats(8, 15), 7.25, 27.75, 0, -.20, FEN),
        ('Fen floating pads', floating_leaves(), 9.7, 28.35, 0, -.38, FEN),
        ('Shoreline ledge', lp.rough_rock(), 7.0, 29.4, 1, -.28, FEN),
        ('Fen channel staff gauge', flow_gauge(), 5.2, 30.6, 1, -.1, CHALK),
        ('Water collection station', station_desk(), 5.15, 32.25, 3, 0, FIELD),
        ('Sampling jar cradle', lp.produce_bin(GLASS), 5.15, 32.25, 3, .95, FIELD),
        ('Water station canopy', blind(27, 29, 25, screened=False), 5.65, 32.25, 1, 0, CHALK),
        ('Wetland spill channel stone', lp.panel(26, 7, 6, STONE, JOINT, rows=True), 7.0, 34.0, 1, -.45, FEN),
        ('Gravel switchback marker', survey_marker(('.#.', '##.', '###', '##.', '.#.')), 1.85, 31.05, 3, 0, FIELD),
        ('Fen gravel edge marker', lp.post(7, DARK, MARK), 4.45, 28.1, 0, 0, PINE),
    ))
    for x, z, turn in ((13, 24, 1), (12.3, 29.2, 2), (10.4, 31.2, 3), (7.45, 32.25, 0)):
        board.place('Fen high reeds', x, z, turn, -.20)
        board.place('Fen low rushes', x + 1.0, z + .5, turn, -.20)
    board.place('Fen marsh pelican', 12.15, 25.1, 2, -.47)
    board.place('Shoreline ledge', 11.45, 22.81, 1, -.36)
    board.place('Meadow brush island', 11.98, 22.78, height=.35)
    board.place('Alder tree', 13.7, 26.1)
    board.place('Meadow brush island', 13.65, 28.0)
    for x, z, turn in ((12.0, 21.8, 0), (14.75, 22.55, 1), (15.8, 25.65, 1),
                       (15.6, 28.8, 1), (15.9, 32.35, 1)):
        board.place('Fen boundary boulder', x, z, turn)
        board.place('Alder tree', x + .8, z - .7, turn)
    for x, z in ((4.45, 23.4), (4.45, 29.7), (4.45, 34.1)):
        board.place('Fen gravel edge marker', x, z)
    for x, z in ((6.05, 30.9), (8.8, 33.5), (12.6, 30.9), (13.0, 25.9), (5.7, 24.3)):
        board.place('Stream reeds', x, z, height=-.18)


def survey_camp(board):
    add_set(board, (
        ('Main survey trail portal', lp.deep_arch(32, 31, 9, 20, WOOD, MARK), 0, 35.55, 0, 0, PINE),
        ('Woodland permit gate', lp.deep_arch(30, 29, 9, 19, WOOD, MARK), -6, 35.55, 0, 0, CHALK),
        ('Survey station boundary fence', lp.fence(38, 18, WOOD, mesh=True), -3, 35.55, 0, 0, PINE),
        ('Survey station boundary post', lp.post(22, WOOD, MARK), 1.45, 35.15, 0, 0, FIELD),
        ('Woodland permit box', lp.case(9, 15, 6, BODY, DARK, screen=True), -6.87, 34.55, 1, 0, FIELD),
        ('Hollow approach marker', survey_marker(('.#.', '###', '#.#', '###', '.#.')), -5.2, 37.7, 1, 0, FIELD),
        ('Field archive cabin', blind(62, 36, 37, screened=False), 0, 43.2, 2, 0, FIELD),
        ('Archive specimen counter', station_desk(), -1.8, 42.2, 1, 0, CHALK),
        ('Submit survey desk', station_desk(), 0, 43.8, 2, 0, FIELD),
        ('Archive folder crate', lp.latched_case(16, 11, 13, BODY, METAL, MARK), -2.7, 42.5, 0, 0, FIELD),
        ('Archive record shelves', lp.cargo_rack(MARK), -1.55, 44.05, 2, 0, CHALK),
        ('Ranger camp lantern', lp.post(29, WOOD, MARK, arm=True), 1.95, 41.5, 2, 0, FIELD),
        ('Boardwalk support sleeper', boardwalk(23, 24), -6, 37.0, 0, -.5, PINE),
        ('Fen survey banner', survey_marker(('###', '#..', '###', '..#', '###'), height=37, width=19),
         .85, 43.25, 2, 0, FIELD),
    ))
    for x in (-11, -9, 3, 6.8, 10.55):
        board.place('Survey station boundary fence', x, 35.55)
    for x, z in ((-4.2, 41.35), (4.6, 40.8), (8.2, 37.5), (8.2, 43), (-6.15, 43.5)):
        board.place('Tall pine', x, z)
        board.place('Meadow brush island', x + .8, z - .4)
    board.place('Field station', 1.8, 43.25, 2)


def gameplay(board):
    p = board.prop_id
    point = board.point
    board.entry, board.exit = 'creek_approach', 'survey_archive'
    board.use = 'Record the wetland sightings. Take a water reading or get the keeper’s permit, then submit the survey.'
    point('creek_approach', 'East bank trailhead', 16.0, 13.0,
          actions=(action('inspect', assets=(p('East ridge trail marker'), 'habitat_compass')),))
    point('trail_junction', 'Fen trail junction', 0, 20.5,
          actions=(action('gather', assets=('fen_route_map', p('Observation trail notice')), reward='route_mapped'),))
    point('survey_supplies', 'Collect the observation kit', -5.25, 23.5,
          actions=(action('resupply', assets=('sighting_scope', 'stream_test_case', 'field_notebook', 'fen_ranger',
                                             p('Survey delivery table')),
                          requires=('route_mapped',), reward='survey_kit_ready'),))
    point('feeding_pen', 'Log the deer forage check', -6.7, 26.45,
          actions=(action('inspect', assets=('feeding_measure', p('Reed fen deer'), p('Filled animal feed tray')),
                          requires=('survey_kit_ready',), reward='feed_logged'),))
    point('reed_blind', 'Record pelicans from the hide', 4.85, 25.2,
          actions=(action('observe', assets=('sighting_scope', p('Fen bird blind'), p('Fen marsh pelican'),
                                             'wetland_observer'),
                          requires=('survey_kit_ready',), reward='bird_counted'),))
    point('turtle_bank', 'Record the turtle basking log', 3.7, 28.25,
          actions=(action('observe', assets=('field_notebook', p('Basking turtle log')),
                          requires=('survey_kit_ready',), reward='turtles_counted'),))
    point('staff_gauge', 'Read the channel depth', 3.85, 30.5,
          actions=(action('measure', assets=(p('Fen channel staff gauge'), 'stream_test_case'),
                          requires=('survey_kit_ready',), reward='depth_logged'),))
    point('water_sample_station', 'Collect the water sample', 3.85, 32.25,
          actions=(action('gather', assets=('water_sample', p('Water collection station')),
                          requires=('depth_logged',), reward='water_logged'),))
    point('keeper_checkpoint', 'Review the path with the keeper', -6.2, 31.5,
          actions=(action('trade', assets=('ranger_marker', 'habitat_keeper', p('Survey sample drying rack')),
                          requires=('feed_logged', 'bird_counted'), reward='keeper_permit'),))
    point('main_trail_gate', 'Open the main survey trail', 0, 34.55,
          actions=(action('unlock', assets=(p('Main survey trail portal'), 'water_sample'),
                          requires=('water_logged', 'bird_counted'), reward='main_trail_open'),))
    point('woodland_gate', 'Show the keeper’s permit', -6, 34.55,
          actions=(action('unlock', assets=(p('Woodland permit box'), 'ranger_marker'),
                          requires=('keeper_permit',), reward='woodland_trail_open'),))
    point('archive_intake', 'Assemble the sightings', 0, 40.0,
          actions=(action('report', assets=('field_notebook', 'observation_radio', p('Archive specimen counter')),
                          requires=('bird_counted', 'turtles_counted'), reward='survey_filed'),))
    point('survey_archive', 'Submit the fen survey', 0, 42.65,
          actions=(action('extract', assets=('field_recorder', p('Submit survey desk'), 'survey_battery'),
                          requires=('survey_filed',)),))
    board.link('creek_approach', 'trail_junction', [17.25, 0, 15.35], [17.45, 0, 16.75],
               [16.75, 0, 17.25], [15.25, 0, 17.75])
    board.link('trail_junction', 'survey_supplies', [-2.4, 0, 23.95], [-4.2, 0, 23.95])
    board.link('trail_junction', 'reed_blind', [3.3, 0, 22.6], [3.9, 0, 25.2])
    board.link('survey_supplies', 'feeding_pen', [-5.6, 0, 25.0])
    board.link('feeding_pen', 'keeper_checkpoint')
    board.link('reed_blind', 'turtle_bank', [3.65, 0, 26.4])
    board.link('turtle_bank', 'staff_gauge')
    board.link('staff_gauge', 'water_sample_station')
    board.link('water_sample_station', 'main_trail_gate', [2.0, 0, 33.3])
    board.link('trail_junction', 'main_trail_gate')
    board.link('keeper_checkpoint', 'woodland_gate')
    board.link('main_trail_gate', 'archive_intake', requires=('main_trail_open',))
    board.link('woodland_gate', 'archive_intake', [-6, 0, 39.55], requires=('woodland_trail_open',))
    board.link('archive_intake', 'survey_archive')


def extend(board):
    board.environment.update(zenith='#477e9d', horizon='#9bb6b1')
    terrain(board)
    reception(board)
    wetland(board)
    survey_camp(board)
    gameplay(board)
    for asset, x, z, yaw, pose in (
        ('fen_ranger', -5.25, 22.38, 180, ('Reach', .36)),
        ('habitat_keeper', -6.74, 31.3, 270, None),
        ('wetland_observer', 6.05, 32.22, 270, ('Reach', .36)),
        ('field_recorder', -.62, 42.95, 56, ('Reach', .36)),
    ):
        board.stage_actor(asset, x, z, yaw=yaw, pose=pose)
    board.stage_work('wetland_observer', 'CountBirds', 8.04, 28.16, yaw=90,
                     left=(8.35, 1.65, 28.04), right=(8.35, 1.65, 28.28))
    board.stage_work('habitat_keeper', 'LiftGrain', -7.51, 27.69, yaw=-62,
                     right=(-7.94, 1.24, 27.92), pitch=12)
    board.light(-8.6, 2.58, 29.4, '#fff0ca', 1500, 6)
    board.light(8.8, 2.58, 29.4, '#ffe5c0', 970, 6)
    board.light(-5.4, 2.75, 21.95, '#ffe0af', 390, 7)
    board.light(6.4, 2.7, 25.2, '#e7eabc', 320, 6)
    board.light(-8.8, 2.3, 27.4, '#ffe4b9', 570, 7)
    board.light(9.6, 3.4, 26.2, '#e4edcc', 540, 7)
    board.light(.3, 3.2, 42.95, '#ffe1ad', 670, 7)
    board.shot('Fen bird count and sampling', [8.84, 2.24, 31.75], [9.5, 1.03, 26.59])
    board.shot('Marsh deer feeding check', [-4.45, 2.10, 30.38], [-9.08, 1.23, 27.86])
    board.shot('Ranger archive intake', [3.7, 2.65, 38.7], [-.5, 1.9, 42.3])
