"""Add surface wear to some of the repeated structural bays."""

from creature_kit import Sculpt
from voxchar import vox


WALL_FINISHES = {
    'core': ('Patched motor pool wall', '#908d80', (
        ((-17, -4), (3, 5), 'skin', -0.58),
        ((-14, -7), (6, 8), 'skin', -0.50),
        ((-13, -7), (8, 15), 'detail', -0.17),
        ((-12, -7), (14, 15), 'detail', 0.20),
        ((10, 15), (4, 6), 'skin', -0.51),
    )),
    'heist': ('Damp print works wall', '#8e7563', (
        ((-16, -3), (3, 5), 'primary', -0.62),
        ((-12, -7), (5, 9), 'primary', -0.56),
        ((-14, -9), (6, 7), 'detail', 0.09),
        ((4, 12), (12, 13), 'detail', -0.20),
        ((7, 14), (13, 14), 'detail', -0.14),
    )),
    'industrial': ('Oxidized smelting works wall', '#877661', (
        ((-16, -9), (3, 4), 'leather', -0.6),
        ((-16, -12), (5, 6), 'detail', -0.48),
        ((-13, -11), (6, 9), 'detail', -0.34),
        ((6, 14), (8, 9), 'detail', -0.25),
    )),
    'security': ('Repaired baggage hall wall', '#a2a9a5', (
        ((-16, 12), (5, 5), 'trim', -0.36),
        ((-16, 12), (6, 6), 'trim', 0.06),
        ((-14, -7), (8, 13), 'detail', 0.00),
        ((-14, -7), (12, 12), 'detail', -0.26),
        ((-8, -8), (9, 11), 'detail', -0.20),
    )),
    'creatures': ('Weathered ranger lodge wall', '#7e7058', (
        ((-16, -4), (3, 4), 'leather', -0.55),
        ((-15, -11), (5, 6), 'detail', -0.44),
    )),
    'fantasy': ('Sooted bakehouse wall', '#8f8067', (
        ((-16, -4), (3, 4), 'skin', -0.52),
        ((-14, -9), (5, 6), 'detail', -0.43),
        ((-7, 9), (8, 8), 'trim', -0.38),
    )),
}


def add_wall_finish(kit, base_label):
    base_id = kit.prop_id(base_label)
    placements = [p for p in kit.placements if p['propId'] == base_id][1::3]
    if not placements:
        return
    base = next(sculpt for asset, _, sculpt in kit.props if asset == base_id)
    label, detail, marks = WALL_FINISHES[kit.key]
    shape = Sculpt()
    shape.ops.extend(base.ops)
    for x, y, region, shade in marks:
        shape.paint(x, y, (-2, 2), vox(region, shade))
    asset = kit.prop_id(label)
    kit.props.append((asset, label, shape))
    kit.set_palette(label, **{**kit.palettes.get(base_id, {}), 'detail': detail})
    for placement in placements:
        placement['propId'] = asset
