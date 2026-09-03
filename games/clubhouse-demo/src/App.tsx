import { useState } from 'react'
import { Button, colors, fonts } from './components/ui'
import { BacksGallery } from './scenes/BacksGallery'
import { DeckGrid } from './scenes/DeckGrid'
import { DiceScene } from './scenes/DiceScene'
import { DominoesScene } from './scenes/DominoesScene'
import { FlipDemo } from './scenes/FlipDemo'
import { MahjongScene } from './scenes/MahjongScene'
import { TableDemo } from './scenes/TableDemo'

const TABS = [
  { id: 'flip', label: 'Flip' },
  { id: 'deck', label: 'Deck' },
  { id: 'backs', label: 'Backs' },
  { id: 'table', label: 'Table' },
  { id: 'dominoes', label: 'Dominoes' },
  { id: 'dice', label: 'Dice' },
  { id: 'mahjong', label: 'Mahjong' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  const [tab, setTab] = useState<TabId>('flip')
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: colors.bg,
        color: colors.text,
        fontFamily: fonts.sans,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
          padding: '0 16px',
          minHeight: 52,
          background: colors.panel,
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: colors.accent,
            whiteSpace: 'nowrap',
            textShadow: '0 0 12px rgba(212, 175, 55, 0.35)',
          }}
        >
          {'\u2660\uFE0E'} CLUBHOUSE<span style={{ color: colors.textDim }}>.</span>DEMO
        </span>
        <nav style={{ display: 'flex', gap: 8 }}>
          {TABS.map((t) => (
            <Button key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </Button>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 10,
            letterSpacing: '0.08em',
            color: colors.textDim,
            whiteSpace: 'nowrap',
          }}
        >
          clubhouse games demo
        </span>
      </header>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {tab === 'flip' && <FlipDemo />}
        {tab === 'deck' && <DeckGrid />}
        {tab === 'backs' && <BacksGallery />}
        {tab === 'table' && <TableDemo />}
        {tab === 'dominoes' && <DominoesScene />}
        {tab === 'dice' && <DiceScene />}
        {tab === 'mahjong' && <MahjongScene />}
      </div>
    </div>
  )
}
