/** R28 independent physical geometry and traffic identity contracts. No GL context is used. */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BufferGeometry, InstancedBufferAttribute, InstancedMesh, Mesh, PerspectiveCamera, ShaderMaterial, Vector3 } from 'three';
import { createSkyriverTraffic, TRAFFIC_QUALITY_TIERS } from '../src/render/traffic';
import { deriveImpostorAttributes, impostorFlow, newImpostorFlowReport } from '../src/render/trafficStreams';
import {
  packTrafficAppearance, unpackTrafficAppearance, TRAFFIC_APPEARANCE_PROFILES,
  TRAFFIC_APPEARANCE_GLSL, TRAFFIC_LAMP_MIN_DIAMETER_PX,
} from '../src/render/trafficAppearance';

// Actual old Three geometry and four-seed motion buffers, captured before R28.
const GEOMETRY_BEFORE = [
  {
    "renderId": 0,
    "name": "cab",
    "vertices": 234,
    "indexed": false,
    "attributes": {
      "position": {
        "bytes": 2808,
        "sha256": "06b95c384e74d491e0b994b2d154741ee9d0f217510e334087e21c2755db483a"
      },
      "color": {
        "bytes": 2808,
        "sha256": "bf66a1fb020a6c5d06f3386dc5b3d1538b998c53bb5c472214b46ded97f245e4"
      },
      "normal": {
        "bytes": 2808,
        "sha256": "0f81dbdbd15f1c5d735b7c9cdc682ad0409425677bede521e3740a0628d7f66e"
      }
    }
  },
  {
    "renderId": 1,
    "name": "interceptor",
    "vertices": 174,
    "indexed": false,
    "attributes": {
      "position": {
        "bytes": 2088,
        "sha256": "c7e3fabe8a1a8584a04ec44ec5ebb7f449bf91cd7a3be9f25ba31ca5854ebcf3"
      },
      "color": {
        "bytes": 2088,
        "sha256": "0f121d0bdb17111795d397eb4f13ee08cc4f2eed2d4db6e57092377b3139a0c2"
      },
      "normal": {
        "bytes": 2088,
        "sha256": "09b57c1148d9ffd95295bded610ac65cee0ae4b985290af3dfb9890c6f34078f"
      }
    }
  },
  {
    "renderId": 2,
    "name": "commuter",
    "vertices": 246,
    "indexed": false,
    "attributes": {
      "position": {
        "bytes": 2952,
        "sha256": "f80af05eb0d53e15a42a10cd69b8381a55663f324deb6c943e89c5f2ac54da34"
      },
      "color": {
        "bytes": 2952,
        "sha256": "cfcda8c6b3071a7fad5f02b73e97c91504b94a4873adcd45e3a97d44da5b46eb"
      },
      "normal": {
        "bytes": 2952,
        "sha256": "c70db6610dd4e4225a6524c5d0b745bbe4579c1dd22b7b0e9a56075eda681609"
      }
    }
  },
  {
    "renderId": 3,
    "name": "van",
    "vertices": 234,
    "indexed": false,
    "attributes": {
      "position": {
        "bytes": 2808,
        "sha256": "572a72e1b59b6d8ca9e7401667387695b8aadc5747d6aea761df0cd36422d839"
      },
      "color": {
        "bytes": 2808,
        "sha256": "6508d7f81422bfcfc0e352b857808db868de078eace9d8009db1e9a938fa162a"
      },
      "normal": {
        "bytes": 2808,
        "sha256": "0f81dbdbd15f1c5d735b7c9cdc682ad0409425677bede521e3740a0628d7f66e"
      }
    }
  },
  {
    "renderId": 4,
    "name": "saucer",
    "vertices": 276,
    "indexed": false,
    "attributes": {
      "position": {
        "bytes": 3312,
        "sha256": "bae0df2150c0d83d6a5d71b90e3152477633c28b494b136a1c8c0795c9d167b3"
      },
      "color": {
        "bytes": 3312,
        "sha256": "4627e8c67067f7d963aebb7ba7981cac9b80d45783de55d1f13c1a98e36b6f3a"
      },
      "normal": {
        "bytes": 3312,
        "sha256": "6c1884a9d66213fa7492892f7585b3f9c0b6907b450f9a039932b1b539077d24"
      }
    }
  },
  {
    "renderId": 5,
    "name": "bus",
    "vertices": 102,
    "indexed": false,
    "attributes": {
      "position": {
        "bytes": 1224,
        "sha256": "866a1e8f5456a1b931dac0fea4fc59fb9db1fed464e55e0311d239ca248100cc"
      },
      "color": {
        "bytes": 1224,
        "sha256": "7c5c50a29f75fbbf3302b8a7f8225ad034f82a1f7f0cb85d8291aebb2b3f9376"
      },
      "normal": {
        "bytes": 1224,
        "sha256": "61f52a49b23f25bec590f841f9e84297f6a1d4b1a7b0a291538f4cba5e9667c7"
      }
    }
  },
  {
    "renderId": 6,
    "name": "flatbed",
    "vertices": 300,
    "indexed": false,
    "attributes": {
      "position": {
        "bytes": 3600,
        "sha256": "4d7130a2e438356ae2184d6fa054722f2f2da54db178b1451d2cedcdf906eed6"
      },
      "color": {
        "bytes": 3600,
        "sha256": "e6443785edf9515b945b2c7a3161c1c068070f816dbd89bbd0acd31b76a95c38"
      },
      "normal": {
        "bytes": 3600,
        "sha256": "2037a7e2b1f6ebed62475f96e865eeb4f27c480fd5dd4aec6dfd70566a5c205e"
      }
    }
  }
] as const;
const MOTION_BEFORE = [
  {
    "seed": 424242,
    "arrays": {
      "streamArcPhaseSeed": {
        "length": 80000,
        "byteLength": 320000,
        "sha256": "85b1a0b7045a61cbadac4f2bd94dbf7dc289383b14bae3202f11efa71aa80a13"
      },
      "row": {
        "length": 20000,
        "byteLength": 80000,
        "sha256": "88724d5856f15d643168f3f79660a5447a958aa87a3ab873567c6f910d332273"
      },
      "flow": {
        "length": 80000,
        "byteLength": 320000,
        "sha256": "52a7b2f98ccaef24fc9e8810e76e002abc2616ac66a32273e430b6063d607bc7"
      },
      "route": {
        "length": 80000,
        "byteLength": 320000,
        "sha256": "36d7c1567046406c5544310eacfbe3e1b452ba5e1466eabd3b6e01630cdbb74a"
      }
    }
  },
  {
    "seed": 0,
    "arrays": {
      "streamArcPhaseSeed": {
        "length": 80000,
        "byteLength": 320000,
        "sha256": "7ff2955dcfa15cee3ae54c39a236e9dfb1921818a7d434e368e48e8be5e47171"
      },
      "row": {
        "length": 20000,
        "byteLength": 80000,
        "sha256": "37b6f97bbd489b20198e52b8f1f41967c81de1b9e0695f69edaceeec9394058f"
      },
      "flow": {
        "length": 80000,
        "byteLength": 320000,
        "sha256": "0e6a2ad02302972f66a15f5c1b3ae2fc97836db142144a551622cc686bc75ab7"
      },
      "route": {
        "length": 80000,
        "byteLength": 320000,
        "sha256": "f03d91c29b847d34df71ecc5a9f4e8795709dc803df06eb16d1fa97a5816ec0b"
      }
    }
  },
  {
    "seed": 2147483647,
    "arrays": {
      "streamArcPhaseSeed": {
        "length": 80000,
        "byteLength": 320000,
        "sha256": "b6f8b688901719f877c84f3b058c9367fd07e636475a7a3506195c72f60c7bcd"
      },
      "row": {
        "length": 20000,
        "byteLength": 80000,
        "sha256": "6ca26df3f27fa9377c586247bd498a4868005b4e37edfe6cbb1cf6fc0bd1ac13"
      },
      "flow": {
        "length": 80000,
        "byteLength": 320000,
        "sha256": "2fc11a30f576d8cec30e6b45bd3c8abb1177e54e66454923451cc1ed62dc2c59"
      },
      "route": {
        "length": 80000,
        "byteLength": 320000,
        "sha256": "fc65d65e56ce9c7b7385eb928f649b5a8d7c457a951947e8db14bdfbbd6a5152"
      }
    }
  },
  {
    "seed": 4294967295,
    "arrays": {
      "streamArcPhaseSeed": {
        "length": 80000,
        "byteLength": 320000,
        "sha256": "138896b8444b294a51a8fbe58d94355ce25806c0a8839d845532c8ac211033da"
      },
      "row": {
        "length": 20000,
        "byteLength": 80000,
        "sha256": "2fba128e29f25016adc80d56e745580f279b45f79defdc457e7ceb891311e530"
      },
      "flow": {
        "length": 80000,
        "byteLength": 320000,
        "sha256": "e22f81bcf3fd717c2ceaa5cb271caf0ee98a67b79db9034c1a5840b4af20b51e"
      },
      "route": {
        "length": 80000,
        "byteLength": 320000,
        "sha256": "a5f5c4c86d0ff3a00bf11a403d5ad781b49aa0b0bc8fceb20fcdb0e151e7e1d6"
      }
    }
  }
] as const;
const SEEDS = [424242, 0, 2147483647, 4294967295] as const;
const hash = (a: ArrayBufferView): string => createHash('sha256')
  .update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex');
function withTraffic<T>(seed: number, work: (traffic: ReturnType<typeof createSkyriverTraffic>) => T): T {
  const traffic = createSkyriverTraffic({ seed, quality: TRAFFIC_QUALITY_TIERS.high, maxImpostors: 20000 });
  try { return work(traffic); } finally { traffic.dispose(); }
}
function meshNamed(traffic: ReturnType<typeof createSkyriverTraffic>, name: string): Mesh {
  const mesh = traffic.objects.find(o => o.name === name);
  if (!(mesh instanceof Mesh)) throw new Error('R28_REAL_MESH_MISSING:' + name);
  return mesh;
}
interface Point { x: number; y: number; z: number; }
interface Patch { centre: Point; width: number; height: number; normal: Point; }
/** Group actual emissive triangles by shared vertices and coplanar normal. */
function measurePatches(geometry: BufferGeometry, rgb: readonly number[]): Patch[] {
  const position = geometry.getAttribute('position');
  const color = geometry.getAttribute('color');
  const normal = geometry.getAttribute('normal');
  const triangles: { points: Point[]; keys: Set<string>; normal: Point }[] = [];
  for (let at = 0; at < position.count; at += 3) {
    const points: Point[] = [];
    let match = true;
    for (let j = 0; j < 3; j += 1) {
      const i = at + j;
      const c = [color.getX(i), color.getY(i), color.getZ(i)];
      if (c.some((v, k) => Math.abs(v - rgb[k]!) > 1e-6)) { match = false; break; }
      points.push({ x: position.getX(i), y: position.getY(i), z: position.getZ(i) });
    }
    if (match) triangles.push({ points, keys: new Set(points.map(p => `${p.x},${p.y},${p.z}`)),
      normal: { x: normal.getX(at), y: normal.getY(at), z: normal.getZ(at) } });
  }
  const remaining = new Set(triangles.map((_, i) => i));
  const patches: Patch[] = [];
  while (remaining.size > 0) {
    const first = remaining.values().next().value!;
    const members = [first];
    const keys = new Set(triangles[first]!.keys);
    remaining.delete(first);
    let changed = true;
    while (changed) {
      changed = false;
      for (const i of remaining) {
        const n = triangles[i]!.normal;
        const base = triangles[first]!.normal;
        if (Math.abs(n.x - base.x) + Math.abs(n.y - base.y) + Math.abs(n.z - base.z) > 1e-6) continue;
        if (![...triangles[i]!.keys].some(k => keys.has(k))) continue;
        remaining.delete(i); members.push(i);
        for (const k of triangles[i]!.keys) keys.add(k);
        changed = true;
      }
    }
    const points = members.flatMap(i => triangles[i]!.points);
    const xs = points.map(p => p.x), ys = points.map(p => p.y), zs = points.map(p => p.z);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    patches.push({ centre: { x: (x0 + x1) / 2, y: (y0 + y1) / 2,
      z: (Math.min(...zs) + Math.max(...zs)) / 2 }, width: x1 - x0, height: y1 - y0,
      normal: triangles[first]!.normal });
  }
  return patches.sort((a, b) => a.centre.x - b.centre.x);
}

describe('R28 actual hull lamp geometry', () => {
  it('preserves all seven old position, colour, normal and triangle records', () => {
    withTraffic(424242, traffic => {
      for (const before of GEOMETRY_BEFORE) {
        const mesh = meshNamed(traffic, 'skyriver.traffic.' + before.name);
        expect(mesh).toBeInstanceOf(InstancedMesh);
        expect(mesh.geometry.getAttribute('position').count).toBe(before.vertices);
        expect(mesh.geometry.index !== null).toBe(before.indexed);
        for (const name of ['position', 'color', 'normal'] as const) {
          const array = mesh.geometry.getAttribute(name).array;
          expect(array.byteLength).toBe(before.attributes[name].bytes);
          expect(hash(array)).toBe(before.attributes[name].sha256);
        }
      }
    });
  });

  it('matches front and rear profile geometry to independently measured real emissive patches', () => {
    withTraffic(424242, traffic => {
      expect(TRAFFIC_APPEARANCE_PROFILES).toHaveLength(7);
      for (const before of GEOMETRY_BEFORE) {
        const profile = TRAFFIC_APPEARANCE_PROFILES[before.renderId]!;
        expect(profile.name).toBe(before.name);
        const geometry = meshNamed(traffic, 'skyriver.traffic.' + before.name).geometry;
        for (const [key, rgb, direction] of [
          ['front', [2, 2.15, 2.3], 1], ['rear', [4, 0.3, 0.2], -1],
        ] as const) {
          const source = measurePatches(geometry, rgb);
          const lamp = profile[key];
          expect(source).toHaveLength(lamp.kind === 'pair' ? 2 : 1);
          const centres = lamp.kind === 'pair' ? [-lamp.centreXM, lamp.centreXM] : [0];
          for (let i = 0; i < source.length; i += 1) {
            const patch = source[i]!;
            expect(patch.centre.x).toBeCloseTo(centres[i]!, 5);
            expect(patch.centre.y).toBeCloseTo(lamp.yM, 5);
            expect(patch.centre.z).toBeCloseTo(lamp.zM, 5);
            expect(patch.width).toBeCloseTo(lamp.widthM, 5);
            expect(patch.height).toBeCloseTo(lamp.heightM, 5);
            expect(patch.normal.z).toBe(direction);
          }
        }
      }
    });
  });

  it('projects the measured metre spans with the real perspective matrix at all required distances', () => {
    withTraffic(424242, traffic => {
      const height = 900, width = 1600, fov = 62;
      const camera = new PerspectiveCamera(fov, width / height, 1, 14000);
      camera.updateMatrixWorld();
      const focalPx = height / (2 * Math.tan(fov * Math.PI / 360));
      for (const before of GEOMETRY_BEFORE) {
        const geometry = meshNamed(traffic, 'skyriver.traffic.' + before.name).geometry;
        const profile = TRAFFIC_APPEARANCE_PROFILES[before.renderId]!;
        for (const [key, rgb] of [['front', [2, 2.15, 2.3]], ['rear', [4, 0.3, 0.2]]] as const) {
          const patches = measurePatches(geometry, rgb);
          const minX = Math.min(...patches.map(p => p.centre.x - p.width / 2));
          const maxX = Math.max(...patches.map(p => p.centre.x + p.width / 2));
          const lamp = profile[key];
          const profileSpan = lamp.kind === 'pair' ? lamp.centreXM * 2 + lamp.widthM : lamp.widthM;
          for (const scale of [1.5, 2, 2.5]) for (const distance of [1200, 1300, 1400]) {
            const z = -distance + lamp.zM * scale;
            const a = new Vector3(minX * scale, lamp.yM * scale, z).project(camera);
            const b = new Vector3(maxX * scale, lamp.yM * scale, z).project(camera);
            const measuredPx = (b.x - a.x) * width / 2;
            const expectedPx = profileSpan * scale * focalPx / -z;
            expect(Math.abs(measuredPx - expectedPx) / measuredPx).toBeLessThan(1e-5);
          }
        }
      }
      const bus = TRAFFIC_APPEARANCE_PROFILES[5]!.front;
      const interceptor = TRAFFIC_APPEARANCE_PROFILES[1]!.front;
      expect(bus.centreXM * 2 + bus.widthM).toBeGreaterThan(interceptor.widthM);
    });
  });

  it('preserves physical lamp bounds in lateral views with real hull vertices', () => {
    withTraffic(424242, traffic => {
      const width = 1280, height = 720;
      const camera = new PerspectiveCamera(62, width / height, 1, 14000);
      camera.updateMatrixWorld();
      for (const before of GEOMETRY_BEFORE) {
        const geometry = meshNamed(traffic, 'skyriver.traffic.' + before.name).geometry;
        const positions = geometry.getAttribute('position');
        const colors = geometry.getAttribute('color');
        const profile = TRAFFIC_APPEARANCE_PROFILES[before.renderId]!;
        for (const [key, rgb] of [['front', [2, 2.15, 2.3]], ['rear', [4, 0.3, 0.2]]] as const) {
          const actual: Vector3[] = [];
          for (let vertex = 0; vertex < positions.count; vertex++) {
            const color = [colors.getX(vertex), colors.getY(vertex), colors.getZ(vertex)];
            if (color.every((value, component) => Math.abs(value - rgb[component]!) < 1e-6)) {
              actual.push(new Vector3().fromBufferAttribute(positions, vertex));
            }
          }
          expect(actual.length).toBeGreaterThan(0);
          const lamp = profile[key];
          const separation = lamp.kind === 'pair' ? lamp.centreXM : lamp.widthM / 4;
          const kernelWidth = lamp.kind === 'pair' ? lamp.widthM : lamp.widthM / 2;
          const expected: Vector3[] = [];
          for (const side of [-1, 1]) for (const x of [-1, 1]) for (const y of [-1, 1]) {
            expected.push(new Vector3(side * separation + x * kernelWidth / 2,
              lamp.yM + y * lamp.heightM / 2, lamp.zM));
          }
          for (const yawDegrees of [-100, -90, -80, 80, 90, 100]) {
            const yaw = yawDegrees * Math.PI / 180;
            const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
            const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
            const up = new Vector3(0, 1, 0);
            for (const bank of [0, 0.25]) {
              const rightBank = right.clone().multiplyScalar(Math.cos(bank)).addScaledVector(up, Math.sin(bank));
              const upBank = up.clone().multiplyScalar(Math.cos(bank)).addScaledVector(right, -Math.sin(bank));
              for (const distance of [1200, 1300, 1400]) for (const lateralM of [-30, 0, 30]) {
                const projectBounds = (points: Vector3[]): number[] => {
                  const projected = points.map(point => new Vector3(lateralM, 0, -distance)
                    .addScaledVector(rightBank, point.x * 2)
                    .addScaledVector(upBank, point.y * 2)
                    .addScaledVector(forward, point.z * 2).project(camera));
                  return [Math.min(...projected.map(point => point.x)) * width / 2,
                    Math.max(...projected.map(point => point.x)) * width / 2,
                    Math.min(...projected.map(point => point.y)) * height / 2,
                    Math.max(...projected.map(point => point.y)) * height / 2];
                };
                const measured = projectBounds(actual), predicted = projectBounds(expected);
                for (let bound = 0; bound < 4; bound++) {
                  expect(Number.isFinite(measured[bound])).toBe(true);
                  expect(Math.abs(measured[bound]! - predicted[bound]!)).toBeLessThan(1e-5);
                }
              }
            }
          }
        }
      }
    });
  });
});

describe('R28 Float32 appearance codec', () => {
  it('retains all seven types and physical scales through the actual stored scalar', () => {
    for (let type = 0; type < 7; type += 1) {
      for (const scale of [1, 1.5, 1.999999, 2, 2.5, 3.2, 4.6, 5.999999, 6]) {
        const array = new Float32Array([packTrafficAppearance(type, scale)]);
        const decoded = unpackTrafficAppearance(array[0]!);
        expect(decoded.type).toBe(type);
        expect(Math.abs(decoded.scale - scale)).toBeLessThan(4e-6);
        expect(array[0]).toBe(Math.fround(type + scale / 8));
      }
    }
    for (const [type, scale] of [[-1, 2], [7, 2], [0.5, 2], [0, 0.999], [6, 6.001], [0, NaN]]) {
      expect(() => packTrafficAppearance(type!, scale!)).toThrow('SKYRIVER_TRAFFIC_APPEARANCE_INVALID');
    }
  });
});

function addedAppearanceAttribute(geometry: BufferGeometry): InstancedBufferAttribute {
  const original = new Set(['position', 'aCorner', 'aImp', 'aFlow', 'aRoute', 'aFromAlpha']);
  const added = Object.entries(geometry.attributes).filter(([name]) => !original.has(name));
  expect(added).toHaveLength(1);
  const attribute = added[0]![1];
  expect(attribute).toBeInstanceOf(InstancedBufferAttribute);
  expect(attribute.itemSize).toBe(1);
  expect(attribute.array).toBeInstanceOf(Float32Array);
  return attribute as InstancedBufferAttribute;
}

describe('R28 actual GPU storage and frozen motion identity', () => {
  it.each(MOTION_BEFORE)('preserves the 20000-car original motion bytes for seed $seed', before => {
    const attrs = deriveImpostorAttributes(before.seed, 20000);
    for (const name of ['streamArcPhaseSeed', 'row', 'flow', 'route'] as const) {
      expect(attrs[name].byteLength).toBe(before.arrays[name].byteLength);
      expect(hash(attrs[name])).toBe(before.arrays[name].sha256);
    }
    const newArrays = Object.entries(attrs).filter(([name, value]) => value instanceof Float32Array
      && !['streamArcPhaseSeed', 'row', 'flow', 'route'].includes(name));
    expect(newArrays).toHaveLength(1);
    const derived = newArrays[0]![1] as Float32Array;
    expect(derived).toHaveLength(20000);
    expect(derived.byteLength).toBe(80000);
    withTraffic(before.seed, traffic => {
      const gpu = meshNamed(traffic, 'skyriver.traffic.impostors');
      const added = addedAppearanceAttribute(gpu.geometry);
      expect(added.count).toBe(20000);
      expect(added.array.byteLength).toBe(80000);
      expect(hash(added.array)).toBe(hash(derived));
      for (const [name, source] of [['aImp', 'streamArcPhaseSeed'], ['aFlow', 'flow'], ['aRoute', 'route']] as const) {
        expect(hash(gpu.geometry.getAttribute(name).array)).toBe(hash(attrs[source]));
      }
    });
  });
});

const CPU_IDENTITY_BEFORE = [
  [424242, '02a988ca875e046ca8f695e6ab661a0902c86c7c1ff5c7eb9037147d151595e9'],
  [0, '322d4f8d7e6ed54314c9c485e60bdb8677d29ecd7f0388f738775d82726852f5'],
  [2147483647, '7ca17500195446ce64452372d41ab1ebf8efd5e8f95d11ab92aae1ba1abbfe7d'],
  [4294967295, 'bb725d8882d07ff3dc27139030d26b1819d492caa5236f1a31489af93e08d80d'],
] as const;

function cpuAppearanceRecords(traffic: ReturnType<typeof createSkyriverTraffic>): Float32Array {
  const streak = meshNamed(traffic, 'skyriver.traffic.streaks');
  const lod = streak.geometry.getAttribute('aCarLod');
  const fade = streak.geometry.getAttribute('aCarFade');
  const shape = streak.geometry.getAttribute('aCarShape');
  const hullTypes: number[] = [];
  for (const before of GEOMETRY_BEFORE) {
    const hull = meshNamed(traffic, 'skyriver.traffic.' + before.name);
    if (!(hull instanceof InstancedMesh)) throw new Error('R28_REAL_HULL_MISSING');
    for (let i = 0; i < hull.count; i += 1) hullTypes.push(before.renderId);
  }
  const count = traffic.stats().activeThrusters;
  expect(hullTypes).toHaveLength(count);
  const records: number[][] = [];
  for (let i = 0; i < count; i += 1) {
    expect(shape.getX(i)).toBe(hullTypes[i]);
    expect(Number.isFinite(shape.getY(i))).toBe(true);
    records.push([lod.getZ(i), shape.getX(i), fade.getY(i)]);
  }
  records.sort((a, b) => a[0]! - b[0]!);
  return new Float32Array(records.flat());
}

function actualShader(traffic: ReturnType<typeof createSkyriverTraffic>, name: string): ShaderMaterial {
  const material = meshNamed(traffic, name).material;
  if (!(material instanceof ShaderMaterial)) throw new Error('R28_REAL_SHADER_MISSING:' + name);
  return material;
}

describe('R28 real CPU identities and shared shader inputs', () => {
  it.each(CPU_IDENTITY_BEFORE)('preserves original CPU hull type and physical scale for seed %i', (seed, beforeHash) => {
    withTraffic(seed, traffic => {
      traffic.setAnchor(0, 1500, 0, 0, 160, 0, 0);
      for (const t of [0, 12, 24]) traffic.update(t, { x: 0, y: 1500, z: 0 });
      const records = cpuAppearanceRecords(traffic);
      expect(records).toHaveLength(2400 * 3);
      expect(hash(records)).toBe(beforeHash);
      traffic.setQuality(TRAFFIC_QUALITY_TIERS.low);
      traffic.update(25, { x: 0, y: 1500, z: 0 });
      traffic.update(27, { x: 0, y: 1500, z: 0 });
      const smaller = cpuAppearanceRecords(traffic);
      expect(hash(smaller)).toBe(hash(records.subarray(0, smaller.length)));
      traffic.setQuality(TRAFFIC_QUALITY_TIERS.high);
      traffic.update(28, { x: 0, y: 1500, z: 0 });
      traffic.update(30, { x: 0, y: 1500, z: 0 });
      expect(hash(cpuAppearanceRecords(traffic))).toBe(beforeHash);
    });
  });

  it('installs the same physical profile and pixel scale in actual CPU and GPU materials', () => {
    withTraffic(424242, traffic => {
      const cpu = actualShader(traffic, 'skyriver.traffic.streaks');
      const gpu = actualShader(traffic, 'skyriver.traffic.impostors');
      for (const material of [cpu, gpu]) {
        expect(material.vertexShader).toContain(TRAFFIC_APPEARANCE_GLSL);
        expect(material.vertexShader.match(/trafficLampKernel\(/g)).toHaveLength(2);
      }
      const inverseFocal = 2 * Math.tan(62 * Math.PI / 360) / 900;
      traffic.setPixelAngle(inverseFocal);
      expect(cpu.uniforms.uPixelAngle!.value).toBe(inverseFocal);
      expect(gpu.uniforms.uPixelAngle!.value).toBe(inverseFocal);
      expect(TRAFFIC_LAMP_MIN_DIAMETER_PX).toBe(1.3);
      // Read the shader lookup values, not a second copy of the source table.
      const rows = [...TRAFFIC_APPEARANCE_GLSL.matchAll(/if\s*\(type\s*<\s*([\d.]+)\)\s*\{\s*if\s*\(front\)\s*return\s+TrafficLampShape\(vec4\(([^)]+)\),\s*([\d.-]+)\);\s*return\s+TrafficLampShape\(vec4\(([^)]+)\),\s*([\d.-]+)\);\s*\}/g)];
      expect(rows).toHaveLength(7);
      for (const before of GEOMETRY_BEFORE) {
        const geometry = meshNamed(traffic, 'skyriver.traffic.' + before.name).geometry;
        const row = rows[before.renderId]!;
        expect(Number(row[1])).toBe(before.renderId + 0.5);
        for (const [rgb, dimensionsAt, yAt] of [[[2, 2.15, 2.3], 2, 3], [[4, 0.3, 0.2], 4, 5]] as const) {
          const patches = measurePatches(geometry, rgb);
          const values = row[dimensionsAt]!.split(',').map(Number);
          const low = Math.min(...patches.map(p => p.centre.x - p.width / 2));
          const high = Math.max(...patches.map(p => p.centre.x + p.width / 2));
          expect(values[0]! * 2 + values[1]!).toBeCloseTo(high - low, 5);
          expect(values[2]).toBeCloseTo(patches[0]!.height, 5);
          expect(values[3]).toBeCloseTo(patches[0]!.centre.z, 5);
          expect(Number(row[yAt])).toBeCloseTo(patches[0]!.centre.y, 5);
        }
      }
    });
  });
});

describe('R28 stable per-index appearance', () => {
  it.each(SEEDS)('retains count prefixes and all seven seeded classes for seed %i', seed => {
    const attrs = deriveImpostorAttributes(seed, 20000);
    for (const count of [0, 1, 37, 600, 2000]) {
      const smaller = deriveImpostorAttributes(seed, count);
      expect(hash(smaller.appearance)).toBe(hash(attrs.appearance.subarray(0, count)));
    }
    expect(hash(deriveImpostorAttributes(seed, 20000).appearance)).toBe(hash(attrs.appearance));
    const counts = new Array<number>(7).fill(0);
    for (const packed of attrs.appearance) {
      const decoded = unpackTrafficAppearance(packed);
      counts[decoded.type]! += 1;
      expect(decoded.scale).toBeGreaterThanOrEqual(1.5 - 4e-6);
      expect(decoded.scale).toBeLessThanOrEqual(2.5 + 4e-6);
    }
    for (const count of counts) expect(count / 20000).toBeGreaterThan(0.12);
  });

  it('changes seed-owned appearance without changing count-prefix rules', () => {
    const a = deriveImpostorAttributes(0, 20000).appearance;
    const b = deriveImpostorAttributes(4294967295, 20000).appearance;
    let changed = 0;
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) changed += 1;
    expect(changed / a.length).toBeGreaterThan(0.95);
  });

  it('keeps the actual GPU buffer fixed through fork, hop, lap, override and tier updates', () => {
    const attrs = deriveImpostorAttributes(424242, 20000);
    const out = newImpostorFlowReport();
    let branchTime: number | undefined, hopTime: number | undefined;
    for (let i = 0; i < 300 && (branchTime === undefined || hopTime === undefined); i += 1) {
      for (let t = 0; t <= 240; t += 3) {
        impostorFlow(attrs, i, t, out);
        if (out.route.branchWeight > 0.2) branchTime ??= t;
        if (out.route.hopWeight > 0.2 && out.route.hopWeight < 0.8) hopTime ??= t;
      }
    }
    expect(branchTime).toBeDefined();
    expect(hopTime).toBeDefined();
    withTraffic(424242, traffic => {
      const attribute = addedAppearanceAttribute(meshNamed(traffic, 'skyriver.traffic.impostors').geometry);
      const originalArray = attribute.array, originalHash = hash(originalArray), version = attribute.version;
      traffic.setAnchor(0, 1500, 0, 0, 160, 0, 0);
      const times = [-1, 0, branchTime!, hopTime!, 500, 500.1, 501, 503, 505];
      for (let i = 0; i < times.length; i += 1) {
        const tier = [TRAFFIC_QUALITY_TIERS.high, TRAFFIC_QUALITY_TIERS.low, TRAFFIC_QUALITY_TIERS.medium][i % 3]!;
        traffic.setQuality(tier);
        traffic.setImpostorCount(i % 2 === 0 ? 1537 : null);
        traffic.update(times[i]!, { x: 0, y: 1500, z: 0 });
        expect(attribute.array).toBe(originalArray);
        expect(hash(attribute.array)).toBe(originalHash);
        expect(attribute.version).toBe(version);
      }
    });
  });
});
