/**
 * @file derive.test.ts — seeded derivation sanity for the Skyriver sim (plan T2).
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   Design "Sim ↔ render split" — city layout and traffic params are presentation-derived,
 *     pure f(seed), cached at boot and never evaluated inside step().
 *   Design "Identity & session config" — the seed drives every derive* function, so any
 *     peer or replay reproduces the same city and traffic.
 *   R3/R4 — seeded brutalist canyon; traffic in Fifth Element altitude bands.
 *
 * API anchors: dist/index.d.ts root entry exports DeterministicRandom, fbm2D, createDeterministicMath;
 *   derive.ts must stay node-testable, so it holds plain data and no three.js import.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  MAX_CITY_TOWERS,
  TRAFFIC_ARCHETYPE_COUNT,
  TRAFFIC_BAND_COUNT,
  TRAFFIC_MAX_ALTITUDE_M,
  TRAFFIC_MAX_CARS,
  TRAFFIC_MIN_ALTITUDE_M,
  deriveCityLayout,
  deriveTrafficParams,
} from '../src/sim/derive';
import { CHASM_BOUNDS } from '../src/sim/systems';

describe('deriveCityLayout', () => {
  it('is pure: the same seed gives a structurally identical layout', () => {
    expect(deriveCityLayout(4242)).toStrictEqual(deriveCityLayout(4242));
  });

  it('varies with the seed', () => {
    expect(deriveCityLayout(4242)).not.toStrictEqual(deriveCityLayout(4243));
  });

  it('stays bounded and finite', () => {
    const layout = deriveCityLayout(7);

    expect(layout.towers.length).toBeGreaterThan(32);
    expect(layout.towers.length).toBeLessThanOrEqual(MAX_CITY_TOWERS);
    for (const tower of layout.towers) {
      for (const value of [tower.x, tower.z, tower.width, tower.depth, tower.height]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(tower.width).toBeGreaterThan(0);
      expect(tower.depth).toBeGreaterThan(0);
      expect(tower.height).toBeGreaterThan(0);
      expect(Number.isInteger(tower.tint)).toBe(true);
      expect(tower.tint).toBeGreaterThanOrEqual(0);
      expect(tower.tint).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('leaves the flight corridor clear, so the canyon is flyable', () => {
    const layout = deriveCityLayout(7);

    for (const tower of layout.towers) {
      const nearestX = Math.abs(tower.x) - tower.width / 2;
      expect(nearestX, `tower at x=${tower.x} intrudes into the chasm`).toBeGreaterThanOrEqual(CHASM_BOUNDS.maxX);
    }
  });

  it('produces kilometre-scale towers that read as a canyon wall', () => {
    const layout = deriveCityLayout(7);
    const tallest = layout.towers.reduce((max, tower) => Math.max(max, tower.height), 0);

    expect(tallest).toBeGreaterThan(800);
    expect(tallest).toBeLessThanOrEqual(layout.maxHeight);
  });

  it('holds plain data only, with no renderer types', () => {
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'sim', 'derive.ts'), 'utf8');

    expect(source).not.toContain('three');
    expect(JSON.parse(JSON.stringify(deriveCityLayout(7)))).toStrictEqual(deriveCityLayout(7));
  });
});

describe('deriveTrafficParams', () => {
  it('is pure: the same seed and count give identical arrays', () => {
    const left = deriveTrafficParams(99, 2400);
    const right = deriveTrafficParams(99, 2400);

    expect([...left.lane]).toStrictEqual([...right.lane]);
    expect([...left.speed]).toStrictEqual([...right.speed]);
    expect([...left.phase]).toStrictEqual([...right.phase]);
    expect([...left.altitude]).toStrictEqual([...right.altitude]);
    expect([...left.band]).toStrictEqual([...right.band]);
    expect([...left.archetype]).toStrictEqual([...right.archetype]);
  });

  it('varies with the seed', () => {
    expect([...deriveTrafficParams(99, 512).phase]).not.toStrictEqual([...deriveTrafficParams(100, 512).phase]);
  });

  it('is typed-array backed and exactly `count` long', () => {
    const traffic = deriveTrafficParams(99, 2400);

    expect(traffic.count).toBe(2400);
    expect(traffic.lane).toBeInstanceOf(Float32Array);
    expect(traffic.speed).toBeInstanceOf(Float32Array);
    expect(traffic.phase).toBeInstanceOf(Float32Array);
    expect(traffic.altitude).toBeInstanceOf(Float32Array);
    expect(traffic.band).toBeInstanceOf(Uint8Array);
    expect(traffic.archetype).toBeInstanceOf(Uint8Array);
    for (const array of [traffic.lane, traffic.speed, traffic.phase, traffic.altitude, traffic.band, traffic.archetype]) {
      expect(array).toHaveLength(2400);
    }
  });

  it('bands altitudes across the 200..1600 m stack', () => {
    const traffic = deriveTrafficParams(99, 2400);
    const bandsSeen = new Set<number>();

    for (let car = 0; car < traffic.count; car += 1) {
      const altitude = traffic.altitude[car]!;
      const band = traffic.band[car]!;
      expect(altitude).toBeGreaterThanOrEqual(TRAFFIC_MIN_ALTITUDE_M);
      expect(altitude).toBeLessThanOrEqual(TRAFFIC_MAX_ALTITUDE_M);
      expect(band).toBeLessThan(TRAFFIC_BAND_COUNT);
      expect(traffic.archetype[car]!).toBeLessThan(TRAFFIC_ARCHETYPE_COUNT);
      expect(Number.isFinite(traffic.speed[car]!)).toBe(true);
      expect(traffic.speed[car]!).not.toBe(0);
      expect(traffic.phase[car]!).toBeGreaterThanOrEqual(0);
      expect(traffic.phase[car]!).toBeLessThan(1);
      bandsSeen.add(band);
    }

    expect(bandsSeen.size).toBe(TRAFFIC_BAND_COUNT);
  });

  it('uses all three archetypes', () => {
    const traffic = deriveTrafficParams(99, 2400);

    expect(new Set(traffic.archetype).size).toBe(TRAFFIC_ARCHETYPE_COUNT);
  });

  it('rejects an out-of-contract car count loudly', () => {
    expect(() => deriveTrafficParams(99, 0)).toThrow(/SKYRIVER_TRAFFIC_COUNT_INVALID/u);
    expect(() => deriveTrafficParams(99, 1.5)).toThrow(/SKYRIVER_TRAFFIC_COUNT_INVALID/u);
    expect(() => deriveTrafficParams(99, TRAFFIC_MAX_CARS + 1)).toThrow(/SKYRIVER_TRAFFIC_COUNT_INVALID/u);
  });

  it('rejects a seed that is not a 32-bit integer', () => {
    expect(() => deriveTrafficParams(1.5, 10)).toThrow(/SKYRIVER_SEED_INVALID/u);
    expect(() => deriveCityLayout(-1)).toThrow(/SKYRIVER_SEED_INVALID/u);
  });
});
