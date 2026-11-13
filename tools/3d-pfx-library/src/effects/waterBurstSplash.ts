import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

// water-burst: an impact opens a cavity in a low water surface and throws
// up a thin connected crown. Unequal fingers grow from the crown rim, each
// finger tip swells into a bead, and the beads pinch off and fall on
// gravity arcs back into the water. The crown sheet thins and opens holes,
// then collapses outward into a ring wave. A short rebound jet rises from
// the centre, and the surface settles to an irregular ripple and retires.
//
// Every shape value comes from one normalized master-cycle position and one
// GLSL shape chunk, so the droplets ride the exact finger tips of the body.
// The material combines a small tint with local sky reflections. Low alpha
// passes the background through the sheet. It does not sample the scene.

export type PfxWaterBurstStage = 'impact' | 'crown' | 'collapse' | 'recovery' | 'rest'

export interface PfxWaterBurstLifecycle {
  stage: PfxWaterBurstStage
  /** Short wet flare on the cavity lip at impact, 0..1. */
  flare: number
  /** Overall layer visibility: fades in at impact and out before rest. */
  energy: number
}

export interface PfxWaterBurstRuntimeState extends PfxWaterBurstLifecycle {
  /** Normalized master-cycle position in [0, 1). */
  cycle: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (value: number) => {
  const x = clamp01(value)
  return x * x * (3 - 2 * x)
}

const IMPACT_END = 0.06
const CROWN_END = 0.34
const COLLAPSE_END = 0.6
/** Droplets land by about 0.8 and the ripple fades by 0.86. */
const REST_START = 0.88

const REST: PfxWaterBurstLifecycle = { stage: 'rest', flare: 0, energy: 0 }

export function createPfxWaterBurstLifecycle(cycle: number): PfxWaterBurstLifecycle {
  const u = clamp01(cycle)
  if (u >= REST_START) return REST
  const stage: PfxWaterBurstStage = u < IMPACT_END ? 'impact' : u < CROWN_END ? 'crown' : u < COLLAPSE_END ? 'collapse' : 'recovery'
  const flare = smooth((u - 0.01) / 0.03) * (1 - smooth((u - 0.05) / 0.07))
  const energy = smooth(u / 0.03) * (1 - smooth((u - 0.72) / 0.14))
  return { stage, flare, energy }
}

export function createPfxWaterBurstRuntimeState(
  input: {
    elapsedSeconds: number
    timing: number
    lifetime: number
    tempo: number
    motionMultiplier: number
    cycleScale: number
    reducedMotion: boolean
  },
  target?: PfxWaterBurstRuntimeState,
): PfxWaterBurstRuntimeState {
  // Same master clock as getPfxBurstCycleSeconds.
  const timeScale = Math.max(0.05, input.timing) * input.motionMultiplier * Math.max(0.1, input.tempo)
  const span = Math.max(0.3, Math.max(0.25, input.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER * Math.max(1, input.cycleScale)
  const cycle = ((Math.max(0, input.elapsedSeconds) * timeScale) % span) / span
  const lifecycle = createPfxWaterBurstLifecycle(cycle)
  const state = target ?? { ...lifecycle, cycle: 0 }
  Object.assign(state, lifecycle, { cycle })
  return state
}

/**
 * Crown fingers: angle (rad), extra height, half-width (rad) and the cycle
 * position where the tip bead pinches off. Unequal on purpose.
 */
const FINGERS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.25, 0.62, 0.15, 0.215],
  [0.97, 0.36, 0.11, 0.25],
  [1.6, 0.76, 0.17, 0.2],
  [2.4, 0.3, 0.1, 0.27],
  [2.98, 0.56, 0.14, 0.23],
  [3.74, 0.7, 0.16, 0.205],
  [4.43, 0.33, 0.11, 0.26],
  [5.03, 0.52, 0.14, 0.225],
  [5.72, 0.44, 0.12, 0.24],
]

/** Surface radius in local units. */
const SURFACE_RADIUS = 1.3
/** Surface rest height in local units. The crown rises from here. */
const SURFACE_Y = -0.22
/** Ballistic drop gravity in local units per cycle squared. */
const DROP_GRAVITY = 18

const PFX_WATER_SHAPE_GLSL = /* glsl */ `
uniform float uCycle;
uniform float uMotion;
uniform vec4 uFingers[${FINGERS.length}];

const float WATER_PI = 3.14159265;
const float WATER_TAU = 6.2831853;
const float WATER_SURFACE_Y = ${SURFACE_Y.toFixed(3)};
const float WATER_SURFACE_RADIUS = ${SURFACE_RADIUS.toFixed(3)};

float waterSat(float x) { return clamp(x, 0.0, 1.0); }
float waterSmooth(float x) { x = waterSat(x); return x * x * (3.0 - 2.0 * x); }

// Reduced motion lowers the crown and shortens every outward travel
// (0.66 of normal at uMotion 0.45).
float waterSpreadScale() { return 0.38 + 0.62 * uMotion; }
float waterHeightScale() { return 0.38 + 0.62 * uMotion; }

float waterRise(float u) { float x = waterSat((u - 0.02) / 0.17); return 1.0 - pow(1.0 - x, 3.0); }
float waterCollapse(float u) { return waterSmooth((u - 0.34) / 0.26); }
float waterSpread(float u) { float x = waterSat((u - 0.02) / 0.55); return 1.0 - pow(1.0 - x, 2.4); }
float waterBaseRadius(float u) { return (0.15 + 0.43 * waterSpread(u)) * waterSpreadScale(); }
float waterCrownHeight(float u) {
  return 0.56 * waterHeightScale() * waterRise(u) * pow(1.0 - waterCollapse(u), 1.4);
}
float waterFingerGrow(float u) { return waterSmooth((u - 0.07) / 0.13); }

// Crown height factor around the rim: a scalloped low rim plus pointed,
// unequal fingers. A finger drops a little when its tip bead pinches off.
float waterFinger(float theta, float u) {
  float grow = waterFingerGrow(u);
  float f = 0.0;
  for (int k = 0; k < ${FINGERS.length}; k++) {
    vec4 fk = uFingers[k];
    float d = abs(mod(theta - fk.x + WATER_PI, WATER_TAU) - WATER_PI);
    float detached = waterSmooth((u - fk.w) / 0.05);
    f += fk.y * (1.0 - 0.4 * detached) * smoothstep(fk.z, 0.3 * fk.z, d);
  }
  float scallop = 0.05 * sin(theta * 13.0 + 1.3) + 0.03 * sin(theta * 22.0 + 0.4);
  return 0.56 + scallop * grow + f * grow;
}

float waterRadiusJitter(float theta) {
  return 1.0 + 0.05 * sin(theta * 3.0 + 1.1) + 0.03 * sin(theta * 7.0 + 2.3);
}

// Crown wall point. w = 0 at the surface lip, 1 at the rim or finger tip.
vec3 waterWallPoint(float theta, float w, float u) {
  float c = waterCollapse(u);
  float h = waterCrownHeight(u) * waterFinger(theta, u);
  // The wall flares outward, the rim curls out, and the falling crown
  // leans further out as it drops.
  float r = waterBaseRadius(u) * waterRadiusJitter(theta) + h * w * (0.24 + 0.3 * c) + h * 0.2 * w * w;
  float y = WATER_SURFACE_Y + h * w * (1.0 - 0.2 * c * w);
  return vec3(cos(theta) * r, y, sin(theta) * r);
}

float waterJet(float u) {
  float up = waterSmooth((u - 0.5) / 0.1);
  float down = waterSmooth((u - 0.62) / 0.12);
  return 0.19 * waterHeightScale() * up * (1.0 - down);
}

// Low surface height: impact cavity, ring wave left by the collapse,
// central rebound jet and a small irregular swell.
float waterSurfaceHeight(float r, float theta, float u) {
  float rb = waterBaseRadius(u) * waterRadiusJitter(theta);
  float c = waterCollapse(u);
  float cavity = 0.15 * waterHeightScale() * waterRise(u) * (1.0 - c);
  float x = r / max(rb, 1e-3);
  float y = -cavity * max(0.0, 1.0 - x * x);
  float t = u - 0.46;
  if (t > 0.0) {
    float amp = 0.05 * waterHeightScale() * waterSmooth(t / 0.06) * (1.0 - waterSmooth((u - 0.6) / 0.24));
    float front = (rb + 0.05 + 0.8 * t * waterSpreadScale()) * (1.0 + 0.05 * sin(theta * 3.0 + 0.7) + 0.035 * sin(theta * 5.0 + 2.1));
    float d = r - front;
    y += amp * cos(d * 26.0) * exp(-d * d / 0.018);
    float inner = front * 0.55;
    float di = r - inner;
    y += 0.5 * amp * cos(di * 30.0 + 1.0) * exp(-di * di / 0.01);
  }
  y += waterJet(u) * exp(-r * r / 0.0032);
  return WATER_SURFACE_Y + y;
}

vec3 waterSurfacePoint(float r, float theta, float u) {
  return vec3(cos(theta) * r, waterSurfaceHeight(r, theta, u), sin(theta) * r);
}

float waterHash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float waterNoise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(waterHash3(i), waterHash3(i + vec3(1.0, 0.0, 0.0)), f.x),
                 mix(waterHash3(i + vec3(0.0, 1.0, 0.0)), waterHash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(waterHash3(i + vec3(0.0, 0.0, 1.0)), waterHash3(i + vec3(1.0, 0.0, 1.0)), f.x),
                 mix(waterHash3(i + vec3(0.0, 1.0, 1.0)), waterHash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
// Noise around the ring with no seam at angle 0: about 'density' cells per radian.
float waterRingNoise(float theta, float density, float y) {
  return waterNoise3(vec3(cos(theta) * density, sin(theta) * density, y));
}
`

const PFX_WATER_BODY_VERTEX = /* glsl */ `
attribute vec3 aWater;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vOutward;
varying vec3 vWater;
${PFX_WATER_SHAPE_GLSL}

vec3 waterBodyPoint(float theta, float param, float part) {
  if (part > 0.5) return waterWallPoint(theta, param, uCycle);
  return waterSurfacePoint(WATER_SURFACE_RADIUS * pow(param, 1.5), theta, uCycle);
}

void main() {
  float theta = aWater.x;
  float param = aWater.y;
  float part = aWater.z;
  vec3 p = waterBodyPoint(theta, param, part);
  // Smooth analytic normal from the shape function: no faceted shading.
  float e = 0.004;
  float pa = part > 0.5 ? param : max(param, 0.03);
  vec3 dTheta = waterBodyPoint(theta + e, pa, part) - waterBodyPoint(theta - e, pa, part);
  vec3 dParam = waterBodyPoint(theta, pa + e, part) - waterBodyPoint(theta, pa - e, part);
  vec3 n = cross(dParam, dTheta);
  n = dot(n, n) > 1e-12 ? normalize(n) : vec3(0.0, 1.0, 0.0);
  if (part < 0.5 && n.y < 0.0) n = -n;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * n);
  vOutward = normalize(mat3(modelMatrix) * vec3(cos(theta), 0.0, sin(theta)));
  vWater = vec3(theta, param, part);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const PFX_WATER_BURST_BODY_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uEnergy;
uniform float uFlare;
uniform vec3 uColorDeep;
uniform vec3 uColorMid;
uniform vec3 uColorSky;
uniform vec3 uColorEdge;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vOutward;
varying vec3 vWater;
${PFX_WATER_SHAPE_GLSL}

// Procedural surroundings for the reflection: a dark floor, a lighter sky
// and one soft key light. Nothing is sampled from the scene.
vec3 waterSky(vec3 r) {
  float up = smoothstep(-0.3, 0.8, r.y);
  vec3 sky = mix(uColorDeep * 0.7, uColorSky * 0.8, up);
  sky += uColorSky * 0.45 * exp(-(r.y - 0.12) * (r.y - 0.12) / 0.0256);
  vec3 key = normalize(vec3(-0.35, 0.8, 0.45));
  sky += uColorEdge * pow(max(dot(r, key), 0.0), 18.0) * 1.3;
  return sky;
}

void main() {
  float theta = vWater.x;
  float param = vWater.y;
  bool wall = vWater.z > 0.5;
  float u = uCycle;

  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorld);
  if (dot(n, v) < 0.0) n = -n;
  float facing = clamp(dot(n, v), 0.0, 1.0);
  float fresnel = 0.05 + 0.95 * pow(1.0 - facing, 3.0);
  vec3 reflected = waterSky(reflect(-v, n));
  vec3 key = normalize(vec3(-0.35, 0.8, 0.45));
  vec3 halfway = normalize(v + key);
  float spec = pow(max(dot(halfway, n), 0.0), 160.0) + 0.18 * pow(max(dot(halfway, n), 0.0), 24.0);

  float body;
  float edge = 0.0;
  float thin;
  if (wall) {
    // Holes open in the thinning sheet, first high on the wall.
    float c = waterCollapse(u);
    float holes = waterSmooth((u - 0.18) / 0.25) * 0.95;
    float hn = waterRingNoise(theta, 7.0, param * 3.2 + 1.7) * 0.65 + waterRingNoise(theta, 19.0, param * 7.0 - 0.4) * 0.35;
    // The slumping sheet also tears low down, so the collapse breaks apart.
    float lowerTear = (1.0 - smoothstep(0.08, 0.42, param)) * waterSmooth((u - 0.07) / 0.12);
    float threshold = holes * (0.2 + 1.0 * param) + 0.35 * c + 0.52 * lowerTear;
    if (hn < threshold) discard;
    float holeEdge = holes > 0.0 ? 1.0 - smoothstep(0.0, 0.05, hn - threshold) : 0.0;
    // Narrow wet rim on the crown edge. Finger tips carry a wider, brighter
    // rim; the low scallops between them stay dim.
    float tip = smoothstep(0.62, 1.1, waterFinger(theta, u));
    float rimDist = (1.0 - param) / max(fwidth(param), 1e-4);
    float rim = (1.0 - smoothstep(0.4, 1.4 + 1.6 * tip, rimDist)) * (0.45 + 0.55 * tip);
    rim *= 0.7 + 0.3 * waterRingNoise(theta, 30.0, 2.0);
    // The falling rim breaks into separate bright pieces, not one outline.
    rim *= mix(1.0, smoothstep(0.38, 0.62, waterRingNoise(theta, 9.0, 4.0)), c);
    edge = max(rim, holeEdge * 0.4);
    // Sheet thickness streaks run up the wall with the flow.
    float streak = waterRingNoise(theta, 26.0, param * 1.6 - u * 2.5);
    thin = clamp(smoothstep(0.15, 1.0, param) + 0.35 * (streak - 0.5), 0.0, 1.0);
    float inner = step(dot(vOutward, v), 0.0);
    fresnel = mix(fresnel, min(1.0, fresnel * 1.3 + 0.05), inner);
    float collapseFade = 1.0 - waterSmooth((u - 0.48) / 0.1);
    // The wall root dissolves into the surface along an uneven line, so no
    // straight lower rim forms against the background.
    float root = smoothstep(0.0, 0.18 + 0.2 * waterRingNoise(theta, 5.0, 7.3), param);
    // Thin sheet: the background and the far wall stay visible through the
    // broad face. Glancing folds keep their reflection.
    // As the crown slumps its broad fill clears first; only torn edges and
    // glancing glints show the falling sheet.
    float slump = waterSmooth((u - 0.36) / 0.1);
    // Broad faces have little coverage. Local folds carry the reflection.
    // The rear wall blends through the near wall in this single draw.
    float fold = smoothstep(0.55, 0.86, streak) * (0.35 + 0.65 * thin);
    body = (0.018 + 0.022 * thin) * collapseFade * (1.0 - 0.85 * slump) * root;
    fresnel *= (0.16 + 0.28 * fold) * root * (1.0 - 0.7 * slump);
    spec *= root * collapseFade;
    edge *= collapseFade;
  } else {
    // Low surface: only a broken patch near the splash shows. Flat parts
    // stay nearly clear; slopes, the cavity and ripples catch the light.
    float r = WATER_SURFACE_RADIUS * pow(param, 1.5);
    float rb = waterBaseRadius(u);
    float reach = rb + 0.28 + 0.8 * max(0.0, u - 0.46) * waterSpreadScale();
    float broken = waterRingNoise(theta, 4.0, r * 5.0) * 0.3 + waterRingNoise(theta, 11.0, r * 13.0) * 0.1;
    float mask = 1.0 - smoothstep(reach - 0.3, reach, r + broken);
    if (mask <= 0.0) discard;
    float slope = 1.0 - clamp(n.y, 0.0, 1.0);
    // Break broad coverage into small patches. Keep the local jet slopes.
    float surfacePatch = 0.25 + 0.75 * smoothstep(0.28, 0.68, waterRingNoise(theta, 6.0, r * 9.0));
    body = mask * (0.008 + 0.26 * slope) * surfacePatch;
    float lip = exp(-(r - rb) * (r - rb) / 0.0025) * (0.35 + 0.65 * waterRingNoise(theta, 8.0, 1.3));
    float crest = smoothstep(0.08, 0.3, slope) * smoothstep(0.4, 0.5, u) * 1.3;
    edge = mask * (lip * (0.35 * uFlare + 0.25 * waterRise(u) * (1.0 - waterCollapse(u))) + 0.5 * crest);
    thin = 0.0;
    fresnel *= mask * (0.08 + 0.22 * slope) * surfacePatch;
    spec *= mask;
  }

  // Alpha blending passes the background through the sheet. This shader
  // adds a small tint and local reflections. It does not sample the scene.
  float reflection = fresnel * 0.85;
  float highlight = spec + edge;
  float coverage = body + reflection + highlight;
  vec3 tint = mix(uColorMid, uColorSky, 0.4 + 0.4 * thin);
  vec3 color = (tint * body + reflected * reflection + uColorEdge * highlight) / max(coverage, 1e-4);
  float alpha = clamp(coverage, 0.0, 0.92) * uEnergy * uOpacity;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(color, alpha);
}
`

/** Droplets: tip beads that pinch off, early rim spray, and jet drops. */
const DROP_FINGER = 0
const DROP_SPRAY = 1
const DROP_JET = 2

const PFX_WATER_DROP_VERTEX = /* glsl */ `
attribute vec2 aCorner;
attribute vec4 aDrop;
attribute vec4 aDropMotion;
varying vec2 vCorner;
varying float vStretch;
varying float vVisible;
${PFX_WATER_SHAPE_GLSL}

const float WATER_GRAVITY = ${DROP_GRAVITY.toFixed(1)};

void main() {
  float theta = aDrop.x;
  float kind = aDrop.y;
  float launch = aDrop.z;
  float size = aDrop.w;
  float vr = aDropMotion.x;
  float vy = aDropMotion.y;
  float attachLead = aDropMotion.z;
  float u = uCycle;

  vec3 origin;
  vec3 velocity;
  float visible = 1.0;
  float t = u - launch;
  vec3 dir = vec3(cos(theta), 0.0, sin(theta));
  if (kind < 0.5) {
    origin = waterWallPoint(theta, 1.0, min(u, launch));
    // Before the pinch the bead swells on the finger tip.
    visible = waterSmooth((u - (launch - attachLead)) / 0.05);
  } else if (kind < 1.5) {
    origin = waterWallPoint(theta, 1.0, launch);
    visible = step(0.0, t);
  } else {
    origin = vec3(0.0, waterSurfaceHeight(0.0, theta, min(u, launch)) + 0.02, 0.0);
    visible = waterSmooth((u - (launch - attachLead)) / 0.04);
  }
  velocity = dir * vr + vec3(0.0, vy, 0.0);
  float tf = max(0.0, t);
  // Reduced motion scales the whole arc about its launch point: launch
  // speed and gravity drop together, so every displacement shrinks.
  vec3 p = origin + uMotion * (velocity * tf + vec3(0.0, -0.5 * WATER_GRAVITY * tf * tf, 0.0));
  vec3 vel = uMotion * (velocity + vec3(0.0, -WATER_GRAVITY * tf, 0.0));
  // The drop sinks into the water and is gone.
  float sink = smoothstep(WATER_SURFACE_Y - 0.01, WATER_SURFACE_Y + 0.05, p.y);
  if (t > 0.0) visible *= sink;
  visible *= 1.0 - step(0.86, u);

  vec4 view = modelViewMatrix * vec4(p, 1.0);
  vec4 viewAhead = modelViewMatrix * vec4(p + vel * 0.01, 1.0);
  vec2 moveDir = viewAhead.xy - view.xy;
  float moveLen = length(moveDir);
  vec2 along = moveLen > 1e-6 ? moveDir / moveLen : vec2(0.0, 1.0);
  vec2 across = vec2(-along.y, along.x);
  float speed = length(vel) * (t > 0.0 ? 1.0 : 0.0);
  float stretch = 1.0 + min(speed * 0.22, 1.3);
  float scale = length(modelViewMatrix[0].xyz);
  float radius = size * visible * scale;
  // Teardrop: the tail trails behind the motion.
  vec2 offset = across * aCorner.x * radius + along * (aCorner.y > 0.0 ? aCorner.y * radius : aCorner.y * radius * stretch);
  view.xy += offset;
  vCorner = aCorner;
  vStretch = stretch;
  vVisible = visible;
  gl_Position = projectionMatrix * view;
}
`

export const PFX_WATER_BURST_ACCENT_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uEnergy;
uniform vec3 uColorDeep;
uniform vec3 uColorMid;
uniform vec3 uColorEdge;
varying vec2 vCorner;
varying float vStretch;
varying float vVisible;

void main() {
  if (vVisible <= 0.001) discard;
  // Teardrop outline: round head, tapered tail in -y.
  vec2 q = vCorner;
  float tail = q.y < 0.0 ? 1.0 + q.y * 0.55 * (vStretch - 1.0) / max(vStretch, 1.0) : 1.0;
  float d = length(vec2(q.x / max(tail, 0.2), q.y));
  if (d > 1.0) discard;
  float aa = 1.0 - smoothstep(0.82, 1.0, d);
  // Bead shading: dark body, bright rim, a specular point, and a focused
  // caustic on the far side of the bead.
  float rim = smoothstep(0.7, 0.98, d);
  float specular = exp(-dot(q - vec2(-0.3, 0.36), q - vec2(-0.3, 0.36)) / 0.03);
  float caustic = exp(-dot(q - vec2(0.15, -0.42), q - vec2(0.15, -0.42)) / 0.08);
  // Clear bead: a faint body, a darker edge, a sharp specular
  // point and a focused caustic. The background shows through the centre.
  vec3 color = mix(uColorMid, uColorEdge, 0.2 + 0.3 * (1.0 - d));
  color = mix(color, uColorDeep, rim * 0.55);
  color = mix(color, uColorEdge, clamp(specular * 1.2 + caustic * 0.6, 0.0, 1.0));
  float alpha = aa * clamp(0.32 + 0.5 * rim + specular + 0.35 * caustic, 0.0, 1.0) * uEnergy * uOpacity;
  gl_FragColor = vec4(color, alpha);
}
`

/** Deep body, mid body, sky reflection and wet edge tones from one colour. */
function waterPalette(color: THREE.ColorRepresentation) {
  const source = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  source.getHSL(hsl)
  const saturation = Math.min(1, Math.max(0.35, hsl.s))
  const base = new THREE.Color().setHSL(hsl.h, saturation, Math.min(0.62, Math.max(0.42, hsl.l)))
  const deep = new THREE.Color().setHSL((hsl.h + 0.015) % 1, saturation, Math.min(0.2, Math.max(0.1, hsl.l * 0.28)))
  const mid = new THREE.Color().setHSL(hsl.h, saturation * 0.95, Math.min(0.42, Math.max(0.26, hsl.l * 0.58)))
  const sky = base.clone().lerp(new THREE.Color('#f4f8ff'), 0.45)
  const edge = base.clone().lerp(new THREE.Color('#f8fbff'), 0.78)
  return { deep, mid, sky, edge }
}

const vec3Of = (color: THREE.Color) => new THREE.Vector3(color.r, color.g, color.b)

function shapeUniforms() {
  return {
    uCycle: { value: 0 },
    uMotion: { value: 1 },
    uFingers: { value: FINGERS.map(([angle, height, width, detach]) => new THREE.Vector4(angle, height, width, detach)) },
  }
}

function paletteUniforms(opacity: number, color: THREE.ColorRepresentation) {
  const palette = waterPalette(color)
  return {
    uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
    uEnergy: { value: 0 },
    uColorDeep: { value: vec3Of(palette.deep) },
    uColorMid: { value: vec3Of(palette.mid) },
    uColorSky: { value: vec3Of(palette.sky) },
    uColorEdge: { value: vec3Of(palette.edge) },
  }
}

function finishMaterial(material: THREE.ShaderMaterial, part: 'body' | 'accent'): THREE.ShaderMaterial {
  material.forceSinglePass = true
  material.userData['pfxWaterBurstMaterial'] = part
  material.userData['pfxWaterBurstFragmentTextureSamples'] = 0
  return material
}

export function createPfxWaterBurstBodyMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return finishMaterial(new THREE.ShaderMaterial({
    uniforms: { ...shapeUniforms(), uFlare: { value: 0 }, ...paletteUniforms(opacity, color) },
    vertexShader: PFX_WATER_BODY_VERTEX,
    fragmentShader: PFX_WATER_BURST_BODY_FRAGMENT,
    transparent: true,
    blending: THREE.NormalBlending,
    // Thin sheets pass the rear wall and drops. Triangle order uses the
    // default review view. Other views can show alpha sorting errors.
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), 'body')
}

export function createPfxWaterBurstAccentMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return finishMaterial(new THREE.ShaderMaterial({
    uniforms: { ...shapeUniforms(), ...paletteUniforms(opacity, color) },
    vertexShader: PFX_WATER_DROP_VERTEX,
    fragmentShader: PFX_WATER_BURST_ACCENT_FRAGMENT,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), 'accent')
}

/** Writes one runtime state into either water-burst material. */
export function applyPfxWaterBurstUniforms(
  material: THREE.ShaderMaterial,
  state: PfxWaterBurstRuntimeState,
  opacity: number,
  reducedMotion: boolean,
): void {
  const u = material.uniforms
  // Reduced motion keeps the beats. The crown height, crown spread and
  // ripple travel fall to 0.66, every droplet arc (launch and gravity) to
  // 0.45, and the impact flare to 0.4.
  u.uMotion!.value = reducedMotion ? 0.45 : 1
  u.uCycle!.value = state.cycle
  u.uEnergy!.value = state.energy
  u.uOpacity!.value = state.stage === 'rest' ? 0 : opacity
  const part = material.userData['pfxWaterBurstMaterial'] as 'body' | 'accent'
  if (part === 'body') {
    u.uFlare!.value = reducedMotion ? state.flare * 0.4 : state.flare
    return
  }
  if (part === 'accent') return
  const unhandled: never = part
  throw new Error(`Unknown water-burst material part: ${String(unhandled)}`)
}

const BODY_COLUMNS = 240
const WALL_ROWS = 26
const SURFACE_ROWS = 44
/** Default three-quarter camera azimuth in the crown's (cos, sin) angle. */
const VIEW_THETA = Math.atan2(Math.cos(0.72), Math.sin(0.72))

/**
 * Library-owned liquid body: a low surface grid and a crown wall grid. The
 * vertex shader owns every position; each vertex carries (angle, profile
 * parameter, part). Wall columns are ordered far side first for the default
 * three-quarter view so the translucent near wall blends over the far wall.
 */
export function createPfxWaterBurstBodyGeometry(): THREE.BufferGeometry {
  const water: number[] = []
  const indices: number[] = []
  const addGrid = (rows: number, part: number) => {
    const start = water.length / 3
    for (let row = 0; row <= rows; row += 1) {
      for (let column = 0; column <= BODY_COLUMNS; column += 1) {
        water.push((column / BODY_COLUMNS) * Math.PI * 2, row / rows, part)
      }
    }
    return start
  }
  const surface = addGrid(SURFACE_ROWS, 0)
  const wall = addGrid(WALL_ROWS, 1)
  const quads = (start: number, rows: number, column: number) => {
    for (let row = 0; row < rows; row += 1) {
      const a = start + row * (BODY_COLUMNS + 1) + column
      const b = a + BODY_COLUMNS + 1
      indices.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }
  for (let column = 0; column < BODY_COLUMNS; column += 1) quads(surface, SURFACE_ROWS, column)
  const columns = Array.from({ length: BODY_COLUMNS }, (_, column) => column)
  const nearness = (column: number) => Math.cos(((column + 0.5) / BODY_COLUMNS) * Math.PI * 2 - VIEW_THETA)
  columns.sort((a, b) => nearness(a) - nearness(b))
  for (const column of columns) quads(wall, WALL_ROWS, column)
  const geometry = new THREE.BufferGeometry()
  const count = water.length / 3
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3))
  geometry.setAttribute('aWater', new THREE.Float32BufferAttribute(water, 3))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.5)
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-1.4, -0.6, -1.4), new THREE.Vector3(1.4, 0.8, 1.4))
  geometry.userData['pfxWaterBurstGeometry'] = 'body'
  geometry.userData['pfxWaterBurstTriangles'] = indices.length / 3
  return geometry
}

interface WaterDrop {
  theta: number
  kind: number
  launch: number
  size: number
  vr: number
  vy: number
  attachLead: number
}

/** Deterministic droplet list. Tip beads follow the finger table. */
function createWaterDrops(): WaterDrop[] {
  const drops: WaterDrop[] = []
  FINGERS.forEach(([angle, height, , detach], index) => {
    const jitter = ((index * 0.618034 + 0.21) % 1) - 0.5
    drops.push({ theta: angle, kind: DROP_FINGER, launch: detach, size: 0.03 + 0.026 * height, vr: 0.85 + 0.5 * height + 0.15 * jitter, vy: 1.0 + 0.5 * height, attachLead: 0.1 })
    if (height > 0.45) {
      drops.push({ theta: angle + 0.04 * jitter, kind: DROP_FINGER, launch: detach + 0.035, size: 0.018 + 0.012 * height, vr: 0.65 + 0.35 * height, vy: 0.75 + 0.35 * height, attachLead: 0.03 })
    }
  })
  for (let index = 0; index < 18; index += 1) {
    const seed = (index * 0.754878 + 0.13) % 1
    const theta = ((index + 0.5 + (((index * 0.5698403) % 1) - 0.5) * 0.8) / 18) * Math.PI * 2
    drops.push({ theta, kind: DROP_SPRAY, launch: 0.05 + 0.07 * seed, size: 0.012 + 0.012 * ((index * 0.381966) % 1), vr: 1.3 + 0.8 * seed, vy: 0.7 + 0.7 * ((index * 0.2763932) % 1), attachLead: 0 })
  }
  drops.push({ theta: 0.6, kind: DROP_JET, launch: 0.6, size: 0.032, vr: 0.12, vy: 1.1, attachLead: 0.06 })
  drops.push({ theta: 3.9, kind: DROP_JET, launch: 0.63, size: 0.02, vr: 0.1, vy: 0.8, attachLead: 0.03 })
  return drops
}

/** Camera-facing droplet quads in one batch. The vertex shader owns positions. */
export function createPfxWaterBurstAccentGeometry(): THREE.BufferGeometry {
  const drops = createWaterDrops()
  const corners: number[] = []
  const drop: number[] = []
  const motion: number[] = []
  const indices: number[] = []
  drops.forEach((entry, index) => {
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      corners.push(x, y)
      drop.push(entry.theta, entry.kind, entry.launch, entry.size)
      motion.push(entry.vr, entry.vy, entry.attachLead, 0)
    }
    const a = index * 4
    indices.push(a, a + 1, a + 2, a, a + 2, a + 3)
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(drops.length * 4 * 3), 3))
  geometry.setAttribute('aCorner', new THREE.Float32BufferAttribute(corners, 2))
  geometry.setAttribute('aDrop', new THREE.Float32BufferAttribute(drop, 4))
  geometry.setAttribute('aDropMotion', new THREE.Float32BufferAttribute(motion, 4))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.8)
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-1.8, -0.6, -1.8), new THREE.Vector3(1.8, 1.2, 1.8))
  geometry.userData['pfxWaterBurstGeometry'] = 'accent'
  geometry.userData['pfxWaterBurstDroplets'] = drops.length
  return geometry
}
