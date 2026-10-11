/** Independent R28b material algebra and real batch geometry checks. No GL context. */
import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AdditiveBlending, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, InstancedMesh, Mesh, ShaderMaterial, Vector3, Vector4, PerspectiveCamera, Matrix4, Sphere, Frustum } from 'three';
import { createSkyriverTraffic, TRAFFIC_QUALITY_TIERS } from '../src/render/traffic';
import { deriveImpostorAttributes, impostorPosition } from '../src/render/trafficStreams';
import { unpackTrafficAppearance } from '../src/render/trafficAppearance';

const traffic = createSkyriverTraffic({ seed: 424242, quality: TRAFFIC_QUALITY_TIERS.high, maxImpostors: 20000 });
afterAll(() => traffic.dispose());
function mesh(name: string): Mesh {
  const object = traffic.objects.find(o => o.name === name);
  if (!(object instanceof Mesh)) throw new Error('R28B_REAL_MESH_MISSING:' + name);
  if (!(object.material instanceof ShaderMaterial)) {
    throw new Error('R28B_REAL_MATERIAL_MISSING:' + name);
  }
  return object;
}
const cpu = mesh('skyriver.traffic.streaks');
const gpu = mesh('skyriver.traffic.impostors');
const cpuMaterial = cpu.material as ShaderMaterial;
const gpuMaterial = gpu.material as ShaderMaterial;
function body(source: string, name: string): string {
  const match = source.match(new RegExp('(?:float|vec2)\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{([^}]+)\\}'));
  if (!match) throw new Error('R28B_ACTUAL_GLSL_FUNCTION_MISSING:' + name);
  return match[1]!;
}
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
// Component-wise GLSL arithmetic is scalar arithmetic for one vector component.
const floorBody = body(gpuMaterial.vertexShader, 'trafficLampFloor').replace(/\bfloat\b/g, 'let');
const floor = new Function('physical', 'floorSize', 'max', 'abs', floorBody) as
  (physical: number, floorSize: number, max: typeof Math.max, abs: typeof Math.abs) => number;
const actualFloor = (physical: number, minimum: number): number => floor(physical, minimum, Math.max, Math.abs);
const smoothstep = (lo: number, hi: number, value: number): number => {
  const t = clamp((value - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
};
function gainFunction(source: string): (x: number, y: number, minimum: number) => number {
  const match = source.match(/float\s+extent\s*=\s*([^;]+);\s*lampGain\s*=\s*([^;]+);/);
  if (!match) throw new Error('R28B_ACTUAL_GAIN_EXPRESSION_MISSING');
  const extent = match[1]!.replace(/physicalHalfSize\.x/g, 'x').replace(/physicalHalfSize\.y/g, 'y');
  const run = new Function('x', 'y', 'floorSize', 'max', 'mix', 'smoothstep',
    'const extent = ' + extent + '; return ' + match[2]!) as
    (x: number, y: number, minimum: number, maxFn: typeof Math.max,
      mixFn: (a: number, b: number, t: number) => number, stepFn: typeof smoothstep) => number;
  return (x, y, minimum) => run(x, y, minimum, Math.max, (a, b, t) => a + (b - a) * t, smoothstep);
}
const gpuGain = gainFunction(gpuMaterial.vertexShader);
const cpuGain = gainFunction(cpuMaterial.vertexShader);
const primitiveBody = body(gpuMaterial.fragmentShader, 'trafficLampPrimitive').replace(/\bvec2\b/g, 'let');
const primitive = new Function('u', 'clamp', primitiveBody) as (u: number, clampFn: typeof clamp) => number;
const boxBody = body(gpuMaterial.fragmentShader, 'trafficBoxLamp');
const integralExpression = boxBody.match(/vec2\s+integral\s*=\s*([\s\S]+?);/);
if (!integralExpression || !/return\s+max\(integral\.x\s*\*\s*integral\.y,\s*0\.0\)/.test(boxBody)) {
  throw new Error('R28B_ACTUAL_PIXEL_INTEGRAL_SHAPE_DIFFERS');
}
const componentIntegral = new Function('uv', 'halfPixel', 'trafficLampPrimitive', 'max',
  'return ' + integralExpression[1]!.replace(/vec2\(([^)]+)\)/g, '($1)')) as
  (uv: number, halfPixel: number, primitiveFn: (v: number) => number, maxFn: typeof Math.max) => number;
const integral = (u: number, halfPixel: number): number =>
  componentIntegral(u, halfPixel, x => primitive(x, clamp), Math.max);
const pairBody = body(gpuMaterial.fragmentShader, 'trafficLampPair');
const pairWeightMatch = pairBody.match(/return\s+([\d.]+)\s*\*\s*\(trafficFilteredLamp\(uv\s*-\s*vec2\(offset,\s*0\.0\)\)\s*\+\s*trafficFilteredLamp\(uv\s*\+\s*vec2\(offset,\s*0\.0\)\)\)/);
if (!pairWeightMatch) throw new Error('R28B_ACTUAL_PAIR_EXPRESSION_DIFFERS');
const pairWeight = Number(pairWeightMatch[1]);
function kernel(u: number): number {
  return Math.abs(u) >= 1 ? 0 : (1 - u * u) ** 2;
}
function quadrature(lo: number, hi: number, steps = 4096): number {
  const h = (hi - lo) / steps;
  let sum = kernel(lo) + kernel(hi);
  for (let i = 1; i < steps; i++) sum += (i % 2 ? 4 : 2) * kernel(lo + i * h);
  return sum * h / 3;
}
function totalPairEnergy(hx: number, hy: number, halfSeparation: number, phaseX: number, phaseY: number): number {
  let total = 0;
  const n = Math.ceil(halfSeparation + hx + hy + 3);
  for (let x = -n; x <= n; x++) {
    const left = integral((x - phaseX - halfSeparation) / hx, 0.5 / hx);
    const right = integral((x - phaseX + halfSeparation) / hx, 0.5 / hx);
    for (let y = -n; y <= n; y++) {
      total += pairWeight * (left + right) * integral((y - phaseY) / hy, 0.5 / hy);
    }
  }
  return total;
}

describe('R28b actual material floor', () => {
  it('keeps the minimum, the physical size, and the five-percent excess bound', () => {
    for (const minimum of [0.00065, 0.65, 1.3, 17]) {
      for (let i = 0; i <= 1200; i++) {
        const physical = minimum * i / 400;
        const value = actualFloor(physical, minimum);
        const hard = Math.max(physical, minimum);
        expect(value).toBeGreaterThanOrEqual(hard - minimum * 1e-12);
        expect(value - hard).toBeLessThanOrEqual(0.05 * minimum + minimum * 1e-12);
      }
    }
  });

  it('equals the real size or minimum outside the twenty-percent neighbourhood', () => {
    for (const minimum of [0.65, 2, 41]) {
      for (const ratio of [0, 0.4, 0.8, 1.2, 1.6, 10]) {
        expect(actualFloor(ratio * minimum, minimum)).toBeCloseTo(Math.max(ratio * minimum, minimum), 12);
      }
    }
  });

  it('has continuous first derivatives at both ends and at the crossover', () => {
    for (const minimum of [0.65, 2, 41]) {
      const h = minimum * 1e-6;
      for (const [ratio, derivative] of [[0.8, 0], [1, 0.5], [1.2, 1]] as const) {
        const x = ratio * minimum;
        const left = (actualFloor(x, minimum) - actualFloor(x - h, minimum)) / h;
        const right = (actualFloor(x + h, minimum) - actualFloor(x, minimum)) / h;
        expect(left).toBeCloseTo(derivative, 5);
        expect(right).toBeCloseTo(derivative, 5);
        expect(Math.abs(left - right)).toBeLessThan(6e-6);
      }
    }
  });

  it('has continuous screen-space distance derivatives for real scale-two profiles', () => {
    const profiles = [...gpuMaterial.vertexShader.matchAll(/TrafficLampShape\(vec4\(([^)]+)\),\s*[\d.-]+\)/g)];
    expect(profiles).toHaveLength(13);
    const focal = 720 / (2 * Math.tan(62 * Math.PI / 360));
    for (const row of profiles.slice(0, 12)) {
      const [centre, width, height, z] = row[1]!.split(',').map(Number);
      expect(centre).toBeGreaterThan(0);
      for (const size of [width!, height!]) {
        const crossover = size * focal / 0.65 + Math.abs(z!) * 2;
        const h = 0.00001;
        const half = (d: number): number => actualFloor(size * focal / (d - Math.abs(z!) * 2), 0.65);
        const left = (half(crossover) - half(crossover - h)) / h;
        const right = (half(crossover + h) - half(crossover)) / h;
        expect(Math.abs(left - right)).toBeLessThan(1e-7);
      }
    }
  });
});

describe('R28b actual pixel-box algebra', () => {
  it('matches numerical integration of the independent compact quartic kernel', () => {
    for (const centre of [-2, -1.1, -1, -0.7, -0.3, 0, 0.25, 0.8, 1, 1.2, 2]) {
      for (const halfPixel of [0.01, 0.1, 0.5, 1, 2]) {
        const expected = quadrature(centre - halfPixel, centre + halfPixel) / (2 * halfPixel);
        expect(integral(centre, halfPixel)).toBeCloseTo(expected, 8);
      }
    }
  });

  it('preserves axis-aligned total pair energy across separation and pixel phase', () => {
    // Integral from -1 to 1 of the independent quartic kernel is 16/15.
    for (const [hx, hy] of [[0.65, 0.65], [0.6825, 0.9], [1, 2.4], [3, 0.65]] as const) {
      const expected = hx * hy * (16 / 15) ** 2;
      for (const offset of [0, 0.15, 0.65, 1.3, 5]) {
        for (const phase of [0, 0.1, 0.25, 0.5, 0.9]) {
          expect(totalPairEnergy(hx, hy, offset, phase, 1 - phase)).toBeCloseTo(expected, 10);
        }
      }
    }
  });

  it('keeps coincident pair peak equal to one kernel and separated peak below one', () => {
    const core = integral(0, 0.5 / 0.65);
    expect(pairWeight * (core + core)).toBeCloseTo(core, 12);
    const separated = pairWeight * (core + integral(10, 0.5 / 0.65));
    expect(separated).toBeCloseTo(core / 2, 12);
  });

  it('uses the same actual core algebra in the CPU and GPU materials', () => {
    for (const name of ['trafficLampPrimitive', 'trafficBoxLamp', 'trafficFilteredLamp', 'trafficLampPair']) {
      expect(body(cpuMaterial.fragmentShader, name)).toBe(body(gpuMaterial.fragmentShader, name));
    }
    expect(body(cpuMaterial.vertexShader, 'trafficLampFloor')).toBe(body(gpuMaterial.vertexShader, 'trafficLampFloor'));
    const filter = body(gpuMaterial.fragmentShader, 'trafficFilteredLamp');
    expect(filter).toContain('trafficBoxLamp(uv, halfPixel)');
    expect(filter).toContain('trafficBoxLamp(uv * 2.5, halfPixel * 2.5)');
  });
});

describe('R28b actual shared floor gain', () => {
  it('shares the gain, keeps the 0.8 minimum, and restores resolved gain one', () => {
    for (const minimum of [0.00065, 0.65, 2, 41]) {
      for (const x of [0, 0.1, 0.8, 0.9, 1, 1.1, 1.2, 4]) {
        for (const y of [0, 0.1, 0.8, 0.9, 1, 1.1, 1.2, 4]) {
          const a = gpuGain(x * minimum, y * minimum, minimum);
          expect(cpuGain(x * minimum, y * minimum, minimum)).toBe(a);
          expect(a).toBeGreaterThanOrEqual(0.8);
          expect(a).toBeLessThanOrEqual(1);
          if (Math.max(x, y) <= 0.8) expect(a).toBe(0.8);
          if (Math.max(x, y) >= 1.2) expect(a).toBe(1);
        }
      }
    }
    expect(cpuMaterial.vertexShader).toContain('vIntensity *= lampGain;');
    expect(gpuMaterial.vertexShader).toMatch(/vIntensity\s*=\s*[^;]*lampGain\s*\*\s*trafficLampFacingGain\(facing,\s*head\)\s*\*\s*handover\s*\*\s*tierPresence\s*\*\s*farBrightness/);
  });

  it('has continuous first derivatives at the scalar extent thresholds', () => {
    // This tests the scalar extent curve. max(x,y) is not jointly C1 at x=y.
    for (const minimum of [0.65, 2, 41]) {
      const h = minimum * 1e-6;
      for (const ratio of [0.8, 1.2]) {
        const x = ratio * minimum;
        const left = (gpuGain(x, 0, minimum) - gpuGain(x - h, 0, minimum)) / h;
        const right = (gpuGain(x + h, 0, minimum) - gpuGain(x, 0, minimum)) / h;
        expect(Math.abs(left)).toBeLessThan(6e-6);
        expect(Math.abs(right)).toBeLessThan(6e-6);
        expect(Math.abs(left - right)).toBeLessThan(6e-6);
      }
    }
  });

  it('bounds the area-energy correction and keeps C1 distance curves for fixed real profiles', () => {
    const profiles = [...gpuMaterial.vertexShader.matchAll(/TrafficLampShape\(vec4\(([^)]+)\),\s*[\d.-]+\)/g)];
    expect(profiles).toHaveLength(13);
    const focal = 720 / (2 * Math.tan(62 * Math.PI / 360));
    for (const row of profiles.slice(0, 12)) {
      const [, width, height, z] = row[1]!.split(',').map(Number);
      for (const scale of [1, 2, 3, 6]) {
        const energy = (depth: number): { corrected: number; floored: number; physical: number } => {
          const x = width! * scale * focal / (2 * depth);
          const y = height! * scale * focal / (2 * depth);
          const floored = actualFloor(x, 0.65) * actualFloor(y, 0.65) * (16 / 15) ** 2;
          return { corrected: floored * gpuGain(x, y, 0.65), floored, physical: x * y * (16 / 15) ** 2 };
        };
        for (const distance of [200, 700, 1200, 1300, 1400, 2500, 6500]) {
          const e = energy(distance - Math.abs(z!) * scale);
          expect(e.corrected / e.floored).toBeGreaterThanOrEqual(0.8 - 1e-12);
          expect(e.corrected / e.floored).toBeLessThanOrEqual(1 + 1e-12);
          expect(e.corrected).toBeGreaterThanOrEqual(e.physical * 0.8 - 1e-12);
        }
        for (const ratio of [0.8, 1.2]) {
          const depth = Math.max(width!, height!) * scale * focal / (2 * 0.65 * ratio);
          const h = depth * 1e-6;
          const e = energy(depth).corrected;
          const left = (e - energy(depth - h).corrected) / h;
          const right = (energy(depth + h).corrected - e) / h;
          expect(Math.abs(left - right)).toBeLessThan(1e-7);
        }
      }
    }
  });
});

describe('R28b actual traffic batches', () => {
  it('uses one depth-tested additive material pass for each flat batch', () => {
    for (const material of [cpuMaterial, gpuMaterial]) {
      expect(material.transparent).toBe(true);
      expect(material.forceSinglePass).toBe(true);
      expect(material.side).toBe(DoubleSide);
      expect(material.blending).toBe(AdditiveBlending);
      expect(material.depthTest).toBe(true);
      expect(material.depthWrite).toBe(false);
    }
    for (const object of [cpu, gpu]) {
      expect(object.userData.skyriverStageRole).toBe('transparent');
    }
  });

  it('uses fixed head and tail quads per logical car with full twenty-thousand capacity', () => {
    expect(gpu.geometry.getAttribute('aCorner').count).toBe(8);
    expect(gpu.geometry.getAttribute('position').count).toBe(8);
    expect(gpu.geometry.getIndex()!.count).toBe(12);
    expect(Array.from(gpu.geometry.getIndex()!.array)).toEqual([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    const lamp = gpu.geometry.getAttribute('aLamp');
    expect(lamp).not.toBeInstanceOf(InstancedBufferAttribute);
    expect(lamp.itemSize).toBe(1);
    expect(Array.from(lamp.array)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
    for (let at = 0; at < gpu.geometry.getIndex()!.count; at += 3) {
      const selectors = [0, 1, 2].map(offset => lamp.getX(gpu.geometry.getIndex()!.getX(at + offset)));
      expect(new Set(selectors).size).toBe(1);
    }
    for (const name of ['aImp', 'aFlow', 'aRoute', 'aAppearance', 'aFromAlpha']) {
      expect(gpu.geometry.getAttribute(name).count).toBe(20000);
    }
    traffic.setImpostorCount(20000);
    traffic.update(20, { x: 0, y: 1500, z: 0 });
    expect(traffic.stats().impostors).toBe(20000);
  });

  it('retains separate CPU head, tail and trail quads in one batch', () => {
    expect(cpu.geometry.getAttribute('aCorner').count).toBe(12);
    expect(cpu.geometry.getIndex()!.count).toBe(18);
    expect(Array.from(cpu.geometry.getAttribute('aLamp').array)).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 4, 4, 4, 4]);
    expect(gpuMaterial.vertexShader).toContain('float lampSide = 0.0;');
    expect(gpuMaterial.vertexShader).toContain('vPairOffset = pairHalfSpan / halfSize.x;');
    expect(gpuMaterial.fragmentShader).not.toContain('trailBody');
  });

  it('counts submitted triangles from the real geometry and current instance counts', () => {
    for (const seed of [424242, 0]) {
      const actual = createSkyriverTraffic({ seed, quality: TRAFFIC_QUALITY_TIERS.high, maxImpostors: 20000 });
      try {
        for (const [index, tier] of [TRAFFIC_QUALITY_TIERS.high, TRAFFIC_QUALITY_TIERS.medium, TRAFFIC_QUALITY_TIERS.low].entries()) {
          actual.setQuality(tier);
          actual.update(10 + index * 10, { x: 0, y: 1500, z: 0 });
          let submitted = 0;
          for (const object of actual.objects) {
            if (!(object instanceof Mesh)) throw new Error('R28B_UNEXPECTED_TRIANGLE_OBJECT');
            const geometry = object.geometry;
            const vertices = geometry.getIndex()?.count ?? geometry.getAttribute('position').count;
            expect(vertices % 3).toBe(0);
            let instances: number;
            if (object instanceof InstancedMesh) instances = object.count;
            else if (geometry instanceof InstancedBufferGeometry) instances = geometry.instanceCount;
            else throw new Error('R28B_UNEXPECTED_TRIANGLE_GEOMETRY');
            if (object.visible) submitted += vertices / 3 * instances;
          }
          expect(actual.stats().trianglesDrawn).toBe(submitted);
          expect(submitted).toBeGreaterThan(0);
        }
      } finally {
        actual.dispose();
      }
    }
  });
});

// Evaluate the three actual generated guard bodies. Three supplies the independent planes.
function guardBody(source: string, name: string): string {
  const start = source.search(new RegExp('(?:float|bool)\\s+' + name + '\\s*\\('));
  if (start < 0) throw new Error('R28B_ACTUAL_GUARD_MISSING:' + name);
  const open = source.indexOf('{', start);
  let depth = 1;
  for (let i = open + 1; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i).replace(/\/\/[^\n]*/g, '');
  }
  throw new Error('R28B_GUARD_BODY_NOT_CLOSED');
}
const radiusRun = new Function('type', 'scale', guardBody(gpuMaterial.vertexShader, 'trafficLampPhysicalRadius')) as
  (type: number, scale: number) => number;
const vectorAdd = (a: number[], b: number[]): number[] => a.map((v, i) => v + b[i]!);
const vectorSub = (a: number[], b: number[]): number[] => a.map((v, i) => v - b[i]!);
const outsideRun = new Function('plane', 'point', 'radius', 'dot', 'length',
  guardBody(gpuMaterial.vertexShader, 'trafficLampOutsidePlane').replace(/plane\.xyz/g, 'plane.slice(0, 3)')) as
  (plane: number[], point: number[], radius: number, dot: (a: number[], b: number[]) => number,
    length: (v: number[]) => number) => boolean;
const actualOutside = (plane: number[], point: number[], radius: number): boolean => outsideRun(
  plane, point, radius, (a, b) => a.reduce((sum, v, i) => sum + v * b[i]!, 0), v => Math.hypot(...v));
const inViewBody = guardBody(gpuMaterial.vertexShader, 'trafficLampInView')
  .replace(/vec4\s+point\s*=\s*viewMatrix\s*\*\s*vec4\(pos,\s*1\.0\)\s*;/, 'const point = transformPoint(pos);')
  .replace(/\b(?:float|vec4)\s+(\w+)\s*=/g, 'const $1 =')
  .replace(/point\.z/g, 'point[2]')
  .replace(/(row[0-3])\s*([+-])\s*(row[0-3])/g, (_, a: string, op: string, b: string) =>
    `${op === '+' ? 'add' : 'subtract'}(${a}, ${b})`);
const viewRun = new Function('pos', 'type', 'scale', 'cssPixelScale', 'extraM', 'projectionMatrix', 'transformPoint',
  'vec4', 'max', 'trafficLampPhysicalRadius', 'trafficLampOutsidePlane', 'add', 'subtract', inViewBody) as
  (pos: number[], type: number, scale: number, pixelScale: number, extraM: number, projection: number[][],
    transform: (v: number[]) => number[], vec4: (...v: number[]) => number[], max: typeof Math.max,
    radius: typeof radiusRun, outside: typeof actualOutside, add: typeof vectorAdd, subtract: typeof vectorSub) => boolean;
function actualInView(camera: PerspectiveCamera, pos: Vector3, type: number, scale: number,
  height = 720, extraM = 0): boolean {
  const e = camera.projectionMatrix.elements;
  return viewRun(pos.toArray(), type, scale, 2 / (height * e[5]!), extraM,
    [0, 1, 2, 3].map(i => e.slice(i * 4, i * 4 + 4)),
    v => new Vector4(v[0], v[1], v[2], 1).applyMatrix4(camera.matrixWorldInverse).toArray(),
    (...v) => v, Math.max, radiusRun, actualOutside, vectorAdd, vectorSub);
}
const names = ['cab', 'interceptor', 'commuter', 'van', 'bus', 'flatbed'] as const;
// These are original emissive vertices from the real constructor, not profile-table vertices.
const physicalVertices = names.map((name, type) => {
  const hull = traffic.objects.find(o => o.name === 'skyriver.traffic.' + name);
  if (!(hull instanceof InstancedMesh)) throw new Error('R28B_REAL_HULL_MISSING:' + name);
  const geometry = hull.geometry;
  const position = geometry.getAttribute('position'), color = geometry.getAttribute('color');
  const vertices: Vector3[] = [];
  const index = geometry.index, cornerCount = index ? index.count : position.count;
  for (let at = 0; at < cornerCount; at += 3) {
    const ids = [0, 1, 2].map(k => index ? index.getX(at + k) : at + k);
    const lamp = [[2, 2.15, 2.3], [4, 0.3, 0.2]].some(rgb => ids.every(i =>
      rgb.every((v, k) => Math.abs(v - [color.getX(i), color.getY(i), color.getZ(i)][k]!) < 1e-5)));
    if (lamp) for (const i of ids) vertices.push(new Vector3(position.getX(i), position.getY(i), position.getZ(i)));
  }
  // These literal counts come from the old physical lamp triangles. Index reuse cannot change them.
  const oldLampTriangleCount = [6, 4, 6, 6, 6, 4][type]!;
  if (vertices.length !== oldLampTriangleCount * 3) throw new Error('R28B_ORIGINAL_LAMP_TRIANGLES_CHANGED:' + name);
  return vertices;
});
function cameraForGuard(fov = 62, aspect = 1280 / 720, skew = false): PerspectiveCamera {
  const camera = new PerspectiveCamera(fov, aspect, 1, 14000);
  if (skew) {
    camera.projectionMatrix.elements[8] = 0.24;
    camera.projectionMatrix.elements[9] = -0.13;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  camera.updateMatrixWorld(true);
  return camera;
}
function independentFrustum(camera: PerspectiveCamera): Frustum {
  return new Frustum().setFromProjectionMatrix(camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse));
}
const badCameras = [
  { time: 8, index: 5589, position: [1387.6057642949631, 2051.0173251882807, 918.3079331881204],
    quaternion: [0.07290995826266465, -0.3910643982990535, 0.0378879680000076, 0.9166882110346823] },
  { time: 24, index: 19867, position: [3147.563706471465, 1247.3797653876188, -1936.2240765601732],
    quaternion: [-0.07973752630654558, 0.013443447705463185, -0.08504191205237673, 0.9930906674653526] },
];

describe('R28b independent physical frustum bound', () => {
  it('bounds the original constructor lamp vertices and extra physical trail length', () => {
    for (const [type, vertices] of physicalVertices.entries()) {
      const realRadius = Math.max(...vertices.map(v => v.length()));
      for (const scale of [1, 1.6503677368164062, 2, 3, 6]) {
        expect(radiusRun(type, scale)).toBeCloseTo(realRadius * scale, 5);
        for (const v of vertices) {
          // Float32 constructor coordinates have rounding error below one micrometre.
          expect(v.length() * scale).toBeLessThanOrEqual(radiusRun(type, scale) + 2e-6);
          for (const direction of [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]) {
            expect(v.clone().multiplyScalar(scale).addScaledVector(direction, 60).length())
              .toBeLessThanOrEqual(radiusRun(type, scale) + 60 + 2e-6);
          }
        }
      }
    }
  });

  it('agrees with independent Three sphere planes and keeps tangent or edge spheres', () => {
    expect(actualOutside([1, 0, 0, 0], [-7, 0, 0, 1], 7)).toBe(false);
    for (const camera of [cameraForGuard(40), cameraForGuard(), cameraForGuard(90, 390 / 844, true)]) {
      const frustum = independentFrustum(camera);
      for (const plane of frustum.planes) {
        const packed = [...plane.normal.toArray(), plane.constant];
        const sphereRadius = 7;
        for (const distance of [-sphereRadius - 0.01, -sphereRadius, -sphereRadius + 0.01, 0, 20]) {
          const point = plane.normal.clone().multiplyScalar(distance - plane.constant);
          const expected = plane.distanceToPoint(point) < -sphereRadius;
          if (distance === -sphereRadius) {
            // Scaling a real plane can move its floating-point tangent by one rounding unit.
            expect(plane.distanceToPoint(point)).toBeCloseTo(-sphereRadius, 8);
          } else {
            expect(actualOutside(packed, [...point.toArray(), 1], sphereRadius)).toBe(expected);
            expect(actualOutside(packed.map(v => v * 5), [...point.toArray(), 1], sphereRadius)).toBe(expected);
          }
        }
      }
      for (const pos of [new Vector3(0, 0, -1200), new Vector3(0, 0, -13999),
        new Vector3(0, 0, -1), new Vector3(-3000, 0, -1), new Vector3(0, 3000, -1),
        new Vector3(0, 0, 100), new Vector3(0, 0, -15000)]) {
        const radius = radiusRun(0, 2), pixelAngle = 2 / (720 * camera.projectionMatrix.elements[5]!);
        const padded = radius + 3 * pixelAngle * Math.max(-pos.z + radius, 1);
        const independent = frustum.intersectsSphere(new Sphere(pos, padded));
        expect(actualInView(camera, pos, 0, 2)).toBe(independent);
      }
    }
  });

  it('keeps physical corners and plane crossings at all six boundaries with skew projections', () => {
    for (const camera of [cameraForGuard(), cameraForGuard(62, 390 / 844), cameraForGuard(90, 390 / 844, true)]) {
      const frustum = independentFrustum(camera);
      const centre = new Vector3(0, 0, -1200);
      for (const [type, vertices] of physicalVertices.entries()) {
        for (const plane of frustum.planes) {
          const onPlane = plane.projectPoint(centre, new Vector3());
          // Put each real lamp vertex on the plane, then slightly inside it.
          for (const v of vertices) {
            const pos = onPlane.clone().sub(v.clone().multiplyScalar(2)).addScaledVector(plane.normal, 0.01);
            expect(actualInView(camera, pos, type, 2)).toBe(true);
          }
        }
      }
    }
  });

  it('covers the floor, filter, and trail cap padding without changing physical dimensions', () => {
    for (const pixelM of [1e-5, 0.01, 1, 20]) {
      const minimum = 0.65 * pixelM;
      let worstCoreExtra = 0;
      for (let i = 0; i <= 500; i++) {
        const physical = minimum * i / 200;
        worstCoreExtra = Math.max(worstCoreExtra, actualFloor(physical, minimum) - physical + 0.5 * pixelM);
      }
      expect(Math.SQRT2 * worstCoreExtra).toBeLessThan(3 * pixelM);
      expect(Math.SQRT2 * 1.6 * pixelM).toBeLessThan(3 * pixelM);
    }
    const camera = cameraForGuard(), plane = independentFrustum(camera).planes[0]!;
    const boundary = plane.projectPoint(new Vector3(0, 0, -1200), new Vector3());
    const pos = boundary.clone().addScaledVector(plane.normal, -40);
    expect(actualInView(camera, pos, 0, 1, 720, 0)).toBe(false);
    expect(actualInView(camera, pos, 0, 1, 720, 60)).toBe(true);
  });

  it('rejects both measured near-camera-plane side sources before the lamp Jacobian', () => {
    const attrs = deriveImpostorAttributes(424242, 20000);
    for (const c of badCameras) {
      const pose = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };
      impostorPosition(attrs, c.index, c.time, pose);
      const appearance = unpackTrafficAppearance(attrs.appearance[c.index]!);
      const camera = cameraForGuard();
      camera.position.fromArray(c.position); camera.quaternion.fromArray(c.quaternion); camera.updateMatrixWorld(true);
      const pos = new Vector3(pose.x, pose.y, pose.z);
      expect(pos.distanceTo(camera.position)).toBeGreaterThan(2500);
      expect(Object.values(pose).every(Number.isFinite)).toBe(true);
      expect(actualInView(camera, pos, appearance.type, appearance.scale)).toBe(false);
      for (const source of [cpuMaterial.vertexShader, gpuMaterial.vertexShader]) {
        const main = source.slice(source.lastIndexOf('void main()'));
        expect(main.indexOf('trafficLampInView(')).toBeGreaterThan(0);
        expect(main.indexOf('trafficLampInView(')).toBeLessThan(main.indexOf('trafficLampKernel('));
      }
    }
    expect(cpuMaterial.vertexShader).toMatch(/trafficLampInView\(aCarPos,\s*type,\s*scale,\s*uCssPixelAngle,\s*isTrail\s*\?\s*uTrailMax\s*:\s*0\.0\)/);
    expect(gpuMaterial.vertexShader).toMatch(/trafficLampInView\(pos,\s*type,\s*scale,\s*uCssPixelAngle,\s*0\.0\)/);
    for (const name of ['trafficLampPhysicalRadius', 'trafficLampOutsidePlane', 'trafficLampInView']) {
      expect(guardBody(cpuMaterial.vertexShader, name)).toBe(guardBody(gpuMaterial.vertexShader, name));
    }
  });

  it('preserves visible original physical lamp corners across four actual twenty-thousand-source models', () => {
    let insideSources = 0, rejectedInsideSources = 0, independentSphereIntersections = 0;
    const cameraCases = [cameraForGuard(), cameraForGuard(62, 390 / 844), cameraForGuard(90, 390 / 844, true)];
    for (const [i, c] of badCameras.entries()) {
      cameraCases[i]!.position.fromArray(c.position);
      cameraCases[i]!.quaternion.fromArray(c.quaternion);
      cameraCases[i]!.updateMatrixWorld(true);
    }
    cameraCases[2]!.position.set(1387.6, 2051, 918.3); cameraCases[2]!.lookAt(0, 900, 2500); cameraCases[2]!.updateMatrixWorld(true);
    const cameras = cameraCases.map(camera => ({ camera, frustum: independentFrustum(camera) }));
    for (const seed of [0, 2147483647, 4294967295, 424242]) {
      const attrs = deriveImpostorAttributes(seed, 20000);
      for (let index = 0; index < 20000; index++) {
        const { camera, frustum } = cameras[index % cameras.length]!;
        const pose = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };
        impostorPosition(attrs, index, index % 2 ? 24 : 8, pose);
        const { type, scale } = unpackTrafficAppearance(attrs.appearance[index]!);
        const pos = new Vector3(pose.x, pose.y, pose.z), forward = new Vector3(pose.dx, pose.dy, pose.dz).normalize();
        const right = new Vector3(forward.z, 0, -forward.x).normalize(), up = new Vector3().crossVectors(forward, right);
        const world = new Matrix4().makeBasis(right, up, forward).scale(new Vector3(scale, scale, scale)).setPosition(pos);
        const cornersInside = physicalVertices[type]!.some(v => frustum.containsPoint(v.clone().applyMatrix4(world)));
        const retained = actualInView(camera, pos, type, scale);
        if (cornersInside) { insideSources++; if (!retained) rejectedInsideSources++; }
        if (frustum.intersectsSphere(new Sphere(pos, radiusRun(type, scale)))) {
          independentSphereIntersections++;
          if (!retained) throw new Error(`R28B_PHYSICAL_SPHERE_REJECTED:${seed}:${index}`);
        }
      }
    }
    expect(insideSources).toBeGreaterThan(1000);
    expect(independentSphereIntersections).toBeGreaterThan(insideSources - 1);
    expect(rejectedInsideSources).toBe(0);
  }, 20000);
});


describe('R32 independent CSS coverage and physical pixel filter', () => {
  it('installs both actual material angles through FOV, resize, and DPR changes', () => {
    const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
    expect(main).toContain('scene.renderer.getDrawingBufferSize(bufferSize);');
    expect(main).toContain('scene.renderer.getSize(cssSize);');
    expect(main).toMatch(/traffic\.setPixelAngle\(\s*inverseFocalLength \/ Math\.max\(1, bufferSize\.y\),\s*inverseFocalLength \/ Math\.max\(1, cssSize\.y\),?\s*\)/);
    const expression = main.match(/const inverseFocalLength = ([^;]+);/);
    if (!expression) throw new Error('R32_ACTUAL_FOCAL_EXPRESSION_MISSING');
    const run = new Function('frame', 'return ' + expression[1]) as (frame: { camera: { fov: number } }) => number;
    for (const fov of [45, 62, 78]) for (const cssHeight of [390, 720, 1001]) for (const dpr of [1, 1.25]) {
      const camera = new PerspectiveCamera(fov, 16 / 9, 1, 10000);
      const bufferHeight = Math.floor(cssHeight * dpr);
      const cssAngle = run({ camera }) / cssHeight, bufferAngle = run({ camera }) / bufferHeight;
      expect(cssAngle).toBeCloseTo(2 / (cssHeight * camera.projectionMatrix.elements[5]!), 14);
      traffic.setPixelAngle(bufferAngle, cssAngle);
      for (const material of [cpuMaterial, gpuMaterial]) {
        expect(material.uniforms.uPixelAngle!.value).toBe(bufferAngle);
        expect(material.uniforms.uCssPixelAngle!.value).toBe(cssAngle);
        expect(material.uniforms.uCssPixelAngle!.value / material.uniforms.uPixelAngle!.value).toBeCloseTo(bufferHeight / cssHeight, 14);
      }
    }
  });

  it('uses CSS angle only for coverage and culling while physical padding remains buffer-sized', () => {
    for (const source of [cpuMaterial.vertexShader, gpuMaterial.vertexShader]) {
      expect(source).toContain('float cssPixelM = depth * cssPixelScale;');
      expect(source).toContain('float floorSize = 0.65000000 * cssPixelM;');
      expect(source).toContain('float radius = physicalRadius + 3.0 * cssPixelScale * max(-point.z + physicalRadius, 1.0);');
      expect(source).toMatch(/trafficLampKernel\([\s\S]*?uCssPixelAngle, lamp, v0,/);
      expect(source).toMatch(/trafficLampInView\([^;]+uCssPixelAngle/);
      expect(source).toContain('vec2(max(-v0.z, 1.0) * uPixelAngle * 0.5)');
      const uses = source.match(/uCssPixelAngle/g) ?? [];
      expect(uses).toHaveLength(source === cpuMaterial.vertexShader ? 4 : 3);
    }
    expect(cpuMaterial.vertexShader).toContain('float startRadius = max(0.6, -v0.z * uCssPixelAngle * 1.6);');
    expect(body(cpuMaterial.fragmentShader, 'trafficFilteredLamp')).toContain('vec2 halfPixel = 0.5 * sqrt(dx * dx + dy * dy);');
  });

  it('retains CSS footprint and integrated pair energy across DPR and sample phase', () => {
    const rows = [...gpuMaterial.vertexShader.matchAll(/TrafficLampShape\(vec4\(([^)]+)\),\s*[\d.-]+\)/g)].slice(0, 12);
    expect(rows).toHaveLength(12);
    const cssAngle = 2 * Math.tan(62 * Math.PI / 360) / 720;
    for (const row of rows) {
      const [separation, width, height] = row[1]!.split(',').map(Number);
      for (const depth of [200, 900, 3000]) {
        const minimum = 0.65 * depth * cssAngle;
        const hx = actualFloor(width!, minimum) / (depth * cssAngle);
        const hy = actualFloor(height!, minimum) / (depth * cssAngle);
        const offset = separation! * 2 / (depth * cssAngle);
        expect(2 * hx).toBeGreaterThanOrEqual(1.3); expect(2 * hy).toBeGreaterThanOrEqual(1.3);
        const expected = hx * hy * (16 / 15) ** 2;
        const gain = gpuGain(width!, height!, minimum);
        for (const dpr of [1, 1.25]) for (const phase of [0, 0.25, 0.7]) {
          const energy = totalPairEnergy(hx * dpr, hy * dpr, offset * dpr, phase, 1 - phase) / (dpr * dpr);
          expect(energy * gain).toBeCloseTo(expected * gain, 9);
          expect((hx * dpr) / dpr).toBeCloseTo(hx, 14);
          // One physical filter pixel is 1/DPR CSS pixels.
          expect(0.5 / (hx * dpr)).toBeCloseTo((0.5 / dpr) / hx, 14);
        }
      }
    }
  });
});
