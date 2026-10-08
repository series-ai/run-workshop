/**
 * @file impostors.test.ts — R18 GPU impostor traffic: the attribute generation is pure and seeded,
 * the paths' shares come out as designed, motion is continuous (no teleports, including across the
 * loop seam), and the canyon impostors never fly inside a building. impostorPosition is the CPU
 * mirror of the vertex shader's math.
 */
import { describe, expect, it } from 'vitest';

import { deriveCityLayout } from '../src/sim/derive';
import { SKYRIVER_EMISSIVE_GAIN } from '../src/render/atmosphere';
import { createMassField } from '../src/render/clearance';
import { deriveCityMasses, deriveCityTrims } from '../src/render/city';
import { presentCityLayout } from '../src/render/presentationLayout';
import { SKYRIVER_BLOOM_PICKUP_WIDTH } from '../src/render/scene';
import { IMPOSTOR_INTENSITY } from '../src/render/traffic';
import {
  IMPOSTOR_LANES,
  IMPOSTOR_PATHS,
  IMPOSTOR_PATH_COUNT,
  IMPOSTOR_RINGS,
  STREAMS,
  deriveImpostorAttributes,
  impostorPosition,
} from '../src/render/trafficStreams';
import {
  CPU_LIGHT_HANDOVER_BLEND_PRESENCE,
  cpuLightVisibilityAlpha,
  cpuLightHandoverAlpha,
  farImpostorBrightness,
  HULL_DRAW_DISTANCE_M,
  HULL_DRAW_FADE_START_M,
  hullLodAlpha,
  IMPOSTOR_FAR_FALLOFF_BAND_M,
  IMPOSTOR_LIGHT_HANDOVER_BAND_M,
  IMPOSTOR_SUPPORT_TAPER_BAND,
  impostorLightHandoverAlpha,
  impostorSupportTaperAlpha,
} from '../src/render/lightHandover';

/** main.ts SKYRIVER_DEMO_SEED (not imported: main.ts boots the app). */
const DEMO_SEED = 424242;

describe('impostor light response', () => {
  it('uses the shared 220 m hull band and complementary CPU and GPU shares', () => {
    expect(IMPOSTOR_LIGHT_HANDOVER_BAND_M).toEqual([1080, 1300]);
    expect(HULL_DRAW_FADE_START_M).toBe(IMPOSTOR_LIGHT_HANDOVER_BAND_M[0]);
    expect(HULL_DRAW_DISTANCE_M).toBe(IMPOSTOR_LIGHT_HANDOVER_BAND_M[1]);
    expect(hullLodAlpha(1080)).toBe(1);
    expect(hullLodAlpha(1190)).toBeCloseTo(0.5, 12);
    expect(hullLodAlpha(1300)).toBe(0);
    for (const presence of [0, 0.1, 0.5, 0.9, 1]) {
      for (const distanceM of [0, 1079, 1080, 1135, 1190, 1245, 1300, 1301, 2000]) {
        const cpu = cpuLightHandoverAlpha(distanceM, presence);
        const impostor = impostorLightHandoverAlpha(distanceM, presence);
        expect(cpu + impostor).toBeCloseTo(1, 12);
        expect(cpu).toBeGreaterThanOrEqual(0);
        expect(impostor).toBeLessThanOrEqual(presence);
      }
    }
  });

  it('caps active CPU lights to hull LOD and ends them at 1300 m', () => {
    for (const presence of [CPU_LIGHT_HANDOVER_BLEND_PRESENCE, 0.5, 1]) {
      for (const distanceM of [0, 900, 1080, 1135, 1190, 1245, 1299.9, 1300, 1400]) {
        const lightFade = cpuLightVisibilityAlpha(distanceM, presence, 0.4);
        expect(lightFade).toBeLessThanOrEqual(hullLodAlpha(distanceM));
        if (distanceM >= HULL_DRAW_DISTANCE_M) expect(lightFade).toBe(0);
      }
    }
    // Hull bars, streak lamps, and trails read this same scalar in traffic.ts.
    for (const distanceM of [0, 900, 1080, 1190, 1300, 1800]) {
      const cpu = cpuLightVisibilityAlpha(distanceM, 1, 0.37);
      const gpu = impostorLightHandoverAlpha(distanceM, 1);
      expect(cpu).toBeCloseTo(cpuLightHandoverAlpha(distanceM, 1), 12);
      expect(cpu + gpu).toBeCloseTo(1, 12);
    }
    // At full presence, the 900–1150 m low-tier thin-far fade no longer applies.
    expect(cpuLightVisibilityAlpha(1000, 1, 0)).toBe(1);
  });

  it('keeps the low-tier legacy fade and smooths the tier handover', () => {
    const legacyFarAlpha = 0.37;
    expect(cpuLightVisibilityAlpha(1400, 0, legacyFarAlpha)).toBe(legacyFarAlpha);
    expect(CPU_LIGHT_HANDOVER_BLEND_PRESENCE).toBe(0.5);
    let previous = legacyFarAlpha;
    for (let step = 1; step <= 10; step += 1) {
      const presence = (CPU_LIGHT_HANDOVER_BLEND_PRESENCE * step) / 10;
      const current = cpuLightVisibilityAlpha(1190, presence, legacyFarAlpha);
      expect(current).toBeGreaterThanOrEqual(previous);
      expect(current - previous).toBeLessThan(0.03);
      previous = current;
    }
    const before = cpuLightVisibilityAlpha(1190, 0.024, legacyFarAlpha);
    const atThreshold = cpuLightVisibilityAlpha(1190, CPU_LIGHT_HANDOVER_BLEND_PRESENCE, legacyFarAlpha);
    expect(before).toBeGreaterThan(legacyFarAlpha);
    expect(atThreshold).toBe(hullLodAlpha(1190));
    // The strict hull cap can lower combined CPU+GPU light during partial presence.
    const partialCpu = cpuLightVisibilityAlpha(1190, CPU_LIGHT_HANDOVER_BLEND_PRESENCE, 1);
    const partialGpu = impostorLightHandoverAlpha(1190, CPU_LIGHT_HANDOVER_BLEND_PRESENCE);
    expect(partialCpu + partialGpu).toBeLessThan(1);
  });

  it('limits CPU fade changes to 0.1 per frame through a full 1.2 s tier transition', () => {
    const frames = Math.round(1.2 * 30);
    const distancesM = [900, 1080, 1190, 1300, 1800];
    const legacyFades = [0, 0.37, 1];
    for (const distanceM of distancesM) {
      for (const legacyFarAlpha of legacyFades) {
        for (const direction of [1, -1]) {
          let previous = cpuLightVisibilityAlpha(
            distanceM,
            direction === 1 ? 0 : 1,
            legacyFarAlpha,
          );
          for (let frame = 1; frame <= frames; frame += 1) {
            const progress = frame / frames;
            const presence = direction === 1 ? progress : 1 - progress;
            const current = cpuLightVisibilityAlpha(distanceM, presence, legacyFarAlpha);
            expect(Math.abs(current - previous)).toBeLessThanOrEqual(0.1);
            previous = current;
          }
        }
      }
    }
  });

  it('fades far brightness to zero smoothly and within bloom pickup width over 20 m', () => {
    const [startM, endM] = IMPOSTOR_FAR_FALLOFF_BAND_M;
    expect(farImpostorBrightness(startM)).toBe(1);
    expect(farImpostorBrightness(1500)).toBe(1);
    expect(farImpostorBrightness(2000)).toBe(1);
    expect(farImpostorBrightness(endM)).toBe(0);
    expect(farImpostorBrightness(endM + 1)).toBe(0);
    let largest20mDrop = 0;
    const maximumSeededIntensity = 1.15 * IMPOSTOR_INTENSITY * SKYRIVER_EMISSIVE_GAIN;
    for (let distanceM = 0; distanceM <= endM + 1000; distanceM += 20) {
      const near = farImpostorBrightness(distanceM) * maximumSeededIntensity;
      const far = farImpostorBrightness(distanceM + 20) * maximumSeededIntensity;
      expect(far).toBeLessThanOrEqual(near);
      largest20mDrop = Math.max(largest20mDrop, near - far);
    }
    expect(SKYRIVER_BLOOM_PICKUP_WIDTH).toBeGreaterThan(0);
    expect(largest20mDrop).toBeLessThan(SKYRIVER_BLOOM_PICKUP_WIDTH);
  });

  it('fades fragment support to zero at the capsule edge', () => {
    const [start, end] = IMPOSTOR_SUPPORT_TAPER_BAND;
    expect(impostorSupportTaperAlpha(0)).toBe(1);
    expect(impostorSupportTaperAlpha(start)).toBe(1);
    expect(impostorSupportTaperAlpha((start + end) / 2)).toBeCloseTo(0.5, 12);
    expect(impostorSupportTaperAlpha(end)).toBe(0);
    expect(impostorSupportTaperAlpha(end + 0.01)).toBe(0);
  });
});

describe('GPU impostor traffic', () => {
  it('generates pure, seeded, in-range attributes', () => {
    expect(IMPOSTOR_PATH_COUNT).toBe(20);
    expect(IMPOSTOR_PATHS.length).toBe(STREAMS.length + IMPOSTOR_LANES.length);
    expect(IMPOSTOR_PATH_COUNT).toBe(IMPOSTOR_PATHS.length + IMPOSTOR_RINGS.length);
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

  it('normalizes stream, lane, and ring shares to fill the GPU population', () => {
    const a = deriveImpostorAttributes(DEMO_SEED, 20000);
    const n = [0, 0, 0];
    for (let i = 0; i < a.count; i += 1) {
      const k = a.streamArcPhaseSeed[i * 4]!;
      n[k < STREAMS.length ? 0 : k < IMPOSTOR_PATHS.length ? 1 : 2] += 1;
    }
    const share = n.map((x) => x / a.count);
    expect(Math.abs(share[0]! - 0.25 / 0.55)).toBeLessThan(0.02);
    expect(Math.abs(share[1]! - 0.1 / 0.55)).toBeLessThan(0.02);
    expect(Math.abs(share[2]! - 0.2 / 0.55)).toBeLessThan(0.02);
    expect(share.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
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
    const layout = presentCityLayout(deriveCityLayout(DEMO_SEED));
    const field = createMassField(layout);
    const a = deriveImpostorAttributes(DEMO_SEED, 4000);
    const p = { x: 0, y: 0, z: 0, dx: 0, dz: 0 };
    let canyonInside = 0;
    let canyonSamples = 0;
    let ringInside = 0;
    let ringSamples = 0;
    for (let i = 0; i < a.count; i += 1) {
      const ring = a.streamArcPhaseSeed[i * 4]! >= IMPOSTOR_PATHS.length;
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
    expect(ringSamples).toBeGreaterThan(0);

    const masses = deriveCityMasses(layout);
    const trims = deriveCityTrims(layout);
    let cityTop = -Infinity;
    for (const mass of masses) cityTop = Math.max(cityTop, mass.y0 + mass.height);
    for (let i = 0; i < trims.count; i += 1) cityTop = Math.max(cityTop, trims.cy[i]! + trims.sy[i]! / 2);
    const ringFloor = Math.min(...IMPOSTOR_RINGS.map((ring) => {
      const rowSpacing = ring[4]! / Math.max(1, ring[3]! - 1);
      const maxRowDrop = ring[4]! / 2 + rowSpacing * 0.3;
      return ring[1]! - ring[7]! - 12 - 15 - 6 - maxRowDrop;
    }));
    expect(ringFloor).toBeGreaterThan(cityTop);
    expect(ringInside).toBe(0);
  });
});
