/**
 * Joystick input logic from game-bot:
 * modules/two-d/virtual-joystick/src/VirtualJoystick.ts.
 * Tracks pointer owners, position, dead zone, and speed limits.
 * The caller supplies pointer events. This class has no DOM access.
 */

export type JoystickHalf = "left" | "right";

export interface JoystickConfig {
  /** Pixel radius the unit-magnitude vector maps to. */
  baseRadiusPx?: number;
  /** Magnitudes below this collapse to (0, 0). Default 0.05. */
  deadzone?: number;
  /** Linear scalar applied to magnitude before clamping. Default 1.0. */
  sensitivity?: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

interface AnchorState {
  pointerId: number | null;
  origin: Vec2;
  current: Vec2;
}

const DEFAULT_BASE_RADIUS_PX = 100;
const DEFAULT_DEADZONE = 0.05;
const DEFAULT_SENSITIVITY = 1.0;

export class VirtualJoystick {
  private baseRadiusPx: number;
  private deadzone: number;
  private sensitivityScalar: number;

  private readonly state: Record<JoystickHalf, AnchorState> = {
    left: { pointerId: null, origin: { x: 0, y: 0 }, current: { x: 0, y: 0 } },
    right: { pointerId: null, origin: { x: 0, y: 0 }, current: { x: 0, y: 0 } },
  };

  constructor(config: JoystickConfig = {}) {
    this.baseRadiusPx = config.baseRadiusPx ?? DEFAULT_BASE_RADIUS_PX;
    this.deadzone = config.deadzone ?? DEFAULT_DEADZONE;
    this.sensitivityScalar = config.sensitivity ?? DEFAULT_SENSITIVITY;
  }

  /**
   * Try to anchor `half` at `pos` with `pointerId`. Returns true on success,
   * false when the half is already anchored (anchor lock).
   */
  onTouchStart(half: JoystickHalf, pos: Vec2, pointerId: number): boolean {
    const s = this.state[half];
    if (s.pointerId !== null) return false;
    s.pointerId = pointerId;
    s.origin = { x: pos.x, y: pos.y };
    s.current = { x: pos.x, y: pos.y };
    return true;
  }

  /** Update the active touch position for whichever half owns `pointerId`. */
  onTouchMove(pointerId: number, pos: Vec2): void {
    const half = this.halfFor(pointerId);
    if (half === null) return;
    this.state[half].current = { x: pos.x, y: pos.y };
  }

  /** Release the half owned by `pointerId` (if any). */
  onTouchEnd(pointerId: number): void {
    const half = this.halfFor(pointerId);
    if (half === null) return;
    const s = this.state[half];
    s.pointerId = null;
    s.origin = { x: 0, y: 0 };
    s.current = { x: 0, y: 0 };
  }

  /**
   * Normalised stick vector for `half`, magnitude in [0, 1] after deadzone +
   * sensitivity + clamp. Returns (0, 0) when the half is not anchored.
   */
  vector(half: JoystickHalf): Vec2 {
    const s = this.state[half];
    if (s.pointerId === null) return { x: 0, y: 0 };

    const dx = s.current.x - s.origin.x;
    const dy = s.current.y - s.origin.y;
    // Normalise by base radius first so 1.0 = "stick fully extended".
    const nx = dx / this.baseRadiusPx;
    const ny = dy / this.baseRadiusPx;
    const rawMag = Math.hypot(nx, ny);

    // Deadzone applied to the raw normalised magnitude (per prd.md).
    if (rawMag < this.deadzone) return { x: 0, y: 0 };

    // Sensitivity scales magnitude (not direction) before clamp.
    const scaledMag = rawMag * this.sensitivityScalar;
    const clampedMag = Math.min(scaledMag, 1);

    // Re-project to the original direction at the new magnitude.
    const ux = nx / rawMag;
    const uy = ny / rawMag;
    return { x: ux * clampedMag, y: uy * clampedMag };
  }

  /** Anchor origin (start touch position) for `half`. */
  anchorPosition(half: JoystickHalf): Vec2 {
    return { x: this.state[half].origin.x, y: this.state[half].origin.y };
  }

  /** Whether `half` currently owns an active touch. */
  anchored(half: JoystickHalf): boolean {
    return this.state[half].pointerId !== null;
  }

  /** Update the sensitivity scalar at runtime. */
  setSensitivity(sensitivity: number): void {
    this.sensitivityScalar = sensitivity;
  }

  private halfFor(pointerId: number): JoystickHalf | null {
    if (this.state.left.pointerId === pointerId) return "left";
    if (this.state.right.pointerId === pointerId) return "right";
    return null;
  }
}
