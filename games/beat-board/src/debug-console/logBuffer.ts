/* eslint-disable no-console */
/**
 * Circular log buffer that captures `console.*` and the Rundot SDK's
 * `RundotAPI.log` / `error` / `warn` so a player on mobile can pop
 * the debug overlay and copy logs without a connected dev-tools.
 *
 * Install once at app boot via `installLogBuffer()`. Read with
 * `getCapturedLogs()`. Subscribe via `subscribeToLogBuffer()` for
 * live UI updates.
 */
import RundotAPI from '@series-inc/rundot-game-sdk/api'

const MAX_ENTRIES = 500

export interface CapturedLogEntry {
  ts: number
  level: 'log' | 'info' | 'warn' | 'error' | 'debug'
  source: 'console' | 'rundot'
  text: string
}

const buffer: CapturedLogEntry[] = []
const listeners = new Set<() => void>()
let installed = false

function notify(): void {
  listeners.forEach((cb) => {
    try {
      cb()
    } catch {
      // a single listener throwing must not stop others
    }
  })
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Error) {
    return value.stack ? `${value.name}: ${value.message}\n${value.stack}` : `${value.name}: ${value.message}`
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function append(level: CapturedLogEntry['level'], source: CapturedLogEntry['source'], args: unknown[]): void {
  const text = args.map(safeStringify).join(' ')
  buffer.push({ ts: Date.now(), level, source, text })
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES)
  notify()
}

export function installLogBuffer(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  // Tee console methods so devtools still see the messages.
  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  }
  console.log = (...args: unknown[]) => {
    append('log', 'console', args)
    original.log(...args)
  }
  console.info = (...args: unknown[]) => {
    append('info', 'console', args)
    original.info(...args)
  }
  console.warn = (...args: unknown[]) => {
    append('warn', 'console', args)
    original.warn(...args)
  }
  console.error = (...args: unknown[]) => {
    append('error', 'console', args)
    original.error(...args)
  }
  console.debug = (...args: unknown[]) => {
    append('debug', 'console', args)
    original.debug(...args)
  }

  // Tee RundotAPI logging surfaces.
  const api = RundotAPI as unknown as {
    log?: (...args: unknown[]) => void
    error?: (...args: unknown[]) => void
    warn?: (...args: unknown[]) => void
  }
  if (typeof api.log === 'function') {
    const orig = api.log.bind(api)
    api.log = (...args: unknown[]) => {
      append('log', 'rundot', args)
      orig(...args)
    }
  }
  if (typeof api.error === 'function') {
    const orig = api.error.bind(api)
    api.error = (...args: unknown[]) => {
      append('error', 'rundot', args)
      orig(...args)
    }
  }
  if (typeof api.warn === 'function') {
    const orig = api.warn.bind(api)
    api.warn = (...args: unknown[]) => {
      append('warn', 'rundot', args)
      orig(...args)
    }
  }
}

export function getCapturedLogs(): CapturedLogEntry[] {
  return buffer.slice()
}

export function clearCapturedLogs(): void {
  buffer.length = 0
  notify()
}

export function subscribeToLogBuffer(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function formatCapturedLogsForCopy(): string {
  return buffer
    .map((e) => {
      const t = new Date(e.ts).toISOString()
      return `[${t}] ${e.level.toUpperCase()} ${e.source}: ${e.text}`
    })
    .join('\n')
}
