import type { YardInput } from '../sim/input';

/** Pitch limit, in radians, the same as the sim's. */
const PITCH_LIMIT = 1.45;

export interface LookAngles {
  readonly yaw: number;
  readonly pitch: number;
}

/** Turns the view by a mouse motion (pixels × radians per pixel). */
export function applyLook(view: LookAngles, movementX: number, movementY: number, sensitivity: number): LookAngles {
  return {
    yaw: view.yaw - movementX * sensitivity,
    pitch: Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, view.pitch - movementY * sensitivity)),
  };
}

/**
 * The tool buttons. A press that started a capture (the click on the canvas
 * after orbit) must not fire the tool, so it is ignored until its release.
 */
export interface ButtonTracker {
  readonly primary: boolean;
  readonly punt: boolean;
  readonly ignorePrimary: boolean;
  readonly ignorePunt: boolean;
}

export const BUTTONS_UP: ButtonTracker = { primary: false, punt: false, ignorePrimary: false, ignorePunt: false };

/** Mouse button 0 is the tool, 2 is punt; others do nothing. */
export function pressButton(tracker: ButtonTracker, button: number, pressed: boolean): ButtonTracker {
  if (button === 0) {
    if (!pressed) return { ...tracker, primary: false, ignorePrimary: false };
    return tracker.ignorePrimary ? tracker : { ...tracker, primary: true };
  }
  if (button === 2) {
    if (!pressed) return { ...tracker, punt: false, ignorePunt: false };
    return tracker.ignorePunt ? tracker : { ...tracker, punt: true };
  }
  return tracker;
}

export function ignoreUntilRelease(tracker: ButtonTracker, button: number): ButtonTracker {
  if (button === 0) return { ...tracker, primary: false, ignorePrimary: true };
  if (button === 2) return { ...tracker, punt: false, ignorePunt: true };
  return tracker;
}

/**
 * The input while the gate or the pause menu shows. A room keeps running, so
 * the view and the tool stay (the avatar does not snap for other players);
 * nothing moves, fires, or thrusts, and a held body is let go.
 */
export function pausedInput(input: YardInput): YardInput {
  return { ...input, pressed: false, secondary: false, use: false, jetpack: false, moveX: 0, moveZ: 0 };
}
