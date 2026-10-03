import { describe, expect, it } from 'vitest'
import { ACTION_BUFFER_SECONDS, getImpactProfile, sampleRecoil, sampleKnockdown, selectReaction, stepActionBuffer } from './kinetics'

const profileFields = [
  'reach', 'facingDot', 'hitHold', 'recoilDistance', 'recoilLift', 'recoilDuration',
  'recoilTilt', 'cameraKick', 'cameraZoom', 'trailDuration', 'trailWidth', 'trailBefore', 'trailAfter',
] as const

describe('kinetic impact profiles', () => {
  it('provides finite bounded profiles for light, heavy, kick, melee, and ranged actions', () => {
    const profiles = [
      getImpactProfile('punch-right', 'unarmed'),
      getImpactProfile('punch-heavy', 'unarmed'),
      getImpactProfile('kick-front', 'unarmed'),
      getImpactProfile('sword-slash', 'blade', 'sword'),
      getImpactProfile('rifle-fire', 'ranged', 'rifle'),
    ]
    for (const profile of profiles) {
      for (const field of profileFields) expect(Number.isFinite(profile[field]), field).toBe(true)
      expect(profile.reach).toBeGreaterThan(0)
      expect(profile.reach).toBeLessThanOrEqual(18)
      expect(profile.facingDot).toBeGreaterThanOrEqual(0)
      expect(profile.facingDot).toBeLessThanOrEqual(1)
      expect(profile.hitHold).toBeGreaterThan(0)
      expect(profile.hitHold).toBeLessThanOrEqual(.1)
      expect(profile.recoilDistance).toBeGreaterThanOrEqual(0)
      expect(profile.recoilDistance).toBeLessThanOrEqual(.9)
      expect(profile.recoilLift).toBeGreaterThanOrEqual(0)
      expect(profile.recoilLift).toBeLessThanOrEqual(.2)
      expect(profile.recoilDuration).toBeGreaterThan(0)
      expect(profile.recoilDuration).toBeLessThanOrEqual(.4)
      expect(profile.recoilTilt).toBeGreaterThanOrEqual(0)
      expect(profile.recoilTilt).toBeLessThanOrEqual(.3)
      expect(profile.trailBefore).toBeGreaterThanOrEqual(0)
      expect(profile.trailAfter).toBeGreaterThanOrEqual(0)
      expect(profile.trailBefore + profile.trailAfter).toBeLessThanOrEqual(profile.trailDuration)
    }
    expect(profiles[1].recoilDistance).toBeGreaterThan(profiles[0].recoilDistance)
    expect(profiles[2].reach).toBeGreaterThan(profiles[0].reach)
    expect(profiles[4].facingDot).toBeGreaterThan(profiles[0].facingDot)
  })

  it('uses equipment identity to adjust readable reach and recoil', () => {
    const sword = getImpactProfile('sword-slash', 'blade', 'sword')
    const hammer = getImpactProfile('hammer-overhead', 'blade', 'hammer-war')
    const dagger = getImpactProfile('dagger-stab', 'blade', 'dagger')
    const rifle = getImpactProfile('rifle-fire', 'ranged', 'rifle')
    const shotgun = getImpactProfile('shotgun-fire', 'ranged', 'shotgun')
    expect(hammer.reach).toBeGreaterThan(sword.reach)
    expect(dagger.reach).toBeLessThan(sword.reach)
    expect(shotgun.cameraKick).toBeGreaterThan(rifle.cameraKick)
    expect(getImpactProfile('unknown-clip', 'unknown')).toEqual(getImpactProfile('punch-right', 'unarmed'))
  })

  it('keeps every authored profile inside the fixed trail pool', () => {
    const cases: Array<[string, string, string?]> = [
      ['punch-right', 'unarmed'], ['punch-heavy', 'unarmed'], ['kick-front', 'unarmed'],
      ['sword-slash', 'blade', 'sword'], ['sword-slash', 'blade', 'hammer-war'],
      ['dagger-stab', 'blade', 'dagger'], ['staff-thrust', 'blade', 'staff'],
      ['shield-slam', 'unarmed', 'shield'], ['pistol-fire', 'ranged', 'pistol'],
      ['rifle-fire', 'ranged', 'rifle'], ['shotgun-fire', 'ranged', 'shotgun'],
      ['bow-release', 'ranged', 'bow'],
    ]
    for (const [clip, kind, equipment] of cases) {
      const profile = getImpactProfile(clip, kind, equipment)
      expect(Object.isFrozen(profile)).toBe(true)
      expect(profile.trailDuration).toBeGreaterThan(0)
      expect(profile.trailDuration).toBeLessThanOrEqual(.18)
      expect(profile.trailBefore + profile.trailAfter).toBeLessThanOrEqual(profile.trailDuration)
      expect(getImpactProfile(clip, kind, equipment)).toBe(profile)
    }
  })
})

describe('kinetic recoil sampling', () => {
  it('starts and ends at zero, with a bounded early peak', () => {
    const light = getImpactProfile('punch-right', 'unarmed')
    const heavy = getImpactProfile('punch-heavy', 'unarmed')
    expect(sampleRecoil(light, 0)).toEqual({ travel: 0, lift: 0, tilt: 0, done: false })
    expect(sampleRecoil(light, light.recoilDuration)).toEqual({ travel: 0, lift: 0, tilt: 0, done: true })
    const peak = sampleRecoil(heavy, heavy.recoilDuration * .25)
    expect(peak.done).toBe(false)
    expect(peak.travel).toBeCloseTo(.85)
    expect(peak.lift).toBeCloseTo(.18)
    expect(peak.tilt).toBeCloseTo(heavy.recoilTilt)
    expect(sampleRecoil(heavy, heavy.recoilDuration * .5).travel).toBeLessThan(peak.travel)
    expect(sampleRecoil(heavy, heavy.recoilDuration * 2)).toEqual({ travel: 0, lift: 0, tilt: 0, done: true })
    expect(sampleRecoil(light, -1)).toEqual({ travel: 0, lift: 0, tilt: 0, done: false })
  })

  it('rejects non-finite reaction ages', () => {
    expect(() => sampleRecoil(getImpactProfile('punch-right', 'unarmed'), Number.NaN)).toThrow()
    expect(() => sampleRecoil(getImpactProfile('punch-right', 'unarmed'), Number.POSITIVE_INFINITY)).toThrow()
  })
})

describe('kinetic action buffer', () => {
  it('expires after 160 ms when the action is not ready', () => {
    expect(ACTION_BUFFER_SECONDS).toBe(.16)
    const aged = stepActionBuffer(ACTION_BUFFER_SECONDS, .1, false)
    expect(aged).toEqual({ remaining: .06, consume: false })
    expect(stepActionBuffer(aged.remaining, .06, false)).toEqual({ remaining: 0, consume: false })
    expect(stepActionBuffer(0, 0, true)).toEqual({ remaining: 0, consume: false })
  })

  it('consumes one queued edge and never repeats it', () => {
    const consumed = stepActionBuffer(ACTION_BUFFER_SECONDS, .016, true)
    expect(consumed).toEqual({ remaining: 0, consume: true })
    expect(stepActionBuffer(consumed.remaining, .016, true)).toEqual({ remaining: 0, consume: false })
    expect(stepActionBuffer(.01, .2, true)).toEqual({ remaining: 0, consume: true })
  })

  it('does not age the buffer with a negative delta and rejects non-finite values', () => {
    expect(stepActionBuffer(.1, -.2, false)).toEqual({ remaining: .1, consume: false })
    expect(() => stepActionBuffer(Number.NaN, .1, false)).toThrow()
    expect(() => stepActionBuffer(.1, Number.POSITIVE_INFINITY, false)).toThrow()
  })
})

describe('directional reactions', () => {
  it('uses impact direction in the target frame for all four sides', () => {
    for (const facing of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const forward = { x: Math.sin(facing), z: Math.cos(facing) }
      const right = { x: Math.cos(facing), z: -Math.sin(facing) }
      expect(selectReaction(forward, facing, false).clip).toBe('hit-back')
      expect(selectReaction({ x: -forward.x, z: -forward.z }, facing, false).clip).toBe('hit-front')
      expect(selectReaction(right, facing, false).clip).toBe('hit-left')
      expect(selectReaction({ x: -right.x, z: -right.z }, facing, false).clip).toBe('hit-right')
    }
  })
  it('falls forward from a rear hit and aligns side falls without a half turn', () => {
    for (let angle = -Math.PI; angle <= Math.PI; angle += Math.PI / 12) {
      const force = { x: Math.sin(angle), z: Math.cos(angle) }
      const reaction = selectReaction(force, 0, true)
      const sign = reaction.clip === 'death' ? 1 : -1
      expect(Math.sin(reaction.facing) * sign).toBeCloseTo(force.x)
      expect(Math.cos(reaction.facing) * sign).toBeCloseTo(force.z)
      expect(Math.abs(reaction.facing)).toBeLessThanOrEqual(Math.PI / 2 + 1e-8)
    }
    expect(selectReaction({ x: 0, z: 1 }, 0, true).clip).toBe('death')
    expect(selectReaction({ x: 0, z: -1 }, 0, true).clip).toBe('knockdown')
  })
  it('keeps a knocked-down target at its landing position until recovery', () => {
    const profile = getImpactProfile('punch-heavy', 'unarmed')
    const samples = Array.from({ length: 241 }, (_, i) => sampleKnockdown(profile, i / 60))
    expect(samples[0].travel).toBe(0)
    for (let i = 1; i < samples.length; i++) expect(samples[i].travel).toBeGreaterThanOrEqual(samples[i - 1].travel)
    expect(samples.at(-1)?.travel).toBeGreaterThan(.4)
    expect(samples.at(-1)?.lift).toBe(0)
    expect(samples.at(-1)).toEqual(sampleKnockdown(profile, 10))
  })
  it('rejects non-finite direction input', () => {
    expect(() => selectReaction({ x: NaN, z: 1 }, 0, false)).toThrow()
    expect(() => selectReaction({ x: 0, z: 1 }, Infinity, false)).toThrow()
  })
})
