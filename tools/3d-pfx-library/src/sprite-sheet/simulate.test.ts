import { describe, expect, it } from 'vitest'
import { createFullImageSheet } from './parseCocosAtlas'
import { createSeededRandom, createSpriteSheetSimulation, liveFrame, stepSpriteSheetSimulation } from './simulate'

describe('sprite sheet simulation', () => {
  it('advances an animated clip through its frames', () => {
    const sheet = createFullImageSheet('one.png', 32, 32)
    sheet.clips[0] = {
      id: 'one',
      animated: true,
      frames: [0, 1, 2, 3, 4, 5].map((index) => ({
        name: `one_${index}.png`,
        x: index * 8,
        y: 0,
        width: 8,
        height: 8,
        rotated: false,
        u: index / 6,
        v: 0,
        du: 1 / 6,
        dv: 1,
      })),
    }
    const random = createSeededRandom(1)
    const simulation = createSpriteSheetSimulation(
      sheet,
      [
        {
          clipId: 'one',
          count: 1,
          life: { min: 1, max: 1 },
          size: { min: 1, max: 1 },
          speed: { min: 0, max: 0 },
          gravity: 0,
          radius: 0,
          height: 0,
          fps: 6,
          loop: false,
          blend: 'cutout',
          lumaAlpha: false,
        },
      ],
      random,
    )
    const particle = simulation.particles[0]
    if (!particle) throw new Error('missing particle')
    particle.age = 0
    expect(liveFrame(particle, sheet.clips[0]!, simulation.emitters[0]!)).toBe(0)
    particle.age = 0.5
    expect(liveFrame(particle, sheet.clips[0]!, simulation.emitters[0]!)).toBe(3)
    stepSpriteSheetSimulation(simulation, 1.1, random)
    expect(simulation.particles).toHaveLength(0)
  })

  it('keeps grounded particles on the floor plane', () => {
    const sheet = createFullImageSheet('ground.png', 16, 16)
    const random = createSeededRandom(4)
    const simulation = createSpriteSheetSimulation(
      sheet,
      [
        {
          clipId: sheet.clips[0]?.id,
          count: 12,
          life: { min: 1, max: 1 },
          size: { min: 1, max: 1 },
          speed: { min: 0.4, max: 0.8 },
          gravity: 2,
          radius: 0.6,
          height: 0,
          fps: 1,
          loop: true,
          blend: 'cutout',
          lumaAlpha: false,
          grounded: true,
          anchor: 'ground',
        },
      ],
      random,
    )
    for (const particle of simulation.particles) {
      expect(particle.y).toBe(0)
    }
    stepSpriteSheetSimulation(simulation, 0.2, random)
    for (const particle of simulation.particles) {
      expect(particle.y).toBeGreaterThanOrEqual(0)
    }
  })
})
