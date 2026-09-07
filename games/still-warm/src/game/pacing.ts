import { OPENING_DURATION } from "./opening";
import type { Phase, Stage } from "./model";

export const OPENING_PROTECTED_SECONDS = OPENING_DURATION;
export const DOOR_FIRST_EVENT_SECONDS = 75;
export const DOOR_PRESSURE_INTERVAL_SECONDS = 60;
export const DOOR_MAX_PRESSURE = 3;
export const FIRE_FALLBACK_SECONDS = 240;
export const FIRE_ONSET = 15;
export const FIRE_GROWTH_PER_SECOND = 0.3;
export const FIRE_SEVERE_THRESHOLD = 50;
export const FIRE_HEALTH_DAMAGE_PER_SECOND = 0.08;

export function openingActiveSeconds(elapsed: number, dt: number): number {
  const start = Math.max(0, elapsed);
  const end = Math.max(start, start + Math.max(0, dt));
  return Math.max(0, end - Math.max(start, OPENING_PROTECTED_SECONDS));
}

export function canStartDoor(
  elapsed: number,
  lanternLit: boolean,
  stage: Stage,
): boolean {
  return (
    elapsed >= DOOR_FIRST_EVENT_SECONDS && lanternLit && stage !== "pinned"
  );
}

export function canStartFire(
  elapsed: number,
  stage: Stage,
  phase: Phase,
): boolean {
  if (phase !== "playing" || stage === "pinned") return false;
  return (
    stage === "extracted" ||
    stage === "closed" ||
    stage === "dressed" ||
    elapsed >= FIRE_FALLBACK_SECONDS
  );
}
