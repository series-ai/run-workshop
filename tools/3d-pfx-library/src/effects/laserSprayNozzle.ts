import * as THREE from 'three'
import { appendPfxLaserSprayTriangle } from '../constants/04'

export function createPfxLaserSprayNozzleGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const rootColor: readonly [number, number, number] = [0.2, 0.006, 0.004]
  const amber: readonly [number, number, number] = [1, 0.18, 0.015]
  const white: readonly [number, number, number] = [1, 0.78, 0.22]
  const finCount = 6
  const radialScales = [0.78, 1.12, 0.9, 1.18, 0.72, 1.02] as const
  for (let index = 0; index < finCount; index += 1) {
    const angle = index / finCount * Math.PI * 2 + (index % 2 === 0 ? -0.08 : 0.05)
    const radial = new THREE.Vector3(0, Math.cos(angle), Math.sin(angle))
    const tangent = new THREE.Vector3(0, -Math.sin(angle), Math.cos(angle))
    const radius = 0.44 * radialScales[index]!
    const root = new THREE.Vector3(-0.18 + index * 0.006, 0, 0).addScaledVector(radial, radius * 0.36)
    const shoulder = new THREE.Vector3(-0.02 + (index % 3) * 0.012, 0, 0).addScaledVector(radial, radius * 0.86)
    const halfWidth = 0.055 + index * 0.006
    const sideA = shoulder.clone().addScaledVector(tangent, halfWidth)
    const sideB = shoulder.clone().addScaledVector(tangent, -halfWidth * (0.72 + index * 0.04))
    const tip = new THREE.Vector3(0.18 + index * 0.008, 0, 0).addScaledVector(radial, radius * 1.04)
    const petalColor = index % 2 === 0 ? amber : white
    appendPfxLaserSprayTriangle(positions, colors, root, sideA, sideB, rootColor, petalColor, petalColor)
    appendPfxLaserSprayTriangle(positions, colors, root, tip, sideA, rootColor, white, petalColor)
    appendPfxLaserSprayTriangle(positions, colors, root, sideB, tip, rootColor, petalColor, white)
    appendPfxLaserSprayTriangle(positions, colors, sideA, tip, sideB, petalColor, white, petalColor)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxLaserSprayNozzleGeometry'] = 'six-varied-compact-radial-aperture-petals'
  geometry.userData['pfxLaserSprayNozzleDrawCalls'] = 1
  geometry.userData['pfxLaserSprayNozzleClosedVolume'] = true
  geometry.userData['pfxLaserSprayNozzleOpenBore'] = true
  geometry.userData['pfxLaserSprayNozzleFinCount'] = finCount
  geometry.userData['pfxLaserSprayNozzleFinVariantCount'] = finCount
  geometry.userData['pfxLaserSprayNozzleConnectorCount'] = 0
  geometry.userData['pfxLaserSprayNozzleConnectedCage'] = false
  geometry.userData['pfxLaserSprayNozzlePetalGeometry'] = true
  geometry.userData['pfxLaserSprayNozzleRepeatedRailPrimitives'] = false
  geometry.userData['pfxLaserSprayNozzleUnifiedWarmPalette'] = true
  geometry.userData['pfxLaserSprayNozzleCoolCrystalFins'] = false
  geometry.userData['pfxLaserSprayNozzleRadialAperture'] = true
  geometry.userData['pfxLaserSprayNozzleLongitudinalFins'] = false
  geometry.userData['pfxLaserSprayNozzlePurpose'] = 'salvo-origin'
  geometry.userData['pfxLaserSprayNozzleFaceCount'] = positions.length / 9
  geometry.userData['pfxLaserSprayNozzleDepthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxLaserSprayNozzleCrossSection'] = Math.min(
    geometry.boundingBox!.max.y - geometry.boundingBox!.min.y,
    geometry.boundingBox!.max.z - geometry.boundingBox!.min.z,
  )
  return geometry
}
