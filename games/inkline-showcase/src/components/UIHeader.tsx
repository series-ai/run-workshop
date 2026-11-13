import type { FC } from 'react'
import { EXTRA_LAYOUTS } from '../runtime/layouts'
import type { StageSettings, StageStats, CameraMode, ViewMode } from '../types'
import {
  IconCamera,
  IconWireframe,
  IconOutlines,
  IconReset,
} from './UIIcons'

export interface HeaderProps {
  settings: StageSettings
  stats: StageStats | null
  hasStats: boolean
  onUpdateSettings: (updater: (prev: StageSettings) => StageSettings) => void
  onResetStage: () => void
  onToggleInspectorMobile: () => void
  isInspectorOpenMobile: boolean
  focused: boolean
  onToggleFocus: () => void
}

const CAMERA_MODES: { id: CameraMode; label: string; short: string }[] = [
  { id: 'perspective', label: 'Perspective', short: 'PER' },
  { id: 'side', label: 'Side', short: 'SIDE' },
  { id: 'top', label: 'Top-Down', short: 'TOP' },
  { id: 'third-person', label: 'Third-Person', short: '3RD' },
]

const MODE_LABELS: Record<ViewMode, { title: string; subtitle: string }> = {
  overview: { title: 'Overview', subtitle: 'Showcase' },
  assets: { title: 'Catalog', subtitle: 'Models & Props' },
  avatars: { title: 'Avatar Lab', subtitle: 'Customization' },
  animations: { title: 'Motion', subtitle: 'Clips' },
  effects: { title: 'VFX', subtitle: 'Presets' },
  district: { title: 'District', subtitle: 'Level' },
  combat: { title: 'Combat', subtitle: 'Arena' },
  parkour: { title: 'Parkour', subtitle: 'Course' },
  performance: { title: 'Benchmark', subtitle: 'Stress' },
}

export const UIHeader: FC<HeaderProps> = ({
  settings,
  stats,
  hasStats,
  onUpdateSettings,
  onResetStage,
  onToggleInspectorMobile,
  isInspectorOpenMobile,
  focused,
  onToggleFocus,
}) => {
  const currentModeInfo = MODE_LABELS[settings.mode] ?? {
    title: settings.mode.toUpperCase(),
    subtitle: 'VIEWPORT',
  }

  const title = settings.mode === 'district' ? EXTRA_LAYOUTS.find(layout => layout.id === settings.districtLayout)?.label ?? currentModeInfo.title : currentModeInfo.title

  const setCamera = (camera: CameraMode) => {
    onUpdateSettings((prev) => ({ ...prev, camera }))
  }

  const toggleWireframe = () => {
    onUpdateSettings((prev) => ({ ...prev, wireframe: !prev.wireframe }))
  }

  const toggleOutlines = () => {
    onUpdateSettings((prev) => ({ ...prev, outlines: !prev.outlines }))
  }

  const toggleQuality = () => {
    onUpdateSettings((prev) => ({
      ...prev,
      quality: prev.quality === 'mobile' ? 'high' : 'mobile',
    }))
  }

  return (
    <header className="ink-header" aria-label="Showcase Controls Header">
      <div className="ink-header-mode-info">
        <span className="ink-header-mode-badge">{settings.mode}</span>
        <div className="ink-header-text">
          <h1 className="ink-header-title">{title}</h1>
          <span className="ink-header-subtitle">{currentModeInfo.subtitle}</span>
        </div>
      </div>

      <div className="ink-header-controls">
        {/* Camera Selector */}
        <div className="ink-control-group" role="group" aria-label="Camera Controls">
          <span className="ink-group-label" aria-hidden="true">
            <IconCamera size={14} /> CAM
          </span>
          <div className="ink-segmented-control">
            {CAMERA_MODES.map((cam) => (
              <button
                key={cam.id}
                type="button"
                className={`ink-segmented-btn ${settings.camera === cam.id ? 'active' : ''}`}
                onClick={() => setCamera(cam.id)}
                aria-pressed={settings.camera === cam.id}
                aria-label={cam.label}
                title={`Switch camera to ${cam.label}`}
              >
                <span className="ink-cam-full">{cam.label}</span>
                <span className="ink-cam-short">{cam.short}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Viewport Toggles: Wireframe, Outlines, Quality */}
        <div className="ink-control-group" role="group" aria-label="Rendering Toggles">
          <button
            type="button"
            className={`ink-toggle-btn ${settings.wireframe ? 'active' : ''}`}
            onClick={toggleWireframe}
            aria-pressed={settings.wireframe}
            title="Toggle Wireframe mode"
          >
            <IconWireframe size={15} />
            <span>Wire</span>
          </button>

          <button
            type="button"
            className={`ink-toggle-btn ${settings.outlines ? 'active' : ''}`}
            onClick={toggleOutlines}
            aria-pressed={settings.outlines}
            title="Toggle Inked Contours & Outlines"
          >
            <IconOutlines size={15} />
            <span>Outlines</span>
          </button>

          <button
            type="button"
            className={`ink-toggle-btn quality ${settings.quality === 'high' ? 'active' : ''}`}
            onClick={toggleQuality}
            aria-pressed={settings.quality === 'high'}
            title={`Switch graphics quality (Current: ${settings.quality})`}
          >
            <span className="ink-quality-label">Q:</span>
            <span className="ink-quality-val">{settings.quality.toUpperCase()}</span>
          </button>
        </div>

        {/* Live FPS metric chip (render only when stats received) */}
        {hasStats && stats ? (
          <div className="ink-header-stat-chip" title="Realtime FPS from 3D stage">
            <span className="ink-stat-num">{stats.fps.toFixed(0)}</span>
            <span className="ink-stat-unit">FPS</span>
          </div>
        ) : null}

        {/* Global Reset */}
        <button type="button" className="ink-icon-action-btn ink-focus-button" onClick={onToggleFocus} aria-pressed={focused} aria-label={focused ? 'Exit stage view' : 'Expand stage'} title={focused ? 'Exit stage view (Escape)' : 'Expand stage'}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={focused ? 'M1 6h5V1m9 5h-5V1M1 10h5v5m9-5h-5v5' : 'M6 1H1v5m9-5h5v5M1 10v5h5m9-5v5h-5'} /></svg>
        </button>
        <button
          type="button"
          className="ink-icon-action-btn"
          onClick={onResetStage}
          title="Reset stage state and view"
          aria-label="Reset stage"
        >
          <IconReset size={16} />
        </button>

        {/* Mobile Inspector Drawer Toggle */}
        <button
          type="button"
          className={`ink-mobile-inspector-toggle ${isInspectorOpenMobile ? 'open' : ''}`}
          onClick={onToggleInspectorMobile}
          aria-expanded={isInspectorOpenMobile}
          aria-label={isInspectorOpenMobile ? 'Close control panel' : 'Open control panel'}
        >
          <span className="ink-mobile-toggle-text">
            {isInspectorOpenMobile ? 'Close Panel' : 'Panel'}
          </span>
        </button>
      </div>
    </header>
  )
}
