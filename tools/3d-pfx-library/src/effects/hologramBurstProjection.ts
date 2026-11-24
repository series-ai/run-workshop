import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

// hologram-burst: a projector ignites, a volumetric bust is scanned in from
// the base, holds with rolling scan bands and two short section glitches,
// then a top-down erase line tears it back into the projector. All values
// come from one normalized master-cycle position, so every layer shares one
// clock and the event retires before the preview wraps.

/** Local height range of the authored bust. The scan and erase fronts use it. */
export const PFX_HOLOGRAM_BURST_SUBJECT_MIN_Y = -0.72
export const PFX_HOLOGRAM_BURST_SUBJECT_MAX_Y = 0.8
/** Number of horizontal sections that can displace as a unit. */
export const PFX_HOLOGRAM_BURST_SECTION_COUNT = 16
const EMITTER_Y = -0.86
const BEAM_TOP_Y = 0.74

export type PfxHologramBurstStage = 'ignite' | 'reveal' | 'hold' | 'retire' | 'rest'

export interface PfxHologramBurstLifecycle {
  stage: PfxHologramBurstStage
  /** Projector ring and lens brightness. */
  ignite: number
  /** Projector ring and lens scale. Additive parts retire by scale. */
  ringScale: number
  /** Beam brightness. */
  beam: number
  /** Beam radius multiplier. The beam retires by narrowing into the lens. */
  beamWidth: number
  /** Scan-in front height, 0 = base, 1 = head top. */
  reveal: number
  /** Top-down erase progress, 0 = whole subject, 1 = gone. */
  retire: number
  /** Section displacement amount. */
  glitch: number
  /** Stepped brightness while the projection is not yet stable. */
  flicker: number
}

export interface PfxHologramBurstRuntimeState extends PfxHologramBurstLifecycle {
  /** Normalized master-cycle position in [0, 1). */
  cycle: number
  /** Decorative clock in seconds. Reduced motion slows it. */
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
/** Deterministic per-step hash for the stepped flicker. */
const stepHash = (step: number) => {
  const s = Math.sin(step * 12.9898 + 4.1414) * 43758.5453
  return s - Math.floor(s)
}

const RETIRE_START = 0.6
const RETIRE_SPAN = 0.24
const REST_START = 0.88

export function createPfxHologramBurstLifecycle(cycle: number): PfxHologramBurstLifecycle {
  const u = clamp01(cycle)
  if (u >= REST_START) {
    return { stage: 'rest', ignite: 0, ringScale: 0, beam: 0, beamWidth: 0, reveal: 0, retire: 1, glitch: 0, flicker: 0 }
  }
  const ignite = u < 0.05 ? smooth(u / 0.05) : 1 - 0.45 * smooth((u - 0.05) / 0.15)
  const ringScale = u < 0.05
    ? 0.6 + 0.55 * smooth(u / 0.05)
    : u < RETIRE_START + 0.06
      ? 1.15 - 0.15 * smooth((u - 0.05) / 0.07)
      : 1 - smooth((u - RETIRE_START - 0.06) / (REST_START - RETIRE_START - 0.06))
  const beam = smooth((u - 0.03) / 0.07)
  const beamWidth = 1 - smooth((u - RETIRE_START) / RETIRE_SPAN)
  const revealLinear = clamp01((u - 0.07) / 0.27)
  const reveal = 1 - Math.pow(1 - revealLinear, 3)
  const retireLinear = clamp01((u - RETIRE_START) / RETIRE_SPAN)
  const retire = retireLinear * retireLinear
  const retireTear = retireLinear > 0 && retireLinear < 1 ? Math.sin(Math.PI * retireLinear) * 0.45 : 0
  const glitch = Math.min(1, pulse(u, 0.42, 0.035) + pulse(u, 0.51, 0.025) * 0.7 + retireTear)
  const flicker = reveal < 1 ? 0.68 + 0.32 * stepHash(Math.floor(u * 48)) : 1
  const stage: PfxHologramBurstStage = u < 0.07 ? 'ignite' : reveal < 1 ? 'reveal' : retireLinear <= 0 ? 'hold' : 'retire'
  return { stage, ignite, ringScale, beam, beamWidth, reveal, retire, glitch, flicker }
}

export function createPfxHologramBurstRuntimeState(
  input: {
    elapsedSeconds: number
    timing: number
    lifetime: number
    tempo: number
    motionMultiplier: number
    cycleScale: number
    reducedMotion: boolean
  },
  target?: PfxHologramBurstRuntimeState,
): PfxHologramBurstRuntimeState {
  // Same master clock as getPfxBurstCycleSeconds and the lifecycle branches
  // in getPfxSurfaceAnimationProps.
  const timeScale = Math.max(0.05, input.timing) * input.motionMultiplier * Math.max(0.1, input.tempo)
  const span = Math.max(0.3, Math.max(0.25, input.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER * Math.max(1, input.cycleScale)
  const cycle = ((Math.max(0, input.elapsedSeconds) * timeScale) % span) / span
  const lifecycle = createPfxHologramBurstLifecycle(cycle)
  // Decorative scroll restarts every cycle, so every loop is identical.
  const decorativeTime = cycle * (span / timeScale) * (input.reducedMotion ? 0.3 : 1)
  const state = target ?? { ...lifecycle, cycle: 0, decorativeTime: 0 }
  Object.assign(state, lifecycle, { cycle, decorativeTime })
  return state
}

const PFX_HOLOGRAM_BURST_SUBJECT_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uGlitch;
uniform float uReveal;
uniform float uRetire;
uniform float uMotion;
uniform vec2 uHeightRange;
attribute float aHoloSection;
varying float vHeight;
varying float vShift;
varying vec3 vViewNormal;
varying vec3 vViewPos;

float pfxHoloHash(float n) { return fract(sin(n * 91.3458) * 47453.5453); }

void main() {
  float h = clamp((position.y - uHeightRange.x) / (uHeightRange.y - uHeightRange.x), 0.0, 1.0);
  float sectionH = (aHoloSection + 0.5) / ${PFX_HOLOGRAM_BURST_SECTION_COUNT}.0;
  float tick = floor(uTime * 7.0);
  float picked = step(0.6, pfxHoloHash(aHoloSection * 1.731 + tick * 0.917));
  float side = pfxHoloHash(aHoloSection * 3.117 + tick * 1.411) * 2.0 - 1.0;
  float cut = min(uReveal, 1.0 - uRetire);
  float frontActive = step(0.001, cut) * (1.0 - step(0.999, cut));
  // Sections next to a moving front tear sideways; settled sections hold
  // unless a glitch pulse is active. Whole sections move as one block.
  float nearFront = (1.0 - smoothstep(0.0, 0.18, abs(sectionH - cut))) * frontActive;
  float shift = side * picked * (uGlitch * 0.12 + nearFront * 0.05) * uMotion;
  vec3 p = position;
  p.x += shift;
  p.z += shift * 0.35;
  vec4 viewPos = modelViewMatrix * vec4(p, 1.0);
  vHeight = h;
  vShift = abs(shift);
  vViewNormal = normalize(normalMatrix * normal);
  vViewPos = viewPos.xyz;
  gl_Position = projectionMatrix * viewPos;
}
`

export const PFX_HOLOGRAM_BURST_SUBJECT_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uReveal;
uniform float uRetire;
uniform float uFlicker;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying float vHeight;
varying float vShift;
varying vec3 vViewNormal;
varying vec3 vViewPos;

void main() {
  float cut = min(uReveal, 1.0 - uRetire);
  if (vHeight > cut) discard;
  float frontActive = step(0.001, cut) * (1.0 - step(0.999, cut));
  float fromFront = cut - vHeight;
  float front = exp(-fromFront * fromFront / 0.0005) * frontActive;
  vec3 n = normalize(vViewNormal);
  vec3 v = normalize(-vViewPos);
  float facing = abs(dot(n, v));
  float rim = pow(1.0 - facing, 2.2);
  // Fine projection lines, broad scan bands rolling up, dark section seams.
  float lines = smoothstep(0.3, 0.9, 0.5 + 0.5 * sin(vHeight * 140.0 - uTime * 5.0));
  float sweep = pow(0.5 + 0.5 * sin(vHeight * 7.0 - uTime * 2.6), 10.0);
  float seam = 1.0 - 0.7 * step(0.88, fract(vHeight * ${PFX_HOLOGRAM_BURST_SECTION_COUNT}.0));
  float body = (0.14 + lines * 0.2 + rim * 1.05 + sweep * 0.5) * seam;
  body *= gl_FrontFacing ? 1.0 : 0.38;
  body += step(0.004, vShift) * 0.3;
  float energy = body * uFlicker + front * 2.2;
  vec3 color = mix(uColor, uColorHot, clamp(rim * 0.45 + sweep * 0.55 + front, 0.0, 1.0));
  gl_FragColor = vec4(color * energy, uOpacity);
}
`

const PFX_HOLOGRAM_BURST_EMITTER_VERTEX = /* glsl */ `
uniform float uRingScale;
uniform float uBeamWidth;
attribute float aEmitterPart;
varying float vPart;
varying vec3 vLocal;
varying vec3 vViewNormal;
varying vec3 vViewPos;

void main() {
  vec3 p = position;
  if (aEmitterPart < 1.5) {
    p.xz *= uRingScale;
  } else {
    p.xz *= uBeamWidth;
  }
  vec4 viewPos = modelViewMatrix * vec4(p, 1.0);
  vPart = aEmitterPart;
  vLocal = position;
  vViewNormal = normalize(normalMatrix * normal);
  vViewPos = viewPos.xyz;
  gl_Position = projectionMatrix * viewPos;
}
`

export const PFX_HOLOGRAM_BURST_EMITTER_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uIgnite;
uniform float uBeam;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying float vPart;
varying vec3 vLocal;
varying vec3 vViewNormal;
varying vec3 vViewPos;

void main() {
  float r = length(vLocal.xz);
  float angle = atan(vLocal.z, vLocal.x);
  vec3 color;
  float energy;
  if (vPart < 0.5) {
    // Projector ring: bright inner and outer edges, rotating segments.
    float edges = exp(-pow((r - 0.215) / 0.014, 2.0)) + exp(-pow((r - 0.425) / 0.016, 2.0));
    float segments = smoothstep(0.15, 0.3, fract(angle * 0.95493 - uTime * 0.25)) * 0.55 + 0.12;
    energy = (edges * 1.4 + segments * 0.5) * uIgnite;
    color = mix(uColor, uColorHot, clamp(edges, 0.0, 1.0));
  } else if (vPart < 1.5) {
    // Lens: hot core.
    float core = 1.0 - smoothstep(0.0, 0.17, r);
    energy = (0.35 + core * core * 1.6) * uIgnite;
    color = mix(uColor, uColorHot, core);
  } else {
    // Beam: bright at the lens, fading upward, brighter at its silhouette.
    float t = clamp((vLocal.y - ${EMITTER_Y.toFixed(3)}) / ${(BEAM_TOP_Y - EMITTER_Y).toFixed(3)}, 0.0, 1.0);
    vec3 n = normalize(vViewNormal);
    float facing = abs(dot(n, normalize(-vViewPos)));
    float edge = pow(1.0 - facing, 1.6);
    float streaks = pow(0.5 + 0.5 * sin(angle * 18.0 + uTime * 1.3), 8.0);
    float falloff = pow(1.0 - t, 1.7);
    energy = falloff * (0.07 + edge * 0.36 + streaks * 0.12) * uBeam;
    color = mix(uColor, uColorHot, falloff * 0.35);
  }
  gl_FragColor = vec4(color * energy, uOpacity);
}
`

export function createPfxHologramBurstSubjectMaterial(
  opacity: number,
  color: THREE.ColorRepresentation,
): THREE.ShaderMaterial {
  const base = new THREE.Color(color)
  const hot = base.clone().lerp(new THREE.Color('#f2feff'), 0.62)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGlitch: { value: 0 },
      uReveal: { value: 0 },
      uRetire: { value: 0 },
      uMotion: { value: 1 },
      uFlicker: { value: 1 },
      uHeightRange: { value: new THREE.Vector2(PFX_HOLOGRAM_BURST_SUBJECT_MIN_Y, PFX_HOLOGRAM_BURST_SUBJECT_MAX_Y) },
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uColor: { value: new THREE.Vector3(base.r, base.g, base.b) },
      uColorHot: { value: new THREE.Vector3(hot.r, hot.g, hot.b) },
    },
    vertexShader: PFX_HOLOGRAM_BURST_SUBJECT_VERTEX,
    fragmentShader: PFX_HOLOGRAM_BURST_SUBJECT_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
  material.forceSinglePass = true
  material.userData['pfxHologramBurstMaterial'] = 'projection'
  material.userData['pfxHologramBurstDrawCalls'] = 1
  material.userData['pfxHologramBurstParticleCount'] = 0
  material.userData['pfxHologramBurstFragmentTextureSamples'] = 0
  return material
}

export function createPfxHologramBurstEmitterMaterial(
  opacity: number,
  color: THREE.ColorRepresentation,
): THREE.ShaderMaterial {
  const base = new THREE.Color(color)
  const hot = base.clone().lerp(new THREE.Color('#f2feff'), 0.7)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIgnite: { value: 0 },
      uBeam: { value: 0 },
      uRingScale: { value: 0 },
      uBeamWidth: { value: 0 },
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uColor: { value: new THREE.Vector3(base.r, base.g, base.b) },
      uColorHot: { value: new THREE.Vector3(hot.r, hot.g, hot.b) },
    },
    vertexShader: PFX_HOLOGRAM_BURST_EMITTER_VERTEX,
    fragmentShader: PFX_HOLOGRAM_BURST_EMITTER_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
  material.forceSinglePass = true
  material.userData['pfxHologramBurstMaterial'] = 'emitter'
  material.userData['pfxHologramBurstDrawCalls'] = 1
  material.userData['pfxHologramBurstParticleCount'] = 0
  material.userData['pfxHologramBurstFragmentTextureSamples'] = 0
  return material
}

/** Writes one runtime state into either hologram-burst material. */
export function applyPfxHologramBurstUniforms(
  material: THREE.ShaderMaterial,
  state: PfxHologramBurstRuntimeState,
  opacity: number,
  reducedMotion: boolean,
): void {
  const u = material.uniforms
  u.uTime!.value = state.decorativeTime
  u.uOpacity!.value = state.stage === 'rest' ? 0 : opacity
  if (material.userData['pfxHologramBurstMaterial'] === 'projection') {
    u.uReveal!.value = state.reveal
    u.uRetire!.value = state.retire
    u.uGlitch!.value = state.glitch
    // Keep brightness steady when reduced motion is on.
    u.uFlicker!.value = reducedMotion ? 1 : state.flicker
    // Reduced motion keeps the subject and its fronts; it limits the
    // decorative sideways section travel.
    u.uMotion!.value = reducedMotion ? 0.35 : 1
    return
  }
  u.uIgnite!.value = state.ignite
  u.uBeam!.value = state.beam
  u.uRingScale!.value = state.ringScale
  u.uBeamWidth!.value = state.beamWidth
}

type Part = { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }

function compose(position: [number, number, number], scale: [number, number, number], rotation: [number, number, number] = [0, 0, 0]): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  )
}

/** Bakes parts into one non-indexed geometry with a per-triangle attribute. */
function mergeParts(parts: Part[], triangleValue: (centroid: THREE.Vector3, partIndex: number) => number, attributeName: string): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const values: number[] = []
  const point = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const centroid = new THREE.Vector3()
  const normalMatrix = new THREE.Matrix3()
  parts.forEach((part, partIndex) => {
    const source = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry
    if (!source.getAttribute('normal')) source.computeVertexNormals()
    normalMatrix.getNormalMatrix(part.matrix)
    const position = source.getAttribute('position')
    const normalAttribute = source.getAttribute('normal')
    for (let index = 0; index < position.count; index += 3) {
      centroid.set(0, 0, 0)
      for (let corner = 0; corner < 3; corner += 1) {
        point.fromBufferAttribute(position, index + corner).applyMatrix4(part.matrix)
        normal.fromBufferAttribute(normalAttribute, index + corner).applyMatrix3(normalMatrix).normalize()
        positions.push(point.x, point.y, point.z)
        normals.push(normal.x, normal.y, normal.z)
        centroid.add(point)
      }
      centroid.divideScalar(3)
      const value = triangleValue(centroid, partIndex)
      values.push(value, value, value)
    }
    if (source !== part.geometry) source.dispose()
    part.geometry.dispose()
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute(attributeName, new THREE.Float32BufferAttribute(values, 1))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/** Resamples a lathe profile so no triangle spans more than one section. */
function resampleProfile(points: ReadonlyArray<readonly [number, number]>, maxStep: number): THREE.Vector2[] {
  const result: THREE.Vector2[] = []
  points.slice(1).forEach((end, index) => {
    const start = points[index]!
    const steps = Math.max(1, Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / maxStep))
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps
      result.push(new THREE.Vector2(start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t))
    }
  })
  const last = points[points.length - 1]!
  result.push(new THREE.Vector2(last[0], last[1]))
  return result
}

/**
 * Library-owned projected subject: a bust with head, neck, shoulders and
 * arms. Each triangle carries its section index, so a glitch moves whole
 * horizontal sections instead of shearing the surface.
 */
export function createPfxHologramBurstSubjectGeometry(): THREE.BufferGeometry {
  const torsoProfile = resampleProfile([
    [0.27, -0.72], [0.29, -0.52], [0.31, -0.3], [0.35, -0.08], [0.4, 0.08],
    [0.42, 0.17], [0.38, 0.25], [0.26, 0.31], [0.12, 0.34], [0.0, 0.35],
  ], 0.025)
  // Arms: a capsule profile, resampled like the torso.
  const armProfile = resampleProfile([
    [0, -0.32], [0.045, -0.31], [0.066, -0.28], [0.07, -0.25], [0.07, 0.25], [0.066, 0.28], [0.045, 0.31], [0, 0.32],
  ], 0.025)
  const parts: Part[] = [
    { geometry: new THREE.LatheGeometry(torsoProfile, 36), matrix: compose([0, 0, 0], [1, 1, 0.56]) },
    { geometry: new THREE.CylinderGeometry(0.075, 0.095, 0.16, 18, 6, true), matrix: compose([0, 0.4, 0], [1, 1, 1]) },
    { geometry: new THREE.SphereGeometry(0.2, 28, 24), matrix: compose([0, 0.6, 0.01], [0.84, 1.0, 0.92]) },
    { geometry: new THREE.LatheGeometry(armProfile, 14), matrix: compose([-0.43, -0.12, 0], [1, 1, 1], [0, 0, -0.12]) },
    { geometry: new THREE.LatheGeometry(armProfile, 14), matrix: compose([0.43, -0.12, 0], [1, 1, 1], [0, 0, 0.12]) },
  ]
  const range = PFX_HOLOGRAM_BURST_SUBJECT_MAX_Y - PFX_HOLOGRAM_BURST_SUBJECT_MIN_Y
  const geometry = mergeParts(
    parts,
    (centroid) => Math.min(
      PFX_HOLOGRAM_BURST_SECTION_COUNT - 1,
      Math.max(0, Math.floor(((centroid.y - PFX_HOLOGRAM_BURST_SUBJECT_MIN_Y) / range) * PFX_HOLOGRAM_BURST_SECTION_COUNT)),
    ),
    'aHoloSection',
  )
  const box = geometry.boundingBox!
  if (box.min.y < PFX_HOLOGRAM_BURST_SUBJECT_MIN_Y - 1e-3 || box.max.y > PFX_HOLOGRAM_BURST_SUBJECT_MAX_Y + 1e-3) {
    throw new Error(`createPfxHologramBurstSubjectGeometry: bust height ${box.min.y}..${box.max.y} exceeds the authored scan range`)
  }
  geometry.userData['pfxHologramBurstGeometry'] = 'projection'
  geometry.userData['pfxHologramBurstTriangles'] = geometry.getAttribute('position').count / 3
  return geometry
}

/** Projector ring, lens and open beam cone below the bust. */
export function createPfxHologramBurstEmitterGeometry(): THREE.BufferGeometry {
  const flat: [number, number, number] = [-Math.PI / 2, 0, 0]
  const beamHeight = BEAM_TOP_Y - EMITTER_Y
  const parts: Part[] = [
    { geometry: new THREE.RingGeometry(0.2, 0.44, 48, 1), matrix: compose([0, EMITTER_Y, 0], [1, 1, 1], flat) },
    { geometry: new THREE.CircleGeometry(0.17, 32), matrix: compose([0, EMITTER_Y + 0.004, 0], [1, 1, 1], flat) },
    { geometry: new THREE.CylinderGeometry(0.5, 0.17, beamHeight, 40, 1, true), matrix: compose([0, EMITTER_Y + beamHeight / 2, 0], [1, 1, 1]) },
  ]
  const geometry = mergeParts(parts, (_centroid, partIndex) => partIndex, 'aEmitterPart')
  geometry.userData['pfxHologramBurstGeometry'] = 'emitter'
  geometry.userData['pfxHologramBurstTriangles'] = geometry.getAttribute('position').count / 3
  return geometry
}
