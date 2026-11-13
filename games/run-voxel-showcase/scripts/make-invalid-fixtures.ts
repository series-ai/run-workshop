/**
 * Builds deliberately broken copies of staged fantasy files for the A12
 * e2e suite (e2e/invalid.spec.ts). Output: e2e/fixtures/out (gitignored).
 *
 * Usage: node --import tsx scripts/make-invalid-fixtures.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { NodeIO, TextureInfo } from '@gltf-transform/core'
import { KHRMeshQuantization } from '@gltf-transform/extensions'

const ROOT = resolve(import.meta.dirname, '..')
const STAGE = process.env.VITE_RVX_STAGE_DIR ?? resolve(ROOT, '../../tools/run-voxel-packs/out/jam-stage')
const OUT = join(ROOT, 'e2e/fixtures/out')
// Finalized world GLBs use KHR_mesh_quantization.
const io = new NodeIO().registerExtensions([KHRMeshQuantization])

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true })
  const barrel = await io.readBinary(new Uint8Array(readFileSync(join(STAGE, 'run-voxel-fantasy/3D/fantasy/props/fantasy-props-barrel.glb'))))
  const linear = TextureInfo.MagFilter.LINEAR
  if (linear === undefined) throw new Error('no LINEAR constant')
  for (const material of barrel.getRoot().listMaterials()) material.getBaseColorTextureInfo()?.setMagFilter(linear)
  writeFileSync(join(OUT, 'linear-barrel.glb'), await io.writeBinary(barrel))

  const parts = await io.readBinary(new Uint8Array(readFileSync(join(STAGE, 'run-voxel-fantasy/3D/characters/avatar/fantasy-avatar-parts.glb'))))
  // Swap joints 0 and 1 consistently (joint list, inverse bind matrices, vertex
  // JOINTS_0), so the mesh is unchanged and only the joint ORDER breaks the PN contract.
  const remap = (i: number) => (i === 0 ? 1 : i === 1 ? 0 : i)
  for (const skin of parts.getRoot().listSkins()) {
    const joints = skin.listJoints()
    for (const joint of joints) skin.removeJoint(joint)
    for (const joint of [joints[1]!, joints[0]!, ...joints.slice(2)]) skin.addJoint(joint)
    const ibm = skin.getInverseBindMatrices()!
    const m = ibm.getArray()!.slice()
    const swapped = m.slice()
    swapped.set(m.subarray(16, 32), 0)
    swapped.set(m.subarray(0, 16), 16)
    ibm.setArray(swapped)
  }
  for (const mesh of parts.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const j = prim.getAttribute('JOINTS_0')
      if (!j) continue
      const a = j.getArray()!.slice()
      for (let i = 0; i < a.length; i += 1) a[i] = remap(a[i]!)
      j.setArray(a)
    }
  }
  writeFileSync(join(OUT, 'swapped-avatar-parts.glb'), await io.writeBinary(parts))
  console.log(`wrote fixtures to ${OUT}`)
}

await main()
