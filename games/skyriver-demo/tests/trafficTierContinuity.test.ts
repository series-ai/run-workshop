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
    if (lod.getZ(row) === id) return { id, row, position: new Vector3(pos.getX(row), pos.getY(row), pos.getZ(row)), fade: fade.getX(row), trail: fade.getW(row), near: lod.getX(row), proxy: lod.getY(row) };
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
import { continuityInput } from './support/flyerContinuityMatrix';

describe('R37 actual rear approach at timed closure speed', () => {
  it.each([125, 250, 500])('keeps physical hull scale at %i m/s and fades opaque coverage', closingVelocity => {
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
      if (!(mesh instanceof InstancedMesh)) throw Error('R37_HULL_MISSING');
      const slot = Array.from({ length: mesh.count }, (_, i) => i).find(i => {
        const a = mesh.instanceMatrix.array, j = i * 16;
        return Math.hypot(a[j + 12]! - target.position.x, a[j + 13]! - target.position.y, a[j + 14]! - target.position.z) < 0.01;
      })!;
      let physicalScale = 0, previousCoverage = 0, maxFrameCoverageStep = 0;
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
        const alpha = mesh.geometry.getAttribute('aHullCoverage').getX(slot);
        if (sample.frame === 0) physicalScale = scale;
        expect(scale).toBeCloseTo(physicalScale, 5);
        expect(alpha).toBeGreaterThanOrEqual(previousCoverage - 1e-6);
        maxFrameCoverageStep = Math.max(maxFrameCoverageStep, alpha - previousCoverage);
        previousCoverage = alpha;
        const expected = sample.distanceM >= 1300 ? 0 : sample.distanceM <= 1080 ? 1
          : (() => { const x = (sample.distanceM - 1080) / 220; return 1 - (3 * x * x - 2 * x * x * x); })();
        expect(alpha).toBeCloseTo(expected, 5);
        const model = evaluateSameCarTrafficAppearance({ ...continuityInput(0, 1, 180, 'high', sample.distanceM), sizeScale: physicalScale });
        expect(model.hull.scale).toBeCloseTo(scale, 5);
        expect(model.hull.coverage).toBeCloseTo(alpha, 5);
      }
      expect(previousCoverage).toBe(1);
      expect(maxFrameCoverageStep).toBeLessThanOrEqual(1.5 * closingVelocity / (60 * 220) + 1e-6);
      expect(traffic.stats().drawCalls).toBeLessThanOrEqual(32);
      expect(mesh.material).toMatchObject({ transparent: false, depthWrite: true, depthTest: true });
    } finally { traffic.dispose(); }
  });
});
