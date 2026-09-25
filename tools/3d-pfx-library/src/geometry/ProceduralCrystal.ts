import * as THREE from 'three'

/**
 * CPU-side procedural crystal geometry generator.
 *
 * Adapted from Chiro Visuals (LinearAbiltyCastingThreeJS) for 100% assetless,
 * deterministic 3D crystal rendering. Generates a 60-triangle faceted prism
 * in unit space (base ring on y=0, radius=0.5, apex at y=1).
 *
 * Deterministic in `seed`: identical seeds always produce identical geometries.
 */

const TAU = Math.PI * 2
const RING_HEIGHTS = [0, 0.22, 0.5, 0.75, 0.92]

/** Deterministic hash -> [0, 1) */
export function hash11(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123
  return s - Math.floor(s)
}

function profileRadius(t: number, taper: number): number {
  return taper + (1 - taper) * Math.pow(1 - t, 1.15)
}

export interface CrystalGeometryOptions {
  seed?: number
  sides?: number
  taper?: number
  roughness?: number
  bend?: number
}

/**
 * Creates a single faceted crystal geometry.
 *
 * Default settings (sides=6) produce exactly 60 triangles (180 vertices),
 * perfectly budgeted for mobile WebViews and TBDR caching.
 */
export function createCrystalGeometry({
  seed = 1,
  sides = 6,
  taper = 0.13,
  roughness = 0.28,
  bend = 0.22,
}: CrystalGeometryOptions = {}): THREE.BufferGeometry {
  const facets = Math.max(3, Math.round(sides))
  const tipRadius = Math.min(0.9, Math.max(0.01, taper))

  // One fixed bend direction per crystal
  const bendAngle = hash11(seed * 1.77) * TAU
  const bendX = Math.cos(bendAngle)
  const bendZ = Math.sin(bendAngle)

  /** Lateral drift of crystal axis at height t */
  const axisOffset = (t: number) => bend * 0.5 * Math.pow(t, 1.6)

  // Jittered facet angles shared by all rings so facets form continuous vertical edges
  const angles: number[] = []
  for (let i = 0; i < facets; i++) {
    const jitter = (hash11(seed * 3.13 + i * 7.7) - 0.5) * (TAU / facets) * 0.55 * roughness * 3
    angles.push((i / facets) * TAU + jitter)
  }

  const rings: [number, number, number][][] = RING_HEIGHTS.map((t, ringIndex) => {
    const baseR = profileRadius(t, tipRadius) * 0.5
    const drift = axisOffset(t)
    const y = t + (hash11(seed * 5.9 + ringIndex * 2.3) - 0.5) * 0.06 * roughness * (t > 0 ? 1 : 0)

    return angles.map((angle, i) => {
      const wobble = 1 + (hash11(seed * 11.1 + ringIndex * 13.7 + i * 3.9) - 0.5) * roughness * 1.3 * (0.35 + 0.65 * t)
      const r = Math.max(0.002, baseR * wobble)
      return [
        Math.cos(angle) * r + bendX * drift,
        y,
        Math.sin(angle) * r + bendZ * drift,
      ] as [number, number, number]
    })
  })

  // Slightly offset apex for chipped look
  const apexDrift = axisOffset(1)
  const apex: [number, number, number] = [
    bendX * apexDrift + (hash11(seed * 17.3) - 0.5) * 0.09 * roughness,
    1,
    bendZ * apexDrift + (hash11(seed * 19.7) - 0.5) * 0.09 * roughness,
  ]
  const floorCentre: [number, number, number] = [0, 0, 0]

  const positions: number[] = []
  const push = (p: [number, number, number]) => positions.push(p[0], p[1], p[2])

  // Ring side walls
  for (let ring = 0; ring < rings.length - 1; ring++) {
    const lower = rings[ring]
    const upper = rings[ring + 1]
    for (let i = 0; i < facets; i++) {
      const j = (i + 1) % facets
      push(lower[i]); push(lower[j]); push(upper[i])
      push(lower[j]); push(upper[j]); push(upper[i])
    }
  }

  // Top apex point and bottom cap
  const top = rings[rings.length - 1]
  const base = rings[0]
  for (let i = 0; i < facets; i++) {
    const j = (i + 1) % facets
    push(top[i]); push(top[j]); push(apex)
    push(floorCentre); push(base[j]); push(base[i])
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  // Non-indexed per-face normals keep facets crisp and prismatic
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  geometry.userData['pfxProceduralCrystal'] = true
  geometry.userData['pfxSeed'] = seed
  geometry.userData['pfxTriangleCount'] = positions.length / 9

  return geometry
}

/**
 * Creates a low-profile jagged shard (ground-level cold rubble).
 */
export function createShardGeometry(seed = 5, sides = 5): THREE.BufferGeometry {
  return createCrystalGeometry({
    seed: seed * 2.7 + 41,
    sides,
    taper: 0.22,
    roughness: 0.55,
    bend: 0.35,
  })
}
