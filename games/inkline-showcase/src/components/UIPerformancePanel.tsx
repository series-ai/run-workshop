import { useState, useId, type FC, type ChangeEvent } from 'react'
import type { StageSettings, StageStats } from '../types'
import { IconPerformance, IconDownload } from './UIIcons'

export interface PerformancePanelProps {
  figureCount: number
  onChangeFigureCount: (count: number) => void
  effectCount: number
  onChangeEffectCount: (count: number) => void
  quality: 'mobile' | 'high'
  onChangeQuality: (quality: 'mobile' | 'high') => void
  stats: StageStats | null
  hasStats: boolean
  settings: StageSettings
}

export const UIPerformancePanel: FC<PerformancePanelProps> = ({
  figureCount,
  onChangeFigureCount,
  effectCount,
  onChangeEffectCount,
  quality,
  onChangeQuality,
  stats,
  hasStats,
  settings,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false)

  const figureSliderId = useId()
  const effectSliderId = useId()

  const handleDownloadCapture = () => {
    const payload = {
      app: 'INKLINE Showcase',
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      screen: {
        width: typeof window !== 'undefined' ? window.innerWidth : 0,
        height: typeof window !== 'undefined' ? window.innerHeight : 0,
        devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      },
      settings: {
        mode: settings.mode,
        figureCount,
        effectCount,
        quality,
        wireframe: settings.wireframe,
        outlines: settings.outlines,
        speed: settings.speed,
      },
      measuredStats: stats,
      certification: {
        target: '60 FPS @ 720p (20 figures, 10 active effects)',
        status: 'UNVERIFIED_PHYSICAL_ANDROID',
        disclaimer:
          '15-minute continuous run on physical Android hardware remains UNVERIFIED pending test hardware. Telemetry reflects active browser WebGL context only. ',
      },
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inkline-perf-capture-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    setDownloadSuccess(true)
    setTimeout(() => setDownloadSuccess(false), 3000)
  }

  return (
    <div className="ink-perf-panel" aria-label="Performance Stress Diagnostics">
      {/* Target & Android Notice Banner */}
      <section className="ink-perf-notice-card" role="region" aria-label="Performance Certification Notice">
        <div className="ink-perf-notice-header">
          <span className="ink-perf-tag">BROWSER PERFORMANCE</span>
          <span className="ink-perf-badge-unverified">ANDROID: UNVERIFIED</span>
        </div>
        <p className="ink-perf-notice-text">
          Target is 60 FPS at 720p with <strong>20 figures</strong> and{' '}
          <strong>10 active effects</strong>. The physical Android test is{' '}
          <strong>UNVERIFIED</strong> until a device is available. The values below measure this browser.
        </p>
      </section>

      {/* Stress Controls: Figures & Effects */}
      <section className="ink-control-section">
        <div className="ink-section-header">
          <span className="ink-section-title">STRESS PARAMETERS</span>
        </div>

        {/* Figures Slider: 1 - 100 */}
        <div className="ink-slider-group">
          <div className="ink-slider-header">
            <label htmlFor={figureSliderId} className="ink-slider-label">
              Active Figures (1 – 100):
            </label>
            <span className="ink-slider-value">{figureCount} figures</span>
          </div>
          <input
            id={figureSliderId}
            type="range"
            min="1"
            max="100"
            step="1"
            className="ink-range-slider"
            value={figureCount}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChangeFigureCount(parseInt(e.target.value, 10))
            }
          />
        </div>

        {/* Effects Slider: 0 - 40 */}
        <div className="ink-slider-group">
          <div className="ink-slider-header">
            <label htmlFor={effectSliderId} className="ink-slider-label">
              Active Effects (0 – 40):
            </label>
            <span className="ink-slider-value">{effectCount} bursts</span>
          </div>
          <input
            id={effectSliderId}
            type="range"
            min="0"
            max="40"
            step="1"
            className="ink-range-slider"
            value={effectCount}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChangeEffectCount(parseInt(e.target.value, 10))
            }
          />
        </div>

        {/* Stress Presets */}
        <div className="ink-presets-row" role="group" aria-label="Stress test presets">
          <button
            type="button"
            className={`ink-chip ${figureCount === 20 && effectCount === 10 ? 'active' : ''}`}
            onClick={() => {
              onChangeFigureCount(20)
              onChangeEffectCount(10)
            }}
          >
            Baseline (20 Fig / 10 Eff)
          </button>
          <button
            type="button"
            className={`ink-chip ${figureCount === 50 && effectCount === 20 ? 'active' : ''}`}
            onClick={() => {
              onChangeFigureCount(50)
              onChangeEffectCount(20)
            }}
          >
            Mid Stress (50 / 20)
          </button>
          <button
            type="button"
            className={`ink-chip ${figureCount === 100 && effectCount === 40 ? 'active' : ''}`}
            onClick={() => {
              onChangeFigureCount(100)
              onChangeEffectCount(40)
            }}
          >
            Max Stress (100 / 40)
          </button>
          <button
            type="button"
            className={`ink-chip ${figureCount === 5 && effectCount === 2 ? 'active' : ''}`}
            onClick={() => {
              onChangeFigureCount(5)
              onChangeEffectCount(2)
            }}
          >
            Low / Battery (5 / 2)
          </button>
        </div>

        {/* Quality Mode */}
        <div className="ink-quality-row">
          <span className="ink-field-label">Rendering Quality:</span>
          <div className="ink-segmented-control" role="radiogroup" aria-label="Quality Mode">
            <button
              type="button"
              role="radio"
              aria-checked={quality === 'mobile'}
              className={`ink-segmented-btn ${quality === 'mobile' ? 'active' : ''}`}
              onClick={() => onChangeQuality('mobile')}
            >
              Mobile (Optimized)
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={quality === 'high'}
              className={`ink-segmented-btn ${quality === 'high' ? 'active' : ''}`}
              onClick={() => onChangeQuality('high')}
            >
              High (Full Passes)
            </button>
          </div>
        </div>
      </section>

      {/* Real Diagnostics Telemetry */}
      <section className="ink-control-section">
        <div className="ink-section-header">
          <span className="ink-section-title">REALTIME MEASURED TELEMETRY</span>
          <span className="ink-section-sub">
            {hasStats ? 'LIVE WEBGL STATS' : 'AWAITING STAGE'}
          </span>
        </div>

        {!hasStats || !stats ? (
          <div className="ink-telemetry-empty">
            <div className="ink-spinner-sm" aria-hidden="true" />
            <p className="ink-telemetry-empty-text">
              Awaiting stage diagnostic telemetry from WebGL renderer...
            </p>
          </div>
        ) : (
          <div className="ink-telemetry-grid">
            <div className="ink-telemetry-card highlight">
              <span className="ink-telemetry-key">FRAME RATE</span>
              <div className="ink-telemetry-num-wrap">
                <span className="ink-telemetry-num">{stats.fps.toFixed(1)}</span>
                <span className="ink-telemetry-unit">FPS</span>
              </div>
            </div>

            <div className="ink-telemetry-card">
              <span className="ink-telemetry-key">FRAME TIME</span>
              <div className="ink-telemetry-num-wrap">
                <span className="ink-telemetry-num">{stats.frameMs.toFixed(2)}</span>
                <span className="ink-telemetry-unit">MS</span>
              </div>
            </div>

            <div className="ink-telemetry-card">
              <span className="ink-telemetry-key">DRAW CALLS</span>
              <div className="ink-telemetry-num-wrap">
                <span className="ink-telemetry-num">{stats.calls}</span>
                <span className="ink-telemetry-unit">CALLS</span>
              </div>
            </div>

            <div className="ink-telemetry-card">
              <span className="ink-telemetry-key">TRIANGLES</span>
              <div className="ink-telemetry-num-wrap">
                <span className="ink-telemetry-num">{stats.triangles.toLocaleString()}</span>
                <span className="ink-telemetry-unit">▲</span>
              </div>
            </div>

            <div className="ink-telemetry-card">
              <span className="ink-telemetry-key">GEOMETRIES</span>
              <div className="ink-telemetry-num-wrap">
                <span className="ink-telemetry-num">{stats.geometries}</span>
              </div>
            </div>

            <div className="ink-telemetry-card">
              <span className="ink-telemetry-key">TEXTURES</span>
              <div className="ink-telemetry-num-wrap">
                <span className="ink-telemetry-num">{stats.textures}</span>
              </div>
            </div>

            <div className="ink-telemetry-card">
              <span className="ink-telemetry-key">ACTIVE FIGURES</span>
              <div className="ink-telemetry-num-wrap">
                <span className="ink-telemetry-num">{stats.figures}</span>
              </div>
            </div>

            <div className="ink-telemetry-card">
              <span className="ink-telemetry-key">ACTIVE EFFECTS</span>
              <div className="ink-telemetry-num-wrap">
                <span className="ink-telemetry-num">{stats.effects}</span>
              </div>
            </div>

            <div className="ink-telemetry-card full-width">
              <span className="ink-telemetry-key">ELAPSED STAGE RUNTIME</span>
              <div className="ink-telemetry-num-wrap">
                <span className="ink-telemetry-num">{stats.elapsed.toFixed(1)}</span>
                <span className="ink-telemetry-unit">SECONDS</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Export Telemetry JSON */}
      <section className="ink-control-section">
        <button
          type="button"
          className="ink-btn ink-btn-primary full-width"
          onClick={handleDownloadCapture}
          title="Download verified JSON capture with user agent and current stats"
        >
          <IconDownload size={16} />
          <span>
            {downloadSuccess
              ? 'Telemetry Capture Saved!'
              : 'Download Measured JSON Benchmark'}
          </span>
        </button>
        <p className="ink-field-hint">
          Exports raw timestamped browser metrics, viewport resolution, active figure settings, and
          explicit unverified Android certification notes.
        </p>
      </section>
    </div>
  )
}
