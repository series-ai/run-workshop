#!/usr/bin/env -S npx tsx
/**
 * generate-kit — full-kit audio generator for BeatBoard packs.
 *
 * Reads `<run-dir>/manifest.json` and generates every item in it
 * (loops + vocals + one-shots), trims to the manifest's bar lengths,
 * and writes the encoded mp3s to the manifest's `outputDir`.
 *
 * Generation is dispatched through the `rundot generate` CLI
 * (`music` / `sfx` / `tts`). See `docs/authoring-packs.md` for the
 * end-to-end pack-authoring flow and `docs/audio-kits.md` for the full
 * pipeline + prompt constraints.
 *
 * Usage:
 *   npx tsx tools/generate-kit.ts <run-dir> [--only <filename>]
 *
 * Where `<run-dir>` is the absolute path to a run directory containing
 * `manifest.json` and `find-downbeat-trim.mjs`. Example:
 *   npx tsx tools/generate-kit.ts \
 *     "$(pwd)/pack-runs/hiphop-brooklyn-hero-2026-05-04"
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
// Pre-flight contract validator. Module is plain ESM JS so we import
// it via .mjs path; tsx loads it without configuration.
// @ts-expect-error — sibling .mjs has no .d.ts; the runtime resolution works.
import { validateManifest } from './validate-kit-manifest.mjs'

type ItemKind = 'drum' | 'bass' | 'melody' | 'vocal' | 'oneShot'
type AudioType = 'music' | 'sfx' | 'voice'

interface ManifestItem {
  file: string
  kind: ItemKind
  color?: string
  type?: AudioType
  prompt: string
  targetSec?: number
  voiceId?: string
  /**
   * Per-item bar count override. Defaults to the kit-wide 8 bars
   * implied by `manifest.trimSec / manifest.barSec`. Used by vocal
   * pads that ship at 8/16/32 bars within the same kit.
   */
  barCount?: number
}

interface Manifest {
  kitId?: string
  outputDir: string
  trimSec: number
  barSec?: number
  rawSec?: number
  items: ManifestItem[]
}

interface CliOptions {
  runDir: string
  only?: string
}

function parseCli(argv: string[]): CliOptions {
  if (argv.length < 1) {
    console.error('Usage: generate-kit.ts <run-dir> [--only <filename>]')
    process.exit(1)
  }
  const runDir = resolve(argv[0]!)
  let only: string | undefined
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--only') {
      only = argv[i + 1]
      i++
    } else {
      console.error(`Unknown arg: ${argv[i]}`)
      process.exit(1)
    }
  }
  return { runDir, only }
}

function timestamp(): string {
  return new Date().toTimeString().slice(0, 8)
}

function log(message: string): void {
  console.log(`[${timestamp()}] ${message}`)
}

function readManifest(runDir: string): Manifest {
  const path = join(runDir, 'manifest.json')
  if (!existsSync(path)) {
    console.error(`Manifest not found: ${path}`)
    process.exit(1)
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as Manifest
}

interface DispatchPlan {
  audioType: AudioType
  rawDur: number
  trimSec: number
}

// The music generator (rundot's music backend) caps a single generation
// at 60 seconds. We keep the raw window inside that ceiling and demand
// enough headroom for the downbeat search; any kit that wants a longer
// phrase must concatenate multiple generations, not silently truncate.
const MUSIC_GEN_MAX_SEC = 60
const DOWNBEAT_HEADROOM_SEC = 8

function planFor(item: ManifestItem, manifest: Manifest): DispatchPlan {
  const kitBarSec = manifest.barSec ?? manifest.trimSec / 8
  // Per-item bar override — if the item declares a different bar count
  // from the kit-wide default, derive its trim from that. Used by
  // longer (16-bar / 32-bar) vocals living alongside 8-bar instrument
  // loops in the same kit.
  const trimSec =
    item.barCount && Number.isFinite(item.barCount)
      ? item.barCount * kitBarSec
      : manifest.trimSec
  if (trimSec + DOWNBEAT_HEADROOM_SEC > MUSIC_GEN_MAX_SEC) {
    throw new Error(
      `Item ${item.file} requires ${trimSec.toFixed(1)}s trim + ${DOWNBEAT_HEADROOM_SEC}s downbeat headroom, exceeding the music generator's ${MUSIC_GEN_MAX_SEC}s cap. Reduce barCount or split into shorter phrases.`,
    )
  }
  // Long-form items need raw audio to trim from. We use 1.7× the trim
  // by default but always cap at the API ceiling.
  const desired = Math.max(manifest.rawSec ?? 40, Math.ceil(trimSec * 1.7))
  const rawDur = Math.min(MUSIC_GEN_MAX_SEC, desired)
  switch (item.kind) {
    case 'drum':
    case 'bass':
    case 'melody':
      return { audioType: 'music', rawDur, trimSec }
    case 'vocal':
      // Vocals default to the speech/TTS backend for chant / spoken /
      // hummed content — but a manifest can override `type: 'music'` to
      // route through the music generator for genuinely sung vocals (house
      // diva hooks, soulful sung phrases). Speech can't sing melodies;
      // music can but needs aggressive "a cappella, voice only" prompt
      // discipline to keep the generator from layering instruments.
      return { audioType: item.type ?? 'voice', rawDur, trimSec }
    case 'oneShot':
      return {
        audioType: item.type ?? 'music',
        rawDur: 6,
        trimSec: item.targetSec ?? 1,
      }
    default:
      throw new Error(`Unknown kind: ${(item as ManifestItem).kind}`)
  }
}

export interface RundotResult {
  ok: boolean
  rawPath?: string
  errorLog: string
}

/**
 * Resolve the optional sandbox game id passed to `rundot generate`.
 * `rundot` also falls back to its own local sandbox config when this is
 * unset, so an absent id is not an error here.
 */
export function resolveGameId(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const fromEnv = env.RUNDOT_SANDBOX_GAME_ID?.trim()
  return fromEnv && fromEnv.length > 0 ? fromEnv : undefined
}

/**
 * Dispatch one item to `rundot generate <music|sfx|tts>`, writing the
 * raw clip to `rawOutPath` via the CLI's explicit `--out` flag. Using
 * `--out` means we never have to parse provider-specific stdout.
 */
export function runRundotGenerate(
  item: ManifestItem,
  plan: DispatchPlan,
  rawOutPath: string,
  gameId: string | undefined,
): RundotResult {
  mkdirSync(dirname(rawOutPath), { recursive: true })

  let subcommand: string
  let args: string[]

  if (plan.audioType === 'voice') {
    if (!item.voiceId) {
      return { ok: false, errorLog: 'voice item is missing voiceId' }
    }
    subcommand = 'tts'
    args = [
      'generate', 'tts',
      '--text', item.prompt,
      '--voice-id', item.voiceId,
      '--out', rawOutPath,
      '--json',
    ]
  } else if (plan.audioType === 'sfx') {
    subcommand = 'sfx'
    args = [
      'generate', 'sfx',
      '--description', item.prompt,
      '--duration', String(plan.rawDur),
      '--out', rawOutPath,
      '--json',
    ]
  } else {
    subcommand = 'music'
    args = [
      'generate', 'music',
      '--prompt', item.prompt,
      '--duration', String(plan.rawDur),
      '--out', rawOutPath,
      '--json',
    ]
  }

  if (gameId) {
    args.push('--game-id', gameId)
  }

  const result = spawnSync('rundot', args, { encoding: 'utf-8' })
  if (result.status !== 0) {
    return {
      ok: false,
      errorLog: `rundot generate ${subcommand} exit=${result.status}\n${result.stderr ?? ''}\n${result.stdout ?? ''}`,
    }
  }
  if (!existsSync(rawOutPath)) {
    return { ok: false, errorLog: `rundot did not write ${rawOutPath}\n${result.stdout ?? ''}` }
  }
  return { ok: true, rawPath: rawOutPath, errorLog: '' }
}

/**
 * `find-downbeat-trim.mjs` writes the chosen offset (in seconds) as a
 * plain number on stdout; diagnostics go to stderr. Returns 0 if the
 * finder fails or the parse fails — the orchestrator falls back to
 * trimming from the start, which the validator can flag if needed.
 *
 * Resolution order: `tools/find-downbeat-trim.mjs` (canonical, shared
 * across packs) → `<run-dir>/find-downbeat-trim.mjs` (legacy per-run
 * copy retained for the historic lofi runs).
 */
function findDownbeatOffset(runDir: string, rawPath: string, barSec: number): number {
  const finder = resolveTrimHelper(runDir, 'find-downbeat-trim.mjs')
  if (!finder) return 0
  const result = spawnSync('node', [finder, rawPath, String(barSec)], { encoding: 'utf-8' })
  if (result.status !== 0) return 0
  const value = Number((result.stdout ?? '').trim())
  return Number.isFinite(value) && value >= 0 ? value : 0
}

function resolveTrimHelper(runDir: string, filename: string): string | null {
  // Run dirs live at <project>/pack-runs/<run-id>, so two dirname()
  // hops from the run dir land at the project root.
  const projectDir = dirname(dirname(runDir))
  const canonical = join(projectDir, 'tools', filename)
  if (existsSync(canonical)) return canonical
  const legacy = join(runDir, filename)
  if (existsSync(legacy)) return legacy
  return null
}

interface FfmpegResult {
  ok: boolean
  durationSec?: number
  errorLog: string
}

/**
 * Trim + encode the raw clip per `docs/audio-kits.md`:
 *   `volume=0.55` linear gain, 256 kbps mp3, 44.1 kHz stereo.
 */
function trimAndEncode(args: {
  rawPath: string
  outPath: string
  trimStartSec: number
  trimDurSec: number
}): FfmpegResult {
  const result = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-ss', String(args.trimStartSec),
      '-t', String(args.trimDurSec),
      '-i', args.rawPath,
      '-af', 'volume=0.55',
      '-ar', '44100',
      '-ac', '2',
      '-b:a', '256k',
      '-f', 'mp3',
      args.outPath,
    ],
    { encoding: 'utf-8' },
  )
  if (result.status !== 0) {
    return {
      ok: false,
      errorLog: `ffmpeg exit=${result.status}\n${result.stderr ?? ''}`,
    }
  }
  // Probe the final duration so we can log it for sanity checks.
  const probe = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', args.outPath],
    { encoding: 'utf-8' },
  )
  const durationSec =
    probe.status === 0 ? Number((probe.stdout ?? '').trim()) : Number.NaN
  return {
    ok: true,
    durationSec: Number.isFinite(durationSec) ? durationSec : undefined,
    errorLog: '',
  }
}

function trimStartFor(
  kind: ItemKind,
  runDir: string,
  rawPath: string,
  trimSec: number,
): number {
  switch (kind) {
    case 'drum':
    case 'bass':
    case 'melody':
      return findDownbeatOffset(runDir, rawPath, trimSec)
    case 'vocal':
      // Smooth-onset probe heuristic per docs/audio-kits.md — start
      // slightly into the file to skip any initial breath/silence.
      return 0.5
    case 'oneShot':
      // The music generator tail-pads its outputs but ALSO routinely adds
      // a 0.3-3 s silent intro before the actual hit. Trimming from
      // sample 0 captures that silence — the player taps a "Snare
      // Roll" pad and hears nothing. Walk a 20 ms RMS envelope from
      // the start, find the first frame whose energy exceeds a
      // small threshold above the floor, and start the trim there.
      // Cap the offset at half the raw length so a degenerate
      // mostly-silent file still yields a valid window.
      return findFirstOnset(rawPath)
  }
}

/**
 * Scan the raw file's RMS envelope and return the time (seconds) of
 * the first frame whose energy exceeds `RMS * 5` of the leading-noise
 * floor. Returns 0 when no clear onset is found (the trimmer will
 * keep the head-as-is in that case rather than emit garbage).
 */
function findFirstOnset(rawPath: string): number {
  const SR = 44100
  const FRAME_MS = 20
  const FRAME = Math.round((FRAME_MS / 1000) * SR)
  const result = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-i', rawPath, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'],
    { encoding: 'buffer', maxBuffer: 1 << 28 },
  )
  if (result.status !== 0 || !result.stdout) return 0
  const buf = result.stdout
  const samples = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4)
  const n = Math.floor(samples.length / FRAME)
  if (n < 4) return 0
  // Floor: median of first 5 frames (likely to capture quiet head).
  const head: number[] = []
  for (let f = 0; f < Math.min(5, n); f++) {
    let sum = 0
    for (let i = 0; i < FRAME; i++) {
      const v = samples[f * FRAME + i] ?? 0
      sum += v * v
    }
    head.push(Math.sqrt(sum / FRAME))
  }
  head.sort((a, b) => a - b)
  const floor = head[Math.floor(head.length / 2)]!
  // Onset threshold: 5× the head floor, with a 0.01 absolute floor so
  // a near-silent file isn't tripped by encoder dither.
  const threshold = Math.max(0.01, floor * 5)
  for (let f = 0; f < n; f++) {
    let sum = 0
    for (let i = 0; i < FRAME; i++) {
      const v = samples[f * FRAME + i] ?? 0
      sum += v * v
    }
    const rms = Math.sqrt(sum / FRAME)
    if (rms > threshold) {
      // Back off 30 ms so the attack transient itself isn't clipped.
      const onsetSec = (f * FRAME_MS) / 1000
      return Math.max(0, onsetSec - 0.03)
    }
  }
  return 0
}

function generateItem(args: {
  runDir: string
  manifest: Manifest
  item: ManifestItem
  outDir: string
  rawDir: string
  logDir: string
  kitId: string
  gameId: string | undefined
}): boolean {
  const { runDir, manifest, item, outDir, rawDir, logDir, gameId } = args
  const itemLog = join(logDir, `${item.file.replace(/\.mp3$/, '')}.log`)
  const writeLog = (msg: string): void => {
    writeFileSync(itemLog, `${readSafe(itemLog)}${msg}\n`, 'utf-8')
  }
  writeFileSync(itemLog, '', 'utf-8')

  writeLog(`=== ${item.file} (kind=${item.kind}, color=${item.color ?? '-'}, type=${item.type ?? '-'}) ===`)
  writeLog(`PROMPT: ${item.prompt}`)

  let plan: DispatchPlan
  try {
    plan = planFor(item, manifest)
  } catch (err) {
    writeLog(`ERROR plan: ${(err as Error).message}`)
    log(`FAILED ${item.file} (plan)`)
    return false
  }

  const rawOutPath = join(rawDir, item.file)
  const maxAttempts = 2
  let genResult: RundotResult | null = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    writeLog(`--- attempt ${attempt} ---`)
    const r = runRundotGenerate(item, plan, rawOutPath, gameId)
    writeLog(r.errorLog || `OK rawPath=${r.rawPath}`)
    if (r.ok) {
      genResult = r
      break
    }
  }

  if (!genResult || !genResult.rawPath) {
    log(`FAILED ${item.file} (rundot)`)
    return false
  }

  const trimStart = trimStartFor(item.kind, runDir, genResult.rawPath, plan.trimSec)
  writeLog(`trimStart=${trimStart}s, trimDur=${plan.trimSec}s`)

  const outPath = join(outDir, item.file)
  const ff = trimAndEncode({
    rawPath: genResult.rawPath,
    outPath,
    trimStartSec: trimStart,
    trimDurSec: plan.trimSec,
  })
  if (!ff.ok) {
    writeLog(ff.errorLog)
    log(`FAILED ${item.file} (ffmpeg)`)
    return false
  }
  log(`OK ${item.file} dur=${ff.durationSec?.toFixed(6) ?? '?'}s`)
  return true
}

function readSafe(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

function main(): void {
  const opts = parseCli(process.argv.slice(2))
  const manifest = readManifest(opts.runDir)
  // Pre-flight: catch impossible manifests (rawDur > 60s, bar count
  // out of policy, etc.) BEFORE we burn any external API calls.
  const findings = validateManifest(manifest) as string[]
  if (findings.length > 0) {
    console.error(`Manifest pre-flight failed (${findings.length}):`)
    for (const f of findings) console.error(`  - ${f}`)
    process.exit(2)
  }
  const outDir = manifest.outputDir
  const rawDir = join(opts.runDir, 'raw')
  const logDir = join(opts.runDir, 'logs')
  mkdirSync(rawDir, { recursive: true })
  mkdirSync(logDir, { recursive: true })
  mkdirSync(outDir, { recursive: true })

  // cd into the project so `rundot` can discover the local sandbox
  // config (and resolve a default game id) from the project root. The
  // manifest sits at <project>/pack-runs/<run-id>/, so two dirname()
  // hops from the run dir land at the project root.
  const projectDir = dirname(dirname(opts.runDir))
  process.chdir(projectDir)

  const gameId = resolveGameId()
  const kitId = manifest.kitId ?? outDir.split('/').filter(Boolean).pop() ?? 'unknown-kit'

  log(`=== Kit generation: ${kitId} (${join(opts.runDir, 'manifest.json')}) ===`)
  log(`ONLY=${opts.only ?? ''}`)

  const items = manifest.items.filter((i) => !opts.only || i.file === opts.only)
  let failures = 0
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    log(`>>> ${item.file} (${i + 1}/${items.length})`)
    const ok = generateItem({
      runDir: opts.runDir,
      manifest,
      item,
      outDir,
      rawDir,
      logDir,
      kitId,
      gameId,
    })
    if (!ok) failures++
  }
  log(`=== Run complete (${items.length - failures}/${items.length} ok) ===`)
  // Exit non-zero so per-item shell wrappers can detect failure. Without
  // this, a failed item logs "FAILED" inside the script but the process
  // still exits 0, and the caller's `if npx tsx ... ; then …; fi` runs
  // the success branch. The 1-in-N failure pattern this introduced was
  // exactly how the ToS-rejected Soul Hook prompt appeared as "OK" in
  // the regen wrapper.
  if (failures > 0) process.exit(1)
}

// Only run the orchestrator when invoked directly as a script. Importing
// this module (e.g. from unit tests) must not trigger a generation run.
const invokedPath = process.argv[1]
if (invokedPath && fileURLToPath(import.meta.url) === resolve(invokedPath)) {
  main()
}
