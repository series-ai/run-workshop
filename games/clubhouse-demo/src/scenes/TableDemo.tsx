import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BACK_PRESETS, Card, cardId, fullDeck, PlayingCard } from '@clubhouse'
import { SceneShell } from '../components/SceneShell'
import { Button } from '../components/ui'
import {
  CardPlan,
  dealPlan,
  gatherPlan,
  Pose,
  shufflePlan,
  stackPose,
  TablePlan,
} from './tablePlan'

const COUNT = 12
const CARD_SCALE = 0.5

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function poseAt(plan: CardPlan, t: number, fallback: Pose): { pose: Pose; lift: number } {
  const legs = plan.legs
  if (legs.length === 0) return { pose: fallback, lift: 0 }
  if (t <= legs[0].start) return { pose: legs[0].from, lift: 0 }
  for (const leg of legs) {
    if (t >= leg.end) continue
    if (t < leg.start) {
      // Between legs: hold the pose the previous leg finished on.
      return { pose: leg.from, lift: 0 }
    }
    const k = easeInOutCubic((t - leg.start) / (leg.end - leg.start))
    return {
      pose: {
        x: leg.from.x + (leg.to.x - leg.from.x) * k,
        y: leg.from.y + (leg.to.y - leg.from.y) * k,
        z: leg.from.z + (leg.to.z - leg.from.z) * k,
        yaw: leg.from.yaw + (leg.to.yaw - leg.from.yaw) * k,
        tilt: leg.from.tilt + (leg.to.tilt - leg.from.tilt) * k,
      },
      lift: Math.sin(Math.PI * k) * leg.lift,
    }
  }
  return { pose: legs[legs.length - 1].to, lift: 0 }
}

interface TableCardProps {
  card: Card
  plan: CardPlan
  version: number
  startPose: Pose
}

function TableCard({ card, plan, version, startPose }: TableCardProps) {
  const group = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const elapsed = useRef(0)
  const flipped = useRef(false)
  const [faceUp, setFaceUp] = useState(false)
  const lastVersion = useRef(version)

  useFrame((_, dt) => {
    if (version !== lastVersion.current) {
      lastVersion.current = version
      elapsed.current = 0
      flipped.current = false
    }
    elapsed.current += dt
    const g = group.current
    const i = inner.current
    if (!g || !i) return

    const { pose, lift } = poseAt(plan, elapsed.current, startPose)
    g.position.set(pose.x, pose.y + lift, pose.z)
    g.rotation.y = pose.yaw
    // A lifted card tips slightly, the way one does leaving a pile.
    i.rotation.x = -Math.PI / 2 + pose.tilt + lift * 0.5

    if (!flipped.current && plan.flipAt !== null && elapsed.current >= plan.flipAt) {
      flipped.current = true
      setFaceUp(plan.faceUp)
    }
  })

  return (
    <group ref={group}>
      <group ref={inner} scale={CARD_SCALE}>
        <PlayingCard
          card={card}
          back={{ kind: 'theme', theme: BACK_PRESETS[0] }}
          faceUp={faceUp}
          flipDuration={0.32}
          artScale={1}
          castShadow
        />
      </group>
    </group>
  )
}

// The table is seen from a dealer's chair: high, tilted, looking at the felt
// between the deck and the fan.
function TableCamera() {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    camera.position.set(-0.2, 4.9, 5.4)
    camera.lookAt(-0.2, 0, 1.5)
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

type Action = 'shuffle' | 'deal' | 'gather'

export function TableDemo() {
  const initial = useMemo(() => fullDeck().filter((_, i) => i % 4 === 0).slice(0, COUNT), [])
  const order = useRef<Card[]>(initial)
  const poses = useRef<Map<string, Pose>>(
    new Map(initial.map((c, i) => [cardId(c), stackPose(i, 0)])),
  )
  const [plan, setPlan] = useState<TablePlan>(() => ({
    order: initial,
    plans: initial.map((_, i) => ({
      legs: [{ start: 0, end: 0.01, from: stackPose(i, 0), to: stackPose(i, 0), lift: 0 }],
      flipAt: 0,
      faceUp: false,
    })),
    duration: 0.01,
  }))
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<'stacked' | 'dealt'>('stacked')

  const byId = useMemo(() => {
    const map = new Map<string, CardPlan>()
    plan.order.forEach((c, i) => map.set(cardId(c), plan.plans[i]))
    return map
  }, [plan])

  const run = (action: Action) => {
    if (busy) return
    const current = order.current
    const from = current.map((c) => poses.current.get(cardId(c))!)
    const next =
      action === 'shuffle'
        ? shufflePlan(current, from)
        : action === 'deal'
          ? dealPlan(current, from)
          : gatherPlan(current, from)

    // Record where every card ends up, so the next action starts from there.
    next.order.forEach((c, i) => {
      const legs = next.plans[i].legs
      poses.current.set(cardId(c), legs.length ? legs[legs.length - 1].to : from[i])
    })
    order.current = next.order
    setPlan(next)
    setVersion((v) => v + 1)
    setBusy(true)
    setPhase(action === 'deal' ? 'dealt' : 'stacked')
    window.setTimeout(() => setBusy(false), next.duration * 1000)
  }

  return (
    <SceneShell
      title="Table"
      blurb="A real riffle: cut, interleave, square up. Then deal into a fan and gather it back."
      controls={
        <>
          <Button onClick={() => run('shuffle')} disabled={busy || phase === 'dealt'}>
            Shuffle
          </Button>
          <Button onClick={() => run('deal')} disabled={busy || phase === 'dealt'}>
            Deal
          </Button>
          <Button onClick={() => run('gather')} disabled={busy || phase === 'stacked'}>
            Gather
          </Button>
        </>
      }
    >
      <Canvas dpr={[1, 2]} shadows camera={{ fov: 44 }} style={{ background: 'transparent' }}>
        <TableCamera />
        <ambientLight intensity={0.85} />
        <directionalLight
          position={[-3, 8, 4]}
          intensity={0.9}
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
        {/* Invisible except for shadows, so the CSS felt is the table. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial opacity={0.3} />
        </mesh>
        {initial.map((card) => (
          <TableCard
            key={cardId(card)}
            card={card}
            plan={byId.get(cardId(card))!}
            version={version}
            startPose={poses.current.get(cardId(card))!}
          />
        ))}
      </Canvas>
    </SceneShell>
  )
}
