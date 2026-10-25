import { describe, expect, it } from 'vitest';
import { initialState, testSim } from '../sim/testSim';
import { interpolateYard, projectYard } from './presentation';

const context = { localSlot: 0, status: 'offline' as const };

describe('presentation', () => {
  it('projects one pose per yard body and no shell bodies', () => {
    const state = initialState(1);
    const render = projectYard(state, context);
    expect(render.poses.size).toBe(state.bodies.length + 1);
    expect(render.poses.has('storage-elevator')).toBe(true);
    expect([...render.poses.keys()].some((id) => id.startsWith('shell:'))).toBe(false);
  });

  it('interpolates positions at alpha 0.5 to the midpoint', () => {
    const state = initialState(1);
    const moved = { ...state, frame: 1, world: { ...state.world, bodies: state.world.bodies.map((b) => (b.id === 'ballast-box' ? { ...b, x: b.x + 1 } : b)) } };
    const a = projectYard(state, context);
    const b = projectYard(moved, context);
    const mid = interpolateYard(a, b, 0.5);
    expect(mid.poses.get('ballast-box')!.position[0]).toBeCloseTo(a.poses.get('ballast-box')!.position[0] + 0.5, 9);
    expect(mid.bodies).toBe(b.bodies);
  });

  it('keeps hover out of serialized state', () => {
    const sim = testSim(1);
    const save = sim.save();
    expect(new TextDecoder().decode(sim.encode(save))).not.toContain('hover');
    sim.release(save);
  });
  it('interpolates the suspension and continuous wheel rotation', () => {
    const state = initialState(1);
    const before = projectYard({ ...state, buggyWheels: [{ compression: 0.02, steerAngleTurns: 0, spinTurns: 0.95, grounded: true }] }, context);
    const after = projectYard({ ...state, buggyWheels: [{ compression: 0.12, steerAngleTurns: 0.06, spinTurns: 1.05, grounded: true }] }, context);
    const wheel = interpolateYard(before, after, 0.5).buggyWheels![0]!;
    expect(wheel.compression).toBeCloseTo(0.07);
    expect(wheel.steerAngleTurns).toBeCloseTo(0.03);
    expect(wheel.spinTurns).toBeCloseTo(1.0);
  });

});
