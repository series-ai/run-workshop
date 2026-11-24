"""Connected work areas and street details for Last Light."""

from creature_kit import Sculpt
from level_geometry import box
from . import city_quarantine
from .common import BODY, DARK, GLASS, GLOW, GREEN, JOINT, MARK, METAL, RUBBER, STONE, WOOD, glyph


def inspection_catwalk():
    shape = box(48, 2, 15, DARK)
    for x in range(-21, 24, 7):
        box(6, 1, 13, METAL, x=x, y=2, sculpt=shape)
        box(1, 2, 16, JOINT, x=x + 2, sculpt=shape)
    for z in (-7, 7):
        box(48, 2, 2, METAL, y=2, z=z, sculpt=shape)
        for x in (-21, -9, 4, 18):
            box(2, 12, 2, DARK, x=x, y=2, z=z, sculpt=shape)
        box(48, 2, 2, GREEN, y=12, z=z, sculpt=shape)
        box(48, 1, 1, METAL, y=7, z=z, sculpt=shape)
    for x in (-22, 22):
        box(6, 3, 18, STONE, x=x, sculpt=shape)
    for x in range(-17, 20, 6):
        box(4, 1, 1, MARK if x % 4 else RUBBER, x=x, y=3, z=-8, sculpt=shape)
    return shape


def hanging_intake_board():
    letters = (
        ('###', '.#.', '.#.', '.#.', '###'),
        ('#...#', '##..#', '#.#.#', '#..##', '#...#'),
        ('###', '.#.', '.#.', '.#.', '.#.'),
        ('.#.', '#.#', '###', '#.#', '#.#'),
        ('#.#', '##.', '##.', '#.#', '#.#'),
        ('###', '#..', '##.', '#..', '###'),
    )
    shape = box(43, 10, 3, DARK)
    box(41, 8, 1, GREEN, y=1, z=-2, sculpt=shape)
    letter_x = 15
    for letter in letters:
        for row, pixels in enumerate(letter):
            for col, pixel in enumerate(pixels):
                if pixel == '#':
                    box(1, 1, 1, STONE, x=letter_x - col, y=7 - row, z=-3, sculpt=shape)
        letter_x -= len(letter[0]) + 2
    for x in (-19, 19):
        box(1, 13, 1, METAL, x=x, sculpt=shape)
    box(5, 1, 1, MARK, x=0, y=1, z=-3, sculpt=shape)
    return shape


def ruined_service_roof():
    shape = box(64, 3, 62, JOINT)
    for x in (-29, 29):
        box(5, 9, 62, STONE, x=x, y=3, sculpt=shape)
        for z in (-27, 23):
            box(4, 19, 6, BODY, x=x, y=3, z=z, sculpt=shape)
    for z in (-29, 29):
        limits = (15, 13, 10, 5, 5, 8, 18, 19)
        for idx, height in enumerate(limits):
            x = -28 + idx * 8
            box(8, height, 3, BODY, x=x, y=3, z=z, sculpt=shape)
            box(8, 2, 4, STONE, x=x, y=3 + height, z=z, sculpt=shape)
        for x, exposure in ((-10, 7), (7, 9), (11, 7)):
            box(1, exposure, 1, METAL, x=x, y=8, z=z, sculpt=shape)
    for y, width, depth, color in (
        (3, 18, 16, WOOD), (7, 18, 16, GREEN), (16, 20, 18, DARK), (19, 16, 15, METAL)
    ):
        box(width, 5 if y != 7 else 13, depth, color, x=12, y=y, z=9, sculpt=shape)
    for z in (-14, -9, -4):
        box(23, 2, 4, WOOD, x=-12, y=4, z=z, sculpt=shape)
        box(2, 3, 5, METAL, x=-21, y=4, z=z, sculpt=shape)
    return shape


def wheel_cart():
    shape = Sculpt()
    for x in (-7, 7):
        for z in (-3, 3):
            box(4, 4, 2, RUBBER, x=x, z=z, sculpt=shape)
            box(2, 2, 1, METAL, x=x, y=1, z=z + (1 if z > 0 else -1), sculpt=shape)
        box(2, 7, 7, METAL, x=x, y=2, sculpt=shape)
    box(21, 2, 11, DARK, y=7, sculpt=shape)
    box(19, 1, 10, STONE, y=9, sculpt=shape)
    for i, length in enumerate((13, 15, 14)):
        box(length, 1, 8, GREEN if i != 1 else BODY, x=-2, y=10 + i, sculpt=shape)
    box(7, 2, 7, MARK, x=-5, y=13, sculpt=shape)
    for z in (-4, 4):
        box(3, 3, 1, METAL, x=10, y=8, z=z, sculpt=shape)
    return shape


def receiving_table():
    shape = Sculpt()
    for x in (-15, 15):
        for z in (-6, 6):
            box(2, 9, 2, METAL, x=x, z=z, sculpt=shape)
        box(3, 2, 15, JOINT, x=x, y=3, sculpt=shape)
    box(34, 3, 17, WOOD, y=8, sculpt=shape)
    box(25, 1, 8, STONE, x=-3, y=11, z=-3, sculpt=shape)
    for x in (-11, -7, -3):
        box(3, 3, 3, GLASS, x=x, y=12, z=4, sculpt=shape)
        box(2, 1, 2, DARK, x=x, y=15, z=4, sculpt=shape)
    box(7, 4, 9, DARK, x=10, y=11, sculpt=shape)
    box(5, 1, 6, MARK, x=10, y=15, sculpt=shape)
    box(9, 7, 7, GREEN, x=4, y=1, sculpt=shape)
    box(5, 2, 1, STONE, x=4, y=4, z=-4, sculpt=shape)
    return shape


def lane_chain():
    shape = Sculpt()
    for x in (-10, 10):
        box(5, 2, 5, DARK, x=x, sculpt=shape)
        box(2, 11, 2, METAL, x=x, y=2, sculpt=shape)
        box(3, 2, 3, MARK, x=x, y=12, sculpt=shape)
    for x in range(-8, 10, 2):
        box(2, 1, 1, GREEN if x % 4 else METAL, x=x, y=7 + abs(x) // 3, sculpt=shape)
    return shape


def platform_dispatch():
    shape = box(25, 4, 13, JOINT)
    for x in (-11, 11):
        box(2, 21, 10, DARK, x=x, y=4, sculpt=shape)
    box(25, 2, 13, METAL, y=24, sculpt=shape)
    box(23, 7, 3, GREEN, y=17, z=5, sculpt=shape)
    box(16, 3, 1, WOOD, y=18, z=7, sculpt=shape)
    glyph(shape, ('##.#.#', '#..###', '##...#'), -6, 20, 7, MARK)
    for x, z, h in ((-6, 0, 5), (2, 2, 6), (6, -2, 4)):
        box(6, h, 8, WOOD, x=x, y=4, z=z, sculpt=shape)
        box(1, h, 8, DARK, x=x + 2, y=4, z=z, sculpt=shape)
        box(5, 1, 1, STONE, x=x, y=4 + h // 2, z=z + 4, sculpt=shape)
    for x in (-8, 0, 8):
        box(4, 3, 1, GLOW if x == 0 else STONE, x=x, y=22, z=7, sculpt=shape)
    return shape


def sample_manifold():
    shape = box(27, 3, 14, JOINT)
    for x in (-9, 9):
        box(3, 19, 3, DARK, x=x, y=3, z=-4, sculpt=shape)
        box(22, 2, 8, METAL, y=6, z=-1, sculpt=shape)
    box(25, 4, 4, GREEN, y=15, z=-4, sculpt=shape)
    for x in (-7, 1, 9):
        box(4, 11, 4, GREEN, x=x, y=7, z=-4, sculpt=shape)
        box(5, 2, 5, METAL, x=x, y=16, z=-4, sculpt=shape)
        box(1, 4, 1, METAL, x=x, y=17, z=-2, sculpt=shape)
        box(5, 1, 3, BODY, x=x, y=20, z=-2, sculpt=shape)
        box(2, 4, 2, GLASS, x=x, y=8, z=2, sculpt=shape)
        box(3, 1, 3, STONE, x=x, y=12, z=2, sculpt=shape)
    box(17, 6, 2, DARK, y=20, z=-5, sculpt=shape)
    glyph(shape, ('###..#.', '#.#.###', '###..#.'), -6, 21, -7, MARK)
    return shape


def fracture_screen():
    shape = Sculpt()
    for x in (-28, 28):
        box(4, 38, 5, METAL, x=x, sculpt=shape)
        box(7, 4, 7, JOINT, x=x, sculpt=shape)
    for y in (4, 18, 33):
        box(56, 2, 3, DARK, y=y, sculpt=shape)
    for i, x in enumerate(range(-25, 29, 5)):
        limit = (31, 32, 29, 23, 17, 12, 14, 20, 27, 30, 30)[i]
        box(5, limit, 2, GREEN if i < 5 else BODY, x=x, y=4, sculpt=shape)
        box(1, limit, 1, METAL, x=x - 2, y=4, z=1, sculpt=shape)
    for x in (-20, -13, 12, 21):
        box(3, 3, 3, MARK, x=x, y=9, z=-1, sculpt=shape)
    return shape



def burned_service_axle():
    shape = box(31, 2, 8, DARK)
    for x in (-12, 12):
        box(9, 11, 4, RUBBER, x=x, z=-2, sculpt=shape)
        box(11, 7, 4, RUBBER, x=x, y=2, z=-2, sculpt=shape)
        box(5, 5, 1, METAL, x=x, y=3, z=-5, sculpt=shape)
        box(2, 2, 1, DARK, x=x, y=4, z=-6, sculpt=shape)
    box(22, 3, 3, METAL, y=4, sculpt=shape)
    for x, y, width, depth in ((-10, 10, 9, 7), (-3, 9, 7, 6), (4, 7, 6, 7), (10, 4, 6, 8)):
        box(width, 3, depth, BODY, x=x, y=y, z=2, sculpt=shape)
        box(width - 2, 1, depth - 2, DARK, x=x, y=y + 2, z=2, sculpt=shape)
    box(3, 1, 1, MARK, x=-11, y=12, z=-1, sculpt=shape)
    box(2, 1, 1, GLOW, x=-13, y=12, z=-1, sculpt=shape)
    return shape


def scene(board):
    add, place = board.add, board.place

    add('Raised inspection catwalk', inspection_catwalk(), 2.85, 18, height=3.9)
    board.set_palette('Raised inspection catwalk', detail='#547971', metal='#88968a', trim='#c6a666')
    add('Suspended intake direction board', hanging_intake_board(), 2.85, 17.02, height=4.08)
    board.set_palette('Suspended intake direction board', detail='#487465', skin='#e9d9b3', trim='#dca154')
    place('Raised inspection catwalk', -2.32, 27.9, height=6.3)
    board.remove_at('Tenement roof and vents', -8, 28.2, height=9.3)
    add('Ruined rooftop service parapet', ruined_service_roof(), -8, 28.2, height=9.3)
    board.remove_at('Tenement roof and vents', 25.4, 29.2, height=12.3)
    place('Ruined rooftop service parapet', 25.4, 29.2, 2, 12.3)
    board.set_palette('Ruined rooftop service parapet', primary='#a18061', detail='#4b776b',
                      skin='#b8ae96', metal='#7f8b84')
    board.remove_at('Pharmacy water tower', -8, 28.2, height=10.2)
    place('Pharmacy water tower', 3.2, 29.6, height=9.64)
    board.remove_at('Inspection wall and notices', 29.1, 20.7)
    place('Inspection wall and notices', 10.65, 16.0, 2)
    add('Intake patient trolley', wheel_cart(), -0.85, 12.4, 1)
    place('Intake patient trolley', 7.8, 10.85)
    place('Intake patient trolley', 25.95, 2.85, 1)
    place('Intake patient trolley', -17.8, -47.7, 1)
    board.set_palette('Intake patient trolley', skin='#e2d6b9', primary='#9d593e', detail='#477066')
    add('Receiving table with clinical samples', receiving_table(), 6.95, 10.05, 2)
    place('Receiving table with clinical samples', 23.4, -9.65, 1)
    place('Receiving table with clinical samples', -17.6, -50.9, 3)
    place('Receiving table with clinical samples', 19.0, -68.6, 1)
    board.set_palette('Receiving table with clinical samples', visor='#5d919a', leather='#a88d68', trim='#e4bd7f')
    add('Linked queue stanchions', lane_chain(), 0.55, 9.6, 1)
    for x, z, turn in ((3.05, 8.65, 1), (3.12, 11.1, 1), (-18.6, -43.8, 1), (-18.6, -46.2, 1),
                       (19.4, -65.3, 1), (19.4, -70.1, 1), (22.58, 3.88, 2)):
        place('Linked queue stanchions', x, z, turn)
    board.set_palette('Linked queue stanchions', trim='#e3aa57', metal='#91968e')
    add('Burned service axle', burned_service_axle(), 9.98, 12.34, 2)
    board.set_palette('Burned service axle', primary='#69554a', secondary='#493e39',
                      metal='#888466', accent='#cf8544')
    place('Ambulance van', -1.13, 10.15, 1)
    place('Ambulance van', 28.9, 4.5, 2)

    add('South Line dispatch hutch', platform_dispatch(), -20.72, -41.9, 1)
    place('South Line dispatch hutch', -20.7, -49.7, 1)
    place('South Line dispatch hutch', -20.43, -75.5, 1)
    board.set_palette('South Line dispatch hutch', detail='#417069', accent='#a7ecb6', leather='#a08260')
    place('Iron tenement balcony', -23, -55.0, 2, 3.43)
    place('Broken curb', -12.8, -44.5, 1)
    place('Rail verge with seedheads', -11.9, -44.3, 1)
    add('Waterworks sample valve rack', sample_manifold(), 28.25, -67.65, 0)
    place('Waterworks sample valve rack', 29.44, -75.9, 1)
    place('Waterworks sample valve rack', 18.6, -80.4, 1)
    board.set_palette('Waterworks sample valve rack', primary='#b56146', detail='#467e76',
                      visor='#88bdb8', trim='#e0b465')

    add('Torn service yard screen', fracture_screen(), 30.3, -80.65)
    place('Torn service yard screen', 15.8, -82.65, 1)
    place('Torn service yard screen', 11.5, 16.75, 0)
    board.set_palette('Torn service yard screen', primary='#816d57', detail='#527975', trim='#d5b379')
    place('Stadium medical pallet', 27.6, 7.05, 1)
    place('Stacked maintenance cable drums', 22.55, 8.3, 1)
    place('Rail verge with seedheads', 31.05, 6.5, 1)
    place('Quarantine cloth marker', 28.8, 7.6, 2, 2.55)
    board.light(2.8, 3.6, 17.1, '#c9eadb', 1800, 7)
    board.light(7.66, 1.18, 11.96, '#ffab55', 1450, 6)
    board.light(2.97, 1.99, 24.55, '#ffdfb7', 2100, 5)
    for actor_id, x, z, heading in (
        ('field_medic', 0.44, 12.14, 114),
        ('runner', 2.58, 10.95, 148),
        ('field_medic', -18.56, -41.65, 307),
        ('shambler', -14.25, -41.45, 246),
        ('field_medic', 25.3, -65.1, 182),
        ('runner', 21.7, -7.3, 325),
        ('armored_infected', 20.6, -5.7, 306),
    ):
        board.stage_actor(actor_id, x, z, yaw=heading)
    board.stage_actor('field_medic', -1.55, 17.65, y=4.3, yaw=144)
    board.stage_actor('field_medic', -2.52, 27.9, y=6.6, yaw=112)
    city_quarantine.scene(board)
