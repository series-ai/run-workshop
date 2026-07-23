import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { appendPfxPlasmaHitTube } from '../constants/04'

export function createPfxPlasmaHitContactGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  appendPfxPlasmaHitTube(
    positions,
    colors,
    [new THREE.Vector3(0.05, 0, 0), new THREE.Vector3(0.14, 0, 0), new THREE.Vector3(0.23, 0, 0)],
    [0.035, 0.28, 0.04],
    [0.72, 1, 1],
  )
  appendPfxPlasmaHitTube(
    positions,
    colors,
    [new THREE.Vector3(0.14, -0.09, -0.02), new THREE.Vector3(0.14, 0, 0), new THREE.Vector3(0.14, 0.09, 0.02)],
    [0.03, 0.23, 0.03],
    [0.68, 0.94, 1],
  )
  appendPfxPlasmaHitTube(
    positions,
    colors,
    [new THREE.Vector3(0.1, 0.03, -0.09), new THREE.Vector3(0.14, 0, 0), new THREE.Vector3(0.18, -0.03, 0.09)],
    [0.03, 0.19, 0.03],
    [0.86, 0.72, 1],
  )

  const raw = new THREE.BufferGeometry()
  raw.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  raw.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const geometry = mergeVertices(raw, 1e-4)
  raw.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxPlasmaHitContactDrawCalls'] = 1
  geometry.userData['pfxPlasmaHitContactClosedVolume'] = true
  geometry.userData['pfxPlasmaHitContactLensCount'] = 3
  geometry.userData['pfxPlasmaHitContactTongueCount'] = 0
  geometry.userData['pfxPlasmaHitContactProfile'] = 'three-crossed-contact-knot'
  geometry.userData['pfxPlasmaHitContactDirectionalAxis'] = 'target-facing-contact-knot'
  geometry.userData['pfxPlasmaHitContactPlane'] = 'target-facing-yz-lens'
  geometry.userData['pfxPlasmaHitContactSmoothWeldedNormals'] = true
  geometry.userData['pfxPlasmaHitContactAxialSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxPlasmaHitContactLensAxialThickness'] = 0.18
  geometry.userData['pfxPlasmaHitContactDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxPlasmaHitContactFaceCount'] = geometry.index!.count / 3
  return geometry
}
