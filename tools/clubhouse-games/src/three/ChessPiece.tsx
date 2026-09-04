import { ComponentProps, useMemo } from 'react'
import * as THREE from 'three'
import { CHESS_HEIGHTS, CHESS_PALETTES, ChessColor, ChessType } from '../chess/pieces'
import { chessProfile, profileTop } from '../chess/profiles'

export interface ChessPieceProps extends Omit<ComponentProps<'group'>, 'ref'> {
  type: ChessType
  color?: ChessColor
  // Height of a king. Every other piece is scaled off it.
  scale?: number
  segments?: number
}

export function ChessPiece({
  type,
  color = 'white',
  scale = 1,
  segments = 40,
  ...groupProps
}: ChessPieceProps) {
  const pal = CHESS_PALETTES[color]
  const height = CHESS_HEIGHTS[type] * scale

  const geometry = useMemo(() => {
    const points = chessProfile(type).map(([r, y]) => new THREE.Vector2(r * height, y * height))
    return new THREE.LatheGeometry(points, segments)
  }, [type, height, segments])

  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: pal.body, roughness: pal.roughness }),
    [pal.body, pal.roughness],
  )

  useMemo(() => () => geometry.dispose(), [geometry])

  return (
    <group {...groupProps}>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      <Carved type={type} height={height} material={material} segments={segments} />
      {/* Felted base pad, as a weighted piece has underneath. */}
      <mesh position={[0, 0.004 * scale, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42 * height, segments]} />
        <meshStandardMaterial color={pal.base} roughness={0.9} />
      </mesh>
    </group>
  )
}

// The parts a lathe cannot cut: crenellations, a mitre, a coronet, a cross,
// and the knight's head.
function Carved({
  type,
  height,
  material,
  segments,
}: {
  type: ChessType
  height: number
  material: THREE.Material
  segments: number
}) {
  const top = profileTop(type) * height

  if (type === 'rook') {
    // Four battlements cut out of the rim.
    const r = 0.33 * height
    return (
      <>
        {Array.from({ length: 4 }, (_, i) => {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4
          return (
            <mesh
              key={i}
              material={material}
              castShadow
              position={[Math.cos(a) * r * 0.72, top + 0.05 * height, Math.sin(a) * r * 0.72]}
              rotation={[0, -a, 0]}
            >
              <boxGeometry args={[r * 0.62, 0.14 * height, r * 0.62]} />
            </mesh>
          )
        })}
      </>
    )
  }

  if (type === 'bishop') {
    // Finial ball, and the slit cut across the mitre.
    return (
      <>
        <mesh material={material} castShadow position={[0, top + 0.02 * height, 0]}>
          <sphereGeometry args={[0.055 * height, segments, segments / 2]} />
        </mesh>
        <mesh
          castShadow
          position={[0, 0.8 * height, 0.09 * height]}
          rotation={[0.5, 0, 0]}
        >
          <boxGeometry args={[0.035 * height, 0.2 * height, 0.06 * height]} />
          <meshStandardMaterial color="#000000" roughness={0.9} opacity={0.55} transparent />
        </mesh>
      </>
    )
  }

  if (type === 'queen') {
    // Coronet: a ring of pearls around the crown.
    const r = 0.2 * height
    return (
      <>
        {Array.from({ length: 9 }, (_, i) => {
          const a = (i / 9) * Math.PI * 2
          return (
            <mesh
              key={i}
              material={material}
              castShadow
              position={[Math.cos(a) * r, top + 0.02 * height, Math.sin(a) * r]}
            >
              <sphereGeometry args={[0.05 * height, 16, 10]} />
            </mesh>
          )
        })}
        <mesh material={material} castShadow position={[0, top + 0.05 * height, 0]}>
          <sphereGeometry args={[0.07 * height, segments, segments / 2]} />
        </mesh>
      </>
    )
  }

  if (type === 'king') {
    // Cross patée on a short collar.
    return (
      <>
        <mesh material={material} castShadow position={[0, top + 0.02 * height, 0]}>
          <cylinderGeometry args={[0.09 * height, 0.12 * height, 0.05 * height, segments]} />
        </mesh>
        <mesh material={material} castShadow position={[0, top + 0.11 * height, 0]}>
          <boxGeometry args={[0.055 * height, 0.19 * height, 0.055 * height]} />
        </mesh>
        <mesh material={material} castShadow position={[0, top + 0.13 * height, 0]}>
          <boxGeometry args={[0.15 * height, 0.055 * height, 0.055 * height]} />
        </mesh>
      </>
    )
  }

  if (type === 'knight') {
    return <KnightHead height={height} material={material} top={top} />
  }

  return null
}

// The knight is carved rather than turned, so it is an extruded silhouette
// standing across the base.
function KnightHead({
  height,
  material,
  top,
}: {
  height: number
  material: THREE.Material
  top: number
}) {
  const geometry = useMemo(() => {
    // Drawn in profile facing +x, in a box roughly 1 wide by 1 tall, then
    // scaled. Keeping it normalized makes the outline easy to read and tune.
    const u = 0.62 * height
    const shape = new THREE.Shape()
    shape.moveTo(-0.34 * u, 0)
    shape.lineTo(0.2 * u, 0)
    // Throat up to the jaw.
    shape.quadraticCurveTo(0.26 * u, 0.16 * u, 0.32 * u, 0.3 * u)
    // Muzzle.
    shape.quadraticCurveTo(0.42 * u, 0.36 * u, 0.5 * u, 0.44 * u)
    shape.quadraticCurveTo(0.54 * u, 0.52 * u, 0.44 * u, 0.56 * u)
    // Forehead back to the brow.
    shape.quadraticCurveTo(0.32 * u, 0.6 * u, 0.24 * u, 0.66 * u)
    // Two ears with a notch between them.
    shape.lineTo(0.26 * u, 0.9 * u)
    shape.lineTo(0.14 * u, 0.72 * u)
    shape.lineTo(0.04 * u, 0.92 * u)
    shape.lineTo(-0.04 * u, 0.7 * u)
    // Mane down the back of the neck.
    shape.quadraticCurveTo(-0.18 * u, 0.68 * u, -0.24 * u, 0.5 * u)
    shape.quadraticCurveTo(-0.32 * u, 0.3 * u, -0.34 * u, 0)
    shape.closePath()

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: 0.34 * u,
      bevelEnabled: true,
      bevelSize: 0.03 * u,
      bevelThickness: 0.03 * u,
      bevelSegments: 3,
      curveSegments: 16,
    })
    // Centred on x and z only: the head keeps its own footing on the lathe.
    geom.computeBoundingBox()
    const bb = geom.boundingBox!
    geom.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2)
    return geom
  }, [height])

  useMemo(() => () => geometry.dispose(), [geometry])

  return (
    <mesh
      geometry={geometry}
      material={material}
      castShadow
      receiveShadow
      position={[0, top - 0.02 * height, 0]}
    />
  )
}
