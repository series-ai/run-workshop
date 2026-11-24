import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

// A small hot ion packet releases short, unequal flux strands. Each strand
// starts at one side of the packet and travels away. Local bends do not
// return around the packet. Both layers use the same cycle clock.

export type PfxPlasmaBurstStage = 'gather' | 'held' | 'squeeze' | 'release' | 'rest'

export interface PfxPlasmaBurstLifecycle {
  stage: PfxPlasmaBurstStage
  /** Packet and field formation, 0..1. */
  form: number
  /** Magnetic squeeze before the release, 0..1. */
  squeeze: number
  /** Short core flare at the squeeze peak. */
  flare: number
  /** Core heat. It falls quickly after the release. */
  hot: number
  /** Sheath radius before the release expansion, in local units. */
  radius: number
  /** Release expansion of the torn sheath, 0..1. Reduced motion scales it. */
  expand: number
  /** Sheath tear, 0 = closed, 1 = gone. */
  tear: number
  /** Overall brightness envelope. It is 0 before rest. */
  energy: number
}

export interface PfxPlasmaBurstRuntimeState extends PfxPlasmaBurstLifecycle {
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

const HELD_START = 0.14
const SQUEEZE_START = 0.33
const RELEASE_START = 0.445
/** Strands and ions are gone by about 0.82; nothing draws after this point. */
const REST_START = 0.88
const SHEATH_RADIUS = 0.27
/** Normalized-cycle life of a strand after it snaps. */
const LOOP_BREAK_LIFE = 0.3
/** Normalized-cycle life of an ion trace after the release. */
const ION_LIFE = 0.3

const REST: PfxPlasmaBurstLifecycle = {
  stage: 'rest', form: 0, squeeze: 0, flare: 0, hot: 0, radius: SHEATH_RADIUS, expand: 1, tear: 1, energy: 0,
}

export function createPfxPlasmaBurstLifecycle(cycle: number): PfxPlasmaBurstLifecycle {
  const u = clamp01(cycle)
  if (u >= REST_START) return REST
  const form = smooth((u - 0.02) / 0.12)
  const squeeze = smooth((u - SQUEEZE_START) / 0.1) * (1 - smooth((u - 0.44) / 0.035))
  const flare = pulse(u, 0.435, 0.035)
  const releaseLinear = clamp01((u - RELEASE_START) / 0.34)
  const expand = 1 - Math.pow(1 - releaseLinear, 2.2)
  const hot = form * (1 - smooth((u - RELEASE_START) / 0.12))
  const radius = SHEATH_RADIUS * (0.45 + 0.55 * form) * (1 - 0.2 * squeeze)
  const tear = Math.pow(releaseLinear, 0.8)
  const energy = smooth(u / 0.03) * (1 - smooth((u - 0.8) / 0.05))
  const stage: PfxPlasmaBurstStage = u < HELD_START
    ? 'gather'
    : u < SQUEEZE_START ? 'held' : u < RELEASE_START ? 'squeeze' : 'release'
  return { stage, form, squeeze, flare, hot, radius, expand, tear, energy }
}

export function createPfxPlasmaBurstRuntimeState(
  input: {
    elapsedSeconds: number
    timing: number
    lifetime: number
    tempo: number
    motionMultiplier: number
    cycleScale: number
    reducedMotion: boolean
  },
  target?: PfxPlasmaBurstRuntimeState,
): PfxPlasmaBurstRuntimeState {
  // Same master clock as getPfxBurstCycleSeconds.
  const timeScale = Math.max(0.05, input.timing) * input.motionMultiplier * Math.max(0.1, input.tempo)
  const span = Math.max(0.3, Math.max(0.25, input.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER * Math.max(1, input.cycleScale)
  const cycle = ((Math.max(0, input.elapsedSeconds) * timeScale) % span) / span
  const lifecycle = createPfxPlasmaBurstLifecycle(cycle)
  const decorativeTime = cycle * (span / timeScale) * (input.reducedMotion ? 0.4 : 1)
  const state = target ?? { ...lifecycle, cycle: 0, decorativeTime: 0 }
  Object.assign(state, lifecycle, { cycle, decorativeTime })
  return state
}

// ---------------------------------------------------------------------------
// Magnetic frame and field lines. Built once, deterministically.

type Vec3 = [number, number, number]

/** Camera yaw of the three-quarter review view. */
const VIEW_YAW = 0.72
const RIGHT: Vec3 = [Math.cos(VIEW_YAW), 0, -Math.sin(VIEW_YAW)]
const TOWARD: Vec3 = [Math.sin(VIEW_YAW), 0, Math.cos(VIEW_YAW)]
const UP: Vec3 = [0, 1, 0]

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const normalize = (a: Vec3): Vec3 => scale(a, 1 / Math.max(1e-6, Math.hypot(a[0], a[1], a[2])))
const frame = (x: number, y: number, depth: number): Vec3 => add(add(scale(RIGHT, x), scale(UP, y)), scale(TOWARD, depth))

const CENTER: Vec3 = frame(0, 0.06, 0)
/** Main packet axis. */
const AXIS: Vec3 = normalize(frame(0.42, 1, -0.32))

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface FieldLine {
  /** Strand length in local units. */
  apex: number
  /** Direction in the review frame, in radians. */
  phi: number
  /** Local bend bias. */
  twist: number
  seed: number
  breakU: number
  breakA: number
  /** Open path parameter limit. */
  end: number
  /** Depth slope. */
  tilt: number
  bend: number
  bendFrequency: number
  /** Selects one of two root offsets. */
  reverse: 0 | 1
  phase: number
}

/** Length, direction, bend bias, limit, depth, bend, frequency, root. */
const FIELD_LINES: ReadonlyArray<readonly [number, number, number, number, number, number, number, 0 | 1]> = [
  [0.44, 0.24, 0.5, 0.92, -0.22, 0.055, 1.3, 0],
  [0.29, 0.63, -0.6, 0.92, 0.25, 0.045, 1.7, 1],
  [0.55, 0.43, 0.8, 0.92, 0.13, 0.07, 1.1, 0],
  [0.35, 0.93, -0.5, 0.92, -0.25, 0.055, 1.5, 1],
  [0.23, -0.28, 0.7, 0.92, 0.32, 0.04, 1.8, 0],
  [0.48, 0.08, -0.4, 0.92, -0.12, 0.065, 1.2, 1],
  [0.31, 0.48, 0.4, 0.92, 0.38, 0.05, 1.6, 0],
  [0.40, 1.16, -0.7, 0.92, 0.08, 0.06, 1.4, 1],
  [0.26, -0.49, 0.5, 0.92, -0.32, 0.035, 1.9, 0],
]

function buildField(): FieldLine[] {
  const random = seededRandom(0x4b7e19)
  return FIELD_LINES.map(([apex, phi, twist, end, tilt, bend, bendFrequency, reverse]) => ({
    apex, phi, twist, end, tilt, bend, bendFrequency, reverse, phase: random() * Math.PI * 2, seed: random(),
    breakU: RELEASE_START + 0.05 * random(),
    breakA: end * (0.55 + 0.25 * random()),
  }))
}

const FIELD = buildField()

const glslVec3 = (v: Vec3) => `vec3(${v.map((x) => x.toFixed(5)).join(', ')})`

const PFX_PLASMA_COMMON_GLSL = /* glsl */ `
const vec3 PLASMA_CENTER = ${glslVec3(CENTER)};
const vec3 PLASMA_AXIS = ${glslVec3(AXIS)};
const vec3 PLASMA_RIGHT = ${glslVec3(RIGHT)};
const vec3 PLASMA_UP = ${glslVec3(UP)};
const vec3 PLASMA_DEPTH = ${glslVec3(TOWARD)};
const float PLASMA_PI = 3.14159265;

float pfxPlasmaHash(vec3 p) {
  p = fract(p * vec3(0.3183099, 0.3678794, 0.2831853) + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float pfxPlasmaNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(pfxPlasmaHash(i), pfxPlasmaHash(i + vec3(1.0, 0.0, 0.0)), f.x);
  float b = mix(pfxPlasmaHash(i + vec3(0.0, 1.0, 0.0)), pfxPlasmaHash(i + vec3(1.0, 1.0, 0.0)), f.x);
  float c = mix(pfxPlasmaHash(i + vec3(0.0, 0.0, 1.0)), pfxPlasmaHash(i + vec3(1.0, 0.0, 1.0)), f.x);
  float d = mix(pfxPlasmaHash(i + vec3(0.0, 1.0, 1.0)), pfxPlasmaHash(i + vec3(1.0, 1.0, 1.0)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}

// Soft knee: values below 0.7 pass unchanged; brighter values approach 0.94
// so a single layer keeps its hue and does not clip to white.
vec3 pfxPlasmaKnee(vec3 c) {
  vec3 over = max(c - 0.7, 0.0);
  return min(c, vec3(0.7)) + 0.24 * (1.0 - exp(-over / 0.24));
}
`

const PFX_PLASMA_SHEATH_VERTEX = /* glsl */ `
uniform float uRadius;
uniform float uTime;
uniform float uMotion;
uniform float uSqueeze;
attribute vec3 aDir;
varying vec3 vDir;
varying vec3 vNormalView;
varying vec3 vViewPos;
${PFX_PLASMA_COMMON_GLSL}

void main() {
  // Lumpy packet, pinched along the field axis. Lumps drift slowly.
  float lump = pfxPlasmaNoise(aDir * 2.1 + vec3(0.0, uTime * 0.5, uTime * 0.3)) - 0.5;
  float r = uRadius * (1.0 + 0.36 * lump * (1.0 + 0.6 * uSqueeze * uMotion));
  vec3 p = aDir * r;
  p -= PLASMA_AXIS * dot(p, PLASMA_AXIS) * (0.2 + 0.12 * uSqueeze * uMotion);
  vec4 viewPos = modelViewMatrix * vec4(PLASMA_CENTER + p, 1.0);
  vDir = aDir;
  vNormalView = normalize(normalMatrix * aDir);
  vViewPos = viewPos.xyz;
  gl_Position = projectionMatrix * viewPos;
}
`

export const PFX_PLASMA_BURST_BODY_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uEnergy;
uniform float uHot;
uniform float uFlare;
uniform float uTear;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uColorDeep;
uniform vec3 uColorHot;
varying vec3 vDir;
varying vec3 vNormalView;
varying vec3 vViewPos;
${PFX_PLASMA_COMMON_GLSL}

void main() {
  float facing = abs(dot(normalize(vNormalView), normalize(-vViewPos)));
  float swirl = pfxPlasmaNoise(vDir * 2.3 + vec3(uTime * 0.4, 0.0, -uTime * 0.25));
  // Release: most of the sheath breaks away at once, with no outlined holes.
  // A few separated curved remnants along the field direction stay, drift
  // out with the expansion and erode.
  float bulkNoise = pfxPlasmaNoise(vDir * 3.3 + 7.0);
  float bulk = uTear > 0.0 ? 1.0 - smoothstep(-0.05, 0.05, uTear * 6.0 - 0.15 - bulkNoise) : 1.0;
  float band = abs(fract(dot(vDir, PLASMA_AXIS) * 1.7 + (swirl - 0.5) * 0.5 + 0.13) - 0.5);
  float pick = pfxPlasmaNoise(vDir * 2.6 + 3.0);
  float remnant = uTear > 0.0
    ? (1.0 - smoothstep(0.06, 0.12, band)) * smoothstep(0.54, 0.62, pick) * (1.0 - smoothstep(0.45, 0.9, uTear + (pick - 0.5) * 0.3))
    : 0.0;
  if (bulk + remnant <= 0.003) discard;
  float grain = pfxPlasmaNoise(vDir * 6.0 + vec3(0.0, uTime * 0.9, 0.0));
  // Small, uneven hot region in the middle of the packet.
  float coreMetric = facing + (swirl - 0.5) * 0.18 + (grain - 0.5) * 0.07;
  // The squeeze flare widens the hot region as well as lifting it.
  float core = smoothstep(0.87 - 0.12 * uFlare, 0.975 - 0.05 * uFlare, coreMetric) * uHot;
  float coreHalo = smoothstep(0.74 - 0.1 * uFlare, 0.92, coreMetric) * uHot * (1.0 - core);
  // Dark cool separation between the hot region and the rim.
  float separation = smoothstep(0.3, 0.58, facing) * (1.0 - smoothstep(0.8, 0.92, coreMetric));
  // Thin rim striped by field lines around the tilted axis.
  float lat = dot(vDir, PLASMA_AXIS) * 5.5 + (swirl - 0.5) * 1.6;
  float stripeDist = abs(fract(lat) - 0.5) / max(fwidth(lat), 1e-4);
  float stripes = 1.0 - clamp(stripeDist / 1.6, 0.0, 1.0);
  float rim = pow(1.0 - facing, 2.0);

  vec3 emission = (uColorHot * core * (0.62 + 0.9 * uFlare)
    + mix(uColor, uColorHot, 0.4) * coreHalo * (0.22 + 0.6 * uFlare)
    + uColorDeep * separation * 0.12
    + uColor * rim * (0.16 + 0.7 * stripes)) * bulk
    + uColor * remnant * (0.22 + 0.4 * stripes);
  // Premultiplied output: the separation band darkens what lies behind it.
  float cover = (separation * 0.62 + rim * 0.1 + core * 0.4) * bulk + remnant * 0.12;
  gl_FragColor = vec4(pfxPlasmaKnee(emission), cover) * uOpacity * uEnergy;
}
`

/** Accent kinds. */
const ACCENT_LINE = 0
const ACCENT_ION = 1

const PFX_PLASMA_FIELD_VERTEX = /* glsl */ `
uniform float uCycle;
uniform float uTime;
uniform float uMotion;
uniform float uForm;
uniform float uSqueeze;
uniform float uRadius;
attribute vec4 aField;
attribute vec4 aFieldLine;
attribute vec4 aFieldBreak;
attribute vec4 aFieldShape;
varying float vA;
varying float vSide;
varying float vType;
varying float vRel;
varying float vW;
varying float vGap;
varying float vSeed;
varying float vOcc;
varying float vTau;
${PFX_PLASMA_COMMON_GLSL}

float pfxLineTilt;
float pfxLineEnd;
vec4 pfxLineShape;

// Each strand advances along one direction. The bend is perpendicular to
// that direction. The path cannot turn back toward its root.
vec3 pfxPlasmaLine(float aIn, vec4 line) {
  float t = clamp(aIn / pfxLineEnd, 0.0, 1.0);
  vec3 direction = cos(line.y) * PLASMA_RIGHT + sin(line.y) * PLASMA_UP;
  vec3 across = -sin(line.y) * PLASMA_RIGHT + cos(line.y) * PLASMA_UP;
  float phase = pfxLineShape.w;
  float rootAngle = line.y + mix(-0.38, 0.48, pfxLineShape.z);
  vec3 root = (cos(rootAngle) * PLASMA_RIGHT + sin(rootAngle) * PLASMA_UP) * 0.19
    + PLASMA_DEPTH * (fract(phase * 0.71) - 0.5) * 0.24;
  float reach = line.x * mix(0.55, 1.0, uForm) * (1.0 - 0.14 * uSqueeze * uMotion);
  float bend = pfxLineShape.x * (sin(t * pfxLineShape.y * PLASMA_PI + phase) - sin(phase))
    + line.z * 0.045 * t * t;
  float drift = sin(t * 3.0 + phase + uTime * 1.6) * 0.008 * t * uMotion;
  return PLASMA_CENTER + root + direction * reach * t + across * (bend + drift)
    + PLASMA_DEPTH * (pfxLineTilt * reach * t + 0.035 * sin(t * 2.5 + phase) * t);
}

// Snapped line: points move away from the packet, most at the break.
vec3 pfxPlasmaRecoil(vec3 p, float w, float rel) {
  float pull = (1.0 - exp(-3.0 * rel)) / (1.0 - exp(-3.0));
  vec3 outward = normalize(p - PLASMA_CENTER);
  return p + outward * 0.42 * pull * pow(w, 1.4) * uMotion;
}

// The root holds the inner strand. The outer piece is free after the break.
float pfxPlasmaWeight(float a, float breakA) {
  if (a < breakA) return a / breakA;
  return 1.0;
}

vec4 pfxPlasmaView(vec3 p) {
  return modelViewMatrix * vec4(p, 1.0);
}

void main() {
  float type = aField.w;
  float side = aField.y;
  float breakU = aFieldBreak.x;
  float breakA = aFieldBreak.y;
  float end = aFieldBreak.z;
  pfxLineTilt = aFieldBreak.w;
  pfxLineEnd = end;
  pfxLineShape = aFieldShape;
  float rel = (uCycle - breakU) / ${LOOP_BREAK_LIFE.toFixed(3)};
  float relC = clamp(rel, 0.0, 1.0);
  float scale = length(modelViewMatrix[0].xyz);
  vec4 here;
  vec4 behind;
  float width;
  float a;
  float tau = 0.0;
  if (type < 0.5) {
    a = aField.x * end;
    float da = 0.012;
    vec3 p = pfxPlasmaLine(a, aFieldLine);
    vec3 p0 = pfxPlasmaLine(max(0.0, a - da), aFieldLine);
    vec3 p1 = pfxPlasmaLine(min(1.0, a + da), aFieldLine);
    if (rel > 0.0) {
      float w = pfxPlasmaWeight(a, breakA);
      p = pfxPlasmaRecoil(p, w, relC);
      p0 = pfxPlasmaRecoil(p0, pfxPlasmaWeight(max(0.0, a - da), breakA), relC);
      p1 = pfxPlasmaRecoil(p1, pfxPlasmaWeight(min(1.0, a + da), breakA), relC);
      vW = w;
    } else {
      vW = 1.0;
    }
    here = pfxPlasmaView(p);
    behind = pfxPlasmaView(p0);
    vec4 ahead = pfxPlasmaView(p1);
    vec2 tangent = ahead.xy - behind.xy;
    tangent = length(tangent) > 1e-6 ? normalize(tangent) : vec2(1.0, 0.0);
    width = (0.011 + 0.006 * fract(aFieldLine.w * 3.7)) * (1.0 - 0.75 * relC);
    // Each strand thins toward its free tip.
    width *= mix(0.85, 0.22, smoothstep(0.25, 1.0, aField.x));
    here.xy += vec2(-tangent.y, tangent.x) * side * width * scale;
  } else {
    // Ion bead: bounces between mirror points along its line, then leaves on
    // a short spiral after the line snaps.
    float speed = aField.z;
    float mirror = abs(fract(aFieldLine.w * 3.1 + uCycle * speed) * 2.0 - 1.0);
    float mirrorTail = abs(fract(aFieldLine.w * 3.1 + (uCycle - 0.025) * speed) * 2.0 - 1.0);
    a = mix(0.14, 0.86, mirror) * end;
    float aTail = mix(0.14, 0.86, mirrorTail) * end;
    vec3 head = pfxPlasmaLine(a, aFieldLine);
    vec3 tail = pfxPlasmaLine(aTail, aFieldLine);
    tau = (uCycle - breakU - 0.01) / ${ION_LIFE.toFixed(3)};
    if (tau > 0.0) {
      float mirrorRelease = abs(fract(aFieldLine.w * 3.1 + (breakU + 0.01) * speed) * 2.0 - 1.0);
      vec3 start = pfxPlasmaLine(mix(0.14, 0.86, mirrorRelease) * end, aFieldLine);
      vec3 outward = normalize(start - PLASMA_CENTER);
      vec3 b1 = normalize(cross(outward, PLASMA_AXIS));
      vec3 b2 = cross(outward, b1);
      float t1 = clamp(tau, 0.0, 1.0);
      float t0 = clamp(tau - 0.09, 0.0, 1.0);
      float g1 = (1.0 - exp(-2.6 * t1)) / (1.0 - exp(-2.6));
      float g0 = (1.0 - exp(-2.6 * t0)) / (1.0 - exp(-2.6));
      float spin = 7.0 * uMotion;
      head = start + (outward * 0.55 * g1 + (b1 * cos(t1 * spin) + b2 * sin(t1 * spin)) * 0.06 * sin(t1 * 3.1416)) * uMotion;
      tail = start + (outward * 0.55 * g0 + (b1 * cos(t0 * spin) + b2 * sin(t0 * spin)) * 0.06 * sin(t0 * 3.1416)) * uMotion;
    }
    here = pfxPlasmaView(aField.x > 0.5 ? head : tail);
    vec4 h = pfxPlasmaView(head);
    vec4 t = pfxPlasmaView(tail);
    vec2 axis = h.xy - t.xy;
    axis = length(axis) > 1e-6 ? normalize(axis) : vec2(0.0, 1.0);
    width = (0.012 + 0.006 * fract(aFieldLine.w * 5.3)) * (tau > 0.0 ? pow(max(0.0, 1.0 - tau), 1.2) : uForm);
    here.xy += vec2(-axis.y, axis.x) * side * width * scale;
    vW = 1.0;
  }
  // Lines and ions behind the packet are dimmed by its sheath.
  vec4 c = modelViewMatrix * vec4(PLASMA_CENTER, 1.0);
  float behindPacket = step(here.z, c.z);
  float inside = 1.0 - smoothstep(0.7, 1.05, length(here.xy - c.xy) / max(1e-4, uRadius * scale));
  vOcc = 1.0 - 0.75 * behindPacket * inside * (1.0 - smoothstep(0.0, 0.5, relC));
  // Lines: position along the line. Ions: 1 at the head, 0 at the tail.
  vA = type < 0.5 ? a / max(1e-3, end) : aField.x;
  vSide = side;
  vType = type;
  vRel = rel;
  vGap = abs(a - breakA);
  vSeed = aFieldLine.w;
  vTau = tau;
  gl_Position = projectionMatrix * here;
}
`

export const PFX_PLASMA_BURST_ACCENT_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uEnergy;
uniform float uForm;
uniform float uFlare;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uColorDeep;
uniform vec3 uColorHot;
varying float vA;
varying float vSide;
varying float vType;
varying float vRel;
varying float vW;
varying float vGap;
varying float vSeed;
varying float vOcc;
varying float vTau;
${PFX_PLASMA_COMMON_GLSL}

void main() {
  float across = 1.0 - abs(vSide);
  float energy;
  vec3 color;
  if (vType < 0.5) {
    // Formation: each strand grows from its root to its free tip.
    if (vA > uForm * 1.05) discard;
    float relC = clamp(vRel, 0.0, 1.0);
    if (vRel > 0.0) {
      // Snap: a gap opens at the break, and the line erodes from its feet.
      if (vGap < 0.012 + 0.3 * relC) discard;
      if (vW < pow(relC, 0.8)) discard;
    }
    float flow = 0.55 + 0.45 * sin((vA * 7.0 - uTime * 3.4 + vSeed * 6.2831) * 6.2831 * 0.5);
    float core = pow(across, 4.0);
    float glow = across * across;
    float openTip = (1.0 - smoothstep(0.62, 1.0, vA)) * (0.8 + 0.3 * fract(vSeed * 7.7));
    float snapHeat = vRel > 0.0 ? exp(-relC * 4.0) : 0.0;
    energy = (0.3 * glow + 0.8 * core) * (0.55 + 0.45 * flow) * openTip * (1.0 + 0.7 * uFlare) + snapHeat * core * 0.7;
    color = mix(uColor, uColorHot, clamp(core * (0.25 + 0.35 * flow) + snapHeat * 0.6, 0.0, 1.0));
    color = mix(color, uColorDeep, relC * 0.7);
  } else {
    if (vTau > 1.0) discard;
    float head = mix(0.4, 1.0, vA);
    energy = pow(across, 1.6) * head * (vTau > 0.0 ? 1.2 - 0.7 * vTau : 0.9);
    color = mix(uColorHot, uColor, clamp(vTau * 1.4, 0.0, 1.0));
    color = mix(color, uColorDeep, smoothstep(0.5, 1.0, vTau));
  }
  gl_FragColor = vec4(pfxPlasmaKnee(color * energy * vOcc) * uEnergy, uOpacity);
}
`

/** Filament, deep and hot tones derived from one control colour. */
function plasmaPalette(color: THREE.ColorRepresentation): { base: THREE.Color; deep: THREE.Color; hot: THREE.Color } {
  const source = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  source.getHSL(hsl)
  // The control colour sets the field lines, turned 0.12 round the hue wheel
  // (blue -> violet). The hot ion tone turns further (toward magenta) and
  // lifts toward white; the separation tone is a dark, cool version of the
  // control hue. A new control colour moves all three.
  const base = new THREE.Color().setHSL((hsl.h + 0.12) % 1, Math.min(1, hsl.s * 0.85 + 0.15), Math.min(0.64, Math.max(0.52, hsl.l * 0.9)))
  const hot = new THREE.Color().setHSL((hsl.h + 0.24) % 1, 1, 0.68).lerp(new THREE.Color('#fff6fd'), 0.5)
  const deep = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.8 + 0.2), Math.min(0.3, Math.max(0.16, hsl.l * 0.3)))
  return { base, deep, hot }
}

const vec3Of = (color: THREE.Color) => new THREE.Vector3(color.r, color.g, color.b)

function paletteUniforms(opacity: number, color: THREE.ColorRepresentation) {
  const palette = plasmaPalette(color)
  return {
    uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
    uColor: { value: vec3Of(palette.base) },
    uColorDeep: { value: vec3Of(palette.deep) },
    uColorHot: { value: vec3Of(palette.hot) },
  }
}

function finishMaterial(material: THREE.ShaderMaterial, part: 'body' | 'accent'): THREE.ShaderMaterial {
  material.forceSinglePass = true
  material.userData['pfxPlasmaBurstMaterial'] = part
  material.userData['pfxPlasmaBurstFragmentTextureSamples'] = 0
  return material
}

export function createPfxPlasmaBurstBodyMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return finishMaterial(new THREE.ShaderMaterial({
    uniforms: {
      uRadius: { value: SHEATH_RADIUS },
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uSqueeze: { value: 0 },
      uHot: { value: 0 },
      uFlare: { value: 0 },
      uTear: { value: 0 },
      uEnergy: { value: 0 },
      ...paletteUniforms(opacity, color),
    },
    vertexShader: PFX_PLASMA_SHEATH_VERTEX,
    fragmentShader: PFX_PLASMA_BURST_BODY_FRAGMENT,
    transparent: true,
    // Premultiplied: emission adds light, cover darkens what lies behind.
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: false,
  }), 'body')
}

export function createPfxPlasmaBurstAccentMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return finishMaterial(new THREE.ShaderMaterial({
    uniforms: {
      uCycle: { value: 0 },
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uForm: { value: 0 },
      uSqueeze: { value: 0 },
      uRadius: { value: SHEATH_RADIUS },
      uFlare: { value: 0 },
      uEnergy: { value: 0 },
      ...paletteUniforms(opacity, color),
    },
    vertexShader: PFX_PLASMA_FIELD_VERTEX,
    fragmentShader: PFX_PLASMA_BURST_ACCENT_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), 'accent')
}

/** Writes one runtime state into either plasma-burst material. */
export function applyPfxPlasmaBurstUniforms(
  material: THREE.ShaderMaterial,
  state: PfxPlasmaBurstRuntimeState,
  opacity: number,
  reducedMotion: boolean,
): void {
  const u = material.uniforms
  // Reduced motion keeps the event and its timing. It cuts the strand recoil,
  // ion travel and spiral, and the sheath expansion, to about a third; calms
  // the squeeze wobble; and softens the core and field flare.
  u.uMotion!.value = reducedMotion ? 0.34 : 1
  u.uFlare!.value = reducedMotion ? state.flare * 0.3 : state.flare
  u.uOpacity!.value = state.stage === 'rest' ? 0 : opacity
  u.uEnergy!.value = state.energy
  u.uTime!.value = state.decorativeTime
  u.uSqueeze!.value = state.squeeze
  // The torn sheath expands; reduced motion keeps it near the packet.
  u.uRadius!.value = state.radius * (1 + 0.85 * state.expand * (reducedMotion ? 0.3 : 1))
  const part = material.userData['pfxPlasmaBurstMaterial'] as 'body' | 'accent'
  if (part === 'body') {
    u.uHot!.value = state.hot
    u.uTear!.value = state.tear
    return
  }
  if (part === 'accent') {
    u.uCycle!.value = state.cycle
    u.uForm!.value = state.form
    return
  }
  const unhandled: never = part
  throw new Error(`Unknown plasma-burst material part: ${String(unhandled)}`)
}

/** Library-owned packet sheath: a unit-sphere grid shaped by the vertex shader. */
export function createPfxPlasmaBurstBodyGeometry(): THREE.BufferGeometry {
  const rows = 36
  const columns = 56
  const dir: number[] = []
  const indices: number[] = []
  for (let row = 0; row <= rows; row += 1) {
    const theta = (row / rows) * Math.PI
    for (let column = 0; column <= columns; column += 1) {
      const phi = (column / columns) * Math.PI * 2
      dir.push(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi))
    }
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column
      const b = a + columns + 1
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(dir.length), 3))
  geometry.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 3))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...CENTER), 1)
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1))
  geometry.userData['pfxPlasmaBurstGeometry'] = 'body'
  geometry.userData['pfxPlasmaBurstTriangles'] = indices.length / 3
  return geometry
}

const LINE_SEGMENTS = 44
const IONS_PER_FILAMENT = 1

/** Field-line ribbons and ion streaks in one draw. */
export function createPfxPlasmaBurstAccentGeometry(): THREE.BufferGeometry {
  const random = seededRandom(0x913c27)
  const field: number[] = []
  const line: number[] = []
  const breaks: number[] = []
  const shape: number[] = []
  const indices: number[] = []
  const lineData = (entry: FieldLine) => [entry.apex, entry.phi, entry.twist, entry.seed] as const
  const shapeData = (entry: FieldLine) => [entry.bend, entry.bendFrequency, entry.reverse, entry.phase] as const
  for (const entry of FIELD) {
    const first = field.length / 4
    for (let segment = 0; segment <= LINE_SEGMENTS; segment += 1) {
      for (const side of [-1, 1]) {
        field.push(segment / LINE_SEGMENTS, side, 0, ACCENT_LINE)
        line.push(...lineData(entry))
        breaks.push(entry.breakU, entry.breakA, entry.end, entry.tilt)
        shape.push(...shapeData(entry))
      }
    }
    for (let segment = 0; segment < LINE_SEGMENTS; segment += 1) {
      const a = first + segment * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  // One ion follows each open strand.
  for (const entry of FIELD) {
    const ions = IONS_PER_FILAMENT
    for (let ion = 0; ion < ions; ion += 1) {
      const first = field.length / 4
      const speed = (1.1 + random() * 1.1) * (random() < 0.5 ? -1 : 1)
      const seed = (entry.seed + ion * 0.318 + random() * 0.1) % 1
      for (const [head, side] of [[0, -1], [0, 1], [1, -1], [1, 1]] as const) {
        field.push(head, side, speed, ACCENT_ION)
        line.push(entry.apex, entry.phi, entry.twist, seed)
        breaks.push(entry.breakU, entry.breakA, entry.end, entry.tilt)
        shape.push(...shapeData(entry))
      }
      indices.push(first, first + 1, first + 3, first, first + 3, first + 2)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((field.length / 4) * 3), 3))
  geometry.setAttribute('aField', new THREE.Float32BufferAttribute(field, 4))
  geometry.setAttribute('aFieldLine', new THREE.Float32BufferAttribute(line, 4))
  geometry.setAttribute('aFieldBreak', new THREE.Float32BufferAttribute(breaks, 4))
  geometry.setAttribute('aFieldShape', new THREE.Float32BufferAttribute(shape, 4))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...CENTER), 1.8)
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-1.8, -1.8, -1.8), new THREE.Vector3(1.8, 1.8, 1.8))
  geometry.userData['pfxPlasmaBurstGeometry'] = 'accent'
  geometry.userData['pfxPlasmaBurstTriangles'] = indices.length / 3
  return geometry
}
