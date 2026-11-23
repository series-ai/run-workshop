"""Level-building world props for run-chisel-ww2 (22 static + animated additions)."""

import math
from mathutils import Matrix

from build_props import make_contract, sample_prop_clip
from props_ww2_depot import WW2_DEPOT_STATIC
from props_kit_ww2 import WW2_KIT_STATIC

import polykit as pk
from polykit import X, Y, Z, V
from props_level_common import door_unit, gable_roof, hip_roof, l_corner_wall, tile_base, wheel_pair, window_pane


# ---- Modular Roads, Craters & Trench Walls ----------------------------------

def prop_dirt_road_straight(part):
    tile_base(part, 2.00, 2.00, 0.123, 'primary', ao=-0.06)
    for sx in (-0.84, 0.84):
        part.box(V(sx, 0.072, 0), (0.32, 0.144, 2.00), 'hair', ao=0.02)
    for sx in (-0.36, 0.36):
        part.box(V(sx, 0.118, 0), (0.22, 0.02, 1.96), 'secondary', ao=-0.10)


def prop_dirt_road_corner(part):
    tile_base(part, 2.00, 2.00, 0.123, 'primary', ao=-0.06)
    part.box(V(-0.84, 0.072, 0), (0.32, 0.144, 2.00), 'hair', ao=0.02)
    part.box(V(0, 0.072, -0.84), (2.00, 0.144, 0.32), 'hair', ao=0.02)
    part.box(V(0.84, 0.072, 0.84), (0.32, 0.144, 0.32), 'hair', ao=0.02)


def prop_crater_ground_tile(part):
    tile_base(part, 2.00, 2.00, 0.123, 'secondary', ao=-0.08)
    part.lathe([(0.72, 0.08), (0.78, 0.24), (0.56, 0.24), (0.42, 0.08)], 8, 'primary', cap_start=True, ao=-0.04)


def prop_trench_wall_straight(part):
    part.box(V(0, 0.50, 0), (2.00, 1.00, 0.42), 'secondary', taper=(0.98, 0.72), ao=-0.06)
    for sx in (-0.82, -0.28, 0.28, 0.82):
        part.box(V(sx, 0.56, 0.16), (0.12, 1.12, 0.10), 'primary', bevel=0.008)
    for y in (0.32, 0.74):
        part.box(V(0, y, 0.18), (1.96, 0.12, 0.06), 'primary')


def prop_trench_wall_corner(part):
    l_corner_wall(part, 1.30, 1.04, 0.44, 'secondary', cap_region='primary', ao=-0.04)


def prop_tank_trap_line(part):
    part.box(V(0, 0.09, 0), (2.00, 0.18, 0.66), 'metal', ao=-0.06)
    for sx in (-0.64, 0.0, 0.64):
        part.box(V(sx, 0.48, 0), (0.46, 0.62, 0.46), 'skin', bevel=0.02, taper=0.58, ao=0.04)


# ---- Modular Bunkers & Military Buildings -----------------------------------

def prop_bunker_corner(part):
    l_corner_wall(part, 1.36, 1.73, 0.66, 'skin', cap_region='metal', ao=-0.04)


def prop_bunker_doorway(part):
    for sx in (-0.76, 0.76):
        part.box(V(sx, 0.865, 0), (0.56, 1.73, 0.66), 'skin', bevel=0.02)
        part.box(V(sx * 0.73, 1.86, 0), (0.18, 0.34, 0.66), 'skin', bevel=0.02)
    part.box(V(0, 2.11, 0), (1.30, 0.22, 0.66), 'skin', bevel=0.02)
    door_unit(part, (0, 0, 0.24), 0.84, 2.04, 'metal', 'metal', 'accent')


def prop_command_bunker(part):
    part.box(V(0, 0.76, 0), (2.72, 1.52, 2.28), 'skin', bevel=0.04, taper=0.92, ao=-0.04)
    part.box(V(0, 1.62, 0), (2.82, 0.28, 2.38), 'skin', bevel=0.03, ao=0.04)
    part.box(V(0, 1.84, -0.22), (0.98, 0.24, 0.98), 'metal', bevel=0.02)
    part.box(V(0, 1.12, 1.06), (1.68, 0.24, 0.24), 'metal', ao=-0.12)
    # A raised concrete entry projects through the low roof.
    part.box(V(-0.73, 1.06, -0.88), (1.15, 2.12, 0.64), 'skin', bevel=0.03)
    with part.placed(Matrix.Rotation(math.pi, 4, 'Y')):
        door_unit(part, (0.73, 0, 1.20), 0.84, 2.04, 'metal', 'secondary', 'accent')


def prop_field_tent(part):
    part.box(V(0, 0.08, 0), (2.48, 0.16, 2.12), 'secondary', ao=-0.06)
    part.box(V(0, 0.72, 0), (2.36, 1.16, 2.02), 'primary', bevel=0.02)
    gable_roof(part, 0, 1.30, 0, 2.40, 2.04, 0.84, 'primary', overhang=0.08, along='z', ao=0.05)
    # Soldiers crouch under the front flap.
    part.box(V(0, 0.91, 1.105), (0.84, 1.50, 0.08), 'secondary', ao=-0.10)
    part.plate(V(0, 1.82, 1.105), Z, Y, 0.34, 0.34, 0.02, 'accent', shrink=0.92, ao=0.14)


def prop_supply_shed(part):
    pitch = math.radians(-5)
    # Follow the underside of the pitched sheet at both eaves.
    ends = [[V(x, y, z) for x, y in ((-1.17, 0), (1.17, 0),
             (1.17, 2.09 - z * math.tan(pitch)), (-1.17, 2.09 - z * math.tan(pitch)))]
            for z in (-0.94, 0.94)]
    part.loft(ends, 'primary', cap_start=True, cap_end=True)
    with part.placed(Matrix.Translation(V(0, 2.15, 0)) @ Matrix.Rotation(pitch, 4, 'X')):
        part.box(V(0, 0, 0), (2.48, 0.14, 2.08), 'metal', bevel=0.015, ao=0.06)
    door_unit(part, (-0.42, 0, 0.94), 0.84, 2.04, 'metal', 'secondary', 'accent')
    window_pane(part, V(0.58, 1.18, 0.95), Z, Y, 0.46, 0.36, 'metal', 'eye')


# ---- Military Vehicles ------------------------------------------------------

def prop_military_jeep(part):
    part.box((0, .55, 0), (1.42, .24, 3.18), 'primary', bevel=.03)
    part.box((0, .88, .94), (1.32, .48, 1.26), 'primary', bevel=.03, taper=.94)
    part.box((0, 1.40, .36), (1.38, .60, .07), 'eye', up=V(0, 1, -.12))
    for side in (-1, 1):
        x = side * .67
        part.box((x, 1.40, .36), (.06, .60, .09), 'primary', up=V(0, 1, -.12))
        part.box((x, .85, -.99), (.10, .47, 1.16), 'primary')
        part.box((side * .35, .75, -.24), (.49, .16, .56), 'secondary')
        part.box((side * .35, .97, -.52), (.49, .42, .10), 'secondary')
    part.box((0, .85, -1.54), (1.40, .47, .10), 'primary')
    part.box((0, .88, 1.57), (.72, .32, .07), 'metal')
    part.box((0, .55, 1.64), (1.52, .12, .13), 'metal')
    for z in (-1.04, 1.05):
        wheel_pair(part, z, .66, .36, .20, 'secondary', 'primary')


def prop_supply_truck(part):
    # Keep the chassis bottom at .42 m and the cab floor at .749 m.
    part.box((0, .5845, 0), (1.76, .329, 4.96), 'metal')
    part.box((0, 1.00, -1.11), (1.98, .64, 2.70), 'secondary')

    # The canvas rests on three bows above the load bed.
    bow = [(-1.0, 1.31), (-1.02, 1.40), (-.94, 1.58), (-.90, 2.12),
           (-.65, 2.40), (0, 2.50), (.65, 2.40), (.90, 2.12),
           (.94, 1.58), (1.02, 1.40), (1.0, 1.31)]
    rings = [[V(x if y <= 1.40 else x * width, y - sag, z) for x, y in bow]
             for z, width, sag in [(-2.43, 1, 0), (-1.12, .94, .13), (.19, 1, 0)]]
    part.loft(rings, 'skin', closed=False, two_sided=True, thickness=.006, ao=-.13)
    part.slab([V(x, y, .18) for x, y in bow], .012, 'skin', normal=Z, shrink=1, back=True)

    # The bench leaves a footwell between the cushion and the windscreen.
    part.box((0, 1.51, .29), (1.82, 1.66, .10), 'primary')
    part.box((0, .88, .66), (1.40, .40, .41), 'metal')
    part.box((0, 1.155, .70), (1.62, .17, .54), 'secondary')
    part.box((0, 1.42, .40), (1.62, .48, .11), 'secondary')
    part.box((0, 1.09, 1.64), (1.78, .82, .08), 'primary')
    part.box((0, 1.90, 1.63), (1.78, .84, .07), 'eye', up=V(0, 1, -.10))
    part.box((0, 2.37, .96), (1.94, .12, 1.52), 'primary', corner=.06)
    hood = [pk.rect_ring(V(0, 1.13, z), X, Y, w, h)
            for z, w, h in [(1.66, .69, .31), (2.43, .63, .27),
                            (2.43, .51, .20), (2.37, .49, .18)]]
    part.loft(hood, 'primary', band_regions=['primary', 'primary', 'secondary'])
    part.face([part.vert(p) for p in hood[-1]], 'metal', toward=Z, ao=-.45)
    for side in (-1, 1):
        part.box((side * .89, .99, .96), (.10, .62, 1.34), 'primary')
        part.box((side * .91, 1.83, 1.61), (.09, .98, .10), 'primary', up=V(0, 1, -.10))
        part.box((side * .88, 1.04, 1.92), (.35, .12, .91), 'primary')
        part.box((side * .94, .46, .96), (.27, .08, .84), 'metal')
        part.box((side * .84, 1.19, 2.34), (.20, .17, .12), 'skin')
    part.box((0, .80, 2.43), (2.02, .14, .14), 'metal')
    for z in (-1.84, -.77, 1.82):
        for side in (-1, 1):
            axle = Matrix.Translation(V(side * .92, .47 * math.cos(math.pi / 8), z)) @ Matrix.Rotation(math.pi / 2, 4, 'Z')
            with part.placed(axle):
                part.lathe([(.47, -.14), (.47, .14)], 8, 'secondary', cap_start=True, cap_end=True)
                part.lathe([(.21, -side * .14), (.20, -side * .155)], 5, 'metal', cap_end=True, ao=.15)


def prop_armored_tank(part):
    contract = make_contract(
        ['hull', 'turret'],
        {'hull': None, 'turret': 'hull'},
        {'hull': [0, 0, 0], 'turret': [0, 1.55, .08]},
    )
    with part.skinned(pk.rigid(hull=1.0)):
        for sx in (-1.03, 1.03):
            part.box((sx, .47, 0), (.54, .94, 4.18), 'metal', bevel=.08, ao=-.06)
        part.box((0, 1.02, -.07), (2.12, .98, 3.98), 'primary', bevel=.06, taper=(.94, .90))
        part.box((0, .95, 1.84), (1.92, .58, .68), 'primary', taper=.75)
    with part.skinned(pk.rigid(turret=1.0)):
        part.box((0, 1.83, .08), (1.64, .86, 1.92), 'primary', bevel=.07, taper=.82, ao=.04)
        part.box((0, 1.88, 1.97), (.23, .23, 2.12), 'metal', bevel=.025, ao=.06)
        part.box((.35, 2.37, -.19), (.58, .26, .58), 'metal', bevel=.025)
    return contract


def _tank_clips(contract):
    from build_props import sample_prop_clip
    return [
        sample_prop_clip(contract, 'Idle', 4.0, 16, lambda u, _t: {
            'turret': {'rot': (0.0, 0.32 * math.sin(u * math.tau), 0.0)},
        }),
    ]


# ---- Tactical Comms & Battlefield Props -------------------------------------

def prop_comms_tower(part):
    part.box(V(0, 0.14, 0), (1.28, 0.28, 1.28), 'skin', bevel=0.02)
    part.box(V(0, 1.54, 0), (0.72, 2.52, 0.72), 'metal', taper=0.35, ao=0.02)
    part.box(V(0, 2.95, 0), (0.08, 0.88, 0.08), 'accent')
    part.box(V(0, 2.55, 0), (0.92, 0.06, 0.06), 'accent', ao=0.10)


def prop_searchlight(part):
    contract = make_contract(
        ['base', 'head'],
        {'base': None, 'head': 'base'},
        {'base': [0, 0, 0], 'head': [0, 0.96, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        part.box(V(0, 0.26, 0), (0.86, 0.18, 0.92), 'primary', bevel=0.015)
        wheel_pair(part, 0.0, 0.50, 0.24, 0.10, 'secondary', 'metal')
        part.box(V(0, 0.62, 0), (0.18, 0.54, 0.18), 'metal')
    with part.skinned(pk.rigid(head=1.0)):
        with part.placed(Matrix.Translation(V(0, 1.08, 0)) @ Matrix.Rotation(math.radians(-28), 4, 'X')):
            part.lathe([(0.30, -0.22), (0.34, 0.24)], 8, 'metal', cap_start=True, cap_end=False)
            part.lathe([(0.30, 0.24)], 8, 'accent', cap_end=True, ao=0.26)
    return contract


def _searchlight_clips(contract):
    from build_props import sample_prop_clip
    return [
        sample_prop_clip(contract, 'Sweep', 3.4, 16, lambda u, _t: {
            'head': {'rot': (0.0, 0.75 * math.sin(u * math.tau), 0.0)},
        }),
    ]


def prop_oil_drum_stack(part):
    for cx, cz in ((-0.26, 0.18), (0.26, 0.18), (0.0, -0.26)):
        part.lathe([(0.22, 0.0), (0.23, 0.64)], 8, 'primary', center=(cx, 0, cz), cap_start=True, cap_end=True, ao=0.02)
    with part.placed(Matrix.Translation(V(0, 0.86, 0)) @ Matrix.Rotation(math.pi / 2.0, 4, 'Z')):
        part.lathe([(0.22, -0.32), (0.22, 0.32)], 8, 'accent', cap_start=True, cap_end=True, ao=0.06)


def prop_crate_pallet(part):
    part.box(V(0, 0.06, 0), (1.16, 0.12, 1.02), 'secondary', ao=-0.06)
    for x, z, h in ((-0.28, -0.22, 0.42), (0.28, -0.22, 0.42), (-0.24, 0.24, 0.36), (0.26, 0.24, 0.50)):
        part.box(V(x, 0.12 + h / 2.0, z), (0.48, h, 0.44), 'primary', bevel=0.012, ao=0.04)


def prop_artillery_shell_rack(part):
    part.box(V(0, 0.08, 0), (0.94, 0.16, 0.52), 'secondary', bevel=0.01)
    part.box(V(0, 0.36, 0), (0.88, 0.42, 0.42), 'primary', bevel=0.01)
    for x in (-0.30, -0.10, 0.10, 0.30):
        part.lathe([(0.065, 0.42), (0.065, 0.72)], 6, 'accent', center=(x, 0, 0), tip_end=V(x, 0.88, 0), ao=0.12)


def prop_bunker_lantern_post(part):
    part.box(V(0, 1.02, 0), (0.10, 2.04, 0.10), 'metal', bevel=0.01)
    part.box(V(0, 1.98, 0.16), (0.10, 0.08, 0.36), 'metal')
    part.box(V(0, 1.84, 0.28), (0.22, 0.20, 0.22), 'accent', ao=0.22)


def prop_mortar_pit(part):
    part.lathe([(0.56, 0.0), (0.58, 0.26), (0.44, 0.26), (0.40, 0.06)], 8, 'skin', cap_start=True, ao=-0.04)
    with part.placed(Matrix.Translation(V(0, 0.42, 0.06)) @ Matrix.Rotation(math.radians(-34), 4, 'X')):
        part.lathe([(0.09, -0.26), (0.08, 0.48)], 6, 'metal', cap_start=True, cap_end=True, ao=0.08)


def prop_camo_barricade(part):
    part.box(V(0, 0.56, 0), (1.92, 1.12, 0.48), 'secondary', bevel=0.03, taper=0.86, ao=-0.04)
    part.box(V(0, 1.08, 0.06), (1.76, 0.24, 0.54), 'hair', bevel=0.02, ao=0.06)


def prop_sandbag_corner(part):
    l_corner_wall(part, 1.32, 0.60, 0.40, 'skin', cap_region='skin', ao=0.02)


def prop_guardhouse_booth(part):
    part.box((0,.54,0),(1.16,1.08,1.16),'primary',corner=.035)
    part.box((0,1.57,-.53),(1.16,1.02,.10),'primary')
    for side in (-1,1):
        part.box((side*.52,1.58,.52),(.12,1.04,.12),'skin')
    part.box((0,1.08,.05),(1.24,.10,1.20),'secondary')
    part.box((0,1.08,.69),(.96,.09,.16),'secondary')
    part.box((0,2.13,.04),(1.34,.18,1.34),'primary')
    gable_roof(part,0,2.22,.04,1.24,1.24,.38,'metal',along='z',overhang=.07)
    part.plate(V(0,.70,.58),Z,Y,.39,.28,.025,'accent')


def prop_dirt_road_crossroad(part):
    tile_base(part, 2.00, 2.00, 0.123, 'primary', ao=-0.06)
    for sx in (-0.84, 0.84):
        for sz in (-0.84, 0.84):
            part.box(V(sx, 0.072, sz), (0.32, 0.144, 0.32), 'hair', ao=0.02)


WW2_LEVEL_STATIC = [
    *WW2_DEPOT_STATIC,
    *WW2_KIT_STATIC,
    (prop_dirt_road_straight, 'Dirt Convoy Road'),
    (prop_dirt_road_corner, 'Dirt Road Corner'),
    (prop_dirt_road_crossroad, 'Dirt Road 4-Way Crossroad'),
    (prop_crater_ground_tile, 'Shell Crater Ground Tile'),
    (prop_trench_wall_straight, 'Revetted Trench Wall'),
    (prop_trench_wall_corner, 'Revetted Trench Corner'),
    (prop_sandbag_corner, 'Sandbag Emplacement Corner'),
    (prop_tank_trap_line, "Dragon's Teeth Tank Barrier"),
    (prop_bunker_corner, 'Concrete Bunker Corner'),
    (prop_bunker_doorway, 'Concrete Bunker Blast Door'),
    (prop_command_bunker, 'Fortified Command Pillbox'),
    (prop_guardhouse_booth, 'Checkpoint Guard Booth'),
    (prop_field_tent, 'Olive HQ Field Tent'),
    (prop_supply_shed, 'Corrugated Supply Shed'),
    (prop_military_jeep, 'Military Scout 4x4 Jeep'),
    (prop_supply_truck, '6x6 Canvas Supply Truck'),
    (prop_comms_tower, 'Steel Comms Antenna Mast'),
    (prop_oil_drum_stack, 'Fuel Oil Drum Stack'),
    (prop_crate_pallet, 'Munitions Crate Pallet'),
    (prop_artillery_shell_rack, 'Artillery Shell Rack'),
    (prop_bunker_lantern_post, 'Field Outpost Lamp Post'),
    (prop_mortar_pit, 'Sandbagged Mortar Pit'),
    (prop_camo_barricade, 'Camo Timber Barricade'),
]

WW2_LEVEL_ANIMATED = [
    (prop_armored_tank, _tank_clips, 'Armored Medium Tank'),
    (prop_searchlight, _searchlight_clips, 'AA Searchlight Trailer'),
]
