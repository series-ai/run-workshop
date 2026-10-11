import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import baseline from './fixtures/r29-baseline.json';
import cameraBaseline from './fixtures/r29-camera-baseline.json';
import simControl from './fixtures/r29b-sim-control.json';
import exportsBefore from './fixtures/r29-exports.json';
import * as trafficExports from '../src/render/traffic';
import * as shuttleExports from '../src/render/shuttle';
import * as flightExports from '../src/render/flightPresentation';
import { skyriverQualityFor, SkyriverQualityTier } from '../src/render/scene';
import { createSkyriverTraffic, TRAFFIC_QUALITY_TIERS } from '../src/render/traffic';
import { createSkyriverShuttle, SHUTTLE_NOZZLE_ROOTS_LOCAL } from '../src/render/shuttle';
import { createFlightPresenter, createWorldWakeSamples, sampleWorldWake, SHUTTLE_DRAW_PITCH_SHARE } from '../src/render/flightPresentation';
import { CLEARANCE_SHUTTLE_RADIUS_M } from '../src/render/clearance';
import { CANYON_LOOP_LENGTH_M } from '../src/render/canyonWarp';
import { deriveFlightPath, createSkyriverSimConfig, createInitialState, advanceState } from '../src/sim/systems';
import { SKYRIVER_NEUTRAL_INPUT } from '../src/sim/input';
import { projectSkyriverState } from '../src/sim/runtime';
import { interpolateSkyriverFlight } from '../src/sim/session';
import type { SkyriverRenderState } from '../src/sim/session';
import { skyriverDeclaredStageRole } from '../src/render/stageRoles';
import { createCameraPoseScratch, writeCameraPose } from '../src/render/cameraRig';
import { SKYRIVER_SIM_MODULE_MANIFEST } from '../src/sim/module-manifest';

function frame(sample: typeof baseline.samples[number], alpha = sample.alpha): SkyriverRenderState {
  return { tick: sample.tick, alpha, previous: sample.previous, current: sample.current,
    flight: sample.current.flight as SkyriverRenderState['flight'], camera: sample.current.camera,
    localSlot: 0, status: 'offline' } as SkyriverRenderState;
}
function routeDelta(a: number, b: number): number {
  const d = b - a;
  return d - CANYON_LOOP_LENGTH_M * Math.round(d / CANYON_LOOP_LENGTH_M);
}
function hotTriangles(g: THREE.BufferGeometry): string[] {
  const p = g.getAttribute('position'), c = g.getAttribute('color'), index = g.index;
  const count = index ? index.count : p.count;
  const records: string[] = [];
  for (let at = 0; at < count; at += 3) {
    let hot = true;
    const corners: string[] = [];
    for (let k = 0; k < 3; k += 1) {
      const i = index ? index.getX(at + k) : at + k;
      const rgb = [c.getX(i), c.getY(i), c.getZ(i)];
      hot &&= Math.max(...rgb) > 0.9;
      corners.push([p.getX(i), p.getY(i), p.getZ(i), ...rgb].join(','));
    }
    if (hot) records.push(corners.sort().join('|'));
  }
  return records.sort();
}
interface IndexedRayHit {
  readonly distance: number;
  readonly point: THREE.Vector3;
  readonly colours: readonly (readonly number[])[];
}
function nearestIndexedHit(g: THREE.BufferGeometry, origin: THREE.Vector3): IndexedRayHit | null {
  const p = g.getAttribute('position'), c = g.getAttribute('color'), index = g.index;
  if (index === null) throw new Error('R29_INDEXED_NOZZLE_GEOMETRY_MISSING');
  const ray = new THREE.Ray(origin, new THREE.Vector3(0, 0, 1));
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), point = new THREE.Vector3();
  let nearest: IndexedRayHit | null = null;
  for (let at = 0; at < index.count; at += 3) {
    const ids = [index.getX(at), index.getX(at + 1), index.getX(at + 2)];
    a.fromBufferAttribute(p, ids[0]!); b.fromBufferAttribute(p, ids[1]!); d.fromBufferAttribute(p, ids[2]!);
    // The real hull material is DoubleSide. Both triangle directions can occlude the core.
    if (ray.intersectTriangle(a, b, d, false, point) === null) continue;
    const distance = origin.distanceTo(point);
    if (nearest !== null && nearest.distance <= distance) continue;
    nearest = { distance, point: point.clone(), colours: ids.map(i => [c.getX(i), c.getY(i), c.getZ(i)]) };
  }
  return nearest;
}

function checkTriangles(g: THREE.BufferGeometry): void {
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), c = g.getAttribute('color');
  expect(g.index).not.toBeNull();
  expect(n.count).toBe(p.count);
  expect(c.count).toBe(p.count);
  for (const attr of [p, n, c]) expect(Array.from(attr.array).every(Number.isFinite)).toBe(true);
  const index = g.index!;
  expect(index.count % 3).toBe(0);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  const cross = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let at = 0; at < index.count; at += 3) {
    const ids = [index.getX(at), index.getX(at + 1), index.getX(at + 2)];
    for (const i of ids) { expect(Number.isInteger(i)).toBe(true); expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(p.count); }
    a.fromBufferAttribute(p, ids[0]!); b.fromBufferAttribute(p, ids[1]!); d.fromBufferAttribute(p, ids[2]!);
    cross.crossVectors(b.sub(a), d.sub(a));
    expect(cross.lengthSq()).toBeGreaterThan(1e-12);
    cross.normalize();
    for (const i of ids) {
      normal.fromBufferAttribute(n, i);
      expect(normal.length()).toBeCloseTo(1, 5);
      expect(normal.dot(cross)).toBeGreaterThan(0.99);
    }
  }
}

function initializedPresenter(seed: number) {
  const presenter = createFlightPresenter(seed);
  presenter.resetTimeline(1);
  return presenter;
}
function ingestModeEdge(presenter: ReturnType<typeof createFlightPresenter>, state: SkyriverRenderState, epoch = 1): void {
  if (state.previous.flight.mode !== state.current.flight.mode) presenter.observeModeEdge(state, epoch);
}

describe('R29 independent vehicle and presentation contracts', () => {
  it('keeps steady camera endpoints equal to the frozen pre-R29 rig in both modes', () => {
    expect(cameraBaseline.samples).toHaveLength(64);
    expect(new Set(cameraBaseline.samples.map(sample => sample.flight.mode))).toEqual(new Set([0, 1]));
    const camera = createCameraPoseScratch();
    for (const sample of cameraBaseline.samples) {
      const flight = { ...sample.flight, mode: sample.flight.mode === 0 ? 0 as const : 1 as const };
      expect(writeCameraPose(camera, flight, sample.camera, sample.effects), `seed${sample.seed} mode${flight.mode} tick${sample.tick} boost${sample.effects.boost}`).toEqual(sample.expected);
    }
  });

  it('keeps old public exports and the selected high DPR cap', () => {
    for (const [key, module] of [['traffic', trafficExports], ['shuttle', shuttleExports], ['flight', flightExports]] as const) {
      for (const name of exportsBefore[key]) expect(Object.keys(module)).toContain(name);
    }
    expect(skyriverQualityFor(SkyriverQualityTier.High).dpr).toBe(1.25);
  });

  it('keeps simulation source bytes except the authorized numeric bounds shrink', () => {
    for (const [file, sha] of Object.entries(baseline.simHashes)) {
      const bytes = readFileSync(new URL('../src/sim/' + file, import.meta.url));
      if (file !== 'systems.ts') {
        expect(createHash('sha256').update(bytes).digest('hex'), file).toBe(sha);
        continue;
      }
      expect(simControl.systemsSha256).toBe(sha);
      const source = bytes.toString('utf8');
      const declaration = /export const CHASM_BOUNDS = Object.freeze\(\{([\s\S]*?)\}\);/.exec(source);
      expect(declaration).not.toBeNull();
      const body = declaration![1]!, fields = [...body.matchAll(/\b(minX|maxX|minY|maxY|minZ|maxZ)\s*:\s*(-?\d+(?:\.\d+)?)/g)];
      expect(fields.map(match => match[1])).toEqual(Object.keys(simControl.bounds));
      for (const match of fields) {
        const key = match[1]! as keyof typeof simControl.bounds, value = Number(match[2]);
        if (key === 'minX' || key === 'minY') expect(value).toBeGreaterThanOrEqual(simControl.bounds[key]);
        else if (key === 'maxX') expect(value).toBeLessThanOrEqual(simControl.bounds[key]);
        else expect(value).toBe(simControl.bounds[key]);
      }
      const maskedBody = body.replace(/(\b(?:minX|maxX|minY)\s*:\s*)-?\d+(?:\.\d+)?/g, '$1<BOUND>');
      const normalized = source.replace(declaration![0], declaration![0].replace(body, maskedBody));
      expect(createHash('sha256').update(normalized).digest('hex')).toBe(simControl.systemsOutsideBoundsSha256);
    }
    expect(createHash('sha256').update(readFileSync(new URL('../src/sim/identity.ts', import.meta.url))).digest('hex')).toBe(simControl.identitySourceSha256);
    const manifest = readFileSync(new URL('../src/sim/module-manifest.ts', import.meta.url), 'utf8');
    const normalizedManifest = manifest.replace(/(path: 'systems.ts', digest: ')[a-f0-9]+(')/, '$1<SYSTEMS>$2').replace(/(engineIdentityHash: ')[a-f0-9]+(')/, '$1<ENGINE>$2');
    expect(createHash('sha256').update(normalizedManifest).digest('hex')).toBe(simControl.manifestOutsideAllowedDigestsSha256);
    for (const module of SKYRIVER_SIM_MODULE_MANIFEST) {
      expect(createHash('sha256').update(readFileSync(new URL('../src/sim/' + module.path, import.meta.url))).digest('hex'), module.path).toBe(module.digest);
    }
  });

  it('reduces real neutral-state route and mean world pose derivatives by 25 to 35 percent', () => {
    for (const seed of [424242, 0, 2147483647, 4294967295]) {
      const presenter = initializedPresenter(seed);
      let oldWorld = 0, newWorld = 0;
      for (const sample of baseline.samples.filter(s => s.seed === seed)) {
        const a = { ...presenter.present(frame(sample), 1) };
        const epsilon = 0.0001;
        const b = { ...presenter.present(frame(sample, sample.alpha + epsilon), 1) };
        const route = routeDelta(a.canyonV, b.canyonV) / epsilon;
        const oldRoute = routeDelta(0, sample.routeDerivative * epsilon) / epsilon;
        expect(route / oldRoute).toBeGreaterThanOrEqual(0.65);
        expect(route / oldRoute).toBeLessThanOrEqual(0.75);
        newWorld += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / epsilon;
        oldWorld += Math.hypot(...sample.derivative);
      }
      expect(newWorld / oldWorld).toBeGreaterThanOrEqual(0.65);
      expect(newWorld / oldWorld).toBeLessThanOrEqual(0.75);
    }
  });

  it('keeps autopilot poses equal after reverse seeks and fresh presenter creation', () => {
    const samples = baseline.samples.filter(s => s.seed === 424242 && s.alpha === 0.5);
    const presenter = initializedPresenter(424242);
    const expected = samples.map(s => ({ ...initializedPresenter(s.seed).present(frame(s), 1) }));
    for (let i = samples.length - 1; i >= 0; i -= 1) expect({ ...presenter.present(frame(samples[i]!), 1) }).toEqual(expected[i]);
    for (let i = 0; i < samples.length; i += 1) expect({ ...presenter.present(frame(samples[i]!), 1) }).toEqual(expected[i]);
  });

  it('crosses the presentation lap seam without a pose jump', () => {
    const seed = 424242, path = deriveFlightPath(seed);
    const ringLength = Array.from(path.segmentLength).reduce((sum, x) => sum + x, 0);
    const lapTicks = ringLength / (0.7 * 150) * 30;
    const sample = baseline.samples.find(s => s.seed === seed)!;
    const presenter = initializedPresenter(seed);
    function at(time: number) {
      const state = frame(sample, time - Math.floor(time));
      const tick = Math.floor(time);
      return { ...presenter.present({ ...state, tick, previous: { ...state.previous, tick: tick - 1 }, current: { ...state.current, tick } }, 1) };
    }
    for (const lap of [1, 2, 5]) {
      const a = at(lap * lapTicks - 0.0001), b = at(lap * lapTicks + 0.0001);
      expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(0.01);
      expect(Math.abs(routeDelta(a.canyonV, b.canyonV))).toBeLessThan(0.01);
    }
  });

  it('replays real mode transitions after explicit event ingestion', () => {
    const seed = 424242, config = createSkyriverSimConfig(seed, 'autopilot');
    let previous = createInitialState(config);
    const frames: SkyriverRenderState[] = [];
    for (let tick = 1; tick <= 850; tick += 1) {
      const current = advanceState(previous, [{ ...SKYRIVER_NEUTRAL_INPUT, modeToggle: tick === 600 || tick === 740 }], config);
      const p = projectSkyriverState(previous, null), c = projectSkyriverState(current, previous);
      const interpolation = interpolateSkyriverFlight(p, c, 0.5);
      frames.push({ tick: c.tick, previous: p, current: c, ...interpolation, localSlot: 0, status: 'offline' });
      previous = current;
    }
    const presenter = initializedPresenter(seed), expected = frames.map(f => { ingestModeEdge(presenter, f); return { ...presenter.present(f, 1) }; });
    for (let i = 0; i < frames.length; i += 1) expect({ ...presenter.present(frames[i]!, 1) }).toEqual(expected[i]);
    const clean = initializedPresenter(seed);
    for (let i = 0; i < frames.length; i += 1) {
      ingestModeEdge(clean, frames[i]!);
      expect({ ...clean.present(frames[i]!, 1) }).toEqual(expected[i]);
    }
    for (let i = 675; i < 720; i += 1) {
      const p = expected[i]!, f = frames[i]!.flight;
      expect([p.x, p.y, p.z, p.yaw, p.pitch, p.speed]).toEqual([f.x, f.y, f.z, f.yaw, f.pitch, f.speed]);
    }
    for (const i of [599, 600, 739, 740]) {
      const a = expected[i - 1]!, b = expected[i]!;
      expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(20);
    }
  });

  it('keeps indexed triangles, old lamp records, bounds and draw roles on the actual meshes', () => {
    const traffic = createSkyriverTraffic({ seed: 424242, quality: TRAFFIC_QUALITY_TIERS.high, maxImpostors: 20000 });
    const shuttle = createSkyriverShuttle();
    try {
      expect(traffic.objects).toHaveLength(8);
      expect(shuttle.objects).toHaveLength(1);
      const meshes: THREE.Mesh[] = [];
      for (const object of [...traffic.objects, ...shuttle.objects]) object.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o); });
      expect(meshes).toHaveLength(10);
      for (const before of baseline.meshes) {
        const mesh = meshes.find(m => m.name === before.name)!;
        expect(mesh, before.name).toBeDefined();
        checkTriangles(mesh.geometry);
        const actualHot = hotTriangles(mesh.geometry);
        if (before.name === 'skyriver.shuttle.hull') {
          const retained = before.emissiveTriangles.filter(record => !record.includes(',0.8999999761581421,1.2999999523162842,2'));
          expect(retained).toHaveLength(48);
          for (const record of retained) expect(actualHot).toContain(record);
          expect(actualHot).toHaveLength(72);
        } else expect(actualHot, before.name).toEqual(before.emissiveTriangles);
        mesh.geometry.computeBoundingBox();
        const bounds = [...mesh.geometry.boundingBox!.min.toArray(), ...mesh.geometry.boundingBox!.max.toArray()];
        if (before.name === 'skyriver.shuttle.hull') expect(bounds).toEqual([-4.15, -1.08, -6.11, 4.15, 1.72, 8.15].map(Math.fround));
        else bounds.forEach((x, i) => expect(x, before.name).toBeCloseTo(before.bounds[i]!, 5));
        expect(skyriverDeclaredStageRole(mesh)).toBe(before.role);
        const material = mesh.material as THREE.Material;
        expect(material.type).toBe(before.materialType);
        expect(material.transparent).toBe(before.transparent);
        expect(material.depthWrite).toBe(before.depthWrite);
      }
      for (const mesh of meshes) expect(skyriverDeclaredStageRole(mesh)).not.toBeNull();
    } finally { traffic.dispose(); shuttle.dispose(); }
  });

  it('keeps smooth glass reflection normals separate from winding and inside the existing clearance sphere', () => {
    const shuttle = createSkyriverShuttle(), hull = shuttle.objects[0]! as THREE.Mesh;
    try {
      const g = hull.geometry, p = g.getAttribute('position'), n = g.getAttribute('normal');
      const reflection = g.getAttribute('aSurfaceNormal'), glass = g.getAttribute('aGlass'), index = g.index!;
      expect(reflection.count).toBe(p.count); expect(glass.count).toBe(p.count);
      const sums = new Map<string, THREE.Vector3>();
      const key = (i: number) => [p.getX(i), p.getY(i), p.getZ(i)].join(',');
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      let smoothCount = 0;
      for (let at = 0; at < index.count; at += 3) {
        const ids = [index.getX(at), index.getX(at + 1), index.getX(at + 2)];
        if (glass.getX(ids[0]!) !== 1) continue;
        a.fromBufferAttribute(p, ids[0]!); b.fromBufferAttribute(p, ids[1]!); c.fromBufferAttribute(p, ids[2]!);
        const cross = new THREE.Vector3().crossVectors(b.sub(a), c.sub(a));
        for (const i of ids) {
          const sum = sums.get(key(i)) ?? new THREE.Vector3(); sum.add(cross); sums.set(key(i), sum);
        }
      }
      for (let i = 0; i < p.count; i += 1) {
        expect(Math.hypot(p.getX(i), p.getY(i), p.getZ(i))).toBeLessThan(CLEARANCE_SHUTTLE_RADIUS_M);
        expect([0, 1]).toContain(glass.getX(i));
        const actual = new THREE.Vector3().fromBufferAttribute(reflection, i);
        expect(actual.length()).toBeCloseTo(1, 5);
        if (glass.getX(i) === 1) {
          const expected = sums.get(key(i))!.clone().normalize();
          expect(actual.distanceTo(expected)).toBeLessThan(2e-6);
          if (actual.distanceTo(new THREE.Vector3().fromBufferAttribute(n, i)) > 0.01) smoothCount += 1;
        }
      }
      expect(smoothCount).toBeGreaterThan(100);
      const material = hull.material as THREE.MeshBasicMaterial;
      const shader = { vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader, uniforms: {} };
      Reflect.apply(material.onBeforeCompile, material, [shader, null]);
      expect(shader.vertexShader).toContain('aSurfaceNormal');
      expect(shader.fragmentShader).toContain('uniform vec3 uPickupColor[8];');
      expect(shader.fragmentShader).toContain('diffuseColor.rgb += pickup;');
      expect(shader.fragmentShader).toContain('localAreaLight( uPickupPosition[i].w, distanceM )');
      const count = Reflect.get(shader.uniforms, 'uPickupCount') as { value: number };
      expect(count.value).toBe(0);
    } finally { shuttle.dispose(); }
  });

  it('shows each emissive throat before any dark rear cap and retains its surrounding collar', () => {
    const shuttle = createSkyriverShuttle(), hull = shuttle.objects[0]! as THREE.Mesh;
    try {
      for (const [x, y, z] of SHUTTLE_NOZZLE_ROOTS_LOCAL) {
        const origin = new THREE.Vector3(x, y, z - 20);
        const core = nearestIndexedHit(hull.geometry, origin);
        expect(core, `No throat hit at x=${x}`).not.toBeNull();
        expect(core!.point.z).toBeCloseTo(-6.063, 6);
        for (const rgb of core!.colours) {
          expect(Math.max(...rgb), `Dark cap is the first hit at ${core!.point.toArray()}`).toBeGreaterThan(1);
          expect(rgb[0]).toBeGreaterThan(rgb[1]!); expect(rgb[1]).toBeGreaterThan(rgb[2]!);
          [1.5, 0.32, 0.07].forEach((channel, i) => expect(rgb[i]).toBeCloseTo(channel, 6));
        }
        for (const [dx, dy] of [[-0.6, 0], [0.6, 0], [0, -0.3], [0, 0.3]]) {
          const collar = nearestIndexedHit(hull.geometry, new THREE.Vector3(x + dx!, y + dy!, z - 20));
          expect(collar, `No collar hit at ${x + dx!},${y + dy!}`).not.toBeNull();
          expect(collar!.point.z).toBeCloseTo(-6.11, 6);
          for (const rgb of collar!.colours) expect(Math.max(...rgb)).toBeLessThan(0.9);
        }
      }
    } finally { shuttle.dispose(); }
  });

  it('keeps physical nozzle roots inside their pod and welds the slowed pose to the drawn hull', () => {
    expect(SHUTTLE_NOZZLE_ROOTS_LOCAL).toEqual([[-2.05, -0.42, -6.1], [2.05, -0.42, -6.1]]);
    const sample = baseline.samples.find(s => s.seed === 424242 && s.tick === 1200)!;
    const pose = initializedPresenter(sample.seed).present(frame(sample), 1);
    const shuttle = createSkyriverShuttle();
    const hull = shuttle.objects[0]! as THREE.Mesh;
    const p = hull.geometry.getAttribute('position');
    try {
      for (const root of SHUTTLE_NOZZLE_ROOTS_LOCAL) {
        const xs: number[] = [], ys: number[] = [], zs: number[] = [];
        for (let i = 0; i < p.count; i += 1) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          if (Math.abs(x - root[0]) <= 0.9 && z < -5.5) { xs.push(x); ys.push(y); zs.push(z); }
        }
        expect(xs.length).toBeGreaterThan(0);
        for (const [axis, centre] of [[xs, root[0]], [ys, root[1]], [zs, root[2]]] as const) {
          expect(Math.min(...axis)).toBeLessThanOrEqual(centre + 1e-6);
          expect(Math.max(...axis)).toBeGreaterThanOrEqual(centre - 1e-6);
        }
      }
      shuttle.setPose(pose.x, pose.y, pose.z, pose.yaw, pose.pitch * SHUTTLE_DRAW_PITCH_SHARE, pose.roll);
      hull.updateMatrixWorld(true);
      const wake = createWorldWakeSamples(); sampleWorldWake(pose, 7.25, wake);
      for (let nozzle = 0; nozzle < 2; nozzle += 1) {
        const v = new THREE.Vector3(...SHUTTLE_NOZZLE_ROOTS_LOCAL[nozzle]!).applyMatrix4(hull.matrixWorld);
        const centers = nozzle === 0 ? wake.leftCenters : wake.rightCenters;
        [v.x, v.y, v.z].forEach((x, i) => expect(centers[i]).toBe(Math.fround(x)));
      }
    } finally { shuttle.dispose(); }
  });
});
