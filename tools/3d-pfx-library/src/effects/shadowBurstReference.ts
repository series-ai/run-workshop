import * as THREE from 'three'
import { markPfxReferenceAdaptation } from '../constants/04'
import { markPfxReferenceAdaptationMaterial } from '../constants/05'
import { createPfxShadowBurstClawGeometry, createPfxShadowBurstClawMaterial } from './shadowBurstClaw'

export function createPfxShadowBurstReferenceGeometry(): THREE.BufferGeometry {
  const geometry = markPfxReferenceAdaptation(
    createPfxShadowBurstClawGeometry(),
    'shadow-burst-spectral-claw',
    'slate-spectral-claw-over-ground-shadow',
    [1.12, 1.12, 1.12],
    [0, 0, 0],
  )
  geometry.userData['pfxShadowBurstReferencePresentationScale'] = 1.12
  return geometry
}

export function createPfxShadowBurstReferenceMaterial(
  opacity: number,
  inkColor = '#0d0b16',
  slateColor = '#4a5669',
  bruiseColor = '#9ab4c9',
  _seamColor = '#c3d2dd',
): THREE.ShaderMaterial {
  return markPfxReferenceAdaptationMaterial(
    createPfxShadowBurstClawMaterial(opacity, inkColor, slateColor, bruiseColor, 0.58, 0.66),
    'shadow-burst-spectral-claw',
    'slate-spectral-claw-over-ground-shadow',
  )
}
