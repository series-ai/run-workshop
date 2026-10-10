import { createHash } from 'node:crypto';
import { buildingSeedOf, SKYRIVER_TRIM_ANTENNA, SKYRIVER_TRIM_ROOF_PLANT, SKYRIVER_TRIM_GANTRY, SKYRIVER_TRIM_SKYBRIDGE, type SkyriverCityTrims, type SkyriverMass, type SkyriverTrimOwner } from '../../src/render/city';
import before from '../fixtures/r36-legacy-prefix-before.json';
import type { SpanHost, SpanContact, SpanWorldPath } from './legacySpanGeometry';

const ARRAY_FIELDS = ['cx', 'cy', 'cz', 'sx', 'sy', 'sz', 'kind', 'seedValue'] as const;
const GEOMETRY_FIELDS = ['cx', 'cy', 'cz', 'sx', 'sy', 'sz'] as const;
const OWNER_FIELDS = ['x', 'z', 'width', 'depth', 'anchorV', 'materialOwner'] as const;

export interface LegacyTrimGeometry {
  readonly cx: number; readonly cy: number; readonly cz: number;
  readonly sx: number; readonly sy: number; readonly sz: number;
}

export interface LegacyTrimSource extends LegacyTrimGeometry {
  readonly sourceIndex: number;
  readonly kind: number;
  readonly seedValue: number;
  readonly seedBits: number;
  readonly canonicalOwner: number;
  readonly owner: SkyriverTrimOwner;
  readonly spanTo: SkyriverTrimOwner | null;
}

interface RetainedTrimDisposition {
  readonly sourceIndex: number;
  readonly finalIndex: number;
  readonly heroFiltered: boolean;
  readonly blockingHeroIds: readonly string[];
  readonly oldGeometry: LegacyTrimGeometry;
  readonly newGeometry: LegacyTrimGeometry;
}

export type LegacyTrimDisposition =
  | (RetainedTrimDisposition & { readonly kind: 'unchanged' | 'inherited-roof-unsupported' | 'inherited-span-unsupported' })
  | (RetainedTrimDisposition & { readonly kind: 'side-rehosted'; readonly hostMassIndex: number; readonly faceId: string })
  | (RetainedTrimDisposition & { readonly kind: 'roof-rehosted'; readonly hostMassIndex: number; readonly horizontalScale: number })
  | (RetainedTrimDisposition & { readonly kind: 'span-rehosted'; readonly hosts: readonly [SpanHost, SpanHost]; readonly oldWorld: SpanWorldPath; readonly newWorld: SpanWorldPath; readonly endpointContacts: readonly [SpanContact, SpanContact] });

/** This input has no dependency on the producer's reconciliation API. */
export interface LegacyTrimInventoryEvidence {
  readonly seed: number;
  readonly sourceCount: number;
  readonly finalCount: number;
  readonly sourceInventory: readonly LegacyTrimSource[];
  readonly dispositions: readonly LegacyTrimDisposition[];
  readonly unchangedCount: number;
  readonly rehostedCount: number;
}

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`R36_LEGACY_INVENTORY:${message}`);
}
function hash(value: string | ArrayBufferView): string {
  const input = typeof value === 'string' ? value : Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  return createHash('sha256').update(input).digest('hex');
}
function ownerTuple(owner: SkyriverTrimOwner | null): readonly number[] | null {
  if (owner === null) return null;
  check(JSON.stringify(Object.keys(owner).sort()) === JSON.stringify([...OWNER_FIELDS].sort()), 'owner-field-set');
  return OWNER_FIELDS.map(key => {
    const value = owner[key];
    check(typeof value === 'number' && Number.isFinite(value), `owner-field:${key}`);
    return value;
  });
}
function seedBits(value: number): number {
  return new Uint32Array(new Float32Array([value]).buffer)[0]!;
}
function geometryEqual(a: LegacyTrimGeometry, b: LegacyTrimGeometry): boolean {
  return GEOMETRY_FIELDS.every(key => a[key] === b[key]);
}

/** Check all original bytes and full owner Numbers against the c6 factory. */
export function assertLegacyTrimSourceInventory(evidence: LegacyTrimInventoryEvidence): void {
  const oracle = before.rows.find(row => row.seed === evidence.seed);
  check(oracle !== undefined, `baseline-seed:${evidence.seed}`);
  check(evidence.sourceCount === oracle.sourceCount, 'source-count');
  check(evidence.sourceInventory.length === oracle.sourceCount, 'inventory-count');
  const identities: unknown[] = [], owners: unknown[] = [], spans: unknown[] = [];
  for (const [index, source] of evidence.sourceInventory.entries()) {
    check(source.sourceIndex === index, `source-order:${index}`);
    for (const key of ARRAY_FIELDS) {
      const value = source[key];
      check(Number.isFinite(value), `finite:${index}:${key}`);
      check(key === 'kind' ? Number.isInteger(value) && value >= 0 && value <= 255 : Math.fround(value) === value, `array-value:${index}:${key}`);
    }
    check(seedBits(source.seedValue) === source.seedBits, `seed-bits:${index}`);
    check(source.owner.materialOwner === source.canonicalOwner, `canonical-owner:${index}`);
    const owner = ownerTuple(source.owner), span = ownerTuple(source.spanTo);
    owners.push(owner); spans.push(span);
    identities.push([index, source.cx, source.cy, source.cz, source.sx, source.sy, source.sz, source.kind, source.seedBits, owner, span]);
  }
  for (const key of ARRAY_FIELDS) {
    const values = evidence.sourceInventory.map(source => source[key]);
    const array = key === 'kind' ? new Uint8Array(values) : new Float32Array(values);
    check(array.constructor.name === oracle.sourceArrayHashes[key].typedArray, `array-type:${key}`);
    check(hash(array) === oracle.sourceArrayHashes[key].sha256, `source-array:${key}`);
  }
  check(hash(JSON.stringify(owners)) === oracle.ownersTupleSha256, 'source-owners');
  check(hash(JSON.stringify(spans)) === oracle.spanToTupleSha256, 'source-span-targets');
  check(hash(JSON.stringify(identities)) === oracle.indexedSourceIdentitySha256, 'indexed-source-identity');
}

/** Check retained rows against the actual final arrays. Geometry fit is a separate oracle. */
export function assertLegacyTrimOneToOne(
  evidence: LegacyTrimInventoryEvidence, finalTrims: SkyriverCityTrims, actualPrefixCount: number, actualMasses: readonly SkyriverMass[],
): void {
  assertLegacyTrimSourceInventory(evidence);
  check(evidence.finalCount === evidence.sourceCount && actualPrefixCount === evidence.sourceCount, 'final-prefix-count');
  check(finalTrims.count >= actualPrefixCount, 'final-array-count');
  check(evidence.dispositions.length === evidence.sourceCount, 'disposition-count');
  let unchanged = 0, rehosted = 0;
  for (const [index, disposition] of evidence.dispositions.entries()) {
    const source = evidence.sourceInventory[index]!;
    check(disposition.sourceIndex === index && disposition.finalIndex === index, `one-to-one:${index}`);
    check(geometryEqual(disposition.oldGeometry, source), `old-geometry:${index}`);
    for (const key of GEOMETRY_FIELDS) check(disposition.newGeometry[key] === finalTrims[key][index], `final-geometry:${index}:${key}`);
    check(finalTrims.kind[index] === source.kind && finalTrims.seedValue[index] === source.seedValue, `final-identity:${index}`);
    let expectedOwner = source.owner;
    if (disposition.kind === 'side-rehosted' || disposition.kind === 'roof-rehosted') {
      const host = actualMasses[disposition.hostMassIndex];
      check(host !== undefined && !host.artBacking, `actual-final-host:${index}`);
      if ((host.yawRad ?? 0) !== 0) expectedOwner = {
        x: host.x, z: host.z, width: host.width, depth: host.depth,
        anchorV: host.anchorV ?? host.z,
        materialOwner: host.materialOwner ?? host.building ?? buildingSeedOf(host.x, host.z),
        yawRad: host.yawRad,
        ...(host.yawAnchor === undefined ? {} : { yawAnchor: { x: host.yawAnchor.x, z: host.yawAnchor.z } }),
      };
      check((host.materialOwner ?? host.building ?? buildingSeedOf(host.x, host.z)) === source.canonicalOwner && (host.anchorV ?? host.z) === source.owner.anchorV, `final-host-provenance:${index}`);
    }
    const finalOwner = finalTrims.owner[index]!;
    check(JSON.stringify(Object.keys(finalOwner).sort()) === JSON.stringify(Object.keys(expectedOwner).sort()) && Object.keys(expectedOwner).every(key => JSON.stringify(finalOwner[key as keyof SkyriverTrimOwner]) === JSON.stringify(expectedOwner[key as keyof SkyriverTrimOwner])), `final-owner:${index}`);
    check(JSON.stringify(finalTrims.spanTo[index]) === JSON.stringify(source.spanTo), `final-span-target:${index}`);
    check(disposition.blockingHeroIds.every(id => id.length > 0), `empty-hero-id:${index}`);
    check(disposition.heroFiltered === (disposition.blockingHeroIds.length > 0), `hero-cause:${index}`);
    if (disposition.kind === 'unchanged' || disposition.kind === 'inherited-roof-unsupported' || disposition.kind === 'inherited-span-unsupported') {
      unchanged++;
      check(geometryEqual(disposition.newGeometry, source), `unchanged-geometry:${index}`);
      if (disposition.kind === 'inherited-roof-unsupported') check([SKYRIVER_TRIM_ANTENNA, SKYRIVER_TRIM_ROOF_PLANT].includes(source.kind) && source.spanTo === null, `inherited-roof-source:${index}`);
          if (disposition.kind === 'inherited-span-unsupported') check(source.spanTo !== null && [SKYRIVER_TRIM_GANTRY, SKYRIVER_TRIM_SKYBRIDGE].includes(source.kind), `inherited-span-source:${index}`);
    } else if (disposition.kind === 'side-rehosted') {
      rehosted++;
      check([3, 4, 5].includes(source.kind) && source.spanTo === null, `side-source:${index}`);
      check(Number.isInteger(disposition.hostMassIndex) && disposition.hostMassIndex >= 0 && disposition.faceId.length > 0, `side-host:${index}`);
      check(!disposition.heroFiltered, `moved-hero-filter:${index}`);
    } else if (disposition.kind === 'roof-rehosted') {
      rehosted++;
      check([SKYRIVER_TRIM_ANTENNA, SKYRIVER_TRIM_ROOF_PLANT].includes(source.kind) && source.spanTo === null, `roof-source:${index}`);
      check(Number.isInteger(disposition.hostMassIndex) && disposition.hostMassIndex >= 0, `roof-host:${index}`);
      check(Number.isFinite(disposition.horizontalScale) && disposition.horizontalScale > 0 && disposition.horizontalScale <= 1, `roof-scale:${index}`);
      check(disposition.newGeometry.sy === source.sy, `roof-height:${index}`);
      check(!disposition.heroFiltered, `roof-hero-filter:${index}`);
    } else if (disposition.kind === 'span-rehosted') {
      rehosted++;
      check(source.spanTo !== null && [SKYRIVER_TRIM_GANTRY, SKYRIVER_TRIM_SKYBRIDGE].includes(source.kind), `span-source:${index}`);
      check(disposition.newGeometry.sy === source.sy, `span-height:${index}`);
      check(!disposition.heroFiltered, `span-hero-filter:${index}`);
      check(disposition.hosts.length === 2 && disposition.endpointContacts.length === 2, `span-host-tuple:${index}`);
      for (const host of disposition.hosts) {
        check(actualMasses[host.massIndex] !== undefined && !actualMasses[host.massIndex]!.artBacking, `span-actual-host:${index}`);
        check(Number.isInteger(host.massIndex) && host.massIndex >= 0 && Number.isFinite(host.canonicalOwner) && Number.isFinite(host.anchorV), `span-host:${index}`);
      }
    } else {
      throw new Error(`R36_LEGACY_INVENTORY:disposition-kind:${index}`);
    }
  }
  check(unchanged === evidence.unchangedCount && rehosted === evidence.rehostedCount, 'disposition-summary');
}
