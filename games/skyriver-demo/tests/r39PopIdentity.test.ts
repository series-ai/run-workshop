import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { InstancedBufferGeometry, InstancedMesh, Mesh, PerspectiveCamera, ShaderLib, UniformsUtils, Vector3 } from 'three';
import { createSkyriverTraffic, TRAFFIC_QUALITY_TIERS } from '../src/render/traffic';
import { TRAFFIC_APPEARANCE_PROFILES } from '../src/render/trafficAppearance';

type Position = [number, number, number];
interface StreakSample {
  carId: number;
  fade: number;
  position: Position;
  profile: number;
  lod: [number, number];
  slot: number;
}
interface HullSample {
  mesh: string;
  slot: number;
  carId: number | null;
  matrix: number[];
  coverage: number;
}
interface PopEvent {
  type: string;
  carId?: number | null;
  [field: string]: unknown;
}
interface Frame {
  streaks: StreakSample[];
  hulls: HullSample[];
}
interface Detector {
  HULL_BAYER_MINIMUM: number;
  compareStreakFrames(previous: StreakSample[], current: StreakSample[], project: (p: Position) => number[] | null): PopEvent[];
  compareHullFrames(previous: HullSample[], current: HullSample[], project: (p: Position) => number[] | null): PopEvent[];
}
const imported: unknown = createRequire(import.meta.url)('../tools/render-evidence/pop-continuity.cjs');
if (typeof imported !== 'object' || imported === null ||
  !('compareStreakFrames' in imported) || typeof imported.compareStreakFrames !== 'function' ||
  !('compareHullFrames' in imported) || typeof imported.compareHullFrames !== 'function' ||
  !('HULL_BAYER_MINIMUM' in imported) || typeof imported.HULL_BAYER_MINIMUM !== 'number') {
  throw new Error('R39_POP_HELPER_API_MISSING');
}
const detector = imported as Detector;
const proofDirectory = process.env.R39_POP_PROOF_DIR;
const loadedSourceHashes = {
  helper: createHash('sha256').update(readFileSync(new URL('../tools/render-evidence/pop-continuity.cjs', import.meta.url))).digest('hex'),
  test: createHash('sha256').update(readFileSync(new URL('./r39PopIdentity.test.ts', import.meta.url))).digest('hex'),
};
function receipt(name: string, value: Record<string, unknown>): void {
  if (!proofDirectory) return;
  mkdirSync(proofDirectory, { recursive: true });
  writeFileSync(proofDirectory + '/' + name + '.json', JSON.stringify({ ...value, sourceHashes: loadedSourceHashes }, null, 2) + '\n');
}
function camera(): PerspectiveCamera {
  const result = new PerspectiveCamera(62, 1280 / 720, 1, 10000);
  result.position.set(0, 1500, 0);
  result.lookAt(0, 1500, -1000);
  result.updateMatrixWorld(true);
  return result;
}
function projection(cam: PerspectiveCamera): (position: Position) => number[] | null {
  const p = new Vector3();
  return position => {
    p.fromArray(position).project(cam);
    return p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1
      ? [(p.x + 1) * 640, (1 - p.y) * 360] : null;
  };
}
function snapshot(traffic: ReturnType<typeof createSkyriverTraffic>): Frame {
  const streak = traffic.objects.find(o => o.name === 'skyriver.traffic.streaks');
  if (!(streak instanceof Mesh) || !(streak.geometry instanceof InstancedBufferGeometry)) throw new Error('R39_STREAK_BUFFER_MISSING');
  const g = streak.geometry, pos = g.getAttribute('aCarPos'), fade = g.getAttribute('aCarFade'), lod = g.getAttribute('aCarLod'), shape = g.getAttribute('aCarShape');
  const streaks: StreakSample[] = Array.from({ length: g.instanceCount }, (_, slot) => ({
    carId: lod.getZ(slot), fade: fade.getX(slot), position: [pos.getX(slot), pos.getY(slot), pos.getZ(slot)],
    profile: shape.getX(slot), lod: [lod.getX(slot), lod.getY(slot)], slot,
  }));
  const hulls: HullSample[] = [];
  // Sorted actual IDs provide an independent slot order. Actual centres must agree.
  for (const object of traffic.objects) {
    if (!(object instanceof InstancedMesh)) continue;
    const profile = TRAFFIC_APPEARANCE_PROFILES.findIndex(p => object.name === 'skyriver.traffic.' + p.name);
    const rows = streaks.filter(s => s.profile === profile).sort((a, b) => a.carId - b.carId);
    if (rows.length !== object.count) throw new Error('R39_REAL_BATCH_COUNT_MISMATCH');
    const coverage = object.geometry.getAttribute('aHullCoverage');
    for (let slot = 0; slot < object.count; slot += 1) {
      const matrix = Array.from(object.instanceMatrix.array.slice(slot * 16, slot * 16 + 16));
      const row = rows[slot]!;
      if (row.position.some((v, axis) => Math.abs(v - matrix[12 + axis]!) > 1e-4)) throw new Error('R39_REAL_CAR_CENTRE_MISMATCH');
      hulls.push({ mesh: object.name, slot, carId: row.carId, matrix, coverage: coverage.getX(slot) });
    }
  }
  if (new Set(streaks.map(s => s.carId)).size !== streaks.length) throw new Error('R39_REAL_CAR_IDS_NOT_UNIQUE');
  return { streaks, hulls };
}
function setup(seed = 424242) {
  const traffic = createSkyriverTraffic({ seed, quality: TRAFFIC_QUALITY_TIERS.high, maxImpostors: 0 });
  const cam = camera();
  traffic.setAnchor(0, 1500, 0, 0, 160, 0, 0);
  traffic.update(0, cam.position);
  traffic.update(12, cam.position);
  return { traffic, cam, project: projection(cam) };
}
function actualStreak(traffic: ReturnType<typeof createSkyriverTraffic>): InstancedBufferGeometry {
  const mesh = traffic.objects.find(o => o.name === 'skyriver.traffic.streaks');
  if (!(mesh instanceof Mesh) || !(mesh.geometry instanceof InstancedBufferGeometry)) throw new Error('R39_STREAK_BUFFER_MISSING');
  return mesh.geometry;
}
function actualHull(traffic: ReturnType<typeof createSkyriverTraffic>, row: HullSample): InstancedMesh {
  const mesh = traffic.objects.find(o => o.name === row.mesh);
  if (!(mesh instanceof InstancedMesh)) throw new Error('R39_HULL_BUFFER_MISSING');
  return mesh;
}

describe('R39 independent real-buffer pop identity', () => {
  it.each([424242, 0, 2147483647])('keeps same-car fade continuous through three tier changes at seed %i', seed => {
    const { traffic, cam, project } = setup(seed);
    let prior: Frame | null = null;
    let packedRemaps = 0, invalidSlotFadeJumps = 0, maxSameIdFadeStep = 0, fadeEvents = 0, packedIdentityFaultEvents = 0;
    const rawHullEvents: unknown[] = [];
    const counts: Record<string, number> = {};
    const transitions: unknown[] = [];
    try {
      for (let frame = 0; frame <= 540; frame += 1) {
        const tier = frame === 60 ? 'low' : frame === 210 ? 'medium' : frame === 360 ? 'high' : null;
        if (tier) traffic.setQuality(TRAFFIC_QUALITY_TIERS[tier]);
        const time = 12 + frame / 60;
        traffic.update(time, cam.position);
        const current = snapshot(traffic);
        if (tier) transitions.push({ frame, time, tier, actualCars: current.streaks.length });
        if (prior) {
          const sameCar = new Map(prior.streaks.map(row => [row.carId, row]));
          for (let slot = 0; slot < current.streaks.length; slot += 1) {
            const row = current.streaks[slot]!, oldSlot = prior.streaks[slot], oldCar = sameCar.get(row.carId);
            if (oldSlot && oldSlot.carId !== row.carId) {
              packedRemaps += 1;
              if (Math.abs(row.fade - oldSlot.fade) > 0.35 && project(row.position)) invalidSlotFadeJumps += 1;
            }
            if (oldCar) maxSameIdFadeStep = Math.max(maxSameIdFadeStep, Math.abs(row.fade - oldCar.fade));
          }
          const fade = detector.compareStreakFrames(prior.streaks, current.streaks, project);
          fadeEvents += fade.length;
          const priorSlots = prior.streaks.map(row => ({ ...row, carId: row.slot }));
          const currentSlots = current.streaks.map(row => ({ ...row, carId: row.slot }));
          packedIdentityFaultEvents += detector.compareStreakFrames(priorSlots, currentSlots, project).length;
          for (const event of detector.compareHullFrames(prior.hulls, current.hulls, project)) {
            counts[event.type] = (counts[event.type] ?? 0) + 1;
            const before = prior.streaks.find(s => s.carId === event.carId), after = current.streaks.find(s => s.carId === event.carId);
            rawHullEvents.push({ frame, rendererTimeSeconds: time, camera: { position: cam.position.toArray(), quaternion: cam.quaternion.toArray(), fov: cam.fov }, event, previousStreak: before ?? null, currentStreak: after ?? null });
          }
        }
        prior = current;
      }
      const result = { seed, frames: 541, transitions, packedRemaps, invalidSlotFadeJumps, maxSameIdFadeStep, unchangedFadeLimit: 0.35, actualIdFadeEvents: fadeEvents, packedIdentityFaultEvents, faultControl: 'The actual helper receives the same real values with packed slot IDs in place of stable car IDs.', rawHullCounts: counts, rawHullEvents, gpuReadback: false, pass: fadeEvents === 0 && maxSameIdFadeStep < 0.35 && invalidSlotFadeJumps > 0 };
      receipt('seed-' + seed, result);
      expect(packedRemaps).toBeGreaterThan(1000);
      expect(invalidSlotFadeJumps).toBeGreaterThan(100);
      expect(maxSameIdFadeStep).toBeLessThan(0.35);
      expect(fadeEvents).toBe(0);
      expect(packedIdentityFaultEvents).toBe(invalidSlotFadeJumps);
    } finally { traffic.dispose(); }
  });

  it.each([[0.3499, 0], [0.3501, 1]])('keeps the actual same-ID fade limit at step %f', (step, expected) => {
    const { traffic, project } = setup();
    try {
      const before = snapshot(traffic), car = before.streaks.find(row => row.fade > 0.9 && project(row.position));
      if (!car) throw new Error('R39_VISIBLE_REAL_CAR_MISSING');
      actualStreak(traffic).getAttribute('aCarFade').setX(car.slot, car.fade - step);
      const after = snapshot(traffic), events = detector.compareStreakFrames(before.streaks, after.streaks, project);
      receipt('fade-fault-' + step, { carId: car.carId, step, events, expected, actualBufferFault: true });
      expect(events).toHaveLength(expected);
      if (expected) expect(events[0]!.carId).toBe(car.carId);
    } finally { traffic.dispose(); }
  });

  it.each([[0.5001, 0], [0.4999, 1]])('keeps physical scale blink limits at scale ratio %f', (ratio, expected) => {
    const { traffic, project } = setup();
    try {
      const before = snapshot(traffic), car = before.streaks.find(row => row.fade > 0.9 && project(row.position)), hull = before.hulls.find(row => row.carId === car?.carId);
      if (!car || !hull) throw new Error('R39_VISIBLE_REAL_HULL_MISSING');
      const mesh = actualHull(traffic, hull);
      for (let k = 0; k < 12; k += 1) mesh.instanceMatrix.array[hull.slot * 16 + k] = hull.matrix[k]! * ratio;
      const after = snapshot(traffic), events = detector.compareHullFrames(before.hulls, after.hulls, project).filter(e => e.carId === car.carId);
      receipt('scale-fault-' + ratio, { carId: car.carId, ratio, events, expected, actualBufferFault: true });
      expect(events).toHaveLength(expected);
      if (expected) expect(events[0]!.type).toBe('blink');
    } finally { traffic.dispose(); }
  });

  it.each([0, 1 / 32, 1 / 32 + 1e-6, 1])('keeps raw same-ID relocation with coverage %f', coverage => {
    const { traffic, cam, project } = setup();
    try {
      const before = snapshot(traffic), car = before.streaks.find(row => row.fade > 0.9 && project(row.position));
      const hull = before.hulls.find(row => row.carId === car?.carId);
      if (!car || !hull) throw new Error('R39_VISIBLE_REAL_HULL_MISSING');
      const mesh = actualHull(traffic, hull), streak = actualStreak(traffic);
      mesh.geometry.getAttribute('aHullCoverage').setX(hull.slot, coverage);
      const prior = snapshot(traffic), movedX = car.position[0] + 100;
      mesh.instanceMatrix.array[hull.slot * 16 + 12] = movedX;
      streak.getAttribute('aCarPos').setX(car.slot, movedX);
      const after = snapshot(traffic), events = detector.compareHullFrames(prior.hulls, after.hulls, project).filter(e => e.carId === car.carId);
      expect(events).toHaveLength(1);
      const event = events[0]!;
      expect(event.type).toBe('teleport');
      expect(event.previousHullFullyDiscarded).toBe(coverage <= detector.HULL_BAYER_MINIMUM);
      expect(event.currentHullFullyDiscarded).toBe(coverage <= detector.HULL_BAYER_MINIMUM);
      expect(event.previousCoverage).toBeCloseTo(coverage, 7);
      expect(event.currentCoverage).toBeCloseTo(coverage, 7);
      expect(after.streaks.find(row => row.carId === car.carId)!.fade).toBeGreaterThan(0.9);
      receipt('relocation-coverage-' + coverage, { event, previousStreak: car, currentStreak: after.streaks.find(row => row.carId === car.carId), actualBufferFault: true, lampInvisibilityClaim: false, rendererTimeSeconds: 12, seed: 424242, camera: { position: cam.position.toArray(), quaternion: cam.quaternion.toArray(), fov: cam.fov } });
    } finally { traffic.dispose(); }
  });

  it.each([
    ['CSS', 59.9, 0], ['CSS', 60.1, 1],
    ['metres', 24.99, 0], ['metres', 25.01, 1],
  ] as const)('keeps the relocation limit at %s %f', (unit, amount, expected) => {
    const { traffic, cam } = setup();
    try {
      let before = snapshot(traffic);
      const firstProjection = projection(cam);
      const car = before.streaks.find(row => row.fade > 0.9 && firstProjection(row.position));
      if (!car) throw new Error('R39_VISIBLE_REAL_CAR_MISSING');
      if (unit === 'metres') {
        cam.position.fromArray(car.position).add(new Vector3(0, 0, 150));
        cam.lookAt(new Vector3().fromArray(car.position));
        cam.updateMatrixWorld(true);
        traffic.update(12, cam.position);
        before = snapshot(traffic);
      }
      const row = before.streaks.find(r => r.carId === car.carId), hull = before.hulls.find(r => r.carId === car.carId);
      if (!row || !hull) throw new Error('R39_REAL_FAULT_CAR_MISSING');
      const project = projection(cam), p0 = project(row.position), p1 = project([row.position[0] + 1, row.position[1], row.position[2]]);
      if (!p0 || !p1) throw new Error('R39_REAL_FAULT_CAR_NOT_PROJECTED');
      const pixelsPerMetre = Math.abs(p1[0]! - p0[0]!);
      const move = unit === 'CSS' ? amount / pixelsPerMetre : amount;
      const mesh = actualHull(traffic, hull), streak = actualStreak(traffic), newX = row.position[0] + move;
      mesh.instanceMatrix.array[hull.slot * 16 + 12] = newX;
      streak.getAttribute('aCarPos').setX(row.slot, newX);
      const after = snapshot(traffic), afterRow = after.streaks.find(r => r.carId === row.carId)!;
      const p2 = project(afterRow.position);
      if (!p2) throw new Error('R39_REAL_FAULT_CAR_LEFT_VIEW');
      const actualWorldMove = Math.abs(afterRow.position[0] - row.position[0]), actualCssMove = Math.hypot(p2[0]! - p0[0]!, p2[1]! - p0[1]!);
      if (unit === 'CSS') expect(actualWorldMove).toBeGreaterThan(25);
      else expect(actualCssMove).toBeGreaterThan(60);
      const events = detector.compareHullFrames(before.hulls, after.hulls, project).filter(e => e.carId === row.carId);
      receipt('relocation-limit-' + unit + '-' + amount, { actualWorldMove, actualCssMove, expected, events, camera: { position: cam.position.toArray(), quaternion: cam.quaternion.toArray(), fov: cam.fov }, rendererTimeSeconds: 12, beforeStreak: row, afterStreak: afterRow, actualBufferFault: true });
      expect(events).toHaveLength(expected);
      if (expected) expect(events[0]!.type).toBe('teleport');
    } finally { traffic.dispose(); }
  });

  it.each(['previous', 'current', 'both'] as const)('keeps the raw relocation when %s identity is missing', missing => {
    const { traffic, cam, project } = setup();
    try {
      const before = snapshot(traffic), car = before.streaks.find(row => row.fade > 0.9 && project(row.position)), hull = before.hulls.find(row => row.carId === car?.carId);
      if (!car || !hull) throw new Error('R39_VISIBLE_REAL_HULL_MISSING');
      const mesh = actualHull(traffic, hull), streak = actualStreak(traffic), movedX = car.position[0] + 100;
      mesh.instanceMatrix.array[hull.slot * 16 + 12] = movedX;
      streak.getAttribute('aCarPos').setX(car.slot, movedX);
      const after = snapshot(traffic);
      if (missing !== 'current') before.hulls.find(row => row.carId === car.carId)!.carId = null;
      if (missing !== 'previous') after.hulls.find(row => row.carId === car.carId)!.carId = null;
      const events = detector.compareHullFrames(before.hulls, after.hulls, project).filter(e => e.mesh === hull.mesh && e.i === hull.slot);
      receipt('missing-identity-' + missing, { events, expected: 1, carId: car.carId, actualGeometryBufferFault: true, removedMetadataAssociation: missing, rendererTimeSeconds: 12, seed: 424242, camera: { position: cam.position.toArray(), quaternion: cam.quaternion.toArray(), fov: cam.fov }, previousStreak: car, currentStreak: after.streaks.find(row => row.carId === car.carId) });
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('teleport');
      expect(events[0]!.identityKnown).toBe(false);
    } finally { traffic.dispose(); }
  });

  it('uses the actual material hook and its exact sixteen Bayer thresholds', () => {
    const { traffic } = setup();
    try {
      const mesh = traffic.objects.find(o => o instanceof InstancedMesh);
      if (!(mesh instanceof InstancedMesh)) throw new Error('R39_REAL_MATERIAL_MISSING');
      const shader = { uniforms: UniformsUtils.clone(ShaderLib.basic.uniforms), vertexShader: ShaderLib.basic.vertexShader, fragmentShader: ShaderLib.basic.fragmentShader };
      const material = Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material;
      Reflect.apply(material.onBeforeCompile, material, [shader, undefined]);
      const rankMatch = shader.fragmentShader.match(/float rank = ([\s\S]*?);/), condition = shader.fragmentShader.match(/if \(vHullCoverage ([<=>]+) \(rank \+ ([\d.]+)\) \/ ([\d.]+)\) discard;/);
      if (!rankMatch || !condition) throw new Error('R39_ACTUAL_BAYER_TERM_MISSING');
      const expression = rankMatch[1]!.replaceAll('low.x', 'lx').replaceAll('low.y', 'ly').replaceAll('high.x', 'hx').replaceAll('high.y', 'hy');
      const rank = new Function('lx', 'ly', 'hx', 'hy', 'return (' + expression + ')') as (lx: number, ly: number, hx: number, hy: number) => number;
      const ranks = Array.from({ length: 16 }, (_, i) => rank(i % 4 % 2, Math.floor(i / 4) % 2, Math.floor(i % 4 / 2), Math.floor(i / 8)));
      expect(ranks).toEqual([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);
      expect(condition[1]).toBe('<=');
      const thresholds = ranks.map(r => (r + Number(condition[2])) / Number(condition[3]));
      expect(Math.min(...thresholds)).toBe(detector.HULL_BAYER_MINIMUM);
      expect(detector.HULL_BAYER_MINIMUM).toBe(1 / 32);
      const rows = [0, 1 / 32, 1 / 32 + 1e-6, 1].map(coverage => ({ coverage, survivingCells: thresholds.filter(t => coverage > t).length }));
      expect(rows.map(r => r.survivingCells)).toEqual([0, 0, 1, 16]);
      receipt('actual-fragment-bayer', { shaderSha256: createHash('sha256').update(shader.fragmentShader).digest('hex'), cacheKey: material.customProgramCacheKey(), condition: condition[0], actualRankExpression: rankMatch[1], ranks, thresholds, minimum: Math.min(...thresholds), rows, gpuReadback: false });
    } finally { traffic.dispose(); }
  });
});
