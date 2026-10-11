import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { InstancedBufferGeometry, Mesh, Vector3 } from 'three';
import { createSkyriverTraffic, TRAFFIC_QUALITY_TIERS } from '../src/render/traffic';
import type { SkyriverTraffic, TrafficQuality } from '../src/render/trafficTypes';

function carRecord(traffic: SkyriverTraffic, id: number) {
  const mesh = traffic.objects.find(object => object.name === 'skyriver.traffic.streaks');
  if (!(mesh instanceof Mesh) || !(mesh.geometry instanceof InstancedBufferGeometry)) throw new Error('R33_REAL_STREAK_BATCH_MISSING');
  const g = mesh.geometry, lod = g.getAttribute('aCarLod'), pos = g.getAttribute('aCarPos'), fade = g.getAttribute('aCarFade');
  for (let row = 0; row < g.instanceCount; row += 1) {
    if (lod.getZ(row) === id) return { id, row, position: new Vector3(pos.getX(row), pos.getY(row), pos.getZ(row)), fade: fade.getX(row), sizeScale: fade.getY(row), trail: fade.getW(row), near: lod.getX(row), proxy: lod.getY(row) };
  }
  throw new Error('R33_ACTUAL_CAR_ROW_MISSING:' + id);
}
function createTraffic(quality: TrafficQuality = TRAFFIC_QUALITY_TIERS.high) {
  return createSkyriverTraffic({ seed: 424242, quality, maxCarCount: 2400, maxThrusterBudget: 2400, maxImpostors: 20000 });
}
function save(name: string, data: unknown): void {
  if (process.env.SKYRIVER_CONTINUITY_OUT) writeFileSync(`${process.env.SKYRIVER_CONTINUITY_OUT}-${name}.json`, JSON.stringify(data, null, 2));
}

describe('flyer continuity: actual interrupted tier transitions', () => {
  it('preserves the current CPU car share when high-to-low retargets to medium at half fade', () => {
    const traffic = createTraffic();
    try {
      traffic.update(0, { x: 0, y: 1500, z: 0 }); traffic.setQuality(TRAFFIC_QUALITY_TIERS.low); traffic.update(0, { x: 0, y: 1500, z: 0 });
      traffic.update(0.6, { x: 0, y: 1500, z: 0 });
      const camera = carRecord(traffic, 1000).position.clone().add(new Vector3(0, 0, 200));
      traffic.update(0.6, camera); const before = carRecord(traffic, 1000);
      traffic.setQuality(TRAFFIC_QUALITY_TIERS.medium); traffic.update(0.6, camera); const after = carRecord(traffic, 1000);
      save('cpu-retarget', { timeS: 0.6, before, after });
      expect(before.fade).toBeCloseTo(0.5, 6); expect(after.position.distanceTo(before.position)).toBe(0);
      expect(after.fade).toBeCloseTo(before.fade, 6);
    } finally { traffic.dispose(); }
  });

  it('preserves the current CPU share when low-to-high retargets to medium at half fade', () => {
    const traffic = createTraffic(TRAFFIC_QUALITY_TIERS.low);
    try {
      traffic.update(0, { x: 0, y: 1500, z: 0 }); traffic.setQuality(TRAFFIC_QUALITY_TIERS.high); traffic.update(0, { x: 0, y: 1500, z: 0 });
      traffic.update(0.6, { x: 0, y: 1500, z: 0 });
      const camera = carRecord(traffic, 1000).position.clone().add(new Vector3(0, 0, 200));
      traffic.update(0.6, camera); const before = carRecord(traffic, 1000);
      traffic.setQuality(TRAFFIC_QUALITY_TIERS.medium); traffic.update(0.6, camera); const after = carRecord(traffic, 1000);
      save('cpu-growth-retarget', { timeS: 0.6, before, after });
      expect(before.fade).toBeCloseTo(0.5, 6); expect(after.fade).toBeCloseTo(before.fade, 6);
    } finally { traffic.dispose(); }
  });

  it.each(['low', 'medium'] as const)('retains the still-fading CPU population when the request is %s', tier => {
    const traffic = createTraffic(), camera = { x: 0, y: 1500, z: 0 };
    try {
      traffic.update(0, camera); traffic.setQuality(TRAFFIC_QUALITY_TIERS.low); traffic.update(0, camera); traffic.update(0.6, camera);
      const before = traffic.stats().activeCars;
      traffic.setQuality(TRAFFIC_QUALITY_TIERS[tier]); traffic.update(0.6, camera);
      save('population-retarget-' + tier, { before, after: traffic.stats().activeCars });
      expect(traffic.stats().activeCars).toBe(before);
    } finally { traffic.dispose(); }
  });

  it('keeps the requested high count after a high-to-low-to-high interruption', () => {
    const traffic = createTraffic(), camera = { x: 0, y: 1500, z: 0 };
    try {
      traffic.update(0, camera); traffic.setQuality(TRAFFIC_QUALITY_TIERS.low); traffic.update(0, camera); traffic.update(0.6, camera);
      traffic.setQuality(TRAFFIC_QUALITY_TIERS.high); traffic.update(0.6, camera); traffic.update(2, camera);
      save('count-retarget', traffic.stats());
      expect(traffic.stats().activeCars).toBe(TRAFFIC_QUALITY_TIERS.high.carCount);
    } finally { traffic.dispose(); }
  });

  it('preserves the current trail weight when all-to-near retargets to all at half fade', () => {
    const traffic = createTraffic();
    try {
      traffic.update(0, { x: 0, y: 1500, z: 0 }); traffic.setQuality(TRAFFIC_QUALITY_TIERS.low); traffic.update(0, { x: 0, y: 1500, z: 0 });
      traffic.update(0.6, { x: 0, y: 1500, z: 0 });
      const camera = carRecord(traffic, 100).position.clone().add(new Vector3(0, 0, 900));
      traffic.update(0.6, camera); const before = carRecord(traffic, 100);
      traffic.setQuality(TRAFFIC_QUALITY_TIERS.high); traffic.update(0.6, camera); const after = carRecord(traffic, 100);
      save('trail-retarget', { timeS: 0.6, before, after });
      expect(before.trail).toBeCloseTo(0.5, 6); expect(after.position.distanceTo(before.position)).toBe(0);
      expect(after.trail).toBeCloseTo(before.trail, 6);
    } finally { traffic.dispose(); }
  });
});

import { InstancedMesh } from 'three';
import { closureSamples } from './support/flyerContinuityTemporal';
import { evaluateSameCarTrafficAppearance } from '../src/render/trafficAppearanceModel';
import { continuityInput, shippedHullResponse } from './support/flyerContinuityMatrix';

describe('R33 actual rear approach at timed closure speed', () => {
  it('keeps distance fade separate from actual tier lifecycle scale', () => {
    const traffic = createTraffic();
    const rows: unknown[] = [];
    try {
      traffic.update(10, { x: 0, y: 1500, z: 0 });
      traffic.setQuality(TRAFFIC_QUALITY_TIERS.low);
      traffic.update(10, { x: 0, y: 1500, z: 0 });
      for (const elapsed of [0, 0.12, 0.36, 0.54, 1.08]) {
        traffic.update(10 + elapsed, { x: 0, y: 1500, z: 0 });
        const car = carRecord(traffic, 1000);
        const camera = car.position.clone().add(new Vector3(0, 0, 200));
        traffic.update(10 + elapsed, camera);
        const current = carRecord(traffic, 1000);
        let actual: { scale: number; fade: number } | null = null;
        for (const object of traffic.objects) {
          if (!(object instanceof InstancedMesh)) continue;
          for (let slot = 0; slot < object.count; slot += 1) {
            const matrix = object.instanceMatrix.array, offset = slot * 16;
            if (Math.hypot(matrix[offset + 12]! - current.position.x,
              matrix[offset + 13]! - current.position.y, matrix[offset + 14]! - current.position.z) >= 1e-4) continue;
            if (actual) throw new Error('R33_AMBIGUOUS_REAL_HULL');
            actual = { scale: Math.hypot(matrix[offset]!, matrix[offset + 1]!, matrix[offset + 2]!),
              fade: object.geometry.getAttribute('aFade').getX(slot) };
          }
        }
        if (!actual) throw new Error('R33_REAL_TIER_HULL_MISSING');
        // At 200 m the total lamp share is one. Its fade is the source and tier product.
        const expected = shippedHullResponse(200, current.fade);
        expect(actual.fade).toBe(1);
        expect(actual.scale).toBeCloseTo(current.sizeScale * expected.scale, 5);
        rows.push({ elapsed, carId: current.id, sourceTierFade: current.fade,
          baseScale: current.sizeScale, actual, expected });
      }
      save('shipped-lifecycle', { rows, gpuReadback: false });
    } finally { traffic.dispose(); }
  });

  it.each([125, 250, 500])('keeps the shipped scale and aFade response at %i m/s', closingVelocity => {
    const traffic = createTraffic();
    try {
      const samples = closureSamples(closingVelocity);
      expect(samples.at(-1)!.timeS).toBeCloseTo(700 / closingVelocity, 12);
      traffic.update(10, { x: 0, y: 1500, z: 0 });
      const target = carRecord(traffic, 100);
      const mesh = traffic.objects.find(o => o instanceof InstancedMesh && Array.from({ length: o.count }, (_, i) => {
        const a = o.instanceMatrix.array, j = i * 16;
        return Math.hypot(a[j + 12]! - target.position.x, a[j + 13]! - target.position.y, a[j + 14]! - target.position.z) < 0.01;
      }).some(Boolean));
      if (!(mesh instanceof InstancedMesh)) throw Error('R33_HULL_MISSING');
      const slot = Array.from({ length: mesh.count }, (_, i) => i).find(i => {
        const a = mesh.instanceMatrix.array, j = i * 16;
        return Math.hypot(a[j + 12]! - target.position.x, a[j + 13]! - target.position.y, a[j + 14]! - target.position.z) < 0.01;
      })!;
      let previousFade = 0, maxFrameFadeStep = 0;
      const rows: unknown[] = [];
      for (const sample of samples) {
        // Advance the real traffic. Then place the camera behind this same car.
        traffic.update(10 + sample.timeS, target.position);
        const current = carRecord(traffic, 100);
        const streak = traffic.objects.find(o => o.name === 'skyriver.traffic.streaks') as Mesh;
        const direction = streak.geometry.getAttribute('aCarDir');
        const forward = new Vector3(direction.getX(current.row), direction.getY(current.row), direction.getZ(current.row)).normalize();
        const camera = current.position.clone().addScaledVector(forward, -sample.distanceM);
        traffic.update(10 + sample.timeS, camera);
        const matrix = mesh.instanceMatrix.array, j = slot * 16;
        const scale = Math.hypot(matrix[j]!, matrix[j + 1]!, matrix[j + 2]!);
        const uploadedFade = mesh.geometry.getAttribute('aFade');
        expect(uploadedFade.itemSize).toBe(1);
        expect(uploadedFade.array).toBeInstanceOf(Float32Array);
        const alpha = uploadedFade.getX(slot);
        const expected = shippedHullResponse(sample.distanceM);
        expect(scale).toBeCloseTo(current.sizeScale * expected.scale, 5);
        expect(scale / current.sizeScale).toBeGreaterThanOrEqual(0.85 - 1e-6);
        expect(scale / current.sizeScale).toBeLessThanOrEqual(1 + 1e-6);
        expect(alpha).toBeGreaterThanOrEqual(previousFade - 1e-6);
        maxFrameFadeStep = Math.max(maxFrameFadeStep, alpha - previousFade);
        previousFade = alpha;
        expect(alpha).toBeCloseTo(expected.fade, 5);
        const model = evaluateSameCarTrafficAppearance({ ...continuityInput(0, 1, 180, 'high', sample.distanceM), sizeScale: current.sizeScale });
        expect(model.hull.scale).toBeCloseTo(scale, 5);
        expect(model.hull.fade).toBeCloseTo(alpha, 5);
        expect(model.uploaded.aFade).toBeCloseTo(alpha, 5);
        rows.push({ ...sample, carId: current.id, scale, baseScale: current.sizeScale, aFade: alpha, expected });
      }
      expect(previousFade).toBe(1);
      // Keep the existing 220 m band step limit. The shipped band is wider.
      expect(maxFrameFadeStep).toBeLessThanOrEqual(1.5 * closingVelocity / (60 * 220) + 1e-6);
      save('shipped-closure-' + closingVelocity, { rows, maxFrameFadeStep, unchangedStepLimit: 1.5 * closingVelocity / (60 * 220) + 1e-6, gpuReadback: false });
      expect(traffic.stats().drawCalls).toBeLessThanOrEqual(32);
      expect(mesh.material).toMatchObject({ transparent: false, depthWrite: true, depthTest: true });
    } finally { traffic.dispose(); }
  });
});
