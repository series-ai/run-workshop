import { useState, useEffect, useCallback, useMemo, type FC } from 'react'
import type { StageSettings, StageStats, PackManifest, ViewMode, AvatarConfig } from './types'
import { DEFAULT_SETTINGS } from './types'
import { Stage } from './components/Stage'
import { EFFECTS } from './runtime/effects'
import { parseManifest } from './catalog'
import { validateAvatar } from './runtime/physics'
import { UINavRail } from './components/UINavRail'
import { UIHeader } from './components/UIHeader'
import { UIInspector } from './components/UIInspector'
import { UIDocsModal } from './components/UIDocsModal'
import { UICombatControls } from './components/UICombatControls'
import type { EffectEntry } from './components/UIEffectsBrowser'

const STORAGE_KEY_AVATAR = 'inkline_avatar_v1'

/**
 * Safe local storage reader for AvatarConfig using consolidated runtime validator
 */
function loadSavedAvatar(): AvatarConfig | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AVATAR)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return validateAvatar(parsed)
  } catch {
    // Storage access restricted or invalid
  }
  return null
}

/**
 * Safe local storage writer for AvatarConfig
 */
function saveAvatarToStorage(avatar: AvatarConfig): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY_AVATAR, JSON.stringify(avatar))
  } catch {
    // Storage quota or privacy restrictions
  }
}

export const App: FC = () => {
  // Main settings state with immutable updates
  const [settings, setSettings] = useState<StageSettings>(() => {
    const savedAvatar = loadSavedAvatar()
    if (savedAvatar) {
      return {
        ...DEFAULT_SETTINGS,
        modelId: savedAvatar.preset,
        avatar: savedAvatar,
      }
    }
    return DEFAULT_SETTINGS
  })

  // Live real telemetry from Stage (no fake placeholder stats)
  const [stats, setStats] = useState<StageStats | null>(null)
  const [hasStats, setHasStats] = useState(false)

  // Manifest loading and boundary state
  const [manifest, setManifest] = useState<PackManifest | null>(null)
  const [isLoadingManifest, setIsLoadingManifest] = useState(true)
  const [manifestError, setManifestError] = useState<string | null>(null)

  // Keep the stage visible when the phone view opens.
  const [isDocsOpen, setIsDocsOpen] = useState(false)
  const [isInspectorOpenMobile, setIsInspectorOpenMobile] = useState(false)
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    const exit = (event: KeyboardEvent) => { if (event.key === 'Escape') setFocused(false) }
    window.addEventListener('keydown', exit)
    return () => window.removeEventListener('keydown', exit)
  }, [])

  // Effects list safely handled
  const effectsList: EffectEntry[] = useMemo(() => {
    return Array.isArray(EFFECTS) ? EFFECTS : []
  }, [])

  // Manifest loader with retry boundary
  const fetchManifest = useCallback(async () => {
    setIsLoadingManifest(true)
    setManifestError(null)

    try {
      const response = await fetch('./assets/manifest.json')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} (${response.statusText})`)
      }

      const json = parseManifest(await response.json())

      setManifest(json)

      // Validate saved avatar and model IDs against loaded manifest
      setSettings((prev) => {
        const characters = new Set(
          json.models.filter((m) => m.kind === 'character').map((m) => m.id)
        )
        const props = new Set(
          json.models.filter((m) => m.kind === 'prop' && m.tags.includes('held')).map((m) => m.id)
        )
        const allModels = new Set(json.models.map((m) => m.id))

        let avatarChanged = false
        let validPreset = prev.avatar.preset
        let validEquipment = prev.avatar.equipment

        if (!characters.has(validPreset)) {
          validPreset = 'stick-standard'
          avatarChanged = true
        }
        if (validEquipment !== null && !props.has(validEquipment)) {
          validEquipment = null
          avatarChanged = true
        }

        let validModelId = prev.modelId
        if (!allModels.has(validModelId)) {
          validModelId = validPreset
        }

        if (!avatarChanged && validModelId === prev.modelId) {
          return prev
        }

        return {
          ...prev,
          modelId: validModelId,
          avatar: {
            ...prev.avatar,
            preset: validPreset,
            equipment: validEquipment,
          },
        }
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setManifestError(`Asset manifest unavailable at ./assets/manifest.json: ${msg}`)
    } finally {
      setIsLoadingManifest(false)
    }
  }, [])

  useEffect(() => {
    void fetchManifest()
  }, [fetchManifest])

  // Persist avatar changes safely to localStorage
  useEffect(() => {
    saveAvatarToStorage(settings.avatar)
  }, [settings.avatar])

  // Real stats callback from 3D stage
  const handleStats = useCallback((newStats: StageStats) => {
    setStats(newStats)
    setHasStats(true)
  }, [])

  // Immutable settings updater
  const updateSettings = useCallback(
    (updater: (prev: StageSettings) => StageSettings) => {
      setSettings(prev => {
        const next = updater(prev)
        if (next.mode === prev.mode) return next
        return { ...next, playing: true, camera: next.mode === 'combat' || next.mode === 'parkour' ? 'third-person' : 'perspective' }
      })
    },
    []
  )

  // Mode selection helper
  const handleSelectMode = useCallback((mode: ViewMode) => {
    updateSettings((prev) => ({ ...prev, mode }))
    // On mobile, auto-close or open inspector sensibly
    if (mode === 'combat' || mode === 'parkour') {
      setIsInspectorOpenMobile(false)
    }
  }, [updateSettings])

  useEffect(() => { if (settings.mode === 'combat' || settings.mode === 'parkour') setIsInspectorOpenMobile(false) }, [settings.mode])

  // Stage reset helper
  const handleResetStage = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      reset: prev.reset + 1,
    }))
  }, [])

  return (
    <div className={`ink-app-container${focused ? ' ink-focus' : ''}`}>
      {/* Column 1: Slim Rail Navigation */}
      <UINavRail
        currentMode={settings.mode}
        onSelectMode={handleSelectMode}
        manifest={manifest}
        effectsCount={effectsList.length}
        onResetStage={handleResetStage}
        onOpenDocs={() => setIsDocsOpen(true)}
      />

      {/* Main View Area: Header, 3D Stage Canvas, and Overlays */}
      <main className="ink-main-viewport">
        <UIHeader
          settings={settings}
          stats={stats}
          hasStats={hasStats}
          onUpdateSettings={updateSettings}
          onResetStage={handleResetStage}
          onToggleInspectorMobile={() => setIsInspectorOpenMobile((prev) => !prev)}
          isInspectorOpenMobile={isInspectorOpenMobile}
          focused={focused}
          onToggleFocus={() => { setFocused(value => !value); setIsInspectorOpenMobile(false) }}
        />

        {/* 3D Stage Viewport (Render Stage ONLY when manifest has loaded and validated) */}
        <div className="ink-stage-wrapper">
          {isLoadingManifest && (
            <div className="ink-stage-screen-overlay ink-stage-loading" role="status">
              <div className="ink-spinner" aria-hidden="true" />
              <h2 className="ink-stage-status-title">Loading Asset Manifest</h2>
              <p className="ink-stage-status-desc">
                Loading the pack catalog...
              </p>
            </div>
          )}

          {!isLoadingManifest && manifestError && (
            <div className="ink-stage-screen-overlay ink-stage-error" role="alert">
              <div className="ink-stage-error-icon" aria-hidden="true">⚠️</div>
              <h2 className="ink-stage-status-title">Asset Manifest Unavailable</h2>
              <p className="ink-stage-status-desc">{manifestError}</p>
              <button
                type="button"
                className="ink-btn ink-btn-primary"
                onClick={() => void fetchManifest()}
              >
                Retry Loading Manifest
              </button>
            </div>
          )}

          {!isLoadingManifest && manifest && (
            <>
              <Stage
                settings={settings}
                manifest={manifest}
                onStats={handleStats}
              />

              {/* Real-time scene loading indicator overlay from StageStats */}
              {stats?.loading && (
                <div className="ink-stage-loading-indicator" role="status" aria-label="Loading scene">
                  <span className="ink-spinner-sm" aria-hidden="true" />
                  <span className="ink-loading-label">Loading Scene...</span>
                </div>
              )}

              {/* Real-time runtime error overlay from StageStats (stats.error) */}
              {stats?.error && (
                <div className="ink-stage-notice-overlay ink-stage-runtime-error" role="alert">
                  <div className="ink-runtime-error-info">
                    <span className="ink-runtime-error-tag">VIEWPORT ERROR</span>
                    <span className="ink-runtime-error-msg">{stats.error}</span>
                  </div>
                  <div className="ink-runtime-error-actions">
                    <button
                      type="button"
                      className="ink-btn ink-btn-sm ink-btn-primary"
                      onClick={handleResetStage}
                    >
                      Reset Stage
                    </button>
                    <button
                      type="button"
                      className="ink-btn ink-btn-sm ink-btn-secondary"
                      onClick={() => window.location.reload()}
                    >
                      Reload Page
                    </button>
                  </div>
                </div>
              )}

              {/* On-stage Combat / Parkour Gamepad Overlay for direct play interaction */}
              {(settings.mode === 'combat' || settings.mode === 'parkour') && (
                <div className="ink-stage-gamepad-overlay">
                  <UICombatControls
                    mode={settings.mode}
                    stats={stats}
                    onResetStage={handleResetStage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Column 3: Context-sensitive Inspector Panel */}
      <UIInspector
        settings={settings}
        stats={stats}
        hasStats={hasStats}
        manifest={manifest}
        effects={effectsList}
        effectsCount={effectsList.length}
        isLoadingManifest={isLoadingManifest}
        manifestError={manifestError}
        onRetryManifest={fetchManifest}
        onUpdateSettings={updateSettings}
        onResetStage={handleResetStage}
        onOpenDocs={() => setIsDocsOpen(true)}
        isMobileOpen={isInspectorOpenMobile}
        onCloseMobile={() => setIsInspectorOpenMobile(false)}
      />

      {/* In-app Documentation & Contract Modal */}
      <UIDocsModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} />
    </div>
  )
}
