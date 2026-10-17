import { describe, expect, it } from 'vitest';
import type { PhysicsLatestOutputs3D } from '@series-inc/rundot-syncplay/physics/3d';
import { FLOOR_Y, TICK_RATE } from './constants';
import { NEUTRAL_INPUT } from './input';
import {
  addPhysicsBodies,
  makePhysicsBody,
  physicsBodyById,
  poseOf,
  readWorldState,
  removePhysicsBody,
  replacePhysicsPose,
  type OpenYardPhysicsWorld,
} from './physics';
import { RETURNS_PAIR } from './returns';
import { YardSim } from './sim';
import { testSim } from './testSim';

const STRADDLER = 'shipping-returns-35';

function straddlingSim(): YardSim {
  const sim = testSim();
  sim.edit((physics) => replacePhysicsPose(physics, STRADDLER, {
    x: -3.2, y: FLOOR_Y + 1.6, z: 19.5, vx: 0, vy: 0, vz: 8 / TICK_RATE,
  }));
  sim.step([NEUTRAL_INPUT]);
  expect(sim.state.world.portalStraddlers?.some((entry) => entry.bodyId === STRADDLER)).toBe(true);
  return sim;
}

// This observer forwards every operation to the real engine without changing its result.
function observeLatest(open: OpenYardPhysicsWorld): { open: OpenYardPhysicsWorld; reads(): number } {
  let reads = 0;
  const latest = open.world.latest;
  return {
    open: { ...open, world: {
      ...open.world,
      latest: () => { reads += 1; return latest(); },
    } },
    reads: () => reads,
  };
}

function cachedRead(open: OpenYardPhysicsWorld, latest: Pick<PhysicsLatestOutputs3D, 'portalStraddlers'>) {
  return readWorldState(open, undefined, latest);
}

function liveBytes(sim: YardSim): Uint8Array {
  const save = sim.save();
  try { return sim.encode(save); } finally { sim.release(save); }
}

describe('world reads with step outputs against the native engine', () => {
  it('matches the live output without another full latest read', () => {
    const sim = straddlingSim();
    const latest = sim.physics.world.latest();
    const observed = observeLatest(sim.physics);
    const reused = readWorldState(observed.open, latest.fluidInteractions, latest);
    expect(reused).toEqual(readWorldState(sim.physics, latest.fluidInteractions));
    expect(observed.reads()).toBe(0);
    readWorldState(observed.open);
    expect(observed.reads()).toBe(1);
  });

  it('keeps a supplied empty step output separate from a live read', () => {
    const sim = straddlingSim();
    const earlierEmpty = testSim().physics.world.latest();
    expect(earlierEmpty.portalStraddlers ?? []).toHaveLength(0);
    expect(cachedRead(sim.physics, earlierEmpty).portalStraddlers).toEqual([]);
    expect(readWorldState(sim.physics).portalStraddlers?.some((entry) => entry.bodyId === STRADDLER)).toBe(true);
  });

  it('drops the removed native ID when a replacement keeps the same game key', () => {
    const sim = straddlingSim();
    const latest = sim.physics.world.latest();
    const oldNativeId = sim.physics.bodyIds.get(STRADDLER)!;
    expect(latest.portalStraddlers?.some((entry) => entry.bodyId === oldNativeId)).toBe(true);
    const body = sim.state.bodies.find((entry) => entry.id === STRADDLER)!;
    const definition = makePhysicsBody(body, poseOf(physicsBodyById(sim.physics, STRADDLER)!));
    removePhysicsBody(sim.physics, STRADDLER);
    addPhysicsBodies(sim.physics, [definition]);
    expect(sim.physics.bodyIds.get(STRADDLER)).not.toBe(oldNativeId);
    const reused = cachedRead(sim.physics, latest);
    expect(reused).toEqual(readWorldState(sim.physics));
    expect(reused.portalStraddlers?.some((entry) => entry.bodyId === STRADDLER)).toBe(false);
    expect(reused.bodies.some((entry) => entry.id === STRADDLER)).toBe(true);
  });

  it('reads current body motion after an edit instead of using old step motion', () => {
    const sim = straddlingSim();
    const latest = sim.physics.world.latest();
    replacePhysicsPose(sim.physics, 'ballast-box', { x: 7, y: 2, z: 9, vx: 0.3, vy: 0, vz: 0.2 });
    const reused = cachedRead(sim.physics, latest);
    expect(reused).toEqual(readWorldState(sim.physics));
    expect(reused.frame).toBe(Number(sim.physics.world.info().frame));
    const body = reused.bodies.find((entry) => entry.id === 'ballast-box')!;
    expect(body.x).toBe(7);
    expect(body.y).toBe(2);
    expect(body.z).toBe(9);
    expect(body.vx).toBeCloseTo(0.3, 12);
    expect(body.vz).toBeCloseTo(0.2, 12);
  });

  it.each(['close', 'move', 'remove'] as const)('uses a live read after a portal pair %s operation', (operation) => {
    const sim = straddlingSim();
    const oldStep = sim.physics.world.latest();
    expect(oldStep.portalStraddlers?.length).toBeGreaterThan(0);
    sim.physics.world.edit((ops) => {
      const pair = { id: RETURNS_PAIR.id };
      if (operation === 'close') ops.setPortalOpen(pair, false);
      else if (operation === 'remove') ops.removePortalPair(pair);
      else ops.movePortalEnd(pair, 'A', {
        position: { ...RETURNS_PAIR.portalA.position, z: 22 },
        rotation: RETURNS_PAIR.portalA.rotation,
      });
    });
    expect(oldStep.portalStraddlers?.length).toBeGreaterThan(0);
    expect(readWorldState(sim.physics).portalStraddlers).toEqual([]);
  });

  it('keeps exact portal replay through native and serialized saves', () => {
    const sim = straddlingSim();
    const save = sim.save();
    try {
      const bytes = sim.encode(save);
      const advance = () => {
        for (let tick = 0; tick < 15; tick++) {
          sim.step([NEUTRAL_INPUT]);
          const live = sim.physics.world.latest();
          expect(sim.state.world).toEqual(readWorldState(sim.physics, live.fluidInteractions));
        }
        return liveBytes(sim);
      };
      const expected = advance();
      sim.restore(save);
      expect(advance()).toEqual(expected);
      const decoded = YardSim.decode(bytes);
      try { sim.restore(decoded); expect(advance()).toEqual(expected); }
      finally { sim.release(decoded); }
    } finally {
      sim.release(save);
    }
  });
});
