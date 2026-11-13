import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

// bubble-burst: a soap bubble swells into view and wobbles once. The film is
// almost clear: thin interference bands drift over it, colour gathers at the
// silhouette, and one small window highlight sits on the front. The film
// then tears at one point on the upper left. The tear is fast and lopsided:
// it races down and to the right while it opens, so the hole is never a
// round cap. A thick, beaded liquid rim rolls back ahead of the hole and the
// film behind it is gone. As the rim passes, it throws fine liquid strands
// that pinch into beads, and a mist of tiny drops. The drops fall, shrink
// and die. Nothing remains before the preview wraps.
//
// All tints come from the one control colour. The film is additive light
// over the scene; it samples no texture or scene colour and uses no raymarch.

export type PfxBubbleBurstStage = 'form' | 'whole' | 'rupture' | 'scatter' | 'rest'

export interface PfxBubbleBurstLifecycle {
  stage: PfxBubbleBurstStage
  /** Small pin of light at the tear point, 0..1. */
  flare: number
  /** Overall film visibility. */
  energy: number
}

export interface PfxBubbleBurstRuntimeState extends PfxBubbleBurstLifecycle {
  /** Normalized master-cycle position in [0, 1). */
  cycle: number
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

const FORM_END = 0.08
const POP_START = 0.295
/** About 0.11 s at the standard period: three frames at 30 fps. */
const POP_DURATION = 0.1
/**
 * Hole radius at the end of the tear. It passes pi by more than the largest
 * rim rag, so the whole film is open when the tear ends.
 */
const OPEN_END_ANGLE = Math.PI + 0.36
/**
 * How far the hole centre slides toward the tear direction (radians). The
 * slide ends on the upper-left silhouette, so the last film is a thin
 * sliver on the lower-right silhouette and never a disc seen through the
 * hole.
 */
const TEAR_SHIFT = 0.62
/** Strand and mist lives end by about 0.58. */
const REST_START = 0.72

const REST: PfxBubbleBurstLifecycle = { stage: 'rest', flare: 0, energy: 0 }

export function createPfxBubbleBurstLifecycle(cycle: number): PfxBubbleBurstLifecycle {
  const u = clamp01(cycle)
  if (u >= REST_START) return REST
  const stage: PfxBubbleBurstStage = u < FORM_END ? 'form' : u < POP_START ? 'whole' : u < POP_START + POP_DURATION ? 'rupture' : 'scatter'
  const flare = pulse(u, POP_START + 0.005, 0.02)
  const energy = smooth(u / 0.06)
  return { stage, flare, energy }
}

export function createPfxBubbleBurstRuntimeState(
  input: {
    elapsedSeconds: number
    timing: number
    lifetime: number
    tempo: number
    motionMultiplier: number
    cycleScale: number
    reducedMotion: boolean
  },
  target?: PfxBubbleBurstRuntimeState,
): PfxBubbleBurstRuntimeState {
  // Same master clock as getPfxBurstCycleSeconds.
  const timeScale = Math.max(0.05, input.timing) * input.motionMultiplier * Math.max(0.1, input.tempo)
  const span = Math.max(0.3, Math.max(0.25, input.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER * Math.max(1, input.cycleScale)
  const cycle = ((Math.max(0, input.elapsedSeconds) * timeScale) % span) / span
  const lifecycle = createPfxBubbleBurstLifecycle(cycle)
  const state = target ?? { ...lifecycle, cycle: 0 }
  Object.assign(state, lifecycle, { cycle })
  return state
}

const BUBBLE_RADIUS = 0.56
/** Tear point: upper left on the face seen by the three-quarter camera. */
const POP_AXIS = new THREE.Vector3(-0.22, 0.74, 0.64).normalize()
/** Tear direction: tangent at the tear point, toward the upper-left silhouette. */
const TEAR_DIRECTION = (() => {
  const toward = new THREE.Vector3(-0.687, 0.666, 0.29)
  return toward.sub(POP_AXIS.clone().multiplyScalar(toward.dot(POP_AXIS))).normalize()
})()
const POP_E2 = POP_AXIS.clone().cross(TEAR_DIRECTION).normalize()
const glslVec3 = (v: THREE.Vector3) => `vec3(${v.x.toFixed(5)}, ${v.y.toFixed(5)}, ${v.z.toFixed(5)})`

const PFX_BUBBLE_SHAPE_GLSL = /* glsl */ `
uniform float uCycle;
uniform float uMotion;

const float BUBBLE_RADIUS = ${BUBBLE_RADIUS.toFixed(3)};
const vec3 BUBBLE_POP = ${glslVec3(POP_AXIS)};
const vec3 BUBBLE_TEAR = ${glslVec3(TEAR_DIRECTION)};
const vec3 BUBBLE_E2 = ${glslVec3(POP_E2)};
const float BUBBLE_POP_START = ${POP_START.toFixed(3)};
const float BUBBLE_POP_DURATION = ${POP_DURATION.toFixed(3)};
const float BUBBLE_OPEN_END = ${OPEN_END_ANGLE.toFixed(5)};
const float BUBBLE_TEAR_SHIFT = ${TEAR_SHIFT.toFixed(3)};

float bubbleSat(float x) { return clamp(x, 0.0, 1.0); }
float bubbleSmooth(float x) { x = bubbleSat(x); return x * x * (3.0 - 2.0 * x); }

// Tear progress, 0..1. Constant rim speed, as in a real film.
float bubbleTear(float u) { return bubbleSat((u - BUBBLE_POP_START) / BUBBLE_POP_DURATION); }

// Swell with a small overshoot. Reduced motion keeps less overshoot.
float bubbleInflate(float u) {
  float x = bubbleSat(u / 0.09);
  float ease = 1.0 - pow(1.0 - x, 3.0);
  // Explicit products: GLSL pow() is undefined for a negative base.
  float t = x - 1.0;
  float back = 1.0 + 2.2 * t * t * t + 1.2 * t * t;
  return 0.7 + 0.3 * mix(ease, back, uMotion);
}

vec3 bubbleCenter(float u) {
  return vec3(0.0, 0.1 + 0.05 * uMotion * bubbleSmooth(u / 0.4), 0.0);
}

// One slow surface-tension wobble that settles before the tear.
float bubbleWobble(vec3 n, float u) {
  vec3 axis = normalize(vec3(0.3, 1.0, -0.2));
  float c = dot(n, axis);
  float p2 = 1.5 * c * c - 0.5;
  return 0.05 * uMotion * sin(6.2831853 * 2.6 * u + 0.6) * exp(-u * 7.0) * p2;
}

float bubbleHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float bubbleNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bubbleHash(i), bubbleHash(i + vec3(1.0, 0.0, 0.0)), f.x),
                 mix(bubbleHash(i + vec3(0.0, 1.0, 0.0)), bubbleHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(bubbleHash(i + vec3(0.0, 0.0, 1.0)), bubbleHash(i + vec3(1.0, 0.0, 1.0)), f.x),
                 mix(bubbleHash(i + vec3(0.0, 1.0, 1.0)), bubbleHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}

// Hole centre: it starts at the tear point and slides along the tear
// direction while the hole grows. The slide is fastest at the start, so
// the young hole is a lopsided tear (leading rim about three times faster
// than the trailing rim), never a round cap.
vec3 bubbleHoleCenter(float x) {
  float y = 1.0 - x;
  float shift = BUBBLE_TEAR_SHIFT * (0.55 + 0.45 * uMotion) * (1.0 - y * y * y);
  return cos(shift) * BUBBLE_POP + sin(shift) * BUBBLE_TEAR;
}

// Film thickness irregularity fixed in the film, so the rim stays ragged
// in the same places while it runs.
float bubbleRag(vec3 n) {
  return (bubbleNoise(n * 3.6 + 3.1) - 0.5) * 0.4 + (bubbleNoise(n * 9.0 - 1.7) - 0.5) * 0.16;
}

// Signed angle from the rim to a film point. Positive: film still there.
float bubbleRimDistance(vec3 n, float x) {
  float open = BUBBLE_OPEN_END * x;
  float a = acos(clamp(dot(n, bubbleHoleCenter(x)), -1.0, 1.0));
  return a - open - bubbleRag(n) * bubbleSat(open / 0.5);
}

// Tear progress at which the rim reaches film point n. The rim distance
// falls monotonically with x, so bisection converges.
float bubbleReleaseProgress(vec3 n) {
  float lo = 0.0;
  float hi = 1.0;
  for (int i = 0; i < 12; i++) {
    float mid = 0.5 * (lo + hi);
    if (bubbleRimDistance(n, mid) > 0.0) lo = mid; else hi = mid;
  }
  return hi;
}

// Palette-derived interference tint for a film thickness and view angle.
vec3 bubbleFilmTint(float thickness, float facing, vec3 tintA, vec3 tintB, vec3 tintC) {
  float cosT = sqrt(1.0 - (1.0 - facing * facing) / 1.77);
  float phase = thickness * 2.3 * cosT;
  vec3 w = 0.5 + 0.5 * cos(6.2831853 * (phase + vec3(0.0, 0.33, 0.67)));
  w = w * w;
  return (w.x * tintA + w.y * tintB + w.z * tintC) / max(w.x + w.y + w.z, 1e-3);
}
`

const PFX_BUBBLE_FILM_VERTEX = /* glsl */ `
varying vec3 vSphere;
varying vec3 vWorld;
varying vec3 vNormal;
${PFX_BUBBLE_SHAPE_GLSL}

void main() {
  vec3 n = normalize(position);
  float u = uCycle;
  float x = bubbleTear(u);
  float radius = BUBBLE_RADIUS * bubbleInflate(u) * (1.0 + bubbleWobble(n, u));
  // Ahead of the rim the film gathers into a rolled lip and flaps in short
  // ripples. Reduced motion keeps a smaller lip and ripple.
  float d = bubbleRimDistance(n, x);
  float tearing = step(0.0001, x) * step(x, 0.9999);
  float ahead = max(d, 0.0);
  float lip = 0.045 * exp(-(ahead * ahead) / 0.004);
  float ripple = 0.016 * sin(ahead * 52.0 + bubbleNoise(n * 7.0) * 6.0) * exp(-ahead / 0.09);
  radius += tearing * BUBBLE_RADIUS * (lip + ripple) * (0.45 + 0.55 * uMotion);
  vec3 p = bubbleCenter(u) + n * radius;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vSphere = n;
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const PFX_BUBBLE_BURST_BODY_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uEnergy;
uniform float uFlare;
uniform vec3 uTintA;
uniform vec3 uTintB;
uniform vec3 uTintC;
uniform vec3 uColorEdge;
uniform vec3 uColorLight;
varying vec3 vSphere;
varying vec3 vWorld;
varying vec3 vNormal;
${PFX_BUBBLE_SHAPE_GLSL}

// Small soft-cornered light window seen as a reflection on the film.
float bubbleWindow(vec3 r, vec3 dir, vec2 size) {
  vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), dir));
  vec3 up = cross(dir, side);
  if (dot(r, dir) <= 0.0) return 0.0;
  vec2 q = vec2(dot(r, side), dot(r, up)) / dot(r, dir);
  return 1.0 - smoothstep(0.6, 1.0, length(q / size));
}

void main() {
  vec3 n = normalize(vSphere);
  float u = uCycle;
  float x = bubbleTear(u);
  float d = bubbleRimDistance(n, x);
  float tearing = step(0.0001, x);
  if (tearing > 0.0 && d < 0.0) discard;

  vec3 nw = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorld);
  float facing = abs(dot(nw, v));
  float graze = 1.0 - facing;
  float back = gl_FrontFacing ? 1.0 : 0.5;

  // Film drains: thin at the top, thicker below. Bands drift slowly and
  // show as fine lines, not a fill. Nothing flickers.
  float swirl = bubbleNoise(n * 2.4 + vec3(0.0, -u * 1.6, u * 0.8));
  float eddy = bubbleNoise(n * 5.5 + vec3(u * 0.9, -u * 2.2, 0.0));
  float thickness = 0.35 + 0.55 * (0.5 - 0.5 * n.y) + 0.75 * swirl + 0.18 * eddy;
  vec3 tint = bubbleFilmTint(thickness, facing, uTintA, uTintB, uTintC);
  float band = 0.5 + 0.5 * cos(6.2831853 * thickness * 2.6);
  band *= band;
  band *= band;
  float fresnel = graze * graze * graze;
  float sheen = 0.012 + 0.09 * band * smoothstep(0.05, 0.7, graze) + 0.72 * fresnel;
  // Thin silver line exactly at the silhouette.
  float outline = smoothstep(0.86, 0.985, graze) * 0.35;

  vec3 r = reflect(-v, nw);
  float windows = gl_FrontFacing ? 0.8 * bubbleWindow(r, normalize(vec3(-0.45, 0.7, 0.55)), vec2(0.13, 0.085)) : 0.0;

  // Rolled liquid rim: thick, beaded, and thicker as it gathers film.
  float bead = 0.5 + 0.9 * bubbleNoise(n * 17.0 + 4.0);
  float rimWidth = (0.03 + 0.025 * x) * bead;
  float rim = tearing * exp(-(d * d) / (rimWidth * rimWidth));
  // Film just ahead of the rim thins and loses colour.
  float thinning = tearing * exp(-max(d, 0.0) / 0.25);
  float pin = uFlare * exp(-pow(acos(clamp(dot(n, BUBBLE_POP), -1.0, 1.0)) / 0.07, 2.0));

  vec3 color = tint * sheen * (1.0 - 0.6 * thinning) * back;
  color += uColorLight * (outline * back + windows);
  color += uColorEdge * (rim * mix(0.85, 1.25, uMotion) * back + pin * 0.9);
  gl_FragColor = vec4(color * uEnergy, uOpacity);
}
`

const STRAND_COUNT = 30
const MIST_COUNT = 34

const PFX_BUBBLE_SPRAY_VERTEX = /* glsl */ `
attribute vec4 aSpray;
attribute vec2 aCorner;
varying vec2 vCorner;
varying float vKind;
varying float vLife;
varying float vAspect;
varying float vSeed;
${PFX_BUBBLE_SHAPE_GLSL}

// Position of one shed drop at a time after release. Drag slows the throw;
// gravity bends it down. Reduced motion shortens the whole arc.
vec3 bubbleThrow(vec3 origin, vec3 dir, float speed, float dt) {
  float drag = 16.0;
  float travel = speed * (1.0 - exp(-drag * dt)) / drag;
  return origin + uMotion * (dir * travel + vec3(0.0, -4.5 * dt * dt, 0.0));
}

void main() {
  float a = aSpray.x;
  float phi = aSpray.y;
  float kind = aSpray.z;
  float seed = aSpray.w;
  float u = uCycle;

  vec3 radial = cos(phi) * BUBBLE_TEAR + sin(phi) * BUBBLE_E2;
  vec3 n0 = cos(a) * BUBBLE_POP + sin(a) * radial;
  // Released when the rim reaches this point of the film.
  float xr = bubbleReleaseProgress(n0);
  float release = BUBBLE_POP_START + BUBBLE_POP_DURATION * xr;
  float life = kind < 0.5 ? 0.11 + 0.07 * seed : 0.07 + 0.05 * seed;
  float dt = u - release;
  float tau = dt / life;
  float alive = step(0.0, tau) * step(tau, 1.0);

  // The rim runs away from the hole centre; shed liquid keeps that motion
  // and leaves the curved film along its tangent.
  vec3 c = bubbleHoleCenter(xr);
  vec3 away = dot(n0, c) * n0 - c;
  away = length(away) > 1e-4 ? normalize(away) : BUBBLE_TEAR;
  vec3 side = normalize(cross(n0, away));
  float jitter = (fract(seed * 13.7) - 0.5) * 0.7;
  vec3 dir = normalize(away + n0 * (0.35 + 0.3 * fract(seed * 5.3)) + side * jitter);
  vec3 origin = bubbleCenter(release) + n0 * BUBBLE_RADIUS * bubbleInflate(release);
  float speed = kind < 0.5 ? 2.2 + 1.4 * seed : 3.4 + 1.8 * seed;
  float tt = clamp(dt, 0.0, life);
  vec3 head = bubbleThrow(origin, dir, speed, tt);

  vec4 view = modelViewMatrix * vec4(head, 1.0);
  float unit = length(modelViewMatrix[0].xyz);
  float lifeT = clamp(tau, 0.0, 1.0);
  // Drops die by size at full brightness.
  float shrink = 1.0 - 0.6 * bubbleSmooth((lifeT - 0.35) / 0.65);
  vec2 offset;
  if (kind < 0.5) {
    // Strand: a short liquid thread along its travel. It stretches, pinches
    // into beads, and the beads draw together into one drop that shrinks.
    vec4 ahead = modelViewMatrix * vec4(bubbleThrow(origin, dir, speed, tt + 0.004), 1.0);
    vec2 axis = ahead.xy - view.xy;
    axis = length(axis) > 1e-6 ? normalize(axis) : vec2(1.0, 0.0);
    vec2 across = vec2(-axis.y, axis.x);
    float pinch = bubbleSmooth(lifeT / 0.3);
    float gather = 1.0 - 0.8 * bubbleSmooth((lifeT - 0.35) / 0.4);
    float halfLength = (0.045 + 0.035 * fract(seed * 7.3)) * (0.6 + 0.6 * pinch) * gather * (0.5 + 0.5 * uMotion) * shrink * unit;
    float halfWidth = (0.0075 + 0.004 * fract(seed * 3.1)) * shrink * unit;
    // The head leads; the tail trails behind it.
    offset = axis * (aCorner.x - 1.0) * halfLength + across * aCorner.y * halfWidth;
    vAspect = halfLength / max(halfWidth, 1e-6);
  } else {
    float size = (0.006 + 0.005 * seed) * shrink * unit;
    offset = aCorner * size;
    vAspect = 1.0;
  }
  view.xy += offset;
  vCorner = aCorner;
  vKind = kind;
  vLife = alive > 0.0 ? lifeT : 2.0;
  vSeed = seed;
  gl_Position = alive > 0.0 ? projectionMatrix * view : vec4(0.0, 0.0, 2.0, 1.0);
}
`

export const PFX_BUBBLE_BURST_ACCENT_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform vec3 uTintA;
uniform vec3 uTintB;
uniform vec3 uTintC;
uniform vec3 uColorEdge;
varying vec2 vCorner;
varying float vKind;
varying float vLife;
varying float vAspect;
varying float vSeed;
${PFX_BUBBLE_SHAPE_GLSL}

void main() {
  if (vLife > 1.0) discard;
  vec3 color;
  if (vKind < 0.5) {
    // Strand along x from tail (-1) to head (+1).
    float s = vCorner.x;
    float y = vCorner.y;
    float pinch = bubbleSmooth(vLife / 0.3);
    float thread = exp(-y * y / 0.1) * (1.0 - smoothstep(0.75, 1.0, abs(s))) * (1.0 - pinch);
    float beads = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float centre = -0.62 + 0.62 * fi;
      float dx = (s - centre) * vAspect;
      float r = 0.55 + 0.25 * fi;
      beads += exp(-(dx * dx + y * y) / (r * r)) * (0.55 + 0.25 * fi);
    }
    beads *= 0.35 + 0.65 * pinch;
    float glow = thread * 0.8 + beads;
    if (glow < 0.02) discard;
    vec3 tint = bubbleFilmTint(0.5 + 0.8 * vSeed, 0.6, uTintA, uTintB, uTintC);
    color = mix(tint, uColorEdge, 0.55) * thread * 0.8 + uColorEdge * beads * 1.15;
  } else {
    float d = length(vCorner);
    if (d > 1.0) discard;
    float core = exp(-d * d / 0.22);
    color = mix(uTintB, uColorEdge, core) * (0.2 + 1.0 * core);
  }
  gl_FragColor = vec4(color, uOpacity);
}
`

/** Film tints around the control hue, plus edge and light tones. */
function bubblePalette(color: THREE.ColorRepresentation) {
  const source = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  source.getHSL(hsl)
  // A real film is pale. Keep the hue, but hold saturation down so the
  // bubble reads as clear film and not a coloured ball.
  const saturation = Math.min(0.62, Math.max(0.25, hsl.s * 0.68))
  const wrap = (h: number) => ((h % 1) + 1) % 1
  // Three tints spread a little around the control hue, so the film shows
  // thin-film colour shifts but a new control colour moves every tint.
  const tintA = new THREE.Color().setHSL(wrap(hsl.h - 0.11), saturation, 0.62)
  const tintB = new THREE.Color().setHSL(hsl.h, saturation, 0.6)
  const tintC = new THREE.Color().setHSL(wrap(hsl.h + 0.14), saturation * 0.9, 0.66)
  const base = new THREE.Color().setHSL(hsl.h, Math.max(0.3, hsl.s), Math.min(0.62, Math.max(0.45, hsl.l)))
  const edge = base.clone().lerp(new THREE.Color('#f6fbff'), 0.68)
  const light = base.clone().lerp(new THREE.Color('#ffffff'), 0.86)
  return { tintA, tintB, tintC, edge, light }
}

const vec3Of = (color: THREE.Color) => new THREE.Vector3(color.r, color.g, color.b)

function paletteUniforms(opacity: number, color: THREE.ColorRepresentation) {
  const palette = bubblePalette(color)
  return {
    uCycle: { value: 0 },
    uMotion: { value: 1 },
    uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
    uTintA: { value: vec3Of(palette.tintA) },
    uTintB: { value: vec3Of(palette.tintB) },
    uTintC: { value: vec3Of(palette.tintC) },
    uColorEdge: { value: vec3Of(palette.edge) },
    uColorLight: { value: vec3Of(palette.light) },
  }
}

function finishMaterial(material: THREE.ShaderMaterial, part: 'body' | 'accent'): THREE.ShaderMaterial {
  material.forceSinglePass = true
  material.userData['pfxBubbleBurstMaterial'] = part
  material.userData['pfxBubbleBurstFragmentTextureSamples'] = 0
  return material
}

export function createPfxBubbleBurstBodyMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return finishMaterial(new THREE.ShaderMaterial({
    uniforms: { ...paletteUniforms(opacity, color), uEnergy: { value: 0 }, uFlare: { value: 0 } },
    vertexShader: PFX_BUBBLE_FILM_VERTEX,
    fragmentShader: PFX_BUBBLE_BURST_BODY_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), 'body')
}

export function createPfxBubbleBurstAccentMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return finishMaterial(new THREE.ShaderMaterial({
    uniforms: paletteUniforms(opacity, color),
    vertexShader: PFX_BUBBLE_SPRAY_VERTEX,
    fragmentShader: PFX_BUBBLE_BURST_ACCENT_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), 'accent')
}

/** Writes one runtime state into either bubble-burst material. */
export function applyPfxBubbleBurstUniforms(
  material: THREE.ShaderMaterial,
  state: PfxBubbleBurstRuntimeState,
  opacity: number,
  reducedMotion: boolean,
): void {
  const u = material.uniforms
  // Reduced motion keeps the swell, the tear timing and the retirement. It
  // cuts the wobble, overshoot, rise, tear slide, rim lip and ripple, strand
  // length, the whole drop arc including gravity, and softens the rim and
  // the tear pin.
  u.uMotion!.value = reducedMotion ? 0.42 : 1
  u.uCycle!.value = state.cycle
  u.uOpacity!.value = state.stage === 'rest' ? 0 : opacity
  const part = material.userData['pfxBubbleBurstMaterial'] as 'body' | 'accent'
  if (part === 'body') {
    u.uEnergy!.value = state.energy
    u.uFlare!.value = reducedMotion ? state.flare * 0.35 : state.flare
    return
  }
  if (part === 'accent') return
  const unhandled: never = part
  throw new Error(`Unknown bubble-burst material part: ${String(unhandled)}`)
}

/** Library-owned unit sphere. The vertex shader sizes, wobbles and opens it. */
export function createPfxBubbleBurstBodyGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(1, 96, 64)
  geometry.deleteAttribute('uv')
  geometry.deleteAttribute('normal')
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.12, 0), 0.75)
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-0.75, -0.65, -0.75), new THREE.Vector3(0.75, 0.9, 0.75))
  geometry.userData['pfxBubbleBurstGeometry'] = 'body'
  geometry.userData['pfxBubbleBurstTriangles'] = (geometry.index?.count ?? 0) / 3
  return geometry
}

/**
 * Liquid strands (camera-facing streaks) and mist drops (camera-facing
 * quads) in one batch. Each carries its point on the film, measured from
 * the tear point, so it releases exactly when the rim reaches it.
 */
export function createPfxBubbleBurstAccentGeometry(): THREE.BufferGeometry {
  const spray: number[] = []
  const corner: number[] = []
  const indices: number[] = []
  // Area-uniform points on the film, skipping the tear point itself.
  const filmPoint = (index: number, count: number, offset: number) => {
    const t = (index + offset) / count
    const a = Math.acos(1 - 2 * (0.02 + 0.98 * t))
    const phi = (index * 2.39996323 + offset * 5.1) % (Math.PI * 2)
    return { a, phi }
  }
  const quad = (a: number, phi: number, kind: number, seed: number) => {
    const base = spray.length / 4
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      spray.push(a, phi, kind, seed)
      corner.push(x, y)
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  for (let index = 0; index < STRAND_COUNT; index += 1) {
    const { a, phi } = filmPoint(index, STRAND_COUNT, 0.5)
    quad(a, phi, 0, (index * 0.618034 + 0.19) % 1)
  }
  for (let index = 0; index < MIST_COUNT; index += 1) {
    const { a, phi } = filmPoint(index, MIST_COUNT, 0.27)
    quad(a, phi + 0.9, 1, (index * 0.754878 + 0.41) % 1)
  }
  const geometry = new THREE.BufferGeometry()
  const count = spray.length / 4
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3))
  geometry.setAttribute('aSpray', new THREE.Float32BufferAttribute(spray, 4))
  geometry.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 2))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.1, 0), 1.4)
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-1.4, -1.2, -1.4), new THREE.Vector3(1.4, 1.4, 1.4))
  geometry.userData['pfxBubbleBurstGeometry'] = 'accent'
  geometry.userData['pfxBubbleBurstStrands'] = STRAND_COUNT
  geometry.userData['pfxBubbleBurstDroplets'] = MIST_COUNT
  return geometry
}
