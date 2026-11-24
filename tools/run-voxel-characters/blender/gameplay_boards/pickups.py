"""Optional pickups that give each board its own gear and souvenirs."""

from dataclasses import dataclass, replace

from creature_kit import Sculpt
from level_geometry import box

from .common import BODY, DARK, GLASS, GLOW, GREEN, MARK, METAL, WOOD, action, glyph
from .equipment import (Item, canteen, cordial_flask, depot_tool_roll, face_protection,
                        herb_bunch, mineral, pack, shield)

BRASS = {'trim': '#d8ac62', 'metal': '#8d979c', 'secondary': '#3b424b'}
PAPER = {'primary': '#ded0a8', 'trim': '#a86c43', 'secondary': '#615749'}
JADE = {'primary': '#4a7d79', 'trim': '#c9a660', 'metal': '#8ea9a3'}
EMBER = {'primary': '#9b3e32', 'trim': '#ebb35f', 'accent': '#f59c53'}
AZURE = {'primary': '#345d83', 'trim': '#dac18b', 'accent': '#82e3e5'}
SAFETY = {'primary': '#cc763b', 'trim': '#f1ca75', 'secondary': '#3d4955'}


@dataclass(frozen=True)
class Pickup:
    key: str
    point: str
    item: Item


def grip(length):
    shape = box(2, length, 2, WOOD)
    for y in (1, 4, 7):
        box(3, 1, 3, DARK, y=y, sculpt=shape)
    return shape


def baton(length, width, bands):
    shape = grip(length)
    box(width - 2, length - 8, width, BODY, y=8, sculpt=shape)
    box(width, length - 10, width - 2, BODY, y=9, sculpt=shape)
    for y in bands:
        box(width, 2, width, MARK, y=y, sculpt=shape)
    box(width - 2, 1, width - 2, DARK, y=length, sculpt=shape)
    return shape


def maul(length, width, height):
    shape = grip(length)
    box(4, 4, 4, MARK, y=length - 5, sculpt=shape)
    box(width - 2, height, 5, DARK, y=length - 3, sculpt=shape)
    for end in (-width // 2 + 1, width // 2 - 1):
        box(2, height - 2, 7, METAL, x=end, y=length - 2, sculpt=shape)
    box(width - 5, 1, 5, BODY, y=length - 4 + height, sculpt=shape)
    return shape


def blade(length, width, guard):
    shape = grip(10)
    box(guard, 2, 3, MARK, y=8, sculpt=shape)
    box(width, length - 5, 2, METAL, y=10, sculpt=shape)
    box(max(1, width - 2), 3, 2, METAL, y=length + 5, sculpt=shape)
    box(1, 2, 2, METAL, y=length + 8, sculpt=shape)
    box(1, length - 7, 1, DARK, y=11, z=1, sculpt=shape)
    return shape


def badge(width, mark, *, rim=METAL):
    shape = box(width - 2, width, 2, rim)
    box(width, width - 3, 2, rim, y=1, sculpt=shape)
    box(width - 2, width - 2, 1, BODY, y=1, z=1, sculpt=shape)
    glyph(shape, mark, -1, width // 2 - 1, 2, MARK)
    return shape


def ticket(width, height, mark):
    shape = box(width, height, 1, BODY)
    for y in range(1, height, 2):
        box(1, 1, 1, DARK, x=width // 2 - 1, y=y, z=1, sculpt=shape)
    box(width - 2, 1, 1, DARK, y=2, z=1, sculpt=shape)
    glyph(shape, mark, -1, height - 5, 1, MARK)
    return shape


def trophy():
    shape = box(9, 2, 7, WOOD)
    box(4, 4, 3, METAL, y=2, sculpt=shape)
    box(7, 2, 5, MARK, y=6, sculpt=shape)
    box(9, 4, 7, MARK, y=8, sculpt=shape)
    shape.cut((-3, 3), (9, 11), (-2, 2))
    for x in (-5, 5):
        box(2, 4, 2, MARK, x=x, y=8, sculpt=shape)
        box(3, 1, 2, METAL, x=x, y=11, sculpt=shape)
    return shape


def filter_cartridge():
    shape = box(7, 9, 5, DARK)
    for y in (1, 4, 7):
        box(9, 1, 5, METAL, y=y, sculpt=shape)
    box(5, 2, 3, MARK, y=9, sculpt=shape)
    return shape


def spool():
    shape = box(7, 2, 7, DARK)
    box(5, 5, 5, BODY, y=2, sculpt=shape)
    for y in (3, 5):
        box(6, 1, 6, MARK, y=y, sculpt=shape)
    box(7, 2, 7, METAL, y=7, sculpt=shape)
    return shape


def moth(wings, material):
    shape = box(3, 8, 3, BODY)
    for side in (-1, 1):
        for x, y, h in wings:
            box(2, h, 1, material, x=side * x, y=y, sculpt=shape)
        box(1, 2, 1, MARK, x=side * 4, y=4, z=1, sculpt=shape)
    box(2, 1, 2, GLOW, y=6, z=1, sculpt=shape)
    return shape


def ore_cage():
    shape = box(8, 2, 7, METAL)
    box(8, 1, 7, WOOD, y=2, sculpt=shape)
    for x in (-3, 3):
        for z in (-3, 3):
            box(1, 9, 1, METAL, x=x, y=2, z=z, sculpt=shape)
    box(8, 1, 7, METAL, y=10, sculpt=shape)
    return shape


def field_staff():
    shape = grip(33)
    box(3, 2, 3, METAL, y=31, sculpt=shape)
    box(2, 5, 2, WOOD, x=2, y=31, sculpt=shape)
    box(4, 2, 2, WOOD, x=1, y=34, sculpt=shape)
    return shape


def wand():
    shape = grip(19)
    box(4, 3, 4, METAL, y=16, sculpt=shape)
    box(6, 3, 6, GLASS, y=19, sculpt=shape)
    box(4, 2, 4, GLOW, y=22, sculpt=shape)
    return shape


def votive():
    shape = box(9, 3, 7, METAL)
    for x, height in ((-2, 8), (2, 5)):
        box(3, height, 3, MARK, x=x, y=3, sculpt=shape)
        box(1, 2, 1, GLOW, x=x, y=3 + height, sculpt=shape)
    return shape


def whistle():
    shape = box(4, 4, 3, METAL)
    box(3, 2, 2, MARK, y=4, sculpt=shape)
    box(2, 1, 1, DARK, y=2, z=2, sculpt=shape)
    box(2, 1, 1, METAL, y=0, z=-2, sculpt=shape)
    return shape


def item(key, point, label, kind, shape, *, held=False, palette=None):
    return Pickup(key, point, Item(label, kind, shape, (0, 4, 0) if held else None, palette))


def souvenir(key, point, label, shape, palette=BRASS):
    return item(key, point, label, 'collectible', shape, palette=palette)


CROSS = ('.#.', '###', '.#.')
BOLT = ('.##', '.#.', '##.')
WING = ('#..', '##.', '###')
NUMBER = ('###', '..#', '..#')


def board_pickups(key):
    if key == 'core':
        return (
            item('marshal_foam_baton', 'signal', 'Marshal foam baton', 'melee', baton(25, 6, (13, 19)),
                 held=True, palette=SAFETY),
            item('pit_tool_wallet', 'parts', 'Pit tool wallet', 'repair', depot_tool_roll(), palette=SAFETY),
            item('tread_reference_card', 'roller_bed', 'Tread reference card', 'tool',
                 ticket(8, 11, ('###', '##.', '#..')), palette=PAPER),
            souvenir('course_patch', 'timing', 'Timed course patch', badge(9, BOLT), AZURE),
            souvenir('brake_trial_cup', 'scores', 'Brake trial cup', trophy()),
        )
    if key == 'heist':
        return (
            item('salvage_sledge', 'demolition', 'Salvage sledge', 'melee', maul(25, 15, 6), held=True, palette=SAFETY),
            item('press_maintenance_roll', 'press', 'Press maintenance roll', 'repair', depot_tool_roll(), palette=JADE),
            item('courier_ration_tin', 'stand', 'Courier ration tin', 'consumable', pack(9, 7, 6, shell=WOOD), palette=JADE),
            souvenir('misprint_plate', 'proof', 'Misprint brass plate', ticket(8, 12, NUMBER), BRASS),
            souvenir('bindery_thread_spool', 'packing', 'Bindery thread spool', spool(), JADE),
        )
    if key == 'industrial':
        return (
            item('slag_maul', 'press', 'Slag maul', 'melee', maul(18, 11, 8), held=True, palette=EMBER),
            item('face_screen', 'quench', 'Quench face screen', 'protective', face_protection(), palette=SAFETY),
            item('ceramic_filter', 'cooling', 'Ceramic pump filter', 'repair', filter_cartridge(), palette=PAPER),
            souvenir('first_pour_medal', 'ore', 'First pour medal', badge(8, CROSS), EMBER),
            souvenir('foundry_punch_card', 'tally', 'Foundry punch card', ticket(7, 13, BOLT), PAPER),
        )
    if key == 'security':
        return (
            item('checkpoint_baton', 'inspection_queue', 'Checkpoint patrol baton', 'melee', baton(21, 4, (12,)),
                 held=True, palette=AZURE),
            Pickup('lane_guard_shield', 'service_gate',
                   Item('Lane guard shield', 'defense', shield(), (0, 7, -2), AZURE)),
            item('terminal_aid_pouch', 'service_office', 'Terminal aid pouch', 'medical',
                 pack(9, 7, 5, badge=CROSS), palette=EMBER),
            souvenir('old_gate_insignia', 'scanner_arch', 'Retired gate insignia', badge(10, NUMBER), AZURE),
            souvenir('clockwork_moth', 'dispatch_intake', 'Clockwork moth',
                     moth(((2, 2, 5), (4, 3, 5), (6, 4, 3)), METAL), JADE),
        )
    if key == 'creatures':
        return (
            item('reed_warden_staff', 'trail_junction', 'Reed warden staff', 'tool', field_staff(), held=True, palette=JADE),
            item('ranger_seed_tin', 'feeding_pen', 'Native seed tin', 'resource', pack(9, 6, 8, shell=GREEN), palette=JADE),
            item('fen_transect_reel', 'staff_gauge', 'Fen transect reel', 'tool', spool(), palette=SAFETY),
            souvenir('fen_moth_field_cast', 'reed_blind', 'Fen moth field cast',
                     moth(((2, 0, 5), (4, 2, 6), (6, 3, 7), (8, 6, 3)), GREEN), JADE),
            souvenir('ranger_survey_badge', 'archive_intake', 'Ranger survey badge', badge(9, WING), JADE),
        )
    if key == 'fantasy':
        return (
            item('kilnkeeper_blade', 'clay_bench', 'Kilnkeeper blade', 'melee', blade(14, 5, 6), held=True, palette=EMBER),
            item('bluefire_wand', 'kiln', 'Bluefire wand', 'weapon', wand(), held=True, palette=AZURE),
            item('glaze_cordial', 'glaze_station', 'Blueglass cordial', 'consumable', cordial_flask(), palette=AZURE),
            souvenir('glass_moth', 'glass_exhibit', 'Bluecourt glass moth',
                     moth(((2, 3, 5), (4, 4, 6), (6, 6, 5)), GLASS), AZURE),
            souvenir('moonweaver_pennant', 'ribbon_loom', 'Moonweaver pennant', ticket(9, 14, WING), JADE),
        )
    if key == 'caverns':
        return (
            item('vault_watch_blade', 'watch', 'Vault watch blade', 'melee', blade(23, 5, 10), held=True, palette=BRASS),
            item('rail_hook', 'rail', 'Ore rail hook', 'tool', field_staff(), held=True, palette=SAFETY),
            item('obsidian_shard', 'lode', 'Obsidian shard', 'resource', mineral(DARK, 7), palette=JADE),
            souvenir('founding_medallion', 'vault', 'Founding medallion', badge(11, BOLT)),
            souvenir('miner_luck_cage', 'assay', 'Miner’s luck cage', ore_cage()),
        )
    if key == 'apocalypse':
        return (
            item('salvager_bat', 'alley', 'Salvager bat', 'melee', baton(29, 6, (14, 22)), held=True, palette=JADE),
            item('clinic_antiseptic', 'pharmacy', 'Clinic antiseptic flask', 'medical', canteen(), palette=EMBER),
            item('spare_resp_filter', 'quarantine', 'Spare respirator filter', 'protective', filter_cartridge(), palette=JADE),
            souvenir('stadium_ticket_stub', 'stadium', 'Stadium ticket stub', ticket(7, 12, NUMBER), PAPER),
            souvenir('south_line_token', 'tram_exchange', 'South Line token', badge(8, BOLT), AZURE),
        )
    if key == 'medieval':
        return (
            item('alderwick_watch_sword', 'gate', 'Alderwick watch sword', 'melee', blade(26, 4, 12),
                 held=True, palette=BRASS),
            item('market_poultice', 'apothecary', 'Market poultice', 'medical', herb_bunch(), palette=JADE),
            item('smith_spare_roll', 'smithy', 'Smith’s spare tool roll', 'repair', depot_tool_roll(), palette=EMBER),
            souvenir('chapel_votive', 'chapel', 'Chapel votive', votive(), BRASS),
            souvenir('mill_tally', 'mill', 'Alderwick mill tally', ticket(5, 14, BOLT), BRASS),
        )
    if key == 'ww2':
        return (
            item('utility_field_knife', 'dugout', 'Field utility knife', 'melee', blade(12, 3, 5), held=True, palette=BRASS),
            item('rail_signal_whistle', 'rail', 'Rail signal whistle', 'signal', whistle(), palette=SAFETY),
            item('engineers_aid_roll', 'aid', 'Engineer’s aid roll', 'medical', depot_tool_roll(), palette=JADE),
            souvenir('aircrew_wing_badge', 'airstrip', 'Aircrew wing badge', badge(8, WING)),
            souvenir('estuary_quay_pass', 'docks', 'Estuary quay pass', ticket(7, 10, NUMBER), PAPER),
        )
    raise ValueError(f'{key}: no board pickup roster')


def with_board_pickups(board, equipment):
    point_ids = {point['id'] for point in board.points}
    additions = {}
    items = dict(equipment)
    for pickup in board_pickups(board.key):
        if pickup.key in items:
            raise ValueError(f'{board.key}: repeated equipment ID {pickup.key}')
        if pickup.point not in point_ids:
            raise ValueError(f'{board.key}: unknown pickup point {pickup.point}')
        interaction = action('pickup', assets=(pickup.key,), reward=f'found_{pickup.key}')
        additions.setdefault(pickup.point, []).append(interaction)
        items[pickup.key] = pickup.item
    points = [{**point, 'actions': [*point['actions'], *additions.get(point['id'], ())]}
              for point in board.points]
    return replace(board, points=points), items
