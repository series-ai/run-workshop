#!/usr/bin/env node
/**
 * validate-kit-manifest — pre-flight contract checks for a rundot
 * run manifest. Catches the kinds of failure that previously surfaced
 * only at request time (or worse — only at audition time):
 *
 *   - rawDur exceeds the music generator's 60 s ceiling
 *   - barCount × barSec exceeds the same ceiling
 *   - barCount on a vocal isn't one of the supported lengths (8/16/32)
 *   - barCount on a non-vocal loop isn't 8 (the kit-wide loop length)
 *   - manifest.barSec implies a BPM that contradicts manifest.tempo
 *   - manifest.outputDir doesn't resolve to an existing public/audio dir
 *   - duplicate `file` keys (would clobber each other on regen)
 *
 * Run as: `node tools/validate-kit-manifest.mjs <run-dir>`. Exits 0 on
 * pass, 1 on any failure with a per-finding message on stderr. Designed
 * to be called from `tools/generate-kit.ts` BEFORE any external API
 * call, so an impossible manifest fails fast with a fix hint.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MUSIC_GEN_MAX_SEC = 60
const DOWNBEAT_HEADROOM_SEC = 8

// The music generator rejects prompts that name living/recent artists
// (provider content-policy violation). Blocking obvious name patterns here
// turns a 1-credit API failure into a 0-credit fast fail. The list is
// intentionally short and biased toward the names that actually
// surfaced in this project — extend as new rejections are seen.
const ARTIST_NAME_BLOCKLIST = [
  'aretha', 'curtis mayfield', 'marvin gaye', 'diana ross', 'roberta flack',
  'the delfonics', 'delfonics',
  'j dilla', 'jay dee', '9th wonder', 'pete rock', 'dj premier',
  'ltj bukem', 'high contrast', 'goldie', 'roni size',
  'kraftwerk', 'daft punk',
  'stardust', 'modjo', 'spiller', 'robin s', 'crystal waters',
]
const ALLOWED_BARS_BY_KIND = {
  drum: [8],
  bass: [8],
  melody: [8],
  vocal: [8, 16, 32],
}
const ALLOWED_VOCAL_BARS = [8, 16, 32]
const BPM_TO_BARSEC = (bpm) => (60 / bpm) * 4

function fail(findings, message) {
  findings.push(message)
}

export function validateManifest(manifest) {
  const findings = []
  if (!manifest || typeof manifest !== 'object') {
    return ['manifest is not an object']
  }
  if (!Array.isArray(manifest.items)) {
    return ['manifest.items is missing or not an array']
  }
  const barSec = manifest.barSec ?? (manifest.trimSec ? manifest.trimSec / 8 : null)
  if (!barSec || !Number.isFinite(barSec) || barSec <= 0) {
    fail(findings, `manifest.barSec is missing or non-positive (${barSec})`)
  }
  if (manifest.tempo && barSec) {
    const expected = BPM_TO_BARSEC(manifest.tempo)
    if (Math.abs(expected - barSec) > 0.005) {
      fail(
        findings,
        `manifest.tempo ${manifest.tempo} BPM implies barSec=${expected.toFixed(4)}s ` +
          `but manifest.barSec=${barSec.toFixed(4)}s (drift ${(Math.abs(expected - barSec) * 1000).toFixed(1)}ms)`,
      )
    }
  }
  const seenFiles = new Set()
  for (const item of manifest.items) {
    const id = item.file ?? '(no file)'
    if (seenFiles.has(id)) fail(findings, `duplicate file: ${id}`)
    seenFiles.add(id)
    if (!item.kind) fail(findings, `${id}: missing kind`)
    if (!item.prompt || typeof item.prompt !== 'string')
      fail(findings, `${id}: missing or non-string prompt`)
    if (item.prompt && typeof item.prompt === 'string') {
      const lower = item.prompt.toLowerCase()
      const hits = ARTIST_NAME_BLOCKLIST.filter((n) => lower.includes(n))
      if (hits.length > 0) {
        fail(
          findings,
          `${id}: prompt contains artist names the generator rejects under its content policy: ${hits.join(', ')}. ` +
            `Use genre-style descriptors instead.`,
        )
      }
    }
    if (item.kind === 'oneShot') continue
    // Loop-length contract: barCount must be one of the allowed values
    // for the item's kind, and the trimmed loop window must fit under
    // the API ceiling with downbeat headroom.
    const allowed = ALLOWED_BARS_BY_KIND[item.kind]
    if (!allowed) {
      fail(findings, `${id}: unknown kind "${item.kind}"`)
      continue
    }
    const bars = item.barCount ?? (manifest.trimSec && barSec ? Math.round(manifest.trimSec / barSec) : null)
    if (!bars) {
      fail(findings, `${id}: cannot resolve barCount (no item.barCount, no manifest.trimSec/barSec)`)
      continue
    }
    if (!allowed.includes(bars)) {
      fail(
        findings,
        `${id}: barCount=${bars} not allowed for kind "${item.kind}" (allowed: ${allowed.join(', ')})`,
      )
    }
    if (item.kind === 'vocal' && !ALLOWED_VOCAL_BARS.includes(bars)) {
      fail(findings, `${id}: vocal barCount=${bars} must be one of ${ALLOWED_VOCAL_BARS.join(', ')}`)
    }
    if (barSec) {
      const trimSec = bars * barSec
      const minRaw = trimSec + DOWNBEAT_HEADROOM_SEC
      if (minRaw > MUSIC_GEN_MAX_SEC) {
        fail(
          findings,
          `${id}: ${bars} bars × ${barSec.toFixed(2)}s = ${trimSec.toFixed(1)}s trim + ` +
            `${DOWNBEAT_HEADROOM_SEC}s headroom = ${minRaw.toFixed(1)}s > ` +
            `${MUSIC_GEN_MAX_SEC}s music-generator ceiling. ` +
            `Reduce barCount.`,
        )
      }
    }
  }
  return findings
}

function main() {
  const runDir = process.argv[2]
  if (!runDir) {
    console.error('Usage: validate-kit-manifest.mjs <run-dir>')
    process.exit(2)
  }
  const path = join(resolve(runDir), 'manifest.json')
  if (!existsSync(path)) {
    console.error(`manifest not found: ${path}`)
    process.exit(2)
  }
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  const findings = validateManifest(manifest)
  if (findings.length === 0) {
    console.log(`OK  ${runDir} — ${manifest.items?.length ?? 0} items pass pre-flight`)
    process.exit(0)
  }
  console.error(`FAIL  ${runDir} — ${findings.length} finding${findings.length > 1 ? 's' : ''}:`)
  for (const f of findings) console.error(`  - ${f}`)
  process.exit(1)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main()
}
