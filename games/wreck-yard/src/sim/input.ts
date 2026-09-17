import { defineSyncplayInputCodec, type CanonicalValue } from '@series-inc/rundot-syncplay/browser';
import { clamp, normalize, type Vec3 } from './math';

export const TOOL = { hand: 0, torch: 1, none: 2 } as const;
export type Tool = (typeof TOOL)[keyof typeof TOOL];

export interface YardInput {
  readonly tool: Tool;
  readonly pressed: boolean;
  readonly secondary: boolean;
  readonly jetpack: boolean;
  /** Strafe: -1 (left) to 1 (right) */
  readonly moveX: number;
  /** Forward/backward: -1 (backward) to 1 (forward) */
  readonly moveZ: number;
  /** Aim yaw in milliradians (-3200 to 3200). */
  readonly yaw: number;
  /** Aim pitch in milliradians (-1500 to 1500). */
  readonly pitch: number;
  /** Ray origin in millimeters (optional legacy / test override). */
  readonly ox: number;
  readonly oy: number;
  readonly oz: number;
  /** Ray direction times 10000 (optional legacy / test override). */
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
}

export const RAY_ORIGIN_SCALE = 1000;
export const RAY_ORIGIN_LIMIT = 50_000;
export const RAY_DIR_SCALE = 10_000;
export const ANGLE_SCALE = 1000; // milliradians

const codec = defineSyncplayInputCodec<YardInput>({
  tool: { kind: 'enum', values: [TOOL.hand, TOOL.torch, TOOL.none], neutral: TOOL.none },
  pressed: { kind: 'boolean', neutral: false },
  secondary: { kind: 'boolean', neutral: false },
  jetpack: { kind: 'boolean', neutral: false },
  moveX: { kind: 'int', min: -1, max: 1, neutral: 0 },
  moveZ: { kind: 'int', min: -1, max: 1, neutral: 0 },
  yaw: { kind: 'int', min: -3200, max: 3200, neutral: 3142 },
  pitch: { kind: 'int', min: -1500, max: 1500, neutral: 0 },
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
