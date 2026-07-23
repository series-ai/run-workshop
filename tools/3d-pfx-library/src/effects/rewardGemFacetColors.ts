import * as THREE from 'three'

export function getPfxRewardGemFacetColors(color: THREE.ColorRepresentation): {
  shadow: string
  body: string
  highlight: string
} {
  const base = new THREE.Color(color)
  return {
    shadow: `#${base.clone().multiplyScalar(0.42).getHexString()}`,
    body: `#${base.clone().multiplyScalar(0.82).getHexString()}`,
    highlight: `#${base.clone().lerp(new THREE.Color('#ffffff'), 0.7).getHexString()}`,
  }
}
