import * as THREE from 'three'
import { PFX_FLAME_CHARGE_CRUCIBLE_FRAGMENT, PFX_FLAME_CHARGE_CRUCIBLE_VERTEX, buildPfxMeshShaderMaterial } from '../constants/06'

export function createPfxFlameChargeCrucibleMaterial(
  opacity: number,
  color: THREE.ColorRepresentation,
): THREE.ShaderMaterial {
  const material = buildPfxMeshShaderMaterial('fire-body', {
    opacity,
    color: new THREE.Color(color).getStyle(),
    blending: 'additive',
    particleSizeMultiplier: 1,
    edgeHardness: 1,
  })
  material.blending = THREE.NormalBlending
  material.depthWrite = true
  material.side = THREE.FrontSide
  material.toneMapped = false
  const heated = new THREE.Color(color).lerp(new THREE.Color('#ffb21c'), 0.32)
  material.uniforms.uColor!.value.set(heated.r, heated.g, heated.b)
  const linearVector = (hex: string) => {
    const next = new THREE.Color(hex)
    return new THREE.Vector3(next.r, next.g, next.b)
  }
  material.uniforms.uColorHot!.value.copy(linearVector('#ffb52e'))
  material.uniforms.uColorCore = { value: linearVector('#ff790f') }
  material.uniforms.uColorOuter = { value: linearVector('#a91604') }
  material.uniforms.uColorMid = { value: linearVector('#f03f08') }
  material.uniforms.uColorHeart = { value: linearVector('#ff7a12') }
  material.uniforms.uCoreGain = { value: 1.36 }
  material.uniforms.uCrownMotionAmplitude = { value: 0.055 }
  material.vertexShader = PFX_FLAME_CHARGE_CRUCIBLE_VERTEX
  material.fragmentShader = PFX_FLAME_CHARGE_CRUCIBLE_FRAGMENT
  material.userData['pfxMaterial'] = 'flame-charge-additive-crucible'
  material.userData['pfxFlameChargeVolumeAxis'] = 'y'
  material.userData['pfxFlameChargePalette'] = 'warm-red-orange-no-green-cast'
  material.userData['pfxFlameChargeEdgeErosion'] = false
  material.userData['pfxFlameChargeClosedVolume'] = true
  material.userData['pfxFlameChargeTurbulentBands'] = true
  return material
}

export function createPfxFlameChargeCrucibleGeometry(): THREE.BufferGeometry {
  const smoothRadialSegments = 48
  const smoothHeightSegments = 32
  const coreRadius = 0.42
  const geometry = new THREE.SphereGeometry(coreRadius, smoothRadialSegments, smoothHeightSegments)
  const position = geometry.getAttribute('position')
  const point = new THREE.Vector3()
  const direction = new THREE.Vector3()
  const crestOffset = 0.3
  const crestDepthOffset = -0.3
  const crestLift = 0.55
  const secondaryLobeDirection = new THREE.Vector3(-0.64, 0.18, 0.75).normalize()
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index)
    direction.copy(point).normalize()
    const upper = THREE.MathUtils.smoothstep(direction.y, -0.12, 0.98)
    const crest = Math.pow(upper, 1.72)
    const lower = THREE.MathUtils.smoothstep(-direction.y, 0.35, 1)
    const secondaryLobe = Math.pow(
      THREE.MathUtils.smoothstep(direction.dot(secondaryLobeDirection), 0.3, 0.94),
      1.5,
    )
    const organicRadius = 1
      + Math.sin(direction.x * 8.7 + direction.y * 5.1 + direction.z * 3.9) * 0.045
      + Math.sin(direction.z * 11.3 - direction.y * 7.4) * 0.022
      + secondaryLobe * 0.16
    point.multiplyScalar(organicRadius)
    point.x *= 0.78 * (1 - crest * 0.5) * (1 - lower * 0.06)
    point.z *= 1.85 * (1 - crest * 0.78) * (1 - lower * 0.04)
    point.y *= 0.98
    // One dominant crest bends through X and Z, while the continuous
    // secondary shoulder broadens the opposite depth quadrant below it.
    point.x += crest * crestOffset - secondaryLobe * 0.055
    point.z += crest * crestDepthOffset + secondaryLobe * 0.075
    point.y += crest * crestLift + secondaryLobe * 0.07
    position.setXYZ(index, point.x, point.y, point.z)
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxFlameChargeCrucible'] = 'single-draw-continuous-bent-flame-volume'
  geometry.userData['pfxFlameChargeDrawCalls'] = 1
  geometry.userData['pfxFlameChargeContinuousSurface'] = true
  geometry.userData['pfxFlameChargeInterlockingVolumes'] = false
  geometry.userData['pfxFlameChargeSmoothRadialSegments'] = smoothRadialSegments
  geometry.userData['pfxFlameChargeSmoothHeightSegments'] = smoothHeightSegments
  geometry.userData['pfxFlameChargeCoreRadius'] = coreRadius
  geometry.userData['pfxFlameChargeBentCrest'] = true
  geometry.userData['pfxFlameChargeCrestOffset'] = crestOffset
  geometry.userData['pfxFlameChargeCrestDepthOffset'] = crestDepthOffset
  geometry.userData['pfxFlameChargeCrestLift'] = crestLift
  geometry.userData['pfxFlameChargeSecondaryDepthLobe'] = true
  geometry.userData['pfxFlameChargeSecondaryLobeDirectionZ'] = secondaryLobeDirection.z
  geometry.userData['pfxFlameChargeCrossSectionAspect'] =
    (geometry.boundingBox!.max.z - geometry.boundingBox!.min.z) /
    Math.max(0.001, geometry.boundingBox!.max.x - geometry.boundingBox!.min.x)
  geometry.userData['pfxFlameChargeConnectedComponents'] = 1
  geometry.userData['pfxFlameChargeLargestComponentShare'] = 1
  geometry.userData['pfxFlameChargeDominantContinuousBody'] = true
  geometry.userData['pfxFlameChargeVolumeAxis'] = 'y'
  geometry.userData['pfxFlameChargeForwardSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxFlameChargeNonCircularCrossSection'] = true
  geometry.userData['pfxFlameChargeRadialSymmetry'] = false
  geometry.userData['pfxFlameChargeHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  geometry.userData['pfxFlameChargeClosedCaps'] = true
  geometry.userData['pfxFlameChargeDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  return geometry
}
