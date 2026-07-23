import * as THREE from 'three'

export function createPfxCoinGoldMaterial(opacity: number, color: string): THREE.MeshStandardMaterial {
  const gold = new THREE.Color(color)
  const edge = gold.clone().multiplyScalar(0.92)
  return new THREE.MeshStandardMaterial({
    color: edge,
    metalness: 0.82,
    roughness: 0.2,
    emissive: gold.clone().multiplyScalar(0.14),
    emissiveIntensity: 0.42,
    opacity,
    transparent: opacity < 1,
  })
}
