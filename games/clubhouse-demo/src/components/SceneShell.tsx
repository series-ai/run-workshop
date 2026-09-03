import { ReactNode } from 'react'
import { colors, feltStyle, fonts, toolbarStyle } from './ui'

interface SceneShellProps {
  // Mono title shown in the toolbar, e.g. "Flip".
  title: string
  // One-line description of what the scene demonstrates.
  blurb: string
  controls?: ReactNode
  children: ReactNode
}

// Scene scaffold: a persistent toolbar (title + what-it-demos blurb +
// controls) above a casino-felt canvas area. Mirrors the dither-playground
// pattern of keeping scene controls in shared chrome.
export function SceneShell({ title, blurb, controls, children }: SceneShellProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={toolbarStyle}>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: colors.accent,
          }}
        >
          {title}
        </span>
        <span style={{ fontSize: 12, color: colors.textDim }}>{blurb}</span>
        <div style={{ flex: 1 }} />
        {controls}
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', ...feltStyle }}>
        {children}
      </div>
    </div>
  )
}
