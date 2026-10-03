import type { ToolFeedback, ToolResult } from '../sim/state';

/** One-shot feedback effects last this many simulation ticks, fading out. */
export const FEEDBACK_EFFECT_TICKS = 9;
/** The torch sends feedback every tick it fires; older feedback means it stopped. */
const TORCH_FIRING_TICKS = 2;

const ENERGY = '#7dd3fc';
const REFUSED = '#ef4444';
const TORCH_HEAT = '#ff8a3d';

/**
 * The effect for each tool result:
 * - refusal: a straight red beam to what blocked the gun (or into the air on a miss)
 * - lock: a flash on the object the gun took hold of; the tractor beam takes over while held
 * - burst: an energy burst that pushes the object out (throw on release, punt)
 * - heat: the torch's glowing mark where it hits
 */
export type FeedbackEffect =
  | { readonly kind: 'refusal'; readonly color: string; readonly flash: boolean; readonly recoil: number }
  | { readonly kind: 'lock' | 'burst' | 'heat'; readonly color: string; readonly recoil: number };

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

/** True while the torch is firing: it reported a cut, scorch, or miss within the last ticks. */
export function isTorchFiring(feedback: ToolFeedback | null, frame: number): boolean {
  if (!feedback || (feedback.result !== 'cut' && feedback.result !== 'scorch' && feedback.result !== 'miss')) return false;
  return frame - feedback.frame < TORCH_FIRING_TICKS;
}

/**
 * What the torch shows while it fires: a stream of fire to what it hits
 * within TORCH_RANGE, or a fizzle at the nozzle when nothing is in range.
 */
export type TorchVisual = 'stream' | 'fizzle';

export function torchVisual(feedback: ToolFeedback | null, frame: number): TorchVisual | null {
  if (!feedback || !isTorchFiring(feedback, frame)) return null;
  return feedback.result === 'miss' ? 'fizzle' : 'stream';
}

type V3 = readonly [number, number, number];

/**
 * Tractor beam curve: a quadratic Bézier that leaves the muzzle along the aim
 * and ends on the held object. When the object lags behind the aim, the beam bends.
 */
export function tractorControlPoint(muzzle: V3, aim: V3, target: V3): V3 {
  const reach = Math.hypot(target[0] - muzzle[0], target[1] - muzzle[1], target[2] - muzzle[2]) * 0.55;
  return [muzzle[0] + aim[0] * reach, muzzle[1] + aim[1] * reach, muzzle[2] + aim[2] * reach];
}

export function bezierPoint(p0: V3, p1: V3, p2: V3, t: number): [number, number, number] {
  const a = (1 - t) * (1 - t);
  const b = 2 * (1 - t) * t;
  const c = t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1], a * p0[2] + b * p1[2] + c * p2[2]];
}
