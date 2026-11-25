import type { WorldPropEntry } from '../contracts/catalog'
import { VEHICLE_ENVELOPES } from '../contracts/worldScale'
import { isIdentityTransform, readAccessor, type ParsedGlb } from './glbInspect'

const BOUNDS_TOLERANCE_METRES = 0.001
const AXES = ['width', 'height', 'depth'] as const

export function assertPropScale(glb: ParsedGlb, prop: WorldPropEntry): void {
  const node = glb.doc.nodes?.find(({ name }) => name === prop.nodeName)
  const position = glb.doc.meshes?.[node?.mesh ?? -1]?.primitives[0]?.attributes.POSITION
  if (position === undefined || !node || !isIdentityTransform(node)) {
    throw new Error(`${prop.id} requires a mesh in its unscaled export frame`)
  }
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const vertex of readAccessor(glb, position)) {
    for (const axis of [0, 1, 2] as const) {
      const value = vertex[axis]!
      if (!Number.isFinite(value)) throw new Error(`${prop.id} has a non-finite vertex`)
      min[axis] = Math.min(min[axis]!, value)
      max[axis] = Math.max(max[axis]!, value)
    }
  }

  const envelope = VEHICLE_ENVELOPES[prop.id]
  for (const axis of [0, 1, 2] as const) {
    const size = max[axis]! - min[axis]!
    const label = AXES[axis]
    if (Math.abs(min[axis]! - prop.bounds.min[axis]) > BOUNDS_TOLERANCE_METRES ||
        Math.abs(max[axis]! - prop.bounds.max[axis]) > BOUNDS_TOLERANCE_METRES ||
        Math.abs(size - prop.bounds.size[axis]) > BOUNDS_TOLERANCE_METRES) {
      throw new Error(`${prop.id} ${label} bounds differ from the exported mesh`)
    }
    if (envelope && (size < envelope.min[axis] - BOUNDS_TOLERANCE_METRES ||
        size > envelope.max[axis] + BOUNDS_TOLERANCE_METRES)) {
      throw new Error(`${prop.id} ${label} is ${size.toFixed(3)} m. Expected ${envelope.min[axis]}–${envelope.max[axis]} m.`)
    }
  }
}
