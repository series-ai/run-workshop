/**
 * @file atmosphere.ts — "Neon Rain" sky, altitude-graded haze, god rays, searchlights, rain streaks.
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   R3  — altitude-graded haze, god-ray billboards, sparse neon; <= 16 draw calls for city + atmosphere.
 *   R7  — quality tiers are presentation-only (god rays on/off, DPR clamp).
 *   Design "Sim <-> render split" — nothing here feeds simulation; float math is fine.
 *   T3  — "skydome, god rays, searchlights" with a single shared height-fog implementation.
 *
 * Approved visual direction (supersedes the plan's pale-daylight phrasing): night, light rain, thick
 * atmosphere. Haze is a deep blue-grey, near-opaque in the depths and clearer high up, tinted by the
 * neon it scatters. God rays pour through the canyon gaps; two searchlights creep across the towers.
 *
 * Draw-call budget: 4.
 *   skydome 1 + god rays 1 + searchlights 1 + rain streaks 1 (top tier only).
 * Every multi-element pass is one instanced mesh, so the count does not move with element counts.
 *
 * Shared fog contract (one implementation, used by city.ts and by T4's traffic materials):
 *   - `installSkyriverFogChunks()` replaces THREE.ShaderChunk.fog_* with the altitude-graded version.
 *     It declares `skyriverFogFactor()` / `skyriverFogColor()` in fog_pars_fragment, so additive
 *     materials can attenuate with the same density curve instead of mixing toward the haze colour.
 *   - `applySkyriverFog(material)` wires the uniforms. The depths colour/density ride three's own
 *     `fogColor` / `fogDensity` (refreshed from `scene.fog`, so built-in materials need nothing extra);
 *     the high-altitude pair and the grading window are the `uSkyFog*` extras.
 *
 * WebGL is only touched inside the class constructors, so importing this module under node (vitest)
 * is safe. `installSkyriverFogChunks()` mutates three's global chunk table and therefore runs from
 * the constructor, before the first program compiles.
 */
import * as THREE from 'three';

import type { SkyriverCityLayout } from '../sim/derive';
import type { SkyriverFrame, SkyriverQualitySettings } from './scene';

/** Draw calls this module may spend (plan R3 shares 16 with city and traffic; T3 owns 4 here). */
export const SKYRIVER_ATMOSPHERE_DRAW_CALL_BUDGET = 4;

/**
 * Tunables, exported so a node-only check can assert them without a GL context.
 * Distances are metres; `CHASM_BOUNDS.minY` is 60 and towers reach 1900, so the grading window
 * covers the whole flyable volume.
 */
export const SKYRIVER_ATMOSPHERE = Object.freeze({
  /** Haze grading window: y below this is full depths murk, y above floor+range is the clear end. */
  fogFloorY: 40,
  // T6R: the presented canyon walls rise to ~3.5 km (presentationLayout.ts), so the grade spans more.
  fogRangeY: 2600,
  /**
   * FogExp2 densities. The factor is `1 - exp( -(density * depth)^2 )`, so density is read as "one
   * over the distance at which the haze is most of the way in": ~380 m in the depths, ~1.8 km high
   * up. The depths being ~5x denser is what closes off the canyon floor without a ground plane.
   */
  // T6R: ~0.0026 closed the canyon at ~400 m, which hid every light river and the vanishing point.
  // The haze now reads as a luminous volume about 1.2 km deep, still opaque toward the depths.
  // T6R-2: exponential, not exp-squared. Exp-squared saturates to a flat wall of haze colour by
  // ~2 km (the "flat blue monolith" in the vanishing slot); exponential keeps grading, so near,
  // mid and far masses separate into layers. Below the canyon floor band the density triples
  // (see skyriverFogFactor) and the colour sinks to the deep tone: the bottom reads as void.
  fogDensityLow: 0.00078,
  fogDensityHigh: 0.00032,
  /**
   * Must sit between the camera's near and far planes: the dome is drawn with depth testing off,
   * but the near plane still clips it in the vertex stage, and a radius under `camera.near` leaves
   * nothing on screen but the clear colour.
   */
  skydomeRadius: 5000,
  godRayMaxCount: 14,
  /** T6R-2: five, mounted over the autopilot straights so 2-3 always cross the chase view. */
  searchlightCount: 5,
  /** Searchlight sweep period in seconds; slow enough to read as "creeping". */
  searchlightPeriodS: 23,
  drawCallBudget: SKYRIVER_ATMOSPHERE_DRAW_CALL_BUDGET,
});

/**
 * The palette. Everything is a deep blue-grey lifted just off black: the haze has to read as a
 * substance between the player and the far wall, so it cannot be darker than the concrete it hides.
 * The "high" variants are lighter as well as thinner — that difference is what makes altitude read.
 */
// T6R contrast pass: the haze is a lit volume, brighter than the near-black concrete, so towers and
// their ribs silhouette against it (Neon Rain still); a faint teal/magenta neon cast tints the depths.
const COLOR_FOG_LOW = 0x1a2638;
const COLOR_FOG_HIGH = 0x2a3b52;
/** T6R-2: the depths — what the haze sinks to below the canyon floor band. */
const COLOR_FOG_DEEP = 0x060a11;
const COLOR_SKY_ZENITH = 0x070b14;
const COLOR_SKY_HORIZON = 0x1d2a3d;
const COLOR_SKY_DEPTHS = 0x060a11;
/** Neon the wet overcast throws back down. The one place warmth is allowed into the blue. */
const COLOR_SKY_NEON = 0x4a5f86;
const COLOR_RAIN = 0x8fa6bd;

/** Shared GLSL. city.ts imports these so both modules hash identically and stay cheap. */
export const SKYRIVER_HASH_GLSL = /* glsl */ `
float skyHash11( float n ) {
  return fract( sin( n * 127.1 ) * 43758.5453123 );
}
float skyHash12( vec2 p ) {
  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
}
float skyValueNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  float a = skyHash12( i );
  float b = skyHash12( i + vec2( 1.0, 0.0 ) );
  float c = skyHash12( i + vec2( 0.0, 1.0 ) );
  float d = skyHash12( i + vec2( 1.0, 1.0 ) );
  return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y );
}
`;

/**
 * Output chunks, split into declarations and application. Exported so city.ts and T4's materials end
 * on the same tone map and colour space as three's own shaders: ACES rolls the neon highlights off
 * instead of clipping them to white, and dithering kills the banding a near-black sky otherwise
 * shows on a phone panel.
 *
 * Only dithering needs declaring. For a non-raw ShaderMaterial three's own fragment prefix already
 * injects `tonemapping_pars_fragment` plus the `toneMapping()` function, and
 * `colorspace_pars_fragment` plus `linearToOutputTexel()` (WebGLProgram, "required here because it
 * is used by the ... function defined below"); including those again is a redefinition error.
 * `dithering_pars_fragment` is not in the prefix, is guarded by the DITHERING define, and its
 * `dithering()` calls `rand()` — which lives in `common` — so `common` has to come first.
 */
export const SKYRIVER_OUTPUT_PARS_GLSL = /* glsl */ `
#include <common>
#include <dithering_pars_fragment>
`;

export const SKYRIVER_OUTPUT_APPLY_GLSL = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <dithering_fragment>
`;

// --- shared altitude-graded fog -------------------------------------------------------------------

/**
 * Declarations plus the two shared accessors. `skyriverFogFactor()` is the single density
 * implementation: the opaque mix (city, traffic) and the additive attenuation (signs, beams) both
 * call it, so one curve controls the whole scene.
 */
const FOG_PARS_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  uniform float fogDensity;
  uniform vec3 uSkyFogColorHigh;
  uniform float uSkyFogDensityHigh;
  uniform float uSkyFogFloorY;
  uniform float uSkyFogRangeY;
  uniform vec3 uSkyFogColorDeep;
  varying float vFogDepth;
  varying float vSkyFogHeight;

  float skyriverFogGrade() {
    float h = clamp( ( vSkyFogHeight - uSkyFogFloorY ) / uSkyFogRangeY, 0.0, 1.0 );
    // Squared so the murk stays tight to the depths and the upper canyon opens up quickly.
    return h * h;
  }
  /** 0 above the canyon floor band, 1 deep in the void below it. */
  float skyriverFogDeep() {
    return smoothstep( 180.0, -700.0, vSkyFogHeight );
  }
  float skyriverFogFactor() {
    float density = mix( fogDensity, uSkyFogDensityHigh, skyriverFogGrade() );
    density *= 1.0 + 3.0 * skyriverFogDeep();
    return clamp( 1.0 - exp( - density * vFogDepth ), 0.0, 1.0 );
  }
  vec3 skyriverFogColor() {
    vec3 color = mix( fogColor, uSkyFogColorHigh, skyriverFogGrade() );
    // Neon the haze has scattered: magenta low in the canyon, cyan through the middle band.
    float h = vSkyFogHeight;
    color += vec3( 0.05, 0.0, 0.035 ) * exp( - pow( ( h - 250.0 ) / 260.0, 2.0 ) );
    color += vec3( 0.0, 0.03, 0.04 ) * exp( - pow( ( h - 950.0 ) / 380.0, 2.0 ) );
    return mix( color, uSkyFogColorDeep, skyriverFogDeep() );
  }
#endif
`;

const FOG_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
  gl_FragColor.rgb = mix( gl_FragColor.rgb, skyriverFogColor(), skyriverFogFactor() );
#endif
`;

const FOG_PARS_VERTEX = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  varying float vSkyFogHeight;
#endif
`;

/**
 * Works for object-space materials (built-in or ours) by recomputing world position from
 * `transformed`: `worldpos_vertex` only defines `worldPosition` behind envmap/shadow defines, so it
 * cannot be relied on here. Shaders that build world positions themselves assign the two varyings
 * directly instead of including this chunk.
 */
const FOG_VERTEX = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  #ifdef USE_INSTANCING
    vSkyFogHeight = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).y;
  #else
    vSkyFogHeight = ( modelMatrix * vec4( transformed, 1.0 ) ).y;
  #endif
#endif
`;

let fogChunksInstalled = false;

/** Idempotent. Must run before the first program compiles, so every constructor here calls it. */
export function installSkyriverFogChunks(): void {
  if (fogChunksInstalled) return;
  THREE.ShaderChunk.fog_pars_vertex = FOG_PARS_VERTEX;
  THREE.ShaderChunk.fog_vertex = FOG_VERTEX;
  THREE.ShaderChunk.fog_pars_fragment = FOG_PARS_FRAGMENT;
  THREE.ShaderChunk.fog_fragment = FOG_FRAGMENT;
  fogChunksInstalled = true;
}

/** The extras three does not refresh itself. Shared by reference, so one write updates every material. */
const fogExtraUniforms: Record<string, THREE.IUniform> = {
  uSkyFogColorHigh: { value: new THREE.Color(COLOR_FOG_HIGH) },
  uSkyFogDensityHigh: { value: SKYRIVER_ATMOSPHERE.fogDensityHigh },
  uSkyFogFloorY: { value: SKYRIVER_ATMOSPHERE.fogFloorY },
  uSkyFogRangeY: { value: SKYRIVER_ATMOSPHERE.fogRangeY },
  uSkyFogColorDeep: { value: new THREE.Color(COLOR_FOG_DEEP) },
};

/**
 * Three's own fog uniforms. ShaderMaterial does not get these from the shader library, and
 * `refreshFogUniforms` writes into them unconditionally once `material.fog === true`, so every
 * ShaderMaterial in the scene must carry them or the renderer throws.
 */
function ownFogUniforms(): Record<string, THREE.IUniform> {
  return {
    fogColor: { value: new THREE.Color(COLOR_FOG_LOW) },
    fogDensity: { value: SKYRIVER_ATMOSPHERE.fogDensityLow },
    ...fogExtraUniforms,
  };
}

/**
 * `fog` lives on the concrete material classes, not on the `Material` base, so it is narrowed rather
 * than cast away. A material class without it cannot be fogged and is left alone.
 */
function enableFog(material: THREE.Material): void {
  if ('fog' in material) (material as THREE.Material & { fog: boolean }).fog = true;
}

/** The uniform block a ShaderMaterial must merge in to use the shared fog. */
export function skyriverFogUniforms(): Record<string, THREE.IUniform> {
  return ownFogUniforms();
}

/**
 * Opts a material into the shared fog.
 *
 * ShaderMaterials get the uniforms merged directly. Built-in materials (anything T4 reaches for) get
 * only the extras injected on compile — three refreshes `fogColor` / `fogDensity` from `scene.fog`.
 */
export function applySkyriverFog(material: THREE.Material): void {
  installSkyriverFogChunks();
  enableFog(material);

  if (material instanceof THREE.ShaderMaterial) {
    for (const [name, uniform] of Object.entries(ownFogUniforms())) {
      if (material.uniforms[name] === undefined) material.uniforms[name] = uniform;
    }
    return;
  }

  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    for (const [name, uniform] of Object.entries(fogExtraUniforms)) {
      shader.uniforms[name] = uniform;
    }
  };
}

// --- shared beam pass (god rays and searchlights) --------------------------------------------------

/**
 * Axial billboard: the quad keeps its long axis pinned to the beam direction and spins about that
 * axis to face the camera. That is the right primitive for a light shaft — a cone shell rendered
 * additively reads as a hollow tube, this reads as volume — and it costs one quad per beam.
 */
const BEAM_VERTEX = /* glsl */ `
attribute vec3 aStart;
attribute vec3 aAxis;
attribute vec3 aSize;   // length, width at the source, width at the far end
attribute vec3 aColor;
attribute float aSeed;

varying float vBeamT;
varying float vBeamS;
varying vec3 vBeamColor;
varying float vBeamSeed;

#include <fog_pars_vertex>

void main() {
  float t = position.y + 0.5;
  float s = position.x * 2.0;

  vec3 axis = normalize( aAxis );
  vec3 centre = aStart + axis * ( aSize.x * t );
  vec3 toCam = cameraPosition - centre;
  vec3 right = cross( axis, toCam );
  float len = length( right );
  // Dead-on view down the axis: any perpendicular will do, and the beam is invisible there anyway.
  right = len > 1e-4 ? right / len : normalize( cross( axis, vec3( 0.0, 0.0, 1.0 ) ) );

  float width = mix( aSize.y, aSize.z, t );
  vec3 world = centre + right * ( s * 0.5 * width );

  vBeamT = t;
  vBeamS = s;
  vBeamColor = aColor;
  vBeamSeed = aSeed;

  vec4 mvPosition = viewMatrix * vec4( world, 1.0 );
  #ifdef USE_FOG
    vFogDepth = - mvPosition.z;
    vSkyFogHeight = world.y;
  #endif
  gl_Position = projectionMatrix * mvPosition;
}
`;

const BEAM_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
uniform float uSoftness;
uniform float uFadeStart;

varying float vBeamT;
varying float vBeamS;
varying vec3 vBeamColor;
varying float vBeamSeed;

#include <fog_pars_fragment>
${SKYRIVER_OUTPUT_PARS_GLSL}
${SKYRIVER_HASH_GLSL}

void main() {
  // Gaussian across the shaft keeps the quad edges from ever showing.
  float radial = exp( - vBeamS * vBeamS * uSoftness );
  float along = smoothstep( 0.0, 0.14, vBeamT ) * ( 1.0 - smoothstep( uFadeStart, 1.0, vBeamT ) );
  // Rain drifting through the shaft: slow banding plus a touch of flicker.
  float drift = 0.88 + 0.12 * skyValueNoise( vec2( vBeamT * 7.0, uTime * 0.35 + vBeamSeed * 31.0 ) );
  float flicker = 1.0 + 0.05 * sin( uTime * 1.9 + vBeamSeed * 6.2831853 );

  gl_FragColor = vec4( vBeamColor * ( radial * along * drift * flicker * uIntensity ), 1.0 );

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #ifdef USE_FOG
    // Additive: fade the beam out with distance instead of mixing it toward the haze colour.
    gl_FragColor.rgb *= 1.0 - skyriverFogFactor();
  #endif
}
`;

interface BeamFieldOptions {
  readonly name: string;
  readonly capacity: number;
  readonly intensity: number;
  readonly softness: number;
  readonly fadeStart: number;
}

/**
 * One instanced quad field = one draw call, regardless of beam count. Used twice: static god rays in
 * the canyon gaps, and the creeping searchlights whose axes are rewritten each frame.
 */
class BeamField {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly start: Float32Array;
  private readonly axis: Float32Array;
  private readonly size: Float32Array;
  private readonly color: Float32Array;
  private readonly seed: Float32Array;
  private readonly startAttr: THREE.InstancedBufferAttribute;
  private readonly axisAttr: THREE.InstancedBufferAttribute;
  private readonly sizeAttr: THREE.InstancedBufferAttribute;
  private readonly colorAttr: THREE.InstancedBufferAttribute;
  private readonly seedAttr: THREE.InstancedBufferAttribute;

  constructor(options: BeamFieldOptions) {
    installSkyriverFogChunks();

    const quad = new THREE.PlaneGeometry(1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = quad.index;
    this.geometry.setAttribute('position', quad.getAttribute('position'));
    this.geometry.setAttribute('uv', quad.getAttribute('uv'));
    this.geometry.instanceCount = 0;

    this.start = new Float32Array(options.capacity * 3);
    this.axis = new Float32Array(options.capacity * 3);
    this.size = new Float32Array(options.capacity * 3);
    this.color = new Float32Array(options.capacity * 3);
    this.seed = new Float32Array(options.capacity);

    this.startAttr = new THREE.InstancedBufferAttribute(this.start, 3);
    this.axisAttr = new THREE.InstancedBufferAttribute(this.axis, 3);
    this.sizeAttr = new THREE.InstancedBufferAttribute(this.size, 3);
    this.colorAttr = new THREE.InstancedBufferAttribute(this.color, 3);
    this.seedAttr = new THREE.InstancedBufferAttribute(this.seed, 1);
    this.axisAttr.setUsage(THREE.DynamicDrawUsage);

    this.geometry.setAttribute('aStart', this.startAttr);
    this.geometry.setAttribute('aAxis', this.axisAttr);
    this.geometry.setAttribute('aSize', this.sizeAttr);
    this.geometry.setAttribute('aColor', this.colorAttr);
    this.geometry.setAttribute('aSeed', this.seedAttr);

    this.material = new THREE.ShaderMaterial({
      name: options.name,
      vertexShader: BEAM_VERTEX,
      fragmentShader: BEAM_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: options.intensity },
        uSoftness: { value: options.softness },
        uFadeStart: { value: options.fadeStart },
        ...ownFogUniforms(),
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      fog: true,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = options.name;
    // The quad is rebuilt in world space in the vertex shader, so the object-space bounds three
    // would cull against are meaningless. Culling off also keeps the draw-call count fixed, which is
    // what the A3 smoke test asserts.
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    quad.dispose();
  }

  get count(): number {
    return this.geometry.instanceCount;
  }

  setCount(count: number): void {
    this.geometry.instanceCount = count;
  }

  write(
    index: number,
    start: THREE.Vector3,
    axis: THREE.Vector3,
    length: number,
    widthNear: number,
    widthFar: number,
    color: THREE.Color,
    seed: number,
  ): void {
    const v = index * 3;
    this.start[v] = start.x;
    this.start[v + 1] = start.y;
    this.start[v + 2] = start.z;
    this.axis[v] = axis.x;
    this.axis[v + 1] = axis.y;
    this.axis[v + 2] = axis.z;
    this.size[v] = length;
    this.size[v + 1] = widthNear;
    this.size[v + 2] = widthFar;
    this.color[v] = color.r;
    this.color[v + 1] = color.g;
    this.color[v + 2] = color.b;
    this.seed[index] = seed;
  }

  /** Call once after a batch of `write`s. */
  commit(): void {
    this.startAttr.needsUpdate = true;
    this.axisAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.seedAttr.needsUpdate = true;
  }

  /** Cheap per-frame path: only the axes moved. */
  commitAxes(): void {
    this.axisAttr.needsUpdate = true;
  }

  setTime(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// --- skydome --------------------------------------------------------------------------------------

const SKY_VERTEX = /* glsl */ `
varying vec3 vSkyWorld;
void main() {
  vec4 world = modelMatrix * vec4( position, 1.0 );
  vSkyWorld = world.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uDepths;
uniform vec3 uNeon;
uniform float uTime;

varying vec3 vSkyWorld;

${SKYRIVER_OUTPUT_PARS_GLSL}
${SKYRIVER_HASH_GLSL}

void main() {
  vec3 dir = normalize( vSkyWorld );
  float h = dir.y;

  // Layer 1: the sky itself — near-black overhead, easing into a rain-lit horizon.
  vec3 color = mix( uHorizon, uZenith, pow( clamp( h, 0.0, 1.0 ), 0.42 ) );
  // Layer 2: below the horizon the canyon depths swallow the light. There is no canyon floor, so
  // looking straight down this is all the player sees — it has to read as haze too thick to see
  // through, not as nothing rendered, so it stays a dimmed version of the murk rather than black.
  color = mix( color, uDepths, smoothstep( 0.02, -0.35, h ) );
  // Neon the city throws back into the overcast, concentrated in the horizon band.
  color += uNeon * ( 0.2 * exp( - abs( h ) * 4.2 ) );

  // Rain cloud mottle, two cheap octaves. Without it the gradient bands badly on a phone panel.
  vec2 cloudUv = vec2( atan( dir.z, dir.x ) * 1.6, h * 3.4 );
  float cloud = skyValueNoise( cloudUv * 1.7 + vec2( uTime * 0.004, 0.0 ) ) * 0.66
    + skyValueNoise( cloudUv * 4.1 - vec2( uTime * 0.009, 0.0 ) ) * 0.34;
  color += ( cloud - 0.5 ) * 0.045 * smoothstep( -0.1, 0.5, h );

  gl_FragColor = vec4( max( color, vec3( 0.0 ) ), 1.0 );

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <dithering_fragment>
}
`;

// --- rain streaks ---------------------------------------------------------------------------------

const RAIN_VERTEX = /* glsl */ `
varying vec2 vRainUv;
void main() {
  vRainUv = uv;
  // Screen-space pass with no render target: the quad is emitted straight in clip space.
  gl_Position = vec4( position.xy * 2.0, 0.0, 1.0 );
}
`;

const RAIN_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uAspect;
uniform float uIntensity;
uniform vec3 uColor;

varying vec2 vRainUv;

${SKYRIVER_OUTPUT_PARS_GLSL}
${SKYRIVER_HASH_GLSL}

void main() {
  // One hashed column per streak lane; the slight x shear reads as wind.
  // T6R-2: long, thin, slanted streaks (the review read the T6R rain as specks).
  vec2 p = vec2( ( vRainUv.x + vRainUv.y * 0.11 ) * uAspect * 210.0, vRainUv.y );
  float lane = floor( p.x );
  float laneHash = skyHash11( lane );
  float live = step( 0.7, skyHash11( lane * 1.73 + 3.0 ) );

  float repeats = 2.2 + 2.6 * skyHash11( lane + 7.0 );
  float fall = fract( p.y * repeats - uTime * ( 1.3 + 1.6 * laneHash ) + laneHash * 13.0 );
  float streak = smoothstep( 0.0, 0.02, fall ) * ( 1.0 - smoothstep( 0.02, 0.32, fall ) );

  float across = abs( fract( p.x ) - 0.5 ) * 2.0;
  streak *= 1.0 - smoothstep( 0.05, 0.4, across );

  gl_FragColor = vec4( uColor * ( streak * live * uIntensity ), 1.0 );

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// --- god-ray placement ----------------------------------------------------------------------------

export interface SkyriverGodRayAnchor {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Lateral sign of the canyon wall the gap belongs to. */
  readonly side: -1 | 1;
}

/**
 * Finds the vertical seams in the near wall of each side: the midpoints between neighbouring towers
 * in the column closest to the corridor. Those are the gaps light can actually fall through.
 *
 * Pure and GL-free, so a node check can count them. Derived from the committed layout only — no
 * fresh randomness, so every peer sees the same shafts.
 */
export function deriveGodRayAnchors(layout: SkyriverCityLayout): readonly SkyriverGodRayAnchor[] {
  const anchors: SkyriverGodRayAnchor[] = [];

  for (const side of [-1, 1] as const) {
    const wall = layout.towers
      .filter((tower) => Math.sign(tower.x) === side)
      .sort((a, b) => Math.abs(a.x) - Math.abs(b.x) || a.z - b.z);
    if (wall.length === 0) continue;

    // Inner column only: a seam behind another tower is not a gap the player can see through.
    const innerX = Math.abs(wall[0].x);
    const inner = wall
      .filter((tower) => Math.abs(tower.x) < innerX + layout.cell * 0.5)
      .sort((a, b) => a.z - b.z);

    // Every other seam, so the shafts stay sparse rather than becoming a picket fence.
    for (let i = 0; i + 1 < inner.length; i += 2) {
      const a = inner[i];
      const b = inner[i + 1];
      anchors.push({
        x: side * (Math.abs(a.x) - a.width * 0.5),
        y: Math.min(a.height, b.height),
        z: (a.z + b.z) * 0.5,
        side,
      });
    }
  }

  return anchors.slice(0, SKYRIVER_ATMOSPHERE.godRayMaxCount);
}

// --- atmosphere -----------------------------------------------------------------------------------

export interface SkyriverAtmosphereOptions {
  readonly layout: SkyriverCityLayout;
  readonly quality: SkyriverQualitySettings;
}

export interface SkyriverAtmosphereStats {
  readonly godRays: number;
  readonly searchlights: number;
  readonly rainStreaks: boolean;
  readonly meshes: number;
  readonly drawCalls: number;
  readonly drawCallBudget: number;
}

/**
 * Sky, haze, and the volumetric light passes.
 *
 * `fog` is exposed so the scene can hand it to `THREE.Scene.fog`: the depths colour and density live
 * there and three refreshes them into every fogged material, which is what lets T4's built-in
 * materials share this implementation without importing anything.
 */
export class SkyriverAtmosphere {
  readonly group = new THREE.Group();
  readonly fog: THREE.FogExp2;

  private readonly skyMaterial: THREE.ShaderMaterial;
  private readonly skyMesh: THREE.Mesh;
  private readonly godRays: BeamField;
  private readonly searchlights: BeamField;
  private readonly rainMaterial: THREE.ShaderMaterial;
  private readonly rainMesh: THREE.Mesh;

  private quality: SkyriverQualitySettings;
  private readonly anchors: readonly SkyriverGodRayAnchor[];

  /** Preallocated scratch. The update path must not allocate (plan R7 CPU budget). */
  private readonly scratchStart = new THREE.Vector3();
  private readonly scratchAxis = new THREE.Vector3();
  private readonly scratchColor = new THREE.Color();
  private readonly searchlightOrigins: readonly THREE.Vector3[];

  constructor({ layout, quality }: SkyriverAtmosphereOptions) {
    installSkyriverFogChunks();
    this.quality = quality;
    this.group.name = 'skyriver.atmosphere';
    this.anchors = deriveGodRayAnchors(layout);

    this.fog = new THREE.FogExp2(COLOR_FOG_LOW, SKYRIVER_ATMOSPHERE.fogDensityLow);

    // Skydome. Recentred on the camera every frame, so its radius is a fixed distance from the eye
    // and it can never reach the far plane however far the shuttle flies.
    const skyGeometry = new THREE.SphereGeometry(SKYRIVER_ATMOSPHERE.skydomeRadius, 32, 16);
    this.skyMaterial = new THREE.ShaderMaterial({
      name: 'skyriver.sky',
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      uniforms: {
        uZenith: { value: new THREE.Color(COLOR_SKY_ZENITH) },
        uHorizon: { value: new THREE.Color(COLOR_SKY_HORIZON) },
        uDepths: { value: new THREE.Color(COLOR_SKY_DEPTHS) },
        uNeon: { value: new THREE.Color(COLOR_SKY_NEON) },
        uTime: { value: 0 },
      },
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      dithering: true,
      // The sky is the haze, so it must not be fogged on top of itself.
      fog: false,
    });
    this.skyMesh = new THREE.Mesh(skyGeometry, this.skyMaterial);
    this.skyMesh.name = 'skyriver.sky';
    this.skyMesh.frustumCulled = false;
    this.skyMesh.renderOrder = -1000;
    this.group.add(this.skyMesh);

    this.godRays = new BeamField({
      name: 'skyriver.godrays',
      capacity: SKYRIVER_ATMOSPHERE.godRayMaxCount,
      intensity: 0.17,
      softness: 7.0,
      fadeStart: 0.5,
    });
    this.group.add(this.godRays.mesh);
    this.writeGodRays();

    this.searchlights = new BeamField({
      name: 'skyriver.searchlights',
      capacity: SKYRIVER_ATMOSPHERE.searchlightCount,
      intensity: 0.22,
      softness: 8.0,
      fadeStart: 0.45,
    });
    this.group.add(this.searchlights.mesh);
    this.searchlightOrigins = this.deriveSearchlightOrigins(layout);
    this.writeSearchlights(0);

    const rainGeometry = new THREE.PlaneGeometry(1, 1);
    this.rainMaterial = new THREE.ShaderMaterial({
      name: 'skyriver.rain',
      vertexShader: RAIN_VERTEX,
      fragmentShader: RAIN_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uIntensity: { value: 0.16 },
        uColor: { value: new THREE.Color(COLOR_RAIN) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
    this.rainMesh = new THREE.Mesh(rainGeometry, this.rainMaterial);
    this.rainMesh.name = 'skyriver.rain';
    this.rainMesh.frustumCulled = false;
    this.rainMesh.renderOrder = 1000;
    this.group.add(this.rainMesh);

    this.setQuality(quality);
  }

  setQuality(quality: SkyriverQualitySettings): void {
    this.quality = quality;
    this.godRays.mesh.visible = quality.godRays;
    this.rainMesh.visible = quality.rainStreaks;
  }

  resize(width: number, height: number): void {
    this.rainMaterial.uniforms.uAspect.value = height > 0 ? width / height : 1;
  }

  update(frame: SkyriverFrame): void {
    const { time, camera } = frame;

    // One copy, no allocation: the dome is a unit sphere riding the camera.
    this.skyMesh.position.copy(camera.position);
    this.skyMaterial.uniforms.uTime.value = time;

    if (this.quality.godRays) this.godRays.setTime(time);

    this.searchlights.setTime(time);
    this.writeSearchlights(time);

    if (this.quality.rainStreaks) this.rainMaterial.uniforms.uTime.value = time;
  }

  stats(): SkyriverAtmosphereStats {
    const drawCalls = 1
      + (this.quality.godRays ? 1 : 0)
      + 1
      + (this.quality.rainStreaks ? 1 : 0);
    return {
      godRays: this.godRays.count,
      searchlights: this.searchlights.count,
      rainStreaks: this.quality.rainStreaks,
      meshes: 4,
      drawCalls,
      drawCallBudget: SKYRIVER_ATMOSPHERE_DRAW_CALL_BUDGET,
    };
  }

  dispose(): void {
    this.skyMesh.geometry.dispose();
    this.skyMaterial.dispose();
    this.godRays.dispose();
    this.searchlights.dispose();
    this.rainMesh.geometry.dispose();
    this.rainMaterial.dispose();
  }

  // --- internals ----------------------------------------------------------------------------------

  /** Shafts fall from above the wall into the canyon, angled inwards over the corridor. */
  private writeGodRays(): void {
    for (let i = 0; i < this.anchors.length; i += 1) {
      const anchor = this.anchors[i];
      // Hash the index rather than drawing fresh randomness: placement must stay seed-derived.
      const jitter = hash1(i * 7.13 + 0.37);
      const length = 1500 + jitter * 420;

      this.scratchStart.set(anchor.x, anchor.y + 240, anchor.z);
      this.scratchAxis.set(-anchor.side * (0.16 + jitter * 0.2), -1, (jitter - 0.5) * 0.22).normalize();
      // Cool rain-lit white, drifting a little toward the cyan end of the neon.
      this.scratchColor.setRGB(0.52 + jitter * 0.1, 0.63 + jitter * 0.08, 0.78);

      this.godRays.write(
        i,
        this.scratchStart,
        this.scratchAxis,
        length,
        34 + jitter * 20,
        88 + jitter * 48,
        this.scratchColor,
        jitter,
      );
    }
    this.godRays.setCount(this.anchors.length);
    this.godRays.commit();
  }

  /**
   * T6R-2: mounted on inner-wall roofs at stations along the autopilot straights (|z| <= 1.6 km), so
   * the beams sweep down through the canyon the camera actually flies, not over distant rooftops.
   */
  private deriveSearchlightOrigins(layout: SkyriverCityLayout): readonly THREE.Vector3[] {
    const stations: readonly (readonly [number, number])[] = [[-1, -1300], [1, -650], [-1, 0], [1, 650], [-1, 1300]];
    const origins: THREE.Vector3[] = [];
    for (const [side, z] of stations.slice(0, SKYRIVER_ATMOSPHERE.searchlightCount)) {
      const wall = layout.towers.filter((tower) => Math.sign(tower.x) === side);
      if (wall.length === 0) continue;
      const innerX = Math.min(...wall.map((tower) => Math.abs(tower.x)));
      const inner = wall.filter((tower) => Math.abs(tower.x) < innerX + layout.cell * 0.5);
      const tower = inner.reduce((best, c) => (Math.abs(c.z - z) < Math.abs(best.z - z) ? c : best));
      origins.push(new THREE.Vector3(side * (Math.abs(tower.x) - tower.width * 0.5), tower.height + 14, tower.z));
    }
    // A layout with fewer towers than lights would otherwise silently drop beams.
    while (origins.length < SKYRIVER_ATMOSPHERE.searchlightCount) {
      origins.push(new THREE.Vector3(0, layout.maxHeight, 0));
    }
    return origins;
  }

  /** Slow yaw plus a shallow pitch wobble. Cosmetic per-frame motion, float math, no allocation. */
  private writeSearchlights(time: number): void {
    const period = SKYRIVER_ATMOSPHERE.searchlightPeriodS;

    for (let i = 0; i < this.searchlightOrigins.length; i += 1) {
      const origin = this.searchlightOrigins[i];
      const seed = hash1(i * 3.77 + 1.19);
      const phase = (time / (period * (0.8 + seed * 0.5))) + seed * 6.2831853;
      const yaw = Math.sin(phase) * 0.9;
      const pitch = -0.75 - 0.35 * (0.5 + 0.5 * Math.sin(phase * 0.61 + seed * 4.0));

      const cosPitch = Math.cos(pitch);
      this.scratchAxis
        .set(Math.cos(yaw) * cosPitch * -Math.sign(origin.x || 1), Math.sin(pitch), Math.sin(yaw) * cosPitch)
        .normalize();
      this.scratchStart.copy(origin);
      this.scratchColor.setRGB(0.62 + seed * 0.2, 0.68, 0.74 - seed * 0.22);

      this.searchlights.write(
        i,
        this.scratchStart,
        this.scratchAxis,
        2600 + seed * 500,
        10 + seed * 6,
        150 + seed * 80,
        this.scratchColor,
        seed,
      );
    }
    this.searchlights.setCount(this.searchlightOrigins.length);
    // First write seeds every attribute; later frames only move the axes.
    if (time === 0) this.searchlights.commit();
    else this.searchlights.commitAxes();
  }
}

/** Deterministic scalar hash, the CPU twin of `skyHash11`. Keeps placement off Math.random. */
function hash1(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}
