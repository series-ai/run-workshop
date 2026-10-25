import { describe, expect, it } from 'vitest';
import { kilograms, meters, vec3 } from '@series-inc/rundot-syncplay/physics/3d';
import { FLOOR_Y, PLAYER_RADIUS, VOXEL_SIZE } from './constants';
import { NEUTRAL_INPUT } from './input';
import { rotate, type Quat, type Vec3 } from './math';
import { addPhysicsBodies, physicsBodyHandle } from './physics';
import { YardSim } from './sim';
import { PLAYER_SPAWN_POINTS } from './state';
import { testSim } from './testSim';

const BELT = {
  key: 'shell:lost-property-belt',
  center: [-8.5, FLOOR_Y + 0.22, 20.8] as Vec3,
  size: [4.6, 0.44, 1.5] as Vec3,
};

function addProbe(sim: YardSim, id: string, position: Vec3): void {
  sim.edit((open) => addPhysicsBodies(open, [{
    id,
    body: {
      kind: 'dynamic', material: 'steel', mass: kilograms(1),
      shape: { type: 'box', halfX: meters(0.25), halfY: meters(0.25), halfZ: meters(0.25) },
      position: vec3(meters, position), linearDamping: 1, angularDamping: 0.945,
    },
  }]));
}

function readProbe(sim: YardSim, id: string) {
  return sim.physics.world.readBody(physicsBodyHandle(sim.physics, id));
}

function footprintOverlap(minX: number, maxX: number, minZ: number, maxZ: number): boolean {
  return BELT.center[0] + BELT.size[0] / 2 > minX
    && BELT.center[0] - BELT.size[0] / 2 < maxX
    && BELT.center[2] + BELT.size[2] / 2 > minZ
    && BELT.center[2] - BELT.size[2] / 2 < maxZ;
}

describe('Lost Property belt', () => {
  it('has no overlap with an initial loose-body bound', () => {
    const sim = testSim();
    const overlaps: string[] = [];
    for (const body of sim.state.bodies) {
      const pose = sim.state.world.bodies.find((entry) => entry.id === body.id)!;
      const rotation: Quat = [pose.orientation.x, pose.orientation.y, pose.orientation.z, pose.orientation.w];
      const axes = [
        rotate([body.dims.x * VOXEL_SIZE / 2, 0, 0], rotation),
        rotate([0, body.dims.y * VOXEL_SIZE / 2, 0], rotation),
        rotate([0, 0, body.dims.z * VOXEL_SIZE / 2], rotation),
      ];
      const center = [pose.x, pose.y, pose.z];
      const intersects = BELT.center.every((value, axis) => {
        const half = axes.reduce((sum, vector) => sum + Math.abs(vector[axis]!), 0);
        return Math.abs(value - center[axis]!) < BELT.size[axis]! / 2 + half;
      });
      if (intersects) overlaps.push(body.id);
    }
    expect(overlaps).toEqual([]);
  });

  it('keeps player starts, portal approaches, the lift lane, and the buggy lane clear', () => {
    for (const [x, , z] of PLAYER_SPAWN_POINTS) {
      expect(footprintOverlap(x - PLAYER_RADIUS, x + PLAYER_RADIUS, z - PLAYER_RADIUS, z + PLAYER_RADIUS)).toBe(false);
    }
    for (const [minX, maxX, minZ, maxZ] of [
      [-4.7, 0.7, 17, 23],
      [4.3, 9.7, -23, -15],
      [-8, -6.2, -18.5, -13.5],
      [11.2, 16.8, -14, 22],
    ]) expect(footprintOverlap(minX!, maxX!, minZ!, maxZ!)).toBe(false);
  });

  it('adds one static surface and keeps the original loose-body and joint counts', () => {
    const sim = testSim();
    const belt = sim.physics.world.resolveKey(BELT.key);
    expect(belt).toBeDefined();
    expect(belt!.kind).toBe('static');
    expect(belt!.position).toEqual({ x: BELT.center[0], y: BELT.center[1], z: BELT.center[2] });
    expect(belt!.shape).toEqual({ type: 'box', halfX: 2.3, halfY: 0.22, halfZ: 0.75 });
    expect(belt!.linearVelocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(sim.physics.world.readEffectiveSurfaceVelocity(belt!.id)).toEqual({ x: 1.35, y: 0, z: 0 });
    expect(sim.state.bodies.filter((body) => body.id.startsWith('shipping-storage-'))).toHaveLength(400);
    expect(sim.state.bodies.filter((body) => body.id.startsWith('shipping-returns-'))).toHaveLength(36);
    expect({
      looseBodies: sim.state.bodies.length,
      dynamicBodies: sim.state.world.bodies.filter((body) => body.kind === 'dynamic').length,
      joints: sim.physics.world.info().jointCount,
    }).toEqual({ looseBodies: 544, dynamicBodies: 543, joints: 0 });
    const before = sim.physics.world.info();
    for (let frame = 0; frame < 10; frame++) sim.step([NEUTRAL_INPUT]);
    const after = sim.physics.world.info();
    expect(after.bodyCount).toBe(before.bodyCount);
    expect(after.jointCount).toBe(before.jointCount);
    expect(sim.physics.world.resolveKey(BELT.key)!.position).toEqual(belt!.position);
  });

  it('carries through real contacts, leaves a floor control still, and replays both checkpoint forms exactly', () => {
    const sim = testSim();
    const startX = BELT.center[0] - 1.2;
    const probeId = 'lost-property-probe';
    const controlId = 'lost-property-floor-control';
    addProbe(sim, probeId, [startX, BELT.center[1] + BELT.size[1] / 2 + 0.28, BELT.center[2]]);
    addProbe(sim, controlId, [startX, FLOOR_Y + 0.28, BELT.center[2] - 2.5]);
    const contactTypes = new Set<string>();
    const advance = (ticks: number) => {
      const trace = [];
      for (let frame = 0; frame < ticks; frame++) {
        sim.step([NEUTRAL_INPUT]);
        for (const contact of sim.physics.world.latest().contacts) {
          if ((contact.bodyKeyA === BELT.key && contact.bodyKeyB === probeId)
            || (contact.bodyKeyB === BELT.key && contact.bodyKeyA === probeId)) contactTypes.add(contact.type);
        }
        trace.push({ body: readProbe(sim, probeId), digest: sim.physics.world.digest() });
      }
      return trace;
    };
    advance(15);
    expect(contactTypes.has('enter')).toBe(true);
    expect(contactTypes.has('stay')).toBe(true);
    const save = sim.save();
    try {
      const bytes = sim.encode(save);
      const expected = advance(30);
      expect(readProbe(sim, probeId).position.x - startX).toBeGreaterThan(0.7);
      expect(Math.abs(readProbe(sim, controlId).position.x - startX)).toBeLessThan(0.05);
      sim.restore(save);
      expect(advance(30)).toEqual(expected);
      sim.restore(YardSim.decode(bytes));
      expect(advance(30)).toEqual(expected);
      advance(75);
      const released = readProbe(sim, probeId);
      expect(contactTypes.has('exit')).toBe(true);
      expect(released.position.x).toBeGreaterThan(BELT.center[0] + BELT.size[0] / 2 + 0.25);
      const rotation: Quat = [released.orientation.x, released.orientation.y, released.orientation.z, released.orientation.w];
      const halfHeight = [
        rotate([0.25, 0, 0], rotation),
        rotate([0, 0.25, 0], rotation),
        rotate([0, 0, 0.25], rotation),
      ].reduce((sum, axis) => sum + Math.abs(axis[1]), 0);
      expect(Math.abs(released.position.y - halfHeight - FLOOR_Y)).toBeLessThan(0.02);
      const support = sim.physics.world.latest().contacts.filter((contact) => contact.type !== 'exit'
        && (contact.bodyKeyA === probeId || contact.bodyKeyB === probeId));
      expect(support.some((contact) => contact.bodyKeyA === 'shell:floor' || contact.bodyKeyB === 'shell:floor')).toBe(true);
      expect(support.some((contact) => contact.bodyKeyA === BELT.key || contact.bodyKeyB === BELT.key)).toBe(false);
      expect(Math.abs(readProbe(sim, controlId).position.x - startX)).toBeLessThan(0.05);
    } finally {
      sim.release(save);
    }
  });
});
