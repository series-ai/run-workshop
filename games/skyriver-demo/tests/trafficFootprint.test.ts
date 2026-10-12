import { describe, expect, it } from 'vitest';
import { Mesh, PerspectiveCamera, ShaderMaterial, Vector3 } from 'three';
import {
  trafficApplyFootprint, trafficFootprintCovariance, trafficInverseFootprint,
  trafficProjectionFloor, trafficPsdRoot, trafficSpectralFloor,
  type TrafficProjectionVec2, type TrafficSymmetric2,
} from '../src/render/trafficProjection';
import { createSkyriverTraffic, TRAFFIC_QUALITY_TIERS } from '../src/render/traffic';
import { TRAFFIC_APPEARANCE_PROFILES } from '../src/render/trafficAppearance';
import { integrateTrafficLampKernel, projectTrafficLampKernel, type TrafficCameraProjection } from '../src/render/trafficAppearanceModel';

const angles = [0, 0.13, Math.PI / 4, Math.PI / 2, 2.3, Math.PI] as const;
const floorHalfCss = 0.65;
const blendShare = 0.2;

function rotate(p: TrafficProjectionVec2, angle: number): TrafficProjectionVec2 {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c * p[0] - s * p[1], s * p[0] + c * p[1]];
}

/** These matrices have specified principal values and a specified physical rotation. */
function knownMatrix(x: number, y: number, angle: number): TrafficSymmetric2 {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [x * c * c + y * s * s, (x - y) * c * s, x * s * s + y * c * c];
}

function matrixError(a: TrafficSymmetric2, b: TrafficSymmetric2): number {
  return Math.hypot(a[0] - b[0], Math.SQRT2 * (a[1] - b[1]), a[2] - b[2]);
}

function expectMatrix(actual: TrafficSymmetric2, expected: TrafficSymmetric2, limit = 1e-10): void {
  for (const value of actual) expect(Number.isFinite(value)).toBe(true);
  const reference = Math.max(Math.hypot(expected[0], Math.SQRT2 * expected[1], expected[2]), 1e-30);
  expect(matrixError(actual, expected) / reference).toBeLessThanOrEqual(limit);
}

/** Integrate the declared floor derivative: zero, a linear ramp, then one. */
function declaredFloor(size: number): number {
  const start = floorHalfCss * (1 - blendShare);
  const end = floorHalfCss * (1 + blendShare);
  if (size <= start) return floorHalfCss;
  if (size >= end) return size;
  return floorHalfCss + (size - start) ** 2 / (2 * (end - start));
}

describe('R44 physical covariance and principal footprint', () => {
  it('keeps the covariance of independently rotated physical tangent columns', () => {
    for (const angle of angles) {
      const right = rotate([3, 0], angle), up = rotate([0, 4], angle);
      expectMatrix(trafficFootprintCovariance(right, up), knownMatrix(9, 16, angle));
      expectMatrix(trafficPsdRoot(trafficFootprintCovariance(right, up)), knownMatrix(3, 4, angle));
    }
    expectMatrix(trafficFootprintCovariance([3, 4], [1, -2]), [10, 10, 20]);
    expectMatrix(trafficPsdRoot([10, 6, 10]), [3, 1, 3]);
  });

  it('has exact zero and known rank-one limits without a selected direction', () => {
    expect(trafficPsdRoot([0, 0, 0])).toEqual([0, 0, 0]);
    expectMatrix(trafficPsdRoot([9, 12, 16]), [1.8, 2.4, 3.2]);
    for (const angle of angles) {
      for (const magnitude of [1e-10, 0.5, 2, 1e10]) {
        expectMatrix(trafficPsdRoot(knownMatrix(magnitude ** 2, 0, angle)),
          knownMatrix(magnitude, 0, angle), 3e-8);
      }
    }
  });

  it('returns the given principal solution for rotated full-rank and equal-rank inputs', () => {
    for (const angle of angles) {
      for (const scale of [1e-10, 1, 1e10]) {
        for (const ratio of [0.25, 0.99999999, 1, 1.00000001, 4]) {
          expectMatrix(trafficPsdRoot(knownMatrix(scale ** 2, (scale * ratio) ** 2, angle)),
            knownMatrix(scale, scale * ratio, angle));
        }
      }
    }
  });

  it('retains physical support lengths in independent test directions', () => {
    const right: TrafficProjectionVec2 = [3, 1], up: TrafficProjectionVec2 = [-2, 4];
    const root = trafficPsdRoot(trafficFootprintCovariance(right, up));
    for (const angle of angles) {
      const n: TrafficProjectionVec2 = [Math.cos(angle), Math.sin(angle)];
      const expected = Math.hypot(n[0] * right[0] + n[1] * right[1], n[0] * up[0] + n[1] * up[1]);
      expect(Math.hypot(...trafficApplyFootprint(root, n))).toBeCloseTo(expected, 11);
    }
  });

  it('is continuous through physical rank loss and rejects the old axis fallback control', () => {
    const limit = trafficSpectralFloor([0, 0, 2], floorHalfCss, blendShare);
    for (const epsilon of [1e-2, 1e-4, 1e-6, 1e-8, 1e-10]) {
      for (const sign of [-1, 1]) {
        const root = trafficPsdRoot(trafficFootprintCovariance([sign * epsilon, sign * epsilon], [0, 2]));
        const actual = trafficSpectralFloor(root, floorHalfCss, blendShare);
        expect(matrixError(actual, limit)).toBeLessThanOrEqual(3 * epsilon + 1e-12);
      }
    }
    // The old selected-axis height changes at the 1e-5 projected-axis boundary.
    const oldHeight = (e: number): number => Math.hypot(e, e) > 1e-5 ? Math.SQRT2 : 2;
    expect(Math.abs(oldHeight(1e-5) - oldHeight(1e-6))).toBeGreaterThan(0.5);
  });
});

describe('R44 spectral floor limits', () => {
  it('keeps the original floor and its five percent maximum growth', () => {
    for (let step = 0; step <= 1000; step++) {
      const size = step * 0.002;
      const actual = trafficProjectionFloor(size, floorHalfCss, blendShare);
      expect(actual).toBeCloseTo(declaredFloor(size), 13);
      expect(actual).toBeGreaterThanOrEqual(Math.max(size, floorHalfCss));
      expect(actual / Math.max(size, floorHalfCss)).toBeLessThanOrEqual(1.05 + 1e-12);
    }
    expect(trafficProjectionFloor(floorHalfCss, floorHalfCss, blendShare)).toBeCloseTo(1.05 * floorHalfCss, 13);
  });

  it('applies the declared principal limits at rank zero, one and equal values', () => {
    for (const angle of angles) {
      for (const x of [0, 0.52, 0.65, 0.78, 2]) {
        for (const y of [0, 0.52, 0.65, 0.78, 2]) {
          expectMatrix(trafficSpectralFloor(knownMatrix(x, y, angle), floorHalfCss, blendShare),
            knownMatrix(declaredFloor(x), declaredFloor(y), angle));
        }
      }
    }
    expectMatrix(trafficSpectralFloor([0, 0, 0], floorHalfCss, blendShare), [floorHalfCss, 0, floorHalfCss]);
  });

  it('keeps equal-value derivatives continuous across both principal orders', () => {
    for (const mean of [0.52, 0.6, 0.65, 0.7, 0.78]) {
      for (const delta of [1e-4, 1e-7, 1e-10, 1e-13]) {
        for (const angle of angles) {
          const actual = trafficSpectralFloor(knownMatrix(mean + delta, mean - delta, angle), floorHalfCss, blendShare);
          expectMatrix(actual, knownMatrix(declaredFloor(mean + delta), declaredFloor(mean - delta), angle));
        }
      }
    }
    const h = 1e-5;
    const slope = (trafficProjectionFloor(floorHalfCss + h, floorHalfCss, blendShare)
      - trafficProjectionFloor(floorHalfCss - h, floorHalfCss, blendShare)) / (2 * h);
    expect(slope).toBeCloseTo(0.5, 10);
  });

  it('uses the same CSS footprint at DPR 1, 1.25 and 1.5', () => {
    for (const dpr of [1, 1.25, 1.5]) {
      const css = trafficSpectralFloor(knownMatrix(0.2, 3, 0.73), floorHalfCss, blendShare);
      const buffer = trafficSpectralFloor(knownMatrix(0.2 * dpr, 3 * dpr, 0.73), floorHalfCss * dpr, blendShare);
      expectMatrix([buffer[0] / dpr, buffer[1] / dpr, buffer[2] / dpr], css);
    }
  });

  it('recovers specified source coordinates from finite floored footprints', () => {
    for (const angle of angles) {
      const footprint = trafficSpectralFloor(knownMatrix(0, 3, angle), floorHalfCss, blendShare);
      const inverse = trafficInverseFootprint(footprint);
      for (const source of [[-1, -1], [1, 1], [0.25, -0.75], [0, 0]] as const) {
        const recovered = trafficApplyFootprint(inverse, trafficApplyFootprint(footprint, source));
        expect(recovered[0]).toBeCloseTo(source[0], 11);
        expect(recovered[1]).toBeCloseTo(source[1], 11);
      }
    }
  });
});

describe('R44 native material source integration', () => {
  it('binds the matrix footprint to both real traffic material vertex sources', () => {
    const traffic = createSkyriverTraffic({ seed: 424242, quality: TRAFFIC_QUALITY_TIERS.low, maxImpostors: 8 });
    try {
      for (const name of ['skyriver.traffic.streaks', 'skyriver.traffic.impostors']) {
        const object = traffic.objects.find(candidate => candidate.name === name);
        expect(object).toBeInstanceOf(Mesh);
        if (!(object instanceof Mesh) || !(object.material instanceof ShaderMaterial)) throw new Error('R44_NATIVE_MATERIAL_MISSING');
        const source = object.material.vertexShader;
        expect(source.match(/trafficPsdRoot\s*\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(source.match(/trafficSpectralFloor\s*\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
      }
    } finally {
      traffic.dispose();
    }
  });
});

describe('R44 matrix-only physical camera integration', () => {
  function cameraInput(camera: PerspectiveCamera, dpr: number): TrafficCameraProjection {
    camera.updateMatrixWorld(true);
    return {
      position: [camera.position.x, camera.position.y, camera.position.z],
      viewMatrix: camera.matrixWorldInverse.elements, projectionMatrix: camera.projectionMatrix.elements,
      cssWidthPx: 1280, cssHeightPx: 720, bufferWidthPx: 1280 * dpr, bufferHeightPx: 720 * dpr,
      pixelAngleCss: 2 / (720 * camera.projectionMatrix.elements[5]!),
      pixelAngleBuffer: 2 / (720 * dpr * camera.projectionMatrix.elements[5]!),
    };
  }

  it('keeps finite source energy at and across the exact eye plane', () => {
    const camera = new PerspectiveCamera(62, 1280 / 720, 1, 10000);
    const cameraFrame = cameraInput(camera, 1.25);
    for (const [typeIndex, profile] of TRAFFIC_APPEARANCE_PROFILES.entries()) {
      for (const side of ['head', 'tail'] as const) {
        const patch = side === 'head' ? profile.front : profile.rear;
        for (const depth of [-1e-8, 0, 1e-8]) {
          const projected = projectTrafficLampKernel({ typeIndex, side, physicalScale: 2,
            position: [0, -patch.yM * 2, -patch.zM * 2 - depth], direction: [0, 0, 1],
            bankRadians: 0, camera: cameraFrame });
          const energy = integrateTrafficLampKernel(projected);
          expect(Number.isFinite(energy.bodyKernelCssPx2)).toBe(true);
          expect(Number.isFinite(energy.coreKernelCssPx2)).toBe(true);
          expect(energy.bodyKernelCssPx2).toBeGreaterThan(0);
        }
      }
    }
  });

  it('retains finite floored footprints through actual steep, pole, bank and off-axis cameras', () => {
    for (const dpr of [1, 1.25, 1.5]) {
      for (const elevation of [-90, -80, -55, 55, 80, 90]) {
        for (const bank of [0, Math.PI / 4, Math.PI / 2]) {
          const angle = elevation * Math.PI / 180;
          const camera = new PerspectiveCamera(62, 1280 / 720, 1, 10000);
          camera.position.set(150 * Math.cos(angle), 150 * Math.sin(angle), 30);
          camera.lookAt(new Vector3(17, 3, -8));
          camera.projectionMatrix.elements[8] = 0.24;
          camera.projectionMatrix.elements[9] = -0.13;
          const cameraFrame = cameraInput(camera, dpr);
          for (let typeIndex = 0; typeIndex < TRAFFIC_APPEARANCE_PROFILES.length; typeIndex++) {
            for (const side of ['head', 'tail'] as const) {
              const projected = projectTrafficLampKernel({ typeIndex, side, physicalScale: 2,
                position: [17, 3, -8], direction: [0, 0, 1], bankRadians: bank, camera: cameraFrame });
              for (const value of [...projected.footprintView, ...projected.inverseFootprintView,
                ...projected.pairOffsetUv, ...projected.filterHalfSizeCssPx]) expect(Number.isFinite(value)).toBe(true);
              const scale = Math.max(-projected.centerView[2], 1) * cameraFrame.pixelAngleCss;
              const [xx, xy, yy] = projected.footprintView;
              const low = (xx + yy) / 2 - Math.hypot((xx - yy) / 2, xy);
              expect(low / scale).toBeGreaterThanOrEqual(floorHalfCss - 1e-10);
              const profile = TRAFFIC_APPEARANCE_PROFILES[typeIndex]!;
              const patch = side === 'head' ? profile.front : profile.rear;
              const right = new Vector3(Math.cos(bank), Math.sin(bank), 0);
              const up = new Vector3(-Math.sin(bank), Math.cos(bank), 0);
              const center = new Vector3(17, 3, -8).addScaledVector(up, patch.yM * 2);
              center.z += patch.zM * 2;
              const finiteTangent = (direction: Vector3): TrafficProjectionVec2 => {
                const h = 1e-3;
                const a = center.clone().addScaledVector(direction, -h).project(camera);
                const b = center.clone().addScaledVector(direction, h).project(camera);
                return [(b.x - a.x) * 1280 / (4 * h), (b.y - a.y) * 720 / (4 * h)];
              };
              const rx = finiteTangent(right), uy = finiteTangent(up);
              const halfWidth = patch.kind === 'pair' ? patch.widthM : patch.widthM / 2;
              const halfHeight = patch.heightM;
              const physicalRight: TrafficProjectionVec2 = [rx[0] * halfWidth, rx[1] * halfWidth];
              const physicalUp: TrafficProjectionVec2 = [uy[0] * halfHeight, uy[1] * halfHeight];
              const source: TrafficSymmetric2 = [projected.sourceFootprintView[0] / scale,
                projected.sourceFootprintView[1] / scale, projected.sourceFootprintView[2] / scale];
              for (const testAngle of angles) {
                const n: TrafficProjectionVec2 = [Math.cos(testAngle), Math.sin(testAngle)];
                const actual = Math.hypot(...trafficApplyFootprint(source, n));
                const expected = Math.hypot(n[0] * physicalRight[0] + n[1] * physicalRight[1],
                  n[0] * physicalUp[0] + n[1] * physicalUp[1]);
                expect(Math.abs(actual - expected) / Math.max(expected, 1e-6)).toBeLessThanOrEqual(1e-6);
              }
              const pairHalfWidth = (patch.kind === 'pair' ? patch.centreXM : patch.widthM / 4) * 2;
              const pair = trafficApplyFootprint(projected.footprintView, projected.pairOffsetUv);
              expect(pair[0] / scale).toBeCloseTo(rx[0] * pairHalfWidth, 7);
              expect(pair[1] / scale).toBeCloseTo(rx[1] * pairHalfWidth, 7);
              const energy = integrateTrafficLampKernel(projected);
              expect(Number.isFinite(energy.bodyKernelCssPx2)).toBe(true);
              const a = physicalRight[0] ** 2 + physicalUp[0] ** 2;
              const b = physicalRight[0] * physicalRight[1] + physicalUp[0] * physicalUp[1];
              const c = physicalRight[1] ** 2 + physicalUp[1] ** 2;
              const radius = Math.hypot((a - c) / 2, b);
              const highSource = Math.sqrt(Math.max((a + c) / 2 + radius, 0));
              const lowSource = Math.sqrt(Math.max((a + c) / 2 - radius, 0));
              const expectedFloor = knownMatrix(declaredFloor(highSource), declaredFloor(lowSource), Math.atan2(2 * b, a - c) / 2);
              expectMatrix([xx / scale, xy / scale, yy / scale], expectedFloor, 1e-6);
              const expectedArea = declaredFloor(highSource) * declaredFloor(lowSource) * (16 / 15) ** 2;
              expect(Math.abs(energy.bodyKernelCssPx2 - expectedArea) / expectedArea).toBeLessThanOrEqual(1e-6);
            }
          }
        }
      }
    }
  });
});
