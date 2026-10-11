import { DT, FLOOR_Y, GRAVITY } from './constants';
import type { Vec3 } from './math';
import type { ShellBox } from './setPieces';
import type { ContraptionState } from './state';

/**
 * Yard contraptions: the dunk hoop and its score sign, the sky conveyor that
 * drops fuel drums, and the catapult that lobs whatever sits in its bucket
 * at the hoop. Geometry lives here once; the colliders, the simulation rules,
 * and render/Contraptions.tsx all read it.
 */

type Vec3Tuple = [number, number, number];

// ---------------------------------------------------------------------------
// Dunk hoop on the north wall.

export const HOOP = {
  /** Center of the ring. */
  center: [13, FLOOR_Y + 4.6, -22.6] as Vec3Tuple,
  /** Radius of the ring tube's center line. */
  ringRadius: 1.32,
  /** A body center that passes down inside this radius scores. */
  scoreRadius: 1.2,
  tube: 0.12,
  segments: 16,
  backboard: { center: [13, FLOOR_Y + 5.5, -24.25] as Vec3Tuple, size: [3.6, 2.4, 0.2] as Vec3Tuple },
  pole: { center: [13, FLOOR_Y + 3.35, -25.2] as Vec3Tuple, size: [0.36, 6.7, 0.36] as Vec3Tuple },
} as const;

export const DUNK_SIGN = {
  panel: { center: [18.5, FLOOR_Y + 5.6, -25.05] as Vec3Tuple, size: [4.6, 2.6, 0.3] as Vec3Tuple },
  posts: [16.8, 20.2].map((x) => ({ center: [x, FLOOR_Y + 2.15, -25.05] as Vec3Tuple, size: [0.3, 4.3, 0.3] as Vec3Tuple })),
} as const;

/**
 * True when a body center moved down through the hoop plane between two ticks
 * and crossed it inside the ring.
 */
export function crossedHoop(before: Vec3, after: Vec3): boolean {
  const plane = HOOP.center[1];
  if (!(before[1] > plane && after[1] <= plane)) return false;
  const t = (before[1] - plane) / (before[1] - after[1]);
  const x = before[0] + (after[0] - before[0]) * t - HOOP.center[0];
  const z = before[2] + (after[2] - before[2]) * t - HOOP.center[2];
  return x * x + z * z < HOOP.scoreRadius * HOOP.scoreRadius;
}

/** Only bodies near the hoop can score this tick; skips the rest cheaply. */
export function nearHoop(position: Vec3): boolean {
  const dx = position[0] - HOOP.center[0];
  const dz = position[2] - HOOP.center[2];
  return dx * dx + dz * dz < 4 * 4 && position[1] > HOOP.center[1] - 2 && position[1] < HOOP.center[1] + 12;
}

// ---------------------------------------------------------------------------
// Sky conveyor: comes in over the north wall and drops fuel drums into the yard.

export const CONVEYOR = {
  x: 0.2,
  /** Top surface of the belt. */
  topY: FLOOR_Y + 6.5,
  /** The belt runs from zStart (outside the wall) toward +Z and ends at zEnd. */
  zStart: -46,
  zEnd: -15,
  width: 1.6,
  /** Belt speed toward +Z (m/s). */
  speed: 3.5,
  legZ: [-22.5, -16.5] as const,
} as const;

/** Drums appear under the transfer housing outside the wall. */
export const DRUM_SPAWN: Vec3 = [CONVEYOR.x, CONVEYOR.topY + 0.52, -27.6];
/** Ticks between two drums, so one drum clears the spawn point first. */
export const DROP_COOLDOWN_TICKS = 45;
/** Drums the conveyor keeps in the yard; the oldest unlit drum goes when a new one comes. */
export const MAX_DROPPED_DRUMS = 8;


// ---------------------------------------------------------------------------
// Catapult at the south wall, aimed at the hoop.

export const CATAPULT = {
  /** Axle the arm turns on. The arm throws toward -Z. */
  axle: [8.5, FLOOR_Y + 1.9, 21.2] as Vec3Tuple,
  /** Bucket floor center (top surface) at rest. */
  bucket: [8.5, FLOOR_Y + 0.95, 24.1] as Vec3Tuple,
  /** Inside half size of the bucket, in X and Z. */
  bucketHalf: 0.8,
  wallHeight: 0.4,
  /** Flight time of the lob to the hoop (s). */
  flightTime: 2.8,
  /** Launched bodies rise this far first, so the bucket rim cannot catch them. */
  launchLift: 0.45,
  /** Ticks between two launches; the arm animation fits inside. */
  cooldownTicks: 60,
} as const;

/** A body with its center in this volume sits in the catapult bucket. */
export function inCatapultBucket(position: Vec3): boolean {
  const [bx, by, bz] = CATAPULT.bucket;
  return Math.abs(position[0] - bx) < CATAPULT.bucketHalf + 0.1
    && Math.abs(position[2] - bz) < CATAPULT.bucketHalf + 0.1
    && position[1] > by && position[1] < by + 2.5;
}

/** Ticks of the lob; the launch aims to reach the hoop on this tick. */
export const CATAPULT_FLIGHT_TICKS = Math.round(CATAPULT.flightTime / DT);

/** Aim point: the hoop center, so the body drops through the ring on the way down. */
export const CATAPULT_TARGET: Vec3 = HOOP.center;

/**
 * Launch velocity (m/s) that carries a body from `from` to the hoop in
 * CATAPULT_FLIGHT_TICKS ticks with no damping. The solver integrates
 * semi-implicitly (velocity first), so after n ticks
 * y = y0 + n·dt·vy - g·dt²·n(n+1)/2; this solves that for vy exactly.
 */
export function catapultLaunchVelocity(from: Vec3): Vec3 {
  const n = CATAPULT_FLIGHT_TICKS;
  const time = n * DT;
  const fall = GRAVITY * DT * DT * n * (n + 1) * 0.5;
  return [
    (CATAPULT_TARGET[0] - from[0]) / time,
    (CATAPULT_TARGET[1] - from[1] + fall) / time,
    (CATAPULT_TARGET[2] - from[2]) / time,
  ];
}

/** Launched bodies fly undamped this long, then get normal damping back. */
export const BALLISTIC_TICKS = CATAPULT_FLIGHT_TICKS + 45;
/** Linear damping during the flight: Syncplay damping is the velocity kept per tick, so 1 is none. */
export const BALLISTIC_DAMPING = 1;

// ---------------------------------------------------------------------------
// Buttons: press E within reach, or click one with the gravity gun.

export type ButtonId = 'dropper' | 'catapult';

export interface ButtonSpec {
  readonly id: ButtonId;
  readonly label: string;
  /** Floor point under the pedestal. */
  readonly base: Vec3Tuple;
}

export const BUTTONS: readonly ButtonSpec[] = [
  { id: 'dropper', label: 'DRUMS', base: [3.2, FLOOR_Y, -11] },
  { id: 'catapult', label: 'LAUNCH', base: [11.2, FLOOR_Y, 21.8] },
];

export const BUTTON_PEDESTAL = { size: [0.7, 1.0, 0.7] as Vec3Tuple, capRadius: 0.26, capHeight: 0.14 } as const;
/** Horizontal reach (m) from the player to a button for E. */
export const BUTTON_REACH = 2.6;

/** Ticks a button stays down after a press: its contraption's reset time. */
export const BUTTON_RESET_TICKS: Readonly<Record<ButtonId, number>> = { dropper: DROP_COOLDOWN_TICKS, catapult: CATAPULT.cooldownTicks };

/**
 * Share of a button's reset time still to run: 1 on the press, 0 when it can
 * be pressed again. The sim refuses a press while it is above 0, and the
 * button stays down while it runs.
 */
export function buttonResetLeft(id: ButtonId, contraptions: ContraptionState, frame: number): number {
  const pressed = id === 'dropper' ? contraptions.lastDropFrame : contraptions.lastLaunchFrame;
  return Math.max(0, 1 - (frame - pressed) / BUTTON_RESET_TICKS[id]);
}

/** The button the player can press with E, if any. Player y is the lower capsule sphere center. */
export function buttonWithinReach(player: Vec3): ButtonId | null {
  for (const button of BUTTONS) {
    const dx = player[0] - button.base[0];
    const dz = player[2] - button.base[2];
    if (dx * dx + dz * dz < BUTTON_REACH * BUTTON_REACH && Math.abs(player[1] - button.base[1]) < 2.5) return button.id;
  }
  return null;
}

/** The button whose pedestal or cap contains this ray hit point, if any. */
export function buttonAt(point: Vec3): ButtonId | null {
  const [sx, sy, sz] = BUTTON_PEDESTAL.size;
  for (const button of BUTTONS) {
    if (Math.abs(point[0] - button.base[0]) <= sx / 2 + 0.05
      && Math.abs(point[2] - button.base[2]) <= sz / 2 + 0.05
      && point[1] >= button.base[1] - 0.05 && point[1] <= button.base[1] + sy + BUTTON_PEDESTAL.capHeight + 0.05) return button.id;
  }
  return null;
}

export function buttonTop(id: ButtonId): Vec3 {
  const button = BUTTONS.find((entry) => entry.id === id)!;
  return [button.base[0], button.base[1] + BUTTON_PEDESTAL.size[1] + BUTTON_PEDESTAL.capHeight, button.base[2]];
}

// ---------------------------------------------------------------------------
// Static collision for everything above. render/Contraptions.tsx draws the same boxes.

const box = (id: string, center: Vec3Tuple, size: Vec3Tuple, rotation?: readonly [number, number, number]): ShellBox =>
  rotation ? { id: `set-${id}`, center, size, rotation } : { id: `set-${id}`, center, size };

function ringSegments(): ShellBox[] {
  const [cx, cy, cz] = HOOP.center;
  const length = 2 * Math.PI * HOOP.ringRadius / HOOP.segments + 0.04;
  return Array.from({ length: HOOP.segments }, (_, index) => {
    const angle = (index / HOOP.segments) * Math.PI * 2;
    // A box's local X turned by yaw (π/2 - angle) runs along the ring tangent.
    return box(`hoop-ring-${index}`, [cx + Math.cos(angle) * HOOP.ringRadius, cy, cz + Math.sin(angle) * HOOP.ringRadius],
      [length, HOOP.tube * 2, HOOP.tube * 2], [0, Math.PI / 2 - angle, 0]);
  });
}

const [axleX, axleY, axleZ] = CATAPULT.axle;
const [bucketX, bucketY, bucketZ] = CATAPULT.bucket;
const bucketOuter = CATAPULT.bucketHalf * 2 + 0.2;
/** The arm at rest runs from the axle down and back to the bucket's front wall. */
const ARM_END: Vec3Tuple = [axleX, bucketY + 0.1, bucketZ - CATAPULT.bucketHalf - 0.05];
const ARM_REST = {
  center: [axleX, (axleY + ARM_END[1]) / 2, (axleZ + ARM_END[2]) / 2] as Vec3Tuple,
  length: Math.hypot(axleY - ARM_END[1], ARM_END[2] - axleZ) + 0.15,
  /** Rotation about X: the arm's local +Z points down toward the bucket. */
  pitch: Math.atan2(axleY - ARM_END[1], ARM_END[2] - axleZ),
};
export const CATAPULT_ARM_REST = ARM_REST;

export const CONTRAPTION_COLLIDERS: readonly ShellBox[] = [
  // Hoop: ring, rim bracket, backboard, pole, and the arm from pole to backboard.
  ...ringSegments(),
  box('hoop-bracket', [HOOP.center[0], HOOP.center[1], HOOP.center[2] - HOOP.ringRadius - 0.25], [0.4, 0.16, 0.5]),
  box('hoop-backboard', HOOP.backboard.center, HOOP.backboard.size),
  box('hoop-pole', HOOP.pole.center, HOOP.pole.size),
  box('hoop-pole-arm', [HOOP.center[0], HOOP.backboard.center[1], -24.75], [0.3, 0.3, 0.8]),
  box('dunk-sign', DUNK_SIGN.panel.center, DUNK_SIGN.panel.size),
  ...DUNK_SIGN.posts.map((post, index) => box(`dunk-sign-post-${index}`, post.center, post.size)),

  // Conveyor: belt deck (frame and rollers inside it), side rails, legs, feeder housing.
  {
    ...box('conveyor-belt', [CONVEYOR.x, CONVEYOR.topY - 0.15, (CONVEYOR.zStart + CONVEYOR.zEnd) / 2], [CONVEYOR.width + 0.2, 0.3, CONVEYOR.zEnd - CONVEYOR.zStart]),
    surfaceVelocity: [0, 0, CONVEYOR.speed],
  },
  ...[-1, 1].map((side) => box(`conveyor-rail-${side}`, [CONVEYOR.x + side * (CONVEYOR.width / 2 + 0.12), CONVEYOR.topY + 0.2, (CONVEYOR.zStart + CONVEYOR.zEnd) / 2], [0.12, 0.5, CONVEYOR.zEnd - CONVEYOR.zStart])),
  ...CONVEYOR.legZ.flatMap((z) => [-1, 1].map((side) => box(`conveyor-leg-${z}-${side}`,
    [CONVEYOR.x + side * 0.9, (FLOOR_Y + CONVEYOR.topY - 0.3) / 2, z], [0.28, CONVEYOR.topY - 0.3 - FLOOR_Y, 0.28]))),
  ...CONVEYOR.legZ.map((z) => box(`conveyor-crossbar-${z}`, [CONVEYOR.x, CONVEYOR.topY - 0.45, z], [2.1, 0.2, 0.3])),
  box('conveyor-feeder-roof', [CONVEYOR.x, CONVEYOR.topY + 2.1, -28], [2.4, 0.2, 2.2]),
  ...[-1, 1].map((side) => box(`conveyor-feeder-wall-${side}`, [CONVEYOR.x + side * 1.1, CONVEYOR.topY + 1.0, -28], [0.2, 2.2, 2.2])),

  // Catapult: base rails, uprights, stop bar, arm at rest, bucket, and the rest block under it.
  ...[-1, 1].map((side) => box(`catapult-rail-${side}`, [axleX + side * 1.25, FLOOR_Y + 0.15, 22.6], [0.3, 0.3, 5.4])),
  ...[-1, 1].map((side) => box(`catapult-upright-${side}`, [axleX + side * 1.25, (FLOOR_Y + axleY + 0.9) / 2, axleZ], [0.3, axleY + 0.9 - FLOOR_Y, 0.3])),
  box('catapult-stop-bar', [axleX, axleY + 0.75, axleZ - 0.25], [2.8, 0.25, 0.25]),
  box('catapult-axle', [axleX, axleY, axleZ], [2.5, 0.16, 0.16]),
  box('catapult-arm', ARM_REST.center, [0.3, 0.3, ARM_REST.length], [ARM_REST.pitch, 0, 0]),
  box('catapult-bucket-floor', [bucketX, bucketY - 0.06, bucketZ], [bucketOuter, 0.12, bucketOuter]),
  ...[-1, 1].map((side) => box(`catapult-bucket-wall-x${side}`, [bucketX + side * (CATAPULT.bucketHalf + 0.05), bucketY + CATAPULT.wallHeight / 2, bucketZ], [0.1, CATAPULT.wallHeight, bucketOuter])),
  ...[-1, 1].map((side) => box(`catapult-bucket-wall-z${side}`, [bucketX, bucketY + CATAPULT.wallHeight / 2, bucketZ + side * (CATAPULT.bucketHalf + 0.05)], [bucketOuter, CATAPULT.wallHeight, 0.1])),
  box('catapult-rest', [bucketX, (FLOOR_Y + bucketY - 0.12) / 2, bucketZ], [0.9, bucketY - 0.12 - FLOOR_Y, 0.9]),

  // Button pedestals.
  ...BUTTONS.map((button) => box(`button-${button.id}`,
    [button.base[0], button.base[1] + (BUTTON_PEDESTAL.size[1] + BUTTON_PEDESTAL.capHeight) / 2, button.base[2]],
    [BUTTON_PEDESTAL.size[0], BUTTON_PEDESTAL.size[1] + BUTTON_PEDESTAL.capHeight, BUTTON_PEDESTAL.size[2]])),
];
