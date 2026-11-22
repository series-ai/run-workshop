"""Mages and goblins (parts, held items, and presets) for the fantasy pack."""

from __future__ import annotations

import build_core as core
from build_core import (
    ARM_LOWER_X, ARM_UPPER_X, ARM_Y, ARM_Z, CALF_BACK, CALF_FRONT, CALF_Y, LEGS_COVERS,
    PAD_GARMENT_OUTER, PAD_JOINT, SHOULDER_Y, SLEEVED_TORSO_COVERS, TAIL_Y, THIGH_BACK, THIGH_FRONT,
    THIGH_X, THIGH_Y, TORSO_BACK, TORSO_FRONT, TORSO_OUTER_Z, TROUSER_CALF_X, seg,
)
from creature_kit import Sculpt
import voxchar as vk
from voxchar import vox

OUTER_FRONT = TORSO_FRONT + 1
OUTER_BACK = TORSO_BACK - 1
SKIRT_Y = (TAIL_Y[0] + 1, TAIL_Y[1])     # rows 21..22 on pelvis, clearing lifted thighs
BELT_ROW_Y = SKIRT_Y[1] + 1             # row 23: robe sash / belt row

# Mage palette tokens
ROBE = vox('primary', 0.0)
ROBE_DARK = vox('primary', -0.25)
ROBE_LIGHT = vox('primary', 0.25)
TRIM = vox('trim', 0.25)
TRIM_DARK = vox('trim', -0.15)
STOLE = vox('detail', 0.0, mottle=False)
STOLE_DARK = vox('detail', -0.25, mottle=False)
GOLD = vox('accent', 0.125, mottle=False)
GOLD_DARK = vox('accent', -0.25, mottle=False)
GLOW = vox('accent', emissive=True)
LEATHER = vox('leather', -0.125)
LEATHER_DARK = vox('leather', -0.45)
CLOTH_SEC = vox('secondary', 0.0)
CLOTH_SEC_DARK = vox('secondary', -0.25)

# Goblin palette tokens
GOB_SKIN = vox('skin')
GOB_SKIN_LIGHT = vox('skin', 0.15)
GOB_SKIN_DARK = vox('skin', -0.25)
GOB_MOUTH = vox('visor', -0.5, mottle=False)
GOB_EYE = vox('accent', emissive=True)
GOB_FANG = vox('trim', 0.35, mottle=False)
GOB_HIDE = vox('leather')
GOB_HIDE_DARK = vox('leather', -0.3)
GOB_IRON = vox('metal', -0.3)
GOB_STEEL = vox('metal', 0.1)
GOB_CLOTH = vox('primary')
GOB_CLOTH_DARK = vox('primary', -0.25)
GOB_MARK = vox('detail', emissive=True)
GOB_SEC = vox('secondary')
GOB_SEC_DARK = vox('secondary', -0.25)


# --------------------------------------------------------------------------
# Mage parts (canonical UAL1 5 cm / 2.5 cm headwear lattice)
# --------------------------------------------------------------------------

STEEL = vox('metal', 0.15)
IRON = vox('metal', -0.3)


def sculpt_segment(part, bone, sculpt, *, twin=False, pad=PAD_GARMENT_OUTER):
    grid = seg(part, bone, *sculpt.bounds(), pad=pad)
    sculpt.write(grid)
    if twin:
        core.add_twin(part, grid)
    return grid


def mage_headwear(name, sculpt, *, covers_hair=True):
    part = vk.VoxelPart(name, covers=('hair',) if covers_hair else ())
    sculpt.write(core.hat_seg(part, *sculpt.bounds()))
    return part


def mage_weapon(name, shape):
    part = vk.VoxelPart(name)
    shape.write(_static_grid(part, *shape.bounds()))
    return part


def _static_grid(part, x, y, z, voxel=core.HELD_VOX):
    grid = vk.VoxelGrid(*x, *y, *z, voxel_size=voxel, center_x=True, center_z=True)
    return part.add_grid(grid)


def coat(name, shoulder, sleeve, *, other_shoulder=None, fitted=False):
    part = vk.VoxelPart(name, covers=SLEEVED_TORSO_COVERS)
    chest = core.shirt_torso(part, ROBE, y=(BELT_ROW_Y, SHOULDER_Y))
    # Recess the lowest fixed hem behind the front of the hip joint.
    half_waist = 2 if fitted else 3
    hem = Sculpt().box((-3, 3), SKIRT_Y, TORSO_OUTER_Z, ROBE)
    hem.box((-3, 3), TAIL_Y[0], (-1, 0), ROBE_DARK)
    sculpt_segment(part, 'pelvis', hem)
    if fitted:
        for side in (-3, 3):
            chest.clear(side, BELT_ROW_Y, OUTER_BACK, side, 25, OUTER_FRONT)
    chest.fill(-half_waist, BELT_ROW_Y, TORSO_BACK, half_waist, BELT_ROW_Y, TORSO_FRONT, LEATHER_DARK)
    sculpt_segment(part, 'upperarm_l', shoulder, twin=other_shoulder is None)
    if other_shoulder is not None:
        core.to_right(part, sculpt_segment(part, 'upperarm_l', other_shoulder))
    sculpt_segment(part, 'lowerarm_l', sleeve, twin=True)
    return part, chest


def upper(tone):
    return Sculpt().box(ARM_UPPER_X, ARM_Y, ARM_Z, tone)


def sleeve(tone):
    return Sculpt().box(ARM_LOWER_X, ARM_Y, ARM_Z, tone)


def lapel(chest, side, tone, facing):
    """Fold the facing inward from the shoulder to the waist."""
    for outer, inner, low, high in [(3, 2, 28, 29), (2, 1, 26, 27), (1, 0, 24, 25)]:
        x0, x1 = sorted((side * outer, side * inner))
        chest.fill(x0, low, TORSO_FRONT, x1, high, OUTER_FRONT, tone)
        chest.fill(side * outer, low, OUTER_FRONT, side * outer, high, OUTER_FRONT, facing)


def skirt_panel(hem, lining=ROBE_DARK):
    """Cut a vent at the inner knee. Keep the upper front below the hip pivot."""
    panel = Sculpt().box(THIGH_X, THIGH_Y, (THIGH_BACK, THIGH_FRONT), lining)
    panel.box((1, 3), (hem + 1, 19), (-2, -1), ROBE)
    panel.box(3, (hem, 18), (-2, 1), ROBE)
    panel.box(4, (hem - 1, min(hem + 2, 14)), (-2, 0), ROBE)
    panel.box((2, 3), (hem - 1, hem + 1), (-2, 1), ROBE)
    panel.box((2, 4), (hem - 1, hem), 2, ROBE_DARK)
    panel.box((2, 3), (hem + 1, 16), 2, ROBE)
    panel.box(1, (hem + 3, 16), 2, lining)
    return panel


def split_skirt(name, panel, *, right=None, shin=None, right_shin=None, toe=LEATHER):
    part = vk.VoxelPart(name, covers=LEGS_COVERS)
    core.trouser_hips(part, ROBE, belt=ROBE)
    sculpt_segment(part, 'thigh_l', panel, twin=right is None, pad=PAD_JOINT)
    if right is not None:
        core.to_right(part, sculpt_segment(part, 'thigh_l', right, pad=PAD_JOINT))
    sculpt_segment(part, 'calf_l', shin or boot(), twin=right_shin is None, pad=0)
    if right_shin is not None:
        core.to_right(part, sculpt_segment(part, 'calf_l', right_shin, pad=0))
    core.shoes(part, core.Shoe(upper=LEATHER, sole=LEATHER_DARK, toe=toe))
    return part


def boot():
    return Sculpt().box(TROUSER_CALF_X, CALF_Y, (CALF_BACK, CALF_FRONT), LEATHER)


def cloak(name, folds):
    part = vk.VoxelPart(name)
    sculpt_segment(part, 'spine_03', folds, pad=core.PAD_BACK)
    return part


def hood():
    hood = Sculpt().box((-4, 3), (70, 73), (-4, 6), ROBE)
    hood.box((-3, 2), (74, 75), (-4, 5), ROBE_LIGHT)
    hood.box((-4, 3), (64, 70), (-4, -2), ROBE_DARK)
    for side in (-4, 3):
        hood.box(side, (65, 71), (-2, 6), ROBE)
    return hood


def headwear_mage_hood():
    return mage_headwear('headwear_mage_hood', hood())


def headwear_mage_hat():
    felt = Sculpt().box((-5, 4), 71, (-5, 6), ROBE_DARK)
    felt.box((-6, 5), 71, (-3, 5), ROBE_DARK).box((-4, 3), 71, (6, 7), ROBE)
    felt.box((-4, 3), (72, 74), (-3, 5), ROBE).box((-4, 3), 73, (-3, 5), LEATHER)
    felt.box((-3, 2), (75, 76), (-3, 4), ROBE).box((-2, 2), (77, 78), (-3, 2), ROBE)
    felt.box((-1, 2), (79, 80), (-4, 0), ROBE_LIGHT).box((1, 2), 81, (-5, -2), ROBE)
    felt.box(2, 80, (-6, -5), ROBE_DARK)
    # The hat brim supports a broken brass dial.
    felt.box((-6, -5), 71, -4, IRON).box((4, 5), 71, -4, IRON)
    felt.box(-6, (72, 75), -4, STEEL).box(5, (72, 75), -4, STEEL)
    felt.box(-5, (75, 78), -4, STEEL).box(4, (75, 78), -4, STEEL)
    return mage_headwear('headwear_mage_hat', felt)


def torso_mage_robes():
    mantle = upper(ROBE).box((4, 7), (28, 30), (-2, 1), CLOTH_SEC)
    cuff = sleeve(ROBE).box((13, 15), (27, 29), (-1, 1), ROBE_DARK)
    part, chest = coat('torso_mage_robes', mantle, cuff)
    for side in (-1, 1):
        lapel(chest, side, CLOTH_SEC, TRIM_DARK)
    core.low_collar(part, CLOTH_SEC)
    chest.fill(-3, 28, OUTER_BACK, 3, 29, TORSO_BACK, CLOTH_SEC)
    return part


def legs_mage_boots():
    panel = skirt_panel(11).box(2, (12, 16), 2, TRIM_DARK)
    panel.box((1, 3), (10, 16), -2, ROBE_DARK).box(3, (9, 12), -2, TRIM_DARK)
    return split_skirt('legs_mage_boots', panel, shin=boot().box((1, 3), (8, 10), 1, LEATHER_DARK))


def held_arcane_staff():
    # Two intersecting meridians surround a suspended stone.
    staff = Sculpt().box(0, (-17, 35), 0, LEATHER).box(0, (-17, -16), 0, IRON)
    staff.box((0, 1), (35, 37), (-1, 1), IRON)
    for sign in (-1, 1):
        staff.box(1, 38, 2 * sign, STEEL).box(1, (38, 40), 3 * sign, STEEL)
        staff.box(1, (40, 44), 4 * sign, STEEL)
        staff.box(1, (44, 46), 3 * sign, STEEL).box(1, 46, 2 * sign, STEEL)
    staff.box(1, 47, (-2, 2), STEEL).box(1, 37, (-2, 2), STEEL)
    staff.box((1, 4), 39, 0, IRON).box(4, (40, 44), 0, IRON)
    staff.box((1, 4), 45, 0, IRON)
    staff.box((0, 1), (41, 43), (-1, 1), STOLE).box(1, 42, 0, GLOW)
    return mage_weapon('held_arcane_staff', staff)


def held_spell_tome():
    book = Sculpt().box((-3, 0), (-4, 4), (-2, 3), LEATHER_DARK)
    book.box((-2, -1), (-3, 3), (-2, 3), TRIM).box((-2, -1), (-4, 4), -2, LEATHER)
    book.box(-3, (-4, 4), -1, LEATHER).box((-3, 0), 0, (2, 3), IRON)
    return mage_weapon('held_spell_tome', book)


def headwear_furnace_helm():
    helm = Sculpt().box((-4, 3), (69, 72), (-3, 6), IRON)
    helm.box((-3, 2), 73, (-3, 5), STEEL).box((-2, 1), 74, (-2, 3), IRON)
    helm.box((-4, 3), (65, 68), (-3, 2), IRON)
    helm.box((-3, 2), (65, 69), (4, 7), IRON).box((-2, 1), 68, 7, GLOW)
    helm.box((-3, 2), 69, (5, 7), STEEL).box((-1, 0), (64, 67), 7, STEEL)
    return mage_headwear('headwear_furnace_helm', helm)


def torso_furnace_plate():
    pauldron = upper(ROBE_DARK).box((4, 8), (28, 30), (-2, 2), IRON)
    pauldron.box((5, 7), 31, (-1, 1), STEEL)
    pauldron.box((6, 7), (31, 33), -1, IRON).box(7, 33, 0, STEEL)
    pauldron.box((5, 8), 29, 3, STEEL).box((5, 7), 28, 2, IRON)
    part, chest = coat('torso_furnace_plate', pauldron, sleeve(LEATHER).box((12, 14), ARM_Y, (-1, 1), IRON),
                       other_shoulder=upper(ROBE).box((4, 6), 30, (-1, 1), IRON))
    chest.fill(-3, 27, TORSO_FRONT, 3, 29, OUTER_FRONT, STEEL)
    chest.fill(-2, 25, TORSO_FRONT, 2, 27, OUTER_FRONT, IRON)
    chest.fill(-1, 24, TORSO_FRONT, 1, 25, OUTER_FRONT, IRON)
    core.low_collar(part, IRON)
    return part


def legs_furnace_greaves():
    plates = skirt_panel(12).box((2, 3), (15, 16), 2, IRON).box(3, (14, 17), (0, 1), STEEL)
    return split_skirt('legs_furnace_greaves', plates.cut(4, (13, 18), (-2, 2)), shin=boot().box((1, 3), (4, 9), 1, IRON), toe=IRON)


def held_cinder_cleaver():
    blade = Sculpt().box(0, (-6, 5), 0, LEATHER_DARK).box((0, 4), 5, 0, GOLD_DARK)
    blade.box((0, 3), (6, 27), 0, IRON).box(3, (7, 28), 0, STEEL)
    blade.box((1, 3), (28, 30), 0, IRON).box(3, (30, 32), 0, STEEL)
    blade.box(1, (6, 23), 1, IRON)
    return mage_weapon('held_cinder_cleaver', blade)


def lantern_frame(side, core_tone):
    """Hang the vessel below a loop. Leave windows between the iron posts."""
    x0, x1 = sorted((0, 4 * side))
    mid = 2 * side
    frame = Sculpt().box((x0, x1), 0, 0, IRON).box(4 * side, 0, (0, 4), IRON)
    frame.box(0, 0, (0, 4), IRON).box((x0, x1), (-2, 2), 4, IRON)
    frame.box((mid - 1, mid + 1), (-1, 1), (5, 9), core_tone)
    for x in (x0, x1):
        for y in (-2, 2):
            frame.box(x, y, (5, 9), IRON)
    frame.box((x0, x1), (-2, 2), 10, IRON).box(mid, 0, 11, STEEL)
    return frame


def held_brazier():
    bowl = Sculpt().box((-4, 0), 0, 0, IRON)
    for x in (-4, 0):
        bowl.box(x, (-4, 0), 0, IRON)
    bowl.box((-5, 0), -4, (-3, 3), IRON)
    bowl.box((-4, -1), (-9, -5), (-2, 2), STOLE)
    for x in (-5, 0):
        for z in (-3, 3):
            bowl.box(x, (-9, -5), z, IRON)
    bowl.box((-5, 0), -10, (-3, 3), IRON).box((-4, -1), -11, (-2, 2), STEEL)
    return mage_weapon('held_brazier', bowl)


def headwear_rime_crown():
    felt = hood().box((-4, 3), 70, (-3, 6), IRON)
    felt.box((-3, 2), 71, (5, 7), STEEL).box((-1, 0), (71, 72), 7, STOLE)
    for x in (-4, 3):
        felt.box(x, (71, 73), (0, 4), STEEL).box(x, 74, (-2, 1), STEEL)
    return mage_headwear('headwear_rime_crown', felt)


def torso_rime_parka():
    fur = upper(ROBE).box((4, 7), (28, 30), (-2, 2), TRIM_DARK)
    fur.box((4, 6), 31, (-1, 1), TRIM)
    ice = upper(ROBE).box((4, 7), (29, 31), (-2, 1), CLOTH_SEC)
    ice.box((5, 7), (31, 32), (-1, 0), STOLE).box(7, (32, 34), 0, STOLE)
    ice.box(6, (32, 33), 1, STEEL).box(5, (31, 32), -2, STEEL)
    part, chest = coat('torso_rime_parka', ice, sleeve(ROBE_DARK), other_shoulder=fur)
    core.low_collar(part, TRIM_DARK, turtleneck=True)
    chest.fill(-3, 28, OUTER_BACK, 3, 29, OUTER_FRONT, TRIM_DARK)
    for x in (-2, 2):
        chest.fill(x, 26, TORSO_FRONT, x, 28, OUTER_FRONT, TRIM)
    chest.fill(-1, 24, TORSO_FRONT, -1, 27, OUTER_FRONT, CLOTH_SEC)
    return part


def legs_rime_mukluks():
    panel = skirt_panel(11).box((2, 4), 12, (-2, 1), CLOTH_SEC)
    return split_skirt('legs_rime_mukluks', panel, shin=boot().box((1, 3), (7, 10), (-1, 1), CLOTH_SEC_DARK))


def held_glacier_lance():
    lance = Sculpt().box(0, (-16, 30), 0, IRON).box(0, (-3, 3), 0, LEATHER)
    lance.box((0, 2), (30, 36), 0, STEEL).box((1, 3), (33, 41), 0, STOLE)
    lance.box((2, 3), (42, 45), 0, STOLE).box(3, (46, 49), 0, STOLE)
    lance.box(2, (34, 41), 1, TRIM).box((4, 5), (33, 35), 0, STEEL)
    lance.box(5, (36, 39), 0, STOLE).box(2, (34, 41), (-2, 1), STOLE)
    lance.box(3, (38, 44), -1, STEEL)
    return mage_weapon('held_glacier_lance', lance)


def held_rime_aegis():
    shield = Sculpt().box(0, (-1, 1), (-2, 2), LEATHER)
    for half, lo, hi in [(2, -7, 7), (4, -5, 5), (5, -3, 3)]:
        shield.box((-5 - half, -5 + half), (lo, hi), (1, 2), STEEL)
    shield.box((-7, -3), (-4, 4), 3, CLOTH_SEC).box(-5, (-3, 3), 4, STOLE)
    return mage_weapon('held_rime_aegis', shield)


def headwear_eclipse_mask():
    cowl = hood().box((-3, 2), (66, 67), 6, IRON)
    cowl.box((-2, 1), (66, 67), (5, 7), IRON)
    cowl.box((-2, 1), (64, 65), (5, 7), IRON).box((-1, 0), 68, 7, STEEL)
    cowl.box((-2, 1), 70, 7, ROBE_DARK)
    return mage_headwear('headwear_eclipse_mask', cowl)


def torso_eclipse_wrap():
    part, chest = coat('torso_eclipse_wrap', upper(ROBE_DARK).box((4, 6), (28, 30), (-2, 1), CLOTH_SEC), sleeve(CLOTH_SEC))
    lapel(chest, -1, CLOTH_SEC, ROBE_LIGHT)
    chest.fill(2, 27, TORSO_FRONT, 3, 29, OUTER_FRONT, CLOTH_SEC)
    chest.set(2, 28, OUTER_FRONT, STOLE)
    core.low_collar(part, CLOTH_SEC, turtleneck=True)
    return part


def legs_eclipse_spats():
    panel = skirt_panel(11).box((2, 4), (11, 12), -2, CLOTH_SEC)
    panel.box((2, 3), (10, 16), -2, CLOTH_SEC).box(3, 9, -2, CLOTH_SEC)
    return split_skirt('legs_eclipse_spats', panel)


def back_eclipse_gate():
    shroud = Sculpt().box((-2, 2), (24, 30), (-4, -2), ROBE_DARK)
    shroud.both((2, 4), (25, 30), -4, CLOTH_SEC)
    shroud.both((4, 6), (28, 32), -5, CLOTH_SEC)
    shroud.both((6, 8), (31, 33), -6, ROBE_LIGHT)
    shroud.both((8, 9), (32, 34), -6, ROBE_DARK)
    shroud.both((3, 4), (23, 25), -5, ROBE_DARK)
    shroud.both((5, 6), (26, 28), -6, ROBE_DARK)
    return cloak('back_eclipse_gate', shroud)


def held_storm_fork():
    fork = Sculpt().box(0, (-18, 20), 0, IRON).box(0, (-3, 2), 0, LEATHER)
    fork.box((-6, 0), 21, 0, STEEL).box(-2, (21, 34), 0, STEEL)
    fork.box(-6, (21, 28), 0, IRON).box(-5, (28, 30), 0, STEEL)
    fork.box(0, (21, 28), 0, IRON).box(-1, (28, 30), 0, STEEL)
    return mage_weapon('held_storm_fork', fork)


def held_void_lantern():
    return mage_weapon('held_void_lantern', lantern_frame(1, GLOW))


# --------------------------------------------------------------------------
# Goblins (bipedal monster bodies + crooked goblin gear)
# --------------------------------------------------------------------------

def goblin_body(body_id, *, shaman=False):
    """Wiry, sneaky goblin body with wide swept-out pointed ears, hooked snout, and V-tapered torso."""
    part = vk.VoxelPart(body_id)

    def attach(bone, tag, sculpt, *, twin=False, pad=0):
        grid = core.seg(part, bone, *sculpt.bounds(), tag=tag, pad=pad)
        sculpt.write(grid)
        if twin:
            core.add_twin(part, grid)

    # Pelvis: ragged belt & loincloth flap (z = -1..1 -> center Z = +0.025 m).
    hips = Sculpt().box((-2, 2), (18, 21), (-1, 1), GOB_SKIN)
    hips.box((-2, 2), (20, 21), (-2, 2), GOB_HIDE_DARK)
    hips.box(0, (20, 21), 2, GOB_IRON if not shaman else GOB_FANG)
    hips.box((-1, 1), (17, 19), 2, GOB_CLOTH if shaman else GOB_HIDE)
    hips.box(0, 16, 2, GOB_CLOTH_DARK if shaman else GOB_HIDE_DARK)
    hips.box((-1, 1), (17, 19), -2, GOB_HIDE_DARK)
    attach('pelvis', 'hips', hips)

    # Waist (spine_02): narrow 5-wide midriff (0.25 m) for clear V-taper vs 0.45 m shoulder span.
    waist = Sculpt().box((-2, 2), (22, 24), (-1, 1), GOB_SKIN)
    if shaman:
        waist.box((-2, 2), 22, 2, GOB_CLOTH)
    else:
        waist.box(0, (22, 24), 2, GOB_HIDE_DARK)
    attach('spine_02', 'chest', waist)

    # Chest (spine_03): 7-wide ribcage + 9-wide shoulder bridge (0.45 m -> waist/chest = 0.56 <= 0.82).
    chest = Sculpt().box((-3, 3), (25, 29), (-2, 2), GOB_SKIN)
    chest.box((-4, 4), (27, 29), (-1, 2), GOB_SKIN)                      # Shoulder bridge into arm_x=4
    chest.box((-3, 3), (29, 31), (-3, -1), GOB_SKIN_DARK)                # Subtle sneaky hunched upper back
    if shaman:
        # Tattered shaman shawl + glowing bone/skull fetish necklace.
        chest.box((-3, 3), (28, 30), (-2, 2), GOB_CLOTH)
        chest.box((-2, 2), 27, 2, GOB_FANG)
        chest.box(0, 26, 2, GOB_MARK)
        chest.both(3, (28, 29), 2, GOB_CLOTH_DARK)
    else:
        # Patchwork leather bandolier + rusty shoulder scrap.
        for step, row in enumerate(range(25, 30)):
            x = -2 + step
            chest.box((x - 1, x), row, 2, GOB_HIDE_DARK)
        chest.box((-3, -2), 28, 2, GOB_IRON)
        chest.box(1, 27, 2, GOB_IRON)
    attach('spine_03', 'chest', chest, pad=PAD_JOINT)

    # Head (y = 30..36, z = 0..5 -> depth 0.30 m >= 0.24 m, forward offset +0.125 m >= 0.025 m).
    head = Sculpt().box((-2, 2), (30, 34), (0, 3), GOB_SKIN)
    head.box((-2, 2), 30, 4, GOB_SKIN_DARK)                              # Pointed protruding goblin chin
    head.box((-1, 1), 31, 3, GOB_MOUTH)                                  # Wide toothy grin
    head.both(1, 31, 4, GOB_FANG)                                        # Corner goblin fangs
    head.box(0, (32, 33), 4, GOB_SKIN_LIGHT)                             # Prominent hooked goblin nose
    head.box(0, 32, 5, GOB_SKIN_LIGHT)                                   # Nose tip
    head.both(1, 33, 3, GOB_EYE)                                         # Bright mischievous goblin eyes
    head.box((-2, 2), 34, (1, 4), GOB_SKIN_DARK)                         # Heavy furrowed brow
    head.both(1, 34, 4, 0)                                               # Open the brow above the eyes
    # Long swept-out pointed goblin ears (|x| = 3..5) — unmistakable goblin silhouette!
    head.both(3, (32, 33), (1, 2), GOB_SKIN)
    head.both(4, (33, 34), 1, GOB_SKIN_LIGHT)
    head.both(5, 34, 0, GOB_SKIN_DARK)
    if shaman:
        # Carved bone shaman crown + glowing hex crest + feather tuft.
        head.box((-2, 2), 35, (0, 3), GOB_FANG)
        head.box(0, 35, 4, GOB_MARK)
        head.box(0, (36, 37), (0, 2), GOB_CLOTH)
        head.box(0, 37, 2, GOB_MARK)
    else:
        # Patchwork leather scavenger hood + brass tinkerer goggles pushed up on forehead.
        head.box((-2, 2), 35, (0, 3), GOB_HIDE_DARK)
        head.both(1, 35, 4, GOB_IRON)
        head.box(0, 35, 4, GOB_HIDE)
        head.box((-1, 1), 36, (0, 2), GOB_HIDE)
    attach('Head', 'head', head)

    # Wiry lanky goblin arms.
    upper = Sculpt().box((4, 10), (27, 29), (0, 1), GOB_SKIN)
    if shaman:
        upper.box((4, 6), (28, 30), (0, 1), GOB_CLOTH_DARK)
        upper.box(5, 30, 1, GOB_FANG)
    else:
        upper.box((4, 6), (28, 30), (0, 1), GOB_HIDE)
        upper.box(5, 30, 1, GOB_IRON)
    attach('upperarm_l', 'arms_upper', upper, twin=True)

    forearm = Sculpt().box((10, 15), (28, 29), (0, 1), GOB_SKIN)
    forearm.box((13, 15), (28, 29), (0, 1), GOB_CLOTH_DARK if shaman else GOB_HIDE_DARK)
    if shaman:
        forearm.box(14, 29, 1, GOB_MARK)
    attach('lowerarm_l', 'arms_lower', forearm, twin=True, pad=PAD_JOINT)

    core.claw_hands(
        part,
        palm=GOB_SKIN,
        fingers=GOB_SKIN_DARK,
        cuff=GOB_HIDE_DARK,
        tag='hands',
    )

    # Nimble legs & long clawed goblin feet (z = -1..3 -> 0.25 m >= 0.22 m).
    thigh = Sculpt().box((1, 3), (11, 18), (-1, 1), GOB_SKIN)
    thigh.box((1, 3), (15, 17), (-1, 1), GOB_HIDE_DARK)
    attach('thigh_l', 'legs_upper', thigh, twin=True, pad=PAD_JOINT)

    calf = Sculpt().box((1, 2), (2, 11), (-1, 0), GOB_SKIN_DARK)
    calf.box((1, 2), (5, 7), (-1, 0), GOB_HIDE)
    attach('calf_l', 'legs_lower', calf, twin=True)

    foot = Sculpt().box((1, 3), (0, 1), (-1, 2), GOB_HIDE_DARK if not shaman else GOB_SKIN_DARK)
    foot.box(1, 0, 3, GOB_FANG).box(3, 0, 3, GOB_FANG)
    attach('foot_l', 'feet', foot, twin=True)
    return part


def held_goblin_dagger():
    """Crooked notched goblin shiv/dagger for right hand (`hand_r`)."""
    part = vk.VoxelPart('held_goblin_dagger')
    grid = _static_grid(part, (0, 1), (-4, 14), (-1, 3))
    grid.fill(0, -3, 0, 0, 1, 0, GOB_HIDE_DARK)
    grid.set(0, -4, 0, GOB_IRON)
    grid.fill(0, 2, -1, 0, 2, 2, GOB_IRON)
    grid.fill(0, 3, 0, 0, 9, 1, GOB_IRON)
    grid.fill(0, 4, 2, 0, 11, 2, GOB_STEEL)
    grid.set(0, 7, 2, 0)                                                  # Jagged notch
    grid.fill(0, 10, 1, 0, 13, 1, GOB_STEEL)
    grid.set(0, 14, 0, GOB_STEEL)
    return part


def held_goblin_totem_staff():
    """Gnarled goblin hex-totem staff with skull mask & glowing crystal for right hand (`hand_r`)."""
    part = vk.VoxelPart('held_goblin_totem_staff')
    grid = _static_grid(part, (0, 1), (-10, 25), (-2, 2))
    grid.fill(0, -10, 0, 0, 18, 0, GOB_HIDE_DARK)
    grid.fill(0, -2, 0, 0, 2, 0, GOB_HIDE)
    grid.fill(0, 16, 0, 0, 17, 0, GOB_CLOTH)
    # Carved skull fetish & glowing hex gem at the top.
    grid.fill(0, 19, -1, 1, 22, 1, GOB_FANG)
    grid.set(0, 21, 2, GOB_MARK)
    grid.set(0, 21, -2, GOB_MARK)
    grid.fill(0, 23, -1, 0, 25, 1, GOB_MARK)
    grid.set(0, 24, 2, GOB_FANG)
    grid.set(0, 24, -2, GOB_FANG)
    return part


# --------------------------------------------------------------------------
# Tables exported to build_fantasy.py
# --------------------------------------------------------------------------

PARTS = (
    ('torso', 'Furnace Plate', torso_furnace_plate, {}),
    ('torso', 'Rime Parka', torso_rime_parka, {}),
    ('torso', 'Eclipse Wrap', torso_eclipse_wrap, {}),
    ('legs', 'Furnace Greaves', legs_furnace_greaves, {'hides_legs_upper': True}),
    ('legs', 'Rime Mukluks', legs_rime_mukluks, {'hides_legs_upper': True}),
    ('legs', 'Eclipse Spats', legs_eclipse_spats, {'hides_legs_upper': True}),
    ('headwear', 'Furnace Helm', headwear_furnace_helm, {'hides_hair': True}),
    ('headwear', 'Rime Crown', headwear_rime_crown, {'hides_hair': True}),
    ('headwear', 'Eclipse Mask', headwear_eclipse_mask, {'hides_hair': True}),
    ('back', 'Storm Moth Wings', back_eclipse_gate, {}),
    ('torso', 'Mage Robes', torso_mage_robes, {}),
    ('legs', 'Mage Boots & Trousers', legs_mage_boots, {'hides_legs_upper': True}),
    ('headwear', 'Pointed Wizard Hat', headwear_mage_hat, {'hides_hair': True}),
    ('headwear', 'Arcane Hood', headwear_mage_hood, {'hides_hair': True}),
    ('body', 'Goblin Scavenger', lambda: goblin_body('body_goblin_scavenger'), {}),
    ('body', 'Goblin Shaman', lambda: goblin_body('body_goblin_shaman', shaman=True), {}),
)

HELD = (
    ('Arcane Staff', 'hand_r', held_arcane_staff),
    ('Spell Tome', 'hand_l', held_spell_tome),
    ('Cinder Cleaver', 'hand_r', held_cinder_cleaver),
    ('Brazier', 'hand_l', held_brazier),
    ('Glacier Lance', 'hand_r', held_glacier_lance),
    ('Rime Aegis', 'hand_l', held_rime_aegis),
    ('Storm Fork', 'hand_l', held_storm_fork),
    ('Void Lantern', 'hand_r', held_void_lantern),
    ('Goblin Shiv', 'hand_r', held_goblin_dagger),
    ('Goblin Totem Staff', 'hand_r', held_goblin_totem_staff),
)

PRESETS = (
    core.preset(
        'fantasy_arcane_mage', 'fantasy', 'Arcane Archmage', 'Staff_Idle_Loop',
        {'skin': '#c9a78b', 'hair': '#b7b7af', 'primary': '#3e4560', 'secondary': '#464653',
         'accent': '#7c9caf', 'metal': '#a08a6b', 'trim': '#979b9f', 'leather': '#594338',
         'visor': '#252731', 'detail': '#7c9caf'},
        body='body_athletic', head='head_bearded_craftsman', hair='hair_slick_back',
        torso='torso_mage_robes', legs='legs_mage_boots',
        headwear='headwear_mage_hat',
        held_right='held_arcane_staff', held_left='held_spell_tome',
        proportions={
            'height': 0.99, 'legRatio': 0.90, 'build': -0.1,
            'shoulderWidth': 1.52, 'torsoBulk': 0.98, 'waistScale': 0.96,
            'headScale': 1.0, 'limbThickness': 0.96, 'armLength': 0.96,
        },
    ),
    core.preset(
        'fantasy_ember_battlemage', 'fantasy', 'Ember Battlemage', 'Idle_Shield_Loop',
        {'skin': '#b78671', 'hair': '#342f32', 'primary': '#673b41', 'secondary': '#46444b',
         'accent': '#df783e', 'metal': '#656972', 'trim': '#a29c93', 'leather': '#544139',
         'visor': '#26282c', 'detail': '#985833'},
        body='body_heavy', head='head_scarred_veteran', hair='hair_cropped_fade',
        torso='torso_furnace_plate', legs='legs_furnace_greaves',
        headwear='headwear_furnace_helm',
        held_right='held_cinder_cleaver', held_left='held_brazier',
        proportions={
            'height': 0.97, 'legRatio': 0.92, 'build': 0.55,
            'shoulderWidth': 1.64, 'torsoBulk': 1.06, 'waistScale': 0.94,
            'headScale': 1.0, 'limbThickness': 0.95, 'armLength': 0.96,
        },
    ),
    core.preset(
        'fantasy_frost_cryomancer', 'fantasy', 'Frost Cryomancer', 'Staff_Idle_Loop',
        {'skin': '#c4aba0', 'hair': '#514740', 'primary': '#44596a', 'secondary': '#404956',
         'accent': '#91b9c5', 'metal': '#596570', 'trim': '#a6a398', 'leather': '#534840',
         'visor': '#292d37', 'detail': '#a0bdc6'},
        body='body_slim', head='head_keen_scout', hair='hair_cropped_fade',
        torso='torso_rime_parka', legs='legs_rime_mukluks',
        headwear='headwear_rime_crown',
        held_right='held_glacier_lance', held_left='held_rime_aegis',
        proportions={
            'height': 1.04, 'legRatio': 0.92, 'build': -0.55,
            'shoulderWidth': 1.35, 'torsoBulk': 0.96, 'waistScale': 0.94,
            'headScale': 1.0, 'limbThickness': 0.95, 'armLength': 0.96,
        },
    ),
    core.preset(
        'fantasy_storm_warlock', 'fantasy', 'Storm Warlock', 'Idle_Torch_Loop',
        {'skin': '#a59a94', 'hair': '#35333a', 'primary': '#41435b', 'secondary': '#6b5979',
         'accent': '#706a88', 'metal': '#626572', 'trim': '#918777', 'leather': '#50413e',
         'visor': '#21252c', 'detail': '#9b8262'},
        body='body_athletic', head='head_rugged_hero', hair='hair_cropped_fade',
        torso='torso_eclipse_wrap', legs='legs_eclipse_spats',
        headwear='headwear_eclipse_mask', back='back_eclipse_gate',
        held_right='held_void_lantern', held_left='held_storm_fork',
        proportions={
            'height': 1.02, 'legRatio': 0.99, 'build': -0.25,
            'shoulderWidth': 1.46, 'torsoBulk': 0.98, 'waistScale': 0.94,
            'headScale': 1.0, 'limbThickness': 0.95, 'armLength': 0.96,
        },
    ),
    core.preset(
        'fantasy_goblin_scavenger', 'fantasy', 'Goblin Scavenger', 'Idle_Loop',
        {'skin': '#739842', 'hair': '#272420', 'primary': '#8c4b34', 'secondary': '#4f554b',
         'accent': '#ffbf3f', 'metal': '#6d7378', 'trim': '#ebe0be', 'leather': '#5c3c28',
         'visor': '#18181b', 'detail': '#b84b36'},
        body='body_goblin_scavenger', head=None, hair=None, torso=None, legs=None,
        held_right='held_goblin_dagger', held_left=None,
        proportions={
            'height': 0.76, 'legRatio': 0.82, 'build': 0.0,
            'shoulderWidth': 1.44, 'torsoBulk': 0.92, 'waistScale': 0.78,
            'headScale': 1.24, 'limbThickness': 0.86, 'armLength': 0.98,
        },
    ),
    core.preset(
        'fantasy_goblin_shaman', 'fantasy', 'Goblin Shaman', 'Idle_Loop',
        {'skin': '#5c8a5a', 'hair': '#242622', 'primary': '#7c3f6c', 'secondary': '#444b52',
         'accent': '#56f0d8', 'metal': '#687179', 'trim': '#efe5c4', 'leather': '#553a2a',
         'visor': '#171a1e', 'detail': '#4de2c8'},
        body='body_goblin_shaman', head=None, hair=None, torso=None, legs=None,
        held_right='held_goblin_totem_staff', held_left=None,
        proportions={
            'height': 0.78, 'legRatio': 0.82, 'build': 0.0,
            'shoulderWidth': 1.45, 'torsoBulk': 0.94, 'waistScale': 0.80,
            'headScale': 1.24, 'limbThickness': 0.86, 'armLength': 0.98,
        },
    ),
)
