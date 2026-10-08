import { InstancedMesh, Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { createSkyriverTraffic, TRAFFIC_QUALITY_TIERS } from '../src/render/traffic';
import { HOP_COHORT_BOUNDS, newFlowSample, renderTrafficModel, sampleStreamFlow } from '../src/render/trafficStreams';

describe('R15 chase traffic in the R21 model', () => {
  it('keeps hop cohorts equal to the actual tier sizes', () => {
    expect(HOP_COHORT_BOUNDS).toEqual([TRAFFIC_QUALITY_TIERS.low.carCount, TRAFFIC_QUALITY_TIERS.medium.carCount]);
  });
  it('keeps chase cars on their assigned stream', () => {
    const model = renderTrafficModel(424242);
    const flow = newFlowSample();
    for (let path = 0; path < 8; path += 1) {
      for (let index = 4; index < 114; index += 1) {
        sampleStreamFlow(model, {
          path, index, salt: model.carSalt, pulse: index % 4, row: 0.5,
          phase: 0.3, appearanceSeed: 0.7, hopShare: 0, allowForks: false,
        }, flow);
        expect(flow.forkBits).toBe(0);
        expect(flow.hop).toBe(false);
        expect(flow.bakedRowA).toBe(flow.bakedRowB);
      }
    }
  });

  it('keeps active transforms finite before and after the anchor is set', () => {
    const traffic = createSkyriverTraffic({
      seed: 424242,
      quality: { carCount: 600, thrusterBudget: 600, trails: 'all', impostors: 0 },
    });
    const camera = { x: 0, y: 1100, z: 0 };
    const check = (): void => {
      for (const object of traffic.objects) {
        if (object instanceof InstancedMesh) {
          const active = object.instanceMatrix.array.slice(0, object.count * 16);
          expect(Array.from(active).every(Number.isFinite)).toBe(true);
        }
        if (object instanceof Mesh) {
          for (const name of ['aCarPos', 'aCarDir']) {
            const attribute = object.geometry.getAttribute(name);
            if (attribute) expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
          }
        }
      }
    };
    try {
      for (const time of [0, 0.5, 12, 90]) { traffic.update(time, camera); check(); }
      traffic.setAnchor(0, 1100, 0, 0, 160, 0, 0);
      for (const time of [90, 90.5, 0]) { traffic.update(time, camera); check(); }
    } finally {
      traffic.dispose();
    }
  });
});
