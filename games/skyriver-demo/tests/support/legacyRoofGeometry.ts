import { buildingSeedOf, type SkyriverMass, type SkyriverTowerProfileRow } from '../../src/render/city';
import type { LegacyTrimGeometry, LegacyTrimSource } from './legacyTrimInventory';
import { sourceBoxSection, independentMassRoofBox } from './towerProfileGeometry';
import { addedVolumeCells, artVolumeBox, addedCellRoofBox, exactCellConflict, type AddedVolumeCell } from './towerAddedVolume';
import { roofBoxesConflict, roofFloatUlp, roofSupportFailures, type RoofBox } from './rooftopDetailsGeometry';

export type ReservedAirBox = RoofBox & { readonly cell?: AddedVolumeCell };
export function reservedAirConflict(box: RoofBox, air: ReservedAirBox): boolean {
  return air.cell ? exactCellConflict(air.cell, box) : roofBoxesConflict(box, air);
}

/** The grid only selects candidates. The unchanged full OBB test decides contact. */
export function roofConflictQuery(boxes: readonly (ReservedAirBox | null)[]): (box: RoofBox, exclude?: number) => readonly number[] {
  const cells = new Map<string, number[]>(), cell = 128;
  const range = (box: RoofBox) => {
    const x = Math.abs(box.c) * box.hx + Math.abs(box.s) * box.hz;
    const z = Math.abs(box.s) * box.hx + Math.abs(box.c) * box.hz;
    return [Math.floor((box.x - x) / cell), Math.floor((box.x + x) / cell), Math.floor((box.z - z) / cell), Math.floor((box.z + z) / cell)] as const;
  };
  for (const [index, box] of boxes.entries()) {
    if (box === null) continue;
    const [x0, x1, z0, z1] = range(box);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const key = `${x}:${z}`, indices = cells.get(key) ?? []; indices.push(index); cells.set(key, indices);
    }
  }
  return (box, exclude = -1) => {
    const [x0, x1, z0, z1] = range(box), checked = new Set<number>(), hits: number[] = [];
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (const index of cells.get(`${x}:${z}`) ?? []) {
      if (index === exclude || checked.has(index)) continue;
      checked.add(index);
      const other = boxes[index];
      if (other && reservedAirConflict(box, other)) hits.push(index);
    }
    return hits.sort((a, b) => a - b);
  };
}

/** Reconstruct the reserved air from actual emitted boxes, not profile labels alone. */
export function legacyRoofVoidBoxes(masses: readonly SkyriverMass[], profiles: readonly SkyriverTowerProfileRow[]): readonly ReservedAirBox[] {
  const boxes: ReservedAirBox[] = [];
  const mass = (index: number) => { const found = masses[index]; if (!found) throw new Error('R36_D2_VOID_MASS'); return found; };
  for (const row of profiles) {
    if (row.eligibility.kind !== 'eligible' || !('stages' in row)) continue;
    if (row.family === 'supported-spine') {
      if (row.supportSpineIndex === null || !row.stages[0]) throw new Error('R36_D2_VOID_SPINE');
      const spine = mass(row.supportSpineIndex);
      for (const index of row.stages[0].massIndices) {
        const wing = mass(index), roof = wing.y0 + wing.height;
        if (wing.yawWingPart && wing.yawWingPart.part !== 'roof') continue;
        if (roof >= 600) continue;
        const owner = wing.materialOwner ?? wing.building ?? buildingSeedOf(wing.x, wing.z);
        const cells = addedVolumeCells({ ...artVolumeBox(wing, owner), y0: roof, height: 8 }, [{ ...artVolumeBox(spine, owner), y0: roof, height: 8 }]);
        for (const cell of cells) boxes.push({ ...addedCellRoofBox(cell), cell });
      }
    }
    if (row.crown.kind === 'split') {
      const a = mass(row.crown.massIndices[0]), b = mass(row.crown.massIndices[1]);
      const aa = sourceBoxSection(a), bb = sourceBoxSection(b), axisX = row.crown.axis === 'x';
      const x0 = axisX ? Math.min(aa.x1, bb.x1) : Math.max(aa.x0, bb.x0);
      const x1 = axisX ? Math.max(aa.x0, bb.x0) : Math.min(aa.x1, bb.x1);
      const z0 = axisX ? Math.max(aa.z0, bb.z0) : Math.min(aa.z1, bb.z1);
      const z1 = axisX ? Math.min(aa.z1, bb.z1) : Math.max(aa.z0, bb.z0);
      const y0 = Math.max(a.y0, b.y0), y1 = Math.min(a.y0 + a.height, b.y0 + b.height);
      if (Math.min(x1 - x0, z1 - z0, y1 - y0) <= 0) throw new Error('R36_D2_VOID_NOTCH');
      boxes.push(independentMassRoofBox({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, width: x1 - x0, depth: z1 - z0, y0, height: y1 - y0, tint: a.tint, anchorV: a.anchorV, yawRad: a.yawRad, yawAnchor: a.yawAnchor }));
    }
  }
  return boxes;
}

export interface LegacyRoofCandidate {
  readonly source: LegacyTrimSource;
  readonly newGeometry: LegacyTrimGeometry;
  readonly box: RoofBox;
  readonly hostMassIndex: number;
  readonly horizontalScale: number;
}
export interface LegacyRoofContext {
  readonly masses: readonly SkyriverMass[];
  readonly massHits: ReturnType<typeof roofConflictQuery>;
  readonly heroHits: ReturnType<typeof roofConflictQuery>;
  readonly voidHits: ReturnType<typeof roofConflictQuery>;
  readonly prefixHits: ReturnType<typeof roofConflictQuery>;
}

/** Check the actual final placement. No declared support result is used. */
export function legacyRoofCandidateFailures(candidate: LegacyRoofCandidate, context: LegacyRoofContext): readonly string[] {
  const { source, newGeometry: placed, box, hostMassIndex, horizontalScale } = candidate, errors: string[] = [];
  const host = context.masses[hostMassIndex];
  if (!host) return ['host-missing'];
  if ((host.materialOwner ?? host.building ?? buildingSeedOf(host.x, host.z)) !== source.canonicalOwner || (host.anchorV ?? host.z) !== source.owner.anchorV) errors.push('host-identity');
  if (placed.sy !== source.sy) errors.push('height-changed');
  if (!(horizontalScale > 0 && horizontalScale <= 1)) errors.push('scale-range');
  for (const key of ['sx', 'sz'] as const) {
    const expected = Math.fround(source[key] * horizontalScale), tolerance = 2 * Math.max(roofFloatUlp(expected), roofFloatUlp(placed[key]));
    if (!(placed[key] > 0 && placed[key] <= source[key]) || Math.abs(placed[key] - expected) > tolerance) errors.push(`scale-${key}`);
  }
  errors.push(...roofSupportFailures(box, independentMassRoofBox(host), 0));
  if (context.massHits(box, hostMassIndex).length > 0) errors.push('mass-collision');
  if (context.heroHits(box).length > 0) errors.push('hero-collision');
  if (context.voidHits(box).length > 0) errors.push('reserved-air-collision');
  if (context.prefixHits(box, source.sourceIndex).length > 0) errors.push('prefix-collision');
  return errors;
}
