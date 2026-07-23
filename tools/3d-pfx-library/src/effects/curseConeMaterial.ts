import * as THREE from 'three'

export function applyPfxCurseConeMaterialAppearance(material: THREE.ShaderMaterial, opacity: number, cycle: number): void {
  material.uniforms['uOpacity']!.value = THREE.MathUtils.clamp(opacity, 0, 1)
  material.uniforms['uCycle']!.value = ((cycle % 1) + 1) % 1
}
