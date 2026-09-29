import { FLOOR_Y, TANK, VEHICLE_RAMP_PITCH } from './constants';

type Vec3Tuple = [number, number, number];

/**
 * A static collision box. `rotation` is an XYZ Euler angle in radians (three.js
 * order). `surfaceVelocity` (m/s) makes it a conveyor: bodies on it are carried.
 */
export interface ShellBox {
  readonly id: string;
  readonly center: Vec3Tuple;
  readonly size: Vec3Tuple;
  readonly rotation?: readonly [number, number, number];
  readonly surfaceVelocity?: Vec3Tuple;
}

/** Corner floodlight masts (x, z). Each mast turns to face the yard center. */
export const FLOODLIGHT_MASTS: readonly (readonly [number, number])[] = [[-21.5, -21], [21.5, -21], [-21.5, 21], [21.5, 21]];
export const MAST_LAMP_HEIGHT = 11.2;
export function mastYaw(x: number, z: number): number {
  return Math.atan2(-x, -z);
}

/** The stunt ramp deck. Its collider and the drawn deck share these numbers. */
export const VEHICLE_RAMP = { center: [14.0, FLOOR_Y + 0.45, 0.0] as Vec3Tuple, size: [4.8, 0.12, 6.0] as Vec3Tuple, pitch: VEHICLE_RAMP_PITCH };
const [RAMP_X, RAMP_Y, RAMP_Z] = VEHICLE_RAMP.size;

/** Ramp trim in the ramp frame. Curbs sit inset from the deck edges: flush faces z-fight. */
export const RAMP_TRIM = {
  stripe: { center: [0, RAMP_Y / 2 + 0.01, 0] as Vec3Tuple, size: [1.2, 0.02, RAMP_Z - 0.1] as Vec3Tuple },
  curbs: [-1, 1].map((side) => ({ center: [side * (RAMP_X / 2 - 0.13), 0.14, 0] as Vec3Tuple, size: [0.2, 0.22, RAMP_Z - 0.06] as Vec3Tuple })),
};

/** Open frame of four boxes around a width x depth opening, centered on the origin. */
export function openTankFrameBoxes(width: number, depth: number, thickness: number, height: number): { center: Vec3Tuple; size: Vec3Tuple }[] {
  return [
    { center: [0, 0, -(depth + thickness) / 2], size: [width + thickness * 2, height, thickness] },
    { center: [0, 0, (depth + thickness) / 2], size: [width + thickness * 2, height, thickness] },
    { center: [-(width + thickness) / 2, 0, 0], size: [thickness, height, depth] },
    { center: [(width + thickness) / 2, 0, 0], size: [thickness, height, depth] },
  ];
}
/** Walkable concrete rim around the water tank. */
export const TANK_RIM = { thickness: 0.4, height: 0.1, centerY: TANK.surfaceY + 0.05 };

/** Crane group origin: the gantry beams run along X at this height. */
const CRANE: Vec3Tuple = [0, FLOOR_Y + 8.8, -1.5];
const RIG: Vec3Tuple = [-5, FLOOR_Y, -17];
const HOPPER: Vec3Tuple = [-12, FLOOR_Y + 2.5, 12];

const box = (id: string, center: Vec3Tuple, size: Vec3Tuple, rotation?: readonly [number, number, number]): ShellBox =>
  rotation ? { id: `set-${id}`, center, size, rotation } : { id: `set-${id}`, center, size };
const at = (origin: Vec3Tuple, offset: Vec3Tuple): Vec3Tuple => [origin[0] + offset[0], origin[1] + offset[1], origin[2] + offset[2]];

/**
 * Collision for the static set pieces drawn in render/YardShell.tsx. The
 * numbers mirror the drawn geometry. Movable props are dynamic bodies
 * (sim/props.ts), not set pieces. scripts/audit-collision.mjs fails when a
 * solid-looking mesh has no collider, so a new or moved set piece must update
 * this list.
 */
export const SET_PIECE_COLLIDERS: readonly ShellBox[] = [
  // West loading deck and its divider bays. Props on it are dynamic (sim/props.ts).
  box('deck', [-21, FLOOR_Y + 0.5, 0], [6, 1.0, 30]),
  ...[-12, -4, 4, 12].map((z) => box(`bay-${z}`, [-19.5, FLOOR_Y + 0.6, z], [5.0, 1.2, 0.4])),

  // Gantry crane: two bridge beams, gussets, left A-frame, right column, cab, trolley, hook.
  box('crane-beam-north', at(CRANE, [0, 0.05, -1.5]), [52, 1.1, 0.65]),
  box('crane-beam-south', at(CRANE, [0, 0.05, 1.5]), [52, 1.1, 0.65]),
  box('crane-gusset-west', at(CRANE, [-11.5, -1.4, 0]), [3.2, 0.45, 1.2], [0, 0, Math.PI / 4]),
  box('crane-gusset-east', at(CRANE, [11.5, -1.4, 0]), [3.2, 0.45, 1.2], [0, 0, -Math.PI / 4]),
  box('crane-leg-north', at(CRANE, [-13.5, -4.4, -2.2]), [0.9, 9.0, 0.9], [-0.14, 0, 0]),
  box('crane-leg-south', at(CRANE, [-13.5, -4.4, 2.2]), [0.9, 9.0, 0.9], [0.14, 0, 0]),
  // X-braces between the legs: a player cannot pass through the lattice.
  ...[-1.8, 0.6, 2.6].map((y) => box(`crane-brace-${y}`, at(CRANE, [-13.5, -4.4 + y, 0]), [0.6, 2.6, 3.4])),
  box('crane-bogie', at(CRANE, [-13.5, -8.6, 0]), [1.4, 0.7, 5.4]),
  box('crane-column-east', at(CRANE, [24.8, -4.4, 0]), [1.2, 9.0, 3.6]),
  box('crane-column-strut', at(CRANE, [23.6, -1.2, 0]), [0.3, 3.0, 0.3], [0, 0, 0.6]),
  box('crane-cab', at(CRANE, [-11.5, -1.5, -1.5]), [2.4, 2.0, 2.0]),
  box('crane-trolley', at(CRANE, [3.5, -0.3, 0]), [2.8, 0.6, 3.2]),
  box('crane-cable-west', at(CRANE, [2.9, -2.6, 0]), [0.12, 4.6, 0.12]),
  box('crane-cable-east', at(CRANE, [4.1, -2.6, 0]), [0.12, 4.6, 0.12]),
  box('crane-hook-block', at(CRANE, [3.5, -5.0, 0]), [1.1, 0.9, 0.9]),
  box('crane-hook', at(CRANE, [3.5, -5.6, 0]), [1.0, 0.9, 0.3]),

  // Floodlight masts: concrete pier, pole, and lamp head.
  ...FLOODLIGHT_MASTS.flatMap(([x, z]) => {
    const yaw = mastYaw(x, z);
    return [
      box(`mast-pier-${x}-${z}`, [x, FLOOR_Y + 0.6, z], [2.0, 1.2, 2.0], [0, yaw, 0]),
      box(`mast-pole-${x}-${z}`, [x, FLOOR_Y + 5.5, z], [0.6, 11, 0.6], [0, yaw, 0]),
      box(`mast-head-${x}-${z}`, [x + Math.sin(yaw) * 0.2, FLOOR_Y + MAST_LAMP_HEIGHT, z + Math.cos(yaw) * 0.2], [2.4, 0.8, 1.0], [0, yaw, 0]),
    ];
  }),

  // Ball hopper: basket rims on three sides (open toward the chute) and the chute.
  box('hopper-rim-south', at(HOPPER, [0, 2.9, 1.95]), [3.9, 0.8, 0.1], [-0.25, 0, 0]),
  box('hopper-rim-north', at(HOPPER, [0, 2.9, -1.95]), [3.9, 0.8, 0.1], [0.25, 0, 0]),
  box('hopper-rim-west', at(HOPPER, [-1.95, 2.9, 0]), [0.1, 0.8, 3.9], [0, 0, 0.25]),
  box('hopper-chute', at(HOPPER, [2.5, 1.4, 0]), [2.8, 0.12, 1.4], [0, 0, -0.42]),
  // Chute side rails keep the balls in the chute (rail center rotated with the chute).
  ...[-0.65, 0.65].map((z) => box(`hopper-chute-rail-${z}`, at(HOPPER, [2.5 + 0.22 * Math.sin(0.42), 1.4 + 0.22 * Math.cos(0.42), z]), [2.8, 0.32, 0.08], [0, 0, -0.42])),

  // Demolition rig: tracked carriage, boom, and torch head. Its work beam and target car are props.
  box('rig-carriage', at(RIG, [0, 0.42, 0]), [3.6, 0.84, 3.2]),
  box('rig-boom', at(RIG, [-1.7, 1.5, 0]), [2.2, 0.35, 0.35], [0, 0, 0.6]),
  box('rig-arm', at(RIG, [-2.7, 1.2, 0]), [1.6, 0.28, 0.28], [0, 0, -0.4]),
  box('rig-hydraulic', at(RIG, [-1.5, 1.15, 0.22]), [0.12, 1.4, 0.12], [0, 0, 0.5]),
  box('rig-torch-head', at(RIG, [-3.4, 0.7, 0]), [0.4, 0.3, 0.3]),

  // Tank rim, curbs on the stunt ramp.
  ...openTankFrameBoxes(TANK.innerSize[0], TANK.innerSize[2], TANK_RIM.thickness, TANK_RIM.height).map((part, index) =>
    box(`tank-rim-${index}`, [TANK.center[0] + part.center[0], TANK_RIM.centerY, TANK.center[2] + part.center[2]], part.size)),
  ...RAMP_TRIM.curbs.map((curb, index) => {
    const [x, y, z] = curb.center;
    const c = Math.cos(VEHICLE_RAMP.pitch);
    const s = Math.sin(VEHICLE_RAMP.pitch);
    return box(`ramp-curb-${index}`, at(VEHICLE_RAMP.center, [x, y * c - z * s, y * s + z * c]), curb.size, [VEHICLE_RAMP.pitch, 0, 0]);
  }),
];
