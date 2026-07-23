import * as THREE from 'three'
import { roundMetric } from '../constants/03'
import { PFX_BLAST_BURST_FRAGMENT, PFX_BLAST_BURST_VERTEX } from '../constants/06'
import type { PfxBlastBurstRuntimeState } from '../types/02'

export function createPfxBlastBurstLifecycle(cycle: number): {
  progress: number; opacity: number; compression: number; breach: number; flash: number; scatter: number; vacuum: number
  stage: 'compression' | 'breach' | 'vacuum-tail'
} {
  const progress = THREE.MathUtils.clamp(cycle, 0, 1)
  if (progress < 0.18) {
    const charge = progress / 0.18
    return { progress, opacity: roundMetric(0.48 + charge * 0.52), compression: roundMetric(1 - charge), breach: 0, flash: roundMetric(0.18 + charge * 0.4), scatter: 0, vacuum: 0, stage: 'compression' }
  }
  if (progress < 0.56) {
    const release = (progress - 0.18) / 0.38
    return { progress, opacity: 1, compression: 0, breach: 1, flash: roundMetric(1 - release * 0.58), scatter: roundMetric(release * 0.56), vacuum: 0, stage: 'breach' }
  }
  const tail = (progress - 0.56) / 0.44
  return { progress, opacity: Math.max(0, roundMetric(1 - Math.pow(tail, 0.68))), compression: 0, breach: 1, flash: roundMetric(0.42 - tail * 0.36), scatter: roundMetric(0.56 + tail * 0.44), vacuum: roundMetric(tail), stage: 'vacuum-tail' }
}

export function createPfxBlastBurstRuntimeState(
  elapsedSeconds: number, timing: number, lifetime: number, tempo: number, motionMultiplier: number, target?: PfxBlastBurstRuntimeState,
): PfxBlastBurstRuntimeState {
  const rate = Math.max(0.05, timing) * Math.max(0.1, tempo) * Math.max(0.1, motionMultiplier)
  const periodSeconds = 1.24 * Math.max(0.25, lifetime)
  const cycle = roundMetric(THREE.MathUtils.clamp((Math.max(0, elapsedSeconds) * rate) / periodSeconds, 0, 1))
  const lifecycle = createPfxBlastBurstLifecycle(cycle)
  const state = target ?? { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, compression: 0, breach: 0, flash: 0, scatter: 0, vacuum: 0, stage: 'compression' }
  Object.assign(state, lifecycle, { cycle, periodSeconds })
  return state
}

export function createPfxBlastBurstMaterial(opacity: number, colorA: THREE.ColorRepresentation = '#ff7a18', colorB: THREE.ColorRepresentation = '#ffd166', density = 0.72, styleEdgeHardness = 0.22): THREE.ShaderMaterial {
  const primary = new THREE.Color(colorA); const secondary = new THREE.Color(colorB).lerp(new THREE.Color('#fff4c4'), 0.32)
  const material = new THREE.ShaderMaterial({ uniforms: {
    uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) }, uProgress: { value: 0 }, uCompression: { value: 1 }, uBreach: { value: 0 }, uFlash: { value: 0.18 }, uScatter: { value: 0 }, uVacuum: { value: 0 },
    uDensity: { value: THREE.MathUtils.clamp(density, 0.05, 1) }, uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
    uColorA: { value: new THREE.Vector3(primary.r, primary.g, primary.b) }, uColorB: { value: new THREE.Vector3(secondary.r, secondary.g, secondary.b) },
  }, transparent: false, blending: THREE.NormalBlending, depthWrite: true, depthTest: true, side: THREE.DoubleSide, toneMapped: false, vertexShader: PFX_BLAST_BURST_VERTEX, fragmentShader: PFX_BLAST_BURST_FRAGMENT })
  material.userData['pfxBlastBurstMaterial'] = true; material.userData['pfxBlastBurstDrawCalls'] = 1; material.userData['pfxBlastBurstParticleCount'] = 0; material.userData['pfxBlastBurstFragmentTextureSamples'] = 0; material.userData['pfxBlastBurstTransientAllocationsPerFrame'] = 0
  material.userData['pfxBlastBurstMeshJustification'] = 'airborne-compression-cage-with-integrated-pressure-plates-ballistic-slugs-and-wake-spears'
  return material
}

export function createPfxBlastBurstGeometry(): THREE.BufferGeometry {
  const positions: number[] = []; const parts: number[] = []; const origins: number[] = []; const directions: number[] = []; const seeds: number[] = []
  const point = new THREE.Vector3(); const quaternion = new THREE.Quaternion(); const scaleVector = new THREE.Vector3()
  const append = (source: THREE.BufferGeometry, origin: [number, number, number], scale: [number, number, number], direction: [number, number, number], part: number, seed: number) => {
    const geometry = source.index ? source.toNonIndexed() : source
    const outward = new THREE.Vector3(...direction).normalize()
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward.lengthSq() > 0 ? outward : new THREE.Vector3(0, 1, 0))
    scaleVector.set(...scale)
    const attribute = geometry.getAttribute('position')
    for (let index = 0; index < attribute.count; index += 1) {
      point.fromBufferAttribute(attribute, index).multiply(scaleVector).applyQuaternion(quaternion)
      positions.push(point.x + origin[0], point.y + origin[1], point.z + origin[2]); parts.push(part); origins.push(...origin); directions.push(...direction); seeds.push(seed)
    }
    if (geometry !== source) geometry.dispose(); source.dispose()
  }

  append(new THREE.IcosahedronGeometry(1, 0), [0, 0, 0], [0.42, 0.5, 0.42], [0, 1, 0], 0, 0.05)
  const plateDirections: Array<[number, number, number]> = [[1, 0.2, 0], [-1, -0.08, 0.12], [0.08, 1, -0.12], [-0.1, -1, 0.16], [0.16, 0.12, 1], [-0.18, -0.06, -1]]
  plateDirections.forEach((direction, index) => {
    const d = new THREE.Vector3(...direction).normalize(); const origin: [number, number, number] = [d.x * 1.02, d.y * 0.86, d.z * 0.94]
    append(new THREE.BoxGeometry(0.62, 0.14, 0.48), origin, [1, 1, 1], direction, 1, 0.12 + index * 0.1)
  })
  const slugDirections: Array<[number, number, number]> = [
    [1, .62, .28], [-1, .48, -.18], [.72, -.38, 1], [-.62, -.52, -1], [.34, 1, -.76], [-.24, -1, .7],
    [1, -.12, -.74], [-1, .18, .72], [.42, .72, 1], [-.48, .66, -1], [.86, -.82, .16], [-.8, -.7, -.26],
  ]
  slugDirections.forEach((direction, index) => {
    const d = new THREE.Vector3(...direction).normalize(); const radius = 0.46 + (index % 3) * 0.08
    append(new THREE.TetrahedronGeometry(1, 0), [d.x * radius, d.y * radius, d.z * radius], [0.13 + (index % 2) * 0.04, 0.24, 0.13], direction, 2, 0.08 + index * 0.07)
  })
  const wakeDirections: Array<[number, number, number]> = [[1, 1, .2], [-1, .8, -.3], [.2, 1, 1], [-.25, -.8, -1], [1, -.7, -.45], [-1, -.58, .5]]
  wakeDirections.forEach((direction, index) => {
    const d = new THREE.Vector3(...direction).normalize(); const origin: [number, number, number] = [d.x * 0.7, d.y * 0.7, d.z * 0.7]
    append(new THREE.ConeGeometry(0.14, 0.72, 4, 1, false), origin, [1, 1, 1], direction, 3, 0.16 + index * 0.13)
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('aBlastPart', new THREE.Float32BufferAttribute(parts, 1)); geometry.setAttribute('aBlastOrigin', new THREE.Float32BufferAttribute(origins, 3)); geometry.setAttribute('aBlastDirection', new THREE.Float32BufferAttribute(directions, 3)); geometry.setAttribute('aBlastSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  geometry.userData['pfxBlastBurstGeometry'] = true; geometry.userData['pfxBlastBurstClosedComponents'] = true; geometry.userData['pfxBlastBurstCompressionCoreCount'] = 1; geometry.userData['pfxBlastBurstPressurePlateCount'] = 6; geometry.userData['pfxBlastBurstSlugCount'] = 12; geometry.userData['pfxBlastBurstWakeSpearCount'] = 6; geometry.userData['pfxBlastBurstConnectedComponents'] = 25; geometry.userData['pfxBlastBurstTriangles'] = positions.length / 9; geometry.userData['pfxBlastBurstDrawCalls'] = 1
  return geometry
}
