"""Level-building world props for run-chisel-cyberpunk (24 static + animated additions)."""

import math
from mathutils import Matrix

from build_props import make_contract, sample_prop_clip
from props_cyber_district import DISTRICT_PROPS, prop_cyber_apartment, prop_tech_workshop
from props_kit_cyberpunk import KIT_PROPS
import polykit as pk
from polykit import X, Y, Z, V
from props_level_common import door_unit, l_corner_wall, tile_base


# ---- Modular Cyber Roads & Catwalks -----------------------------------------

def prop_cyber_road_straight(part):
    tile_base(part, 2.00, 2.00, 0.113, 'secondary', ao=-0.10)
    for sx in (-0.90, 0.90):
        part.box(V(sx, 0.102, 0), (0.08, 0.025, 2.00), 'eye', ao=0.22)
    for z in (-0.52, 0.52):
        part.plate(V(0, 0.113, z), Y, Z, 0.12, 0.56, 0.008, 'accent', ao=0.14)


def prop_cyber_road_corner(part):
    tile_base(part, 2.00, 2.00, 0.113, 'secondary', ao=-0.10)
    part.box(V(-0.90, 0.102, 0), (0.08, 0.025, 2.00), 'eye', ao=0.22)
    part.box(V(0, 0.102, -0.90), (2.00, 0.025, 0.08), 'eye', ao=0.22)
    part.box(V(0.90, 0.102, 0.90), (0.20, 0.025, 0.20), 'eye', ao=0.22)


def prop_cyber_road_crosswalk(part):
    tile_base(part, 2.00, 2.00, 0.113, 'secondary', ao=-0.10)
    for x in (-0.64, -0.22, 0.22, 0.64):
        part.plate(V(x, 0.113, 0), Y, Z, 0.24, 1.46, 0.010, 'eye', shrink=0.95, ao=0.22)


def prop_cyber_road_tsplit(part):
    tile_base(part, 2.00, 2.00, 0.113, 'secondary', ao=-0.10)
    part.box(V(0, 0.102, -0.90), (2.00, 0.025, 0.08), 'eye', ao=0.22)
    for sx in (-0.90, 0.90):
        part.box(V(sx, 0.102, 0.90), (0.20, 0.025, 0.20), 'eye', ao=0.22)


def prop_cyber_road_junction(part):
    tile_base(part, 2.00, 2.00, 0.113, 'secondary', ao=-0.10)
    for sx in (-0.90, 0.90):
        for sz in (-0.90, 0.90):
            part.box(V(sx, 0.102, sz), (0.20, 0.025, 0.20), 'eye', ao=0.22)


def prop_catwalk_stairs(part):
    for sx in (-0.82, 0.82):
        part.box(V(sx, 0.55, 0), (0.14, 1.10, 1.60), 'primary', bevel=0.015)
    for i in range(5):
        h = (i + 1) * 0.22
        z = 0.64 - i * 0.32
        part.box(V(0, h - 0.05, z), (1.50, 0.10, 0.34), 'metal', ao=0.04)


def prop_catwalk_railing(part):
    for sx in (-0.88, 0.0, 0.88):
        part.box(V(sx, 0.48, 0), (0.10, 0.96, 0.10), 'metal')
    part.box(V(0, 0.90, 0), (1.98, 0.08, 0.12), 'primary')
    part.plate(V(0, 0.62, 0.05), Z, Y, 1.84, 0.08, 0.01, 'eye', ao=0.24)


# ---- Modular Megablock & Vault Architecture ---------------------------------

def prop_vault_wall_panel(part):
    part.box(V(0, 1.25, 0), (2.00, 2.50, 0.46), 'secondary', bevel=0.02)
    part.plate(V(0, 1.30, 0.235), Z, Y, 1.56, 1.72, 0.03, 'primary', shrink=0.92)
    part.plate(V(0, 2.18, 0.235), Z, Y, 1.76, 0.14, 0.02, 'eye', ao=0.26)


def prop_vault_wall_corner(part):
    l_corner_wall(part, 1.24, 2.50, 0.46, 'secondary', cap_region='primary')
    part.plate(V(0.10, 2.18, -0.15), Z, Y, 0.88, 0.12, 0.02, 'eye', ao=0.24)


def prop_vault_window_wall(part):
    for sx in (-0.70, 0.70):
        part.box(V(sx, 1.25, 0), (0.60, 2.50, 0.46), 'secondary', bevel=0.02)
    part.box(V(0, 0.56, 0), (0.88, 1.12, 0.46), 'secondary')
    part.box(V(0, 2.14, 0), (0.88, 0.72, 0.46), 'secondary')
    part.box(V(0, 1.44, 0), (0.82, 0.64, 0.20), 'eye', ao=0.22)


def prop_alley_wall_panel(part):
    part.box(V(0, 1.20, 0), (2.00, 2.40, 0.36), 'primary', bevel=0.02)
    for y in (0.65, 1.55):
        part.box(V(0, y, 0.20), (1.92, 0.10, 0.10), 'metal')
    part.plate(V(-0.32, 1.25, 0.19), Z, Y, 0.72, 0.32, 0.02, 'accent', ao=0.18)


def prop_overhead_pipe_bridge(part):
    for x in (-1.04, 1.04):
        part.box((x, .09, 0), (.32, .18, .54), 'primary', corner=.035)
        part.box((x, 1.28, 0), (.19, 2.26, .24), 'secondary')
        part.box((x, 2.43, .015), (.25, .18, .54), 'primary')
    # Two clamped pipes span the open space between the posts.
    for z, y, radius, role in ((.146, 2.64, .148, 'primary'), (-.186, 2.60, .097, 'metal')):
        part.prism((-1.20, y, z), (1.20, y, z), radius, radius, 8, role, up=Y,
                   cap_start=True, cap_end=True)
        for x in (-1.04, 1.04):
            part.prism((x-.07, y, z), (x+.07, y, z), radius+.019, radius+.019,
                       8, 'secondary', up=Y, cap_start=True, cap_end=True)


def prop_holo_billboard(part):
    contract = make_contract(
        ['base', 'panel'],
        {'base': None, 'panel': 'base'},
        {'base': [0, 0, 0], 'panel': [0, 2.38, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        for sx in (-0.72, 0.72):
            part.box(V(sx, 0.92, 0), (0.18, 1.84, 0.24), 'secondary', bevel=0.015)
        part.box(V(0, 2.38, 0), (2.08, 1.48, 0.22), 'secondary', bevel=0.02)
    with part.skinned(pk.rigid(panel=1.0)):
        part.plate(V(0, 2.38, 0.12), Z, Y, 1.84, 1.20, 0.03, 'eye', ao=0.26)
        part.plate(V(0, 2.38, 0.14), Z, Y, 0.92, 0.44, 0.02, 'accent', ao=0.22)
    return contract


def _billboard_clips(contract):
    from build_props import sample_prop_clip
    return [
        sample_prop_clip(contract, 'Idle', 2.4, 16, lambda u, _t: {
            'panel': {'pos': (0.0, 0.04 * math.sin(u * math.tau), 0.0)},
        }),
    ]


# ---- District Buildings -----------------------------------------------------

def prop_vault_bunker_hub(part):
    part.box(V(0, 1.38, 0), (2.78, 2.76, 2.18), 'secondary', bevel=0.03)
    part.box(V(0, 2.84, 0), (2.90, 0.22, 2.28), 'primary', bevel=0.02, ao=0.06)
    part.plate(V(0, 2.52, 1.10), Z, Y, 2.32, 0.16, 0.02, 'eye', ao=0.26)
    door_unit(part, (0, 0, 1.09), 0.92, 2.12, 'metal', 'primary', 'eye')
    part.box(V(0.76, 3.12, -0.35), (0.64, 0.42, 0.64), 'metal', bevel=0.015)


def prop_power_substation(part):
    part.box(V(0, 0.16, 0), (2.12, 0.32, 1.72), 'secondary', bevel=0.02)
    part.box(V(-0.42, 0.96, 0), (0.98, 1.28, 1.18), 'primary', bevel=0.02)
    for sz in (-0.36, 0.36):
        part.lathe([(0.24, 0.32), (0.26, 1.78)], 8, 'metal', center=(0.56, 0, sz), cap_start=True, cap_end=True)
        part.lathe([(0.27, 1.38), (0.27, 1.54)], 8, 'eye', center=(0.56, 0, sz), ao=0.24)


# ---- Cyber Vehicles ---------------------------------------------------------

def prop_hover_car(part):
    contract = make_contract(
        ['body'],
        {'body': None},
        {'body': [0, 0.52, 0]},
    )
    with part.skinned(pk.rigid(body=1.0)):
        part.box((0, .10, 0), (1.70, .08, 3.78), 'primary', bevel=.06, corner=.16)
        for side in (-1, 1):
            part.box((side*.82, .44, -.12), (.12, .66, 2.12), 'primary')
            for z in (-1.20, 1.20):
                part.box((side*.79, .14, z), (.40, .24, .66), 'metal', bevel=.04)
                part.plate(V(side*.79,.02,z), -Y, Z, .32, .48, .02, 'eye', ao=.26)
        for z, depth in ((1.38, .94), (-1.55, .74)):
            part.box((0,.56,z), (1.74,.42,depth), 'primary', bevel=.06, corner=.12)
        cabin = [pk.rect_ring(V(0,y,z), X, Z, w, d, .14)
                 for y,z,w,d in ((.77,-.12,.88,1.06), (1.55,-.20,.67,.72))]
        part.loft(cabin, 'eye', ao=.22)
        part.box((0,1.58,-.20), (1.34,.06,1.44), 'secondary', corner=.14)
        part.box((-.37,.36,-.12), (.48,.44,.50), 'secondary')
        part.box((-.37,.78,-.35), (.48,.42,.08), 'secondary')
    return contract


def _hover_car_clips(contract):
    from build_props import sample_prop_clip
    return [
        sample_prop_clip(contract, 'Hover', 2.0, 16, lambda u, _t: {
            'body': {'pos': (0.0, 0.06 * math.sin(u * math.tau), 0.0)},
        }),
    ]


def prop_cyber_bike(part):
    part.box(V(0, 0.44, 0), (0.36, 0.34, 1.72), 'primary', bevel=0.03)
    part.box(V(0, 0.68, 0.46), (0.38, 0.32, 0.52), 'accent', taper=0.72)
    part.box((0,.685,-.18), (.31,.15,.54), 'secondary', bevel=.03)
    part.prism(V(0,.79,.46), V(0,1.00,.30), .055,.04,6,'metal')
    part.box((0,1.00,.30), (.66,.06,.08), 'metal')
    part.box((0,.32,.04), (.58,.06,.11), 'metal')
    for sz in (-0.64, 0.64):
        with part.placed(Matrix.Translation(V(0, 0.28, sz)) @ Matrix.Rotation(math.pi / 2.0, 4, 'Z')):
            part.lathe([(0.28, -0.10), (0.28, 0.10)], 8, 'secondary', cap_start=True, cap_end=True)
            part.lathe([(0.18, -0.11), (0.18, 0.11)], 6, 'eye', cap_start=True, cap_end=True, ao=0.22)


def prop_cargo_loader(part):
    from props_level_common import wheel_pair
    part.box((0,.40,-.22), (1.36,.28,2.00), 'accent', bevel=.05)
    part.box((0,.70,-.62), (1.36,.40,1.20), 'accent', bevel=.04)
    part.prism(V(.30,.54,.22), V(.30,1.04,.14), .035,.045,5,'metal')
    part.box((0,.93,-.94), (1.32,.54,.55), 'accent', bevel=.04)
    part.box((0,1.00,-.36), (.54,.20,.52), 'secondary', bevel=.025)
    part.box((0,1.29,-.59), (.54,.42,.10), 'secondary', bevel=.025)
    for x in (-.59, .59):
        for z in (-.78, .42):
            part.box((x,1.24,z), (.08,1.96,.08), 'metal')
        part.box((x,1.23,.85), (.14,2.20,.16), 'secondary')
        part.box((x,.21,1.37), (.14,.09,1.18), 'metal')
    part.box((0,2.24,-.18), (1.38,.12,1.45), 'metal', bevel=.02)
    part.box((0,.62,.85), (1.30,.16,.17), 'secondary')
    for axle in (-.77,.51):
        wheel_pair(part, axle,.65,.35,.20)


# ---- Street & Vault Set Dressing --------------------------------------------

def prop_neon_vending_booth(part):
    contract = make_contract(
        ['body', 'screen'],
        {'body': None, 'screen': 'body'},
        {'body': [0, 0, 0], 'screen': [0, 1.32, 0.36]},
    )
    with part.skinned(pk.rigid(body=1.0)):
        part.box(V(0, 0.98, 0), (1.02, 1.96, 0.72), 'secondary', bevel=0.02)
        part.box(V(0, 0.44, 0.34), (0.64, 0.28, 0.10), 'metal')
    with part.skinned(pk.rigid(screen=1.0)):
        part.plate(V(0, 1.34, 0.37), Z, Y, 0.72, 0.88, 0.02, 'eye', ao=0.26)
    return contract


def _neon_vending_clips(contract):
    from build_props import sample_prop_clip
    return [
        sample_prop_clip(contract, 'Idle', 2.0, 16, lambda u, _t: {
            'screen': {'scale': (1.0 + 0.02 * math.sin(u * math.tau), 1.0 + 0.02 * math.sin(u * math.tau), 1.0)},
        }),
    ]


def prop_arcade_cabinet(part):
    part.box(V(0, 0.42, -0.03), (0.72, 0.84, 0.62), 'secondary', corner=0.045)
    part.box(V(0, 1.17, -0.18), (0.70, 0.74, 0.30), 'primary')
    for x in (-0.35, 0.35):
        outline = [V(x, y, z) for y, z in [
            (0.72, -0.34), (1.76, -0.34), (1.76, 0.20), (1.57, 0.25),
            (1.46, -0.02), (1.10, 0.10), (0.98, 0.39), (0.75, 0.32),
        ]]
        part.slab(outline, 0.045, 'primary', normal=X if x > 0 else -X,
                  shrink=0.98, back=True)
    part.box(V(0, 1.64, -0.04), (0.71, 0.22, 0.50), 'secondary')
    part.plate(V(0, 1.64, 0.21), Z, Y, 0.49, 0.072, 0.012, 'accent')
    screen_up = V(0, 1, -0.33).normalized()
    screen_normal = X.cross(screen_up)
    screen = V(0, 1.32, 0.018)
    part.box(screen, (0.64, 0.54, 0.12), 'secondary', up=screen_up)
    part.plate(screen + screen_normal * 0.06, screen_normal, screen_up,
               0.51, 0.40, 0.016, 'hair', corner=0.038, shrink=0.96)
    # The two paddles share one ball on the game screen.
    for x, height in ((-.18, .04), (.18, -.035)):
        part.plate(screen + X*x + screen_up*height + screen_normal*.077,
                   screen_normal, screen_up, .019, .098, .002, 'eye', shrink=1)
    part.plate(screen + X*.062 + screen_normal*.077, screen_normal, screen_up,
               .026, .026, .002, 'skin')
    part.box(V(0, 0.94, 0.16), (0.70, 0.12, 0.50), 'primary', corner=.04)
    part.lathe([(0.022, 1.00), (0.022, 1.10), (0.055, 1.12), (0.04, 1.17)],
               6, 'accent', center=(-0.18, 0, 0.21), cap_start=True, cap_end=True)
    for x in (0.10, 0.23):
        part.lathe([(0.044, 1.00), (0.043, 1.03)], 6, 'eye',
                   center=(x, 0, 0.24), cap_start=True, cap_end=True)
    part.box(V(0.19, 0.61, 0.29), (0.16, 0.20, 0.04), 'metal')
    part.box(V(0.19, 0.65, 0.32), (0.074, 0.019, 0.02), 'hair')


def prop_cable_spool(part):
    for y in (0.08, 0.72):
        part.lathe([(0.42, y - 0.06), (0.42, y + 0.06)], 8, 'primary', cap_start=True, cap_end=True)
    part.lathe([(0.28, 0.14), (0.28, 0.66)], 8, 'secondary', ao=-0.04)


def prop_antenna_array(part):
    part.box(V(0, 0.24, 0), (0.96, 0.48, 0.86), 'secondary', bevel=0.02)
    part.box(V(-0.24, 1.56, 0), (0.14, 2.48, 0.14), 'metal')
    with part.placed(Matrix.Translation(V(0.22, 1.72, 0.12)) @ Matrix.Rotation(math.radians(-35), 4, 'X')):
        part.lathe([(0.12, 0), (0.42, 0.22)], 8, 'skin', cap_start=True, tip_end=V(0, -0.05, 0), ao=0.08)


def prop_pipe_cluster(part):
    part.box(V(0, 0.18, 0), (1.42, 0.36, 0.72), 'secondary', bevel=0.015)
    for x in (-0.42, 0.0, 0.42):
        part.lathe([(0.14, 0.34), (0.14, 1.18)], 8, 'metal', center=(x, 0, 0), cap_end=True, ao=0.04)
    part.box(V(0, 1.24, 0), (1.16, 0.20, 0.34), 'accent', bevel=0.01)


def prop_traffic_pylon(part):
    part.box(V(0, 0.04, 0), (0.40, 0.08, 0.40), 'secondary')
    part.lathe([(0.15, 0.08), (0.07, 0.68)], 6, 'accent', tip_end=V(0, 0.72, 0), ao=0.14)
    part.lathe([(0.12, 0.36), (0.10, 0.48)], 6, 'eye', ao=0.24)


CYBERPUNK_LEVEL_STATIC = [
    *DISTRICT_PROPS,
    *KIT_PROPS,
    (prop_cyber_road_straight, 'Cyber Asphalt Straight Road'),
    (prop_cyber_road_corner, 'Cyber Asphalt Corner Road'),
    (prop_cyber_road_tsplit, 'Cyber Asphalt T-Intersection'),
    (prop_cyber_road_junction, 'Cyber Asphalt 4-Way Junction'),
    (prop_cyber_road_crosswalk, 'Neon Pedestrian Crosswalk'),
    (prop_catwalk_stairs, 'Industrial Catwalk Stairs'),
    (prop_catwalk_railing, 'Neon Safety Railing'),
    (prop_vault_wall_panel, 'Armored Vault Wall Panel'),
    (prop_vault_wall_corner, 'Armored Vault Wall Corner'),
    (prop_vault_window_wall, 'Armored Observation Wall'),
    (prop_alley_wall_panel, 'Back-Alley Conduit Wall'),
    (prop_overhead_pipe_bridge, 'Overhead Coolant Gantry'),
    (prop_vault_bunker_hub, 'Corporate Vault Bunker Hub'),
    (prop_cyber_apartment, 'Megablock Apartment Tower'),
    (prop_tech_workshop, 'Ripperdoc Tech Garage'),
    (prop_power_substation, 'Neon Power Substation'),
    (prop_cyber_bike, 'Neon Street Speeder Bike'),
    (prop_cargo_loader, 'Industrial Cargo Loader'),
    (prop_arcade_cabinet, 'Neon Street Arcade Cabinet'),
    (prop_cable_spool, 'Heavy Power Cable Spool'),
    (prop_antenna_array, 'Relay Antenna Array'),
    (prop_pipe_cluster, 'Coolant Pipe Manifold'),
    (prop_traffic_pylon, 'Holo Hazard Pylon'),
]

CYBERPUNK_LEVEL_ANIMATED = [
    (prop_holo_billboard, _billboard_clips, 'Animated Holo Sky-Billboard'),
    (prop_hover_car, _hover_car_clips, 'Spinner Hover Car'),
    (prop_neon_vending_booth, _neon_vending_clips, 'Cyber Drink Vending Kiosk'),
]
