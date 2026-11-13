import { useState, useMemo, useId, type FC, type ChangeEvent } from 'react'
import type { PackManifest, AnimationEntry, StageStats } from '../types'
import { IconPlay, IconPause, IconSearch } from './UIIcons'

export interface AnimationPlayerProps {
  manifest: PackManifest | null
  animationId: string
  equipment: string | null
  onChangeEquipment: (equipment: string | null) => void
  onSelectAnimation: (id: string) => void
  playing: boolean
  onTogglePlay: () => void
  speed: number
  seek: number | null
  onChangeSpeed: (speed: number) => void
  onSeek: (time: number) => void
  stats: StageStats | null
}

const SPEED_PRESETS = [0.25, 0.5, 1.0, 1.5, 2.0]

export const UIAnimationPlayer: FC<AnimationPlayerProps> = ({
  manifest,
  animationId,
  equipment, onChangeEquipment,
  onSelectAnimation,
  playing,
  onTogglePlay,
  speed,
  seek,
  onChangeSpeed,
  stats,
  onSeek,
}) => {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const speedSliderId = useId()
  const equipmentId = useId()

  const animations: AnimationEntry[] = useMemo(() => {
    return manifest?.animations ?? []
  }, [manifest])

  const categories = useMemo(() => {
    const set = new Set<string>()
    animations.forEach((a) => {
      if (a.category) set.add(a.category)
    })
    return Array.from(set).sort()
  }, [animations])

  const filteredAnimations = useMemo(() => {
    const q = search.trim().toLowerCase()
    return animations.filter((a) => {
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false
      if (q) {
        const matchLabel = a.label.toLowerCase().includes(q)
        const matchId = a.id.toLowerCase().includes(q)
        if (!matchLabel && !matchId) return false
      }
      return true
    })
  }, [animations, categoryFilter, search])

  const currentClip = useMemo(() => {
    return animations.find((a) => a.id === animationId) ?? animations[0]
  }, [animations, animationId])

  // Real progress calculation via stats.elapsed % duration
  const duration = currentClip ? Math.max(0.01, currentClip.duration) : 1.0
  const elapsed = !playing && seek !== null ? seek : stats?.elapsed ?? 0
  const progressRatio = (elapsed % duration) / duration
  const currentTime = progressRatio * duration

  return (
    <div className="ink-anim-panel" aria-label="Animation Library and Playback Controller">
      {/* Current Clip Playback Deck */}
      <section className="ink-playback-deck">
        <div className="ink-playback-header">
          <div className="ink-playback-meta">
            <span className="ink-clip-badge">{currentClip?.category ?? 'MOTION'}</span>
            <h3 className="ink-clip-title">{currentClip?.label ?? animationId}</h3>
            <span className="ink-clip-id">{animationId}</span>
          </div>

          <button
            type="button"
            className={`ink-play-btn ${playing ? 'playing' : 'paused'}`}
            onClick={onTogglePlay}
            aria-label={playing ? 'Pause animation playback' : 'Play animation'}
          >
            {playing ? <IconPause size={20} /> : <IconPlay size={20} />}
          </button>
        </div>

        {/* Real Progress Bar */}
        <div className="ink-progress-wrap">
          <div
            className="ink-progress-bar"
            role="progressbar"
            aria-valuenow={Math.round(progressRatio * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Animation clip progress"
          >
            <div
              className="ink-progress-fill"
              style={{ width: `${(progressRatio * 100).toFixed(1)}%` }}
            />
          </div>
          <div className="ink-progress-labels">
            <span className="ink-timecode">
              {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
            </span>
            <span className="ink-loop-badge">
              {currentClip?.loop ? 'LOOPING' : 'ONE-SHOT · REPEATING PREVIEW'}
            </span>
          </div>
        </div>

        <label className="ink-field-label" htmlFor="animation-seek">Animation position</label>
        <input id="animation-seek" className="ink-range-slider" type="range" min="0" max={duration} step="0.01" value={currentTime} onChange={event => onSeek(Number(event.target.value))} />

        {/* Speed Controls: 0.25 - 2.0 */}
        <div className="ink-speed-control-group">
          <div className="ink-speed-header">
            <label htmlFor={speedSliderId} className="ink-field-label">
              Playback Speed:
            </label>
            <span className="ink-speed-val">{speed.toFixed(2)}×</span>
          </div>

          <input
            id={speedSliderId}
            type="range"
            min="0.25"
            max="2.00"
            step="0.05"
            className="ink-range-slider"
            value={speed}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChangeSpeed(parseFloat(e.target.value))
            }
          />

          <div className="ink-speed-presets" role="group" aria-label="Speed presets">
            {SPEED_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`ink-chip ${speed === p ? 'active' : ''}`}
                onClick={() => onChangeSpeed(p)}
              >
                {p}×
              </button>
            ))}
          </div>
        </div>
      </section>

      {currentClip?.travelSpeed && <p className="ink-field-label">This clip plays in place. The support foot moves backward while the body stays at the center.</p>}

      <section className="ink-control-section">
        <label className="ink-section-title" htmlFor={equipmentId}>Preview equipment</label>
        <select id={equipmentId} className="ink-select" value={equipment ?? ''} onChange={event => onChangeEquipment(event.target.value || null)}>
          <option value="">Unarmed</option>
          {manifest?.models.filter(model => model.tags.includes('held')).map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
        </select>
      </section>

      {/* Clip Library Filters & Search */}
      <section className="ink-clips-section">
        <div className="ink-section-header">
          <span className="ink-section-title">
            {animations.length} MOTION CLIPS ({filteredAnimations.length})
          </span>
        </div>

        <div className="ink-search-bar">
          <IconSearch size={14} className="ink-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="ink-search-input"
            placeholder="Search movement, combat, reactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search animation clips"
          />
        </div>

        {categories.length > 0 && (
          <div className="ink-category-chips" role="group" aria-label="Filter animations by category">
            <button
              type="button"
              className={`ink-chip ${categoryFilter === 'all' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('all')}
            >
              ALL ({animations.length})
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

        {/* Clip list */}
        <div className="ink-clips-list" role="listbox" aria-label="Animation Clips">
          {filteredAnimations.length === 0 ? (
            <div className="ink-empty-state-sm">
              <p>No clips match filter.</p>
            </div>
          ) : (
            filteredAnimations.map((clip) => {
              const isSelected = clip.id === animationId
              return (
                <button
                  key={clip.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`ink-clip-row ${isSelected ? 'active' : ''}`}
                  onClick={() => onSelectAnimation(clip.id)}
                >
                  <img className="ink-clip-preview" src={`./assets/previews/animation-${clip.id}.png`} alt="" loading="lazy" />
                  <div className="ink-clip-row-left">
                    <span className="ink-clip-name">{clip.label}</span>
                    <span className="ink-clip-code">{clip.id}</span>
                  </div>
                  <div className="ink-clip-row-right">
                    <span className="ink-clip-dur">{clip.duration.toFixed(2)}s</span>
                    <span className="ink-clip-cat">{clip.category}</span>
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
