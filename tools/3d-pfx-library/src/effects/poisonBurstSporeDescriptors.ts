import * as THREE from 'three'
import type { PfxPoisonBurstSporeDescriptor } from '../types/02'

export function createPfxPoisonBurstSporeDescriptors(): PfxPoisonBurstSporeDescriptor[] {
  const descriptors: PfxPoisonBurstSporeDescriptor[] = []
  for (let spore = 0; spore < 24; spore += 1) {
    const seed = ((spore * 59 + 23) % 113) / 113
    const shell = spore % 3
    const angle = spore * 2.39996 + shell * 0.34
    const elevation = 0.28 + ((spore * 5) % 9) * 0.07
    const horizontal = Math.sqrt(Math.max(0.08, 1 - elevation * elevation))
    const direction = new THREE.Vector3(Math.cos(angle) * horizontal, elevation, Math.sin(angle) * horizontal).normalize()
    const center = direction.clone().multiplyScalar(0.54 + shell * 0.42 + (spore % 4) * 0.05)
    center.y += 0.3 + shell * 0.12
    center.z *= 1.18
    descriptors.push({
      center,
      direction,
      seed,
      form: spore % 4,
      size: 0.075 + (spore % 6) * 0.02,
      rotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(seed * 1.7, seed * 2.3, seed * 1.4)),
    })
  }
  return descriptors
}
