import type { ToolFeedback, ToolResult } from '../sim/state';

/** One-shot feedback effects last this many simulation ticks, fading out. */
export const FEEDBACK_EFFECT_TICKS = 9;
/** The torch sends feedback every tick it fires; older feedback means it stopped. */
const TORCH_FIRING_TICKS = 2;

const ENERGY = '#7dd3fc';
const REFUSED = '#ef4444';
const TORCH_HEAT = '#ff8a3d';
const STEAM = '#e8e6e3';

/**
 * The effect for each tool result:
 * - refusal: a straight red beam to what blocked the gun (or into the air on a miss)
 * - lock: a new hold or control press; held objects use a surface shader
 * - burst: an energy burst that pushes the object out (throw on release, punt)
 * - heat: the torch's glowing mark where it hits
 * - quench: the torch flame met water; TorchJet draws the steam
 */
export type FeedbackEffect =
  | { readonly kind: 'refusal'; readonly color: string; readonly flash: boolean; readonly recoil: number }
  | { readonly kind: 'lock' | 'burst' | 'heat' | 'quench'; readonly color: string; readonly recoil: number };

export function feedbackEffect(result: ToolResult): FeedbackEffect {
  switch (result) {
    case 'grab':
      return { kind: 'lock', color: ENERGY, recoil: 0.04 };
    case 'throw':
      return { kind: 'burst', color: ENERGY, recoil: 0.07 };
    case 'punt':
      return { kind: 'burst', color: ENERGY, recoil: 0.1 };
    case 'blocked':
      return { kind: 'refusal', color: REFUSED, flash: true, recoil: 0.03 };
    case 'miss':
      return { kind: 'refusal', color: REFUSED, flash: false, recoil: 0.03 };
    case 'cut':
    case 'scorch':
      return { kind: 'heat', color: TORCH_HEAT, recoil: 0 };
    case 'quench':
      return { kind: 'quench', color: STEAM, recoil: 0 };
    case 'press':
      return { kind: 'lock', color: ENERGY, recoil: 0.02 };
    default: {
      const unreachable: never = result;
      throw new Error(`WRECK_YARD_TOOL_RESULT_INVALID: ${String(unreachable)}`);
    }
  }
}

/** How far a one-shot effect has played, 0 on its tick to 1 when it ends; null outside that window. */
export function effectProgress(ageTicks: number): number | null {
  if (ageTicks < 0 || ageTicks >= FEEDBACK_EFFECT_TICKS) return null;
  return ageTicks / FEEDBACK_EFFECT_TICKS;
}

const TORCH_RESULTS: readonly ToolResult[] = ['cut', 'scorch', 'miss', 'quench'];

/** True while the torch is firing: it reported a torch result within the last ticks. */
export function isTorchFiring(feedback: ToolFeedback | null, frame: number): boolean {
  if (!feedback || !TORCH_RESULTS.includes(feedback.result)) return false;
  return frame - feedback.frame < TORCH_FIRING_TICKS;
}

/**
 * What the torch shows while it fires: a stream of fire to what it hits
 * within TORCH_RANGE, a fizzle at the nozzle when nothing is in range, or
 * steam where the flame meets water (the stream runs to the surface first).
 */
export type TorchVisual = 'stream' | 'fizzle' | 'quench';

export function torchVisual(feedback: ToolFeedback | null, frame: number): TorchVisual | null {
  if (!feedback || !isTorchFiring(feedback, frame)) return null;
  if (feedback.result === 'miss') return 'fizzle';
  return feedback.result === 'quench' ? 'quench' : 'stream';
}

type V3 = readonly [number, number, number];

/**
 * Where to put a flat glow sprite that marks a hit: `distance` (its radius)
 * from the hit toward the camera. The whole quad then sits in front of the
 * surface it touches, instead of half of it cut off inside, and it still
 * hides behind anything nearer.
 */
export function towardCamera(point: V3, camera: V3, distance: number): [number, number, number] {
  const d = [camera[0] - point[0], camera[1] - point[1], camera[2] - point[2]] as const;
  const length = Math.hypot(d[0], d[1], d[2]);
  if (length < 1e-6) return [point[0], point[1], point[2]];
  const step = Math.min(distance, length * 0.5) / length;
  return [point[0] + d[0] * step, point[1] + d[1] * step, point[2] + d[2] * step];
}
