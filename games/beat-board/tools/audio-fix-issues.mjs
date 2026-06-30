#!/usr/bin/env node
/**
 * audio-fix-issues — auto-apply every deterministic fix the validator
 * suggests, then re-validate and surface only the residue that requires
 * a rundot regen.
 *
 * Pipeline:
 *
 *   1. Run `audio-detect-cutoffs.mjs` to produce `tools/.audio-validation.json`.
 *   2. Group failures by verdict and apply the matching tool:
 *
 *        CLIPPED    → ffmpeg `volume=0.55` static gain re-encode (256 kbps).
 *                     Uses static gain rather than `alimiter` because
 *                     limiter-style dynamics flip relative peak amplitudes
 *                     (squashes loudest hits more than quiet ones), which
 *                     invalidates downbeat alignment for percussive
 *                     content. Static gain preserves peak structure.
 *
 *        CUT_OFF    → audio-phase-align.mjs --no-rotate --blend-ms 32.
 *                     Re-applies a 32 ms overlap-add splice at the loop
 *                     boundary; doesn't touch sample-0 position.
 *
 *        CYCLE_DRIFT (drums) → audio-phase-align.mjs (rotate + 32 ms splice).
 *                     "Loudest peak = downbeat" is safe for percussive
 *                     content; the rotator places sample 0 at the peak.
 *
 *        CYCLE_DRIFT (bass / melody / vocals) → flagged for regen.
 *                     Loudest peak isn't reliably the downbeat for
 *                     sustained / pitched content (a held bass note can
 *                     have its sustain peak mid-bar). Rotating those
 *                     would corrupt the loop.
 *
 *        BAR_VIOLATION   → flagged for regen (file is wrong length).
 *        LENGTH_MISMATCH → flagged for regen (color-policy violation).
 *        PHRASE_LOCKED   → flagged for regen (composition issue).
 *        SUSPICIOUS      → flagged for regen (soft warning; player can
 *                          decide to keep or replace).
 *        TOO_SHORT/ERROR → flagged for regen (file unreadable).
 *
 *   3. Re-run the validator until either all-pass or the failing set
 *      stops shrinking (max 3 iterations to bound runaway loops).
 *
 *   4. Print a final summary listing what was fixed deterministically
 *      and what still requires a rundot regen, plus an exit code:
 *        0 = all pass
 *        1 = residual failures requiring regen (caller should dispatch
 *            rundot for those files)
 *
 * Usage:
 *   node tools/audio-fix-issues.mjs                # default kit
 *   node tools/audio-fix-issues.mjs --kit <id>     # other kit
 *   node tools/audio-fix-issues.mjs --dry-run      # report only, no edits
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = dirname(SCRIPT_DIR)

const args = process.argv.slice(2)
const kitArgIdx = args.indexOf('--kit')
const KIT_ID =
  kitArgIdx >= 0 && args[kitArgIdx + 1] ? args[kitArgIdx + 1] : 'lofi_heights_hero'
const DRY_RUN = args.includes('--dry-run')

const VALIDATOR = join(SCRIPT_DIR, 'audio-detect-cutoffs.mjs')
const PHASE_ALIGN = join(SCRIPT_DIR, 'audio-phase-align.mjs')
const REPORT_PATH = join(SCRIPT_DIR, '.audio-validation.json')

// Verdicts the orchestrator can patch with deterministic tools.
const FIXABLE_VERDICTS = new Set([
  'CLIPPED',
  'CUT_OFF',
  'CYCLE_DRIFT',
  'LOUDNESS_OUTLIER',
])

function runValidator() {
  const r = spawnSync('node', [VALIDATOR, '--kit', KIT_ID], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  })
  // Validator exits 1 when failures exist; that's expected — we read the
  // JSON regardless.
  if (r.error) throw r.error
  return JSON.parse(readFileSync(REPORT_PATH, 'utf8'))
}

function applyClipFix(filePath) {
  console.log(`  CLIPPED → volume=0.55 re-encode: ${filePath}`)
  if (DRY_RUN) return true
  const tmp = `${filePath}.norm.mp3`
  const r = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      filePath,
      '-af',
      'volume=0.55',
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '256k',
      tmp,
    ],
    { stdio: 'inherit' },
  )
  if (r.status !== 0) return false
  spawnSync('mv', [tmp, filePath])
  return true
}

function applyCutOffFix(filePath) {
  console.log(`  CUT_OFF → re-splice (32 ms blend, no rotate): ${filePath}`)
  if (DRY_RUN) return true
  const r = spawnSync(
    'node',
    [PHASE_ALIGN, filePath, '--no-rotate', '--blend-ms', '32'],
    { stdio: 'inherit' },
  )
  return r.status === 0
}

function applyDrumCycleDriftFix(filePath) {
  console.log(`  CYCLE_DRIFT (drum) → audio-phase-align rotate: ${filePath}`)
  if (DRY_RUN) return true
  const r = spawnSync('node', [PHASE_ALIGN, filePath, '--blend-ms', '32'], {
    stdio: 'inherit',
  })
  return r.status === 0
}

function applyLoudnessNormalize(filePath, reason) {
  // Parse "RMS=X.XXXX is Y.YY× kit median Z.ZZZZ" from the validator's
  // human-readable reason. The validator's median comes from the kit's
  // OK-loop population, so renormalising to it lands the loop back in
  // the acceptable ±band on the next pass.
  const match = /RMS=([\d.]+).*?kit median ([\d.]+)/.exec(reason ?? '')
  if (!match) {
    console.error(`  LOUDNESS_OUTLIER: cannot parse reason for ${filePath}`)
    return false
  }
  const currentRms = Number(match[1])
  const targetRms = Number(match[2])
  if (!Number.isFinite(currentRms) || !Number.isFinite(targetRms) || currentRms <= 0) {
    return false
  }
  const gain = targetRms / currentRms
  console.log(
    `  LOUDNESS_OUTLIER → volume=${gain.toFixed(3)} (RMS ${currentRms.toFixed(3)} → ${targetRms.toFixed(3)}): ${filePath}`,
  )
  if (DRY_RUN) return true
  const tmp = `${filePath}.norm.mp3`
  const r = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      filePath,
      '-af',
      `volume=${gain.toFixed(4)}`,
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '256k',
      tmp,
    ],
    { stdio: 'inherit' },
  )
  if (r.status !== 0) return false
  spawnSync('mv', [tmp, filePath])
  return true
}

function summarise(report) {
  const counts = report.summary
  const failing = report.failing ?? []
  const fixable = failing.filter((f) => isDeterministicFix(f))
  const regenOnly = failing.filter((f) => !isDeterministicFix(f))
  return { counts, fixable, regenOnly }
}

function isDeterministicFix(failing) {
  if (failing.verdict === 'CLIPPED') return true
  if (failing.verdict === 'CUT_OFF') return true
  if (failing.verdict === 'CYCLE_DRIFT' && failing.color === 'drums') return true
  if (failing.verdict === 'LOUDNESS_OUTLIER') return true
  return false
}

function applyFixes(failing, opts = {}) {
  let appliedCount = 0
  for (const f of failing) {
    if (!FIXABLE_VERDICTS.has(f.verdict)) continue
    let ok = false
    if (f.verdict === 'CLIPPED') ok = applyClipFix(f.path)
    else if (f.verdict === 'CUT_OFF') ok = applyCutOffFix(f.path)
    else if (f.verdict === 'CYCLE_DRIFT' && f.color === 'drums')
      ok = applyDrumCycleDriftFix(f.path)
    else if (f.verdict === 'LOUDNESS_OUTLIER') {
      // LOUDNESS_OUTLIER is a kit-wide check: normalising one file
      // shifts the kit median, which can promote a previously-OK file
      // to "outlier" on the next iteration. Only run on iteration 0
      // — after that, any residual outlier needs manual review or a
      // different normalisation target than the current median.
      if (opts.skipLoudness) continue
      ok = applyLoudnessNormalize(f.path, f.reason)
    } else continue
    if (ok) appliedCount++
    else console.error(`  FAILED to fix: ${f.path}`)
  }
  return appliedCount
}

function main() {
  console.log('═'.repeat(70))
  console.log(`audio-fix-issues — kit ${KIT_ID}${DRY_RUN ? ' [dry-run]' : ''}`)
  console.log('═'.repeat(70))

  const MAX_ITERATIONS = 3
  let lastFailingCount = Infinity
  let report
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`\n── iteration ${i + 1} of ${MAX_ITERATIONS} ──`)
    report = runValidator()
    const { fixable, regenOnly } = summarise(report)
    console.log(
      `  fixable: ${fixable.length}    regen-only: ${regenOnly.length}    total failing: ${report.failing.length}`,
    )
    if (fixable.length === 0) {
      console.log('  no deterministic fixes remaining — done iterating.')
      break
    }
    if (fixable.length >= lastFailingCount) {
      console.log('  failing count not shrinking — bailing to avoid loop.')
      break
    }
    const skipLoudness = i > 0
    if (skipLoudness) {
      console.log('  (skipping LOUDNESS_OUTLIER on this iteration to avoid median-cascade)')
    }
    lastFailingCount = fixable.length
    const applied = applyFixes(fixable, { skipLoudness })
    console.log(`  applied ${applied}/${fixable.length} fixes.`)
    if (applied === 0) {
      console.log('  no fixes landed — bailing.')
      break
    }
  }

  const final = summarise(report)
  const stillFailing = report.failing ?? []
  console.log('\n' + '═'.repeat(70))
  console.log('Final state')
  console.log('═'.repeat(70))
  for (const [k, v] of Object.entries(final.counts)) {
    console.log(`  ${k.padEnd(16)} ${v}`)
  }
  // Exit status is driven by ALL remaining failures, not just the
  // regen-only ones. A "fixable" verdict (e.g. CUT_OFF) that is still
  // present after the fix loop means the deterministic fix did not
  // converge — that is a real failure, not a pass. Reporting exit 0 here
  // while CUT_OFF residue remained was hiding broken loops.
  if (stillFailing.length > 0) {
    if (final.fixable.length > 0) {
      console.log('\nFiles whose auto-fix did NOT converge (re-trim from raw or regen):')
      for (const f of final.fixable) {
        console.log(`  - ${f.file.padEnd(24)} ${f.verdict.padEnd(16)} ${f.reason ?? ''}`)
      }
    }
    if (final.regenOnly.length > 0) {
      console.log('\nFiles requiring rundot regen (no deterministic fix):')
      for (const f of final.regenOnly) {
        console.log(`  - ${f.file.padEnd(24)} ${f.verdict.padEnd(16)} ${f.reason ?? ''}`)
      }
    }
    console.log(`\n${stillFailing.length} file(s) still failing — NOT all clear.`)
    process.exitCode = 1
  } else {
    console.log('\nAll loops pass.')
    process.exitCode = 0
  }
}

main()
