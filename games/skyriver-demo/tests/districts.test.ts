/**
 * @file districts.test.ts — R22 acceptance for the render colour districts.
 *
 * Plan anchors (.plans/skyriver-r19-r22.html):
 *   R22 — five permanent districts on the 12800 m loop; >= 80% of each district's ordinary signs on
 *         its primary hue; every colour change preserves the FINAL linear luminance it replaces; no
 *         added draws; the haze tint refreshes at most once a second and resets on a rollback.
 *
 * What this file can and cannot prove. Everything here runs under node with no GL context, so it
 * covers the model, the quota, the colour arithmetic, the haze refresh rule, the draw-call budget
 * and the shader source paths. It does not render: the rendered colour energy, the brightest-15%
 * result and the exact-frame A/B pair are the browser proof's, not this file's.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CANYON_LOOP_LENGTH_M } from '../src/render/canyonWarp';
import {
  SKYRIVER_EMISSIVE_GAIN,
  SKYRIVER_FOG_REGION_TINT_WEIGHT,
  SKYRIVER_FOG_PARS_FRAGMENT_SOURCE,
} from '../src/render/atmosphere';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import { SKYRIVER_TICK_RATE } from '../src/sim/systems';
import {
  SKYRIVER_CITY_DRAW_CALL_BUDGET,
  SKYRIVER_CITY_SHADER_SOURCE,
  SKYRIVER_INTERIOR_FADE,
  SKYRIVER_TRIM_BAND,
  SKYRIVER_TRIM_BAND_COLD_SEED,
  deriveCityTrims,
  deriveHeroBlades,
  deriveNeonSigns,
  skyriverTrimBlocksHero,
  skyriverTrimSourceGroups,
  skyriverTrimSourceTermId,
  summarizeCityLayout,
} from '../src/render/city';
import { SkyriverQualityTier, skyriverDrawCallEstimate, skyriverQualityFor } from '../src/render/scene';
import {
  SKYRIVER_DISTANCE_GRADE_STEEL,
  SKYRIVER_DISTANCE_GRADE_STEEL_Y,
  SKYRIVER_DISTANCE_GRADE_UNIT_STEEL,
  SKYRIVER_DISTRICT_BOUNDARY_JITTER_M,
  SKYRIVER_DISTRICT_BRIGHT_ACCENT_SHARE,
  SKYRIVER_DISTRICT_COUNT,
  SKYRIVER_DISTRICT_GREEN_GROUP_COUNT,
  SKYRIVER_DISTRICT_GREEN_GROUP_LENGTH_M,
  SKYRIVER_DISTRICT_HAZE_BLEND_M,
  SKYRIVER_DISTRICT_MIN_LENGTH_M,
  SKYRIVER_DISTRICT_PLAN,
  SKYRIVER_DISTRICT_SATURATION,
  SKYRIVER_DISTRICT_SOURCE_TERMS,
  SKYRIVER_DISTRICT_UNIT_HUE,
  SKYRIVER_DISTRICT_UNTOUCHED_TERMS,
  SKYRIVER_LUMA,
  SkyriverDistrictColourSwitch,
  SKYRIVER_SIGN_EMISSION_REFERENCE,
  assignSkyriverSignDistricts,
  deriveSkyriverDistrictModel,
  skyriverDistanceGradeBrightness,
  skyriverDistanceGradeK,
  skyriverDistrictAt,
  skyriverDistrictBoundaries,
  skyriverDistrictDistanceGrade,
  skyriverDistrictHazeMixAt,
  skyriverDistrictHazeTint,
  skyriverDistrictIdAt,
  skyriverDistrictSignEmission,
  skyriverGlslFloat,
  skyriverHazeRefresh,
  skyriverHexToLinear,
  skyriverInGreenGroup,
  skyriverLegacyDistanceGrade,
  skyriverLinearY,
  skyriverRecolorPreservingY,
  skyriverRoutePosition,
  skyriverSignFinalEmission,
  skyriverUnitHue,
  type SkyriverLinearRgb,
} from '../src/render/districts';

const SEED = 20240917;
const SEEDS = [1, 7, SEED, 123456, 999999991];

/** The float tolerance every equal-luminance assertion in this file declares. */
const Y_TOLERANCE = 1e-12;

function layoutFor(seed: number): ReturnType<typeof presentCityLayout> {
  return presentCityLayout(deriveCityLayout(seed));
}

function signInputFor(seed: number): {
  readonly signs: ReturnType<typeof deriveNeonSigns>;
  readonly input: Parameters<typeof assignSkyriverSignDistricts>[1];
} {
  const layout = layoutFor(seed);
  const signs = deriveNeonSigns(layout);
  const areaM2 = new Float32Array(signs.count);
  const key: string[] = [];
  for (let i = 0; i < signs.count; i += 1) {
    areaM2[i] = signs.sw[i]! * signs.sh[i]!;
    key.push(`${signs.buildingId[i] ?? '-'}|${signs.faceId[i] ?? '-'}|${signs.compositionId[i] ?? '-'}`);
  }
  // The same float64 anchors city.ts hands the quota: never the float32 cz.
  return {
    signs,
    input: {
      count: signs.count,
      heroCount: signs.heroCount,
      anchorV: signs.anchorV,
      colour: signs.color,
      areaM2,
      key,
    },
  };
}

describe('R22 district model', () => {
  it('covers the whole 12800 m loop with the five approved districts', () => {
    expect(SKYRIVER_DISTRICT_COUNT).toBe(5);
    expect(SKYRIVER_DISTRICT_PLAN.map((entry) => [entry.name, entry.lengthM, entry.primary])).toEqual([
      ['ice-towers', 3400, 'cyan'],
      ['market', 2800, 'magenta'],
      ['mid-city', 2600, 'cyan'],
      ['dock', 1800, 'amber'],
      ['upper-city', 2200, 'cyan'],
    ]);
    expect(SKYRIVER_DISTRICT_PLAN.reduce((sum, entry) => sum + entry.lengthM, 0)).toBe(CANYON_LOOP_LENGTH_M);

    for (const seed of SEEDS) {
      const model = deriveSkyriverDistrictModel(seed);
      expect(model.loopM).toBe(CANYON_LOOP_LENGTH_M);
      expect(model.districts).toHaveLength(5);
      const covered = model.districts.reduce((sum, district) => sum + district.lengthM, 0);
      expect(covered).toBeCloseTo(CANYON_LOOP_LENGTH_M, 9);
      for (const district of model.districts) {
        expect(district.lengthM).toBeGreaterThanOrEqual(SKYRIVER_DISTRICT_MIN_LENGTH_M);
        expect(district.primarySignShare).toBeGreaterThanOrEqual(0.8);
      }
      // Boundary 0 is the loop seam and never moves; the others stay inside the 160 m allowance.
      const boundaries = skyriverDistrictBoundaries(seed);
      expect(boundaries[0]).toBe(0);
      let planned = 0;
      for (let i = 0; i < boundaries.length - 1; i += 1) {
        planned += SKYRIVER_DISTRICT_PLAN[i]!.lengthM;
        expect(Math.abs(boundaries[i + 1]! - planned)).toBeLessThanOrEqual(SKYRIVER_DISTRICT_BOUNDARY_JITTER_M);
      }
    }
  });

  it('is the same map for the same seed, and a different map for different seeds', () => {
    for (const seed of SEEDS) {
      expect(skyriverDistrictBoundaries(seed)).toEqual(skyriverDistrictBoundaries(seed));
      expect(JSON.stringify(deriveSkyriverDistrictModel(seed)))
        .toBe(JSON.stringify(deriveSkyriverDistrictModel(seed)));
    }
    const maps = new Set(SEEDS.map((seed) => JSON.stringify(skyriverDistrictBoundaries(seed))));
    expect(maps.size).toBe(SEEDS.length);
  });

  it('classifies every metre of the lap exactly once, walking the seam', () => {
    const model = deriveSkyriverDistrictModel(SEED);
    const seen = new Set<number>();
    let changes = 0;
    let previous = skyriverDistrictIdAt(model, 0);
    for (let v = 0; v < CANYON_LOOP_LENGTH_M; v += 1) {
      const district = skyriverDistrictAt(model, v);
      expect(district).toBeDefined();
      seen.add(district.id);
      if (district.id !== previous) changes += 1;
      previous = district.id;
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    // One change per interior boundary. The seam at 0 is the fifth, crossed by the wrap below.
    expect(changes).toBe(4);
    expect(skyriverDistrictIdAt(model, CANYON_LOOP_LENGTH_M - 1)).toBe(4);
    expect(skyriverDistrictIdAt(model, 0)).toBe(0);
  });

  it('uses a positive modulo, so a negative canyon anchor lands in the same district as its wrap', () => {
    const model = deriveSkyriverDistrictModel(SEED);
    for (let v = -CANYON_LOOP_LENGTH_M * 1.5; v < CANYON_LOOP_LENGTH_M * 1.5; v += 37) {
      const wrapped = skyriverRoutePosition(v);
      expect(wrapped).toBeGreaterThanOrEqual(0);
      expect(wrapped).toBeLessThan(CANYON_LOOP_LENGTH_M);
      expect(skyriverDistrictIdAt(model, v)).toBe(skyriverDistrictIdAt(model, wrapped));
      expect(skyriverDistrictIdAt(model, v)).toBe(skyriverDistrictIdAt(model, v + CANYON_LOOP_LENGTH_M * 3));
    }
  });

  it('puts exactly three small green groups inside two districts and never makes a green district', () => {
    // Two in the market, one on the dock: two or three gem moments per lap, not a green belt.
    expect(SKYRIVER_DISTRICT_GREEN_GROUP_COUNT).toBe(3);
    expect(SKYRIVER_DISTRICT_PLAN.map((entry) => [entry.name, entry.greenGroups])).toEqual([
      ['ice-towers', 0],
      ['market', 2],
      ['mid-city', 0],
      ['dock', 1],
      ['upper-city', 0],
    ]);
    for (const seed of SEEDS) {
      const model = deriveSkyriverDistrictModel(seed);
      const withGreen = model.districts.filter((district) => district.greenGroups.length > 0);
      expect(withGreen).toHaveLength(2);
      expect(withGreen.map((district) => district.name)).toEqual(['market', 'dock']);
      // Green is a group inside a district, never a district primary of its own.
      expect(model.districts.map((district) => district.primary as string)).not.toContain('green');
      expect(new Set(model.districts.map((district) => district.primary)))
        .toEqual(new Set(['cyan', 'magenta', 'amber']));
      let groups = 0;
      for (const district of withGreen) {
        const planned = SKYRIVER_DISTRICT_PLAN.find((entry) => entry.name === district.name)!;
        expect(district.greenGroups).toHaveLength(planned.greenGroups);
        for (const centre of district.greenGroups) {
          expect(skyriverDistrictIdAt(model, centre)).toBe(district.id);
          expect(skyriverInGreenGroup(model, district, centre)).toBe(true);
          groups += 1;
        }
      }
      expect(groups).toBe(SKYRIVER_DISTRICT_GREEN_GROUP_COUNT);
      // Three 320 m windows on a 12800 m lap: 7.5% of the route, so green stays a moment.
      const greenMetres = groups * SKYRIVER_DISTRICT_GREEN_GROUP_LENGTH_M;
      expect(greenMetres / CANYON_LOOP_LENGTH_M).toBeCloseTo(0.075, 6);
      // No district outside the market and the dock reports a group, so green cannot leak.
      for (const district of model.districts) {
        if (district.name === 'market' || district.name === 'dock') continue;
        expect(district.greenGroups).toHaveLength(0);
        expect(skyriverInGreenGroup(model, district, district.startM + district.lengthM * 0.5)).toBe(false);
      }
    }
  });
});

describe('R22 equal-luminance recolour', () => {
  it('uses the linear Rec.709 coefficients and a unit-luminance hue', () => {
    expect([...SKYRIVER_LUMA]).toEqual([0.2126, 0.7152, 0.0722]);
    expect(skyriverLinearY([1, 1, 1])).toBeCloseTo(1, 12);
    for (const hue of Object.values(SKYRIVER_DISTRICT_UNIT_HUE)) {
      expect(skyriverLinearY(hue)).toBeCloseTo(1, 12);
    }
  });

  it('holds the luminance of any colour at any saturation, and keeps black black', () => {
    const probes: SkyriverLinearRgb[] = [
      [0, 0, 0], [1, 1, 1], [0.004, 0.005, 0.007], [12, 0.4, 3], [1e-7, 0, 0],
      skyriverHexToLinear(0x2ff2ff), skyriverHexToLinear(0xff2fb4), skyriverHexToLinear(0xffb13c),
    ];
    for (const hue of Object.values(SKYRIVER_DISTRICT_UNIT_HUE)) {
      for (const probe of probes) {
        for (const saturation of [0, 0.05, 0.08, 0.22, 0.55, 0.85, 1]) {
          const out = skyriverRecolorPreservingY(probe, hue, saturation);
          expect(Math.abs(skyriverLinearY(out) - skyriverLinearY(probe))).toBeLessThan(Y_TOLERANCE);
          for (const channel of out) expect(Number.isFinite(channel)).toBe(true);
        }
      }
    }
    expect(skyriverRecolorPreservingY([0, 0, 0], SKYRIVER_DISTRICT_UNIT_HUE.cyan, 1)).toEqual([0, 0, 0]);
    // HDR channels are carried, never clamped to one.
    const hdr = skyriverRecolorPreservingY([12, 0.4, 3], SKYRIVER_DISTRICT_UNIT_HUE.amber, 1);
    expect(Math.max(...hdr)).toBeGreaterThan(1);
  });

  it('moves the chroma it is asked to move', () => {
    const source = skyriverHexToLinear(0xffb13c);
    const neutral = skyriverRecolorPreservingY(source, SKYRIVER_DISTRICT_UNIT_HUE.cyan, 0);
    expect(neutral[0]).toBeCloseTo(neutral[1], 12);
    expect(neutral[1]).toBeCloseTo(neutral[2], 12);
    const full = skyriverRecolorPreservingY(source, SKYRIVER_DISTRICT_UNIT_HUE.cyan, 1);
    expect(full[2]).toBeGreaterThan(full[0]);
    expect(skyriverUnitHue(full)).toEqual(expect.arrayContaining([expect.any(Number)]));
    for (let k = 0; k < 3; k += 1) {
      expect(skyriverUnitHue(full)[k]).toBeCloseTo(SKYRIVER_DISTRICT_UNIT_HUE.cyan[k]!, 10);
    }
  });

  it('keeps the complete sign emission at equal luminance, core squaring included', () => {
    expect(SKYRIVER_SIGN_EMISSION_REFERENCE.gain).toBeCloseTo(SKYRIVER_EMISSIVE_GAIN, 12);
    const source = skyriverHexToLinear(0x2ff2ff);
    const plain = skyriverSignFinalEmission(source);
    // The core squares RGB and the white-hot blend adds a neutral term, so the final luminance is
    // not a scalar multiple of the source luminance. This is why the recolour is applied last.
    expect(skyriverLinearY(plain) / skyriverLinearY(source)).not.toBeCloseTo(
      skyriverLinearY(skyriverSignFinalEmission(skyriverHexToLinear(0xffb13c)))
      / skyriverLinearY(skyriverHexToLinear(0xffb13c)), 3,
    );
    for (const hex of [0x2ff2ff, 0xff2fb4, 0xffb13c, 0x55ff7a, 0xd6ecff, 0x000000]) {
      const colour = skyriverHexToLinear(hex);
      for (const mask of [0, 0.2, 0.85, 1]) {
        for (const halo of [0, 0.75]) {
          const terms = { ...SKYRIVER_SIGN_EMISSION_REFERENCE, mask, halo };
          const before = skyriverSignFinalEmission(colour, terms);
          for (const hue of Object.values(SKYRIVER_DISTRICT_UNIT_HUE)) {
            for (const saturation of [0.22, 0.85, 1]) {
              const after = skyriverDistrictSignEmission(colour, hue, saturation, terms);
              expect(Math.abs(skyriverLinearY(after) - skyriverLinearY(before))).toBeLessThan(Y_TOLERANCE);
            }
          }
        }
      }
    }
  });

  it('keeps rooms and panes weak, accents saturated, and small lamps neutral', () => {
    expect(SKYRIVER_DISTRICT_SATURATION.room).toBeGreaterThanOrEqual(0.05);
    expect(SKYRIVER_DISTRICT_SATURATION.room).toBeLessThanOrEqual(0.1);
    expect(SKYRIVER_DISTRICT_SATURATION.pane).toBeGreaterThanOrEqual(0.05);
    expect(SKYRIVER_DISTRICT_SATURATION.pane).toBeLessThanOrEqual(0.1);
    expect(SKYRIVER_DISTRICT_SATURATION.farCard).toBeGreaterThanOrEqual(0.05);
    expect(SKYRIVER_DISTRICT_SATURATION.farCard).toBeLessThanOrEqual(0.1);
    expect(SKYRIVER_DISTRICT_SATURATION.trimSmall).toBe(0);
    expect(SKYRIVER_DISTRICT_SATURATION.hero).toBe(1);
    expect(SKYRIVER_DISTRICT_SATURATION.signBright).toBe(1);
    expect(SKYRIVER_DISTRICT_SATURATION.sign).toBeGreaterThanOrEqual(0.8);
    expect(SKYRIVER_DISTRICT_SATURATION.trimLarge).toBeGreaterThan(SKYRIVER_DISTRICT_SATURATION.room);
    expect(SKYRIVER_DISTRICT_SATURATION.dockLamp).toBeGreaterThan(0.5);

    for (const term of SKYRIVER_DISTRICT_SOURCE_TERMS) {
      for (const hue of Object.values(SKYRIVER_DISTRICT_UNIT_HUE)) {
        const after = skyriverRecolorPreservingY(term.rgb, hue, term.saturation);
        expect(Math.abs(skyriverLinearY(after) - skyriverLinearY(term.rgb))).toBeLessThan(Y_TOLERANCE);
      }
    }
    // The red warnings and the blue skybridge underlight are declared separate, never recoloured.
    expect(SKYRIVER_DISTRICT_UNTOUCHED_TERMS.map((term) => term.id)).toEqual([
      'trim-antenna-beacon', 'trim-flood-tip', 'trim-skybridge-underlight',
    ]);
    const recoloured = new Set(SKYRIVER_DISTRICT_SOURCE_TERMS.map((term) => term.id));
    for (const term of SKYRIVER_DISTRICT_UNTOUCHED_TERMS) expect(recoloured.has(term.id)).toBe(false);
  });

  it('preserves the R17 distance grade brightness while freeing its desaturation', () => {
    // Ysteel is derived from the actual steel vector, not a rounded 0.776.
    expect(SKYRIVER_DISTANCE_GRADE_STEEL_Y).toBeCloseTo(
      0.2126 * SKYRIVER_DISTANCE_GRADE_STEEL[0]! + 0.7152 * SKYRIVER_DISTANCE_GRADE_STEEL[1]!
      + 0.0722 * SKYRIVER_DISTANCE_GRADE_STEEL[2]!, 15,
    );
    expect(SKYRIVER_DISTANCE_GRADE_STEEL_Y).toBeCloseTo(0.77608, 10);
    expect(SKYRIVER_DISTANCE_GRADE_STEEL_Y).not.toBe(0.776);
    expect(skyriverLinearY(SKYRIVER_DISTANCE_GRADE_UNIT_STEEL)).toBeCloseTo(1, 12);

    const probes: SkyriverLinearRgb[] = [
      skyriverHexToLinear(0x2ff2ff), skyriverHexToLinear(0xffb13c), [0.004, 0.005, 0.007], [0, 0, 0], [8, 1, 4],
    ];
    for (const [depthM, extra] of [[0, 0], [900, 0], [1500, 0], [2500, 0], [5000, 0], [2500, 0.35], [2500, 0.55], [2500, 0.7], [14000, 0.7]] as const) {
      const k = skyriverDistanceGradeK(depthM, extra);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(0.92);
      const brightness = skyriverDistanceGradeBrightness(k);
      for (const probe of probes) {
        const legacy = skyriverLegacyDistanceGrade(probe, k);
        const graded = skyriverDistrictDistanceGrade(probe, k);
        expect(Math.abs(skyriverLinearY(graded) - skyriverLinearY(legacy))).toBeLessThan(Y_TOLERANCE);
        expect(skyriverLinearY(graded)).toBeCloseTo(skyriverLinearY(probe) * brightness, 12);
      }
      // The grade still dims with depth: that brightness change is R17's and is kept.
      if (k > 0) expect(brightness).toBeLessThan(1);
    }
    // Freeing the desaturation from the brightness: at the same k the new grade reaches at least as
    // far toward the steel direction, because its target is no longer dimmed by Ysteel.
    const chromaDistance = (colour: SkyriverLinearRgb): number => {
      const a = skyriverUnitHue(colour);
      const b = SKYRIVER_DISTANCE_GRADE_UNIT_STEEL;
      return Math.hypot(a[0] - b[0]!, a[1] - b[1]!, a[2] - b[2]!);
    };
    let strictlyCloser = 0;
    for (const hex of [0xffb13c, 0x2ff2ff, 0xff2fb4]) {
      const probe = skyriverHexToLinear(hex);
      for (const [depthM, extra] of [[1500, 0], [2500, 0.35], [5000, 0.7]] as const) {
        const k = skyriverDistanceGradeK(depthM, extra);
        const graded = chromaDistance(skyriverDistrictDistanceGrade(probe, k));
        const legacy = chromaDistance(skyriverLegacyDistanceGrade(probe, k));
        expect(graded).toBeLessThanOrEqual(legacy + 1e-12);
        if (graded < legacy - 1e-9) strictlyCloser += 1;
      }
    }
    expect(strictlyCloser).toBeGreaterThan(0);
  });
});

describe('R22 sign hue quota', () => {
  it('gives every district at least 80% primary ordinary signs and 70% including heroes', () => {
    for (const seed of SEEDS) {
      const model = deriveSkyriverDistrictModel(seed);
      const { input } = signInputFor(seed);
      const assignment = assignSkyriverSignDistricts(model, input);
      let primaryTotal = 0;
      let allTotal = 0;
      for (const counts of assignment.counts) {
        expect(counts.ordinary).toBeGreaterThan(0);
        expect(counts.ordinaryPrimaryShare).toBeGreaterThanOrEqual(0.8);
        expect(counts.totalPrimaryShare).toBeGreaterThanOrEqual(0.7);
        expect(counts.primaryOrdinary + counts.green + counts.secondary + counts.neutral)
          .toBe(counts.ordinary);
        primaryTotal += counts.primaryTotal;
        allTotal += counts.ordinary + counts.heroes;
      }
      expect(primaryTotal / allTotal).toBeGreaterThanOrEqual(0.7);
      expect(allTotal).toBe(input.count);
    }
  });

  it('puts every hero on its district primary and keeps green inside the selected groups', () => {
    const model = deriveSkyriverDistrictModel(SEED);
    const { input } = signInputFor(SEED);
    const assignment = assignSkyriverSignDistricts(model, input);
    for (let i = 0; i < input.heroCount; i += 1) {
      expect(assignment.role[i]).toBe('hero');
      const district = model.districts[assignment.district[i]!]!;
      for (let k = 0; k < 3; k += 1) {
        expect(assignment.unitHue[i * 3 + k]).toBeCloseTo(SKYRIVER_DISTRICT_UNIT_HUE[district.primary][k]!, 6);
      }
      expect(assignment.saturation[i]).toBe(SKYRIVER_DISTRICT_SATURATION.hero);
    }
    let green = 0;
    for (let i = input.heroCount; i < input.count; i += 1) {
      if (assignment.role[i] !== 'green') continue;
      green += 1;
      const district = model.districts[assignment.district[i]!]!;
      expect(district.greenGroups.length).toBeGreaterThan(0);
      expect(skyriverInGreenGroup(model, district, input.anchorV[i]!)).toBe(true);
    }
    expect(green).toBeGreaterThan(0);
    expect(green / input.count).toBeLessThan(0.06);
  });

  it('ranks bright accents by actual source energy, not by a hash', () => {
    const model = deriveSkyriverDistrictModel(SEED);
    const { input } = signInputFor(SEED);
    const assignment = assignSkyriverSignDistricts(model, input);
    const energy = (i: number): number => skyriverLinearY([
      input.colour[i * 3]!, input.colour[i * 3 + 1]!, input.colour[i * 3 + 2]!,
    ]) * input.areaM2[i]!;
    let brightest = 0;
    let dimmest = Infinity;
    let bright = 0;
    for (let i = input.heroCount; i < input.count; i += 1) {
      if (assignment.role[i] === 'neutral') continue;
      if (assignment.saturation[i] === SKYRIVER_DISTRICT_SATURATION.signBright) {
        bright += 1;
        dimmest = Math.min(dimmest, energy(i));
      } else {
        brightest = Math.max(brightest, energy(i));
      }
    }
    expect(bright).toBeGreaterThan(0);
    // Every bright accent carries at least as much source energy as every other eligible sign.
    expect(dimmest).toBeGreaterThanOrEqual(brightest);
    const eligible = assignment.role.filter((role, i) => i >= input.heroCount && role !== 'neutral').length;
    expect(bright).toBe(Math.round(eligible * SKYRIVER_DISTRICT_BRIGHT_ACCENT_SHARE));
    expect(assignment.brightAccentProxy).toContain('not a rendered');
  });

  it('is a pure function of the finished signs: no sign buffer and no draw sequence moves', () => {
    const model = deriveSkyriverDistrictModel(SEED);
    const { signs, input } = signInputFor(SEED);
    const snapshot = JSON.stringify({
      count: signs.count,
      ordinaryCount: signs.ordinaryCount,
      heroCount: signs.heroCount,
      cx: [...signs.cx.slice(0, signs.count)],
      cy: [...signs.cy.slice(0, signs.count)],
      cz: [...signs.cz.slice(0, signs.count)],
      sw: [...signs.sw.slice(0, signs.count)],
      sh: [...signs.sh.slice(0, signs.count)],
      kind: [...signs.kind.slice(0, signs.count)],
      seedValue: [...signs.seedValue.slice(0, signs.count)],
      colour: [...signs.color],
      compositionId: signs.compositionId.slice(0, signs.count),
      acceptedByLoopSection: signs.acceptedByLoopSection,
    });
    const first = assignSkyriverSignDistricts(model, input);
    const second = assignSkyriverSignDistricts(model, input);
    expect(JSON.stringify({
      count: signs.count,
      ordinaryCount: signs.ordinaryCount,
      heroCount: signs.heroCount,
      cx: [...signs.cx.slice(0, signs.count)],
      cy: [...signs.cy.slice(0, signs.count)],
      cz: [...signs.cz.slice(0, signs.count)],
      sw: [...signs.sw.slice(0, signs.count)],
      sh: [...signs.sh.slice(0, signs.count)],
      kind: [...signs.kind.slice(0, signs.count)],
      seedValue: [...signs.seedValue.slice(0, signs.count)],
      colour: [...signs.color],
      compositionId: signs.compositionId.slice(0, signs.count),
      acceptedByLoopSection: signs.acceptedByLoopSection,
    })).toBe(snapshot);
    expect([...second.district]).toEqual([...first.district]);
    expect([...second.saturation]).toEqual([...first.saturation]);
    expect(second.role).toEqual(first.role);

    // The existing weighted draw still produces exactly the five palette entries, in place.
    const palette = [0x2ff2ff, 0xff2fb4, 0xffb13c, 0x55ff7a, 0xd6ecff, 0xff4a8c]
      .map((hex) => skyriverHexToLinear(hex).map((c) => Math.fround(c)).join(','));
    for (let i = signs.heroCount; i < signs.count; i += 1) {
      const drawn = [signs.color[i * 3]!, signs.color[i * 3 + 1]!, signs.color[i * 3 + 2]!].join(',');
      expect(palette).toContain(drawn);
    }
  });

  it('classifies a sign by its building anchor, so a facade never straddles two districts', () => {
    const model = deriveSkyriverDistrictModel(SEED);
    const { signs, input } = signInputFor(SEED);
    const assignment = assignSkyriverSignDistricts(model, input);
    const byBuilding = new Map<string, number>();
    for (let i = signs.heroCount; i < signs.count; i += 1) {
      const building = signs.buildingId[i] ?? '-';
      const existing = byBuilding.get(building);
      if (existing === undefined) byBuilding.set(building, assignment.district[i]!);
      else expect(assignment.district[i]).toBe(existing);
    }
    expect(byBuilding.size).toBeGreaterThan(10);
    // Heroes are classified by their own z, as the brief specifies. Every hero sign must match a
    // real hero blade: a test that silently skips the unmatched ones proves nothing.
    const heroes = deriveHeroBlades(layoutFor(SEED));
    expect(signs.heroCount).toBeGreaterThan(0);
    let matched = 0;
    for (let i = 0; i < signs.heroCount; i += 1) {
      // compositionId is the hero's own id, and anchorV is its exact double z: no tolerance needed.
      const hero = heroes.find((candidate) => candidate.compositionId === signs.compositionId[i]
        && candidate.z === signs.anchorV[i]);
      expect(hero).toBeDefined();
      matched += 1;
      expect(assignment.district[i]).toBe(skyriverDistrictIdAt(model, hero!.z));
    }
    expect(matched).toBe(signs.heroCount);
  });
});

describe('R22 district haze', () => {
  it('refreshes at most once a second of simulated time', () => {
    let state = { bucket: Number.NaN, tick: Number.NaN };
    let refreshes = 0;
    for (let tick = 0; tick <= 20 * SKYRIVER_TICK_RATE; tick += 1) {
      // Two frames per tick: a 60 Hz presentation over a 30 Hz simulation.
      for (let frame = 0; frame < 2; frame += 1) {
        const decision = skyriverHazeRefresh(state, tick, SKYRIVER_TICK_RATE);
        if (decision.refresh) refreshes += 1;
        state = { bucket: decision.refresh ? decision.bucket : state.bucket, tick };
      }
    }
    expect(refreshes).toBe(21);
  });

  it('resets on a time reversal and re-samples at the earlier tick', () => {
    let state = { bucket: Number.NaN, tick: Number.NaN };
    for (const tick of [0, 30, 60, 90]) {
      const decision = skyriverHazeRefresh(state, tick, SKYRIVER_TICK_RATE);
      expect(decision.refresh).toBe(true);
      expect(decision.reset).toBe(false);
      state = { bucket: decision.bucket, tick };
    }
    const rollback = skyriverHazeRefresh(state, 45, SKYRIVER_TICK_RATE);
    expect(rollback.reset).toBe(true);
    expect(rollback.refresh).toBe(true);
    expect(rollback.bucket).toBe(1);
    // A rollback inside the bucket still refreshes: a later tick's tint must not survive it.
    state = { bucket: rollback.bucket, tick: 45 };
    const sameBucket = skyriverHazeRefresh(state, 46, SKYRIVER_TICK_RATE);
    expect(sameBucket.refresh).toBe(false);
    const backOne = skyriverHazeRefresh({ bucket: 1, tick: 46 }, 45, SKYRIVER_TICK_RATE);
    expect(backOne.reset).toBe(true);
    expect(backOne.refresh).toBe(true);
    // An invalidated bucket refreshes immediately, which is what the colour switch relies on.
    expect(skyriverHazeRefresh({ bucket: Number.NaN, tick: 46 }, 46, SKYRIVER_TICK_RATE).refresh).toBe(true);
  });

  it('blends the tint across a 300-500 m boundary band and keeps its luminance at one', () => {
    expect(SKYRIVER_DISTRICT_HAZE_BLEND_M).toBeGreaterThanOrEqual(300);
    expect(SKYRIVER_DISTRICT_HAZE_BLEND_M).toBeLessThanOrEqual(500);
    const model = deriveSkyriverDistrictModel(SEED);
    const half = SKYRIVER_DISTRICT_HAZE_BLEND_M * 0.5;
    for (const district of model.districts) {
      const atBoundary = skyriverDistrictHazeMixAt(model, district.startM);
      expect(atBoundary.neighbourWeight).toBeCloseTo(0.5, 6);
      const inside = skyriverDistrictHazeMixAt(model, district.startM + half + 10);
      expect(inside.neighbourWeight).toBe(0);
    }
    // Continuity: the widest gap between two unit hues, scaled by the band, bounds the step.
    const channels = Object.values(SKYRIVER_DISTRICT_UNIT_HUE).flatMap((hue) => [...hue]);
    const spread = Math.max(...channels) - Math.min(...channels);
    const perMetre = SKYRIVER_DISTRICT_SATURATION.haze * spread / half;
    let previous = skyriverDistrictHazeTint(model, 0);
    for (let v = 0; v <= CANYON_LOOP_LENGTH_M; v += 5) {
      const tint = skyriverDistrictHazeTint(model, v);
      expect(skyriverLinearY(tint)).toBeCloseTo(1, 10);
      for (let k = 0; k < 3; k += 1) {
        expect(Math.abs(tint[k]! - previous[k]!)).toBeLessThan(perMetre * 5 * 1.5);
      }
      previous = tint;
    }
    // No step at a boundary: the blend is 50/50 on both sides of every one, the loop seam included.
    for (const district of model.districts) {
      const before = skyriverDistrictHazeTint(model, district.startM - 0.5);
      const after = skyriverDistrictHazeTint(model, district.startM + 0.5);
      for (let k = 0; k < 3; k += 1) {
        expect(Math.abs(after[k]! - before[k]!)).toBeLessThan(perMetre * 2);
      }
    }
    // The effective deviation the fog shader applies stays weak.
    const worst = Math.max(...model.districts.flatMap((district) => {
      const tint = skyriverDistrictHazeTint(model, district.startM + half + 50);
      return tint.map((channel) => Math.abs(0.12 * (channel - 1)));
    }));
    expect(worst).toBeLessThan(0.2);
    expect(skyriverDistrictHazeTint(model, -1)).toEqual(skyriverDistrictHazeTint(model, CANYON_LOOP_LENGTH_M - 1));
  });
});

describe('R22 drawn trim sources', () => {
  /**
   * The drawn trim set, reproduced from the exported hero-clearance rule writeTrims uses. Node has
   * no GL context, so the instance buffers cannot be read off the mesh; this builds the same three
   * arrays writeTrims writes (kind, seed and district per drawn instance) from the same inputs.
   */
  function drawnTrimsFor(seed: number): {
    readonly kind: number[];
    readonly seed: number[];
    readonly district: number[];
  } {
    const layout = layoutFor(seed);
    const trims = deriveCityTrims(layout);
    const heroes = deriveHeroBlades(layout);
    const model = deriveSkyriverDistrictModel(seed);
    const kind: number[] = [];
    const seeds: number[] = [];
    const district: number[] = [];
    for (let i = 0; i < trims.count; i += 1) {
      if (skyriverTrimBlocksHero(trims, i, heroes)) continue;
      kind.push(trims.kind[i]!);
      seeds.push(trims.seedValue[i]!);
      district.push(skyriverDistrictIdAt(model, trims.owner[i]!.anchorV));
    }
    return { kind, seed: seeds, district };
  }

  it('selects the floor band term from the seed, exactly as the trim shader does', () => {
    expect(SKYRIVER_TRIM_BAND_COLD_SEED).toBe(0.6);
    // The one threshold reaches the shader through its own constant, never a second literal.
    expect(SKYRIVER_CITY_SHADER_SOURCE.trimFragment)
      .toContain(`step( ${skyriverGlslFloat(SKYRIVER_TRIM_BAND_COLD_SEED)}, vSeed )`);
    for (const probe of [0, 0.1, 0.59, 0.5999999, 0.6, 0.600001, 0.9, 1]) {
      expect(skyriverTrimSourceTermId(SKYRIVER_TRIM_BAND, probe))
        .toBe(probe < SKYRIVER_TRIM_BAND_COLD_SEED ? 'trim-band-warm' : 'trim-band-cold');
    }
  });

  it('splits the real trims of a seed into the warm and cold bands the shader emits', () => {
    for (const seed of SEEDS) {
      const drawn = drawnTrimsFor(seed);
      let expectedWarm = 0;
      let expectedCold = 0;
      for (let i = 0; i < drawn.kind.length; i += 1) {
        if (drawn.kind[i] !== SKYRIVER_TRIM_BAND) continue;
        if (drawn.seed[i]! < SKYRIVER_TRIM_BAND_COLD_SEED) expectedWarm += 1;
        else expectedCold += 1;
      }
      // Both sources are really drawn, and the majority is warm — which is why reporting every band
      // as 'trim-band-cold' was wrong for most of them.
      expect(expectedWarm).toBeGreaterThan(0);
      expect(expectedCold).toBeGreaterThan(0);
      expect(expectedWarm).toBeGreaterThan(expectedCold);

      const groups = skyriverTrimSourceGroups(drawn.kind, drawn.seed, drawn.district);
      const total = (termId: string): number => groups
        .filter((group) => group.termId === termId)
        .reduce((sum, group) => sum + group.count, 0);
      expect(total('trim-band-warm')).toBe(expectedWarm);
      expect(total('trim-band-cold')).toBe(expectedCold);
      // Nothing is invented and nothing is lost: every group counts a drawn instance with a term.
      const withTerm = drawn.kind
        .filter((kind, i) => skyriverTrimSourceTermId(kind, drawn.seed[i]!) !== null).length;
      expect(groups.reduce((sum, group) => sum + group.count, 0)).toBe(withTerm);
      // Every group's term is a real source term, so the palette can never synthesise a colour.
      for (const group of groups) {
        expect(SKYRIVER_DISTRICT_SOURCE_TERMS.map((term) => term.id)).toContain(group.termId);
        expect(group.districtId).toBeGreaterThanOrEqual(0);
        expect(group.districtId).toBeLessThan(SKYRIVER_DISTRICT_COUNT);
      }
    }
  });

  it('rejects a short input instead of grouping a missing seed or district', () => {
    expect(() => skyriverTrimSourceGroups([SKYRIVER_TRIM_BAND], [], [0]))
      .toThrow('SKYRIVER_TRIM_SOURCE_GROUP_INPUT_SHORT');
    expect(() => skyriverTrimSourceGroups([SKYRIVER_TRIM_BAND], [0.1], []))
      .toThrow('SKYRIVER_TRIM_SOURCE_GROUP_INPUT_SHORT');
  });
});

describe('R22 one colour switch', () => {
  it('holds the flag once and tells every subscriber about a change', () => {
    const colourSwitch = new SkyriverDistrictColourSwitch();
    expect(colourSwitch.allowed).toBe(true);
    const city: boolean[] = [];
    const haze: boolean[] = [];
    colourSwitch.onChange((allowed) => city.push(allowed));
    colourSwitch.onChange((allowed) => haze.push(allowed));
    // Subscribers are built in the current state, so registering applies nothing.
    expect(city).toEqual([]);
    expect(haze).toEqual([]);

    colourSwitch.set(false);
    expect(colourSwitch.allowed).toBe(false);
    colourSwitch.set(true);
    // Idempotent: the same state twice converges on the same uniforms, and both sides see both.
    colourSwitch.set(true);
    expect(colourSwitch.allowed).toBe(true);
    expect(city).toEqual([false, true, true]);
    expect(haze).toEqual(city);
  });

  it('starts in the state it was constructed with', () => {
    expect(new SkyriverDistrictColourSwitch(false).allowed).toBe(false);
    expect(new SkyriverDistrictColourSwitch(true).allowed).toBe(true);
  });

  it('is the only owner of the flag: no render module keeps a copy', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    for (const file of ['render/city.ts', 'render/atmosphere.ts']) {
      const source = readFileSync(join(here, '..', 'src', file), 'utf8');
      // No private field, and no setter a caller could use to switch one half of the frame.
      expect(source).not.toMatch(/private districtAllowed/);
      expect(source).not.toMatch(/\bsetDistrictAllowed\s*\(/);
      expect(source).toContain('this.colourSwitch.allowed');
    }
    const scene = readFileSync(join(here, '..', 'src', 'render', 'scene.ts'), 'utf8');
    // Scene writes it, and reports the one flag it wrote.
    expect(scene).toContain('this.colourSwitch.set(allowed);');
    expect(scene).toContain('districtAllowed: this.colourSwitch.allowed,');
  });
});

describe('R22 haze tint weight', () => {
  it('interpolates one fog-shader weight constant into the fog GLSL', () => {
    expect(SKYRIVER_FOG_REGION_TINT_WEIGHT).toBeGreaterThan(0);
    expect(SKYRIVER_FOG_REGION_TINT_WEIGHT).toBeLessThan(1);
    // The shader reads the constant, so the evidence that reads it cannot report a stale weight.
    expect(SKYRIVER_FOG_PARS_FRAGMENT_SOURCE)
      .toContain(`${skyriverGlslFloat(SKYRIVER_FOG_REGION_TINT_WEIGHT)} * uSkyFogMurkAllowed`);
    expect(SKYRIVER_FOG_PARS_FRAGMENT_SOURCE.split('uSkyFogRegionTint,')).toHaveLength(2);
  });

  it('bounds what the tint does to the haze, with no exact fog-luminance claim', () => {
    const model = deriveSkyriverDistrictModel(SEED);
    const weight = SKYRIVER_FOG_REGION_TINT_WEIGHT;
    // A non-neutral fog colour: the R20 shader's own grime-smog and deep-air terms are not grey.
    const fog: SkyriverLinearRgb = [0.0062, 0.0055, 0.0053];
    let worstDeviation = 0;
    let worstFogRatio = 0;
    for (let v = 0; v < CANYON_LOOP_LENGTH_M; v += 37) {
      const tint = skyriverDistrictHazeTint(model, v);
      // The tint vector itself is unit luminance.
      expect(skyriverLinearY(tint)).toBeCloseTo(1, 10);
      const factors = tint.map((channel) => 1 + weight * (channel - 1));
      const lit: SkyriverLinearRgb = [fog[0] * factors[0]!, fog[1] * factors[1]!, fog[2] * factors[2]!];
      const ratio = skyriverLinearY(lit) / skyriverLinearY(fog);
      // The honest bound: the fog luminance ratio sits inside the per-channel factor range. It is
      // NOT exactly 1 — a unit-luminance multiplier only preserves Y of a neutral colour.
      expect(ratio).toBeGreaterThanOrEqual(Math.min(...factors) - 1e-12);
      expect(ratio).toBeLessThanOrEqual(Math.max(...factors) + 1e-12);
      worstDeviation = Math.max(worstDeviation, ...factors.map((factor) => Math.abs(factor - 1)));
      worstFogRatio = Math.max(worstFogRatio, Math.abs(ratio - 1));
    }
    // Weak chroma multiplication, and a real (small) brightness move, not a preserved luminance.
    // The strongest channel moves by about 15% at the most saturated hue; the bound is the same 0.2
    // the blend test declares.
    expect(worstDeviation).toBeLessThan(0.2);
    expect(worstDeviation).toBeGreaterThan(0.1);
    expect(worstFogRatio).toBeGreaterThan(0);
    expect(worstFogRatio).toBeLessThanOrEqual(worstDeviation);
  });
});

describe('R22 draw calls and the unchanged render structure', () => {
  it('adds no draw call to the city or to the frame', () => {
    const stats = summarizeCityLayout(layoutFor(SEED));
    expect(stats.drawCalls).toBe(3);
    expect(stats.meshes).toBe(3);
    expect(stats.drawCallBudget).toBe(SKYRIVER_CITY_DRAW_CALL_BUDGET);
    for (const tier of [SkyriverQualityTier.High, SkyriverQualityTier.Medium, SkyriverQualityTier.Low]) {
      const estimate = skyriverDrawCallEstimate(skyriverQualityFor(tier));
      expect(estimate.city).toBe(4);
      expect(estimate.withinBudget).toBe(true);
    }
  });

  it('leaves the R19.7 room and pane fade windows alone', () => {
    expect(SKYRIVER_INTERIOR_FADE.full).toEqual([300, 900]);
    expect(SKYRIVER_INTERIOR_FADE.near).toEqual([120, 600]);
  });
});

describe('R22 single district query', () => {
  it('keeps every boundary comparison inside render/districts.ts', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    // Only the model owns a boundary. A second implementation of the lookup in a render module
    // would let one pass disagree with another about where a district starts.
    for (const file of ['render/city.ts', 'render/atmosphere.ts', 'render/scene.ts', 'main.ts']) {
      const source = readFileSync(join(here, '..', 'src', file), 'utf8');
      expect(source).not.toMatch(/\bstartM\b/);
      expect(source).not.toMatch(/\bendM\b/);
      expect(source).not.toMatch(/\bgreenGroups\b/);
    }
    const districts = readFileSync(join(here, '..', 'src', 'render', 'districts.ts'), 'utf8');
    expect(districts).toMatch(/\bstartM\b/);
    // The haze and the instance writes both go through the one exported query.
    const city = readFileSync(join(here, '..', 'src', 'render', 'city.ts'), 'utf8');
    const atmosphere = readFileSync(join(here, '..', 'src', 'render', 'atmosphere.ts'), 'utf8');
    expect(city).toContain('skyriverDistrictIdAt(this.districts,');
    expect(atmosphere).toContain('skyriverDistrictHazeMixAt(this.districts,');
  });
});

describe('R22 shader colour paths', () => {
  const source = SKYRIVER_CITY_SHADER_SOURCE;

  it('carries one colour chunk, one switch and one luminance definition per fragment shader', () => {
    expect(source.districtColour).toContain('uniform float uDistrictColour;');
    expect(source.districtColour).toContain('mix( c, y * mix( vec3( 1.0 ), unitHue, saturation ), uDistrictColour )');
    for (const shader of [source.towerFragment, source.trimFragment, source.signFragment, source.impostorFragment]) {
      expect(shader.split('uniform float uDistrictColour;')).toHaveLength(2);
      expect(shader.split('float skyriverLinearY( vec3 c )')).toHaveLength(2);
    }
  });

  it('recolours every required source path from the district attribute', () => {
    expect(source.towerVertex).toContain('attribute float aDistrict;');
    expect(source.trimVertex).toContain('attribute float aDistrict;');
    expect(source.signVertex).toContain('attribute vec4 aDistrictTint;');
    expect(source.impostorVertex).toContain('vCardDistrict = aCard.w;');

    // Signs: the complete emission, after core, halo, plate, angle, intensity and proximity ease.
    expect(source.signFragment).toContain('color = skyriverDistrictEmission( color, vDistrictTint.rgb, vDistrictTint.w );');
    // Rooms and resolved panes, then the matched far pane average.
    expect(source.towerFragment).toContain('resolved = skyriverDistrictTint( resolved, vDistrict, DISTRICT_ROOM_SATURATION );');
    expect(source.towerFragment).toContain('averaged = skyriverDistrictTint( averaged, vDistrict, DISTRICT_PANE_SATURATION );');
    // R15 far box windows, the crown parapet line, the deck skylights and the R13 landmark wash.
    expect(source.towerFragment).toContain('skyriverDistrictTint( farWindow, vDistrict, DISTRICT_PANE_SATURATION )');
    expect(source.towerFragment).toContain('skyriverDistrictTint( vec3( 0.75, 0.9, 1.0 ) * parapet');
    expect(source.towerFragment).toContain('skyriverDistrictLamp( vec3( 1.0, 0.55, 0.2 ) * skylight');
    expect(source.towerFragment).toContain('gl_FragColor.rgb += skyriverDistrictTint( washColor * wash * through * near * EMISSIVE_GAIN,');
    // Trim: neutral small lamps, large district accents.
    expect(source.trimFragment).toContain('skyriverDistrictLamp( vec3( 1.0, 0.68, 0.33 )');
    expect(source.trimFragment).toContain('skyriverDistrictLamp( vec3( 1.0, 0.62, 0.3 )');
    expect(source.trimFragment).toContain('vec3 floodStrip = skyriverDistrictTint(');
    expect(source.trimFragment).toContain('skyriverDistrictTint( bandLight * isBand');
    expect(source.trimFragment).toContain('skyriverDistrictTint( vec3( 0.72, 0.86, 1.0 ) * ( isBridge');
    // Far cards: the district rides the previously unused aCard.w, in the one existing draw.
    expect(source.impostorFragment).toContain('skyriverDistrictTint( card.rgb * 1.1 * dim * uEmissive, vCardDistrict, DISTRICT_FAR_CARD_SATURATION )');
  });

  it('leaves the red warnings and the blue skybridge underlight out of every recolour', () => {
    const untouched = [
      'color += vec3( 1.0, 0.16, 0.12 ) * ( isAntenna * head * blink * 1.5 * EMISSIVE_GAIN );',
      'vec3 floodWarning = vec3( 3.0, 0.4, 0.3 ) * tip * ( 0.5 + 0.5 * sin( uTime * 2.0 ) ) * EMISSIVE_GAIN;',
      'color += vec3( 0.3, 0.6, 1.0 ) * ( isBridge * under * 1.4 * EMISSIVE_GAIN );',
    ];
    for (const line of untouched) {
      expect(source.trimFragment).toContain(line);
      expect(line).not.toContain('skyriverDistrict');
    }
  });

  it('derives the distance grade target from the steel vector and keeps the legacy branch', () => {
    expect(source.distanceGrade).toContain('#define SKYRIVER_STEEL vec3( 0.6600, 0.7900, 0.9800 )');
    expect(source.distanceGrade).toContain(`#define SKYRIVER_STEEL_Y ${SKYRIVER_DISTANCE_GRADE_STEEL_Y.toPrecision(12)}`);
    expect(source.distanceGrade).not.toContain('0.776 ');
    expect(source.distanceGrade).toContain('vec3 legacy = mix( c, lum * SKYRIVER_STEEL, k ) * ( 1.0 - 0.55 * k );');
    expect(source.distanceGrade).toContain('return mix( legacy, graded, uDistrictColour );');
  });
});
