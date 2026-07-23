import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxWaterConeLifecycle(cycle: number): {
  energy: number
  reach: number
  stage: 'gather' | 'surge' | 'breakup' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.18) {
    const gather = smooth(phase / 0.18)
    return {
      energy: roundMetric(0.24 + gather * 0.76),
      reach: roundMetric(0.3 + gather * 0.7),
      stage: 'gather',
    }
  }
  if (phase < 0.68) {
    const surge = (phase - 0.18) / 0.5
    return {
      energy: roundMetric(0.88 + Math.sin(surge * Math.PI * 3) * 0.12),
      reach: roundMetric(1 + Math.sin(surge * Math.PI * 2) * 0.03),
      stage: 'surge',
    }
  }
  if (phase < 0.9) {
    const breakup = smooth((phase - 0.68) / 0.22)
    return {
      energy: roundMetric(0.9 * (1 - breakup)),
      reach: roundMetric(1 - breakup * 0.9),
      stage: 'breakup',
    }
  }
  return { energy: 0, reach: 0, stage: 'rest' }
}

export function createPfxWaterConeGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const add = (point: THREE.Vector3) => {
    positions.push(point.x, point.y, point.z)
    uvs.push(Math.atan2(point.z, point.x) / (Math.PI * 2) + 0.5, (point.y + 1.02) / 2.2)
  }
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    add(a)
    add(b)
    add(c)
  }
  const segments = 18
  const rings = [
    { y: -1.02, radius: 0.07 },
    { y: -0.72, radius: 0.15 },
    { y: -0.15, radius: 0.31 },
    { y: 0.48, radius: 0.49 },
    { y: 1.12, radius: 0.64 },
  ]
  const point = (ring: { y: number; radius: number }, index: number) => {
    const angle = (index / segments) * Math.PI * 2
    const mouth = THREE.MathUtils.smoothstep(ring.y, 0.2, 1.12)
    const scallop = 1 + mouth * (Math.sin(angle * 5 + 0.6) * 0.1 + Math.cos(angle * 2 - 0.4) * 0.06)
    return new THREE.Vector3(
      Math.cos(angle) * ring.radius * scallop * 1.05,
      ring.y,
      Math.sin(angle) * ring.radius * scallop * 0.92,
    )
  }
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments
      const a = point(rings[ringIndex]!, segment)
      const b = point(rings[ringIndex]!, next)
      const c = point(rings[ringIndex + 1]!, segment)
      const d = point(rings[ringIndex + 1]!, next)
      triangle(a, b, c)
      triangle(b, d, c)
    }
  }
  const throat = new THREE.Vector3(0, rings[0]!.y, 0)
  for (let segment = 0; segment < segments; segment += 1) {
    triangle(throat, point(rings[0]!, (segment + 1) % segments), point(rings[0]!, segment))
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}
