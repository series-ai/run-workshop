import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxCurseColumnLifecycle(cycle: number): {
  energy: number
  scale: number
  stage: 'gather' | 'bind' | 'collapse' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.14) {
    const gather = smooth(phase / 0.14)
    return {
      energy: roundMetric(0.64 + gather * 0.36),
      scale: roundMetric(0.42 + gather * 0.58),
      stage: 'gather',
    }
  }
  if (phase < 0.5) {
    const bind = (phase - 0.14) / 0.36
    return {
      energy: roundMetric(0.92 + Math.sin(bind * Math.PI * 4) * 0.08),
      scale: roundMetric(1 + Math.sin(bind * Math.PI * 2) * 0.04),
      stage: 'bind',
    }
  }
  if (phase < 0.88) {
    const collapse = smooth((phase - 0.5) / 0.38)
    return {
      energy: roundMetric(0.86 * (1 - collapse)),
      scale: roundMetric(1 - collapse * 0.58),
      stage: 'collapse',
    }
  }
  return { energy: 0, scale: 0, stage: 'rest' }
}

export function createPfxCurseColumnGeometry(widthScale = 12): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const segments = 7
  const width = THREE.MathUtils.clamp(widthScale / 12, 0.72, 1.5)
  const rings = [
    { y: -0.94, x: -0.18, z: 0.04, rx: 0.52 * width, rz: 0.24 * width, twist: 0 },
    { y: -0.46, x: 0.18, z: -0.14, rx: 0.42 * width, rz: 0.34 * width, twist: 0.28 },
    { y: 0.04, x: -0.15, z: 0.17, rx: 0.46 * width, rz: 0.26 * width, twist: -0.24 },
    { y: 0.56, x: 0.18, z: -0.17, rx: 0.28 * width, rz: 0.35 * width, twist: 0.42 },
    { y: 0.96, x: -0.08, z: 0.1, rx: 0.12 * width, rz: 0.18 * width, twist: -0.12 },
    { y: 1.28, x: 0.04, z: -0.02, rx: 0.06 * width, rz: 0.08 * width, twist: 0.18 },
  ]
  const point = (ring: (typeof rings)[number], segment: number) => {
    const angle = (segment / segments) * Math.PI * 2 + ring.twist
    return new THREE.Vector3(
      ring.x + Math.cos(angle) * ring.rx,
      ring.y,
      ring.z + Math.sin(angle) * ring.rz,
    )
  }
  const push = (pointValue: THREE.Vector3, u: number, v: number) => {
    positions.push(pointValue.x, pointValue.y, pointValue.z)
    uvs.push(u, v)
  }
  const triangle = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    uvA: readonly [number, number],
    uvB: readonly [number, number],
    uvC: readonly [number, number],
  ) => {
    push(a, uvA[0], uvA[1])
    push(b, uvB[0], uvB[1])
    push(c, uvC[0], uvC[1])
  }
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const lower = rings[ringIndex]!
    const upper = rings[ringIndex + 1]!
    const v0 = ringIndex / (rings.length - 1)
    const v1 = (ringIndex + 1) / (rings.length - 1)
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments
      const u0 = segment / segments
      const u1 = (segment + 1) / segments
      const a = point(lower, segment)
      const b = point(lower, next)
      const c = point(upper, next)
      const d = point(upper, segment)
      triangle(a, b, c, [u0, v0], [u1, v0], [u1, v1])
      triangle(a, c, d, [u0, v0], [u1, v1], [u0, v1])
    }
  }
  const addThorn = (
    center: THREE.Vector3,
    tip: THREE.Vector3,
    halfWidth: number,
    halfDepth: number,
  ) => {
    const base = [
      center.clone().add(new THREE.Vector3(-halfWidth, -halfWidth * 0.45, -halfDepth)),
      center.clone().add(new THREE.Vector3(halfWidth, -halfWidth * 0.45, -halfDepth)),
      center.clone().add(new THREE.Vector3(halfWidth, halfWidth * 0.45, halfDepth)),
      center.clone().add(new THREE.Vector3(-halfWidth, halfWidth * 0.45, halfDepth)),
    ]
    for (let face = 0; face < 4; face += 1) {
      const next = (face + 1) % 4
      triangle(base[face]!, base[next]!, tip, [0, 0], [1, 0], [0.5, 1])
    }
    triangle(base[0]!, base[2]!, base[1]!, [0, 0], [1, 1], [1, 0])
    triangle(base[0]!, base[3]!, base[2]!, [0, 0], [0, 1], [1, 1])
  }
  addThorn(new THREE.Vector3(0, 0.18, 0.2), new THREE.Vector3(0.06, 1.08, 0.94), 0.1, 0.14)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  const positionAttribute = geometry.getAttribute('position')
  const normalAttribute = geometry.getAttribute('normal')
  const colors: number[] = []
  const dark = new THREE.Color('#260b3a')
  const violet = new THREE.Color('#7f3bb5')
  const hot = new THREE.Color('#e7c4ff')
  const lightDirection = new THREE.Vector3(0.42, 0.78, 0.34).normalize()
  for (let index = 0; index < positionAttribute.count; index += 1) {
    const normal = new THREE.Vector3(
      normalAttribute.getX(index),
      normalAttribute.getY(index),
      normalAttribute.getZ(index),
    )
    const shade = 0.34 + Math.abs(normal.dot(lightDirection)) * 0.66
    const color = dark.clone().lerp(violet, shade)
    if (Math.floor(index / 3) % 11 === 0) color.lerp(hot, 0.48)
    colors.push(color.r, color.g, color.b)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData = {
    pfxGeometry: 'curse-column-twisted-volume',
    ringCount: rings.length,
    radialSegments: segments,
    alternatingCrossSection: true,
    thornCount: 1,
    depthSpine: true,
  }
  return geometry
}
