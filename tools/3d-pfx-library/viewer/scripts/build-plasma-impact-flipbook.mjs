#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import { PNG } from 'pngjs'

const MODULE_ROOT = new URL('../../', import.meta.url)
const SOURCE_URL = new URL('assets/source/plasma-impact-flipbook-v1.png', MODULE_ROOT)
const RUNTIME_URL = new URL('assets/runtime/plasma-impact-flipbook-v1.png', MODULE_ROOT)
const PROVENANCE_URL = new URL('assets/plasma-impact-flipbook-v1.provenance.json', MODULE_ROOT)
const OUTPUT_URL = new URL('src/plasmaImpactFlipbook.ts', MODULE_ROOT)
const COLUMNS = 4
const ROWS = 4
const FRAME_COUNT = COLUMNS * ROWS

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function fail(message) {
  throw new Error(`[build-plasma-impact-flipbook] ${message}`)
}

function validateAtlas(image) {
  if (image.width !== 512 || image.height !== 512) {
    fail(`runtime atlas must be 512x512, got ${image.width}x${image.height}`)
  }
  const luminanceAt = (x, y) => {
    const offset = (y * image.width + x) * 4
    return image.data[offset] * 0.2126 + image.data[offset + 1] * 0.7152 + image.data[offset + 2] * 0.0722
  }
  const corners = [
    luminanceAt(0, 0),
    luminanceAt(image.width - 1, 0),
    luminanceAt(0, image.height - 1),
    luminanceAt(image.width - 1, image.height - 1),
  ]
  if (corners.some((value) => value > 2)) fail(`additive-black corner validation failed: ${corners.join(', ')}`)

  const frameWidth = image.width / COLUMNS
  const frameHeight = image.height / ROWS
  const coverage = []
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      let active = 0
      for (let y = row * frameHeight; y < (row + 1) * frameHeight; y += 1) {
        for (let x = column * frameWidth; x < (column + 1) * frameWidth; x += 1) {
          if (luminanceAt(x, y) > 10) active += 1
        }
      }
      coverage.push(active)
    }
  }
  if (coverage.some((active) => active < 3)) fail(`one or more flipbook frames are empty: ${coverage.join(', ')}`)
  return coverage
}

function main() {
  const source = fs.readFileSync(SOURCE_URL)
  const runtime = fs.readFileSync(RUNTIME_URL)
  const provenance = JSON.parse(fs.readFileSync(PROVENANCE_URL, 'utf8'))
  const sourceSha256 = sha256(source)
  const runtimeSha256 = sha256(runtime)
  if (sourceSha256 !== provenance.files?.source?.sha256) fail('source checksum disagrees with provenance')
  if (runtimeSha256 !== provenance.files?.runtime?.sha256) fail('runtime checksum disagrees with provenance')
  if (runtime.length !== provenance.files?.runtime?.bytes) fail('runtime byte count disagrees with provenance')
  if (runtime.length > provenance.validation?.maximumRuntimeBytes) fail(`runtime atlas exceeds its mobile budget: ${runtime.length} bytes`)
  const image = PNG.sync.read(runtime)
  const coverage = validateAtlas(image)
  const dataUri = `data:image/png;base64,${runtime.toString('base64')}`
  const output = `// Original generated plasma-impact flipbook. Do not hand-edit.
// Regenerate with tools/3d-pfx-library/viewer/scripts/build-plasma-impact-flipbook.mjs.

export const PFX_PLASMA_IMPACT_FLIPBOOK_ATLAS = {
  id: 'original-plasma-impact-16',
  dataUri: '${dataUri}',
  license: 'project-original',
  author: 'OpenAI image generation for game-bot',
  columns: ${COLUMNS},
  rows: ${ROWS},
  frameCount: ${FRAME_COUNT},
  width: ${image.width},
  height: ${image.height},
  runtimeBytes: ${runtime.length},
  sourceSha256: '${sourceSha256}',
  runtimeSha256: '${runtimeSha256}',
  provenancePath: 'tools/3d-pfx-library/assets/plasma-impact-flipbook-v1.provenance.json',
} as const
`
  fs.writeFileSync(OUTPUT_URL, output)
  console.log(`wrote ${OUTPUT_URL.pathname} (${runtime.length} atlas bytes, ${coverage.join(', ')} active pixels per cell)`)
}

main()
