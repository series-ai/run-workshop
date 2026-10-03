import { WORLD_SUN_DIRECTION } from '../viewConstants';

export type Hex = `#${string}`;

export type PaletteKey =
  | 'skyZenith'
  | 'skyBand'
  | 'skyLow'
  | 'haze'
  | 'skyline'
  | 'skylineFar'
  | 'signalOrange'
  | 'orangeShade'
  | 'concreteLit'
  | 'concreteShade'
  | 'floor'
  | 'teal'
  | 'mustard'
  | 'rust'
  | 'metal'
  | 'dangerRed'
  | 'waterDeep'
  | 'waterShallow'
  | 'waterFoam'
  | 'spark'
  | 'glow'
  | 'ink';

export type ToonRamp = {
  /** N·L values where the band changes. Invariant: 0 < edges[0] < edges[1] < 1. */
  readonly edges: readonly [number, number];
  /** Multiplier on albedo in full shade. Cool slate tone. Each channel in (0, 1). */
  readonly shadeTint: readonly [number, number, number];
  /** Multiplier on albedo in full light. Warm golden tone. Each channel <= 1.05. */
  readonly litTint: readonly [number, number, number];
  /** Position of the half-tone band between shade and lit. In (0, 1). */
  readonly halfLevel: number;
};

export type InkStyle = {
  readonly color: Hex;
  readonly widthPxAt1080: number; // scaled by drawingBufferHeight / 1080, minimum 1
  readonly depthThreshold: number;
  /** 1 - cos(bend angle) at which a crease line appears. */
  readonly normalThreshold: number;
  /** Line opacity over the shaded color, 0..1. */
  readonly opacity: number;
  readonly creaseFade: readonly [number, number]; // metres: full strength, zero strength
  readonly silhouetteFade: readonly [number, number]; // metres: silhouetteFade[1] < nearest skyline distance
  readonly emissiveLumaCutoff: number;
};

export type CavityStyle = {
  readonly strength: number;
  readonly bias: number;
  readonly width: number;
  readonly maxNeighborDistance: number;
  readonly fade: readonly [number, number];
};

export type SkyStyle = {
  readonly stops: readonly { readonly elevation: number; readonly color: Hex }[];
  readonly steps: number;
};

export type PostStyle = {
  readonly ao: { readonly radius: number; readonly intensity: number; readonly bias: number; readonly fade: readonly [number, number]; readonly strength: number };
  /** Bloom gain for the 1/4-res glow (low) and the 5-level chain (high). */
  readonly bloom: { readonly threshold: number; readonly gainLow: number; readonly gainHigh: number };
  /** World-space grime amplitude (high tier): brightness varies by about ±this. */
  readonly grime: number;
  /** Display-space grade applied on every tier. */
  readonly grade: {
    readonly contrast: number;
    readonly saturation: number;
    readonly shadowTint: readonly [number, number, number];
    readonly highlightTint: readonly [number, number, number];
    readonly vignette: number;
  };
};

export type ArtStyle = {
  readonly palette: Readonly<Record<PaletteKey, Hex>>;
  readonly ramp: ToonRamp;
  readonly ink: InkStyle;
  readonly cavity: CavityStyle;
  readonly sky: SkyStyle;
  readonly post: PostStyle;
  readonly keyDirection: readonly [number, number, number];
};

export interface RigLight {
  readonly color: readonly [number, number, number];
  readonly intensity: number;
}

export const ART_STYLE: ArtStyle = {
  palette: {
    skyZenith: '#172530',
    skyBand: '#5a2f35',
    skyLow: '#d4502a',
    /** Distance haze. Darkens far geometry toward the dusk sky, not the bright horizon. */
    haze: '#3d3137',
    skyline: '#161d24',
    skylineFar: '#2b2a33',
    signalOrange: '#c87536',
    orangeShade: '#80442e',
    concreteLit: '#b2a18a',
    concreteShade: '#686963',
    floor: '#2f343a',
    teal: '#48766f',
    mustard: '#ba9148',
    rust: '#925039',
    metal: '#7d8c96',
    /** Fuel drums (sim/fuelDrum.ts): a muted red that reads as danger at dusk. */
    dangerRed: '#a8392c',
    waterDeep: '#184b55',
    waterShallow: '#397b7b',
    waterFoam: '#adc0b6',
    spark: '#fff1ca',
    glow: '#ff812e',
    ink: '#18212b',
  },
  ramp: {
    edges: [0.18, 0.60],
    shadeTint: [0.28, 0.34, 0.46],
    litTint: [1.04, 0.96, 0.82],
    halfLevel: 140 / 255,
  },
  ink: {
    color: '#0f151c',
    widthPxAt1080: 1.5,
    depthThreshold: 0.0025,
    normalThreshold: 0.3,
    opacity: 0.92,
    creaseFade: [14, 34],
    silhouetteFade: [45, 95],
    emissiveLumaCutoff: 0.85,
  },
  cavity: {
    strength: 0.10,
    bias: 0.005,
    width: 0.030,
    maxNeighborDistance: 0.18,
    fade: [8, 22],
  },
  sky: {
    stops: [
      { elevation: 0.85, color: '#364958' },
      { elevation: 0.35, color: '#364958' },
      { elevation: 0.18, color: '#b87c58' },
      { elevation: 0.04, color: '#cf986c' },
    ],
    steps: 12,
  },
  post: {
    ao: { radius: 1.1, intensity: 2.2, bias: 0.03, fade: [30, 60], strength: 1.0 },
    bloom: { threshold: 1.25, gainLow: 0.18, gainHigh: 0.12 },
    grime: 0.22,
    grade: {
      contrast: 1.1,
      saturation: 1.08,
      shadowTint: [0.93, 0.97, 1.07],
      highlightTint: [1.05, 1.0, 0.92],
      vignette: 0.35,
    },
  },
  keyDirection: WORLD_SUN_DIRECTION,
};

/**
 * Pure function: maps N·L into a discrete band index (0 = shade, 1 = half-tone, 2 = lit).
 * If shadow scalar is provided (for legacy callers), scales nDotL by shadow.
 */
export function toonBand(nDotL: number, shadowOrRamp?: number | ToonRamp, optionalRamp?: ToonRamp): 0 | 1 | 2 {
  let v = nDotL;
  let ramp: ToonRamp;
  if (typeof shadowOrRamp === 'number') {
    v = nDotL * shadowOrRamp;
    ramp = optionalRamp ?? ART_STYLE.ramp;
  } else {
    ramp = shadowOrRamp ?? ART_STYLE.ramp;
  }

  if (v < ramp.edges[0]) return 0;
  if (v < ramp.edges[1]) return 1;
  return 2;
}

/**
 * Pure function: computes the multiplier color tint for a given band index and shadow visibility.
 */
export function toonTint(
  bandOrNdotL: (0 | 1 | 2) | number,
  visibilityOrRamp?: number | ToonRamp,
  optionalRamp?: ToonRamp,
): readonly [number, number, number] {
  let band: 0 | 1 | 2;
  let visibility = 1.0;
  let ramp: ToonRamp;

  if (optionalRamp !== undefined) {
    const nDotL = bandOrNdotL as number;
    visibility = typeof visibilityOrRamp === 'number' ? visibilityOrRamp : 1.0;
    ramp = optionalRamp;
    band = toonBand(nDotL, ramp);
  } else if (typeof visibilityOrRamp === 'object') {
    band = bandOrNdotL as 0 | 1 | 2;
    ramp = visibilityOrRamp as ToonRamp;
    visibility = 1.0;
  } else {
    band = bandOrNdotL as 0 | 1 | 2;
    ramp = ART_STYLE.ramp;
    visibility = typeof visibilityOrRamp === 'number' ? visibilityOrRamp : 1.0;
  }

  const halfTint: [number, number, number] = [
    ramp.shadeTint[0] + (ramp.litTint[0] - ramp.shadeTint[0]) * ramp.halfLevel,
    ramp.shadeTint[1] + (ramp.litTint[1] - ramp.shadeTint[1]) * ramp.halfLevel,
    ramp.shadeTint[2] + (ramp.litTint[2] - ramp.shadeTint[2]) * ramp.halfLevel,
  ];

  const target = band === 0 ? ramp.shadeTint : band === 1 ? halfTint : ramp.litTint;
  const v = Math.max(0, Math.min(1, visibility));

  return [
    ramp.shadeTint[0] + (target[0] - ramp.shadeTint[0]) * v,
    ramp.shadeTint[1] + (target[1] - ramp.shadeTint[1]) * v,
    ramp.shadeTint[2] + (target[2] - ramp.shadeTint[2]) * v,
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

/**
 * Astra Visual Pass: Shared linear lighting definition targeting Teardown aesthetic.
 * Linear irradiance values (not sRGB gamma) ensuring dual-hemisphere sky/ground balance.
 */
export const YARD_LIGHTING = {
  ambientFloor: [0.025, 0.025, 0.025] as const,
  sky: [0.30, 0.38, 0.50] as const,       // Crisp cool blue-slate sky fill
  ground: [0.12, 0.095, 0.075] as const,  // Warm dirt/concrete bounce
  sun: [0.68, 0.52, 0.31] as const,       // Warm golden afternoon sun
  rim: {
    sky: 0.025,
    sun: 0.08,
    glint: 0.12,
  },
  fog: {
    color: '#929b9b',
    near: 6,
    baseDensity: 0.004,
    groundDensity: 0.014,
    heightFalloff: 0.5,
    maxMix: 0.38,
  },
  pool: [0.22, 0.105, 0.035] as const,
} as const;
