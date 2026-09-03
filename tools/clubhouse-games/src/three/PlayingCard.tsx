import { ComponentProps, useEffect, useRef } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BackTheme } from '../backs/backThemes'
import { WORLD_H, WORLD_W, Z_OFF } from '../constants'
import { Card } from '../types'
import { getBackTexture, getFaceTexture } from './textures'

export type CardBackSource =
  | { kind: 'theme'; theme: BackTheme }
  | { kind: 'texture'; texture: THREE.Texture }

export interface PlayingCardProps extends Omit<ComponentProps<'group'>, 'ref'> {
  card: Card
  back: CardBackSource
  // Which side starts/animates to facing +z. Toggling animates the flip.
  faceUp?: boolean
  // Seconds per flip. 0 or negative = instant (no animation).
  flipDuration?: number
  // Art resolution multiplier for the procedural painters (default 1).
  artScale?: number
  // Casts a shadow onto whatever is below. The planes are rectangles, so the
  // shadow squares off the rounded corners.
  castShadow?: boolean
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// Loads a PNG back with the sRGB + anisotropy recipe applied. Use the result
// as `back={{ kind: 'texture', texture }}`.
export function useCardBackTexture(url: string): THREE.Texture {
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const tex = useLoader(THREE.TextureLoader, url)
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = Math.min(8, maxAniso)
    tex.needsUpdate = true
  }, [tex, maxAniso])
  return tex
}

export function PlayingCard({
  card,
  back,
  faceUp = true,
  flipDuration = 0.6,
  artScale = 1,
  castShadow = false,
  ...groupProps
}: PlayingCardProps) {
  const group = useRef<THREE.Group>(null)
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())

  const faceTex = getFaceTexture(card, maxAniso, { scale: artScale })
  const backTex =
    back.kind === 'theme'
      ? getBackTexture(back.theme, maxAniso, artScale)
      : back.texture

  // Flip animation state: ease rotation.y from the current angle to the
  // target (0 = face up, π = face down) whenever faceUp changes.
  const anim = useRef({ from: faceUp ? 0 : Math.PI, to: faceUp ? 0 : Math.PI, start: -1 })
  const prevFaceUp = useRef(faceUp)
  useEffect(() => {
    if (faceUp !== prevFaceUp.current) {
      prevFaceUp.current = faceUp
      anim.current = {
        from: group.current?.rotation.y ?? anim.current.to,
        to: faceUp ? 0 : Math.PI,
        start: -1, // latched on the first frame
      }
    }
  }, [faceUp])

  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const a = anim.current
    if (a.from === a.to) {
      g.rotation.y = a.to
      return
    }
    if (a.start < 0) a.start = clock.elapsedTime
    if (flipDuration <= 0) {
      // Instant flip — skip the interpolation entirely.
      g.rotation.y = a.to
      a.from = a.to
      return
    }
    const t = Math.min(1, (clock.elapsedTime - a.start) / flipDuration)
    g.rotation.y = a.from + (a.to - a.from) * easeInOutCubic(t)
    if (t >= 1) a.from = a.to
  })

  return (
    <group ref={group} {...groupProps}>
      {/* Front face: plane at +z, viewed from its front. */}
      <mesh position={[0, 0, Z_OFF]} castShadow={castShadow}>
        <planeGeometry args={[WORLD_W, WORLD_H]} />
        <meshBasicMaterial map={faceTex} transparent side={THREE.FrontSide} />
      </mesh>
      {/* Back face: plane at -z rotated 180° so its front faces -z; the back
          art reads un-mirrored after the flip (spike-verified). */}
      <mesh position={[0, 0, -Z_OFF]} rotation={[0, Math.PI, 0]} castShadow={castShadow}>
        <planeGeometry args={[WORLD_W, WORLD_H]} />
        <meshBasicMaterial map={backTex} transparent side={THREE.FrontSide} />
      </mesh>
    </group>
  )
}
