import type { SpriteSheet, SpriteSheetClip, SpriteSheetEmitter, SpriteSheetParticle } from './types'

export function pickRange(range: { min: number; max: number }, random: () => number): number {
  if (range.max === range.min) return range.min
  return range.min + (range.max - range.min) * random()
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function spawnParticle(
  emitterIndex: number,
  clipIndex: number,
  clip: SpriteSheetClip,
  emitter: SpriteSheetEmitter,
  random: () => number,
): SpriteSheetParticle {
  const yaw = random() * Math.PI * 2
  const speed = pickRange(emitter.speed, random)
  const variant = emitter.variantMode || !clip.animated
    ? Math.min(clip.frames.length - 1, Math.floor(random() * clip.frames.length))
    : 0
  const anchor = emitter.anchor ?? (emitter.grounded === false ? 'character' : 'ground')
  const radius = emitter.radius * Math.sqrt(random())
  const x = Math.cos(yaw) * radius
  const z = Math.sin(yaw) * radius
  const height = emitter.height ?? 0
  const y =
    anchor === 'ground'
      ? 0
      : anchor === 'weather'
        ? height + random() * Math.max(0.4, height)
        : height + (random() - 0.5) * 0.45
  return {
    emitter: emitterIndex,
    clip: clipIndex,
    frame: variant,
    age: 0,
    life: pickRange(emitter.life, random),
    x,
    y,
    z,
    vx: anchor === 'weather' ? Math.cos(yaw) * speed * 0.08 : Math.cos(yaw) * speed * 0.12,
    vy: anchor === 'weather' ? -Math.abs(speed) : 0,
    vz: anchor === 'weather' ? Math.sin(yaw) * speed * 0.08 : Math.sin(yaw) * speed * 0.12,
    size: pickRange(emitter.size, random),
    roll: emitter.variantMode ? (random() - 0.5) * Math.PI : 0,
  }
}

export function liveFrame(particle: SpriteSheetParticle, clip: SpriteSheetClip, emitter: SpriteSheetEmitter): number {
  if (clip.frames.length === 0) return 0
  if (emitter.variantMode || !clip.animated) {
    return Math.min(clip.frames.length - 1, particle.frame)
  }
  const phase = particle.age * emitter.fps
  if (emitter.loop) return Math.floor(phase) % clip.frames.length
  return Math.min(clip.frames.length - 1, Math.floor(phase))
}

export interface SpriteSheetSimulation {
  sheet: SpriteSheet
  emitters: SpriteSheetEmitter[]
  particles: SpriteSheetParticle[]
  time: number
}

export function createSpriteSheetSimulation(
  sheet: SpriteSheet,
  emitters: SpriteSheetEmitter[],
  random: () => number,
): SpriteSheetSimulation {
  const simulation: SpriteSheetSimulation = { sheet, emitters, particles: [], time: 0 }
  emitters.forEach((emitter, emitterIndex) => {
    const clipIndex = resolveClipIndex(sheet, emitter, emitterIndex)
    const clip = sheet.clips[clipIndex]
    if (!clip) return
    for (let index = 0; index < emitter.count; index += 1) {
      const particle = spawnParticle(emitterIndex, clipIndex, clip, emitter, random)
      particle.age = emitter.loop ? random() * particle.life : 0
      simulation.particles.push(particle)
    }
  })
  return simulation
}

export function stepSpriteSheetSimulation(
  simulation: SpriteSheetSimulation,
  delta: number,
  random: () => number,
): void {
  simulation.time += delta
  simulation.particles = simulation.particles.flatMap((particle) => {
    const clip = simulation.sheet.clips[particle.clip]
    const emitter = simulation.emitters[particle.emitter]
    if (!clip || !emitter) return []
    particle.age += delta
    particle.x += particle.vx * delta
    particle.y += particle.vy * delta
    particle.z += particle.vz * delta
    particle.vy -= emitter.gravity * delta
    const anchor = emitter.anchor ?? (emitter.grounded === false ? 'character' : 'ground')
    if (anchor === 'ground' && particle.y < 0) {
      particle.y = 0
      particle.vy = 0
    }
    if (particle.age < particle.life) return [particle]
    if (!emitter.loop) return []
    const next = spawnParticle(particle.emitter, particle.clip, clip, emitter, random)
    next.age = particle.age - particle.life
    return [next]
  })
}

function resolveClipIndex(sheet: SpriteSheet, emitter: SpriteSheetEmitter, emitterIndex: number): number {
  if (!emitter.clipId) return Math.min(emitterIndex, sheet.clips.length - 1)
  const found = sheet.clips.findIndex((clip) => clip.id === emitter.clipId)
  return found >= 0 ? found : 0
}
