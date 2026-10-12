import { afterAll, describe, expect, it } from 'vitest';
import { BufferGeometry, InstancedBufferGeometry, InstancedMesh, Frustum, Matrix4, Mesh, PerspectiveCamera, Ray, Sphere, Vector3 } from 'three';
import { deriveTrafficParams } from '../src/sim/derive';
import { carTrafficPlan, createSkyriverTraffic, TRAFFIC_QUALITY_TIERS } from '../src/render/traffic';
import { createSkyriverShuttle, SHUTTLE_NOZZLE_ROOTS_LOCAL, SHUTTLE_WAKE_SAMPLE_COUNT } from '../src/render/shuttle';
import { TRAFFIC_APPEARANCE_PROFILES, trafficRenderProfile, unpackTrafficAppearance } from '../src/render/trafficAppearance';
import { deriveImpostorAttributes, impostorFlow, newImpostorFlowReport, STREAMS } from '../src/render/trafficStreams';

const names = ['cab', 'interceptor', 'commuter', 'van', 'bus', 'flatbed'] as const;
const traffic = createSkyriverTraffic({ seed: 424242, quality: TRAFFIC_QUALITY_TIERS.high, maxImpostors: 20000 });
const shuttle = createSkyriverShuttle();
afterAll(() => {
  traffic.dispose();
  shuttle.dispose();
});
function geometry(name: string): BufferGeometry {
  const object = [...traffic.objects, ...shuttle.objects].find((o) => o.name === name);
  if (!(object instanceof Mesh)) throw new Error('R39_REAL_MESH_MISSING:' + name);
  return object.geometry;
}
function triangles(g: BufferGeometry) {
  const p = g.getAttribute('position'),
    n = g.getAttribute('normal'),
    c = g.getAttribute('color'),
    index = g.index!;
  return Array.from({ length: index.count / 3 }, (_, t) => {
    const ids = [0, 1, 2].map((k) => index.getX(t * 3 + k));
    const points = ids.map((i) => new Vector3().fromBufferAttribute(p, i));
    const color = ids.map((i) => [c.getX(i), c.getY(i), c.getZ(i)]);
    const normal = new Vector3().fromBufferAttribute(n, ids[0]!);
    const area = points[1]!.clone().sub(points[0]!).cross(points[2]!.clone().sub(points[0]!)).length() * 0.5;
    return { ids, points, color, normal, area };
  });
}
function bodyHit(g: BufferGeometry, ray: Ray, frontOnly = false): number | undefined {
  const point = new Vector3();
  let distance = Infinity;
  for (const face of triangles(g)) {
    if (face.color.some((rgb) => Math.max(...rgb) > 0.9)) continue;
    if (ray.intersectTriangle(face.points[0]!, face.points[1]!, face.points[2]!, frontOnly, point)) {
      distance = Math.min(distance, ray.origin.distanceTo(point));
    }
  }
  return Number.isFinite(distance) ? distance : undefined;
}

describe('R39 independent physical vehicle output', () => {
  it.each(names)('%s has broad canted area and three visible material tones', (name) => {
    const faces = triangles(geometry('skyriver.traffic.' + name)).filter((face) => face.color.every((rgb) => Math.max(...rgb) < 0.9));
    const area = faces.reduce((sum, face) => sum + face.area, 0);
    const canted = faces
      .filter((face) => face.normal.toArray().filter((v) => Math.abs(v) > 0.35 && Math.abs(v) < 0.94).length >= 2)
      .reduce((sum, face) => sum + face.area, 0);
    expect(canted / area).toBeGreaterThan(0.12);
    const tones = faces.map((face) => face.color[0]!.reduce((sum, v) => sum + v, 0) / 3);
    for (const [low, high] of [
      [0, 0.025],
      [0.03, 0.075],
      [0.085, 0.2],
    ]) {
      expect(tones.filter((v) => v >= low! && v < high!).length).toBeGreaterThan(5);
    }
  });

  it.each(names)('%s uses valid indexed faces within the 800 triangle cap', (name) => {
    const g = geometry('skyriver.traffic.' + name),
      p = g.getAttribute('position');
    expect(g.index!.count / 3).toBeLessThanOrEqual(800);
    expect(g.index!.count / 3).toBeGreaterThan(300);
    for (const face of triangles(g)) {
      expect(face.area).toBeGreaterThan(1e-8);
      const cross = face.points[1]!.clone().sub(face.points[0]!).cross(face.points[2]!.clone().sub(face.points[0]!)).normalize();
      expect(cross.dot(face.normal)).toBeGreaterThan(0.9999);
      for (const id of face.ids) expect(id).toBeLessThan(p.count);
    }
  });

  it.each(names)('%s assigns the pane flag only to recessed glazing faces', (name) => {
    const g = geometry('skyriver.traffic.' + name), panes = g.getAttribute('aGlass');
    expect(panes.count).toBe(g.getAttribute('position').count);
    expect(Array.from(panes.array).filter(v => v === 1).length).toBeGreaterThan(12);
    for (const face of triangles(g)) {
      const flags = face.ids.map(id => panes.getX(id));
      expect(flags.every(v => v === 0 || v === 1)).toBe(true);
      expect(new Set(flags).size).toBe(1);
      if (flags[0] === 1) expect(face.color.every(rgb => Math.max(...rgb) < 0.025)).toBe(true);
      if (face.color.some(rgb => Math.max(...rgb) > 0.9)) expect(flags[0]).toBe(0);
    }
  });

  it.each(names)('%s has neutral glass behind a physical frame', (name) => {
    const g = geometry('skyriver.traffic.' + name),
      faces = triangles(g);
    const pane = faces.find((face) => face.color.every((rgb) => rgb[0]! < 0.025 && rgb[1]! > rgb[0]! * 1.08 && rgb[2]! > rgb[1]! * 1.08));
    expect(pane).toBeDefined();
    const centre = pane!.points.reduce((sum, p) => sum.addScaledVector(p, 1 / 3), new Vector3());
    const ray = new Ray(centre.clone().addScaledVector(pane!.normal, 0.4), pane!.normal.clone().negate());
    expect(bodyHit(g, ray)).toBeCloseTo(0.4, 5);
    const higher = faces
      .filter((face) => face.color[0]!.every((v) => v > 0.04) && face.normal.dot(pane!.normal) > 0.9)
      .map((face) => face.points[0]!.clone().sub(centre).dot(pane!.normal));
    expect(higher.some((depth) => depth > 0.04 && depth < 0.13)).toBe(true);
  });

  it.each(names)('%s supports every physical lamp corner on its body', (name) => {
    const type = names.indexOf(name),
      g = geometry('skyriver.traffic.' + name),
      profile = TRAFFIC_APPEARANCE_PROFILES[type]!;
    for (const [lamp, end] of [
      [profile.front, 1],
      [profile.rear, -1],
    ] as const) {
      for (const x of lamp.kind === 'pair' ? [-lamp.centreXM, lamp.centreXM] : [0]) {
        for (const sx of [-0.499, 0, 0.499])
          for (const sy of [-0.499, 0, 0.499]) {
            const point = new Vector3(x + sx * lamp.widthM, lamp.yM + sy * lamp.heightM, lamp.zM + end * 0.02);
            const distance = bodyHit(g, new Ray(point, new Vector3(0, 0, -end)));
            expect(distance, `${name} ${end} ${sx} ${sy}`).toBeDefined();
            expect(distance!).toBeGreaterThanOrEqual(0.02 - 1e-5);
            expect(distance!).toBeLessThan(0.2);
          }
      }
    }
  });

  it.each([
    ['cab', 1.4, -0.16, 0.9],
    ['interceptor', 1.21, -0.04, 0.5],
    ['commuter', 1.28, -0.51, 0.8],
    ['van', 1.42, -0.32, 1.65],
    ['bus', 0.75, -0.97, 3.4],
    ['flatbed', 1.35, -0.14, 2.95],
  ] as const)('%s has two open canted ports with real back depth', (name, x, y, z) => {
    const g = geometry('skyriver.traffic.' + name),
      normal = new Vector3(0, Math.SQRT1_2, Math.SQRT1_2);
    for (const side of [-1, 1]) {
      const origin = new Vector3(side * x, y, z).addScaledVector(normal, 0.08);
      expect(bodyHit(g, new Ray(origin, normal.clone().negate()))).toBeCloseTo(0.24, 5);
    }
  });

  it.each([
    ['cab', 1.4, -0.16, -0.3],
    ['interceptor', 1.21, -0.04, -1.15],
    ['commuter', 1.28, -0.51, -1.1],
    ['van', 1.42, -0.32, 0.65],
    ['bus', 0.75, -0.97, 2.5],
    ['flatbed', 1.35, -0.14, 2.2],
  ] as const)('%s has exposed rear exhaust backs behind the physical rim', (name, x, y, z) => {
    const g = geometry('skyriver.traffic.' + name);
    for (const side of [-1, 1]) {
      for (const dx of [-0.035, 0, 0.035]) {
        const origin = new Vector3(side * x + dx, y, z - 0.08);
        expect(bodyHit(g, new Ray(origin, new Vector3(0, 0, 1)))).toBeCloseTo(0.26, 5);
      }
    }
  });

  it('closes both bus window to body and window to roof side joints', () => {
    const g = geometry('skyriver.traffic.bus');
    for (const side of [-1, 1]) for (const z of [-3.4, -2.4, -1.2, 0, 1.2, 2.4, 3.4]) {
      for (const x of [1.02, 1.08, 1.16]) {
        expect(bodyHit(g, new Ray(new Vector3(side * x, 0.179, z), new Vector3(0, 1, 0)))).toBeCloseTo(0.001, 5);
      }
      for (const x of [1.06, 1.09, 1.11]) {
        expect(bodyHit(g, new Ray(new Vector3(side * x, 0.741, z), new Vector3(0, -1, 0)))).toBeCloseTo(0.001, 5);
      }
    }
  });

  it('closes the bus belts and end joints from visible outside directions', () => {
    const g = geometry('skyriver.traffic.bus');
    for (const side of [-1, 1]) {
      const lowerOuterX = 1.2 - ((0.05 / 0.505) * 0.09 * 3.5) / 7.15;
      expect(bodyHit(g, new Ray(new Vector3(side * 1.4, 0.08, 0), new Vector3(-side, 0, 0)), true)).toBeCloseTo(1.4 - lowerOuterX, 5);
      expect(bodyHit(g, new Ray(new Vector3(side * 1.34, 0.79, 0), new Vector3(-side, 0, 0)), true)).toBeCloseTo(1.34 - 1.1241666667, 5);
      for (const end of [-1, 1]) {
        const bodyTop = new Vector3(side * (end < 0 ? 1 : 0.92), end < 0 ? 0.17 : 0.18, end * 4.1);
        const bodyShoulder = new Vector3(side * (end < 0 ? 1.2 : 1.11), end < 0 ? -0.03 : -0.01, end * 4.1);
        const windowFoot = new Vector3(side * 1.11, 0.18, end * 4.105);
        const target = bodyTop.add(bodyShoulder).add(windowFoot).multiplyScalar(1 / 3);
        const outside = new Vector3(side * 0.1, -0.06, end * 0.14);
        expect(bodyHit(g, new Ray(target.clone().add(outside), outside.clone().normalize().negate()), true)).toBeCloseTo(outside.length(), 5);
        const roofTarget = new Vector3(side * ((1.015 + 1.04 + 1.04) / 3), (0.74 + 0.765 + 0.74) / 3, end * 4.105);
        const above = new Vector3(side * 0.1, 0.06, end * 0.14);
        expect(bodyHit(g, new Ray(roofTarget.clone().add(above), above.clone().normalize().negate()), true)).toBeCloseTo(above.length(), 5);
      }
    }
  });

  it('keeps both rear roof chamfer triangles visible from above', () => {
    const g = geometry('skyriver.traffic.bus');
    for (const side of [-1, 1]) {
      const corners = [
        new Vector3(side * 1, 0.795, -4.105),
        new Vector3(side * 0.88, 0.83, -3.6),
        new Vector3(side * 0.81, 0.9, -3.6),
        new Vector3(side * 0.975, 0.82, -4.105),
      ];
      for (const ids of [[0, 1, 2], [0, 2, 3]]) {
        const target = ids.reduce((sum, i) => sum.add(corners[i]!), new Vector3()).multiplyScalar(1 / 3);
        const outside = new Vector3(side * 0.08, 0.1, 0);
        expect(bodyHit(g, new Ray(target.clone().add(outside), outside.clone().normalize().negate()), true)).toBeCloseTo(outside.length(), 5);
      }
    }
  });

  it('closes the bus front window and roof lip with real surfaces', () => {
    const g = geometry('skyriver.traffic.bus');
    for (const x of [-0.98, -0.5, 0, 0.5, 0.98])
      for (const y of [0.2, 0.35, 0.5, 0.7]) {
        const hit = bodyHit(g, new Ray(new Vector3(x, y, 4.2), new Vector3(0, 0, -1)));
        expect(hit).toBeDefined();
        expect(hit!).toBeLessThan(0.22);
      }
  });

  it('keeps six true instance batches and eight traffic draws', () => {
    expect(TRAFFIC_APPEARANCE_PROFILES.map((profile) => profile.name)).toEqual(names);
    expect(traffic.objects.filter((o) => o instanceof InstancedMesh)).toHaveLength(6);
    expect(traffic.objects).toHaveLength(8);
    expect(traffic.stats().drawCalls).toBe(8);
  });

  it('uses the required primary, variant, and freight routes for all simulation classes', () => {
    expect([0, 1, 2].map((a) => trafficRenderProfile(a, false, false))).toEqual([0, 1, 2]);
    expect([0, 1, 2].map((a) => trafficRenderProfile(a, true, false))).toEqual([3, 2, 4]);
    for (const a of [0, 1, 2]) for (const variant of [false, true]) expect(trafficRenderProfile(a, variant, true)).toBe(5);
  });

  it.each([0, 424242, 2147483647, 4294967295])('routes every logical CPU car and allocates the exact visible hull and lamp partition for seed %i', (seed) => {
    const params = deriveTrafficParams(seed, 2400);
    for (const mode of ['view-frame', 'sphere-compatibility'] as const) {
      const actual = createSkyriverTraffic({ seed, quality: TRAFFIC_QUALITY_TIERS.high, maxImpostors: 0 });
      const camera = new PerspectiveCamera(62, 1280 / 720, 1, 14000);
      camera.position.set(0, 1500, 0); camera.lookAt(0, 1500, -1000); camera.updateMatrixWorld(true);
      const cssAngle = mode === 'view-frame' ? 2 / (camera.projectionMatrix.elements[5]! * 720) : 0.0012;
      try {
        actual.setAnchor(0, 1500, 0, 0, 160, 0, 0);
        if (mode === 'view-frame') {
          actual.setPixelAngle(cssAngle, cssAngle);
          actual.setCameraFrame(camera.matrixWorldInverse.elements, camera.near, camera.projectionMatrix.elements);
        }
        actual.update(12, camera.position);
        const streak = actual.objects.find(object => object.name === 'skyriver.traffic.streaks');
        if (!(streak instanceof Mesh) || !(streak.geometry instanceof InstancedBufferGeometry)) throw Error('R39_NATIVE_STREAK_REQUIRED');
        const lod = streak.geometry.getAttribute('aCarLod'), shape = streak.geometry.getAttribute('aCarShape');
        const position = streak.geometry.getAttribute('aCarPos'), lampFade = streak.geometry.getAttribute('aCarFade');
        const lampSlots = new Map<number, number>();
        for (let slot = 0; slot < streak.geometry.instanceCount; slot += 1) {
          const id = lod.getZ(slot); expect(lampSlots.has(id)).toBe(false); lampSlots.set(id, slot);
        }
        const hulls = actual.objects.filter((object): object is InstancedMesh => object instanceof InstancedMesh);
        const nativeCount = hulls.reduce((sum, mesh) => sum + mesh.count, 0);
        const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        let culledCount = 0;
        const ownedSlots = new Set<string>(), expectedLampIds = new Set<number>();
        const smooth = (start: number, end: number, value: number) => {
          const x = Math.max(0, Math.min(1, (value - start) / (end - start))); return x * x * (3 - 2 * x);
        };
        for (let id = 0; id < 2400; id += 1) {
          const owner = actual.carEvidence(id); if (!owner) throw Error('R39_NATIVE_ID_EVIDENCE_REQUIRED');
          expect(owner.carId).toBe(id); expect(owner.admitted).toBe(true); expect(owner.requested).toBe(true);
          const type = owner.profileIndex;
          const mesh = hulls.find(hull => hull.name === 'skyriver.traffic.' + names[type]);
          if (!mesh) throw Error('R39_LOGICAL_PROFILE_MISSING');
          expect(owner.poseEvaluated).toBe(true);
          if (!owner.prospectiveHullMatrix) throw Error('R39_PROSPECTIVE_MATRIX_MISSING');
          if (owner.drawn) {
            expect(owner.hullMeshName).toBe(mesh.name);
            expect(owner.hullSlot).toBeGreaterThanOrEqual(0); expect(owner.hullSlot).toBeLessThan(mesh.count);
            const key = mesh.name + ':' + owner.hullSlot; expect(ownedSlots.has(key)).toBe(false); ownedSlots.add(key);
          } else {
            expect(owner.hullMeshName).toBeNull(); expect(owner.hullSlot).toBe(-1); expect(owner.streakSlot).toBe(-1);
            culledCount += 1;
          }
          expect(type).toBeGreaterThanOrEqual(0); expect(owner.profileIndex).toBe(type);
          const role: { role: import('../src/render/traffic').CarRole; stream: number } = { role: 'free', stream: 255 };
          carTrafficPlan(seed, id, role);
          if (role.role === 'stream' && STREAMS[role.stream]![5]! <= 70) expect(type).toBe(5);
          else expect([[0, 3], [1, 2], [2, 4]][params.archetype[id]!]!).toContain(type);
          const matrix = new Matrix4().fromArray(owner.prospectiveHullMatrix);
          if (owner.drawn) expect(Array.from(mesh.instanceMatrix.array.slice(owner.hullSlot * 16, owner.hullSlot * 16 + 16))).toEqual(owner.prospectiveHullMatrix);
          const center = new Vector3().setFromMatrixPosition(matrix), distance = center.distanceTo(camera.position);
          mesh.geometry.computeBoundingBox(); const box = mesh.geometry.boundingBox;
          if (!box) throw Error('R39_NATIVE_BODY_BOUNDS_REQUIRED');
          const points = [];
          for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
            points.push(new Vector3(x, y, z).applyMatrix4(matrix));
          }
          const depths = points.map(point => point.clone().applyMatrix4(camera.matrixWorldInverse).z);
          const behind = mode === 'view-frame' && depths.every(z => z > -camera.near);
          const crossing = mode === 'view-frame' && !behind && depths.some(z => z > -camera.near);
          const projected = points.map(point => point.clone().project(camera));
          const scale = Math.hypot(matrix.elements[0]!, matrix.elements[1]!, matrix.elements[2]!);
          const extent = mode === 'sphere-compatibility' ? box.getSize(new Vector3()).length() * scale / (distance * cssAngle)
            : behind ? 0 : crossing ? 6 : Math.max(
              (Math.max(...projected.map(point => point.x)) - Math.min(...projected.map(point => point.x))) * 640,
              (Math.max(...projected.map(point => point.y)) - Math.min(...projected.map(point => point.y))) * 360);
          const expected = behind ? 0 : smooth(0.125, 0.5, extent);
          expect(owner.prospectiveVisibility).toBeCloseTo(expected, 5);
          const outside = mode === 'view-frame'
            ? !frustum.intersectsSphere(new Sphere(center, owner.envelopeRadiusM))
            : false;
          if (mode === 'view-frame') expect(owner.envelopeOutside).toBe(outside);
          const mustDraw = expected > 0 && !outside;
          expect(owner.drawn).toBe(mustDraw);
          const slot = lampSlots.get(id);
          if (mustDraw) {
            expect(mesh.geometry.getAttribute('aFade').getX(owner.hullSlot)).toBeCloseTo(expected, 5);
            expectedLampIds.add(id); expect(slot).toBeDefined();
          } else { expect(owner.visibility).toBe(0); expect(slot).toBeUndefined(); }
          if (slot !== undefined) {
            expect(shape.getX(slot)).toBe(type); expect(lod.getX(slot)).toBe(1); expect(lod.getY(slot)).toBe(0);
            expect(lampFade.getX(slot)).toBeCloseTo(expected, 5);
            expect(Math.abs(scale - lampFade.getY(slot))).toBeLessThanOrEqual(1e-5);
            expect(new Vector3(position.getX(slot), position.getY(slot), position.getZ(slot)).distanceTo(center)).toBeLessThan(1e-4);
          }
        }
        expect(ownedSlots.size).toBe(nativeCount);
        expect(nativeCount + culledCount).toBe(2400);
        expect(new Set(lampSlots.keys())).toEqual(expectedLampIds);
        expect(lampSlots.size + (2400 - expectedLampIds.size)).toBe(2400);
      } finally { actual.dispose(); }
    }
  });

  it.each([0, 424242, 2147483647, 4294967295])('keeps every far freight car in flatbed with unchanged route data for seed %i', (seed) => {
    const attrs = deriveImpostorAttributes(seed, 20000),
      flow = newImpostorFlowReport();
    for (let car = 0; car < 20000; car += 1) {
      const type = unpackTrafficAppearance(attrs.appearance[car]!).type;
      impostorFlow(attrs, car, 0, flow);
      expect(TRAFFIC_APPEARANCE_PROFILES[type]).toBeDefined();
      if (flow.kind === 'freight') expect(type).toBe(5);
    }
  });

  it('keeps player dart bounds, wake roots, and the established strip', () => {
    const g = geometry('skyriver.shuttle.hull');
    g.computeBoundingBox();
    expect([...g.boundingBox!.min.toArray(), ...g.boundingBox!.max.toArray()]).toEqual(
      [-4.15, -1.08, -6.11, 4.15, 1.72, 8.15].map(Math.fround),
    );
    expect(g.index!.count / 3).toBeLessThan(2000);
    expect(SHUTTLE_WAKE_SAMPLE_COUNT).toBe(32);
    expect(SHUTTLE_NOZZLE_ROOTS_LOCAL).toEqual([
      [-2.05, -0.42, -6.1],
      [2.05, -0.42, -6.1],
    ]);
    const lamps = triangles(g).filter((face) => face.color.every((rgb) => Math.abs(rgb[0]! - 2.4) < 1e-5 && rgb[1] === 0 && rgb[2] === 0));
    expect(lamps).toHaveLength(24);
  });

  it('gives player fins volume and keeps neutral glass behind its upper frame', () => {
    const g = geometry('skyriver.shuttle.hull'),
      faces = triangles(g),
      glass = g.getAttribute('aGlass');
    const fins = faces.filter((face) => face.points.some((p) => Math.abs(p.x) > 3.8));
    expect(fins.length).toBeGreaterThanOrEqual(16);
    expect(fins.some((face) => Math.abs(face.normal.y) < 0.7)).toBe(true);
    const pane = faces.find((face) => face.ids.every((i) => glass.getX(i) === 1) && face.normal.y > 0.9);
    expect(pane).toBeDefined();
    const glassHeight = Math.max(
      ...Array.from({ length: glass.count }, (_, i) => (glass.getX(i) === 1 ? g.getAttribute('position').getY(i) : -Infinity)),
    );
    expect(glassHeight).toBeCloseTo(1.685, 5);
    expect(g.boundingBox!.max.y - glassHeight).toBeGreaterThan(0.03);
  });
});
