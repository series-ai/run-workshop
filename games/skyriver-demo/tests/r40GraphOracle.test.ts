import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { clearCitySnapshot, pureCitySnapshot, readCitySnapshot, installCitySnapshot, citySnapshotFamilyPresence,
  deriveCityTrims, deriveCityMasses, deriveNeonSigns, deriveRoofDetails, deriveFacadeFaces,
  deriveLegacyFacadeFaces, deriveHeroBlades, deriveFarTowers, deriveTowerProfiles,
  deriveLegacyTrimReconciliation, deriveRetainedMassSupportRecords, type SkyriverCitySnapshot,
} from '../src/render/city';
import { encodeCityGraph, decodeCityGraph, decodeCityGraphAsync, type CityGraphPayload, type CityGraphNode }
  from '../src/render/citySnapshotCodec';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import { compareCityGraphs, replaceGraphField } from './support/r40GraphOracle';
import { prepareCitySnapshot } from '../src/render/citySnapshotLoader';
import { byteHash, readActualCityAsset, verifyActualAsset, type ActualCityAsset } from './support/r40AssetOracle';
import { measureCityCalls } from './support/r40RuntimeCoverage';
import { CITY_DOMAIN_FAULTS, mutateCityDomainWire, mutateCityKindLengthWire, readDomainFault } from './support/r40DomainFaults';
import { identifyCityCacheMaps, observeCityCacheWrites, observeCityCacheWritesAsync } from './support/r40CacheWrites';

let pure: SkyriverCitySnapshot;
let canonicalPayload: CityGraphPayload;

function numberWithNanPayload(payload: number): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setUint32(0, 0x7ff80000, false);
  view.setUint32(4, payload, false);
  return view.getFloat64(0, false);
}

function changeAt(value: object, path: readonly string[], replacement: unknown): object {
  const [key, ...remaining] = path;
  if (key === undefined) return replacement as object;
  const changed = remaining.length === 0 ? replacement
    : changeAt(Reflect.get(value, key) as object, remaining, replacement);
  const result: object = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  for (const name of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name)!;
    Object.defineProperty(result, name, name === key ? { ...descriptor, value: changed } : descriptor);
  }
  if (!Object.isExtensible(value)) Object.preventExtensions(result);
  return result;
}

function realLinks(root: object): { first: readonly string[]; second: readonly string[]; value: object } {
  const paths = new Map<object, readonly string[]>();
  let link: ReturnType<typeof realLinks> | undefined;
  const visit = (value: object, path: readonly string[]) => {
    if (link || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return;
    const prior = paths.get(value);
    if (prior) { link = { first: prior, second: path, value }; return; }
    paths.set(value, path);
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if ('value' in descriptor && typeof descriptor.value === 'object' && descriptor.value !== null) {
        visit(descriptor.value, [...path, key]);
      }
    }
  };
  visit(root, []);
  if (!link) throw new Error('R40_REAL_REFERENCE_LINK_MISSING');
  return link;
}

function expectRule(candidate: unknown, rule: string): void {
  const result = compareCityGraphs(pure, candidate);
  expect(result.equal).toBe(false);
  expect(result.differences.some(difference => difference.rule === rule), JSON.stringify(result.differences)).toBe(true);
}

beforeAll(() => {
  pure = pureCitySnapshot(presentCityLayout(deriveCityLayout(424242)));
  canonicalPayload = encodeCityGraph(pure);
}, 60_000);

describe('R40 independent graph controls from the real city', () => {
  it('reads all cache families and every real mass ordinal', () => {
    expect(Object.keys(pure)).toEqual(['trims', 'masses', 'massSeedOrdinals', 'roofDetails',
      'reconciliation', 'retainedSupport', 'far', 'mega', 'tiers', 'facadeFaces',
      'legacyFaces', 'towerProfiles', 'signs', 'roofDetailHeroBoxes', 'heroes']);
    expect(pure.massSeedOrdinals).toHaveLength(pure.masses.length);
    expect(pure.signs.count).toBe(313);
    const result = compareCityGraphs(pure, pure);
    expect(result.equal, JSON.stringify(result.differences)).toBe(true);
    expect(result.comparedBytes).toBeGreaterThan(0);
    expect(result.sharedReferences).toBeGreaterThan(0);
  });

  it('rejects swapped actual trim coordinate fields', () => {
    expect(compareCityGraphs(pure.trims.cx, pure.trims.cy).equal).toBe(false);
    const trims = replaceGraphField(pure.trims, 'cx', pure.trims.cy);
    expectRule(replaceGraphField(pure, 'trims', trims), 'buffer-byte');
  });

  it('rejects a changed actual typed-array byte', () => {
    const cx = pure.trims.cx.slice();
    new Uint8Array(cx.buffer)[0] ^= 1;
    expectRule(replaceGraphField(pure, 'trims', replaceGraphField(pure.trims, 'cx', cx)), 'buffer-byte');
  });

  it('rejects a changed real mass ordinal', () => {
    const ordinals = [...pure.massSeedOrdinals];
    const index = ordinals.findIndex(value => value !== undefined);
    expect(index).toBeGreaterThanOrEqual(0);
    ordinals[index] = ordinals[index]! + 1;
    expectRule(replaceGraphField(pure, 'massSeedOrdinals', ordinals), 'scalar');
  });

  it('rejects a lost real alias', () => {
    const link = realLinks(pure);
    const duplicate = Object.create(Object.getPrototypeOf(link.value), Object.getOwnPropertyDescriptors(link.value));
    if (!Object.isExtensible(link.value)) Object.preventExtensions(duplicate);
    expectRule(changeAt(pure, link.second, duplicate), 'reference-alias');
  });

  it('rejects an accidental alias between distinct real masses', () => {
    expect(pure.masses[0]).not.toBe(pure.masses[1]);
    expectRule(changeAt(pure, ['masses', '1'], pure.masses[0]), 'reference-alias');
  });

  it('rejects a changed real descriptor and object freeze state', () => {
    const result = Object.create(Object.getPrototypeOf(pure)) as SkyriverCitySnapshot;
    for (const key of Reflect.ownKeys(pure)) {
      const descriptor = Object.getOwnPropertyDescriptor(pure, key)!;
      Object.defineProperty(result, key, key === 'trims' ? { ...descriptor, enumerable: !descriptor.enumerable } : descriptor);
    }
    expectRule(result, 'descriptor-enumerable');
    expectRule(Object.freeze({ ...pure }), 'frozen');
  });

  it('rejects changed real property and Map order', () => {
    const reversed = Object.fromEntries(Object.entries(pure).reverse());
    expectRule(reversed, 'property-order');
    expect(pure.tiers.size).toBeGreaterThan(1);
    expectRule(replaceGraphField(pure, 'tiers', new Map([...pure.tiers].reverse())), 'scalar');
  });

  it('keeps exact Number controls on a real mass record', () => {
    const mass = pure.masses[0]!;
    const zero = replaceGraphField(mass, 'x', 0), negativeZero = replaceGraphField(mass, 'x', -0);
    const result = compareCityGraphs(zero, negativeZero);
    expect(result.equal).toBe(false);
    expect(result.differences[0]?.rule).toBe('scalar');
    expect(result.differences[0]?.actual).toContain('8000000000000000');
    expect(compareCityGraphs(replaceGraphField(mass, 'x', Infinity),
      replaceGraphField(mass, 'x', -Infinity)).equal).toBe(false);
    expect(compareCityGraphs(replaceGraphField(mass, 'x', NaN),
      replaceGraphField(mass, 'x', NaN)).equal).toBe(true);
    expect(compareCityGraphs(replaceGraphField(mass, 'x', numberWithNanPayload(1)),
      replaceGraphField(mass, 'x', numberWithNanPayload(2))).equal).toBe(false);
  });

  it('distinguishes a real field with undefined from an absent field', () => {
    const mass = pure.masses[0]!;
    const withUndefined = replaceGraphField(mass, 'x', undefined);
    const absent = Object.create(Object.getPrototypeOf(mass));
    for (const key of Reflect.ownKeys(mass)) {
      if (key !== 'x') Object.defineProperty(absent, key, Object.getOwnPropertyDescriptor(mass, key)!);
    }
    if (!Object.isExtensible(mass)) Object.preventExtensions(absent);
    expect(compareCityGraphs(withUndefined, absent).equal).toBe(false);
  });

  it('rejects lost backing-buffer sharing for views of real uploaded source bytes', () => {
    const real = pure.trims.cx;
    const shared = [new Uint8Array(real.buffer, real.byteOffset, real.byteLength),
      new DataView(real.buffer, real.byteOffset, real.byteLength)];
    const detached = [shared[0], new DataView(real.buffer.slice(0), real.byteOffset, real.byteLength)];
    const result = compareCityGraphs(shared, detached);
    expect(result.equal).toBe(false);
    expect(result.differences.some(row => row.rule === 'reference-alias')).toBe(true);
  });

  it('rejects changed NaN payload bytes in an actual typed view', () => {
    const a = pure.trims.cx.slice(), b = pure.trims.cx.slice();
    new DataView(a.buffer).setUint32(0, 0x7fc00001, true);
    new DataView(b.buffer).setUint32(0, 0x7fc00002, true);
    expect(Number.isNaN(a[0])).toBe(true);
    expect(Number.isNaN(b[0])).toBe(true);
    const result = compareCityGraphs(a, b);
    expect(result.equal).toBe(false);
    expect(result.differences[0]?.rule).toBe('buffer-byte');
  });
});

function requireExactSnapshot(reference: SkyriverCitySnapshot, value: unknown): asserts value is SkyriverCitySnapshot {
  const result = compareCityGraphs(reference, value);
  expect(result.equal, JSON.stringify(result.differences)).toBe(true);
}

function withPool(payload: CityGraphPayload, pool: readonly CityGraphNode[]): CityGraphPayload {
  const body = { version: payload.version, keys: payload.keys, root: payload.root, pool };
  return { ...body, hash: createHash('sha256').update(JSON.stringify(body)).digest('hex') };
}

function changedNode(payload: CityGraphPayload, index: number, node: CityGraphNode): CityGraphPayload {
  const pool = [...payload.pool];
  pool[index] = node;
  return withPool(payload, pool);
}

describe('R40 actual city codec and installation', () => {
  it('roundtrips every canonical family and keeps public access order exact', () => {
    const layout = presentCityLayout(deriveCityLayout(424242));
    const decoded = decodeCityGraph(canonicalPayload);
    requireExactSnapshot(pure, decoded);
    const queries = [
      () => expect(deriveNeonSigns(layout)).toBe(decoded.signs),
      () => expect(deriveCityMasses(layout)).toBe(decoded.masses),
      () => expect(deriveRoofDetails(layout)).toBe(decoded.roofDetails),
      () => expect(deriveFacadeFaces(layout)).toBe(decoded.facadeFaces),
      () => expect(deriveCityTrims(layout)).toBe(decoded.trims),
      () => expect(deriveLegacyFacadeFaces(layout)).toBe(decoded.legacyFaces),
      () => expect(deriveHeroBlades(layout)).toBe(decoded.heroes),
      () => expect(deriveFarTowers(layout)).toBe(decoded.far),
      () => expect(deriveTowerProfiles(layout)).toBe(decoded.towerProfiles),
      () => expect(deriveLegacyTrimReconciliation(layout)).toBe(decoded.reconciliation),
      () => expect(deriveRetainedMassSupportRecords(layout)).toBe(decoded.retainedSupport),
    ];
    for (const first of [0, 1, 2, 3]) {
      clearCitySnapshot(layout.seed);
      expect(readCitySnapshot(layout)).toBeUndefined();
      installCitySnapshot(layout, decoded);
      queries[first]!();
      queries.forEach(query => query());
      requireExactSnapshot(pure, readCitySnapshot(layout));
    }
  }, 90_000);

  it.each([0, 123456])('roundtrips real fallback seed %i once', seed => {
    const layout = presentCityLayout(deriveCityLayout(seed));
    const reference = pureCitySnapshot(layout);
    const decoded = decodeCityGraph(encodeCityGraph(reference));
    requireExactSnapshot(reference, decoded);
    clearCitySnapshot(seed);
    installCitySnapshot(layout, decoded);
    expect(deriveNeonSigns(layout)).toBe(decoded.signs);
    expect(deriveCityMasses(layout)).toBe(decoded.masses);
    requireExactSnapshot(reference, readCitySnapshot(layout));
    clearCitySnapshot(seed);
  }, 90_000);

  it.each(['sync', 'async'] as const)('preserves real Number and shared-view contracts through %s', async mode => {
    const mass = pure.masses[0]!;
    const source = pure.trims.cx;
    const offset = source.byteOffset + source.BYTES_PER_ELEMENT;
    const length = Math.min(32, source.byteLength - source.BYTES_PER_ELEMENT);
    const shared = [new Uint8Array(source.buffer, offset, length), new DataView(source.buffer, offset, length)];
    const sealed = Object.preventExtensions(source.slice(0, 8));
    expect(Object.isSealed(sealed)).toBe(true);
    const nanBytes = source.slice(0, 8);
    new DataView(nanBytes.buffer).setUint32(0, 0x7fc00001, true);
    const controls = { mass,
      numbers: [mass.x, mass.y0, mass.height, 0, -0, Infinity, -Infinity, NaN, numberWithNanPayload(7), undefined],
      views: shared, sealed, nanBytes, tiers: new Map([...pure.tiers].slice(0, 2)) };
    const payload = encodeCityGraph(controls);
    const decoded = mode === 'sync' ? decodeCityGraph(payload) : await decodeCityGraphAsync(payload);
    const result = compareCityGraphs(controls, decoded);
    expect(result.equal, JSON.stringify(result.differences)).toBe(true);
  });

  it('keeps existing complete state and other seeds after rejected installation', () => {
    const layout = presentCityLayout(deriveCityLayout(424242));
    installCitySnapshot(layout, pure);
    const before = readCitySnapshot(layout);
    const foreign = presentCityLayout(deriveCityLayout(4294967295));
    clearCitySnapshot(foreign.seed);
    const wrongOrdinals = [...pure.massSeedOrdinals];
    wrongOrdinals[wrongOrdinals.length - 1] = -1;
    const candidates = [
      replaceGraphField(pure, 'heroes', undefined),
      replaceGraphField(pure, 'massSeedOrdinals', wrongOrdinals),
      replaceGraphField(pure, 'tiers', []),
      replaceGraphField(pure, 'signs', replaceGraphField(pure.signs, 'anchorV', new Float32Array(pure.signs.anchorV.length))),
    ];
    for (const candidate of candidates) {
      expect(() => installCitySnapshot(layout, candidate)).toThrow();
      requireExactSnapshot(pure, readCitySnapshot(layout));
      expect(readCitySnapshot(layout)?.masses).toBe(before?.masses);
      expect(() => installCitySnapshot(foreign, candidate)).toThrow();
      expect(readCitySnapshot(foreign)).toBeUndefined();
      expect(Object.values(citySnapshotFamilyPresence(foreign.seed))).toEqual(Array(15).fill(false));
      requireExactSnapshot(pure, readCitySnapshot(layout));
    }
  });

  it('rejects stale and malformed real payloads with valid independent outer hashes', () => {
    const payload = encodeCityGraph({ mass: pure.masses[0], bytes: pure.trims.kind,
      tiers: new Map([...pure.tiers].slice(0, 1)) });
    const typedIndex = payload.pool.findIndex(node => node[0] === 4);
    const bufferIndex = payload.pool.findIndex(node => node[0] === 3);
    const objectIndex = payload.pool.findIndex(node => node[0] === 0 && (node[3]?.length ?? 0) > 0);
    const mapIndex = payload.pool.findIndex(node => node[0] === 2);
    const typed = payload.pool[typedIndex]!, buffer = payload.pool[bufferIndex]!, object = payload.pool[objectIndex]!;
    const map = payload.pool[mapIndex]!;
    if (typed[0] !== 4 || buffer[0] !== 3 || object[0] !== 0 || map[0] !== 2) {
      throw new Error('R40_REAL_PAYLOAD_CONTROL_NODE_MISSING');
    }
    const properties = object[3]!;
    const broken = [
      { ...payload, version: payload.version + 1 },
      { ...payload, hash: '0'.repeat(64) },
      withPool(payload, payload.pool.slice(0, -1)),
      changedNode(payload, typedIndex, [4, typed[1], typed[2], payload.pool.length, typed[4], typed[5]]),
      changedNode(payload, typedIndex, [4, typed[1], typed[2], typed[3], typed[4], Number.MAX_SAFE_INTEGER]),
      changedNode(payload, bufferIndex, [3, buffer[1], 'zz' + buffer[2].slice(2)]),
      changedNode(payload, objectIndex, [0, object[1], object[2], [...properties, properties[0]!, properties[1]!]]),
      changedNode(payload, mapIndex, [2, map[1], [...map[2], map[2][0]!, map[2][1]!]]),
    ];
    for (const candidate of broken) expect(() => decodeCityGraph(candidate)).toThrow();
    const layout = presentCityLayout(deriveCityLayout(424242));
    requireExactSnapshot(pure, readCitySnapshot(layout));
  });
});


describe('R40 untrusted wire boundary controls', () => {
  it.each([['sync', 'getter'], ['sync', 'toJSON'], ['async', 'getter'], ['async', 'toJSON']] as const)(
    'rejects %s nested %s without execution', async (mode, fault) => {
    const payload = encodeCityGraph(pure.masses[0]);
    const original = payload.pool[0]!;
    const tuple = [...original];
    let executed = 0;
    if (fault === 'getter') {
      Object.defineProperty(tuple, '1', { enumerable: true, configurable: true,
        get() { executed += 1; return original[1]; } });
    } else {
      Object.defineProperty(tuple, 'toJSON', { configurable: true,
        value() { executed += 1; return [...original]; } });
    }
    const pool: unknown[] = [...payload.pool];
    pool[0] = tuple;
    let rejected = false;
    try {
      if (mode === 'sync') decodeCityGraph({ ...payload, pool });
      else await decodeCityGraphAsync({ ...payload, pool });
    } catch { rejected = true; }
    expect(executed, `${fault} executed before wire rejection`).toBe(0);
    expect(rejected, `${fault} wire was accepted`).toBe(true);
  });

  it.each([['sync', 'map-size'], ['sync', 'typed-buffer'], ['sync', 'view-buffer'],
    ['async', 'map-size'], ['async', 'typed-buffer'], ['async', 'view-buffer']] as const)(
    '%s roundtrips a real record on the valid own custom key %s', async (mode, kind) => {
      const mass = pure.masses[0]!;
      const source = pure.trims.cx;
      const value = kind === 'map-size' ? new Map([...pure.tiers].slice(0, 1))
        : kind === 'typed-buffer' ? new Float32Array(source.buffer, source.byteOffset, 8)
        : new DataView(source.buffer, source.byteOffset, 32);
      Object.defineProperty(value, kind === 'map-size' ? 'size' : 'buffer',
        { value: mass, writable: true, enumerable: true, configurable: true });
      const reference = { mass, value };
      const payload = encodeCityGraph(reference);
      const decoded = mode === 'sync' ? decodeCityGraph(payload) : await decodeCityGraphAsync(payload);
      const result = compareCityGraphs(reference, decoded);
      expect(result.equal, JSON.stringify(result.differences)).toBe(true);
    });
});


describe('R40 async integrity and detached input', () => {
  it('matches every real canonical graph value and installs async output', async () => {
    const decoded = await decodeCityGraphAsync(canonicalPayload);
    requireExactSnapshot(pure, decoded);
    const layout = presentCityLayout(deriveCityLayout(424242));
    clearCitySnapshot(layout.seed);
    expect(Object.values(citySnapshotFamilyPresence(layout.seed))).toEqual(Array(15).fill(false));
    installCitySnapshot(layout, decoded);
    requireExactSnapshot(pure, readCitySnapshot(layout));
    expect(Object.values(citySnapshotFamilyPresence(layout.seed))).toEqual(Array(15).fill(true));
  }, 30_000);

  it('uses the exact validated graph when the caller changes input during await', async () => {
    const reference = pure.masses[0]!;
    const payload = encodeCityGraph(reference);
    const pending = decodeCityGraphAsync(payload);
    Reflect.set(payload, 'version', payload.version + 1);
    Reflect.set(payload, 'hash', '0'.repeat(64));
    Reflect.set(payload, 'root', ['r', payload.pool.length]);
    Reflect.set(payload.keys, '0', 'changed-after-call');
    const node = payload.pool[0]!;
    Reflect.set(node, '1', 99);
    const decoded = await pending;
    const result = compareCityGraphs(reference, decoded);
    expect(result.equal, JSON.stringify(result.differences)).toBe(true);
    await expect(decodeCityGraphAsync(payload)).rejects.toThrow();
  });

  it('rejects a changed hash asynchronously', async () => {
    const payload = encodeCityGraph(pure.masses[0]);
    await expect(decodeCityGraphAsync({ ...payload, hash: '0'.repeat(64) })).rejects.toThrow();
  });

  it.each([['sync', 'object'], ['sync', 'primitive'], ['async', 'object'], ['async', 'primitive']] as const)(
    '%s rejects a real JSON own extra __proto__ %s field', async (mode, shape) => {
    const payload = encodeCityGraph(pure.masses[0]);
    const malformed = { ...payload };
    Object.defineProperty(malformed, '__proto__', { value: shape === 'object' ? { r40ExtraWireMarker: 1 } : 123,
      writable: true, enumerable: true, configurable: true });
    const text = JSON.stringify(malformed);
    expect(text).toContain('"__proto__":');
    const input = JSON.parse(text) as object;
    expect(Object.hasOwn(input, '__proto__')).toBe(true);
    const prototype = Object.getPrototypeOf(input);
    let rejected = false;
    try {
      if (mode === 'sync') decodeCityGraph(input);
      else await decodeCityGraphAsync(input);
    } catch { rejected = true; }
    expect(Object.getPrototypeOf(input)).toBe(prototype);
    expect(Object.hasOwn(Object.prototype, 'r40ExtraWireMarker')).toBe(false);
    expect(rejected, 'extra own JSON key was accepted').toBe(true);
  });
});

function r40Receipt(name: string, data: unknown): void {
  const directory = process.env.R40_RECEIPT_DIR;
  if (!directory) return;
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, name + '.json'), JSON.stringify(data, null, 2) + '\n');
}

function expectCacheIdentity(reference: SkyriverCitySnapshot, actual: SkyriverCitySnapshot | undefined): void {
  expect(actual).toBeDefined();
  for (const key of Object.keys(reference) as (keyof SkyriverCitySnapshot)[]) {
    if (key === 'massSeedOrdinals') expect(actual![key]).toEqual(reference[key]);
    else expect(actual![key], key).toBe(reference[key]);
  }
  expect(Object.values(citySnapshotFamilyPresence(424242))).toEqual(Array(15).fill(true));
}

function expectNoPureCityCalls(calls: ReadonlyMap<string, number>): void {
  expect(calls.get('prepareCitySnapshot'), 'real loader call coverage is required').toBeGreaterThan(0);
  for (const name of ['pureCitySnapshot', 'deriveNeonSignArtwork', 'mountNeonSigns',
    'appendRetainedMassSupports', 'appendRoofDetailSuffix', 'reconcileLegacyTrimsD1',
    'reconcileLegacyTrimsD2', 'reconcileLegacyTrimsD3']) {
    expect(calls.get(name) ?? 0, name + ' ran on cache preparation').toBe(0);
  }
}

describe('R40 committed real assets and common loader', () => {
  const project = join(__dirname, '..');
  let nodeAsset: ActualCityAsset;
  let browserAsset: ActualCityAsset;
  beforeAll(() => {
    nodeAsset = readActualCityAsset(project, 'node');
    browserAsset = readActualCityAsset(project, 'browser');
    r40Receipt('asset-runtime', { node: process.version, versions: process.versions,
      platform: process.platform, arch: process.arch, browserGenerationRun: false });
  });

  it.each(['node', 'browser'] as const)('binds actual %s gzip, envelope, and current source files', runtime => {
    const asset = runtime === 'node' ? nodeAsset : browserAsset;
    const result = verifyActualAsset(project, asset);
    r40Receipt('asset-' + runtime, { ...result, binding: asset.binding,
      gzipSha256: byteHash(asset.compressed), payloadSha256: byteHash(asset.raw),
      gzipBytes: asset.compressed.byteLength, payloadBytes: asset.raw.byteLength });
  });

  it('rejects actual asset hash and manifest fault controls independently', () => {
    const bytes = nodeAsset.compressed.slice();
    bytes[Math.floor(bytes.length / 2)]! ^= 1;
    expect(() => verifyActualAsset(project, { ...nodeAsset, compressed: bytes })).toThrow();
    expect(() => verifyActualAsset(project, { ...nodeAsset,
      binding: { ...nodeAsset.binding, sourceManifestDigest: '0'.repeat(64) } })).toThrow();
    expect(() => verifyActualAsset(project, { ...nodeAsset, manifest: [] })).toThrow();
  });

  it('loads the actual Node cache and public queries with no pure city work', async () => {
    const layout = presentCityLayout(deriveCityLayout(424242));
    expect(encodeCityGraph(layout).hash).toBe(nodeAsset.binding.layoutSignature);
    expect(canonicalPayload.hash).toBe(nodeAsset.binding.payloadHash);
    clearCitySnapshot(layout.seed);
    const observed = await measureCityCalls(async () => {
      const result = await prepareCitySnapshot(layout, nodeAsset.binding, nodeAsset.compressed, 'node');
      expect(result.mode, result.reason).toBe('cache');
      const installed = readCitySnapshot(layout);
      requireExactSnapshot(pure, installed);
      expect(deriveNeonSigns(layout)).toBe(installed.signs);
      expect(deriveCityMasses(layout)).toBe(installed.masses);
      expect(deriveRoofDetails(layout)).toBe(installed.roofDetails);
      expect(deriveFacadeFaces(layout)).toBe(installed.facadeFaces);
      expect(deriveLegacyFacadeFaces(layout)).toBe(installed.legacyFaces);
      expect(deriveHeroBlades(layout)).toBe(installed.heroes);
      expect(deriveFarTowers(layout)).toBe(installed.far);
      expect(deriveTowerProfiles(layout)).toBe(installed.towerProfiles);
      expect(deriveLegacyTrimReconciliation(layout)).toBe(installed.reconciliation);
      expect(deriveRetainedMassSupportRecords(layout)).toBe(installed.retainedSupport);
      expect(deriveCityTrims(layout)).toBe(installed.trims);
      return result;
    });
    expectNoPureCityCalls(observed.calls);
    r40Receipt('node-loader', { result: observed.value, calls: Object.fromEntries(observed.calls),
      note: 'V8 call coverage adds measurement cost. These intervals are not cold performance acceptance.' });
  }, 30_000);

  it('preserves all cache families on rejected binding, bytes, layout, seed, and runtime', async () => {
    const layout = presentCityLayout(deriveCityLayout(424242));
    const installed = readCitySnapshot(layout);
    requireExactSnapshot(pure, installed);
    const changedLayout = replaceGraphField(layout, 'towers', [
      replaceGraphField(layout.towers[0]!, 'width', layout.towers[0]!.width + 1), ...layout.towers.slice(1),
    ]);
    const other = presentCityLayout(deriveCityLayout(0));
    clearCitySnapshot(other.seed);
    const corrupt = nodeAsset.compressed.slice();
    corrupt[Math.floor(corrupt.length / 2)]! ^= 1;
    const bindings: readonly Record<string, unknown>[] = [
      { ...nodeAsset.binding, codecVersion: 1 },
      { ...nodeAsset.binding, canonicalSeed: 0 },
      { ...nodeAsset.binding, sourceManifestDigest: '0'.repeat(64) },
      { ...nodeAsset.binding, layoutSignature: '0'.repeat(64) },
      { ...nodeAsset.binding, payloadHash: '0'.repeat(64) },
      { ...nodeAsset.binding, payloadSha256: '0'.repeat(64) },
      { ...nodeAsset.binding, gzipSha256: '0'.repeat(64) },
      { ...nodeAsset.binding, payloadBytes: Number.MAX_SAFE_INTEGER },
      { ...nodeAsset.binding, gzipBytes: -1 },
    ];
    const cases = [
      ...bindings.map(binding => ({ label: Object.keys(binding).find(key => binding[key] !== nodeAsset.binding[key]),
        layout, binding, bytes: nodeAsset.compressed, runtime: 'node' as const })),
      { label: 'corrupt-byte', layout, binding: nodeAsset.binding, bytes: corrupt, runtime: 'node' as const },
      { label: 'truncated-gzip', layout, binding: nodeAsset.binding, bytes: nodeAsset.compressed.slice(0, -1), runtime: 'node' as const },
      { label: 'changed-layout', layout: changedLayout, binding: nodeAsset.binding, bytes: nodeAsset.compressed, runtime: 'node' as const },
      { label: 'wrong-seed', layout: other, binding: nodeAsset.binding, bytes: nodeAsset.compressed, runtime: 'node' as const },
      { label: 'wrong-runtime', layout, binding: nodeAsset.binding, bytes: nodeAsset.compressed, runtime: 'browser' as const },
      { label: 'browser-on-Node-layout', layout, binding: browserAsset.binding, bytes: browserAsset.compressed, runtime: 'node' as const },
    ];
    const receipts: unknown[] = [];
    const observed = await measureCityCalls(async () => {
      for (const candidate of cases) {
        const result = await prepareCitySnapshot(candidate.layout, candidate.binding, candidate.bytes, candidate.runtime);
        expect(result.mode, candidate.label).toBe('pure-fallback');
        expect(result.reason).toBeTruthy();
        expectCacheIdentity(installed, readCitySnapshot(layout));
        expect(Object.values(citySnapshotFamilyPresence(other.seed))).toEqual(Array(15).fill(false));
        receipts.push({ label: candidate.label, result });
      }
      requireExactSnapshot(pure, readCitySnapshot(layout));
      return receipts;
    });
    expectNoPureCityCalls(observed.calls);
    r40Receipt('loader-rejection-existing', { cases: receipts, calls: Object.fromEntries(observed.calls) });
    clearCitySnapshot(layout.seed);
    for (const candidate of cases) {
      const result = await prepareCitySnapshot(candidate.layout, candidate.binding, candidate.bytes, candidate.runtime);
      expect(result.mode, candidate.label).toBe('pure-fallback');
      expect(Object.values(citySnapshotFamilyPresence(layout.seed))).toEqual(Array(15).fill(false));
      expect(Object.values(citySnapshotFamilyPresence(other.seed))).toEqual(Array(15).fill(false));
    }
  }, 30_000);

  it('rejects a rehashed late missing-family asset without partial publication', async () => {
    const payload = objectPayload(nodeAsset.envelope.payload);
    const root = payload.root;
    if (!Array.isArray(root) || root[0] !== 'r' || typeof root[1] !== 'number') throw new Error('R40_REAL_ROOT_REFERENCE');
    const node = payload.pool[root[1]]!;
    if (node[0] !== 0 || !node[3]) throw new Error('R40_REAL_SNAPSHOT_RECORD');
    const heroKey = payload.keys.indexOf('heroes');
    const pairs = [...node[3]];
    const offset = pairs.findIndex((value, index) => index % 2 === 0 && value === heroKey);
    expect(offset).toBeGreaterThanOrEqual(0);
    pairs[offset + 1] = ['u'];
    const broken = changedNode(payload, root[1], [0, node[1], node[2], pairs]);
    const envelope = { ...nodeAsset.envelope, payload: broken };
    const raw = new TextEncoder().encode(JSON.stringify(envelope));
    const gzip = new Uint8Array(gzipSync(raw));
    const binding = { ...nodeAsset.binding, payloadHash: broken.hash, payloadBytes: raw.byteLength,
      payloadSha256: byteHash(raw), gzipBytes: gzip.byteLength, gzipSha256: byteHash(gzip) };
    const layout = presentCityLayout(deriveCityLayout(424242));
    installCitySnapshot(layout, pure);
    const result = await prepareCitySnapshot(layout, binding, gzip, 'node');
    expect(result.mode).toBe('pure-fallback');
    expect(result.reason).toContain("required property 'heroes' cannot be null or undefined");
    expectCacheIdentity(pure, readCitySnapshot(layout));
    clearCitySnapshot(layout.seed);
    const empty = await prepareCitySnapshot(layout, binding, gzip, 'node');
    expect(empty.mode).toBe('pure-fallback');
    expect(Object.values(citySnapshotFamilyPresence(layout.seed))).toEqual(Array(15).fill(false));
  }, 30_000);
});

function objectPayload(value: unknown): CityGraphPayload {
  // This payload was already byte-bound and compared with the real pure graph.
  const result = value as CityGraphPayload;
  expect(result.version).toBe(2);
  expect(Array.isArray(result.keys)).toBe(true);
  expect(Array.isArray(result.pool)).toBe(true);
  return result;
}


describe('R40 invalid domain records before cache publication', () => {
  it.each(['trims', 'signs'] as const)('rejects short %s kind view with own length before any cache write', family => {
    const layout = presentCityLayout(deriveCityLayout(424242));
    const wire = mutateCityKindLengthWire(canonicalPayload, pure, family);
    const decoded = decodeCityGraph(wire) as SkyriverCitySnapshot;
    const view = decoded[family].kind;
    const lengthGetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), 'length')!.get!;
    expect(view).toBeInstanceOf(Uint8Array);
    expect(lengthGetter.call(view)).toBe(1);
    expect(Object.getOwnPropertyDescriptor(view, 'length')?.value).toBe(pure[family].count);
    expect(view[pure[family].count - 1]).toBeUndefined();
    const maps = identifyCityCacheMaps(layout, pure), rows = [];
    try {
      for (const state of ['existing', 'empty'] as const) {
        clearCitySnapshot(layout.seed);
        if (state === 'existing') installCitySnapshot(layout, pure);
        const before = readCitySnapshot(layout);
        const observation = observeCityCacheWrites(maps, () => installCitySnapshot(layout, decoded));
        const after = readCitySnapshot(layout), presence = citySnapshotFamilyPresence(layout.seed);
        const unchanged = state === 'empty' ? after === undefined && Object.values(presence).every(value => !value)
          : before !== undefined && after !== undefined && compareCityGraphs(before, after).equal
            && (Object.keys(before) as (keyof SkyriverCitySnapshot)[]).every(key =>
              key === 'massSeedOrdinals' || before[key] === after[key]);
        rows.push({ state, ...observation, unchanged, presence });
      }
    } finally {
      clearCitySnapshot(layout.seed);
      installCitySnapshot(layout, pure);
    }
    r40Receipt('domain-' + family + '-kind-own-length', { family, wireHash: wire.hash,
      intrinsicLength: lengthGetter.call(view), ownLength: view.length, count: pure[family].count, rows });
    expect(rows.every(row => row.rejected), JSON.stringify(rows)).toBe(true);
    expect(rows.every(row => row.writes.length === 0), JSON.stringify(rows)).toBe(true);
    expect(rows.every(row => row.unchanged), JSON.stringify(rows)).toBe(true);
  }, 30_000);

  it.each(CITY_DOMAIN_FAULTS)('rejects valid codec wire with $label before any cache write', fault => {
    const layout = presentCityLayout(deriveCityLayout(424242));
    const wire = mutateCityDomainWire(canonicalPayload, pure, fault);
    const decoded = decodeCityGraph(wire);
    expect(readDomainFault(decoded, pure, fault)).toBe(fault.replacement);
    const maps = identifyCityCacheMaps(layout, pure);
    const rows = [];
    try {
      for (const state of ['existing', 'empty'] as const) {
        clearCitySnapshot(layout.seed);
        if (state === 'existing') installCitySnapshot(layout, pure);
        const before = readCitySnapshot(layout);
        const observation = observeCityCacheWrites(maps, () => installCitySnapshot(layout, decoded));
        const after = readCitySnapshot(layout);
        const presence = citySnapshotFamilyPresence(layout.seed);
        const unchanged = state === 'empty' ? after === undefined && Object.values(presence).every(value => !value)
          : before !== undefined && after !== undefined && compareCityGraphs(before, after).equal
            && (Object.keys(before) as (keyof SkyriverCitySnapshot)[]).every(key =>
              key === 'massSeedOrdinals' || before[key] === after[key]);
        rows.push({ state, ...observation, unchanged, presence });
      }
    } finally {
      clearCitySnapshot(layout.seed);
      installCitySnapshot(layout, pure);
    }
    r40Receipt('domain-' + fault.label, { fault: fault.label, expectation: fault.expectation,
      wireHash: wire.hash, actualDecodedFault: readDomainFault(decoded, pure, fault), rows });
    expect(rows.every(row => row.rejected), JSON.stringify(rows)).toBe(true);
    expect(rows.every(row => row.writes.length === 0), JSON.stringify(rows)).toBe(true);
    expect(rows.every(row => row.unchanged), JSON.stringify(rows)).toBe(true);
  }, 30_000);
});


describe('R40 invalid domain assets through the real common loader', () => {
  it.each(CITY_DOMAIN_FAULTS.slice(0, 3))('rejects a rehashed real asset with $label before publication', async fault => {
    const layout = presentCityLayout(deriveCityLayout(424242));
    const asset = readActualCityAsset(join(__dirname, '..'), 'node');
    verifyActualAsset(join(__dirname, '..'), asset);
    const wire = mutateCityDomainWire(canonicalPayload, pure, fault);
    expect(readDomainFault(await decodeCityGraphAsync(wire), pure, fault)).toBe(fault.replacement);
    const envelope = { ...asset.envelope, payload: wire };
    const raw = new TextEncoder().encode(JSON.stringify(envelope));
    const compressed = new Uint8Array(gzipSync(raw));
    const binding = { ...asset.binding, payloadHash: wire.hash, payloadBytes: raw.byteLength,
      payloadSha256: byteHash(raw), gzipBytes: compressed.byteLength, gzipSha256: byteHash(compressed) };
    const maps = identifyCityCacheMaps(layout, pure);
    const rows = [];
    try {
      for (const state of ['existing', 'empty'] as const) {
        clearCitySnapshot(layout.seed);
        if (state === 'existing') installCitySnapshot(layout, pure);
        const before = readCitySnapshot(layout);
        const observed = await observeCityCacheWritesAsync(maps,
          () => prepareCitySnapshot(layout, binding, compressed, 'node'));
        const after = readCitySnapshot(layout), presence = citySnapshotFamilyPresence(layout.seed);
        const unchanged = state === 'empty' ? after === undefined && Object.values(presence).every(value => !value)
          : before !== undefined && after !== undefined && compareCityGraphs(before, after).equal
            && (Object.keys(before) as (keyof SkyriverCitySnapshot)[]).every(key =>
              key === 'massSeedOrdinals' || before[key] === after[key]);
        rows.push({ state, ...observed, unchanged, presence });
      }
    } finally {
      clearCitySnapshot(layout.seed);
      installCitySnapshot(layout, pure);
    }
    r40Receipt('domain-loader-' + fault.label, { fault: fault.label, binding, rows });
    expect(rows.every(row => !row.rejected && row.value?.mode === 'pure-fallback'), JSON.stringify(rows)).toBe(true);
    expect(rows.every(row => row.writes.length === 0), JSON.stringify(rows)).toBe(true);
    expect(rows.every(row => row.unchanged), JSON.stringify(rows)).toBe(true);
  }, 30_000);
});
