import { makeEmptyVoxelField, stampBox, stampSphere, type VoxelDims } from 'voxel-kit';
import { FLOOR_Y, getTerrainHeightAt, TANK, VOXEL_SIZE } from './constants';
import { IDENTITY_QUAT, type Quat, type Vec3 } from './math';
import { createWorld, makePhysicsBody } from './physics';
import { DECK_HEIGHT, yardProps } from './props';
import { createInitialPlayer, INITIAL_CONTRAPTIONS, type AnchorFace, type BodyMotion, type YardBody, type YardState } from './state';

type VolumePreset = { dims: VoxelDims; voxels: Uint8Array };

/** Yaw 0.08 rad and -0.14 rad as literals, so no trig runs in the simulation. */
const YAW_POS_008: Quat = [0, 0.03998933418663416, 0, 0.9992001066609779];
const YAW_NEG_014: Quat = [0, -0.06994284733753277, 0, 0.9975510002532796];

function makeSteelCase(): VolumePreset {
  const dims = { x: 18, y: 12, z: 12 };
  const voxels = makeEmptyVoxelField(dims);
  stampBox(voxels, dims, { x: 0, y: 0, z: 0 }, { x: 17, y: 11, z: 11 }, 3);
  stampBox(voxels, dims, { x: 2, y: 2, z: 2 }, { x: 15, y: 9, z: 9 }, 0);
  stampBox(voxels, dims, { x: 1, y: 1, z: 1 }, { x: 16, y: 2, z: 10 }, 4);
  stampBox(voxels, dims, { x: 1, y: 9, z: 1 }, { x: 16, y: 10, z: 10 }, 4);
  stampBox(voxels, dims, { x: 1, y: 2, z: 1 }, { x: 2, y: 9, z: 10 }, 4);
  stampBox(voxels, dims, { x: 15, y: 2, z: 1 }, { x: 16, y: 9, z: 10 }, 4);
  stampBox(voxels, dims, { x: 8, y: 2, z: 1 }, { x: 9, y: 9, z: 10 }, 4);
  return { dims, voxels };
}

/**
 * Pallets stand on one full bottom board. On three separate runners, the light
 * flat pallet jitters at ~0.04 m/s and never sleeps (Syncplay 6.0.0-rc.13, #4861
 * follow-up), and it keeps what rests on it awake too.
 */
function makeTimberPallet(): VolumePreset {
  const dims = { x: 16, y: 10, z: 12 };
  const voxels = makeEmptyVoxelField(dims);
  stampBox(voxels, dims, { x: 0, y: 0, z: 0 }, { x: 15, y: 0, z: 11 }, 2);
  stampBox(voxels, dims, { x: 0, y: 1, z: 0 }, { x: 15, y: 1, z: 2 }, 2);
  stampBox(voxels, dims, { x: 0, y: 1, z: 5 }, { x: 15, y: 1, z: 6 }, 2);
  stampBox(voxels, dims, { x: 0, y: 1, z: 9 }, { x: 15, y: 1, z: 11 }, 2);
  stampBox(voxels, dims, { x: 1, y: 2, z: 1 }, { x: 4, y: 8, z: 10 }, 2);
  stampBox(voxels, dims, { x: 6, y: 2, z: 1 }, { x: 9, y: 8, z: 10 }, 2);
  stampBox(voxels, dims, { x: 11, y: 2, z: 1 }, { x: 14, y: 8, z: 10 }, 2);
  stampBox(voxels, dims, { x: 0, y: 9, z: 0 }, { x: 15, y: 9, z: 11 }, 4);
  stampBox(voxels, dims, { x: 1, y: 3, z: 3 }, { x: 14, y: 7, z: 4 }, 0);
  stampBox(voxels, dims, { x: 1, y: 3, z: 7 }, { x: 14, y: 7, z: 8 }, 0);
  return { dims, voxels };
}

function makeFloatCrate(): VolumePreset {
  const dims = { x: 14, y: 8, z: 14 };
  const voxels = makeEmptyVoxelField(dims);
  stampBox(voxels, dims, { x: 0, y: 0, z: 0 }, { x: 13, y: 7, z: 13 }, 1);
  stampBox(voxels, dims, { x: 2, y: 2, z: 2 }, { x: 11, y: 5, z: 11 }, 0);
  stampBox(voxels, dims, { x: 1, y: 1, z: 1 }, { x: 12, y: 1, z: 12 }, 4);
  stampBox(voxels, dims, { x: 1, y: 6, z: 1 }, { x: 12, y: 6, z: 12 }, 4);
  stampBox(voxels, dims, { x: 6, y: 2, z: 1 }, { x: 7, y: 5, z: 12 }, 4);
  return { dims, voxels };
}

function makeBallastBlock(): VolumePreset {
  const dims = { x: 12, y: 12, z: 12 };
  const voxels = makeEmptyVoxelField(dims);
  stampBox(voxels, dims, { x: 0, y: 0, z: 0 }, { x: 11, y: 11, z: 11 }, 3);
  stampBox(voxels, dims, { x: 2, y: 5, z: 0 }, { x: 9, y: 6, z: 11 }, 4);
  stampBox(voxels, dims, { x: 5, y: 0, z: 2 }, { x: 6, y: 11, z: 9 }, 4);
  return { dims, voxels };
}

function makeSteelGantry(): VolumePreset {
  const dims = { x: 26, y: 18, z: 8 };
  const voxels = makeEmptyVoxelField(dims);
  stampBox(voxels, dims, { x: 0, y: 0, z: 1 }, { x: 2, y: 17, z: 6 }, 3);
  stampBox(voxels, dims, { x: 3, y: 12, z: 3 }, { x: 4, y: 13, z: 4 }, 4);
  stampBox(voxels, dims, { x: 5, y: 12, z: 2 }, { x: 24, y: 14, z: 5 }, 3);
  stampBox(voxels, dims, { x: 8, y: 6, z: 2 }, { x: 9, y: 11, z: 5 }, 4);
  stampBox(voxels, dims, { x: 17, y: 7, z: 2 }, { x: 18, y: 11, z: 5 }, 4);
  stampBox(voxels, dims, { x: 21, y: 9, z: 1 }, { x: 24, y: 11, z: 6 }, 3);
  return { dims, voxels };
}

function makeSeesawPlank(): VolumePreset {
  const dims = { x: 50, y: 4, z: 12 };
  const voxels = makeEmptyVoxelField(dims);
  stampBox(voxels, dims, { x: 0, y: 0, z: 0 }, { x: 49, y: 3, z: 11 }, 2);
  stampBox(voxels, dims, { x: 2, y: 1, z: 1 }, { x: 47, y: 2, z: 10 }, 4);
  stampBox(voxels, dims, { x: 22, y: 0, z: 0 }, { x: 27, y: 3, z: 11 }, 3); // Pivot steel bracket
  return { dims, voxels };
}

function makeBowlingBall(): VolumePreset {
  const dims = { x: 12, y: 12, z: 12 };
  const voxels = makeEmptyVoxelField(dims);
  stampSphere(voxels, dims, { x: 5.5, y: 5.5, z: 5.5 }, 5.2, 3);
  return { dims, voxels };
}

function makeBowlingPin(): VolumePreset {
  const dims = { x: 6, y: 16, z: 6 };
  const voxels = makeEmptyVoxelField(dims);
  stampBox(voxels, dims, { x: 1, y: 0, z: 1 }, { x: 4, y: 15, z: 4 }, 1);
  stampBox(voxels, dims, { x: 0, y: 1, z: 1 }, { x: 5, y: 9, z: 4 }, 1);
  stampBox(voxels, dims, { x: 1, y: 1, z: 0 }, { x: 4, y: 9, z: 5 }, 1);
  stampBox(voxels, dims, { x: 1, y: 10, z: 1 }, { x: 4, y: 12, z: 4 }, 4);
  return { dims, voxels };
}

/**
 * Dune buggy on a 26 x 18 x 38 grid (0.08 m voxels; front is z = 0). The wheels
 * (sim/vehicle.ts BUGGY_WHEELS, hubs near x = 2 and 23) stand outside a narrow
 * tub on visible suspension arms. Open tube roll cage, low nose, exposed rear
 * engine. Material codes map to the buggy palette in render/VoxelBodies.tsx:
 * 1 orange, 3 white, 4 grey, 5 teal, 6 mustard, 8 ink, 9 lens, 11 metal.
 */
function makeBuggyChassis(): VolumePreset {
  const dims = { x: 26, y: 18, z: 38 };
  const voxels = makeEmptyVoxelField(dims);
  const ORANGE = 1, WHITE = 3, GREY = 4, TEAL = 5, MUSTARD = 6, INK = 8, LENS = 9, METAL = 11;
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, material: number) =>
    stampBox(voxels, dims, { x: x0, y: y0, z: z0 }, { x: x1, y: y1, z: z1 }, material);
  // A one-voxel tube between two cells.
  const tube = (from: readonly [number, number, number], to: readonly [number, number, number], material: number) => {
    const steps = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]), Math.abs(to[2] - from[2]), 1);
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = Math.round(from[0] + (to[0] - from[0]) * t);
      const y = Math.round(from[1] + (to[1] - from[1]) * t);
      const z = Math.round(from[2] + (to[2] - from[2]) * t);
      box(x, y, z, x, y, z, material);
    }
  };
  const mirror = (x: number) => dims.x - 1 - x;

  // Tub: solid belly pan and low side walls carry most of the mass, low down.
  box(5, 0, 3, 20, 2, 34, INK);
  box(5, 3, 11, 6, 5, 25, TEAL);
  box(19, 3, 11, 20, 5, 25, TEAL);

  // Low nose: a teal wedge that narrows and drops toward the front, with a white stripe.
  for (let z = 1; z <= 10; z += 1) {
    const inset = Math.round((10 - z) * 0.35);
    const top = 2 + Math.round(z * 0.3);
    box(6 + inset, 1, z, 19 - inset, top, z, TEAL);
    box(12, top, z, 13, top, z, WHITE);
  }
  // Front bumper tube and round headlights set into the nose.
  box(6, 1, 0, 19, 2, 0, INK);
  for (const x of [8, 16]) {
    box(x, 3, 1, x + 1, 4, 1, LENS);
    box(x - 1, 2, 2, x + 2, 5, 2, INK);
  }

  // Suspension: lower and upper arms out to the hubs, and a mustard coilover per corner.
  for (const [z0, z1] of [[9, 12], [28, 31]] as const) {
    for (const side of [0, 1]) {
      const inner = side === 0 ? 5 : 20;
      const outer = side === 0 ? 2 : 23;
      box(Math.min(inner, outer), 0, z0, Math.max(inner, outer), 0, z1, INK);
      box(Math.min(inner, outer), 2, z0 + 1, Math.max(inner, outer), 2, z1 - 1, INK);
      const hub = side === 0 ? 3 : mirror(3);
      const top = side === 0 ? 6 : mirror(6);
      tube([hub, 1, z0 + 2], [top, 7, z0 + 1], MUSTARD);
    }
  }

  // Seat, steering wheel, and a low dash.
  box(9, 3, 17, 16, 4, 22, INK);
  box(9, 5, 22, 16, 11, 23, INK);
  box(12, 5, 22, 13, 10, 21, ORANGE); // harness
  tube([12, 5, 13], [12, 8, 16], INK);
  box(10, 9, 16, 14, 9, 16, ORANGE);
  box(10, 7, 16, 10, 9, 16, ORANGE);
  box(14, 7, 16, 14, 9, 16, ORANGE);
  box(10, 7, 16, 14, 7, 16, ORANGE);
  box(8, 5, 11, 17, 6, 12, INK);
  box(10, 6, 11, 10, 6, 11, LENS);
  box(15, 6, 11, 15, 6, 11, LENS);

  // Roll cage: main hoop behind the seat, raked front hoop, roof rails, rear braces.
  for (const x of [6, 19]) {
    box(x, 3, 24, x, 14, 24, ORANGE);
    const lean = x === 6 ? 7 : 18;
    tube([x, 3, 10], [lean, 13, 13], ORANGE);
    tube([lean, 13, 13], [x, 14, 24], ORANGE);
    tube([x, 14, 24], [lean, 4, 34], ORANGE);
    tube([x, 6, 11], [x, 6, 24], ORANGE); // side intrusion bar
  }
  box(6, 14, 24, 19, 14, 24, ORANGE);
  box(7, 13, 13, 18, 13, 13, ORANGE);
  tube([6, 4, 24], [19, 13, 24], ORANGE); // diagonal in the main hoop
  // Roof light bar with four lenses.
  box(8, 14, 12, 17, 14, 13, INK);
  for (const x of [8, 11, 14, 17]) box(x, 14, 11, x, 14, 11, LENS);

  // Exposed rear engine: block, valve covers, air filter, exhaust pipes.
  box(8, 3, 27, 17, 7, 33, METAL);
  box(8, 8, 28, 10, 8, 32, ORANGE);
  box(15, 8, 28, 17, 8, 32, ORANGE);
  box(11, 8, 29, 14, 10, 31, MUSTARD);
  for (const x of [9, 16]) {
    tube([x, 4, 33], [x, 5, 36], INK);
    box(x, 5, 37, x, 6, 37, GREY);
  }
  box(7, 4, 34, 18, 4, 35, ORANGE); // rear engine guard

  // Upright spare tire behind the main hoop.
  for (let a = 0; a < 24; a += 1) {
    const angle = (a / 24) * Math.PI * 2;
    const x = Math.round(12.5 + Math.cos(angle) * 3);
    const y = Math.round(12 + Math.sin(angle) * 3);
    box(x, y, 26, x, y, 26, INK);
  }
  box(12, 11, 26, 13, 12, 26, GREY);

  // Buggy materials use the vehicle palette band (material + 15).
  for (let i = 0; i < voxels.length; i += 1) {
    if (voxels[i] !== 0) voxels[i] += 15;
  }

  return { dims, voxels };
}

function makeHazardBarrel(): VolumePreset {
  const dims = { x: 10, y: 14, z: 10 };
  const voxels = makeEmptyVoxelField(dims);
  // Cylindrical drum body
  stampSphere(voxels, dims, { x: 4.5, y: 6.5, z: 4.5 }, 4.6, 1);
  // Chime reinforcement rings top, mid, bottom
  stampBox(voxels, dims, { x: 0, y: 0, z: 0 }, { x: 9, y: 1, z: 9 }, 3);
  stampBox(voxels, dims, { x: 0, y: 6, z: 0 }, { x: 9, y: 7, z: 9 }, 3);
  stampBox(voxels, dims, { x: 0, y: 12, z: 0 }, { x: 9, y: 13, z: 9 }, 3);
  // Yellow hazard warning stripe
  stampBox(voxels, dims, { x: 0, y: 4, z: 0 }, { x: 9, y: 5, z: 9 }, 4);
  stampBox(voxels, dims, { x: 0, y: 8, z: 0 }, { x: 9, y: 9, z: 9 }, 4);
  return { dims, voxels };
}

function makeBuoyantFloatDrum(): VolumePreset {
  const dims = { x: 10, y: 10, z: 10 };
  const voxels = makeEmptyVoxelField(dims);
  stampSphere(voxels, dims, { x: 4.5, y: 4.5, z: 4.5 }, 4.4, 4);
  stampBox(voxels, dims, { x: 0, y: 0, z: 0 }, { x: 9, y: 1, z: 9 }, 3);
  stampBox(voxels, dims, { x: 0, y: 8, z: 0 }, { x: 9, y: 9, z: 9 }, 3);
  return { dims, voxels };
}

function makeDestructibleTower(): VolumePreset {
  const dims = { x: 20, y: 44, z: 20 };
  const voxels = makeEmptyVoxelField(dims);
  // 4 corner structural steel columns
  stampBox(voxels, dims, { x: 0, y: 0, z: 0 }, { x: 3, y: 43, z: 3 }, 3);
  stampBox(voxels, dims, { x: 16, y: 0, z: 0 }, { x: 19, y: 43, z: 3 }, 3);
  stampBox(voxels, dims, { x: 0, y: 0, z: 16 }, { x: 3, y: 43, z: 19 }, 3);
  stampBox(voxels, dims, { x: 16, y: 0, z: 16 }, { x: 19, y: 43, z: 19 }, 3);
  // Intermediate floor decks every 11 voxels
  for (const fy of [11, 22, 33, 43]) {
    stampBox(voxels, dims, { x: 0, y: fy - 1, z: 0 }, { x: 19, y: fy, z: 19 }, 1);
  }
  // Cross bracing
  stampBox(voxels, dims, { x: 0, y: 0, z: 8 }, { x: 19, y: 11, z: 11 }, 4);
  stampBox(voxels, dims, { x: 8, y: 12, z: 0 }, { x: 11, y: 22, z: 19 }, 4);
  stampBox(voxels, dims, { x: 0, y: 23, z: 8 }, { x: 19, y: 33, z: 11 }, 4);
  return { dims, voxels };
}

function makeFlatPallet(): VolumePreset {
  // 1.2 x 0.24 x 1.2 m shipping pallet: a full bottom board (see
  // makeTimberPallet), three runners, and a slatted top deck.
  const dims = { x: 15, y: 3, z: 15 };
  const voxels = makeEmptyVoxelField(dims);
  stampBox(voxels, dims, { x: 0, y: 0, z: 0 }, { x: 14, y: 0, z: 14 }, 2);
  for (const z of [0, 6, 12]) stampBox(voxels, dims, { x: 0, y: 1, z }, { x: 14, y: 1, z: z + 2 }, 2);
  for (const x of [0, 3, 6, 9, 12]) stampBox(voxels, dims, { x, y: 2, z: 0 }, { x: x + 2, y: 2, z: 14 }, 2);
  return { dims, voxels };
}

/** Top of the ball-drop platform above the floor (shell box 'ball-drop-platform'). */
const HOPPER_TOP = 5.0;

function restY(dims: { y: number }): number {
  return FLOOR_Y + dims.y * VOXEL_SIZE * 0.5 + 0.01;
}

export interface Spawn {
  readonly body: YardBody;
  readonly position: Vec3;
  readonly rotation: Quat;
}

function spawn(
  id: string,
  label: string,
  preset: VolumePreset,
  position: Vec3,
  buoyancy = 0.2,
  rotation: Quat = IDENTITY_QUAT,
  motion: BodyMotion = 'dynamic',
  anchorFaces: readonly AnchorFace[] = [],
): Spawn {
  return {
    body: { id, label, dims: preset.dims, voxels: preset.voxels, motion, buoyancy, anchorFaces, impactCooldownUntil: 0 },
    position,
    rotation,
  };
}

export function createSpawns(): Spawn[] {
  const steel = makeSteelCase();
  const timber = makeTimberPallet();
  const steelY = restY(steel.dims);
  const timberY = steelY + steel.dims.y * VOXEL_SIZE * 0.5 + timber.dims.y * VOXEL_SIZE * 0.5 + 0.02;
  const ballast = makeBallastBlock();

  const seesaw = makeSeesawPlank();
  const flatPallet = makeFlatPallet();
  const ball = makeBowlingBall();
  const pin = makeBowlingPin();
  const buggy = makeBuggyChassis();
  const tower = makeDestructibleTower();
  const hazard = makeHazardBarrel();
  const floatDrum = makeBuoyantFloatDrum();

  return [
    // Original core set
    spawn('steel-case', 'Steel Case', steel, [-2.35, steelY + 0.4, -1.4], 0.1),
    spawn('timber-pallet', 'Timber Pallet', timber, [-2.35, timberY + 0.4, -1.4], 0.28, YAW_POS_008),
    spawn('steel-gantry', 'Steel Gantry', makeSteelGantry(), [2.18, 1.74, TANK.center[2]], 0.08, IDENTITY_QUAT, 'fixed', ['-x']),
    spawn('float-crate', 'Float Crate', makeFloatCrate(), [TANK.center[0] + 0.35, 0.04, TANK.center[2] + 0.2], 1, YAW_POS_008),
    spawn('float-drum', 'Flotation Drum', floatDrum, [TANK.center[0] - 0.65, 0.04, TANK.center[2] - 0.25], 1.2, YAW_NEG_014),
    spawn('ballast-box', 'Ballast Box', ballast, [-0.1, restY(ballast.dims) + 0.48, 1.3], 0.05, YAW_NEG_014),
    spawn('hazard-drum-1', 'Hazard Drum 1', hazard, [0.5, restY(hazard.dims), -2.2], 0.35, YAW_POS_008),
    spawn('hazard-drum-2', 'Hazard Drum 2', hazard, [-2.2, restY(hazard.dims), 2.2], 0.35, YAW_NEG_014),

    // Seesaw sector (Positioned clear of driving runway, aligned with pivot joint)
    spawn('seesaw-plank', 'Seesaw Plank', seesaw, [-14, FLOOR_Y + 0.9 + 0.18, -6], 0.2),

    // Ball drop sector
    spawn('bowling-ball-1', 'Heavy Demolition Ball 1', ball, [-12, restY(ball.dims) + HOPPER_TOP, 12], 0.05),
    spawn('bowling-ball-2', 'Heavy Demolition Ball 2', ball, [-12.8, restY(ball.dims) + HOPPER_TOP, 11.2], 0.05),

    // Astro Bot Playground: 6-Pin Bowling Triangle Alley
    spawn('bowling-pin-1', 'Bowling Pin 1', pin, [-6.0, restY(pin.dims), 12.0], 0.3),
    spawn('bowling-pin-2', 'Bowling Pin 2', pin, [-5.2, restY(pin.dims), 13.6], 0.3),
    spawn('bowling-pin-3', 'Bowling Pin 3', pin, [-6.8, restY(pin.dims), 13.6], 0.3),
    spawn('bowling-pin-4', 'Bowling Pin 4', pin, [-4.4, restY(pin.dims), 15.2], 0.3),
    spawn('bowling-pin-5', 'Bowling Pin 5', pin, [-6.0, restY(pin.dims), 15.2], 0.3),
    spawn('bowling-pin-6', 'Bowling Pin 6', pin, [-7.6, restY(pin.dims), 15.2], 0.3),

    // Astro Bot High-Speed Driving Runway: Teardown-Style Unified Buggy at [14, -12] facing South
    spawn('vehicle-chassis', 'Sandbox Buggy', buggy, [14.0, FLOOR_Y + getTerrainHeightAt(14, -12) + 1.05, -12.0], 0.25, [0, 1, 0, 0]),

    // Astro Bot Domino Crash Wall (Directly at the Stunt Jump landing zone)
    spawn('domino-crate-1', 'Domino Crate 1', steel, [12.6, steelY, 13.0], 0.1),
    spawn('domino-crate-2', 'Domino Crate 2', timber, [14.0, steelY, 13.0], 0.28),
    spawn('domino-crate-3', 'Domino Crate 3', steel, [15.4, steelY, 13.0], 0.1),
    spawn('hazard-drum-jump', 'Jump Hazard Drum', hazard, [14.0, restY(hazard.dims) + 0.8, 13.0], 0.35),

    // Loose props on the west loading deck (top 1.0 m above the floor) and by the east barriers.
    spawn('deck-drum-1', 'Oil Drum', hazard, [-22.6, restY(hazard.dims) + DECK_HEIGHT, 9.0], 0.35),
    spawn('deck-drum-2', 'Oil Drum', hazard, [-22.6, restY(hazard.dims) + DECK_HEIGHT, 9.9], 0.35),
    spawn('deck-drum-3', 'Oil Drum', hazard, [-21.75, restY(hazard.dims) + DECK_HEIGHT, 9.45], 0.35),
    spawn('deck-pallet-1', 'Pallet', flatPallet, [-19.9, restY(flatPallet.dims) + DECK_HEIGHT, 9.5], 0.3, YAW_POS_008),
    spawn('deck-pallet-2', 'Pallet', flatPallet, [-19.9, restY(flatPallet.dims) + DECK_HEIGHT + 0.25, 9.5], 0.3),
    spawn('yard-drum-1', 'Oil Drum', hazard, [18.9, restY(hazard.dims), 4.0], 0.35),
    spawn('yard-pallet-1', 'Pallet', flatPallet, [20.4, restY(flatPallet.dims), 3.5], 0.3, YAW_NEG_014),

    // Astro Bot Drift Slalom Cones (Guiding the sweeping southern hairpin curve)
    spawn('slalom-drum-1', 'Slalom Drum 1', hazard, [10.0, restY(hazard.dims), 18.0], 0.35),
    spawn('slalom-drum-2', 'Slalom Drum 2', hazard, [2.0, restY(hazard.dims), 19.0], 0.35),
    spawn('slalom-drum-3', 'Slalom Drum 3', hazard, [-6.0, restY(hazard.dims), 18.0], 0.35),

    // Destructible tower sector (North-West playground edge)
    spawn('destructible-tower', 'Destructible Tower', tower, [-16, restY(tower.dims), 0], 0.15),

    // Yard props: wrecks, containers, concrete, tires, bales, and loose scrap.
    ...yardProps().map((prop) => spawn(prop.id, prop.label, prop.preset, prop.position, prop.buoyancy, prop.rotation)),
  ];
}

export function createInitialState(playerCount: number): YardState {
  if (!Number.isInteger(playerCount) || playerCount < 1) {
    throw new Error(`WRECK_YARD_PLAYER_COUNT_INVALID: ${playerCount}`);
  }
  // Spawn poses and set pieces use Math.sin/cos/atan2/hypot. Peers agree on them
  // only when the Syncplay shim replaced them (src/deterministicMath.ts).
  if ((globalThis as { __deterministicMathInstalled?: boolean }).__deterministicMathInstalled !== true) {
    throw new Error('WRECK_YARD_DETERMINISTIC_MATH_MISSING: import src/deterministicMath.ts before any sim module');
  }
  const spawns = createSpawns();
  const world = createWorld(
    spawns.map((entry) =>
      makePhysicsBody(entry.body, {
        position: entry.position,
        rotation: entry.rotation,
        linearVelocity: [0, 0, 0],
        angularVelocity: [0, 0, 0],
      }),
    ),
  );
  return {
    frame: 0,
    bodies: spawns.map((entry) => entry.body),
    world,
    players: Array.from({ length: playerCount }, (_, slot) => createInitialPlayer(slot)),
    stats: { torchCuts: 0, throws: 0, fractures: 0, dunks: 0 },
    contraptions: INITIAL_CONTRAPTIONS,
    nextSerial: 0,
  };
}
