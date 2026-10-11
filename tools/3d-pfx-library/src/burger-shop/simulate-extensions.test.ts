import { describe, expect, it } from 'vitest'
import { createBurgerShopSimulation, createSeededRandom, liveColor, liveSize, spawnParticle, stepBurgerShopSimulation } from './simulate'
import type { BurgerShopEmitter, BurgerShopRecipe } from './types'

const emitter = (over: Partial<BurgerShopEmitter> = {}): BurgerShopEmitter => ({
  name: 'Test',
  texture: 'glow',
  sheet: { columns: 1, rows: 1 },
  billboard: 'camera',
  blend: 'alpha',
  duration: 1,
  looping: false,
  life: { min: 1, max: 1 },
  speed: { min: 2, max: 2 },
  size: { min: 1, max: 1 },
  gravity: 0,
  rate: 0,
  burst: { min: 1, max: 1 },
  shape: { kind: 'point' },
  color: [[1, 1, 1, 1]],
  ...over,
})

const recipe = (e: BurgerShopEmitter): BurgerShopRecipe => ({ id: 'test', label: 'test', sourcePrefab: 'test', duration: 1, looping: false, emitters: [e] })

describe('emitter extensions (RUN voxel effects)', () => {
  it('multiplies the spawn colour by colorOverLife', () => {
    const e = emitter({ color: [[1, 0.5, 1, 1]], colorOverLife: [{ t: 0, c: [1, 1, 1, 1] }, { t: 1, c: [0.5, 1, 0, 0] }] })
    const p = spawnParticle(e, 0, createSeededRandom(1))
    expect(liveColor({ ...p, age: 0 }, e)).toEqual([1, 0.5, 1, 1])
    expect(liveColor({ ...p, age: 0.5 }, e)).toEqual([0.75, 0.5, 0.5, 0.5])
    expect(liveColor({ ...p, age: 1 }, e)).toEqual([0.5, 0.5, 0, 0])
  })

  it('slows particles with drag', () => {
    const sim = createBurgerShopSimulation(recipe(emitter({ drag: 4 })))
    const random = createSeededRandom(1)
    stepBurgerShopSimulation(sim, 0.001, random)
    for (let i = 0; i < 10; i += 1) stepBurgerShopSimulation(sim, 0.05, random)
    expect(Math.hypot(sim.particles[0]!.vx, sim.particles[0]!.vy, sim.particles[0]!.vz)).toBeCloseTo(2 * Math.exp(-4 * 0.501), 2)
  })

  it('turns particles around the vertical axis with swirl, keeping their radius', () => {
    const sim = createBurgerShopSimulation(recipe(emitter({ speed: { min: 0, max: 0 }, shape: { kind: 'circle', radius: 0.5 }, localEuler: [-90, 0, 0], swirl: Math.PI })))
    const random = createSeededRandom(3)
    stepBurgerShopSimulation(sim, 0.001, random)
    const p = sim.particles[0]!
    const start = Math.atan2(p.z, p.x)
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(0.5, 5)
    expect(p.y).toBeCloseTo(0, 5)
    for (let i = 0; i < 10; i += 1) stepBurgerShopSimulation(sim, 0.05, random)
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(0.5, 5)
    const turned = Math.atan2(p.z, p.x) - start
    expect(Math.abs(Math.cos(turned) - Math.cos(Math.PI / 2))).toBeLessThan(0.01)
  })

  it('emits circle particles outward from the ring', () => {
    const e = emitter({ shape: { kind: 'circle', radius: 2 } })
    const p = spawnParticle(e, 0, createSeededRandom(5))
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(2, 5)
    expect((p.x * p.vx + p.y * p.vy) / (2 * 2)).toBeCloseTo(1, 5)
  })

  it('bakes the world frame into world-space particles at birth', () => {
    // Frame: scale 3, move to (10, 20, 30), turn 90° about Y (x → -z).
    const matrix = [0, 0, -3, 0, 0, 3, 0, 0, 3, 0, 0, 0, 10, 20, 30, 1]
    const e = emitter({ worldSpace: true, localPosition: [1, 0, 0], shape: { kind: 'point' }, localEuler: [0, 0, 0] })
    const p = spawnParticle(e, 0, createSeededRandom(1), { matrix, unit: 3 })
    expect([p.x, p.y, p.z]).toEqual([10, 20, 27])
    expect([p.vx, p.vy, p.vz].map((v) => Math.round(v * 1000) / 1000)).toEqual([6, 0, 0])
    expect(liveSize({ ...p, age: 0 }, e)).toBe(3)
  })

  it('refuses world-space emitters without a frame, or with own-space features', () => {
    expect(() => spawnParticle(emitter({ worldSpace: true }), 0, createSeededRandom(1))).toThrow(/world frame/)
    const frame = { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], unit: 1 }
    expect(() => spawnParticle(emitter({ worldSpace: true, swirl: 1 }), 0, createSeededRandom(1), frame)).toThrow(/cannot be world-space/)
  })
})
