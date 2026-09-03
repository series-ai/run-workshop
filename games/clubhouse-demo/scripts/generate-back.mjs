#!/usr/bin/env node
// Generate a card back PNG via the rundot CLI and crop it to the library's
// standard back size (512x716, 5:7 poker ratio).
//
// Prerequisites: `rundot login` (once per machine) and ImageMagick on PATH.
//
// Usage:
//   npm run generate:back -- --name <kebab-id> --prompt "<prompt>" [--aspect-ratio 3:4]
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../src/assets/backs')

function arg(flag, dflt) {
  const i = process.argv.indexOf(flag)
  return i > -1 ? process.argv[i + 1] : dflt
}

const name = arg('--name')
const prompt = arg('--prompt')
const aspect = arg('--aspect-ratio', '3:4') // closest to 5:7; the crop normalizes

if (!name || !prompt) {
  console.error('usage: node scripts/generate-back.mjs --name <kebab-id> --prompt "<prompt>" [--aspect-ratio 3:4]')
  process.exit(1)
}
// Kebab-case only: scripts/asset-hygiene.sh blocks download-style basenames.
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
  console.error('--name must be kebab-case (lowercase letters, digits, hyphens)')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
const raw = resolve(outDir, `${name}.raw.png`)
const out = resolve(outDir, `${name}.png`)

// Generation uses the stored `rundot login` session — no API key in .env.
execFileSync(
  'rundot',
  ['generate', 'image', '--prompt', prompt, '--aspect-ratio', aspect, '--out', raw, '--json'],
  { stdio: 'inherit' },
)

// Fill-crop to the standard back size, then verify dimensions.
execFileSync(
  'magick',
  [raw, '-resize', '512x716^', '-gravity', 'center', '-extent', '512x716', '-strip', out],
  { stdio: 'inherit' },
)
rmSync(raw) // node:fs, not the `rm` binary — must work on Windows checkouts
console.log(execFileSync('identify', [out], { encoding: 'utf8' }))
console.log(`Wrote ${out} — restart the dev server and open the Backs tab.`)
