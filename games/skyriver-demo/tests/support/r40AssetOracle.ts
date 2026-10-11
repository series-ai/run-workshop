import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { gunzipSync } from 'node:zlib';

export function objectRecord(input: unknown): Record<string, unknown> {
  assert(input !== null && typeof input === 'object' && !Array.isArray(input), 'object record required');
  return input as Record<string, unknown>;
}

export function byteHash(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export interface ActualCityAsset {
  readonly runtime: 'node' | 'browser';
  readonly binding: Record<string, unknown>;
  readonly compressed: Uint8Array;
  readonly raw: Uint8Array;
  readonly envelope: Record<string, unknown>;
  readonly manifest: unknown;
}

export function readActualCityAsset(project: string, runtime: 'node' | 'browser'): ActualCityAsset {
  const directory = join(project, 'src/data', runtime);
  const compressed = new Uint8Array(readFileSync(join(directory, 'city-snapshot-424242.json.gz')));
  const raw = new Uint8Array(gunzipSync(compressed));
  return { runtime, compressed, raw,
    binding: objectRecord(JSON.parse(readFileSync(join(directory, 'city-snapshot-424242.binding.json'), 'utf8'))),
    envelope: objectRecord(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw))),
    manifest: JSON.parse(readFileSync(join(directory, 'source-manifest.json'), 'utf8')) };
}

function sourcePaths(project: string): string[] {
  const found: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        found.push(relative(project, path).split('\\').join('/'));
      }
    }
  };
  visit(join(project, 'src'));
  return found.sort();
}

/** Read real files and hashes. Do not call the generator main function. */
export function verifyActualAsset(project: string, asset: ActualCityAsset): { sourceDigest: string; sourceFiles: number } {
  const generator = objectRecord(createRequire(import.meta.url)(join(project, 'tools/generate-city-snapshot.cjs')));
  assert(typeof generator.computeSourceManifest === 'function');
  const generated: unknown = generator.computeSourceManifest(project);
  const current = objectRecord(generated);
  assert(Array.isArray(current.records));
  assert.deepEqual(asset.manifest, current.records);
  const records = current.records.map((input: unknown) => {
    const record = objectRecord(input);
    assert(typeof record.path === 'string');
    assert(typeof record.sha256 === 'string');
    assert(typeof record.byteLength === 'number');
    const bytes = readFileSync(join(project, record.path));
    assert.equal(byteHash(bytes), record.sha256, record.path + ':source-sha');
    assert.equal(bytes.byteLength, record.byteLength, record.path + ':source-length');
    return record;
  });
  assert.deepEqual(records.map(record => record.path), records.map(record => record.path).sort());
  const actualTs = records.map(record => record.path as string).filter(path => path.startsWith('src/') && path.endsWith('.ts'));
  assert.deepEqual(actualTs, sourcePaths(project), 'all actual source TypeScript files must be bound');
  const sourceDigest = byteHash(JSON.stringify(records));
  assert.equal(current.digest, sourceDigest, 'independent source-manifest digest');
  const binding = asset.binding, envelope = asset.envelope;
  assert.equal(binding.sourceManifestDigest, sourceDigest);
  assert.equal(binding.codecVersion, 2);
  assert.equal(binding.runtime, asset.runtime);
  assert.equal(binding.canonicalSeed, 424242);
  assert.equal(binding.gzipBytes, asset.compressed.byteLength);
  assert.equal(binding.gzipSha256, byteHash(asset.compressed));
  assert.equal(binding.payloadBytes, asset.raw.byteLength);
  assert.equal(binding.payloadSha256, byteHash(asset.raw));
  assert.deepEqual(Object.keys(binding), ['codecVersion', 'runtime', 'canonicalSeed', 'sourceManifestDigest',
    'layoutSignature', 'payloadHash', 'payloadBytes', 'payloadSha256', 'gzipBytes', 'gzipSha256']);
  assert.deepEqual(Object.keys(envelope), ['version', 'runtime', 'canonicalSeed', 'sourceManifestDigest', 'layoutSignature', 'payload']);
  assert.equal(envelope.version, 1);
  for (const key of ['runtime', 'canonicalSeed', 'sourceManifestDigest', 'layoutSignature']) assert.equal(envelope[key], binding[key]);
  const payload = objectRecord(envelope.payload);
  assert.equal(payload.version, binding.codecVersion);
  assert.equal(payload.hash, binding.payloadHash);
  assert.deepEqual(Object.keys(payload), ['version', 'keys', 'root', 'pool', 'hash']);
  const graphBody = { version: payload.version, keys: payload.keys, root: payload.root, pool: payload.pool };
  assert.equal(byteHash(JSON.stringify(graphBody)), payload.hash, 'independent graph SHA');
  return { sourceDigest, sourceFiles: records.length };
}
