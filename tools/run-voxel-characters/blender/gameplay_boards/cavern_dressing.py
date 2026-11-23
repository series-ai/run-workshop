"""Rock galleries and work areas that frame the routes through Emberdeep."""

from random import Random

import voxchar as vk
from creature_kit import Sculpt
from level_geometry import box

from .common import BODY, DARK, GLASS, GLOW, GREEN, JOINT, MARK, METAL, STONE, WOOD


def vault_rock(seed, width, depth):
    rng = Random(seed)
    shape = Sculpt()
    for x in range(-width // 2 + 7, width // 2, 14):
        proportion = abs(x) / (width / 2)
        low = round(18 * (1 - proportion)) + rng.randrange(0, 10)
        z = rng.randrange(-depth // 5, depth // 5)
        box(19, 38 - low, depth - 6, BODY, x=x, y=low, z=z, sculpt=shape)
        box(18, 11, depth, DARK, x=x, y=low + 8, z=z - 1, sculpt=shape)
        box(12, 6, depth - 3, STONE, x=x + 1, y=26, z=z, sculpt=shape)
        if rng.randrange(3) == 0:
            for layer in range(4):
                box(9 - layer * 2, 4, 9 - layer * 2, (BODY, STONE, JOINT, DARK)[layer],
                    x=x + layer // 2, y=low + 2 - layer * 4, z=z - 5, sculpt=shape)
    return shape


def ceiling_strata():
    shape = box(109, 17, 93, BODY, y=9)
    for ix, x in enumerate(range(-45, 50, 15)):
        span_depth = (73, 49, 67)[ix % 3]
        depth_center = (10, -9, -5, 3)[ix % 4]
        box(14, 9 + ix % 3, span_depth, DARK, x=x, z=depth_center, sculpt=shape)
        box(12, 5, span_depth - 7, JOINT, x=x, z=depth_center, y=3 + ix % 4, sculpt=shape)
        box(14, 4, 79, STONE, x=x + 1, y=19 + ix % 2, sculpt=shape)
    return shape


def tiered_rock(seed):
    rng = Random(seed)
    shape = Sculpt()
    for x, z, width, depth, height in (
        (-15, 8, 20, 22, 44), (6, 10, 24, 20, 51), (18, -4, 15, 22, 33),
        (-7, -10, 28, 18, 36), (-19, -15, 16, 11, 23), (12, -17, 22, 12, 21),
    ):
        for y in range(0, height, 6):
            lip = (height - y) // 12
            shift = y // 12 * (1 if x < 0 else -1)
            color = rng.choice((JOINT, BODY, BODY, STONE, DARK))
            box(width + lip, min(6, height - y), depth + lip, color, x=x + shift, y=y, z=z, sculpt=shape)
        box(width - 3, 2, depth - 4, STONE, x=x + shift, y=height, z=z, sculpt=shape)
    return shape


def lichen_shelf(seed):
    rng = Random(seed)
    shape = Sculpt()
    moss = vk.vox('detail', -0.3)
    violet = vk.vox('primary', 0.3)
    for x, z, w, d, h in ((-10, 4, 15, 13, 8), (1, 0, 16, 13, 12), (10, -5, 14, 11, 6)):
        box(w, h, d, DARK, x=x, z=z, sculpt=shape)
        box(w - 3, 2, d - 3, moss, x=x, y=h - 2, z=z, sculpt=shape)
    for i in range(11):
        x, z = rng.randrange(-11, 10), rng.randrange(-4, 5)
        base = 10 if -6 <= x <= 8 else 6
        h = rng.randrange(3, 10)
        box(1, h, 2, STONE, x=x, y=base, z=z, sculpt=shape)
        box(3 + i % 2, 2, 3 + i % 2, violet if i % 3 else GLASS, x=x, y=base + h, z=z, sculpt=shape)
        box(2, 1, 2, MARK, x=x, y=base + h + 2, z=z, sculpt=shape)
    return shape


def fluorspar_clump():
    shape = box(22, 4, 16, DARK)
    core = vk.vox('visor', 0.45)
    ridge = vk.vox('detail', 0.36)
    for x, z, width, height, lean in ((-7, 1, 10, 31, -1), (3, 0, 11, 43, 1),
                                     (9, 4, 8, 25, 1), (-3, -5, 7, 19, -1)):
        for y in range(4, height, 2):
            taper = min(width, 2 + (height - y) // 2)
            lean_x = x + y // 8 * lean
            box(taper, 2, taper - 1, core, x=lean_x, y=y, z=z, sculpt=shape)
            box(2, 2, max(1, taper - 3), ridge, x=lean_x - taper // 2, y=y, z=z, sculpt=shape)
            if height // 3 <= y < height - 3:
                box(1, 2, 2, GLOW, x=lean_x + taper // 2, y=y, z=z - 1, sculpt=shape)
    return shape


def assay_trays():
    shape = Sculpt()
    for x in (-18, 18):
        box(4, 9, 13, DARK, x=x, sculpt=shape)
    box(40, 3, 17, WOOD, y=7, sculpt=shape)
    for x, color in ((-12, MARK), (0, GLASS), (12, GLOW)):
        box(11, 2, 12, DARK, x=x, y=10, sculpt=shape)
        for dx, z, w, h in ((-2, 2, 3, 3), (2, -2, 2, 5), (-1, -3, 3, 2)):
            box(w, h, 3, color, x=x + dx, y=12, z=z, sculpt=shape)
            box(1, 1, 2, STONE, x=x + dx, y=12 + h, z=z, sculpt=shape)
    for x in range(-16, 18, 4):
        box(1, 2, 1, METAL, x=x, y=8, z=-9, sculpt=shape)
    return shape


def support_gallery():
    shape = Sculpt()
    for x in (-36, 36):
        for z in (-16, 16):
            box(4, 55, 5, WOOD, x=x, z=z, sculpt=shape)
            box(6, 3, 7, METAL, x=x, y=3, z=z, sculpt=shape)
            for i in range(7):
                box(3, 3, 4, WOOD, x=x - (1 if x > 0 else -1) * i * 2, y=34 + i * 2, z=z, sculpt=shape)
    for z in (-16, 16):
        box(79, 5, 5, WOOD, y=49, z=z, sculpt=shape)
    for x in range(-36, 41, 8):
        box(4, 3, 41, BODY, x=x, y=54, sculpt=shape)
        box(1, 2, 41, MARK, x=x, y=56, sculpt=shape)
    return shape


def guidepost():
    shape = box(7, 3, 7, JOINT)
    box(4, 23, 4, WOOD, y=3, sculpt=shape)
    box(15, 7, 2, DARK, y=20, z=-2, sculpt=shape)
    for x in range(-4, 5):
        box(1, 1, 1, MARK, x=x, y=22, z=-3, sculpt=shape)
    for x, y in ((3, 21), (3, 23), (2, 20), (2, 24)):
        box(1, 1, 1, MARK, x=x, y=y, z=-3, sculpt=shape)
    box(5, 2, 5, METAL, y=27, sculpt=shape)
    box(3, 3, 3, GLOW, y=29, sculpt=shape)
    box(5, 1, 5, METAL, y=32, sculpt=shape)
    return shape


def dressing(board):
    a, place, palette = board.add, board.place, board.set_palette

    a('Reservoir hanging rock vault', vault_rock(34, 112, 42), -14.3, 40.7, height=5.6)
    place('Reservoir hanging rock vault', -24.9, 40.7, height=5.45)
    place('Reservoir hanging rock vault', -4.1, 41.8, 2, 6.35)
    for x, z, turn, height in ((6.0, 42.4, 0, 6.95), (16.4, 42.3, 2, 7.3), (26.85, 42, 0, 6.15),
                               (-29.8, 53.9, 0, 5.65), (-19.35, 54.1, 2, 6.15), (-8.9, 53.9, 0, 7.1),
                               (1.5, 53.8, 2, 7.5), (11.9, 54.1, 0, 7.26),
                               (22.3, 54.8, 2, 6.88), (29.6, 54.2, 0, 6.2)):
        place('Reservoir hanging rock vault', x, z, turn, height)
    for x, z, turn in ((-29.9, 40, 1), (-30.7, 52, 1), (30.3, 41.9, 3), (29.5, 54.8, 3)):
        place('Fractured cave wall', x, z, turn, 3.85)
    palette('Reservoir hanging rock vault', primary='#626467', skin='#8a8b87', secondary='#414e57')
    a('Cistern ceiling strata', ceiling_strata(), -24.4, 47.7, height=7.25)
    for x, z, turn, y in ((-13.55, 47.6, 2, 7.5), (-2.7, 47.4, 0, 7.7),
                         (8.15, 46.9, 2, 7.76), (19.0, 47.2, 0, 7.53), (29.85, 47.05, 2, 7.25)):
        place('Cistern ceiling strata', x, z, turn, y)
    palette('Cistern ceiling strata', primary='#5d606c', skin='#7f828c', secondary='#414954')
    a('Sawtooth cavern soffit', vault_rock(6, 122, 31), 4.0, -0.2, height=5.65)
    for x, z, turn, bottom in ((-22.8, 10.5, 1, 4.85), (-8.3, -1.4, 1, 5.12), (13.5, -10.2, 1, 5.45),
                               (-15.8, 61.1, 0, 4.25), (-19.8, 66.2, 1, 4.85), (19.5, 31.5, 1, 4.92)):
        place('Sawtooth cavern soffit', x, z, turn, bottom)
    place('Sawtooth cavern soffit', 2.2, -5.8, 1, 5.15)
    place('Basalt column cluster', 2.2, -11.0, 1, -1.45)
    place('Basalt column cluster', 2.2, -0.4, 1, -1.45)
    palette('Sawtooth cavern soffit', primary='#626170', skin='#8f827d', secondary='#3b3b51')

    a('Tiered mineral promontory', tiered_rock(29), -7.35, 33.2, height=-1.65)
    for x, z, turn, bottom in ((-13.55, 43.6, 3, -1.15), (12.7, 51, 1, -1.2), (13.15, 52.9, 2, -1.2),
                               (-4.0, 53.9, 1, -1.22), (-25.8, 56.9, 3, 0), (-8.1, 65, 0, 0),
                               (25.8, 34, 1, 0), (-31.5, 10.7, 1, 0), (-22.2, -14.55, 1, 0),
                               (25.2, -6.2, 2, 0), (-4.4, 1.65, 1, -1.6), (6.9, 0.95, 3, -1.5)):
        place('Tiered mineral promontory', x, z, turn, bottom)
    palette('Tiered mineral promontory', primary='#5e687b', skin='#97939c', secondary='#434651')

    a('Lichen and shelf fungus', lichen_shelf(14), -15.35, 33.75)
    for i, (x, z, y) in enumerate((
        (-13.8, 35.1, -1.05), (-9.5, 38.1, -1.33), (-22.2, 43.85, 0), (-25.2, 47.5, 0),
        (13.3, 37.5, 0), (13.5, 51.5, 0), (-24.1, 54.5, 0), (-26.1, 63.5, 0),
        (-10.7, 64.8, 0), (-16.1, 66.8, 0), (-9, 66.1, 0), (-28.9, 11.3, 0),
        (-20.7, 17.15, 0), (-24.5, -5.8, 0), (21.3, -4.8, 0), (13.4, -3.35, 0),
        (23.5, 23.7, 0), (26, 43.3, 0), (27.4, 47.8, 0),
    )):
        place('Lichen and shelf fungus', x, z, i % 4, y)
    palette('Lichen and shelf fungus', detail='#5c9489', primary='#8b587f', visor='#af7993', trim='#e5a17d')

    a('Assay trays and gem samples', assay_trays(), -20.1, 63.55, 1)
    place('Assay trays and gem samples', -25.45, 4.8, 1)
    place('Assay trays and gem samples', -23.7, 43.8, 1)
    place('Assay trays and gem samples', 25.6, -14.8, 2)
    palette('Assay trays and gem samples', visor='#a4aee6', accent='#89dcf4', trim='#db995f')

    a('Timber service gallery', support_gallery(), -25.7, 6.7, 1)
    place('Timber service gallery', -24.3, 44.25, 1)
    place('Timber service gallery', -22.15, 61.25, 1)
    palette('Timber service gallery', leather='#9f694c', primary='#626e71', trim='#ab8460')

    a('Mine route beacon', guidepost(), -20.1, -6.6)
    for x, z, turn in ((-21.3, 8.5, 2), (-10.9, -7.9, 1), (13.8, -4.3, 3), (23.5, 11.3, 2),
                       (-14.8, 30.1, 3), (-22.0, 45.5, 1), (-14.4, 59, 2), (4.5, 61.7, 0), (22.4, 43.4, 2)):
        place('Mine route beacon', x, z, turn)
        board.light(x, 3.24, z, '#ffca87', 135, 5.5)

    for x, z, turn, y in ((-12.95, 34.2, 3, -0.93), (-9.3, 36.2, 1, -1.05), (-8.5, 41.0, 2, -1.1),
                           (12.25, 53.2, 1, -0.8), (8.9, -1.4, 2, -1.18), (-6.2, -0.75, 0, -1.2),
                           (-11.3, 66.3, 3, 0), (-24.1, 66.0, 0, 0), (-26.5, 55.0, 2, 0),
                           (28.8, 49.3, 3, 0), (-28.1, 11.55, 1, 0)):
        label = 'Amethyst motherlode' if z > 54 else 'Low crystal fan'
        place(label, x, z, turn, y)

    a('Fluorspar at the waterline', fluorspar_clump(), -14.05, 39.2, height=-1.3)
    for x, z, turn, y in ((10.65, 38.55, 2, -1.25), (13.9, 51.4, 3, -1.24),
                         (-12.5, 66.35, 1, 0), (-28.8, 12.3, 1, 0)):
        place('Fluorspar at the waterline', x, z, turn, y)
    palette('Fluorspar at the waterline', visor='#83e1e9', detail='#6998c5', accent='#95edff')

    for x, y, z, tint, power, distance in (
        (-14.2, 1.34, 38.25, '#8fdaf8', 2750, 10),
        (-12.1, 3.0, 37.4, '#aad8ff', 2600, 10),
        (-7.4, 4.0, 41.3, '#d8baf7', 5250, 15),
        (-0.65, 5.9, 41.15, '#ffd7a3', 6800, 18),
        (5.2, 5.6, 42.1, '#86d5e7', 4050, 14),
        (6.7, 2.9, 40.5, '#ffd0a2', 4400, 12),
        (1.2, 3.4, 49.0, '#e8b084', 5300, 12),
        (10.4, 5.1, 52.5, '#9ccaec', 2200, 12),
        (12.7, 2.2, 51.5, '#67b6c7', 700, 8),
        (-20.9, 3.1, 62.6, '#ffd0ab', 1320, 8),
        (-15.4, 3.25, 59.8, '#ffc98f', 2180, 9),
        (-13.4, 2.7, 62.4, '#ad95f4', 800, 8),
        (-26.2, 2.4, 63.75, '#98a9f7', 1100, 9),
        (-24.4, 3.9, 4.0, '#ffcc8e', 1700, 8),
        (-29.05, 3.05, 9.8, '#b3cfff', 780, 7),
        (-3, 0.3, -1.5, '#ff936d', 1250, 11),
        (-11.6, 3.35, -3.5, '#b7a8ef', 900, 10),
        (11.4, 3.5, -0.2, '#f9a678', 760, 9),
    ):
        board.light(x, y, z, tint, power, distance)


def survey_landing():
    shape = Sculpt()
    for x in (-17, 17):
        for z in (-10, 10):
            box(4, 23, 4, WOOD, x=x, z=z, sculpt=shape)
            box(6, 2, 6, METAL, x=x, y=8, z=z, sculpt=shape)
            box(5, 2, 5, METAL, x=x, y=21, z=z, sculpt=shape)
    for x in range(-19, 20, 4):
        box(3, 2, 26, WOOD if x % 3 else BODY, x=x, y=11, sculpt=shape)
    for z in (-11, 11):
        box(41, 3, 3, WOOD, y=8, z=z, sculpt=shape)
        box(36, 2, 2, WOOD, y=22, z=z, sculpt=shape)
    box(4, 3, 24, MARK, x=18, y=11, sculpt=shape)
    return shape


def sampling_rig():
    shape = box(13, 5, 13, DARK)
    for x in (-5, 5):
        box(2, 21, 3, METAL, x=x, y=3, sculpt=shape)
    box(14, 2, 4, MARK, y=22, sculpt=shape)
    box(9, 8, 8, BODY, y=14, sculpt=shape)
    box(2, 7, 10, WOOD, y=13, sculpt=shape)
    for x in (-6, 6):
        box(1, 3, 4, MARK, x=x, y=16, sculpt=shape)
    box(2, 9, 1, METAL, x=4, y=5, z=-5, sculpt=shape)
    box(4, 3, 4, GLOW, y=25, sculpt=shape)
    return shape


def mineral_flowstone(seed):
    rng = Random(seed)
    shape = Sculpt()
    for x, z, width, depth, height in ((-16, 4, 20, 18, 25), (-2, 3, 26, 21, 49),
                                       (12, -9, 18, 23, 36), (23, 4, 17, 16, 21)):
        for y in range(0, height, 4):
            inset = y // 8
            shift = (y // 12) * rng.choice((-1, 0, 1))
            w, d = max(3, width - inset * 2), max(3, depth - inset * 2)
            box(w, min(4, height - y), d, STONE if y % 12 else BODY, x=x + shift, y=y, z=z, sculpt=shape)
            if y % 8 == 0:
                box(w - 2, 1, d + 1, MARK, x=x + shift, y=y, z=z, sculpt=shape)
        for i in (-1, 0, 1):
            box(2 + i % 2, height // 2, 3, GREEN, x=x + i * 4, z=z - depth // 2, sculpt=shape)
    return shape


def shift_work(board):
    a, place, palette = board.add, board.place, board.set_palette
    a('Cistern survey landing', survey_landing(), -13.75, 37.2, height=-1.3)
    palette('Cistern survey landing', primary='#765c4c', leather='#aa7753', trim='#d0b47d')
    a('Survey sounding drum', sampling_rig(), -13.15, 36.25)
    place('Survey sounding drum', -20.0, 41.2, 1)
    place('Survey sounding drum', 21.5, 54.9, 3)
    palette('Survey sounding drum', primary='#386d6c', trim='#d6a15e', accent='#ffbb62')
    place('Rope spool', -14.15, 37.91, 1)
    place('Rope spool', -20.95, 38.6, 2)
    place('Dwarf storage jar', -15.0, 36.47, 1)
    place('Dwarf storage jar', -21.3, 38.85, 2)
    place('Tipple inspection lamp', -19.7, 38.0, height=2.55)
    board.light(-18.8, 2.45, 36.85, '#ffba78', 2050, 10)
    board.light(-19.0, 2.6, 35.3, '#ffcf8c', 1680, 7)
    board.light(-12.85, 2.6, 36.72, '#ffc492', 2400, 11)
    a('Ochre flowstone cascade', mineral_flowstone(39), -8.15, 43.8, height=-1.35)
    for x, z, turn, y in ((11.7, 49.4, 2, -1.3), (-27.1, 57.65, 1, 0),
                         (-6.2, 65.8, 2, 0), (9.5, -2.6, 3, -1.45)):
        place('Ochre flowstone cascade', x, z, turn, y)
    palette('Ochre flowstone cascade', skin='#9a8b79', primary='#74677c', detail='#588c81', trim='#be8a67')
    board.light(-7.6, 2.95, 44.05, '#f4bd95', 3550, 13)
    board.light(-12.15, 0.3, 40.9, '#69dbff', 2050, 9)
    for actor, x, z, yaw in (
        ('dwarf_miner', -14.9, 37.2, -105),
        ('dwarf_smith', -17.9, 36.3, -137),
        ('dwarf_guard', 21.95, -8.9, 206),
        ('dwarf_miner', -24.0, 6.15, 205),
        ('dwarf_smith', -16.2, -6.8, 160),
        ('dwarf_smith', -17.5, 61.5, 190),
        ('dwarf_guard', 24, 15, 315),
    ):
        board.stage_actor(actor, x, z, yaw=yaw)
    board.shot('Cistern survey shift', [-19.45, 1.86, 34.55], [-3.1, 2.5, 46.3])


def folded_mineral_rib(seed):
    rng = Random(seed)
    shape = Sculpt()
    for index, x in enumerate(range(-31, 36, 11)):
        width = 14
        base_depth = rng.randint(21, 30)
        rise = rng.randint(56, 73)
        drift = rng.choice((-1, 0, 1))
        for y in range(0, rise, 6):
            shrink = y // 18
            tint = vk.vox('skin', (-0.2, 0.05, 0.24)[(index + y // 6) % 3])
            box(width - shrink, min(6, rise - y), base_depth - shrink, tint,
                x=x + drift * shrink, y=y, z=shrink, sculpt=shape)
            if y % 12 == 0:
                box(width - shrink, 2, 3, MARK if index % 3 else GREEN,
                    x=x + drift * shrink, y=y + 2, z=-base_depth // 2 + shrink, sculpt=shape)
    return shape


def crystal_pedestal():
    shape = box(25, 4, 19, JOINT)
    for x, z, width, height in ((-9, 4, 8, 19), (-4, -3, 9, 36), (1, 4, 7, 46), (7, -2, 10, 29), (11, 3, 6, 20)):
        for y in range(4, height, 2):
            taper = min(width, max(2, (height - y) // 2))
            drift = (1 if x > 0 else -1) * (y // 11)
            box(taper, 2, taper, GLASS, x=x + drift, y=y, z=z, sculpt=shape)
            box(2, 2, 2, GLOW, x=x + drift + taper // 2, y=y, z=z, sculpt=shape)
    return shape


def spillway_platform():
    shape = Sculpt()
    for x in (-10, 10):
        for z in (-25, -5, 15, 26):
            box(3, 22, 4, WOOD, x=x, z=z, sculpt=shape)
            box(4, 2, 5, METAL, x=x, y=17, z=z, sculpt=shape)
    for z in range(-27, 29, 4):
        box(23, 4, 4, WOOD, y=9, z=z, sculpt=shape)
        box(2, 1, 4, MARK, x=-10, y=13, z=z, sculpt=shape)
    box(2, 2, 39, WOOD, x=10, y=20, z=9, sculpt=shape)
    box(23, 2, 2, WOOD, y=20, z=28, sculpt=shape)
    return shape


def spillway_roof_rib():
    shape = Sculpt()
    for x, z, width, depth, tip in (
        (-23, -4, 27, 23, 12), (-11, 9, 20, 24, 7), (4, 8, 25, 28, 18),
        (21, -5, 23, 28, 2), (29, 9, 19, 23, 14), (3, -11, 24, 18, 24),
    ):
        for layer, tint in enumerate((BODY, STONE, JOINT, DARK, BODY, STONE, BODY, JOINT, DARK)):
            y = 4 * layer
            if y < tip:
                continue
            shrink = (32 - y) // 3
            box(width - shrink, 4, depth - shrink, tint, x=x + (8 - layer) // 2,
                y=y, z=z + (8 - layer) % 3, sculpt=shape)
    return shape


def sounding_line_crate():
    shape = box(13, 7, 9, WOOD)
    for x in (-5, 5):
        box(2, 8, 10, DARK, x=x, sculpt=shape)
        box(2, 1, 10, METAL, x=x, y=7, sculpt=shape)
    box(11, 1, 7, WOOD, y=7, z=1, sculpt=shape)
    box(7, 3, 1, BODY, y=3, z=-5, sculpt=shape)
    box(4, 1, 1, MARK, x=1, y=4, z=-6, sculpt=shape)
    for z, y in ((-5, 8), (4, 8)):
        for x in (-3, 3):
            box(1, 2, 2, METAL, x=x, y=y - 1, z=z + 1, sculpt=shape)
        box(9, 1, 1, MARK, y=y, z=z, sculpt=shape)
    for z in (-2, 0, 2):
        box(7, 1, 1, MARK, y=8, z=z, sculpt=shape)
    box(1, 1, 3, MARK, x=-4, y=8, z=-1, sculpt=shape)
    box(1, 1, 3, MARK, x=4, y=8, z=1, sculpt=shape)
    for z in (4, 5, 6):
        box(1, 1, 1, MARK, x=3, y=8, z=z, sculpt=shape)
    for y in range(8):
        box(1, 1, 1, MARK, x=3, y=y, z=6, sculpt=shape)
    return shape


def assay_test_bench():
    shape = Sculpt()
    for x in (-8, 8):
        for z in (-4, 4):
            box(3, 7, 3, WOOD, x=x, z=z, sculpt=shape)
    box(21, 2, 13, WOOD, y=6, sculpt=shape)
    box(13, 1, 9, METAL, y=8, sculpt=shape)
    for x, z, height in ((-3, -2, 2), (-1, 2, 4), (2, 0, 5), (4, -1, 4)):
        box(3, height, 3, GLASS, x=x, y=9, z=z, sculpt=shape)
        box(1, max(1, height-2), 1, GLOW, x=x+1, y=10, z=z+1, sculpt=shape)
    box(3, 3, 2, GLOW, x=-6, y=8, z=-2, sculpt=shape)
    box(3, 2, 2, MARK, x=8, y=9, sculpt=shape)
    return shape


def survey_chamber(board):
    add, place, palette = board.add, board.place, board.set_palette
    add('Folded survey gallery walls', folded_mineral_rib(153), -21.6, 69.05)
    for x, z, rotation, y in (
        (-29.55, 64.3, 1, 0), (-29.45, 57.5, 1, 0), (-15.15, 69.2, 0, 0),
        (-8.65, 69.15, 0, 0), (-29.7, 61.5, 1, 5.1),
        (-22.0, 69.4, 0, 4.8), (-15.35, 69.22, 0, 4.7),
    ):
        place('Folded survey gallery walls', x, z, rotation, y)
    palette('Folded survey gallery walls', skin='#7a7489', trim='#ab785c', detail='#658697')
    for iz, z in enumerate((55.2, 64.25, 72.2)):
        for ix, x in enumerate((-26.8, -16.05, -5.3)):
            place('Cistern ceiling strata', x, z, (ix + iz) % 4, 5.32 + 0.18 * ((ix + iz * 2) % 3))
    for iz, z in enumerate((29.5, 38.65, 55.4)):
        for ix, x in enumerate((-24.4, -13.55, -2.7, 8.15, 19.0, 29.85)):
            place('Cistern ceiling strata', x, z, 2 * ((ix + iz) % 2), 6.45 + 0.21 * ((iz + ix) % 3))
    add('Survey crystal cluster', crystal_pedestal(), -25.05, 65.38)
    place('Survey crystal cluster', -12.85, 65.6, 2)
    place('Survey crystal cluster', -26.95, 58.35, 1)
    palette('Survey crystal cluster', visor='#81daff', accent='#48a6ff')
    place('Assay trays and gem samples', -16.0, 63.8, 0)
    add('Illuminated crystal assay bench', assay_test_bench(), -13.1, 61.93)
    palette('Illuminated crystal assay bench', leather='#bd8557', metal='#8c8c83',
            visor='#5ab7dd', accent='#5ddff1')
    place('Dwarf storage jar', -12.6, 63.8)
    place('Lichen and shelf fungus', -23.9, 66.2, 1)
    place('Rope spool', -22.6, 65.2)
    place('Tipple inspection lamp', -16.95, 63.5, height=2.65)
    for x, y, z, color, power, distance in (
        (-11.75, 1.65, 60.2, '#ffdcb7', 6800, 8),
        (-17.0, 3.8, 62.55, '#ffd398', 6650, 11),
        (-18.8, 3.1, 64.4, '#ffb177', 4200, 9),
        (-23.8, 2.6, 65.95, '#81bfff', 6800, 12),
        (-13.0, 2.55, 64.2, '#7fdcff', 3350, 10),
        (-24.3, 2.7, 59.0, '#c3a9ff', 3900, 11),
        (-15.75, 1.85, 61.5, '#ffe1aa', 3900, 6),
    ):
        board.light(x, y, z, color, power, distance)
    board.stage_actor('dwarf_miner', -13.64, 61.08, yaw=33, pose=('Reach', 0.32))
    board.stage_actor('dwarf_smith', -16.25, 62.9, yaw=349, pose=('Reach', 0.31))
    board.stage_actor('dwarf_guard', -21.5, 62.35, yaw=127, pose=('Walk', 0.30))
    for x, z, rotation, y in ((-6.95, 61.4, 0, 4.1), (-0.1, 61.85, 2, 4.2),
                               (6.55, 61.3, 0, 4.0), (13.35, 60.9, 2, 4.2),
                               (20.1, 60.4, 0, 4.13)):
        place('Folded survey gallery walls', x, z, rotation, y)
    add('Spillway broken rock ribs', spillway_roof_rib(), 1.1, 32.6, height=4.78)
    for x, z, rotation, y in ((8.55, 35.4, 2, 4.8), (-4.1, 36.1, 1, 4.62),
                               (3.7, 43.2, 0, 4.5), (-8.1, 38.1, 2, 4.43),
                               (12.4, 40.0, 3, 4.72), (4.75, 27.45, 1, 4.65)):
        place('Spillway broken rock ribs', x, z, rotation, y)
    palette('Spillway broken rock ribs', primary='#675d68', skin='#96818a', secondary='#4e4653')
    add('Spillway inspection platform', spillway_platform(), 2.15, 34.8, height=-1.3)
    palette('Spillway inspection platform', leather='#9b6548', metal='#69665c', trim='#bb985f')
    place('Rope spool', 1.14, 37.25, 1)
    add('Spillway sounding line crate', sounding_line_crate(), 2.05, 36.29)
    palette('Spillway sounding line crate', leather='#b4814e', trim='#eac778',
            primary='#a4603d', secondary='#664631', metal='#9c9a87')
    board.stage_actor('dwarf_guard', 2.09, 37.11, yaw=180, pose=('Reach', 0.32))
    board.stage_actor('dwarf_miner', 2.02, 35.35, yaw=0, pose=('Reach', 0.36))
    board.light(5.4, 3.2, 32.45, '#ffcf99', 14700, 13)
    board.light(0.7, 5.4, 40.2, '#ffcf99', 16500, 17)
    board.light(11.05, 3.35, 37.35, '#93c8ff', 6950, 13)
    board.shot('Under the spillway', [7.35, 3.6, 31.4], [1.75, 1.45, 39.7])
    board.shot('Crystal assay gallery', [-9.6, 1.89, 58.5], [-19.4, 1.86, 64.27])
    board.shot('Upper assay room', [-8.95, 3.65, 57.85], [-20.7, 1.85, 64.15])
