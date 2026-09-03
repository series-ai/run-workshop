import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DieColorway } from '../dice/colorways'
import { dieInertia, dieRestHeight, dieVertices, facesForDie } from '../dice/geometry'
import { DieKind, DieStyle } from '../dice/kinds'
import { readTopFace } from '../dice/readTopFace'
import { resolvePairs, startToss, stepToss, TossBody, TossVec } from '../dice/toss'
import { Die } from './Die'

export interface DiceTrayProps {
  kind?: DieKind
  style?: DieStyle
  colorway?: DieColorway
  size?: number
  lit?: boolean
  count?: number
  // Distance between the resting lanes the dice are thrown toward.
  spread?: number
  // Half-width of the rails that keep the throw on the table.
  bounds?: number
  // Bumped by the caller to throw again.
  tossToken: number
  // Fires once, when every die has come to rest.
  onSettle?: (values: number[]) => void
}

// Fixed physics step. Independent of frame rate, so a slow frame cannot let a
// die tunnel through the table.
const STEP = 1 / 180
const MAX_CATCHUP = 0.05

export function DiceTray({
  kind = 6,
  style = 'pip',
  colorway = 'ivory',
  size = 0.6,
  lit = true,
  count = 2,
  spread = 1.15,
  bounds = 1.5,
  tossToken,
  onSettle,
}: DiceTrayProps) {
  const groups = useRef<(THREE.Group | null)[]>([])
  const bodies = useRef<TossBody[]>([])
  const lastToken = useRef(tossToken)
  const reported = useRef(false)
  const acc = useRef(0)

  const radius = size / 2
  const restHeight = useMemo(() => dieRestHeight(kind, radius), [kind, radius])
  const inertia = useMemo(() => dieInertia(kind, radius), [kind, radius])
  const vertices = useMemo<TossVec[]>(
    () => dieVertices(kind, radius).map((v) => ({ x: v.x, y: v.y, z: v.z })),
    [kind, radius],
  )
  const faceNormals = useMemo<TossVec[]>(
    () => facesForDie(kind, 1).map((f) => ({ x: f.normal.x, y: f.normal.y, z: f.normal.z })),
    [kind],
  )
  const homes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: -((count - 1) * spread) / 2 + i * spread,
        z: 0,
      })),
    [count, spread],
  )
  // Cubes fill their bounding sphere badly, so the contact radius is pulled
  // in to keep the visible gap between colliding dice small.
  const contactRadius = radius * (kind === 6 ? 0.86 : 0.95)
  const quat = useMemo(() => new THREE.Quaternion(), [])

  useFrame((_, dt) => {
    if (tossToken !== lastToken.current) {
      lastToken.current = tossToken
      bodies.current = homes.map((h) =>
        startToss({ homeX: h.x, homeZ: h.z, height: restHeight }),
      )
      reported.current = false
      acc.current = 0
    }

    if (bodies.current.length !== count) bodies.current = []

    if (bodies.current.length === 0) {
      homes.forEach((h, i) => {
        const g = groups.current[i]
        if (g) g.position.set(h.x, restHeight, h.z)
      })
      return
    }

    const anyMoving = bodies.current.some((b) => !b.settled)
    if (anyMoving) {
      acc.current += Math.min(dt, MAX_CATCHUP)
      while (acc.current >= STEP) {
        for (let i = 0; i < bodies.current.length; i++) {
          stepToss(bodies.current[i], STEP, {
            tableY: 0,
            vertices,
            faceNormals,
            inertia,
            homeX: homes[i].x,
            homeZ: homes[i].z,
            bounds,
          })
        }
        resolvePairs(
          bodies.current.map((body) => ({ body, radius: contactRadius })),
        )
        acc.current -= STEP
      }
    }

    // The simulation finishes level on its own, so the rendered orientation is
    // simply the body's. Nothing is rotated into place after the fact.
    for (let i = 0; i < bodies.current.length; i++) {
      const b = bodies.current[i]
      const g = groups.current[i]
      if (!g) continue
      g.position.set(b.position.x, b.position.y, b.position.z)
      g.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w)
    }

    if (!reported.current && bodies.current.every((b) => b.settled)) {
      reported.current = true
      onSettle?.(
        bodies.current.map((b) => {
          quat.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w)
          return readTopFace(kind, quat)
        }),
      )
    }
  })

  return (
    <>
      {homes.map((h, i) => (
        <group
          key={i}
          ref={(g) => {
            groups.current[i] = g
          }}
          position={[h.x, restHeight, h.z]}
        >
          <Die kind={kind} style={style} colorway={colorway} size={size} lit={lit} castShadow />
        </group>
      ))}
    </>
  )
}
