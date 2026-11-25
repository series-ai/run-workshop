"""Street fixtures and modular buildings for the Lantern Exchange district."""

from math import pi

from mathutils import Matrix
from polykit import V, X, Y, Z, load_json, rect_ring


LANTERN_STAMP = load_json('lantern-exchange.json')['stamp']


def box(p, center, size, role, **shape):
    p.box(V(*center), size, role, **shape)


def spindle(p, x, z, profile, role, sides=8):
    p.lathe(profile, sides, role, center=(x, 0, z), cap_start=True, cap_end=True)


def rod(p, start, end, radius, role, sides=6):
    axis = (V(*end) - V(*start)).normalized()
    p.prism(start, end, radius, radius, sides, role, up=Z if abs(axis.y) > 0.9 else Y)


def grille(p, x, y, z, width, height, count):
    box(p, (x, y, z), (width, height, 0.05), 'secondary')
    for i in range(count):
        level = y + height * ((i + 0.5) / count - 0.5)
        box(
            p,
            (x, level, z + 0.04),
            (width * 0.89, height * 0.48 / count, 0.06),
            'metal',
        )


def lantern(p, x, y, z, r):
    spindle(
        p,
        x,
        z,
        [(r * 0.55, y), (r, y + r * 0.52), (r, y + r * 1.45), (r * 0.55, y + 2 * r)],
        'accent',
    )
    for h in (0, 1.93):
        spindle(
            p, x, z, [(r * 0.59, y + r * h), (r * 0.59, y + r * (h + 0.13))], 'metal'
        )
    box(p, (x, y + r, z + r * 0.94), (r * 0.28, r * 0.85, 0.025), 'eye')


def bowl(p, x, y, z, r):
    spindle(
        p, x, z, [(r * 0.46, y), (r, y + r * 0.65), (r * 0.94, y + r * 0.72)], 'skin'
    )
    spindle(p, x, z, [(r * 0.84, y + r * 0.72), (r * 0.78, y + r * 0.77)], 'hair')


def inset(p, x, y, z, width, height, fill, rim='metal', seal=0.06):
    """Fold a cut-corner rim back to a recessed face."""
    center = V(x, y, z)
    cut = min(width, height) * 0.17
    outer = rect_ring(center, X, Y, width / 2, height / 2, cut)
    lip = rect_ring(center + Z * 0.04, X, Y, width / 2 - seal / 2,
                    height / 2 - seal / 2, cut * 0.85)
    inner = rect_ring(center + Z * 0.019, X, Y, width / 2 - seal,
                      height / 2 - seal, cut * 0.70)
    p.loft([outer, lip, inner], rim, band_regions=[rim, 'secondary'], toward=Z)
    p.face([p.vert(point) for point in inner], fill, toward=Z)


def exchange_stamp(p, x, y, z, size):
    """The stamp has two paper folds, a cap, and a tassel."""
    for outline in LANTERN_STAMP:
        p.face([p.vert(V(x + u * size, y + v * size, z)) for u, v in outline],
               'hair', toward=Z)


def paper_lamp(p, x, top, z, radius):
    profile = [(0.25, -2.00), (0.88, -1.50), (1, -0.87),
               (0.90, -0.51), (0.54, -0.29), (0.19, -0.20), (0.19, 0)]
    p.lathe([(r * radius, top + h * radius) for r, h in profile], 6, 'accent',
            center=(x, 0, z), cap_start=True,
            band_regions=['hair', 'accent', 'skin', 'accent', 'hair', 'metal'])


def folded_roof(p, sections, rear, front, thickness):
    """Fold one roof sheet across sections at different heights."""
    rings = [[V(x, h, rear), V(x, h - thickness, rear),
              V(x, h - thickness - 0.06, front), V(x, h - 0.06, front)]
             for x, h in sections]
    p.loft(rings, 'primary', cap_start=True, cap_end=True,
           omitted_cells=[(row, 2) for row in range(len(rings) - 1)])
    for left, right in zip(rings, rings[1:]):
        p.face([p.vert(point) for point in
                (left[2], right[2], right[3], left[3])], 'accent', toward=Z)


def window_strip(p, x, z, y, width, height, normal, panes):
    """Fit panes and a narrow sill in a common factory sash."""
    right = Y.cross(normal)
    origin = V(x, y, z)

    def sheet(cx, cy, w, h, offset, role):
        center = origin + right * cx + Y * cy + normal * offset
        p.face([p.vert(point) for point in rect_ring(center, right, Y, w / 2, h / 2)],
               role, toward=normal)

    sheet(0, 0, width, height, 0.002, 'secondary')
    pitch = (width - 0.11) / panes
    for i in range(panes):
        sheet((i + 0.5 - panes / 2) * pitch, 0.015, pitch - 0.055, height - 0.14,
              0.006, 'skin' if i == panes - 1 else 'hair')
    sheet(0, -height / 2, width, 0.043, 0.012, 'metal')


def prop_lantern_noodle_bar(p):
    box(p, (0, 0.09, -0.02), (2.49, 0.18, 1.05), 'secondary', cap_end=False)
    box(p, (0, 0.51, -0.02), (2.61, 0.72, 1.14), 'primary', corner=0.14, cap_end=False)
    counter = [(0.85, 1.34, 0.65), (0.908, 1.34, 0.65),
               (0.924, 1.40, 0.73), (0.96, 1.40, 0.73)]
    p.loft([rect_ring(V(0, h, 0.01), X, Z, w, d, 0.12) for h, w, d in counter],
           'metal', band_regions=['secondary', 'secondary', 'metal'], cap_start=True, cap_end=True)
    p.face([p.vert(v) for v in rect_ring(V(0.29, 0.51, 0.553), X, Y, 0.90, 0.31)],
           'secondary', toward=Z)
    for x, pull in ((-0.14, 0.12), (0.72, 0.46)):
        p.plate(V(x, 0.51, 0.554), Z, Y, 0.82, 0.55, 0.023, 'primary', shrink=0.94)
        box(p, (pull, 0.705, 0.591), (0.14, 0.031, 0.043), 'metal')
    for y in (0.39, 0.49, 0.59):
        p.face([p.vert(v) for v in rect_ring(V(-0.85, y, 0.552), X, Y, 0.20, 0.021)],
               'secondary', toward=Z)
    for x, h in ((-1.19, 2.36), (1.15, 2.26)):
        box(p, (x, (h + 0.96) / 2, -0.52), (0.12, h - 0.96, 0.14), 'hair',
            cap_start=False)
        rod(p, (x, h - 0.47, -0.51), (x, h - 0.034, 0.655), 0.037, 'metal', 4)
    folded_roof(p, [(-1.43, 2.41), (-0.52, 2.41), (-0.29, 2.30),
                    (0.50, 2.277), (1.43, 2.32)], -0.78, 0.78, 0.038)
    paper_lamp(p, -0.65, 2.35, 0.62, 0.17)
    rod(p, (0.58, 2.17, 0.655), (1.34, 2.205, 0.655), 0.037, 'metal', 5)
    box(p, (1.00, 2.04, 0.655), (0.54, 0.31, 0.04), 'skin', taper=(1.08, 1))
    exchange_stamp(p, 1.00, 2.03, 0.677, 0.21)
    for x, h in ((-0.78, 2.41), (1.15, 2.307)):
        p.face([p.vert(V(x + dx, h + dy, z)) for dx, dy, z in
                ((-0.012, 0.001, -0.78), (0.012, 0.001, -0.78),
                 (0.012, -0.059, 0.78), (-0.012, -0.059, 0.78))], 'metal', toward=Y)
    window_strip(p, 0, -0.59, 0.49, 2.14, 0.46, -Z, 3)
    p.lathe([(0.115, 0.96), (0.13, 0.99), (0.26, 1.105), (0.29, 1.15),
             (0.26, 1.15), (0.25, 1.135)], 9, 'accent', center=(0.03, 0, 0.34),
            band_regions=['hair', 'skin', 'secondary', 'skin', 'hair'])
    p.lathe([(0.25, 1.135)], 9, 'accent', center=(0.03, 0, 0.34), cap_end=True)
    p.lathe([(0.085, 1.135), (0.081, 1.163), (0.044, 1.174), (0.034, 1.182)], 7, 'accent',
            center=(0.115, 0, 0.39), scale_z=0.73, band_regions=['skin', 'skin', 'accent'],
            cap_end=True)
    for x, z in ((-0.075, 0.39), (-0.035, 0.34), (-0.10, 0.32)):
        box(p, (x, 1.147, z), (0.053, 0.024, 0.028), 'eye', right=V(0.8, 0, 0.6),
            cap_start=False)
    for z in (0.43, 0.47):
        points = [(-0.135, z), (-0.080, z + 0.014), (-0.03, z - 0.008), (0.022, z)]
        for (x0, z0), (x1, z1) in zip(points, points[1:]):
            p.face([p.vert(V(x, 1.14, depth)) for x, depth in
                    ((x0, z0), (x0, z0 + 0.012), (x1, z1 + 0.012), (x1, z1))],
                   'skin', toward=Y)
    for offset in (0, 0.046):
        p.prism((-0.31, 1.20, 0.16 + offset), (0.23, 1.154, 0.41 + offset),
                0.014, 0.007, 4, 'hair')
    dispenser_x = 1.19
    p.lathe([(0.17, 0.96), (0.20, 1.00), (0.20, 1.21), (0.14, 1.27),
             (0.06, 1.27), (0.06, 1.31)], 7, 'metal', center=(dispenser_x, 0, -0.24),
            cap_end=True, band_regions=['hair', 'skin', 'accent', 'metal', 'hair'])
    rod(p, (dispenser_x, 1.06, -0.06), (dispenser_x, 1.06, 0.08), 0.038, 'metal', 4)


def prop_cyber_apartment(p):
    box(p, (-0.04, 1.66, -0.10), (2.66, 3.32, 2.14), 'primary', corner=0.14)
    box(p, (-0.54, 3.82, -0.18), (1.54, 1.01, 1.85), 'primary', corner=0.16)
    folded_roof(p, [(-1.40, 4.52), (0.17, 4.52), (0.39, 4.29), (0.47, 4.29)],
                -1.18, 0.94, 0.22)
    for level in (1.54, 2.76):
        window_strip(p, -0.16, -1.17, level, 2.10, 0.64, -Z, 3)
        window_strip(p, -1.37, -0.22, level, 1.34, 0.64, -X, 2)
    box(p, (-0.56, 4.488, 0.13), (0.71, 0.056, 0.51), 'secondary')
    for x in (-0.76, -0.56, -0.36):
        p.face([p.vert(point) for point in rect_ring(V(x, 4.518, 0.13),
                                                     X, Z, 0.049, 0.18)], 'metal', toward=Y)
    inset(p, -0.53, 3.77, 0.747, 1.35, 0.71, 'skin')
    for x in (-0.78, -0.33):
        p.plate(V(x, 3.77, 0.772), Z, Y, 0.065, 0.51, 0.012, 'hair')
    inset(p, -0.60, 1.10, 0.972, 1.06, 2.18, 'hair', seal=0.05)
    box(p, (-0.36, 0.89, 1.032), (0.065, 0.29, 0.08), 'metal', ao=0.16)
    p.face([p.vert(point) for point in rect_ring(V(-0.36, 1.13, 1.011), X, Y, 0.055, 0.04)],
           'eye', toward=Z)
    # Each bay has a folded sill, deep side walls, and a shared outer frame.
    for h, width, depth in ((2.23, 1.73, 1.495), (3.19, 1.55, 1.39)):
        center = V(-0.50, h + 0.43, 0)
        def bay_ring(z, w, height, cut):
            return rect_ring(center + Z * z, X, Y, w / 2, height / 2, cut)
        back = bay_ring(0.96, width - 0.20, 0.74, 0.09)
        brow = bay_ring(depth - 0.08, width, 0.93, 0.14)
        lip = bay_ring(depth, width - 0.08, 0.85, 0.12)
        glass = bay_ring(depth - 0.13, width - 0.34, 0.59, 0.075)
        p.loft([back, brow, lip], 'metal', band_regions=['primary', 'metal'],
               band_ao=[-0.08, 0.15])
        p.loft([lip, glass], 'secondary', toward=Z, ao=-0.18)
        p.face([p.vert(point) for point in glass], 'skin', toward=Z)
        for x in (-0.80, -0.21):
            box(p, (x, h + 0.43, depth - 0.12), (0.06, 0.60, 0.07), 'hair')
    box(p, (0.83, 2.52, 1.00), (0.80, 1.67, 0.45), 'hair', corner=0.11)
    inset(p, 0.83, 2.52, 1.226, 0.69, 1.51, 'skin', rim='accent')
    exchange_stamp(p, 0.83, 2.71, 1.252, 0.61)
    for w, h in ((0.31, 2.20), (0.22, 2.06)):
        box(p, (0.83, h, 1.252), (w, 0.048, 0.018), 'hair')
    paper_lamp(p, 0.83, 1.70, 1.04, 0.23)
    with p.placed(Matrix.Rotation(pi / 2, 4, 'Y')):
        for level in (1.27, 2.60):
            window_strip(p, 0.10, 1.29, level, 1.54, 0.86, Z, 3)
            box(p, (0.10, level - 0.47, 1.37), (1.66, 0.12, 0.17), 'metal', ao=0.10)
    # Stagger the joints in the lower courses of the rear wall.
    for row in range(3):
        for col in range(4):
            x = -0.93 + col * 0.56 + (row % 2) * 0.18
            tile = rect_ring(V(x, 0.20 + row * 0.22, -1.175), X, Y, 0.26, 0.095)
            p.face([p.vert(point) for point in tile], 'primary', toward=-Z,
                   ao=0.07 * ((row + col) % 3) - 0.14)


def prop_tech_workshop(p):
    # The back wall and jambs leave an open service bay above the bench.
    box(p, (0, 1.20, -0.74), (2.62, 2.40, 0.74), 'primary')
    box(p, (-1.23, 1.20, 0.27), (0.16, 2.40, 1.28), 'metal', ao=-0.09)
    box(p, (0.84, 1.28, 0.29), (0.99, 2.56, 1.35), 'secondary')
    folded_roof(p, [(-1.40, 2.50), (0.12, 2.50), (0.53, 2.98), (1.46, 2.98)],
                -1.11, 1.07, 0.15)
    # Close the raised end of the roof above the workshop door.
    box(p, (0.94, 2.56, -0.11), (0.78, 0.56, 1.94), 'hair')
    window_strip(p, -0.18, -1.11, 1.75, 1.93, 0.61, -Z, 3)
    box(p, (-1.31, 1.73, -0.72), (0.07, 0.79, 0.52), 'secondary')
    inset(p, 0.84, 1.10, 0.967, 0.97, 2.18, 'primary', seal=0.04)
    inset(p, 0.84, 1.66, 0.992, 0.47, 0.59, 'skin', rim='hair', seal=0.04)
    exchange_stamp(p, 0.84, 1.66, 1.019, 0.36)
    box(p, (1.10, 1.16, 1.02), (0.07, 0.20, 0.07), 'metal', ao=0.17)
    p.face([p.vert(point) for point in rect_ring(V(1.10, 1.35, 1.016), X, Y, 0.05, 0.03)],
           'eye', toward=Z)
    box(p, (-0.53, 0.40, 0.41), (1.70, 0.80, 1.55), 'secondary')
    box(p, (-0.55, 0.88, 0.43), (1.75, 0.16, 1.66), 'metal', corner=0.09, ao=0.14)
    for x in (-0.95, -0.13):
        p.plate(V(x, 0.43, 1.188), Z, Y, 0.77, 0.65, 0.032, 'primary', shrink=0.92)
        box(p, (x, 0.63, 1.25), (0.42, 0.07, 0.07), 'metal', ao=0.16)
    box(p, (-0.41, 1.59, -0.355), (1.53, 1.22, 0.045), 'secondary', ao=-0.24)
    box(p, (-0.41, 1.88, -0.28), (1.40, 0.075, 0.12), 'metal')
    for x, length in ((-0.88, 0.40), (-0.65, 0.27), (-0.40, 0.49)):
        box(p, (x, 1.88 - length / 2, -0.19), (0.07, length, 0.07), 'skin')
    for x in (-1.22, 0.17):
        rod(p, (x, 1.80, 0.36), (x, 2.19, 1.27), 0.054, 'metal', 4)
    # Fold the enamel hood over the stays. Roll its front edge under the lip.
    profile = [(2.39, 0.20, 2.32, 0.20), (2.38, 0.64, 2.31, 0.63),
               (2.23, 1.49, 2.17, 1.39), (2.07, 1.49, 2.07, 1.40)]
    rings = [[V(-1.445, h, z), V(0.385, h, z), V(0.385, inner_h, inner_z),
              V(-1.445, inner_h, inner_z)] for h, z, inner_h, inner_z in profile]
    p.loft(rings, 'metal', cap_start=True, cap_end=True,
           band_regions=['metal', 'primary', 'accent'], band_ao=[-0.08, 0.06, 0])
    paper_lamp(p, -1.16, 2.11, 1.26, 0.225)
    # Two jaws and a screw form the bench vise.
    box(p, (-0.61, 1.02, 0.84), (0.43, 0.12, 0.36), 'hair')
    for x in (-0.76, -0.46):
        box(p, (x, 1.14, 0.84), (0.13, 0.21, 0.28), 'accent')
        box(p, (x, 1.26, 0.84), (0.15, 0.04, 0.29), 'metal', cap_start=False)
    rod(p, (-1.01, 1.12, 0.84), (-0.41, 1.12, 0.84), 0.037, 'metal', 6)
    rod(p, (-1.01, 1.04, 0.79), (-1.01, 1.20, 0.89), 0.02, 'metal', 4)
    with p.placed(Matrix.Rotation(pi / 2, 4, 'Y')):
        inset(p, 0.16, 1.43, 1.337, 1.42, 0.96, 'hair')
        for h in (1.18, 1.43, 1.68):
            box(p, (0.16, h, 1.38), (1.11, 0.16, 0.09), 'metal', up=V(0, 1, -0.48))


def prop_steam_basket_counter(p):
    box(p, (0, .09, 0), (1.42, .18, .74), 'secondary')
    box(p, (0, .49, 0), (1.58, .71, .89), 'primary', corner=.08)
    box(p, (0, .865, 0), (1.70, .10, .99), 'metal', corner=.055)
    # A tall closed steamer stands next to an open serving basket.
    for x, levels in ((-.39, 3), (.40, 1)):
        for level in range(levels):
            y = .915 + level * .143
            p.lathe([(.273,y),(.30,y+.028),(.31,y+.127),(.315,y+.143)], 10, 'skin',
                    center=(x,0,0), cap_end=level + 1 < levels,
                    band_regions=['primary','skin','accent'])
    spindle(p, -.39, 0, [(.315,1.344),(.28,1.38),(.10,1.418)], 'skin', sides=10)
    box(p, (-.39, 1.435, 0), (.16,.04,.055), 'secondary')
    p.lathe([(.315,1.058),(.283,1.058),(.252,1.005)], 10, 'skin', center=(.40,0,0),
            toward=Y, band_regions=['skin','accent'])
    p.lathe([(.252,1.005)], 10, 'primary', center=(.40,0,0), cap_end=True)
    for x, z in ((.30,.065),(.49,.035),(.385,-.11)):
        spindle(p, x, z, [(.08,1.008),(.093,1.044),(.052,1.099),(.016,1.114)], 'skin', sides=6)


def prop_market_stool(p):
    spindle(p, 0, 0, [(0.28, 0), (0.30, 0.04), (0.10, 0.10), (0.07, 0.53)], 'metal')
    spindle(p, 0, 0, [(0.20, 0.53), (0.29, 0.57), (0.28, 0.64)], 'accent')


def prop_tea_urn(p):
    spindle(
        p,
        0,
        0,
        [(0.27, 0), (0.24, 0.12), (0.32, 0.18), (0.35, 0.65), (0.28, 0.76)],
        'metal',
    )
    spindle(
        p, 0, 0, [(0.31, 0.76), (0.18, 0.84), (0.055, 0.85), (0.055, 0.90)], 'accent'
    )
    rod(p, (0, 0.24, 0.26), (0, 0.24, 0.48), 0.04, 'metal')
    box(p, (0, 0.30, 0.44), (0.15, 0.04, 0.04), 'eye')


def prop_menu_easel(p):
    for x in (-0.28, 0.28):
        for z in (-0.26, 0.26):
            rod(p, (x, 0.016, z), (x, 1.18, 0), 0.035, 'metal')
    box(p, (0, 0.74, 0.12), (0.68, 0.81, 0.08), 'primary', up=V(0, 1, -0.20))
    for i, w in enumerate((0.42, 0.33, 0.39, 0.24)):
        box(
            p,
            (-0.20 + w / 2, 0.94 - i * 0.13, 0.13 + i * 0.026),
            (w, 0.035, 0.032),
            'eye' if i == 0 else 'skin',
        )


def prop_fish_display(p):
    for x in (-0.62, 0.62):
        box(p, (x, 0.36, 0), (0.16, 0.72, 0.67), 'metal')
    box(p, (0, 0.74, 0), (1.59, 0.18, 0.85), 'primary', taper=(1.07, 1.06))
    for i in range(4):
        x = -0.54 + i * 0.36
        p.tube(
            [
                V(x, 0.875, -0.20),
                V(x, 0.90, -0.01),
                V(x + 0.03, 0.91, 0.13),
                V(x + 0.05, 0.90, 0.22),
            ],
            [0.029, 0.094, 0.075, 0.019],
            6,
            'metal',
            cap_start=True,
            cap_end=True,
        )
        p.prism((x, 0.86, -0.17), (x - 0.025, 0.85, -0.31), 0.026, 0.088, 3, 'accent')
        box(p, (x + 0.05, 0.98, 0.10), (0.033, 0.025, 0.034), 'eye')


def prop_market_scale(p):
    box(p, (0, 0.08, 0), (0.64, 0.16, 0.46), 'primary', corner=0.05)
    spindle(
        p, -0.10, 0, [(0.06, 0.16), (0.06, 0.24), (0.22, 0.27), (0.25, 0.31)], 'metal'
    )
    box(p, (0.23, 0.29, -0.13), (0.05, 0.32, 0.06), 'metal')
    box(p, (0.17, 0.46, -0.13), (0.28, 0.15, 0.09), 'secondary')
    box(p, (0.17, 0.46, -0.078), (0.19, 0.078, 0.02), 'eye')


def prop_herb_trough(p):
    box(p, (0, 0.20, 0), (1.38, 0.40, 0.53), 'skin', taper=(1.09, 1.1))
    box(p, (0, 0.41, 0), (1.42, 0.06, 0.54), 'hair')
    for x in (-0.51, -0.18, 0.19, 0.51):
        for dx, dz, h in ((-0.14, 0.09, 0.20), (0.08, -0.13, 0.32), (0.14, 0.11, 0.24)):
            p.tube(
                [
                    V(x, 0.42, 0),
                    V(x + dx * 0.64, 0.42 + h * 0.79, dz * 0.58),
                    V(x + dx, 0.42 + h, dz),
                ],
                [0.022, 0.083, 0.008],
                4,
                'primary',
                cap_start=True,
                cap_end=True,
            )


def prop_delivery_handcart(p):
    for x in (-0.36, 0.36):
        rod(p, (x, 0.13, 0.12), (x, 1.20, -0.23), 0.045, 'metal')
        p.prism((x - 0.06, 0.17, 0), (x + 0.06, 0.17, 0), 0.17, 0.17, 8, 'secondary')
    box(p, (0, 0.12, 0.26), (0.83, 0.09, 0.48), 'accent')
    box(p, (0, 1.19, -0.23), (0.81, 0.09, 0.09), 'hair')
    for y in (0.43, 0.76):
        box(p, (0, y, 0.17 - y * 0.27), (0.70, 0.09, 0.07), 'metal')


def prop_capsule_locker(p):
    box(p, (0, 1.03, 0), (1.31, 2.06, 0.71), 'secondary', corner=0.06)
    for x in (-0.31, 0.31):
        for y in (0.38, 1, 1.62):
            box(p, (x, y, 0.36), (0.56, 0.54, 0.075), 'primary')
            box(p, (x + 0.15, y + 0.14, 0.407), (0.12, 0.049, 0.02), 'eye')
            box(p, (x, y - 0.10, 0.41), (0.24, 0.05, 0.04), 'metal')


def prop_transit_reader(p):
    spindle(p, 0, 0, [(0.25, 0), (0.25, 0.07), (0.14, 0.13), (0.10, 0.92)], 'metal')
    box(p, (0, 1.11, 0), (0.42, 0.47, 0.29), 'primary', corner=0.055, up=V(0, 1, -0.20))
    box(p, (0, 1.17, 0.14), (0.30, 0.19, 0.04), 'eye', up=V(0, 1, -0.20))
    box(p, (0, 0.99, 0.18), (0.18, 0.035, 0.04), 'secondary')


def prop_taxi_beacon(p):
    spindle(p, 0, 0, [(0.28, 0), (0.29, 0.09), (0.13, 0.18), (0.095, 2.13)], 'metal')
    spindle(p, 0, 0, [(0.18, 1.66), (0.18, 1.82)], 'accent')
    box(p, (0, 2.20, 0), (0.92, 0.31, 0.22), 'primary', corner=0.06)
    for x in (-0.29, -0.09, 0.11):
        box(p, (x, 2.20, 0.12), (0.09, 0.17, 0.04), 'eye', up=V(0.37, 1, 0))


def prop_arc_lamp(p):
    spindle(
        p,
        0,
        0,
        [(0.26, 0), (0.28, 0.09), (0.13, 0.22), (0.105, 1.19), (0.081, 2.63)],
        'metal',
    )
    rod(p, (0, 2.60, 0), (0, 2.96, 0.36), 0.083, 'metal')
    rod(p, (0, 2.96, 0.36), (0, 2.96, 0.88), 0.075, 'metal')
    box(p, (0, 2.89, 0.87), (0.37, 0.16, 0.62), 'primary', corner=0.07)
    box(p, (0, 2.80, 0.87), (0.28, 0.045, 0.50), 'eye')
    spindle(p, 0, 0, [(0.137, 0.53), (0.134, 0.64)], 'accent')


def prop_lantern_span(p):
    for x in (-1.85, 1.85):
        spindle(
            p, x, 0, [(0.19, 0), (0.19, 0.09), (0.079, 0.16), (0.06, 3.06)], 'metal'
        )

    def height(x):
        return 2.72 + 0.34 * (x / 1.85) ** 2

    knots = (-1.85, -1.17, 0, 1.17, 1.85)
    for x, end in zip(knots, knots[1:]):
        rod(p, (x, height(x), 0), (end, height(end), 0), 0.028, 'hair')
    for x in knots[1:-1]:
        rod(p, (x, height(x), 0), (x, height(x) - 0.15, 0), 0.024, 'metal')
        lantern(p, x, height(x) - 0.51, 0, 0.18)


def prop_rain_shelter(p):
    for x in (-1.1, 1.1):
        box(p, (x, 1.10, -0.37), (0.12, 2.20, 0.15), 'metal')
        rod(p, (x, 1.70, -0.37), (x, 2.13, 0.49), 0.05, 'metal')
    box(p, (0, 2.19, 0.02), (2.51, 0.12, 1.29), 'primary', up=V(0, 1, 0.09))
    box(p, (0, 2.09, 0.63), (2.29, 0.044, 0.05), 'eye')
    for x in (-0.71, 0.71):
        box(p, (x, 0.23, -0.12), (0.13, 0.46, 0.42), 'secondary')
    box(p, (0, 0.49, -0.10), (1.92, 0.10, 0.46), 'skin', corner=0.05)
    for y in (0.92, 1.17):
        box(p, (0, y, -0.37), (2.18, 0.17, 0.08), 'metal')


def prop_safety_island(p):
    box(p, (0, 0.091, 0), (1.56, 0.182, 0.61), 'skin', corner=0.16)
    for x in (-0.49, 0.49):
        spindle(
            p,
            x,
            0,
            [(0.11, 0.182), (0.11, 0.28), (0.079, 0.34), (0.079, 0.78)],
            'secondary',
        )
        spindle(p, x, 0, [(0.083, 0.60), (0.083, 0.70)], 'eye')


def prop_channel_pavement(p):
    box(p, (0, 0.049, 0), (2, 0.098, 2), 'secondary')
    for x in (-0.64, 0.10):
        for z in (-0.50, 0.50):
            box(p, (x, 0.113, z), (0.718, 0.03, 0.978), 'skin', corner=0.024)
    for i in range(11):
        box(p, (0.61, 0.11, -0.90 + i * 0.18), (0.25, 0.028, 0.083), 'metal')
    box(p, (0.866, 0.111, 0), (0.259, 0.026, 1.995), 'primary')


def prop_utility_pavement(p):
    box(p, (0, 0.055, 0), (2, 0.11, 2), 'skin')
    spindle(p, 0, 0, [(0.66, 0.11), (0.65, 0.131)], 'secondary', 12)
    spindle(p, 0, 0, [(0.57, 0.131), (0.57, 0.144)], 'metal', 12)
    for x in (-0.29, 0, 0.29):
        box(p, (x, 0.149, 0), (0.046, 0.012, 0.59), 'secondary')
    for z in (-0.83, 0.83):
        box(p, (0, 0.115, z), (1.96, 0.01, 0.023), 'secondary')


def prop_cable_ramp(p):
    box(p, (0, 0.065, 0), (1.76, 0.13, 0.55), 'secondary', taper=(0.93, 0.60))
    for x in (-0.59, -0.28, 0.03, 0.34, 0.65):
        box(p, (x, 0.135, 0), (0.12, 0.011, 0.31), 'accent', right=V(1, 0, 0.25))


def prop_cooling_stack(p):
    box(p, (0, 0.11, 0), (1.03, 0.22, 0.96), 'secondary', corner=0.08)
    spindle(
        p, 0, 0, [(0.43, 0.22), (0.41, 0.42), (0.29, 0.89), (0.37, 1.17)], 'metal', 10
    )
    spindle(p, 0, 0, [(0.39, 1.17), (0.39, 1.25)], 'primary', 10)
    spindle(p, 0, 0, [(0.33, 1.25), (0.33, 1.26)], 'secondary', 10)
    for i in range(3):
        with p.placed(Matrix.Rotation(i * 2.094, 4, 'Y')):
            box(p, (0.15, 1.27, 0), (0.26, 0.035, 0.10), 'metal', right=V(1, 0, 0.33))
    spindle(p, 0, 0, [(0.09, 1.27), (0.07, 1.32)], 'accent')


def prop_pressure_station(p):
    box(p, (0, 0.08, 0), (1.24, 0.16, 0.74), 'secondary')
    for x in (-0.37, 0.37):
        spindle(
            p,
            x,
            0,
            [(0.18, 0.16), (0.23, 0.26), (0.23, 0.96), (0.16, 1.08), (0.09, 1.11)],
            'metal',
        )
        spindle(p, x, 0, [(0.236, 0.76), (0.236, 0.84)], 'accent')
    rod(p, (-0.37, 1.11, 0), (-0.37, 1.27, 0), 0.055, 'metal')
    rod(p, (-0.37, 1.25, 0), (0.37, 1.25, 0), 0.055, 'metal')
    rod(p, (0.37, 1.26, 0), (0.37, 1.10, 0), 0.055, 'metal')
    p.prism((0, 1.27, 0), (0, 1.27, 0.13), 0.119, 0.119, 8, 'skin')
    box(p, (0.027, 1.29, 0.137), (0.018, 0.087, 0.013), 'accent', up=V(0.56, 1, 0))


def prop_cell_charger(p):
    box(p, (0, 0.17, 0), (1.56, 0.34, 0.65), 'primary', corner=0.06)
    for x in (-0.48, 0, 0.48):
        spindle(
            p,
            x,
            0,
            [(0.185, 0.34), (0.185, 0.41), (0.145, 0.44), (0.145, 0.91), (0.10, 0.95)],
            'metal',
        )
        spindle(p, x, 0, [(0.15, 0.75), (0.15, 0.83)], 'eye')
        box(p, (x, 0.19, 0.33), (0.16, 0.055, 0.022), 'accent')


def prop_hose_reel(p):
    for x in (-0.32, 0.32):
        box(p, (x, 0.31, 0), (0.105, 0.62, 0.49), 'primary', taper=(1, 0.38))
    for x in (-0.24, 0.24):
        p.prism((x - 0.03, 0.59, 0), (x + 0.03, 0.59, 0), 0.38, 0.38, 10, 'metal')
    for x in (-0.16, -0.08, 0, 0.08, 0.16):
        p.prism((x - 0.041, 0.59, 0), (x + 0.041, 0.59, 0), 0.29, 0.31, 10, 'accent')
    rod(p, (0.08, 0.51, 0.25), (0.09, 0.10, 0.41), 0.04, 'accent')


def prop_transformer_frame(p):
    box(p, (0, 0.09, 0), (1.40, 0.18, 0.93), 'secondary')
    box(p, (0, 0.62, 0), (0.99, 0.89, 0.63), 'metal')
    grille(p, 0, 0.65, 0.33, 0.88, 0.64, 6)
    for x in (-0.38, 0, 0.38):
        spindle(p, x, 0, [(0.075, 1.065), (0.075, 1.41)], 'primary')
        for y in (1.15, 1.28):
            spindle(p, x, 0, [(0.12, y), (0.09, y + 0.058)], 'skin')


def prop_filter_bank(p):
    box(p, (0, 0.11, 0), (1.12, 0.22, 0.66), 'primary')
    for x in (-0.31, 0, 0.31):
        spindle(
            p, x, 0, [(0.10, 0.22), (0.13, 0.29), (0.13, 0.94), (0.105, 1.02)], 'skin'
        )
        spindle(p, x, 0, [(0.14, 0.75), (0.14, 0.82)], 'metal')
    box(p, (0, 1.07, 0), (1.02, 0.14, 0.32), 'metal')
    rod(p, (0.45, 1.07, 0), (0.55, 1.07, 0), 0.09, 'accent')


def prop_sorting_chute(p):
    box(p, (0, 0.44, 0), (0.88, 0.88, 0.86), 'secondary', corner=0.06)
    box(p, (0, 1.02, -0.12), (0.76, 0.37, 0.58), 'primary', up=V(0, 1, -0.42))
    box(p, (0, 1.04, 0.16), (0.59, 0.23, 0.06), 'hair', up=V(0, 1, -0.42))
    box(p, (0, 0.90, 0.26), (0.70, 0.06, 0.19), 'accent')
    grille(p, 0, 0.39, 0.44, 0.60, 0.34, 3)


def prop_balcony_bay(p):
    box(p, (0, 0.09, 0), (2, 0.18, 1.13), 'primary', corner=0.07)
    for x in (-0.93, 0.93):
        for z in (-0.48, 0.48):
            box(p, (x, 0.53, z), (0.08, 0.78, 0.08), 'metal')
        box(p, (x, 0.91, 0), (0.08, 0.08, 1.04), 'metal')
    for y in (0.40, 0.63, 0.91):
        box(p, (0, y, 0.48), (1.92, 0.07, 0.07), 'metal' if y < 0.9 else 'accent')


def prop_fire_ladder(p):
    for x in (-0.29, 0.29):
        box(p, (x, 1.44, 0.12), (0.07, 2.88, 0.07), 'metal')
        for y in (0.30, 2.40):
            box(p, (x, y, -0.01), (0.09, 0.08, 0.32), 'primary')
    for i in range(9):
        box(
            p,
            (0, 0.17 + i * 0.30, 0.12),
            (0.54, 0.048, 0.064),
            'skin' if i in (0, 8) else 'metal',
        )


def prop_pod_upper_floor(p):
    box(p, (0, 0.72, 0), (2.60, 1.44, 2.08), 'primary', corner=0.12)
    box(p, (0, 0.08, 0), (2.66, 0.16, 2.16), 'secondary', corner=0.08)
    for x in (-0.64, 0.64):
        box(p, (x, 0.78, 1.07), (1.15, 0.83, 0.26), 'metal', corner=0.07)
        box(p, (x, 0.80, 1.21), (0.93, 0.52, 0.045), 'secondary')
        box(p, (x - 0.18, 0.81, 1.24), (0.47, 0.38, 0.031), 'eye')
        for y in (0.68, 0.81, 0.94):
            box(p, (x + 0.28, y, 1.25), (0.26, 0.048, 0.05), 'metal')
    for x in (-1.31, 1.31):
        box(p, (x, 0.68, 0.03), (0.08, 0.56, 1.12), 'secondary')
        for z in (-0.32, 0.02, 0.36):
            box(p, (x * 1.034, 0.71, z), (0.03, 0.34, 0.24), 'hair')


def prop_roof_cistern(p):
    for x in (-0.52, 0.52):
        for z in (-0.44, 0.44):
            rod(p, (x, 0, z), (x * 0.81, 0.73, z * 0.81), 0.068, 'metal')
    box(p, (0, 0.71, 0), (1.25, 0.13, 1.22), 'secondary')
    spindle(
        p, 0, 0, [(0.50, 0.775), (0.63, 0.90), (0.63, 1.72), (0.54, 1.85)], 'skin', 10
    )
    for y in (1.02, 1.57):
        spindle(p, 0, 0, [(0.641, y), (0.641, y + 0.068)], 'metal', 10)
    spindle(p, 0, 0, [(0.58, 1.85), (0.16, 2.03)], 'primary', 10)


def prop_dish_relay(p):
    spindle(p, 0, 0, [(0.40, 0), (0.39, 0.10), (0.14, 0.18), (0.10, 0.82)], 'metal')
    with p.placed(Matrix.Translation(V(0, 0.84, 0)) @ Matrix.Rotation(0.92, 4, 'X')):
        p.lathe(
            [
                (0.12, 0),
                (0.37, 0.09),
                (0.61, 0.32),
                (0.60, 0.36),
                (0.34, 0.15),
                (0.08, 0.09),
            ],
            12,
            'skin',
            cap_start=True,
            cap_end=True,
        )
        rod(p, (0, 0.09, 0), (0, 0.55, 0), 0.034, 'metal')
        spindle(p, 0, 0, [(0.078, 0.52), (0.060, 0.62)], 'accent')


def prop_blade_sign(p):
    for y in (0.10, 1.11):
        box(p, (-0.31, y, 0), (0.74, 0.12, 0.14), 'metal')
        box(p, (-0.68, y, 0), (0.07, 0.20, 0.25), 'primary')
    box(p, (0.11, 0.83, 0), (0.54, 1.56, 0.21), 'secondary', corner=0.065)
    for z in (-0.12, 0.12):
        for y in (0.42, 0.82, 1.22):
            box(p, (0.07, y, z), (0.054, 0.24, 0.035), 'eye', up=V(0.36, 1, 0))
            box(p, (0.17, y + 0.07, z), (0.16, 0.042, 0.035), 'accent')


def prop_shutter_bay(p):
    for x in (-0.95, 0.95):
        box(p, (x, 1.17, 0), (0.10, 2.34, 0.22), 'metal')
    box(p, (0, 1.10, 0), (1.84, 2.20, 0.12), 'secondary')
    for i in range(12):
        box(
            p,
            (0, 0.11 + i * 0.176, 0.08),
            (1.78, 0.15, 0.07),
            'metal',
            up=V(0, 1, -0.16),
        )
    box(p, (0, 2.27, 0), (2, 0.19, 0.31), 'primary', corner=0.04)
    box(p, (0, 0.25, 0.14), (0.26, 0.042, 0.06), 'accent')


def prop_awning_fan(p):
    for x in (-0.84, 0.84):
        box(p, (x, 0.37, -0.52), (0.10, 0.74, 0.10), 'metal')
        rod(p, (x, 0.12, -0.50), (x, 0.48, 0.49), 0.042, 'metal')
    for i in range(7):
        x = (i - 3) * 0.285
        box(
            p,
            (x, 0.66, 0),
            (0.284, 0.08, 1.17),
            'primary' if i % 2 else 'accent',
            up=V(0, 1, 0.30),
        )
        box(
            p,
            (x, 0.42, 0.55),
            (0.278, 0.16, 0.045),
            'primary' if i % 2 else 'accent',
            taper=(1.03, 1),
        )


def prop_tension_sail(p):
    mounts = [(-1.55, 2.83, -0.77), (1.55, 3.07, -0.78), (0.65, 2.47, 0.95)]
    for x, y, z in mounts:
        spindle(
            p, x, z, [(0.15, 0), (0.15, 0.08), (0.068, 0.16), (0.046, y)], 'metal', 6
        )
    rim = [V(*pt) for pt in mounts]
    center = sum(rim[1:], rim[0].copy()) / 3
    center.y -= 0.27
    for i, role in enumerate(('accent', 'primary', 'primary')):
        p.slab(
            [rim[i], rim[(i + 1) % 3], center],
            0.026,
            role,
            normal=V(0, 1, 0),
            shrink=1,
            back=True,
        )


DISTRICT_PROPS = [
    (prop_lantern_noodle_bar, 'Lantern Exchange Noodle Bar'),
    (prop_steam_basket_counter, 'Steam Basket Counter'),
    (prop_market_stool, 'Market Counter Stool'),
    (prop_tea_urn, 'Countertop Tea Urn'),
    (prop_menu_easel, 'Market Menu Easel'),
    (prop_fish_display, 'Fishmonger Display Table'),
    (prop_market_scale, 'Countertop Market Scale'),
    (prop_herb_trough, 'Kitchen Herb Trough'),
    (prop_delivery_handcart, 'Delivery Handcart'),
    (prop_capsule_locker, 'Parcel Capsule Lockers'),
    (prop_transit_reader, 'Transit Fare Reader'),
    (prop_taxi_beacon, 'Night Taxi Beacon'),
    (prop_arc_lamp, 'Cantilever Street Lamp'),
    (prop_lantern_span, 'Lantern Cable Span'),
    (prop_rain_shelter, 'Rain Shelter Bench'),
    (prop_safety_island, 'Pedestrian Refuge Island'),
    (prop_channel_pavement, 'Channel Drain Pavement'),
    (prop_utility_pavement, 'Service Hatch Pavement'),
    (prop_cable_ramp, 'Cable Crossing Ramp'),
    (prop_cooling_stack, 'Roof Cooling Stack'),
    (prop_pressure_station, 'Twin Pressure Vessels'),
    (prop_cell_charger, 'Swap Cell Charger'),
    (prop_hose_reel, 'Service Hose Reel'),
    (prop_transformer_frame, 'Street Transformer Frame'),
    (prop_filter_bank, 'Water Filter Bank'),
    (prop_sorting_chute, 'Recycling Intake Chute'),
    (prop_balcony_bay, 'Bolt-on Balcony Bay'),
    (prop_fire_ladder, 'Service Access Ladder'),
    (prop_pod_upper_floor, 'Stackable Capsule Floor'),
    (prop_roof_cistern, 'Elevated Roof Cistern'),
    (prop_dish_relay, 'Roof Dish Relay'),
    (prop_blade_sign, 'Lantern Exchange Blade Sign'),
    (prop_shutter_bay, 'Modular Shop Shutter'),
    (prop_awning_fan, 'Striped Shop Awning'),
    (prop_tension_sail, 'Three-post Market Sail'),
]
