"""The reservoir district beyond the original Emberdeep mine."""

from random import Random

import voxchar as vk
from creature_kit import Sculpt
from level_geometry import box
from . import cavern_masonry as stone
from .common import DARK, GLASS, GLOW, GREEN, JOINT, MARK, METAL, STONE, WOOD, action, floors

LIME = vk.vox('skin', 0.5)
SLATE = vk.vox('primary', -0.2)
COPPER = vk.vox('trim', -0.4)
WATER = vk.vox('visor', -0.3, mottle=False)
FOAM = vk.vox('visor', 0.95, mottle=False)


def reservoir():
    rng = Random(49)
    pool = box(80, 3, 80, WATER)
    for _ in range(11):
        x, z = rng.randint(-29, 29), rng.randint(-34, 34)
        width = rng.randint(5, 16)
        box(width, 1, 1, GLASS, x=x, y=2, z=z, sculpt=pool)
        box(width // 2, 1, 1, GREEN, x=x + 3, y=2, z=z + 1, sculpt=pool)
    return pool


def quay():
    shape = box(80, 12, 6, SLATE)
    for x in range(-40, 40, 10):
        shape.box((x, x + 8), (4, 9), (2, 3), STONE)
        shape.box((x, x + 9), (10, 12), (-4, 4), LIME)
    for x in (-30, 9):
        box(3, 7, 3, WOOD, x=x, y=11, sculpt=shape)
        box(4, 2, 4, METAL, x=x, y=15, sculpt=shape)
    return shape


def aqueduct_bay():
    arch = box(80, 54, 16, STONE)
    for low, top, half_width in ((0, 20, 31), (21, 27, 29), (28, 32, 26),
                                 (33, 36, 21), (37, 39, 16), (40, 41, 10)):
        arch.cut((-half_width, half_width - 1), (low, top), (-8, 7))
        for side in (-1, 1):
            x = side * (half_width + 2)
            box(5, top - low + 1, 19, LIME, x=x, y=low, sculpt=arch)
    for side in (-1, 1):
        for x, y in ((5, 41), (11, 40), (17, 38), (23, 35), (28, 30), (32, 23)):
            box(6, 4, 18, LIME, x=x * side, y=y, sculpt=arch)
    for y in (47, 52):
        box(80, 2, 19, SLATE, y=y, sculpt=arch)
    for x in (-37, 36):
        box(5, 25, 19, JOINT, x=x, sculpt=arch)
        box(6, 3, 21, LIME, x=x, y=19, sculpt=arch)
    box(80, 1, 12, WATER, y=53, sculpt=arch)
    for z in (-8, 7):
        box(80, 4, 3, LIME, y=53, z=z, sculpt=arch)
    return arch


def spillway():
    shape = Sculpt()
    flow = vk.vox('visor', 0.16, mottle=False)
    streak = vk.vox('accent', 0.43, mottle=False)
    splash = vk.vox('accent', 0.72, mottle=False)
    for gate, x in enumerate((-17, 0, 17)):
        box(15, 56, 10, DARK, x=x, sculpt=shape)
        box(15, 4, 20, LIME, x=x, y=51, z=5, sculpt=shape)
        for tier in range(9):
            y = 3 + tier * 5
            z = 12 + (8-tier) * (8-tier) // 18
            width = (15, 14, 12, 11, 14, 12, 12, 13, 14)[tier]
            edge = (0, 1, 2, 1, 0, 0, -1, 0, 0)[tier]
            box(width, 6, 3, flow, x=x + edge, y=y, z=z, sculpt=shape)
            for offset in (-4, 0, 4):
                drift = ((gate + offset + tier // 2) % 3) - 1
                tint = streak if (tier + offset + gate) % 4 else FOAM
                box(1 + (tier + gate) % 2, 5, 2, tint,
                    x=x + edge + offset + drift, y=y, z=z + 2, sculpt=shape)
        for dx, dz, width, depth, height in (
            (0, 18, 17, 6, 2), (-5, 21, 10, 4, 1), (5, 23, 11, 4, 1),
            (-4, 26, 7, 2, 1), (5, 29, 7, 1, 1), (0, 32, 5, 1, 1),
        ):
            box(width, height, depth, splash, x=x + dx, y=3, z=dz, sculpt=shape)
        for dx, y, z in ((-6, 7, 18), (-3, 8, 21), (2, 9, 19), (6, 6, 23), (3, 6, 24)):
            box(2, 2, 2, splash, x=x + dx, y=y, z=z, sculpt=shape)
    return shape


def beam_pump():
    shape = box(59, 3, 25, SLATE)
    for x in (-18, 18):
        box(15, 4, 18, STONE, x=x, y=3, sculpt=shape)
        box(11, 3, 14, LIME, x=x, y=7, sculpt=shape)
    for z in (-7, 7):
        for i in range(6):
            for side in (-1, 1):
                box(5, 7, 5, GREEN, x=side * (13 - i * 2), y=3 + i * 6, z=z, sculpt=shape)
    box(12, 7, 20, COPPER, y=36, sculpt=shape)
    for step in range(11):
        x = -25 + 5 * step
        box(6, 5, 7, GREEN, x=x, y=33 + step, sculpt=shape)
        box(6, 1, 8, MARK, x=x, y=38 + step, sculpt=shape)
    for x, y in ((-24, 34), (24, 43)):
        box(2, y - 18, 2, METAL, x=x, y=18, sculpt=shape)
        box(9, 15, 9, GREEN, x=x, y=7, sculpt=shape)
        for h in (7, 19):
            box(11, 2, 11, MARK, x=x, y=h, sculpt=shape)
    box(24, 4, 4, COPPER, x=14, y=8, z=8, sculpt=shape)
    return shape


def suction_line():
    shape = box(70, 8, 8, GREEN, y=5)
    box(70, 5, 11, GREEN, y=7, sculpt=shape)
    for x in range(-33, 34, 13):
        box(3, 10, 11, MARK, x=x, y=4, sculpt=shape)
        box(3, 7, 13, COPPER, x=x, y=6, sculpt=shape)
    for x in (-24, 24):
        box(6, 6, 15, STONE, x=x, sculpt=shape)
    return shape


def filter_gate():
    shape = Sculpt()
    for x in (-21, 21):
        box(13, 4, 22, SLATE, x=x, sculpt=shape)
        box(8, 47, 14, LIME, x=x, y=4, sculpt=shape)
        for y in (12, 29, 46):
            box(10, 2, 16, COPPER, x=x, y=y, sculpt=shape)
    box(51, 5, 15, GREEN, y=49, sculpt=shape)
    for x in (-13, 13):
        box(3, 42, 3, METAL, x=x, y=14, sculpt=shape)
        box(8, 3, 8, COPPER, x=x, y=55, sculpt=shape)
    for y in range(13, 40, 5):
        box(38, 4, 5, WOOD, y=y, sculpt=shape)
    for x in (-16, 16):
        box(2, 29, 7, DARK, x=x, y=12, sculpt=shape)
    for y in range(6, 43, 4):
        box(5 if y % 8 == 2 else 3, 1, 2, MARK, x=-21, y=y, z=7, sculpt=shape)
    return shape


def sampling_jetty():
    shape = Sculpt()
    for x in (-21, 21):
        for z in (-13, 13):
            box(4, 12, 4, WOOD, x=x, z=z, sculpt=shape)
    for x in range(-24, 25, 4):
        box(4, 2, 33, WOOD if x % 12 else JOINT, x=x, y=10, sculpt=shape)
    for x in (-21, 21):
        box(3, 17, 3, WOOD, x=x, y=12, z=14, sculpt=shape)
        box(4, 2, 4, COPPER, x=x, y=26, z=14, sculpt=shape)
    box(44, 2, 2, WOOD, y=26, z=14, sculpt=shape)
    return shape


def assay_saw():
    shape = box(31, 3, 17, SLATE)
    for x in (-12, 12):
        box(5, 11, 12, WOOD, x=x, y=3, sculpt=shape)
    box(31, 3, 16, METAL, y=14, sculpt=shape)
    for width, height in ((19, 9), (15, 15), (9, 19)):
        box(width, height, 2, METAL, x=-3, y=21 - height // 2, z=-2, sculpt=shape)
    box(10, 7, 9, GREEN, x=-3, y=18, z=-7, sculpt=shape)
    box(5, 5, 4, COPPER, x=-3, y=19, z=-1, sculpt=shape)
    box(7, 5, 5, GLASS, x=9, y=17, z=2, sculpt=shape)
    box(3, 4, 3, FOAM, x=9, y=21, z=2, sculpt=shape)
    return shape


def sample_drawers():
    shape = box(28, 21, 9, WOOD)
    for y in (3, 9, 15):
        for x in (-9, 0, 9):
            box(8, 5, 1, GREEN, x=x, y=y, z=5, sculpt=shape)
            box(3, 1, 1, MARK, x=x, y=y + 3, z=6, sculpt=shape)
    for x, h in ((-9, 5), (-2, 3), (6, 7)):
        box(5, h, 4, GLASS, x=x, y=21, sculpt=shape)
        box(3, 2, 2, FOAM, x=x, y=21 + h, sculpt=shape)
    return shape


def survey_tent():
    shape = Sculpt()
    for x in (-27, 27):
        for z in (-20, 20):
            box(3, 31, 3, WOOD, x=x, z=z, sculpt=shape)
    for side in (-1, 1):
        for i in range(7):
            x = side * (i * 4 + 2)
            box(5, 3, 51, SLATE if i in (1, 6) else GREEN, x=x, y=43 - i * 2, sculpt=shape)
    box(2, 45, 2, WOOD, z=-22, sculpt=shape)
    box(56, 13, 2, GREEN, y=16, z=-21, sculpt=shape)
    return shape


def chain_jig():
    shape = box(38, 4, 20, SLATE)
    for x in (-15, 15):
        box(5, 39, 6, GREEN, x=x, y=4, sculpt=shape)
    box(38, 5, 8, WOOD, y=41, sculpt=shape)
    for i in range(6):
        y = 9 + 5 * i
        if i % 2:
            for x in (-3, 3):
                box(2, 6, 2, METAL, x=x, y=y, sculpt=shape)
            box(6, 2, 2, METAL, y=y + 5, sculpt=shape)
        else:
            box(2, 7, 5, COPPER, y=y, sculpt=shape)
    box(22, 5, 13, DARK, y=4, sculpt=shape)
    return shape


def warden():
    shape = Sculpt()
    for w, h, d, y, mat in ((19, 3, 17, 0, SLATE), (15, 12, 13, 3, STONE),
                            (21, 3, 17, 15, COPPER), (19, 7, 13, 18, SLATE),
                            (13, 12, 11, 25, LIME), (16, 4, 13, 35, SLATE),
                            (13, 4, 12, 39, COPPER), (8, 3, 8, 43, MARK)):
        box(w, h, d, mat, y=y, sculpt=shape)
    for x in (-4, 4):
        box(4, 2, 2, COPPER, x=x, y=33, z=6, sculpt=shape)
        box(1, 1, 2, GLASS, x=x, y=32, z=6, sculpt=shape)
        box(3, 8, 3, STONE, x=x, y=23, z=7, sculpt=shape)
        box(3, 2, 3, MARK, x=x, y=24, z=7, sculpt=shape)
    box(3, 4, 4, LIME, y=29, z=6, sculpt=shape)
    box(5, 6, 2, STONE, y=21, z=7, sculpt=shape)
    return shape


def quartz_pocket():
    shape = stone.bank_tongue()
    for x, z, height, width, lean in ((-15, 3, 29, 7, -1), (-5, 2, 46, 9, -1),
                                       (6, 7, 52, 10, 1), (16, 2, 31, 7, 1)):
        for y in range(0, height, 3):
            w = max(1, width - max(0, y - height + 15) // 2)
            xx = x + lean * (y // 8)
            box(w * 2, 3, w, GLASS, x=xx, y=y + 7, z=z, sculpt=shape)
            box(w, 3, w + 3, GREEN, x=xx, y=y + 7, z=z, sculpt=shape)
        box(2, 2, 2, GLOW, x=xx, y=height + 6, z=z, sculpt=shape)
    return shape


def spillway_controls():
    gallery = box(73, 3, 26, SLATE)
    for x in (-32, 32):
        for z in (-10, 10):
            box(4, 30, 4, GREEN, x=x, y=3, z=z, sculpt=gallery)
    for x in (-21, 0, 21):
        box(13, 8, 8, WOOD, x=x, y=4, sculpt=gallery)
        for dx in (-4, 4):
            box(2, 16, 2, METAL, x=x + dx, y=10, sculpt=gallery)
        box(13, 3, 5, COPPER, x=x, y=23, sculpt=gallery)
        box(3, 3, 6, MARK, x=x, y=26, sculpt=gallery)
    for i in range(7):
        box(79, 2, 5, GREEN if i % 3 else COPPER, y=34 - i, z=-15 + 5 * i, sculpt=gallery)
    for x in (-26, -13, 13, 26):
        box(2, 8, 2, DARK, x=x, y=3, z=-12, sculpt=gallery)
    box(68, 2, 2, METAL, y=10, z=-12, sculpt=gallery)
    return gallery


def mineral_floor():
    ground = box(80, 3, 80, SLATE)
    for x, z, length in ((-23, 13, 14), (-7, -19, 21), (8, 25, 16), (18, -9, 13)):
        for run in range(4):
            start = x + run * 3
            ground.box((start, start + length - run * 2), 2, (z + run * 2, z + run * 2 + 1),
                       STONE if run == 2 else JOINT)
    return ground


def add_waterworks(board):
    a, place = board.add, board.place
    cols = range(-28, 29, 8)
    rows = range(28, 69, 8)
    lake = [(x, z) for x in (-12, -4, 4, 12) for z in (36, 44, 52)]
    camp = [(x, z) for x in (-28, -20, -12, -4) for z in (60, 68)]
    service = [(x, z) for x in (-20, 20) for z in (28, 36, 44, 52)]
    service += [(x, z) for x in (4, 12, 20) for z in (60, 68)]
    limestone = [(x, z) for x in cols for z in rows if (x, z) not in lake + camp + service]
    floors(board, 'Limestone shore', stone.slag_floor(), limestone)
    board.set_palette('Limestone shore', skin='#a5a395', primary='#788b83')
    floors(board, 'Reservoir service flags', stone.flags(72), service)
    board.set_palette('Reservoir service flags', skin='#9ba399', primary='#73837e')
    floors(board, 'Mineral survey floor', mineral_floor(), camp)
    board.set_palette('Mineral survey floor', primary='#686276', skin='#948496', leather='#a08266')
    first, *rest = lake
    a('Deep cistern water', reservoir(), *first, height=-1.35, surface='water')
    for x, z in rest:
        place('Deep cistern water', x, z, height=-1.35)
    board.set_palette('Deep cistern water', visor='#3c99a2', detail='#599e99')

    a('Reservoir quay', quay(), -12, 32.15, height=-1.2)
    for x in (-4, 4, 12):
        place('Reservoir quay', x, 32.15, height=-1.2)
    for x in (-12, -4, 4, 12):
        place('Reservoir quay', x, 55.85, 2, -1.2)
    for z in (36, 44, 52):
        place('Reservoir quay', -16.1, z, 1, -1.2)
        place('Reservoir quay', 16.1, z, 3, -1.2)
    a('Limestone aqueduct', aqueduct_bay(), -20, 46.6, height=-1.25)
    for x in (-12, -4, 4, 12, 20):
        place('Limestone aqueduct', x, 46.6, height=-1.25)
    board.set_palette('Limestone aqueduct', skin='#b4b9a2', primary='#678681', visor='#50b6b9')
    a('Spillway operating gallery', spillway_controls(), 2, 46.6, height=4.42)
    board.set_palette('Spillway operating gallery', detail='#437f80', trim='#bb9464')
    place('Tipple inspection lamp', 1.0, 45.6, height=5.6)
    board.light(1, 5.9, 45.4, '#ffd38c', 440, 7)
    a('Three spillway falls', spillway(), 2, 45.25, 2, -1.25)
    board.set_palette('Three spillway falls', visor='#82c9d3', secondary='#486863', skin='#adb6a2', accent='#d1e5eb')
    for x, z, t in ((10.3, 40.8, 2), (13.7, 41.6, 1), (-13.7, 52.1, 1), (8.2, 54.4, 0)):
        place('Cooled lava spur', x, z, t, -1.35)
    place('Calcite organ pipes', 12.1, 42.2, 1, -1.3)
    place('Low crystal fan', -14.5, 52.1, 1, -0.8)
    a('West beam pump', beam_pump(), -24, 36.8, 0)
    board.set_palette('West beam pump', detail='#4d9489', trim='#c08853', skin='#b1ada2')
    a('Flanged suction line', suction_line(), -21.65, 35.9)
    place('Flanged suction line', -24.3, 32, 1)
    place('Forge pendant', -24.2, 36.0, height=3.5)
    board.light(-24.1, 3.7, 35.7, '#ffcd91', 540, 7)
    place('Forge roof rib', -24, 34.6)
    place('Forge roof rib', -24, 41.2)
    place('Smoke gallery roof', -24, 37.9, height=5.4)
    place('Foundry ashlar wall', -26, 41.6, 2)
    place('Foundry ashlar wall', -21.4, 41.6, 2)
    place('Foundry pressure regulator', -27.2, 34.2, 1)
    place('Dwarf storage jar', -26.3, 39.8)

    a('Settling dock', sampling_jetty(), -15.4, 49.4, 3, -1.2)
    a('Sediment sample rack', sample_drawers(), -18.5, 53.25, 1)
    board.set_palette('Sediment sample rack', detail='#497e84', visor='#b8d6c7')
    place('Brass mine lantern', -17.8, 51.7)
    board.light(-17.8, 2.1, 51.7, '#ffd59b', 225, 6)
    place('Rope spool', -14.5, 50.1)
    place('Timber stockpile', -22.9, 49.7, 1)

    a('Quartz field tent', survey_tent(), -18.4, 64.7, 2)
    board.set_palette('Quartz field tent', detail='#977860', primary='#576376', leather='#795640')
    a('Diamond assay saw', assay_saw(), -16.6, 64.9, 2)
    board.set_palette('Diamond assay saw', visor='#bd9ace', detail='#657b7a')
    place('Sediment sample rack', -20.2, 65.9, 2)
    place('Tipple inspection lamp', -17.8, 64.8, height=2.65)
    board.light(-17.8, 2.8, 64.3, '#ffdfb2', 520, 6)
    a('Amethyst motherlode', quartz_pocket(), -25.7, 60.5, 1)
    board.set_palette('Amethyst motherlode', visor='#a2a6ed', detail='#836caa', accent='#c6c9ff')
    for x, z, t in ((-28.1, 66.8, 2), (-12, 68, 1), (-26.7, 55.7, 3)):
        place('Amethyst motherlode', x, z, t)
    board.light(-24.6, 2.1, 60.2, '#b4c8ff', 350, 7)
    place('Tall crystal seam', -23.6, 68.3, 1)
    place('Ore grading rack', -10.9, 64.8, 2)
    place('Charcoal bin', -14.6, 66.9)
    place('Dwarf storage jar', -19.9, 62.4)
    place('Rope spool', -13.7, 62.6)

    a('Filter headgate', filter_gate(), 7.2, 57.5, 2)
    board.set_palette('Filter headgate', skin='#bac3ab', detail='#43888b', trim='#c09763')
    place('Foundry pressure regulator', 10.9, 58.3, 2)
    place('Flanged suction line', 19.6, 59)
    place('Flanged suction line', 26.55, 59)
    place('Cable brake house', 12.7, 64.3)
    place('Coiled steel winding drum', 12.6, 64.6, 1, 1.1)
    place('Copper draught main', 18.4, 62.7)
    place('Brass mine lantern', 3.9, 58.5)
    board.light(3.9, 2.2, 58.5, '#ffe0a8', 350, 7)
    place('Calcite organ pipes', 24.3, 64.5)
    place('Calcite organ pipes', 4.8, 69.2, 3)

    a('Lift chain test jig', chain_jig(), 24.1, 51.1, 2)
    board.set_palette('Lift chain test jig', detail='#677d76', trim='#ad8462')
    place('Quartz field tent', 24.9, 52.2, 2)
    place('Forge workbench', 26.2, 53.4)
    place('Tipple inspection lamp', 25.3, 51.7, height=2.45)
    board.light(25.2, 2.7, 51.5, '#ffce92', 380, 7)
    place('Winding drum bearings', 26.8, 47.5)
    place('Coiled steel winding drum', 26.8, 47.5, height=1.9)
    place('Ore grading rack', 26.4, 39.5, 2)
    place('Bellows frame', 26.7, 35.8)
    place('Timber stockpile', 22.5, 39)
    place('Brass mine lantern', 22.6, 35.4)
    place('Stone lintel with runes', 19.7, 27.6)
    place('Dwarf mine gate', -17.7, 27.3)
    place('Brass mine lantern', -20.7, 28.9)
    board.light(-20.7, 2, 28.9, '#ffdea2', 200, 6)

    for z in (29, 38, 47, 57, 67):
        place('Folded ironstone seam', -31.0, z, 1)
    for z in (28.5, 36.6, 44.7, 52.8, 60.9, 69):
        place('Fractured cave wall', 31.2, z, 3)
    for x in (-27.5, -19.3, -11, -2.7, 5.5, 13.8, 22.1, 28.2):
        place('Sheet basalt escarpment', x, 70.8, 2)
    for x, z, t, h in ((-28.9, 28.8, 1, 4.0), (-27.8, 46, 1, 4.2),
                        (-27.4, 64.3, 1, 4.1), (-17.1, 69, 2, 4.3), (-5.7, 69, 2, 4.4),
                        (17.7, 69.3, 2, 4.1), (28, 60.5, 3, 4.1), (28.5, 41.5, 3, 4.6)):
        place('Cavern ceiling ledge', x, z, t, h)
    for x, z, turn in ((-8, 29.5, 0), (-3.2, 29, 1), (14.55, 30.2, 2),
                       (-27.5, 45.8, 1), (-5.6, 67.4, 0), (20.4, 68.4, 2), (28, 31.1, 3)):
        place('Obsidian stepped shelf', x, z, turn)
    for x, z, turn in ((0, 27.7, 0), (13.05, 27.9, 1), (-28.5, 53.1, 1),
                       (-5.4, 68.8, 2), (28.6, 31.2, 3), (27.8, 65.7, 1)):
        place('Basalt column cluster', x, z, turn)

    prop = board.prop_id
    board.point('pump', 'Cistern pump station', -21, 32, actions=(
        action('activate', assets=('pressure_gauge', prop('West beam pump')), reward='cistern_primed'),))
    board.point('dock', 'Settling dock', -17.2, 48.8, actions=(
        action('gather', assets=('sample_vial', prop('Sediment sample rack')),
               requires=('cistern_primed',), reward='sediment_sample'),))
    board.point('lode', 'Amethyst survey face', -23, 58.9, actions=(
        action('gather', assets=('survey_compass', 'pickaxe', prop('Amethyst motherlode')), reward='amethyst_core'),))
    board.point('assay', 'Survey assay camp', -17.5, 61.5, actions=(
        action('craft', assets=(prop('Diamond assay saw'),), requires=('sediment_sample', 'amethyst_core'),
               reward='matched_filter_stone'),))
    board.point('headgate', 'Filter headgate', 7.7, 60.2, actions=(
        action('activate', assets=(prop('Filter headgate'),), requires=('matched_filter_stone',),
               reward='headwater_restored'),))
    board.point('chain', 'Lift chain shop', 22.3, 48.8, actions=(
        action('repair', assets=(prop('Lift chain test jig'),), requires=('headwater_restored',),
               reward='spare_lift_chain'),))
    board.link('crystal', 'pump', [-17.6, 0, 17.9], [-17.7, 0, 27.3], requires=('glow_shard',))
    board.link('pump', 'dock', [-17.3, 0, 33.4], [-17.3, 0, 45], [-19.8, 0, 46.6], [-18, 0, 48.6])
    board.link('dock', 'lode', [-20.6, 0, 52.2])
    board.link('lode', 'assay', [-21.7, 0, 61.1])
    board.link('assay', 'headgate', [-9, 0, 60.5], [-1, 0, 60])
    board.link('headgate', 'chain', [10.5, 0, 60.1], [19.5, 0, 56.1], [20, 0, 51])
    board.link('chain', 'shaft', [20.2, 0, 47.4], [19.7, 0, 42], [19.7, 0, 27.6],
               [19.7, 0, 21], [20.5, 0, 15], requires=('bridge_open', 'spare_lift_chain'))
    board.shot('Reservoir spillway', [-17.1, 1.8, 34.4], [1.1, 2.9, 46.5])
    board.shot('Quartz assay camp', [-12.35, 1.78, 59.45], [-18.4, 2.0, 64.75])
