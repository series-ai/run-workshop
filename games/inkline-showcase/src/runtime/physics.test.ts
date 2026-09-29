import { describe, expect, it } from 'vitest'
import { moveBody, supportAt, validateAvatar, type Body, type WorldCollision } from './physics'
import { DEFAULT_AVATAR } from '../types'

const world: WorldCollision = { limit: 10, surfaces: [], obstacles: [] }
const body = (): Body => ({ position: { x: 0, y: 0, z: 0 }, velocityY: 0, grounded: true, facing: 0 })
describe('fixed-step movement', () => {
  it('normalizes diagonal speed', () => {
    const forward = body(), diagonal = body()
    for (let i = 0; i < 60; i++) {
      moveBody(forward, { x: 1, z: 0, jump: false, dash: false }, world, 1 / 60)
      moveBody(diagonal, { x: 1, z: 1, jump: false, dash: false }, world, 1 / 60)
    }
    expect(Math.hypot(diagonal.position.x, diagonal.position.z)).toBeCloseTo(forward.position.x)
  })
  it('jumps and returns to the floor without a second air jump', () => {
    const player = body(); let apex = 0, landings = 0
    for (let i = 0; i < 120; i++) {
      const result = moveBody(player, { x: 0, z: 0, jump: i === 0 || i === 10, dash: false }, world, 1 / 60)
      apex = Math.max(apex, player.position.y); landings += Number(result.landed)
    }
    expect(apex).toBeGreaterThan(1); expect(apex).toBeLessThan(1.3)
    expect(player.position.y).toBe(0); expect(landings).toBe(1)
  })
  it('stops at a wall while allowing movement along it', () => {
    const player = body(), walls = { ...world, obstacles: [{ minX: 1, maxX: 2, minY: 0, maxY: 3, minZ: -5, maxZ: 5 }] }
    for (let i = 0; i < 60; i++) moveBody(player, { x: 1, z: .3, jump: false, dash: false }, walls, 1 / 60)
    expect(player.position.x).toBeLessThan(.81); expect(player.position.z).toBeGreaterThan(1)
  })
  it('walks up a connected slope without teleporting onto high platforms', () => {
    const ramp = { ...world, surfaces: [{ minX: 0, maxX: 4, minZ: -1, maxZ: 1, y: 0, slopeX: .25 }, { minX: -2, maxX: 0, minZ: -1, maxZ: 1, y: 5 }] }
    const player = body()
    for (let i = 0; i < 50; i++) moveBody(player, { x: 1, z: 0, jump: false, dash: false }, ramp, 1 / 60)
    expect(player.position.y).toBeCloseTo(player.position.x * .25)
    expect(supportAt(ramp, -1, 0, .35)).toBe(0)
  })
  it('bounds movement to the level', () => {
    const player = body()
    for (let i = 0; i < 500; i++) moveBody(player, { x: 1, z: 0, jump: false, dash: true }, world, 1 / 60)
    expect(player.position.x).toBe(10)
  })
  it('keeps ground contact when moving down a ramp', () => {
    const ramp = { ...world, surfaces: [{ minX: 0, maxX: 4, minZ: -1, maxZ: 1, y: 0, slopeX: .5 }] }
    const player = body(); player.position = { x: 3, y: 1.5, z: 0 }
    for (let i = 0; i < 30; i++) {
      const result = moveBody(player, { x: -1, z: 0, jump: false, dash: false }, ramp, 1 / 60)
      expect(player.grounded).toBe(true); expect(result.landed).toBe(false)
    }
  })
  it('lands on a solid obstacle instead of falling into it', () => {
    const boxes = { ...world, obstacles: [{ minX: -1, maxX: 1, minY: 0, maxY: .8, minZ: -1, maxZ: 1 }] }
    const player = body(); player.position.y = 1.5; player.grounded = false
    for (let i = 0; i < 60; i++) moveBody(player, { x: 0, z: 0, jump: false, dash: false }, boxes, 1 / 60)
    expect(player.position.y).toBe(.8); expect(player.grounded).toBe(true)
  })
})
describe('avatar import boundary', () => {
  it('accepts the default avatar without sharing its object', () => {
    expect(validateAvatar(DEFAULT_AVATAR)).toEqual(DEFAULT_AVATAR)
    expect(validateAvatar(DEFAULT_AVATAR)).not.toBe(DEFAULT_AVATAR)
  })
  it.each([null, [], { ...DEFAULT_AVATAR, height: Infinity }, { ...DEFAULT_AVATAR, thickness: 9 }, { ...DEFAULT_AVATAR, headwear: 'unknown' }, { ...DEFAULT_AVATAR, color: 'red' }])('rejects invalid values %j', input => {
    expect(() => validateAvatar(input)).toThrow()
  })
})
