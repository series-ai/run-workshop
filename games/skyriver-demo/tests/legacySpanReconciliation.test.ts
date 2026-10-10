import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
// Only atlas texture constructors are replaced. Geometry and upload stay real.
vi.mock('../src/render/signAtlas', async original => ({ ...await original<typeof import('../src/render/signAtlas')>(), createSignAtlas: () => ({ texture: new THREE.Texture(), vertical: Array.from({ length: 32 }, () => [0, 0, 1, 1] as const), horizontal: Array.from({ length: 16 }, () => [0, 0, 1, 1] as const), dispose() {} }) }));
vi.mock('../src/render/interiorAtlas', async original => ({ ...await original<typeof import('../src/render/interiorAtlas')>(), createInteriorAtlas: () => ({ texture: new THREE.Texture(), dispose() {} }) }));
vi.mock('../src/render/impostorAtlas', async original => ({ ...await original<typeof import('../src/render/impostorAtlas')>(), createImpostorAtlas: () => ({ texture: new THREE.Texture(), dispose() {} }) }));
import { SkyriverDistrictColourSwitch } from '../src/render/districts';
import { skyriverQualityFor, SkyriverQualityTier } from '../src/render/scene';
import { SkyriverCity, warpRigid, buildingSeedOf, deriveCityMasses, deriveCityTrims, deriveHeroBlades, deriveLegacyTrimReconciliation, deriveRoofDetails, deriveTowerProfiles, skyriverTrimBlocksHero, SKYRIVER_TRIM_GANTRY, SKYRIVER_TRIM_SKYBRIDGE, type SkyriverCityTrims } from '../src/render/city';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import before from './fixtures/r36-legacy-span-world-before.json';
import { retainedMassContact } from './support/retainedMassContact';
import { yawSpanLedgeFailures, approvedYawHostEnvelope } from './support/towerCrownCarve';
import { independentMassRoofBox } from './support/towerProfileGeometry';
import { assertLegacyTrimOneToOne, type LegacyTrimInventoryEvidence, type LegacyTrimSource } from './support/legacyTrimInventory';
import { legacyRoofVoidBoxes } from './support/legacyRoofGeometry';
import { independentSpanPlacement, independentTrimRoofBox, spanExposedLength, legacySpanClaimFailures, spanContactAt, spanFacts, spanMassOwner, spanOwner, type SpanBaseline, type SpanClaim, type SpanFacts } from './support/legacySpanGeometry';
import { roofBoxTolerance, type RoofBox } from './support/rooftopDetailsGeometry';

const SEEDS = [424242, 0, 2147483647, 4294967295, 20240917] as const;
const DATA = new Map(SEEDS.map(seed => {
  const layout = presentCityLayout(deriveCityLayout(seed)), trims = deriveCityTrims(layout);
  const evidence: LegacyTrimInventoryEvidence & { readonly spanRowsDeferred: number; readonly roofRowsDeferred: number } = deriveLegacyTrimReconciliation(layout);
  const original: SkyriverCityTrims = { ...trims, count: evidence.sourceCount,
    ...Object.fromEntries((['cx', 'cy', 'cz', 'sx', 'sy', 'sz', 'seedValue'] as const).map(key => [key, new Float32Array(evidence.sourceInventory.map(row => row[key]))])),
    kind: new Uint8Array(evidence.sourceInventory.map(row => row.kind)), owner: evidence.sourceInventory.map(row => row.owner), spanTo: evidence.sourceInventory.map(row => row.spanTo) };
  const masses = deriveCityMasses(layout), heroes = deriveHeroBlades(layout), ordinary = new Map(layout.towers.map(t => [buildingSeedOf(t.x, t.z), t.z]));
  const baseOwners = new Set(masses.filter(m => m.baseRecord).map(m => JSON.stringify([m.x, m.z, m.width, m.depth, m.anchorV ?? m.z, m.materialOwner])));
  const inScope = (source: LegacyTrimSource) => {
    const to = source.spanTo;
    return to !== null && [SKYRIVER_TRIM_GANTRY, SKYRIVER_TRIM_SKYBRIDGE].includes(source.kind) && !skyriverTrimBlocksHero(original, source.sourceIndex, heroes) &&
      !baseOwners.has(JSON.stringify([source.owner.x, source.owner.z, source.owner.width, source.owner.depth, source.owner.anchorV, source.owner.materialOwner])) &&
      (ordinary.get(source.canonicalOwner) === source.owner.anchorV || ordinary.get(spanOwner(to)) === to.anchorV);
  };
  const oracle = before.rows.find(row => row.seed === seed);
  if (!oracle) throw new Error('R36_D3_BASELINE_SEED');
  const baselines = new Map<number, SpanBaseline>(oracle.rows.map(row => {
    if (row.endpoints.length !== 2) throw new Error('R36_D3_BASELINE_ENDPOINT_TUPLE');
    return [row.index, { ...row, endpoints: [row.endpoints[0]!, row.endpoints[1]!] }];
  }));
  const roofs = evidence.dispositions.filter(row => row.kind === 'roof-rehosted').map(row => independentTrimRoofBox(trims, row.finalIndex));
  return [seed, { seed, layout, trims, original, masses, heroes, evidence, inScope, baselines, roofs, voids: legacyRoofVoidBoxes(masses, deriveTowerProfiles(layout)) }];
}));

function actualObstacles(seed: typeof SEEDS[number]): { readonly heroes: readonly RoofBox[]; readonly prefix: readonly (RoofBox | null)[] } {
  const data = DATA.get(seed)!;
  const city = new SkyriverCity({ layout: data.layout, quality: skyriverQualityFor(SkyriverQualityTier.High), colourSwitch: new SkyriverDistrictColourSwitch(true) });
  try {
    const mesh = city.group.getObjectByName('skyriver.city.signs');
    if (!(mesh instanceof THREE.Mesh)) throw new Error('R36_D3_ACTUAL_SIGN_BATCH');
    const centres = mesh.geometry.getAttribute('aCentre'), normals = mesh.geometry.getAttribute('aNormal'), sizes = mesh.geometry.getAttribute('aSize');
    if (!centres || !normals || !sizes) throw new Error('R36_D3_ACTUAL_HERO_ATTRIBUTES');
    const heroes = Array.from({ length: city.sourceCounts().heroSigns }, (_, index) => {
      const nx = normals.getX(index), nz = normals.getY(index), length = Math.hypot(nx, nz);
      if (!(length > 0)) throw new Error('R36_D3_HERO_NORMAL');
      return { x: centres.getX(index), y: centres.getY(index), z: centres.getZ(index), hx: sizes.getX(index) / 2 + 14, hy: sizes.getY(index) / 2 + 18, hz: 14, c: nz / length, s: nx / length };
    });
    return { heroes, prefix: data.evidence.sourceInventory.map(row => skyriverTrimBlocksHero(data.trims, row.sourceIndex, data.heroes) ? null : independentTrimRoofBox(data.trims, row.sourceIndex)) };
  } finally { city.dispose(); }
}

function write(seed: number, name: string, value: unknown): void {
  const out = process.env.R36_D3_OUT;
  if (out) { mkdirSync(out, { recursive: true }); writeFileSync(join(out, `${seed}-${name}.json`), JSON.stringify(value, null, 2) + '\n'); }
}
function actualClaim(seed: typeof SEEDS[number], source: LegacyTrimSource, facts: SpanFacts): SpanClaim | null {
  const data = DATA.get(seed)!, hosts = ([0, 1] as const).map(end => {
    const owner = facts.endpointOwners[end];
    const index = data.masses.findIndex(m => spanMassOwner(m) === spanOwner(owner) && (m.anchorV ?? m.z) === owner.anchorV && spanContactAt(facts, end, independentMassRoofBox(m)).touches);
    return index < 0 ? null : { massIndex: index, canonicalOwner: spanOwner(owner), anchorV: owner.anchorV ?? owner.z };
  });
  if (!hosts[0] || !hosts[1]) return null;
  const oldWorld = data.baselines.get(source.sourceIndex); if (!oldWorld) throw new Error('R36_D3_ORIGINAL_INDEX');
  return { source, geometry: data.evidence.dispositions[source.sourceIndex]!.newGeometry, facts, hosts: [hosts[0], hosts[1]], oldWorld, newWorld: facts,
    endpointContacts: [spanContactAt(facts, 0, independentMassRoofBox(data.masses[hosts[0].massIndex]!)).measurement, spanContactAt(facts, 1, independentMassRoofBox(data.masses[hosts[1].massIndex]!)).measurement] };
}

describe('R36 D3 exact span inventory and actual world paths', () => {
  it.each(SEEDS)('examines every ordinary span and separates inherited invalid rows at seed %i', seed => {
    const data = DATA.get(seed)!, { evidence, trims, original, baselines } = data;
    assertLegacyTrimOneToOne(evidence, trims, deriveRoofDetails(data.layout).oldTrimCount, data.masses);
    const errors: unknown[] = []; let checked = 0, inherited = 0, moved = 0;
    for (const source of evidence.sourceInventory) {
      const record = evidence.dispositions[source.sourceIndex]!;
      if (!data.inScope(source)) { expect(['span-rehosted', 'inherited-span-unsupported']).not.toContain(record.kind); continue; }
      checked++;
      const baseline = baselines.get(source.sourceIndex); if (!baseline || !baseline.drawn) throw new Error('R36_D3_C6_SOURCE_INDEX');
      if (!baseline.bothContacts) {
        inherited++;
        if (record.kind !== 'inherited-span-unsupported') errors.push({ index: source.sourceIndex, reason: 'inherited-kind', kind: record.kind });
        for (const key of ['cx', 'cy', 'cz', 'sx', 'sy', 'sz'] as const) expect(trims[key][source.sourceIndex]).toBe(original[key][source.sourceIndex]);
        continue;
      }
      const facts = spanFacts(trims, source.sourceIndex, data.masses), claim = actualClaim(seed, source, facts);
      if (!claim) errors.push({ index: source.sourceIndex, reason: 'actual-endpoint-loss', endpoints: facts.endpoints });
      if (record.kind === 'span-rehosted') moved++;
      const beforeFacts = spanFacts(original, source.sourceIndex, data.masses);
      const oldPathValid = !beforeFacts.foreignOwners.some(owner => !baseline.foreignOwners.includes(owner)) &&
        (baseline.exposedLengthM <= roofBoxTolerance(beforeFacts.box) || beforeFacts.exposedLengthM > roofBoxTolerance(beforeFacts.box));
      if (actualClaim(seed, source, beforeFacts) && oldPathValid) {
        if (record.kind === 'span-rehosted') write(seed, 'source-preservation-witness', { source, record, beforeFacts, hosts: actualClaim(seed, source, beforeFacts)!.hosts.map(host => ({ ...host, mass: data.masses[host.massIndex] })) });
        expect(['unchanged', 'span-rehosted'], `supported-source:${source.sourceIndex}`).toContain(record.kind);
        expect(trims.kind[source.sourceIndex]).toBe(source.kind);
        expect(trims.seedValue[source.sourceIndex]).toBe(source.seedValue);
        expect(trims.owner[source.sourceIndex]).toEqual(source.owner);
        expect(trims.spanTo[source.sourceIndex]).toEqual(source.spanTo);
        for (const key of ['cx', 'cy', 'cz', 'sx', 'sy', 'sz'] as const) expect(trims[key][source.sourceIndex]).toBe(original[key][source.sourceIndex]);
      }
    }
    const result = { seed, checked, inherited, moved, deferred: evidence.spanRowsDeferred, failures: errors.length, violations: errors, examples: errors.slice(0, 8) };
    write(seed, 'span-source', result);
    expect(evidence.roofRowsDeferred).toBe(0); expect(errors, JSON.stringify(result)).toEqual([]); expect(evidence.spanRowsDeferred).toBe(0); expect(moved).toBeGreaterThan(0);
  });

  it.each(SEEDS)('uses real ordered hosts and preserves exposed paths without new owners or roof collisions at seed %i', seed => {
    const data = DATA.get(seed)!, obstacles = actualObstacles(seed), errors: unknown[] = []; let checked = 0, moved = 0;
    for (const source of data.evidence.sourceInventory.filter(data.inScope)) {
      const baseline = data.baselines.get(source.sourceIndex)!;
      if (!baseline.bothContacts) continue;
      checked++;
      const record = data.evidence.dispositions[source.sourceIndex]!, facts = spanFacts(data.trims, source.sourceIndex, data.masses), tolerance = roofBoxTolerance(facts.box);
      if (facts.foreignOwners.some(owner => !baseline.foreignOwners.includes(owner))) errors.push({ index: source.sourceIndex, reason: 'new-foreign-owner', before: baseline.foreignOwners, after: facts.foreignOwners });
      if (baseline.exposedLengthM > tolerance && facts.exposedLengthM <= tolerance) errors.push({ index: source.sourceIndex, reason: 'buried-path', before: baseline.exposedLengthM, after: facts.exposedLengthM });
      if (record.kind !== 'span-rehosted') continue;
      moved++;
      const claim: SpanClaim = { source, geometry: record.newGeometry, facts, hosts: record.hosts, oldWorld: record.oldWorld, newWorld: record.newWorld, endpointContacts: record.endpointContacts };
      // D1 and D2 retain the actual upload and source-index packing checks.
      const failures = legacySpanClaimFailures(claim, data.masses, baseline, data.roofs, obstacles.heroes, data.voids, obstacles.prefix);
      if (failures.length) errors.push({ index: source.sourceIndex, reasons: failures, hosts: record.hosts, declared: record.newWorld, actual: facts });
      const oldWidth = source.sz >= source.sx ? source.sx : source.sz;
      if (facts.crossWidthM !== oldWidth) {
        const widthWasEnough = ([0, 1] as const).every(end => {
          const host = data.masses[record.hosts[end].massIndex];
          return host !== undefined && spanContactAt({ ...facts, crossWidthM: oldWidth }, end, independentMassRoofBox(host)).touches;
        });
        expect(widthWasEnough, `unneeded-width:${source.sourceIndex}`).toBe(false);
      }
    }
    const result = { seed, checked, moved, failures: errors.length, violations: errors, examples: errors.slice(0, 12) }; write(seed, 'span-world', result);
    expect(errors, JSON.stringify(result)).toEqual([]); expect(moved).toBeGreaterThan(0);
  });

  it('preserves source402 and its actual endpoint contacts after yaw', () => {
    const d = DATA.get(424242)!, source = d.evidence.sourceInventory[402]!;
    expect([source.cx, source.cy, source.cz, source.sx, source.sy, source.sz]).toEqual([1562.567138671875, 1325.153076171875, -810.4183959960938, 5.300000190734863, 4, 161.3485107421875]);
    expect([source.owner.x, source.owner.z, source.owner.width, source.owner.depth]).toEqual([1590, -960, 153, 137.814750833211]);
    expect(source.spanTo).not.toBeNull();
    expect([source.spanTo!.x, source.spanTo!.z, source.spanTo!.width, source.spanTo!.depth]).toEqual([1590, -640, 227, 179.48822944444504]);
    const record = d.evidence.dispositions[402]!, facts = spanFacts(d.trims, 402, d.masses), actual = actualClaim(424242, source, facts);
    expect(actual).not.toBeNull(); if (!actual) throw new Error('YAW_SOURCE402_ENDPOINT');
    const claim: SpanClaim = record.kind === 'span-rehosted' ? { source, geometry: record.newGeometry, facts, hosts: record.hosts, oldWorld: record.oldWorld, newWorld: record.newWorld, endpointContacts: record.endpointContacts } : actual;
    const obstacles = actualObstacles(424242);
    expect(legacySpanClaimFailures(claim, d.masses, d.baselines.get(402)!, d.roofs, obstacles.heroes, d.voids, obstacles.prefix)).toEqual([]);
    for (const end of [0, 1] as const) {
      const host = d.masses[claim.hosts[end].massIndex]!;
      expect(spanContactAt(facts, end, independentMassRoofBox(host)).touches).toBe(true);
      if (host.supportRole === 'yaw-span-ledge') {
        expect(host.supportSourceTrimIndex).toBe(402); expect(host.supportSpanEndpoint).toBe(end);
        const body = d.masses[host.supportHostMassIndex!]!;
        expect(retainedMassContact(independentMassRoofBox(host), independentMassRoofBox(body))).toBe('volume');
      }
    }
  });

  it.each(SEEDS)('proves every cropped ledge belongs to a real span endpoint at seed %i', seed => {
    const d = DATA.get(seed)!, profiles = deriveTowerProfiles(d.layout);
    for (const [index, ledge] of d.masses.entries()) {
      if (ledge.supportRole !== 'yaw-span-ledge') continue;
      const sourceIndex = ledge.supportSourceTrimIndex, end = ledge.supportSpanEndpoint;
      expect(sourceIndex).toBeDefined(); expect([0, 1]).toContain(end);
      if (sourceIndex === undefined || end === undefined) throw new Error('YAW_LEDGE_SOURCE_ENDPOINT');
      const record = d.evidence.dispositions[sourceIndex]!;
      expect(record.kind).toBe('span-rehosted'); if (record.kind !== 'span-rehosted') throw new Error('YAW_LEDGE_SOURCE_REPAIR');
      expect(record.hosts[end].massIndex).toBe(index);
      const body = d.masses[ledge.supportHostMassIndex!]!;
      expect(yawSpanLedgeFailures(ledge, body, approvedYawHostEnvelope(body, ledge.supportHostMassIndex!, profiles, seed, d.masses)), `ledge${index}`).toEqual([]);
      expect(spanContactAt(spanFacts(d.trims, sourceIndex, d.masses), end, independentMassRoofBox(ledge)).touches).toBe(true);
    }
  });

  it('turns each source span endpoint in its own yaw and pivot frame', () => {
    const owner = { x: 0, z: 0, width: 10, depth: 10, anchorV: 0, yawRad: Math.PI / 2 };
    const to = { ...owner, z: 20, yawRad: -Math.PI / 2, yawAnchor: { x: 0, z: 20 } };
    const trims: SkyriverCityTrims = { seed: 0, count: 1, cx: new Float32Array([0]), cy: new Float32Array([5]), cz: new Float32Array([10]),
      sx: new Float32Array([2]), sy: new Float32Array([2]), sz: new Float32Array([10]), kind: new Uint8Array([SKYRIVER_TRIM_GANTRY]),
      seedValue: new Float32Array([0]), owner: [owner], spanTo: [to] };
    const placed = independentSpanPlacement(trims, 0);
    const low = warpRigid(5, 0, 0, { x: 0, z: 0, heading: 0 }), high = warpRigid(5, 20, 0, { x: 0, z: 0, heading: 0 });
    expect(placed.endpointOwners).toEqual([owner, to]);
    expect(placed.endpoints[0].x).toBeCloseTo(low.x, 10); expect(placed.endpoints[0].z).toBeCloseTo(low.z, 10);
    expect(placed.endpoints[1].x).toBeCloseTo(high.x, 10); expect(placed.endpoints[1].z).toBeCloseTo(high.z, 10);
    expect(placed.worldLengthM).toBeCloseTo(20, 10);
  });

  it('subtracts true rotated span coverage and excludes edge contact', () => {
    const ends = [{ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }] as const;
    const box = { x: 10, y: 0, z: 0, hx: 2, hy: 1, hz: 2, c: Math.SQRT1_2, s: Math.SQRT1_2 };
    expect(spanExposedLength(ends, [box])).toBeCloseTo(20 - 4 * Math.SQRT2, 10);
    expect(spanExposedLength(ends, [{ ...box, y: 1 }])).toBe(20);
  });

  it.each(['host', 'anchor', 'endpoint', 'new-owner', 'buried-path', 'missing-row', 'roof-collision', 'prefix-collision'] as const)('rejects an actual %s fault with the same physical oracle', fault => {
    const data = DATA.get(424242)!;
    let good: SpanClaim | null = null;
    for (const source of data.evidence.sourceInventory.filter(data.inScope)) {
      const baseline = data.baselines.get(source.sourceIndex)!; if (!baseline.bothContacts || baseline.exposedLengthM <= roofBoxTolerance(spanFacts(data.trims, source.sourceIndex, data.masses).box)) continue;
      const claim = actualClaim(424242, source, spanFacts(data.trims, source.sourceIndex, data.masses));
      if (claim && legacySpanClaimFailures(claim, data.masses, baseline, [], [], []).length === 0) { good = claim; break; }
    }
    if (!good) throw new Error('R36_D3_NO_ACTUAL_CONTROL_SPAN');
    const baseline = data.baselines.get(good.source.sourceIndex)!;
    expect(legacySpanClaimFailures(good, data.masses, baseline, [], [], [])).toEqual([]);
    if (fault === 'missing-row') {
      const bad = { ...data.evidence, dispositions: data.evidence.dispositions.filter(row => row.sourceIndex !== good.source.sourceIndex) };
      expect(() => assertLegacyTrimOneToOne(bad, data.trims, deriveRoofDetails(data.layout).oldTrimCount, data.masses)).toThrow('disposition-count');
    } else if (fault === 'host' || fault === 'anchor') {
      const first = good.hosts[0];
      const host = fault === 'anchor' ? { ...first, anchorV: first.anchorV + 1 } : { ...first, massIndex: data.masses.findIndex(m => spanMassOwner(m) !== first.canonicalOwner) };
      expect(legacySpanClaimFailures({ ...good, hosts: [host, good.hosts[1]] }, data.masses, baseline, [], [], [])).toContain('host0-identity');
    } else if (fault === 'endpoint') {
      const facts = { ...good.facts, endpoints: [{ ...good.facts.endpoints[0], y: good.facts.endpoints[0].y + 10000 }, good.facts.endpoints[1]] as const };
      expect(legacySpanClaimFailures({ ...good, facts }, data.masses, baseline, [], [], [])).toContain('endpoint0-contact');
    } else if (fault === 'prefix-collision') {
      const other = data.evidence.sourceInventory.find(row => row.sourceIndex !== good.source.sourceIndex && data.evidence.dispositions[row.sourceIndex]!.kind === 'unchanged' && !skyriverTrimBlocksHero(data.trims, row.sourceIndex, data.heroes));
      if (!other) throw new Error('R36_D3_UNCHANGED_PREFIX_CONTROL');
      const prefix = data.evidence.sourceInventory.map(row => row.sourceIndex === other.sourceIndex ? good.facts.box : null);
      expect(legacySpanClaimFailures(good, data.masses, baseline, [], [], [], prefix)).toContain('prefix-collision');
    } else if (fault === 'roof-collision') {
      // Use one actual changed D2 roof. Translate the span to that physical box.
      const roof = data.roofs[0]; if (!roof) throw new Error('R36_D3_D2_ROOF_CONTROL');
      expect(legacySpanClaimFailures({ ...good, facts: { ...good.facts, box: { ...good.facts.box, x: roof.x, y: roof.y, z: roof.z } } }, data.masses, baseline, [roof], [], [])).toContain('roof-collision');
    } else {
      const sourceHost = data.masses[good.hosts[0].massIndex]!;
      const invading = { ...sourceHost, x: good.geometry.cx, z: good.geometry.cz, y0: good.geometry.cy - good.geometry.sy, width: good.geometry.sx * 2, depth: good.geometry.sz * 2, height: good.geometry.sy * 2,
        materialOwner: fault === 'new-owner' ? -1 : sourceHost.materialOwner, building: fault === 'new-owner' ? -1 : sourceHost.building, anchorV: good.source.owner.anchorV };
      // Set the injection extent from both actual world endpoints.
      const centre = independentMassRoofBox(invading);
      const reach = Math.max(...good.facts.endpoints.map(end => Math.hypot(end.x - centre.x, end.z - centre.z))) + 1;
      const cover = { ...invading, width: 2 * reach, depth: 2 * reach };
      const alteredMasses = [...data.masses, cover], facts = spanFacts(data.trims, good.source.sourceIndex, alteredMasses);
      const errors = legacySpanClaimFailures({ ...good, facts, newWorld: facts }, alteredMasses, baseline, [], [], []);
      expect(errors).toContain(fault === 'new-owner' ? 'new-foreign-owner' : 'buried-path');
    }
  });
});
