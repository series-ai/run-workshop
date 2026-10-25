// Run one arm in each fresh process. Do not run timing processes in parallel.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus, loadavg } from 'node:os';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseRateArm, runRateFixture } from './physics-rate-fixture.mjs';

const options = { sdk: fileURLToPath(new URL('../node_modules/@series-inc/rundot-syncplay/', import.meta.url)), seconds: 16, serializedReplay: false };
for (let index = 2; index < process.argv.length; index++) {
  const flag = process.argv[index];
  if (flag === '--serialized-replay') { options.serializedReplay = true; continue; }
  assert.ok(['--arm', '--output', '--sdk', '--seconds', '--iterations'].includes(flag), `Unknown option: ${flag}`);
  const value = process.argv[++index];
  assert.ok(value && !value.startsWith('--'), `${flag} requires a value.`);
  if (flag === '--seconds') options.seconds = Number(value);
  else if (flag === '--iterations') options.velocityIterations = Number(value);
  else options[flag.slice(2)] = value;
}
parseRateArm(options.arm);
assert.ok(options.output, '--output is required.');
const sdkUrl = pathToFileURL(resolve(options.sdk) + sep);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const { physicsWasmMetadata: metadata, physicsWasmUrl } = await import(new URL('core/src/physics/physics-wasm-module.generated.mjs', sdkUrl));
const wasmSha256 = sha256(await readFile(physicsWasmUrl()));
assert.equal(wasmSha256, metadata.wasmSha256);
assert.equal(metadata.artifact, 'production');
const sdk = await import(new URL('dist/physics/3d.js', sdkUrl));
await sdk.initPhysics3D({ artifact: 'production' });
const { nativePhysicsInstanceMemory: readMemory } = await import(new URL('core/src/physics/world.mjs', sdkUrl));
const environment = { date: new Date().toISOString(), node: process.version, cpu: cpus()[0]?.model, loadStart: loadavg() };
const report = await runRateFixture({ sdk, arm: options.arm, sha256, readMemory, seconds: options.seconds,
  serializedReplay: options.serializedReplay, velocityIterations: options.velocityIterations,
  onProgress: async event => { if (event.complete) console.log(JSON.stringify(event)); } });
Object.assign(report, { schema: 'syncplay-rate-sweep-v1', sdkRoot: resolve(options.sdk), wasmSha256,
  version: JSON.parse(await readFile(new URL('package.json', sdkUrl), 'utf8')).version,
  fixtureSha256: sha256(await readFile(new URL('./physics-rate-fixture.mjs', import.meta.url))),
  runnerSha256: sha256(await readFile(fileURLToPath(import.meta.url))), environment: { ...environment, loadEnd: loadavg() } });
const output = resolve(options.output);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ arm: options.arm, version: report.version, pass: report.pass, output,
  scenes: report.scenes.map(row => ({ scene: row.scene, pass: row.pass, gates: row.gates, error: row.error })) }));
if (!report.pass) process.exitCode = 1;
