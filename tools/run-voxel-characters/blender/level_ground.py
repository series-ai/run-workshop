"""Put worn ground surfaces along work and travel routes."""

from creature_kit import Sculpt
from voxchar import vox


# Marks give inclusive X and Z ranges on the top face of a 4 m tile.
# Keep the original cell positions. Use broad marks with smaller edge marks.
GROUND_VARIANTS = {
    'core': (
        ('Concrete with tire stains', ((-8, -8), (-4, -4), (0, 0), (4, 8)),
         {'hair': '#444749'}, (
             ((-12, -9), (-14, 5), 'hair', -0.25),
             ((-11, -8), (6, 12), 'hair', -0.24),
             ((-11, -10), (-7, 1), 'hair', -0.66),
             ((10, 13), (-14, -1), 'hair', -0.27),
             ((9, 12), (0, 7), 'hair', -0.3),
             ((7, 10), (8, 12), 'hair', -0.5),
             ((-5, 1), (8, 11), 'skin', -0.52),
             ((-10, -10), (-15, -12), 'hair', -0.38),
             ((-8, -8), (-11, -9), 'hair', -0.16),
             ((-7, -6), (-10, -10), 'hair', -0.28),
             ((12, 14), (6, 7), 'hair', -0.51),
             ((8, 8), (9, 13), 'skin', -0.36),
             ((-5, -2), (11, 13), 'hair', -0.20),
         )),
        ('Repaired concrete apron', ((-8, -4), (0, -8), (4, 0), (-4, 12)),
         {'trim': '#94948a', 'detail': '#685e52'}, (
             ((-17, -7), (-11, 10), 'trim', 0.1),
             ((-8, -6), (-11, 10), 'trim', 0.35),
             ((-15, -8), (-9, -3), 'trim', -0.3),
             ((-18, -17), (-12, 10), 'detail', 0.0),
             ((-18, -13), (11, 11), 'detail', -0.2),
             ((12, 16), (14, 17), 'trim', -0.35),
             ((-18, -16), (-13, -12), 'detail', -0.20),
             ((-9, -7), (11, 13), 'trim', -0.12),
             ((-8, -7), (12, 12), 'skin', -0.40),
             ((-7, -6), (-13, -13), 'detail', -0.31),
             ((-6, -4), (-14, -14), 'detail', -0.33),
             ((11, 12), (15, 15), 'detail', -0.25),
         )),
    ),
    'heist': (
        ('Sealed asphalt patch', ((-4, -8), (0, -4), (4, 0), (0, 12)),
         {'hair': '#444645', 'skin': '#78726a'}, (
             ((-17, 9), (-8, 1), 'hair', -0.12),
             ((-16, 9), (2, 4), 'hair', -0.32),
             ((-12, 8), (-8, -8), 'secondary', -0.7),
             ((-13, -6), (5, 5), 'secondary', -0.62),
             ((8, 10), (-5, -1), 'skin', -0.52),
             ((-14, -11), (-12, -10), 'skin', -0.35),
             ((-18, -17), (-4, -2), 'trim', -0.57),
             ((-12, -11), (3, 4), 'secondary', -0.52),
             ((-11, -7), (5, 5), 'hair', -0.43),
             ((10, 11), (0, 2), 'secondary', -0.28),
             ((10, 10), (-5, -4), 'hair', -0.68),
             ((11, 12), (-6, -6), 'hair', -0.57),
         )),
        ('Brick loading apron', ((-8, -8), (-4, 0), (4, 8), (8, 12)),
         {'trim': '#a18a72', 'skin': '#816955'}, (
             ((-18, -12), (-19, 18), 'skin', 0.18),
             ((-15, -14), (-19, 18), 'trim', -0.2),
             ((-12, -12), (-19, 18), 'skin', -0.7),
             ((-18, -13), (-14, -14), 'skin', -0.55),
             ((-18, -13), (-3, -3), 'skin', -0.55),
             ((-18, -13), (8, 8), 'skin', -0.55),
             ((-17, -16), (15, 18), 'detail', -0.12),
             ((-13, -13), (-10, -7), 'skin', -0.50),
             ((-12, -11), (-7, -6), 'skin', -0.49),
             ((-19, -18), (-12, -11), 'trim', 0.11),
             ((-16, -14), (-5, -5), 'detail', 0.30),
             ((-16, -13), (5, 6), 'skin', 0.37),
         )),
    ),
    'industrial': (
        ('Slag stained casting slab', ((-4, -12), (0, -8), (4, -4), (4, 12)),
         {'detail': '#80705b', 'hair': '#514d47'}, (
             ((-17, -4), (2, 13), 'hair', -0.28),
             ((-19, -6), (5, 10), 'hair', -0.5),
             ((-17, -9), (8, 13), 'detail', -0.33),
             ((-12, -7), (4, 6), 'detail', -0.13),
             ((-6, -4), (13, 15), 'detail', -0.04),
             ((4, 12), (10, 12), 'hair', -0.33),
             ((-16, -14), (4, 6), 'hair', -0.55),
             ((-17, -16), (3, 5), 'detail', -0.38),
             ((-11, -10), (11, 14), 'hair', -0.53),
             ((-4, -3), (10, 14), 'hair', -0.20),
             ((5, 7), (10, 10), 'detail', 0.14),
             ((8, 9), (11, 13), 'hair', -0.70),
         )),
        ('Tracked loading slab', ((-8, -4), (8, 0), (8, 8), (12, -12)),
         {'leather': '#7a6a50', 'detail': '#968974'}, (
             ((-9, -7), (-18, 3), 'leather', -0.22),
             ((-10, -7), (4, 17), 'leather', -0.11),
             ((10, 11), (-18, 17), 'leather', -0.27),
             ((-6, -4), (-9, -7), 'detail', -0.25),
             ((8, 10), (1, 5), 'detail', -0.43),
             ((7, 9), (11, 16), 'leather', 0.08),
             ((-10, -9), (-16, -12), 'leather', -0.32),
             ((-8, -8), (-5, -2), 'secondary', -0.33),
             ((-9, -8), (7, 8), 'detail', -0.39),
             ((9, 9), (-12, -9), 'leather', -0.16),
             ((11, 12), (7, 9), 'detail', -0.40),
             ((11, 11), (8, 12), 'secondary', -0.43),
         )),
    ),
    'security': (
        ('Terrazzo tile with inlay', ((4, -8), (8, -4), (12, -4), (0, 8)),
         {'primary': '#727d7f', 'trim': '#aeb1a8', 'secondary': '#555b60'}, (
             ((-14, -13), (-19, 19), 'trim', -0.24),
             ((-12, -11), (-19, 19), 'secondary', -0.15),
             ((11, 12), (-19, 19), 'trim', -0.24),
             ((9, 10), (-19, 19), 'secondary', -0.15),
             ((-11, -9), (-1, 2), 'skin', 0.06),
             ((-14, -14), (-12, -11), 'detail', -0.18),
             ((-13, -13), (5, 6), 'secondary', -0.08),
             ((-12, -12), (6, 8), 'secondary', -0.28),
             ((10, 12), (-13, -12), 'detail', -0.24),
             ((11, 12), (9, 10), 'trim', 0.10),
             ((12, 13), (16, 16), 'skin', -0.39),
         )),
        ('Repaired station tile', ((0, -4), (4, 8), (8, -12), (8, 4)),
         {'secondary': '#505d61', 'detail': '#899793'}, (
             ((-10, 2), (-13, -3), 'detail', 0.15),
             ((-10, 2), (-2, -2), 'secondary', -0.4),
             ((3, 3), (-13, -2), 'secondary', -0.3),
             ((-7, -5), (-12, -10), 'detail', -0.25),
             ((5, 9), (8, 12), 'detail', -0.2),
             ((-10, -9), (-14, -14), 'secondary', -0.25),
             ((-11, -11), (-14, -13), 'secondary', -0.35),
             ((-7, -6), (-4, -2), 'detail', -0.35),
             ((3, 4), (-1, -1), 'secondary', -0.20),
             ((6, 7), (12, 13), 'secondary', -0.45),
             ((9, 10), (6, 7), 'detail', -0.31),
         )),
    ),
    'creatures': (
        ('Damp woodland trail', ((4, -4), (8, -8), (8, 0), (0, 12)),
         {'leather': '#74654e', 'detail': '#888072'}, (
             ((-16, -3), (-9, 8), 'leather', -0.37),
             ((-18, -5), (-6, 2), 'leather', -0.49),
             ((-12, -4), (-1, 4), 'leather', -0.66),
             ((-4, 4), (2, 5), 'detail', -0.3),
             ((3, 7), (3, 5), 'detail', -0.2),
             ((11, 15), (-14, -11), 'detail', -0.38),
             ((-17, -16), (-7, -5), 'secondary', -0.50),
             ((-18, -16), (0, 1), 'detail', -0.35),
             ((-11, -10), (4, 6), 'leather', -0.20),
             ((-6, -3), (5, 6), 'detail', -0.55),
             ((10, 11), (-14, -13), 'detail', -0.54),
             ((12, 14), (-11, -10), 'skin', -0.47),
         )),
        ('Gravel trail edge', ((8, -4), (4, -8), (4, 0), (-4, 12)),
         {'skin': '#a09880', 'detail': '#817e6b'}, (
             ((-18, -16), (-18, -6), 'detail', -0.1),
             ((-17, -14), (-6, 3), 'detail', -0.16),
             ((-15, -13), (4, 12), 'detail', -0.2),
             ((-16, -14), (13, 17), 'detail', -0.4),
             ((-12, -10), (7, 9), 'skin', -0.22),
             ((-13, -12), (-14, -11), 'skin', -0.26),
             ((-18, -17), (-13, -11), 'skin', 0.28),
             ((-17, -17), (-10, -9), 'detail', -0.37),
             ((-15, -14), (-3, -1), 'skin', 0.00),
             ((-15, -14), (3, 4), 'skin', 0.21),
             ((-18, -17), (7, 9), 'detail', -0.42),
             ((-13, -12), (11, 12), 'leather', -0.35),
         )),
    ),
    'fantasy': (
        ('Mended market flagstone', ((-8, 0), (-4, -4), (0, 4), (4, 12)),
         {'skin': '#9c8c73', 'detail': '#b3a183'}, (
             ((-14, -6), (-13, -7), 'detail', -0.32),
             ((-5, -2), (-13, -7), 'skin', -0.23),
             ((-14, -2), (-6, -6), 'secondary', -0.55),
             ((3, 11), (9, 16), 'detail', -0.37),
             ((3, 10), (16, 16), 'skin', 0.03),
             ((10, 11), (9, 11), 'detail', -0.46),
             ((-13, -12), (-12, -11), 'skin', -0.42),
             ((-13, -12), (-10, -9), 'trim', 0.15),
             ((-7, -6), (-6, -5), 'secondary', -0.47),
             ((-8, -7), (-5, -4), 'skin', -0.55),
             ((5, 6), (16, 17), 'detail', 0.28),
             ((9, 11), (16, 17), 'secondary', -0.32),
         )),
        ('Damp gate flagstone', ((0, 0), (4, 4), (8, 0), (0, 12)),
         {'leather': '#897758', 'detail': '#918267'}, (
             ((-15, -9), (-18, -12), 'leather', -0.28),
             ((-14, -6), (-11, -4), 'leather', -0.4),
             ((-12, -7), (-3, 4), 'leather', -0.47),
             ((-13, -8), (5, 8), 'detail', -0.29),
             ((-15, -11), (9, 14), 'detail', -0.16),
             ((-12, -9), (0, 5), 'leather', -0.63),
             ((-15, -13), (-12, -11), 'detail', -0.32),
             ((-13, -13), (-8, -6), 'skin', -0.55),
             ((-12, -11), (-3, -2), 'secondary', -0.36),
             ((-14, -13), (1, 2), 'detail', -0.25),
             ((-10, -9), (5, 6), 'detail', -0.38),
             ((-15, -14), (11, 13), 'skin', -0.41),
         )),
    ),
}


PAVING_EDGES = {
    'Repaired concrete apron': (-18, 'trim', 'detail'),
    'Brick loading apron': (-19, 'skin', 'leather'),
    'Repaired station tile': (7, 'detail', 'secondary'),
    'Mended market flagstone': (-18, 'skin', 'secondary'),
}


def lay_paving_edge(shape, x, stone, joint):
    dark = vox(joint, -0.44)
    for row in range(3):
        left = x + row * 4
        shape.box((left, left + 3), 1, (-19, 19), vox(stone, (-0.16, 0.06, -0.08)[row]))
        shape.box(left, 1, (-19, 19), dark)
        for z in range(-17 - 2 * (row % 2), 20, 5):
            shape.box((left + 1, left + 3), 1, z, dark)
    shape.box(x + 12, 1, (-19, 18), vox(joint, -0.29))


def dress_ground(kit, floor_label):
    floor_id = kit.prop_id(floor_label)
    floor = next(sculpt for asset, _, sculpt in kit.props if asset == floor_id)
    for label, locations, colors, marks in GROUND_VARIANTS[kit.key]:
        placements = [kit.placement_at(floor_label, x, z) for x, z in locations]
        shape = Sculpt()
        shape.ops.extend(floor.ops)
        if label in PAVING_EDGES:
            lay_paving_edge(shape, *PAVING_EDGES[label])
        for x, z, region, shade in marks:
            shape.box(x, 1, z, vox(region, shade))
        prop_id = kit.prop_id(label)
        kit.props.append((prop_id, label, shape))
        kit.set_palette(label, **{**kit.palettes.get(floor_id, {}), **colors})
        for placement in placements:
            placement['propId'] = prop_id
