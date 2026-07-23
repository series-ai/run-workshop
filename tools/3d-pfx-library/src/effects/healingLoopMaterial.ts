import * as THREE from 'three'

export function applyPfxHealingLoopMaterialAppearance(material: THREE.ShaderMaterial, opacity: number, cycle: number): void {
  const opacityUniform = material.uniforms['uOpacity']
  if (opacityUniform) opacityUniform.value = THREE.MathUtils.clamp(opacity, 0, 1)
  const cycleUniform = material.uniforms['uCycle']
  if (cycleUniform) cycleUniform.value = ((cycle % 1) + 1) % 1
}
