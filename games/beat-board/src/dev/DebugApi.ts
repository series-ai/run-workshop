/**
 * DebugApi — exposes window.__GAME_DEBUG__ for Playwright e2e tests.
 *
 * The scaffold installs a minimal shell; builder-integrator extends it
 * with game-specific namespaces (stores, systems, debug getters).
 *
 * Call installDebugApi() from App.tsx inside `if (import.meta.env.DEV)`.
 */
import {
  clearDebugConsoleAccessOverride,
  getCachedDebugConsoleAccess,
  normalizeDebugConsoleAccess,
  setDebugConsoleAccessOverride,
  type DebugConsoleAccess,
  type DebugConsoleRole,
} from '../debug-console/access'
import {
  executeDebugConsoleCommandById,
  executeDebugConsoleTextCommand,
  getDebugConsoleExecutionLog,
  getVisibleDebugConsoleCommandIds,
} from '../debug-console/commands'
import {
  closeDebugConsole,
  isDebugConsoleOpen,
  openDebugConsole,
  toggleDebugConsole,
} from '../debug-console/controller'
import {
  ensureDebugConsoleModulesLoaded,
  getVisibleDebugConsoleModules,
} from '../debug-console/modules'
import { NAVIGATION } from '../tabs/tabConfig'
import { useNavigationStore } from '../stores/navigationStore'
import { tuningBridge } from '../tuning/bridge'

interface GameDebugAPIs {
  _version: () => string
  _isDebug: () => boolean
  console: {
    isOpen: () => boolean
    open: () => void
    close: () => void
    toggle: () => void
    getAccess: () => Promise<DebugConsoleAccess>
    getVisibleModuleIds: () => Promise<string[]>
    getVisibleCommandIds: () => Promise<string[]>
    executeCommandById: (commandId: string, args?: Record<string, unknown>) => Promise<unknown>
    executeTextCommand: (text: string) => Promise<unknown>
    getExecutionLog: () => unknown[]
    setAccessOverride: (role: DebugConsoleRole) => void
    clearAccessOverride: () => void
  }
  ui: {
    getCurrentScreen: () => string
    openScreen: (screen: string) => void
    closeScreen: () => void
    reset: () => void
  }
  tuning: {
    setEnabled: (enabled: boolean) => Promise<void>
    setValue: (id: string, value: unknown) => void
    isEnabled: () => boolean
    getRegisteredIds: () => string[]
    getValue: (id: string) => unknown
  }
  /**
   * Game-specific BeatBoard debug namespace. Installed by
   * `src/systems/debug-api.ts` (issue beat-board-02-rundot-sdk-integrator).
   * Optional here so tests can introspect the baseline shape before the
   * BeatBoard layer attaches.
   */
  beatboard?: import('../systems/debug-api').BeatBoardDebugApi
}

declare global {
  interface Window {
    __GAME_DEBUG__: GameDebugAPIs
  }
}

let currentScreen = 'none'
let accessReadyPromise: Promise<DebugConsoleAccess> | null = null

function ensureDebugConsoleAccessReady(): Promise<DebugConsoleAccess> {
  if (!accessReadyPromise) {
    accessReadyPromise = normalizeDebugConsoleAccess()
  }

  return accessReadyPromise
}

function refreshDebugConsoleAccessReady(): Promise<DebugConsoleAccess> {
  accessReadyPromise = normalizeDebugConsoleAccess()
  return accessReadyPromise
}

export function setCurrentScreen(screen: string): void {
  currentScreen = screen
}

export function installDebugApi(): void {
  void refreshDebugConsoleAccessReady()

  window.__GAME_DEBUG__ = {
    _version: () => '1.0.0',
    _isDebug: () => true,
    console: {
      isOpen: () => isDebugConsoleOpen(),
      open: () => openDebugConsole(),
      close: () => closeDebugConsole(),
      toggle: () => toggleDebugConsole(),
      getAccess: () => ensureDebugConsoleAccessReady(),
      getVisibleModuleIds: async () => {
        const [access] = await Promise.all([
          ensureDebugConsoleAccessReady(),
          ensureDebugConsoleModulesLoaded(),
        ])
        return getVisibleDebugConsoleModules(access).map((module) => module.id)
      },
      getVisibleCommandIds: async () => {
        const [access] = await Promise.all([
          ensureDebugConsoleAccessReady(),
          ensureDebugConsoleModulesLoaded(),
        ])
        return getVisibleDebugConsoleCommandIds(access)
      },
      executeCommandById: async (commandId, args = {}) => {
        const [access] = await Promise.all([
          ensureDebugConsoleAccessReady(),
          ensureDebugConsoleModulesLoaded(),
        ])
        return executeDebugConsoleCommandById(commandId, args, { access })
      },
      executeTextCommand: async (text) => {
        const [access] = await Promise.all([
          ensureDebugConsoleAccessReady(),
          ensureDebugConsoleModulesLoaded(),
        ])
        return executeDebugConsoleTextCommand(text, { access })
      },
      getExecutionLog: () => getDebugConsoleExecutionLog(),
      setAccessOverride: (role) => {
        setDebugConsoleAccessOverride(role)
        accessReadyPromise = Promise.resolve(getCachedDebugConsoleAccess())
      },
      clearAccessOverride: () => {
        clearDebugConsoleAccessOverride()
        void refreshDebugConsoleAccessReady()
      },
    },
    tuning: tuningBridge,
    ui: {
      getCurrentScreen: () => currentScreen,
      openScreen: (screen: string) => {
        if (screen in NAVIGATION.screens) {
          useNavigationStore.getState().navigateTo(screen)
          const state = useNavigationStore.getState()
          currentScreen =
            (state.stack.length > 0 ? state.stack[state.stack.length - 1] : state.activeTab) ??
            screen
          return
        }
        currentScreen = screen
      },
      closeScreen: () => {
        useNavigationStore.getState().navigateBack()
        const state = useNavigationStore.getState()
        currentScreen =
          (state.stack.length > 0 ? state.stack[state.stack.length - 1] : state.activeTab) ?? 'none'
      },
      reset: () => {
        useNavigationStore.getState().navigateHome()
        currentScreen = NAVIGATION.initial
      },
    },
  }
}
