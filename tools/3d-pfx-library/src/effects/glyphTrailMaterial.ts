import * as THREE from 'three'

export function applyPfxGlyphTrailMaterialOpacity(material: THREE.ShaderMaterial, opacity: number): void {
  const uniform = material.uniforms['uOpacity']
  if (uniform) uniform.value = THREE.MathUtils.clamp(opacity, 0, 1)
}

export function applyPfxGlyphTrailMaterialCycle(material: THREE.ShaderMaterial, cycle: number): void {
  const uniform = material.uniforms['uCycle']
  if (uniform) uniform.value = THREE.MathUtils.clamp(cycle, 0, 1)
}
