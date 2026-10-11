import { createHash } from 'node:crypto';
import type { CityGraphPayload, CityGraphValue } from '../../src/render/citySnapshotCodec';
import type { SkyriverCitySnapshot } from '../../src/render/city';

type PathPart = string | number | { readonly mapValue: number };
export interface DomainFault {
  readonly label: string;
  readonly expectation: string;
  readonly path: readonly PathPart[] | ((snapshot: SkyriverCitySnapshot) => readonly PathPart[]);
  readonly replacement: null | boolean | number | string;
}

function indexOf<T>(values: readonly T[], predicate: (value: T) => boolean): number {
  const index = values.findIndex(predicate);
  if (index < 0) throw new Error('R40_REAL_DOMAIN_WITNESS_MISSING');
  return index;
}

export const CITY_DOMAIN_FAULTS: readonly DomainFault[] = [
  { label: 'mass-height-string', path: ['masses', 0, 'height'], replacement: 'bad', expectation: 'Mass height is a number.' },
  { label: 'tier-entry-null', path: ['tiers', { mapValue: 0 }], replacement: null, expectation: 'Each tier Map value is an array.' },
  { label: 'hero-entry-null', path: ['heroes', 0], replacement: null, expectation: 'Each hero is a record.' },
  { label: 'trim-kind-outside-enum', path: ['trims', 'kind', 0], replacement: 255, expectation: 'Trim kinds use the source enum 0 through 9.' },
  { label: 'sign-kind-outside-enum', path: ['signs', 'kind', 0], replacement: 255, expectation: 'Sign kinds use the source enum 0 through 2.' },
  { label: 'trim-width-negative', path: ['trims', 'sx', 0], replacement: -1, expectation: 'Active trim extents cannot be negative.' },
  { label: 'trim-height-negative', path: ['trims', 'sy', 0], replacement: -1, expectation: 'Active trim extents cannot be negative.' },
  { label: 'trim-depth-negative', path: ['trims', 'sz', 0], replacement: -1, expectation: 'Active trim extents cannot be negative.' },
  { label: 'sign-width-negative', path: ['signs', 'sw', 0], replacement: -1, expectation: 'Active sign extents cannot be negative.' },
  { label: 'sign-height-negative', path: ['signs', 'sh', 0], replacement: -1, expectation: 'Active sign extents cannot be negative.' },
  { label: 'trim-owner-null', path: ['trims', 'owner', 0], replacement: null, expectation: 'Each trim has an owner record.' },
  { label: 'trim-owner-width-string', path: ['trims', 'owner', 0, 'width'], replacement: 'bad', expectation: 'Owner width is a number.' },
  { label: 'trim-span-owner-anchor-string', path: s => ['trims', 'spanTo', indexOf(s.trims.spanTo, v => v !== null), 'anchorV'], replacement: 'bad', expectation: 'A present span owner has a numeric anchor.' },
  { label: 'mass-yaw-pivot-string', path: s => ['masses', indexOf(s.masses, v => v.yawAnchor !== undefined), 'yawAnchor', 'x'], replacement: 'bad', expectation: 'Yaw pivot coordinates are numbers.' },
  { label: 'mass-base-cluster-string', path: s => ['masses', indexOf(s.masses, v => v.baseRecord !== undefined), 'baseRecord', 'cluster'], replacement: 'bad', expectation: 'A base cluster is a numeric enum.' },
  { label: 'mass-split-part-invalid', path: s => ['masses', indexOf(s.masses, v => v.yawWingPart !== undefined), 'yawWingPart', 'part'], replacement: 'sideways', expectation: 'A wing part uses below, band, or roof.' },
  { label: 'mass-art-host-string', path: s => ['masses', indexOf(s.masses, v => v.artBacking !== undefined), 'artBacking', 'hostMassIndex'], replacement: 'bad', expectation: 'Art host indices are integers.' },
  { label: 'mass-support-role-invalid', path: s => ['masses', indexOf(s.masses, v => v.supportRole !== undefined), 'supportRole'], replacement: 'unknown', expectation: 'Support roles use the declared enum.' },
  { label: 'mass-ordinal-negative', path: s => ['massSeedOrdinals', indexOf(s.massSeedOrdinals, v => v !== undefined)], replacement: -1, expectation: 'Present mass ordinals are nonnegative integers.' },
  { label: 'roof-count-string', path: ['roofDetails', 'acceptedByStratum', 0], replacement: 'bad', expectation: 'Stratum counts are integers.' },
  { label: 'roof-record-role-invalid', path: ['roofDetails', 'records', 0, 'role'], replacement: 'unknown', expectation: 'Roof roles use the declared enum.' },
  { label: 'roof-record-stratum-invalid', path: ['roofDetails', 'records', 0, 'stratum'], replacement: 'unknown', expectation: 'Roof strata use the declared enum.' },
  { label: 'roof-record-index-negative', path: ['roofDetails', 'records', 0, 'trimIndex'], replacement: -1, expectation: 'Roof trim indices are nonnegative integers.' },
  { label: 'reconciliation-seed-string', path: ['reconciliation', 'seed'], replacement: 'bad', expectation: 'Reconciliation seed is an integer.' },
  { label: 'source-inventory-entry-null', path: ['reconciliation', 'sourceInventory', 0], replacement: null, expectation: 'Source inventory entries are records.' },
  { label: 'source-inventory-owner-string', path: ['reconciliation', 'sourceInventory', 0, 'owner', 'anchorV'], replacement: 'bad', expectation: 'Source owners have numeric anchors.' },
  { label: 'disposition-kind-invalid', path: ['reconciliation', 'dispositions', 0, 'kind'], replacement: 'unknown', expectation: 'Dispositions use the declared enum.' },
  { label: 'disposition-geometry-string', path: ['reconciliation', 'dispositions', 0, 'oldGeometry', 'sy'], replacement: 'bad', expectation: 'Trim geometry dimensions are numbers.' },
  ...(['unchanged', 'side-rehosted', 'roof-rehosted', 'inherited-roof-unsupported', 'span-rehosted', 'inherited-span-unsupported'] as const).map(kind => ({
    label: 'disposition-' + kind + '-index', path: (s: SkyriverCitySnapshot) => ['reconciliation', 'dispositions', indexOf(s.reconciliation.dispositions, v => v.kind === kind), 'finalIndex'],
    replacement: -1, expectation: 'Every disposition variant has a nonnegative final index.',
  })),
  { label: 'side-disposition-face-id-number', path: s => ['reconciliation', 'dispositions', indexOf(s.reconciliation.dispositions, v => v.kind === 'side-rehosted'), 'faceId'], replacement: 123, expectation: 'Side rehost face IDs are strings.' },
  { label: 'roof-disposition-scale-string', path: s => ['reconciliation', 'dispositions', indexOf(s.reconciliation.dispositions, v => v.kind === 'roof-rehosted'), 'horizontalScale'], replacement: 'bad', expectation: 'Roof scale is a number.' },
  { label: 'span-host-index-negative', path: s => ['reconciliation', 'dispositions', indexOf(s.reconciliation.dispositions, v => v.kind === 'span-rehosted'), 'hosts', 0, 'massIndex'], replacement: -1, expectation: 'Span host indices are nonnegative integers.' },
  { label: 'span-world-endpoint-string', path: s => ['reconciliation', 'dispositions', indexOf(s.reconciliation.dispositions, v => v.kind === 'span-rehosted'), 'newWorld', 'endpoints', 0, 'x'], replacement: 'bad', expectation: 'Span endpoint coordinates are numbers.' },
  { label: 'span-contact-string', path: s => ['reconciliation', 'dispositions', indexOf(s.reconciliation.dispositions, v => v.kind === 'span-rehosted'), 'endpointContacts', 0, 'crossOverlapM'], replacement: 'bad', expectation: 'Contact overlaps are numbers.' },
  { label: 'retained-owner-string', path: ['retainedSupport', 0, 'owner'], replacement: 'bad', expectation: 'Retained support owner is a number.' },
  { label: 'retained-geometry-kind-invalid', path: ['retainedSupport', 0, 'geometry', 'kind'], replacement: 'unknown', expectation: 'Support geometry uses the declared enum.' },
  { label: 'retained-contained-index-negative', path: s => ['retainedSupport', indexOf(s.retainedSupport, v => v.geometry.kind === 'original-owner-contained'), 'geometry', 'sourceMassIndices', 0], replacement: -1, expectation: 'Contained source mass indices are nonnegative integers.' },
  { label: 'far-shape-string', path: ['far', 0, 'shape'], replacement: 'bad', expectation: 'Far tower shape is a number.' },
  { label: 'mega-coordinate-string', path: ['mega', 0, 'v'], replacement: 'bad', expectation: 'Mega anchor coordinates are numbers.' },
  { label: 'tier-face-projection-string', path: ['tiers', { mapValue: 0 }, 0, 'face', 'projection'], replacement: 'bad', expectation: 'Tier faces have numeric projection.' },
  { label: 'facade-side-invalid', path: ['facadeFaces', 0, 'side'], replacement: 0, expectation: 'Facade side is minus one or one.' },
  { label: 'facade-owner-depth-string', path: ['facadeFaces', 0, 'owner', 'depth'], replacement: 'bad', expectation: 'Facade owners have numeric depth.' },
  { label: 'legacy-face-axis-invalid', path: ['legacyFaces', 0, 'planeAxis'], replacement: 'y', expectation: 'Facade plane axis is x or z.' },
  { label: 'profile-eligibility-invalid', path: ['towerProfiles', 0, 'eligibility', 'kind'], replacement: 'unknown', expectation: 'Profile eligibility uses eligible or excluded.' },
  { label: 'profile-stage-footprint-string', path: ['towerProfiles', 0, 'stages', 0, 'footprint', 'width'], replacement: 'bad', expectation: 'Stage footprint dimensions are numbers.' },
  { label: 'profile-stage-vertical-string', path: ['towerProfiles', 0, 'stages', 0, 'verticalBounds', 'height'], replacement: 'bad', expectation: 'Stage vertical dimensions are numbers.' },
  { label: 'profile-stage-offset-string', path: s => {
    const p = indexOf(s.towerProfiles, v => v.eligibility.kind === 'eligible' && 'stages' in v && v.stages.some(stage => stage.offset !== null));
    const row = s.towerProfiles[p]!;
    if (!('stages' in row)) throw new Error('R40_REAL_STAGE_WITNESS');
    return ['towerProfiles', p, 'stages', indexOf(row.stages, stage => stage.offset !== null), 'offset', 'ratio'];
  }, replacement: 'bad', expectation: 'Stage offset ratios are numbers.' },
  { label: 'profile-crown-bounds-string', path: ['towerProfiles', 0, 'crown', 'bounds', 'height'], replacement: 'bad', expectation: 'Crown dimensions are numbers.' },
  { label: 'profile-crown-index-negative', path: ['towerProfiles', 0, 'crown', 'massIndices', 0], replacement: -1, expectation: 'Crown mass indices are nonnegative integers.' },
  { label: 'profile-lean-axis-invalid', path: s => ['towerProfiles', indexOf(s.towerProfiles, v => 'lean' in v && v.lean !== null), 'lean', 'axis'], replacement: 'x', expectation: 'The lean profile axis is z.' },
  { label: 'profile-host-face-string', path: ['towerProfiles', 0, 'hostFace', 'y1'], replacement: 'bad', expectation: 'Profile host face bounds are numbers.' },
  { label: 'sign-loop-count-string', path: ['signs', 'acceptedByLoopSection', 0], replacement: 'bad', expectation: 'Loop section counts are integers.' },
  { label: 'sign-owner-width-string', path: s => ['signs', 'owner', indexOf(s.signs.owner, v => v !== null), 'width'], replacement: 'bad', expectation: 'Present sign owners have numeric width.' },
  { label: 'sign-mount-host-kind-invalid', path: ['signs', 'mount', 0, 'host', 'kind'], replacement: 'unknown', expectation: 'Sign mount host kind is mass or trim.' },
  { label: 'sign-mount-host-index-negative', path: ['signs', 'mount', 0, 'host', 'index'], replacement: -1, expectation: 'Sign host indices are nonnegative integers.' },
  { label: 'sign-mount-root-point-string', path: ['signs', 'mount', 0, 'root', 0, 'x'], replacement: 'bad', expectation: 'Mount root coordinates are numbers.' },
  { label: 'sign-mount-edge-point-string', path: ['signs', 'mount', 0, 'edge', 1, 'z'], replacement: 'bad', expectation: 'Mount edge coordinates are numbers.' },
  { label: 'sign-face-id-number', path: ['signs', 'faceId', 0], replacement: 123, expectation: 'Present sign face IDs are strings.' },
  { label: 'hero-box-half-extent-string', path: ['roofDetailHeroBoxes', 0, 'halfX'], replacement: 'bad', expectation: 'Hero box half extents are numbers.' },
  { label: 'hero-box-basis-string', path: ['roofDetailHeroBoxes', 0, 'ux'], replacement: 'bad', expectation: 'Hero box basis coordinates are numbers.' },
  { label: 'hero-kind-invalid', path: ['heroes', 0, 'kind'], replacement: 'unknown', expectation: 'Hero kind is blade, panel, or brand.' },
  { label: 'hero-cell-string', path: ['heroes', 0, 'cell'], replacement: 'bad', expectation: 'Hero cells are integers.' },
  { label: 'hero-owner-anchor-string', path: ['heroes', 0, 'owner', 'anchorV'], replacement: 'bad', expectation: 'Hero owner anchor is a number.' },
];

function reference(value: CityGraphValue): number {
  if (!Array.isArray(value) || value[0] !== 'r' || typeof value[1] !== 'number') throw new Error('R40_REAL_WIRE_REFERENCE');
  return value[1];
}

/** Change one real domain value. Keep graph wire structure and its digest valid. */
export function mutateCityDomainWire(payload: CityGraphPayload, snapshot: SkyriverCitySnapshot, fault: DomainFault): CityGraphPayload {
  const path = typeof fault.path === 'function' ? fault.path(snapshot) : fault.path;
  let value = payload.root;
  const pool = [...payload.pool];
  for (const [step, part] of path.entries()) {
    const index = reference(value), node = pool[index]!;
    let offset: number, container: readonly CityGraphValue[];
    if (typeof part === 'number' && node[0] === 4 && step + 1 === path.length) {
      if (typeof fault.replacement !== 'number' || part < 0 || part >= node[5]) throw new Error('R40_REAL_TYPED_WORD');
      const buffer = pool[node[3]]!;
      if (buffer[0] !== 3) throw new Error('R40_REAL_TYPED_BACKING');
      const bytes = Buffer.from(buffer[2], 'hex');
      if (node[2] === 'Uint8Array') bytes.writeUInt8(fault.replacement, node[4] + part);
      else if (node[2] === 'Float32Array') bytes.writeFloatLE(fault.replacement, node[4] + part * 4);
      else if (node[2] === 'Float64Array') bytes.writeDoubleLE(fault.replacement, node[4] + part * 8);
      else throw new Error('R40_CITY_TYPED_KIND');
      const hex = bytes.toString('hex');
      pool[node[3]] = buffer.length === 5 ? [3, buffer[1], hex, buffer[3]!, buffer[4]!]
        : buffer.length === 4 ? [3, buffer[1], hex, buffer[3]!] : [3, buffer[1], hex];
      break;
    }
    if (typeof part === 'string' && node[0] === 0) {
      const pairs = node[3];
      if (!pairs) throw new Error('R40_REAL_WIRE_RECORD');
      const key = payload.keys.indexOf(part);
      offset = pairs.findIndex((item, i) => i % 2 === 0 && item === key) + 1;
      if (offset === 0) throw new Error('R40_REAL_WIRE_FIELD:' + part);
      container = pairs;
    } else if (typeof part === 'number' && node[0] === 1) {
      offset = part; container = node[3];
    } else if (typeof part === 'object' && node[0] === 2) {
      offset = part.mapValue * 2 + 1; container = node[2];
    } else throw new Error('R40_REAL_WIRE_PATH');
    if (offset >= container.length) throw new Error('R40_REAL_WIRE_RANGE');
    if (step + 1 < path.length) { value = container[offset]!; continue; }
    const changed = [...container]; changed[offset] = fault.replacement;
    if (node[0] === 0) pool[index] = node.length === 5 ? [0, node[1], node[2], changed, node[4]!] : [0, node[1], node[2], changed];
    else if (node[0] === 1) {
      pool[index] = node.length === 7 ? [1, node[1], node[2], changed, node[4]!, node[5]!, node[6]!]
        : node.length === 6 ? [1, node[1], node[2], changed, node[4]!, node[5]!]
          : node.length === 5 ? [1, node[1], node[2], changed, node[4]!] : [1, node[1], node[2], changed];
    } else if (node[0] === 2) pool[index] = node.length === 5 ? [2, node[1], changed, node[3]!, node[4]!]
      : node.length === 4 ? [2, node[1], changed, node[3]!] : [2, node[1], changed];
  }
  const body = { version: payload.version, keys: payload.keys, root: payload.root, pool };
  return { ...body, hash: createHash('sha256').update(JSON.stringify(body)).digest('hex') };
}

export function readDomainFault(value: unknown, snapshot: SkyriverCitySnapshot, fault: DomainFault): unknown {
  const path = typeof fault.path === 'function' ? fault.path(snapshot) : fault.path;
  let current = value;
  for (const part of path) {
    if (typeof part === 'object') {
      if (!(current instanceof Map)) throw new Error('R40_DOMAIN_MAP');
      current = [...current.values()][part.mapValue];
    } else {
      if (typeof current !== 'object' || current === null) throw new Error('R40_DOMAIN_RECORD');
      current = Reflect.get(current, part);
    }
  }
  return current;
}

/** Shorten the actual view. Keep its own length field equal to the source count. */
export function mutateCityKindLengthWire(payload: CityGraphPayload, snapshot: SkyriverCitySnapshot,
  family: 'trims' | 'signs'): CityGraphPayload {
  const pool = [...payload.pool];
  let value = payload.root;
  for (const field of [family, 'kind']) {
    const node = pool[reference(value)]!;
    if (node[0] !== 0 || !node[3]) throw new Error('R40_KIND_RECORD');
    const key = payload.keys.indexOf(field);
    const offset = node[3].findIndex((item, i) => i % 2 === 0 && item === key);
    if (offset < 0) throw new Error('R40_KIND_FIELD');
    value = node[3][offset + 1]!;
  }
  const index = reference(value), node = pool[index]!;
  if (node[0] !== 4 || node[2] !== 'Uint8Array') throw new Error('R40_KIND_VIEW');
  const keys = [...payload.keys];
  let lengthKey = keys.indexOf('length');
  if (lengthKey < 0) { lengthKey = keys.length; keys.push('length'); }
  const fields = [...(node[6] ?? []), lengthKey, snapshot[family].count];
  pool[index] = node.length === 8
    ? [4, node[1], node[2], node[3], node[4], 1, fields, node[7]!]
    : [4, node[1], node[2], node[3], node[4], 1, fields];
  const body = { version: payload.version, keys, root: payload.root, pool };
  return { ...body, hash: createHash('sha256').update(JSON.stringify(body)).digest('hex') };
}
