import type { SkyriverCityLayout } from '../sim/derive';
import { deriveCityLayout } from '../sim/derive';
import { presentCityLayout } from './presentationLayout';
import { installCitySnapshot } from './city';
import {
  CITY_GRAPH_SCHEMA_VERSION,
  decodeCityGraphAsync,
  encodeCityGraph,
} from './citySnapshotCodec';

export interface CitySnapshotBinding {
  readonly codecVersion: number;
  readonly runtime: 'node' | 'browser';
  readonly canonicalSeed: number;
  readonly sourceManifestDigest: string;
  readonly layoutSignature: string;
  readonly payloadHash: string;
  readonly payloadBytes: number;
  readonly payloadSha256: string;
  readonly gzipBytes: number;
  readonly gzipSha256: string;
}

export interface CitySnapshotLoadResult {
  readonly mode: 'cache' | 'pure-fallback';
  readonly reason?: string;
  readonly prepareMs: number;
  readonly decompressMs?: number;
  readonly decodeMs?: number;
  readonly installMs?: number;
  readonly layoutSignature?: string;
  readonly payloadHash?: string;
  readonly gzipBytes?: number;
  readonly payloadBytes?: number;
}

export interface SkyriverColdStartDiagnostic extends CitySnapshotLoadResult {
  readonly preparationEndMs: number;
  readonly appPublishMs?: number;
  readonly derivationCompleteMs?: number;
}

const MAX_RAW_PAYLOAD_BYTES = 64 * 1024 * 1024; // 64 MiB
const MAX_GZIP_PAYLOAD_BYTES = 16 * 1024 * 1024; // 16 MiB

function parseBinding(input: unknown): CitySnapshotBinding {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid binding: not an object');
  }
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) {
    throw new Error('Invalid binding: invalid prototype');
  }

  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(descriptors);
  for (const key of keys) {
    if (typeof key !== 'string') {
      throw new Error('Invalid binding: symbol property');
    }
    const desc = descriptors[key];
    if (!desc || desc.get !== undefined || desc.set !== undefined || !('value' in desc)) {
      throw new Error(`Invalid binding: accessor property: ${key}`);
    }
  }

  const getFieldValue = (field: string): unknown => {
    const desc = descriptors[field];
    if (!desc || desc.get !== undefined || desc.set !== undefined || !('value' in desc)) {
      throw new Error(`Invalid binding: missing property: ${field}`);
    }
    return desc.value;
  };

  const codecVersion = getFieldValue('codecVersion');
  if (typeof codecVersion !== 'number' || codecVersion !== CITY_GRAPH_SCHEMA_VERSION) {
    throw new Error(`Invalid binding: codecVersion must be ${CITY_GRAPH_SCHEMA_VERSION}`);
  }

  const runtime = getFieldValue('runtime');
  if (runtime !== 'node' && runtime !== 'browser') {
    throw new Error('Invalid binding: runtime must be node or browser');
  }

  const canonicalSeed = getFieldValue('canonicalSeed');
  if (canonicalSeed !== 424242) {
    throw new Error('Invalid binding: canonicalSeed must be 424242');
  }

  const sourceManifestDigest = getFieldValue('sourceManifestDigest');
  if (typeof sourceManifestDigest !== 'string' || !/^[0-9a-f]{64}$/.test(sourceManifestDigest)) {
    throw new Error('Invalid binding: sourceManifestDigest');
  }

  const layoutSignature = getFieldValue('layoutSignature');
  if (typeof layoutSignature !== 'string' || !/^[0-9a-f]{64}$/.test(layoutSignature)) {
    throw new Error('Invalid binding: layoutSignature');
  }

  const payloadHash = getFieldValue('payloadHash');
  if (typeof payloadHash !== 'string' || !/^[0-9a-f]{64}$/.test(payloadHash)) {
    throw new Error('Invalid binding: payloadHash');
  }

  const payloadSha256 = getFieldValue('payloadSha256');
  if (typeof payloadSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(payloadSha256)) {
    throw new Error('Invalid binding: payloadSha256');
  }

  const gzipSha256 = getFieldValue('gzipSha256');
  if (typeof gzipSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(gzipSha256)) {
    throw new Error('Invalid binding: gzipSha256');
  }

  const payloadBytes = getFieldValue('payloadBytes');
  if (
    typeof payloadBytes !== 'number' ||
    !Number.isSafeInteger(payloadBytes) ||
    payloadBytes <= 0 ||
    payloadBytes > MAX_RAW_PAYLOAD_BYTES
  ) {
    throw new Error(
      `Invalid binding: payloadBytes must be positive safe integer <= ${MAX_RAW_PAYLOAD_BYTES}`,
    );
  }

  const gzipBytes = getFieldValue('gzipBytes');
  if (
    typeof gzipBytes !== 'number' ||
    !Number.isSafeInteger(gzipBytes) ||
    gzipBytes <= 0 ||
    gzipBytes > MAX_GZIP_PAYLOAD_BYTES
  ) {
    throw new Error(
      `Invalid binding: gzipBytes must be positive safe integer <= ${MAX_GZIP_PAYLOAD_BYTES}`,
    );
  }

  return {
    codecVersion,
    runtime,
    canonicalSeed,
    sourceManifestDigest,
    layoutSignature,
    payloadHash,
    payloadBytes,
    payloadSha256,
    gzipBytes,
    gzipSha256,
  };
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const ownedBuffer =
    bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
      ? bytes.buffer
      : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const hashBuf = await globalThis.crypto.subtle.digest('SHA-256', ownedBuffer);
  const hashArr = new Uint8Array(hashBuf);
  let hex = '';
  for (let i = 0; i < hashArr.length; i += 1) {
    hex += hashArr[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

async function decompressGzip(
  compressed: Uint8Array<ArrayBuffer>,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream not available in environment');
  }
  const ownedBuffer =
    compressed.byteOffset === 0 && compressed.byteLength === compressed.buffer.byteLength
      ? compressed.buffer
      : compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength);
  const stream = new Blob([ownedBuffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalLength += value.byteLength;
        if (totalLength > maxBytes) {
          await reader.cancel(new Error(`Decompressed payload exceeds maximum size limit: ${maxBytes}`));
          throw new Error(`Decompressed payload exceeds maximum size limit: ${maxBytes}`);
        }
        chunks.push(value);
      }
    }
  } catch (err) {
    await reader.cancel(err).catch(() => {});
    throw err;
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(new ArrayBuffer(totalLength));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

/**
 * Shared asynchronous loading boundary.
 * Validates binding and gzip payload, decompresses, decodes graph, and installs cache.
 * Never executes pure city derivation during validation.
 */
export async function prepareCitySnapshot(
  layout: SkyriverCityLayout,
  bindingInput: unknown,
  compressed: Uint8Array,
  expectedRuntime: 'node' | 'browser' = 'browser',
): Promise<CitySnapshotLoadResult> {
  const startMs = performance.now();
  if (!(compressed instanceof Uint8Array)) {
    return {
      mode: 'pure-fallback',
      reason: 'Invalid compressed input: not a Uint8Array',
      prepareMs: 0,
    };
  }
  // Copy compressed Uint8Array once at entry before the first await,
  // using a private ArrayBuffer-backed copy to prevent caller mutation between hash and use.
  const privateCompressed = new Uint8Array(new ArrayBuffer(compressed.byteLength));
  privateCompressed.set(compressed);

  try {
    const binding = parseBinding(bindingInput);
    if (binding.runtime !== expectedRuntime) {
      throw new Error(`Runtime mismatch: expected ${expectedRuntime}, got ${binding.runtime}`);
    }
    if (layout.seed !== binding.canonicalSeed) {
      throw new Error(`Canonical seed mismatch: expected ${binding.canonicalSeed}, got ${layout.seed}`);
    }

    const layoutGraph = encodeCityGraph(layout);
    if (layoutGraph.hash !== binding.layoutSignature) {
      throw new Error(`Layout signature mismatch: expected ${binding.layoutSignature}, got ${layoutGraph.hash}`);
    }

    if (privateCompressed.byteLength !== binding.gzipBytes) {
      throw new Error(`Gzip byte length mismatch: expected ${binding.gzipBytes}, got ${privateCompressed.byteLength}`);
    }

    const computedGzipSha = await sha256Hex(privateCompressed);
    if (computedGzipSha !== binding.gzipSha256) {
      throw new Error(`Gzip SHA-256 mismatch: expected ${binding.gzipSha256}, got ${computedGzipSha}`);
    }

    const tDecompress0 = performance.now();
    const decompressed = await decompressGzip(privateCompressed, binding.payloadBytes);
    const decompressMs = performance.now() - tDecompress0;

    if (decompressed.byteLength !== binding.payloadBytes) {
      throw new Error(`Payload byte length mismatch: expected ${binding.payloadBytes}, got ${decompressed.byteLength}`);
    }

    const computedPayloadSha = await sha256Hex(decompressed);
    if (computedPayloadSha !== binding.payloadSha256) {
      throw new Error(`Payload SHA-256 mismatch: expected ${binding.payloadSha256}, got ${computedPayloadSha}`);
    }

    const text = new TextDecoder('utf-8', { fatal: true }).decode(decompressed);
    const rawEnvelope: unknown = JSON.parse(text);

    function parseSnapshotEnvelope(raw: unknown): {
      readonly version: unknown;
      readonly runtime: unknown;
      readonly canonicalSeed: unknown;
      readonly sourceManifestDigest: unknown;
      readonly layoutSignature: unknown;
      readonly payload: unknown;
      readonly payloadRecord: Record<string, unknown>;
    } {
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('Invalid snapshot envelope: expected record');
      }
      const rec = raw as Record<string, unknown>;
      const requiredFields = [
        'version',
        'runtime',
        'canonicalSeed',
        'sourceManifestDigest',
        'layoutSignature',
        'payload',
      ] as const;
      for (const field of requiredFields) {
        if (!Object.prototype.hasOwnProperty.call(rec, field)) {
          throw new Error(`Missing envelope field: ${field}`);
        }
      }
      const payload = rec.payload;
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Envelope payload hash mismatch');
      }
      return {
        version: rec.version,
        runtime: rec.runtime,
        canonicalSeed: rec.canonicalSeed,
        sourceManifestDigest: rec.sourceManifestDigest,
        layoutSignature: rec.layoutSignature,
        payload,
        payloadRecord: payload as Record<string, unknown>,
      };
    }

    const envelope = parseSnapshotEnvelope(rawEnvelope);

    if (envelope.version !== 1) {
      throw new Error(`Envelope version mismatch: expected 1, got ${String(envelope.version)}`);
    }
    if (envelope.runtime !== binding.runtime) {
      throw new Error(`Envelope runtime mismatch: expected ${binding.runtime}, got ${String(envelope.runtime)}`);
    }
    if (envelope.canonicalSeed !== binding.canonicalSeed) {
      throw new Error(`Envelope canonicalSeed mismatch: expected ${binding.canonicalSeed}, got ${String(envelope.canonicalSeed)}`);
    }
    if (envelope.sourceManifestDigest !== binding.sourceManifestDigest) {
      throw new Error('Envelope source manifest digest mismatch');
    }
    if (envelope.layoutSignature !== binding.layoutSignature) {
      throw new Error('Envelope layout signature mismatch');
    }
    if (envelope.payloadRecord.hash !== binding.payloadHash) {
      throw new Error('Envelope payload hash mismatch');
    }
    if (envelope.payloadRecord.version !== CITY_GRAPH_SCHEMA_VERSION) {
      throw new Error(
        `Envelope payload schema version mismatch: expected ${CITY_GRAPH_SCHEMA_VERSION}, got ${String(envelope.payloadRecord.version)}`,
      );
    }

    const tDecode0 = performance.now();
    const decodedSnapshot = await decodeCityGraphAsync(envelope.payload);
    const decodeMs = performance.now() - tDecode0;

    const tInstall0 = performance.now();
    installCitySnapshot(layout, decodedSnapshot);
    const installMs = performance.now() - tInstall0;

    const prepareMs = performance.now() - startMs;

    return {
      mode: 'cache',
      prepareMs,
      decompressMs,
      decodeMs,
      installMs,
      layoutSignature: binding.layoutSignature,
      payloadHash: binding.payloadHash,
      gzipBytes: binding.gzipBytes,
      payloadBytes: binding.payloadBytes,
    };
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      mode: 'pure-fallback',
      reason,
      prepareMs: performance.now() - startMs,
    };
  }
}

/**
 * Browser preparation adapter.
 * Fetches canonical assets, prepares snapshot, and returns load diagnostic.
 * Falls back cleanly to pure derivation if assets are missing or invalid.
 */
export async function prepareBrowserCitySnapshot(
  layout?: SkyriverCityLayout,
): Promise<CitySnapshotLoadResult> {
  const startMs = performance.now();
  try {
    const activeLayout = layout ?? presentCityLayout(deriveCityLayout(424242));

    const bindingUrl = new URL('../data/browser/city-snapshot-424242.binding.json', import.meta.url);
    const gzipUrl = new URL('../data/browser/city-snapshot-424242.json.gz', import.meta.url);

    const [bindingRes, gzipRes] = await Promise.all([
      fetch(bindingUrl),
      fetch(gzipUrl),
    ]);

    if (!bindingRes.ok) {
      return {
        mode: 'pure-fallback',
        reason: `binding-fetch-failed:${bindingRes.status}`,
        prepareMs: performance.now() - startMs,
      };
    }
    if (!gzipRes.ok) {
      return {
        mode: 'pure-fallback',
        reason: `gzip-fetch-failed:${gzipRes.status}`,
        prepareMs: performance.now() - startMs,
      };
    }

    const [bindingJson, gzipArrayBuffer] = await Promise.all([
      bindingRes.json(),
      gzipRes.arrayBuffer(),
    ]);

    const compressed = new Uint8Array(gzipArrayBuffer);
    const result = await prepareCitySnapshot(activeLayout, bindingJson, compressed, 'browser');
    return {
      ...result,
      prepareMs: performance.now() - startMs,
    };
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      mode: 'pure-fallback',
      reason,
      prepareMs: performance.now() - startMs,
    };
  }
}
