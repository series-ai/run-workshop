/**
 * The canvas preset every Pirate Nation surface needs.
 *
 * `logarithmicDepthBuffer` is the important part: the pack nests detail shells
 * with hair-thin offsets (a face plate at x=0.0900 in front of a head at
 * x=0.0899), which a linear depth buffer cannot separate at orbit distance.
 * Without it the voxel art z-fights. Unity hid this behind reversed-Z.
 */
import { Canvas } from '@react-three/fiber'
import type { ReactNode } from 'react'

export type StageBackdrop = 'dark' | 'light'

export const STAGE_COLORS: Record<StageBackdrop, { bg: string; floor: string; gridMain: string; gridMinor: string }> = {
  dark: { bg: '#0b1220', floor: '#1b2432', gridMain: '#26303f', gridMinor: '#1a2331' },
  light: { bg: '#dfe5ee', floor: '#c7cedb', gridMain: '#9aa5b5', gridMinor: '#c2cad6' },
}

export interface PackCanvasProps {
  children: ReactNode
  backdrop?: StageBackdrop
  fov?: number
  shadows?: boolean
  /** Replaces the default light rig when a surface needs its own. */
  lights?: ReactNode
}

export function PackCanvas({
  children,
  backdrop = 'dark',
  fov = 32,
  shadows = true,
  lights,
}: PackCanvasProps) {
  return (
    <Canvas shadows={shadows} gl={{ logarithmicDepthBuffer: true }} camera={{ fov, position: [0, 1.2, 4.5] }}>
      <color attach="background" args={[STAGE_COLORS[backdrop].bg]} />
      {lights ?? (
        <>
          <ambientLight intensity={1.1} />
          <hemisphereLight intensity={0.6} groundColor="#26303f" color="#ffffff" />
          <directionalLight position={[4, 6, 3]} intensity={1.4} />
        </>
      )}
      {children}
    </Canvas>
  )
}
