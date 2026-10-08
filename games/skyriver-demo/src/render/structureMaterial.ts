/**
 * @file structureMaterial.ts — Seeded material profiles, Float32 card codec,
 * combined Rec.709 material luminance bounds, and interior stage weight invariants.
 *
 * R25 structure material & interior stages.
 */

import { interiorDepthWeight, SKYRIVER_INTERIOR_FADE } from './interiorResponse.js';

export const REC709_LUMINANCE_WEIGHTS = Object.freeze([0.2126, 0.7152, 0.0722] as const);

export const STRUCTURE_MATERIAL_GAIN_RANGE = Object.freeze([0.82, 1.18] as const);

export const STRUCTURE_MATERIAL_FAMILIES = 4;

export interface StructureMaterialProfile {
  readonly family: number;
  readonly base: number;
  readonly weather: number;
  readonly edge: number;
  readonly faceBias: number;
  readonly chroma: readonly [number, number, number];
}

export interface CardCodecResult {
  readonly variant: number;
  readonly q: number;
}

export interface StageWeightsInput {
  readonly mode: string;
  readonly strength: number;
  readonly grazing: number;
  readonly isSide: number;
  readonly cellPixels: number;
  readonly viewDepth: number;
}

export interface StageWeightsResult {
  readonly s: number;
  readonly f: number;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function smooth(a: number, b: number, x: number): number {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
}

/** Quantize a Float32 owner seed into an integer q in [0, 65535]. */
export function quantize(seed32: number): number {
  const f32 = Math.fround(seed32);
  const clamped = Math.min(Math.max(f32, 0), 1 - 1 / 65536);
  return Math.floor(clamped * 65536);
}

/** Encode atlas variant (0..63) and quantized seed q (0..65535) into packed Float32. */
export function encodeCard(variant: number, q: number): number {
  return Math.fround(variant + (q + 0.5) / 65536);
}

/** Decode packed Float32 into integer atlas variant and quantized seed q. */
export function decodeCard(packed: number): CardCodecResult {
  const p = Math.fround(packed);
  const variant = Math.floor(p);
  const q = Math.floor((p - variant) * 65536);
  return { variant, q };
}

/** Weak family chroma vectors in linear Rec.709 space. */
const FAMILY_CHROMA: readonly (readonly [number, number, number])[] = Object.freeze([
  Object.freeze([1.0, 1.0, 1.0] as const),      // Family 0: Neutral grey
  Object.freeze([0.96, 1.0, 1.06] as const),   // Family 1: Cool grey
  Object.freeze([1.05, 1.0, 0.95] as const),   // Family 2: Warm grey
  Object.freeze([1.02, 1.02, 1.03] as const),  // Family 3: Pale clean grey
]);

const FAMILY_EDGE_BASE = Object.freeze([1.0, 1.10, 0.90, 1.0] as const);

/** Pure material profile derived deterministically from quantized seed q. */
export function profile(q: number): StructureMaterialProfile {
  const family = q >>> 14;
  const low14 = q & 0x3fff;
  const sinB = Math.sin(low14 * 12.9898 + 78.233) * 43758.5453;
  const b = (sinB - Math.floor(sinB)) * 2 - 1;
  const sinW = Math.sin(low14 * 39.346 + 11.135) * 43758.5453;
  const w = (sinW - Math.floor(sinW)) * 2 - 1;
  const sinF = Math.sin(low14 * 73.156 + 45.197) * 43758.5453;
  const faceBias = (sinF - Math.floor(sinF)) * 2 - 1;
  const edge = Math.min(1.12, Math.max(0.88, FAMILY_EDGE_BASE[family]! + 0.04 * b));
  return {
    family,
    base: Math.min(1, Math.max(-1, b)),
    weather: Math.min(1, Math.max(-1, w)),
    edge,
    faceBias: Math.min(1, Math.max(-1, faceBias)),
    chroma: FAMILY_CHROMA[family]!,
  };
}

/** Linear Rec.709 luminance Y from RGB. */
export function linearLuminance(rgb: readonly [number, number, number]): number {
  return rgb[0] * REC709_LUMINANCE_WEIGHTS[0]
    + rgb[1] * REC709_LUMINANCE_WEIGHTS[1]
    + rgb[2] * REC709_LUMINANCE_WEIGHTS[2];
}

/**
 * Normalizes proposed material C1 so that its Rec.709 luminance matches
 * Y(C0) * gain, where gain = clamp(1 + 0.12*b + 0.04*w + 0.02*f, 0.82, 1.18).
 */
export function normalizeMaterial(
  c0: readonly [number, number, number],
  proposed: readonly [number, number, number],
  base: number,
  weather: number,
  face: number,
): [number, number, number] {
  const b = Math.max(-1, Math.min(1, base));
  const w = Math.max(-1, Math.min(1, weather));
  const f = Math.max(-1, Math.min(1, face));
  const gain = Math.max(0.82, Math.min(1.18, 1 + 0.12 * b + 0.04 * w + 0.02 * f));
  const y0 = linearLuminance(c0);
  if (y0 <= 0 || !Number.isFinite(y0)) return [0, 0, 0];
  const y1 = linearLuminance(proposed);
  if (y1 <= 0 || !Number.isFinite(y1)) {
    return [c0[0] * gain, c0[1] * gain, c0[2] * gain];
  }
  const scale = (y0 * gain) / y1;
  return [
    Math.max(0, proposed[0] * scale),
    Math.max(0, proposed[1] * scale),
    Math.max(0, proposed[2] * scale),
  ];
}

/** Continuous monotonic interior stage weights: S for silhouette, F for furniture detail. */
export function stageWeights(input: StageWeightsInput): StageWeightsResult {
  const { mode, strength, grazing, isSide, cellPixels, viewDepth } = input;
  if (mode === 'off' || strength <= 0 || isSide <= 0 || grazing <= 0) {
    return { s: 0, f: 0 };
  }
  const band = mode === 'near' ? SKYRIVER_INTERIOR_FADE.near : SKYRIVER_INTERIOR_FADE.full;
  const dS = interiorDepthWeight(viewDepth, band[0], band[1]);
  const s = clamp01(strength * dS * grazing * isSide);
  if (s <= 0) {
    return { s: 0, f: 0 };
  }
  const dF = interiorDepthWeight(viewDepth, 0.4 * band[0], band[0]);
  const pF = smooth(4, 10, cellPixels);
  const f = clamp01(s * dF * pF);
  return { s, f };
}

/** GLSL routines implementing the shader-side structure material & stages. */
export const SKYRIVER_STRUCTURE_MATERIAL_GLSL = /* glsl */ `
const vec3 REC709_LUMA = vec3( 0.2126, 0.7152, 0.0722 );

float quantizeMaterialSeed( float seed32 ) {
  return floor( clamp( seed32, 0.0, 1.0 - 1.0 / 65536.0 ) * 65536.0 );
}

vec3 normalizeMaterial( vec3 c0, vec3 proposed, float b, float w, float f ) {
  float gain = clamp( 1.0 + 0.12 * b + 0.04 * w + 0.02 * f, 0.82, 1.18 );
  float y0 = dot( c0, REC709_LUMA );
  if ( y0 <= 0.0 ) return vec3( 0.0 );
  float y1 = dot( proposed, REC709_LUMA );
  if ( y1 <= 1e-12 ) return c0 * gain;
  return proposed * ( ( y0 * gain ) / y1 );
}

void structureMaterialProfile( float q, float faceId, out float family, out float b, out float w, out float f, out float edge, out vec3 chroma ) {
  family = floor( q / 16384.0 );
  float low14 = mod( q, 16384.0 );
  float hashB = fract( sin( low14 * 12.9898 + 78.233 ) * 43758.5453 );
  b = hashB * 2.0 - 1.0;
  float hashW = fract( sin( low14 * 39.346 + 11.135 ) * 43758.5453 );
  w = hashW * 2.0 - 1.0;
  float hashF = fract( sin( low14 * 73.156 + 45.197 + faceId * 17.3 ) * 43758.5453 );
  f = hashF * 2.0 - 1.0;

  if ( family < 0.5 ) {
    chroma = vec3( 1.0, 1.0, 1.0 );
    edge = clamp( 1.0 + 0.04 * b, 0.88, 1.12 );
  } else if ( family < 1.5 ) {
    chroma = vec3( 0.96, 1.0, 1.06 );
    edge = clamp( 1.10 + 0.04 * b, 0.88, 1.12 );
  } else if ( family < 2.5 ) {
    chroma = vec3( 1.05, 1.0, 0.95 );
    edge = clamp( 0.90 + 0.04 * b, 0.88, 1.12 );
  } else {
    chroma = vec3( 1.02, 1.02, 1.03 );
    edge = clamp( 1.0 + 0.04 * b, 0.88, 1.12 );
  }
}
`;
