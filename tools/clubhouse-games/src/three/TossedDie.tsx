import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DieColorway } from '../dice/colorways'
import { DieKind, DieStyle } from '../dice/kinds'
import { readTopFace, restQuaternion } from '../dice/readTopFace'
import { startToss, stepToss, TossBody } from '../dice/toss'
import { Die } from './Die'

export interface TossedDieProps {
  kind?: DieKind
  style?: DieStyle
  colorway?: DieColorway
  size?: number
  lit?: boolean
  // Rest center on the table plane (y of home is ignored; rest height is radius).
  home?: [number, number, number]
  tossToken: number
  onSettle?: (value: number) => void
}

export function TossedDie({
  kind = 6,
  style = 'pip',
  colorway = 'ivory',
  size = 0.6,
  lit = true,
  home = [0, 0, 0],
  tossToken,
  onSettle,
}: TossedDieProps) {
  const fly = useRef<THREE.Group>(null)
  const bodyRef = useRef<TossBody | null>(null)
  const lastToken = useRef(tossToken)
  const reported = useRef(false)
  const acc = useRef(0)
  const flying = useRef(false)
  const radius = size / 2
  const restY = radius
  const [restRot, setRestRot] = useState<[number, number, number]>([0, 0, 0])

  useFrame((_, dt) => {
    const g = fly.current
    if (!g) return

    if (tossToken !== lastToken.current) {
      lastToken.current = tossToken
      bodyRef.current = startToss(home[0], home[2], radius)
      reported.current = false
      acc.current = 0
      flying.current = true
      setRestRot([0, 0, 0])
    }

    const body = bodyRef.current
    if (!body) {
      g.position.set(home[0], restY, home[2])
      return
    }

    if (flying.current && !body.settled) {
      acc.current += Math.min(dt, 0.05)
      const step = 1 / 120
      while (acc.current >= step) {
        stepToss(body, step, { restY, radius, homeX: home[0], homeZ: home[2] })
        acc.current -= step
      }
      if (body.settled && !reported.current) {
        const q = new THREE.Quaternion(
          body.quaternion.x,
          body.quaternion.y,
          body.quaternion.z,
          body.quaternion.w,
        )
        const value = readTopFace(kind, q)
        const rest = restQuaternion(kind, value, 0)
        const euler = new THREE.Euler().setFromQuaternion(rest, 'XYZ')
        reported.current = true
        flying.current = false
        g.quaternion.identity()
        setRestRot([euler.x, euler.y, euler.z])
        onSettle?.(value)
      }
    }

    g.position.set(body.position.x, body.position.y, body.position.z)
    if (flying.current) {
      g.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w)
    }
  })

  return (
    <group ref={fly}>
      <group rotation={restRot}>
        <Die kind={kind} style={style} colorway={colorway} size={size} lit={lit} castShadow />
      </group>
    </group>
  )
}
