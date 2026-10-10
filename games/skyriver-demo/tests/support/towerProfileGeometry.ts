import type { SkyriverMass } from '../../src/render/city';

export interface TowerSection {
  readonly x0: number; readonly x1: number;
  readonly z0: number; readonly z1: number;
}

export function massSection(mass: SkyriverMass): TowerSection {
  return { x0: mass.x - mass.width / 2, x1: mass.x + mass.width / 2,
    z0: mass.z - mass.depth / 2, z1: mass.z + mass.depth / 2 };
}

export function sectionUnionBounds(sections: readonly TowerSection[]): TowerSection {
  if (sections.length === 0) throw new Error('R36_EMPTY_STAGE');
  return { x0: Math.min(...sections.map(s => s.x0)), x1: Math.max(...sections.map(s => s.x1)),
    z0: Math.min(...sections.map(s => s.z0)), z1: Math.max(...sections.map(s => s.z1)) };
}

/** Exact rectangular-union area. The source uses no local yaw. */
export function sectionUnionArea(sections: readonly TowerSection[]): number {
  const xs = [...new Set(sections.flatMap(s => [s.x0, s.x1]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1]!, b = xs[i]!, mid = (a + b) / 2;
    const spans = sections.filter(s => s.x0 < mid && s.x1 > mid).map(s => [s.z0, s.z1] as const).sort((u, v) => u[0] - v[0]);
    let top = -Infinity;
    for (const [low, high] of spans) { area += (b - a) * Math.max(0, high - Math.max(low, top)); top = Math.max(top, high); }
  }
  return area;
}

/** Positive volume excludes face contact. All dimensions come from actual mass records. */
export function massIntersectsPrism(mass: SkyriverMass, prism: TowerSection & { readonly y0: number; readonly y1: number }): boolean {
  const s = massSection(mass);
  return Math.min(s.x1, prism.x1) > Math.max(s.x0, prism.x0)
    && Math.min(s.z1, prism.z1) > Math.max(s.z0, prism.z0)
    && Math.min(mass.y0 + mass.height, prism.y1) > Math.max(mass.y0, prism.y0);
}

/** Geometry only. Do not add identity, tint, material seed, or draw index to this value. */
export function normalizedTowerGeometry(masses: readonly SkyriverMass[], tower: { readonly x: number; readonly z: number; readonly width: number; readonly depth: number; readonly height: number }): readonly (readonly number[])[] {
  const q = (v: number) => Math.round(v * 1e6) / 1e6;
  return masses.map(m => [q((m.x - tower.x) / tower.width), q((m.z - tower.z) / tower.depth),
    q(m.y0 / tower.height), q(m.width / tower.width), q(m.height / tower.height), q(m.depth / tower.depth)])
    .sort((a, b) => { for (let i = 0; i < a.length; i++) { const d = a[i]! - b[i]!; if (d !== 0) return d; } return 0; });
}

export function intersectSection(a: TowerSection, b: TowerSection): TowerSection | null {
  const result = { x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1), z0: Math.max(a.z0, b.z0), z1: Math.min(a.z1, b.z1) };
  return result.x1 > result.x0 && result.z1 > result.z0 ? result : null;
}

/** Canonical union removes hidden rectangle edges. */
export function canonicalSectionUnion(sections: readonly TowerSection[]): readonly (readonly number[])[] {
  const xs = [...new Set(sections.flatMap(s => [s.x0, s.x1]))].sort((a, b) => a - b);
  const strips: number[][] = [];
  for (let i = 1; i < xs.length; i++) {
    const x0 = xs[i - 1]!, x1 = xs[i]!, mid = (x0 + x1) / 2;
    const spans = sections.filter(s => s.x0 < mid && s.x1 > mid).map(s => [s.z0, s.z1]).sort((a, b) => a[0]! - b[0]!);
    const union: number[][] = [];
    for (const span of spans) {
      const last = union.at(-1);
      if (last && span[0]! <= last[1]!) last[1] = Math.max(last[1]!, span[1]!);
      else union.push([...span]);
    }
    const tail = union.flat();
    const last = strips.at(-1);
    if (last && last[1] === x0 && JSON.stringify(last.slice(2)) === JSON.stringify(tail)) last[1] = x1;
    else if (tail.length > 0) strips.push([x0, x1, ...tail]);
  }
  return strips;
}

/** Fingerprint the exposed body union below the original roof. */
export function normalizedExposedTowerGeometry(masses: readonly SkyriverMass[], tower: { readonly x: number; readonly z: number; readonly width: number; readonly depth: number; readonly height: number }): readonly (readonly number[])[] {
  const ys = [...new Set([0, tower.height, ...masses.flatMap(m => [Math.max(0, Math.min(tower.height, m.y0)), Math.max(0, Math.min(tower.height, m.y0 + m.height))])])].sort((a, b) => a - b);
  const bands: number[][] = [];
  const q = (v: number) => Math.round(v * 1e6) / 1e6;
  for (let i = 1; i < ys.length; i++) {
    const y0 = ys[i - 1]!, y1 = ys[i]!, mid = (y0 + y1) / 2;
    const sections = masses.filter(m => m.y0 < mid && m.y0 + m.height > mid).map(massSection);
    const shape = canonicalSectionUnion(sections).flatMap(row => [row.length, ...row.map((value, j) => q(j < 2 ? (value - tower.x) / tower.width : (value - tower.z) / tower.depth))]);
    const last = bands.at(-1);
    if (last && last[1] === q(y0 / tower.height) && JSON.stringify(last.slice(2)) === JSON.stringify(shape)) last[1] = q(y1 / tower.height);
    else bands.push([q(y0 / tower.height), q(y1 / tower.height), ...shape]);
  }
  return bands;
}
