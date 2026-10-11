import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { InstancedBufferGeometry, InstancedMesh, Mesh, Vector3 } from 'three';
import { createSkyriverTraffic, TRAFFIC_QUALITY_TIERS } from '../src/render/traffic';
import type { SkyriverTraffic, TrafficQuality } from '../src/render/trafficTypes';
import { TRAFFIC_APPEARANCE_PROFILES } from '../src/render/trafficAppearance';
import { trafficHullVisibility } from '../src/render/lightHandover';
import { R44_LAMP_PROFILES } from './support/r44LampProfiles';

function smoothstep(a: number, b: number, value: number): number {
  const p = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return p * p * (3 - 2 * p);
}

function record(traffic: SkyriverTraffic, carId: number) {
  const streak = traffic.objects.find(object => object.name === 'skyriver.traffic.streaks');
  if (!(streak instanceof Mesh) || !(streak.geometry instanceof InstancedBufferGeometry)) throw Error('R44_STREAK_MISSING');
  const geometry = streak.geometry;
  const ids = geometry.getAttribute('aCarLod');
  const pos = geometry.getAttribute('aCarPos');
  const lamp = geometry.getAttribute('aCarFade');
  const shape = geometry.getAttribute('aCarShape');
  for (let row = 0; row < geometry.instanceCount; row += 1) {
    if (ids.getZ(row) !== carId) continue;
    const position = new Vector3(pos.getX(row), pos.getY(row), pos.getZ(row));
    const matches: { mesh: string; slot: number; scales: number[]; fade: number; color: number[] }[] = [];
    for (const object of traffic.objects) {
      if (!(object instanceof InstancedMesh)) continue;
      for (let slot = 0; slot < object.count; slot += 1) {
        const m = object.instanceMatrix.array;
        const offset = slot * 16;
        if (Math.hypot(m[offset + 12]! - position.x, m[offset + 13]! - position.y,
          m[offset + 14]! - position.z) >= 1e-4) continue;
        matches.push({ mesh: object.name, slot,
          scales: [0, 4, 8].map(column => Math.hypot(m[offset + column]!, m[offset + column + 1]!, m[offset + column + 2]!)),
          fade: object.geometry.getAttribute('aFade').getX(slot),
          color: object.instanceColor ? Array.from(object.instanceColor.array.slice(slot * 3, slot * 3 + 3)) : [],
        });
      }
    }
    if (matches.length !== 1) throw Error('R44_HULL_JOIN_COUNT:' + matches.length);
    const totalShare = ids.getX(row) + ids.getY(row);
    if (totalShare <= 0) throw Error('R44_LAMP_SHARE_ZERO');
    return { carId, row, position, baseScale: lamp.getY(row), lampFade: lamp.getX(row),
      lifecycle: lamp.getX(row) / totalShare, profile: shape.getX(row), hull: matches[0]! };
  }
  throw Error('R44_CAR_ID_MISSING:' + carId);
}

function createTraffic(quality: TrafficQuality = TRAFFIC_QUALITY_TIERS.high) {
  return createSkyriverTraffic({ seed: 424242, quality,
    maxCarCount: 2400, maxThrusterBudget: 2400, maxImpostors: 20000 });
}

function save(name: string, rows: readonly unknown[]): void {
  if (process.env.R44_LIFECYCLE_OUT) writeFileSync(`${process.env.R44_LIFECYCLE_OUT}-${name}.json`, JSON.stringify(rows, null, 2));
}

describe('R44 constant hull size and lifecycle coverage: real traffic buffers', () => {
  it('uses the direct lifecycle product in the production visibility function', () => {
    for (const distance of [200, 750, 900, 1080, 1190, 1300, 1500]) {
      for (const source of [0, 0.143, 0.5, 1]) {
        for (const tier of [0, 0.143, 0.5, 1]) {
          const expected = (1 - smoothstep(750, 1300, distance)) * source * tier;
          expect(trafficHullVisibility(distance, source * tier)).toBeCloseTo(expected, 12);
        }
      }
    }
  });

  it('preserves the six frozen physical lamp profiles', () => {
    expect(TRAFFIC_APPEARANCE_PROFILES.map(profile => ({ name: profile.name,
      front: profile.front, rear: profile.rear }))).toEqual(R44_LAMP_PROFILES);
  });

  it.each([0, 1, 2, 3, 4, 5])('keeps profile %s at its base size through distance fade', profile => {
    const traffic = createTraffic();
    try {
      traffic.update(10, { x: 0, y: 1500, z: 0 });
      const streak = traffic.objects.find(object => object.name === 'skyriver.traffic.streaks');
      if (!(streak instanceof Mesh) || !(streak.geometry instanceof InstancedBufferGeometry)) throw Error('R44_STREAK_MISSING');
      const ids = streak.geometry.getAttribute('aCarLod');
      const shapes = streak.geometry.getAttribute('aCarShape');
      const slot = Array.from({ length: streak.geometry.instanceCount }, (_, index) => index)
        .find(index => shapes.getX(index) === profile);
      if (slot === undefined) throw Error('R44_PROFILE_NOT_PRESENT');
      const carId = ids.getZ(slot);
      const initial = record(traffic, carId);
      for (const distance of [200, 900, 1190, 1500]) {
        traffic.update(10, initial.position.clone().add(new Vector3(0, 0, distance)));
        const actual = record(traffic, carId);
        expect(actual.profile).toBe(profile);
        expect(actual.baseScale).toBe(initial.baseScale);
        for (const scale of actual.hull.scales) expect(Math.abs(scale - actual.baseScale)).toBeLessThanOrEqual(1e-5);
        expect(actual.hull.fade).toBeCloseTo((1 - smoothstep(750, 1300, distance)) * actual.lifecycle, 5);
      }
    } finally { traffic.dispose(); }
  });

  it('keeps the same physical hull size at every distance', () => {
    const traffic = createTraffic();
    const rows: ReturnType<typeof record>[] = [];
    try {
      traffic.update(10, { x: 0, y: 1500, z: 0 });
      for (const distance of [200, 750, 900, 1080, 1190, 1299, 1300, 1500]) {
        const car = record(traffic, 100);
        traffic.update(10, car.position.clone().add(new Vector3(0, 0, distance)));
        rows.push(record(traffic, 100));
      }
      save('distance', rows);
      for (const [index, row] of rows.entries()) {
        const distance = [200, 750, 900, 1080, 1190, 1299, 1300, 1500][index]!;
        for (const scale of row.hull.scales) expect(Math.abs(scale - row.baseScale)).toBeLessThanOrEqual(1e-5);
        expect(row.hull.fade).toBeCloseTo((1 - smoothstep(750, 1300, distance)) * row.lifecycle, 5);
        expect(row.baseScale).toBe(rows[0]!.baseScale);
      }
    } finally { traffic.dispose(); }
  });

  it('uses direct escort wrap presence in coverage while physical size stays fixed', () => {
    const traffic = createTraffic();
    const rows: ReturnType<typeof record>[] = [];
    try {
      traffic.setAnchor(0, 1500, 0, 0, 150, 0, 0);
      for (const presence of [0, 0.143, 0.5, 1]) {
        let lo = 0;
        let hi = 140;
        for (let step = 0; step < 60; step += 1) {
          const mid = (lo + hi) / 2;
          if (smoothstep(0, 140, mid) < presence) lo = mid; else hi = mid;
        }
        const time = presence === 0 ? 0 : presence === 1 ? 140 / 330 : (lo + hi) / (2 * 330);
        traffic.update(time, { x: 0, y: 1500, z: 0 });
        const car = record(traffic, 3);
        traffic.update(time, car.position.clone().add(new Vector3(0, 0, 200)));
        rows.push(record(traffic, 3));
      }
      save('source-wrap', rows);
      for (const [index, row] of rows.entries()) {
        expect(row.lifecycle).toBeCloseTo([0, 0.143, 0.5, 1][index]!, 6);
        expect(row.hull.fade).toBeCloseTo(row.lifecycle, 6);
        for (const scale of row.hull.scales) expect(Math.abs(scale - row.baseScale)).toBeLessThanOrEqual(1e-5);
        expect(row.baseScale).toBe(rows[0]!.baseScale);
        for (const [channel, color] of row.hull.color.entries()) {
          expect(color).toBeCloseTo(rows.at(-1)!.hull.color[channel]!, 6);
        }
      }
    } finally { traffic.dispose(); }
  });

  it.each([1, 1.25, 1.5])('keeps car identity and physical size through a tier interruption at DPR %s', dpr => {
    const traffic = createTraffic(TRAFFIC_QUALITY_TIERS.low);
    const rows: ReturnType<typeof record>[] = [];
    try {
      const focal = 1 / Math.tan(62 * Math.PI / 360);
      traffic.setPixelAngle(2 / (focal * 720 * dpr), 2 / (focal * 720));
      const camera = { x: 0, y: 1500, z: 0 };
      traffic.update(0, camera);
      traffic.setQuality(TRAFFIC_QUALITY_TIERS.high);
      traffic.update(0, camera);
      for (const time of [0, 0.1716, 0.3, 0.6]) {
        traffic.update(time, camera);
        const car = record(traffic, 1000);
        traffic.update(time, car.position.clone().add(new Vector3(0, 0, 200)));
        rows.push(record(traffic, 1000));
      }
      const before = rows.at(-1)!;
      traffic.setQuality(TRAFFIC_QUALITY_TIERS.medium);
      traffic.update(0.6, before.position.clone().add(new Vector3(0, 0, 200)));
      const after = record(traffic, 1000);
      rows.push(after);
      expect(after.lifecycle).toBeCloseTo(before.lifecycle, 6);
      expect(after.position.distanceTo(before.position)).toBe(0);
      for (const time of [0.9, 1.8, 2]) {
        traffic.update(time, camera);
        const car = record(traffic, 1000);
        traffic.update(time, car.position.clone().add(new Vector3(0, 0, 200)));
        rows.push(record(traffic, 1000));
      }
      save('tier-dpr-' + dpr, rows);
      expect(rows[0]!.lifecycle).toBe(0);
      expect(rows[1]!.lifecycle).toBeCloseTo(0.143, 6);
      expect(rows.at(-1)!.lifecycle).toBe(1);
      expect(new Set(rows.map(row => row.row)).size).toBeGreaterThan(1);
      for (const row of rows) {
        expect(row.carId).toBe(1000);
        expect(row.profile).toBe(rows[0]!.profile);
        expect(row.baseScale).toBe(rows[0]!.baseScale);
        expect(row.hull.fade).toBeCloseTo(row.lifecycle, 6);
        for (const scale of row.hull.scales) expect(Math.abs(scale - row.baseScale)).toBeLessThanOrEqual(1e-5);
        for (const [channel, color] of row.hull.color.entries()) {
          expect(color).toBeCloseTo(rows.at(-1)!.hull.color[channel]!, 6);
        }
      }
      expect(traffic.stats().drawCalls).toBeLessThanOrEqual(32);
    } finally { traffic.dispose(); }
  });

  it('multiplies real source wrap and real tier presence once', () => {
    const traffic = createTraffic();
    try {
      traffic.setAnchor(0, 1500, 0, 0, 150, 0, 0);
      let lo = 0;
      let hi = 140;
      for (let step = 0; step < 60; step += 1) {
        const mid = (lo + hi) / 2;
        if (smoothstep(0, 140, mid) < 0.143) lo = mid; else hi = mid;
      }
      const time = 1040 / 330 + (lo + hi) / (2 * 330);
      const start = time - 0.6;
      const camera = { x: 0, y: 1500, z: 0 };
      traffic.update(start, camera);
      traffic.setQuality({ ...TRAFFIC_QUALITY_TIERS.low, carCount: 2, thrusterBudget: 2 });
      traffic.update(start, camera);
      traffic.update(time, camera);
      const before = record(traffic, 3);
      traffic.update(time, before.position.clone().add(new Vector3(0, 0, 200)));
      const actual = record(traffic, 3);
      save('source-tier-product', [actual]);
      expect(actual.lifecycle).toBeCloseTo(0.143 * 0.5, 6);
      expect(actual.hull.fade).toBeCloseTo(actual.lifecycle, 6);
      for (const scale of actual.hull.scales) expect(Math.abs(scale - actual.baseScale)).toBeLessThanOrEqual(1e-5);
    } finally { traffic.dispose(); }
  });
});
