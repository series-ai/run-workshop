import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { advanceState, createInitialState, createSkyriverSimConfig, CHASM_BOUNDS } from '../src/sim/systems';
import { quantizeAxis, SKYRIVER_NEUTRAL_INPUT, type SkyriverInput } from '../src/sim/input';
import { projectSkyriverState } from '../src/sim/runtime';
import { interpolateSkyriverFlight, type SkyriverRenderState } from '../src/sim/session';
import { createFlightPresenter } from '../src/render/flightPresentation';
import { createCameraPoseScratch, writeCameraPose, CHASE_MIN_ALTITUDE_M } from '../src/render/cameraRig';
import { indexedDrawnBoxes, nearestDrawnBox } from './support/drawnMassOracle';

describe('R29b independent real-input free-flight bounds', () => {
  it.each([424242, 0, 2147483647, 4294967295])('keeps the hull and actual rig clear at lower and lateral bounds for seed%s', seed => {
    const boxes = indexedDrawnBoxes(seed), touched = new Set<string>(), observedModeEdges = new Set<number>(), records = [];
    let minHullGapM = Infinity, minCameraGapM = Infinity, maxBoomM = 0, maxOrbitPitch = 0, maxOrbitYaw = 0, samples = 0;
    for (const direction of [-1, 1]) {
      const config = createSkyriverSimConfig(seed, 'autopilot'), presenter = createFlightPresenter(seed), camera = createCameraPoseScratch();
      presenter.resetTimeline(1);
      let previous = createInitialState(config);
      const states = [previous], inputs: SkyriverInput[] = [], modeEdges: number[] = [];
      for (let tick = 1; tick <= 720; tick += 1) {
        const yawGoal = direction * (tick < 550 ? 0.25 : -0.25), yawDelta = yawGoal - previous.flight.yaw;
        const wrappedYaw = yawDelta - Math.round(yawDelta);
        const input: SkyriverInput = tick <= 62
          ? { ...SKYRIVER_NEUTRAL_INPUT, throttle: 1, yawRate: direction, pitchRate: 1 }
          : tick >= 620
            ? { ...SKYRIVER_NEUTRAL_INPUT, modeToggle: tick === 630 }
            : { throttle: 1, yawRate: quantizeAxis(wrappedYaw / 0.004), pitchRate: quantizeAxis(((tick < 550 ? -0.15 : 0.15) - previous.flight.pitch) / 0.002), boost: tick <= 600, modeToggle: tick === 63 };
        const current = advanceState(previous, [input], config);
        inputs.push(input); states.push(current);
        const p = projectSkyriverState(previous, null), c = projectSkyriverState(current, previous);
        const frame: SkyriverRenderState = { tick: c.tick, previous: p, current: c, ...interpolateSkyriverFlight(p, c, 0.5), localSlot: 0, status: 'offline' };
        const modeChanged = p.flight.mode !== c.flight.mode;
        if (modeChanged) {
          modeEdges.push(c.tick); observedModeEdges.add(c.tick);
          presenter.observeModeEdge(frame, 1);
        }
        const pose = { ...presenter.present(frame, 1) };
        writeCameraPose(camera, pose, frame.camera, { boost: pose.boostVisual, time: (c.tick + frame.alpha) / 30 });
        const hull = nearestDrawnBox(boxes, pose), rig = nearestDrawnBox(boxes, camera.position);
        minHullGapM = Math.min(minHullGapM, hull.gapM - 14); minCameraGapM = Math.min(minCameraGapM, rig.gapM - 8);
        maxBoomM = Math.max(maxBoomM, camera.distance); maxOrbitPitch = Math.max(maxOrbitPitch, Math.abs(frame.camera.orbitPitch)); maxOrbitYaw = Math.max(maxOrbitYaw, Math.abs(frame.camera.orbitYaw)); samples += 1;
        expect(hull.gapM - 14, `seed${seed} direction${direction} drawn hull tick${tick} mass${hull.index}`).toBeGreaterThanOrEqual(0);
        expect(rig.gapM - 8, `seed${seed} direction${direction} rig tick${tick} mass${rig.index}`).toBeGreaterThanOrEqual(0);
        if (current.flight.mode === 1) {
          const raw = nearestDrawnBox(boxes, frame.flight);
          expect(raw.gapM - 14, `raw free-flight hull tick${tick}`).toBeGreaterThanOrEqual(0);
          for (const [key, value] of [['minX', current.flight.x], ['maxX', current.flight.x], ['minY', current.flight.y]] as const) if (Math.abs(value - CHASM_BOUNDS[key]) < 1e-5) touched.add(key);
        }
        if (modeChanged || tick === 720 || current.flight.y === CHASM_BOUNDS.minY) records.push({ direction, tick, flight: frame.flight, camera: { ...camera, position: { ...camera.position }, target: { ...camera.target } }, hullSphereGapM: hull.gapM - 14, cameraSphereGapM: rig.gapM - 8 });
        previous = current;
      }
      expect(modeEdges).toEqual([63, 630]);
      let restored = states[500]!;
      for (let tick = 501; tick <= 720; tick += 1) { restored = advanceState(restored, [inputs[tick - 1]!], config); expect(restored, `real sim replay tick${tick}`).toEqual(states[tick]); }
    }
    expect(touched).toEqual(new Set(['minX', 'maxX', 'minY']));
    expect(maxBoomM).toBeGreaterThan(32);
    expect(maxOrbitPitch).toBeCloseTo(0.2, 6);
    expect(maxOrbitYaw).toBeGreaterThanOrEqual(0.29);
    if (process.env.SKYRIVER_FREE_BOUNDS_OUT) writeFileSync(`${process.env.SKYRIVER_FREE_BOUNDS_OUT}-${seed}.json`, JSON.stringify({ seed, bounds: CHASM_BOUNDS, cameraMinimumAltitudeM: CHASE_MIN_ALTITUDE_M, hullRadiusM: 14, cameraRadiusM: 8, samples, touched: [...touched], minHullGapM, minCameraGapM, maxBoomM, maxOrbitPitch, maxOrbitYaw, realReplaySteps: 440, modeEdges: [...observedModeEdges], scope: 'Two actual input traces. All720 frames each. Full drawn boxes. No proxy camera or inherited exemption.', records }, null, 2));
  }, 60_000);
});
