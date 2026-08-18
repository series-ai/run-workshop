import { describe, expect, it } from 'vitest'
import {
  BURGER_SHOP_RECIPES,
  BURGER_SHOP_RECIPE_IDS,
  nextBurgerShopRecipeId,
  previousBurgerShopRecipeId,
} from './recipes'
import {
  createBurgerShopSimulation,
  createSeededRandom,
  liveSize,
  pickRange,
  sheetFrame,
  spawnParticle,
  stepBurgerShopSimulation,
} from './simulate'

describe('BurgerTime faithful shop pack', () => {
  it('covers every Unity prefab we inspected', () => {
    expect(BURGER_SHOP_RECIPE_IDS).toEqual([
      'character-footsteps',
      'character-upgrade',
      'confetti-01',
      'confetti-02',
      'eating',
      'flies',
      'poof-01',
      'poof-02',
      'smoke',
      'sunshine',
      'table-first-purchase',
      'table-upgrade',
      'unlock-area',
    ])
    expect(BURGER_SHOP_RECIPES.map((recipe) => recipe.unityPrefab)).toEqual([
      'FX_Character_FootSteps_01',
      'FX_Character_Upgrade_01',
      'FX_Confetti_01',
      'FX_Confetti_02',
      'FX_Eating_01',
      'FX_Flies_01',
      'FX_Poof_01',
      'FX_Poof_02',
      'FX_Smoke_01',
      'FX_Sunshine_01',
      'FX_Table_Station_First_Purchase_01',
      'FX_Table_Station_Upgrade_01',
      'FX_Unlock_Area_01',
    ])
  })

  it('locks Unity numbers for the unique shop verbs', () => {
    const flies = BURGER_SHOP_RECIPES.find((recipe) => recipe.id === 'flies')
    expect(flies?.emitters[0]).toMatchObject({
      rate: 2,
      speed: { min: 0, max: 0 },
      life: { min: 1, max: 2 },
      noise: { min: 0.5, max: 2 },
      texture: 'flies',
    })
    const eating = BURGER_SHOP_RECIPES.find((recipe) => recipe.id === 'eating')
    expect(eating?.emitters).toHaveLength(2)
    expect(eating?.emitters[0]?.gravity).toBe(5)
    expect(eating?.emitters[0]?.shape).toMatchObject({ kind: 'cone', angle: 7 })
    const smoke = BURGER_SHOP_RECIPES.find((recipe) => recipe.id === 'smoke')
    expect(smoke?.emitters[0]).toMatchObject({ billboard: 'vertical', size: { min: 6, max: 6 }, looping: true })
    const sunshine = BURGER_SHOP_RECIPES.find((recipe) => recipe.id === 'sunshine')
    expect(sunshine?.emitters[0]).toMatchObject({ billboard: 'mesh', size: { min: 18, max: 18 }, burst: { min: 4, max: 4 } })
    const unlock = BURGER_SHOP_RECIPES.find((recipe) => recipe.id === 'unlock-area')
    const arrow = unlock?.emitters.find((emitter) => emitter.name === 'Arrow')
    expect(arrow).toMatchObject({ texture: 'arrow', billboard: 'vertical', size: { min: 4, max: 4 }, speed: { min: 26, max: 26 } })
  })

  it('spawns a burst of the authored count', () => {
    const recipe = BURGER_SHOP_RECIPES.find((entry) => entry.id === 'poof-01')
    if (!recipe) throw new Error('missing poof')
    const simulation = createBurgerShopSimulation(recipe)
    const random = createSeededRandom(7)
    stepBurgerShopSimulation(simulation, 0.016, random)
    const poofCount = simulation.particles.filter((particle) => recipe.emitters[particle.emitter]?.name === 'Poof').length
    const ringCount = simulation.particles.filter((particle) => recipe.emitters[particle.emitter]?.name === 'Shockwave').length
    expect(poofCount).toBe(5)
    expect(ringCount).toBe(1)
  })

  it('keeps range picks inside the Unity interval', () => {
    const random = createSeededRandom(3)
    for (let index = 0; index < 20; index += 1) {
      const value = pickRange({ min: 0.35, max: 0.9 }, random)
      expect(value).toBeGreaterThanOrEqual(0.35)
      expect(value).toBeLessThanOrEqual(0.9)
    }
    const flies = BURGER_SHOP_RECIPES.find((recipe) => recipe.id === 'flies')
    if (!flies) throw new Error('missing flies')
    const particle = spawnParticle(flies.emitters[0], 0, random)
    expect(particle.size).toBeGreaterThanOrEqual(0.4)
    expect(particle.size).toBeLessThanOrEqual(0.8)
  })

  it('keeps the fly swarm above the ground plane', () => {
    const flies = BURGER_SHOP_RECIPES.find((recipe) => recipe.id === 'flies')
    if (!flies) throw new Error('missing flies')
    const random = createSeededRandom(5)
    for (let index = 0; index < 20; index += 1) {
      const particle = spawnParticle(flies.emitters[0], 0, random)
      expect(particle.y).toBeGreaterThan(0.05)
    }
  })

  it('keeps fly art as one sprite and shop sheets as authored Unity cuts', () => {
    const flies = BURGER_SHOP_RECIPES.find((recipe) => recipe.id === 'flies')
    expect(flies?.emitters[0]?.sheet).toEqual({ columns: 1, rows: 1 })
    expect(flies?.emitters[0]?.texture).toBe('flies')
    expect(flies?.emitters[0]?.blend).toBe('cutout')
    const tableUpgrade = BURGER_SHOP_RECIPES.find((recipe) => recipe.id === 'table-upgrade')
    for (const emitter of tableUpgrade?.emitters ?? []) {
      expect(emitter.sheet).toEqual({ columns: 1, rows: 1 })
    }
    const upgradeTrail = tableUpgrade?.emitters.find((emitter) => emitter.name === 'Trail')
    expect(upgradeTrail?.color.some((color) => color[0] === 1 && color[1] === 0 && color[2] > 0.4)).toBe(false)
    const unlock = BURGER_SHOP_RECIPES.find((recipe) => recipe.id === 'unlock-area')
    for (const emitter of unlock?.emitters ?? []) {
      expect(emitter.sheet).toEqual({ columns: 1, rows: 1 })
    }
    const sparkles = BURGER_SHOP_RECIPES.flatMap((recipe) => recipe.emitters).filter((emitter) => emitter.texture === 'sparkle')
    for (const emitter of sparkles) {
      expect(emitter.sheet).toEqual({ columns: 1, rows: 1 })
    }
    const sunshine = BURGER_SHOP_RECIPES.find((recipe) => recipe.id === 'sunshine')
    expect(sunshine?.emitters[0]?.localEuler).toEqual([0, 0, 0])
  })

  it('walks the review list in a loop', () => {
    expect(nextBurgerShopRecipeId('unlock-area')).toBe('character-footsteps')
    expect(previousBurgerShopRecipeId('character-footsteps')).toBe('unlock-area')
    expect(nextBurgerShopRecipeId('poof-01')).toBe('poof-02')
  })

  it('emits Unity cones along local +Z, which a -90 X rotation turns into world +Y', () => {
    const eating = BURGER_SHOP_RECIPES.find((recipe) => recipe.id === 'eating')
    if (!eating) throw new Error('missing eating')
    const random = createSeededRandom(11)
    const ups: number[] = []
    for (let index = 0; index < 12; index += 1) {
      const particle = spawnParticle(eating.emitters[0], 0, random)
      const speed = Math.hypot(particle.vx, particle.vy, particle.vz)
      expect(speed).toBeGreaterThan(4)
      ups.push(particle.vy / speed)
    }
    const meanUp = ups.reduce((sum, value) => sum + value, 0) / ups.length
    expect(meanUp).toBeGreaterThan(0.85)
  })

  it('does not bake emitter position into the emit direction', () => {
    const eating = BURGER_SHOP_RECIPES.find((recipe) => recipe.id === 'eating')
    if (!eating) throw new Error('missing eating')
    const random = createSeededRandom(4)
    for (let index = 0; index < 8; index += 1) {
      const particle = spawnParticle(eating.emitters[0], 0, random)
      const speed = Math.hypot(particle.vx, particle.vy, particle.vz)
      expect(Math.abs(particle.vz / speed)).toBeLessThan(0.2)
    }
  })

  it('keeps Unity vertical icons upright with no random roll', () => {
    const unlock = BURGER_SHOP_RECIPES.find((recipe) => recipe.id === 'unlock-area')
    const arrow = unlock?.emitters.find((emitter) => emitter.name === 'Arrow')
    if (!arrow) throw new Error('missing arrow')
    const random = createSeededRandom(9)
    const particle = spawnParticle(arrow, 0, random)
    expect(particle.roll).toBe(0)
    expect(particle.spin).toBe(0)
    const speed = Math.hypot(particle.vx, particle.vy, particle.vz)
    expect(particle.vy / speed).toBeGreaterThan(0.95)
  })

  it('explodes confetti on a sphere, not a single up-axis', () => {
    const recipe = BURGER_SHOP_RECIPES.find((entry) => entry.id === 'confetti-02')
    const burst = recipe?.emitters.find((emitter) => emitter.name === 'ConfettiExplosion')
    if (!burst) throw new Error('missing explosion')
    expect(burst.shape.kind).toBe('sphere')
    const random = createSeededRandom(2)
    const dots: Array<[number, number, number]> = []
    for (let index = 0; index < 25; index += 1) {
      const particle = spawnParticle(burst, 0, random)
      const speed = Math.hypot(particle.vx, particle.vy, particle.vz) || 1
      dots.push([particle.vx / speed, particle.vy / speed, particle.vz / speed])
    }
    const meanY = dots.reduce((sum, item) => sum + item[1], 0) / dots.length
    const spreadX = dots.reduce((sum, item) => sum + Math.abs(item[0]), 0) / dots.length
    const spreadZ = dots.reduce((sum, item) => sum + Math.abs(item[2]), 0) / dots.length
    expect(Math.abs(meanY)).toBeLessThan(0.45)
    expect(spreadX).toBeGreaterThan(0.25)
    expect(spreadZ).toBeGreaterThan(0.25)
  })

  it('pops the upgrade sign from zero size then shrinks, matching Unity SizeOverLifetime', () => {
    const upgrade = BURGER_SHOP_RECIPES.find((recipe) => recipe.id === 'character-upgrade')
    const sign = upgrade?.emitters.find((emitter) => emitter.name === 'Upgrade')
    if (!sign) throw new Error('missing upgrade sign')
    const particle = {
      emitter: 0,
      age: 0,
      life: 0.75,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 26,
      vz: 0,
      size: 5,
      roll: 0,
      spin: 0,
      color: [1, 1, 1, 1] as [number, number, number, number],
      sheetIndex: 0,
    }
    expect(liveSize({ ...particle, age: 0 }, sign)).toBeLessThan(0.5)
    expect(liveSize({ ...particle, age: 0.09 }, sign)).toBeGreaterThan(4)
    expect(liveSize({ ...particle, age: 0.75 }, sign)).toBeLessThan(1.2)
  })

  it('keeps looping rate emission after the first duration', () => {
    const flies = BURGER_SHOP_RECIPES.find((recipe) => recipe.id === 'flies')
    if (!flies) throw new Error('missing flies')
    const simulation = createBurgerShopSimulation(flies)
    const random = createSeededRandom(8)
    const duration = flies.emitters[0]!.duration
    for (let step = 0; step < Math.ceil((duration + 0.25) / 0.05); step += 1) {
      stepBurgerShopSimulation(simulation, 0.05, random)
    }
    let births = 0
    let previousCount = simulation.particles.length
    for (let step = 0; step < 24; step += 1) {
      stepBurgerShopSimulation(simulation, 0.05, random)
      if (simulation.particles.length > previousCount) {
        births += simulation.particles.length - previousCount
      }
      previousCount = simulation.particles.length
    }
    expect(births).toBeGreaterThan(0)
  })

  it('spawns footstep dust at the walker, not the origin', () => {
    const footsteps = BURGER_SHOP_RECIPES.find((recipe) => recipe.id === 'character-footsteps')
    if (!footsteps) throw new Error('missing footsteps')
    const simulation = createBurgerShopSimulation(footsteps)
    const random = createSeededRandom(6)
    for (let step = 0; step < 80; step += 1) {
      stepBurgerShopSimulation(simulation, 0.05, random)
    }
    expect(simulation.particles.length).toBeGreaterThan(0)
    const walkerR = Math.hypot(simulation.walker.x, simulation.walker.z)
    expect(walkerR).toBeGreaterThan(0.2)
    const meanR =
      simulation.particles.reduce((sum, particle) => sum + Math.hypot(particle.x, particle.z), 0) /
      simulation.particles.length
    expect(meanR).toBeGreaterThan(walkerR * 0.4)
  })

  it('offsets flipbook start by the rolled sheet index', () => {
    const confetti = BURGER_SHOP_RECIPES.find((recipe) => recipe.id === 'confetti-01')
    const emitter = confetti?.emitters[0]
    if (!emitter) throw new Error('missing confetti')
    const particle = spawnParticle(emitter, 0, createSeededRandom(3))
    particle.age = 0
    particle.life = 1
    particle.sheetIndex = 2
    expect(sheetFrame(particle, emitter)).toBe(2)
  })
})
