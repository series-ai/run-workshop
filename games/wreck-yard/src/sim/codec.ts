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

/** A state with its physics world as native checkpoint bytes: what peers checksum and late joiners load. */
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
export function encodeState({ state, checkpoint }: EncodedYard): Uint8Array {
  const header: Header = {
    ...state,
    world: {
      frame: state.world.frame,
      bodies: state.world.bodies,
      bodyIds: state.world.bodyIds,
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

export function decodeState(bytes: Uint8Array): EncodedYard {
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
