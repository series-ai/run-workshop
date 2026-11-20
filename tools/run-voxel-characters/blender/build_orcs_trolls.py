"""Orcs, trolls, and their weapons for the fantasy pack."""

import build_core as core
from build_heist import static_grid
from creature_kit import Sculpt
import voxchar as vk
from voxchar import vox


SKIN = vox('skin')
SKIN_LIGHT = vox('skin', 0.125)
BROW = vox('skin', -0.25)
SKIN_SCAR = vox('skin', -0.42)
MOUTH_DARK = vox('visor', -0.5, mottle=False)
IVORY = vox('trim', 0.35, mottle=False)
IRON = vox('metal', -0.25)
IRON_DARK = vox('metal', -0.5)
STEEL = vox('metal', 0.125)
HIDE = vox('leather')
HIDE_DARK = vox('leather', -0.25)
CLOTH = vox('primary')
ROCK = vox('secondary')
ROCK_LIGHT = vox('secondary', 0.22)
ROCK_DARK = vox('secondary', -0.28)
MARK = vox('detail')
EYE = vox('accent', mottle=False)
HAIR = vox('hair', -0.25)


def monster(body_id, *, troll=False, boss=False, cave=False):
    part = vk.VoxelPart(body_id)

    def attach(bone, tag, sculpt, *, twin=False, pad=0):
        grid = core.seg(part, bone, *sculpt.bounds(), tag=tag, pad=pad)
        sculpt.write(grid)
        if twin:
            core.add_twin(part, grid)

    # Pelvis: rugged war-belt, loincloth tatters, clean outer thigh clearance (no boxer briefs).
    hips = Sculpt().box((-3, 3), (18, 21), (-1, 1), SKIN)
    hips.box((-3, 3), (20, 21), (-2, 2), HIDE_DARK if troll else HIDE)
    hips.box((-1, 1), (20, 21), 2, ROCK_DARK if troll else IRON)
    hips.box((-1, 1), (17, 19), 2, HIDE_DARK if troll else HIDE)
    hips.box(0, (16, 17), 2, ROCK if troll else CLOTH if boss else HIDE_DARK)
    hips.box((-1, 1), (17, 19), -2, HIDE_DARK)
    hips.both(3, (18, 19), (-1, 1), ROCK_DARK if troll else IRON if boss else HIDE_DARK)
    attach('pelvis', 'hips', hips)

    # Waist (spine_02): tight 5-wide midriff so every monster has an unmistakable V-taper.
    waist = Sculpt().box((-2, 2), (22, 24), (-1, 1), SKIN)
    attach('spine_02', 'chest', waist)

    # Chest (spine_03): broad 11-wide upper ribcage flaring into shoulders + tall hunched back arch.
    back_z = -4 if troll else -3
    chest = Sculpt().box((-4, 4), (25, 29), (back_z + 1, 2), SKIN)
    chest.box((-5, 5), (27, 29), (-2, 2), SKIN)                      # Broad shoulder bridge (eliminates armpit gap)
    chest.both((1, 3), (27, 29), 3, SKIN_LIGHT if not troll else SKIN) # Jutting pectoral mass
    # Massive hunched trapezius & dorsal back arch rising behind the sunken skull.
    chest.box((-4, 4), (29, 31), (back_z, -1), ROCK_DARK if cave else ROCK if troll else BROW)
    chest.box((-3, 3), (32, 33 if troll else 32), (back_z, -1), ROCK_DARK if cave else ROCK if troll else BROW)
    if troll:
        stone = ROCK_DARK if cave else ROCK
        chest.box((-5, 5), 30, (-2, 0), stone)                         # Seamless stone shoulder mantle
        chest.both(3, (27, 29), 3, stone)
        if cave:
            chest.box((-1, 1), (29, 33), back_z, MARK)                 # Bioluminescent cavern spine ridge
            chest.box((-3, -2), 28, 3, MARK)
        else:
            chest.box((-2, 2), (30, 33), (back_z, -1), MARK)           # Bold moss mantle across hunched back
            chest.both(4, 30, (-1, 1), MARK)
    elif boss:
        chest.box((-3, 3), (27, 29), 3, IRON)                          # Bold iron warboss breastplate
        chest.box((-1, 1), (26, 28), 3, IRON_DARK)
        chest.box((-3, -2), (26, 27), 3, MARK)                         # Crimson war-paint slash
        chest.box((-2, 2), (30, 32), back_z, IRON_DARK)                # Armored dorsal ridge
    else:
        for step, row in enumerate(range(25, 30)):
            x = -2 + step
            chest.box((x - 1, x), row, 3 if row >= 27 else 2, HIDE_DARK)
        chest.box((-1, 0), 28, 3, IRON)
        chest.box((-3, -2), (27, 28), 2, MARK)                         # Crimson shoulder war-paint
    attach('spine_03', 'chest', chest, pad=core.PAD_JOINT)

    # Head: sunken down into the hunched shoulders (y = 29..36) & thrust forward (z = 0..5).
    # Deep recessed eye sockets under a heavy jutting brow + dark snarl mouth + tall stark ivory tusks.
    head = Sculpt().box((-2, 2), (31, 34), (0, 3), SKIN)
    head.box((-2, 2), (29, 30), (1, 4), BROW if troll else SKIN)       # Protruding underbite jaw
    head.box((-2, 2), 30, 5, BROW if troll else SKIN)                  # Heavy jutting chin shelf
    # Dark open mouth cavity at z = 3 (z = 4 on y = 31 stays open beneath the jutting brow & above the underbite jaw).
    head.box((-1, 1), 31, 3, MOUTH_DARK)
    head.both(1, 32, 3, EYE)                                           # Fierce glowing eyes under brow shadow
    head.box(0, 32, 4, BROW)                                           # Snout bridge between eyes
    # Massive overhanging brow ridge across z = 4..5.
    head.box((-2, 2), 33, (3, 5), ROCK_DARK if cave else BROW)
    head.both(1, 33, 5, 0)
    # Tall crisp ivory tusks rising out of the underbite jaw corners at z = 5.
    head.both(2, (30, 32), 5, IVORY)
    if boss or cave:
        head.both(2, 33, 5, IVORY)
    # Tapered cranium + unmistakable beast silhouettes (ears, mohawk, war-horns, cavern horns).
    if troll:
        head.box((-2, 2), 34, (0, 3), ROCK_DARK if cave else SKIN)
        head.box((-1, 1), 35, (0, 2), ROCK_DARK if cave else MARK)
        head.both(3, (31, 32), (1, 2), ROCK if cave else SKIN)         # Wide drooping troll ears
        if cave:
            # Dramatic sweeping pale cavern horns rising above & ahead of the skull silhouette.
            head.both(2, (34, 35), (3, 4), IVORY)
            head.both(3, (35, 37), 4, IVORY)
            head.box(0, 34, 4, MARK)
        else:
            # Moss crest overhanging brow + moss crown.
            head.box((-1, 1), 34, 4, MARK)
            head.box(0, 36, (0, 2), MARK)
    else:
        head.both(3, (32, 33), (1, 2), SKIN)                           # Pointed orc ears (keep within |x|<=3)
        head.cut(-3, 32, 2).cut(3, 32, 2)
        if boss:
            head.box((-2, 2), 34, (0, 4), IRON_DARK)                   # Iron war-brow helm
            head.box((-1, 1), 35, (0, 3), IRON)
            head.box(0, (35, 36), (1, 3), MARK)                        # Crimson war-crest
            head.both(3, (34, 35), 2, IRON).both(3, (36, 37), 3, IVORY)  # Sweeping warboss helm horns
        else:
            head.box((-2, 2), 34, (0, 3), SKIN)
            head.box(0, (35, 37), (0, 3), HAIR)                        # Tall dark orc mohawk silhouette
    attach('Head', 'head', head)

    # Upper arm: starts at x = 4 tucked inside the 11-wide chest shoulder socket (zero floating gap).
    upper = Sculpt().box((4, 10), (26 if troll else 27, 30), (-1, 2), SKIN)
    cap = ROCK_DARK if cave else ROCK if troll else IRON if boss else HIDE
    upper.box((4, 7), (29, 31), (-1, 2), cap)
    if troll:
        upper.box((5, 7), 31, (-1, 1), MARK if not cave else ROCK_DARK)
    elif boss:
        upper.box((4, 6), 31, (-1, 2), IRON_DARK).box(6, 32, 1, IVORY)
    else:
        upper.box((4, 6), 31, (0, 1), IRON).box(5, 32, 0, IVORY)
    attach('upperarm_l', 'arms_upper', upper, twin=True)

    # Forearm: keep y = (28, 30) and z = (-1, 1) so arms never clip thighs in Idle_Loop / Idle_Torch_Loop.
    forearm = Sculpt().box((10, 15), (28, 30), (-1, 1), SKIN)
    if troll:
        forearm.box((11, 15), 30, (-1, 1), ROCK_DARK if cave else ROCK)
    elif boss:
        forearm.box((11, 15), (28, 30), (-1, 1), IRON)
        forearm.box(15, (28, 30), (-1, 1), IRON_DARK)
    else:
        forearm.box((12, 14), (28, 30), (-1, 1), HIDE_DARK).box(15, (28, 30), (-1, 1), IRON)
    attach('lowerarm_l', 'arms_lower', forearm, twin=True, pad=core.PAD_JOINT)

    core.claw_hands(
        part,
        palm=SKIN,
        fingers=IVORY if troll else BROW,
        cuff=IRON if boss else None,
        tag='hands',
    )

    # Thigh: clean x=(1,3), z=(-1,1) for arm clearance; limbThickness scales them into sturdy trunks.
    thigh = Sculpt().box((1, 3), (11, 18), (-1, 1), SKIN)
    if not troll:
        thigh.box((1, 3), (14, 15), (-1, 1), HIDE_DARK)
    attach('thigh_l', 'legs_upper', thigh, twin=True, pad=core.PAD_JOINT)

    # Calf: thick 3 x 3 beast shins with rock plates or iron greaves.
    calf = Sculpt().box((1, 3), (2, 11), (-1, 1), SKIN if troll else HIDE)
    if troll:
        calf.box((1, 3), (7, 10), 1, ROCK_DARK if cave else ROCK)
        if not cave:
            calf.box((1, 2), (8, 9), 1, MARK)
    else:
        calf.box((1, 3), (6, 8), (-1, 1), HIDE_DARK)
        calf.box((1, 3), (9, 11), 1, IRON if boss else IRON_DARK)
    attach('calf_l', 'legs_lower', calf, twin=True)

    # Foot: broad 3-wide, 5-long (z = -1..3 -> 0.25 m >= 0.22 m) beast feet with split claws.
    foot = Sculpt().box((1, 3), (0, 1), (-1, 2), BROW if troll else HIDE_DARK)
    if not troll:
        foot.box((1, 3), 1, 2, IRON)
    claw = IVORY if troll else IRON
    foot.box(1, 0, 3, claw).box(3, 0, 3, claw)
    attach('foot_l', 'feet', foot, twin=True)
    return part


def held_orc_cleaver():
    part = vk.VoxelPart('held_orc_cleaver')
    grid = static_grid(part, (0, 1), (-5, 19), (-1, 5), core.HELD_VOX)
    # Leather-wrapped grip + spiked pommel.
    grid.fill(0, -4, 0, 0, 5, 0, HIDE_DARK)
    for row in (-3, -1, 1, 3):
        grid.set(0, row, 0, HIDE)
    grid.fill(0, -5, 0, 0, -4, 1, IRON_DARK)
    grid.set(0, -5, 1, IVORY)
    # Heavy bolted guard + broad notched iron chopper.
    grid.fill(0, 5, -1, 0, 6, 3, IRON_DARK)
    grid.set(1, 5, 1, IVORY)
    grid.fill(0, 7, 0, 0, 17, 1, IRON_DARK)
    grid.fill(0, 7, 2, 0, 17, 3, IRON)
    grid.fill(0, 8, 4, 0, 17, 4, STEEL)
    grid.fill(0, 11, 5, 0, 17, 5, STEEL)
    grid.set(0, 13, 5, 0)                                              # Jagged notch in cutting edge
    grid.set(0, 9, 2, MARK)
    grid.set(0, 10, 2, MARK)
    grid.fill(0, 18, 2, 0, 19, 4, IRON)
    grid.set(0, 19, 4, STEEL)
    return part


def held_troll_club():
    part = vk.VoxelPart('held_troll_club')
    grid = static_grid(part, (0, 4), (-5, 21), (-3, 3), core.HELD_VOX)
    # Gnarled hardwood shaft + stone pommel.
    grid.fill(0, -5, 0, 0, 16, 0, HIDE_DARK)
    grid.set(0, -5, 0, ROCK_DARK)
    for row in (-3, -1, 1):
        grid.set(0, row, 0, HIDE)
    grid.fill(0, 7, -1, 1, 18, 1, HIDE)
    grid.fill(0, 10, -2, 2, 18, 2, HIDE)
    # Cracked stone bands with jutting iron spikes.
    for row in (11, 16):
        grid.fill(0, row, -2, 2, row + 1, 2, ROCK)
        grid.fill(2, row, 0, 4, row, 0, IRON)
        grid.set(4, row, 0, STEEL)
        grid.set(1, row + 1, 3, IRON)
        grid.set(1, row + 1, -3, IRON)
    grid.fill(0, 19, -1, 1, 20, 1, ROCK_DARK)
    grid.set(1, 21, 0, ROCK)
    return part


def held_orc_shield():
    """Forearm-mounted orc warboss tower shield (`gripStyle: 'forearm_shield'`).

    Mounts flat along the outer left forearm (`+X_held >= 0.098 m`, outer bosses to `+0.182 m`).
    Fist grip bar at `(0, 0, 0)` with pinky standoff, open leather arm-strap at `-Z_held = -8..-7`.
    """
    part = vk.VoxelPart('held_orc_shield')
    grid = static_grid(part, (-1, 6), (-5, 5), (-11, 6), core.HELD_VOX)
    # Fist grip bar at (0, 0, 0) + pinky-side standoff to inner shield face.
    grid.fill(0, -2, 0, 0, 2, 0, HIDE_DARK)
    grid.fill(1, -2, 0, 3, -2, 0, HIDE_DARK)
    # Open leather forearm strap near elbow (z = -8, hollow across y = -1..2).
    grid.fill(-1, -2, -8, -1, 3, -8, HIDE_DARK)
    grid.fill(0, -2, -8, 3, -2, -8, HIDE_DARK)
    grid.fill(0, 3, -8, 3, 3, -8, HIDE_DARK)
    # Shield body along outer forearm (x = +4..+5).
    for z, span in (
        (-11, (-4, 4)), (-10, (-5, 5)), (-9, (-5, 5)), (-8, (-5, 5)),
        (-7, (-5, 5)), (-6, (-5, 5)), (-5, (-5, 5)), (-4, (-5, 5)),
        (-3, (-5, 5)), (-2, (-5, 5)), (-1, (-4, 4)), (0, (-4, 4)),
        (1, (-3, 3)), (2, (-3, 3)), (3, (-2, 2)), (4, (-2, 2)),
        (5, (-1, 1)), (6, (0, 0)),
    ):
        grid.fill(4, span[0], z, 4, span[1], z, IRON_DARK)
        if span[1] - span[0] >= 4 and -9 <= z <= 1:
            grid.fill(5, span[0] + 1, z, 5, span[1] - 1, z, HIDE)
    # Jagged rim teeth + crimson war-paint stripe + heavy tusked central iron boss.
    for z in (-9, -3):
        grid.set(4, -5, z, IRON)
        grid.set(4, 5, z, IRON)
    grid.paint_if_filled(5, -3, -7, 5, 3, -6, MARK)
    grid.fill(6, -1, -4, 6, 1, -2, IRON)
    grid.set(6, -2, -3, IVORY)
    grid.set(6, 2, -3, IVORY)
    return part


PARTS = (
    ('body', 'Orc Raider', lambda: monster('body_orc_raider'), {}),
    ('body', 'Orc Warboss', lambda: monster('body_orc_warboss', boss=True), {}),
    ('body', 'Moss Troll', lambda: monster('body_troll_moss', troll=True), {}),
    ('body', 'Cave Troll', lambda: monster('body_troll_cave', troll=True, cave=True), {}),
)

HELD = (
    ('Orc Cleaver', 'hand_r', held_orc_cleaver),
    ('Troll Crag Club', 'hand_r', held_troll_club),
    ('Orc Boss Shield', 'hand_l', held_orc_shield, {'grip_style': 'forearm_shield'}),
)


def monster_preset(key, label, body, skin, stone, mark, clip, weapon, *, shield=None, **proportions):
    palette = {
        'skin': skin, 'hair': '#262523', 'primary': '#93483b', 'secondary': stone,
        'leather': '#6b4832', 'metal': '#6c757d', 'trim': '#efe2be',
        'detail': mark, 'accent': '#ffba47', 'visor': '#1c181a',
    }
    return core.preset('fantasy_' + key, 'fantasy', label, clip, palette, body=body,
                       head=None, hair=None, torso=None, legs=None, held_right=weapon,
                       held_left=shield, proportions=proportions)


PRESETS = (
    monster_preset('orc_raider', 'Orc Raider', 'body_orc_raider', '#758a43', '#4e5554', '#c8523a',
                   'Sword_Idle', 'held_orc_cleaver',
                   height=0.96, legRatio=0.78, shoulderWidth=1.56, torsoBulk=1.24,
                   waistScale=0.84, headScale=1.12, limbThickness=1.22, armLength=1.08),
    monster_preset('orc_warboss', 'Orc Warboss', 'body_orc_warboss', '#536e3b', '#4d525d', '#c94038',
                   'Idle_Loop', 'held_orc_cleaver', shield='held_orc_shield',
                   height=1.05, legRatio=0.78, shoulderWidth=1.62, torsoBulk=1.30,
                   waistScale=0.82, headScale=1.16, limbThickness=1.28, armLength=1.10),
    monster_preset('moss_troll', 'Moss Troll', 'body_troll_moss', '#5c784c', '#4a5258', '#9cc642',
                   'Idle_Loop', 'held_troll_club',
                   height=1.10, legRatio=0.78, shoulderWidth=1.62, torsoBulk=1.32,
                   waistScale=0.82, headScale=1.14, limbThickness=1.32, armLength=1.16),
    monster_preset('cave_troll', 'Cave Troll', 'body_troll_cave', '#6a7d8c', '#3f4552', '#5ec7e8',
                   'Idle_Torch_Loop', 'held_troll_club',
                   height=1.14, legRatio=0.78, shoulderWidth=1.64, torsoBulk=1.34,
                   waistScale=0.82, headScale=1.14, limbThickness=1.32, armLength=1.18),
)
