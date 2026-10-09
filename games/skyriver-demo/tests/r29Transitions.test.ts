import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { createSkyriverSimConfig, createInitialState, advanceState, type SkyriverStartMode } from '../src/sim/systems';
import { SKYRIVER_NEUTRAL_INPUT } from '../src/sim/input';
import { projectSkyriverState } from '../src/sim/runtime';
import { interpolateSkyriverFlight, type SkyriverRenderState } from '../src/sim/session';
import { createFlightPresenter, createWorldWakeSamples, sampleWorldWake, SHUTTLE_DRAW_PITCH_SHARE, type PresentedFlight } from '../src/render/flightPresentation';
import { createSkyriverShuttle, SHUTTLE_NOZZLE_ROOTS_LOCAL, SHUTTLE_WAKE_SAMPLE_COUNT } from '../src/render/shuttle';
import { CLEARANCE_SHUTTLE_RADIUS_M, CLEARANCE_CAMERA_RADIUS_M, createMassField } from '../src/render/clearance';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import { createCameraPoseScratch, writeCameraPose } from '../src/render/cameraRig';
import { deriveCityMasses, warpRigid } from '../src/render/city';

function realFrames(toggles: readonly number[], end = 850, startMode: SkyriverStartMode = 'autopilot'): SkyriverRenderState[] {
  const config = createSkyriverSimConfig(424242, startMode);
  let previous = createInitialState(config);
  const frames: SkyriverRenderState[] = [];
  for (let tick = 1; tick <= end; tick += 1) {
    const current = advanceState(previous, [{ ...SKYRIVER_NEUTRAL_INPUT, modeToggle: toggles.includes(tick) }], config);
    const p = projectSkyriverState(previous, null), c = projectSkyriverState(current, previous);
    frames.push({ tick: c.tick, previous: p, current: c, ...interpolateSkyriverFlight(p, c, 0.5), localSlot: 0, status: 'offline' });
    previous = current;
  }
  return frames;
}
function gap(a: Pick<PresentedFlight, 'x' | 'y' | 'z'>, b: Pick<PresentedFlight, 'x' | 'y' | 'z'>): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}
function arrayStep(a: Float32Array, i: number): number {
  const at = i * 3, previous = (i - 1) * 3;
  return Math.hypot(a[at]! - a[previous]!, a[at + 1]! - a[previous + 1]!, a[at + 2]! - a[previous + 2]!);
}

function initializedPresenter(seed: number) {
  const presenter = createFlightPresenter(seed);
  presenter.resetTimeline(1);
  return presenter;
}
function ingestModeEdge(presenter: ReturnType<typeof createFlightPresenter>, state: SkyriverRenderState, epoch = 1): void {
  if (state.previous.flight.mode !== state.current.flight.mode) presenter.observeModeEdge(state, epoch);
}

function indexedDrawnBoxes(seed = 424242) {
  return deriveCityMasses(presentCityLayout(deriveCityLayout(seed))).map((mass, index) => {
    const warped = warpRigid(mass.x, mass.z, mass.anchorV ?? mass.z, { x: 0, z: 0, heading: 0 });
    const inverse = new THREE.Matrix4().compose(
      new THREE.Vector3(warped.x, mass.y0 + mass.height / 2, warped.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), warped.heading),
      new THREE.Vector3(1, 1, 1),
    ).invert();
    return { index, inverse, half: new THREE.Vector3(mass.width / 2, mass.height / 2, mass.depth / 2) };
  });
}

function nearestDrawnBox(boxes: ReturnType<typeof indexedDrawnBoxes>, point: Pick<PresentedFlight, 'x' | 'y' | 'z'>) {
  const local = new THREE.Vector3();
  let nearest = { index: -1, gapM: Infinity };
  for (const box of boxes) {
    const e = box.inverse.elements;
    local.set(point.x * e[0]! + point.z * e[8]! + e[12]!, point.y + e[13]!, point.x * e[2]! + point.z * e[10]! + e[14]!);
    const dx = Math.abs(local.x) - box.half.x, dy = Math.abs(local.y) - box.half.y, dz = Math.abs(local.z) - box.half.z;
    const outside = Math.hypot(Math.max(0, dx), Math.max(0, dy), Math.max(0, dz));
    const gapM = outside > 0 ? outside : Math.max(dx, dy, dz);
    if (gapM < nearest.gapM) nearest = { index: box.index, gapM };
  }
  return nearest;
}

describe('R29 independent interrupted mode transitions', () => {
  it.each([{ toggles: [600, 740] }, { toggles: [600, 610, 620] }, { toggles: [600, 740, 750] }])('keeps actual camera position and aim continuous at real mode edges $toggles', ({ toggles }) => {
    const frames = realFrames(toggles), presenter = initializedPresenter(424242), camera = createCameraPoseScratch();
    frames.forEach(frame => { ingestModeEdge(presenter, frame); presenter.present(frame, 1); });
    const at = (frame: SkyriverRenderState, alpha: number) => {
      const state = { ...frame, ...interpolateSkyriverFlight(frame.previous, frame.current, alpha) };
      const pose = { ...presenter.present(state, 1) };
      writeCameraPose(camera, pose, state.camera, { boost: pose.boostVisual, time: (state.current.tick + state.alpha) / 30 });
      return { ...camera, position: { ...camera.position }, target: { ...camera.target } };
    };
    for (const tick of toggles) {
      const before = at(frames[tick - 2]!, 1 - 1e-6), after = at(frames[tick - 1]!, 1e-6);
      expect(gap(before.position, after.position), `camera position tick${tick} trace${toggles}`).toBeLessThan(0.01);
      expect(gap(before.target, after.target), `camera aim tick${tick} trace${toggles}`).toBeLessThan(0.01);
      expect(Math.abs(before.roll - after.roll), `camera roll tick${tick}`).toBeLessThan(0.0001);
      expect(Math.abs(before.fov - after.fov), `camera FOV tick${tick}`).toBeLessThan(0.0001);
      presenter.present(frames[849]!, 1);
      expect(at(frames[tick - 2]!, 1 - 1e-6)).toEqual(before);
      expect(at(frames[tick - 1]!, 1e-6)).toEqual(after);
    }
  });

  it('keeps the real safe-endpoint990 outbound handoff outside mass2241 with full box distances', () => {
    const frames = realFrames([990], 1070), presenter = initializedPresenter(424242), target = initializedPresenter(424242), boxes = indexedDrawnBoxes();
    let source: PresentedFlight | null = null;
    for (const frame of frames) {
      ingestModeEdge(presenter, frame);
      if (frame.tick === 990) source = { ...presenter.present({ ...frame, ...interpolateSkyriverFlight(frame.previous, frame.current, 0) }, 1) };
      const pose = { ...presenter.present(frame, 1) };
      if (frame.tick !== 1032) continue;
      expect(nearestDrawnBox(boxes, source!).gapM - 14).toBeGreaterThan(0);
      expect(nearestDrawnBox(boxes, target.present(frame, 1)).gapM - 14).toBeGreaterThan(0);
      expect(nearestDrawnBox(boxes, pose).gapM - 14, 'full box distance at tick1032').toBeGreaterThanOrEqual(0);
    }
  });

  it.each([424242, 0, 2147483647, 4294967295])('keeps safe hull and camera endpoints clear across sixteen real lap phases for seed%s', seed => {
    const boxes = indexedDrawnBoxes(seed), clock = initializedPresenter(seed), camera = createCameraPoseScratch();
    const lapTicks = clock.trackLength * 30 / clock.autopilotSpeedMps;
    const hits: { startMode: SkyriverStartMode; toggle: number; tick: number; what: 'hull' | 'camera'; sourceGapM: number; targetGapM: number; drawnGapM: number; mass: number }[] = [];
    const inherited: { startMode: SkyriverStartMode; toggle: number; tick: number; what: 'hull' | 'camera'; sourceGapM: number; targetGapM: number; drawnGapM: number }[] = [];
    let samples = 0, safeHullSamples = 0, safeCameraSamples = 0, reverseQueries = 0, maxSubtickGapM = 0;
    for (const startMode of ['autopilot', 'freefly'] as const) {
      const config = createSkyriverSimConfig(seed, startMode), prefix = [createInitialState(config)];
      const toggles = Array.from({ length: 16 }, (_, i) => Math.max(1, Math.round((i + 0.5) / 16 * lapTicks)));
      for (let tick = 1; tick < Math.max(...toggles); tick += 1) prefix.push(advanceState(prefix[tick - 1]!, [SKYRIVER_NEUTRAL_INPUT], config));
      for (const toggle of toggles) {
        let previous = prefix[toggle - 1]!;
        const presenter = initializedPresenter(seed), target = initializedPresenter(seed);
        const observed: { frame: SkyriverRenderState; pose: PresentedFlight; camera: ReturnType<typeof createCameraPoseScratch> }[] = [];
        let sourceHullGap = Infinity, sourceCameraGap = Infinity;
        for (let tick = toggle; tick <= toggle + 75; tick += 1) {
          const current = advanceState(previous, [{ ...SKYRIVER_NEUTRAL_INPUT, modeToggle: tick === toggle }], config);
          const p = projectSkyriverState(previous, null), c = projectSkyriverState(current, previous);
          const frame: SkyriverRenderState = { tick: c.tick, previous: p, current: c, ...interpolateSkyriverFlight(p, c, 0.5), localSlot: 0, status: 'offline' };
          ingestModeEdge(presenter, frame);
          if (tick === toggle) {
            const sourceFrame = { ...frame, ...interpolateSkyriverFlight(p, c, 0) };
            const source = { ...presenter.present(sourceFrame, 1) };
            sourceHullGap = nearestDrawnBox(boxes, source).gapM - 14;
            writeCameraPose(camera, source, sourceFrame.camera, { boost: source.boostVisual, time: (sourceFrame.current.tick + sourceFrame.alpha) / 30 });
            sourceCameraGap = nearestDrawnBox(boxes, camera.position).gapM - 8;
          }
          const pose = { ...presenter.present(frame, 1) }, unblended = { ...target.present(frame, 1) };
          const before = { ...presenter.present({ ...frame, ...interpolateSkyriverFlight(p, c, 0.49995) }, 1) };
          const after = { ...presenter.present({ ...frame, ...interpolateSkyriverFlight(p, c, 0.50005) }, 1) };
          const subtickGapM = gap(before, after);
          maxSubtickGapM = Math.max(maxSubtickGapM, subtickGapM);
          expect(subtickGapM, `seed${seed} ${startMode} toggle${toggle} tick${tick} alpha continuity`).toBeLessThan(0.1);
          const hullHit = nearestDrawnBox(boxes, pose), targetHullGap = nearestDrawnBox(boxes, unblended).gapM - 14;
          writeCameraPose(camera, pose, frame.camera, { boost: pose.boostVisual, time: (frame.current.tick + frame.alpha) / 30 });
          const drawnCamera = { ...camera, position: { ...camera.position }, target: { ...camera.target } };
          observed.push({ frame, pose, camera: drawnCamera });
          const cameraHit = nearestDrawnBox(boxes, camera.position);
          writeCameraPose(camera, unblended, frame.camera, { boost: unblended.boostVisual, time: (frame.current.tick + frame.alpha) / 30 });
          const targetCameraGap = nearestDrawnBox(boxes, camera.position).gapM - 8;
          samples += 1;
          for (const [what, sourceGapM, targetGapM, drawnGapM, mass] of [
            ['hull', sourceHullGap, targetHullGap, hullHit.gapM - 14, hullHit.index],
            ['camera', sourceCameraGap, targetCameraGap, cameraHit.gapM - 8, cameraHit.index],
          ] as const) {
            if (sourceGapM >= 0 && targetGapM >= 0) {
              if (what === 'hull') safeHullSamples += 1; else safeCameraSamples += 1;
              if (drawnGapM < 0) hits.push({ startMode, toggle, tick, what, sourceGapM, targetGapM, drawnGapM, mass });
            } else inherited.push({ startMode, toggle, tick, what, sourceGapM, targetGapM, drawnGapM });
          }
          if (tick === toggle + 75) {
            expect({ ...presenter.present(frame, 1) }).toEqual(pose);
            expect([pose.x, pose.y, pose.z, pose.yaw, pose.pitch, pose.speed]).toEqual([unblended.x, unblended.y, unblended.z, unblended.yaw, unblended.pitch, unblended.speed]);
            expect(drawnCamera).toEqual(camera);
          }
          previous = current;
        }
        for (const { frame, pose, camera: expectedCamera } of observed.reverse()) {
          const reversePose = { ...presenter.present(frame, 1) };
          expect(reversePose, `seed${seed} ${startMode} toggle${toggle} reverse tick${frame.tick}`).toEqual(pose);
          writeCameraPose(camera, reversePose, frame.camera, { boost: reversePose.boostVisual, time: (frame.current.tick + frame.alpha) / 30 });
          expect(camera, `seed${seed} ${startMode} toggle${toggle} reverse camera tick${frame.tick}`).toEqual(expectedCamera);
          reverseQueries += 1;
        }
      }
    }
    expect(samples).toBe(16 * 2 * 76);
    expect(reverseQueries).toBe(samples);
    expect(safeHullSamples).toBeGreaterThan(0);
    expect(safeCameraSamples).toBeGreaterThan(0);
    if (process.env.SKYRIVER_HANDOFF_SWEEP_OUT) writeFileSync(`${process.env.SKYRIVER_HANDOFF_SWEEP_OUT}-${seed}.json`, JSON.stringify({ seed, phases: 16, radii: { hull: 14, camera: 8 }, samples, reverseQueries, maxSubtickGapM, safeHullSamples, safeCameraSamples, introducedHits: hits, inheritedEndpointSamples: inherited }, null, 2));
    expect(hits, `full drawn-box safe-endpoint violations for seed${seed}`).toEqual([]);
  }, 60_000);

  it('keeps a real free-flight return continuous at the target half-loop boundary and after reverse seeks', () => {
    const frames = realFrames([1030], 1130, 'freefly'), presenter = initializedPresenter(424242);
    frames.forEach(frame => { ingestModeEdge(presenter, frame); presenter.present(frame, 1); });
    const frame = frames[1072]!;
    const at = (alpha: number) => ({ ...presenter.present({ ...frame, ...interpolateSkyriverFlight(frame.previous, frame.current, alpha) }, 1) });
    const before = at(0.7660), after = at(0.7661);
    expect(gap(before, after), 'tick1073 alpha .7660 to .7661').toBeLessThan(0.1);
    presenter.present(frames[1129]!, 1);
    expect(at(0.7660)).toEqual(before);
    expect(at(0.7661)).toEqual(after);
    presenter.present(frames[1028]!, 1);
    expect(at(0.7661)).toEqual(after);
  });

  it('keeps a real outbound free-flight target continuous across the old half-loop branch change', () => {
    const frames = realFrames([964], 1050), presenter = initializedPresenter(424242);
    frames.forEach(frame => { ingestModeEdge(presenter, frame); presenter.present(frame, 1); });
    const frame = frames[976]!;
    const at = (alpha: number) => ({ ...presenter.present({ ...frame, ...interpolateSkyriverFlight(frame.previous, frame.current, alpha) }, 1) });
    const before = at(0.95364699), after = at(0.95374699);
    expect(before.mode).toBe(1);
    expect(after.mode).toBe(1);
    expect(gap(before, after), 'tick977 outbound alpha branch').toBeLessThan(0.1);
    presenter.present(frames[1049]!, 1);
    expect(at(0.95364699)).toEqual(before);
    expect(at(0.95374699)).toEqual(after);
  });

  it('keeps the moving autopilot target continuous when its canonical coordinate wraps inside a return', () => {
    const frames = realFrames([970], 1050, 'freefly'), presenter = initializedPresenter(424242), target = initializedPresenter(424242);
    frames.forEach(frame => { ingestModeEdge(presenter, frame); presenter.present(frame, 1); });
    const wrapTime = presenter.trackLength / 2 * 30 / presenter.autopilotSpeedMps;
    const floor = Math.floor(wrapTime), frame = frames[floor]!, alpha = wrapTime - floor;
    const beforeState = { ...frame, ...interpolateSkyriverFlight(frame.previous, frame.current, alpha - 0.00005) };
    const afterState = { ...frame, ...interpolateSkyriverFlight(frame.previous, frame.current, alpha + 0.00005) };
    expect(frame.tick).toBeGreaterThan(970);
    expect(frame.tick).toBeLessThan(970 + 75);
    expect(target.present(beforeState, 1).canyonV).toBeGreaterThan(presenter.trackLength * 0.49);
    expect(target.present(afterState, 1).canyonV).toBeLessThan(-presenter.trackLength * 0.49);
    const before = { ...presenter.present(beforeState, 1) }, after = { ...presenter.present(afterState, 1) };
    expect(gap(before, after), 'wrapped target within return').toBeLessThan(0.1);
    presenter.present(frames[1049]!, 1);
    expect({ ...presenter.present(beforeState, 1) }).toEqual(before);
    expect({ ...presenter.present(afterState, 1) }).toEqual(after);
  });

  it.each([{ toggles: [600, 740] }, { toggles: [600, 740, 750] }])('keeps the hull and actual camera spheres outside drawn masses for safe-endpoint toggles $toggles', ({ toggles }) => {
    expect(CLEARANCE_SHUTTLE_RADIUS_M).toBe(14);
    expect(CLEARANCE_CAMERA_RADIUS_M).toBe(8);
    const frames = realFrames(toggles), presenter = initializedPresenter(424242);
    const field = createMassField(presentCityLayout(deriveCityLayout(424242)));
    const camera = createCameraPoseScratch();
    const hits: { tick: number; what: 'shuttle' | 'camera'; centerGapM: number; sphereGapM: number }[] = [];
    for (const frame of frames) {
      ingestModeEdge(presenter, frame);
      const pose = { ...presenter.present(frame, 1) };
      const hullGap = field.gap(pose.x, pose.y, pose.z);
      if (hullGap - CLEARANCE_SHUTTLE_RADIUS_M < 0) hits.push({ tick: frame.tick, what: 'shuttle', centerGapM: hullGap, sphereGapM: hullGap - CLEARANCE_SHUTTLE_RADIUS_M });
      writeCameraPose(camera, pose, frame.camera, { boost: pose.boostVisual, time: (frame.current.tick + frame.alpha) / 30 });
      const cameraGap = field.gap(camera.position.x, camera.position.y, camera.position.z);
      if (cameraGap - CLEARANCE_CAMERA_RADIUS_M < 0) hits.push({ tick: frame.tick, what: 'camera', centerGapM: cameraGap, sphereGapM: cameraGap - CLEARANCE_CAMERA_RADIUS_M });
    }
    expect(hits, `real mass sphere violations for toggles ${toggles}`).toEqual([]);
  });

  it('does not add safe-target collisions and retains the unsafe raw free-flight endpoint in the interrupted trace', () => {
    const frames = realFrames([600, 610, 620]), presenter = initializedPresenter(424242), target = initializedPresenter(424242);
    const field = createMassField(presentCityLayout(deriveCityLayout(424242))), boxes = indexedDrawnBoxes();
    const camera = createCameraPoseScratch();
    const rows: { tick: number; rawSphereGapM: number; targetSphereGapM: number; drawnSphereGapM: number; cameraSphereGapM: number; exactRawEndpoint: boolean; rawMass: number | null; drawnMass: number | null }[] = [];
    for (const frame of frames) {
      ingestModeEdge(presenter, frame);
      const pose = { ...presenter.present(frame, 1) }, unblended = { ...target.present(frame, 1) };
      const rawSphereGapM = field.gap(frame.flight.x, frame.flight.y, frame.flight.z) - CLEARANCE_SHUTTLE_RADIUS_M;
      const targetSphereGapM = field.gap(unblended.x, unblended.y, unblended.z) - CLEARANCE_SHUTTLE_RADIUS_M;
      const drawnSphereGapM = field.gap(pose.x, pose.y, pose.z) - CLEARANCE_SHUTTLE_RADIUS_M;
      writeCameraPose(camera, pose, frame.camera, { boost: pose.boostVisual, time: (frame.current.tick + frame.alpha) / 30 });
      const cameraSphereGapM = field.gap(camera.position.x, camera.position.y, camera.position.z) - CLEARANCE_CAMERA_RADIUS_M;
      if (targetSphereGapM >= 0) expect(drawnSphereGapM, `safe target at tick ${frame.tick}`).toBeGreaterThanOrEqual(0);
      expect(cameraSphereGapM, `camera at tick ${frame.tick}`).toBeGreaterThanOrEqual(0);
      const exactRawEndpoint = [pose.x, pose.y, pose.z, pose.yaw, pose.pitch, pose.speed].every((value, i) => value === [frame.flight.x, frame.flight.y, frame.flight.z, frame.flight.yaw, frame.flight.pitch, frame.flight.speed][i]);
      let rawMass: number | null = null, drawnMass: number | null = null;
      if (frame.tick >= 692 && frame.tick <= 694) {
        const rawHit = nearestDrawnBox(boxes, frame.flight), drawnHit = nearestDrawnBox(boxes, pose);
        expect(rawHit.index).toBe(2793);
        expect(drawnHit.index).toBe(rawHit.index);
        expect(rawHit.gapM).toBeCloseTo(rawSphereGapM + CLEARANCE_SHUTTLE_RADIUS_M, 8);
        expect(drawnHit.gapM).toBeCloseTo(drawnSphereGapM + CLEARANCE_SHUTTLE_RADIUS_M, 8);
        expect(drawnSphereGapM).toBeGreaterThanOrEqual(rawSphereGapM);
        rawMass = rawHit.index; drawnMass = drawnHit.index;
      }
      if (frame.tick >= 695 && frame.tick <= 700) expect(exactRawEndpoint, `unchanged endpoint at tick ${frame.tick}`).toBe(true);
      rows.push({ tick: frame.tick, rawSphereGapM, targetSphereGapM, drawnSphereGapM, cameraSphereGapM, exactRawEndpoint, rawMass, drawnMass });
    }
    expect(rows.filter(row => row.rawSphereGapM < 0).map(row => row.tick)).toEqual(Array.from({ length: 19 }, (_, i) => 682 + i));
    expect(rows.filter(row => row.drawnSphereGapM < 0).map(row => row.tick)).toEqual(Array.from({ length: 9 }, (_, i) => 692 + i));
    expect(rows[694]!.rawSphereGapM).toBe(-13);
    expect(rows[694]!.drawnSphereGapM).toBe(-13);
    if (process.env.SKYRIVER_HANDOFF_CLEARANCE_OUT) writeFileSync(process.env.SKYRIVER_HANDOFF_CLEARANCE_OUT, JSON.stringify({ radii: { hull: CLEARANCE_SHUTTLE_RADIUS_M, camera: CLEARANCE_CAMERA_RADIUS_M }, inheritedRawViolations: 19, retainedDrawnViolations: 9, globalClearancePass: false, rows }, null, 2));
  });

  it.each([{ toggles: [600, 610, 620] }, { toggles: [600, 740, 750] }])('keeps the presented hull continuous at real toggles $toggles', ({ toggles }) => {
    const frames = realFrames(toggles), presenter = initializedPresenter(424242);
    const poses = frames.map(frame => { ingestModeEdge(presenter, frame); return { ...presenter.present(frame, 1) }; });
    for (const tick of toggles) {
      // A transition step can carry the current blend velocity. It cannot traverse the city in one frame.
      expect(gap(poses[tick - 2]!, poses[tick - 1]!), `tick ${tick}, trace ${toggles}`).toBeLessThan(100);
    }
  });

  it('recovers an observed rejoin pose after the rejoin completes and time seeks back', () => {
    const frames = realFrames([600, 740]), presenter = initializedPresenter(424242);
    const poses = frames.map(frame => { ingestModeEdge(presenter, frame); return { ...presenter.present(frame, 1) }; });
    const original = poses[759]!;
    const restored = { ...presenter.present(frames[759]!, 1) };
    expect(gap(original, restored), 'seek 850 to 760').toBeLessThan(1e-9);
    expect(restored).toEqual(original);
    // Repeated seeks must not consume the observed transition or move its origin.
    presenter.present(frames[849]!, 1);
    expect({ ...presenter.present(frames[759]!, 1) }).toEqual(original);
  });

  it('retains an observed rejoin across the preceding free-flight alpha-one boundary', () => {
    const frames = realFrames([600, 740]), presenter = initializedPresenter(424242);
    const poses = frames.map(frame => { ingestModeEdge(presenter, frame); return { ...presenter.present(frame, 1) }; });
    const original = poses[759]!;
    const frame = frames[738]!;
    const boundary = { ...frame, ...interpolateSkyriverFlight(frame.previous, frame.current, 1) };
    expect(boundary.flight.mode).toBe(1);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      presenter.present(boundary, 1);
      const restored = { ...presenter.present(frames[759]!, 1) };
      expect(gap(original, restored), `boundary seek attempt ${attempt}`).toBeLessThan(1e-9);
      expect(restored).toEqual(original);
      presenter.present(frames[849]!, 1);
    }
  });

  it('replaces observed mode edges when real replay removes those edges', () => {
    const frames = realFrames([600, 740]), changed = realFrames([]);
    const presenter = initializedPresenter(424242), fresh = initializedPresenter(424242);
    frames.forEach(frame => { ingestModeEdge(presenter, frame); presenter.present(frame, 1); });
    presenter.resetTimeline(2);
    const expected = changed.map(frame => ({ ...fresh.present(frame, 1) }));
    expect(changed[599]!.previous.flight.mode).toBe(0);
    expect(changed[599]!.current.flight.mode).toBe(0);
    for (let index = 589; index < changed.length; index += 1) {
      const actual = { ...presenter.present(changed[index]!, 2) };
      expect(actual, `changed timeline at tick ${index + 1}`).toEqual(expected[index]);
    }
    expect({ ...presenter.present(changed[759]!, 2) }).toEqual(expected[759]);
  });

  it('resets a replaced timeline directly inside an old rejoin without intermediate draws', () => {
    const frames = realFrames([600, 740]), changed = realFrames([]);
    const presenter = initializedPresenter(424242), fresh = initializedPresenter(424242);
    frames.forEach(frame => { ingestModeEdge(presenter, frame); presenter.present(frame, 1); });
    const expected = { ...fresh.present(changed[759]!, 1) };
    presenter.resetTimeline(2);
    expect({ ...presenter.present(changed[759]!, 2) }).toEqual(expected);
    expect({ ...presenter.present(changed[759]!, 2) }).toEqual(expected);
  });

  it('rejects stale timeline inputs before they can change the active journal', () => {
    const frames = realFrames([600, 740]), presenter = initializedPresenter(424242);
    frames.forEach(frame => { ingestModeEdge(presenter, frame); presenter.present(frame, 1); });
    presenter.resetTimeline(2);
    const expected = { ...presenter.present(frames[849]!, 2) };
    expect(() => presenter.present(frames[759]!, 1)).toThrow();
    expect(() => presenter.observeModeEdge(frames[739]!, 1)).toThrow();
    expect({ ...presenter.present(frames[849]!, 2) }).toEqual(expected);
  });

  it('keeps the rejoin wake near the drawn hull with short adjacent samples', () => {
    const frames = realFrames([600, 740]), presenter = initializedPresenter(424242);
    const wake = createWorldWakeSamples();
    for (const frame of frames) {
        ingestModeEdge(presenter, frame);
        const pose = { ...presenter.present(frame, 1) };
        if (frame.tick < 740 || frame.tick > 815) continue;
        expect(pose.mode).toBe(0);
        sampleWorldWake(pose, (frame.tick + frame.alpha) / 30, wake);
        const maximumDistance = 1.5 * wake.lengthM + CLEARANCE_SHUTTLE_RADIUS_M;
        const maximumStep = 8 * wake.lengthM / (SHUTTLE_WAKE_SAMPLE_COUNT - 1) + CLEARANCE_SHUTTLE_RADIUS_M;
        for (const a of [wake.leftCenters, wake.rightCenters]) {
          for (let i = 0; i < SHUTTLE_WAKE_SAMPLE_COUNT; i += 1) {
            const at = i * 3;
            expect(Math.hypot(a[at]! - pose.x, a[at + 1]! - pose.y, a[at + 2]! - pose.z), `wake distance at tick ${frame.tick}, sample ${i}`).toBeLessThan(maximumDistance);
            if (i > 0) expect(arrayStep(a, i), `wake step at tick ${frame.tick}, sample ${i}`).toBeLessThan(maximumStep);
          }
        }
    }
  });

  it('starts both rejoin wake ribbons at the actual drawn nozzle roots', () => {
    const frames = realFrames([600, 740]), presenter = initializedPresenter(424242);
    const wake = createWorldWakeSamples(), shuttle = createSkyriverShuttle(), hull = shuttle.objects[0]!;
    try {
      for (const frame of frames) {
        ingestModeEdge(presenter, frame);
        const pose = { ...presenter.present(frame, 1) };
        if (frame.tick < 740 || frame.tick > 815) continue;
        sampleWorldWake(pose, (frame.tick + frame.alpha) / 30, wake);
        shuttle.setPose(pose.x, pose.y, pose.z, pose.yaw, pose.pitch * SHUTTLE_DRAW_PITCH_SHARE, pose.roll);
        hull.updateMatrixWorld(true);
        for (let nozzle = 0; nozzle < 2; nozzle += 1) {
          const expected = new THREE.Vector3(...SHUTTLE_NOZZLE_ROOTS_LOCAL[nozzle]!).applyMatrix4(hull.matrixWorld);
          const actual = nozzle === 0 ? wake.leftCenters : wake.rightCenters;
          [expected.x, expected.y, expected.z].forEach((value, i) => expect(actual[i]).toBe(Math.fround(value)));
        }
      }
    } finally { shuttle.dispose(); }
  });
});
