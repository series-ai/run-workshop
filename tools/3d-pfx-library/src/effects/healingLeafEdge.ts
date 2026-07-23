import * as THREE from 'three'

export function createPfxHealingLeafEdgeMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  const edgeColor = new THREE.Color(color).multiplyScalar(0.42)
  const material = new THREE.MeshStandardMaterial({
    color: edgeColor,
    emissive: edgeColor,
    emissiveIntensity: 0.24,
    roughness: 0.46,
    metalness: 0,
    transparent: true,
    opacity: Math.max(0, Math.min(1, opacity)),
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: true,
  })
  material.userData['pfxHealingLeafLayer'] = 'extruded-edge'
  return material
}
