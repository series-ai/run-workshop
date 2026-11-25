"""Level-building world props for run-chisel-sim (26 static additions)."""

import math
from mathutils import Matrix

from props_sim_market import SIM_MARKET_STATIC

import polykit as pk
from polykit import X, Y, Z, V
from props_level_common import conifer_tree, door_unit, gable_roof, hip_roof, l_corner_wall, tile_base, wheel_pair, window_pane


# ---- Modular Roads, Sidewalks & Park Tiles ----------------------------------

def prop_road_straight(part):
    # Matches prop_road_crosswalk (height 0.090 curbs, 0.070 asphalt top)
    part.box(V(0, 0.035, 0), (2.00, 0.070, 2.00), 'secondary', ao=-0.12)
    for sz in (-0.94, 0.94):
        part.box(V(0, 0.045, sz), (2.00, 0.090, 0.12), 'metal', ao=-0.04)
    for x in (-0.54, 0.54):
        part.plate(V(x, 0.070, 0), Y, Z, 0.56, 0.10, 0.010, 'skin', shrink=0.95, ao=0.12)


def prop_road_corner(part):
    part.box(V(0, 0.035, 0), (2.00, 0.070, 2.00), 'secondary', ao=-0.12)
    part.box(V(0, 0.045, -0.94), (2.00, 0.090, 0.12), 'metal', ao=-0.04)
    part.box(V(-0.94, 0.045, 0), (0.12, 0.090, 2.00), 'metal', ao=-0.04)
    part.box(V(0.90, 0.045, 0.90), (0.20, 0.090, 0.20), 'metal', ao=-0.04)
    part.plate(V(-0.22, 0.070, -0.22), Y, Z, 0.44, 0.10, 0.010, 'skin', shrink=0.95, ao=0.12)


def prop_road_tsplit(part):
    part.box(V(0, 0.035, 0), (2.00, 0.070, 2.00), 'secondary', ao=-0.12)
    part.box(V(0, 0.045, -0.94), (2.00, 0.090, 0.12), 'metal', ao=-0.04)
    for sx in (-0.90, 0.90):
        part.box(V(sx, 0.045, 0.90), (0.20, 0.090, 0.20), 'metal', ao=-0.04)
    part.plate(V(-0.56, 0.070, -0.10), Y, Z, 0.52, 0.10, 0.010, 'skin', shrink=0.95, ao=0.12)
    part.plate(V(0.56, 0.070, -0.10), Y, Z, 0.52, 0.10, 0.010, 'skin', shrink=0.95, ao=0.12)


def prop_road_junction(part):
    part.box(V(0, 0.035, 0), (2.00, 0.070, 2.00), 'secondary', ao=-0.12)
    for sx in (-0.90, 0.90):
        for sz in (-0.90, 0.90):
            part.box(V(sx, 0.045, sz), (0.20, 0.090, 0.20), 'metal', ao=-0.04)


def prop_park_grass_tile(part):
    tile_base(part, 2.00, 2.00, 0.158, 'hair', ao=-0.02)
    for x, z in ((-0.48, -0.45), (0.52, 0.40)):
        part.plate(V(x, 0.152, z), Y, Z, 0.34, 0.28, 0.008, 'hair', shrink=0.75, ao=0.10)


def prop_sidewalk_corner(part):
    tile_base(part, 2.00, 2.00, 0.158, 'skin', ao=-0.04)
    part.box(V(0, 0.079, 0.92), (2.00, 0.158, 0.16), 'skin', ao=0.04)
    part.box(V(0.92, 0.079, 0), (0.16, 0.158, 2.00), 'skin', ao=0.04)
    part.plate(V(-0.08, 0.158, 0.92), Y, Z, 1.82, 0.10, 0.006, 'accent', ao=0.10)
    part.plate(V(0.92, 0.158, -0.08), Y, Z, 0.10, 1.82, 0.006, 'accent', ao=0.10)


# ---- Modular Storefronts, Brick Walls & Fence Corners -----------------------

def prop_shop_wall_door(part):
    part.box(V(0, 1.24, 0), (2.00, 2.48, 0.34), 'skin', bevel=0.015)
    part.box(V(0, 2.48, 0.02), (2.06, 0.14, 0.40), 'accent', bevel=0.01, ao=0.06)
    door_unit(part, (-0.36, 0, 0.16), 0.84, 2.08, 'secondary', 'eye', 'metal')
    window_pane(part, V(0.52, 1.28, 0.17), Z, Y, 0.56, 0.78, 'secondary', 'eye')


def prop_shop_wall_window(part):
    part.box(V(0, 1.24, 0), (2.00, 2.48, 0.34), 'skin', bevel=0.015)
    part.box(V(0, 2.48, 0.02), (2.06, 0.14, 0.40), 'accent', bevel=0.01, ao=0.06)
    window_pane(part, V(-0.46, 1.32, 0.17), Z, Y, 0.62, 0.86, 'secondary', 'eye')
    window_pane(part, V(0.46, 1.32, 0.17), Z, Y, 0.62, 0.86, 'secondary', 'eye')


def prop_shop_wall_upper(part):
    part.box(V(0, 0.86, 0), (2.00, 1.72, 0.34), 'primary', bevel=0.015)
    part.box(V(0, 1.78, 0.02), (2.08, 0.18, 0.42), 'secondary', bevel=0.01, ao=0.06)
    for sx in (-0.48, 0.48):
        window_pane(part, V(sx, 0.90, 0.17), Z, Y, 0.48, 0.66, 'skin', 'eye')


def prop_brick_wall(part):
    part.box(V(0, 0.54, 0), (2.00, 1.08, 0.26), 'primary', bevel=0.015)
    for sx in (-0.90, 0.90):
        part.box(V(sx, 0.60, 0), (0.28, 1.20, 0.34), 'secondary', bevel=0.015)
        part.box(V(sx, 1.22, 0), (0.34, 0.08, 0.40), 'skin', ao=0.06)


def prop_picket_fence_corner(part):
    l_corner_wall(part, 1.12, 0.96, 0.12, 'skin', cap_region='accent', ao=0.04)


# ---- Full City Buildings ----------------------------------------------------

def prop_corner_bistro(part):
    def shell(width, depth, cut, bottom, top, role, omitted_cells=()):
        outline = [(-width, -depth), (width, -depth), (width, depth - cut),
                   (width - cut, depth), (-width, depth)]
        rings = [[V(x, y, z) for x, z in outline] for y in (bottom, top)]
        part.loft(rings, role, cap_start=True, cap_end=True, omitted_cells=omitted_cells)

    def glass(center, face, width, height, depth):
        part.plate(center, face, Y, width, height, depth, 'eye', shrink=1)
        across = Y.cross(face) * width
        top = center + face * (depth + 0.002) + Y * (height / 2)
        corners = [top - across * 0.48, top + across * 0.48,
                   top + across * 0.48 - Y * (height * 0.18),
                   top - across * 0.48 - Y * (height * 0.44)]
        part.face([part.vert(point) for point in corners], 'metal', toward=face)

    # Leave the diagonal and front faces open for the door and display.
    shell(1.32, 1.08, 0.84, 0, 0.12, 'skin')
    shell(1.32, 1.08, 0.84, 0.12, 2.24, 'secondary', ((0, 2), (0, 3)))
    shell(1.32, 1.08, 0.84, 2.24, 2.63, 'primary')
    shell(1.41, 1.17, 0.96, 2.63, 2.78, 'skin')

    def recess(center, face, wall_width, width, bottom, top, depth, back_role, jamb=0):
        across = Y.cross(face)
        def rectangle(half_width, low, high, setback):
            return [center + across * x + Y * y - face * setback
                    for x, y in ((-half_width, low), (half_width, low),
                                 (half_width, high), (-half_width, high))]
        wall = rectangle(wall_width / 2, 0.12, 2.24, 0)
        lip = rectangle(width / 2, bottom, top, 0)
        back = rectangle(width / 2 - jamb, bottom + 0.025, top, depth)
        lining = ('skin', 'primary', 'secondary', 'primary')
        for i, inward in enumerate((Y, -across, -Y, across)):
            j = (i + 1) % 4
            part.face([part.vert(v) for v in (wall[i], wall[j], lip[j], lip[i])],
                      'secondary', toward=face)
            part.face([part.vert(v) for v in (lip[i], lip[j], back[j], back[i])],
                      lining[i], toward=inward, ao=-0.22)
        part.face([part.vert(v) for v in back], back_role, toward=face)

    normal = (X + Z).normalized()
    tangent = (X - Z).normalized()
    entry = V(0.90, 0, 0.66)
    recess(entry, normal, 0.84 * math.sqrt(2), 1.06, 0.14, 2.21, 0.52, 'secondary', jamb=0.10)
    door = entry - normal * 0.51 + Y * 1.18
    part.plate(door, normal, Y, 0.82, 2.02, 0.035, 'skin', shrink=1)
    glass(door + normal * 0.035, normal, 0.69, 1.83, 0.02)
    part.box(door + normal * 0.07 + tangent * 0.25, (0.07, 0.35, 0.09),
             'skin', right=tangent)

    # A counter and two loaves sit between the window frame and the warm back wall.
    recess(V(-0.42, 0, 1.08), Z, 1.80, 1.43, 0.42, 1.75, 0.32, 'primary')
    part.box(V(-0.42, 0.68, 0.90), (1.42, 0.13, 0.25), 'skin')
    for x in (-0.76, -0.28):
        part.box(V(x, 0.82, 0.91), (0.37, 0.15, 0.16), 'primary',
                 taper=(0.77, 0.66), corner=0.045, ao=0.10)
    part.box(V(-0.42, 1.44, 1.08), (1.44, 0.065, 0.06), 'metal')

    for center, face, width in ((V(1.32, 1.02, -0.64), X, 0.68),
                                (V(-1.32, 1.02, 0), -X, 1.78)):
        part.plate(center, face, Y, width, 1.52, 0.04, 'skin', shrink=1)
        glass(center + face * 0.04, face, width - 0.11, 1.39, 0.02)
        part.plate(center + face * 0.06 + Y * 0.40, face, Y, width - 0.11,
                   0.06, 0.015, 'metal', shrink=1)

    # Fold the canopy around the corner. The outer hem follows the same bend.
    seams = [(-1.28, 1.08, -1.28, 1.645), (-0.71, 1.08, -0.71, 1.645),
             (-0.14, 1.08, -0.14, 1.645), (0.48, 1.08, 0.69, 1.645),
             (0.90, 0.66, 1.05, 1.10), (1.32, 0.24, 1.41, 0.53)]
    ribs = [[V(x, 2.53, z), V(u, 2.31, v), V(u, 2.16, v), V(x, 2.37, z)]
            for x, z, u, v in seams]
    for i, (left, right) in enumerate(zip(ribs, ribs[1:])):
        part.loft([left, right], 'accent' if i % 2 == 0 else 'skin',
                  cap_start=i == 0, cap_end=i == len(ribs) - 2)

    # Put a cup and saucer on the raised corner sign.
    sign = V(0.89, 2.76, 0.65)
    part.box(sign, (1.22, 0.81, 0.16), 'secondary', right=tangent, corner=0.05)
    emblem = sign + normal * 0.10
    part.box(emblem - tangent * 0.05, (0.46, 0.24, 0.07), 'skin',
             right=tangent, taper=(1.45, 1))
    part.plate(emblem + tangent * 0.29 + Y * 0.055, normal, Y, 0.23, 0.16,
               0.025, 'skin', corner=0.04, shrink=1)
    part.plate(emblem + tangent * 0.30 + Y * 0.06 + normal * 0.025, normal,
               Y, 0.11, 0.07, 0.008, 'secondary', shrink=1)
    part.box(emblem - Y * 0.18, (0.77, 0.07, 0.08), 'skin', right=tangent)


def prop_suburban_house(part):
    part.box(V(0, 1.15, 0), (2.68, 2.30, 2.24), 'skin', bevel=0.02)
    gable_roof(part, 0, 2.30, 0, 2.72, 2.28, 0.56, 'primary', overhang=0.14, along='x', ao=0.06)
    part.box(V(-0.82, 2.32, -0.45), (0.34, 1.04, 0.34), 'secondary')
    # Front porch canopy
    part.box(V(-0.36, 0.10, 1.28), (1.16, 0.20, 0.56), 'secondary', bevel=0.01)
    door_unit(part, (-0.36, 0.20, 1.12), 0.84, 2.04, 'secondary', 'accent', 'metal')
    window_pane(part, V(0.68, 1.08, 1.13), Z, Y, 0.54, 0.54, 'secondary', 'eye')


def prop_apartment_block(part):
    part.box(V(0, 1.82, 0), (2.68, 3.64, 2.24), 'primary', bevel=0.02)
    part.box(V(0, 3.72, 0), (2.82, 0.22, 2.38), 'secondary', bevel=0.02, ao=0.06)
    door_unit(part, (0, 0, 1.12), 0.84, 2.08, 'metal', 'eye', 'metal')
    for y in (1.76, 2.86):
        for sx in (-0.84, 0.84):
            window_pane(part, V(sx, y, 1.13), Z, Y, 0.58, 0.58, 'skin', 'eye')
    part.box(V(0.56, 3.96, -0.35), (0.68, 0.34, 0.68), 'metal', bevel=0.015)


    for x, y, width in ((-0.84, 1.49, 0.70), (0.84, 1.49, 0.70), (0, 2.59, 2.42)):
        part.box((x, y, 1.35), (width, 0.11, 0.48), 'secondary')
        part.box((x, y + 0.33, 1.55), (width, 0.065, 0.07), 'metal')
        for offset in (-0.46, 0, 0.46):
            part.box((x + offset * width, y + 0.17, 1.55), (0.055, 0.32, 0.055), 'metal')
    for side in (-1,1):
        window_pane(part,V(side*1.34,2.62,-.22),X*side,Y,.76,.70,'skin','eye')


def prop_convenience_store(part):
    part.box(V(0, 1.16, 0), (2.66, 2.32, 2.12), 'skin', bevel=0.02)
    part.box(V(0, 2.38, 0), (2.80, 0.20, 2.26), 'accent', bevel=0.02, ao=0.06)
    part.box(V(0, 2.66, 0.92), (1.84, 0.38, 0.16), 'accent', bevel=0.01, ao=0.14)
    door_unit(part, (-0.56, 0, 1.06), 0.86, 2.08, 'metal', 'eye', 'metal')
    window_pane(part, V(0.54, 1.08, 1.07), Z, Y, 0.88, 0.84, 'metal', 'eye')


def prop_park_gazebo(part):
    part.lathe([(1.18, 0.0), (1.20, 0.18)], 8, 'skin', cap_start=True, cap_end=True, ao=-0.04)
    for i in range(6):
        ang = math.radians(i * 60.0 + 30.0)
        part.box(V(math.cos(ang) * 0.96, 1.18, math.sin(ang) * 0.96), (0.10, 2.00, 0.10), 'skin')
    part.lathe([(1.28, 2.18), (0.72, 2.43)], 8, 'accent', cap_start=True, tip_end=V(0, 2.62, 0), ao=0.08)


# ---- City Vehicles ----------------------------------------------------------

def _city_car(part, paint):
    # The lower door panels enclose the footwell between the two axles.
    part.box((0, .12, 0), (1.60, .08, 3.54), 'secondary')
    for side in (-1, 1):
        part.box((side * .82, .49, -.06), (.08, .70, 2.18), paint)
    part.box((0, .57, 1.48), (1.72, .54, .94), paint, bevel=.05)
    part.box((0, .57, -1.49), (1.72, .54, .88), paint, bevel=.05)
    cabin = [pk.rect_ring(V(0, y, z), X, Z, w, d, .08)
             for y, z, w, d in ((.84, -.06, .86, 1.12), (1.55, -.17, .71, .78))]
    part.loft(cabin, 'eye', ao=.12)
    part.box((0, 1.57, -.17), (1.42, .04, 1.56), paint, corner=.08)
    for side in (-1, 1):
        part.prism(V(side*.86, .84, -.22), V(side*.71, 1.55, -.22),
                   .045, .045, 4, paint)
        part.box((side*.40, .37, -.12), (.48, .42, .48), 'secondary')
        part.box((side*.40, .81, -.35), (.48, .48, .08), 'secondary')
    part.plate(V(0, .60, 1.952), Z, Y, 1.26, .15, .012, 'skin')
    for axle in (-1.25, 1.25):
        wheel_pair(part, axle, .795, .34, .18)


def prop_city_sedan(part):
    _city_car(part, 'accent')


def prop_city_taxi(part):
    _city_car(part, 'primary')
    part.box((0, 1.63, -.17), (.54, .08, .29), 'skin', bevel=.02, ao=.14)


def prop_delivery_van(part):
    part.box((0, .20, 0), (1.68, .10, 3.60), 'secondary')
    part.box((0, 1.31, -.74), (1.80, 1.52, 2.32), 'skin', bevel=.06)
    for side in (-1, 1):
        part.plate(V(side*.90, 1.29, -.74), X*side, Y, 1.72, .43, .012, 'accent')
        part.box((side*.84, .76, .92), (.10, .72, 1.03), 'skin')
    part.box((0, .70, 1.71), (1.78, .82, .42), 'skin', bevel=.04)
    cab = [pk.rect_ring(V(0, y, z), X, Z, w, d, .04)
           for y,z,w,d in ((1.11,.94,.89,.54), (1.97,.80,.82,.40))]
    part.loft(cab, 'eye', ao=.16)
    part.box((0, 2.01, .80), (1.64, .08, .80), 'skin', corner=.04)
    part.box((-.42, .52, .78), (.50, .54, .48), 'secondary')
    part.box((-.42, 1.01, .54), (.50, .47, .08), 'secondary')
    part.box((0,.40,-.74), (1.50,.30,2.30), 'secondary')
    for axle in (-1.21, 1.24):
        wheel_pair(part, axle, .81, .36, .19)


def prop_bicycle_rack(part):
    part.box(V(0, 0.04, 0), (1.32, 0.08, 0.58), 'metal', ao=-0.04)
    for x in (-0.42, 0.0, 0.42):
        part.box(V(x, 0.34, 0), (0.06, 0.54, 0.46), 'metal')
    # Parked commuter bike
    part.box(V(-0.22, 0.46, 0), (0.05, 0.06, 0.76), 'accent')
    part.box(V(-0.22, 0.68, 0.32), (0.32, 0.05, 0.06), 'secondary')


# ---- Urban & Park Props -----------------------------------------------------

def prop_fire_hydrant(part):
    part.lathe([(0.16, 0.0), (0.14, 0.12), (0.11, 0.56), (0.15, 0.62)], 8, 'accent', cap_start=True, tip_end=V(0, 0.76, 0), ao=0.06)
    part.box(V(0, 0.44, 0), (0.38, 0.10, 0.10), 'metal')


def prop_cafe_chair(part):
    part.box(V(0, 0.44, 0), (0.46, 0.06, 0.46), 'primary', bevel=0.01, ao=0.04)
    part.box(V(0, 0.66, -0.20), (0.44, 0.40, 0.06), 'primary', bevel=0.01)
    for sx in (-0.18, 0.18):
        for sz in (-0.18, 0.18):
            part.box(V(sx, 0.22, sz), (0.06, 0.44, 0.06), 'secondary')


def prop_flower_bed(part):
    part.box(V(0, 0.18, 0), (1.42, 0.36, 0.68), 'primary', bevel=0.02)
    part.box(V(0, 0.34, 0), (1.26, 0.08, 0.54), 'hair', ao=0.04)
    for x, z in ((-0.42, 0.08), (-0.10, -0.10), (0.22, 0.10), (0.46, -0.06)):
        part.box(V(x, 0.44, z), (0.16, 0.12, 0.16), 'accent', ao=0.14)


def prop_park_slide(part):
    part.box(V(-0.62, 0.68, 0), (0.56, 1.36, 0.72), 'accent', bevel=0.02)
    with part.placed(Matrix.Translation(V(0.28, 0.68, 0)) @ Matrix.Rotation(math.radians(-32), 4, 'Z')):
        part.box(V(0, 0, 0), (1.48, 0.12, 0.56), 'primary', bevel=0.015, ao=0.06)


def prop_pine_urban_tree(part):
    conifer_tree(part, radius=0.68, height=2.85, trunk_region='secondary', foliage_region='hair')


def prop_newsstand(part):
    part.box(V(0, 0.80, 0), (1.12, 1.60, 0.72), 'secondary', bevel=0.02)
    part.box(V(0, 1.56, 0.06), (1.22, 0.14, 0.88), 'accent', bevel=0.015, ao=0.06)
    part.plate(V(0, 0.92, 0.37), Z, Y, 0.84, 0.64, 0.04, 'skin', ao=0.10)


def prop_city_bus(part):
    with part.placed(Matrix.Diagonal((1.58, 1.64, 1.66, 1.0))):
        # The glass belt follows the rake of the windscreen at both ends.
        sections = [
            (.56, .61, 1.57), (.65, .65, 1.635), (.86, .65, 1.635),
            (.90, .65, 1.635), (1.40, .65, 1.53), (1.52, .65, 1.51),
            (1.59, .59, 1.45),
        ]
        rings = [pk.rect_ring(V(0, y, 0), X, Z, w, length, .14) for y, w, length in sections]
        # Leave the curb side open between the sill and the header.
        part.loft(rings, 'skin', cap_end=True,
                  omitted_cells={(row, 1) for row in range(5)},
                  band_regions=['primary', 'skin', 'accent', 'secondary', 'skin', 'skin'])
        wheel_pair(part, -.96, .60, .28, .16)
        wheel_pair(part, .88, .60, .28, .16)
        part.box((0, .29, 0), (1.30, .08, 3.00), 'secondary')
        part.box((.64, .167, 0), (.13, .038, .72), 'metal')

        # The folded door rests against the forward jamb.
        part.box((.52, .925, .378), (.26, 1.19, .032), 'metal')

        def panel(points, normal, region, ao=0):
            part.face([part.vert(V(*point)) for point in points], region, toward=normal, ao=ao)

        # Join the nose to the bumper and wrap each corner to the wheel skirt.
        panel([(-.47, .33, 1.50), (.47, .33, 1.50), (.47, .56, 1.57), (-.47, .56, 1.57)], Z, 'primary')
        for side in (-1, 1):
            panel([(side*.47, .33, 1.50), (side*.651, .32, 1.47),
                   (side*.61, .56, 1.43), (side*.47, .56, 1.57)], V(side, 0, 1), 'primary', -.06)

        panel([(.42,.945,.361), (.62,.945,.361), (.62,1.435,.361), (.42,1.435,.361)], -Z, 'eye')

        # Restore the curb-side shell on either side of the opening.
        for row, region in enumerate(('primary', 'skin', 'accent', 'secondary', 'skin')):
            lower, upper = rings[row:row+2]
            for end in (1, 2):
                sign = -1 if end == 1 else 1
                p, q = lower[end], upper[end]
                panel([p, (p.x, p.y, sign*.36), (q.x, q.y, sign*.36), q], X, region)
        panel([(-.64,.33,-1.46), (-.64,1.52,-1.46), (-.64,1.52,1.46), (-.64,.33,1.46)],
              X, 'secondary', -.12)
        panel([(-.64,1.52,-1.45), (.65,1.52,-1.45), (.65,1.52,1.45), (-.64,1.52,1.45)],
              -Y, 'skin')
        for z in (-.90, .88):
            part.box((-.34,.4925,z), (.55,.325,.32), 'secondary')
            part.box((-.34,.81,z-.14), (.55,.34,.05), 'primary')

        for side in (-1, 1):
            x = side * .651
            # Each pair of stations forms one skirt panel below the waist rail.
            arch = [(-1.47, .32), (-1.36, .32), (-1.26, .52), (-1.10, .64),
                    (-.82, .64), (-.66, .52), (-.56, .32), (.48, .32),
                    (.58, .52), (.74, .64), (1.02, .64), (1.18, .52),
                    (1.28, .32), (1.47, .32)]
            for (a, ya), (b, yb) in zip(arch, arch[1:]):
                if side == 1 and a < -.36 and b > .36:
                    panel([(x, ya, a), (x, ya, -.36), (x,.67,-.36), (x,.67,a)], X, 'primary')
                    a = .36
                panel([(x, ya, a), (x, yb, b), (x, .67, b), (x, .67, a)], X * side, 'primary')
            # A dark liner fills the space between each tire and the cut skirt.
            for start in (1, 7):
                outline = arch[start:start + 6]
                liner_x = side * .646
                panel([(liner_x, height, z) for z, height in outline],
                      X * side, 'secondary', -.28)
            windows = [(-1.36, -.91), (-.86, -.41), (.41, .86), (.91, 1.34)]
            for a, b in windows:
                panel([(x, .94, a), (x, .94, b), (x, 1.36, b-.018), (x, 1.36, a+.018)],
                      X * side, 'eye', .14)

            # The center seal and outer seals share a continuous dark backing.
            if side < 0:
                face = X * side
                part.plate(V(x, .85, 0), face, Y, .80, 1.06, .007,
                           'secondary', shrink=1, ao=-.26)
                for z in (-.185, .185):
                    part.plate(V(side*.660, .85, z), face, Y, .29, .98, .006,
                               'metal', shrink=1, ao=-.12)
                    part.plate(V(side*.668, 1.055, z), face, Y, .23, .49, .004,
                               'eye', shrink=1)
            # The rear glass sits above the engine cover.
            panel([(side*u, y, -(1.638 - .21*(y-.90))) for u, y in
                   ((.015,1.04),(.46,1.04),(.46,1.34),(.015,1.34))], -Z, 'eye')
            part.plate(V(side*.44, .75, -1.635), -Z, Y, .10, .14, .008, 'accent')
        # A single windscreen tapers below the destination board.
        panel([(u, y, 1.640 - .21*(y-.90)) for u, y in
               ((-.49,.925),(.49,.925),(.525,1.385),(-.525,1.385))], Z, 'eye', .17)
        panel([(-.525, .673, 1.637), (.525, .673, 1.637),
               (.525, .843, 1.637), (-.525, .843, 1.637)], Z, 'secondary', -.16)
        for y in (.732, .775):
            panel([(-.265, y, 1.640), (.265, y, 1.640),
                   (.265, y+.014, 1.640), (-.265, y+.014, 1.640)], Z, 'metal', -.26)
        for x in (-.40, .40):
            part.plate(V(x, .775, 1.641), Z, Y, .18, .077, .004, 'skin', shrink=.96)
        part.plate(V(0, 1.457, 1.529), Z, Y, .90, .112, .011, 'secondary', shrink=.98)
        for x, width in ((-.30,.10),(.07,.40)):
            part.plate(V(x, 1.457, 1.541), Z, Y, width, .041, .002, 'skin')
        part.box((0, 1.618, -.42), (.72, .078, 1.03), 'skin', corner=.08)


SIM_LEVEL_STATIC = [
    *SIM_MARKET_STATIC,
    (prop_road_straight, 'Asphalt Straight Road'),
    (prop_road_corner, 'Asphalt Corner Road'),
    (prop_road_tsplit, 'Asphalt T-Intersection'),
    (prop_road_junction, 'Asphalt 4-Way Junction'),
    (prop_park_grass_tile, 'Manicured Park Lawn Tile'),
    (prop_sidewalk_corner, 'Corner Sidewalk Curb Tile'),
    (prop_shop_wall_door, 'Modular Shop Wall & Door'),
    (prop_shop_wall_window, 'Modular Shop Display Wall'),
    (prop_shop_wall_upper, 'Modular Upper Story Facade'),
    (prop_brick_wall, 'Urban Brick Perimeter Wall'),
    (prop_picket_fence_corner, 'Picket Fence Corner'),
    (prop_corner_bistro, 'Corner Cafe Bistro Building'),
    (prop_suburban_house, 'Suburban Gabled House'),
    (prop_apartment_block, '3-Story Apartment Block'),
    (prop_convenience_store, 'Corner Convenience Store'),
    (prop_park_gazebo, 'Octagonal Park Gazebo'),
    (prop_city_sedan, 'Commuter City Sedan'),
    (prop_city_taxi, 'Downtown Yellow Taxi'),
    (prop_delivery_van, 'Urban Delivery Van'),
    (prop_city_bus, 'Metro Transit City Bus'),
    (prop_bicycle_rack, 'Commuter Bicycle Rack'),
    (prop_fire_hydrant, 'Street Fire Hydrant'),
    (prop_cafe_chair, 'Bistro Patio Chair'),
    (prop_flower_bed, 'Boxed Street Flower Bed'),
    (prop_park_slide, 'Playground Slide'),
    (prop_pine_urban_tree, 'Park Conifer Tree'),
    (prop_newsstand, 'Corner Newsstand Kiosk'),
]

SIM_LEVEL_ANIMATED = []
