import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

export interface PfxSpawnBurstRuntimeState {
  cycle: number
  stage: 'register' | 'build' | 'release' | 'rest'
}

export function createPfxSpawnBurstRuntimeState(
  input: { elapsedSeconds: number; timing: number; lifetime: number; tempo: number; motionMultiplier: number; cycleScale: number; reducedMotion: boolean },
  target?: PfxSpawnBurstRuntimeState,
): PfxSpawnBurstRuntimeState {
  const timeScale = Math.max(0.05, input.timing) * input.motionMultiplier * Math.max(0.1, input.tempo)
  const span = Math.max(0.3, Math.max(0.25, input.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER * Math.max(1, input.cycleScale)
  const cycle = ((Math.max(0, input.elapsedSeconds) * timeScale) % span) / span
  const state = target ?? { cycle: 0, stage: 'register' }
  state.cycle = cycle
  state.stage = cycle >= 0.82 ? 'rest' : cycle < 0.09 ? 'register' : cycle < 0.4 ? 'build' : 'release'
  return state
}

type Point = readonly [number, number, number]
interface Stroke { start: Point; end: Point; data: readonly [number, number, number, number] }
const seed = (i: number) => {
  let x = Math.imul(i + 1, 0x45d9f3b)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

// Each quad draws one soft light segment. The center stays open.
function strokeGeometry(strokes: readonly Stroke[]): THREE.BufferGeometry {
  const corners: number[] = [], starts: number[] = [], ends: number[] = [], data: number[] = [], indices: number[] = []
  for (const stroke of strokes) {
    const first = corners.length / 2
    for (const [x, y] of [[0, -1], [1, -1], [1, 1], [0, 1]]) {
      corners.push(x!, y!)
      starts.push(...stroke.start)
      ends.push(...stroke.end)
      data.push(...stroke.data)
    }
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(corners.length / 2 * 3), 3))
  geometry.setAttribute('aCorner', new THREE.Float32BufferAttribute(corners, 2))
  geometry.setAttribute('aStart', new THREE.Float32BufferAttribute(starts, 3))
  geometry.setAttribute('aEnd', new THREE.Float32BufferAttribute(ends, 3))
  geometry.setAttribute('aData', new THREE.Float32BufferAttribute(data, 4))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.5)
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-2.5, -2.5, -2.5), new THREE.Vector3(2.5, 2.5, 2.5))
  geometry.userData['particleCount'] = strokes.length
  return geometry
}

const VERTEX_HEADER = /* glsl */ `
uniform float uCycle;
uniform float uMotion;
attribute vec2 aCorner;
attribute vec3 aStart;
attribute vec3 aEnd;
attribute vec4 aData;
varying vec2 vUv;
varying float vEnergy;
varying float vSeed;
varying float vErode;
varying float vWisp;
void projectStroke(vec3 start, vec3 end, float width) {
  vec4 a = modelViewMatrix * vec4(start, 1.0);
  vec4 b = modelViewMatrix * vec4(end, 1.0);
  vec2 delta = b.xy - a.xy;
  vec2 axis = delta / max(length(delta), 0.00001);
  if (length(delta) < 0.00001) axis = vec2(0.0, 1.0);
  vec4 p = mix(a, b, aCorner.x);
  p.xy += vec2(-axis.y, axis.x) * aCorner.y * width * length(modelViewMatrix[0].xyz);
  vUv = vec2(aCorner.x, aCorner.y);
  vSeed = aData.x;
  vWisp = 1.0 - step(0.5, aData.y);
  gl_Position = projectionMatrix * p;
}
`
const BODY_VERTEX = /* glsl */ `${VERTEX_HEADER}
void main() {
  float s = aData.x;
  float ground = aData.y;
  float born = aData.z;
  float build = smoothstep(born, born + 0.085, uCycle);
  float height = clamp((born - 0.055) / 0.24, 0.0, 1.0);
  float retire = mix(smoothstep(0.17 + height * 0.25 + s * 0.018, 0.3 + height * 0.28 + s * 0.03, uCycle),
    smoothstep(0.3 + s * 0.04, 0.51 + s * 0.04, uCycle), ground);
  float wisp = 1.0 - ground;
  vec3 center = (aStart + aEnd) * 0.5;
  vec3 d = aEnd - aStart;
  // Each height starts after the height below it.
  center.y -= (1.0 - build) * 0.22 * (1.0 - ground) * uMotion;
  float turn = (s - 0.5) * (1.0 - build + retire) * 0.38 * uMotion;
  center.xz = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * center.xz;
  center.xz *= 1.0 + retire * 0.14 * uMotion;
  d *= mix(1.0, 0.8 + s * 0.15, wisp);
  float size = build * (1.0 - retire);
  vEnergy = smoothstep(0.0, 0.24, size);
  vErode = -0.18 + retire * 1.3;
  projectStroke(center - d * size * 0.5, center + d * size * 0.5, aData.w * size);
}
`

const ACCENT_VERTEX = /* glsl */ `${VERTEX_HEADER}
void main() {
  float s = aData.x;
  float age = (uCycle - aData.z) / (0.36 + s * 0.16);
  float t = clamp(age, 0.0, 1.0);
  vec3 center = (aStart + aEnd) * 0.5;
  float turn = (s - 0.5) * t * 0.65 * uMotion;
  center.xz = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * center.xz;
  center.y += (0.6 + aData.y * 0.65) * (1.0 - pow(1.0 - t, 1.35)) * uMotion;
  center.xz *= 1.0 - 0.2 * t * uMotion;
  float size = (0.55 + 0.45 * sin(min(1.0, t * 2.0) * 1.570796)) * pow(max(0.0, 1.0 - t), 0.65);
  vec3 d = aEnd - aStart;
  vEnergy = step(0.0, age) * step(age, 0.98);
  vErode = -0.18 + smoothstep(0.55, 1.0, t) * 1.3;
  projectStroke(center - d * size * 0.5, center + d * size * 0.5, aData.w * size);
}
`

export const PFX_SPAWN_BURST_BODY_FRAGMENT = /* glsl */ `
uniform float uCycle;
uniform float uOpacity;
uniform float uFlare;
uniform vec3 uColor;
uniform vec3 uHot;
varying vec2 vUv;
varying float vEnergy;
varying float vSeed;
varying float vErode;
varying float vWisp;
void main() {
  float taper = max(0.08, sin(vUv.x * 3.141593));
  float edge = exp(-3.4 * vUv.y * vUv.y / (taper * taper)) * taper;
  float cap = smoothstep(0.0, 0.14, vUv.x) * (1.0 - smoothstep(0.78, 1.0, vUv.x));
  float grain = 0.5 + 0.23 * sin(vUv.x * 7.0 + vSeed * 17.0)
    + 0.19 * sin(vUv.x * 16.0 - vSeed * 9.0);
  float erosion = smoothstep(vErode, vErode + 0.16, grain);
  float phase = (uCycle - 0.32) / 0.05;
  float beat = exp(-phase * phase) * uFlare;
  float core = exp(-24.0 * vUv.y * vUv.y) * taper;
  float density = mix(0.5, 0.76 + vSeed * 0.18, vWisp);
  float alpha = edge * cap * erosion * vEnergy * uOpacity * density;
  if (alpha < 0.003) discard;
  vec3 color = mix(uColor * (0.9 + vSeed * 0.16), uHot, core * (0.38 + beat * 0.4));
  gl_FragColor = vec4(color * (1.0 + beat * 0.22), alpha);
  #include <colorspace_fragment>
}
`

export const PFX_SPAWN_BURST_ACCENT_FRAGMENT = /* glsl */ `
uniform float uCycle;
uniform float uOpacity;
uniform float uFlare;
uniform vec3 uColor;
uniform vec3 uHot;
varying vec2 vUv;
varying float vEnergy;
varying float vSeed;
varying float vErode;
void main() {
  float edge = 1.0 - smoothstep(0.0, 1.0, abs(vUv.y));
  float cap = smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.82, 1.0, vUv.x));
  float grain = fract(sin(floor(vUv.x * 11.0) * 17.13 + vSeed * 63.7) * 43758.5453);
  float erosion = smoothstep(vErode, vErode + 0.16, grain);
  float phase = (uCycle - 0.32) / 0.05;
  float beat = exp(-phase * phase) * uFlare;
  float core = pow(max(0.0, 1.0 - abs(vUv.y)), 4.0);
  float alpha = edge * cap * erosion * vEnergy * uOpacity * 0.9;
  if (alpha < 0.003) discard;
  vec3 color = mix(uColor * (0.78 + vSeed * 0.15), uHot, core * (0.3 + beat * 0.5));
  gl_FragColor = vec4(color * (1.0 + beat * 0.22), alpha);
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
    fragmentShader: part === 'body' ? PFX_SPAWN_BURST_BODY_FRAGMENT : PFX_SPAWN_BURST_ACCENT_FRAGMENT,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false,
  })
  result.forceSinglePass = true
  result.userData['fragmentTextureSamples'] = 0
  return result
}

export function createPfxSpawnBurstBodyMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return material('body', opacity, color)
}
export function createPfxSpawnBurstAccentMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return material('accent', opacity, color)
}
export function applyPfxSpawnBurstUniforms(material: THREE.ShaderMaterial, state: PfxSpawnBurstRuntimeState, opacity: number, reducedMotion: boolean): void {
  material.uniforms['uCycle']!.value = state.cycle
  material.uniforms['uMotion']!.value = reducedMotion ? 0.24 : 1
  material.uniforms['uFlare']!.value = reducedMotion ? 0.4 : 1
  material.uniforms['uOpacity']!.value = state.stage === 'rest' ? 0 : THREE.MathUtils.clamp(opacity, 0, 1)
}

export function createPfxSpawnBurstBodyGeometry(): THREE.BufferGeometry {
  const strokes: Stroke[] = []
  // Four short curved marks leave most of the ground boundary empty.
  for (let i = 0; i < 4; i += 1) {
    const a = 0.3 + i * Math.PI / 2
    for (let j = 0; j < 3; j += 1) {
      const angle = a + j * 0.095
      const point = (value: number): Point => [Math.cos(value) * 0.49, -0.64, Math.sin(value) * 0.38]
      strokes.push({ start: point(angle), end: point(angle + 0.14), data: [seed(i * 3 + j), 1, 0.005 + i * 0.008, 0.018] })
    }
  }
  // Three rising groups of wisps leave gaps at different depths.
  for (let thread = 0; thread < 3; thread += 1) {
    const point = (t: number): Point => {
      const a = thread * Math.PI * 2 / 3 + t * 3.4
      const radius = 0.36 + Math.sin(t * Math.PI) * 0.12
      return [Math.cos(a) * radius, -0.58 + t * 1.3, Math.sin(a) * radius * 0.8]
    }
    for (let segment = 0; segment < 16; segment += 1) {
      if ((segment + thread) % 4 === 2 || segment === thread * 3 + 3 || segment === thread * 2 + 11) continue
      const t = segment / 16
      strokes.push({ start: point(t), end: point(t + 0.08), data: [seed(strokes.length + 10), 0, 0.055 + t * 0.24, 0.022 + seed(strokes.length + 80) * 0.009] })
    }
  }
  return strokeGeometry(strokes)
}
export function createPfxSpawnBurstAccentGeometry(): THREE.BufferGeometry {
  const strokes: Stroke[] = []
  for (let i = 0; i < 28; i += 1) {
    const a = i * 2.399963
    const r = 0.19 + seed(i + 64) * 0.3
    const p: Point = [Math.cos(a) * r, -0.61 + seed(i + 57) * 0.12, Math.sin(a) * r * 0.85]
    const length = 0.018 + seed(i + 18) * 0.04
    strokes.push({ start: p, end: [p[0] + length * 0.25, p[1] + length, p[2] - length * 0.2], data: [seed(i + 102), seed(i + 39), 0.025 + seed(i + 12) * 0.25, 0.005 + seed(i + 43) * 0.009] })
  }
  return strokeGeometry(strokes)
}
