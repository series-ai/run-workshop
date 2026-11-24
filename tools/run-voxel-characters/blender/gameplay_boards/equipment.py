"""Hand-scale voxel equipment, with named categories and local grip origins."""

from dataclasses import dataclass

import voxchar as vk
from creature_kit import Sculpt
from level_geometry import box, span

from .common import BODY, DARK, GLASS, GLOW, GREEN, MARK, METAL, RUBBER, WOOD, glyph

CELL = 0.025
WOOD_GRAIN = vk.vox('leather', -0.32)
METAL_EDGE = vk.vox('metal', 0.44, mottle=False)


@dataclass(frozen=True)
class Item:
    label: str
    kind: str
    sculpt: Sculpt
    grip: tuple | None = None
    palette: dict | None = None


def pack(width, height, depth, *, shell=BODY, badge=None):
    shape = box(width - 2, height, depth - 2, shell)
    box(width, height - 4, depth, shell, y=2, sculpt=shape)
    box(width - 2, 1, depth - 1, DARK, y=1, sculpt=shape)
    box(width - 1, 1, depth, DARK, y=height - 2, sculpt=shape)
    for x in (-width // 3, width // 3):
        box(2, height - 2, depth + 1, DARK, x=x, y=1, sculpt=shape)
        box(2, 2, 2, METAL, x=x, y=height // 2, z=depth // 2, sculpt=shape)
        box(2, 1, 1, METAL_EDGE, x=x, y=height // 2 + 1, z=depth // 2, sculpt=shape)
    grip = width - 4
    for x in (-grip // 2 + 1, grip // 2 - 1):
        box(2, 3, 3, METAL, x=x, y=height - 1, sculpt=shape)
    box(grip, 1, 3, DARK, y=height + 2, sculpt=shape)
    if badge:
        glyph(shape, badge, -1, height // 2 - 1, depth // 2 + 1, MARK)
    return shape


def handled(kind):
    lengths = {'pick': 27, 'hammer': 17, 'axe': 21, 'bar': 25, 'cutters': 19}
    length = lengths[kind]
    shape = box(3, length, 3, METAL if kind in ('bar', 'cutters') else WOOD)
    for y in range(0, 8, 2):
        box(4, 1, 4, DARK, y=y, sculpt=shape)
    if kind in ('pick', 'hammer', 'axe'):
        for x, y, height in ((-1, 8, 4), (0, 12, 3), (1, length - 6, 5)):
            box(1, height, 1, WOOD_GRAIN, x=x, y=y, z=1, sculpt=shape)
        box(4, 2, 4, METAL, y=length - 3, sculpt=shape)
    if kind == 'pick':
        for x in range(-8, 9, 2):
            y = length - abs(x) // 3
            box(3, 3 if abs(x) < 6 else 1, 3, METAL, x=x, y=y, sculpt=shape)
    elif kind == 'hammer':
        box(13, 6, 6, DARK, y=length - 3, sculpt=shape)
        for x in (-7, 6):
            box(2, 5, 5, METAL, x=x, y=length - 2, sculpt=shape)
    elif kind == 'axe':
        for x in range(1, 10, 2):
            box(2, 4 + x // 2, 2, METAL, x=x, y=length - 5 - x // 4, sculpt=shape)
        glyph(shape, ('#.#', '.#.', '#.#'), 3, length - 5, 2, GLOW)
    elif kind == 'bar':
        box(4, 6, 3, METAL, x=1, y=length - 3, sculpt=shape)
        box(6, 2, 2, METAL, x=4, y=length + 1, sculpt=shape)
    else:
        for side in (-1, 1):
            box(3, 12, 3, DARK, x=side * 3, y=1, sculpt=shape)
            box(3, 8, 4, METAL, x=side, y=length - 4, sculpt=shape)
        box(7, 3, 5, METAL, y=length - 2, sculpt=shape)
    return shape


def tube(length, width, color):
    shape = box(width - 2, width, length, color)
    box(width, width - 2, length, color, y=1, sculpt=shape)
    return shape


def lantern():
    shape = box(9, 2, 8, DARK)
    box(5, 8, 5, GLOW, y=2, sculpt=shape)
    for x in (-4, 4):
        for z in (-3, 3):
            box(1, 8, 1, METAL, x=x, y=2, z=z, sculpt=shape)
    box(9, 2, 8, DARK, y=10, sculpt=shape)
    box(7, 1, 6, METAL, y=11, sculpt=shape)
    box(4, 1, 1, METAL_EDGE, y=10, z=3, sculpt=shape)
    for x in (-2, 2):
        box(1, 4, 2, METAL, x=x, y=12, sculpt=shape)
    box(5, 1, 2, METAL, y=15, sculpt=shape)
    return shape


def handheld_light():
    shape = tube(15, 5, DARK)
    box(7, 6, 5, METAL, y=-1, z=8, sculpt=shape)
    box(5, 4, 1, GLOW, y=0, z=11, sculpt=shape)
    box(3, 1, 3, MARK, y=5, z=2, sculpt=shape)
    return shape


def crystal():
    shape = Sculpt()
    for x, y, height in ((-3, 1, 9), (1, 0, 16), (5, 0, 7)):
        for step in range(height):
            box(max(1, 4 - step // 5), 1, max(1, 5 - step // 6), GLASS if step % 4 else GLOW,
                x=x + step // 8, y=y + step, sculpt=shape)
    return shape


def mineral(color, seed):
    shape = Sculpt()
    for x, y, z, size in ((-3, 0, 0, 5), (1, 0, -3, 6), (3, 0, 2, 5), (-2, 2, 2, 4)):
        box(size, 3 + (x + seed) % 3, size - 1, DARK, x=x, y=y, z=z, sculpt=shape)
        box(size - 1, 1, size - 1, color, x=x, y=y + 2, z=z, sculpt=shape)
    return shape


def field_weapon(role):
    length = {'bolt': 46, 'smg': 29, 'shotgun': 39, 'flare': 13, 'sidearm': 12}[role]
    shape = box(4, 4, max(8, length - 19), WOOD if role != 'smg' else DARK, y=5, z=-length // 4 + 3)
    box(4, 4, 12, DARK, y=6, z=0, sculpt=shape)
    box(2, 3, length // 2 + 4, METAL, y=8, z=length // 4, sculpt=shape)
    box(3, 7, 4, WOOD, y=0, z=-4, sculpt=shape)
    box(3, 1, 6, METAL, y=4, z=1, sculpt=shape)
    if role in ('bolt', 'smg', 'shotgun'):
        box(4, 7, 7, WOOD if role != 'smg' else DARK, y=3, z=-length // 2 + 4, sculpt=shape)
        box(4, 4, 9, METAL if role == 'smg' else WOOD, y=5, z=11, sculpt=shape)
        box(2, 2, 2, METAL, y=10, z=length // 2 - 2, sculpt=shape)
    if role == 'smg':
        box(3, 8, 4, METAL, y=0, z=3, sculpt=shape)
    if role == 'flare':
        box(5, 5, 8, BODY, y=6, z=5, sculpt=shape)
        box(4, 1, 2, MARK, y=11, z=5, sculpt=shape)
    return shape


def binoculars():
    shape = box(5, 4, 6, DARK, y=1)
    for x in (-4, 4):
        box(6, 6, 11, DARK, x=x, sculpt=shape)
        box(7, 7, 3, METAL, x=x, z=5, sculpt=shape)
        box(5, 5, 1, GLASS, x=x, y=1, z=7, sculpt=shape)
    return shape


def radio():
    shape = pack(13, 14, 7, shell=GREEN)
    box(8, 5, 1, DARK, y=5, z=4, sculpt=shape)
    for x in (-3, 0, 3):
        box(2, 2, 2, METAL, x=x, y=11, z=4, sculpt=shape)
    for y in range(4, 9, 2):
        box(3, 1, 1, METAL, x=2, y=y, z=4, sculpt=shape)
    box(3, 3, 2, DARK, x=4, y=13, z=-2, sculpt=shape)
    box(1, 15, 1, METAL, x=4, y=15, z=-2, sculpt=shape)
    return shape


def loops():
    shape = Sculpt()
    for y in (0, 2, 4):
        box(11, 2, 8, WOOD, y=y, sculpt=shape)
        shape.cut(span(5), (y, y + 1), span(3))
    box(3, 6, 9, MARK, x=-3, sculpt=shape)
    return shape


def face_protection():
    shape = box(12, 7, 4, DARK)
    box(8, 6, 4, RUBBER, y=0, z=3, sculpt=shape)
    for x in (-3, 3):
        box(5, 5, 3, METAL, x=x, y=0, z=5, sculpt=shape)
    box(8, 2, 3, GLASS, y=6, z=1, sculpt=shape)
    return shape


def shield():
    shape = box(16, 18, 2, METAL)
    for i in range(1, 6):
        box(16 - i * 2, 1, 2, METAL, y=-i, sculpt=shape)
    for x in (-7, 7):
        box(1, 16, 1, MARK, x=x, y=1, z=1, sculpt=shape)
    glyph(shape, ('.#.', '###', '#.#', '.#.'), -2, 5, 1, MARK, 2)
    box(7, 2, 2, DARK, y=7, z=-2, sculpt=shape)
    return shape


def royal_seal():
    shape = box(8, 2, 4, DARK)
    for y, width in enumerate((5, 7, 9, 11, 11, 11, 9, 7, 5), start=1):
        box(width, 1, 3, MARK, y=y, z=1, sculpt=shape)
    return glyph(shape, ('.#.', '###', '#.#', '###'), -1, 3, 2, METAL)


def canteen():
    shape = Sculpt()
    for y, width in enumerate((5, 7, 9, 9, 11, 11, 11, 9, 9, 7, 5)):
        box(width, 1, 5, GREEN, y=y, sculpt=shape)
    box(3, 2, 3, METAL, y=10, sculpt=shape)
    box(5, 1, 4, DARK, y=12, sculpt=shape)
    for y in (3, 4, 6):
        box(7, 1, 1, WOOD, y=y, z=3, sculpt=shape)
    box(2, 8, 1, DARK, x=3, y=1, z=-3, sculpt=shape)
    return shape


def relay_fuses():
    shape = box(10, 3, 7, DARK)
    box(8, 1, 5, METAL, y=2, sculpt=shape)
    for x in (-3, 0, 3):
        box(2, 2, 4, GLASS, x=x, y=3, sculpt=shape)
        for z in (-2, 2):
            box(2, 2, 1, METAL_EDGE, x=x, y=3, z=z, sculpt=shape)
    box(2, 2, 1, MARK, x=2, y=1, z=3, sculpt=shape)
    return shape


def rescue_beacon():
    shape = box(10, 9, 7, BODY)
    box(12, 2, 8, RUBBER, sculpt=shape)
    box(6, 4, 1, GLOW, y=4, z=4, sculpt=shape)
    box(11, 2, 8, DARK, y=8, sculpt=shape)
    for x in (-3, 3):
        box(2, 5, 3, DARK, x=x, y=10, sculpt=shape)
    box(8, 2, 3, DARK, y=14, sculpt=shape)
    box(1, 11, 1, METAL, x=4, y=9, z=-2, sculpt=shape)
    return shape


def folded_map():
    shape = box(14, 1, 10, BODY)
    box(10, 1, 10, BODY, x=-1, y=1, sculpt=shape)
    box(8, 1, 7, MARK, x=-2, y=2, z=1, sculpt=shape)
    for x, z, width in ((-4, -1, 2), (-2, 0, 2), (0, 1, 3), (2, 2, 2)):
        box(width, 1, 1, WOOD, x=x, y=2, z=z, sculpt=shape)
    box(1, 1, 5, BODY, x=-2, y=2, z=1, sculpt=shape)
    return shape


def cargo_crate():
    shape = box(19, 10, 13, WOOD, y=1)
    for y in (0, 10):
        box(20, 2, 14, WOOD_GRAIN, y=y, sculpt=shape)
    for x in (-7, 6):
        for z in (-7, 6):
            box(2, 12, 1, WOOD_GRAIN, x=x, z=z, sculpt=shape)
            box(1, 1, 1, METAL, x=x, y=9, z=z, sculpt=shape)
    for z in (-6, 5):
        box(20, 1, 1, WOOD_GRAIN, y=5, z=z, sculpt=shape)
    box(5, 2, 1, MARK, x=3, y=7, z=7, sculpt=shape)
    return shape


def fuel_can():
    shape = box(10, 12, 6, GREEN)
    box(8, 2, 6, GREEN, y=12, sculpt=shape)
    for y in (1, 10):
        box(8, 1, 7, DARK, y=y, sculpt=shape)
    for x, y in ((-2, 3), (-1, 4), (0, 5), (1, 6), (2, 7), (2, 3), (-2, 7), (-1, 6), (1, 4)):
        box(1, 1, 1, BODY, x=x, y=y, z=3, sculpt=shape)
    box(3, 2, 3, DARK, x=-3, y=13, sculpt=shape)
    for x in (0, 4):
        box(1, 3, 2, GREEN, x=x, y=13, sculpt=shape)
    box(5, 1, 2, GREEN, x=2, y=16, sculpt=shape)
    return shape


def field_spade():
    shape = box(2, 23, 2, WOOD)
    for x in (-2, 2):
        box(2, 5, 2, WOOD_GRAIN, x=x, sculpt=shape)
    box(6, 2, 3, DARK, sculpt=shape)
    box(9, 7, 2, METAL, y=22, sculpt=shape)
    for y, width in ((29, 7), (30, 5), (31, 3)):
        box(width, 1, 1, METAL_EDGE, y=y, sculpt=shape)
    box(3, 4, 3, DARK, y=21, sculpt=shape)
    return shape


def dial(case, face):
    shape = Sculpt()
    for y, width in enumerate((5, 7, 9, 11, 11, 11, 11, 11, 9, 7, 5)):
        box(width, 1, 4, case, y=y, sculpt=shape)
        if 1 < y < 9:
            box(width - 4, 1, 1, face, y=y, z=2, sculpt=shape)
    box(2, 1, 1, METAL_EDGE, y=5, z=3, sculpt=shape)
    return shape


def pressure_gauge():
    shape = dial(METAL, MARK)
    box(3, 3, 3, WOOD, y=-2, sculpt=shape)
    box(4, 1, 4, METAL_EDGE, y=-2, sculpt=shape)
    for x, y in ((-3, 4), (-2, 7), (0, 8), (2, 7), (3, 4)):
        box(1, 1, 1, DARK, x=x, y=y, z=2, sculpt=shape)
    box(1, 3, 1, DARK, x=1, y=5, z=3, sculpt=shape)
    box(1, 1, 1, DARK, x=2, y=8, z=3, sculpt=shape)
    return shape


def sample_vial():
    shape = box(4, 14, 4, GLASS)
    box(6, 11, 2, GLASS, y=1, sculpt=shape)
    box(4, 8, 1, GREEN, y=1, z=2, sculpt=shape)
    box(4, 3, 1, MARK, y=8, z=2, sculpt=shape)
    box(5, 2, 5, METAL, y=12, sculpt=shape)
    box(3, 1, 4, DARK, y=14, sculpt=shape)
    return shape


def survey_compass():
    shape = dial(WOOD, DARK)
    for sign in (-1, 1):
        for step in range(1, 4):
            box(1, 1, 1, MARK if sign == 1 else GREEN, x=sign * step // 2,
                y=5 + sign * step, z=2, sculpt=shape)
    box(4, 1, 2, METAL_EDGE, y=10, z=-2, sculpt=shape)
    box(1, 2, 1, MARK, y=10, z=2, sculpt=shape)
    return shape


def water_test_kit():
    shape = box(14, 3, 8, DARK)
    box(12, 1, 6, MARK, y=2, sculpt=shape)
    for x, color in ((-4, GLASS), (0, GREEN), (4, GLASS)):
        box(2, 6, 2, color, x=x, y=3, sculpt=shape)
        box(3, 1, 3, METAL, x=x, y=8, sculpt=shape)
        box(2, 2, 1, MARK, x=x, y=5, z=1, sculpt=shape)
    box(14, 4, 1, BODY, y=3, z=-4, sculpt=shape)
    box(6, 1, 3, DARK, y=7, z=-3, sculpt=shape)
    return shape


def tram_service_key():
    shape = box(3, 17, 3, METAL)
    box(4, 2, 4, METAL_EDGE, y=13, sculpt=shape)
    box(4, 2, 3, METAL, x=2, y=15, sculpt=shape)
    box(3, 1, 2, METAL_EDGE, x=-2, y=17, sculpt=shape)
    box(11, 3, 4, RUBBER, sculpt=shape)
    for x in (-4, 0, 4):
        box(1, 1, 1, MARK, x=x, y=1, z=2, sculpt=shape)
    return shape


def battery_pack():
    shape = box(12, 8, 7, BODY)
    box(14, 1, 8, DARK, y=0, sculpt=shape)
    box(13, 2, 8, DARK, y=7, sculpt=shape)
    for x in (-5, -2, 1, 4):
        box(1, 5, 1, DARK, x=x, y=1, z=-4, sculpt=shape)
    for x, color in ((-4, METAL), (4, WOOD)):
        box(2, 2, 2, color, x=x, y=8, z=2, sculpt=shape)
    box(6, 3, 1, MARK, y=3, z=4, sculpt=shape)
    box(6, 1, 1, GREEN, y=5, z=4, sculpt=shape)
    return shape


def rail_signal_flag():
    shape = box(2, 24, 2, WOOD)
    box(3, 5, 3, RUBBER, sculpt=shape)
    for x, top in enumerate((25, 25, 24, 24, 23, 23, 24, 24, 25, 25, 24), start=1):
        box(1, 11, 1, BODY, x=x, y=top - 10, z=x // 4, sculpt=shape)
        box(1, 2, 1, MARK, x=x, y=top - 3 - x // 2, z=x // 4, sculpt=shape)
    return shape


def depot_tool_roll():
    shape = box(15, 3, 6, GREEN, y=1)
    box(13, 5, 4, GREEN, sculpt=shape)
    for x in (-5, 4):
        box(2, 5, 7, WOOD, x=x, sculpt=shape)
        box(2, 1, 2, METAL, x=x, y=5, z=1, sculpt=shape)
    for x in (-7, 6):
        box(1, 2, 4, DARK, x=x, y=1, sculpt=shape)
        box(1, 1, 3, MARK, x=x, y=3, z=1, sculpt=shape)
    return shape


def range_card():
    shape = box(10, 2, 12, WOOD)
    box(8, 1, 10, MARK, y=2, sculpt=shape)
    box(8, 1, 2, METAL, y=3, z=-4, sculpt=shape)
    for z, width in ((-2, 6), (0, 4), (2, 6)):
        box(width, 1, 1, DARK, y=2, z=z, sculpt=shape)
    box(1, 1, 9, GREEN, x=4, y=3, z=1, sculpt=shape)
    return shape


def herb_bunch():
    shape = box(5, 6, 3, WOOD)
    for x, h in ((-3, 10), (-1, 12), (1, 14), (3, 11)):
        box(1, h, 1, GREEN, x=x, y=2, sculpt=shape)
        box(3, 2, 2, GREEN, x=x, y=h - 2, sculpt=shape)
        box(2, 2, 2, BODY, x=x, y=h + 1, sculpt=shape)
    box(6, 2, 4, MARK, y=3, sculpt=shape)
    return shape


def cordial_flask():
    shape = box(6, 8, 5, GLASS)
    box(8, 5, 6, GLASS, y=1, sculpt=shape)
    box(4, 5, 4, GLASS, y=6, sculpt=shape)
    box(4, 2, 4, WOOD, y=10, sculpt=shape)
    box(5, 3, 1, MARK, y=3, z=3, sculpt=shape)
    return shape


def steward_letter():
    shape = box(11, 1, 7, MARK)
    box(10, 1, 6, WOOD_GRAIN, y=1, sculpt=shape)
    for z, width in ((-2, 10), (-1, 8), (0, 6), (1, 4), (2, 2)):
        box(width, 1, 1, MARK, y=1, z=z, sculpt=shape)
    box(3, 1, 3, BODY, y=2, z=1, sculpt=shape)
    box(1, 1, 1, MARK, y=3, z=1, sculpt=shape)
    return shape


def gate_hinge():
    shape = box(15, 1, 5, METAL)
    box(11, 1, 7, METAL, sculpt=shape)
    box(4, 3, 8, DARK, x=-7, sculpt=shape)
    box(2, 2, 10, METAL_EDGE, x=-7, y=1, sculpt=shape)
    for x in (-2, 2, 6):
        box(2, 1, 2, DARK, x=x, y=1, sculpt=shape)
    return shape


def items_for(key):
    red = {'primary': '#a64537', 'trim': '#e3dbbe'}
    paper = {'primary': '#c6ba96', 'trim': '#494849'}
    if key == 'caverns':
        return {
            'pickaxe': Item('Mine pickaxe', 'tool', handled('pick'), (0, 4, 0)),
            'mine_lantern': Item('Brass mine lantern', 'light', lantern(), (0, 15, 0)),
            'rope_bundle': Item('Coiled hemp rope', 'traversal', loops()),
            'copper_ore': Item('Copper ore chunk', 'material', mineral(MARK, 3)),
            'glow_crystal': Item('Glow crystal', 'resource', crystal(), palette={'accent': '#6ae6dd'}),
            'forge_hammer': Item('Forge hammer', 'tool', handled('hammer'), (0, 5, 0)),
            'rune_axe': Item('Rune axe', 'melee', handled('axe'), (0, 5, 0)),
            'iron_shield': Item('Iron rune shield', 'defense', shield(), (0, 7, -2)),
            'royal_seal': Item('Royal seal', 'objective', royal_seal()),
            'gold_ingot': Item('Royal gold ingot', 'treasure', box(11, 3, 6, MARK)),
            'dwarf_ration': Item('Miners ration', 'consumable', pack(9, 7, 5, shell=WOOD)),
            'pressure_gauge': Item('Brass pressure gauge', 'repair', pressure_gauge()),
            'sample_vial': Item('Mineral sample vial', 'resource', sample_vial()),
            'survey_compass': Item('Mine survey compass', 'navigation', survey_compass()),
        }
    if key == 'apocalypse':
        return {
            'crowbar': Item('Salvage crowbar', 'melee', handled('bar'), (0, 4, 0)),
            'flashlight': Item('Hand torch', 'light', handheld_light(), (0, 2, -2)),
            'respirator': Item('Field respirator', 'protective', face_protection()),
            'binoculars': Item('Weathered binoculars', 'scout', binoculars()),
            'medical_kit': Item('Clinic medical kit', 'medical',
                                pack(14, 10, 7, badge=('.#.', '###', '.#.')), palette=red),
            'pump_shotgun': Item('Salvage pump shotgun', 'weapon', field_weapon('shotgun'), (0, 3, -4)),
            'shell_box': Item('Small shell box', 'supply', pack(10, 6, 6, shell=WOOD)),
            'fuse_pack': Item('Relay fuse pack', 'repair', relay_fuses()),
            'bolt_cutters': Item('Bolt cutters', 'tool', handled('cutters'), (0, 4, 0)),
            'field_rations': Item('Stadium field rations', 'consumable', pack(10, 8, 6, shell=GREEN)),
            'signal_beacon': Item('Rescue signal beacon', 'objective', rescue_beacon(), (0, 15, 0)),
            'water_canteen': Item('Taped water canteen', 'consumable', canteen()),
            'water_test_kit': Item('Water testing kit', 'tool', water_test_kit()),
            'tram_service_key': Item('Tram service key', 'tool', tram_service_key(), (0, 1, 0)),
            'battery_pack': Item('Portable battery', 'repair', battery_pack()),
        }
    if key == 'medieval':
        return {
            'tallow_lantern': Item('Alderwick lantern', 'light', lantern(), (0, 15, 0)),
            'alderwick_map': Item('Alderwick town map', 'navigation', folded_map(), palette=paper),
            'grain_sack': Item('Sack of rye', 'supply', pack(12, 12, 10, shell=MARK)),
            'smith_hammer': Item('Blacksmith hammer', 'tool', handled('hammer'), (0, 5, 0)),
            'iron_billet': Item('Wrought iron billet', 'material', box(14, 4, 5, METAL)),
            'gate_hinge': Item('Forged gate hinge', 'repair', gate_hinge()),
            'herb_bunch': Item('Tied herb bunch', 'resource', herb_bunch(), (0, 4, 0),
                               {'detail': '#7a9a54', 'primary': '#b27885'}),
            'cordial_flask': Item('Herbal cordial', 'consumable', cordial_flask(), (0, 4, 0),
                                  {'visor': '#6fae85', 'trim': '#e6c88b'}),
            'seal_letter': Item('Steward letter', 'access', steward_letter(),
                                palette={'primary': '#a4493c', 'leather': '#b7a380', 'trim': '#dfc89f'}),
            'alder_shield': Item('Alderwick shield', 'defense', shield(), (0, 7, -2),
                                 {'primary': '#824348', 'accent': '#e0b77d'}),
            'court_signet': Item('Court seal', 'objective', royal_seal(), palette=red),
        }
    return {
        'bolt_action': Item('Period bolt action rifle', 'weapon', field_weapon('bolt'), (0, 3, -4)),
        'service_smg': Item('Period submachine gun', 'weapon', field_weapon('smg'), (0, 3, -4)),
        'sidearm': Item('Period service sidearm', 'weapon', field_weapon('sidearm'), (0, 3, -4)),
        'field_radio': Item('Field signal radio', 'comms', radio()),
        'field_map': Item('Folded campaign map', 'navigation', folded_map(), palette=paper),
        'medical_pouch': Item('Medic field pouch', 'medical', pack(11, 8, 6, badge=('.#.', '###', '.#.')), palette=red),
        'repair_case': Item('Bridge fitting case', 'repair', pack(16, 8, 9, shell=WOOD)),
        'flare_pistol': Item('Signal flare pistol', 'signal', field_weapon('flare'), (0, 3, -4)),
        'field_binoculars': Item('Field binoculars', 'scout', binoculars()),
        'signal_flare': Item('Signal flare', 'signal', tube(15, 4, MARK)),
        'charge_satchel': Item('Engineers satchel', 'objective', pack(15, 12, 7, shell=GREEN)),
        'supply_crate': Item('Landing cargo crate', 'supply', cargo_crate()),
        'fuel_can': Item('Stamped fuel can', 'supply', fuel_can()),
        'field_shovel': Item('Trench spade', 'tool', field_spade(), (0, 4, 0)),
        'rail_signal_flag': Item('Rail signal flag', 'signal', rail_signal_flag(), (0, 2, 0), palette=red),
        'depot_tool_roll': Item('Canvas depot tool roll', 'repair', depot_tool_roll()),
        'range_card': Item('Survey clipboard', 'navigation', range_card(), palette=paper),
    }
