import * as THREE from 'three'
import type { PfxLeafBurstDescriptor } from '../types/02'

export function createPfxLeafBurstDescriptors(): PfxLeafBurstDescriptor[] {
  const elevations = [-0.76, 0.22, 0.82, -0.44, 0.64, -0.85, 0.38, 0.74, -0.18] as const
  const radii = [0.46, 0.88, 1.3, 1.68] as const
  const shellPhases = [0, 0.43, 1.07, 1.78] as const
  const descriptors: PfxLeafBurstDescriptor[] = []
  for (let shell = 0; shell < 4; shell += 1) {
    for (let sector = 0; sector < 9; sector += 1) {
      const index = shell * 9 + sector
      const seed = ((index * 37 + 11) % 101) / 101
      const elevation = elevations[(sector + shell * 2) % elevations.length]!
      const horizontal = Math.sqrt(1 - elevation * elevation)
      const angle = sector / 9 * Math.PI * 2 + shellPhases[shell]! + (seed - 0.5) * 0.34
      const direction = new THREE.Vector3(
        Math.cos(angle) * horizontal,
        elevation,
        Math.sin(angle) * horizontal,
      ).normalize()
      const center = direction.clone().multiplyScalar(radii[shell]!).add(new THREE.Vector3(
        (seed - 0.5) * 0.08,
        ((index * 13) % 7) / 7 * 0.08 - 0.04 + shell * 0.14,
        (((index * 19) % 11) / 11 - 0.5) * 0.1,
      ))
      center.z *= 1.24
      const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction)
      const localVariation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        (seed - 0.5) * 1.15,
        ((((index * 7) % 17) / 17) - 0.5) * 1.05,
        ((((index * 13) % 19) / 19) - 0.5) * 1.35,
      ))
      rotation.multiply(localVariation)
      descriptors.push({ center, direction, rotation, seed, form: index % 3, size: 0.29 + (index % 5) * 0.022 + shell * 0.008, shell })
    }
  }
  const centroid = descriptors.reduce((sum, descriptor) => sum.add(descriptor.center), new THREE.Vector3()).multiplyScalar(1 / descriptors.length)
  for (const descriptor of descriptors) descriptor.center.sub(centroid)
  return descriptors
}
