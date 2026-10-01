import { describe, expect, it } from 'vitest';
import { TORCH_RANGE } from './constants';
import { NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from './input';
import { physicsStateBodyById } from './physics';
import type { YardSim } from './sim';
import { testSim } from './testSim';

type V = readonly [number, number, number];
const ray = (origin: V, target: V) => quantizeRay(origin, [target[0] - origin[0], target[1] - origin[1], target[2] - origin[2]]);
const settled = (): YardSim => {
  const sim = testSim(1);
  for (let i = 0; i < 20; i += 1) sim.step([NEUTRAL_INPUT]);
  return sim;
};
const click = (sim: YardSim, input: YardInput) => sim.step([input]);

describe('tool feedback', () => {
  it('reports a miss when the gravity gun ray hits nothing', () => {
    const state = click(settled(), { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...ray([5, 3, 8], [5, 30, 8]) });
    expect(state.players[0]!.grab).toBeNull();
    expect(state.players[0]!.feedback).toMatchObject({ result: 'miss', frame: state.frame });
  });

  it('reports blocked at the wall when the gravity gun hits static scenery', () => {
    const state = click(settled(), { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...ray([0, 0, 20], [0, 0, 30]) });
    const feedback = state.players[0]!.feedback!;
    expect(feedback.result).toBe('blocked');
    expect(feedback.point[2]).toBeCloseTo(25.7, 1);
  });

  it('does not grab a body through static scenery', () => {
    const sim = settled();
    const ball = physicsStateBodyById(sim.state.world, 'bowling-ball-1')!;
    // From below and beside the hopper platform, the ray passes through the platform first.
    const state = click(sim, { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...ray([ball.x, 1, ball.z + 4], [ball.x, ball.y, ball.z]) });
    expect(state.players[0]!.grab).toBeNull();
    expect(state.players[0]!.feedback!.result).toBe('blocked');
  });

  it('reports grab, then throw on release', () => {
    const sim = settled();
    const box = physicsStateBodyById(sim.state.world, 'ballast-box')!;
    const hold: YardInput = { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...ray([box.x, box.y + 6, box.z + 0.001], [box.x, box.y, box.z]) };
    let state = click(sim, hold);
    expect(state.players[0]!.feedback!.result).toBe('grab');
    state = click(sim, { ...hold, pressed: false });
    expect(state.players[0]!.feedback!.result).toBe('throw');
  });

  it('reports blocked when a punt target is out of range', () => {
    const sim = settled();
    const start = sim.state;
    const box = physicsStateBodyById(start.world, 'ballast-box')!;
    const state = click(sim, { ...NEUTRAL_INPUT, tool: TOOL.hand, secondary: true, ...ray([box.x, box.y + 20, box.z + 0.001], [box.x, box.y, box.z]) });
    expect(state.players[0]!.feedback!.result).toBe('blocked');
    expect(state.stats.throws).toBe(start.stats.throws);
  });

  it('scorches static scenery and cuts bodies with the torch', () => {
    // Both clicks start from the same settled yard.
    const sim = settled();
    const start = sim.save();
    const wall = click(sim, { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...ray([0, 0, 23.8], [0, 0, 30]) });
    expect(wall.players[0]!.feedback!.result).toBe('scorch');
    expect(wall.players[0]!.torch).toBeNull();
    const gantry = physicsStateBodyById(start.state.world, 'steel-gantry')!;
    sim.restore(start);
    sim.release(start);
    const body = click(sim, { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...ray([gantry.x + 0.2, gantry.y + 2.2, gantry.z + 0.001], [gantry.x + 0.2, gantry.y + 0.2, gantry.z]) });
    expect(body.players[0]!.feedback!.result).toBe('cut');
  });

  it('reaches only TORCH_RANGE: a body or wall farther away is a miss and is not cut', () => {
    // Both clicks start from the same settled yard.
    const sim = settled();
    const start = sim.save();
    const gantry = physicsStateBodyById(start.state.world, 'steel-gantry')!;
    const far = click(sim, { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...ray([gantry.x + 0.2, gantry.y + 5.2, gantry.z + 0.001], [gantry.x + 0.2, gantry.y + 0.2, gantry.z]) });
    expect(far.players[0]!.feedback!.result).toBe('miss');
    expect(far.players[0]!.torch).toBeNull();
    sim.restore(start);
    sim.release(start);
    const wall = click(sim, { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...ray([0, 0, 20], [0, 0, 30]) });
    expect(wall.players[0]!.feedback!.result).toBe('miss');
    expect(wall.players[0]!.feedback!.point[2]).toBeCloseTo(20 + TORCH_RANGE, 1);
  });
});
