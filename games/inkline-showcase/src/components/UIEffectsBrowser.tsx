import { useState, useEffect, useMemo, type FC } from 'react'
import { IconEffects, IconSearch } from './UIIcons'

export interface EffectEntry {
  id: string
  label: string
  category: string
  duration: number
  description: string
}

export interface EffectsBrowserProps {
  effects: EffectEntry[]
  selectedEffectId: string
  onSelectEffect: (id: string) => void
  onTriggerEffect: () => void
  triggerCount: number
  accentColor: string
  onChangeAccentColor: (color: string) => void
  scale: number
  lifetime: number
  onChangeScale: (value: number) => void
  onChangeLifetime: (value: number) => void
}

export const UIEffectsBrowser: FC<EffectsBrowserProps> = ({
  effects,
  selectedEffectId,
  onSelectEffect,
  onTriggerEffect,
  triggerCount,
  accentColor,
  onChangeAccentColor,
  scale, lifetime, onChangeScale, onChangeLifetime,
}) => {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [autoCycle, setAutoCycle] = useState(false)
  const [cycleIntervalMs] = useState(1800)

  const categories = useMemo(() => {
    const set = new Set<string>()
    effects.forEach((eff) => {
      if (eff.category) set.add(eff.category)
    })
    return Array.from(set).sort()
  }, [effects])

  const filteredEffects = useMemo(() => {
    const q = search.trim().toLowerCase()
    return effects.filter((eff) => {
      if (categoryFilter !== 'all' && eff.category !== categoryFilter) return false
      if (q) {
        const matchLabel = eff.label.toLowerCase().includes(q)
        const matchId = eff.id.toLowerCase().includes(q)
        const matchDesc = eff.description.toLowerCase().includes(q)
        if (!matchLabel && !matchId && !matchDesc) return false
      }
      return true
    })
  }, [effects, categoryFilter, search])

  const currentEffect = useMemo(() => {
    return effects.find((eff) => eff.id === selectedEffectId) ?? effects[0]
  }, [effects, selectedEffectId])

  // Optional auto-cycle timer
  useEffect(() => {
    if (!autoCycle || filteredEffects.length === 0) return

    const timer = setInterval(() => {
      onTriggerEffect()
    }, cycleIntervalMs)

    return () => clearInterval(timer)
  }, [autoCycle, cycleIntervalMs, filteredEffects, onTriggerEffect])

  return (
    <div className="ink-effects-panel" aria-label="Procedural VFX Presets Browser">
      {/* Current Effect Trigger Deck */}
      <section className="ink-playback-deck">
        <div className="ink-playback-header">
          <div className="ink-playback-meta">
            <span className="ink-clip-badge">{currentEffect?.category ?? 'VFX'}</span>
            <h3 className="ink-clip-title">{currentEffect?.label ?? selectedEffectId}</h3>
            <span className="ink-clip-id">{selectedEffectId}</span>
          </div>

          <button
            type="button"
            className="ink-btn ink-btn-primary ink-trigger-btn"
            onClick={onTriggerEffect}
            title="Play this effect"
          >
            <IconEffects size={16} />
            <span>TRIGGER ({triggerCount})</span>
          </button>
        </div>

        {currentEffect && (
          <p className="ink-effect-desc">{currentEffect.description}</p>
        )}

        <div className="ink-effect-meta-row">
          <div className="ink-effect-stat">
            <span className="ink-stat-key">DURATION</span>
            <span className="ink-stat-val">{((currentEffect?.duration ?? 0.5) * lifetime).toFixed(2)}s</span>
          </div>
          <div className="ink-effect-stat">
            <span className="ink-stat-key">TRIGGER COUNT</span>
            <span className="ink-stat-val">{triggerCount}</span>
          </div>
          <div className="ink-effect-stat">
            <span className="ink-stat-key">COLOR TINT</span>
            <div className="ink-color-chip-inline">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => onChangeAccentColor(e.target.value)}
                className="ink-color-input-mini"
                aria-label="VFX Accent Color"
              />
              <span className="ink-hex-mini">{accentColor}</span>
            </div>
          </div>
        </div>

        <div className="ink-slider-group">
          <label className="ink-slider-label" htmlFor="effect-size">Effect size · {scale.toFixed(2)}×</label>
          <input id="effect-size" className="ink-range-slider" type="range" min="0.4" max="2.5" step="0.05" value={scale} onChange={event => onChangeScale(Number(event.target.value))} />
        </div>
        <div className="ink-slider-group">
          <label className="ink-slider-label" htmlFor="effect-lifetime">Effect lifetime · {lifetime.toFixed(2)}×</label>
          <input id="effect-lifetime" className="ink-range-slider" type="range" min="0.25" max="3" step="0.05" value={lifetime} onChange={event => onChangeLifetime(Number(event.target.value))} />
        </div>
        <a className="ink-btn ink-btn-secondary" href={`./assets/effects/${selectedEffectId}.png`} download>Download sprite sheet</a>
        <a className="ink-btn ink-btn-secondary" href="./assets/effects.json" download>Download all effect recipes</a>

        {/* Auto Cycle Option */}
        <div className="ink-autocycle-row">
          <label className="ink-checkbox-label">
            <input
              type="checkbox"
              checked={autoCycle}
              onChange={(e) => setAutoCycle(e.target.checked)}
              className="ink-checkbox"
            />
            <span>Auto-cycle trigger pulses (every {cycleIntervalMs / 1000}s)</span>
          </label>
        </div>
      </section>

      {/* Preset list and filters */}
      <section className="ink-clips-section">
        <div className="ink-section-header">
          <span className="ink-section-title">
            {effects.length} VFX PRESETS ({filteredEffects.length})
          </span>
        </div>

        <div className="ink-search-bar">
          <IconSearch size={14} className="ink-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="ink-search-input"
            placeholder="Search impacts, sparks, dust, blasts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search VFX presets"
          />
        </div>

        {categories.length > 0 && (
          <div className="ink-category-chips" role="group" aria-label="Filter effects by category">
            <button
              type="button"
              className={`ink-chip ${categoryFilter === 'all' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('all')}
            >
              ALL ({effects.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`ink-chip ${categoryFilter === cat ? 'active' : ''}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        <div className="ink-clips-list" role="listbox" aria-label="VFX Presets">
          {filteredEffects.length === 0 ? (
            <div className="ink-empty-state-sm">
              <p>No VFX presets found.</p>
            </div>
          ) : (
            filteredEffects.map((eff) => {
              const isSelected = eff.id === selectedEffectId
              return (
                <button
                  key={eff.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`ink-clip-row ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    onSelectEffect(eff.id)
                    onTriggerEffect()
                  }}
                >
                  <img className="ink-clip-preview" src={`./assets/previews/effect-${eff.id}.png`} alt="" loading="lazy" />
                  <div className="ink-clip-row-left">
                    <span className="ink-clip-name">{eff.label}</span>
                    <span className="ink-clip-code">{eff.description}</span>
                  </div>
                  <div className="ink-clip-row-right">
                    <span className="ink-clip-dur">{eff.duration.toFixed(2)}s</span>
                    <span className="ink-clip-cat">{eff.category}</span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
