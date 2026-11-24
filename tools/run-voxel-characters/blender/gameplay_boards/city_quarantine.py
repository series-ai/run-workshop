"""Intake queue, defended perimeter, and treatment yard for Last Light."""

import build_level_props as lp
import voxchar as vk
from creature_kit import Sculpt
from level_geometry import box

from .city_dressing import shop_level
from .common import BODY, DARK, GLOW, GREEN, JOINT, MARK, METAL, RUBBER, STONE, WOOD, glyph


EYE = vk.vox('visor', -0.30, mottle=False)
MOUTH = vk.vox('skin', -0.42, mottle=False)


def waiting_survivors(with_packs):
    shape = Sculpt()
    cast = ((-10, 2, 7, 5, GREEN, 'braid'), (0, -2, 9, 6, BODY, 'cap'),
            (10, 1, 8, 5, DARK, 'cropped'))
    if with_packs:
        cast = ((-10, -1, 8, 6, WOOD, 'cap'), (0, 1, 9, 5, DARK, 'cropped'),
                (10, -2, 7, 5, GREEN, 'braid'))
    for index, (x, z, hip, width, jacket, hair) in enumerate(cast):
        shoulders = hip + 5
        face = shoulders + 2
        trousers = DARK if index != 1 else WOOD
        for side in (-1, 1):
            foot_x = x + (1 if side > 0 else -2)
            step = int(side == (-1 if index == 1 else 1))
            box(2, hip, 2, trousers, x=foot_x, y=1, z=z + step, sculpt=shape)
            box(2, 2, 3, RUBBER, x=foot_x, z=z + step + 1, sculpt=shape)
        box(width - 1, 5, 3, jacket, x=x, y=hip, z=z, sculpt=shape)
        box(width, 2, 3, jacket, x=x, y=shoulders - 1, z=z, sculpt=shape)
        box(width - 1, 1, 3, WOOD, x=x, y=hip, z=z, sculpt=shape)
        box(2, 2, 2, STONE, x=x, y=shoulders + 1, z=z, sculpt=shape)
        for side in (-1, 1):
            arm_x = x + (width // 2 + 1) * side
            raised = side < 0 and index != 2
            box(2, 3, 2, jacket, x=arm_x, y=shoulders - 3, z=z, sculpt=shape)
            if raised:
                box(2, 2, 4, jacket, x=arm_x, y=shoulders - 3, z=z + 1, sculpt=shape)
                box(2, 2, 2, STONE, x=arm_x, y=shoulders - 3, z=z + 3, sculpt=shape)
            else:
                box(2, 3, 2, jacket, x=arm_x, y=hip - 1, z=z + 1, sculpt=shape)
                box(2, 1, 2, STONE, x=arm_x, y=hip - 2, z=z + 1, sculpt=shape)
        box(3, 4, 3, STONE, x=x, y=face, z=z, sculpt=shape)
        box(3, 1, 3, RUBBER, x=x, y=face + 3, z=z, sculpt=shape)
        box(3, 3, 1, RUBBER, x=x, y=face + 1, z=z - 1, sculpt=shape)
        for eye in (-1, 1):
            shape.box(x + eye, face + 2, z + 1, EYE)
        shape.box(x, face + 1, z + 1, MOUTH)
        if hair == 'cap':
            box(4, 1, 3, GREEN, x=x, y=face + 4, z=z, sculpt=shape)
            box(3, 1, 1, GREEN, x=x, y=face + 3, z=z + 2, sculpt=shape)
        elif hair == 'braid':
            box(1, 6, 2, RUBBER, x=x + 2, y=face - 2, z=z - 1, sculpt=shape)
            box(1, 1, 1, MARK, x=x + 2, y=face - 1, z=z - 1, sculpt=shape)
        if with_packs or index == 0:
            box(4, 5, 2, WOOD, x=x, y=hip + 1, z=z - 2, sculpt=shape)
            box(3, 1, 2, MARK, x=x, y=hip + 5, z=z - 2, sculpt=shape)
            for strap in (-1, 1):
                box(1, 4, 1, WOOD, x=x + strap, y=hip + 2, z=z + 1, sculpt=shape)
        if index == 2:
            box(3, 3, 3, MARK, x=x + 3, y=hip - 6, z=z + 2, sculpt=shape)
            box(2, 2, 1, WOOD, x=x + 3, y=hip - 3, z=z + 2, sculpt=shape)
    return shape


def barrel_fire():
    shape = lp.drum(9, 10, METAL, DARK)
    shape.cut((-3, 3), (8, 10), (-3, 3))
    for x, z, height in ((-2, 1, 3), (0, -1, 6), (2, 1, 4)):
        box(3, height, 2, GLOW, x=x, y=8, z=z, sculpt=shape)
        box(1, 2, 1, MARK, x=x, y=height + 7, z=z, sculpt=shape)
    for x, y, z, width, depth in ((0, 14, 0, 3, 3), (1, 17, -1, 4, 3),
                                  (2, 20, -1, 5, 4), (4, 23, -2, 5, 4),
                                  (6, 26, -3, 6, 5), (9, 29, -4, 6, 5)):
        box(width, 3, depth, DARK if y < 23 else BODY, x=x, y=y, z=z, sculpt=shape)
        box(width - 2, 2, depth + 1, JOINT, x=x, y=y + 1, z=z, sculpt=shape)
    return shape


def warning_top():
    shape = box(48, 3, 5, DARK)
    for x in (-21, -8, 7, 21):
        box(2, 13, 2, METAL, x=x, y=3, sculpt=shape)
        box(2, 3, 6, WOOD, x=x, y=15, z=2, sculpt=shape)
    box(46, 1, 1, METAL, y=11, z=2, sculpt=shape)
    box(46, 1, 1, METAL, y=15, z=4, sculpt=shape)
    for x in range(-20, 21, 5):
        box(1, 4, 2, METAL, x=x, y=11, z=2, sculpt=shape)
        box(3, 1, 1, METAL, x=x + 1, y=15, z=4, sculpt=shape)
    for i, x in enumerate(range(-20, 21, 5)):
        box(4, 3, 1, MARK if i % 2 == 0 else DARK, x=x, z=-3, sculpt=shape)
    return shape


def intake_service_stair():
    shape = Sculpt()
    for step in range(14):
        z = 21 - step * 3
        y = step * 3
        box(15, 2, 4, METAL, y=y, z=z, sculpt=shape)
        box(13, 1, 2, MARK if step in (0, 6, 13) else DARK, y=y + 1, z=z + 1, sculpt=shape)
        for x in (-8, 8):
            box(2, 5, 4, DARK, x=x, y=y, z=z, sculpt=shape)
            if step % 3 == 0 or step == 13:
                box(1, 9, 1, METAL, x=x, y=y + 3, z=z, sculpt=shape)
            box(1, 3, 4, GREEN, x=x, y=y + 9, z=z, sculpt=shape)
    for x in (-8, 8):
        for y, z in ((13, 7), (27, -7), (41, -19)):
            box(2, y, 2, METAL, x=x, z=z, sculpt=shape)
            box(4, 2, 4, JOINT, x=x, z=z, sculpt=shape)
    box(18, 2, 8, METAL, y=40, z=-21, sculpt=shape)
    return shape


def open_ward_bay():
    shape = shop_level(service=True)
    shape.cut((-24, 23), (0, 30), (-32, -25))
    box(49, 1, 5, METAL, y=30, z=-29, sculpt=shape)
    for x in (-25, 24):
        box(2, 28, 2, GREEN, x=x, z=-31, sculpt=shape)
        box(4, 2, 5, STONE, x=x, z=-30, sculpt=shape)
    return shape


def yard_lane_paint():
    shape = Sculpt()
    for i, z in enumerate(range(-26, 29, 8)):
        for x in (-12, 12):
            box(2, 1, 5, MARK if i % 3 != 0 else STONE, x=x, z=z, sculpt=shape)
    for x in range(-9, 10, 3):
        box(2, 1, 4 if x in (-9, 9) else 2, STONE, x=x, z=22, sculpt=shape)
    return shape



def occupied_cot():
    shape = Sculpt()
    for x in (-4, 4):
        for z in (-9, 9):
            box(3, 2, 3, RUBBER, x=x, z=z, sculpt=shape)
            box(2, 7, 2, METAL, x=x, y=2, z=z, sculpt=shape)
        box(2, 2, 23, DARK, x=x, y=6, sculpt=shape)
        for z in (-6, 6):
            box(1, 4, 2, METAL, x=x, y=8, z=z, sculpt=shape)
    box(11, 2, 24, BODY, y=8, sculpt=shape)
    box(7, 1, 6, BODY, y=10, z=8, sculpt=shape)
    box(5, 2, 7, WOOD, y=10, z=2, sculpt=shape)
    box(7, 2, 2, WOOD, y=11, z=5, sculpt=shape)
    box(2, 2, 2, STONE, y=11, z=6, sculpt=shape)
    box(3, 3, 4, STONE, y=11, z=8, sculpt=shape)
    box(3, 3, 1, RUBBER, y=11, z=10, sculpt=shape)
    box(1, 2, 2, RUBBER, x=2, y=11, z=9, sculpt=shape)
    for x in (-1, 1):
        shape.box(x, 13, 8, EYE)
    shape.box(0, 13, 6, MOUTH)
    box(2, 2, 4, WOOD, x=-3, y=11, z=4, sculpt=shape)
    box(2, 1, 5, STONE, x=-3, y=11, z=0, sculpt=shape)
    box(2, 2, 4, WOOD, x=3, y=11, z=4, sculpt=shape)
    box(2, 1, 3, STONE, x=3, y=12, z=1, sculpt=shape)
    box(3, 1, 2, STONE, x=2, y=12, z=0, sculpt=shape)
    box(2, 1, 2, BODY, x=-3, y=12, z=1, sculpt=shape)
    box(7, 2, 5, GREEN, y=10, z=-1, sculpt=shape)
    box(7, 1, 1, BODY, y=12, z=1, sculpt=shape)
    box(6, 1, 8, GREEN, y=10, z=-6, sculpt=shape)
    for x, z in ((-1, -6), (1, -5)):
        box(2, 1, 7, GREEN, x=x, y=11, z=z, sculpt=shape)
        box(2, 1, 2, GREEN, x=x, y=12, z=z - 2, sculpt=shape)
    box(3, 2, 1, MARK, y=9, z=-12, sculpt=shape)
    return shape


def clinical_sign():
    shape = box(35, 9, 1, BODY)
    box(35, 1, 1, METAL, y=8, sculpt=shape)
    box(35, 1, 1, GREEN, y=0, sculpt=shape)
    box(7, 3, 1, MARK, x=-8, y=3, z=1, sculpt=shape)
    box(3, 7, 1, MARK, x=-8, y=1, z=1, sculpt=shape)
    for x, rows in (
        (0, ('.#.', '#.#', '###', '#.#', '#.#')),
        (4, ('###', '.#.', '.#.', '.#.', '###')),
        (8, ('##.', '#.#', '#.#', '#.#', '##.')),
    ):
        glyph(shape, rows, x, 2, 1, DARK)
    for x in (-15, 15):
        box(1, 1, 1, METAL, x=x, y=4, z=1, sculpt=shape)
    return shape


def clinical_supply_cases():
    shape = lp.latched_case(14, 7, 11, BODY, METAL, MARK)
    box(12, 5, 10, GREEN, y=7, z=-1, sculpt=shape)
    box(11, 1, 10, METAL, y=12, z=-1, sculpt=shape)
    box(6, 2, 1, BODY, y=9, z=4, sculpt=shape)
    box(2, 4, 1, MARK, y=8, z=5, sculpt=shape)
    box(6, 2, 1, MARK, y=9, z=5, sculpt=shape)
    return shape


def intake_floodlight():
    shape = box(4, 3, 4, METAL, z=1)
    box(9, 5, 3, DARK, y=2, sculpt=shape)
    box(7, 3, 1, GLOW, y=3, z=-2, sculpt=shape)
    box(10, 1, 5, METAL, y=7, z=-1, sculpt=shape)
    for x in (-3, 3):
        box(1, 1, 1, MARK, x=x, y=6, z=-2, sculpt=shape)
    return shape


def scene(board):
    add, place = board.add, board.place
    board.placement_at('Rail verge with seedheads', 4.2, 10.5)['position'] = [7.75, 0, 8.25]
    board.placement_at('Torn street light', -1.2, 8.7)['position'] = [-3.35, 0, 9.0]
    board.placement_at('Receiving table with clinical samples', 6.95, 10.05)['position'] = [9.75, 0, 9.42]
    add('Waiting evacuees in work clothes', waiting_survivors(False), 4.85, 11.4)
    add('Waiting evacuees with packs', waiting_survivors(True), -1.55, 8.52)
    colors = {
        'skin': '#b48262', 'primary': '#a76845', 'leather': '#7f6650',
        'detail': '#68877e', 'secondary': '#545760', 'trim': '#c6a775',
        'hair': '#473732', 'visor': '#433638',
    }
    board.set_palette('Waiting evacuees in work clothes', **colors)
    board.set_palette('Waiting evacuees with packs', **{**colors, 'skin': '#a7785f',
                                                         'primary': '#8e6851', 'detail': '#6f7f65'})
    add('Curbside barrel fire', barrel_fire(), 7.34, 12.2, 2)
    board.set_palette('Curbside barrel fire', accent='#ffc56b', trim='#f28842', primary='#666461',
                      skin='#645b56', secondary='#5a5551', metal='#695044')
    add('Intake wall wire and hazard stripe', warning_top(), -2.47, 15.8, height=3.76)
    place('Intake wall wire and hazard stripe', 7.05, 15.8, height=3.76)
    board.set_palette('Intake wall wire and hazard stripe', trim='#dfa551', metal='#929d90')
    add('Intake gate floodlight', intake_floodlight(), 0.15, 15.7, height=3.76)
    place('Intake gate floodlight', 5.43, 15.7, height=3.76)
    board.set_palette('Intake gate floodlight', accent='#ffe2a3', secondary='#434f4d',
                      metal='#868e7a', trim='#bf9251')
    board.light(0.15, 3.72, 15.29, '#ffe0b4', 3600, 7)
    board.light(5.43, 3.72, 15.29, '#ffe0b4', 4400, 8)
    board.light(5.03, 3.05, 25.00, '#ffddbc', 3700, 6)
    board.light(1.88, 2.57, 22.85, '#c4daf5', 1100, 5)
    board.placement_at('Quarantine canopy', 1.7, 21.5).update(position=[-2.45, 0, 21.15], turn=1)
    board.placement_at('Ambulance van', -1.2, 24.7).update(position=[7.66, 0, 24.34], turn=2)
    board.placement_at('Quarantine chain fence', 8, 25)['position'] = [8.68, 0, 25]
    board.placement_at('Abandoned stretcher and supply trolley', 5.1, 22.4).update(
        position=[-2.0, 0, 26.8], turn=0
    )
    board.remove_at('Sidewalk container', 3.7, 21.2, height=0.28)
    board.remove_at('Sidewalk container', 6.3, 21.6, height=0.28)
    add('Steel intake service stair', intake_service_stair(), 5.54, 21.14)
    board.set_palette('Steel intake service stair', detail='#53645e', metal='#8a9788', trim='#d2ad65')
    board.remove_at('Utility frontage bay', 3.4, 29.4)
    add('Open treatment yard service bay', open_ward_bay(), 3.4, 29.4)
    board.set_palette('Open treatment yard service bay', primary='#62594e', detail='#596f67', skin='#c5bca5')
    add('Treatment yard lane stripes', yard_lane_paint(), 2.45, 23.9, height=-0.085)
    board.set_palette('Treatment yard lane stripes', trim='#e5b75f', skin='#d1cbb2')
    place('Receiving table with clinical samples', -0.85, 24.0, 2)
    place('Intake patient trolley', -1.05, 22.11, 1)
    place('Dispensary strip light', -0.38, 22.12, 1, 2.24)
    board.placement_at('Battered municipal lamp', 8.8, 17.7)['position'] = [7.30, 0, 26.30]
    add('Patient treatment cot', occupied_cot(), 2.68, 23.95, 2)
    board.set_palette('Patient treatment cot', primary='#d6c4a6', detail='#527974', skin='#ba896e',
                      metal='#939486', trim='#b55440', leather='#81705e',
                      hair='#473732', visor='#503c3a')
    add('Red cross aid sign', clinical_sign(), 2.1, 16.32, height=2.48)
    board.set_palette('Red cross aid sign', primary='#d5c6aa', trim='#bb5341', secondary='#384948',
                      detail='#627d71', metal='#979b8f')
    add('Clinical supply cases', clinical_supply_cases(), 4.07, 21.20)
    place('Clinical supply cases', -0.60, 23.60, 1, 1.10)
    board.set_palette('Clinical supply cases', primary='#bbad92', detail='#586d64',
                      trim='#bc6551', metal='#828d7d')
    board.stage_actor('field_medic', 1.865, 23.92, yaw=90, pose=('Reach', 0.36))
    board.stage_actor('field_medic', 5.54, 22.22, y=1.40, yaw=20, pose=('Walk', 0.30))
