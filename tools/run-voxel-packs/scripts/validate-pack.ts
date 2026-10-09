/**
 * Validates staged packs against the contract.
 *
 * Usage:
 *   npm run validate -- --pack fantasy [--level asset|slice|release] [--stage <dir>]
 *   npm run validate -- --all --level release
 *   npm run validate -- --pack monster --only haunted-manor   # one asset: its issues and art-direction measures
 *
 * Exits non-zero and names the asset and rule for every violation.
 */
import { RVX_PACK_KEYS, type RvxPackKey } from '../contracts/packs'
import { STAGE_DIR } from '../src/paths'
import { checkLevel, collectInventory, LEVELS, type Level } from '../src/validate/pack'

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (index !== -1 && (!value || value.startsWith('--'))) throw new Error(`--${name} needs a value`)
  return value
}

function parsePacks(): RvxPackKey[] {
  if (process.argv.includes('--all')) return [...RVX_PACK_KEYS]
  const pack = arg('pack')
  if (!pack) throw new Error('pass --pack <key> or --all')
  if (!(RVX_PACK_KEYS as readonly string[]).includes(pack)) throw new Error(`unknown pack "${pack}" (${RVX_PACK_KEYS.join(', ')})`)
  return [pack as RvxPackKey]
}

async function main(): Promise<void> {
  const level = (arg('level') ?? 'asset') as Level
  if (!LEVELS.includes(level)) throw new Error(`unknown level "${level}" (${LEVELS.join(', ')})`)
  const stage = arg('stage') ?? STAGE_DIR
  let failed = 0
  for (const pack of parsePacks()) {
    const inventory = await collectInventory(stage, pack)
    const only = arg('only')
    if (only) {
      // One asset while authoring: its asset-level issues and its measures.
      const glbs = inventory.glbs.filter((glb) => glb.id.includes(only))
      if (glbs.length === 0) throw new Error(`no ${pack} asset id contains "${only}"`)
      for (const glb of glbs) {
        const s = glb.surface
        console.log(`${glb.id} [${glb.scaleClass ?? 'no class'}] ${s ? `tris ${s.triangles}, diagonal ${(s.diagonalShare * 100).toFixed(0)}%, ${s.unitsPerTexel.toFixed(2)} u/texel, dark ${(s.darkShare * 100).toFixed(0)}%, saturation ${s.meanSaturation.toFixed(2)}` : 'no painted texture'}: ${glb.violations.length === 0 ? 'PASS' : ''}`)
        for (const v of glb.violations) console.log(`  [${v.rule}] ${v.message}`)
        failed += glb.violations.length
      }
      continue
    }
    const issues = checkLevel(inventory, level)
    console.log(`${pack}: ${inventory.glbs.length} GLBs, level ${level}: ${issues.length === 0 ? 'PASS' : `${issues.length} issue(s)`}`)
    for (const issue of issues) console.log(`  [${issue.rule}] ${issue.message}`)
    failed += issues.length
  }
  if (failed > 0) process.exit(1)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
