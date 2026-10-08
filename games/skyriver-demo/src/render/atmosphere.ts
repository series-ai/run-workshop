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
import { CANYON_LOOP_LENGTH_M, warpCanyon, warpDirection, type WarpOut } from './canyonWarp';
import { SKYRIVER_TICK_RATE } from '../sim/systems';
import {
  SKYRIVER_DISTRICT_HAZE_BLEND_M,
  SKYRIVER_DISTRICT_SATURATION,
  deriveSkyriverDistrictModel,
  skyriverDistrictHazeMixAt,
  skyriverDistrictHazeTint,
  skyriverGlslFloat,
  skyriverHazeRefresh,
  type SkyriverDistrictColourSwitch,
  type SkyriverDistrictModel,
} from './districts';
import {
  SKYRIVER_DEPTH_FADE_GLSL,
  SkyriverDepthSnapshot,
} from './depthFade';
import { podiumLotHeight } from './presentationLayout';

/** T7-3: god rays and searchlights are derived in canyon space and bent onto the loop here. */
const atmosphereWarp: WarpOut = { x: 0, z: 0, heading: 0 };
const atmosphereDir = { x: 0, z: 0 };

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
  fogRangeY: 1900,
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
  // R12 height fog: clears quickly above ~1800 m so the pristine tops read clean.
  fogDensityHigh: 0.0001,
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
// T7-5 value range: the haze sits near black so emissives carry the frame (concept p5 ~8).
const COLOR_FOG_LOW = 0x070b11;
const COLOR_FOG_HIGH = 0x06090e;
/** T6R-2: the depths — what the haze sinks to below the canyon floor band. */
/** R17: the depths cooled from brown to a dark steel (the top-down 'brown ring'). */
const COLOR_FOG_DEEP = 0x0c0f15;
/** R17 twilight: navy-indigo zenith, pale steel-blue horizon, a dusk band toward the view. */
const COLOR_SKY_ZENITH = 0x0d1131;
const COLOR_SKY_HORIZON = 0x1e2a3e;
const COLOR_SKY_DUSK = 0x34405a;
const COLOR_SKY_DEPTHS = 0x0b0e14;
/** Neon the wet overcast throws back down. The one place warmth is allowed into the blue. */
const COLOR_SKY_NEON = 0x2c3a52;
const COLOR_RAIN = 0x8fa6bd;

/**
 * R16 ambient III: exposure is traded back down (R14 raised it 1.35 -> 2.2 so emissives carried the
 * mids; the operator still read the base tones as too strong). Every emissive term is raised by the
 * same ratio, so lights keep their level while concrete, haze fill and dark glass fall ~14%.
 */
export const SKYRIVER_EXPOSURE = 1.9;
export const SKYRIVER_EMISSIVE_GAIN = 2.2 / SKYRIVER_EXPOSURE;

export const SKYRIVER_FOG_MIDBAND = Object.freeze({
  center: 950,
  legacySpread: 380,
  broadSpread: 560,
  gateStart: 400,
  gateEnd: 700,
});
export const SKYRIVER_FOG_DITHER_LEVELS = 255;
/**
 * The weight the R20 fog shader gives the shared region tint:
 * `color * mix(vec3(1), uSkyFogRegionTint, SKYRIVER_FOG_REGION_TINT_WEIGHT * uSkyFogMurkAllowed)`.
 *
 * The fog GLSL interpolates this constant and `SkyriverAtmosphere.hazeEvidence` reads the same one,
 * so the evidence cannot keep reporting a weight the shader no longer applies.
 */
export const SKYRIVER_FOG_REGION_TINT_WEIGHT = 0.12;

function fogSmoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function skyriverFogMidbandResponse(height: number, murkAllowed = true): number {
  const oldOffset = (height - SKYRIVER_FOG_MIDBAND.center) / SKYRIVER_FOG_MIDBAND.legacySpread;
  const broadOffset = (height - SKYRIVER_FOG_MIDBAND.center) / SKYRIVER_FOG_MIDBAND.broadSpread;
  const oldResponse = Math.exp(-oldOffset * oldOffset);
  const broadCandidate = Math.exp(-broadOffset * broadOffset);
  const broadResponse = oldResponse + Math.max(0, broadCandidate - oldResponse)
    * fogSmoothstep(SKYRIVER_FOG_MIDBAND.gateStart, SKYRIVER_FOG_MIDBAND.gateEnd, height);
  return murkAllowed ? broadResponse : oldResponse;
}

export function skyriverFogDither(
  samples: readonly [number, number, number],
  fogFactor: number,
  deepFactor = 0,
): number {
  return ((2 * samples[0] - samples[1] - samples[2]) / 4)
    * Math.min(1, Math.max(0, fogFactor))
    * (1 - Math.min(1, Math.max(0, deepFactor)))
    / SKYRIVER_FOG_DITHER_LEVELS;
}

/** Region systems can set a shared haze tint without changing the fog material contract. */
export function setSkyriverFogRegionTint(tint: THREE.Color): void {
  (fogExtraUniforms.uSkyFogRegionTint!.value as THREE.Color).copy(tint);
}

export function setSkyriverFogMurkAllowed(allowed: boolean): void {
  fogExtraUniforms.uSkyFogMurkAllowed!.value = allowed ? 1 : 0;
}

/**
 * R16 rain motion. Stylised: the fall is fast against the share of the craft's speed taken off it,
 * so the streaks fall down the frame with a slight spread toward the camera, not as warp lines.
 */
const RAIN_FALL_MPS = 55;
const RAIN_WIND_X_MPS = 6;
const RAIN_CRAFT_SHARE = 0.12;
/** Bounds on the rain's source point, in half screen heights from the centre. */
const RAIN_FOE_MIN = 2.2;
const RAIN_FOE_MAX = 60;
/** A camera jump larger than this in one frame is a cut, not motion. */
const RAIN_TELEPORT_M = 200;

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
  uniform float uSkyFogMurkAllowed;
  uniform vec3 uSkyFogRegionTint;
  varying float vFogDepth;
  varying float vSkyFogHeight;

  float skyriverFogGrade() {
    float h = clamp( ( vSkyFogHeight - uSkyFogFloorY ) / uSkyFogRangeY, 0.0, 1.0 );
    // R12: smoothstep — thick through the low city, clearing fast toward the pristine heights.
    return h * h * ( 3.0 - 2.0 * h );
  }
  /** 0 above the canyon floor band, 1 deep in the void below it. */
  float skyriverFogDeep() {
    return smoothstep( 0.0, -900.0, vSkyFogHeight );
  }
  float skyriverFogFactor() {
    float density = mix( fogDensity, uSkyFogDensityHigh, skyriverFogGrade() );
    // T7-3: the depths are *thinner* haze, not thicker (cycle-4: black void) — so the grime's lit
    // rooms carry down into them as a field of distant warm lights.
    density *= 1.0 - 0.45 * skyriverFogDeep();
    // R12: a thick warm smog layer over the grime and the deck.
    density *= 1.0 + 0.45 * ( 1.0 - smoothstep( 120.0, 600.0, vSkyFogHeight ) ) * ( 1.0 - skyriverFogDeep() );
    return clamp( 1.0 - exp( - density * vFogDepth ), 0.0, 1.0 );
  }
  vec3 skyriverFogColor() {
    vec3 color = mix( fogColor, uSkyFogColorHigh, skyriverFogGrade() );
    // Neon the haze has scattered: magenta low in the canyon, cyan through the middle band.
    float h = vSkyFogHeight;
    // Squares, not pow(): GLSL pow() is undefined for a negative base, and one NaN pixel blacks out
    // the whole frame once the bloom blur spreads it (found in T7).
    float lowBand = ( h - 250.0 ) / 260.0;
    float oldMidBand = ( h - ${SKYRIVER_FOG_MIDBAND.center.toFixed(1)} ) / ${SKYRIVER_FOG_MIDBAND.legacySpread.toFixed(1)};
    float broadMidBand = ( h - ${SKYRIVER_FOG_MIDBAND.center.toFixed(1)} ) / ${SKYRIVER_FOG_MIDBAND.broadSpread.toFixed(1)};
    // R16 ambient III: the scattered-light terms of the haze are the ambient the operator still read
    // in the low half of the lap (fog colour ~0.03-0.055 linear lands at 48-68/255 after ACES + sRGB,
    // and every distant pixel is fogged). Low-band colours cut to a quarter, mid and high to ~60%;
    // density untouched.
    color += vec3( 0.01, 0.0, 0.0075 ) * exp( - lowBand * lowBand );
    float oldMidResponse = exp( - oldMidBand * oldMidBand );
    float broadCandidate = exp( - broadMidBand * broadMidBand );
    float broadMidResponse = oldMidResponse + max( broadCandidate - oldMidResponse, 0.0 )
      * smoothstep( ${SKYRIVER_FOG_MIDBAND.gateStart.toFixed(1)}, ${SKYRIVER_FOG_MIDBAND.gateEnd.toFixed(1)}, h );
    color += vec3( 0.0, 0.018, 0.024 ) * mix( oldMidResponse, broadMidResponse, uSkyFogMurkAllowed );
    // T7-3 strata: warm smog over the grime, cool clean air in the pristine heights.
    float grimeAir = 1.0 - smoothstep( 300.0, 800.0, h );
    // R17: the grime smog is a near-neutral grey at the old smog's luminance; warmth stays in the lit
    // rooms, not the air.
    color = mix( color, vec3( 0.0062, 0.0055, 0.0053 ), grimeAir * 0.55 );
    color = mix( color, vec3( 0.014, 0.02, 0.03 ), smoothstep( 1800.0, 2700.0, h ) * 0.45 );
    // R12: the service deck's light scattering up into the low haze — a warm glow just above it.
    // R17: the deck's scattered light is a neutral grey, not orange: down the canyon it was the amber
    // 'distance' the operator read (same luminance, no hue).
    color += vec3( 0.0083, 0.0079, 0.0086 ) * exp( - max( h - 40.0, 0.0 ) / 220.0 ) * ( 1.0 - skyriverFogDeep() * 0.6 );
    color = mix( color, uSkyFogColorDeep, skyriverFogDeep() );
    return color * mix( vec3( 1.0 ), uSkyFogRegionTint, ${skyriverGlslFloat(SKYRIVER_FOG_REGION_TINT_WEIGHT)} * uSkyFogMurkAllowed );
  }
  float skyriverFogInterleavedGradient( vec2 pixel ) {
    return fract( 52.9829189 * fract( dot( pixel, vec2( 0.06711056, 0.00583715 ) ) ) );
  }
  // A three-tap high-pass removes the constant term and concentrates dither energy at pixel scale.
  float skyriverFogDither( vec2 pixel ) {
    float centre = skyriverFogInterleavedGradient( pixel );
    float right = skyriverFogInterleavedGradient( pixel + vec2( 1.0, 0.0 ) );
    float up = skyriverFogInterleavedGradient( pixel + vec2( 0.0, 1.0 ) );
    return ( 2.0 * centre - right - up ) * 0.25;
  }
#endif
`;

const FOG_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
  float fogFactor = skyriverFogFactor();
  gl_FragColor.rgb = mix( gl_FragColor.rgb, skyriverFogColor(), fogFactor );
  float dither = skyriverFogDither( floor( gl_FragCoord.xy ) );
  float ditherGate = 1.0 - skyriverFogDeep();
  gl_FragColor.rgb += vec3( dither * fogFactor * ditherGate * uSkyFogMurkAllowed / ${SKYRIVER_FOG_DITHER_LEVELS.toFixed(1)} );
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

/** The installed fog chunk, so a node check can assert the one tint weight it carries. */
export const SKYRIVER_FOG_PARS_FRAGMENT_SOURCE = FOG_PARS_FRAGMENT;

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
  uSkyFogRegionTint: { value: new THREE.Color(1, 1, 1) },
  uSkyFogMurkAllowed: { value: 1 },
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
attribute vec3 aParams; // R18: intensity, softness, fade start (per beam; god rays and searchlights share one draw)

varying float vBeamT;
varying float vBeamS;
varying vec3 vBeamColor;
varying float vBeamSeed;
varying vec3 vBeamParams;

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
  vBeamParams = aParams;

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

varying float vBeamT;
varying float vBeamS;
varying vec3 vBeamColor;
varying float vBeamSeed;
varying vec3 vBeamParams;

#include <fog_pars_fragment>
${SKYRIVER_DEPTH_FADE_GLSL}
${SKYRIVER_OUTPUT_PARS_GLSL}
${SKYRIVER_HASH_GLSL}

void main() {
  // Gaussian across the shaft keeps the quad edges from ever showing.
  float radial = exp( - vBeamS * vBeamS * vBeamParams.y );
  float along = smoothstep( 0.0, 0.14, vBeamT ) * ( 1.0 - smoothstep( vBeamParams.z, 1.0, vBeamT ) );
  // Rain drifting through the shaft: slow banding plus a touch of flicker.
  float drift = 0.88 + 0.12 * skyValueNoise( vec2( vBeamT * 7.0, uTime * 0.35 + vBeamSeed * 31.0 ) );
  float flicker = 1.0 + 0.05 * sin( uTime * 1.9 + vBeamSeed * 6.2831853 );

  float nearFade = smoothstep( 60.0, 420.0, vFogDepth );
  gl_FragColor = vec4( vBeamColor * ( radial * along * drift * flicker * vBeamParams.x * nearFade ), 1.0 );

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #ifdef USE_FOG
    // Additive: fade the beam out with distance instead of mixing it toward the haze colour.
    gl_FragColor.rgb *= 1.0 - skyriverFogFactor();
  #endif
  gl_FragColor.rgb *= skyriverVisibilityFade();
}
`;

interface BeamFieldOptions {
  readonly name: string;
  readonly capacity: number;
  readonly depthFade: SkyriverDepthSnapshot;
}

/** Per-beam look: brightness, Gaussian softness across the shaft, where it starts to fade along it. */
interface BeamLook {
  readonly intensity: number;
  readonly softness: number;
  readonly fadeStart: number;
}
/** T7-2/T7-3: searchlights soft and weak (they dominated the frame); god rays brighter, wider. */
const SEARCHLIGHT_LOOK: BeamLook = { intensity: 0.025, softness: 8.0, fadeStart: 0.45 };
const GOD_RAY_LOOK: BeamLook = { intensity: 0.17, softness: 7.0, fadeStart: 0.5 };

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
  private readonly params: Float32Array;
  private readonly paramsAttr: THREE.InstancedBufferAttribute;
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
    this.params = new Float32Array(options.capacity * 3);
    this.paramsAttr = new THREE.InstancedBufferAttribute(this.params, 3);

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
    this.geometry.setAttribute('aParams', this.paramsAttr);

    this.material = new THREE.ShaderMaterial({
      name: options.name,
      vertexShader: BEAM_VERTEX,
      fragmentShader: BEAM_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        ...options.depthFade.uniforms,
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
    this.mesh.onBeforeRender = (renderer) => options.depthFade.capture(renderer);
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
    look: BeamLook,
  ): void {
    const v = index * 3;
    this.params[v] = look.intensity;
    this.params[v + 1] = look.softness;
    this.params[v + 2] = look.fadeStart;
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
    this.paramsAttr.needsUpdate = true;
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
uniform vec3 uDusk;
uniform vec2 uForward;

varying vec3 vSkyWorld;

${SKYRIVER_OUTPUT_PARS_GLSL}
${SKYRIVER_HASH_GLSL}

void main() {
  vec3 dir = normalize( vSkyWorld );
  float h = dir.y;

  // Layer 1: the sky itself. R17 twilight (operator: "evening, not void"): deep navy-indigo
  // overhead, easing to a pale steel-blue horizon, plus a dusk band on the horizon that brightens
  // toward the way the camera looks (the vanishing point). A rarefied lift at the top of the frame,
  // not ambient light: nothing else reads the sky colour.
  vec3 color = mix( uHorizon, uZenith, pow( clamp( h, 0.0, 1.0 ), 0.55 ) );
  float duskBand = exp( - max( h, 0.0 ) * 9.0 ) * smoothstep( -0.06, 0.02, h );
  vec2 flatDir = dir.xz / max( length( dir.xz ), 1e-4 );
  float toward = pow( max( dot( flatDir, uForward ), 0.0 ), 3.0 );
  color += uDusk * duskBand * ( 0.35 + 0.65 * toward );
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
uniform float uFall;
uniform float uAspect;
uniform float uIntensity;
uniform vec3 uColor;
uniform vec2 uFoe;
uniform float uFlow;
// R16: the boost speed lines share this screen pass (they were their own call), so a boost no
// longer costs a draw call; uRainOn is 0 on the tiers without rain.
uniform float uRainOn;
uniform float uTime;
uniform float uBoost;

varying vec2 vRainUv;


${SKYRIVER_OUTPUT_PARS_GLSL}
${SKYRIVER_HASH_GLSL}

vec3 speedLines() {
  // Radial streaks rushing out from just above the vanishing point; brighter toward the edges.
  vec2 p = ( vRainUv - vec2( 0.5, 0.62 ) ) * vec2( uAspect, 1.0 );
  float r = length( p );
  float angle = atan( p.y, p.x );
  float lane = floor( ( angle + 3.14159265 ) / 6.2831853 * 240.0 );
  float live = step( 0.72, skyHash11( lane * 3.7 + 1.0 ) );
  float rush = fract( r * ( 1.6 + skyHash11( lane ) * 1.4 ) - uTime * ( 2.4 + 2.0 * skyHash11( lane + 9.0 ) ) );
  float streak = smoothstep( 0.0, 0.05, rush ) * ( 1.0 - smoothstep( 0.05, 0.4, rush ) );
  float across = abs( fract( ( angle + 3.14159265 ) / 6.2831853 * 240.0 ) - 0.5 ) * 2.0;
  streak *= 1.0 - smoothstep( 0.1, 0.6, across );
  float vignette = smoothstep( 0.18, 0.75, r );
  return vec3( 0.75, 0.85, 1.0 ) * ( streak * live * vignette * uBoost * 0.55 );
}

void main() {
  // R16: world-consistent rain. Streaks fall along lines from uFoe, the screen point the rain comes
  // from (world down plus a little of the craft's own motion, projected through the camera, so it
  // turns with the camera's roll), and move away from it (uFlow +1) or toward it (-1). Before R16
  // the streaks ran up the screen at a fixed screen angle: on a bank the rain flew upward.
  // Coordinates: screen-centred, isotropic, y from -1 (bottom) to 1 (top).
  vec2 q = ( vRainUv - 0.5 ) * 2.0 * vec2( uAspect, 1.0 );
  vec2 rel = q - uFoe;
  float r = length( rel );
  float foeDist = length( uFoe );
  vec2 base = - uFoe / foeDist;
  float angle = atan( base.x * rel.y - base.y * rel.x, dot( base, rel ) );
  // One hashed lane per ~1/105 of the screen height at the centre.
  float laneCoord = angle * foeDist * 105.0;
  float lane = floor( laneCoord );
  float laneHash = skyHash11( lane );
  float live = step( 0.7, skyHash11( lane * 1.73 + 3.0 ) );

  float repeats = 1.1 + 1.3 * skyHash11( lane + 7.0 );
  float fall = fract( r * repeats - uFall * uFlow * ( 1.3 + 1.6 * laneHash ) + laneHash * 13.0 );
  // Bright head on the leading edge, tail behind it.
  float lead = uFlow > 0.0 ? fall : 1.0 - fall;
  float streak = smoothstep( 0.68, 0.98, lead ) * ( 1.0 - smoothstep( 0.98, 1.0, lead ) );
  float p = laneCoord;

  float across = abs( fract( p ) - 0.5 ) * 2.0;
  streak *= 1.0 - smoothstep( 0.05, 0.4, across );

  vec3 color = uColor * ( streak * live * uIntensity * uRainOn );
  if ( uBoost > 0.001 ) color += speedLines();
  gl_FragColor = vec4( color, 1.0 );

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

  // Spread evenly around the whole loop rather than taking the first few seams.
  const stride = Math.max(1, Math.floor(anchors.length / SKYRIVER_ATMOSPHERE.godRayMaxCount));
  return anchors.filter((_, i) => i % stride === 0).slice(0, SKYRIVER_ATMOSPHERE.godRayMaxCount);
}

// --- atmosphere -----------------------------------------------------------------------------------

export interface SkyriverAtmosphereOptions {
  readonly layout: SkyriverCityLayout;
  readonly quality: SkyriverQualitySettings;
  readonly depthFade: SkyriverDepthSnapshot;
  /** The scene's one R22 colour-switch flag. The atmosphere reads it and never writes it. */
  readonly colourSwitch: SkyriverDistrictColourSwitch;
}

export interface SkyriverAtmosphereStats {
  readonly godRays: number;
  readonly searchlights: number;
  readonly rainStreaks: boolean;
  readonly meshes: number;
  readonly drawCalls: number;
  readonly drawCallBudget: number;
}

/** The actual bound haze tint and its refresh history, in both colour-switch states. */
export interface SkyriverDistrictHazeEvidence {
  readonly api: string;
  readonly districtAllowed: boolean;
  readonly boundTint: readonly [number, number, number];
  readonly tintSaturation: number;
  readonly shaderWeight: number;
  readonly effectiveSaturation: number;
  /**
   * The per-channel factor the fog colour is actually multiplied by, min and max over the three
   * channels: `1 + shaderWeight * (boundTint - 1)` with the murk on, and exactly 1 with it off.
   * Y(fogColor x factor) lies between these two numbers for every fog colour, which is the honest
   * bound on what the tint does to the haze brightness.
   */
  readonly channelFactorRange: readonly [number, number];
  /** max(|factor - 1|) over the three channels: how far from neutral the multiplication goes. */
  readonly maxChannelDeviation: number;
  readonly murkAllowed: boolean;
  readonly blendWidthM: number;
  readonly tickRate: number;
  readonly refreshHz: number;
  readonly bucket: number;
  readonly lastTick: number;
  readonly routeV: number;
  readonly districtId: number;
  readonly neighbourId: number;
  readonly neighbourWeight: number;
  readonly boundaryDistanceM: number;
  readonly legacyRegion: number;
  readonly updates: readonly {
    readonly reason: string;
    readonly tick: number;
    readonly bucket: number;
    readonly routeV: number;
    readonly districtId: number;
    readonly neighbourId: number;
    readonly neighbourWeight: number;
    readonly boundaryDistanceM: number;
    readonly tint: readonly [number, number, number];
    readonly atMs: number;
  }[];
  readonly resets: readonly { readonly reason: string; readonly tick: number; readonly atMs: number }[];
  readonly limits: readonly string[];
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
  private readonly beams: BeamField;
  private readonly rainMaterial: THREE.ShaderMaterial;
  private readonly rainMesh: THREE.Mesh;

  private quality: SkyriverQualitySettings;
  private readonly anchors: readonly SkyriverGodRayAnchor[];

  /** R16 rain state: the camera's last position and smoothed world velocity. */
  private readonly rainCamera = new THREE.Vector3();
  private readonly rainVelocity = new THREE.Vector3();
  private readonly rainScratch = new THREE.Vector3();
  private readonly rainQuaternion = new THREE.Quaternion();

  /** Preallocated scratch. The update path must not allocate (plan R7 CPU budget). */
  private readonly scratchStart = new THREE.Vector3();
  private readonly scratchAxis = new THREE.Vector3();
  private readonly scratchColor = new THREE.Color();
  private readonly searchlightOrigins: readonly THREE.Vector3[];
  private readonly fogRegionTint = new THREE.Color(1, 1, 1);
  private fogTintRegion = Number.NaN;
  private fogTintElapsed = 0;

  /**
   * R22 district haze. The shared R20 tint API is now driven by the canyon district query instead of
   * a 5000 m world-Z region, refreshed at most once a second on a tick bucket (not on elapsed wall
   * time, which a frozen frame never advances). A colour switch, a time reversal, a replay seek or a
   * scene reset invalidates the bucket, so a tint sampled at a later tick can never survive a
   * rollback and the next update re-samples at the tick actually being drawn.
   */
  private readonly districts: SkyriverDistrictModel;
  /** R22: the scene's colour flag, held once (see SkyriverDistrictColourSwitch). Read-only here. */
  private readonly colourSwitch: SkyriverDistrictColourSwitch;
  private hazeBucket = Number.NaN;
  private hazeTick = Number.NaN;
  private hazeRouteV = 0;
  private hazeWorldZ = 0;
  private readonly hazeUpdates: {
    readonly reason: string;
    readonly tick: number;
    readonly bucket: number;
    readonly routeV: number;
    readonly districtId: number;
    readonly neighbourId: number;
    readonly neighbourWeight: number;
    readonly boundaryDistanceM: number;
    readonly tint: readonly [number, number, number];
    readonly atMs: number;
  }[] = [];
  private readonly hazeResets: {
    readonly reason: string;
    readonly tick: number;
    readonly atMs: number;
  }[] = [];

  constructor({ layout, quality, depthFade, colourSwitch }: SkyriverAtmosphereOptions) {
    installSkyriverFogChunks();
    this.quality = quality;
    this.group.name = 'skyriver.atmosphere';
    this.anchors = deriveGodRayAnchors(layout);
    this.districts = deriveSkyriverDistrictModel(layout.seed);
    this.colourSwitch = colourSwitch;
    // The first update writes the tint for whichever state the switch starts in, so only a change
    // needs applying here.
    colourSwitch.onChange((allowed) => this.applyDistrictColour(allowed));

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
        uDusk: { value: new THREE.Color(COLOR_SKY_DUSK) },
        uForward: { value: new THREE.Vector2(0, 1) },
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

    // R18: searchlights and god rays share one beam field (one draw call; the call went to the GPU
    // impostor traffic). Searchlights fill slots [0, S), god rays [S, S + G), so the tiers without
    // god rays just draw the first S instances.
    this.beams = new BeamField({
      name: 'skyriver.beams',
      capacity: SKYRIVER_ATMOSPHERE.searchlightCount + SKYRIVER_ATMOSPHERE.godRayMaxCount,
      depthFade,
    });
    this.group.add(this.beams.mesh);
    this.searchlightOrigins = this.deriveSearchlightOrigins(layout);
    this.writeGodRays();
    this.writeSearchlights(0);

    const rainGeometry = new THREE.PlaneGeometry(1, 1);
    this.rainMaterial = new THREE.ShaderMaterial({
      name: 'skyriver.rain',
      vertexShader: RAIN_VERTEX,
      fragmentShader: RAIN_FRAGMENT,
      uniforms: {
        uFall: { value: 0 },
        uAspect: { value: 1 },
        // T7-5: rain at half strength — it was lifting the blacks.
        uIntensity: { value: 0.05 },
        uColor: { value: new THREE.Color(COLOR_RAIN) },
        uFoe: { value: new THREE.Vector2(0, RAIN_FOE_MIN) },
        uFlow: { value: 1 },
        uRainOn: { value: 1 },
        uTime: { value: 0 },
        uBoost: { value: 0 },
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
    this.updateBeamCount();
    this.rainMaterial.uniforms.uRainOn.value = quality.rainStreaks ? 1 : 0;
    this.updateScreenPass();
  }

  setMurkAllowed(allowed: boolean): void {
    setSkyriverFogMurkAllowed(allowed);
  }

  /** The widened-haze state actually bound in the shared fog uniforms. */
  murkAllowed(): boolean {
    return (fogExtraUniforms.uSkyFogMurkAllowed!.value as number) > 0.5;
  }

  /** Searchlights always; god rays only on the tiers that have them (they sit after the lights). */
  private updateBeamCount(): void {
    this.beams.setCount(this.searchlightOrigins.length + (this.quality.godRays ? this.anchors.length : 0));
  }

  /** The rain / speed-line screen pass draws when either is live. */
  private updateScreenPass(): void {
    this.rainMesh.visible = this.quality.rainStreaks || this.rainMaterial.uniforms.uBoost.value > 0.02;
  }

  resize(width: number, height: number): void {
    this.rainMaterial.uniforms.uAspect.value = height > 0 ? width / height : 1;
  }

  update(frame: SkyriverFrame): void {
    const { time, camera } = frame;
    this.hazeRouteV = frame.routeV;
    this.hazeWorldZ = camera.position.z;
    // ARCH-4: the tick is current on both paths, so a 'switch' update entry, its bucket and the
    // reset log can never record a tick from before a stretch with the districts off.
    const previousTick = this.hazeTick;
    this.hazeTick = frame.tick;
    if (this.colourSwitch.allowed) this.updateDistrictHazeTint(frame, previousTick);
    else this.updateFogRegionTint(frame.dt, camera.position.z);

    // One copy, no allocation: the dome is a unit sphere riding the camera.
    this.skyMesh.position.copy(camera.position);
    this.skyMaterial.uniforms.uTime.value = time;
    // The dusk band leans toward the camera's horizontal view direction.
    camera.getWorldDirection(this.rainScratch);
    const fx = this.rainScratch.x;
    const fz = this.rainScratch.z;
    const fl = Math.hypot(fx, fz);
    if (fl > 1e-4) (this.skyMaterial.uniforms.uForward.value as THREE.Vector2).set(fx / fl, fz / fl);

    this.beams.setTime(time);
    this.writeSearchlights(time);

    if (this.quality.rainStreaks) this.updateRain(frame);
    this.rainMaterial.uniforms.uTime.value = time;
  }

  private updateFogRegionTint(dt: number, worldZ: number): void {
    const region = Math.floor(worldZ / 5000);
    if (!Number.isFinite(this.fogTintRegion)) {
      this.applyFogRegionTint(region);
      return;
    }
    this.fogTintElapsed += dt;
    if (this.fogTintElapsed < 1) return;
    this.fogTintElapsed = 0;
    if (region === this.fogTintRegion) return;
    this.applyFogRegionTint(region);
  }

  /**
   * R22 colour A/B, haze side. Synchronous: it discards the refresh bucket and writes the shared
   * tint for the state requested, so the next `scene.update` at the same tick and the same alpha
   * draws with the new haze instead of waiting for a timer the frozen frame never advances.
   *
   * Registered on the scene's `SkyriverDistrictColourSwitch`: the atmosphere never decides the
   * state, so the haze and the city can never be in two different colour states.
   */
  private applyDistrictColour(allowed: boolean): void {
    this.resetDistrictHazeTint(allowed ? 'district-haze-on' : 'district-haze-off');
    if (allowed) this.applyDistrictHazeTint(this.hazeRouteV, this.hazeTick, 'switch');
    else this.applyFogRegionTint(Math.floor(this.hazeWorldZ / 5000));
  }

  /** Drops the refresh bucket. Called on a colour switch, a time reversal and a scene reset. */
  resetDistrictHazeTint(reason: string): void {
    this.hazeBucket = Number.NaN;
    this.fogTintRegion = Number.NaN;
    this.fogTintElapsed = 0;
    this.hazeResets.push({
      reason,
      tick: Number.isFinite(this.hazeTick) ? this.hazeTick : -1,
      atMs: typeof performance === 'undefined' ? 0 : performance.now(),
    });
    if (this.hazeResets.length > 16) this.hazeResets.shift();
  }

  /** `previousTick` is the tick the held tint was sampled at; `update` has already advanced it. */
  private updateDistrictHazeTint(frame: SkyriverFrame, previousTick: number): void {
    const decision = skyriverHazeRefresh(
      { bucket: this.hazeBucket, tick: previousTick },
      frame.tick,
      SKYRIVER_TICK_RATE,
    );
    // A tick that moved backwards is a rollback or a replay seek: the tint in the uniform was
    // sampled at a later tick, so it is discarded rather than carried over.
    if (decision.reset) this.resetDistrictHazeTint('time-reversal');
    if (!decision.refresh) return;
    this.applyDistrictHazeTint(frame.routeV, frame.tick, decision.reset ? 'time-reversal' : 'bucket');
  }

  private applyDistrictHazeTint(routeV: number, tick: number, reason: string): void {
    const bucket = Number.isFinite(tick) ? Math.floor(tick / SKYRIVER_TICK_RATE) : Number.NaN;
    this.hazeBucket = bucket;
    const blend = skyriverDistrictHazeMixAt(this.districts, routeV);
    const tint = skyriverDistrictHazeTint(this.districts, routeV);
    this.fogRegionTint.setRGB(tint[0], tint[1], tint[2]);
    setSkyriverFogRegionTint(this.fogRegionTint);
    this.hazeUpdates.push({
      reason,
      tick: Number.isFinite(tick) ? tick : -1,
      bucket,
      routeV,
      districtId: blend.districtId,
      neighbourId: blend.neighbourId,
      neighbourWeight: blend.neighbourWeight,
      boundaryDistanceM: blend.boundaryDistanceM,
      tint: [tint[0], tint[1], tint[2]],
      atMs: typeof performance === 'undefined' ? 0 : performance.now(),
    });
    if (this.hazeUpdates.length > 16) this.hazeUpdates.shift();
  }

  /** The actual bound tint, its refresh bucket, its update log and its reset log, in both states. */
  hazeEvidence(): SkyriverDistrictHazeEvidence {
    const bound = fogExtraUniforms.uSkyFogRegionTint!.value as THREE.Color;
    const murkAllowed = (fogExtraUniforms.uSkyFogMurkAllowed!.value as number) > 0.5;
    const latest = this.hazeUpdates[this.hazeUpdates.length - 1];
    // What the shader actually multiplies the fog colour by, read from the bound tint and the one
    // shader weight — not from the tint alone, and not from a hand-copied number.
    const weight = murkAllowed ? SKYRIVER_FOG_REGION_TINT_WEIGHT : 0;
    const factors = [bound.r, bound.g, bound.b].map((channel) => 1 + weight * (channel - 1));
    return {
      api: 'setSkyriverFogRegionTint (the shared R20 tint API; fogColor, density and the height terms are unchanged)',
      districtAllowed: this.colourSwitch.allowed,
      boundTint: [bound.r, bound.g, bound.b],
      tintSaturation: SKYRIVER_DISTRICT_SATURATION.haze,
      shaderWeight: SKYRIVER_FOG_REGION_TINT_WEIGHT,
      effectiveSaturation: SKYRIVER_FOG_REGION_TINT_WEIGHT * SKYRIVER_DISTRICT_SATURATION.haze,
      channelFactorRange: [Math.min(...factors), Math.max(...factors)],
      maxChannelDeviation: Math.max(...factors.map((factor) => Math.abs(factor - 1))),
      murkAllowed,
      blendWidthM: SKYRIVER_DISTRICT_HAZE_BLEND_M,
      tickRate: SKYRIVER_TICK_RATE,
      refreshHz: 1,
      bucket: this.hazeBucket,
      lastTick: this.hazeTick,
      routeV: this.hazeRouteV,
      districtId: latest?.districtId ?? -1,
      neighbourId: latest?.neighbourId ?? -1,
      neighbourWeight: latest?.neighbourWeight ?? 0,
      boundaryDistanceM: latest?.boundaryDistanceM ?? -1,
      legacyRegion: this.fogTintRegion,
      updates: [...this.hazeUpdates],
      resets: [...this.hazeResets],
      limits: Object.freeze([
        'The R20 fog shader applies this tint as color * mix(vec3(1), uSkyFogRegionTint, SKYRIVER_FOG_REGION_TINT_WEIGHT * uSkyFogMurkAllowed), and shaderWeight here is that same constant. With ?murk=0 the tint is off, which is the existing R20 contract, not an R22 change.',
        'The tint is a per-channel multiplication of the finished fog colour, not a replacement of it, and not a luminance-preserving recolour. Y(tint) is 1, but that does NOT make Y(fogColor x tint) equal Y(fogColor): the two are equal only where the fog colour is neutral, and the skyriver fog colour is not. The honest statement is the bound: Y(fogColor x factor) / Y(fogColor) lies inside channelFactorRange for every fog colour, so maxChannelDeviation is the most the haze brightness can move at the worst district hue. Density and the height colour terms are untouched, and the tint is applied after them.',
        'The colour-off path writes the R20 world-Z region tint for the current camera region at once instead of waiting out its 1 s timer. The value is the same function of the region, so the only difference from a pre-R22 build is refresh latency, not the tint itself.',
      ]),
    };
  }

  private applyFogRegionTint(region: number): void {
    this.fogTintRegion = region;
    const seed = region * 17.17 + 3.71;
    this.fogRegionTint.setRGB(
      1 + (hash1(seed) - 0.5) * 0.02,
      1 + (hash1(seed + 11.3) - 0.5) * 0.02,
      1 + (hash1(seed + 29.7) - 0.5) * 0.02,
    );
    setSkyriverFogRegionTint(this.fogRegionTint);
  }

  /**
   * R16: the rain's apparent motion relative to the camera. The camera's world velocity is smoothed
   * from its own motion; a share of it is taken off the rain's fall, and the direction the rain comes
   * from is projected into view space. That screen point (uFoe) and the flow sign drive the streaks,
   * so they always fall world-down with a slight toward-camera spread, whatever the camera's roll.
   */
  private updateRain(frame: SkyriverFrame): void {
    const { camera, dt } = frame;
    const u = this.rainMaterial.uniforms;
    if (dt > 1e-4) {
      const moved = this.rainCamera.distanceTo(camera.position);
      // A cut or a restore moves the camera in one frame; that is not velocity.
      if (moved < RAIN_TELEPORT_M) {
        this.rainScratch.subVectors(camera.position, this.rainCamera).divideScalar(dt);
        this.rainVelocity.lerp(this.rainScratch, Math.min(1, dt * 4));
      }
      this.rainCamera.copy(camera.position);
      u.uFall.value += dt * (1 + 0.4 * Math.min(2, this.rainVelocity.length() / 250));
    }
    // Where the rain comes from: up, plus the camera's motion (rain velocity relative to the camera,
    // negated), into view space.
    this.rainScratch.copy(this.rainVelocity).multiplyScalar(RAIN_CRAFT_SHARE);
    this.rainScratch.y += RAIN_FALL_MPS;
    this.rainScratch.x -= RAIN_WIND_X_MPS;
    this.rainQuaternion.copy(camera.quaternion).invert();
    this.rainScratch.applyQuaternion(this.rainQuaternion);
    const focal = 1 / Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);
    const dz = this.rainScratch.z;
    const foe = u.uFoe.value as THREE.Vector2;
    // q = d.xy * focal / -d.z works for both signs of d.z; a source behind the camera means the rain
    // runs toward the reflected point instead of away from it.
    const zSafe = Math.abs(dz) < 1e-4 ? -1e-4 : dz;
    foe.set(this.rainScratch.x, this.rainScratch.y).multiplyScalar(focal / -zSafe);
    if (foe.lengthSq() < 1e-8) foe.set(0, RAIN_FOE_MIN);
    // Off screen and above it in practice: the streaks keep reading as rain, not as warp lines.
    foe.clampLength(RAIN_FOE_MIN, RAIN_FOE_MAX);
    u.uFlow.value = zSafe < 0 ? 1 : -1;
  }

  /** T7-2: boost drama level 0..1 (flightPresentation boostVisual). Pure per frame; no state. */
  setBoost(level: number): void {
    this.rainMaterial.uniforms.uBoost.value = level;
    this.updateScreenPass();
  }

  stats(): SkyriverAtmosphereStats {
    // Sky, the shared beam field (R18), and the rain pass.
    const drawCalls = 1
      + 1
      + (this.quality.rainStreaks ? 1 : 0);
    return {
      godRays: this.quality.godRays ? this.anchors.length : 0,
      searchlights: this.searchlightOrigins.length,
      rainStreaks: this.quality.rainStreaks,
      meshes: 4,
      drawCalls,
      drawCallBudget: SKYRIVER_ATMOSPHERE_DRAW_CALL_BUDGET,
    };
  }

  dispose(): void {
    this.skyMesh.geometry.dispose();
    this.skyMaterial.dispose();
    this.beams.dispose();
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

      warpCanyon(anchor.x, anchor.z, atmosphereWarp);
      this.scratchStart.set(atmosphereWarp.x, anchor.y + 240, atmosphereWarp.z);
      warpDirection(-anchor.side * (0.16 + jitter * 0.2), (jitter - 0.5) * 0.22, atmosphereWarp.heading, atmosphereDir);
      this.scratchAxis.set(atmosphereDir.x, -1, atmosphereDir.z).normalize();
      // Cool rain-lit white, drifting a little toward the cyan end of the neon.
      this.scratchColor.setRGB(0.52 + jitter * 0.1, 0.63 + jitter * 0.08, 0.78);

      this.beams.write(
        SKYRIVER_ATMOSPHERE.searchlightCount + i,
        this.scratchStart,
        this.scratchAxis,
        length,
        34 + jitter * 20,
        88 + jitter * 48,
        this.scratchColor,
        jitter,
        GOD_RAY_LOOK,
      );
    }
    this.beams.commit();
  }

  /**
   * T6R-2: mounted on inner-wall roofs at stations along the autopilot straights (|z| <= 1.6 km), so
   * the beams sweep down through the canyon the camera actually flies, not over distant rooftops.
   */
  private deriveSearchlightOrigins(layout: SkyriverCityLayout): readonly THREE.Vector3[] {
    const count = SKYRIVER_ATMOSPHERE.searchlightCount;
    const stations: (readonly [number, number])[] = [];
    for (let k = 0; k < count; k += 1) stations.push([k % 2 === 0 ? -1 : 1, -CANYON_LOOP_LENGTH_M / 2 + ((k + 0.3) / count) * CANYON_LOOP_LENGTH_M]);
    const origins: THREE.Vector3[] = [];
    for (const [side, z] of stations.slice(0, SKYRIVER_ATMOSPHERE.searchlightCount)) {
      // R17: never a podium lot (cut down near route height, the lamp would shine into the camera).
      const wall = layout.towers.filter((tower) => Math.sign(tower.x) === side && podiumLotHeight(tower) === undefined);
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
      // Canyon space (across, along), then bent onto the loop with the origin's local heading.
      warpCanyon(origin.x, origin.z, atmosphereWarp);
      warpDirection(Math.cos(yaw) * cosPitch * -Math.sign(origin.x || 1), Math.sin(yaw) * cosPitch, atmosphereWarp.heading, atmosphereDir);
      this.scratchAxis.set(atmosphereDir.x, Math.sin(pitch), atmosphereDir.z).normalize();
      this.scratchStart.set(atmosphereWarp.x, origin.y, atmosphereWarp.z);
      this.scratchColor.setRGB(0.62 + seed * 0.2, 0.68, 0.74 - seed * 0.22);

      this.beams.write(
        i,
        this.scratchStart,
        this.scratchAxis,
        2600 + seed * 500,
        10 + seed * 6,
        150 + seed * 80,
        this.scratchColor,
        seed,
        SEARCHLIGHT_LOOK,
      );
    }
    // First write seeds every attribute; later frames only move the axes.
    if (time === 0) this.beams.commit();
    else this.beams.commitAxes();
  }
}

/** Deterministic scalar hash, the CPU twin of `skyHash11`. Keeps placement off Math.random. */
function hash1(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}
