import { afterEach, describe, expect, it, onTestFinished } from 'vitest';
import { perfRecorder } from '../perf/recorder';
import { NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from '../sim/input';
import {
  addPhysicsBodies, makePhysicsBody, physicsBodyById, physicsStateBodyById,
  readWorldState, removePhysicsBody, replacePhysicsPose,
} from '../sim/physics';
import { YardSim } from '../sim/sim';
import { testSim } from '../sim/testSim';
import { MatchController, type MatchDeps } from './match';

const offlineDeps: MatchDeps = {
  createRoomTransport: async () => { throw new Error('Solo must not create a transport'); },
  quickMatchTransport: async () => { throw new Error('Solo must not find a transport'); },
  joinRoomTransport: async () => { throw new Error('Solo must not join a transport'); },
};

function checksum(sim: YardSim): Uint8Array {
  const save = sim.save();
  try { return sim.checksumBytes(save); }
  finally { sim.release(save); }
}

function aimAbove(x: number, y: number, z: number, height: number) {
  return quantizeRay([x, y + height, z + 0.001], [0, -height, -0.001]);
}

async function solo(): Promise<MatchController> {
  const controller = new MatchController(offlineDeps);
  onTestFinished(() => controller.stop());
  await controller.start({ kind: 'solo' });
  expect(controller.snapshot().status).toBe('live');
  return controller;
}

afterEach(() => perfRecorder.clear());

describe('native performance regressions', () => {
  it('keeps every checksum equal with telemetry off and on through grab, punt, cut, and seeded movement', () => {
    perfRecorder.clear();
    const baseline = testSim();
    const trace: YardInput[] = [];
    const expected: Uint8Array[] = [];
    const step = (input: YardInput) => {
      trace.push(input);
      baseline.step([input]);
      expected.push(checksum(baseline));
    };
    for (let tick = 0; tick < 30; tick += 1) step(NEUTRAL_INPUT);
    const ballast = physicsStateBodyById(baseline.state.world, 'ballast-box')!;
    const hold = { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...aimAbove(ballast.x, ballast.y, ballast.z, 6) };
    step(hold);
    expect(baseline.state.players[0]!.grab?.bodyId).toBe('ballast-box');
    for (let tick = 0; tick < 8; tick += 1) {
      step({ ...hold, ...aimAbove(ballast.x, ballast.y + 1, ballast.z, 6) });
    }
    step({ ...hold, secondary: true });
    expect(baseline.state.players[0]!.grab).toBeNull();
    expect(baseline.state.players[0]!.feedback?.result).toBe('punt');
    expect(baseline.state.stats.throws).toBe(1);
    step(NEUTRAL_INPUT);
    const gantry = physicsStateBodyById(baseline.state.world, 'steel-gantry')!;
    const cut = { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...aimAbove(gantry.x - 0.72, gantry.y + 0.36, gantry.z, 2) };
    for (let tick = 0; tick < 12; tick += 1) step(cut);
    expect(baseline.state.stats.torchCuts).toBeGreaterThan(0);
    expect(baseline.state.bodies.filter((body) => body.label === 'Steel Gantry').length).toBeGreaterThan(1);
    let seed = 0x5eeda11;
    for (let tick = 0; tick < 16; tick += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      step({ ...NEUTRAL_INPUT, moveX: (seed % 3) - 1, moveZ: ((seed >>> 8) % 3) - 1, yaw: (seed % 1201) - 600, jetpack: tick < 8 });
    }
    expect(perfRecorder.export().recordCount).toBe(0);

    const measured = testSim();
    let nativeSamples = 0;
    let checksumSamples = 0;
    for (const [tick, input] of trace.entries()) {
      // Each real step has its own bounded capture under a loaded test host.
      perfRecorder.start({ maxDurationMs: 60_000 });
      measured.step([input]);
      expect(checksum(measured), `tick ${tick + 1}`).toEqual(expected[tick]);
      const report = perfRecorder.export();
      nativeSamples += report.phaseSummary['sim.nativeStep']?.count ?? 0;
      checksumSamples += report.phaseSummary['checksum.encode']?.count ?? 0;
      expect(report.counterSummary['sim.bodyCount']?.min).toBeGreaterThan(400);
    }
    expect(nativeSamples).toBe(trace.length);
    expect(checksumSamples).toBe(trace.length);
  });

  it('reuses subscribed render results and updates moving poses on zero-step pumps', async () => {
    const controller = await solo();
    controller.setInput({ ...NEUTRAL_INPUT, moveZ: 1 });
    controller.pump(0);
    for (let tick = 1; tick <= 6; tick += 1) controller.pump(tick * 34);
    const before = controller.getRender()!;
    expect(controller.getRender()).toBe(before);
    expect(controller.snapshot().render).toBe(before);

    expect(controller.pump(209)).toBe(false);
    expect(controller.sampledInput).toBeNull();
    const first = controller.getRender()!;
    expect(first.frame).toBe(before.frame);
    expect(first).not.toBe(before);
    expect(first.players[0]!.position).not.toEqual(before.players[0]!.position);
    expect(controller.getRender()).toBe(first);
    expect(controller.snapshot().render).toBe(first);

    expect(controller.pump(214)).toBe(false);
    const second = controller.getRender()!;
    expect(second.frame).toBe(first.frame);
    expect(second.players[0]!.position).not.toEqual(first.players[0]!.position);
    expect(controller.getRender()).toBe(second);
    expect(controller.snapshot().render).toBe(second);
  });

  it('runs two native steps per pump and resumes a paused match without catch-up', async () => {
    const controller = await solo();
    controller.setInput({ ...NEUTRAL_INPUT, moveZ: 1 });
    controller.pump(0);
    const start = controller.getRender()!;
    expect(controller.pump(67)).toBe(true);
    const advanced = controller.getRender()!;
    expect(advanced.frame - start.frame).toBe(2);
    expect(advanced.players[0]!.position).not.toEqual(start.players[0]!.position);
    expect(controller.getRender()).toBe(advanced);

    controller.setPaused(true);
    expect(controller.pump(10_000)).toBe(false);
    expect(controller.getRender()).toBe(advanced);
    expect(controller.sampledInput).toBeNull();
    controller.setPaused(false);
    expect(controller.pump(20_000)).toBe(false);
    const resumed = controller.getRender()!;
    expect(resumed.frame).toBe(advanced.frame);
    expect(resumed.players[0]!.position).toEqual(advanced.players[0]!.position);
    expect(controller.pump(20_067)).toBe(true);
    expect(controller.getRender()!.frame).toBe(advanced.frame + 2);
    expect(controller.getRender()!.players[0]!.position).not.toEqual(resumed.players[0]!.position);
  });

  it('refreshes cached native IDs after same-count replacement and both restore paths', () => {
    const sim = testSim();
    const original = readWorldState(sim.physics);
    expect(readWorldState(sim.physics).bodyIds).toBe(original.bodyIds);
    const save = sim.save();
    const encoded = sim.encode(save);
    try {
      const removed = sim.state.bodies.find((body) => body.id === 'ballast-box')!;
      const replacement = { ...removed, id: 'performance-replacement' };
      removePhysicsBody(sim.physics, removed.id);
      addPhysicsBodies(sim.physics, [makePhysicsBody(replacement, {
        position: [12, 4, 12], rotation: [0, 0, 0, 1],
        linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0],
      })]);
      const changed = readWorldState(sim.physics);
      expect(changed.bodyIds).toHaveLength(original.bodyIds.length);
      expect(changed.bodyIds).not.toBe(original.bodyIds);
      expect(changed.bodies.some((body) => body.id === removed.id)).toBe(false);
      expect(changed.bodies.some((body) => body.id === replacement.id)).toBe(true);
      expect(sim.physics.world.resolveKey(removed.id)).toBeUndefined();
      for (const [name, id] of changed.bodyIds) {
        expect(sim.physics.world.resolveKey(name)?.id.toString(), name).toBe(id);
      }
      expect(readWorldState(sim.physics).bodyIds).toBe(changed.bodyIds);
      replacePhysicsPose(sim.physics, replacement.id, { x: 13, y: 5, z: 11, vx: 0.1, vy: 0, vz: 0 });
      const moved = readWorldState(sim.physics);
      expect(moved.bodyIds).toBe(changed.bodyIds);
      const { teleportCounter: _counter, ...motion } = moved.bodies.find((body) => body.id === replacement.id)!;
      expect(motion).toEqual(physicsBodyById(sim.physics, replacement.id));
      expect(motion.x).toBe(13);

      for (const restoredSave of [save, YardSim.decode(encoded)]) {
        const beforeRestore = readWorldState(sim.physics).bodyIds;
        sim.restore(restoredSave);
        const restored = readWorldState(sim.physics);
        expect(restored.bodyIds).not.toBe(beforeRestore);
        expect(restored.bodyIds).toEqual(original.bodyIds);
        expect(restored.bodies).toEqual(original.bodies);
        expect(readWorldState(sim.physics).bodyIds).toBe(restored.bodyIds);
        expect(sim.physics.world.resolveKey(replacement.id)).toBeUndefined();
        for (const [name, id] of restored.bodyIds) {
          expect(sim.physics.world.resolveKey(name)?.id.toString(), name).toBe(id);
        }
      }
    } finally { sim.release(save); }
  });
});
