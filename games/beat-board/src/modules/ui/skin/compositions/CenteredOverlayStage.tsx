import type { CSSProperties, ReactNode } from 'react'
import { Background } from '../semantic'

export function CenteredOverlayStage({
  children,
  testId,
  width = 'min(560px, calc(100% - 40px))',
}: {
  children: ReactNode
  testId?: string
  width?: CSSProperties['width']
}) {
  return (
    <Background
      data-testid={testId}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        padding: 20,
        display: 'grid',
        alignItems: 'safe center',
        justifyItems: 'center',
        overflowY: 'auto',
        boxSizing: 'border-box',
      }}
    >
      {/* Dark scrim — blocks clicks on content behind the dialog */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.30)' }} />
      {/* Dialog panel — shadow follows panel border-radius via drop-shadow filter */}
      <div style={{ width, maxWidth: '100%', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.38))' }}>
        {children}
      </div>
    </Background>
  )
}
