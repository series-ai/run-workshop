import { describe, expect, it } from 'vitest';
import { encodeState } from '../sim/codec';
import { createInitialState } from '../sim/presets';
import { interpolateYard, projectYard } from './presentation';

const context = { localSlot: 0, status: 'offline' as const };

describe('presentation', () => {
  it('projects one pose per yard body and no shell bodies', () => {
    const state = createInitialState(1);
    const render = projectYard(state, context);
    expect(render.poses.size).toBe(state.bodies.length);
    expect([...render.poses.keys()].some((id) => id.startsWith('shell:'))).toBe(false);
  });

  it('interpolates positions at alpha 0.5 to the midpoint', () => {
    const state = createInitialState(1);
    const moved = { ...state, frame: 1, world: { ...state.world, bodies: state.world.bodies.map((b) => (b.id === 'ballast-box' ? { ...b, x: b.x + 1 } : b)) } };
    const a = projectYard(state, context);
    const b = projectYard(moved, context);
    const mid = interpolateYard(a, b, 0.5);
    expect(mid.poses.get('ballast-box')!.position[0]).toBeCloseTo(a.poses.get('ballast-box')!.position[0] + 0.5, 9);
    expect(mid.bodies).toBe(b.bodies);
  });

  it('keeps hover out of serialized state', () => {
    const state = createInitialState(1);
    expect(new TextDecoder().decode(encodeState(state))).not.toContain('hover');
  });
});
