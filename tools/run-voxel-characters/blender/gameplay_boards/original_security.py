"""Freight inspection and dispatch at the transit checkpoint."""

import build_level_props as lp
from level_geometry import box

from . import equipment as eq
from .actors import Actor
from .common import (BODY, DARK, GLASS, GLOW, GREEN, JOINT, MARK, METAL,
                     STONE, WOOD, action, arch, floors, glyph, roof_bay, screen, shelf, slab)

ACTORS = {
    'freight_inspector': Actor('Freight inspector', 'officer', 'human', 'cap',
                               {'skin': '#a87252', 'hair': '#4a352d', 'primary': '#3d7584',
                                'secondary': '#344956', 'detail': '#c69a53'}),
    'parcel_clerk': Actor('Parcel clerk', 'civilian', 'human', 'soft_cap',
                         {'skin': '#bf8f71', 'hair': '#49342a', 'primary': '#ad693e',
                          'secondary': '#5d534b', 'detail': '#dfad65'}),
    'service_technician': Actor('Service technician', 'worker', 'human', 'helmet',
                               {'skin': '#85583d', 'hair': '#40302b', 'primary': '#527474',
                                'secondary': '#44585d', 'detail': '#dba850'}),
    'dispatch_coordinator': Actor('Dispatch coordinator', 'merchant', 'human', 'cap',
                                  {'skin': '#bc886d', 'hair': '#563f35', 'primary': '#55758c',
                                   'secondary': '#3d525f', 'detail': '#c5ab76'}),
}

ITEMS = {
    'terminal_ticket': eq.Item('Transit ticket', 'credential', eq.range_card()),
    'freight_manifest': eq.Item('Freight manifest', 'document', eq.folded_map()),
    'parcel_seal': eq.Item('Parcel seal', 'evidence', eq.royal_seal()),
    'calibration_block': eq.Item('Calibration block', 'tool', eq.pack(9, 7, 6, shell=MARK), (0, 8, 0)),
    'service_pass': eq.Item('Service pass', 'credential', eq.steward_letter()),
    'inspection_light': eq.Item('Inspection light', 'tool', eq.handheld_light(), (0, 2, 0)),
    'terminal_radio': eq.Item('Terminal radio', 'communications', eq.radio(), (0, 7, 0)),
    'dispatch_pouch': eq.Item('Dispatch pouch', 'container', eq.pack(14, 10, 6), (0, 11, 0)),
    'label_roll': eq.Item('Roll of parcel labels', 'supply', lp.drum(11, 5, MARK, METAL)),
    'service_gauge': eq.Item('Inspection gauge', 'tool', eq.pressure_gauge()),
}

TEAL = dict(primary='#397987', secondary='#344956', trim='#ecbe72', metal='#95a6a7',
            skin='#b7bdb7', accent='#7de7d6', visor='#82c0c8', detail='#e7a655')
SLATE = dict(primary='#4d6575', secondary='#333e49', skin='#8b9c9f', metal='#7c8c95',
             trim='#dce5cd', visor='#77a9b1', detail='#dbae55', accent='#7adfd7')
AMBER = dict(primary='#ad6c37', secondary='#495159', trim='#f4cd71', metal='#a5aeb0',
             skin='#c2beb2', accent='#f5d683', visor='#85aab2', detail='#b67f3e')
PORCELAIN = dict(primary='#c0c5b8', secondary='#456575', skin='#adb9b8',
                 metal='#8d9b9a', trim='#f3cb6c', accent='#9beee2', visor='#61a8b5')

NUMBERS = {
    1: ('.#.', '##.', '.#.', '.#.', '###'),
    2: ('###', '..#', '###', '#..', '###'),
    3: ('###', '..#', '.##', '..#', '###'),
    4: ('#.#', '#.#', '###', '..#', '..#'),
}


def sign(number, width=27):
    shape = box(width, 11, 3, DARK)
    box(width - 2, 9, 1, BODY, y=1, z=2, sculpt=shape)
    glyph(shape, ('##.', '#.#', '##.', '#.#', '##.'), -6, 3, 3, MARK)
    glyph(shape, NUMBERS[number], 2, 3, 3, MARK)
    box(width - 4, 1, 1, GLASS, y=1, z=3, sculpt=shape)
    return shape


def facade(width, height):
    shape = box(width, height, 4, BODY)
    box(width, 5, 6, STONE, sculpt=shape)
    box(width + 2, 3, 7, DARK, y=height - 1, sculpt=shape)
    for x in range(-width // 2 + 5, width // 2 - 4, 10):
        box(8, 14, 1, GLASS, x=x, y=height - 19, z=2, sculpt=shape)
        box(8, 1, 2, METAL, x=x, y=height - 13, z=3, sculpt=shape)
        box(1, 14, 2, METAL, x=x, y=height - 19, z=3, sculpt=shape)
    box(width, 2, 2, MARK, y=6, z=2, sculpt=shape)
    return shape


def transfer_frame(width, height):
    shape = box(width, 5, 10, BODY, y=height - 4)
    for x in (-width // 2 + 3, width // 2 - 3):
        box(7, height, 9, DARK, x=x, sculpt=shape)
        box(9, 2, 12, METAL, x=x, sculpt=shape)
        box(3, height - 7, 2, BODY, x=x, y=4, z=5, sculpt=shape)
        box(2, 6, 2, GLOW, x=x, y=height - 11, z=6, sculpt=shape)
    box(width - 13, 2, 12, METAL, y=height, sculpt=shape)
    box(width - 16, 1, 2, MARK, y=height - 2, z=5, sculpt=shape)
    return shape


def roller_line():
    shape = box(13, 3, 34, DARK, y=7)
    for x in (-6, 6):
        for z in (-14, 14):
            box(3, 8, 3, METAL, x=x, z=z, sculpt=shape)
        box(2, 3, 36, BODY, x=x, y=8, sculpt=shape)
    for z in range(-15, 17, 3):
        box(10, 2, 2, METAL, y=9, z=z, sculpt=shape)
    for z in (-10, 6):
        box(9, 5, 8, WOOD, y=11, z=z, sculpt=shape)
        box(2, 1, 8, MARK, y=16, z=z, sculpt=shape)
    return shape


def reading_console(width, mark):
    shape = lp.counter(width, 9, BODY, METAL, shelf=True)
    box(width - 3, 4, 8, DARK, y=10, sculpt=shape)
    box(width - 4, 11, 3, METAL, y=14, z=-3, sculpt=shape)
    box(width - 6, 8, 1, GLASS, y=16, z=-1, sculpt=shape)
    for x in range(-width // 2 + 5, width // 2 - 3, 4):
        box(2, 1, 1, GLOW, x=x, y=19 + x % 3, z=0, sculpt=shape)
        box(2, 1, 2, MARK if x % 3 else GREEN, x=x, y=14, z=2, sculpt=shape)
    glyph(shape, NUMBERS[mark], -1, 3, 5, MARK)
    return shape


def parcel_scale():
    shape = box(14, 9, 13, BODY)
    box(17, 2, 15, METAL, y=9, sculpt=shape)
    box(10, 6, 8, WOOD, y=11, sculpt=shape)
    box(2, 6, 9, MARK, y=11, sculpt=shape)
    box(2, 1, 9, MARK, y=17, sculpt=shape)
    box(1, 2, 3, STONE, x=5, y=14, z=-2, sculpt=shape)
    box(1, 6, 2, MARK, x=5, y=11, z=2, sculpt=shape)
    box(10, 1, 2, MARK, y=17, z=2, sculpt=shape)
    return shape


def weight_indicator():
    shape = box(5, 13, 5, METAL)
    box(18, 9, 3, DARK, y=13, sculpt=shape)
    glyph(shape, NUMBERS[1], -6, 15, 2, GLOW)
    glyph(shape, NUMBERS[2], -2, 15, 2, GLOW)
    box(2, 1, 1, MARK, x=5, y=15, z=2, sculpt=shape)
    return shape


def parcel_cage():
    shape = lp.pallet(25, 18, WOOD, DARK)
    for x in (-11, 11):
        for z in (-8, 8):
            box(2, 19, 2, METAL, x=x, y=2, z=z, sculpt=shape)
    for y in (5, 10, 15, 20):
        for x in (-11, 11):
            box(1, 1, 18, BODY, x=x, y=y, sculpt=shape)
        box(23, 1, 1, BODY, y=y, z=-8, sculpt=shape)
    for x, y, z, w, d in ((-5, 3, -2, 10, 9), (5, 3, -4, 9, 8), (-4, 10, -3, 7, 8),
                          (3, 3, 4, 14, 6)):
        box(w, 7, d, WOOD, x=x, y=y, z=z, sculpt=shape)
        box(2, 1, d, MARK, x=x, y=y + 7, z=z, sculpt=shape)
    return shape


def canopy_light():
    shape = box(25, 2, 5, METAL)
    box(23, 1, 3, DARK, sculpt=shape)
    box(21, 1, 2, GLOW, sculpt=shape)
    return shape


def traffic_floor():
    shape = slab(40, 40, face=DARK, joint=METAL, seed=6)
    for x in (-16, 16):
        box(2, 1, 40, MARK, x=x, y=2, sculpt=shape)
    for z in (-14, 2, 18):
        box(1, 1, 8, STONE, y=2, z=z, sculpt=shape)
    return shape


def threshold_floor():
    shape = slab(40, 40, face=BODY, joint=METAL, seed=5)
    for z in (-9, 9):
        for x in range(-16, 18, 5):
            box(3, 1, 8, MARK, x=x, y=2, z=z, sculpt=shape)
    return shape


def add_set(board, pieces):
    for label, shape, x, z, turn, y, palette in pieces:
        board.add(label, shape, x, z, turn, y)
        board.set_palette(label, **palette)


def freight_district(board):
    tiles = [(x, z) for x in range(-12, 13, 4) for z in (12, 16, 20, 24, 28, 32)
             if x or z == 32]
    floors(board, 'Terminal aggregate apron', slab(40, 40, face=STONE, joint=JOINT, seed=4), tiles)
    board.set_palette('Terminal aggregate apron', skin='#7b8990')
    floors(board, 'Freight lane asphalt', traffic_floor(), [(0, z) for z in (12, 16, 24, 28)])
    board.set_palette('Freight lane asphalt', **SLATE)
    floors(board, 'Inspection crossing inlay', threshold_floor(), [(0, 20)])
    board.set_palette('Inspection crossing inlay', **SLATE)
    floors(board, 'Terminal approach infill', slab(40, 40, face=STONE, joint=JOINT, seed=8),
           [(x, 8) for x in (-12, -8, 8, 12)])
    board.set_palette('Terminal approach infill', skin='#858f91')

    add_set(board, (
        ('Freight inspection shed wall', facade(74, 43), -11, 18, 1, 0, TEAL),
        ('Freight inspection shed canopy', roof_bay(54, 79, 38, face=BODY), -9.2, 18, 0, 0, TEAL),
        ('Freight intake storage wall', facade(52, 36), -10.9, 10.7, 1, 0, SLATE),
        ('Freight receiving dock roof', roof_bay(52, 50, 30, face=BODY), -9.85, 11.1, 0, 0, SLATE),
        ('Freight roller table', roller_line(), -8.8, 15.3, 0, 0, TEAL),
        ('Calibration tunnel frame', transfer_frame(29, 25), -9.8, 18.2, 1, 0, PORCELAIN),
        ('Parcel load cell', parcel_scale(), -7.93, 18.4, 0, 0, AMBER),
        ('Bench calibration reader', weight_indicator(), -8.75, 19.83, 1, 0, PORCELAIN),
        ('Parcel receipt console', reading_console(19, 1), -7.65, 15.05, 1, 0, TEAL),
        ('Manifest sorting desk', lp.counter(26, 12, BODY, MARK, shelf=True), -5.45, 10.0, 0, 0, TEAL),
        ('Parcel queue cages', parcel_cage(), -10.2, 15.2, 0, 0, AMBER),
        ('Empty transfer pallet', lp.pallet(24, 21, WOOD, DARK), -9.8, 13.2, 1, 0, AMBER),
        ('Waiting shipment cases', lp.latched_case(16, 12, 13, BODY, DARK, MARK), -8.4, 16.8, 0, 0, AMBER),
        ('Stamped freight tray', lp.produce_bin(MARK), -5.48, 10.0, 0, .9, AMBER),
        ('Padded sample carrier', lp.latched_case(12, 6, 11, BODY, DARK, MARK), -4.6, 9.95, 0, .9, TEAL),
        ('Freight printer', lp.case(9, 6, 11, DARK, BODY, screen=True), -6.27, 10.0, 0, .9, PORCELAIN),
        ('Shipment cart handle', lp.post(13, METAL, DARK, arm=True), -9.9, 13.9, 0, 0, SLATE),
        ('Received parcel stack', lp.cargo_rack(WOOD), -10.2, 20.5, 1, 0, AMBER),
        ('Parcel sorting sign', sign(1), -8.8, 14.9, 1, 2.5, TEAL),
        ('Calibration station sign', sign(2), -9.3, 19.4, 1, 2.75, TEAL),
        ('Terminal lower utility railing', screen(36, 10), -5.6, 15.7, 1, 0, SLATE),
        ('Parcel pad conduit', lp.service_pipes(), -10.3, 17.7, 1, 2.7, SLATE),
        ('Portable inspection lamp', lp.post(22, METAL, GLOW, arm=True), -9.9, 17.35, 1, 0, AMBER),
        ('Freight intake drainage grate', lp.drainage_grate(), -6.5, 13.3, 0, -.2, SLATE),
        ('Inspection belt recovery screen', screen(27, 17), -9.2, 21.1, 0, 0, TEAL),
        ('Sample cabinet', lp.case(16, 22, 9, BODY, DARK, screen=True), -9.2, 18.3, 1, 0, PORCELAIN),
    ))
    for x, z in ((-10.3, 16.9), (-10.15, 11.1), (10.8, 10.4), (10.05, 18)):
        board.place('Parcel queue cages', x, z, 1)
    for z in (13.1, 17.8, 20.3):
        board.place('Gate post', -2.4, z)
        board.place('Gate post', 2.4, z)
    for x, z in ((-5.1, 12.8), (3.95, 13.6), (3.95, 17.7)):
        board.place('Survey mast', x, z, 2)


def service_district(board):
    add_set(board, (
        ('Service workroom wall', facade(63, 37), 11, 13.2, 3, 0, SLATE),
        ('Service workroom canopy', roof_bay(45, 69, 31, face=BODY), 9.6, 13.2, 0, 0, PORCELAIN),
        ('Service window return', lp.window_wall(BODY, METAL), 10.1, 16.5, 2, 0, TEAL),
        ('Equipment issue counter', reading_console(20, 3), 8.8, 14.1, 3, 0, TEAL),
        ('Spare credential locker', lp.case(17, 23, 11, BODY, DARK, screen=True), 8.9, 16.2, 3, 0, AMBER),
        ('Service pinboard', sign(3), 9.5, 14.0, 3, 2.65, TEAL),
        ('Seal storage drawers', lp.crate(17, 11, 13, BODY, METAL), 9.65, 12.6, 3, 0, TEAL),
        ('Battery charging shelf', shelf(20, 11, 22), 10.25, 11.0, 3, 0, SLATE),
        ('Spare reader battery pack', lp.latched_case(9, 8, 9, GREEN, METAL, MARK), 10.13, 11.25, 3, 1.0, TEAL),
        ('Inspection tool chest', lp.latched_case(17, 13, 12, BODY, METAL, MARK), 9.65, 17.3, 3, 0, AMBER),
        ('Temporary traffic barriers', lp.lane_signal_beam(), 9.45, 19.25, 3, 0, AMBER),
        ('Service return divider', screen(35, 22), 11.2, 20.3, 1, 0, SLATE),
        ('Service entrance call post', lp.case(8, 14, 7, BODY, DARK, screen=True), 7.95, 19.6, 3, 0, AMBER),
        ('Manual lane bypass portal', arch(33, 32, 7, 21, face=BODY), 7, 21.55, 0, 0, TEAL),
        ('Lane status signal', lp.lane_signal_beam(), 0, 21.6, 0, 3.15, AMBER),
        ('Main inspection release portal', transfer_frame(42, 36), 0, 21.5, 0, 0, TEAL),
        ('Terminal zone divider', lp.panel(43, 25, 5, DARK, MARK, rows=True), -3.9, 21.55, 0, 0, SLATE),
        ('Inspection lane release pedestal', reading_console(13, 2), 1.7, 19.2, 3, 0, PORCELAIN),
        ('Terminal zone direction sign', sign(4, 31), 0, 21.5, 0, 3.7, TEAL),
        ('Service return floor marker', lp.inlay(18, 8, MARK, DARK), 7, 20.6, 0, -.2, SLATE),
    ))
    for x in (-8.2, -12.5, 4.0, 10.4):
        board.place('Terminal zone divider', x, 21.55)
    for z in (12.5, 17.5):
        board.place('Battery locker', 10.3, z, 3)
    board.place('Patrol rover', 11.5, 18.0, 1)


def dispatch_district(board):
    label_tray = box(5, 1, 3, METAL)
    box(3, 1, 2, STONE, x=-1, y=1, sculpt=label_tray)
    box(1, 1, 1, MARK, x=-1, y=1, sculpt=label_tray)
    add_set(board, (
        ('Freight concourse return wall', facade(62, 40), -9, 22.25, 2, 0, SLATE),
        ('Dispatch concourse window wall', facade(56, 45), -4.5, 26.7, 1, 0, TEAL),
        ('Dispatch concourse eave', roof_bay(94, 47, 42, face=BODY), 0, 29.2, 0, 0, TEAL),
        ('Dispatch roof extension', box(100, 2, 52, BODY), 0, 24.45, 0, 4.08, TEAL),
        ('Outbound departures east wall', facade(76, 43), 4.88, 29.56, 3, 0, SLATE),
        ('Outbound canopy side return', box(46, 6, 117, BODY), 6.85, 28.0, 0, 3.8, TEAL),
        ('Outbound canopy end fascia', box(100, 5, 26, BODY), 1.75, 32.72, 0, 3.82, TEAL),
        ('Dispatch roof light', box(42, 3, 5, GLASS), 0, 29.2, 0, 4.27, TEAL),
        ('Dispatch bay tower', facade(48, 64), -4.5, 32.25, 2, 0, TEAL),
        ('Dispatch east tower', facade(48, 58), 4.5, 32.25, 2, 0, SLATE),
        ('Dispatch overhead clock gantry', transfer_frame(40, 42), 0, 32.0, 0, 0, TEAL),
        ('Dispatch overhead clock', lp.case(13, 11, 5, DARK, BODY, screen=True), 0, 32.2, 0, 4.12, PORCELAIN),
        ('Dispatch check console', reading_console(25, 4), 1.65, 27.25, 3, 0, PORCELAIN),
        ('Printed dispatch label and tray', label_tray, 1.26, 27.4, 0, 1.29, PORCELAIN),
        ('Dispatcher sorter counter', lp.counter(26, 12, BODY, MARK, shelf=True), -2.2, 24.45, 1, 0, TEAL),
        ('Dispatch sorted document tray', lp.produce_bin(MARK), -2.2, 24.44, 1, .9, AMBER),
        ('Dispatch communications rack', lp.cargo_rack(BODY), -3.75, 27.15, 1, 0, SLATE),
        ('Dispatch canopy light strip', canopy_light(), 0, 29.5, 0, 3.8, TEAL),
        ('Outbound inspection stencil', lp.inlay(23, 12, METAL, MARK), 0, 29.5, 0, -.155, SLATE),
        ('Dispatch queue divider', screen(31, 11), 2.8, 30.2, 1, 0, TEAL),
        ('Freight crate destination board', sign(4), 2.45, 28.5, 3, 2.15, TEAL),
        ('Dispatch supplies locker', lp.case(17, 23, 10, BODY, DARK), 4.35, 28.1, 3, 0, AMBER),
        ('Outbound trolley pallet', lp.pallet(26, 12, WOOD, METAL), -2.8, 30.9, 1, 0, SLATE),
    ))
    floors(board, 'Dispatch backdrop pavement', slab(40, 40, face=STONE, joint=JOINT, seed=16),
           [(x, 36) for x in range(-12, 13, 4)])
    board.set_palette('Dispatch backdrop pavement', **SLATE)
    add_set(board, (
        ('Dispatch glazed rear facade', facade(72, 50), 0, 36.95, 2, 0, SLATE),
        ('Dispatch canopy rear wall', facade(70, 38), 7.2, 36.8, 2, 0, TEAL),
        ('Dispatch carriage fascia', facade(66, 37), -6.9, 36.85, 2, 0, PORCELAIN),
    ))
    for z in (23.1, 28.4, 31):
        board.place('Transit bench island', -3.6, z, 1)
    board.place('Evidence case', -2.8, 30.9, height=.4)
    board.place('Survey mast', 4.0, 25.2, 2)
    board.place('Service workroom wall', 10.6, 27.1, 3)


def gameplay(board):
    p = board.prop_id
    point = board.point
    board.entry, board.exit = 'terminal_approach', 'dispatch_exit'
    board.use = 'Log and inspect a freight parcel. Obtain a lane release, then send it from dispatch.'
    point('terminal_approach', 'Transit checkpoint approach', -.45, 10.1,
          actions=(action('inspect', assets=(p('Access doorway'), p('People counter'))),))
    point('scanner_arch', 'Original inspection arch', -.62, 6.1,
          actions=(action('scan', assets=(p('Scanner arch'), 'terminal_ticket')),))
    point('inspection_queue', 'Freight inspection queue', 0, 12.6,
          actions=(action('gather', assets=('terminal_ticket', p('Freight lane asphalt')), reward='queue_ticket'),))
    point('manifest_desk', 'Compare the freight manifest', -5.5, 10.9,
          actions=(action('inspect', assets=('freight_manifest', p('Manifest sorting desk'), 'parcel_clerk'),
                          requires=('queue_ticket',), reward='manifest_logged'),))
    point('parcel_intake', 'Read the parcel seal', -6.5, 14.7,
          actions=(action('scan', assets=('parcel_seal', p('Parcel receipt console'), p('Freight roller table')),
                          requires=('manifest_logged',), reward='parcel_read'),))
    point('calibration_bay', 'Check the reader with a test block', -7.0, 19.2,
          actions=(action('inspect', assets=('calibration_block', p('Bench calibration reader'), 'service_gauge'),
                          reward='reader_calibrated'),))
    point('inspection_lane', 'Approve the main inspection lane', 0, 19.3,
          actions=(action('authorize', assets=(p('Inspection lane release pedestal'), 'freight_inspector'),
                          requires=('parcel_read', 'reader_calibrated'), reward='main_lane_released'),))
    point('service_office', 'Issue the supervised lane pass', 7.0, 14.0,
          actions=(action('trade', assets=('service_pass', p('Equipment issue counter'), 'service_technician'),
                          requires=('parcel_read',), reward='supervised_pass'),
                   action('resupply', assets=('inspection_light', 'terminal_radio'))))
    point('service_gate', 'Present the pass at the service gate', 7.0, 19.5,
          actions=(action('unlock', assets=('service_pass', p('Service entrance call post')),
                          requires=('supervised_pass',), reward='service_lane_released'),))
    point('dispatch_intake', 'Deliver the accepted parcel to dispatch', 0, 24.45,
          actions=(action('deliver', assets=('parcel_seal', 'dispatch_pouch', p('Dispatcher sorter counter')),
                          requires=('parcel_read',), reward='parcel_received'),))
    point('dispatch_console', 'Print the outbound label', 0, 27.4,
          actions=(action('craft', assets=('label_roll', p('Dispatch check console'), 'dispatch_coordinator'),
                          requires=('parcel_received',), reward='label_printed'),))
    point('dispatch_exit', 'Send the parcel to the outbound bay', 0, 31.1,
          actions=(action('extract', assets=('dispatch_pouch', p('Dispatch overhead clock gantry')),
                          requires=('label_printed',)),))
    board.link('terminal_approach', 'scanner_arch', [-.45, 0, 9.05], [-.62, 0, 7.3])
    board.link('terminal_approach', 'inspection_queue')
    board.link('terminal_approach', 'manifest_desk', [-1.3, 0, 11.15], [-3.85, 0, 11.15])
    board.link('inspection_queue', 'manifest_desk', [-5.0, 0, 11.0])
    board.link('manifest_desk', 'parcel_intake', [-5.5, 0, 13], [-6.25, 0, 14.25], [-6.25, 0, 14.5])
    board.link('parcel_intake', 'calibration_bay')
    board.link('calibration_bay', 'inspection_lane')
    board.link('inspection_queue', 'inspection_lane')
    board.link('inspection_queue', 'service_office', [2.5, 0, 13.75], [4.25, 0, 14])
    board.link('service_office', 'service_gate')
    board.link('inspection_lane', 'dispatch_intake', requires=('main_lane_released',))
    board.link('service_gate', 'dispatch_intake', [7, 0, 24.45], requires=('service_lane_released',))
    board.link('dispatch_intake', 'dispatch_console')
    board.link('dispatch_console', 'dispatch_exit')


def extend(board):
    freight_district(board)
    service_district(board)
    dispatch_district(board)
    gameplay(board)
    for actor, x, z, yaw, pose in (
        ('parcel_clerk', -4.65, 10.91, 180, ('Reach', .36)),
        ('freight_inspector', 1.68, 20.45, 227, None),
        ('service_technician', 7.8, 14.15, 90, ('Reach', .36)),
        ('dispatch_coordinator', -1.2, 24.48, 270, ('Reach', .36)),
    ):
        board.stage_actor(actor, x, z, yaw=yaw, pose=pose)
    board.stage_work('freight_inspector', 'WeighParcel', -7.93, 19.25, yaw=123,
                     left=(-7.72, 1.56, 18.85), look=-18, pitch=8)
    board.stage_work('dispatch_coordinator', 'ReadLabel', .72, 27.35, yaw=90,
                     left=(1.14, 1.46, 27.34), look=32, pitch=12)
    for x, y, z, color, strength in (
        (-7.75, 2.35, 15.7, '#ffd3a3', 1050),
        (-6.78, 2.01, 19.78, '#ffeece', 1200),
        (-7.6, 2.7, 18.35, '#d9e9e5', 1100),
        (-5.55, 2.7, 17.65, '#ffdfbb', 1350),
        (8.6, 2.7, 13.65, '#fce0b6', 780),
        (0, 2.7, 30.15, '#ffd7a2', 1450),
        (1.32, 2.18, 26.47, '#fff0cc', 1150),
        (.65, 3.05, 27.2, '#e8f4ed', 1080),
    ):
        board.light(x, y, z, color, strength, 8)
    board.light(-.1, 2.5, 26.55, '#ffdfb8', 2650, 4.5)
    board.light(-.85, 1.5, 26.55, '#c3ddf2', 2700, 4.3)
    board.light(-2.3, 2.55, 28.35, '#ffe2b3', 2420, 5)
    board.shot('Freight parcel calibration', [-2.99, 2.22, 19.95], [-8.13, 1.26, 18.67])
    board.shot('Inspection release and dispatch', [2.8, 3.15, 16.0], [.3, 2.05, 23.85])
    board.shot('Outbound label desk', [-.95, 2.22, 24.35], [.71, 1.34, 29.42])
