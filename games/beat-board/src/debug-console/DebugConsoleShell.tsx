import { useEffect, useState } from 'react'
import { NavClose, Panel, Settings } from '@modules/ui/skin/semantic'
import appConfig from '../../config.json'
import type { DebugConsoleAccess } from './access'
import { normalizeDebugConsoleAccess } from './access'
import { subscribeToDebugConsoleBindings } from './bindings'
import { DebugCommandPalette } from './DebugCommandPalette'
import {
  getDebugConsoleState,
  subscribeToDebugConsole,
} from './controller'
import {
  areDebugConsoleModulesLoaded,
  ensureDebugConsoleModulesLoaded,
  getVisibleDebugConsoleModules,
  subscribeToDebugConsoleModules,
} from './modules'

function readCurrentScreen(): string {
  return window.__GAME_DEBUG__?.ui.getCurrentScreen() ?? 'none'
}

const releaseVersion = appConfig.appData.versionTag.trim()

export function DebugConsoleShell() {
  const [open, setOpen] = useState(() => getDebugConsoleState().open)
  const [access, setAccess] = useState<DebugConsoleAccess | null>(null)
  const [modulesReady, setModulesReady] = useState(() => areDebugConsoleModulesLoaded())
  const [registryVersion, setRegistryVersion] = useState(0)

  useEffect(() => {
    return subscribeToDebugConsole(() => {
      setOpen(getDebugConsoleState().open)
    })
  }, [])

  useEffect(() => {
    return subscribeToDebugConsoleModules(() => {
      setModulesReady(areDebugConsoleModulesLoaded())
      setRegistryVersion((version) => version + 1)
    })
  }, [])

  useEffect(() => {
    return subscribeToDebugConsoleBindings(() => {
      setRegistryVersion((version) => version + 1)
    })
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false
    void Promise.all([
      ensureDebugConsoleModulesLoaded(),
      normalizeDebugConsoleAccess(),
    ]).then(([, nextAccess]) => {
      if (!cancelled) {
        setModulesReady(true)
        setAccess(nextAccess)
      }
    })

    return () => {
      cancelled = true
    }
  }, [open])

  // Close on Escape — tap-on-content (not the backdrop) and "no
  // visible X" left the player with no way out on mobile/desktop
  // both. Backdrop click already worked but only when the player
  // hit the narrow strip outside the 420 px sheet.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') window.__GAME_DEBUG__?.console.close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <Panel.Sheet
      open={open}
      side="right"
      title="Debug Console"
      subtitle={`Runtime diagnostics · v${releaseVersion}`}
      data-testid="debug-console-shell"
      onBackdropClick={() => window.__GAME_DEBUG__?.console.close()}
      actions={
        <NavClose
          data-testid="debug-console-close"
          aria-label="Close debug console"
          onClick={() => window.__GAME_DEBUG__?.console.close()}
        />
      }
      style={{
        // Force the panel body to scroll. SkinSheet sets max-height
        // on the wrapper but the inner .ui-panel__body wasn't picking
        // up overflow:auto for the `sheet` variant, so long content
        // fell off the bottom with no way to reach it.
        overflowY: 'auto',
      }}
    >
      <DebugCommandPalette access={access} registryVersion={registryVersion} />
      {modulesReady ? (
        getVisibleDebugConsoleModules(access).map((module) => (
          <div key={module.id} data-debug-console-module-id={module.id}>
            {module.render({ access, currentScreen: readCurrentScreen() })}
          </div>
        ))
      ) : (
        <Settings.Section title="Loading">
          <span>Loading debug tools...</span>
        </Settings.Section>
      )}
    </Panel.Sheet>
  )
}
