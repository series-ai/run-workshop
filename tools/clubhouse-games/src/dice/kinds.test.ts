import { describe, expect, it } from 'vitest'
import { DIE_KINDS, faceCount, parseDieKind, parseDieStyle, resolveDieStyle } from './kinds'

describe('parseDieKind', () => {
  it('accepts the standard RPG set', () => {
    expect(DIE_KINDS.map(parseDieKind)).toEqual([4, 6, 8, 10, 12, 20])
    for (const k of DIE_KINDS) expect(faceCount(k)).toBe(k)
  })

  it('rejects unknown kinds', () => {
    expect(() => parseDieKind(7)).toThrow(/d7/)
    expect(() => parseDieKind(100)).toThrow(/d100/)
  })
})

describe('resolveDieStyle', () => {
  it('keeps pip on d6 and rejects pip on other kinds', () => {
    expect(resolveDieStyle(6, 'pip')).toBe('pip')
    expect(() => resolveDieStyle(20, 'pip')).toThrow(/d20/)
  })

  it('rejects unknown styles', () => {
    expect(() => parseDieStyle('sparkly')).toThrow(/sparkly/)
  })
})
