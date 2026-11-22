"""Brick market street, shop fittings and pocket park."""

from polykit import V, X, Y, Z
from props_level_common import door_unit, gable_roof, window_pane


def awning(p, x, y, z, width, count=7):
    stripe = width / count
    for i in range(count):
        cx = x - width / 2 + (i + 0.5) * stripe
        role = 'accent' if i % 2 == 0 else 'skin'
        p.box((cx, y, z + 0.26), (stripe, 0.09, 0.6), role, up=V(0, 1, 0.32))
        p.box((cx, y - 0.14, z + 0.54), (stripe, 0.17, 0.05), role, taper=(0.9, 1))


def sash(p, x, y, z, width=0.8, height=1.12):
    window_pane(p, V(x, y, z), Z, Y, width, height, 'skin', 'eye')
    p.box((x, y + 0.15, z + 0.058), (width, 0.065, 0.045), 'skin')
    p.box((x, y - height / 2, z + 0.08), (width + 0.16, 0.10, 0.18), 'secondary')


def shop_shell(p, height, role):
    p.box((0, height / 2, 0), (4, height, 3.12), role)
    p.box((0, 0.17, 0), (4, 0.34, 3.18), 'secondary')
    p.box((0, height, 0), (4, 0.18, 3.30), 'skin')
    p.box((0, height + 0.15, 0), (4, 0.16, 3.18), 'secondary')
    door_unit(p, (-1.28, 0.04, 1.57), 0.84, 2.04, 'secondary', 'eye', 'metal')
    window_pane(p, V(0.53, 1.10, 1.57), Z, Y, 2.40, 1.42, 'secondary', 'eye')
    for x in (-0.04, 1.10):
        p.box((x, 1.10, 1.63), (0.08, 1.42, 0.09), 'metal')
    for side in (-1, 1):
        window_pane(p, V(side * 2, 1.14, 0.44), X * side, Y, 1.62, 1.30)


def prop_market_bakery(p):
    shop_shell(p, 4.90, 'primary')
    for x in (-1.20, 0, 1.20):
        sash(p, x, 3.65, 1.56)
    # Each canvas panel turns down over the front rail.
    for i, role in enumerate(('accent', 'skin', 'accent', 'skin', 'accent')):
        left = -1.91 + i * 0.764
        hem = [(2.59, 1.52, 2.55, 1.52), (2.58, 1.72, 2.54, 1.71),
               (2.31, 2.16, 2.30, 2.12), (2.15, 2.16, 2.15, 2.12)]
        rings = [[V(left, h, z), V(left + 0.764, h, z), V(left + 0.764, inner_h, inner_z),
                  V(left, inner_h, inner_z)] for h, z, inner_h, inner_z in hem]
        p.loft(rings, role, cap_start=True, cap_end=True, band_ao=[0.03, 0.10, -0.06])
    # A wheat loaf in relief identifies the bakery from the street.
    loaf = [(-0.64, 5.22), (0.64, 5.22), (0.70, 5.33), (0.52, 5.48),
            (0.25, 5.52), (-0.34, 5.52), (-0.60, 5.45), (-0.70, 5.33)]
    p.slab([V(x, h, 1.575) for x, h in loaf], 0.05, 'skin', normal=Z, shrink=0.93)
    for x in (-0.25, 0.04, 0.33):
        cut = [(x - 0.07, 5.32), (x - 0.02, 5.32), (x + 0.08, 5.46)]
        p.face([p.vert(V(u, v, 1.627)) for u, v in cut], 'primary', toward=Z)
    for z in (-0.78, 0.73):
        window_pane(p, V(2, 3.65, z), X, Y, 0.70, 1.09, 'skin', 'eye')
    # A raised parapet frames the shop entrance.
    p.box((0, 5.30, 1.42), (2.46, 0.56, 0.30), 'primary', taper=(0.78, 1))
    p.box((0, 5.65, 1.42), (2.02, 0.18, 0.38), 'skin')
    # A loaf on a projecting sign.
    p.box((1.75, 3.06, 2.02), (0.08, 0.09, 0.92), 'secondary')
    p.box((1.75, 2.78, 2.35), (0.14, 0.48, 0.82), 'accent', corner=0.05)
    p.box((1.75, 2.77, 2.35), (0.19, 0.21, 0.56), 'primary', bevel=0.06)


def prop_arcade_cinema(p):
    shop_shell(p, 3.84, 'accent')
    p.box((0, 2.40, 1.96), (3.64, 0.44, 1.15), 'skin', corner=0.20)
    for h in (2.21, 2.58):
        p.box((0, h, 1.96), (3.73, 0.07, 1.20), 'primary', corner=0.18)
    for i in range(5):
        x = (i - 2) * 0.31
        h = 1.48 - abs(i - 2) * 0.32
        p.box((x, 3.63 + h / 2, 1.46), (0.28, h, 0.38), 'skin' if i % 2 == 0 else 'primary')
    for x in (-1.40, 1.40):
        p.box((x, 3.19, 1.58), (0.43, 0.61, 0.1), 'secondary')
        p.box((x, 3.23, 1.65), (0.32, 0.38, 0.06), 'primary')

    # The marquee spells RIO with raised letters.
    for x0, y0, x1, y1 in (
        (-0.63, -0.12, -0.63, 0.12),
        (-0.63, 0.12, -0.43, 0.12),
        (-0.43, 0.12, -0.43, 0.01),
        (-0.43, 0.01, -0.63, 0.01),
        (-0.53, 0.01, -0.40, -0.12),
        (0, -0.12, 0, 0.12),
        (0.41, -0.12, 0.41, 0.12),
        (0.41, 0.12, 0.62, 0.12),
        (0.62, 0.12, 0.62, -0.12),
        (0.62, -0.12, 0.41, -0.12),
    ):
        p.prism((x0, 2.40 + y0, 2.54), (x1, 2.40 + y1, 2.54), 0.03, 0.03, 4, 'secondary', up=Z)
    p.box((1.81, 3.76, 1.91), (0.20, 1.70, 0.72), 'primary', corner=0.06)
    for y in (3.23, 3.52, 3.81, 4.10, 4.39):
        p.prism((1.685, y, 1.98), (1.935, y, 1.98), 0.075, 0.075, 6, 'skin')


def prop_row_flat(p):
    p.box((0, 2.56, 0), (4, 5.12, 3.12), 'primary')
    for h in (0.25, 2.68, 5.12):
        p.box((0, h, 0), (4, 0.22, 3.28), 'skin')
    door_unit(p, (-1.23, 0.36, 1.60), 0.91, 2.04)
    for i in range(3):
        p.box((-1.23, (3 - i) * 0.06, 1.67 + i * 0.22), (1.23, (3 - i) * 0.12, 0.25), 'metal')
    for x in (-1.22, 0, 1.22):
        sash(p, x, 3.91, 1.56)
    # The stone apron, sash, and copper cap follow the same three-sided bay.
    outline = [(-0.39, 1.54), (-0.03, 1.98), (1.39, 1.98), (1.75, 1.54)]
    p.loft([[V(x, h, z) for x, z in outline] for h in (0.54, 0.82, 0.91, 2.13, 2.22)],
           'skin', band_regions=['primary', 'secondary', 'skin', 'secondary'],
           cap_start=True, cap_end=True)
    for start, end in zip(outline, outline[1:]):
        sill = V(start[0], 0.99, start[1])
        span = V(end[0] - start[0], 0, end[1] - start[1])
        normal = span.cross(Y).normalized()
        for bottom, top, shade in ((0, 0.73, -0.12), (0.79, 1.06, 0.16)):
            corners = [sill + span * u + Y * h + normal * 0.008
                       for u, h in ((0.07, bottom), (0.93, bottom), (0.93, top), (0.07, top))]
            p.face([p.vert(point) for point in corners], 'eye', toward=normal, ao=shade)
    p.box((0.68, 2.30, 1.67), (2.16, 0.16, 0.80), 'secondary', corner=0.29)
    # Two courses of face brick sit between the heads and the cornice.
    for row in range(2):
        joints = (-1.94, -1.23, -0.42, 0.39, 1.20, 1.94) if row == 0 else (-1.94, -1.64, -0.83, 0, 0.83, 1.64, 1.94)
        for i, (left, right) in enumerate(zip(joints, joints[1:])):
            y = 4.59 + row * 0.20
            corners = [V(x, h, 1.564) for x, h in ((left+0.015, y), (right-0.015, y),
                       (right-0.015, y+0.175), (left+0.015, y+0.175))]
            p.face([p.vert(point) for point in corners], 'primary', toward=Z,
                   ao=(-0.14, -0.07, -0.20)[(i + row) % 3])
    p.box((1.32, 5.49, -0.98), (0.55, 0.74, 0.62), 'primary')
    p.box((1.32, 5.88, -0.98), (0.68, 0.14, 0.73), 'secondary')

    for z in (-0.81, 0.73):
        for y in (1.52, 3.89):
            window_pane(p, V(2, y, z), X, Y, 0.68, 1.04, 'skin', 'eye')
    gable_roof(p, -0.01, 5.19, 1.33, 2.04, 0.43, 0.51, 'skin', along='z', overhang=0.04)
    p.box((-0.01, 5.26, 1.58), (1.35, 0.10, 0.05), 'primary')


def prop_glasshouse(p):
    p.box((0, 0.24, 0), (2.50, 0.48, 2.8), 'primary')
    gable_roof(p, 0, 2.06, 0, 2.34, 2.66, 0.66, 'eye', along='z', overhang=0)
    for x in (-1.17, 1.17):
        for z in (-1.30, 0, 1.30):
            p.box((x, 1.13, z), (0.10, 1.78, 0.10), 'skin')
        p.box((x, 1.35, 0), (0.07, 1.48, 2.66), 'eye')
        p.box((x, 2.06, 0), (0.14, 0.12, 2.8), 'skin')
        p.box((x / 2, 2.39, 0), (1.4, 0.10, 2.85), 'metal', up=V(0.55 if x > 0 else -0.55, 1, 0))
    for z in (-1.32, 1.32):
        p.box((0, 1.21, z), (2.32, 1.66, 0.07), 'eye')
        for x in (-0.48, 0.48):
            p.box((x, 1.24, z), (0.07, 1.72, 0.13), 'skin')
    p.box((0, 2.76, 0), (0.14, 0.14, 2.90), 'skin')


def prop_flower_stall(p):
    p.box((0, 0.45, 0), (1.85, 0.90, 0.84), 'primary', corner=0.09)
    for x in (-0.83, 0.83):
        p.box((x, 1.48, -0.32), (0.08, 1.32, 0.08), 'secondary')
    awning(p, 0, 2.10, -0.41, 2.06, 5)
    for x in (-0.60, 0, 0.60):
        p.lathe([(0.14, 0.90), (0.21, 1.20)], 7, 'metal', center=(x, 0, 0), cap_end=True)
        for dx, dz in ((-0.09, 0), (0.08, 0.09), (0.04, -0.09)):
            p.prism((x, 1.17, 0), (x + dx, 1.46, dz), 0.02, 0.02, 4, 'hair')
            p.lathe(
                [(0.11, 1.43), (0.08, 1.52)], 6, 'accent' if dx < 0 else 'skin', center=(x + dx, 0, dz), cap_end=True
            )


def prop_park_pergola(p):
    for x in (-1.20, 1.20):
        for z in (-0.84, 0.84):
            p.box((x, 1.24, z), (0.16, 2.48, 0.16), 'primary')
            p.box((x, 0.17, z), (0.29, 0.34, 0.29), 'skin')
        p.box((x, 2.40, 0), (0.18, 0.20, 2.20), 'secondary')
    for z in (-1, -0.60, -0.20, 0.20, 0.60, 1):
        p.box((0, 2.55, z), (2.88, 0.16, 0.12), 'primary')


def prop_park_fountain(p):
    p.lathe([(0.98, 0), (1.04, 0.13), (1.02, 0.33), (0.91, 0.33), (0.82, 0.18)], 12, 'skin', cap_start=True)
    p.lathe([(0.86, 0.22)], 12, 'eye', cap_end=True)
    p.lathe(
        [(0.29, 0.19), (0.22, 0.43), (0.13, 0.70), (0.47, 0.83), (0.51, 0.94), (0.40, 0.93)], 10, 'metal', cap_end=True
    )
    p.lathe([(0.09, 0.91), (0.12, 1.16), (0.06, 1.32)], 7, 'eye', cap_end=True)


def prop_parasol_table(p):
    p.lathe([(0.37, 0), (0.30, 0.10), (0.06, 0.16), (0.05, 1.98)], 8, 'metal', cap_start=True)
    p.lathe([(0.62, 0.79), (0.62, 0.87)], 10, 'primary', cap_end=True, cap_start=True)
    p.lathe([(0.94, 1.88), (0.96, 1.98), (0.32, 2.26)], 10, 'accent', cap_start=True, tip_end=V(0, 2.36, 0))


def prop_book_return(p):
    p.box((0, 0.61, 0), (0.66, 1.22, 0.59), 'accent', corner=0.07)
    p.box((0, 1.25, 0), (0.73, 0.24, 0.66), 'metal', taper=0.9)
    p.box((0, 1.22, 0.33), (0.47, 0.09, 0.04), 'secondary')
    p.box((0, 0.59, 0.30), (0.47, 0.62, 0.04), 'skin')
    p.box((0.15, 0.79, 0.34), (0.07, 0.07, 0.04), 'metal')


def prop_ticket_meter(p):
    p.lathe([(0.20, 0), (0.18, 0.10), (0.07, 0.14), (0.07, 1.24)], 8, 'metal', cap_start=True)
    p.box((0, 1.46, 0), (0.37, 0.54, 0.25), 'accent', corner=0.055, bevel=0.025)
    p.plate(V(0, 1.54, 0.126), Z, Y, 0.26, 0.20, 0.02, 'eye')
    p.box((0, 1.33, 0.135), (0.15, 0.035, 0.025), 'skin')


def prop_patio_screen(p):
    for x in (-0.88, 0.88):
        p.box((x, 0.48, 0), (0.07, 0.96, 0.07), 'metal')
        p.box((x, 0.04, 0), (0.28, 0.08, 0.42), 'secondary')
    p.box((0, 0.52, 0), (1.76, 0.57, 0.06), 'accent')
    p.box((0, 0.85, 0), (1.84, 0.08, 0.09), 'metal')


def prop_storm_grate(p):
    p.box((0, 0.035, 0), (0.94, 0.07, 0.54), 'secondary')
    for i in range(8):
        p.box(((i - 3.5) * 0.115, 0.078, 0), (0.055, 0.035, 0.50), 'metal')
    for z in (-0.24, 0.24):
        p.box((0, 0.081, z), (0.94, 0.044, 0.05), 'metal')


def prop_tree_grille(p):
    for x in (-0.54, 0.54):
        p.box((x, 0.045, 0), (0.22, 0.09, 1.30), 'metal')
    for z in (-0.54, 0.54):
        p.box((0, 0.045, z), (0.86, 0.09, 0.22), 'metal')
    for x in (-0.34, -0.23, 0.23, 0.34):
        p.box((x, 0.045, 0), (0.055, 0.07, 0.92), 'secondary')


def prop_pedestrian_island(p):
    p.box((0, 0.10, 0), (1.08, 0.20, 2), 'skin', corner=0.32)
    for z in (-0.59, 0.59):
        p.lathe([(0.13, 0.20), (0.11, 0.32), (0.085, 0.99)], 8, 'accent', center=(0, 0, z), cap_end=True)
        p.lathe([(0.093, 0.75), (0.091, 0.86)], 8, 'skin', center=(0, 0, z))


def prop_bus_stop_flag(p):
    p.box((0, 1.19, 0), (0.09, 2.38, 0.09), 'metal')
    p.box((0.24, 2.18, 0), (0.59, 0.42, 0.10), 'accent', corner=0.03)
    p.box((0.24, 2.22, 0), (0.41, 0.15, 0.13), 'skin')
    p.box((0, 1.32, 0), (0.32, 0.53, 0.14), 'skin')
    for y in (1.19, 1.29, 1.39):
        p.box((0, y, 0.076), (0.22, 0.025, 0.018), 'metal')


def prop_picnic_set(p):
    for x in (-0.65, 0.65):
        for sign in (-1, 1):
            p.prism((x, 0.03, 0.55 * sign), (x, 0.79, -0.17 * sign), 0.075, 0.075, 4, 'secondary')
        p.box((x, 0.38, 0), (0.14, 0.12, 1.54), 'secondary')
    for z in (-0.27, 0, 0.27, -0.64, 0.64):
        p.box((0, 0.82 if abs(z) < 0.4 else 0.46, z), (1.92, 0.09, 0.25), 'primary')


def prop_park_trellis(p):
    for x in (-0.70, 0.70):
        p.box((x, 0.90, 0), (0.11, 1.80, 0.14), 'primary')
    for i in range(5):
        x = (i - 2) * 0.25
        p.box((x, 0.96, 0), (0.05, 1.42, 0.055), 'secondary')
    for y in (0.29, 0.60, 0.91, 1.22, 1.53, 1.77):
        p.box((0, y, 0.04), (1.48, 0.08, 0.08), 'primary')


def prop_bistro_menu(p):
    for sign in (-1, 1):
        up = V(0, 1, -0.30 * sign)
        p.box((0, 0.62, 0.18 * sign), (0.65, 1.24, 0.08), 'primary', up=up)
        p.box((0, 0.68, 0.22 * sign), (0.52, 0.84, 0.055), 'secondary', up=up)
        for i in range(3):
            p.box((-0.03, 0.86 - i * 0.15, (0.21 + i * 0.045) * sign), (0.35 - i * 0.04, 0.025, 0.05), 'skin', up=up)


def prop_magazine_rack(p):
    p.box((0, 0.07, 0), (0.77, 0.14, 0.65), 'secondary')
    p.box((0, 0.73, -0.24), (0.75, 1.32, 0.08), 'metal')
    for i in range(3):
        y = 0.25 + i * 0.38
        z = 0.14 - i * 0.12
        p.box((0, y, z), (0.80, 0.13, 0.36), 'metal')
        for j, role in enumerate(('accent', 'primary', 'skin')):
            p.box(((j - 1) * 0.24, y + 0.17, z), (0.215, 0.30, 0.08), role, up=V(0, 1, -0.19))


def prop_fruit_display(p):
    for x in (-0.63, 0.63):
        for z in (-0.26, 0.26):
            p.box((x, 0.34, z), (0.10, 0.68, 0.10), 'secondary')
    p.box((0, 0.72, 0), (1.48, 0.20, 0.70), 'primary')
    for i in range(5):
        for z in (-0.15, 0.15):
            p.lathe(
                [(0.10, 0.81), (0.136, 0.90), (0.088, 0.99)],
                7,
                'hair' if i < 2 else 'primary',
                center=((i - 2) * 0.26, 0, z),
                cap_end=True,
            )
    for z in (-0.32, 0.32):
        p.box((0, 0.85, z), (1.48, 0.15, 0.08), 'secondary')


def prop_shop_shutter(p):
    p.box((0, 1.16, 0), (2, 2.32, 0.22), 'secondary')
    for i in range(9):
        p.box((0, 0.16 + i * 0.24, 0.12), (1.81, 0.20, 0.07), 'metal', up=V(0, 1, 0.10))
    p.box((0, 2.34, 0), (2, 0.32, 0.44), 'accent', corner=0.065)


def prop_arcade_column(p):
    p.box((0, 0.18, 0), (0.63, 0.36, 0.62), 'secondary')
    p.box((0, 1.40, 0), (0.44, 2.40, 0.43), 'primary')
    for x in (-0.13, 0.13):
        p.box((x, 1.42, 0.22), (0.055, 2.08, 0.05), 'skin')
    p.box((0, 2.65, 0), (0.66, 0.26, 0.62), 'skin', taper=1.22)


def prop_shop_clock(p):
    p.box((0, 1.55, 0), (0.13, 3.10, 0.14), 'secondary')
    p.box((0, 0.20, 0), (0.36, 0.40, 0.36), 'metal', taper=0.77)
    for z in (-0.13, 0.13):
        p.prism((0, 2.73, 0), (0, 2.73, z), 0.41, 0.41, 12, 'secondary')
        p.prism((0, 2.73, z), (0, 2.73, z * 1.08), 0.35, 0.35, 12, 'skin')
        p.box((0, 2.83, z * 1.15), (0.037, 0.22, 0.035), 'secondary')
        p.prism((0, 2.73, z * 1.15), (0.16, 2.80, z * 1.15), 0.026, 0.026, 4, 'accent')


def prop_curb_ramp(p):
    p.box((0, 0.06, 0), (2, 0.12, 1.60), 'skin')
    p.box((0, 0.08, 0.77), (1.25, 0.055, 0.46), 'primary', up=V(0, 1, 0.21))
    for x in (-0.82, 0.82):
        p.box((x, 0.08, 0.80), (0.36, 0.16, 0.40), 'skin')
    for i in range(8):
        p.box(((i - 3.5) * 0.14, 0.119, 0.68), (0.07, 0.026, 0.14), 'metal', up=V(0, 1, 0.21))


def prop_park_drinking_font(p):
    p.lathe(
        [(0.26, 0), (0.26, 0.12), (0.14, 0.19), (0.14, 0.77), (0.31, 0.91), (0.32, 1.02), (0.23, 1.0)],
        10,
        'metal',
        cap_start=True,
        cap_end=True,
    )
    p.tube([V(0.16, 0.99, 0), V(0.16, 1.13, 0), V(0.06, 1.15, 0)], [0.039] * 3, 6, 'secondary', up=Z, cap_end=True)


SIM_MARKET_STATIC = [
    (prop_market_bakery, 'Loaf Sign Market Bakery'),
    (prop_arcade_cinema, 'Arcade Picture House'),
    (prop_row_flat, 'Bay Window Row Flat'),
    (prop_glasshouse, 'Park Glasshouse'),
    (prop_flower_stall, 'Striped Flower Stall'),
    (prop_park_pergola, 'Timber Walk Pergola'),
    (prop_park_fountain, 'Two Tier Park Fountain'),
    (prop_parasol_table, 'Parasol Cafe Table'),
    (prop_book_return, 'Library Return Box'),
    (prop_ticket_meter, 'Street Parking Meter'),
    (prop_patio_screen, 'Cafe Terrace Screen'),
    (prop_storm_grate, 'Curb Storm Grate'),
    (prop_tree_grille, 'Open Tree Grille'),
    (prop_pedestrian_island, 'Pedestrian Refuge Island'),
    (prop_bus_stop_flag, 'Bus Stop and Timetable'),
    (prop_picnic_set, 'Park Picnic Set'),
    (prop_park_trellis, 'Garden Trellis Panel'),
    (prop_bistro_menu, 'Folding Cafe Menu'),
    (prop_magazine_rack, 'Three Tier Magazine Rack'),
    (prop_fruit_display, 'Greengrocer Fruit Table'),
    (prop_shop_shutter, 'Closed Shop Shutter Bay'),
    (prop_arcade_column, 'Fluted Arcade Column'),
    (prop_shop_clock, 'Two Face Street Clock'),
    (prop_curb_ramp, 'Pedestrian Curb Ramp'),
    (prop_park_drinking_font, 'Park Drinking Fountain'),
]
