import * as THREE from 'three'
import { PFX_SCREEN_VIGNETTE_FRAGMENT, PFX_SCREEN_VIGNETTE_VERTEX } from '../constants/05'
import type { PfxSurfaceMaterialProps } from '../types/02'

export function createPfxScreenVignetteMaterial(materialProps: PfxSurfaceMaterialProps): THREE.ShaderMaterial {
  const color = new THREE.Color(materialProps.color)
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: materialProps.opacity },
      uColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
    },
    vertexShader: PFX_SCREEN_VIGNETTE_VERTEX,
    fragmentShader: PFX_SCREEN_VIGNETTE_FRAGMENT,
    transparent: true,
    blending: THREE.NormalBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
}
