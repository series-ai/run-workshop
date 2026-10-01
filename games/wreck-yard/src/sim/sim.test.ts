import { describe, expect, it } from 'vitest';
import { NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from './input';
import { physicsStateBodyById } from './physics';
import { YardSim, type YardSave } from './sim';
import { testSim } from './testSim';

function aim(target: readonly [number, number, number], height: number): Pick<YardInput, 'ox' | 'oy' | 'oz' | 'dx' | 'dy' | 'dz'> {
  const origin = [target[0], target[1] + height, target[2] + 0.001] as const;
  return quantizeRay(origin, [target[0] - origin[0], target[1] - origin[1], target[2] - origin[2]]);
}

/**
 * 150 ticks that use most of the sim: props settle, the torch cuts the gantry
 * (fractures add bodies), and the gravity gun grabs, carries, and drops a box.
 */
function scriptedInputs(): readonly YardInput[] {
  const sim = testSim();
  const gantry = physicsStateBodyById(sim.state.world, 'steel-gantry')!;
  const ballast = physicsStateBodyById(sim.state.world, 'ballast-box')!;
  const inputs: YardInput[] = [];
  for (let tick = 0; tick < 150; tick += 1) {
    if (tick < 20) inputs.push(NEUTRAL_INPUT);
    else if (tick < 80) inputs.push({ ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: tick % 20 !== 19, ...aim([gantry.x + 0.2 - (tick % 20) * 0.03, gantry.y + 0.2, gantry.z], 2) });
    else if (tick < 130) inputs.push({ ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...aim([ballast.x + Math.sin(tick / 12), ballast.y + 1.5, ballast.z], 6) });
    else inputs.push(NEUTRAL_INPUT);
  }
  return inputs;
}

/** Encoded saves at every 10th tick: the bytes that peers checksum and late joiners load. */
function run(stepOne: (sim: YardSim, input: YardInput) => void): Uint8Array[] {
  const sim = testSim();
  const out: Uint8Array[] = [];
  for (const [tick, input] of scriptedInputs().entries()) {
    stepOne(sim, input);
    if (tick % 10 === 9) {
      const save = sim.save();
      out.push(sim.encode(save));
      sim.release(save);
    }
  }
  return out;
}

describe('YardSim', () => {
  it('cuts the gantry in the scripted session, so the parity tests cover fractures', () => {
    const sim = testSim();
    const before = sim.state.bodies.length;
    for (const input of scriptedInputs()) sim.step([input]);
    expect(sim.state.stats.torchCuts + sim.state.stats.fractures).toBeGreaterThan(0);
    expect(sim.state.bodies.length).toBeGreaterThan(before);
  });

  // Peers that roll back step from a restored world; peers that do not step the
  // live world on. Any solver state outside the checkpoint would split them.
  it('a world restored from a native save before every tick matches a world that steps on', () => {
    const stepOn = run((sim, input) => { sim.step([input]); });
    const rollback = run((sim, input) => {
      const save = sim.save();
      sim.step([input]);
      sim.restore(save);
      sim.step([input]);
      sim.release(save);
    });
    expect(rollback).toEqual(stepOn);
  });

  it('a world loaded from encoded bytes before every tick matches a world that steps on', () => {
    const stepOn = run((sim, input) => { sim.step([input]); });
    const loaded = run((sim, input) => {
      const save = sim.save();
      const bytes = sim.encode(save);
      sim.release(save);
      const decoded: YardSave = YardSim.decode(bytes);
      sim.restore(decoded);
      sim.step([input]);
    });
    expect(loaded).toEqual(stepOn);
  });

  it('round trips a save through bytes', () => {
    const sim = testSim();
    for (const input of scriptedInputs().slice(0, 60)) sim.step([input]);
    const save = sim.save();
    const bytes = sim.encode(save);
    const decoded = YardSim.decode(bytes);
    expect(decoded.state.frame).toBe(save.state.frame);
    expect(sim.encode(decoded)).toEqual(bytes);
    sim.release(save);
  });

  it('counts each change to the live world in its revision', () => {
    const sim = testSim();
    const start = sim.revision;
    const save = sim.save();
    expect(sim.revision).toBe(start);
    sim.step([NEUTRAL_INPUT]);
    expect(sim.revision).toBe(start + 1n);
    sim.restore(save);
    expect(sim.revision).toBe(start + 2n);
    expect(sim.state.frame).toBe(save.state.frame);
    sim.release(save);
  });

  it('rejects a released save', () => {
    const sim = testSim();
    const save = sim.save();
    sim.release(save);
    expect(() => sim.restore(save)).toThrow();
  });
});
