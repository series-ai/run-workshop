#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const Module = require('node:module');
const assert = require('node:assert/strict');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const FEATURES = ['windows', 'spill', 'interior', 'volume', 'traffic', 'streaks'];
const STEP_MS = 16;
const CHUNK_FRAMES = 16;
const MAX_WALL_MS = 1800000;
const FEATURE_CONTROL_GATE = Object.freeze({ statistic: 'valid non-disjoint per-frame full-lap GPU P95', percentileMethod: 'nearest rank', thresholdMs: 4.5, strictGreater: true });
let interrupted = false;
let ownedBrowser = null;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { interrupted = true; void ownedBrowser?.close(); });
function printHelp() {
  console.log(`Usage:
  node tools/render-evidence/full-lap-gpu.cjs --artifact <path> --out <path> [options]

Preflight example (non-GPU, does not launch browser or acquire lock):
  node tools/render-evidence/full-lap-gpu.cjs \\
    --artifact artifacts/proof/proof-manifest.json \\
    --out out/preflight-test

Options:
  --artifact <path>      Path to artifact JSON (required).
  --out <path>           Fresh output directory (required).
  --source-root <path>   Path to games/skyriver-demo root (default: inferred from tool location).
  --seed <uint32>        Random seed (default: 424242).
  --dpr <1.0|1.25>       Device pixel ratio (default: 1.25).
  --volume-steps <4|8>   Volume raymarch steps (default: 8).
  --gpu-lock <path>      Lock file path (default: os.tmpdir()/skyriver-proof-gpu.lock).
  --execute authorized   Execute GPU benchmark (already authorized execution).
  --ab conditional       Run conditional A/B feature controls if baseline P95 > 4.5ms.
  --url <url>            Base URL of the running demo (required with --execute).
  --epoch-utc <iso-date> UTC epoch timestamp (required with --execute).
  --self-test            Run harness CPU self-test.
  --help                 Show this help message.`);
}
function statistics(values) {
  assert(values.length > 0 && values.every(x => Number.isFinite(x) && x >= 0));
  const sorted = [...values].sort((a, b) => a - b), n = sorted.length;
  return { n, median: n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
    mean: sorted.reduce((a, b) => a + b, 0) / n,
    p95: sorted[Math.ceil(n * 0.95) - 1], p99: sorted[Math.ceil(n * 0.99) - 1], min: sorted[0], max: sorted[n - 1] };
}
function conditionalControlsRequired(frameStatistics) {
  assert(Number.isInteger(frameStatistics.n) && frameStatistics.n > 0 && Number.isFinite(frameStatistics.p95), 'Invalid full-lap frame statistics.');
  return frameStatistics.p95 > FEATURE_CONTROL_GATE.thresholdMs;
}
function validateDpr(val = '1.25') {
  const str = String(val);
  assert(['1.0', '1', '1.25'].includes(str), 'Invalid --dpr.');
  return Number(str);
}
function validateVolumeSteps(val = '8') {
  const str = String(val);
  assert(['4', '8'].includes(str), 'Invalid --volume-steps.');
  return Number(str);
}
function config(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return { help: true };
  }
  const a = {};
  for (let i = 0; i < argv.length; i += 2) {
    assert(/^--[a-z-]+$/.test(argv[i]) && argv[i + 1] !== undefined, 'Use named argument pairs.');
    const key = argv[i].slice(2); assert(a[key] === undefined, 'Duplicate argument: ' + key); a[key] = argv[i + 1];
  }
  const allowed = ['url', 'source-root', 'artifact', 'out', 'seed', 'epoch-utc', 'execute', 'ab', 'dpr', 'volume-steps', 'gpu-lock'];
  for (const key of Object.keys(a)) assert(allowed.includes(key), 'Unknown argument: ' + key);
  for (const key of ['artifact', 'out']) assert(a[key], 'Missing --' + key);
  const sourceRoot = a['source-root'] ? path.resolve(a['source-root']) : path.resolve(__dirname, '../..');
  assert(fs.existsSync(sourceRoot), 'Source root does not exist: ' + sourceRoot);
  const artifact = path.resolve(a.artifact);
  assert(fs.existsSync(artifact), 'Artifact does not exist: ' + artifact);
  const out = path.resolve(a.out);
  const seed = a.seed !== undefined ? Number(a.seed) : 424242;
  assert(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, 'Invalid seed.');
  const dpr = validateDpr(a.dpr);
  const volumeSteps = validateVolumeSteps(a['volume-steps']);
  const gpuLock = a['gpu-lock'] ? path.resolve(a['gpu-lock']) : path.join(os.tmpdir(), 'skyriver-proof-gpu.lock');
  if (a.execute !== undefined) assert(a.execute === 'authorized', 'Use --execute authorized only after run approval.');
  if (a.ab !== undefined) assert(a.ab === 'conditional', 'Use --ab conditional.');
  if (a.execute) {
    assert(a.url && a['epoch-utc'], 'Execution needs --url and --epoch-utc.');
    const url = new URL(a.url); assert(['http:', 'https:'].includes(url.protocol));
    assert(url.search === '' && url.pathname.endsWith('/'), 'Use a directory base URL without feature overrides.');
    assert(Number.isFinite(Date.parse(a['epoch-utc'])), 'Invalid epoch.');
  }
  return { ...a, 'source-root': sourceRoot, artifact, out, seed, dpr, volumeSteps, 'volume-steps': volumeSteps, 'gpu-lock': gpuLock };
}
function bindings(c) {
  const artifact = readJson(c.artifact); const rows = [];
  for (const group of ['source', 'dist']) {
    assert(artifact[group] && Object.keys(artifact[group]).length, 'Artifact needs source and dist hash maps.');
    for (const [relative, expected] of Object.entries(artifact[group])) {
      assert(/^[a-f0-9]{64}$/.test(expected), 'Invalid artifact hash.');
      const base = group === 'dist' ? path.join(c['source-root'], 'dist') : c['source-root'];
      const file = path.resolve(base, relative); assert(file.startsWith(base + path.sep), 'Unsafe artifact path.');
      const actual = sha(fs.readFileSync(file)); rows.push({ group, relative, expected, actual });
      assert(actual === expected, 'Frozen artifact mismatch: ' + file);
    }
  }
  assert(artifact.dist && artifact.dist['index.html'], 'Artifact dist must include index.html binding.');
  if (artifact.external !== undefined) {
    assert(typeof artifact.external === 'object' && artifact.external !== null && !Array.isArray(artifact.external), 'Artifact external must be a plain object.');
    for (const [rawUrl, expectedHash] of Object.entries(artifact.external)) {
      assert(/^https?:\/\/.+/.test(rawUrl), 'External artifact key must be an HTTP(S) absolute URL: ' + rawUrl);
      const parsedUrl = new URL(rawUrl);
      assert(['http:', 'https:'].includes(parsedUrl.protocol), 'External URL must use http: or https:');
      assert(typeof expectedHash === 'string' && /^[a-f0-9]{64}$/.test(expectedHash), 'Invalid external artifact hash: ' + expectedHash);
      rows.push({ group: 'external', url: rawUrl, expected: expectedHash });
    }
  }
  for (const file of ['src/main.ts', 'src/render/scene.ts', 'src/render/flightPresentation.ts', 'src/render/canyonWarp.ts', 'src/render/traffic.ts', 'src/render/city.ts', 'src/sim/systems.ts']) {
    assert(artifact.source[file], 'Missing method source binding: ' + file);
  }
  return { artifactSha256: sha(fs.readFileSync(c.artifact)), harnessSha256: sha(fs.readFileSync(__filename)), rows, artifact };
}
function lap(c) {
  const root = c['source-root'];
  const esbuild = require(path.join(root, 'node_modules/esbuild'));
  const entry = `import {createFlightPresenter} from ${JSON.stringify(path.join(root, 'src/render/flightPresentation.ts'))};
import {deriveFlightPath} from ${JSON.stringify(path.join(root, 'src/sim/systems.ts'))};
const presenter = createFlightPresenter(${c.seed});
module.exports = {seed:${c.seed},trackLengthM:presenter.trackLength,speedMps:presenter.autopilotSpeedMps,
  lapSeconds:presenter.trackLength/presenter.autopilotSpeedMps,
  ringLengthM:deriveFlightPath(${c.seed}).segmentLength.reduce((a,b)=>a+b,0)};`;
  const bundle = esbuild.buildSync({ stdin: { contents: entry, resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent' });
  const file = path.join(c.out, 'lap-derivation.cjs'); const mod = new Module(file); mod.filename = file; mod.paths = module.paths;
  mod._compile(bundle.outputFiles[0].text, file); const value = mod.exports;
  assert(value.lapSeconds > 1 && value.lapSeconds <= 180, 'Lap is outside the bounded method.');
  const main = fs.readFileSync(path.join(root, 'src/main.ts'), 'utf8');
  const seedMatch = main.match(/export const SKYRIVER_DEMO_SEED = (\d+);/);
  assert(seedMatch && Number(seedMatch[1]) === c.seed, 'Browser boot seed does not match requested seed.');
  return value;
}
function releaseLock(gpuLock, token) {
  let content;
  try {
    content = fs.readFileSync(gpuLock, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { released: true, reason: 'already removed (ENOENT)' };
    }
    return { released: false, reason: 'read failure: ' + (err.message || String(err)) };
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    return { released: false, reason: 'malformed JSON in lock file: ' + (err.message || String(err)) };
  }
  if (!parsed || parsed.token !== token) {
    return { released: false, reason: 'wrong lock owner or mismatched token' };
  }
  try {
    fs.unlinkSync(gpuLock);
    return { released: true, reason: 'unlinked' };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { released: true, reason: 'already unlinked (ENOENT)' };
    }
    return { released: false, reason: 'unlink failure: ' + (err.message || String(err)) };
  }
}
function acquireLock(gpuLock, out) {
  const fd = fs.openSync(gpuLock, 'wx');
  const token = crypto.randomUUID();
  fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, owner: 'Skyriver full-lap GPU audit', token, out })); fs.closeSync(fd);
  return () => releaseLock(gpuLock, token);
}
function cleanupLock(unlock, out) {
  let releaseResult;
  try {
    releaseResult = unlock();
  } catch (err) {
    releaseResult = { released: false, reason: 'exception during unlock: ' + (err.message || String(err)) };
  }
  const receipt = { ...releaseResult, pid: process.pid, at: new Date().toISOString() };
  try {
    write(path.join(out, 'lock-released.json'), receipt);
  } catch (err) {
    console.error('Failed to write lock-released.json: ' + (err.message || String(err)));
    return { ...receipt, released: false, receiptWritten: false, receiptError: err.message || String(err) };
  }
  return receipt;
}
async function installProbe(page, feature, warmFrames, volumeSteps) {
  return page.evaluate(({ feature, warmFrames, volumeSteps }) => {
    const app = window.__skyriver, scene = app.scene, renderer = scene.renderer, gl = renderer.getContext();
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext) throw Error('EXT_disjoint_timer_query_webgl2 is unavailable.');
    if (app.session.seed === undefined) throw Error('Actual session seed is unavailable.');
    const s = { gl, ext, nextId: 1, frame: 0, pending: new Map(), rows: [], draws: [], currentObject: null,
      currentMaterial: null, attempted: 0, submitted: 0, submittedTriangles: 0, skipped: 0, feature, warmFrames, volumeSteps, control: {} };
    window.__r40Gpu = s;
    const mat = scene.city.towerMaterial;
    if (!mat || typeof mat.fragmentShader !== 'string') throw Error('Actual tower material is unavailable.');
    const before = mat.fragmentShader;
    const unique = (text, anchor) => {
      const index = text.indexOf(anchor);
      if (index < 0 || text.indexOf(anchor, index + anchor.length) >= 0) throw Error('Shader control anchor is not unique: ' + anchor);
      return index;
    };
    if (feature === 'windows') {
      let text = before;
      const start = unique(text, '    vec2 farCell ='); const end = unique(text, '    vec3 farBase0 =');
      if (end <= start) throw Error('Far window control order differs.');
      text = text.slice(0, start) + text.slice(end);
      const unitStart = unique(text, '    vec3 farUnit ='), unitEnd = unique(text, '    // R17: far layers grade');
      text = text.slice(0, unitStart) + '    vec3 farColor = farBase;\n' + text.slice(unitEnd);
      const nearStart = unique(text, '  // --- window grid'), nearEnd = unique(text, '  color = skyriverDistanceGrade( color, viewDepth, 0.0 );');
      if (nearEnd <= nearStart) throw Error('Near window control order differs.');
      text = text.slice(0, nearStart) + text.slice(nearEnd);
      mat.fragmentShader = '#define R40_EXTERNAL_WINDOWS 1\n' + text; mat.needsUpdate = true;
      s.control = { kind: 'external shader removal', scope: 'near/far tower window pipeline, including nested interiors', beforeShader: before, afterShader: mat.fragmentShader };
    } else if (feature === 'spill') {
      const start = unique(before, '  vec3 heroSpill = vec3( 0.0 );'), end = unique(before, '  // --- window grid');
      if (end <= start) throw Error('Spill control order differs.');
      mat.fragmentShader = '#define R40_EXTERNAL_SPILL 1\n' + before.slice(0, start) + '  float heroShadow = 0.0;\n' + before.slice(end); mat.needsUpdate = true;
      s.control = { kind: 'external shader removal', scope: 'tower hero sign spill, colored wet spill, and pane shadow; landmark wash and hull pickup remain', beforeShader: before, afterShader: mat.fragmentShader };
    } else if (feature === 'interior') {
      scene.setInteriorsAllowed(false);
      s.control = { kind: 'public flag', scope: 'traced tower room path; window grid remains', method: 'scene.setInteriorsAllowed(false)' };
    } else if (feature === 'streaks') {
      app.traffic.setTrailsAllowed(false);
      s.control = { kind: 'public flag', scope: 'traffic trail weight zero; actual shared batch and lamp dots remain', method: 'traffic.setTrailsAllowed(false)' };
    } else if (feature === 'volume' || feature === 'traffic') {
      s.control = { kind: 'raw draw skip', scope: feature === 'volume' ? 'volume raymarch/bilateral draws; composition chain and all source/pass updates remain' : 'all actual traffic hull, lamp/streak and impostor draws; CPU batching remains' };
    } else if (feature !== 'baseline') throw Error('Unknown feature.');
    const trafficSet = new Set(app.traffic.objects);
    const streakMesh = app.traffic.objects.find(o => o.name === 'skyriver.traffic.streaks');
    if (!streakMesh?.geometry.getAttribute('aCarFade')) throw Error('Actual trail weight buffer is unavailable.');
    const originalDirect = renderer.renderBufferDirect;
    renderer.renderBufferDirect = function (camera, sceneArg, geometry, material, object, group) {
      const oldObject = s.currentObject, oldMaterial = s.currentMaterial;
      s.currentObject = object; s.currentMaterial = material;
      if (material && typeof material.name === 'string' && material.name.startsWith('skyriver.volume.') && material.uniforms?.uSteps) {
        if (volumeSteps === 4) {
          material.uniforms.uSteps.value = 4;
        }
      }
      try { return originalDirect.call(this, camera, sceneArg, geometry, material, object, group); }
      finally { s.currentObject = oldObject; s.currentMaterial = oldMaterial; }
    };
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) {
      if (typeof gl[name] !== 'function') continue;
      const original = gl[name];
      const wrapper = function (...args) {
        s.attempted += 1;
        const isVolume = (s.currentMaterial?.name || '').startsWith('skyriver.volume.');
        const isRaymarch = isVolume && !!s.currentMaterial?.uniforms?.uSteps;
        const volumeStepsValue = isRaymarch ? s.currentMaterial.uniforms.uSteps.value : undefined;
        const skip = feature === 'traffic' && trafficSet.has(s.currentObject)
          || feature === 'volume' && isVolume;
        const event = { method: name, object: s.currentObject?.name || null, material: s.currentMaterial?.name || null, volumeSteps: volumeStepsValue, skipped: !!skip, args };
        s.draws.push(event);
        if (skip) { s.skipped += 1; return; }
        const vertexCount = name === 'drawRangeElements' ? args[3] : name.startsWith('drawArrays') ? args[2] : args[1];
        const instances = name === 'drawElementsInstanced' ? args[4] : name === 'drawArraysInstanced' ? args[3] : 1;
        if (args[0] === gl.TRIANGLES) s.submittedTriangles += vertexCount / 3 * instances;
        else if (args[0] === gl.TRIANGLE_STRIP || args[0] === gl.TRIANGLE_FAN) s.submittedTriangles += Math.max(0, vertexCount - 2) * instances;
        s.submitted += 1; return original.apply(this, args);
      };
      Object.defineProperty(gl, name, { configurable: true, writable: true, value: wrapper });
      if (gl[name] !== wrapper) throw Error('Actual GL draw method cannot be wrapped.');
    }
    const originalComposer = scene.composer.render;
    scene.composer.render = function (...args) {
      s.frame += 1; s.attempted = 0; s.submitted = 0; s.submittedTriangles = 0; s.skipped = 0; s.draws = [];
      const state = app.renderState(); const camera = scene.camera;
      const meta = { frame: s.frame, measured: s.frame > warmFrames, clockMs: performance.now(), tick: state.current.tick, alpha: state.alpha,
        routeM: scene.routePosition(), mode: state.flight.mode, tier: app.stats().tier, seed: app.session.seed,
        camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov, aspect: camera.aspect },
        disjointBefore: !!gl.getParameter(ext.GPU_DISJOINT_EXT) };
      const fade = streakMesh.geometry.getAttribute('aCarFade');
      let maxTrailWeight = 0;
      for (let i = 0; i < streakMesh.geometry.instanceCount; i += 1) maxTrailWeight = Math.max(maxTrailWeight, fade.array[i * fade.itemSize + 3]);
      meta.maxTrailWeight = maxTrailWeight;
      meta.streakInstances = streakMesh.geometry.instanceCount;
      const query = meta.measured ? gl.createQuery() : null;
      if (meta.measured && !query) throw Error('GPU query allocation failed.');
      const priorError = gl.getError(); if (priorError !== 0) throw Error('GL error before render: ' + priorError);
      if (query) gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
      let result;
      try { result = originalComposer.apply(this, args); }
      finally { if (query) { gl.endQuery(ext.TIME_ELAPSED_EXT); gl.flush(); } }
      const raymarchDraws = s.draws.filter(d => (d.material || '').startsWith('skyriver.volume.') && d.volumeSteps !== undefined);
      Object.assign(meta, { rendererCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
        actualSubmittedCalls: s.submitted, actualSubmittedTriangles: s.submittedTriangles, actualAttemptedCalls: s.attempted, skippedCalls: s.skipped,
        volumeStepsRequested: volumeSteps, volumeStepsObserved: raymarchDraws.map(d => d.volumeSteps),
        disjointAfter: !!gl.getParameter(ext.GPU_DISJOINT_EXT), glError: gl.getError(), draws: s.draws });
      if (query) { const id = s.nextId++; s.pending.set(id, { query, meta }); }
      return result;
    };
    return { seed: app.session.seed, settings: scene.renderSettings(), diagnostics: scene.glDiagnostics(), control: s.control,
      volumeStepsProposal: { requested: volumeSteps, settingsBaseline: scene.renderSettings().volumeSteps },
      stageRoles: scene.stageRoles.coverage(scene.scene), trafficNames: app.traffic.objects.map(o => o.name), coldStart: window.__skyriverColdStart || null };
  }, { feature, warmFrames, volumeSteps });
}
async function collect(page) {
  const wallStart = performance.now();
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const result = await page.evaluate(() => {
      const s = window.__r40Gpu, gl = s.gl; const entries = [...s.pending.entries()];
      if (entries.some(([, r]) => !gl.getQueryParameter(r.query, gl.QUERY_RESULT_AVAILABLE))) return { available: false };
      const disjoint = !!gl.getParameter(s.ext.GPU_DISJOINT_EXT);
      const rows = entries.map(([id, r]) => {
        const row = { id, ...r.meta, available: true, disjointAtRead: disjoint, gpuMs: gl.getQueryParameter(r.query, gl.QUERY_RESULT) / 1e6 };
        gl.deleteQuery(r.query); s.pending.delete(id); return row;
      });
      return { available: true, rows };
    });
    if (result.available) return { rows: result.rows, availabilityRpcWallMs: performance.now() - wallStart, polls: attempt + 1 };
    await wait(10);
  }
  throw Error('GPU query availability timeout.');
}
function grade(rows, route, feature, volumeSteps, final) {
  assert(rows.length >= Math.ceil(route.lapSeconds * 1000 / STEP_MS), 'Too few measured production frames.');
  let distance = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    assert(r.available && !r.disjointBefore && !r.disjointAfter && !r.disjointAtRead, 'Invalid or disjoint GPU query.');
    assert(Number.isFinite(r.gpuMs) && r.gpuMs >= 0 && r.glError === 0, 'GPU result or GL status failed.');
    assert(r.tier === 'high' && r.seed === route.seed && r.mode === 0, 'Source mode/tier/seed changed.');
    assert(r.rendererCalls <= 32 && r.actualSubmittedCalls > 0 && r.actualSubmittedCalls <= 32, 'Actual draw budget failed.');
    if (feature === 'volume' || feature === 'traffic') assert(r.skippedCalls > 0, 'Requested raw draw control skipped no draw.');
    if (feature === 'streaks') assert(r.maxTrailWeight === 0 && r.streakInstances > 0, 'Actual trail flag failed or removed the lamp batch.');
    else if (feature === 'baseline') assert(r.streakInstances > 0, 'Actual shared lamp/streak batch is missing.');
    if (feature !== 'volume' && feature !== 'traffic') assert(r.skippedCalls === 0 && r.actualSubmittedCalls === r.rendererCalls, 'Actual draw counter disagrees with renderer.');
    const raymarchDraws = (r.draws || []).filter(d => (d.material || '').startsWith('skyriver.volume.') && d.volumeSteps !== undefined);
    if (feature === 'volume') {
      assert(raymarchDraws.length > 0, 'Attempted volume raymarch draw is missing.');
      assert(raymarchDraws.every(d => d.skipped && d.volumeSteps === volumeSteps), 'Attempted volume steps value mismatch.');
    } else {
      assert(raymarchDraws.length > 0, 'Actual volume raymarch draw is missing.');
      assert(raymarchDraws.every(d => !d.skipped && d.volumeSteps === volumeSteps), 'Actual submitted volume steps value mismatch: expected ' + volumeSteps);
    }
    if (i) {
      const delta = (r.routeM - rows[i - 1].routeM + route.trackLengthM) % route.trackLengthM;
      assert(delta < route.speedMps * 0.05, 'Route discontinuity.'); distance += delta;
    }
  }
  const sourceSpanS = (rows.at(-1).tick + rows.at(-1).alpha - rows[0].tick - rows[0].alpha) / 30;
  assert(distance >= route.trackLengthM && sourceSpanS >= route.lapSeconds, 'Measured span does not cover a full lap.');
  const gpuMs = statistics(rows.map(r => r.gpuMs));
  const bins = Array.from({ length: 32 }, (_, bin) => {
    const part = rows.filter(r => Math.min(31, Math.floor((r.routeM + route.trackLengthM / 2) / route.trackLengthM * 32)) === bin);
    assert(part.length > 0, 'Route bin is missing.'); return { bin, routeFromM: bin * route.trackLengthM / 32 - route.trackLengthM / 2, gpuMs: statistics(part.map(r => r.gpuMs)) };
  });
  if (feature === 'baseline') assert(rows.some(r => r.maxTrailWeight > 0), 'Baseline has no active trail control reference.');
  return { fullLap: true, measuredFrames: rows.length, distanceM: distance, sourceSpanS, gpuMs,
    gpuMsPopulation: 'valid non-disjoint production frames in this full-lap run', gpuMsMedianMethod: 'conventional per-frame median', gpuMsPercentileMethod: 'nearest-rank per-frame percentile; runs are not pooled', bins,
    rendererCalls: [...new Set(rows.map(r => r.rendererCalls))], actualSubmittedCalls: [...new Set(rows.map(r => r.actualSubmittedCalls))],
    submittedTriangles: { min: Math.min(...rows.map(r => r.actualSubmittedTriangles)), max: Math.max(...rows.map(r => r.actualSubmittedTriangles)) },
    skippedCalls: [...new Set(rows.map(r => r.skippedCalls))], glErrors: [...new Set(rows.map(r => r.glError))],
    raymarchWitnesses: final?.programs?.map(p => p.raymarchWitness).filter(Boolean) || [] };
}
function phases(rows) { return rows.map(r => ({ frame: r.frame, clockMs: r.clockMs, tick: r.tick, alpha: r.alpha, routeM: r.routeM, seed: r.seed, mode: r.mode, camera: r.camera })); }
function validateServedBindings(served, dist = {}, external = {}) {
  const mainDocs = served.filter(s => s.isMainDocument);
  assert(mainDocs.length > 0, 'No main document response served.');
  assert(dist['index.html'], 'Artifact dist must include index.html binding.');
  for (const doc of mainDocs) {
    assert(doc.relative === 'index.html', 'Main document URL must resolve to index.html: ' + doc.url);
    assert(doc.expected === dist['index.html'], 'Main document missing expected index.html binding: ' + doc.url);
    assert(doc.status === 200, 'Main document served with non-200 status: ' + doc.status);
    assert(doc.actual === doc.expected, 'Main document hash mismatch: ' + doc.actual + ' !== ' + doc.expected);
  }
  for (const item of served) {
    if (item.isMainDocument) {
      // Main document is already validated above.
    } else if (item.resourceType === 'script') {
      assert(item.expected, 'Unknown script URL without expected binding: ' + item.url);
      assert(item.status === 200, 'Script served with non-200 status: ' + item.url + ' (' + item.status + ')');
      assert(item.actual === item.expected, 'Served script binding hash mismatch: ' + item.url);
    } else if (item.expected) {
      assert(item.status === 200, 'Asset served with non-200 status: ' + item.url + ' (' + item.status + ')');
      assert(item.actual === item.expected, 'Served asset binding hash mismatch: ' + item.url);
    }
  }
  for (const relative of Object.keys(dist).filter(x => x.endsWith('.js'))) {
    assert(served.some(s => s.relative === relative && s.actual === s.expected), 'Manifest script was not served: ' + relative);
  }
  for (const relative of Object.keys(dist).filter(x => /city-snapshot.*\.(json|gz|bin)$/.test(x))) {
    assert(served.some(s => s.relative === relative && s.actual === s.expected), 'Frozen city snapshot asset was not served: ' + relative);
  }
  assert(served.some(s => s.expected), 'No artifact-bound script was served.');
  return true;
}
async function run(c, bound, route, feature, ordinal, reference, deadline) {
  const dir = path.join(c.out, String(ordinal).padStart(2, '0') + '-' + feature); fs.mkdirSync(dir);
  const url = new URL(c.url); url.searchParams.set('tier', 'high');
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  assert(!interrupted && performance.now() < deadline, 'Run interrupted or deadline reached.');
  const started = performance.now(); const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  ownedBrowser = browser;
  let rows = [], setup = null, final = null; const errors = [], served = [], cache = [], responseTasks = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: c.dpr, serviceWorkers: 'block' });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', response => { responseTasks.push((async () => {
      const responseUrl = response.url();
      const resourceUrl = new URL(responseUrl), base = new URL(c.url);
      const isSameOrigin = resourceUrl.origin === base.origin && resourceUrl.pathname.startsWith(base.pathname);
      let relative = isSameOrigin
        ? decodeURIComponent(resourceUrl.pathname.slice(base.pathname.length)) || 'index.html' : null;
      if (relative === '' || relative === '/') relative = 'index.html';
      const request = response.request();
      const resourceType = request.resourceType();
      const isMainDocument = resourceType === 'document' && request.frame() === page.mainFrame();
      let expected = relative ? bound.artifact.dist[relative] : undefined;
      let bindingOrigin = expected ? 'dist' : null;
      if (!expected && !isMainDocument && resourceType === 'script' && bound.artifact.external) {
        expected = bound.artifact.external[responseUrl];
        if (expected) bindingOrigin = 'external';
      }
      if (!expected && resourceType !== 'script' && !isMainDocument) return;
      const actual = sha(await response.body());
      served.push({ url: responseUrl, relative, resourceType, isMainDocument, bindingOrigin, status: response.status(), actual, expected: expected || null, headers: await response.allHeaders() });
    })().catch(error => { errors.push('Response binding: ' + error.message); })); });
    const cdp = await context.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.setBypassServiceWorker', { bypass: true });
    cdp.on('Network.responseReceived', event => cache.push({ url: event.response.url, fromDiskCache: !!event.response.fromDiskCache, fromServiceWorker: !!event.response.fromServiceWorker, fromPrefetchCache: !!event.response.fromPrefetchCache }));
    const epoch = new Date(c['epoch-utc']); await page.clock.install({ time: epoch }); await page.clock.pauseAt(epoch);
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 90000 });
    for (let i = 0; i < 6000; i += 1) {
      assert(!interrupted && performance.now() < deadline, 'Run interrupted or deadline reached.');
      if (await page.evaluate(() => !!window.__skyriver?.session.runner.ready)) break;
      if (i === 5999) throw Error('Boot did not finish at the fixed clock.'); await wait(10);
    }
    await page.evaluate(() => { const a = window.__skyriver; a.scene.resize(1280, 720); if (a.stats().frames !== 0) throw Error('Production frames advanced before the fixed clock setup.'); });
    const warmFrames = Math.ceil(route.lapSeconds * 1000 / STEP_MS) + 2;
    const measuredFrames = warmFrames;
    setup = await installProbe(page, feature, warmFrames, c.volumeSteps);
    assert(setup.seed === c.seed, 'Actual runtime seed mismatch.');
    assert(!/swiftshader|llvmpipe|software/i.test(JSON.stringify(setup.diagnostics)), 'Software renderer is not accepted.');
    write(path.join(dir, 'setup.json'), setup);
    const rpc = [];
    for (let frame = 0; frame < warmFrames + measuredFrames;) {
      assert(!interrupted && performance.now() < deadline, 'Global wall-time bound reached or run interrupted.');
      const untilBoundary = frame < warmFrames ? warmFrames - frame : warmFrames + measuredFrames - frame;
      const count = Math.min(CHUNK_FRAMES, untilBoundary); const start = performance.now();
      await page.clock.runFor(count * STEP_MS); rpc.push({ firstPlannedFrame: frame + 1, clockRunForMs: count * STEP_MS, clockRpcWallMs: performance.now() - start });
      if (frame < warmFrames) {
        const drainStart = performance.now();
        await page.evaluate(() => window.__r40Gpu.gl.finish());
        rpc.at(-1).warmGpuDrainWallMs = performance.now() - drainStart;
      } else {
        const collected = await collect(page); rows.push(...collected.rows); rpc.at(-1).availabilityRpcWallMs = collected.availabilityRpcWallMs; rpc.at(-1).polls = collected.polls;
      }
      frame += count;
    }
    final = await page.evaluate(() => {
      const a = window.__skyriver, s = window.__r40Gpu, gl = s.gl;
      a.suspend();
      // This final native GL read does not prove a native uniform read on every frame.
      const programs = a.scene.renderer.info.programs.map(p => {
        const linked = gl.getProgramParameter(p.program, gl.LINK_STATUS);
        const shaders = gl.getAttachedShaders(p.program).map(shader => ({
          type: gl.getShaderParameter(shader, gl.SHADER_TYPE),
          compiled: gl.getShaderParameter(shader, gl.COMPILE_STATUS),
          source: gl.getShaderSource(shader),
          log: gl.getShaderInfoLog(shader)
        }));
        let raymarchWitness = null;
        if (linked) {
          const isRaymarchFrag = shaders.some(sh =>
            sh.type === gl.FRAGMENT_SHADER &&
            (/\buniform\s+(?:(?:highp|mediump|lowp)\s+)?float\s+uSteps\b/.test(sh.source) ||
             (sh.source.includes('uSteps') && ((p.name || '').startsWith('skyriver.volume') || sh.source.includes('skyriver.volume'))))
          );
          if (isRaymarchFrag) {
            const location = gl.getUniformLocation(p.program, 'uSteps');
            const locationPresent = location !== null;
            const rawValue = locationPresent ? gl.getUniform(p.program, location) : null;
            raymarchWitness = {
              uniformName: 'uSteps',
              locationPresent,
              numericValue: rawValue,
              readPhase: 'after final measured frame outside timed queries',
              note: 'This final native GL read does not prove a native uniform read on every frame.'
            };
          }
        }
        return { name: p.name, linked, shaders, raymarchWitness };
      });
      return { frameCount: s.frame, pending: s.pending.size, settings: a.scene.renderSettings(), stats: a.stats(), diagnostics: a.scene.glDiagnostics(), programs,
        volumeStepsProposal: { requested: s.volumeSteps, settingsBaseline: a.scene.renderSettings().volumeSteps },
        actualInteriorStrength: a.scene.city.towerMaterial.uniforms.uInteriorStrength.value, finalGlError: gl.getError(), clockMs: performance.now(), coldStart: window.__skyriverColdStart || null };
    });
    await Promise.all(responseTasks);
    validateServedBindings(served, bound.artifact.dist, bound.artifact.external);
    assert(cache.every(r => !r.fromDiskCache && !r.fromServiceWorker && !r.fromPrefetchCache), 'Browser cache bypass failed.');
    assert(final.frameCount === warmFrames + measuredFrames && final.stats.frames === final.frameCount, 'Production render count does not match the fixed cadence.');
    assert(errors.length === 0 && final.finalGlError === 0 && final.pending === 0, 'Page, GL, or pending-query failure.');
    assert(final.programs.every(p => p.linked && p.shaders.every(s => s.compiled)), 'Actual GPU shader did not compile/link.');
    const hasVolumeProgram = final.programs.some(p => (p.name && p.name.startsWith('skyriver.volume')) || p.shaders.some(s => s.source.includes('uSteps') || s.source.includes('skyriver.volume')));
    assert(hasVolumeProgram, 'Actual linked volume raymarch shader is missing.');
    const raymarchWitnesses = final.programs.map(p => p.raymarchWitness).filter(Boolean);
    assert(raymarchWitnesses.length > 0, 'No actual linked raymarch witness exists.');
    for (const w of raymarchWitnesses) {
      assert(w.locationPresent, 'Raymarch uSteps uniform must be active.');
      assert(typeof w.numericValue === 'number' && Number.isFinite(w.numericValue), 'Raymarch uSteps value must be numeric.');
      assert(w.numericValue === c.volumeSteps, 'Witness value does not match requested volume steps: ' + w.numericValue + ' !== ' + c.volumeSteps);
    }
    const expectedBuffer = [Math.round(1280 * c.dpr), Math.round(720 * c.dpr)];
    assert(final.settings.pixelRatio === c.dpr && JSON.stringify(final.settings.drawingBufferSize) === JSON.stringify(expectedBuffer), 'Resolution changed.');
    if (feature === 'interior') assert(final.actualInteriorStrength === 0, 'Actual interior control was overwritten.');
    if (feature === 'windows' || feature === 'spill') {
      const marker = 'R40_EXTERNAL_' + feature.toUpperCase();
      assert(final.programs.some(p => p.shaders.some(s => s.source.includes(marker))), 'External control is absent from linked GPU shader.');
    }
    const summary = grade(rows, route, feature, c.volumeSteps, final);
    assert(summary.gpuMs.median > 0, 'GPU timer returned no measured render energy.');
    const phase = phases(rows); if (reference) assert(JSON.stringify(phase) === JSON.stringify(reference), 'Source/camera phase replay differs.');
    const receipt = { feature, ordinal, url: url.toString(), route, dpr: c.dpr, buffer: expectedBuffer,
      volumeSteps: { requested: c.volumeSteps, settingsBaseline: 8, method: c.volumeSteps === 4 ? 'external instrumentation at renderBufferDirect draw boundary' : 'default baseline profile' },
      method: 'One TIME_ELAPSED_EXT query wraps one production EffectComposer.render. No extra scene/composer render is issued.',
      summary, phaseSha256: sha(JSON.stringify(phase)), sourceBindings: bound, setup, final, served, cache,
      cacheProvenance: { browserVersion: browser.version(), nodeVersion: process.version, playwrightModule: process.env.PLAYWRIGHT_MODULE || 'playwright', freshContext: true, serviceWorkers: 'block', networkCacheDisabled: true,
        shaderCache: 'Fresh browser process. Driver and OS shader caches are not cleared. One full lap warms the same variant. This is a warm full-lap render measurement, not cold-start timing.' },
      wallMs: performance.now() - started, rpc, errors, rowsFile: 'samples.json' };
    write(path.join(dir, 'samples.json'), rows); write(path.join(dir, 'phase.json'), phase); write(path.join(dir, 'receipt.json'), receipt);
    return { feature, ordinal, dir, summary, phase, phaseSha256: receipt.phaseSha256 };
  } catch (error) {
    write(path.join(dir, 'failed.json'), { feature, error: error.stack, errors, setup, final, served, cache, rows }); throw error;
  } finally { await browser.close(); ownedBrowser = null; write(path.join(dir, 'browser-closed.json'), { browserClosed: true, at: new Date().toISOString() }); }
}
async function main(argv) {
  if (argv[0] === '--self-test') {
    assert.equal(statistics([1, 3, 5, 9]).median, 4); assert.equal(statistics([1, 3, 5]).median, 3);
    const tailAbove = statistics([...Array(18).fill(1), 5, 8]);
    assert.equal(tailAbove.median, 1); assert.equal(tailAbove.p95, 5); assert.equal(conditionalControlsRequired(tailAbove), true);
    const tailAtLimit = statistics([...Array(18).fill(1), 4.5, 8]);
    assert.equal(tailAtLimit.p95, 4.5); assert.equal(conditionalControlsRequired(tailAtLimit), false);
    assert.equal(conditionalControlsRequired(statistics([1, 2, 3, 4])), false);
    assert.throws(() => conditionalControlsRequired({ n: 0, p95: 5 }));
    assert.throws(() => statistics([]));
    assert.throws(() => config(['--source-root', 'relative']));
    assert.throws(() => validateDpr('2.0'), /Invalid --dpr/);
    assert.throws(() => validateVolumeSteps('6'), /Invalid --volume-steps/);
    const baseHtml = '<!doctype html><html><head><script src="https://cdn.example/lib.js"></script></head><body><script>console.log("clean");</script></body></html>';
    const alteredHtml = '<!doctype html><html><head><script src="https://cdn.example/lib.js"></script></head><body><script>console.log("injected");</script></body></html>';
    const baseHtmlSha = sha(baseHtml);
    const alteredHtmlSha = sha(alteredHtml);
    const extScriptSha = sha('console.log("external-library");');
    const appJsSha = sha('console.log("app");');
    const sampleDist = { 'index.html': baseHtmlSha, 'app.js': appJsSha };
    const sampleExt = { 'https://cdn.example/lib.js': extScriptSha };
    const samplePassing = [
      { url: 'http://localhost:8080/index.html', relative: 'index.html', resourceType: 'document', isMainDocument: true, status: 200, actual: baseHtmlSha, expected: baseHtmlSha },
      { url: 'http://localhost:8080/app.js', relative: 'app.js', resourceType: 'script', isMainDocument: false, status: 200, actual: appJsSha, expected: appJsSha },
      { url: 'https://cdn.example/lib.js', relative: null, resourceType: 'script', isMainDocument: false, status: 200, actual: extScriptSha, expected: extScriptSha }
    ];
    assert.equal(validateServedBindings(samplePassing, sampleDist, sampleExt), true);
    const alteredDoc = [
      { url: 'http://localhost:8080/index.html', relative: 'index.html', resourceType: 'document', isMainDocument: true, status: 200, actual: alteredHtmlSha, expected: baseHtmlSha },
      { url: 'https://cdn.example/lib.js', relative: null, resourceType: 'script', isMainDocument: false, status: 200, actual: extScriptSha, expected: extScriptSha }
    ];
    assert.throws(() => validateServedBindings(alteredDoc, sampleDist, sampleExt), /Main document hash mismatch/);
    const missingDoc = [
      { url: 'https://cdn.example/lib.js', relative: null, resourceType: 'script', isMainDocument: false, status: 200, actual: extScriptSha, expected: extScriptSha }
    ];
    assert.throws(() => validateServedBindings(missingDoc, sampleDist, sampleExt));
    const missingArtifactIndex = { 'app.js': appJsSha };
    assert.throws(() => validateServedBindings(samplePassing, missingArtifactIndex, sampleExt));

    const testLockFile = path.join(os.tmpdir(), `skyriver-test-lock-${Date.now()}-${Math.random().toString(36).slice(2)}.lock`);
    try {
      const unlockTest = acquireLock(testLockFile, 'test-out');
      const resSuccess = unlockTest();
      assert.equal(resSuccess.released, true);
      const resAbsent = releaseLock(testLockFile, 'some-token');
      assert.equal(resAbsent.released, true);
      fs.writeFileSync(testLockFile, JSON.stringify({ pid: process.pid, token: 'different-token' }));
      const resWrongOwner = releaseLock(testLockFile, 'my-token');
      assert.equal(resWrongOwner.released, false);
      assert.match(resWrongOwner.reason, /wrong lock owner/);
    } finally {
      try { if (fs.existsSync(testLockFile)) fs.unlinkSync(testLockFile); } catch {}
    }

    console.log(JSON.stringify({ cpuSelfTest: 'PASS', gpuMeasured: false })); return;
  }
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }
  const c = config(argv);
  if (c.help) return;
  assert(!fs.existsSync(c.out) || fs.readdirSync(c.out).length === 0, 'Use a fresh output directory: ' + c.out);
  fs.mkdirSync(c.out, { recursive: true });
  assert(!fs.existsSync(path.join(c.out, 'plan.json')), 'Use a new output directory.');
  const bound = bindings(c), route = lap(c);
  const expectedBuffer = [Math.round(1280 * c.dpr), Math.round(720 * c.dpr)];
  const plan = { status: c.execute ? 'authorized execution' : 'preflight only', route, bindings: bound, viewport: [1280, 720], dpr: c.dpr, buffer: expectedBuffer,
    volumeSteps: { requested: c.volumeSteps, settingsBaseline: 8, method: c.volumeSteps === 4 ? 'external instrumentation at renderBufferDirect draw boundary' : 'default baseline profile' },
    tier: 'high', cadenceMs: STEP_MS, warmupLaps: 1, measuredLaps: 1, maxWallMs: MAX_WALL_MS, maximumVariants: 8,
    abGate: { requested: !!c.ab, ...FEATURE_CONTROL_GATE, featureScopes: FEATURES },
    limitations: ['GPU values exclude sim/CPU work before composer.render.', 'Mocked source clock fixes route replay; it does not measure real-time FPS.', 'Window control also removes nested interiors.', 'Spill control covers tower hero spill and wet spill; other source lighting remains.', 'Public trail flag preserves lamps and vertex/batch overhead.', 'Raw volume/traffic skips retain renderer setup. Renderer info counts attempted calls; raw GL counters count submitted calls.', 'Driver cache, OS load, power state and temperature can change. No cross-device or cold-start claim.', 'Query elapsed time uses the instrumented command stream; it cannot isolate shader instruction time or remove driver submission gaps.'] };
  write(path.join(c.out, 'plan.json'), plan);
  if (!c.execute) { console.log(JSON.stringify({ preflight: 'PASS', gpuMeasured: false, route, out: c.out })); return; }
  const unlock = acquireLock(c['gpu-lock'], c.out); const deadline = performance.now() + MAX_WALL_MS; const runs = [];
  let runError = null;
  try {
    const baseline = await run(c, bound, route, 'baseline', 1, null, deadline); runs.push(baseline);
    if (c.ab && conditionalControlsRequired(baseline.summary.gpuMs)) {
      for (const feature of FEATURES) runs.push(await run(c, bound, route, feature, runs.length + 1, baseline.phase, deadline));
      runs.push(await run(c, bound, route, 'baseline', runs.length + 1, baseline.phase, deadline));
    }
    const afterBindings = bindings(c); assert(JSON.stringify(afterBindings) === JSON.stringify(bound), 'Source/build changed during measurement.');
    write(path.join(c.out, 'summary.json'), { pass: true, sourceFrozen: true, measured: true, baselineFullLapP95Exceeded4_5: conditionalControlsRequired(baseline.summary.gpuMs),
      controlsRun: runs.length > 1, thresholdStatistic: FEATURE_CONTROL_GATE.statistic, percentileMethod: FEATURE_CONTROL_GATE.percentileMethod,
      runAggregation: 'Each run reports its own per-frame statistics. No pooling and no median of run percentiles.',
      runs: runs.map(({ phase, ...row }) => row), comparisons: runs.filter(r => r.feature !== 'baseline').map(r => ({ feature: r.feature, matchedPhase: r.phaseSha256 === baseline.phaseSha256,
        baselinePerFrameMedianMs: baseline.summary.gpuMs.median, controlPerFrameMedianMs: r.summary.gpuMs.median, deltaPerFrameMedianMs: r.summary.gpuMs.median - baseline.summary.gpuMs.median,
        baselinePerFrameP95Ms: baseline.summary.gpuMs.p95, controlPerFrameP95Ms: r.summary.gpuMs.p95, deltaPerFrameP95Ms: r.summary.gpuMs.p95 - baseline.summary.gpuMs.p95 })) });
  } catch (err) {
    runError = err;
  } finally {
    const releaseResult = cleanupLock(unlock, c.out);
    if (runError) {
      if (!releaseResult.released) {
        console.error('Lock cleanup also failed: ' + JSON.stringify(releaseResult));
      }
      throw runError;
    }
    if (!releaseResult.released) {
      throw Error('Lock cleanup failed: ' + (releaseResult.reason || 'unknown error'));
    }
  }
}
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.stack); process.exitCode = 1; });
module.exports = { statistics, conditionalControlsRequired, FEATURE_CONTROL_GATE, config, grade, phases, validateServedBindings, validateDpr, validateVolumeSteps, releaseLock, cleanupLock };
