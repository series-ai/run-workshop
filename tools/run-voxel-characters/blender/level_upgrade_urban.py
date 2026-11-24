"""Build the wheel shop and the paper dispatch gallery on a 10 cm grid."""


def assembly(g, parts):
    shape = g.Sculpt()
    for x, y, z, width, height, depth, color in parts:
        g.box(width, height, depth, color, x=x, y=y, z=z, sculpt=shape)
    return shape


def shed_roof(g):
    parts = []
    for side in (-1, 1):
        for step in range(8):
            x = side * (38 - 5 * step)
            parts.append((x, 2 * step, 0, 5, 2, 40, g.GRIT))
            if step in (0, 3, 6):
                parts.append((x, 2 * step + 2, 0, 1, 1, 40, g.METAL))
    parts.append((0, 16, 0, 4, 2, 40, g.METAL))
    return assembly(g, parts)


def shed_end(g):
    parts = [(0, 0, 0, 81, 3, 4, g.BODY)]
    for i in range(-7, 8):
        height = 15 - 2 * abs(i)
        parts.append((i * 5, 3, 0, 5, height, 2, g.DARK))
        if abs(i) < 5:
            parts.append((i * 5, 4, 1, 4, min(height - 2, 7), 1, g.LIGHT))
    return assembly(g, parts)


def lift_column(g):
    return assembly(g, [
        (0, 0, 0, 7, 2, 7, g.PATINA), (0, 2, 0, 4, 2, 4, g.DARK),
        (0, 4, 0, 3, 29, 3, g.BODY), (0, 33, 0, 5, 3, 5, g.METAL),
        (0, 5, 2, 1, 24, 2, g.METAL), (0, 6, 3, 3, 3, 4, g.MARK),
        (0, 8, 8, 3, 2, 10, g.MARK), (0, 9, 12, 4, 1, 4, g.RUBBER),
        (0, 14, -2, 2, 6, 2, g.MARK), (0, 16, -3, 2, 1, 1, g.DARK),
    ])


def tool_chest(g):
    parts = [(0, 2, 0, 16, 9, 7, g.BODY), (0, 11, 0, 17, 2, 8, g.RUBBER)]
    for x in (-6, 6):
        parts.append((x, 0, 0, 3, 2, 6, g.RUBBER))
    for y in (4, 7, 10):
        parts.append((0, y, 4, 12, 1, 1, g.METAL))
    return assembly(g, parts)


def compressor(g):
    return assembly(g, [
        (0, 3, 0, 18, 7, 7, g.BODY), (0, 4, 0, 20, 5, 9, g.BODY),
        (0, 3, 0, 16, 7, 5, g.BODY), (6, 2, 0, 3, 2, 8, g.DARK),
        (-6, 2, 0, 1, 1, 9, g.METAL),
        *((-6, 0, side * 5, 3, 5, 2, g.RUBBER) for side in (-1, 1)),
        *((-6, 1, side * 5, 5, 3, 2, g.RUBBER) for side in (-1, 1)),
        *((-6, 2, face, 1, 1, 1, g.METAL) for face in (-6, 5)),
        (1, 10, 0, 11, 1, 6, g.DARK),
        (3, 11, 0, 5, 4, 5, g.METAL), (-3, 11, 0, 5, 3, 4, g.RUBBER),
        (3, 12, 2, 5, 1, 1, g.DARK), (3, 14, 2, 5, 1, 1, g.DARK),
        (-7, 9, 0, 2, 5, 2, g.METAL), (-7, 13, 1, 4, 4, 2, g.DARK),
        (-7, 14, 2, 2, 2, 1, g.CAP), (-6, 12, 3, 2, 1, 2, g.MARK),
        (10, 6, -2, 5, 1, 1, g.METAL), (10, 6, 2, 5, 1, 1, g.METAL),
        (12, 6, 0, 1, 1, 5, g.RUBBER),
    ])


def sliding_leaf(g):
    parts = [(0, 0, 0, 17, 28, 2, g.GRIT), (0, 0, 1, 17, 2, 2, g.BODY),
             (0, 17, 1, 13, 7, 2, g.LIGHT), (0, 20, 2, 13, 1, 1, g.METAL),
             (0, 17, 2, 1, 7, 1, g.METAL), (5, 9, 2, 1, 4, 2, g.METAL)]
    for x in (-8, 8):
        parts.append((x, 0, 1, 2, 28, 2, g.BODY))
    return assembly(g, parts)


def resculpt(kit, g, label, shape):
    prop_id = kit.prop_id(label)
    index = next(i for i, entry in enumerate(kit.props) if entry[0] == prop_id)
    g.apply_finish(kit.key, label, shape)
    kit.props[index] = (prop_id, label, shape)


def move_stock(kit, transfers):
    moves = [(kit.placement_at(label, x, z), target)
             for (label, x, z), target in transfers.items()]
    for placement, (x, z) in moves:
        placement['position'] = [x, placement['position'][1], z]


def remove_tiles(kit, label, coordinates, *, height=None):
    tiles = [kit.placement_at(label, x, z, height=height) for x, z in coordinates]
    for tile in tiles:
        kit.placements.remove(tile)
    return tiles


def service_lane(kit, g, fixtures):
    # Use the west strip of the yard as the delivery road.
    apron = remove_tiles(kit, 'Yard embankment', [
        (x, z) for x in (-16, -12) for z in range(-24, -3, 4)
    ])
    road = 'Service lane asphalt'
    for i, place in enumerate(apron):
        x, _, z = place['position']
        if i == 0:
            kit.add(road, assembly(g, [
                (0, 0, 0, 40, 2, 40, g.DARK),
                (-12, 1, 7, 7, 1, 17, g.GRIT), (9, 1, -10, 16, 1, 4, g.GRIT),
            ]), x, z, height=-0.2)
        else:
            kit.place(road, x, z, place['turn'], height=-0.2)
    kit.add('Workshop apron seam', assembly(g, [
        (0, 0, 0, 30, 2, 30, g.PATINA), (0, 1, 0, 29, 1, 29, g.MASONRY),
        (-6, 1, -4, 3, 1, 12, g.GRIT), (5, 1, 4, 3, 1, 10, g.GRIT),
    ]), -9.65, -10.55, height=-0.16)
    kit.place('Workshop apron seam', -9.65, -7.55, 2, -0.16)
    kit.place('Workshop apron seam', -6.65, -7.55, 1, -0.16)
    kit.set_palette('Workshop apron seam', skin='#90908a', primary='#737773')
    kit.add('Lane verge planter', assembly(g, [
        (0, 0, 0, 14, 3, 28, g.PATINA), (0, 3, 0, 11, 1, 25, g.SOIL),
        (-3, 4, -8, 4, 2, 5, g.BODY), (3, 4, -3, 4, 3, 7, g.BODY),
        (-1, 4, 4, 5, 2, 6, g.GRIT), (-3, 6, 5, 3, 2, 4, g.BODY),
        (2, 4, 9, 3, 3, 3, g.BODY),
    ]), -16.9, -5.25)
    kit.place('Lane verge planter', -17.0, -8.8, 2)
    kit.set_palette('Lane verge planter', primary='#687756', skin='#858474')
    kit.add('Service court door frame', g.panel(40, 32, 3, g.MASONRY, g.METAL, opening=20),
            -11.8, -14, 3)
    kit.remove_at('Wheel shop side glazing', -11.8, -14)
    kit.add('Open workshop door', sliding_leaf(g), -11.84, -15.4, 3)
    kit.set_palette('Open workshop door', visor='#7a9498')
    kit.set_palette(road, secondary='#62696a', primary='#697276')
    kit.add('Service lane drain', assembly(g, [
        (0, 0, 0, 5, 2, 24, g.RUBBER),
        *((0, 1, z, 5, 1, 1, g.METAL) for z in (-10, -7, -4, -1, 2, 5, 8, 11)),
    ]), -11.4, -9.2, height=-0.13)
    kit.place('Service lane drain', -12.15, -15.85, height=-0.13)
    kit.add('Wheel stop kerb', assembly(g, [
        (0, 0, 0, 6, 2, 23, g.MASONRY), (0, 2, 0, 4, 1, 21, g.PATINA),
        (0, 2, -6, 4, 1, 4, g.CAP), (0, 2, 6, 4, 1, 4, g.CAP),
    ]), -17.3, -6.2)
    for z in (-9.0, -11.8, -14.6, -17.4):
        kit.place('Wheel stop kerb', -17.3, z)
    kit.add('Lubricant depot wall', assembly(g, [
        (0, 0, 0, 38, 5, 4, g.PATINA), (0, 5, 0, 38, 21, 3, g.BODY),
        (0, 26, 0, 40, 2, 5, g.METAL),
        *((x, 0, 0, 3, 27, 5, g.MASONRY) for x in (-18, 17)),
        (0, 12, 1, 30, 1, 2, g.GRIT),
    ]), -17.25, -17.8, 1)
    kit.place('Lubricant depot wall', -17.25, -14, 1)
    kit.add('Depot rear opening', assembly(g, [
        (-14, 0, 0, 10, 24, 4, g.MASONRY), (14, 0, 0, 10, 24, 4, g.MASONRY),
        (0, 24, 0, 38, 4, 5, g.BODY), (-10, 0, 0, 2, 24, 5, g.WOOD),
        (10, 0, 0, 2, 24, 5, g.WOOD),
    ]), -15.35, -19.65)
    kit.set_palette('Depot rear opening', skin='#928574', primary='#757970')
    kit.set_palette('Lubricant depot wall', primary='#927a67', skin='#85827c')
    kit.add('Lubricant store canopy', assembly(g, [
        *((x, i, 0, 5, 2, 39, g.GRIT) for i, x in enumerate((-12, -7, -2, 3, 8, 13))),
        (-14, 0, 0, 3, 2, 40, g.METAL), (14, 5, 0, 3, 2, 40, g.METAL),
        (0, 0, 18, 31, 2, 3, g.METAL),
    ]), -15.75, -17.65, height=2.7)
    kit.place('Lubricant store canopy', -15.75, -13.75, height=2.7)
    kit.add('Canopy angle post', assembly(g, [
        (0, 0, 0, 4, 3, 4, g.PATINA), (0, 3, 0, 2, 27, 2, g.METAL),
        (0, 30, 0, 5, 2, 4, g.DARK), (0, 4, 0, 3, 5, 3, g.MARK),
    ]), -14.35, -19.4)
    for z in (-15.7, -11.85):
        kit.place('Canopy angle post', -14.35, z)
    kit.add('Depot storage tank', assembly(g, [
        (-8, 0, 0, 4, 5, 12, g.PATINA), (8, 0, 0, 4, 5, 12, g.PATINA),
        (0, 5, 0, 26, 4, 10, g.BODY), (0, 8, 0, 28, 9, 14, g.BODY),
        (0, 17, 0, 26, 3, 10, g.BODY), (0, 20, 0, 22, 2, 6, g.BODY),
        (6, 22, 0, 4, 2, 4, g.METAL), (-9, 8, 7, 5, 4, 2, g.CAP),
        (14, 8, 0, 3, 3, 4, g.METAL),
    ]), -16.0, -17.7, 1)
    kit.set_palette('Depot storage tank', primary='#6c8479', trim='#c6c0a3')
    kit.add('Lubricant pump and reel', assembly(g, [
        (0, 0, 0, 9, 2, 9, g.PATINA), (0, 2, 0, 7, 12, 7, g.DETAIL),
        (0, 14, 0, 8, 6, 7, g.CAP), (0, 15, 3, 5, 3, 1, g.DARK),
        (0, 20, 0, 7, 2, 7, g.DETAIL),
        (5, 10, 0, 4, 5, 3, g.RUBBER), (5, 6, 0, 3, 5, 2, g.RUBBER),
        (6, 5, 1, 3, 2, 3, g.METAL),
    ]), -15.1, -15.45, 1)
    kit.set_palette('Lubricant pump and reel', detail='#ad6651', trim='#d6d1bd')
    kit.add('Oil delivery drums', assembly(g, [
        (0, 0, 0, 18, 2, 10, g.WOOD),
        *((x, 2, 0, 7, 11, 7, c) for x, c in ((-5, g.BODY), (4, g.DETAIL))),
        *((x, y, 0, 8, 1, 8, g.DARK) for x in (-5, 4) for y in (3, 8, 12)),
    ]), -15.95, -13.25, 1)
    kit.set_palette('Oil delivery drums', primary='#667b6d', detail='#94624c')
    kit.add('Vehicle yard gate', assembly(g, [
        (-14, 0, 0, 4, 26, 4, g.PATINA), (0, 4, 0, 28, 2, 2, g.METAL),
        (0, 21, 0, 28, 2, 2, g.METAL),
        *((x, 4, 0, 1, 19, 1, g.METAL) for x in (-11, -7, -3, 1, 5, 9, 13)),
    ]), -17.05, -21.95, 1)
    kit.place('Vehicle yard gate', -11.2, -22.05, 1)
    kit.add('Depot work light', assembly(g, [
        (0, 0, 0, 8, 1, 5, g.LAMP), (0, 1, 0, 10, 2, 6, g.DARK),
        (0, 3, 0, 2, 3, 2, g.METAL),
    ]), -15.6, -15.85, height=2.45)
    kit.add('Service lane enamel sign', assembly(g, [
        (0, 0, 0, 18, 10, 2, g.WOOD), (0, 1, 1, 16, 8, 1, g.DETAIL),
        (-2, 3, 2, 7, 3, 1, g.CAP), (2, 5, 2, 3, 1, 1, g.CAP),
        (4, 6, 2, 2, 1, 1, g.CAP), (-4, 6, 2, 3, 1, 1, g.CAP),
        (-6, 10, 0, 2, 3, 2, g.METAL), (6, 10, 0, 2, 3, 2, g.METAL),
    ]), -15.55, -11.82, height=1.57)
    kit.set_palette('Service lane enamel sign', detail='#995a47', trim='#e4d4ad')
    kit.add('Workshop inspection wand', assembly(g, [
        (0, 0, 0, 5, 2, 5, g.RUBBER), (0, 2, 0, 2, 8, 2, g.DARK),
        (0, 10, 0, 3, 5, 3, g.METAL), (0, 11, 1, 2, 3, 1, g.LAMP),
    ]), -9.8, -17.2, 1)
    fixtures.append(dict(position=[-9.6, 1.2, -17.15], color='#f6e5c5', intensity=6, distance=4))
    fixtures.append(dict(position=[-15.6, 2.4, -15.85], color='#ffdfab', intensity=8, distance=5))


def parked_shop_pickup(kit, g):
    glass = g.vehicles.PARKED_GLASS
    paint = g.vehicles.PAINT
    body = assembly(g, [
        (0, 4, 0, 18, 4, 32, g.vehicles.FRAME), (0, 8, 0, 19, 3, 37, paint),
        (0, 11, 4, 15, 2, 12, glass), (0, 13, 3, 15, 3, 10, glass),
        (0, 16, 3, 15, 1, 10, paint), (-8, 11, -10, 1, 3, 14, paint),
        (7, 11, -10, 1, 3, 14, paint), (0, 11, -17, 16, 3, 1, paint),
        (0, 11, -4, 13, 2, 3, g.METAL),
        (-7, 9, -18, 2, 1, 1, g.vehicles.TAIL), (7, 9, -18, 2, 1, 1, g.vehicles.TAIL),
    ])
    for part in kit.vehicles[kit.prop_id('Utility pickup')].parts:
        if not part.name.endswith('_spin'):
            continue
        x, y, z = part.pivot
        tire = g.Sculpt()
        g.vehicles.disc(tire, (x-1, x+1), y, z, 4, g.vehicles.TIRE)
        face = x + (1 if x > 0 else -1)
        tire.box(face, (y-2, y+1), (z-2, z+1), g.vehicles.RIM)
        tire.box(face, (y-1, y), (z-1, z), g.METAL)
        body.ops.extend(tire.ops)
    return body


def motor_pool(kit, g, fixtures):
    kit.move('Workshop pitched roof', -6, -0.35, height=2.9)
    move_stock(kit, {
        ('Loaded parts rack', -8, -15): (-8.5, -19.4),
        ('Field case', -7.1, -14.3): (-5, -18.6),
        ('Field case', -7.9, -14): (-5.9, -18.9),
    })
    for z in (-14, -18):
        if z == -14:
            kit.add('Wheel shop folded roof', shed_roof(g), -8, z, height=3.6)
        else:
            kit.place('Wheel shop folded roof', -8, z, height=3.6)
    kit.add('Wheel shop glazed gable', shed_end(g), -8, -12.1, height=3.6)
    kit.place('Wheel shop glazed gable', -8, -19.9, 2, 3.6)
    kit.add('Wheel shop pier', assembly(g, [
        (0, 0, 0, 6, 3, 6, g.PATINA), (0, 3, 0, 4, 2, 4, g.DARK),
        (0, 5, 0, 2, 29, 3, g.BODY), (0, 5, -1, 4, 29, 1, g.BODY),
        (0, 5, 1, 4, 29, 1, g.BODY), (0, 34, 0, 5, 2, 5, g.METAL),
        (0, 5, 2, 3, 2, 1, g.PATINA),
    ]), -11.8, -12.2)
    for x, z in ((-4.2, -12.2), (-4.2, -16), (-11.8, -16), (-11.8, -19.8), (-4.2, -19.8)):
        kit.place('Wheel shop pier', x, z)
    kit.add('Wheel shop side glazing', g.window_wall(g.PATINA, g.METAL), -11.8, -14, 1)
    kit.place('Wheel shop side glazing', -11.8, -18, 1)
    kit.add('Wheel shop shutter', sliding_leaf(g), -10.8, -12.1)
    kit.place('Wheel shop shutter', -5.2, -12.1)
    kit.add('Wheel shop overhead rail', assembly(g, [
        (0, 0, 0, 78, 2, 4, g.METAL), (0, 2, 0, 78, 3, 2, g.DARK),
        (0, 5, 0, 78, 1, 4, g.METAL),
    ]), -8, -12.1, height=3.0)
    kit.add('Hydraulic wheel lift', lift_column(g), -9.5, -15.2, 1)
    kit.place('Hydraulic wheel lift', -6.4, -15.9, 3)
    service_body = kit.vehicles[kit.prop_id('Utility pickup')].rest()
    service_body.cut((6, 10), (0, 7), (6, 15))
    service_body.cut((-6, 5), (8, 15), (8, 16))
    kit.add('Service pickup body', service_body, -8, -15.2, height=.55)
    resculpt(kit, g, 'Utility pickup', parked_shop_pickup(kit, g))
    kit.set_palette('Service pickup body', primary='#779a9f', secondary='#596361', hair='#393c3c')
    kit.add('Raised pickup hood', assembly(g, [
        *((0, i*2, i, 13, 3, 2, g.BODY) for i in range(5)),
        (-4, 2, 0, 1, 6, 2, g.METAL), (4, 2, 0, 1, 6, 2, g.METAL),
        (0, 8, 2, 9, 1, 2, g.METAL),
    ]), -8.04, -14.26, height=1.63)
    kit.set_palette('Raised pickup hood', primary='#65898d')
    kit.add('Exposed steering knuckle', assembly(g, [
        (-2, 2, 0, 5, 3, 3, g.DARK), (1, 1, 0, 3, 5, 7, g.METAL),
        (1, 0, 0, 3, 7, 5, g.METAL), (3, 2, 0, 2, 3, 3, g.GRIT),
        (4, 3, 0, 1, 1, 1, g.CAP), (2, 2, 3, 3, 4, 2, g.DETAIL),
        *((3, y, z, 1, 1, 1, g.DARK) for y in (1,5) for z in (-1,1)),
    ]), -7.25, -14.1, height=.7)
    kit.set_palette('Exposed steering knuckle', metal='#b8b8aa', detail='#995f46')
    kit.add('Engine accessory pack', assembly(g, [
        (-1, 0, 0, 7, 3, 6, g.DARK), (-1, 3, 0, 6, 2, 5, g.METAL),
        (-2, 5, -1, 3, 2, 3, g.RUBBER), (3, 0, 1, 3, 3, 4, g.DETAIL),
        (2, 3, 2, 2, 2, 2, g.METAL),
    ]), -8.05, -13.96, height=1.31)
    kit.add('Workshop drawer chest', tool_chest(g), -10.6, -16.5, 1)
    kit.add('Wheel air compressor', compressor(g), -9.45, -13.22, 0)
    kit.set_palette('Wheel air compressor', metal='#aaa99c', accent='#cb9c55')
    kit.add('Inspection light strip', assembly(g, [
        (0, 0, 0, 20, 1, 3, g.LAMP), (0, 1, 0, 22, 2, 4, g.METAL),
        (-8, 3, 0, 2, 11, 2, g.DARK), (8, 3, 0, 2, 11, 2, g.DARK),
    ]), -8, -14.4, height=3.45)
    kit.add('Lane marshal booth', assembly(g, [
        (0, 0, 0, 30, 2, 22, g.WOOD), (0, 2, 9, 29, 4, 2, g.BODY),
        (0, 2, -9, 29, 18, 2, g.BODY), (-14, 2, 0, 2, 6, 18, g.BODY),
        (-14, 8, -4, 2, 11, 9, g.LIGHT), (14, 2, -6, 2, 18, 6, g.BODY),
        *((x, 6, 9, 2, 14, 2, g.DARK) for x in (-14, -3, 14)),
        (0, 6, 10, 30, 1, 3, g.WOOD), (-8, 17, 9, 10, 3, 1, g.LIGHT),
        (6, 18, 10, 15, 2, 2, g.METAL), (0, 20, 0, 33, 2, 25, g.DARK),
        (0, 22, -2, 31, 1, 20, g.METAL),
    ]), 3.2, 0.25, height=2.55)
    kit.add('Lane marshal trestle', assembly(g, [
        *((x, 0, z, 3, 24, 3, g.METAL) for x in (-12, 12) for z in (-8, 8)),
        (0, 23, 0, 31, 3, 23, g.DARK), (0, 7, -8, 25, 2, 2, g.BODY),
        (0, 17, -8, 25, 2, 2, g.BODY),
    ]), 3.2, 0.25)
    kit.add('Marshal ladder', assembly(g, [
        (-4, 0, 0, 1, 28, 2, g.METAL), (4, 0, 0, 1, 28, 2, g.METAL),
        *((0, y, 0, 7, 1, 2, g.MARK) for y in range(2, 27, 4)),
    ]), 4.74, 0.25, 1)
    kit.add('Engine rebuild stand', assembly(g, [
        (0, 1, 0, 12, 2, 3, g.DETAIL), (0, 1, -3, 4, 2, 10, g.DETAIL),
        (-5, 0, 0, 2, 2, 2, g.RUBBER), (5, 0, 0, 2, 2, 2, g.RUBBER),
        (0, 3, -5, 3, 8, 3, g.DETAIL), (0, 9, -3, 4, 4, 6, g.METAL),
        (0, 10, 1, 9, 4, 9, g.DARK), (0, 14, 1, 8, 3, 9, g.METAL),
        (-3, 16, 1, 2, 2, 8, g.RUBBER), (3, 16, 1, 2, 2, 8, g.RUBBER),
        (0, 11, 6, 5, 4, 2, g.GRIT), (0, 12, 7, 2, 2, 1, g.METAL),
    ]), -5.2, -19.15, 2)
    kit.add('Workshop brake disc', assembly(g, [
        (0, 0, 0, 8, 2, 5, g.DARK), (0, 2, 0, 9, 4, 2, g.METAL),
        (0, 6, 0, 6, 2, 2, g.METAL), (0, 3, 1, 4, 2, 2, g.RUBBER),
        (-5, 3, 0, 3, 3, 3, g.DETAIL),
    ]), -10.45, -16.5, 1, 1.3)
    kit.add('Inspection lane curb', assembly(g, [
        (0, 0, 0, 4, 2, 36, g.PATINA), (0, 2, 0, 3, 1, 36, g.CAP),
        (0, 2, -11, 3, 1, 6, g.MARK), (0, 2, 5, 3, 1, 6, g.MARK),
    ]), -2.0, 2.0)
    for x, z in ((-2, 5.6), (2, 2), (2, 5.6)):
        kit.place('Inspection lane curb', x, z)
    kit.add('Axle inspection rollers', assembly(g, [
        (0, 0, 0, 30, 1, 12, g.DARK),
        *((x, 1, z, 9, 1, 2, g.METAL) for x in (-9, 9) for z in (-4, 0, 4)),
        (0, 1, 0, 5, 1, 10, g.GRIT),
    ]), 0, 3.3)
    kit.add('Lane test signal', assembly(g, [
        (0, 0, 0, 5, 2, 5, g.PATINA), (0, 2, 0, 2, 17, 2, g.METAL),
        (0, 19, 0, 5, 10, 4, g.DARK), (0, 25, 2, 3, 3, 1, g.DETAIL),
        (0, 20, 2, 3, 3, 1, g.MARK), (0, 28, 2, 5, 1, 4, g.RUBBER),
        (0, 23, 2, 5, 1, 4, g.RUBBER),
    ]), 2.12, 4.5)
    fixtures.append(dict(position=[-8, 3.3, -14.4], color='#ffddac', intensity=16, distance=8))


def tire_face(g, width=4):
    # The eight stepped edges leave room for a steel dish and dark tire bead.
    tire = assembly(g, [
        (0, 0, 0, 6, 10, width, g.RUBBER), (0, 1, 0, 8, 8, width, g.RUBBER),
        (0, 2, 0, 10, 6, width, g.RUBBER), (0, 2, 1, 4, 6, width, g.DARK),
        (0, 3, 1, 6, 4, width, g.DARK), (0, 3, 2, 4, 4, width, g.METAL),
        (0, 4, 3, 2, 2, width, g.GRIT),
    ])
    return tire


def course_equipment(kit, g, fixtures):
    kit.add('Wheel balancing spindle', assembly(g, [
        (0, 0, 0, 13, 2, 9, g.DARK), (0, 2, -1, 10, 8, 7, g.BODY),
        (-2, 10, -1, 7, 3, 7, g.METAL), (-3, 13, -2, 5, 3, 4, g.BODY),
        (4, 8, 1, 4, 3, 7, g.METAL), (4, 8, 5, 3, 3, 3, g.DARK),
    ]), -5.74, -17.75, 1)
    kit.set_palette('Wheel balancing spindle', primary='#8a594d', metal='#a5acac')
    kit.add('Wheel balancing rim', tire_face(g), -5.20, -18.11, 1, 0.44)
    kit.add('Spare wheel cradle', assembly(g, [
        (0, 0, 0, 12, 2, 8, g.WOOD), (-5, 2, 0, 2, 2, 8, g.DARK),
        (5, 2, 0, 2, 2, 8, g.DARK),
    ]), -10.8, -12.9, 1)
    kit.place('Wheel balancing rim', -10.8, -12.9, 1, 0.19)
    kit.add('Wheel alignment clamp', assembly(g, [
        (0, 0, 0, 1, 7, 4, g.DARK), (0, 2, 2, 1, 3, 3, g.DETAIL),
        (1, 2, 2, 1, 3, 2, g.METAL), (0, 0, -1, 1, 1, 3, g.METAL),
    ]), -7.02, -16.3, height=.64)
    kit.add('Wheel bay rear wall', assembly(g, [
        (0, 0, 0, 40, 9, 4, g.BODY), (0, 9, 0, 40, 26, 3, g.MASONRY),
        (0, 19, 1, 29, 10, 2, g.DARK), (0, 20, 2, 26, 8, 1, g.LIGHT),
        *((x, 20, 2, 2, 8, 2, g.METAL) for x in (-9, 0, 9)),
        (0, 28, 2, 31, 2, 3, g.BODY),
    ]), -10, -19.82)
    kit.place('Wheel bay rear wall', -6, -19.82)
    kit.set_palette('Wheel bay rear wall', primary='#678077', skin='#a79b85', visor='#8cacae')
    kit.add('Workshop air line', assembly(g, [
        (-9, 0, 0, 2, 2, 2, g.DARK), (0, 0, 0, 18, 1, 1, g.METAL),
        (9, 0, 0, 2, 2, 2, g.MARK), (8, -7, 0, 1, 8, 1, g.DARK),
        (7, -8, 0, 3, 2, 1, g.MARK),
    ]), -10.65, -19.64, height=1.1)
    kit.add('Workshop socket board', assembly(g, [
        (0, 0, 0, 22, 12, 2, g.WOOD), (0, 0, 1, 22, 1, 2, g.METAL),
        *((x, 2, 1, 1, h, 2, g.METAL) for x, h in ((-7,5),(-4,6),(-1,7),(2,8))),
        (6, 5, 1, 3, 4, 2, g.DETAIL), (7, 1, 1, 2, 4, 2, g.METAL),
    ]), -11.5, -17.3, 1, 1.35)
    kit.set_palette('Workshop socket board', leather='#86755d')
    kit.set_palette('Utility pickup', primary='#6c8693', secondary='#53636a', hair='#393c3c')
    kit.set_palette('Wheel shop pier', primary='#577079', skin='#a59b89')
    kit.set_palette('Wheel shop folded roof', primary='#5d6c6e', metal='#a0a5a1')
    kit.set_palette('Wheel shop side glazing', skin='#a08e78', metal='#758981')
    kit.set_palette('Wheel shop shutter', primary='#697972', visor='#859995')
    kit.add('Marshal impact tires', assembly(g, [
        *((x, 0, 0, 8, 3, 10, g.RUBBER) for x in (-5, 5)),
        *((x, 0, 0, 10, 3, 7, g.RUBBER) for x in (-5, 5)),
        *((x, 3, 0, 8, 3, 10, g.DARK) for x in (-5, 5)),
        *((x, 3, 0, 10, 3, 7, g.DARK) for x in (-5, 5)),
        *((x, 5, 0, 4, 1, 4, g.RUBBER) for x in (-5, 5)),
        (-5, 6, 0, 8, 3, 10, g.RUBBER), (-5, 6, 0, 10, 3, 7, g.RUBBER),
        (-5, 8, 0, 4, 1, 4, g.DARK),
    ]), -2.75, 4.55, 1)
    kit.place('Marshal impact tires', 2.95, 2.55, 1)
    kit.place('Marshal impact tires', -2.05, -0.6, 2)
    kit.set_palette('Marshal impact tires', hair='#424440', secondary='#585b52')
    kit.add('Lane timber rub rail', assembly(g, [
        (-12, 0, 0, 4, 9, 4, g.PATINA), (12, 0, 0, 4, 9, 4, g.PATINA),
        (0, 3, 1, 32, 5, 3, g.WOOD), (0, 7, 1, 32, 2, 3, g.WOOD),
        (-12, 6, 3, 2, 2, 1, g.METAL), (12, 6, 3, 2, 2, 1, g.METAL),
        (-5, 4, 3, 8, 1, 1, g.SOIL),
    ]), -2.25, 7.5, 1)
    kit.place('Lane timber rub rail', 2.4, 7.55, 3)
    kit.set_palette('Lane timber rub rail', leather='#91745c')
    kit.add('Course measuring post', assembly(g, [
        (0, 0, 0, 5, 2, 6, g.PATINA), (0, 2, 0, 2, 16, 2, g.METAL),
        (0, 13, 0, 7, 7, 2, g.BODY), (0, 14, 1, 5, 5, 1, g.CAP),
        (0, 15, 2, 1, 3, 1, g.DARK), (-1,17,2,1,1,1,g.DARK),
    ]), -2.12, 2.1)
    kit.add('Marshal timing table', assembly(g, [
        (-6, 0, 0, 3, 8, 5, g.METAL), (6, 0, 0, 3, 8, 5, g.METAL),
        (0, 8, 0, 16, 2, 7, g.WOOD), (-3, 10, 0, 7, 1, 5, g.CAP),
        (4, 10, 0, 4, 4, 4, g.DARK), (4, 12, 2, 2, 1, 1, g.LIGHT),
    ]), 3.1, 0.3)
    kit.set_palette('Low cover', skin='#9d9686', primary='#768080')
    kit.set_palette('Target backstop', skin='#998e7b', secondary='#505f59', trim='#c9b38f',
                    leather='#94795f', detail='#a25d45')
    kit.add('Calibration wall bumper', assembly(g, [
        (0, 0, 0, 50, 2, 7, g.DARK), (0, 2, -1, 50, 5, 5, g.WOOD),
        (0, 7, -1, 51, 2, 6, g.WOOD), (-16, 2, 2, 7, 5, 2, g.RUBBER),
        (0, 2, 2, 7, 5, 2, g.RUBBER), (16, 2, 2, 7, 5, 2, g.RUBBER),
        *((x, 7, 2, 2, 1, 2, g.METAL) for x in (-22, -10, 10, 22)),
    ]), -.25, -.84)
    kit.set_palette('Calibration wall bumper', leather='#97775d', hair='#4c4c43')
    kit.add('Calibration gravel trough', assembly(g, [
        (0, 0, 0, 45, 2, 9, g.PATINA), (0, 2, 0, 43, 1, 7, g.SOIL),
        *((x, 2, z, w, 2, 2, g.MASONRY) for x, z, w in
          ((-17, -2, 4), (-12, 1, 3), (-4, -1, 5), (3, 1, 3), (12, -2, 4), (18, 1, 2))),
    ]), -.25, -.15)
    kit.set_palette('Calibration gravel trough', skin='#9a927d', leather='#8c836d')
    kit.add('Calibration panel hood', assembly(g, [
        (0, 0, -1, 50, 2, 4, g.WOOD), (0, 2, 0, 54, 2, 9, g.GRIT),
        (0, 4, -2, 54, 1, 6, g.GRIT), (-22, -3, 0, 3, 3, 4, g.METAL),
        (22, -3, 0, 3, 3, 4, g.METAL), (0, 1, 4, 52, 1, 2, g.METAL),
    ]), -.25, -1.1, height=3.12)
    kit.set_palette('Calibration panel hood', primary='#67756d', leather='#967960')
    kit.add('Lane control cable drum', assembly(g, [
        (-5, 0, 0, 2, 7, 7, g.WOOD), (5, 0, 0, 2, 7, 7, g.WOOD),
        (0, 1, 0, 9, 5, 5, g.RUBBER), (0, 2, 0, 13, 3, 3, g.METAL),
    ]), 3.65, 1.0)
    kit.add('Lane marshal flag rack', assembly(g, [
        (0, 0, 0, 9, 2, 5, g.WOOD), (-3, 2, 0, 1, 14, 1, g.WOOD),
        (2, 2, 0, 1, 11, 1, g.METAL), (-1, 11, 0, 4, 5, 1, g.MARK),
        (4, 9, 0, 4, 4, 1, g.DETAIL),
    ]), 3.82, 1.55)
    kit.set_palette('Lane marshal booth', primary='#62776e', visor='#86a19b')
    kit.add('Inspection bay wall lamp', assembly(g, [
        (0, 0, 0, 9, 1, 3, g.LAMP), (0, 1, 0, 11, 2, 4, g.DARK),
        (0, 2, -2, 3, 2, 4, g.METAL),
    ]), -11.55, -17.4, 1, 2.45)
    fixtures.append(dict(position=[-11.25, 2.35, -17.4], color='#e4f0e6', intensity=8, distance=5))


def motor_pool_services(kit, g, fixtures):
    kit.set_palette('Hydraulic wheel lift', primary='#a27a67', accent='#cfb37a')
    kit.set_palette('Raised pickup hood', primary='#617885', metal='#7e8a87')
    kit.add('Wheel bay drop light', assembly(g, [
        (0, 0, 0, 4, 1, 3, g.LAMP), (0, 1, 0, 5, 2, 4, g.GRIT),
        (-2, 2, 0, 1, 4, 2, g.METAL), (-4, 5, 0, 4, 1, 2, g.RUBBER),
    ]), -7.55, -14.16, height=2.08)
    fixtures.append(dict(position=[-7.35, 2.03, -13.89], color='#fff1d2', intensity=1.5, distance=2.3))
    kit.add('Lift inspection pedestal', assembly(g, [
        (0, 0, 0, 5, 2, 5, g.DARK), (0, 2, 0, 2, 12, 2, g.METAL),
        (0, 14, 0, 5, 3, 4, g.GRIT), (0, 14, 2, 3, 2, 1, g.LAMP),
        (-2, 2, 0, 3, 1, 3, g.MARK),
    ]), -10.7, -14.5, 1)
    fixtures.append(dict(position=[-10.42, 1.54, -14.5], color='#ecf3e9', intensity=2.5, distance=2.7))
    kit.add('Shop air main', assembly(g, [
        (0, 12, 0, 34, 2, 2, g.METAL), (13, 3, 0, 2, 10, 2, g.BODY),
        (13, 2, 1, 4, 3, 3, g.METAL), (12, 0, 2, 2, 3, 2, g.MARK),
        *((x, 11, -1, 2, 4, 3, g.DARK) for x in (-13, 0, 13)),
    ]), -12.03, -17.9, 3, 1.18)
    kit.add('Yard power board', assembly(g, [
        (0, 0, 0, 3, 8, 3, g.METAL), (0, 8, 0, 10, 13, 4, g.BODY),
        (0, 19, 0, 12, 2, 6, g.GRIT), (-2, 12, 2, 4, 4, 1, g.CAP),
        (3, 10, 2, 1, 5, 1, g.RUBBER), (0, 7, 0, 7, 2, 4, g.DARK),
    ]), -12.01, -16.3, 3, .25)
    kit.set_palette('Yard power board', primary='#7f8b81', trim='#d1bc91')
    kit.add('Air plant masonry', assembly(g, [
        (0, 0, 0, 35, 4, 4, g.GRIT), (0, 4, 0, 35, 22, 3, g.MASONRY),
        (-8, 14, 1, 14, 9, 2, g.DARK), (-8, 15, 2, 12, 7, 1, g.LIGHT),
        (-8, 15, 2, 1, 7, 2, g.METAL), (-8, 18, 2, 12, 1, 2, g.METAL),
        (0, 26, 0, 36, 2, 5, g.WOOD),
    ]), -17.38, -24.03, 3)
    kit.add('Air plant service opening', assembly(g, [
        (-13, 0, 0, 9, 26, 4, g.MASONRY), (15, 0, 0, 5, 26, 4, g.MASONRY),
        (0, 24, 0, 35, 3, 4, g.GRIT), (0, 27, 0, 36, 1, 5, g.WOOD),
        (-8, 0, 0, 2, 24, 4, g.BODY), (12, 0, 0, 2, 24, 4, g.BODY),
        (2, 22, 0, 20, 2, 3, g.BODY),
    ]), -15.72, -22.4)
    kit.set_palette('Air plant service opening', primary='#77948c', skin='#a29983')
    kit.add('Air plant trench drain', assembly(g, [
        (0, 0, 0, 20, 2, 4, g.DARK),
        *((x, 2, 0, 1, 1, 4, g.METAL) for x in range(-9, 10, 3)),
    ]), -15.5, -22.08, height=-.16)
    kit.add('Air plant bench light', assembly(g, [
        (0, 0, 0, 12, 1, 2, g.LAMP), (0, 1, 0, 15, 2, 4, g.GRIT),
        (0, 2, -2, 6, 2, 3, g.METAL),
    ]), -15.5, -25.4, height=2.13)
    fixtures.append(dict(position=[-15.5, 2.02, -25.16], color='#f2e5bf', intensity=6, distance=3.8))
    kit.place('Air plant masonry', -14.06, -24.03, 1)
    kit.place('Air plant masonry', -15.72, -25.65, 2)
    kit.set_palette('Air plant masonry', skin='#a29c89', visor='#8caaa1', primary='#6b746e')
    kit.add('Air plant roof', assembly(g, [
        *((0, i, 15 - i*5, 38, 2, 5, g.GRIT) for i in range(7)),
        (0, 0, 16, 38, 2, 3, g.METAL),
        *((x, 0, 15 - i*5, 2, i, 5, g.WOOD) for x in (-16, 16) for i in range(1, 7)),
        (0, 0, -16, 34, 1, 2, g.METAL), (0, 1, -16, 34, 5, 1, g.LIGHT),
        *((x, 1, -16, 2, 5, 2, g.WOOD) for x in (-16, -5, 5, 16)),
    ]), -15.72, -24.02, height=2.8)
    kit.set_palette('Air plant roof', primary='#79847d', leather='#7f8275', visor='#a6b5a9')
    kit.add('Air plant roof vent', assembly(g, [
        (0, 0, 0, 9, 3, 9, g.DARK), (0, 3, 0, 6, 12, 6, g.METAL),
        (0, 14, 0, 10, 2, 10, g.GRIT), (0, 16, 0, 6, 1, 6, g.METAL),
    ]), -15.0, -24.45, height=3.35)
    kit.add('Air cooler fan', assembly(g, [
        (0, 0, 0, 12, 12, 3, g.GRIT), (0, 1, 2, 10, 10, 1, g.RUBBER),
        (0, 2, 2, 3, 8, 2, g.METAL), (0, 5, 2, 8, 3, 2, g.METAL),
        (0, 5, 3, 3, 3, 1, g.BODY), (0, 0, 0, 14, 1, 5, g.METAL),
    ]), -15.88, -25.38, height=.67)
    kit.add('Compressor gauge pipes', assembly(g, [
        (-5, 0, 0, 2, 15, 2, g.METAL), (5, 0, 0, 2, 12, 2, g.BODY),
        (0, 12, 0, 11, 2, 2, g.METAL), (-5, 14, 1, 4, 4, 2, g.DARK),
        (-5, 15, 2, 2, 2, 1, g.CAP), (4, 9, 1, 4, 3, 2, g.DETAIL),
    ]), -16.75, -25.36, height=.15)
    kit.add('Air plant nameplate', shop_board(g, 'AIR'), -15.1, -22.18, height=2.36)
    kit.set_palette('Air plant nameplate', primary='#526c68', trim='#e6d5b1')
    kit.add('Shop hose hook', assembly(g, [
        (0, 0, 0, 7, 2, 2, g.RUBBER), (-3, 2, 0, 2, 7, 2, g.RUBBER),
        (3, 2, 0, 2, 7, 2, g.RUBBER), (0, 8, 0, 7, 2, 2, g.RUBBER),
        (0, 8, -1, 4, 3, 3, g.METAL), (4, 0, 1, 2, 2, 2, g.MARK),
    ]), -16.99, -15.0, 1, 1.15)
    kit.add('Motor pool fuse boxes', assembly(g, [
        (-3, 0, 0, 5, 8, 3, g.BODY), (3, 0, 0, 5, 8, 3, g.GRIT),
        (-3, 8, 0, 2, 7, 2, g.METAL), (3, 8, 0, 2, 7, 2, g.METAL),
        (-3, 4, 2, 2, 2, 1, g.CAP), (3, 4, 2, 2, 2, 1, g.CAP),
    ]), -17.02, -12.65, 1, 1.0)


def marshal_station(kit, g, fixtures):
    resculpt(kit, g, 'Training barrier end', assembly(g, [
        (0, 0, 0, 8, 2, 8, g.GRIT), (0, 2, 0, 6, 4, 7, g.PATINA),
        (0, 6, 0, 4, 3, 6, g.MASONRY), (-1, 9, -1, 2, 3, 2, g.METAL),
        (1, 9, 1, 2, 3, 2, g.METAL), (0, 12, 0, 3, 1, 5, g.METAL),
        (2, 5, 1, 2, 2, 3, g.MARK),
    ]))
    resculpt(kit, g, 'Cover block', assembly(g, [
        (0, 0, 0, 13, 2, 11, g.PATINA), (-5, 2, 0, 3, 7, 9, g.MASONRY),
        (5, 2, 0, 3, 7, 9, g.MASONRY), (0, 2, 3, 9, 3, 3, g.WOOD),
        (0, 6, 3, 9, 2, 3, g.WOOD), (0, 2, -3, 10, 3, 3, g.WOOD),
        (0, 6, -3, 10, 2, 3, g.WOOD), (4, 9, 0, 4, 1, 9, g.GRIT),
        (-4, 9, 0, 4, 1, 9, g.GRIT),
    ]))
    resculpt(kit, g, 'Low cover', assembly(g, [
        (-10, 0, 0, 5, 2, 8, g.PATINA), (10, 0, 0, 5, 2, 8, g.PATINA),
        (-10, 2, 0, 4, 6, 5, g.MASONRY), (10, 2, 0, 4, 6, 5, g.MASONRY),
        (0, 2, 0, 21, 2, 4, g.WOOD), (0, 5, 0, 25, 2, 4, g.WOOD),
        (0, 7, 0, 24, 1, 4, g.GRIT), (-10, 5, 2, 2, 1, 1, g.METAL),
        (10, 5, 2, 2, 1, 1, g.METAL),
    ]))
    kit.set_palette('Low cover', leather='#957951', skin='#969488', primary='#8a7561')
    kit.set_palette('Cover block', leather='#87705a', skin='#9b9483')
    kit.set_palette('Training barrier end', skin='#a69d88', primary='#7e8173')
    kit.add('Marshal observation desk', assembly(g, [
        (-8, 0, 0, 2, 6, 4, g.METAL), (8, 0, 0, 2, 6, 4, g.METAL),
        (0, 6, 0, 20, 2, 6, g.WOOD), (-4, 8, 0, 6, 1, 4, g.CAP),
        (4, 8, 0, 5, 3, 4, g.GRIT), (4, 10, 2, 3, 1, 1, g.LIGHT),
        (7, 8, 0, 1, 6, 1, g.METAL),
    ]), 3.05, .75, height=2.75)
    kit.add('Marshal swivel seat', assembly(g, [
        (0, 0, 0, 6, 1, 5, g.DARK), (0, 1, 0, 2, 3, 2, g.METAL),
        (0, 4, 0, 6, 2, 6, g.BODY), (0, 6, -2, 6, 4, 2, g.BODY),
    ]), 2.95, -.22, height=2.75)
    kit.set_palette('Marshal swivel seat', primary='#795f49')
    kit.add('Marshal window lamp', assembly(g, [
        (0, 0, 0, 6, 1, 3, g.LAMP), (0, 1, 0, 8, 2, 4, g.DARK),
        (0, 3, -1, 2, 3, 3, g.METAL),
    ]), 2.6, -.5, height=4.13)
    fixtures.append(dict(position=[2.6, 4.05, -.3], color='#ffe1af', intensity=4, distance=3.0))
    kit.add('Marshal chart rail', assembly(g, [
        (0, 0, 0, 15, 7, 2, g.WOOD), (-3, 1, 1, 6, 5, 1, g.CAP),
        (4, 1, 1, 5, 5, 1, g.LIGHT), (-3, 3, 2, 5, 1, 1, g.DARK),
        (4, 2, 2, 2, 2, 1, g.DETAIL),
    ]), 3.3, -.46, height=3.65)
    kit.add('Marshal stair treads', assembly(g, [
        *((0, i, 8 - 2*i, 11, 1, 2, g.WOOD) for i in range(9)),
        *((x, i-1, 8 - 2*i, 2, 1, 3, g.METAL)
          for x in (-4, 4) for i in range(9)),
    ]), 5.03, 5.3, height=-.05)
    kit.place('Marshal stair treads', 5.03, 3.5, height=.85)
    kit.place('Marshal stair treads', 5.03, 1.7, height=1.75)
    kit.add('Marshal stair landing', assembly(g, [
        (0, 0, 0, 13, 2, 10, g.METAL), (0, 2, 0, 13, 1, 10, g.WOOD),
        (6, 3, -3, 2, 9, 2, g.METAL), (6, 11, 0, 2, 1, 10, g.METAL),
    ]), 4.98, .35, height=2.43)
    kit.add('Marshal stair stringer', assembly(g, [
        (-4, 0, 0, 2, 9, 2, g.METAL), (4, 0, 0, 2, 9, 2, g.METAL),
        (0, 8, 0, 10, 1, 2, g.METAL),
    ]), 5.03, 4.3)
    for z, count in ((2.5, 2), (.7, 3)):
        for step in range(count):
            kit.place('Marshal stair stringer', 5.03, z, height=.9*step)
    kit.add('Marshal stair handrail', assembly(g, [
        *((0, i, 8 - 2*i, 2, 1, 3, g.METAL) for i in range(9)),
        (0, -7, 7, 2, 8, 2, g.DARK), (0, 0, -7, 2, 8, 2, g.DARK),
    ]), 5.55, 5.3, height=.15)
    kit.place('Marshal stair handrail', 5.55, 3.5, height=1.05)
    kit.place('Marshal stair handrail', 5.55, 1.7, height=1.95)
    kit.move('Barrel marker', 3.85, 5.65)
    kit.move('High pillar', 5.8, -4.0)
    kit.move('Flatbed tool cart', 3.45, -1.25, 1)


def parts_room(kit, g, fixtures):
    kit.remove_at('Motor pool solid', -4, -16, height=0)
    kit.add('Parts room connecting door', assembly(g, [
        (-15, 0, 0, 10, 31, 4, g.MASONRY), (15, 0, 0, 10, 31, 4, g.MASONRY),
        (0, 29, 0, 40, 5, 4, g.MASONRY), (-10, 0, 0, 2, 29, 5, g.BODY),
        (10, 0, 0, 2, 29, 5, g.BODY), (0, 25, 0, 20, 2, 5, g.BODY),
        (0, 27, 0, 2, 2, 3, g.METAL), (0, 0, 0, 20, 1, 5, g.GRIT),
    ]), -4, -16, 3)
    kit.set_palette('Parts room connecting door', skin='#a59c88', primary='#637b74')
    move_stock(kit, {
        ('Training board', -4, -15.3): (-2.3, -21.6),
        ('Loaded parts rack', -.6, -16.9): (-2.8, -20.8),
        ('Loaded parts rack', 1.7, -16): (6.4, -20.4),
    })
    kit.add('Parts issue counter', assembly(g, [
        (0, 0, 0, 32, 2, 8, g.GRIT), (0, 2, 0, 30, 7, 7, g.BODY),
        (0, 9, 0, 34, 2, 11, g.WOOD), (-15, 11, -2, 2, 13, 2, g.METAL),
        (15, 11, -2, 2, 13, 2, g.METAL), (0, 22, -2, 32, 2, 3, g.METAL),
        (-10, 11, -2, 1, 11, 2, g.METAL), (-5, 11, -2, 1, 11, 2, g.METAL),
        (-10, 16, -2, 10, 1, 2, g.METAL), (11, 11, -2, 1, 11, 2, g.METAL),
        (-8, 11, 1, 6, 1, 5, g.CAP), (9, 11, -1, 4, 2, 3, g.DETAIL),
    ]), 1.05, -18.42)
    kit.set_palette('Parts issue counter', primary='#71847a', leather='#a28d70', trim='#daccac')
    kit.add('Parts department plate', shop_board(g, 'PARTS'), 1.1, -18.44, height=2.31)
    kit.set_palette('Parts department plate', primary='#56695f', trim='#ddd4b9')
    kit.add('Service stock shelving', assembly(g, [
        *((x, 0, z, 2, 23, 2, g.METAL) for x in (-12, 12) for z in (-3, 3)),
        *((0, y, 0, 26, 1, 8, g.GRIT) for y in (1, 9, 17, 22)),
        (-5, 2, 0, 11, 6, 7, g.BODY), (6, 2, 0, 8, 4, 6, g.WOOD),
        (-7, 10, 0, 6, 5, 6, g.DETAIL), (0, 10, 0, 5, 5, 6, g.DARK),
        (7, 10, 0, 6, 5, 6, g.BODY), (0, 18, 0, 16, 3, 5, g.WOOD),
    ]), 1.12, -21.2)
    kit.set_palette('Service stock shelving', primary='#728373', detail='#996d56',
                    secondary='#576971', leather='#a08b6d')
    kit.add('Gearbox service casting', assembly(g, [
        (0, 0, 0, 20, 2, 5, g.DARK), (-2, 2, 0, 10, 6, 8, g.BODY),
        (-2, 3, 0, 12, 4, 10, g.BODY), (5, 3, 0, 5, 4, 6, g.METAL),
        (8, 4, 0, 4, 2, 3, g.GRIT), (-8, 3, 0, 4, 4, 6, g.METAL),
        *((x, 3, 0, 1, 5, 9, g.METAL) for x in (-6, -3, 0)),
        (-3, 8, 0, 5, 1, 5, g.DARK),
    ]), -1.2, -13.4, height=1.4)
    kit.set_palette('Gearbox service casting', primary='#778786', metal='#aaa99b')
    kit.add('Counter pendant cage', assembly(g, [
        (0, 0, 0, 12, 1, 3, g.LAMP), (0, 1, 0, 14, 2, 5, g.GRIT),
        (-4, 3, 0, 2, 3, 2, g.METAL), (4, 3, 0, 2, 3, 2, g.METAL),
    ]), 1.05, -19.0, height=2.8)
    fixtures.append(dict(position=[1.05, 2.76, -18.88], color='#f1ecd8', intensity=8, distance=4.5))
    kit.add('Air cylinder trolley', assembly(g, [
        (-4, 0, 0, 2, 3, 3, g.RUBBER), (4, 0, 0, 2, 3, 3, g.RUBBER),
        (0, 2, 0, 11, 1, 7, g.METAL), (-4, 3, -2, 2, 14, 2, g.GRIT),
        (4, 3, -2, 2, 14, 2, g.GRIT), (0, 16, -2, 9, 2, 2, g.GRIT),
        (-2, 3, 0, 4, 10, 5, g.BODY), (2, 3, 0, 4, 12, 5, g.DARK),
        (-2, 13, 0, 2, 3, 3, g.METAL), (2, 15, 0, 2, 3, 3, g.METAL),
        (0, 8, 2, 9, 1, 2, g.WOOD),
    ]), -14.78, -24.62)
    kit.set_palette('Air cylinder trolley', primary='#87968b', secondary='#586c74')
    kit.add('Compressor service hatch', assembly(g, [
        (0, 0, 0, 14, 19, 2, g.BODY), (0, 1, 1, 12, 2, 2, g.GRIT),
        *((0, y, 1, 9, 1, 2, g.METAL) for y in (10, 13, 16)),
        (4, 5, 2, 1, 3, 1, g.DARK), (0, 18, 0, 16, 2, 4, g.WOOD),
    ]), -17.0, -22.14, height=.18)
    kit.set_palette('Compressor service hatch', primary='#879184', leather='#7c7365')


def dispatch_deck(g, gate=False):
    parts = [(0, 0, 0, 40, 3, 15, g.DARK), (0, 3, 0, 40, 2, 16, g.WOOD)]
    for x in (-18, -6, 6, 18):
        parts.append((x, 5, 7, 2, 10, 2, g.METAL))
    for y in (9, 15):
        if gate:
            for x in (-14, 14):
                parts.append((x, y, 7, 12, 1, 2, g.METAL))
        else:
            parts.append((0, y, 7, 40, 1, 2, g.METAL))
    return assembly(g, parts)


def hoist(g):
    parts = [(0, 0, 0, 6, 4, 7, g.METAL), (0, 4, 0, 4, 28, 4, g.DARK),
             (0, 31, 8, 5, 3, 22, g.METAL), (0, 28, 16, 3, 3, 4, g.MARK),
             (0, 10, 16, 1, 18, 1, g.DARK), (0, 8, 15, 3, 2, 4, g.METAL)]
    for i in range(4):
        parts.append((0, 21 + 2*i, 2 + 2*i, 2, 4, 4, g.BODY))
    return assembly(g, parts)


def paper_roll(g):
    roll = assembly(g, [
        (0, 0, -4, 14, 1, 4, g.WOOD), (0, 0, 4, 14, 1, 4, g.WOOD),
        (-5, 1, 0, 3, 1, 12, g.WOOD), (5, 1, 0, 3, 1, 12, g.WOOD),
        (0, 2, 0, 14, 12, 4, g.CAP), (0, 3, 0, 14, 10, 8, g.CAP),
        (0, 4, 0, 14, 8, 10, g.CAP), (0, 6, 0, 14, 4, 12, g.CAP),
        (0, 4, 0, 16, 8, 6, g.CAP), (0, 5, 0, 16, 6, 8, g.CAP),
        (0, 6, 0, 14, 4, 4, g.WOOD),
        (0, 2, -5, 10, 1, 2, g.WOOD), (0, 2, 5, 10, 1, 2, g.WOOD),
        (0, 3, -5, 8, 1, 2, g.WOOD), (0, 3, 5, 8, 1, 2, g.WOOD),
        (0, 10, 5, 12, 1, 1, g.LIGHT),
    ])
    end_grain = g.vk.vox('trim', -.12, mottle=False)
    for end in (-8, 7):
        roll.paint(end, (2, 13), (-6, 5), end_grain)
        roll.cut(end, (6, 9), (-2, 1))
    roll.cut((-8, 7), (7, 8), (-1, 0))
    return roll


def cutter(g):
    return assembly(g, [
        (0, 0, 0, 14, 7, 10, g.GRIT), (0, 7, 0, 25, 2, 15, g.METAL),
        (-9, 9, -2, 3, 10, 5, g.BODY), (9, 9, -2, 3, 10, 5, g.BODY),
        (0, 16, -2, 20, 3, 5, g.BODY), (0, 14, -2, 15, 2, 2, g.METAL),
        (1, 9, 2, 13, 3, 10, g.CAP), (9, 10, 4, 3, 2, 3, g.MARK),
    ])


def dispatch_office(kit, g, fixtures):
    deck = 'Dispatch office floor'
    floor_tiles = remove_tiles(kit, 'Print works ceiling', [
        (x, z) for z in (-12, -8) for x in (-2, 2)
    ])
    for i, place in enumerate(floor_tiles):
        x, _, z = place['position']
        if i == 0:
            kit.add(deck, assembly(g, [
                (0, 0, 0, 40, 2, 40, g.CAP), (0, 2, 0, 40, 1, 40, g.WOOD),
                *((x, 2, 0, 1, 1, 40, g.SOIL) for x in (-14, -6, 2, 10, 18)),
                *((x, 2, z, 7, 1, 1, g.SOIL)
                  for x, z in ((-17, -11), (-10, 5), (-2, -3), (6, 10), (14, -9))),
            ]), x, z, height=3.1)
        else:
            kit.place(deck, x, z, height=3.1)
    kit.set_palette(deck, leather='#987e65', trim='#cbc1a9')
    kit.remove_at('Print office upper sash', -2, -14)
    kit.add('Dispatch plaster wall', assembly(g, [
        (0, 0, 0, 40, 29, 3, g.MASONRY), (0, 0, 0, 40, 7, 4, g.WOOD),
        (0, 7, 0, 40, 1, 5, g.GRIT), (0, 27, 0, 40, 2, 5, g.CAP),
        (13, 9, 2, 5, 8, 1, g.PATINA), (11, 9, 2, 4, 3, 1, g.PATINA),
    ]), -2, -14, height=3.4)
    kit.set_palette('Dispatch plaster wall', skin='#b0a594', trim='#c7b8a0')
    kit.add('Dispatch order board', assembly(g, [
        (0, 0, 0, 22, 10, 2, g.WOOD), (0, 1, 1, 19, 8, 1, g.GRIT),
        (-6, 3, 2, 4, 5, 1, g.LIGHT), (0, 2, 2, 5, 5, 1, g.CAP),
        (6, 2, 2, 4, 6, 1, g.LIGHT), (-6, 5, 3, 2, 1, 1, g.DETAIL),
        (0, 4, 3, 3, 1, 1, g.METAL),
    ]), -1.8, -13.69, height=4.8)
    kit.set_palette('Dispatch order board', visor='#eee1b8', trim='#ceb892', primary='#6a7a73')
    kit.add('Shipping balance', assembly(g, [
        (0, 0, 0, 7, 1, 4, g.DARK), (0, 1, 0, 4, 3, 3, g.BODY),
        (-2, 4, 0, 5, 1, 4, g.METAL), (2, 3, 0, 3, 3, 2, g.BODY),
        (2, 4, 1, 2, 2, 1, g.CAP),
    ]), -1.8, -13.1, height=4.4)
    kit.set_palette('Shipping balance', primary='#5e736a', trim='#e0d8bb')
    kit.add('Sorting stool', assembly(g, [
        *((x, 0, z, 2, 5, 2, g.WOOD) for x in (-2, 2) for z in (-2, 2)),
        (0, 5, 0, 7, 2, 7, g.BODY),
    ]), -1.7, -12.35, height=3.4)
    kit.add('Ledger cupboard', assembly(g, [
        (0, 0, 0, 16, 20, 7, g.WOOD), (0, 19, 0, 18, 2, 9, g.GRIT),
        *((x, 2, 4, 6, 14, 1, g.BODY) for x in (-4, 4)),
        (-2, 8, 5, 1, 3, 1, g.CAP), (2, 8, 5, 1, 3, 1, g.CAP),
        (-4, 15, 5, 4, 2, 1, g.LIGHT), (4, 15, 5, 4, 2, 1, g.LIGHT),
    ]), 1.1, -13.45, height=3.4)
    kit.set_palette('Ledger cupboard', primary='#6a7975', visor='#ded1aa')
    kit.add('Dispatch wall lamp', assembly(g, [
        (0, 0, 2, 7, 1, 5, g.LAMP), (0, 1, 2, 9, 2, 6, g.DARK),
        (0, 3, -1, 2, 2, 7, g.METAL), (0, 2, -4, 3, 4, 2, g.METAL),
    ]), -2.7, -13.55, height=5.64)
    fixtures.append(dict(position=[-2.7, 5.55, -13.4], color='#ffe6bd', intensity=8, distance=5))


def waste_paper_store(kit, g):
    # The raised gallery overlooks the yard where the bindery sells its offcuts.
    kit.add('Rag store loading bay', assembly(g, [
        (-15, 0, 0, 9, 33, 4, g.PATINA), (15, 0, 0, 9, 33, 4, g.PATINA),
        (0, 29, 0, 40, 5, 4, g.PATINA), (0, 24, 0, 23, 5, 4, g.GRIT),
        (0, 33, 0, 40, 2, 5, g.WOOD),
        (-17, 2, 2, 4, 8, 1, g.MASONRY), (16, 7, 2, 7, 3, 1, g.MASONRY),
    ]), -16.2, -11.8, 1)
    kit.add('Rag store masonry return', assembly(g, [
        (0, 0, 0, 40, 34, 3, g.PATINA), (0, 0, 0, 40, 4, 4, g.GRIT),
        (0, 32, 0, 40, 3, 4, g.WOOD), (6, 9, 2, 15, 10, 1, g.MASONRY),
        (-9, 3, 2, 8, 5, 1, g.MASONRY),
    ]), -17.95, -9.85)
    kit.place('Rag store masonry return', -17.95, -17.75, 2)
    kit.place('Rag store masonry return', -16.2, -15.75, 1)
    kit.place('Rag store masonry return', -19.65, -11.8, 3)
    kit.place('Rag store masonry return', -19.65, -15.75, 3)
    kit.add('Rag store high sash', assembly(g, [
        (0, 0, 0, 40, 2, 4, g.WOOD), (0, 2, 0, 39, 8, 2, g.LIGHT),
        *((x, 2, 0, 2, 8, 3, g.DARK) for x in (-19, -9, 0, 10, 18)),
        (0, 9, 0, 40, 2, 4, g.WOOD),
    ]), -16.2, -11.8, 1, 3.5)
    kit.place('Rag store high sash', -16.2, -15.75, 1, 3.5)
    kit.add('Rag store roof', assembly(g, [
        *((0, 6 - i, 16 - 5*i, 40, 2, 5, g.GRIT) for i in range(7)),
        (-19, 0, 0, 2, 2, 36, g.METAL), (19, 0, 0, 2, 2, 36, g.METAL),
    ]), -17.9, -11.8, 1, 4.05)
    kit.place('Rag store roof', -17.9, -15.75, 1, 4.05)
    kit.add('Offcut bale', assembly(g, [
        (0, 0, 0, 13, 3, 10, g.CAP), (0, 3, 0, 14, 4, 10, g.LIGHT),
        (-1, 7, 0, 13, 3, 10, g.CAP), (0, 10, 0, 12, 2, 10, g.LIGHT),
        (-4, 0, 0, 1, 12, 11, g.METAL), (4, 0, 0, 1, 12, 11, g.METAL),
    ]), -16.8, -12.25)
    kit.place('Offcut bale', -16.95, -12.15, height=1.2)
    kit.place('Offcut bale', -16.85, -10.95, 2)
    kit.set_palette('Offcut bale', trim='#bcb19c', visor='#d7cdb7')
    for label in ('Rag store loading bay', 'Rag store masonry return'):
        kit.set_palette(label, skin='#9c9180', primary='#6b7068', leather='#6b634f')
    kit.set_palette('Rag store high sash', visor='#8ba49d')
    kit.set_palette('Rag store roof', primary='#63756d')


def print_works(kit, g, fixtures):
    move_stock(kit, {
        ('Crated salvage', 2.9, -13.5): (1.7, -11.6),
    })
    kit.add('Alley delivery steps', assembly(g, [
        (-7, 0, 0, 7, 3, 18, g.PATINA), (0, 0, 0, 7, 2, 18, g.MASONRY),
        (7, 0, 0, 7, 1, 18, g.PATINA),
    ]), -9.5, -4.3)
    kit.add('Dispatch gallery', dispatch_deck(g), -5.1, -12.3, 3, 2.75)
    kit.add('Dispatch stair gallery', dispatch_deck(g, gate=True), -5.1, -8.3, 3, 2.75)
    kit.add('Dispatch stair landing', assembly(g, [
        (0, 0, 0, 32, 2, 17, g.METAL), (0, 2, 0, 32, 2, 17, g.WOOD),
        *((x, 4, -7, 2, 10, 2, g.METAL) for x in (-15, 0, 15)),
        (0, 12, -7, 32, 2, 2, g.METAL),
    ]), -6.7, -8.3, height=2.85)
    kit.add('Dispatch stair flight', assembly(g, [
        *((0, i, 11 - 3*i, 14, 1, 3, g.WOOD) for i in range(8)),
        *((x, i - 1, 11 - 3*i, 2, 1, 4, g.METAL)
          for x in (-6, 6) for i in range(8)),
    ]), -7.55, 0.85, height=-0.1)
    for i in range(1, 4):
        kit.place('Dispatch stair flight', -7.55, 0.85 - 2.4*i, height=-0.1 + 0.8*i)
    kit.add('Dispatch stair trestle', assembly(g, [
        (-6, 0, 0, 2, 8, 3, g.DARK), (6, 0, 0, 2, 8, 3, g.DARK),
        (0, 7, 0, 14, 1, 3, g.METAL),
    ]), -7.55, -0.3)
    for section in (2, 3, 4):
        for tier in range(section):
            kit.place('Dispatch stair trestle', -7.55, 2.1 - 2.4*section, height=0.8*tier)
    kit.add('Dispatch stair handrail', assembly(g, [
        *((0, i, 11 - i*3, 1, 2, 4, g.METAL) for i in range(8)),
        (0, -8, 10, 3, 9, 3, g.DARK), (0, -2, -8, 3, 10, 3, g.DARK),
    ]), -8.26, 0.85, height=0.15)
    for i in range(1, 4):
        kit.place('Dispatch stair handrail', -8.26, 0.85 - 2.4*i, height=0.15 + 0.8*i)
    kit.add('Gallery door sill', assembly(g, [
        (0, 0, 0, 18, 2, 12, g.METAL),
        (0, 2, -3, 18, 1, 5, g.METAL),
    ]), -4.2, -12, 3, 3.1)
    kit.add('Gallery delivery hoist', hoist(g), -5.25, -10.0, 3, 3.25)
    kit.add('Loading platform corbel', assembly(g, [
        (0, 0, 0, 4, 13, 3, g.METAL), (0, 11, 6, 4, 2, 15, g.DARK),
        (0, 3, 2, 3, 4, 4, g.DARK), (0, 6, 5, 3, 4, 4, g.DARK),
        (0, 9, 8, 3, 3, 4, g.DARK),
    ]), -4.9, -7, 3, 1.5)
    for z in (-9.7, -12.8):
        kit.place('Loading platform corbel', -4.9, z, 3, 1.5)
    kit.remove_at('Print office upper sash', -4, -12)
    kit.add('Dispatch office doorway', g.panel(40, 29, 3, g.BODY, g.PATINA, opening=18),
            -4, -12, 3, 3.4)
    kit.add('Gallery freight door', sliding_leaf(g), -4.23, -13.45, 3, 3.4)
    kit.add('Dispatch sorting desk', assembly(g, [
        (-8, 0, 0, 3, 8, 8, g.WOOD), (8, 0, 0, 3, 8, 8, g.WOOD),
        (0, 8, 0, 21, 2, 10, g.WOOD), (-3, 10, 0, 9, 1, 6, g.LIGHT),
        (6, 10, 0, 4, 1, 4, g.DARK), (7, 11, 0, 1, 7, 1, g.METAL),
        (5, 17, 0, 5, 2, 3, g.GRIT),
    ]), -1.15, -13.25, height=3.4)
    kit.add('Dispatch docket pigeonholes', assembly(g, [
        (0, 0, -3, 17, 16, 2, g.WOOD),
        *((0, y, 0, 17, 1, 7, g.WOOD) for y in (0, 5, 10, 15)),
        *((x, 0, 0, 1, 15, 7, g.GRIT) for x in (-8, 0, 8)),
        (-4, 6, 1, 5, 2, 5, g.LIGHT), (4, 1, 1, 5, 3, 5, g.CAP),
    ]), -1.7, -9.85, height=3.4)
    kit.add('Dispatch roof lantern', assembly(g, [
        (0, 0, 0, 35, 3, 19, g.GRIT), (0, 3, 0, 31, 9, 15, g.LIGHT),
        (0, 12, 0, 35, 2, 19, g.METAL), (0, 14, 0, 35, 2, 13, g.DARK),
        (0, 16, 0, 35, 2, 7, g.DARK), (0, 18, 0, 35, 1, 3, g.METAL),
        *((x, 3, 0, 2, 9, 17, g.METAL) for x in (-15,-5,5,15)),
    ]), 0, -10.5, height=6.6)
    kit.add('Paper roll cradle', paper_roll(g), -7.1, -10.6, 1)
    kit.place('Paper roll cradle', -7.1, -12.2, 1)
    kit.place('Paper roll cradle', -2.8, -16.0, 1)
    kit.add('Bindery paper cutter', cutter(g), -1.4, -14.4, 1)
    kit.add('Composing type cabinet', assembly(g, [
        (0, 0, 0, 19, 11, 8, g.WOOD), (0, 11, 0, 21, 2, 10, g.DARK),
        *((x,y,4,7,1,1,g.METAL) for x in (-5,5) for y in (3,6,9)),
        (-4,13,0,9,1,6,g.CAP), (6,13,0,4,2,4,g.DETAIL),
    ]), 2.6, -13.2, 3)
    kit.add('Printed sheet drying rack', assembly(g, [
        *((x,0,z,2,18,2,g.DARK) for x in (-7,7) for z in (-4,4)),
        *((0,y,0,15,1,9,g.WOOD) for y in (2,9,17)),
        *((1,y,0,11,1,7,g.CAP) for y in (3,10,18)),
    ]), 2.7, -15.1, 3)
    kit.add('Book lift tower', assembly(g, [
        (0, 0, 0, 24, 29, 22, g.BODY), (0, 0, 0, 26, 3, 24, g.PATINA),
        (0, 25, 0, 26, 3, 24, g.WOOD), (0, 28, 0, 25, 2, 23, g.MASONRY),
        *((x, 5, 11, 7, 16, 2, g.DARK) for x in (-5, 5)),
        *((x, 7, 12, 5, 12, 1, g.LIGHT) for x in (-5, 5)),
        (0, 13, 12, 20, 1, 2, g.WOOD),
    ]), 3.8, -7.7, height=5.85)
    kit.add('Book lift hip roof', assembly(g, [
        (0, 0, 0, 31, 2, 29, g.DARK),
        *((0, 2 + 2*i, 0, 27 - 4*i, 2, 25 - 4*i, g.GRIT) for i in range(6)),
        (0, 14, 0, 4, 4, 4, g.METAL),
    ]), 3.8, -7.7, height=8.85)
    kit.add('Book lift masonry shaft', assembly(g, [
        (0, 0, 0, 24, 55, 22, g.BODY), (0, 0, 0, 26, 4, 24, g.PATINA),
        *((0, y, 0, 26, 2, 24, g.MASONRY) for y in (25, 53)),
        (0, 3, 11, 16, 18, 2, g.DARK), (0, 4, 12, 14, 15, 1, g.METAL),
        (0, 31, 11, 14, 15, 2, g.GRIT), (0, 33, 12, 11, 10, 1, g.LIGHT),
        (0, 33, 13, 1, 10, 1, g.WOOD),
    ]), 3.8, -7.7, height=0.35)
    kit.add('Folded proof signature', assembly(g, [
        (0, 0, 0, 10, 1, 7, g.LIGHT), (-2, 1, 0, 4, 1, 4, g.DARK),
        (2, 1, 1, 2, 1, 2, g.DETAIL), (2, 1, -2, 2, 1, 1, g.MARK),
    ]), -1.2, -14.5, 1, 1.2)
    kit.place('Folded proof signature', 2.7, -15.1, 3, 1.9)
    kit.add('Ink fountain trolley', assembly(g, [
        (0, 1, 0, 13, 1, 8, g.METAL), (0, 8, 0, 13, 1, 8, g.METAL),
        *((x, 0, 0, 2, 9, 6, g.DARK) for x in (-5, 5)),
        (-3, 9, 0, 4, 4, 4, g.DETAIL), (3, 9, 0, 4, 4, 4, g.RUBBER),
        (-3, 13, 0, 4, 1, 4, g.METAL), (3, 13, 0, 4, 1, 4, g.METAL),
    ]), -1.7, -16.75)
    kit.add('Bindery shop window', assembly(g, [
        (0, 0, 0, 34, 7, 4, g.GRIT), (0, 7, 0, 34, 2, 6, g.WOOD),
        *((x, 9, 0, 2, 15, 3, g.WOOD) for x in (-16, -6, 5, 16)),
        (0, 20, 0, 34, 1, 3, g.WOOD), (0, 24, 0, 34, 4, 5, g.BODY),
        (-10, 9, 0, 7, 3, 2, g.LIGHT), (1, 9, 0, 7, 5, 2, g.CAP),
        (11, 9, 0, 5, 7, 2, g.DETAIL),
    ]), -4.2, 5.85)
    kit.place('Bindery shop window', -2.6, 4.1, 1)
    kit.add('Bindery striped awning', assembly(g, [
        (0, 0, 6, 36, 3, 2, g.GRIT),
        *((x, step, 6 - step*3, 6, 2, 3, g.CAP if i % 2 else g.BODY)
          for i, x in enumerate((-15,-9,-3,3,9,15)) for step in range(4)),
    ]), -4.2, 6.25, height=2.5)
    kit.place('Bindery striped awning', -2.2, 4.1, 1, 2.5)
    kit.add('Bindery shop roof', g.roof(35,36,g.DARK), -4.2, 4.1, height=2.8)
    kit.add('Bound book counter', assembly(g, [
        (0, 0, 0, 17, 8, 7, g.WOOD), (0, 8, 0, 19, 2, 9, g.GRIT),
        *((x, 10, 0, 2, h, 4, c) for x,h,c in
          ((-6, 5, g.DETAIL),(-4, 5, g.CAP),(-1, 6, g.BODY),(2, 4, g.LIGHT),(5, 5, g.DARK))),
    ]), -4.2, 5.25)
    kit.add('Dispatch trolley track', assembly(g, [
        (-8, -1, 0, 2, 2, 36, g.METAL), (8, -1, 0, 2, 2, 36, g.METAL),
        *((0, 0, z, 14, 1, 2, g.WOOD) for z in (-14, -5, 4, 13)),
    ]), -0.8, 5.4, height=-0.08)
    for z in (1.8, -1.8):
        kit.place('Dispatch trolley track', -0.8, z, height=-0.08)
    kit.add('Hand freight trolley', assembly(g, [
        *((x, 0, z, 2, 3, 3, g.DARK) for x in (-8,8) for z in (-6,6)),
        *((0, 1, z, 17, 2, 2, g.METAL) for z in (-6,6)),
        (0, 3, 0, 18, 2, 20, g.BODY), (0, 5, 0, 16, 1, 18, g.WOOD),
        *((x, 5, z, 2, 8, 2, g.BODY) for x in (-8,8) for z in (-7,7)),
        (-8, 11, 0, 2, 2, 16, g.BODY), (8, 11, 0, 2, 2, 16, g.BODY),
        (0, 6, 1, 13, 2, 13, g.METAL), (0, 8, 1, 13, 1, 13, g.WOOD),
        (0, 9, 1, 13, 1, 13, g.CAP), (-2, 10, 1, 5, 1, 8, g.GRIT),
        (3, 10, -1, 2, 1, 4, g.GRIT), (3, 10, 3, 2, 1, 2, g.GRIT),
    ]), -0.8, 2.65, height=.12)
    kit.add('Plate siding buffer', assembly(g, [
        *((x, 0, 0, 4, 2, 9, g.GRIT) for x in (-8,8)),
        *((x, 2, 0, 3, 5, 4, g.METAL) for x in (-8,8)),
        (0, 5, 0, 21, 3, 4, g.WOOD),
        *((x, 5, -2, 4, 3, 2, g.RUBBER) for x in (-8,8)),
        *((x, 2, 3, 1, 1, 1, g.METAL) for x in (-9,7)),
    ]), -0.8, 7.05)
    kit.set_palette('Plate siding buffer', leather='#9a8065', metal='#798883')
    fixtures.append(dict(position=[-5.3, 3.95, -10.5], color='#ffdcad', intensity=9, distance=6))


def print_cylinders(g):
    shape = assembly(g, [
        (0, 0, 0, 27, 2, 14, g.DARK), (0, 2, 0, 24, 4, 11, g.BODY),
        (0, 6, -5, 24, 7, 3, g.BODY), (0, 5, 5, 25, 3, 2, g.METAL),
        (-11, 7, 5, 4, 5, 3, g.BODY), (0, 7, 5, 4, 4, 3, g.BODY),
        (10, 7, 5, 4, 6, 3, g.BODY),
        (-12, 8, 0, 5, 2, 13, g.METAL), (12, 8, 0, 5, 2, 13, g.METAL),
    ])
    for x, y, color in ((-6, 8, g.RUBBER), (3, 7, g.METAL)):
        g.box(4, 6, 10, color, x=x, y=y, sculpt=shape)
        g.box(6, 4, 10, color, x=x, y=y+1, sculpt=shape)
        if x == -6:
            g.box(3, 3, 13, g.METAL, x=x, y=y+2, sculpt=shape)
    return shape


def press_line(kit, g, fixtures):
    resculpt(kit, g, 'Rotary offset press', print_cylinders(g))
    kit.move('Rotary offset press', 0.05, -11.2)
    kit.set_palette('Rotary offset press', primary='#476e68', secondary='#45525a', metal='#abb2aa')
    move_stock(kit, {
        ('Crated salvage', 1.7, -11.6): (1.1, -8.15),
        ('Stacked salvage rack', .1, -12.2): (-6.5, -18.5),
    })
    kit.add('Reel feed stand', assembly(g, [
        (0, 0, 0, 18, 2, 15, g.DARK),
        (-4, 2, -6, 4, 8, 3, g.BODY), (-4, 2, 6, 4, 8, 3, g.BODY),
        (-4, 5, 0, 7, 10, 10, g.CAP), (-4, 6, 0, 9, 8, 10, g.CAP),
        (-4, 8, 0, 11, 4, 10, g.CAP), (-4, 9, 0, 3, 3, 15, g.WOOD),
        (3, 10, 0, 5, 1, 9, g.LIGHT), (7, 9, 0, 5, 1, 9, g.LIGHT),
        (5, 7, 0, 3, 2, 12, g.METAL),
    ]), -2.31, -11.2)
    kit.set_palette('Reel feed stand', primary='#51766c', trim='#dfd7c2', visor='#ece5cf')
    kit.add('Press delivery belt', assembly(g, [
        (-7, 0, 0, 3, 6, 10, g.BODY), (7, 0, 0, 3, 6, 10, g.BODY),
        (0, 6, 0, 22, 2, 13, g.GRIT), (0, 8, 0, 22, 1, 10, g.RUBBER),
        *((x, 9, 0, 2, 1, 11, g.METAL) for x in (-8, -3, 2, 7)),
        (-4, 10, 0, 9, 1, 8, g.LIGHT), (-4, 11, 0, 5, 1, 5, g.DARK),
        (6, 10, 0, 4, 1, 8, g.LIGHT), (6, 11, -1, 2, 1, 3, g.DETAIL),
    ]), 2.56, -11.2)
    kit.set_palette('Press delivery belt', primary='#54776d', visor='#e4e0c7', detail='#b0604b')
    kit.add('Press ink fountain', assembly(g, [
        (0, 0, 0, 12, 2, 6, g.DARK), (-5, 2, 0, 2, 5, 5, g.BODY),
        (5, 2, 0, 2, 5, 5, g.BODY), (0, 3, 0, 8, 3, 4, g.GRIT),
        (0, 6, 0, 8, 1, 3, g.DETAIL), (0, 7, -2, 12, 2, 2, g.METAL),
     ]), 0.05, -11.74, height=1.2)
    kit.set_palette('Press ink fountain', primary='#53736d', detail='#5a6e88')
    kit.add('Press side guard', assembly(g, [
        (0, 0, 0, 20, 2, 2, g.BODY), (-9, 2, 0, 2, 5, 2, g.METAL),
        (9, 2, 0, 2, 5, 2, g.METAL), (0, 7, 0, 20, 2, 2, g.BODY),
        (0, 2, 0, 2, 5, 2, g.METAL), (-5, 3, 0, 5, 3, 1, g.MARK),
    ]), .05, -10.52, height=.41)
    kit.set_palette('Press side guard', primary='#67847b', accent='#d7ac65')
    kit.add('Press cylinder paper web', assembly(g, [
        (-10, 1, 0, 5, 1, 6, g.LIGHT), (-6, 4, 0, 4, 1, 6, g.LIGHT),
        (-8, 2, 0, 2, 2, 6, g.LIGHT), (-3, 3, 0, 3, 1, 6, g.LIGHT),
        (0, 2, 0, 4, 1, 6, g.LIGHT), (4, 3, 0, 5, 1, 6, g.LIGHT),
        (8, 1, 0, 4, 1, 6, g.LIGHT), (6, 2, 0, 2, 1, 6, g.LIGHT),
        (8, 2, 0, 3, 1, 3, g.DARK), (4, 4, -1, 3, 1, 2, g.GRIT),
    ]), 0.05, -11.2, height=1.01)
    kit.set_palette('Press cylinder paper web', visor='#e5dfc8', primary='#4e626d')
    flywheel = assembly(g, [
        (0, 0, 0, 6, 10, 2, g.DARK), (0, 1, 0, 8, 8, 2, g.DARK),
        (0, 2, 0, 10, 6, 2, g.DARK),
    ])
    flywheel.cut((-2, 1), (2, 7), (-2, 2))
    flywheel.cut((-3, 2), (3, 6), (-2, 2))
    g.box(2, 8, 2, g.BODY, y=1, sculpt=flywheel)
    g.box(8, 2, 2, g.BODY, y=4, sculpt=flywheel)
    g.box(3, 3, 3, g.METAL, y=4, z=1, sculpt=flywheel)
    kit.add('Press drive flywheel', flywheel, -.55, -10.45, height=.6)
    kit.set_palette('Press drive flywheel', primary='#67908a', secondary='#343c40')
    kit.add('Press gauge panel', assembly(g, [
        (0, 0, 0, 7, 2, 5, g.DARK), (0, 2, 0, 3, 8, 3, g.METAL),
        (0, 10, 0, 8, 6, 4, g.BODY), (-2, 12, 2, 3, 3, 1, g.CAP),
        (2, 13, 2, 2, 1, 1, g.MARK), (2, 11, 2, 2, 1, 1, g.DETAIL),
    ]), 1.36, -10.35)
    kit.set_palette('Press gauge panel', primary='#5b726e', trim='#d5cfb5')
    kit.add('Bindery delivery bundles', assembly(g, [
        (0, 0, 0, 17, 2, 12, g.WOOD), (-4, 2, 0, 7, 5, 10, g.CAP),
        (4, 2, 0, 8, 7, 10, g.LIGHT), (-4, 2, 0, 2, 5, 11, g.SOIL),
        (4, 2, 0, 2, 7, 11, g.SOIL), (-4, 7, -1, 6, 1, 5, g.LIGHT),
        (5, 9, -1, 5, 1, 6, g.DARK), (5, 10, -2, 3, 1, 2, g.DETAIL),
    ]), 2.9, -9.95)
    kit.set_palette('Bindery delivery bundles', trim='#d2c6ae', visor='#e3dfc6')
    kit.set_palette('Print works floor', primary='#7f7569', secondary='#6b655b',
                    skin='#aaa69a', metal='#969791')
    kit.set_palette('Print works window', primary='#916e56', skin='#b5a997')
    kit.add('Press inspection lamp', assembly(g, [
        (0, 0, 0, 17, 1, 4, g.LAMP), (0, 1, 0, 20, 2, 5, g.METAL),
        (-7, 3, 0, 2, 5, 2, g.DARK), (7, 3, 0, 2, 5, 2, g.DARK),
    ]), 0.05, -11.25, height=2.3)
    fixtures.append(dict(position=[0.05, 2.25, -11.25], color='#f4ebd8', intensity=6, distance=4))


def shop_board(g, word):
    from level_districts import LETTERS

    width = sum(len(LETTERS[c][0]) + 1 for c in word) + 2
    shape = assembly(g, [(0, 0, 0, width, 8, 2, g.BODY)])
    x = -width//2 + 2
    for letter in word:
        for row, line in enumerate(LETTERS[letter]):
            for column, mark in enumerate(line):
                if mark == '1':
                    g.box(1, 1, 1, g.CAP, x=x + column, y=6-row, z=1, sculpt=shape)
        x += len(LETTERS[letter][0]) + 1
    return shape


def loading_street(kit, g):
    kit.move('Concrete jersey', 3.0, 2.35, 1)
    kit.set_palette('Concrete jersey', skin='#a49a83', accent='#ba9e70')
    kit.set_palette('Road trench plate', accent='#a99870', metal='#788584')
    kit.move('Vault slab', 1.02, -1.55, 1)
    kit.set_palette('Vault frame', skin='#969a8c', metal='#697e78')
    kit.set_palette('Vault slab', secondary='#4a5a58', metal='#8c9a91')
    kit.add('Secure plate rack', assembly(g, [
        *((x, 0, z, 2, 18, 2, g.GRIT) for x in (-8, 8) for z in (-4, 3)),
        *((0, y, 0, 17, 1, 8, g.METAL) for y in (1, 9, 18)),
        *((x, 2, 0, 1, h, 6, g.CAP) for x, h in ((-6,6),(-3,5),(0,6),(3,5),(6,6))),
        (0, 10, -1, 12, 2, 6, g.DARK),
    ]), -.12, -2.85)
    kit.set_palette('Secure plate rack', trim='#b8b4a1', primary='#556c65')
    kit.add('Plate store sign', shop_board(g, 'PLATES'), 0, -.04, height=2.48)
    kit.set_palette('Plate store sign', primary='#687768', trim='#e0ceb0')
    kit.add('Plate store bell', assembly(g, [
        (0, 0, 0, 3, 5, 2, g.BODY), (0, 2, 1, 2, 2, 2, g.CAP),
    ]), -1.28, -.04, height=1.15)
    kit.add('Parcel office hatch', assembly(g, [
        (0, 0, 0, 22, 7, 4, g.GRIT), (-10, 7, 0, 2, 12, 4, g.WOOD),
        (10, 7, 0, 2, 12, 4, g.WOOD), (0, 19, 0, 22, 3, 5, g.BODY),
        (0, 7, 1, 23, 2, 7, g.CAP), (0, 15, 0, 18, 1, 3, g.METAL),
        (0, 15, 0, 2, 4, 3, g.METAL), (5, 9, 1, 6, 3, 3, g.CAP),
    ]), 4.5, .58, height=.8)
    kit.set_palette('Parcel office hatch', primary='#496d69', trim='#bbac91')
    kit.add('Parcel shed side', assembly(g, [
        (0, 0, 0, 23, 20, 3, g.BODY), (0, 0, 0, 23, 4, 4, g.GRIT),
        (-10, 0, 0, 3, 20, 4, g.WOOD), (10, 0, 0, 3, 20, 4, g.WOOD),
        (-3, 7, 2, 8, 8, 1, g.CAP), (-3, 11, 3, 5, 2, 1, g.DETAIL),
    ]), 5.56, -.42, 1, .8)
    kit.set_palette('Parcel shed side', primary='#769084', trim='#d3c1a1')
    kit.add('Parcel shed felt roof', assembly(g, [
        (0, 0, 0, 25, 2, 24, g.DARK), (0, 2, -4, 25, 1, 16, g.GRIT),
        (-11, -1, 0, 2, 2, 24, g.WOOD), (11, -1, 0, 2, 2, 24, g.WOOD),
    ]), 4.5, -.4, height=2.95)
    kit.place('Bindery delivery bundles', 4.35, 1.6, height=.8)
    kit.add('Street sack barrow', assembly(g, [
        (-4, 0, 0, 2, 4, 4, g.RUBBER), (4, 0, 0, 2, 4, 4, g.RUBBER),
        (0, 2, 0, 10, 1, 6, g.METAL), (-3, 3, -2, 2, 10, 2, g.BODY),
        (3, 3, -2, 2, 10, 2, g.BODY), (0, 11, -2, 8, 2, 2, g.WOOD),
        (0, 3, 0, 8, 6, 5, g.CAP), (0, 9, 0, 7, 2, 5, g.WOOD),
    ]), 3.1, 4.7, 3)
    kit.set_palette('Street sack barrow', primary='#657873', trim='#cbbc94')
    kit.add('Parcel curbside post', assembly(g, [
        (0, 0, 0, 5, 2, 5, g.PATINA), (0, 2, 0, 3, 9, 3, g.DARK),
        (0, 11, 0, 4, 2, 4, g.CAP), (0, 13, 0, 3, 1, 3, g.DARK),
    ]), 3.05, 3.55)
    kit.place('Parcel curbside post', 3.05, 1.25)
    kit.add('Parcel counter sign', shop_board(g, 'POST'), 4.5, .91, height=2.56)
    kit.set_palette('Parcel counter sign', primary='#486b65', trim='#e9d4a3')
    kit.add('Bindery street sign', shop_board(g, 'BIND'), -4.2, 6.72, height=2.45)
    kit.set_palette('Bindery street sign', primary='#536c60', trim='#e3cb95')
    kit.add('News bundle bin', assembly(g, [
        (0, 0, 0, 12, 2, 10, g.DARK), (0, 2, -4, 12, 12, 2, g.BODY),
        (-5, 2, 0, 2, 9, 10, g.BODY), (5, 2, 0, 2, 9, 10, g.BODY),
        (0, 2, 3, 9, 6, 2, g.BODY), (0, 4, 0, 8, 5, 6, g.CAP),
        (-2, 9, 0, 3, 1, 5, g.DARK), (2, 9, 0, 2, 1, 4, g.LIGHT),
    ]), -2.85, 6.75, 1)
    kit.set_palette('News bundle bin', primary='#7e8b76', trim='#d9ccb3', visor='#b29e77')
    kit.add('Service street gutter', assembly(g, [
        (0, 0, 0, 5, 2, 36, g.GRIT), (0, 1, -2, 3, 1, 17, g.DARK),
        (1, 1, 10, 2, 1, 6, g.METAL),
    ]), -2.25, 3.95, height=-.17)
    kit.place('Service street gutter', -2.25, .35, 2, -.17)
    kit.set_palette('Service street gutter', primary='#7a7970', secondary='#5c625d')
    kit.add('Bindery return crates', assembly(g, [
        (-3, 0, 0, 9, 7, 7, g.WOOD), (5, 0, 0, 6, 5, 7, g.SOIL),
        (-3, 7, 0, 8, 6, 6, g.SOIL),
        *((-3, y, 3, 9, 1, 1, g.CAP) for y in (1, 5, 8, 11)),
        (5, 4, 3, 7, 1, 1, g.CAP),
    ]), 5.3, 1.65, height=.8)
    kit.set_palette('Bindery return crates', leather='#947a5a', trim='#bba07a')
    kit.set_palette('Upper brick windows', primary='#957557', skin='#b2a58e')
    kit.set_palette('Brick facade', skin='#9d8e78', primary='#8c775f')
    kit.set_palette('Alley wall return', primary='#847d6b', skin='#999683')
    kit.set_palette('Loading canopy', secondary='#576a68')
    kit.set_palette('Timber loading dock', leather='#8b795e')


def ink_store(kit, g, fixtures):
    # A glazed service opening keeps the color bench in view from the cutting room.
    kit.remove_at('Print works door', -4, -16, height=0)
    kit.add('Ink store glazed partition', assembly(g, [
        (-11, 0, 0, 18, 9, 4, g.BODY), (-11, 9, 0, 19, 2, 5, g.WOOD),
        (-19, 11, 0, 2, 18, 3, g.METAL), (-3, 11, 0, 2, 18, 3, g.METAL),
        (-11, 11, 0, 1, 16, 2, g.METAL), (-11, 21, 0, 16, 1, 3, g.METAL),
        (-15, 23, 0, 6, 5, 1, g.LIGHT), (-7, 23, 0, 7, 5, 1, g.LIGHT),
        (0, 28, 0, 40, 3, 4, g.WOOD), (19, 0, 0, 2, 28, 4, g.WOOD),
        (8, 23, 0, 18, 2, 4, g.METAL), (8, 25, 0, 1, 3, 2, g.METAL),
    ]), -4, -16, 1)
    kit.set_palette('Ink store glazed partition', primary='#6e837b', visor='#a8bcb0',
                    leather='#8c7966', metal='#6c7771')
    move_stock(kit, {
        ('Stacked salvage rack', -5.6, -18.6): (-5.1, -21.0),
        ('Stacked salvage rack', -6.5, -18.5): (-2.05, -21.0),
        ('Stacked salvage rack', -7.4, -17.2): (-17.2, -15.8),
        ('Crated salvage', -7.6, -16.1): (-5.1, -19.55),
        ('Crated salvage', -7, -15): (-6.8, -14.85),
    })
    kit.add('Ink mixing bench', assembly(g, [
        (-10, 0, 0, 3, 8, 7, g.WOOD), (10, 0, 0, 3, 8, 7, g.WOOD),
        (0, 2, -1, 20, 1, 7, g.WOOD), (0, 8, 0, 24, 2, 10, g.GRIT),
        (0, 10, -4, 24, 4, 2, g.METAL), (-4, 10, 0, 10, 1, 6, g.METAL),
        (5, 10, 0, 6, 1, 6, g.METAL),
        (-5, 3, 0, 6, 4, 5, g.CAP), (4, 3, 0, 6, 3, 5, g.DETAIL),
    ]), -7.36, -16.25, 1)
    kit.set_palette('Ink mixing bench', primary='#75837c', leather='#8d7a63',
                    trim='#b9996c', detail='#88574c')
    kit.add('Bench pigment mixer', assembly(g, [
        (0, 0, 0, 8, 2, 7, g.GRIT), (-3, 2, -2, 3, 11, 3, g.BODY),
        (-1, 11, -1, 6, 3, 5, g.BODY), (2, 13, -1, 5, 3, 5, g.DARK),
        (2, 8, 1, 1, 5, 1, g.METAL), (2, 2, 1, 5, 4, 4, g.METAL),
        (2, 2, 1, 3, 4, 6, g.METAL), (2, 6, 1, 4, 1, 4, g.DETAIL),
        (2, 7, 1, 1, 1, 1, g.METAL), (-3, 6, 0, 2, 2, 3, g.MARK),
    ]), -7.32, -16.75, 1, 1.07)
    kit.set_palette('Bench pigment mixer', primary='#657e78', detail='#794d54', accent='#baa168')
    kit.add('Pigment drawer shelf', assembly(g, [
        (0, 0, -2, 20, 10, 2, g.WOOD), (0, 0, 0, 21, 2, 6, g.WOOD),
        (0, 9, 0, 21, 1, 6, g.WOOD),
        *((x, 2, 0, 4, 6, 4, c) for x,c in ((-7,g.DARK),(-2,g.DETAIL),(3,g.MARK),(8,g.BODY))),
        *((x, 4, 2, 2, 2, 1, g.CAP) for x in (-7,-2,3,8)),
    ]), -7.76, -16.3, 1, 1.55)
    kit.set_palette('Pigment drawer shelf', primary='#538082', secondary='#475765',
                    detail='#944d51', accent='#bd9444', trim='#dacaad')
    kit.add('Ink wash sink', assembly(g, [
        (-5, 0, 0, 2, 7, 3, g.METAL), (5, 0, 0, 2, 7, 3, g.METAL),
        (0, 7, 0, 15, 2, 10, g.METAL), (0, 9, -4, 15, 3, 2, g.CAP),
        (0, 9, 4, 15, 3, 2, g.CAP), (-6, 9, 0, 2, 3, 7, g.CAP),
        (6, 9, 0, 2, 3, 7, g.CAP), (4, 12, -4, 2, 4, 2, g.METAL),
        (4, 15, -2, 2, 1, 5, g.METAL), (0, 9, 0, 7, 1, 4, g.DARK),
    ]), -7.35, -18.15, 1)
    kit.set_palette('Ink wash sink', trim='#c9cbbd', secondary='#687b72')
    kit.add('Ink store specimen strip', assembly(g, [
        (0, 0, 0, 16, 6, 2, g.CAP),
        *((x, 1, 1, 3, 4, 1, c) for x,c in ((-6,g.BODY),(-2,g.DETAIL),(2,g.MARK),(6,g.DARK))),
    ]), -7.77, -18.15, 1, 1.86)
    kit.set_palette('Ink store specimen strip', primary='#578993', detail='#ae5963',
                    accent='#caaa5c', secondary='#47494a', trim='#e0cfad')
    kit.add('Ink store work lamp', assembly(g, [
        (0, 0, 0, 13, 1, 3, g.LAMP), (0, 1, 0, 15, 2, 4, g.GRIT),
        (0, 3, -2, 4, 3, 4, g.METAL),
    ]), -7.62, -16.2, 1, 2.2)
    fixtures.append(dict(position=[-7.25, 2.16, -16.2], color='#e8ece1', intensity=7, distance=4))
    kit.add('Standing paper rolls', assembly(g, [
        (0, 0, 0, 17, 2, 12, g.WOOD),
        (-4, 2, 0, 6, 14, 8, g.CAP), (-4, 2, 0, 8, 14, 6, g.CAP),
        (-4, 15, 0, 2, 1, 2, g.WOOD),
        (4, 2, 0, 6, 11, 7, g.LIGHT), (4, 2, 0, 8, 11, 5, g.LIGHT),
        (4, 12, 0, 2, 1, 2, g.WOOD),
    ]), -2.85, -19.65)
    kit.set_palette('Standing paper rolls', trim='#d7cbb0', visor='#e9e2ce')
    kit.add('Cylinder wash tins', assembly(g, [
        (0, 0, 0, 10, 1, 5, g.METAL), (-3, 1, 0, 4, 5, 4, g.DETAIL),
        (3, 1, 0, 4, 4, 4, g.BODY), (-3, 6, 0, 4, 1, 4, g.METAL),
        (3, 5, 0, 4, 1, 4, g.METAL), (-3, 2, 2, 3, 2, 1, g.CAP),
    ]), -.95, -9.35)
    kit.set_palette('Cylinder wash tins', primary='#648180', detail='#9b5f4d', trim='#dacea9')


def dispatch_joinery(kit, g):
    kit.add('Dispatch door transom', assembly(g, [
        (0, 0, 0, 18, 1, 3, g.WOOD), (-8, 1, 0, 2, 4, 3, g.WOOD),
        (8, 1, 0, 2, 4, 3, g.WOOD), (0, 4, 0, 18, 1, 3, g.WOOD),
        (-3, 1, 0, 1, 3, 2, g.METAL), (3, 1, 0, 1, 3, 2, g.METAL),
    ]), -4, -12, 3, 5.46)
    kit.add('Dispatch radiator', assembly(g, [
        (-6, 0, 0, 3, 2, 3, g.METAL), (6, 0, 0, 3, 2, 3, g.METAL),
        (0, 3, 0, 17, 2, 3, g.GRIT), (0, 8, 0, 17, 2, 3, g.GRIT),
        *((x, 2, 0, 2, 9, 4, g.BODY) for x in (-6,-3,0,3,6)),
        (8, 7, 0, 3, 2, 3, g.METAL),
    ]), -3.68, -9.45, 1, 3.4)
    kit.set_palette('Dispatch radiator', primary='#9b9784', metal='#9d9e8e')
    kit.add('Dispatch ledger shelf', assembly(g, [
        (0, 0, 0, 14, 2, 5, g.WOOD),
        *((x, 2, 0, 2, h, 4, c) for x,h,c in
          ((-5,5,g.BODY),(-2,6,g.DARK),(1,5,g.DETAIL),(4,6,g.WOOD))),
        (-5, 4, 2, 2, 1, 1, g.CAP), (1, 4, 2, 2, 1, 1, g.CAP),
    ]), -.6, -13.67, height=5.36)
    kit.set_palette('Dispatch ledger shelf', primary='#768772', secondary='#56666d', detail='#925c4e')
    kit.add('Dispatch ticket rack', assembly(g, [
        (0, 0, 0, 11, 12, 2, g.GRIT),
        *((0, y, 1, 11, 1, 4, g.WOOD) for y in (0,4,8)),
        (-2, 1, 1, 5, 3, 2, g.CAP), (2, 5, 1, 5, 3, 2, g.LIGHT),
        (-1, 9, 1, 5, 3, 2, g.CAP),
    ]), -3.31, -13.7, height=4.36)
    kit.set_palette('Dispatch ticket rack', trim='#d9c89f', visor='#d7a370')
    kit.add('Wicket return screen', assembly(g, [
        (0, 0, 0, 19, 9, 3, g.WOOD), (0, 9, 0, 20, 2, 5, g.WOOD),
        (-8, 11, 0, 2, 10, 3, g.GRIT), (8, 11, 0, 2, 10, 3, g.GRIT),
        (0, 20, 0, 18, 2, 3, g.WOOD), (0, 15, 0, 17, 1, 2, g.GRIT),
        (0, 11, 0, 1, 9, 2, g.GRIT), (4, 16, 0, 6, 4, 1, g.LIGHT),
    ]), -.45, -9.6, 1, 3.4)
    kit.set_palette('Wicket return screen', leather='#88745b', primary='#65736b', visor='#a3aaa0')
    kit.set_palette('Dispatch office doorway', primary='#8d8c7b', skin='#819182')
    kit.set_palette('Print office upper sash', primary='#a69980', skin='#7f8977')
    kit.set_palette('Print works solid', primary='#967963', skin='#aaa18e')
    kit.set_palette('Print works door', primary='#857863', skin='#aaa18e')
    kit.set_palette('Parcel counter sign', primary='#8b5247', trim='#e0c8a1')
    kit.set_palette('Plate store sign', primary='#526665', trim='#d7d1b6')
    kit.add('Press downspout', assembly(g, [
        (0, 0, 0, 2, 26, 2, g.METAL), (0, 26, -1, 2, 4, 4, g.METAL),
        (0, 0, 1, 2, 2, 4, g.GRIT), (0, 7, -1, 4, 2, 3, g.DARK),
        (0, 19, -1, 4, 2, 3, g.DARK),
    ]), -4.24, -10.8, 3, .05)
    kit.place('Press downspout', 2.35, -1.45, 0, 1.55)
    kit.add('Loft hatch frame', assembly(g, [
        (-10, 0, 0, 3, 20, 3, g.WOOD), (10, 0, 0, 3, 20, 3, g.WOOD),
        (0, 18, 0, 24, 3, 4, g.GRIT), (0, 0, 0, 24, 2, 5, g.METAL),
    ]), 0, -1.72, height=2.91)
    kit.add('Loading loft shutter', assembly(g, [
        (0, 0, 0, 10, 15, 2, g.WOOD), (0, 1, 1, 10, 2, 2, g.BODY),
        (0, 12, 1, 10, 2, 2, g.BODY), (3, 7, 1, 2, 3, 2, g.METAL),
    ]), -1.1, -1.47, height=3.2)
    kit.place('Loading loft shutter', 1.1, -1.47, 2, 3.2)
    kit.set_palette('Loading loft shutter', leather='#778171', primary='#526860')
    kit.add('Loft sack beam', assembly(g, [
        (0, 7, 0, 4, 3, 18, g.DARK), (0, 8, 6, 5, 3, 4, g.METAL),
        (0, 0, 6, 1, 8, 1, g.METAL), (0, 0, 6, 3, 2, 2, g.WOOD),
    ]), .77, -1.2, height=4.26)
    kit.add('Letterpress bill frame', assembly(g, [
        (0, 0, 0, 13, 16, 2, g.WOOD), (0, 1, 1, 11, 14, 1, g.CAP),
        (0, 11, 2, 9, 2, 1, g.BODY), (-2, 5, 2, 4, 5, 1, g.GRIT),
        (2, 6, 2, 4, 1, 1, g.DETAIL), (2, 3, 2, 4, 1, 1, g.GRIT),
    ]), -3.35, 5.99, height=.95)
    kit.set_palette('Letterpress bill frame', trim='#d8cba7', primary='#59776e',
                    detail='#a76a53', leather='#655748')
    kit.add('Loading brick corbel', assembly(g, [
        (0, 0, -1, 3, 2, 4, g.PATINA), (0, 2, 0, 5, 2, 6, g.MASONRY),
        (0, 4, 1, 7, 2, 8, g.CAP),
    ]), -4.95, -1.52, height=4.72)
    for x in (-2.8, 2.85, 4.95):
        kit.place('Loading brick corbel', x, -1.52, height=4.72)
    kit.set_palette('Loading brick corbel', skin='#958372', trim='#b19a7c')


def press_glazing(kit, g, fixtures):
    # The roof opening supplies daylight above the shipping desk.
    kit.remove_at('Print office parapet roof', -2, -12)
    curb = g.roof(41, 41, g.GRIT)
    curb.cut((-13, 12), (0, 6), (-5, 4))
    kit.add('Dispatch skylight curb', curb, -2, -12, height=6.3)
    kit.set_palette('Dispatch skylight curb', primary='#747b71')
    resculpt(kit, g, 'Dispatch roof lantern', assembly(g, [
        (0, 0, -7, 34, 2, 3, g.GRIT), (0, 0, 7, 34, 2, 3, g.GRIT),
        (-15, 0, 0, 3, 2, 15, g.GRIT), (15, 0, 0, 3, 2, 15, g.GRIT),
        *((x, 2, z, 2, 6, 2, g.METAL) for x in (-15,0,15) for z in (-7,7)),
        (0, 8, -7, 34, 2, 3, g.METAL), (0, 8, 7, 34, 2, 3, g.METAL),
        (-8, 2, 7, 12, 6, 1, g.LIGHT), (8, 2, -7, 12, 6, 1, g.LIGHT),
    ]))
    kit.move('Dispatch roof lantern', -2, -12, height=6.6)
    kit.add('Lantern ridge and rafters', assembly(g, [
        (0, 3, 0, 34, 2, 4, g.DARK),
        *((x, 0, z, 2, 3, 6, g.METAL) for x in (-15, 0, 15) for z in (-4,4)),
    ]), -2, -12, height=7.5)
    kit.set_palette('Dispatch roof lantern', visor='#9fbbb5', primary='#75827b')
    fixtures.append(dict(position=[-1.9, 6.04, -11.9], color='#e0eeea', intensity=4, distance=4))
    kit.add('Press sheet line', assembly(g, [
        (0, 8, 0, 28, 1, 2, g.METAL), (-12, 9, 0, 2, 4, 2, g.METAL),
        (12, 9, 0, 2, 4, 2, g.METAL), (-8, 1, 0, 7, 7, 1, g.CAP),
        (1, 0, 0, 7, 8, 1, g.LIGHT), (9, 2, 0, 6, 6, 1, g.CAP),
        (-8, 3, 1, 4, 3, 1, g.DARK), (1, 5, 1, 5, 1, 1, g.BODY),
        (2, 2, 1, 3, 2, 1, g.DETAIL), (9, 4, 1, 3, 2, 1, g.BODY),
    ]), 1.2, -13.6, height=1.82)
    kit.set_palette('Press sheet line', trim='#d2c5a6', visor='#e7dfc6',
                    primary='#617d79', detail='#a36b58')
    kit.add('Press sash sill', assembly(g, [
        (0, 0, 0, 28, 2, 4, g.WOOD), (0, 15, 0, 28, 2, 4, g.WOOD),
        *((x, 2, 0, 2, 13, 3, g.BODY) for x in (-13, 0, 13)),
        (0, 10, 0, 26, 1, 3, g.BODY), (-7, 11, 0, 11, 4, 1, g.LIGHT),
        (7, 2, 0, 11, 8, 1, g.LIGHT), (7, 4, 1, 2, 6, 1, g.WOOD),
        (0, 0, 1, 30, 1, 5, g.GRIT),
    ]), -4.23, -8.0, 3, .85)
    kit.set_palette('Press sash sill', primary='#647a70', leather='#907758',
                    visor='#9aaea3')


def calibration_court(kit, g):
    wall = assembly(g, [
        (0, 0, 0, 54, 3, 8, g.GRIT), (0, 3, 0, 54, 7, 6, g.BODY),
        (0, 10, 0, 54, 21, 6, g.MASONRY), (0, 31, 0, 54, 3, 6, g.PATINA),
        (-21, 8, 2, 10, 3, 2, g.PATINA), (-24, 11, 2, 4, 2, 2, g.PATINA),
        (18, 8, 2, 14, 2, 2, g.PATINA), (22, 10, 2, 6, 2, 2, g.PATINA),
        *((x, 10, 2, 1, 21, 1, g.GRIT) for x in (-9, 9)),
        (-1, 26, 2, 13, 2, 2, g.PATINA),
    ])
    resculpt(kit, g, 'Target backstop', wall)
    kit.set_palette('Target backstop', skin='#b3a58e', primary='#74847c')
    kit.add('Optical alignment carrier', assembly(g, [
        (-4, 0, 0, 4, 2, 7, g.GRIT), (4, 0, 0, 4, 2, 7, g.GRIT),
        *((x, 2, 0, 2, 20, 3, g.METAL) for x in (-4, 4)),
        (0, 3, 0, 8, 2, 2, g.DARK), (0, 19, 0, 10, 3, 3, g.BODY),
        (-4, 10, 1, 4, 6, 3, g.DARK), (4, 10, 1, 4, 6, 3, g.DARK),
        (0, 11, 2, 12, 2, 2, g.METAL), (0, 10, 3, 12, 12, 2, g.BODY),
        (0, 11, 4, 10, 10, 1, g.CAP), (-2, 11, 5, 5, 5, 1, g.DARK),
        (3, 16, 5, 5, 5, 1, g.DARK), (0, 22, 0, 3, 2, 3, g.DETAIL),
    ]), -1.94, -.98)
    kit.place('Optical alignment carrier', -.25, -.98)
    kit.place('Optical alignment carrier', 1.45, -.98)
    kit.set_palette('Optical alignment carrier', primary='#5c726a', secondary='#454942',
                    trim='#d5c5a2', metal='#9ca199', detail='#a36248')
    kit.add('Calibration drive cabinet', assembly(g, [
        (0, 0, 0, 7, 2, 7, g.PATINA), (0, 2, 0, 5, 9, 4, g.BODY),
        (0, 11, 0, 7, 2, 6, g.GRIT), (0, 7, 2, 3, 2, 1, g.LIGHT),
        (1, 4, 2, 1, 2, 1, g.DETAIL), (-2, 2, 2, 1, 3, 1, g.METAL),
    ]), 2.18, -.58)
    kit.set_palette('Calibration drive cabinet', primary='#7e887c', visor='#bad0bd')
    kit.add('Barrier clamp shoe', assembly(g, [
        (0, 0, 0, 7, 2, 8, g.PATINA), (0, 2, 0, 6, 1, 7, g.METAL),
        (-2, 3, 0, 2, 4, 4, g.GRIT), (2, 3, 0, 2, 4, 4, g.GRIT),
        (-2, 6, 2, 2, 1, 2, g.METAL), (2, 6, 2, 2, 1, 2, g.METAL),
        (0, 3, 3, 2, 1, 1, g.METAL),
    ]), -1.9, 5.55)
    kit.place('Barrier clamp shoe', 2.85, 5.5, 1)

    # A split frame keeps the yard visible through the old pump passage.
    resculpt(kit, g, 'Depot rear opening', assembly(g, [
        (-16, 0, 0, 7, 4, 6, g.PATINA), (16, 0, 0, 7, 4, 6, g.PATINA),
        (-16, 4, 0, 6, 9, 4, g.BODY), (16, 4, 0, 6, 9, 4, g.BODY),
        (-16, 13, 0, 6, 11, 4, g.MASONRY), (16, 13, 0, 6, 11, 4, g.MASONRY),
        (0, 24, 0, 38, 2, 5, g.WOOD), (0, 26, 0, 38, 2, 6, g.GRIT),
        *((x, 0, 0, 2, 24, 5, g.METAL) for x in (-12, 12)),
        (-14, 11, -2, 4, 2, 2, g.PATINA), (15, 4, -2, 5, 2, 2, g.PATINA),
        (-12, 20, -2, 5, 2, 2, g.METAL),
    ]))
    kit.set_palette('Depot rear opening', primary='#677b73', skin='#afa28b',
                    metal='#91968a', leather='#8d7b65')
    kit.add('Air plant valve station', assembly(g, [
        (-6, 0, 0, 2, 17, 2, g.METAL), (6, 0, 0, 2, 17, 2, g.METAL),
        (-6, 3, 0, 4, 2, 3, g.BODY), (6, 3, 0, 4, 2, 3, g.BODY),
        (0, 14, 0, 13, 2, 2, g.METAL), (0, 8, 0, 3, 7, 2, g.BODY),
        (0, 9, 1, 5, 5, 1, g.DETAIL), (0, 10, 2, 3, 3, 1, g.DARK),
        (0, 11, 3, 1, 1, 1, g.CAP), (6, 16, 0, 4, 4, 3, g.DARK),
        (6, 17, 2, 2, 2, 1, g.CAP),
    ]), -16.36, -22.65, 2, .25)
    kit.set_palette('Air plant valve station', primary='#688079', detail='#aa7157')
    kit.add('Air plant service ledger', assembly(g, [
        (0, 0, 0, 6, 9, 2, g.WOOD), (0, 1, 1, 4, 7, 1, g.CAP),
        (0, 7, 1, 3, 2, 2, g.METAL), (0, 5, 1, 3, 1, 2, g.BODY),
    ]), -14.29, -22.66, 2, 1.35)


def street_window_repairs(kit, g):
    sash = assembly(g, [
        (0, 0, 0, 40, 9, 6, g.BODY), (0, 23, 0, 40, 6, 6, g.BODY),
        *((x, 9, 0, 4, 14, 6, g.BODY) for x in (-18, 0, 18)),
        (0, 8, 0, 40, 1, 8, g.MASONRY), (0, 27, 0, 40, 2, 7, g.MASONRY),
        *((x, 9, 0, 1, 14, 2, g.DARK) for x in (-9, 9)),
        (0, 18, 0, 36, 1, 2, g.DARK), (-12, 19, 0, 5, 4, 1, g.LIGHT),
        (6, 19, 0, 5, 4, 1, g.LIGHT), (-7, 3, 2, 9, 3, 2, g.PATINA),
    ])
    resculpt(kit, g, 'Upper brick windows', sash)
    kit.set_palette('Upper brick windows', primary='#997659', skin='#b9a88c',
                    visor='#8ca29a', secondary='#5d695f')
    kit.add('Parcel office lower panels', assembly(g, [
        (0, 0, 0, 21, 7, 2, g.BODY), (0, 0, 1, 22, 2, 2, g.GRIT),
        *((x, 2, 1, 2, 5, 2, g.WOOD) for x in (-9, 0, 9)),
        (0, 6, 1, 22, 1, 2, g.WOOD), (-4, 3, 2, 5, 2, 1, g.DARK),
        (5, 2, 2, 4, 1, 1, g.PATINA),
    ]), 4.5, .83, height=.83)
    kit.set_palette('Parcel office lower panels', primary='#74867e', leather='#667669')
    kit.add('Dispatch rain leader', assembly(g, [
        (0, 0, 1, 4, 3, 4, g.GRIT), (0, 3, 0, 2, 19, 2, g.METAL),
        (0, 22, 0, 3, 3, 3, g.METAL), (0, 25, -1, 3, 2, 3, g.METAL),
        (0, 27, -2, 4, 2, 4, g.DARK),
        *((0, y, -1, 4, 1, 3, g.BODY) for y in (5,17)),
    ]), 5.46, .58, height=.73)
    kit.set_palette('Dispatch rain leader', metal='#818981', primary='#69786c')
    kit.add('Plate store masonry repair', assembly(g, [
        (0, 0, 0, 9, 6, 2, g.MASONRY), (-4, 6, 0, 3, 3, 2, g.MASONRY),
        (-2, 3, 1, 5, 2, 1, g.BODY), (3, 1, 1, 3, 2, 1, g.BODY),
        (-3, 7, 1, 3, 1, 1, g.GRIT),
    ]), 2.45, -1.48, height=1.08)
    kit.set_palette('Plate store masonry repair', skin='#9f9683', primary='#9b7963')
    kit.add('Gallery roll chock', assembly(g, [
        (0, 0, 0, 9, 2, 11, g.WOOD), (0, 2, -3, 9, 2, 4, g.WOOD),
        (0, 4, -4, 9, 1, 2, g.WOOD), (-3, 0, 1, 2, 1, 7, g.METAL),
        (3, 0, 1, 2, 1, 7, g.METAL), (0, 1, 5, 7, 1, 2, g.GRIT),
    ]), -7.76, -10.03, 3)
    kit.set_palette('Gallery roll chock', leather='#8c785f')


def compressor_bench(kit, g, fixtures):
    kit.remove_at('Air plant masonry', -14.06, -24.03, height=0)
    move_stock(kit, {('Air cylinder trolley', -14.78, -24.62): (-14.95, -25.18)})
    kit.add('Air plant side loading door', assembly(g, [
        (-15, 0, 0, 4, 5, 5, g.PATINA), (15, 0, 0, 4, 5, 5, g.PATINA),
        (-15, 5, 0, 4, 10, 4, g.BODY), (15, 5, 0, 4, 10, 4, g.BODY),
        (-15, 15, 0, 4, 9, 4, g.MASONRY), (15, 15, 0, 4, 9, 4, g.MASONRY),
        (0, 24, 0, 34, 4, 5, g.GRIT), (0, 23, 1, 32, 1, 4, g.METAL),
        (0, 22, 0, 26, 1, 3, g.BODY), (0, 21, 0, 26, 1, 2, g.BODY),
        *((x, 0, 0, 1, 23, 4, g.METAL) for x in (-12, 12)),
    ]), -14.06, -24.03, 1)
    kit.set_palette('Air plant side loading door', primary='#718780', skin='#ad9f86')
    kit.add('Compressor overhaul bench', assembly(g, [
        *((x, 0, z, 3, 2, 3, g.GRIT) for x in (-8, 8) for z in (-3, 3)),
        *((x, 2, z, 2, 6, 2, g.BODY) for x in (-8, 8) for z in (-3, 3)),
        (0, 3, 0, 17, 1, 7, g.METAL), (0, 8, 0, 20, 2, 10, g.WOOD),
        (0, 10, 3, 19, 1, 3, g.METAL), (-4, 4, 0, 7, 2, 5, g.DARK),
        (5, 4, 0, 5, 3, 5, g.DETAIL),
    ]), -16.75, -23.94, 1)
    kit.set_palette('Compressor overhaul bench', primary='#718579', leather='#ae9472', detail='#926e52')
    kit.add('Compressor cylinder casting', assembly(g, [
        (0, 0, 0, 10, 1, 7, g.METAL), (0, 1, 0, 7, 4, 5, g.BODY),
        *((0, y, 0, 8, 1, 7, g.GRIT) for y in (2, 4, 6)),
        (0, 5, 0, 6, 3, 5, g.BODY), (0, 8, 0, 8, 1, 6, g.METAL),
        (-2, 9, -1, 2, 1, 2, g.DARK), (2, 9, 1, 2, 1, 2, g.DARK),
        (4, 2, 1, 2, 3, 3, g.DETAIL),
        (2, 2, 3, 3, 3, 3, g.METAL), (2, 1, 4, 4, 5, 2, g.DARK),
        (2, 2, 4, 6, 3, 2, g.DARK), (2, 2, 5, 3, 3, 1, g.DETAIL),
        (2, 3, 6, 1, 1, 1, g.METAL),
    ]), -16.73, -24.03, 1, 1.01)
    kit.set_palette('Compressor cylinder casting', primary='#939591', metal='#b3b7a7', detail='#a26a50')
    kit.add('Fitters standing mat', assembly(g, [
        (0, 0, 0, 9, 2, 17, g.RUBBER),
        *((0, 1, z, 7, 1, 1, g.DARK) for z in (-6, -3, 0, 3, 6)),
        (4, 1, -4, 1, 1, 5, g.GRIT),
    ]), -15.89, -23.92, height=-.15)
    kit.set_palette('Fitters standing mat', hair='#656b63', secondary='#747b6e')
    kit.add('Air end gasket tray', assembly(g, [
        (0, 0, 0, 6, 1, 6, g.METAL), (0, 1, -2, 5, 1, 2, g.CAP),
        (-2, 1, 0, 1, 1, 4, g.DARK), (2, 1, 0, 1, 1, 4, g.DARK),
        (0, 1, -1, 4, 1, 1, g.DARK), (0, 1, 2, 4, 1, 1, g.DARK),
        (0, 1, 0, 1, 1, 1, g.METAL),
    ]), -16.67, -24.67, height=1.01)
    kit.set_palette('Air end gasket tray', metal='#9fa69e', trim='#b08c77')
    kit.add('Folding bench light', assembly(g, [
        (0, 0, 0, 3, 2, 3, g.GRIT), (0, 2, 0, 1, 6, 1, g.METAL),
        (0, 7, 1, 2, 2, 4, g.METAL), (0, 7, 3, 4, 2, 3, g.BODY),
        (0, 6, 3, 3, 1, 2, g.LAMP),
    ]), -16.98, -23.27, 1, 1.0)
    kit.set_palette('Folding bench light', primary='#a89774')
    fixtures.append(dict(position=[-16.64, 1.58, -23.29], color='#f6e8c9', intensity=3.2, distance=2.5))


def gallery_court_drain(kit, g):
    remove_tiles(kit, 'Yard embankment', [(-12, z) for z in (-8, -12, -16)], height=-.25)
    court = assembly(g, [
        (0, 0, 0, 40, 3, 40, g.MASONRY), (15, 2, 0, 10, 1, 40, g.SOIL),
        (9, 2, 0, 2, 1, 40, g.PATINA), (5, 2, -4, 3, 1, 19, g.PATINA),
        (9, 2, 11, 2, 1, 9, g.PATINA), (-2, 2, -14, 4, 1, 5, g.GRIT),
        (-4, 2, 6, 9, 1, 2, g.GRIT), (13, 2, -10, 4, 1, 3, g.GRIT),
        (12, 2, -6, 7, 1, 12, g.BODY), (17, 2, 12, 5, 1, 11, g.BODY),
    ])
    kit.add('Gallery cart lane', court, -12, -8, height=-.25)
    for z in (-12, -16):
        kit.place('Gallery cart lane', -12, z, height=-.25)
    kit.set_palette('Gallery cart lane', skin='#9a9280', primary='#797f66', leather='#7f755b')
    kit.add('Cart lane sett crossing', assembly(g, [
        (0, 0, 0, 30, 2, 11, g.MASONRY), (0, 2, 3, 30, 1, 5, g.MASONRY),
        (-6, 1, -3, 1, 1, 5, g.PATINA), (6, 1, -3, 1, 1, 5, g.PATINA),
        (-10, 2, 3, 1, 1, 5, g.PATINA), (1, 2, 3, 1, 1, 5, g.PATINA),
    ]), -12.38, -6.14, height=-.105)
    kit.set_palette('Cart lane sett crossing', skin='#a29883')
    kit.add('Clay yard drain', assembly(g, [
        (0, 0, 0, 6, 2, 36, g.DARK), (-3, 1, 0, 2, 2, 36, g.WOOD),
        (3, 1, 0, 2, 2, 36, g.WOOD), (0, 1, -4, 3, 1, 17, g.METAL),
        *((x, 2, z, 2, 1, 1, g.GRIT) for x,z in ((-3,-14),(3,-10),(-3,-6),(3,-2),(-3,2),(3,6),(-3,10),(3,14))),
        *((0, 2, z, 5, 1, 1, g.METAL) for z in (11,13,15,17)),
    ]), -10.58, -8.8, height=-.14)
    kit.place('Clay yard drain', -10.58, -12.4, height=-.14)
    kit.place('Clay yard drain', -10.58, -5.2, height=-.14)
    kit.add('Willow planting pocket', assembly(g, [
        (0, 0, 0, 14, 2, 19, g.SOIL), (-6, 1, 0, 2, 2, 19, g.PATINA),
        (0, 1, -9, 14, 2, 2, g.WOOD), (0, 1, 9, 14, 2, 2, g.WOOD),
        (6, 1, 0, 2, 2, 19, g.PATINA), (-4, 2, 4, 3, 2, 5, g.BODY),
        (-4, 4, 5, 1, 2, 2, g.DETAIL), (3, 2, -4, 4, 1, 6, g.BODY),
        (4, 3, -6, 2, 3, 2, g.BODY), (1, 2, 5, 4, 1, 2, g.GRIT),
    ]), -11.30, -10.35, height=-.05)
    kit.set_palette('Willow planting pocket', primary='#718062', detail='#919470',
                    leather='#89755d', skin='#a89c85')
    kit.set_palette('Clay yard drain', leather='#957b65', secondary='#566256', metal='#85887a')
    kit.add('Roll yard drain crossing', assembly(g, [
        (-8, 0, 0, 6, 2, 10, g.MASONRY), (8, 0, 0, 6, 2, 10, g.MASONRY),
        (-5, 1, 0, 3, 2, 10, g.PATINA), (5, 1, 0, 3, 2, 10, g.PATINA),
        (0, 2, 0, 10, 1, 10, g.METAL), (0, 2, -3, 8, 1, 1, g.GRIT),
        (0, 2, 3, 8, 1, 1, g.GRIT),
    ]), -10.58, -12.22, height=-.10)
    kit.set_palette('Roll yard drain crossing', skin='#a59a85', metal='#89908a')
    kit.add('Cart lane gully pot', assembly(g, [
        (0, 0, 0, 9, 2, 10, g.PATINA), (0, 1, 0, 7, 1, 8, g.DARK),
        *((x, 2, 0, 1, 1, 8, g.METAL) for x in (-3, -1, 1, 3)),
        (0, 2, 3, 7, 1, 1, g.METAL),
    ]), -10.58, -3.12, height=-.19)
    kit.set_palette('Cart lane gully pot', skin='#9b927f', metal='#81877b')
    kit.add('Pollard willow stem', assembly(g, [
        (0, 0, 0, 6, 2, 6, g.WOOD), (-3, 0, 0, 5, 1, 3, g.SOIL),
        (2, 0, -3, 3, 1, 5, g.SOIL), (0, 2, 0, 4, 11, 4, g.WOOD),
        (-1, 12, 0, 4, 8, 4, g.WOOD), (-2, 19, 0, 5, 4, 5, g.SOIL),
        (-4, 22, 1, 3, 4, 3, g.WOOD), (-6, 25, 2, 3, 5, 3, g.WOOD),
        (0, 21, 0, 4, 3, 3, g.WOOD), (2, 23, -1, 3, 5, 3, g.WOOD),
        (4, 26, -2, 3, 4, 3, g.WOOD), (0, 2, 2, 2, 7, 1, g.BODY),
    ]), -11.27, -10.35)
    kit.set_palette('Pollard willow stem', leather='#786f5b', primary='#747c5f')
    kit.add('Willow leaf spray', assembly(g, [
        (0, 0, 0, 3, 10, 3, g.WOOD), (-2, 6, 0, 5, 4, 3, g.WOOD),
        (-4, 8, 0, 9, 5, 8, g.BODY), (-8, 5, 1, 5, 6, 6, g.BODY),
        (-10, 3, 2, 2, 6, 3, g.BODY), (-3, 12, 0, 7, 4, 6, g.DETAIL),
        (3, 9, -1, 7, 5, 8, g.BODY), (5, 7, 1, 5, 4, 6, g.BODY),
        (6, 5, 2, 3, 4, 3, g.DETAIL), (7, 3, 3, 2, 4, 2, g.BODY),
        (-6, 13, -2, 4, 4, 4, g.BODY), (-7, 16, -2, 3, 2, 2, g.DETAIL),
        (1, 12, -3, 5, 4, 4, g.DETAIL), (2, 14, -4, 3, 3, 3, g.BODY),
        (-1, 6, 4, 4, 5, 3, g.BODY), (-2, 4, 5, 2, 3, 2, g.DETAIL),
    ]), -11.77, -10.13, height=2.78)
    kit.place('Willow leaf spray', -10.81, -10.56, 2, 2.79)
    kit.set_palette('Willow leaf spray', primary='#747f5c', detail='#87906a', leather='#756d56')


def upgrade(kit, g, stops, fixtures):
    if kit.key == 'core':
        motor_pool(kit, g, fixtures)
        service_lane(kit, g, fixtures)
        course_equipment(kit, g, fixtures)
        motor_pool_services(kit, g, fixtures)
        marshal_station(kit, g, fixtures)
        parts_room(kit, g, fixtures)
        calibration_court(kit, g)
        compressor_bench(kit, g, fixtures)
        views = (
            ('Wheel shop entrance', [-13.7, 1.65, -5.2], [-7.35, 2.05, -14.8]),
            ('Wheel lift', [-4.52, 2.05, -12.83], [-8.3, .93, -14.67]),
            ('Training lanes', [-1.22, 1.65, 6.2], [.35, 1.66, -.95]),
            ('Lubricant store', [-13.17, 1.65, -23.66], [-16.48, 1.35, -23.99]),
            ('Parts counter', [-2.8, 1.65, -15.72], [1.12, 1.72, -18.65]),
        )
    else:
        print_works(kit, g, fixtures)
        dispatch_office(kit, g, fixtures)
        waste_paper_store(kit, g)
        press_line(kit, g, fixtures)
        loading_street(kit, g)
        ink_store(kit, g, fixtures)
        dispatch_joinery(kit, g)
        press_glazing(kit, g, fixtures)
        street_window_repairs(kit, g)
        gallery_court_drain(kit, g)
        for fixture in fixtures:
            if fixture['color'] == '#ffcb86':
                fixture['color'] = '#f2e5c8'
        views = (
            ('Print dispatch gallery', [-13.4, 1.85, -5.08], [-5.0, 2.63, -11.0]),
            ('Rotary press line', [-2.65, 1.73, -7.96], [.61, 1.13, -10.7]),
            ('Loading street', [1.9, 1.65, 9.6], [-1.1, 1.62, -.1]),
            ('Dispatch office', [1.2, 5.05, -10.65], [-1.7, 4.72, -13.05]),
            ('Ink mixing room', [-5.0, 1.65, -18.9], [-7.25, 1.35, -16.4]),
        )
    if kit.key == 'heist':
        for label in ('Bindery paper cutter', 'Gallery delivery hoist', 'Hand freight trolley'):
            kit.set_palette(label, primary='#58726e', secondary='#3f4b50', trim='#e7d9ad')
        for label in ('Paper roll cradle', 'Folded proof signature', 'Printed sheet drying rack',
                      'Composing type cabinet', 'Dispatch docket pigeonholes', 'Bound book counter'):
            kit.set_palette(label, trim='#e1d8bd', visor='#d9d8ba')
        kit.set_palette('Bindery striped awning', primary='#547269', trim='#d4c7a2')
        kit.set_palette('Dispatch roof lantern', visor='#8faeac')
    else:
        kit.set_palette('Wheel air compressor', primary='#996154')
        kit.set_palette('Workshop drawer chest', primary='#97564c')
        kit.set_palette('Wheel shop shutter', visor='#75949c')
        kit.set_palette('Wheel shop glazed gable', visor='#75949c')
    stops[:] = [dict(label=label, eye=eye, target=target) for label, eye, target in views]
