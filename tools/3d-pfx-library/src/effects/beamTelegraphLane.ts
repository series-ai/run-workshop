import * as THREE from 'three'
import { appendPfxBeamTelegraphStroke, appendPfxBeamTelegraphTaperedField } from '../constants/04'

export function createPfxBeamTelegraphLaneGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const deep: readonly [number, number, number] = [0.3, 0.008, 0.012]
  const red: readonly [number, number, number] = [0.92, 0.035, 0.012]
  const amber: readonly [number, number, number] = [1, 0.34, 0.018]
  const white: readonly [number, number, number] = [1, 0.82, 0.28]
  const sourceWidth = 1.1
  const targetWidth = 1.1
  appendPfxBeamTelegraphTaperedField(positions, colors, -1.68, 1.72, sourceWidth / 2, targetWidth / 2, 0.025, 0.045, deep, red)
  appendPfxBeamTelegraphStroke(positions, colors, new THREE.Vector3(-1.68, 0.105, -0.55), new THREE.Vector3(1.72, 0.105, -0.55), 0.04, 0.052, red, amber)
  appendPfxBeamTelegraphStroke(positions, colors, new THREE.Vector3(-1.68, 0.105, 0.55), new THREE.Vector3(1.72, 0.105, 0.55), 0.04, 0.052, red, amber)
  const chevronCenters = [-1.1, -0.35, 0.48, 1.18]
  const chevronSpans = [0.15, 0.21, 0.29, 0.37]
  const chevronRoots = [deep, red, amber, white] as const
  const chevronTips = [red, amber, white, white] as const
  for (const [index, centerX] of chevronCenters.entries()) {
    const halfSpan = chevronSpans[index]!
    const root = new THREE.Vector3(centerX + 0.15 + index * 0.025, 0.15, 0)
    const rearTop = new THREE.Vector3(centerX - 0.12 - index * 0.018, 0.15, halfSpan)
    const rearBottom = new THREE.Vector3(centerX - 0.12 - index * 0.018, 0.15, -halfSpan)
    appendPfxBeamTelegraphStroke(positions, colors, rearTop, root, 0.034 + index * 0.008, 0.032, chevronRoots[index]!, chevronTips[index]!)
    appendPfxBeamTelegraphStroke(positions, colors, root, rearBottom, 0.034 + index * 0.008, 0.032, chevronTips[index]!, chevronRoots[index]!)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxBeamTelegraphGeometry'] = 'single-draw-constant-width-projected-beam-lane-with-graded-countdown-chevrons'
  geometry.userData['pfxBeamTelegraphDrawCalls'] = 1
  geometry.userData['pfxBeamTelegraphClosedVolume'] = true
  geometry.userData['pfxBeamTelegraphRailCount'] = 2
  geometry.userData['pfxBeamTelegraphChevronCount'] = chevronCenters.length
  geometry.userData['pfxBeamTelegraphIntegratedCountdownAccentCount'] = chevronCenters.length
  geometry.userData['pfxBeamTelegraphParticleCount'] = 0
  geometry.userData['pfxBeamTelegraphConstantWidthLane'] = true
  geometry.userData['pfxBeamTelegraphChevronIntensityGradient'] = true
  geometry.userData['pfxBeamTelegraphSourceWidth'] = sourceWidth
  geometry.userData['pfxBeamTelegraphTargetWidth'] = targetWidth
  geometry.userData['pfxBeamTelegraphThreatPalette'] = 'red-amber-white'
  geometry.userData['pfxBeamTelegraphDirectionalAxis'] = 'positive-x'
  geometry.userData['pfxBeamTelegraphLengthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxBeamTelegraphWidthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxBeamTelegraphHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}
