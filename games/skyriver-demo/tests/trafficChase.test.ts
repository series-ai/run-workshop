import { InstancedBufferAttribute, InstancedBufferGeometry, InstancedMesh, Matrix4, Mesh, PerspectiveCamera, ShaderMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { carTrafficPlan, createSkyriverTraffic, TRAFFIC_QUALITY_TIERS } from '../src/render/traffic';
import { HOP_COHORT_BOUNDS, newFlowSample, renderTrafficModel, sampleStreamFlow, STREAMS, streamCentreAnalytic } from '../src/render/trafficStreams';

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

  it.each([0, 424242, 2147483647, 4294967295].flatMap(seed =>
    [560, 2240].map(height => ({ seed, height }))))
    ('binds the initial nearest stream pair for seed $seed at height $height', ({ seed, height }) => {
      const traffic = createSkyriverTraffic({ seed, quality: TRAFFIC_QUALITY_TIERS.high });
      const nearest = (anchorHeight: number) => STREAMS.map((_, index) => {
        const center = { x: 0, y: 0 }; streamCentreAnalytic(index, 0, center);
        return { index, score: Math.abs(center.y - anchorHeight) + 0.3 * Math.abs(center.x) };
      }).sort((a, b) => a.score - b.score || a.index - b.index).slice(0, 2).map(row => row.index);
      const initialPair = nearest(height), changedPair = nearest(height === 560 ? 2240 : 560);
      expect(changedPair).not.toEqual(initialPair);
      const camera = new PerspectiveCamera(115, 1280 / 720, 1, 14000);
      camera.position.set(0, height, 1800); camera.lookAt(0, height, 0); camera.updateMatrixWorld(true);
      const update = (time: number) => {
        const angle = 2 / (camera.projectionMatrix.elements[5]! * 720);
        traffic.setPixelAngle(angle, angle);
        traffic.setCameraFrame(camera.matrixWorldInverse.elements, camera.near, camera.projectionMatrix.elements);
        traffic.update(time, camera.position);
      };
      try {
        traffic.setAnchor(0, height, 0, 0, 160, 0, 0); update(12);
        const initial = new Map<number, { stream: number; origin: number; matrix: readonly number[]; speed: number }>();
        const chosen = new Set<number>();
        for (let id = 4; id < 114; id++) {
          const plan: import('../src/render/traffic').CarPlan = { role: 'free', stream: 255 };
          carTrafficPlan(seed, id, plan);
          if (plan.role !== 'chase-stream') continue;
          const evidence = traffic.carEvidence(id);
          if (!evidence?.prospectiveHullMatrix) throw Error('R15_CHASE_SOURCE_MATRIX_REQUIRED');
          expect(evidence.sourceStream).toBe(initialPair[plan.stream]);
          chosen.add(evidence.sourceStream);
          initial.set(id, { stream: evidence.sourceStream, origin: evidence.sourceOriginM,
            matrix: evidence.prospectiveHullMatrix, speed: evidence.sourceSignedSpeedMps });
        }
        expect(chosen).toEqual(new Set(initialPair));
        traffic.setAnchor(0, height === 560 ? 2240 : 560, 0, 0, 160, 0, 0);
        for (const time of [12, 12.5, 20]) {
          update(time);
          for (const [id, before] of initial) {
            const current = traffic.carEvidence(id);
            if (!current?.prospectiveHullMatrix) throw Error('R15_FIXED_COHORT_MATRIX_REQUIRED');
            expect(current.sourceStream).toBe(before.stream);
            expect(current.sourceOriginM).toBe(before.origin);
            expect(current.sourceSignedSpeedMps).toBe(before.speed);
            if (time === 12) expect(current.prospectiveHullMatrix).toEqual(before.matrix);
          }
        }
        update(-5);
        for (const [id, before] of initial) expect(traffic.carEvidence(id)?.sourceStream).toBe(before.stream);
      } finally { traffic.dispose(); }
    });

  it.each([0, 1])('keeps rank %i on its native route through 90 fixed steps after a strata change', rank => {
    const traffic = createSkyriverTraffic({ seed: 424242, quality: TRAFFIC_QUALITY_TIERS.high });
    const camera = new PerspectiveCamera(62, 1280 / 720, 1, 14000);
    const plan: import('../src/render/traffic').CarPlan = { role: 'free', stream: 255 };
    const id = Array.from({ length: 110 }, (_, index) => index + 4).find(candidate => {
      carTrafficPlan(424242, candidate, plan); return plan.role === 'chase-stream' && plan.stream === rank;
    });
    if (id === undefined) throw Error('R15_SEEDED_RANK_CAR_REQUIRED');
    const update = (time: number) => {
      camera.updateMatrixWorld(true);
      const angle = 2 / (camera.projectionMatrix.elements[5]! * 720);
      traffic.setPixelAngle(angle / 1.25, angle);
      traffic.setCameraFrame(camera.matrixWorldInverse.elements, camera.near, camera.projectionMatrix.elements);
      traffic.update(time, camera.position);
    };
    try {
      camera.position.set(0, 560, 1800); camera.lookAt(0, 560, 0);
      traffic.setAnchor(0, 560, 0, 0, 160, 0, 0); update(12);
      const initial = traffic.carEvidence(id);
      if (!initial?.prospectiveHullMatrix) throw Error('R15_INITIAL_NATIVE_SOURCE_REQUIRED');
      let previous = new Vector3(...initial.position);
      const streak = traffic.objects.find(object => object.name === 'skyriver.traffic.streaks');
      if (!(streak instanceof Mesh) || !(streak.geometry instanceof InstancedBufferGeometry)) throw Error('R15_NATIVE_STREAK_REQUIRED');
      let maxStepM = 0;
      for (let frame = 0; frame < 90; frame++) {
        if (frame === 30) traffic.setAnchor(0, 2240, 0, 0, 160, 0, 0);
        camera.position.copy(previous).add(new Vector3(0, 0, 200)); camera.lookAt(previous);
        update(12 + frame / 60);
        const current = traffic.carEvidence(id);
        if (!current || current.hullSlot < 0 || current.streakSlot < 0) throw Error('R15_RESOLVED_NATIVE_CARRIER_REQUIRED');
        const hull = traffic.objects.find(object => object.name === current.hullMeshName);
        if (!(hull instanceof InstancedMesh)) throw Error('R15_RESOLVED_NATIVE_HULL_REQUIRED');
        const matrix = new Matrix4().fromArray(hull.instanceMatrix.array, current.hullSlot * 16);
        const position = new Vector3().setFromMatrixPosition(matrix);
        const step = position.distanceTo(previous); maxStepM = Math.max(maxStepM, step);
        expect(step).toBeLessThanOrEqual(12);
        expect(current.sourceStream).toBe(initial.sourceStream);
        expect(current.sourceOriginM).toBe(initial.sourceOriginM);
        expect(current.sourceSignedSpeedMps).toBe(initial.sourceSignedSpeedMps);
        expect(current.physicalScale).toBe(initial.physicalScale);
        hull.geometry.computeBoundingBox(); const box = hull.geometry.boundingBox;
        if (!box) throw Error('R15_NATIVE_HULL_BOUNDS_REQUIRED');
        const points: Vector3[] = [];
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          const world = new Vector3(x, y, z).applyMatrix4(matrix);
          expect(world.clone().applyMatrix4(camera.matrixWorldInverse).z).toBeLessThan(-camera.near);
          const projected = world.project(camera);
          expect(Math.abs(projected.x)).toBeLessThan(1); expect(Math.abs(projected.y)).toBeLessThan(1);
          points.push(projected);
        }
        const cssExtent = Math.max((Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x))) * 640,
          (Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))) * 360);
        expect(cssExtent).toBeGreaterThanOrEqual(0.5);
        expect(hull.geometry.getAttribute('aFade').getX(current.hullSlot)).toBe(1);
        const lod = streak.geometry.getAttribute('aCarLod'), lamp = streak.geometry.getAttribute('aCarFade');
        const lampPosition = streak.geometry.getAttribute('aCarPos');
        expect(lod.getZ(current.streakSlot)).toBe(id);
        expect(lamp.getX(current.streakSlot)).toBe(1);
        expect(lamp.getY(current.streakSlot)).toBe(Math.fround(initial.physicalScale));
        expect(new Vector3(lampPosition.getX(current.streakSlot), lampPosition.getY(current.streakSlot),
          lampPosition.getZ(current.streakSlot)).distanceTo(position)).toBeLessThan(1e-4);
        previous = position;
      }
      expect(maxStepM).toBeGreaterThan(0);
    } finally { traffic.dispose(); }
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

  it('keeps permanent identity, pose and shared native visibility through the crossover band', () => {
    const traffic = createSkyriverTraffic({ seed: 424242, quality: TRAFFIC_QUALITY_TIERS.high });
    const streak = traffic.objects.find(object => object.name === 'skyriver.traffic.streaks');
    if (!(streak instanceof Mesh) || !(streak.geometry instanceof InstancedBufferGeometry)) throw Error('R15_REAL_STREAK_REQUIRED');
    const geometry = streak.geometry, positions = geometry.getAttribute('aCarPos');
    const directions = geometry.getAttribute('aCarDir'), fades = geometry.getAttribute('aCarFade');
    const lod = geometry.getAttribute('aCarLod'), shapes = geometry.getAttribute('aCarShape');
    const camera = new PerspectiveCamera(62, 1280 / 720, 1, 14000);
    camera.position.set(0, 1500, 0); camera.lookAt(0, 1500, -1000); camera.updateMatrixWorld(true);
    const update = (time: number) => {
      camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      const angle = 2 / (camera.projectionMatrix.elements[5]! * 720);
      traffic.setPixelAngle(angle, angle); traffic.setCameraFrame(camera.matrixWorldInverse.elements, camera.near);
      traffic.update(time, camera.position);
    };
    const smooth = (start: number, end: number, value: number) => {
      const x = Math.max(0, Math.min(1, (value - start) / (end - start))); return x * x * (3 - 2 * x);
    };
    try {
      for (const time of [0, 12, 24]) update(time);
      expect(geometry.instanceCount).toBeGreaterThan(50);
      const initialSlot = 50, id = lod.getZ(initialSlot);
      expect(Number.isInteger(id)).toBe(true); expect(id).toBeGreaterThanOrEqual(0);
      const initialPosition = new Vector3(positions.getX(initialSlot), positions.getY(initialSlot), positions.getZ(initialSlot));
      const initialDirection = [directions.getX(initialSlot), directions.getY(initialSlot), directions.getZ(initialSlot), directions.getW(initialSlot)];
      const initialSize = fades.getY(initialSlot), initialProfile = shapes.getX(initialSlot), initialTrail = fades.getW(initialSlot);
      const owner = traffic.carEvidence(id); if (!owner) throw Error('R15_NATIVE_ID_EVIDENCE_REQUIRED');
      const hull = traffic.objects.find(object => object.name === owner.hullMeshName);
      if (!(hull instanceof InstancedMesh)) throw Error('R15_NATIVE_HULL_REQUIRED');
      const initialMatrix = Array.from(hull.instanceMatrix.array.slice(owner.hullSlot * 16, owner.hullSlot * 16 + 16));
      hull.geometry.computeBoundingBox(); const box = hull.geometry.boundingBox;
      if (!box) throw Error('R15_REAL_BODY_BOUNDS_REQUIRED');
      const distances = [...new Set([...Array.from({ length: 45 }, (_, i) => 900 + i * 25), 1080, 1190, 1245, 1300, 1400, 2000])].sort((a, b) => a - b);
      let previous = 1; const slots = new Set<number>();
      for (const fov of [62, 8]) {
        camera.fov = fov; previous = 1;
        for (const distance of distances) {
          camera.position.copy(initialPosition).add(new Vector3(0, 0, distance)); camera.lookAt(initialPosition); update(24);
          const current = traffic.carEvidence(id); if (!current) throw Error('R15_PERMANENT_ID_LOST');
          expect(current.admitted).toBe(true); expect(current.hullMeshName).toBe(hull.name);
          const native = Array.from(hull.instanceMatrix.array.slice(current.hullSlot * 16, current.hullSlot * 16 + 16));
          expect(native).toEqual(initialMatrix);
          const matrix = new Matrix4().fromArray(native), points = [];
          for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
            points.push(new Vector3(x, y, z).applyMatrix4(matrix).project(camera));
          }
          const extent = Math.max((Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x))) * 640,
            (Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y))) * 360);
          const expected = smooth(0.125, 0.5, extent);
          const hullFade = hull.geometry.getAttribute('aFade').getX(current.hullSlot);
          expect(hullFade).toBeCloseTo(expected, 5); expect(hullFade).toBeLessThanOrEqual(previous + 1e-6); previous = hullFade;
          const rows = Array.from({ length: geometry.instanceCount }, (_, slot) => slot).filter(slot => lod.getZ(slot) === id);
          if (expected === 0) { expect(rows).toHaveLength(0); expect(hullFade).toBe(0); continue; }
          expect(rows).toHaveLength(1); const slot = rows[0]!; slots.add(slot);
          expect(positions.getX(slot)).toBeCloseTo(initialPosition.x, 6);
          expect(positions.getY(slot)).toBeCloseTo(initialPosition.y, 6);
          expect(positions.getZ(slot)).toBeCloseTo(initialPosition.z, 6);
          expect([directions.getX(slot), directions.getY(slot), directions.getZ(slot), directions.getW(slot)]).toEqual(initialDirection);
          expect(shapes.getX(slot)).toBe(initialProfile); expect(fades.getY(slot)).toBe(initialSize);
          expect(lod.getX(slot)).toBe(1); expect(lod.getY(slot)).toBe(0);
          expect(fades.getX(slot)).toBeCloseTo(expected, 5); expect(fades.getX(slot)).toBeCloseTo(hullFade, 5);
          expect(fades.getW(slot)).toBe(initialTrail);
          if (extent >= 0.5) { expect(hullFade).toBe(1); expect(fades.getX(slot)).toBe(1); }
        }
      }
      expect(slots.size).toBeGreaterThan(1);
    } finally { traffic.dispose(); }
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
