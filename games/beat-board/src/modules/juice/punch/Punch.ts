// --- Types ---

export type EasingFn = (t: number) => number;

export type PunchProperty = 'scale' | 'position' | 'rotation';

export interface PunchConfig {
  /** Metadata tag for which property this punch targets. Default: 'scale' */
  property?: PunchProperty;
  /** Peak amplitude of the punch. Default: 0.2 */
  strength?: number;
  /** Number of oscillations during decay. Default: 6 */
  vibrato?: number;
  /** Overshoot amount 0–1. Higher = slower decay envelope. Default: 0.5 */
  elasticity?: number;
  /** Total duration in milliseconds. Default: 300 */
  duration?: number;
  /** Maximum effective range for distance-based falloff. */
  maxRange?: number;
  /** Curve for range falloff. Maps normalized distance (0..1) to intensity multiplier. Default: linear (1-t). */
  rangeFalloff?: EasingFn;
}

export interface PunchState {
  /** Offset from rest position (0 = rest). */
  value: number;
  /** Whether the punch animation is currently running. */
  active: boolean;
}

export interface PunchTriggerOptions {
  /** Override strength for this trigger. */
  strength?: number;
  /** Feedback intensity multiplier (0..1). Scales the punch amplitude. */
  intensity?: number;
  /** Distance from the punch source, used with maxRange for falloff. */
  distance?: number;
}

export interface Punch {
  /** Trigger the punch. Accepts strength override, intensity multiplier, and distance for range falloff. */
  trigger(strengthOrOptions?: number | PunchTriggerOptions): void;
  update(dt: number): PunchState;
  isActive(): boolean;
  reset(): void;
}

// --- Defaults ---

const DEFAULT_STRENGTH = 0.2;
const DEFAULT_VIBRATO = 6;
const DEFAULT_ELASTICITY = 0.5;
const DEFAULT_DURATION = 300;

// --- Helpers ---

function linearFalloff(t: number): number {
  return 1 - t;
}

// --- Implementation ---

export function createPunch(config: PunchConfig = {}): Punch {
  const baseStrength = config.strength ?? DEFAULT_STRENGTH;
  const vibrato = config.vibrato ?? DEFAULT_VIBRATO;
  const elasticity = config.elasticity ?? DEFAULT_ELASTICITY;
  const durationMs = config.duration ?? DEFAULT_DURATION;
  const maxRange = config.maxRange;
  const rangeFalloff = config.rangeFalloff ?? linearFalloff;

  let elapsed = 0;
  let active = false;
  let currentStrength = baseStrength;

  return {
    trigger(strengthOrOptions?: number | PunchTriggerOptions): void {
      let strength: number;
      let intensity = 1;
      let distance: number | undefined;

      if (typeof strengthOrOptions === 'object' && strengthOrOptions !== null) {
        strength = strengthOrOptions.strength ?? baseStrength;
        intensity = strengthOrOptions.intensity ?? 1;
        distance = strengthOrOptions.distance;
      } else {
        strength = strengthOrOptions ?? baseStrength;
      }

      // Apply intensity multiplier
      let effectiveStrength = strength * intensity;

      // Apply range falloff
      if (distance !== undefined && maxRange !== undefined && maxRange > 0) {
        if (distance >= maxRange) {
          // Out of range — don't trigger
          return;
        }
        const normalizedDistance = distance / maxRange;
        effectiveStrength *= rangeFalloff(normalizedDistance);
      }

      currentStrength = effectiveStrength;
      elapsed = 0;
      active = true;
    },

    update(dt: number): PunchState {
      if (!active) {
        return { value: 0, active: false };
      }

      // dt is in seconds, duration is in ms
      elapsed += dt * 1000;

      if (elapsed >= durationMs) {
        active = false;
        return { value: 0, active: false };
      }

      const progress = elapsed / durationMs;

      // Decaying sine wave
      // Envelope: strength * (1 - progress)^(elasticity * 3) * (1 - progress)
      // = strength * (1 - progress)^(elasticity * 3 + 1)
      const envelope = Math.pow(1 - progress, elasticity * 3) * (1 - progress);
      const amplitude = currentStrength * envelope;

      // Oscillation: sin(progress * vibrato * PI * 2)
      const value = amplitude * Math.sin(progress * vibrato * Math.PI * 2);

      return { value, active: true };
    },

    isActive(): boolean {
      return active;
    },

    reset(): void {
      active = false;
      elapsed = 0;
    },
  };
}
