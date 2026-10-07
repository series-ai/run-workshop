/**
 * @file trails.test.ts — R17: light trails stay rods (cycle-7: long thin trails read as lane lines).
 * The browser road-gate probe measures the on-screen ratio; this holds the limits it relies on.
 */
import { describe, expect, it } from 'vitest';

import { TRAFFIC_CAR_LENGTH_M, TRAIL_END_WIDTH_SHARE, TRAIL_MAX_CAR_LENGTHS } from '../src/render/traffic';

describe('light trails', () => {
  it('are capped at 2 car lengths and taper toward the end', () => {
    expect(TRAIL_MAX_CAR_LENGTHS).toBeGreaterThanOrEqual(1.5);
    expect(TRAIL_MAX_CAR_LENGTHS).toBeLessThanOrEqual(2);
    expect(TRAIL_END_WIDTH_SHARE).toBeLessThan(0.6);
    expect(TRAFFIC_CAR_LENGTH_M).toBeGreaterThan(3);
  });
});
