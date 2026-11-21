"""Build occupied rooms and their yards from four-metre structural bays."""

from level_geometry import box
from level_details import dress_activity


# Grid coordinates increase east and south. Letters identify connected work areas.
# Each opening joins the room to a street, yard, or adjacent room.
SITES = {
    'core': dict(
        name='Motor pool',
        plan=(' PPP', ' WWP', ' WW '),
        height=34,
        doors=((1, 2, 'S'), (2, 2, 'E'), (3, 0, 'E')),
        partitions=((2, 1, 'E'),),
        skin='MASONRY',
        frame='BODY',
        roof='DARK',
        floor='Concrete floor',
        color='#ffd5a0',
    ),
    'heist': dict(
        name='Print works',
        plan=('VV  ', 'VPP ', ' PP ', ' PP '),
        height=31,
        doors=((2, 3, 'S'), (1, 2, 'W'), (0, 0, 'N')),
        partitions=((0, 1, 'E'),),
        skin='BODY',
        frame='MASONRY',
        roof='DARK',
        floor='Asphalt tile',
        color='#ffcb86',
    ),
    'industrial': dict(
        name='Smelting works',
        plan=(' FFF', ' FFF', 'BBFF'),
        height=47,
        doors=((3, 2, 'S'), (1, 1, 'W'), (0, 2, 'W')),
        partitions=((1, 2, 'E'),),
        skin='DARK',
        frame='METAL',
        roof='BODY',
        floor='Workshop deck',
        color='#ff964d',
    ),
    'security': dict(
        name='Baggage hall',
        plan=('CC  ', 'CHHH', ' HHH'),
        height=34,
        doors=((3, 2, 'S'), (3, 1, 'E'), (0, 0, 'W')),
        partitions=((0, 1, 'E'),),
        skin='BODY',
        frame='CAP',
        roof='DARK',
        floor='Station tile',
        color='#b8e5ff',
    ),
    'creatures': dict(
        name='Ranger lodge',
        plan=(' LL ', ' LL ', ' SL ', ' S  '),
        height=29,
        doors=((2, 2, 'S'), (1, 1, 'W'), (1, 3, 'S')),
        partitions=((1, 2, 'E'),),
        skin='WOOD',
        frame='SOIL',
        roof='DARK',
        floor='Packed earth',
        color='#ffcb82',
    ),
    'fantasy': dict(
        name='Guild bakehouse',
        plan=('  GG', ' BBG', ' BB '),
        height=34,
        doors=((1, 2, 'S'), (2, 2, 'E'), (3, 0, 'E')),
        partitions=((2, 1, 'E'),),
        skin='MASONRY',
        frame='WOOD',
        roof='DETAIL',
        floor='Flagstone tile',
        color='#ffb967',
    ),
}

VECTORS = {'N': (0, -1, 2), 'S': (0, 1, 0), 'W': (-1, 0, 3), 'E': (1, 0, 1)}


def wall_module(g, height, face, frame, style, trade=None):
    wall = box(40, height, 3, face)
    for x in (-19, 18):
        box(2, height, 5, frame, x=x, sculpt=wall)
    for y in (0, height - 3):
        box(40, 3, 5, frame, y=y, sculpt=wall)
    if style == 'door':
        wall.cut((-12, 11), (0, height - 8), (-4, 4))
        for x in (-13, 12):
            box(2, height - 6, 5, frame, x=x, sculpt=wall)
        box(28, 2, 5, frame, y=height - 7, sculpt=wall)
    elif style == 'solid' and trade not in ('creatures', 'fantasy'):
        for y in (5, height // 2, height - 6):
            box(39, 1, 4, face, y=y, sculpt=wall)
        box(12, 8, 1, g.GRIT, x=8, y=7, z=2, sculpt=wall)
        for y in (8, 10, 12):
            box(10, 1, 1, frame, x=8, y=y, z=3, sculpt=wall)
    elif style == 'window':
        wall.cut((-14, 13), (10, height - 8), (-3, 3))
        for x in (-15, 0, 14):
            box(2, height - 16, 3, frame, x=x, y=10, sculpt=wall)
        for y in (9, height - 8):
            box(32, 2, 5, frame, y=y, sculpt=wall)
        box(28, 1, 3, frame, y=height - 13, sculpt=wall)
    if trade == 'creatures':
        for y in range(2, height - 2, 7):
            if style == 'solid' or y < 9 and style == 'window':
                box(39, 2, 5, g.SOIL, y=y, sculpt=wall)
        for x in (-18, 17):
            box(4, height, 5, g.WOOD, x=x, sculpt=wall)
    elif trade == 'fantasy':
        for x in (-18, 17):
            box(3, height, 5, g.WOOD, x=x, sculpt=wall)
        if style == 'solid':
            for step in range(5):
                for side in (-1, 1):
                    box(3, 3, 2, g.WOOD, x=side * (step * 2 + 2), y=4 + 2 * step, z=2, sculpt=wall)
    elif trade == 'industrial':
        for x in (-18, 17):
            box(4, 8, 5, g.MARK, x=x, y=2, sculpt=wall)
            box(4, 2, 5, g.RUBBER, x=x, y=5, sculpt=wall)
        box(38, 3, 4, g.METAL, y=height - 5, sculpt=wall)
    elif trade == 'heist':
        for y in (2, 5, height - 5):
            if style == 'solid':
                box(39, 1, 4, g.PATINA, y=y, sculpt=wall)
        if style == 'window':
            box(34, 2, 8, g.MASONRY, y=8, sculpt=wall)
    elif trade == 'security':
        box(37, 1, 5, g.LIGHT, y=height - 3, sculpt=wall)
    elif trade == 'core' and style == 'door':
        for y in (height - 4, height - 2):
            box(25, 1, 6, g.METAL, y=y, sculpt=wall)
    return wall


def hanging_light(g, rustic):
    lamp = box(2, 5, 2, g.METAL, y=4)
    box(9 if rustic else 20, 2, 6, g.DARK, y=2, sculpt=lamp)
    box(7 if rustic else 18, 2, 4, g.LAMP, sculpt=lamp)
    return lamp


def chimney(g, stone):
    material = g.PATINA if stone else g.METAL
    shaft = box(9, 40, 9, material)
    for y in (0, 13, 27, 38):
        box(11, 2, 11, g.DARK, y=y, sculpt=shaft)
    box(7, 1, 7, g.RUBBER, y=40, sculpt=shaft)
    return shaft


def machine(g, key):
    # Each assembly has a distinct working face oriented toward the room aisle.
    if key == 'core':
        shape = box(28, 3, 16, g.DARK)
        for x in (-11, 10):
            box(4, 24, 6, g.BODY, x=x, y=3, sculpt=shape)
            box(8, 2, 16, g.MARK, x=x, y=12, sculpt=shape)
        box(4, 5, 3, g.METAL, x=11, y=15, z=4, sculpt=shape)
    elif key == 'heist':
        shape = box(28, 9, 14, g.DARK)
        for x in (-11, -4, 3):
            box(5, 10, 12, g.BODY, x=x, y=9, sculpt=shape)
            box(3, 5, 6, g.METAL, x=x, y=14, z=4, sculpt=shape)
        box(9, 2, 12, g.CAP, x=10, y=9, sculpt=shape)
        box(7, 3, 8, g.MASONRY, x=10, y=11, sculpt=shape)
    elif key in ('industrial', 'fantasy'):
        industrial = key == 'industrial'
        height = 31 if industrial else 18
        shape = box(28, height, 16, g.PATINA if industrial else g.MASONRY)
        shape.cut((-9, 8), (4, height - 5), (1, 9))
        box(15, 7, 2, g.MARK, y=4, z=1, sculpt=shape)
        box(9, 4, 2, g.LAMP, y=4, z=2, sculpt=shape)
        box(30, 3, 21, g.DARK, y=2, sculpt=shape)
        for x in (-13, 12):
            box(3, height, 3, g.DARK if industrial else g.WOOD, x=x, z=8, sculpt=shape)
        box(20, 4, 13, g.GRIT, y=height, sculpt=shape)
        box(10, 7, 10, g.PATINA, y=height + 4, sculpt=shape)
    elif key == 'security':
        shape = box(30, 3, 10, g.METAL, y=8)
        for x in (-12, 12):
            box(3, 8, 8, g.DARK, x=x, sculpt=shape)
        box(13, 14, 14, g.BODY, y=11, sculpt=shape)
        shape.cut((-8, 8), (11, 19), (-4, 4))
        for x in (-13, -9, 8, 12):
            box(2, 1, 8, g.RUBBER, x=x, y=11, sculpt=shape)
    else:
        shape = box(25, 3, 10, g.WOOD, y=8)
        for x in (-10, 9):
            box(3, 8, 8, g.SOIL, x=x, sculpt=shape)
        box(24, 13, 2, g.WOOD, y=11, z=-4, sculpt=shape)
        box(19, 9, 1, g.CAP, y=13, z=-2, sculpt=shape)
        for x, y in ((-7, 14), (-3, 16), (1, 17), (5, 19)):
            box(5, 2, 1, g.BODY, x=x, y=y, z=-1, sculpt=shape)
        box(5, 4, 5, g.DARK, x=8, y=11, z=2, sculpt=shape)
    return shape


MACHINES = {
    'core': 'Hydraulic service lift',
    'heist': 'Rotary offset press',
    'industrial': 'Charge furnace',
    'security': 'Parcel X ray tunnel',
    'creatures': 'Survey map table',
    'fantasy': 'Bread oven',
}

# Positions use metres relative to the southwest approach. Local Z runs south.
# A complete row of bays is four metres deep.
FURNITURE = {
    'core': [
        ('Heavy work table', -2.9, -13.3, 1),
        ('Loaded parts rack', -0.6, -16.9, 0),
        ('Field case', -1.1, -12.8, 0),
        ('Utility cabinet', 6.9, -21.1, 0),
        ('Equipment shelf', 3.7, -21.4, 0),
        ('Flatbed tool cart', 2.9, -13.8, 1),
    ],
    'heist': [
        ('Stacked salvage rack', -5.6, -18.6, 1),
        ('Pallet stack', -1.0, -13.1, 1),
        ('Crated salvage', 2.9, -13.5, 0),
        ('Cable reel', 1.1, -17.0, 2),
        ('Vault slab', -6.6, -21.4, 0),
        ('Fuel drum', -2.9, -21.1, 0),
    ],
    'industrial': [
        ('Foundry press', 4.4, -20.8, 0),
        ('Pressure vessel', -5.9, -13.0, 0),
        ('Tank feed pipes', -3.0, -13.1, 1),
        ('Material rack', 6.9, -17.6, 1),
        ('Power cabinet', -2.9, -20.9, 0),
        ('Ore receiving skip', 3.6, -14.8, 0),
    ],
    'security': [
        ('Server bank', -6.6, -21.0, 0),
        ('Control desk', -3.3, -20.8, 0),
        ('Transit bench island', 6.8, -17.0, 1),
        ('Ticket kiosk', 4.6, -16.7, 1),
        ('Evidence case', -5.5, -17.9, 0),
        ('Inspector storage rack', -2.9, -13.2, 1),
    ],
    'creatures': [
        ('Supply shelf', -2.9, -20.8, 0),
        ('Field station', 2.8, -17.6, 1),
        ('Forage trough', -2.8, -9.9, 1),
        ('Feed bucket', -2.8, -8.6, 1),
        ('Animal transport', -1.2, -12.8, 0),
        ('Warmth lamp', 2.9, -21.2, 2),
    ],
    'fantasy': [
        ('Market table', -2.9, -13.6, 1),
        ('Market crate', -2.9, -12.5, 1),
        ('Wooden bookcase', 6.8, -20.7, 1),
        ('Barrel stand', 3.2, -17.1, 0),
        ('Merchant counter', 5.4, -17.4, 0),
        ('Empty market bin', -0.3, -13.2, 2),
    ],
}


def build_district(kit, g):
    integrate_yard(kit, g)
    site = SITES[kit.key]
    name = site['name']
    tiles = {
        (col, row): ch
        for row, line in enumerate(site['plan'])
        for col, ch in enumerate(line)
        if ch != ' '
    }
    added = set()

    def piece(label, factory, x, z, turn=0, height=0):
        if label in added:
            kit.place(label, x, z, turn, height)
        else:
            kit.add(label, factory(), x, z, turn, height)
            added.add(label)

    h = site['height']
    face, frame, roof = (getattr(g, site[key]) for key in ('skin', 'frame', 'roof'))
    entry, _, _ = site['doors']
    ex, ez = -6 + entry[0] * 4, -20 + entry[1] * 4 + 2
    rustic = kit.key in ('creatures', 'fantasy')
    floor_id = kit.key + '_' + site['floor'].lower().replace(' ', '_')
    old_floor = {
        (p['position'][0], p['position'][2]) for p in kit.placements if p['propId'] == 'prop_' + floor_id
    }
    for x in range(-16, 17, 4):
        for z in range(-28, 17, 4):
            if z >= 0 and (abs(x) >= 16 or z == 16):
                continue
            if z <= -24 or (abs(x) >= 12 and x < 0) or (x == 12 and z > -4):
                piece(
                    'Yard embankment',
                    lambda: embankment(g, kit.key),
                    x,
                    z,
                    (x // 4 + z // 4) % 4,
                    height=-0.25,
                )
                continue
            if kit.key == 'creatures' and z in (4, 8) and -8 <= x <= 4:
                continue
            if (x, z) not in old_floor:
                kit.place(site['floor'], x, z, height=-0.22)
    for (col, row), area in tiles.items():
        x, z = -6 + col * 4, -20 + row * 4
        if rustic:
            roof_mesh = lambda: ridge_roof(g, roof, frame, kit.key == 'fantasy')
        elif kit.key == 'industrial' and row < 2:
            roof_mesh = lambda: monitor_roof(g)
        else:
            roof_mesh = lambda: g.roof(40, 40, roof)
        clerestory = kit.key == 'industrial' and row < 2
        piece(name + (' roof monitor' if clerestory else ' ceiling'), roof_mesh, x, z, height=h / 10)
        if kit.key == 'heist' and col in (1, 2) and row in (2, 3):
            for side, (dx, dz, turn) in VECTORS.items():
                if not (col + dx in (1, 2) and row + dz in (2, 3)):
                    piece(
                        'Print office upper sash',
                        lambda: wall_module(g, 29, g.BODY, g.PATINA, 'window'),
                        x + dx * 2,
                        z + dz * 2,
                        turn,
                        height=h / 10 + 0.3,
                    )
            piece('Print office parapet roof', lambda: g.roof(41, 41, g.GRIT), x, z, height=h / 10 + 3.2)
        for side, (dx, dz, turn) in VECTORS.items():
            outer = (col + dx, row + dz) not in tiles
            partition = (col, row, side) in site['partitions']
            if not outer and not partition:
                continue
            style = 'door' if partition or (col, row, side) in site['doors'] else 'window'
            if style == 'window' and (side == 'N' or (col + 2 * row + turn) % 3 == 0):
                style = 'solid'
            piece(
                name + ' ' + style,
                lambda: wall_module(g, h, face, frame, style, kit.key),
                x + 2 * dx,
                z + 2 * dz,
                turn,
            )
    # Place practical lamps just below the underside of the ceiling.
    fixtures = []
    for col, row in (entry[:2], next(iter(tiles)), list(tiles)[len(tiles) // 2]):
        x, z = -6 + col * 4, -20 + row * 4
        if any(f['position'][0] == x and f['position'][2] == z for f in fixtures):
            continue
        piece(name + ' pendant', lambda: hanging_light(g, rustic), x, z, height=h / 10 - 0.9)
        fixtures.append(
            dict(position=[x, h / 10 - 1.0, z], color=site['color'], intensity=12, distance=7)
        )
    mx, mz = ex + 0.8, ez - 3.4
    kit.add(
        MACHINES[kit.key],
        machine(g, kit.key),
        mx,
        mz,
        2 if kit.key in ('fantasy', 'industrial', 'creatures') else 0,
    )
    for label, x, z, turn in FURNITURE[kit.key]:
        kit.place(label, x, z, turn)
    if kit.key in ('industrial', 'fantasy', 'creatures', 'heist'):
        cols = (0, 1, 2) if kit.key == 'industrial' else (0,)
        for offset in cols:
            piece(
                name + ' chimney', lambda: chimney(g, rustic), mx + offset * 1.3, mz, height=h / 10 + 0.3
            )
    piece(name + ' trade sign', lambda: trade_sign(g, kit.key), ex, ez + 0.25, height=h / 10 - 0.4)
    sign = {
        'core': 'MOTOR',
        'heist': 'PRESS',
        'industrial': 'IRON',
        'security': 'BAGS',
        'creatures': 'FIELD',
        'fantasy': 'OVEN',
    }[kit.key]
    if kit.key == 'heist':
        kit.add('Print works letter board', letter_board(g, sign), -4.25, -9, 3, 4.0)
    else:
        kit.add(name + ' letter board', letter_board(g, sign), ex + 2.1, ez + 0.2, height=h / 10 + 0.1)
    street_detail(kit, g, site, piece)
    dress_workroom(kit, g, mx, mz, piece)
    surface_district(kit, g, tiles, piece)
    horizon(kit, g, piece)
    approach_landscape(kit, g, piece)
    dress_activity(kit, g)
    approach_eye, approach_target = {
        'core': ([-9.7, 1.65, -4], [-1, 2.5, -13]),
        'heist': ([-10, 1.65, -6.9], [-3.7, 2.4, -12.1]),
        'industrial': ([12.8, 1.65, -5.1], [4.8, 2.6, -13.2]),
        'security': ([13, 1.65, -5.1], [5.2, 2.5, -13.2]),
        'creatures': ([8.3, 1.65, -3.5], [1.4, 2.5, -12.5]),
        'fantasy': ([-8.5, 1.65, -4], [-1.5, 2.5, -12.5]),
    }[kit.key]
    yard_name, side_eye, side_target = {
        'core': ('Training lanes', [0, 1.65, 10], [-1.6, 2.5, -2]),
        'heist': ('Loading street', [3, 1.65, 14], [-1.1, 2.5, -1.8]),
        'industrial': ('Receiving yard', [4.8, 1.65, 11], [0, 2.5, -1]),
        'security': ('Inspection road', [12.8, 1.65, -18.3], [5.8, 1.35, -15.7]),
        'creatures': ('Creek crossing', [-0.95, 1.65, 10.7], [-0.3, 2.5, -0.1]),
        'fantasy': ('Market approach', [1.1, 1.65, 12.5], [0.4, 2.5, -0.5]),
    }[kit.key]
    interior_eye = {
        'core': [6.7, 1.65, -16],
        'heist': [-0.8, 1.65, -17],
        'industrial': [0.2, 1.65, -19.5],
        'security': [-0.3, 1.65, -16.5],
        'creatures': [-3.3, 1.65, -20],
        'fantasy': [3.7, 1.65, -18.5],
    }[kit.key]
    interior_target = [mx, 1.25, mz]
    stops = [
        dict(label=name + ' entrance', eye=approach_eye, target=approach_target),
        dict(label=MACHINES[kit.key], eye=interior_eye, target=interior_target),
        dict(label=yard_name, eye=side_eye, target=side_target),
    ]
    return stops, fixtures


def ridge_roof(g, face, trim, high):
    # One bay spans the ridge. Eaves, rafters, and gable boards close both ends.
    shape = box(44, 2, 42, trim)
    rise = 3 if high else 2
    for step in range(1, 8):
        width = 44 - step * 5
        box(width, rise, 42, face, y=step * rise, sculpt=shape)
        for z in (-20, 20):
            box(width, rise, 2, trim, y=step * rise, z=z, sculpt=shape)
    box(8, 2, 44, trim, y=8 * rise, sculpt=shape)
    return shape


def monitor_roof(g):
    shape = g.roof(40, 40, g.DARK)
    for step in range(7):
        box(6, 2, 40, g.BODY, x=-17 + step * 5, y=3 + step * 2, sculpt=shape)
    box(2, 12, 40, g.METAL, x=17, y=3, sculpt=shape)
    for z in (-13, 0, 13):
        box(2, 6, 10, g.LIGHT, x=18, y=7, z=z, sculpt=shape)
    return shape


def trade_sign(g, key):
    # The colored motif identifies the trade from either end of the service yard.
    glyphs = {
        'core': ('22   22', '222 222', ' 22222 ', '  222  ', '  222  ', '  222  '),
        'heist': ('222222 ', '2    2 ', '222222 ', '2    22', '2222222', '      2'),
        'industrial': ('   2   ', '  22 2 ', ' 22222 ', '2222222', ' 22222 ', '  222  '),
        'security': ('  222  ', ' 2   2 ', '2222222', '222 222', '222 222', ' 22222 '),
        'creatures': ('   2   ', '  222  ', ' 22222 ', '  222  ', '2222222', '   2   '),
        'fantasy': (' 2 2 2 ', ' 2 2 2 ', '  2 2  ', ' 22222 ', '2222222', ' 22222 '),
    }
    shape = box(22, 16, 3, g.DARK)
    for y, row in enumerate(reversed(glyphs[key])):
        for x, pixel in enumerate(row):
            if pixel == '2':
                box(2, 2, 1, g.MARK, x=(x - 3) * 2, y=2 + y * 2, z=2, sculpt=shape)
    for y in (0, 15):
        box(24, 1, 4, g.CAP, y=y, sculpt=shape)
    return shape


def street_detail(kit, g, site, piece):
    key = kit.key
    if key == 'core':
        for x, z, turn in ((-8, -15, 0), (-8, -21, 0), (8, -14, 1)):
            kit.place('Loaded parts rack', x, z, turn)
        for x, z in ((-7.1, -14.3), (-7.9, -14), (-7.6, -21), (7.6, -12.3)):
            kit.place('Field case', x, z)
        kit.place('Utility pickup', -6.5, -10, 1)
        kit.place('Repair gantry', -8.5, -18.3, 1)
        for x, z in ((-9.8, -18.2), (-9.8, -15.7), (8.4, -14.1)):
            kit.place('Oil pan', x, z)
        for z in (-10, -12.4, -14.8):
            kit.place('Lane stripe', -10, z, 1, height=-0.08)
    elif key == 'heist':
        for x, z in ((-7, -15), (-8.2, -14.9), (-7.6, -16.1), (4.8, -16.6)):
            kit.place('Crated salvage', x, z)
        for x, z in ((-7.4, -15.4), (5.0, -17.4)):
            kit.place('Stacked salvage rack', x, z - 1.8)
        kit.place('Panel van', 5.8, -12, 2)
        kit.place('Street lamp', 5, -8.4)
        kit.place('Junk dumpster', -9.5, -17)
        for x in (-6, -2, 2):
            kit.place('Worn road section', x, -24, height=-0.16)
    elif key == 'industrial':
        for x, z in ((10, -15), (10, -18.4), (10, -21.8)):
            kit.place('Pressure vessel', x, z)
            kit.place('Tank feed pipes', x, z + 0.5, 1, height=2.1)
        kit.place('Warehouse forklift', 10.7, -10.6, 1)
        for x, z in ((-9, -14.9), (-9, -17.9), (-11, -14.7)):
            kit.place('Metal scrap skip', x, z)
        kit.place('Ore hopper', -10, -20.2)
        kit.place('Hopper conveyor', -10, -18.6)
    elif key == 'security':
        for x, z in ((4.4, -14.5), (4.4, -12)):
            kit.place('Queue rail', x, z, 1)
        for x in (-11, -9):
            kit.place('Server bank', x, -18.8)
            kit.place('Battery locker', x, -20.1)
        kit.place('Patrol rover', 10.6, -13.4, 2)
        kit.place('Survey mast', 11, -9.2)
        for z in (-12, -15, -18, -21):
            kit.place('Inspection lane floor', 12, z, height=-0.14)
        kit.place('Parking barrier arm', 11.5, -20.6)
    elif key == 'creatures':
        kit.place('Ranger truck', 6.5, -10.2, 1)
        for x, z in ((-7, -11), (-6, -13), (-9, -8.7), (9, -18), (11, -19)):
            kit.place('Split rail', x, z, 1)
        for x, z in ((-6.5, -14.5), (-8.7, -11.1), (8.9, -18.6)):
            kit.place('Forage trough', x, z)
            kit.place('Feed bucket', x + 1.1, z)
        for x, z in ((7, -14.1), (7.6, -14.8), (6.7, -15.5)):
            kit.place('Stream boulder', x, z)
    else:
        for x, z in ((-7, -13), (-7, -17), (10, -16)):
            kit.place('Produce stall frame', x, z)
            kit.place('Terracotta market awning', x, z, height=2.3)
            kit.place('Market table', x, z + 0.4)
            kit.place('Spice box', x, z + 0.4, height=1.0)
            kit.place('Market crate', x + 1.1, z + 0.2)
        kit.place('Wagon frame', 6.4, -10.1, 1)
        kit.place('Courtyard well', -8.3, -19.8)
        kit.place('Courtyard brazier', -5.3, -17.3)
        kit.place('Barrel stand', -5.3, -13.3)


def horizon(kit, g, piece):
    # The shapes and spacing follow the land use behind each site.
    wooded = kit.key in ('creatures', 'fantasy')
    if wooded:
        points = (
            (-14, -5),
            (-11, -18),
            (-14, -19),
            (-13, -22),
            (-9, -24),
            (-7, -26),
            (-1, -26),
            (1, -27),
            (7, -26),
            (10, -24),
            (12, -20),
            (11, -14),
            (14, -8),
            (-14, 7),
            (-12, 10),
            (-9, 13),
            (10, 10),
            (13, 7),
        )
        for i, (x, z) in enumerate(points):
            piece('Ridge fir', lambda: g.tree(86, 35, g.SOIL, g.DARK, conifer=True), x, z, i % 4)
            if i % 2 == 0:
                piece('High wooded bank', lambda: g.shale_escarpment(g.BODY), x + 1, z - 1, i % 4)
                piece('Ridge broadleaf', lambda: g.tree(56, 34, g.WOOD, g.BODY), x - 1.8, z + 1.4, i % 4)
        return
    for i, (x, z) in enumerate(
        ((-12, -21), (-12, -25), (-8, -25), (-4, -25), (8, -25), (12, -25), (12, -21))
    ):
        piece(
            'Service yard boundary',
            lambda: g.clad_wall(40, 32, 4, g.PATINA, g.DARK),
            x,
            z,
            1 if i in (0, 6) else 0,
        )
    for x, z in ((-14, -25), (-11, -26), (3, -27), (6, -26), (14, -17), (15, 2), (-15, 8)):
        piece('Yard poplar', lambda: g.tree(63, 28, g.WOOD, g.GRIT), x, z)
    roadside_x = 16.4 if kit.key in ('industrial', 'security') else 11
    for x, z in ((-12, -23), (12, -23), (roadside_x, -7)):
        piece('Service line pole', lambda: power_pole(g), x, z)


def power_pole(g):
    shape = box(3, 56, 3, g.WOOD)
    box(21, 2, 3, g.WOOD, y=49, sculpt=shape)
    for x in (-8, 0, 8):
        box(3, 4, 3, g.CAP, x=x, y=51, sculpt=shape)
    box(6, 11, 6, g.METAL, x=3, y=32, sculpt=shape)
    return shape


def district_floor(g, key):
    if key == 'creatures':
        shape = box(40, 2, 40, g.SOIL)
        for col in range(5):
            box(1, 1, 40, g.WOOD, x=-19 + col * 8, y=1, sculpt=shape)
        return shape
    if key == 'fantasy':
        return g.paving(40, 40, g.WOOD, g.SOIL, g.WOOD)
    shade = g.MASONRY if key == 'security' else g.GRIT
    return g.paving(40, 40, shade, g.DARK, g.METAL)


def meadow(g):
    shape = box(40, 2, 40, g.BODY)
    for x, z, w, d in (
        (-13, -13, 12, 8),
        (-10, -9, 13, 4),
        (11, 5, 14, 7),
        (9, 9, 10, 4),
        (-4, 13, 7, 4),
    ):
        box(w, 1, d, g.GRIT, x=x, z=z, y=1, sculpt=shape)
    for x, z in ((-15, -13), (4, -9), (8, 6), (-6, 13)):
        box(3, 3, 2, g.BODY, x=x, y=2, z=z, sculpt=shape)
        box(2, 5, 2, g.DARK, x=x + 1, y=2, z=z - 1, sculpt=shape)
    return shape


def surface_district(kit, g, tiles, piece):
    for col, row in tiles:
        piece(
            SITES[kit.key]['name'] + ' floor',
            lambda: district_floor(g, kit.key),
            -6 + col * 4,
            -20 + row * 4,
            height=-0.18,
        )
    if kit.key == 'creatures':
        for x in range(-16, 17, 4):
            for z in range(-28, 17, 4):
                if abs(x) >= 12 or z <= -24 or z >= 12:
                    piece('Meadow grass', lambda: meadow(g), x, z, (x // 4 + z // 4) % 4, height=-0.17)
    elif kit.key in ('heist', 'industrial', 'security', 'core'):
        for z in (-24, -20, -16, -12, -8, -4):
            for x in (10, 14):
                piece('Service road asphalt', g.street_surface, x, z, 1, height=-0.15)
        for z in (-23, -19, -15, -11):
            piece('Service road curb', g.curb, 8.0, z, 1, height=-0.12)


def dress_workroom(kit, g, x, z, piece):
    if kit.key == 'core':
        kit.place('Flatbed tool cart', x + 1.9, z + 0.5, 1)
        kit.place('Oil pan', x + 0.2, z + 1.5)
        kit.place('Training board', x - 2.8, z - 1.9)
        kit.place('Loaded parts rack', x + 2.9, z - 2.6)
        kit.place('Barrel marker', x + 2.1, z - 1.5)
    elif kit.key == 'heist':
        kit.place('Cable reel', x - 1.9, z - 0.5)
        kit.place('Pallet stack', x + 1.6, z - 2.0)
        kit.place('Crated salvage', x + 1.6, z - 2.0, height=0.3)
        kit.place('Stacked salvage rack', x - 2.7, z - 2.8)
    elif kit.key == 'industrial':
        kit.place('Pipe riser', x - 2.0, z)
        kit.place('Ore receiving skip', x - 1.8, z - 2.1, 1)
        kit.place('Tool trolley', x - 2.4, z + 0.5)
        kit.place('Overhead service pipes', x - 1.0, z - 1.0, height=3.5)
    elif kit.key == 'security':
        kit.place('Control desk', x - 2.2, z, 1)
        kit.place('Evidence case', x - 2.2, z, height=1.0)
        kit.place('Camera pod', x + 0.7, z - 2.0, 1)
        kit.place('People counter', x - 1.4, z + 1.0)
    elif kit.key == 'creatures':
        kit.place('Supply shelf', x - 2.5, z - 1.8)
        kit.place('Feed bucket', x - 1.9, z - 1.4, height=1.0)
        kit.place('Trail marker', x + 0.3, z - 1.9)
        kit.place('Nest mound', x - 2.4, z + 1.1)
    else:
        kit.place('Market table', x + 2.9, z, 1)
        kit.place('Spice box', x + 2.9, z, height=1.0)
        kit.place('Barrel stand', x - 1.8, z - 1.8)
        kit.place('Market bench', x + 2.8, z + 1.2, 1)
        kit.place('Market crate', x + 1.9, z - 2.3)


def integrate_yard(kit, g):
    # The original equipment yard serves as the south approach to the works.
    if kit.key == 'core':
        kit.place('Workshop window wall', -8.0, -3.8, 1)
        kit.place('Workshop window wall', -4.0, -3.8, 1)
        kit.place('Open doorway', -6, -2.0)
        kit.place('Heavy work table', -7.2, -4.6, 1)
        kit.place('Workshop column', -6.8, -1.9)
        kit.move('Training wall', -8.0, -5.75, 1)
    elif kit.key == 'heist':
        # The street frontage occupies the south face of the old print office.
        for x in (-4, 0, 4):
            if x != -4:
                kit.place('Flat brick coping', x, -7.7, height=5.75)
            kit.place('Brick facade', x, -9.4, 2)
            kit.place('Upper brick windows', x, -9.4, 2, height=2.7)
        for x in (-6, 6):
            kit.place('Service opening', x, -7.6, 1)
            kit.place('Upper brick windows', x, -7.6, 1, height=2.7)
        kit.move('Brick facade', -3.9, -7.5, 1)
    elif kit.key == 'industrial':
        kit.place('High sheet metal wall', -2.6, -5.75)
        kit.place('High sheet metal wall', -0.6, -4.1, 1)
        kit.place('Process bay opening', -2.6, -2.45)
        kit.place('Tank feed pipes', -3.7, -4.3, 1, height=2.7)
    elif kit.key == 'security':
        kit.place('Access doorway', -0.45, 5.35)
        kit.place('Partition windows', 1.45, -0.1, 1)
        kit.place('Partition windows', -2.35, -0.1, 1)
        kit.place('Service bulkhead', -0.45, -2.05)
    elif kit.key == 'fantasy':
        kit.place('Keep outer return', -1.8, -6.6, 1)
        kit.place('Keep outer return', 2.25, -6.6, 1)
        kit.place('Gate tower foot', 0.25, -8.25)
        kit.place('Gate tower cap', 0.25, -8.25, height=3.6)
        kit.place('Arcade roof slab', 0.25, -6.38, height=5.6)
        kit.place('Arcade roof slab', 0.25, -7.45, height=5.6)
    for placement in kit.placements:
        placement['position'][2] = round(placement['position'][2] + 4, 3)


def embankment(g, key):
    leaf = g.BODY if key == 'creatures' else g.SOIL
    rock = g.PATINA
    shape = box(40, 3, 40, rock)
    for x, z, w, d, y in (
        (-4, 0, 32, 40, 3),
        (7, -7, 25, 25, 4),
        (-8, 8, 25, 24, 4),
        (-8, 4, 19, 23, 6),
    ):
        box(w, 2, d, leaf, x=x, y=y, z=z, sculpt=shape)
    for x, z in ((-13, 12), (-11, 12), (12, -8), (10, -10), (-8, -13)):
        box(4, 2, 4, rock, x=x, y=7, z=z, sculpt=shape)
    return shape


def yard_shelter(g, face):
    shape = box(37, 3, 25, face, y=29)
    for x in (-16, 15):
        for z in (-10, 10):
            box(2, 29, 2, g.METAL, x=x, z=z, sculpt=shape)
    for x in range(-15, 16, 6):
        box(2, 1, 25, g.METAL, x=x, y=32, sculpt=shape)
    box(34, 3, 2, g.DARK, y=25, z=-10, sculpt=shape)
    return shape


def approach_landscape(kit, g, piece):
    key = kit.key
    if key == 'creatures':
        for x, z in ((-8.6, 8.9), (-11, 7.5), (10.5, 7.3), (9.4, 9.2), (7, 12), (-4, 12.7)):
            kit.place('Tall pine', x, z)
            kit.place('Brush clump', x + 0.9, z + 0.3)
        return
    if key == 'fantasy':
        for x, z in ((-9.6, 7.4), (-9.6, 4.1)):
            kit.place('Produce stall frame', x, z)
            kit.place('Terracotta market awning', x, z, height=2.3)
            kit.place('Market table', x, z + 0.4)
            kit.place('Cloth goods box', x, z + 0.4, height=1.0)
        kit.place('Wagon frame', -7.8, 9.4, 1)
        return
    shelter_x, shelter_z = (-10, 5) if key != 'core' else (9.8, 5.8)
    piece('Covered loading stand', lambda: yard_shelter(g, g.BODY), shelter_x, shelter_z)
    piece('Covered loading stand', lambda: yard_shelter(g, g.BODY), shelter_x, shelter_z - 2.5)
    groups = {
        'core': (
            'Heavy work table',
            'Field case',
            'Loaded parts rack',
            'Utility pickup',
            'Stripe bollard',
        ),
        'heist': (
            'Pallet stack',
            'Crated salvage',
            'Stacked salvage rack',
            'Street hatchback',
            'Roadwork beacon',
        ),
        'industrial': (
            'Loading pallet',
            'Shipping case',
            'Loaded steel rack',
            'Warehouse forklift',
            'Striped bollard',
        ),
        'security': ('Waiting bench', 'Evidence case', 'Ticket kiosk', 'Patrol rover', 'Gate post'),
    }
    table, crate, rack, vehicle, post = groups[key]
    kit.place(table, shelter_x, shelter_z)
    kit.place(crate, shelter_x + 1.1, shelter_z - 1)
    kit.place(rack, shelter_x, shelter_z - 2.8)
    kit.place(vehicle, shelter_x, shelter_z + 3.3, 1)
    for offset in (-1.6, 1.6):
        kit.place(post, shelter_x + offset, shelter_z + 1.6)
    # Wheel tracks and edge blocks connect the stand to the main street.
    for z in (6, 2, -2, -6):
        piece(
            'Loading yard wheel track',
            lambda: g.inlay(5, 34, g.GRIT, g.RUBBER),
            shelter_x + 2.1,
            z,
            height=-0.06,
        )
    for x, z in ((-10.7, 11.8), (-7.9, 12.5), (8.3, 11.4), (10.8, -2.0), (-10.6, 0)):
        piece('Roadside earth bed', lambda: embankment(g, key), x, z, height=-0.1)
        piece('Roadside shade tree', lambda: g.tree(49, 30, g.WOOD, g.DARK), x - 0.4, z + 0.5)


LETTERS = {
    'A': ('010', '101', '111', '101', '101'),
    'B': ('110', '101', '110', '101', '110'),
    'D': ('110', '101', '101', '101', '110'),
    'E': ('111', '100', '110', '100', '111'),
    'F': ('111', '100', '110', '100', '100'),
    'G': ('111', '100', '101', '101', '111'),
    'I': ('111', '010', '010', '010', '111'),
    'L': ('100', '100', '100', '100', '111'),
    'M': ('10001', '11011', '10101', '10001', '10001'),
    'N': ('1001', '1101', '1011', '1001', '1001'),
    'O': ('111', '101', '101', '101', '111'),
    'P': ('110', '101', '110', '100', '100'),
    'R': ('110', '101', '110', '101', '101'),
    'S': ('111', '100', '111', '001', '111'),
    'T': ('111', '010', '010', '010', '010'),
    'V': ('101', '101', '101', '101', '010'),
}


def letter_board(g, word):
    width = sum(len(LETTERS[c][0]) + 1 for c in word) * 2 + 2
    board = box(width, 13, 2, g.DARK, y=3)
    for x in (-width // 3, width // 3):
        box(2, 4, 2, g.METAL, x=x, sculpt=board)
    x = -width // 2 + 2
    for c in word:
        for row, line in enumerate(LETTERS[c]):
            for col, pixel in enumerate(line):
                if pixel == '1':
                    box(2, 2, 1, g.CAP, x=x + 2 * col, y=5 + 2 * (4 - row), z=1, sculpt=board)
        x += (len(LETTERS[c][0]) + 1) * 2
    return board
