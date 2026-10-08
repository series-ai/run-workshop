/**
 * R23 render light set: stable identity over the drawn pool, bounded selection with smooth cutoff
 * weights, held membership with live cone axes, and the rigidity of a sign's drawn axis at a bend.
 *
 * The pool is built from records shaped exactly like `city.lightSources()`. The real city cannot be
 * constructed here — its sign atlas needs a DOM canvas — so the fixtures below reproduce the getter's
 * record shape, including the four-blade hero case where `signIdentity` genuinely repeats. The
 * end-to-end check that the getter's centres equal the drawn instance writes is R22's own evidence.
 */
import { describe, expect, it } from 'vitest';

import { warpCanyon, warpDirection, type WarpOut } from '../src/render/canyonWarp';
import type { SkyriverLightSource } from '../src/render/city';
import {
  SKYRIVER_LIGHT_CANDIDATE_LIMIT,
  SKYRIVER_LIGHT_ROLE_IMPORTANCE,
  SKYRIVER_LIGHT_SCORE_FLOOR,
  SKYRIVER_LIGHT_WEIGHT_MAX_STEP,
  SKYRIVER_LIGHT_WEIGHT_RAMP_S,
  skyriverApproach,
  skyriverLightCutoffWeight,
  skyriverLightWeightStep,
  SKYRIVER_RENDER_LIGHT_LIMIT,
  SKYRIVER_SCATTER_SPHERE_SR,
  SKYRIVER_STATION_PROXY_COUNT,
  SKYRIVER_STATION_PROXY_ROLES,
  SKYRIVER_TRIM_SOURCE_COEFFICIENTS,
  SkyriverLightSelection,
  skyriverBuildLightPool,
  skyriverLightPoolDuplicates,
  skyriverLightScore,
  skyriverLightSourceIdCollisions,
  skyriverLinearLuminance,
  skyriverScatterRadiusM,
  skyriverScatterResponse,
  skyriverSelectLights,
  type SkyriverRenderConeLight,
} from '../src/render/renderLightSet';
import { SKYRIVER_EMISSIVE_GAIN, type SkyriverBeamRecord } from '../src/render/atmosphere';

function sign(
  overrides: Partial<SkyriverLightSource> & { readonly id: string },
): SkyriverLightSource {
  return {
    role: 'ordinary-sign',
    districtId: 0,
    x: 0,
    y: 300,
    z: 0,
    sizeM: [12, 4, 0],
    axis: [1, 0, 0],
    emission: [2.4, 1.1, 2.0],
    legacyEmission: [1.8, 0.9, 1.6],
    ...overrides,
  };
}

function trim(
  overrides: Partial<SkyriverLightSource> & { readonly id: string; readonly role: SkyriverLightSource['role'] },
): SkyriverLightSource {
  return {
    districtId: 1,
    x: 0,
    y: 900,
    z: 0,
    sizeM: [60, 8, 10],
    axis: [1, 0, 0],
    emission: [0.75, 0.85, 1.05],
    legacyEmission: [0.75, 0.85, 1.05],
    ...overrides,
  };
}

function beam(slot: number, overrides: Partial<SkyriverBeamRecord> = {}): SkyriverBeamRecord {
  return {
    slot,
    start: [slot * 100, 2000, 0],
    axis: [0, -1, 0],
    lengthM: 2600 + slot * 100,
    widthStartM: 10 + slot,
    widthEndM: 150 + slot * 10,
    colorLinear: [0.62, 0.68, 0.74],
    seed: slot / 5,
    intensity: 0.025,
    softness: 8,
    fadeStart: 0.45,
    ...overrides,
  };
}

describe('R23 stable light identity', () => {
  it('keeps a hero wall’s four blades four separate sources', () => {
    // city.signIdentity is building|face|composition, which every blade of one hero composition
    // shares. Collapsing them would silently drop three real emitters from the pool.
    const heroKey = 'tower-42|face-1|hero-brand';
    const sources = [
      sign({ id: heroKey, role: 'hero-sign', x: 0 }),
      sign({ id: heroKey, role: 'hero-sign', x: 14 }),
      sign({ id: heroKey, role: 'hero-sign', x: 28 }),
      sign({ id: heroKey, role: 'hero-sign', x: 42 }),
      sign({ id: 'tower-9|face-0|c3' }),
    ];
    const pool = skyriverBuildLightPool({ sources, beams: [] });

    expect(pool).toHaveLength(5);
    expect(skyriverLightPoolDuplicates(pool)).toEqual([]);
    expect(new Set(pool.map((entry) => entry.id)).size).toBe(5);
    // The getter key really does repeat: that is what the ordinal exists to separate.
    const collisions = skyriverLightSourceIdCollisions(pool);
    expect(collisions).toEqual([{ sourceId: heroKey, count: 4 }]);
    // The ordinal comes from the full pool in getter order, never from a selected-list index.
    expect(pool.map((entry) => entry.ordinal)).toEqual([0, 1, 2, 3, 4]);
    for (const entry of pool.slice(0, 4)) expect(entry.id).toBe(`${heroKey}#${entry.ordinal}`);
  });

  it('is stable across rebuilds and unaffected by selection order', () => {
    const sources = [sign({ id: 'a|0|0' }), sign({ id: 'a|0|0' }), trim({ id: 'trim:3:9', role: 'trim-flood' })];
    const first = skyriverBuildLightPool({ sources, beams: [beam(0)] });
    const second = skyriverBuildLightPool({ sources, beams: [beam(0)] });
    expect(first.map((entry) => entry.id)).toEqual(second.map((entry) => entry.id));

    const { selected } = skyriverSelectLights(first, 0, 300, 0);
    for (const entry of selected) {
      const fromPool = first.find((candidate) => candidate.id === entry.source.id);
      expect(fromPool?.ordinal).toBe(entry.source.ordinal);
    }
  });

  it('keeps compacted trim ids as drawn, and never counts a hero twice', () => {
    // Trim ids are the compacted draw index the getter reports; they are not remapped back to a
    // deriveCityTrims index. Signs and heroes share one pool, so a hero appears exactly once.
    const sources = [
      sign({ id: 'h|0|hero', role: 'hero-sign' }),
      trim({ id: 'trim:17:4', role: 'trim-band-warm' }),
    ];
    const pool = skyriverBuildLightPool({ sources, beams: [] });
    expect(pool.map((entry) => entry.sourceId)).toEqual(['h|0|hero', 'trim:17:4']);
    expect(pool.filter((entry) => entry.role === 'hero-sign')).toHaveLength(1);
  });
});

describe('R23 source energy', () => {
  it('applies each gain exactly once, and never re-scales sign emission', () => {
    // Sign emission already carries its own 2.2/1.9 gain inside skyriverSignFinalEmission.
    const signSource = sign({ id: 's|0|0', emission: [2.4, 1.1, 2.0] });
    const pool = skyriverBuildLightPool({ sources: [signSource], beams: [] });
    expect(pool[0]!.emission).toEqual([2.4, 1.1, 2.0]);
    expect(pool[0]!.legacyEmission).toEqual([1.8, 0.9, 1.6]);

    // Trim emission is the base source term, so the live shader gain is applied here — once.
    const flood = trim({ id: 'trim:1:9', role: 'trim-flood', sizeM: [6, 120, 6] });
    const trimPool = skyriverBuildLightPool({ sources: [flood], beams: [] });
    const coefficients = SKYRIVER_TRIM_SOURCE_COEFFICIENTS['trim-flood'];
    // sizeM.y of 120 is above the 50 m threshold, so the flood strip's 1.5x size factor applies.
    const expected = coefficients.gain * coefficients.pulseMean * 1.5;
    expect(trimPool[0]!.emission[0]).toBeCloseTo(0.75 * expected, 10);
    expect(coefficients.gain).toBeCloseTo(SKYRIVER_EMISSIVE_GAIN, 10);
    expect(coefficients.pulseMean).toBe(0.85);
  });

  it('keeps both colour states on every record, so the shared flag is read at upload time', () => {
    const pool = skyriverBuildLightPool({
      sources: [sign({ id: 's|0|0' }), trim({ id: 'trim:2:4', role: 'trim-band-cold' })],
      beams: [],
    });
    for (const entry of pool) {
      expect(entry.emission).not.toBeUndefined();
      expect(entry.legacyEmission).not.toBeUndefined();
    }
  });

  it('carries exactly one radiance and no second brightness scalar', () => {
    // The measured R23 failure was a flux scalar that already contained the source luminance being
    // multiplied back into the source RGB: uploaded RGB reached 1585 and the frame rendered 97.77%
    // exact white. A record that cannot hold such a scalar cannot reintroduce it.
    const pool = skyriverBuildLightPool({
      sources: [sign({ id: 's|0|0' }), trim({ id: 'trim:1:9', role: 'trim-flood' })],
      beams: [beam(0)],
    });
    for (const entry of pool) {
      expect(Object.keys(entry)).not.toContain('energy');
      expect(Object.keys(entry)).not.toContain('rangeM');
      expect(Number.isFinite(entry.peakLuminance)).toBe(true);
      expect(entry.litAreaM2).toBeGreaterThan(0);
      expect(entry.scatterRadiusM).toBeCloseTo(skyriverScatterRadiusM(entry.litAreaM2), 12);
    }
  });

  it('derives the scatter radius from the lit area alone, so brightness never buys reach', () => {
    const dim = sign({ id: 'dim|0|0', emission: [1e-6, 1e-6, 1e-6], sizeM: [40, 20, 0] });
    const bright = sign({ id: 'bright|0|0', emission: [900, 900, 900], sizeM: [40, 20, 0] });
    const pool = skyriverBuildLightPool({ sources: [dim, bright], beams: [] });
    // Same drawn face, 900 million times the luminance: identical reach.
    expect(pool[0]!.litAreaM2).toBe(800);
    expect(pool[1]!.litAreaM2).toBe(800);
    expect(pool[1]!.scatterRadiusM).toBe(pool[0]!.scatterRadiusM);
    expect(pool[0]!.scatterRadiusM).toBeCloseTo(Math.sqrt(800 / (4 * Math.PI)), 12);
    // A lit area is the drawn face, not the box: a trim's term duty is part of it.
    const ribbon = trim({ id: 'trim:4:6', role: 'trim-skybridge-ribbon', sizeM: [400, 30, 30] });
    const ribbonPool = skyriverBuildLightPool({ sources: [ribbon], beams: [] });
    const duty = SKYRIVER_TRIM_SOURCE_COEFFICIENTS['trim-skybridge-ribbon'].faceDuty;
    const surface = 2 * (400 * 30 + 30 * 30 + 400 * 30);
    expect(ribbonPool[0]!.litAreaM2).toBeCloseTo(surface * duty, 9);
    expect(ribbonPool[0]!.litAreaM2).toBeLessThan(surface);
  });
});

// --- the measured R23 scatter unit failure, and the proxy that replaces it ----------------------

describe('R23 source-to-scatter unit proxy', () => {
  it('is bounded by one at the source and never exceeds the source emission', () => {
    for (const area of [1e-3, 1, 100, 42120, 2.08e5, 1e7]) {
      expect(skyriverScatterResponse(area, 0)).toBeCloseTo(1, 12);
      for (const distance of [0, 1, 10, 57.9, 200, 749, 2600, 1e5]) {
        const response = skyriverScatterResponse(area, distance);
        expect(response).toBeGreaterThanOrEqual(0);
        expect(response).toBeLessThanOrEqual(1);
      }
    }
    // Monotone non-increasing in distance, so no sample ever gets a spike between two steps.
    let previous = 1;
    for (let distance = 0; distance <= 3000; distance += 7) {
      const response = skyriverScatterResponse(42120, distance);
      expect(response).toBeLessThanOrEqual(previous + 1e-15);
      previous = response;
    }
    // Degenerate inputs stay finite rather than producing NaN in a shader-twin position.
    expect(skyriverScatterResponse(0, 0)).toBe(0);
    expect(skyriverScatterResponse(-5, 10)).toBe(0);
    expect(skyriverScatterResponse(100, -10)).toBeCloseTo(1, 12);
  });

  it('responds linearly when the source RGB doubles at fixed geometry', () => {
    // The failure squared brightness: energy carried Y(emission) and was multiplied into the RGB
    // again. Doubling the source must double the rank and the radiance, never quadruple it.
    const base = sign({ id: 's|0|0', emission: [0.4, 1.2, 1.6], sizeM: [120, 40, 0] });
    const doubled = sign({ id: 's|0|0', emission: [0.8, 2.4, 3.2], sizeM: [120, 40, 0] });
    const one = skyriverBuildLightPool({ sources: [base], beams: [] })[0]!;
    const two = skyriverBuildLightPool({ sources: [doubled], beams: [] })[0]!;

    expect(two.peakLuminance / one.peakLuminance).toBeCloseTo(2, 12);
    // Geometry is untouched: the same lit area and the same reach.
    expect(two.litAreaM2).toBe(one.litAreaM2);
    expect(two.scatterRadiusM).toBe(one.scatterRadiusM);
    for (const distance of [0, 50, 300, 1200]) {
      expect(skyriverScatterResponse(two.litAreaM2, distance))
        .toBe(skyriverScatterResponse(one.litAreaM2, distance));
    }
    const camera = [300, 340, 120] as const;
    const scoreOne = skyriverLightScore(one, camera[0], camera[1], camera[2]).score;
    const scoreTwo = skyriverLightScore(two, camera[0], camera[1], camera[2]).score;
    expect(scoreTwo / scoreOne).toBeCloseTo(2, 12);
    expect(scoreTwo / scoreOne).not.toBeCloseTo(4, 2);
    // And the scatter radiance the marcher applies is emission x response: linear in the source.
    const response = skyriverScatterResponse(one.litAreaM2, 300);
    expect(two.emission[1] * response).toBeCloseTo(2 * one.emission[1] * response, 12);
  });

  it('bounds the near contribution at the source emission, for the measured failing source', () => {
    // The hero blade from smoke-sources.json: a 468 x 90 m drawn face at Y = 1.64. The initial
    // build bound [45.1, 1407.6, 1585.3] for it. The proxy binds the emission itself, and the
    // largest radiance any sample can receive is that emission at zero distance.
    const hero = sign({
      id: 'tower:630.00:0.00|face-4|hero-row-1',
      role: 'hero-sign',
      sizeM: [468, 90, 0],
      emission: [0.0653, 2.0397, 2.2971],
    });
    const source = skyriverBuildLightPool({ sources: [hero], beams: [] })[0]!;
    expect(source.litAreaM2).toBeCloseTo(42120, 6);
    expect(source.peakLuminance).toBeCloseTo(1.6388, 3);

    for (const distance of [0, 1, 20, 100, 749, 2600]) {
      const response = skyriverScatterResponse(source.litAreaM2, distance);
      for (let channel = 0; channel < 3; channel += 1) {
        const radiance = source.emission[channel]! * response;
        expect(radiance).toBeLessThanOrEqual(source.emission[channel]! + 1e-12);
      }
    }
    // The peak is the emission exactly, which is three orders below the 1585 that rendered white.
    expect(source.emission[2]! * skyriverScatterResponse(source.litAreaM2, 0)).toBeCloseTo(2.2971, 6);
    expect(source.emission[2]!).toBeLessThan(1585.3183 / 100);
  });

  it('falls off with world distance as the lit area over the sphere', () => {
    const area = 42120;
    const radius = skyriverScatterRadiusM(area);
    expect(radius).toBeCloseTo(Math.sqrt(area / SKYRIVER_SCATTER_SPHERE_SR), 12);
    // Half response at the scatter radius, by construction.
    expect(skyriverScatterResponse(area, radius)).toBeCloseTo(0.5, 12);
    // Far field: area / (4 pi d^2), so doubling the distance quarters the response.
    const far = skyriverScatterResponse(area, 2000);
    expect(far).toBeCloseTo(area / (SKYRIVER_SCATTER_SPHERE_SR * 2000 * 2000), 4);
    expect(skyriverScatterResponse(area, 4000) / far).toBeCloseTo(0.25, 3);
    // Halving the lit area halves the far-field reach, and the near bound does not move.
    expect(skyriverScatterResponse(area / 2, 2000) / far).toBeCloseTo(0.5, 3);
    expect(skyriverScatterResponse(area / 2, 0)).toBeCloseTo(1, 12);
    // Distance is measured to the drawn line light, not to its centre.
    const strip = sign({ id: 'strip|0|0', sizeM: [400, 20, 0], axis: [1, 0, 0], x: 0, y: 300, z: 0 });
    const pool = skyriverBuildLightPool({ sources: [strip], beams: [] });
    const end = skyriverLightScore(pool[0]!, 180, 300, 40);
    const centre = skyriverLightScore(pool[0]!, 0, 300, 40);
    expect(end.distanceM).toBeCloseTo(centre.distanceM, 9);
    expect(end.score).toBeCloseTo(centre.score, 12);
  });

  it('ranks point, cone and station sources in one unit, so a near beam can enter the set', () => {
    // The measured failure: all ten selected sources were inflated heroes and floods (energies
    // 406-690, boundary 144.5), and no searchlight or station proxy could ever compete. The rank is
    // now peak radiance times the same bounded proxy the marcher scatters, for every kind.
    const sources: SkyriverLightSource[] = [];
    for (let i = 0; i < 12; i += 1) {
      // Twelve hero blades down the canyon: 1.07-1.56 km from the camera after the line-light
      // clamp, which is the range the captured view actually held.
      sources.push(sign({
        id: `hero-${i}|face|row`,
        role: 'hero-sign',
        sizeM: [468, 90, 0],
        emission: [0.0653, 2.0397, 2.2971],
        x: 1500 + i * 45,
        y: 1000,
        z: 0,
      }));
    }
    // One real drawn trim promoted to a station proxy, 100 m off the route.
    sources.unshift(trim({
      id: 'trim:4:6', role: 'trim-skybridge-ribbon', sizeM: [400, 30, 30], x: 200, y: 1100, z: 0,
    }));
    // A searchlight whose shaft passes 120 m from the camera.
    const pool = skyriverBuildLightPool({ sources, beams: [beam(0, { start: [320, 2000, 0], axis: [0, -1, 0] })] });
    const { selected } = skyriverSelectLights(pool, 200, 1000, 0);

    const kinds = new Set(selected.map((entry) => entry.source.kind));
    expect(selected).toHaveLength(SKYRIVER_RENDER_LIGHT_LIMIT);
    expect(kinds).toEqual(new Set(['sign', 'cone', 'station']));
    // The near beam outranks the far blades it used to lose to by three orders of magnitude.
    const cone = selected.find((entry) => entry.source.kind === 'cone')!;
    const farthest = selected.filter((entry) => entry.source.kind === 'sign').at(-1)!;
    expect(cone.distanceM).toBeCloseTo(120, 6);
    expect(cone.score).toBeGreaterThan(farthest.score);

    // Coherence, source by source: the rank is exactly peak radiance x importance x response.
    for (const entry of selected) {
      const expected = entry.source.peakLuminance
        * SKYRIVER_LIGHT_ROLE_IMPORTANCE[entry.source.kind]
        * skyriverScatterResponse(entry.source.litAreaM2, entry.distanceM);
      expect(entry.score).toBeCloseTo(expected, 12);
    }
    // No role is boosted in this round, so a rank is the proxy alone.
    expect(SKYRIVER_LIGHT_ROLE_IMPORTANCE).toEqual({ sign: 1, cone: 1, station: 1 });
  });

  it('gives a cone its drawn beam amplitude and its shaft side area', () => {
    const record = beam(0, { widthStartM: 10, widthEndM: 150, lengthM: 2600, intensity: 0.025 });
    const cone = skyriverBuildLightPool({ sources: [], beams: [record] })[0] as SkyriverRenderConeLight;
    // Peak radiance is what BEAM_FRAGMENT peaks at: colour x intensity, applied once.
    expect(cone.peakLuminance)
      .toBeCloseTo(skyriverLinearLuminance(record.colorLinear as readonly [number, number, number]) * 0.025, 12);
    // Proxy area is the shaft's own side area: mean width over the taper, times length.
    expect(cone.litAreaM2).toBeCloseTo(((10 + 150) / 2) * 2600, 9);
    expect(cone.scatterRadiusM).toBeCloseTo(skyriverScatterRadiusM(cone.litAreaM2), 12);
  });
});

describe('R23 station-glow proxies', () => {
  it('promotes two or three real drawn trims, and records which', () => {
    // There are no transit-station records in the source at all. Rather than invent invisible point
    // lights under a station name, R23 promotes real emissive trims: the recoloured skybridge side
    // ribbon first, then the landmark flood strip.
    const sources = [
      trim({ id: 'trim:4:6', role: 'trim-skybridge-ribbon' }),
      trim({ id: 'trim:5:6', role: 'trim-skybridge-ribbon' }),
      trim({ id: 'trim:6:6', role: 'trim-skybridge-ribbon' }),
      trim({ id: 'trim:7:9', role: 'trim-flood' }),
      trim({ id: 'trim:8:9', role: 'trim-flood' }),
    ];
    const pool = skyriverBuildLightPool({ sources, beams: [] });
    const stations = pool.filter((entry) => entry.kind === 'station');

    expect(stations.length).toBeGreaterThanOrEqual(2);
    expect(stations.length).toBeLessThanOrEqual(SKYRIVER_STATION_PROXY_COUNT);
    for (const station of stations) {
      expect(SKYRIVER_STATION_PROXY_ROLES).toContain(station.role);
      // The chosen trim id is recorded, so the report names a real instance.
      expect(station.kind === 'station' && station.trimId).toBe(station.sourceId);
    }
    // The ribbon is preferred, and it is the recoloured side ribbon — never the separate,
    // untouched blue underlight, which the getter does not report.
    expect(stations[0]!.role).toBe('trim-skybridge-ribbon');
    // Every other large trim stays a bounded area source rather than becoming a station.
    expect(pool.filter((entry) => entry.kind === 'sign')).toHaveLength(sources.length - stations.length);
  });
});

describe('R23 bounded selection', () => {
  /**
   * Large drawn strips, so the whole fixture population scores above the absolute floor across the
   * walk below and the binding cutoff really is tenth place. With the bounded area proxy a small
   * face is negligible a few hundred metres away, which is the point of the floor — see the proxy
   * suite above — so a cutoff test has to use sources that genuinely compete.
   */
  function manySigns(count: number): SkyriverLightSource[] {
    const sources: SkyriverLightSource[] = [];
    for (let i = 0; i < count; i += 1) {
      sources.push(sign({ id: `t${i}|0|0`, sizeM: [240, 60, 0], x: i * 40, z: i * 25, y: 200 + (i % 7) * 60 }));
    }
    return sources;
  }

  it('selects at most ten sources, however large the pool', () => {
    const pool = skyriverBuildLightPool({ sources: manySigns(400), beams: [beam(0), beam(1)] });
    expect(pool.length).toBe(402);
    const { selected } = skyriverSelectLights(pool, 0, 220, 0);
    expect(selected.length).toBeLessThanOrEqual(SKYRIVER_RENDER_LIGHT_LIMIT);
    expect(SKYRIVER_RENDER_LIGHT_LIMIT).toBe(10);
    // The pool larger than ten stays on the CPU: nothing unbounded is ever uploaded.
    expect(pool.length).toBeGreaterThan(selected.length);
  });

  it('ranks by bounded visible energy, finite at zero distance, and breaks ties on the stable id', () => {
    const onCamera = sign({ id: 'onCamera|0|0', x: 0, y: 200, z: 0 });
    const pool = skyriverBuildLightPool({ sources: [onCamera, ...manySigns(20)], beams: [] });
    const { selected } = skyriverSelectLights(pool, 0, 200, 0);
    expect(selected[0]!.source.id).toBe('onCamera|0|0#0');
    for (const entry of selected) {
      expect(Number.isFinite(entry.score)).toBe(true);
      expect(entry.score).toBeGreaterThan(SKYRIVER_LIGHT_SCORE_FLOOR);
    }

    // Two identical sources at the same distance must order by id, not by pool accident.
    const tiedSources = [
      sign({ id: 'b|0|0', x: 100, y: 200, z: 0 }),
      sign({ id: 'a|0|0', x: -100, y: 200, z: 0 }),
    ];
    const tied = skyriverSelectLights(
      skyriverBuildLightPool({ sources: tiedSources, beams: [] }), 0, 200, 0,
    ).selected;
    expect(tied.map((entry) => entry.source.id)).toEqual(['a|0|0#1', 'b|0|0#0']);
  });

  it('gives a smooth weight at the real cutoff, which is tenth place', () => {
    // The binding cutoff in a canyon this dense is the selection boundary, not an absolute floor:
    // nearly every drawn source scores above the floor. So the ramp is measured against the score
    // of the best REJECTED source, which is exactly where a light pops in or out.
    expect(skyriverLightCutoffWeight(1, 0)).toBe(1);
    expect(skyriverLightCutoffWeight(1, 1)).toBe(0);
    expect(skyriverLightCutoffWeight(1.5, 1)).toBe(1);
    expect(skyriverLightCutoffWeight(1.25, 1)).toBeCloseTo(0.5, 6);

    // Every source must fade continuously as the camera flies: no source may step in or out.
    const pool = skyriverBuildLightPool({ sources: manySigns(40), beams: [] });
    const track = new Map<string, number[]>();
    for (const entry of pool) track.set(entry.id, []);
    const frames = 201;
    for (let frame = 0; frame < frames; frame += 1) {
      const z = frame * 10;
      const { selected } = skyriverSelectLights(pool, 0, 200, z);
      const live = new Map(selected.map((entry) => [entry.source.id, entry.weight]));
      for (const [id, series] of track) series.push(live.get(id) ?? 0);
    }

    let sawFullWeight = false;
    let sawZero = false;
    let worstStep = 0;
    for (const series of track.values()) {
      for (let i = 1; i < series.length; i += 1) {
        worstStep = Math.max(worstStep, Math.abs(series[i]! - series[i - 1]!));
      }
      if (Math.max(...series) > 0.999) sawFullWeight = true;
      if (Math.min(...series) === 0) sawZero = true;
    }
    // Sources really do enter and leave over this walk, and never by a jump.
    expect(sawFullWeight).toBe(true);
    expect(sawZero).toBe(true);
    expect(worstStep).toBeLessThan(0.2);
  });

  it('recomputes weights every frame while membership is held', () => {
    const pool = skyriverBuildLightPool({ sources: manySigns(60), beams: [] });
    const selection = new SkyriverLightSelection(pool);
    const first = selection.update(0, 0, 200, 0).map((entry) => entry.weight);
    // Same bucket, camera moved: membership is held but the weights must have moved with it.
    const second = selection.update(0.5, 0, 200, 900).map((entry) => entry.weight);
    expect(selection.stats().refreshes).toBe(1);
    expect(second).not.toEqual(first);
  });

  it('scores a LIVE boundary inside one bucket, not the one frozen at the refresh', () => {
    // The defect this closes: weights were recomputed against a boundaryScore captured at the last
    // refresh, and the best REJECTED source was never scored again. Flying toward a rejected
    // source Y therefore left a held source X at weight 1 against a stale boundary, and at the
    // next refresh X went 1 -> 0 while Y went 0 -> about 1. A live boundary is what removes the
    // step: it rises as the camera approaches better sources, so X is already fading before Y
    // arrives.
    const pool = skyriverBuildLightPool({ sources: manySigns(60), beams: [] });
    const selection = new SkyriverLightSelection(pool);
    selection.update(0, 0, 200, 0);
    const atRefresh = selection.stats().boundaryScore;
    expect(atRefresh).toBeGreaterThan(0);
    // Same bucket, camera moved a long way down the canyon.
    selection.update(0.5, 0, 200, 900);
    expect(selection.stats().boundaryScore).not.toBe(atRefresh);
    // More sources are scored every frame than are uploaded: that is what makes the boundary live.
    expect(selection.stats().scoredLastFrame).toBeGreaterThan(SKYRIVER_RENDER_LIGHT_LIMIT);
    expect(selection.stats().scoredLastFrame)
      .toBeLessThanOrEqual(SKYRIVER_LIGHT_CANDIDATE_LIMIT + SKYRIVER_RENDER_LIGHT_LIMIT);
  });

  it('bounds one frame’s weight change whatever the delta, and lands exactly on the target', () => {
    expect(skyriverLightWeightStep(0)).toBe(0);
    expect(skyriverLightWeightStep(-1)).toBe(0);
    expect(skyriverLightWeightStep(1 / 60)).toBeCloseTo((1 / 60) / SKYRIVER_LIGHT_WEIGHT_RAMP_S, 12);
    // A long frame ramps over more frames, never in a bigger jump.
    expect(skyriverLightWeightStep(5)).toBe(SKYRIVER_LIGHT_WEIGHT_MAX_STEP);
    expect(SKYRIVER_LIGHT_WEIGHT_MAX_STEP).toBeLessThan(0.2);

    expect(skyriverApproach(0, 1, 0.1)).toBeCloseTo(0.1, 12);
    expect(skyriverApproach(1, 0, 0.1)).toBeCloseTo(0.9, 12);
    // Monotone, and it never overshoots: 0.05 away with a 0.1 step lands on the target.
    expect(skyriverApproach(0.95, 1, 0.1)).toBe(1);
    expect(skyriverApproach(0.05, 0, 0.1)).toBe(0);
    expect(skyriverApproach(0.5, 0.5, 0.1)).toBe(0.5);
  });

  /**
   * Drives the stateful selector over a camera walk and returns the worst per-frame weight step
   * for ANY source id, counting an absent source as 0.
   *
   * The walk is the evidence: a pure-ranker loop never touches the hold at all.
   */
  function walkWorstStep(options: {
    readonly selection: SkyriverLightSelection;
    readonly frames: number;
    readonly metresPerSecond: number;
  }): { worstStep: number; worstId: string; entries: number; exits: number; ids: number } {
    const { selection, frames, metresPerSecond } = options;
    const live = new Map<string, number>();
    const seen = new Set<string>();
    let worstStep = 0;
    let worstId = '';
    let entries = 0;
    let exits = 0;
    for (let frame = 0; frame < frames; frame += 1) {
      const timeS = frame / 60;
      const selected = selection.update(timeS, 0, 200, timeS * metresPerSecond);
      expect(selected.length).toBeLessThanOrEqual(SKYRIVER_RENDER_LIGHT_LIMIT);
      const next = new Map(selected.map((entry) => [entry.source.id, entry.weight]));
      for (const id of new Set([...live.keys(), ...next.keys()])) {
        const before = live.get(id) ?? 0;
        const after = next.get(id) ?? 0;
        // The first frame snaps: it is the declared start-up discontinuity, like a replay seek.
        if (frame > 0 && Math.abs(after - before) > worstStep) {
          worstStep = Math.abs(after - before);
          worstId = id;
        }
        if (before === 0 && after > 0) entries += 1;
        if (before > 0 && after === 0) exits += 1;
      }
      for (const id of next.keys()) seen.add(id);
      live.clear();
      for (const [id, weight] of next) live.set(id, weight);
    }
    return { worstStep, worstId, entries, exits, ids: seen.size };
  }

  it('keeps every id continuous when the candidate set turns over fast', () => {
    // The harsh case the ramp exists for: a source outside the live candidate set is NOT being
    // scored, so at the next bucket refresh it can enter already far above the boundary. The live
    // boundary alone cannot smooth that — only the per-source ramp can, and only because a slot is
    // never handed over until the source leaving it has reached zero.
    const pool = skyriverBuildLightPool({ sources: manySigns(240), beams: [] });
    const selection = new SkyriverLightSelection(pool);
    const walk = walkWorstStep({ selection, frames: 60 * 5, metresPerSecond: 900 });
    expect(walk.ids).toBeGreaterThan(SKYRIVER_RENDER_LIGHT_LIMIT * 3);
    expect(walk.entries).toBeGreaterThan(SKYRIVER_RENDER_LIGHT_LIMIT);
    expect(walk.exits).toBeGreaterThan(SKYRIVER_RENDER_LIGHT_LIMIT);
    expect({ step: walk.worstStep < 0.2, id: walk.worstId })
      .toEqual({ step: true, id: walk.worstId });
    expect(walk.worstStep).toBeLessThanOrEqual(SKYRIVER_LIGHT_WEIGHT_MAX_STEP + 1e-12);
  });

  it('keeps every source id continuous over a camera walk across three refresh buckets', () => {
    // The requested evidence for the no-pop claim, driven through the STATEFUL selector — the path
    // the scene actually uses. The old smoothness test called the pure ranker every frame and
    // never exercised the hold at all, so it could not have caught the 1 Hz full-weight step.
    const pool = skyriverBuildLightPool({ sources: manySigns(80), beams: [beam(0), beam(1)] });
    const selection = new SkyriverLightSelection(pool);
    const frames = 60 * 4;            // four seconds at 60 Hz: four hold buckets, three crossings.
    const live = new Map<string, number>();
    let worstStep = 0;
    let worstStepId = '';
    let sawEntry = false;
    let sawExit = false;
    const seen = new Set<string>();

    for (let frame = 0; frame < frames; frame += 1) {
      const timeS = frame / 60;
      // A straight run down the canyon at 120 m/s, which is the autopilot's own order of speed.
      const selected = selection.update(timeS, 0, 200, timeS * 120);
      expect(selected.length).toBeLessThanOrEqual(SKYRIVER_RENDER_LIGHT_LIMIT);

      const next = new Map(selected.map((entry) => [entry.source.id, entry.weight]));
      // Every id that appears on either side of this frame, so an ABSENT source counts as 0.
      for (const id of new Set([...live.keys(), ...next.keys()])) {
        const before = live.get(id) ?? 0;
        const after = next.get(id) ?? 0;
        // The first frame snaps: it is the declared start-up discontinuity, like a replay seek.
        if (frame > 0 && Math.abs(after - before) > worstStep) {
          worstStep = Math.abs(after - before);
          worstStepId = id;
        }
        if (before === 0 && after > 0) sawEntry = true;
        if (before > 0 && after === 0) sawExit = true;
      }
      for (const id of next.keys()) seen.add(id);
      live.clear();
      for (const [id, weight] of next) live.set(id, weight);
    }

    // Membership really does turn over across this walk, so the invariant is being exercised.
    expect(selection.stats().refreshes).toBeGreaterThanOrEqual(4);
    expect(seen.size).toBeGreaterThan(SKYRIVER_RENDER_LIGHT_LIMIT);
    expect(sawEntry).toBe(true);
    expect(sawExit).toBe(true);
    expect(selection.stats().admissions).toBeGreaterThan(SKYRIVER_RENDER_LIGHT_LIMIT);
    expect(selection.stats().releases).toBeGreaterThan(0);
    // The invariant: no source id steps by more than 0.2 in one 60 Hz frame, absent counted as 0.
    expect({ worstStep: worstStep < 0.2, worstStepId }).toEqual({ worstStep: true, worstStepId });
    expect(worstStep).toBeLessThan(0.2);
    expect(worstStep).toBeLessThanOrEqual(SKYRIVER_LIGHT_WEIGHT_MAX_STEP + 1e-12);
    expect(selection.stats().worstWeightStep).toBeLessThanOrEqual(SKYRIVER_LIGHT_WEIGHT_MAX_STEP + 1e-12);
  });

  it('never reuses a slot before the leaving source has reached zero', () => {
    // "No pop" is exactly this: an uploaded id is never replaced while it still carries light.
    const pool = skyriverBuildLightPool({ sources: manySigns(80), beams: [] });
    const selection = new SkyriverLightSelection(pool);
    let previous = new Map<string, number>();
    for (let frame = 0; frame < 60 * 3; frame += 1) {
      const timeS = frame / 60;
      const selected = selection.update(timeS, 0, 200, timeS * 200);
      const next = new Map(selected.map((entry) => [entry.source.id, entry.weight]));
      if (frame > 0) {
        for (const [id, weight] of previous) {
          // A source that has gone was on its last ramp step: it left from at most one step above
          // zero, so its disappearance is the same bounded change as every other frame of its
          // fade. It was never replaced while it still carried real light.
          if (!next.has(id)) expect(weight).toBeLessThanOrEqual(SKYRIVER_LIGHT_WEIGHT_MAX_STEP);
        }
        for (const [id, weight] of next) {
          // A source that has arrived arrived at exactly zero and ramps up from there.
          if (!previous.has(id)) expect(weight).toBe(0);
        }
      }
      previous = next;
    }
  });

  it('scans the full pool once per hold bucket, and resets its bucket on time reversal', () => {
    const pool = skyriverBuildLightPool({ sources: manySigns(60), beams: [] });
    const selection = new SkyriverLightSelection(pool);

    selection.update(0, 0, 200, 0);
    expect(selection.stats().refreshes).toBe(1);
    // Inside the same second the candidate set is held: no second full-pool scan.
    selection.update(0.4, 5000, 200, 5000);
    selection.update(0.9, 9000, 200, 9000);
    expect(selection.stats().refreshes).toBe(1);
    const held = selection.current().map((entry) => entry.source.id);

    // Crossing the bucket re-ranks the pool. Membership does NOT swap in that frame: the sources
    // that lost their place ramp out first, which is the whole point of the slot policy.
    selection.update(1.05, 9000, 200, 9000);
    expect(selection.stats().refreshes).toBe(2);
    expect(selection.current().map((entry) => entry.source.id)).toEqual(held);
    for (const entry of selection.current()) expect(entry.weight).toBeLessThan(1);

    // Held long enough, the new ranking does take over.
    for (let frame = 0; frame < 60; frame += 1) {
      selection.update(1.05 + frame / 60, 9000, 200, 9000);
    }
    expect(selection.current().map((entry) => entry.source.id)).not.toEqual(held);

    // Time running backwards is a replay seek: the held candidate set belongs to a later time.
    const before = selection.stats().resets;
    selection.update(0.2, 0, 200, 0);
    expect(selection.stats().resets).toBe(before + 1);
    // A declared discontinuity snaps rather than ramps: the volume history is dropped in the same
    // place, so ramping here would only delay the correct answer behind a frame that is already
    // discontinuous.
    expect(Math.max(...selection.current().map((entry) => entry.weight))).toBeGreaterThan(0);
  });

  it('records the policy it ran and what that policy cost', () => {
    const pool = skyriverBuildLightPool({ sources: manySigns(200), beams: [] });
    const selection = new SkyriverLightSelection(pool);
    selection.update(0, 0, 200, 0);
    selection.update(1 / 60, 0, 200, 2);
    const stats = selection.stats();
    expect(stats.poolSize).toBe(200);
    expect(stats.limit).toBe(SKYRIVER_RENDER_LIGHT_LIMIT);
    expect(stats.candidateLimit).toBe(SKYRIVER_LIGHT_CANDIDATE_LIMIT);
    expect(stats.candidateLimit).toBeGreaterThan(stats.limit);
    expect(stats.candidates).toBeGreaterThan(stats.limit);
    expect(stats.weightRampS).toBe(SKYRIVER_LIGHT_WEIGHT_RAMP_S);
    expect(stats.maxWeightStep).toBe(SKYRIVER_LIGHT_WEIGHT_MAX_STEP);
    expect(stats.selected).toBe(SKYRIVER_RENDER_LIGHT_LIMIT);
    // The ten-source upload limit is never exceeded, whatever the candidate set is doing.
    expect(stats.selected).toBeLessThanOrEqual(SKYRIVER_RENDER_LIGHT_LIMIT);
    expect(stats.policy).toMatch(/full pool scan once per 1s bucket/);
    expect(stats.policy).toMatch(/weight ramp over 0\.25s/);
    expect(stats.policy).toMatch(/slot reuse only after the leaving source reaches 0/);
  });

  it('keeps a selected searchlight’s geometry live, not frozen with its membership', () => {
    const pool = skyriverBuildLightPool({ sources: [], beams: [beam(0)] });
    const cone = pool[0] as SkyriverRenderConeLight;
    expect(cone.kind).toBe('cone');
    // The record binds a beam SLOT, not a copied axis, so re-reading the slot gives the live axis.
    expect(cone.beamSlot).toBe(0);
    // A searchlight keeps its own colour on both sides of the R22 colour A/B, like the drawn beam.
    expect(cone.emission).toEqual(cone.legacyEmission);
    expect(cone.districtId).toBe(-1);
    expect(cone.intensity).toBe(0.025);
    expect(cone.softness).toBe(8);
    expect(cone.fadeStart).toBe(0.45);
    expect(cone.lengthM).toBe(2600);
  });

  it('never lights the air from a sign that is not drawn', () => {
    // The getter omits removed signs and hero-cleared trims, so the pool cannot contain them.
    const pool = skyriverBuildLightPool({ sources: [], beams: [] });
    expect(pool).toEqual([]);
    expect(skyriverSelectLights(pool, 0, 0, 0).selected).toEqual([]);
  });
});

describe('R23 rigid source frames at a bend', () => {
  it('keeps a strip sign’s long axis in its drawn facade plane, at every heading', () => {
    // The city derives a sign's axis from the WARPED facade normal, so the axis must stay
    // perpendicular to that normal and unit length wherever the canyon bends. If the axis came from
    // derivation space instead, this would fail as soon as the local heading turned.
    const warp: WarpOut = { x: 0, z: 0, heading: 0 };
    const direction = { x: 0, z: 0 };
    for (let v = -6000; v <= 6000; v += 137) {
      warpCanyon(240, v, warp);
      // The derivation-space facade normal, bent onto the loop exactly as buildSignGeometry does.
      warpDirection(1, 0, warp.heading, direction);
      const normal = [direction.x, 0, direction.z] as const;
      // The axis city.ts records for a strip: perpendicular to the normal, in the horizontal plane.
      const axis = [-normal[2], 0, normal[0]] as const;

      const length = Math.hypot(axis[0], axis[1], axis[2]);
      expect(length).toBeCloseTo(1, 6);
      const dot = axis[0] * normal[0] + axis[1] * normal[1] + axis[2] * normal[2];
      expect(Math.abs(dot)).toBeLessThan(1e-9);
    }
  });

  it('measures distance to a line light along its own drawn axis', () => {
    // A 120 m strip must light the air along its whole length, not only at its centre. Sampling
    // 50 m off-centre along the axis has to be as close as sampling the centre itself.
    const strip = sign({ id: 'strip|0|0', sizeM: [120, 6, 0], axis: [1, 0, 0], x: 0, y: 300, z: 0 });
    const pool = skyriverBuildLightPool({ sources: [strip], beams: [] });
    expect(pool[0]!.kind).toBe('sign');
    expect(pool[0]!.kind === 'sign' && pool[0]!.halfLengthM).toBe(60);

    const atCentre = skyriverSelectLights(pool, 0, 340, 0).selected[0]!;
    const alongAxis = skyriverSelectLights(pool, 50, 340, 0).selected[0]!;
    const offAxis = skyriverSelectLights(pool, 0, 340, 50).selected[0]!;
    expect(alongAxis.distanceM).toBeCloseTo(atCentre.distanceM, 6);
    expect(offAxis.distanceM).toBeGreaterThan(atCentre.distanceM);
  });
});
