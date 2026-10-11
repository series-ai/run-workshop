import { deflateSync, inflateSync } from 'fflate';
import { canonicalParse, canonicalStringify } from '@series-inc/rundot-syncplay/browser';
import type { YardPhysicsWorldState } from './physics';
import type { YardBody, YardState } from './state';

const MAGIC = 0x57594132; // "WYA2"
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type HeaderBody = Omit<YardBody, 'voxels'> & { readonly voxelBytes: number };
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

function decodeRawState(bytes: Uint8Array): EncodedYard {
  if (bytes.byteLength < 8) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: too short');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== MAGIC) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: bad magic');
  const headerLength = view.getUint32(4);
  if (8 + headerLength > bytes.byteLength) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: header overflow');
  // canonicalParse restores what canonicalStringify tags, such as -0.
  const header = canonicalParse<Header>(decoder.decode(bytes.subarray(8, 8 + headerLength)));
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
    return { ...rest, voxels };
  });
  if (offset !== bytes.byteLength) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: trailing bytes');
  const { checkpointBytes: _checkpointBytes, ...world } = header.world;
  return { state: { ...header, world, bodies }, checkpoint };
}

const COMPRESSED_MAGIC = 0x57594133; // WYA3
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
