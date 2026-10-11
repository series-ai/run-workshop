import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as C from '../src/render/city';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import { CANYON_LOOP_LENGTH_M } from '../src/render/canyonWarp';
import {
  overlapVolume, solidFromMatrix, physicalMountFailures, supportedBoardRoot,
  canonicalPhysicalScene, physicalSignAudit, buildingMembershipFailures,
  uploadedBoards, uploadedSolids,
  mountedSpacingFailures, type MountedReservation,
  heroBoardOverlaps,
  normalTransformResidual,
  type Board, type Segment, type PhysicalSolid, type CanonicalSignPoint,
} from './support/r37SignOracle';

const SEEDS = [424242, 0, 2147483647, 4294967295, 20240917] as const;
const GAME = join(__dirname, '..');
const sourceCitySha256 = () => createHash('sha256').update(readFileSync(join(GAME, 'src/render/city.ts'))).digest('hex');
const CITY_SHA_AT_IMPORT = sourceCitySha256();

function worldPoint(owner: C.SkyriverTrimOwner, point: CanonicalSignPoint) {
  const out = C.warpBoxPoint(owner, point.x, point.z, { x: 0, z: 0, heading: 0 });
  return [out.x, point.y, out.z] as const;
}

function realScene(seed: number) {
  const layout = presentCityLayout(deriveCityLayout(seed));
  const signs = C.deriveNeonSigns(layout);
  const rawSolids = C.deriveSignMountSolids(layout);
  const scene = canonicalPhysicalScene(signs, rawSolids, C.placeNeonSign, worldPoint);
  return { layout, signs, rawSolids, ...scene };
}

function identityHash(signs: C.SkyriverNeonSigns): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify([signs.count, signs.heroCount, signs.ordinaryCount]));
  for (const key of ['sw', 'sh', 'seedValue', 'color', 'rootHalfWidthM'] as const) {
    const values = signs[key].slice(0, signs.count * (key === 'color' ? 3 : 1));
    const buffer = Buffer.alloc(values.length * 4);
    values.forEach((value, index) => buffer.writeFloatLE(value, index * 4));
    hash.update(buffer);
  }
  hash.update(signs.kind.slice(0, signs.count));
  const anchors = Buffer.alloc(signs.count * 8);
  signs.anchorV.slice(0, signs.count).forEach((value, index) => anchors.writeDoubleLE(value, index * 8));
  hash.update(anchors);
  hash.update(JSON.stringify([signs.faceId, signs.buildingId, signs.compositionId]));
  return hash.digest('hex');
}

function membership(scene: ReturnType<typeof realScene>) {
  const faces = new Map(C.deriveFacadeFaces(scene.layout).map(face => [face.id, face]));
  const masses = C.deriveCityMasses(scene.layout), trims = C.deriveCityTrims(scene.layout);
  return scene.mounts.flatMap((mount, sign) => {
    const faceId = scene.signs.faceId[sign];
    const face = faceId == null ? undefined : faces.get(faceId);
    const mass = mount.host.kind === 'mass' ? masses[mount.host.index] : undefined;
    const host = mount.host.kind === 'mass' ? mass === undefined ? undefined : {
      materialOwner: mass.materialOwner ?? mass.building, anchorV: mass.anchorV ?? mass.z,
    } : trims.owner[mount.host.index];
    if (!face || !host || face.owner.materialOwner === undefined || host.materialOwner === undefined) {
      return [{ sign, failures: ['canonical-building-key-missing'] }];
    }
    const failures = buildingMembershipFailures({ buildingId: scene.signs.buildingId[sign]!,
      materialOwner: face.owner.materialOwner, anchorV: face.owner.anchorV },
    { materialOwner: host.materialOwner, anchorV: host.anchorV }, face.buildingId);
    return failures.length ? [{ sign, failures }] : [];
  });
}

interface SpacingFace { readonly id: string; readonly side: -1 | 1; readonly planeAxis: 'x' | 'z'; }

function mountedSpacing(signs: C.SkyriverNeonSigns, sourceFaces: readonly SpacingFace[]) {
  const faces = new Map(sourceFaces.map(face => [face.id, face]));
  const rows: MountedReservation[] = signs.mount.map((mount, sign) => {
    const face = faces.get(signs.faceId[sign]!);
    if (!face) throw new Error('R37_SOURCE_SPACING_FACE');
    const halfAlong = face.planeAxis === 'z' ? 4 : mount.mode === 'blade'
      ? signs.rootHalfWidthM[sign]! : signs.sw[sign]! / 2;
    return { sign, side: face.side, role: sign < signs.heroCount ? 'hero' : 'ordinary',
      compositionId: signs.compositionId[sign]!,
      u0: signs.cz[sign]! - halfAlong, u1: signs.cz[sign]! + halfAlong,
      y0: signs.cy[sign]! - signs.sh[sign]! / 2,
      y1: signs.cy[sign]! + signs.sh[sign]! / 2, heightM: signs.sh[sign]! };
  });
  return mountedSpacingFailures(rows, CANYON_LOOP_LENGTH_M);
}

function writeReceipt(name: string, value: unknown): void {
  const directory = process.env.R37_RECEIPT_DIR;
  if (!directory) return;
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, name + '.json'), JSON.stringify(value, null, 2) + '\n');
}

function jsonValue(value: unknown): unknown {
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) return Array.from(value as Float32Array);
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item)]));
  return value;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('R37_OBJECT:' + label);
  return value as Record<string, unknown>;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('R37_FINITE:' + label);
  return value;
}

function numbers(value: unknown, label: string): number[] {
  if (!Array.isArray(value)) throw new Error('R37_ARRAY:' + label);
  return value.map(item => finite(item, label));
}

function ids(value: unknown, label: string): (string | null)[] {
  if (!Array.isArray(value) || !value.every(item => item === null || typeof item === 'string')) throw new Error('R37_IDS:' + label);
  return value;
}

function readOwner(value: unknown): C.SkyriverTrimOwner {
  const row = object(value, 'owner');
  const anchor = row.yawAnchor === undefined ? undefined : object(row.yawAnchor, 'yawAnchor');
  return { x: finite(row.x, 'owner.x'), z: finite(row.z, 'owner.z'), width: finite(row.width, 'owner.width'),
    depth: finite(row.depth, 'owner.depth'), anchorV: finite(row.anchorV, 'owner.anchorV'),
    materialOwner: finite(row.materialOwner, 'owner.materialOwner'),
    ...(row.yawRad === undefined ? {} : { yawRad: finite(row.yawRad, 'owner.yawRad') }),
    ...(anchor === undefined ? {} : { yawAnchor: { x: finite(anchor.x, 'anchor.x'), z: finite(anchor.z, 'anchor.z') } }) };
}

function readPoint(value: unknown): C.SkyriverSignPoint {
  const row = object(value, 'point');
  return { x: finite(row.x, 'point.x'), y: finite(row.y, 'point.y'), z: finite(row.z, 'point.z') };
}

function readMount(value: unknown): C.SkyriverSignMount {
  const row = object(value, 'mount'), host = object(row.host, 'mount.host');
  if (row.mode !== 'panel' && row.mode !== 'blade') throw new Error('R37_MOUNT_MODE');
  if (host.kind !== 'mass' && host.kind !== 'trim') throw new Error('R37_HOST_KIND');
  if (!Array.isArray(row.edge) || row.edge.length !== 2 || !Array.isArray(row.root) || row.root.length !== 2) throw new Error('R37_EDGE_TUPLE');
  const index = finite(host.index, 'host.index'), edgeIndex = finite(row.edgeIndex, 'edgeIndex');
  if (!Number.isSafeInteger(index) || index < 0 || !Number.isSafeInteger(edgeIndex)) throw new Error('R37_HOST_INDEX');
  return { mode: row.mode, host: { kind: host.kind, index }, edgeIndex,
    edge: [readPoint(row.edge[0]), readPoint(row.edge[1])], root: [readPoint(row.root[0]), readPoint(row.root[1])] };
}

function readCapturedSigns(value: unknown): C.SkyriverNeonSigns {
  const row = object(value, 'signs');
  if (!Array.isArray(row.owner) || !Array.isArray(row.mount)) throw new Error('R37_OWNER_AND_MOUNT_ARRAYS');
  const count = finite(row.count, 'sign count');
  if (!Number.isSafeInteger(count) || count < 1 || row.owner.length !== count || row.mount.length !== count) throw new Error('R37_SIGN_COUNT');
  const array = (key: string) => new Float32Array(numbers(row[key], key));
  const kinds = numbers(row.kind, 'kind');
  if (!kinds.every(kind => Number.isInteger(kind) && kind >= 0 && kind <= 255)) throw new Error('R37_SIGN_KIND');
  const signs: C.SkyriverNeonSigns = { seed: finite(row.seed, 'seed'), count,
    cx: array('cx'), cy: array('cy'), cz: array('cz'), nx: array('nx'), nz: array('nz'), sw: array('sw'), sh: array('sh'),
    color: array('color'), kind: new Uint8Array(kinds), seedValue: array('seedValue'), rootHalfWidthM: array('rootHalfWidthM'),
    anchorV: new Float64Array(numbers(row.anchorV, 'anchorV')), faceId: ids(row.faceId, 'faceId'),
    buildingId: ids(row.buildingId, 'buildingId'), compositionId: ids(row.compositionId, 'compositionId'),
    ordinaryCount: finite(row.ordinaryCount, 'ordinaryCount'), heroCount: finite(row.heroCount, 'heroCount'),
    acceptedByLoopSection: numbers(row.acceptedByLoopSection, 'acceptedByLoopSection'),
    owner: row.owner.map(readOwner), mount: row.mount.map(readMount) };
  for (const key of ['cx', 'cy', 'cz', 'nx', 'nz', 'sw', 'sh', 'kind', 'seedValue', 'rootHalfWidthM', 'anchorV'] as const) {
    if (signs[key].length < count) throw new Error('R37_SOURCE_ATTRIBUTE_LENGTH:' + key);
  }
  if (signs.color.length < count * 3 || [signs.faceId, signs.buildingId, signs.compositionId].some(values => values.length !== count)) throw new Error('R37_SOURCE_IDENTITY_LENGTH');
  return signs;
}

function readJson(file: string): Record<string, unknown> {
  return object(JSON.parse(readFileSync(file, 'utf8')), file);
}

function attributeHash(value: unknown): string {
  const attributes = object(value, 'attributes'), hash = createHash('sha256');
  for (const key of ['aColor', 'aKind', 'aSeed', 'aAtlas', 'aDistrictTint']) {
    const row = object(attributes[key], key), values = numbers(row.values, key);
    const buffer = Buffer.alloc(values.length * 4);
    values.forEach((value, index) => buffer.writeFloatLE(value, index * 4));
    hash.update(buffer);
  }
  return hash.digest('hex');
}

// These values come from the bound production upload before the R37 repair.
const CLIPPING_WITNESSES = [
  {
    sign: 3,
    board: { centre: [2101.239501953125, 536.6800537109375, -2250.1064453125], normal: [-0.9191598296165466, 0.39388471841812134], size: [70, 305] } as Board,
    matrix: [11.422657012939453, 0, 26.655635833740234, 0, 0, 79, 0, 0, -59.74538803100586, 0, 25.602508544921875, 0, 2056.61962890625, 400.5, -2279.290771484375, 1],
    volume: 113.86938568901343,
  },
  {
    sign: 63,
    board: { centre: [581.196044921875, 1179.094970703125, -1849.93896484375], normal: [0.9978547096252441, -0.06546732783317566], size: [17.399999618530273, 135] } as Board,
    matrix: [0.7856079339981079, 0, 11.97425651550293, 0, 0, 5, 0, 0, -99.27837371826172, 0, 6.513463020324707, 0, 612.132080078125, 1158.16015625, -1847.458984375, 1],
    volume: 20.40008010265753,
  },
  {
    sign: 63,
    board: { centre: [581.196044921875, 1179.094970703125, -1849.93896484375], normal: [0.9978547096252441, -0.06546732783317566], size: [17.399999618530273, 135] } as Board,
    matrix: [0.7856079339981079, 0, 11.97425651550293, 0, 0, 6.300000190734863, 0, 0, -99.27837371826172, 0, 6.513463020324707, 0, 612.132080078125, 1210.16015625, -1847.458984375, 1],
    volume: 25.704101707549786,
  },
] as const;

describe('R37 independent physical sign oracle', () => {
  it.each(CLIPPING_WITNESSES)('detects real baseline penetration for sign $sign', witness => {
    const volume = overlapVolume(witness.board, solidFromMatrix(witness.matrix));
    expect(volume).toBeGreaterThan(0);
    expect(volume).toBeCloseTo(witness.volume, 7);
  });

  it('accepts exact roof contact and rejects real penetration without a tolerance band', () => {
    const witness = CLIPPING_WITNESSES[0];
    const solid = solidFromMatrix(witness.matrix);
    const contact: Board = {
      ...witness.board,
      centre: [witness.matrix[12], solid.high + witness.board.size[1] / 2, witness.matrix[14]],
    };
    expect(overlapVolume(contact, solid)).toBe(0);
    expect(overlapVolume({ ...contact, centre: [contact.centre[0], contact.centre[1] - 0.25, contact.centre[2]] }, solid)).toBeGreaterThan(0);
  });
  it('accepts a supported finite root when a real panel overhangs the ledge', () => {
    const box = solidFromMatrix(CLIPPING_WITNESSES[0].matrix);
    const solid: PhysicalSolid = { ...box, host: { kind: 'mass', index: 287 } };
    const p = box.footprint[0]!, q = box.footprint[1]!;
    const dx = q[0] - p[0], dz = q[1] - p[1], length = Math.hypot(dx, dz);
    const normal = [dz / length, -dx / length] as const;
    const edge: Segment = [[p[0], box.high, p[1]], [q[0], box.high, q[1]]];
    const board: Board = { centre: [(p[0] + q[0]) / 2 + normal[0] * 0.2,
      box.high + 40, (p[1] + q[1]) / 2 + normal[1] * 0.2], normal, size: [length * 2, 80] };
    const mount = { mode: 'panel' as const, host: solid.host, edgeIndex: 0, edge, root: supportedBoardRoot(board, 'panel', edge) };
    expect(overlapVolume(board, solid)).toBe(0);
    expect(physicalMountFailures(board, mount, [solid]).failures).toEqual([]);
    const offEdge: Board = { ...board, centre: [board.centre[0], board.centre[1] + 3.1, board.centre[2]] };
    expect(physicalMountFailures(offEdge, mount, [solid]).failures).toContain('root-off-finite-edge');
    const detachedRoot: Segment = [[mount.root[0][0], mount.root[0][1] + 10, mount.root[0][2]],
      [mount.root[1][0], mount.root[1][1] + 10, mount.root[1][2]]];
    expect(physicalMountFailures(board, { ...mount, root: detachedRoot }, [solid]).failures).toContain('metadata-root-off-board');
  });

  it('rejects a host with another building key even in the same coordinate frame', () => {
    const source = { buildingId: 'tower:630.00:-4480.00', materialOwner: 0.304569182175328, anchorV: -4480 };
    expect(buildingMembershipFailures(source, source, source.buildingId)).toEqual([]);
    expect(buildingMembershipFailures(source, { ...source, materialOwner: 0.9 }, source.buildingId)).toContain('host-material-owner-mismatch');
    expect(buildingMembershipFailures(source, { ...source, anchorV: -3200 }, source.buildingId)).toContain('host-building-anchor-mismatch');
    expect(buildingMembershipFailures(source, source, 'tower:630.00:-3200.00')).toContain('source-building-mismatch');
  });
  it('keeps real baseline row cells distinct and rejects a same-row board collapse', () => {
    const first: Board = { centre: [673.4996948242188, 657.0195922851562, -2896.798583984375],
      normal: [-1, -2.0144827036420836e-14], size: [90, 468] };
    const second: Board = { ...first, centre: [635.4996948242188, 557.0195922851562, -2896.798583984375] };
    const compositions = ['hero-row-0', 'hero-row-0'];
    expect(heroBoardOverlaps([first, second], compositions, 2)).toEqual([]);
    expect(heroBoardOverlaps([first, { ...second, centre: first.centre }], compositions, 2)[0]!.volumeM3).toBeGreaterThan(0);
  });
  it('rejects the measured default candidate overlap of hero row cells 37 and 39', () => {
    const collapsed: Board = { centre: [2628.069580078125, 1678.843994140625, -1087.125],
      normal: [-0.383924663066864, -0.9233644008636475], size: [90, 468] };
    const overlaps = heroBoardOverlaps([collapsed, collapsed], ['hero-row-3', 'hero-row-3'], 2);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]!.volumeM3).toBeCloseTo(16848, 6);
  });
  it('accepts transform round-off near zero and rejects a changed uploaded normal', () => {
    const actual = [1, -1.8947806851624636e-14] as const;
    const expected = [1, -1.93918960614747e-14] as const;
    expect(normalTransformResidual(actual, expected, [1, 0]).pass).toBe(true);
    expect(normalTransformResidual([Math.cos(1e-5), Math.sin(1e-5)], expected, [1, 0]).pass).toBe(false);
    expect(normalTransformResidual([1 + 3 * 2 ** -23, actual[1]], expected, [1, 0]).pass).toBe(false);
  });
});

describe('R37 real full-loop sign mounts', () => {
  it.each(SEEDS)('clears every actual drawn slab and mounts to its own finite ledge at seed %i', seed => {
    const scene = realScene(seed);
    const audit = physicalSignAudit(scene.boards, scene.mounts, scene.solids);
    const buildingFailures = membership(scene);
    const spacing = mountedSpacing(scene.signs, C.deriveFacadeFaces(scene.layout));
    const heroOverlaps = heroBoardOverlaps(scene.boards, scene.signs.compositionId, scene.signs.heroCount);
    writeReceipt('cpu-' + seed, { seed, sourceCitySha256: CITY_SHA_AT_IMPORT,
      currentCitySha256: sourceCitySha256(), audit, buildingFailures, spacing, heroOverlaps });
    if (seed === 424242) writeReceipt('mount-source', { seed, sourceCitySha256: CITY_SHA_AT_IMPORT,
      solids: scene.rawSolids, signs: jsonValue(scene.signs) });
    expect(audit.pairsConsidered).toBe(scene.signs.count * scene.solids.length);
    expect(audit.overlaps, JSON.stringify(audit.overlaps)).toEqual([]);
    expect(audit.roots.filter(root => root.failures.length), 'finite physical roots').toEqual([]);
    expect(audit.maxRootDistanceM).toBeLessThanOrEqual(3);
    expect(buildingFailures, 'same-building hosts').toEqual([]);
    expect(spacing.failures, 'complete mounted composition unions').toEqual([]);
    expect(heroOverlaps, 'distinct readable hero cells').toEqual([]);
    expect(scene.signs.heroCount).toBe(42);
    expect(scene.signs.count).toBe(scene.signs.heroCount + scene.signs.ordinaryCount);
    const sections = Array.from({ length: 8 }, () => 0);
    for (let sign = scene.signs.heroCount; sign < scene.signs.count; sign += 1) {
      const z = scene.signs.cz[sign]!;
      const wrapped = ((z + CANYON_LOOP_LENGTH_M / 2) % CANYON_LOOP_LENGTH_M + CANYON_LOOP_LENGTH_M) % CANYON_LOOP_LENGTH_M;
      sections[Math.min(7, Math.floor(wrapped / CANYON_LOOP_LENGTH_M * 8))]! += 1;
    }
    expect(sections.filter(count => count > 0).length).toBeGreaterThanOrEqual(6);
    expect(sections.reduce((sum, count) => sum + count, 0)).toBe(scene.signs.ordinaryCount);
    expect(scene.signs.acceptedByLoopSection.filter(count => count > 0).length).toBeGreaterThanOrEqual(6);
    expect(scene.signs.acceptedByLoopSection.reduce((sum, count) => sum + count, 0)).toBe(scene.signs.ordinaryCount);
  }, 180000);

  it('preserves the bound original sign identities and full artwork inventory', () => {
    const scene = realScene(424242);
    expect(scene.signs.count).toBe(313);
    expect(scene.signs.heroCount).toBe(42);
    expect(scene.signs.ordinaryCount).toBe(271);
    expect(scene.solids).toHaveLength(20684);
    expect(scene.signs.acceptedByLoopSection).toEqual([17, 40, 30, 36, 10, 82, 34, 22]);
    // The frozen CPU source anchor differs from the frozen browser source at slot 7.
    expect(identityHash(scene.signs)).toBe('e262f3e635495911b5a251dbe953b48c4f63217bd0a78e6c5ecae4a195395b8e');
    expect(scene.signs.compositionId[3]).toBe('hero-3');
    expect(scene.signs.compositionId[63]).toBe('ordinary-75');
    const bottoms = scene.boards.map(board => board.centre[1] - board.size[1] / 2);
    expect(bottoms.filter(bottom => bottom >= 40).length).toBeGreaterThanOrEqual(305);
    expect(Math.min(...bottoms)).toBeGreaterThanOrEqual(11.260398864746094);
    const brand = scene.mounts[41]!;
    const host = scene.rawSolids.find(solid => solid.host.kind === brand.host.kind && solid.host.index === brand.host.index)!;
    expect(host.owner.anchorV).toBe(4240.625);
    expect(host.owner.materialOwner).toBe(0.6419789714345825);
  }, 180000);

  it('rejects penetration and off-edge movement of a real final held hero board', () => {
    const scene = realScene(424242), board = scene.boards[3]!, mount = scene.mounts[3]!;
    const host = scene.solids.find(solid => solid.host.kind === mount.host.kind && solid.host.index === mount.host.index)!;
    const penetrated: Board = { ...board, centre: [
      host.footprint.reduce((sum, point) => sum + point[0], 0) / host.footprint.length,
      (host.low + host.high) / 2,
      host.footprint.reduce((sum, point) => sum + point[1], 0) / host.footprint.length,
    ] };
    expect(overlapVolume(penetrated, host)).toBeGreaterThan(0);
    const moved: Board = { ...board, centre: [board.centre[0], board.centre[1] + 3.1, board.centre[2]] };
    expect(physicalMountFailures(moved, mount, scene.solids).failures).toContain('root-off-finite-edge');
  }, 180000);
});

describe('R37 actual browser upload', () => {
  it.skipIf(!process.env.R37_UPLOADED_PATH)('grades every uploaded board and slab with the same independent oracle', () => {
    const file = process.env.R37_UPLOADED_PATH!;
    const uploaded = readJson(file), source = readJson(join(dirname(file), 'sign-source.json'));
    expect(source.sourceCitySha256).toBe(sourceCitySha256());
    const signs = readCapturedSigns(source.signs);
    expect(signs.seed).toBe(424242);
    expect(identityHash(signs)).toBe('6a7cae0e8b3e0cd700b64302b271060fd694f54e41f31beb1d026bd193e48ce5');
    expect(signs.count).toBe(313); expect(signs.heroCount).toBe(42); expect(signs.ordinaryCount).toBe(271);
    expect(signs.acceptedByLoopSection).toEqual([17, 40, 30, 36, 10, 82, 34, 22]);
    const worldMatrices = object(uploaded.batchWorldMatrices, 'batch world matrices');
    for (const key of ['towers', 'trims', 'signs']) expect(numbers(worldMatrices[key], key)).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const signUpload = object(uploaded.signs, 'uploaded signs');
    expect(signUpload.count).toBe(signs.count);
    expect(numbers(signUpload.sourceIndices, 'sign source indices')).toEqual(Array.from({ length: signs.count }, (_, index) => index));
    expect(attributeHash(signUpload.attributes)).toBe('268a8d0e2aa5cd2f11dbd292a1176443a25bf522158911865c837acc42179ea2');
    const boards = uploadedBoards(numbers(signUpload.centres, 'centres'), numbers(signUpload.normals, 'normals'), numbers(signUpload.sizes, 'sizes'), signs.count);
    const owners = object(source.drawSourceOwners, 'draw owners');
    const hostOwners = new Map<string, C.SkyriverTrimOwner>();
    const solids = (['towers', 'trims'] as const).flatMap(key => {
      const batch = object(uploaded[key], key), kind = key === 'towers' ? 'mass' : 'trim';
      const indices = numbers(batch.sourceIndices, key + '.sourceIndices');
      if (batch.count !== indices.length || !Array.isArray(owners[key]) || owners[key].length !== indices.length) throw new Error('R37_DRAW_SLOT_COUNT:' + key);
      for (const [slot, value] of owners[key].entries()) {
        const row = object(value, key + '.owner');
        expect(row.index, key + ':' + slot + ':actual-source-index').toBe(indices[slot]);
        hostOwners.set(kind + ':' + indices[slot], readOwner(row.owner));
      }
      return uploadedSolids(numbers(batch.matrices, key + '.matrices'), indices, kind);
    });
    expect(solids).toHaveLength(20684);
    const rawSolids = solids.map(solid => ({ host: solid.host, footprint: solid.footprint, y0: solid.low, y1: solid.high }));
    const canonical = canonicalPhysicalScene(signs, rawSolids, C.placeNeonSign, worldPoint);
    const normalWitnesses = [];
    for (const [index, board] of boards.entries()) {
      expect(board.size).toEqual([signs.sw[index], signs.sh[index]]);
      expect(Math.hypot(...board.centre.map((value, axis) => value - canonical.boards[index]!.centre[axis]!))).toBeLessThan(0.05);
      const witness = normalTransformResidual(board.normal, canonical.boards[index]!.normal, [signs.nx[index]!, signs.nz[index]!]);
      normalWitnesses.push({ sign: index, ...witness });
      expect(witness.pass, JSON.stringify(normalWitnesses.at(-1))).toBe(true);
    }
    if (!Array.isArray(source.signSourceFaces) || source.signSourceFaces.length !== signs.count) throw new Error('R37_BROWSER_SOURCE_FACES');
    const buildingFailures = source.signSourceFaces.flatMap((value, sign) => {
      const face = object(value, 'source face'), owner = readOwner(face.owner);
      expect(face.id).toBe(sign); expect(face.faceId).toBe(signs.faceId[sign]); expect(face.buildingId).toBe(signs.buildingId[sign]);
      const mount = signs.mount[sign]!, host = hostOwners.get(mount.host.kind + ':' + mount.host.index);
      if (!host) throw new Error('R37_BROWSER_SELECTED_HOST');
      const failures = buildingMembershipFailures({ buildingId: signs.buildingId[sign]!,
        materialOwner: owner.materialOwner!, anchorV: owner.anchorV },
      { materialOwner: host.materialOwner!, anchorV: host.anchorV }, String(face.buildingId));
      return failures.length ? [{ sign, failures }] : [];
    });
    const audit = physicalSignAudit(boards, canonical.mounts, solids);
    const heroOverlaps = heroBoardOverlaps(boards, signs.compositionId, signs.heroCount);
    if (!Array.isArray(source.faces)) throw new Error('R37_BROWSER_SPACING_FACES');
    const faces: SpacingFace[] = source.faces.map(value => {
      const row = object(value, 'face');
      if (typeof row.id !== 'string' || (row.side !== -1 && row.side !== 1)
        || (row.planeAxis !== 'x' && row.planeAxis !== 'z')) throw new Error('R37_BROWSER_SPACING_FACE');
      return { id: row.id, side: row.side, planeAxis: row.planeAxis };
    });
    const spacing = mountedSpacing(signs, faces);
    writeReceipt('uploaded-audit', { file, sourceCitySha256: sourceCitySha256(),
      uploadedSha256: createHash('sha256').update(readFileSync(file)).digest('hex'), audit, buildingFailures, heroOverlaps, spacing, normalWitnesses });
    expect(audit.overlaps).toEqual([]);
    expect(audit.roots.filter(root => root.failures.length)).toEqual([]);
    expect(audit.maxRootDistanceM).toBeLessThanOrEqual(3);
    expect(buildingFailures).toEqual([]);
    expect(heroOverlaps).toEqual([]);
    expect(spacing.failures).toEqual([]);
    const bottoms = boards.map(board => board.centre[1] - board.size[1] / 2);
    expect(bottoms.filter(bottom => bottom >= 40).length).toBeGreaterThanOrEqual(305);
    expect(Math.min(...bottoms)).toBeGreaterThanOrEqual(11.260398864746094);
  }, 180000);
});
