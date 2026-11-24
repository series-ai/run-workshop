import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

export interface PfxHealingBurstRuntimeState {
  cycle: number
  stage: 'assemble' | 'activate' | 'release' | 'rest'
  decorativeTime: number
}

export function createPfxHealingBurstRuntimeState(
  input: { elapsedSeconds: number; timing: number; lifetime: number; tempo: number; motionMultiplier: number; cycleScale: number; reducedMotion: boolean },
  target?: PfxHealingBurstRuntimeState,
): PfxHealingBurstRuntimeState {
  const timeScale = Math.max(0.05, input.timing) * input.motionMultiplier * Math.max(0.1, input.tempo)
  const span = Math.max(0.3, Math.max(0.25, input.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER * Math.max(1, input.cycleScale)
  const cycle = ((Math.max(0, input.elapsedSeconds) * timeScale) % span) / span
  const state = target ?? { cycle: 0, stage: 'assemble', decorativeTime: 0 }
  state.cycle = cycle
  state.stage = cycle >= 0.86 ? 'rest' : cycle < 0.2 ? 'assemble' : cycle < 0.34 ? 'activate' : 'release'
  state.decorativeTime = cycle * (span / timeScale) * (input.reducedMotion ? 0.4 : 1)
  return state
}

type Point = readonly [number, number, number]
interface Cell { start: Point; end: Point; data: readonly [number, number, number, number] }
const seed = (i: number) => {
  let x = Math.imul(i + 1, 0x45d9f3b)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}
const frame = (x: number, y: number, z: number): Point => [Math.cos(0.72) * x + Math.sin(0.72) * z, y, -Math.sin(0.72) * x + Math.cos(0.72) * z]

// Each cell is one camera-facing stroke particle. No closed surface is drawn.
function cellGeometry(cells: readonly Cell[]): THREE.BufferGeometry {
  const corners: number[] = [], starts: number[] = [], ends: number[] = [], data: number[] = [], indices: number[] = []
  for (const cell of cells) {
    const first = corners.length / 2
    for (const [x, y] of [[0, -1], [1, -1], [1, 1], [0, 1]]) {
      corners.push(x!, y!); starts.push(...cell.start); ends.push(...cell.end); data.push(...cell.data)
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
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3)
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-3, -3, -3), new THREE.Vector3(3, 3, 3))
  geometry.userData['particleCount'] = cells.length
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
varying float vKind;
void projectStroke(vec3 start, vec3 end, float width) {
  vec4 a = modelViewMatrix * vec4(start, 1.0);
  vec4 b = modelViewMatrix * vec4(end, 1.0);
  vec2 delta = b.xy - a.xy;
  vec2 axis = length(delta) > 0.00001 ? normalize(delta) : vec2(0.0, 1.0);
  vec4 p = mix(a, b, aCorner.x);
  p.xy += vec2(-axis.y, axis.x) * aCorner.y * width * length(modelViewMatrix[0].xyz);
  vUv = vec2(aCorner.x, aCorner.y);
  vSeed = aData.x;
  vKind = aData.y;
  gl_Position = projectionMatrix * p;
}
`

const BODY_VERTEX = /* glsl */ `${VERTEX_HEADER}
vec3 weave(float t, float lane) {
  float angle = lane + t * 5.5 + smoothstep(0.05, 0.65, uCycle) * 0.5 * uMotion;
  float radius = 0.24 * sin(t * 2.4 + 0.45) + 0.065;
  return vec3(cos(angle) * radius, -0.63 + t * 1.25, sin(angle) * radius);
}
void main() {
  vec3 a = aStart;
  vec3 b = aEnd;
  float width = aData.w;
  float rise = smoothstep(0.3, 0.77, uCycle) * 0.32 * uMotion;
  if (aData.y < 0.5) {
    a = weave(aStart.x, aStart.y);
    b = weave(aEnd.x, aEnd.y);
    float front = smoothstep(0.0, 0.3, uCycle) * 1.3;
    float tail = smoothstep(0.3, 0.77, uCycle) * 1.4 - 0.3;
    vEnergy = smoothstep(aStart.x - 0.09, aStart.x + 0.08, front) * (1.0 - smoothstep(aStart.x - 0.08, aStart.x + 0.16, tail));
    width *= 0.65 + 0.35 * sin(aStart.x * 3.14159);
  } else {
    float assemble = smoothstep(0.055 + aData.z * 0.04, 0.2 + aData.z * 0.04, uCycle);
    vec3 center = (a + b) * 0.5;
    vec3 d = (b - a) * (0.45 + assemble * 0.55);
    center += vec3(0.0, -(1.0 - assemble) * 0.2 * uMotion, 0.0);
    a = center - d * 0.5;
    b = center + d * 0.5;
    vEnergy = assemble * (1.0 - smoothstep(0.37 + aData.x * 0.08, 0.62 + aData.x * 0.07, uCycle));
  }
  a.y += rise; b.y += rise;
  vEnergy *= smoothstep(0.005, 0.04, uCycle);
  width *= sqrt(max(0.0, vEnergy));
  projectStroke(a, b, width);
}
`
export const PFX_HEALING_BURST_BODY_FRAGMENT = /* glsl */ `
uniform float uCycle;
uniform float uOpacity;
uniform float uFlare;
uniform vec3 uColor;
uniform vec3 uHot;
varying vec2 vUv;
varying float vEnergy;
varying float vSeed;
varying float vKind;
void main() {
  float edge = 1.0 - smoothstep(0.25, 1.0, abs(vUv.y));
  float core = pow(max(0.0, 1.0 - abs(vUv.y)), 3.0);
  float beatPhase = (uCycle - 0.245) / 0.065;
  float beat = exp(-beatPhase * beatPhase) * uFlare;
  float alpha = edge * vEnergy * uOpacity * (vKind > 0.5 ? 0.86 : 0.53);
  if (alpha < 0.003) discard;
  vec3 color = mix(uColor * (vKind > 0.5 ? 0.88 : 0.63), uHot, core * (0.38 + beat * 0.48));
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`
const ACCENT_VERTEX = /* glsl */ `${VERTEX_HEADER}
void main() {
  float s = aData.x;
  float tau = (uCycle - aData.z) / (0.28 + s * 0.16);
  float t = clamp(tau, 0.0, 1.0);
  vec3 offset = vec3(sin(s * 19.0) * 0.09 * sin(t * 2.0), (0.36 + s * 0.32) * t, cos(s * 17.0) * 0.12 * t) * uMotion;
  vec3 center = aStart + offset;
  float turn = (s - 0.5) * 1.5 + t * 0.65 * uMotion;
  vec3 d = vec3(sin(turn), cos(turn), 0.0) * aData.w * (0.9 - t * 0.5);
  vEnergy = smoothstep(0.0, 0.12, tau) * (1.0 - smoothstep(0.5, 1.0, tau));
  projectStroke(center - d, center + d, aData.w * 0.4 * vEnergy);
}
`
export const PFX_HEALING_BURST_ACCENT_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uHot;
varying vec2 vUv;
varying float vEnergy;
varying float vSeed;
varying float vKind;
void main() {
  vec2 q = vec2((vUv.x - 0.5) * 2.0, vUv.y);
  float leaf = 1.0 - smoothstep(0.58, 1.0, abs(q.x) + abs(q.y) * (0.8 + 0.2 * q.x));
  float vein = exp(-q.y * q.y * 24.0);
  float alpha = leaf * vEnergy * uOpacity * 0.88;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(mix(uColor * 0.78, uHot, vein * 0.7), alpha);
  #include <colorspace_fragment>
}
`


function material(part: 'body' | 'accent', opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  const base = new THREE.Color(color)
  const result = new THREE.ShaderMaterial({
    uniforms: {
      uCycle: { value: 0 }, uMotion: { value: 1 }, uFlare: { value: 1 },
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uColor: { value: base }, uHot: { value: base.clone().lerp(new THREE.Color(1, 1, 1), 0.5) },
    },
    vertexShader: part === 'body' ? BODY_VERTEX : ACCENT_VERTEX,
    fragmentShader: part === 'body' ? PFX_HEALING_BURST_BODY_FRAGMENT : PFX_HEALING_BURST_ACCENT_FRAGMENT,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.NormalBlending, toneMapped: false,
  })
  result.forceSinglePass = true
  result.userData['fragmentTextureSamples'] = 0
  return result
}

export function createPfxHealingBurstBodyMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return material('body', opacity, color)
}
export function createPfxHealingBurstAccentMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return material('accent', opacity, color)
}
export function applyPfxHealingBurstUniforms(material: THREE.ShaderMaterial, state: PfxHealingBurstRuntimeState, opacity: number, reducedMotion: boolean): void {
  material.uniforms['uCycle']!.value = state.cycle
  material.uniforms['uMotion']!.value = reducedMotion ? 0.24 : 1
  material.uniforms['uFlare']!.value = reducedMotion ? 0.48 : 1
  material.uniforms['uOpacity']!.value = state.stage === 'rest' ? 0 : THREE.MathUtils.clamp(opacity, 0, 1)
}

export function createPfxHealingBurstBodyGeometry(): THREE.BufferGeometry {
  const cells: Cell[] = []
  for (let lane = 0; lane < 3; lane += 1) {
    for (let i = 0; i < 30; i += 1) {
      cells.push({ start: [i / 30, lane * Math.PI * 2 / 3, 0], end: [(i + 1) / 30, lane * Math.PI * 2 / 3, 0], data: [seed(i + lane * 30), 0, 0, 0.019 + lane * 0.002] })
    }
  }
  // A cross made from separated luminous cells has a thick central spine.
  // Its side arms recede in depth. Two short return strokes expose that depth.
  const lines = [
    [0, -0.15, 0.03, 0, 0.52, -0.02, 0.047],
    [-0.27, 0.2, -0.1, 0.27, 0.2, 0.13, 0.047],
    [0, 0.2, -0.25, 0, 0.2, 0.25, 0.036],
  ] as const
  for (const [x0, y0, z0, x1, y1, z1, width] of lines) {
    for (let i = 0; i < 5; i += 1) {
      const a = i / 5, b = (i + 0.94) / 5
      cells.push({ start: frame(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, z0 + (z1 - z0) * a), end: frame(x0 + (x1 - x0) * b, y0 + (y1 - y0) * b, z0 + (z1 - z0) * b), data: [seed(cells.length), 1, i / 5, width] })
    }
  }
  return cellGeometry(cells)
}
export function createPfxHealingBurstAccentGeometry(): THREE.BufferGeometry {
  const cells: Cell[] = []
  for (let i = 0; i < 30; i += 1) {
    const s = seed(i + 300), angle = i * 2.399963
    const radius = 0.19 + seed(i + 140) * 0.3
    const at: Point = [Math.cos(angle) * radius, -0.5 + seed(i + 90) * 0.65, Math.sin(angle) * radius]
    cells.push({ start: at, end: at, data: [s, 0, 0.13 + seed(i + 440) * 0.26, 0.014 + Math.pow(seed(i + 80), 2) * 0.035] })
  }
  return cellGeometry(cells)
}
