import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

// warp-burst: a disc of space lattice pinches toward an off-centre crease,
// then snaps into an asymmetric Z-fold. One half rolls over toward the
// viewer, the other half dips back, and the two halves shear in opposite
// directions along the crease. Traces release from the crease along the
// shear, curve, slow down and shrink away. The lattice tears from the
// crease outward. Every value comes from one normalized master-cycle
// position, so both layers share one clock and the event retires before
// the preview wraps.
//
// This is a geometric fold of a drawn lattice. It does not sample the
// scene colour, so it makes no claim of real screen refraction.

export type PfxWarpBurstStage = 'compress' | 'fold' | 'release' | 'rest'

export interface PfxWarpBurstLifecycle {
  stage: PfxWarpBurstStage
  /** Inward pull of the whole lattice before the pinch, 1 -> 0. */
  approach: number
  /** Pinch toward the crease, 0..1. */
  compress: number
  /** Fold amount. 1 = peak fold; it overshoots a little and keeps rolling. */
  fold: number
  /** Opposite slide of the two halves along the crease, 0..1. */
  shear: number
  /** Short crease flare at the fold peak. */
  flare: number
  /** Lattice tear front, 0 = whole sheet, 1 = gone. Crease first. */
  tear: number
  /** Overall lattice brightness. */
  energy: number
}

export interface PfxWarpBurstRuntimeState extends PfxWarpBurstLifecycle {
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
/** Ease-out with a small overshoot past 1. */
const backOut = (value: number) => {
  const x = clamp01(value) - 1
  return 1 + 2.4 * x * x * x + 1.4 * x * x
}

const COMPRESS_START = 0.02
const FOLD_START = 0.16
const FOLD_PEAK = 0.205
const TEAR_START = 0.24
const TEAR_END = 0.6
/** Traces are gone by about 0.8; nothing draws after this point. */
const REST_START = 0.86

const REST: PfxWarpBurstLifecycle = {
  stage: 'rest', approach: 0, compress: 0, fold: 0, shear: 0, flare: 0, tear: 1, energy: 0,
}

export function createPfxWarpBurstLifecycle(cycle: number): PfxWarpBurstLifecycle {
  const u = clamp01(cycle)
  if (u >= REST_START) return REST
  const gather = clamp01((u - COMPRESS_START) / (FOLD_START - COMPRESS_START))
  // The pinch accelerates into the fold, then springs back out of it.
  const compress = u < FOLD_START ? gather * gather : 1 - smooth((u - FOLD_START) / 0.12)
  const approach = 1 - smooth(gather)
  // A sharp snap to most of the fold, then a slower roll that keeps the
  // flap swinging toward the viewer while the lattice tears.
  const fold = u < FOLD_START
    ? 0
    : 0.6 * backOut((u - FOLD_START) / (FOLD_PEAK - FOLD_START)) + 0.4 * smooth((u - 0.2) / 0.26)
  const shearLinear = clamp01((u - FOLD_START) / 0.2)
  const shear = 1 - Math.pow(1 - shearLinear, 3)
  const flare = pulse(u, FOLD_PEAK, 0.05)
  const tearLinear = clamp01((u - TEAR_START) / (TEAR_END - TEAR_START))
  const tear = tearLinear * (0.55 + 0.45 * tearLinear)
  const energy = smooth(u / 0.08) * (0.55 + 0.45 * Math.min(1, gather * 1.2)) * (1 - 0.25 * tearLinear)
  const stage: PfxWarpBurstStage = u < FOLD_START ? 'compress' : u < TEAR_START ? 'fold' : 'release'
  return { stage, approach, compress, fold, shear, flare, tear, energy }
}

export function createPfxWarpBurstRuntimeState(
  input: {
    elapsedSeconds: number
    timing: number
    lifetime: number
    tempo: number
    motionMultiplier: number
    cycleScale: number
    reducedMotion: boolean
  },
  target?: PfxWarpBurstRuntimeState,
): PfxWarpBurstRuntimeState {
  // Same master clock as getPfxBurstCycleSeconds.
  const timeScale = Math.max(0.05, input.timing) * input.motionMultiplier * Math.max(0.1, input.tempo)
  const span = Math.max(0.3, Math.max(0.25, input.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER * Math.max(1, input.cycleScale)
  const cycle = ((Math.max(0, input.elapsedSeconds) * timeScale) % span) / span
  const lifecycle = createPfxWarpBurstLifecycle(cycle)
  const decorativeTime = cycle * (span / timeScale) * (input.reducedMotion ? 0.4 : 1)
  const state = target ?? { ...lifecycle, cycle: 0, decorativeTime: 0 }
  Object.assign(state, lifecycle, { cycle, decorativeTime })
  return state
}

/** Sheet radius in local units. */
const SHEET_RADIUS = 0.74
/** Lattice cell size in local units. */
const LATTICE_CELL = 0.105

// Shared fold space. The crease runs along `t` at a shallow diagonal and sits
// a little above the centre, so the two halves are unequal. The upper half
// (d > 0) rolls toward the viewer and over; the lower half dips back. The
// halves slide in opposite directions along the crease. `uMotion` scales the
// travel and turn distances (reduced motion).
const PFX_WARP_FOLD_GLSL = /* glsl */ `
const float WARP_RADIUS = ${SHEET_RADIUS.toFixed(3)};
const float WARP_CREASE_ANGLE = 0.46;
const float WARP_CREASE_OFFSET = 0.07;
const float WARP_YAW = 0.42;
const float WARP_PITCH = -0.16;

vec2 pfxWarpBend(float a, float theta, float len) {
  if (abs(theta) < 0.001) return vec2(a, 0.0);
  float r = len / theta;
  float phi = theta * min(a, len) / len;
  vec2 p = vec2(r * sin(phi), r * (1.0 - cos(phi)));
  float rest = max(0.0, a - len);
  return p + rest * vec2(cos(theta), sin(theta));
}

// q = (along crease, across crease) in local units. Returns local position.
vec3 pfxWarpFold(vec2 q, float approach, float compress, float fold, float shear, float motion) {
  // Approach: the whole lattice contracts inward before the pinch.
  float spread = 1.0 + 0.18 * approach * motion;
  float s = q.x * spread;
  float d = (q.y + WARP_CREASE_OFFSET) * spread - WARP_CREASE_OFFSET;
  // Pinch: the lattice gathers toward the crease and sinks into a dimple.
  float k = compress * motion;
  float well = exp(-(s * s + d * d) / 0.14);
  d *= 1.0 - 0.45 * k * exp(-d * d / 0.18);
  s *= 1.0 - 0.16 * k * exp(-s * s / 0.25);
  float z = -0.24 * k * well;
  float side = d >= 0.0 ? 1.0 : -1.0;
  float ad = abs(d);
  // Shear: the halves slide apart along the crease.
  s += side * shear * motion * 0.17 * smoothstep(0.0, 0.16, ad) * (side > 0.0 ? 1.0 : 0.75);
  // Asymmetric Z-fold with a tight roll above and a wide dip below.
  float theta = side > 0.0 ? 1.55 * fold * motion : -0.62 * fold * motion;
  float len = side > 0.0 ? 0.2 : 0.3;
  vec2 bent = pfxWarpBend(ad, theta, len);
  float x = side * bent.x + WARP_CREASE_OFFSET;
  z += bent.y;
  // The crease turns a little as it shears.
  float angle = WARP_CREASE_ANGLE + 0.2 * shear * motion;
  vec2 t = vec2(cos(angle), sin(angle));
  vec2 n = vec2(-t.y, t.x);
  vec3 p = vec3(t * s + n * x, z);
  float cy = cos(WARP_YAW);
  float sy = sin(WARP_YAW);
  float cp = cos(WARP_PITCH);
  float sp = sin(WARP_PITCH);
  p = vec3(p.x, cp * p.y - sp * p.z, sp * p.y + cp * p.z);
  return vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
}

// Sheet parameter (unit disc) to crease space.
vec2 pfxWarpCreaseSpace(vec2 disc) {
  vec2 p = disc * WARP_RADIUS;
  vec2 t = vec2(cos(WARP_CREASE_ANGLE), sin(WARP_CREASE_ANGLE));
  vec2 n = vec2(-t.y, t.x);
  return vec2(dot(p, t), dot(p, n) - WARP_CREASE_OFFSET);
}

float pfxWarpHash(vec2 p) {
  p = fract(p * vec2(0.3183099, 0.3678794) + 0.17);
  p *= 17.0;
  return fract(p.x * p.y * (p.x + p.y));
}
float pfxWarpNoise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(pfxWarpHash(i), pfxWarpHash(i + vec2(1.0, 0.0)), f.x),
             mix(pfxWarpHash(i + vec2(0.0, 1.0)), pfxWarpHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`

const PFX_WARP_SHEET_VERTEX = /* glsl */ `
uniform float uApproach;
uniform float uCompress;
uniform float uFold;
uniform float uShear;
uniform float uMotion;
attribute vec2 aWarpDisc;
varying vec2 vDisc;
varying vec2 vQ;
varying vec3 vViewPos;
varying float vDepth;
${PFX_WARP_FOLD_GLSL}

void main() {
  vec2 q = pfxWarpCreaseSpace(aWarpDisc);
  vec3 p = pfxWarpFold(q, uApproach, uCompress, uFold, uShear, uMotion);
  vec4 viewPos = modelViewMatrix * vec4(p, 1.0);
  vDisc = aWarpDisc;
  vQ = q;
  vViewPos = viewPos.xyz;
  // Signed depth from the sheet centre, in local units: + is nearer the viewer.
  vDepth = (viewPos.z - (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).z) / max(1e-4, length(modelViewMatrix[0].xyz));
  gl_Position = projectionMatrix * viewPos;
}
`

export const PFX_WARP_SHEET_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uEnergy;
uniform float uCompress;
uniform float uFold;
uniform float uFlare;
uniform float uTear;
uniform vec3 uColor;
uniform vec3 uColorDeep;
uniform vec3 uColorHot;
varying vec2 vDisc;
varying vec2 vQ;
varying vec3 vViewPos;
varying float vDepth;
${PFX_WARP_FOLD_GLSL}

float pfxWarpLines(vec2 g, float widthPx) {
  vec2 dist = abs(fract(g - 0.5) - 0.5) / max(fwidth(g), vec2(1e-4));
  float line = 1.0 - clamp(min(dist.x, dist.y) / widthPx, 0.0, 1.0);
  return line * line;
}

void main() {
  float grain = pfxWarpNoise(vDisc * 4.2 + vec2(uTime * 0.6, -uTime * 0.4));
  float fine = pfxWarpNoise(vDisc * 11.0 - vec2(uTime * 0.9, uTime * 0.3));
  // Soft, uneven outer boundary: the lattice thins out instead of ending on a rim.
  float r = length(vDisc) + (grain - 0.5) * 0.3;
  float edge = 1.0 - smoothstep(0.5, 1.0, r);
  if (edge <= 0.0) discard;

  // Tear front: starts on the crease and moves out over both halves.
  // Strip noise stretched along the crease: the lattice peels into strips
  // that point along the shear.
  float strips = pfxWarpNoise(vec2(vQ.x * 2.2, vQ.y * 16.0));
  float tearMetric = abs(vQ.y) / WARP_RADIUS * 0.8 + strips * 0.3 + grain * 0.08;
  float tearT = uTear * 1.2;
  if (uTear > 0.0 && tearMetric < tearT) discard;
  float tearEdge = step(0.001, uTear) * (1.0 - smoothstep(0.0, 0.035, tearMetric - tearT));

  vec2 g = vQ / ${LATTICE_CELL.toFixed(3)};
  float line = pfxWarpLines(g, 1.5);
  // A second, offset copy of the lattice opens at the fold: a split image of
  // the bent space, drawn in the deep tone.
  vec2 split = vec2(0.16, -0.1) * (uFold * 0.9 + uCompress * 0.3);
  float ghost = pfxWarpLines(g + split, 1.2) * (1.0 - line);
  vec2 cell = abs(fract(g - 0.5) - 0.5);
  float halo = exp(-pow(min(cell.x, cell.y) / 0.09, 2.0));

  vec3 n = normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));
  float facing = abs(dot(n, normalize(-vViewPos)));
  float glancing = pow(1.0 - facing, 2.2);

  // The crease is brightest at its middle and broken into uneven beads, so
  // it never reads as one long uniform line.
  float beads = 0.45 + 0.55 * pfxWarpNoise(vec2(vQ.x * 9.0 - uTime * 2.0, 3.7));
  float creaseSpan = exp(-vQ.x * vQ.x / 0.09) * beads;
  float crease = exp(-pow(vQ.y / 0.03, 2.0)) * creaseSpan;
  float creaseGlow = exp(-pow(vQ.y / 0.1, 2.0)) * creaseSpan;
  float back = gl_FrontFacing ? 1.0 : 0.0;
  // Depth tone: parts that fold toward the viewer brighten; parts that sink
  // away dim and cool. This carries the fold depth without lighting.
  float near = clamp(vDepth * 3.2, -1.0, 1.0);

  float body = line * 0.95 + halo * 0.2 + ghost * 0.45 + 0.03 + glancing * (0.12 + 0.3 * uFold);
  body *= edge * mix(0.6, 1.0, back) * (1.0 + 0.7 * near);
  float hot = crease * (0.6 * uCompress + 0.95 * uFlare) + creaseGlow * (0.3 * uCompress + 0.3 * uFlare);
  float energy = body * uEnergy + hot + tearEdge * 0.45 * edge;

  vec3 color = mix(uColor, uColorDeep, clamp(ghost * 1.4 + (1.0 - back) * 0.55 + (1.0 - edge) * 0.4 + max(0.0, -near) * 0.8, 0.0, 1.0));
  color = mix(color, uColorHot, max(0.0, near) * 0.35);
  color = mix(color, uColorHot, clamp(hot * 0.8 + tearEdge * 0.6 + line * glancing * 0.5, 0.0, 1.0));
  gl_FragColor = vec4(color * energy, uOpacity);
}
`

/** Traces released along the shear. The first group leaves the upper half. */
export const PFX_WARP_BURST_TRACE_COUNT = 40
const TRACE_UPPER_COUNT = 23
const TRACE_SEGMENTS = 8

const PFX_WARP_TRACE_VERTEX = /* glsl */ `
uniform float uCycle;
uniform float uMotion;
uniform float uApproach;
uniform float uCompress;
uniform float uShearPeak;
attribute vec4 aTrace;
attribute vec4 aTraceSeed;
varying float vA;
varying float vSide;
varying float vHot;
varying float vVisible;
${PFX_WARP_FOLD_GLSL}

struct WarpTrace {
  vec3 origin;
  vec3 dir;
  vec3 axis;
  float speed;
  float curl;
};

vec3 pfxTracePath(float tau, WarpTrace trace) {
  // Drag: fast exit, then the trace slows down.
  float travel = trace.speed * (1.0 - exp(-3.2 * tau)) / 3.2;
  float turn = trace.curl * tau;
  vec3 bent = trace.dir * cos(turn) + cross(trace.axis, trace.dir) * sin(turn);
  return trace.origin + mix(trace.dir, bent, 0.6) * travel;
}

void main() {
  float a = aTrace.y;
  float side = aTrace.z;
  float halfSide = aTrace.w;
  float seed = aTraceSeed.x;
  float s0 = aTraceSeed.y;
  float d0 = aTraceSeed.z;
  float lifeSeed = aTraceSeed.w;

  float launch = 0.185 + seed * 0.07;
  float life = 0.3 + lifeSeed * 0.24;
  float tau = (uCycle - launch) / life;
  float tailA = min(1.0, a + 0.12);

  vec3 here;
  vec3 behind;
  float width;
  float hot;
  float visible = 1.0;
  if (tau < 0.0) {
    // Compression: short motes fall toward the crease from both sides.
    float gather = clamp((uCycle - 0.02) / 0.15, 0.0, 1.0);
    float reach = (0.48 - 0.38 * gather * gather) * (0.75 + seed * 0.5);
    float lag = 0.06 * (0.4 + gather);
    float s = s0 * (1.0 - 0.25 * gather);
    here = pfxWarpFold(vec2(s, d0 + halfSide * (reach + lag * a)), uApproach, uCompress, 0.0, 0.0, uMotion);
    behind = pfxWarpFold(vec2(s, d0 + halfSide * (reach + lag * tailA)), uApproach, uCompress, 0.0, 0.0, uMotion);
    width = 0.01 * smoothstep(0.03, 0.12, uCycle) * step(seed, 0.72);
    hot = 0.2;
    visible = 0.6;
  } else {
    // Release from the folded crease along the shear of its own half.
    vec2 q = vec2(s0, d0 + halfSide * 0.03);
    vec3 origin = pfxWarpFold(q, 0.0, 0.0, 1.0, uShearPeak, uMotion);
    vec3 along = pfxWarpFold(q + vec2(0.05, 0.0), 0.0, 0.0, 1.0, uShearPeak, uMotion) - origin;
    vec3 across = pfxWarpFold(q + vec2(0.0, halfSide * 0.05), 0.0, 0.0, 1.0, uShearPeak, uMotion) - origin;
    vec3 t = normalize(along);
    vec3 nrm = normalize(cross(along, across));
    float spread = fract(seed * 7.31) - 0.5;
    WarpTrace trace;
    trace.origin = origin;
    trace.dir = normalize(t * halfSide * (1.0 + 0.2 * lifeSeed) + normalize(across) * (0.1 + 0.16 * spread) + nrm * (0.08 + 0.2 * fract(seed * 3.7)));
    trace.axis = nrm;
    trace.speed = (1.45 + seed * 1.25) * (halfSide > 0.0 ? 0.85 : 0.88) * uMotion;
    trace.curl = halfSide * (0.3 + lifeSeed * 0.35) * uMotion;
    // Tail lag in normalized life. The trace shortens as it slows.
    float lag = (0.12 + 0.1 * lifeSeed) * (1.0 - tau * 0.55);
    here = pfxTracePath(max(0.0, tau - lag * a), trace);
    behind = pfxTracePath(max(0.0, tau - lag * tailA), trace);
    // Additive traces retire by width and length, never by fading.
    width = (0.018 + 0.02 * fract(seed * 5.3)) * pow(clamp(1.0 - tau, 0.0, 1.0), 0.85);
    hot = 1.0 - smoothstep(0.0, 0.5, tau);
  }
  if (tau > 1.0) width = 0.0;

  vec4 v0 = modelViewMatrix * vec4(here, 1.0);
  vec4 v1 = modelViewMatrix * vec4(behind, 1.0);
  vec2 tangent = v0.xy - v1.xy;
  vec2 t2 = length(tangent) > 1e-5 ? normalize(tangent) : vec2(1.0, 0.0);
  vec2 sideDir = vec2(-t2.y, t2.x);
  float scale = length(modelViewMatrix[0].xyz);
  float taper = pow(1.0 - a, 0.65) * smoothstep(0.0, 0.08, a + 0.02);
  v0.xy += sideDir * side * width * taper * scale;
  vA = a;
  vSide = side;
  vHot = hot;
  vVisible = visible;
  gl_Position = projectionMatrix * v0;
}
`

export const PFX_WARP_TRACE_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorDeep;
uniform vec3 uColorHot;
varying float vA;
varying float vSide;
varying float vHot;
varying float vVisible;

void main() {
  float across = 1.0 - abs(vSide);
  float core = pow(across, 1.5);
  float head = exp(-vA * vA / 0.012);
  float energy = ((0.45 + core * 1.0) * (1.0 - vA * 0.6) + head * core * 0.9) * vVisible;
  vec3 color = mix(uColor, uColorDeep, smoothstep(0.25, 1.0, vA));
  color = mix(color, uColorHot, clamp(head * core * (0.4 + vHot * 0.6), 0.0, 1.0));
  gl_FragColor = vec4(color * energy, uOpacity);
}
`

/** Base, deep and hot tones derived from one control colour. */
function warpPalette(color: THREE.ColorRepresentation): { base: THREE.Color; deep: THREE.Color; hot: THREE.Color } {
  const source = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  source.getHSL(hsl)
  // The control colour drives the lattice. The deep tone sits 0.1 further
  // round the hue wheel (blue -> indigo) and darker; the hot tone is the
  // control colour lifted toward white. A new control colour moves all three.
  const base = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.95 + 0.05), Math.min(0.62, Math.max(0.42, hsl.l * 0.9)))
  const deep = new THREE.Color().setHSL((hsl.h + 0.1) % 1, Math.min(1, hsl.s * 0.9 + 0.1), Math.min(0.5, Math.max(0.3, hsl.l * 0.62)))
  const hot = base.clone().lerp(new THREE.Color('#f6faff'), 0.6)
  return { base, deep, hot }
}

const vec3Of = (color: THREE.Color) => new THREE.Vector3(color.r, color.g, color.b)

function finishMaterial(material: THREE.ShaderMaterial, part: 'sheet' | 'traces'): THREE.ShaderMaterial {
  material.forceSinglePass = true
  material.userData['pfxWarpBurstMaterial'] = part
  material.userData['pfxWarpBurstFragmentTextureSamples'] = 0
  return material
}

function paletteUniforms(opacity: number, color: THREE.ColorRepresentation) {
  const palette = warpPalette(color)
  return {
    uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
    uColor: { value: vec3Of(palette.base) },
    uColorDeep: { value: vec3Of(palette.deep) },
    uColorHot: { value: vec3Of(palette.hot) },
  }
}

export function createPfxWarpBurstSheetMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return finishMaterial(new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uApproach: { value: 1 },
      uCompress: { value: 0 },
      uFold: { value: 0 },
      uShear: { value: 0 },
      uFlare: { value: 0 },
      uTear: { value: 0 },
      uEnergy: { value: 0 },
      ...paletteUniforms(opacity, color),
    },
    vertexShader: PFX_WARP_SHEET_VERTEX,
    fragmentShader: PFX_WARP_SHEET_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), 'sheet')
}

export function createPfxWarpBurstTraceMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return finishMaterial(new THREE.ShaderMaterial({
    uniforms: {
      uCycle: { value: 0 },
      uMotion: { value: 1 },
      uApproach: { value: 1 },
      uCompress: { value: 0 },
      uShearPeak: { value: 1 },
      ...paletteUniforms(opacity, color),
    },
    vertexShader: PFX_WARP_TRACE_VERTEX,
    fragmentShader: PFX_WARP_TRACE_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), 'traces')
}

/** Writes one runtime state into either warp-burst material. */
export function applyPfxWarpBurstUniforms(
  material: THREE.ShaderMaterial,
  state: PfxWarpBurstRuntimeState,
  opacity: number,
  reducedMotion: boolean,
): void {
  const u = material.uniforms
  // Reduced motion keeps the event and its timing. It cuts the pinch, fold
  // turn, shear slide and trace travel to under half and softens the flare.
  u.uMotion!.value = reducedMotion ? 0.42 : 1
  u.uOpacity!.value = state.stage === 'rest' ? 0 : opacity
  u.uApproach!.value = state.approach
  u.uCompress!.value = state.compress
  const part = material.userData['pfxWarpBurstMaterial'] as 'sheet' | 'traces'
  if (part === 'sheet') {
    u.uTime!.value = state.decorativeTime
    u.uFold!.value = state.fold
    u.uShear!.value = state.shear
    u.uFlare!.value = reducedMotion ? state.flare * 0.35 : state.flare
    u.uTear!.value = state.tear
    u.uEnergy!.value = state.energy
    return
  }
  if (part === 'traces') {
    u.uCycle!.value = state.cycle
    return
  }
  const unhandled: never = part
  throw new Error(`Unknown warp-burst material part: ${String(unhandled)}`)
}

/**
 * Library-owned fold sheet: a unit-disc grid. The vertex shader owns every
 * position; each vertex carries only its disc coordinate.
 */
export function createPfxWarpBurstSheetGeometry(): THREE.BufferGeometry {
  const segments = 72
  const disc: number[] = []
  const indices: number[] = []
  for (let row = 0; row <= segments; row += 1) {
    for (let column = 0; column <= segments; column += 1) {
      disc.push((column / segments) * 2 - 1, (row / segments) * 2 - 1)
    }
  }
  // Keep only quads that touch the disc; the fragment shader cuts the edge.
  const inside = (index: number) => Math.hypot(disc[index * 2]!, disc[index * 2 + 1]!) <= 1.08
  for (let row = 0; row < segments; row += 1) {
    for (let column = 0; column < segments; column += 1) {
      const a = row * (segments + 1) + column
      const b = a + segments + 1
      if (!inside(a) && !inside(a + 1) && !inside(b) && !inside(b + 1)) continue
      indices.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }
  const geometry = new THREE.BufferGeometry()
  const count = disc.length / 2
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3))
  geometry.setAttribute('aWarpDisc', new THREE.Float32BufferAttribute(disc, 2))
  geometry.setIndex(indices)
  // The vertex shader folds and slides the sheet. Bound the full motion.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.2)
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-1.2, -1.2, -1.2), new THREE.Vector3(1.2, 1.2, 1.2))
  geometry.userData['pfxWarpBurstGeometry'] = 'sheet'
  geometry.userData['pfxWarpBurstTriangles'] = indices.length / 3
  return geometry
}

/** Camera-facing tapered strips. The vertex shader owns every position. */
export function createPfxWarpBurstTraceGeometry(): THREE.BufferGeometry {
  const trace: number[] = []
  const seeds: number[] = []
  const indices: number[] = []
  for (let index = 0; index < PFX_WARP_BURST_TRACE_COUNT; index += 1) {
    const half = index < TRACE_UPPER_COUNT ? 1 : -1
    // Deterministic seeds from the golden ratio and a second irrational step.
    const seed = (index * 0.618034 + 0.137) % 1
    const lifeSeed = (index * 0.754878 + 0.29) % 1
    // Anchors cluster near the middle of the crease.
    const spread = ((index * 0.3819660 + 0.41) % 1) * 2 - 1
    const s0 = spread * Math.abs(spread) * 0.5 + spread * 0.12
    const d0 = (((index * 0.5698403 + 0.07) % 1) - 0.5) * 0.06
    const base = trace.length / 4
    for (let segment = 0; segment <= TRACE_SEGMENTS; segment += 1) {
      const a = segment / TRACE_SEGMENTS
      trace.push(index, a, -1, half, index, a, 1, half)
      seeds.push(seed, s0, d0, lifeSeed, seed, s0, d0, lifeSeed)
    }
    for (let segment = 0; segment < TRACE_SEGMENTS; segment += 1) {
      const a = base + segment * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const geometry = new THREE.BufferGeometry()
  const count = trace.length / 4
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3))
  geometry.setAttribute('aTrace', new THREE.Float32BufferAttribute(trace, 4))
  geometry.setAttribute('aTraceSeed', new THREE.Float32BufferAttribute(seeds, 4))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2)
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-2, -2, -2), new THREE.Vector3(2, 2, 2))
  geometry.userData['pfxWarpBurstGeometry'] = 'traces'
  geometry.userData['pfxWarpBurstTriangles'] = indices.length / 3
  return geometry
}
