import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'
import type { PfxControls } from '../types/01'
import type { PfxMeteorChunkPose, PfxParticleEmission } from '../types/02'

export function createPfxMeteorChunkGeometry(): THREE.BufferGeometry {
  const raw = new THREE.IcosahedronGeometry(1, 3)
  raw.deleteAttribute('normal')
  raw.deleteAttribute('uv')
  const merged = mergeVertices(raw, 1e-4)
  raw.dispose()
  const position = merged.getAttribute('position')
  const point = new THREE.Vector3()
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index)
    const irregularity =
      0.82 +
      Math.sin(point.x * 7.1 + point.y * 3.7 - point.z * 5.3) * 0.11 +
      Math.sin(point.x * 2.9 - point.y * 6.2 + point.z * 4.1) * 0.07
    position.setXYZ(
      index,
      point.x * irregularity * 0.92,
      point.y * irregularity * 0.78,
      point.z * irregularity,
    )
  }
  position.needsUpdate = true
  merged.computeVertexNormals()
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  const colors = new Float32Array(position.count * 3)
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index)
    const strata = 0.5 + Math.sin(point.y * 15 + point.x * 3.4 - point.z * 2.7) * 0.5
    const fracture = Math.pow(1 - Math.abs(Math.sin(point.x * 8.3 + point.y * 5.7 + point.z * 6.1)), 10)
    const heat = THREE.MathUtils.clamp(fracture * 0.82 + strata * 0.12, 0, 1)
    colors[index * 3] = 0.3 + heat * 0.7
    colors[index * 3 + 1] = 0.2 + heat * 0.42
    colors[index * 3 + 2] = 0.14 + heat * 0.16
  }
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  merged.userData['pfxMeteorChunkGeometry'] = 'irregular-closed-rock'
  merged.userData['pfxMeteorChunkDrawCalls'] = 1
  merged.userData['pfxMeteorChunkSurface'] = 'stratified-heat-fractured-rock'
  return merged
}

export function createPfxMeteorChunkMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    transparent: false,
    depthWrite: true,
    side: THREE.FrontSide,
    toneMapped: false,
    metalness: 0.03,
    roughness: 0.78,
    emissive: '#210704',
    emissiveIntensity: 0.16,
  })
  material.userData['pfxMaterial'] = 'meteor-instanced-rock-chunks'
  return material
}

export function createPfxMeteorChunkLayout(
  emission: PfxParticleEmission,
  controls: PfxControls,
  elapsedSeconds: number,
): PfxMeteorChunkPose[] {
  const lifetime = Math.max(0.25, controls.lifetime)
  const timeScale = Math.max(0.05, controls.timing)
  const cycle = ((elapsedSeconds * timeScale) % (lifetime * PFX_BURST_CYCLE_MULTIPLIER)) /
    (lifetime * PFX_BURST_CYCLE_MULTIPLIER)
  const incomingCount = Math.max(2, Math.floor(emission.count * 0.28))
  const scale = controls.scale
  const gravity = (controls.gravity * 0.85 - 2.2) * scale
  const trajectoryEuler = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0.92, -1.1, 0.72).normalize(),
    ),
  )

  return Array.from({ length: emission.count }, (_, index): PfxMeteorChunkPose => {
    const incoming = index < incomingCount
    let x = 0
    let y = 0
    let z = 0
    let energy = 0
    if (incoming) {
      const trailProgress = index / Math.max(1, incomingCount - 1)
      const descent = THREE.MathUtils.clamp(cycle / 0.22, 0, 1)
      const headX = THREE.MathUtils.lerp(-0.92 * scale, 0, descent)
      const headY = THREE.MathUtils.lerp(1.18 * scale, 0.08 * scale, descent)
      const headZ = THREE.MathUtils.lerp(-0.72 * scale, 0, descent) + Math.sin(descent * Math.PI) * 0.12 * scale
      const trailDistance = (1 - trailProgress) * 0.38 * scale
      x = headX - 0.58 * trailDistance
      y = headY + 0.8 * trailDistance
      z = headZ - 1.1 * trailDistance
      const arrivalFade = 1 - THREE.MathUtils.clamp((cycle - 0.13) / 0.055, 0, 1)
      energy = Math.sin(Math.min(1, cycle / 0.035) * Math.PI / 2) * arrivalFade * (0.42 + trailProgress * 0.58)
    } else {
      const progress = THREE.MathUtils.clamp((cycle - 0.1) / 0.69, 0, 1)
      const live = cycle >= 0.1 && cycle < 0.55
      const travelAge = progress * 1.35
      const travel = emission.speed[index]! * travelAge
      x = emission.spawn[index * 3]! + emission.direction[index * 3]! * travel
      y = emission.spawn[index * 3 + 1]! + emission.direction[index * 3 + 1]! * travel + gravity * travelAge * travelAge * 0.5
        + Math.sin(Math.min(1, progress * 1.35) * Math.PI) * 0.14 * scale
      z = emission.spawn[index * 3 + 2]! + emission.direction[index * 3 + 2]! * travel
      y = Math.max(0.035 * scale, y)
      energy = live
        ? THREE.MathUtils.clamp(progress / 0.08, 0, 1) * Math.pow(Math.max(0, 1 - progress), 0.58)
        : 0
    }

    const size = emission.variance[index * 2]!
    const phase = emission.rotation[index * 2]! + elapsedSeconds * emission.rotation[index * 2 + 1]!
    const lead = incoming && index === incomingCount - 1
    const trailProgress = incoming ? index / Math.max(1, incomingCount - 1) : 0
    const base = incoming ? (lead ? 0.043 : 0.026 + trailProgress * 0.012) : 0.09
    const authoredSize = incoming && !lead ? Math.max(0.72, size) : size
    const scaleX = base * authoredSize * (incoming ? 1 : 0.78 + (index % 4) * 0.09)
    const scaleY = base * authoredSize * (incoming ? 0.72 : 0.62 + ((index * 3) % 5) * 0.12)
    const scaleZ = base * authoredSize * (lead ? 1.72 : incoming ? 3.2 - trailProgress * 0.4 : 0.8 + ((index * 5) % 4) * 0.11)
    const heat = THREE.MathUtils.clamp(energy * emission.variance[index * 2 + 1]!, 0, 1)
    return {
      visible: energy > 0.012,
      incoming,
      position: [x, y, z],
      rotation: incoming
        ? [trajectoryEuler.x, trajectoryEuler.y, trajectoryEuler.z]
        : [phase * (0.37 + (index % 3) * 0.11), phase * 0.71 + index * 0.83, phase * 1.07 + index * 0.41],
      scale: [scaleX, scaleY, scaleZ],
      color: [0.28 + heat * 0.54, 0.06 + heat * 0.32, 0.025 + heat * 0.155],
    }
  })
}
