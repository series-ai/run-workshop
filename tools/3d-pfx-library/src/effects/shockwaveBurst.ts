import * as THREE from 'three'
import { roundMetric } from '../constants/03'
import { PFX_SHOCKWAVE_BURST_FRAGMENT, PFX_SHOCKWAVE_BURST_VERTEX } from '../constants/06'
import type { PfxShockwaveBurstRuntimeState } from '../types/02'

export function createPfxShockwaveBurstLifecycle(cycle: number): {
  progress: number; opacity: number; compression: number; expansion: number; front: number; attenuation: number
  stage: 'compression' | 'expansion' | 'attenuation'
} {
  const progress = THREE.MathUtils.clamp(cycle, 0, 1)
  if (progress < 0.16) {
    const charge = progress / 0.16
    return { progress, opacity: roundMetric(0.55 + charge * 0.45), compression: roundMetric(1 - charge), expansion: 0, front: roundMetric(0.08 + charge * 0.1), attenuation: 0, stage: 'compression' }
  }
  if (progress < 0.62) {
    const release = (progress - 0.16) / 0.46
    return { progress, opacity: 1, compression: 0, expansion: 1, front: roundMetric(0.18 + release * 0.64), attenuation: 0, stage: 'expansion' }
  }
  const tail = (progress - 0.62) / 0.38
  return { progress, opacity: Math.max(0, roundMetric(1 - Math.pow(tail, 0.68))), compression: 0, expansion: 1, front: roundMetric(0.82 + tail * 0.18), attenuation: roundMetric(tail), stage: 'attenuation' }
}

export function createPfxShockwaveBurstRuntimeState(elapsedSeconds: number, timing: number, lifetime: number, tempo: number, motionMultiplier: number, target?: PfxShockwaveBurstRuntimeState): PfxShockwaveBurstRuntimeState {
  const rate = Math.max(0.05, timing) * Math.max(0.1, tempo) * Math.max(0.1, motionMultiplier)
  const periodSeconds = 1.18 * Math.max(0.25, lifetime)
  const cycle = roundMetric(THREE.MathUtils.clamp((Math.max(0, elapsedSeconds) * rate) / periodSeconds, 0, 1))
  const lifecycle = createPfxShockwaveBurstLifecycle(cycle)
  const state = target ?? { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, compression: 0, expansion: 0, front: 0, attenuation: 0, stage: 'compression' }
  Object.assign(state, lifecycle, { cycle, periodSeconds }); return state
}

export function createPfxShockwaveBurstMaterial(opacity: number, colorA: THREE.ColorRepresentation = '#ff7a18', colorB: THREE.ColorRepresentation = '#ffd166', density = 0.72, styleEdgeHardness = 0.22): THREE.ShaderMaterial {
  const primary = new THREE.Color(colorA); const secondary = new THREE.Color(colorB).lerp(new THREE.Color('#fff5cf'), 0.34)
  const material = new THREE.ShaderMaterial({ uniforms: { uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) }, uProgress: { value: 0 }, uCompression: { value: 1 }, uExpansion: { value: 0 }, uFront: { value: 0.08 }, uAttenuation: { value: 0 }, uDensity: { value: THREE.MathUtils.clamp(density, 0.05, 1) }, uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) }, uColorA: { value: new THREE.Vector3(primary.r, primary.g, primary.b) }, uColorB: { value: new THREE.Vector3(secondary.r, secondary.g, secondary.b) } }, transparent: false, blending: THREE.NormalBlending, depthWrite: true, depthTest: true, side: THREE.DoubleSide, toneMapped: false, vertexShader: PFX_SHOCKWAVE_BURST_VERTEX, fragmentShader: PFX_SHOCKWAVE_BURST_FRAGMENT })
  material.userData['pfxShockwaveBurstMaterial'] = true; material.userData['pfxShockwaveBurstDrawCalls'] = 1; material.userData['pfxShockwaveBurstParticleCount'] = 0; material.userData['pfxShockwaveBurstFragmentTextureSamples'] = 0; material.userData['pfxShockwaveBurstTransientAllocationsPerFrame'] = 0; material.userData['pfxShockwaveBurstMeshJustification'] = 'bowed-segmented-pressure-front-with-integrated-compression-lens-and-force-flecks'; return material
}

export function createPfxShockwaveBurstGeometry(): THREE.BufferGeometry {
  const positions: number[] = []; const parts: number[] = []; const origins: number[] = []; const directions: number[] = []; const seeds: number[] = []
  const point = new THREE.Vector3(); const quaternion = new THREE.Quaternion(); const scaleVector = new THREE.Vector3()
  const append = (source: THREE.BufferGeometry, origin: [number, number, number], scale: [number, number, number], rotation: [number, number, number], direction: [number, number, number], part: number, seed: number) => {
    const geometry = source.index ? source.toNonIndexed() : source; quaternion.setFromEuler(new THREE.Euler(...rotation)); scaleVector.set(...scale); const attribute = geometry.getAttribute('position')
    for (let index = 0; index < attribute.count; index += 1) { point.fromBufferAttribute(attribute, index).multiply(scaleVector).applyQuaternion(quaternion); positions.push(point.x + origin[0], point.y + origin[1], point.z + origin[2]); parts.push(part); origins.push(...origin); directions.push(...direction); seeds.push(seed) }
    if (geometry !== source) geometry.dispose(); source.dispose()
  }
  append(new THREE.IcosahedronGeometry(1, 0), [0, .08, 0], [.48, .3, .48], [0, 0, 0], [0, 1, 0], 0, .04)
  const arcCount = 14
  for (let index = 0; index < arcCount; index += 1) {
    const angle = (index / arcCount) * Math.PI * 2 + (index % 2) * .025; const radius = 1.22 + (index % 3) * .045; const direction: [number, number, number] = [Math.cos(angle), .12 + Math.abs(Math.sin(angle)) * .22, Math.sin(angle)]; const origin: [number, number, number] = [Math.cos(angle) * radius, .12 + Math.abs(Math.sin(angle)) * .55, Math.sin(angle) * radius]
    append(new THREE.BoxGeometry(.52, .085, .14), origin, [1, 1, 1], [Math.sin(angle) * .16, -angle + Math.PI / 2, Math.cos(angle) * .12], direction, 1, .06 + index * .065)
  }
  const fleckDirections: Array<[number, number, number]> = [[1,.72,.2],[-1,.58,-.18],[.2,.82,1],[-.22,.66,-1],[.82,-.24,.72],[-.84,-.18,-.66],[.7,.42,-1],[-.68,.5,1]]
  fleckDirections.forEach((direction, index) => { const d = new THREE.Vector3(...direction).normalize(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), d); const e = new THREE.Euler().setFromQuaternion(q); const origin: [number,number,number] = [d.x*.62,d.y*.62+.12,d.z*.62]; append(new THREE.ConeGeometry(.09,.62,4,1,false), origin, [1,1,1], [e.x,e.y,e.z], direction, 2, .1 + index*.1) })
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions,3)); geometry.setAttribute('aShockPart', new THREE.Float32BufferAttribute(parts,1)); geometry.setAttribute('aShockOrigin', new THREE.Float32BufferAttribute(origins,3)); geometry.setAttribute('aShockDirection', new THREE.Float32BufferAttribute(directions,3)); geometry.setAttribute('aShockSeed', new THREE.Float32BufferAttribute(seeds,1)); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  geometry.userData['pfxShockwaveBurstGeometry']=true; geometry.userData['pfxShockwaveBurstClosedComponents']=true; geometry.userData['pfxShockwaveBurstCompressionLensCount']=1; geometry.userData['pfxShockwaveBurstPressureArcCount']=14; geometry.userData['pfxShockwaveBurstPressureFleckCount']=8; geometry.userData['pfxShockwaveBurstConnectedComponents']=23; geometry.userData['pfxShockwaveBurstTriangles']=positions.length/9; geometry.userData['pfxShockwaveBurstDrawCalls']=1
  return geometry
}
