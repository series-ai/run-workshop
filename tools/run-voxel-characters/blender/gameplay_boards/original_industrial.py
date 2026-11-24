"""Ore sampling, machine repair, and foundry dispatch."""

import build_level_props as lp
import level_vehicles as vehicles
from level_geometry import box

from .actors import Actor
from .common import (
    BODY,
    DARK,
    GLOW,
    GREEN,
    JOINT,
    MARK,
    METAL,
    WOOD,
    action,
    arch,
    floors,
    glyph,
    roof_bay,
    slab,
)
from .equipment import Item, handheld_light, handled, loops, mineral, pack, radio

ACTORS = {
    'ore_sampler': Actor('Ore sampler', 'worker', 'human', 'lamp',
                         {'skin': '#916348', 'primary': '#a27242', 'secondary': '#455964', 'trim': '#edbc63'}),
    'mill_fitter': Actor('Mill fitter', 'worker', 'human', 'helmet',
                         {'skin': '#bd886b', 'primary': '#4e7379', 'secondary': '#384951', 'detail': '#ce9150'}),
    'crane_operator': Actor('Crane operator', 'civilian', 'human', 'soft_cap',
                             {'skin': '#946c57', 'primary': '#a96945', 'secondary': '#464751'}),
    'yard_dispatcher': Actor('Yard dispatcher', 'officer', 'human', 'cap',
                             {'skin': '#b58268', 'primary': '#637961', 'secondary': '#48574b', 'trim': '#e7bb76'}),
}


def manifest():
    shape = box(10, 14, 2, WOOD)
    box(8, 11, 1, MARK, y=1, z=1, sculpt=shape)
    box(4, 2, 2, METAL, y=11, z=2, sculpt=shape)
    for y in (3, 5, 8):
        box(5, 1, 1, DARK, x=1, y=y, z=2, sculpt=shape)
    return shape


ITEMS = {
    'ore_sample': Item('Tagged ore sample', 'sample', mineral(MARK, 5)),
    'inspection_tongs': Item('Inspection tongs', 'tool', handled('cutters'), (0, 5, 0)),
    'fitter_lamp': Item('Fitter inspection lamp', 'tool', handheld_light(), (0, 3, 0)),
    'roller_bearing': Item('Roller bearing', 'part', lp.drum(11, 5, METAL, DARK)),
    'pump_seals': Item('Pump seal case', 'part', pack(13, 6, 8, shell=BODY), (0, 8, 0)),
    'lifting_strop': Item('Lifting strop', 'tool', loops(), (0, 2, 0)),
    'yard_radio': Item('Yard radio', 'tool', radio(), (0, 6, 0)),
    'dispatch_manifest': Item('Dispatch manifest', 'document', manifest(), (0, 3, 0)),
    'billet_sample': Item('Billet sample', 'sample', box(7, 5, 12, METAL, sculpt=box(8, 1, 12, BODY))),
}


def loading_frame():
    shape = arch(60, 45, 8, 45, face=BODY)
    box(60, 4, 12, DARK, y=43, sculpt=shape)
    for x in (-20, -10, 0, 10, 20):
        box(3, 3, 11, METAL, x=x, y=45, sculpt=shape)
    for x in (-25, 25):
        box(5, 4, 3, MARK, x=x, y=25, z=5, sculpt=shape)
        box(4, 2, 2, GLOW, x=x, y=28, z=6, sculpt=shape)
    return shape


def dispatch_sign():
    shape = box(36, 12, 3, DARK)
    box(36, 1, 4, MARK, sculpt=shape)
    glyph(shape, ('###..###..###', '#.#..#.#....#', '#.#..#.#..###', '#.#..#.#..#..',
                  '###..###..###'), -13, 1, 2, MARK, 2)
    return shape


def load_scale():
    shape = box(33, 3, 27, DARK)
    for z in (-11, 11):
        box(34, 1, 3, MARK, y=2, z=z, sculpt=shape)
    for x in range(-13, 15, 4):
        box(2, 1, 20, METAL, x=x, y=2, sculpt=shape)
    return shape


def dispatch_yard(board):
    paving = [(x, z) for x in (20, 24, 28, 32) for z in (-16, -12, -8, -4, 0)]
    floors(board, 'Foundry transfer paving', slab(40, 40, face=DARK, joint=JOINT, seed=73), paving)
    board.set_palette('Foundry transfer paving', secondary='#687078', skin='#848374')
    a = board.add
    p = board.place
    a('Dispatch frame', loading_frame(), 24, -8, 1)
    a('Dispatch yard badge', dispatch_sign(), 23.35, -8, 3, 4.7)
    p('Dispatch yard badge', 29.5, -3.75, 2, 2.5)
    a('Stock shed canopy', roof_bay(56, 49, 43, face=GREEN), 28.4, -10.9)
    board.set_palette('Stock shed canopy', detail='#4c7068', trim='#949483')
    a('Stock shed cladding', lp.clad_wall(40, 40, 5, BODY, METAL), 26.9, -13.3)
    p('Stock shed cladding', 30.9, -13.3)
    p('Stock shed cladding', 22.9, -13.3)
    p('Stock shed cladding', 19, -13.3)
    p('Stock shed cladding', 18.65, -11.55, 1)
    p('Smelting works roof monitor', 21.4, -14.1, height=4.08)
    a('Dispatch weigh deck', load_scale(), 28.65, -9.8, height=-.13)
    p('Suspended steel billets', 28.1, -9.77, height=.17)
    p('Billet spreader', 28.1, -10.05, height=1.44)
    p('Bridge hoist trolley', 28.1, -10.05, height=3.46)
    a('Weigh deck hoist arch', lp.panel(58, 42, 6, METAL, MARK, opening=49), 28.35, -10.05)
    board.set_palette('Weigh deck hoist arch', metal='#728a8d', trim='#ce9c50')
    p('Billet landing cradle', 27.65, -9.75, height=.08)
    p('Rolled sheet coil', 26.05, -11.48)
    p('Rolled sheet coil', 30.38, -12.55)
    p('Smelting works pendant', 27.8, -8.9, height=3.75)
    a('Tally booth frame', lp.glazed_inspection_booth(), 29.5, -3.35, 2)
    board.set_palette('Tally booth frame', primary='#668078', secondary='#515c58', visor='#9cb3aa')
    a('Tally document shelf', lp.counter(17, 9, BODY, WOOD), 28.8, -4.8, 1)
    a('Shipping rack', lp.cargo_rack(METAL), 31.7, -6.35, 1)
    p('Shipping rack', 31.7, -8.4, 1)
    a('Billet bundle', lp.latched_case(18, 8, 11, METAL, BODY, MARK), 31, -11.95)
    p('Billet bundle', 30.4, -12.45)
    p('Billet landing cradle', 27.4, -11.7)
    p('Ingot cooling rack', 29.3, -12)
    p('Striped bollard', 26.1, -8.5)
    p('Striped bollard', 30.9, -8.5)
    p('Warning stanchion', 23.65, -5.2)
    p('Safety drum', 25.25, -5.5)
    p('Tool trolley', 27.2, -12)
    p('Overhead service pipes', 28.2, -12.8, height=2.7)
    p('Crane station console', 26.65, -9.67)
    p('Foundry safety crossing', 21, -6.5, 1, -.09)
    p('Foundry safety crossing', 26.5, -6.5, 1, -.09)
    p('Safety rail', 20.55, -11.5)
    p('Safety rail', 20.55, -4.25)
    p('Pressure vessel', 26.1, -12.3)
    p('Pump sampling panel', 27.4, -11.3)
    p('Safety drum', 32.1, -12.75)
    p('Safety drum', 33, -12.75)
    p('Loaded steel rack', 33.35, -10.75, 1)
    p('High sheet metal wall', 33.8, -11, 1)
    p('High sheet metal wall', 33.8, -7, 1)
    p('High sheet metal wall', 33.8, -3.95, 1)
    p('Stock shed cladding', 33.8, -.65, 1)
    p('Stock shed cladding', 32.6, -1.15)
    p('Stock shed cladding', 28.6, -1.15)
    p('Stock shed cladding', 24.65, -1.15)
    p('Overhead service pipes', 24.7, -1.48, height=2.78)
    p('Rolling mill sash', 29.2, -.82, height=1.35)
    p('Loaded steel rack', 26.9, -2.5)
    p('Smelting works roof monitor', 30.7, .1, height=4.08)
    p('Rolling mill sash', 32.8, -3.05, 1, 1.22)
    p('Rolling mill sash', 33.35, -10.8, 1, 1.45)
    p('Extraction pipe bent', 32.1, -12.1)
    p('Extraction main', 31.3, -12.6, height=4.25)
    p('Refractory exhaust stack', 32.8, -12.95)
    p('Ingot cooling rack', 24.65, -11.9)
    p('Cooling circulation pump', 22.55, -11.95)
    p('Loading sill access plate', 24.4, -8.75, 1, -.17)
    p('Foundry safety crossing', 31.7, -5.5, height=-.09)
    board.vehicle('Dispatch forklift', 'billet loading', vehicles.forklift(), 31.35, -7.2, 1,
                  primary='#b59b53', trim='#e3c571')
    board.vehicle('Dispatch pickup', 'yard exit', vehicles.pickup(), 32.45, -3.6, 1,
                  primary='#627a72', trim='#cba867')
    lever = box(1, 3, 1, METAL)
    box(2, 1, 2, MARK, y=2, sculpt=lever)
    a('Hoist control lever', lever, 26.38, -9.42, height=1.1)
    # The hot center and dark ends show the temperature of the billet.
    steel = box(32, 2, 3, BODY)
    box(26, 2, 3, MARK, y=1, sculpt=steel)
    box(18, 1, 3, GLOW, y=2, sculpt=steel)
    a('Hot test billet', steel, 28.1, -9.48, height=.77)
    board.set_palette('Hot test billet', primary='#99472d', trim='#ff8e34', accent='#ffd15c')
    board.light(28, 1.28, -9.12, '#ff862e', 165, 4)
    board.light(29.6, 2.6, -11.65, '#9fdfff', 940, 6)
    board.light(27.3, 2.6, -7.75, '#ffe0ac', 1250, 7)
    tally = box(6, 1, 4, WOOD)
    box(5, 1, 4, MARK, y=1, sculpt=tally)
    box(1, 1, 3, DARK, x=1, y=2, sculpt=tally)
    a('Billet tally ledger', tally, 28.97, -4.95, height=1.0)
    board.light(29.3, 2.45, -6.1, '#ffdbac', 950, 6)
    board.light(28.75, 3.35, -9.25, '#ffcb87', 210, 8)
    board.light(26.55, 2.65, -8.45, '#aad9ff', 122, 7)
    board.light(31.85, 3.6, -7.2, '#ffd49b', 90, 6)
    board.light(29.2, 2.35, -4.2, '#ffd59b', 52, 5)


def extend(board):
    board.use = 'Sample ore, restore the stock transfer line, and dispatch a tested billet load.'
    board.entry, board.exit = 'receiving', 'dispatch_exit'
    board.environment = dict(board.environment, zenith='#5b8599', horizon='#d1c6ae',
                             fillIntensity=1.7)
    dispatch_yard(board)
    p = board.prop_id
    board.point('receiving', 'Ore railway check-in', -8, -6, actions=(
        action('player-spawn'), action('loadout', assets=('yard_radio', 'inspection_tongs', 'fitter_lamp'))))
    board.point('ore', 'Ore sampling siding', -9.25, -7.5, actions=(
        action('gather', assets=('ore_sampler', 'ore_sample', p('Casting railway')), reward='ore_sampled'),))
    board.point('bench', 'Fitter workbench', -6.5, .25, actions=(
        action('trade', assets=('mill_fitter', 'roller_bearing', p('Maintenance bench')),
               requires=('ore_sampled',), reward='bearing_issued'),))
    board.point('press', 'Transfer press', -2.5, -2.5, actions=(
        action('repair', assets=('roller_bearing', p('Foundry press')), requires=('bearing_issued',),
               reward='press_repaired'),))
    board.point('crane', 'Crane runway', 4.75, 5.75, actions=(
        action('inspect', assets=('crane_operator', 'lifting_strop', p('Yard crane')), reward='hoist_checked'),))
    board.point('cooling', 'Pump sampling panel', 11.4, 3.3, actions=(
        action('repair', assets=('pump_seals', p('Pump sampling panel')), requires=('hoist_checked',),
               reward='pump_serviced'),))
    board.point('quench', 'Quench return', 14.5, 3.75, actions=(
        action('activate', assets=(p('Quench bath'), 'yard_radio'), requires=('pump_serviced',),
               reward='cooling_routed'),))
    board.point('approach', 'Transfer line junction', 6, -8.5, actions=(
        action('signal', assets=('yard_radio', p('Smelting works trade sign')), requires=('press_repaired',),
               reward='line_ready'),))
    board.point('verge', 'Dispatch lead-in', 16, -6.5, actions=(
        action('scout', assets=(p('Dispatch yard badge'),)),))
    board.point('gate', 'Dispatch frame', 22.5, -7.4, actions=(
        action('signal', assets=('yard_dispatcher', p('Dispatch frame')), reward='yard_cleared'),))
    board.point('scale', 'Billet weigh deck', 28.3, -7.7, actions=(
        action('weigh', assets=('billet_sample', p('Dispatch weigh deck'), p('Suspended steel billets')), requires=('yard_cleared',),
               reward='billet_weighed'),))
    board.point('rack', 'Billet loading rack', 29.65, -10.9, actions=(
        action('load', assets=('lifting_strop', p('Shipping rack'), p('Dispatch forklift')),
               requires=('billet_weighed',), reward='billets_loaded'),))
    board.point('tally', 'Dispatch tally booth', 28.6, -5.85, actions=(
        action('record', assets=('dispatch_manifest', p('Tally booth frame')), requires=('billets_loaded',),
               reward='manifest_signed'),))
    board.point('dispatch_exit', 'Foundry dispatch pickup', 31.35, -4.8, actions=(
        action('extract', assets=(p('Dispatch pickup'), 'dispatch_manifest'), requires=('manifest_signed',)),))

    board.link('receiving', 'ore')
    board.link('ore', 'bench', (-8.5, 0, -5), requires=('ore_sampled',))
    board.link('receiving', 'bench', (-8.5, 0, -5), requires=('ore_sampled',))
    board.link('bench', 'press', (-6.25, 0, -2.5), (-4.75, 0, -3.25), requires=('bearing_issued',))
    board.link('press', 'crane', (-3.5, 0, -2.75), (-5.25, 0, -3.25), (-6.5, 0, -2),
               (-6.5, 0, 1), (-6, 0, 7.25), (-5.5, 0, 9.25), (-4.5, 0, 9.5),
               (-2.75, 0, 9.25), (2.5, 0, 7))
    board.link('crane', 'cooling', (4.5, 0, 6.5), (4.5, 0, 6.75), (4.75, 0, 7), (5.5, 0, 8),
               (6.75, 0, 9), (10.25, 0, 9), (12.75, 0, 5.5))
    board.link('cooling', 'quench', (14.25, 0, 3.5), requires=('pump_serviced',))
    board.link('press', 'approach', (-1.75, 0, -2.5), requires=('press_repaired',))
    board.link('approach', 'verge', (9.75, 0, -7.25), requires=('line_ready',))
    board.link('quench', 'verge', (14.25, 0, 4.5), (14.25, 0, 5), (15, 0, 5.25),
               (15.25, 0, 5.25), (17, 0, 4.5), (17.75, 0, 1.5), (15.5, 0, -2),
               requires=('cooling_routed',))
    board.link('verge', 'gate', (20, 0, -6.5))
    board.link('gate', 'scale', (24.5, 0, -7.6), requires=('yard_cleared',))
    board.link('scale', 'rack', (30.45, 0, -8.4), (30.45, 0, -10.85), requires=('billet_weighed',))
    board.link('rack', 'tally', (30.45, 0, -10.85), (30.45, 0, -8.4), (29.35, 0, -8.15),
               (28.4, 0, -7.55), requires=('billets_loaded',))
    board.link('scale', 'tally', requires=('billets_loaded',))
    board.link('tally', 'dispatch_exit', (30.3, 0, -5.6), (31.4, 0, -5.35), requires=('manifest_signed',))

    for asset, x, z, yaw, pose in (
        ('ore_sampler', -9.15, -8.4, -80, ('Reach', .55)),
        ('mill_fitter', -6.32, -.6, 100, ('Reach', .5)),
        ('crane_operator', 13.9, 4.6, -95, ('Reach', .5)),
    ):
        board.stage_actor(asset, x, z, yaw=yaw, pose=pose)
    board.stage_work('mill_fitter', 'InspectSling', 29.69, -9.09, y=.17, yaw=-110,
                     right=(29.29, 1.43, -9.24), look=45)
    board.stage_work('crane_operator', 'CheckLoad', 26.13, -9.03, yaw=135,
                     left=(26.38, 1.38, -9.42), look=-64)
    board.stage_work('yard_dispatcher', 'SignLedger', 29.45, -4.91, yaw=-104,
                     left=(29.03, 1.2, -4.89), look=-22, pitch=12)
    board.shot('Billet transfer bay', (27.59, 1.98, -4.7), (28.12, 1.65, -9.87))
    board.shot('Dispatch frame and tally booth', (26.41, 2.05, -9.11), (29.3, 1.49, -4.2))
