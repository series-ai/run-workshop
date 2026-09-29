import { readFile, writeFile, mkdir, rm, stat, readdir, copyFile } from 'node:fs/promises'
import { CATEGORY_TO_LEAF, FLAGSHIP_PREVIEWS as FLAGSHIP } from './pack-layout'
import { existsSync } from 'node:fs'
import { resolve, join, basename, relative, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import type { PackManifest, ModelEntry } from '../src/types'

// Category mapping from app catalog to jam-ready-assets top/dimension/theme buckets

const MIT_LICENSE_TEXT = `SPDX-License-Identifier: MIT
Source: original generated INKLINE assets authored for this project on 2026-09-24
Verified-by: Codex, 2026-09-24
Copyright (c) 2026 INKLINE contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`

function generateLeafReadme(leaf: string, manifest: PackManifest, effectCount: number): string {
  const models = manifest.models.filter(model => (model.kind === 'character' ? '3D/characters' : CATEGORY_TO_LEAF[model.category]) === leaf)
  const lines = [`# INKLINE ${leaf}`, '', 'Original assets for RUN. Keep License.txt with redistributed files.', '']
  if (leaf === '2D/misc') lines.push(`${effectCount} transparent sprite sheets. Each sheet has eight 384×384 frames in a 4×2 layout.`, 'Read atlas.json for file paths and timing. Read effects.json for the procedural recipes.')
  else lines.push(`${models.length} GLB models. Units are meters. Coordinates are +Y up and +Z forward.`, 'Models use unlit materials. Dimensions and tags are in 3D/characters/Source/manifest.json.', '', ...models.map(model => `- ${model.id}: ${model.label}`))
  if (leaf === '3D/characters') lines.push('', `Each character has ${manifest.animations.length} clips and an 18-bone rig. Source contains editable Blender files, generators, runtime code, and reuse instructions.`)
  if (leaf === '3D/city') lines.push('', 'Source contains the prop library and three editable scenes. Samples contains Industrial District, Service Yard, and Roof Works as GLBs. Source/environment-layouts.json lists their GLB, placement, and Blender paths. Origins vary by use. Read Source/prop-contract.md before placing parts.')
  return lines.join('\n') + '\n'
}

async function sha256File(path: string): Promise<string> {
  const content = await readFile(path)
  return createHash('sha256').update(content).digest('hex')
}

async function walkDir(dir: string, base: string = dir): Promise<Array<{ abs: string; rel: string }>> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: Array<{ abs: string; rel: string }> = []
  for (const entry of entries) {
    if (entry.name === '.DS_Store' || entry.name.endsWith('.blend1')) continue
    const absPath = join(dir, entry.name)
    const relPath = relative(base, absPath)
    if (entry.isDirectory()) {
      files.push(...(await walkDir(absPath, base)))
    } else {
      files.push({ abs: absPath, rel: relPath })
    }
  }
  return files
}

async function exportPack() {
  const projectRoot = resolve(process.cwd())
  const appRoot = projectRoot.endsWith('inkline-showcase') ? projectRoot : resolve(projectRoot, 'games/inkline-showcase')
  const defaultOut = resolve(appRoot, 'dist-pack/run-inkline')
  const targetOut = defaultOut
  const allowMissing = false

  console.log('--- INKLINE Asset Pack Exporter ---')
  console.log(`Target pack path: ${targetOut}`)
  execFileSync('python3', [resolve(appRoot, 'scripts/write-content-doc.py')], { cwd: appRoot, stdio: 'inherit' })

  // Strict path guard: must be inside app workspace and end with dist-pack/run-inkline or /run-inkline
  if (targetOut !== resolve(appRoot, 'dist-pack/run-inkline')) {
    throw new Error(`Strict path guard triggered: refusing to mutate path outside self-owned dist-pack/run-inkline: ${targetOut}`)
  }

  // Read master manifest and effects
  const manifestPath = resolve(appRoot, 'public/assets/manifest.json')
  const effectsJsonPath = resolve(appRoot, 'public/assets/effects.json')
  const atlasJsonPath = resolve(appRoot, 'public/assets/effects/atlas.json')
  const districtJsonPath = resolve(appRoot, 'public/assets/industrial-district.json')
  const charactersJsonPath = resolve(appRoot, 'public/assets/characters.json')
  const propsJsonPath = resolve(appRoot, 'public/assets/props.json')
  const samplePosePath = resolve(appRoot, 'public/assets/sample-pose-metrics.json')

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PackManifest
  const effectsCatalog = JSON.parse(await readFile(effectsJsonPath, 'utf8'))

  // Verify all expected previews and sprite sheets
  const missingPreviews: string[] = []
  const missingSprites: string[] = []

  // Check character and prop previews
  for (const model of manifest.models) {
    const previewFile = resolve(appRoot, 'public', model.thumbnail)
    if (!existsSync(previewFile)) {
      missingPreviews.push(model.thumbnail)
    }
  }

  // Check animation previews
  for (const anim of manifest.animations) {
    const animPreview = resolve(appRoot, 'public/assets/previews', `animation-${anim.id}.png`)
    if (!existsSync(animPreview)) {
      missingPreviews.push(`assets/previews/animation-${anim.id}.png`)
    }
  }

  // Check all transparent effect sheets and previews.
  for (const effect of effectsCatalog.effects) {
    const sheetFile = resolve(appRoot, 'public/assets/effects', `${effect.id}.png`)
    if (!existsSync(sheetFile)) {
      missingSprites.push(`assets/effects/${effect.id}.png`)
    }
    const effectPreview = resolve(appRoot, 'public/assets/previews', `effect-${effect.id}.png`)
    if (!existsSync(effectPreview)) {
      missingPreviews.push(`assets/previews/effect-${effect.id}.png`)
    }
  }

  if (missingSprites.length || missingPreviews.length) {
    throw new Error(`Export requires all previews and sprites: ${missingPreviews.length} previews and ${missingSprites.length} sprites missing.`)
  }

  const required = ['public/assets/source/characters.blend', 'public/assets/source/industrial.blend', 'public/assets/source/industrial-district.blend', 'public/assets/scenes/industrial-district.glb', 'scripts/blender/characters.py', 'scripts/blender/props.py', 'scripts/blender/level.py', 'src/types.ts', ...['assets', 'effects', 'district', 'physics', 'presentation', 'roles', 'camera', 'layouts', 'kinetics', 'trails', 'cutaway', 'index'].map(name => `src/runtime/${name}.ts`)]
  for (const id of ['service-yard', 'roof-works']) required.push(`public/assets/${id}.json`, `public/assets/scenes/${id}.glb`, `public/assets/source/${id}.blend`)
  required.push('public/assets/environment-layouts.json', 'src/runtime/firearms.json')
  for (const path of required) if (!(await stat(resolve(appRoot, path))).size) throw new Error(`Required source is empty: ${path}`)
  await writeFile(resolve(appRoot, 'public/assets/License.txt'), MIT_LICENSE_TEXT)

  // Clear target pack directory safely
  if (existsSync(targetOut)) {
    console.log(`Clearing existing directory: ${targetOut}`)
    await rm(targetOut, { recursive: true, force: true })
  }
  await mkdir(targetOut, { recursive: true })

  // Define top buckets and leaves
  const leaves = [
    '3D/characters',
    '3D/city',
    '3D/weapons',
    '3D/platformer',
    '3D/sports',
    '3D/space-scifi',
    '2D/misc',
  ]

  for (const leaf of leaves) {
    const leafDir = resolve(targetOut, leaf)
    await mkdir(leafDir, { recursive: true })
    await mkdir(resolve(leafDir, 'previews'), { recursive: true })
    // Each leaf gets License.txt and Readme.md
    await writeFile(resolve(leafDir, 'License.txt'), MIT_LICENSE_TEXT)
    await writeFile(resolve(leafDir, 'Readme.md'), generateLeafReadme(leaf, manifest, effectsCatalog.effects.length))
  }

  // Copy 3D Models and Previews
  const exportedManifestModels: ModelEntry[] = []

  for (const model of manifest.models) {
    const leaf = CATEGORY_TO_LEAF[model.category] ?? (model.kind === 'character' ? '3D/characters' : '3D/city')
    const destDir = resolve(targetOut, leaf)
    const srcGlb = resolve(appRoot, 'public', model.file)
    const destGlb = resolve(destDir, `${model.id}.glb`)

    if (existsSync(srcGlb)) {
      await copyFile(srcGlb, destGlb)
    } else {
      console.error(`Missing model GLB: ${srcGlb}`)
      process.exit(1)
    }

    const srcThumb = resolve(appRoot, 'public', model.thumbnail)
    const destThumb = resolve(destDir, 'previews', `${model.id}.png`)
    if (existsSync(srcThumb)) {
      await copyFile(srcThumb, destThumb)
    }

    // Exported manifest model entry with path relative to PACK ROOT
    exportedManifestModels.push({
      ...model,
      file: `${leaf}/${model.id}.glb`,
      thumbnail: `${leaf}/previews/${model.id}.png`,
    })
  }

  // Copy Animation Previews to 3D/characters/previews
  const charPreviewsDir = resolve(targetOut, '3D/characters/previews')
  for (const anim of manifest.animations) {
    const srcAnim = resolve(appRoot, 'public/assets/previews', `animation-${anim.id}.png`)
    if (existsSync(srcAnim)) {
      await copyFile(srcAnim, resolve(charPreviewsDir, `animation-${anim.id}.png`))
    }
  }

  // Flagship preview for each leaf root
  const flagshipPreviews = FLAGSHIP
  for (const [leaf, file] of Object.entries(flagshipPreviews)) {
    const src = resolve(appRoot, 'public/assets/previews', file)
    if (existsSync(src)) {
      await copyFile(src, resolve(targetOut, leaf, 'preview.png'))
    }
  }

  // Assemble 2D/misc assets
  const miscDir = resolve(targetOut, '2D/misc')
  for (const effect of effectsCatalog.effects) {
    const srcSheet = resolve(appRoot, 'public/assets/effects', `${effect.id}.png`)
    if (existsSync(srcSheet)) {
      await copyFile(srcSheet, resolve(miscDir, `${effect.id}.png`))
    }
    const srcPrev = resolve(appRoot, 'public/assets/previews', `effect-${effect.id}.png`)
    if (existsSync(srcPrev)) {
      await copyFile(srcPrev, resolve(miscDir, 'previews', `effect-${effect.id}.png`))
    }
  }
  const flagshipEffect = resolve(appRoot, 'public/assets/previews', 'effect-punch-impact.png')
  if (existsSync(flagshipEffect)) {
    await copyFile(flagshipEffect, resolve(miscDir, 'preview.png'))
  }
  if (existsSync(atlasJsonPath)) {
    const atlas = JSON.parse(await readFile(atlasJsonPath, 'utf8')) as { version: number; effects: { file: string }[] }
    atlas.effects.forEach(effect => { effect.file = basename(effect.file) })
    await writeFile(resolve(miscDir, 'atlas.json'), JSON.stringify(atlas, null, 2) + '\n')
  }
  if (existsSync(effectsJsonPath)) {
    await copyFile(effectsJsonPath, resolve(miscDir, 'effects.json'))
  }

  // Setup 3D/characters/Source (Capital 'S')
  const charSourceDir = resolve(targetOut, '3D/characters/Source')
  await mkdir(charSourceDir, { recursive: true })
  await mkdir(resolve(charSourceDir, 'runtime'), { recursive: true })

  // Copy Blender source (no .blend1 backup)
  const charBlend = resolve(appRoot, 'public/assets/source/characters.blend')
  if (existsSync(charBlend)) {
    await copyFile(charBlend, resolve(charSourceDir, 'characters.blend'))
  }
  const charGen = resolve(appRoot, 'scripts/blender/characters.py')
  if (existsSync(charGen)) {
    await copyFile(charGen, resolve(charSourceDir, 'characters.py'))
  }

  // Consumer manifest common with paths relative to PACK ROOT
  const exportedManifest: PackManifest = {
    version: manifest.version ?? '1.0.0',
    models: exportedManifestModels,
    animations: manifest.animations,
  }
  await writeFile(resolve(charSourceDir, 'manifest.json'), JSON.stringify(exportedManifest, null, 2) + '\n')

  if (existsSync(charactersJsonPath)) {
    await writeFile(resolve(charSourceDir, 'characters.json'), JSON.stringify({ models: exportedManifestModels.filter(model => model.kind === 'character'), animations: manifest.animations }, null, 2) + '\n')
  }
  if (existsSync(samplePosePath)) {
    await copyFile(samplePosePath, resolve(charSourceDir, 'sample-pose-metrics.json'))
  }

  await copyFile(resolve(appRoot, 'public/assets/character-roles.json'), resolve(charSourceDir, 'character-roles.json'))

  // Complete Character and Pack Documentation
  await writeFile(
    resolve(charSourceDir, 'README.md'),
    `# INKLINE Complete Pack Documentation & Source

This directory contains the master consumer manifest, editable Blender sources, generator scripts, and runtime TypeScript sources for INKLINE.

## Directory Structure
- \`manifest.json\`: Master consumer manifest containing ${manifest.models.length} models and ${manifest.animations.length} stick figure animations with paths relative to the PACK ROOT.
- \`characters.blend\`: Authored Blender source file containing the 18-bone rig and 12 base stick figures.
- \`characters.py\`: Headless Blender script to procedurally regenerate all 12 skinned character GLBs with ${manifest.animations.length} embedded animation clips.
- \`types.ts\`: Common TypeScript interfaces (\`PackManifest\`, \`ModelEntry\`, \`AvatarConfig\`, \`StageSettings\`).
- \`runtime/\`: Modular runtime libraries matching the showcase source structure:
  - \`assets.ts\`: \`AssetLibrary\` loader supporting local base URLs or remote mirrors.
  - \`firearms.json\`: Shared firearm sizes, grip targets, and support timing. Enable \`resolveJsonModule\` in the consumer TypeScript configuration.
  - \`effects.ts\`: \`InkEffects\` particle manager with ${effectsCatalog.effects.length} procedural presets.
  - \`district.ts\`: Assembly for Industrial District, Service Yard, and Roof Works.
  - \`layouts.ts\`: Placement, actor, and effect data for the two extra scenes.
  - \`camera.ts\`: Visible-mesh camera clearance and scene framing.
  - \`kinetics.ts\`: Bounded impact profiles, reaction curves, and one-edge input buffer.
  - \`trails.ts\`: Fixed-pool weapon and limb ribbons.
  - \`physics.ts\`: Axis-aligned collision proxy resolution and kinematic controller.
  - \`index.ts\`: Barrel export for runtime modules.
`
  )

  // Copy runtime TypeScript sources matching src structure so relative imports (e.g. ../types) resolve
  const srcTypes = resolve(appRoot, 'src/types.ts')
  if (existsSync(srcTypes)) {
    await copyFile(srcTypes, resolve(charSourceDir, 'types.ts'))
  }
  const runtimeFiles = ['effects.ts', 'assets.ts', 'firearms.json', 'physics.ts', 'district.ts', 'presentation.ts', 'roles.ts', 'camera.ts', 'layouts.ts', 'kinetics.ts', 'trails.ts', 'cutaway.ts', 'index.ts']
  for (const file of runtimeFiles) {
    const srcFile = resolve(appRoot, 'src/runtime', file)
    if (existsSync(srcFile)) {
      await copyFile(srcFile, resolve(charSourceDir, 'runtime', file))
    }
  }

  // Setup 3D/city/Source
  const citySourceDir = resolve(targetOut, '3D/city/Source')
  await mkdir(citySourceDir, { recursive: true })
  const indBlend = resolve(appRoot, 'public/assets/source/industrial.blend')
  if (existsSync(indBlend)) {
    await copyFile(indBlend, resolve(citySourceDir, 'industrial.blend'))
  }
  const indGen = resolve(appRoot, 'scripts/blender/props.py')
  if (existsSync(indGen)) {
    await copyFile(indGen, resolve(citySourceDir, 'props.py'))
  }
  if (existsSync(districtJsonPath)) {
    await copyFile(districtJsonPath, resolve(citySourceDir, 'industrial-district.json'))
  }
  if (existsSync(effectsJsonPath)) {
    await copyFile(effectsJsonPath, resolve(citySourceDir, 'effects.json'))
  }
  if (existsSync(propsJsonPath)) {
    await writeFile(resolve(citySourceDir, 'props.json'), JSON.stringify({ models: exportedManifestModels.filter(model => model.kind === 'prop') }, null, 2) + '\n')
  }

  await copyFile(resolve(appRoot, 'public/assets/source/industrial-district.blend'), resolve(citySourceDir, 'industrial-district.blend'))
  await copyFile(resolve(appRoot, 'scripts/blender/level.py'), resolve(citySourceDir, 'level.py'))
  const samples = resolve(targetOut, '3D/city/Samples')
  await mkdir(samples, { recursive: true })
  await copyFile(resolve(appRoot, 'public/assets/scenes/industrial-district.glb'), resolve(samples, 'industrial-district.glb'))
  for (const id of ['service-yard', 'roof-works']) {
    await copyFile(resolve(appRoot, `public/assets/${id}.json`), resolve(citySourceDir, `${id}.json`))
    await copyFile(resolve(appRoot, `public/assets/source/${id}.blend`), resolve(citySourceDir, `${id}.blend`))
    await copyFile(resolve(appRoot, `public/assets/scenes/${id}.glb`), resolve(samples, `${id}.glb`))
  }
  const sceneCatalog = JSON.parse(await readFile(resolve(appRoot, 'public/assets/environment-layouts.json'), 'utf8')) as { version: string; layouts: { id: string; file: string; layout: string; source: string }[] }
  for (const scene of sceneCatalog.layouts) { scene.file = `3D/city/Samples/${basename(scene.file)}`; scene.layout = `3D/city/Source/${basename(scene.layout)}`; scene.source = `3D/city/Source/${basename(scene.source)}` }
  await writeFile(resolve(citySourceDir, 'environment-layouts.json'), JSON.stringify(sceneCatalog, null, 2) + '\n')
  await mkdir(resolve(charSourceDir, 'docs'), { recursive: true })
  for (const name of ['reuse.md', 'art-direction.md', 'pack-content.md', 'performance.md', 'character-contract.md', 'prop-contract.md', 'level-contract.md', 'animation-expansion.md', 'effects-expansion.md', 'environment-expansion.md', 'environment-layouts.md', 'kinetic-animation.md', 'kinetic-runtime.md', 'style-correction.md', 'effects-motion-polish.md', 'combat-stance.md', 'foot-contact.md', 'block-stance.md', 'gun-height.md', 'joint-shape.md']) {
    await copyFile(resolve(appRoot, 'docs', name), resolve(charSourceDir, 'docs', name))
  }
  await copyFile(resolve(appRoot, 'docs/prop-contract.md'), resolve(citySourceDir, 'prop-contract.md'))
  await copyFile(resolve(appRoot, 'docs/level-contract.md'), resolve(citySourceDir, 'level-contract.md'))

  await mkdir(resolve(charSourceDir, 'docs/reference'), { recursive: true })
  await copyFile(resolve(appRoot, 'docs/reference/study-03.png'), resolve(charSourceDir, 'docs/reference/study-03.png'))
  await copyFile(resolve(appRoot, 'docs/reference/study-04-characters.png'), resolve(charSourceDir, 'docs/reference/study-04-characters.png'))
  await copyFile(resolve(appRoot, 'docs/reference/study-04-prompt.txt'), resolve(charSourceDir, 'docs/reference/study-04-prompt.txt'))
  for (const name of ['body-family.png', 'character-family.png']) await copyFile(resolve(appRoot, 'docs/reference', name), resolve(charSourceDir, 'docs/reference', name))
  await copyFile(resolve(appRoot, 'docs/flash-reference-study.md'), resolve(charSourceDir, 'docs/flash-reference-study.md'))

  for (const name of ['kinetic-study-stickfight.md', 'kinetic-study-stickfigurez.md']) await copyFile(resolve(appRoot, 'docs/reference', name), resolve(charSourceDir, 'docs/reference', name))

  const evidenceDir = resolve(charSourceDir, 'docs/verification')
  await mkdir(evidenceDir, { recursive: true })
  for (const name of ['README.md', 'asset-report.json', 'motion-bounds.json', 'browser-tests.json', 'district-report.json', 'effect-frame-bounds.json', 'evidence-files.md']) {
    await copyFile(resolve(appRoot, 'docs/verification', name), resolve(evidenceDir, name))
  }
  await mkdir(resolve(evidenceDir, 'expansion'), { recursive: true })
  for (const name of ['runtime.json', 'report.json', 'game-performance.json', 'level-support.json', 'animation-compatibility.json', 'independent-review.json', 'contact-poses.json', 'contact-timing.md', 'animation-expansion-contact-overview.png', 'animation-expansion-side-contact-overview.png', 'effects-64.png', ...Array.from({ length: 6 }, (_, index) => `animation-expansion-${String(index + 1).padStart(2, '0')}.png`)]) await copyFile(resolve(appRoot, 'docs/verification/expansion', name), resolve(evidenceDir, 'expansion', name))
  await mkdir(resolve(evidenceDir, 'kinetic'), { recursive: true })
  for (const name of ['runtime.json', 'contact-poses.json', 'grounded-export.json', 'camera-motion.json', 'camera-performance.json', 'avatar-framing.json', 'cpu-stress.json', 'independent-review.json', 'final-review.md']) await copyFile(resolve(appRoot, 'docs/verification/kinetic', name), resolve(evidenceDir, 'kinetic', name))
  for (const name of ['consumer.json', 'weapon-alignment-review.md', 'camera-performance-before.json']) {
    const path = resolve(appRoot, 'docs/verification/kinetic', name)
    if (existsSync(path)) await copyFile(path, resolve(evidenceDir, 'kinetic', name))
  }
  // Keep report images and their metadata together. Video footage is excluded.
  for (const directory of ['kinetic/animation-review', 'kinetic/art-review', 'kinetic/screenshots', 'kinetic/avatar-framing', 'expansion/screenshots', 'art-pass', 'correction', 'polish', 'stance', 'feet', 'block', 'gun-height', 'joints']) {
    for (const file of await walkDir(resolve(appRoot, 'docs/verification', directory))) {
      if (!/\.(png|jpe?g|jsonl?|md)$/i.test(file.rel)) continue
      if (['line-delivery.json', 'polish-delivery.json', 'stance-delivery.json', 'foot-delivery.json', 'block-delivery.json', 'gun-height-delivery.json', 'joint-delivery.json'].includes(file.rel) || /^(frames|effects-before|effects-after)\//.test(file.rel)) continue
      const destination = resolve(evidenceDir, directory, file.rel)
      await mkdir(dirname(destination), { recursive: true })
      await copyFile(file.abs, destination)
    }
  }
  const benchmarkPath = resolve(appRoot, 'docs/verification/browser-benchmark.json')
  if (existsSync(benchmarkPath)) {
    const benchmark = JSON.parse(await readFile(benchmarkPath, 'utf8')) as { runs?: unknown[]; pageErrors?: string[] }
    if (benchmark.runs?.length === 3 && benchmark.pageErrors?.length === 0) {
      await copyFile(benchmarkPath, resolve(evidenceDir, 'browser-benchmark.json'))
    }
  }

  // Compute inventory checksums of all exported files (relative to PACK ROOT)
  console.log('Generating inventory checksums...')
  const exportedFiles = await walkDir(targetOut)
  const checksums: Record<string, { bytes: number; sha256: string }> = {}

  let totalBytes = 0
  for (const file of exportedFiles) {
    // Avoid circularity when writing inventory-checksums.json
    if (file.rel === '3D/characters/Source/inventory-checksums.json') continue
    const fileStat = await stat(file.abs)
    const hash = await sha256File(file.abs)
    checksums[file.rel] = {
      bytes: fileStat.size,
      sha256: hash,
    }
    totalBytes += fileStat.size
  }

  const checksumsPayload = {
    pack: 'run-inkline',
    generatedAt: new Date().toISOString(),
    totalFiles: Object.keys(checksums).length,
    totalBytes,
    files: checksums,
  }

  const checksumsFile = resolve(charSourceDir, 'inventory-checksums.json')
  await writeFile(checksumsFile, JSON.stringify(checksumsPayload, null, 2) + '\n')

  // Write verification report to docs/verification/export-report.json
  const reportDir = resolve(appRoot, 'docs/verification')
  await mkdir(reportDir, { recursive: true })

  const leafBreakdown: Record<string, number> = {}
  for (const leaf of leaves) {
    const leafFiles = (await walkDir(resolve(targetOut, leaf))).length
    leafBreakdown[leaf] = leafFiles
  }

  const packFolderName = basename(targetOut) // 'run-inkline'

  const exportReport = {
    exportedAt: new Date().toISOString(),
    packRoot: packFolderName,
    targetDirectory: targetOut,
    totalFiles: exportedFiles.length + 1, // including inventory-checksums.json
    totalUncompressedBytes: totalBytes,
    leafBreakdown,
    missingPreviewsCount: missingPreviews.length,
    missingSpritesCount: missingSprites.length,
    isDryRun: allowMissing,
    verified: missingPreviews.length === 0 && missingSprites.length === 0,
  }

  await writeFile(resolve(reportDir, 'export-report.json'), JSON.stringify(exportReport, null, 2) + '\n')
  console.log(`Export report written to: docs/verification/export-report.json`)
  console.log('Export completed successfully.')
}

// Write only the fixed staging directory and archive owned by this exporter.
if (process.argv.length > 2) throw new Error('This exporter does not accept output path or dry-run arguments.')
exportPack().catch(error => { console.error(error); process.exitCode = 1 })
