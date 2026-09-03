import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  DIE_COLORWAYS,
  DIE_KINDS,
  DieColorway,
  DieKind,
  DieStyle,
  TossedDie,
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

  const homes = useMemo(() => {
    const gap = 0.85
    const origin = -((count - 1) * gap) / 2
    return Array.from({ length: count }, (_, i) => [origin + i * gap, 0, 0] as [number, number, number])
  }, [count])

  const styles = STYLES_FOR[kind]
  const resolvedStyle = styles.includes(style) ? style : styles[0]

  const settled = values.every((v) => v !== null)
  const total = settled ? values.reduce((s, v) => s + (v ?? 0), 0) : null

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
      blurb="Toss onto the felt — gravity, bounce, then snap to a face. RPG set plus decorative colorways."
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
        camera={{ position: [0, 4.4, 2.4], fov: 36 }}
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
        {homes.map((home, i) => (
          <TossedDie
            key={`${kind}-${count}-${i}`}
            kind={kind}
            style={resolvedStyle}
            colorway={colorway}
            size={kind === 20 ? 0.72 : 0.6}
            home={home}
            tossToken={tossToken}
            onSettle={(value) => {
              setValues((prev) => {
                const next = prev.slice()
                next[i] = value
                return next
              })
            }}
          />
        ))}
      </Canvas>
    </SceneShell>
  )
}
