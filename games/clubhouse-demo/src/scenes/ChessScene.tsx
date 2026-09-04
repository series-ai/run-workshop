import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CHESS_HEIGHTS, CHESS_TYPES, ChessColor, ChessPiece } from '@clubhouse'
import { SceneShell } from '../components/SceneShell'
import { Button, ControlLabel } from '../components/ui'

const KING_HEIGHT = 1.15
const STEP_X = 0.86

// Turns the whole display so the carved pieces can be read from more than one
// angle; a knight in particular is only itself in profile.
function Turntable({ spin, children }: { spin: boolean; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (group.current && spin) group.current.rotation.y += dt * 0.35
  })
  return <group ref={group}>{children}</group>
}

export function ChessScene() {
  const [spin, setSpin] = useState(true)
  const [color, setColor] = useState<ChessColor>('white')
  const other: ChessColor = color === 'white' ? 'black' : 'white'
  const origin = (-(CHESS_TYPES.length - 1) * STEP_X) / 2

  return (
    <SceneShell
      title="Chess"
      blurb="Turned pieces: each body is a lathe profile, with the battlements, mitre, coronet, cross, and knight carved on top."
      controls={
        <>
          <ControlLabel>Front</ControlLabel>
          <Button active={color === 'white'} onClick={() => setColor('white')}>
            White
          </Button>
          <Button active={color === 'black'} onClick={() => setColor('black')}>
            Black
          </Button>
          <Button active={spin} onClick={() => setSpin((v) => !v)}>
            {spin ? 'Spinning' : 'Spin'}
          </Button>
        </>
      }
    >
      <Canvas
        dpr={[1, 2]}
        shadows
        camera={{ position: [0, 3.3, 7.4], fov: 30 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.62} />
        <directionalLight
          position={[-3.5, 7, 4]}
          intensity={1.2}
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
        <directionalLight position={[5, 3, -4]} intensity={0.32} />
        {/* Invisible except for shadows, so the CSS felt is the table. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial opacity={0.34} />
        </mesh>
        <Turntable spin={spin}>
          {CHESS_TYPES.map((type, i) => (
            <ChessPiece
              key={`front-${type}`}
              type={type}
              color={color}
              scale={KING_HEIGHT}
              position={[origin + i * STEP_X, 0, 0.62]}
            />
          ))}
          {CHESS_TYPES.map((type, i) => (
            <ChessPiece
              key={`back-${type}`}
              type={type}
              color={other}
              scale={KING_HEIGHT}
              // Facing the other way, as they would across a board.
              rotation={[0, Math.PI, 0]}
              position={[origin + i * STEP_X, 0, -0.78]}
            />
          ))}
        </Turntable>
      </Canvas>
      <div
        style={{
          position: 'absolute',
          left: 14,
          bottom: 12,
          fontFamily: 'ui-monospace, monospace',
          fontSize: 10,
          letterSpacing: '0.08em',
          color: 'rgba(220,228,220,0.5)',
        }}
      >
        {CHESS_TYPES.map((t) => `${t} ${CHESS_HEIGHTS[t].toFixed(2)}`).join('  ·  ')}
      </div>
    </SceneShell>
  )
}
