#!/usr/bin/env node
/**
 * check-label-content-alignment — flags pads whose displayed
 * `layerName` doesn't match the prompt the audio was generated from.
 *
 * The kit JSON's `layerName` is what the player reads under each pad.
 * The pack manifest's `prompt` is what the audio actually is.
 * These two have been drifting (e.g. a pad labeled "Oh Yeah" backed by
 * a soul-hook prompt with no "oh yeah" content), and the player can
 * hear the mismatch immediately.
 *
 * Heuristic: tokenize both the layerName and the prompt's first 200
 * characters; require at least one substantive content word from the
 * label to appear in the prompt. Words ≤ 2 chars and a stoplist of
 * generic terms (vocal, hook, sample, cappella, …) don't count as
 * content because they appear in nearly every prompt.
 *
 * Run as: `node tools/check-label-content-alignment.mjs [--kit <id>]`
 * Exits 1 if any mismatch is found, 0 if all kits align.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = dirname(SCRIPT_DIR)
const KITS_DIR = join(PROJECT_ROOT, 'src', 'content-assets', 'kits')
const RUNS_DIR = join(PROJECT_ROOT, 'pack-runs')

// Words that appear in essentially every prompt and don't contribute
// to label-content alignment. Anything in this set is stripped before
// checking overlap.
const STOPLIST = new Set([
  'a', 'an', 'and', 'the', 'or', 'of', 'on', 'in', 'at', 'to', 'for', 'with',
  'no', 'not', 'only', 'pure', 'just', 'one', 'two', 'three', 'four', 'eight',
  'sixteen', 'thirty', 'all', 'each', 'every', 'across', 'continuous',
  'vocal', 'vocals', 'voice', 'voices',
  'hook', 'hooks', 'sample', 'samples', 'sung', 'singing', 'sing',
  'chant', 'chants', 'chanted', 'chanting',
  'pad', 'pads', 'stab', 'stabs', 'chop', 'chops', 'chopped',
  'cappella', 'recorded', 'booth', 'energy', 'silent', 'fade', 'fades',
  'loop', 'loopable', 'loops', 'looping', 'bar', 'bars', 'phrase', 'phrases',
  'female', 'male', 'minor', 'major', 'bpm', 'key', 'note', 'notes',
  'instrument', 'instruments', 'instrumental', 'beat', 'drums', 'bass',
  'synth', 'piano', 'melody', 'backing', 'whatsoever', 'absolutely', 'never',
  'always', 'short', 'long', 'across', 'back', 'down', 'up', 'over', 'under',
  'is', 'are', 'be', 'been', 'being', 'this', 'that', 'these', 'those',
  'with', 'without', 'into', 'onto', 'mp', 'should', 'must',
])

/**
 * Collapse runs of repeated letters down to a single letter, so the
 * label "Aaah" and the prompt's "ahhh" reduce to the same canonical
 * "ah" / "ah" stem. Without this collapse the alignment check
 * false-positives on every variation of how a sustained vocal sound
 * gets transcribed (aaah / ahhh / aah / ah / aaaah …).
 */
function collapseRepeats(word) {
  return word.replace(/(.)\1+/g, '$1')
}

function tokens(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPLIST.has(w))
    .map(collapseRepeats)
}

function loadManifestForKit(kitId) {
  if (!RUNS_DIR) return null
  let names
  try {
    names = readdirSync(RUNS_DIR)
  } catch {
    return null
  }
  // The most recent run-dir for a kit is what generated the live audio.
  // Match on the kit-id prefix, sorted by lexicographic order of the
  // date suffix.
  const prefix = kitId.replace(/_/g, '-')
  const matches = names
    .filter((n) => n.startsWith(prefix + '-'))
    .sort()
    .reverse()
  for (const m of matches) {
    const path = join(RUNS_DIR, m, 'manifest.json')
    try {
      return JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      continue
    }
  }
  return null
}

function check(kitJson, manifest) {
  const findings = []
  const byFile = new Map()
  for (const it of manifest.items ?? []) byFile.set(it.file, it)
  for (const pad of kitJson.pads ?? []) {
    if (pad.color !== 'vocals') continue // labels for drums/bass/melody are
    // genre-shape descriptors and don't need to literally appear in the
    // prompt.
    const file = pad.bufferUrl?.split('/').pop()
    if (!file) continue
    const item = byFile.get(file)
    if (!item) {
      findings.push(`${pad.padId} (${pad.layerName}): no manifest item for ${file}`)
      continue
    }
    const labelTokens = tokens(pad.layerName ?? '')
    const promptTokens = new Set(tokens((item.prompt ?? '').slice(0, 400)))
    if (labelTokens.length === 0) continue
    const hits = labelTokens.filter((t) => promptTokens.has(t))
    if (hits.length === 0) {
      findings.push(
        `${pad.padId} "${pad.layerName}" (${file}): no label tokens [${labelTokens.join(', ')}] ` +
          `appear in prompt "${(item.prompt ?? '').slice(0, 80).replace(/\s+/g, ' ')}…"`,
      )
    }
  }
  return findings
}

function main() {
  const argKitIdx = process.argv.indexOf('--kit')
  const kitFilter = argKitIdx >= 0 ? process.argv[argKitIdx + 1] : null

  let kitFiles
  try {
    kitFiles = readdirSync(KITS_DIR).filter((f) => f.endsWith('.json'))
  } catch (err) {
    console.error(`could not read ${KITS_DIR}: ${err.message}`)
    process.exit(2)
  }
  let totalFindings = 0
  for (const f of kitFiles) {
    const kitId = f.replace(/\.json$/, '')
    if (kitFilter && kitId !== kitFilter) continue
    let kitJson
    try {
      kitJson = JSON.parse(readFileSync(join(KITS_DIR, f), 'utf8'))
    } catch (err) {
      console.error(`SKIP ${kitId}: ${err.message}`)
      continue
    }
    const manifest = loadManifestForKit(kitId)
    if (!manifest) {
      console.error(`SKIP ${kitId}: no manifest found in ${RUNS_DIR}`)
      continue
    }
    const findings = check(kitJson, manifest)
    if (findings.length === 0) {
      console.log(`OK   ${kitId} — all vocal labels align with prompts`)
    } else {
      console.error(`FAIL ${kitId} — ${findings.length} mismatch${findings.length > 1 ? 'es' : ''}:`)
      for (const note of findings) console.error(`  - ${note}`)
      totalFindings += findings.length
    }
  }
  process.exit(totalFindings === 0 ? 0 : 1)
}

const argv1 = process.argv[1]
if (argv1 && resolve(argv1) === resolve(fileURLToPath(import.meta.url))) {
  main()
}
