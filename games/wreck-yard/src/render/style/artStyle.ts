import { WORLD_SUN_DIRECTION } from '../viewConstants';

export type Hex = `#${string}`;

export type PaletteKey =
  | 'skyZenith'
  | 'skyBand'
  | 'skyLow'
  | 'skyline'
  | 'signalOrange'
  | 'orangeShade'
  | 'concreteLit'
  | 'concreteShade'
  | 'floor'
  | 'teal'
  | 'mustard'
  | 'rust'
  | 'spark'
  | 'glow'
  | 'ink';

export type ToonRamp = {
  /** N·L × shadow values where the band changes. Invariant: 0 < edges[0] < edges[1] < 1. */
  readonly edges: readonly [number, number];
  /** Multiplier on albedo in full shade. Cool. Each channel in (0, 1). */
  readonly shadeTint: readonly [number, number, number];
  /** Multiplier on albedo in full light. Each channel <= 1.05. */
  readonly litTint: readonly [number, number, number];
  /** Position of the half-tone band between shade and lit. In (0, 1). */
  readonly halfLevel: number;
};

export type InkStyle = {
  readonly color: Hex;
  readonly widthPxAt1080: number; // scaled by drawingBufferHeight / 1080, minimum 1
  readonly depthThreshold: number;
  readonly normalThreshold: number;
  readonly creaseFade: readonly [number, number]; // metres: full strength, zero strength
  readonly silhouetteFade: readonly [number, number]; // metres: silhouetteFade[1] < nearest skyline distance
  readonly emissiveLumaCutoff: number;
};

export type SkyStyle = {
  readonly stops: readonly { readonly elevation: number; readonly color: Hex }[];
  readonly steps: number;
};

export type ArtStyle = {
  readonly palette: Readonly<Record<PaletteKey, Hex>>;
  readonly ramp: ToonRamp;
  readonly ink: InkStyle;
  readonly sky: SkyStyle;
  readonly keyDirection: readonly [number, number, number];
};

export interface RigLight {
  readonly color: readonly [number, number, number];
  readonly intensity: number;
}

export const ART_STYLE: ArtStyle = {
  palette: {
    skyZenith: '#141d27',
    skyBand: '#df5d1c',
    skyLow: '#9f2b1e',
    skyline: '#182128',
    signalOrange: '#de681f',
    orangeShade: '#923b1d',
    concreteLit: '#a7977f',
    concreteShade: '#565246',
    floor: '#27292b',
    teal: '#4f7f78',
    mustard: '#b07f21',
    rust: '#8a4a33',
    spark: '#fefb8f',
    glow: '#fd7831',
    ink: '#14110f',
  },
  ramp: {
    edges: [0.15, 0.55],
    shadeTint: [0.5, 0.5, 0.62],
    litTint: [1.0, 1.0, 1.0],
    halfLevel: 0.6,
  },
  ink: {
    color: '#14110f',
    widthPxAt1080: 2.2,
    depthThreshold: 0.0025,
    normalThreshold: 0.35,
    creaseFade: [8, 22],
    silhouetteFade: [15, 38],
    emissiveLumaCutoff: 0.85,
  },
  sky: {
    stops: [
      { elevation: 0.85, color: '#141d27' },
      { elevation: 0.35, color: '#141d27' },
      { elevation: 0.18, color: '#9f2b1e' },
      { elevation: 0.04, color: '#df5d1c' },
    ],
    steps: 6,
  },
  keyDirection: WORLD_SUN_DIRECTION,
};

/**
 * Pure function: maps N·L and shadow scalar into a discrete band index (0 = shade, 1 = half-tone, 2 = lit).
 */
export function toonBand(nDotL: number, shadow: number, ramp: ToonRamp): 0 | 1 | 2 {
  const v = nDotL * shadow;
  if (v < ramp.edges[0]) return 0;
  if (v < ramp.edges[1]) return 1;
  return 2;
}

/**
 * Pure function: computes the multiplier color tint for a given band index.
 */
export function toonTint(band: 0 | 1 | 2, ramp: ToonRamp): readonly [number, number, number] {
  if (band === 0) return ramp.shadeTint;
  if (band === 2) return ramp.litTint;
  return [
    ramp.shadeTint[0] + (ramp.litTint[0] - ramp.shadeTint[0]) * ramp.halfLevel,
    ramp.shadeTint[1] + (ramp.litTint[1] - ramp.shadeTint[1]) * ramp.halfLevel,
    ramp.shadeTint[2] + (ramp.litTint[2] - ramp.shadeTint[2]) * ramp.halfLevel,
  ];
}

/**
 * Pure function: derives π-scaled ambient and key directional light rig for Three.js toon shading.
 * In Three.js: diffuse is divided by π (RECIPROCAL_PI).
 * Ambient irradiance is ambientLightColor directly.
 * Therefore: ambient = shadeTint * π, key = (litTint - shadeTint) * π.
 */
export function deriveLightRig(style: ArtStyle): {
  ambient: RigLight;
  key: RigLight & { position: readonly [number, number, number] };
} {
  const { ramp, keyDirection } = style;
  const keyDist = 40;

  return {
    ambient: {
      color: [
        ramp.shadeTint[0] * Math.PI,
        ramp.shadeTint[1] * Math.PI,
        ramp.shadeTint[2] * Math.PI,
      ],
      intensity: 1.0,
    },
    key: {
      color: [
        (ramp.litTint[0] - ramp.shadeTint[0]) * Math.PI,
        (ramp.litTint[1] - ramp.shadeTint[1]) * Math.PI,
        (ramp.litTint[2] - ramp.shadeTint[2]) * Math.PI,
      ],
      intensity: 1.0,
      position: [
        keyDirection[0] * keyDist,
        keyDirection[1] * keyDist,
        keyDirection[2] * keyDist,
      ],
    },
  };
}
