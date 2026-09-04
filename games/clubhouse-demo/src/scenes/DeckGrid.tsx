import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { BACK_PRESETS, cardId, fullDeck, PlayingCard } from '@clubhouse'
import { FitCamera } from '../components/FitCamera'
import { SceneShell } from '../components/SceneShell'
import { Button, ControlLabel } from '../components/ui'

const COLS = 13
const CARD_SCALE = 0.22
const STEP_X = 2.5 * CARD_SCALE + 0.1 // world width + gap
const STEP_Y = 3.5 * CARD_SCALE + 0.1

export function DeckGrid() {
  const deck = useMemo(() => fullDeck(), [])
  const [faceDown, setFaceDown] = useState<ReadonlySet<string>>(new Set())
  const [hovered, setHovered] = useState<string | null>(null)
  const rows = Math.ceil(deck.length / COLS)

  const toggle = (id: string) => {
    setFaceDown((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allDown = faceDown.size === deck.length
  const flipAll = () => {
    setFaceDown(allDown ? new Set() : new Set(deck.map(cardId)))
  }

  return (
    <SceneShell
      title="Deck"
      blurb="All 52 procedural faces, texture-cached and shared. Click a card to flip it."
      controls={
        <>
          <ControlLabel>{`${faceDown.size} / ${deck.length} down`}</ControlLabel>
          <Button onClick={flipAll}>{allDown ? 'Flip all up' : 'Flip all down'}</Button>
        </>
      }
    >
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 8.5], fov: 40 }} style={{ background: 'transparent' }}>
        <FitCamera fitWidth={COLS * STEP_X} fitHeight={rows * STEP_Y} />
        {deck.map((card, i) => {
          const id = cardId(card)
          const isHovered = hovered === id
          return (
            <PlayingCard
              key={id}
              card={card}
              back={{ kind: 'theme', theme: BACK_PRESETS[0] }}
              faceUp={!faceDown.has(id)}
              artScale={0.5}
              scale={CARD_SCALE * (isHovered ? 1.07 : 1)}
              position={[
                ((i % COLS) - (COLS - 1) / 2) * STEP_X,
                (rows - 1) / 2 * STEP_Y - Math.floor(i / COLS) * STEP_Y,
                isHovered ? 0.15 : 0,
              ]}
              onClick={() => toggle(id)}
              onPointerOver={() => {
                setHovered(id)
                document.body.style.cursor = 'pointer'
              }}
              onPointerOut={() => {
                setHovered((h) => (h === id ? null : h))
                document.body.style.cursor = 'auto'
              }}
            />
          )
        })}
      </Canvas>
    </SceneShell>
  )
}
