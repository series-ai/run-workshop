import { describe, expect, it } from 'vitest'
import { DISTRICT_COLLISION } from './district'
import { advanceAttack, attackContactBone, cameraImpulse, cameraOnActorSide, combatMove, startAttack } from './presentation'

const clip = { id: 'punch-right', label: 'Punch Right', category: 'melee', duration: .6, loop: false, contactTime: .2 }
describe('authored attack contact', () => {
  it('keeps damage out of anticipation and applies contact once across a long update', () => {
    let beat = startAttack(clip, 'unarmed', Math.PI)
    const anticipation = advanceAttack(beat, .19)
    expect(anticipation.contact).toBe(false)
    const strike = advanceAttack(anticipation.beat, .05)
    expect(strike.contact).toBe(true)
    const recovery = advanceAttack(strike.beat, .4)
    expect(recovery.contact).toBe(false)
    expect(recovery.finished).toBe(true)
    expect(recovery.beat.facing).toBe(Math.PI)
  })
  it('leaves the timeline unchanged during an impact hold', () => {
    const beat = advanceAttack(startAttack(clip, 'unarmed', 0), .2).beat
    expect(advanceAttack(beat, 0)).toEqual({ beat, contact: false, finished: false })
  })
  it('requires source contact data instead of guessing a strike time', () => {
    expect(() => startAttack({ ...clip, contactTime: undefined }, 'blade', 0)).toThrow('authored contact time')
  })
  it('ends camera movement after a short bounded impulse', () => {
    expect(cameraImpulse(.2, .08)).toEqual([0, 0])
    for (let time = 0; time < .2; time += .01) {
      const [x, y] = cameraImpulse(time, .08)
      expect(Math.abs(x)).toBeLessThanOrEqual(.08)
      expect(Math.abs(y)).toBeLessThanOrEqual(.0361)
    }
  })
  it('places a side camera before the east container for every body sample', () => {
    const safe = cameraOnActorSide(
      { x: 0, y: 0, z: 8.38 },
      { x: 12, y: 1.4, z: 8.38 },
      DISTRICT_COLLISION.obstacles,
    )
    expect(safe.adjusted).toBe(true)
    expect(safe.obstacleIndex).toBe(3)
    expect(safe.x).toBeLessThan(7)
    expect(safe.x).toBeGreaterThan(0)
    expect(safe.y).toBeGreaterThan(0)

    const platformView = cameraOnActorSide(
      { x: 3.94, y: 1.025, z: 5.13 },
      { x: 16, y: 2.4, z: 5.13 },
      DISTRICT_COLLISION.obstacles,
    )
    expect(platformView.adjusted).toBe(false)
  })
})

describe('equipment and role combat actions', () => {
  it('places contact on the active striking limb', () => {
    expect(attackContactBone('elbow-strike')).toBe('Forearm_R')
    expect(attackContactBone('knee-strike')).toBe('Shin_R')
    expect(attackContactBone('kick-air')).toBe('Foot_R')
    expect(attackContactBone('sweep')).toBe('Foot_R')
    expect(attackContactBone('punch-left')).toBe('Hand_L')
    expect(attackContactBone('shield-bash')).toBe('Hand_L')
    expect(attackContactBone('shoulder-check')).toBe('UpperArm_R')
  })
  it('gives staffs, shields, and short weapons their own contact actions', () => {
    expect(combatMove({ id: 'staff', tags: ['held', 'melee', 'staff'] }, 'stick-tall', 0).clip).toBe('staff-thrust')
    expect(combatMove({ id: 'shield-riot', tags: ['held', 'shield'] }, 'stick-sentinel', 0)).toEqual({ clip: 'shield-bash', kind: 'unarmed' })
    expect(combatMove({ id: 'dagger', tags: ['held', 'melee', 'dagger'] }, 'stick-scout', 0).clip).toBe('dagger-stab')
    expect(combatMove({ id: 'hammer-war', tags: ['held', 'melee', 'hammer'] }, 'stick-heavy', 0).clip).toBe('hammer-overhead')
    expect(combatMove({ id: 'laser-cannon', tags: ['held', 'sci-fi', 'heavy', 'cannon'] }, 'stick-heavy', 0)).toEqual({ clip: 'rifle-fire', kind: 'ranged' })
    expect(combatMove(null, 'stick-compact', 0).clip).toBe('elbow-strike')
    expect(combatMove(null, 'stick-striker', 0).clip).toBe('kick-front')
  })
})
