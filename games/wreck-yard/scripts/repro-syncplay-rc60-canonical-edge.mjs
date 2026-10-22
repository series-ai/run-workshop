import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const options = {};
for (let index = 2; index < process.argv.length; index += 1) {
  const flag = process.argv[index];
  assert.ok(['--sdk', '--control', '--out'].includes(flag), `Unknown option: ${flag}`);
  const value = process.argv[++index];
  assert.ok(value && !value.startsWith('--'), `${flag} requires a path`);
  options[flag.slice(2)] = resolve(value);
}
assert.ok(options.sdk && options.control && options.out,
  'Use --sdk <new package> --control <old package> --out <new JSON file>.');

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const load = async root => ({
  root,
  version: JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version,
  canonical: await import(pathToFileURL(join(root, 'dist/canonical.js')).href),
  wire: await import(pathToFileURL(join(root, 'dist/session-wire.js')).href),
  hashes: Object.fromEntries(await Promise.all(['dist/canonical.js', 'dist/session-wire.js'].map(async file =>
    [file, sha256(await readFile(join(root, file)))]))),
});
const versions = [await load(options.control), await load(options.sdk)];
const protocol = 'rdm-local-authority/v2';

// The wire checksum consumes UTF-16 code units. Buffer supplies the code units independently.
function checksum(text) {
  const units = Buffer.from(text, 'utf16le');
  let value = 14695981039346656037n;
  for (let offset = 0; offset < units.length; offset += 2) {
    value = ((value ^ BigInt(units.readUInt16LE(offset))) * 1099511628211n) % (2n ** 64n);
  }
  return value.toString(16).padStart(16, '0');
}
function envelope(payload, overrides = {}) {
  const body = { kind: 'input', payload, protocol, v: 2, ...overrides };
  return JSON.stringify({ checksum: checksum(JSON.stringify(body)), ...body });
}
function fixtures() {
  const backing = Uint8Array.from([201, 202, 0, 1, 127, 128, 254, 255, 203, 204]);
  return {
    backing,
    cases: [
      { name: 'unicode-and-lone-surrogates', value: { z: 'quote" slash\\ nul\0', a: '雪😀\u2028\u2029\ud800x\udfff' },
        expected: { a: '雪😀\u2028\u2029\ud800x\udfff', z: 'quote" slash\\ nul\0' } },
      { name: 'offset-u8', value: new Uint8Array(backing.buffer, 2, 6),
        expected: { $rdm: 'typed-array', constructor: 'Uint8Array', bytes: [0, 1, 127, 128, 254, 255] } },
      { name: 'offset-data-view', value: new DataView(backing.buffer, 3, 4),
        expected: { $rdm: 'typed-array', constructor: 'DataView', bytes: [1, 127, 128, 254] } },
      { name: 'empty-offset-u8', value: new Uint8Array(backing.buffer, 5, 0),
        expected: { $rdm: 'typed-array', constructor: 'Uint8Array', bytes: [] } },
      { name: 'special-numbers', value: [NaN, Infinity, -Infinity, -0, undefined, 12345678901234567890n],
        expected: [{ $rdm: 'nan' }, { $rdm: 'infinity' }, { $rdm: 'negative-infinity' },
          { $rdm: 'negative-zero' }, { $rdm: 'undefined' }, { $rdm: 'bigint', value: '12345678901234567890' }] },
      { name: 'map-sorted-keys', value: new Map([['雪', 2], ['a', 1]]),
        expected: { $rdm: 'map', entries: [['a', 1], ['雪', 2]] } },
      { name: 'set-sorted-values', value: new Set(['雪', 'a', '😀']),
        expected: { $rdm: 'set', values: ['a', '雪', '😀'] } },
    ],
  };
}

const report = { schema: 'syncplay-canonical-wire-edge-v1', node: process.version,
  fixtureSha256: sha256(await readFile(new URL(import.meta.url))),
  versions: versions.map(({ root, version, hashes }) => ({ root, version, hashes })),
  contracts: ['explicit canonical trees and exact wire bytes; cross-version decode; unchanged source bytes',
    'malformed session input fails closed without throwing'], checks: [] };
function check(name, operation) {
  const row = { name }; report.checks.push(row);
  try { Object.assign(row, operation()); row.pass = true; }
  catch (error) { row.pass = false; row.error = { name: error.name, message: error.message }; }
}

for (const implementation of versions) {
  const { backing, cases } = fixtures();
  const originalBytes = Array.from(backing);
  for (const fixture of cases) check(`${implementation.version}:${fixture.name}`, () => {
    const canonical = implementation.canonical.canonicalize(fixture.value);
    assert.deepEqual(canonical, fixture.expected);
    const expectedCanonicalJson = JSON.stringify(fixture.expected);
    assert.deepEqual(Array.from(implementation.canonical.encodeCanonicalBytes(fixture.value)),
      Array.from(Buffer.from(expectedCanonicalJson, 'utf8')));
    const message = { kind: 'input', slot: 0, tick: 37, input: canonical, attempt: 0 };
    const expectedWire = envelope({ attempt: 0, input: fixture.expected, slot: 0, tick: 37 });
    const wire = implementation.wire.encodeDeterministicSessionMessage(message);
    assert.equal(wire, expectedWire);
    for (const decoder of versions) {
      const decoded = decoder.wire.decodeDeterministicSessionMessage(wire);
      assert.equal(decoded.ok, true);
      assert.deepEqual(decoder.canonical.canonicalize(decoded.message.input), fixture.expected);
      if (fixture.name === 'offset-u8' || fixture.name === 'empty-offset-u8') {
        assert.ok(decoded.message.input instanceof Uint8Array);
        assert.deepEqual(Array.from(decoded.message.input), fixture.expected.bytes);
      }
      if (fixture.name === 'offset-data-view') {
        assert.ok(decoded.message.input instanceof DataView);
        assert.deepEqual(Array.from(new Uint8Array(decoded.message.input.buffer,
          decoded.message.input.byteOffset, decoded.message.input.byteLength)), fixture.expected.bytes);
      }
    }
    assert.deepEqual(Array.from(backing), originalBytes);
    return { wireSha256: sha256(wire), wireUtf8Bytes: Buffer.byteLength(wire), decoders: versions.map(v => v.version) };
  });
}

const basePayload = { attempt: 0, input: { key: '雪😀' }, slot: 0, tick: 37 };
const valid = envelope(basePayload);
const tampered = JSON.parse(valid); tampered.payload.tick += 1;
const malformed = [
  ['invalid-json', '{', 'invalid-json'],
  ['checksum-tamper', JSON.stringify(tampered), 'checksum-mismatch'],
  ['unknown-protocol', envelope(basePayload, { protocol: 'unrecognized' }), 'unknown-protocol'],
  ['unknown-version', envelope(basePayload, { v: 999 }), 'unknown-version'],
  ['unknown-kind', envelope(basePayload, { kind: 'unrecognized' }), 'unknown-kind'],
  ['invalid-bigint-tag', envelope({ ...basePayload, input: { $rdm: 'bigint', value: 'bad-number' } }), 'malformed-payload'],
  ['invalid-map-tag', envelope({ ...basePayload, input: { $rdm: 'map', entries: 4 } }), 'malformed-payload'],
  ['unknown-typed-array', envelope({ ...basePayload, input: { $rdm: 'typed-array', constructor: 'UnknownArray', bytes: [1] } }), 'malformed-payload'],
];
for (const implementation of versions) for (const [name, wire, reason] of malformed) {
  check(`${implementation.version}:reject:${name}`, () => {
    const result = implementation.wire.decodeDeterministicSessionMessage(wire);
    assert.deepEqual(result, { ok: false, reason });
    return { reason };
  });
}
report.pass = report.checks.every(row => row.pass);
report.limits = ['Source-level canonical and session-envelope contracts only. No authority, replay runtime, WASM, browser, or timing coverage.',
  'Only existing public function names are called. The implementation files avoid loading unrelated package entry points.',
  'New internal fixed-point helpers are not called. No claim covers hostile getters, array species, or reentrant serialization.'];
await mkdir(dirname(options.out), { recursive: true });
await writeFile(options.out, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ pass: report.pass, checks: report.checks.length, out: options.out }));
if (!report.pass) process.exitCode = 1;
