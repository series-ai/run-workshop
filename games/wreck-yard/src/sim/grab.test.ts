import { describe, expect, it } from 'vitest';
import { DT, GRAB_TARGET_ACCEL, GRAB_TARGET_MAX_SPEED } from './constants';
import { advanceHoldPoint, type HoldPoint } from './grab';
import { length, sub, type Vec3 } from './math';

function travel(start: HoldPoint, aim: Vec3, ticks: number): HoldPoint[] {
  const path: HoldPoint[] = [];
  let hold = start;
  for (let i = 0; i < ticks; i += 1) {
    hold = advanceHoldPoint(hold, aim);
    path.push(hold);
  }
  return path;
}

describe('advanceHoldPoint', () => {
  const rest: HoldPoint = { point: [0, 0, 0], velocity: [0, 0, 0] };

  it('arrives at the aim and stops without passing it', () => {
    const path = travel(rest, [0, 3, 0], 60);
    expect(path.at(-1)).toEqual({ point: [0, 3, 0], velocity: [0, 0, 0] });
    expect(Math.max(...path.map((hold) => hold.point[1]))).toBeLessThanOrEqual(3);
  });

  it('never exceeds the speed or acceleration limits before arrival', () => {
    const aim: Vec3 = [4, 3, -2];
    const path = travel(rest, aim, 90);
    // The last one or two ticks land exactly on the aim and zero the velocity.
    // That small snap is allowed; the body-level overshoot test covers its effect.
    const moving = path.filter((hold) => length(sub(aim, hold.point)) > 0.05);
    expect(moving.length).toBeGreaterThan(20);
    let previous = rest.velocity;
    for (const hold of moving) {
      expect(length(hold.velocity) / DT).toBeLessThanOrEqual(GRAB_TARGET_MAX_SPEED + 1e-9);
      expect(length(sub(hold.velocity, previous)) / (DT * DT)).toBeLessThanOrEqual(GRAB_TARGET_ACCEL + 1e-6);
      previous = hold.velocity;
    }
  });
});
