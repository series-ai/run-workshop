import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

export interface PfxDespawnBurstRuntimeState {
  cycle: number
  stage: 'separate' | 'collapse' | 'release' | 'rest'
}

export function createPfxDespawnBurstRuntimeState(
  input: { elapsedSeconds: number; timing: number; lifetime: number; tempo: number; motionMultiplier: number; cycleScale: number; reducedMotion: boolean },
  target?: PfxDespawnBurstRuntimeState,
): PfxDespawnBurstRuntimeState {
  const timeScale = Math.max(0.05, input.timing) * input.motionMultiplier * Math.max(0.1, input.tempo)
  const span = Math.max(0.3, Math.max(0.25, input.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER * Math.max(1, input.cycleScale)
  const cycle = ((Math.max(0, input.elapsedSeconds) * timeScale) % span) / span
  const state = target ?? { cycle: 0, stage: 'separate' }
  state.cycle = cycle
  state.stage = cycle >= 0.82 ? 'rest' : cycle < 0.16 ? 'separate' : cycle < 0.48 ? 'collapse' : 'release'
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
  float s = aData.x;
  float separate = smoothstep(0.02, 0.2, uCycle);
  float collapse = smoothstep(0.18 + aData.w, 0.59 + aData.w, uCycle);
  vec3 exitPoint = vec3(-0.12, -0.64, 0.04);
  vec3 center = aHome.xyz;
  vec3 outward = vec3(center.x * 0.48, (s - 0.3) * 0.13, center.z * 0.48);
  center += outward * separate * uMotion;
  center += (exitPoint - center) * collapse * uMotion;
  center.z += sin(collapse * 3.141593) * (s - 0.5) * 0.18 * uMotion;
  float size = smoothstep(0.0, 0.025, uCycle) * (1.0 - collapse);
  if (aData.z > 0.5) {
    center = exitPoint;
    size = smoothstep(0.46, 0.55, uCycle) * (1.0 - smoothstep(0.57, 0.76, uCycle)) * 0.7;
  }
  vEnergy = step(0.006, size);
  vErode = aData.z > 0.5 ? -0.3 : -0.3 + collapse * 1.05;
  projectParticle(center, vec3(sin(s * 23.0) * 0.25, 1.0, 0.1), vec2(aHome.w, aHome.w * aData.y) * size);
}
`
const ACCENT_VERTEX = /* glsl */ `${VERTEX_HEADER}
void main() {
  float age = (uCycle - aData.w) / (0.37 + aData.x * 0.14);
  float t = clamp(age, 0.0, 1.0);
  float s = aData.x;
  vec3 exitPoint = vec3(-0.12, -0.64, 0.04);
  vec3 outward = vec3(sin(s * 31.0) * 0.23, 0.07 + s * 0.08, cos(s * 37.0) * 0.2);
  vec3 center = aHome.xyz + outward * sin(t * 3.141593) * uMotion;
  float pull = smoothstep(0.13, 0.96, t);
  center += (exitPoint - aHome.xyz) * pull * uMotion;
  float size = pow(max(0.0, 1.0 - t), 0.9);
  vEnergy = step(0.0, age) * step(age, 0.985);
  vErode = -0.22 + t * 0.7;
  vec3 direction = mix(outward, exitPoint - aHome.xyz, pull);
  projectParticle(center, direction, vec2(aHome.w, aHome.w * aData.y) * size);
}
`

export const PFX_DESPAWN_BURST_BODY_FRAGMENT = /* glsl */ `${DENSITY}
void main() {
  float field = density(vUv);
  float core = exp(-dot(vUv - vec2(-0.08, 0.18), vUv - vec2(-0.08, 0.18)) * 7.0);
  float receipt = step(0.5, vKind);
  float edge = field * (1.0 - field) * 0.35;
  float alpha = field * vEnergy * uOpacity * mix(0.66, 0.5, receipt);
  if (alpha < 0.003) discard;
  vec3 color = mix(uColor * (0.48 + field * 0.7), uHot, core * 0.24 + edge * uFlare);
  gl_FragColor = vec4(color * mix(1.0, 0.75, receipt), alpha);
  #include <colorspace_fragment>
}
`
export const PFX_DESPAWN_BURST_ACCENT_FRAGMENT = /* glsl */ `${DENSITY}
void main() {
  float field = density(vUv);
  float core = exp(-dot(vUv, vUv) * 8.0);
  float alpha = field * vEnergy * uOpacity * 0.92;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(mix(uColor * 0.82, uHot, core * 0.28) * (0.9 + uFlare * 0.12), alpha);
  #include <colorspace_fragment>
}
`
function material(part: 'body' | 'accent', opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  const base = new THREE.Color(color)
  const result = new THREE.ShaderMaterial({
    uniforms: {
      uCycle: { value: 0 }, uMotion: { value: 1 }, uFlare: { value: 1 },
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uColor: { value: base }, uHot: { value: base.clone().lerp(new THREE.Color(1, 1, 1), 0.36) },
    },
    vertexShader: part === 'body' ? BODY_VERTEX : ACCENT_VERTEX,
    fragmentShader: part === 'body' ? PFX_DESPAWN_BURST_BODY_FRAGMENT : PFX_DESPAWN_BURST_ACCENT_FRAGMENT,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false,
  })
  result.forceSinglePass = true
  result.userData['fragmentTextureSamples'] = 0
  return result
}

export function createPfxDespawnBurstBodyMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return material('body', opacity, color)
}
export function createPfxDespawnBurstAccentMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return material('accent', opacity, color)
}
export function applyPfxDespawnBurstUniforms(material: THREE.ShaderMaterial, state: PfxDespawnBurstRuntimeState, opacity: number, reducedMotion: boolean): void {
  material.uniforms['uCycle']!.value = state.cycle
  material.uniforms['uMotion']!.value = reducedMotion ? 0.24 : 1
  material.uniforms['uFlare']!.value = reducedMotion ? 0.4 : 1
  material.uniforms['uOpacity']!.value = state.stage === 'rest' ? 0 : THREE.MathUtils.clamp(opacity, 0, 1)
}

// Unequal clumps form a vapor afterimage with no closed surface.
function huskHome(index: number): Point {
  const clumps: readonly Point[] = [[-0.25, 0.34, 0.05], [0.13, 0.48, -0.16], [0.29, 0.05, 0.12], [-0.2, -0.17, -0.18], [0.04, -0.39, 0.14]]
  const home = clumps[index % clumps.length]!
  return [home[0] + (seed(index + 26) - 0.5) * 0.24, home[1] + (seed(index + 53) - 0.5) * 0.23, home[2] + (seed(index + 89) - 0.5) * 0.24]
}
export function createPfxDespawnBurstBodyGeometry(): THREE.BufferGeometry {
  const particles: Particle[] = []
  for (let i = 0; i < 24; i += 1) {
    particles.push({ home: huskHome(i), size: 0.135 + seed(i + 16) * 0.095, seed: seed(i + 119), aspect: 1.0 + seed(i + 67) * 0.9, kind: 0, delay: seed(i + 95) * 0.07 })
  }
  particles.push({ home: [-0.12, -0.64, 0.04], size: 0.16, seed: 0.71, aspect: 0.7, kind: 1, delay: 0 })
  return particleGeometry(particles)
}
export function createPfxDespawnBurstAccentGeometry(): THREE.BufferGeometry {
  return particleGeometry(Array.from({ length: 28 }, (_, i) => ({
    home: huskHome(i), size: 0.02 + seed(i + 175) ** 2 * 0.055, seed: seed(i + 145), aspect: 0.8 + seed(i + 19) * 0.85, kind: 0, delay: 0.1 + seed(i + 33) * 0.14,
  })))
}
