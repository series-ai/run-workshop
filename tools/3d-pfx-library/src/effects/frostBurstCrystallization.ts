import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

// frost-burst: a freezing event. A cold contact bites at one point, then
// rime grows out of it as a fan of thin faceted ice blades. Each main blade
// grows side ferns at the ice angle, and the ferns grow twigs. The growth
// front moves at an uneven speed on each stem, so the fan fills out of
// balance. The frozen fan holds for a moment, then turns brittle: the outer
// blades crack first, each piece drifts out, turns and falls, and sublimates
// from noisy edges into thin cold vapor and tumbling flakes. One normalized
// master-cycle position drives both layers, and the event retires before the
// preview wraps.
//
// The blades are drawn ice facets with a fixed light. They do not sample the
// scene colour, so they make no refraction claim.

export type PfxFrostBurstStage = 'contact' | 'growth' | 'freeze' | 'release' | 'rest'

export interface PfxFrostBurstLifecycle {
  stage: PfxFrostBurstStage
  /** Cold contact bite at the root of the fan, 0..1. */
  contact: number
  /** Growth front distance from the contact, in local units along each stem. */
  front: number
  /** Frozen hold: slow glints move along the finished blades, 0..1. */
  hold: number
  /** Global release progress, 0..1. Each blade cracks at its own time. */
  release: number
  /** Overall brightness envelope. It is 0 before rest. */
  energy: number
}

export interface PfxFrostBurstRuntimeState extends PfxFrostBurstLifecycle {
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

const GROW_START = 0.05
const GROW_END = 0.4
const FREEZE_START = 0.41
const RELEASE_START = 0.45
/** Every blade, puff and flake is gone by 0.85; nothing draws after this point. */
const REST_START = 0.88
/** Growth front distance that reaches the tip of the longest path. */
const FRONT_MAX = 1.2
/** Normalized-cycle life of one blade after it cracks. */
const BREAK_LIFE = 0.22

const REST: PfxFrostBurstLifecycle = { stage: 'rest', contact: 0, front: FRONT_MAX, hold: 0, release: 1, energy: 0 }

export function createPfxFrostBurstLifecycle(cycle: number): PfxFrostBurstLifecycle {
  const u = clamp01(cycle)
  if (u >= REST_START) return REST
  const contact = pulse(u, 0.045, 0.042)
  const grow = clamp01((u - GROW_START) / (GROW_END - GROW_START))
  // Steady growth that slows a little as the fan fills out.
  const front = FRONT_MAX * (1 - Math.pow(1 - grow, 1.3))
  const hold = smooth((u - 0.34) / 0.07) * (1 - smooth((u - 0.52) / 0.1))
  const release = clamp01((u - RELEASE_START) / (0.82 - RELEASE_START))
  const energy = smooth(u / 0.025) * (1 - smooth((u - 0.82) / 0.04))
  const stage: PfxFrostBurstStage = u < GROW_START + 0.01
    ? 'contact'
    : u < FREEZE_START ? 'growth' : u < RELEASE_START ? 'freeze' : 'release'
  return { stage, contact, front, hold, release, energy }
}

export function createPfxFrostBurstRuntimeState(
  input: {
    elapsedSeconds: number
    timing: number
    lifetime: number
    tempo: number
    motionMultiplier: number
    cycleScale: number
    reducedMotion: boolean
  },
  target?: PfxFrostBurstRuntimeState,
): PfxFrostBurstRuntimeState {
  // Same master clock as getPfxBurstCycleSeconds.
  const timeScale = Math.max(0.05, input.timing) * input.motionMultiplier * Math.max(0.1, input.tempo)
  const span = Math.max(0.3, Math.max(0.25, input.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER * Math.max(1, input.cycleScale)
  const cycle = ((Math.max(0, input.elapsedSeconds) * timeScale) % span) / span
  const lifecycle = createPfxFrostBurstLifecycle(cycle)
  const decorativeTime = cycle * (span / timeScale) * (input.reducedMotion ? 0.4 : 1)
  const state = target ?? { ...lifecycle, cycle: 0, decorativeTime: 0 }
  Object.assign(state, lifecycle, { cycle, decorativeTime })
  return state
}

// ---------------------------------------------------------------------------
// Crystal tree. Built once, deterministically, in local units.

type Vec3 = [number, number, number]

/** Camera yaw of the three-quarter review view. The fan opens toward it. */
const VIEW_YAW = 0.72
const RIGHT: Vec3 = [Math.cos(VIEW_YAW), 0, -Math.sin(VIEW_YAW)]
const TOWARD: Vec3 = [Math.sin(VIEW_YAW), 0, Math.cos(VIEW_YAW)]
const UP: Vec3 = [0, 1, 0]

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const normalize = (a: Vec3): Vec3 => scale(a, 1 / Math.max(1e-6, Math.hypot(a[0], a[1], a[2])))
const frame = (x: number, y: number, depth: number): Vec3 => add(add(scale(RIGHT, x), scale(UP, y)), scale(TOWARD, depth))

/** Root of the fan, where the cold contact bites. */
const CONTACT: Vec3 = frame(0.02, -0.44, 0.04)

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

interface FrostBlade {
  base: Vec3
  dir: Vec3
  /** Width axis. The blade is flat across it. */
  side: Vec3
  length: number
  width: number
  /** Arc distance from the contact to the blade base. */
  s0: number
  /** Growth speed of the stem this blade belongs to. */
  speed: number
  /** Normalized cycle position where the blade cracks. */
  breakStart: number
  generation: 0 | 1 | 2
  seed: number
}

/** [angle from vertical (deg), depth toward the viewer, length, width, growth speed]. */
const MAIN_STEMS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [-70, 0.42, 0.6, 0.05, 0.9],
  [-40, -0.6, 0.96, 0.058, 1.1],
  [-14, 0.34, 0.82, 0.054, 0.95],
  [6, 0.95, 0.5, 0.044, 0.84],
  [16, -0.3, 1.05, 0.062, 1.12],
  [42, 0.62, 0.76, 0.05, 0.92],
  [68, -0.42, 0.64, 0.046, 1.02],
]
/** Ice branches leave their parent at about 60 degrees. */
const BRANCH_ANGLE = (58 * Math.PI) / 180

function rotateAbout(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return add(add(scale(v, c), scale(cross(axis, v), s)), scale(axis, dot(axis, v) * (1 - c)))
}

function breakStartFor(s0: number, length: number, random: () => number): number {
  // Outer pieces crack first; the inner stems hold longest.
  return RELEASE_START + 0.12 * clamp01(1 - (s0 + length) / 1.3) + 0.05 * random()
}

function buildFrostTree(): FrostBlade[] {
  const random = seededRandom(0x5f3a91)
  const blades: FrostBlade[] = []
  for (const [angleDeg, depth, length, width, speed] of MAIN_STEMS) {
    const theta = (angleDeg * Math.PI) / 180
    const dir = normalize(add(add(scale(RIGHT, Math.sin(theta)), scale(UP, Math.cos(theta))), scale(TOWARD, depth)))
    // The flat face turns toward the viewer with an uneven twist.
    const flat = normalize(cross(dir, TOWARD))
    const side = normalize(rotateAbout(flat, dir, (random() - 0.5) * 1.1))
    const stem: FrostBlade = {
      base: CONTACT, dir, side, length, width, s0: 0, speed,
      breakStart: breakStartFor(0, length, random), generation: 0, seed: random(),
    }
    blades.push(stem)
    let sign = random() < 0.5 ? 1 : -1
    for (const fraction of [0.2, 0.33, 0.46, 0.58, 0.7, 0.83]) {
      if (random() < 0.28) continue
      sign = random() < 0.78 ? -sign : sign
      const thick = normalize(cross(dir, side))
      const childDir = normalize(add(add(scale(dir, Math.cos(BRANCH_ANGLE)), scale(side, sign * Math.sin(BRANCH_ANGLE))), scale(thick, (random() - 0.5) * 0.5)))
      const childLength = Math.min(0.42, length * (1 - fraction) * (0.4 + 0.32 * random()))
      if (childLength < 0.06) continue
      const childSide = normalize(rotateAbout(normalize(cross(childDir, thick)), childDir, (random() - 0.5) * 0.7))
      const childS0 = length * fraction
      const child: FrostBlade = {
        base: add(CONTACT, scale(dir, childS0)), dir: childDir, side: childSide, length: childLength,
        width: width * (0.5 + 0.12 * random()), s0: childS0, speed,
        breakStart: breakStartFor(childS0, childLength, random), generation: 1, seed: random(),
      }
      blades.push(child)
      if (childLength < 0.2) continue
      // Twigs on the longer ferns, on the outer side only.
      const childThick = normalize(cross(childDir, childSide))
      for (const twigFraction of [0.38, 0.66]) {
        if (random() < 0.35) continue
        const twigDir = normalize(add(add(scale(childDir, Math.cos(BRANCH_ANGLE)), scale(childSide, -sign * Math.sin(BRANCH_ANGLE) * (random() < 0.5 ? 1 : -1))), scale(childThick, (random() - 0.5) * 0.4)))
        const twigLength = childLength * (1 - twigFraction) * (0.45 + 0.3 * random())
        if (twigLength < 0.04) continue
        const twigS0 = childS0 + childLength * twigFraction
        blades.push({
          base: add(child.base, scale(childDir, childLength * twigFraction)), dir: twigDir,
          side: normalize(cross(twigDir, childThick)), length: twigLength, width: width * 0.3,
          s0: twigS0, speed, breakStart: breakStartFor(twigS0, twigLength, random), generation: 2, seed: random(),
        })
      }
    }
  }
  return blades
}

const FROST_TREE = buildFrostTree()
/** Number of ice blades in the body. */
export const PFX_FROST_BURST_BLADE_COUNT = FROST_TREE.length

const glslVec3 = (v: Vec3) => `vec3(${v.map((x) => x.toFixed(4)).join(', ')})`

const PFX_FROST_COMMON_GLSL = /* glsl */ `
const vec3 FROST_CONTACT = ${glslVec3(CONTACT)};
const float FROST_BREAK_LIFE = ${BREAK_LIFE.toFixed(3)};

float pfxFrostHash(vec2 p) {
  p = fract(p * vec2(0.3183099, 0.3678794) + 0.11);
  p *= 17.0;
  return fract(p.x * p.y * (p.x + p.y));
}
float pfxFrostNoise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(pfxFrostHash(i), pfxFrostHash(i + vec2(1.0, 0.0)), f.x),
             mix(pfxFrostHash(i + vec2(0.0, 1.0)), pfxFrostHash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Soft knee: values below 0.7 pass unchanged; brighter values approach 0.94
// so a single layer keeps its hue and does not clip to white.
vec3 pfxFrostKnee(vec3 c) {
  vec3 over = max(c - 0.7, 0.0);
  return min(c, vec3(0.7)) + 0.24 * (1.0 - exp(-over / 0.24));
}
`

const PFX_FROST_BODY_VERTEX = /* glsl */ `
uniform float uCycle;
uniform float uFront;
uniform float uMotion;
uniform float uReach;
attribute vec3 aBladeBase;
attribute vec3 aBladeDir;
attribute vec3 aBladeSide;
attribute vec4 aBladeShape;
attribute vec4 aBladeParams;
attribute vec2 aBladeTiming;
varying vec2 vCross;
varying float vA;
varying float vGrow;
varying float vRel;
varying float vSeed;
varying float vLen;
varying float vGen;
varying vec3 vViewPos;
varying float vDepth;
${PFX_FROST_COMMON_GLSL}

vec3 pfxFrostRotate(vec3 v, vec3 axis, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}

void main() {
  float a = aBladeShape.x;
  vec2 crossSection = aBladeShape.yz;
  float len = aBladeParams.x;
  float width = aBladeParams.y;
  float s0 = aBladeParams.z;
  float seed = aBladeParams.w;
  // The growth front reaches this blade's base at s0 and runs along it.
  float grown = clamp(uFront * aBladeTiming.x - s0, 0.0, len);
  float grow = grown / len;
  float rel = (uCycle - aBladeTiming.y) / FROST_BREAK_LIFE;
  float relC = clamp(rel, 0.0, 1.0);
  // Diamond section: wide flat face, thin ridge. Young blades are needles.
  float profile = pow(max(0.0, 1.0 - a), 0.7) * mix(0.6, 1.0, smoothstep(0.0, 0.22, a));
  float w = width * profile * mix(0.3, 1.0, grow) * pow(1.0 - relC, 0.6);
  vec3 thick = normalize(cross(aBladeDir, aBladeSide));
  vec3 local = aBladeDir * (a * grown) + aBladeSide * (crossSection.x * w) + thick * (crossSection.y * w * 0.36);
  // Brittle release: the piece cracks off, drifts away from the contact,
  // turns about its own width axis and falls a little.
  float drift = (1.0 - exp(-3.0 * relC)) / (1.0 - exp(-3.0));
  vec3 center = aBladeDir * grown * 0.5;
  vec3 outward = normalize(aBladeBase + center - FROST_CONTACT + vec3(0.0, 0.001, 0.0));
  float turn = (fract(seed * 7.13) - 0.5) * 1.8 * drift * uMotion;
  local = center + pfxFrostRotate(local - center, aBladeSide, turn);
  vec3 p = aBladeBase + local + (outward * (0.16 + 0.12 * fract(seed * 3.1)) * drift + vec3(0.0, -0.22 * relC * relC, 0.0)) * uMotion;
  p = FROST_CONTACT + (p - FROST_CONTACT) * uReach;

  vec4 viewPos = modelViewMatrix * vec4(p, 1.0);
  vCross = crossSection;
  vA = a;
  vGrow = grow;
  vRel = rel;
  vSeed = seed;
  vLen = len;
  vGen = aBladeShape.w;
  vViewPos = viewPos.xyz;
  vDepth = (viewPos.z - (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).z) / max(1e-4, length(modelViewMatrix[0].xyz));
  gl_Position = projectionMatrix * viewPos;
}
`

export const PFX_FROST_BURST_BODY_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uEnergy;
uniform float uHold;
uniform float uFlare;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uColorDeep;
uniform vec3 uColorEdge;
varying vec2 vCross;
varying float vA;
varying float vGrow;
varying float vRel;
varying float vSeed;
varying float vLen;
varying float vGen;
varying vec3 vViewPos;
varying float vDepth;
${PFX_FROST_COMMON_GLSL}

float pfxFrostLine(float value, float widthPx) {
  float dist = (1.0 - abs(value)) / max(fwidth(value), 1e-4);
  return 1.0 - clamp(dist / widthPx, 0.0, 1.0);
}

void main() {
  if (vGrow <= 0.0) discard;
  // Sublimation: the cracked piece erodes from noisy edges, and the eroding
  // boundary glows cold white for a moment.
  float relC = clamp(vRel, 0.0, 1.0);
  float n = pfxFrostNoise(vec2(vA * vLen * 16.0 + vSeed * 13.0, vCross.x * 1.4 + vSeed * 5.0));
  float cut = relC * 1.3 - 0.18;
  if (vRel > 0.0 && n < cut) discard;
  float erodeEdge = vRel > 0.0 ? 1.0 - smoothstep(0.0, 0.08, n - cut) : 0.0;

  vec3 viewDir = normalize(-vViewPos);
  vec3 nrm = normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));
  if (dot(nrm, viewDir) < 0.0) nrm = -nrm;
  vec3 light = normalize(vec3(0.35, 0.8, 0.5));
  // Flat facets: each face of the diamond section has one light level.
  float facet = abs(dot(nrm, light));
  float spec = pow(max(0.0, dot(reflect(-light, nrm), viewDir)), 14.0);
  float rim = pow(1.0 - abs(dot(nrm, viewDir)), 2.0);
  float edgeLine = pfxFrostLine(vCross.x, 1.3);
  float spineLine = pfxFrostLine(vCross.y, 1.1);

  // The growing tip is the freezing front: it leads with a white point.
  float tipGlow = smoothstep(0.72, 1.0, vA) * (1.0 - vGrow) * step(vGrow, 0.999);
  // Crack: one short white ping at the broken root of the piece.
  float crack = vRel > 0.0 ? uFlare * exp(-pow((vRel - 0.04) / 0.04, 2.0)) * (0.25 + 0.75 * (1.0 - smoothstep(0.0, 0.3, vA))) * 0.3 : 0.0;
  // Frozen hold: a slow glint moves along each blade.
  float glint = uHold * exp(-pow((vA - fract(uTime * 0.5 + vSeed)) * 6.0, 2.0)) * 0.4;
  float near = clamp(vDepth * 2.4, -1.0, 1.0);

  float energy = 0.16 + 0.4 * facet * facet + 0.45 * spec + 0.26 * rim + 0.62 * edgeLine + 0.28 * spineLine;
  energy *= mix(1.0, 0.8, vGen * 0.5);
  // The main stems all leave the contact: dim their shared roots so the
  // overlap does not clip to white.
  energy *= vGen < 0.5 ? mix(0.35, 1.0, smoothstep(0.0, 0.16, vA * vLen)) : 1.0;
  energy += tipGlow * 0.8 + crack + erodeEdge * 0.6 + glint;
  // Near pieces read brighter and whiter, far pieces dimmer and deeper.
  energy *= mix(0.5, 1.1, near * 0.5 + 0.5);
  vec3 color = mix(uColorDeep, uColor, clamp(facet * 0.9 + 0.1 + near * 0.25, 0.0, 1.0));
  color = mix(color, uColorEdge, clamp(edgeLine * 0.85 + spec + tipGlow + crack * 0.5 + erodeEdge * 0.7 + glint * 0.8 + max(0.0, near) * 0.15, 0.0, 1.0));
  gl_FragColor = vec4(pfxFrostKnee(color * energy) * uEnergy, uOpacity);
}
`

/** Accent kinds in the mist layer. */
const MIST_CONTACT_STAR = 0
const MIST_CONTACT_VAPOR = 1
const MIST_RELEASE_VAPOR = 2
const MIST_FLAKE = 3

const PFX_FROST_MIST_VERTEX = /* glsl */ `
uniform float uCycle;
uniform float uMotion;
uniform float uReach;
uniform float uFlare;
uniform float uContact;
uniform float uTime;
attribute vec2 aCorner;
attribute vec4 aMist;
attribute vec3 aAnchor;
attribute vec3 aDrift;
varying vec2 vUv;
varying float vType;
varying float vFade;
varying float vSeed;
varying float vTau;
${PFX_FROST_COMMON_GLSL}

void main() {
  float type = aMist.x;
  float seed = aMist.y;
  float size = aMist.z;
  float start = aMist.w;
  vec3 anchor = FROST_CONTACT + (aAnchor - FROST_CONTACT) * uReach;
  vec3 p = anchor;
  float s = 0.0;
  float fade = 0.0;
  float angle = seed * 6.2831;
  float squash = 1.0;
  float tau = 0.0;
  if (type < 0.5) {
    // Cold contact: a six-point frost star bites at the root of the fan.
    s = size * (0.55 + 0.45 * uContact) * mix(0.75, 1.0, uFlare);
    fade = uContact * mix(0.5, 1.0, uFlare);
    angle += uTime * 0.25;
  } else if (type < 1.5) {
    // Contact vapor: a small cold breath that leaves the contact.
    tau = (uCycle - start) / 0.28;
    p = anchor + aDrift * 0.14 * (1.0 - exp(-3.0 * tau)) * uMotion + vec3(0.0, 0.05 * tau, 0.0) * uMotion;
    s = size * (0.5 + 0.8 * tau);
    fade = smoothstep(0.0, 0.15, tau) * (1.0 - smoothstep(0.45, 1.0, tau)) * 0.75;
  } else if (type < 2.5) {
    // Release vapor: sublimation from the cracked blades, rising slowly.
    tau = (uCycle - start) / 0.28;
    p = anchor + (aDrift * 0.22 * (1.0 - exp(-2.5 * tau)) + vec3(0.0, 0.14 * tau, 0.0)) * uMotion;
    s = size * (0.45 + 0.9 * tau);
    fade = smoothstep(0.0, 0.2, tau) * (1.0 - smoothstep(0.4, 1.0, tau));
  } else {
    // Flakes: small facets break away, tumble slowly and shrink.
    tau = (uCycle - start) / 0.26;
    float travel = (1.0 - exp(-2.5 * tau)) / (1.0 - exp(-2.5));
    p = anchor + (aDrift * 0.36 * travel + vec3(0.0, -0.2 * tau * tau, 0.0)) * uMotion;
    float tumble = seed * 6.2831 + tau * 3.0 * uMotion;
    squash = mix(0.3, 1.0, abs(cos(tumble)));
    angle += tau * 1.5 * uMotion;
    s = size * pow(max(0.0, 1.0 - tau), 0.8);
    fade = smoothstep(0.0, 0.08, tau) * (0.55 + 0.45 * squash);
  }
  if (type > 0.5 && (tau < 0.0 || tau > 1.0)) s = 0.0;

  vec4 viewPos = modelViewMatrix * vec4(p, 1.0);
  float scale = length(modelViewMatrix[0].xyz);
  vec2 corner = vec2(aCorner.x * squash, aCorner.y);
  float c = cos(angle);
  float sn = sin(angle);
  viewPos.xy += mat2(c, sn, -sn, c) * corner * s * scale;
  vUv = aCorner;
  vType = type;
  vFade = fade;
  vSeed = seed;
  vTau = tau;
  gl_Position = projectionMatrix * viewPos;
}
`

export const PFX_FROST_BURST_ACCENT_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uEnergy;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uColorDeep;
uniform vec3 uColorEdge;
varying vec2 vUv;
varying float vType;
varying float vFade;
varying float vSeed;
varying float vTau;
${PFX_FROST_COMMON_GLSL}

void main() {
  if (vFade <= 0.0) discard;
  float r = length(vUv);
  float energy = 0.0;
  vec3 color = uColor;
  if (vType < 0.5) {
    vec2 dir = vUv / max(r, 1e-4);
    float a6 = abs(dir.x * dir.x * dir.x - 3.0 * dir.x * dir.y * dir.y);
    float arms = pow(a6, 40.0) * (1.0 - smoothstep(0.1, 1.0, r));
    float a6b = abs(3.0 * dir.x * dir.x * dir.y - dir.y * dir.y * dir.y);
    float minor = pow(a6b, 60.0) * (1.0 - smoothstep(0.05, 0.5, r));
    float core = exp(-r * r * 60.0);
    energy = arms * 1.1 + minor * 0.7 + core * 1.2;
    color = mix(uColor, uColorEdge, clamp(core + arms * 0.6, 0.0, 1.0));
  } else if (vType < 2.5) {
    // Soft vapor with a broken, noisy edge. It never closes into a ring.
    float n = pfxFrostNoise(vUv * 2.4 + vec2(vSeed * 17.0, vSeed * 9.0 + uTime * 0.35));
    float body = 1.0 - smoothstep(0.25, 1.0, r + (n - 0.5) * 0.6);
    energy = body * body * (0.2 + 0.08 * n);
    color = mix(uColor, uColorEdge, 0.4 + 0.2 * n);
  } else {
    float d = abs(vUv.x) + abs(vUv.y) * 0.62;
    float shape = 1.0 - smoothstep(0.7, 1.0, d);
    float edge = smoothstep(0.55, 0.9, d) * shape;
    energy = shape * (0.5 + edge * 0.7);
    color = mix(uColor, uColorEdge, 0.55 + edge * 0.4);
  }
  if (energy <= 0.002) discard;
  gl_FragColor = vec4(pfxFrostKnee(color * energy * vFade) * uEnergy, uOpacity);
}
`

/** Ice, deep and white edge tones derived from one control colour. */
function frostPalette(color: THREE.ColorRepresentation): { base: THREE.Color; deep: THREE.Color; edge: THREE.Color } {
  const source = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  source.getHSL(hsl)
  // The control colour sets the ice. The deep tone is the same hue, darker
  // and a little further round the wheel; the edge is the ice lifted toward
  // white. A new control colour moves all three.
  const base = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.85 + 0.1), Math.min(0.7, Math.max(0.5, hsl.l * 0.95)))
  const deep = new THREE.Color().setHSL((hsl.h + 0.025) % 1, Math.min(1, hsl.s * 0.9 + 0.1), Math.min(0.42, Math.max(0.24, hsl.l * 0.5)))
  const edge = base.clone().lerp(new THREE.Color('#f4fbff'), 0.78)
  return { base, deep, edge }
}

const vec3Of = (color: THREE.Color) => new THREE.Vector3(color.r, color.g, color.b)

function paletteUniforms(opacity: number, color: THREE.ColorRepresentation) {
  const palette = frostPalette(color)
  return {
    uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
    uColor: { value: vec3Of(palette.base) },
    uColorDeep: { value: vec3Of(palette.deep) },
    uColorEdge: { value: vec3Of(palette.edge) },
  }
}

function finishMaterial(material: THREE.ShaderMaterial, part: 'body' | 'accent'): THREE.ShaderMaterial {
  material.forceSinglePass = true
  material.userData['pfxFrostBurstMaterial'] = part
  material.userData['pfxFrostBurstFragmentTextureSamples'] = 0
  return material
}

export function createPfxFrostBurstBodyMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return finishMaterial(new THREE.ShaderMaterial({
    uniforms: {
      uCycle: { value: 0 },
      uFront: { value: 0 },
      uMotion: { value: 1 },
      uReach: { value: 1 },
      uHold: { value: 0 },
      uFlare: { value: 1 },
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      ...paletteUniforms(opacity, color),
    },
    vertexShader: PFX_FROST_BODY_VERTEX,
    fragmentShader: PFX_FROST_BURST_BODY_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), 'body')
}

export function createPfxFrostBurstAccentMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return finishMaterial(new THREE.ShaderMaterial({
    uniforms: {
      uCycle: { value: 0 },
      uMotion: { value: 1 },
      uReach: { value: 1 },
      uFlare: { value: 1 },
      uContact: { value: 0 },
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      ...paletteUniforms(opacity, color),
    },
    vertexShader: PFX_FROST_MIST_VERTEX,
    fragmentShader: PFX_FROST_BURST_ACCENT_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), 'accent')
}

/** Writes one runtime state into either frost-burst material. */
export function applyPfxFrostBurstUniforms(
  material: THREE.ShaderMaterial,
  state: PfxFrostBurstRuntimeState,
  opacity: number,
  reducedMotion: boolean,
): void {
  const u = material.uniforms
  // Reduced motion keeps the event and its timing. It cuts the drift, turn
  // and fall of the cracked pieces and the flake and vapor travel to about a
  // third, shortens the fan, and softens the contact star and crack pings.
  u.uMotion!.value = reducedMotion ? 0.32 : 1
  u.uReach!.value = reducedMotion ? 0.8 : 1
  u.uFlare!.value = reducedMotion ? 0.4 : 1
  u.uOpacity!.value = state.stage === 'rest' ? 0 : opacity
  u.uCycle!.value = state.cycle
  u.uTime!.value = state.decorativeTime
  u.uEnergy!.value = state.energy
  const part = material.userData['pfxFrostBurstMaterial'] as 'body' | 'accent'
  if (part === 'body') {
    u.uFront!.value = state.front
    u.uHold!.value = state.hold
    return
  }
  if (part === 'accent') {
    u.uContact!.value = state.contact
    return
  }
  const unhandled: never = part
  throw new Error(`Unknown frost-burst material part: ${String(unhandled)}`)
}

/** Diamond cross-section: edge, ridge, edge, ridge. */
const CROSS_SECTION: ReadonlyArray<readonly [number, number]> = [[-1, 0], [0, 1], [1, 0], [0, -1]]
const BLADE_RINGS = [0, 0.3, 0.64, 1]

/**
 * Library-owned crystal fan. Every blade is a tapered diamond prism; the
 * vertex shader grows, cracks and moves it from per-blade attributes.
 */
export function createPfxFrostBurstBodyGeometry(): THREE.BufferGeometry {
  const base: number[] = []
  const dir: number[] = []
  const side: number[] = []
  const shape: number[] = []
  const params: number[] = []
  const timing: number[] = []
  const indices: number[] = []
  for (const blade of FROST_TREE) {
    const first = shape.length / 4
    for (const a of BLADE_RINGS) {
      for (const [cx, cy] of CROSS_SECTION) {
        base.push(...blade.base)
        dir.push(...blade.dir)
        side.push(...blade.side)
        shape.push(a, cx, cy, blade.generation)
        params.push(blade.length, blade.width, blade.s0, blade.seed)
        timing.push(blade.speed, blade.breakStart)
      }
    }
    const ringSize = CROSS_SECTION.length
    for (let ring = 0; ring < BLADE_RINGS.length - 1; ring += 1) {
      for (let k = 0; k < ringSize; k += 1) {
        const a0 = first + ring * ringSize + k
        const a1 = first + ring * ringSize + ((k + 1) % ringSize)
        const b0 = a0 + ringSize
        const b1 = a1 + ringSize
        indices.push(a0, a1, b1, a0, b1, b0)
      }
    }
    // Base cap so the root end of a cracked piece is closed.
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
  }
  const geometry = new THREE.BufferGeometry()
  const count = shape.length / 4
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3))
  geometry.setAttribute('aBladeBase', new THREE.Float32BufferAttribute(base, 3))
  geometry.setAttribute('aBladeDir', new THREE.Float32BufferAttribute(dir, 3))
  geometry.setAttribute('aBladeSide', new THREE.Float32BufferAttribute(side, 3))
  geometry.setAttribute('aBladeShape', new THREE.Float32BufferAttribute(shape, 4))
  geometry.setAttribute('aBladeParams', new THREE.Float32BufferAttribute(params, 4))
  geometry.setAttribute('aBladeTiming', new THREE.Float32BufferAttribute(timing, 2))
  geometry.setIndex(indices)
  // The vertex shader grows and moves the blades. Bound the full motion.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.6)
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-1.6, -1.6, -1.6), new THREE.Vector3(1.6, 1.6, 1.6))
  geometry.userData['pfxFrostBurstGeometry'] = 'body'
  geometry.userData['pfxFrostBurstBlades'] = FROST_TREE.length
  geometry.userData['pfxFrostBurstTriangles'] = indices.length / 3
  return geometry
}

const CONTACT_VAPOR_COUNT = 6
const RELEASE_VAPOR_COUNT = 16
const FLAKE_COUNT = 46

/** Camera-facing quads for the contact star, vapor and flakes. */
export function createPfxFrostBurstAccentGeometry(): THREE.BufferGeometry {
  const random = seededRandom(0x1c3b77)
  const corner: number[] = []
  const mist: number[] = []
  const anchor: number[] = []
  const drift: number[] = []
  const indices: number[] = []
  const push = (type: number, seed: number, size: number, start: number, at: Vec3, towards: Vec3) => {
    const first = corner.length / 2
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      corner.push(x, y)
      mist.push(type, seed, size, start)
      anchor.push(...at)
      drift.push(...towards)
    }
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
  }
  const pointOn = (blade: FrostBlade, fraction: number): Vec3 => add(blade.base, scale(blade.dir, blade.length * fraction))
  const outwardFrom = (point: Vec3): Vec3 => {
    const away = add(point, scale(CONTACT, -1))
    return normalize(add(normalize(add(away, [0, 0.001, 0])), [(random() - 0.5) * 0.7, (random() - 0.5) * 0.5, (random() - 0.5) * 0.7]))
  }
  push(MIST_CONTACT_STAR, 0.37, 0.24, 0, CONTACT, [0, 1, 0])
  for (let index = 0; index < CONTACT_VAPOR_COUNT; index += 1) {
    const at = add(CONTACT, [(random() - 0.5) * 0.18, (random() - 0.3) * 0.08, (random() - 0.5) * 0.18])
    const towards = normalize([(random() - 0.5) * 2, 0.35 + random() * 0.4, (random() - 0.5) * 2])
    push(MIST_CONTACT_VAPOR, random(), 0.1 + random() * 0.06, 0.03 + random() * 0.03, at, towards)
  }
  const larger = FROST_TREE.filter((blade) => blade.generation < 2)
  for (let index = 0; index < RELEASE_VAPOR_COUNT; index += 1) {
    const blade = larger[Math.floor(random() * larger.length)]!
    const at = pointOn(blade, 0.3 + random() * 0.6)
    push(MIST_RELEASE_VAPOR, random(), 0.12 + random() * 0.08, blade.breakStart + 0.01 + random() * 0.02, at, outwardFrom(at))
  }
  // Flakes favour long blades: pick by length.
  const totalLength = FROST_TREE.reduce((sum, blade) => sum + blade.length, 0)
  for (let index = 0; index < FLAKE_COUNT; index += 1) {
    let pick = random() * totalLength
    let blade = FROST_TREE[0]!
    for (const candidate of FROST_TREE) {
      pick -= candidate.length
      if (pick <= 0) {
        blade = candidate
        break
      }
    }
    const at = pointOn(blade, 0.15 + random() * 0.8)
    const towards = outwardFrom(at)
    push(MIST_FLAKE, random(), 0.022 + random() * 0.026, blade.breakStart + random() * 0.03, at, [towards[0], towards[1] - 0.25, towards[2]])
  }
  const geometry = new THREE.BufferGeometry()
  const count = corner.length / 2
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3))
  geometry.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 2))
  geometry.setAttribute('aMist', new THREE.Float32BufferAttribute(mist, 4))
  geometry.setAttribute('aAnchor', new THREE.Float32BufferAttribute(anchor, 3))
  geometry.setAttribute('aDrift', new THREE.Float32BufferAttribute(drift, 3))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.8)
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-1.8, -1.8, -1.8), new THREE.Vector3(1.8, 1.8, 1.8))
  geometry.userData['pfxFrostBurstGeometry'] = 'accent'
  geometry.userData['pfxFrostBurstTriangles'] = indices.length / 3
  return geometry
}
