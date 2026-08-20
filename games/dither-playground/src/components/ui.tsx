// ── Shared UI primitives & theme tokens ────────────────────────────────
// "Retro phosphor terminal": near-black background, Game Boy phosphor-green
// accents, monospace display labels. No webfonts — system stacks only.

import { useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

export const colors = {
  bg: '#0d0f0a',
  panel: '#14170d',
  panelAlt: '#1a1d14',
  border: '#2c3320',
  accent: '#9bbc0f',
  accentHi: '#c4d64a',
  accentMuted: '#306230',
  text: '#e8ecc8',
  textDim: '#9aa17b',
  error: '#e0a03c',
} as const;

export const fonts = {
  mono: "ui-monospace, 'SF Mono', Menlo, monospace",
  sans: "system-ui, 'Segoe UI', Roboto, sans-serif",
} as const;

/** Tracks pointer hover for inline-style components (no :hover in inline styles). */
export function useHover() {
  const [hovered, setHovered] = useState(false);
  return {
    hovered,
    hoverProps: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
    },
  } as const;
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
        ? 'rgba(155, 188, 15, 0.08)'
        : 'transparent',
    color: active ? colors.bg : hovered ? colors.accentHi : colors.textDim,
    transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
  };
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function Button({ active = false, style, ...rest }: ButtonProps) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      type="button"
      {...hoverProps}
      {...rest}
      style={{ ...buttonStyle(active, hovered), ...style }}
    />
  );
}

export interface FileButtonProps {
  accept: string;
  onFile: (file: File) => void;
  children: ReactNode;
}

/** Ghost chip wrapping a hidden file input (labels can't be <button>s). */
export function FileButton({ accept, onFile, children }: FileButtonProps) {
  const { hovered, hoverProps } = useHover();
  return (
    <label {...hoverProps} style={buttonStyle(false, hovered)}>
      {children}
      <input
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </label>
  );
}

/** Shared chrome for the persistent media toolbars in Image/Video demos. */
export const toolbarStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  padding: '10px 12px',
  background: colors.panel,
  borderBottom: `1px solid ${colors.border}`,
};

export const errorTextStyle: CSSProperties = {
  color: colors.error,
  fontFamily: fonts.mono,
  fontSize: 11,
  letterSpacing: '0.06em',
};
