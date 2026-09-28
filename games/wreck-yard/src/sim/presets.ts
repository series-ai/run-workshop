import { makeEmptyVoxelField, stampBox, stampSphere, type VoxelDims } from 'voxel-kit';
import { FLOOR_Y, getTerrainHeightAt, TANK, VOXEL_SIZE } from './constants';
import { IDENTITY_QUAT, type Quat, type Vec3 } from './math';
import { createWorld, makePhysicsBody } from './physics';
import { createInitialPlayer, type AnchorFace, type BodyMotion, type YardBody, type YardState } from './state';

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

function makeTimberPallet(): VolumePreset {
  const dims = { x: 16, y: 10, z: 12 };
  const voxels = makeEmptyVoxelField(dims);
  stampBox(voxels, dims, { x: 0, y: 0, z: 0 }, { x: 15, y: 1, z: 2 }, 2);
  stampBox(voxels, dims, { x: 0, y: 0, z: 5 }, { x: 15, y: 1, z: 6 }, 2);
  stampBox(voxels, dims, { x: 0, y: 0, z: 9 }, { x: 15, y: 1, z: 11 }, 2);
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

function makeBuggyChassis(): VolumePreset {
  // Astro Bot High-Craft Off-Road Buggy: 2.08m wide x 1.44m tall x 3.04m long (1.79m total vehicle height with wheels)
  const dims = { x: 26, y: 18, z: 38 };
  const voxels = makeEmptyVoxelField(dims);

  // 1. Reinforced chassis floor pan and frame rails (8 = ink / carbon dark)
  stampBox(voxels, dims, { x: 1, y: 0, z: 3 }, { x: 24, y: 2, z: 35 }, 8);
  // Outer rock sliders / tubular side nerf bars (1 = signalOrange)
  stampBox(voxels, dims, { x: 0, y: 1, z: 6 }, { x: 2, y: 3, z: 32 }, 1);
  stampBox(voxels, dims, { x: 23, y: 1, z: 6 }, { x: 25, y: 3, z: 32 }, 1);

  // 2. Sculpted Astro Bot Aero Body Panels: Vibrant Electric Teal (5 = teal)
  stampBox(voxels, dims, { x: 2, y: 2, z: 4 }, { x: 23, y: 7, z: 12 }, 5);
  stampBox(voxels, dims, { x: 1, y: 3, z: 12 }, { x: 4, y: 8, z: 26 }, 5);
  stampBox(voxels, dims, { x: 21, y: 3, z: 12 }, { x: 24, y: 8, z: 26 }, 5);

  // Bold Pearl White Center Racing Stripe (3 = concreteLit)
  stampBox(voxels, dims, { x: 10, y: 3, z: 4 }, { x: 15, y: 7, z: 12 }, 3);

  // Front Stinger Bull Bar & Winch Spool (8 = ink / 6 = mustard)
  stampBox(voxels, dims, { x: 4, y: 1, z: 0 }, { x: 21, y: 5, z: 4 }, 8);
  stampBox(voxels, dims, { x: 10, y: 2, z: 0 }, { x: 15, y: 4, z: 2 }, 6);

  // Adorable Expressive Round Rally Headlights (Outer: 1 = signalOrange, Lens: 9 = spark glowing cyan-white)
  stampBox(voxels, dims, { x: 4, y: 3, z: 0 }, { x: 9, y: 7, z: 2 }, 1);
  stampBox(voxels, dims, { x: 5, y: 4, z: 0 }, { x: 8, y: 6, z: 1 }, 9);
  stampBox(voxels, dims, { x: 16, y: 3, z: 0 }, { x: 21, y: 7, z: 2 }, 1);
  stampBox(voxels, dims, { x: 17, y: 4, z: 0 }, { x: 20, y: 6, z: 1 }, 9);

  // Twin Lower Fog/Accent Pods (10 = glow)
  stampBox(voxels, dims, { x: 7, y: 1, z: 0 }, { x: 9, y: 2, z: 1 }, 10);
  stampBox(voxels, dims, { x: 16, y: 1, z: 0 }, { x: 18, y: 2, z: 1 }, 10);

  // 3. Exposed Rear High-Output V8 & Twin Rocket Thruster Boosters
  // Chrome Engine Block & Intake Supercharger Scoop (3 = concreteLit / 1 = signalOrange)
  stampBox(voxels, dims, { x: 7, y: 2, z: 26 }, { x: 18, y: 8, z: 35 }, 3);
  stampBox(voxels, dims, { x: 8, y: 8, z: 28 }, { x: 17, y: 11, z: 33 }, 1);
  // Twin High-Output Rocket Thrusters (Nozzles: 8 = ink, Core Flame: 10 = glow / 9 = spark)
  stampBox(voxels, dims, { x: 5, y: 3, z: 32 }, { x: 9, y: 7, z: 37 }, 8);
  stampBox(voxels, dims, { x: 6, y: 4, z: 35 }, { x: 8, y: 6, z: 37 }, 10);
  stampBox(voxels, dims, { x: 16, y: 3, z: 32 }, { x: 20, y: 7, z: 37 }, 8);
  stampBox(voxels, dims, { x: 17, y: 4, z: 35 }, { x: 19, y: 6, z: 37 }, 10);
  // Rear Radiator Mesh (4 = concreteShade)
  stampBox(voxels, dims, { x: 9, y: 7, z: 34 }, { x: 16, y: 11, z: 36 }, 4);

  // 4. Astro Bot Springy Whip Antenna with Glowing Beacon Orb
  // Steel whip mast (8 = ink)
  stampBox(voxels, dims, { x: 3, y: 8, z: 34 }, { x: 4, y: 17, z: 35 }, 8);
  // Beacon orb at top (10 = glow)
  stampBox(voxels, dims, { x: 2, y: 16, z: 33 }, { x: 5, y: 18, z: 36 }, 10);

  // 5. Structural 6-Point Tubular Roll Cage in Signal Orange (1 = signalOrange)
  // A-Pillars (Front windshield frame)
  stampBox(voxels, dims, { x: 2, y: 2, z: 11 }, { x: 4, y: 17, z: 13 }, 1);
  stampBox(voxels, dims, { x: 21, y: 2, z: 11 }, { x: 23, y: 17, z: 13 }, 1);
  // B-Pillars (Main roll hoop behind driver)
  stampBox(voxels, dims, { x: 2, y: 2, z: 24 }, { x: 4, y: 17, z: 26 }, 1);
  stampBox(voxels, dims, { x: 21, y: 2, z: 24 }, { x: 23, y: 17, z: 26 }, 1);
  // C-Pillars (Rear engine cage down-tubes)
  stampBox(voxels, dims, { x: 3, y: 2, z: 34 }, { x: 5, y: 12, z: 36 }, 1);
  stampBox(voxels, dims, { x: 20, y: 2, z: 34 }, { x: 22, y: 12, z: 36 }, 1);
  // Roof halo canopy frame (1 = signalOrange) & White Roof Panel (3 = concreteLit)
  stampBox(voxels, dims, { x: 2, y: 16, z: 11 }, { x: 23, y: 17, z: 26 }, 1);
  stampBox(voxels, dims, { x: 8, y: 16, z: 13 }, { x: 17, y: 17, z: 24 }, 3);

  // Overhead 4-Lens Baja Rally Light Bar (Lenses: 9 = spark)
  stampBox(voxels, dims, { x: 5, y: 17, z: 11 }, { x: 20, y: 18, z: 13 }, 8);
  for (const lx of [6, 10, 14, 18]) {
    stampBox(voxels, dims, { x: lx, y: 17, z: 11 }, { x: lx + 2, y: 18, z: 12 }, 9);
  }

  // 6. Open Driver Cockpit Interior Clearance
  stampBox(voxels, dims, { x: 5, y: 2, z: 11 }, { x: 20, y: 15, z: 25 }, 0);

  // 7. Molded High-Back Racing Bucket Seat & Dashboard Console
  // Racing Bucket Seat (5 = teal / 8 = ink)
  stampBox(voxels, dims, { x: 8, y: 2, z: 18 }, { x: 17, y: 4, z: 23 }, 5);
  stampBox(voxels, dims, { x: 8, y: 4, z: 22 }, { x: 17, y: 12, z: 24 }, 5);
  stampBox(voxels, dims, { x: 9, y: 12, z: 22 }, { x: 16, y: 14, z: 24 }, 1);
  // Dashboard Console (8 = ink) & Glowing Gauges (9 = spark, 10 = glow)
  stampBox(voxels, dims, { x: 7, y: 4, z: 12 }, { x: 18, y: 7, z: 14 }, 8);
  stampBox(voxels, dims, { x: 9, y: 5, z: 12 }, { x: 11, y: 6, z: 13 }, 9);
  stampBox(voxels, dims, { x: 14, y: 5, z: 12 }, { x: 16, y: 6, z: 13 }, 10);
  // Steering column and sport steering wheel (1 = signalOrange)
  stampBox(voxels, dims, { x: 11, y: 6, z: 14 }, { x: 14, y: 9, z: 16 }, 1);

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
  // 1.2 x 0.24 x 1.2 m shipping pallet: three wide runners (stable support,
  // no rocking when stacked) under a slatted top deck.
  const dims = { x: 15, y: 3, z: 15 };
  const voxels = makeEmptyVoxelField(dims);
  for (const z of [0, 6, 12]) stampBox(voxels, dims, { x: 0, y: 0, z }, { x: 14, y: 1, z: z + 2 }, 2);
  for (const x of [0, 3, 6, 9, 12]) stampBox(voxels, dims, { x, y: 2, z: 0 }, { x: x + 2, y: 2, z: 14 }, 2);
  return { dims, voxels };
}

/** Top of the west loading deck above the floor (see setPieces deck collider). */
const DECK_HEIGHT = 1.0;
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
  ];
}

export function createInitialState(playerCount: number): YardState {
  if (!Number.isInteger(playerCount) || playerCount < 1) {
    throw new Error(`WRECK_YARD_PLAYER_COUNT_INVALID: ${playerCount}`);
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
    stats: { torchCuts: 0, throws: 0, fractures: 0 },
    nextSerial: 0,
  };
}
