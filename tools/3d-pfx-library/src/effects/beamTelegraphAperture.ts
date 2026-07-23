import * as THREE from 'three'
import { appendPfxBeamTelegraphStroke } from '../constants/04'

export function createPfxBeamTelegraphApertureGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const deepCyan: readonly [number, number, number] = [0.015, 0.2, 0.3]
  const cyan: readonly [number, number, number] = [0.04, 0.72, 1]
  const white: readonly [number, number, number] = [0.72, 1, 1]
  const gatePoints = [
    new THREE.Vector3(0, -0.48, -0.5),
    new THREE.Vector3(0, 0.18, -0.5),
    new THREE.Vector3(0, 0.46, -0.32),
    new THREE.Vector3(0, 0.57, 0),
    new THREE.Vector3(0, 0.46, 0.32),
    new THREE.Vector3(0, 0.18, 0.5),
    new THREE.Vector3(0, -0.48, 0.5),
  ]
  const segmentCount = gatePoints.length - 1
  for (let index = 0; index < segmentCount; index += 1) {
    appendPfxBeamTelegraphStroke(
      positions,
      colors,
      gatePoints[index]!,
      gatePoints[index + 1]!,
      0.05,
      0.048,
      index < 2 ? deepCyan : cyan,
      index > 3 ? cyan : white,
    )
  }
  const throatRoots = [
    new THREE.Vector3(0.02, -0.08, -0.22),
    new THREE.Vector3(0.02, -0.08, 0.22),
  ]
  for (const root of throatRoots) {
    appendPfxBeamTelegraphStroke(
      positions,
      colors,
      root,
      new THREE.Vector3(0.56, -0.02, root.z * 0.5),
      0.036,
      0.032,
      cyan,
      white,
    )
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxBeamTelegraphApertureGeometry'] = 'clean-open-muzzle-bracket-with-parallel-throat-rails'
  geometry.userData['pfxBeamTelegraphApertureDrawCalls'] = 1
  geometry.userData['pfxBeamTelegraphApertureClosedVolume'] = true
  geometry.userData['pfxBeamTelegraphApertureWorldSpaceVolume'] = true
  geometry.userData['pfxBeamTelegraphApertureSegmentCount'] = segmentCount
  geometry.userData['pfxBeamTelegraphApertureOpenGate'] = true
  geometry.userData['pfxBeamTelegraphAperturePurpose'] = 'muzzle-focus'
  geometry.userData['pfxBeamTelegraphApertureThroatRibCount'] = throatRoots.length
  geometry.userData['pfxBeamTelegraphApertureFaceCount'] = positions.length / 9
  geometry.userData['pfxBeamTelegraphApertureDepthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxBeamTelegraphApertureCrossSection'] = Math.min(
    geometry.boundingBox!.max.y - geometry.boundingBox!.min.y,
    geometry.boundingBox!.max.z - geometry.boundingBox!.min.z,
  )
  return geometry
}
