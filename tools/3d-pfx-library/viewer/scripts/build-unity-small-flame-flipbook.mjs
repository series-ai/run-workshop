#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import { PNG } from 'pngjs'

const MODULE_ROOT = new URL('../../', import.meta.url)
const RUNTIME_URL = new URL('assets/runtime/unity-small-flame-64.png', MODULE_ROOT)
const PROVENANCE_URL = new URL('assets/unity-small-flame-64.provenance.json', MODULE_ROOT)
const OUTPUT_URL = new URL('src/flameFlipbook.ts', MODULE_ROOT)
const COLUMNS = 16
const ROWS = 4
const FRAME_COUNT = COLUMNS * ROWS

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function fail(message) {
  throw new Error(`[build-unity-small-flame-flipbook] ${message}`)
}

function validateAtlas(image) {
  if (image.width !== 1024 || image.height !== 512) {
    fail(`runtime atlas must be 1024x512, got ${image.width}x${image.height}`)
  }
  const alphaAt = (x, y) => image.data[(y * image.width + x) * 4 + 3]
  const corners = [
    alphaAt(0, 0),
    alphaAt(image.width - 1, 0),
    alphaAt(0, image.height - 1),
    alphaAt(image.width - 1, image.height - 1),
  ]
  if (corners.some((alpha) => alpha !== 0)) fail('transparent corners validation failed')

  const frameWidth = image.width / COLUMNS
  const frameHeight = image.height / ROWS
  const coverage = []
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      let active = 0
      for (let y = row * frameHeight; y < (row + 1) * frameHeight; y += 1) {
        for (let x = column * frameWidth; x < (column + 1) * frameWidth; x += 1) {
          if (alphaAt(x, y) > 12) active += 1
        }
      }
      coverage.push(active)
    }
  }
  if (coverage.some((active) => active < 180)) {
    fail(`one or more flipbook frames are empty: ${coverage.join(', ')}`)
  }
  return coverage
}

function main() {
  const runtime = fs.readFileSync(RUNTIME_URL)
  const provenance = JSON.parse(fs.readFileSync(PROVENANCE_URL, 'utf8'))
  const runtimeSha256 = sha256(runtime)
  if (runtimeSha256 !== provenance.files?.runtime?.sha256) {
    fail('runtime checksum disagrees with unity-small-flame-64.provenance.json')
  }
  if (runtime.length !== provenance.files?.runtime?.bytes) {
    fail('runtime byte count disagrees with unity-small-flame-64.provenance.json')
  }
  if (runtime.length > provenance.validation?.maximumRuntimeBytes) {
    fail(`runtime atlas exceeds its mobile budget: ${runtime.length} bytes`)
  }
  const image = PNG.sync.read(runtime)
  const coverage = validateAtlas(image)
  const dataUri = `data:image/png;base64,${runtime.toString('base64')}`
  const output = `// Unity Labs Paris SmallFlame01-mini flipbook (CC0-1.0). Do not hand-edit.
// Regenerate with tools/3d-pfx-library/viewer/scripts/build-unity-small-flame-flipbook.mjs.

export const PFX_FLAME_FLIPBOOK_ATLAS = {
  id: 'unity-small-flame-64',
  dataUri: '${dataUri}',
  sourceUrl: '${provenance.sourcePage}',
  license: '${provenance.license}',
  author: '${provenance.author}',
  columns: ${COLUMNS},
  rows: ${ROWS},
  frameCount: ${FRAME_COUNT},
  width: ${image.width},
  height: ${image.height},
  runtimeBytes: ${runtime.length},
  runtimeSha256: '${runtimeSha256}',
  provenancePath: 'tools/3d-pfx-library/assets/unity-small-flame-64.provenance.json',
} as const
`
  fs.writeFileSync(OUTPUT_URL, output)
  console.log(`wrote ${OUTPUT_URL.pathname} (${runtime.length} atlas bytes, ${Math.min(...coverage)} minimum active pixels per frame)`)
}

main()
