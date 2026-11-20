"""Build the seven Astra-redesigned voxel quadrupeds for run-cubix-creatures.

Each animal is sculpted with `CreatureSculptor` (`blender/creature_kit.py`) onto its CC0 / RUN source rig,
checked by `QuadrupedAudit`, and exported as a single skinned GLB (`<rig_id>-rig.glb`) with world-metre
ragdoll capsules measured directly from its sculpted voxel segments.
"""

from __future__ import annotations

import copy
from pathlib import Path

import numpy as np

from creature_kit import CreatureSculptor, Sculpt
import voxchar as vk
from voxchar import vox

PACK = 'creatures'
RIG_DIR = Path(__file__).resolve().parent.parent / 'assets' / 'source' / 'creatures'

ANIMAL_PALETTES = {
    'fox': {
        'skin': '#efe4cf',
        'hair': '#3d3538',
        'primary': '#e57832',
        'secondary': '#a64a27',
        'accent': '#ffb02e',
        'metal': '#c2cad4',
        'trim': '#dfb98e',
        'leather': '#43322c',
        'visor': '#1e1612',
        'detail': '#df7844',
    },
    'horse': {
        'skin': '#f0e7d5',
        'hair': '#dfc082',
        'primary': '#b3592e',
        'secondary': '#7a3b22',
        'accent': '#e6ad3c',
        'metal': '#929ca8',
        'trim': '#d49a6a',
        'leather': '#4b3328',
        'visor': '#1a1513',
        'detail': '#c76b3b',
    },
    'wolf': {
        'skin': '#d8cfbb',
        'hair': '#3a3d44',
        'primary': '#888580',
        'secondary': '#545456',
        'accent': '#ffd23f',
        'metal': '#c0c8d2',
        'trim': '#b7aca1',
        'leather': '#3f3835',
        'visor': '#1d1f24',
        'detail': '#5a606c',
    },
    'corgi': {
        'skin': '#f2ece0',
        'hair': '#3b3535',
        'primary': '#d4802e',
        'secondary': '#a55a1e',
        'accent': '#4fd1c5',
        'metal': '#d8b248',
        'trim': '#e08e96',
        'leather': '#45342e',
        'visor': '#221f1f',
        'detail': '#e69b4e',
    },
    'pug': {
        'skin': '#e3cfb2',
        'hair': '#3c3534',
        'primary': '#cfb184',
        'secondary': '#9c7f58',
        'accent': '#38bdf8',
        'metal': '#c8ced6',
        'trim': '#e0828e',
        'leather': '#43352f',
        'visor': '#1b1819',
        'detail': '#b89a6e',
    },
    'gsd': {
        'skin': '#dcc095',
        'hair': '#454048',
        'primary': '#be8a57',
        'secondary': '#394250',
        'accent': '#4fd1c5',
        'metal': '#9ca6b3',
        'trim': '#d4a34a',
        'leather': '#4b3324',
        'visor': '#1e1c1b',
        'detail': '#8f6030',
    },
    'cat': {
        'skin': '#f0dec2',
        'hair': '#3c3431',
        'primary': '#db9759',
        'secondary': '#a85b37',
        'accent': '#62d98f',
        'metal': '#e8c14c',
        'trim': '#e5929d',
        'leather': '#8c3c44',
        'visor': '#1a1e1a',
        'detail': '#ea9652',
    },
}


def barrel(stations, material):
    """Draw transverse sections. Each section gives depth, belly, back and half width."""
    sculpt = Sculpt()
    for depth, belly, back, width in stations:
        sculpt.box((-width + 1, width - 1), (belly, back), depth, material)
        inset = min(3, max(1, (back - belly) // 4))
        sculpt.both(width, (belly + inset, back - inset), depth, material)
    return sculpt


def ears(sculpt, x, y, z, coat, inside, tip):
    """Raise two tapered ears from a broad base. Turn the outer tips back."""
    return (
        sculpt.both((x - 1, x + 1), (y, y + 1), (z, z + 1), coat)
        .both(x, y + 1, z + 1, inside)
        .both((x, x + 1), y + 2, z, coat)
        .both(x + 1, y + 3, z, tip)
    )


def _measure_world_colliders(sculptor: CreatureSculptor) -> dict:
    """Measure world-metre bone-rotation-aligned ragdoll capsules for each voxel-owning joint."""
    mesh = sculptor._bind_geometry()
    positions = mesh['positions'].astype(np.float64)
    joints = mesh['joints']
    colliders = {}

    for index, name in enumerate(sculptor.rig.names):
        mask = joints == index
        if not np.any(mask):
            continue
        pts_skin = positions[mask]
        if len(pts_skin) < 4:
            continue
        # Transform from skin space -> GLB world metres via skin_matrix = rest[index] @ inv(rig_world[index])
        skin_mat = sculptor.rest[index] @ np.linalg.inv(sculptor.rig_world[index])
        homog = np.hstack([pts_skin, np.ones((len(pts_skin), 1), dtype=np.float64)])
        pts_world = (homog @ skin_mat.T)[:, :3]
        # Orthonormalize rest[index] so collider is in bone-rotation-aligned world metres (handles AnimalArmature scale=100, rig scale=0.55)
        rot_cols = sculptor.rest[index][:3, :3].copy()
        for col in range(3):
            norm = float(np.linalg.norm(rot_cols[:, col]))
            if norm > 1e-8:
                rot_cols[:, col] /= norm
        j_pos = sculptor.rest[index][:3, 3]
        pts_local = (pts_world - j_pos) @ rot_cols  # transpose of orthonormal rot_cols

        low, high = pts_local.min(axis=0), pts_local.max(axis=0)
        centre = (low + high) * 0.5
        half = (high - low) * 0.5
        axis_idx = int(np.argmax(half))
        other = [float(half[i]) for i in range(3) if i != axis_idx]
        radius = max(0.015, min(0.26, min(other) * 0.92))
        reach = max(0.0, float(half[axis_idx]) - radius)
        step = np.zeros(3, dtype=np.float64)
        step[axis_idx] = reach
        a = centre - step
        b = centre + step
        colliders[name] = {
            'type': 'capsule',
            'a': [round(float(v), 5) for v in a],
            'b': [round(float(v), 5) for v in b],
            'radius': round(float(radius), 5),
        }
    return colliders


def _build_fox():
    s = CreatureSculptor(
        RIG_DIR / 'm2m_fox_merged.glb', 'body_red_fox', 0.030, ANIMAL_PALETTES['fox'], rig_scale=0.50
    )
    coat, brow, cream, dark = vox('primary'), vox('secondary'), vox('skin'), vox('hair')
    pad_c = vox('leather')
    nose = vox('visor', -0.25, mottle=False)

    s.seg('hips', barrel([((-14, -5), 13, 21, 3)], coat), role='trunk', bake_ao=False)
    s.seg('spine_1', Sculpt().box((-2, 2), (15, 21), (-7, 0), coat), pad=1, role='trunk', bake_ao=False)
    s.seg('spine_2', barrel([((-1, 6), 13, 22, 4)], coat), role='trunk', bake_ao=False)
    s.seg(
        'spine_3',
        barrel([((5, 11), 12, 22, 4)], coat)
        .box((-1, 1), (18, 20), (2, 5), coat)
        .paint((-2, 2), (12, 18), (8, 11), cream),
        pad=1,
        role='trunk',
        bake_ao=False,
    )
    s.seg(
        'spine_4',
        barrel([((9, 13), 16, 24, 3)], coat).paint((-2, 2), (15, 19), (10, 13), cream),
        pad=2,
        bake_ao=False,
    )
    s.seg(
        'spine_5',
        Sculpt().box((-2, 2), (17, 24), (12, 16), coat).paint((-2, 2), (17, 20), (14, 16), cream),
        pad=1,
        bake_ao=False,
    )
    skull = barrel([((15, 18), 20, 25, 3), ((19, 20), 20, 24, 2)], coat)
    skull.both(3, (20, 21), (16, 18), cream).both(2, 21, (19, 20), cream)
    skull.box((-1, 1), (21, 22), (20, 22), coat).box(0, 21, 23, nose)
    skull.both(2, 22, 20, brow).both(2, 24, 20, vox('detail'))
    skull.eyes(2, 23, 20, vox('visor', mottle=False))
    skull.box(0, 22, 23, coat).box(0, 20, 23, cream)
    s.seg('head', ears(skull, 2, 25, 16, coat, brow, dark), pad=2, role='head', bake_ao=False)
    s.seg('mouth', Sculpt().box((-1, 1), (19, 20), (19, 22), cream).box(0, 20, 23, cream), bake_ao=False)
    s.seg(
        'front_leg_shoulder_l',
        Sculpt().box((2, 3), (15, 20), (2, 9), coat),
        mirror_bone='front_leg_shoulder_r',
        pad=3,
        bake_ao=False,
    )
    s.seg(
        'front_leg_upper_l',
        Sculpt().box((2, 3), (8, 15), (6, 9), coat),
        mirror_bone='front_leg_upper_r',
        pad=2,
        role='front_upper',
        bake_ao=False,
    )
    s.seg(
        'front_leg_lower_l',
        Sculpt().box((2, 3), (2, 8), (6, 7), dark),
        mirror_bone='front_leg_lower_r',
        role='front_lower',
        bake_ao=False,
    )
    s.seg(
        'front_leg_ankle_l',
        Sculpt().box((2, 3), (1, 2), (6, 7), dark),
        mirror_bone='front_leg_ankle_r',
        pad=1,
        role='front_lower',
        bake_ao=False,
    )
    s.seg(
        'front_leg_foot_l',
        Sculpt().box((2, 3), 0, (6, 9), pad_c).box((2, 3), 1, (8, 9), dark),
        mirror_bone='front_leg_foot_r',
        role='front_paw',
        bake_ao=False,
    )

    s.seg(
        'back_leg_pelvis_l',
        Sculpt().box((2, 3), (17, 19), (-11, -4), coat),
        mirror_bone='back_leg_pelvis_r',
        pad=3,
        bake_ao=False,
    )
    s.seg(
        'back_leg_upper_l',
        Sculpt().box((2, 3), (12, 17), (-13, -9), coat),
        mirror_bone='back_leg_upper_r',
        pad=2,
        role='back_upper',
        bake_ao=False,
    )
    s.seg(
        'back_leg_lower_l',
        Sculpt().box((2, 3), (9, 12), (-13, -9), coat).box((2, 3), (6, 9), (-14, -11), coat),
        mirror_bone='back_leg_lower_r',
        pad=1,
        role='back_upper',
        bake_ao=False,
    )
    s.seg(
        'back_leg_ankle_l',
        Sculpt().box((2, 3), (2, 6), (-14, -13), dark),
        mirror_bone='back_leg_ankle_r',
        role='back_lower',
        bake_ao=False,
    )
    s.seg(
        'back_leg_foot_l',
        Sculpt().box((2, 3), 1, (-14, -13), dark),
        mirror_bone='back_leg_foot_r',
        pad=1,
        role='back_lower',
        bake_ao=False,
    )
    s.seg(
        'back_leg_toe_l',
        Sculpt().box((2, 3), 0, (-14, -11), pad_c).box((2, 3), 1, (-12, -11), dark),
        mirror_bone='back_leg_toe_r',
        role='back_paw',
        bake_ao=False,
    )

    s.seg('tail_1', Sculpt().box((-1, 1), (16, 20), (-19, -14), coat), pad=1, bake_ao=False)
    s.seg('tail_2', barrel([((-26, -23), 14, 22, 3), ((-22, -18), 15, 21, 2)], coat), bake_ao=False)
    s.seg(
        'tail_3',
        barrel([((-32, -30), 17, 21, 2), ((-29, -25), 15, 22, 3)], coat).paint(
            (-2, 2), (16, 22), (-32, -28), cream
        ),
        pad=1,
        bake_ao=False,
    )
    s.seg('tail_4', barrel([((-36, -35), 19, 21, 1), ((-34, -31), 17, 21, 2)], cream), bake_ao=False)
    return s


def _build_horse():
    s = CreatureSculptor(
        RIG_DIR / 'm2m_horse_anims.glb', 'body_chestnut_horse', 0.040, ANIMAL_PALETTES['horse'], rig_scale=1.00
    )
    coat, bay, white, mane = vox('primary'), vox('secondary'), vox('skin'), vox('hair')
    hoof = vox('visor', mottle=False)
    eye = vox('visor', -0.25, mottle=False)
    detail = vox('detail')

    # ---- Trunk: sloped croup -> tucked loin -> deep barrel -> high withers & proud chest ----
    s.seg(
        'hips',
        barrel([((-18, -15), 27, 35, 3), ((-14, -7), 24, 38, 5)], coat),
        role='trunk',
        bake_ao=False,
    )
    s.seg('spine_1', Sculpt().box((-4, 4), (24, 36), (-8, 1), coat), pad=1, role='trunk', bake_ao=False)
    s.seg('spine_2', barrel([((0, 7), 21, 37, 6)], coat), role='trunk', bake_ao=False)
    s.seg(
        'spine_3',
        barrel([((6, 13), 21, 39, 6), ((14, 18), 24, 34, 4)], coat),
        pad=1,
        role='trunk',
        bake_ao=False,
    )

    # ---- Arched muscular neck with continuous dorsal mane ----
    s.seg(
        'spine_4',
        Sculpt().box((-3, 3), (29, 40), (11, 17), coat).box(0, (41, 42), (12, 19), mane),
        pad=2,
        bake_ao=False,
    )
    s.seg(
        'spine_5',
        Sculpt().box((-2, 2), (33, 43), (16, 21), coat).box(0, (44, 45), (17, 23), mane),
        pad=3,
        bake_ao=False,
    )
    s.seg(
        'spine_6',
        barrel([((20, 26), 38, 46, 2)], coat).box(0, (47, 48), (21, 27), mane),
        pad=1,
        bake_ao=False,
    )

    # ---- Head: defined cheeks, smooth tapered nasal bridge, continuous blaze, compact jaw & tall ears ----
    profile = [
        ((24, 27), 41, 47, 3),
        ((28, 29), 40, 46, 3),
        ((30, 31), 40, 45, 2),
        ((32, 32), 39, 44, 2),
        ((33, 33), 38, 43, 2),
        ((34, 35), 37, 42, 2),
        ((36, 37), 37, 41, 2),
    ]
    skull = barrel(profile[:2], coat)
    for depth, base, top, width in profile[2:]:
        skull.box((-width, width), (39, min(43, top - 1)), depth, coat)
        skull.box((1 - width, width - 1), (base, top), depth, coat)
    velvet = vox('leather', 0.25, mottle=False)
    skull.paint((-2, 2), (37, 41), (36, 37), velvet)
    for depth, _, top, _ in profile[1:-1]:
        skull.paint(0, top, depth, white)
    skull.box(0, 48, (24, 26), mane)
    skull.eyes(3, 45, 28, eye, facing='side').both(1, 40, 37, eye)
    skull.paint_both(3, 44, 28, vox('primary', 0.25))
    s.seg('head', skull, pad=2, role='head', bake_ao=False)

    ear = Sculpt().box((1, 2), (46, 50), (27, 29), coat).box(2, (51, 52), 28, bay)
    s.seg('ear_1_l', ear, mirror_bone='ear_1_r', pad=3, bake_ao=False)
    s.seg(
        'mouth',
        Sculpt().box((-1, 1), (38, 39), (30, 33), bay).box((-1, 1), 37, (33, 35), velvet),
        pad=1,
        bake_ao=False,
    )

    # ---- Front legs: sloped shoulder, tapered forearm, straight 2x2 cannon, white sock & dark horn hoof ----
    s.seg(
        'front_scapula_l',
        Sculpt().box(3, (31, 36), (11, 15), coat).box((4, 5), (24, 33), (13, 19), coat),
        mirror_bone='front_scapula_r',
        pad=0,
        bake_ao=False,
    )
    s.seg(
        'front_leg_upper_l',
        Sculpt().box((4, 5), (18, 24), (14, 17), coat).box((3, 4), (13, 18), (14, 16), coat),
        mirror_bone='front_leg_upper_r',
        pad=2,
        role='front_upper',
        bake_ao=False,
    )
    s.seg(
        'front_leg_lower_l',
        Sculpt().box((3, 4), (5, 13), (14, 15), coat),
        mirror_bone='front_leg_lower_r',
        role='front_lower',
        bake_ao=False,
    )
    s.seg(
        'front_leg_ankle_l',
        Sculpt().box((3, 4), (2, 5), (14, 15), white),
        mirror_bone='front_leg_ankle_r',
        pad=1,
        role='front_lower',
        bake_ao=False,
    )
    s.seg(
        'front_leg_foot_l',
        Sculpt().box((3, 4), (0, 1), (14, 16), hoof),
        mirror_bone='front_leg_foot_r',
        role='front_paw',
        bake_ao=False,
    )

    # ---- Hind legs: full quarter, diagonal gaskin, straight 2x2 cannon, white sock & dark horn hoof ----
    s.seg(
        'back_leg_pelvis_l',
        Sculpt().box((4, 5), (28, 35), (-15, -8), coat),
        mirror_bone='back_leg_pelvis_r',
        pad=3,
        bake_ao=False,
    )
    s.seg(
        'back_leg_upper_l',
        Sculpt().box((4, 5), (22, 29), (-16, -10), coat),
        mirror_bone='back_leg_upper_r',
        pad=2,
        role='back_upper',
        bake_ao=False,
    )
    s.seg(
        'back_leg_lower_l',
        Sculpt().box((4, 5), (17, 23), (-16, -10), coat).box((4, 5), (13, 17), (-19, -14), coat),
        mirror_bone='back_leg_lower_r',
        pad=1,
        role='back_upper',
        bake_ao=False,
    )
    s.seg(
        'back_leg_ankle_l',
        Sculpt().box((4, 5), (4, 13), (-19, -18), coat),
        mirror_bone='back_leg_ankle_r',
        role='back_lower',
        bake_ao=False,
    )
    s.seg(
        'back_leg_foot_l',
        Sculpt().box((4, 5), (2, 4), (-19, -18), white),
        mirror_bone='back_leg_foot_r',
        pad=1,
        role='back_lower',
        bake_ao=False,
    )
    s.seg(
        'back_leg_toe_l',
        Sculpt().box((4, 5), (0, 1), (-19, -17), hoof),
        mirror_bone='back_leg_toe_r',
        role='back_paw',
        bake_ao=False,
    )

    # ---- Sleek arched dock & tapered flowing tail ----
    s.seg('tail_1', Sculpt().box(0, (33, 35), (-23, -15), mane), pad=1, bake_ao=False)
    s.seg('tail_2', Sculpt().box(0, (31, 35), (-31, -23), mane), bake_ao=False)
    s.seg('tail_3', Sculpt().box(0, (31, 35), (-39, -30), mane), pad=1, bake_ao=False)
    s.seg('tail_4', Sculpt().box(0, (32, 34), (-45, -38), mane), bake_ao=False)
    return s


def _build_wolf():
    s = CreatureSculptor(
        RIG_DIR / 'quaternius_wolf.glb', 'body_timber_wolf', 0.040, ANIMAL_PALETTES['wolf'], rig_scale=0.42
    )
    coat, ruff, pale, dark, cheek = vox('primary'), vox('secondary'), vox('skin'), vox('hair'), vox('trim')
    pad_c = vox('leather')
    nose = vox('visor', -0.25, mottle=False)

    s.seg('Back', barrel([((-11, -9), 17, 23, 3), ((-8, -3), 15, 24, 4)], coat), role='trunk', bake_ao=False)
    s.seg('Torso', barrel([((-4, 3), 17, 23, 3)], coat), pad=1, role='trunk', bake_ao=False)
    s.seg(
        'Torso2',
        barrel([((2, 9), 14, 24, 5)], coat).paint((-4, 4), (23, 24), (3, 9), ruff),
        role='trunk',
        bake_ao=False,
    )
    s.seg(
        'Torso3',
        barrel([((8, 13), 14, 25, 4)], cheek).paint((-3, 3), (14, 18), (10, 13), pale),
        pad=1,
        role='trunk',
        bake_ao=False,
    )
    s.seg(
        'Neck1',
        barrel([((11, 15), 17, 26, 4)], coat).both(4, (19, 21), (10, 13), cheek),
        pad=3,
        bake_ao=False,
    )
    s.seg(
        'Neck2',
        barrel([((14, 17), 18, 25, 3)], coat).both(3, (19, 21), (14, 17), cheek),
        pad=1,
        bake_ao=False,
    )
    s.seg('Neck3', barrel([((16, 20), 19, 25, 3)], coat), bake_ao=False)
    skull = barrel([((18, 21), 20, 26, 3), ((22, 23), 21, 25, 2)], coat)
    skull.both(3, (20, 22), (18, 21), cheek).box((-1, 1), (21, 23), (24, 26), pale)
    skull.box((-1, 1), 23, (26, 27), nose).eyes(2, 24, 23, nose)
    skull.both(1, 24, 23, vox('accent', mottle=False))
    skull.box((-1, 1), 21, (24, 25), dark)
    s.seg('Head', ears(skull, 2, 26, 19, ruff, cheek, dark), pad=1, role='head', bake_ao=True)
    s.seg(
        'FrontShoulder.L',
        Sculpt().box(2, (16, 17), (9, 10), coat),
        mirror_bone='FrontShoulder.R',
        pad=2,
        bake_ao=False,
    )
    s.seg(
        'FrontUpperLeg.L',
        Sculpt().box((3, 4), (11, 17), (8, 11), coat).paint((3, 4), (15, 17), (8, 11), ruff),
        mirror_bone='FrontUpperLeg.R',
        pad=2,
        role='front_upper',
        bake_ao=False,
    )
    s.seg(
        'FrontLowerLeg.L',
        Sculpt().box((3, 4), (1, 11), (9, 10), pale).paint((3, 4), (8, 11), (9, 10), coat),
        mirror_bone='FrontLowerLeg.R',
        role='front_lower',
        bake_ao=False,
    )
    s.seg(
        'IKFrontLeg.L',
        Sculpt().box((3, 4), 0, (9, 12), pad_c).box((3, 4), 1, (11, 12), pale),
        mirror_bone='IKFrontLeg.R',
        role='front_paw',
        bake_ao=False,
    )

    s.seg(
        'BackShoulder.L',
        Sculpt().box(2, (18, 19), (-7, -6), coat),
        mirror_bone='BackShoulder.R',
        pad=1,
        bake_ao=False,
    )
    s.seg(
        'BackLeg.L',
        Sculpt().box((3, 4), (13, 20), (-9, -3), coat),
        mirror_bone='BackLeg.R',
        pad=2,
        role='back_upper',
        bake_ao=False,
    )
    s.seg(
        'BackUpperLeg.L',
        Sculpt()
        .box((3, 4), (12, 14), (-7, -3), coat)
        .box((3, 4), (10, 12), (-10, -6), coat)
        .box((3, 4), (8, 10), (-13, -9), coat),
        mirror_bone='BackUpperLeg.R',
        pad=1,
        role='back_upper',
        bake_ao=False,
    )
    s.seg(
        'BackLowerLeg.L',
        Sculpt().box((3, 4), (1, 8), (-13, -12), pale),
        mirror_bone='BackLowerLeg.R',
        role='back_lower',
        bake_ao=False,
    )
    s.seg(
        'IKBackLeg.L',
        Sculpt().box((3, 4), 0, (-13, -10), pad_c).box((3, 4), 1, (-11, -10), pale),
        mirror_bone='IKBackLeg.R',
        role='back_paw',
        bake_ao=False,
    )

    s.seg('Tail1', Sculpt().box(0, (19, 21), (-10, -8), coat), pad=1, bake_ao=False)
    s.seg('Tail2', Sculpt().box((-1, 1), (18, 21), (-14, -10), ruff), bake_ao=False)
    s.seg('Tail3', Sculpt().box((-1, 1), (16, 19), (-17, -13), coat), pad=1, bake_ao=False)
    s.seg('Tail4', Sculpt().box((-1, 1), (14, 16), (-19, -16), coat), bake_ao=False)
    s.seg('Tail5', Sculpt().box((-1, 1), (13, 15), (-21, -18), coat), pad=1, bake_ao=False)
    s.seg('Tail6', Sculpt().box((-1, 1), (12, 14), (-24, -20), ruff), bake_ao=False)
    s.seg('Tail7', Sculpt().box((-1, 1), (11, 13), (-27, -23), ruff), pad=1, bake_ao=False)
    s.seg('Tail8', Sculpt().box(0, (11, 13), (-29, -26), dark), bake_ao=False)
    return s


def _build_corgi():
    s = CreatureSculptor(
        RIG_DIR / 'gobkit_corgi.glb', 'body_pembroke_corgi', 0.020, ANIMAL_PALETTES['corgi'], rig_scale=0.0014
    )
    ginger, caramel, white, pink = vox('primary'), vox('secondary'), vox('skin'), vox('trim')
    eye = vox('visor', -0.25, mottle=False)

    body = barrel(
        [
            ((-12, -11), 7, 12, 3),
            ((-10, -5), 5, 14, 5),
            ((-4, 0), 6, 13, 4),
            ((1, 2), 5, 14, 6),
            ((3, 5), 5, 14, 7),
            ((6, 8), 6, 14, 5),
            (9, 8, 14, 3),
        ],
        ginger,
    )
    body.paint((-3, 3), (6, 14), (6, 9), white).paint((-2, 2), (5, 7), (2, 6), white)
    body.paint((-5, 5), (11, 14), (-11, -6), caramel).paint((-4, 4), (12, 14), (-5, 1), caramel)
    s.seg('Spine', body, role='trunk', bake_ao=False)
    skull = barrel([((3, 5), 13, 20, 3), ((6, 9), 12, 21, 5), (10, 13, 20, 4), (11, 14, 20, 3)], ginger)
    skull.paint((-5, 5), (12, 15), (7, 11), white).paint(0, (16, 20), (9, 11), white)
    skull.box((-2, 2), (13, 15), (11, 13), white).box((-1, 1), 15, 14, eye)
    skull.box(0, 12, (12, 13), pink).eyes((2, 3), (17, 18), 11, eye)
    skull.both(2, 18, 11, vox('skin', 0.5, mottle=False)).box((-1, 1), 14, (13, 14), white)
    s.seg('Spine', skull, pad=1, role='head', bake_ao=False)
    ear = Sculpt().box((2, 5), (19, 21), (5, 6), ginger).box((3, 6), (22, 23), 5, ginger)
    ear.box((4, 6), 24, 5, ginger).box((5, 6), 25, 5, ginger).box(6, 26, 5, caramel)
    ear.paint((3, 4), (20, 21), 6, pink).paint((4, 5), (22, 23), 5, pink)
    s.seg('LeftEar', ear, mirror_bone='RightEar', pad=2, bake_ao=False)
    s.seg(
        'Tail',
        Sculpt()
        .box((-2, 2), (11, 14), (-14, -11), ginger)
        .box((-1, 1), (12, 14), (-11, -7), ginger)
        .box((-1, 1), (12, 14), -15, white),
        pad=2,
        bake_ao=False,
    )
    for bone, right, z, role in [
        ('LeftLegF', 'RightLegF', 4, 'front'),
        ('LeftLegB', 'RightLegB', -6, 'back'),
    ]:
        haunch = Sculpt().box((3, 5), (3, 9), (z - 1, z + 2), ginger)
        haunch.box((4, 6), (6, 10), (z - 2, z + 1), ginger)
        s.seg(bone, haunch, mirror_bone=right, pad=2, role=role + '_upper', bake_ao=False)
        s.seg(
            bone,
            Sculpt().box((4, 5), (1, 5), (z, z + 1), ginger).paint((4, 5), (1, 2), (z, z + 1), white),
            mirror_bone=right,
            pad=1,
            role=role + '_lower',
            bake_ao=False,
        )
        s.seg(
            bone,
            Sculpt().box((4, 5), 0, (z, z + 3), white).box((4, 5), 1, (z + 2, z + 3), white),
            mirror_bone=right,
            role=role + '_paw',
            bake_ao=False,
        )
    return s


def _build_pug():
    s = CreatureSculptor(
        RIG_DIR / 'run_chonky_pug_unpacked.glb', 'body_chonky_pug', 0.020, ANIMAL_PALETTES['pug'], rig_scale=0.53
    )
    fawn, pale, wrinkle, mask, shade = (
        vox('primary'),
        vox('skin'),
        vox('secondary'),
        vox('hair'),
        vox('detail'),
    )
    collar = vox('accent', -0.125)
    tongue = vox('trim')
    pad_c = vox('leather')
    eye = vox('visor', -0.25, mottle=False)

    s.seg('hips', barrel([((-14, -12), 10, 17, 4), ((-11, -5), 8, 19, 6)], fawn), role='trunk', bake_ao=False)
    s.seg('spine', barrel([((-6, 1), 9, 19, 5)], fawn), pad=1, role='trunk', bake_ao=False)
    s.seg(
        'chest',
        barrel([((-1, 4), 6, 19, 7), ((5, 7), 8, 19, 5)], fawn).paint((-5, 5), (7, 14), (3, 7), pale),
        role='trunk',
        bake_ao=False,
    )
    s.seg('neck', barrel([((4, 9), 14, 20, 4)], pale).paint((-4, 4), 16, (4, 9), collar), pad=3, bake_ao=False)
    skull = barrel([((5, 7), 17, 24, 4), ((8, 11), 16, 25, 5), ((12, 13), 17, 24, 5)], fawn)
    skull.paint((-5, 5), (17, 22), (12, 13), wrinkle)
    skull.both((2, 4), (20, 22), 13, mask)
    skull.box((-2, 2), (17, 19), 14, mask).both((1, 2), 18, 15, mask)
    skull.box((-1, 1), 20, 14, eye).eyes((3, 4), (21, 22), 13, eye).both(
        3, 22, 13, vox('skin', 0.5, mottle=False)
    )
    skull.both((2, 3), 23, 13, wrinkle).box((-1, 1), 23, 13, wrinkle)
    skull.both((3, 6), (23, 24), (7, 9), mask).both(5, 22, (7, 8), mask).both(5, 21, 7, mask)
    skull.both(4, (18, 19), (11, 12), vox('detail')).both(1, 22, 13, wrinkle)
    s.seg('head', skull, pad=2, role='head', bake_ao=True)
    s.seg('jaw', Sculpt().box((-2, 2), 16, (11, 14), mask).box(1, 16, 15, tongue), bake_ao=False)
    for bone, right, z, role in [
        ('upperarm.L', 'upperarm.R', 5, 'front'),
        ('thigh.L', 'thigh.R', -9, 'back'),
    ]:
        ham = Sculpt().box((3, 5), (5, 15), (z - 1, z + 1), fawn)
        ham.box((4, 6), (10, 15), (z - 2, z + 2), fawn).box((4, 5), (6, 9), (z - 1, z + 1), shade)
        s.seg(bone, ham, mirror_bone=right, pad=1, role=role + '_upper', bake_ao=False)
    s.seg(
        'forearm.L',
        Sculpt().box((4, 5), (1, 7), (4, 5), fawn),
        mirror_bone='forearm.R',
        pad=2,
        role='front_lower',
        bake_ao=False,
    )
    s.seg(
        'hand.L',
        Sculpt().box((4, 5), 0, (4, 7), pad_c).box((4, 5), 1, (6, 7), pale),
        mirror_bone='hand.R',
        role='front_paw',
        bake_ao=False,
    )
    s.seg(
        'shin.L',
        Sculpt().box((4, 5), (1, 7), (-9, -8), fawn),
        mirror_bone='shin.R',
        pad=2,
        role='back_lower',
        bake_ao=False,
    )
    s.seg(
        'foot.L',
        Sculpt().box((4, 5), 0, (-9, -6), pad_c).box((4, 5), 1, (-7, -6), pale),
        mirror_bone='foot.R',
        role='back_paw',
        bake_ao=False,
    )
    s.seg('tail.1', Sculpt().box((-1, 1), (16, 19), (-14, -12), shade), pad=1, bake_ao=False)
    s.seg('tail.2', Sculpt().box((-1, 1), (18, 20), (-16, -13), fawn), bake_ao=False)
    curl = Sculpt().box((-1, 1), (19, 22), (-17, -15), fawn)
    curl.box((-1, 1), (22, 23), (-16, -12), pale).box((-1, 1), (20, 22), (-12, -11), pale)
    s.seg('tail.3', curl, pad=1, bake_ao=False)
    return s


def _build_gsd():
    s = CreatureSculptor(
        RIG_DIR / 'run_facet_gsd_unpacked.glb',
        'body_k9_gsd',
        0.040,
        ANIMAL_PALETTES['gsd'],
        forward='+X',
        rig_scale=1.00,
    )
    tan, light, black, brow = vox('primary'), vox('skin'), vox('hair'), vox('detail')
    leather = vox('leather')
    badge = vox('trim', mottle=False)
    nose = vox('visor', -0.25, mottle=False)

    s.seg(
        'pelvis',
        barrel([((-12, -10), 13, 18, 3), ((-9, -4), 11, 19, 4)], tan).paint(
            (-4, 4), (16, 19), (-12, -4), black
        ),
        role='trunk',
        bake_ao=False,
    )
    s.seg(
        'spine',
        barrel([((-6, 1), 13, 20, 3)], tan).paint((-3, 3), (16, 20), (-6, 1), black),
        pad=1,
        role='trunk',
        bake_ao=False,
    )
    s.seg(
        'chest',
        barrel([((-1, 4), 11, 21, 4), ((5, 7), 12, 20, 3)], tan)
        .paint((-4, 4), (17, 21), (-1, 2), black)
        .paint((-4, 4), (19, 21), (3, 5), black)
        .paint((-2, 2), (11, 15), (4, 7), light),
        role='trunk',
        bake_ao=False,
    )
    s.seg(
        'neck',
        barrel([((5, 8), 15, 23, 3), ((9, 10), 18, 24, 2)], tan)
        .paint((-3, 3), 19, (5, 8), leather)
        .box(0, 18, 10, badge),
        pad=1,
        bake_ao=False,
    )
    skull = barrel([((7, 10), 21, 26, 3), ((11, 12), 21, 25, 2)], tan)
    skull.paint((-2, 2), (21, 23), (10, 12), black)
    skull.box((-1, 1), (22, 23), (13, 15), black).box((-1, 1), 23, 16, nose)
    skull.both(2, 22, (10, 12), brow)
    skull.eyes(2, 24, 12, vox('visor', mottle=False)).both(2, 25, 12, tan)
    skull.both((1, 3), (26, 27), (8, 9), tan).both((2, 3), (28, 29), 8, brow).both(2, 28, 8, black).both(
        3, 30, (7, 8), brow
    ).both(3, 31, 7, brow)
    s.seg('head', skull, pad=2, role='head', bake_ao=False)
    s.seg('jaw', Sculpt().box((-1, 1), (20, 21), (11, 14), brow).box(0, 21, 15, leather), bake_ao=False)
    s.seg(
        'upperarm.L',
        Sculpt().box((1, 3), (11, 16), (2, 5), tan).box((2, 3), (9, 11), (2, 4), light),
        mirror_bone='upperarm.R',
        pad=2,
        role='front_upper',
        bake_ao=False,
    )
    s.seg(
        'forearm.L',
        Sculpt().box((2, 3), (2, 10), (3, 4), light),
        mirror_bone='forearm.R',
        role='front_lower',
        bake_ao=False,
    )
    s.seg(
        'wrist.L',
        Sculpt().box((2, 3), (1, 2), (3, 4), light),
        mirror_bone='wrist.R',
        pad=1,
        role='front_lower',
        bake_ao=False,
    )
    s.seg(
        'paw.L',
        Sculpt().box((2, 3), 0, (3, 6), leather).box((2, 3), 1, (5, 6), light),
        mirror_bone='paw.R',
        role='front_paw',
        bake_ao=False,
    )
    s.seg(
        'thigh.L',
        Sculpt().box((2, 4), (10, 16), (-10, -6), tan).box((2, 3), (7, 9), (-8, -6), tan),
        mirror_bone='thigh.R',
        pad=2,
        role='back_upper',
        bake_ao=False,
    )
    s.seg(
        'shin.L',
        Sculpt().box((2, 3), (3, 8), (-8, -7), light),
        mirror_bone='shin.R',
        role='back_lower',
        bake_ao=False,
    )
    s.seg(
        'hock.L',
        Sculpt().box((2, 3), (1, 3), (-8, -7), light),
        mirror_bone='hock.R',
        pad=1,
        role='back_lower',
        bake_ao=False,
    )
    s.seg(
        'hind_paw.L',
        Sculpt().box((2, 3), 0, (-8, -5), leather).box((2, 3), 1, (-6, -5), light),
        mirror_bone='hind_paw.R',
        role='back_paw',
        bake_ao=False,
    )
    s.seg(
        'tail',
        Sculpt()
        .box(0, (15, 17), (-13, -10), black)
        .box(0, (13, 15), (-16, -13), black)
        .box(0, (11, 13), (-19, -16), black)
        .box(0, (9, 11), (-21, -19), brow)
        .box(0, (8, 9), (-23, -21), brow),
        pad=1,
        bake_ao=False,
    )
    return s


def _build_cat():
    s = CreatureSculptor(
        RIG_DIR / 'run_facet_cat_unpacked.glb',
        'body_ginger_cat',
        0.020,
        ANIMAL_PALETTES['cat'],
        forward='+X',
        rig_scale=0.85,
    )
    ginger, stripe, white, pink = vox('primary'), vox('secondary'), vox('skin'), vox('trim')
    collar = vox('leather')
    bell = vox('metal', 0.375, mottle=False)
    eye = vox('accent', 0.25, mottle=False)
    pad_c = vox('hair')

    s.seg(
        'pelvis',
        barrel([((-12, -10), 9, 14, 3), ((-9, -4), 7, 15, 4)], ginger).paint(
            (-4, 4), (10, 15), (-8, -7), stripe
        ),
        role='trunk',
        bake_ao=False,
    )
    s.seg(
        'spine',
        barrel([((-5, 2), 9, 14, 3)], ginger).paint((-3, 3), (10, 14), -2, stripe),
        pad=1,
        role='trunk',
        bake_ao=False,
    )
    s.seg(
        'chest',
        barrel([((1, 5), 7, 15, 4), ((6, 7), 8, 15, 3)], ginger)
        .paint((-3, 3), (7, 13), (5, 7), white)
        .paint((-4, 4), (10, 15), (2, 3), stripe),
        pad=3,
        role='trunk',
        bake_ao=False,
    )
    s.seg(
        'neck',
        barrel([((5, 9), 11, 18, 2)], white).paint((-2, 2), 14, (5, 9), collar).box(0, 13, 10, bell),
        pad=1,
        bake_ao=False,
    )
    skull = barrel([((6, 8), 15, 21, 3), ((9, 11), 15, 22, 3), (12, 16, 20, 3)], ginger)
    skull.paint((-3, 3), (15, 17), (10, 12), white)
    skull.both((1, 2), 17, 13, white).box(0, 17, 13, pink).box((-1, 1), 16, 13, white)
    skull.eyes(2, 19, 12, vox('visor', mottle=False)).both(1, 19, 12, eye)
    skull.paint(0, 22, (9, 11), stripe).both(2, 20, 12, stripe).both(3, 17, 11, stripe)
    s.seg('head', skull, pad=2, role='head', bake_ao=True)
    ear = Sculpt().box((1, 3), (21, 22), (8, 9), ginger).box((2, 3), 23, 8, ginger)
    ear.box(3, 24, 8, ginger).box(2, 22, 9, pink).box((2, 3), 23, 9, pink)
    s.seg('ear.L', ear, mirror_bone='ear.R', pad=1, bake_ao=False)
    s.seg(
        'upperarm.L',
        Sculpt().box((2, 3), (7, 12), (5, 7), ginger),
        mirror_bone='upperarm.R',
        pad=2,
        role='front_upper',
        bake_ao=False,
    )
    s.seg(
        'forearm.L',
        Sculpt()
        .box((2, 3), (1, 7), (5, 6), ginger)
        .paint((2, 3), 5, (5, 6), stripe)
        .paint((2, 3), (1, 2), (5, 6), white),
        mirror_bone='forearm.R',
        role='front_lower',
        bake_ao=False,
    )
    s.seg(
        'wrist.L',
        Sculpt().box((2, 3), 0, (5, 7), pad_c).box((2, 3), 1, 7, white),
        mirror_bone='wrist.R',
        role='front_paw',
        bake_ao=False,
    )
    s.seg(
        'thigh.L',
        Sculpt()
        .box((2, 3), (4, 12), (-8, -6), ginger)
        .box((2, 4), (8, 13), (-10, -7), ginger)
        .paint((2, 3), 7, (-9, -7), stripe),
        mirror_bone='thigh.R',
        pad=2,
        role='back_upper',
        bake_ao=False,
    )
    s.seg(
        'shin.L',
        Sculpt().box((2, 3), (1, 4), (-8, -7), ginger).paint((2, 3), (1, 2), (-8, -7), white),
        mirror_bone='shin.R',
        role='back_lower',
        bake_ao=False,
    )
    s.seg(
        'hock.L',
        Sculpt().box((2, 3), 0, (-8, -6), pad_c).box((2, 3), 1, (-6), white),
        mirror_bone='hock.R',
        role='back_paw',
        bake_ao=False,
    )
    tail = (
        ('tail.0', (13, 15), (-13, -10), ginger),
        ('tail.1', (14, 16), (-15, -12), stripe),
        ('tail.2', (16, 18), (-15, -14), ginger),
        ('tail.3', (18, 20), (-15, -14), stripe),
        ('tail.4', (20, 22), (-15, -14), ginger),
        ('tail.5', (22, 24), (-15, -14), stripe),
        ('tail.6', (24, 26), (-15, -13), ginger),
        ('tail.7', (26, 27), (-14, -12), white),
    )
    for index, (bone, rows, depth, code) in enumerate(tail):
        s.seg(bone, Sculpt().box(0, rows, depth, code), pad=1 - index % 2, bake_ao=False)
    return s


ANIMAL_SPECS = (
    ('fox', 'Red Fox', 'creature_red_fox', 'trot', _build_fox),
    ('horse', 'Chestnut Horse', 'creature_chestnut_horse', 'Walk', _build_horse),
    ('wolf', 'Timber Wolf', 'creature_timber_wolf', 'AnimalArmature|Idle', _build_wolf),
    ('corgi', 'Pembroke Corgi', 'creature_pembroke_corgi', 'walk', _build_corgi),
    ('pug', 'Chonky Pug', 'creature_chonky_pug', 'trot', _build_pug),
    ('gsd', 'K9 Shepherd', 'creature_k9_gsd', 'trot', _build_gsd),
    ('cat', 'Ginger Cat', 'creature_ginger_cat', 'trot', _build_cat),
)


def build_all_animals(characters_dir: Path):
    """Build all seven Astra quadrupeds into `characters_dir` and return `(parts, presets, creature_rigs)`."""
    parts = []
    presets = []
    creature_rigs = []

    for rig_id, label, preset_id, default_clip, builder_fn in ANIMAL_SPECS:
        sculptor = builder_fn()
        rel_file = f'{rig_id}-rig.glb'
        stats = sculptor.export_glb(characters_dir / rel_file)
        colliders = _measure_world_colliders(sculptor)
        contract = vk.load_json(f'{rig_id}-rig.json')

        parts.append({
            'id': stats['name'],
            'pack': PACK,
            'leaf': 'characters',
            'relativePath': rel_file,
            'nodeName': stats['name'],
            'slot': 'body',
            'label': label,
            'triangles': stats['tris'],
            'rigId': rig_id,
            'rules': {'hidesHair': False, 'hidesLegsUpper': False},
            'ragdollColliders': colliders,
        })

        presets.append({
            'id': preset_id,
            'pack': PACK,
            'label': label,
            'rigId': rig_id,
            'clip': default_clip,
            'body': stats['name'],
            'head': None,
            'hair': None,
            'torso': None,
            'legs': None,
            'headwear': None,
            'back': None,
            'heldRight': None,
            'heldLeft': None,
            'palette': copy.deepcopy(ANIMAL_PALETTES[rig_id]),
            'proportions': {
                'height': 1.0,
                'shoulderWidth': 1.0,
                'torsoBulk': 1.0,
                'waistScale': 1.0,
                'headScale': 1.0,
                'limbThickness': 1.0,
            },
        })

        creature_rigs.append({
            'rigId': rig_id,
            'rigModelPath': rel_file,
            'clips': [c['name'] for c in contract['clips']],
        })

    return parts, presets, creature_rigs
