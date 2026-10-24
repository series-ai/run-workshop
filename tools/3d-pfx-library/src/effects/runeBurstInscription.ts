import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

export interface PfxRuneBurstRuntimeState {
  cycle: number
  stage: 'assemble' | 'activate' | 'release' | 'rest'
  decorativeTime: number
}

export function createPfxRuneBurstRuntimeState(
  input: { elapsedSeconds: number; timing: number; lifetime: number; tempo: number; motionMultiplier: number; cycleScale: number; reducedMotion: boolean },
  target?: PfxRuneBurstRuntimeState,
): PfxRuneBurstRuntimeState {
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
uniform float uFlare;
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
void main() {
  float s = aData.x;
  float birth = 0.015 + aData.z * 0.105;
  float assemble = smoothstep(birth, birth + 0.09, uCycle);
  float release = max(0.0, (uCycle - (0.35 + s * 0.055)) / 0.29);
  float alive = (1.0 - smoothstep(0.58 + s * 0.08, 0.73 + s * 0.07, uCycle));
  vec3 center = (aStart + aEnd) * 0.5;
  vec3 drift = vec3(sin(s * 43.0) * 0.42, 0.12 - s * 0.3, cos(s * 27.0) * 0.42);
  vec3 offset = center * (1.0 - assemble) * 0.38 * uMotion;
  offset += drift * release * uMotion;
  offset.y -= 0.36 * release * release * uMotion;
  vec3 segment = (aEnd - aStart) * mix(0.12, 1.0, assemble) * (1.0 - smoothstep(0.25, 1.1, release));
  float turn = release * (s - 0.5) * 2.1 * uMotion;
  segment.xz = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * segment.xz;
  vEnergy = assemble * alive;
  float beatPhase = (uCycle - 0.235) / 0.047;
  float beat = exp(-beatPhase * beatPhase) * uFlare;
  projectStroke(center + offset - segment * 0.5, center + offset + segment * 0.5, aData.w * vEnergy * (1.0 + beat * 0.28));
}
`
export const PFX_RUNE_BURST_BODY_FRAGMENT = /* glsl */ `
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
  float edge = 1.0 - smoothstep(0.4, 1.0, abs(vUv.y));
  float end = smoothstep(0.0, 0.055, vUv.x) * (1.0 - smoothstep(0.945, 1.0, vUv.x));
  float beatPhase = (uCycle - 0.235) / 0.047;
  float beat = exp(-beatPhase * beatPhase) * uFlare;
  float core = pow(max(0.0, 1.0 - abs(vUv.y)), 5.0);
  float alpha = edge * end * vEnergy * uOpacity * (0.68 + beat * 0.28);
  if (alpha < 0.003) discard;
  vec3 color = mix(uColor * (0.65 + 0.2 * vSeed), uHot, core * (0.35 + beat * 0.55));
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`
const ACCENT_VERTEX = /* glsl */ `${VERTEX_HEADER}
void main() {
  float s = aData.x;
  float tau = (uCycle - aData.z) / (0.23 + s * 0.16);
  float t = clamp(tau, 0.0, 1.0);
  vec3 offset = vec3(sin(s * 53.0) * 0.58, 0.24 + s * 0.27, cos(s * 39.0) * 0.48) * (1.0 - exp(-2.5 * t)) * uMotion;
  offset.y -= 0.72 * t * t * uMotion;
  vec3 center = (aStart + aEnd) * 0.5 + offset;
  float angle = t * (s - 0.5) * 3.0 * uMotion;
  vec3 d = aEnd - aStart;
  d.xy = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * d.xy;
  float size = pow(1.0 - t, 0.7);
  vEnergy = step(0.0, tau) * (1.0 - smoothstep(0.65, 1.0, tau));
  projectStroke(center - d * 0.5 * size, center + d * 0.5 * size, aData.w * size * vEnergy);
}
`
export const PFX_RUNE_BURST_ACCENT_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uHot;
varying vec2 vUv;
varying float vEnergy;
varying float vSeed;
varying float vKind;
void main() {
  float edge = 1.0 - smoothstep(0.3, 1.0, abs(vUv.y));
  float notch = 1.0 - step(0.54, vUv.x) * step(vUv.x, 0.67) * step(0.0, vUv.y);
  float alpha = edge * notch * vEnergy * uOpacity * 0.82;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(mix(uColor * 0.75, uHot, pow(1.0 - abs(vUv.y), 3.0) * 0.65), alpha);
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
    fragmentShader: part === 'body' ? PFX_RUNE_BURST_BODY_FRAGMENT : PFX_RUNE_BURST_ACCENT_FRAGMENT,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.NormalBlending, toneMapped: false,
  })
  result.forceSinglePass = true
  result.userData['fragmentTextureSamples'] = 0
  return result
}

export function createPfxRuneBurstBodyMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return material('body', opacity, color)
}
export function createPfxRuneBurstAccentMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return material('accent', opacity, color)
}
export function applyPfxRuneBurstUniforms(material: THREE.ShaderMaterial, state: PfxRuneBurstRuntimeState, opacity: number, reducedMotion: boolean): void {
  material.uniforms['uCycle']!.value = state.cycle
  material.uniforms['uMotion']!.value = reducedMotion ? 0.24 : 1
  material.uniforms['uFlare']!.value = reducedMotion ? 0.48 : 1
  material.uniforms['uOpacity']!.value = state.stage === 'rest' ? 0 : THREE.MathUtils.clamp(opacity, 0, 1)
}

// One central inscription and four small glyph cells have separate depth anchors.
function inscriptionCells(): Cell[] {
  const cells: Cell[] = []
  const stroke = (x0: number, y0: number, x1: number, y1: number, depth: number, width: number, order: number) => {
    const i = cells.length
    cells.push({ start: frame(x0, y0, depth), end: frame(x1, y1, depth + (seed(i + 80) - 0.5) * 0.07), data: [seed(i), 0, order, width] })
  }
  const main = [
    [0, -0.57, 0, -0.26], [0, -0.26, 0, 0.04], [0, 0.04, 0, 0.34], [0, 0.34, 0, 0.64], [-0.3, 0.38, 0, 0.64], [0, 0.64, 0.3, 0.38],
    [-0.3, 0.38, 0, 0.12], [0.3, 0.38, 0, 0.12],
    [-0.35, 0.08, 0, -0.18], [0, -0.18, 0.36, 0.1],
    [-0.35, 0.08, -0.35, 0.3], [0.36, 0.1, 0.36, 0.3],
    [0, -0.4, -0.24, -0.23], [0, -0.4, 0.24, -0.23],
    [-0.11, -0.57, 0, -0.69], [0, -0.69, 0.11, -0.57],
  ] as const
  main.forEach(([x0, y0, x1, y1], i) => stroke(x0, y0, x1, y1, 0.04, i < 4 ? 0.027 : 0.021, i / main.length))
  for (const [x, y, z, flip] of [[-0.61, 0.2, -0.2, 1], [0.58, 0.28, 0.2, -1], [-0.48, -0.36, 0.28, -1], [0.56, -0.32, -0.25, 1]] as const) {
    for (const [a, b, c, d] of [[-0.08, -0.12, 0, 0.13], [0, 0.13, 0.1, 0.02], [-0.04, 0.01, 0.09, -0.08]] as const) {
      stroke(x + a * flip, y + b, x + c * flip, y + d, z, 0.015, seed(cells.length + 60))
    }
  }
  return cells
}
export function createPfxRuneBurstBodyGeometry(): THREE.BufferGeometry {
  return cellGeometry(inscriptionCells())
}
export function createPfxRuneBurstAccentGeometry(): THREE.BufferGeometry {
  return cellGeometry(inscriptionCells().map((c, i) => {
    const t = 0.2 + seed(i + 90) * 0.6
    const center: Point = [c.start[0] + (c.end[0] - c.start[0]) * t, c.start[1] + (c.end[1] - c.start[1]) * t, c.start[2] + (c.end[2] - c.start[2]) * t]
    const d: Point = [(c.end[0] - c.start[0]) * 0.24, (c.end[1] - c.start[1]) * 0.24, (c.end[2] - c.start[2]) * 0.24]
    return { start: center, end: [center[0] + d[0], center[1] + d[1], center[2] + d[2]], data: [seed(i + 200), 0, 0.34 + seed(i + 42) * 0.08, 0.013] }
  }))
}
