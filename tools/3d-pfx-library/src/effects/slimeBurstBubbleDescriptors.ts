import * as THREE from 'three'
import type { PfxSlimeBurstBubbleDescriptor } from '../types/02'

export function createPfxSlimeBurstBubbleDescriptors(): PfxSlimeBurstBubbleDescriptor[] {
  const descriptors: PfxSlimeBurstBubbleDescriptor[] = []
  const bubbleSizes = [0.075, 0.13, 0.19, 0.095, 0.225, 0.15, 0.105, 0.175, 0.12, 0.205, 0.085, 0.16, 0.115, 0.185, 0.14, 0.215, 0.1, 0.155] as const
  for (let bubble = 0; bubble < 18; bubble += 1) {
    const seed = ((bubble * 47 + 19) % 107) / 107
    const layer = bubble % 3
    const angle = bubble / 18 * Math.PI * 4 + layer * 0.38
    const elevation = 0.46 + ((bubble * 3) % 7) * 0.065
    const horizontal = Math.sqrt(Math.max(0.08, 1 - elevation * elevation))
    const direction = new THREE.Vector3(Math.cos(angle) * horizontal, elevation, Math.sin(angle) * horizontal).normalize()
    const center = direction.clone().multiplyScalar(0.68 + layer * 0.42 + (bubble % 4) * 0.06)
    center.y += 0.08 + layer * 0.14
    center.z *= 1.16
    descriptors.push({
      center,
      direction,
      seed,
      form: bubble % 3,
      size: bubbleSizes[bubble]!,
      rotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(seed * 1.4, seed * 2.2, seed * 1.8)),
    })
  }
  return descriptors
}
