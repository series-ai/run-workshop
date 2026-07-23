import { PFX_SPRITE_SLICES, PfxSpriteName } from '../particleSprites'
import * as THREE from 'three'
import type { PfxSpriteVariantLayout } from '../types/02'

export function getPfxSpriteVariantLayout(sprite: PfxSpriteName): PfxSpriteVariantLayout {
  const slice = PFX_SPRITE_SLICES[sprite]
  const count = 'variantCount' in slice ? slice.variantCount : 1
  const columns = 'variantColumns' in slice ? slice.variantColumns : 1
  return {
    offset: new THREE.Vector2(slice.u, slice.v),
    cellScale: new THREE.Vector2(slice.w, slice.h),
    count,
    columns,
    startIndex: 'variantStartIndex' in slice ? slice.variantStartIndex : 0,
    rowDirection: 'variantRowDirection' in slice ? slice.variantRowDirection : 1,
  }
}
