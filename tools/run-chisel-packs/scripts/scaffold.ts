/**
 * Workshop scaffolding CLI for authoring new RUN Chisel assets.
 *
 * Prints exact triangle budgets, UV palette region rules, rig contracts,
 * Blender builder boilerplate, and showcase/test registration steps.
 * Writes ready-to-edit Python scaffold files under `out/scaffolds/<id>.py`
 * unless `--stdout` is passed.
 *
 * Usage:
 *   npm run scaffold -- --list
 *   npm run scaffold -- --kind prop --pack medieval --id prop_anvil [--label "Blacksmith Anvil"]
 *   npm run scaffold -- --kind held --pack cyberpunk --id held_katana --hand hand_r
 *   npm run scaffold -- --kind part --pack medieval --slot headwear --id headwear_wizard_hat
 *   npm run scaffold -- --kind creature --rig quadruped --id body_panther [--label "Shadow Panther"]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BUDGETS } from '../contracts/budgets'
import { AVATAR_SLOTS, type AvatarSlot } from '../contracts/catalog'
import { COLOR_DIRECTION } from '../contracts/colorDirection'
import { POLY_PACK_KEYS, POLY_PACKS, type PolyPackKey } from '../contracts/packs'
import { PALETTE_REGIONS } from '../contracts/palette'
import { RIG_IDS, RIG_SPECS, type RigId } from '../contracts/rig'
import { HUMAN_SCALE } from '../contracts/worldScale'
import { TOOL_ROOT } from '../src/paths'

type ScaffoldKind = 'part' | 'held' | 'prop' | 'creature'

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function titleCase(id: string): string {
  return id
    .replace(/^(prop|held|hair|headwear|torso|legs|back|body|head)_/, '')
    .split('_')
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')
}

function printTables(): void {
  console.log('=== RUN Chisel Asset Budgets (S23 Ultra 120 Hz Law) ===')
  console.log(`Composed Avatar Max Triangles : ${BUDGETS.mobilePolicy.maxTrianglesPerComposedAvatar}`)
  console.log(`Composed Avatar Max Draw Calls: ${BUDGETS.mobilePolicy.maxDrawCallsPerAvatar}`)
  for (const [cls, b] of Object.entries(BUDGETS.classes)) {
    console.log(`  - ${cls.padEnd(10)} maxTriangles=${String(b.maxTriangles).padStart(4)}  maxMaterials=${b.maxMaterials}`)
  }
  console.log('\n=== Packs ===')
  for (const k of POLY_PACK_KEYS) {
    const p = POLY_PACKS[k]
    console.log(`  - ${k.padEnd(10)} dir=${p.dir}  license=${p.license}  worldTheme=${p.worldTheme ?? '(none)'}`)
  }
  console.log('\n=== Rigs ===')
  for (const r of RIG_IDS) {
    const spec = RIG_SPECS[r]
    console.log(`  - ${r.padEnd(10)} ${spec.label}  clips=${spec.clips.length}  groundBones=[${spec.groundBones.join(', ')}]`)
  }
  const { uvMin, uvMax } = COLOR_DIRECTION.shade
  console.log(`\n=== 7 Semantic UV Palette Regions (V in [${uvMin}, ${uvMax}]) ===\n  ${PALETTE_REGIONS.join(', ')}`)
}

function registration(kind: ScaffoldKind, pack: PolyPackKey, slot: AvatarSlot, rig: RigId): string {
  if (kind === 'prop') return `Add the builder and label to the static registry in blender/props_level_${pack}.py.`
  if (kind === 'creature') return `Add the builder to the ${rig} body list in blender/build_monsters.py and add a preset there.`
  if (pack === 'core') {
    if (slot === 'body' || slot === 'head') return `Add the ${slot} shape to blender/polykit.py. See blender/build_core.py for the export and morph targets.`
    return 'Register the part in blender/build_core.py.'
  }
  if (pack === 'monsters') return `Register the ${kind} in blender/build_monsters.py.`
  return `Add the ${kind} to the ${pack} entry of PACK_TABLE in blender/build_packs.py.`
}

const partStarters: Record<AvatarSlot, string> = {
  body: `def {id}(part, body):
    rings = [pk.torso_ring(body, station) for station in ('hips', 'waist', 'chest')]
    part.loft(rings, 'skin', cap_start=True, cap_end=True)`,
  torso: `def {id}(part, body):
    rings = [pk.torso_ring(body, station, 0.02) for station in ('hips', 'waist', 'chest')]
    part.loft(rings, 'primary', cap_start=True, cap_end=True)`,
  legs: `def {id}(part, body):
    with part.mirrored():
        rings = [pk.leg_ring(body, station, 0.02) for station in (1, 2, 3)]
        part.loft(rings, 'primary', cap_start=True, cap_end=True)`,
  back: `def {id}(part, body):
    anchor = pk.torso_point(body, 1.38, 0, 0, 'back')
    part.box(anchor - pk.V(0, 0, 0.07), (0.26, 0.34, 0.13), 'primary', bevel=0.02)`,
  head: `def {id}(part, spec):
    part.skin = pk.SKIN_HEAD
    rings = [pk.head_ring(spec.shape, pk.HEAD_Y[station]) for station in ('jaw', 'cheek', 'brow')]
    part.loft(rings, 'skin', cap_start=True, cap_end=True)`,
  hair: `def {id}(part, shape):
    part.skin = pk.SKIN_HEAD
    brow = pk.HEAD_Y['brow']
    pk.head_shell(part, 'hair', 0.014, front=brow, temple=brow - 0.02,
                  side=brow - 0.07, back=brow - 0.13, shape=shape)`,
  headwear: `def {id}(part, shape):
    part.skin = pk.SKIN_HEAD
    brow = pk.HEAD_Y['brow']
    pk.head_shell(part, 'primary', 0.025, front=brow, temple=brow - 0.02,
                  side=brow - 0.06, back=brow - 0.10, shape=shape)`,
}

function generatePython(opts: {
  kind: ScaffoldKind
  pack: PolyPackKey
  id: string
  label: string
  slot: AvatarSlot
  hand: 'hand_r' | 'hand_l'
  rig: RigId
}): string {
  const { kind, pack, id, label, slot, hand, rig } = opts
  const budget = BUDGETS.classes[kind === 'part' ? slot : kind === 'creature' ? 'body' : kind]
  const header = [
    `# ${id} (${JSON.stringify(label)}) in ${POLY_PACKS[pack].dir}`,
    `# Use at most ${budget.maxTriangles} triangles and ${budget.maxMaterials} material.`,
    `# ${registration(kind, pack, slot, rig)}`,
    '# Adapt the shape and check fit before you register the asset.',
  ].join('\n')

  if (kind === 'prop') {
    return `${header}
# Use metres, +Y up and +Z forward in the mesh builder.


def ${id}(part):
    part.box((0, 0.24, 0), (0.72, 0.48, 0.52), 'primary', bevel=0.03)
    part.box((0, 0.49, 0), (0.75, 0.04, 0.55), 'secondary')
`
  }

  if (kind === 'held') {
    return `${header}
# Use socket ${hand}. Keep the palm at the origin and check animated clearance.


def ${id}(part):
    part.box((0, 0.015, 0), (0.045, 0.09, 0.045), 'secondary', bevel=0.005)
    part.box((0, 0.015, 0.06), (0.035, 0.07, 0.08), 'accent', bevel=0.004)
`
  }

  if (kind === 'part') {
    return `${header}
import polykit as pk


${partStarters[slot].replace('{id}', id)}
`
  }

  const joint = RIG_SPECS[rig].joints[1]
  return `${header}
# Use the ${rig} rig. Add geometry and weights for each joint that the body uses.
import polykit as pk


def build_${id}_mesh(solver):
    part = pk.Part('${id}')
    with part.skinned(pk.rigid(**{'${joint}': 1.0})):
        part.box(solver.rig.position['${joint}'], (0.28, 0.30, 0.36), 'primary', bevel=0.02)
    return part.to_mesh(solver)
`
}

function main(): void {
  if (process.argv.includes('--list')) {
    printTables()
    return
  }

  const kind = (arg('--kind') ?? 'prop') as ScaffoldKind
  if (!['part', 'held', 'prop', 'creature'].includes(kind)) {
    throw new Error(`--kind must be one of part|held|prop|creature (got "${kind}")`)
  }
  const pack = (arg('--pack') ?? (kind === 'creature' ? 'monsters' : 'medieval')) as PolyPackKey
  if (!POLY_PACK_KEYS.includes(pack)) {
    throw new Error(`--pack must be one of ${POLY_PACK_KEYS.join('|')}`)
  }
  const id = arg('--id')
  if (!id || !/^[a-z_][a-z0-9_]*$/.test(id)) {
    throw new Error('--id is required and must match /^[a-z_][a-z0-9_]*$/ (e.g. prop_anvil)')
  }
  const slot = (arg('--slot') ?? 'torso') as AvatarSlot
  if (kind === 'part' && !AVATAR_SLOTS.includes(slot)) {
    throw new Error(`--slot must be one of ${AVATAR_SLOTS.join('|')}`)
  }
  const hand = (arg('--hand') ?? 'hand_r') as 'hand_r' | 'hand_l'
  if (hand !== 'hand_r' && hand !== 'hand_l') {
    throw new Error('--hand must be hand_r or hand_l')
  }
  const rig = (arg('--rig') ?? (kind === 'creature' ? 'quadruped' : 'ual1')) as RigId
  if (!RIG_IDS.includes(rig)) {
    throw new Error(`--rig must be one of ${RIG_IDS.join('|')}`)
  }

  if (kind === 'prop' && !POLY_PACKS[pack].hasWorldLeaf) {
    throw new Error(`${pack} has no world prop leaf. Select a context pack.`)
  }
  if (kind === 'creature' && pack !== 'monsters') {
    throw new Error('Register creature bodies in the monsters pack.')
  }

  const label = arg('--label') ?? titleCase(id)
  const code = generatePython({ kind, pack, id, label, slot, hand, rig })

  const stdout = process.argv.includes('--stdout')
  const print = stdout ? console.error : console.log
  if (stdout) {
    process.stdout.write(code)
  } else {
    const outDir = join(TOOL_ROOT, 'out/scaffolds')
    mkdirSync(outDir, { recursive: true })
    const outFile = join(outDir, `${id}.py`)
    writeFileSync(outFile, code)
    console.log(`Wrote scaffold: ${outFile}`)
  }

  if (pack !== 'core') {
    const { brief } = COLOR_DIRECTION.packs[pack]
    print(`\n=== ${POLY_PACKS[pack].label} color direction ===`)
    print(brief.relationship)
    print(`Field — ${brief.field}`)
    print(`Support — ${brief.support}`)
    print(`Focus — ${brief.focus}`)
    print(`Review — ${brief.review}`)
  }

  print('\n=== Checklist ===')
  print(`1. ${registration(kind, pack, slot, rig)}`)
  print('2. Run: npm run build && npm run validate && npm run catalog')
  print(`3. Render thumbnails: (cd ../../games/run-chisel-showcase && npm run thumbnails -- --pack ${pack} --force)`)
  print(`4. Visually inspect: npm run snapshot -- --out out/review/${id}.png --views ${id}`)
  print(`5. Check fit beside the ${HUMAN_SCALE.referenceHeightM.toFixed(2)} m adult: npm run lineup -- --out out/review/${id}_lineup.png ${id}`)
}

main()
