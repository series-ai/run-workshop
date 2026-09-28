import { describe, expect, it } from 'vitest';
import { ARENA_EXTENT, FLOOR_Y } from '../sim/constants';
import { chaseCameraPose, showsLocalAvatar } from './chaseCamera';

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
