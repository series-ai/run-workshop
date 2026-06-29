#!/usr/bin/env node
/**
 * audio-phase-align — rotate a bar-locked loop file so its strongest
 * energy peak lands at sample 0 (the implicit downbeat). The file's
 * length stays exactly the same, the audio content is just cyclically
 * shifted; loop seamlessness is preserved because all our loops are
 * integer-bar lengths (rotating an integer-bar loop by N samples wraps
 * cleanly).
 *
 * Usage:
 *   node tools/audio-phase-align.mjs <file.mp3>           # in-place rotate
 *   node tools/audio-phase-align.mjs <file.mp3> -n        # dry-run, prints offset
 *
 * Strategy:
 *   1. Decode mp3 → mono float32 PCM via ffmpeg
 *   2. Compute 10 ms RMS envelope, find the strongest peak's offset
 *   3. Shift the audio so that offset becomes sample 0
 *   4. Re-encode to mp3 128 kbps stereo 44.1 kHz, atomically replace
 *
 * Only safe for percussive loops where "loudest hit = downbeat" is the
 * desired alignment. NOT safe for bass/melody loops where the strongest
 * onset might not be the downbeat. The wrapper script (`run.sh`) calls
 * this only on drums-A.
 */

import { spawn } from 'node:child_process'
import { readFileSync, renameSync, writeFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

const SAMPLE_RATE = 44100
const FRAME_MS = 10
const FRAME_SAMPLES = Math.round((FRAME_MS / 1000) * SAMPLE_RATE)

// ffmpeg is invoked by name so it resolves against the developer's PATH
// rather than a Homebrew-specific install location.
const FFMPEG = 'ffmpeg'

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const ps = spawn(cmd, args, opts)
    const stdoutChunks = []
    const stderrChunks = []
    if (ps.stdout) ps.stdout.on('data', (c) => stdoutChunks.push(c))
    if (ps.stderr) ps.stderr.on('data', (c) => stderrChunks.push(c))
    ps.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${cmd} ${args.join(' ')} exit ${code}: ${Buffer.concat(stderrChunks).toString()}`))
      } else {
        resolve({ stdout: Buffer.concat(stdoutChunks), stderr: Buffer.concat(stderrChunks).toString() })
      }
    })
    ps.on('error', reject)
  })
}

async function decodeStereoPcm(file) {
  // Get raw stereo PCM as f32le (interleaved L,R,L,R,...)
  const { stdout } = await run(FFMPEG, [
    '-hide_banner', '-loglevel', 'error',
    '-i', file,
    '-ac', '2',
    '-ar', String(SAMPLE_RATE),
    '-f', 'f32le',
    '-',
  ])
  const buf = stdout
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4)
}

function envelopeFromInterleavedStereo(samples) {
  const frames = Math.floor(samples.length / 2 / FRAME_SAMPLES)
  const env = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    let sum = 0
    const start = f * FRAME_SAMPLES * 2
    for (let i = 0; i < FRAME_SAMPLES; i++) {
      const l = samples[start + i * 2] ?? 0
      const r = samples[start + i * 2 + 1] ?? 0
      sum += (l * l + r * r) * 0.5
    }
    env[f] = Math.sqrt(sum / FRAME_SAMPLES)
  }
  return env
}

function findPeakSampleOffset(samples) {
  const env = envelopeFromInterleavedStereo(samples)
  let peakIdx = 0
  let peakVal = 0
  for (let f = 0; f < env.length; f++) {
    if (env[f] > peakVal) {
      peakVal = env[f]
      peakIdx = f
    }
  }
  return peakIdx * FRAME_SAMPLES
}

function rotateInterleavedStereo(samples, sampleOffset) {
  // sampleOffset is in mono samples; for interleaved stereo, multiply by 2.
  const stereoOffset = sampleOffset * 2
  const total = samples.length
  const rotated = new Float32Array(total)
  for (let i = 0; i < total; i++) {
    rotated[i] = samples[(i + stereoOffset) % total] ?? 0
  }
  return rotated
}

/**
 * Overlap-add seamless splice. Replaces the buffer's last N mono samples
 * with a linear blend of "original-tail" + "original-head", leaving the
 * original first N samples FULLY INTACT. When `loop=true` plays this
 * buffer:
 *
 *   - The audible content for the first (total - N) samples is unchanged.
 *   - The last N samples gradually blend toward the head — at sample
 *     (total - 1) the audio is ~99 % head[N-1].
 *   - The buffer wraps to sample 0 (= original head[0]).
 *   - head[N-1] → head[0] is a 1-sample jump WITHIN the original head,
 *     which is contiguous in the source audio — sounds continuous.
 *
 * Net effect: no click at the wrap (smoothing pulse instead) AND the
 * full-amplitude downbeat at sample 0 is preserved (peak detection in
 * the validator and engine still sees it correctly). 16 ms blend window
 * is short enough to be inaudible, long enough to mask the rotation
 * discontinuity.
 */
function applySeamlessSplice(samples, blendMs = 16) {
  const blendMonoSamples = Math.max(2, Math.round((blendMs / 1000) * SAMPLE_RATE))
  const total = samples.length
  // The buffer has 2× mono samples (interleaved stereo).
  if (total < blendMonoSamples * 6) return samples
  const out = new Float32Array(total)
  out.set(samples)
  for (let i = 0; i < blendMonoSamples; i++) {
    const t = i / blendMonoSamples
    const tailIdxL = total - blendMonoSamples * 2 + i * 2
    const tailIdxR = tailIdxL + 1
    const headIdxL = i * 2
    const headIdxR = headIdxL + 1
    out[tailIdxL] =
      (samples[tailIdxL] ?? 0) * (1 - t) + (samples[headIdxL] ?? 0) * t
    out[tailIdxR] =
      (samples[tailIdxR] ?? 0) * (1 - t) + (samples[headIdxR] ?? 0) * t
  }
  return out
}

async function encodeMp3(samples, outPath) {
  // Write interleaved f32le PCM to a temp file, then ffmpeg mp3-encode it.
  const tmpPcm = join(tmpdir(), `phase-align-${randomBytes(6).toString('hex')}.pcm`)
  // Float32Array → Buffer
  const u8 = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength)
  writeFileSync(tmpPcm, u8)
  await run(FFMPEG, [
    '-hide_banner', '-loglevel', 'error',
    '-y',
    '-f', 'f32le',
    '-ar', String(SAMPLE_RATE),
    '-ac', '2',
    '-i', tmpPcm,
    '-codec:a', 'libmp3lame',
    '-b:a', '128k',
    outPath,
  ])
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('-n')
  const noRotate = args.includes('--no-rotate')
  // Optional --blend-ms <N> override; defaults to 16 ms which is short
  // enough to be inaudible on most loops but long enough to mask the
  // rotation discontinuity. Bump to 32+ when a tight 16 ms blend isn't
  // catching the boundary click (e.g. a loud kick at sample 0).
  const blendArgIdx = args.indexOf('--blend-ms')
  const blendMs =
    blendArgIdx >= 0 && args[blendArgIdx + 1] ? Number(args[blendArgIdx + 1]) : 16
  const file = args.find((a) => !a.startsWith('-') && Number.isNaN(Number(a)))
  if (!file) {
    console.error('Usage: node tools/audio-phase-align.mjs <file.mp3> [-n] [--no-rotate] [--blend-ms <N>]')
    process.exit(1)
  }
  const samples = await decodeStereoPcm(file)
  const peakSample = findPeakSampleOffset(samples)
  const peakSec = peakSample / SAMPLE_RATE
  const totalSec = samples.length / 2 / SAMPLE_RATE
  console.log(
    `${file}: peak at ${peakSec.toFixed(4)}s (sample ${peakSample}) of ${totalSec.toFixed(4)}s` +
      ` (blend=${blendMs}ms${noRotate ? ', no-rotate' : ''})`,
  )
  if (peakSample === 0 || noRotate) {
    console.log('  applying boundary crossfade only')
    if (dryRun) return
    const faded = applySeamlessSplice(samples, blendMs)
    const tmpOut = `${file}.fading.mp3`
    await encodeMp3(faded, tmpOut)
    renameSync(tmpOut, file)
    const newSize = statSync(file).size
    console.log(`  re-faded; new file ${newSize} bytes`)
    return
  }
  if (dryRun) {
    console.log(`  [dry-run] would rotate by ${peakSec.toFixed(4)}s`)
    return
  }
  const rotated = rotateInterleavedStereo(samples, peakSample)
  // Re-apply the head + tail fade at the NEW boundary — without this the
  // rotated file has a hard discontinuity at the wrap point, audible as
  // a click on every loop iteration.
  const faded = applySeamlessSplice(rotated, blendMs)
  const tmpOut = `${file}.rotating.mp3`
  await encodeMp3(faded, tmpOut)
  // Atomic rename so a crash mid-encode doesn't leave a half-written file.
  renameSync(tmpOut, file)
  const newSize = statSync(file).size
  console.log(`  rotated + faded; new file ${newSize} bytes`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
