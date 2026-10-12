import { describe, expect, it } from 'vitest';
import { Frustum, Mesh, PerspectiveCamera, ShaderMaterial, Vector3, Vector4 } from 'three';
import {
  trafficClipKernelFraction, trafficClipPolygon, trafficClipSegment, trafficProjectionNear, trafficProjectClippedVertex,
  type TrafficClipVertex,
} from '../src/render/trafficProjection';
import { evaluateSameCarTrafficAppearance, projectTrafficLampKernel,
  type SameCarTrafficAppearanceInput, type TrafficCameraProjection } from '../src/render/trafficAppearanceModel';
import { createSkyriverTraffic, TRAFFIC_QUALITY_TIERS } from '../src/render/traffic';
import { lampSupportCss } from './support/flyerContinuityMatrix';

function vertex(x: number, y: number, z: number, u: number, v: number): TrafficClipVertex {
  return { view: [x, y, z, 1], kernel: [u, v] };
}

function expectVertex(actual: TrafficClipVertex, expected: TrafficClipVertex): void {
  for (let index = 0; index < 4; index++) expect(actual.view[index]).toBeCloseTo(expected.view[index]!, 12);
  for (let index = 0; index < 2; index++) expect(actual.kernel[index]).toBeCloseTo(expected.kernel[index]!, 12);
}

const nearPlane = [0, 0, -1, -1] as const;
const eyePlane = [0, 0, -1, 0] as const;

function cameraFrame(camera: PerspectiveCamera): TrafficCameraProjection {
  camera.updateMatrixWorld(true);
  return { position: [camera.position.x, camera.position.y, camera.position.z],
    viewMatrix: camera.matrixWorldInverse.elements, projectionMatrix: camera.projectionMatrix.elements,
    cssWidthPx: 1280, cssHeightPx: 720, bufferWidthPx: 1600, bufferHeightPx: 900,
    pixelAngleCss: 2 / (720 * camera.projectionMatrix.elements[5]!),
    pixelAngleBuffer: 2 / (900 * camera.projectionMatrix.elements[5]!) };
}

describe('R44 physical clipping before perspective division', () => {
  it('cuts the physical near-plane segment at its declared t=0.2 in both orders', () => {
    const outside = vertex(-2, 1, -0.5, -1, 0.25);
    const inside = vertex(4, 3, -3, 1, 0.75);
    const cut = vertex(-0.8, 1.4, -1, -0.6, 0.35);
    const forward = trafficClipSegment(outside, inside, nearPlane);
    const reverse = trafficClipSegment(inside, outside, nearPlane);
    expect(forward).not.toBeNull();
    expect(reverse).not.toBeNull();
    if (!forward || !reverse) throw new Error('R44_NEAR_CUT_MISSING');
    expectVertex(forward[0], cut);
    expectVertex(forward[1], inside);
    expectVertex(reverse[0], inside);
    expectVertex(reverse[1], cut);
    expect(outside).toEqual(vertex(-2, 1, -0.5, -1, 0.25));
    expect(inside).toEqual(vertex(4, 3, -3, 1, 0.75));
  });

  it('retains exact contact and rejects both-behind segments without moving their anchors', () => {
    const contact = vertex(7, -4, -1, 0.3, -0.2);
    const inside = vertex(2, 1, -3, 1, 1);
    for (const pair of [[contact, inside], [inside, contact]] as const) {
      const clipped = trafficClipSegment(pair[0], pair[1], nearPlane);
      expect(clipped).not.toBeNull();
      if (!clipped) throw new Error('R44_EXACT_CONTACT_REJECTED');
      expectVertex(clipped[0], pair[0]);
      expectVertex(clipped[1], pair[1]);
    }
    const a = vertex(0, 0, -0.5, -1, -1), b = vertex(1, 2, 3, 1, 1);
    expect(trafficClipSegment(a, b, nearPlane)).toBeNull();
    expect(trafficClipSegment(b, a, nearPlane)).toBeNull();
    expect(trafficClipSegment(vertex(0, 0, 1, -1, -1), vertex(1, 1, 2, 1, 1), eyePlane)).toBeNull();
  });

  it('keeps an exact eye-plane cut unprojected and clips again at the actual near plane', () => {
    const outside = vertex(0, 1, 0.5, -1, 0);
    const inside = vertex(2, 3, -2.5, 1, 1);
    const eyeCut = trafficClipSegment(outside, inside, eyePlane);
    expect(eyeCut).not.toBeNull();
    if (!eyeCut) throw new Error('R44_EYE_CUT_MISSING');
    expectVertex(eyeCut[0], vertex(1 / 3, 4 / 3, 0, -2 / 3, 1 / 6));
    const camera = new PerspectiveCamera(90, 1, 1, 1000);
    expect(trafficProjectClippedVertex(eyeCut[0], camera.projectionMatrix.elements)).toBeNull();
    const nearCut = trafficClipSegment(eyeCut[0], eyeCut[1], nearPlane);
    expect(nearCut).not.toBeNull();
    if (!nearCut) throw new Error('R44_NEAR_AFTER_EYE_MISSING');
    expectVertex(nearCut[0], vertex(1, 2, -1, 0, 0.5));
    expect(trafficProjectClippedVertex(nearCut[0], camera.projectionMatrix.elements)).not.toBeNull();
  });

  it('preserves the original polygon kernel subrange instead of stretching the visible part', () => {
    const original = [vertex(-2, -2, -0.5, -1, -1), vertex(2, -2, -2.5, 1, -1),
      vertex(2, 2, -2.5, 1, 1), vertex(-2, 2, -0.5, -1, 1)];
    const clipped = trafficClipPolygon(original, [nearPlane]);
    expect(clipped).toHaveLength(4);
    const expected = [vertex(-1, -2, -1, -0.5, -1), original[1]!, original[2]!, vertex(-1, 2, -1, -0.5, 1)];
    for (const point of expected) {
      const match = clipped.find(candidate => Math.abs(candidate.view[0] - point.view[0]) < 1e-12
        && Math.abs(candidate.view[1] - point.view[1]) < 1e-12);
      expect(match).toBeDefined();
      if (!match) throw new Error('R44_ORIGINAL_KERNEL_CUT_MISSING');
      expectVertex(match, point);
    }
    expect(Math.min(...clipped.map(point => point.kernel[0]))).toBe(-0.5);
    expect(Math.max(...clipped.map(point => point.kernel[0]))).toBe(1);
    const renormalizedFault = clipped.map(point => ({ ...point,
      kernel: [(point.kernel[0] + 0.5) / 1.5 * 2 - 1, point.kernel[1]] as const }));
    expect(renormalizedFault.some((point, index) => Math.abs(point.kernel[0] - clipped[index]!.kernel[0]) > 0.1)).toBe(true);
  });

  it('projects the original unequal-depth anchors and clips screen edges in homogeneous space', () => {
    const camera = new PerspectiveCamera(90, 1, 1, 1000);
    const leftPlane = [1, 0, -1, 0] as const;
    const outside = vertex(-4, 0, -1, -1, 0), inside = vertex(2, 0, -4, 1, 0);
    for (const pair of [[outside, inside], [inside, outside]] as const) {
      const clipped = trafficClipSegment(pair[0], pair[1], leftPlane);
      expect(clipped).not.toBeNull();
      if (!clipped) throw new Error('R44_HOMOGENEOUS_SCREEN_CUT_MISSING');
      const cut = clipped.find(point => Math.abs(point.view[0] + 2) < 1e-12);
      expect(cut).toBeDefined();
      if (!cut) throw new Error('R44_UNEQUAL_DEPTH_CUT_MISSING');
      expectVertex(cut, vertex(-2, 0, -2, -1 / 3, 0));
      const expectedClip = new Vector4(...cut.view).applyMatrix4(camera.projectionMatrix);
      expect(expectedClip.x / expectedClip.w).toBeCloseTo(-1, 12);
      const projected = trafficProjectClippedVertex(cut, camera.projectionMatrix.elements);
      expect(projected).not.toBeNull();
      if (!projected) throw new Error('R44_VISIBLE_CUT_NOT_PROJECTED');
      expect(projected.kernel).toEqual(cut.kernel);
      for (const [index, value] of expectedClip.toArray().entries()) expect(projected.clip[index]).toBeCloseTo(value, 12);
      expect(projected.ndc[0]).toBeCloseTo(expectedClip.x / expectedClip.w, 12);
      expect(projected.ndc[1]).toBeCloseTo(expectedClip.y / expectedClip.w, 12);
      expect(projected.ndc[2]).toBeCloseTo(expectedClip.z / expectedClip.w, 12);
    }
  });

  it('uses the real projection near plane at different focal lengths and zoom values', () => {
    for (const fov of [30, 62, 115]) for (const near of [0.1, 1, 5]) for (const zoom of [0.5, 1, 4]) {
      const camera = new PerspectiveCamera(fov, 1280 / 720, near, 10000);
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
      camera.projectionMatrix.elements[8] = 0.24;
      camera.projectionMatrix.elements[9] = -0.13;
      expect(trafficProjectionNear(camera.projectionMatrix.elements)).toBeCloseTo(near, 12);
      const cut = trafficClipSegment(vertex(0, 0, near, -1, -1), vertex(0, 0, -3 * near, 1, 1),
        [0, 0, -1, -near]);
      expect(cut).not.toBeNull();
      if (!cut) throw new Error('R44_REAL_NEAR_CUT_MISSING');
      expectVertex(cut[0], vertex(0, 0, -near, 0, 0));
      const clip = new Vector4(...cut[0].view).applyMatrix4(camera.projectionMatrix);
      expect(clip.z / clip.w).toBeCloseTo(-1, 12);
    }
  });

  it('keeps the original one-corner and three-corner physical polygon cuts', () => {
    const oneOutside = [vertex(-2, -2, 0.5, -1, -1), vertex(2, -2, -1.5, 1, -1),
      vertex(2, 2, -3.5, 1, 1), vertex(-2, 2, -1.5, -1, 1)];
    const threeOutside = [vertex(-2, -2, 0.5, -1, -1), vertex(2, -2, -0.5, 1, -1),
      vertex(2, 2, -1.5, 1, 1), vertex(-2, 2, -0.5, -1, 1)];
    const cases = [
      { original: oneOutside, expected: [vertex(-2, 1, -1, -1, 0.5), vertex(1, -2, -1, 0.5, -1),
        oneOutside[1]!, oneOutside[2]!, oneOutside[3]!] },
      { original: threeOutside, expected: [vertex(2, 0, -1, 1, 0), threeOutside[2]!, vertex(0, 2, -1, 0, 1)] },
    ];
    for (const { original, expected } of cases) {
      for (const order of [original, [...original].reverse()]) {
        const actual = trafficClipPolygon(order, [nearPlane]);
        expect(actual).toHaveLength(expected.length);
        for (const point of expected) {
          const match = actual.find(candidate => Math.abs(candidate.view[0] - point.view[0]) < 1e-12
            && Math.abs(candidate.view[1] - point.view[1]) < 1e-12);
          expect(match).toBeDefined();
          if (!match) throw new Error('R44_PHYSICAL_CORNER_CUT_MISSING');
          expectVertex(match, point);
        }
      }
    }
    expect(trafficClipPolygon(oneOutside.map(point => ({ ...point,
      view: [point.view[0], point.view[1], 1, 1] as const })), [nearPlane, eyePlane])).toEqual([]);
  });

  it('bounds a large eye-crossing patch with real homogeneous camera planes before division', () => {
    for (const near of [0.1, 1, 5]) {
      const camera = new PerspectiveCamera(115, 1280 / 720, near, 10000);
      camera.zoom = 4;
      camera.updateProjectionMatrix();
      camera.projectionMatrix.elements[8] = 0.24;
      camera.projectionMatrix.elements[9] = -0.13;
      const planes = new Frustum().setFromProjectionMatrix(camera.projectionMatrix).planes
        .map(plane => [plane.normal.x, plane.normal.y, plane.normal.z, plane.constant] as const);
      const original = [vertex(-1000, -1000, 10, -1, -1), vertex(1000, -1000, -20, 1, -1),
        vertex(1000, 1000, -20, 1, 1), vertex(-1000, 1000, 10, -1, 1)];
      const clipped = trafficClipPolygon(original, [eyePlane, ...planes]);
      expect(clipped.length).toBeGreaterThanOrEqual(3);
      for (const point of clipped) {
        const projected = trafficProjectClippedVertex(point, camera.projectionMatrix.elements);
        expect(projected).not.toBeNull();
        if (!projected) throw new Error('R44_CLIPPED_FINITE_PATCH_MISSING');
        for (const value of projected.ndc) {
          expect(Number.isFinite(value)).toBe(true);
          expect(Math.abs(value)).toBeLessThanOrEqual(1 + 1e-12);
        }
        for (const value of point.kernel) expect(Math.abs(value)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('R44 group-bound halo limit at a physical corner contact', () => {
  it('has the known one-eighth triangle fraction and zero point or line fraction in original UV', () => {
    const full = [vertex(-10, -20, -3, -1, -1), vertex(10, -20, -3, 1, -1),
      vertex(10, 20, -3, 1, 1), vertex(-10, 20, -3, -1, 1)];
    const triangle = [vertex(9, 8, -4, 1, 0), vertex(7, 6, -2, 1, 1), vertex(5, 4, -1, 0, 1)];
    expect(trafficClipKernelFraction(full)).toBe(1);
    expect(trafficClipKernelFraction([...full].reverse())).toBe(1);
    expect(trafficClipKernelFraction(triangle)).toBe(1 / 8);
    expect(trafficClipKernelFraction([...triangle].reverse())).toBe(1 / 8);
    expect(trafficClipKernelFraction([])).toBe(0);
    expect(trafficClipKernelFraction([triangle[0]!])).toBe(0);
    expect(trafficClipKernelFraction([vertex(0, 0, -1, -1, 0), vertex(1, 0, -1, 0, 0),
      vertex(2, 0, -1, 1, 0)])).toBe(0);
  });

  it('keeps each physical anchor cut in its original kernel coordinates', () => {
    const nx = 0.1 / 1.62, ny = 0.1 / 0.3;
    const normal = new Vector3(nx, ny, Math.sqrt(1 - nx * nx - ny * ny));
    const camera = new PerspectiveCamera(62, 1280 / 720, 1, 10000);
    camera.lookAt(normal.clone().negate());
    const frame = cameraFrame(camera);
    const offset = 0.015;
    const group = normal.clone().multiplyScalar(-1 + offset);
    const projected = projectTrafficLampKernel({ typeIndex: 0, side: 'head', physicalScale: 2,
      position: [group.x, group.y + 0.08, group.z - 5.22], direction: [0, 0, 1], bankRadians: 0, camera: frame });
    const rows = [
      { segment: projected.sourceAnchorSegments.right, axis: new Vector3(1, 0, 0), half: 0.5, slope: nx, kernelAxis: 0 },
      { segment: projected.sourceAnchorSegments.up, axis: new Vector3(0, 1, 0), half: 0.3, slope: ny, kernelAxis: 1 },
      { segment: projected.sourceAnchorSegments.pair, axis: new Vector3(1, 0, 0), half: 1.12, slope: nx, kernelAxis: 0 },
    ];
    for (const { segment, axis, half, slope, kernelAxis } of rows) {
      expect(segment).not.toBeNull();
      if (!segment) throw new Error('R44_PHYSICAL_SEGMENT_CUT_MISSING');
      const cutCoordinate = -offset / (slope * half);
      const first = group.clone().addScaledVector(axis, -half).applyMatrix4(camera.matrixWorldInverse);
      const cut = group.clone().addScaledVector(axis, half * cutCoordinate).applyMatrix4(camera.matrixWorldInverse);
      expectVertex(segment[0], { view: [first.x, first.y, first.z, 1],
        kernel: kernelAxis === 0 ? [-1, 0] : [0, -1] });
      expectVertex(segment[1], { view: [cut.x, cut.y, cut.z, 1],
        kernel: kernelAxis === 0 ? [cutCoordinate, 0] : [0, cutCoordinate] });
      expect(segment[1].view[2]).toBeCloseTo(-camera.near, 12);
    }
    expect(projected.physicalCenterView[2]).toBeCloseTo(-0.985, 12);
    expect(projected.centerView[2]).toBeCloseTo(-1, 12);
  });

  it('reduces the halo gain to zero with the known triangle fraction and no reversal', () => {
    // The unchanged cab head group has half-width 1.62 m and half-height 0.3 m at scale 2.
    const depthSlope = 0.1;
    const nx = depthSlope / 1.62, ny = depthSlope / 0.3;
    const normal = new Vector3(nx, ny, Math.sqrt(1 - nx * nx - ny * ny));
    const camera = new PerspectiveCamera(62, 1280 / 720, 1, 10000);
    camera.lookAt(normal.clone().negate());
    const frame = cameraFrame(camera);
    let previousGain = Infinity;
    for (const cornerDistance of [4, 3, 2, 1, 0.5, 0.1, 0.01, 0.001, 0, -0.001]) {
      const group = normal.clone().multiplyScalar(-1 + depthSlope * (2 - cornerDistance));
      const projected = projectTrafficLampKernel({ typeIndex: 0, side: 'head', physicalScale: 2,
        position: [group.x, group.y + 0.08, group.z - 5.22], direction: [0, 0, 1],
        bankRadians: 0, camera: frame });
      // A corner triangle has two UV legs of length cornerDistance in the original area-four domain.
      const fraction = cornerDistance <= 0 ? 0 : cornerDistance <= 2 ? cornerDistance ** 2 / 8
        : 1 - (4 - cornerDistance) ** 2 / 8;
      expect(projected.sourceClipFraction).toBeCloseTo(fraction, 12);
      expect(Number.isFinite(projected.lampGain)).toBe(true);
      expect(projected.lampGain).toBeLessThanOrEqual(fraction + 1e-12);
      expect(projected.lampGain).toBeGreaterThanOrEqual(0.8 * fraction - 1e-12);
      expect(projected.lampGain).toBeLessThanOrEqual(previousGain + 1e-12);
      if (fraction === 0) expect(projected.lampGain).toBeCloseTo(0, 12);
      previousGain = projected.lampGain;
    }
  });
});

describe('R44 trail source independent of the clipped lamp halo', () => {
  function input(position: readonly [number, number, number], camera: PerspectiveCamera): SameCarTrafficAppearanceInput {
    return { position, direction: [0, 0, 1], bankRadians: 0, sizeScale: 2, typeIndex: 0,
      carIndex: 100, sourceFade: 1, admitted: true, projectedExtentCssPx: 6,
      cpuTier: { fromCount: -1, targetCount: 2400, progress: 1 },
      distanceM: Math.hypot(...position), thinFar: false, impostorPresence: 0,
      speedMps: 150, warmth: 0.5, tint: { r: 0.5, g: 0.5, b: 0.5 }, trailClass: 1,
      trailTransition: { fromMode: 'all', targetMode: 'all', changeTimeS: 0, timeS: 2, enabled: true },
      camera: cameraFrame(camera), emissiveGain: 1, fogFactor: 0, fogColor: { r: 0, g: 0, b: 0 },
      hasHullRecord: true, hasStreakRecord: true };
  }

  it('keeps source gain fixed when only the actual focal zoom changes the lamp floor gain', () => {
    const gains: number[] = [], lampGains: number[] = [];
    for (const zoom of [0.1, 1, 4]) {
      const camera = new PerspectiveCamera(62, 1280 / 720, 1, 10000);
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
      const value = input([1, 0, -200], camera);
      const lamp = projectTrafficLampKernel({ position: value.position, direction: value.direction,
        bankRadians: 0, typeIndex: 0, physicalScale: 2, side: 'tail', camera: value.camera });
      const output = evaluateSameCarTrafficAppearance(value);
      lampGains.push(lamp.lampGain);
      gains.push(output.streak.trail.sourceGain);
      expect(output.streak.trail.sourceGain).toBeCloseTo(1, 12);
    }
    expect(Math.max(...lampGains) - Math.min(...lampGains)).toBeGreaterThan(0.1);
    expect(Math.max(...gains) - Math.min(...gains)).toBeLessThanOrEqual(1e-12);
  });

  it('keeps trail frustum eligibility when the lamp is behind near and its world wake crosses near', () => {
    const camera = new PerspectiveCamera(115, 1280 / 720, 0.1, 10000);
    // Declared source presence is held at one. This control does not prove live hull admission.
    const value = input([35, -0.2, 4.92], camera);
    const lamp = projectTrafficLampKernel({ position: value.position, direction: value.direction,
      bankRadians: 0, typeIndex: 0, physicalScale: 2, side: 'tail', camera: value.camera });
    expect(lamp.physicalCenterView[2]).toBeCloseTo(0.5, 12);
    expect(lamp.clippedSourceVertices).toHaveLength(0);
    expect(0.5 - 19.28).toBeLessThan(-camera.near);
    const output = evaluateSameCarTrafficAppearance(value);
    expect(output.streak.trail.physicalStartView).toEqual([35, 0, 0.5, 1]);
    expect(output.streak.trail.physicalEndView[2]).toBeCloseTo(0.5 - output.streak.trail.lengthM, 12);
    expect(output.streak.trail.sourceGain).toBeGreaterThan(0);
    expect(output.streak.trail.clippedByFrustum).toBe(false);
    // The old endpoint projection cap can still remove this wake. Contract 6 remains open.
  });
});

describe('R44 bounded proxy and native source integration', () => {
  it('measures pre-padding support with the actual sub-metre near plane', () => {
    for (const near of [0.1, 0.25, 1, 5]) {
      const camera = new PerspectiveCamera(62, 1280 / 720, near, 10000);
      const frame = cameraFrame(camera);
      const projected = projectTrafficLampKernel({ typeIndex: 0, side: 'head', physicalScale: 2,
        position: [0, 0.08, -5.22 - near / 2], direction: [0, 0, 1], bankRadians: 0, camera: frame });
      expect(projected.centerView[2]).toBeCloseTo(-near, 12);
      const support = lampSupportCss(projected, frame);
      expect(support[0]).toBeCloseTo(1.3, 12);
      expect(support[1]).toBeCloseTo(1.3, 12);
      // The physical group is rejected. This is a metric-unit check, not visible coverage proof.
      expect(projected.sourceClipFraction).toBe(0);
    }
  });

  it('wires area suppression to real lamp materials and keeps trail start and gain separate', () => {
    const traffic = createSkyriverTraffic({ seed: 424242, quality: TRAFFIC_QUALITY_TIERS.low, maxImpostors: 8 });
    try {
      for (const name of ['skyriver.traffic.streaks', 'skyriver.traffic.impostors']) {
        const object = traffic.objects.find(candidate => candidate.name === name);
        if (!(object instanceof Mesh) || !(object.material instanceof ShaderMaterial)) throw new Error('R44_NATIVE_CLIP_MATERIAL_MISSING');
        const source = object.material.vertexShader;
        expect(source).toContain('float sourceClipFraction = trafficSourceNearFraction(centre, rightV * sourceHalfWidth, upV * sourceHalfHeight);');
        expect(source).toContain('lampGain *= sourceClipFraction;');
        expect(source).toMatch(/trafficFiniteAnchor\(centre,\s*upV\s*\*\s*sourceHalfHeight,\s*vec2\(0\.0,\s*1\.0\)/);
        if (name.endsWith('.streaks')) {
          expect(source).toMatch(/if\s*\(!isTrail\s*&&\s*!lampVisible\)/);
          expect(source).toMatch(/if\s*\(isTrail\)\s*\{\s*v0\s*=\s*viewMatrix\s*\*\s*vec4\(lamp,\s*1\.0\);\s*vPairOffset\s*=\s*vec2\(0\.0\);/);
          expect(source).toMatch(/if\s*\(!isTrail\)\s*vIntensity\s*\*=\s*lampGain;/);
        }
      }
    } finally { traffic.dispose(); }
  });
});
