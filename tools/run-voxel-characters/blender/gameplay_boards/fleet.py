"""Original period vehicle silhouettes and animation pivots for Estuary Front."""

from dataclasses import dataclass

import level_vehicles as v
from creature_kit import Sculpt
from level_geometry import box, span

ROLL_TIMES = (0, 0.25, 0.5, 0.75, 1)
ROLL = (0, 90, 180, 270, 360)
MOVE_TIMES = (0, 0.6, 1.2, 1.8, 2.4)
STEER = (0, 22, 0, -22, 0)


def open_transport(width, length, role):
    body, trim = v.road_body(width, length, cabin=(5, 14), roof=16)
    trim.ops = [op for op in trim.ops if not op[4]]
    if role in ('recon', 'amphibious'):
        body.cut(span(width + 4), (14, 17), span(length))
        box(width - 4, 1, 6, v.GLASS, y=14, z=10, sculpt=body)
        for x in (-width // 2 + 2, width // 2 - 2):
            box(3, 5, 14, v.PAINT, x=x, y=8, z=-6, sculpt=body)
        for z in (-9, 3):
            box(width - 7, 3, 5, v.WOOD, y=8, z=z, sculpt=body)
    elif role == 'command':
        box(width - 4, 6, 17, v.GLASS, y=11, z=-3, sculpt=body)
        box(width - 6, 2, 17, v.PAINT, y=17, z=-2, sculpt=body)
        box(width - 6, 3, 8, v.PAINT, y=10, z=-14, sculpt=body)
        for x in (-width // 2 + 2, width // 2 - 3):
            box(1, 6, 2, v.FRAME, x=x, y=11, z=-4, sculpt=body)
        for z in (-length // 2 + 1, length // 2):
            box(width + 1, 2, 2, v.METAL, y=6, z=z, sculpt=trim)
    else:
        cargo_length = length // 2 - 2
        for x in (-width // 2 + 1, width // 2 - 1):
            box(2, 8, cargo_length, v.WOOD, x=x, y=9, z=-length // 4, sculpt=body)
        if role in ('medical', 'cargo'):
            rear = -length // 4
            box(width - 2, 11, cargo_length, v.PAINT, y=10, z=rear, sculpt=body)
            box(width - 7, 2, cargo_length - 1, v.PAINT_DARK, y=21, z=rear, sculpt=body)
            if role == 'medical':
                for x in (-width // 2, width // 2 - 1):
                    box(1, 3, 9, v.STRIPE, x=x, y=15, z=rear, sculpt=body)
                    box(1, 9, 3, v.STRIPE, x=x, y=12, z=rear, sculpt=body)
    for x in (-width // 2 + 1, width // 2 - 1):
        box(4, 1, 9, v.METAL, x=x, y=7, z=length // 2 - 3, sculpt=trim)
    if role == 'amphibious':
        box(width, 3, length + 4, v.PAINT, y=3, sculpt=body)
        box(width - 5, 3, 2, v.PAINT, y=6, z=length // 2 + 2, sculpt=body)
    return v.wheeled(body, width // 2 - 1, -length // 3, length // 3, 4, trim=trim)


def tracked(width, length, height, role):
    body = box(width - 8, 7, length - 4, v.FRAME, y=3)
    box(width, height - 6, length, v.PAINT, y=6, sculpt=body)
    box(width - 8, 3, length - 8, v.PAINT_DARK, y=height - 2, sculpt=body)
    for x in (-width // 2 + 3, width // 2 - 3):
        box(5, 2, length + 2, v.PAINT_DARK, x=x, y=7, sculpt=body)
        box(2, 1, 8, v.WOOD, x=x, y=height - 2, z=-length // 3, sculpt=body)
        box(3, 2, 2, v.LAMP, x=x, y=height - 4, z=length // 2 - 1, sculpt=body)
    for z in range(-length // 2 + 5, -length // 3 + 5, 2):
        box(width - 12, 1, 1, v.METAL, y=height + 1, z=z, sculpt=body)
    rig = v.Vehicle(body)
    drive = []
    for side, x in (('left', -width // 2 + 1), ('right', width // 2 - 1)):
        tread = Sculpt()
        for z in range(-length // 2 + 1, length // 2, 2):
            inset = 2 if abs(z) >= length // 2 - 3 else 0
            box(5, 1, 2, v.TIRE, x=x, y=inset, z=z, sculpt=tread)
            box(5, 1, 2, v.TIRE, x=x, y=7 - inset, z=z, sculpt=tread)
            box(5, 1, 1, v.METAL, x=x, y=inset, z=z, sculpt=tread)
        for z in (-length // 2 + 2, length // 2 - 2):
            box(5, 5, 3, v.TIRE, x=x, y=2, z=z, sculpt=tread)
        rig.parts.append(v.Part(f'{side}_track', (x, 4, 0), tread))
        for index, z in enumerate(range(-length // 2 + 4, length // 2 - 1, 7)):
            pivot = (x, 4, z)
            name = f'{side}_roadwheel_{index + 1:02}_spin'
            rig.parts.append(v.Part(name, pivot, v.parked_wheel(pivot, 3, wagon=False, bevel=True, hub=True)))
            drive.append(v.angle_track(name, 0, ROLL_TIMES, ROLL))
    rig.clips['Drive'] = drive
    if role == 'engineering':
        blade = box(width + 8, 11, 3, v.METAL, y=2, z=length // 2 + 5)
        box(width + 8, 2, 4, v.FRAME, y=2, z=length // 2 + 5, sculpt=blade)
        for x in (-width // 2, width // 2):
            box(2, 2, 12, v.METAL, x=x, y=5, z=length // 2, sculpt=blade)
        rig.parts.append(v.Part('blade_lift', (0, 6, length // 2 - 5), blade))
        rig.clips['Raise blade'] = [v.angle_track('blade_lift', 0, MOVE_TIMES, (0, -18, -25, -18, 0))]
        return rig
    turret_width = width - (8 if role == 'heavy' else 12)
    turret = box(turret_width, 6, max(12, length // 2), v.PAINT_DARK, y=height)
    box(turret_width - 4, 4, max(10, length // 2 - 4), v.PAINT, y=height + 6, sculpt=turret)
    box(7, 2, 7, v.METAL, x=-3, y=height + 9, z=-2, sculpt=turret)
    rig.parts.append(v.Part('turret_yaw', (0, height, 0), turret))
    length_barrel = (length // 2 + 4) if role in ('heavy', 'destroyer') else length // 3
    trunnion = max(6, length // 4 - 1)
    tube = box(4, 4, length_barrel, v.METAL, y=height + 3, z=trunnion + length_barrel // 2)
    box(7, 6, 5, v.PAINT, y=height + 2, z=trunnion, sculpt=tube)
    box(6, 5, 5, v.FRAME, y=height + 2, z=trunnion + length_barrel - 3, sculpt=tube)
    rig.parts.append(v.Part('barrel_pitch', (0, height + 5, trunnion), tube, 'turret_yaw'))
    rig.clips['Turret traverse'] = [v.angle_track('turret_yaw', 1, MOVE_TIMES, STEER)]
    rig.clips['Barrel elevation'] = [v.angle_track('barrel_pitch', 0, MOVE_TIMES, (0, -13, 0, 6, 0))]
    return rig


def half_track():
    rig = open_transport(25, 57, 'carrier')
    rig.parts = [part for part in rig.parts if not part.name.startswith('rear_')]
    rig.clips['Drive'] = [track for track in rig.clips['Drive'] if not track.part.startswith('rear_')]
    for side, x in (('left', 11), ('right', -11)):
        tread = Sculpt()
        for y in (0, 7):
            box(5, 1, 24, v.TIRE, x=x, y=y, z=-15, sculpt=tread)
        for z in (-26, -4):
            box(5, 6, 3, v.TIRE, x=x, y=1, z=z, sculpt=tread)
        rig.parts.append(v.Part(f'{side}_track', (x, 4, -16), tread))
        for index, z in enumerate((-23, -16, -9)):
            pivot = (x, 4, z)
            name = f'{side}_roadwheel_{index + 1:02}_spin'
            rig.parts.append(v.Part(name, pivot, v.parked_wheel(pivot, 3, wagon=False, bevel=True, hub=True)))
            rig.clips['Drive'].append(v.angle_track(name, 0, ROLL_TIMES, ROLL))
    return rig


def aircraft(span_width, length, role):
    body = Sculpt()
    engines = (-19, 19) if role in ('transport', 'bomber') else (0,)
    cabin_width = {'fighter': 10, 'transport': 16, 'bomber': 13}[role]
    for z in range(-length // 2, length // 2, 3):
        tail = max(0, -z - length // 10)
        nose = max(0, z - length // 4)
        width = max(3, cabin_width - tail // 3 - nose // 4)
        keel = 10 + min(5, tail // 6)
        box(width - 2, 2, 3, v.PAINT_DARK, y=keel, z=z, sculpt=body)
        box(width, max(3, width - 4), 3, v.PAINT, y=keel + 2, z=z, sculpt=body)
        box(max(2, width - 4), 2, 3, v.PAINT, y=keel + max(3, width - 4) + 2, z=z, sculpt=body)
    for side in (-1, 1):
        for index in range(span_width // 8):
            x = side * (index * 4 + 2)
            depth = max(5, length // 3 - index * 4 // 3)
            z = 4 - index * 2 // 3
            y = 13 + index // 6
            box(4, 2, depth, v.PAINT, x=x, y=y, z=z, sculpt=body)
            if index < span_width // 11:
                box(4, 1, depth - 5, v.PAINT, x=x, y=y + 2, z=z + 1, sculpt=body)
            if index in (span_width // 10, span_width // 10 + 2):
                body.paint((x - 1, x + 1), (y + 1, y + 2), (z - depth // 2, z + depth // 2), v.STRIPE)
        for i in range(5):
            box(4, 2, 13 - i * 2, v.PAINT, x=side * (i * 3 + 2), y=17,
                z=-length // 2 + 9 - i, sculpt=body)
    fin_x = (-12, 12) if role == 'bomber' else (0,)
    for x in fin_x:
        for y in range(17, 30):
            box(2, 1, max(4, 17 - (y - 17)), v.PAINT, x=x, y=y,
                z=-length // 2 + 7 - (y - 17) // 3, sculpt=body)
    if role == 'fighter':
        for z in (-18, -15):
            body.paint(span(cabin_width), (13, 23), (z, z + 1), v.STRIPE)
    canopy_z = length // 2 - 18 if role in ('transport', 'bomber') else 5
    roof_y = 14 + cabin_width - 3
    for dz, width, height in ((-6, 6, 3), (-3, 9, 5), (0, 10, 6), (3, 10, 6), (6, 8, 4)):
        box(width, height, 3, v.GLASS, y=roof_y - 2, z=canopy_z + dz, sculpt=body)
    for dz in (-3, 4):
        box(10, 1, 1, v.PAINT, y=roof_y + 3, z=canopy_z + dz, sculpt=body)
    if role == 'transport':
        for z in range(-15, 17, 8):
            for x in (-8, 7):
                box(1, 3, 3, v.GLASS, x=x, y=19, z=z, sculpt=body)
    rig = v.Vehicle(body)
    props = []
    gear = []
    for index, x in enumerate(engines):
        z = length // 2 - 2 if x == 0 else 15
        box(8, 8, 19, v.PAINT, x=x, y=11, z=z - 11, sculpt=body)
        cowl = v.STRIPE if role == 'fighter' else v.PAINT_DARK
        box(9, 6, 5, cowl, x=x, y=12, z=z - 3, sculpt=body)
        box(5, 2, 13, v.PAINT, x=x, y=19, z=z - 8, sculpt=body)
        rotor = Sculpt()
        for sign in (-1, 1):
            for step in range(4):
                box(3, 4, 2, v.FRAME if step < 3 else v.STRIPE, x=x + sign * (1 + step),
                    y=14 + sign * (1 + step * 2), z=z, sculpt=rotor)
        box(5, 5, 5, v.METAL, x=x, y=12, z=z, sculpt=rotor)
        name = f'propeller_{index + 1}_spin'
        rig.parts.append(v.Part(name, (x, 15, z), rotor))
        props.append(v.angle_track(name, 2, ROLL_TIMES, ROLL))
    for index, (x, z) in enumerate(((-11, 4), (11, 4), (0, -length // 2 + 7))):
        leg = box(2, 12, 2, v.METAL, x=x, y=2, z=z)
        leg.ops.extend(v.parked_wheel((x, 3, z), 3, wagon=False, bevel=True, hub=True).ops)
        name = f'gear_{index + 1}_hinge'
        rig.parts.append(v.Part(name, (x, 13, z), leg))
        gear.append(v.angle_track(name, 0, MOVE_TIMES, (0, -55, -80, -55, 0)))
    ailerons = []
    for side, name in ((-1, 'left_aileron'), (1, 'right_aileron')):
        x, z = side * (span_width // 2 - 16), -length // 6
        part = box(20, 2, 5, v.PAINT_DARK, x=x, y=13, z=z)
        rig.parts.append(v.Part(name, (x, 14, z + 2), part))
        ailerons.append(v.angle_track(name, 0, MOVE_TIMES, tuple(n * side for n in STEER)))
    rig.clips.update({'Propellers': props, 'Cycle landing gear': gear, 'Roll control': ailerons})
    return rig


def vessel(width, length, role):
    hull = Sculpt()
    for z in range(-length // 2, length // 2, 3):
        bow = max(0, z - length // 4)
        hull_width = max(7, width - bow)
        box(max(5, hull_width - 7), 4, 4, v.PAINT_DARK, z=z, sculpt=hull)
        box(hull_width, 3, 4, v.PAINT, y=4, z=z, sculpt=hull)
        for x in (-hull_width // 2 + 1, hull_width // 2 - 1):
            box(2, 4, 4, v.FRAME, x=x, y=7, z=z, sculpt=hull)
    for z in range(-length // 2 + 9, length // 4, 5):
        box(width - 4, 1, 4, v.WOOD, y=7, z=z, sculpt=hull)
    cabin_z = -length // 4
    if role == 'landing':
        for side in (-1, 1):
            box(4, 7, 22, v.PAINT_DARK, x=side * (width // 2 - 4), y=8, z=-1, sculpt=hull)
        cabin_width, cabin_height = 13, 8
    elif role == 'patrol':
        cabin_width, cabin_height = width - 8, 13
        for x in (-width // 2 + 3, width // 2 - 3):
            for z in (-16, -6, 5):
                box(1, 5, 1, v.METAL, x=x, y=10, z=z, sculpt=hull)
            box(1, 1, 24, v.METAL, x=x, y=15, z=-6, sculpt=hull)
    else:
        cabin_width, cabin_height = width - 11, 8
        for x in (-9, 8):
            box(14, 8, 10, v.WOOD, x=x, y=8, z=-5, sculpt=hull)
            box(11, 2, 10, v.PAINT_DARK, x=x, y=16, z=-5, sculpt=hull)
            for dx in (-4, 4):
                box(2, 1, 10, v.METAL, x=x + dx, y=18, z=-5, sculpt=hull)
        box(6, 14, 6, v.FRAME, x=8, y=16, z=cabin_z - 2, sculpt=hull)
        box(6, 2, 6, v.STRIPE, x=8, y=26, z=cabin_z - 2, sculpt=hull)
    box(cabin_width, cabin_height, 15, v.PAINT, y=8, z=cabin_z, sculpt=hull)
    box(cabin_width - 3, 3, 2, v.GLASS, y=cabin_height + 5, z=cabin_z + 7, sculpt=hull)
    box(cabin_width + 3, 2, 16, v.PAINT_DARK, y=8 + cabin_height, z=cabin_z, sculpt=hull)
    if role == 'patrol':
        box(2, 13, 2, v.METAL, y=10 + cabin_height, z=cabin_z, sculpt=hull)
        box(12, 1, 1, v.METAL, y=18 + cabin_height, z=cabin_z, sculpt=hull)
    rudder_z = -length // 2
    rudder = box(2, 6, 6, v.METAL, y=1, z=rudder_z)
    rig = v.Vehicle(hull, [v.Part('rudder_yaw', (0, 4, rudder_z + 2), rudder)])
    rig.clips['Rudder'] = [v.angle_track('rudder_yaw', 1, MOVE_TIMES, STEER)]
    if role == 'landing':
        ramp_z = length // 2 - 1
        ramp = box(width - 6, 10, 3, v.METAL, y=4, z=ramp_z)
        for x in range(-width // 2 + 5, width // 2 - 3, 4):
            box(2, 10, 1, v.FRAME, x=x, y=4, z=ramp_z + 1, sculpt=ramp)
        rig.parts.append(v.Part('bow_ramp', (0, 4, ramp_z), ramp))
        rig.clips['Lower ramp'] = [v.angle_track('bow_ramp', 0, MOVE_TIMES, (0, 65, 90, 65, 0))]
    elif role == 'patrol':
        gun_z = length // 5
        stand = box(10, 6, 10, v.PAINT_DARK, y=7, z=gun_z)
        box(3, 3, 19, v.METAL, y=12, z=gun_z + 5, sculpt=stand)
        rig.parts.append(v.Part('deck_mount_yaw', (0, 7, gun_z), stand))
        rig.clips['Deck traverse'] = [v.angle_track('deck_mount_yaw', 1, MOVE_TIMES, STEER)]
    else:
        hatch = box(width - 9, 2, 13, v.WOOD, y=9, z=8)
        rig.parts.append(v.Part('cargo_hatch', (0, 9, 2), hatch))
        rig.clips['Open cargo hatch'] = [v.angle_track('cargo_hatch', 0, MOVE_TIMES, (0, -55, -80, -55, 0))]
    return rig


def rail_engine():
    body = box(27, 3, 66, v.FRAME, y=4)
    for y, width in enumerate((9, 13, 17, 19, 21, 22, 22, 22, 21, 19, 17, 13, 9)):
        box(width, 1, 39, v.PAINT_DARK, y=y + 11, z=8, sculpt=body)
        for z in (-4, 11, 25):
            box(width + 1, 1, 2, v.METAL, y=y + 11, z=z, sculpt=body)
    for x in (-12, 12):
        box(3, 2, 48, v.METAL, x=x, y=9, z=5, sculpt=body)
        box(2, 3, 32, v.FRAME, x=x, y=6, z=-2, sculpt=body)
        for z in (-14, 2, 17):
            box(3, 2, 2, v.METAL, x=x, y=6, z=z, sculpt=body)
    box(26, 3, 5, v.STRIPE, y=5, z=31, sculpt=body)
    for x in (-8, 8):
        box(5, 4, 4, v.FRAME, x=x, y=5, z=33, sculpt=body)
    box(7, 4, 8, v.METAL, y=24, z=1, sculpt=body)
    box(25, 24, 19, v.PAINT, y=7, z=-16, sculpt=body)
    box(28, 2, 22, v.FRAME, y=31, z=-16, sculpt=body)
    for x in (-13, 12):
        box(1, 10, 10, v.GLASS, x=x, y=19, z=-15, sculpt=body)
    box(6, 11, 6, v.FRAME, y=23, z=18, sculpt=body)
    box(10, 2, 10, v.METAL, y=33, z=18, sculpt=body)
    box(6, 6, 4, v.FRAME, y=23, z=25, sculpt=body)
    box(3, 3, 1, v.LAMP, y=25, z=27, sculpt=body)
    rig = v.Vehicle(body, radius=0.5)
    drive = []
    for side, x in (('left', -10), ('right', 10)):
        for index, z in enumerate((-22, -10, 3, 17)):
            pivot = (x, 5, z)
            name = f'{side}_railwheel_{index + 1:02}_spin'
            rig.parts.append(v.Part(name, pivot, v.parked_wheel(pivot, 5, wagon=False, bevel=True, hub=True)))
            drive.append(v.angle_track(name, 0, ROLL_TIMES, ROLL))
    rig.clips['Drive'] = drive
    return rig


@dataclass(frozen=True)
class FleetEntry:
    label: str
    role: str
    build: object
    position: tuple
    paint: str


def roster():
    return (
        FleetEntry('Scout jeep', 'recon', lambda: open_transport(19, 34, 'recon'), (-29, 21, 1, 0), '#5f6850'),
        FleetEntry('Staff car', 'command', lambda: open_transport(20, 41, 'command'), (-22, 25, 1, 0), '#454940'),
        FleetEntry('Canvas cargo truck', 'cargo', lambda: open_transport(25, 55, 'cargo'), (-21, 10.4, 1, 0), '#747756'),
        FleetEntry('Field ambulance', 'medical', lambda: open_transport(24, 48, 'medical'), (-29, 6, 0, 0), '#b1ae93'),
        FleetEntry('Amphibious transport', 'amphibious', lambda: open_transport(26, 58, 'amphibious'), (26, 20, 2, 0), '#6d735a'),
        FleetEntry('Half track carrier', 'carrier', half_track, (-6, 4, 1, 0), '#6b7056'),
        FleetEntry('Light reconnaissance tank', 'light', lambda: tracked(24, 40, 15, 'light'), (-2, 11, 1, 0), '#71745a'),
        FleetEntry('Medium tank', 'medium', lambda: tracked(29, 47, 16, 'medium'), (1.6, 13.5, 1, 0), '#4d5d49'),
        FleetEntry('Heavy breakthrough tank', 'heavy', lambda: tracked(35, 55, 18, 'heavy'), (4, 21, 1, 0), '#827c59'),
        FleetEntry('Low tank destroyer', 'destroyer', lambda: tracked(30, 52, 12, 'destroyer'), (-5, 24, 1, 0), '#6f6453'),
        FleetEntry('Armored recovery tractor', 'engineering', lambda: tracked(27, 43, 15, 'engineering'), (3, 5, 1, 0), '#8b7b55'),
        FleetEntry('Rail depot locomotive', 'rail', rail_engine, (-21, -10, 1, 0.32), '#514b44'),
        FleetEntry('Single engine fighter', 'fighter', lambda: aircraft(98, 74, 'fighter'), (0, -20, 0, 0), '#687865'),
        FleetEntry('Twin engine transport', 'transport', lambda: aircraft(127, 89, 'transport'), (16, -23, 0, 0), '#7d8266'),
        FleetEntry('Twin engine bomber', 'bomber', lambda: aircraft(137, 97, 'bomber'), (30, -24, 0, 0), '#888e80'),
        FleetEntry('Infantry landing craft', 'landing', lambda: vessel(34, 69, 'landing'), (40, 12.2, 3, -0.5), '#7e8986'),
        FleetEntry('Coastal patrol launch', 'patrol', lambda: vessel(31, 83, 'patrol'), (44, 1, 2, -0.5), '#6a7881'),
        FleetEntry('Harbor supply barge', 'barge', lambda: vessel(41, 90, 'barge'), (42, -11, 2, -0.5), '#6b7169'),
    )
