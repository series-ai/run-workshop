import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { dominoId, DominoPiece, doubleSixSet } from '@clubhouse'
import { FitCamera } from '../components/FitCamera'
import { SceneShell } from '../components/SceneShell'
import { Button, ControlLabel } from '../components/ui'

const COLS = 7
const STEP_X = 0.62
const STEP_Y = 1.14

export function DominoesScene() {
  const set = useMemo(() => doubleSixSet(), [])
  const [faceDown, setFaceDown] = useState<ReadonlySet<string>>(new Set())
  const rows = Math.ceil(set.length / COLS)

  const toggle = (id: string) => {
    setFaceDown((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allDown = faceDown.size === set.length

  return (
    <SceneShell
      title="Dominoes"
      blurb="Full double-six set as chunky BoxPiece tiles. Click one to flip it."
      controls={
        <>
          <ControlLabel>{`${faceDown.size} / ${set.length} down`}</ControlLabel>
          <Button onClick={() => setFaceDown(allDown ? new Set() : new Set(set.map(dominoId)))}>
            {allDown ? 'Flip all up' : 'Flip all down'}
          </Button>
        </>
      }
    >
      {/* Chunky pieces are lit — one directional + ambient. */}
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 6], fov: 40 }} style={{ background: 'transparent' }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 6]} intensity={1.1} />
        <FitCamera fitWidth={COLS * STEP_X} fitHeight={rows * STEP_Y} />
        {set.map((domino, i) => {
          const id = dominoId(domino)
          return (
            <DominoPiece
              key={id}
              domino={domino}
              faceUp={!faceDown.has(id)}
              position={[
                ((i % COLS) - (COLS - 1) / 2) * STEP_X,
                (rows - 1) / 2 * STEP_Y - Math.floor(i / COLS) * STEP_Y,
                0,
              ]}
              onClick={() => toggle(id)}
              onPointerOver={() => { document.body.style.cursor = 'pointer' }}
              onPointerOut={() => { document.body.style.cursor = 'auto' }}
            />
          )
        })}
      </Canvas>
    </SceneShell>
  )
}
