import { ComponentProps, useEffect, useMemo } from 'react'
import * as THREE from 'three'

// Verified CylinderGeometry material-array index → surface mapping.
export const DISC_FACE = { side: 0, top: 1, bottom: 2 } as const
export type DiscFaceName = keyof typeof DISC_FACE

export type DiscFaceMap = Partial<Record<DiscFaceName, THREE.Texture | string>>

export interface DiscPieceProps extends Omit<ComponentProps<'mesh'>, 'ref'> {
  radius: number
  height: number
  // Texture or CSS color per surface; surfaces not listed use edgeColor. A
  // side texture wraps once around the rim, so paint it as a strip.
  faces: DiscFaceMap
  edgeColor?: string
  // Segments around the rim. Chips and checkers are small on screen, so 48 is
  // already past the point where more reads as rounder.
  segments?: number
  lit?: boolean
  roughness?: number
  transparentMaps?: boolean
}

export function DiscPiece({
  radius,
  height,
  faces,
  edgeColor = '#d8d0bc',
  segments = 48,
  lit = true,
  roughness = 0.5,
  transparentMaps = false,
  ...meshProps
}: DiscPieceProps) {
  const side = faces.side
  const top = faces.top
  const bottom = faces.bottom

  const materials = useMemo(() => {
    const resolved: DiscFaceMap = { side, top, bottom }
    const names = Object.keys(DISC_FACE) as DiscFaceName[]
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
  }, [side, top, bottom, edgeColor, lit, roughness, transparentMaps])

  // Materials are per-piece (cheap); textures are shared and cached — never
  // dispose textures here.
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials])

  return (
    <mesh material={materials} {...meshProps}>
      <cylinderGeometry args={[radius, radius, height, segments]} />
    </mesh>
  )
}
