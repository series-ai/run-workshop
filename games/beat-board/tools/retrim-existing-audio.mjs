#!/usr/bin/env node
/**
 * retrim-existing-audio — re-runs the no-dropout trim picker against the
 * cached raw rundot output for every kit file and re-encodes the
 * trimmed mp3. Lets the dropout-aware trim picker fix tail-fade / wrap
 * residue (CUT_OFF, SUSPICIOUS) on previously-trimmed loops without
 * spending another credit on the rundot API.
 *
 * Loops use `find-trim-no-dropout.mjs` (NOT `find-downbeat-trim.mjs`):
 * the plain downbeat picker returns the same offset the orchestrator
 * already chose, so every file reports "KEEP" and nothing gets fixed.
 * The no-dropout picker additionally rejects windows with a quiet/faded
 * bar, which is what actually moves the offset off a residual tail.
 *
 * For each *.log under pack-runs/<kit>-<date>/logs/:
 *   - Parse `OK rawPath=…` and `trimDur=…` from the log
 *   - If the raw still exists, run the no-dropout picker against it with
 *     the recorded trimDur (mode = downbeat for drums/bass/melody,
 *     smooth for vocals), and re-encode to public/audio/<kit>/<file> in
 *     stereo to match the orchestrator (`-ac 2`, volume=0.55, 256k).
 *   - If the raw is gone (older runs cleaned up by macOS / rundot
 *     rotation), skip with a SKIP message — the fix will only kick in
 *     when those items are re-generated.
 *
 * Usage: node tools/retrim-existing-audio.mjs [--kit <kit-id>] [--dry-run]
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = dirname(SCRIPT_DIR)
const RUNS_DIR = join(PROJECT_ROOT, 'pack-runs')

const argKit = process.argv.indexOf('--kit') >= 0 ? process.argv[process.argv.indexOf('--kit') + 1] : null
const dryRun = process.argv.includes('--dry-run')

function parseLog(logPath) {
  const txt = readFileSync(logPath, 'utf8')
  const rawMatch = txt.match(/OK rawPath=([^\n]+)/)
  const trimMatch = txt.match(/trimDur=([0-9.]+)s/)
  if (!rawMatch || !trimMatch) return null
  return { rawPath: rawMatch[1].trim(), trimDur: parseFloat(trimMatch[1]) }
}

function reTrim(rawPath, trimDur, mode) {
  const r = spawnSync(
    'node',
    [join(SCRIPT_DIR, 'find-trim-no-dropout.mjs'), rawPath, String(trimDur), mode],
    { encoding: 'utf8' },
  )
  if (r.status !== 0) return null
  const offset = parseFloat(r.stdout.trim())
  return Number.isFinite(offset) ? offset : null
}

/**
 * Find the first onset in a one-shot raw — same algorithm as
 * generate-kit.ts:findFirstOnset, duplicated here because that file is
 * .ts and this script is .mjs (running as plain node without tsx).
 */
function findFirstOnsetSec(rawPath) {
  const SR = 44100
  const FRAME_MS = 20
  const FRAME = Math.round((FRAME_MS / 1000) * SR)
  const r = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-i', rawPath, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'],
    { encoding: 'buffer', maxBuffer: 1 << 28 },
  )
  if (r.status !== 0 || !r.stdout) return 0
  const buf = r.stdout
  const samples = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4)
  const n = Math.floor(samples.length / FRAME)
  if (n < 4) return 0
  const head = []
  for (let f = 0; f < Math.min(5, n); f++) {
    let sum = 0
    for (let i = 0; i < FRAME; i++) sum += (samples[f * FRAME + i] ?? 0) ** 2
    head.push(Math.sqrt(sum / FRAME))
  }
  head.sort((a, b) => a - b)
  const floor = head[Math.floor(head.length / 2)]
  const threshold = Math.max(0.01, floor * 5)
  for (let f = 0; f < n; f++) {
    let sum = 0
    for (let i = 0; i < FRAME; i++) sum += (samples[f * FRAME + i] ?? 0) ** 2
    if (Math.sqrt(sum / FRAME) > threshold) return Math.max(0, (f * FRAME_MS) / 1000 - 0.03)
  }
  return 0
}

function ffmpegRetrim(rawPath, trimStart, trimDur, outPath) {
  const r = spawnSync(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-ss', String(trimStart),
      '-i', rawPath,
      '-t', String(trimDur),
      '-ac', '2', '-ar', '44100',
      '-b:a', '256k',
      '-filter:a', 'volume=0.55',
      outPath,
    ],
    { encoding: 'utf8' },
  )
  return r.status === 0
}

function probeDuration(file) {
  const r = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file],
    { encoding: 'utf8' },
  )
  return r.status === 0 ? parseFloat(r.stdout.trim()) : null
}

function main() {
  const kitRunDirs = readdirSync(RUNS_DIR)
    .filter((n) => /-\d{4}-\d{2}-\d{2}$/.test(n))
    .filter((n) => !argKit || n.startsWith(argKit.replace(/_/g, '-') + '-'))
  let totalRetrim = 0
  let totalSkip = 0
  for (const dir of kitRunDirs) {
    const runDir = join(RUNS_DIR, dir)
    const logsDir = join(runDir, 'logs')
    const manifestPath = join(runDir, 'manifest.json')
    if (!existsSync(logsDir) || !existsSync(manifestPath)) continue
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const outDir = manifest.outputDir
    console.log(`\n=== ${dir} → ${outDir} ===`)
    const logs = readdirSync(logsDir).filter((n) => n.endsWith('.log'))
    for (const log of logs) {
      const file = log.replace(/\.log$/, '.mp3')
      const item = manifest.items.find((i) => i.file === file)
      if (!item) continue
      // One-shots used to skip retrim — now they participate too,
      // because the one-shot trim picker (findFirstOnset in
      // generate-kit.ts) skips the generator's silent intro padding. The
      // first generation pass for many one-shots captured 1 s of
      // silence before the actual hit; retrim picks up the onset.
      const parsed = parseLog(join(logsDir, log))
      if (!parsed) {
        console.log(`  SKIP   ${file} (no rawPath/trimDur in log)`)
        totalSkip++
        continue
      }
      if (!existsSync(parsed.rawPath)) {
        console.log(`  SKIP   ${file} (raw missing: ${parsed.rawPath.split('/').slice(-2).join('/')})`)
        totalSkip++
        continue
      }
      const trimMode = item.color === 'vocals' ? 'smooth' : 'downbeat'
      const newStart =
        item.kind === 'oneShot'
          ? findFirstOnsetSec(parsed.rawPath)
          : reTrim(parsed.rawPath, parsed.trimDur, trimMode)
      if (newStart === null) {
        console.log(`  SKIP   ${file} (no offset returned)`)
        totalSkip++
        continue
      }
      const outPath = join(outDir, file)
      const oldStartMatch = readFileSync(join(logsDir, log), 'utf8').match(/trimStart=([0-9.]+)s/)
      const oldStart = oldStartMatch ? parseFloat(oldStartMatch[1]) : null
      if (oldStart !== null && Math.abs(oldStart - newStart) < 0.01) {
        console.log(`  KEEP   ${file} (start unchanged: ${newStart.toFixed(3)}s)`)
        continue
      }
      if (dryRun) {
        console.log(`  WOULD  ${file} (start ${oldStart?.toFixed(3)}s → ${newStart.toFixed(3)}s)`)
      } else {
        const ok = ffmpegRetrim(parsed.rawPath, newStart, parsed.trimDur, outPath)
        if (ok) {
          totalRetrim++
          const dur = probeDuration(outPath)
          console.log(`  RETRIM ${file} (start ${oldStart?.toFixed(3)}s → ${newStart.toFixed(3)}s, dur ${dur?.toFixed(2)}s)`)
        } else {
          console.log(`  FAIL   ${file} (ffmpeg failed)`)
          totalSkip++
        }
      }
    }
  }
  console.log(`\nDone: ${totalRetrim} re-trimmed, ${totalSkip} skipped${dryRun ? ' (dry run)' : ''}`)
}

main()
