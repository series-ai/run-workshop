import type { FC } from 'react'
import type { ViewMode, PackManifest } from '../types'
import {
  IconAssets,
  IconDistrict,
  IconAvatar,
  IconAnimation,
  IconCombat,
  IconPerformance,
  IconInfo,
} from './UIIcons'

export interface OverviewProps {
  manifest: PackManifest | null
  effectsCount: number
  onNavigate: (mode: ViewMode) => void
  onOpenDocs: () => void
}

export const UIOverview: FC<OverviewProps> = ({
  manifest,
  effectsCount,
  onNavigate,
  onOpenDocs,
}) => {
  const charCount = manifest ? manifest.models.filter((m) => m.kind === 'character').length : 0
  const props = manifest ? manifest.models.filter((m) => m.kind === 'prop') : []
  const propCount = props.length
  const industrialCount = props.filter((p) => p.category.toLowerCase() === 'industrial').length
  const animCount = manifest?.animations.length ?? 0
  const version = manifest?.version || '1.0.0'

  return (
    <div className="ink-overview-panel">
      <button
        type="button"
        className="ink-overview-feature-action"
        onClick={() => onNavigate('combat')}
        aria-label="View action close up in Combat Arena"
      >
        <span className="ink-overview-feature-icon" aria-hidden="true"><IconCombat size={18} /></span>
        <span className="ink-overview-feature-copy">
          <strong>View action close up</strong>
          <small>Open Combat Arena</small>
        </span>
        <span className="ink-overview-feature-arrow" aria-hidden="true">→</span>
      </button>

      <div className="ink-overview-hero">
        <div className="ink-overview-badge">ORIGINAL DRAWN-STICK 3D ASSET PACK</div>
        <h1 className="ink-overview-masthead">INKLINE</h1>
        <div className="ink-overview-sub">STICK FIGURE WORKS</div>
        <p className="ink-overview-lead">
          Explore, customize, and test drawn stick figure 3D assets in real-time. Includes 12
          character models, {propCount ? `${propCount} modular props (${industrialCount} industrial pieces)` : 'modular props'},
          {animCount ? ` ${animCount} animations` : ' animations'}, and ink contour effects for Three.js.
        </p>

        <div className="ink-metrics-ticker" aria-label="Pack Specifications">
          <div className="ink-ticker-item">
            <span className="ink-ticker-val">{version}</span>
            <span className="ink-ticker-key">RELEASE</span>
          </div>
          <div className="ink-ticker-divider" aria-hidden="true" />
          <div className="ink-ticker-item">
            <span className="ink-ticker-val">{charCount || '—'}</span>
            <span className="ink-ticker-key">CHARACTERS</span>
          </div>
          <div className="ink-ticker-divider" aria-hidden="true" />
          <div className="ink-ticker-item">
            <span className="ink-ticker-val">{propCount || '—'}</span>
            <span className="ink-ticker-key">PROPS ({industrialCount} INDUSTRIAL)</span>
          </div>
          <div className="ink-ticker-divider" aria-hidden="true" />
          <div className="ink-ticker-item">
            <span className="ink-ticker-val">{animCount || '—'}</span>
            <span className="ink-ticker-key">ANIMATIONS</span>
          </div>
          <div className="ink-ticker-divider" aria-hidden="true" />
          <div className="ink-ticker-item">
            <span className="ink-ticker-val">{effectsCount}</span>
            <span className="ink-ticker-key">VFX PRESETS</span>
          </div>
        </div>
      </div>

      <div className="ink-overview-actions">
        <button
          type="button"
          className="ink-btn ink-btn-primary"
          onClick={() => onNavigate('assets')}
        >
          <IconAssets size={16} />
          <span>Explore Collection</span>
        </button>

        <button
          type="button"
          className="ink-btn ink-btn-secondary"
          onClick={() => onNavigate('district')}
        >
          <IconDistrict size={16} />
          <span>Enter District</span>
        </button>

        <button
          type="button"
          className="ink-btn ink-btn-secondary"
          onClick={() => onNavigate('avatars')}
        >
          <IconAvatar size={16} />
          <span>Avatar Lab</span>
        </button>

        <button
          type="button"
          className="ink-btn ink-btn-secondary"
          onClick={() => onNavigate('combat')}
        >
          <IconCombat size={16} />
          <span>Combat Arena</span>
        </button>

        <button
          type="button"
          className="ink-btn ink-btn-secondary"
          onClick={() => onNavigate('performance')}
        >
          <IconPerformance size={16} />
          <span>Stress Benchmark</span>
        </button>

        <button
          type="button"
          className="ink-btn ink-btn-secondary"
          onClick={() => onNavigate('animations')}
        >
          <IconAnimation size={16} />
          <span>Motion Library</span>
        </button>
      </div>

      <a className="ink-btn ink-btn-primary" href="https://github.com/series-ai/jam-ready-assets/tree/main/run-inkline" target="_blank" rel="noreferrer">Get the pack (jam-ready-assets) ↗</a>

      <div className="ink-overview-specs">
        <h2 className="ink-section-heading">WHAT YOU CAN DO</h2>
        <div className="ink-spec-grid">
          <div className="ink-spec-card">
            <span className="ink-spec-tag">CUSTOMIZE CHARACTERS</span>
            <h3 className="ink-spec-title">Avatar Lab</h3>
            <p className="ink-spec-desc">
              Select from 12 distinct character silhouettes, adjust stature, limb thickness,
              and head proportions, pick custom ink colors, and equip weapons and held gear.
            </p>
          </div>

          <div className="ink-spec-card">
            <span className="ink-spec-tag">BUILD ENVIRONMENTS</span>
            <h3 className="ink-spec-title">Modular Industrial Kit</h3>
            <p className="ink-spec-desc">
              Assemble scenes using {industrialCount || '—'} industrial architectural pieces: catwalks, staircases,
              ducts, pipes, structural beams, and factory machinery.
            </p>
          </div>

          <div className="ink-spec-card">
            <span className="ink-spec-tag">PREVIEW MOTION</span>
            <h3 className="ink-spec-title">Animation Library</h3>
            <p className="ink-spec-desc">
              Test {animCount || '—'} locomotion, combat, and acrobatic clips with playback rate controls,
              frame scrubbing, and live camera angle adjustments.
            </p>
          </div>

          <div className="ink-spec-card">
            <span className="ink-spec-tag">TEST & BENCHMARK</span>
            <h3 className="ink-spec-title">Interactive Traversal</h3>
            <p className="ink-spec-desc">
              Run and fight in real-time combat and parkour courses with keyboard or touch controls,
              or benchmark performance with up to 100 simultaneous figures.
            </p>
          </div>
        </div>
      </div>

      <div className="ink-overview-footer">
        <button type="button" className="ink-btn-text" onClick={onOpenDocs}>
          <IconInfo size={14} /> View Documentation & Technical Specs
        </button>
      </div>
    </div>
  )
}
