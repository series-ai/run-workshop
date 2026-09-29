import type { FC } from 'react'
import type { StageSettings, StageStats, PackManifest, ViewMode } from '../types'
import { UIOverview } from './UIOverview'
import { UIAssetBrowser } from './UIAssetBrowser'
import { UIAvatarEditor } from './UIAvatarEditor'
import { UIAnimationPlayer } from './UIAnimationPlayer'
import { UIEffectsBrowser, type EffectEntry } from './UIEffectsBrowser'
import { UIDistrictControls } from './UIDistrictControls'
import { UICombatControls } from './UICombatControls'
import { UIPerformancePanel } from './UIPerformancePanel'
import { IconClose } from './UIIcons'
import { animationPreviewEquipment } from '../runtime/presentation'

export interface InspectorProps {
  settings: StageSettings
  stats: StageStats | null
  hasStats: boolean
  manifest: PackManifest | null
  effects: EffectEntry[]
  effectsCount: number
  isLoadingManifest: boolean
  manifestError: string | null
  onRetryManifest: () => void
  onUpdateSettings: (updater: (prev: StageSettings) => StageSettings) => void
  onResetStage: () => void
  onOpenDocs: () => void
  isMobileOpen: boolean
  onCloseMobile: () => void
}

export const UIInspector: FC<InspectorProps> = ({
  settings,
  stats,
  hasStats,
  manifest,
  effects,
  effectsCount,
  isLoadingManifest,
  manifestError,
  onRetryManifest,
  onUpdateSettings,
  onResetStage,
  onOpenDocs,
  isMobileOpen,
  onCloseMobile,
}) => {
  const setMode = (mode: ViewMode) => {
    onUpdateSettings((prev) => ({ ...prev, mode }))
    if (isMobileOpen) onCloseMobile()
  }

  const renderContent = () => {
    switch (settings.mode) {
      case 'overview':
        return (
          <UIOverview
            manifest={manifest}
            effectsCount={effectsCount}
            onNavigate={setMode}
            onOpenDocs={onOpenDocs}
          />
        )

      case 'assets':
        return (
          <UIAssetBrowser
            manifest={manifest}
            selectedModelId={settings.modelId}
            onSelectModel={(id) => onUpdateSettings((prev) => ({ ...prev, modelId: id }))}
            isLoading={isLoadingManifest}
            error={manifestError}
            onRetry={onRetryManifest}
          />
        )

      case 'avatars':
        return (
          <UIAvatarEditor
            avatar={settings.avatar}
            onUpdateAvatar={(updater) =>
              onUpdateSettings((prev) => ({ ...prev, avatar: updater(prev.avatar) }))
            }
            onSelectModelId={(modelId) =>
              onUpdateSettings((prev) => ({ ...prev, modelId }))
            }
            manifest={manifest}
            onReset={() =>
              onUpdateSettings((prev) => ({
                ...prev,
                avatar: {
                  preset: 'stick-standard',
                  color: '#151716',
                  accent: '#d45538',
                  height: 1,
                  thickness: 1,
                  headScale: 1,
                  headwear: 'none',
                  equipment: null,
                },
              }))
            }
          />
        )

      case 'animations':
        return (
          <UIAnimationPlayer
            manifest={manifest}
            animationId={settings.animationId}
            equipment={settings.avatar.equipment}
            onChangeEquipment={equipment => onUpdateSettings(prev => ({ ...prev, avatar: { ...prev.avatar, equipment } }))}
            onSelectAnimation={(id) =>
              onUpdateSettings((prev) => ({ ...prev, animationId: id, seek: null, avatar: { ...prev.avatar, equipment: animationPreviewEquipment(id) } }))
            }
            playing={settings.playing}
            onTogglePlay={() =>
              onUpdateSettings((prev) => ({ ...prev, playing: !prev.playing, seek: null }))
            }
            onSeek={(time) => onUpdateSettings(prev => ({ ...prev, seek: time, playing: false }))}
            seek={settings.seek}
            speed={settings.speed}
            onChangeSpeed={(speed) => onUpdateSettings((prev) => ({ ...prev, speed }))}
            stats={stats}
          />
        )

      case 'effects':
        return (
          <UIEffectsBrowser
            effects={effects}
            selectedEffectId={settings.effectId}
            onSelectEffect={(id) => onUpdateSettings((prev) => ({ ...prev, effectId: id }))}
            onTriggerEffect={() =>
              onUpdateSettings((prev) => ({ ...prev, trigger: prev.trigger + 1 }))
            }
            triggerCount={settings.trigger}
            accentColor={settings.effectColor}
            scale={settings.effectScale}
            lifetime={settings.effectLifetime}
            onChangeScale={effectScale => onUpdateSettings(prev => ({ ...prev, effectScale, trigger: prev.trigger + 1 }))}
            onChangeLifetime={effectLifetime => onUpdateSettings(prev => ({ ...prev, effectLifetime, trigger: prev.trigger + 1 }))}
            onChangeAccentColor={(color) =>
              onUpdateSettings((prev) => ({
                ...prev,
                effectColor: color,
                trigger: prev.trigger + 1,
              }))
            }
          />
        )

      case 'district':
        return (
          <UIDistrictControls
            layout={settings.districtLayout}
            onSelectLayout={districtLayout => onUpdateSettings(prev => ({ ...prev, districtLayout }))}
            ambientEffects={settings.ambientEffects}
            onToggleAmbientEffects={() => onUpdateSettings(prev => ({ ...prev, ambientEffects: !prev.ambientEffects }))}
            industrialCount={manifest?.models.filter(model => model.category === 'industrial').length ?? 0}
            camera={settings.camera}
            onSelectCamera={(camera) => onUpdateSettings((prev) => ({ ...prev, camera }))}
            wireframe={settings.wireframe}
            onToggleWireframe={() =>
              onUpdateSettings((prev) => ({ ...prev, wireframe: !prev.wireframe }))
            }
            outlines={settings.outlines}
            onToggleOutlines={() =>
              onUpdateSettings((prev) => ({ ...prev, outlines: !prev.outlines }))
            }
            onResetStage={onResetStage}
          />
        )

      case 'combat':
      case 'parkour':
        return (
          <UICombatControls
            mode={settings.mode}
            stats={stats}
            onResetStage={onResetStage}
          />
        )

      case 'performance':
        return (
          <UIPerformancePanel
            figureCount={settings.figureCount}
            onChangeFigureCount={(count) =>
              onUpdateSettings((prev) => ({ ...prev, figureCount: count }))
            }
            effectCount={settings.effectCount}
            onChangeEffectCount={(count) =>
              onUpdateSettings((prev) => ({ ...prev, effectCount: count }))
            }
            quality={settings.quality}
            onChangeQuality={(quality) =>
              onUpdateSettings((prev) => ({ ...prev, quality }))
            }
            stats={stats}
            hasStats={hasStats}
            settings={settings}
          />
        )

      default:
        return null
    }
  }

  return (
    <aside
      id="panel-view"
      role="tabpanel"
      aria-labelledby={`tab-${settings.mode}`}
      className={`ink-inspector-panel ${isMobileOpen ? 'mobile-open' : ''}`}
      aria-label="Mode Inspector and Controls"
    >
      <div className="ink-inspector-mobile-header">
        <span className="ink-inspector-mobile-title">{settings.mode.toUpperCase()}</span>
        <button
          type="button"
          className="ink-icon-btn"
          onClick={onCloseMobile}
          aria-label="Close panel"
        >
          <IconClose size={18} />
        </button>
      </div>

      <div className="ink-inspector-content">
        {['overview', 'combat', 'parkour', 'animations'].includes(settings.mode) && <section className="ink-motion-controls" aria-label="Action presentation">
          <label className="ink-field-label" htmlFor="ink-motion-style">Motion accents</label>
          <select id="ink-motion-style" className="ink-select" value={settings.motion} onChange={event => onUpdateSettings(previous => ({ ...previous, motion: event.target.value === 'reduced' ? 'reduced' : 'full' }))}>
            <option value="full">Full</option><option value="reduced">Reduced</option>
          </select>
          <p>Reduced removes trails and extra camera motion. Hits and movement stay the same. Your device setting also applies.</p>
        </section>}
        {renderContent()}
      </div>
    </aside>
  )
}
