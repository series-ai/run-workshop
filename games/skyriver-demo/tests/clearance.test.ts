/**
 * @file clearance.test.ts — R17 permanent loop-wide clearance: the autopilot camera sphere and the
 * shuttle hull stay outside every drawn concrete mass all the way around the loop (cycle-7: the
 * camera clipped into walls at 42.0 s and 45.9 s of the lap).
 */
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';

import { deriveCityLayout } from '../src/sim/derive';
import { auditRouteClearance } from '../src/render/clearance';
import { presentCityLayout } from '../src/render/presentationLayout';

/** main.ts SKYRIVER_DEMO_SEED (not imported: main.ts boots the app). */
const DEMO_SEED = 424242;

describe('route clearance', () => {
  it('keeps the camera and the shuttle outside every tower through the full loop', () => {
    const audit = auditRouteClearance(presentCityLayout(deriveCityLayout(DEMO_SEED)));
    if (process.env.SKYRIVER_CLEARANCE_OUT) writeFileSync(process.env.SKYRIVER_CLEARANCE_OUT, JSON.stringify(audit, null, 1));
    expect(audit.samples).toBeGreaterThan(6000);
    expect(audit.violations).toBe(0);
  });
});
