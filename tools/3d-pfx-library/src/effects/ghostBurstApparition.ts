import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

// ghost-burst: torn wisps spiral into one point, a hooded spectral mask
// condenses from its face outward, shrieks, then drifts up and away while
// its tattered shroud curls behind it. The tails tear first and the face
// goes last. Every value comes from one normalized master-cycle position, so
// both layers share one clock and the event retires before the preview
// wraps.

export type PfxGhostBurstStage = 'gather' | 'shriek' | 'haunt' | 'tear' | 'rest'

export interface PfxGhostBurstLifecycle {
  stage: PfxGhostBurstStage
  /** Condense front, 0 = nothing, 1 = whole apparition. Face first. */
  manifest: number
  /** Retirement front, 0 = whole apparition, 1 = gone. Tails first. */
  tear: number
  /** Short rim and eye flare at the shriek. */
  flare: number
  /** Mouth and eye gape. */
  shriek: number
  /** Overall body brightness. */
  energy: number
  /** Body travel in local units. */
  offset: readonly [number, number, number]
  /** Travel direction scaled for the trailing tails. */
  velocity: readonly [number, number, number]
  /** Body roll toward the travel direction, radians. */
  lean: number
  /** Vertical body stretch. */
  stretch: number
  /** Wisp head position on its path: negative = inward spiral, 0 = body, 1 = fully released. */
  wispHead: number
  /** Wisp width multiplier. Additive wisps retire by width. */
  wispWidth: number
  /** Wisp tear amount, 0 = whole ribbons, 1 = fully broken. */
  wispTorn: number
}

export interface PfxGhostBurstRuntimeState extends PfxGhostBurstLifecycle {
  /** Normalized master-cycle position in [0, 1). */
  cycle: number
  /** Decorative clock in seconds. It restarts every cycle. */
  decorativeTime: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (value: number) => {
  const x = clamp01(value)
  return x * x * (3 - 2 * x)
}
const pulse = (u: number, center: number, halfWidth: number) => {
  const x = 1 - Math.abs(u - center) / halfWidth
  return x <= 0 ? 0 : smooth(x)
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t

const GATHER_END = 0.12
const SHRIEK_PEAK = 0.16
const TEAR_START = 0.56
const TEAR_SPAN = 0.28
const REST_START = 0.88

type Vec3 = readonly [number, number, number]
// Travel keys: rises from lower left, lunges at the shriek, then drifts up,
// right and away from the camera.
const PATH: ReadonlyArray<{ u: number; p: Vec3 }> = [
  { u: 0, p: [-0.3, -0.26, 0.16] },
  { u: SHRIEK_PEAK, p: [-0.04, -0.04, 0.1] },
  { u: TEAR_START, p: [0.2, 0.14, -0.1] },
  { u: REST_START, p: [0.36, 0.3, -0.24] },
]

function pathAt(u: number): [number, number, number] {
  const x = clamp01(u)
  for (let index = 1; index < PATH.length; index += 1) {
    const a = PATH[index - 1]!
    const b = PATH[index]!
    if (x <= b.u) {
      const t = smooth((x - a.u) / (b.u - a.u))
      return [mix(a.p[0], b.p[0], t), mix(a.p[1], b.p[1], t), mix(a.p[2], b.p[2], t)]
    }
  }
  const last = PATH[PATH.length - 1]!.p
  return [last[0], last[1], last[2]]
}

const REST: PfxGhostBurstLifecycle = {
  stage: 'rest', manifest: 0, tear: 1, flare: 0, shriek: 0, energy: 0,
  offset: PATH[PATH.length - 1]!.p, velocity: [0, 0, 0], lean: 0, stretch: 1,
  wispHead: 1, wispWidth: 0, wispTorn: 1,
}

export function createPfxGhostBurstLifecycle(cycle: number): PfxGhostBurstLifecycle {
  const u = clamp01(cycle)
  if (u >= REST_START) return REST
  const manifestLinear = clamp01((u - 0.02) / 0.15)
  const manifest = 1 - Math.pow(1 - manifestLinear, 2)
  const tearLinear = clamp01((u - TEAR_START) / TEAR_SPAN)
  const tear = tearLinear * (0.6 + 0.4 * tearLinear)
  const flare = pulse(u, SHRIEK_PEAK, 0.07)
  const shriek = pulse(u, SHRIEK_PEAK + 0.02, 0.1)
  const energy = (0.78 + 0.22 * smooth(u / GATHER_END)) * (1 - 0.25 * tearLinear)
  const offset = pathAt(u)
  const before = pathAt(u - 0.02)
  const after = pathAt(u + 0.02)
  const velocity: [number, number, number] = [
    (after[0] - before[0]) * 2.2,
    (after[1] - before[1]) * 2.2,
    (after[2] - before[2]) * 2.2,
  ]
  const lean = -0.22 * (1 - smooth((u - SHRIEK_PEAK) / 0.3)) + 0.1 * smooth((u - 0.3) / 0.4)
  const stretch = 1 + 0.08 * shriek
  // Wisps spiral in during the gather, then release at the shriek with a
  // drag-like ease-out.
  const wispHead = u < SHRIEK_PEAK
    ? -0.45 * (1 - smooth(u / SHRIEK_PEAK))
    : 1 - Math.pow(1 - clamp01((u - SHRIEK_PEAK) / 0.6), 2.2)
  const wispWidth = u < SHRIEK_PEAK
    ? 0.35 + 0.65 * smooth(u / SHRIEK_PEAK)
    : 1 - smooth((u - SHRIEK_PEAK - 0.08) / 0.52)
  const wispTorn = smooth((u - 0.24) / 0.5)
  const stage: PfxGhostBurstStage = u < GATHER_END
    ? 'gather'
    : u < 0.26
      ? 'shriek'
      : tearLinear <= 0
        ? 'haunt'
        : 'tear'
  return { stage, manifest, tear, flare, shriek, energy, offset, velocity, lean, stretch, wispHead, wispWidth, wispTorn }
}

export function createPfxGhostBurstRuntimeState(
  input: {
    elapsedSeconds: number
    timing: number
    lifetime: number
    tempo: number
    motionMultiplier: number
    cycleScale: number
    reducedMotion: boolean
  },
  target?: PfxGhostBurstRuntimeState,
): PfxGhostBurstRuntimeState {
  // Same master clock as getPfxBurstCycleSeconds.
  const timeScale = Math.max(0.05, input.timing) * input.motionMultiplier * Math.max(0.1, input.tempo)
  const span = Math.max(0.3, Math.max(0.25, input.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER * Math.max(1, input.cycleScale)
  const cycle = ((Math.max(0, input.elapsedSeconds) * timeScale) % span) / span
  const lifecycle = createPfxGhostBurstLifecycle(cycle)
  const decorativeTime = cycle * (span / timeScale) * (input.reducedMotion ? 0.4 : 1)
  const state = target ?? { ...lifecycle, cycle: 0, decorativeTime: 0 }
  Object.assign(state, lifecycle, { cycle, decorativeTime })
  return state
}

const PFX_GHOST_NOISE_GLSL = /* glsl */ `
float pfxGhostHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.17);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float pfxGhostNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(pfxGhostHash(i), pfxGhostHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(pfxGhostHash(i + vec3(0.0, 1.0, 0.0)), pfxGhostHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(pfxGhostHash(i + vec3(0.0, 0.0, 1.0)), pfxGhostHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(pfxGhostHash(i + vec3(0.0, 1.0, 1.0)), pfxGhostHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
`

/** Hood centre and radii. The face mask uses the normalized hood space. */
const HOOD_CENTER: Vec3 = [0, 0.5, 0]
const HOOD_RADII: Vec3 = [0.25, 0.26, 0.24]
const SHROUD_TOP_Y = 0.4
const SHROUD_LENGTH = 1.36
/** Yaw that turns the mask partly toward the three-quarter review camera. */
const BODY_YAW = 0.32

const PFX_GHOST_BODY_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uMotion;
uniform vec3 uOffset;
uniform vec3 uVelocity;
uniform float uLean;
uniform float uStretch;
attribute float aGhostPart;
attribute vec3 aGhostLocal;
varying float vPart;
varying vec3 vGhostLocal;
varying vec3 vNoisePos;
varying vec3 vViewNormal;
varying vec3 vViewPos;

void main() {
  vec3 p = position;
  float shroud = step(0.5, aGhostPart);
  // Tail weight: 0 at the hood, 1 at the hem tips.
  float tail = shroud * smoothstep(0.2, 1.0, aGhostLocal.y);
  float around = aGhostLocal.x * 6.2831853;
  // Tattered hem flutter and a slow curl of the tails around the body axis.
  p.x += sin(uTime * 3.3 + aGhostLocal.y * 7.0 + around * 2.0) * 0.075 * tail * uMotion;
  p.z += cos(uTime * 2.6 + aGhostLocal.y * 6.0 + around * 3.0) * 0.075 * tail * uMotion;
  float twist = tail * tail * (0.85 + 0.3 * sin(uTime * 1.7) * uMotion);
  float ct = cos(twist);
  float st = sin(twist);
  p.xz = vec2(ct * p.x - st * p.z, st * p.x + ct * p.z);
  p.y = 0.2 + (p.y - 0.2) * uStretch;
  float cl = cos(uLean);
  float sl = sin(uLean);
  p.xy = vec2(cl * p.x - sl * p.y, sl * p.x + cl * p.y);
  // The tails trail behind the travel direction.
  p -= uVelocity * tail * tail * 0.6;
  p += uOffset;
  vec4 viewPos = modelViewMatrix * vec4(p, 1.0);
  vPart = aGhostPart;
  vGhostLocal = aGhostLocal;
  vNoisePos = position;
  vViewNormal = normalize(normalMatrix * normal);
  vViewPos = viewPos.xyz;
  gl_Position = projectionMatrix * viewPos;
}
`

export const PFX_GHOST_BODY_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uManifest;
uniform float uTear;
uniform float uFlare;
uniform float uShriek;
uniform float uEnergy;
uniform vec3 uColor;
uniform vec3 uColorCold;
uniform vec3 uColorHot;
varying float vPart;
varying vec3 vGhostLocal;
varying vec3 vNoisePos;
varying vec3 vViewNormal;
varying vec3 vViewPos;
${PFX_GHOST_NOISE_GLSL}

void main() {
  float hood = 1.0 - step(0.5, vPart);
  float slowA = pfxGhostNoise(vNoisePos * 3.4 + vec3(0.0, -uTime * 0.55, 0.0));
  float slowB = pfxGhostNoise(vNoisePos * 7.5 + vec3(uTime * 0.35, -uTime * 1.1, 0.0));
  float field = slowA * 0.65 + slowB * 0.35;

  // Torn hem: tapering tongues of uneven length.
  float hemEdge = 0.0;
  if (hood < 0.5) {
    float a = vGhostLocal.x;
    float tongues = pow(abs(sin(a * 15.70796 + 0.9 * sin(a * 12.56637 + 1.3))), 2.4);
    float lengthVar = 0.72 + 0.28 * sin(a * 18.84956 + 0.4);
    float limit = 0.46 + 0.54 * tongues * lengthVar + (slowB - 0.5) * 0.1;
    if (vGhostLocal.y > limit) discard;
    hemEdge = 1.0 - smoothstep(0.0, 0.06, limit - vGhostLocal.y);
  }

  // Tailness: 0 at the face centre, 1 at the hem tips.
  float tailness = hood > 0.5 ? (1.0 - vGhostLocal.z) * 0.22 : 0.32 + vGhostLocal.y * 0.68;
  float revealMetric = tailness * 0.75 + field * 0.25;
  float revealT = uManifest * 1.12;
  if (revealMetric > revealT) discard;
  float tearMetric = (1.0 - tailness) * 0.56 + field * 0.44;
  float tearT = uTear * 1.06;
  if (tearMetric < tearT) discard;
  float edge = (1.0 - smoothstep(0.0, 0.05, revealT - revealMetric)) * (1.0 - step(0.999, uManifest))
    + (1.0 - smoothstep(0.0, 0.06, tearMetric - tearT)) * step(0.001, uTear);

  vec3 n = normalize(vViewNormal);
  float facing = abs(dot(n, normalize(-vViewPos)));
  float rim = pow(1.0 - facing, 2.1);

  // Face mask on the hood front: slanted hollow eyes and a long, uneven
  // mouth. The hood itself stays violet so the pale mask sits inside it.
  vec3 h = vGhostLocal;
  float front = hood * smoothstep(0.3, 0.75, h.z) * (gl_FrontFacing ? 1.0 : 0.0);
  vec2 f = h.xy;
  vec2 el = f - vec2(-0.31, 0.12);
  el = mat2(0.94, -0.34, 0.34, 0.94) * el;
  vec2 er = f - vec2(0.33, 0.15);
  er = mat2(0.95, 0.31, -0.31, 0.95) * er;
  float eyeL = length(el / vec2(0.21, 0.15 + uShriek * 0.05));
  float eyeR = length(er / vec2(0.19, 0.13 + uShriek * 0.05));
  float eye = min(eyeL, eyeR);
  vec2 m = f - vec2(0.03 + (f.y + 0.42) * 0.18, -0.44 - uShriek * 0.06);
  float mouth = length(m / vec2(0.065 + uShriek * 0.035, 0.16 + uShriek * 0.16));
  float socket = max(1.0 - smoothstep(0.75, 1.0, eye), (1.0 - smoothstep(0.65, 1.0, mouth)) * 0.75) * front;
  float socketRim = exp(-pow((eye - 1.06) / 0.12, 2.0)) * front;
  float pupil = (exp(-eyeL * eyeL * 30.0) + exp(-eyeR * eyeR * 34.0)) * front;
  float mask = front * (1.0 - smoothstep(0.5, 0.95, length(f / vec2(0.74, 0.9))));
  // Below the chin the hood merges into the shroud: no hard outline there.
  float chin = hood * smoothstep(-0.2, -0.75, h.y);
  // The open shroud neck sits inside the hood: hide its rim ring.
  float neck = (1.0 - hood) * (1.0 - smoothstep(0.03, 0.16, vGhostLocal.y));
  rim *= 1.0 - max(chin * 0.85, neck * 0.9);

  float body = 0.08 + field * 0.17 + rim * 0.95 + mask * 0.4;
  body *= 1.0 - socket * 0.95;
  // Where the hood overlaps the shroud, its lower half fades out.
  body *= 1.0 - chin * 0.8;
  body *= gl_FrontFacing ? 1.0 : 0.28;
  float hot = socketRim * 0.32 + pupil * (0.32 + uFlare * 0.7) + hemEdge * 0.16;
  float energy = (body * (1.0 + uFlare * 0.7) + hot + edge * 0.5) * uEnergy;
  float cold = clamp(mask * 0.95 + rim * mix(0.6, 0.3, hood) - (1.0 - hood) * vGhostLocal.y * 0.4 + field * 0.12, 0.0, 1.0);
  vec3 color = mix(uColor, uColorCold, cold);
  color = mix(color, uColorHot, clamp(hot * 0.7 + uFlare * rim * 0.3, 0.0, 1.0));
  color = mix(color, uColorCold, clamp(edge, 0.0, 1.0) * 0.8);
  gl_FragColor = vec4(color * energy, uOpacity);
}
`

/** Ribbons in the wisp layer. */
export const PFX_GHOST_BURST_WISP_COUNT = 7
const WISP_SEGMENTS = 30

const PFX_GHOST_WISP_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uMotion;
uniform float uHead;
uniform float uWidth;
uniform vec3 uOffset;
attribute vec4 aWisp;
varying float vS;
varying float vSeed;
varying float vSide;
varying float vQ;

vec3 pfxWispPath(float q, float index, float seed) {
  float dir = index == 2.0 || index == 5.0 ? -1.0 : 1.0;
  float a0 = seed * 6.2831853 + index * 2.39996;
  float aq = abs(q);
  float angle = a0 + q * (2.1 + seed * 1.2) * dir * uMotion;
  float radius = 0.2 + aq * (q < 0.0 ? 2.1 : 0.95 + seed * 0.4) * uMotion;
  float y0 = -0.42 + fract(seed * 7.13 + index * 0.37) * 0.9;
  float y = y0 + q * (0.45 + seed * 0.45) * uMotion + sin(q * 5.5 + seed * 6.0) * 0.09 * uMotion;
  vec3 p = vec3(cos(angle) * radius, y, sin(angle) * radius * 0.85);
  p.x += sin(uTime * 2.1 + q * 4.0 + seed * 9.0) * 0.05 * aq * uMotion;
  p.y += cos(uTime * 1.7 + q * 3.0 + seed * 5.0) * 0.04 * aq * uMotion;
  return p + uOffset * (0.65 + 0.35 * (1.0 - aq));
}

void main() {
  float index = aWisp.x;
  float s = aWisp.y;
  float side = aWisp.z;
  float seed = aWisp.w;
  float len = 0.28 + seed * 0.16;
  float q = uHead - s * len;
  vec3 c0 = pfxWispPath(q, index, seed);
  vec3 c1 = pfxWispPath(q + 0.01, index, seed);
  vec4 v0 = modelViewMatrix * vec4(c0, 1.0);
  vec4 v1 = modelViewMatrix * vec4(c1, 1.0);
  vec3 tangent = v1.xyz - v0.xyz;
  vec2 t2 = length(tangent.xy) > 1e-5 ? normalize(tangent.xy) : vec2(1.0, 0.0);
  vec2 sideDir = vec2(-t2.y, t2.x);
  float scale = length(modelViewMatrix[0].xyz);
  float taper = pow(sin(3.14159265 * clamp(s, 0.0, 1.0)), 0.55) * (1.0 - s * 0.55);
  float width = (0.042 + seed * 0.03) * taper * uWidth * scale;
  v0.xy += sideDir * side * width;
  vS = s;
  vSeed = seed;
  vSide = side;
  vQ = q;
  gl_Position = projectionMatrix * v0;
}
`

export const PFX_GHOST_WISP_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uTorn;
uniform float uWidth;
uniform vec3 uColor;
uniform vec3 uColorCold;
uniform vec3 uColorHot;
varying float vS;
varying float vSeed;
varying float vSide;
varying float vQ;
${PFX_GHOST_NOISE_GLSL}

void main() {
  if (uWidth <= 0.001) discard;
  // Torn breaks appear along the ribbon and widen as it releases.
  float breaks = pfxGhostNoise(vec3(vS * 7.0 + vSeed * 13.0, vSeed * 5.0, vQ * 2.5));
  if (breaks < uTorn * 0.75 + vS * 0.18 - 0.08) discard;
  float across = 1.0 - abs(vSide);
  float core = pow(across, 1.6);
  float head = exp(-vS * vS / 0.006);
  float energy = (0.22 + core * 0.62) * (1.0 - vS * 0.6) + head * core * 0.9;
  vec3 color = mix(uColorCold, uColor, smoothstep(0.1, 0.85, vS));
  color = mix(color, uColorHot, head * core * 0.8);
  gl_FragColor = vec4(color * energy, uOpacity);
}
`

/** Cold cyan and violet pair derived from one control colour. */
function ghostPalette(color: THREE.ColorRepresentation): { base: THREE.Color; cold: THREE.Color; hot: THREE.Color } {
  const base = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  base.getHSL(hsl)
  // The control colour drives the violet body. The cold rim sits about
  // 0.2 lower on the hue wheel (violet -> cyan), so a new control colour
  // moves both.
  const violet = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.9 + 0.08), Math.min(0.62, hsl.l * 0.85))
  const cold = new THREE.Color().setHSL((hsl.h + 0.8) % 1, Math.min(1, hsl.s * 0.85 + 0.15), Math.min(0.7, hsl.l + 0.04))
  const hot = cold.clone().lerp(new THREE.Color('#f4fbff'), 0.68)
  return { base: violet, cold, hot }
}

const vec3Of = (color: THREE.Color) => new THREE.Vector3(color.r, color.g, color.b)

function finishMaterial(material: THREE.ShaderMaterial, part: 'body' | 'wisps'): THREE.ShaderMaterial {
  material.forceSinglePass = true
  material.userData['pfxGhostBurstMaterial'] = part
  material.userData['pfxGhostBurstDrawCalls'] = 1
  material.userData['pfxGhostBurstParticleCount'] = 0
  material.userData['pfxGhostBurstFragmentTextureSamples'] = 0
  return material
}

export function createPfxGhostBurstBodyMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  const palette = ghostPalette(color)
  return finishMaterial(new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uOffset: { value: new THREE.Vector3() },
      uVelocity: { value: new THREE.Vector3() },
      uLean: { value: 0 },
      uStretch: { value: 1 },
      uManifest: { value: 0 },
      uTear: { value: 0 },
      uFlare: { value: 0 },
      uShriek: { value: 0 },
      uEnergy: { value: 0 },
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uColor: { value: vec3Of(palette.base) },
      uColorCold: { value: vec3Of(palette.cold) },
      uColorHot: { value: vec3Of(palette.hot) },
    },
    vertexShader: PFX_GHOST_BODY_VERTEX,
    fragmentShader: PFX_GHOST_BODY_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), 'body')
}

export function createPfxGhostBurstWispMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  const palette = ghostPalette(color)
  return finishMaterial(new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uHead: { value: 0 },
      uWidth: { value: 0 },
      uTorn: { value: 0 },
      uOffset: { value: new THREE.Vector3() },
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uColor: { value: vec3Of(palette.base) },
      uColorCold: { value: vec3Of(palette.cold) },
      uColorHot: { value: vec3Of(palette.hot) },
    },
    vertexShader: PFX_GHOST_WISP_VERTEX,
    fragmentShader: PFX_GHOST_WISP_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), 'wisps')
}

/** Writes one runtime state into either ghost-burst material. */
export function applyPfxGhostBurstUniforms(
  material: THREE.ShaderMaterial,
  state: PfxGhostBurstRuntimeState,
  opacity: number,
  reducedMotion: boolean,
): void {
  const u = material.uniforms
  // Reduced motion keeps the event, its fronts and its timing. It halves the
  // body travel and reduces the wisp radius, turn, flutter and curl.
  const travel = reducedMotion ? 0.5 : 1
  u.uTime!.value = state.decorativeTime
  u.uMotion!.value = reducedMotion ? 0.3 : 1
  u.uOpacity!.value = state.stage === 'rest' ? 0 : opacity
  ;(u.uOffset!.value as THREE.Vector3).set(state.offset[0] * travel, state.offset[1] * travel, state.offset[2] * travel)
  if (material.userData['pfxGhostBurstMaterial'] === 'body') {
    ;(u.uVelocity!.value as THREE.Vector3).set(state.velocity[0] * travel, state.velocity[1] * travel, state.velocity[2] * travel)
    u.uLean!.value = state.lean * travel
    u.uStretch!.value = state.stretch
    u.uManifest!.value = state.manifest
    u.uTear!.value = state.tear
    u.uFlare!.value = reducedMotion ? state.flare * 0.35 : state.flare
    u.uShriek!.value = state.shriek
    u.uEnergy!.value = state.energy
    return
  }
  u.uHead!.value = state.wispHead
  u.uWidth!.value = state.wispWidth
  u.uTorn!.value = state.wispTorn
}

/**
 * Library-owned apparition: a peaked hood and a long shroud. The shader
 * cuts the torn hem, paints the face mask and erodes both fronts. Each
 * vertex carries its part and a part-local coordinate.
 */
export function createPfxGhostBurstBodyGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const parts: number[] = []
  const locals: number[] = []
  const indices: number[] = []
  const yaw = new THREE.Matrix4().makeRotationY(BODY_YAW)
  const normalYaw = new THREE.Matrix3().getNormalMatrix(yaw)

  const append = (geometry: THREE.BufferGeometry, part: number, local: (index: number) => [number, number, number]) => {
    const base = positions.length / 3
    geometry.computeVertexNormals()
    const position = geometry.getAttribute('position')
    const normal = geometry.getAttribute('normal')
    const point = new THREE.Vector3()
    const n = new THREE.Vector3()
    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index).applyMatrix4(yaw)
      n.fromBufferAttribute(normal, index).applyMatrix3(normalYaw).normalize()
      positions.push(point.x, point.y, point.z)
      normals.push(n.x, n.y, n.z)
      parts.push(part)
      locals.push(...local(index))
    }
    const index = geometry.getIndex()!
    for (let i = 0; i < index.count; i += 1) indices.push(base + index.getX(i))
    geometry.dispose()
  }

  // Hood: a sphere with a swept-back peak. Local = unit-sphere direction.
  const hood = new THREE.SphereGeometry(1, 36, 28)
  const unit: Array<[number, number, number]> = []
  const hoodPosition = hood.getAttribute('position')
  for (let index = 0; index < hoodPosition.count; index += 1) {
    const x = hoodPosition.getX(index)
    const y = hoodPosition.getY(index)
    const z = hoodPosition.getZ(index)
    unit.push([x, y, z])
    const top = Math.max(0, y)
    hoodPosition.setXYZ(
      index,
      HOOD_CENTER[0] + x * HOOD_RADII[0],
      HOOD_CENTER[1] + y * HOOD_RADII[1] + 0.05 * top * top * top,
      HOOD_CENTER[2] + z * HOOD_RADII[2] - 0.13 * top * top,
    )
  }
  append(hood, 0, (index) => unit[index]!)

  // Shroud: rows from the neck to the hem tips. Local = (around, down, 0).
  const columns = 48
  const rows = 30
  const shroudPositions: number[] = []
  const shroudLocals: Array<[number, number, number]> = []
  const shroudIndex: number[] = []
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows
    const widen = Math.sin(Math.min(1, v / 0.68) * Math.PI / 2)
    const radius = 0.19 + 0.33 * widen - 0.12 * smooth((v - 0.72) / 0.28)
    const y = SHROUD_TOP_Y - v * SHROUD_LENGTH
    for (let column = 0; column <= columns; column += 1) {
      const around = column / columns
      const angle = around * Math.PI * 2
      shroudPositions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius * 0.82 - 0.1 * v * v)
      shroudLocals.push([around, v, 0])
    }
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column
      const b = a + columns + 1
      shroudIndex.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const shroud = new THREE.BufferGeometry()
  shroud.setAttribute('position', new THREE.Float32BufferAttribute(shroudPositions, 3))
  shroud.setIndex(shroudIndex)
  append(shroud, 1, (index) => shroudLocals[index]!)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('aGhostPart', new THREE.Float32BufferAttribute(parts, 1))
  geometry.setAttribute('aGhostLocal', new THREE.Float32BufferAttribute(locals, 3))
  geometry.setIndex(indices)
  // The vertex shader travels and bends the body. Bound the full travel.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.6)
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-1.2, -1.4, -1.2), new THREE.Vector3(1.2, 1.4, 1.2))
  geometry.userData['pfxGhostBurstGeometry'] = 'body'
  geometry.userData['pfxGhostBurstTriangles'] = indices.length / 3
  return geometry
}

/** Camera-facing ribbon strips. The vertex shader owns every position. */
export function createPfxGhostBurstWispGeometry(): THREE.BufferGeometry {
  const wisp: number[] = []
  const indices: number[] = []
  for (let ribbon = 0; ribbon < PFX_GHOST_BURST_WISP_COUNT; ribbon += 1) {
    // Deterministic per-ribbon seed from the golden ratio.
    const seed = (ribbon * 0.618034 + 0.137) % 1
    const base = wisp.length / 4
    for (let segment = 0; segment <= WISP_SEGMENTS; segment += 1) {
      const s = segment / WISP_SEGMENTS
      wisp.push(ribbon, s, -1, seed, ribbon, s, 1, seed)
    }
    for (let segment = 0; segment < WISP_SEGMENTS; segment += 1) {
      const a = base + segment * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const geometry = new THREE.BufferGeometry()
  const count = wisp.length / 4
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3))
  geometry.setAttribute('aWisp', new THREE.Float32BufferAttribute(wisp, 4))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2)
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-2, -2, -2), new THREE.Vector3(2, 2, 2))
  geometry.userData['pfxGhostBurstGeometry'] = 'wisps'
  geometry.userData['pfxGhostBurstTriangles'] = indices.length / 3
  return geometry
}
