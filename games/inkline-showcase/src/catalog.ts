import type { AnimationEntry, ModelEntry, PackManifest } from './types'

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Record<string, unknown>
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be text.`)
  return value
}
function positive(value: unknown, label: string, zero = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < (zero ? 0 : Number.MIN_VALUE)) throw new Error(`${label} must be a finite positive number.`)
  return value
}
function localPath(value: unknown, label: string): string {
  const path = text(value, label)
  if (!/^assets\/[a-z0-9_./-]+$/i.test(path) || path.split('/').includes('..')) throw new Error(`${label} must be a local asset path.`)
  return path
}
export function parseManifest(value: unknown): PackManifest {
  const data = object(value, 'Manifest')
  if (!Array.isArray(data.models) || !Array.isArray(data.animations)) throw new Error('The manifest needs model and animation lists.')
  const ids = new Set<string>()
  const models: ModelEntry[] = data.models.map(value => {
    const entry = object(value, 'Model'), id = text(entry.id, 'Model id')
    if (ids.has(id)) throw new Error(`Duplicate model id: ${id}`)
    ids.add(id)
    if (entry.kind !== 'character' && entry.kind !== 'prop') throw new Error(`${id} has an invalid model kind.`)
    if (!Array.isArray(entry.dimensions) || entry.dimensions.length !== 3) throw new Error(`${id} needs three dimensions.`)
    if (!Array.isArray(entry.tags) || !entry.tags.every(tag => typeof tag === 'string')) throw new Error(`${id} has invalid tags.`)
    return { id, label: text(entry.label, 'Model label'), kind: entry.kind, category: text(entry.category, 'Model category'),
      file: localPath(entry.file, 'Model file'), thumbnail: localPath(entry.thumbnail, 'Model preview'),
      dimensions: entry.dimensions.map(size => positive(size, 'Model dimension')) as [number, number, number],
      triangles: positive(entry.triangles, 'Triangle count'), vertices: positive(entry.vertices, 'Vertex count'), materials: positive(entry.materials, 'Material count'),
      description: text(entry.description, 'Model description'), tags: [...entry.tags] as string[],
    }
  })
  const animationIds = new Set<string>()
  const animations: AnimationEntry[] = data.animations.map(value => {
    const entry = object(value, 'Animation'), id = text(entry.id, 'Animation id')
    if (animationIds.has(id)) throw new Error(`Duplicate animation id: ${id}`)
    animationIds.add(id)
    if (typeof entry.loop !== 'boolean') throw new Error(`${id} needs a loop flag.`)
    const duration = positive(entry.duration, 'Animation duration')
    const contactTime = entry.contactTime === undefined ? undefined : positive(entry.contactTime, 'Contact time', true)
    if (contactTime !== undefined && contactTime >= duration) throw new Error(`${id} contact must occur before the clip ends.`)
    const contactFrame = entry.contactFrame === undefined ? undefined : positive(entry.contactFrame, 'Contact frame')
    if (contactFrame !== undefined && (!Number.isInteger(contactFrame) || contactTime === undefined || Math.abs(contactTime - contactFrame / 30) > .00051)) throw new Error(`${id} contact frame must match its exported time at 30 FPS.`)
    const travelSpeed = entry.travelSpeed === undefined ? undefined : positive(entry.travelSpeed, 'Travel speed')
    if (travelSpeed !== undefined && !entry.loop) throw new Error(`${id} travel speed requires a loop.`)
    let motion: AnimationEntry['motion']
    if (entry.motion !== undefined) {
      const source = object(entry.motion, 'Animation motion')
      if (!Array.isArray(source.phases)) throw new Error(`${id} needs motion phases.`)
      motion = { phases: source.phases.map(value => {
        const phase = object(value, 'Animation phase'), frame = positive(phase.frame, 'Animation phase frame')
        if (frame / 30 > duration + .00051) throw new Error(`${id} phase must occur inside the clip.`)
        return { name: text(phase.name, 'Animation phase name'), frame }
      }) }
    }
    return { id, label: text(entry.label, 'Animation label'), category: text(entry.category, 'Animation category'), duration, loop: entry.loop,
      ...(contactTime === undefined ? {} : { contactTime }), ...(contactFrame === undefined ? {} : { contactFrame }), ...(travelSpeed === undefined ? {} : { travelSpeed }), ...(motion === undefined ? {} : { motion }) }
  })
  for (const id of ['stick-standard', 'stick-fighter', 'stick-runner', 'stick-acrobat', 'stick-worker']) if (!models.some(model => model.id === id && model.kind === 'character')) throw new Error(`Required character is missing: ${id}`)
  for (const id of ['idle', 'run', 'sprint', 'block', 'hit-front', 'hit-back', 'hit-left', 'hit-right', 'knockdown', 'death', 'get-up', 'get-up-forward', 'jump-land', 'jump-loop', 'punch-left', 'punch-right', 'kick-roundhouse']) if (!animationIds.has(id)) throw new Error(`Required animation is missing: ${id}`)
  return { version: text(data.version, 'Pack version'), models, animations }
}
