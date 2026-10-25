import { RATE_ARMS, parseRateArm, runRateFixture } from './physics-rate-fixture.mjs';
import * as sdk from '/sdk/dist/physics/3d.js';
import { nativePhysicsInstanceMemory as readMemory } from '/sdk/core/src/physics/world.mjs';
import { physicsWasmMetadata as metadata, physicsWasmUrl } from '/sdk/core/src/physics/physics-wasm-module.generated.mjs';

const armSelect = document.querySelector('#arm'), runButton = document.querySelector('#run');
const iterations = document.querySelector('#iterations');
const progress = document.querySelector('#progress'), result = document.querySelector('#result'), download = document.querySelector('#download');
for (const arm of RATE_ARMS) armSelect.add(new Option(arm, arm));
const params = new URLSearchParams(location.search);
armSelect.value = params.get('arm') ?? '30x6';
iterations.value = params.get('iterations') ?? '6';
parseRateArm(armSelect.value);
const sha256 = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
async function run() {
  runButton.disabled = true; download.disabled = true; armSelect.disabled = true; iterations.disabled = true;
  window.__RATE_REPORT__ = null; window.__RATE_ERROR__ = null;
  try {
    progress.textContent = 'Verify the production artifact.';
    const wasm = new Uint8Array(await (await fetch(physicsWasmUrl())).arrayBuffer());
    const wasmSha256 = await sha256(wasm);
    if (wasmSha256 !== metadata.wasmSha256 || metadata.artifact !== 'production') throw new Error('Artifact verification failed.');
    await sdk.initPhysics3D({ artifact: 'production' });
    const packageInfo = await (await fetch('/sdk/package.json')).json();
    const fixtureSha256 = await sha256(new Uint8Array(await (await fetch('/scripts/physics-rate-fixture.mjs')).arrayBuffer()));
    const hardware = { userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemoryGiB: navigator.deviceMemory ?? null, dpr: devicePixelRatio, secureContext: isSecureContext,
      uaData: await navigator.userAgentData?.getHighEntropyValues(['model', 'platformVersion', 'architecture']) ?? null };
    const report = await runRateFixture({ sdk, arm: armSelect.value, sha256, readMemory,
      seconds: Number(params.get('seconds') ?? 16), serializedReplay: params.get('serialized') === '1', velocityIterations: Number(iterations.value),
      onProgress: async event => { progress.textContent = JSON.stringify(event, null, 2); } });
    Object.assign(report, { schema: 'syncplay-rate-sweep-browser-v1', version: packageInfo.version, wasmSha256, fixtureSha256,
      environment: { date: new Date().toISOString(), hardware, execution: 'browser-main-thread; no rendering or CPU emulation' } });
    window.__RATE_REPORT__ = report;
    result.textContent = JSON.stringify({ pass: report.pass, arm: report.arm, velocityIterations: report.definition.velocityIterations, version: report.version,
      scenes: report.scenes.map(row => ({ scene: row.scene, pass: row.pass, apiMsPerSimulatedSecond: row.apiMsPerSimulatedSecond, gates: row.gates, error: row.error })) }, null, 2);
    progress.textContent = 'Test complete.'; download.disabled = false;
  } catch (error) { window.__RATE_ERROR__ = error.stack ?? error.message; result.textContent = window.__RATE_ERROR__; }
  finally { runButton.disabled = false; armSelect.disabled = false; iterations.disabled = false; }
}
runButton.onclick = run;
download.onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(window.__RATE_REPORT__, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `physics-${window.__RATE_REPORT__.version}-${window.__RATE_REPORT__.configurationId}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
window.__RATE_READY__ = true;
if (params.get('run') === '1') await run();
