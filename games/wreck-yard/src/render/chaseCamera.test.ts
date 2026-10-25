import { describe, expect, it } from 'vitest';
import { ARENA_EXTENT, FLOOR_Y } from '../sim/constants';
import { CHASE_RECENTER_DELAY, chaseCameraPose, recenterChaseView, showsLocalAvatar } from './chaseCamera';

describe('chaseCameraPose', () => {
  it('sits behind and above the buggy and looks ahead of it', () => {
    // Yaw 0 faces -Z, so "behind" is +Z.
    const pose = chaseCameraPose([0, 0, 0], 0, 0);
    expect(pose.position[2]).toBeGreaterThan(4);
    expect(pose.position[1]).toBeGreaterThan(1.5);
    expect(Math.abs(pose.position[0])).toBeLessThan(1e-9);
    expect(pose.lookAt[2]).toBeLessThan(0);
  });

  it('follows the heading', () => {
    const pose = chaseCameraPose([0, 0, 0], Math.PI / 2, 0);
    // Yaw +90° faces -X, so the camera is on +X.
    expect(pose.position[0]).toBeGreaterThan(4);
  });

  it('stays inside the arena and above the floor', () => {
    const nearWall = chaseCameraPose([ARENA_EXTENT - 1, 0, 0], -Math.PI / 2, 0);
    expect(nearWall.position[0]).toBeLessThan(ARENA_EXTENT);
    const lookingUp = chaseCameraPose([0, FLOOR_Y, 0], 0, 1.4);
    expect(lookingUp.position[1]).toBeGreaterThan(FLOOR_Y);
  });

  it('shows the local avatar only in orbit or while driving', () => {
    expect(showsLocalAvatar('hand', false)).toBe(false);
    expect(showsLocalAvatar('hand', true)).toBe(true);
    expect(showsLocalAvatar('orbit', false)).toBe(true);
  });
});

describe('recenterChaseView', () => {
  const view = { yaw: 1.0, pitch: 0.4 };
  const settled = CHASE_RECENTER_DELAY + 1;
  const drive = (start: typeof view, chassisYaw: number, speed: number, seconds: number) => {
    let current = start;
    for (let t = 0; t < seconds; t += 1 / 60) current = recenterChaseView(current, chassisYaw, speed, settled, 1 / 60);
    return current;
  };

  it('turns the view back to the heading while driving forward', () => {
    const after = drive(view, 0, 8, 3);
    expect(Math.abs(after.yaw)).toBeLessThan(0.05);
    expect(Math.abs(after.pitch)).toBeLessThan(0.05);
  });

  it('is slow: one frame moves the view only a little', () => {
    const next = recenterChaseView(view, 0, 8, settled, 1 / 60);
    expect(view.yaw - next.yaw).toBeGreaterThan(0);
    expect(view.yaw - next.yaw).toBeLessThan(0.03);
  });

  it('leaves the view alone while standing, reversing, or soon after a mouse look', () => {
    expect(recenterChaseView(view, 0, 0.5, settled, 1 / 60)).toBe(view);
    expect(recenterChaseView(view, 0, -6, settled, 1 / 60)).toBe(view);
    expect(recenterChaseView(view, 0, 8, CHASE_RECENTER_DELAY * 0.5, 1 / 60)).toBe(view);
  });

  it('recenters faster at higher speed', () => {
    const slow = recenterChaseView(view, 0, 2, settled, 1 / 60);
    const fast = recenterChaseView(view, 0, 8, settled, 1 / 60);
    expect(view.yaw - fast.yaw).toBeGreaterThan(view.yaw - slow.yaw);
  });

  it('turns the short way across the ±π seam and never overshoots', () => {
    const after = drive({ yaw: 3.0, pitch: 0 }, -3.0, 8, 0.5);
    // The short way from 3.0 to -3.0 goes up through π, not down through 0.
    expect(after.yaw).toBeGreaterThan(3.0);
    const done = drive({ yaw: 3.0, pitch: 0 }, -3.0, 8, 10);
    expect(Math.abs(Math.atan2(Math.sin(done.yaw + 3.0), Math.cos(done.yaw + 3.0)))).toBeLessThan(0.01);
  });
});
