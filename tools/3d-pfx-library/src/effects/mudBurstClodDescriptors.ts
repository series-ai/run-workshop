import * as THREE from 'three'
import type { PfxMudBurstClodDescriptor } from '../types/02'

export function createPfxMudBurstClodDescriptors(): PfxMudBurstClodDescriptor[] {
  const elevations = [0.32, 0.72, 0.46, 0.84, 0.38, 0.64, 0.54, 0.78] as const
  const radii = [0.48, 0.92, 1.38] as const
  const descriptors: PfxMudBurstClodDescriptor[] = []
  for (let shell = 0; shell < 3; shell += 1) {
    for (let sector = 0; sector < 8; sector += 1) {
      const index = shell * 8 + sector
      const seed = ((index * 41 + 15) % 101) / 101
      const elevation = elevations[(sector + shell * 2) % elevations.length]!
      const horizontal = Math.sqrt(1 - elevation * elevation)
      const angle = sector / 8 * Math.PI * 2 + shell * 0.54 + (seed - 0.5) * 0.3
      const direction = new THREE.Vector3(Math.cos(angle) * horizontal, elevation, Math.sin(angle) * horizontal).normalize()
      const center = direction.clone().multiplyScalar(radii[shell]!).add(new THREE.Vector3((seed - 0.5) * 0.08, shell * 0.16, (((index * 17) % 11) / 11 - 0.5) * 0.1))
      center.z *= 1.2
      descriptors.push({
        center,
        direction,
        seed,
        form: index % 3,
        shell,
        size: 0.17 + (index % 5) * 0.03 + shell * 0.012,
        rotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(seed * 1.2, seed * 2.1, seed * 1.7)),
      })
    }
  }
  return descriptors
}
