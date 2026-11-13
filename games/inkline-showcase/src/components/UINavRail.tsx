import type { FC } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { ViewMode, PackManifest } from '../types'
import {
  IconOverview,
  IconAssets,
  IconAvatar,
  IconAnimation,
  IconEffects,
  IconDistrict,
  IconCombat,
  IconParkour,
  IconPerformance,
  IconInfo,
  IconReset,
} from './UIIcons'

export interface NavRailProps {
  currentMode: ViewMode
  onSelectMode: (mode: ViewMode) => void
  manifest: PackManifest | null
  effectsCount: number
  onResetStage: () => void
  onOpenDocs: () => void
}

interface NavItem {
  id: ViewMode
  label: string
  shortLabel: string
  Icon: FC<{ size?: number; className?: string }>
  group: 'explore' | 'motion' | 'world' | 'play' | 'diagnostic'
  getCount?: (manifest: PackManifest | null, effectsCount: number) => number | string
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    shortLabel: 'Home',
    Icon: IconOverview,
    group: 'explore',
  },
  {
    id: 'assets',
    label: 'Model Catalog',
    shortLabel: 'Assets',
    Icon: IconAssets,
    group: 'explore',
    getCount: (m) => (m ? m.models.length : '—'),
  },
  {
    id: 'avatars',
    label: 'Avatar Lab',
    shortLabel: 'Avatar',
    Icon: IconAvatar,
    group: 'explore',
    getCount: (m) => {
      const chars = m?.models.filter((x) => x.kind === 'character')
      return chars ? chars.length : '—'
    },
  },
  {
    id: 'animations',
    label: 'Animation Library',
    shortLabel: 'Motion',
    Icon: IconAnimation,
    group: 'motion',
    getCount: (m) => (m ? m.animations.length : '—'),
  },
  {
    id: 'effects',
    label: 'VFX Catalog',
    shortLabel: 'Effects',
    Icon: IconEffects,
    group: 'motion',
    getCount: (_, ec) => ec,
  },
  {
    id: 'district',
    label: 'District Scene',
    shortLabel: 'District',
    Icon: IconDistrict,
    group: 'world',
    getCount: () => '3 Scenes',
  },
  {
    id: 'combat',
    label: 'Combat Arena',
    shortLabel: 'Combat',
    Icon: IconCombat,
    group: 'play',
    getCount: () => 'Play',
  },
  {
    id: 'parkour',
    label: 'Parkour Trial',
    shortLabel: 'Parkour',
    Icon: IconParkour,
    group: 'play',
    getCount: () => 'Play',
  },
  {
    id: 'performance',
    label: 'Performance Stress',
    shortLabel: 'Perf',
    Icon: IconPerformance,
    group: 'diagnostic',
    getCount: () => 'Stress',
  },
]

export const UINavRail: FC<NavRailProps> = ({
  currentMode,
  onSelectMode,
  manifest,
  effectsCount,
  onResetStage,
  onOpenDocs,
}) => {
  const activeItemRef = useRef<HTMLButtonElement | null>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches)

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [currentMode])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)')
    const update = () => setIsMobile(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  const selectWithFocus = (index: number) => {
    const item = NAV_ITEMS[index]
    if (!item) return
    onSelectMode(item.id)
    const button = itemRefs.current[index]
    button?.focus()
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const previousKey = isMobile ? 'ArrowLeft' : 'ArrowUp'
    const nextKey = isMobile ? 'ArrowRight' : 'ArrowDown'
    let nextIndex: number | null = null
    if (event.key === previousKey) nextIndex = (index - 1 + NAV_ITEMS.length) % NAV_ITEMS.length
    else if (event.key === nextKey) nextIndex = (index + 1) % NAV_ITEMS.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = NAV_ITEMS.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    selectWithFocus(nextIndex)
  }

  return (
    <aside className="ink-nav-rail" aria-label="Main Navigation">
      <div className="ink-brand-header">
        <div className="ink-brand-mark">
          <span className="ink-mark-bars" aria-hidden="true" />
          <span className="ink-brand-name">INKLINE</span>
        </div>
        <div className="ink-brand-sub">STICK FIGURE WORKS</div>
      </div>

      <div className="ink-nav-scroll-cue ink-nav-scroll-cue-left" aria-hidden="true">‹</div>

      <nav className="ink-nav-list" role="tablist" aria-orientation={isMobile ? 'horizontal' : 'vertical'}>
        {NAV_ITEMS.map((item, index) => {
          const isActive = currentMode === item.id
          const count = item.getCount ? item.getCount(manifest, effectsCount) : null
          const ItemIcon = item.Icon

          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              id={`tab-${item.id}`}
              aria-selected={isActive}
              aria-controls="panel-view"
              tabIndex={isActive ? 0 : -1}
              className={`ink-nav-item ${isActive ? 'active' : ''}`}
              ref={(button) => {
                itemRefs.current[index] = button
                if (isActive) activeItemRef.current = button
              }}
              onClick={() => onSelectMode(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              title={`${item.label}${count !== null ? ` (${count})` : ''}`}
            >
              <span className="ink-nav-icon-wrap" aria-hidden="true">
                <ItemIcon size={18} />
              </span>
              <span className="ink-nav-label-group">
                <span className="ink-nav-title">{item.label}</span>
                <span className="ink-nav-short-title">{item.shortLabel}</span>
              </span>
              {count !== null && <span className="ink-nav-count-badge">{count}</span>}
            </button>
          )
        })}
      </nav>

      <div className="ink-nav-scroll-cue ink-nav-scroll-cue-right" aria-hidden="true">
        <span>SWIPE</span>
        <span className="ink-nav-scroll-arrow">›</span>
      </div>

      <div className="ink-nav-footer">
        <button
          type="button"
          className="ink-nav-action-btn"
          onClick={onResetStage}
          title="Reset 3D camera and runtime stage"
          aria-label="Reset Stage"
        >
          <IconReset size={16} />
          <span className="ink-action-label">Reset Stage</span>
        </button>

        <button
          type="button"
          className="ink-nav-action-btn"
          onClick={onOpenDocs}
          title="View pack specification and UI contract"
          aria-label="View UI Contract & Docs"
        >
          <IconInfo size={16} />
          <span className="ink-action-label">Pack Docs</span>
        </button>
      </div>
    </aside>
  )
}
