import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

// dissolve: a solid, library-owned ceramic urn erodes from the top down. A
// hot amber front with a charred margin crosses its real surface, and small
// flakes leave the surface exactly where the front passes. The body and the
// flakes evaluate the same erosion field, so they cannot drift apart.

export const PFX_DISSOLVE_PROP_MIN_Y = -0.72
export const PFX_DISSOLVE_PROP_MAX_Y = 0.7
export const PFX_DISSOLVE_FRAGMENT_COUNT = 64
/** Erosion-field units a flake lives after the front passes its origin. */
const FLAKE_LIFE = 0.4
/** Flakes are removed below 40% of their birth scale (additive death rule). */
const FLAKE_KILL_AGE = 0.75
const FRONT_START = 0.08
const FRONT_SPAN = 0.74
const PROGRESS_FROM = -0.04
const PROGRESS_TO = 1.34

export type PfxDissolveStage = 'heat' | 'erode' | 'release' | 'rest'

export interface PfxDissolveLifecycle {
  stage: PfxDissolveStage
  /** Erosion threshold. Surface with a field value below it is gone. */
  progress: number
  /** Anticipation glow where the front will start. */
  heat: number
}

export interface PfxDissolveRuntimeState extends PfxDissolveLifecycle {
  /** Normalized master-cycle position in [0, 1). */
  cycle: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (value: number) => {
  const x = clamp01(value)
  return x * x * (3 - 2 * x)
}

export function createPfxDissolveLifecycle(cycle: number): PfxDissolveLifecycle {
  const u = clamp01(cycle)
  const x = clamp01((u - FRONT_START) / FRONT_SPAN)
  // Half linear, half smoothstep: the front starts and ends gently but never stalls.
  const progress = PROGRESS_FROM + (PROGRESS_TO - PROGRESS_FROM) * (x * 0.5 + smooth(x) * 0.5)
  const heat = u < FRONT_START ? smooth(u / FRONT_START) : 1 - smooth((u - FRONT_START) / 0.14)
  // Last flake origin has field value 1; it is removed at 1 + life * kill age.
  const stage: PfxDissolveStage = u < FRONT_START
    ? 'heat'
    : progress < 1
      ? 'erode'
      : progress < 1 + FLAKE_LIFE * FLAKE_KILL_AGE
        ? 'release'
        : 'rest'
  return { stage, progress, heat: stage === 'rest' ? 0 : heat }
}

export function createPfxDissolveRuntimeState(
  input: {
    elapsedSeconds: number
    timing: number
    lifetime: number
    tempo: number
    motionMultiplier: number
    cycleScale: number
  },
  target?: PfxDissolveRuntimeState,
): PfxDissolveRuntimeState {
  // Same master clock as getPfxBurstCycleSeconds.
  const timeScale = Math.max(0.05, input.timing) * input.motionMultiplier * Math.max(0.1, input.tempo)
  const span = Math.max(0.3, Math.max(0.25, input.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER * Math.max(1, input.cycleScale)
  const cycle = ((Math.max(0, input.elapsedSeconds) * timeScale) % span) / span
  const lifecycle = createPfxDissolveLifecycle(cycle)
  const state = target ?? { ...lifecycle, cycle: 0 }
  Object.assign(state, lifecycle, { cycle })
  return state
}

const PFX_DISSOLVE_FIELD_GLSL = /* glsl */ `
float pfxDissolveHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float pfxDissolveNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(pfxDissolveHash(i), pfxDissolveHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(pfxDissolveHash(i + vec3(0.0, 1.0, 0.0)), pfxDissolveHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(pfxDissolveHash(i + vec3(0.0, 0.0, 1.0)), pfxDissolveHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(pfxDissolveHash(i + vec3(0.0, 1.0, 1.0)), pfxDissolveHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
// 0 erodes first (top), 1 erodes last (foot). The front leans slightly
// across the prop so it reads as a moving edge, not a horizontal wipe.
float pfxDissolveField(vec3 p) {
  float hn = clamp((p.y - (${PFX_DISSOLVE_PROP_MIN_Y.toFixed(3)})) / ${(PFX_DISSOLVE_PROP_MAX_Y - PFX_DISSOLVE_PROP_MIN_Y).toFixed(3)}, 0.0, 1.0);
  float n = pfxDissolveNoise(p * 4.2 + 1.7) * 0.62 + pfxDissolveNoise(p * 9.1 - 3.1) * 0.38;
  return clamp((1.0 - hn) * 0.66 + n * 0.34 + p.x * 0.12, 0.0, 1.0);
}
`

const PFX_DISSOLVE_PROP_VERTEX = /* glsl */ `
varying vec3 vLocal;
varying vec3 vViewNormal;
varying vec3 vViewPos;

void main() {
  vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
  vLocal = position;
  vViewNormal = normalize(normalMatrix * normal);
  vViewPos = viewPos.xyz;
  gl_Position = projectionMatrix * viewPos;
}
`

export const PFX_DISSOLVE_PROP_FRAGMENT = /* glsl */ `
uniform float uProgress;
uniform float uHeat;
uniform float uEdge;
uniform vec3 uColor;
uniform vec3 uGlaze;
uniform vec3 uEdgeHot;
uniform vec3 uEdgeCore;
varying vec3 vLocal;
varying vec3 vViewNormal;
varying vec3 vViewPos;
${PFX_DISSOLVE_FIELD_GLSL}

void main() {
  float e = pfxDissolveField(vLocal);
  float d = e - uProgress;
  if (d < 0.0) discard;
  vec3 n = normalize(vViewNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(-vViewPos);
  vec3 lightDir = normalize(vec3(-0.45, 0.75, 0.5));
  float diffuse = max(dot(n, lightDir), 0.0);
  float spec = pow(max(dot(reflect(-lightDir, n), v), 0.0), 28.0);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  // Painted glaze: two bands and a zigzag frieze give the prop identity.
  float angle = atan(vLocal.z, vLocal.x);
  float band = max(
    1.0 - smoothstep(0.018, 0.026, abs(vLocal.y - 0.02)),
    1.0 - smoothstep(0.012, 0.02, abs(vLocal.y + 0.36)));
  float zig = abs(fract(angle * 1.909859) * 2.0 - 1.0);
  float frieze = 1.0 - smoothstep(0.012, 0.022, abs(vLocal.y + 0.17 - zig * 0.07));
  vec3 base = mix(uColor, uGlaze, max(band, frieze));
  vec3 color = base * (0.42 + diffuse * 0.9) + vec3(spec * 0.36) + uGlaze * rim * 0.22;
  // Back faces are the hollow interior seen through the eroded holes.
  if (!gl_FrontFacing) color = uColor * 0.16;
  float hot = 1.0 - smoothstep(0.0, uEdge, d);
  float charred = 1.0 - smoothstep(uEdge, uEdge * 3.4, d);
  color *= 1.0 - charred * 0.82;
  color += mix(uEdgeHot, uEdgeCore, hot * hot) * hot * 2.4;
  color += uEdgeHot * uHeat * (1.0 - smoothstep(0.0, 0.22, e)) * 0.85;
  gl_FragColor = vec4(color, 1.0);
}
`

const PFX_DISSOLVE_FRAGMENT_VERTEX = /* glsl */ `
uniform float uProgress;
uniform float uMotion;
attribute vec3 aOrigin;
attribute vec3 aOutward;
attribute float aSeed;
varying float vHeat;
${PFX_DISSOLVE_FIELD_GLSL}

void main() {
  float e = pfxDissolveField(aOrigin);
  float age = (uProgress - e) / ${FLAKE_LIFE.toFixed(3)};
  float alive = step(0.0, age) * step(age, ${FLAKE_KILL_AGE.toFixed(3)});
  float a = clamp(age, 0.0, 1.0);
  // Additive flakes die by scale at full brightness.
  float size = pow(1.0 - a, 0.7) * alive;
  float spin = a * (4.0 + aSeed * 5.0) * (aSeed > 0.5 ? 1.0 : -1.0) * uMotion;
  float c = cos(spin);
  float s = sin(spin);
  vec3 shape = position * size;
  shape = vec3(c * shape.x - s * shape.y, s * shape.x + c * shape.y, shape.z);
  vec3 drift = aOutward * (0.04 + 0.14 * a) + vec3(0.0, 0.2 * a + 0.2 * a * a, 0.0);
  drift *= mix(0.45, 1.0, uMotion);
  drift.x += sin(a * 5.0 + aSeed * 6.2831) * 0.04 * a * uMotion;
  vec3 p = aOrigin + drift + shape;
  vHeat = 1.0 - a;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

export const PFX_DISSOLVE_FRAGMENT_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform vec3 uEdgeHot;
uniform vec3 uEdgeCore;
varying float vHeat;

void main() {
  // Cool the corpse: white-gold at release, amber, then deep ember.
  vec3 ember = uEdgeHot * vec3(0.75, 0.32, 0.12);
  vec3 color = mix(ember, mix(uEdgeHot, uEdgeCore, vHeat * vHeat * vHeat), vHeat) * (0.75 + vHeat * 0.55);
  gl_FragColor = vec4(color, uOpacity);
}
`

const DEFAULT_GLAZE = '#bff3e8'
const DEFAULT_EDGE_HOT = '#ff9a2e'
const DEFAULT_EDGE_CORE = '#fff1c8'

const vec3Of = (color: THREE.ColorRepresentation) => {
  const value = new THREE.Color(color)
  return new THREE.Vector3(value.r, value.g, value.b)
}

/** Opaque ceramic body. It writes depth, so it occludes like a real prop. */
export function createPfxDissolvePropMaterial(color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uProgress: { value: PROGRESS_FROM },
      uHeat: { value: 0 },
      uEdge: { value: 0.045 },
      uColor: { value: vec3Of(color) },
      uGlaze: { value: vec3Of(DEFAULT_GLAZE) },
      uEdgeHot: { value: vec3Of(DEFAULT_EDGE_HOT) },
      uEdgeCore: { value: vec3Of(DEFAULT_EDGE_CORE) },
    },
    vertexShader: PFX_DISSOLVE_PROP_VERTEX,
    fragmentShader: PFX_DISSOLVE_PROP_FRAGMENT,
    transparent: false,
    blending: THREE.NormalBlending,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
  material.userData['pfxDissolveMaterial'] = 'prop'
  material.userData['pfxDissolveDrawCalls'] = 1
  material.userData['pfxDissolveParticleCount'] = 0
  material.userData['pfxDissolveFragmentTextureSamples'] = 0
  return material
}

/** Additive edge flakes released by the same front. */
export function createPfxDissolveFragmentMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uProgress: { value: PROGRESS_FROM },
      uMotion: { value: 1 },
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uEdgeHot: { value: vec3Of(color) },
      uEdgeCore: { value: vec3Of(DEFAULT_EDGE_CORE) },
    },
    vertexShader: PFX_DISSOLVE_FRAGMENT_VERTEX,
    fragmentShader: PFX_DISSOLVE_FRAGMENT_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
  material.forceSinglePass = true
  material.userData['pfxDissolveMaterial'] = 'fragments'
  material.userData['pfxDissolveDrawCalls'] = 1
  material.userData['pfxDissolveParticleCount'] = 0
  material.userData['pfxDissolveFragmentTextureSamples'] = 0
  return material
}

/** Writes one runtime state into either dissolve material. */
export function applyPfxDissolveUniforms(
  material: THREE.ShaderMaterial,
  state: PfxDissolveRuntimeState,
  opacity: number,
  reducedMotion: boolean,
): void {
  const u = material.uniforms
  u.uProgress!.value = state.progress
  if (material.userData['pfxDissolveMaterial'] === 'prop') {
    u.uHeat!.value = state.heat
    return
  }
  u.uOpacity!.value = state.stage === 'rest' ? 0 : opacity
  // Reduced motion keeps the front and the flake release; it shortens the
  // decorative drift and spin.
  u.uMotion!.value = reducedMotion ? 0.3 : 1
}

/** Urn silhouette (radius, height) from foot to lip. */
const URN_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.0, -0.72], [0.2, -0.72], [0.22, -0.69], [0.17, -0.63], [0.14, -0.56],
  [0.2, -0.47], [0.3, -0.33], [0.36, -0.15], [0.37, 0.0], [0.34, 0.14],
  [0.27, 0.27], [0.17, 0.37], [0.12, 0.45], [0.12, 0.57], [0.17, 0.66],
  [0.2, 0.7], [0.16, 0.7], [0.11, 0.62],
]

export function createPfxDissolvePropGeometry(): THREE.BufferGeometry {
  const body = new THREE.LatheGeometry(URN_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 40)
  const parts: THREE.BufferGeometry[] = [body.toNonIndexed()]
  body.dispose()
  for (const side of [-1, 1]) {
    // C-shaped handle from the shoulder down to the upper body.
    const handle = new THREE.TorusGeometry(0.12, 0.03, 8, 18, Math.PI)
    handle.rotateZ(side > 0 ? -Math.PI / 2 : Math.PI / 2)
    handle.translate(side * 0.28, 0.17, 0)
    parts.push(handle.toNonIndexed())
    handle.dispose()
  }
  const positions: number[] = []
  const normals: number[] = []
  for (const part of parts) {
    positions.push(...(part.getAttribute('position').array as Float32Array))
    normals.push(...(part.getAttribute('normal').array as Float32Array))
    part.dispose()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  const box = geometry.boundingBox!
  if (box.min.y < PFX_DISSOLVE_PROP_MIN_Y - 1e-3 || box.max.y > PFX_DISSOLVE_PROP_MAX_Y + 1e-3) {
    throw new Error(`createPfxDissolvePropGeometry: urn height ${box.min.y}..${box.max.y} exceeds the erosion range`)
  }
  geometry.userData['pfxDissolveGeometry'] = 'prop'
  geometry.userData['pfxDissolveTriangles'] = positions.length / 9
  return geometry
}

/** Small deterministic generator (mulberry32) for flake placement. */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Flakes sit on the outer urn surface. Origins are area-weighted along the
 * profile with stratified azimuths, so the release has no clumps or gaps.
 */
export function createPfxDissolveFragmentGeometry(seed = 0x5eed0d15): THREE.BufferGeometry {
  const random = createSeededRandom(seed)
  // Outer wall only: stop before the lip turns inward.
  const outer = URN_PROFILE.slice(1, 16)
  const segments = outer.slice(1).map((end, index) => {
    const start = outer[index]!
    const length = Math.hypot(end[0] - start[0], end[1] - start[1])
    return { start, end, weight: length * (start[0] + end[0]) * 0.5 }
  })
  const totalWeight = segments.reduce((sum, segment) => sum + segment.weight, 0)
  const positions: number[] = []
  const origins: number[] = []
  const outwards: number[] = []
  const seeds: number[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let index = 0; index < PFX_DISSOLVE_FRAGMENT_COUNT; index += 1) {
    let pick = random() * totalWeight
    const segment = segments.find((candidate) => (pick -= candidate.weight) <= 0) ?? segments[segments.length - 1]!
    const t = random()
    const radius = segment.start[0] + (segment.end[0] - segment.start[0]) * t + 0.004
    const y = segment.start[1] + (segment.end[1] - segment.start[1]) * t
    const azimuth = index * golden + (random() - 0.5) * 0.4
    const dr = segment.end[0] - segment.start[0]
    const dy = segment.end[1] - segment.start[1]
    const outward = new THREE.Vector3(dy * Math.cos(azimuth), -dr, dy * Math.sin(azimuth)).normalize()
    const origin = [radius * Math.cos(azimuth), y, radius * Math.sin(azimuth)] as const
    const size = 0.4 + random() * 0.75
    const flakeSeed = random()
    const corners = [
      [0, 0.05, 0], [-0.034, -0.022, 0.008], [0.038, -0.026, -0.006], [0.004, 0.002, 0.026],
    ].map(([x, yy, z]) => [x! * size, yy! * size, z! * size] as const)
    for (const [a, b, c] of [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]] as const) {
      for (const corner of [corners[a]!, corners[b]!, corners[c]!]) {
        positions.push(...corner)
        origins.push(...origin)
        outwards.push(outward.x, outward.y, outward.z)
        seeds.push(flakeSeed)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aOrigin', new THREE.Float32BufferAttribute(origins, 3))
  geometry.setAttribute('aOutward', new THREE.Float32BufferAttribute(outwards, 3))
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1))
  // Flakes drift up to about 0.7 units from the surface; keep them unculled.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.2, 0), 1.6)
  geometry.userData['pfxDissolveGeometry'] = 'fragments'
  geometry.userData['pfxDissolveFragmentCount'] = PFX_DISSOLVE_FRAGMENT_COUNT
  geometry.userData['pfxDissolveTriangles'] = positions.length / 9
  return geometry
}
