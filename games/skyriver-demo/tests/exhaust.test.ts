import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { CANYON_LOOP_LENGTH_M } from '../src/render/canyonWarp';
import {
  autopilotTrackPose,
  createWorldWakeSamples,
  sampleWorldWake,
  SHUTTLE_DRAW_PITCH_SHARE,
  SHUTTLE_WAKE_WELD_BLEND_M,
  type ShuttleWakePose,
  type TrackPose,
} from '../src/render/flightPresentation';
import {
  createSkyriverShuttle,
  SHUTTLE_NOZZLE_ROOTS_LOCAL,
  SHUTTLE_WAKE_SAMPLE_COUNT,
} from '../src/render/shuttle';

function makeWakePose(overrides: Partial<ShuttleWakePose> = {}): ShuttleWakePose {
  return {
    x: 12,
    y: 28,
    z: -340,
    yaw: 0.17,
    pitch: -0.045,
    roll: 0.035,
    mode: 0,
    boostVisual: 0,
    canyonV: 820,
    wakeTrackV: 820,
    wakeTrackWeight: 1,
    ...overrides,
  };
}

function trackScratch(): TrackPose {
  return { cutFade: 0, v: 0, lateral: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
}

function poseAtTrack(v: number, overrides: Partial<ShuttleWakePose> = {}): ShuttleWakePose {
  const track = autopilotTrackPose(v, trackScratch());
  return makeWakePose({
    x: track.x,
    y: track.y,
    z: track.z,
    yaw: track.yaw,
    pitch: track.pitch,
    roll: track.roll,
    canyonV: v,
    wakeTrackV: v,
    ...overrides,
  });
}

function maxArrayDelta(a: Float32Array, b: Float32Array): number {
  let max = 0;
  for (let i = 0; i < a.length; i += 1) max = Math.max(max, Math.abs(a[i]! - b[i]!));
  return max;
}

describe('analytic shuttle exhaust', () => {
  it('welds both world ribbons to the actual nozzle roots at nonzero pitch and bank', () => {
    const pose = makeWakePose();
    const wake = createWorldWakeSamples();
    sampleWorldWake(pose, 3.25, wake);

    const shuttle = createSkyriverShuttle();
    shuttle.setPose(
      pose.x,
      pose.y,
      pose.z,
      pose.yaw,
      pose.pitch * SHUTTLE_DRAW_PITCH_SHARE,
      pose.roll,
    );
    const hull = shuttle.objects[0]!;
    hull.updateMatrixWorld(true);

    for (let nozzle = 0; nozzle < 2; nozzle += 1) {
      const local = SHUTTLE_NOZZLE_ROOTS_LOCAL[nozzle]!;
      const expected = new THREE.Vector3(local[0], local[1], local[2]).applyMatrix4(hull.matrixWorld);
      const centers = nozzle === 0 ? wake.leftCenters : wake.rightCenters;
      expect(centers[0]).toBeCloseTo(expected.x, 4);
      expect(centers[1]).toBeCloseTo(expected.y, 4);
      expect(centers[2]).toBeCloseTo(expected.z, 4);
    }
    shuttle.dispose();
  });

  it('uses the exact autopilot route mapping after the weld', () => {
    const pose = poseAtTrack(2345.75, { boostVisual: 0.7 });
    const wake = createWorldWakeSamples();
    sampleWorldWake(pose, 1.75, wake);

    const probe = trackScratch();
    for (let i = 0; i < SHUTTLE_WAKE_SAMPLE_COUNT; i += 1) {
      const distance = wake.lengthM * i / (SHUTTLE_WAKE_SAMPLE_COUNT - 1);
      if (distance < SHUTTLE_WAKE_WELD_BLEND_M + 0.01) continue;
      autopilotTrackPose(pose.canyonV - distance, probe);
      const offset = i * 3;
      expect(wake.routeCenters[offset]).toBeCloseTo(probe.x, 3);
      expect(wake.routeCenters[offset + 1]).toBeCloseTo(probe.y, 3);
      expect(wake.routeCenters[offset + 2]).toBeCloseTo(probe.z, 3);
      expect(wake.leftCenters[offset]).toBe(wake.rightCenters[offset]);
      expect(wake.leftCenters[offset + 1]).toBe(wake.rightCenters[offset + 1]);
      expect(wake.leftCenters[offset + 2]).toBe(wake.rightCenters[offset + 2]);
    }
  });

  it('repeats after rewind and keeps the tail independent of current bank', () => {
    const pose = poseAtTrack(1960.5, { boostVisual: 0.8 });
    const wake = createWorldWakeSamples();
    const leftBuffer = wake.leftCenters;
    const rightBuffer = wake.rightCenters;
    sampleWorldWake(pose, 4.5, wake);
    const firstLeft = wake.leftCenters.slice();
    const firstRight = wake.rightCenters.slice();
    sampleWorldWake(pose, 9, wake);
    sampleWorldWake(pose, 4.5, wake);
    expect(wake.leftCenters).toBe(leftBuffer);
    expect(wake.rightCenters).toBe(rightBuffer);
    expect(wake.leftCenters).toEqual(firstLeft);
    expect(wake.rightCenters).toEqual(firstRight);

    const banked = createWorldWakeSamples();
    const unbanked = createWorldWakeSamples();
    sampleWorldWake({ ...pose, roll: 0.12 }, 4.5, banked);
    sampleWorldWake({ ...pose, roll: -0.09 }, 4.5, unbanked);
    const tailIndex = 12 * 3;
    expect(banked.leftCenters[tailIndex]).toBe(unbanked.leftCenters[tailIndex]);
    expect(banked.leftCenters[tailIndex + 1]).toBe(unbanked.leftCenters[tailIndex + 1]);
    expect(banked.leftCenters[tailIndex + 2]).toBe(unbanked.leftCenters[tailIndex + 2]);
    expect(banked.leftCenters[0]).not.toBe(unbanked.leftCenters[0]);
  });

  it('stays continuous across the canyon loop seam', () => {
    const epsilon = 0.02;
    const before = createWorldWakeSamples();
    const after = createWorldWakeSamples();
    sampleWorldWake(poseAtTrack(CANYON_LOOP_LENGTH_M / 2 - epsilon, { boostVisual: 0.5 }), 2.1, before);
    sampleWorldWake(poseAtTrack(-CANYON_LOOP_LENGTH_M / 2 + epsilon, { boostVisual: 0.5 }), 2.1, after);
    expect(maxArrayDelta(before.centers, after.centers)).toBeLessThan(0.1);
    const firstUnweldedSample = Math.ceil(SHUTTLE_WAKE_WELD_BLEND_M / (before.lengthM / (SHUTTLE_WAKE_SAMPLE_COUNT - 1)));
    const tailOffset = firstUnweldedSample * 3;
    expect(maxArrayDelta(before.leftCenters.subarray(tailOffset), after.leftCenters.subarray(tailOffset))).toBeLessThan(0.1);
    expect(maxArrayDelta(before.rightCenters.subarray(tailOffset), after.rightCenters.subarray(tailOffset))).toBeLessThan(0.1);
  });

  it('shares boost width with the plume and keeps both ribbons in one plume draw', () => {
    const shuttle = createSkyriverShuttle();
    const wake = createWorldWakeSamples();
    sampleWorldWake(makeWakePose({ boostVisual: 0 }), 0, wake);
    expect(wake.lengthM).toBe(80);
    expect(wake.rootWidthM).toBe(2.5);
    sampleWorldWake(makeWakePose({ boostVisual: 1 }), 0, wake);
    expect(wake.lengthM).toBe(160);
    expect(wake.rootWidthM).toBe(4.5);
    expect(wake.tailWidthM).toBe(0.5);
    shuttle.update({ boostVisual: 1, time: 0, wake });

    const hull = shuttle.objects[0]!;
    const meshes: THREE.Mesh[] = [];
    hull.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });
    expect(meshes).toHaveLength(2);
    const plume = meshes.find((mesh) => mesh.name === 'skyriver.shuttle.plume');
    expect(plume).toBeDefined();
    const material = plume!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uWakeRootWidth!.value).toBe(wake.rootWidthM);
    expect(material.uniforms.uWakeTailWidth!.value).toBe(wake.tailWidthM);
    expect(material.uniforms.uWidth!.value).toBe(1.1);

    const kind = plume!.geometry.getAttribute('aKind') as THREE.BufferAttribute;
    let ribbonVertices = 0;
    for (let i = 0; i < kind.count; i += 1) if (kind.getX(i) > 2.5) ribbonVertices += 1;
    expect(ribbonVertices).toBe(SHUTTLE_WAKE_SAMPLE_COUNT * 4);
    shuttle.dispose();
  });
});
