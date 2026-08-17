import {
  BURGER_SHOP_GRAVITY,
  type BurgerShopEmitter,
  type BurgerShopParticle,
  type BurgerShopRange,
  type BurgerShopRecipe,
  type BurgerShopShape,
} from './types'

export function pickRange(range: BurgerShopRange, random: () => number): number {
  if (range.max === range.min) return range.min
  return range.min + (range.max - range.min) * random()
}

export function pickColor(colors: number[][], random: () => number): [number, number, number, number] {
  const color = colors[Math.min(colors.length - 1, Math.floor(random() * colors.length))]
  return [color[0] ?? 1, color[1] ?? 1, color[2] ?? 1, color[3] ?? 1]
}

function rotateX(x: number, y: number, z: number, degrees: number): [number, number, number] {
  const radians = (degrees * Math.PI) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return [x, y * cosine - z * sine, y * sine + z * cosine]
}

function rotateY(x: number, y: number, z: number, degrees: number): [number, number, number] {
  const radians = (degrees * Math.PI) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return [x * cosine + z * sine, y, -x * sine + z * cosine]
}

function rotateZ(x: number, y: number, z: number, degrees: number): [number, number, number] {
  const radians = (degrees * Math.PI) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return [x * cosine - y * sine, x * sine + y * cosine, z]
}

function applyEuler(point: [number, number, number], euler: [number, number, number]): [number, number, number] {
  let [x, y, z] = point
  ;[x, y, z] = rotateZ(x, y, z, euler[2])
  ;[x, y, z] = rotateX(x, y, z, euler[0])
  ;[x, y, z] = rotateY(x, y, z, euler[1])
  return [x, y, z]
}

function emitDirection(shape: BurgerShopShape, random: () => number): [number, number, number] {
  if (shape.kind === 'point' || shape.kind === 'rectangle' || shape.kind === 'box') return [0, 0, 1]
  const yaw = random() * Math.PI * 2
  if (shape.kind === 'sphere' || shape.kind === 'hemisphere') {
    const tilt = shape.kind === 'hemisphere' ? Math.acos(random()) : Math.acos(2 * random() - 1)
    return [Math.sin(tilt) * Math.cos(yaw), Math.sin(tilt) * Math.sin(yaw), Math.cos(tilt)]
  }
  const angle = (shape.angle * Math.PI) / 180
  const tilt = angle * Math.sqrt(random())
  return [Math.sin(tilt) * Math.cos(yaw), Math.sin(tilt) * Math.sin(yaw), Math.cos(tilt)]
}

function emitPoint(shape: BurgerShopShape, random: () => number): [number, number, number] {
  if (shape.kind === 'point') return [0, 0, 0]
  if (shape.kind === 'sphere' || shape.kind === 'hemisphere') {
    const direction = emitDirection(shape, random)
    const radius = shape.radius * Math.cbrt(random())
    return [direction[0] * radius, direction[1] * radius, direction[2] * radius]
  }
  if (shape.kind === 'cone' || shape.kind === 'cone-volume') {
    const radius = shape.radius * Math.sqrt(random())
    const yaw = random() * Math.PI * 2
    const height = (shape.kind === 'cone-volume' ? random() : 0) * (shape.length ?? 0)
    return [Math.cos(yaw) * radius, Math.sin(yaw) * radius, height]
  }
  if (shape.kind === 'box') {
    return [
      (random() - 0.5) * shape.size[0],
      (random() - 0.5) * shape.size[1],
      (random() - 0.5) * shape.size[2],
    ]
  }
  return [(random() - 0.5) * shape.size[0], (random() - 0.5) * shape.size[1], 0]
}

function applyLocal(emitter: BurgerShopEmitter, point: [number, number, number]): [number, number, number] {
  const scale = emitter.localScale ?? [1, 1, 1]
  const scaled: [number, number, number] = [point[0] * scale[0], point[1] * scale[1], point[2] * scale[2]]
  const rotated = applyEuler(scaled, emitter.localEuler ?? [0, 0, 0])
  const position = emitter.localPosition ?? [0, 0, 0]
  return [rotated[0] + position[0], rotated[1] + position[1], rotated[2] + position[2]]
}

function applyDirection(emitter: BurgerShopEmitter, direction: [number, number, number]): [number, number, number] {
  return applyEuler(direction, emitter.localEuler ?? [0, 0, 0])
}

export function sampleCurve(keys: { t: number; v: number }[], time: number): number {
  if (keys.length === 0) return 1
  if (time <= keys[0].t) return keys[0].v
  for (let index = 1; index < keys.length; index += 1) {
    if (time <= keys[index].t) {
      const previous = keys[index - 1]
      const next = keys[index]
      const span = next.t - previous.t || 1
      const mix = (time - previous.t) / span
      return previous.v + (next.v - previous.v) * mix
    }
  }
  return keys[keys.length - 1].v
}

export function spawnParticle(
  emitter: BurgerShopEmitter,
  emitterIndex: number,
  random: () => number,
): BurgerShopParticle {
  const point = applyLocal(emitter, emitPoint(emitter.shape, random))
  const direction = applyDirection(emitter, emitDirection(emitter.shape, random))
  const speed = pickRange(emitter.speed, random)
  const length = Math.hypot(direction[0], direction[1], direction[2]) || 1
  const sheetCount = Math.max(1, emitter.sheet.columns * emitter.sheet.rows)
  const randomRoll = emitter.billboard !== 'vertical' && (emitter.rotateOverLife || Boolean(emitter.startRotation))
  const particle: BurgerShopParticle = {
    emitter: emitterIndex,
    age: 0,
    life: Math.max(0.05, pickRange(emitter.life, random)),
    x: point[0],
    y: point[1],
    z: point[2],
    vx: (direction[0] / length) * speed,
    vy: (direction[1] / length) * speed,
    vz: (direction[2] / length) * speed,
    size: pickRange(emitter.size, random),
    roll: randomRoll ? pickRange(emitter.startRotation ?? { min: 0, max: Math.PI * 2 }, random) : 0,
    spin: emitter.rotateOverLife && emitter.billboard !== 'vertical' ? (random() - 0.5) * 4 : 0,
    color: pickColor(emitter.color, random),
    sheetIndex: Math.floor(random() * sheetCount),
  }
  if (emitter.minHeight != null && particle.y < emitter.minHeight) particle.y = emitter.minHeight
  return particle
}

export function advanceParticle(
  particle: BurgerShopParticle,
  emitter: BurgerShopEmitter,
  delta: number,
): void {
  particle.age += delta
  const lifeT = Math.min(1, particle.age / particle.life)
  particle.vy -= BURGER_SHOP_GRAVITY * emitter.gravity * delta
  if (emitter.noise) {
    const strength = (emitter.noise.min + emitter.noise.max) * 0.5
    particle.x += Math.sin(particle.age * 6.4 + particle.roll) * strength * delta
    particle.y += Math.cos(particle.age * 5.1 + particle.sheetIndex) * strength * 0.45 * delta
    particle.z += Math.sin(particle.age * 7.2 + particle.spin) * strength * delta
  }
  particle.x += particle.vx * delta
  particle.y += particle.vy * delta
  particle.z += particle.vz * delta
  particle.roll += particle.spin * delta
  if (emitter.minHeight != null && particle.y < emitter.minHeight) particle.y = emitter.minHeight
  void lifeT
}

export function liveSize(particle: BurgerShopParticle, emitter: BurgerShopEmitter): number {
  const lifeT = Math.min(1, particle.age / Math.max(0.0001, particle.life))
  if (emitter.sizeCurve && emitter.sizeCurve.length > 0) {
    return particle.size * sampleCurve(emitter.sizeCurve, lifeT)
  }
  if (!emitter.sizeOverLife) return particle.size
  return particle.size * (emitter.sizeOverLife[0] + (emitter.sizeOverLife[1] - emitter.sizeOverLife[0]) * lifeT)
}

export function sheetFrame(particle: BurgerShopParticle, emitter: BurgerShopEmitter): number {
  const count = Math.max(1, emitter.sheet.columns * emitter.sheet.rows)
  if (count === 1) return 0
  return Math.min(count - 1, Math.floor((particle.age / particle.life) * count))
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0x100000000
  }
}

export interface BurgerShopSimulation {
  recipe: BurgerShopRecipe
  particles: BurgerShopParticle[]
  time: number
  walker: { x: number; z: number; lastX: number; lastZ: number }
}

export function createBurgerShopSimulation(recipe: BurgerShopRecipe): BurgerShopSimulation {
  return {
    recipe,
    particles: [],
    time: 0,
    walker: { x: 0, z: 0, lastX: 0, lastZ: 0 },
  }
}

function emitBurst(
  simulation: BurgerShopSimulation,
  emitter: BurgerShopEmitter,
  emitterIndex: number,
  random: () => number,
  count: number,
): void {
  for (let index = 0; index < count; index += 1) {
    simulation.particles.push(spawnParticle(emitter, emitterIndex, random))
  }
}

export function stepBurgerShopSimulation(
  simulation: BurgerShopSimulation,
  delta: number,
  random: () => number,
): void {
  const previous = simulation.time
  simulation.time += delta
  if (simulation.recipe.id === 'character-footsteps') {
    simulation.walker.lastX = simulation.walker.x
    simulation.walker.lastZ = simulation.walker.z
    simulation.walker.z = Math.sin(simulation.time * 1.2) * 1.4
    simulation.walker.x = Math.cos(simulation.time * 0.6) * 0.35
  }

  simulation.recipe.emitters.forEach((emitter, emitterIndex) => {
    const localTime = simulation.time - (emitter.delay ?? 0)
    if (localTime < 0) return
    const cycle = emitter.looping ? localTime % emitter.duration : localTime
    const previousCycle = previous - (emitter.delay ?? 0)
    const crossedStart = previousCycle < 0 || (!emitter.looping && previousCycle <= 0 && localTime > 0)
    const loopRestart = emitter.looping && Math.floor(localTime / emitter.duration) !== Math.floor(Math.max(0, previousCycle) / emitter.duration)
    if (emitter.burst && (crossedStart || loopRestart)) {
      emitBurst(simulation, emitter, emitterIndex, random, Math.round(pickRange(emitter.burst, random)))
    }
    if (emitter.rate > 0 && cycle >= 0 && (emitter.looping || localTime <= emitter.duration)) {
      const expected = Math.floor(cycle * emitter.rate)
      const previousExpected = Math.floor(Math.max(0, previousCycle) * emitter.rate)
      emitBurst(simulation, emitter, emitterIndex, random, Math.max(0, expected - previousExpected))
    }
    if (emitter.rateOverDistance && simulation.recipe.id === 'character-footsteps') {
      const travel = Math.hypot(
        simulation.walker.x - simulation.walker.lastX,
        simulation.walker.z - simulation.walker.lastZ,
      )
      const count = Math.floor(travel * emitter.rateOverDistance + random())
      emitBurst(simulation, emitter, emitterIndex, random, count)
    }
  })

  simulation.particles = simulation.particles.filter((particle) => {
    const emitter = simulation.recipe.emitters[particle.emitter]
    if (!emitter) return false
    if (simulation.recipe.id === 'character-footsteps') {
      particle.x += simulation.walker.x - simulation.walker.lastX
      particle.z += simulation.walker.z - simulation.walker.lastZ
    }
    advanceParticle(particle, emitter, delta)
    return particle.age < particle.life
  })
}
