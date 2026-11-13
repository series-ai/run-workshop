import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

export interface PfxReflectBurstRuntimeState {
  cycle: number
  stage: 'contact' | 'return' | 'release' | 'rest'
}

export function createPfxReflectBurstRuntimeState(
  input: { elapsedSeconds: number; timing: number; lifetime: number; tempo: number; motionMultiplier: number; cycleScale: number; reducedMotion: boolean },
  target?: PfxReflectBurstRuntimeState,
): PfxReflectBurstRuntimeState {
  const rate = Math.max(0.05, input.timing) * input.motionMultiplier * Math.max(0.1, input.tempo)
  const span = Math.max(0.3, Math.max(0.25, input.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER * Math.max(1, input.cycleScale)
  const cycle = ((Math.max(0, input.elapsedSeconds) * rate) % span) / span
  const state = target ?? { cycle: 0, stage: 'rest' }
  state.cycle = cycle
  state.stage = cycle >= 0.84 ? 'rest' : cycle < 0.23 ? 'contact' : cycle < 0.4 ? 'return' : 'release'
  return state
}

// Each sheet has its own coordinates in one draw buffer.
function sheetGeometry(count: number, columns: number, rows: number): THREE.BufferGeometry {
  const sheets: number[] = [], indices: number[] = []
  for (let sheet = 0; sheet < count; sheet += 1) {
    const first = sheets.length / 4
    for (let x = 0; x <= columns; x += 1) {
      for (let y = 0; y <= rows; y += 1) {
        sheets.push(x / columns, y / rows * 2 - 1, sheet, (sheet * 0.618034 + 0.173) % 1)
      }
    }
    for (let x = 0; x < columns; x += 1) {
      for (let y = 0; y < rows; y += 1) {
        const a = first + x * (rows + 1) + y
        indices.push(a, a + 1, a + rows + 1, a + 1, a + rows + 2, a + rows + 1)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(sheets.length / 4 * 3), 3))
  geometry.setAttribute('aStrip', new THREE.Float32BufferAttribute(sheets, 4))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3)
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-3, -3, -3), new THREE.Vector3(3, 3, 3))
  return geometry
}

const VERTEX_HEADER = /* glsl */ `
uniform float uCycle;
uniform float uMotion;
attribute vec4 aStrip;
varying vec2 vUv;
varying float vSeed;
varying float vAlive;
varying float vPart;
vec3 frame(vec3 p) {
  return vec3(0.852525 * p.x + 0.522687 * p.z, p.y, -0.522687 * p.x + 0.852525 * p.z);
}
void projectSheet(vec3 p) {
  vec4 view = modelViewMatrix * vec4(frame(p), 1.0);
  gl_Position = projectionMatrix * view;
  vUv = aStrip.xy;
  vSeed = aStrip.w;
  vPart = aStrip.z;
}
void projectStrip(vec3 p, vec3 next, float width) {
  vec4 view = modelViewMatrix * vec4(frame(p), 1.0);
  vec4 other = modelViewMatrix * vec4(frame(next), 1.0);
  vec2 delta = other.xy - view.xy;
  vec2 tangent = delta / max(length(delta), 0.00001);
  if (length(delta) < 0.00001) tangent = vec2(1.0, 0.0);
  view.xy += vec2(-tangent.y, tangent.x) * aStrip.y * width * length(modelViewMatrix[0].xyz);
  gl_Position = projectionMatrix * view;
  vUv = aStrip.xy;
  vSeed = aStrip.w;
  vPart = aStrip.z;
}
`

const BODY_VERTEX = /* glsl */ `${VERTEX_HEADER}
void main() {
  float t = aStrip.x;
  float v = aStrip.y;
  vec3 contact = vec3(0.32, 0.02, 0.14);
  float open = (0.25 + 0.75 * smoothstep(0.045, 0.17, uCycle)) * uMotion;
  vec3 p;
  if (aStrip.z < 0.5) {
    vAlive = smoothstep(0.035, 0.065, uCycle) * (1.0 - smoothstep(0.18, 0.43, uCycle));
    p = contact + vec3(-0.10 - (0.43 * v * v + t * 0.45) * open,
      v * 0.82 * open * (1.0 + 0.08 * v), v * 0.18 * open + t * 0.06);
  } else {
    float hit = smoothstep(0.045, 0.075, uCycle) * (1.0 - smoothstep(0.115, 0.215, uCycle));
    float size = 0.105 + 0.025 * hit * uMotion;
    p = contact + vec3((t * 2.0 - 1.0) * size - v * 0.035, v * size * 1.25, -0.035);
    vAlive = hit;
  }
  projectSheet(p);
}
`
export const PFX_REFLECT_BURST_BODY_FRAGMENT = /* glsl */ `
uniform float uCycle;
uniform float uFlare;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uHot;
varying vec2 vUv;
varying float vSeed;
varying float vAlive;
varying float vPart;
void main() {
  float t = vUv.x;
  float v = vUv.y;
  float across = max(0.0, 1.0 - v * v);
  float alpha;
  float hot;
  float highlight = 0.0;
  if (vPart < 0.5) {
    float edge = pow(across, 1.1) * smoothstep(0.0, 0.30, across);
    float body = pow(max(0.0, sin(t * 3.141593)), 0.9);
    // Shallow curved gaps leave the front of the fan connected.
    float cutA = (v + 0.30 + 0.15 * sin(t * 3.2)) * 9.0;
    float cutB = (v - 0.47 + t * t * 0.17) * 11.0;
    float cuts = 1.0 - (0.14 + 0.20 * t) * exp(-cutA * cutA) * smoothstep(0.08, 0.8, t)
      - (0.10 + 0.13 * t) * exp(-cutB * cutB) * (1.0 - smoothstep(0.45, 1.0, t));
    float density = 0.74 + 0.18 * sin(v * 7.0 - t * 3.0);
    alpha = edge * body * max(0.0, cuts) * density * 0.94;
    hot = pow(max(0.0, 1.0 - t), 2.0) * across * 0.58 * uFlare;
  } else {
    float radius = length(vec2(t * 2.0 - 1.0, v));
    float core = 1.0 - smoothstep(0.16, 0.52, radius);
    float shoulder = pow(max(0.0, 1.0 - radius), 1.4);
    alpha = max(shoulder * 0.60, core * (0.70 + 0.28 * uFlare));
    hot = max(core, shoulder) * uFlare;
    highlight = core * 0.45 * uFlare;
  }
  alpha *= vAlive * uOpacity;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(mix(uColor * 0.60, uHot, hot) * (1.0 + highlight), alpha);
  #include <colorspace_fragment>
}
`
const ACCENT_VERTEX = /* glsl */ `${VERTEX_HEADER}
void main() {
  float s = aStrip.w;
  float incoming = 1.0 - step(0.5, aStrip.z);
  float launch = mix(0.105 + s * 0.075, 0.0, incoming);
  float life = mix(0.28 + fract(s * 7.13 + 0.37) * 0.24, 0.085, incoming);
  float tau = (uCycle - launch) / life;
  float t = clamp(tau, 0.0, 1.0);
  float shrink = pow(max(0.0, 1.0 - t), 0.8);
  vAlive = step(0.0, tau) * (1.0 - step(1.0, tau));
  vec3 contact = vec3(0.32, 0.02, 0.14);
  float lane = fract(s * 5.71) * 2.0 - 1.0;
  vec3 direction = vec3(-1.0, 0.42 + lane * 0.16, lane * 0.16);
  vec3 p = contact + direction * (1.0 - exp(-2.5 * t)) * (1.2 + s * 0.50) * uMotion;
  float extent = (0.16 + fract(s * 4.9) * 0.26) * shrink;
  if (incoming > 0.5) {
    direction = vec3(1.0, 0.34, 0.04);
    p = contact - direction * (1.0 - t) * 1.12 * uMotion;
    extent = 0.24 * (0.45 + 0.55 * sin(t * 3.141593));
  }
  p -= direction * aStrip.x * extent * uMotion;
  float width = mix(0.006 + fract(s * 3.91) * 0.012, 0.026, incoming) * shrink * vAlive;
  projectStrip(p, p + direction * 0.01, width);
}
`
export const PFX_REFLECT_BURST_ACCENT_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uFlare;
uniform vec3 uColor;
uniform vec3 uHot;
varying vec2 vUv;
varying float vSeed;
varying float vAlive;
void main() {
  float across = pow(max(0.0, 1.0 - abs(vUv.y)), 1.5);
  float end = smoothstep(0.0, 0.06, vUv.x) * (1.0 - smoothstep(0.6, 1.0, vUv.x));
  float alpha = across * end * vAlive * uOpacity;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(mix(uColor, uHot, across * 0.75 * uFlare), alpha);
  #include <colorspace_fragment>
}
`

function material(part: 'body' | 'accent', opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  const base = new THREE.Color(color)
  const result = new THREE.ShaderMaterial({
    uniforms: {
      uCycle: { value: 0 }, uMotion: { value: 1 }, uFlare: { value: 1 },
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uColor: { value: base }, uHot: { value: base.clone().lerp(new THREE.Color(1, 1, 1), 0.72) },
    },
    vertexShader: part === 'body' ? BODY_VERTEX : ACCENT_VERTEX,
    fragmentShader: part === 'body' ? PFX_REFLECT_BURST_BODY_FRAGMENT : PFX_REFLECT_BURST_ACCENT_FRAGMENT,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.NormalBlending, toneMapped: false,
  })
  result.forceSinglePass = true
  result.userData['fragmentTextureSamples'] = 0
  return result
}

export function createPfxReflectBurstBodyGeometry(): THREE.BufferGeometry { return sheetGeometry(2, 20, 24) }
export function createPfxReflectBurstAccentGeometry(): THREE.BufferGeometry { return sheetGeometry(15, 1, 1) }
export function createPfxReflectBurstBodyMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial { return material('body', opacity, color) }
export function createPfxReflectBurstAccentMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial { return material('accent', opacity, color) }
export function applyPfxReflectBurstUniforms(material: THREE.ShaderMaterial, state: PfxReflectBurstRuntimeState, opacity: number, reducedMotion: boolean): void {
  material.uniforms['uCycle']!.value = state.cycle
  material.uniforms['uMotion']!.value = reducedMotion ? 0.3 : 1
  material.uniforms['uFlare']!.value = reducedMotion ? 0.38 : 1
  material.uniforms['uOpacity']!.value = state.stage === 'rest' ? 0 : THREE.MathUtils.clamp(opacity, 0, 1)
}
