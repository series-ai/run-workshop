import { describe, expect, it } from 'vitest';
import { NEUTRAL_INPUT, TOOL, type YardInput } from '../sim/input';
import { applyLook, BUTTONS_UP, ignoreUntilRelease, pausedInput, pressButton } from './pointerMapping';

describe('look', () => {
  it('turns the view by the mouse motion and keeps the pitch in range', () => {
    const view = applyLook({ yaw: 0, pitch: 0 }, 100, -50, 0.002);
    expect(view.yaw).toBeCloseTo(-0.2, 9);
    expect(view.pitch).toBeCloseTo(0.1, 9);
    expect(applyLook({ yaw: 0, pitch: 1.4 }, 0, -1000, 0.002).pitch).toBe(1.45);
  });
});

describe('buttons', () => {
  it('maps the left button to the tool and the right button to punt', () => {
    const down = pressButton(pressButton(BUTTONS_UP, 0, true), 2, true);
    expect(down).toMatchObject({ primary: true, punt: true });
    expect(pressButton(down, 0, false)).toMatchObject({ primary: false, punt: true });
    expect(pressButton(BUTTONS_UP, 1, true)).toEqual(BUTTONS_UP);
  });

  it('ignores the press that started a capture until it is released', () => {
    const engaging = ignoreUntilRelease(pressButton(BUTTONS_UP, 0, true), 0);
    expect(engaging.primary).toBe(false);
    // The host may resend the held button after it captures.
    expect(pressButton(engaging, 0, true).primary).toBe(false);
    const released = pressButton(engaging, 0, false);
    expect(pressButton(released, 0, true).primary).toBe(true);
  });
});

describe('paused input', () => {
  it('keeps the view and the tool, and stops everything else', () => {
    const playing: YardInput = { ...NEUTRAL_INPUT, tool: TOOL.torch, yaw: 1234, pitch: -200, pressed: true, secondary: true, use: true, jetpack: true, moveX: 1, moveZ: -1 };
    expect(pausedInput(playing)).toEqual({ ...playing, pressed: false, secondary: false, use: false, jetpack: false, moveX: 0, moveZ: 0 });
  });
});
