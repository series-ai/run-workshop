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
