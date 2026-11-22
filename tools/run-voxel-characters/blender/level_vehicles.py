"""Export rigid Cubix vehicle parts with named pivots and glTF clips."""

import math
from dataclasses import dataclass, field

import voxchar as vk
from creature_kit import Sculpt
from level_geometry import CELL, box, span

PAINT = vk.vox('primary', 0)
PAINT_DARK = vk.vox('primary', -0.48)
FRAME = vk.vox('secondary', -0.28)
METAL = vk.vox('metal', 0, mottle=False)
TIRE = vk.vox('hair', 0, mottle=False)
WOOD = vk.vox('leather', 0)
GLASS = vk.vox('visor', -0.45, mottle=False)
GLASS_EDGE = vk.vox('visor', 0.22, mottle=False)
PARKED_GLASS = vk.vox('secondary', 0.20, mottle=False)
LAMP = vk.vox('trim', 0.45, mottle=False)
TAIL = vk.vox('detail', 0.35, mottle=False)
STRIPE = vk.vox('accent', 0.1, mottle=False)
WHEEL_CELL = CELL / 2
TREAD_EDGE = vk.vox('hair', 0.38, mottle=False)
RIM = vk.vox('metal', -0.25, mottle=False)
VAN_PANEL = vk.vox('trim', -0.16)
ROLL_CLIP = 'Roll and brake'
ROLL_PIVOT = 'vehicle_travel'


@dataclass
class Part:
    name: str
    pivot: tuple
    shape: Sculpt
    parent: str = 'vehicle_root'
    parked: Sculpt | None = None
    cell: float = CELL


@dataclass
class Track:
    part: str
    path: str
    times: tuple
    values: tuple


@dataclass
class Vehicle:
    chassis: Sculpt
    parts: list[Part] = field(default_factory=list)
    clips: dict[str, list[Track]] = field(default_factory=dict)
    radius: float = 0
    trim: Sculpt | None = None

    def rest(self):
        shape = Sculpt()
        ops = list(self.chassis.ops)
        for part in self.parts:
            ops.extend((part.parked or part.shape).ops)
        shape.ops.extend(
            (x, y, z, PARKED_GLASS if color in (GLASS, GLASS_EDGE) else color, filled)
            for x, y, z, color, filled in ops
        )
        return shape

    def detailed_chassis(self):
        shape = Sculpt()
        shape.ops.extend(self.chassis.ops)
        if self.trim is not None:
            shape.ops.extend(self.trim.ops)
        return shape


def angle_track(part, axis, times, degrees):
    values = []
    for degree in degrees:
        angle = math.radians(degree) / 2
        vector = [0, 0, 0]
        vector[axis] = math.sin(angle)
        values.append((*vector, math.cos(angle)))
    return Track(part, 'rotation', times, tuple(values))


def offset_track(part, axis, times, offsets):
    values = []
    for offset in offsets:
        vector = [0, 0, 0]
        vector[axis] = offset
        values.append(tuple(vector))
    return Track(part, 'translation', times, tuple(values))


def parked_wheel(pivot, radius, *, wagon, bevel, hub):
    x, y, z = pivot
    tread = WOOD if wagon else TIRE
    shape = box(3, radius * 2, radius * 2 - (2 if bevel else 0), tread, x=x, y=y-radius, z=z)
    if bevel:
        box(3, radius * 2-2, radius * 2, tread, x=x, y=y-radius+1, z=z, sculpt=shape)
    if hub:
        outside = x + (1 if x > 0 else -1)
        shape.box(outside, (y - 1, y), (z - 1, z), METAL)
    return shape


def disc(shape, x, y, z, radius, color):
    for row in range(-radius, radius):
        edge = max(abs(row), abs(row+1))
        reach = min(radius, int(math.sqrt((radius + 0.55)**2 - edge**2)))
        shape.box(x, y+row, (z-reach, z+reach-1), color)


def wheel(pivot, radius, *, wagon):
    x, y, z = (axis * 2 for axis in pivot)
    radius *= 2
    shape = Sculpt()
    width = span(4 if wagon else 6, x)
    if wagon:
        disc(shape, width, y, z, radius, TREAD_EDGE)
        disc(shape, width, y, z, radius-1, WOOD)
        disc(shape, width, y, z, radius-2, 0)
        for direction in range(6):
            angle = direction * math.pi / 3
            for reach in range(radius-2):
                dy, dz = round(math.sin(angle)*reach), round(math.cos(angle)*reach)
                shape.box(width, (y+dy-1, y+dy), (z+dz-1, z+dz), WOOD)
        disc(shape, width, y, z, 3, RIM)
        disc(shape, width, y, z, 1, METAL)
        return shape
    disc(shape, width, y, z, radius, TIRE)
    outward = width[1] if x > 0 else width[0]
    disc(shape, outward, y, z, radius-1, TREAD_EDGE)
    disc(shape, outward, y, z, radius-2, TIRE)
    disc(shape, outward, y, z, max(2, radius-4), RIM)
    disc(shape, outward, y, z, 2, METAL)
    shape.box(outward, y+radius-3, z-1, METAL)
    return shape


def wheeled(chassis, track, rear, front, radius, *, steer_rear=False, wagon=False,
            trim=None, parked_bevel=True, parked_hubs=True):
    for z in (rear, front):
        clearance = 1 if wagon and z == front else 0
        for x in (-track, track):
            chassis.cut(
                (x - 3 - clearance, x + 2 + clearance), (0, radius * 2),
                (z - radius - 2 - clearance, z + radius + 1 + clearance),
            )
    if trim is None:
        trim = Sculpt()
    for z in (rear, front):
        if wagon and z == front:
            continue
        box(2*track-6, 2, 2, RIM, y=radius-1, z=z, sculpt=trim)
    rig = Vehicle(chassis, radius=radius * CELL, trim=trim)
    drive = []
    steer = []
    if wagon:
        pivot = (0, radius, front)
        beam = box(2*track, 2, 2, WOOD, y=radius-1, z=front)
        rig.parts.append(Part('front_axle_yaw', pivot, beam))
        steer.append(angle_track('front_axle_yaw', 1, (0, 0.65, 1.3, 1.95, 2.6), (0, 22, 0, -22, 0)))
    for axle, z in (('front', front), ('rear', rear)):
        for side, x in (('left', track), ('right', -track)):
            pivot = (x, radius, z)
            name = f'{axle}_{side}'
            parent = 'vehicle_root'
            if wagon and axle == 'front':
                parent = 'front_axle_yaw'
            if not wagon and (axle == 'rear') == steer_rear:
                parent = f'{name}_steer'
                rig.parts.append(Part(parent, pivot, Sculpt()))
                steer.append(angle_track(parent, 1, (0, 0.6, 1.2, 1.8, 2.4), (0, 27, 0, -27, 0)))
            spin = f'{name}_spin'
            parked = parked_wheel(pivot, radius, wagon=wagon, bevel=parked_bevel,
                                  hub=parked_hubs and not wagon)
            rig.parts.append(Part(spin, pivot, wheel(pivot, radius, wagon=wagon), parent, parked, WHEEL_CELL))
            drive.append(angle_track(spin, 0, (0, 0.25, 0.5, 0.75, 1), (0, 90, 180, 270, 360)))
    rig.clips.update(Drive=drive, Steer=steer)
    return rig


def road_body(width, length, *, cabin, roof, paint=PAINT):
    shape = box(width-6, 4, length-6, FRAME, y=2)
    trim = Sculpt()
    rear, front = span(length)
    seam = PAINT_DARK if paint != PAINT_DARK else PAINT
    box(width-2, 2, 7, seam, y=4, sculpt=trim)
    start, depth = cabin
    cab_width = width-3
    cab_rear, cab_front = span(depth, start)
    box(width, 4, length-4, paint, y=6, sculpt=shape)
    for z in (rear, front):
        center = rear+1 if z == rear else front
        box(width-2, 3, 2, paint, y=6, z=center, sculpt=shape)
        box(width-1, 1, 2, FRAME, y=6, z=center, sculpt=trim)
        for x in (-width//2+3, width//2-3):
            box(3, 1, 1, LAMP if z > 0 else TAIL, x=x, y=8, z=z, sculpt=trim)
        box(6, 2, 1, FRAME, y=7, z=z, sculpt=trim)
    trim.paint(span(width), 7, (front-2, front), METAL)
    shape.box(span(width-2), 10, (cab_front-2, front-3), paint)
    trim.paint(span(width-4), 10, front-3, seam)

    # The sill stays wide. The windshield steps inward under the roof.
    for y in range(10, roof):
        rise = y - 10
        side_inset = int(rise >= 3)
        left, right = span(cab_width - 2 * side_inset)
        back = cab_rear + min(rise // 2, 2)
        windscreen = cab_front - min(rise, 4)
        shape.box((left, right), y, (back, windscreen), GLASS)
        for x in (left, right):
            trim.paint(x, y, back, paint)
            trim.paint(x, y, windscreen, paint)
            trim.paint(x, y, start-1, FRAME)
        highlight = (left+1, right-1) if y == roof-1 else (left+2, left+4)
        trim.paint(highlight, y, windscreen, GLASS_EDGE)
    shape.box(span(cab_width-2), roof, (back, windscreen), paint)
    for x in span(width):
        box(2, 1, 2, FRAME, x=x, y=11, z=cab_front-3, sculpt=trim)
    trim.paint(span(width-8), 8, front, FRAME)
    trim.paint(span(4), 7, rear, METAL)
    for x in span(width):
        trim.paint(x, (7, 9), start-2, seam)
        trim.paint(x, 9, (start-4, start-3), METAL)
    trim.paint(span(width), 6, (rear+2, front-2), seam)
    return shape, trim


def pickup(*, ranger=False):
    body, trim = road_body(20 if ranger else 19, 37, cabin=(4, 13), roof=16)
    # Two front wings frame a recessed radiator and a raised engine cover.
    box(10, 1, 9, PAINT, y=11, z=12, sculpt=trim if ranger else body)
    trim.box((-5, 4), (7, 9), 18, FRAME)
    trim.box((-4, 3), 8, 18, METAL)
    for side in (-1, 1):
        center = side * 7
        trim.box((center-2, center+2), 8, 18, FRAME)
        box(4, 2, 3, METAL, x=center, y=9, z=16, sculpt=trim)
        box(3, 1, 1, LAMP, x=center, y=10, z=17, sculpt=trim)
    box(17, 1, 16, PAINT_DARK, y=10, z=-10, sculpt=body)
    for x in (-9, 8):
        box(1, 3, 14, PAINT, x=x, y=11, z=-10, sculpt=body)
        trim.paint(x, 12, (-16, -4), PAINT_DARK)
    tailgate = box(16, 3, 1, PAINT, y=11, z=-17)
    tailgate.paint((-2, 1), 13, -17, FRAME)
    for x in (-6, -3, 0, 3, 6):
        trim.paint(x, 10, (-16, -5), FRAME)
    if ranger:
        box(13, 1, 9, METAL, y=17, z=4, sculpt=body)
        for x in (-6, 6):
            box(1, 2, 10, FRAME, x=x, y=17, z=4, sculpt=trim)
        # The rear gantry carries a pair of long rescue ladders.
        for side in (-6, 6):
            box(2, 6, 2, FRAME, x=side, y=12, z=-13, sculpt=trim)
            box(1, 2, 30, METAL, x=side, y=19, z=-3, sculpt=trim)
        box(15, 1, 2, FRAME, y=18, z=-13, sculpt=trim)
        for z in range(-16, 11, 4):
            box(12, 1, 1, STRIPE, y=19, z=z, sculpt=trim)
        box(7, 3, 6, WOOD, y=10, z=-10, sculpt=body)
        box(2, 8, 2, FRAME, x=9, y=10, z=10, sculpt=trim)
        box(13, 2, 2, FRAME, y=18, z=7, sculpt=trim)
        box(3, 2, 3, LAMP, x=4, y=18, z=7, sculpt=trim)
        box(3, 2, 3, STRIPE, x=-4, y=18, z=7, sculpt=body)
        trim.paint(-10, (7, 8), (-4, 5), STRIPE)
    else:
        box(13, 3, 4, METAL, y=10, z=-5, sculpt=body)
        trim.paint(span(11), 12, -7, FRAME)
        # Door seals, handles, and front pillar mirrors.
        for side in (-1, 1):
            sill = 7 if side > 0 else -8
            trim.paint(sill, (11, 13), 0, FRAME)
            trim.paint(sill - side, (13, 15), 1, FRAME)
            trim.paint(9 if side > 0 else -9, 9, (0, 2), FRAME)
            trim.box((sill, sill + 2) if side > 0 else (sill - 2, sill), 12, 6, FRAME)
            trim.box(sill + 2 * side, (12, 13), 5, METAL)
        trim.paint((-5, 4), 11, (11, 14), PAINT_DARK)
    rig = wheeled(body, 9 if ranger else 8, -11, 11, 4, trim=trim, parked_bevel=False)
    rig.parts.append(Part('tailgate', (0, 11, -17), tailgate))
    rig.clips['Lower Tailgate'] = [
        angle_track('tailgate', 0, (0, 0.8, 1.6, 2.4), (0, -90, -90, 0)),
    ]
    if not ranger:
        times = (0, .2, .4, .6, .8, 1, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3, 3.3, 3.65, 4)
        travel = (0, .025, .16, .45, .75, .95, 1.02, 1.05, 1.05, 1.04, .94, .68, .33, .095, .012, 0)
        rotation = tuple(math.degrees(distance / rig.radius) for distance in travel)
        rig.clips[ROLL_CLIP] = [
            offset_track(ROLL_PIVOT, 2, times, travel),
            *(angle_track(part.name, 0, times, rotation) for part in rig.parts if part.name.endswith('_spin')),
        ]
    return rig


def hatchback():
    # A low wedge and a long rear window give the car its fastback profile.
    body = box(14, 3, 30, FRAME, y=3)
    body.box((-8, 8), (6, 8), (-15, 13), PAINT)
    body.box((-7, 7), (6, 7), (14, 16), PAINT)
    body.box((-7, 7), 9, (-14, 8), PAINT)
    trim = Sculpt()
    for y, back, front in ((10,-13,8), (11,-12,7), (12,-10,6), (13,-8,5), (14,-6,4)):
        body.box((-7, 7), y, (back, front), GLASS)
        for x in (-7, 7):
            trim.box(x, y, (back, back+1), PAINT)
            trim.paint(x, y, -2, FRAME)
            trim.paint(x, y, front, PAINT)
        trim.paint((-5, -3), y, front, GLASS_EDGE)
    body.box((-7, 7), 15, (-6, 4), PAINT)
    box(15, 1, 2, FRAME, y=11, z=-14, sculpt=trim)
    trim.box((-5, 5), 6, 16, FRAME)
    for x in (-6, 6):
        box(4, 1, 2, LAMP, x=x, y=8, z=14, sculpt=trim)
        box(4, 1, 1, TAIL, x=x, y=8, z=-15, sculpt=trim)
        trim.box(x, 10, -14, TAIL)
        trim.box(x, 8, (9, 13), PAINT_DARK)
    for x in (-8, 8):
        trim.paint(x, 7, (-14, 12), VAN_PANEL)
        trim.paint(x, 8, (-4, -3), FRAME)
    return wheeled(body, 7, -10, 10, 3, trim=trim)


def panel_van():
    # The walk-through delivery cab sits ahead of the cargo floor.
    body = box(15, 4, 34, FRAME, y=3)
    body.box((-9, 9), (7, 11), (-18, 17), PAINT_DARK)
    body.box((-9, 9), (12, 22), (-18, 3), VAN_PANEL)
    body.box((-8, 8), 23, (-18, 3), VAN_PANEL)
    body.box((-8, 8), (12, 15), (4, 17), PAINT)
    body.box((-8, 8), (16, 18), (4, 16), GLASS)
    body.box((-8, 8), (19, 20), (4, 15), GLASS)
    body.box((-8, 8), 21, (4, 15), VAN_PANEL)
    trim = Sculpt()
    for x in (-8, 8):
        trim.box(x, (16, 20), (4, 5), PAINT)
        trim.box(x, (16, 18), 16, PAINT)
        trim.box(x, (19, 20), 15, PAINT)
        box(2, 2, 2, FRAME, x=x, y=16, z=15, sculpt=trim)
    trim.paint((-6, -4), (16, 18), 16, GLASS_EDGE)
    trim.paint((-6, -4), (19, 20), 15, GLASS_EDGE)
    trim.box((-5, 5), (10, 12), 18, FRAME)
    trim.box((-4, 4), 11, 18, METAL)
    for x in (-7, 7):
        box(3, 2, 1, LAMP, x=x, y=12, z=18, sculpt=trim)
        box(2, 3, 1, TAIL, x=x, y=10, z=-18, sculpt=trim)
    for x in (-9, 9):
        trim.paint(x, (13, 21), -2, PAINT_DARK)
        trim.paint(x, (14, 15), (-17, 2), STRIPE)
        trim.paint(x, 16, (-4, -3), METAL)
    trim.paint(0, (10, 22), -18, FRAME)
    return wheeled(body, 8, -12, 12, 4, trim=trim)


def forklift():
    body = box(17, 5, 23, STRIPE, y=4, z=-3)
    box(15, 3, 12, STRIPE, y=9, z=-8, sculpt=body)
    box(12, 2, 11, FRAME, y=12, z=-8, sculpt=body)
    box(8, 1, 5, TIRE, y=14, z=-6, sculpt=body)
    for x in (-6, 6):
        box(2, 12, 2, FRAME, x=x, y=14, z=-10, sculpt=body)
        box(2, 25, 3, FRAME, x=x, y=3, z=7, sculpt=body)
    box(15, 1, 15, STRIPE, y=26, z=-3, sculpt=body)
    trim = box(8, 4, 2, TIRE, y=14, z=-8)
    box(3, 2, 3, FRAME, y=15, z=-2, sculpt=trim)
    box(4, 1, 3, METAL, y=17, z=-2, sculpt=trim)
    for x in (-6, 6):
        box(1, 18, 1, METAL, x=x, y=7, z=8, sculpt=trim)
        box(2, 1, 1, LAMP, x=x, y=9, z=-14, sculpt=trim)
        for z in (-13, -11, -9):
            trim.paint(x + (-1 if x < 0 else 1), 11, z, FRAME)
    for x in (-4, 0, 4):
        body.cut(x, 26, (-7, 1))
    for x in (-6, 6):
        box(2, 8, 2, STRIPE, x=x, y=16, z=-10, sculpt=trim)
    box(8, 4, 3, METAL, y=14, z=-12, sculpt=trim)
    box(9, 1, 2, FRAME, y=25, z=7, sculpt=trim)
    box(2, 15, 2, METAL, y=6, z=7, sculpt=trim)
    rig = wheeled(body, 7, -10, 5, 4, steer_rear=True, trim=trim, parked_bevel=False)
    fork = box(13, 5, 3, FRAME, y=4, z=10)
    for x in (-4, 4):
        box(2, 2, 12, METAL, x=x, y=3, z=16, sculpt=fork)
    rig.parts.append(Part('fork_carriage', (0, 3, 10), fork))
    rig.clips['Lift Forks'] = [offset_track('fork_carriage', 1, (0, 1.45, 2.1, 3.6), (0, 1.65, 1.65, 0))]
    return rig


def yard_crane():
    body = box(20, 5, 37, FRAME, y=4)
    box(21, 3, 34, STRIPE, y=9, sculpt=body)
    box(13, 2, 10, METAL, y=12, z=-3, sculpt=body)
    trim = Sculpt()
    for x in (-9, 9):
        box(1, 2, 7, METAL, x=x, y=5, z=1, sculpt=trim)
        box(3, 1, 7, FRAME, x=x, y=3, z=1, sculpt=trim)
        box(2, 1, 1, LAMP, x=x, y=8, z=18, sculpt=trim)
    rig = wheeled(body, 9, -12, 13, 4, trim=trim, parked_bevel=False, parked_hubs=False)
    upper = box(17, 4, 15, PAINT, y=14, z=-3)
    box(11, 7, 9, GLASS, x=-3, y=18, z=-4, sculpt=upper)
    box(12, 2, 10, STRIPE, x=-3, y=25, z=-4, sculpt=upper)
    for z in (-8, 0):
        upper.paint(-3, (18, 23), z, FRAME)
    upper.paint(-8, (18, 23), -2, PAINT_DARK)
    box(6, 15, 5, FRAME, x=4, y=18, z=-2, sculpt=upper)
    for x in (1, 6):
        upper.paint(x, (19, 30), 0, METAL)
    # A stepped boom rises above the cab. A level runway carries the trolley.
    box(5, 3, 16, STRIPE, x=4, y=32, z=2, sculpt=upper)
    box(5, 3, 16, STRIPE, x=4, y=34, z=11, sculpt=upper)
    box(4, 3, 15, STRIPE, x=4, y=36, z=19, sculpt=upper)
    parked = Sculpt()
    parked.ops.extend(upper.ops)
    box(4, 1, 24, METAL, x=4, y=32, z=14, sculpt=upper)
    for z in (12, 18, 24):
        box(2, 4, 1, FRAME, x=4, y=33, z=z, sculpt=upper)
    box(14, 5, 3, PAINT_DARK, y=17, z=-11, sculpt=upper)
    box(14, 1, 3, METAL, y=22, z=-11, sculpt=upper)
    for x in (-8, 2):
        upper.paint(x, (18, 24), (-8, -7), PAINT)
        upper.paint(x, (18, 24), 0, PAINT)
    for y in (18, 20):
        upper.paint((-6, 5), y, -12, FRAME)
    rig.parts.append(Part('crane_slew', (0, 14, -3), upper, parked=parked))
    trolley = box(7, 2, 5, FRAME, x=4, y=30, z=9)
    rig.parts.append(Part('crane_trolley', (4, 31, 9), trolley, 'crane_slew'))
    hook = box(3, 2, 2, METAL, x=4, y=23, z=9)
    hook.box(3, (21, 22), 9, RIM)
    hook.box((4, 5), 21, 9, RIM)
    hook.box(5, 22, 9, RIM)
    rig.parts.append(Part('crane_hook', (4, 25, 9), hook, 'crane_trolley'))
    rig.clips['Slew Crane'] = [angle_track('crane_slew', 1, (0, 1.25, 2.5, 3.75, 5), (0, 90, 180, 270, 360))]
    rig.clips['Trolley and Hoist'] = [
        offset_track('crane_trolley', 2, (0, 1.2, 2.3, 3.9, 5), (0, 1.0, 1.0, 0, 0)),
        offset_track('crane_hook', 1, (0, 1.2, 2.3, 3.9, 5), (0, 0, -0.95, -0.95, 0)),
        Track('crane_cable', 'scale', (0, 1.2, 2.3, 3.9, 5), ((1, 1, 1), (1, 1, 1), (1, 2.9, 1), (1, 2.9, 1), (1, 1, 1))),
    ]
    # The cable extends from the fixed trolley anchor to the moving hook.
    cable = box(1, 5, 1, FRAME, x=4, y=25, z=9)
    rig.parts.append(Part('crane_cable', (4, 30, 9), cable, 'crane_trolley'))
    return rig


def patrol_rover():
    body, trim = road_body(19, 32, cabin=(-2, 19), roof=15, paint=FRAME)
    for x in span(19):
        trim.paint(x, 8, (-13, 12), STRIPE)
        trim.paint(x, 9, (9, 12), METAL)
    box(6, 1, 6, METAL, y=16, sculpt=body)
    for x in (-6, 5):
        box(2, 3, 2, FRAME, x=x, y=8, z=15, sculpt=trim)
        box(3, 1, 4, PAINT_DARK, x=x, y=10, z=10, sculpt=trim)
    box(15, 2, 2, FRAME, y=6, z=15, sculpt=trim)
    # A split brush guard protects the lamps and the central winch.
    box(7, 3, 3, RIM, y=8, z=16, sculpt=trim)
    for x in (-7, 7):
        box(2, 4, 2, FRAME, x=x, y=7, z=16, sculpt=trim)
        box(5, 1, 2, FRAME, x=x, y=11, z=15, sculpt=trim)
        box(3, 1, 1, LAMP, x=x, y=10, z=17, sculpt=trim)
    box(13, 2, 5, METAL, y=14, z=-12, sculpt=body)
    rig = wheeled(body, 8, -9, 9, 4, trim=trim, parked_bevel=False)
    scanner = box(10, 2, 4, FRAME, y=17)
    box(8, 1, 3, METAL, y=19, sculpt=scanner)
    box(3, 1, 1, GLASS_EDGE, x=2, y=18, z=2, sculpt=scanner)
    rig.parts.append(Part('scanner_yaw', (0, 17, 0), scanner))
    rig.clips['Scan'] = [angle_track('scanner_yaw', 1, (0, 1, 2, 3, 4), (0, 90, 180, 270, 360))]
    return rig


def market_wagon():
    body = box(15, 3, 23, WOOD, y=6, z=-3)
    for x in (-7, 6):
        box(1, 5, 21, WOOD, x=x, y=9, z=-3, sculpt=body)
        box(2, 2, 22, WOOD, x=x, y=13, z=-3, sculpt=body)
    box(13, 3, 1, WOOD, y=9, z=-14, sculpt=body)
    box(13, 2, 4, WOOD, y=14, z=6, sculpt=body)
    trim = Sculpt()
    for x in (-7, 6):
        trim.paint(x, 11, (-13, 7), PAINT_DARK)
        for z in (-11, 0, 6):
            box(1, 5, 1, RIM, x=x+(-1 if x < 0 else 1), y=9, z=z, sculpt=trim)
    for x in (-5, -2, 1, 4):
        trim.paint(x, 8, (-12, 5), PAINT_DARK)
    for x in (-5, 4):
        box(2, 4, 3, WOOD, x=x, y=10, z=6, sculpt=trim)
    box(11, 4, 2, FRAME, y=7, z=-14, sculpt=trim)
    # A striped canvas top shades the market bed.
    for x in (-6, 6):
        for z in (-12, 2):
            box(1, 9, 1, WOOD, x=x, y=14, z=z, sculpt=trim)
    box(1, 8, 15, WOOD, x=6, y=15, z=-5, sculpt=body)
    box(17, 1, 18, VAN_PANEL, y=22, z=-5, sculpt=body)
    box(9, 1, 18, VAN_PANEL, y=23, z=-5, sculpt=body)
    for z in (-12, -6, 0):
        trim.paint((-8, 8), 22, (z, z+2), STRIPE)
        trim.paint((-4, 4), 23, (z, z+2), STRIPE)
        for x in (-8, 8):
            trim.box(x, 21, (z, z+2), STRIPE)
    rig = wheeled(body, 8, -8, 7, 4, wagon=True, trim=trim)
    shafts = box(1, 2, 15, WOOD, x=-5, y=4, z=15)
    box(1, 2, 15, WOOD, x=5, y=4, z=15, sculpt=shafts)
    rig.parts.append(Part('drawbar', (0, 4, 7), shafts, 'front_axle_yaw'))
    return rig
