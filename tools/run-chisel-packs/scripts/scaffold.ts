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
import { POLY_PACK_KEYS, POLY_PACKS, type PolyPackKey } from '../contracts/packs'
import { PALETTE_REGIONS } from '../contracts/palette'
import { RIG_IDS, RIG_SPECS, type RigId } from '../contracts/rig'
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
  console.log(`\n=== 7 Semantic UV Palette Regions (V in [0.15, 0.85]) ===\n  ${PALETTE_REGIONS.join(', ')}`)
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
  if (opts.kind === 'prop') {
    const b = BUDGETS.classes.prop
    return `"""
RUN Chisel Prop Scaffold: ${opts.id} (${opts.label})
Pack: ${opts.pack} (${POLY_PACKS[opts.pack].dir})
Budget: <= ${b.maxTriangles} tris, ${b.maxMaterials} material (Poly_Atlas_Mat), grounded at y = 0 (Z-up in Blender -> Y-up in glTF).
Paste into tools/run-chisel-packs/blender/build_packs.py and register in CATALOG_ENTRIES.
"""
import mathutils
import polykit


def build_${opts.id}() -> "bpy.types.Object":
    mb = polykit.MeshBuilder('${opts.id}')
    # Base plinth / primary silhouette (keep faces beveled/faceted, hard split normals)
    mb.add_tapered_prism(
        center=(0.0, 0.0, 0.25),
        rx0=0.35, ry0=0.25,
        rx1=0.28, ry1=0.20,
        height=0.50,
        sides=8,
        region='secondary',
    )
    # Accent/metal detail
    mb.add_tapered_prism(
        center=(0.0, 0.0, 0.56),
        rx0=0.24, ry0=0.16,
        rx1=0.20, ry1=0.14,
        height=0.12,
        sides=6,
        region='metal',
    )
    obj = mb.build_object(name='${opts.id}', uv_ao=True)
    # Ground lowest Z vertex to 0.0 in Blender (becomes Y=0 in glTF)
    polykit.ground_object_to_z0(obj)
    return obj
`
  }

  if (opts.kind === 'held') {
    const b = BUDGETS.classes.held
    return `"""
RUN Chisel Held Item Scaffold: ${opts.id} (${opts.label})
Pack: ${opts.pack} (${POLY_PACKS[opts.pack].dir}) | Socket: ${opts.hand}
Budget: <= ${b.maxTriangles} tris, ${b.maxMaterials} material (Poly_Atlas_Mat).
Local grip origin (0, 0, 0) sits in the palm; +Z extends along tool/blade axis toward tip.
Paste into tools/run-chisel-packs/blender/build_packs.py.
"""
import polykit


def build_${opts.id}() -> "bpy.types.Object":
    mb = polykit.MeshBuilder('${opts.id}')
    # Grip handle centered near local origin (hand_r/hand_l palm socket)
    mb.add_tapered_prism(
        center=(0.0, 0.0, 0.0),
        rx0=0.024, ry0=0.024,
        rx1=0.026, ry1=0.026,
        height=0.24,
        sides=6,
        region='secondary',
    )
    # Guard / collar at +Z = 0.14
    mb.add_tapered_prism(
        center=(0.0, 0.0, 0.14),
        rx0=0.075, ry0=0.030,
        rx1=0.065, ry1=0.025,
        height=0.04,
        sides=6,
        region='accent',
    )
    # Blade / head extending +Z = 0.16 .. 0.72
    mb.add_tapered_prism(
        center=(0.0, 0.0, 0.44),
        rx0=0.040, ry0=0.014,
        rx1=0.008, ry1=0.005,
        height=0.56,
        sides=4,
        region='metal',
    )
    return mb.build_object(name='${opts.id}', uv_ao=True)
`
  }

  if (opts.kind === 'part') {
    const b = BUDGETS.classes[opts.slot]
    return `"""
RUN Chisel Modular Avatar Part Scaffold: ${opts.id} (${opts.label})
Pack: ${opts.pack} (${POLY_PACKS[opts.pack].dir}) | Slot: ${opts.slot} | Rig: ${opts.rig}
Budget: <= ${b.maxTriangles} tris, maxWeightError <= ${b.maxWeightError ?? 0.001} (sum=1.0, max 4 bones/vertex).
Must stay watertight/layered over base body_athletic (clearance >= 0.008m outside body shell).
"""
import polykit


def build_${opts.id}(armature_obj, core_body_obj) -> "bpy.types.Object":
    mb = polykit.MeshBuilder('${opts.id}')
    # Example modular geometry aligned to UAL1 world coordinates (head ~1.52m, chest ~1.18m, waist ~0.95m)
    mb.add_tapered_prism(
        center=(0.0, 0.0, 1.24),
        rx0=0.18, ry0=0.13,
        rx1=0.21, ry1=0.15,
        height=0.34,
        sides=8,
        region='primary',
    )
    obj = mb.build_object(name='${opts.id}', uv_ao=True)
    # Skin cleanly from the canonical UAL1 bone solver / nearest surface weights
    polykit.transfer_weights_from(obj, core_body_obj, armature_obj)
    return obj
`
  }

  const spec = RIG_SPECS[opts.rig]
  const b = BUDGETS.classes.body
  return `"""
RUN Chisel Creature Body Scaffold: ${opts.id} (${opts.label})
Pack: monsters (${POLY_PACKS.monsters.dir}) | Rig: ${opts.rig} (${spec.label})
Joints (${spec.joints.length}): ${spec.joints.join(', ')}
Ground bones (must rest at Y=0 in bind pose and stay >= -0.02 across all clips): ${spec.groundBones.join(', ') || '(none / hovering)'}
Budget: <= ${b.maxTriangles} tris, all 7 palette regions used, >= 4 vertices (>= 0.35 weight) per non-root bone.
"""
from mathutils import Vector
import polykit


def build_${opts.id}_mesh(solver) -> "bpy.types.Object":
    mb = polykit.MeshBuilder('${opts.id}')
    # Build chunky faceted hull chunks using mb.add_box / add_prism / add_hull
    # and register per-bone or socket-blended segment weights with \`solver\`!
    # Rule: Keep limbs/ears/wings >= 0.015m away from X=0 on _l/_r segments.
    # Rule: Ground lowest paw/claw/foot vertices cleanly at Y=0.0 (Blender Z=0.0).
    obj = mb.build_object(name='${opts.id}', uv_ao=True)
    solver.apply(obj)
    return obj
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
  if (!id || !/^[a-z0-9_]+$/.test(id)) {
    throw new Error('--id is required and must match /^[a-z0-9_]+$/ (e.g. prop_anvil)')
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

  const label = arg('--label') ?? titleCase(id)
  const code = generatePython({ kind, pack, id, label, slot, hand, rig })

  if (process.argv.includes('--stdout')) {
    console.log(code)
  } else {
    const outDir = join(TOOL_ROOT, 'out/scaffolds')
    mkdirSync(outDir, { recursive: true })
    const outFile = join(outDir, `${id}.py`)
    writeFileSync(outFile, code)
    console.log(`Wrote scaffold: ${outFile}`)
  }

  console.log('\n=== Checklist ===')
  console.log(`1. Wire builder into ${kind === 'creature' ? 'blender/build_monsters.py (or creatures_*.py)' : 'blender/build_packs.py'} and export GLB to ${POLY_PACKS[pack].dir}/...`)
  console.log('2. Run: npm run build && npm run validate && npm run catalog')
  console.log(`3. Render thumbnails: (cd ../../games/run-chisel-showcase && npm run thumbnails -- --pack ${pack} --force)`)
  console.log(`4. Visually inspect: npm run snapshot -- --out out/review/${id}.png --views ${id}`)
  console.log(`5. Check scale vs 1.8m human: npm run lineup -- --out out/review/${id}_lineup.png ${id}`)
}

main()
