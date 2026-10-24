import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

export interface PfxDashBurstRuntimeState {
  cycle: number
  stage: 'onset' | 'shear' | 'release' | 'rest'
}

export function createPfxDashBurstRuntimeState(
  input: { elapsedSeconds: number; timing: number; lifetime: number; tempo: number; motionMultiplier: number; cycleScale: number; reducedMotion: boolean },
  target?: PfxDashBurstRuntimeState,
): PfxDashBurstRuntimeState {
  const rate = Math.max(0.05, input.timing) * input.motionMultiplier * Math.max(0.1, input.tempo)
  const span = Math.max(0.3, Math.max(0.25, input.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER * Math.max(1, input.cycleScale)
  const cycle = ((Math.max(0, input.elapsedSeconds) * rate) % span) / span
  const state = target ?? { cycle: 0, stage: 'rest' }
  state.cycle = cycle
  state.stage = cycle >= 0.84 ? 'rest' : cycle < 0.11 ? 'onset' : cycle < 0.3 ? 'shear' : 'release'
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
float head() {
  return -0.37 + (1.0 - exp(-3.2 * uCycle)) * 1.86 * uMotion;
}
void main() {
  float t = aStrip.x;
  float v = aStrip.y;
  float open = smoothstep(0.0, 0.17, uCycle);
  float retire = 1.0 - smoothstep(0.28, 0.74, uCycle);
  vAlive = (0.8 + 0.2 * smoothstep(0.0, 0.025, uCycle)) * retire;
  float width = 0.16 + 0.39 * open * uMotion;
  vec3 p;
  if (aStrip.z < 0.5) {
    // The full wake joins the curved pressure front.
    float reach = (0.18 + 1.52 * open) * uMotion;
    float taper = pow(max(0.0, 1.0 - t), 0.72);
    p = vec3(head() - 0.12 - t * reach - v * v * 0.28 * (1.0 - t),
      v * width * taper * (1.0 + 0.16 * v) + 0.10 * t * t * uMotion,
      0.08 * v + sin(t * 2.9) * 0.15 * uMotion);
  } else if (aStrip.z < 1.5) {
    p = vec3(head() - v * v * 0.36 - t * (0.19 + 0.13 * open * uMotion),
      v * width * (1.0 + 0.10 * v), 0.08 * v - 0.035);
  } else {
    float size = 0.16 * (1.0 - smoothstep(0.0, 0.12, uCycle)) * uMotion;
    p = vec3(head() - 0.04 + (t * 2.0 - 1.0) * size, v * size * 1.12, -0.05);
    vAlive = 1.0 - smoothstep(0.035, 0.12, uCycle);
  }
  projectSheet(p);
}
`
export const PFX_DASH_BURST_BODY_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uCycle;
uniform float uMotion;
uniform float uFlare;
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
  float edge = smoothstep(0.0, 0.5, across);
  float grain = sin(t * 12.0 + v * 5.0) * sin(v * 9.0 - t * 4.0);
  float alpha;
  float hot;
  if (vPart < 0.5) {
    float flow = 0.62 + 0.19 * sin(v * 8.0 + t * 3.3) + 0.12 * grain;
    float erosion = smoothstep(0.0, 0.25, across - t * (0.18 + 0.12 * grain));
    float tail = pow(max(0.0, 1.0 - t), 1.65);
    alpha = edge * erosion * flow * tail * 0.60;
    hot = 0.08 + 0.24 * tail * pow(across, 3.0);
  } else if (vPart < 1.5) {
    float front = pow(max(0.0, sin(t * 3.141593)), 1.4);
    float scallop = 0.88 + 0.12 * sin(v * 11.0 + t * 2.0);
    alpha = edge * front * scallop * 0.88;
    hot = pow(max(0.0, 1.0 - abs(t - 0.32) * 2.4), 3.0) * pow(across, 0.6) * 0.82 * uFlare;
  } else {
    float radius = length(vec2(t * 2.0 - 1.0, v));
    alpha = pow(max(0.0, 1.0 - radius), 1.7) * 0.92;
    hot = alpha * uFlare;
  }
  alpha *= vAlive * uOpacity;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(mix(uColor * 0.64, uHot, hot), alpha);
  #include <colorspace_fragment>
}
`
const ACCENT_VERTEX = /* glsl */ `${VERTEX_HEADER}
void main() {
  float s = aStrip.w;
  float launch = 0.025 + s * 0.16;
  float life = 0.27 + fract(s * 7.13) * 0.25;
  float tau = (uCycle - launch) / life;
  float t = clamp(tau, 0.0, 1.0);
  float shrink = pow(max(0.0, 1.0 - t), 0.8);
  vAlive = step(0.0, tau) * (1.0 - step(1.0, tau));
  float lead = -0.37 + (1.0 - exp(-3.2 * uCycle)) * 1.86 * uMotion;
  float lag = (0.27 + s * 0.62 + t * 0.44) * uMotion + 0.14;
  float lane = fract(s * 7.3) * 2.0 - 1.0;
  vec3 p = vec3(lead - lag - aStrip.x * (0.17 + s * 0.25) * shrink * uMotion,
    lane * (0.13 + 0.29 * smoothstep(0.0, 0.2, uCycle) * uMotion),
    (fract(s * 3.9) - 0.5) * 0.28);
  float width = (0.004 + fract(s * 4.71) * 0.009) * shrink * vAlive;
  projectStrip(p, p + vec3(0.01, 0.0, 0.0), width);
}
`
export const PFX_DASH_BURST_ACCENT_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uFlare;
uniform vec3 uColor;
uniform vec3 uHot;
varying vec2 vUv;
varying float vSeed;
varying float vAlive;
void main() {
  float across = pow(max(0.0, 1.0 - abs(vUv.y)), 1.6);
  float tip = smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.5, 1.0, vUv.x));
  float alpha = across * tip * vAlive * uOpacity;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(mix(uColor, uHot, across * 0.65 * uFlare), alpha);
  #include <colorspace_fragment>
}
`

function material(part: 'body' | 'accent', opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  const base = new THREE.Color(color)
  const result = new THREE.ShaderMaterial({
    uniforms: {
      uCycle: { value: 0 }, uMotion: { value: 1 }, uFlare: { value: 1 },
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uColor: { value: base }, uHot: { value: base.clone().lerp(new THREE.Color(1, 1, 1), 0.65) },
    },
    vertexShader: part === 'body' ? BODY_VERTEX : ACCENT_VERTEX,
    fragmentShader: part === 'body' ? PFX_DASH_BURST_BODY_FRAGMENT : PFX_DASH_BURST_ACCENT_FRAGMENT,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.NormalBlending, toneMapped: false,
  })
  result.forceSinglePass = true
  result.userData['fragmentTextureSamples'] = 0
  return result
}

export function createPfxDashBurstBodyGeometry(): THREE.BufferGeometry { return sheetGeometry(3, 24, 20) }
export function createPfxDashBurstAccentGeometry(): THREE.BufferGeometry { return sheetGeometry(19, 1, 1) }
export function createPfxDashBurstBodyMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial { return material('body', opacity, color) }
export function createPfxDashBurstAccentMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial { return material('accent', opacity, color) }
export function applyPfxDashBurstUniforms(material: THREE.ShaderMaterial, state: PfxDashBurstRuntimeState, opacity: number, reducedMotion: boolean): void {
  material.uniforms['uCycle']!.value = state.cycle
  material.uniforms['uMotion']!.value = reducedMotion ? 0.3 : 1
  material.uniforms['uFlare']!.value = reducedMotion ? 0.38 : 1
  material.uniforms['uOpacity']!.value = state.stage === 'rest' ? 0 : THREE.MathUtils.clamp(opacity, 0, 1)
}
