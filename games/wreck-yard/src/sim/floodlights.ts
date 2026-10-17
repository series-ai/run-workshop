import { SHELL_PREFIX, TICK_RATE } from './constants';
import type { Vec3 } from './math';
import { FLOODLIGHT_MASTS, floodlightLensCenter, floodlightLensId } from './setPieces';
import { NEVER_FRAME, type ContraptionState, type LampState } from './state';

/**
 * How the corner floodlights take damage and come back. A hit adds damage that
 * grows with its closing speed. A lens at 1 damage breaks. A lamp hit below that
 * flickers, so a player sees that a second hit will break it.
 */
export const FLOODLIGHT = {
  /** Closing speed (m/s) below which a hit does nothing. Fuel drums take damage from 3 m/s. */
  minHitSpeed: 2.5,
  /** Closing speed (m/s) at which one hit breaks a whole lens. */
  breakSpeed: 5.5,
  /** Damage from a blast at the drum, before falloff. A close blast breaks a lens, and a far one makes it flicker. */
  blastDamage: 1.6,
  /** Seconds that a lamp flickers after a hit that did not break it. */
  flickerSeconds: 1.2,
  /** Seconds until one broken lamp comes back, while the other lamps still burn. */
  repairSeconds: 120,
  /** Seconds that the yard stays dark when all four lamps are out. Then all four come back on. */
  lightsOutSeconds: 40,
} as const;

/** Ticks that a smash stays in the state, so the render can show the glass falling. */
export const LAMP_SHOW_TICKS = Math.round(0.8 * TICK_RATE);
export const FLICKER_TICKS = Math.round(FLOODLIGHT.flickerSeconds * TICK_RATE);
export const REPAIR_TICKS = Math.round(FLOODLIGHT.repairSeconds * TICK_RATE);
export const LIGHTS_OUT_TICKS = Math.round(FLOODLIGHT.lightsOutSeconds * TICK_RATE);

interface LensInfo {
  readonly lampId: string;
  readonly at: Vec3;
}

/** Each lens by its physics key. A shell body is named with SHELL_PREFIX (sim/shell.ts). */
const LENS_BY_KEY: ReadonlyMap<string, LensInfo> = new Map(FLOODLIGHT_MASTS.map(([x, z]) => {
  const lampId = floodlightLensId(x, z);
  return [SHELL_PREFIX + lampId, { lampId, at: floodlightLensCenter(x, z) }] as const;
}));

/** Every lens, in FLOODLIGHT_MASTS order. */
export const FLOODLIGHT_LENSES: readonly LensInfo[] = [...LENS_BY_KEY.values()];

/** True for the id of a corner floodlight lens. Saved bytes are checked with it. */
export function isFloodlightLensId(id: unknown): id is string {
  return typeof id === 'string' && LENS_BY_KEY.has(SHELL_PREFIX + id);
}

/** The lens that a physics key names, or undefined when the key names no lens. */
export function floodlightLensByKey(key: string | undefined): LensInfo | undefined {
  return key === undefined ? undefined : LENS_BY_KEY.get(key);
}

/** Damage from a hit at `closingSpeed` (m/s): 0 below minHitSpeed, 1 at breakSpeed. */
export function lampHitDamage(closingSpeed: number): number {
  return Math.max(0, (closingSpeed - FLOODLIGHT.minHitSpeed) / (FLOODLIGHT.breakSpeed - FLOODLIGHT.minHitSpeed));
}

/** The lamp after `damage` lands on frame `frame`. A broken lamp takes no more damage. */
export function damageLamp(lamp: LampState, damage: number, frame: number): LampState {
  if (lamp.brokenAt !== null || damage <= 0) return lamp;
  const total = lamp.damage + damage;
  return total >= 1
    ? { ...lamp, damage: 1, brokenAt: frame }
    : { ...lamp, damage: total, flickerFrame: frame };
}

/** A whole lamp with no damage. */
export function wholeLamp(lampId: string): LampState {
  return { lampId, damage: 0, flickerFrame: NEVER_FRAME, brokenAt: null };
}

export function brokenLampIds(contraptions: Pick<ContraptionState, 'lamps'>): readonly string[] {
  return contraptions.lamps.filter((lamp) => lamp.brokenAt !== null).map((lamp) => lamp.lampId);
}

/** True while lamp `lampId` is broken. Throws for an id that is not a lamp. */
export function isLampBroken(contraptions: Pick<ContraptionState, 'lamps'>, lampId: string): boolean {
  const lamp = contraptions.lamps.find((entry) => entry.lampId === lampId);
  if (!lamp) throw new Error(`WRECK_YARD_LAMP_UNKNOWN: ${lampId}`);
  return lamp.brokenAt !== null;
}

/**
 * The lamps that come back on at `frame`. All four come back when the lights-out
 * time ends. Outside lights out, one broken lamp comes back REPAIR_TICKS after it broke.
 */
export function lampsToRelight(contraptions: Pick<ContraptionState, 'lamps' | 'lightsOutUntil'>, frame: number): readonly string[] {
  if (contraptions.lightsOutUntil !== null) {
    return frame >= contraptions.lightsOutUntil ? brokenLampIds(contraptions) : [];
  }
  return contraptions.lamps.filter((lamp) => lamp.brokenAt !== null && frame - lamp.brokenAt >= REPAIR_TICKS).map((lamp) => lamp.lampId);
}
