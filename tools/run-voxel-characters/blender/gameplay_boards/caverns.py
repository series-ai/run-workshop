"""Emberdeep mine, foundry, and treasure vault."""

import build_level_props as lp
import level_vehicles as v
import voxchar as vk
from creature_kit import Sculpt
from level_geometry import box
from . import cavern_districts as district
from . import cavern_dressing
from . import cavern_masonry as stone
from . import cavern_waterworks as waterworks
from .common import (BODY, DARK, GLOW, GREEN, JOINT, MARK, METAL, STONE, WOOD, action,
                     arch, color_profile, create_board, floors, glyph, rubble, shelf)

VEIN = vk.vox('visor', 0.4)
GOLD = vk.vox('trim', 0.4)


def crystals(spires):
    shape = rubble(21, 16, face=DARK, seed=4)
    for x, z, height, width in spires:
        for y in range(3, height):
            taper = max(1, width - max(0, y - height * 2 // 3))
            shift = y // 6
            box(taper, 1, max(1, taper - 1), VEIN, x=x + shift, y=y, z=z, sculpt=shape)
            box(1, 1, max(1, taper - 2), GREEN, x=x + shift - taper // 2, y=y, z=z, sculpt=shape)
        box(2, 2, 2, GLOW, x=x + height // 6, y=height - 3, z=z, sculpt=shape)
    return shape


def bridge_span():
    shape = box(80, 4, 34, STONE)
    for x in range(-37, 39, 6):
        box(1, 1, 31, JOINT, x=x, y=3, sculpt=shape)
    for z in (-16, 16):
        box(80, 2, 2, MARK, y=4, z=z, sculpt=shape)
        for x in (-37, -20, -3, 14, 31):
            box(2, 8, 2, METAL, x=x, y=4, z=z, sculpt=shape)
        box(80, 1, 2, METAL, y=10, z=z, sculpt=shape)
    return shape


def treasury():
    shape = box(45, 6, 26, STONE)
    for x, y, z in ((-14, 6, 2), (-4, 6, -5), (11, 6, 2), (13, 9, -3),
                    (-12, 10, 2), (1, 6, 5), (-1, 9, -6)):
        box(8, 3, 5, GOLD, x=x, y=y, z=z, sculpt=shape)
        box(6, 1, 4, MARK, x=x, y=y + 2, z=z, sculpt=shape)
    return shape


def rail(width):
    shape = Sculpt()
    for z in (-5, 5):
        box(width, 1, 1, METAL, z=z, sculpt=shape)
    for x in range(-width // 2 + 2, width // 2, 5):
        box(3, 1, 16, WOOD, x=x, sculpt=shape)
        for z in (-5, 5):
            box(1, 1, 1, METAL, x=x, y=1, z=z, sculpt=shape)
    return shape


def mine_cart(loaded=False):
    body = lp.ore_skip(GOLD if loaded else None)
    shape = Sculpt()
    for x, (lo, hi), z, code, filled in body.ops:
        shape.ops.append((x, (lo + 2, hi + 2), z, code, filled))
    rig = v.Vehicle(shape, radius=0.2)
    tracks = []
    for axle, z in (('front', 5), ('rear', -5)):
        for side, x in (('left', -6), ('right', 6)):
            pivot = (x, 2, z)
            name = f'{axle}_{side}_spin'
            wheel = v.parked_wheel(pivot, 2, wagon=False, bevel=False, hub=False)
            rig.parts.append(v.Part(name, pivot, wheel))
            tracks.append(v.angle_track(name, 0, (0, 0.25, 0.5, 0.75, 1), (0, 90, 180, 270, 360)))
    rig.clips['Drive'] = tracks
    return rig


def shaft_lift():
    frame = lp.deep_arch(28, 34, 14, 20, METAL, GOLD)
    deck = box(18, 2, 15, WOOD)
    for x in (-8, 7):
        box(1, 10, 15, METAL, x=x, y=2, sculpt=deck)
    rig = v.Vehicle(frame, [v.Part('cage_lift', (0, 0, 0), deck)])
    rig.clips['Raise cage'] = [v.offset_track('cage_lift', 1, (0, 0.7, 2, 2.7, 4), (0, 0, 2.4, 2.4, 0))]
    return rig


def dwarf_gate():
    shape = arch(66, 43, 14, 27)
    for x in (-24, -17, 17, 24):
        box(3, 31, 3, MARK, x=x, y=2, z=7, sculpt=shape)
    glyph(shape, ('#.#', '.#.', '#.#', '###'), -3, 33, 7, GOLD, 3)
    return shape


def make_board():
    board = create_board('caverns', 'Emberdeep', 'Restore the old lift and recover the royal seal.',
                         ('#918b83', '#354046', '#66696d', '#ae6743', '#d5a052', '#a4a6a3',
                          '#ff9a3d', '#7bc6cf', '#282631', '#497e79'),
                         color_profile('#211e31', '#292737', '#dbe0d9', strength=2.1, direction=(-4, 8, 5)),
                         'hoist', 'shaft')
    a, place = board.add, board.place
    left = [(x, z) for x in (-28, -20, -12) for z in range(-20, 21, 8)]
    right = [(x, z) for x in (12, 20, 28) for z in range(-20, 21, 8)]
    rail_bed = [(-28, z) for z in (-12, -4, 4, 12)]
    foundry = [(x, z) for x in (-20, -12) for z in (-12, -4)]
    vault_yard = [(x, z) for x in (20, 28) for z in (-20, -12)]
    worked = [(-20, 4), (-20, 12), (20, -4), (20, 4), (20, 12)]
    natural = [p for p in left + right if p not in rail_bed + foundry + vault_yard + worked]
    floors(board, 'Veined cavern floor', stone.slag_floor(), natural)
    floors(board, 'Worked basalt floor', stone.flags(8), worked)
    floors(board, 'Cinder rail bed', district.rail_apron(), rail_bed)
    floors(board, 'Foundry casting floor', district.foundry_floor(), foundry)
    board.set_palette('Foundry casting floor', leather='#b3755e', skin='#906858', metal='#99a39e')
    floors(board, 'Malachite court pavement', district.vault_pavers(), vault_yard)
    board.set_palette('Malachite court pavement', primary='#406269', detail='#527b75', trim='#b69a69')
    for i, x in enumerate((-4, 4)):
        floors(board, ('Molten current', 'Cooling lava skin')[i], stone.lava_tile(i + 3),
               [(x, z) for z in range(-20, 21, 8)], y=-1.6)
    for label in ('Molten current', 'Cooling lava skin'):
        board.set_palette(label, leather='#843115', trim='#e56115', accent='#ff9d30',
                          primary='#382933', secondary='#4b3441')
    a('Cooled lava spur', stone.bank_tongue(), -7.2, -18.3, 1, -1.55)
    for x, z, turn in ((-7.4, -13.3, 1), (-6.8, 1.2, 1), (-7.7, 6.3, 1), (-6.5, 19.4, 1),
                       (6.7, -19.8, 3), (7.4, -2.1, 3), (6.8, 2.7, 3), (7.3, 7.2, 3),
                       (7.2, 17.5, 3)):
        place('Cooled lava spur', x, z, turn, -1.55)
    a('Chasm lip', stone.basalt(78, 13, 11, 45), -8.5, -20, 1, -1.9)
    for x, turn in ((-8.5, 1), (8.5, 3)):
        for z in range(-20, 21, 8):
            if (x, z) != (-8.5, -20):
                place('Chasm lip', x, z, turn, -1.9)
    fill = box(80, 10, 8, DARK)
    for x in range(-36, 39, 10):
        box(6, 2, 10, STONE, x=x, y=7, sculpt=fill)
    a('Lava gorge backing', fill, -8.15, -20, 1, -1.3)
    for x, turn in ((-8.15, 1), (8.15, 3)):
        for z in range(-20, 21, 8):
            if (x, z) != (-8.15, -20):
                place('Lava gorge backing', x, z, turn, -1.3)
    a('Sheet basalt escarpment', stone.basalt(85, 49, 23, 3), -29, -23)
    a('Fractured cave wall', stone.basalt(83, 64, 21, 9), 29, 23, 2)
    for x in (-15, 13, 21, 29):
        place('Sheet basalt escarpment', x, -22.8)
    for x in (-29, -12, 13):
        place('Fractured cave wall', x, 23, 2)
    for z in (-16, 12, 19):
        place('Sheet basalt escarpment', -31, z, 1)
    for z in (-16, -8, 19):
        place('Fractured cave wall', 31.3, z, 3)
    a('Folded ironstone seam', district.ore_face(), -31.2, -7.3, 1)
    for x, z, turn in ((-31.1, 2.5, 1), (-23, -22.9, 0), (30.8, 2, 3), (31.1, 11, 3)):
        place('Folded ironstone seam', x, z, turn)
    board.set_palette('Folded ironstone seam', skin='#797c80', primary='#68545b',
                      leather='#ba6650', trim='#de995f')
    a('Calcite organ pipes', district.flowstone(), -12.4, 17.2)
    for x, z, turn in ((-25.2, 17.3, 1), (-14.3, 21, 2), (25.4, 20.9, 3),
                       (28.3, -1.8, 2), (12.2, -13.4, 1)):
        place('Calcite organ pipes', x, z, turn)
    board.set_palette('Calcite organ pipes', skin='#c1beac', primary='#799390')
    a('Lava source tunnel', stone.lava_tunnel(), 0, -22.5, height=-1.6)
    place('Lava source tunnel', 0, 22.5, 2, -1.6)
    a('Lava spring', stone.lava_spring(), 0, -24.0, height=-1.6)
    place('Lava spring', 0, 24.0, 2, -1.6)
    board.light(-1, -0.2, -21.4, '#ff862f', 340, 7)
    board.light(2.1, -0.4, 20.9, '#ff9d42', 290, 7)
    a('Cavern ceiling ledge', stone.cavern_crown(71), -27.6, -19, height=3.6)
    for x, z, turn, bottom in ((-18, -20.2, 0, 3.7), (-10, -21.7, 0, 3.5),
                               (12.5, -20.4, 0, 4.1), (22, -20.6, 0, 3.8), (28, -17.3, 3, 3.8),
                               (-28.3, -10.8, 1, 3.6),
                               (-28.4, 16.9, 1, 3.7), (-18.3, 20.1, 2, 4.0),
                               (18, 20, 2, 4.3), (28.2, 18.2, 3, 3.7)):
        place('Cavern ceiling ledge', x, z, turn, bottom)
    a('Basalt column cluster', stone.basalt(25, 75, 17, 13), -10.6, 20.8)
    for x, z, turn in ((-17, -13.7, 1), (15, -18, 1)):
        place('Basalt column cluster', x, z, turn)
    a('Copper ore rubble', rubble(24, 20, face=MARK, seed=4), -25, -7.2)
    a('Slate rubble', rubble(31, 19, face=DARK, seed=23), 21.3, -4.4)
    a('Tall crystal seam', crystals(((-7, 2, 22, 7), (0, -2, 31, 8), (6, 3, 17, 6))), -23, 19)
    a('Low crystal fan', crystals(((-7, 1, 14, 6), (0, 0, 19, 7), (7, 1, 12, 5))), -19, 16.8, 1)
    for x, z, turn in ((-27, 14, 2), (-15, 18, 3), (25.7, 15.8, 0), (27, -19, 2), (-10, -8, 1)):
        place('Low crystal fan', x, z, turn)
    a('Dwarf mine gate', dwarf_gate(), -23, 17)
    a('Stone lintel with runes', stone.hall_rib(83, 46), 23, -10.9)
    a('Mine hoist gantry', lp.repair_gantry(), -27, 18.5)
    a('Hoist counterweight', lp.ore_skip(METAL), -25.8, 19.1, height=1.5)
    a('Haul rail', rail(80), -27.8, 5, 1)
    for z in (-11, -3, 13):
        place('Haul rail', -27.8, z, 1)
    cart = board.vehicle('Ore cart with copper', 'cargo-minecart', mine_cart(loaded=True), -27.8, 3, 1)
    board.vehicle('Empty ore cart', 'minecart', mine_cart(), -27.8, -6, 1)
    a('Timber mine brace', arch(34, 30, 7, 25, face=WOOD), -27.8, 9.5)
    a('Copper ore tipple', district.tipple(), -27.8, 0.4)
    board.set_palette('Copper ore tipple', leather='#ab704d', detail='#467b78', trim='#d78c55')
    a('Tipple inspection lamp', stone.pendant(), -26.7, 2.2, height=2.55)
    board.light(-26.7, 2.65, 2.3, '#ffcc8b', 640, 7)
    a('Timber stockpile', lp.pallet(23, 14, WOOD, DARK), -24.8, 1.8)
    a('Rope spool', lp.cooper_barrel(), -25.1, 2.9)
    a('Ore grading rack', shelf(30, 12, 24), -18.7, 6, 2)
    a('Charcoal bin', lp.crate(23, 14, 16, DARK, METAL), -15.1, -12.9)
    a('Smelter with firebox', stone.firebox(), -15, -12.2)
    board.set_palette('Smelter with firebox', leather='#ad795c', accent='#ffc066', trim='#c08752',
                      primary='#a33f27', visor='#f18c2c')
    a('Pig iron casting moulds', district.casting_moulds(), -12.9, -7.55)
    board.light(-13.2, 1.0, -7.3, '#ff9e51', 210, 4)
    a('Forging anvil', stone.smiths_anvil(), -17.5, -8.6)
    a('Cooling trough', stone.cooling_bath(), -10.9, -10.35, 1)
    a('Tilting crucible', district.pouring_crucible(), -12.9, -9.2)
    board.set_palette('Tilting crucible', leather='#a95237', accent='#ffb04a')
    a('Forge workbench', lp.counter(27, 12, WOOD, METAL, shelf=True), -10.9, -12.8, 3)
    a('Bellows frame', lp.truss(), -12.9, -11.8, 2)
    a('Coal scuttle', lp.feed_bucket(), -17, -10.5)
    a('Lava bridge deck', bridge_span(), -4, -6, height=-0.4)
    place('Lava bridge deck', 4, -6, height=-0.4)
    a('Suspended haul footbridge', district.suspension_span(), -4, 12, height=-0.2)
    place('Suspended haul footbridge', 4, 12, 2, height=-0.2)
    a('Bridge arch spandrels', stone.bridge_spandrel(), -4, -6, height=-1.55)
    place('Bridge arch spandrels', 4, -6, height=-1.55)
    a('Bridge lamp standard', stone.sill_lamp(), -7.6, -7.65)
    for x, z in ((0, -4.35), (7.6, -7.65)):
        place('Bridge lamp standard', x, z)
    for x in (-7.6, 0, 7.6):
        board.light(x, 2.05, -7.1, '#ffb871', 180, 6)
    a('Stone bridge support', stone.basalt(24, 16, 24, 12), -4, -6, height=-1.8)
    place('Stone bridge support', 4, -6, height=-1.8)
    a('Crossing winding wheel', district.winding_wheel(), 11.25, -0.1, 3, 0.3)
    board.set_palette('Crossing winding wheel', leather='#ae6544', trim='#d3964c', detail='#5d9683')
    a('Winding drum bearings', district.drum_bearings(), 11.25, -0.1, 3)
    a('Coiled steel winding drum', district.winding_drum(), 12.95, -0.1, 3, 1.9)
    a('Counterweight sheave', district.return_sheave(), 12.9, 7.0)
    a('Overhead haul cable', district.haul_cable(), 12.9, 3.5, height=4.6)
    a('Cable brake house', district.brake_house(), 14.65, 1.2, 3)
    board.set_palette('Cable brake house', detail='#43928a', trim='#9d7458', leather='#99603f')
    board.light(10.2, 3.5, -2.2, '#f5bd81', 760, 8)
    a('Dwarf gate control', lp.case(12, 15, 10, DARK, GOLD, screen=True), 10, -8.4)
    a('Vault door', stone.vault_seal(), 23, -16.4)
    a('Vault treasure dais', treasury(), 23, -14.6)
    a('Treasure chest', lp.latched_case(16, 12, 12, WOOD, GOLD, MARK), 19.9, -15.2)
    a('Stone coffer', lp.crate(17, 10, 10, STONE, MARK), 25.2, -15.2, 2)
    a('Tally board', lp.panel(15, 17, 3, DARK, GOLD), 24.6, -12.6, 3)
    a('Forge transept pillar', lp.broken_column(), -13.3, -3.8)
    a('Stone braced door', dwarf_gate(), 24, 18, 2)
    a('Exit winch', lp.ore_hopper(), 26.8, 19.5)
    lift = board.vehicle('Exit lift cage', 'shaft-lift', shaft_lift(), 22.2, 19.8)
    a('Brass mine lantern', stone.sill_lamp(), -22.2, 13)
    for x, z in ((-25.1, 10.3), (-22.7, -6.6), (-12, -6), (-9.4, 12), (9.4, 12), (9.4, -7.8),
                 (26.3, -10.5), (17.2, 8), (26, 15)):
        place('Brass mine lantern', x, z)
        board.light(x, 2.15, z, '#ffc985', 18, 5)
    for x in (-6, 0, 6):
        for z in (-16, -3, 10, 20):
            board.light(x, -0.25, z, '#ff742d', 60, 9)

    a('Split basalt monolith', stone.basalt(39, 89, 28, 51), -28.3, -15.5, 1)
    for x, z, turn in ((-27.6, 13.8, 0), (23, -20.8, 1), (28.4, 18.4, 1)):
        place('Split basalt monolith', x, z, turn)
    a('Obsidian stepped shelf', stone.basalt(48, 23, 41, 53), -24.3, -17.3, 1)
    for x, z, turn in ((-27.8, -10, 2), (-12, 17, 3), (12, 19.3, 2), (28.1, 5.8, 0),
                       (15.2, -17, 3), (28.4, -13.7, 0), (-12, 6, 0)):
        place('Obsidian stepped shelf', x, z, turn)
    a('Hanging basalt shelf', stone.basalt(45, 11, 30, 72), -27.4, 16, 1, 3.9)
    place('Hanging basalt shelf', -28, -14, 2, 3.7)
    place('Hanging basalt shelf', 28.5, -14, 1, 4.1)
    place('Hanging basalt shelf', 28.2, 17.8, 3, 4.2)
    a('Vault pilaster', lp.panel(15, 43, 14, STONE, MARK, rows=True), 19, -17.2)
    place('Vault pilaster', 27, -17.2)
    a('Vault side masonry', lp.panel(51, 31, 9, JOINT, METAL, rows=True), 27.4, -14.1, 1)
    place('Vault side masonry', 18.6, -14.1, 3)
    a('Vault crown arch', stone.hall_rib(88, 47), 23, -16.9)
    a('Chest sorting table', lp.counter(24, 13, WOOD, GOLD), 19.3, -14.4, 1)
    a('Royal seal warden', waterworks.warden(), 20.25, -12.45)
    place('Royal seal warden', 25.75, -12.45)
    board.set_palette('Royal seal warden', skin='#a9a9a8', primary='#596670',
                      trim='#bb986b', visor='#91cae4')
    board.light(20.6, 2.45, -11.4, '#e4d5b3', 320, 6)
    board.light(25.4, 2.45, -11.4, '#bfd6df', 320, 6)
    a('Foundry ashlar wall', stone.wall_bay(), -19.4, -15.2)
    for x, z, turn in ((-14.8, -15.2, 0), (-10.2, -15.2, 0), (-20.8, -12.7, 1),
                       (-10.2, -14.0, 3), (-10.2, -9.4, 3),
                       (19.5, -16.9, 0), (24.1, -16.9, 0), (27.9, -15.3, 3)):
        place('Foundry ashlar wall', x, z, turn)
    a('Forge roof rib', stone.hall_rib(85, 54), -15, -7.45)
    place('Forge roof rib', -15, -11.4)
    place('Forge roof rib', -15, -14.8)
    a('Smoke gallery roof', district.forge_monitor(), -15, -11.1, height=5.4)
    board.set_palette('Smoke gallery roof', detail='#397b75', trim='#a36e4a')
    a('Vault stone ceiling', stone.roof_bay(), 23, -13.8, height=4.65)
    a('Copper draught main', stone.draught_main(), -11.2, -11.3)
    place('Copper draught main', -18.8, -11.55)
    a('Foundry pressure regulator', stone.pressure_regulator(), -12.2, -11.3, 0)
    a('Forge pendant', stone.pendant(), -12.6, -8.3, height=3.45)
    place('Forge pendant', -17.5, -10.3, height=3.45)
    for x, z in ((-12.6, -8.3), (-17.5, -10.3)):
        board.light(x, 3.6, z, '#ffe0a0', 740, 8)
    board.light(-14.95, 1.35, -10.15, '#ff973d', 780, 8)
    board.light(-15.3, 2.6, -9.5, '#ffd498', 380, 8)
    board.light(-18.5, 3.95, -8.0, '#95c9c4', 260, 7)
    board.light(22.2, 3.1, -15.1, '#ffce76', 600, 8)
    board.light(24.9, 3.6, -12.4, '#94c2c0', 280, 6)
    a('Bioluminescent crystal pocket', crystals(((-5, 1, 14, 7), (3, 2, 19, 8))), -29, -19.5)
    for x, z, turn in ((-25, -17, 1), (-28.5, 10.8, 2), (-11, 8.1, 1), (13.6, 8.8, 0),
                       (26.7, -4.3, 2), (28.3, 8.6, 0), (17.6, 19.6, 1), (17.1, -18.2, 0)):
        place('Bioluminescent crystal pocket', x, z, turn)
        board.light(x, 1.7, z, '#63b6d7', 15, 5)
    a('Dwarf storage jar', lp.drum(11, 13, BODY, GOLD), -24.8, 14.7)
    for x, z, turn in ((-29, 16.2, 2), (-17.7, -11, 1), (-12.2, -12.3, 0),
                       (18.9, -15.4, 3), (25.5, -12.4, 2), (27, 17, 1)):
        place('Dwarf storage jar', x, z, turn)
    a('Royal seal standard', stone.hanging_standard(), 20.1, -15.8, height=1.4)
    place('Royal seal standard', 25.9, -15.8, height=1.4)
    board.set_palette('Royal seal standard', detail='#3555a4', trim='#f0bb74')
    board.set_palette('Vault door', detail='#257c76', trim='#dca65a')
    a('Brazier reward plinth', stone.brass_sconce(), 21.2, -14)
    place('Brazier reward plinth', 24.8, -14)
    board.light(21.2, 2.75, -13.9, '#ffbb75', 430, 6)
    board.light(24.8, 2.75, -13.9, '#ffbb75', 430, 6)
    board.light(23, 2, -13.1, '#ffc67d', 49, 9)
    board.light(-15.2, 2.4, -7.7, '#ffac64', 55, 9)

    board.point('hoist', 'Hoist arrival', -23, 14.6, actions=(
        action('player-spawn'), action('loadout', assets=('pickaxe', 'mine_lantern', 'rope_bundle'))))
    board.point('rail', 'Ore rail', -24, 5.1, actions=(
        action('escort', assets=('dwarf_miner', cart), reward='ore_cart'),
        action('pickup', assets=('copper_ore',))))
    board.point('crystal', 'Crystal galleries', -18, 15, actions=(
        action('gather', assets=('glow_crystal',), reward='glow_shard'),))
    board.point('forge', 'Dwarf forge', -16, -5.6, actions=(
        action('craft', assets=('dwarf_smith', 'forge_hammer', 'rune_axe'), requires=('ore_cart',), reward='forge_key'),))
    board.point('bridge', 'Lava bridge', -9.8, -6, actions=(
        action('hazard', bounds=[[-8, -1.3, -24], [8, -0.3, 24]], hazard='lava'),
        action('activate', assets=(board.prop_id('Dwarf gate control'),), requires=('forge_key',), reward='bridge_open')))
    board.point('watch', 'Far bank watch', 12, -6, actions=(
        action('encounter', assets=('dwarf_guard', 'iron_shield')),))
    board.point('vault', 'Royal vault', 23, -10, actions=(
        action('unlock', assets=(board.prop_id('Vault door'),), requires=('bridge_open',), reward='vault_unsealed'),
        action('objective', assets=('royal_seal',), requires=('vault_unsealed',), reward='royal_seal_recovered')))
    board.point('shaft', 'Exit shaft', 24, 15, actions=(
        action('extract', requires=('royal_seal_recovered',), assets=(board.prop_id('Exit winch'), lift)),))
    board.link('hoist', 'rail', [-23, 0, 9])
    board.link('hoist', 'crystal')
    board.link('rail', 'forge', [-22, 0, -4])
    board.link('crystal', 'rail', [-20, 0, 8])
    board.link('forge', 'bridge', [-12, 0, -5.2])
    board.link('bridge', 'watch', [0, 0, -6], requires=('bridge_open',))
    board.link('crystal', 'shaft', [-9, 0, 12], [9, 0, 12], requires=('glow_shard',), traversal='rope')
    board.link('watch', 'vault', [17, 0, -9])
    board.link('watch', 'shaft', [18.2, 0, -4.8], [18.2, 0, 4.6], [21, 0, 12])
    board.shot('Board overview', [74, 76, 99], [0, 0, 24])
    board.shot('Ore rail and forge', [-18.55, 1.8, -2.6], [-14.45, 2.15, -10.75])
    board.shot('Lava crossing', [-11.0, 1.9, -2.3], [11.5, 2.3, -3.1])
    board.shot('Royal vault', [22.2, 1.8, -7.15], [23, 2.05, -15.5])
    board.shot('Ore loading bay', [-23.1, 1.85, 8.1], [-27.7, 2.15, 0.45])
    board.shot('Winding engine', [1.3, 1.75, -6.2], [11.7, 2.8, 0.3])
    waterworks.add_waterworks(board)
    cavern_dressing.dressing(board)
    cavern_dressing.shift_work(board)
    cavern_dressing.survey_chamber(board)
    return board
