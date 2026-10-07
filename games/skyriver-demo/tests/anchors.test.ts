/**
 * @file anchors.test.ts — R16 global anchor pass: every trim holds its place on its owner through
 * the full loop's warp (operator report: masts and vents floating off their buildings at bends).
 */
import { describe, expect, it } from 'vitest';

import { deriveCityLayout } from '../src/sim/derive';
import { auditCityAnchors } from '../src/render/city';
import { presentCityLayout } from '../src/render/presentationLayout';

/** main.ts SKYRIVER_DEMO_SEED (not imported: main.ts boots the app). */
const DEMO_SEED = 424242;

describe('city trim anchors', () => {
  it('keeps every trim and facade sign on its owner all around the loop', () => {
    const audit = auditCityAnchors(presentCityLayout(deriveCityLayout(DEMO_SEED)));
    expect(audit.checked).toBeGreaterThan(5000);
    expect(audit.floating).toBe(0);
    expect(audit.maxDriftM).toBeLessThan(0.05);
    expect(audit.signsChecked).toBeGreaterThan(1000);
    expect(audit.signsOffFace).toBe(0);
    expect(audit.signMaxDriftM).toBeLessThan(0.05);
  });
});
