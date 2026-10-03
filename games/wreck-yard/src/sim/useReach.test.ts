import { describe, expect, it } from 'vitest';
import { FLOOR_Y, withinBuggyMountRange } from './constants';
import { BUTTONS, buttonResetLeft, buttonWithinReach, CATAPULT, DROP_COOLDOWN_TICKS } from './contraptions';
import { INITIAL_CONTRAPTIONS } from './state';

describe('use reach', () => {
  it('presses a button from 2.5 m away, not from 2.7 m', () => {
    const [x, , z] = BUTTONS[0]!.base;
    expect(buttonWithinReach([x + 2.5, FLOOR_Y + 0.4, z])).toBe(BUTTONS[0]!.id);
    expect(buttonWithinReach([x + 2.7, FLOOR_Y + 0.4, z])).toBeNull();
  });

  it('gets into the buggy from 3.5 m away, not from 3.7 m', () => {
    expect(withinBuggyMountRange([3.5, 0, 0], [0, 0, 0])).toBe(true);
    expect(withinBuggyMountRange([3.7, 0, 0], [0, 0, 0])).toBe(false);
  });
});

describe('buttonResetLeft', () => {
  it('is 1 on the press, falls over the reset time, and is 0 when the button is ready again', () => {
    const pressed = { ...INITIAL_CONTRAPTIONS, lastDropFrame: 100, lastLaunchFrame: 200 };
    expect(buttonResetLeft('dropper', pressed, 100)).toBe(1);
    expect(buttonResetLeft('dropper', pressed, 100 + DROP_COOLDOWN_TICKS / 3)).toBeCloseTo(2 / 3);
    expect(buttonResetLeft('dropper', pressed, 100 + DROP_COOLDOWN_TICKS)).toBe(0);
    expect(buttonResetLeft('catapult', pressed, 200 + CATAPULT.cooldownTicks - 1)).toBeGreaterThan(0);
    expect(buttonResetLeft('catapult', pressed, 200 + CATAPULT.cooldownTicks)).toBe(0);
    expect(buttonResetLeft('dropper', INITIAL_CONTRAPTIONS, 0)).toBe(0);
  });
});
