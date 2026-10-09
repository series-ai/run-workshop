import { afterAll, describe, expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial, Vector3 } from 'three';
import { createSkyriverTraffic, TRAFFIC_QUALITY_TIERS } from '../src/render/traffic';

const names = ['cab', 'interceptor', 'commuter', 'van', 'saucer', 'bus', 'flatbed'] as const;
const traffic = createSkyriverTraffic({ seed: 424242, quality: TRAFFIC_QUALITY_TIERS.high, maxImpostors: 20000 });
afterAll(() => traffic.dispose());
function mesh(name: string): Mesh {
  const value = traffic.objects.find(object => object.name === name);
  if (!(value instanceof Mesh)) throw new Error(`R30_REAL_MESH_MISSING:${name}`);
  return value;
}
function material(name: string): ShaderMaterial {
  const value = mesh(name).material;
  if (!(value instanceof ShaderMaterial)) throw new Error(`R30_REAL_MATERIAL_MISSING:${name}`);
  return value;
}
function functionBody(source: string, name: string): string {
  const at = source.indexOf(`float ${name}(`);
  if (at < 0) throw new Error(`R30_INSTALLED_FUNCTION_MISSING:${name}`);
  const start = source.indexOf('{', at);
  let depth = 1;
  for (let i = start + 1; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}' && --depth === 0) return source.slice(start + 1, i).replace(/\/\/[^\n]*/g, '');
  }
  throw new Error(`R30_INSTALLED_FUNCTION_UNCLOSED:${name}`);
}
function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function emissivePoints(geometry: BufferGeometry, head: boolean): Vector3[] {
  const positions = geometry.getAttribute('position'), colors = geometry.getAttribute('color'), index = geometry.getIndex();
  const rgb = head ? [2, 2.15, 2.3] : [4, 0.3, 0.2];
  const points: Vector3[] = [];
  for (let at = 0; at < (index?.count ?? positions.count); at += 3) {
    const ids = [0, 1, 2].map(k => index ? index.getX(at + k) : at + k);
    if (!ids.every(i => rgb.every((value, k) => Math.abs(value - colors.getComponent(i, k)) < 1e-5))) continue;
    for (const i of ids) points.push(new Vector3().fromBufferAttribute(positions, i));
  }
  if (!points.length) throw new Error('R30_INDEXED_EMISSIVE_TRIANGLES_MISSING');
  return points;
}

describe('R30 independent fixed lamp groups', () => {
  it.each(names)('keeps both %s groups at the measured indexed hull endpoints', name => {
    const shader = material('skyriver.traffic.impostors').vertexShader;
    const rows = [...shader.matchAll(/if\s*\(type\s*<\s*([\d.]+)\)\s*\{\s*if\s*\(front\)\s*return\s+TrafficLampShape\(vec4\(([^)]+)\),\s*([\d.-]+)\);\s*return\s+TrafficLampShape\(vec4\(([^)]+)\),\s*([\d.-]+)\);\s*\}/g)];
    expect(rows).toHaveLength(7);
    const type = names.indexOf(name), row = rows[type]!;
    expect(Number(row[1])).toBe(type + 0.5);
    for (const head of [true, false]) {
      const points = emissivePoints(mesh(`skyriver.traffic.${name}`).geometry, head);
      const shape = row[head ? 2 : 4]!.split(',').map(Number), y = Number(row[head ? 3 : 5]);
      const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
      const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
      const minZ = Math.min(...points.map(p => p.z)), maxZ = Math.max(...points.map(p => p.z));
      expect(shape[0]! * 2 + shape[1]!).toBeCloseTo(maxX - minX, 5);
      expect(shape[2]).toBeCloseTo(maxY - minY, 5);
      expect(shape[3]).toBeCloseTo((minZ + maxZ) / 2, 5);
      expect(y).toBeCloseTo((minY + maxY) / 2, 5);
      const measured = new Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
      for (const heading of [-Math.PI, -Math.PI / 2, -Math.PI / 4, 0, Math.PI / 4, Math.PI / 2, Math.PI]) {
        const forward = new Vector3(Math.sin(heading), 0, Math.cos(heading)), up = new Vector3(0, 1, 0);
        const expected = forward.clone().multiplyScalar(measured.z).addScaledVector(up, measured.y);
        const actual = forward.clone().multiplyScalar(shape[3]!).addScaledVector(up, y);
        expect(actual.distanceTo(expected)).toBeLessThan(1e-6);
      }
    }
    const main = shader.slice(shader.lastIndexOf('void main()'));
    expect(main).toMatch(/bool\s+head\s*=\s*aLamp\s*<\s*0\.5/);
    expect(main).toMatch(/trafficLampKernel\(pos,\s*dir,\s*0\.0,\s*type,\s*scale,\s*head\s*,/);
    expect(main).not.toContain('frontMix');
    expect(shader).toMatch(/bool\s+front,\s*float\s+lampSide/);
    expect(shader).toContain('TrafficLampShape profile = trafficLampProfile(type, front);');
    expect(shader).toContain('vec3 group = pos + scale * (forward * shape.w + upW * profile.y);');
    expect(main).toMatch(/vWarm\s*=\s*head\s*\?\s*1\.0\s*:\s*0\.0/);
  });

  it('uses the existing CPU facing curves in both actual materials at side and quarter views', () => {
    const sources = [material('skyriver.traffic.streaks').vertexShader, material('skyriver.traffic.impostors').vertexShader];
    const bodies = sources.map(source => functionBody(source, 'trafficLampFacingGain'));
    expect(bodies[0]).toBe(bodies[1]);
    for (const source of sources) {
      const run = new Function('facing', 'head', 'smoothstep', functionBody(source, 'trafficLampFacingGain')) as
        (facing: number, head: boolean, smooth: typeof smoothstep) => number;
      for (const degrees of [-180, -135, -100, -90, -80, -45, 0, 45, 80, 90, 100, 135, 180]) {
        const facing = Math.cos(degrees * Math.PI / 180);
        expect(run(facing, true, smoothstep)).toBeCloseTo(smoothstep(0.1, 0.7, facing), 12);
        expect(run(facing, false, smoothstep)).toBeCloseTo(smoothstep(-0.85, 0.3, -facing), 12);
      }
      const main = source.slice(source.lastIndexOf('void main()'));
      expect(main).toMatch(/cameraPosition\s*-\s*lamp/);
      if (main.includes('bool head = aLamp')) {
        expect(main).toMatch(/vec3\s+toLamp\s*=\s*cameraPosition\s*-\s*lamp/);
        expect(main).toMatch(/float\s+facing\s*=\s*dot\(dir,\s*toLamp\s*\//);
      } else {
        expect(main).toMatch(/vec3\s+toCam\s*=\s*normalize\(\s*cameraPosition\s*-\s*lamp\s*\)/);
        expect(main).toMatch(/float\s+facing\s*=\s*dot\(\s*dir,\s*toCam\s*\)\s*;/);
      }
      expect(main).toMatch(/trafficLampFacingGain\(\s*facing\s*,\s*head\s*\)/);
    }
  });

  it('keeps each indexed quad selector constant and all dynamic data at logical car capacity', () => {
    const geometry = mesh('skyriver.traffic.impostors').geometry;
    const selector = geometry.getAttribute('aLamp');
    expect(selector).toBeInstanceOf(BufferAttribute);
    expect(selector).not.toBeInstanceOf(InstancedBufferAttribute);
    expect(Array.from(selector.array)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
    expect(geometry.getIndex()!.count).toBe(12);
    const groups: number[] = [];
    for (let at = 0; at < 12; at += 3) {
      const values = [0, 1, 2].map(k => selector.getX(geometry.getIndex()!.getX(at + k)));
      expect(values).toEqual([values[0], values[0], values[0]]);
      groups.push(values[0]!);
    }
    expect(groups).toEqual([0, 0, 1, 1]);
    for (const name of ['aImp', 'aFlow', 'aRoute', 'aAppearance', 'aFromAlpha']) {
      const attribute = geometry.getAttribute(name);
      expect(attribute).toBeInstanceOf(InstancedBufferAttribute);
      expect(attribute.count).toBe(20000);
    }
  });

  it('preserves odd logical counts and captured tier alpha through interrupted transitions', () => {
    const actual = createSkyriverTraffic({ seed: 424242, quality: TRAFFIC_QUALITY_TIERS.low, maxImpostors: 20000 });
    try {
      const gpu = actual.objects.find(o => o.name === 'skyriver.traffic.impostors') as Mesh;
      const geometry = gpu.geometry as InstancedBufferGeometry, shader = gpu.material as ShaderMaterial;
      const camera = { x: 0, y: 1500, z: 0 };
      actual.update(0, camera); actual.setImpostorCount(5); actual.update(0, camera); actual.update(0.3, camera);
      actual.setImpostorCount(3); actual.update(0.3, camera);
      const alpha = geometry.getAttribute('aFromAlpha');
      expect(shader.uniforms.uTargetCount!.value).toBe(3);
      expect(geometry.instanceCount).toBe(5);
      for (let car = 0; car < 5; car += 1) expect(alpha.getX(car)).toBeCloseTo(0.25, 6);
      actual.update(1.5, camera);
      expect(geometry.instanceCount).toBe(3); expect(actual.stats().impostors).toBe(3);
      actual.setImpostorCount(1); actual.update(1.5, camera); actual.update(2.7, camera);
      expect(geometry.instanceCount).toBe(1); expect(actual.stats().impostors).toBe(1);
      expect(geometry.getIndex()!.count / 3 * geometry.instanceCount).toBe(4);
      expect(shader.vertexShader).toMatch(/float\(\s*gl_InstanceID\s*\)\s*<\s*uTargetCount/);
    } finally { actual.dispose(); }
  });
});
