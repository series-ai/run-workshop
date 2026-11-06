import { describe, expect, it } from 'vitest';
import { meters, vec3 } from '@series-inc/rundot-syncplay/physics/3d';
import { projectYard } from '../render/presentation';
import { BURNT_MATERIAL, FLOOR_Y, HEAT, PLAYER_RADIUS, SCORCH_MATERIAL, TANK, TICK_RATE, VOXEL_SIZE } from './constants';
import { BUTTONS } from './contraptions';
import { FUEL_DRUM } from './fuelDrum';
import { NEUTRAL_INPUT, quantizeRay, TOOL } from './input';
import { LAVA, LAVA_BOUNDS } from './liquidAssets';
import { add, rotate, type Quat, type Vec3 } from './math';
import { addPhysicsBodies, makePhysicsBody, physicsBodyHandle, physicsStateBodyById, removePhysicsBodies, replacePhysicsPose } from './physics';
import { YardSim } from './sim';
import type { YardBody } from './state';
import { patchPlayer, patchState, testSim } from './testSim';
import { WATER_BOUNDS } from './water';

const IDENTITY: Quat = [0, 0, 0, 1];
const POOL_CENTER: Vec3 = [LAVA.center[0], (LAVA.bottomY + LAVA.surfaceY) / 2, LAVA.center[2]];
const occupied = (body: YardBody): number => body.voxels.reduce((sum, value) => sum + Number(value !== 0), 0);

function step(sim: YardSim, ticks = 1): void {
  for (let tick = 0; tick < ticks; tick++) sim.step([NEUTRAL_INPUT]);
}

function fixtureSim(): YardSim {
  const sim = testSim();
  const ids = sim.state.bodies.filter((body) => body.id === 'lava-hand' || body.id.startsWith('lava-hand-p')).map((body) => body.id);
  if (ids.length > 0) {
    sim.edit((physics) => removePhysicsBodies(physics, ids));
    patchState(sim, (state) => ({ ...state, bodies: state.bodies.filter((body) => !ids.includes(body.id)) }));
  }
  return sim;
}

function addFixture(sim: YardSim, id: string, position: Vec3 = POOL_CENTER, options: {
  readonly dims?: YardBody['dims'];
  readonly voxels?: Uint8Array;
  readonly rotation?: Quat;
  readonly motion?: YardBody['motion'];
} = {}): YardBody {
  const dims = options.dims ?? { x: 6, y: 6, z: 6 };
  const motion = options.motion ?? 'fixed';
  const body: YardBody = {
    id, label: id, material: 'steel', dims,
    voxels: options.voxels ?? new Uint8Array(dims.x * dims.y * dims.z).fill(1),
    motion, buoyancy: 0.1, anchorFaces: motion === 'fixed' ? ['+y'] : [],
    impactCooldownUntil: 0, heat: null,
  };
  sim.edit((physics) => addPhysicsBodies(physics, [makePhysicsBody(body, {
    position, rotation: options.rotation ?? IDENTITY, linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0],
  })]));
  patchState(sim, (state) => ({ ...state, bodies: [...state.bodies, body] }));
  return body;
}

function pieces(sim: YardSim, source: YardBody): readonly YardBody[] {
  return sim.state.bodies.filter((body) => body.id === source.id || body.id.startsWith(`${source.id}-p`));
}

function count(sim: YardSim, source: YardBody): number {
  return pieces(sim, source).reduce((sum, body) => sum + occupied(body), 0);
}

function waitForLoss(sim: YardSim, source: YardBody): number {
  const before = count(sim, source);
  for (let tick = 0; tick <= LAVA.pulseTicks; tick++) {
    step(sim);
    if (count(sim, source) < before) return before - count(sim, source);
  }
  throw new Error(`Lava did not remove cells from ${source.id}`);
}

function cellKey(point: Vec3): string {
  return point.map((value) => value.toFixed(5)).join(',');
}

function worldCells(sim: YardSim, source: YardBody): Map<string, Vec3> {
  const result = new Map<string, Vec3>();
  for (const body of pieces(sim, source)) {
    const pose = physicsStateBodyById(sim.state.world, body.id)!;
    expect(pose, body.id).toBeDefined();
    for (let z = 0; z < body.dims.z; z++) for (let y = 0; y < body.dims.y; y++) for (let x = 0; x < body.dims.x; x++) {
      if (!body.voxels[x + y * body.dims.x + z * body.dims.x * body.dims.y]) continue;
      const local: Vec3 = [
        (x - (body.dims.x - 1) / 2) * VOXEL_SIZE,
        (y - (body.dims.y - 1) / 2) * VOXEL_SIZE,
        (z - (body.dims.z - 1) / 2) * VOXEL_SIZE,
      ];
      const point = add([pose.x, pose.y, pose.z], rotate(local, [pose.orientation.x, pose.orientation.y, pose.orientation.z, pose.orientation.w]));
      result.set(cellKey(point), point);
    }
  }
  return result;
}

function insideLava(point: Vec3): boolean {
  return point.every((value, axis) => value >= LAVA_BOUNDS.min[axis]! && value <= LAVA_BOUNDS.max[axis]!);
}

function expectValidMotion(sim: YardSim, source: YardBody): void {
  for (const body of pieces(sim, source)) {
    const pose = physicsStateBodyById(sim.state.world, body.id)!;
    expect(pose, body.id).toBeDefined();
    const values = [pose.x, pose.y, pose.z, pose.vx, pose.vy, pose.vz,
      ...Object.values(pose.orientation), ...Object.values(pose.angularVel)];
    expect(values.every(Number.isFinite), body.id).toBe(true);
    expect(Math.hypot(...Object.values(pose.orientation))).toBeCloseTo(1, 5);
  }
}

describe('lava with native physics', () => {
  it('places lava east of water and applies native fluid forces to a submerged prop', () => {
    expect(LAVA.pulseTicks).toBe(15);
    expect(LAVA.maxVoxelsPerPulse).toBe(6);
    expect(LAVA_BOUNDS.min[0]).toBeGreaterThan(WATER_BOUNDS.max[0]);
    const sim = fixtureSim();
    const source = addFixture(sim, 'lava-fluid-prop', POOL_CENTER, { dims: { x: 4, y: 4, z: 4 }, motion: 'dynamic' });
    step(sim);
    const interaction = sim.physics.world.latest().fluidInteractions.find((entry) => entry.bodyKey === source.id);
    expect(interaction).toBeDefined();
    expect(interaction!.submergedVolume).toBeGreaterThan(0);
    expect(interaction!.totalForce.y).toBeGreaterThan(0);
    expect(sim.state.world.fluidInteractions?.some((entry) => entry.bodyId === source.id) ?? false).toBe(false);
    const render = projectYard(sim.state, { localSlot: 0, status: 'offline' });
    expect(render.soundMotions!.get(source.id)!.submerged).toBe(false);
    expectValidMotion(sim, source);
  });

  it.each([0, Math.PI / 4])('removes only exposed cell centers in lava at rotation %s', (angle) => {
    const sim = fixtureSim();
    const position: Vec3 = [LAVA.center[0], LAVA.surfaceY + 0.18, LAVA.center[2]];
    const rotation: Quat = [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)];
    const source = addFixture(sim, 'lava-contact-prop', position, { dims: { x: 8, y: 12, z: 8 }, rotation });
    const before = worldCells(sim, source);
    const exposed = new Set<string>();
    for (let z = 0; z < source.dims.z; z++) for (let y = 0; y < source.dims.y; y++) for (let x = 0; x < source.dims.x; x++) {
      if (x !== 0 && x !== source.dims.x - 1 && y !== 0 && y !== source.dims.y - 1 && z !== 0 && z !== source.dims.z - 1) continue;
      exposed.add(cellKey(add(position, rotate([
        (x - (source.dims.x - 1) / 2) * VOXEL_SIZE,
        (y - (source.dims.y - 1) / 2) * VOXEL_SIZE,
        (z - (source.dims.z - 1) / 2) * VOXEL_SIZE,
      ], rotation))));
    }
    const lost = waitForLoss(sim, source);
    expect(lost).toBeGreaterThan(0);
    expect(lost).toBeLessThanOrEqual(LAVA.maxVoxelsPerPulse);
    const after = worldCells(sim, source);
    expect(before.size - after.size).toBe(lost);
    for (const key of after.keys()) expect(before.has(key), key).toBe(true);
    for (const [key, point] of before) {
      if (after.has(key)) continue;
      expect(insideLava(point), key).toBe(true);
      expect(exposed.has(key), key).toBe(true);
    }
    expect(pieces(sim, source).every((body) => body.material === 'steel')).toBe(true);
    expectValidMotion(sim, source);
    const shape = worldCells(sim, source);
    step(sim, LAVA.pulseTicks - 1);
    expect(worldCells(sim, source)).toEqual(shape);
    step(sim);
    expect(count(sim, source)).toBeLessThan(after.size);
    expect(after.size - count(sim, source)).toBeLessThanOrEqual(LAVA.maxVoxelsPerPulse);
  });

  it('keeps water and dry props intact while lava removes material', () => {
    const sim = fixtureSim();
    const hot = addFixture(sim, 'lava-hot-prop');
    const water = addFixture(sim, 'lava-water-control', [TANK.center[0], POOL_CENTER[1], TANK.center[2]]);
    const dry = addFixture(sim, 'lava-dry-control', [LAVA.center[0], LAVA.surfaceY + 0.7, LAVA.center[2]]);
    step(sim, LAVA.pulseTicks * 3);
    expect(count(sim, hot)).toBeLessThan(occupied(hot));
    for (const source of [water, dry]) {
      expect(count(sim, source)).toBe(occupied(source));
      expect(pieces(sim, source)[0]!.voxels).toEqual(source.voxels);
      expect(pieces(sim, source)[0]!.heat).toBeNull();
    }
  });

  it('stops erosion when a prop is raised clear and lets its heat cool', () => {
    const sim = fixtureSim();
    const source = addFixture(sim, 'lava-raised-prop');
    waitForLoss(sim, source);
    expect(pieces(sim, source).some((body) => body.heat !== null)).toBe(true);
    expect(pieces(sim, source).some((body) => body.voxels.includes(SCORCH_MATERIAL))).toBe(true);
    sim.edit((physics) => {
      for (const body of pieces(sim, source)) {
        const pose = physicsStateBodyById(sim.state.world, body.id)!;
        physics.world.setBodyTransform(physicsBodyHandle(physics, body.id), {
          position: vec3(meters, pose.x, LAVA.surfaceY + 3, pose.z), orientation: pose.orientation,
        });
      }
    });
    const shape = pieces(sim, source).map((body) => ({ id: body.id, cells: body.voxels.map((value) => Number(value !== 0)) }));
    step(sim, Math.ceil(HEAT.burntSeconds * TICK_RATE) + LAVA.pulseTicks);
    expect(pieces(sim, source).map((body) => ({ id: body.id, cells: body.voxels.map((value) => Number(value !== 0)) }))).toEqual(shape);
    for (const body of pieces(sim, source)) {
      expect(body.heat).toBeNull();
      expect(body.voxels.includes(SCORCH_MATERIAL)).toBe(false);
    }
    expect(pieces(sim, source).some((body) => body.voxels.includes(BURNT_MATERIAL))).toBe(true);
  });

  it('edits one source per pulse and gives each contacting prop a stable turn', () => {
    const sim = fixtureSim();
    const sources = [
      addFixture(sim, 'lava-order-c', [POOL_CENTER[0] + 0.75, POOL_CENTER[1], POOL_CENTER[2] + 0.5]),
      addFixture(sim, 'lava-order-a', [POOL_CENTER[0] - 0.75, POOL_CENTER[1], POOL_CENTER[2] - 0.5]),
      addFixture(sim, 'lava-order-b'),
    ];
    const edits: { readonly id: string; readonly frame: number }[] = [];
    for (let tick = 0; tick < LAVA.pulseTicks * 6; tick++) {
      const before = sources.map((source) => count(sim, source));
      step(sim);
      const changes = sources.map((source, index) => ({ source, lost: before[index]! - count(sim, source) })).filter((entry) => entry.lost !== 0);
      expect(changes.length).toBeLessThanOrEqual(1);
      for (const { source, lost } of changes) {
        expect(lost).toBeGreaterThan(0);
        expect(lost).toBeLessThanOrEqual(LAVA.maxVoxelsPerPulse);
        edits.push({ id: source.id, frame: sim.state.frame });
      }
    }
    expect(edits).toHaveLength(6);
    const order = sources.map((source) => source.id).sort();
    const first = order.indexOf(edits[0]!.id);
    for (let index = 0; index < edits.length; index++) {
      expect(edits[index]!.id).toBe(order[(first + index) % order.length]);
      if (index > 0) expect(edits[index]!.frame - edits[index - 1]!.frame).toBe(LAVA.pulseTicks);
    }
    for (const source of sources) {
      expect(count(sim, source)).toBeLessThan(occupied(source));
      expectValidMotion(sim, source);
    }
  });

  it('replays active erosion exactly from native and serialized checkpoints', () => {
    const sim = fixtureSim();
    const source = addFixture(sim, 'lava-replay-prop');
    waitForLoss(sim, source);
    step(sim, 4);
    const start = sim.save();
    const bytes = YardSim.decode(sim.encode(start));
    try {
      const before = count(sim, source);
      step(sim, LAVA.pulseTicks * 3 + 2);
      expect(count(sim, source)).toBeLessThan(before);
      const final = sim.save();
      try {
        const checksum = sim.checksumBytes(final);
        const encoded = sim.encode(final);
        for (const save of [start, bytes]) {
          sim.restore(save);
          step(sim, LAVA.pulseTicks * 3 + 2);
          const replay = sim.save();
          try {
            expect(sim.checksumBytes(replay)).toEqual(checksum);
            expect(sim.encode(replay)).toEqual(encoded);
          } finally { sim.release(replay); }
        }
      } finally { sim.release(final); }
    } finally { sim.release(start); sim.release(bytes); }
  });

  it('gradually erodes the real dynamic steel hand', () => {
    const sim = testSim();
    const hand = sim.state.bodies.find((body) => body.id === 'lava-hand');
    expect(hand).toBeDefined();
    expect(hand!.motion).toBe('dynamic');
    expect(hand!.material).toBe('steel');
    const initial = occupied(hand!);
    const firstLoss = waitForLoss(sim, hand!);
    expect(firstLoss).toBeGreaterThan(0);
    expect(count(sim, hand!)).toBeGreaterThan(0);
    expect(count(sim, hand!)).toBeLessThan(initial);
    expectValidMotion(sim, hand!);
    const afterPulse = count(sim, hand!);
    step(sim, LAVA.pulseTicks - 1);
    expect(count(sim, hand!)).toBe(afterPulse);
  });

  it('heats a real fuel drum without cutting its shell, then ignites its fuse', () => {
    const sim = fixtureSim();
    const button = BUTTONS.find((entry) => entry.id === 'dropper')!;
    patchPlayer(sim, { x: button.base[0] + 1.2, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: button.base[2], vx: 0, vy: 0, vz: 0 });
    sim.step([{ ...NEUTRAL_INPUT, use: true }]);
    const id = sim.state.contraptions.drums.at(-1)!.bodyId;
    const source = sim.state.bodies.find((body) => body.id === id)!;
    expect(source.label).toBe(FUEL_DRUM.label);
    const initial = occupied(source);
    let sawHeat = false;
    let priorDamage = 0;
    for (let tick = 0; tick < LAVA.pulseTicks * 4; tick++) {
      sim.edit((physics) => replacePhysicsPose(physics, id, {
        x: LAVA.center[0], y: LAVA.bottomY + source.dims.y * VOXEL_SIZE / 2 + 0.01, z: LAVA.center[2], vx: 0, vy: 0, vz: 0,
      }));
      step(sim);
      const drum = sim.state.contraptions.drums.find((entry) => entry.bodyId === id)!;
      expect(drum.damage).toBeGreaterThanOrEqual(priorDamage);
      expect(count(sim, source)).toBe(initial);
      expect(pieces(sim, source)).toHaveLength(1);
      if (drum.damage > 0) {
        sawHeat = true;
        expect(pieces(sim, source)[0]!.heat).not.toBeNull();
        expect(pieces(sim, source)[0]!.voxels.includes(SCORCH_MATERIAL)).toBe(true);
      }
      priorDamage = drum.damage;
      if (drum.detonateAt !== null) break;
    }
    expect(sawHeat).toBe(true);
    const lit = sim.state.contraptions.drums.find((entry) => entry.bodyId === id)!;
    expect(lit.damage).toBe(FUEL_DRUM.maxDamage);
    expect(lit.detonateAt).toBe(sim.state.frame + FUEL_DRUM.fuseTicks);
    const explosions = sim.state.stats.explosions;
    sim.edit((physics) => replacePhysicsPose(physics, id, { x: 6, y: FLOOR_Y + 1, z: 11, vx: 0, vy: 0, vz: 0 }));
    step(sim, FUEL_DRUM.fuseTicks - 1);
    expect(sim.state.bodies.some((body) => body.id === id)).toBe(true);
    expect(sim.state.contraptions.drums.find((entry) => entry.bodyId === id)!.detonateAt).toBe(lit.detonateAt);
    step(sim);
    expect(sim.state.bodies.some((body) => body.id === id)).toBe(false);
    expect(sim.state.stats.explosions).toBe(explosions + 1);
  });

  it('keeps sealed inner walls dry when the cavity lies inside lava', () => {
    const sim = fixtureSim();
    const dims = { x: 36, y: 12, z: 34 };
    const voxels = new Uint8Array(dims.x * dims.y * dims.z).fill(1);
    for (let z = 14; z < 20; z++) for (let y = 4; y < 8; y++) for (let x = 15; x < 21; x++) {
      voxels[x + y * dims.x + z * dims.x * dims.y] = 0;
    }
    // The thick outside walls enclose the pool. Only sealed inner walls are in lava.
    const source = addFixture(sim, 'lava-sealed-cavity', POOL_CENTER, { dims, voxels });
    const before = worldCells(sim, source);
    const innerWall: Vec3 = [POOL_CENTER[0] + (14 - (dims.x - 1) / 2) * VOXEL_SIZE,
      POOL_CENTER[1] + (5 - (dims.y - 1) / 2) * VOXEL_SIZE,
      POOL_CENTER[2] + (16 - (dims.z - 1) / 2) * VOXEL_SIZE];
    expect(insideLava(innerWall)).toBe(true);
    expect(before.has(cellKey(innerWall))).toBe(true);
    expect(dims.x * VOXEL_SIZE / 2).toBeGreaterThan(LAVA.innerSize[0] / 2 + VOXEL_SIZE);
    expect(dims.z * VOXEL_SIZE / 2).toBeGreaterThan(LAVA.innerSize[2] / 2 + VOXEL_SIZE);
    step(sim, LAVA.pulseTicks * 2);
    expect(count(sim, source)).toBe(occupied(source));
    expect(worldCells(sim, source)).toEqual(before);
    expect(pieces(sim, source)[0]!.heat).toBeNull();
  });

  it('keeps a real gravity-gun grab when a partial lava pulse retains the source ID', () => {
    const sim = fixtureSim();
    const source = addFixture(sim, 'lava-grab-prop', POOL_CENTER, { motion: 'dynamic' });
    const hold = { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true,
      ...quantizeRay([POOL_CENTER[0], POOL_CENTER[1] + 3, POOL_CENTER[2] + 0.001], [0, -1, -0.0001]) };
    sim.step([hold]);
    expect(sim.state.players[0]!.grab?.bodyId).toBe(source.id);
    const initial = count(sim, source);
    for (let tick = 0; tick <= LAVA.pulseTicks && count(sim, source) === initial; tick++) {
      sim.step([hold]);
      expect(sim.state.players[0]!.grab?.bodyId).toBe(source.id);
    }
    expect(count(sim, source)).toBeLessThan(initial);
    expect(count(sim, source)).toBeGreaterThan(0);
    expect(initial - count(sim, source)).toBeLessThanOrEqual(LAVA.maxVoxelsPerPulse);
    expect(sim.state.bodies.some((body) => body.id === source.id)).toBe(true);
    expect(sim.state.players[0]!.grab?.bodyId).toBe(source.id);
    sim.step([hold]);
    expect(sim.state.players[0]!.grab?.bodyId).toBe(source.id);
    expectValidMotion(sim, source);
  });
});
