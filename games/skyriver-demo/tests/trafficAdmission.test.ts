import { describe, expect, it } from 'vitest';
import { InstancedBufferAttribute, InstancedBufferGeometry, InstancedMesh, Matrix4, Mesh, PerspectiveCamera, Frustum, Sphere, Vector3 } from 'three';
import { createSkyriverTraffic, TRAFFIC_QUALITY_TIERS } from '../src/render/traffic';
import { TRAFFIC_APPEARANCE_PROFILES, TRAFFIC_TRAIL_MAX_M } from '../src/render/trafficAppearance';

describe('F5/F7 real native allocation', () => {
  it('allocates only positive rows with one permanent owner and no idle slots', () => {
    const traffic = createSkyriverTraffic({ seed: 424242, quality: TRAFFIC_QUALITY_TIERS.high,
      maxCarCount: 2400, maxThrusterBudget: 2400, maxImpostors: 8 });
    try {
      const camera = new PerspectiveCamera(62, 1280 / 720, 1, 14000);
      camera.position.set(0, 1500, 0);
      camera.lookAt(0, 1500, -1);
      camera.updateMatrixWorld(true);
      const focal = camera.projectionMatrix.elements[5]!;
      traffic.setPixelAngle(2 / (focal * 900), 2 / (focal * 720));
      Reflect.apply(traffic.setCameraFrame, traffic,
        [camera.matrixWorldInverse.elements, camera.near, camera.projectionMatrix.elements]);
      traffic.update(12, camera.position);
      const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      let culled = 0;
      const owners = new Map<string, number>();
      const requested = new Set<number>(), nativeIds = new Set<number>();
      for (let id = 0; id < 2400; id++) {
        const evidence = traffic.carEvidence(id);
        if (!evidence) throw Error('ADMISSION_LOGICAL_ID_MISSING');
        expect(evidence.carId).toBe(id);
        if (evidence.requested) requested.add(id);
        expect(evidence.admitted).toBe(true);
        expect(evidence.poseEvaluated).toBe(true);
        const profile = TRAFFIC_APPEARANCE_PROFILES[evidence.profileIndex]!;
        const mesh = traffic.objects.find(object => object.name === 'skyriver.traffic.' + profile.name);
        if (!(mesh instanceof InstancedMesh)) throw Error('ADMISSION_LOGICAL_PROFILE_MISSING');
        mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox;
        if (!box) throw Error('ADMISSION_PHYSICAL_BOUNDS_MISSING');
        const hullRadius = Math.max(...[box.min.x, box.max.x].flatMap(x =>
          [box.min.y, box.max.y].flatMap(y => [box.min.z, box.max.z].map(z => Math.hypot(x, y, z))))) * evidence.physicalScale;
        const lamps = [profile.front, profile.rear];
        const lampAndTrailRadius = Math.max(...lamps.map(lamp => Math.hypot(
          (lamp.kind === 'pair' ? lamp.centreXM : 0) + lamp.widthM / 2,
          Math.abs(lamp.yM) + lamp.heightM / 2, Math.abs(lamp.zM)))) * evidence.physicalScale + TRAFFIC_TRAIL_MAX_M;
        expect(evidence.envelopeRadiusM).toBeGreaterThanOrEqual(Math.max(hullRadius, lampAndTrailRadius));
        const outside = !frustum.intersectsSphere(new Sphere(new Vector3(...evidence.position), evidence.envelopeRadiusM));
        expect(evidence.envelopeOutside).toBe(outside);
        expect(evidence.drawn).toBe(evidence.prospectiveVisibility !== 0 && !outside);
        if (!evidence.drawn) {
          culled += 1;
          expect(evidence.hullMeshName).toBeNull(); expect(evidence.hullSlot).toBe(-1); expect(evidence.streakSlot).toBe(-1);
          expect(evidence.visibility).toBe(0); expect(evidence.lampFade).toBe(0);
        }
        if (evidence.hullMeshName !== null && evidence.hullSlot >= 0) {
          const key = evidence.hullMeshName + ':' + evidence.hullSlot;
          expect(owners.has(key)).toBe(false);
          owners.set(key, id);
        }
      }
      expect(requested.size).toBe(2400);
      for (const object of traffic.objects) {
        if (!(object instanceof InstancedMesh)) continue;
        const fade = object.geometry.getAttribute('aFade');
        for (let slot = 0; slot < object.count; slot++) {
          expect(fade.getX(slot)).toBeGreaterThan(0);
          const id = owners.get(object.name + ':' + slot);
          expect(id).toBeDefined();
          if (id === undefined) throw Error('ADMISSION_NATIVE_HULL_OWNER_MISSING');
          expect(nativeIds.has(id)).toBe(false);
          nativeIds.add(id);
          const evidence = traffic.carEvidence(id);
          if (!evidence) throw Error('ADMISSION_NATIVE_EVIDENCE_MISSING');
          for (let axis = 0; axis < 3; axis++) {
            expect(object.instanceMatrix.array[slot * 16 + 12 + axis]).toBeCloseTo(evidence.position[axis]!, 4);
          }
        }
      }
      expect(owners.size).toBe(nativeIds.size);
      expect(nativeIds.size + culled).toBe(2400);
      expect(culled).toBeGreaterThan(0);
      const streak = traffic.objects.find(object => object.name === 'skyriver.traffic.streaks');
      if (!(streak instanceof Mesh) || !(streak.geometry instanceof InstancedBufferGeometry)) throw Error('ADMISSION_NATIVE_STREAK_MISSING');
      const ids = streak.geometry.getAttribute('aCarLod'), fade = streak.geometry.getAttribute('aCarFade');
      if (!(ids instanceof InstancedBufferAttribute) || !(fade instanceof InstancedBufferAttribute)) throw Error('ADMISSION_NATIVE_CARRIER_ATTRIBUTES_MISSING');
      const lampIds = new Set<number>();
      for (let slot = 0; slot < streak.geometry.instanceCount; slot++) {
        const id = ids.getZ(slot);
        expect(Number.isInteger(id)).toBe(true);
        expect(fade.getX(slot)).toBeGreaterThan(0);
        expect(lampIds.has(id)).toBe(false);
        expect(nativeIds.has(id)).toBe(true);
        lampIds.add(id);
      }
      expect(lampIds).toEqual(nativeIds);
    } finally { traffic.dispose(); }
  });
  it('admits newly requested organic IDs at hidden legal route points and keeps one phase and speed', () => {
    const options = { seed: 424242, maxCarCount: 2400, maxThrusterBudget: 2400, maxImpostors: 8 };
    const traffic = createSkyriverTraffic({ ...options, quality: TRAFFIC_QUALITY_TIERS.low });
    const original = createSkyriverTraffic({ ...options, quality: TRAFFIC_QUALITY_TIERS.high });
    const camera = new PerspectiveCamera(62, 1280 / 720, 1, 14000);
    camera.position.set(0, 1500, 0); camera.lookAt(0, 1500, -1000); camera.updateMatrixWorld(true);
    const viewProjection = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const frustum = new Frustum().setFromProjectionMatrix(viewProjection);
    const prepare = (actual: ReturnType<typeof createSkyriverTraffic>, time: number) => {
      const focal = camera.projectionMatrix.elements[5]!;
      actual.setPixelAngle(2 / (focal * 900), 2 / (focal * 720));
      actual.setCameraFrame(camera.matrixWorldInverse.elements, camera.near, camera.projectionMatrix.elements);
      actual.setAnchor(0, 1500, 0, 0, 160, 0, 0);
      actual.update(time, camera.position);
    };
    try {
      prepare(traffic, 12); prepare(original, 12);
      const retained = new Map<number, readonly number[]>();
      for (let id = 0; id < 600; id++) {
        const evidence = traffic.carEvidence(id);
        if (evidence?.drawn && evidence.prospectiveHullMatrix) retained.set(id, evidence.prospectiveHullMatrix);
      }
      expect(retained.size).toBeGreaterThan(0);
      traffic.setQuality(TRAFFIC_QUALITY_TIERS.high);
      prepare(traffic, 12);
      for (const [id, matrix] of retained) {
        const current = traffic.carEvidence(id);
        expect(current?.drawn).toBe(true);
        expect(current?.prospectiveHullMatrix).toEqual(matrix);
        expect(current?.presentationPhaseOffsetM).toBe(0);
      }
      const phases = new Map<number, { offset: number; speed: number; stream: number; position: readonly number[]; time: number }>();
      let entries = 0, wrongEntryControlFailures = 0;
      for (let frame = 0; frame < 180; frame++) {
        const time = 12 + frame / 60;
        prepare(traffic, time); prepare(original, time);
        const nativeKeys = new Set<string>();
        for (let id = 600; id < 2400; id++) {
          const current = traffic.carEvidence(id), baseline = original.carEvidence(id);
          if (!current || !baseline) throw Error('ADMISSION_UPGRADE_ID_MISSING');
          expect(current.requested).toBe(true);
          if (!current.admitted) {
            expect(current.drawn).toBe(false);
            expect(current.hullSlot).toBe(-1); expect(current.streakSlot).toBe(-1);
            expect(current.admissionBlockedReason).not.toBeNull();
            continue;
          }
          const witness = current.admissionEntryWitness;
          if (!witness) throw Error('ADMISSION_HIDDEN_ENTRY_WITNESS_REQUIRED');
          if (!phases.has(id)) {
            entries += 1;
            expect(witness.viewMatrix).toEqual(camera.matrixWorldInverse.elements);
            expect(witness.projectionMatrix).toEqual(camera.projectionMatrix.elements);
            expect(witness.candidateIndex).toBeGreaterThanOrEqual(0);
            expect(witness.candidateIndex).toBeLessThan(16);
            const sphere = new Sphere(new Vector3(...witness.position), witness.radiusM);
            expect(frustum.intersectsSphere(sphere)).toBe(false);
            // A moved witness inside the camera must fail the same hidden-entry condition.
            const visibleControl = new Sphere(new Vector3(0, 1500, -1000), witness.radiusM);
            expect(frustum.intersectsSphere(visibleControl)).toBe(true);
            wrongEntryControlFailures += 1;
          }
          expect(current.sourceSignedSpeedMps).toBe(baseline.sourceSignedSpeedMps);
          expect(current.sourceStream).toBe(baseline.sourceStream);
          const prior = phases.get(id);
          if (prior) {
            expect(current.presentationPhaseOffsetM).toBe(prior.offset);
            expect(current.sourceSignedSpeedMps).toBe(prior.speed);
            expect(current.sourceStream).toBe(prior.stream);
            if (current.poseTimeS !== null && current.poseTimeS > prior.time) {
              expect(new Vector3(...current.position).distanceTo(new Vector3().fromArray(prior.position))).toBeLessThan(25);
            }
          }
          phases.set(id, { offset: current.presentationPhaseOffsetM, speed: current.sourceSignedSpeedMps,
            stream: current.sourceStream, position: current.position, time: current.poseTimeS ?? time });
          if (current.drawn) {
            expect(current.visibility).toBeGreaterThan(0);
            expect(current.lampFade).toBe(current.visibility);
            expect(current.streakSlot).toBeGreaterThanOrEqual(0);
            const key = current.hullMeshName + ':' + current.hullSlot;
            expect(nativeKeys.has(key)).toBe(false); nativeKeys.add(key);
          }
        }
      }
      expect(entries).toBeGreaterThan(0);
      expect(wrongEntryControlFailures).toBe(entries);
    } finally { traffic.dispose(); original.dispose(); }
  });

});
