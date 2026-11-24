import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, type ElementRef, type ReactNode } from 'react'
import { Vector3, type Group } from 'three'
import { PLINTH_BEVEL, type LabFraming } from './labFraming'

const PLINTH_HEIGHT = 0.24
const PLINTH_SIDES = 12
const TURNTABLE_RADIANS_PER_SECOND = 0.55
const CAMERA_EASE_PER_SECOND = 7
const CAMERA_SETTLE_DISTANCE = 0.004

export interface LabStageProps {
  framing: LabFraming
  /** A new value moves the camera to `framing` and sets the turntable angle to zero. */
  viewEpoch: number
  turntable: boolean
  minDistance?: number
  children: ReactNode
}

/**
 * The lab stage: a faceted plinth, a turntable and the camera that frames the subject.
 * The subject stands on y = 0. The plinth is below it.
 */
export function LabStage({ framing, viewEpoch, turntable, minDistance = 1.6, children }: LabStageProps) {
  const camera = useThree((state) => state.camera)
  const controls = useRef<ElementRef<typeof OrbitControls>>(null)
  const turn = useRef<Group>(null)
  const goal = useRef({ position: new Vector3(), target: new Vector3(), active: false, first: true })
  const latest = useRef(framing)
  latest.current = framing

  // Frame the subject when the epoch changes. Slider changes do not move the camera.
  useLayoutEffect(() => {
    const state = goal.current
    state.position.fromArray(latest.current.position)
    state.target.fromArray(latest.current.target)
    if (turn.current) turn.current.rotation.y = 0
    if (state.first) {
      // First frame: no travel.
      camera.position.copy(state.position)
      controls.current?.target.copy(state.target)
      controls.current?.update()
      state.first = false
      return
    }
    state.active = true
  }, [viewEpoch, camera])

  // A drag of the user stops the camera travel.
  useEffect(() => {
    const orbit = controls.current
    if (!orbit) return
    const stop = () => void (goal.current.active = false)
    orbit.addEventListener('start', stop)
    return () => orbit.removeEventListener('start', stop)
  }, [])

  useFrame((_, delta) => {
    if (turntable && turn.current) turn.current.rotation.y += delta * TURNTABLE_RADIANS_PER_SECOND
    const state = goal.current
    const orbit = controls.current
    if (!state.active || !orbit) return
    const ease = 1 - Math.exp(-delta * CAMERA_EASE_PER_SECOND)
    camera.position.lerp(state.position, ease)
    orbit.target.lerp(state.target, ease)
    if (camera.position.distanceTo(state.position) < CAMERA_SETTLE_DISTANCE) {
      camera.position.copy(state.position)
      orbit.target.copy(state.target)
      state.active = false
    }
    orbit.update()
  })

  const radius = framing.plinthRadius
  return (
    <>
      <group ref={turn}>
        <mesh position={[0, -0.03, 0]} receiveShadow>
          <cylinderGeometry args={[radius, radius, 0.06, PLINTH_SIDES]} />
          <meshStandardMaterial attach="material-0" color="#333a45" roughness={0.9} flatShading />
          <meshStandardMaterial attach="material-1" color="#474f5c" roughness={0.95} flatShading />
          <meshStandardMaterial attach="material-2" color="#474f5c" roughness={0.95} flatShading />
        </mesh>
        <mesh position={[0, -0.075, 0]}>
          <cylinderGeometry args={[radius + 0.035, radius + 0.035, 0.03, PLINTH_SIDES]} />
          <meshStandardMaterial color="#b9803f" roughness={0.6} flatShading />
        </mesh>
        <mesh position={[0, -(0.09 + PLINTH_HEIGHT) / 2, 0]}>
          <cylinderGeometry args={[radius + 0.02, radius + PLINTH_BEVEL, PLINTH_HEIGHT - 0.09, PLINTH_SIDES]} />
          <meshStandardMaterial color="#23282f" roughness={0.95} flatShading />
        </mesh>
        {children}
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -PLINTH_HEIGHT, 0]} receiveShadow>
        <circleGeometry args={[9, 48]} />
        <meshStandardMaterial color="#12161d" roughness={1} />
      </mesh>
      <gridHelper args={[18, 24, '#2c3644', '#1d242e']} position={[0, -PLINTH_HEIGHT + 0.002, 0]} />
      <OrbitControls ref={controls} minDistance={minDistance} maxDistance={14} maxPolarAngle={Math.PI / 1.95} />
    </>
  )
}
