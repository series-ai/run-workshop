#!/usr/bin/env node
/**
 * audio-validate-all — runs `audio-detect-cutoffs.mjs` once per kit that
 * has its audio downloaded into `public/cdn-assets/audio/`. Aggregates
 * the per-kit JSON reports into a single `tools/.audio-validation-all.json`
 * and exits non-zero if any kit has any failures, so this is suitable
 * as a CI gate (`npm run validate:audio`).
 *
 * Skip behavior: kits that exist as `.json` manifests but have no audio
 * directory are listed as "not-audited" rather than failing — they
 * usually live in GCS and aren't downloaded locally.
 */

import { spawnSync } from 'node:child_process'
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = dirname(SCRIPT_DIR)
const AUDIO_ROOT = join(PROJECT_ROOT, 'public', 'cdn-assets', 'audio')
const KITS_DIR = join(PROJECT_ROOT, 'src', 'content-assets', 'kits')
const VALIDATOR = join(SCRIPT_DIR, 'audio-detect-cutoffs.mjs')
const PER_KIT_REPORT = join(SCRIPT_DIR, '.audio-validation.json')
const AGGREGATE_REPORT = join(SCRIPT_DIR, '.audio-validation-all.json')

function listKits() {
  return readdirSync(KITS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort()
}

function hasAudio(kitId) {
  const dir = join(AUDIO_ROOT, kitId)
  if (!existsSync(dir)) return false
  try {
    const entries = readdirSync(dir).filter((f) => f.endsWith('.mp3'))
    return entries.length > 0
  } catch {
    return false
  }
}

const kits = listKits()
const audited = []
const notAudited = []
let totalFailures = 0

for (const kitId of kits) {
  if (!hasAudio(kitId)) {
    notAudited.push(kitId)
    continue
  }

  const result = spawnSync('node', [VALIDATOR, '--kit', kitId], {
    stdio: 'inherit',
  })

  let report = null
  try {
    if (existsSync(PER_KIT_REPORT)) {
      report = JSON.parse(readFileSync(PER_KIT_REPORT, 'utf8'))
    }
  } catch {
    report = null
  }

  audited.push({
    kitId,
    exitStatus: result.status ?? -1,
    summary: report?.summary ?? null,
    failingCount: report?.failing?.length ?? 0,
  })
  totalFailures += report?.failing?.length ?? 0
}

const aggregate = {
  scannedAt: new Date().toISOString(),
  audited,
  notAudited,
  totalFailures,
}
writeFileSync(AGGREGATE_REPORT, JSON.stringify(aggregate, null, 2))

console.log()
console.log('═'.repeat(70))
console.log('Cross-kit summary')
console.log('═'.repeat(70))
for (const k of audited) {
  console.log(`  ${k.kitId.padEnd(28)} ${k.failingCount} failure(s)`)
}
if (notAudited.length > 0) {
  console.log()
  console.log('Not audited (no local audio dir):')
  for (const id of notAudited) console.log(`  - ${id}`)
}
console.log()
console.log(`Total failures across audited kits: ${totalFailures}`)
console.log(`Aggregate report: ${AGGREGATE_REPORT}`)

if (totalFailures > 0) process.exitCode = 1
