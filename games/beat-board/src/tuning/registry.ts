import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { validateTunableDescriptor } from './validation'

export interface BaseTunableDescriptor {
  id: string
  label: string
  folder: string
  enabled?: boolean
}

export interface NumberTunableDescriptor extends BaseTunableDescriptor {
  type: 'number'
  min: number
  max: number
  step: number
  initialValue: number
  get: () => number
  set: (value: number) => void
}

export interface BooleanTunableDescriptor extends BaseTunableDescriptor {
  type: 'boolean'
  initialValue: boolean
  get: () => boolean
  set: (value: boolean) => void
}

export interface StringTunableDescriptor extends BaseTunableDescriptor {
  type: 'string'
  options?: string[]
  initialValue: string
  get: () => string
  set: (value: string) => void
}

export interface ColorTunableDescriptor extends BaseTunableDescriptor {
  type: 'color'
  alpha?: boolean
  initialValue: string
  get: () => string
  set: (value: string) => void
}

export interface Vec3Value {
  x: number
  y: number
  z: number
}

export interface Vec3TunableDescriptor extends BaseTunableDescriptor {
  type: 'vec3'
  min: number
  max: number
  step: number
  initialValue: Vec3Value
  get: () => Vec3Value
  set: (value: Vec3Value) => void
}

export type TunableDescriptor =
  | NumberTunableDescriptor
  | BooleanTunableDescriptor
  | StringTunableDescriptor
  | ColorTunableDescriptor
  | Vec3TunableDescriptor

type Listener = () => void

const registry = new Map<string, TunableDescriptor>()
const listeners = new Set<Listener>()

function notify(): void {
  listeners.forEach((listener) => listener())
}

export function registerTunable(descriptor: TunableDescriptor): () => void {
  validateTunableDescriptor(descriptor)
  registry.set(descriptor.id, descriptor)
  notify()

  return () => {
    if (registry.get(descriptor.id) !== descriptor) {
      return
    }
    registry.delete(descriptor.id)
    notify()
  }
}

export function getRegisteredTunable(id: string): TunableDescriptor | undefined {
  return registry.get(id)
}

export function getTunableIds(): string[] {
  return [...registry.keys()]
}

export function listRegisteredTunables(): TunableDescriptor[] {
  return [...registry.values()]
}

export function subscribeToTuningRegistry(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function clearTuningRegistryForTesting(): void {
  registry.clear()
  notify()
}

export function resetAllTunables(): void {
  const ids = [...registry.keys()]
  ids.forEach((id) => {
    const descriptor = registry.get(id)
    if (!descriptor) return
    try {
      ;(descriptor.set as (value: unknown) => void)(descriptor.initialValue)
    } catch (error) {
      RundotAPI.error(`tuning: reset-all set() threw for ${id}`, { error })
    }
  })
}
