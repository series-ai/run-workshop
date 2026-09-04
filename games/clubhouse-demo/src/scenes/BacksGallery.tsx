import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { BACK_PRESETS, Card, PlayingCard, useCardBackTexture } from '@clubhouse'
import { CardShadow } from '../components/CardShadow'
import { FitCamera } from '../components/FitCamera'
import { SceneShell } from '../components/SceneShell'
import { Button, ControlLabel, colors, fonts } from '../components/ui'

// Generated/curated PNG backs, discovered at build time. Empty until
// scripts/generate-back.mjs (or a manual drop-in) adds files.
const backUrls = import.meta.glob('../assets/backs/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const COLS = 7
const CARD_SCALE = 0.28
const STEP_X = 2.5 * CARD_SCALE + 0.25
const STEP_Y = 3.5 * CARD_SCALE + 0.25

// The face is never shown in this scene; any single card works.
const COVER_CARD: Card = { rank: 'A', suit: 'spades' }

type BackRef =
  | { kind: 'theme'; id: string }
  | { kind: 'png'; path: string; url: string }

function backName(ref: BackRef): string {
  return ref.kind === 'theme' ? ref.id : (ref.path.split('/').pop() ?? ref.path)
}

interface CommonCardProps {
  position: [number, number, number]
  scale?: number
  onClick?: () => void
}

const cardEvents = {
  onPointerOver: () => { document.body.style.cursor = 'pointer' },
  onPointerOut: () => { document.body.style.cursor = 'auto' },
}

// Separate components per back kind so the PNG hook is never conditional —
// React remounts when the kind changes (grid → inspect → different kind).
function ThemeBackCard({ id, position, scale = CARD_SCALE, onClick }: CommonCardProps & { id: string }) {
  const theme = BACK_PRESETS.find((p) => p.id === id) ?? BACK_PRESETS[0]
  return (
    <PlayingCard
      card={COVER_CARD}
      back={{ kind: 'theme', theme }}
      faceUp={false}
      artScale={0.5}
      scale={scale}
      position={position}
      onClick={onClick}
      {...cardEvents}
    />
  )
}

function PngBackCard({ url, position, scale = CARD_SCALE, onClick }: CommonCardProps & { url: string }) {
  const texture = useCardBackTexture(url)
  return (
    <PlayingCard
      card={COVER_CARD}
      back={{ kind: 'texture', texture }}
      faceUp={false}
      artScale={0.5}
      scale={scale}
      position={position}
      onClick={onClick}
      {...cardEvents}
    />
  )
}

function BackCard({
  backRef,
  position,
  scale = CARD_SCALE,
  onClick,
}: CommonCardProps & { backRef: BackRef }) {
  // Group carries the position so the shadow sits behind the card at the
  // same spot (shadows must not flip with the card). The shadow is sized for
  // a 1x card, so it rides its own group at the card's scale.
  return (
    <group position={position}>
      <group scale={scale}>
        <CardShadow />
      </group>
      {backRef.kind === 'theme' ? (
        <ThemeBackCard id={backRef.id} position={[0, 0, 0]} scale={scale} onClick={onClick} />
      ) : (
        <PngBackCard url={backRef.url} position={[0, 0, 0]} scale={scale} onClick={onClick} />
      )}
    </group>
  )
}

export function BacksGallery() {
  const entries = Object.entries(backUrls).sort(([a], [b]) => a.localeCompare(b))
  const backs: BackRef[] = [
    ...BACK_PRESETS.map((p): BackRef => ({ kind: 'theme', id: p.id })),
    ...entries.map(([path, url]): BackRef => ({ kind: 'png', path, url })),
  ]
  const [selected, setSelected] = useState<BackRef | null>(null)

  const rows = Math.max(1, Math.ceil(backs.length / COLS))
  const pos = (i: number): [number, number, number] => {
    // Center each row independently so a short last row doesn't left-shift.
    const row = Math.floor(i / COLS)
    const inRow = Math.min(COLS, backs.length - row * COLS)
    return [
      ((i % COLS) - (inRow - 1) / 2) * STEP_X,
      ((rows - 1) / 2) * STEP_Y - row * STEP_Y,
      0,
    ]
  }

  return (
    <SceneShell
      title="Backs"
      blurb="Procedural presets plus every PNG discovered in src/assets/backs. Click one to inspect."
      controls={
        <>
          <ControlLabel>{`${BACK_PRESETS.length} presets · ${entries.length} png`}</ControlLabel>
          {selected && <Button onClick={() => setSelected(null)}>Back to grid</Button>}
        </>
      }
    >
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 5.5], fov: 40 }} style={{ background: 'transparent' }}>
        {selected ? (
          <>
            <FitCamera fitWidth={2.7} fitHeight={3.9} />
            <BackCard backRef={selected} position={[0, 0, 0]} scale={0.85} onClick={() => setSelected(null)} />
          </>
        ) : (
          <>
            <FitCamera fitWidth={COLS * STEP_X} fitHeight={rows * STEP_Y} />
            {backs.map((ref, i) => (
              <BackCard key={backName(ref)} backRef={ref} position={pos(i)} onClick={() => setSelected(ref)} />
            ))}
          </>
        )}
      </Canvas>
      {/* Caption: grid order (left-to-right, top-to-bottom) or the
          inspected back's name. */}
      <div
        style={{
          position: 'absolute',
          left: 14,
          bottom: 12,
          fontFamily: fonts.mono,
          fontSize: 10,
          letterSpacing: '0.08em',
          color: colors.textDim,
          background: 'rgba(10, 14, 12, 0.75)',
          border: `1px solid ${colors.border}`,
          borderRadius: 3,
          padding: '6px 10px',
          maxWidth: '70%',
        }}
      >
        {selected
          ? backName(selected)
          : backs.length > 0
            ? 'click a back to inspect it'
            : 'no backs — run: npm run generate:back -- --name my-back --prompt "..."'}
      </div>
    </SceneShell>
  )
}
