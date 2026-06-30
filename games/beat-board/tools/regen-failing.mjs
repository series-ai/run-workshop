#!/usr/bin/env node
/**
 * regen-failing — orchestrate regeneration of failing audio files for a kit.
 *
 * Reads the validator report at tools/.audio-validation.json, then for each
 * failing file:
 *   1. runs `tools/generate-kit.ts <run-dir> --only <file>`
 *   2. re-runs the validator
 *   3. if the file is no longer in the failing list, moves on
 *   4. otherwise retries up to MAX_ATTEMPTS times
 *
 * Usage:
 *   node tools/regen-failing.mjs --kit <kitId> --run-dir <abs-path>
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MAX_ATTEMPTS = 3;
const REPORT_PATH = resolve('tools/.audio-validation.json');
const PRIVATE_REPORT_PATH = resolve(`tools/.audio-validation.regen.${process.pid}.json`);

function parseArgs(argv) {
  let kit, runDir;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--kit') { kit = argv[++i]; }
    else if (argv[i] === '--run-dir') { runDir = argv[++i]; }
  }
  if (!kit || !runDir) {
    console.error('Usage: regen-failing.mjs --kit <kitId> --run-dir <abs-path>');
    process.exit(1);
  }
  return { kit, runDir };
}

function readFailing() {
  const report = JSON.parse(readFileSync(PRIVATE_REPORT_PATH, 'utf8'));
  return { failing: report.failing || [], kitId: report.kitId };
}

function validate(kit) {
  const r = spawnSync('node', ['tools/audio-detect-cutoffs.mjs', '--kit', kit], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // IMPORTANT: copy report to private path *immediately* — another concurrent
  // regen orchestrator on a different kit can overwrite tools/.audio-validation.json.
  try {
    copyFileSync(REPORT_PATH, PRIVATE_REPORT_PATH);
  } catch (e) {
    console.error('Failed to copy validator report:', e.message);
  }
  const result = readFailing();
  // Sanity check: if kitId mismatch, the validator we just spawned was clobbered.
  if (result.kitId !== kit) {
    console.error(`KitId mismatch in report (got ${result.kitId}, expected ${kit}); retrying validator.`);
    // Retry once after a short delay — this is rare.
    spawnSync('node', ['tools/audio-detect-cutoffs.mjs', '--kit', kit], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    copyFileSync(REPORT_PATH, PRIVATE_REPORT_PATH);
    return readFailing();
  }
  return result;
}

function regen(runDir, file) {
  console.log(`  → regen ${file}`);
  const start = Date.now();
  const r = spawnSync('npx', ['tsx', 'tools/generate-kit.ts', runDir, '--only', file], {
    stdio: 'inherit',
  });
  const dur = ((Date.now() - start) / 1000).toFixed(1);
  if (r.status !== 0) {
    console.log(`  ✗ regen failed for ${file} (${dur}s)`);
    return false;
  }
  console.log(`  ✓ regen complete for ${file} (${dur}s)`);
  return true;
}

const { kit, runDir } = parseArgs(process.argv.slice(2));
const startAll = Date.now();

console.log(`\n=== Regenerating failing files for kit: ${kit} ===\n`);
console.log('Initial validation...');
let result = validate(kit);
let failing = result.failing;
console.log(`Initial failures: ${failing.length}`);
for (const f of failing) {
  console.log(`  - ${f.file}: ${f.verdict}`);
}
console.log('');

const initialFailingFiles = failing.map(f => f.file);
const results = []; // { file, status: 'cleared' | 'still-failing', attempts, finalVerdict? }

for (const file of initialFailingFiles) {
  console.log(`\n--- ${file} ---`);
  let attempt = 0;
  let cleared = false;
  let lastVerdict = null;

  for (attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`Attempt ${attempt}/${MAX_ATTEMPTS}`);
    const ok = regen(runDir, file);
    if (!ok) {
      lastVerdict = 'REGEN_FAILED';
      continue;
    }
    failing = validate(kit).failing;
    const stillFailing = failing.find(f => f.file === file);
    if (!stillFailing) {
      console.log(`  ✓ ${file} now passes`);
      cleared = true;
      break;
    }
    lastVerdict = stillFailing.verdict;
    console.log(`  ✗ ${file} still failing: ${stillFailing.verdict}`);
  }

  results.push({
    file,
    status: cleared ? 'cleared' : 'still-failing',
    attempts: attempt > MAX_ATTEMPTS ? MAX_ATTEMPTS : attempt,
    finalVerdict: cleared ? null : lastVerdict,
  });
}

const totalDur = ((Date.now() - startAll) / 1000).toFixed(1);

console.log('\n\n=== SUMMARY ===');
console.log(`Total time: ${totalDur}s`);
console.log(`\nCleared (${results.filter(r => r.status === 'cleared').length}):`);
for (const r of results.filter(r => r.status === 'cleared')) {
  console.log(`  ✓ ${r.file} (${r.attempts} attempt${r.attempts !== 1 ? 's' : ''})`);
}
console.log(`\nStill failing (${results.filter(r => r.status !== 'cleared').length}):`);
for (const r of results.filter(r => r.status !== 'cleared')) {
  console.log(`  ✗ ${r.file} → ${r.finalVerdict} after ${r.attempts} attempts`);
}

// Final validation for record
console.log('\n=== FINAL VALIDATION ===');
const finalResult = validate(kit);
const finalFailing = finalResult.failing;
console.log(`Final failure count: ${finalFailing.length}`);
for (const f of finalFailing) {
  console.log(`  - ${f.file}: ${f.verdict}`);
}
