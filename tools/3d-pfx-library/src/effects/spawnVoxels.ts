import * as THREE from 'three'
import type { PfxRenderSurface } from '../types/02'

export type PfxSpawnVoxelMaterialRole = 'accent' | 'core'

export function getPfxSpawnVoxelMaterialRole(
  surface: Pick<PfxRenderSurface, 'kind' | 'tuning'>,
): PfxSpawnVoxelMaterialRole {
  return surface.kind === 'spawn-voxels' && surface.tuning?.blend === 'additive'
    ? 'accent'
    : 'core'
}

export function createPfxSpawnVoxelMaterial(
  color: THREE.ColorRepresentation,
  opacity: number,
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
}
