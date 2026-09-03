import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BACK_PRESETS, Card, fullDeck, PlayingCard } from '@clubhouse'
import { CardShadow } from '../components/CardShadow'
import { SceneShell } from '../components/SceneShell'
import { Button } from '../components/ui'

const COUNT = 12
const CARD_SCALE = 0.4
const STACK_X = -3.4

type Phase = 'stacked' | 'shuffling' | 'dealt'

interface Scatter {
  dx: number
  dy: number
  rz: number
}

interface Target {
  position: THREE.Vector3
  rotZ: number
}

interface TableCardProps {
  card: Card
  faceUp: boolean
  target: Target
  // Seconds to wait before easing toward the target (deal/gather stagger).
  delay: number
  // Increment to re-arm the delay clock without remounting.
  token: number
}

function TableCard({ card, faceUp, target, delay, token }: TableCardProps) {
  const group = useRef<THREE.Group>(null)
  const elapsed = useRef(0)
  // Stable initial position: R3F never re-applies an unchanged prop, so the
  // lerp in useFrame owns the position from the first frame on.
  const initial = useRef(target.position.clone())

  useEffect(() => {
    elapsed.current = 0
  }, [token])

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    elapsed.current += delta
    if (elapsed.current < delay) return
    const k = 1 - Math.exp(-8 * delta)
    g.position.lerp(target.position, k)
    g.rotation.z += (target.rotZ - g.rotation.z) * k
  })

  return (
    <group ref={group} position={initial.current} scale={CARD_SCALE}>
      <CardShadow />
      <PlayingCard
        card={card}
        back={{ kind: 'theme', theme: BACK_PRESETS[0] }}
        faceUp={faceUp}
        artScale={0.5}
      />
    </group>
  )
}

export function TableDemo() {
  const [cards, setCards] = useState<Card[]>(() => fullDeck().filter((_, i) => i % 5 === 0).slice(0, COUNT))
  const [phase, setPhase] = useState<Phase>('stacked')
  const [scatter, setScatter] = useState<Scatter[]>([])
  const [token, setToken] = useState(0)

  const shuffle = () => {
    // Fisher-Yates on the card order; the animation is a scatter + restack.
    const next = [...cards]
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[next[i], next[j]] = [next[j], next[i]]
    }
    setScatter(
      next.map(() => ({
        dx: (Math.random() - 0.5) * 1.8,
        dy: (Math.random() - 0.5) * 2.4,
        rz: (Math.random() - 0.5) * 1.4,
      })),
    )
    setPhase('shuffling')
    setToken((t) => t + 1)
    window.setTimeout(() => {
      setCards(next)
      setPhase('stacked')
      setToken((t) => t + 1)
    }, 700)
  }

  const deal = () => {
    setPhase('dealt')
    setToken((t) => t + 1)
  }

  const reset = () => {
    setPhase('stacked')
    setToken((t) => t + 1)
  }

  const targetFor = (i: number): Target => {
    if (phase === 'dealt') {
      // Overlapping dealt row, centered; rising z keeps later cards on top.
      const startX = (-(cards.length - 1) * 0.55) / 2
      return { position: new THREE.Vector3(startX + i * 0.55, 0, i * 0.01), rotZ: 0 }
    }
    if (phase === 'shuffling') {
      const s = scatter[i] ?? { dx: 0, dy: 0, rz: 0 }
      return { position: new THREE.Vector3(STACK_X + s.dx, s.dy, i * 0.002), rotZ: s.rz }
    }
    return { position: new THREE.Vector3(STACK_X, i * 0.012, i * 0.002), rotZ: 0 }
  }

  const delayFor = (i: number): number => {
    if (phase === 'dealt') return i * 0.12
    if (phase === 'shuffling') return 0
    return (cards.length - 1 - i) * 0.05 // gather top card first
  }

  return (
    <SceneShell
      title="Table"
      blurb="Deck choreography on felt: Fisher-Yates shuffle, staggered deal, gather."
      controls={
        <>
          <Button onClick={shuffle}>Shuffle</Button>
          <Button onClick={deal}>Deal</Button>
          <Button onClick={reset}>Reset</Button>
        </>
      }
    >
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 6], fov: 40 }} style={{ background: 'transparent' }}>
        {cards.map((card, i) => (
          <TableCard
            key={`${card.rank}${card.suit}`}
            card={card}
            faceUp={phase === 'dealt'}
            target={targetFor(i)}
            delay={delayFor(i)}
            token={token}
          />
        ))}
      </Canvas>
    </SceneShell>
  )
}
