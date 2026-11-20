// CPU-side helpers for the bake steps: seeded random, value noise, colour mixing.

export type RGB = [number, number, number];

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hex(h: number): RGB {
  return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
}

export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function mix3(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const n000 = hash3(ix, iy, iz), n100 = hash3(ix + 1, iy, iz);
  const n010 = hash3(ix, iy + 1, iz), n110 = hash3(ix + 1, iy + 1, iz);
  const n001 = hash3(ix, iy, iz + 1), n101 = hash3(ix + 1, iy, iz + 1);
  const n011 = hash3(ix, iy + 1, iz + 1), n111 = hash3(ix + 1, iy + 1, iz + 1);
  const a = n000 + (n100 - n000) * ux, b = n010 + (n110 - n010) * ux;
  const c = n001 + (n101 - n001) * ux, d = n011 + (n111 - n011) * ux;
  const e = a + (b - a) * uy, f = c + (d - c) * uy;
  return e + (f - e) * uz;
}

export function noise2(x: number, y: number): number {
  return noise3(x, y, 7.31);
}

export function fbm2(x: number, y: number, octaves = 4): number {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) {
    v += a * noise3(x * f, y * f, i * 13.7);
    f *= 2.03;
    a *= 0.5;
  }
  return v;
}

export function fbm3(x: number, y: number, z: number, octaves = 4): number {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) {
    v += a * noise3(x * f + i * 5.1, y * f + i * 9.3, z * f + i * 2.7);
    f *= 2.03;
    a *= 0.5;
  }
  return v;
}
