import type { AttractionCommand } from './attractions';
import { defineSyncplayInputCodec, type CanonicalValue } from '@series-inc/rundot-syncplay/browser';

export const TOOL = { hand: 0, torch: 1, none: 2 } as const;
export type Tool = (typeof TOOL)[keyof typeof TOOL];

export interface YardInput {
  readonly attraction: AttractionCommand;
  readonly attractionRequest: number;
  readonly tool: Tool;
  readonly pressed: boolean;
  /** The gravity gun's punt (right mouse button). */
  readonly secondary: boolean;
  /** Release a held body without a velocity boost. */
  readonly drop: boolean;
  /** Use (E or F): press a contraption button, get in or out of the buggy. */
  readonly use: boolean;
  readonly jetpack: boolean;
  /** Strafe: -1 (left) to 1 (right) */
  readonly moveX: number;
  /** Forward/backward: -1 (backward) to 1 (forward) */
  readonly moveZ: number;
  /** Aim yaw in milliradians (-3200 to 3200). */
  readonly yaw: number;
  /** Aim pitch in milliradians (-1500 to 1500). */
  readonly pitch: number;
}

export const ANGLE_SCALE = 1000; // milliradians

const codec = defineSyncplayInputCodec<YardInput>({
  attraction: { kind: 'int', min: 0, max: 5, neutral: 0 },
  attractionRequest: { kind: 'int', min: 0, max: 65535, neutral: 0 },
  tool: { kind: 'enum', values: [TOOL.hand, TOOL.torch, TOOL.none], neutral: TOOL.none },
  pressed: { kind: 'boolean', neutral: false },
  secondary: { kind: 'boolean', neutral: false },
  drop: { kind: 'boolean', neutral: false },
  use: { kind: 'boolean', neutral: false },
  jetpack: { kind: 'boolean', neutral: false },
  moveX: { kind: 'int', min: -1, max: 1, neutral: 0 },
  moveZ: { kind: 'int', min: -1, max: 1, neutral: 0 },
  yaw: { kind: 'int', min: -3200, max: 3200, neutral: 0 },
  pitch: { kind: 'int', min: -1500, max: 1500, neutral: 0 },
});

export const NEUTRAL_INPUT: YardInput = codec.neutralInput;

export function encodeYardInput(input: YardInput): CanonicalValue {
  return codec.encodeInput(input);
}

/** The authority substitutes canonical null for a missing input. That is the neutral input. */
export function decodeYardInput(encoded: CanonicalValue): YardInput {
  return encoded === null ? NEUTRAL_INPUT : codec.decodeInput(encoded);
}
