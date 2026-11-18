import { describe, expect, it } from 'vitest'
import { BUDGETS } from './budgets'
import { AVATAR_SLOTS, REQUIRED_SLOTS } from './catalog'
import { leavesFor, POLY_PACK_KEYS } from './packs'
import { PALETTE_REGIONS, PALETTE_REGION_U } from './palette'
import { ARACHNID_RIG, QUADRUPED_RIG, RIG_SPECS, UAL1_CLIPS, UAL1_JOINTS, UAL1_RIG } from './rig'

describe('run-poly-packs contracts', () => {
  it('defines the canonical 53-joint Quaternius UAL1 skeleton, creature rigs, and clips', () => {
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
    expect(RIG_SPECS.quadruped.clips).toEqual(['Idle', 'Walk', 'Run', 'Attack', 'Death', 'Howl'])
    expect(RIG_SPECS.arachnid.clips).toEqual(['Idle', 'Walk', 'Run', 'Attack', 'Death'])
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
      expect(leaves[0]!.id).toMatch(/^run-poly-[a-z0-9-]+\/3D\/[a-z0-9-]+$/)
    }
    expect(REQUIRED_SLOTS.every((s) => AVATAR_SLOTS.includes(s))).toBe(true)
  })
})
