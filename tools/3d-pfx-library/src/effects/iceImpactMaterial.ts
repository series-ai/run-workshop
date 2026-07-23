import * as THREE from 'three'

export function applyPfxIceImpactMaterialOpacity(material: THREE.ShaderMaterial, opacity: number): void {
  const uniform = material.uniforms['uOpacity']
  if (uniform) uniform.value = THREE.MathUtils.clamp(opacity, 0, 1)
}
