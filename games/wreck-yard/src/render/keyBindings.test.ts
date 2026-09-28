import { describe, expect, it } from 'vitest';
import { isThrusterHeld, toolForKey } from './keyBindings';

describe('key bindings', () => {
  it('fires the thruster from Space and both delete keys', () => {
    for (const code of ['Space', 'Backspace', 'Delete']) expect(isThrusterHeld(new Set([code]))).toBe(true);
    expect(isThrusterHeld(new Set(['KeyW']))).toBe(false);
  });

  it('selects play tools from 1 and 2 and ignores 3', () => {
    expect(toolForKey('Digit1', 'torch', 'torch')).toBe('hand');
    expect(toolForKey('Digit2', 'orbit', 'hand')).toBe('torch');
    expect(toolForKey('Digit3', 'hand', 'hand')).toBeNull();
  });

  it('toggles orbit with O and returns to the last play tool', () => {
    expect(toolForKey('KeyO', 'torch', 'torch')).toBe('orbit');
    expect(toolForKey('KeyO', 'orbit', 'torch')).toBe('torch');
  });
});
