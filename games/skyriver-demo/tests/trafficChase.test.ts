import { InstancedBufferAttribute, InstancedBufferGeometry, InstancedMesh, Mesh, ShaderMaterial } from 'three';
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

  it('keeps active transforms and attributes finite before and after the anchor is set', () => {
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
          for (const name of ['aCarPos', 'aCarDir', 'aCarFade', 'aCarLod']) {
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

  it('maintains the same logical car ID and continuous pose through the crossover band', () => {
    const traffic = createSkyriverTraffic({
      seed: 424242,
      quality: TRAFFIC_QUALITY_TIERS.high,
    });
    const streakMesh = traffic.objects.find((o) => o.name === 'skyriver.traffic.streaks') as Mesh;
    expect(streakMesh).toBeDefined();
    const posAttr = streakMesh.geometry.getAttribute('aCarPos');
    const dirAttr = streakMesh.geometry.getAttribute('aCarDir');
    const fadeAttr = streakMesh.geometry.getAttribute('aCarFade');
    const lodAttr = streakMesh.geometry.getAttribute('aCarLod');
    expect(posAttr).toBeDefined();
    expect(dirAttr).toBeDefined();
    expect(fadeAttr).toBeDefined();
    expect(lodAttr).toBeDefined();

    try {
      // Warm up and settle full presence at time t = 24.
      const baseCam = { x: 0, y: 1500, z: 0 };
      traffic.update(0, baseCam);
      traffic.update(12, baseCam);
      traffic.update(24, baseCam);

      // Select a car in the streak batch that has a valid positive direction.
      const targetSlot = 50;
      const initialPos = [posAttr.array[targetSlot * 3]!, posAttr.array[targetSlot * 3 + 1]!, posAttr.array[targetSlot * 3 + 2]!];
      const logicalId = lodAttr.array[targetSlot * 3 + 2]!;
      expect(Number.isInteger(logicalId)).toBe(true);
      expect(logicalId).toBeGreaterThanOrEqual(0);

      // Place camera along the Z axis relative to this car at distances across the handover band.
      const distances = [900, 1080, 1190, 1245, 1300, 1400, 2000];
      for (const d of distances) {
        const testCam = { x: initialPos[0]!, y: initialPos[1]!, z: initialPos[2]! + d };
        traffic.update(24, testCam);

        // Verify the logical car ID is preserved in the exact same slot.
        const idAtD = lodAttr.array[targetSlot * 3 + 2]!;
        expect(idAtD).toBe(logicalId);

        // Verify position and direction remain identical at fixed time t = 24.
        expect(posAttr.array[targetSlot * 3]!).toBeCloseTo(initialPos[0]!, 6);
        expect(posAttr.array[targetSlot * 3 + 1]!).toBeCloseTo(initialPos[1]!, 6);
        expect(posAttr.array[targetSlot * 3 + 2]!).toBeCloseTo(initialPos[2]!, 6);

        const nearShare = lodAttr.array[targetSlot * 3]!;
        const farShare = lodAttr.array[targetSlot * 3 + 1]!;
        const fade = fadeAttr.array[targetSlot * 4]!;
        const trailWeight = fadeAttr.array[targetSlot * 4 + 3]!;

        // Total light share is conserved at 1.0 through the band.
        expect(nearShare + farShare).toBeCloseTo(1.0, 5);
        expect(nearShare).toBeGreaterThanOrEqual(0);
        expect(farShare).toBeGreaterThanOrEqual(0);

        // Streak lamp fade uses the total share.
        expect(fade).toBeCloseTo(1.0, 5);

        if (d >= 1300) {
          // Zero near share and zero trails beyond 1300 m at full presence.
          expect(nearShare).toBeCloseTo(0, 5);
          expect(farShare).toBeCloseTo(1.0, 5);
          expect(trailWeight).toBeCloseTo(0, 5);
          if (d > 1300) {
            expect(nearShare).toBe(0);
            expect(trailWeight).toBe(0);
          }
        } else if (d === 1080) {
          expect(nearShare).toBeCloseTo(1.0, 5);
          expect(farShare).toBe(0);
        } else if (d === 1190) {
          expect(nearShare).toBeCloseTo(0.5, 4);
          expect(farShare).toBeCloseTo(0.5, 4);
        }
      }
    } finally {
      traffic.dispose();
    }
  });

  it('guarantees deterministic state restoration and reverse-time evaluation', () => {
    const traffic = createSkyriverTraffic({
      seed: 424242,
      quality: TRAFFIC_QUALITY_TIERS.high,
    });
    const streakMesh = traffic.objects.find((o) => o.name === 'skyriver.traffic.streaks') as Mesh;
    const streakGeom = streakMesh.geometry as InstancedBufferGeometry;
    const pos = streakGeom.getAttribute('aCarPos');
    const dir = streakGeom.getAttribute('aCarDir');
    const fade = streakGeom.getAttribute('aCarFade');
    const lod = streakGeom.getAttribute('aCarLod');
    const cam = { x: 0, y: 1500, z: 0 };

    try {
      traffic.update(0, cam);
      traffic.update(10, cam);
      traffic.update(25, cam);

      // Snapshot all buffers at t = 25.
      const snapPos = new Float32Array(pos.array.slice(0, streakGeom.instanceCount * 3));
      const snapDir = new Float32Array(dir.array.slice(0, streakGeom.instanceCount * 4));
      const snapFade = new Float32Array(fade.array.slice(0, streakGeom.instanceCount * 4));
      const snapLod = new Float32Array(lod.array.slice(0, streakGeom.instanceCount * 3));
      const snapCount = streakGeom.instanceCount;

      // Advance into the future.
      traffic.update(40, cam);
      traffic.update(60, cam);

      // Restore back to t = 25.
      traffic.update(25, cam);
      expect(streakGeom.instanceCount).toBe(snapCount);
      expect(Array.from(pos.array.slice(0, snapCount * 3))).toEqual(Array.from(snapPos));
      expect(Array.from(dir.array.slice(0, snapCount * 4))).toEqual(Array.from(snapDir));
      expect(Array.from(fade.array.slice(0, snapCount * 4))).toEqual(Array.from(snapFade));
      expect(Array.from(lod.array.slice(0, snapCount * 3))).toEqual(Array.from(snapLod));

      // Reverse time: evaluate negative time and verify all values remain finite and deterministic.
      traffic.update(-15, cam);
      const negLod = lod.array.slice(0, streakGeom.instanceCount * 3);
      expect(Array.from(negLod).every(Number.isFinite)).toBe(true);

      traffic.update(-30, cam);
      traffic.update(-15, cam);
      expect(Array.from(lod.array.slice(0, streakGeom.instanceCount * 3))).toEqual(Array.from(negLod));
    } finally {
      traffic.dispose();
    }
  });

  it('wires actual aFromAlpha attribute, uniforms and vertex shader on live traffic impostor mesh', () => {
    const traffic = createSkyriverTraffic({
      seed: 424242,
      quality: TRAFFIC_QUALITY_TIERS.high,
    });
    try {
      const impostorMesh = traffic.objects.find((o) => o.name === 'skyriver.traffic.impostors') as Mesh;
      expect(impostorMesh).toBeDefined();

      const geom = impostorMesh.geometry as InstancedBufferGeometry;
      const attr = geom.getAttribute('aFromAlpha') as InstancedBufferAttribute;
      expect(attr).toBeDefined();
      expect(attr.itemSize).toBe(1);
      expect(attr.array.length).toBeGreaterThanOrEqual(TRAFFIC_QUALITY_TIERS.high.impostors);

      const mat = impostorMesh.material as ShaderMaterial;
      expect(mat.uniforms.uFadeK).toBeDefined();
      expect(mat.uniforms.uTargetCount).toBeDefined();

      const vs = mat.vertexShader;
      expect(vs).toContain('attribute float aFromAlpha;');
      expect(vs).toContain('uniform float uFadeK;');
      expect(vs).toContain('uniform float uTargetCount;');
      expect(vs).toContain('float toAlpha = float( gl_InstanceID ) < uTargetCount ? 1.0 : 0.0;');
      expect(vs).toContain('float tierPresence = mix( aFromAlpha, toAlpha, uFadeK );');
    } finally {
      traffic.dispose();
    }
  });

  it('preserves continuity across interrupted Low -> High -> Low on live traffic scene', () => {
    const traffic = createSkyriverTraffic({
      seed: 424242,
      maxCarCount: TRAFFIC_QUALITY_TIERS.high.carCount,
      maxThrusterBudget: TRAFFIC_QUALITY_TIERS.high.thrusterBudget,
      maxImpostors: TRAFFIC_QUALITY_TIERS.high.impostors,
      quality: TRAFFIC_QUALITY_TIERS.low,
    });
    const cam = { x: 0, y: 1500, z: 0 };
    const impostorMesh = traffic.objects.find((o) => o.name === 'skyriver.traffic.impostors') as Mesh;
    const streakMesh = traffic.objects.find((o) => o.name === 'skyriver.traffic.streaks') as Mesh;
    const impostorGeom = impostorMesh.geometry as InstancedBufferGeometry;
    const streakGeom = streakMesh.geometry as InstancedBufferGeometry;
    const lodAttr = streakGeom.getAttribute('aCarLod') as InstancedBufferAttribute;
    const fromAlphaAttr = impostorGeom.getAttribute('aFromAlpha') as InstancedBufferAttribute;
    const mat = impostorMesh.material as ShaderMaterial;

    try {
      // Settle at Low (0 impostors)
      traffic.update(0, cam);
      expect(impostorMesh.visible).toBe(false);
      expect(impostorGeom.instanceCount).toBe(0);

      // Begin transition to High (20000) at t = 0
      traffic.setQuality(TRAFFIC_QUALITY_TIERS.high);
      traffic.update(0, cam); // starts transition at t = 0
      traffic.update(0.3, cam); // 0.3s of 1.2s -> k = 0.25
      expect(impostorMesh.visible).toBe(true);
      expect(impostorGeom.instanceCount).toBe(TRAFFIC_QUALITY_TIERS.high.impostors);
      expect(mat.uniforms.uFadeK!.value).toBeCloseTo(0.25, 6);
      expect(mat.uniforms.uTargetCount!.value).toBe(TRAFFIC_QUALITY_TIERS.high.impostors);

      // Snapshot streak LOD at t = 0.3 right before retarget
      const snapLodBefore = new Float32Array(lodAttr.array.slice(0, streakGeom.instanceCount * 3));

      // Interrupt at t = 0.3 with Low tier retarget
      traffic.setQuality(TRAFFIC_QUALITY_TIERS.low);
      traffic.update(0.3, cam); // frame immediately after retarget

      // Shader uniforms: uFadeK is reset to 0, target count to 0
      expect(mat.uniforms.uFadeK!.value).toBe(0);
      expect(mat.uniforms.uTargetCount!.value).toBe(0);

      // aFromAlpha buffer was captured with the interrupted 0.25 value
      expect(fromAlphaAttr.array[0]).toBeCloseTo(0.25, 6);
      expect(fromAlphaAttr.array[1000]).toBeCloseTo(0.25, 6);
      expect(fromAlphaAttr.array[19999]).toBeCloseTo(0.25, 6);

      // In shader: mix(aFromAlpha, 0, 0) = 0.25, zero jump in effective presence!
      // Streak LOD values before and after retarget at t = 0.3 are strictly equal
      const snapLodAfter = new Float32Array(lodAttr.array.slice(0, streakGeom.instanceCount * 3));
      for (let i = 0; i < snapLodBefore.length; i += 1) {
        expect(snapLodAfter[i]).toBeCloseTo(snapLodBefore[i]!, 6);
      }

      // Advance through returning fade to Low
      traffic.update(0.6, cam);
      expect(mat.uniforms.uFadeK!.value).toBeCloseTo(0.25, 6);
      expect(fromAlphaAttr.array[0]).toBeCloseTo(0.25, 6);

      // Settle at Low at t = 1.5
      traffic.update(1.5, cam);
      expect(impostorGeom.instanceCount).toBe(0);
      expect(impostorMesh.visible).toBe(false);
    } finally {
      traffic.dispose();
    }
  });

  it('preserves continuity across interrupted Low -> High -> Medium on live traffic scene', () => {
    const traffic = createSkyriverTraffic({
      seed: 424242,
      maxCarCount: TRAFFIC_QUALITY_TIERS.high.carCount,
      maxThrusterBudget: TRAFFIC_QUALITY_TIERS.high.thrusterBudget,
      maxImpostors: TRAFFIC_QUALITY_TIERS.high.impostors,
      quality: TRAFFIC_QUALITY_TIERS.low,
    });
    const cam = { x: 0, y: 1500, z: 0 };
    const impostorMesh = traffic.objects.find((o) => o.name === 'skyriver.traffic.impostors') as Mesh;
    const impostorGeom = impostorMesh.geometry as InstancedBufferGeometry;
    const fromAlphaAttr = impostorGeom.getAttribute('aFromAlpha') as InstancedBufferAttribute;
    const mat = impostorMesh.material as ShaderMaterial;

    try {
      traffic.update(0, cam);
      traffic.setQuality(TRAFFIC_QUALITY_TIERS.high);
      traffic.update(0, cam);
      traffic.update(0.3, cam); // k = 0.25

      // Interrupt to Medium at t = 0.3
      traffic.setQuality(TRAFFIC_QUALITY_TIERS.medium);
      traffic.update(0.3, cam);

      expect(mat.uniforms.uFadeK!.value).toBe(0);
      expect(mat.uniforms.uTargetCount!.value).toBe(TRAFFIC_QUALITY_TIERS.medium.impostors);
      expect(impostorGeom.instanceCount).toBe(TRAFFIC_QUALITY_TIERS.high.impostors); // retains fading
      expect(fromAlphaAttr.array[0]).toBeCloseTo(0.25, 6);
      expect(fromAlphaAttr.array[15000]).toBeCloseTo(0.25, 6);

      // Advance to settled Medium
      traffic.update(1.5, cam);
      expect(mat.uniforms.uFadeK!.value).toBe(1);
      expect(mat.uniforms.uTargetCount!.value).toBe(TRAFFIC_QUALITY_TIERS.medium.impostors);
      expect(impostorGeom.instanceCount).toBe(TRAFFIC_QUALITY_TIERS.medium.impostors);
    } finally {
      traffic.dispose();
    }
  });

  it('preserves stable-tier reverse-time buffer behavior and settled Low endpoints on live traffic', () => {
    const traffic = createSkyriverTraffic({
      seed: 424242,
      maxCarCount: TRAFFIC_QUALITY_TIERS.high.carCount,
      maxThrusterBudget: TRAFFIC_QUALITY_TIERS.high.thrusterBudget,
      maxImpostors: TRAFFIC_QUALITY_TIERS.high.impostors,
      quality: TRAFFIC_QUALITY_TIERS.low,
    });
    const cam = { x: 0, y: 1500, z: 0 };
    const impostorMesh = traffic.objects.find((o) => o.name === 'skyriver.traffic.impostors') as Mesh;
    const impostorGeom = impostorMesh.geometry as InstancedBufferGeometry;
    const mat = impostorMesh.material as ShaderMaterial;

    try {
      // Settled Low: reverse time produces 0 impostors, finite attributes
      for (const time of [0, -10, -50, 20]) {
        traffic.update(time, cam);
        expect(impostorGeom.instanceCount).toBe(0);
        expect(impostorMesh.visible).toBe(false);
      }

      // Settled High: reverse time in stable tier does not disrupt count or uniforms
      traffic.setQuality(TRAFFIC_QUALITY_TIERS.high);
      traffic.update(0, cam);
      traffic.update(1.2, cam); // settled
      expect(impostorGeom.instanceCount).toBe(TRAFFIC_QUALITY_TIERS.high.impostors);
      expect(mat.uniforms.uFadeK!.value).toBe(1);

      for (const time of [1.2, 0.5, 0, -20]) {
        traffic.update(time, cam);
        expect(impostorGeom.instanceCount).toBe(TRAFFIC_QUALITY_TIERS.high.impostors);
        expect(mat.uniforms.uFadeK!.value).toBe(1);
      }
    } finally {
      traffic.dispose();
    }
  });
});
