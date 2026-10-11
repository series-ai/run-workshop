/**
 * Compact generic graph codec for state snapshots (Schema Version 2).
 * Preserves object identities, cycles, prototype fidelity, and descriptors.
 */

export const CITY_GRAPH_SCHEMA_VERSION = 2;

export const MAX_GRAPH_NODES = 1_000_000;
export const MAX_GRAPH_PROPERTIES = 8_000_000;
export const MAX_ARRAY_BUFFER_BYTES = 256 * 1024 * 1024;
export const MAX_PAYLOAD_BYTES = 512 * 1024 * 1024;
export const MAX_ARRAY_ELEMENTS = 16_000_000;
export const MAX_MAP_ENTRIES = 4_000_000;
export const MAX_STRING_LENGTH = 64 * 1024 * 1024;
export const MAX_INTERNED_KEYS = 2_000_000;

export const SUPPORTED_TYPED_ARRAY_NAMES = [
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
] as const;

export type CityTypedArrayKind = (typeof SUPPORTED_TYPED_ARRAY_NAMES)[number];

export type CityGraphScalarValue = null | boolean | string | number;
export type CityGraphTaggedValue =
  | readonly ['u']
  | readonly ['r', number]
  | readonly ['n', string]
  | readonly ['h'];
export type CityGraphValue = CityGraphScalarValue | CityGraphTaggedValue;

export type CityGraphRecordNode =
  | readonly [0, number, number]
  | readonly [0, number, number, readonly (number | CityGraphValue)[]]
  | readonly [0, number, number, readonly (number | CityGraphValue)[], readonly number[]];

export type CityGraphArrayNode =
  | readonly [1, number, boolean, readonly CityGraphValue[]]
  | readonly [1, number, boolean, readonly CityGraphValue[], readonly (number | CityGraphValue)[]]
  | readonly [1, number, boolean, readonly CityGraphValue[], readonly (number | CityGraphValue)[], readonly number[]]
  | readonly [1, number, boolean, readonly CityGraphValue[], readonly (number | CityGraphValue)[], readonly number[], readonly number[]];

export type CityGraphMapNode =
  | readonly [2, number, readonly CityGraphValue[]]
  | readonly [2, number, readonly CityGraphValue[], readonly (number | CityGraphValue)[]]
  | readonly [2, number, readonly CityGraphValue[], readonly (number | CityGraphValue)[], readonly number[]];

export type CityGraphArrayBufferNode =
  | readonly [3, number, string]
  | readonly [3, number, string, readonly (number | CityGraphValue)[]]
  | readonly [3, number, string, readonly (number | CityGraphValue)[], readonly number[]];

export type CityGraphTypedArrayNode =
  | readonly [4, number, CityTypedArrayKind, number, number, number]
  | readonly [4, number, CityTypedArrayKind, number, number, number, readonly (number | CityGraphValue)[]]
  | readonly [4, number, CityTypedArrayKind, number, number, number, readonly (number | CityGraphValue)[], readonly number[]];

export type CityGraphDataViewNode =
  | readonly [5, number, number, number, number]
  | readonly [5, number, number, number, number, readonly (number | CityGraphValue)[]]
  | readonly [5, number, number, number, number, readonly (number | CityGraphValue)[], readonly number[]];

export type CityGraphNode =
  | CityGraphRecordNode
  | CityGraphArrayNode
  | CityGraphMapNode
  | CityGraphArrayBufferNode
  | CityGraphTypedArrayNode
  | CityGraphDataViewNode;

export interface CityGraphPayload {
  readonly version: number;
  readonly keys: readonly string[];
  readonly root: CityGraphValue;
  readonly pool: readonly CityGraphNode[];
  readonly hash: string;
}

const TYPED_ARRAY_CONSTRUCTORS: Record<
  CityTypedArrayKind,
  new (buffer: ArrayBuffer, byteOffset: number, length: number) => {
    readonly buffer: ArrayBuffer;
    readonly byteOffset: number;
    readonly length: number;
    readonly byteLength: number;
  }
> = {
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
};

const TYPED_ARRAY_BYTES_PER_ELEMENT: Record<CityTypedArrayKind, number> = {
  Int8Array: 1,
  Uint8Array: 1,
  Uint8ClampedArray: 1,
  Int16Array: 2,
  Uint16Array: 2,
  Int32Array: 4,
  Uint32Array: 4,
  Float32Array: 4,
  Float64Array: 8,
};

const TYPED_ARRAY_PROTOTYPES = new Map<object, CityTypedArrayKind>([
  [Int8Array.prototype, 'Int8Array'],
  [Uint8Array.prototype, 'Uint8Array'],
  [Uint8ClampedArray.prototype, 'Uint8ClampedArray'],
  [Int16Array.prototype, 'Int16Array'],
  [Uint16Array.prototype, 'Uint16Array'],
  [Int32Array.prototype, 'Int32Array'],
  [Uint32Array.prototype, 'Uint32Array'],
  [Float32Array.prototype, 'Float32Array'],
  [Float64Array.prototype, 'Float64Array'],
]);

const TypedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(TypedArrayPrototype, 'buffer')!.get!;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(TypedArrayPrototype, 'byteOffset')!.get!;
const TYPED_ARRAY_LENGTH_GETTER = Object.getOwnPropertyDescriptor(TypedArrayPrototype, 'length')!.get!;

const MAP_ENTRIES_FN = Map.prototype.entries;
const MAP_PROTO_SET = Map.prototype.set;
const MAP_SIZE_GETTER = Object.getOwnPropertyDescriptor(Map.prototype, 'size')!.get!;

const ARRAY_BUFFER_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!;
const ARRAY_BUFFER_RESIZABLE_DESC = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable');
const ARRAY_BUFFER_DETACHED_DESC = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'detached');

const DATA_VIEW_BUFFER_GETTER = Object.getOwnPropertyDescriptor(DataView.prototype, 'buffer')!.get!;
const DATA_VIEW_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(DataView.prototype, 'byteOffset')!.get!;
const DATA_VIEW_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(DataView.prototype, 'byteLength')!.get!;

function checkArrayBufferDetachedOrResizable(ab: ArrayBuffer): void {
  if (ARRAY_BUFFER_RESIZABLE_DESC?.get && ARRAY_BUFFER_RESIZABLE_DESC.get.call(ab) === true) {
    throw new Error('Resizable ArrayBuffer is not supported');
  }
  if (ARRAY_BUFFER_DETACHED_DESC?.get && ARRAY_BUFFER_DETACHED_DESC.get.call(ab) === true) {
    throw new Error('Detached ArrayBuffer is not supported');
  }
}

const UNSAFE_INHERITED_KEYS = new Set<string>();

function collectUnsafeKeys(proto: object | null): void {
  if (!proto) {
    return;
  }
  const descs = Object.getOwnPropertyDescriptors(proto);
  for (const key of Object.keys(descs)) {
    const desc = descs[key];
    if (desc.get !== undefined || desc.set !== undefined || desc.writable === false) {
      UNSAFE_INHERITED_KEYS.add(key);
    }
  }
}

collectUnsafeKeys(Object.prototype);
collectUnsafeKeys(Map.prototype);
collectUnsafeKeys(ArrayBuffer.prototype);
collectUnsafeKeys(TypedArrayPrototype);
collectUnsafeKeys(DataView.prototype);
collectUnsafeKeys(Array.prototype);
UNSAFE_INHERITED_KEYS.add('__proto__');
UNSAFE_INHERITED_KEYS.add('size');
UNSAFE_INHERITED_KEYS.add('buffer');
UNSAFE_INHERITED_KEYS.add('byteOffset');
UNSAFE_INHERITED_KEYS.add('byteLength');
UNSAFE_INHERITED_KEYS.add('length');

const HEX_BYTE_TABLE: string[] = [];
for (let i = 0; i < 256; i++) {
  HEX_BYTE_TABLE[i] = (i < 16 ? '0' : '') + i.toString(16);
}

const SHA256_ROUND_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const FLOAT_SCRATCH_BUFFER = new ArrayBuffer(8);
const FLOAT_SCRATCH_VIEW = new DataView(FLOAT_SCRATCH_BUFFER);

export function numberToHex(num: number): string {
  FLOAT_SCRATCH_VIEW.setFloat64(0, num, false);
  let hex = '';
  for (let i = 0; i < 8; i++) {
    const b = FLOAT_SCRATCH_VIEW.getUint8(i);
    hex += HEX_BYTE_TABLE[b];
  }
  return hex;
}

export function hexToNumber(hex: string): number {
  if (typeof hex !== 'string' || hex.length !== 16 || !/^[0-9a-f]{16}$/.test(hex)) {
    throw new Error('Malformed number hex encoding');
  }
  for (let i = 0; i < 8; i++) {
    const hi = hex.charCodeAt(i * 2);
    const lo = hex.charCodeAt(i * 2 + 1);
    const hiVal = hi <= 57 ? hi - 48 : hi - 87;
    const loVal = lo <= 57 ? lo - 48 : lo - 87;
    FLOAT_SCRATCH_VIEW.setUint8(i, (hiVal << 4) | loVal);
  }
  return FLOAT_SCRATCH_VIEW.getFloat64(0, false);
}

function encodeUtf8(text: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text);
  }
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let point = text.charCodeAt(i);
    if (point >= 0xd800 && point <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        point = ((point - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
        i++;
      }
    }
    if (point < 0x80) {
      bytes.push(point);
    } else if (point < 0x800) {
      bytes.push(0xc0 | (point >> 6), 0x80 | (point & 0x3f));
    } else if (point < 0x10000) {
      bytes.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f));
    } else {
      bytes.push(
        0xf0 | (point >> 18),
        0x80 | ((point >> 12) & 0x3f),
        0x80 | ((point >> 6) & 0x3f),
        0x80 | (point & 0x3f)
      );
    }
  }
  return new Uint8Array(bytes);
}

export function computeSha256Hex(text: string): string {
  const data = encodeUtf8(text);
  const byteLength = data.length;
  const bitLength = byteLength * 8;
  const paddedLength = ((byteLength + 9 + 63) >>> 6) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(data);
  padded[byteLength] = 0x80;

  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  const highBits = Math.floor(bitLength / 0x100000000);
  const lowBits = bitLength >>> 0;
  view.setUint32(paddedLength - 8, highBits, false);
  view.setUint32(paddedLength - 4, lowBits, false);

  const schedule = new Uint32Array(64);
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) {
      schedule[i] = view.getUint32(offset + (i << 2), false);
    }
    for (let i = 16; i < 64; i++) {
      const w15 = schedule[i - 15];
      const s0 =
        ((w15 >>> 7) | (w15 << 25)) ^
        ((w15 >>> 18) | (w15 << 14)) ^
        (w15 >>> 3);
      const w2 = schedule[i - 2];
      const s1 =
        ((w2 >>> 17) | (w2 << 15)) ^
        ((w2 >>> 19) | (w2 << 13)) ^
        (w2 >>> 10);
      schedule[i] = (schedule[i - 16] + s0 + schedule[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const s1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + SHA256_ROUND_CONSTANTS[i] + schedule[i]) >>> 0;
      const s0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return (
    (h0 >>> 0).toString(16).padStart(8, '0') +
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h3 >>> 0).toString(16).padStart(8, '0') +
    (h4 >>> 0).toString(16).padStart(8, '0') +
    (h5 >>> 0).toString(16).padStart(8, '0') +
    (h6 >>> 0).toString(16).padStart(8, '0') +
    (h7 >>> 0).toString(16).padStart(8, '0')
  );
}

export async function computeSha256HexWebCrypto(text: string): Promise<string> {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (!cryptoObj || !cryptoObj.subtle || typeof cryptoObj.subtle.digest !== 'function') {
    throw new Error('Web Crypto API subtle.digest is unavailable');
  }
  const data = encodeUtf8(text);
  const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data as unknown as BufferSource);
  const bytes = new Uint8Array(hashBuffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += HEX_BYTE_TABLE[bytes[i]];
  }
  return hex;
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const length = bytes.length;
  const chunks: string[] = [];
  const chunkSize = 65536;
  for (let i = 0; i < length; i += chunkSize) {
    const end = Math.min(i + chunkSize, length);
    let chunk = '';
    for (let j = i; j < end; j++) {
      chunk += HEX_BYTE_TABLE[bytes[j]];
    }
    chunks.push(chunk);
  }
  return chunks.join('');
}

function hexToArrayBuffer(hex: string, expectedByteLength: number): ArrayBuffer {
  if (hex.length !== expectedByteLength * 2) {
    throw new Error('Hex length does not match byte length');
  }
  if (!/^[0-9a-f]*$/.test(hex)) {
    throw new Error('Invalid hexadecimal characters');
  }
  const buffer = new ArrayBuffer(expectedByteLength);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < expectedByteLength; i++) {
    const hi = hex.charCodeAt(i * 2);
    const lo = hex.charCodeAt(i * 2 + 1);
    const hiVal = hi <= 57 ? hi - 48 : hi - 87;
    const loVal = lo <= 57 ? lo - 48 : lo - 87;
    bytes[i] = (hiVal << 4) | loVal;
  }
  return buffer;
}

function isIntegerIndexKey(k: string): boolean {
  return /^(0|[1-9]\d*)$/.test(k) && Number(k) <= 4294967294;
}

function isIntrinsicIndex(key: string, length: number): boolean {
  if (!/^(0|[1-9]\d*)$/.test(key)) {
    return false;
  }
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

function getObjectState(obj: object): number {
  if (Object.isFrozen(obj)) {
    return 3;
  }
  if (Object.isSealed(obj)) {
    return 2;
  }
  if (!Object.isExtensible(obj)) {
    return 1;
  }
  return 0;
}

function isPlainJsonObject(val: unknown): val is Record<string, unknown> {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) {
    return false;
  }
  if (Object.getPrototypeOf(val) !== Object.prototype) {
    return false;
  }
  if (Object.getOwnPropertySymbols(val).length > 0) {
    return false;
  }
  const names = Object.getOwnPropertyNames(val);
  for (let i = 0; i < names.length; i++) {
    const desc = Object.getOwnPropertyDescriptor(val, names[i]);
    if (!desc || desc.get !== undefined || desc.set !== undefined || !desc.enumerable) {
      return false;
    }
  }
  return true;
}

function checkExactKeys(obj: Record<string, unknown>, allowedKeys: readonly string[]): void {
  const names = Object.getOwnPropertyNames(obj);
  if (names.length !== allowedKeys.length) {
    throw new Error('Object contains invalid property keys');
  }
  for (let i = 0; i < allowedKeys.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(obj, allowedKeys[i])) {
      throw new Error('Missing expected property key');
    }
  }
}

function toSameValueZeroKey(val: CityGraphValue): string {
  if (val === null) {
    return 'null';
  }
  if (typeof val === 'boolean') {
    return 'b:' + val;
  }
  if (typeof val === 'string') {
    return 's:' + val;
  }
  if (typeof val === 'number') {
    if (Number.isNaN(val)) {
      return 'n:NaN';
    }
    if (val === 0) {
      return 'n:0';
    }
    return 'n:' + val;
  }
  if (Array.isArray(val)) {
    const tag = val[0];
    if (tag === 'u') {
      return 'u';
    }
    if (tag === 'r') {
      return 'r:' + val[1];
    }
    if (tag === 'n') {
      const num = hexToNumber(val[1] as string);
      if (Number.isNaN(num)) {
        return 'n:NaN';
      }
      if (num === 0) {
        return 'n:0';
      }
      return 'n:' + num;
    }
  }
  throw new Error('Invalid value in map key');
}

/**
 * Encode an arbitrary graph into a compact CityGraphPayload.
 */
export function encodeCityGraph(value: unknown): CityGraphPayload {
  const poolNodes: CityGraphNode[] = [];
  const visited = new Map<object, number>();
  const queue: object[] = [];
  const keys: string[] = [];
  const keyToId = new Map<string, number>();

  let totalProperties = 0;
  let totalBufferBytes = 0;
  let totalMapEntries = 0;
  let totalArrayElements = 0;
  let cumulativePayloadText = 0;

  function internKey(k: string): number {
    let id = keyToId.get(k);
    if (id !== undefined) {
      return id;
    }
    if (k.length > MAX_STRING_LENGTH) {
      throw new Error('Property key exceeds MAX_STRING_LENGTH limit');
    }
    cumulativePayloadText += k.length;
    if (cumulativePayloadText > MAX_PAYLOAD_BYTES) {
      throw new Error('Exceeded MAX_PAYLOAD_BYTES limit');
    }
    id = keys.length;
    if (id >= MAX_INTERNED_KEYS) {
      throw new Error('Exceeded MAX_INTERNED_KEYS limit');
    }
    keyToId.set(k, id);
    keys.push(k);
    return id;
  }

  function registerObject(obj: object): number {
    const proto = Object.getPrototypeOf(obj);
    const isSupportedProto =
      proto === null ||
      proto === Object.prototype ||
      proto === Array.prototype ||
      proto === Map.prototype ||
      proto === ArrayBuffer.prototype ||
      proto === DataView.prototype ||
      TYPED_ARRAY_PROTOTYPES.has(proto);

    if (!isSupportedProto) {
      throw new Error('Unsupported object prototype');
    }

    if (Object.getOwnPropertySymbols(obj).length > 0) {
      throw new Error('Symbol properties are not supported');
    }

    const existingId = visited.get(obj);
    if (existingId !== undefined) {
      return existingId;
    }

    if (queue.length >= MAX_GRAPH_NODES) {
      throw new Error('Exceeded MAX_GRAPH_NODES limit');
    }

    const newId = queue.length;
    visited.set(obj, newId);
    queue.push(obj);
    return newId;
  }

  function encodeValue(val: unknown): CityGraphValue {
    if (val === null) {
      return null;
    }
    if (val === undefined) {
      return ['u'];
    }
    if (typeof val === 'boolean') {
      return val;
    }
    if (typeof val === 'string') {
      if (val.length > MAX_STRING_LENGTH) {
        throw new Error('String length exceeds MAX_STRING_LENGTH limit');
      }
      cumulativePayloadText += val.length;
      if (cumulativePayloadText > MAX_PAYLOAD_BYTES) {
        throw new Error('Exceeded MAX_PAYLOAD_BYTES limit');
      }
      return val;
    }
    if (typeof val === 'number') {
      if (Number.isFinite(val) && !Object.is(val, -0)) {
        return val;
      }
      return ['n', numberToHex(val)];
    }
    if (typeof val === 'object') {
      const id = registerObject(val);
      return ['r', id];
    }
    throw new Error('Unsupported value type');
  }

  function encodeCustomProperties(
    target: object,
    state: number,
    skipKeyPredicate?: (key: string) => boolean
  ): { flatProps: (number | CityGraphValue)[]; rareOverrides: number[] } {
    const allKeys = Object.getOwnPropertyNames(target);
    const flatProps: (number | CityGraphValue)[] = [];
    const rareOverrides: number[] = [];
    const defaultFlags = state === 3 ? 2 : state === 2 ? 3 : 7;
    let propIndex = 0;

    for (let i = 0; i < allKeys.length; i++) {
      const k = allKeys[i];
      if (skipKeyPredicate && skipKeyPredicate(k)) {
        continue;
      }
      const desc = Object.getOwnPropertyDescriptor(target, k);
      if (!desc) {
        continue;
      }
      if (desc.get !== undefined || desc.set !== undefined) {
        throw new Error('Accessor properties are not supported');
      }
      totalProperties++;
      if (totalProperties > MAX_GRAPH_PROPERTIES) {
        throw new Error('Exceeded MAX_GRAPH_PROPERTIES limit');
      }
      const keyId = internKey(k);
      const val = encodeValue(desc.value);
      flatProps.push(keyId, val);

      const flags = (desc.writable ? 1 : 0) | (desc.enumerable ? 2 : 0) | (desc.configurable ? 4 : 0);
      if (flags !== defaultFlags) {
        rareOverrides.push(propIndex, flags);
      }
      propIndex++;
    }
    return { flatProps, rareOverrides };
  }

  const root = encodeValue(value);

  let cursor = 0;
  while (cursor < queue.length) {
    const current = queue[cursor++];
    const proto = Object.getPrototypeOf(current);
    const state = getObjectState(current);

    if (proto === null || proto === Object.prototype) {
      const protoTag = proto === null ? 1 : 0;
      const { flatProps, rareOverrides } = encodeCustomProperties(current, state);
      if (rareOverrides.length > 0) {
        poolNodes.push([0, state, protoTag, flatProps, rareOverrides] as const);
      } else if (flatProps.length > 0) {
        poolNodes.push([0, state, protoTag, flatProps] as const);
      } else {
        poolNodes.push([0, state, protoTag] as const);
      }
      continue;
    }

    if (proto === Array.prototype) {
      const arr = current as unknown[];
      const lengthDesc = Object.getOwnPropertyDescriptor(arr, 'length');
      if (!lengthDesc) {
        throw new Error('Array length descriptor missing');
      }
      const len = arr.length;
      if (len > MAX_ARRAY_ELEMENTS) {
        throw new Error('Exceeded MAX_ARRAY_ELEMENTS limit');
      }
      totalArrayElements += len;
      if (totalArrayElements > MAX_ARRAY_ELEMENTS) {
        throw new Error('Exceeded MAX_ARRAY_ELEMENTS limit');
      }

      const lengthWritable = Boolean(lengthDesc.writable);
      const denseValues: CityGraphValue[] = [];
      const indexOverrides: number[] = [];
      const defaultIndexFlags = state === 3 ? 2 : state === 2 ? 3 : 7;

      for (let i = 0; i < len; i++) {
        const isPresent = Object.prototype.hasOwnProperty.call(arr, String(i));
        if (!isPresent) {
          denseValues.push(['h']);
          continue;
        }
        const item = arr[i];
        if (item === undefined) {
          denseValues.push(['u']);
        } else {
          denseValues.push(encodeValue(item));
        }

        const desc = Object.getOwnPropertyDescriptor(arr, String(i));
        if (desc) {
          if (desc.get !== undefined || desc.set !== undefined) {
            throw new Error('Accessor properties are not supported');
          }
          const flags = (desc.writable ? 1 : 0) | (desc.enumerable ? 2 : 0) | (desc.configurable ? 4 : 0);
          if (flags !== defaultIndexFlags) {
            indexOverrides.push(i, flags);
          }
        }
      }

      const { flatProps: flatCustomProps, rareOverrides: customOverrides } = encodeCustomProperties(
        arr,
        state,
        (k) => k === 'length' || isIntrinsicIndex(k, len)
      );

      if (customOverrides.length > 0) {
        poolNodes.push([1, state, lengthWritable, denseValues, flatCustomProps, indexOverrides, customOverrides] as const);
      } else if (indexOverrides.length > 0) {
        poolNodes.push([1, state, lengthWritable, denseValues, flatCustomProps, indexOverrides] as const);
      } else if (flatCustomProps.length > 0) {
        poolNodes.push([1, state, lengthWritable, denseValues, flatCustomProps] as const);
      } else {
        poolNodes.push([1, state, lengthWritable, denseValues] as const);
      }
      continue;
    }

    if (proto === Map.prototype) {
      const map = current as Map<unknown, unknown>;
      const mapSize = MAP_SIZE_GETTER.call(map) as number;
      if (mapSize > MAX_MAP_ENTRIES) {
        throw new Error('Exceeded MAX_MAP_ENTRIES limit');
      }
      totalMapEntries += mapSize;
      if (totalMapEntries > MAX_MAP_ENTRIES) {
        throw new Error('Exceeded aggregate MAX_MAP_ENTRIES limit');
      }

      const flatEntries: CityGraphValue[] = [];
      for (const [entryKey, entryValue] of MAP_ENTRIES_FN.call(map)) {
        flatEntries.push(encodeValue(entryKey), encodeValue(entryValue));
      }

      const { flatProps, rareOverrides } = encodeCustomProperties(map, state);
      if (rareOverrides.length > 0) {
        poolNodes.push([2, state, flatEntries, flatProps, rareOverrides] as const);
      } else if (flatProps.length > 0) {
        poolNodes.push([2, state, flatEntries, flatProps] as const);
      } else {
        poolNodes.push([2, state, flatEntries] as const);
      }
      continue;
    }

    if (proto === ArrayBuffer.prototype) {
      const ab = current as ArrayBuffer;
      checkArrayBufferDetachedOrResizable(ab);
      const byteLength = ARRAY_BUFFER_BYTE_LENGTH_GETTER.call(ab) as number;
      if (byteLength > MAX_ARRAY_BUFFER_BYTES) {
        throw new Error('Exceeded MAX_ARRAY_BUFFER_BYTES limit');
      }
      totalBufferBytes += byteLength;
      if (totalBufferBytes > MAX_ARRAY_BUFFER_BYTES) {
        throw new Error('Exceeded aggregate MAX_ARRAY_BUFFER_BYTES limit');
      }
      const hexBytes = arrayBufferToHex(ab);
      cumulativePayloadText += hexBytes.length;
      if (cumulativePayloadText > MAX_PAYLOAD_BYTES) {
        throw new Error('Exceeded MAX_PAYLOAD_BYTES limit');
      }

      const { flatProps, rareOverrides } = encodeCustomProperties(ab, state);
      if (rareOverrides.length > 0) {
        poolNodes.push([3, state, hexBytes, flatProps, rareOverrides] as const);
      } else if (flatProps.length > 0) {
        poolNodes.push([3, state, hexBytes, flatProps] as const);
      } else {
        poolNodes.push([3, state, hexBytes] as const);
      }
      continue;
    }

    const typedArrayKind = TYPED_ARRAY_PROTOTYPES.get(proto);
    if (typedArrayKind !== undefined) {
      const buffer = TYPED_ARRAY_BUFFER_GETTER.call(current) as ArrayBuffer;
      const byteOffset = TYPED_ARRAY_BYTE_OFFSET_GETTER.call(current) as number;
      const length = TYPED_ARRAY_LENGTH_GETTER.call(current) as number;

      if (length > MAX_ARRAY_ELEMENTS) {
        throw new Error('Exceeded MAX_ARRAY_ELEMENTS limit');
      }
      totalArrayElements += length;
      if (totalArrayElements > MAX_ARRAY_ELEMENTS) {
        throw new Error('Exceeded aggregate MAX_ARRAY_ELEMENTS limit');
      }

      if (length > 0 && state === 3) {
        throw new Error('Typed array with elements cannot be frozen');
      }

      const bufferId = registerObject(buffer);
      const { flatProps, rareOverrides } = encodeCustomProperties(current, state, (k) => {
        if (isIntrinsicIndex(k, length)) {
          const desc = Object.getOwnPropertyDescriptor(current, k);
          if (
            !desc ||
            desc.writable !== true ||
            desc.enumerable !== true ||
            desc.configurable !== true ||
            desc.get !== undefined ||
            desc.set !== undefined
          ) {
            throw new Error('Non-canonical typed array index descriptor');
          }
          return true;
        }
        if (String(Number(k)) === k || k === '-0') {
          throw new Error('Canonical numeric index key is not allowed as custom property on typed array');
        }
        return false;
      });

      if (rareOverrides.length > 0) {
        poolNodes.push([4, state, typedArrayKind, bufferId, byteOffset, length, flatProps, rareOverrides] as const);
      } else if (flatProps.length > 0) {
        poolNodes.push([4, state, typedArrayKind, bufferId, byteOffset, length, flatProps] as const);
      } else {
        poolNodes.push([4, state, typedArrayKind, bufferId, byteOffset, length] as const);
      }
      continue;
    }

    if (proto === DataView.prototype) {
      const buffer = DATA_VIEW_BUFFER_GETTER.call(current) as ArrayBuffer;
      const byteOffset = DATA_VIEW_BYTE_OFFSET_GETTER.call(current) as number;
      const byteLength = DATA_VIEW_BYTE_LENGTH_GETTER.call(current) as number;

      const bufferId = registerObject(buffer);
      const { flatProps, rareOverrides } = encodeCustomProperties(current, state);

      if (rareOverrides.length > 0) {
        poolNodes.push([5, state, bufferId, byteOffset, byteLength, flatProps, rareOverrides] as const);
      } else if (flatProps.length > 0) {
        poolNodes.push([5, state, bufferId, byteOffset, byteLength, flatProps] as const);
      } else {
        poolNodes.push([5, state, bufferId, byteOffset, byteLength] as const);
      }
      continue;
    }

    throw new Error('Unsupported object encountered during encoding');
  }

  const payloadBody = {
    version: CITY_GRAPH_SCHEMA_VERSION,
    keys,
    root,
    pool: poolNodes,
  };

  const serializedBody = JSON.stringify(payloadBody);
  if (serializedBody.length > MAX_PAYLOAD_BYTES) {
    throw new Error('Exceeded MAX_PAYLOAD_BYTES limit');
  }
  const utf8Data = encodeUtf8(serializedBody);
  if (utf8Data.length > MAX_PAYLOAD_BYTES) {
    throw new Error('Exceeded MAX_PAYLOAD_BYTES limit');
  }
  const hash = computeSha256Hex(serializedBody);

  return {
    version: CITY_GRAPH_SCHEMA_VERSION,
    keys,
    root,
    pool: poolNodes,
    hash,
  };
}

interface PreflightState {
  cumulativeText: number;
  totalItems: number;
  activeStack: Set<object>;
}

function cloneWireValue(raw: unknown, depth: number, state: PreflightState): unknown {
  if (depth > 64) {
    throw new Error('Wire format exceeds maximum nesting depth');
  }
  state.totalItems++;
  if (state.totalItems > MAX_GRAPH_PROPERTIES * 4) {
    throw new Error('Wire format exceeds maximum items limit');
  }

  if (raw === null) {
    return null;
  }
  if (typeof raw === 'boolean') {
    return raw;
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      throw new Error('Wire format cannot contain non-finite numbers');
    }
    return raw;
  }
  if (typeof raw === 'string') {
    if (raw.length > MAX_STRING_LENGTH) {
      throw new Error('Wire string exceeds MAX_STRING_LENGTH');
    }
    state.cumulativeText += raw.length;
    if (state.cumulativeText > MAX_PAYLOAD_BYTES) {
      throw new Error('Wire format exceeds MAX_PAYLOAD_BYTES');
    }
    return raw;
  }

  if (typeof raw !== 'object') {
    throw new Error('Wire format cannot contain non-JSON values');
  }

  if (state.activeStack.has(raw)) {
    throw new Error('Cycles in wire format are invalid');
  }
  state.activeStack.add(raw);

  try {
    if (Object.getOwnPropertySymbols(raw).length > 0) {
      throw new Error('Wire format cannot contain symbols');
    }

    if (Object.prototype.hasOwnProperty.call(raw, 'toJSON') || 'toJSON' in raw) {
      throw new Error('Wire format cannot contain toJSON hook');
    }

    if (Array.isArray(raw)) {
      if (Object.getPrototypeOf(raw) !== Array.prototype) {
        throw new Error('Wire array has invalid prototype');
      }
      const len = raw.length;
      if (len > MAX_ARRAY_ELEMENTS) {
        throw new Error('Wire array exceeds MAX_ARRAY_ELEMENTS');
      }
      const names = Object.getOwnPropertyNames(raw);
      if (names.length !== len + 1) {
        throw new Error('Wire array has unexpected properties or holes');
      }
      const clonedArray: unknown[] = new Array(len);
      for (let i = 0; i < len; i++) {
        const desc = Object.getOwnPropertyDescriptor(raw, String(i));
        if (!desc || desc.get !== undefined || desc.set !== undefined || !desc.enumerable) {
          throw new Error('Invalid wire array element descriptor');
        }
        clonedArray[i] = cloneWireValue(desc.value, depth + 1, state);
      }
      return clonedArray;
    }

    if (Object.getPrototypeOf(raw) !== Object.prototype) {
      throw new Error('Wire object has invalid prototype');
    }

    const names = Object.getOwnPropertyNames(raw);
    const clonedObj: Record<string, unknown> = Object.create(Object.prototype);

    for (let i = 0; i < names.length; i++) {
      const k = names[i];
      if (k.length > MAX_STRING_LENGTH) {
        throw new Error('Wire property key exceeds MAX_STRING_LENGTH');
      }
      state.cumulativeText += k.length;
      if (state.cumulativeText > MAX_PAYLOAD_BYTES) {
        throw new Error('Wire format exceeds MAX_PAYLOAD_BYTES');
      }
      const desc = Object.getOwnPropertyDescriptor(raw, k);
      if (!desc || desc.get !== undefined || desc.set !== undefined || !desc.enumerable) {
        throw new Error('Invalid wire object property descriptor');
      }
      Object.defineProperty(clonedObj, k, {
        value: cloneWireValue(desc.value, depth + 1, state),
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    return clonedObj;
  } finally {
    state.activeStack.delete(raw);
  }
}

function validateValueDescriptor(val: unknown, poolLength: number, allowHole: boolean): CityGraphValue {
  if (val === null || typeof val === 'boolean' || typeof val === 'string') {
    return val;
  }
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || Object.is(val, -0)) {
      throw new Error('Non-finite numbers and negative zero must be tagged');
    }
    return val;
  }
  if (Array.isArray(val)) {
    const tag = val[0];
    if (tag === 'u' && val.length === 1) {
      return val as unknown as readonly ['u'];
    }
    if (tag === 'r' && val.length === 2) {
      const id = val[1];
      if (typeof id !== 'number' || !Number.isInteger(id) || id < 0 || id >= poolLength) {
        throw new Error('Invalid reference identifier');
      }
      return val as unknown as readonly ['r', number];
    }
    if (tag === 'n' && val.length === 2) {
      const hex = val[1];
      if (typeof hex !== 'string' || hex.length !== 16 || !/^[0-9a-f]{16}$/.test(hex)) {
        throw new Error('Invalid number hex encoding');
      }
      return val as unknown as readonly ['n', string];
    }
    if (tag === 'h' && val.length === 1 && allowHole) {
      return val as unknown as readonly ['h'];
    }
  }
  throw new Error('Invalid value descriptor');
}

interface PreparedGraphPlan {
  readonly canonicalBody: string;
  readonly expectedHash: string;
  readonly keys: readonly string[];
  readonly pool: readonly CityGraphNode[];
  readonly root: CityGraphValue;
}

function prepareCityGraph(rawPayload: unknown): PreparedGraphPlan {
  if (typeof rawPayload !== 'object' || rawPayload === null || Array.isArray(rawPayload)) {
    throw new Error('Payload must be a plain JSON object');
  }

  const preflightState: PreflightState = {
    cumulativeText: 0,
    totalItems: 0,
    activeStack: new Set<object>(),
  };

  const detachedPayload = cloneWireValue(rawPayload, 0, preflightState) as Record<string, unknown>;
  checkExactKeys(detachedPayload, ['version', 'keys', 'root', 'pool', 'hash']);

  const version = detachedPayload.version;
  if (version !== CITY_GRAPH_SCHEMA_VERSION) {
    throw new Error('Unsupported schema version');
  }

  const hash = detachedPayload.hash;
  if (typeof hash !== 'string' || hash.length !== 64 || !/^[0-9a-f]{64}$/.test(hash)) {
    throw new Error('Invalid integrity hash format');
  }

  const keysRaw = detachedPayload.keys;
  if (!Array.isArray(keysRaw) || keysRaw.length > MAX_INTERNED_KEYS) {
    throw new Error('Invalid keys table');
  }
  const keysList = keysRaw as string[];

  const poolRaw = detachedPayload.pool;
  if (!Array.isArray(poolRaw) || poolRaw.length > MAX_GRAPH_NODES) {
    throw new Error('Invalid pool');
  }

  const canonicalBody = JSON.stringify({
    version,
    keys: keysList,
    root: detachedPayload.root,
    pool: poolRaw,
  });

  if (canonicalBody.length > MAX_PAYLOAD_BYTES) {
    throw new Error('Exceeded MAX_PAYLOAD_BYTES limit');
  }
  const utf8Data = encodeUtf8(canonicalBody);
  if (utf8Data.length > MAX_PAYLOAD_BYTES) {
    throw new Error('Exceeded MAX_PAYLOAD_BYTES limit');
  }

  let cumulativePayloadText = 0;
  for (let i = 0; i < keysList.length; i++) {
    const k = keysList[i];
    if (typeof k !== 'string' || k.length > MAX_STRING_LENGTH) {
      throw new Error('Invalid interned key');
    }
    cumulativePayloadText += k.length;
    if (cumulativePayloadText > MAX_PAYLOAD_BYTES) {
      throw new Error('Exceeded cumulative payload text limit');
    }
  }

  const poolLength = poolRaw.length;
  let totalProperties = 0;
  let totalBufferBytes = 0;
  let totalMapEntries = 0;
  let totalArrayElements = 0;

  function validateCustomPropertyList(
    flatPropsRaw: unknown,
    rareOverridesRaw: unknown,
    state: number,
    isTypedArray: boolean,
    isArray: boolean
  ): { flatProps: readonly (number | CityGraphValue)[]; rareOverrides: readonly number[] } {
    if (!Array.isArray(flatPropsRaw) || (flatPropsRaw.length % 2) !== 0) {
      throw new Error('Invalid flat properties list');
    }
    const numProps = flatPropsRaw.length / 2;
    totalProperties += numProps;
    if (totalProperties > MAX_GRAPH_PROPERTIES) {
      throw new Error('Exceeded aggregate MAX_GRAPH_PROPERTIES limit');
    }

    const seenKeys = new Set<string>();
    let seenNonInteger = false;
    let lastInteger = -1;

    for (let p = 0; p < numProps; p++) {
      const keyId = flatPropsRaw[p * 2];
      if (typeof keyId !== 'number' || !Number.isInteger(keyId) || keyId < 0 || keyId >= keysList.length) {
        throw new Error('Invalid key ID');
      }
      const k = keysList[keyId];
      if (seenKeys.has(k)) {
        throw new Error('Duplicate property key');
      }
      seenKeys.add(k);

      if (isArray) {
        if (k === 'length') {
          throw new Error('Array length property cannot be in custom properties');
        }
        if (isIntegerIndexKey(k)) {
          throw new Error('Canonical array index cannot be in custom properties');
        }
      }

      if (isTypedArray) {
        if (String(Number(k)) === k || k === '-0') {
          throw new Error('Canonical numeric index key is not allowed on typed array');
        }
      }

      if (isIntegerIndexKey(k)) {
        if (seenNonInteger) {
          throw new Error('Integer index keys must appear before non-integer keys');
        }
        const idx = Number(k);
        if (idx <= lastInteger) {
          throw new Error('Integer index keys must be in ascending numerical order');
        }
        lastInteger = idx;
      } else {
        seenNonInteger = true;
      }

      validateValueDescriptor(flatPropsRaw[p * 2 + 1], poolLength, false);
    }

    if (!Array.isArray(rareOverridesRaw) || (rareOverridesRaw.length % 2) !== 0) {
      throw new Error('Invalid rare overrides list');
    }

    const overridePositions = new Set<number>();
    const defaultFlags = state === 3 ? 2 : state === 2 ? 3 : 7;

    for (let o = 0; o < rareOverridesRaw.length; o += 2) {
      const pos = rareOverridesRaw[o];
      const flags = rareOverridesRaw[o + 1];
      if (typeof pos !== 'number' || !Number.isInteger(pos) || pos < 0 || pos >= numProps) {
        throw new Error('Invalid override property position');
      }
      if (typeof flags !== 'number' || !Number.isInteger(flags) || flags < 0 || flags > 7) {
        throw new Error('Invalid override flags');
      }
      if (overridePositions.has(pos)) {
        throw new Error('Duplicate override property position');
      }
      overridePositions.add(pos);
    }

    if (state === 3 || state === 2) {
      const overrideMap = new Map<number, number>();
      for (let o = 0; o < rareOverridesRaw.length; o += 2) {
        overrideMap.set(rareOverridesRaw[o], rareOverridesRaw[o + 1]);
      }
      for (let p = 0; p < numProps; p++) {
        const flags = overrideMap.has(p) ? overrideMap.get(p)! : defaultFlags;
        const writable = (flags & 1) !== 0;
        const configurable = (flags & 4) !== 0;
        if (state === 3 && (writable || configurable)) {
          throw new Error('Frozen object property must be non-writable and non-configurable');
        }
        if (state === 2 && configurable) {
          throw new Error('Sealed object property must be non-configurable');
        }
      }
    }

    return { flatProps: flatPropsRaw, rareOverrides: rareOverridesRaw };
  }

  // Pre-validate all node schemas and aggregate limits.
  for (let i = 0; i < poolLength; i++) {
    const nodeRaw = poolRaw[i];
    if (!Array.isArray(nodeRaw)) {
      throw new Error('Pool item must be a tuple array');
    }
    const kind = nodeRaw[0];
    if (typeof kind !== 'number' || !Number.isInteger(kind)) {
      throw new Error('Invalid node kind');
    }
    const state = nodeRaw[1];
    if (typeof state !== 'number' || !Number.isInteger(state) || state < 0 || state > 3) {
      throw new Error('Invalid object state');
    }

    if (kind === 0) {
      if (nodeRaw.length < 3 || nodeRaw.length > 5) {
        throw new Error('Invalid record tuple length');
      }
      const proto = nodeRaw[2];
      if (proto !== 0 && proto !== 1) {
        throw new Error('Invalid record prototype');
      }
      const flatPropsRaw = nodeRaw.length >= 4 ? nodeRaw[3] : [];
      const rareOverridesRaw = nodeRaw.length === 5 ? nodeRaw[4] : [];
      validateCustomPropertyList(flatPropsRaw, rareOverridesRaw, state, false, false);
      continue;
    }

    if (kind === 1) {
      if (nodeRaw.length < 4 || nodeRaw.length > 7) {
        throw new Error('Invalid array tuple length');
      }
      const lengthWritable = nodeRaw[2];
      if (typeof lengthWritable !== 'boolean') {
        throw new Error('Invalid array lengthWritable');
      }
      if (state === 3 && lengthWritable) {
        throw new Error('Frozen array length must not be writable');
      }
      const denseValues = nodeRaw[3];
      if (!Array.isArray(denseValues) || denseValues.length > MAX_ARRAY_ELEMENTS) {
        throw new Error('Invalid array dense values');
      }
      totalArrayElements += denseValues.length;
      if (totalArrayElements > MAX_ARRAY_ELEMENTS) {
        throw new Error('Exceeded aggregate MAX_ARRAY_ELEMENTS limit');
      }
      for (let d = 0; d < denseValues.length; d++) {
        validateValueDescriptor(denseValues[d], poolLength, true);
      }

      const flatCustomPropsRaw = nodeRaw.length >= 5 ? nodeRaw[4] : [];
      const indexOverridesRaw = nodeRaw.length >= 6 ? nodeRaw[5] : [];
      const customOverridesRaw = nodeRaw.length === 7 ? nodeRaw[6] : [];

      if (!Array.isArray(indexOverridesRaw) || (indexOverridesRaw.length % 2) !== 0) {
        throw new Error('Invalid array index overrides');
      }
      const seenIndexOverrides = new Set<number>();
      for (let io = 0; io < indexOverridesRaw.length; io += 2) {
        const idx = indexOverridesRaw[io];
        const flags = indexOverridesRaw[io + 1];
        if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= denseValues.length) {
          throw new Error('Invalid array index override target');
        }
        if (typeof flags !== 'number' || !Number.isInteger(flags) || flags < 0 || flags > 7) {
          throw new Error('Invalid array index override flags');
        }
        if (seenIndexOverrides.has(idx)) {
          throw new Error('Duplicate array index override');
        }
        seenIndexOverrides.add(idx);
        if (state === 3 && ((flags & 1) !== 0 || (flags & 4) !== 0)) {
          throw new Error('Frozen array element must be non-writable and non-configurable');
        }
        if (state === 2 && (flags & 4) !== 0) {
          throw new Error('Sealed array element must be non-configurable');
        }
      }

      validateCustomPropertyList(flatCustomPropsRaw, customOverridesRaw, state, false, true);
      continue;
    }

    if (kind === 2) {
      if (nodeRaw.length < 3 || nodeRaw.length > 5) {
        throw new Error('Invalid map tuple length');
      }
      const flatEntries = nodeRaw[2];
      if (!Array.isArray(flatEntries) || (flatEntries.length % 2) !== 0) {
        throw new Error('Invalid map entries list');
      }
      const numEntries = flatEntries.length / 2;
      if (numEntries > MAX_MAP_ENTRIES) {
        throw new Error('Exceeded MAX_MAP_ENTRIES limit');
      }
      totalMapEntries += numEntries;
      if (totalMapEntries > MAX_MAP_ENTRIES) {
        throw new Error('Exceeded aggregate MAX_MAP_ENTRIES limit');
      }

      const seenMapKeys = new Set<string>();
      for (let e = 0; e < numEntries; e++) {
        const kVal = validateValueDescriptor(flatEntries[e * 2], poolLength, false);
        validateValueDescriptor(flatEntries[e * 2 + 1], poolLength, false);
        const mapKeyKey = toSameValueZeroKey(kVal);
        if (seenMapKeys.has(mapKeyKey)) {
          throw new Error('Duplicate map key');
        }
        seenMapKeys.add(mapKeyKey);
      }

      const flatPropsRaw = nodeRaw.length >= 4 ? nodeRaw[3] : [];
      const rareOverridesRaw = nodeRaw.length === 5 ? nodeRaw[4] : [];
      validateCustomPropertyList(flatPropsRaw, rareOverridesRaw, state, false, false);
      continue;
    }

    if (kind === 3) {
      if (nodeRaw.length < 3 || nodeRaw.length > 5) {
        throw new Error('Invalid buffer tuple length');
      }
      const hexBytes = nodeRaw[2];
      if (typeof hexBytes !== 'string' || (hexBytes.length % 2) !== 0 || !/^[0-9a-f]*$/.test(hexBytes)) {
        throw new Error('Invalid buffer hex string');
      }
      const byteLength = hexBytes.length / 2;
      if (byteLength > MAX_ARRAY_BUFFER_BYTES) {
        throw new Error('Exceeded MAX_ARRAY_BUFFER_BYTES limit');
      }
      totalBufferBytes += byteLength;
      if (totalBufferBytes > MAX_ARRAY_BUFFER_BYTES) {
        throw new Error('Exceeded aggregate MAX_ARRAY_BUFFER_BYTES limit');
      }

      const flatPropsRaw = nodeRaw.length >= 4 ? nodeRaw[3] : [];
      const rareOverridesRaw = nodeRaw.length === 5 ? nodeRaw[4] : [];
      validateCustomPropertyList(flatPropsRaw, rareOverridesRaw, state, false, false);
      continue;
    }

    if (kind === 4) {
      if (nodeRaw.length < 6 || nodeRaw.length > 8) {
        throw new Error('Invalid typed array tuple length');
      }
      const typeName = nodeRaw[2];
      const bufferId = nodeRaw[3];
      const byteOffset = nodeRaw[4];
      const length = nodeRaw[5];

      if (
        typeof typeName !== 'string' ||
        !SUPPORTED_TYPED_ARRAY_NAMES.includes(typeName as CityTypedArrayKind)
      ) {
        throw new Error('Invalid typed array kind');
      }
      if (typeof bufferId !== 'number' || !Number.isInteger(bufferId) || bufferId < 0 || bufferId >= poolLength) {
        throw new Error('Invalid buffer reference');
      }
      if (typeof byteOffset !== 'number' || !Number.isInteger(byteOffset) || byteOffset < 0) {
        throw new Error('Invalid byteOffset');
      }
      if (typeof length !== 'number' || !Number.isInteger(length) || length < 0 || length > MAX_ARRAY_ELEMENTS) {
        throw new Error('Invalid typed array length');
      }

      const bytesPerElement = TYPED_ARRAY_BYTES_PER_ELEMENT[typeName as CityTypedArrayKind];
      if (byteOffset % bytesPerElement !== 0) {
        throw new Error('ByteOffset not aligned to element size');
      }

      totalArrayElements += length;
      if (totalArrayElements > MAX_ARRAY_ELEMENTS) {
        throw new Error('Exceeded aggregate MAX_ARRAY_ELEMENTS limit');
      }

      if (length > 0 && state === 3) {
        throw new Error('Typed array with elements cannot be frozen');
      }

      const flatPropsRaw = nodeRaw.length >= 7 ? nodeRaw[6] : [];
      const rareOverridesRaw = nodeRaw.length === 8 ? nodeRaw[7] : [];
      validateCustomPropertyList(flatPropsRaw, rareOverridesRaw, state, true, false);
      continue;
    }

    if (kind === 5) {
      if (nodeRaw.length < 5 || nodeRaw.length > 7) {
        throw new Error('Invalid DataView tuple length');
      }
      const bufferId = nodeRaw[2];
      const byteOffset = nodeRaw[3];
      const byteLength = nodeRaw[4];

      if (typeof bufferId !== 'number' || !Number.isInteger(bufferId) || bufferId < 0 || bufferId >= poolLength) {
        throw new Error('Invalid buffer reference');
      }
      if (typeof byteOffset !== 'number' || !Number.isInteger(byteOffset) || byteOffset < 0) {
        throw new Error('Invalid byteOffset');
      }
      if (typeof byteLength !== 'number' || !Number.isInteger(byteLength) || byteLength < 0) {
        throw new Error('Invalid byteLength');
      }

      const flatPropsRaw = nodeRaw.length >= 6 ? nodeRaw[5] : [];
      const rareOverridesRaw = nodeRaw.length === 7 ? nodeRaw[6] : [];
      validateCustomPropertyList(flatPropsRaw, rareOverridesRaw, state, false, false);
      continue;
    }

    throw new Error('Unknown node kind');
  }

  // Pre-verify view buffer boundaries.
  for (let i = 0; i < poolLength; i++) {
    const node = poolRaw[i];
    const kind = node[0];
    if (kind === 4) {
      const typeName = node[2] as CityTypedArrayKind;
      const bufferId = node[3] as number;
      const byteOffset = node[4] as number;
      const length = node[5] as number;
      const bufferNode = poolRaw[bufferId];
      if (bufferNode[0] !== 3) {
        throw new Error('Typed array references non-buffer node');
      }
      const backingByteLength = (bufferNode[2] as string).length / 2;
      const bytesPerElement = TYPED_ARRAY_BYTES_PER_ELEMENT[typeName];
      if (byteOffset + length * bytesPerElement > backingByteLength) {
        throw new Error('Typed array view exceeds backing buffer bounds');
      }
    } else if (kind === 5) {
      const bufferId = node[2] as number;
      const byteOffset = node[3] as number;
      const byteLength = node[4] as number;
      const bufferNode = poolRaw[bufferId];
      if (bufferNode[0] !== 3) {
        throw new Error('DataView references non-buffer node');
      }
      const backingByteLength = (bufferNode[2] as string).length / 2;
      if (byteOffset + byteLength > backingByteLength) {
        throw new Error('DataView exceeds backing buffer bounds');
      }
    }
  }

  const validatedRoot = validateValueDescriptor(detachedPayload.root, poolLength, false);

  return {
    canonicalBody,
    expectedHash: hash,
    keys: keysList,
    pool: poolRaw as unknown as readonly CityGraphNode[],
    root: validatedRoot,
  };
}

function restoreCityGraph(plan: PreparedGraphPlan): unknown {
  const pool = plan.pool;
  const poolLength = pool.length;
  const keysList = plan.keys;
  const allocated: unknown[] = new Array(poolLength);

  // Phase 1a: Allocate basic objects, arrays, maps, and buffers.
  for (let i = 0; i < poolLength; i++) {
    const node = pool[i];
    const kind = node[0];
    if (kind === 0) {
      allocated[i] = node[2] === 1 ? Object.create(null) : {};
    } else if (kind === 1) {
      allocated[i] = new Array((node[3] as unknown[]).length);
    } else if (kind === 2) {
      allocated[i] = new Map();
    } else if (kind === 3) {
      const hex = node[2] as string;
      allocated[i] = hexToArrayBuffer(hex, hex.length / 2);
    }
  }

  // Phase 1b: Allocate typed views and DataViews.
  for (let i = 0; i < poolLength; i++) {
    const node = pool[i];
    const kind = node[0];
    if (kind === 4) {
      const typeName = node[2] as CityTypedArrayKind;
      const bufferId = node[3] as number;
      const byteOffset = node[4] as number;
      const length = node[5] as number;
      const backing = allocated[bufferId] as ArrayBuffer;
      const ctor = TYPED_ARRAY_CONSTRUCTORS[typeName];
      allocated[i] = new ctor(backing, byteOffset, length);
    } else if (kind === 5) {
      const bufferId = node[2] as number;
      const byteOffset = node[3] as number;
      const byteLength = node[4] as number;
      const backing = allocated[bufferId] as ArrayBuffer;
      allocated[i] = new DataView(backing, byteOffset, byteLength);
    }
  }

  function resolveValue(val: CityGraphValue): unknown {
    if (val === null || typeof val === 'boolean' || typeof val === 'string' || typeof val === 'number') {
      return val;
    }
    if (Array.isArray(val)) {
      const tag = val[0];
      if (tag === 'u') {
        return undefined;
      }
      if (tag === 'r') {
        return allocated[val[1] as number];
      }
      if (tag === 'n') {
        return hexToNumber(val[1] as string);
      }
    }
    throw new Error('Malformed value during decoding');
  }

  // Phase 2: Populate Map entries, array elements, and properties.
  for (let i = 0; i < poolLength; i++) {
    const node = pool[i];
    const kind = node[0];
    const target = allocated[i] as object;

    if (kind === 1) {
      const arr = target as unknown[];
      const denseValues = node[3] as CityGraphValue[];
      for (let d = 0; d < denseValues.length; d++) {
        const item = denseValues[d];
        if (Array.isArray(item) && item[0] === 'h') {
          continue;
        }
        const v = resolveValue(item);
        if (UNSAFE_INHERITED_KEYS.has(String(d))) {
          Object.defineProperty(arr, String(d), {
            value: v,
            writable: true,
            enumerable: true,
            configurable: true,
          });
        } else {
          arr[d] = v;
        }
      }

      if (node.length >= 6) {
        const indexOverrides = node[5] as number[];
        for (let io = 0; io < indexOverrides.length; io += 2) {
          const idx = indexOverrides[io];
          const flags = indexOverrides[io + 1];
          Object.defineProperty(arr, String(idx), {
            value: arr[idx],
            writable: (flags & 1) !== 0,
            enumerable: (flags & 2) !== 0,
            configurable: (flags & 4) !== 0,
          });
        }
      }
    } else if (kind === 2) {
      const map = target as Map<unknown, unknown>;
      const flatEntries = node[2] as CityGraphValue[];
      for (let e = 0; e < flatEntries.length; e += 2) {
        MAP_PROTO_SET.call(map, resolveValue(flatEntries[e]), resolveValue(flatEntries[e + 1]));
      }
    }

    // Populate custom properties.
    let flatCustomProps: (number | CityGraphValue)[] = [];
    let customOverrides: number[] = [];

    if (kind === 0) {
      flatCustomProps = (node.length >= 4 ? node[3] : []) as (number | CityGraphValue)[];
      customOverrides = (node.length === 5 ? node[4] : []) as number[];
    } else if (kind === 1) {
      flatCustomProps = (node.length >= 5 ? node[4] : []) as (number | CityGraphValue)[];
      customOverrides = (node.length === 7 ? node[6] : []) as number[];
    } else if (kind === 2) {
      flatCustomProps = (node.length >= 4 ? node[3] : []) as (number | CityGraphValue)[];
      customOverrides = (node.length === 5 ? node[4] : []) as number[];
    } else if (kind === 3) {
      flatCustomProps = (node.length >= 4 ? node[3] : []) as (number | CityGraphValue)[];
      customOverrides = (node.length === 5 ? node[4] : []) as number[];
    } else if (kind === 4) {
      flatCustomProps = (node.length >= 7 ? node[6] : []) as (number | CityGraphValue)[];
      customOverrides = (node.length === 8 ? node[7] : []) as number[];
    } else if (kind === 5) {
      flatCustomProps = (node.length >= 6 ? node[5] : []) as (number | CityGraphValue)[];
      customOverrides = (node.length === 7 ? node[6] : []) as number[];
    }

    const state = node[1] as number;
    const defaultFlags = state === 3 ? 2 : state === 2 ? 3 : 7;
    const isNullProto = kind === 0 && node[2] === 1;

    const overrideMap = new Map<number, number>();
    for (let o = 0; o < customOverrides.length; o += 2) {
      overrideMap.set(customOverrides[o], customOverrides[o + 1]);
    }

    const numProps = flatCustomProps.length / 2;
    for (let p = 0; p < numProps; p++) {
      const k = keysList[flatCustomProps[p * 2] as number];
      const v = resolveValue(flatCustomProps[p * 2 + 1] as CityGraphValue);
      const hasOverride = overrideMap.has(p);
      const flags = hasOverride ? overrideMap.get(p)! : defaultFlags;

      if (flags === 7 && (isNullProto || !UNSAFE_INHERITED_KEYS.has(k))) {
        (target as Record<string, unknown>)[k] = v;
      } else {
        Object.defineProperty(target, k, {
          value: v,
          writable: (flags & 1) !== 0,
          enumerable: (flags & 2) !== 0,
          configurable: (flags & 4) !== 0,
        });
      }
    }

    if (kind === 1) {
      const lengthWritable = node[2] as boolean;
      const denseLength = (node[3] as unknown[]).length;
      Object.defineProperty(target, 'length', {
        value: denseLength,
        writable: lengthWritable,
        enumerable: false,
        configurable: false,
      });
    }
  }

  // Phase 3: Apply integrity states and verify consistency.
  for (let i = 0; i < poolLength; i++) {
    const node = pool[i];
    const target = allocated[i] as object;
    const state = node[1] as number;
    const kind = node[0];

    if (state === 3) {
      Object.freeze(target);
    } else if (state === 2) {
      if (kind === 4 && (node[5] as number) > 0) {
        Object.preventExtensions(target);
      } else {
        Object.seal(target);
      }
    } else if (state === 1) {
      Object.preventExtensions(target);
    }

    if (state === 3) {
      if (!Object.isFrozen(target)) {
        throw new Error('Restored object state mismatch: expected frozen');
      }
    } else if (state === 2) {
      if (!Object.isSealed(target) || Object.isFrozen(target)) {
        throw new Error('Restored object state mismatch: expected sealed');
      }
    } else if (state === 1) {
      if (Object.isExtensible(target)) {
        throw new Error('Restored object state mismatch: expected non-extensible');
      }
      if (kind === 4) {
        if (Object.isFrozen(target)) {
          throw new Error('Restored object state mismatch: expected un-frozen');
        }
      } else {
        if (Object.isSealed(target)) {
          throw new Error('Restored object state mismatch: expected non-extensible unsealed');
        }
      }
    } else if (state === 0) {
      if (!Object.isExtensible(target)) {
        throw new Error('Restored object state mismatch: expected extensible');
      }
    }
  }

  return resolveValue(plan.root);
}

/**
 * Decode a CityGraphPayload into the reconstructed object graph synchronously.
 */
export function decodeCityGraph(payload: unknown): unknown {
  const plan = prepareCityGraph(payload);
  const computedHash = computeSha256Hex(plan.canonicalBody);
  if (computedHash !== plan.expectedHash) {
    throw new Error('Integrity hash mismatch');
  }
  return restoreCityGraph(plan);
}

/**
 * Decode a CityGraphPayload into the reconstructed object graph asynchronously using Web Crypto.
 */
export async function decodeCityGraphAsync(payload: unknown): Promise<unknown> {
  const plan = prepareCityGraph(payload);
  const computedHash = await computeSha256HexWebCrypto(plan.canonicalBody);
  if (computedHash !== plan.expectedHash) {
    throw new Error('Integrity hash mismatch');
  }
  return restoreCityGraph(plan);
}
