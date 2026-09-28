import { describe, expect, it } from 'vitest';
import { bodyOutlineColor } from './bodyOutline';
import { projectYard } from './presentation';
import { createInitialState } from '../sim/presets';

describe('body selection', () => {
  it('follows a grab and release without a body update', () => {
    const render = projectYard(createInitialState(1), { localSlot: 0, status: 'offline' });
    const grabbed = { ...render, grabbed: ['ballast-box'] };
    expect(bodyOutlineColor('ballast-box', null, render)).toBeNull();
    expect(bodyOutlineColor('ballast-box', null, grabbed)).toBe('#d4efff');
    expect(bodyOutlineColor('ballast-box', null, render)).toBeNull();
  });
});
