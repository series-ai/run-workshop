import { describe, expect, it } from 'vitest'
import type { ParsedGlb } from './glbInspect'
import { assertPropColors } from './propColors'

function grayProp(red: number): ParsedGlb {
  const bin = Buffer.alloc(12)
  bin.writeFloatLE(0.3571, 0)
  bin.writeFloatLE(0.15, 4)
  bin.set([red, 31, 31, 255], 8)
  return {
    bin,
    byteLength: bin.length,
    doc: {
      nodes: [{ name: 'prop_sample', mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1, COLOR_0: 2 } }] }],
      accessors: [
        { componentType: 5126, count: 1, type: 'VEC3' },
        { bufferView: 0, componentType: 5126, count: 1, type: 'VEC2' },
        { bufferView: 1, componentType: 5121, count: 1, type: 'VEC4', normalized: true },
      ],
      bufferViews: [{ byteLength: 8 }, { byteOffset: 8, byteLength: 4 }],
    },
  }
}

describe('baked prop colors', () => {
  const palette = {
    primary: '#808080', skin: '#ababab', hair: '#353535', secondary: '#404040',
    accent: '#ce9040', metal: '#909099', eye: '#189188',
  }

  it('rejects stale bytes in an otherwise valid normalized color accessor', () => {
    expect(() => assertPropColors(grayProp(31), 'prop_sample', palette)).not.toThrow()
    expect(() => assertPropColors(grayProp(40), 'prop_sample', palette)).toThrow(/prop_sample.*palette/)
  })
})
