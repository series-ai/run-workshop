import * as THREE from 'three'
import { markPfxReferenceAdaptation } from '../constants/04'
import { createPfxRainBurstGeometry } from './rainBurst'

export function createPfxMudBurstRainReferenceGeometry(): THREE.BufferGeometry {
  const source = createPfxRainBurstGeometry()
  const formAttribute = source.getAttribute('pfxRainForm')
  const progressAttribute = source.getAttribute('pfxRainProgress')
  const sourceVertexCount = source.getAttribute('position').count
  const retainedAttributes = Object.fromEntries(
    Object.entries(source.attributes).map(([name]) => [name, [] as number[]]),
  ) as Record<string, number[]>
  for (let vertex = 0; vertex < sourceVertexCount; vertex += 3) {
    const form = formAttribute?.getX(vertex) ?? 0
    const progress = progressAttribute?.getX(vertex) ?? 0
    if (form > 1.5 && form < 2.5 && progress > 0.5) continue
    for (const [name, attribute] of Object.entries(source.attributes)) {
      const values = retainedAttributes[name]!
      for (let offset = 0; offset < 3; offset += 1) {
        const base = (vertex + offset) * attribute.itemSize
        for (let component = 0; component < attribute.itemSize; component += 1) {
          values.push(attribute.array[base + component] as number)
        }
      }
    }
  }
  const filtered = new THREE.BufferGeometry()
  for (const [name, attribute] of Object.entries(source.attributes)) {
    filtered.setAttribute(name, new THREE.Float32BufferAttribute(retainedAttributes[name]!, attribute.itemSize, attribute.normalized))
  }
  filtered.userData = { ...source.userData, pfxRainBurstRippleBandCount: 1, pfxMudReferenceOuterRippleBandRemoved: true }
  source.dispose()
  return markPfxReferenceAdaptation(
    filtered,
    'rain-burst-water-crown',
    'wet-umber-continuous-splash-crown',
    [0.88, 0.82, 0.88],
    [0, 0.02, 0],
  )
}
