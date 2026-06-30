import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { z } from 'zod'
import {
  canAccessAtLeast,
  createDebugConsoleAccess,
  getCachedDebugConsoleAccess,
  normalizeDebugConsoleAccess,
  type DebugConsoleAccess,
} from './access'
import { listDebugConsoleModules } from './modules'
import type {
  DebugCommandDescriptor,
  DebugCommandExecuteContext,
  DebugCommandFieldDescriptor,
  DebugCommandFormContext,
  DebugGrantProvider,
  DebugCommandSafety,
} from './types'

type Listener = () => void

export interface DebugConsoleExecutionLogEntry {
  commandId: string
  status: 'success' | 'error'
  timestamp: number
  role: DebugConsoleAccess['role']
  safety: DebugCommandSafety
  args: Record<string, unknown>
  error?: string
  result?: unknown
}

export interface DebugConsoleExecutionResult {
  status: 'success' | 'error'
  commandId: string
  result?: unknown
  error?: string
}

interface ExecuteOptions {
  access?: DebugConsoleAccess
  currentScreen?: string
}

const executionLog: DebugConsoleExecutionLogEntry[] = []
const EXECUTION_LOG_LIMIT = 25
const listeners = new Set<Listener>()

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join('; ')
}

function readCurrentScreen(): string {
  return window.__GAME_DEBUG__?.ui.getCurrentScreen() ?? 'none'
}

function getCommandFormContext(
  args: Record<string, unknown>,
  options: ExecuteOptions,
): DebugCommandFormContext {
  return {
    access: options.access ?? getCachedDebugConsoleAccess(),
    currentScreen: options.currentScreen ?? readCurrentScreen(),
    args,
  }
}

function grantProviderToCommand(provider: DebugGrantProvider): DebugCommandDescriptor {
  return {
    id: provider.id,
    label: provider.label,
    description: provider.description,
    aliases: provider.aliases,
    minimumRole: provider.minimumRole,
    safety: provider.safety ?? 'support-mutation',
    schema: provider.schema,
    fields: provider.fields,
    confirm: provider.confirm,
    execute: (args, context) => provider.executeGrant(args, context),
  }
}

function flattenCommands(): DebugCommandDescriptor[] {
  return listDebugConsoleModules().flatMap((module) => [
    ...(module.commands ?? []),
    ...(module.grantProviders ?? []).map(grantProviderToCommand),
  ])
}

function appendExecutionLog(entry: DebugConsoleExecutionLogEntry): void {
  executionLog.unshift(entry)
  if (executionLog.length > EXECUTION_LOG_LIMIT) {
    executionLog.length = EXECUTION_LOG_LIMIT
  }
  listeners.forEach((listener) => listener())
}

function findCommand(commandIdOrAlias: string): DebugCommandDescriptor | null {
  const normalized = commandIdOrAlias.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  return (
    flattenCommands().find((command) => {
      if (command.id.toLowerCase() === normalized) {
        return true
      }

      return command.aliases?.some((alias) => alias.toLowerCase() === normalized) ?? false
    })
    ?? null
  )
}

function getVisibleFieldDescriptors(
  command: DebugCommandDescriptor,
  context: DebugCommandFormContext,
): DebugCommandFieldDescriptor[] {
  return (command.fields ?? []).filter((field) => field.isVisible?.(context) ?? true)
}

function redactArgs(
  command: DebugCommandDescriptor,
  parsedArgs: Record<string, unknown>,
): Record<string, unknown> {
  const redactedFields = new Set(
    (command.fields ?? [])
      .filter((field) => field.redact)
      .map((field) => field.key),
  )

  return Object.fromEntries(
    Object.entries(parsedArgs).map(([key, value]) => (
      redactedFields.has(key)
        ? [key, '<redacted>']
        : [key, value]
    )),
  )
}

function isMutatingSafety(safety: DebugCommandSafety): boolean {
  return safety === 'support-mutation' || safety === 'dangerous-mutation'
}

function buildExecutionContext(options: ExecuteOptions): DebugCommandExecuteContext {
  return {
    access: options.access ?? getCachedDebugConsoleAccess(),
    currentScreen: options.currentScreen ?? readCurrentScreen(),
  }
}

function tokenizeDebugConsoleText(text: string): string[] {
  const tokens = text.match(/"[^"]*"|'[^']*'|\S+/g) ?? []
  return tokens.map((token) => {
    if (
      (token.startsWith('"') && token.endsWith('"'))
      || (token.startsWith('\'') && token.endsWith('\''))
    ) {
      return token.slice(1, -1)
    }

    return token
  })
}

function parseTextArgs(command: DebugCommandDescriptor, text: string): Record<string, unknown> {
  const tokens = tokenizeDebugConsoleText(text)
  const [, ...argTokens] = tokens
  const args: Record<string, unknown> = {}
  const orderedFields = command.fields ?? []
  let positionalIndex = 0

  for (const token of argTokens) {
    const equalsIndex = token.indexOf('=')
    if (equalsIndex > 0) {
      const key = token.slice(0, equalsIndex)
      const value = token.slice(equalsIndex + 1)
      args[key] = value
      continue
    }

    const field = orderedFields[positionalIndex]
    if (!field) {
      continue
    }

    args[field.key] = token
    positionalIndex += 1
  }

  return args
}

async function resolveAccess(options: ExecuteOptions): Promise<DebugConsoleAccess> {
  if (options.access) {
    return options.access
  }

  return normalizeDebugConsoleAccess().catch(() => createDebugConsoleAccess('anonymous'))
}

function validateCommandAccess(command: DebugCommandDescriptor, access: DebugConsoleAccess): string | null {
  if (!command.minimumRole) {
    return null
  }

  if (canAccessAtLeast(access.role, command.minimumRole)) {
    return null
  }

  return `Command requires ${command.minimumRole} access.`
}

function validateCommandVisibility(
  command: DebugCommandDescriptor,
  context: DebugCommandFormContext,
): string | null {
  if (command.isVisible && !command.isVisible(context)) {
    return 'Command is not visible in the current context.'
  }

  if (command.isEnabled && !command.isEnabled(context)) {
    return 'Command is currently disabled.'
  }

  return null
}

function maybeConfirmDangerousCommand(command: DebugCommandDescriptor): boolean {
  if (command.safety !== 'dangerous-mutation' || !command.confirm) {
    return true
  }

  if (typeof window.confirm !== 'function') {
    return true
  }

  return window.confirm(command.confirm.message)
}

async function executeDebugCommand(
  command: DebugCommandDescriptor,
  rawArgs: Record<string, unknown>,
  options: ExecuteOptions,
): Promise<DebugConsoleExecutionResult> {
  const access = await resolveAccess(options)
  const accessError = validateCommandAccess(command, access)
  if (accessError) {
    return {
      status: 'error',
      commandId: command.id,
      error: accessError,
    }
  }

  const visibilityContext = getCommandFormContext(rawArgs, {
    ...options,
    access,
  })
  const visibilityError = validateCommandVisibility(command, visibilityContext)
  if (visibilityError) {
    return {
      status: 'error',
      commandId: command.id,
      error: visibilityError,
    }
  }

  const parseResult = command.schema.safeParse(rawArgs)
  if (!parseResult.success) {
    return {
      status: 'error',
      commandId: command.id,
      error: formatZodError(parseResult.error),
    }
  }

  if (!maybeConfirmDangerousCommand(command)) {
    return {
      status: 'error',
      commandId: command.id,
      error: 'Command cancelled.',
    }
  }

  const executionContext = buildExecutionContext({ ...options, access })
  const parsedArgs = parseResult.data as Record<string, unknown>
  const safety = command.safety ?? 'diagnostic'

  try {
    const result = await command.execute(parsedArgs, executionContext)
    const logEntry: DebugConsoleExecutionLogEntry = {
      commandId: command.id,
      status: 'success',
      timestamp: Date.now(),
      role: access.role,
      safety,
      args: redactArgs(command, parsedArgs),
      result,
    }
    appendExecutionLog(logEntry)
    if (isMutatingSafety(safety)) {
      RundotAPI.log('[Debug Console] Command execution', logEntry)
    }
    return {
      status: 'success',
      commandId: command.id,
      result,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const logEntry: DebugConsoleExecutionLogEntry = {
      commandId: command.id,
      status: 'error',
      timestamp: Date.now(),
      role: access.role,
      safety,
      args: redactArgs(command, parsedArgs),
      error: message,
    }
    appendExecutionLog(logEntry)
    if (isMutatingSafety(safety)) {
      RundotAPI.log('[Debug Console] Command execution', logEntry)
    }
    RundotAPI.error('[Debug Console] Command failed', error)
    return {
      status: 'error',
      commandId: command.id,
      error: message,
    }
  }
}

export function clearDebugConsoleExecutionLog(): void {
  executionLog.length = 0
  listeners.forEach((listener) => listener())
}

export function getDebugConsoleExecutionLog(): DebugConsoleExecutionLogEntry[] {
  return [...executionLog]
}

export function getVisibleDebugConsoleCommandIds(
  access: DebugConsoleAccess = getCachedDebugConsoleAccess(),
): string[] {
  return getVisibleDebugConsoleCommands(access).map((command) => command.id)
}

export function getVisibleDebugConsoleCommands(
  access: DebugConsoleAccess = getCachedDebugConsoleAccess(),
): DebugCommandDescriptor[] {
  return flattenCommands().filter((command) => {
    if (command.minimumRole && !canAccessAtLeast(access.role, command.minimumRole)) {
      return false
    }

    const visibilityContext = getCommandFormContext({}, { access })
    return validateCommandVisibility(command, visibilityContext) === null
  })
}

export function subscribeToDebugConsoleExecutionLog(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function executeDebugConsoleCommandById(
  commandId: string,
  rawArgs: Record<string, unknown>,
  options: ExecuteOptions = {},
): Promise<DebugConsoleExecutionResult> {
  const command = findCommand(commandId)
  if (!command) {
    return {
      status: 'error',
      commandId,
      error: `Unknown command: ${commandId}`,
    }
  }

  return executeDebugCommand(command, rawArgs, options)
}

export async function executeDebugConsoleTextCommand(
  text: string,
  options: ExecuteOptions = {},
): Promise<DebugConsoleExecutionResult> {
  const tokens = tokenizeDebugConsoleText(text.trim())
  const commandName = tokens[0]
  if (!commandName) {
    return {
      status: 'error',
      commandId: '',
      error: 'Command text is empty.',
    }
  }

  const command = findCommand(commandName)
  if (!command) {
    return {
      status: 'error',
      commandId: commandName,
      error: `Unknown command: ${commandName}`,
    }
  }

  return executeDebugCommand(command, parseTextArgs(command, text), options)
}

export async function resolveDebugCommandFields(
  commandId: string,
  rawArgs: Record<string, unknown>,
  options: ExecuteOptions = {},
): Promise<Array<DebugCommandFieldDescriptor & { enabled: boolean; options: { label: string; value: string }[] }>> {
  const command = findCommand(commandId)
  if (!command) {
    return []
  }

  const context = getCommandFormContext(rawArgs, {
    ...options,
    access: options.access ?? getCachedDebugConsoleAccess(),
  })

  const fields = getVisibleFieldDescriptors(command, context)
  return Promise.all(fields.map(async (field) => ({
    ...field,
    enabled: field.isEnabled?.(context) ?? true,
    options: field.getOptions ? await field.getOptions(context) : [],
  })))
}

export function applyDebugCommandFieldValue(
  commandId: string,
  rawArgs: Record<string, unknown>,
  fieldKey: string,
  nextValue: unknown,
  options: ExecuteOptions = {},
): Record<string, unknown> {
  const command = findCommand(commandId)
  if (!command) {
    return rawArgs
  }

  const nextArgs = {
    ...rawArgs,
    [fieldKey]: nextValue,
  }
  const context = getCommandFormContext(nextArgs, {
    ...options,
    access: options.access ?? getCachedDebugConsoleAccess(),
  })
  const field = (command.fields ?? []).find((candidate) => candidate.key === fieldKey)
  const patch = field?.onValueChanged?.({
    ...context,
    nextValue,
  })

  return patch
    ? { ...nextArgs, ...patch }
    : nextArgs
}
