import * as THREE from 'three'

export function createPfxMeteorHeatFrontGeometry(): THREE.BufferGeometry {
  const innerRadius = 0.52
  const outerRadius = 0.78
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 64, 1)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxMeteorHeatFrontGeometry'] = 'open-annular-pressure-front'
  geometry.userData['pfxMeteorHeatFrontCenterFilled'] = false
  geometry.userData['pfxMeteorHeatFrontInnerRadius'] = innerRadius
  geometry.userData['pfxMeteorHeatFrontOuterRadius'] = outerRadius
  return geometry
}
