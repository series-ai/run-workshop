import { deflateSync, inflateSync } from 'fflate';
import { canonicalParse, canonicalStringify } from '@series-inc/rundot-syncplay/browser';
import type { YardPhysicsWorldState } from './physics';
import { FLOODLIGHT_LENSES } from './floodlights';
import { MAX_PLAYERS } from './constants';
import { isYardMaterial } from './materials';
import { CRATE_ARROWS, type CrateFace, type CrateFaces, type YardBody, type YardState } from './state';

const MAGIC = 0x57594134; // "WYA4": each body carries a material, crate bodies carry a bay and two faces, and the state has lamps and impacts.
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** `Omit` that keeps each variant of a union, so a crate body keeps its bay and faces. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type HeaderBody = DistributiveOmit<YardBody, 'voxels'> & { readonly voxelBytes: number };
type HeaderWorld = Omit<YardPhysicsWorldState, 'fluidInteractions'> & { readonly checkpointBytes: number };
type Header = Omit<YardState, 'bodies' | 'world'> & {
  readonly bodies: readonly HeaderBody[];
  readonly world: HeaderWorld;
};

/**
 * Run-length voxels: repeated (material u8, run length as unsigned LEB128).
 * Yard grids are mostly long runs, so this is 10 to 50 times smaller than raw.
 */
export function encodeVoxelRuns(voxels: Uint8Array): Uint8Array {
  const out: number[] = [];
  let index = 0;
  while (index < voxels.length) {
    const value = voxels[index]!;
    let run = 1;
    while (index + run < voxels.length && voxels[index + run] === value) run += 1;
    out.push(value);
    for (let rest = run; ; rest >>>= 7) {
      if (rest < 0x80) { out.push(rest); break; }
      out.push((rest & 0x7f) | 0x80);
    }
    index += run;
  }
  return Uint8Array.from(out);
}

export function decodeVoxelRuns(runs: Uint8Array, length: number): Uint8Array {
  const voxels = new Uint8Array(length);
  let offset = 0;
  let index = 0;
  while (index < runs.length) {
    const value = runs[index++]!;
    let run = 0;
    for (let shift = 0; ; shift += 7) {
      if (index >= runs.length) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: truncated voxel run');
      const byte = runs[index++]!;
      run += (byte & 0x7f) * 2 ** shift;
      if (byte < 0x80) break;
    }
    if (offset + run > length) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: voxel runs overflow');
    voxels.fill(value, offset, offset + run);
    offset += run;
  }
  if (offset !== length) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: voxel runs short');
  return voxels;
}

/**
 * Voxel grids are immutable once made (cuts and fractures make new grids), so
 * each grid is encoded once. Rollback checksums encode the full state every
 * tick; without this cache that cost grows with every prop in the yard.
 */
const runCache = new WeakMap<Uint8Array, Uint8Array>();
function voxelRuns(voxels: Uint8Array): Uint8Array {
  let runs = runCache.get(voxels);
  if (!runs) {
    runs = encodeVoxelRuns(voxels);
    runCache.set(voxels, runs);
  }
  return runs;
}

/** State and native checkpoint bytes for saves and late joins. */
export interface EncodedYard {
  readonly state: YardState;
  readonly checkpoint: Uint8Array;
}

/**
 * Layout: u32 magic, u32 header length, canonical JSON header (everything but
 * voxel and checkpoint bytes), then the native checkpoint, then each body's
 * run-length voxels in header order. Canonical JSON keeps key order stable.
 * Fluid interactions are not encoded: each step makes them again.
 */
function encodeRawState({ state, checkpoint }: EncodedYard): Uint8Array {
  const header: Header = {
    ...state,
    world: {
      frame: state.world.frame,
      bodies: state.world.bodies,
      bodyIds: state.world.bodyIds,
      portalStraddlers: state.world.portalStraddlers,
      checkpointBytes: checkpoint.byteLength,
    },
    bodies: state.bodies.map(({ voxels, ...rest }) => ({ ...rest, voxelBytes: voxelRuns(voxels).byteLength })),
  };
  const headerBytes = encoder.encode(canonicalStringify(header));
  const total = 8 + headerBytes.byteLength + checkpoint.byteLength
    + state.bodies.reduce((sum, body) => sum + voxelRuns(body.voxels).byteLength, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, MAGIC);
  view.setUint32(4, headerBytes.byteLength);
  out.set(headerBytes, 8);
  let offset = 8 + headerBytes.byteLength;
  out.set(checkpoint, offset);
  offset += checkpoint.byteLength;
  for (const body of state.bodies) {
    const runs = voxelRuns(body.voxels);
    out.set(runs, offset);
    offset += runs.byteLength;
  }
  return out;
}

const bodyChecksumCache = new WeakMap<YardBody, Uint8Array>();

function checksumBody(body: YardBody): Uint8Array {
  const cached = bodyChecksumCache.get(body);
  if (cached) return cached;
  const { voxels, ...metadata } = body;
  const header = encoder.encode(canonicalStringify(metadata));
  const runs = voxelRuns(voxels);
  const bytes = new Uint8Array(4 + header.length + runs.length);
  new DataView(bytes.buffer).setUint32(0, header.length);
  bytes.set(header, 4);
  bytes.set(runs, 4 + header.length);
  bodyChecksumCache.set(body, bytes);
  return bytes;
}

/** Keep all game fields. Reuse immutable body bytes between ticks. */
export function encodeChecksumState({ state, checkpoint }: EncodedYard): Uint8Array {
  const { bodies, world, ...game } = state;
  const header = encoder.encode(canonicalStringify({
    ...game,
    world: {
      frame: world.frame, bodies: world.bodies, bodyIds: world.bodyIds,
      portalStraddlers: world.portalStraddlers,
    },
  }));
  const encodedBodies = bodies.map(checksumBody);
  const size = 12 + header.length + checkpoint.length
    + encodedBodies.reduce((total, body) => total + 4 + body.length, 0);
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  view.setUint32(0, header.length);
  view.setUint32(4, checkpoint.length);
  view.setUint32(8, bodies.length);
  out.set(header, 12);
  out.set(checkpoint, 12 + header.length);
  let offset = 12 + header.length + checkpoint.length;
  for (const body of encodedBodies) {
    view.setUint32(offset, body.length);
    out.set(body, offset + 4);
    offset += 4 + body.length;
  }
  return out;
}

/** A decoded crate face must have one of the shapes the renderer draws. */
function isCrateFace(value: unknown): value is CrateFace {
  if (typeof value !== 'object' || value === null || !('tone' in value)) return false;
  if (value.tone === 'dark') return Object.keys(value).length === 1;
  if (value.tone !== 'light' || !('arrow' in value)) return false;
  return CRATE_ARROWS.some((arrow) => arrow === value.arrow) && Object.keys(value).length === 2;
}

/** Two crate faces and a frame tone, each with a shape that the renderer draws. */
function isCrateFaces(value: unknown): value is CrateFaces {
  if (typeof value !== 'object' || value === null || !('east' in value) || !('south' in value) || !('frame' in value)) return false;
  if (!isCrateFace(value.east) || !isCrateFace(value.south) || Object.keys(value).length !== 3) return false;
  // The frame follows one of the two faces. It can never take a tone from neither.
  return value.frame === value.east.tone || value.frame === value.south.tone;
}

/** The crate fields of a decoded body, after the check has passed. */
export type CheckedCrateFields =
  | { readonly storageBay: 'storage' | 'returns'; readonly crateFaces: CrateFaces; readonly renderModel?: 'shipping-crate' }
  | { readonly storageBay?: undefined; readonly crateFaces?: undefined; readonly renderModel?: undefined };

/**
 * Checks the crate fields of one decoded body. The body is untrusted until this runs.
 * A body with a bay has faces. A body with faces has a bay. A shipping crate has both.
 */
export function assertCrateBodyFields(body: unknown): asserts body is CheckedCrateFields {
  if (typeof body !== 'object' || body === null) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: body is not an object');
  const bay = 'storageBay' in body ? body.storageBay : undefined;
  const faces = 'crateFaces' in body ? body.crateFaces : undefined;
  const id = 'id' in body ? String(body.id) : '?';
  const renderModel = 'renderModel' in body ? body.renderModel : undefined;
  if (renderModel !== undefined && renderModel !== 'shipping-crate') {
    throw new Error(`WRECK_YARD_STATE_BYTES_INVALID: render model ${String(renderModel)} of ${id}`);
  }
  if (bay === undefined && faces === undefined) {
    if (renderModel === 'shipping-crate') throw new Error(`WRECK_YARD_STATE_BYTES_INVALID: shipping crate ${id} has no bay`);
    return;
  }
  if (bay !== 'storage' && bay !== 'returns') throw new Error(`WRECK_YARD_STATE_BYTES_INVALID: bay ${String(bay)} of ${id}`);
  if (!isCrateFaces(faces)) throw new Error(`WRECK_YARD_STATE_BYTES_INVALID: faces of ${id}`);
}

/** Checks that a decoded body names a yard material. The body is untrusted until this runs. */
export function assertBodyMaterial(body: unknown): void {
  const material = typeof body === 'object' && body !== null && 'material' in body ? body.material : undefined;
  if (!isYardMaterial(material)) {
    const id = typeof body === 'object' && body !== null && 'id' in body ? String(body.id) : '?';
    throw new Error(`WRECK_YARD_STATE_BYTES_INVALID: material ${String(material)} of ${id}`);
  }
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isPoint = (value: unknown): boolean => Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);
const hasKeys = (value: object, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => key in value);

/**
 * Checks the floodlight fields of decoded contraptions: one entry per lamp in mast
 * order, a damage from 0 to 1, a broken lamp at full damage, recent smashes that
 * name a broken lamp, and a lights-out time only while every lamp is out.
 */
export function assertLampFields(contraptions: unknown): void {
  const value = typeof contraptions === 'object' && contraptions !== null ? contraptions : {};
  const lamps = 'lamps' in value ? value.lamps : undefined;
  interface SavedLamp { readonly lampId: string; readonly brokenAt: number | null }
  const isLamp = (entry: unknown, index: number): entry is SavedLamp => typeof entry === 'object' && entry !== null
    && hasKeys(entry, ['lampId', 'damage', 'flickerFrame', 'brokenAt'])
    && 'lampId' in entry && entry.lampId === FLOODLIGHT_LENSES[index]?.lampId
    && 'damage' in entry && isFiniteNumber(entry.damage) && entry.damage >= 0 && entry.damage <= 1
    && 'flickerFrame' in entry && Number.isInteger(entry.flickerFrame)
    && 'brokenAt' in entry && (entry.brokenAt === null || (Number.isInteger(entry.brokenAt) && entry.damage === 1));
  if (!Array.isArray(lamps) || lamps.length !== FLOODLIGHT_LENSES.length || !lamps.every(isLamp)) {
    throw new Error(`WRECK_YARD_STATE_BYTES_INVALID: lamps ${JSON.stringify(lamps)}`);
  }
  const savedLamps: readonly SavedLamp[] = lamps;
  const broken = savedLamps.flatMap((lamp) => (lamp.brokenAt === null ? [] : [lamp.lampId]));
  const recent = 'lampSmashes' in value ? value.lampSmashes : undefined;
  const isSmash = (entry: unknown) => typeof entry === 'object' && entry !== null && hasKeys(entry, ['lampId', 'at', 'frame'])
    && 'lampId' in entry && broken.some((id) => id === entry.lampId)
    && 'frame' in entry && Number.isInteger(entry.frame) && 'at' in entry && isPoint(entry.at);
  if (!Array.isArray(recent) || !recent.every(isSmash)) {
    throw new Error(`WRECK_YARD_STATE_BYTES_INVALID: lamp smashes ${JSON.stringify(recent)}`);
  }
  const until = 'lightsOutUntil' in value ? value.lightsOutUntil : undefined;
  // Lights out holds only while all four lamps are out. It ends on time, also when a lamp cannot come back yet.
  if (!(until === null || (Number.isInteger(until) && broken.length === savedLamps.length))) {
    throw new Error(`WRECK_YARD_STATE_BYTES_INVALID: lights out ${JSON.stringify(until)}`);
  }
  const relit = 'relitFrame' in value ? value.relitFrame : undefined;
  if (!Number.isInteger(relit)) throw new Error(`WRECK_YARD_STATE_BYTES_INVALID: relit frame ${JSON.stringify(relit)}`);
  const crates = 'crateBreaks' in value ? value.crateBreaks : undefined;
  const isCrateBreak = (entry: unknown) => typeof entry === 'object' && entry !== null && hasKeys(entry, ['crateId', 'at', 'frame'])
    && 'crateId' in entry && typeof entry.crateId === 'string' && 'at' in entry && isPoint(entry.at) && 'frame' in entry && Number.isInteger(entry.frame);
  if (!Array.isArray(crates) || !crates.every(isCrateBreak)) throw new Error(`WRECK_YARD_STATE_BYTES_INVALID: crate breaks ${JSON.stringify(crates)}`);
}

/** Checks decoded impacts: a body id, two yard materials, a point, a speed, and a frame. */
export function assertImpacts(impacts: unknown): void {
  const isImpact = (entry: unknown) => typeof entry === 'object' && entry !== null
    && hasKeys(entry, ['bodyId', 'materials', 'at', 'speed', 'frame'])
    && 'bodyId' in entry && typeof entry.bodyId === 'string'
    && 'materials' in entry && Array.isArray(entry.materials) && entry.materials.length === 2 && entry.materials.every(isYardMaterial)
    && 'at' in entry && isPoint(entry.at)
    && 'speed' in entry && isFiniteNumber(entry.speed) && entry.speed >= 0
    && 'frame' in entry && Number.isInteger(entry.frame);
  if (!Array.isArray(impacts) || !impacts.every(isImpact)) {
    throw new Error(`WRECK_YARD_STATE_BYTES_INVALID: impacts ${JSON.stringify(impacts)}`);
  }
}

function assertPlayerSeatFields(players: unknown): void {
  if (!Array.isArray(players) || players.length < 1 || players.length > MAX_PLAYERS
    || !players.every((player: unknown, slot: number) => typeof player === 'object' && player !== null
      && 'slot' in player && player.slot === slot && 'active' in player && typeof player.active === 'boolean'
      && 'controlEpoch' in player && (player.controlEpoch === null
        || (typeof player.controlEpoch === 'number' && Number.isSafeInteger(player.controlEpoch) && player.controlEpoch >= 0)))) {
    throw new Error('WRECK_YARD_STATE_BYTES_INVALID: player seats');
  }
}

function decodeRawState(bytes: Uint8Array): EncodedYard {
  if (bytes.byteLength < 8) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: too short');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== MAGIC) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: bad magic');
  const headerLength = view.getUint32(4);
  if (8 + headerLength > bytes.byteLength) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: header overflow');
  // canonicalParse restores what canonicalStringify tags, such as -0.
  const header = canonicalParse<Header>(decoder.decode(bytes.subarray(8, 8 + headerLength)));
  assertPlayerSeatFields(header.players);
  assertLampFields(header.contraptions);
  assertImpacts(header.impacts);
  let offset = 8 + headerLength;
  if (offset + header.world.checkpointBytes > bytes.byteLength) {
    throw new Error('WRECK_YARD_STATE_BYTES_INVALID: checkpoint overflow');
  }
  const checkpoint = new Uint8Array(bytes.subarray(offset, offset + header.world.checkpointBytes));
  offset += header.world.checkpointBytes;
  const bodies: YardBody[] = header.bodies.map(({ voxelBytes, ...rest }) => {
    if (offset + voxelBytes > bytes.byteLength) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: voxel overflow');
    const voxels = decodeVoxelRuns(bytes.subarray(offset, offset + voxelBytes), rest.dims.x * rest.dims.y * rest.dims.z);
    offset += voxelBytes;
    assertBodyMaterial(rest);
    if ('collider' in rest && rest.collider !== undefined && rest.collider !== 'cylinder') {
      throw new Error(`WRECK_YARD_STATE_BYTES_INVALID: collider ${String(rest.collider)} of ${rest.id}`);
    }
    assertCrateBodyFields(rest);
    return { ...rest, voxels };
  });
  if (offset !== bytes.byteLength) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: trailing bytes');
  const { checkpointBytes: _checkpointBytes, ...world } = header.world;
  return { state: { ...header, world, bodies }, checkpoint };
}

const COMPRESSED_MAGIC = 0x57594135; // WYA5: matches the body shape above.
const MAX_STATE_BYTES = 16 * 1024 * 1024;

/** Compress the native checkpoint and repeated body metadata for late joins and saved packets. */
export function encodeState(state: EncodedYard): Uint8Array {
  const raw = encodeRawState(state);
  if (raw.length > MAX_STATE_BYTES) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: state too large');
  const compressed = deflateSync(raw, { level: 1 });
  const out = new Uint8Array(compressed.length + 8);
  const view = new DataView(out.buffer);
  view.setUint32(0, COMPRESSED_MAGIC);
  view.setUint32(4, raw.length);
  out.set(compressed, 8);
  return out;
}

export function decodeState(bytes: Uint8Array): EncodedYard {
  if (bytes.length < 9) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: too short');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== COMPRESSED_MAGIC) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: bad magic');
  const size = view.getUint32(4);
  if (size < 8 || size > MAX_STATE_BYTES) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: size out of range');
  let raw: Uint8Array;
  try { raw = inflateSync(bytes.subarray(8), { out: new Uint8Array(size) }); }
  catch { throw new Error('WRECK_YARD_STATE_BYTES_INVALID: compressed data'); }
  if (raw.length !== size) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: size mismatch');
  return decodeRawState(raw);
}
