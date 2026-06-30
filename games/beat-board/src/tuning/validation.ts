import type {
  BooleanTunableDescriptor,
  ColorTunableDescriptor,
  NumberTunableDescriptor,
  StringTunableDescriptor,
  TunableDescriptor,
  Vec3TunableDescriptor,
  Vec3Value,
} from './registry'

export function clampAndSnap(
  value: number,
  options: { min: number; max: number; step: number },
): number {
  const { min, max, step } = options
  const clamped = Math.max(min, Math.min(max, value))
  const snapped = Math.round((clamped - min) / step) * step + min
  const finalClamped = Math.max(min, Math.min(max, snapped))
  const stepStr = step.toString()
  const dotIdx = stepStr.indexOf('.')
  const precision = dotIdx >= 0 ? stepStr.length - dotIdx - 1 : 0
  return Number.parseFloat(finalClamped.toFixed(precision))
}

function validateVec3(descriptor: Vec3TunableDescriptor): void {
  assertFiniteNumber(descriptor.min, `${descriptor.id}.min`)
  assertFiniteNumber(descriptor.max, `${descriptor.id}.max`)
  assertFiniteNumber(descriptor.step, `${descriptor.id}.step`)

  if (descriptor.min > descriptor.max) {
    throw new Error(
      `tuning: ${descriptor.id} min (${descriptor.min}) must be <= max (${descriptor.max})`,
    )
  }
  if (descriptor.step <= 0) {
    throw new Error(
      `tuning: ${descriptor.id} step must be > 0 (got ${descriptor.step})`,
    )
  }

  const iv = descriptor.initialValue
  if (!iv || typeof iv !== 'object') {
    throw new Error(
      `tuning: ${descriptor.id} initialValue must be { x, y, z } (got ${typeof iv})`,
    )
  }
  const components: Array<keyof Vec3Value> = ['x', 'y', 'z']
  components.forEach((axis) => {
    assertFiniteNumber(iv[axis], `${descriptor.id}.initialValue.${axis}`)
    if (iv[axis] < descriptor.min || iv[axis] > descriptor.max) {
      throw new Error(
        `tuning: ${descriptor.id} initialValue.${axis} (${iv[axis]}) out of [${descriptor.min}, ${descriptor.max}]`,
      )
    }
  })
}

const HEX_6 = /^#[0-9a-fA-F]{6}$/
const HEX_8 = /^#[0-9a-fA-F]{8}$/

export function normalizeHex(
  value: string,
  options: { alpha?: boolean } = {},
): string | null {
  if (typeof value !== 'string') return null
  const { alpha = false } = options
  if (alpha) {
    if (!HEX_8.test(value)) return null
  } else {
    if (!HEX_6.test(value)) return null
  }
  return value.toLowerCase()
}

function validateColor(descriptor: ColorTunableDescriptor): void {
  if (typeof descriptor.initialValue !== 'string') {
    throw new Error(
      `tuning: ${descriptor.id} initialValue must be a hex string (got ${typeof descriptor.initialValue})`,
    )
  }

  const normalized = normalizeHex(descriptor.initialValue, {
    alpha: descriptor.alpha ?? false,
  })
  if (normalized === null) {
    const expected = descriptor.alpha ? '#RRGGBBAA' : '#RRGGBB'
    throw new Error(
      `tuning: ${descriptor.id} initialValue (${descriptor.initialValue}) must match ${expected} hex format`,
    )
  }
}

function assertFiniteNumber(value: number, field: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `tuning: ${field} must be a finite number (got ${String(value)})`,
    )
  }
}

function validateNumber(descriptor: NumberTunableDescriptor): void {
  assertFiniteNumber(descriptor.min, `${descriptor.id}.min`)
  assertFiniteNumber(descriptor.max, `${descriptor.id}.max`)
  assertFiniteNumber(descriptor.step, `${descriptor.id}.step`)
  assertFiniteNumber(descriptor.initialValue, `${descriptor.id}.initialValue`)

  if (descriptor.min > descriptor.max) {
    throw new Error(
      `tuning: ${descriptor.id} min (${descriptor.min}) must be <= max (${descriptor.max})`,
    )
  }
  if (descriptor.step <= 0) {
    throw new Error(
      `tuning: ${descriptor.id} step must be > 0 (got ${descriptor.step})`,
    )
  }
  if (
    descriptor.initialValue < descriptor.min ||
    descriptor.initialValue > descriptor.max
  ) {
    throw new Error(
      `tuning: ${descriptor.id} initialValue (${descriptor.initialValue}) out of [${descriptor.min}, ${descriptor.max}]`,
    )
  }
}

function validateBoolean(descriptor: BooleanTunableDescriptor): void {
  if (typeof descriptor.initialValue !== 'boolean') {
    throw new Error(
      `tuning: ${descriptor.id} initialValue must be a boolean (got ${typeof descriptor.initialValue})`,
    )
  }
}

function validateString(descriptor: StringTunableDescriptor): void {
  if (typeof descriptor.initialValue !== 'string') {
    throw new Error(
      `tuning: ${descriptor.id} initialValue must be a string (got ${typeof descriptor.initialValue})`,
    )
  }

  if (descriptor.options !== undefined) {
    if (!Array.isArray(descriptor.options) || descriptor.options.length === 0) {
      throw new Error(
        `tuning: ${descriptor.id} options must be a non-empty array when provided`,
      )
    }
    if (!descriptor.options.includes(descriptor.initialValue)) {
      throw new Error(
        `tuning: ${descriptor.id} initialValue (${descriptor.initialValue}) must be one of options [${descriptor.options.join(', ')}]`,
      )
    }
  }
}

export function validateTunableDescriptor(descriptor: TunableDescriptor): void {
  if (descriptor.type === 'number') {
    validateNumber(descriptor)
    return
  }
  if (descriptor.type === 'boolean') {
    validateBoolean(descriptor)
    return
  }
  if (descriptor.type === 'string') {
    validateString(descriptor)
    return
  }
  if (descriptor.type === 'color') {
    validateColor(descriptor)
    return
  }
  if (descriptor.type === 'vec3') {
    validateVec3(descriptor)
    return
  }
  throw new Error(
    `tuning: unsupported descriptor type on ${(descriptor as { id: string }).id}`,
  )
}
