// ── Shared UI primitives & theme tokens ────────────────────────────────
// "Card room": near-black chrome, casino-felt green tables, gold accents,
// monospace display labels. No webfonts — system stacks only.

import { useState } from 'react'
import type { ButtonHTMLAttributes, CSSProperties, SelectHTMLAttributes } from 'react'

export const colors = {
  bg: '#0a0e0c',
  panel: '#101715',
  panelAlt: '#16201c',
  border: '#233129',
  accent: '#d4af37',
  accentHi: '#f0d060',
  accentMuted: '#6b5a24',
  text: '#efe9d8',
  textDim: '#8fa091',
  error: '#e0a03c',
} as const

export const fonts = {
  mono: "ui-monospace, 'SF Mono', Menlo, monospace",
  sans: "system-ui, 'Segoe UI', Roboto, sans-serif",
} as const

// Radial casino-felt gradient used as the table surface in every scene.
export const feltStyle: CSSProperties = {
  background:
    'radial-gradient(ellipse at 50% 32%, #1e4d34 0%, #143726 48%, #081d13 100%)',
}

/** Tracks pointer hover for inline-style components (no :hover in inline styles). */
export function useHover() {
  const [hovered, setHovered] = useState(false)
  return {
    hovered,
    hoverProps: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
    },
  } as const
}

/** Bordered chip button: accent-filled when active, ghost otherwise. */
export function buttonStyle(active = false, hovered = false): CSSProperties {
  return {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: active ? 700 : 400,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    padding: '7px 14px',
    borderRadius: 3,
    cursor: 'pointer',
    border: `1px solid ${active ? (hovered ? colors.accentHi : colors.accent) : hovered ? colors.accentMuted : colors.border}`,
    background: active
      ? hovered
        ? colors.accentHi
        : colors.accent
      : hovered
        ? 'rgba(212, 175, 55, 0.08)'
        : 'transparent',
    color: active ? colors.bg : hovered ? colors.accentHi : colors.textDim,
    transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
  }
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

export function Button({ active = false, style, ...rest }: ButtonProps) {
  const { hovered, hoverProps } = useHover()
  return (
    <button
      type="button"
      {...hoverProps}
      {...rest}
      style={{ ...buttonStyle(active, hovered), ...style }}
    />
  )
}

export function Select({ style, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const { hovered, hoverProps } = useHover()
  return (
    <select
      {...hoverProps}
      {...props}
      style={{
        fontFamily: fonts.mono,
        fontSize: 11,
        letterSpacing: '0.06em',
        background: colors.panelAlt,
        color: colors.text,
        border: `1px solid ${hovered ? colors.accentMuted : colors.border}`,
        borderRadius: 3,
        padding: '6px 8px',
        cursor: 'pointer',
        ...style,
      }}
    />
  )
}

/** Mono micro-label for control groups. */
export function ControlLabel({ children }: { children: string }) {
  return (
    <span
      style={{
        fontFamily: fonts.mono,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: colors.accentMuted,
        alignSelf: 'center',
      }}
    >
      {children}
    </span>
  )
}

/** Shared chrome for the persistent per-scene toolbars. */
export const toolbarStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
  padding: '8px 14px',
  background: colors.panel,
  borderBottom: `1px solid ${colors.border}`,
  flexShrink: 0,
}
