"""Demolition survey, print works, and parcel loading."""

import build_level_props as lp
import level_vehicles as vehicles
from level_geometry import box

from .actors import Actor
from .common import (
    BODY,
    DARK,
    GLASS,
    JOINT,
    MARK,
    METAL,
    STONE,
    WOOD,
    action,
    floors,
    glyph,
    rubble,
    slab,
)
from .equipment import Item, handheld_light, loops, pack, radio

ACTORS = {
    'site_surveyor': Actor('Site surveyor', 'worker', 'human', 'helmet',
                           {'skin': '#b68969', 'primary': '#af724b', 'secondary': '#4b5253', 'trim': '#eeb869'}),
    'press_operator': Actor('Press operator', 'worker', 'human', 'rag',
                            {'skin': '#895e45', 'primary': '#697d6a', 'secondary': '#4d5755', 'detail': '#c8996c'}),
    'ink_mixer': Actor('Ink mixer', 'merchant', 'human', 'bonnet',
                       {'skin': '#bd8f77', 'primary': '#7c5f4c', 'secondary': '#66554c', 'leather': '#926843'}),
    'parcel_dispatcher': Actor('Parcel dispatcher', 'civilian', 'human', 'soft_cap',
                               {'skin': '#ac7659', 'primary': '#426267', 'secondary': '#495655', 'trim': '#dec498'}),
}


def sheet(stamped=False):
    shape = box(11, 15, 2, MARK)
    for y, width in ((4, 8), (6, 7), (8, 8), (10, 4)):
        box(width, 1, 1, DARK, y=y, z=1, sculpt=shape)
    if stamped:
        box(4, 3, 1, BODY, x=2, y=1, z=1, sculpt=shape)
    return shape


def plate():
    shape = box(13, 11, 2, METAL)
    for x in (-4, -1, 2):
        box(1, 8, 1, DARK, x=x, y=1, z=1, sculpt=shape)
    glyph(shape, ('###', '#.#', '#.#', '###'), 1, 3, 2, BODY)
    return shape


ITEMS = {
    'inspection_torch': Item('Survey lamp', 'tool', handheld_light(), (0, 3, 0)),
    'survey_tag': Item('Survey tag', 'document', sheet(), (0, 2, 0), {'trim': '#d7984b'}),
    'press_plate': Item('Print plate', 'part', plate(), (0, 2, 0)),
    'ink_tin': Item('Ink tin', 'supply', lp.drum(10, 8, DARK, METAL)),
    'dispatch_slip': Item('Stamped dispatch slip', 'document', sheet(True), (0, 2, 0)),
    'parcel_bundle': Item('Bound print bundle', 'cargo', pack(15, 8, 12, shell=WOOD)),
    'parcel_strap': Item('Parcel retaining strap', 'tool', loops(), (0, 2, 0)),
    'crew_radio': Item('Yard crew radio', 'tool', radio(), (0, 6, 0)),
    'parcel_stamp': Item('Parcel stamp', 'tool', box(5, 6, 5, WOOD, y=2, sculpt=box(9, 2, 6, DARK)), (0, 4, 0)),
}


def parcel_crest():
    shape = box(51, 14, 3, DARK)
    box(51, 1, 4, MARK, sculpt=shape)
    glyph(shape, ('##..###.##...##.###.#..', '#.#.#.#.#.#.#...#...#..',
                  '##..###.##..#...##..#..', '#...#.#.#.#.#...#...#..',
                  '#...#.#.#.#..##.###.###'), -22, 2, 2, MARK, 2)
    return shape


def shade():
    shape = box(54, 2, 18, BODY)
    for i in range(6):
        z = 7 - i * 3
        for x in range(-24, 25, 8):
            box(5, 2, 3, MARK, x=x, y=i, z=z, sculpt=shape)
            box(3, 2, 3, BODY, x=x + 4, y=i, z=z, sculpt=shape)
    for x in (-25, 25):
        box(3, 1, 18, METAL, x=x, sculpt=shape)
    box(54, 3, 2, BODY, z=9, sculpt=shape)
    return shape


def packing_table():
    shape = lp.counter(26, 12, DARK, WOOD, shelf=True)
    for x, y, z in ((-8, 11, -2), (0, 11, 1), (7, 11, -3)):
        box(7, 2, 5, MARK, x=x, y=y, z=z, sculpt=shape)
        box(1, 1, 5, DARK, x=x, y=y + 2, z=z, sculpt=shape)
    box(4, 4, 5, METAL, x=4, y=11, z=3, sculpt=shape)
    return shape


def loading_court(board):
    paving = [(x, z) for x in (20, 24, 28, 32, 36) for z in (-16, -12, -8, -4, 0, 4)]
    floors(board, 'Parcel yard setts', slab(40, 40, face=STONE, joint=JOINT, seed=37), paving)
    board.set_palette('Parcel yard setts', skin='#857968', secondary='#5e6662')
    a = board.add
    p = board.place
    a('Parcel house brick bay', lp.window_wall(BODY, STONE, brick=True), 23.6, -12.9)
    p('Parcel house brick bay', 27.6, -12.9)
    p('Parcel house brick bay', 19.6, -13.2)
    p('Parcel house brick bay', 19.6, -13.2, height=2.8)
    p('Parcel house brick bay', 18, -14.4, 1)
    p('Parcel house brick bay', 18, -14.4, 1, 2.8)
    p('Parcel house brick bay', 31.6, -12.9)
    p('Parcel house brick bay', 23.6, -12.9, height=2.8)
    p('Parcel house brick bay', 27.6, -12.9, height=2.8)
    p('Parcel house brick bay', 31.6, -12.9, height=2.8)
    a('Parcel sash infill', box(37, 15, 1, GLASS), 23.6, -13.23, height=.94)
    board.set_palette('Parcel sash infill', visor='#526361')
    for x in (23.6, 27.6, 31.6):
        p('Parcel sash infill', x, -13.23, height=3.74)
    for x in (27.6, 31.6):
        p('Parcel sash infill', x, -13.23, height=.94)
    for height in (.94, 3.74):
        p('Parcel sash infill', 19.6, -13.53, height=height)
        p('Parcel sash infill', 17.67, -14.4, 1, height)
    p('Print works chimney', 31.65, -13.35, height=5.65)
    p('Rooftop air unit', 24.15, -13.4, height=5.65)
    p('Dispatch rain leader', 29.6, -12.52)
    p('Press sash sill', 22.53, -12.55, height=3.76)
    p('Press sash sill', 30.53, -12.55, height=3.76)
    a('Parcel house coping', lp.roof(40, 20, DARK), 23.6, -13.35, height=5.6)
    p('Parcel house coping', 27.6, -13.35, height=5.6)
    p('Parcel house coping', 19.6, -13.65, height=5.6)
    p('Brick facade', 18.4, -11.75, 1)
    p('Flat brick coping', 20.15, -12.6, height=2.56)
    p('Parcel house coping', 31.6, -13.35, height=5.6)
    a('Parcel loading shade', shade(), 25.6, -11.65, height=2.75)
    board.set_palette('Parcel loading shade', primary='#547067', trim='#ccb386')
    p('Parcel loading shade', 31.05, -11.65, height=2.75)
    a('Parcel house sign', parcel_crest(), 26, -12.42, height=4.05)
    a('Packing counter', packing_table(), 24.75, -11.75)
    p('Packing counter', 28.2, -11.8)
    a('Parcel bay opening', lp.deep_arch(36, 32, 8, 25, BODY, MARK), 31.55, -12.36)
    a('Brick loading return', lp.panel(40, 33, 5, BODY, STONE, rows=True), 33.5, -9.9, 1)
    p('Brick loading return', 35.55, -8.24, 1)
    a('Roadside recovery debris', rubble(29, 20, seed=34), 20.8, -12.45)
    p('Concrete jersey', 20.15, -11.35)
    p('Sidewalk curb', 22, -9.7, height=-.18)
    p('Sidewalk curb', 26, -9.7, height=-.18)
    p('Sidewalk curb', 30, -9.7, height=-.18)
    p('Crated salvage', 22.15, -11.35)
    p('Bindery delivery bundles', 25.45, -11.78, height=1.1)
    p('Outgoing print bundles', 29.55, -11.25)
    p('Hand freight trolley', 26.75, -9.2, 1)
    p('Standing paper rolls', 31.45, -11.3)
    p('Bindery return crates', 32.55, -10.25)
    p('Bindery return crates', 32.2, -8.75)
    p('Pallet stack', 32.45, -8.4)
    p('Pallet stack', 29.4, -8.45)
    p('Street lamp', 19, -10.1)
    p('Street lamp', 33.45, -8.4, 2)
    p('Roadwork beacon', 18.8, -8.6)
    p('Roadwork beacon', 20, -9.7)
    p('Roadwork beacon', 20.15, -7.95)
    p('Covered loading stand', 21, -3.6)
    p('News bundle bin', 20.6, -4)
    p('Service yard boundary', 20, -2.15)
    p('Service yard boundary', 23.9, -2.15)
    p('Service yard boundary', 35.55, -.25, 1)
    p('Parcel house brick bay', 35.6, -12.9)
    p('Parcel house brick bay', 35.6, -12.9, height=2.8)
    for height in (.94, 3.74):
        p('Parcel sash infill', 35.6, -13.23, height=height)
    p('Parcel house coping', 35.6, -13.35, height=5.6)
    p('Brick loading return', 35.55, -4.24, 1)
    p('Parcel counter sign', 20.8, -3.72, height=3.1)
    p('Pallet stack', 23.3, -2.75)
    p('Bindery return crates', 23.5, -3.1)
    p('Service street gutter', 23.9, -4.35, height=-.19)
    p('Roadside shade tree', 18.7, -2.4)
    p('Roadside shade tree', 25.4, -2.55)
    p('Parcel curbside post', 27.55, -5.45)
    p('Hand freight trolley', 31.26, -2.78, 1)
    handle = box(1, 1, 16, METAL, y=5)
    for z in (-7, 7):
        box(1, 5, 1, BODY, z=z, sculpt=handle)
    a('Parcel trolley push bar', handle, 32.22, -2.78, height=.64)
    p('Overhead sign', 23.4, -2.2)
    board.vehicle('Parcel dispatch van', 'parcel extraction', vehicles.panel_van(), 28.58, -3.15, turn=1,
                  primary='#607776', trim='#d0aa73')
    # A recovered plate sits on the crate at the survey station.
    plate_case = box(7, 2, 6, DARK)
    box(5, 1, 4, METAL, y=2, sculpt=plate_case)
    for x in (-1, 1):
        box(1, 1, 3, MARK, x=x, y=3, sculpt=plate_case)
    a('Recovered printing plate', plate_case, 21.89, -11.07, height=1.1)
    board.light(22.65, 2.4, -10.12, '#ffcf99', 690, 5)
    slip = box(5, 1, 3, MARK)
    box(2, 1, 2, BODY, y=1, sculpt=slip)
    a('Dispatch stamping stand', lp.platform(9, 8, 12, WOOD, DARK), 29.58, -9.12)
    a('Dispatch slip and stamp', slip, 29.58, -9.12, height=1.2)
    a('Brass plate sleeve', lp.latched_case(5, 2, 4, MARK, METAL, BODY),
      23.68, -11.25, height=1.0)
    board.light(28.1, 2.25, -11.1, '#ffe0aa', 480, 4)
    board.light(32.4, 2.72, -1.19, '#ffe1b6', 825, 6)
    board.light(24.6, 2.5, -10.85, '#ffcb8e', 129, 6)
    board.light(22.9, 2.45, -10.02, '#ffe0b5', 144, 2.8)
    board.light(26, 2.2, -8.85, '#c0dff6', 86, 6)
    board.light(27.15, 2.65, -4.45, '#ffca91', 97, 6)
    board.light(30.8, 2.5, -11, '#ffda9c', 80, 6)


def extend(board):
    board.use = 'Recover a print plate, stamp a dispatch slip, and load the parcel van.'
    board.entry, board.exit = 'street', 'parcel_van'
    board.environment = dict(board.environment, zenith='#5c8796', horizon='#e5c5a2',
                             fillIntensity=1.56)
    loading_court(board)
    # Connect the facade to the print shop door behind it.
    board.remove_at('Brick facade', 0, -5.4)
    board.remove_at('Brick facade', 4, -5.4)
    board.add('Print entry brick return', lp.panel(29, 25, 5, BODY, JOINT, rows=True), -.55, -5.4, 2)
    board.place('Print entry brick return', 4.55, -5.4, 2)
    board.add('Print entry lintel', lp.inlay(22, 4, METAL, DARK), 2, -5.4, height=2.5)
    board.move('Reel feed stand', -3.18, -11.2)
    board.placement_at('Crated salvage', 1.1, -8.15)['position'] = [-.95, 0, -7.45]
    prop = board.prop_id
    board.point('street', 'Demolition street check-in', 0, 9, actions=(
        action('player-spawn'), action('loadout', assets=('inspection_torch', 'crew_radio'))))
    board.point('demolition', 'Demolition survey line', -.75, 1, actions=(
        action('inspect', assets=('survey_tag', 'site_surveyor', prop('Breach rubble')), reward='site_surveyed'),))
    board.point('plate', 'Plate store wicket', 0, 1.25, actions=(
        action('pickup', assets=('press_plate', prop('Plate store bell')),
               requires=('site_surveyed',), reward='plate_recovered'),))
    board.point('print_entry', 'Print works entry', 2, -4.6, actions=(
        action('check-in', assets=('survey_tag', prop('Print entry lintel')), requires=('site_surveyed',),
               reward='works_access'),))
    board.point('proof', 'Press proofing station', 2, -8, actions=(
        action('inspect', assets=('press_plate', prop('Press proofing station')),
               requires=('plate_recovered',), reward='proof_checked'),))
    board.point('press', 'Rotary press controls', -.25, -12.5, actions=(
        action('print', assets=('press_operator', 'dispatch_slip', prop('Rotary offset press')),
               requires=('proof_checked',), reward='slip_printed'),))
    board.point('ink', 'Ink mixing bench', -6, -16.25, actions=(
        action('trade', assets=('ink_mixer', 'ink_tin', prop('Ink mixing bench')), reward='ink_restocked'),))
    board.point('lane', 'Delivery lane', 8.5, -8, actions=(
        action('signal', assets=('crew_radio', prop('Panel van')), requires=('slip_printed',),
               reward='parcel_call'),))
    board.point('verge', 'Parcel yard approach', 15, -7.5, actions=(
        action('scout', assets=(prop('Parcel house sign'),)),))
    board.point('survey_cache', 'Recovered print stock', 21.25, -9.5, actions=(
        action('inspect', assets=('survey_tag', prop('Crated salvage')), reward='stock_checked'),))
    board.point('packing', 'Parcel packing counter', 24.75, -10.6, actions=(
        action('pack', assets=('parcel_bundle', 'parcel_strap', prop('Packing counter')),
               requires=('stock_checked',), reward='parcel_packed'),))
    board.point('wicket', 'Parcel dispatch counter', 28.3, -10.65, actions=(
        action('record', assets=('parcel_stamp', 'dispatch_slip', 'parcel_dispatcher'),
               reward='parcel_stamped'),))
    board.point('stand', 'Covered transfer stand', 21, -5.25, actions=(
        action('pack', assets=('parcel_bundle', 'parcel_strap', prop('Covered loading stand')),
               requires=('ink_restocked',), reward='stand_packed'),))
    board.point('parcel_van', 'Parcel van tailgate', 29, -5.85, actions=(
        action('extract', assets=('parcel_bundle', prop('Parcel dispatch van')),
               requires=('parcel_stamped',)),))

    board.link('street', 'demolition', (.5, 0, 6.75), (.5, 0, 1.75), (-.75, 0, 1.25))
    board.link('demolition', 'plate', (-.75, 0, 1.25), requires=('site_surveyed',))
    board.link('plate', 'print_entry', (.5, 0, 2), (2.5, 0, 6), (3.25, 0, 6), (6, 0, 4),
               (6.5, 0, 3.5), (6.5, 0, -.5), (7.25, 0, -1.5), (7.25, 0, -3.25),
               (6.75, 0, -3.5), requires=('plate_recovered',))
    board.link('print_entry', 'proof', requires=('works_access',))
    board.link('proof', 'press', (-1.9, 0, -8.75), (-1.9, 0, -11.9), requires=('proof_checked',))
    board.link('press', 'ink', (-.25, 0, -15.75), (-.75, 0, -17.25), (-1.25, 0, -17.5),
               (-3.5, 0, -17.5))
    board.link('print_entry', 'lane', (6.5, 0, -4), requires=('slip_printed',))
    board.link('lane', 'verge', requires=('parcel_call',))
    board.link('verge', 'survey_cache', (21.2, 0, -7.5))
    board.link('survey_cache', 'packing', (21.25, 0, -10.3), requires=('stock_checked',))
    board.link('packing', 'wicket', (26.65, 0, -10.45), requires=('parcel_packed',))
    board.link('verge', 'stand', (20.85, 0, -7.15), requires=('ink_restocked',))
    board.link('stand', 'wicket', (21.2, 0, -7.25), (27.85, 0, -7.25),
               (28.05, 0, -9.15), requires=('stand_packed',))
    board.link('wicket', 'parcel_van', (28.05, 0, -9.15), (28.05, 0, -6.4),
               requires=('parcel_stamped',))

    for asset, x, z, yaw, pose in (
        ('site_surveyor', -1.25, 1.6, 145, ('Idle', .55)),
        ('press_operator', -.4, -12.45, 180, ('Reach', .55)),
        ('ink_mixer', -6.55, -16, -90, ('Reach', .52)),
    ):
        board.stage_actor(asset, x, z, yaw=yaw, pose=pose)
    board.stage_work('site_surveyor', 'CheckPlate', 21.27, -10.86, yaw=75,
                     left=(21.71, 1.39, -11.03), look=-45, pitch=8)
    board.stage_work('press_operator', 'WrapBundle', 23.15, -10.8, yaw=120,
                     left=(23.49, 1.22, -11.12), look=-68)
    board.stage_work('parcel_dispatcher', 'StampSlip', 29.9, -9.45, yaw=-56,
                     left=(29.58, 1.32, -9.14), look=-10, pitch=10)
    board.stage_work('parcel_dispatcher', 'PushTrolley', 32.6, -2.78, yaw=-78,
                     left=(32.23, 1.18, -2.53), right=(32.23, 1.18, -2.99), look=34)
    board.shot('Parcel packing court', (21.15, 2.2, -5.15), (25.6, 1.91, -11.6))
    board.shot('Parcel van and covered stand', (33.14, 2.22, 2.17), (30.17, 1.27, -3.45))
