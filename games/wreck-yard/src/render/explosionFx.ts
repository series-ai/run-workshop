/**
 * Timing of the drum explosion effect (render/Explosions.tsx), as a function
 * of seconds since the blast. Every size comes from the sim's blast radius,
 * so what you see is what the blast reaches: the shock shell and the floor
 * ring stop at exactly `radius`, and sparks travel to it.
 */

/** Seconds for the shock to reach the blast radius. */
export const SHOCK_SECONDS = 0.35;
/** The floor ring stays at the full radius this long, then fades. */
const RING_HOLD_SECONDS = 0.5;
const FLASH_SECONDS = 0.3;
const FIREBALL_GROW_SECONDS = 0.15;
const FIREBALL_SECONDS = 0.75;
/** Fireball size at its largest, as a part of the blast radius. */
export const FIREBALL_SHARE = 0.55;
const SMOKE_SECONDS = 4;
const SCORCH_SECONDS = 6;
/** Seconds until the effect is over and its slot is free. */
export const EXPLOSION_FX_SECONDS = SCORCH_SECONDS;

export interface ExplosionFrame {
  readonly shockRadius: number;
  readonly shockOpacity: number;
  readonly ringRadius: number;
  readonly ringOpacity: number;
  readonly flash: number;
  readonly fireballRadius: number;
  readonly fireballOpacity: number;
  /** 0 to 1 through the smoke's life; null when there is no smoke. */
  readonly smoke: number | null;
  readonly scorchOpacity: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export function explosionFrame(seconds: number, radius: number): ExplosionFrame {
  const shock = clamp01(seconds / SHOCK_SECONDS);
  const shockRadius = radius * easeOutCubic(shock);
  const ringFade = clamp01((seconds - SHOCK_SECONDS) / RING_HOLD_SECONDS);
  const grow = easeOutCubic(clamp01(seconds / FIREBALL_GROW_SECONDS));
  const fade = clamp01((seconds - FIREBALL_GROW_SECONDS) / (FIREBALL_SECONDS - FIREBALL_GROW_SECONDS));
  return {
    shockRadius,
    shockOpacity: shock >= 1 ? 0 : 0.9 * (1 - shock) ** 0.6,
    ringRadius: shockRadius,
    ringOpacity: 0.85 * (1 - ringFade),
    flash: (1 - clamp01(seconds / FLASH_SECONDS)) ** 2,
    // Grows fast, then keeps swelling a little as it burns out.
    fireballRadius: radius * FIREBALL_SHARE * (0.8 * grow + 0.2 * fade),
    fireballOpacity: seconds >= FIREBALL_SECONDS ? 0 : 1 - fade ** 1.5,
    smoke: seconds < SMOKE_SECONDS ? seconds / SMOKE_SECONDS : null,
    scorchOpacity: 0.6 * (1 - clamp01((seconds - (SCORCH_SECONDS - 2)) / 2)),
  };
}

/** A spark's launch speed so that, with drag, it ends its life near the blast radius. */
export function sparkSpeed(radius: number, lifeSeconds: number): number {
  return radius / (lifeSeconds * 0.8);
}
