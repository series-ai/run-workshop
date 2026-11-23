"""Rigid voxel actors with local arm, leg, head, and hand joints."""

from dataclasses import dataclass
from math import radians, sqrt

import numpy as np
from mathutils import Quaternion, Vector

import level_vehicles as motion
import voxchar as vk
from creature_kit import Sculpt
from level_geometry import box, make_mesh, span, vertex_colors

from .common import BODY, DARK, MARK, METAL, WOOD

CELL = 0.05
HEAD_CELL = CELL / 2
SKIN = vk.vox('skin', 0.16)
HAIR = vk.vox('hair', 0.02)
EYE = vk.vox('leather', -0.72, mottle=False)
LIP = vk.vox('skin', -0.4, mottle=False)
CHEEK = vk.vox('skin', -0.16)
CHIN = vk.vox('skin', 0.28)
BRIDGE = vk.vox('skin', 0.4)
HOLLOW = vk.vox('skin', -0.50)
SEAM = vk.vox('primary', -0.32)
EDGE = vk.vox('primary', 0.37)
SCUFF = vk.vox('leather', -0.45)
CLOTH = vk.vox('detail', 0.2)
RIVET = vk.vox('metal', 0.6, mottle=False)


@dataclass(frozen=True)
class Build:
    hip: int
    knee: int
    trunk: int
    width: int
    depth: int


HUMAN_BUILDS = {
    'worker': Build(18, 10, 11, 7, 3),
    'merchant': Build(19, 10, 10, 7, 3),
    'guard': Build(18, 10, 11, 7, 3),
    'torn': Build(18, 10, 11, 7, 3),
    'rag': Build(19, 10, 10, 7, 3),
    'helmet': Build(18, 10, 11, 7, 3),
    'civilian': Build(19, 10, 10, 7, 3),
    'officer': Build(18, 10, 11, 7, 3),
    'medic': Build(18, 10, 11, 7, 3),
    'infantry': Build(18, 10, 11, 7, 3),
}
DWARF_BUILDS = {
    'worker': Build(11, 5, 9, 9, 4),
    'merchant': Build(10, 5, 9, 9, 5),
    'guard': Build(12, 6, 10, 9, 4),
}


@dataclass(frozen=True)
class Actor:
    label: str
    role: str
    size: str
    headwear: str
    colors: dict


def actors_for(key):
    if key == 'caverns':
        return {
            'dwarf_miner': Actor('Dwarf miner', 'worker', 'dwarf', 'lamp',
                                 {'skin': '#b3856c', 'hair': '#634431', 'primary': '#65756d', 'secondary': '#4b6060'}),
            'dwarf_smith': Actor('Dwarf smith', 'merchant', 'dwarf', 'braid',
                                 {'skin': '#8f694d', 'hair': '#a19b93', 'primary': '#664c43', 'secondary': '#59483c'}),
            'dwarf_guard': Actor('Dwarf vault guard', 'guard', 'dwarf', 'helmet',
                                 {'skin': '#bc9376', 'hair': '#603d33', 'primary': '#4a6375', 'secondary': '#475867'}),
        }
    if key == 'apocalypse':
        return {
            'shambler': Actor('Infected shambler', 'infected', 'human', 'torn',
                              {'skin': '#85966e', 'hair': '#49473a', 'primary': '#747258', 'secondary': '#575f50'}),
            'runner': Actor('Infected runner', 'infected', 'human', 'rag',
                            {'skin': '#a3a77e', 'hair': '#3d4841', 'primary': '#b36d44', 'secondary': '#504c43'}),
            'armored_infected': Actor('Armored infected', 'infected', 'human', 'helmet',
                                      {'skin': '#79916f', 'hair': '#3f453c', 'primary': '#51594d', 'secondary': '#4b544c'}),
            'field_medic': Actor('Quarantine medic', 'civilian', 'human', 'respirator',
                                 {'skin': '#9f7155', 'hair': '#514336', 'primary': '#7e8e7d', 'secondary': '#4d6261'}),
        }
    if key == 'medieval':
        return {
            'blacksmith': Actor('Alderwick blacksmith', 'worker', 'human', 'rag',
                                {'skin': '#996448', 'hair': '#3b2924', 'primary': '#78604b', 'secondary': '#534b42',
                                 'leather': '#51362b', 'detail': '#b47858'}),
            'town_herbalist': Actor('Alderwick herbalist', 'civilian', 'human', 'cowl',
                                    {'skin': '#c29076', 'hair': '#703c26', 'primary': '#4c7963', 'secondary': '#485e53',
                                     'detail': '#c1b29a', 'trim': '#e7ccb0'}),
            'town_steward': Actor('Castle steward', 'officer', 'human', 'soft_cap',
                                   {'skin': '#a46f53', 'hair': '#4b342a', 'primary': '#824953', 'secondary': '#574550',
                                    'trim': '#dfb974'}),
            'castle_guard': Actor('Alderwick guard', 'guard', 'human', 'helmet',
                                   {'skin': '#825241', 'metal': '#879195', 'primary': '#708087', 'secondary': '#45565d',
                                    'detail': '#984c46'}),
            'town_vendor': Actor('Alderwick grain vendor', 'merchant', 'human', 'bonnet',
                                  {'skin': '#ad795c', 'hair': '#453428', 'primary': '#697b79', 'secondary': '#565849',
                                   'detail': '#d4b16d'}),
        }
    return {
        'field_officer': Actor('Estuary field officer', 'officer', 'human', 'cap',
                               {'skin': '#ba8870', 'hair': '#635343', 'primary': '#676d55', 'secondary': '#515648'}),
        'field_medic': Actor('Estuary field medic', 'medic', 'human', 'medic_helmet',
                             {'skin': '#80563c', 'hair': '#34342d', 'primary': '#918a6c', 'secondary': '#645f4d'}),
        'rifleman': Actor('Estuary infantry scout', 'infantry', 'human', 'helmet',
                          {'skin': '#a8785e', 'hair': '#413b31', 'primary': '#666e58', 'secondary': '#53593f'}),
    }


def actor_palette(actor, palette):
    colors = {**palette, **actor.colors}
    for region in ('primary', 'secondary', 'leather'):
        channels = [int(colors[region][offset:offset + 2], 16) for offset in (1, 3, 5)]
        linear = [c / 3294.6 if c <= 10 else ((c / 255 + .055) / 1.055) ** 2.4 for c in channels]
        if sum(c * weight for c, weight in zip(linear, (.2126, .7152, .0722))) < .03:
            colors[region] = '#' + ''.join(f'{max(c, 51):02x}' for c in channels)
    return colors


def head(actor, y):
    shape = Sculpt()
    base_y = y * 2
    dwarf = actor.size == 'dwarf'
    face_width, face_height = (4, 6) if dwarf else (3, 5)
    hair_width = face_width + 2

    def block(w, h, d, color, *, x=0, y=0, z=0):
        bounds_x, bounds_y, bounds_z = span(w, x), (y, y + h - 1), span(d, z)
        shape.box((2 * bounds_x[0], 2 * bounds_x[1] + 1),
                  (base_y + 2 * bounds_y[0], base_y + 2 * bounds_y[1] + 1),
                  (2 * bounds_z[0], 2 * bounds_z[1] + 1), color)

    block(face_width, face_height, 4, SKIN, z=1)
    block(2, 1 if dwarf else 2, 2, HOLLOW, y=-1 if dwarf else -2)
    for x in (-1, 1):
        block(1, 1, 1, CHEEK, x=x, y=2, z=2)
        block(1, 1, 1, EYE, x=x, y=face_height - 2, z=2)
        block(1, 2, 2, HAIR, x=x * (hair_width // 2 - dwarf), y=face_height - 2, z=-1)
    block(1, 1, 1, CHIN, y=0, z=2)
    block(1, 1, 1, LIP, y=1, z=2)
    block(1, 1, 1, BRIDGE, y=2, z=3)
    block(hair_width, 2, 4, HAIR, y=face_height, z=0)
    block(hair_width - 1, 3, 1, HAIR, y=face_height - 3, z=-2)

    if dwarf:
        block(4, 2, 2, HAIR, y=-1, z=4)
        if actor.headwear == 'braid':
            for x, length in ((-2, 3), (1, 4)):
                block(2, length, 2, HAIR, x=x, y=1 - length, z=4)
                block(1, 1, 1, MARK, x=x, y=1 - length, z=5)
            block(2, 1, 2, HAIR, x=1, y=face_height + 1)
        elif actor.role == 'guard':
            block(3, 2, 2, HAIR, y=-2, z=4)
        else:
            block(2, 1, 2, HAIR, y=-1, z=4)
    elif actor.role == 'officer':
        block(3, 1, 1, HAIR, y=1, z=2)
    elif actor.role == 'infected':
        block(1, 2, 1, HOLLOW, x=1, y=0, z=2)
        block(1, 1, 1, HOLLOW, x=1, y=face_height - 1, z=2)

    brim = face_height * 2
    width = hair_width * 2 + 2

    def trim(w, h, d, color, *, x=0, y=0, z=0):
        box(w, h, d, color, x=x, y=base_y + y + brim, z=z, sculpt=shape)

    if actor.headwear in ('helmet', 'medic_helmet', 'lamp'):
        trim(width, 2, 11, DARK, y=0, z=1)
        trim(width - 1, 3, 10, BODY, y=2, z=1)
        trim(width - 3, 1, 8, EDGE, y=5)
        if actor.headwear == 'lamp':
            trim(5, 3, 3, METAL, y=2, z=7)
            trim(3, 2, 1, MARK, y=2, z=9)
        elif actor.headwear == 'medic_helmet':
            trim(6, 4, 1, vk.vox('trim', 0.45, mottle=False), y=1, z=6)
            trim(1, 3, 1, CLOTH, y=2, z=7)
            trim(3, 1, 1, CLOTH, y=3, z=7)
        elif actor.role == 'guard':
            for x in (-(width // 2 - 1), width // 2 - 1):
                trim(2, 5, 6, METAL, x=x, y=-4)
    elif actor.headwear in ('cap', 'soft_cap'):
        trim(width, 2, 9, EDGE, y=2, z=-1)
        trim(width - 2, 3, 9, BODY, y=0, z=-1)
        trim(7, 1, 3, DARK if actor.headwear == 'cap' else MARK, y=0, z=5)
        trim(1, 1, 1, MARK, y=2, z=4)
    elif actor.headwear in ('bonnet', 'cowl'):
        trim(width, 3, 10, CLOTH, y=2, z=-1)
        trim(width - 2, 1, 8, CLOTH, y=5, z=-1)
        for x in (-(width // 2 - 1), width // 2 - 1):
            trim(2, 6, 7, CLOTH, x=x, y=-4, z=-1)
        if actor.headwear == 'cowl':
            trim(4, 8, 3, HAIR, x=3, y=-9, z=-3)
        else:
            trim(8, 1, 3, MARK, y=1, z=5)
    elif actor.headwear == 'rag':
        trim(width - 2, 2, 10, CLOTH, y=-1)
        trim(2, 5, 2, CLOTH, x=3, y=-4, z=-5)
    elif actor.headwear == 'torn':
        shape.cut((0, 4), (base_y + brim + 2, base_y + brim + 5), (-5, 0))
        trim(3, 3, 4, HAIR, x=-3, y=3, z=-2)
    elif actor.headwear == 'respirator':
        trim(width, 4, 10, BODY, y=0, z=-1)
        for x in (-(width // 2 - 1), width // 2 - 1):
            trim(2, 7, 8, BODY, x=x, y=-6, z=-1)
        trim(7, 3, 2, DARK, y=-9, z=5)
        for x in (-2, 2):
            trim(3, 3, 3, METAL, x=x, y=-9, z=7)
    return shape


def trim_torso(actor, torso, hip, shoulder, build):
    face = (build.depth - 1) // 2 + 1
    back = -build.depth // 2 - 1
    width = build.width
    if actor.role == 'guard' or actor.role == 'infected' and actor.headwear == 'helmet':
        for y in range(hip + 3, shoulder, 2):
            box(width - 2, 2, 2, METAL if actor.role == 'guard' else DARK,
                y=y, z=face, sculpt=torso)
            for x in (-3, 3):
                box(1, 1, 1, RIVET, x=x, y=y + 1, z=face + 1, sculpt=torso)
        return
    if actor.role == 'merchant':
        box(7, 7, 2, WOOD, y=hip, z=face, sculpt=torso)
        box(5, 2, 1, SCUFF, y=hip + 1, z=face + 1, sculpt=torso)
        for x in (-3, 3):
            box(1, 3, 2, SCUFF, x=x, y=shoulder - 2, z=face, sculpt=torso)
        return
    if actor.role == 'infected':
        for x, y in ((-3, 4), (-2, 5), (1, 3)):
            box(2, 1, 1, HOLLOW, x=x, y=hip + y, z=face - 1, sculpt=torso)
        if actor.headwear == 'rag':
            box(width - 2, 2, 1, CLOTH, y=hip + 5, z=face, sculpt=torso)
        else:
            box(2, 5, 1, SEAM, x=-3, y=hip - 2, z=face, sculpt=torso)
        return
    for x in (-2, 2):
        box(2, 3, 2, SEAM, x=x, y=shoulder - 3, z=face, sculpt=torso)
    for y in range(hip + 3, shoulder - 1, 2):
        box(1, 1, 1, MARK, y=y, z=face, sculpt=torso)
    if actor.role in ('worker', 'infantry'):
        box(6 if actor.role == 'worker' else 5, 6, 3, WOOD, y=hip + 3, z=back, sculpt=torso)
        box(5, 2, 1, SCUFF, y=hip + 7, z=back - 2, sculpt=torso)
    if actor.role in ('medic', 'civilian'):
        box(4, 5, 3, WOOD, x=3, y=hip + 1, z=back, sculpt=torso)
        box(3, 1, 1, MARK, x=3, y=hip + 5, z=back - 2, sculpt=torso)


def actor_part_cell(name):
    return HEAD_CELL if name == 'head' else CELL


def sculpt_actor(actor):
    dwarf = actor.size == 'dwarf'
    builds = DWARF_BUILDS if dwarf else HUMAN_BUILDS
    build = builds[actor.headwear if actor.role == 'infected' else actor.role]
    hip, width, depth = build.hip, build.width, build.depth
    shoulder = hip + build.trunk
    waist = width - 2 if actor.headwear == 'cowl' else width - 1
    torso = box(waist, 5, depth, BODY, y=hip)
    box(width, build.trunk - 2, depth, BODY, y=hip + 4, sculpt=torso)
    box(width, 1, depth + 1, WOOD, y=hip, sculpt=torso)
    box(1, 1, 1, MARK, y=hip, z=depth // 2 + 1, sculpt=torso)
    trim_torso(actor, torso, hip, shoulder, build)
    if actor.headwear == 'cowl':
        box(5, 3, 1, CLOTH, y=shoulder - 4, z=depth // 2 + 1, sculpt=torso)
        box(5, 6, 1, WOOD, y=hip - 2, z=depth // 2 + 1, sculpt=torso)
        box(1, 2, 1, MARK, y=hip + 1, z=depth // 2 + 2, sculpt=torso)
    if actor.headwear == 'respirator':
        box(5, 5, 1, METAL, y=hip + 3, z=2, sculpt=torso)
        box(3, 1, 1, CLOTH, y=hip + 5, z=3, sculpt=torso)
        box(1, 3, 1, CLOTH, y=hip + 4, z=3, sculpt=torso)
    head_base = shoulder + (1 if dwarf else 2)
    parts = [('torso', 'actor_root', (0, hip, 0), torso),
             ('head', 'torso', (0, shoulder, 0), head(actor, head_base))]
    torso_left, torso_right = span(width)
    for name, sign in (('left', 1), ('right', -1)):
        arm_width = 3 if dwarf else 2
        arm_side = torso_right + 1 if sign > 0 else torso_left - arm_width
        arm_x = arm_side + arm_width // 2
        elbow_y = shoulder - (5 if dwarf else 6)
        arm = box(arm_width, shoulder - elbow_y + 1, 3 if dwarf else 2, BODY, x=arm_x, y=elbow_y)
        if actor.role == 'guard':
            pad_width = arm_width + 1
            pad_side = arm_side if sign > 0 else arm_side - 1
            box(pad_width, 2, 3, METAL, x=pad_side + pad_width // 2, y=shoulder - 1, sculpt=arm)
        forearm = 5 if dwarf else 6
        hand_y = elbow_y - forearm
        sleeve = box(arm_width, forearm - 1, 2, BODY, x=arm_x, y=hand_y + 1)
        box(arm_width, 1, 2, EDGE, x=arm_x, y=hand_y + 1, sculpt=sleeve)
        box(3, 1, 2, SKIN, x=arm_x, y=hand_y + 1, sculpt=sleeve)
        box(3, 1, 2, CHEEK, x=arm_x, y=hand_y - 1, sculpt=sleeve)
        box(1, 1, 2, SKIN, x=arm_x + sign, y=hand_y, sculpt=sleeve)
        box(1, 1, 1, CHEEK, x=arm_x + sign, y=hand_y, z=1, sculpt=sleeve)
        if actor.role == 'infected' and name == 'left':
            box(arm_width, 3, 2, HOLLOW, x=arm_x, y=hand_y + 2, sculpt=sleeve)
        if actor.headwear in ('respirator', 'medic_helmet') and name == 'right':
            box(arm_width, 2, 2, METAL, x=arm_x, y=shoulder - 3, sculpt=arm)
            box(1, 1, 1, CLOTH, x=arm_x, y=shoulder - 2, z=1, sculpt=arm)
        leg_x, knee = sign * (3 if dwarf else 2), build.knee
        upper = box(3, hip - knee, 3, DARK, x=leg_x, y=knee)
        boot = box(3, knee, 2, DARK, x=leg_x)
        box(3, 2, 3, WOOD, x=leg_x, z=0, sculpt=boot)
        box(3, 1, 1, SCUFF, x=leg_x, z=2, sculpt=boot)
        if actor.role in ('officer', 'medic', 'infantry', 'guard'):
            box(2, 2, 1, SCUFF, x=leg_x, y=knee - 2, z=1, sculpt=boot)
        if actor.role == 'infected' and actor.headwear == 'rag' and sign > 0:
            box(3, 3, 2, HOLLOW, x=leg_x, y=4, sculpt=boot)
        parts.extend((
            (f'{name}_shoulder', 'torso', (arm_x, shoulder, 0), arm),
            (f'{name}_elbow', f'{name}_shoulder', (arm_x, elbow_y, 0), sleeve),
            (f'{name}_hand_mount', f'{name}_elbow', (arm_x + 0.5, hand_y + 0.5, 0), None),
            (f'{name}_hip', 'actor_root', (leg_x, hip, 0), upper),
            (f'{name}_knee', f'{name}_hip', (leg_x, knee, 0), boot),
        ))
    return parts


def actor_clips(actor):
    idle = [motion.angle_track('head', 1, (0, 0.8, 1.65, 2.4), (0, 10, -5, 0))]
    walk = []
    reach = []
    stride = {
        'torn': (1.52, 16, 12),
        'rag': (0.84, 30, 22),
        'helmet': (1.36, 19, 11),
    }
    duration, swing, flex = stride[actor.headwear] if actor.role == 'infected' else (1.20, 28, 17)
    loop = tuple(duration * step / 4 for step in range(5))
    for side, sign in (('left', 1), ('right', -1)):
        walk.extend((
            motion.angle_track(f'{side}_hip', 0, loop, (0, sign * swing, 0, -sign * swing, 0)),
            motion.angle_track(f'{side}_knee', 0, loop, (0, flex if sign == 1 else 4, 0, flex if sign == -1 else 4, 0)),
            motion.angle_track(f'{side}_shoulder', 0, loop, (0, -sign * swing, 0, sign * swing, 0)),
        ))
        reach.append(motion.angle_track(f'{side}_shoulder', 0, (0, 0.36, 0.64, 1), (0, -70, -70, 0)))
    return {'Idle': idle, 'Walk': walk, 'Reach': reach}


def work_tracks(actor, pose):
    pivots = {name: Vector(pivot) * CELL for name, _, pivot, _ in sculpt_actor(actor)}
    world_to_actor = Quaternion((0, 1, 0), radians(-pose.yaw))
    tracks = []

    def hold(part, rotation):
        rest = (0, 0, 0, 1)
        value = (rotation.x, rotation.y, rotation.z, rotation.w)
        tracks.append(motion.Track(part, 'rotation', (0, 0.3, 0.65, 1), (rest, value, value, rest)))

    for side, sign, contact in (('left', 1, pose.left), ('right', -1, pose.right)):
        if contact is None:
            continue
        shoulder = f'{side}_shoulder'
        elbow = f'{side}_elbow'
        start = pivots[shoulder]
        upper = pivots[elbow] - start
        lower = pivots[f'{side}_hand_mount'] - pivots[elbow]
        target = world_to_actor @ (Vector(contact) - Vector(pose.position))
        reach = target - start
        distance = reach.length
        if not abs(upper.length - lower.length) < distance < upper.length + lower.length:
            raise ValueError(f'{actor.label}: {side} hand at {tuple(contact)} is out of reach ({distance:.3f} m)')

        direction = reach / distance
        # Bend the elbow down and away from the trunk.
        bend = Vector((sign * 0.35, -1, 0))
        bend -= direction * bend.dot(direction)
        if bend.length_squared < 1e-8:
            bend = Vector((0, 0, -1)) - direction * (-direction.z)
        along = (upper.length_squared + distance * distance - lower.length_squared) / (2 * distance)
        upper_pose = direction * along + bend.normalized() * sqrt(max(0, upper.length_squared - along * along))
        shoulder_rotation = upper.rotation_difference(upper_pose)
        lower_pose = shoulder_rotation.inverted() @ (reach - upper_pose)
        hold(shoulder, shoulder_rotation)
        hold(elbow, lower.rotation_difference(lower_pose))

    if pose.look or pose.pitch:
        yaw = Quaternion((0, 1, 0), radians(pose.look))
        pitch = Quaternion((1, 0, 0), radians(pose.pitch))
        hold('head', yaw @ pitch)
    return tracks


def add_actor(path, actor, palette, *, clips=None):
    parts = sculpt_actor(actor)
    builder = vk.GlbBuilder()
    doc = builder.doc
    doc['materials'] = [{'name': 'Cubix Actor', 'pbrMetallicRoughness': {
        'metallicFactor': 0, 'roughnessFactor': 0.84,
    }}]
    joints = ['actor_root', *(part[0] for part in parts)]
    contract = {'joints': joints, 'parents': {'actor_root': None},
                'worldPositions': {'actor_root': (0, 0, 0)}}
    for name, parent, pivot, _ in parts:
        contract['parents'][name] = parent
        contract['worldPositions'][name] = [value * CELL for value in pivot]
    builder.add_custom_rig(contract, rig_name='CubixActor')
    doc['nodes'][0]['extras'] = {'up': '+Y', 'forward': '+Z', 'voxelSize': CELL}
    indices = {name: index for index, name in enumerate(joints)}

    meshes = []
    joint_indices = []
    face_indices = []
    offset = 0
    for name, _, _, shape in parts:
        if shape is None:
            continue
        mesh = make_mesh(name, shape, (0, 0, 0), cell=actor_part_cell(name))
        meshes.append(mesh)
        weights = np.zeros((len(mesh.positions), 4), dtype=np.uint8)
        weights[:, 0] = indices[name]
        joint_indices.append(weights)
        face_indices.append(mesh.indices + offset)
        offset += len(mesh.positions)
    weights = np.zeros((offset, 4), dtype=np.float32)
    weights[:, 0] = 1
    positions, normals, uvs, uv1s = (
        np.concatenate([getattr(mesh, field) for mesh in meshes])
        for field in ('positions', 'normals', 'uvs', 'uv1s')
    )
    skin_mesh = vk.MeshData('actor_mesh', positions, normals, uvs, uv1s, np.concatenate(face_indices),
                            joints=np.concatenate(joint_indices), weights=weights)
    budget = vk.load_json('budgets.json')['mobilePolicy']['maxTrianglesPerComposedAvatar']
    if skin_mesh.triangles > budget:
        raise ValueError(f'{actor.label}: {skin_mesh.triangles} triangles exceeds {budget}')
    builder.add_mesh(skin_mesh, colors=vertex_colors(skin_mesh, actor_palette(actor, palette)))

    doc['animations'] = []
    for label, tracks in (actor_clips(actor) if clips is None else clips).items():
        animation = {'name': label, 'samplers': [], 'channels': []}
        for track in tracks:
            key = builder._accessor(np.asarray(track.times, dtype=np.float32), 'SCALAR', bounds=True)
            value = builder._accessor(np.asarray(track.values, dtype=np.float32), 'VEC4')
            animation['samplers'].append({'input': key, 'output': value, 'interpolation': 'LINEAR'})
            animation['channels'].append({'sampler': len(animation['samplers']) - 1,
                                          'target': {'node': indices[track.part], 'path': 'rotation'}})
        doc['animations'].append(animation)
    builder.write(path)
