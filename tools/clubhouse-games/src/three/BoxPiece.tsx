import { ComponentProps, RefObject, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Verified BoxGeometry material-array index → face mapping.
export const BOX_FACE = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 } as const
export type BoxFaceName = keyof typeof BOX_FACE

export type BoxFaceMap = Partial<Record<BoxFaceName, THREE.Texture | string>>

export interface BoxPieceProps extends Omit<ComponentProps<'mesh'>, 'ref'> {
  size: [number, number, number]
  // Texture or CSS color per face; faces not listed use edgeColor.
  faces: BoxFaceMap
  edgeColor?: string
  // Lit standard materials sell the chunk (needs lights in the scene);
  // basic materials keep the flat printed look of the card library.
  lit?: boolean
  roughness?: number
  // Textured faces use alpha. Dice pass false so rounded-corner paint
  // cannot punch holes through the cube.
  transparentMaps?: boolean
}

export function BoxPiece({
  size,
  faces,
  edgeColor = '#d8d0bc',
  lit = true,
  roughness = 0.55,
  transparentMaps = true,
  ...meshProps
}: BoxPieceProps) {
  const px = faces.px
  const nx = faces.nx
  const py = faces.py
  const ny = faces.ny
  const pz = faces.pz
  const nz = faces.nz

  const materials = useMemo(() => {
    const resolved: BoxFaceMap = { px, nx, py, ny, pz, nz }
    const names = Object.keys(BOX_FACE) as BoxFaceName[]
    return names.map((name) => {
      const face = resolved[name]
      const params =
        face === undefined || typeof face === 'string'
          ? { color: face ?? edgeColor }
          : { map: face, transparent: transparentMaps }
      return lit
        ? new THREE.MeshStandardMaterial({ roughness, ...params })
        : new THREE.MeshBasicMaterial(params)
    })
  }, [px, nx, py, ny, pz, nz, edgeColor, lit, roughness, transparentMaps])

  // Materials are per-piece (cheap); textures are shared and cached — never
  // dispose textures here.
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials])

  return (
    <mesh material={materials} {...meshProps}>
      <boxGeometry args={size} />
    </mesh>
  )
}

// Eases a group's rotation.y to 0 (face up) or π (face down) when faceUp
// changes — same feel as PlayingCard's flip.
export function useFlipY(
  ref: RefObject<THREE.Group | null>,
  faceUp: boolean,
  duration = 0.5,
): void {
  const anim = useRef({ from: faceUp ? 0 : Math.PI, to: faceUp ? 0 : Math.PI, start: -1 })
  const prev = useRef(faceUp)
  useEffect(() => {
    if (faceUp !== prev.current) {
      prev.current = faceUp
      anim.current = {
        from: ref.current?.rotation.y ?? anim.current.to,
        to: faceUp ? 0 : Math.PI,
        start: -1,
      }
    }
  }, [faceUp, ref])

  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const a = anim.current
    if (a.from === a.to) {
      g.rotation.y = a.to
      return
    }
    if (a.start < 0) a.start = clock.elapsedTime
    if (duration <= 0) {
      g.rotation.y = a.to
      a.from = a.to
      return
    }
    const t = Math.min(1, (clock.elapsedTime - a.start) / duration)
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    g.rotation.y = a.from + (a.to - a.from) * e
    if (t >= 1) a.from = a.to
  })
}
