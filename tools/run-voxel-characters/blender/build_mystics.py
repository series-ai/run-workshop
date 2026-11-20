"""Necromancer, Spirit Shaman, Swamp Witch, and Sorceress for the fantasy pack."""

from __future__ import annotations

import build_core as core
from build_core import (
    ARM_Y, ARM_Z, CALF_BACK, CALF_FRONT, CROWN_Y as CROWN, FRINGE, HALF, HEAD_EAR_Z, HEAD_EYE_Y, HEAD_FACE_Z as FRONT,
    HEAD_FACE_Z, HEAD_HALF_X, HEAD_JAW_Y, HEAD_MOUTH_Y, HEAD_NOSE_Y, HEAD_SHELL, HEAD_TOP_Y, NAPE,
    SIDE, SKIN_CORAL, SKIN_LIGHT, SKIN_LIP, SKIN_WARM, TAG_HEAD, TOP, TORSO_BACK, TORSO_FRONT,
)
from creature_kit import Sculpt
import voxchar as vk
from voxchar import vox

from build_mages_goblins import (
    CLOTH_SEC, CLOTH_SEC_DARK, GLOW, GOLD, GOLD_DARK, IRON, LEATHER, LEATHER_DARK, OUTER_FRONT,
    ROBE, ROBE_DARK, ROBE_LIGHT, STEEL, STOLE, STOLE_DARK, TRIM, TRIM_DARK, boot, cloak, coat, hood,
    lantern_frame, lapel, mage_headwear, mage_weapon, skirt_panel, sleeve, split_skirt, upper,
)

SKIN = vox('skin')
BONE = vox('trim', 0.20, mottle=False)
BONE_DARK = vox('trim', -0.20, mottle=False)


# --------------------------------------------------------------------------
# Heads & Hair
# --------------------------------------------------------------------------

def head_necro_skull():
    """Gaunt lich/necromancer skull face: deep sunken eye sockets, glowing soul eyes, bony teeth."""
    part = vk.VoxelPart('head_necro_skull', covers=(TAG_HEAD,))
    grid = core.head_base(part, ears=False)
    socket = vox('visor', -0.55, mottle=False)
    hollow = vox('skin', -0.45)
    skull_hi = vox('trim', 0.25, mottle=False)
    # Paint entire skull shell pale ash-bone so the head reads skeletal from every angle.
    grid.fill(-HEAD_HALF_X, HEAD_JAW_Y, -HEAD_SHELL + 1, HEAD_HALF_X, HEAD_TOP_Y, HEAD_FACE_Z, BONE)
    core.paint_face(grid, (
        'LHL',
        'GBG',
        'bnb',
        'BTB',
        'hBh',
    ), (
        '+.+',
        '-.-',
        '.-.',
        '...',
        '...',
    ), {
        'L': skull_hi, 'H': hollow, 's': socket, 'G': GLOW,
        'h': hollow, 'b': BONE_DARK, 'n': socket, 'B': STEEL, 'T': IRON,
    })
    grid.fill(-HEAD_HALF_X, HEAD_JAW_Y, HEAD_FACE_Z, HEAD_HALF_X, HEAD_JAW_Y, HEAD_FACE_Z, BONE_DARK)
    grid.set(0, HEAD_JAW_Y, HEAD_FACE_Z, BONE)
    for temple in (-HEAD_SHELL, HEAD_SHELL):
        grid.fill(temple, HEAD_NOSE_Y, HEAD_FACE_Z - 1, temple, HEAD_NOSE_Y, HEAD_FACE_Z, BONE_DARK)
    return part


def head_enchantress():
    """The Witch has high cheekbones and shaded eye sockets."""
    part = vk.VoxelPart('head_enchantress', covers=(TAG_HEAD,))
    grid = core.head_base(part)
    lash = vox('leather', -0.55, mottle=False)
    brow = vox('leather', -0.10, mottle=False)
    core.paint_face(grid, (
        'bLb',
        'EwE',
        'cnc',
        'wmw',
        'sLs',
    ), core.NOSE_RELIEF, {
        'b': brow, 'L': SKIN_LIGHT, 'E': lash, 's': SKIN,
        'c': SKIN_CORAL, 'n': SKIN_WARM, 'w': SKIN_WARM, 'm': SKIN_LIP,
    })
    for side in (-1, 1):
        grid.clear(side, HEAD_JAW_Y, HEAD_FACE_Z - 1, side, HEAD_JAW_Y, HEAD_FACE_Z)
    return part


def head_sorceress():
    """The Sorceress has a shallow nose, soft cheeks, and a tapered chin."""
    part = vk.VoxelPart('head_sorceress', covers=(TAG_HEAD,))
    grid = core.head_base(part)
    core.paint_face(grid, ('wLw', 'ELE', 'cLc', 'sms', 'wLw'), ('...',) * core.FACE_ROWS, {
        'L': SKIN_LIGHT, 'E': vox('leather', -0.25, mottle=False),
        's': SKIN, 'c': SKIN_CORAL, 'm': SKIN_LIP, 'w': SKIN_WARM,
    })
    for side in (-1, 1):
        grid.clear(side, HEAD_JAW_Y, HEAD_FACE_Z - 1, side, HEAD_JAW_Y, HEAD_FACE_Z)
    return part


def hair_witch_tresses():
    """Long parted dark tresses framing the lower cheeks without shadowing the face."""
    part, grid = core.hair_part('hair_witch_tresses', back=NAPE - 1)
    h0, h_hi, h_lo = vox('hair', 0.0), vox('hair', 0.2), vox('hair', -0.25)
    grid.fill(-SIDE, CROWN, NAPE, SIDE, CROWN, FRONT, h0)
    grid.fill(-HALF, HEAD_JAW_Y, NAPE - 1, HALF, TOP, NAPE, h_lo)
    grid.fill(-SIDE, HEAD_NOSE_Y, NAPE, SIDE, TOP, NAPE, h0)
    for side in (-SIDE, SIDE):
        grid.fill(side, HEAD_JAW_Y, NAPE, side, TOP, HEAD_EAR_Z + 1, h0)
        grid.set(side, HEAD_JAW_Y, HEAD_EAR_Z + 1, h_hi)
    grid.fill(-SIDE, HEAD_MOUTH_Y, FRONT, -SIDE, TOP, FRONT, h0)
    grid.set(-SIDE, HEAD_NOSE_Y, FRONT, h_hi)
    grid.set(SIDE, HEAD_JAW_Y, FRONT, h0)
    grid.fill(-SIDE, CROWN, FRONT, 0, CROWN, FRONT, h_hi)
    return part


def hair_sorceress_mane():
    """Swept royal waves with sculpted side-part fringe and flowing rear cascade."""
    part, grid = core.hair_part('hair_sorceress_mane', back=NAPE - 1)
    h0, h_hi, h_lo = vox('hair', 0.0), vox('hair', 0.25), vox('hair', -0.20)
    grid.fill(-SIDE, CROWN, NAPE, SIDE, CROWN, FRONT, h0)
    grid.fill(-HALF, CROWN + 1, NAPE, HALF, CROWN + 1, FRONT, h_hi)
    grid.fill(-HALF, HEAD_MOUTH_Y, NAPE - 1, HALF, TOP, NAPE, h_lo)
    grid.fill(-HALF, HEAD_JAW_Y, NAPE - 1, 0, HEAD_MOUTH_Y, NAPE - 1, h_hi)
    grid.fill(-SIDE, HEAD_NOSE_Y, NAPE, SIDE, TOP, NAPE, h0)
    for side in (-SIDE, SIDE):
        grid.fill(side, HEAD_NOSE_Y, NAPE, side, TOP, HEAD_EAR_Z + 1, h0)
        grid.fill(side, HEAD_NOSE_Y, FRONT - 1, side, TOP, FRONT - 1, h_hi)
    grid.fill(0, CROWN, FRONT, SIDE, CROWN, FRONT, h_hi)
    grid.set(SIDE, TOP, FRONT, h0)
    return part


# --------------------------------------------------------------------------
# 1. Necromancer parts
# --------------------------------------------------------------------------

def headwear_necro_cowl():
    cowl = hood().box((-3, 2), (71, 73), (5, 6), ROBE_DARK)
    cowl.box((-3, 2), 71, 7, ROBE_DARK)
    cowl.box((-1, 0), 70, (6, 7), ROBE_DARK)
    cowl.box((-2, 1), 76, (-4, 2), ROBE).box((-1, 0), 77, (-5, -2), ROBE)
    return mage_headwear('headwear_necro_cowl', cowl)


def torso_necro_ribplate():
    ossuary = upper(CLOTH_SEC).box((4, 7), (28, 30), (-2, 1), IRON)
    ossuary.box((4, 5), (30, 32), 1, BONE_DARK).box(6, (29, 31), 1, BONE)
    ossuary.box(7, (29, 30), 1, BONE_DARK)
    part, chest = coat('torso_necro_ribplate', ossuary, sleeve(ROBE_DARK), other_shoulder=upper(CLOTH_SEC))
    core.low_collar(part, IRON, turtleneck=True)
    chest.fill(-3, 28, TORSO_FRONT, 3, 29, OUTER_FRONT, STEEL)
    chest.fill(-2, 26, TORSO_FRONT, 2, 27, OUTER_FRONT, IRON)
    chest.fill(-1, 25, TORSO_FRONT, 1, 26, OUTER_FRONT, IRON)
    chest.set(-2, 28, OUTER_FRONT, BONE_DARK)
    return part


def legs_necro_shroud():
    panel = skirt_panel(11).box(3, (10, 16), -2, CLOTH_SEC).box(2, (12, 17), 2, CLOTH_SEC)
    panel.box((1, 3), (10, 16), -2, CLOTH_SEC).box(2, (9, 14), -3, ROBE_DARK)
    return split_skirt('legs_necro_shroud', panel)


def back_necro_spine():
    pall = Sculpt().box((-3, 3), (24, 30), -2, ROBE_DARK)
    pall.box((-2, 2), (21, 30), -3, ROBE).box(0, (21, 28), -4, CLOTH_SEC_DARK)
    pall.both(2, (30, 32), -2, IRON).box((-1, 1), (30, 31), -2, IRON)
    pall.both(3, (23, 28), -3, ROBE_DARK).both(1, (22, 25), -4, CLOTH_SEC_DARK)
    return cloak('back_necro_spine', pall)


def held_soul_scythe():
    staff = Sculpt().box(0, (-16, 43), 0, LEATHER_DARK)
    staff.box(0, (40, 47), 0, IRON).box((0, 6), (45, 48), 0, IRON)
    staff.box((5, 12), (44, 47), 0, IRON).box((10, 15), (43, 45), 0, STEEL)
    staff.box((14, 18), (41, 43), 0, STEEL).box((17, 20), (39, 41), 0, STEEL)
    staff.box(20, (36, 39), 0, STEEL).box((0, 4), (45, 46), 1, IRON)
    return mage_weapon('held_soul_scythe', staff)


def held_phylactery_skull():
    cage = Sculpt().box((-2, 0), 0, 0, IRON)
    cage.box(-2, (-5, 0), 0, STEEL).box(-2, (-6, -4), (0, 2), IRON)
    cage.box((-4, 0), -7, (0, 3), IRON)
    cage.box((-4, 0), (-11, -8), (1, 3), BONE_DARK)
    cage.box((-3, -1), -12, (1, 3), BONE).box(-2, -10, 4, BONE)
    for x in (-3, -1):
        cage.box(x, -9, 3, IRON)
    cage.box((-4, 0), -13, (1, 3), IRON)
    for x in (-4, 0):
        cage.box(x, (-12, -8), 0, IRON)
    return mage_weapon('held_phylactery_skull', cage)


def headwear_shaman_antlers():
    mask = Sculpt().box((-4, 3), (70, 72), (-3, 4), LEATHER_DARK)
    mask.box((-3, 2), (70, 72), (4, 7), BONE_DARK)
    mask.box((-1, 0), (67, 71), (6, 7), BONE)
    for root, outer in [(-4, -5), (3, 4)]:
        mask.box(root, (68, 71), (3, 6), BONE)
        mask.box(root, (72, 74), (-1, 3), BONE_DARK)
        mask.box(outer, (74, 76), (-3, 0), BONE)
        mask.box(outer, (76, 77), (-6, -3), BONE)
    return mage_headwear('headwear_shaman_antlers', mask)


def torso_shaman_hide():
    pelt = upper(SKIN).box((4, 7), (28, 30), (-2, 1), ROBE_DARK)
    part, chest = coat('torso_shaman_hide', pelt, sleeve(SKIN).box((12, 14), ARM_Y, ARM_Z, LEATHER),
                       other_shoulder=upper(SKIN).box((4, 5), ARM_Y, ARM_Z, LEATHER))
    chest.fill(-3, 28, TORSO_FRONT, 1, 29, OUTER_FRONT, ROBE_DARK)
    lapel(chest, 1, LEATHER, CLOTH_SEC)
    chest.fill(2, 27, OUTER_FRONT, 2, 28, OUTER_FRONT, BONE_DARK)
    return part


def legs_shaman_wraps():
    hide = skirt_panel(13, CLOTH_SEC).box((2, 3), 14, 2, STOLE_DARK)
    hide.box(4, (12, 15), (-1, 0), LEATHER_DARK)
    calf = boot().box((1, 3), (6, 10), (CALF_BACK, CALF_FRONT), SKIN)
    ink = vox('detail', -0.35, mottle=False)
    calf.paint((1, 3), 7, CALF_FRONT, ink).paint(2, (8, 9), CALF_FRONT, ink)
    calf.paint((1, 3), 10, CALF_FRONT, ink).paint(3, (8, 9), CALF_BACK, ink)
    wrap = boot().box((1, 3), 8, (CALF_BACK, CALF_FRONT), CLOTH_SEC)
    return split_skirt('legs_shaman_wraps', hide, shin=calf, right_shin=wrap)


def back_shaman_totem():
    hide = Sculpt().box((-3, 3), (27, 30), -2, ROBE_DARK)
    hide.box((-2, 2), (24, 29), -3, LEATHER).box((-1, 1), (22, 26), -3, LEATHER_DARK)
    hide.both(3, (26, 29), -3, ROBE).box(2, 25, -3, BONE_DARK)
    hide.box((-2, -1), (24, 28), -4, ROBE).box(1, (23, 27), -4, LEATHER_DARK)
    return cloak('back_shaman_totem', hide)


def held_spirit_totem():
    crook = Sculpt().box(0, (-15, 24), 0, LEATHER)
    crook.box((0, 1), (24, 28), 0, LEATHER).box(1, (28, 38), 0, LEATHER)
    crook.box((1, 3), (38, 40), 0, LEATHER_DARK).box((3, 5), (39, 41), 0, LEATHER)
    crook.box(5, (35, 39), 0, LEATHER).box(5, (32, 34), 0, BONE_DARK)
    crook.box(1, (30, 33), 0, STOLE_DARK)
    return mage_weapon('held_spirit_totem', crook)


def held_shaman_drum():
    drum = Sculpt().box(0, (-2, 2), 0, LEATHER_DARK)
    for width, lo, hi in [(2, -6, 6), (4, -5, 5), (5, -3, 3)]:
        drum.box((-5-width, -5+width), (lo, hi), (0, 2), LEATHER)
        drum.box((-4-width, -6+width), (lo + 1, hi - 1), 3, TRIM_DARK)
    drum.box((-7, -3), 0, 3, STOLE).box(-5, (-2, 2), 3, STOLE)
    return mage_weapon('held_shaman_drum', drum)


def headwear_witch_hat():
    felt = Sculpt().box((-4, 3), 73, (-5, 6), ROBE_DARK)
    felt.box((-6, -4), 72, (-3, 6), ROBE).box((-5, -2), 72, (5, 7), ROBE)
    felt.box((3, 5), 74, (-4, 4), ROBE).box((4, 5), 75, (-4, -2), ROBE)
    felt.box((-3, 2), (74, 75), (-3, 5), LEATHER_DARK)
    felt.box((-3, 2), (76, 77), (-2, 4), ROBE)
    felt.box((-4, 0), (78, 79), (-2, 2), ROBE).box((-5, -2), 80, (-1, 1), ROBE)
    felt.box((-6, -5), 79, (-1, 0), ROBE_DARK)
    felt.box(4, (74, 76), 4, TRIM_DARK).box((3, 5), 77, (3, 5), STEEL)
    felt.box(-5, (73, 74), 6, TRIM_DARK).box((-6, -4), 75, 6, STOLE)
    return mage_headwear('headwear_witch_hat', felt, covers_hair=False)


def torso_witch_corset():
    shoulder = upper(ROBE_DARK).cut((4, 5), ARM_Y[1], ARM_Z)
    part, chest = coat('torso_witch_corset', shoulder, sleeve(ROBE_DARK), fitted=True)
    chest.fill(-2, 24, TORSO_FRONT, 2, 26, TORSO_FRONT, LEATHER)
    core.shape_chest_front(chest, LEATHER, LEATHER_DARK)
    chest.fill(-3, 28, TORSO_BACK, -1, 29, TORSO_FRONT, CLOTH_SEC)
    chest.fill(-2, 27, TORSO_FRONT, 0, 28, TORSO_FRONT, CLOTH_SEC)
    chest.set(2, 29, TORSO_FRONT, SKIN)
    chest.set(1, 28, TORSO_FRONT, SKIN)
    core.lower_shoulder_line(chest)
    return part


def legs_witch_boots():
    shorter = skirt_panel(13).box(4, (12, 14), -1, CLOTH_SEC)
    longer = skirt_panel(11).box(3, (10, 14), -2, ROBE_DARK)
    shin = boot().box((1, 3), 6, 1, LEATHER_DARK).box(3, 6, 1, STEEL)
    return split_skirt('legs_witch_boots', shorter, right=longer, shin=shin)


def back_witch_broom():
    shawl = Sculpt().box((-3, 3), 28, -2, CLOTH_SEC)
    shawl.box((-2, 2), (29, 30), -2, CLOTH_SEC)
    shawl.box((-3, 1), (25, 28), -2, CLOTH_SEC).box((-3, -1), (22, 27), -3, CLOTH_SEC_DARK)
    shawl.box(-2, (26, 29), -4, TRIM_DARK).box((-3, -1), 29, (-5, -4), STEEL)
    return cloak('back_witch_broom', shawl)


def held_briar_wand():
    branch = Sculpt().box(0, (-16, 18), 0, LEATHER)
    branch.box((0, 2), (18, 22), 0, LEATHER).box(2, (22, 33), 0, LEATHER)
    branch.box((1, 2), (33, 35), 0, LEATHER).box(1, (35, 39), 0, LEATHER_DARK)
    branch.box((2, 4), (29, 30), 0, LEATHER_DARK).box(4, (30, 34), 0, LEATHER_DARK)
    return mage_weapon('held_briar_wand', branch)


def held_brew_flask():
    flask = lantern_frame(-1, GLOW)
    flask.box((-3, -1), (-2, 2), (7, 8), STOLE).box(-2, -2, (7, 8), GLOW)
    return mage_weapon('held_brew_flask', flask)


def headwear_sorceress_tiara():
    circlet = Sculpt().box((-4, 3), 72, 7, GOLD_DARK)
    for temple, tip in [(-5, -4), (4, 3)]:
        circlet.box(temple, 73, (-3, 5), GOLD_DARK)
        circlet.box(temple, (72, 74), (4, 7), GOLD)
        circlet.box(tip, (74, 76), (5, 6), GOLD)
    circlet.box((-2, 1), 72, 7, GOLD).box((-1, 0), 71, 7, TRIM_DARK)
    return mage_headwear('headwear_sorceress_tiara', circlet, covers_hair=False)


def torso_sorceress_gown():
    shoulder = upper(SKIN).cut((4, 5), ARM_Y[1], ARM_Z)
    shoulder.box((4, 5), ARM_Y[0], (-1, 1), ROBE)
    glove = sleeve(CLOTH_SEC_DARK).box((13, 15), ARM_Y, ARM_Z, ROBE)
    part, chest = coat('torso_sorceress_gown', shoulder, glove, fitted=True)
    core.shape_chest_front(chest, ROBE, ROBE_DARK)
    chest.fill(-1, 28, TORSO_FRONT, 1, 28, TORSO_FRONT, SKIN)
    chest.fill(-2, 27, TORSO_FRONT, -1, 27, OUTER_FRONT, ROBE_LIGHT)
    chest.fill(1, 27, TORSO_FRONT, 2, 27, OUTER_FRONT, ROBE_LIGHT)
    chest.set(0, 27, TORSO_FRONT, SKIN)
    chest.fill(-2, 24, TORSO_FRONT, 2, 24, TORSO_FRONT, CLOTH_SEC)
    chest.set(0, 25, OUTER_FRONT, GOLD_DARK)
    core.lower_shoulder_line(chest)
    return part


def legs_sorceress_boots():
    velvet = skirt_panel(10, CLOTH_SEC).box((3, 4), 10, (-2, 1), GOLD_DARK)
    velvet.box((1, 3), (9, 17), -2, ROBE).box(3, (8, 14), -3, ROBE_LIGHT)
    return split_skirt('legs_sorceress_boots', velvet)


def back_sorceress_mantle():
    cape = Sculpt().box((-2, 2), (24, 30), (-4, -2), ROBE_DARK)
    cape.box((-1, 1), (29, 31), -3, GOLD_DARK)
    cape.both((2, 4), (26, 30), -4, GOLD_DARK)
    cape.both((4, 5), (27, 32), -5, TRIM_DARK)
    cape.both((5, 6), (29, 34), -5, TRIM)
    cape.both((6, 7), (32, 36), -6, TRIM)
    cape.both(7, (35, 37), -6, GOLD)
    cape.both(5, (27, 30), -6, GOLD_DARK)
    return cloak('back_sorceress_mantle', cape)


def held_astral_scepter():
    staff = Sculpt().box(0, (-16, 35), 0, GOLD_DARK).box(0, (-3, 3), 0, LEATHER_DARK)
    staff.box((0, 2), 36, 0, GOLD).box((1, 3), 37, 0, GOLD)
    staff.box(3, (37, 42), 0, GOLD).box(2, (42, 44), 0, GOLD)
    staff.box(0, (36, 40), 0, GOLD).box(1, (40, 42), 0, TRIM)
    return mage_weapon('held_astral_scepter', staff)


def held_astral_orb():
    orb = Sculpt().box(0, (0, 3), 0, GOLD_DARK).box((-4, 0), 3, 0, GOLD)
    orb.box((-6, -2), (4, 8), (-1, 1), GLOW)
    orb.box((-5, -3), (5, 7), (-2, 2), GLOW)
    orb.box((-5, -3), 9, (-1, 1), GLOW)
    return mage_weapon('held_astral_orb', orb)


PARTS = (
    ('head', 'Necromancer Skull', head_necro_skull, {}),
    ('head', 'Mystic Enchantress', head_enchantress, {}),
    ('head', 'Royal Sorceress', head_sorceress, {}),
    ('hair', 'Witch Tresses', hair_witch_tresses, {}),
    ('hair', 'Sorceress Mane', hair_sorceress_mane, {}),
    ('headwear', 'Necromancer Skull Cowl', headwear_necro_cowl, {'hides_hair': True}),
    ('headwear', 'Shaman Antler Headdress', headwear_shaman_antlers, {'hides_hair': True}),
    ('headwear', 'Crooked Witch Hat', headwear_witch_hat, {'hides_hair': False}),
    ('headwear', 'Celestial Tiara', headwear_sorceress_tiara, {'hides_hair': False}),
    ('torso', 'Necromancer Ribplate', torso_necro_ribplate, {}),
    ('torso', 'Shaman Spirit Hide', torso_shaman_hide, {}),
    ('torso', 'Witch Corset Robes', torso_witch_corset, {}),
    ('torso', 'Sorceress Royal Gown', torso_sorceress_gown, {}),
    ('legs', 'Necromancer Shroud Greaves', legs_necro_shroud, {'hides_legs_upper': True}),
    ('legs', 'Shaman Hide Wraps', legs_shaman_wraps, {'hides_legs_upper': True}),
    ('legs', 'Witch Buckled Boots', legs_witch_boots, {'hides_legs_upper': True}),
    ('legs', 'Sorceress Gilded Boots', legs_sorceress_boots, {'hides_legs_upper': True}),
    ('back', 'Mortuary Shroud', back_necro_spine, {}),
    ('back', 'Ritual Hide Mantle', back_shaman_totem, {}),
    ('back', 'Herbalist Shawl', back_witch_broom, {}),
    ('back', 'Gilded Relic Wings', back_sorceress_mantle, {}),
)

HELD = (
    ('Soul Scythe', 'hand_r', held_soul_scythe),
    ('Phylactery Skull', 'hand_l', held_phylactery_skull),
    ('Spirit Totem Staff', 'hand_r', held_spirit_totem),
    ('Shaman Frame Drum', 'hand_l', held_shaman_drum),
    ('Briar Casting Wand', 'hand_r', held_briar_wand),
    ('Bubbling Brew Flask', 'hand_l', held_brew_flask),
    ('Astral Star Scepter', 'hand_r', held_astral_scepter),
    ('Astral Crystal Orb', 'hand_l', held_astral_orb),
)

PRESETS = (
    core.preset(
        'fantasy_necromancer', 'fantasy', 'Necromancer', 'Staff_Idle_Loop',
        {'skin': '#aaa89d', 'hair': '#323339', 'primary': '#414249', 'secondary': '#50545b',
         'accent': '#60948c', 'metal': '#626770', 'trim': '#b3ad98', 'leather': '#50443f',
         'visor': '#262a2c', 'detail': '#6e787a'},
        body='body_slim', head='head_necro_skull', hair='hair_slick_back',
        torso='torso_necro_ribplate', legs='legs_necro_shroud',
        headwear='headwear_necro_cowl', back='back_necro_spine',
        held_right='held_soul_scythe', held_left='held_phylactery_skull',
        proportions={
            'height': 1.03, 'legRatio': 0.94, 'build': -0.45,
            'shoulderWidth': 1.42, 'torsoBulk': 0.92, 'waistScale': 0.88,
            'headScale': 1.0, 'limbThickness': 0.92, 'armLength': 0.98,
        },
    ),
    core.preset(
        'fantasy_shaman', 'fantasy', 'Spirit Shaman', 'Staff_Idle_Loop',
        {'skin': '#b28a70', 'hair': '#332e2c', 'primary': '#66503f', 'secondary': '#56594b',
         'accent': '#907956', 'metal': '#6f7066', 'trim': '#b1a18a', 'leather': '#644b3c',
         'visor': '#2b2827', 'detail': '#466963'},
        body='body_heavy', head='head_scarred_veteran', hair='hair_slick_back',
        torso='torso_shaman_hide', legs='legs_shaman_wraps',
        headwear='headwear_shaman_antlers', back='back_shaman_totem',
        held_right='held_spirit_totem', held_left='held_shaman_drum',
        proportions={
            'height': 0.98, 'legRatio': 0.96, 'build': 0.25,
            'shoulderWidth': 1.72, 'torsoBulk': 0.94, 'waistScale': 0.89,
            'headScale': 1.0, 'limbThickness': 0.92, 'armLength': 0.91,
        },
    ),
    core.preset(
        'fantasy_witch', 'fantasy', 'Swamp Witch', 'Staff_Idle_Loop',
        {'skin': '#bca494', 'hair': '#302b33', 'primary': '#465548', 'secondary': '#604b5e',
         'accent': '#738e79', 'metal': '#a77a59', 'trim': '#ad9680', 'leather': '#57443c',
         'visor': '#2d2930', 'detail': '#86a187'},
        body='body_slim', head='head_enchantress', hair='hair_witch_tresses',
        torso='torso_witch_corset', legs='legs_witch_boots',
        headwear='headwear_witch_hat', back='back_witch_broom',
        held_right='held_briar_wand', held_left='held_brew_flask',
        proportions={
            'height': 0.94, 'legRatio': 0.94, 'build': -0.60,
            'shoulderWidth': 1.46, 'torsoBulk': 0.88, 'waistScale': 0.80,
            'headScale': 1.0, 'limbThickness': 0.90, 'armLength': 0.95,
        },
    ),
    core.preset(
        'fantasy_sorceress', 'fantasy', 'Sorceress', 'Staff_Idle_Loop',
        {'skin': '#d0aa94', 'hair': '#d9b879', 'primary': '#703c4b', 'secondary': '#414358',
         'accent': '#b19a73', 'metal': '#938778', 'trim': '#c4b9a5', 'leather': '#56404a',
         'visor': '#282833', 'detail': '#a59bb9'},
        body='body_slim', head='head_sorceress', hair='hair_sorceress_mane',
        torso='torso_sorceress_gown', legs='legs_sorceress_boots',
        headwear='headwear_sorceress_tiara', back='back_sorceress_mantle',
        held_right='held_astral_scepter', held_left='held_astral_orb',
        proportions={
            'height': 0.98, 'legRatio': 0.97, 'build': -0.55,
            'shoulderWidth': 1.42, 'torsoBulk': 0.90, 'waistScale': 0.78,
            'headScale': 1.0, 'limbThickness': 0.90, 'armLength': 0.96,
        },
    ),
)
