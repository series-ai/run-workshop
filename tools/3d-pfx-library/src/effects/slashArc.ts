import * as THREE from 'three'
import { PFX_ARC_INNER_RADIUS, PFX_ARC_OUTER_RADIUS, PFX_ARC_THETA_LENGTH, PFX_ARC_THETA_START } from '../constants/05'

export function createPfxSlashArcGeometry(): THREE.ExtrudeGeometry {
  const endAngle = PFX_ARC_THETA_START + PFX_ARC_THETA_LENGTH
  const shape = new THREE.Shape()
  shape.absarc(0, 0, PFX_ARC_OUTER_RADIUS, PFX_ARC_THETA_START, endAngle, false)
  shape.lineTo(
    Math.cos(endAngle) * PFX_ARC_INNER_RADIUS,
    Math.sin(endAngle) * PFX_ARC_INNER_RADIUS,
  )
  shape.absarc(0, 0, PFX_ARC_INNER_RADIUS, endAngle, PFX_ARC_THETA_START, true)
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    steps: 1,
    curveSegments: 72,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.02,
    bevelThickness: 0.02,
  })
  geometry.translate(0, 0, -0.08)
  geometry.computeVertexNormals()
  geometry.userData['pfxSlashArcGeometry'] = 'beveled-extruded-crescent'
  return geometry
}
