"""Place the tools and supplies for each level's work areas."""

from level_geometry import box


# Each entry gives the width, height, depth, X, Y, Z, and palette part.
WORKTOPS = {
    'core': ('Service tools', 'Heavy work table', 1.0, 0.14, (
        (5, 2, 3, -4, 1, 0, 'DETAIL'), (5, 1, 3, -4, 3, 0, 'METAL'),
        (4, 1, 1, -3, 4, 0, 'DARK'), (5, 1, 1, 2, 1, -1, 'METAL'),
        (2, 1, 2, 4, 1, 1, 'METAL'), (1, 2, 2, 0, 1, 1, 'MARK'),
    )),
    'heist': ('Proof sheets and ink', 'Pallet stack', 0.3, 0, (
        (6, 2, 4, -3, 1, 0, 'MASONRY'), (5, 1, 4, -2, 3, 0, 'CAP'),
        (4, 1, 2, -2, 4, 0, 'DARK'), (2, 2, 2, 3, 1, -1, 'DETAIL'),
        (2, 2, 2, 6, 1, -1, 'DARK'), (5, 1, 2, 4, 1, 1, 'METAL'),
    )),
    'industrial': ('Ore samples and tongs', 'Tool trolley', 1.0, 0.07, (
        (6, 1, 4, -3, 1, 0, 'METAL'), (3, 2, 3, -4, 2, 0, 'PATINA'),
        (2, 1, 2, -2, 2, 0, 'DETAIL'), (6, 1, 1, 3, 1, -1, 'METAL'),
        (5, 1, 1, 3, 1, 0, 'RUBBER'), (2, 1, 2, 1, 2, -1, 'CAP'),
    )),
    'security': ('Screening trays and forms', 'Control desk', 1.0, 0.14, (
        (6, 1, 4, -3, 1, 0, 'BODY'), (4, 1, 2, -3, 2, 0, 'CAP'),
        (4, 1, 4, 4, 1, 0, 'DARK'), (2, 2, 2, 4, 2, -1, 'METAL'),
        (3, 1, 1, 4, 2, 1, 'LIGHT'), (1, 3, 1, 6, 2, 1, 'DARK'),
    )),
    'creatures': ('Field samples and notebook', 'Survey map table', 1.1, 0.14, (
        (5, 1, 4, -3, 1, 0, 'CAP'), (4, 1, 2, -3, 2, 0, 'BODY'),
        (2, 2, 2, 2, 1, -1, 'MASONRY'), (2, 1, 2, 2, 3, -1, 'METAL'),
        (2, 3, 2, 5, 1, -1, 'WOOD'), (2, 1, 2, 5, 4, -1, 'CAP'),
    )),
    'fantasy': ('Bread boards and flour bowls', 'Market table', 1.0, 0, (
        (7, 1, 4, -3, 1, 0, 'WOOD'), (3, 1, 2, -4, 2, 0, 'MARK'),
        (3, 2, 2, 0, 2, 0, 'WOOD'), (3, 2, 3, 5, 1, -1, 'METAL'),
        (2, 1, 2, 5, 3, -1, 'CAP'), (4, 1, 1, 4, 1, 2, 'WOOD'),
    )),
}


def worktop(g, key, parts):
    shape = box(13, 1, 5, g.DARK if key in ('core', 'industrial', 'security') else g.WOOD)
    for width, height, depth, x, y, z, color in parts:
        box(width, height, depth, getattr(g, color), x=x, y=y, z=z, sculpt=shape)
    return shape


YARD_STATIONS = {
    'core': ('Tire service rack', (-6.8, -11.5, 0), (8.7, 4.4, 1)),
    'heist': ('Outgoing print bundles', (-7.8, -12.3, 1), (4.2, 12.0, 0)),
    'industrial': ('Sorted casting stock', (10.0, -8.6, 1), (6.7, 6.3, 1)),
    'security': ('Luggage staging rack', (9.7, -11.5, 1), (3.4, 8.0, 0)),
    'creatures': ('Survey supply rack', (5.5, -8.4, 1), (-4.8, 9.5, 0)),
    'fantasy': ('Market produce crates', (-7.4, -10.5, 0), (-4.9, 6.8, 0)),
}

APPROACH_SURFACES = {
    'core': ('Service bay markings', (-6.4, -8.1, 1), 'MASONRY', 'CAP'),
    'heist': ('Loading dock setts', (-7.4, -9.0, 1), 'DARK', 'PATINA'),
    'industrial': ('Foundry safety crossing', (10.2, -7.7, 1), 'DARK', 'MARK'),
    'security': ('Passenger queue markings', (10.4, -7.8, 1), 'DARK', 'CAP'),
    'creatures': ('Worn trail entrance', (6.8, -5.8, 1), 'SOIL', 'MASONRY'),
    'fantasy': ('Market doorstep', (-6.2, -8.0, 1), 'PATINA', 'CAP'),
}


def approach_surface(g, key, base, line):
    shape = box(24, 2, 19, base)
    wear = g.WOOD if key == 'creatures' else g.PATINA
    for x, z, width, depth in ((-7, -6, 4, 3), (0, 3, 7, 3), (8, 6, 4, 5)):
        box(width, 1, depth, wear, x=x, y=1, z=z, sculpt=shape)
    if key in ('core', 'security', 'industrial'):
        for x in (-9, 9):
            box(1, 1, 16, line, x=x, y=1, sculpt=shape)
        for x in range(-6, 9, 4):
            box(2, 1, 5, line, x=x, y=1, z=-4, sculpt=shape)
    else:
        for z in (-6, 0, 6):
            for x in (-7, 0, 7):
                box(5, 1, 2, line, x=x + (z // 6) % 2, y=1, z=z, sculpt=shape)
    shape.cut((-12, -11), (0, 1), (-9, -7))
    shape.cut((10, 11), (0, 1), (7, 9))
    return shape


def yard_station(g, key):
    shape = box(22, 2, 9, g.WOOD)
    for x in (-9, 0, 9):
        box(3, 1, 9, g.DARK, x=x, y=0, sculpt=shape)
    if key == 'core':
        sidewall = g.vk.vox('hair', .22, mottle=False)
        for x, z in ((-6, 1), (2, -1)):
            box(4, 9, 3, sidewall, x=x, y=2, z=z, sculpt=shape)
            box(6, 7, 3, sidewall, x=x, y=3, z=z, sculpt=shape)
            box(8, 5, 3, sidewall, x=x, y=4, z=z, sculpt=shape)
            shape.cut((x-2, x+1), (5, 7), (z-1, z+1))
            shape.cut((x-1, x), (4, 8), (z-1, z+1))
        box(3, 8, 4, g.RUBBER, x=8, y=2, sculpt=shape)
        box(3, 6, 6, g.RUBBER, x=8, y=3, sculpt=shape)
        box(3, 4, 8, g.RUBBER, x=8, y=4, sculpt=shape)
        shape.cut((7, 9), (5, 6), (-2, 1))
        for x in (-10, 9):
            box(2, 13, 2, g.GRIT, x=x, y=2, z=-3, sculpt=shape)
        box(21, 2, 2, g.DARK, y=11, z=-3, sculpt=shape)
        box(21, 1, 2, g.GRIT, y=3, z=3, sculpt=shape)
    elif key == 'industrial':
        for x, height in ((-6, 4), (5, 6)):
            for y in range(2, 2 + height, 2):
                box(9, 1, 8, g.METAL, x=x, y=y, sculpt=shape)
                box(9, 1, 6, g.DARK, x=x, y=y + 1, sculpt=shape)
            box(2, height, 9, g.MARK, x=x, y=2, sculpt=shape)
    else:
        hues = {
            'heist': (g.MASONRY, g.CAP, g.WOOD),
            'security': (g.BODY, g.DARK, g.DETAIL),
            'creatures': (g.WOOD, g.BODY, g.CAP),
            'fantasy': (g.WOOD, g.MARK, g.DETAIL),
        }[key]
        for x, z, height, finish in zip((-7, 0, 7), (0, -1, 1), (6, 9, 5), hues):
            box(6, height, 7, finish, x=x, y=2, z=z, sculpt=shape)
            box(6, 1, 7, g.DARK, x=x, y=3, z=z, sculpt=shape)
            box(2, 1, 3, g.CAP, x=x, y=2 + height, z=z, sculpt=shape)
    return shape


def dress_activity(kit, g):
    name, base_label, top, offset, parts = WORKTOPS[kit.key]
    base_id = next(prop_id for prop_id, label, _ in kit.props if label == base_label)
    added = False
    for placement in tuple(kit.placements):
        if placement['propId'] != base_id:
            continue
        x, y, z = placement['position']
        height = round(y + top, 3)
        if any(y < py <= height + 0.3 and abs(px - x) < 0.6 and abs(pz - z) < 0.6
               for px, py, pz in (other['position'] for other in kit.placements)):
            continue
        turn = placement['turn']
        dx, dz = ((0, offset), (offset, 0), (0, -offset), (-offset, 0))[turn]
        if added:
            kit.place(name, x + dx, z + dz, turn, height)
        else:
            kit.add(name, worktop(g, kit.key, parts), x + dx, z + dz, turn, height)
            added = True

    station_name, first, second = YARD_STATIONS[kit.key]
    kit.add(station_name, yard_station(g, kit.key), *first)
    kit.place(station_name, *second)

    surface_name, position, base, line = APPROACH_SURFACES[kit.key]
    kit.add(surface_name, approach_surface(g, kit.key, getattr(g, base), getattr(g, line)),
            *position, height=-0.192)
