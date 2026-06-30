import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  getRegisteredTunable,
  getTunableIds,
  type TunableDescriptor,
  type Vec3Value,
} from './registry'
import {
  getTuningOverlayState,
  setTuningOverlayEnabled,
} from './state'
import { clampAndSnap, normalizeHex } from './validation'

export interface TuningBridge {
  setEnabled: (enabled: boolean) => Promise<void>
  setValue: (id: string, value: unknown) => void
  isEnabled: () => boolean
  getRegisteredIds: () => string[]
  getValue: (id: string) => unknown
}

function isVec3Value(value: unknown): value is Vec3Value {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Vec3Value).x === 'number' &&
    typeof (value as Vec3Value).y === 'number' &&
    typeof (value as Vec3Value).z === 'number'
  )
}

function writeTo(
  descriptor: TunableDescriptor,
  value: unknown,
): void {
  try {
    switch (descriptor.type) {
      case 'number': {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          RundotAPI.error(
            `tuning: setValue(${descriptor.id}) expected a finite number`,
            { value },
          )
          return
        }
        descriptor.set(clampAndSnap(value, descriptor))
        return
      }
      case 'boolean': {
        if (typeof value !== 'boolean') {
          RundotAPI.error(
            `tuning: setValue(${descriptor.id}) expected a boolean`,
            { value },
          )
          return
        }
        descriptor.set(value)
        return
      }
      case 'string': {
        if (typeof value !== 'string') {
          RundotAPI.error(
            `tuning: setValue(${descriptor.id}) expected a string`,
            { value },
          )
          return
        }
        if (descriptor.options && !descriptor.options.includes(value)) {
          RundotAPI.error(
            `tuning: setValue(${descriptor.id}) value "${value}" not in options`,
            { options: descriptor.options },
          )
          return
        }
        descriptor.set(value)
        return
      }
      case 'color': {
        if (typeof value !== 'string') {
          RundotAPI.error(
            `tuning: setValue(${descriptor.id}) expected a hex string`,
            { value },
          )
          return
        }
        const normalized = normalizeHex(value, {
          alpha: descriptor.alpha ?? false,
        })
        if (normalized === null) {
          RundotAPI.error(
            `tuning: setValue(${descriptor.id}) rejected malformed hex ${value}`,
          )
          return
        }
        descriptor.set(normalized)
        return
      }
      case 'vec3': {
        if (!isVec3Value(value)) {
          RundotAPI.error(
            `tuning: setValue(${descriptor.id}) expected { x, y, z }`,
            { value },
          )
          return
        }
        descriptor.set({
          x: clampAndSnap(value.x, descriptor),
          y: clampAndSnap(value.y, descriptor),
          z: clampAndSnap(value.z, descriptor),
        })
        return
      }
    }
  } catch (error) {
    RundotAPI.error(`tuning: setValue(${descriptor.id}) threw`, { error })
  }
}

export const tuningBridge: TuningBridge = {
  setEnabled: (enabled) => setTuningOverlayEnabled(enabled),
  setValue: (id, value) => {
    const descriptor = getRegisteredTunable(id)
    if (!descriptor) {
      RundotAPI.error(`tuning: setValue called for unknown id ${id}`)
      return
    }
    writeTo(descriptor, value)
  },
  isEnabled: () => getTuningOverlayState().userEnabled,
  getRegisteredIds: () => getTunableIds(),
  getValue: (id) => {
    const descriptor = getRegisteredTunable(id)
    if (!descriptor) return undefined
    try {
      return descriptor.get()
    } catch (error) {
      RundotAPI.error(`tuning: getValue(${id}) threw`, { error })
      return undefined
    }
  },
}
