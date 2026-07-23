import * as THREE from 'three'
import type { PfxAcidBurstDropletDescriptor } from '../types/02'

export function createPfxAcidBurstDropletDescriptors(): PfxAcidBurstDropletDescriptor[] {
  const elevations = [0.34, 0.72, 0.48, 0.84, 0.4, 0.64, 0.56] as const
  const radii = [0.48, 0.86, 1.24, 1.58] as const
  const descriptors: PfxAcidBurstDropletDescriptor[] = []
  for (let shell = 0; shell < 4; shell += 1) {
    for (let sector = 0; sector < 7; sector += 1) {
      const index = shell * 7 + sector
      const seed = ((index * 47 + 13) % 103) / 103
      const elevation = elevations[(sector + shell * 2) % elevations.length]!
      const horizontal = Math.sqrt(1 - elevation * elevation)
      const angle = sector / 7 * Math.PI * 2 + shell * 0.58 + (seed - 0.5) * 0.34
      const direction = new THREE.Vector3(Math.cos(angle) * horizontal, elevation, Math.sin(angle) * horizontal).normalize()
      const center = direction.clone().multiplyScalar(radii[shell]!).add(new THREE.Vector3((seed - 0.5) * 0.08, shell * 0.14, (((index * 17) % 11) / 11 - 0.5) * 0.1))
      center.z *= 1.18
      descriptors.push({
        center,
        direction,
        seed,
        form: index % 4,
        shell,
        size: 0.075 + (index % 5) * 0.014 + shell * 0.004,
        rotation: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction),
      })
    }
  }
  return descriptors
}
