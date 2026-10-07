/**
 * @file anchors.test.ts — R16 global anchor pass: every trim holds its place on its owner through
 * the full loop's warp (operator report: masts and vents floating off their buildings at bends).
 */
import { describe, expect, it } from 'vitest';

import { deriveCityLayout } from '../src/sim/derive';
import { auditCityAnchors, deriveHeroBlades, deriveNeonSigns } from '../src/render/city';
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

describe('signs under their roofs', () => {
  it('keeps every facade and hero sign below the roof of the slab it stands on (R17 podium lots)', () => {
    const layout = presentCityLayout(deriveCityLayout(DEMO_SEED));
    const signs = deriveNeonSigns(layout);
    let above = 0;
    for (let i = 0; i < signs.count; i += 1) {
      const owner = signs.owner[i];
      if (!owner) continue;
      const tower = layout.towers.find((t) => t.x === owner.x && t.z === owner.z);
      if (tower !== undefined && signs.cy[i]! + signs.sh[i]! / 2 > tower.height + 1) above += 1;
    }
    for (const hero of deriveHeroBlades(layout)) {
      if (hero.kind === 'brand') continue;
      const slabs = layout.towers.filter((t) => Math.sign(t.x) === Math.sign(hero.x) && Math.abs(t.z - hero.z) < t.depth / 2 + 5);
      if (slabs.length === 0) continue;
      const slab = slabs.reduce((best, t) => (Math.abs(t.x) < Math.abs(best.x) ? t : best));
      if (hero.y + hero.height / 2 > slab.height + 1) above += 1;
    }
    expect(above).toBe(0);
  });
});
