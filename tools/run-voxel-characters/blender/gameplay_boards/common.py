"""Geometry and gameplay data shared by the board authors."""

from dataclasses import dataclass, field
from random import Random

import build_level_props as lp
import voxchar as vk
from creature_kit import Sculpt
from level_geometry import box, span
from prop_surfaces import apply_finish

STONE = vk.vox('skin', 0)
JOINT = vk.vox('skin', -0.38)
DARK = vk.vox('secondary', -0.15)
BODY = vk.vox('primary', 0)
WOOD = vk.vox('leather', 0.12)
METAL = vk.vox('metal', 0)
MARK = vk.vox('trim', 0.22)
GLASS = vk.vox('visor', 0.08)
GREEN = vk.vox('detail', 0.08)
RUBBER = vk.vox('hair', 0)
GLOW = vk.vox('accent', 0.5, emissive=True)
BOARD_PROP_BUDGET = vk.BUDGETS['classes']['levelProp']


@dataclass(frozen=True)
class WorkPose:
    position: tuple
    yaw: float
    look: float
    pitch: float
    left: tuple | None
    right: tuple | None


@dataclass
class Board(lp.Kit):
    palette: dict = field(default_factory=dict)
    environment: dict = field(default_factory=dict)
    fixtures: list = field(default_factory=list)
    shots: list = field(default_factory=list)
    points: list = field(default_factory=list)
    routes: list = field(default_factory=list)
    ambient_actors: list = field(default_factory=list)
    work_poses: dict[str, dict[str, WorkPose]] = field(default_factory=dict)
    vehicle_roles: dict = field(default_factory=dict)
    entry: str = ''
    exit: str = ''

    def finish(self, label, sculpt):
        apply_finish(self.key, label, sculpt, triangle_limit=BOARD_PROP_BUDGET['maxTriangles'])

    def point(self, key, label, x, z, *, y=0, actions=(), radius=2.5):
        self.points.append({'id': key, 'label': label, 'position': [x, y, z],
                            'radius': radius, 'actions': list(actions)})

    def link(self, start, end, *path, requires=(), traversal='walk'):
        self.routes.append({'points': [start, end], 'waypoints': list(path),
                            'requires': list(requires), 'traversal': traversal})

    def stage_actor(self, asset, x, z, *, y=0, yaw=0, pose=None):
        anchor = {'asset': asset, 'position': [x, y, z], 'yaw': yaw}
        if pose is not None:
            clip, seconds = pose
            anchor['pose'] = {'clip': clip, 'seconds': seconds}
        self.ambient_actors.append(anchor)

    def stage_work(self, asset, clip_name, x, z, *, left=None, right=None, y=0, yaw=0, look=0, pitch=0):
        """Hold the actor's hand mounts at world-space contacts for the review pose."""
        if left is None and right is None:
            raise ValueError(f'{asset}: {clip_name} needs at least one hand contact')
        poses = self.work_poses.setdefault(asset, {})
        if clip_name in poses:
            raise ValueError(f'{asset}: duplicate work pose {clip_name}')
        poses[clip_name] = WorkPose((x, y, z), yaw, look, pitch, left, right)
        self.stage_actor(asset, x, z, y=y, yaw=yaw, pose=(clip_name, 0.45))

    def shot(self, label, eye, target):
        self.shots.append({'label': label, 'eye': eye, 'target': target})

    def light(self, x, y, z, color, intensity, distance):
        self.fixtures.append({'position': [x, y, z], 'color': color,
                              'intensity': intensity, 'distance': distance})

    def vehicle(self, label, role, rig, x, z, turn=0, height=0, *, parked=None, **colors):
        asset = self.add(label, rig.rest() if parked is None else parked, x, z, turn, height, vehicle=rig)
        self.vehicle_roles[asset] = role
        if colors:
            self.set_palette(label, **colors)
        return asset


def create_board(key, title, route, colors, environment, entry, exit):
    regions = ('skin', 'secondary', 'primary', 'leather', 'trim', 'metal',
               'accent', 'visor', 'hair', 'detail')
    palette = dict(zip(regions, colors, strict=True))
    return Board(key, title, route, STONE, MARK, palette=palette, environment=environment,
                 entry=entry, exit=exit)


def color_profile(sky, ground, sun, *, strength=2.2, direction=(-4, 7, 3)):
    return {'zenith': sky, 'horizon': ground, 'fogDensity': 0.009,
            'skyFill': sun, 'groundFill': ground, 'fillIntensity': 1.1,
            'sunColor': sun, 'sunIntensity': strength, 'sunDirection': direction}


def action(kind, *, assets=(), reward=None, requires=(), **data):
    return {'kind': kind, 'assets': list(assets), 'requires': list(requires),
            **({'reward': reward} if reward else {}), **data}


def slab(width, depth, *, face=STONE, joint=JOINT, seed=0, kerbs=False):
    rng = Random(seed)
    shape = box(width, 3, depth, STONE)
    box(width, 1, depth, face, y=2, sculpt=shape)
    for _ in range((width + depth) // 8):
        x = rng.randrange(-width // 2 + 3, width // 2 - 3)
        z = rng.randrange(-depth // 2 + 3, depth // 2 - 3)
        box(rng.randint(2, 6), 1, 2, joint, x=x, y=2, z=z, sculpt=shape)
    if kerbs:
        for x in (-width // 2 + 2, width // 2 - 2):
            box(1, 1, depth, MARK, x=x, y=2, sculpt=shape)
    return shape


def floors(board, label, shape, coordinates, *, y=-0.3):
    first, *rest = coordinates
    board.add(label, shape, *first, height=y)
    for x, z in rest:
        board.place(label, x, z, height=y)


def fractured_wall(width, height, depth, *, seed=0, door=0, holes=0):
    rng = Random(seed)
    shape = lp.panel(width, height, depth, STONE, JOINT, opening=door, rows=True)
    for i in range(holes):
        x = rng.randint(-width // 2 + 6, width // 2 - 6)
        z = depth // 2 + 1
        h = rng.randint(4, 10)
        shape.cut(span(rng.randint(4, 10), x), (max(1, height - h - i % 4), height), (-z, z))
    return shape


def screen(width, height, *, frame=METAL, mesh=DARK):
    shape = Sculpt()
    for x in (-width // 2 + 1, width // 2 - 1):
        box(2, height, 3, frame, x=x, sculpt=shape)
    for x in range(-width // 2 + 4, width // 2, 5):
        box(1, height - 4, 1, mesh, x=x, y=2, sculpt=shape)
    for y in range(2, height, 5):
        box(width - 3, 1, 1, mesh, y=y, sculpt=shape)
    for y in (1, height - 2):
        box(width, 1, 2, frame, y=y, sculpt=shape)
    return shape


def barricade(width, *, face=STONE, stripe=MARK):
    shape = box(width, 3, 10, DARK)
    box(width - 2, 4, 8, face, y=3, sculpt=shape)
    box(width - 5, 4, 5, face, y=7, sculpt=shape)
    for x in range(-width // 2 + 3, width // 2 - 2, 7):
        for y in range(5, 10):
            box(2, 1, 1, stripe, x=x + (y - 5) // 2, y=y,
                z=3 if y < 7 else 2, sculpt=shape)
    return shape


def arch(width, height, depth, opening, *, face=STONE):
    shape = lp.deep_arch(width, height, depth, opening, face, JOINT)
    for x in (-opening // 2 - 2, opening // 2 + 2):
        box(3, 2, depth + 2, MARK, x=x, y=height - 7, sculpt=shape)
    return shape


def shelf(width, depth, height, *, face=METAL):
    shape = Sculpt()
    for x in (-width // 2 + 1, width // 2 - 1):
        for z in (-depth // 2 + 1, depth // 2 - 1):
            box(2, height, 2, face, x=x, z=z, sculpt=shape)
    for y in range(2, height, 8):
        box(width, 1, depth, WOOD, y=y, sculpt=shape)
        box(width, 1, 1, DARK, y=y + 1, z=-depth // 2, sculpt=shape)
    return shape


def rubble(width, depth, *, face=STONE, seed=0):
    rng = Random(seed)
    shape = Sculpt()
    for _ in range(max(10, width // 2)):
        x = rng.randrange(-width // 2, width // 2)
        z = rng.randrange(-depth // 2, depth // 2)
        h = rng.randint(1, 5)
        box(rng.randint(2, 8), h, rng.randint(2, 7), face, x=x, z=z, sculpt=shape)
        box(2, 1, 2, JOINT, x=x, y=h, z=z, sculpt=shape)
    return shape


def roof_bay(width, depth, height, *, face=METAL):
    shape = Sculpt()
    for x in (-width // 2 + 2, width // 2 - 2):
        for z in (-depth // 2 + 2, depth // 2 - 2):
            box(3, height, 4, DARK, x=x, z=z, sculpt=shape)
    box(width, 2, depth, face, y=height - 2, sculpt=shape)
    for x in range(-width // 2 + 3, width // 2 - 2, 6):
        box(2, 1, depth, MARK, x=x, y=height, sculpt=shape)
    return shape


def glyph(shape, rows, x, y, z, color, scale=1):
    for row, pixels in enumerate(reversed(rows)):
        for column, pixel in enumerate(pixels):
            if pixel == '#':
                box(scale, scale, 1, color, x=x + column * scale,
                    y=y + row * scale, z=z, sculpt=shape)
    return shape
