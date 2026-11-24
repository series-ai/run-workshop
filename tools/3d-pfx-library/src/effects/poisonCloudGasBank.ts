import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

// poison-cloud: a persistent hazard. A low bank of layered gas rolls
// outward over a dark ground stain. The lower body is dark; the upper
// billows catch a sickly yellow-green light with slow internal glow. A few
// spores rise from it and small bubbles swell and pop at its base. Every
// motion is a whole-number multiple of the master loop, so the last frame
// meets the first. Nothing fades to empty.

export interface PfxPoisonCloudRuntimeState {
  /** Normalized master-loop position in [0, 1). */
  cycle: number
  /** Slow inhale/exhale, 0..1, one breath per loop. */
  breath: number
}

export function createPfxPoisonCloudRuntimeState(
  input: {
    elapsedSeconds: number
    timing: number
    lifetime: number
    tempo: number
    motionMultiplier: number
    cycleScale: number
  },
  target?: PfxPoisonCloudRuntimeState,
): PfxPoisonCloudRuntimeState {
  // Same master clock as getPfxBurstCycleSeconds; the loop period is the
  // timeline period.
  const timeScale = Math.max(0.05, input.timing) * input.motionMultiplier * Math.max(0.1, input.tempo)
  const span = Math.max(0.3, Math.max(0.25, input.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER * Math.max(1, input.cycleScale)
  const cycle = ((Math.max(0, input.elapsedSeconds) * timeScale) % span) / span
  const breath = 0.5 - 0.5 * Math.cos(cycle * Math.PI * 2)
  const state = target ?? { cycle: 0, breath: 0 }
  state.cycle = cycle
  state.breath = breath
  return state
}

/** Puff bands, back-to-front draw order inside the single draw. */
export const PFX_POISON_CLOUD_BANDS = ['ground', 'low', 'mid', 'crest'] as const
export type PfxPoisonCloudBand = (typeof PFX_POISON_CLOUD_BANDS)[number]
const BAND_CODE: Record<PfxPoisonCloudBand, number> = { ground: 0, low: 1, mid: 2, crest: 3 }

interface PuffSpec {
  band: Exclude<PfxPoisonCloudBand, 'ground'>
  count: number
  radius: readonly [number, number]
  height: readonly [number, number]
  size: readonly [number, number]
  aspect: number
}

const PUFFS: readonly PuffSpec[] = [
  { band: 'low', count: 10, radius: [0.15, 1.2], height: [0.14, 0.26], size: [0.46, 0.6], aspect: 1.65 },
  { band: 'mid', count: 9, radius: [0.1, 0.95], height: [0.42, 0.6], size: [0.4, 0.54], aspect: 1.45 },
  { band: 'crest', count: 6, radius: [0.05, 0.72], height: [0.7, 0.88], size: [0.32, 0.44], aspect: 1.3 },
]
export const PFX_POISON_CLOUD_PUFF_COUNT = PUFFS.reduce((sum, spec) => sum + spec.count, 0)
const GROUND_RADIUS = 1.75
export const PFX_POISON_CLOUD_SPORE_COUNT = 14
export const PFX_POISON_CLOUD_BUBBLE_COUNT = 4

/** Seeded generator. Hashes the index, so draws are not correlated. */
function hash01(index: number, salt: number): number {
  let h = Math.imul(index ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 0x632be5ab, 0xc2b2ae35)
  h ^= h >>> 16
  h = Math.imul(h, 0x7feb352d)
  h ^= h >>> 15
  h = Math.imul(h, 0x846ca68b)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

const PFX_POISON_NOISE_GLSL = /* glsl */ `
float pfxPoisonHash(vec2 p) {
  p = fract(p * vec2(0.3183099, 0.3678794) + 0.13);
  p *= 17.0;
  return fract(p.x * p.y * (p.x + p.y));
}
float pfxPoisonNoise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(pfxPoisonHash(i), pfxPoisonHash(i + vec2(1.0, 0.0)), f.x),
             mix(pfxPoisonHash(i + vec2(0.0, 1.0)), pfxPoisonHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float pfxPoisonFbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 4; octave += 1) {
    value += amplitude * pfxPoisonNoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.31;
    amplitude *= 0.5;
  }
  return value / 0.9375;
}
`

const PFX_POISON_GAS_VERTEX = /* glsl */ `
uniform float uCycle;
uniform float uBreath;
uniform float uMotion;
attribute vec2 aCorner;
attribute vec4 aPuff;
attribute vec4 aPuffMotion;
varying vec2 vUv;
varying float vBand;
varying float vSeed;
varying float vLife;
varying float vAlpha;
varying float vRollSign;
varying float vHeight;

void main() {
  float band = aPuffMotion.z;
  float seed = aPuffMotion.x;
  vUv = aCorner;
  vBand = band;
  vSeed = seed;
  if (band < 0.5) {
    // Ground stain: a flat quad on the floor.
    float r = aPuff.w * (1.0 + 0.03 * uBreath);
    vec3 p = vec3(aCorner.x * r, 0.004, aCorner.y * r);
    vLife = 0.0;
    vAlpha = 1.0;
    vRollSign = 1.0;
    vHeight = 1.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    return;
  }
  // Each puff rolls outward from its home and is replaced in place. Its
  // rate is a whole number of lives per loop, so the loop is seamless.
  float life = fract(uCycle * aPuffMotion.y + seed);
  vec2 home = aPuff.xz;
  vec2 dir = length(home) > 1e-3 ? normalize(home) : vec2(1.0, 0.0);
  vec2 tangent = vec2(-dir.y, dir.x);
  float rollSign = seed > 0.5 ? 1.0 : -1.0;
  float travel = (life - 0.45) * 0.46 * uMotion;
  vec3 p = vec3(home.x, aPuff.y, home.y);
  p.xz += dir * travel + tangent * travel * 0.4 * rollSign;
  p.y += life * 0.1 * uMotion * (band > 1.5 ? 1.0 : 0.5);
  // Alpha body: fade in, hold, fade out while still growing.
  vAlpha = smoothstep(0.0, 0.24, life) * (1.0 - smoothstep(0.62, 1.0, life));
  vLife = life;
  vRollSign = rollSign;
  float size = aPuff.w * (0.78 + 0.42 * life) * (0.97 + 0.06 * uBreath);
  float scale = length(modelViewMatrix[0].xyz);
  vec4 viewPos = modelViewMatrix * vec4(p, 1.0);
  viewPos.xy += aCorner * vec2(size * aPuffMotion.w, size) * scale;
  // Approximate floor height of this corner; the fragment cuts the puff
  // where it would pass below the ground.
  vHeight = p.y + aCorner.y * size;
  gl_Position = projectionMatrix * viewPos;
}
`

export const PFX_POISON_GAS_FRAGMENT = /* glsl */ `
uniform float uCycle;
uniform float uMotion;
uniform float uOpacity;
uniform vec3 uColorDark;
uniform vec3 uColorLit;
uniform vec3 uColorGlow;
varying vec2 vUv;
varying float vBand;
varying float vSeed;
varying float vLife;
varying float vAlpha;
varying float vRollSign;
varying float vHeight;
${PFX_POISON_NOISE_GLSL}

void main() {
  float loopAngle = uCycle * 6.2831853;
  vec2 flow = vec2(cos(loopAngle), sin(loopAngle)) * 0.55 * uMotion;
  // Second, faster circulation for the glow pockets: two turns per loop.
  vec2 churn = vec2(cos(loopAngle * 2.0 + 1.1), sin(loopAngle * 2.0 + 1.1)) * 0.45 * uMotion;
  if (vBand < 0.5) {
    // Dark, soft stain with a broken outline.
    float r = length(vUv);
    float angle = atan(vUv.y, vUv.x);
    float edgeNoise = pfxPoisonFbm(vec2(cos(angle), sin(angle)) * 1.7 + flow * 0.5 + 3.1);
    float edge = 0.7 + 0.24 * (edgeNoise - 0.5) * 2.0;
    float body = 1.0 - smoothstep(edge - 0.38, edge, r);
    float mottle = pfxPoisonFbm(vUv * 3.2 + flow + 1.7);
    float alpha = body * (0.5 + 0.2 * mottle) * uOpacity;
    if (alpha < 0.004) discard;
    // Faint sick light where the gas meets the floor near its edge.
    float sheen = smoothstep(edge - 0.5, edge - 0.18, r) * (1.0 - smoothstep(edge - 0.18, edge, r));
    vec3 color = mix(uColorDark * 0.5, uColorDark, mottle) + uColorLit * sheen * 0.22;
    gl_FragColor = vec4(color, alpha);
    return;
  }
  // Rolling billow: the noise turns about the puff as it travels.
  float roll = vLife * 3.2 * vRollSign * (0.4 + 0.6 * uMotion);
  float cr = cos(roll);
  float sr = sin(roll);
  vec2 q = mat2(cr, sr, -sr, cr) * vUv;
  vec2 offset = vec2(vSeed * 17.3, vSeed * 9.1);
  float n = pfxPoisonFbm(q * 1.55 + offset + flow);
  // Warp the radius with the noise, so no puff keeps a round outline.
  float warp = pfxPoisonFbm(q * 0.9 + offset.yx * 0.7 - flow * 0.6 + 2.3);
  float r = length(vUv * vec2(1.0, 1.08)) + (warp - 0.5) * 0.62;
  float shape = 1.0 - smoothstep(0.15, 0.95, r);
  float raw = shape * (0.3 + 1.05 * n);
  float density = smoothstep(0.3, 0.82, raw);
  float floorCut = smoothstep(-0.02, 0.1, vHeight);
  float alpha = density * floorCut * vAlpha * (vBand < 1.5 ? 0.7 : vBand < 2.5 ? 0.62 : 0.54) * uOpacity;
  if (alpha < 0.004) discard;
  // Lit from above: lower band and puff bottoms stay dark.
  float bandLight = vBand < 1.5 ? 0.26 : vBand < 2.5 ? 0.7 : 1.0;
  float top = smoothstep(-0.45, 0.8, vUv.y + (n - 0.5) * 0.7);
  vec3 color = mix(uColorDark, uColorLit, top * bandLight);
  // Slow internal glow pockets drift through the body.
  float pocket = pfxPoisonFbm(q * 2.2 - churn * 2.2 + offset.yx + 4.7);
  color += uColorGlow * smoothstep(0.54, 0.8, pocket) * (0.28 + bandLight * 0.6) * shape;
  // Keep the hue where light stacks: scale, do not clip per channel.
  color /= max(1.0, max(color.r, max(color.g, color.b)));
  gl_FragColor = vec4(color, alpha);
}
`

const PFX_POISON_SPORE_VERTEX = /* glsl */ `
uniform float uCycle;
uniform float uMotion;
attribute vec2 aCorner;
attribute vec4 aSpore;
attribute vec4 aSporeMotion;
varying vec2 vUv;
varying float vKind;
varying float vPop;

void main() {
  float kind = aSporeMotion.z;
  float seed = aSporeMotion.x;
  float life = fract(uCycle * aSporeMotion.y + seed);
  vec3 p = aSpore.xyz;
  float size;
  vPop = 0.0;
  if (kind < 0.5) {
    // Spore: rises slowly with a lazy curl; additive, so it dies by size.
    p.y += life * 0.62 * (0.5 + 0.5 * uMotion);
    p.x += sin(life * 6.2831853 + seed * 11.0) * 0.07 * uMotion;
    p.z += cos(life * 6.2831853 + seed * 7.0) * 0.06 * uMotion;
    size = aSpore.w * pow(sin(3.14159265 * life), 0.6);
  } else {
    // Bubble: swells at the base of the gas for the first third of its
    // life, then pops. It is absent for the rest of the life.
    float grow = clamp(life / 0.32, 0.0, 1.0);
    float pop = smoothstep(0.32, 0.36, life);
    size = life < 0.36 ? aSpore.w * (0.25 + 0.75 * sqrt(grow)) * (1.0 + 0.35 * pop) : 0.0;
    vPop = pop;
  }
  vUv = aCorner;
  vKind = kind;
  float scale = length(modelViewMatrix[0].xyz);
  vec4 viewPos = modelViewMatrix * vec4(p, 1.0);
  viewPos.xy += aCorner * size * scale;
  gl_Position = projectionMatrix * viewPos;
}
`

export const PFX_POISON_SPORE_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColorLit;
uniform vec3 uColorGlow;
varying vec2 vUv;
varying float vKind;
varying float vPop;

void main() {
  float d = length(vUv);
  if (d > 1.0) discard;
  if (vKind < 0.5) {
    float core = exp(-d * d * 9.0);
    gl_FragColor = vec4(mix(uColorGlow, vec3(0.96, 1.0, 0.78), core * 0.35) * core * 1.05, uOpacity);
    return;
  }
  // The ring thins to nothing as the bubble pops.
  float thickness = mix(0.13, 0.015, vPop);
  float ring = exp(-pow((d - 0.78) / thickness, 2.0));
  float fill = (1.0 - smoothstep(0.0, 0.8, d)) * 0.1 * (1.0 - vPop);
  float highlight = exp(-dot(vUv - vec2(-0.32, 0.34), vUv - vec2(-0.32, 0.34)) * 60.0) * (1.0 - vPop);
  float energy = ring * 0.55 * (1.0 - vPop * 0.6) + fill + highlight * 0.5;
  gl_FragColor = vec4(mix(uColorLit, uColorGlow, 0.4) * energy, uOpacity);
}
`

/** Dark body, sickly lit crest and glow, all derived from one control colour. */
function poisonPalette(color: THREE.ColorRepresentation): { dark: THREE.Color; lit: THREE.Color; glow: THREE.Color } {
  const hsl = { h: 0, s: 0, l: 0 }
  new THREE.Color(color).getHSL(hsl)
  // Shift green toward yellow for the sick light; keep the body dark.
  const wrap = (h: number) => ((h % 1) + 1) % 1
  return {
    dark: new THREE.Color().setHSL(wrap(hsl.h - 0.07), Math.min(1, hsl.s * 0.55), 0.1),
    lit: new THREE.Color().setHSL(wrap(hsl.h - 0.15), Math.min(1, hsl.s * 0.9), 0.54),
    glow: new THREE.Color().setHSL(wrap(hsl.h - 0.18), Math.min(1, hsl.s + 0.1), 0.62),
  }
}

const vec3Of = (color: THREE.Color) => new THREE.Vector3(color.r, color.g, color.b)

function finishMaterial(material: THREE.ShaderMaterial, part: 'gas' | 'spores', particles: number): THREE.ShaderMaterial {
  material.forceSinglePass = true
  material.userData['pfxPoisonCloudMaterial'] = part
  material.userData['pfxPoisonCloudDrawCalls'] = 1
  material.userData['pfxPoisonCloudParticleCount'] = particles
  material.userData['pfxPoisonCloudFragmentTextureSamples'] = 0
  return material
}

export function createPfxPoisonCloudGasMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  const palette = poisonPalette(color)
  return finishMaterial(new THREE.ShaderMaterial({
    uniforms: {
      uCycle: { value: 0 },
      uBreath: { value: 0 },
      uMotion: { value: 1 },
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uColorDark: { value: vec3Of(palette.dark) },
      uColorLit: { value: vec3Of(palette.lit) },
      uColorGlow: { value: vec3Of(palette.glow) },
    },
    vertexShader: PFX_POISON_GAS_VERTEX,
    fragmentShader: PFX_POISON_GAS_FRAGMENT,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), 'gas', PFX_POISON_CLOUD_PUFF_COUNT)
}

export function createPfxPoisonCloudSporeMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  const palette = poisonPalette(color)
  return finishMaterial(new THREE.ShaderMaterial({
    uniforms: {
      uCycle: { value: 0 },
      uMotion: { value: 1 },
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uColorLit: { value: vec3Of(palette.lit) },
      uColorGlow: { value: vec3Of(palette.glow) },
    },
    vertexShader: PFX_POISON_SPORE_VERTEX,
    fragmentShader: PFX_POISON_SPORE_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), 'spores', PFX_POISON_CLOUD_SPORE_COUNT + PFX_POISON_CLOUD_BUBBLE_COUNT)
}

/** Writes one runtime state into either poison-cloud material. */
export function applyPfxPoisonCloudUniforms(
  material: THREE.ShaderMaterial,
  state: PfxPoisonCloudRuntimeState,
  opacity: number,
  reducedMotion: boolean,
): void {
  const u = material.uniforms
  u.uCycle!.value = state.cycle
  // Reduced motion keeps the hazard area and its brightness. It shortens the
  // puff roll, the spore curl and the internal flow.
  u.uMotion!.value = reducedMotion ? 0.4 : 1
  u.uOpacity!.value = opacity
  if (material.userData['pfxPoisonCloudMaterial'] === 'gas') u.uBreath!.value = reducedMotion ? 0.5 : state.breath
}

/** Appends one camera-facing quad with per-quad attributes. */
function appendQuad(target: { corner: number[]; a: number[]; b: number[]; index: number[] }, a: readonly number[], b: readonly number[]): void {
  const base = target.corner.length / 2
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    target.corner.push(x, y)
    target.a.push(...a)
    target.b.push(...b)
  }
  target.index.push(base, base + 1, base + 2, base, base + 2, base + 3)
}

function finishGeometry(
  target: { corner: number[]; a: number[]; b: number[]; index: number[] },
  names: readonly [string, string],
  part: 'gas' | 'spores',
  bounds: THREE.Box3,
): THREE.BufferGeometry {
  const count = target.corner.length / 2
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3))
  geometry.setAttribute('aCorner', new THREE.Float32BufferAttribute(target.corner, 2))
  geometry.setAttribute(names[0], new THREE.Float32BufferAttribute(target.a, 4))
  geometry.setAttribute(names[1], new THREE.Float32BufferAttribute(target.b, 4))
  geometry.setIndex(target.index)
  // The vertex shader places every quad. Bound the authored volume.
  geometry.boundingBox = bounds
  geometry.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere())
  geometry.userData['pfxPoisonCloudGeometry'] = part
  geometry.userData['pfxPoisonCloudQuads'] = count / 4
  return geometry
}

/**
 * Gas bank in local ground space (y = 0 is the floor): one ground stain,
 * then the low, mid and crest puff bands. Homes use golden-angle strata.
 */
export function createPfxPoisonCloudGasGeometry(): THREE.BufferGeometry {
  const target = { corner: [] as number[], a: [] as number[], b: [] as number[], index: [] as number[] }
  appendQuad(target, [0, 0, 0, GROUND_RADIUS], [0.31, 0, BAND_CODE.ground, 1])
  let serial = 0
  for (const spec of PUFFS) {
    for (let index = 0; index < spec.count; index += 1) {
      serial += 1
      const strata = (index + 0.25 + 0.5 * hash01(serial, 1)) / spec.count
      const radius = spec.radius[0] + (spec.radius[1] - spec.radius[0]) * Math.sqrt(strata)
      const angle = serial * GOLDEN_ANGLE + hash01(serial, 2) * 0.6
      const height = spec.height[0] + (spec.height[1] - spec.height[0]) * hash01(serial, 3)
      const size = spec.size[0] + (spec.size[1] - spec.size[0]) * hash01(serial, 4)
      // One or two lives per loop: whole numbers keep the loop seamless.
      const rate = hash01(serial, 5) < 0.55 ? 1 : 2
      appendQuad(
        target,
        [Math.cos(angle) * radius, height, Math.sin(angle) * radius * 0.82, size],
        [hash01(serial, 6), rate, BAND_CODE[spec.band], spec.aspect * (0.9 + 0.2 * hash01(serial, 7))],
      )
    }
  }
  return finishGeometry(target, ['aPuff', 'aPuffMotion'], 'gas', new THREE.Box3(new THREE.Vector3(-2.4, -0.1, -2.4), new THREE.Vector3(2.4, 1.4, 2.4)))
}

/** Rising spores, then the bubbles at the gas base. */
export function createPfxPoisonCloudSporeGeometry(): THREE.BufferGeometry {
  const target = { corner: [] as number[], a: [] as number[], b: [] as number[], index: [] as number[] }
  for (let index = 0; index < PFX_POISON_CLOUD_SPORE_COUNT; index += 1) {
    const radius = 1.05 * Math.sqrt((index + 0.5) / PFX_POISON_CLOUD_SPORE_COUNT)
    const angle = index * GOLDEN_ANGLE + 0.9
    const size = 0.022 + 0.03 * hash01(index, 11)
    const rate = 1 + Math.floor(hash01(index, 12) * 2)
    appendQuad(
      target,
      [Math.cos(angle) * radius, 0.08 + 0.3 * hash01(index, 13), Math.sin(angle) * radius * 0.82, size],
      [hash01(index, 14), rate, 0, 0],
    )
  }
  for (let index = 0; index < PFX_POISON_CLOUD_BUBBLE_COUNT; index += 1) {
    const radius = 0.25 + 0.6 * ((index + 0.5) / PFX_POISON_CLOUD_BUBBLE_COUNT)
    const angle = index * GOLDEN_ANGLE * 1.3 + 0.4
    appendQuad(
      target,
      [Math.cos(angle) * radius, 0.07, Math.sin(angle) * radius * 0.82, 0.07 + 0.04 * hash01(index, 21)],
      [(index + 0.5) / PFX_POISON_CLOUD_BUBBLE_COUNT, 1, 1, 0],
    )
  }
  return finishGeometry(target, ['aSpore', 'aSporeMotion'], 'spores', new THREE.Box3(new THREE.Vector3(-1.4, -0.1, -1.4), new THREE.Vector3(1.4, 1.2, 1.4)))
}
