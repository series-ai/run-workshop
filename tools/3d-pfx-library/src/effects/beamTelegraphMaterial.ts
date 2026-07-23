import * as THREE from 'three'

export function applyPfxBeamTelegraphMaterialAppearance(material: THREE.ShaderMaterial, opacity: number, cycle: number): void {
  const opacityUniform = material.uniforms['uOpacity']
  if (opacityUniform) opacityUniform.value = THREE.MathUtils.clamp(opacity, 0, 1)
  const cycleUniform = material.uniforms['uCycle']
  if (cycleUniform) cycleUniform.value = THREE.MathUtils.clamp(cycle, 0, 1)
}
