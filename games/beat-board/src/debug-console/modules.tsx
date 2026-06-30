import {
  canAccessAtLeast,
  getCachedDebugConsoleAccess,
  type DebugConsoleAccess,
} from './access'
import { getDebugConsoleBinding } from './bindings'
import type {
  DebugConsoleBootstrapContext,
  DebugConsoleModule,
  DebugConsoleModuleFactoryExport,
} from './types'

type Listener = () => void
type DebugConsoleModuleSourceLoader = () => Promise<DebugConsoleModuleFactoryExport>
type DebugConsoleModuleSourceEntry = DebugConsoleModuleFactoryExport | DebugConsoleModuleSourceLoader
type DebugConsoleModuleSourceMap = Record<string, DebugConsoleModuleSourceEntry>

const listeners = new Set<Listener>()
const registry = new Map<string, DebugConsoleModule>()

const DISCOVERED_DEBUG_CONSOLE_MODULE_LOADERS = import.meta.glob<DebugConsoleModuleFactoryExport>(
  [
    '../**/*.debug-console.ts',
    '../**/*.debug-console.tsx',
  ],
)

let moduleSourceOverride: DebugConsoleModuleSourceMap | null = null
let discoveredModulesLoaded = false
let moduleLoadPromise: Promise<void> | null = null

function readCurrentScreen(): string {
  return window.__GAME_DEBUG__?.ui.getCurrentScreen() ?? 'none'
}

function createBootstrapContext(): DebugConsoleBootstrapContext {
  return {
    getAccess: () => getCachedDebugConsoleAccess(),
    getCurrentScreen: () => readCurrentScreen(),
    getBinding: (id) => getDebugConsoleBinding(id),
  }
}

function notify(): void {
  listeners.forEach((listener) => listener())
}

function sortModules(modules: Iterable<DebugConsoleModule>): DebugConsoleModule[] {
  return [...modules].sort((left, right) => {
    const leftOrder = left.order ?? 0
    const rightOrder = right.order ?? 0

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    return left.id.localeCompare(right.id)
  })
}

function getModuleSources(): DebugConsoleModuleSourceMap {
  return moduleSourceOverride ?? DISCOVERED_DEBUG_CONSOLE_MODULE_LOADERS
}

function normalizeFactoryResult(
  result: ReturnType<NonNullable<DebugConsoleModuleFactoryExport['createDebugConsoleModule']>>,
): DebugConsoleModule[] {
  if (!result) {
    return []
  }

  return Array.isArray(result) ? result : [result]
}

function hydrateDiscoveredModules(sources: DebugConsoleModuleSourceMap): DebugConsoleModule[] {
  const bootstrapContext = createBootstrapContext()
  const modules: DebugConsoleModule[] = []

  Object.values(sources).forEach((source) => {
    if (typeof source === 'function') {
      return
    }

    if (typeof source.createDebugConsoleModule !== 'function') {
      return
    }

    modules.push(...normalizeFactoryResult(source.createDebugConsoleModule(bootstrapContext)))
  })

  return sortModules(modules)
}

async function resolveModuleSources(
  sources: DebugConsoleModuleSourceMap,
): Promise<Record<string, DebugConsoleModuleFactoryExport>> {
  const entries = await Promise.all(
    Object.entries(sources).map(async ([key, source]) => {
      if (typeof source === 'function') {
        return [key, await source()] as const
      }

      return [key, source] as const
    }),
  )

  return Object.fromEntries(entries)
}

export function listDebugConsoleModules(): DebugConsoleModule[] {
  return sortModules(registry.values())
}

export function areDebugConsoleModulesLoaded(): boolean {
  return discoveredModulesLoaded
}

export function getVisibleDebugConsoleModules(
  access: DebugConsoleAccess | null = getCachedDebugConsoleAccess(),
): DebugConsoleModule[] {
  const effectiveAccess = access ?? getCachedDebugConsoleAccess()

  return listDebugConsoleModules().filter((module) => {
    if (!module.minimumRole) {
      return true
    }

    return canAccessAtLeast(effectiveAccess.role, module.minimumRole)
  })
}

export function registerDebugConsoleModule(module: DebugConsoleModule): () => void {
  registry.set(module.id, module)
  notify()

  return () => {
    registry.delete(module.id)
    notify()
  }
}

export function unregisterDebugConsoleModule(id: string): void {
  if (!registry.has(id)) {
    return
  }

  registry.delete(id)
  notify()
}

export function resetDebugConsoleModules(): void {
  registry.clear()
  discoveredModulesLoaded = false
  moduleLoadPromise = null
  notify()
}

export async function ensureDebugConsoleModulesLoaded(): Promise<void> {
  if (discoveredModulesLoaded) {
    return
  }

  if (moduleLoadPromise) {
    await moduleLoadPromise
    return
  }

  moduleLoadPromise = (async () => {
    const resolvedSources = await resolveModuleSources(getModuleSources())
    hydrateDiscoveredModules(resolvedSources).forEach((module) => {
      registry.set(module.id, module)
    })
    discoveredModulesLoaded = true
    moduleLoadPromise = null
    notify()
  })()

  await moduleLoadPromise
}

export function subscribeToDebugConsoleModules(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setDebugConsoleModuleSourcesForTesting(
  sources: DebugConsoleModuleSourceMap | null,
): void {
  moduleSourceOverride = sources
}

resetDebugConsoleModules()
