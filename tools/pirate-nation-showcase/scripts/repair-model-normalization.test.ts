import { describe, expect, it } from 'vitest'
import {
  applyShiftToPositions,
  computeAssembledBounds,
  parseGlb,
  positionAccessorIndices,
  validatePositionAccessors,
  writeGlb,
  type Gltf,
} from './repair-model-normalization'

function pad4(buf: Buffer): Buffer {
  const pad = (4 - (buf.length % 4)) % 4
  return pad ? Buffer.concat([buf, Buffer.alloc(pad)]) : buf
}

/** Two-mesh GLB: mesh 0 is tightly packed (stride 12) and shared by two
 * primitives (dedupe check); mesh 1 is interleaved pos+normal+uv (stride 32).
 * Node 'b' carries a 180° yaw + translation for the bounds test. */
function buildTestGlb(): { buf: Buffer; gltf: Gltf } {
  const positions0 = Buffer.from(new Float32Array([1, 2, 3, 4, 5, 6]).buffer)
  const interleaved = Buffer.from(
    new Float32Array([
      1, 2, 3, 0, 1, 0, 0, 0, // vert 0: pos xyz, normal, uv
      4, 5, 6, 0, 1, 0, 1, 1, // vert 1
    ]).buffer,
  )
  const bin = pad4(Buffer.concat([positions0, interleaved]))
  const gltf: Gltf = {
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      { name: 'root', children: [1, 2] },
      { name: 'a', mesh: 0 },
      { name: 'b', mesh: 1, translation: [10, 0, 0], rotation: [0, 1, 0, 0] },
    ],
    meshes: [
      { primitives: [{ attributes: { POSITION: 0 } }, { attributes: { POSITION: 0 } }] },
      { primitives: [{ attributes: { POSITION: 1 } }] },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 2, type: 'VEC3', min: [1, 2, 3], max: [4, 5, 6] },
      { bufferView: 1, componentType: 5126, count: 2, type: 'VEC3', min: [1, 2, 3], max: [4, 5, 6] },
    ],
    bufferViews: [{ byteOffset: 0 }, { byteOffset: 24, byteStride: 32 }],
  }
  return { buf: writeGlb(gltf, bin), gltf }
}

describe('parseGlb', () => {
  it('rejects non-GLB data', () => {
    expect(() => parseGlb(Buffer.from('definitely not a glb file'))).toThrow(/magic/)
  })

  it('round-trips through writeGlb', () => {
    const { buf } = buildTestGlb()
    const { gltf } = parseGlb(buf)
    expect(gltf.nodes.map((n) => n.name)).toEqual(['root', 'a', 'b'])
    expect(gltf.accessors[1]!.max).toEqual([4, 5, 6])
  })
})

describe('positionAccessorIndices', () => {
  it('dedupes accessors shared between primitives', () => {
    const { gltf } = buildTestGlb()
    expect(positionAccessorIndices(gltf)).toEqual([0, 1])
  })
})

describe('validatePositionAccessors', () => {
  it('accepts the test model and rejects bad component types and missing bounds', () => {
    const { gltf } = buildTestGlb()
    expect(() => validatePositionAccessors(gltf)).not.toThrow()

    delete gltf.accessors[1]!.min
    expect(() => validatePositionAccessors(gltf)).toThrow(/min and max/)

    gltf.accessors[1]!.componentType = 5123 // uint16
    expect(() => validatePositionAccessors(gltf)).toThrow(/float32 VEC3/)
  })

  it('rejects an accessor that reaches past the BIN chunk', () => {
    const { gltf } = buildTestGlb()
    expect(() => validatePositionAccessors(gltf, 8)).toThrow(/BIN chunk/)
  })
})

describe('applyShiftToPositions', () => {
  it('shifts only Y, honors byteStride, updates min/max, shifts shared accessors once', () => {
    const { buf } = buildTestGlb()
    const { gltf, binStart } = parseGlb(buf)
    applyShiftToPositions(buf, binStart, gltf, -2)

    expect(gltf.accessors[0]!.min).toEqual([1, 0, 3])
    expect(gltf.accessors[0]!.max).toEqual([4, 3, 6])
    expect(gltf.accessors[1]!.min).toEqual([1, 0, 3])

    // Tightly packed accessor 0 at binStart: vert0 Y at +4, vert1 Y at +16.
    expect(buf.readFloatLE(binStart + 4)).toBe(0)
    expect(buf.readFloatLE(binStart + 16)).toBe(3)
    expect(buf.readFloatLE(binStart + 0)).toBe(1) // X untouched
    expect(buf.readFloatLE(binStart + 8)).toBe(3) // Z untouched

    // Interleaved accessor 1 (base binStart+24, stride 32): vert0 Y at +28,
    // vert1 Y at +60; normals and uvs must be untouched.
    expect(buf.readFloatLE(binStart + 28)).toBe(0)
    expect(buf.readFloatLE(binStart + 60)).toBe(3)
    expect(buf.readFloatLE(binStart + 36)).toBe(0) // vert0 normal x
    expect(buf.readFloatLE(binStart + 48)).toBe(0) // vert0 uv u
    expect(buf.readFloatLE(binStart + 80)).toBe(1) // vert1 uv u

    // Patched data must survive a repack: write the buffer back out and
    // parse it again, exactly as the repair does.
    const written = writeGlb(gltf, buf.subarray(binStart))
    const round = parseGlb(written)
    expect(round.gltf.accessors[0]!.min).toEqual([1, 0, 3])
    expect(written.readFloatLE(round.binStart + 4)).toBe(0)
  })

  it('rejects sparse accessors', () => {
    const { buf } = buildTestGlb()
    const { gltf, binStart } = parseGlb(buf)
    gltf.accessors[0]!.sparse = { count: 1 }
    expect(() => applyShiftToPositions(buf, binStart, gltf, 1)).toThrow(/sparse/)
  })
})

describe('computeAssembledBounds', () => {
  it('unions node-transformed AABBs and ignores skinned node transforms', () => {
    const { gltf } = buildTestGlb()
    // Mesh 1 box (1..4, 2..5, 3..6) under 180° yaw + t=[10,0,0] lands at
    // x 6..9, y 2..5, z -6..-3. Union with mesh 0 at identity:
    expect(computeAssembledBounds(gltf)).toEqual({
      min: [1, 2, -6],
      max: [9, 5, 6],
      size: [8, 3, 12],
    })

    // Node 'a' becomes skinned and gains a large translation. A skinned node
    // is posed by its joints, so the translation must not move the bounds.
    // Without the skin rule the union would reach x = 104.
    gltf.nodes[1]!.skin = 0
    gltf.nodes[1]!.translation = [100, 0, 0]
    expect(computeAssembledBounds(gltf)).toEqual({
      min: [1, 2, -6],
      max: [9, 5, 6],
      size: [8, 3, 12],
    })
  })
})
