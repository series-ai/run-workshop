import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

export interface PfxTeleportBurstRuntimeState {
  cycle: number
  stage: 'compress' | 'arrive' | 'release' | 'rest'
}

export function createPfxTeleportBurstRuntimeState(
  input: { elapsedSeconds: number; timing: number; lifetime: number; tempo: number; motionMultiplier: number; cycleScale: number; reducedMotion: boolean },
  target?: PfxTeleportBurstRuntimeState,
): PfxTeleportBurstRuntimeState {
  const timeScale = Math.max(0.05, input.timing) * input.motionMultiplier * Math.max(0.1, input.tempo)
  const span = Math.max(0.3, Math.max(0.25, input.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER * Math.max(1, input.cycleScale)
  const cycle = ((Math.max(0, input.elapsedSeconds) * timeScale) % span) / span
  const state = target ?? { cycle: 0, stage: 'compress' }
  state.cycle = cycle
  state.stage = cycle >= 0.82 ? 'rest' : cycle < 0.17 ? 'compress' : cycle < 0.34 ? 'arrive' : 'release'
  return state
}

type Point = readonly [number, number, number]
interface Particle { home: Point; size: number; seed: number; aspect: number; kind: number; delay: number }
function seed(index: number): number {
  let h = Math.imul(index + 1, 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function particleGeometry(particles: readonly Particle[]): THREE.BufferGeometry {
  const corners: number[] = [], homes: number[] = [], data: number[] = [], indices: number[] = []
  for (const particle of particles) {
    const first = corners.length / 2
    for (const corner of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      corners.push(...corner)
      homes.push(...particle.home, particle.size)
      data.push(particle.seed, particle.aspect, particle.kind, particle.delay)
    }
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(corners.length / 2 * 3), 3))
  geometry.setAttribute('aCorner', new THREE.Float32BufferAttribute(corners, 2))
  geometry.setAttribute('aHome', new THREE.Float32BufferAttribute(homes, 4))
  geometry.setAttribute('aData', new THREE.Float32BufferAttribute(data, 4))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.2)
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-2.2, -2.2, -2.2), new THREE.Vector3(2.2, 2.2, 2.2))
  geometry.userData['particleCount'] = particles.length
  return geometry
}

const VERTEX_HEADER = /* glsl */ `
uniform float uCycle;
uniform float uMotion;
attribute vec2 aCorner;
attribute vec4 aHome;
attribute vec4 aData;
varying vec2 vUv;
varying float vEnergy;
varying float vSeed;
varying float vErode;
varying float vKind;
void projectParticle(vec3 center, vec3 direction, vec2 size) {
  vec4 p = modelViewMatrix * vec4(center, 1.0);
  vec2 axis = (modelViewMatrix * vec4(direction, 0.0)).xy;
  float projected = length(axis);
  axis = projected > 0.00001 ? axis / max(projected, 0.00001) : vec2(0.0, 1.0);
  vec2 across = vec2(axis.y, -axis.x);
  float scale = length(modelViewMatrix[0].xyz);
  p.xy += (across * aCorner.x * size.x + axis * aCorner.y * size.y) * scale;
  vUv = aCorner;
  vSeed = aData.x;
  vKind = aData.z;
  gl_Position = projectionMatrix * p;
}
`

const DENSITY = /* glsl */ `
uniform float uCycle;
uniform float uMotion;
uniform float uOpacity;
uniform float uFlare;
uniform float uIntensity;
uniform vec3 uColor;
uniform vec3 uHot;
varying vec2 vUv;
varying float vEnergy;
varying float vSeed;
varying float vErode;
varying float vKind;
float hash(vec2 p) {
  p = fract(p * vec2(0.3183099, 0.3678794) + 0.17);
  p *= 17.0;
  return fract(p.x * p.y * (p.x + p.y));
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
}
float density(vec2 uv) {
  vec2 drift = vec2(0.13, -0.55) * uCycle * uMotion;
  vec2 q = uv * 2.4 + vSeed * 37.0 + drift;
  float n = noise(q) * 0.66 + noise(q * 2.13 + 4.7) * 0.34;
  float radius = length(uv + vec2(n - 0.5, noise(q + 8.4) - 0.5) * 0.33);
  float feather = 1.0 - smoothstep(0.24, 1.0, radius);
  return feather * (0.38 + n * 0.92) * smoothstep(vErode, vErode + 0.28, n);
}
`
const BODY_VERTEX = /* glsl */ `${VERTEX_HEADER}
void main() {
  float gather = smoothstep(0.0, 0.2, uCycle);
  float peel = smoothstep(0.25, 0.64, uCycle);
  float s = aData.x;
  vec3 center = aHome.xyz;
  // Short side plumes converge around separate central density clumps.
  center.xz *= 1.0 + (0.75 * (1.0 - gather) - 0.25 * gather + 0.7 * peel) * uMotion;
  center.y += (-0.16 * (1.0 - gather) + peel * (0.13 + s * 0.18)) * uMotion;
  center.x += sin(s * 17.0) * peel * 0.12 * uMotion;
  float appear = smoothstep(aData.w, aData.w + 0.055, uCycle);
  float retire = smoothstep(0.25 + s * 0.04, 0.43 + s * 0.12, uCycle);
  float size = appear * (1.0 - retire);
  if (aData.z > 0.5) {
    center = aHome.xyz;
    center.xz *= 1.0 + (1.0 - gather) * 0.65 * uMotion;
    center.y += peel * 0.12 * uMotion;
    retire = smoothstep(0.33 + s * 0.04, 0.57 + s * 0.07, uCycle);
    size = smoothstep(0.06, 0.18, uCycle) * (1.0 - retire);
  }
  vEnergy = step(0.006, size);
  vErode = -0.28 + retire * 0.85;
  projectParticle(center, vec3(0.12 * sin(s * 19.0), 1.0, 0.08), vec2(aHome.w * (1.0 + 0.35 * gather), aHome.w * aData.y) * size);
}
`
const ACCENT_VERTEX = /* glsl */ `${VERTEX_HEADER}
void main() {
  float age = (uCycle - aData.w) / (0.27 + aData.x * 0.19);
  float t = clamp(age, 0.0, 1.0);
  float s = aData.x;
  vec3 direction = vec3(sin(s * 37.0) * 0.62, 0.18 + s * 0.48, cos(s * 29.0) * 0.55);
  vec3 center = aHome.xyz + direction * (1.0 - exp(-3.0 * t)) * uMotion;
  center.x += sin(t * 3.141593) * sin(s * 43.0) * 0.1 * uMotion;
  float size = pow(max(0.0, 1.0 - t), 1.1);
  vEnergy = step(0.0, age) * step(age, 0.985);
  vErode = -0.2 + t * 0.65;
  projectParticle(center, direction, vec2(aHome.w, aHome.w * (1.0 + (aData.y - 1.0) * (1.0 - t))) * size);
}
`

export const PFX_TELEPORT_BURST_BODY_FRAGMENT = /* glsl */ `${DENSITY}
void main() {
  float field = density(vUv);
  float core = exp(-dot(vUv, vUv) * 9.0);
  float phase = (uCycle - 0.215) / 0.035;
  float beat = exp(-phase * phase) * uFlare;
  float focal = step(0.5, vKind);
  float alpha = field * vEnergy * uOpacity * mix(0.38, 0.58, focal);
  if (alpha < 0.003) discard;
  vec3 color = mix(uColor * (0.6 + field * 0.55), uHot, core * (0.12 + focal * 0.16 + beat * 0.18));
  gl_FragColor = vec4(color * uIntensity * (1.0 + beat * (0.3 + focal * 0.3)), alpha);
  #include <colorspace_fragment>
}
`
export const PFX_TELEPORT_BURST_ACCENT_FRAGMENT = /* glsl */ `${DENSITY}
void main() {
  float field = density(vUv);
  float core = exp(-dot(vUv, vUv) * 11.0);
  float alpha = field * vEnergy * uOpacity;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(mix(uColor * 0.7, uHot, core * 0.24) * uIntensity * (0.76 + uFlare * 0.08), alpha);
  #include <colorspace_fragment>
}
`
function material(part: 'body' | 'accent', opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  const base = new THREE.Color(color)
  const result = new THREE.ShaderMaterial({
    uniforms: {
      uCycle: { value: 0 }, uMotion: { value: 1 }, uFlare: { value: 1 }, uIntensity: { value: 1 },
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uColor: { value: base }, uHot: { value: base.clone().lerp(new THREE.Color(1, 1, 1), 0.36) },
    },
    vertexShader: part === 'body' ? BODY_VERTEX : ACCENT_VERTEX,
    fragmentShader: part === 'body' ? PFX_TELEPORT_BURST_BODY_FRAGMENT : PFX_TELEPORT_BURST_ACCENT_FRAGMENT,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false,
  })
  result.forceSinglePass = true
  result.userData['fragmentTextureSamples'] = 0
  return result
}

export function createPfxTeleportBurstBodyMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return material('body', opacity, color)
}
export function createPfxTeleportBurstAccentMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return material('accent', opacity, color)
}
export function applyPfxTeleportBurstUniforms(material: THREE.ShaderMaterial, state: PfxTeleportBurstRuntimeState, opacity: number, reducedMotion: boolean): void {
  material.uniforms['uCycle']!.value = state.cycle
  material.uniforms['uMotion']!.value = reducedMotion ? 0.24 : 1
  material.uniforms['uFlare']!.value = reducedMotion ? 0.4 : 1
  material.uniforms['uIntensity']!.value = reducedMotion ? 0.42 : 1
  material.uniforms['uOpacity']!.value = state.stage === 'rest' ? 0 : THREE.MathUtils.clamp(opacity, 0, 1)
}

// Unequal short plumes surround the central arrival density.
function plumeHome(index: number): Point {
  const lane = index % 3
  const y = -0.34 + Math.floor(index / 3) * 0.112
  const x = [-0.24, 0.12, 0.34][lane]!
  const z = [0.14, -0.23, 0.16][lane]!
  return [x + Math.sin(y * 4.0 + lane) * 0.055, y + lane * 0.055, z + (seed(index + 70) - 0.5) * 0.16]
}
export function createPfxTeleportBurstBodyGeometry(): THREE.BufferGeometry {
  const particles: Particle[] = []
  for (let i = 0; i < 21; i += 1) {
    particles.push({ home: plumeHome(i), size: (i % 3 === 0 ? 0.15 : i % 3 === 1 ? 0.12 : 0.1) * (0.85 + seed(i + 19) * 0.4), seed: seed(i), aspect: 1.05 + seed(i + 46) * 0.55, kind: 0, delay: seed(i + 95) * 0.025 })
  }
  const core: readonly Point[] = [[-0.06, -0.12, 0.12], [0.1, 0.08, -0.14], [-0.09, 0.2, -0.05], [0.06, -0.04, 0.18], [0, 0.03, -0.02]]
  for (const [i, home] of core.entries()) {
    particles.push({ home, size: [0.3, 0.31, 0.24, 0.27, 0.23][i]!, seed: seed(i + 205), aspect: 1.0 + seed(i + 212) * 0.35, kind: 1, delay: 0 })
  }
  return particleGeometry(particles)
}
export function createPfxTeleportBurstAccentGeometry(): THREE.BufferGeometry {
  return particleGeometry(Array.from({ length: 26 }, (_, i) => {
    const home = plumeHome(i % 21)
    return { home: [home[0] * 0.5, home[1] * 0.8, home[2] * 0.65] as Point, size: 0.012 + seed(i + 36) ** 2 * 0.026, seed: seed(i + 140), aspect: i % 5 === 0 ? 1.7 : 1.0, kind: 0, delay: 0.2 + seed(i + 88) * 0.13 }
  }))
}
