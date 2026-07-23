#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import { PNG } from 'pngjs'

const MODULE_ROOT = new URL('../../', import.meta.url)
const SOURCE_URL = new URL('assets/source/muzzle-flash-atlas-v1-chroma.png', MODULE_ROOT)
const RUNTIME_URL = new URL('assets/runtime/muzzle-flash-atlas-v1.png', MODULE_ROOT)
const PROVENANCE_URL = new URL('assets/muzzle-flash-atlas-v1.provenance.json', MODULE_ROOT)
const OUTPUT_URL = new URL('src/muzzleFlashSprites.ts', MODULE_ROOT)
const COLS = 4
const ROWS = 2
const REFRESH_RUNTIME = process.argv.includes('--refresh-runtime')

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function fail(message) {
  throw new Error(`[build-muzzle-flash-atlas] ${message}`)
}

function validateAtlas(image) {
  if (image.width !== 1024 || image.height !== 512) {
    fail(`runtime atlas must be 1024x512, got ${image.width}x${image.height}`)
  }
  const alphaAt = (x, y) => image.data[(y * image.width + x) * 4 + 3]
  const corners = [alphaAt(0, 0), alphaAt(image.width - 1, 0), alphaAt(0, image.height - 1), alphaAt(image.width - 1, image.height - 1)]
  if (corners.some((alpha) => alpha !== 0)) fail('transparent corners validation failed')

  const coverage = []
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      let active = 0
      for (let y = row * image.height / ROWS; y < (row + 1) * image.height / ROWS; y += 1) {
        for (let x = col * image.width / COLS; x < (col + 1) * image.width / COLS; x += 1) {
          if (alphaAt(x, y) > 12) active += 1
        }
      }
      coverage.push(active)
    }
  }
  if (coverage.some((active) => active < 5_000)) fail(`non-empty cells validation failed: ${coverage.join(', ')}`)
  return coverage
}

function despillTransparentFringe(image) {
  let changedPixels = 0
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const alpha = image.data[offset + 3]
    if (alpha === 0) continue
    const red = image.data[offset]
    const green = image.data[offset + 1]
    const blue = image.data[offset + 2]
    const nonGreenMaximum = Math.max(red, blue)
    if (green <= nonGreenMaximum) continue
    // The authored brief explicitly excludes green from every sprite. Chroma
    // removal left green RGB under low alpha; bilinear filtering then exposed
    // it as an olive card around otherwise transparent flame texels.
    image.data[offset + 1] = nonGreenMaximum
    changedPixels += 1
  }
  return changedPixels
}

function validateTransparentFringe(image) {
  let translucentPixels = 0
  let greenDominantPixels = 0
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const alpha = image.data[offset + 3]
    if (alpha === 0 || alpha > 64) continue
    translucentPixels += 1
    if (image.data[offset + 1] > Math.max(image.data[offset], image.data[offset + 2]) + 8) {
      greenDominantPixels += 1
    }
  }
  if (translucentPixels < 1_000) fail(`transparent fringe validation had only ${translucentPixels} samples`)
  const ratio = greenDominantPixels / translucentPixels
  if (ratio > 0.005) fail(`green chroma fringe validation failed: ${(ratio * 100).toFixed(2)}%`)
  return { translucentPixels, greenDominantPixels, maximumGreenDominantRatio: 0.005 }
}

function buildSlices() {
  const slices = {}
  for (let index = 0; index < COLS * ROWS; index += 1) {
    const col = index % COLS
    const row = Math.floor(index / COLS)
    const role = row === 0 ? 'directional' : 'radial'
    slices[`${role}-${col + 1}`] = {
      u: col / COLS,
      v: 1 - (row + 1) / ROWS,
      w: 1 / COLS,
      h: 1 / ROWS,
      role,
      sourceCell: index + 1,
    }
  }
  return slices
}

function main() {
  const source = fs.readFileSync(SOURCE_URL)
  const runtime = fs.readFileSync(RUNTIME_URL)
  const provenance = JSON.parse(fs.readFileSync(PROVENANCE_URL, 'utf8'))
  const sourceSha256 = sha256(source)
  if (sourceSha256 !== provenance.files?.source?.sha256) fail('source checksum disagrees with muzzle-flash-atlas-v1.provenance.json')
  const runtimeImage = PNG.sync.read(runtime)
  const changedPixels = despillTransparentFringe(runtimeImage)
  if (changedPixels > 0 && !REFRESH_RUNTIME) {
    fail(`runtime atlas has ${changedPixels} green-spill pixels; rerun with --refresh-runtime`)
  }
  const normalizedRuntime = changedPixels > 0 ? PNG.sync.write(runtimeImage) : runtime
  const runtimeSha256 = sha256(normalizedRuntime)
  if (REFRESH_RUNTIME && changedPixels > 0) {
    fs.writeFileSync(RUNTIME_URL, normalizedRuntime)
    provenance.files.runtime.sha256 = runtimeSha256
    provenance.validation.transparentFringe = validateTransparentFringe(runtimeImage)
    const processingStep = 'clamp residual green RGB to max(red, blue) for alpha-filter-safe chroma despill'
    if (!provenance.processing.includes(processingStep)) provenance.processing.push(processingStep)
    fs.writeFileSync(PROVENANCE_URL, `${JSON.stringify(provenance, null, 2)}\n`)
  }
  if (runtimeSha256 !== provenance.files?.runtime?.sha256) fail('runtime checksum disagrees with muzzle-flash-atlas-v1.provenance.json')
  const coverage = validateAtlas(runtimeImage)
  validateTransparentFringe(runtimeImage)
  if (JSON.stringify(coverage) !== JSON.stringify(provenance.validation?.nonEmptyPixelsPerCell)) {
    fail('runtime non-empty cell coverage disagrees with provenance')
  }
  const slices = buildSlices()
  const dataUri = `data:image/png;base64,${normalizedRuntime.toString('base64')}`
  const output = `// Original generated muzzle-flash atlas. Do not hand-edit.\n// Regenerate with tools/3d-pfx-library/viewer/scripts/build-muzzle-flash-atlas.mjs.\n\nexport interface PfxMuzzleFlashAtlasSlice {\n  u: number\n  v: number\n  w: number\n  h: number\n  role: 'directional' | 'radial'\n  sourceCell: number\n}\n\nexport const PFX_MUZZLE_FLASH_ATLAS = {\n  dataUri: '${dataUri}',\n  sourceSha256: '${sourceSha256}',\n  runtimeSha256: '${runtimeSha256}',\n  provenancePath: 'tools/3d-pfx-library/assets/muzzle-flash-atlas-v1.provenance.json',\n  slices: ${JSON.stringify(slices, null, 2)},\n} as const\n\nexport type PfxMuzzleFlashAtlasSliceName = keyof typeof PFX_MUZZLE_FLASH_ATLAS.slices\n`
  fs.writeFileSync(OUTPUT_URL, output)
  console.log(`wrote ${OUTPUT_URL.pathname} (${normalizedRuntime.length} atlas bytes, ${coverage.join(', ')} active pixels per cell)`)
}

main()
