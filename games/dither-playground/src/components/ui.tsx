// ── Shared UI primitives & theme tokens ────────────────────────────────
// "Retro phosphor terminal": near-black background, Game Boy phosphor-green
// accents, monospace display labels. No webfonts — system stacks only.

import { createContext, useContext, useEffect, useState } from 'react';
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

/** True below the mobile breakpoint; reactive to viewport resize. */
export function useIsMobile(): boolean {
  const query = '(max-width: 700px)';
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

// ── Mobile controls drawer ────────────────────────────────────────────
// App owns the open state (the bottom task bar toggles it); each scene
// renders its own <ControlsDrawer> so its DitherControls state stays local.

export interface MobileDrawerState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const MobileDrawerContext = createContext<MobileDrawerState>({
  open: false,
  setOpen: () => {},
});

/**
 * Bottom sheet holding the scene's DitherControls on mobile. Always mounted
 * so the slide-up transition runs; inert (pointerEvents: none) when closed.
 * Tap the dimmed backdrop or the close row to dismiss.
 */
export function ControlsDrawer({ children }: { children: ReactNode }) {
  const { open, setOpen } = useContext(MobileDrawerContext);
  return (
    <>
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'rgba(7, 8, 4, 0.62)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 220ms ease',
        }}
      />
      <div
        role="dialog"
        aria-label="Controls"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '70dvh',
          background: colors.panel,
          borderTop: `1px solid ${colors.border}`,
          borderRadius: '10px 10px 0 0',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.55)',
          transform: open ? 'translateY(0)' : 'translateY(102%)',
          transition: 'transform 240ms cubic-bezier(0.32, 0.72, 0, 1)',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 14px',
            borderBottom: `1px solid ${colors.border}`,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: colors.border,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              flex: 1,
              fontFamily: fonts.mono,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: colors.accentMuted,
            }}
          >
            Controls
          </span>
          <Button onClick={() => setOpen(false)} style={{ padding: '4px 10px' }}>
            Close
          </Button>
        </div>
        <div
          style={{
            overflowY: 'auto',
            minHeight: 0,
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

/** Bottom task bar chrome (tabs + Controls toggle) on mobile. */
export const bottomBarStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'stretch',
  padding: '8px 10px',
  paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
  background: colors.panel,
  borderTop: `1px solid ${colors.border}`,
  flexShrink: 0,
};

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
  style?: CSSProperties;
}

/** Ghost chip wrapping a hidden file input (labels can't be <button>s). */
export function FileButton({ accept, onFile, children, style }: FileButtonProps) {
  const { hovered, hoverProps } = useHover();
  return (
    <label {...hoverProps} style={{ ...buttonStyle(false, hovered), ...style }}>
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
