import type { SkyriverMass } from '../../src/render/city';
import { artVolumeBox, addedVolumeCells, addedVolumeConflicts, type ArtVolumeBox } from './towerAddedVolume';
import { independentMassRoofBox } from './towerProfileGeometry';
import { roofBoxTolerance } from './rooftopDetailsGeometry';
import { supportConflictQuery } from './retainedStructuralSupport';

export interface IndependentWingSection { readonly mass: SkyriverMass; readonly part: 'below' | 'band' | 'roof' | 'whole' }

/** Use the saved solid and exact other solids to find the blocking height band. */
export function independentWingSections(original: SkyriverMass, yawRad: number, oldUnion: readonly ArtVolumeBox[], masses: readonly SkyriverMass[], excluded: ReadonlySet<number>, query: ReturnType<typeof supportConflictQuery>, boxes: ReturnType<typeof independentMassRoofBox>[]) {
  const full = { ...original, yawRad }, owner = oldUnion[0]!.owner;
  const conflicts = (mass: SkyriverMass) => addedVolumeConflicts(addedVolumeCells(artVolumeBox(mass, owner), oldUnion), query, excluded, boxes);
  const blockers = [...new Set(conflicts(full).map(hit => hit.blockerIndex))];
  if (blockers.length === 0) return { sections: [{ mass: full, part: 'whole' } satisfies IndependentWingSection], blockers, cutLow: original.y0, cutHigh: original.y0, scale: 1, fitScaleTolerance: 0, visibleRetention: 1 };
  const top = original.y0 + original.height;
  const cutLow = Math.max(original.y0, Math.min(...blockers.map(index => masses[index]!.y0)));
  const cutHigh = Math.min(top, Math.max(...blockers.map(index => masses[index]!.y0 + masses[index]!.height)));
  const bandAt = (scale: number): SkyriverMass => ({ ...full, y0: cutLow, height: cutHigh - cutLow, width: original.width * scale, depth: original.depth * scale });
  let low = 0, high = 1;
  for (let step = 0; step < 40; step++) { const middle = (low + high) / 2; if (conflicts(bandAt(middle)).length === 0) low = middle; else high = middle; }
  const sections: IndependentWingSection[] = [];
  if (cutHigh < top) sections.push({ mass: { ...full, y0: cutHigh, height: top - cutHigh }, part: 'roof' });
  sections.push({ mass: bandAt(low), part: 'band' });
  if (cutLow > original.y0) sections.push({ mass: { ...full, height: cutLow - original.y0 }, part: 'below' });
  const visibleHeight = (mass: SkyriverMass) => Math.max(0, mass.y0 + mass.height - Math.max(0, mass.y0));
  const visibleVolume = sections.reduce((volume, section) => volume + section.mass.width * section.mass.depth * visibleHeight(section.mass), 0);
  const epsilon = Math.max(roofBoxTolerance(independentMassRoofBox(full)), ...blockers.map(index => roofBoxTolerance(boxes[index]!)));
  // Two boundary classifications can differ by 2 epsilon metres.
  // Convert that distance through the smallest turned corner projection to scale.
  const fitScaleTolerance = 4 * epsilon / (Math.min(original.width, original.depth) * Math.max(Math.abs(Math.sin(yawRad)), 1e-6));
  return { sections, blockers, cutLow, cutHigh, scale: low, fitScaleTolerance, visibleRetention: visibleVolume / (original.width * original.depth * visibleHeight(original)) };
}

/** Check source coverage and shape. A missing section cannot retain the saved body. */
export function wingSectionContractFailures(actual: readonly SkyriverMass[], original: SkyriverMass, expected: ReturnType<typeof independentWingSections>): readonly string[] {
  const errors: string[] = [], ordered = [...actual].sort((a, b) => a.y0 - b.y0);
  if (actual.length !== expected.sections.length) errors.push('section-count');
  const last = ordered.at(-1);
  if (ordered[0]?.y0 !== original.y0 || !last || last.y0 + last.height !== original.y0 + original.height) errors.push('source-height');
  if (!last || last.width !== original.width || last.depth !== original.depth) errors.push('roof-size');
  for (let i = 1; i < ordered.length; i++) if (Math.abs(ordered[i - 1]!.y0 + ordered[i - 1]!.height - ordered[i]!.y0) > 8 * Number.EPSILON * Math.max(1, Math.abs(original.y0), Math.abs(original.height))) errors.push('section-gap');
  for (const section of expected.sections) {
    const matches = actual.filter(mass => (mass.yawWingPart?.part ?? 'whole') === section.part);
    if (matches.length !== 1) { errors.push(`${section.part}:identity`); continue; }
    const mass = matches[0]!, source = section.mass;
    for (const key of ['x', 'z', 'y0', 'height', 'materialOwner', 'building', 'anchorV', 'tint', 'yawRad'] as const) if (mass[key] !== source[key]) errors.push(`${section.part}:${key}`);
    if (mass.yawAnchor !== undefined) errors.push(`${section.part}:pivot`);
    const scaleTolerance = section.part === 'band' ? Math.max(expected.fitScaleTolerance, 1 / 2 ** 30) : 1 / 2 ** 30;
    if (Math.abs(mass.width - source.width) >= original.width * scaleTolerance || Math.abs(mass.depth - source.depth) >= original.depth * scaleTolerance) errors.push(`${section.part}:size`);
    if (section.part === 'band' && Math.abs(mass.width / original.width - mass.depth / original.depth) > 1e-12) errors.push('band:uniform-scale');
  }
  return errors;
}
