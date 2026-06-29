/**
 * CollapsibleFxPanel — wraps the FxPanel in a collapsible shell.
 *
 *   collapsed: a thin "FX" toggle pill at the bottom (~36px). Tap to open.
 *   expanded:  toggle + tab bar + XY pad below. Eased height transition
 *              so the grid above squishes smoothly into the freed space.
 */

import { useState, type CSSProperties } from 'react'
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react'
import { FxPanel } from './FxPanel'

export function CollapsibleFxPanel() {
  const [open, setOpen] = useState(false)

  const containerStyle: CSSProperties = {
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    transition: 'gap 220ms ease-out',
  }

  const toggleStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '7px 14px',
    minHeight: 34,
    borderRadius: 'var(--radius-md, 12px)',
    background: open ? 'var(--ui-color-accent-soft)' : 'var(--ui-panel-section-fill)',
    border: `1px solid ${open ? 'var(--ui-color-accent, var(--ui-text-strong))' : 'var(--ui-panel-section-border)'}`,
    color: open ? 'var(--ui-text-strong)' : 'var(--ui-text-muted)',
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition:
      'background 200ms ease-out, ' +
      'border-color 200ms ease-out, ' +
      'color 200ms ease-out',
  }

  const panelWrapperStyle: CSSProperties = {
    overflow: 'hidden',
    maxHeight: open ? 360 : 0,
    opacity: open ? 1 : 0,
    transform: open ? 'translateY(0)' : 'translateY(-4px)',
    transition:
      'max-height 320ms cubic-bezier(0.4, 0, 0.2, 1), ' +
      'opacity 220ms ease-out, ' +
      'transform 260ms ease-out',
    pointerEvents: open ? 'auto' : 'none',
  }

  return (
    <div data-testid="collapsible-fx-panel" data-fx-open={open ? 'true' : 'false'} style={containerStyle}>
      <button
        type="button"
        data-testid="collapsible-fx-toggle"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        style={toggleStyle}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <SlidersHorizontal size={12} aria-hidden />
          FX
        </span>
        {open ? <ChevronDown size={14} aria-hidden /> : <ChevronUp size={14} aria-hidden />}
      </button>
      <div style={panelWrapperStyle}>
        <FxPanel />
      </div>
    </div>
  )
}
