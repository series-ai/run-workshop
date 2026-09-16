import { canonicalStringify } from '@series-inc/rundot-syncplay/browser';
import type { YardPhysicsWorldState } from './physics';
import type { YardBody, YardState } from './state';

const MAGIC = 0x57594131; // "WYA1"
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type HeaderBody = Omit<YardBody, 'voxels'> & { readonly voxelBytes: number };
type HeaderWorld = Omit<YardPhysicsWorldState, 'checkpoint'> & { readonly checkpointBytes: number };
type Header = Omit<YardState, 'bodies' | 'world'> & {
  readonly bodies: readonly HeaderBody[];
  readonly world: HeaderWorld;
};

/**
 * Layout: u32 magic, u32 header length, canonical JSON header (everything but
 * voxel and checkpoint bytes), then the native checkpoint, then each body's
 * voxels in header order. Canonical JSON keeps key order stable.
 */
export function encodeState(state: YardState): Uint8Array {
  const header: Header = {
    ...state,
    world: {
      frame: state.world.frame,
      bodies: state.world.bodies,
      bodyIds: state.world.bodyIds,
      checkpointBytes: state.world.checkpoint.byteLength,
    },
    bodies: state.bodies.map(({ voxels, ...rest }) => ({ ...rest, voxelBytes: voxels.byteLength })),
  };
  const headerBytes = encoder.encode(canonicalStringify(header));
  const total = 8 + headerBytes.byteLength + state.world.checkpoint.byteLength
    + state.bodies.reduce((sum, body) => sum + body.voxels.byteLength, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, MAGIC);
  view.setUint32(4, headerBytes.byteLength);
  out.set(headerBytes, 8);
  let offset = 8 + headerBytes.byteLength;
  out.set(state.world.checkpoint, offset);
  offset += state.world.checkpoint.byteLength;
  for (const body of state.bodies) {
    out.set(body.voxels, offset);
    offset += body.voxels.byteLength;
  }
  return out;
}

export function decodeState(bytes: Uint8Array): YardState {
  if (bytes.byteLength < 8) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: too short');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== MAGIC) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: bad magic');
  const headerLength = view.getUint32(4);
  if (8 + headerLength > bytes.byteLength) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: header overflow');
  const header = JSON.parse(decoder.decode(bytes.subarray(8, 8 + headerLength))) as Header;
  let offset = 8 + headerLength;
  if (offset + header.world.checkpointBytes > bytes.byteLength) {
    throw new Error('WRECK_YARD_STATE_BYTES_INVALID: checkpoint overflow');
  }
  const checkpoint = new Uint8Array(bytes.subarray(offset, offset + header.world.checkpointBytes));
  offset += header.world.checkpointBytes;
  const bodies: YardBody[] = header.bodies.map(({ voxelBytes, ...rest }) => {
    if (offset + voxelBytes > bytes.byteLength) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: voxel overflow');
    const voxels = new Uint8Array(bytes.subarray(offset, offset + voxelBytes));
    offset += voxelBytes;
    return { ...rest, voxels };
  });
  if (offset !== bytes.byteLength) throw new Error('WRECK_YARD_STATE_BYTES_INVALID: trailing bytes');
  const { checkpointBytes: _checkpointBytes, ...world } = header.world;
  return { ...header, world: { ...world, checkpoint }, bodies };
}
