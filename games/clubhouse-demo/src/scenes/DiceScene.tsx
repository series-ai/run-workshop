import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  DIE_COLORWAYS,
  DIE_KINDS,
  DieColorway,
  DieKind,
  DieStyle,
  DiceTray,
} from '@clubhouse'
import { SceneShell } from '../components/SceneShell'
import { Button, ControlLabel, Select } from '../components/ui'

const STYLES_FOR: Record<DieKind, DieStyle[]> = {
  4: ['numeral', 'ornate'],
  6: ['pip', 'ornate', 'numeral'],
  8: ['numeral', 'ornate'],
  10: ['numeral', 'ornate'],
  12: ['numeral', 'ornate'],
  20: ['numeral', 'ornate'],
}

export function DiceScene() {
  const [kind, setKind] = useState<DieKind>(6)
  const [style, setStyle] = useState<DieStyle>('ornate')
  const [colorway, setColorway] = useState<DieColorway>('ivory')
  const [count, setCount] = useState(2)
  const [tossToken, setTossToken] = useState(0)
  const [values, setValues] = useState<(number | null)[]>(() => [null, null])

  const styles = STYLES_FOR[kind]
  const resolvedStyle = styles.includes(style) ? style : styles[0]

  const settled = values.every((v) => v !== null)
  const total = settled ? values.reduce((s: number, v) => s + (v ?? 0), 0) : null

  const setKindSafe = (k: DieKind) => {
    setKind(k)
    if (!STYLES_FOR[k].includes(style)) setStyle(STYLES_FOR[k][0])
    setValues(Array.from({ length: count }, () => null))
    setTossToken(0)
  }

  const toss = () => {
    setValues(Array.from({ length: count }, () => null))
    setTossToken((t) => t + 1)
  }

  const setCountSafe = (n: number) => {
    setCount(n)
    setValues(Array.from({ length: n }, () => null))
    setTossToken(0)
  }

  return (
    <SceneShell
      title="Dice"
      blurb="Throw onto the felt: the dice tumble on their corners and settle where they land. RPG set plus decorative colorways."
      controls={
        <>
          <ControlLabel>Kind</ControlLabel>
          <Select value={kind} onChange={(e) => setKindSafe(Number(e.target.value) as DieKind)}>
            {DIE_KINDS.map((k) => (
              <option key={k} value={k}>{`d${k}`}</option>
            ))}
          </Select>
          <ControlLabel>Style</ControlLabel>
          <Select value={resolvedStyle} onChange={(e) => setStyle(e.target.value as DieStyle)}>
            {styles.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <ControlLabel>Color</ControlLabel>
          <Select value={colorway} onChange={(e) => setColorway(e.target.value as DieColorway)}>
            {DIE_COLORWAYS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <ControlLabel>Count</ControlLabel>
          <Select value={count} onChange={(e) => setCountSafe(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Select>
          <ControlLabel>
            {tossToken === 0
              ? 'ready'
              : total === null
                ? 'in the air'
                : `${values.join(' + ')} = ${total}`}
          </ControlLabel>
          <Button onClick={toss}>Toss</Button>
        </>
      }
    >
      <Canvas
        dpr={[1, 2]}
        shadows
        camera={{ position: [0, 6.4, 4.2], fov: 34 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[4, 7, 3]}
          intensity={1.25}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={1}
          shadow-camera-far={18}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
        />
        {/* Invisible except for shadows, so the CSS felt is the table. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <shadowMaterial opacity={0.38} />
        </mesh>
        <DiceTray
          key={`${kind}-${count}`}
          kind={kind}
          style={resolvedStyle}
          colorway={colorway}
          size={kind === 20 ? 0.72 : 0.6}
          count={count}
          spread={1.05}
          bounds={1.05}
          tossToken={tossToken}
          onSettle={setValues}
        />
      </Canvas>
    </SceneShell>
  )
}
