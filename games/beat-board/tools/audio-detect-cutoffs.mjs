#!/usr/bin/env node
/**
 * audio-detect-cutoffs — kit-JSON-aware audio validator for BeatBoard kits.
 *
 * Reads BPM + per-pad color from the kit JSON
 * (`src/content-assets/kits/<kitId>.json`), so that file must exist before
 * validating. Missing/unreadable → defaults to 84 BPM (lofi).
 *
 * For every loop / one-shot in the kit's audio directory, decodes the mp3
 * to mono PCM via ffmpeg and runs a battery of checks:
 *
 *   CUT_OFF          — loud endpoint + amplitude discontinuity at the
 *                      loop wrap (audible click each iteration).
 *   SUSPICIOUS       — moderate endpoint energy + wrap discontinuity, OR
 *                      loud sample-0 onset on a vocal loop (mid-phrase
 *                      hard cut suspect).
 *   BAR_VIOLATION    — loop length is not an integer multiple of one bar
 *                      at the kit's BPM (within 5 ms tolerance).
 *   LENGTH_MISMATCH  — loop length, while a valid integer-bar count,
 *                      doesn't match what the kit JSON expects for this
 *                      pad's color (e.g. a 4-bar drum where drums are
 *                      supposed to be 1 or 2 bars).
 *   CYCLE_DRIFT      — strongest energy peak is more than 100 ms off the
 *                      nearest beat boundary; loop will drift when
 *                      layered with downbeat-aligned loops.
 *   PHRASE_LOCKED    — multi-bar loop with a strong per-bar energy
 *                      imbalance (max/min RMS across bars > 3×). The
 *                      loop has a phrase-position dependency that will
 *                      collide with other multi-bar loops launched at
 *                      different bar offsets. Multi-bar pads should be
 *                      authored as phrase-position-agnostic textures
 *                      (vocal chops, sustained pads, evolving
 *                      atmospheres) — not lyrical phrases.
 *   CLIPPED          — peak amplitude exceeds 0.98 (hard digital clip
 *                      headroom violation).
 *   TOO_SHORT/ERROR  — file unreadable or below the analysis floor.
 *
 * Output: console table + JSON regen report at
 *   `tools/.audio-validation.json`
 * suitable for a rundot regen orchestrator.
 *
 * Usage:
 *   node tools/audio-detect-cutoffs.mjs                # default kit
 *   node tools/audio-detect-cutoffs.mjs --kit <id>     # other kit
 */

import { spawn } from 'node:child_process'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve every path from the script's own location so this works on
// any developer's machine and from any CWD. PROJECT_ROOT is one level
// up from `tools/`.
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = dirname(SCRIPT_DIR)

const args = process.argv.slice(2)
const kitArgIdx = args.indexOf('--kit')
const KIT_ID =
  kitArgIdx >= 0 && args[kitArgIdx + 1] ? args[kitArgIdx + 1] : 'lofi_heights_hero'
const AUDIO_DIR = join(PROJECT_ROOT, 'public', 'cdn-assets', 'audio', KIT_ID)
const KIT_JSON_PATH = join(PROJECT_ROOT, 'src', 'content-assets', 'kits', `${KIT_ID}.json`)
const REPORT_PATH = join(SCRIPT_DIR, '.audio-validation.json')

// ffmpeg is invoked by name so it resolves against the developer's PATH
// rather than a Homebrew-specific install location.
const FFMPEG = 'ffmpeg'
const SAMPLE_RATE = 44100
const WINDOW_MS = 50
const WINDOW_SAMPLES = Math.round((WINDOW_MS / 1000) * SAMPLE_RATE)

const RMS_HIGH = 0.05
const RMS_MODERATE = 0.02
const DISCONTINUITY_HIGH = 0.15
const DISCONTINUITY_MODERATE = 0.07

// Bar-locked-loop validation: every loop file's duration must be an
// integer multiple of one bar at the kit's BPM. Tolerance is 5 ms.
// BPM comes from the kit JSON (`bpm` field) so the validator
// works for any genre pack — defaults to 84 (lofi) if the kit JSON
// can't be read or is missing the field.
const KIT_BPM = readKitBpm() ?? 84
const BPM = KIT_BPM
const BAR_SECONDS = (60 / BPM) * 4
const BAR_LOCK_TOLERANCE = 0.005

function readKitBpm() {
  try {
    const json = JSON.parse(readFileSync(KIT_JSON_PATH, 'utf8'))
    if (typeof json.bpm === 'number' && json.bpm > 0) return json.bpm
  } catch {
    // Fallthrough — caller falls back to the lofi default.
  }
  return null
}

/**
 * Manifest-aware bar-count policy. The validator confirms each loop's
 * actual bar count is one of the values allowed for its instrument
 * family. Reflects the *real* Groovepad recipe: every loop is 8 bars
 * with internal phrase shape (bars 1–6 establish, bar 7 vary, bar 8
 * cadence/turnaround). 8 is the LCM of the western popular-music
 * phrase grid (the "32-bar form" is 4 × 8) and gives composers room
 * to put bar-8 fills, antecedent/consequent sub-phrases, and
 * resolution that makes a long ride satisfying. Drum fills + FX stay
 * one-shots (no length constraint).
 */
const ALLOWED_BARS_BY_COLOR = {
  drums: [8],
  bass: [8],
  melody: [8],
  // Vocals ship at 8 / 16 / 32 bars per kit so the player has short
  // chops, evolving phrases, and full hooks. Each kit puts 4 × 8-bar
  // + 2 × 16-bar + 2 × 32-bar across its two banks — see
  // docs/audio-kits.md.
  vocals: [8, 16, 32],
  drumFills: null,
  fx: null,
}

/**
 * Per-bar silence thresholds for the PHRASE_LOCKED check.
 *
 * The naive "energy-uniformity" check (max/min ratio) false-positives
 * on every well-crafted 8-bar loop with an intentional bar-8 fill —
 * fills are *supposed* to be 50–100 % louder than the body bars.
 *
 * The actual collision case is **dropouts** — a near-silent bar inside
 * an otherwise normal loop. When that bar plays, the layered mix
 * collapses by one voice, breaking the player's mental model of the
 * groove. Detect this by flagging a loop only when:
 *
 *   any bar's RMS < SILENT_BAR_RMS_THRESHOLD
 *   AND any other bar's RMS > NOMINAL_BAR_RMS_THRESHOLD
 *
 * (a uniformly quiet loop is fine — the issue is *contrast* between
 * a dropout bar and live bars in the same loop.)
 */
const SILENT_BAR_RMS_THRESHOLD = 0.02
const NOMINAL_BAR_RMS_THRESHOLD = 0.10

/**
 * Hard-clip detection threshold on absolute peak amplitude. Set above
 * 1.0 because the f32 mp3 decoder reconstructs encoder-side transient
 * overshoot (typically 5–15 % above the original PCM peak); decoded
 * peaks in the 1.0–1.10 range are normal codec artifacts handled by
 * the runtime master limiter, not source clipping. Real source clipping
 * pushes decoded peaks well above 1.20 (often 1.30+).
 */
const CLIP_PEAK_THRESHOLD = 1.20

/**
 * SUSTAIN_GAP detector — finds sub-bar dropouts in sustained-energy
 * loops (bass, melody). The PHRASE_LOCKED check operates on the bar
 * grid; this one walks a frame-level RMS envelope to catch dead-air
 * windows that span fewer than one bar (e.g. the 600 ms silence at the
 * end of a Reese sub-bass loop).
 *
 * A clean sustained loop's envelope has its body above
 * `median × SUSTAIN_GAP_RATIO`. Any contiguous run of frames below
 * that ratio that lasts longer than `SUSTAIN_GAP_MIN_MS` and isn't
 * adjacent to the start/end (those are wrap-related and covered by the
 * head/tail RMS checks) is the kind of "weird gap" you can hear when
 * the layered mix briefly loses a voice mid-loop.
 *
 * Periodic LFO troughs (the dips of a wobble or filter sweep) are
 * shorter than this threshold by construction at typical 84-174 BPM
 * tempos, so they don't trip the detector.
 */
const SUSTAIN_GAP_RATIO = 0.30
const SUSTAIN_GAP_MIN_MS = 250
const SUSTAIN_GAP_FRAME_MS = 20

/**
 * SUSTAIN_CLICK detector — flags isolated sample-level discontinuities
 * inside sustained loops via linear-prediction residual outliers.
 * Predict each sample from a 3rd-order linear extrapolation of its
 * three predecessors, compute the residual, and call any sample whose
 * residual is more than `SUSTAIN_CLICK_RESID_RATIO ×` the local 50 ms
 * RMS of the residual a click candidate.
 *
 * Drum loops naturally trip this on every transient attack, so the
 * verdict is scoped to non-drum, non-vocal pitched loops via the
 * manifest color. Two attack-shaped residuals on a clean bass aren't
 * enough to flag a loop — `SUSTAIN_CLICK_MIN_PEAKS` is the floor.
 */
const SUSTAIN_CLICK_RESID_RATIO = 8
const SUSTAIN_CLICK_RESID_FLOOR = 0.1
const SUSTAIN_CLICK_LOCAL_WINDOW_MS = 50
const SUSTAIN_CLICK_MIN_PEAKS = 3

// LOOP_TAIL_FADE — catches the "engineer forced sample 0 == sample N-1
// to suppress wrap discontinuity, but the tail is still at full energy"
// case that slips past CUT_OFF (which requires HIGH wrap discontinuity).
// We compare the last 20 ms RMS against the 20 ms BEFORE that. A loop
// with any natural tail decay has last-20 < pre-tail. A hard cut has
// last-20 ≈ pre-tail (flat) or rising. The ratio threshold of 0.95
// only flags loops with effectively no decay — leaving gentle natural
// fades alone. Vocal pads are skipped (phrase-led, can sustain into
// the wrap).
const TAIL_FADE_PROBE_MS = 20
const TAIL_FADE_MIN_TAIL_RMS = 0.04
const TAIL_FADE_DECAY_MIN_RATIO = 0.95

// LOUDNESS_OUTLIER — kit-wide RMS variance check. After per-file
// analysis the main loop computes the median full-loop RMS across all
// LOOP files and flags any loop > 2.5× or < 0.4× of the median. Mixed
// loudness across a kit means the player taps a "drums" pad and gets
// a quiet thump while another pad drowns the mix — happens when the
// LLM source returns wildly varying gain across generations.
const LOUDNESS_OUTLIER_MIN_RMS = 0.01 // floor — silent files are
                                       // already caught by SILENT_ATTACK
const LOUDNESS_OUTLIER_HIGH_RATIO = 2.5
const LOUDNESS_OUTLIER_LOW_RATIO = 0.4

function decodeToFloat32(file) {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner', '-loglevel', 'error',
      '-i', file,
      '-ac', '1', // collapse to mono
      '-ar', String(SAMPLE_RATE),
      '-f', 'f32le',
      '-',
    ]
    const ff = spawn(FFMPEG, args)
    const chunks = []
    ff.stdout.on('data', (c) => chunks.push(c))
    ff.stderr.on('data', () => {})
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exit ${code} on ${file}`))
      const buf = Buffer.concat(chunks)
      const floats = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4)
      resolve(floats)
    })
    ff.on('error', reject)
  })
}

function rms(samples) {
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i]
    sum += v * v
  }
  return Math.sqrt(sum / Math.max(1, samples.length))
}

function peak(samples) {
  let p = 0
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i])
    if (a > p) p = a
  }
  return p
}

/**
 * 1-pole IIR low-pass filter, applied in-place equivalent. Returns the
 * RMS of the filtered signal so callers can compare low-band energy to
 * full-band energy without allocating a second buffer.
 *
 * Used by the VOCAL_HAS_BACKGROUND check — pure a-cappella vocals have
 * <15% of their energy in the sub-180 Hz band; vocals with a backing
 * track (drums, bass, music) easily push past 30%.
 */
function lowBandRms(samples, cutoffHz, sampleRate) {
  if (cutoffHz <= 0 || sampleRate <= 0) return 0
  const RC = 1 / (2 * Math.PI * cutoffHz)
  const dt = 1 / sampleRate
  const alpha = dt / (RC + dt)
  let prev = 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    prev = alpha * samples[i] + (1 - alpha) * prev
    sum += prev * prev
  }
  return Math.sqrt(sum / Math.max(1, samples.length))
}

/**
 * Compute a per-frame energy envelope (RMS in 10 ms windows) and find
 * the strongest peak's offset (in seconds) plus the tempo implied by
 * the spacing between strong onsets. This catches loops whose audio
 * CONTENT is at a different BPM than the file's length suggests, OR
 * whose strongest hit is not at the expected downbeat.
 */
function analyzeOnsets(samples) {
  const FRAME_MS = 10
  const FRAME_SAMPLES = Math.round((FRAME_MS / 1000) * SAMPLE_RATE)
  const frameCount = Math.floor(samples.length / FRAME_SAMPLES)
  const envelope = new Float32Array(frameCount)
  for (let f = 0; f < frameCount; f++) {
    let sum = 0
    const start = f * FRAME_SAMPLES
    for (let i = 0; i < FRAME_SAMPLES; i++) {
      const v = samples[start + i] ?? 0
      sum += v * v
    }
    envelope[f] = Math.sqrt(sum / FRAME_SAMPLES)
  }
  // Find the global peak time and value
  let peakIdx = 0
  let peakVal = 0
  for (let f = 0; f < frameCount; f++) {
    if (envelope[f] > peakVal) {
      peakVal = envelope[f]
      peakIdx = f
    }
  }
  const peakTimeS = (peakIdx * FRAME_MS) / 1000

  // Onset detection: a frame is an onset if its energy is at least 1.4×
  // the median of the surrounding 10 frames AND > 30% of peakVal. Returns
  // onset times in seconds.
  const onsets = []
  const WINDOW = 5
  for (let f = WINDOW; f < frameCount - WINDOW; f++) {
    const e = envelope[f]
    if (e < peakVal * 0.3) continue
    let sum = 0
    let count = 0
    for (let k = -WINDOW; k <= WINDOW; k++) {
      if (k === 0) continue
      sum += envelope[f + k]
      count++
    }
    const localMean = sum / count
    if (e > localMean * 1.4) {
      // Suppress duplicate onsets within 80 ms.
      const tS = (f * FRAME_MS) / 1000
      const last = onsets[onsets.length - 1]
      if (last === undefined || tS - last > 0.08) onsets.push(tS)
    }
  }
  return { peakTimeS, peakVal, onsets, frameCount }
}

/**
 * Compute per-bar RMS over a loop's full duration. Returns null when the
 * loop isn't an integer-bar length (caller should run BAR_VIOLATION
 * first). The ratio max/min across these bars drives the PHRASE_LOCKED
 * check — uniform loops have ratio ≈ 1, phrase-led loops can hit 5×+.
 */
function computePerBarRms(samples, bars) {
  if (bars < 2) return null
  const samplesPerBar = Math.floor(samples.length / bars)
  if (samplesPerBar <= 0) return null
  const out = new Array(bars)
  for (let b = 0; b < bars; b++) {
    const start = b * samplesPerBar
    const end = b === bars - 1 ? samples.length : start + samplesPerBar
    let sum = 0
    let count = 0
    for (let i = start; i < end; i++) {
      const v = samples[i] ?? 0
      sum += v * v
      count++
    }
    out[b] = Math.sqrt(sum / Math.max(1, count))
  }
  return out
}

/**
 * Frame-level RMS envelope. Returns one RMS value per `frameMs`-long
 * non-overlapping window across the buffer.
 */
function frameRmsEnvelope(samples, frameMs) {
  const frameSamples = Math.round((frameMs / 1000) * SAMPLE_RATE)
  if (frameSamples < 1) return new Float32Array(0)
  const n = Math.floor(samples.length / frameSamples)
  const env = new Float32Array(n)
  for (let f = 0; f < n; f++) {
    let sum = 0
    const start = f * frameSamples
    for (let i = 0; i < frameSamples; i++) {
      const v = samples[start + i] ?? 0
      sum += v * v
    }
    env[f] = Math.sqrt(sum / frameSamples)
  }
  return env
}

function median(values) {
  if (!values.length) return 0
  const sorted = Array.from(values).sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/**
 * Find the longest contiguous run of frames whose RMS is below
 * `medianRms × SUSTAIN_GAP_RATIO`. Returns null if no run exceeds the
 * minimum-length threshold. Runs include those touching the head or
 * tail of the buffer — a 600 ms silence at the end of a sustained
 * Reese loop is exactly what we want to catch, and the 50 ms
 * head/tail RMS check won't flag it because the very last window IS
 * silent (which only suppresses CUT_OFF, not SUSTAIN_GAP).
 */
function findLongestSustainGap(envelope, medianRms) {
  if (envelope.length < 4 || medianRms <= 0) return null
  const threshold = medianRms * SUSTAIN_GAP_RATIO
  const minFrames = Math.ceil(SUSTAIN_GAP_MIN_MS / SUSTAIN_GAP_FRAME_MS)
  let bestStart = -1
  let bestLen = 0
  let runStart = -1
  function consider(start, len) {
    if (len > bestLen) {
      bestLen = len
      bestStart = start
    }
  }
  for (let i = 0; i < envelope.length; i++) {
    if (envelope[i] < threshold) {
      if (runStart < 0) runStart = i
    } else if (runStart >= 0) {
      consider(runStart, i - runStart)
      runStart = -1
    }
  }
  if (runStart >= 0) consider(runStart, envelope.length - runStart)
  if (bestLen < minFrames) return null
  return {
    startSec: (bestStart * SUSTAIN_GAP_FRAME_MS) / 1000,
    durationMs: bestLen * SUSTAIN_GAP_FRAME_MS,
    medianRms,
    threshold,
  }
}

/**
 * Click detector via linear-prediction residual. For each sample i we
 * predict `s[i] ≈ 3·s[i-1] − 3·s[i-2] + s[i-3]` (the third-order
 * one-step extrapolation of a smooth signal); the residual `s[i] − pred`
 * is dwarfed by the local rolling RMS of the residual whenever the
 * waveform is locally smooth. An isolated discontinuity emits a single
 * residual sample many σ above the rolling baseline.
 */
function lpcClickPeaks(samples) {
  const N = samples.length
  if (N < 4) return []
  const resid = new Float32Array(N)
  for (let i = 3; i < N; i++) {
    const pred = 3 * samples[i - 1] - 3 * samples[i - 2] + samples[i - 3]
    resid[i] = samples[i] - pred
  }
  const W = Math.round((SUSTAIN_CLICK_LOCAL_WINDOW_MS / 1000) * SAMPLE_RATE)
  const peaks = []
  // Sample the residual every 10 samples — clicks are isolated single-
  // sample outliers, so we don't need to test every position to find
  // them, and this keeps the O(N·W) scan tractable on a 12 s loop.
  for (let i = W; i < N - W; i += 10) {
    let sum = 0
    for (let k = -W; k < W; k++) {
      const r = resid[i + k]
      sum += r * r
    }
    const rms = Math.sqrt(sum / (2 * W))
    if (rms <= 0) continue
    const r = Math.abs(resid[i])
    if (r > SUSTAIN_CLICK_RESID_RATIO * rms && r > SUSTAIN_CLICK_RESID_FLOOR) {
      peaks.push({ sampleIdx: i, timeSec: i / SAMPLE_RATE, residual: resid[i], localRms: rms, ratio: r / rms })
    }
  }
  // De-duplicate within 5 ms — a single click can produce a few
  // adjacent above-threshold positions.
  peaks.sort((a, b) => a.sampleIdx - b.sampleIdx)
  const minGap = Math.round(0.005 * SAMPLE_RATE)
  const out = []
  let last = -Infinity
  for (const p of peaks) {
    if (p.sampleIdx - last < minGap) continue
    out.push(p)
    last = p.sampleIdx
  }
  return out
}

/**
 * Read the kit JSON and index pad metadata by buffer-file basename so
 * the analyzer can look up each file's expected color, one-shot status,
 * and layer name.
 */
function loadKitPadIndex() {
  try {
    const json = JSON.parse(readFileSync(KIT_JSON_PATH, 'utf8'))
    const index = new Map()
    for (const pad of json.pads ?? []) {
      const base = (pad.bufferUrl ?? '').split('/').pop()
      if (base) index.set(base, pad)
    }
    return index
  } catch (err) {
    console.warn(`[validator] could not read ${KIT_JSON_PATH}: ${err.message}`)
    return new Map()
  }
}

async function analyze(file, manifestEntry) {
  const samples = await decodeToFloat32(file)
  if (samples.length < WINDOW_SAMPLES * 2) {
    return { file, verdict: 'TOO_SHORT', durationS: samples.length / SAMPLE_RATE }
  }
  const head = samples.slice(0, WINDOW_SAMPLES)
  const tail = samples.slice(samples.length - WINDOW_SAMPLES)
  const headRms = rms(head)
  const tailRms = rms(tail)
  const headPeak = peak(head)
  const tailPeak = peak(tail)
  // Discontinuity: amplitude difference between the last sample and the
  // first sample (what `loop=true` actually wraps).
  const wrap = Math.abs(samples[samples.length - 1] - samples[0])
  const durationS = samples.length / SAMPLE_RATE

  // Verdict logic:
  //   - HIGH endpoint energy with HIGH wrap discontinuity → cut off / clicks.
  //   - HIGH endpoint energy with low wrap → seamless loud loop (acceptable).
  //   - LOW endpoint energy → natural decay (acceptable).
  //
  // Skip both CUT_OFF and SUSPICIOUS for one-shots — they play once and
  // stop, so the boundary between sample N and sample 0 is never heard.
  // (One-shots are flagged via filename prefix `fills-` / `fx-`; manifest
  // metadata isn't available at this point.)
  let verdict = 'OK'
  let reason = ''
  const isOneShotFile = isOneShot(file)
  if (!isOneShotFile && tailRms > RMS_HIGH && wrap > DISCONTINUITY_HIGH) {
    verdict = 'CUT_OFF'
    reason = `tail rms=${tailRms.toFixed(3)} + wrap discontinuity=${wrap.toFixed(3)} → loop click`
  } else if (!isOneShotFile && tailRms > RMS_MODERATE && wrap > DISCONTINUITY_MODERATE) {
    verdict = 'SUSPICIOUS'
    reason = `tail rms=${tailRms.toFixed(3)} + wrap=${wrap.toFixed(3)}`
  } else if (
    !isOneShot(file) &&
    !isDrum(file) &&
    !isDownbeatLed(file) &&
    headRms > RMS_HIGH &&
    headPeak > 0.5
  ) {
    // Loud sample at the start of a LOOP without natural attack envelope —
    // characteristic of mid-phrase hard cut. Excluded:
    //   - one-shots (loud attack is the design)
    //   - drums (kick on beat 1 should be loud at sample 0)
    //   - bass / melody (downbeat-led: chord on beat 1 should be loud)
    // What's left: vocals (where a loud sample-0 IS suspicious because
    // vocal phrases typically peak in the middle of a syllable, not at
    // the start).
    verdict = 'SUSPICIOUS'
    reason = `head rms=${headRms.toFixed(3)} peak=${headPeak.toFixed(3)} (loud onset on loop)`
  } else if (
    isOneShotFile &&
    headRms < 0.01 &&
    rms(samples) < 0.03 &&
    peak(samples) < 0.1
  ) {
    // SILENT_ATTACK — one-shot is effectively inaudible across all of
    // first-100ms RMS, full-loop RMS, AND peak amplitude. The earlier
    // version (head + RMS only) false-flagged legitimate slow
    // build-ups and tail-fading swooshes whose RMS is naturally low
    // but whose peaks reach 0.15-0.30. Adding a peak-amplitude clause
    // (< 0.1 ≈ -20 dBFS) keeps the rule tight on the original bug —
    // trimStartFor returned 0 so the trim captured the music generator's
    // silent intro padding — without flagging quieter-by-design fills.
    verdict = 'SILENT_ATTACK'
    reason =
      `one-shot first-100ms RMS=${headRms.toFixed(4)}, full-loop RMS=${rms(samples).toFixed(4)}, ` +
      `peak=${peak(samples).toFixed(4)}; entire loop is below audible threshold — ` +
      `trimmer captured the silent intro instead of the actual hit`
  }

  // Bar-lock check — only loops, since one-shots aren't required to be
  // integer-bar lengths. The closest integer bar count and its delta:
  let resolvedBars = null
  const padIsOneShot =
    manifestEntry?.isOneShot === true || isOneShot(file)
  if (!padIsOneShot && verdict !== 'CUT_OFF') {
    const bars = durationS / BAR_SECONDS
    const closestBars = Math.round(bars)
    const deltaSeconds = Math.abs(closestBars * BAR_SECONDS - durationS)
    if (closestBars < 1 || deltaSeconds > BAR_LOCK_TOLERANCE) {
      verdict = 'BAR_VIOLATION'
      reason =
        `duration ${durationS.toFixed(4)}s = ${bars.toFixed(3)} bars at ${BPM} BPM; ` +
        `closest integer bars=${closestBars}, delta=${(deltaSeconds * 1000).toFixed(1)}ms (threshold ${BAR_LOCK_TOLERANCE * 1000}ms)`
    } else {
      resolvedBars = closestBars
    }
  }

  // Length-policy check: integer-bar count must be one of the values
  // allowed for this pad's color (most rhythm = 1 bar, vocals = 2-4
  // bars). Skipped for one-shots and when manifest data is absent.
  if (
    verdict === 'OK' &&
    resolvedBars !== null &&
    manifestEntry &&
    !padIsOneShot
  ) {
    const allowed = ALLOWED_BARS_BY_COLOR[manifestEntry.color] ?? null
    if (allowed && !allowed.includes(resolvedBars)) {
      verdict = 'LENGTH_MISMATCH'
      reason =
        `${resolvedBars}-bar loop on color "${manifestEntry.color}"; ` +
        `policy allows ${allowed.join('/')} bars`
    }
  }

  // Cycle-alignment check — ONLY for loops (one-shots can have their
  // strongest onset wherever). The strongest energy peak should land
  // near sample 0 OR near a beat boundary (every quarter-bar). If the
  // peak is mid-bar by > 100 ms the loop almost certainly drifts when
  // layered with other loops that DO have their downbeat at sample 0.
  //
  // Vocals are excluded — they're often phrase-led, peak in the middle
  // of a sustained syllable, and don't have a percussive downbeat.
  if (!isOneShot(file) && verdict === 'OK') {
    const isVocal = file.split('/').pop().toLowerCase().startsWith('vocals-')
    if (!isVocal) {
      const onsetReport = analyzeOnsets(samples)
      const bars = Math.round(durationS / BAR_SECONDS)
      const beatS = BAR_SECONDS / 4 // a quarter note
      // Closest beat-grid time (multiples of beatS within the loop).
      const totalBeats = bars * 4
      let nearestBeatIdx = 0
      let nearestBeatDelta = Infinity
      for (let b = 0; b < totalBeats; b++) {
        const d = Math.abs(b * beatS - onsetReport.peakTimeS)
        if (d < nearestBeatDelta) {
          nearestBeatDelta = d
          nearestBeatIdx = b
        }
      }
      const ALIGN_TOLERANCE_S = 0.1
      if (nearestBeatDelta > ALIGN_TOLERANCE_S) {
        verdict = 'CYCLE_DRIFT'
        reason =
          `loudest onset at ${onsetReport.peakTimeS.toFixed(3)}s; nearest beat ` +
          `${nearestBeatIdx} (= ${(nearestBeatIdx * beatS).toFixed(3)}s) is ` +
          `${(nearestBeatDelta * 1000).toFixed(0)}ms away (tolerance ${ALIGN_TOLERANCE_S * 1000}ms). ` +
          `Loop content does not align to the global beat grid.`
      }
    }
  }

  // Dropout check: only meaningful for multi-bar loops. A loop with a
  // near-silent bar AND a normal-energy bar elsewhere has a "phrase
  // dropout" — when the silent bar plays, the layered mix collapses
  // audibly. Bar-8 fills LOUDER than body bars (the intentional
  // Groovepad cadence) are explicitly fine; only silence is flagged.
  if (verdict === 'OK' && resolvedBars !== null && resolvedBars >= 2) {
    const perBar = computePerBarRms(samples, resolvedBars)
    if (perBar) {
      const minRms = Math.min(...perBar)
      const maxRms = Math.max(...perBar)
      if (minRms < SILENT_BAR_RMS_THRESHOLD && maxRms > NOMINAL_BAR_RMS_THRESHOLD) {
        verdict = 'PHRASE_LOCKED'
        reason =
          `bar-${perBar.indexOf(minRms) + 1} RMS=${minRms.toFixed(3)} (near-silent, < ${SILENT_BAR_RMS_THRESHOLD}) ` +
          `while bar-${perBar.indexOf(maxRms) + 1} RMS=${maxRms.toFixed(3)} (live, > ${NOMINAL_BAR_RMS_THRESHOLD}); ` +
          `bars=[${perBar.map((r) => r.toFixed(3)).join(', ')}]. ` +
          `Loop has a dropout bar — when it plays, the layered mix collapses. ` +
          `Re-author with continuous energy across all bars (intentional bar-8 fills are fine; total silence is not).`
      }
    }
  }

  // Sustain checks: scoped to pitched sustained loops (bass + melody).
  // Drums get a free pass (transients trip the click detector by
  // design); vocals have their own verdicts (PHRASE_LOCKED, BAR1_NO_ATTACK,
  // VOCAL_HAS_BACKGROUND). One-shots short-circuit because they're not
  // expected to sustain.
  const isSustainedColor =
    manifestEntry?.color === 'bass' || manifestEntry?.color === 'melody'
  if (verdict === 'OK' && isSustainedColor && !padIsOneShot) {
    // SUSTAIN_GAP — long sub-bar dropout in an otherwise sustained loop.
    const env = frameRmsEnvelope(samples, SUSTAIN_GAP_FRAME_MS)
    const med = median(env)
    const gap = findLongestSustainGap(env, med)
    if (gap) {
      verdict = 'SUSTAIN_GAP'
      reason =
        `${gap.durationMs}ms dropout starting at ${gap.startSec.toFixed(2)}s ` +
        `(envelope < ${gap.threshold.toFixed(3)} = ${(SUSTAIN_GAP_RATIO * 100).toFixed(0)}% of median ${med.toFixed(3)}). ` +
        `Sustained ${manifestEntry.color} loop should not have continuous low-RMS windows ≥ ${SUSTAIN_GAP_MIN_MS} ms — ` +
        `when this gap plays, the layered mix briefly loses a voice.`
    }
  }
  if (verdict === 'OK' && isSustainedColor && !padIsOneShot) {
    // SUSTAIN_CLICK — isolated sample-level discontinuities.
    const peaks = lpcClickPeaks(samples)
    if (peaks.length >= SUSTAIN_CLICK_MIN_PEAKS) {
      const top = [...peaks].sort((a, b) => b.ratio - a.ratio).slice(0, 3)
      verdict = 'SUSTAIN_CLICK'
      reason =
        `${peaks.length} click outliers in a sustained ${manifestEntry.color} loop ` +
        `(LPC residual > ${SUSTAIN_CLICK_RESID_RATIO}× local RMS, |resid| > ${SUSTAIN_CLICK_RESID_FLOOR}). ` +
        `Top: ` +
        top
          .map((p) => `t=${p.timeSec.toFixed(2)}s ratio=${p.ratio.toFixed(1)}×`)
          .join(', ') +
        `. Re-roll the loop or de-click via the source.`
    }
  }

  // Clipping check: sample-level peak above the headroom threshold.
  if (verdict === 'OK') {
    const fullPeak = Math.max(headPeak, tailPeak, peak(samples))
    if (fullPeak > CLIP_PEAK_THRESHOLD) {
      verdict = 'CLIPPED'
      reason = `peak amplitude ${fullPeak.toFixed(3)} exceeds ${CLIP_PEAK_THRESHOLD} headroom threshold`
    }
  }

  // Vocal-background check: vocal pads must be a cappella. The music
  // generator will silently include drums + bass + a backing track if the prompt
  // doesn't aggressively forbid them — and that backing track stacks on
  // top of the kit's loop layer when the player taps the vocal pad,
  // turning the mix to mud. We sample sub-100 Hz (below typical voice
  // fundamentals — even deep male singing rarely puts much energy
  // there) — bass instruments and kick drums dominate that band. Pure
  // vocals stay under ~12% in sub-100 Hz; backings push past 25%.
  if (
    verdict === 'OK' &&
    !padIsOneShot &&
    file.split('/').pop().toLowerCase().startsWith('vocals-')
  ) {
    const fullRms = rms(samples)
    if (fullRms > 0) {
      // Cutoff at 80 Hz — below most male voice fundamentals (~120 Hz)
      // but right where bass instruments and kick drums dominate.
      // Threshold 35%: real recorded voice with chest resonance + plosives
      // can hit 25-30% in this band even a cappella; backings push past
      // 40-50%. Tuned to flag genuine instrumentation, not voice quality.
      const lowRms = lowBandRms(samples, 80, SAMPLE_RATE)
      const lowFraction = lowRms / fullRms
      if (lowFraction > 0.35) {
        verdict = 'VOCAL_HAS_BACKGROUND'
        reason =
          `sub-80Hz energy is ${(lowFraction * 100).toFixed(1)}% of full-band ` +
          `(threshold 35%; pure a-cappella typically <25%). Vocal pad has a ` +
          `backing track — the generator added drums/bass/music despite the ` +
          `"PURE VOCAL" prompt. Re-author the vocal prompt with stronger ` +
          `exclusion language.`
      }
    }
  }

  // Tail-fade check: the last 20 ms RMS should be meaningfully lower
  // than the 20 ms BEFORE it (natural decay). When the tail is loud AND
  // flat (no decay), a wrap-click is likely even if the engineer forced
  // sample 0 ≈ sample N-1 to defeat the discontinuity check. Vocals
  // skipped — phrase-led tails frequently sustain into the wrap.
  const isVocalFile = file.split('/').pop().toLowerCase().startsWith('vocals-')
  if (verdict === 'OK' && !padIsOneShot && !isVocalFile) {
    const probe = Math.round((TAIL_FADE_PROBE_MS / 1000) * SAMPLE_RATE)
    if (samples.length >= probe * 2) {
      const last = samples.slice(samples.length - probe)
      const preLast = samples.slice(samples.length - probe * 2, samples.length - probe)
      const lastRms = rms(last)
      const preRms = rms(preLast)
      if (
        lastRms > TAIL_FADE_MIN_TAIL_RMS &&
        preRms > 0 &&
        lastRms / preRms > TAIL_FADE_DECAY_MIN_RATIO
      ) {
        verdict = 'LOOP_TAIL_FADE'
        reason =
          `last ${TAIL_FADE_PROBE_MS}ms RMS=${lastRms.toFixed(4)} is ` +
          `${((lastRms / preRms) * 100).toFixed(0)}% of the prior ${TAIL_FADE_PROBE_MS}ms ` +
          `(${preRms.toFixed(4)}). Tail does not decay — wrap click likely on every ` +
          `loop iteration even though sample-0/sample-N wrap is forced. ` +
          `Author the loop with a natural release on the last beat.`
      }
    }
  }

  // Bar-1 attack check: every loop should open with audible energy in
  // its first ~200 ms. A loop whose first 200 ms is near-silent
  // perceptually shifts the loop seam mid-bar — the player counts 7
  // bars of music plus a "leading silence" rather than 8 bars of
  // groove. Excluded for vocals (phrase-led, can start soft) and
  // one-shots (header silence is fine).
  if (
    verdict === 'OK' &&
    !padIsOneShot &&
    !file.split('/').pop().toLowerCase().startsWith('vocals-')
  ) {
    const HEAD_200_MS_SAMPLES = Math.round(0.2 * SAMPLE_RATE)
    const head200 = samples.slice(0, Math.min(HEAD_200_MS_SAMPLES, samples.length))
    const head200Rms = rms(head200)
    const fullRms = rms(samples)
    if (fullRms > 0 && head200Rms < fullRms * 0.20) {
      verdict = 'BAR1_NO_ATTACK'
      reason =
        `first-200ms RMS=${head200Rms.toFixed(4)} is ${(head200Rms / fullRms * 100).toFixed(1)}% of ` +
        `full-loop RMS=${fullRms.toFixed(4)} (threshold 20%). The loop opens with ` +
        `near-silence — the player will hear 7 bars of music with a "leading ` +
        `silence" rather than 8 bars of groove. Re-prompt for a strong, ` +
        `accented attack on bar 1 beat 1.`
    }
  }

  // Full-loop RMS for the kit-wide loudness pass in main().
  const fullRms = rms(samples)

  return {
    file,
    verdict,
    reason,
    durationS,
    headRms,
    tailRms,
    headPeak,
    tailPeak,
    wrap,
    resolvedBars,
    fullRms,
    color: manifestEntry?.color ?? null,
    layerName: manifestEntry?.layerName ?? null,
    isOneShot: padIsOneShot,
  }
}

// One-shots (fills, fx stings) have loud onsets by design — a kick or
// snare should hit at full amplitude on sample 0. Skip them when looking
// for cut-off-style discontinuities. Loops (drums, bass, melody, vocals)
// should never have a loud-onset waveform without a smooth wrap.
function isOneShot(file) {
  const base = file.split('/').pop().toLowerCase()
  return base.startsWith('fills-') || base.startsWith('fx-')
}

function isDrum(file) {
  return file.split('/').pop().toLowerCase().startsWith('drums-')
}

/**
 * "Downbeat-led" loops are bass + melody where, post-cycle-alignment,
 * the strongest hit IS at sample 0 by design (it's the chord-on-beat-1).
 * The SUSPICIOUS heuristic (loud head onset on a non-drum loop) was
 * originally meant to catch mid-phrase truncation; for downbeat-aligned
 * bass/melody it false-positives on the intentional opening hit. Excluded
 * from the SUSPICIOUS check the same way drums are.
 */
function isDownbeatLed(file) {
  const base = file.split('/').pop().toLowerCase()
  return base.startsWith('bass-') || base.startsWith('melody-')
}

async function main() {
  const padIndex = loadKitPadIndex()

  const files = readdirSync(AUDIO_DIR)
    .filter((f) => f.endsWith('.mp3'))
    .map((f) => join(AUDIO_DIR, f))
    .filter((f) => statSync(f).size > 0)
    .sort()

  const results = []
  for (const file of files) {
    const base = file.split('/').pop()
    const manifestEntry = padIndex.get(base) ?? null
    try {
      const r = await analyze(file, manifestEntry)
      results.push(r)
    } catch (err) {
      results.push({ file, verdict: 'ERROR', reason: String(err) })
    }
  }

  // Kit-wide loudness outlier pass. Median RMS is taken over LOOP files
  // that survived the per-file verdict (i.e. verdict === 'OK'). One-shots
  // are excluded — they're allowed to be loud or quiet by design.
  const loopOkRms = results
    .filter((r) => r.verdict === 'OK' && !r.isOneShot && r.fullRms != null)
    .map((r) => r.fullRms)
    .filter((v) => v >= LOUDNESS_OUTLIER_MIN_RMS)
    .sort((a, b) => a - b)
  if (loopOkRms.length >= 4) {
    const medianRms = loopOkRms[Math.floor(loopOkRms.length / 2)]
    for (const r of results) {
      if (r.verdict !== 'OK' || r.isOneShot || r.fullRms == null) continue
      if (r.fullRms < LOUDNESS_OUTLIER_MIN_RMS) continue
      const ratio = r.fullRms / medianRms
      if (
        ratio > LOUDNESS_OUTLIER_HIGH_RATIO ||
        ratio < LOUDNESS_OUTLIER_LOW_RATIO
      ) {
        r.verdict = 'LOUDNESS_OUTLIER'
        r.reason =
          `RMS=${r.fullRms.toFixed(4)} is ${ratio.toFixed(2)}× kit median ` +
          `${medianRms.toFixed(4)} (acceptable band ${LOUDNESS_OUTLIER_LOW_RATIO}–${LOUDNESS_OUTLIER_HIGH_RATIO}×). ` +
          `When the player layers this with other loops, perceived ` +
          `loudness will be uneven. Re-author or normalize.`
      }
    }
  }

  const byVerdict = (v) => results.filter((r) => r.verdict === v)
  const cutOff = byVerdict('CUT_OFF')
  const barViolation = byVerdict('BAR_VIOLATION')
  const lengthMismatch = byVerdict('LENGTH_MISMATCH')
  const cycleDrift = byVerdict('CYCLE_DRIFT')
  const phraseLocked = byVerdict('PHRASE_LOCKED')
  const clipped = byVerdict('CLIPPED')
  const suspicious = byVerdict('SUSPICIOUS')
  const vocalHasBackground = byVerdict('VOCAL_HAS_BACKGROUND')
  const bar1NoAttack = byVerdict('BAR1_NO_ATTACK')
  const sustainGap = byVerdict('SUSTAIN_GAP')
  const sustainClick = byVerdict('SUSTAIN_CLICK')
  const silentAttack = byVerdict('SILENT_ATTACK')
  const loopTailFade = byVerdict('LOOP_TAIL_FADE')
  const loudnessOutlier = byVerdict('LOUDNESS_OUTLIER')
  const errors = results.filter(
    (r) => r.verdict === 'ERROR' || r.verdict === 'TOO_SHORT',
  )

  console.log('═'.repeat(70))
  console.log(`Kit:    ${KIT_ID}`)
  console.log(`Audio:  ${AUDIO_DIR}`)
  console.log(`Scanned ${results.length} files`)
  console.log(`  CUT_OFF:              ${cutOff.length}`)
  console.log(`  BAR_VIOLATION:        ${barViolation.length}`)
  console.log(`  LENGTH_MISMATCH:      ${lengthMismatch.length}`)
  console.log(`  CYCLE_DRIFT:          ${cycleDrift.length}`)
  console.log(`  PHRASE_LOCKED:        ${phraseLocked.length}`)
  console.log(`  SUSTAIN_GAP:          ${sustainGap.length}`)
  console.log(`  SUSTAIN_CLICK:        ${sustainClick.length}`)
  console.log(`  SILENT_ATTACK:        ${silentAttack.length}`)
  console.log(`  CLIPPED:              ${clipped.length}`)
  console.log(`  SUSPICIOUS:           ${suspicious.length}`)
  console.log(`  VOCAL_HAS_BACKGROUND: ${vocalHasBackground.length}`)
  console.log(`  BAR1_NO_ATTACK:       ${bar1NoAttack.length}`)
  console.log(`  LOOP_TAIL_FADE:       ${loopTailFade.length}`)
  console.log(`  LOUDNESS_OUTLIER:     ${loudnessOutlier.length}`)
  console.log(`  ERRORS:               ${errors.length}`)
  console.log('═'.repeat(70))

  const failing = [
    ...cutOff,
    ...barViolation,
    ...lengthMismatch,
    ...cycleDrift,
    ...phraseLocked,
    ...sustainGap,
    ...sustainClick,
    ...silentAttack,
    ...clipped,
    ...vocalHasBackground,
    ...bar1NoAttack,
    ...loopTailFade,
    ...loudnessOutlier,
    ...suspicious,
    ...errors,
  ]
  for (const r of failing) {
    const name = r.file.split('/').pop()
    console.log(`${r.verdict.padEnd(16)} ${name.padEnd(24)} ${r.reason ?? ''}`)
  }

  console.log()
  console.log('═'.repeat(70))
  console.log('Files to regenerate / re-trim:')
  for (const r of failing.filter((r) => r.verdict !== 'ERROR' && r.verdict !== 'TOO_SHORT')) {
    console.log(`  - ${r.file.split('/').pop()} (${r.verdict})`)
  }

  // Persist a JSON report so a rundot regen orchestrator can
  // consume the failing list directly.
  const report = {
    kitId: KIT_ID,
    audioDir: AUDIO_DIR,
    scannedAt: new Date().toISOString(),
    summary: {
      total: results.length,
      cutOff: cutOff.length,
      barViolation: barViolation.length,
      lengthMismatch: lengthMismatch.length,
      cycleDrift: cycleDrift.length,
      phraseLocked: phraseLocked.length,
      sustainGap: sustainGap.length,
      sustainClick: sustainClick.length,
      silentAttack: silentAttack.length,
      clipped: clipped.length,
      suspicious: suspicious.length,
      vocalHasBackground: vocalHasBackground.length,
      bar1NoAttack: bar1NoAttack.length,
      loopTailFade: loopTailFade.length,
      loudnessOutlier: loudnessOutlier.length,
      errors: errors.length,
    },
    failing: failing.map((r) => ({
      file: r.file.split('/').pop(),
      path: r.file,
      verdict: r.verdict,
      reason: r.reason ?? '',
      color: r.color ?? null,
      layerName: r.layerName ?? null,
      isOneShot: r.isOneShot ?? false,
      durationS: r.durationS ?? null,
      resolvedBars: r.resolvedBars ?? null,
    })),
  }
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
  console.log()
  console.log(`Report: ${REPORT_PATH}`)

  // Exit non-zero when any failures exist so CI / orchestrators can
  // gate on this script.
  if (failing.length > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
