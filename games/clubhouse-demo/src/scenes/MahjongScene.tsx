import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { fullMahjongSet, mahjongFaceId, MahjongPiece, MahjongTile } from '@clubhouse'
import { FitCamera } from '../components/FitCamera'
import { SceneShell } from '../components/SceneShell'
import { ControlLabel } from '../components/ui'

const COLS = 7
const STEP_X = 0.62
const STEP_Y = 0.84

export function MahjongScene() {
  // One representative tile per unique face design (42 of 144).
  const faces = useMemo(() => {
    const seen = new Map<string, MahjongTile>()
    for (const t of fullMahjongSet()) {
      const f = mahjongFaceId(t)
      if (!seen.has(f)) seen.set(f, t)
    }
    return [...seen.values()]
  }, [])
  const [faceDown, setFaceDown] = useState<ReadonlySet<string>>(new Set())
  const rows = Math.ceil(faces.length / COLS)

  const toggle = (id: string) => {
    setFaceDown((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <SceneShell
      title="Mahjong"
      blurb="The 42 unique faces of a 144-tile set — suits, winds, dragons, bonus. Click a tile to flip it."
      controls={<ControlLabel>{`${faces.length} faces · 144-tile set`}</ControlLabel>}
    >
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 6], fov: 40 }} style={{ background: 'transparent' }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 6]} intensity={1.1} />
        <FitCamera fitWidth={COLS * STEP_X} fitHeight={rows * STEP_Y} />
        {faces.map((tile, i) => {
          const id = mahjongFaceId(tile)
          return (
            <MahjongPiece
              key={id}
              tile={tile}
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
