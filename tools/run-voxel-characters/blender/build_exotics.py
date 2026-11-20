"""Build the five non-mammal voxel creatures (aquatic, avian, serpent, dragon, kaiju) for run-cubix-creatures.

Each creature is sculpted with `CreatureSculptor` (`blender/creature_kit.py`) onto its Chisel Monsters
source rig (`assets/source/creatures/chisel_*.glb`), audited for rigid weights, world lattice, normals,
dark-albedo floor, and clip gap/stretch, and exported as `<rig_id>-rig.glb`.
"""

from __future__ import annotations

import copy
from pathlib import Path

from build_animals import RIG_DIR, _measure_world_colliders, barrel
from creature_kit import CreatureSculptor, Sculpt
from voxchar import vox

PACK = 'creatures'

EXOTIC_PALETTES = {
    'aquatic': {
        'skin': '#dce7ef',      # shark belly white-silver
        'hair': '#263442',      # deep slate dorsal accents
        'primary': '#4d7393',   # ocean steel-blue hide
        'secondary': '#35536d', # darker dorsal stripe
        'accent': '#38bdf8',    # bioluminescent eye/gill accent
        'metal': '#b8c8d8',
        'trim': '#8cb4d0',      # fin edge highlight
        'leather': '#2e4152',
        'visor': '#141c24',     # pupil (mottle=False)
        'detail': '#e6eef5',    # teeth
    },
    'avian': {
        'skin': '#f0ece2',      # snowy eagle head & tail feathers
        'hair': '#3e2d24',      # dark wing tips
        'primary': '#7b533b',   # chestnut-brown plumage
        'secondary': '#573928', # dark wing coverts
        'accent': '#f5b82e',    # golden beak & talons
        'metal': '#d4dde6',
        'trim': '#d4a36e',      # chest feather trim
        'leather': '#4b3426',
        'visor': '#1a1614',     # pupil (mottle=False)
        'detail': '#e8c488',
    },
    'serpent': {
        'skin': '#dfd0a2',      # pale belly scutes
        'hair': '#2b3b2c',      # dark hood pattern
        'primary': '#4e8a48',   # emerald cobra scales
        'secondary': '#346134', # dark dorsal bands
        'accent': '#ff4d4d',    # forked tongue / warning eye
        'metal': '#a9c896',
        'trim': '#e5b842',      # cobra hood spectacle gold
        'leather': '#3b4a32',
        'visor': '#181e18',     # pupil (mottle=False)
        'detail': '#f2ede0',    # fangs
    },
    'dragon': {
        'skin': '#e5b278',      # armored belly plates
        'hair': '#452424',      # dark horn base
        'primary': '#b83c2c',   # crimson dragon scales
        'secondary': '#7d261e', # deep ridge plates
        'accent': '#ff8c24',    # glowing ember eyes & throat
        'metal': '#d8b454',     # golden horns & claws
        'trim': '#d45a3a',      # wing membrane leather
        'leather': '#5c2a22',
        'visor': '#1b1210',     # pupil (mottle=False)
        'detail': '#f0d8a8',    # teeth
    },
    'kaiju': {
        'skin': '#a4b882',      # underbelly & jaw scutes
        'hair': '#323f35',      # dark dorsal spines
        'primary': '#58784e',   # mossy tyrant hide
        'secondary': '#3d5438', # armored flank plates
        'accent': '#ffb428',    # fierce amber eye
        'metal': '#c8d0be',     # teeth & toe claws
        'trim': '#7b9968',      # ridge highlights
        'leather': '#3f4a3c',
        'visor': '#191d19',     # pupil (mottle=False)
        'detail': '#e8e4d0',
    },
}


def _build_aquatic():
    s = CreatureSculptor(
        RIG_DIR / 'chisel_aquatic.glb',
        'body_reef_shark',
        0.04,
        EXOTIC_PALETTES['aquatic'],
        quadruped=False,
        floating=True,
    )
    # In chisel_aquatic.glb, the rest pose leaves `jaw` hinged open ~41 deg below closed; retargeting the
    # leaf bone to its closed Swim/Idle orientation keeps the closed mandible axis-aligned without jutting.
    s.retarget_rest_rotation('jaw', (-0.34775, 0.0, 0.0, 0.93759))

    hide = vox('primary')
    dorsal = vox('secondary')
    belly = vox('skin')
    fin_trim = vox('trim')
    gills = vox('hair', -0.25, mottle=False)
    maw = vox('visor', -0.25, mottle=False)
    teeth = vox('detail', 0.25, mottle=False)
    pupil = vox('visor', mottle=False)
    iris = vox('accent', 0.25, mottle=False)

    # Streamlined fuselage center + towering swept dorsal fin on pelvis
    pelvis = (
        barrel([((-3, -1), 12, 20, 3), ((0, 8), 11, 21, 3)], hide)
        .paint((-2, 2), (11, 13), (0, 8), belly)
        .paint((-2, 2), (12, 13), (-3, -1), belly)
        .paint((-2, 2), (20, 21), (0, 8), dorsal)
        .paint((-1, 1), 20, (-3, -1), dorsal)
        .box(0, (22, 23), (-2, 5), dorsal)
        .box(0, (24, 25), (-3, 3), dorsal)
        .box(0, (26, 28), (-4, 0), dorsal)
        .box(0, (29, 30), (-6, -2), fin_trim)
    )
    s.seg('pelvis', pelvis, bake_ao=False)

    # Muscled gill shoulder on neck
    neck = (
        barrel([((6, 11), 12, 20, 3), ((12, 14), 13, 20, 3)], hide)
        .paint((-2, 2), (12, 14), (6, 11), belly)
        .paint((-2, 2), (13, 14), (12, 14), belly)
        .paint((-2, 2), 20, (6, 14), dorsal)
        .both(3, (15, 18), 7, gills)
        .both(3, (15, 18), 9, gills)
        .both(3, (15, 18), 11, gills)
    )
    s.seg('neck', neck, pad=1, bake_ao=False)

    # Sleek bullet snout + fierce brow + dark mouth roof + alternating serrated upper fangs
    skull = (
        barrel([((12, 15), 14, 20, 3), ((16, 18), 16, 20, 2)], hide)
        .box((-1, 1), (16, 19), (19, 21), hide)
        .box((-1, 1), (16, 18), 22, hide)
        .box(0, (17, 18), (23, 24), dorsal)
        .box(0, 17, 25, dorsal)
        .box((-2, 2), 13, (12, 14), belly)
        .box((-2, 2), (14, 15), (12, 15), belly)
        .both(2, 16, (16, 18), hide)
        .paint((-2, 2), 20, (12, 15), dorsal)
        .paint((-1, 1), 20, (16, 18), dorsal)
        .paint((-1, 1), 19, (19, 21), dorsal)
        .paint((-1, 1), 18, 22, dorsal)
        .both(2, 19, (15, 18), dorsal)
        .paint((-1, 1), 16, (16, 20), maw)
        .both(2, 15, 16, teeth)
        .both(2, 15, 18, teeth)
        .both(1, 15, 20, teeth)
        .box(0, 15, 21, teeth)
        .eyes(2, 17, 16, pupil, facing='side')
        .both(2, 17, 15, iris)
    )
    s.seg('head', skull, pad=2, bake_ao=False)

    # Compact undershot lower jaw (sculpted closed & flush on world lattice; opens cleanly in Bite)
    s.seg(
        'jaw',
        Sculpt()
        .box((-1, 1), (13, 14), (14, 20), belly)
        .both(2, 14, (15, 16), belly)
        .paint(0, 14, (16, 18), maw)
        .both(1, 15, 17, teeth)
        .both(1, 15, 19, teeth),
        pad=0,
        bake_ao=False,
    )

    # Smoothly tapered aft trunk & caudal peduncle
    s.seg(
        'spine_01',
        barrel([((-5, -1), 12, 20, 3), ((-12, -6), 13, 19, 2)], hide)
        .paint((-2, 2), (12, 13), (-5, -1), belly)
        .paint((-1, 1), 13, (-12, -6), belly)
        .paint((-1, 1), 20, (-5, -1), dorsal)
        .paint((-1, 1), 19, (-12, -6), dorsal),
        pad=1,
        bake_ao=False,
    )
    s.seg(
        'tail_01',
        barrel([((-15, -10), 13, 18, 2)], hide)
        .box((-1, 1), (13, 17), (-21, -16), hide)
        .paint((-1, 1), 13, (-21, -10), belly)
        .paint((-1, 1), 18, (-15, -10), dorsal)
        .paint(0, 17, (-21, -16), dorsal)
        .box(0, 18, (-18, -15), dorsal)
        .box(0, 19, (-19, -17), fin_trim),
        pad=2,
        bake_ao=False,
    )
    s.seg(
        'tail_02',
        Sculpt()
        .box((-1, 1), (13, 16), (-24, -19), hide)
        .box(0, (13, 15), (-30, -25), hide)
        .paint(0, 16, (-24, -19), dorsal)
        .paint(0, 15, (-30, -25), dorsal)
        .paint(0, 13, (-30, -19), belly)
        .box(0, (11, 12), (-23, -21), fin_trim),
        pad=1,
        bake_ao=False,
    )
    s.seg(
        'tail_fin',
        Sculpt()
        .box(0, (13, 16), (-31, -28), dorsal)
        .box(0, (16, 20), (-34, -30), dorsal)
        .box(0, (21, 24), (-37, -33), dorsal)
        .box(0, (25, 27), (-39, -35), fin_trim)
        .box(0, (10, 12), (-33, -30), dorsal)
        .box(0, (7, 9), (-35, -32), fin_trim),
        pad=2,
        bake_ao=False,
    )

    # Broad swept pectoral hydrofoils + sleek pelvic stabiliser fins
    s.seg(
        'fin_l',
        Sculpt()
        .box((3, 6), (11, 12), (1, 6), hide)
        .paint((3, 6), 11, (1, 6), belly)
        .box((7, 10), (10, 11), (-2, 4), hide)
        .paint((7, 10), 10, (-2, 4), belly)
        .box((11, 13), 10, (-5, 0), dorsal)
        .box((13, 14), 10, (-6, -2), fin_trim),
        mirror_bone='fin_r',
        pad=2,
        bake_ao=False,
    )
    s.seg(
        'pelvic_fin_l',
        Sculpt()
        .box((2, 4), (12, 13), (-15, -11), hide)
        .paint((2, 4), 12, (-15, -11), belly)
        .box((4, 5), 11, (-17, -14), fin_trim),
        mirror_bone='pelvic_fin_r',
        pad=1,
        bake_ao=False,
    )
    return s


def _build_avian():
    s = CreatureSculptor(
        RIG_DIR / 'chisel_avian.glb',
        'body_frost_eagle',
        0.04,
        EXOTIC_PALETTES['avian'],
        quadruped=False,
    )
    plumage = vox('primary')
    dark = vox('secondary')
    snow = vox('skin')
    bib = vox('trim')
    beak = vox('accent')
    tip = vox('hair')
    pupil = vox('visor', mottle=False)

    s.seg(
        'pelvis',
        barrel([((-5, 3), 10, 15, 3)], plumage).paint((-2, 2), (10, 11), (-4, 3), bib),
        bake_ao=False,
    )
    s.seg(
        'spine_01',
        barrel([((2, 8), 10, 16, 3)], plumage).paint((-2, 2), (10, 11), (2, 8), bib),
        pad=1,
        bake_ao=False,
    )
    s.seg(
        'chest',
        barrel([((7, 13), 10, 17, 3)], plumage).paint((-2, 2), (10, 14), (10, 13), bib),
        pad=2,
        bake_ao=False,
    )
    s.seg(
        'neck',
        Sculpt().box((-2, 2), (13, 17), (11, 16), snow),
        pad=1,
        bake_ao=False,
    )
    skull = (
        barrel([((14, 18), 15, 19, 2)], snow)
        .box((-1, 1), 14, (14, 18), snow)
        .box((-1, 1), 20, (14, 17), snow)
        .both(2, 19, (13, 14), snow)
        .box((-1, 1), (16, 17), (19, 20), beak)
        .box(0, (16, 17), (21, 22), beak)
        .box(0, 15, 22, beak)
        .eyes(2, 18, 17, pupil, facing='side')
    )
    s.seg('head', skull, pad=2, bake_ao=False)
    s.seg(
        'jaw',
        Sculpt().box((-1, 1), 13, (16, 18), snow).box((-1, 1), 14, (17, 19), snow).box(0, 15, (19, 21), beak),
        pad=0,
        bake_ao=False,
    )

    s.seg(
        'tail_01',
        Sculpt().box((-2, 2), (12, 14), (-12, -5), dark),
        pad=2,
        bake_ao=False,
    )
    s.seg(
        'tail_02',
        Sculpt()
        .box((-3, 3), (13, 14), (-17, -11), snow)
        .box((-4, 4), 14, (-19, -15), snow)
        .paint((-4, 4), 14, -19, dark),
        pad=1,
        bake_ao=False,
    )

    s.seg(
        'wing_upper_l',
        Sculpt().box((3, 15), (12, 14), (4, 9), plumage).paint((3, 15), 14, (7, 9), dark),
        mirror_bone='wing_upper_r',
        pad=1,
        bake_ao=False,
    )
    s.seg(
        'wing_mid_l',
        Sculpt().box((14, 29), (13, 15), (1, 7), plumage).paint((14, 29), 15, (5, 7), dark),
        mirror_bone='wing_mid_r',
        pad=2,
        bake_ao=False,
    )
    s.seg(
        'wing_tip_l',
        Sculpt().box((28, 35), (13, 14), (-1, 3), tip).box((34, 38), 14, (-3, 1), tip),
        mirror_bone='wing_tip_r',
        pad=1,
        bake_ao=False,
    )

    s.seg(
        'leg_upper_l',
        Sculpt().box((2, 3), (6, 11), (-4, -1), plumage),
        mirror_bone='leg_upper_r',
        pad=1,
        bake_ao=False,
    )
    s.seg(
        'leg_lower_l',
        Sculpt().box((2, 3), (1, 6), (-4, -3), beak),
        mirror_bone='leg_lower_r',
        pad=0,
        bake_ao=False,
    )
    s.seg(
        'foot_l',
        Sculpt().box((2, 3), (0, 1), (-4, 0), beak).both(0, 0, 0, 0).box((2, 3), 0, 1, beak) if False else
        Sculpt().box((2, 3), (0, 1), (-4, 0), beak).box(2, 0, 1, beak).box(3, 0, 1, beak),
        mirror_bone='foot_r',
        pad=1,
        bake_ao=False,
    )
    return s


def _build_serpent():
    s = CreatureSculptor(
        RIG_DIR / 'chisel_serpent.glb',
        'body_cobra_serpent',
        0.025,
        EXOTIC_PALETTES['serpent'],
        quadruped=False,
    )
    scale = vox('primary')
    band = vox('secondary')
    belly = vox('skin')
    gold = vox('trim')
    hood_dark = vox('hair')
    fang = vox('detail', 0.125, mottle=False)
    tongue = vox('accent', 0.25, mottle=False)
    pupil = vox('visor', mottle=False)

    # Grounded coiled base + hood root
    s.seg(
        'pelvis',
        Sculpt()
        .box((-3, 3), (0, 4), (-7, 6), scale)
        .box((-2, 2), 5, (-6, 5), band)
        .paint((-2, 2), 0, (-7, 6), belly),
        bake_ao=False,
    )
    # Flared cobra hood on neck
    s.seg(
        'neck',
        Sculpt()
        .box((-5, 5), (2, 5), (4, 10), scale)
        .box((-3, 3), (1, 6), (5, 10), scale)
        .paint((-3, 3), 1, (4, 10), belly)
        .both((2, 4), 5, (6, 7), hood_dark)
        .both(3, 5, 7, gold),
        pad=1,
        bake_ao=False,
    )
    skull = (
        Sculpt()
        .box((-3, 3), (4, 7), (9, 13), scale)
        .box((-2, 2), (5, 6), (14, 16), scale)
        .paint((-1, 1), 7, (10, 12), band)
        .eyes(3, 6, 12, pupil, facing='side')
        .both(1, 4, 15, fang)
    )
    s.seg('head', skull, pad=2, bake_ao=False)
    s.seg(
        'jaw',
        Sculpt()
        .box((-2, 2), (2, 3), (10, 15), belly)
        .box(0, 3, (16, 17), tongue)
        .both(1, 3, 18, tongue),
        pad=1,
        bake_ao=False,
    )

    # Undulating body & tail chain — each segment overlaps its parent/child joint by 1+ cell
    chain = (
        ('spine_01', (-2, 2), (0, 4), (-18, -6), 2, True),
        ('spine_02', (-2, 2), (0, 4), (-29, -17), 1, True),
        ('tail_01', (-2, 2), (0, 3), (-40, -28), 2, False),
        ('tail_02', (-1, 1), (0, 3), (-52, -39), 1, False),
        ('tail_03', (-1, 1), (0, 3), (-64, -51), 2, False),
        ('tail_04', (-1, 1), (0, 2), (-76, -63), 1, False),
        ('tail_tip', (-1, 1), (0, 2), (-82, -75), 2, False),
    )
    for bone, xs, ys, zs, pad_val, wide in chain:
        seg = Sculpt().box(xs, ys, zs, scale).paint((xs[0], xs[1]), 0, zs, belly)
        z_mid = (zs[0] + zs[1]) // 2
        seg.paint(xs, ys[1], (z_mid - 1, z_mid + 1), band)
        if wide:
            seg.paint((xs[0] + 1, xs[1] - 1), ys[1], zs, scale)
        s.seg(bone, seg, pad=pad_val, bake_ao=False)
    return s


def _build_dragon():
    s = CreatureSculptor(
        RIG_DIR / 'chisel_dragon.glb',
        'body_ember_dragon',
        0.05,
        EXOTIC_PALETTES['dragon'],
        quadruped=False,
    )
    scales = vox('primary')
    ridge = vox('secondary')
    belly = vox('skin')
    horn = vox('metal')
    membrane = vox('trim')
    ember = vox('accent', 0.25, mottle=False)
    pupil = vox('visor', mottle=False)
    teeth = vox('detail', 0.125, mottle=False)

    s.seg(
        'pelvis',
        barrel([((-11, 0), 10, 17, 3)], scales)
        .paint((-2, 2), 10, (-11, 0), belly)
        .box(0, 18, (-10, -1), ridge),
        bake_ao=False,
    )
    s.seg(
        'spine_01',
        barrel([((-2, 7), 10, 17, 3)], scales)
        .paint((-2, 2), 10, (-2, 7), belly)
        .box(0, 18, (-1, 6), ridge),
        pad=1,
        bake_ao=False,
    )
    s.seg(
        'chest',
        barrel([((5, 12), 10, 19, 4)], scales)
        .paint((-3, 3), (10, 13), (6, 12), belly)
        .box(0, 20, (6, 11), ridge),
        pad=2,
        bake_ao=False,
    )
    s.seg(
        'neck',
        Sculpt()
        .box((-2, 2), (14, 19), (11, 18), scales)
        .paint((-1, 1), 14, (11, 18), belly)
        .box(0, 20, (12, 17), ridge),
        pad=1,
        bake_ao=False,
    )
    skull = (
        barrel([((17, 22), 17, 22, 3), ((23, 26), 18, 21, 2)], scales)
        .box((-2, 2), 16, (17, 22), scales)
        .both(3, (22, 23), (15, 18), horn)
        .both(3, 24, (14, 16), horn)
        .both(2, 17, (22, 25), teeth)
        .eyes(3, 20, 20, pupil, facing='side')
        .both(3, 20, 21, ember)
    )
    s.seg('head', skull, pad=2, bake_ao=False)
    s.seg(
        'jaw',
        Sculpt().box((-2, 2), (15, 16), (18, 25), belly).both(1, 16, (21, 24), teeth),
        pad=0,
        bake_ao=False,
    )

    s.seg(
        'tail_01',
        Sculpt().box((-2, 2), (11, 15), (-19, -10), scales).box(0, 16, (-17, -12), ridge),
        pad=2,
        bake_ao=False,
    )
    s.seg(
        'tail_02',
        Sculpt().box((-2, 2), (11, 14), (-28, -18), scales).box(0, 15, (-26, -20), ridge),
        pad=1,
        bake_ao=False,
    )
    s.seg(
        'tail_03',
        Sculpt()
        .box((-1, 1), (11, 13), (-38, -27), scales)
        .box((-3, 3), (11, 13), (-41, -37), ridge),
        pad=2,
        bake_ao=False,
    )

    # Dragon wings (stepped arms + leathery membranes)
    s.seg(
        'wing_upper_l',
        Sculpt().box((4, 15), (15, 16), (7, 10), scales).box((5, 15), 14, (2, 7), membrane),
        mirror_bone='wing_upper_r',
        pad=1,
        bake_ao=False,
    )
    s.seg(
        'wing_mid_l',
        Sculpt()
        .box((14, 32), (15, 17), (9, 12), scales)
        .box((30, 32), 14, (8, 10), scales)
        .box((15, 31), 14, (3, 9), membrane),
        mirror_bone='wing_mid_r',
        pad=2,
        bake_ao=False,
    )
    s.seg(
        'wing_tip_l',
        Sculpt().box((31, 39), (14, 15), (7, 10), ridge).box((31, 37), 13, (2, 7), membrane),
        mirror_bone='wing_tip_r',
        pad=1,
        bake_ao=False,
    )

    # Forelegs & hindlegs grounded on y = 0
    s.seg(
        'foreleg_upper_l',
        Sculpt().box((3, 5), (6, 12), (5, 8), scales),
        mirror_bone='foreleg_upper_r',
        pad=1,
        bake_ao=False,
    )
    s.seg(
        'foreleg_lower_l',
        Sculpt().box((3, 4), (1, 6), (4, 6), ridge),
        mirror_bone='foreleg_lower_r',
        pad=0,
        bake_ao=False,
    )
    s.seg(
        'foreleg_foot_l',
        Sculpt().box((3, 5), (0, 1), (5, 7), ridge).both(4, 0, 8, horn) if False else
        Sculpt().box((3, 5), (0, 1), (5, 7), ridge).box(3, 0, 8, horn).box(5, 0, 8, horn),
        mirror_bone='foreleg_foot_r',
        pad=1,
        bake_ao=False,
    )
    s.seg(
        'hindleg_upper_l',
        Sculpt().box((3, 5), (6, 13), (-8, -4), scales),
        mirror_bone='hindleg_upper_r',
        pad=1,
        bake_ao=False,
    )
    s.seg(
        'hindleg_lower_l',
        Sculpt().box((3, 4), (1, 6), (-7, -5), ridge),
        mirror_bone='hindleg_lower_r',
        pad=0,
        bake_ao=False,
    )
    s.seg(
        'hindleg_foot_l',
        Sculpt().box((3, 5), (0, 1), (-6, -4), ridge).box(3, 0, -3, horn).box(5, 0, -3, horn),
        mirror_bone='hindleg_foot_r',
        pad=1,
        bake_ao=False,
    )
    return s


def _build_kaiju():
    s = CreatureSculptor(
        RIG_DIR / 'chisel_kaiju.glb',
        'body_apex_rex',
        0.05,
        EXOTIC_PALETTES['kaiju'],
        quadruped=False,
    )
    hide = vox('primary')
    plate = vox('secondary')
    belly = vox('skin')
    spine = vox('hair')
    claw = vox('metal')
    teeth = vox('detail', 0.125, mottle=False)
    eye = vox('accent', 0.25, mottle=False)
    brow = vox('secondary', -0.25)

    # Tapered predator trunk: 7-wide chamfered pelvis -> 5-wide tucked waist -> 7-wide barrel chest
    s.seg(
        'pelvis',
        barrel([((-9, -6), 11, 16, 2), ((-5, 1), 11, 17, 3)], hide)
        .paint((-2, 2), 11, (-7, 1), belly)
        .box(0, 17, (-8, -2), spine),
        bake_ao=False,
    )
    s.seg(
        'spine_01',
        barrel([((-2, 1), 14, 20, 2), ((2, 4), 16, 22, 2)], hide)
        .paint((-1, 1), (14, 16), (-1, 4), belly)
        .box(0, 21, (-1, 0), spine)
        .box(0, 22, (1, 2), spine),
        pad=1,
        bake_ao=False,
    )
    s.seg(
        'chest',
        barrel([((1, 3), 20, 26, 3), ((4, 7), 20, 27, 3)], hide)
        .paint((-2, 2), (20, 23), (5, 7), belly)
        .paint((-3, 3), (24, 26), (2, 6), plate)
        .box(0, 27, (1, 3), spine)
        .box(0, 28, (4, 6), spine),
        pad=2,
        bake_ao=False,
    )
    s.seg(
        'neck',
        barrel([((5, 7), 26, 30, 2)], hide)
        .box((-1, 1), (28, 31), (7, 9), hide)
        .paint((-1, 1), (26, 29), (7, 9), belly)
        .box(0, 31, (5, 6), spine),
        pad=1,
        bake_ao=False,
    )
    skull = (
        barrel([((6, 10), 30, 35, 2)], hide)
        .box((-1, 1), (31, 34), (11, 15), hide)
        .paint((-1, 1), 35, (7, 10), plate)
        .both(2, 34, (9, 11), brow)
        .eyes(2, 33, 10, eye, facing='side')
        .both(1, 30, 12, teeth)
        .both(1, 30, 14, teeth)
    )
    s.seg('head', skull, pad=2, bake_ao=False)
    s.seg(
        'jaw',
        Sculpt()
        .box((-1, 1), (28, 29), (8, 14), belly)
        .both(1, 30, 13, teeth),
        pad=0,
        bake_ao=False,
    )

    # Counterbalancing tapered tail
    s.seg(
        'tail_01',
        barrel([((-17, -14), 10, 14, 1), ((-13, -9), 10, 15, 2)], hide)
        .paint((-1, 1), 10, (-17, -9), belly)
        .box(0, 15, (-16, -14), spine)
        .box(0, 16, (-13, -10), spine),
        pad=2,
        bake_ao=False,
    )
    s.seg(
        'tail_02',
        Sculpt()
        .box((-1, 1), (8, 12), (-26, -16), hide)
        .paint(0, 8, (-26, -16), belly)
        .box(0, 13, (-24, -18), spine),
        pad=1,
        bake_ao=False,
    )
    s.seg(
        'tail_03',
        Sculpt()
        .box((-1, 1), (7, 10), (-30, -25), hide)
        .box(0, (7, 9), (-35, -31), hide)
        .box(0, 10, (-34, -32), spine),
        pad=2,
        bake_ao=False,
    )

    # Lean vestigial T-rex arms (2x2 upper -> 1x2 forearm -> 2-claw hand)
    s.seg(
        'arm_upper_l',
        Sculpt().box((4, 8), (22, 23), (5, 6), hide),
        mirror_bone='arm_upper_r',
        pad=1,
        bake_ao=False,
    )
    s.seg(
        'arm_lower_l',
        Sculpt().box((8, 11), 22, (5, 6), plate),
        mirror_bone='arm_lower_r',
        pad=0,
        bake_ao=False,
    )
    s.seg(
        'hand_l',
        Sculpt().box(11, 22, (6, 7), hide).box(11, 22, 8, claw).box(12, 22, 7, claw),
        mirror_bone='hand_r',
        pad=1,
        bake_ao=False,
    )

    # Muscular haunches tapering into canonical 2x2 lower legs and 2-row clawed feet
    s.seg(
        'leg_upper_l',
        Sculpt()
        .box((4, 5), (11, 15), (-5, -3), hide)
        .box((4, 5), (8, 11), (-4, -2), hide)
        .paint(5, (12, 14), (-4, -3), plate),
        mirror_bone='leg_upper_r',
        pad=1,
        bake_ao=False,
    )
    s.seg(
        'leg_lower_l',
        Sculpt().box((4, 5), (2, 8), (-3, -2), plate),
        mirror_bone='leg_lower_r',
        pad=0,
        bake_ao=False,
    )
    s.seg(
        'foot_l',
        Sculpt()
        .box((4, 5), (0, 1), (-3, 0), hide)
        .box(4, 0, 1, claw)
        .box(5, 0, 1, claw),
        mirror_bone='foot_r',
        pad=1,
        bake_ao=False,
    )
    return s


EXOTIC_SPECS = (
    ('aquatic', 'Reef Shark', 'creature_reef_shark', 'Swim_Horizontal', _build_aquatic),
    ('avian', 'Frost Eagle', 'creature_frost_eagle', 'Flap', _build_avian),
    ('serpent', 'Cobra Serpent', 'creature_cobra_serpent', 'Idle', _build_serpent),
    ('dragon', 'Ember Dragon', 'creature_ember_dragon', 'Idle', _build_dragon),
    ('kaiju', 'Apex Rex', 'creature_apex_rex', 'Roar', _build_kaiju),
)


def build_all_exotics(characters_dir: Path):
    """Build all five non-mammal creatures into `characters_dir` and return `(parts, presets, creature_rigs)`."""
    parts = []
    presets = []
    creature_rigs = []

    for rig_id, label, preset_id, default_clip, builder_fn in EXOTIC_SPECS:
        sculptor = builder_fn()
        rel_file = f'{rig_id}-rig.glb'
        stats = sculptor.export_glb(characters_dir / rel_file)
        colliders = _measure_world_colliders(sculptor)

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
            'palette': copy.deepcopy(EXOTIC_PALETTES[rig_id]),
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
            'clips': [c['name'] for c in sculptor.rig.doc.get('animations', ())],
        })

    return parts, presets, creature_rigs
