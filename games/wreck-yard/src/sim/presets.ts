import { makeEmptyVoxelField, stampBox, stampSphere, type VoxelDims } from 'voxel-kit';
import { FLOOR_Y, TANK, VOXEL_SIZE } from './constants';
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
  // Player-sized off-road buggy: 2.08m wide x 1.44m tall x 3.04m long (1.79m total vehicle height with wheels)
  const dims = { x: 26, y: 18, z: 38 };
  const voxels = makeEmptyVoxelField(dims);

  // 1. Reinforced steel floor pan and frame rails
  stampBox(voxels, dims, { x: 1, y: 0, z: 3 }, { x: 24, y: 2, z: 35 }, 3);
  // Outer rock sliders / tubular side nerf bars
  stampBox(voxels, dims, { x: 0, y: 1, z: 6 }, { x: 2, y: 3, z: 32 }, 3);
  stampBox(voxels, dims, { x: 23, y: 1, z: 6 }, { x: 25, y: 3, z: 32 }, 3);

  // 2. Front stinger bull bar, winch mount, and hood cowl
  stampBox(voxels, dims, { x: 4, y: 1, z: 0 }, { x: 21, y: 6, z: 4 }, 4);
  stampBox(voxels, dims, { x: 5, y: 2, z: 4 }, { x: 20, y: 7, z: 11 }, 3);
  // Twin front high-output rally headlights
  stampBox(voxels, dims, { x: 5, y: 4, z: 0 }, { x: 8, y: 7, z: 2 }, 4);
  stampBox(voxels, dims, { x: 17, y: 4, z: 0 }, { x: 20, y: 7, z: 2 }, 4);

  // 3. Exposed rear high-output V8 engine block & exhaust stacks
  stampBox(voxels, dims, { x: 7, y: 2, z: 26 }, { x: 18, y: 9, z: 36 }, 3);
  // Twin vertical exhaust headers
  stampBox(voxels, dims, { x: 5, y: 3, z: 28 }, { x: 6, y: 11, z: 30 }, 4);
  stampBox(voxels, dims, { x: 19, y: 3, z: 28 }, { x: 20, y: 11, z: 30 }, 4);
  // Rear cooling radiator mesh
  stampBox(voxels, dims, { x: 8, y: 9, z: 33 }, { x: 17, y: 12, z: 36 }, 3);

  // 4. Structural 6-point tubular steel roll cage (A, B, and C pillars)
  // A-Pillars (Front windshield frame)
  stampBox(voxels, dims, { x: 2, y: 2, z: 11 }, { x: 4, y: 17, z: 13 }, 3);
  stampBox(voxels, dims, { x: 21, y: 2, z: 11 }, { x: 23, y: 17, z: 13 }, 3);
  // B-Pillars (Main roll hoop behind driver)
  stampBox(voxels, dims, { x: 2, y: 2, z: 24 }, { x: 4, y: 17, z: 26 }, 3);
  stampBox(voxels, dims, { x: 21, y: 2, z: 24 }, { x: 23, y: 17, z: 26 }, 3);
  // C-Pillars (Rear engine cage down-tubes)
  stampBox(voxels, dims, { x: 3, y: 2, z: 34 }, { x: 5, y: 12, z: 36 }, 3);
  stampBox(voxels, dims, { x: 20, y: 2, z: 34 }, { x: 22, y: 12, z: 36 }, 3);
  // Roof halo canopy frame
  stampBox(voxels, dims, { x: 2, y: 16, z: 11 }, { x: 23, y: 17, z: 26 }, 3);
  // Overhead Baja light bar across front roof halo
  stampBox(voxels, dims, { x: 6, y: 17, z: 11 }, { x: 19, y: 18, z: 13 }, 4);

  // 5. Open driver cockpit interior (1.12m wide, 1.20m tall clearance)
  stampBox(voxels, dims, { x: 5, y: 2, z: 11 }, { x: 20, y: 15, z: 25 }, 0);

  // 6. Molded high-back racing bucket seat & dashboard console
  // Bucket seat base
  stampBox(voxels, dims, { x: 8, y: 2, z: 18 }, { x: 17, y: 4, z: 23 }, 2);
  // Ergonomic seat backrest
  stampBox(voxels, dims, { x: 8, y: 4, z: 22 }, { x: 17, y: 12, z: 24 }, 2);
  // Padded headrest
  stampBox(voxels, dims, { x: 9, y: 12, z: 22 }, { x: 16, y: 14, z: 24 }, 2);
  // Angled dashboard console & instrument pod
  stampBox(voxels, dims, { x: 7, y: 4, z: 12 }, { x: 18, y: 7, z: 14 }, 3);
  // Steering column and sport steering wheel
  stampBox(voxels, dims, { x: 11, y: 6, z: 14 }, { x: 14, y: 9, z: 16 }, 4);

  return { dims, voxels };
}

function makeBuggyWheel(): VolumePreset {
  // Heavy off-road all-terrain knobby tire: 0.64m wide x 0.96m diameter
  const dims = { x: 8, y: 12, z: 12 };
  const voxels = makeEmptyVoxelField(dims);
  // Deep knobby tire outer rubber tread
  stampSphere(voxels, dims, { x: 3.5, y: 5.5, z: 5.5 }, 5.6, 4);
  // Heavy stamped alloy wheel rim and center hub
  stampBox(voxels, dims, { x: 1, y: 3, z: 3 }, { x: 6, y: 8, z: 8 }, 3);
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
  // 3 platform decks (Level 1, Level 2, Level 3 roof)
  stampBox(voxels, dims, { x: 0, y: 14, z: 0 }, { x: 19, y: 15, z: 19 }, 2);
  stampBox(voxels, dims, { x: 0, y: 28, z: 0 }, { x: 19, y: 29, z: 19 }, 2);
  stampBox(voxels, dims, { x: 0, y: 42, z: 0 }, { x: 19, y: 43, z: 19 }, 2);
  // Protective side cladding panels
  stampBox(voxels, dims, { x: 0, y: 2, z: 0 }, { x: 19, y: 10, z: 1 }, 1);
  stampBox(voxels, dims, { x: 6, y: 4, z: 0 }, { x: 13, y: 9, z: 1 }, 0);
  // Top level observation cupola
  stampBox(voxels, dims, { x: 4, y: 30, z: 4 }, { x: 15, y: 41, z: 15 }, 4);
  stampBox(voxels, dims, { x: 6, y: 32, z: 6 }, { x: 13, y: 39, z: 13 }, 0);
  return { dims, voxels };
}

function restY(dims: VoxelDims): number {
  return FLOOR_Y + dims.y * VOXEL_SIZE * 0.5;
}

interface Spawn {
  readonly body: YardBody;
  readonly position: Vec3;
  readonly rotation: Quat;
}

function spawn(
  id: string,
  label: string,
  preset: VolumePreset,
  position: Vec3,
  buoyancy: number,
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
  const ball = makeBowlingBall();
  const pin = makeBowlingPin();
  const buggy = makeBuggyChassis();
  const wheel = makeBuggyWheel();
  const tower = makeDestructibleTower();
  const hazard = makeHazardBarrel();
  const floatDrum = makeBuoyantFloatDrum();

  return [
    // Original core set
    spawn('steel-case', 'Steel Case', steel, [-1.35, steelY, -0.2], 0.1),
    spawn('timber-pallet', 'Timber Pallet', timber, [-1.3, timberY, -0.16], 0.28, YAW_POS_008),
    spawn('steel-gantry', 'Steel Gantry', makeSteelGantry(), [2.18, 1.74, TANK.center[2]], 0.08, IDENTITY_QUAT, 'fixed', ['-x']),
    spawn('float-crate', 'Float Crate', makeFloatCrate(), [TANK.center[0] + 0.35, 0.04, TANK.center[2] + 0.2], 1, YAW_POS_008),
    spawn('float-drum', 'Flotation Drum', floatDrum, [TANK.center[0] - 0.65, 0.04, TANK.center[2] - 0.25], 1.2, YAW_NEG_014),
    spawn('ballast-box', 'Ballast Box', ballast, [0.62, restY(ballast.dims), 1.3], 0.05, YAW_NEG_014),
    spawn('hazard-drum-1', 'Hazard Drum 1', hazard, [0.5, restY(hazard.dims), -2.2], 0.35, YAW_POS_008),
    spawn('hazard-drum-2', 'Hazard Drum 2', hazard, [-2.2, restY(hazard.dims), 2.2], 0.35, YAW_NEG_014),

    // Seesaw sector
    spawn('seesaw-plank', 'Seesaw Plank', seesaw, [-8, FLOOR_Y + 0.9 + seesaw.dims.y * VOXEL_SIZE * 0.5, -6], 0.2),

    // Ball drop sector
    spawn('bowling-ball-1', 'Heavy Demolition Ball 1', ball, [-12, FLOOR_Y + 5.2, 12], 0.05),
    spawn('bowling-ball-2', 'Heavy Demolition Ball 2', ball, [-12.8, FLOOR_Y + 5.2, 11.2], 0.05),
    spawn('bowling-pin-1', 'Bowling Pin 1', pin, [-8, restY(pin.dims), 11], 0.3),
    spawn('bowling-pin-2', 'Bowling Pin 2', pin, [-8, restY(pin.dims), 13], 0.3),
    spawn('bowling-pin-3', 'Bowling Pin 3', pin, [-6.8, restY(pin.dims), 12], 0.3),

    // Buggy vehicle sector (Player-sized off-road buggy)
    spawn('vehicle-chassis', 'Sandbox Buggy', buggy, [12, FLOOR_Y + 1.1, 12], 0.25),
    spawn('vehicle-wheel-fl', 'Buggy Wheel FL', wheel, [10.78, FLOOR_Y + 0.52, 10.95], 0.2),
    spawn('vehicle-wheel-fr', 'Buggy Wheel FR', wheel, [13.22, FLOOR_Y + 0.52, 10.95], 0.2),
    spawn('vehicle-wheel-rl', 'Buggy Wheel RL', wheel, [10.78, FLOOR_Y + 0.52, 13.05], 0.2),
    spawn('vehicle-wheel-rr', 'Buggy Wheel RR', wheel, [13.22, FLOOR_Y + 0.52, 13.05], 0.2),

    // Destructible tower sector
    spawn('destructible-tower', 'Destructible Tower', tower, [-14, restY(tower.dims), -14], 0.15),
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
