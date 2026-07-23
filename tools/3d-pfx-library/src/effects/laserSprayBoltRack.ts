import * as THREE from 'three'
import { appendPfxLaserSprayTaperedBolt } from '../constants/04'

export function createPfxLaserSprayBoltRackGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const sequences: number[] = []
  const shells: number[] = []
  const bolts = [
    { origin: [-1.42, -0.12, -0.16], tip: [1.82, 0.56, -0.66], width: 0.078 },
    { origin: [-1.4, -0.05, 0.06], tip: [1.56, 0.3, 0.52], width: 0.066 },
    { origin: [-1.38, 0.02, -0.02], tip: [1.9, 0.06, 0.12], width: 0.072 },
    { origin: [-1.41, 0.09, 0.14], tip: [1.68, -0.18, -0.48], width: 0.061 },
    { origin: [-1.39, 0.16, -0.12], tip: [1.72, -0.4, 0.3], width: 0.064 },
  ] as const
  const rootColor: readonly [number, number, number] = [0.5, 0.008, 0.015]
  const hotColor: readonly [number, number, number] = [1, 0.72, 0.18]
  for (const [index, bolt] of bolts.entries()) {
    const origin = new THREE.Vector3(...bolt.origin)
    const tip = new THREE.Vector3(...bolt.tip)
    const sequence = index / bolts.length
    appendPfxLaserSprayTaperedBolt(
      positions, colors, sequences, shells, origin, tip, bolt.width * 2.35, bolt.width * (0.92 + index * 0.04),
      rootColor, hotColor, sequence, 1,
    )
    appendPfxLaserSprayTaperedBolt(
      positions, colors, sequences, shells, origin, tip, bolt.width, bolt.width * (0.42 + index * 0.025),
      rootColor, hotColor, sequence, 0,
    )
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('spraySequence', new THREE.Float32BufferAttribute(sequences, 1))
  geometry.setAttribute('sprayShell', new THREE.Float32BufferAttribute(shells, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxLaserSprayBoltRackGeometry'] = 'five-sequenced-seamless-eight-sided-tapered-core-halo-lanes'
  geometry.userData['pfxLaserSprayBoltRackDrawCalls'] = 1
  geometry.userData['pfxLaserSprayBoltRackClosedVolume'] = true
  geometry.userData['pfxLaserSprayBoltRackWorldSpaceVolume'] = true
  geometry.userData['pfxLaserSprayBoltCount'] = bolts.length
  geometry.userData['pfxLaserSpraySegmentCount'] = bolts.length
  geometry.userData['pfxLaserSprayCrossSectionSides'] = 8
  geometry.userData['pfxLaserSpraySeamlessBoltBodies'] = true
  geometry.userData['pfxLaserSprayFrontLaneCount'] = bolts.length
  geometry.userData['pfxLaserSprayEndpointCount'] = bolts.length
  geometry.userData['pfxLaserSprayEndpointAccentVariantCount'] = 0
  geometry.userData['pfxLaserSprayRepeatedCrossMarkers'] = false
  geometry.userData['pfxLaserSprayTaperedPointTips'] = false
  geometry.userData['pfxLaserSprayDiffuseTermini'] = true
  geometry.userData['pfxLaserSprayCoreShellCount'] = bolts.length
  geometry.userData['pfxLaserSprayHaloShellCount'] = bolts.length
  geometry.userData['pfxLaserSprayMergedCoreHalo'] = true
  geometry.userData['pfxLaserSprayIntegratedEndpointEnergyCount'] = bolts.length
  geometry.userData['pfxLaserSprayParticleCount'] = 0
  geometry.userData['pfxLaserSprayAsymmetricDepthFan'] = true
  geometry.userData['pfxLaserSprayFlatPaddleMarkers'] = false
  geometry.userData['pfxLaserSpraySequenceAttribute'] = true
  geometry.userData['pfxLaserSprayDirectionalAxis'] = 'positive-x'
  geometry.userData['pfxLaserSprayFaceCount'] = positions.length / 9
  geometry.userData['pfxLaserSprayLengthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxLaserSprayDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxLaserSprayHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}
