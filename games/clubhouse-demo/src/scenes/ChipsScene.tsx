import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { CHIP_DENOMINATIONS, ChipStack, chipsForAmount } from '@clubhouse'
import { SceneShell } from '../components/SceneShell'
import { ControlLabel, Select } from '../components/ui'

const AMOUNTS = [5, 37, 140, 685, 1687, 12345]
const STEP = 1.02

type Mode = 'rack' | 'amount'

export function ChipsScene() {
  const [mode, setMode] = useState<Mode>('rack')
  const [amount, setAmount] = useState(1687)

  // A rack shows one stack per denomination; an amount shows the change for
  // it, largest denomination first.
  const stacks = useMemo(() => {
    if (mode === 'rack') {
      return CHIP_DENOMINATIONS.map((d) => ({ value: d.value, count: 5, label: d.label }))
    }
    return chipsForAmount(amount).map((e) => ({
      value: e.denomination.value,
      count: e.count,
      label: `${e.count}x${e.denomination.label}`,
    }))
  }, [mode, amount])

  const origin = (-(stacks.length - 1) * STEP) / 2

  return (
    <SceneShell
      title="Chips"
      blurb="Clay chips with edge inserts and reeded rims. Pick an amount and it is paid out in the fewest chips."
      controls={
        <>
          <ControlLabel>Show</ControlLabel>
          <Select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="rack">full rack</option>
            <option value="amount">an amount</option>
          </Select>
          {mode === 'amount' && (
            <>
              <ControlLabel>Amount</ControlLabel>
              <Select value={amount} onChange={(e) => setAmount(Number(e.target.value))}>
                {AMOUNTS.map((a) => (
                  <option key={a} value={a}>{a.toLocaleString()}</option>
                ))}
              </Select>
            </>
          )}
          <ControlLabel>
            {stacks.reduce((s, x) => s + x.count, 0) + ' chips'}
          </ControlLabel>
        </>
      }
    >
      <Canvas
        dpr={[1, 2]}
        shadows
        camera={{ position: [0, 2.6, 5.6], fov: 34 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.64} />
        <directionalLight
          position={[-3, 7, 4]}
          intensity={1.15}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={1}
          shadow-camera-far={22}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
        />
        {/* Invisible except for shadows, so the CSS felt is the table. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial opacity={0.34} />
        </mesh>
        {stacks.map((stack, i) => (
          <ChipStack
            key={`${stack.value}-${i}`}
            value={stack.value}
            count={stack.count}
            position={[origin + i * STEP, 0, 0]}
          />
        ))}
      </Canvas>
    </SceneShell>
  )
}
