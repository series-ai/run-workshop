import { defineSyncplayInputCodec, type CanonicalValue } from '@series-inc/rundot-syncplay/browser';
import { clamp, normalize, type Vec3 } from './math';

export const TOOL = { hand: 0, torch: 1, none: 2 } as const;
export type Tool = (typeof TOOL)[keyof typeof TOOL];

export interface YardInput {
  readonly tool: Tool;
  readonly pressed: boolean;
  /** Ray origin in millimeters. */
  readonly ox: number;
  readonly oy: number;
  readonly oz: number;
  /** Ray direction times 10000. */
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
}

export const RAY_ORIGIN_SCALE = 1000;
export const RAY_ORIGIN_LIMIT = 50_000;
export const RAY_DIR_SCALE = 10_000;

const codec = defineSyncplayInputCodec<YardInput>({
  tool: { kind: 'enum', values: [TOOL.hand, TOOL.torch, TOOL.none], neutral: TOOL.none },
  pressed: { kind: 'boolean', neutral: false },
  ox: { kind: 'int', min: -RAY_ORIGIN_LIMIT, max: RAY_ORIGIN_LIMIT, neutral: 0 },
  oy: { kind: 'int', min: -RAY_ORIGIN_LIMIT, max: RAY_ORIGIN_LIMIT, neutral: 0 },
  oz: { kind: 'int', min: -RAY_ORIGIN_LIMIT, max: RAY_ORIGIN_LIMIT, neutral: 0 },
  dx: { kind: 'int', min: -RAY_DIR_SCALE, max: RAY_DIR_SCALE, neutral: 0 },
  dy: { kind: 'int', min: -RAY_DIR_SCALE, max: RAY_DIR_SCALE, neutral: 0 },
  dz: { kind: 'int', min: -RAY_DIR_SCALE, max: RAY_DIR_SCALE, neutral: 0 },
});

export const NEUTRAL_INPUT: YardInput = codec.neutralInput;

export function encodeYardInput(input: YardInput): CanonicalValue {
  return codec.encodeInput(input);
}

/** The authority substitutes canonical null for a missing input. That is the neutral input. */
export function decodeYardInput(encoded: CanonicalValue): YardInput {
  return encoded === null ? NEUTRAL_INPUT : codec.decodeInput(encoded);
}

export function quantizeRay(origin: Vec3, direction: Vec3): Pick<YardInput, 'ox' | 'oy' | 'oz' | 'dx' | 'dy' | 'dz'> {
  const d = normalize(direction);
  const q = (v: number, s: number, limit: number) => clamp(Math.round(v * s), -limit, limit);
  return {
    ox: q(origin[0], RAY_ORIGIN_SCALE, RAY_ORIGIN_LIMIT),
    oy: q(origin[1], RAY_ORIGIN_SCALE, RAY_ORIGIN_LIMIT),
    oz: q(origin[2], RAY_ORIGIN_SCALE, RAY_ORIGIN_LIMIT),
    dx: q(d[0], RAY_DIR_SCALE, RAY_DIR_SCALE),
    dy: q(d[1], RAY_DIR_SCALE, RAY_DIR_SCALE),
    dz: q(d[2], RAY_DIR_SCALE, RAY_DIR_SCALE),
  };
}

export function decodeRay(input: YardInput): { origin: Vec3; direction: Vec3 } | null {
  const raw: Vec3 = [input.dx / RAY_DIR_SCALE, input.dy / RAY_DIR_SCALE, input.dz / RAY_DIR_SCALE];
  const direction = normalize(raw);
  if (direction[0] === 0 && direction[1] === 0 && direction[2] === 0) return null;
  return {
    origin: [input.ox / RAY_ORIGIN_SCALE, input.oy / RAY_ORIGIN_SCALE, input.oz / RAY_ORIGIN_SCALE],
    direction,
  };
}
