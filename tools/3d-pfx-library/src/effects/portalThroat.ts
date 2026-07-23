import * as THREE from 'three'

export function createPfxPortalThroatGeometry(): THREE.TorusGeometry {
  const geometry = new THREE.TorusGeometry(0.66, 0.12, 24, 64)
  geometry.computeVertexNormals()
  geometry.userData['pfxPortalThroatGeometry'] = 'rounded-aperture-rim'
  return geometry
}
