import * as THREE from 'three'
import { markPfxReferenceAdaptation } from '../constants/04'
import { markPfxReferenceAdaptationMaterial } from '../constants/05'
import { createPfxHolyReleaseGeometry, createPfxHolyReleaseMaterial } from './holyRelease'

export function createPfxHolyBurstReferenceGeometry(): THREE.BufferGeometry {
  // The holy-release reference already carries the intended semantic
  // silhouette: a closed mandorla, cross-axis rays, a swept wing pair, and
  // a cleansing crown. It is a better adaptation target than a loose radial
  // flower of small lobes, so keep its authored form/lifecycle attributes.
  return markPfxReferenceAdaptation(
    createPfxHolyReleaseGeometry(),
    'holy-release-radiant-mandorla',
    'faceted-mandorla-with-cross-axis-rays-wing-pair-and-cleansing-crown',
    [1.08, 1.08, 1.08],
    [0, 0.05, 0],
  )
}

export function createPfxHolyBurstReferenceMaterial(
  opacity: number,
  primaryColor: THREE.ColorRepresentation = '#fff1b8',
  secondaryColor: THREE.ColorRepresentation = '#ffd24a',
  accentColor: THREE.ColorRepresentation = '#7dd3fc',
  density = 0.56,
  styleEdgeHardness = 0.48,
): THREE.ShaderMaterial {
  const material = markPfxReferenceAdaptationMaterial(
    createPfxHolyReleaseMaterial(opacity),
    'holy-release-radiant-mandorla',
    'faceted-mandorla-with-cross-axis-rays-wing-pair-and-cleansing-crown',
  )
  material.userData['pfxHolyBurstMaterial'] = true
  material.userData['pfxHolyBurstMaterialRole'] = 'reference-mandorla'
  material.userData['pfxHolyBurstMaterialProfile'] = 'white-gold-faceted-release-with-blue-cleansing-rim'
  material.userData['pfxHolyBurstReferencePaletteInputs'] = [primaryColor, secondaryColor, accentColor]
  material.userData['pfxHolyBurstReferenceDensity'] = density
  material.userData['pfxHolyBurstReferenceStyleEdgeHardness'] = styleEdgeHardness
  return material
}
