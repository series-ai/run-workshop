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
  STREAM_PATH_ROWS,
  WARP_ROW,
  deriveImpostorAttributes,
  impostorPosition,
  renderTrafficModel,
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
  IMPOSTOR_TIER_FADE_S,
  impostorLightHandoverAlpha,
  impostorSupportTaperAlpha,
  writeSameCarLightLod,
  createImpostorTierTransition,
  computeTierPresence,
  computeInstanceAlpha,
  computeDrawnInstanceCount,
  captureImpostorFromAlpha,
  type SameCarLightLod,
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

describe('R24 same-car light LOD handover', () => {
  it('covers presence0, partial, and full presence while conserving light', () => {
    const out: SameCarLightLod = { nearAlpha: 0, impostorAlpha: 0, totalAlpha: 0 };

    // 1. Presence 0 (Low tier): identical to legacy far response, zero impostor share.
    for (const legacyFarAlpha of [0, 0.37, 0.7, 1]) {
      for (const distanceM of [0, 800, 1080, 1190, 1300, 1400, 2500, 4000, 6500]) {
        writeSameCarLightLod(distanceM, 0, legacyFarAlpha, out);
        expect(out.nearAlpha).toBe(legacyFarAlpha);
        expect(out.impostorAlpha).toBe(0);
        expect(out.totalAlpha).toBe(legacyFarAlpha);
      }
    }

    // 2. Full presence (presence = 1):
    // Full presence stays 1 through 1080–1300 m, then fades smoothly over 2500–6500 m.
    for (const distanceM of [0, 500, 900, 1080, 1135, 1190, 1245, 1300, 1500, 2000, 2500]) {
      writeSameCarLightLod(distanceM, 1, 1, out);
      expect(out.totalAlpha).toBe(1);
      expect(out.nearAlpha + out.impostorAlpha).toBeCloseTo(1, 12);
      expect(out.nearAlpha).toBeGreaterThanOrEqual(0);
      expect(out.impostorAlpha).toBeGreaterThanOrEqual(0);
    }

    // Crossover transition through 1080–1300 m at full presence.
    writeSameCarLightLod(1080, 1, 1, out);
    expect(out.nearAlpha).toBe(1);
    expect(out.impostorAlpha).toBe(0);
    expect(out.totalAlpha).toBe(1);

    writeSameCarLightLod(1190, 1, 1, out);
    expect(out.nearAlpha).toBeCloseTo(0.5, 12);
    expect(out.impostorAlpha).toBeCloseTo(0.5, 12);
    expect(out.totalAlpha).toBe(1);

    writeSameCarLightLod(1300, 1, 1, out);
    expect(out.nearAlpha).toBe(0);
    expect(out.impostorAlpha).toBe(1);
    expect(out.totalAlpha).toBe(1);

    // 3. Partial presence (smooth transition without brightness dip).
    for (const presence of [0.1, 0.25, CPU_LIGHT_HANDOVER_BLEND_PRESENCE, 0.75]) {
      for (const distanceM of [900, 1080, 1190, 1300, 1400]) {
        writeSameCarLightLod(distanceM, presence, 1, out);
        expect(out.nearAlpha).toBeLessThanOrEqual(cpuLightVisibilityAlpha(distanceM, presence, 1) + 1e-12);
        expect(out.nearAlpha).toBeLessThanOrEqual(out.totalAlpha + 1e-12);
        expect(out.impostorAlpha).toBeCloseTo(out.totalAlpha - out.nearAlpha, 12);
        expect(out.nearAlpha).toBeGreaterThanOrEqual(0);
        expect(out.impostorAlpha).toBeGreaterThanOrEqual(0);
        expect(out.nearAlpha + out.impostorAlpha).toBeCloseTo(out.totalAlpha, 12);
      }
    }

    // At 1190 m, total brightness is preserved (sum is 1.0 at presence >= 0.5, and smoothly transitions from 0).
    writeSameCarLightLod(1190, 0.5, 1, out);
    expect(out.totalAlpha).toBe(1);
    expect(out.nearAlpha + out.impostorAlpha).toBeCloseTo(1, 12);
  });

  it('handles thin legacy cars across presence levels correctly', () => {
    const out: SameCarLightLod = { nearAlpha: 0, impostorAlpha: 0, totalAlpha: 0 };
    // Legacy thin car fade curve: 1 - smoothstep(900^2, 1150^2, d^2)
    const thinAlpha = (d: number): number => {
      const d2 = d * d;
      const s0 = 900 * 900;
      const s1 = 1150 * 1150;
      const t = Math.min(1, Math.max(0, (d2 - s0) / (s1 - s0)));
      return 1 - t * t * (3 - 2 * t);
    };

    // At presence 0 (Low tier): thin car fade is strictly preserved.
    for (const distanceM of [800, 900, 1000, 1100, 1150, 1200, 1300]) {
      const expectedLegacy = thinAlpha(distanceM);
      writeSameCarLightLod(distanceM, 0, expectedLegacy, out);
      expect(out.nearAlpha).toBeCloseTo(expectedLegacy, 12);
      expect(out.impostorAlpha).toBe(0);
      expect(out.totalAlpha).toBeCloseTo(expectedLegacy, 12);
    }

    // At full presence (presence = 1): thin car fade is superseded by same-car impostor lights.
    for (const distanceM of [1000, 1080, 1190, 1300, 1400]) {
      writeSameCarLightLod(distanceM, 1, thinAlpha(distanceM), out);
      expect(out.totalAlpha).toBe(1);
      expect(out.nearAlpha + out.impostorAlpha).toBeCloseTo(1, 12);
      if (distanceM >= 1300) {
        expect(out.nearAlpha).toBe(0);
        expect(out.impostorAlpha).toBe(1);
      }
    }
  });

  it('guarantees total light conservation and nonnegativity across dense distance/presence grid', () => {
    const out: SameCarLightLod = { nearAlpha: 0, impostorAlpha: 0, totalAlpha: 0 };
    const presences = [0, 0.05, 0.2, 0.5, 0.8, 1];
    const legacyAlphas = [0, 0.25, 0.5, 1];

    for (let distanceM = 0; distanceM <= 7000; distanceM += 25) {
      for (const presence of presences) {
        for (const legacyFarAlpha of legacyAlphas) {
          writeSameCarLightLod(distanceM, presence, legacyFarAlpha, out);
          expect(out.nearAlpha).toBeGreaterThanOrEqual(0);
          expect(out.impostorAlpha).toBeGreaterThanOrEqual(0);
          expect(out.nearAlpha + out.impostorAlpha).toBeCloseTo(out.totalAlpha, 12);
          expect(out.nearAlpha).toBeLessThanOrEqual(out.totalAlpha + 1e-12);
        }
      }
    }
  });

  it('enforces zero near share beyond 1300 m at full presence', () => {
    const out: SameCarLightLod = { nearAlpha: 0, impostorAlpha: 0, totalAlpha: 0 };
    for (let distanceM = 1300; distanceM <= 7000; distanceM += 50) {
      writeSameCarLightLod(distanceM, 1, 1, out);
      expect(out.nearAlpha).toBe(0);
      expect(out.impostorAlpha).toBe(out.totalAlpha);
    }
  });

  it('reaches strictly zero far brightness and zero impostor share at and beyond 6500 m', () => {
    const out: SameCarLightLod = { nearAlpha: 0, impostorAlpha: 0, totalAlpha: 0 };
    for (const presence of [0, 0.25, 0.5, 0.75, 1]) {
      for (const distanceM of [6500, 6501, 7000, 10000]) {
        writeSameCarLightLod(distanceM, presence, 0.5, out);
        expect(farImpostorBrightness(distanceM)).toBe(0);
        expect(out.impostorAlpha).toBe(0);
        if (presence >= CPU_LIGHT_HANDOVER_BLEND_PRESENCE) {
          expect(out.totalAlpha).toBe(0);
          expect(out.nearAlpha).toBe(0);
        }
      }
    }
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
    // R21: the flow and route the vertex shader reads are seeded and pure in the same way.
    expect(Array.from(a.flow)).toEqual(Array.from(b.flow));
    expect(Array.from(a.route)).toEqual(Array.from(b.route));
    expect(a.seed).toBe(DEMO_SEED);
    expect(Array.from(a.streamArcPhaseSeed.slice(0, 400))).not.toEqual(Array.from(c.streamArcPhaseSeed.slice(0, 400)));
    expect(Array.from(a.route.slice(0, 400))).not.toEqual(Array.from(c.route.slice(0, 400)));
    // A smaller count is a prefix of a larger one (tiers draw prefixes).
    const small = deriveImpostorAttributes(DEMO_SEED, 500);
    expect(Array.from(small.streamArcPhaseSeed)).toEqual(Array.from(a.streamArcPhaseSeed.slice(0, 2000)));
    expect(Array.from(small.flow)).toEqual(Array.from(a.flow.slice(0, 2000)));
    expect(Array.from(small.route)).toEqual(Array.from(a.route.slice(0, 2000)));
    // R21 route values address real baked rows, and every speed is positive.
    for (let i = 0; i < a.count; i += 1) {
      for (const row of [a.route[i * 4]!, a.route[i * 4 + 1]!]) {
        expect(Number.isInteger(row) && row >= 0 && row < WARP_ROW).toBe(true);
      }
      expect(a.flow[i * 4]!).toBe(a.row[i]!);
      expect(a.flow[i * 4 + 1]!).toBeGreaterThan(0);
      expect(Math.abs(a.flow[i * 4 + 2]!)).toBeGreaterThan(0);
      expect(a.route[i * 4 + 3]!).toBeGreaterThan(0);
    }
    expect(renderTrafficModel(DEMO_SEED).table.height).toBe(STREAM_PATH_ROWS);
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
    // 100 s covers a full loop for the slow streams' seam crossings at many phases. R21 walks
    // backward time too, because a restore or a replay can move the render clock either way.
    for (let i = 0; i < a.count; i += 1) {
      impostorPosition(a, i, -50, p);
      for (let f = -1499; f <= 3000; f += 1) {
        impostorPosition(a, i, f / 30, q);
        worst = Math.max(worst, Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z));
        p.x = q.x; p.y = q.y; p.z = q.z;
      }
    }
    expect(worst).toBeLessThan(25);
  });

  it('keeps every travel direction a finite unit vector, branch and course-change slopes included', () => {
    const a = deriveImpostorAttributes(DEMO_SEED, 2000);
    const p = { x: 0, y: 0, z: 0, dx: 0, dz: 0, dy: 0 };
    let steepest = 0;
    for (let i = 0; i < a.count; i += 1) {
      for (const t of [-13.5, 0, 7.25, 61, 240]) {
        impostorPosition(a, i, t, p);
        const length = Math.hypot(p.dx, p.dy ?? 0, p.dz);
        expect(Number.isFinite(length)).toBe(true);
        expect(length).toBeCloseTo(1, 9);
        steepest = Math.max(steepest, Math.abs(p.dy ?? 0));
      }
    }
    // Canyon cars really do climb on a course change, instead of facing along the stream they left.
    expect(steepest).toBeGreaterThan(0.1);
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

describe('interrupted impostor tier transitions', () => {
  it('guarantees per-index alpha continuity on interrupted Low -> High -> Low retarget', () => {
    const capacity = 20000;
    const transition = createImpostorTierTransition(capacity, 0, IMPOSTOR_TIER_FADE_S);

    // Initial settled Low
    transition.evaluate(0);
    expect(transition.targetCount).toBe(0);
    expect(transition.presence).toBe(0);
    expect(transition.instanceAlpha(0)).toBe(0);

    // Retarget to High (20000) at t = 0
    transition.retarget(0, 20000);
    transition.evaluate(0);
    expect(transition.presence).toBe(0);
    expect(transition.drawnCount).toBe(20000);

    // Advance to t = 0.3 (k = 0.25)
    transition.evaluate(0.3);
    expect(transition.k).toBeCloseTo(0.25, 6);
    expect(transition.presence).toBeCloseTo(0.25, 6);
    const beforeAlphas = [0, 500, 7999, 15000, 19999].map((i) => transition.instanceAlpha(i));
    for (const alpha of beforeAlphas) {
      expect(alpha).toBeCloseTo(0.25, 6);
    }

    // Interrupted retarget back to Low (0) at t = 0.3
    transition.retarget(0.3, 0);
    transition.evaluate(0.3);
    expect(transition.k).toBe(0);
    expect(transition.presence).toBeCloseTo(0.25, 6);
    expect(transition.drawnCount).toBe(20000);

    // Check per-index alpha immediately after retarget has zero jump
    const afterAlphas = [0, 500, 7999, 15000, 19999].map((i) => transition.instanceAlpha(i));
    for (let j = 0; j < beforeAlphas.length; j += 1) {
      expect(afterAlphas[j]).toBeCloseTo(beforeAlphas[j]!, 12);
    }

    // Advance time through the returning fade to Low
    transition.evaluate(0.6);
    expect(transition.presence).toBeCloseTo(0.1875, 6);
    expect(transition.instanceAlpha(0)).toBeCloseTo(0.1875, 6);

    transition.evaluate(1.5);
    expect(transition.settled).toBe(true);
    expect(transition.presence).toBe(0);
    expect(transition.drawnCount).toBe(0);
    expect(transition.instanceAlpha(0)).toBe(0);
  });

  it('guarantees per-index alpha continuity on interrupted Low -> High -> Medium retarget', () => {
    const capacity = 20000;
    const transition = createImpostorTierTransition(capacity, 0, IMPOSTOR_TIER_FADE_S);

    transition.retarget(0, 20000);
    transition.evaluate(0.3);
    expect(transition.k).toBeCloseTo(0.25, 6);

    // Interrupted retarget to Medium (8000) at t = 0.3
    transition.retarget(0.3, 8000);
    transition.evaluate(0.3);
    expect(transition.presence).toBeCloseTo(0.25, 6);
    expect(transition.drawnCount).toBe(20000);

    // Both below-medium and above-medium indices must have exactly 0.25
    expect(transition.instanceAlpha(0)).toBeCloseTo(0.25, 12);
    expect(transition.instanceAlpha(7999)).toBeCloseTo(0.25, 12);
    expect(transition.instanceAlpha(8000)).toBeCloseTo(0.25, 12);
    expect(transition.instanceAlpha(19999)).toBeCloseTo(0.25, 12);

    // Advance time: 0..7999 rise towards 1, 8000..19999 fall towards 0
    transition.evaluate(0.6); // k = 0.25 in second fade
    expect(transition.instanceAlpha(0)).toBeCloseTo(0.25 + 0.75 * 0.25, 6);
    expect(transition.instanceAlpha(10000)).toBeCloseTo(0.25 * (1 - 0.25), 6);

    // Settles at Medium at t = 1.5
    transition.evaluate(1.5);
    expect(transition.settled).toBe(true);
    expect(transition.drawnCount).toBe(8000);
    expect(transition.presence).toBe(1);
    expect(transition.instanceAlpha(0)).toBe(1);
    expect(transition.instanceAlpha(7999)).toBe(1);
    expect(transition.instanceAlpha(8000)).toBe(0);
    expect(transition.instanceAlpha(19999)).toBe(0);
  });

  it('retains continuity across repeated rapid reversals without history leak', () => {
    const capacity = 20000;
    const transition = createImpostorTierTransition(capacity, 0, IMPOSTOR_TIER_FADE_S);

    const checkpoints = [
      { t: 0.0, target: 20000 },
      { t: 0.15, target: 0 },
      { t: 0.35, target: 20000 },
      { t: 0.50, target: 8000 },
      { t: 0.65, target: 0 },
      { t: 0.80, target: 20000 },
    ];

    for (let c = 0; c < checkpoints.length; c += 1) {
      const cp = checkpoints[c]!;
      if (c > 0) {
        // Evaluate right before retarget
        transition.evaluate(cp.t);
        const presBefore = transition.presence;
        const alphaBefore0 = transition.instanceAlpha(0);
        const alphaBefore8k = transition.instanceAlpha(8000);

        // Retarget and evaluate right after
        transition.retarget(cp.t, cp.target);
        transition.evaluate(cp.t);

        expect(Math.abs(transition.presence - presBefore)).toBeLessThan(1e-6);
        expect(Math.abs(transition.instanceAlpha(0) - alphaBefore0)).toBeLessThan(1e-6);
        expect(Math.abs(transition.instanceAlpha(8000) - alphaBefore8k)).toBeLessThan(1e-6);
      } else {
        transition.retarget(cp.t, cp.target);
        transition.evaluate(cp.t);
      }
    }

    // Advance to settled High
    transition.evaluate(2.0);
    expect(transition.settled).toBe(true);
    expect(transition.presence).toBe(1);
    expect(transition.drawnCount).toBe(20000);
    expect(transition.instanceAlpha(0)).toBe(1);
  });

  it('supports arbitrary setImpostorCount overrides continuously', () => {
    const capacity = 20000;
    const transition = createImpostorTierTransition(capacity, 0, IMPOSTOR_TIER_FADE_S);

    transition.retarget(0, 1234);
    transition.evaluate(0.4);

    const presBefore = transition.presence;
    const alphaBefore500 = transition.instanceAlpha(500);

    transition.retarget(0.4, 5000);
    transition.evaluate(0.4);

    expect(transition.presence).toBeCloseTo(presBefore, 12);
    expect(transition.instanceAlpha(500)).toBeCloseTo(alphaBefore500, 6);

    transition.evaluate(1.6);
    expect(transition.settled).toBe(true);
    expect(transition.drawnCount).toBe(5000);
    expect(transition.instanceAlpha(4999)).toBe(1);
    expect(transition.instanceAlpha(5000)).toBe(0);
  });

  it('preserves stable-tier reverse-time buffer behavior and settled endpoints', () => {
    const capacity = 20000;
    const transition = createImpostorTierTransition(capacity, 0, IMPOSTOR_TIER_FADE_S);

    // Settled Low
    transition.evaluate(0);
    for (const scrubT of [-50, -10, 0, 5, 50]) {
      const state = transition.evaluate(scrubT);
      expect(state.settled).toBe(true);
      expect(state.presence).toBe(0);
      expect(state.drawnCount).toBe(0);
      expect(transition.instanceAlpha(0)).toBe(0);
    }

    // Retarget to High and let settle at t = 1.2
    transition.retarget(0, 20000);
    transition.evaluate(1.2);
    expect(transition.settled).toBe(true);

    // Reverse time scrubbing in settled High
    for (const scrubT of [1.2, 0.8, 0, -20]) {
      const state = transition.evaluate(scrubT);
      expect(state.settled).toBe(true);
      expect(state.presence).toBe(1);
      expect(state.drawnCount).toBe(20000);
      expect(transition.instanceAlpha(0)).toBe(1);
      expect(transition.instanceAlpha(19999)).toBe(1);
    }
  });

  it('preserves total same-car lamp brightness continuity at 1190 m across interrupted retarget', () => {
    const out: SameCarLightLod = { nearAlpha: 0, impostorAlpha: 0, totalAlpha: 0 };
    const distanceM = 1190;
    const legacyFarAlpha = 0.37;

    const transition = createImpostorTierTransition(20000, 0, IMPOSTOR_TIER_FADE_S);
    transition.retarget(0, 20000);

    // Advance to t = 0.3 (k = 0.25)
    transition.evaluate(0.3);
    const presenceBefore = transition.presence;
    expect(presenceBefore).toBeCloseTo(0.25, 6);

    writeSameCarLightLod(distanceM, presenceBefore, legacyFarAlpha, out);
    const totalBefore = out.totalAlpha;
    const nearBefore = out.nearAlpha;
    const farBefore = out.impostorAlpha;

    // Interrupted retarget to Low at t = 0.3
    transition.retarget(0.3, 0);
    transition.evaluate(0.3);
    const presenceAfter = transition.presence;
    expect(presenceAfter).toBeCloseTo(0.25, 6);

    writeSameCarLightLod(distanceM, presenceAfter, legacyFarAlpha, out);
    expect(out.totalAlpha).toBeCloseTo(totalBefore, 12);
    expect(out.nearAlpha).toBeCloseTo(nearBefore, 12);
    expect(out.impostorAlpha).toBeCloseTo(farBefore, 12);
    // The previous 0.315 scalar jump is 0
    expect(Math.abs(out.totalAlpha - totalBefore)).toBe(0);
  });
});


describe('settled impostor population reuse', () => {
  it('keeps inactive sprites dark when a settled population grows', () => {
    for (const lowCount of [0, 8000]) {
      const transition = createImpostorTierTransition(20000, 20000);
      transition.retarget(0, lowCount);
      transition.evaluate(2);
      const before = Array.from({ length: 20000 }, (_, i) => transition.instanceAlpha(i));
      transition.retarget(2, 20000);
      transition.evaluate(2);
      for (let i = 0; i < 20000; i += 1) expect(transition.instanceAlpha(i)).toBe(before[i]);
      transition.evaluate(4);
      expect(transition.instanceAlpha(19999)).toBe(1);
    }
  });

  it('keeps a repeated target request idempotent and reuses the state view', () => {
    const transition = createImpostorTierTransition(20, 0);
    transition.retarget(0, 20);
    const firstView = transition.evaluate(0.3);
    for (const t of [0.3, 0.6, 0.9]) {
      expect(transition.retarget(t, 20)).toBe(false);
      expect(transition.evaluate(t)).toBe(firstView);
    }
    transition.evaluate(1.2);
    expect(transition.instanceAlpha(0)).toBe(1);
    expect(transition.instanceAlpha(19)).toBe(1);
  });
});
