import { describe, expect, it } from 'vitest'
import {
  clampAndSnap,
  normalizeHex,
  validateTunableDescriptor,
} from './validation'
import type {
  BooleanTunableDescriptor,
  ColorTunableDescriptor,
  NumberTunableDescriptor,
  StringTunableDescriptor,
  Vec3TunableDescriptor,
} from './registry'

function buildNumberDescriptor(
  overrides: Partial<NumberTunableDescriptor> = {},
): NumberTunableDescriptor {
  return {
    id: 'test:value',
    label: 'Value',
    folder: 'Test',
    type: 'number',
    min: 0,
    max: 10,
    step: 0.5,
    initialValue: 5,
    get: () => 5,
    set: () => undefined,
    ...overrides,
  }
}

describe('validateTunableDescriptor (number)', () => {
  it('accepts a valid number descriptor', () => {
    expect(() => validateTunableDescriptor(buildNumberDescriptor())).not.toThrow()
  })

  it('throws when min > max', () => {
    expect(() =>
      validateTunableDescriptor(buildNumberDescriptor({ min: 10, max: 0 })),
    ).toThrow(/min.*max/i)
  })

  it('throws when step is zero or negative', () => {
    expect(() =>
      validateTunableDescriptor(buildNumberDescriptor({ step: 0 })),
    ).toThrow(/step/i)
    expect(() =>
      validateTunableDescriptor(buildNumberDescriptor({ step: -1 })),
    ).toThrow(/step/i)
  })

  it('throws when any numeric field is NaN', () => {
    expect(() =>
      validateTunableDescriptor(buildNumberDescriptor({ min: NaN })),
    ).toThrow(/NaN|finite/i)
    expect(() =>
      validateTunableDescriptor(buildNumberDescriptor({ max: NaN })),
    ).toThrow(/NaN|finite/i)
    expect(() =>
      validateTunableDescriptor(buildNumberDescriptor({ step: NaN })),
    ).toThrow(/NaN|finite/i)
    expect(() =>
      validateTunableDescriptor(buildNumberDescriptor({ initialValue: NaN })),
    ).toThrow(/NaN|finite/i)
  })

  it('throws when initialValue is outside [min, max]', () => {
    expect(() =>
      validateTunableDescriptor(
        buildNumberDescriptor({ min: 0, max: 10, initialValue: 20 }),
      ),
    ).toThrow(/initialValue/i)
    expect(() =>
      validateTunableDescriptor(
        buildNumberDescriptor({ min: 0, max: 10, initialValue: -1 }),
      ),
    ).toThrow(/initialValue/i)
  })
})

function buildBoolean(
  overrides: Partial<BooleanTunableDescriptor> = {},
): BooleanTunableDescriptor {
  return {
    id: 'toggle',
    label: 'Toggle',
    folder: 'Test',
    type: 'boolean',
    initialValue: true,
    get: () => true,
    set: () => undefined,
    ...overrides,
  }
}

function buildString(
  overrides: Partial<StringTunableDescriptor> = {},
): StringTunableDescriptor {
  return {
    id: 'mode',
    label: 'Mode',
    folder: 'Test',
    type: 'string',
    initialValue: 'a',
    get: () => 'a',
    set: () => undefined,
    ...overrides,
  }
}

describe('validateTunableDescriptor (boolean)', () => {
  it('accepts a valid boolean descriptor', () => {
    expect(() => validateTunableDescriptor(buildBoolean())).not.toThrow()
  })

  it('throws when initialValue is not a boolean', () => {
    expect(() =>
      validateTunableDescriptor(
        buildBoolean({ initialValue: 'yes' as unknown as boolean }),
      ),
    ).toThrow(/boolean/i)
  })
})

describe('validateTunableDescriptor (string)', () => {
  it('accepts a string descriptor without options (text input)', () => {
    expect(() => validateTunableDescriptor(buildString())).not.toThrow()
  })

  it('accepts a string descriptor with non-empty options and initialValue in options', () => {
    expect(() =>
      validateTunableDescriptor(
        buildString({ options: ['a', 'b', 'c'], initialValue: 'b' }),
      ),
    ).not.toThrow()
  })

  it('throws when options is an empty array', () => {
    expect(() =>
      validateTunableDescriptor(buildString({ options: [] })),
    ).toThrow(/options/i)
  })

  it('throws when initialValue is not in options', () => {
    expect(() =>
      validateTunableDescriptor(
        buildString({ options: ['a', 'b'], initialValue: 'z' }),
      ),
    ).toThrow(/initialValue.*options|options/i)
  })

  it('throws when initialValue is not a string', () => {
    expect(() =>
      validateTunableDescriptor(
        buildString({ initialValue: 42 as unknown as string }),
      ),
    ).toThrow(/string/i)
  })
})

function buildColor(
  overrides: Partial<ColorTunableDescriptor> = {},
): ColorTunableDescriptor {
  return {
    id: 'tint',
    label: 'Tint',
    folder: 'Color',
    type: 'color',
    initialValue: '#ff00aa',
    get: () => '#ff00aa',
    set: () => undefined,
    ...overrides,
  }
}

describe('validateTunableDescriptor (color)', () => {
  it('accepts a 6-digit hex string', () => {
    expect(() => validateTunableDescriptor(buildColor())).not.toThrow()
  })

  it('accepts an uppercase hex string (normalization happens separately)', () => {
    expect(() =>
      validateTunableDescriptor(buildColor({ initialValue: '#FF00AA' })),
    ).not.toThrow()
  })

  it('accepts an 8-digit hex when alpha is true', () => {
    expect(() =>
      validateTunableDescriptor(
        buildColor({ alpha: true, initialValue: '#ff00aaff' }),
      ),
    ).not.toThrow()
  })

  it('throws when alpha is true but hex is only 6 digits', () => {
    expect(() =>
      validateTunableDescriptor(
        buildColor({ alpha: true, initialValue: '#ff00aa' }),
      ),
    ).toThrow(/hex|alpha|RRGGBBAA/i)
  })

  it('throws when alpha is false but hex is 8 digits', () => {
    expect(() =>
      validateTunableDescriptor(buildColor({ initialValue: '#ff00aaff' })),
    ).toThrow(/hex|RRGGBB/i)
  })

  it('rejects shorthand 3-digit hex', () => {
    expect(() =>
      validateTunableDescriptor(buildColor({ initialValue: '#fab' })),
    ).toThrow(/hex|RRGGBB/i)
  })

  it('rejects non-hex strings', () => {
    expect(() =>
      validateTunableDescriptor(buildColor({ initialValue: 'red' })),
    ).toThrow(/hex|RRGGBB/i)
  })
})

describe('normalizeHex', () => {
  it('lowercases a valid 6-digit hex', () => {
    expect(normalizeHex('#FF00AA')).toBe('#ff00aa')
    expect(normalizeHex('#ff00aa')).toBe('#ff00aa')
  })

  it('lowercases a valid 8-digit hex with alpha', () => {
    expect(normalizeHex('#FF00AAFF', { alpha: true })).toBe('#ff00aaff')
  })

  it('returns null for malformed hex', () => {
    expect(normalizeHex('#zzz000')).toBeNull()
    expect(normalizeHex('#abc')).toBeNull()
    expect(normalizeHex('red')).toBeNull()
    expect(normalizeHex('')).toBeNull()
  })

  it('returns null when hex length does not match alpha flag', () => {
    expect(normalizeHex('#ff00aa', { alpha: true })).toBeNull()
    expect(normalizeHex('#ff00aaff')).toBeNull()
  })
})

function buildVec3(
  overrides: Partial<Vec3TunableDescriptor> = {},
): Vec3TunableDescriptor {
  return {
    id: 'pos',
    label: 'Position',
    folder: 'Scene',
    type: 'vec3',
    min: -10,
    max: 10,
    step: 0.5,
    initialValue: { x: 0, y: 0, z: 0 },
    get: () => ({ x: 0, y: 0, z: 0 }),
    set: () => undefined,
    ...overrides,
  }
}

describe('validateTunableDescriptor (vec3)', () => {
  it('accepts a valid vec3 descriptor', () => {
    expect(() => validateTunableDescriptor(buildVec3())).not.toThrow()
  })

  it('throws when any component of initialValue is out of [min, max]', () => {
    expect(() =>
      validateTunableDescriptor(
        buildVec3({ initialValue: { x: 20, y: 0, z: 0 } }),
      ),
    ).toThrow(/initialValue/i)
    expect(() =>
      validateTunableDescriptor(
        buildVec3({ initialValue: { x: 0, y: -20, z: 0 } }),
      ),
    ).toThrow(/initialValue/i)
    expect(() =>
      validateTunableDescriptor(
        buildVec3({ initialValue: { x: 0, y: 0, z: 100 } }),
      ),
    ).toThrow(/initialValue/i)
  })

  it('throws when min > max or step <= 0', () => {
    expect(() =>
      validateTunableDescriptor(buildVec3({ min: 10, max: 0 })),
    ).toThrow(/min.*max/i)
    expect(() =>
      validateTunableDescriptor(buildVec3({ step: 0 })),
    ).toThrow(/step/i)
  })

  it('throws when any component is NaN', () => {
    expect(() =>
      validateTunableDescriptor(
        buildVec3({ initialValue: { x: NaN, y: 0, z: 0 } }),
      ),
    ).toThrow(/NaN|finite/i)
  })
})

describe('clampAndSnap', () => {
  it('clamps to the min boundary', () => {
    expect(clampAndSnap(-100, { min: 0, max: 10, step: 0.5 })).toBe(0)
  })

  it('clamps to the max boundary', () => {
    expect(clampAndSnap(100, { min: 0, max: 10, step: 0.5 })).toBe(10)
  })

  it('snaps to the nearest step', () => {
    expect(clampAndSnap(3.3, { min: 0, max: 10, step: 0.5 })).toBe(3.5)
    expect(clampAndSnap(3.7, { min: 0, max: 10, step: 0.5 })).toBe(3.5)
    expect(clampAndSnap(3.75, { min: 0, max: 10, step: 0.5 })).toBe(4)
  })
})
