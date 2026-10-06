import { describe, it, expect } from 'vitest';

describe('skyriver scaffold (T1)', () => {
  it('imports the syncplay browser entry without DOM failures', async () => {
    const syncplay = await import('@series-inc/rundot-syncplay/browser');
    expect(typeof syncplay.createSyncplayRunner).toBe('function');
  });

  it('imports syncplay root-entry deterministic math/noise', async () => {
    const root = await import('@series-inc/rundot-syncplay');
    expect(typeof root.createDeterministicMath).toBe('function');
    expect(typeof root.fbm2D).toBe('function');
    expect(typeof root.DeterministicRandom).toBe('function');
  });
});
