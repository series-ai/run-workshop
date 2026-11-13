import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

export interface PfxHolyBurstRuntimeState {
  cycle: number
  stage: 'assemble' | 'activate' | 'release' | 'rest'
  decorativeTime: number
}

export function createPfxHolyBurstRuntimeState(
  input: { elapsedSeconds: number; timing: number; lifetime: number; tempo: number; motionMultiplier: number; cycleScale: number; reducedMotion: boolean },
  target?: PfxHolyBurstRuntimeState,
): PfxHolyBurstRuntimeState {
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
vec3 ray(float t, float angle, float depth, float s) {
  float grow = smoothstep(0.07 + s * 0.035, 0.23, uCycle);
  float length = (0.25 + 0.75 * grow * uMotion) * (0.75 + 0.25 * cos(angle));
  float bend = t * t * (0.12 + s * 0.07) * uMotion;
  vec3 p = vec3(sin(angle) * (0.12 + t * length), -0.12 + cos(angle) * (0.12 + t * length) + bend, depth * t);
  float cy = cos(0.72), sy = sin(0.72);
  return vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
}
void main() {
  float s = aData.x;
  float t0 = aStart.x, t1 = aEnd.x;
  vec3 a = ray(t0, aStart.y, aStart.z, s);
  vec3 b = ray(t1, aStart.y, aStart.z, s);
  float head = smoothstep(0.065, 0.23, uCycle) * 1.15;
  float tail = smoothstep(0.28, 0.65, uCycle) * 1.35 - 0.15;
  vEnergy = smoothstep(t0 - 0.06, t1 + 0.035, head) * (1.0 - smoothstep(t0 - 0.06, t1 + 0.05, tail));
  vEnergy *= smoothstep(0.005, 0.04, uCycle);
  float taper = pow(max(0.0, sin((0.04 + t0 * 0.92) * 3.14159)), 0.65);
  float width = aData.w * taper * sqrt(max(0.0, vEnergy));
  float lift = smoothstep(0.31, 0.74, uCycle) * (0.12 + s * 0.12) * uMotion;
  a.y += lift; b.y += lift;
  projectStroke(a, b, width);
}
`
export const PFX_HOLY_BURST_BODY_FRAGMENT = /* glsl */ `
uniform float uCycle;
uniform float uFlare;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uHot;
varying vec2 vUv;
varying float vEnergy;
varying float vSeed;
varying float vKind;
void main() {
  float across = max(0.0, 1.0 - abs(vUv.y));
  float edge = smoothstep(0.0, 0.65, across);
  float beatPhase = (uCycle - 0.215) / 0.055;
  float beat = exp(-beatPhase * beatPhase) * uFlare;
  float alpha = edge * vEnergy * uOpacity * (0.62 + beat * 0.3);
  if (alpha < 0.003) discard;
  vec3 color = mix(uColor * (0.68 + 0.2 * vSeed), uHot, pow(across, 4.0) * (0.35 + beat * 0.55));
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`
const ACCENT_VERTEX = /* glsl */ `${VERTEX_HEADER}
void main() {
  float s = aData.x;
  float tau = (uCycle - aData.z) / (0.33 + s * 0.14);
  float t = clamp(tau, 0.0, 1.0);
  vec3 center = aStart;
  vec3 travel = vec3(sin(s * 43.0) * 0.18 * sin(t * 2.4), (0.36 + s * 0.3) * t, cos(s * 29.0) * 0.18 * t);
  center += travel * uMotion;
  float turn = (s - 0.5) * 1.8 + sin(t * 2.7 + s * 6.0) * 0.38 * uMotion;
  vec3 d = vec3(sin(turn), cos(turn), (s - 0.5) * 0.5) * aData.w * (1.0 - smoothstep(0.4, 1.0, t) * 0.65);
  vEnergy = smoothstep(0.0, 0.12, tau) * (1.0 - smoothstep(0.62, 1.0, tau));
  projectStroke(center - d, center + d, aData.w * 0.3 * sqrt(max(0.0, vEnergy)));
}
`
export const PFX_HOLY_BURST_ACCENT_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uHot;
varying vec2 vUv;
varying float vEnergy;
varying float vSeed;
varying float vKind;
void main() {
  float t = vUv.x;
  float shape = pow(max(0.0, sin(t * 3.14159)), 0.72) * (1.0 - 0.38 * t);
  float bend = 0.18 * sin(t * 3.14159);
  float across = abs(vUv.y - bend);
  float vane = 1.0 - smoothstep(shape * 0.68, shape + 0.015, across);
  float shaftOffset = (vUv.y - bend) * 13.0;
  float shaft = exp(-shaftOffset * shaftOffset);
  float barbs = 0.77 + 0.23 * smoothstep(-0.4, 0.5, sin(t * 68.0 + abs(vUv.y - bend) * 10.0));
  float alpha = vane * barbs * vEnergy * uOpacity * 0.83;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(mix(uColor * 0.77, uHot, shaft * 0.65 + 0.12), alpha);
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
    fragmentShader: part === 'body' ? PFX_HOLY_BURST_BODY_FRAGMENT : PFX_HOLY_BURST_ACCENT_FRAGMENT,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.NormalBlending, toneMapped: false,
  })
  result.forceSinglePass = true
  result.userData['fragmentTextureSamples'] = 0
  return result
}

export function createPfxHolyBurstBodyMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return material('body', opacity, color)
}
export function createPfxHolyBurstAccentMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return material('accent', opacity, color)
}
export function applyPfxHolyBurstUniforms(material: THREE.ShaderMaterial, state: PfxHolyBurstRuntimeState, opacity: number, reducedMotion: boolean): void {
  material.uniforms['uCycle']!.value = state.cycle
  material.uniforms['uMotion']!.value = reducedMotion ? 0.24 : 1
  material.uniforms['uFlare']!.value = reducedMotion ? 0.48 : 1
  material.uniforms['uOpacity']!.value = state.stage === 'rest' ? 0 : THREE.MathUtils.clamp(opacity, 0, 1)
}

export function createPfxHolyBurstBodyGeometry(): THREE.BufferGeometry {
  const cells: Cell[] = []
  const rays = [
    [-2.16, 0.14, 0.012], [-1.78, -0.24, 0.016], [-1.39, 0.3, 0.024],
    [-1.02, -0.18, 0.017], [-0.7, 0.18, 0.024], [-0.37, -0.12, 0.018],
    [0.04, 0.08, 0.034], [0.38, 0.32, 0.019], [0.73, -0.3, 0.024],
    [1.07, 0.14, 0.015], [1.4, -0.18, 0.025], [1.8, 0.27, 0.015], [2.2, -0.1, 0.012],
    [-0.8, -0.65, 0.015], [0.9, 0.65, 0.015],
  ] as const
  rays.forEach(([angle, depth, width], j) => {
    for (let i = 0; i < 16; i += 1) {
      cells.push({ start: [i / 16, angle, depth], end: [(i + 1) / 16, angle, depth], data: [seed(j + 500), 0, 0, width] })
    }
  })
  return cellGeometry(cells)
}
export function createPfxHolyBurstAccentGeometry(): THREE.BufferGeometry {
  const cells: Cell[] = []
  for (let i = 0; i < 24; i += 1) {
    const s = seed(i + 77)
    const side = i < 12 ? -1 : 1
    const x = side * (0.15 + seed(i + 66) * 0.46)
    const y = -0.34 + seed(i + 310) * 0.74
    const at = frame(x, y, (seed(i + 89) - 0.5) * 0.8)
    cells.push({ start: at, end: at, data: [s, 0, 0.19 + seed(i + 990) * 0.17, 0.055 + Math.pow(seed(i + 65), 2) * 0.11] })
  }
  return cellGeometry(cells)
}
