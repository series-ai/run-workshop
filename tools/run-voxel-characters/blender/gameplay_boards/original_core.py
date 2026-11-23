"""Motor pool training and road certification."""

import build_level_props as lp
import level_vehicles as vehicles
from level_geometry import box

from .actors import Actor
from .common import (
    BODY,
    DARK,
    GLASS,
    GLOW,
    JOINT,
    MARK,
    METAL,
    STONE,
    action,
    arch,
    floors,
    glyph,
    roof_bay,
    slab,
)
from .equipment import Item, handheld_light, loops, pack, radio

ACTORS = {
    'course_marshal': Actor('Course marshal', 'officer', 'human', 'cap',
                            {'skin': '#a66b4f', 'primary': '#446779', 'secondary': '#384658', 'trim': '#ebae49'}),
    'wheel_technician': Actor('Wheel technician', 'worker', 'human', 'soft_cap',
                               {'skin': '#bb8a6a', 'primary': '#446b83', 'secondary': '#48505b', 'detail': '#e9a342'}),
    'parts_clerk': Actor('Parts clerk', 'merchant', 'human', 'bonnet',
                         {'skin': '#825a42', 'primary': '#527c77', 'secondary': '#3c5862', 'detail': '#bca780'}),
    'test_driver': Actor('Test driver', 'civilian', 'human', 'helmet',
                         {'skin': '#bd927c', 'primary': '#ae683b', 'secondary': '#454652', 'trim': '#eeb858'}),
}


def gauge():
    shape = box(3, 13, 4, DARK)
    box(9, 9, 4, BODY, y=10, sculpt=shape)
    box(7, 6, 1, METAL, y=12, z=2, sculpt=shape)
    glyph(shape, ('..#', '.#.', '##.'), -1, 13, 3, DARK)
    box(2, 4, 3, METAL, y=19, sculpt=shape)
    return shape


def service_card():
    shape = box(9, 13, 2, MARK)
    box(7, 9, 1, METAL, y=1, z=1, sculpt=shape)
    for y, w in ((2, 4), (4, 5), (6, 4), (8, 5)):
        box(w, 1, 1, DARK, y=y, z=2, sculpt=shape)
    box(4, 2, 2, BODY, y=11, sculpt=shape)
    return shape


ITEMS = {
    'tire_gauge': Item('Tire gauge', 'tool', gauge(), (0, 5, 0)),
    'course_card': Item('Course card', 'document', service_card(), (0, 2, 0)),
    'shop_lamp': Item('Shop inspection lamp', 'tool', handheld_light(), (0, 3, 0)),
    'marshal_radio': Item('Marshal radio', 'tool', radio(), (0, 6, 0)),
    'wheel_strap': Item('Wheel retaining strap', 'tool', loops(), (0, 2, 0)),
    'bearing_case': Item('Bearing case', 'part', pack(12, 8, 8, shell=BODY), (0, 10, 0)),
    'seal_case': Item('Air seal case', 'part', pack(15, 8, 10, shell=MARK), (0, 10, 0)),
    'timing_key': Item('Timing key', 'key', box(4, 6, 4, GLASS, y=2, sculpt=box(7, 2, 5, METAL)), (0, 0, 0)),
    'test_log': Item('Road test log', 'document', service_card(), (0, 2, 0), {'trim': '#7298a2'}),
}


def brake_bed():
    shape = box(40, 3, 22, DARK)
    for z in (-7, 6):
        box(36, 2, 4, METAL, y=3, z=z, sculpt=shape)
        for x in (-12, 12):
            box(10, 2, 6, DARK, x=x, y=5, z=z, sculpt=shape)
            for j in (-2, 0, 2):
                box(9, 1, 1, STONE, x=x, y=7, z=z + j, sculpt=shape)
    for x in range(-18, 20, 4):
        box(2, 1, 1, MARK, x=x, y=3, z=10, sculpt=shape)
    return shape


def test_display():
    shape = box(24, 3, 10, DARK)
    for x in (-9, 8):
        box(3, 25, 3, BODY, x=x, y=3, sculpt=shape)
    box(24, 14, 5, BODY, y=18, sculpt=shape)
    box(20, 10, 1, DARK, y=20, z=3, sculpt=shape)
    glyph(shape, ('###...#.', '#....##.', '##....#.', '#.....#.', '###..###'), -8, 22, 4, GLOW, 2)
    return shape


def road_badge():
    shape = box(45, 11, 3, DARK)
    box(45, 1, 4, MARK, sculpt=shape)
    glyph(shape, ('###.###.###.###', '.#..#...#....#.',
                  '.#..##..###..#.', '.#..#.....#..#.', '.#..###.###..#.'), -15, 1, 2, METAL, 2)
    return shape


def annex(board):
    paving = [(x, z) for x in range(20, 41, 4) for z in range(-16, 13, 4)]
    floors(board, 'Certification yard concrete', slab(40, 40, face=STONE, joint=JOINT, seed=22), paving)
    board.set_palette('Certification yard concrete', skin='#8e9791', secondary='#576765')
    for x in (20, 24, 28, 32):
        board.place('Lane stripe', x, -7.5, height=-0.16)
    a = board.add
    p = board.place
    a('Certification bay roof', roof_bay(58, 42, 43, face=BODY), 24, -12.3)
    board.set_palette('Certification bay roof', primary='#4b6c81', trim='#a2aeb2')
    a('Certification wall', lp.clad_wall(40, 37, 4, BODY, DARK), 23.2, -14)
    p('Certification wall', 27.2, -14)
    p('Certification wall', 19.2, -14)
    p('Certification wall', 17.2, -15.9, 1)
    p('Certification wall', 17.2, -11.9, 1)
    p('Workshop column', 20.8, -13.65)
    p('Workshop column', 17.55, -11.8)
    p('Air plant roof vent', 20.7, -14.25, height=3.7)
    p('Roadside shade tree', 18.1, -12.85)
    p('Loaded parts rack', 18.05, -10.65, 1)
    a('Certification gable sash', lp.window_wall(BODY, METAL), 31.2, -13.72)
    p('Certification gable sash', 33.05, -11.7, 1)
    p('Certification gable sash', 33.05, -7.7, 1)
    p('Certification gable sash', 33.05, -3.7, 1)
    p('Certification gable sash', 33.05, .3, 1)
    a('Certification window infill', box(36, 15, 1, GLASS), 31.2, -14.05, height=.94)
    board.set_palette('Certification window infill', visor='#4d6976')
    p('Certification window infill', 33.38, -11.7, 1, .94)
    p('Certification window infill', 33.38, -7.7, 1, .94)
    p('Certification window infill', 33.38, -3.7, 1, .94)
    p('Certification window infill', 33.38, .3, 1, .94)
    a('Certification gable coping', lp.roof(40, 12, DARK), 31.2, -13.72, height=2.9)
    for z in (-11.7, -7.7, -3.7, .3):
        p('Certification gable coping', 33.05, z, 1, 2.9)
    p('Workshop air line', 32.5, -9.3, 1, 1.9)
    p('Air cooler fan', 32.68, -6.05, 1, .85)
    p('Site light', 32.2, -6.6)
    p('Yard poplar', 32.2, -12.35)
    a('Brake roller bed', brake_bed(), 24, -11.45)
    board.vehicle('Roller test pickup', 'brake test', vehicles.pickup(), 24, -11.7,
                  turn=1, height=.63, primary='#ad603c', trim='#deab60')
    a('Roller test display', test_display(), 24.15, -13.25)
    a('Certification badge', road_badge(), 24, -10.15, height=4.32)
    a('Brake bay toolboard', lp.window_wall(METAL, DARK), 27.2, -13.45)
    a('Brake test console', lp.case(11, 16, 8, BODY, GLASS, screen=True), 27.05, -11.35, 3)
    p('Workshop drawer chest', 22.15, -12.55)
    p('Workshop brake disc', 22.15, -12.45, height=1)
    p('Workshop air line', 25, -13.65, height=2.1)
    p('Workshop socket board', 26.65, -13.65, height=1.6)
    p('Inspection light strip', 24, -11, height=3.75)
    p('Axle inspection rollers', 21, -10.6)
    p('Oil pan', 22.4, -12.9)
    p('Inspection bay wall lamp', 22.4, -13.65, height=2)
    p('Stripe bollard', 20.25, -9.6)
    p('Stripe bollard', 26.8, -8.65)
    a('Road test gantry', arch(48, 34, 6, 31, face=BODY), 30, -5.9)
    board.set_palette('Road test gantry', primary='#235b72', trim='#e4ad4a', skin='#587786')
    p('Certification badge', 30, -6.25, 2, 3.36)
    a('Road test shelter', roof_bay(35, 36, 31, face=BODY), 20, -2.6)
    p('Training bench', 19.85, -3.4)
    p('Lane marshal flag rack', 20.65, -2.9)
    p('Calibration drive cabinet', 20.6, -3.9)
    p('Lane test signal', 27.75, -4.6, 2)
    p('Lane test signal', 32.18, -4.6, 2)
    for z in (-6.2, -4.9, -3.6, -2.3):
        p('Lane stripe', 30.05, z, 1, -.18)
    p('Training barrier end', 27.7, -3.4)
    p('Training barrier end', 27.7, -.95)
    p('Workshop drawer chest', 32.45, -7.5)
    p('Oil delivery drums', 32.25, -5.25)
    p('Lane timber rub rail', 32.35, -3, 1)
    p('Loaded parts rack', 32.15, -8.2, 1)
    p('Wheel stop kerb', 31.65, -.9, 1)
    p('Wheel stop kerb', 31.65, -3.4, 1)
    p('Marker cone', 28.2, -.2)
    p('Marker cone', 28.2, -2.25)
    p('Marker cone', 28.2, -4.1)
    board.vehicle('Certification pickup', 'road test', vehicles.pickup(ranger=True), 31.45, .4,
                  turn=2, primary='#527486', trim='#e6b461')
    for x in (18.5, 23.2, 27.2):
        p('Loaded parts rack', x, .65)
        p('Concrete edge unit', x, 1.7)
    p('Roadside shade tree', 20.4, 1.2)
    p('Yard poplar', 28.5, 1.3)
    p('Certification gable sash', 25.25, 2.5)
    p('Certification gable sash', 29.25, 2.5)
    p('Certification gable sash', 33.25, 2.5)
    for x in (25.25, 29.25, 33.25):
        p('Certification window infill', x, 2.83, height=.94)
        p('Certification gable coping', x, 2.5, height=2.9)
    p('Workshop pitched roof', 29.3, 4.3, height=2.98)
    p('Workshop pitched roof', 33.4, 4.3, height=2.98)
    p('Service line pole', 23.45, 2.7)
    p('Workshop column', 26.3, 2.12)
    p('Workshop column', 31.8, 2.12)
    for x, z in ((35.6, 4), (39, 1), (37, 8), (25, 9)):
        p('Roadside shade tree', x, z)
    for z in (2, 6, 10):
        p('Certification wall', 38.4, z, 1)
    p('Workshop drawer chest', 27.8, -10.4)
    p('Workshop brake disc', 27.8, -10.4, height=1)
    # The gauge stands on the near edge of the roller bed.
    a('Brake pressure dial', lp.case(6, 7, 3, MARK, GLASS, screen=True),
      24.65, -10.52, height=.87)
    a('Roller gauge pedestal', box(3, 9, 3, METAL), 24.65, -10.52)
    # The air line joins the pressure dial to the near wheel.
    line = box(6, 1, 1, DARK)
    box(1, 1, 4, DARK, x=2, z=-1, sculpt=line)
    box(2, 2, 2, METAL, x=2, z=-3, sculpt=line)
    a('Roller test air line', line, 24.97, -10.6, height=1.12)
    # A brass key projects from the blue fob between the two hands.
    key = box(2, 2, 1, GLASS)
    box(2, 1, 1, MARK, x=2, sculpt=key)
    box(1, 1, 1, MARK, x=2, y=1, sculpt=key)
    a('Release ignition key', key, 29.6, -.58, height=1.28)
    board.light(29.5, 2.65, -2, '#ffdaaa', 940, 5)
    board.light(24.25, 2.7, -9.55, '#ffd39b', 790, 8)
    board.light(27.5, 2.8, -9.7, '#b8deff', 85, 7)
    board.light(20, 2.5, -2.85, '#ffde9f', 65, 5)
    board.light(32.1, 3.3, -1.4, '#ffc288', 152, 7)
    board.light(27.35, 2.4, -2.55, '#b8dcff', 88, 7)


def extend(board):
    board.use = 'Complete the training lane, clear a service inspection, and deliver a certified pickup.'
    board.entry, board.exit = 'checkin', 'pickup_release'
    board.environment = dict(board.environment, zenith='#487eb4', horizon='#d3d9c1',
                             fillIntensity=1.48)
    annex(board)
    prop = board.prop_id
    board.point('checkin', 'Training check-in', 0, 8.5, actions=(
        action('player-spawn'), action('loadout', assets=('course_card', 'shop_lamp', 'marshal_radio'))))
    board.point('signal', 'Lane signal', 1.25, 4.75, actions=(
        action('briefing', assets=('course_marshal', prop('Lane test signal')), reward='marshal_briefed'),))
    board.point('timing', 'Timing lane', 1.25, 2.75, actions=(
        action('activate', assets=('timing_key', prop('Marshal timing table')),
               requires=('marshal_briefed',), reward='timing_recorded'),))
    board.point('calibration', 'Optical calibration court', -.5, 1.5, actions=(
        action('inspect', assets=('tire_gauge', prop('Optical alignment carrier')),
               requires=('timing_recorded',), reward='course_passed'),))
    board.point('crossing', 'Motor pool crossing', 6, -7.5, actions=(
        action('scout', assets=(prop('Motor pool trade sign'),)),))
    board.point('parts', 'Parts issue counter', 0, -17, actions=(
        action('trade', assets=('parts_clerk', 'bearing_case', 'wheel_strap'), reward='bearings_issued'),))
    board.point('lift', 'Wheel lift', -7.75, -12.75, actions=(
        action('repair', assets=('wheel_technician', 'bearing_case', prop('Hydraulic wheel lift')),
               requires=('bearings_issued',), reward='lift_inspected'),))
    board.point('air', 'Air plant check', -15.5, -21.5, actions=(
        action('repair', assets=('seal_case', prop('Air plant valve station')), reward='air_released'),))
    board.point('verge', 'Certification approach', 15, -7.5, actions=(
        action('scout', assets=(prop('Certification badge'),)),))
    board.point('roller_bed', 'Brake roller test', 24, -9.4, actions=(
        action('activate', assets=('tire_gauge', prop('Brake roller bed'), prop('Roller test pickup')), reward='brakes_tested'),))
    board.point('scores', 'Brake score console', 26.1, -10.85, actions=(
        action('record', assets=('test_log', prop('Brake test console')),
               requires=('brakes_tested',), reward='test_logged'),))
    board.point('shelter', 'Driver shelter', 20, -4.75, actions=(
        action('briefing', assets=('test_driver', prop('Road test shelter')), reward='driver_assigned'),))
    board.point('gantry', 'Road test gantry', 30, -7.6, actions=(
        action('unlock', assets=('test_log', prop('Road test gantry')),
               requires=('test_logged', 'driver_assigned'), reward='release_authorized'),))
    board.point('pickup_release', 'Certification pickup', 29.45, -1.6, actions=(
        action('extract', assets=(prop('Certification pickup'),), requires=('release_authorized',)),))

    board.link('checkin', 'signal')
    board.link('signal', 'timing', requires=('marshal_briefed',))
    board.link('timing', 'calibration', requires=('timing_recorded',))
    board.link('calibration', 'crossing', (1.25, 0, 8.75), (2.25, 0, 9.5), (3, 0, 9.25),
               (6, 0, 6.25), (6.5, 0, 3.75), (6.5, 0, -6.5), requires=('course_passed',))
    board.link('crossing', 'parts', (4.25, 0, -11.5), (1.75, 0, -13.25), (1.5, 0, -15.5))
    board.link('parts', 'lift', (1.75, 0, -15), (1.5, 0, -12), (-.25, 0, -11), (-3.5, 0, -9.25),
               (-4.75, 0, -8.75), (-8.5, 0, -8.75), (-8.75, 0, -9.25), (-8.75, 0, -11),
               (-8.25, 0, -11.75))
    board.link('lift', 'air', (-9.75, 0, -11.75), (-12.25, 0, -11.5), (-12.5, 0, -12.5), (-15, 0, -19.5))
    board.link('crossing', 'lift', (-8.25, 0, -8.75), (-8.75, 0, -9), (-8.75, 0, -10.75),
               (-8.25, 0, -11.75))
    board.link('lift', 'verge', (-8.25, 0, -11.75), (-8.75, 0, -10.75), (-8.75, 0, -9), (-8.25, 0, -8.75),
               requires=('lift_inspected',))
    board.link('air', 'verge', (-14.75, 0, -18.75), (-13.75, 0, -15.25), (-12.25, 0, -11.5),
               (-8, 0, -8.5), requires=('air_released',))
    board.link('verge', 'roller_bed', (18.75, 0, -7.6), (22.75, 0, -7.6))
    board.link('roller_bed', 'scores', (25.9, 0, -9.4), requires=('brakes_tested',))
    board.link('roller_bed', 'shelter', (22.75, 0, -7.6))
    board.link('scores', 'gantry', (26.15, 0, -8), (28.1, 0, -7.6), requires=('test_logged',))
    board.link('shelter', 'gantry', (23, 0, -5), (27, 0, -5), (28, 0, -7.6), requires=('test_logged',))
    board.link('gantry', 'pickup_release', (30, 0, -4.5), requires=('release_authorized',))

    for asset, x, z, yaw, pose in (
        ('course_marshal', 1.6, 5.25, -35, ('Idle', .7)),
        ('parts_clerk', .1, -17.6, 0, ('Idle', 1.3)),
        ('wheel_technician', -7.75, -13.4, 180, ('Reach', .5)),
    ):
        board.stage_actor(asset, x, z, yaw=yaw, pose=pose)
    board.stage_work('wheel_technician', 'ReadDial', 24.21, -10.2, yaw=95,
                     right=(24.59, 1.34, -10.38), look=-40, pitch=8)
    board.stage_work('test_driver', 'ReceiveKey', 30.06, -.62, yaw=-105,
                     left=(29.72, 1.33, -.62), look=-12)
    board.stage_work('course_marshal', 'IssueKey', 29.08, -.53, yaw=108,
                     right=(29.49, 1.32, -.56), look=12)
    board.shot('Brake certification bay', (23.52, 2.32, -2.45), (24.28, 2.48, -11.38))
    board.shot('Pickup release lane', (28.52, 2.16, -4.22), (30.23, 1.22, -.1))
