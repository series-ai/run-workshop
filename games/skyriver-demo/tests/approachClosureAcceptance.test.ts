import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { InstancedBufferGeometry, InstancedMesh, Mesh, ShaderMaterial, Vector3 } from 'three';
import { createSkyriverTraffic, TRAFFIC_QUALITY_TIERS } from '../src/render/traffic';
import { TRAFFIC_APPEARANCE_PROFILES } from '../src/render/trafficAppearance';
import { shippedHullResponse } from './support/flyerContinuityMatrix';

type Traffic = ReturnType<typeof createSkyriverTraffic>;
interface ScaleSample {
  distanceM: number;
  scale: number;
  baseScale: number;
  sourceTierFade: number;
}
interface TrailSample {
  facing: number;
  ungatedIntensity: number;
  intensity: number;
}
interface CheckResult { pass: boolean; limit: number; samples: unknown[]; }
interface Acceptance {
  checkPhysicalScale(samples: ScaleSample[]): CheckResult;
  checkTrailIntensity(samples: TrailSample[]): CheckResult;
}
const imported: unknown = createRequire(import.meta.url)('../tools/render-evidence/approach-acceptance.cjs');
if (typeof imported !== 'object' || imported === null
  || !('checkPhysicalScale' in imported) || typeof imported.checkPhysicalScale !== 'function'
  || !('checkTrailIntensity' in imported) || typeof imported.checkTrailIntensity !== 'function') {
  throw new Error('APPROACH_ACCEPTANCE_API_MISSING');
}
const acceptance = imported as Acceptance;
const linkedHashes = Object.fromEntries([
  '../src/render/traffic.ts', '../src/render/trafficAppearance.ts',
  '../tools/render-evidence/approach-closure.cjs', '../tools/render-evidence/approach-acceptance.cjs',
  './approachClosureAcceptance.test.ts',
].map(file => [file, createHash('sha256').update(readFileSync(new URL(file, import.meta.url))).digest('hex')]));
function save(name: string, value: Record<string, unknown>): void {
  const directory = process.env.APPROACH_ACCEPTANCE_OUT;
  if (!directory) return;
  mkdirSync(directory, { recursive: true });
  writeFileSync(directory + '/' + name + '.json', JSON.stringify({ ...value, linkedHashes, gpuReadback: false }, null, 2) + '\n');
}
function createTraffic(): Traffic {
  return createSkyriverTraffic({ seed: 424242, quality: TRAFFIC_QUALITY_TIERS.high, maxImpostors: 0 });
}
function actualStreak(traffic: Traffic): Mesh<InstancedBufferGeometry, ShaderMaterial> {
  const mesh = traffic.objects.find(object => object.name === 'skyriver.traffic.streaks');
  if (!(mesh instanceof Mesh) || !(mesh.geometry instanceof InstancedBufferGeometry)
    || !(mesh.material instanceof ShaderMaterial)) throw new Error('APPROACH_REAL_STREAK_MISSING');
  return mesh as Mesh<InstancedBufferGeometry, ShaderMaterial>;
}
function actualCar(traffic: Traffic, carId: number) {
  const geometry = actualStreak(traffic).geometry;
  const lod = geometry.getAttribute('aCarLod'), position = geometry.getAttribute('aCarPos');
  const fade = geometry.getAttribute('aCarFade'), direction = geometry.getAttribute('aCarDir');
  const shape = geometry.getAttribute('aCarShape');
  for (let slot = 0; slot < geometry.instanceCount; slot += 1) {
    if (lod.getZ(slot) !== carId) continue;
    const totalShare = lod.getX(slot) + lod.getY(slot);
    if (!(totalShare > 0)) throw new Error('APPROACH_SOURCE_TIER_FADE_UNRECOVERABLE');
    return { carId, slot, position: new Vector3(position.getX(slot), position.getY(slot), position.getZ(slot)),
      direction: new Vector3(direction.getX(slot), direction.getY(slot), direction.getZ(slot)),
      profile: shape.getX(slot), baseScale: fade.getY(slot), sourceTierFade: fade.getX(slot) / totalShare,
      fade: fade.getX(slot), trailWeight: fade.getW(slot), totalShare };
  }
  throw new Error('APPROACH_REAL_CAR_MISSING:' + carId);
}
function actualHull(traffic: Traffic, car: ReturnType<typeof actualCar>) {
  let found: { mesh: InstancedMesh; slot: number } | null = null;
  for (const object of traffic.objects) {
    if (!(object instanceof InstancedMesh)) continue;
    for (let slot = 0; slot < object.count; slot += 1) {
      const matrix = object.instanceMatrix.array, offset = slot * 16;
      if (Math.hypot(matrix[offset + 12]! - car.position.x, matrix[offset + 13]! - car.position.y,
        matrix[offset + 14]! - car.position.z) >= 1e-4) continue;
      if (found) throw new Error('APPROACH_REAL_HULL_AMBIGUOUS');
      found = { mesh: object, slot };
    }
  }
  if (!found) throw new Error('APPROACH_REAL_HULL_MISSING');
  return found;
}
function scaleSample(traffic: Traffic, carId: number, time: number, distanceM: number) {
  const before = actualCar(traffic, carId);
  const camera = before.position.clone().addScaledVector(before.direction.clone().normalize(), -distanceM);
  traffic.update(time, camera);
  const car = actualCar(traffic, carId), hull = actualHull(traffic, car);
  const matrix = hull.mesh.instanceMatrix.array, offset = hull.slot * 16;
  return { carId, distanceM: camera.distanceTo(car.position),
    scale: Math.hypot(matrix[offset]!, matrix[offset + 1]!, matrix[offset + 2]!),
    baseScale: car.baseScale, sourceTierFade: car.sourceTierFade,
    aFade: hull.mesh.geometry.getAttribute('aFade').getX(hull.slot),
    matrix: Array.from(matrix.slice(offset, offset + 16)), camera: camera.toArray(),
    rendererTimeSeconds: time, hull };
}
function actualShaderTrailSample(traffic: Traffic, carId: number, angle: number): TrailSample {
  const before = actualCar(traffic, carId), forward = before.direction.clone().normalize();
  const right = new Vector3(forward.z, 0, -forward.x).normalize(), radians = angle * Math.PI / 180;
  const camera = before.position.clone().addScaledVector(forward, 200 * Math.cos(radians))
    .addScaledVector(right, 200 * Math.sin(radians));
  traffic.update(10, camera);
  const car = actualCar(traffic, carId);
  const facing = car.direction.clone().normalize().dot(camera.clone().sub(car.position).normalize());
  const shader = actualStreak(traffic).material.vertexShader;
  const gate = shader.match(/vIntensity \*= 1\.0 - smoothstep\(\s*([\d.]+),\s*([\d.]+),\s*(-?)\s*facing\s*\);/);
  if (!gate) throw new Error('APPROACH_ACTUAL_SIGNED_TRAIL_TERM_MISSING');
  expect(gate.slice(1)).toEqual(['0.72', '0.90', '-']);
  const x = Math.max(0, Math.min(1, ((gate[3] === '-' ? -facing : facing) - Number(gate[1]))
    / (Number(gate[2]) - Number(gate[1]))));
  const ungatedIntensity = car.fade * car.trailWeight;
  return { facing, ungatedIntensity, intensity: ungatedIntensity * (1 - x * x * (3 - 2 * x)) };
}

describe('capture acceptance: actual shipped traffic buffers', () => {
  it.each(TRAFFIC_APPEARANCE_PROFILES.map((profile, index) => ({ name: profile.name, index })))
    ('$name passes exact distance scale and fade', ({ index }) => {
      const traffic = createTraffic();
      try {
        traffic.update(10, { x: 0, y: 1500, z: 0 });
        const geometry = actualStreak(traffic).geometry;
        const shapes = geometry.getAttribute('aCarShape'), ids = geometry.getAttribute('aCarLod');
        const slot = Array.from({ length: geometry.instanceCount }, (_, i) => i).find(i => shapes.getX(i) === index);
        if (slot === undefined) throw new Error('APPROACH_REAL_PROFILE_MISSING');
        const carId = ids.getZ(slot);
        const samples = [600, 750, 900, 1080, 1190, 1300].map(distance => scaleSample(traffic, carId, 10, distance));
        for (const sample of samples) {
          const expected = shippedHullResponse(sample.distanceM, sample.sourceTierFade);
          expect(sample.scale).toBeCloseTo(sample.baseScale * expected.scale, 5);
          expect(sample.aFade).toBeCloseTo(expected.fade, 5);
        }
        const result = acceptance.checkPhysicalScale(samples.map(({ distanceM, scale, baseScale, sourceTierFade }) => ({ distanceM, scale, baseScale, sourceTierFade })));
        expect(result.limit).toBe(1e-5);
        expect(result.pass).toBe(true);
        save('distance-' + index, { result, samples: samples.map(({ hull: _hull, ...data }) => data) });
      } finally { traffic.dispose(); }
    });

  it('passes actual lifecycle scale without treating aFade as lifecycle fade', () => {
    const traffic = createTraffic();
    try {
      traffic.update(10, { x: 0, y: 1500, z: 0 });
      traffic.setQuality(TRAFFIC_QUALITY_TIERS.low);
      traffic.update(10, { x: 0, y: 1500, z: 0 });
      const samples = [0, 0.12, 0.54, 1.08].map(elapsed => {
        traffic.update(10 + elapsed, { x: 0, y: 1500, z: 0 });
        return scaleSample(traffic, 1000, 10 + elapsed, 200);
      });
      for (const sample of samples) expect(sample.aFade).toBe(1);
      expect(samples.at(-1)!.scale).toBeLessThan(samples[0]!.scale / 2);
      const result = acceptance.checkPhysicalScale(samples.map(({ distanceM, scale, baseScale, sourceTierFade }) => ({ distanceM, scale, baseScale, sourceTierFade })));
      expect(result.pass).toBe(true);
      save('lifecycle', { result, samples: samples.map(({ hull: _hull, ...data }) => data) });
    } finally { traffic.dispose(); }
  });

  it('fails a wrong scale in an actual instance matrix', () => {
    const traffic = createTraffic();
    try {
      traffic.update(10, { x: 0, y: 1500, z: 0 });
      const sample = scaleSample(traffic, 100, 10, 1190);
      expect(acceptance.checkPhysicalScale([sample]).pass).toBe(true);
      const matrix = sample.hull.mesh.instanceMatrix.array, offset = sample.hull.slot * 16;
      for (let component = 0; component < 12; component += 1) matrix[offset + component] = matrix[offset + component]! * 1.2;
      const fault = { ...sample, scale: Math.hypot(matrix[offset]!, matrix[offset + 1]!, matrix[offset + 2]!) };
      const result = acceptance.checkPhysicalScale([{ distanceM: fault.distanceM, scale: fault.scale, baseScale: fault.baseScale, sourceTierFade: fault.sourceTierFade }]);
      expect(result.pass).toBe(false);
      save('wrong-scale-control', { result, actualMatrixFault: true, factor: 1.2, faultMatrix: Array.from(matrix.slice(offset, offset + 16)) });
    } finally { traffic.dispose(); }
  });

  it('keeps front trail contribution and removes rear contribution with actual shader terms', () => {
    const traffic = createTraffic();
    try {
      traffic.update(10, { x: 0, y: 1500, z: 0 });
      const samples = [0, 90, 155, 170, 180].map(angle => ({ angle, ...actualShaderTrailSample(traffic, 100, angle) }));
      const front = samples[0]!, rear = samples.at(-1)!;
      expect(front.ungatedIntensity).toBeGreaterThan(0);
      expect(front.intensity).toBe(front.ungatedIntensity);
      expect(rear.ungatedIntensity).toBeGreaterThan(0);
      expect(rear.intensity).toBe(0);
      const result = acceptance.checkTrailIntensity(samples);
      expect(result.limit).toBe(1e-5);
      expect(result.pass).toBe(true);
      save('signed-trail', { result, samples, scope: 'Actual shader view multiplier and real buffer source factors. No lamp projection, fog, pixel, or GPU claim.' });
    } finally { traffic.dispose(); }
  });

  it('fails missing rear fade and incorrect front fade controls', () => {
    const traffic = createTraffic();
    try {
      traffic.update(10, { x: 0, y: 1500, z: 0 });
      const rear = actualShaderTrailSample(traffic, 100, 180);
      const front = actualShaderTrailSample(traffic, 100, 0);
      const missingRearGate = { ...rear, intensity: rear.ungatedIntensity };
      const incorrectFrontGate = { ...front, intensity: 0 };
      const rearResult = acceptance.checkTrailIntensity([missingRearGate]);
      const frontResult = acceptance.checkTrailIntensity([incorrectFrontGate]);
      expect(rearResult.pass).toBe(false);
      expect(frontResult.pass).toBe(false);
      save('trail-fault-controls', { rearResult, frontResult, shaderTermFaults: true });
    } finally { traffic.dispose(); }
  });
});
