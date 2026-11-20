import { describe, expect, it } from 'vitest'
import { BUDGETS } from './budgets'
import { AVATAR_SLOTS, REQUIRED_SLOTS } from './catalog'
import { leavesFor, POLY_PACK_KEYS } from './packs'
import { PALETTE_REGIONS, PALETTE_REGION_U } from './palette'
import {
  AQUATIC_RIG,
  ARACHNID_RIG,
  AVIAN_RIG,
  DRAGON_RIG,
  KAIJU_RIG,
  QUADRUPED_RIG,
  RIG_IDS,
  RIG_SPECS,
  SERPENT_RIG,
  UAL1_CLIPS,
  UAL1_JOINTS,
  UAL1_RIG,
} from './rig'

describe('run-chisel-packs contracts', () => {
  it('defines the canonical 53-joint Quaternius UAL1 skeleton, creature rigs, and clips', () => {
    expect(RIG_IDS).toEqual(['ual1', 'quadruped', 'arachnid', 'avian', 'dragon', 'kaiju', 'serpent', 'aquatic'])
    expect(UAL1_RIG.jointCount).toBe(53)
    expect(UAL1_JOINTS).toHaveLength(53)
    expect(UAL1_JOINTS[0]).toBe('root')
    expect(UAL1_JOINTS).toContain('Head')
    expect(UAL1_JOINTS).toContain('hand_r')
    expect(UAL1_JOINTS).toContain('hand_l')
    expect(UAL1_CLIPS).toHaveLength(89)
    expect(UAL1_CLIPS).toContain('Idle_Loop')
    expect(UAL1_CLIPS).toContain('Sword_Attack')
    expect(UAL1_CLIPS).toContain('Pistol_Shoot')
    expect(UAL1_CLIPS).toContain('Dance_Loop')
    expect(UAL1_CLIPS).toContain('Sword_Regular_Combo')
    expect(UAL1_CLIPS).toContain('Zombie_Walk_Fwd_Loop')
    expect(UAL1_CLIPS).toContain('Idle_TalkingPhone_Loop')
    expect(UAL1_CLIPS).toContain('Ranged_2H_Aiming')
    expect(UAL1_CLIPS).toContain('Ranged_2H_Shooting')
    expect(UAL1_CLIPS).toContain('Ranged_2H_Reload')

    expect(QUADRUPED_RIG.joints).toHaveLength(23)
    expect(ARACHNID_RIG.joints).toHaveLength(28)
    expect(AVIAN_RIG.joints).toHaveLength(21)
    expect(DRAGON_RIG.joints).toHaveLength(28)
    expect(KAIJU_RIG.joints).toHaveLength(22)
    expect(SERPENT_RIG.joints).toHaveLength(12)
    expect(AQUATIC_RIG.joints).toHaveLength(13)

    expect(RIG_SPECS.quadruped.clips).toEqual([
      'Idle',
      'Walk',
      'Run',
      'Attack',
      'Death',
      'Howl',
      'Trot',
      'Jump',
      'Sit',
      'Sleep',
      'Sneak',
      'Bite',
      'Swim',
      'Eating',
      'Rear',
      'Kick',
    ])
    expect(RIG_SPECS.arachnid.clips).toEqual(['Idle', 'Walk', 'Run', 'Attack', 'Death', 'Threat', 'Jump', 'Bite', 'Eating'])
    expect(RIG_SPECS.avian.clips).toEqual(['Idle', 'Walk', 'Hop', 'Take_Off', 'Flap', 'Glide', 'Land', 'Death'])
    expect(RIG_SPECS.dragon.clips).toEqual([
      'Idle',
      'Walk',
      'Attack',
      'Fire_Breath',
      'Roar',
      'Take_Off',
      'Fly_Flap',
      'Fly_Glide',
      'Land',
      'Hurt',
      'Death',
    ])
    expect(RIG_SPECS.kaiju.clips).toEqual(['Idle', 'Walk', 'Attack', 'Tail_Attack', 'Roar', 'Hit', 'Swim', 'Death'])
    expect(RIG_SPECS.serpent.clips).toEqual(['Idle', 'Coiled', 'Sidewinding', 'Bite', 'Dance', 'Hit', 'Death'])
    expect(RIG_SPECS.aquatic.clips).toEqual(['Idle', 'Swim_Horizontal', 'Swim_Vertical', 'Bite', 'Hit', 'Dead_Floating'])
  })

  it('keeps composed character triangles within S23 Ultra budget', () => {
    const worstCase =
      BUDGETS.classes.body.maxTriangles +
      BUDGETS.classes.head.maxTriangles +
      BUDGETS.classes.torso.maxTriangles +
      BUDGETS.classes.legs.maxTriangles
    expect(worstCase).toBeLessThanOrEqual(2600)
    expect(BUDGETS.mobilePolicy.maxTrianglesPerComposedAvatar).toBe(2200)
    expect(BUDGETS.mobilePolicy.shadowMaps).toBe(false)
    expect(BUDGETS.mobilePolicy.maxDpr).toBeLessThanOrEqual(1.5)
  })

  it('defines distinct non-overlapping UV palette bands for all 7 regions', () => {
    const us = PALETTE_REGIONS.map((r) => PALETTE_REGION_U[r])
    expect(new Set(us).size).toBe(7)
    for (let i = 1; i < us.length; i++) {
      expect(us[i]!).toBeGreaterThan(us[i - 1]! + 0.1)
    }
  })

  it('maps every pack to valid jam-ready-assets leaves', () => {
    for (const pack of POLY_PACK_KEYS) {
      const leaves = leavesFor(pack)
      expect(leaves.length).toBeGreaterThanOrEqual(1)
      expect(leaves[0]!.id).toMatch(/^run-chisel-[a-z0-9-]+\/3D\/[a-z0-9-]+$/)
    }
    expect(REQUIRED_SLOTS.every((s) => AVATAR_SLOTS.includes(s))).toBe(true)
  })
})
