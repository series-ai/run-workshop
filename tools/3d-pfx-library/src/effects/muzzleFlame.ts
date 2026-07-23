import * as THREE from 'three'
import { PFX_MUZZLE_FLASH_ATLAS } from '../muzzleFlashSprites'
import { getPfxMuzzleFlashAtlasTexture } from '../constants/04'

export function createPfxMuzzleFlameGeometry(radialSegments = 8): THREE.BufferGeometry {
  const segments = Math.max(6, Math.floor(radialSegments))
  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  type MuzzleAxialRing = {
    x: number
    radius: number
    offset: readonly [number, number]
    uProgress: number
    color: readonly [number, number, number]
  }
  const rings: ReadonlyArray<MuzzleAxialRing> = [
    { x: -0.1, radius: 0.2, offset: [-0.015, 0.025], uProgress: 0, color: [1, 1, 0.9] },
    { x: 0.08, radius: 0.26, offset: [0.025, 0.055], uProgress: 0.28, color: [1, 0.9, 0.55] },
    { x: 0.27, radius: 0.19, offset: [0.075, -0.04], uProgress: 0.58, color: [1, 0.7, 0.25] },
    { x: 0.44, radius: 0.11, offset: [0.1, -0.075], uProgress: 0.82, color: [1, 0.5, 0.08] },
  ]
  const tip: readonly [number, number, number] = [0.58, 0.1, -0.08]
  const tipColor: readonly [number, number, number] = [1, 0.4, 0.05]
  const innerRings: ReadonlyArray<MuzzleAxialRing> = [
    { x: -0.04, radius: 0.09, offset: [-0.01, 0.01], uProgress: 0.08, color: [1, 1, 0.96] },
    { x: 0.14, radius: 0.12, offset: [-0.025, 0.035], uProgress: 0.4, color: [1, 0.96, 0.7] },
    { x: 0.3, radius: 0.065, offset: [-0.035, 0.055], uProgress: 0.7, color: [1, 0.78, 0.3] },
  ]
  const innerTip: readonly [number, number, number] = [0.44, -0.04, 0.06]
  const innerTipColor: readonly [number, number, number] = [1, 0.62, 0.12]
  const directionalSlice = PFX_MUZZLE_FLASH_ATLAS.slices['directional-1']
  const insetU = directionalSlice.w * 0.04
  const insetV = directionalSlice.h * 0.04
  const u0 = directionalSlice.u + insetU
  const uSpan = directionalSlice.w - insetU * 2
  const vCenter = directionalSlice.v + directionalSlice.h * 0.5
  const vRadius = directionalSlice.h * 0.46
  const pushVertex = (position: readonly [number, number, number], uv: readonly [number, number], color: readonly [number, number, number]) => {
    positions.push(...position)
    uvs.push(...uv)
    colors.push(...color)
  }
  const pushTriangle = (
    a: readonly [number, number, number], aUv: readonly [number, number], aColor: readonly [number, number, number],
    b: readonly [number, number, number], bUv: readonly [number, number], bColor: readonly [number, number, number],
    c: readonly [number, number, number], cUv: readonly [number, number], cColor: readonly [number, number, number],
  ) => {
    pushVertex(a, aUv, aColor)
    pushVertex(b, bUv, bColor)
    pushVertex(c, cUv, cColor)
  }
  const appendTaperedShell = (
    shellRings: ReadonlyArray<MuzzleAxialRing>,
    shellTip: readonly [number, number, number],
    shellTipColor: readonly [number, number, number],
    uvRadiusScale: number,
  ) => {
    const ringVertices = shellRings.map((ring, ringIndex) => Array.from({ length: segments }, (_, segment) => {
      const angle = (segment / segments) * Math.PI * 2
      const irregularity = 1 + 0.07 * Math.sin(angle * 3 + ringIndex * 1.7) + 0.035 * Math.sin(angle * 5 + 0.8)
      const radius = ring.radius * irregularity
      return {
        position: [
          ring.x,
          ring.offset[0] + Math.cos(angle) * radius,
          ring.offset[1] + Math.sin(angle) * radius,
        ] as const,
        uv: [u0 + uSpan * ring.uProgress, vCenter + Math.cos(angle) * vRadius * uvRadiusScale] as const,
        color: ring.color,
      }
    }))
    for (let ringIndex = 0; ringIndex < ringVertices.length - 1; ringIndex += 1) {
      const current = ringVertices[ringIndex]!
      const next = ringVertices[ringIndex + 1]!
      for (let segment = 0; segment < segments; segment += 1) {
        const following = (segment + 1) % segments
        pushTriangle(
          current[segment]!.position, current[segment]!.uv, current[segment]!.color,
          next[following]!.position, next[following]!.uv, next[following]!.color,
          next[segment]!.position, next[segment]!.uv, next[segment]!.color,
        )
        pushTriangle(
          current[segment]!.position, current[segment]!.uv, current[segment]!.color,
          current[following]!.position, current[following]!.uv, current[following]!.color,
          next[following]!.position, next[following]!.uv, next[following]!.color,
        )
      }
    }
    const finalRing = ringVertices.at(-1)!
    const tipUv: readonly [number, number] = [u0 + uSpan, vCenter]
    for (let segment = 0; segment < segments; segment += 1) {
      const following = (segment + 1) % segments
      pushTriangle(
        finalRing[segment]!.position, finalRing[segment]!.uv, finalRing[segment]!.color,
        finalRing[following]!.position, finalRing[following]!.uv, finalRing[following]!.color,
        shellTip, tipUv, shellTipColor,
      )
    }
  }
  appendTaperedShell(rings, tip, tipColor, 1)
  appendTaperedShell(innerRings, innerTip, innerTipColor, 0.46)

  // The axial camera sees the open end of the directional shell. A softly
  // irregular ignition bloom closes it without exposing an atlas-star icon.
  // It shares this BufferGeometry/material, preserving one draw call.
  const capSlice = PFX_MUZZLE_FLASH_ATLAS.slices['radial-1']
  const capCenter: readonly [number, number, number] = [0.03, 0.012, -0.014]
  const capRadius = 0.16
  const capAspect: readonly [number, number] = [1.08, 0.86]
  const capSegments = 16
  const capUvRadius = 0.18
  const capUvCenter: readonly [number, number] = [capSlice.u + capSlice.w * 0.5, capSlice.v + capSlice.h * 0.5]
  const capColor: readonly [number, number, number] = [1, 1, 0.86]
  const capRingColor: readonly [number, number, number] = [1, 0.46, 0.04]
  const capPosition = (angle: number): readonly [number, number, number] => {
    const radialAsymmetry = 1 + 0.04 * Math.sin(angle + 0.35) + 0.025 * Math.sin(angle * 3 - 0.4)
    const depthAsymmetry = 1 + 0.03 * Math.cos(angle - 0.7)
    return [
      capCenter[0],
      capCenter[1] + Math.cos(angle) * capRadius * capAspect[0] * radialAsymmetry,
      capCenter[2] + Math.sin(angle) * capRadius * capAspect[1] * depthAsymmetry,
    ]
  }
  for (let segment = 0; segment < capSegments; segment += 1) {
    const a0 = (segment / capSegments) * Math.PI * 2
    const a1 = ((segment + 1) / capSegments) * Math.PI * 2
    const ring0 = capPosition(a0)
    const ring1 = capPosition(a1)
    const uv0: readonly [number, number] = [capUvCenter[0] + Math.cos(a0) * capSlice.w * capUvRadius, capUvCenter[1] + Math.sin(a0) * capSlice.h * capUvRadius]
    const uv1: readonly [number, number] = [capUvCenter[0] + Math.cos(a1) * capSlice.w * capUvRadius, capUvCenter[1] + Math.sin(a1) * capSlice.h * capUvRadius]
    pushTriangle(capCenter, capUvCenter, capColor, ring0, uv0, capRingColor, ring1, uv1, capRingColor)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  geometry.userData['pfxMuzzleGeometry'] = 'connected-tapered-volume-with-radial-cap'
  geometry.userData['pfxMuzzleLayers'] = ['nested-hot-core', 'connected-flame-body', 'radial-front-cap']
  geometry.userData['pfxMuzzleLobeCount'] = 2
  geometry.userData['pfxMuzzleAxialRingCount'] = rings.length
  geometry.userData['pfxMuzzleInnerAxialRingCount'] = innerRings.length
  geometry.userData['pfxMuzzleAtlasSlices'] = ['directional-1', 'radial-1']
  geometry.userData['pfxMuzzleBodyProfile'] = 'short-layered-percussive-shell'
  geometry.userData['pfxMuzzleBodyTip'] = [...tip]
  geometry.userData['pfxMuzzleBodyMaxRadius'] = Math.max(...rings.map((ring) => ring.radius))
  geometry.userData['pfxMuzzleInnerTip'] = [...innerTip]
  geometry.userData['pfxMuzzleRadialCapUvRadius'] = capUvRadius
  geometry.userData['pfxMuzzleRadialCapRadius'] = capRadius
  geometry.userData['pfxMuzzleRadialCapProfile'] = 'offset-soft-ignition-bloom'
  geometry.userData['pfxMuzzleRadialCapCenter'] = [...capCenter]
  geometry.userData['pfxMuzzleRadialCapAspect'] = [...capAspect]
  geometry.userData['pfxMuzzleRadialCapSegments'] = capSegments
  return geometry
}

export function createPfxMuzzleFlameMaterial(opacity: number): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    map: getPfxMuzzleFlashAtlasTexture(),
    vertexColors: true,
    transparent: true,
    opacity: opacity * 0.92,
    blending: THREE.NormalBlending,
    depthWrite: false,
    alphaTest: 0.01,
    side: THREE.FrontSide,
  })
  const axisWorld = new THREE.Vector3(1, 0, 0)
  const axisView = new THREE.Vector3(1, 0, 0)
  const worldQuaternion = new THREE.Quaternion()
  material.userData['pfxMuzzleAxialFade'] = 'directional-atlas-only@0.82-0.96'
  material.userData['pfxMuzzleHeatRamp'] = 'tight-yellow-core-to-saturated-orange-edge'
  material.customProgramCacheKey = () => 'pfx-muzzle-axial-fade-heat-ramp-v3'
  material.onBeforeCompile = (shader) => {
    shader.uniforms['uPfxAxisView'] = { value: axisView }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vPfxViewPosition;',
      )
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvPfxViewPosition = mvPosition.xyz;',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 uPfxAxisView;\nvarying vec3 vPfxViewPosition;',
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
float pfxAtlasEnergy = max(diffuseColor.g, diffuseColor.b);
float pfxHeatCore = smoothstep(0.82, 0.99, pfxAtlasEnergy);
vec3 pfxHeatRamp = mix(vec3(1.0, 0.06, 0.0), vec3(1.0, 0.55, 0.05), pfxHeatCore);
diffuseColor.rgb = pfxHeatRamp * mix(0.62, 1.08, pfxAtlasEnergy);
float pfxRadialCapWeight = 1.0 - step(0.5, vMapUv.y);
vec2 pfxRadialCapUv = (vMapUv - vec2(0.125, 0.25)) / vec2(0.25, 0.5);
float pfxRadialAngle = atan(pfxRadialCapUv.y, pfxRadialCapUv.x);
float pfxRadialRadius = length(pfxRadialCapUv);
float pfxRadialEdge = 0.145 + 0.018 * sin(pfxRadialAngle * 3.0 + 0.6) + 0.012 * sin(pfxRadialAngle * 5.0 - 0.4);
float pfxRadialCapAlpha = 1.0 - smoothstep(pfxRadialEdge - 0.045, pfxRadialEdge, pfxRadialRadius);
diffuseColor.a *= mix(1.0, pfxRadialCapAlpha, pfxRadialCapWeight);
float pfxDirectionalAtlasWeight = step(0.5, vMapUv.y);
float pfxAxialAlignment = abs(dot(normalize(-vPfxViewPosition), normalize(uPfxAxisView)));
float pfxDirectionalVisibility = 1.0 - smoothstep(0.82, 0.96, pfxAxialAlignment);
diffuseColor.a *= mix(1.0, pfxDirectionalVisibility, pfxDirectionalAtlasWeight);`,
      )
    material.userData['pfxMuzzleShader'] = shader
  }
  material.onBeforeRender = (_renderer, _scene, camera, _geometry, object) => {
    object.getWorldQuaternion(worldQuaternion)
    axisWorld.set(1, 0, 0).applyQuaternion(worldQuaternion)
    axisView.copy(axisWorld).transformDirection(camera.matrixWorldInverse)
    const shader = material.userData['pfxMuzzleShader'] as { uniforms?: Record<string, { value: unknown }> } | undefined
    const uniform = shader?.uniforms?.['uPfxAxisView']
    if (uniform) uniform.value = axisView
  }
  return material
}
