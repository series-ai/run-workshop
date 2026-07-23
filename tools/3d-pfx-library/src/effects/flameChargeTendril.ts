import * as THREE from 'three'
import { PFX_FLAME_CHARGE_TENDRIL_FRAGMENT, PFX_FLAME_CHARGE_TENDRIL_VERTEX } from '../constants/05'

export function createPfxFlameChargeTendrilMaterial(
  opacity: number,
  color: THREE.ColorRepresentation,
): THREE.ShaderMaterial {
  const base = new THREE.Color(color)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCycle: { value: 0 },
      uArcErosion: { value: 0 },
      uBreak: { value: 0 },
      uWakeEnvelope: { value: 1 },
      uElectricReach: { value: 1 },
      uElectricDecay: { value: 0 },
      uOpacity: { value: opacity },
      uCoreBoost: { value: 1.32 },
      uColor: { value: new THREE.Vector3(base.r, base.g, base.b) },
      uColorHot: { value: new THREE.Vector3(1, 0.66, 0.16) },
      uColorCore: { value: new THREE.Vector3(1, 0.34, 0.025) },
    },
    vertexShader: PFX_FLAME_CHARGE_TENDRIL_VERTEX,
    fragmentShader: PFX_FLAME_CHARGE_TENDRIL_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
  material.userData['pfxMaterial'] = 'flame-charge-inward-tendrils'
  material.userData['pfxFlameChargeFlowDirection'] = 'outer-to-core'
  return material
}

export function createPfxFlameChargeTendrilGeometry(): THREE.BufferGeometry {
  const tendrilCount = 4
  const tubularSegments = 48
  const ribbonPlaneCount = tendrilCount * 2
  const outerRadii = [0.82, 0.68, 0.76, 0.72]
  const outerRadius = Math.max(...outerRadii)
  const terminalRadius = 0.13
  const laneSweeps = [Math.PI * 0.28, -Math.PI * 0.34, Math.PI * 0.22, -Math.PI * 0.3]
  const arcSweep = Math.max(...laneSweeps.map(Math.abs))
  const laneHalfWidths = [0.086, 0.074, 0.08, 0.068]
  const maximumHalfWidth = Math.max(...laneHalfWidths)
  const outerEndpointScale = 0
  const innerEndpointScale = 0.34
  const lanePhases = [-2.65, -0.9, 0.55, 2.18]
  const outerHeights = [-0.34, 0.29, 0.06, 0.45]
  const terminalHeights = [-0.06, 0.04, 0.02, 0.08]
  const laneLifts = [0.11, -0.09, 0.13, -0.12]
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const flowProgress: number[] = []
  const laneIndices: number[] = []
  const indices: number[] = []
  const center = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const axis = new THREE.Vector3()
  const faceNormal = new THREE.Vector3()
  const vertex = new THREE.Vector3()

  for (let lane = 0; lane < tendrilCount; lane += 1) {
    const phase = lanePhases[lane]!
    const points = Array.from({ length: 8 }, (_, pointIndex) => {
      const progress = pointIndex / 7
      const eased = progress * progress * (3 - 2 * progress)
      const radius = THREE.MathUtils.lerp(outerRadii[lane]!, terminalRadius, eased)
      const angle = phase + progress * laneSweeps[lane]!
      const lift = Math.sin(progress * Math.PI) * laneLifts[lane]!
      return new THREE.Vector3(
        Math.cos(angle) * radius,
        THREE.MathUtils.lerp(outerHeights[lane]!, terminalHeights[lane]!, eased) + lift,
        Math.sin(angle) * radius * 0.84,
      )
    })
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5)
    const frames = curve.computeFrenetFrames(tubularSegments, false)
    for (let plane = 0; plane < 2; plane += 1) {
      const baseVertex = positions.length / 3
      for (let segment = 0; segment <= tubularSegments; segment += 1) {
        const progress = segment / tubularSegments
        curve.getPointAt(progress, center)
        curve.getTangentAt(progress, tangent).normalize()
        axis.copy(plane === 0 ? frames.normals[segment]! : frames.binormals[segment]!).normalize()
        faceNormal.crossVectors(tangent, axis).normalize()
        const outerGrowth = THREE.MathUtils.smoothstep(progress, 0, 0.16)
        const coreAttachment = THREE.MathUtils.lerp(
          1,
          innerEndpointScale,
          THREE.MathUtils.smoothstep(progress, 0.72, 1),
        )
        const taper = outerGrowth * coreAttachment
        const width = taper * laneHalfWidths[lane]!
          * (0.9 + Math.sin(progress * 16 + lane * 2.1 + plane * 1.4) * 0.1)
        for (let side = 0; side < 2; side += 1) {
          const signedWidth = side === 0 ? -width : width
          vertex.copy(center).addScaledVector(axis, signedWidth)
          positions.push(vertex.x, vertex.y, vertex.z)
          normals.push(faceNormal.x, faceNormal.y, faceNormal.z)
          uvs.push(progress, side)
          flowProgress.push(progress)
          laneIndices.push(lane)
        }
      }
      for (let segment = 0; segment < tubularSegments; segment += 1) {
        const start = baseVertex + segment * 2
        const next = start + 2
        indices.push(start, start + 1, next, start + 1, next + 1, next)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('aFlowProgress', new THREE.Float32BufferAttribute(flowProgress, 1))
  geometry.setAttribute('aTendrilLane', new THREE.Float32BufferAttribute(laneIndices, 1))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxFlameChargeTendrils'] = 'four-narrow-crossed-inward-fire-ribbons'
  geometry.userData['pfxFlameChargeTendrilCount'] = tendrilCount
  geometry.userData['pfxFlameChargeRibbonPlaneCount'] = ribbonPlaneCount
  geometry.userData['pfxFlameChargeTendrilAsymmetricLanes'] = true
  geometry.userData['pfxFlameChargeVolumetricCrossedRibbons'] = true
  geometry.userData['pfxFlameChargeTendrilDrawCalls'] = 1
  geometry.userData['pfxFlameChargeTendrilTapered'] = true
  geometry.userData['pfxFlameChargeTendrilOuterEndpointScale'] = outerEndpointScale
  geometry.userData['pfxFlameChargeTendrilInnerEndpointScale'] = innerEndpointScale
  geometry.userData['pfxFlameChargeTendrilOuterRadius'] = outerRadius
  geometry.userData['pfxFlameChargeTendrilTerminalRadius'] = terminalRadius
  geometry.userData['pfxFlameChargeTendrilMaximumHalfWidth'] = maximumHalfWidth
  geometry.userData['pfxFlameChargeTendrilArcSweep'] = arcSweep
  geometry.userData['pfxFlameChargeTendrilDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxFlameChargeTendrilHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}
