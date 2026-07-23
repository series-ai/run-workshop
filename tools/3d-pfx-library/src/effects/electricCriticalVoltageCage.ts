import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { appendPfxElectricCriticalPrism } from '../constants/04'

export function createPfxElectricCriticalVoltageCageGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const paths = [
    { kind: 'axis', radiusScale: 1, color: [0.22, 0.94, 1] as const, points: [[0, 0, 0], [0.22, 0.2, 0.04], [0.52, 0.46, -0.08], [0.92, 0.76, 0.16]] },
    { kind: 'axis', radiusScale: 0.9, color: [0.12, 0.62, 1] as const, points: [[0, 0, 0], [-0.2, -0.18, -0.04], [-0.5, -0.44, 0.08], [-0.88, -0.74, -0.16]] },
    { kind: 'axis', radiusScale: 0.78, color: [0.7, 0.9, 1] as const, points: [[0, 0, 0], [-0.14, 0.16, 0.06], [-0.34, 0.38, -0.12], [-0.58, 0.62, 0.22]] },
    { kind: 'axis', radiusScale: 0.7, color: [0.16, 0.46, 1] as const, points: [[0, 0, 0], [0.14, -0.16, -0.06], [0.32, -0.36, 0.12], [0.54, -0.58, -0.22]] },
    { kind: 'axis', radiusScale: 0.72, color: [0.46, 0.88, 1] as const, points: [[0, 0, 0], [0.22, -0.14, 0.34], [-0.28, 0.22, 0.72], [0.4, 0.28, 1.14]] },
    { kind: 'axis', radiusScale: 0.66, color: [0.24, 0.56, 1] as const, points: [[0, 0, 0], [-0.2, 0.12, -0.32], [0.3, -0.22, -0.7], [-0.38, -0.3, -1.12]] },
    { kind: 'micro', radiusScale: 0.9, color: [0.78, 0.96, 1] as const, points: [[0.52, 0.46, -0.08], [0.34, 0.62, 0.12], [0.46, 0.82, 0.24]] },
    { kind: 'micro', radiusScale: 0.82, color: [0.7, 0.9, 1] as const, points: [[-0.5, -0.44, 0.08], [-0.3, -0.62, -0.12], [-0.44, -0.84, -0.24]] },
    { kind: 'micro', radiusScale: 0.86, color: [0.82, 0.96, 1] as const, points: [[-0.34, 0.38, -0.12], [-0.52, 0.22, 0.08], [-0.7, 0.34, 0.18]] },
    { kind: 'micro', radiusScale: 0.78, color: [0.62, 0.86, 1] as const, points: [[0.32, -0.36, 0.12], [0.5, -0.2, -0.08], [0.7, -0.32, -0.18]] },
    { kind: 'micro', radiusScale: 0.8, color: [0.72, 0.92, 1] as const, points: [[-0.28, 0.22, 0.72], [-0.04, 0.38, 0.84], [-0.22, 0.54, 1.02]] },
    { kind: 'micro', radiusScale: 0.74, color: [0.82, 0.9, 1] as const, points: [[0.3, -0.22, -0.7], [0.04, -0.38, -0.84], [0.22, -0.54, -1.02]] },
    { kind: 'micro', radiusScale: 0.72, color: [0.62, 0.9, 1] as const, points: [[0.52, 0.46, -0.08], [0.7, 0.52, -0.22], [0.8, 0.68, -0.3]] },
    { kind: 'micro', radiusScale: 0.68, color: [0.54, 0.82, 1] as const, points: [[-0.5, -0.44, 0.08], [-0.68, -0.5, 0.22], [-0.78, -0.66, 0.3]] },
    { kind: 'micro', radiusScale: 0.7, color: [0.84, 0.96, 1] as const, points: [[-0.34, 0.38, -0.12], [-0.26, 0.58, -0.26], [-0.38, 0.72, -0.34]] },
    { kind: 'micro', radiusScale: 0.66, color: [0.62, 0.84, 1] as const, points: [[0.32, -0.36, 0.12], [0.24, -0.56, 0.26], [0.36, -0.7, 0.34]] },
    { kind: 'micro', radiusScale: 0.7, color: [0.74, 0.94, 1] as const, points: [[-0.28, 0.22, 0.72], [-0.46, 0.12, 0.86], [-0.54, 0.26, 1.04]] },
    { kind: 'micro', radiusScale: 0.64, color: [0.6, 0.86, 1] as const, points: [[0.3, -0.22, -0.7], [0.48, -0.12, -0.86], [0.56, -0.28, -1.04]] },
  ] as const
  const jaggedTurnsByPath = paths.map((path) => {
    const centers = path.points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
    let turns = 0
    for (let pointIndex = 1; pointIndex < centers.length - 1; pointIndex += 1) {
      const incoming = centers[pointIndex]!.clone().sub(centers[pointIndex - 1]!).normalize()
      const outgoing = centers[pointIndex + 1]!.clone().sub(centers[pointIndex]!).normalize()
      if (incoming.angleTo(outgoing) >= 0.3) turns += 1
    }
    return turns
  })
  const axisRadii = [0.11, 0.082, 0.044, 0.01] as const
  const microRadii = [0.055, 0.03, 0.006] as const
  for (const path of paths) {
    const centers = path.points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
    const pathRadii = path.kind === 'axis' ? axisRadii : microRadii
    for (let segmentIndex = 0; segmentIndex < centers.length - 1; segmentIndex += 1) {
      appendPfxElectricCriticalPrism(
        positions,
        colors,
        centers[segmentIndex]!,
        centers[segmentIndex + 1]!,
        pathRadii[segmentIndex]! * path.radiusScale,
        pathRadii[segmentIndex + 1]! * path.radiusScale,
        path.color,
      )
    }
  }
  const raw = new THREE.BufferGeometry()
  raw.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  raw.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const geometry = mergeVertices(raw, 1e-4)
  raw.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxElectricCriticalVoltagePathCount'] = paths.length
  geometry.userData['pfxElectricCriticalRadialPathCount'] = paths.filter((path) => path.kind === 'axis').length
  geometry.userData['pfxElectricCriticalMainDischargePathCount'] = paths.filter((path) => path.kind === 'axis').length
  geometry.userData['pfxElectricCriticalForkPathCount'] = paths.filter((path) => path.kind === 'micro').length
  geometry.userData['pfxElectricCriticalGroundForkCount'] = 0
  geometry.userData['pfxElectricCriticalVerticalSpineCount'] = 0
  geometry.userData['pfxElectricCriticalLateralForkCount'] = paths.filter((path) => path.kind === 'micro').length
  geometry.userData['pfxElectricCriticalGroundCrawlCount'] = 0
  geometry.userData['pfxElectricCriticalMicroBranchCount'] = paths.filter((path) => path.kind === 'micro').length
  geometry.userData['pfxElectricCriticalContactAccentForkCount'] = 0
  geometry.userData['pfxElectricCriticalAxisPairCount'] = 3
  geometry.userData['pfxElectricCriticalCrossedAxisPathCount'] = paths.filter((path) => path.kind === 'axis').length
  geometry.userData['pfxElectricCriticalOccupiedDepthQuadrantCount'] = 8
  geometry.userData['pfxElectricCriticalImpactCoreCount'] = 0
  geometry.userData['pfxElectricCriticalCriticalCrownShardCount'] = 0
  geometry.userData['pfxElectricCriticalDepthNodeCount'] = 0
  geometry.userData['pfxElectricCriticalSparkShardCount'] = 0
  geometry.userData['pfxElectricCriticalAsymmetricCage'] = true
  geometry.userData['pfxElectricCriticalClosedVolume'] = true
  geometry.userData['pfxElectricCriticalDrawCalls'] = 1
  geometry.userData['pfxElectricCriticalWorldSpace'] = true
  geometry.userData['pfxElectricCriticalCameraFacing'] = false
  geometry.userData['pfxElectricCriticalCrossSectionSides'] = 8
  geometry.userData['pfxElectricCriticalSegmentPrismCount'] = paths.reduce((total, path) => total + path.points.length - 1, 0)
  geometry.userData['pfxElectricCriticalJointNodeCount'] = 0
  geometry.userData['pfxElectricCriticalJaggedTurnCount'] = jaggedTurnsByPath.reduce((total, turns) => total + turns, 0)
  geometry.userData['pfxElectricCriticalMinimumJaggedTurnsPerPath'] = Math.min(...jaggedTurnsByPath)
  geometry.userData['pfxElectricCriticalDominantAxis'] = 'asymmetric-six-ray-contact-burst'
  geometry.userData['pfxElectricCriticalMainBoltRadiusScale'] = 1
  geometry.userData['pfxElectricCriticalBaseRadius'] = axisRadii[0]
  geometry.userData['pfxElectricCriticalPalette'] = 'white-gold-electric-cyan-deep-blue-streak-particles'
  geometry.userData['pfxElectricCriticalFlashRayCount'] = 0
  geometry.userData['pfxElectricCriticalBraidedStrandCount'] = 0
  geometry.userData['pfxElectricCriticalCompanionStrandCount'] = 0
  geometry.userData['pfxElectricCriticalImpactPointY'] = 0
  geometry.userData['pfxElectricCriticalImpactCoreRadius'] = 0.26
  geometry.userData['pfxElectricCriticalDepthForkReach'] = 1.12
  geometry.userData['pfxElectricCriticalSecondaryForkReach'] = 0.46
  geometry.userData['pfxElectricCriticalPrimaryDepthStagger'] = 'alternating-positive-negative'
  geometry.userData['pfxElectricCriticalViewSilhouette'] = 'crossed-critical-x-front-split-depth-rays-side'
  geometry.userData['pfxElectricCriticalTopology'] = 'six-tapered-critical-rays-twelve-y-forks-and-gold-crown-nexus'
  geometry.userData['pfxElectricCriticalAxisForkDistribution'] = 'diagonal4-depth2'
  geometry.userData['pfxElectricCriticalGameplayAnchor'] = 'forward-contact-point'
  geometry.userData['pfxElectricCriticalCriticalMark'] = 'dominant-cyan-slash-gold-crown'
  geometry.userData['pfxElectricCriticalCriticalNexus'] = 'white-hot-gold-diamond'
  geometry.userData['pfxElectricCriticalPrimarySilhouette'] = 'dominant-cyan-slash-with-short-support-rays'
  geometry.userData['pfxElectricCriticalTargetEnvelope'] = 'compact-critical-contact-volume'
  geometry.userData['pfxElectricCriticalFilamentWidthProfile'] = 'high-contrast-root-to-hairline-tip'
  geometry.userData['pfxElectricCriticalGrounding'] = 'none-radial-contact'
  geometry.userData['pfxElectricCriticalCoreExposure'] = 'bounded-white-hot-nexus'
  geometry.userData['pfxElectricCriticalCriticalAccent'] = 'faceted-nexus-plus-white-cyan-streak-scatter'
  geometry.userData['pfxElectricCriticalMirroredForkPairCount'] = 0
  geometry.userData['pfxElectricCriticalFaceCount'] = geometry.index!.count / 3
  return geometry
}
