#!/usr/bin/env node
/**
 * find-trim-no-dropout — like find-downbeat-trim.mjs but ALSO enforces
 * that no per-bar RMS in the chosen 8-bar slice is below the dropout
 * threshold. This is for files where the raw audio includes a fade-out
 * tail that would land on bar 8 with a "natural" downbeat trim.
 *
 * For phaseAlign=true (drums/bass/melody): requires loud-head + quiet-tail
 *   + small wrap + downbeat aligned + all 8 bars above SILENT_BAR_RMS.
 * For phaseAlign=false (vocals): just needs all 8 bars above
 *   SILENT_BAR_RMS, with a smooth (low-RMS) head onset.
 *
 * Outputs the chosen offset on stdout.
 *
 * Usage: node find-trim-no-dropout.mjs <raw.mp3> <barSec> <mode>
 *   mode = "downbeat" | "smooth"
 */
import { spawn } from 'node:child_process'

const SR = 44100
const FRAME_50MS = Math.round(0.05 * SR)
const FRAME_10MS = Math.round(0.01 * SR)

// Match audio-detect-cutoffs.mjs PHRASE_LOCKED logic:
// SILENT_BAR_RMS_THRESHOLD = 0.02; flagged when min < 0.02 and max > 0.10.
// We keep min > 0.04 to give 2x headroom against mp3 round-trip + volume=0.55.
// (After volume=0.55, 0.04 source RMS becomes 0.022 mono peak — barely above
//  the 0.02 floor, so we want even more margin → 0.04 minimum.)
const MIN_BAR_RMS = 0.04

function decode(file) {
  return new Promise((resolve, reject) => {
    const ps = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-i', file,
      '-ac', '2', '-ar', String(SR),
      '-f', 'f32le', '-'
    ])
    const chunks = []
    ps.stdout.on('data', c => chunks.push(c))
    ps.on('close', code => {
      if (code !== 0) reject(new Error(`ffmpeg exit ${code}`))
      else {
        const buf = Buffer.concat(chunks)
        resolve(new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4))
      }
    })
    ps.on('error', reject)
  })
}

function rmsMono(samples, startStereoIdx, lengthMonoSamples) {
  let sum = 0
  let n = 0
  for (let i = 0; i < lengthMonoSamples; i++) {
    const idx = startStereoIdx + i * 2
    if (idx + 1 >= samples.length) break
    const l = samples[idx]
    const r = samples[idx + 1]
    // Match validator's mono downmix (sum without /2, then post-volume=0.55 in pipeline).
    // For analysis use unscaled mono peak which is consistent with how validator decodes.
    sum += (l + r) * (l + r) * 0.25 + (l * l + r * r) * 0.25  // approx mid+side
    // Simpler and consistent with validator: average power
    n++
  }
  if (n === 0) return 0
  return Math.sqrt(sum / n)
}

function rmsBar(samples, startMonoSample, barSamples) {
  // Compute RMS over an entire bar slice (mono downmix L+R / 2).
  let sum = 0
  let n = 0
  for (let i = 0; i < barSamples; i++) {
    const idx = (startMonoSample + i) * 2
    if (idx + 1 >= samples.length) break
    const l = samples[idx] ?? 0
    const r = samples[idx + 1] ?? 0
    const m = (l + r) * 0.5
    sum += m * m
    n++
  }
  if (n === 0) return 0
  return Math.sqrt(sum / n)
}

async function main() {
  const [, , file, barSecArg, modeArg] = process.argv
  if (!file || !barSecArg || !modeArg) {
    console.error('Usage: node find-trim-no-dropout.mjs <raw.mp3> <barSec> <downbeat|smooth>')
    process.exit(1)
  }
  const trimSec = Number(barSecArg)  // total slice length (8 bars)
  const mode = modeArg
  const samples = await decode(file)
  const totalMono = Math.floor(samples.length / 2)
  const trimSamples = Math.round(trimSec * SR)
  const barSec1 = trimSec / 8
  const barSamples1 = Math.round(barSec1 * SR)

  if (totalMono < trimSamples + FRAME_50MS) {
    console.error(`raw too short: ${totalMono / SR}s < ${trimSec + 0.05}s`)
    process.exit(2)
  }

  // Build full 10ms RMS envelope for whole raw audio.
  const numFrames = Math.floor(totalMono / FRAME_10MS)
  const env = new Float32Array(numFrames)
  for (let f = 0; f < numFrames; f++) {
    env[f] = rmsMono(samples, f * FRAME_10MS * 2, FRAME_10MS)
  }

  // Find local maxima (potential downbeats) for downbeat mode.
  const peaks = []
  for (let f = 5; f < env.length - 5; f++) {
    let isPeak = true
    for (let d = -5; d <= 5; d++) {
      if (d === 0) continue
      if (env[f + d] > env[f]) { isPeak = false; break }
    }
    if (isPeak && env[f] > 0.01) peaks.push({ frame: f, rms: env[f] })
  }
  peaks.sort((a, b) => b.rms - a.rms)
  const topPeaks = peaks.slice(0, 80)

  // Also coarse-scan offsets at 100ms granularity.
  const SCAN_STEP_FRAMES = 10  // 100ms
  for (let f = 0; f < env.length - 5; f += SCAN_STEP_FRAMES) {
    topPeaks.push({ frame: f, rms: env[f] })
  }

  let best = null
  for (const peak of topPeaks) {
    // Try ±20ms around the peak at 5ms step.
    for (let deltaMs = -20; deltaMs <= 20; deltaMs += 5) {
      const startMonoSample = peak.frame * FRAME_10MS + Math.round(deltaMs * 0.001 * SR)
      if (startMonoSample < 0) continue
      if (startMonoSample + trimSamples + FRAME_50MS > totalMono) continue

      // Per-bar RMS over 8 bars of the slice.
      const barRms = new Array(8)
      for (let b = 0; b < 8; b++) {
        barRms[b] = rmsBar(samples, startMonoSample + b * barSamples1, barSamples1)
      }
      const minBar = Math.min(...barRms)
      if (minBar < MIN_BAR_RMS) {
        // Reject — has dropout bar.
        continue
      }

      // Head/tail RMS for CUT_OFF check (50ms).
      const headRms = rmsMono(samples, startMonoSample * 2, FRAME_50MS)
      const tailRms = rmsMono(samples, (startMonoSample + trimSamples - FRAME_50MS) * 2, FRAME_50MS)
      const lastIdx = (startMonoSample + trimSamples - 1) * 2
      const firstIdx = startMonoSample * 2
      const wrap = Math.abs(samples[lastIdx] - samples[firstIdx]) +
                   Math.abs(samples[lastIdx + 1] - samples[firstIdx + 1])

      const passesTail = tailRms < 0.02
      const passesWrap = wrap < 0.07

      // Find global peak frame across the slice.
      let globalPeak = 0
      let globalPeakFrame = 0
      const sliceFrames = Math.floor(trimSamples / FRAME_10MS)
      for (let f = 0; f < sliceFrames; f++) {
        const e = env[Math.floor((startMonoSample + f * FRAME_10MS) / FRAME_10MS)]
        if (e > globalPeak) { globalPeak = e; globalPeakFrame = f }
      }
      const peakTimeMs = globalPeakFrame * 10
      // Beat boundaries within the 8-bar slice (32 quarter-beats).
      const beatMs = (trimSec * 1000) / 32
      let nearestBeatDelta = Infinity
      for (let b = 0; b < 32; b++) {
        const d = Math.abs(b * beatMs - peakTimeMs)
        if (d < nearestBeatDelta) nearestBeatDelta = d
      }
      const passesGlobalPeak = nearestBeatDelta < 100

      let score = 0
      if (mode === 'downbeat') {
        if (!passesTail) score -= 1e9
        if (!passesWrap) score -= 1e9
        if (!passesGlobalPeak) score -= 1e9
        if (passesTail) score += 300
        if (passesWrap) score += 300
        if (passesGlobalPeak) score += 500
        score -= tailRms * 1000
        score -= wrap * 500
        score -= nearestBeatDelta * 2
        // Prefer more uniform bars.
        const maxBar = Math.max(...barRms)
        score -= (maxBar / Math.max(minBar, 1e-6)) * 50
        score += minBar * 100  // reward higher minimum bar energy
      } else {
        // smooth mode: reward low headRms (gentle onset) + non-silent bars.
        score = -headRms * 100 + minBar * 200
        if (!passesTail) score -= 100  // soft preference, not gating
      }

      if (!best || score > best.score) {
        best = {
          score, startMonoSample, startSec: startMonoSample / SR,
          headRms, tailRms, wrap, minBar, maxBar: Math.max(...barRms),
          nearestBeatDelta, barRms,
        }
      }
    }
  }

  if (!best) {
    console.error('no viable trim offset found (all candidates have a near-silent bar)')
    process.exit(3)
  }

  console.error(JSON.stringify({
    startSec: best.startSec,
    headRms: best.headRms,
    tailRms: best.tailRms,
    wrap: best.wrap,
    minBar: best.minBar,
    maxBar: best.maxBar,
    nearestBeatDelta: best.nearestBeatDelta,
    barRms: best.barRms.map(r => +r.toFixed(3)),
    score: best.score,
  }))
  console.log(best.startSec.toFixed(6))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
