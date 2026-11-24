"""Glazed tile, ribbon, and glass workshops east of Market Keep."""

import build_level_props as lp
from creature_kit import Sculpt
from level_geometry import box, span

from . import equipment as eq
from .actors import Actor
from .common import (BODY, DARK, GLASS, GLOW, GREEN, JOINT, MARK, METAL, STONE, WOOD,
                     action, floors, glyph, shelf, slab)

ACTORS = {
    'tile_maker': Actor('Bluecourt tile maker', 'worker', 'human', 'rag',
                        {'skin': '#985d46', 'hair': '#493128', 'primary': '#346c81',
                         'secondary': '#554e4a', 'detail': '#d69e61'}),
    'ribbon_weaver': Actor('Bluecourt ribbon weaver', 'merchant', 'human', 'bonnet',
                            {'skin': '#b88561', 'hair': '#633c2d', 'primary': '#a05757',
                             'secondary': '#68484e', 'detail': '#d89c5c'}),
    'glaze_keeper': Actor('Bluecourt glaze keeper', 'civilian', 'human', 'cowl',
                          {'skin': '#885b43', 'hair': '#423024', 'primary': '#4d8174',
                           'secondary': '#495d55', 'detail': '#cea46d'}),
    'guild_curator': Actor('Bluecourt guild curator', 'officer', 'human', 'soft_cap',
                            {'skin': '#bc886f', 'hair': '#735345', 'primary': '#4b6891',
                             'secondary': '#4f515f', 'detail': '#d5a46f'}),
}

BLUE = dict(primary='#316c90', secondary='#3c4e69', trim='#ecc894', metal='#70827a',
            skin='#d8bd99', accent='#6dd7d4', visor='#4fabb6', leather='#8c6449', detail='#cf845b')
ROSE = dict(primary='#a95353', secondary='#6d4b4e', trim='#f3c88f', metal='#847768',
            skin='#d6ae85', accent='#f2b069', visor='#5f9c9f', leather='#936b4a', detail='#d58655')
GREENWARE = dict(primary='#3f8978', secondary='#416861', trim='#ead39d', metal='#7a8a77',
                 skin='#cebda0', accent='#99ddba', visor='#6eb6a3', leather='#926a4f', detail='#a9ad67')
TERRACOTTA = dict(primary='#a85e47', secondary='#704c50', trim='#e7bb82', metal='#827265',
                  skin='#cfae8c', accent='#f79d57', visor='#5295a2', leather='#8e624c', detail='#d08755')

DIAMOND = ('.#.', '#.#', '.#.')
TILE_MARK = ('..#..', '.#.#.', '#.#.#', '.#.#.', '..#..')


def sample_tile():
    shape = box(12, 2, 12, STONE)
    for z, row in enumerate(TILE_MARK, -2):
        for x, cell in enumerate(row, -2):
            if cell == '#':
                box(2, 1, 2, BODY, x=2 * x, y=1, z=2 * z, sculpt=shape)
    return shape


ITEMS = {
    'guild_order': eq.Item('Guild exhibit order', 'document', eq.steward_letter()),
    'clay_blank': eq.Item('Clay tile blank', 'material', box(12, 2, 12, STONE), palette=TERRACOTTA),
    'glaze_jar': eq.Item('Turquoise glaze jar', 'material', eq.cordial_flask(), palette=GREENWARE),
    'bluecourt_tile': eq.Item('Stamped Bluecourt tile', 'craft', sample_tile(), palette=BLUE),
    'ribbon_spool': eq.Item('Ribbon spool', 'material', lp.drum(11, 6, BODY, MARK), palette=ROSE),
    'loom_shuttle': eq.Item('Wooden loom shuttle', 'tool', eq.tube(13, 5, WOOD), (0, 2, 0)),
    'exhibit_ribbon': eq.Item('Guild exhibit ribbon', 'craft', eq.rail_signal_flag(), (0, 4, 0), ROSE),
    'gallery_seal': eq.Item('Bluecourt gallery seal', 'credential', eq.royal_seal(), palette=BLUE),
    'catalog_page': eq.Item('Gallery catalog page', 'document', eq.range_card()),
    'lead_glass_sample': eq.Item('Lead glass sample', 'craft', sample_tile(), palette=GREENWARE),
}


def add_set(board, pieces):
    for label, shape, x, z, turn, y, palette in pieces:
        board.add(label, shape, x, z, turn, y)
        board.set_palette(label, **palette)


def glazed_paving():
    shape = slab(40, 40, face=STONE, joint=JOINT, seed=117)
    for z in (-16, 15):
        for x in range(-17, 20, 5):
            box(5, 1, 2, BODY, x=x, y=2, z=z, sculpt=shape)
            box(1, 1, 1, MARK, x=x, y=2, z=z - 1, sculpt=shape)
    return shape


def striped_roof(width, depth):
    shape = Sculpt()
    for z in range(-depth // 2, depth // 2):
        height = (depth // 2 - abs(z)) // 4
        for x in range(-width // 2 + 2, width // 2, 4):
            box(4, 1, 1, BODY if (x // 4) % 2 else MARK, x=x, y=height, z=z, sculpt=shape)
    for z in (-depth // 2, depth // 2 - 1):
        box(width, 2, 2, WOOD, z=z, sculpt=shape)
    return shape


def glazed_portal(width, opening, height):
    shape = lp.deep_arch(width, height, 10, opening, STONE, BODY)
    for x in (-opening // 2 - 3, opening // 2 + 2):
        box(3, height - 8, 2, BODY, x=x, y=2, z=5, sculpt=shape)
        for y in range(4, height - 7, 4):
            box(1, 2, 1, MARK, x=x, y=y, z=6, sculpt=shape)
    box(width, 2, 13, BODY, y=height - 1, sculpt=shape)
    box(9, 8, 2, BODY, y=height - 9, z=5, sculpt=shape)
    glyph(shape, TILE_MARK, -2, height - 8, 6, MARK)
    return shape


def workshop_wall(width, height):
    shape = lp.panel(width, height, 5, STONE, JOINT, rows=True)
    box(width, 3, 7, WOOD, y=height - 2, sculpt=shape)
    for x in range(-width // 2 + 7, width // 2, 14):
        box(8, 12, 1, BODY, x=x, y=height - 19, z=3, sculpt=shape)
        box(6, 10, 1, GLASS, x=x, y=height - 18, z=4, sculpt=shape)
        box(1, 10, 1, METAL, x=x, y=height - 18, z=5, sculpt=shape)
        box(6, 1, 1, METAL, x=x, y=height - 13, z=5, sculpt=shape)
        box(10, 2, 2, MARK, x=x, y=height - 20, z=4, sculpt=shape)
    return shape


def pot(diameter, height, glaze):
    shape = box(diameter - 4, 2, diameter - 4, WOOD)
    for y in range(2, height - 1):
        width = diameter - (2 if y < 4 or y > height - 4 else 0)
        box(width, 1, width - 4, glaze if y % 5 else MARK, y=y, sculpt=shape)
        box(width - 4, 1, width, glaze if y % 5 else MARK, y=y, sculpt=shape)
    box(diameter - 3, 2, diameter - 3, MARK, y=height - 2, sculpt=shape)
    shape.cut(span(diameter - 6), (height - 4, height - 1), span(diameter - 6))
    return shape


def tile_rack():
    shape = shelf(29, 14, 26, face=WOOD)
    for y in (4, 12, 20):
        for x in (-8, 0, 8):
            box(7, 6, 2, BODY if (y + x) % 3 else GREEN, x=x, y=y, z=2, sculpt=shape)
            glyph(shape, DIAMOND, x - 1, y + 1, 3, MARK)
    return shape


def roof_frame(width, depth, height):
    shape = Sculpt()
    for x in (-width // 2 + 2, width // 2 - 2):
        for z in (-depth // 2 + 2, depth // 2 - 2):
            box(3, height, 3, WOOD, x=x, z=z, sculpt=shape)
            box(5, 4, 5, STONE, x=x, z=z, sculpt=shape)
            for i in range(4):
                box(3, 2, 2, WOOD, x=x - (i if x > 0 else -i),
                    y=height - 7 + i, z=z, sculpt=shape)
    for z in (-depth // 2 + 2, depth // 2 - 2):
        box(width, 3, 3, WOOD, y=height - 3, z=z, sculpt=shape)
    return shape


def loom():
    shape = Sculpt()
    for x in (-10, 10):
        box(4, 2, 16, WOOD, x=x, sculpt=shape)
    for x in (-10, 10):
        box(3, 22, 3, WOOD, x=x, y=2, z=-3, sculpt=shape)
    for y in (8, 20, 24):
        box(24, 2, 5, WOOD, y=y, z=-3, sculpt=shape)
    for x in range(-8, 10, 2):
        box(1, 12, 1, MARK, x=x, y=8, z=-1, sculpt=shape)
    for y in range(8):
        box(19 - y // 3, 1, 1, BODY if y % 4 < 2 else MARK, y=8 + y, z=0, sculpt=shape)
    box(19, 2, 2, MARK, y=12, z=7, sculpt=shape)
    for x in (-8, 8):
        box(2, 2, 10, WOOD, x=x, y=12, z=2, sculpt=shape)
    box(18, 10, 1, GLASS, y=12, z=0, sculpt=shape)
    moon = ('...###.', '..##...', '.##....', '###....', '###....', '.##...#', '..####.')
    glyph(shape, moon, -6, 14, 1, MARK)
    glyph(shape, ('.#.', '###', '.#.'), 3, 17, 1, GLOW)
    box(18, 1, 1, MARK, y=12, z=1, sculpt=shape)
    box(14, 2, 5, DARK, y=6, z=4, sculpt=shape)
    return shape


def firing_tongs():
    shape = Sculpt()
    for z in (-1, 1):
        box(10, 1, 1, METAL, x=-3, y=2, z=z, sculpt=shape)
        box(4, 1, 1, WOOD, x=-7, y=2, z=z, sculpt=shape)
        box(4, 1, 1, METAL, x=3, y=2, z=2 * z, sculpt=shape)
    box(3, 1, 3, MARK, x=4, sculpt=shape)
    for y, width, depth in ((1, 5, 3), (2, 7, 5), (3, 7, 5), (4, 5, 3)):
        box(width, 1, depth, GLASS, x=4, y=y, sculpt=shape)
        box(depth, 1, width, GLASS, x=4, y=y, sculpt=shape)
    for z in (-3, 3):
        box(1, 2, 1, GLOW, x=4, y=2, z=z, sculpt=shape)
        box(3, 1, 1, MARK, x=4, y=3, z=z, sculpt=shape)
    box(3, 1, 3, GLASS, x=4, y=5, sculpt=shape)
    box(5, 1, 5, GLOW, x=4, y=6, sculpt=shape)
    shape.cut((3, 5), 6, (-1, 1))
    return shape


def kiln():
    shape = box(34, 5, 29, STONE)
    for y in range(4, 29):
        inset = max(0, y - 17) // 2
        color = JOINT if y % 4 == 0 else BODY
        box(33 - 2 * inset, 1, 26 - inset, color, y=y, sculpt=shape)
    for y in range(4, 20):
        width = 15 - max(0, y - 13) * 2
        if width > 0:
            shape.cut(span(width), y, (4, 14))
            box(width, 1, 1, DARK if y > 5 else GLOW, y=y, z=5, sculpt=shape)
    for x, height in ((-5, 3), (-2, 5), (1, 4), (4, 6)):
        box(2, height, 2, GLOW, x=x, y=5, z=7, sculpt=shape)
        box(1, 2, 1, MARK, x=x, y=5 + height, z=7, sculpt=shape)
    box(10, 18, 10, JOINT, x=-6, y=26, z=-6, sculpt=shape)
    box(13, 2, 13, MARK, x=-6, y=42, z=-6, sculpt=shape)
    box(8, 4, 8, DARK, x=-6, y=44, z=-6, sculpt=shape)
    return shape


def guild_banner():
    shape = box(4, 3, 4, STONE)
    box(2, 32, 2, WOOD, y=2, sculpt=shape)
    box(16, 2, 3, METAL, x=5, y=28, sculpt=shape)
    box(11, 14, 1, BODY, x=6, y=14, z=1, sculpt=shape)
    box(7, 2, 1, BODY, x=6, y=12, z=1, sculpt=shape)
    glyph(shape, TILE_MARK, 4, 18, 2, MARK)
    return shape


def glass_mosaic():
    shape = box(25, 29, 3, DARK)
    for x in range(-10, 12, 4):
        for y in range(2, 28, 4):
            color = GLASS if (x + y) % 3 else GLOW
            box(3, 3, 1, color, x=x, y=y, z=2, sculpt=shape)
    glyph(shape, TILE_MARK, -4, 10, 3, MARK, scale=2)
    return shape


def terrain(board):
    street = [(x, 12) for x in range(16, 45, 4)]
    yard = [(x, z) for x in range(16, 45, 4) for z in (4, 8, 16, 20, 24, 28)]
    floors(board, 'Bluecourt glazed trade lane', glazed_paving(), street)
    board.set_palette('Bluecourt glazed trade lane', **BLUE)
    floors(board, 'Bluecourt tan workshop cobbles', slab(40, 40, face=STONE, joint=JOINT, seed=111), yard)
    board.set_palette('Bluecourt tan workshop cobbles', **TERRACOTTA)
    floors(board, 'Old market connection stones', slab(40, 40, face=STONE, joint=JOINT, seed=116),
           [(12, 16), (12, 20), (12, 24), (8, 16), (8, 20), (8, 24)])
    board.set_palette('Old market connection stones', **BLUE)


def tile_market(board):
    add_set(board, (
        ('Bluecourt trade lane gate', glazed_portal(40, 24, 35), 17.4, 15.95, 3, 0, BLUE),
        ('Bluecourt courtyard sign', guild_banner(), 16.6, 14.6, 3, 0, BLUE),
        ('Tile order vendor frame', roof_frame(35, 28, 25), 18.6, 9.1, 0, 0, BLUE),
        ('Indigo tile market awning', striped_roof(39, 32), 18.6, 9.1, 0, 2.5, BLUE),
        ('Kiln work stall frame', roof_frame(76, 34, 34), 25.98, 20.47, 2, 0, TERRACOTTA),
        ('Copper kiln stall cover', striped_roof(79, 38), 25.98, 20.47, 2, 3.4, TERRACOTTA),
        ('Tile order vendor table', lp.counter(26, 11, WOOD, MARK, shelf=True), 18.6, 9.55, 0, 0, BLUE),
        ('Bluecourt tile display', tile_rack(), 18.9, 7.9, 0, 0, BLUE),
        ('Greenware tile display', tile_rack(), 26.8, 21.65, 2, 0, GREENWARE),
        ('Tile stall catalog basket', lp.produce_bin(STONE), 18.05, 9.55, 0, .95, ROSE),
        ('Blank tile drying bench', lp.counter(25, 12, WOOD, MARK), 21.75, 17.7, 0, 0, TERRACOTTA),
        ('Clay sample drying tray', sample_tile(), 21.15, 17.75, 0, .95, TERRACOTTA),
        ('Clay pot with raw slip', pot(12, 17, BODY), 20.45, 18.2, 0, 0, TERRACOTTA),
        ('Tall green glaze jar', pot(12, 19, GREEN), 22.8, 20.15, 0, 0, GREENWARE),
        ('Turquoise ware glaze tray', lp.produce_bin(GREEN), 23.9, 21.15, 2, .95, GREENWARE),
        ('Glaze mixing worktop', lp.counter(27, 12, WOOD, MARK, shelf=True), 24.1, 21.14, 2, 0, GREENWARE),
        ('Kiln house masonry wall', workshop_wall(61, 36), 25.3, 22.0, 2, 0, TERRACOTTA),
        ('Kiln house end return', workshop_wall(38, 33), 22.1, 21.2, 1, 0, TERRACOTTA),
        ('Bluecourt dome kiln', kiln(), 27.2, 20.1, 2, 0, TERRACOTTA),
        ('Kiln ember grate', lp.drainage_grate(), 27.15, 18.64, 2, -.175, TERRACOTTA),
        ('Glazed vessel in firing tongs', firing_tongs(), 26.89, 18.43, 0, 1.03, BLUE),
        ('Kiln paddle rack', lp.fence(20, 19, WOOD), 28.6, 20.6, 2, 0, TERRACOTTA),
        ('Press mold bench', lp.counter(20, 11, WOOD, MARK, shelf=True), 29.75, 17.05, 3, 0, BLUE),
        ('Glazed tile press mold', sample_tile(), 29.65, 17.05, 3, 1.0, BLUE),
        ('Tile workshop crate', lp.crate(15, 10, 14, WOOD, MARK), 21.6, 19.5, 1, 0, TERRACOTTA),
        ('Stacked tile supply sacks', lp.latched_case(14, 8, 14, STONE, WOOD, MARK), 28.6, 22.65, 2, 0, GREENWARE),
        ('Chimney shop ridge', lp.pitched_roof(50, 28, BODY, WOOD), 27.6, 22.0, 2, 3.7, TERRACOTTA),
        ('Tall porcelain vessel', pot(14, 21, BODY), 19.75, 8.6, 0, 0, BLUE),
        ('Short kiln storage pot', pot(9, 10, STONE), 25.3, 21.3, 0, 0, TERRACOTTA),
    ))
    for x, z, turn in ((28.6, 19.9, 2), (20.3, 9.35, 3), (30.6, 16.9, 3)):
        board.place('Short kiln storage pot', x, z, turn)
    board.place('Short kiln storage pot', 21.6, 19.52, 1, 1.0)
    for x, z, turn in ((20.0, 17.65, 1), (25.6, 21.7, 2), (29.91, 21.45, 2)):
        board.place('Tile workshop crate', x, z, turn)
    add_set(board, (
        ('Potters court back building', workshop_wall(58, 45), 20.75, 24.9, 2, 0, TERRACOTTA),
        ('Potters court back building roof', lp.pitched_roof(65, 23, BODY, WOOD),
         20.75, 24.9, 2, 4.5, BLUE),
        ('Potters court workroom window', glass_mosaic(), 20.75, 24.6, 2, 1.15, GREENWARE),
    ))
    for x in (14.95, 26.55, 32.35):
        board.place('Potters court back building', x, 26.15, 2)
        board.place('Potters court back building roof', x, 26.15, 2, 4.5)
        board.place('Potters court workroom window', x, 25.85, 2, 1.15)
    for x, z in ((11.1, 22.75), (14.05, 23.4), (17.7, 24.15)):
        board.place('Ridge broadleaf', x, z)
        board.place('Ridge fir', x - 1.3, z + 1.85)
    board.place('Market bench', 17.05, 13.75, 3)
    board.place('Guild sign', 19.9, 10.5)
    board.place('Wagon frame', 17.5, 17.3, 1)


def textile_market(board):
    add_set(board, (
        ('Ribbon workshop back wall', workshop_wall(72, 37), 26.1, 5.45, 0, 0, ROSE),
        ('Ribbon shop end bay', workshop_wall(38, 32), 29.65, 7.35, 3, 0, BLUE),
        ('Weavers market shed', roof_frame(67, 44, 32), 26.1, 7.3, 0, 0, ROSE),
        ('Ribbon workshop striped awning', striped_roof(74, 47), 26.1, 7.3, 0, 3.2, ROSE),
        ('Bluecourt ribbon loom', loom(), 27.65, 7.35, 0, 0, ROSE),
        ('Spool sorting table', lp.counter(24, 11, WOOD, MARK, shelf=True), 23.65, 8.2, 0, 0, BLUE),
        ('Carved thread spools', lp.drum(6, 5, BODY, MARK), 24.67, 8.50, 0, .95, ROSE),
        ('Ribbon bolt wall rack', shelf(25, 13, 25, face=WOOD), 29.2, 7.3, 3, 0, GREENWARE),
        ('Weavers tall fabric bolt', lp.drum(10, 21, BODY, MARK), 29.17, 7.89, 1, 0, ROSE),
        ('Weavers blue fabric bolt', lp.drum(9, 17, BODY, MARK), 29.57, 8.3, 1, 0, BLUE),
        ('Ceremonial ribbon banner', guild_banner(), 30.1, 9.75, 0, 0, ROSE),
        ('Wool basket', lp.produce_bin(MARK), 25.98, 6.38, 0, 0, ROSE),
        ('Bluecourt finished ribbon cabinet', lp.case(15, 18, 10, WOOD, BODY, screen=True), 30.65, 14.65, 3, 0, ROSE),
        ('Market gallery side arch', glazed_portal(37, 24, 32), 34.0, 19.4, 3, 0, ROSE),
        ('Gallery outer divider wall', lp.panel(42, 23, 7, STONE, BODY, rows=True), 34, 15.6, 1, 0, BLUE),
        ('Gallery ribbon exchange pedestal', lp.case(10, 16, 8, WOOD, DARK, screen=True), 32.55, 20.6, 3, 0, ROSE),
    ))
    board.place('Gallery outer divider wall', 34, 8.25, 1)
    board.place('Gallery outer divider wall', 34, 23.3, 1)
    for x in (19.25, 32.9):
        board.place('Ribbon workshop back wall', x, 4.6)
        board.place('Ribbon workshop striped awning', x, 4.75, height=3.7)
    board.place('Weavers blue fabric bolt', 23.0, 7.46)
    board.place('Wool basket', 28.9, 8.32, 2)
    board.place('Square lantern', 32.9, 17.85)


def exhibition(board):
    add_set(board, (
        ('Bluecourt main gallery arch', glazed_portal(43, 25, 43), 34, 12.0, 3, 0, BLUE),
        ('Bluecourt main arch crosspiece', lp.pitched_roof(49, 20, BODY, MARK), 34, 12.0, 3, 4.3, BLUE),
        ('Gallery admission tile stand', lp.post(18, WOOD, MARK), 32.3, 13.25, 2, 0, BLUE),
        ('Glass gallery lane shelter', roof_frame(47, 42, 34), 39.9, 8.35, 0, 0, GREENWARE),
        ('Glass gallery green roof', striped_roof(50, 45), 39.9, 8.35, 0, 3.4, GREENWARE),
        ('Glass gallery exterior wall', workshop_wall(62, 42), 39.8, 6.18, 0, 0, GREENWARE),
        ('Crown mosaic glass window', glass_mosaic(), 39.8, 6.45, 0, 1.0, GREENWARE),
        ('Glass exhibit support table', lp.counter(23, 12, WOOD, MARK), 39.85, 8.4, 0, 0, GREENWARE),
        ('Glass sample plinth', lp.crate(12, 5, 12, STONE, BODY), 39.88, 8.45, 0, 1.0, GREENWARE),
        ('Tile exhibit wall and plinth', tile_rack(), 39.45, 15.4, 2, 0, BLUE),
        ('Exhibit inventory desk', lp.counter(23, 11, WOOD, MARK, shelf=True), 38.3, 12.95, 2, 0, BLUE),
        ('Exhibit inventory folios', lp.produce_bin(STONE), 38.3, 12.9, 2, .96, TERRACOTTA),
        ('Gallery dais arch', glazed_portal(57, 30, 49), 44.1, 12, 3, 0, BLUE),
        ('Gallery paired lanterns', lp.post(24, METAL, GLOW, arm=True), 42.1, 10.65, 3, 0, BLUE),
        ('Gallery exhibit registration desk', lp.counter(28, 11, WOOD, MARK, shelf=True), 43.85, 12.0, 3, 0, BLUE),
        ('Bluecourt curator register box', lp.latched_case(12, 8, 10, BODY, WOOD, MARK), 43.85, 12.5, 3, .95, BLUE),
        ('Gallery ceramic crest', glass_mosaic(), 44.1, 12, 3, 4.8, BLUE),
        ('Gallery tiled screen', glazed_portal(43, 14, 36), 44.2, 19.65, 3, 0, BLUE),
    ))
    board.place('Gallery paired lanterns', 42.1, 13.3, 1)
    board.place('Tall porcelain vessel', 41.7, 13.45)
    board.place('Clay pot with raw slip', 40.25, 15.35)
    board.place('Bluecourt courtyard sign', 37.75, 14.75, 2)
    board.place('Market bench', 37.6, 16.3, 2)


def gameplay(board):
    p = board.prop_id
    point = board.point
    board.entry, board.exit = 'market_approach', 'gallery_register'
    board.use = 'Take a Bluecourt exhibit order. Make a glazed tile or weave a ribbon, then register it at the gallery.'
    point('market_approach', 'Market Keep approach', 11.3, 11.8,
          actions=(action('inspect', assets=(p('Merchant counter'), p('Guild sign'))),))
    point('tile_vendor', 'Collect the guild exhibit order', 18.6, 10.9,
          actions=(action('gather', assets=('guild_order', p('Tile order vendor table')), reward='exhibit_order'),))
    point('clay_bench', 'Select a clay tile blank', 21.75, 16.65,
          actions=(action('gather', assets=('clay_blank', p('Blank tile drying bench')),
                          requires=('exhibit_order',), reward='tile_blank_ready'),))
    point('glaze_station', 'Mix the turquoise glaze', 24.1, 19.65,
          actions=(action('craft', assets=('glaze_jar', p('Glaze mixing worktop'), 'glaze_keeper'),
                          requires=('tile_blank_ready',), reward='glaze_mixed'),))
    point('kiln', 'Fire the glazed tile', 27.25, 17.85,
          actions=(action('craft', assets=('bluecourt_tile', p('Bluecourt dome kiln'), 'tile_maker'),
                          requires=('glaze_mixed',), reward='tile_fired'),))
    point('tile_press', 'Stamp the tile with the guild mark', 28.75, 17.05,
          actions=(action('inspect', assets=('bluecourt_tile', p('Glazed tile press mold')),
                          requires=('tile_fired',), reward='tile_marked'),))
    point('thread_stall', 'Choose thread from the spool table', 23.75, 9.7,
          actions=(action('gather', assets=('ribbon_spool', p('Carved thread spools')),
                          requires=('exhibit_order',), reward='thread_chosen'),))
    point('ribbon_loom', 'Weave the gallery ribbon', 27.65, 9.05,
          actions=(action('craft', assets=('loom_shuttle', 'exhibit_ribbon', p('Bluecourt ribbon loom'), 'ribbon_weaver'),
                          requires=('thread_chosen',), reward='ribbon_woven'),))
    point('main_gallery_gate', 'Present the stamped tile', 32.5, 12.0,
          actions=(action('unlock', assets=('bluecourt_tile', 'gallery_seal', p('Bluecourt main gallery arch')),
                          requires=('tile_marked',), reward='tile_gate_open'),))
    point('ribbon_gallery_gate', 'Present the woven ribbon', 32.5, 19.4,
          actions=(action('unlock', assets=('exhibit_ribbon', p('Gallery ribbon exchange pedestal')),
                          requires=('ribbon_woven',), reward='ribbon_gate_open'),))
    point('gallery_intake', 'Catalog the exhibit', 38.3, 12.0,
          actions=(action('report', assets=('catalog_page', p('Exhibit inventory desk')),
                          reward='entry_cataloged'),))
    point('glass_exhibit', 'Inspect the crown glass panel', 40, 9.7,
          actions=(action('observe', assets=('lead_glass_sample', p('Crown mosaic glass window'))),))
    point('gallery_register', 'Register the exhibit with the curator', 42.75, 12.0,
          actions=(action('extract', assets=('guild_curator', 'catalog_page', p('Gallery exhibit registration desk')),
                          requires=('entry_cataloged',)),))
    board.link('market_approach', 'tile_vendor', [12.5, 0, 15.95], [17.65, 0, 15.95], [18.75, 0, 13.65])
    board.link('tile_vendor', 'clay_bench', [20.3, 0, 12], [21.75, 0, 14.6])
    board.link('tile_vendor', 'thread_stall', [21.0, 0, 10.9])
    board.link('thread_stall', 'ribbon_loom', [25.1, 0, 9.7])
    board.link('ribbon_loom', 'main_gallery_gate', [28.0, 0, 11.8])
    board.link('ribbon_loom', 'ribbon_gallery_gate', [28.0, 0, 11.8], [31.6, 0, 11.8], [31.6, 0, 19.4])
    board.link('clay_bench', 'glaze_station', [23.95, 0, 16.65], [24.1, 0, 18.75])
    board.link('glaze_station', 'kiln', [25.4, 0, 18.4])
    board.link('kiln', 'tile_press')
    board.link('tile_press', 'main_gallery_gate', [28.75, 0, 15.4], [29.45, 0, 13.3], [31.4, 0, 12])
    board.link('main_gallery_gate', 'gallery_intake', requires=('tile_gate_open',))
    board.link('ribbon_gallery_gate', 'gallery_intake', [36.25, 0, 19.4], [36.25, 0, 12.0],
               requires=('ribbon_gate_open',))
    board.link('gallery_intake', 'glass_exhibit', [38.3, 0, 10.6])
    board.link('glass_exhibit', 'gallery_register', [41.25, 0, 11.4])
    board.link('gallery_intake', 'gallery_register')


def extend(board):
    for shot in board.shots:
        if shot['label'] == 'Coppersmith court':
            shot['eye'] = [-7.22, 1.78, 7.4]
    terrain(board)
    tile_market(board)
    textile_market(board)
    exhibition(board)
    gameplay(board)
    for asset, x, z, yaw, pose in (
        ('tile_maker', 19.25, 10.45, 205, ('Reach', .36)),
        ('glaze_keeper', 24.1, 20.3, 0, ('Reach', .36)),
        ('guild_curator', 43.0, 12.95, 215, None),
    ):
        board.stage_actor(asset, x, z, yaw=yaw, pose=pose)
    board.stage_work('tile_maker', 'TurnGlaze', 25.87, 18.51, yaw=98,
                     left=(26.26, 1.28, 18.32), right=(26.26, 1.28, 18.53), pitch=10)
    board.stage_work('ribbon_weaver', 'PassShuttle', 26.29, 7.90, yaw=65,
                     left=(26.84, 1.32, 7.96), right=(26.71, 1.32, 8.12), look=-22)
    board.stage_work('ribbon_weaver', 'WindSpool', 25.12, 8.24, yaw=-56,
                     right=(24.72, 1.32, 8.51), pitch=8)
    board.light(26.4, 2.05, 17.7, '#fff1c7', 1180, 7)
    board.light(25.9, 1.95, 9.23, '#d5efff', 580, 5)
    board.light(27.55, 2.55, 9.35, '#ffe7c5', 1250, 7)
    board.light(24.3, 2.3, 9.55, '#ffecd5', 790, 6)
    board.light(26.9, 1.25, 18.85, '#ffab68', 360, 5.5)
    board.light(25.1, 2.7, 20.25, '#ffe1a5', 540, 8)
    board.light(26.3, 2.85, 8.1, '#ffdcaa', 500, 8)
    board.light(41.5, 3.2, 11.5, '#e8efdf', 620, 8)
    board.shot('Bluecourt glazing and kiln', [27.72, 2.06, 13.62], [26.35, 1.56, 19.32])
    board.shot('Bluecourt ribbon workshop', [26.78, 2.13, 13.65], [26.12, 1.64, 7.55])
    board.shot('Bluecourt guild exhibition', [37.45, 2.75, 14.25], [41.1, 2.1, 9.9])
