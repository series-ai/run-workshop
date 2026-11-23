"""Modular village rooms, platform surfaces and civilian fittings. Units are metres."""

import math

from polykit import V
from props_level_common import gable_roof, tile_base


def _village_room(p, damaged):
    # The side walls leave a 3.60 m opening for either front wall.
    for side in (-1, 1):
        x = side * 1.90
        if damaged and side < 0:
            # The corner and sill survive where the top courses fell.
            for z, length, low, high in [(-1.40, 1.20, 2.60, 2.60), (-.40, .80, 2.33, 1.63),
                                         (.55, 1.10, 1.44, .86), (1.55, .90, .74, .60)]:
                profile = [(z - length/2, 0), (z + length/2, 0),
                           (z + length/2, high), (z - length/2, low)]
                p.loft([[V(x + dx, y, a) for a, y in profile] for dx in (-.10, .10)],
                       'skin', cap_start=True, cap_end=True)
        else:
            p.box((x, 1.30, 0), (.20, 2.60, 4), 'skin')
        for z in (-1.81, 0, 1.81):
            height = 2.60 if not damaged or side > 0 or z < 0 else (1.62 if z == 0 else .62)
            p.box((side * 1.80, height/2, z), (.08, height, .15), 'secondary')
        p.box((side * 1.82, .16, 0), (.12, .32, 4), 'secondary')
    for x in (-1.23, 1.23):
        p.box((x, 1.30, -1.90), (1.14, 2.60, .20), 'skin')
    p.box((0, .51, -1.90), (1.32, 1.02, .20), 'skin')
    p.box((0, 2.40, -1.90), (1.32, .40, .20), 'skin')
    p.box((0, 1.02, -1.85), (1.46, .10, .28), 'secondary')
    p.box((0, 1.61, -1.90), (.065, 1.18, .10), 'secondary')
    p.box((0, 1.74, -1.90), (1.32, .055, .10), 'secondary')


def prop_village_room(p):
    _village_room(p, damaged=False)


def prop_village_damaged_room(p):
    _village_room(p, damaged=True)


def prop_village_door_wall(p):
    for side in (-1, 1):
        p.box((side * 1.23, 1.30, 0), (1.14, 2.60, .20), 'skin')
        p.box((side * 1.23, .19, 0), (1.14, .38, .24), 'secondary')
        p.box((side * .70, 1.11, 0), (.09, 2.22, .25), 'secondary')
    p.box((0, 2.41, 0), (1.32, .38, .20), 'skin')
    p.box((0, 2.25, 0), (1.60, .14, .26), 'secondary')
    p.box((0, 2.48, .105), (.77, .16, .04), 'primary')


def prop_village_broken_wall(p):
    # The lime render stops above the exposed bond courses.
    for x, width, heights in [(-1.40, .80, (2.60, 2.20)), (-.80, .40, (1.94, 1.72)),
                              (.81, .42, (.82, 1.05)), (1.41, .78, (1.31, 1.82))]:
        left, right = x - width / 2, x + width / 2
        for base, peak, role in [(0, -.19, 'skin'), (-.19, 0, 'secondary')]:
            bottom = (0, 0) if base == 0 else tuple(h + base for h in heights)
            profile = [(left, bottom[0]), (right, bottom[1]),
                       (right, heights[1] + peak), (left, heights[0] + peak)]
            p.loft([[V(a, b, z) for a, b in profile] for z in (-.10, .10)],
                   role, cap_start=True, cap_end=True)
    for x, y in [(-1.52, 1.91), (-1.28, 1.75), (-1.55, 1.60), (1.54, 1.14)]:
        p.box((x, y, .10), (.22, .10, .024), 'secondary', ao=.10)


def _window_end_wall(p, damaged):
    # Both walls fit the 3.60 m bay. The door stays clear from x = -.56 to .76.
    p.box((-1.18, .44, 0), (1.24, .88, .20), 'skin')
    p.box((-1.18, .89, 0), (1.24, .12, .28), 'secondary')
    p.box((-1.69, 1.47, 0), (.22, 1.04, .20), 'skin')
    if damaged:
        # The sill and one jamb survive. Broken brick courses step down to the door.
        for x, y, width in [(-1.69, 2.06, .22), (-1.73, 2.20, .14),
                            (-.71, 1.02, .30), (-.77, 1.16, .18)]:
            p.box((x, y, 0), (width, .14, .21), 'secondary', ao=.12)
        p.box((1.28, .70, 0), (1.04, 1.40, .20), 'skin')
        for row, count in enumerate((4, 3, 2, 2, 1)):
            for column in range(count):
                p.box((1.67 - column * .26, 1.49 + row * .18, 0),
                      (.255, .18, .22), 'secondary', ao=.08 * ((row + column) % 2))
    else:
        p.box((-.67, 1.47, 0), (.22, 1.04, .20), 'skin')
        p.box((-1.18, 2.295, 0), (1.24, .61, .20), 'skin')
        p.box((-1.18, 1.47, 0), (.065, 1.04, .085), 'secondary')
        p.box((-1.18, 1.56, 0), (.80, .065, .085), 'secondary')
        p.box((1.28, 1.30, 0), (1.04, 2.60, .20), 'skin')
        p.box((.10, 2.41, 0), (1.32, .38, .20), 'skin')
        p.box((.10, 2.22, 0), (1.56, .14, .26), 'secondary')


def prop_village_window_end(p):
    _window_end_wall(p, damaged=False)


def prop_village_broken_window_end(p):
    _window_end_wall(p, damaged=True)


def prop_village_slate_roof(p):
    gable_roof(p, 0, 0, 0, 4, 4, 1.20, 'metal', overhang=.18)
    for side in (-1, 1):
        for offset in (.57, 1.15, 1.73):
            p.box((0, 1.20 * (1 - offset / 2.18), side * offset),
                  (4.36, .065, .12), 'metal', ao=-.15)
    p.box((0, 1.20, 0), (4.36, .11, .16), 'metal')
    p.box((-1.15, 1.14, -.73), (.50, .86, .42), 'secondary')
    p.box((-1.15, 1.57, -.73), (.58, .12, .50), 'skin')
    for x in (-1.29, -1.01):
        p.lathe([(.105, 1.62), (.085, 1.86), (.115, 1.88), (.115, 1.95)],
                8, 'secondary', center=(x, 0, -.73), cap_end=True)


def _flagstone_floor(p, depth):
    tile_base(p, 4, depth, .465, 'secondary')
    for i in range(5):
        p.box(((i - 2) * .80, .49, 0), (.80, .05, depth), 'skin', ao=.025 * (i % 3))


def prop_goods_office_plinth(p):
    _flagstone_floor(p, 4)


def prop_depot_landing(p):
    _flagstone_floor(p, 2)


def prop_porter_ramp(p):
    # The high end meets the 0.515 m station platform at local Z = -2.
    section = [(-2, 0), (2, 0), (-2, .515)]
    p.loft([[V(x, y, z) for z, y in section] for x in (-1, 1)],
           'secondary', cap_start=True, cap_end=True)
    for side in (-1, 1):
        for z in (-1.85, -.05, 1.75):
            base = (2 - z) * .515 / 4
            p.box((side * .93, base + .41, z), (.10, .82, .10), 'metal')
        p.prism((side * .93, 1.326, -1.93), (side * .93, .844, 1.82),
                .055, .055, 6, 'secondary')


def prop_depot_siding(p):
    tile_base(p, 4, 2, .12, 'metal')
    for i in range(7):
        p.box(((i - 3) * 4 / 7, .16, 0), (.19, .08, 1.93), 'secondary')
    for z in (-.75, .75):
        p.box((0, .24, z), (4, .08, .08), 'metal')
        p.box((0, .295, z), (4, .03, .13), 'metal', ao=.22)


def prop_village_lane_tee(p):
    tile_base(p, 2, 2, .123, 'primary')
    p.box((-.84, .072, 0), (.32, .144, 2), 'hair')
    for z in (-.84, .84):
        p.box((.84, .072, z), (.32, .144, .32), 'hair')


def prop_village_verge(p):
    tile_base(p, 2, 2, .123, 'hair')
    for x, z, width in [(-.51, -.35, .40), (-.21, -.22, .25), (.57, .55, .31)]:
        p.box((x, .127, z), (width, .008, .14), 'hair', corner=.05, ao=-.12)


def prop_parcel_sorter(p):
    for x in (-.74, .74):
        p.box((x, .94, 0), (.11, 1.88, .62), 'secondary')
    p.box((0, 1.40, -.27), (1.48, .96, .08), 'primary')
    for y in (.92, 1.38, 1.85):
        p.box((0, y, 0), (1.48, .07, .60), 'secondary')
    p.box((0, 1.39, 0), (.06, .90, .54), 'secondary')
    for x, y, width in [(-.36, 1.09, .49), (.31, 1.51, .41), (.37, 1.05, .53)]:
        p.box((x, y, .04), (width, 2 * (y - (.955 if y < 1.38 else 1.415)), .38),
              'skin', corner=.035)
        p.box((x, y, .232), (.045, .17, .012), 'secondary')


def prop_waiting_bench(p):
    for x in (-.71, .71):
        p.box((x, .22, 0), (.13, .44, .48), 'secondary')
        p.box((x, .59, -.20), (.10, .64, .09), 'metal')
    for z in (-.16, 0, .16):
        p.box((0, .445, z), (1.76, .07, .15), 'secondary', ao=.10)
    for y in (.71, .88):
        p.box((0, y, -.20), (1.76, .14, .10), 'primary')


def prop_station_luggage(p):
    for x, y, width, height, depth, role in [
        (0, .22, 1.28, .44, .69, 'secondary'), (-.14, .62, .89, .36, .52, 'primary')
    ]:
        p.box((x, y, 0), (width, height, depth), role, corner=.06, bevel=.025)
        for side in (-1, 1):
            p.box((x + side * width * .32, y, 0), (.07, height + .008, depth + .012),
                  'metal', bevel=.016)
            p.box((x + side * width * .32, y + .05, depth/2), (.09, .09, .032), 'accent')
            p.box((x + side * .09, y, depth/2 + .037), (.03, .034, .074), 'metal')
        p.box((x, y, depth/2 + .073), (.22, .042, .034), 'secondary')


def prop_enamel_washstand(p):
    for x in (-.40, .40):
        for z in (-.24, .24):
            p.box((x, .43, z), (.085, .86, .085), 'secondary')
    p.box((0, .29, 0), (.85, .06, .50), 'secondary')
    p.box((0, .83, 0), (.94, .08, .59), 'secondary')
    p.lathe([(.17, .87), (.29, 1.00), (.30, 1.035), (.263, 1.035), (.14, .905)],
            12, 'skin', center=(-.09, 0, 0), cap_end=True)
    p.lathe([(.065, .87), (.083, 1.05), (.057, 1.15)], 8, 'metal',
            center=(.32, 0, -.09), cap_end=True)


def prop_pollard_willow(p):
    p.lathe([(.43, 0), (.29, .44), (.24, 1.48), (.40, 1.86), (.32, 2.04)],
            7, 'secondary', cap_start=True, cap_end=True)
    for x, z, height, spread in [(-.71, .21, 3.77, .78), (.60, .42, 3.95, .80),
                                  (.31, -.62, 4.17, .89), (-.23, -.04, 4.48, .73)]:
        p.prism((x * .23, 1.73, z * .23), (x, height - .66, z), .14, .08, 6, 'secondary')
        p.lathe([(spread * .37, height - 1.55), (spread, height - .84),
                 (spread * .83, height - .39), (spread * .32, height)],
                7, 'hair', center=(x, 0, z), cap_start=True, cap_end=True,
                ao=(height - 4) * .22)


def prop_shelter_gallery(p):
    # Each bay spans a clear floor. The arch starts above the bench backs.
    for bay in range(4):
        radius = 1.53 + .045 * (bay % 2)
        outline = [(radius, 0)]
        outline.extend((radius * math.cos(i * math.pi / 10),
                        1.10 + radius * math.sin(i * math.pi / 10)) for i in range(11))
        outline.append((-radius, 0))
        inner = [(1.37, 0)] + [(1.37 * math.cos(i * math.pi / 10),
                 1.10 + 1.37 * math.sin(i * math.pi / 10)) for i in range(11)] + [(-1.37, 0)]
        for i in range(len(inner) - 1):
            profile = [outline[i], outline[i+1], inner[i+1], inner[i]]
            p.loft([[V(x, y, z) for x, y in profile] for z in (-2 + bay, -1 + bay)],
                   'metal', cap_start=True, cap_end=True, ao=.05 * (bay % 2))


WW2_KIT_STATIC = [
    (prop_village_room, 'Plastered Village Room'),
    (prop_village_damaged_room, 'Weathered Village Room'),
    (prop_station_luggage, 'Leather Station Trunks'),
    (prop_village_door_wall, 'Timber Lintel Door Wall'),
    (prop_village_broken_wall, 'Broken Limewash Wall'),
    (prop_village_window_end, 'Village Casement End Wall'),
    (prop_village_broken_window_end, 'Broken Casement End Wall'),
    (prop_depot_landing, 'Goods Platform Landing'),
    (prop_village_slate_roof, 'Lift-Off Slate Roof'),
    (prop_goods_office_plinth, 'Goods Office Flagstone Floor'),
    (prop_porter_ramp, 'Porter Ramp with Handrails'),
    (prop_depot_siding, 'Village Goods Siding'),
    (prop_village_lane_tee, 'Village Lane T Junction'),
    (prop_village_verge, 'Village Grass Verge'),
    (prop_parcel_sorter, 'Parcel Sorting Shelves'),
    (prop_waiting_bench, 'Station Waiting Bench'),
    (prop_enamel_washstand, 'Enamel Basin Washstand'),
    (prop_pollard_willow, 'Pollarded Village Willow'),
    (prop_shelter_gallery, 'Civil Shelter Arch Bay'),
]
