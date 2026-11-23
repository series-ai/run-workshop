"""Level-building world props for run-chisel-medieval (25 static + animated additions)."""

import math
from mathutils import Matrix

from build_props import make_contract, sample_prop_clip
from props_kit_medieval import KIT_PROPS
from props_medieval_quay import QUAY_PROPS, prop_castle_keep_tower, prop_thatched_cottage
import polykit as pk
from polykit import X, Y, Z, V
from props_level_common import door_unit, gable_roof, hip_roof, l_corner_wall, tile_base, wheel_pair, window_pane


# ---- Modular Terrain, Water & Stairs ----------------------------------------

def prop_grass_tile(part):
    tile_base(part, 2.00, 2.00, 0.135, 'hair', ao=-0.04)
    for x, z in ((-0.52, -0.45), (0.48, 0.35), (-0.18, 0.58)):
        part.plate(V(x, 0.129, z), Y, Z, 0.32, 0.28, 0.008, 'hair', shrink=0.72, ao=0.10)


def prop_dirt_path_tile(part):
    tile_base(part, 2.00, 2.00, 0.125, 'primary', ao=-0.08)
    for sx in (-0.82, 0.82):
        part.box(V(sx, 0.070, 0), (0.36, 0.140, 2.00), 'hair', ao=0.02)
    for sx, z in ((-0.35, -0.55), (0.30, 0.15), (-0.25, 0.62)):
        part.plate(V(sx, 0.125, z), Y, Z, 0.26, 0.22, 0.016, 'skin', shrink=0.80, ao=0.02)


def prop_cobble_road_tile(part):
    tile_base(part, 2.00, 2.00, 0.125, 'secondary', ao=-0.08)
    for sx in (-0.86, 0.86):
        part.box(V(sx, 0.072, 0), (0.28, 0.144, 2.00), 'skin', bevel=0.015, ao=0.04)
    for z in (-0.64, 0.0, 0.64):
        for x in (-0.38, 0.38):
            part.plate(V(x, 0.125, z), Y, Z, 0.60, 0.48, 0.016, 'skin', shrink=0.88, ao=0.05)


def prop_moat_water_tile(part):
    # Flush canal base (y=0) with stone banks at y=0.135 and recessed teal water channel (y=0.06)
    tile_base(part, 2.00, 2.00, 0.058, 'eye', ao=0.06)
    for sz in (-0.84, 0.84):
        part.box(V(0, 0.0675, sz), (2.00, 0.135, 0.32), 'skin', bevel=0.012, ao=0.04)
    for x in (-0.50, 0.45):
        part.plate(V(x, 0.058, 0.08 if x > 0 else -0.10), Y, Z, 0.46, 0.14, 0.014, 'skin', shrink=0.82, ao=0.16)


def prop_stone_stairs(part):
    for sx in (-0.88, 0.88):
        part.box(V(sx, 0.50, 0), (0.24, 1.00, 1.60), 'skin', bevel=0.02, ao=-0.02)
    for i in range(5):
        h = (i + 1) * 0.20
        z = 0.64 - i * 0.32
        part.box(V(0, h / 2.0, z), (1.52, h, 0.34), 'skin', ao=0.03 * i)


def prop_cliff_block(part):
    part.box(V(0, 0.72, 0), (2.00, 1.44, 2.00), 'skin', bevel=0.05, taper=0.92, ao=-0.06)
    part.box(V(0, 1.50, 0), (1.92, 0.16, 1.92), 'hair', bevel=0.02, ao=0.06)
    part.box(V(-0.45, 0.42, 0.96), (0.72, 0.84, 0.24), 'skin', taper=0.8, ao=-0.04)


# ---- Modular Fortress & Village Kit -----------------------------------------

def prop_dungeon_wall_corner(part):
    l_corner_wall(part, 1.24, 2.21, 0.44, 'skin', cap_region='secondary')
    for x in (-0.42, 0.28):
        part.box(V(x, 2.34, -0.40), (0.34, 0.26, 0.46), 'skin', bevel=0.01)


def prop_dungeon_doorway(part):
    for sx in (-0.72, 0.72):
        part.box(V(sx, 1.105, 0), (0.58, 2.21, 0.44), 'skin', bevel=0.015)
    part.box(V(0, 2.12, 0), (1.02, 0.18, 0.44), 'skin', bevel=0.015)
    for sx in (-0.64, 0.0, 0.64):
        part.box(V(sx, 2.34, 0), (0.42, 0.26, 0.46), 'skin', bevel=0.01)
    door_unit(part, (0, 0, 0.16), 0.82, 2.04, 'secondary', 'primary', 'metal')


def prop_dungeon_window_wall(part):
    for sx in (-0.68, 0.68):
        part.box(V(sx, 1.105, 0), (0.66, 2.21, 0.44), 'skin', bevel=0.015)
    part.box(V(0, 0.45, 0), (0.74, 0.90, 0.44), 'skin')
    part.box(V(0, 1.96, 0), (0.74, 0.50, 0.44), 'skin')
    part.box(V(0, 1.30, 0), (0.68, 0.82, 0.22), 'eye', ao=0.14)
    for sx in (-0.64, 0.0, 0.64):
        part.box(V(sx, 2.34, 0), (0.42, 0.26, 0.46), 'skin', bevel=0.01)



def prop_wooden_fence(part):
    for sx in (-0.88, 0.0, 0.88):
        part.box(V(sx, 0.46, 0), (0.14, 0.92, 0.14), 'secondary', bevel=0.01)
    for y in (0.34, 0.72):
        part.box(V(0, y, 0), (1.98, 0.09, 0.07), 'primary', bevel=0.008)


def prop_palisade_wall(part):
    part.box(V(0, 0.88, 0), (2.00, 1.76, 0.32), 'secondary', ao=-0.06)
    for i in range(6):
        x = -0.80 + i * 0.32
        part.box(V(x, 0.95, 0.02), (0.26, 1.90, 0.28), 'primary', bevel=0.015)
        part.box(V(x, 1.98, 0.02), (0.22, 0.22, 0.24), 'primary', taper=0.25, ao=0.06)


# ---- Buildings & Market Stalls ----------------------------------------------


def prop_blacksmith_hut(part):
    part.box(V(0, 0.10, 0), (2.36, 0.20, 1.92), 'skin', bevel=0.02, ao=-0.06)
    part.box(V(0, 1.26, -0.52), (2.28, 2.12, 0.80), 'skin', bevel=0.02)
    for sx in (-0.98, 0.98):
        part.box(V(sx, 1.21, 0.72), (0.16, 2.02, 0.16), 'secondary', bevel=0.01)
    with part.placed(Matrix.Translation(V(0, 2.36, 0.02)) @ Matrix.Rotation(math.radians(6), 4, 'X')):
        part.box(V(0, 0, 0), (2.48, 0.18, 2.08), 'primary', bevel=0.02, ao=0.06)
    # Stone chimney & glowing forge hearth
    part.box(V(0.68, 1.60, -0.62), (0.56, 2.19, 0.56), 'skin', bevel=0.02)
    part.plate(V(-0.20, 0.42, -0.08), Z, Y, 0.52, 0.34, 0.08, 'accent', shrink=0.78, ao=0.22)


def prop_tavern_inn(part):
    part.box(V(0, 0.76, 0), (2.68, 1.52, 2.26), 'skin', bevel=0.02, ao=-0.04)
    part.box(V(0, 1.90, 0), (2.82, 0.76, 2.38), 'primary', bevel=0.02)
    gable_roof(part, 0, 2.28, 0, 2.82, 2.38, 0.88, 'accent', overhang=0.14, along='x', ao=0.06)
    door_unit(part, (0, 0, 1.18), 0.86, 2.08, 'secondary', 'primary', 'metal')
    for sx in (-0.82, 0.82):
        window_pane(part, V(sx, 1.92, 1.20), Z, Y, 0.44, 0.40, 'secondary', 'eye')
    part.box(V(-1.05, 1.24, 1.32), (0.44, 0.30, 0.06), 'accent', ao=0.10)


def prop_market_stall(part):
    part.box(V(0, 0.42, 0.18), (1.94, 0.84, 0.72), 'primary', bevel=0.015)
    for sx in (-0.88, 0.88):
        for sz in (-0.45, 0.48):
            part.box(V(sx, 1.02, sz), (0.10, 2.04, 0.10), 'secondary')
    with part.placed(Matrix.Translation(V(0, 1.96, 0.04)) @ Matrix.Rotation(math.radians(15), 4, 'X')):
        for k in range(5):
            cx = -0.76 + k * 0.38
            part.box(V(cx, 0, 0), (0.37, 0.08, 1.24), 'accent' if k % 2 == 0 else 'skin', ao=0.06)
    for x in (-0.48, 0.0, 0.48):
        part.box(V(x, 0.94, 0.22), (0.36, 0.20, 0.36), 'hair' if x == 0 else 'accent', ao=0.06)


# ---- Vehicles & Siege -------------------------------------------------------

def prop_wooden_wagon(part):
    part.box((0, .54, -.19), (.98, .14, 1.61), 'secondary')
    for side in (-1, 1):
        # The lower board sits in shade. The exposed top rail has a rubbed edge.
        for y, wear in ((.684, -.08), (.87, .13)):
            part.box((side * (.48 + (y - .66) * .12), y, -.19), (.067, .176, 1.62),
                     'primary', ao=wear, cap_start=False)
        part.prism((side*.43,.54,.49), (side*.39,.84,2.30), .054,.041,4,'primary',
                   cap_start=False)
    part.box((0,.74,-.975), (.97,.27,.065), 'primary', cap_start=False)
    part.box((0,1.00,-.15), (1.04,.09,.40), 'primary')

    # The hems hang over the rails and lift at the tie points.
    arch = [(-.54,.94),(-.51,1.76),(-.35,2.09),(0,2.19),
            (.35,2.09),(.51,1.76),(.54,.94)]
    bows = [(-.96, .95, .88), (-.72, 1, 1.00), (-.30, .91, .84),
            (.12, 1, 1.00), (.34, .96, .89)]
    cloth = [[V(x * fullness, .94 + (y - .94) * fullness, z) if y > .94
              else V(math.copysign(.556, x), hem, z)
              for x, y in arch] for z, fullness, hem in bows]
    part.loft(cloth, 'skin', closed=False, two_sided=True, thickness=.005,
              inner_ao=-.2, band_ao=[-.12, -.04, -.14, -.06])

    # Each folded seam follows the canvas and ends in two leather ties.
    for row in (1, 3):
        bow = cloth[row]
        previous = cloth[row - 1]
        blend = .092 / (bow[0].z - previous[0].z)
        lift = [V(.006 * x / .54, .002, 0) for x, _ in arch]
        seam_start = [point.lerp(neighbor, blend) + offset
                      for point, neighbor, offset in zip(bow, previous, lift)]
        seam_end = [point + offset for point, offset in zip(bow, lift)]
        part.loft([seam_start, seam_end], 'skin', closed=False, ao=-.32)
        for side in (-1, 1):
            z = bow[0].z
            part.prism((side * .553, 1.01, z), (side * .526, .66, z + .065),
                       .047, .031, 3, 'secondary', up=X, cap_start=False, cap_end=False)
    for side in (-1, 1):
        # The broad folded skirt sheds water over the middle board.
        flap = [[V(side * .55, top, z), V(side * .568, hem, z)]
                for z, top, hem in ((-.73, 1.065, .99), (-.30, 1.01, .825), (.12, 1.065, .99))]
        part.loft(flap, 'skin', closed=False, toward=side * X, two_sided=True,
                  thickness=.005, inner_ao=-.2, band_ao=[-.17, -.22])
    for z in (-.65,.32):
        part.prism((-.61,.35,z),(.61,.35,z),.06,.06,4,'secondary', cap_start=False,cap_end=False)
        for side in (-1,1):
            # A closed rim leaves daylight between the wooden spokes.
            def hoop(radius, x):
                return [V(side*x,.35+radius*math.cos(a*math.tau/8),z+radius*math.sin(a*math.tau/8))
                        for a in range(8)]
            rim = [hoop(.285,.586),hoop(.35,.586),hoop(.35,.655),hoop(.285,.655)]
            part.loft(rim+[rim[0]], 'primary', band_regions=['primary','secondary','primary','secondary'])
            center = V(side*.62,.35,z)
            for a in (0,math.pi/3,2*math.pi/3):
                spoke = V(0,math.cos(a),math.sin(a))*.30
                part.prism(center-spoke, center+spoke, .033,.033,3,'primary', up=X,
                           cap_start=False,cap_end=False)
            part.prism((side*.58,.35,z),(side*.676,.35,z),.074,.065,5,'metal',
                       cap_start=False)


def prop_rowboat(part):
    # Each loop follows the hull from the stern to the bow and back.
    outline = [(-.17,-1.08),(-.42,-.66),(-.50,-.12),(-.46,.45),
               (-.26,.88),(0,1.20),(.26,.88),(.46,.45),
               (.50,-.12),(.42,-.66),(.17,-1.08)]
    def planks(beam, length, height, rise):
        return [V(x * beam, height + rise * abs(z / 1.20) ** 2, z * length)
                for x, z in outline]

    bottom = planks(.56, .82, 0, 0)
    rim = planks(1, 1, .42, .05)
    inside = planks(.92, .96, .42, .05)
    floor = planks(.55, .80, .045, 0)
    part.loft([bottom, planks(.83, .94, .16, .035), rim, inside, floor],
              'primary', cap_start=True,
              band_regions=['primary','primary','secondary','primary'],
              band_ao=[-.10,0,.06,-.10])
    part.face([part.vert(v) for v in floor], 'primary', toward=Y, ao=-.10)
    part.box(V(0,.345,-.15), (.94,.065,.30), 'secondary', bevel=.008)
    for x in (-.474,.474):
        part.box(V(x,.422,.04), (.052,.06,.12), 'secondary')


def prop_catapult(part):
    contract = make_contract(
        ['base', 'arm'],
        {'base': None, 'arm': 'base'},
        {'base': [0, 0, 0], 'arm': [0, 0.52, -0.35]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        for sx in (-0.54, 0.54):
            part.box(V(sx, 0.40, 0), (0.14, 0.16, 1.72), 'secondary', bevel=0.01)
            part.box(V(sx, 0.88, -0.18), (0.14, 0.88, 0.18), 'secondary', bevel=0.01)
        part.box(V(0, 1.24, -0.18), (1.18, 0.16, 0.18), 'primary', bevel=0.01)
        wheel_pair(part, -0.58, 0.64, 0.32, 0.10, 'primary', 'metal')
        wheel_pair(part, 0.58, 0.64, 0.32, 0.10, 'primary', 'metal')
    with part.skinned(pk.rigid(arm=1.0)):
        with part.placed(Matrix.Translation(V(0, 0.88, 0.15)) @ Matrix.Rotation(math.radians(-38), 4, 'X')):
            part.box(V(0, 0, 0), (0.12, 0.12, 1.38), 'primary', bevel=0.01)
            part.box(V(0, 0.08, 0.62), (0.34, 0.14, 0.34), 'metal', bevel=0.015)
            part.lathe([(0.13, 0.10), (0.15, 0.26)], 6, 'skin', center=(0, 0, 0.62), cap_start=True, cap_end=True, ao=0.06)
    return contract


def _catapult_clips(contract):
    from build_props import sample_prop_clip
    return [
        sample_prop_clip(contract, 'Idle', 2.4, 16, lambda u, _t: {
            'arm': {'rot': (0.04 * math.sin(u * math.tau), 0.0, 0.0)},
        }),
        sample_prop_clip(contract, 'Fire', 1.2, 24, lambda u, _t: {
            'arm': {'rot': (-0.65 * math.sin(u * math.pi) if u < 0.55 else -0.65 * (1.0 - (u - 0.55) / 0.45), 0.0, 0.0)},
        }),
    ]


# ---- Nature & Village Props -------------------------------------------------

def prop_pine_tree(part):
    part.lathe([(.15,0),(.105,.38),(.06,1.72)], 7, 'secondary', cap_start=True)
    # Each branch has a ridge, two shoulders, and a drooping tip.
    for level,(y,length,phase,count) in enumerate(((.94,1,0,8),(1.36,.89,.40,7),
                                                   (1.78,.73,-.16,7),(2.16,.55,.28,6),
                                                   (2.52,.38,-.08,5))):
        for k in range(count):
            angle = phase + k*math.tau/count
            radial = V(.66*math.cos(angle), 0, .76*math.sin(angle))
            across = V(-.66*math.sin(angle), 0, .76*math.cos(angle))
            root = V(.025*level/4, y, -.025*level/4)
            reach = length*(1-.07*(k%2))
            if level == 0:
                part.prism(root-Y*.36, root+radial*.64-Y*.13, .052,.025,4,'secondary')
            base = root+radial*(reach*.50)
            shoulder = across*(length*.50)
            part.loft([[root-radial*.09, base+shoulder, root+radial*reach-Y*(.13+.045*(k%3)),
                        base-shoulder]], 'hair', tip_start=base-Y*.11,
                      tip_end=root+radial*(.21*reach)+Y*(.27+.30*length),
                      ao=.018*level+.035*(k%3))
    part.lathe([(.19,2.59),(.20,2.70)],5,'hair',center=(.025,0,-.025),
               cap_start=True,tip_end=V(.06,3.20,-.02),ao=.10)


def prop_bush_cluster(part):
    for cx, cz, rx, ry in ((0, 0, 0.46, 0.42), (-0.34, 0.18, 0.34, 0.32), (0.32, -0.14, 0.32, 0.30)):
        part.lathe([(rx * 0.65, 0.0), (rx, ry * 0.72)], 6, 'hair', center=(cx, 0, cz), cap_start=True, tip_end=V(cx, ry * 1.45, cz), ao=0.04)


def prop_stone_well(part):
    contract = make_contract(
        ['base', 'bucket'],
        {'base': None, 'bucket': 'base'},
        {'base': [0, 0, 0], 'bucket': [0, 1.56, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        part.lathe([(0.56, 0.0), (0.58, 0.64)], 8, 'skin', cap_start=True, cap_end=True, ao=-0.04)
        part.lathe([(0.44, 0.58)], 8, 'eye', cap_end=True, ao=0.14)
        for sx in (-0.48, 0.48):
            part.box(V(sx, 1.12, 0), (0.10, 1.06, 0.10), 'secondary')
        part.box(V(0, 1.56, 0), (1.02, 0.08, 0.08), 'secondary')
        gable_roof(part, 0, 1.60, 0, 1.14, 0.96, 0.48, 'accent', overhang=0.08, along='x', ao=0.06)
    with part.skinned(pk.rigid(bucket=1.0)):
        part.box(V(0, 1.24, 0), (0.03, 0.62, 0.03), 'metal')
        part.lathe([(0.12, 0.78), (0.14, 0.98)], 6, 'primary', cap_start=True, cap_end=True, ao=0.04)
    return contract


def _well_clips(contract):
    from build_props import sample_prop_clip
    return [
        sample_prop_clip(contract, 'Idle', 2.4, 16, lambda u, _t: {
            'bucket': {'rot': (0.08 * math.sin(u * math.tau), 0.0, 0.06 * math.cos(u * math.tau))},
        }),
    ]


def prop_campfire(part):
    contract = make_contract(
        ['base', 'flame'],
        {'base': None, 'flame': 'base'},
        {'base': [0, 0, 0], 'flame': [0, 0.18, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        for i in range(8):
            ang = math.radians(i * 45.0)
            part.box(V(math.cos(ang) * 0.40, 0.08, math.sin(ang) * 0.40), (0.20, 0.16, 0.18), 'skin', bevel=0.015)
        for ang in (0.3, 1.35, 2.4):
            with part.placed(Matrix.Rotation(ang, 4, 'Y')):
                part.box(V(0, 0.10, 0), (0.68, 0.12, 0.14), 'secondary', bevel=0.01)
    with part.skinned(pk.rigid(flame=1.0)):
        part.lathe([(0.19, 0.14), (0.23, 0.34)], 5, 'accent', cap_start=True, tip_end=V(0, 0.72, 0), ao=0.22)
    return contract


def _campfire_clips(contract):
    from build_props import sample_prop_clip
    return [
        sample_prop_clip(contract, 'Idle', 1.2, 20, lambda u, _t: {
            'flame': {'scale': (1.0 + 0.10 * math.sin(u * math.tau), 1.0 + 0.18 * math.sin(u * math.tau * 2.0), 1.0 - 0.08 * math.sin(u * math.tau))},
        }),
    ]


def prop_hay_bales(part):
    for x, z in ((-0.32, 0.12), (0.34, 0.14), (-0.02, -0.32)):
        part.box(V(x, 0.22, z), (0.56, 0.44, 0.48), 'primary', bevel=0.03, ao=0.08)
        part.box(V(x, 0.22, z), (0.58, 0.08, 0.50), 'secondary', ao=-0.04)
    part.box(V(0.02, 0.64, 0.02), (0.54, 0.42, 0.46), 'primary', bevel=0.03, ao=0.12)
    part.box(V(0.02, 0.64, 0.02), (0.56, 0.08, 0.48), 'secondary', ao=-0.02)


def prop_signpost(part):
    part.box(V(0, 0.90, 0), (0.14, 1.80, 0.14), 'secondary', bevel=0.01)
    part.box(V(0.18, 1.48, 0.08), (0.64, 0.22, 0.06), 'primary', bevel=0.008, ao=0.04)
    part.box(V(-0.16, 1.18, -0.06), (0.58, 0.20, 0.06), 'primary', bevel=0.008, ao=0.04)


def prop_wooden_bench(part):
    part.box(V(0, 0.44, 0), (1.42, 0.08, 0.44), 'primary', bevel=0.01, ao=0.04)
    for sx in (-0.54, 0.54):
        part.box(V(sx, 0.22, 0), (0.12, 0.44, 0.40), 'secondary', bevel=0.01)
    part.box(V(0, 0.74, -0.18), (1.38, 0.24, 0.07), 'primary', bevel=0.008)


def prop_windmill(part):
    contract = make_contract(
        ['tower', 'sails'],
        {'tower': None, 'sails': 'tower'},
        {'tower': [0, 0, 0], 'sails': [0, 2.32, 0.88]},
    )
    with part.skinned(pk.rigid(tower=1.0)):
        part.lathe([(1.06, 0.0), (0.98, 0.42), (0.76, 2.48)], 8, 'skin', cap_start=True, ao=-0.04)
        part.lathe([(0.82, 2.46), (0.44, 2.86)], 8, 'accent', cap_start=True, tip_end=V(0, 3.35, 0), ao=0.06)
        # The low service hatch stays below the moving sails.
        door_unit(part, (0, 0, 0.92), 0.60, 1.08, 'secondary', 'primary', 'metal')
    with part.skinned(pk.rigid(sails=1.0)):
        part.box(V(0, 2.32, 0.84), (0.24, 0.24, 0.34), 'secondary')
        for ang in (0.0, math.pi / 2.0):
            with part.placed(Matrix.Translation(V(0, 2.32, 0.96)) @ Matrix.Rotation(ang, 4, 'Z')):
                part.box(V(0, 0, 0), (0.12, 2.56, 0.06), 'secondary')
                for s in (-1.0, 1.0):
                    part.box(V(0.18 * s, 0.82 * s, 0.02), (0.34, 0.88, 0.03), 'skin', ao=0.10)
    return contract


def _windmill_clips(contract):
    return [
        sample_prop_clip(contract, 'Idle', 3.6, 24, lambda u, _t: {
            'sails': {'rot': (0.0, 0.0, u * math.tau)},
        }),
    ]


MEDIEVAL_LEVEL_STATIC = [
    *QUAY_PROPS,
    *KIT_PROPS,
    (prop_grass_tile, 'Meadow Grass Tile'),
    (prop_dirt_path_tile, 'Village Dirt Path Tile'),
    (prop_cobble_road_tile, 'Cobblestone Street Tile'),
    (prop_moat_water_tile, 'Canal & Moat Water Tile'),
    (prop_stone_stairs, 'Castle Stone Staircase'),
    (prop_cliff_block, 'Terraced Cliff Plateau'),
    (prop_dungeon_wall_corner, 'Dungeon Wall Corner'),
    (prop_dungeon_doorway, 'Dungeon Arch Doorway'),
    (prop_dungeon_window_wall, 'Dungeon Window Wall'),
    (prop_castle_keep_tower, 'Castle Keep Corner Tower'),
    (prop_wooden_fence, 'Split-Rail Village Fence'),
    (prop_palisade_wall, 'Timber Fort Palisade'),
    (prop_thatched_cottage, 'Thatched Village Cottage'),
    (prop_blacksmith_hut, 'Blacksmith Workshop Hut'),
    (prop_tavern_inn, 'Half-Timbered Tavern Inn'),
    (prop_market_stall, 'Cloth Market Stall'),
    (prop_wooden_wagon, 'Covered Supply Wagon'),
    (prop_rowboat, 'Oak River Rowboat'),
    (prop_pine_tree, 'Faceted Alpine Pine'),
    (prop_bush_cluster, 'Shrub & Bush Cluster'),
    (prop_hay_bales, 'Stacked Hay Bales'),
    (prop_signpost, 'Timber Road Signpost'),
    (prop_wooden_bench, 'Tavern Timber Bench'),
]

MEDIEVAL_LEVEL_ANIMATED = [
    (prop_catapult, _catapult_clips, 'Wheeled Siege Catapult'),
    (prop_stone_well, _well_clips, 'Village Stone Well'),
    (prop_campfire, _campfire_clips, 'Blazing Campfire'),
    (prop_windmill, _windmill_clips, 'Timber Grain Windmill'),
]
