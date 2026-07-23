import * as THREE from 'three'

export function applyPfxFrostAuraMaterialOpacity(material: THREE.ShaderMaterial, opacity: number): void {
  const uniform = material.uniforms['uOpacity']
  if (uniform) uniform.value = THREE.MathUtils.clamp(opacity, 0, 1)
}

export function applyPfxFrostAuraMaterialCycle(material: THREE.ShaderMaterial, cycle: number): void {
  const uniform = material.uniforms['uCycle']
  if (uniform) uniform.value = ((cycle % 1) + 1) % 1
}
