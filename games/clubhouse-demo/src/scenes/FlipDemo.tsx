import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  BACK_PRESETS,
  Card,
  PlayingCard,
  RANKS,
  Rank,
  Suit,
  SUITS,
} from '@clubhouse'
import { CardShadow } from '../components/CardShadow'
import { SceneShell } from '../components/SceneShell'
import { Button, ControlLabel, Select } from '../components/ui'

export function FlipDemo() {
  const [rank, setRank] = useState<Rank>('A')
  const [suit, setSuit] = useState<Suit>('spades')
  const [backId, setBackId] = useState(BACK_PRESETS[0].id)
  const [faceUp, setFaceUp] = useState(true)
  const [duration, setDuration] = useState(0.6)

  const card: Card = { rank, suit }
  const theme = BACK_PRESETS.find((p) => p.id === backId) ?? BACK_PRESETS[0]

  return (
    <SceneShell
      title="Flip"
      blurb="Two-plane card, eased rotation.y flip — click the card. No mirrored art at any angle."
      controls={
        <>
          <ControlLabel>Rank</ControlLabel>
          <Select value={rank} onChange={(e) => setRank(e.target.value as Rank)}>
            {RANKS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
          <ControlLabel>Suit</ControlLabel>
          <Select value={suit} onChange={(e) => setSuit(e.target.value as Suit)}>
            {SUITS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <ControlLabel>Back</ControlLabel>
          <Select value={backId} onChange={(e) => setBackId(e.target.value)}>
            {BACK_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.id}</option>
            ))}
          </Select>
          <ControlLabel>{`${duration.toFixed(2)}s`}</ControlLabel>
          <input
            type="range"
            min={0.1}
            max={1.5}
            step={0.05}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ width: 90, accentColor: '#d4af37' }}
          />
          <Button onClick={() => setFaceUp((v) => !v)}>Flip</Button>
        </>
      }
    >
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 5.6], fov: 40 }} style={{ background: 'transparent' }}>
        {/* Slight table tilt for depth; the flip happens inside PlayingCard. */}
        <group rotation={[-0.14, 0, 0]}>
          <CardShadow />
          <PlayingCard
            card={card}
            back={{ kind: 'theme', theme }}
            faceUp={faceUp}
            flipDuration={duration}
            onClick={() => setFaceUp((v) => !v)}
            onPointerOver={() => { document.body.style.cursor = 'pointer' }}
            onPointerOut={() => { document.body.style.cursor = 'auto' }}
          />
        </group>
      </Canvas>
    </SceneShell>
  )
}
