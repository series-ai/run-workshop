"""Level-building world props for run-chisel-monsters (22 static + animated additions)."""

import math
from mathutils import Matrix

from build_props import make_contract, sample_prop_clip
from props_kit_monsters import KIT_PROPS
from props_monsters_quarry import QUARRY_PROPS, prop_mine_tunnel_mouth, prop_basalt_cliff_block
import polykit as pk
from polykit import X, Y, Z, V
from props_level_common import door_unit, gable_roof, hip_roof, l_corner_wall, tile_base, wheel_pair


# ---- Modular Dungeon, Dais & Hazard Terrain Tiles ---------------------------

def prop_basalt_floor_tile(part):
    tile_base(part, 2.00, 2.00, 0.14, 'skin', ao=-0.06)
    for x, z in ((-0.46, -0.46), (0.46, -0.46), (-0.46, 0.46), (0.46, 0.46)):
        part.plate(V(x, 0.128, z), Y, Z, 0.72, 0.72, 0.014, 'secondary', shrink=0.90, ao=0.04)


def prop_obsidian_dais_tile(part):
    tile_base(part, 2.00, 2.00, 0.24, 'secondary', bevel=0.02, ao=-0.04)
    part.plate(V(0, 0.228, 0), Y, Z, 1.56, 1.56, 0.014, 'skin', shrink=0.90, ao=0.06)


def prop_obsidian_stairs(part):
    for sx in (-0.86, 0.86):
        part.box(V(sx, 0.28, 0), (0.26, 0.56, 1.40), 'secondary', bevel=0.02)
    for i in range(4):
        h = (i + 1) * 0.135
        z = 0.52 - i * 0.35
        part.box(V(0, h / 2.0, z), (1.48, h, 0.36), 'skin', ao=0.03 * i)


def prop_lava_pool_tile(part):
    tile_base(part, 2.00, 2.00, 0.055, 'eye', ao=0.22)
    for sz in (-0.84, 0.84):
        part.box(V(0, 0.070, sz), (2.00, 0.140, 0.32), 'secondary', bevel=0.015, ao=-0.04)
    part.plate(V(0, 0.055, 0), Y, Z, 0.58, 0.42, 0.018, 'secondary', shrink=0.72, ao=-0.02)


def prop_lava_shore_tile(part):
    tile_base(part, 2.00, 2.00, 0.055, 'eye', ao=0.22)
    part.box(V(0, 0.070, -0.50), (2.00, 0.140, 1.00), 'secondary', bevel=0.02, ao=-0.04)
    part.plate(V(0.32, 0.140, -0.50), Y, Z, 0.62, 0.48, 0.02, 'skin', ao=0.04)


def prop_swamp_sludge_tile(part):
    tile_base(part, 2.00, 2.00, 0.055, 'hair', ao=0.14)
    for sz in (-0.86, 0.86):
        part.box(V(0, 0.070, sz), (2.00, 0.140, 0.28), 'skin', bevel=0.015)


# ---- Modular Ruin & Orc Fortification Kit -----------------------------------

def prop_ruin_wall_straight(part):
    part.box(V(0, 0.96, 0), (2.04, 1.92, 0.46), 'skin', bevel=0.02)
    for x in (-0.64, 0.24):
        part.box(V(x, 2.04, 0), (0.58, 0.30, 0.44), 'secondary', bevel=0.015)


def prop_ruin_wall_corner(part):
    l_corner_wall(part, 1.24, 2.15, 0.46, 'skin', cap_region='secondary')


def prop_bone_fence(part):
    for sx in (-0.86, 0.0, 0.86):
        part.box(V(sx, 0.56, 0), (0.14, 1.12, 0.14), 'primary', bevel=0.01)
        part.box(V(sx, 1.06, 0.04), (0.22, 0.20, 0.22), 'accent', bevel=0.02, ao=0.12)
    for y in (0.36, 0.72):
        part.box(V(0, y, 0), (1.96, 0.10, 0.08), 'primary')


def prop_cave_archway(part):
    for sx in (-0.88, 0.88):
        part.box(V(sx, 1.08, 0), (0.56, 2.16, 0.82), 'secondary', bevel=0.04, taper=0.86)
    part.box(V(0, 2.22, 0), (2.32, 0.42, 0.84), 'secondary', bevel=0.04, taper=0.88, ao=0.04)


def prop_spiked_gate(part):
    for sx in (-0.92, 0.92):
        part.box(V(sx, 1.24, 0), (0.36, 2.48, 0.46), 'primary', bevel=0.02)
        part.box(V(sx, 2.38, 0.16), (0.14, 0.24, 0.36), 'accent', taper=0.3)
    part.box(V(0, 2.28, 0), (2.22, 0.38, 0.44), 'primary', bevel=0.02)
    for sx in (-0.42, 0.42):
        part.box(V(sx, 1.02, 0), (0.76, 1.98, 0.16), 'secondary', bevel=0.01)


# ---- Lair Structures & Landmarks --------------------------------------------

def prop_orc_war_hut(part):
    part.lathe([(1.24, 0.0), (1.28, 0.34), (1.18, 2.10)], 8, 'primary', cap_start=True, ao=-0.04)
    part.lathe([(1.32, 2.10), (0.68, 2.40)], 8, 'secondary', cap_start=True, tip_end=V(0, 2.68, 0), ao=0.06)
    part.box(V(0, 1.04, 1.09), (1.04, 2.08, 0.32), 'primary')
    door_unit(part, (0, 0, 1.24), 0.86, 2.04, 'accent', 'secondary', 'metal')


def prop_ruined_keep_tower(part):
    part.box(V(0, 1.62, 0), (2.04, 3.24, 2.04), 'skin', bevel=0.03, taper=0.92)
    for x, z, h in ((-0.62, -0.58, 0.56), (0.58, -0.58, 0.34), (-0.64, 0.58, 0.28)):
        part.box(V(x, 3.24 + h / 2.0, z), (0.54, h, 0.54), 'skin', bevel=0.015, ao=0.04)
    part.box(V(0, 2.55, 0.98), (0.28, 0.62, 0.10), 'secondary', ao=-0.12)
    door_unit(part, (0, 0, 1.02), 0.86, 2.04, 'secondary', 'primary', 'metal')


def prop_shaman_shrine(part):
    part.box(V(0, 0.18, 0), (2.22, 0.36, 2.02), 'secondary', bevel=0.02)
    for sx in (-0.78, 0.78):
        part.box(V(sx, 1.32, -0.58), (0.42, 1.96, 0.44), 'skin', bevel=0.02)
    part.box(V(0, 2.28, -0.58), (2.16, 0.42, 0.56), 'secondary', bevel=0.02)
    part.box(V(0, 0.76, 0.24), (0.94, 0.80, 0.64), 'skin', bevel=0.02)
    part.box(V(0, 1.32, 0.24), (0.36, 0.36, 0.36), 'eye', ao=0.26)



# ---- Vehicles & Siege -------------------------------------------------------

def prop_bone_war_wagon(part):
    part.box(V(0, 0.64, 0), (1.24, 0.42, 2.18), 'primary', bevel=0.02)
    for sx in (-0.56, 0.56):
        part.box(V(sx, 0.98, 0), (0.10, 0.46, 2.02), 'secondary')
    for side in (-1, 1):
        part.prism((side*.47,.64,.96), (side*.39,.84,2.83),
                   .09,.055,4,'accent',ao=.10)
    wheel_pair(part, -0.68, 0.68, 0.36, 0.12, 'secondary', 'metal')
    wheel_pair(part, 0.68, 0.68, 0.36, 0.12, 'secondary', 'metal')


def prop_siege_ballista(part):
    part.box(V(0, 0.42, 0), (1.16, 0.20, 1.38), 'primary', bevel=0.015)
    part.box(V(0, 0.78, 0), (0.18, 0.62, 0.22), 'secondary')
    part.box(V(0, 1.06, 0.08), (0.24, 0.18, 1.38), 'primary', bevel=0.01)
    part.box(V(0, 1.06, 0.56), (1.76, 0.14, 0.16), 'accent', bevel=0.01, ao=0.06)
    part.box(V(0, 1.16, 0.24), (0.08, 0.08, 1.32), 'metal', ao=0.10)


# ---- Dungeon & Cavern Props -------------------------------------------------

def prop_obsidian_throne(part):
    part.box(V(0, 0.18, 0), (1.22, 0.36, 1.02), 'secondary', bevel=0.02)
    part.box(V(0, 0.58, 0.06), (0.86, 0.44, 0.72), 'skin', bevel=0.02)
    part.box(V(0, 1.24, -0.28), (0.94, 1.28, 0.24), 'secondary', bevel=0.02)
    for sx in (-0.42, 0.42):
        part.box(V(sx, 0.76, 0.04), (0.16, 0.34, 0.72), 'skin', bevel=0.01)
        part.box(V(sx, 1.88, -0.28), (0.14, 0.34, 0.14), 'accent', taper=0.25, ao=0.12)


def prop_bubbling_cauldron(part):
    contract = make_contract(
        ['pot', 'brew'],
        {'pot': None, 'brew': 'pot'},
        {'pot': [0, 0, 0], 'brew': [0, 0.84, 0]},
    )
    with part.skinned(pk.rigid(pot=1.0)):
        part.lathe([(0.34, 0.08), (0.50, 0.42), (0.46, 0.76), (0.38, 0.90)], 8, 'metal', cap_start=True, ao=-0.04)
    with part.skinned(pk.rigid(brew=1.0)):
        part.lathe([(0.34, 0.84)], 8, 'eye', cap_end=True, ao=0.24)
        for bx, bz in ((-0.12, 0.08), (0.14, -0.06)):
            part.box(V(bx, 0.92, bz), (0.12, 0.12, 0.12), 'eye', ao=0.26)
    return contract


def _cauldron_clips(contract):
    from build_props import sample_prop_clip
    return [
        sample_prop_clip(contract, 'Idle', 1.6, 16, lambda u, _t: {
            'brew': {'pos': (0.0, 0.04 * math.sin(u * math.tau), 0.0), 'rot': (0.0, u * math.tau, 0.0)},
        }),
    ]


def prop_stalagmite_cluster(part):
    for cx, cz, r, h in ((0, 0, 0.28, 1.82), (-0.36, 0.20, 0.20, 1.18), (0.34, -0.18, 0.22, 1.36)):
        part.lathe([(r, 0.0), (r * 0.72, h * 0.45)], 5, 'secondary', center=(cx, 0, cz), cap_start=True, tip_end=V(cx, h, cz), ao=0.04)


def prop_mushroom_cluster(part):
    for x, z, radius, height, lean in ((-.04, -.04, .34, .96, .12),
                                       (-.34, .22, .22, .47, -.06),
                                       (.32, -.18, .24, .62, .08)):
        stem = [(x-lean, 0, radius*.34), (x-lean*.6, height*.32, radius*.23),
                (x, height*.77, radius*.18)]
        part.loft([pk.ring(V(cx, y, z), X, Z, r, r, 7) for cx, y, r in stem],
                  'skin', cap_start=True)
        part.lathe([(radius*.15, height*.76), (radius, height*.69),
                    (radius*.88, height*.79), (radius*.38, height*.95)],
                   6, 'eye', center=(x, 0, z),
                   band_regions=['hair', 'secondary', 'primary'],
                   tip_end=V(x+lean*.23, height, z))


def prop_hanging_cage(part):
    contract = make_contract(
        ['gallows', 'cage'],
        {'gallows': None, 'cage': 'gallows'},
        {'gallows': [0, 0, 0], 'cage': [0.24, 2.26, 0]},
    )
    with part.skinned(pk.rigid(gallows=1.0)):
        part.box(V(-0.46, 1.22, 0), (0.16, 2.44, 0.16), 'primary', bevel=0.01)
        part.box(V(-0.06, 2.38, 0), (0.96, 0.14, 0.14), 'primary')
    with part.skinned(pk.rigid(cage=1.0)):
        part.box(V(0.24, 2.21, 0), (0.04, 0.24, 0.04), 'metal')
        for y in (.18,2.10):
            part.box(V(.24,y,0), (.79,.08,.76), 'metal', bevel=.01)
        for x in (-.115,.24,.595):
            for z in (-.34,.34):
                part.box(V(x,1.14,z), (.045,1.90,.045), 'metal')
        for x in (-.115,.595):
            part.box(V(x,1.14,0), (.045,1.90,.045), 'metal')
    return contract


def _cage_clips(contract):
    from build_props import sample_prop_clip
    return [
        sample_prop_clip(contract, 'Idle', 2.8, 16, lambda u, _t: {
            'cage': {'rot': (0.04 * math.sin(u * math.tau), 0.0, 0.08 * math.cos(u * math.tau))},
        }),
    ]


def prop_lava_bridge(part):
    xs = [-1.04, -0.68, -0.34, 0.0, 0.34, 0.68, 1.04]
    ys = [0.04, 0.16, 0.24, 0.28, 0.24, 0.16, 0.04]
    for x, y in zip(xs, ys):
        part.box(V(x, y + 0.06, 0), (0.30, 0.12, 1.24), 'secondary', bevel=0.015, ao=0.04)
    for sx in (-0.76, 0.76):
        for sz in (-0.56, 0.56):
            part.box(V(sx, 0.58, sz), (0.16, 0.82, 0.16), 'skin', bevel=0.01)
            part.box(V(sx, 1.04, sz), (0.20, 0.18, 0.20), 'accent', bevel=0.02, ao=0.10)



MONSTERS_LEVEL_STATIC = [
    *QUARRY_PROPS,
    *KIT_PROPS,
    (prop_basalt_floor_tile, 'Cracked Basalt Floor Tile'),
    (prop_obsidian_dais_tile, 'Obsidian Dais Terrace Tile'),
    (prop_obsidian_stairs, 'Obsidian Temple Stairs'),
    (prop_lava_pool_tile, 'Volcanic Magma Pool Tile'),
    (prop_lava_shore_tile, 'Molten Lava Shore Tile'),
    (prop_swamp_sludge_tile, 'Toxic Mire Canal Tile'),
    (prop_basalt_cliff_block, 'Obsidian Basalt Cliff Block'),
    (prop_lava_bridge, 'Charred Stone Chasm Bridge'),
    (prop_ruin_wall_straight, 'Shattered Ruin Wall'),
    (prop_ruin_wall_corner, 'Shattered Ruin Corner'),
    (prop_bone_fence, 'Spiked Bone Fence'),
    (prop_cave_archway, 'Jagged Cavern Archway'),
    (prop_spiked_gate, 'Spiked Orc Fortress Gate'),
    (prop_orc_war_hut, 'Orc Hide War Pavilion'),
    (prop_ruined_keep_tower, 'Ruined Watchtower Keep'),
    (prop_shaman_shrine, 'Horned Shaman Shrine'),
    (prop_mine_tunnel_mouth, 'Cavern Mine Entrance'),
    (prop_bone_war_wagon, 'Spiked Orc War Wagon'),
    (prop_siege_ballista, 'Horned Siege Ballista'),
    (prop_obsidian_throne, 'Obsidian Warlord Throne'),
    (prop_stalagmite_cluster, 'Obsidian Stalagmite Cluster'),
    (prop_mushroom_cluster, 'Glowing Cavern Mushrooms'),
]

MONSTERS_LEVEL_ANIMATED = [
    (prop_bubbling_cauldron, _cauldron_clips, 'Bubbling Witch Cauldron'),
    (prop_hanging_cage, _cage_clips, 'Iron Hanging Gibbet Cage'),
]
