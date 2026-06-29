#!/usr/bin/env node
/**
 * find-downbeat-trim — given a raw audio file and a target bar length,
 * find the offset where extracting a `barSec` slice yields:
 *   1. HIGH head RMS (loud downbeat at sample 0)            — fixes CYCLE_DRIFT
 *   2. LOW  tail RMS (quiet decay at the end)               — avoids CUT_OFF
 *   3. SMALL wrap discontinuity |last - first|              — avoids CUT_OFF
 *
 * Outputs the chosen offset in seconds on stdout.
 *
 * Usage: node find-downbeat-trim.mjs <raw.mp3> <barSec>
 */
import { spawn } from 'node:child_process'

const SR = 44100
const FRAME_50MS = Math.round(0.05 * SR)

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
    sum += (l * l + r * r) * 0.5
    n++
  }
  return n === 0 ? 0 : Math.sqrt(sum / n)
}

async function main() {
  const [, , file, barSecArg] = process.argv
  if (!file || !barSecArg) {
    console.error('Usage: node find-downbeat-trim.mjs <raw.mp3> <barSec>')
    process.exit(1)
  }
  const barSec = Number(barSecArg)
  const samples = await decode(file)
  const totalMono = Math.floor(samples.length / 2)
  const barSamples = Math.round(barSec * SR)

  // Need at least barSamples + tail50 + head50 worth of input
  if (totalMono < barSamples + FRAME_50MS) {
    console.error(`raw too short: ${totalMono / SR}s < ${barSec + 0.05}s`)
    process.exit(2)
  }

  // Coarse-to-fine peak search: find downbeat candidate offsets.
  // Use 10ms RMS envelope to find local peaks.
  const FRAME_10MS = Math.round(0.01 * SR)
  const numFrames = Math.floor(totalMono / FRAME_10MS)
  const env = new Float32Array(numFrames)
  for (let f = 0; f < numFrames; f++) {
    env[f] = rmsMono(samples, f * FRAME_10MS * 2, FRAME_10MS)
  }

  // Active-region detection — the music generator tail-pads every generation
  // with 2-4 seconds of silence (a fade to nothing). The picker below
  // minimizes tailRms, so without this guard it actively *prefers*
  // slices whose tail extends into that silence — which is exactly how
  // a sustained bass loop ends up with a 1-2 s dropout near the end.
  // Compute the last frame whose 10 ms RMS is at least 50 % of the
  // overall median, and reject any candidate slice whose end lands
  // beyond that frame. 30 % was too lenient (sporadic noise spikes
  // inside the silent tail still cleared the threshold); 50 % cleanly
  // separates the music tail from the encoder fade.
  const ACTIVE_RATIO = 0.50
  const sortedEnv = [...env].sort((a, b) => a - b)
  const medRms = sortedEnv[Math.floor(sortedEnv.length / 2)]
  const activeThreshold = medRms * ACTIVE_RATIO
  let lastActiveFrame = 0
  for (let f = numFrames - 1; f >= 0; f--) {
    if (env[f] >= activeThreshold) {
      lastActiveFrame = f
      break
    }
  }
  // Fall back to the full buffer if the source has no clear silent
  // tail (lastActiveFrame within 200 ms of the end means there's no
  // silence we'd be chasing).
  const activeEndMonoSample =
    numFrames - lastActiveFrame > 20
      ? lastActiveFrame * FRAME_10MS
      : totalMono

  // Find local maxima in the envelope (potential downbeats / strong attacks)
  // A frame is a peak if it's >= neighbors within 5 frames either side
  const peaks = []
  for (let f = 5; f < env.length - 5; f++) {
    let isPeak = true
    for (let d = -5; d <= 5; d++) {
      if (d === 0) continue
      if (env[f + d] > env[f]) {
        isPeak = false
        break
      }
    }
    if (isPeak && env[f] > 0.01) {
      peaks.push({ frame: f, rms: env[f] })
    }
  }

  // Sort by descending strength, keep top 60 (more candidates from longer raws)
  peaks.sort((a, b) => b.rms - a.rms)
  const topPeaks = peaks.slice(0, 60)

  // Also add ALL frames as candidates at coarse 50ms granularity. This
  // catches offsets where the strongest peak isn't a local maximum but
  // the slice still satisfies the validator (e.g., quiet slow buildups
  // that only peak briefly mid-bar near beat 2/3/4).
  const SCAN_STEP_MS = 50
  const SCAN_STEP_FRAMES = SCAN_STEP_MS / 10
  for (let f = 0; f < env.length - 5; f += SCAN_STEP_FRAMES) {
    topPeaks.push({ frame: f, rms: env[f] })
  }

  // For each candidate offset, score the slice quality
  let best = null
  for (const peak of topPeaks) {
    // Try a small range around the peak (±20ms) at 1ms steps to land right on attack
    for (let deltaMs = -20; deltaMs <= 20; deltaMs += 1) {
      const startMonoSample = peak.frame * FRAME_10MS + Math.round(deltaMs * 0.001 * SR)
      if (startMonoSample < 0) continue
      if (startMonoSample + barSamples + FRAME_50MS > totalMono) continue
      // Reject slices that extend past the source's active region — the
      // tail-padded silence the generator adds is what the SUSTAIN_GAP
      // detector picks up at audition time.
      if (startMonoSample + barSamples > activeEndMonoSample) continue

      // Head RMS (first 50ms)
      const headRms = rmsMono(samples, startMonoSample * 2, FRAME_50MS)
      // Tail RMS (last 50ms of the bar)
      const tailRms = rmsMono(
        samples,
        (startMonoSample + barSamples - FRAME_50MS) * 2,
        FRAME_50MS,
      )
      // Wrap discontinuity: amplitude diff between last sample and first sample
      const lastIdx = (startMonoSample + barSamples - 1) * 2
      const firstIdx = startMonoSample * 2
      const wrap =
        Math.abs(samples[lastIdx] - samples[firstIdx]) +
        Math.abs(samples[lastIdx + 1] - samples[firstIdx + 1])

      // Validator thresholds:
      //   CUT_OFF      = tailRms > 0.05 AND wrap > 0.15
      //   SUSPICIOUS   = tailRms > 0.02 AND wrap > 0.07
      // To stay OK we need BOTH to fall below the SUSPICIOUS threshold:
      //   tailRms < 0.02 OR wrap < 0.07 (the AND gates one or the other).
      // Be conservative: require tailRms < 0.02 AND wrap < 0.07.
      const passesTail = tailRms < 0.02
      const passesWrap = wrap < 0.07
      // CYCLE_DRIFT requires the GLOBAL peak (loudest 10ms frame) to fall
      // within 100ms of a beat boundary. Easiest way to satisfy: ensure the
      // first 10ms IS the global peak of the slice.
      // Compute global peak frame across the whole bar slice.
      const sliceFrames = Math.floor(barSamples / FRAME_10MS)
      let globalPeak = 0
      let globalPeakFrame = 0
      for (let f = 0; f < sliceFrames; f++) {
        const start = startMonoSample + f * FRAME_10MS
        // Use mono envelope (downmix L+R) to match validator's logic.
        let sum = 0
        for (let i = 0; i < FRAME_10MS; i++) {
          const idx = (start + i) * 2
          const l = samples[idx] ?? 0
          const r = samples[idx + 1] ?? 0
          const m = (l + r) * 0.5
          sum += m * m
        }
        const rms = Math.sqrt(sum / FRAME_10MS)
        if (rms > globalPeak) {
          globalPeak = rms
          globalPeakFrame = f
        }
      }
      // CYCLE_DRIFT requires the GLOBAL peak time to be within 100ms of ANY
      // quarter-note beat boundary (0, 1/4, 2/4, 3/4 of the bar).
      // Quarter-beat at frame index = (sliceFrames / 4) * k for k in 0..3.
      const peakTimeMs = globalPeakFrame * 10
      const beatTimes = [
        0,
        (barSec * 1000) / 4,
        (barSec * 1000) / 2,
        (3 * barSec * 1000) / 4,
      ]
      let nearestBeatDelta = Infinity
      for (const b of beatTimes) {
        const d = Math.abs(peakTimeMs - b)
        if (d < nearestBeatDelta) nearestBeatDelta = d
      }
      // Tighter than validator (100ms) for safety against mp3 round-trip:
      // require peak within 60ms of a beat boundary.
      const passesGlobalPeak = nearestBeatDelta < 60

      // Dominance heuristic: prefer slices where the global peak is well
      // separated from neighboring peaks. Used in scoring only; not gating.
      let secondaryPeak = 0
      const minDist = Math.max(10, Math.floor((barSec * 100) / 8)) // 1/8th-bar buffer
      for (let f = 0; f < sliceFrames; f++) {
        if (Math.abs(f - globalPeakFrame) < minDist) continue
        const start = startMonoSample + f * FRAME_10MS
        let sum = 0
        for (let i = 0; i < FRAME_10MS; i++) {
          const idx = (start + i) * 2
          const l = samples[idx] ?? 0
          const r = samples[idx + 1] ?? 0
          const m = (l + r) * 0.5
          sum += m * m
        }
        const r = Math.sqrt(sum / FRAME_10MS)
        if (r > secondaryPeak) secondaryPeak = r
      }
      const headPeakDominance = globalPeak / Math.max(secondaryPeak, 0.001)
      // Robust against mp3 round-trip: when dominance is low (<1.10), the
      // global peak can flip to a different position after re-encode. We
      // also require that ALL "near-peak" frames (>= 80% of globalPeak)
      // land within 100ms of a beat boundary.
      const beatTimes2 = [
        0,
        (barSec * 1000) / 4,
        (barSec * 1000) / 2,
        (3 * barSec * 1000) / 4,
        barSec * 1000, // wrap-around (= 0 logically)
      ]
      let allNearPeaksAlign = true
      for (let f = 0; f < sliceFrames; f++) {
        const start = startMonoSample + f * FRAME_10MS
        let sum = 0
        for (let i = 0; i < FRAME_10MS; i++) {
          const idx = (start + i) * 2
          const l = samples[idx] ?? 0
          const r = samples[idx + 1] ?? 0
          const m = (l + r) * 0.5
          sum += m * m
        }
        const r = Math.sqrt(sum / FRAME_10MS)
        if (r < globalPeak * 0.8) continue
        const tMs = f * 10
        let minD = Infinity
        for (const b of beatTimes2) {
          const d = Math.abs(tMs - b)
          if (d < minD) minD = d
        }
        if (minD > 80) {
          allNearPeaksAlign = false
          break
        }
      }
      const passesDominance = headPeakDominance > 1.10 || allNearPeaksAlign
      // Head check is now informational only — validator doesn't measure it
      // for non-vocal files. Keep for scoring (prefer slight downbeat).
      const passesHead = headRms >= 0 // always true

      // Score: hard rejection for slices that fail validator gates.
      // Without this, an outlier like dominance=473 (one tiny peak in a
      // sea of low energy) can outscore a clean slice.
      let score = 0
      if (!passesGlobalPeak) score -= 1e9    // CYCLE_DRIFT hard fail
      if (!passesTail) score -= 1e9          // CUT_OFF hard fail
      if (!passesWrap) score -= 1e9          // CUT_OFF hard fail
      if (!passesDominance) score -= 1e6     // mp3-round-trip risk
      if (passesGlobalPeak) score += 500
      if (passesTail) score += 300
      if (passesWrap) score += 300
      if (passesDominance) score += 100
      score -= tailRms * 1000
      score -= wrap * 500
      score -= nearestBeatDelta * 2
      // Cap dominance contribution to avoid extreme outliers dominating.
      score += Math.min(headPeakDominance, 5) * 30

      if (!best || score > best.score) {
        best = {
          score,
          startMonoSample,
          startSec: startMonoSample / SR,
          headRms,
          tailRms,
          wrap,
          globalPeakFrame,
          headPeakDominance,
          peakRank: topPeaks.indexOf(peak),
          nearestBeatDelta,
          allPass:
            passesTail && passesWrap && passesGlobalPeak,
        }
      }
    }
  }

  if (!best) {
    console.error('no viable trim offset found')
    process.exit(3)
  }

  // Emit chosen offset in seconds + diagnostic JSON to stderr
  console.error(JSON.stringify({
    startSec: best.startSec,
    headRms: best.headRms,
    tailRms: best.tailRms,
    wrap: best.wrap,
    globalPeakFrame: best.globalPeakFrame,
    nearestBeatDelta: best.nearestBeatDelta,
    headPeakDominance: best.headPeakDominance,
    peakRank: best.peakRank,
    allPass: best.allPass,
    score: best.score,
  }))
  console.log(best.startSec.toFixed(6))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
