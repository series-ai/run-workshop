import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

// electric-burst: one connected discharge. A dim stepped leader feels its way
// down from a source above in short jumps, with side leaders that branch into
// depth. When the leader touches the contact point, one return stroke lights
// the whole connected network at once: the main channel goes white-hot and
// wide, the branches less so. That is the only flash. The channel then cools
// from white to the control colour to a deep tone, the branches die first,
// and the channel breaks into short pieces and goes out. A small corona
// breathes at the contact and the source, and sparks leave the contact and
// the branch tips, cool and shrink. One normalized master-cycle position
// drives both layers, and the event retires before the preview wraps.

export type PfxElectricBurstStage = 'leader' | 'strike' | 'decay' | 'rest'

export interface PfxElectricBurstLifecycle {
  stage: PfxElectricBurstStage
  /** Stepped-leader front, in arc distance from the source (1 = contact). */
  leader: number
  /** Dim leader visibility before the strike. */
  leaderGlow: number
  /** Return-stroke flash, one short beat. */
  strike: number
  /** Residual channel brightness after the strike, 1 -> 0. */
  after: number
  /** Colour cooling of the residual channel, 0..1. */
  cool: number
  /** Channel break-up into short pieces, 0..1. */
  breakup: number
  /** Contact corona, a restrained glow that follows the strike. */
  corona: number
  /** Overall brightness envelope. It is 0 before rest. */
  energy: number
}

export interface PfxElectricBurstRuntimeState extends PfxElectricBurstLifecycle {
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

const LEADER_START = 0.006
/** The leader touches the contact; the return stroke starts here. */
const STRIKE = 0.098
const STRIKE_PEAK = 0.106
/** Sparks are gone by about 0.72; nothing draws after this point. */
const REST_START = 0.88
const LEADER_STEPS = 6

const REST: PfxElectricBurstLifecycle = {
  stage: 'rest', leader: 0, leaderGlow: 0, strike: 0, after: 0, cool: 1, breakup: 1, corona: 0, energy: 0,
}

export function createPfxElectricBurstLifecycle(cycle: number): PfxElectricBurstLifecycle {
  const u = clamp01(cycle)
  if (u >= REST_START) return REST
  // The leader moves in short jumps with a quick glide between them.
  const leaderT = clamp01((u - LEADER_START) / (STRIKE - LEADER_START))
  const stepped = (Math.floor(leaderT * LEADER_STEPS) + smooth((leaderT * LEADER_STEPS % 1) * 3)) / LEADER_STEPS
  const leader = u < STRIKE ? 1.02 * Math.min(1, stepped) : 3
  const leaderGlow = u < STRIKE ? smooth(u / 0.02) : 0
  const strike = u < STRIKE ? 0 : u < STRIKE_PEAK ? smooth((u - STRIKE) / (STRIKE_PEAK - STRIKE)) : Math.exp(-(u - STRIKE_PEAK) / 0.075)
  const after = u < STRIKE ? 0 : Math.exp(-(u - STRIKE) / 0.26) * (1 - smooth((u - 0.52) / 0.16))
  const cool = smooth((u - 0.12) / 0.4)
  const breakup = clamp01((u - 0.24) / 0.42)
  const corona = u < STRIKE ? 0 : smooth((u - STRIKE) / 0.012) * Math.exp(-(u - STRIKE - 0.012) / 0.12) * (1 - smooth((u - 0.4) / 0.1))
  const energy = smooth(u / 0.012) * (1 - smooth((u - 0.78) / 0.06))
  const stage: PfxElectricBurstStage = u < STRIKE ? 'leader' : u < 0.16 ? 'strike' : 'decay'
  return { stage, leader, leaderGlow, strike, after, cool, breakup, corona, energy }
}

export function createPfxElectricBurstRuntimeState(
  input: {
    elapsedSeconds: number
    timing: number
    lifetime: number
    tempo: number
    motionMultiplier: number
    cycleScale: number
    reducedMotion: boolean
  },
  target?: PfxElectricBurstRuntimeState,
): PfxElectricBurstRuntimeState {
  // Same master clock as getPfxBurstCycleSeconds.
  const timeScale = Math.max(0.05, input.timing) * input.motionMultiplier * Math.max(0.1, input.tempo)
  const span = Math.max(0.3, Math.max(0.25, input.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER * Math.max(1, input.cycleScale)
  const cycle = ((Math.max(0, input.elapsedSeconds) * timeScale) % span) / span
  const lifecycle = createPfxElectricBurstLifecycle(cycle)
  const decorativeTime = cycle * (span / timeScale) * (input.reducedMotion ? 0.4 : 1)
  const state = target ?? { ...lifecycle, cycle: 0, decorativeTime: 0 }
  Object.assign(state, lifecycle, { cycle, decorativeTime })
  return state
}

// ---------------------------------------------------------------------------
// Discharge network. Built once, deterministically, in local units.

type Vec3 = [number, number, number]

/** Camera yaw of the three-quarter review view. */
const VIEW_YAW = 0.72
const RIGHT: Vec3 = [Math.cos(VIEW_YAW), 0, -Math.sin(VIEW_YAW)]
const TOWARD: Vec3 = [Math.sin(VIEW_YAW), 0, Math.cos(VIEW_YAW)]
const UP: Vec3 = [0, 1, 0]

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2])
const normalize = (a: Vec3): Vec3 => scale(a, 1 / Math.max(1e-6, length(a)))
const frame = (x: number, y: number, depth: number): Vec3 => add(add(scale(RIGHT, x), scale(UP, y)), scale(TOWARD, depth))

/** Where the discharge comes from, above and behind. */
const SOURCE: Vec3 = frame(-0.42, 1.0, -0.36)
/** Where the discharge strikes, below and nearer the viewer. */
const CONTACT: Vec3 = frame(0.16, -0.56, 0.22)

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

/** Jagged path by midpoint displacement in 3D. */
function jaggedPath(from: Vec3, to: Vec3, levels: number, roughness: number, random: () => number): Vec3[] {
  let points: Vec3[] = [from, to]
  for (let level = 0; level < levels; level += 1) {
    const next: Vec3[] = []
    for (let index = 0; index < points.length - 1; index += 1) {
      const p = points[index]!
      const q = points[index + 1]!
      const segment = sub(q, p)
      const span = length(segment)
      const axis = normalize(segment)
      let offset: Vec3 = [random() - 0.5, random() - 0.5, random() - 0.5]
      offset = normalize(sub(offset, scale(axis, dot(offset, axis))))
      const mid = add(scale(add(p, q), 0.5), scale(offset, span * roughness * (0.4 + 0.6 * random())))
      next.push(p, mid)
    }
    next.push(points[points.length - 1]!)
    points = next
  }
  return points
}

interface DischargeLine {
  points: Vec3[]
  /** Normalized arc distance from the source at each point. */
  arc: number[]
  generation: 0 | 1 | 2
  seed: number
}

function arcFrom(points: Vec3[], start: number, unit: number): number[] {
  const arc = [start]
  for (let index = 1; index < points.length; index += 1) {
    arc.push(arc[index - 1]! + length(sub(points[index]!, points[index - 1]!)) / unit)
  }
  return arc
}

/** [fraction along the main channel, side (-1 left, 1 right), depth, length]. */
const BRANCHES: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.12, 1, 0.55, 1.0],
  [0.24, -1, -0.5, 0.86],
  [0.35, 1, -0.45, 0.76],
  [0.46, -1, 0.6, 0.68],
  [0.57, 1, 0.3, 0.58],
  [0.66, -1, -0.4, 0.48],
  [0.76, 1, -0.5, 0.38],
  [0.86, -1, 0.4, 0.28],
]

function buildDischarge(): DischargeLine[] {
  const random = seededRandom(0x2e91c5)
  const mainPoints = jaggedPath(SOURCE, CONTACT, 5, 0.3, random)
  const mainLength = mainPoints.slice(1).reduce((sum, point, index) => sum + length(sub(point, mainPoints[index]!)), 0)
  const main: DischargeLine = { points: mainPoints, arc: arcFrom(mainPoints, 0, mainLength), generation: 0, seed: random() }
  const lines: DischargeLine[] = [main]
  for (const [fraction, side, depth, branchLength] of BRANCHES) {
    const index = Math.round(fraction * (mainPoints.length - 1))
    const root = mainPoints[index]!
    const tangent = normalize(sub(mainPoints[Math.min(mainPoints.length - 1, index + 2)]!, mainPoints[Math.max(0, index - 2)]!))
    const lateral = normalize(cross(tangent, TOWARD))
    const dir = normalize(add(add(add(scale(tangent, 0.62), scale(lateral, side * 0.9)), scale(TOWARD, depth)), [0, -0.2, 0]))
    const branchPoints = jaggedPath(root, add(root, scale(dir, branchLength)), 4, 0.36, random)
    const branch: DischargeLine = { points: branchPoints, arc: arcFrom(branchPoints, main.arc[index]!, mainLength), generation: 1, seed: random() }
    lines.push(branch)
    if (branchLength < 0.35) continue
    // Twigs from the long branches, alternating to either side.
    for (const [at, turn] of [[0.3 + 0.15 * random(), -1], [0.6 + 0.15 * random(), 1]] as const) {
      if (branchLength < 0.5 && turn > 0) continue
      const twigIndex = Math.round((branchPoints.length - 1) * at)
      const twigRoot = branchPoints[twigIndex]!
      const twigDir = normalize(add(add(dir, scale(lateral, turn * side * 0.9)), [0, -0.35, (random() - 0.5) * 0.9]))
      const twigPoints = jaggedPath(twigRoot, add(twigRoot, scale(twigDir, branchLength * (0.38 + 0.12 * random()))), 3, 0.38, random)
      lines.push({ points: twigPoints, arc: arcFrom(twigPoints, branch.arc[twigIndex]!, mainLength), generation: 2, seed: random() })
    }
  }
  return lines
}

const DISCHARGE = buildDischarge()

const PFX_ELECTRIC_COMMON_GLSL = /* glsl */ `
float pfxElectricHash(vec2 p) {
  p = fract(p * vec2(0.3183099, 0.3678794) + 0.23);
  p *= 17.0;
  return fract(p.x * p.y * (p.x + p.y));
}
float pfxElectricNoise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(pfxElectricHash(i), pfxElectricHash(i + vec2(1.0, 0.0)), f.x),
             mix(pfxElectricHash(i + vec2(0.0, 1.0)), pfxElectricHash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Soft knee: values below 0.7 pass unchanged; brighter values approach 0.94
// so a single layer keeps its hue and does not clip to white.
vec3 pfxElectricKnee(vec3 c) {
  vec3 over = max(c - 0.7, 0.0);
  return min(c, vec3(0.7)) + 0.24 * (1.0 - exp(-over / 0.24));
}
`

const PFX_ELECTRIC_BODY_VERTEX = /* glsl */ `
uniform float uStrike;
uniform float uAfter;
uniform float uLeaderGlow;
uniform float uReach;
uniform float uFlare;
attribute vec3 aPoint;
attribute vec3 aPrev;
attribute vec3 aNext;
attribute vec3 aRoot;
attribute vec4 aLine;
attribute float aSide;
varying float vSide;
varying float vS;
varying float vGen;
varying float vSeed;
varying float vDepth;

vec3 pfxElectricPlace(vec3 p, float gen) {
  // Reduced motion pulls the branches in toward their roots.
  return gen > 0.5 ? aRoot + (p - aRoot) * uReach : p;
}

void main() {
  float gen = aLine.y;
  vec4 here = modelViewMatrix * vec4(pfxElectricPlace(aPoint, gen), 1.0);
  vec4 prev = modelViewMatrix * vec4(pfxElectricPlace(aPrev, gen), 1.0);
  vec4 next = modelViewMatrix * vec4(pfxElectricPlace(aNext, gen), 1.0);
  vec2 tangent = next.xy - prev.xy;
  tangent = length(tangent) > 1e-6 ? normalize(tangent) : vec2(1.0, 0.0);
  vec2 sideDir = vec2(-tangent.y, tangent.x);
  float base = gen < 0.5 ? 0.024 : (gen < 1.5 ? 0.019 : 0.013);
  float taper = gen > 0.5 ? mix(1.0, 0.35, aLine.w) : 1.0;
  float decay = pow(uAfter, 1.0 + 1.0 * gen);
  float boost = uStrike * uFlare * (gen < 0.5 ? 1.3 : 0.9);
  float width = base * taper * (0.55 * uLeaderGlow + (1.0 + boost) * decay + boost * 0.4);
  float scale = length(modelViewMatrix[0].xyz);
  here.xy += sideDir * aSide * width * scale;
  vSide = aSide;
  vS = aLine.x;
  vGen = gen;
  vSeed = aLine.z;
  vDepth = (here.z - (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).z) / max(1e-4, scale);
  gl_Position = projectionMatrix * here;
}
`

export const PFX_ELECTRIC_BURST_BODY_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uEnergy;
uniform float uLeader;
uniform float uLeaderGlow;
uniform float uStrike;
uniform float uAfter;
uniform float uCool;
uniform float uBreakup;
uniform float uFlare;
uniform vec3 uColor;
uniform vec3 uColorDeep;
uniform vec3 uColorHot;
varying float vSide;
varying float vS;
varying float vGen;
varying float vSeed;
varying float vDepth;
${PFX_ELECTRIC_COMMON_GLSL}

void main() {
  // Only the part the leader has reached exists before the strike.
  float reached = 1.0 - smoothstep(uLeader - 0.004, uLeader + 0.004, vS);
  if (reached <= 0.0) discard;
  // Break-up: the residual channel splits into short pieces that go out.
  float n = pfxElectricNoise(vec2(vS * 34.0 + vSeed * 11.0, vSeed * 7.0));
  float cut = uBreakup * 1.3 - 0.22 + vGen * 0.2;
  if (n < cut) discard;
  float across = 1.0 - abs(vSide);
  // Thin hot core inside a wide soft glow.
  float core = pow(across, 6.0);
  float glow = across * across;
  float tip = exp(-pow((uLeader - vS) / 0.035, 2.0)) * uLeaderGlow;
  float decay = pow(uAfter, 1.0 + 1.0 * vGen);
  float strike = uStrike * uFlare * (vGen < 0.5 ? 1.0 : 0.7);
  float energy = uLeaderGlow * (0.28 * glow + 0.7 * core)
    + tip * (0.7 * glow + 1.2 * core)
    + decay * (0.42 * glow + 1.1 * core)
    + strike * (0.4 * glow + 0.9 * core);
  float pieceEdge = 1.0 - smoothstep(0.0, 0.06, n - cut);
  energy *= 1.0 - 0.5 * pieceEdge * step(0.001, uBreakup);
  float heat = clamp(strike * core * 1.2 + core * decay * (1.0 - uCool) * 0.75 + tip * core, 0.0, 1.0);
  vec3 color = mix(uColor, uColorDeep, clamp(uCool * (1.0 - core * 0.4) + (1.0 - across) * 0.35, 0.0, 1.0));
  color = mix(color, uColorHot, heat);
  // Paths nearer the viewer read brighter; far paths dimmer and deeper.
  float near = clamp(vDepth * 2.2, -1.0, 1.0);
  energy *= mix(0.55, 1.2, near * 0.5 + 0.5);
  color = mix(color, uColorDeep, max(0.0, -near) * 0.35);
  gl_FragColor = vec4(pfxElectricKnee(color * energy * reached) * uEnergy, uOpacity);
}
`

/** Accent kinds. */
const ACCENT_CORONA = 0
const ACCENT_SPARK = 1

const PFX_ELECTRIC_ACCENT_VERTEX = /* glsl */ `
uniform float uCycle;
uniform float uMotion;
uniform float uFlare;
uniform float uCorona;
uniform float uReach;
attribute vec2 aCorner;
attribute vec4 aAccent;
attribute vec3 aOrigin;
attribute vec3 aRoot;
attribute vec3 aVelocity;
varying vec2 vUv;
varying float vType;
varying float vTau;
varying float vSeed;
varying float vFade;

vec3 pfxSparkPath(float tau) {
  float travel = (1.0 - exp(-3.2 * tau)) / (1.0 - exp(-3.2));
  // Branch-tip sparks start where the (possibly shortened) branch ends.
  vec3 origin = aRoot + (aOrigin - aRoot) * uReach;
  return origin + (aVelocity * travel + vec3(0.0, -0.24 * tau * tau, 0.0)) * uMotion;
}

void main() {
  float type = aAccent.x;
  float seed = aAccent.y;
  float start = aAccent.z;
  float life = aAccent.w;
  float scale = length(modelViewMatrix[0].xyz);
  vec4 viewPos;
  float tau = 0.0;
  float fade = 0.0;
  if (type < 0.5) {
    // Corona: one camera-facing glow card at the contact or the source.
    float size = life * mix(0.75, 1.0, uFlare) * (0.85 + 0.15 * uCorona);
    viewPos = modelViewMatrix * vec4(aOrigin, 1.0);
    viewPos.xy += aCorner * size * scale;
    fade = uCorona * seed * mix(0.5, 1.0, uFlare);
  } else {
    // Spark: a short streak. The head leads; the tail lags behind it.
    tau = (uCycle - start) / life;
    vec3 head = pfxSparkPath(clamp(tau, 0.0, 1.0));
    vec3 tail = pfxSparkPath(clamp(tau - 0.13, 0.0, 1.0));
    vec4 h = modelViewMatrix * vec4(head, 1.0);
    vec4 t = modelViewMatrix * vec4(tail, 1.0);
    vec2 axis = h.xy - t.xy;
    axis = length(axis) > 1e-6 ? normalize(axis) : vec2(0.0, 1.0);
    vec2 sideDir = vec2(-axis.y, axis.x);
    float width = (0.009 + 0.008 * fract(seed * 5.7)) * pow(max(0.0, 1.0 - tau), 1.1);
    viewPos = aCorner.y > 0.0 ? h : t;
    viewPos.xy += sideDir * aCorner.x * width * scale;
    fade = (tau < 0.0 || tau > 1.0) ? 0.0 : 1.0;
    if (fade == 0.0) viewPos.xy = h.xy;
  }
  vUv = aCorner;
  vType = type;
  vTau = tau;
  vSeed = seed;
  vFade = fade;
  gl_Position = projectionMatrix * viewPos;
}
`

export const PFX_ELECTRIC_BURST_ACCENT_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uEnergy;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uColorDeep;
uniform vec3 uColorHot;
varying vec2 vUv;
varying float vType;
varying float vTau;
varying float vSeed;
varying float vFade;
${PFX_ELECTRIC_COMMON_GLSL}

void main() {
  if (vFade <= 0.0) discard;
  float energy;
  vec3 color;
  if (vType < 0.5) {
    // Restrained corona: a soft core and short uneven streamers. Streamer
    // noise uses the direction vector, so there is no seam and no ring.
    float r = length(vUv);
    if (r >= 1.0) discard;
    vec2 dir = vUv / max(r, 1e-4);
    float streamer = pfxElectricNoise(dir * 2.6 + vec2(vSeed * 9.0 + uTime * 0.35, r * 1.4 - uTime * 0.9));
    streamer = pow(streamer, 3.0) * (1.0 - smoothstep(0.15, 1.0, r)) * smoothstep(0.05, 0.25, r);
    float core = exp(-r * r * 22.0);
    float halo = exp(-r * r * 5.0) * 0.22;
    energy = core * 0.22 + streamer * 0.75 + halo;
    color = mix(uColor, uColorHot, clamp(core * 0.9 + streamer * 0.3, 0.0, 1.0));
  } else {
    // Spark streak: a hot head that cools to the deep tone as it shrinks.
    float across = 1.0 - abs(vUv.x);
    float headBias = 0.4 + 0.6 * step(0.0, vUv.y);
    // Each spark fades in over its first moment so the launch bundle does
    // not stack to white at the contact.
    energy = pow(across, 1.6) * headBias * (1.05 - 0.6 * vTau) * smoothstep(0.0, 0.07, vTau);
    color = mix(uColorHot, uColor, smoothstep(0.0, 0.35, vTau));
    color = mix(color, uColorDeep, smoothstep(0.35, 0.9, vTau));
  }
  gl_FragColor = vec4(pfxElectricKnee(color * energy * vFade) * uEnergy, uOpacity);
}
`

/** Base, deep and hot tones derived from one control colour. */
function electricPalette(color: THREE.ColorRepresentation): { base: THREE.Color; deep: THREE.Color; hot: THREE.Color } {
  const source = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  source.getHSL(hsl)
  // The control colour drives the channel. The deep tone sits 0.09 further
  // round the hue wheel (cyan -> blue) and darker; the hot tone is the
  // control colour lifted close to white. A new control colour moves all three.
  const base = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.9 + 0.1), Math.min(0.62, Math.max(0.5, hsl.l)))
  const deep = new THREE.Color().setHSL((hsl.h + 0.09) % 1, Math.min(1, hsl.s * 0.9 + 0.1), Math.min(0.42, Math.max(0.28, hsl.l * 0.6)))
  const hot = base.clone().lerp(new THREE.Color('#f7fdff'), 0.8)
  return { base, deep, hot }
}

const vec3Of = (color: THREE.Color) => new THREE.Vector3(color.r, color.g, color.b)

function paletteUniforms(opacity: number, color: THREE.ColorRepresentation) {
  const palette = electricPalette(color)
  return {
    uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
    uColor: { value: vec3Of(palette.base) },
    uColorDeep: { value: vec3Of(palette.deep) },
    uColorHot: { value: vec3Of(palette.hot) },
  }
}

function finishMaterial(material: THREE.ShaderMaterial, part: 'body' | 'accent'): THREE.ShaderMaterial {
  material.forceSinglePass = true
  material.userData['pfxElectricBurstMaterial'] = part
  material.userData['pfxElectricBurstFragmentTextureSamples'] = 0
  return material
}

export function createPfxElectricBurstBodyMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return finishMaterial(new THREE.ShaderMaterial({
    uniforms: {
      uLeader: { value: 0 },
      uLeaderGlow: { value: 0 },
      uStrike: { value: 0 },
      uAfter: { value: 0 },
      uCool: { value: 0 },
      uBreakup: { value: 0 },
      uReach: { value: 1 },
      uFlare: { value: 1 },
      uEnergy: { value: 0 },
      ...paletteUniforms(opacity, color),
    },
    vertexShader: PFX_ELECTRIC_BODY_VERTEX,
    fragmentShader: PFX_ELECTRIC_BURST_BODY_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), 'body')
}

export function createPfxElectricBurstAccentMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return finishMaterial(new THREE.ShaderMaterial({
    uniforms: {
      uCycle: { value: 0 },
      uMotion: { value: 1 },
      uFlare: { value: 1 },
      uCorona: { value: 0 },
      uReach: { value: 1 },
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      ...paletteUniforms(opacity, color),
    },
    vertexShader: PFX_ELECTRIC_ACCENT_VERTEX,
    fragmentShader: PFX_ELECTRIC_BURST_ACCENT_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), 'accent')
}

/** Writes one runtime state into either electric-burst material. */
export function applyPfxElectricBurstUniforms(
  material: THREE.ShaderMaterial,
  state: PfxElectricBurstRuntimeState,
  opacity: number,
  reducedMotion: boolean,
): void {
  const u = material.uniforms
  // Reduced motion keeps the event and its timing. It cuts the branch
  // extension to under half, cuts spark travel to about a third, and softens the strike
  // flash, the channel widening and the corona.
  u.uFlare!.value = reducedMotion ? 0.42 : 1
  u.uReach!.value = reducedMotion ? 0.45 : 1
  u.uOpacity!.value = state.stage === 'rest' ? 0 : opacity
  u.uEnergy!.value = state.energy
  const part = material.userData['pfxElectricBurstMaterial'] as 'body' | 'accent'
  if (part === 'body') {
    u.uLeader!.value = state.leader
    u.uLeaderGlow!.value = state.leaderGlow
    u.uStrike!.value = state.strike
    u.uAfter!.value = state.after
    u.uCool!.value = state.cool
    u.uBreakup!.value = state.breakup
    return
  }
  if (part === 'accent') {
    u.uMotion!.value = reducedMotion ? 0.34 : 1
    u.uCycle!.value = state.cycle
    u.uTime!.value = state.decorativeTime
    u.uCorona!.value = state.corona
    return
  }
  const unhandled: never = part
  throw new Error(`Unknown electric-burst material part: ${String(unhandled)}`)
}

/**
 * Library-owned discharge network: camera-facing ribbons along fixed jagged
 * paths. The vertex shader owns the width and branch reach.
 */
export function createPfxElectricBurstBodyGeometry(): THREE.BufferGeometry {
  const point: number[] = []
  const prev: number[] = []
  const next: number[] = []
  const root: number[] = []
  const line: number[] = []
  const side: number[] = []
  const indices: number[] = []
  for (const discharge of DISCHARGE) {
    const first = side.length
    const count = discharge.points.length
    for (let index = 0; index < count; index += 1) {
      const here = discharge.points[index]!
      const before = discharge.points[Math.max(0, index - 1)]!
      const after = discharge.points[Math.min(count - 1, index + 1)]!
      for (const s of [-1, 1]) {
        point.push(...here)
        prev.push(...before)
        next.push(...after)
        root.push(...discharge.points[0]!)
        line.push(discharge.arc[index]!, discharge.generation, discharge.seed, index / (count - 1))
        side.push(s)
      }
    }
    for (let index = 0; index < count - 1; index += 1) {
      const a = first + index * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(side.length * 3), 3))
  geometry.setAttribute('aPoint', new THREE.Float32BufferAttribute(point, 3))
  geometry.setAttribute('aPrev', new THREE.Float32BufferAttribute(prev, 3))
  geometry.setAttribute('aNext', new THREE.Float32BufferAttribute(next, 3))
  geometry.setAttribute('aRoot', new THREE.Float32BufferAttribute(root, 3))
  geometry.setAttribute('aLine', new THREE.Float32BufferAttribute(line, 4))
  geometry.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.2, 0), 1.5)
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-1.5, -1.3, -1.5), new THREE.Vector3(1.5, 1.7, 1.5))
  geometry.userData['pfxElectricBurstGeometry'] = 'body'
  geometry.userData['pfxElectricBurstLines'] = DISCHARGE.length
  geometry.userData['pfxElectricBurstTriangles'] = indices.length / 3
  return geometry
}

const CONTACT_SPARK_COUNT = 34
const TIP_SPARK_COUNT = 12

/** Corona cards and spark streaks in one draw. */
export function createPfxElectricBurstAccentGeometry(): THREE.BufferGeometry {
  const random = seededRandom(0x7a1d03)
  const corner: number[] = []
  const accent: number[] = []
  const origin: number[] = []
  const root: number[] = []
  const velocity: number[] = []
  const indices: number[] = []
  const push = (corners: ReadonlyArray<readonly [number, number]>, data: readonly [number, number, number, number], at: Vec3, move: Vec3, from: Vec3 = at) => {
    const first = corner.length / 2
    for (const [x, y] of corners) {
      corner.push(x, y)
      accent.push(...data)
      origin.push(...at)
      root.push(...from)
      velocity.push(...move)
    }
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
  }
  const card = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const
  const streak = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const
  // Corona: [type, intensity (also its noise seed), unused, size].
  push(card, [ACCENT_CORONA, 1, 0, 0.34], CONTACT, [0, 0, 0])
  push(card, [ACCENT_CORONA, 0.45, 0, 0.2], SOURCE, [0, 0, 0])
  // Sparks: [type, seed, start, life]. Velocity length is the travel distance.
  for (let index = 0; index < CONTACT_SPARK_COUNT; index += 1) {
    const dir = normalize([(random() - 0.5) * 2, 0.15 + random() * 0.9, (random() - 0.5) * 2])
    const travel = 0.28 + random() * 0.46
    push(streak, [ACCENT_SPARK, random(), STRIKE + 0.004 + random() * 0.03, 0.32 + random() * 0.3], CONTACT, scale(dir, travel))
  }
  const tips = DISCHARGE.filter((line) => line.generation > 0)
  for (let index = 0; index < TIP_SPARK_COUNT; index += 1) {
    const tip = tips[index % tips.length]!
    const at = tip.points[tip.points.length - 1]!
    const dir = normalize([(random() - 0.5) * 2, random() * 0.6 - 0.1, (random() - 0.5) * 2])
    push(streak, [ACCENT_SPARK, random(), STRIKE + 0.008 + random() * 0.03, 0.24 + random() * 0.24], at, scale(dir, 0.12 + random() * 0.2), tip.points[0]!)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((corner.length / 2) * 3), 3))
  geometry.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 2))
  geometry.setAttribute('aAccent', new THREE.Float32BufferAttribute(accent, 4))
  geometry.setAttribute('aOrigin', new THREE.Float32BufferAttribute(origin, 3))
  geometry.setAttribute('aRoot', new THREE.Float32BufferAttribute(root, 3))
  geometry.setAttribute('aVelocity', new THREE.Float32BufferAttribute(velocity, 3))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.8)
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-1.8, -1.8, -1.8), new THREE.Vector3(1.8, 1.8, 1.8))
  geometry.userData['pfxElectricBurstGeometry'] = 'accent'
  geometry.userData['pfxElectricBurstTriangles'] = indices.length / 3
  return geometry
}
