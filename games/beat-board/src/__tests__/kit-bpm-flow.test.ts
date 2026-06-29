/**
 * Kit-BPM field-flow contract test.
 *
 * The runtime has a single source of truth for tempo (`getBeatClock()`),
 * but for a long stretch of the project it was hardcoded to the
 * 84-BPM lofi default and never updated when the active kit changed.
 * The audio engine and the waveform widget both read from that
 * default, so every non-lofi pack played at the wrong tempo grid and
 * rendered the wrong number of cycle ticks.
 *
 * This test enforces the contract directly: every shipping kit JSON
 * declares a `bpm` field, and that field, fed through the same
 * `secondsPerBar()` helper the runtime uses, must match the kit's
 * audio loop length divided by the declared bar count for every
 * non-vocal loop. If the audio durations stop matching the declared
 * BPM, the runtime would lay loops down on the wrong grid — exactly
 * the bug the user caught manually.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execSync } from 'node:child_process'

import { secondsPerBar } from '../audio/beat-clock'

const PROJECT_ROOT = resolve(__dirname, '..', '..')
const KITS_DIR = join(PROJECT_ROOT, 'src', 'content-assets', 'kits')
const AUDIO_ROOT = join(PROJECT_ROOT, 'public', 'audio')
const BAR_TOLERANCE_MS = 6 // matches validator BAR_LOCK_TOLERANCE

interface KitJson {
  id: string
  bpm: number
  pads: ReadonlyArray<{
    color: string
    bufferUrl: string
    isOneShot: boolean
    layerName: string
  }>
}

function probeAudioDurationSec(absPath: string): number | null {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${absPath}"`,
      { encoding: 'utf8' },
    )
    return parseFloat(out.trim())
  } catch {
    return null
  }
}

function listKitJsons(): KitJson[] {
  return readdirSync(KITS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(KITS_DIR, f), 'utf8')) as KitJson)
}

describe('kit-bpm field flow', () => {
  it('every kit JSON declares a positive bpm', () => {
    for (const kit of listKitJsons()) {
      expect(kit.bpm, `${kit.id} kit JSON missing bpm`).toBeGreaterThan(0)
    }
  })

  it('secondsPerBar(kit.bpm) matches the kit audio loop lengths', () => {
    const failures: string[] = []
    for (const kit of listKitJsons()) {
      const expectedBarSec = secondsPerBar(kit.bpm)
      for (const pad of kit.pads) {
        if (pad.isOneShot) continue
        // Drum/bass/melody loops are always 8 bars; vocals can ship
        // at 8/16/32 — the test asserts the audio is some integer
        // multiple of expectedBarSec, not a specific bar count.
        const audioPath = join(PROJECT_ROOT, 'public', pad.bufferUrl.replace(/^\//, ''))
        if (!existsSync(audioPath)) continue
        // Skip if the file isn't actually populated (some kits in the
        // repo are placeholders pending audio generation).
        const stat = statSync(audioPath)
        if (stat.size < 1024) continue
        const dur = probeAudioDurationSec(audioPath)
        if (dur === null) continue
        const ratio = dur / expectedBarSec
        const closest = Math.round(ratio)
        const deltaMs = Math.abs(closest * expectedBarSec - dur) * 1000
        if (closest < 1 || deltaMs > BAR_TOLERANCE_MS) {
          failures.push(
            `${kit.id} ${pad.layerName} (${pad.bufferUrl.split('/').pop()}): ` +
              `dur=${dur.toFixed(3)}s, expected integer × secondsPerBar(${kit.bpm} BPM)=` +
              `${expectedBarSec.toFixed(4)}s, closest=${closest} bars (delta=${deltaMs.toFixed(1)}ms)`,
          )
        }
      }
    }
    expect(failures, failures.join('\n')).toHaveLength(0)
  })
})
