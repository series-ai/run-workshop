import { describe, expect, it } from 'vitest';
import { BUGGY_MOUNT_RANGE, withinBuggyMountRange } from './constants';

describe('withinBuggyMountRange', () => {
  it('uses one 3D range for the sim and the HUD prompt', () => {
    expect(withinBuggyMountRange([0, 0, BUGGY_MOUNT_RANGE - 0.01], [0, 0, 0])).toBe(true);
    expect(withinBuggyMountRange([0, 0, BUGGY_MOUNT_RANGE + 0.01], [0, 0, 0])).toBe(false);
    // Height counts: a player on a roof above the buggy is out of range.
    expect(withinBuggyMountRange([0, 3, 0], [0, 0, 0])).toBe(false);
  });
});
