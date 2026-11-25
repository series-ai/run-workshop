"""Village railway and rural freight props."""

import math

from polykit import V, X, Y, Z, ring
from props_level_common import door_unit, gable_roof, window_pane, wheel_pair


def roof(p, x, y, z, width, depth, rise, along='x'):
    gable_roof(p, x, y, z, width, depth, rise, 'metal', along=along)
    if along == 'x':
        p.box((x, y + rise, z), (width + 0.30, 0.11, 0.14), 'secondary')
    else:
        p.box((x, y + rise, z), (0.14, 0.11, depth + 0.30), 'secondary')


def shutter_pair(p, x, y, z, width, height):
    window_pane(p, V(x, y, z), Z, Y, width, height, 'secondary', 'eye')
    p.box((x, y, z + 0.055), (width, 0.07, 0.07), 'skin')
    for sign in (-1, 1):
        cx = x + sign * (width * 0.72 + 0.05)
        p.box((cx, y, z + 0.03), (width * 0.40, height + 0.08, 0.09), 'primary')
        for offset in (-0.32, 0.32):
            p.box((cx, y + height * offset, z + 0.084), (width * 0.36, 0.06, 0.04), 'secondary')


def chimney(p, x, y, z):
    p.box((x, y + 0.45, z), (0.43, 0.90, 0.50), 'secondary')
    p.box((x, y + 0.89, z), (0.54, 0.14, 0.61), 'skin')


def prop_village_station(p):
    p.box((0, 0.17, 0), (5.92, 0.34, 3.10), 'secondary', corner=0.08)
    p.box((-0.68, 1.64, -0.15), (4.30, 2.60, 2.48), 'skin', cap_start=False, cap_end=False)
    # Wide stone blocks support the plaster walls. The door splits the front course.
    p.box((-.68, .64, -1.39), (4.37, .60, .10), 'primary', cap_start=False)
    for x, width in ((-2.44, .86), (-1.58, .79), (.09, .70), (.97, .98)):
        p.box((x, .64, 1.125), (width, .56, .10), 'primary', taper=.97, cap_start=False)
    for x in (-2.85, 1.49):
        for z in (-.80, .49):
            p.box((x, .64, z), (.10, .56, 1.24), 'primary', taper=.97, cap_start=False)
    p.plate(V(-.68,1.75,-1.39), -Z,Y, 1.24,.70,.06, 'primary', shrink=.96)
    # Each slate course projects over the one below it.
    for bottom, top, foot, crown, shade in (
        (2.94, 3.29, 1.40, .90, -.12),
        (3.29, 3.62, .99, .47, .10),
        (3.62, 3.94, .55, .035, -.03),
    ):
        profile = ((bottom, -foot), (bottom, foot), (top, crown), (top, -crown))
        ends = [[V(x, y, -.15 + z) for y, z in profile] for x in (-2.995, 1.635)]
        p.loft(ends, 'metal', cap_start=True, cap_end=True, ao=shade, omitted_cells=((0, 2),))
    p.box((-.68, 3.94, -.15), (4.65, .11, .14), 'secondary')

    # Alternating widths show how the corner stones join the front and side walls.
    for x, side in ((-2.83, -1), (1.47, 1)):
        for y, width in ((1.15, .34), (1.65, .22), (2.15, .34), (2.65, .22)):
            p.box((x - side * (width / 2 - .035), y, .99),
                  (width, .46, .28), 'skin', ao=-.34)
    chimney(p, -2.23, 3.46, -0.49)
    p.plate(V(-.72, 1.35, 1.09), Z, Y, .99, 2.06, .06, 'secondary', shrink=1)
    p.plate(V(-.72, 1.33, 1.15), Z, Y, .85, 1.95, .018, 'primary', shrink=1)
    for x in (-2.10, 0.67):
        window_pane(p, V(x, 1.64, 1.10), Z, Y, .59, .94, 'secondary', 'eye')
        for offset in (-.48, .48):
            p.box((x + offset, 1.64, 1.13), (.24, 1.02, .09), 'primary')
        p.box((x, 1.10, 1.16), (1.27, .10, .24), 'skin', taper=.94, ao=.15)
    p.plate(V(-.72,1.78,1.174), Z,Y, .64,.77,.018,'eye',shrink=.94)
    p.box((2.12, 2.48, 0), (1.56, 0.17, 2.72), 'metal', up=V(0, 1, 0.09))
    for z in (-1.12, 1.12):
        top = 2.40 - 0.09 * z
        p.box((2.72, (top + 0.34) / 2, z), (0.11, top - 0.34, 0.11), 'secondary')
    # The sloped hood marks the entrance from the platform.
    p.box((-.72,2.54,1.27), (1.59,.12,.52), 'primary', up=V(0,1,.22))
    window_pane(p, V(-2.835, 1.67, -0.24), -X, Y, 0.95, 0.98)

    # The platform clock sits in a cross gable above the station door.
    p.box((-0.71, 3.25, 0.65), (1.25, 0.67, 1.10), 'skin')
    roof(p, -0.71, 3.57, 0.65, 1.27, 1.10, 0.56, along='z')
    # The clock rim clears the gable face. The dial sits inside the raised lip.
    clock = V(-.71,3.42,1.18)
    rings = ((.43,0), (.43,.21), (.37,.21), (.36,.18))
    sections = [ring(clock + Z * depth, X, Y, radius, radius, 12)
                for radius, depth in rings]
    p.loft(sections, 'secondary', band_regions=['secondary','metal','secondary'])
    p.face([p.vert(point) for point in sections[-1]], 'skin', toward=Z, ao=.28)
    for dx, dy in ((-.18,.12), (.12,.25)):
        p.prism(clock + Z*.188, clock + V(dx,dy,.188), .044,.024,4,'secondary',up=Z)


def prop_orchard_farmhouse(p):
    p.box((0, 0.23, 0), (3.78, 0.46, 2.88), 'secondary')
    p.box((0, 1.70, 0), (3.70, 2.84, 2.78), 'skin')
    roof(p, 0, 3.12, 0, 3.78, 2.84, 1.37)
    door_unit(p, (0.86, 0.06, 1.44), 0.88, 2.04)
    shutter_pair(p, -0.82, 1.62, 1.40, 0.84, 1.10)
    p.box((0.87, 2.26, 1.75), (1.52, 0.12, 0.96), 'metal', up=V(0, 1, 0.19))
    for x in (0.25, 1.48):
        p.box((x, 1.12, 2.12), (0.09, 2.24, 0.09), 'secondary')
    # Dormer rises through the front slope.
    p.box((-0.82, 3.53, 0.69), (1.14, 0.74, 1.04), 'skin')
    roof(p, -0.82, 3.90, 0.69, 1.16, 1.04, 0.55, along='z')
    window_pane(p, V(-0.82, 3.59, 1.22), Z, Y, 0.57, 0.47)
    chimney(p, 1.22, 4.05, -0.34)
    for side in (-1, 1):
        window_pane(p, V(side * 1.86, 1.67, 0), side * X, Y, 0.88, 1.02)


def prop_cart_barn(p):
    p.box((0, 1.28, 0), (3.40, 2.56, 3.60), 'primary')
    roof(p, 0, 2.56, 0, 3.46, 3.66, 1.28, along='z')
    for sign in (-1, 1):
        x = 0.60 * sign
        p.box((x, 1.08, 1.82), (1.16, 2.16, 0.12), 'secondary')
        p.prism((x - 0.48, 0.18, 1.91), (x + 0.48, 2.00, 1.91), 0.075, 0.075, 4, 'primary', up=Z)
        for h in (0.22, 1.89):
            p.box((x, h, 1.91), (1.07, 0.10, 0.08), 'primary')
    p.box((0, 2.94, 1.94), (0.72, 0.64, 0.10), 'secondary')
    p.box((0, 2.62, 1.99), (0.91, 0.10, 0.21), 'skin')
    for side in (-1, 1):
        for z in (-1.36, 0, 1.36):
            p.box((side * 1.70, 1.28, z), (0.11, 2.55, 0.11), 'secondary')


def prop_rail_platform(p):
    p.box((0, 0.22, 0), (4, 0.44, 1.66), 'secondary')
    for i in range(8):
        p.box(((i - 3.5) * 0.50, 0.47, 0), (0.484, 0.09, 1.70), 'skin', ao=(i % 3 - 1) * 0.04)
    for x in (-1.63, -0.55, 0.55, 1.63):
        p.box((x, 0.22, 0.84), (0.16, 0.41, 0.07), 'metal')


def prop_loading_steps(p):
    for i in range(4):
        h = (i + 1) * 0.128
        p.box((0, h / 2, i * 0.27), (1.35, h, 0.27), 'skin')
        p.box((0, h - 0.034, i * 0.27 - 0.13), (1.36, 0.06, 0.04), 'secondary')


def prop_station_canopy(p):
    for x in (-1.61, 1.61):
        p.box((x, 1.20, 0), (0.16, 2.40, 0.16), 'secondary')
        for sign in (-1, 1):
            p.prism((x, 1.73, 0), (x, 2.38, sign * 0.79), 0.065, 0.065, 4, 'secondary', up=X)
    roof(p, 0, 2.39, 0, 3.76, 1.80, 0.36)


def prop_signal_cabin(p):
    for x in (-0.84, 0.84):
        for z in (-0.67, 0.67):
            p.box((x, 0.61, z), (0.19, 1.22, 0.19), 'secondary')
    p.prism((-0.84, 0.12, 0.67), (0.84, 1.16, 0.67), 0.09, 0.09, 4, 'secondary', up=Z)
    p.box((0, 1.52, 0), (1.96, 0.73, 1.62), 'primary')
    p.box((0, 2.25, 0), (1.90, 0.76, 1.55), 'eye')
    for x in (-0.91, 0, 0.91):
        for z in (-0.77, 0.77):
            p.box((x, 2.23, z), (0.09, 0.80, 0.09), 'skin')
    roof(p, 0, 2.64, 0, 2, 1.70, 0.44)


def prop_depot_clock(p):
    p.box((0, 1.48, 0), (0.16, 2.96, 0.16), 'secondary')
    for sign in (-1, 1):
        p.prism((0, 2.68, 0), (0, 2.68, 0.15 * sign), 0.42, 0.42, 12, 'metal')
        p.prism((0, 2.68, 0.15 * sign), (0, 2.68, 0.17 * sign), 0.35, 0.35, 12, 'skin')
        p.box((0, 2.77, 0.18 * sign), (0.045, 0.21, 0.04), 'metal')
        p.prism((0, 2.68, 0.19 * sign), (-0.17, 2.64, 0.19 * sign), 0.026, 0.026, 4, 'metal')


def prop_weigh_scale(p):
    p.box((0, 0.10, 0), (1.20, 0.20, 0.90), 'metal', corner=0.07)
    p.box((0, 0.22, 0.09), (0.94, 0.09, 0.59), 'secondary')
    p.box((0, 0.76, -0.33), (0.12, 1.18, 0.12), 'primary')
    p.box((0, 1.38, -0.33), (0.86, 0.14, 0.14), 'metal')
    for x in (-0.27, 0.16):
        p.box((x, 1.39, -0.33), (0.12, 0.24, 0.23), 'accent')


def prop_milk_churns(p):
    for x, z, h in ((-0.26, 0.13, 0.82), (0.25, -0.12, 0.72)):
        p.lathe(
            [(0.21, 0), (0.24, 0.08), (0.24, h * 0.69), (0.16, h * 0.80), (0.16, h * 0.94), (0.20, h)],
            10,
            'metal',
            center=(x, 0, z),
            cap_start=True,
            cap_end=True,
        )
        p.lathe([(0.19, h), (0.15, h + 0.055)], 10, 'skin', center=(x, 0, z), cap_end=True)
        for sign in (-1, 1):
            p.tube(
                [V(x + sign * 0.19, h * 0.72, z), V(x + sign * 0.28, h * 0.78, z), V(x + sign * 0.22, h * 0.87, z)],
                [0.025] * 3,
                5,
                'secondary',
                up=Z,
            )


def prop_sack_barrow(p):
    wheel_pair(p, 0.35, 0.41, 0.23, 0.09, 'metal', 'secondary')
    p.box((0, 0.25, 0.23), (0.82, 0.09, 0.73), 'metal')
    for x in (-0.31, 0.31):
        p.prism((x, 0.06, 0.34), (x, 1.44, -0.37), 0.045, 0.045, 5, 'secondary')
    for y in (0.45, 0.82, 1.10):
        p.box((0, y, 0.34 - y * 0.50), (0.66, 0.10, 0.08), 'primary')
    p.box((0, 0.53, 0.19), (0.59, 0.51, 0.48), 'skin', corner=0.10, bevel=0.06, taper=0.84)


def prop_linen_bales(p):
    for x, y in ((-0.41, 0.35), (0.41, 0.35), (0, 1.03)):
        p.box((x, y, 0), (0.78, 0.70, 0.99), 'skin', corner=0.095, bevel=0.04)
        for z in (-0.31, 0.31):
            p.box((x, y, z), (0.80, 0.714, 0.07), 'secondary', bevel=0.032)


def prop_postal_sacks(p):
    for x, z, h in ((-0.27, 0.14, 0.68), (0.27, 0.12, 0.75), (0.0, -0.32, 0.56)):
        p.lathe(
            [(0.19, 0), (0.29, 0.12), (0.26, h * 0.62), (0.10, h * 0.86), (0.11, h * 0.93), (0.16, h)],
            7,
            'skin',
            center=(x, 0, z),
            scale_z=0.82,
            cap_start=True,
            cap_end=True,
        )
        p.lathe([(0.109, h * 0.84), (0.123, h * 0.92)], 7, 'secondary', center=(x, 0, z), scale_z=0.84)


def prop_spool_stand(p):
    for x in (-0.51, 0.51):
        p.box((x, 0.07, 0), (0.20, 0.14, 1.10), 'secondary')
        p.box((x, 0.36, 0), (0.12, 0.59, 0.23), 'primary')
        p.prism((x * 0.78, 0.61, 0), (x * 0.89, 0.61, 0), 0.53, 0.53, 12, 'primary')
    p.prism((-0.40, 0.61, 0), (0.40, 0.61, 0), 0.37, 0.37, 12, 'metal')
    for x in (-0.24, -0.08, 0.08, 0.24):
        p.prism((x, 0.61, 0), (x + 0.05, 0.61, 0), 0.385, 0.385, 12, 'secondary')


def prop_goods_trailer(p):
    wheel_pair(p, -0.16, 0.79, 0.38, 0.13, 'metal', 'primary')
    p.box((0, 0.69, 0), (1.60, 0.19, 2.44), 'secondary')
    for x in (-0.75, 0.75):
        for y in (0.89, 1.12):
            p.box((x, y, 0), (0.085, 0.16, 2.40), 'primary')
        for z in (-1.12, 0, 1.12):
            p.box((x, 0.98, z), (0.13, 0.60, 0.11), 'secondary')
        p.prism((x, 0.65, 1.10), (0, 0.47, 2.02), 0.07, 0.07, 4, 'metal')
    for z in (-1.15, 1.15):
        p.box((0, 0.98, z), (1.46, 0.41, 0.09), 'primary')
    # The parking leg and the flat tire faces share the ground plane.
    ground = .38 * (1 - math.cos(math.pi / 8))
    p.box((0, (.55 + ground) / 2, 1.60), (.09, .55 - ground, .09), 'metal')
    p.box((0, .55, 1.60), (.78, .08, .10), 'metal')


def prop_post_van(p):
    for z in (-1.15, 1.28):
        wheel_pair(p, z, .77, .38, .18, 'metal', 'skin')
    p.box((0, .66, 0), (1.62, .48, 3.73), 'primary', corner=.11)
    p.box((0, 1.34, -.78), (1.65, 1.42, 2.28), 'primary', corner=.11, bevel=.05)
    p.box((0, 1.31, .67), (1.53, 1.12, 1.15), 'primary', taper=.91)
    p.box((0, 1.59, 1.25), (1.29, .44, .06), 'eye')
    p.box((0, 1.02, 1.52), (1.29, .50, .87), 'primary', bevel=.06)
    p.box((0, .98, 1.95), (.73, .43, .08), 'metal')
    for i in range(5):
        p.box(((i - 2) * .13, .98, 2.00), (.045, .34, .04), 'skin')
    for sign in (-1, 1):
        p.box((sign * .74, 1.58, .65), (.05, .41, .79), 'eye')
        p.box((sign * .83, 1.39, -.81), (.045, .44, 1.34), 'skin')
        p.prism((sign * .60, 1.07, 1.84), (sign * .60, 1.07, 1.99), .14, .14, 8, 'accent')
    p.box((0, .60, 1.99), (1.68, .13, .15), 'metal')


def prop_checkpoint_board(p):
    for x in (-0.61, 0.61):
        p.box((x, 0.88, 0), (0.11, 1.76, 0.12), 'secondary')
    p.box((0, 1.37, 0), (1.48, 0.80, 0.09), 'skin')
    p.box((-0.44, 1.44, 0.06), (0.35, 0.36, 0.045), 'accent')
    for i in range(3):
        p.box((0.22, 1.57 - i * 0.14, 0.055), (0.64 - i * 0.09, 0.049, 0.03), 'metal')


def prop_inspection_desk(p):
    p.box((0, 0.96, 0), (1.47, 0.10, 0.76), 'secondary')
    for x in (-0.62, 0.62):
        for z in (-0.28, 0.28):
            p.box((x, 0.46, z), (0.10, 0.92, 0.10), 'primary')
    p.box((0.34, 0.77, 0), (0.52, 0.29, 0.61), 'primary')
    p.box((0.34, 0.79, 0.32), (0.20, 0.05, 0.04), 'metal')
    p.box((-0.31, 1.03, 0.04), (0.48, 0.046, 0.34), 'skin', right=V(1, 0, 0.17))


def prop_boundary_stone(p):
    p.box((0, 0.13, 0), (0.68, 0.26, 0.51), 'secondary')
    p.box((0, 0.53, 0), (0.53, 0.84, 0.35), 'skin', taper=0.87, corner=0.06)
    p.box((0, 0.96, 0), (0.46, 0.15, 0.31), 'primary', taper=0.76)
    for x in (-0.10, 0.05):
        p.box((x, 0.70, 0.175), (0.047, 0.20, 0.035), 'metal')


def prop_fingerpost(p):
    p.box((0, 1.14, 0), (0.15, 2.28, 0.15), 'secondary')
    for sign, y in ((-1, 1.89), (1, 2.17)):
        end = sign * 1.12
        outline = [
            V(0, y - 0.12, 0),
            V(end * 0.83, y - 0.12, 0),
            V(end, y, 0),
            V(end * 0.83, y + 0.12, 0),
            V(0, y + 0.12, 0),
        ]
        p.slab(outline, 0.10, 'skin', normal=Z, shrink=0.98, back=True)
        p.box((end * 0.47, y, 0.11), (0.51, 0.048, 0.027), 'metal')


def prop_orchard_gate(p):
    for x in (-1.33, 1.33):
        p.box((x, 0.64, 0), (0.22, 1.28, 0.24), 'secondary', taper=0.88)
    for y in (0.28, 0.65, 1.02):
        p.box((0, y, 0), (2.48, 0.13, 0.10), 'primary')
    for x in (-1.14, 1.14):
        p.box((x, 0.65, 0.02), (0.14, 0.94, 0.14), 'primary')
    p.prism((-1.11, 0.27, 0.10), (1.11, 1.03, 0.10), 0.08, 0.08, 4, 'secondary', up=Z)


def prop_field_drain(p):
    p.box((0, 0.08, 0), (1.78, 0.16, 1.45), 'secondary')
    for x in (-0.66, 0.66):
        p.box((x, 0.31, 0), (0.41, 0.46, 1.43), 'skin', taper=0.95)
    p.box((0, 0.60, 0), (1.80, 0.21, 1.52), 'skin', corner=0.07)
    for x in (-0.28, 0, 0.28):
        p.box((x, 0.32, 0.68), (0.06, 0.38, 0.06), 'metal')


def prop_goods_hatch(p):
    p.box((0, 1.24, 0), (3, 2.48, 0.31), 'skin')
    p.box((0, 1.28, 0.17), (2.50, 1.85, 0.09), 'secondary')
    for i in range(8):
        p.box(((i - 3.5) * 0.29, 1.28, 0.23), (0.275, 1.72, 0.07), 'primary')
    p.box((0, 2.26, 0.23), (2.76, 0.12, 0.16), 'metal')
    p.box((0, 0.36, 0.34), (2.70, 0.17, 0.66), 'secondary')
    for x in (-0.14, 0.14):
        p.box((x, 1.30, 0.29), (0.065, 0.27, 0.065), 'metal')


def prop_rural_wall(p):
    p.box((0, 0.56, 0), (3, 1.12, 0.36), 'skin')
    for row in range(3):
        for col in range(4):
            p.box(
                ((col - 1.5) * 0.72 + (0.11 if row % 2 else -0.06), 0.20 + row * 0.32, 0.18),
                (0.61, 0.235, 0.07),
                'skin',
                corner=0.05,
                ao=-0.11 if (col + row) % 3 == 0 else -0.045,
            )
    p.box((0, 1.15, 0), (3, 0.17, 0.46), 'metal', taper=0.85)


def prop_telegraph_pole(p):
    p.lathe([(0.16, 0), (0.12, 0.64), (0.088, 3.90)], 7, 'secondary', cap_end=True)
    for h in (3.24, 3.68):
        p.box((0, h, 0), (1.66, 0.13, 0.14), 'primary')
        for x in (-0.68, -0.35, 0.35, 0.68):
            p.lathe(
                [(0.07, h + 0.05), (0.07, h + 0.13), (0.095, h + 0.15), (0.075, h + 0.23)],
                6,
                'skin',
                center=(x, 0, 0),
                cap_end=True,
            )


WW2_DEPOT_STATIC = [
    (prop_village_station, 'Village Railway Station'),
    (prop_orchard_farmhouse, 'Orchard Dormer Farmhouse'),
    (prop_cart_barn, 'Gabled Cart Barn'),
    (prop_rail_platform, 'Stone Station Platform'),
    (prop_loading_steps, 'Platform Loading Steps'),
    (prop_station_canopy, 'Timber Platform Canopy'),
    (prop_signal_cabin, 'Raised Signal Cabin'),
    (prop_depot_clock, 'Railway Platform Clock'),
    (prop_weigh_scale, 'Freight Beam Scale'),
    (prop_milk_churns, 'Pair of Milk Churns'),
    (prop_sack_barrow, 'Porter Sack Barrow'),
    (prop_linen_bales, 'Bound Linen Bales'),
    (prop_postal_sacks, 'Tied Postal Sacks'),
    (prop_spool_stand, 'Cable Reel Stand'),
    (prop_goods_trailer, 'Farm Goods Trailer'),
    (prop_post_van, 'Village Post Van'),
    (prop_checkpoint_board, 'Checkpoint Notice Board'),
    (prop_inspection_desk, 'Inspection Clerk Desk'),
    (prop_boundary_stone, 'Village Boundary Stone'),
    (prop_fingerpost, 'Two Way Fingerpost'),
    (prop_orchard_gate, 'Orchard Field Gate'),
    (prop_field_drain, 'Stone Road Culvert'),
    (prop_goods_hatch, 'Goods Shed Loading Hatch'),
    (prop_rural_wall, 'Coursed Fieldstone Wall'),
    (prop_telegraph_pole, 'Ceramic Insulator Telegraph Pole'),
]
