/**
 * @file impostors.test.ts — R18 GPU impostor traffic: the attribute generation is pure and seeded,
 * the paths' shares come out as designed, motion is continuous (no teleports, including across the
 * loop seam), and the canyon impostors never fly inside a building. impostorPosition is the CPU
 * mirror of the vertex shader's math.
 */
import { describe, expect, it } from 'vitest';

import { deriveCityLayout } from '../src/sim/derive';
import { createMassField } from '../src/render/clearance';
import { presentCityLayout } from '../src/render/presentationLayout';
import { IMPOSTOR_FREE_INDEX, IMPOSTOR_PATHS, IMPOSTOR_PATH_COUNT, deriveImpostorAttributes, impostorPosition } from '../src/render/trafficStreams';

/** main.ts SKYRIVER_DEMO_SEED (not imported: main.ts boots the app). */
const DEMO_SEED = 424242;

describe('GPU impostor traffic', () => {
  it('generates pure, seeded, in-range attributes', () => {
    const a = deriveImpostorAttributes(DEMO_SEED, 20000);
    const b = deriveImpostorAttributes(DEMO_SEED, 20000);
    const c = deriveImpostorAttributes(DEMO_SEED + 1, 20000);
    expect(Array.from(a.streamArcPhaseSeed)).toEqual(Array.from(b.streamArcPhaseSeed));
    expect(Array.from(a.row)).toEqual(Array.from(b.row));
    expect(Array.from(a.streamArcPhaseSeed.slice(0, 400))).not.toEqual(Array.from(c.streamArcPhaseSeed.slice(0, 400)));
    // A smaller count is a prefix of a larger one (tiers draw prefixes).
    expect(Array.from(deriveImpostorAttributes(DEMO_SEED, 500).streamArcPhaseSeed)).toEqual(Array.from(a.streamArcPhaseSeed.slice(0, 2000)));
    for (let i = 0; i < a.count; i += 1) {
      const k = a.streamArcPhaseSeed[i * 4]!;
      expect(Number.isInteger(k) && k >= 0 && k < IMPOSTOR_PATH_COUNT).toBe(true);
      for (let j = 1; j < 4; j += 1) {
        const x = a.streamArcPhaseSeed[i * 4 + j]!;
        expect(x >= 0 && x < 1).toBe(true);
      }
      expect(a.row[i]! >= 0 && a.row[i]! < 1).toBe(true);
    }
  });

  it('splits across canyon streams, canyon lanes, sky rings and free floaters as designed', () => {
    const a = deriveImpostorAttributes(DEMO_SEED, 20000);
    const n = [0, 0, 0, 0];
    for (let i = 0; i < a.count; i += 1) {
      const k = a.streamArcPhaseSeed[i * 4]!;
      n[k < 8 ? 0 : k < IMPOSTOR_PATHS.length ? 1 : k < IMPOSTOR_FREE_INDEX ? 2 : 3] += 1;
    }
    const share = n.map((x) => x / a.count);
    expect(Math.abs(share[0]! - 0.25)).toBeLessThan(0.02);
    expect(Math.abs(share[1]! - 0.1)).toBeLessThan(0.02);
    expect(Math.abs(share[2]! - 0.2)).toBeLessThan(0.02);
    expect(Math.abs(share[3]! - 0.45)).toBeLessThan(0.02);
  });

  it('never stacks impostors on one spot (no correlated attributes)', () => {
    const a = deriveImpostorAttributes(DEMO_SEED, 20000);
    const p = { x: 0, y: 0, z: 0, dx: 0, dz: 0 };
    for (const t of [10, 38, 77]) {
      const cells = new Map<string, number>();
      let shared = 0;
      for (let i = 0; i < a.count; i += 1) {
        impostorPosition(a, i, t, p);
        const key = `${Math.round(p.x / 3)}:${Math.round(p.y / 3)}:${Math.round(p.z / 3)}`;
        const n = cells.get(key) ?? 0;
        if (n > 0) shared += 1;
        cells.set(key, n + 1);
      }
      expect(shared / a.count).toBeLessThan(0.005);
    }
  });

  it('moves continuously: no step over 25 m per 1/30 s, across the loop seam included', () => {
    const a = deriveImpostorAttributes(DEMO_SEED, 3000);
    const p = { x: 0, y: 0, z: 0, dx: 0, dz: 0 };
    const q = { x: 0, y: 0, z: 0, dx: 0, dz: 0 };
    let worst = 0;
    // 100 s covers a full loop for the slow streams' seam crossings at many phases.
    for (let i = 0; i < a.count; i += 1) {
      impostorPosition(a, i, 0, p);
      for (let f = 1; f <= 3000; f += 1) {
        impostorPosition(a, i, f / 30, q);
        worst = Math.max(worst, Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z));
        p.x = q.x; p.y = q.y; p.z = q.z;
      }
    }
    expect(worst).toBeLessThan(25);
  });

  it('keeps every canyon impostor out of the buildings; reports the sky rings', () => {
    const field = createMassField(presentCityLayout(deriveCityLayout(DEMO_SEED)));
    const a = deriveImpostorAttributes(DEMO_SEED, 4000);
    const p = { x: 0, y: 0, z: 0, dx: 0, dz: 0 };
    let canyonInside = 0;
    let canyonSamples = 0;
    let ringInside = 0;
    let ringSamples = 0;
    for (let i = 0; i < a.count; i += 1) {
      const ring = a.streamArcPhaseSeed[i * 4]! >= IMPOSTOR_PATHS.length && a.streamArcPhaseSeed[i * 4]! < IMPOSTOR_FREE_INDEX;
      for (let t = 0; t < 120; t += 4) {
        impostorPosition(a, i, t, p);
        const inside = field.gap(p.x, p.y, p.z) < 0;
        if (ring) { ringSamples += 1; if (inside) ringInside += 1; } else { canyonSamples += 1; if (inside) canyonInside += 1; }
      }
    }
    if (process.env.SKYRIVER_IMPOSTOR_OUT) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('node:fs').writeFileSync(process.env.SKYRIVER_IMPOSTOR_OUT, JSON.stringify({ canyonSamples, canyonInside, ringSamples, ringInside, ringInsideShare: ringInside / ringSamples }));
    }
    expect(canyonSamples).toBeGreaterThan(50000);
    expect(canyonInside).toBe(0);
  });
});
