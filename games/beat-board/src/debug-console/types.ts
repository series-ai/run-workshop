import type { ReactNode } from 'react'
import type { ZodTypeAny, output } from 'zod'
import type { DebugConsoleAccess, DebugConsoleAccessThreshold } from './access'

export interface DebugConsoleModuleRenderContext {
  access: DebugConsoleAccess | null
  currentScreen: string
}

export interface DebugConsoleBootstrapContext {
  getAccess: () => DebugConsoleAccess | null
  getCurrentScreen: () => string
  getBinding: <T>(id: string) => T | undefined
}

export interface DebugConsoleModule {
  id: string
  title: string
  minimumRole?: DebugConsoleAccessThreshold
  order?: number
  commands?: DebugCommandDescriptor[]
  grantProviders?: DebugGrantProvider[]
  render: (context: DebugConsoleModuleRenderContext) => ReactNode
}

export type DebugCommandSafety = 'diagnostic' | 'support-mutation' | 'dangerous-mutation'

export interface DebugCommandOption {
  label: string
  value: string
}

export interface DebugCommandFormContext {
  access: DebugConsoleAccess | null
  currentScreen: string
  args: Record<string, unknown>
}

export interface DebugCommandFieldDescriptor {
  key: string
  label: string
  kind: 'text' | 'number' | 'select' | 'textarea' | 'toggle'
  description?: string
  placeholder?: string
  redact?: boolean
  isVisible?: (context: DebugCommandFormContext) => boolean
  isEnabled?: (context: DebugCommandFormContext) => boolean
  getOptions?: (context: DebugCommandFormContext) => DebugCommandOption[] | Promise<DebugCommandOption[]>
  onValueChanged?: (
    context: DebugCommandFormContext & { nextValue: unknown },
  ) => Record<string, unknown> | void
}

export interface DebugCommandConfirmation {
  message: string
  confirmLabel?: string
}

export interface DebugCommandExecuteContext {
  access: DebugConsoleAccess
  currentScreen: string
}

export interface DebugCommandDescriptor<TSchema extends ZodTypeAny = ZodTypeAny> {
  id: string
  label: string
  description?: string
  aliases?: string[]
  minimumRole?: DebugConsoleAccessThreshold
  safety?: DebugCommandSafety
  schema: TSchema
  fields?: DebugCommandFieldDescriptor[]
  confirm?: DebugCommandConfirmation
  isVisible?: (context: DebugCommandFormContext) => boolean
  isEnabled?: (context: DebugCommandFormContext) => boolean
  execute: (
    args: output<TSchema>,
    context: DebugCommandExecuteContext,
  ) => unknown | Promise<unknown>
}

export interface DebugGrantProvider<TSchema extends ZodTypeAny = ZodTypeAny> {
  id: string
  label: string
  description?: string
  aliases?: string[]
  minimumRole?: DebugConsoleAccessThreshold
  safety?: Exclude<DebugCommandSafety, 'diagnostic'>
  schema: TSchema
  fields?: DebugCommandFieldDescriptor[]
  confirm?: DebugCommandConfirmation
  executeGrant: (
    args: output<TSchema>,
    context: DebugCommandExecuteContext,
  ) => unknown | Promise<unknown>
}

export interface DebugConsoleModuleFactoryExport {
  createDebugConsoleModule?: (
    context: DebugConsoleBootstrapContext,
  ) => DebugConsoleModule | DebugConsoleModule[] | null | undefined
}
