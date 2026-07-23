import * as THREE from 'three'
import { markPfxReferenceAdaptation } from '../constants/04'
import { markPfxReferenceAdaptationMaterial } from '../constants/05'
import { createPfxHealingBurstBloomGeometry, createPfxHealingBurstBloomMaterial } from './healingBurstBloom'

export function createPfxHealingBurstReferenceGeometry(): THREE.BufferGeometry {
  return markPfxReferenceAdaptation(
    createPfxHealingBurstBloomGeometry(),
    'healing-loop-renewal-helix',
    'vertical-sanctuary-halo-with-centered-closed-hero-cross-and-rising-sparkles',
    [1.12, 1.12, 1.12],
    [0, 0.02, 0],
  )
}

export function createPfxHealingBurstReferenceMaterial(
  opacity: number,
  primaryColor: THREE.ColorRepresentation = '#37d982',
  secondaryColor: THREE.ColorRepresentation = '#d7f8df',
  accentColor: THREE.ColorRepresentation = '#fff0b0',
  density = 0.52,
  styleEdgeHardness = 0.48,
): THREE.ShaderMaterial {
  return markPfxReferenceAdaptationMaterial(
    createPfxHealingBurstBloomMaterial(opacity, primaryColor, secondaryColor, accentColor, density, styleEdgeHardness),
    'healing-loop-renewal-helix',
    'vertical-sanctuary-halo-with-centered-closed-hero-cross-and-rising-sparkles',
  )
}
