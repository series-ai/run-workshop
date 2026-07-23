import * as THREE from 'three'
import type { PfxPetalBurstDescriptor } from '../types/02'

export function createPfxPetalBurstDescriptors(): PfxPetalBurstDescriptor[] {
  const elevations = [-0.72, 0.18, 0.78, -0.38, 0.58, -0.82, 0.34, 0.7] as const
  const radii = [0.32, 0.7, 1.08, 1.46, 1.82] as const
  const shellPhases = [0, 0.46, 1.04, 1.62, 2.24] as const
  const descriptors: PfxPetalBurstDescriptor[] = []
  for (let shell = 0; shell < 5; shell += 1) {
    for (let sector = 0; sector < 8; sector += 1) {
      const index = shell * 8 + sector
      const seed = ((index * 43 + 17) % 103) / 103
      const elevation = elevations[(sector + shell * 3) % elevations.length]!
      const horizontal = Math.sqrt(1 - elevation * elevation)
      const angle = sector / 8 * Math.PI * 2 + shellPhases[shell]! + (seed - 0.5) * 0.32
      const direction = new THREE.Vector3(Math.cos(angle) * horizontal, elevation, Math.sin(angle) * horizontal).normalize()
      const center = direction.clone().multiplyScalar(radii[shell]!).add(new THREE.Vector3(
        (seed - 0.5) * 0.08,
        (((index * 11) % 9) / 9 - 0.5) * 0.12 + shell * 0.12,
        (((index * 17) % 13) / 13 - 0.5) * 0.12,
      ))
      center.z *= 1.28
      const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction)
      rotation.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
        (seed - 0.5) * 0.82,
        ((((index * 5) % 19) / 19) - 0.5) * 0.78,
        ((((index * 11) % 23) / 23) - 0.5) * 1.34,
      )))
      descriptors.push({ center, direction, rotation, seed, form: index % 3, size: 0.3 + (index % 5) * 0.022 + shell * 0.006, shell })
    }
  }
  const centroid = descriptors.reduce((sum, descriptor) => sum.add(descriptor.center), new THREE.Vector3()).multiplyScalar(1 / descriptors.length)
  for (const descriptor of descriptors) descriptor.center.sub(centroid)
  return descriptors
}
