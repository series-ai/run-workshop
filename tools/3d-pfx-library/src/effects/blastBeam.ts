import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxBlastBeamLifecycle(cycle: number): {
  energy: number
  reach: number
  stage: 'ignite' | 'sustain' | 'collapse' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.18) {
    const ignite = smooth(phase / 0.18)
    return {
      energy: roundMetric(0.28 + ignite * 0.72),
      reach: roundMetric(0.32 + ignite * 0.68),
      stage: 'ignite',
    }
  }
  if (phase < 0.68) {
    const hold = (phase - 0.18) / 0.5
    return {
      energy: roundMetric(0.84 + Math.sin(hold * Math.PI * 3) * 0.12),
      reach: roundMetric(1 + Math.sin(hold * Math.PI * 2) * 0.025),
      stage: 'sustain',
    }
  }
  if (phase < 0.9) {
    const collapse = smooth((phase - 0.68) / 0.22)
    return {
      energy: roundMetric(0.92 * (1 - collapse)),
      reach: roundMetric(1 - collapse * 0.94),
      stage: 'collapse',
    }
  }
  return { energy: 0, reach: 0, stage: 'rest' }
}

export function createPfxBlastBeamGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const add = (point: THREE.Vector3) => {
    positions.push(point.x, point.y, point.z)
    uvs.push(Math.atan2(point.z, point.x) / (Math.PI * 2) + 0.5, (point.y + 1.05) / 2.35)
  }
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    add(a)
    add(b)
    add(c)
  }
  const segments = 18
  const rings = [
    { y: -1.05, radius: 0.44 },
    { y: -0.82, radius: 0.34 },
    { y: 0.18, radius: 0.25 },
    { y: 0.78, radius: 0.14 },
    { y: 1.18, radius: 0.035 },
  ]
  const point = (ring: { y: number; radius: number }, index: number) => {
    const angle = (index / segments) * Math.PI * 2
    const sourceInfluence = THREE.MathUtils.clamp((0.72 - ring.y) / 1.77, 0, 1)
    const lobe = 1 + sourceInfluence * (
      Math.cos(angle - 0.4) * 0.11 + Math.cos(angle * 3 + 0.7) * 0.05
    )
    // A taller, subtly three-lobed source cross-section gives front and
    // three-quarter views different silhouettes while preserving a closed
    // axial volume and tapering back to a clean target apex.
    return new THREE.Vector3(
      Math.cos(angle) * ring.radius * lobe * 1.24,
      ring.y,
      Math.sin(angle) * ring.radius * lobe * 0.9,
    )
  }
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const lower = rings[ringIndex]!
    const upper = rings[ringIndex + 1]!
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments
      const a = point(lower, segment)
      const b = point(lower, next)
      const c = point(upper, segment)
      const d = point(upper, next)
      triangle(a, b, c)
      triangle(b, d, c)
    }
  }
  const bottomCenter = new THREE.Vector3(0, rings[0]!.y, 0)
  for (let segment = 0; segment < segments; segment += 1) {
    triangle(bottomCenter, point(rings[0]!, (segment + 1) % segments), point(rings[0]!, segment))
  }
  // Close into one clean crown instead of separate fins: detached prongs
  // made the beam read as a forked doorway from front and side views.
  const apex = new THREE.Vector3(0, 1.3, 0)
  for (let segment = 0; segment < segments; segment += 1) {
    triangle(point(rings.at(-1)!, segment), point(rings.at(-1)!, (segment + 1) % segments), apex)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}
