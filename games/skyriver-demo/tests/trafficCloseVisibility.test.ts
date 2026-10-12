import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { InstancedBufferAttribute, InstancedBufferGeometry, InstancedMesh, Matrix4, Mesh, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { carTrafficPlan, createSkyriverTraffic, TRAFFIC_QUALITY_TIERS, type CarPlan } from '../src/render/traffic';
import { trafficHullVisibility } from '../src/render/lightHandover';
import type { TrafficQuality } from '../src/render/trafficTypes';
import { deriveTrafficParams } from '../src/sim/derive';

type Traffic = ReturnType<typeof createSkyriverTraffic>;
interface Row {
  readonly carId: number;
  readonly position: Vector3;
  readonly matrix: readonly number[];
  readonly scales: readonly number[];
  readonly physicalScale: number;
  readonly profile: number;
  readonly hullFade: number;
  readonly lampFade: number;
  readonly trailWeight: number;
  readonly hullSlot: number;
  readonly streakSlot: number;
  readonly mesh: InstancedMesh;
}
const sourceHashes = Object.fromEntries(['../src/render/traffic.ts', '../src/render/lightHandover.ts',
  '../src/render/trafficTypes.ts', './trafficCloseVisibility.test.ts'].map(file => [file,
  createHash('sha256').update(readFileSync(new URL(file, import.meta.url))).digest('hex')]));
function receipt(name: string, value: Readonly<Record<string, unknown>>): void {
  const out = process.env.R44_CLOSE_OUT;
  if (!out) return;
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/${name}.json`, JSON.stringify({ ...value, sourceHashes,
    scope: 'Real CPU buffers and real Camera projection. No raster peak or centroid claim.' },
  (key, data: unknown) => key === 'mesh' ? undefined : data, 2) + '\n');
}
function quality(tier: TrafficQuality): TrafficQuality {
  return { ...tier, trails: 'all', impostors: 8 };
}
function factory(tier = TRAFFIC_QUALITY_TIERS.high): Traffic {
  return createSkyriverTraffic({ seed: 424242, quality: quality(tier),
    maxCarCount: 2400, maxThrusterBudget: 2400, maxImpostors: 8 });
}
function row(traffic: Traffic, carId: number): Row | null {
  const streak = traffic.objects.find(object => object.name === 'skyriver.traffic.streaks');
  if (!(streak instanceof Mesh) || !(streak.geometry instanceof InstancedBufferGeometry)) throw Error('CLOSE_REAL_STREAK_REQUIRED');
  const geometry = streak.geometry;
  const ids = geometry.getAttribute('aCarLod'), positions = geometry.getAttribute('aCarPos');
  const fade = geometry.getAttribute('aCarFade'), shape = geometry.getAttribute('aCarShape');
  if (!(ids instanceof InstancedBufferAttribute) || !(positions instanceof InstancedBufferAttribute)
    || !(fade instanceof InstancedBufferAttribute) || !(shape instanceof InstancedBufferAttribute)) throw Error('CLOSE_REAL_ATTRIBUTES_REQUIRED');
  const slots = Array.from({ length: geometry.instanceCount }, (_, i) => i).filter(i => ids.getZ(i) === carId);
  if (slots.length === 0) return null;
  if (slots.length !== 1) throw Error('CLOSE_DUPLICATE_PERMANENT_ID');
  const streakSlot = slots[0]!;
  const position = new Vector3(positions.getX(streakSlot), positions.getY(streakSlot), positions.getZ(streakSlot));
  const matches: { mesh: InstancedMesh; slot: number; matrix: number[] }[] = [];
  for (const object of traffic.objects) {
    if (!(object instanceof InstancedMesh)) continue;
    for (let slot = 0; slot < object.count; slot += 1) {
      const matrix = Array.from(object.instanceMatrix.array.slice(slot * 16, slot * 16 + 16));
      if (Math.hypot(matrix[12]! - position.x, matrix[13]! - position.y, matrix[14]! - position.z) < 1e-4) {
        matches.push({ mesh: object, slot, matrix });
      }
    }
  }
  if (matches.length !== 1) throw Error('CLOSE_HULL_JOIN_COUNT:' + matches.length);
  const hull = matches[0]!;
  return { carId, position, matrix: hull.matrix,
    scales: [0, 4, 8].map(i => Math.hypot(hull.matrix[i]!, hull.matrix[i + 1]!, hull.matrix[i + 2]!)),
    physicalScale: fade.getY(streakSlot), profile: shape.getX(streakSlot),
    hullFade: hull.mesh.geometry.getAttribute('aFade').getX(hull.slot), lampFade: fade.getX(streakSlot),
    trailWeight: fade.getW(streakSlot), hullSlot: hull.slot, streakSlot, mesh: hull.mesh };
}
function requiredRow(traffic: Traffic, id: number): Row {
  const actual = row(traffic, id);
  if (!actual) throw Error('CLOSE_REAL_CAR_MISSING:' + id);
  return actual;
}
function camera(fov: number): PerspectiveCamera {
  return new PerspectiveCamera(fov, 1280 / 720, 1, 14000);
}
function place(camera: PerspectiveCamera, target: Vector3, distance: number): void {
  camera.position.copy(target).add(new Vector3(0, 0, distance));
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
}
function update(traffic: Traffic, time: number, view: PerspectiveCamera, dpr = 1): void {
  view.updateProjectionMatrix();
  view.updateMatrixWorld(true);
  const focal = view.projectionMatrix.elements[5]!;
  traffic.setPixelAngle(2 / (focal * 720 * dpr), 2 / (focal * 720));
  const bind = Reflect.get(traffic, 'setCameraFrame');
  if (typeof bind === 'function') Reflect.apply(bind, traffic, [view.matrixWorldInverse.elements, view.near]);
  traffic.update(time, view.position);
}
function extent(actual: Row, view: PerspectiveCamera): { css: number; behind: boolean; crossing: boolean } {
  actual.mesh.geometry.computeBoundingBox();
  const box = actual.mesh.geometry.boundingBox;
  if (!box) throw Error('CLOSE_REAL_BOUNDING_BOX_REQUIRED');
  const matrix = new Matrix4().fromArray(actual.matrix);
  const points: Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    points.push(new Vector3(x, y, z).applyMatrix4(matrix));
  }
  const depths = points.map(point => point.clone().applyMatrix4(view.matrixWorldInverse).z);
  const behind = depths.every(z => z > -view.near);
  const crossing = !behind && depths.some(z => z > -view.near);
  if (behind) return { css: 0, behind, crossing };
  if (crossing) return { css: 6, behind, crossing };
  const pixels = points.map(point => point.project(view));
  return { css: Math.max((Math.max(...pixels.map(p => p.x)) - Math.min(...pixels.map(p => p.x))) * 640,
    (Math.max(...pixels.map(p => p.y)) - Math.min(...pixels.map(p => p.y))) * 360), behind, crossing };
}
function smooth(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function expectedVisibility(_distance: number, presence: number, css: number): number {
  if (presence <= 0) return 0;
  return smooth(0.125, 0.5, css);
}
function initialise(traffic: Traffic, id: number, time: number, distance: number, fov = 8, dpr = 1) {
  const view = camera(fov);
  view.position.set(0, 1500, 0); view.lookAt(0, 1500, -1);
  update(traffic, time, view, dpr);
  const first = row(traffic, id);
  let position = first?.position;
  if (!position) {
    const fn = Reflect.get(traffic, 'carEvidence');
    const diagnostic: unknown = typeof fn === 'function' ? Reflect.apply(fn, traffic, [id]) : null;
    if (typeof diagnostic !== 'object' || diagnostic === null || !('position' in diagnostic)
      || !Array.isArray(diagnostic.position)) throw Error('CLOSE_CAMERA_SETUP_POSE_REQUIRED');
    const coordinates: unknown[] = diagnostic.position;
    const [x, y, z] = coordinates;
    if (coordinates.length !== 3 || typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number'
      || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) throw Error('CLOSE_CAMERA_SETUP_POSE_INVALID');
    // Use the actual source diagnostic for camera planning only.
    position = new Vector3(x, y, z);
  }
  place(view, position, distance);
  update(traffic, time, view, dpr);
  return { view, initial: requiredRow(traffic, id) };
}
function assertPhysical(actual: Row, initial: Row): void {
  expect(actual.carId).toBe(initial.carId);
  expect(actual.profile).toBe(initial.profile);
  expect(actual.physicalScale).toBe(initial.physicalScale);
  for (const scale of actual.scales) expect(Math.abs(scale - actual.physicalScale)).toBeLessThanOrEqual(1e-5);
}

describe('R44 close visibility from actual traffic buffers', () => {
  it('has exact unresolved and resolved CSS limits and continuous zoom weights', () => {
    const samples = [];
    for (const distance of [50, 200, 400, 700, 1200, 1500]) for (const presence of [0, 0.143, 0.5, 1]) {
      for (const css of [0, 0.125, 0.25, 0.3125, 0.5, 2, 6, 8]) samples.push({ distance, presence, css,
        actual: trafficHullVisibility(distance, presence, css), expected: expectedVisibility(distance, presence, css) });
    }
    receipt('scalar-limits', { samples });
    for (const sample of samples) expect(sample.actual).toBeCloseTo(sample.expected, 12);
    for (const dpr of [1, 1.25, 1.5]) {
      let previous = trafficHullVisibility(1200, 1, 0.125);
      for (let step = 1; step <= 400; step += 1) {
        const css = 0.125 + step * 0.375 / 400;
        const actual = trafficHullVisibility(1200, 1, css * dpr / dpr);
        expect(Number.isFinite(actual)).toBe(true);
        expect(actual).toBeGreaterThanOrEqual(previous - 1e-12);
        expect(actual - previous).toBeLessThanOrEqual(0.005);
        previous = actual;
      }
    }
  });

  it('keeps both CSS boundary values and slopes continuous without a metre gate', () => {
    const epsilon = 1e-8;
    for (const distance of [50, 200, 400, 700, 1200, 3000]) {
      for (const boundary of [0.125, 0.5]) {
        const before = trafficHullVisibility(distance, 1, boundary - epsilon);
        const centre = trafficHullVisibility(distance, 1, boundary);
        const after = trafficHullVisibility(distance, 1, boundary + epsilon);
        expect(Math.abs(after - before)).toBeLessThan(1e-6);
        expect(Math.abs((after - centre) / epsilon - (centre - before) / epsilon)).toBeLessThan(5e-6);
      }
    }
    for (const dpr of [1, 1.25, 1.5]) for (const css of [0, 0.125, 0.25, 0.499999]) {
      expect(css * dpr).toBeLessThan(1);
    }
  });

  it.each([1, 1.25, 1.5])('keeps all six real profiles opaque at 1200 m in three views at DPR %s', dpr => {
    const traffic = factory();
    try {
      const view = camera(62);
      view.position.set(0, 1500, 0);
      view.lookAt(0, 1500, -1);
      update(traffic, 12, view, dpr);
      const streak = traffic.objects.find(object => object.name === 'skyriver.traffic.streaks');
      if (!(streak instanceof Mesh) || !(streak.geometry instanceof InstancedBufferGeometry)) throw Error('CLOSE_REAL_STREAK_REQUIRED');
      const ids = streak.geometry.getAttribute('aCarLod'), profiles = streak.geometry.getAttribute('aCarShape');
      const selectedIds = Array.from({ length: 6 }, (_, profile) => {
        for (let slot = 0; slot < streak.geometry.instanceCount; slot += 1) {
          if (ids.getZ(slot) >= 114 && profiles.getX(slot) === profile) return ids.getZ(slot);
        }
        throw Error('CLOSE_REAL_PROFILE_REQUIRED:' + profile);
      });
      const samples = [];
      for (const id of selectedIds) {
        const initial = requiredRow(traffic, id);
        const forward = new Vector3(initial.matrix[8]!, initial.matrix[9]!, initial.matrix[10]!).normalize();
        const right = new Vector3(initial.matrix[0]!, initial.matrix[1]!, initial.matrix[2]!).normalize();
        for (const angle of [0, 45, 90]) {
          const radians = angle * Math.PI / 180;
          view.position.copy(initial.position).addScaledVector(forward, 1200 * Math.cos(radians))
            .addScaledVector(right, 1200 * Math.sin(radians));
          view.lookAt(initial.position);
          update(traffic, 12, view, dpr);
          const actual = requiredRow(traffic, id), projected = extent(actual, view);
          expect(actual.matrix).toEqual(initial.matrix);
          expect(projected.behind).toBe(false);
          expect(projected.css).toBeGreaterThanOrEqual(0.5);
          expect(actual.hullFade).toBe(1);
          expect(actual.lampFade).toBe(1);
          expect(actual.trailWeight).toBe(1);
          assertPhysical(actual, initial);
          samples.push({ id, profile: actual.profile, angle, dpr, projectedExtentCss: projected.css,
            distanceM: actual.position.distanceTo(view.position), hullFade: actual.hullFade,
            lampFade: actual.lampFade, trailWeight: actual.trailWeight, matrix: actual.matrix,
            camera: { world: view.matrixWorld.toArray(), projection: view.projectionMatrix.toArray() } });
        }
      }
      expect(samples).toHaveLength(18);
      receipt(`resolved18-${dpr}`, { selectedIds, samples });
    } finally { traffic.dispose(); }
  });

  it.each([1, 1.25, 1.5].flatMap(dpr => [50, 200, 400, 700].map(distance => ({ dpr, distance }))))
    ('retains admitted car 1000 at resolved $distance m and DPR $dpr through full low budget', ({ dpr, distance }) => {
      const traffic = factory();
      try {
        const { view, initial } = initialise(traffic, 1000, 10, distance, 8, dpr);
        const samples = []; let previous = initial.position;
        for (let frame = 1; frame <= 60; frame += 1) {
          if (frame === 10) traffic.setQuality(quality(TRAFFIC_QUALITY_TIERS.low));
          if (frame === 40) traffic.setQuality(quality(TRAFFIC_QUALITY_TIERS.high));
          place(view, previous, distance); update(traffic, 10 + frame / 60, view, dpr);
          const actual = row(traffic, 1000);
          samples.push({ frame, actual, projected: actual ? extent(actual, view) : null });
          if (actual) previous = actual.position;
        }
        receipt(`retained-${distance}-${dpr}`, { initial, samples });
        for (const sample of samples) {
          expect(sample.actual).not.toBeNull();
          const actual = sample.actual!;
          expect(sample.projected!.css).toBeGreaterThanOrEqual(0.5);
          expect(actual.hullFade).toBeGreaterThanOrEqual(0.99);
          expect(actual.lampFade).toBeGreaterThanOrEqual(0.99);
          expect(Math.abs(actual.hullFade - actual.lampFade)).toBeLessThanOrEqual(0.02);
          expect(actual.trailWeight).toBe(1); assertPhysical(actual, initial);
        }
        const fades = samples.map(sample => sample.actual!.hullFade);
        expect(Math.max(...fades) - Math.min(...fades)).toBeLessThanOrEqual(0.01);
        expect(previous.distanceTo(initial.position)).toBeGreaterThan(1);
        expect(traffic.stats().impostors).toBe(8);
        expect(traffic.stats().drawCalls).toBeLessThanOrEqual(32);
      } finally { traffic.dispose(); }
    });

  it('does not introduce a newly requested close car', () => {
    const reference = factory(), traffic = factory(TRAFFIC_QUALITY_TIERS.low);
    try {
      const { view } = initialise(reference, 1000, 10, 50, 62);
      update(traffic, 10, view);
      expect(row(traffic, 1000)).toBeNull();
      traffic.setQuality(quality(TRAFFIC_QUALITY_TIERS.high));
      const samples = [];
      for (let frame = 1; frame <= 60; frame += 1) {
        update(reference, 10 + frame / 60, view);
        place(view, requiredRow(reference, 1000).position, 50);
        update(traffic, 10 + frame / 60, view);
        samples.push({ frame, actual: row(traffic, 1000) });
      }
      receipt('pending-close', { samples });
      for (const sample of samples) if (sample.actual) {
        expect(sample.actual.hullFade).toBe(0); expect(sample.actual.lampFade).toBe(0);
      }
    } finally { reference.dispose(); traffic.dispose(); }
  });

  it('shares actual hull and lamp visibility at 1200 m without replacing the CPU ID', () => {
    const traffic = factory();
    try {
      const { view, initial } = initialise(traffic, 1000, 10, 1200, 62);
      const samples = []; let previous = initial.position;
      for (let frame = 1; frame <= 60; frame += 1) {
        if (frame === 10) traffic.setQuality(quality(TRAFFIC_QUALITY_TIERS.low));
        if (frame === 40) traffic.setQuality(quality(TRAFFIC_QUALITY_TIERS.high));
        place(view, previous, 1200); update(traffic, 10 + frame / 60, view);
        const actual = row(traffic, 1000);
        samples.push({ frame, actual, distance: actual?.position.distanceTo(view.position),
          projected: actual ? extent(actual, view) : null });
        if (actual) previous = actual.position;
      }
      receipt('shared-1200', { samples });
      for (const sample of samples) {
        expect(sample.actual).not.toBeNull(); const actual = sample.actual!;
        const expected = expectedVisibility(sample.distance!, 1, sample.projected!.css);
        expect(sample.projected!.css).toBeGreaterThanOrEqual(0.5);
        expect(actual.hullFade).toBe(1);
        expect(actual.lampFade).toBe(1);
        expect(Math.abs(actual.hullFade - expected)).toBeLessThanOrEqual(0.002);
        expect(Math.abs(actual.lampFade - actual.hullFade)).toBeLessThanOrEqual(0.02);
        expect(actual.trailWeight).toBe(1); assertPhysical(actual, initial);
      }
    } finally { traffic.dispose(); }
  });

  it.each(['escort-wrap', 'chase-window', 'stream-retarget', 'anchor-stop'] as const)
    ('keeps a moving continuous source through %s', scenario => {
      const traffic = factory();
      const phase = deriveTrafficParams(424242, 2400).phase;
      const plan: CarPlan = { role: 'free', stream: 255 };
      let id = scenario === 'escort-wrap' ? 3 : 14;
      if (scenario === 'chase-window') {
        const candidate = Array.from({ length: 110 }, (_, i) => i + 4).find(car => {
          carTrafficPlan(424242, car, plan); return plan.role === 'chase-free';
        });
        if (candidate === undefined) throw Error('CLOSE_REAL_CHASE_FREE_REQUIRED');
        id = candidate;
      }
      const start = scenario === 'escort-wrap' ? 1040 / 330 - 0.3 : scenario === 'chase-window' ? 0 : 14;
      const origin = phase[id]! * (12800 / 9) - (12800 / 18 - 160 - 1);
      const anchorY = scenario === 'escort-wrap' ? 1500 : 560;
      traffic.setAnchor(0, anchorY, 0, 0, 150, scenario === 'chase-window' ? origin : 0, 0);
      try {
        const setup = initialise(traffic, id, start, 200);
        const view = setup.view;
        let initial = setup.initial;
        let sampleStart = start;
        if (scenario === 'stream-retarget') {
          traffic.setAnchor(0, 2240, 0, 0, 150, 0, 0);
          place(view, initial.position, 200); update(traffic, 14.5, view);
          const prepared = requiredRow(traffic, id);
          place(view, prepared.position, 200); update(traffic, 15, view);
          initial = requiredRow(traffic, id); sampleStart = 15;
        }
        const samples = []; let previous = initial.position;
        for (let frame = 1; frame <= 60; frame += 1) {
          if (scenario === 'chase-window') traffic.setAnchor(0, 560, 0, 0, 150, origin - frame * 4, 0);
          place(view, previous, 200); update(traffic, sampleStart + frame / 60, view);
          const actual = row(traffic, id);
          samples.push({ frame, actual, stepM: actual?.position.distanceTo(previous),
            sourceArcInput: scenario === 'chase-window' ? origin - frame * 4 : 0 });
          if (actual) previous = actual.position;
        }
        receipt(scenario, { initial, sampleStart, samples });
        for (const sample of samples) {
          expect(sample.actual).not.toBeNull(); const actual = sample.actual!;
          expect(sample.stepM).toBeLessThanOrEqual(12);
          expect(actual.hullFade).toBeGreaterThanOrEqual(0.99);
          expect(actual.lampFade).toBeGreaterThanOrEqual(0.99); assertPhysical(actual, initial);
        }
        expect(previous.distanceTo(initial.position)).toBeGreaterThan(1);
      } finally { traffic.dispose(); }
    });

  it.each([1, 1.25, 1.5])('matches an independent real bounding-box projection at DPR %s', dpr => {
    const traffic = factory();
    try {
      const samples = [];
      for (const fov of [8, 20, 62]) for (const distance of [50, 200, 400, 700, 1200]) {
        const { view, initial } = initialise(traffic, 1000, 10, distance, fov, dpr);
        const projected = extent(initial, view);
        const fn = Reflect.get(traffic, 'carEvidence');
        const diagnostic: unknown = typeof fn === 'function' ? Reflect.apply(fn, traffic, [1000]) : null;
        samples.push({ fov, distance, actual: initial, projected, diagnostic });
      }
      receipt(`projection-${dpr}`, { samples });
      for (const sample of samples) {
        const expected = sample.projected.behind ? 0 : expectedVisibility(sample.distance, 1, sample.projected.css);
        expect(Math.abs(sample.actual.hullFade - expected)).toBeLessThanOrEqual(0.002);
        expect(Math.abs(sample.actual.lampFade - sample.actual.hullFade)).toBeLessThanOrEqual(0.02);
        const diagnostic = sample.diagnostic;
        if (typeof diagnostic === 'object' && diagnostic !== null && 'projectedExtentCssPx' in diagnostic) {
          expect(typeof diagnostic.projectedExtentCssPx).toBe('number');
          expect(Math.abs(Number(diagnostic.projectedExtentCssPx) - sample.projected.css)).toBeLessThanOrEqual(0.01);
        }
      }
      const { view, initial } = initialise(traffic, 1000, 10, 200);
      view.position.copy(initial.position); view.lookAt(initial.position.clone().add(new Vector3(0, 0, -1)));
      update(traffic, 10, view, dpr); const crossing = requiredRow(traffic, 1000);
      expect(extent(crossing, view).crossing).toBe(true);
      expect(crossing.hullFade).toBe(1); expect(crossing.lampFade).toBe(1);
    } finally { traffic.dispose(); }
  });
});
