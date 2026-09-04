import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Checker, CheckerPiece } from '@clubhouse'
import { SceneShell } from '../components/SceneShell'
import { Button, ControlLabel } from '../components/ui'

const COLS = 6
const STEP = 0.92

const START: Checker[] = [
  ...Array.from({ length: 6 }, (): Checker => ({ color: 'red', king: false })),
  ...Array.from({ length: 6 }, (): Checker => ({ color: 'black', king: false })),
]

export function CheckersScene() {
  const [pieces, setPieces] = useState<Checker[]>(START)
  const crowned = pieces.filter((p) => p.king).length

  const toggle = (i: number) =>
    setPieces((prev) => prev.map((p, j) => (j === i ? { ...p, king: !p.king } : p)))

  const setAll = (king: boolean) => setPieces((prev) => prev.map((p) => ({ ...p, king })))

  return (
    <SceneShell
      title="Checkers"
      blurb="Turned draughts with reeded rims. Click one to crown it — a king really is two pieces stacked."
      controls={
        <>
          <ControlLabel>{`${crowned} / ${pieces.length} crowned`}</ControlLabel>
          <Button onClick={() => setAll(crowned < pieces.length)}>
            {crowned < pieces.length ? 'Crown all' : 'Uncrown all'}
          </Button>
        </>
      }
    >
      <Canvas
        dpr={[1, 2]}
        shadows
        camera={{ position: [0, 3.5, 5.0], fov: 34 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.82} />
        <directionalLight
          position={[-3, 7, 4]}
          intensity={1.15}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={1}
          shadow-camera-far={22}
          shadow-camera-left={-7}
          shadow-camera-right={7}
          shadow-camera-top={7}
          shadow-camera-bottom={-7}
        />
        <directionalLight position={[4, 3, -3]} intensity={0.35} />
        {/* Invisible except for shadows, so the CSS felt is the table. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial opacity={0.34} />
        </mesh>
        {pieces.map((piece, i) => {
          const col = i % COLS
          const row = Math.floor(i / COLS)
          return (
            <group
              key={i}
              position={[(col - (COLS - 1) / 2) * STEP, 0, (row - 0.5) * STEP * 1.1]}
              onClick={(e) => {
                e.stopPropagation()
                toggle(i)
              }}
              onPointerOver={() => {
                document.body.style.cursor = 'pointer'
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'auto'
              }}
            >
              <CheckerPiece piece={piece} />
            </group>
          )
        })}
      </Canvas>
    </SceneShell>
  )
}
