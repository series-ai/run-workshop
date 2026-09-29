import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Accessor, Document } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'
import { createIo } from '../gltfIo'
import { coplanarOverlaps } from '../validate/zfight'
import { finalizeGlb, PART_INSET, QUANTIZED_NODE_SUFFIX } from './finalize'

const io = createIo()

/** A root with one animated-style part at a half-voxel pivot, and one mesh off the grid. */
async function fixture(): Promise<string> {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const quad = (name: string, positions: number[]) =>
    doc.createMesh(name).addPrimitive(
      doc
        .createPrimitive()
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer))
        .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0])).setBuffer(buffer))
        .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array([4.5 / 256, 0.5, 4.5 / 256, 0.5, 200.5 / 256, 0.5])).setBuffer(buffer)),
    )
  const part = doc.createNode('lid').setTranslation([0.5, 3, 0]).setMesh(quad('lid', [-2.5, 0, -2, 2.5, 0, -2, 0.5, 1, 3]))
  const odd = doc.createNode('odd').setMesh(quad('odd', [0.3, 0, 0, 1.3, 0, 0, 0.3, 1, 0]))
  const root = doc.createNode('chest').setMesh(quad('chest', [-3, 0, -3, 3, 0, -3, 3, 2, 3])).addChild(part).addChild(odd)
  doc.createScene('scene').addChild(root)
  const path = join(mkdtempSync(join(tmpdir(), 'rvx-finalize-')), 'chest.glb')
  writeFileSync(path, await io.writeBinary(doc))
  return path
}

function worldPositions(doc: Document, meshName: string): number[] {
  const node = doc.getRoot().listNodes().find((n) => n.getMesh()?.getName() === meshName)!
  const m = node.getWorldMatrix()
  const position = node.getMesh()!.listPrimitives()[0]!.getAttribute('POSITION')!
  const out: number[] = []
  const v = [0, 0, 0]
  for (let i = 0; i < position.getCount(); i += 1) {
    position.getElement(i, v)
    for (let r = 0; r < 3; r += 1) out.push(m[r]! * v[0]! + m[4 + r]! * v[1]! + m[8 + r]! * v[2]! + m[12 + r]!)
  }
  return out
}

describe('finalizeGlb', () => {
  it('quantizes on-grid meshes losslessly, tags the scale class, and is idempotent', async () => {
    const path = await fixture()
    const before = await io.readBinary(new Uint8Array(readFileSync(path)))
    await finalizeGlb(path, { scale: 'prop', quantize: true })
    const once = readFileSync(path)
    const after = await io.readBinary(new Uint8Array(once))

    for (const name of ['chest', 'lid', 'odd']) expect(worldPositions(after, name)).toEqual(worldPositions(before, name))
    const type = (name: string) => after.getRoot().listMeshes().find((m) => m.getName() === name)!.listPrimitives()[0]!.getAttribute('POSITION')!.getComponentType()
    expect(type('chest')).toBe(Accessor.ComponentType.SHORT)
    expect(type('lid')).toBe(Accessor.ComponentType.SHORT)
    expect(type('odd')).toBe(Accessor.ComponentType.FLOAT) // off the half-voxel grid: left for voxel.grid to report
    expect(after.getRoot().listExtensionsUsed().map((e) => e.extensionName)).toEqual(['KHR_mesh_quantization'])
    expect(after.getRoot().listScenes()[0]!.getExtras()).toEqual({ rvx: { scale: 'prop' } })
    // The animated node keeps its name and transform; the mesh moves to a child.
    const lid = after.getRoot().listNodes().find((n) => n.getName() === 'lid')!
    expect(lid.getMesh()).toBeNull()
    expect(lid.getTranslation()).toEqual([0.5, 3, 0])
    expect(lid.listChildren().map((c) => c.getName())).toEqual([`lid${QUANTIZED_NODE_SUFFIX}`])
    const uv = [0, 0]
    after.getRoot().listMeshes().find((m) => m.getName() === 'lid')!.listPrimitives()[0]!.getAttribute('TEXCOORD_0')!.getElement(2, uv)
    expect(Math.abs(uv[0]! * 256 - 200.5)).toBeLessThan(0.01)

    await finalizeGlb(path, { scale: 'prop', quantize: true })
    expect(readFileSync(path).equals(once)).toBe(true)
  })

  it('leaves avatar-space files unquantized', async () => {
    const path = await fixture()
    await finalizeGlb(path)
    const doc = await io.readBinary(new Uint8Array(readFileSync(path)))
    expect(doc.getRoot().listExtensionsUsed()).toEqual([])
    expect(doc.getRoot().listScenes()[0]!.getExtras()).toEqual({})
  })

  it('moves the smaller of two parts whose flush faces overlap back, so they stop fighting', async () => {
    const doc = new Document()
    const buffer = doc.createBuffer()
    // A closed box from (x0, y0, z0) to (x1, y1, z1), outward-wound.
    const box = (name: string, [x0, y0, z0]: number[], [x1, y1, z1]: number[]) => {
      const c: number[][] = [[x0!, y0!, z0!], [x1!, y0!, z0!], [x1!, y1!, z0!], [x0!, y1!, z0!], [x0!, y0!, z1!], [x1!, y0!, z1!], [x1!, y1!, z1!], [x0!, y1!, z1!]]
      const quads = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]]
      const tri = quads.flatMap((q) => [q[0]!, q[1]!, q[2]!, q[0]!, q[2]!, q[3]!]).flatMap((i) => c[i]!)
      return doc.createMesh(name).addPrimitive(
        doc
          .createPrimitive()
          .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(tri)).setBuffer(buffer))
          .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(tri.length).fill(0)).setBuffer(buffer))
          .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array((tri.length / 3) * 2)).setBuffer(buffer)),
      )
    }
    // A deck and a crate on it whose top is flush with a raised rail: both tops at y = 4.
    const deck = doc.createNode('deck').setMesh(box('deck', [0, 0, 0], [10, 4, 10]))
    const crate = doc.createNode('crate').setTranslation([2, 0, 2]).setMesh(box('crate', [0, 2, 0], [3, 4, 3]))
    doc.createScene('scene').addChild(deck.addChild(crate))
    const path = join(mkdtempSync(join(tmpdir(), 'rvx-inset-')), 'deck.glb')
    writeFileSync(path, await io.writeBinary(doc))
    const fights = (d: Document) => coplanarOverlaps(d, 1).filter((o) => o.facing === 'same' && o.nodes[0] !== o.nodes[1])
    expect(fights(await io.readBinary(new Uint8Array(readFileSync(path)))).length).toBeGreaterThan(0)

    await finalizeGlb(path, { scale: 'prop', quantize: true, insetUnit: 1 })
    const once = readFileSync(path)
    const after = await io.readBinary(new Uint8Array(once))
    expect(fights(after)).toEqual([])
    // The crate moved down by PART_INSET; the deck did not move.
    const top = Math.max(...worldPositions(after, 'crate').filter((_, i) => i % 3 === 1))
    expect(top).toBeCloseTo(4 - PART_INSET, 6)
    expect(Math.max(...worldPositions(after, 'deck').filter((_, i) => i % 3 === 1))).toBe(4)
    await finalizeGlb(path, { scale: 'prop', quantize: true, insetUnit: 1 })
    expect(readFileSync(path).equals(once)).toBe(true)
  })
})
