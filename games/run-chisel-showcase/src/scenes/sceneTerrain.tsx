import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, Float32BufferAttribute } from 'three'
import { COLOR_DIRECTION, propPaletteFor } from '@chisel/contracts/colorDirection'
import type { ContextPackKey } from '@chisel/contracts/packs'
import { STAGE_LOOK } from './stageLook'

type Point = readonly [number, number]
type Vertex = readonly [number, number, number]
type Face = (a: Vertex, b: Vertex, c: Vertex, color: Color, shade?: number, edgeShade?: number) => void
type Patch = readonly [x: number, z: number, width: number, depth: number, angle?: number, shade?: number]

const PATCHES: Record<ContextPackKey, readonly Patch[]> = {
  medieval: [
    [-5.25, 2.65, 3, 2.9, 0.3], [-5, 4, 3.3, 1.75, -0.2],
    [4.75, 2.65, 3.9, 2.4, 0.36], [3.75, 3.99, 4.2, 1.26, -0.16],
    [-4.7, -2.8, 3.35, 2.3, -0.35], [4.6, -2.4, 3.6, 2.8, 0.31],
  ],
  ww2: [
    [-4.5, 1.1, 3.7, 3.4, 0.28], [-3.6, 3.7, 3.3, 1.65, -0.45],
    [2, -2.25, 4.25, 3.2, 0.2], [4.4, -0.6, 2.6, 2.6, -0.3],
    [-5, -4, 2.8, 1.8, 0.45], [4.3, 4.15, 4.7, 1.73, 0.74],
    [-4.52, -4.2, 4.3, 1.76, 0.74], [1.3, 4.4, 2.6, 1.27, -0.26],
  ],
  sim: [
    [-4.4, -2.32, 4.78, 2.86], [1.75, -2.1, 4.8, 2.58],
    [5.36, -2.4, 2.68, 2.78], [5.24, -2.57, 1.7, 1.58, -0.14],
  ],
  cyberpunk: [
    [-3.53, -1.75, 2.58, 5.05], [3.47, -1.3, 2.65, 5.42],
    [3.63, -0.30, 2.48, 2.3], [2.97, 0.6, 1.71, 1.3, -0.08],
    [-3.41, -0.53, 2.16, 1.37], [-3.17, 2.91, 2.58, 1.55],
  ],
  monsters: [
    [-2.21, -1.2, 5.5, 3.51, 0.26], [-3.92, 0.09, 2.95, 2.25, 0.17],
    [1.35, 1.55, 4.7, 2.7, 0.68], [2.13, 0.2, 3.5, 1.15, 0.38],
    [3.90, -3.25, 2.9, 2.8, 0.4], [0.43, 1.85, 4.62, 3.1, -0.17, 1.67],
  ],
}

function dressGround(context: ContextPackKey, face: Face) {
  const points: Point[] = [[-0.5, -0.27], [-0.15, -0.48], [0.4, -0.43], [0.5, 0.12], [0.21, 0.5], [-0.37, 0.4]]
  const patchColor = new Color(COLOR_DIRECTION.packs[context].stage.environment.groundPatch)
  const patch = ([x, z, width, depth, angle = 0, shade = 1]: Patch, y: number) => {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const edge = points.map(([u, v]): Vertex => [x + u * width * cos - v * depth * sin, y, z + u * width * sin + v * depth * cos])
    for (let i = 0; i < edge.length; i++) {
      const faceShade = shade * (0.98 + (i % 3) * 0.025)
      face([x, y, z], edge[(i + 1) % edge.length]!, edge[i]!, patchColor, faceShade, shade > 1 ? 1.13 : faceShade)
    }
  }

  PATCHES[context].forEach((surface, i) => patch(surface, -0.009 + i * 0.0009))

  if (context === 'sim') {
    // A stone landing connects the café sill to the sidewalk.
    const rows: readonly [Vertex, Vertex][] = [
      [[0.13, 0.14, -2.055], [1.25, 0.14, -2.345]],
      [[0.27, 0.14, -1.52], [1.39, 0.14, -1.65]],
      [[0.40, 0.14, -0.99], [1.54, 0.14, -0.99]],
    ]
    const stone = new Color('#969582')
    for (let i = 0; i < rows.length - 1; i++) {
      const [a, b] = rows[i]!
      const [d, c] = rows[i + 1]!
      face(a, d, b, stone, 0.98)
      face(b, d, c, stone, 0.94)
      face(a, [a[0], 0, a[2]], d, stone, 0.70)
      face(d, [a[0], 0, a[2]], [d[0], 0, d[2]], stone, 0.70)
      face(b, c, [b[0], 0, b[2]], stone, 0.74)
      face(c, [c[0], 0, c[2]], [b[0], 0, b[2]], stone, 0.74)
    }
  }

  if (context === 'medieval') {
    const palette = propPaletteFor(context, 'prop_moat_water_tile')
    const water = new Color(palette.eye)
    const waterline = 0.08
    const bank = 0.675
    for (let x = -7; x < 7; x += 2) {
      const a: Vertex = [x, waterline, -bank]
      const b: Vertex = [x + 2, waterline, -bank]
      const c: Vertex = [x + 2, waterline, bank]
      const d: Vertex = [x, waterline, bank]
      face(a, c, b, water, 1.01 + (x % 3) * 0.03)
      face(a, d, c, water, 0.93 + (x % 3) * 0.02)
    }
    water.lerp(new Color(palette.skin), 0.34)
    for (const [x, z, span] of [[-6.4, -0.42, 0.65], [-5.35, 0.36, 0.91], [-3.67, -0.24, 1.3], [-2.75, 0.43, 0.73], [0.38, -0.32, 0.9], [1.42, 0.28, 1.06], [2.36, -0.44, 0.61], [4.19, 0.43, 0.72], [5.02, -0.38, 1.2], [6.6, 0.26, 0.56]] as const) {
      const y = waterline + 0.002
      face([x - span / 2, y, z], [x, y, z + 0.05], [x + span / 2, y, z], water)
      face([x + span / 2, y, z], [x, y, z - 0.053], [x - span / 2, y, z], water, 0.79)
    }
  }

  if (context === 'medieval' || context === 'ww2') {
    const grass = patchColor.clone().multiplyScalar(1.15)
    const clusters: Point[] = context === 'medieval'
      ? [[-6, 1.51], [-4.85, 1.55], [-3.65, 1.78], [-5.82, 3.38], [-3.61, 3.9], [0.86, 3.62], [1.74, 2.45], [3.1, 1.55], [5.92, 1.45], [5.31, 3.69], [2.72, 4.1], [-5.46, -2]]
      : [[-5.7, -3.53], [-3.72, -2.71], [0.92, -2.03], [4.15, -3.45], [6.06, -0.15], [5.55, 1.45], [2.84, 4.37], [-4.1, 3.63], [-5.64, 2.81], [-5.71, 0.1]]
    for (const [x, z] of clusters) {
      for (let i = 0; i < 3; i++) {
        const start = x + i * 0.076
        const root: Vertex = [start, 0, z + i * 0.045]
        const left: Vertex = [start - 0.07, 0, root[2]]
        const tip: Vertex = [start + (i - 1) * 0.14, 0.13 + (i % 2) * 0.07, root[2] - 0.055]
        face(left, root, tip, grass, 0.85 + 0.11 * i)
        face(root, left, tip, grass, 0.8)
      }
    }
  }
}

function cutawayGeometry(context: ContextPackKey, width: number, depth: number) {
  const colors = STAGE_LOOK[context].ground
  const x = width / 2 + 0.08
  const z = depth / 2 + 0.08
  const rim: Point[] = [
    [-x + 0.3, -z], [x - 0.54, -z], [x, -z + 0.48], [x, z - 0.38],
    [x - 0.38, z], [-x + 0.57, z], [-x, z - 0.45], [-x, -z + 0.28],
  ]
  const surface = new Color(colors[0])
  const middle = new Color(colors[1])
  const base = new Color(colors[2])
  const positions: number[] = []
  const tints: number[] = []

  const face = (a: Vertex, b: Vertex, c: Vertex, color: Color, shade = 1, edgeShade = shade) => {
    positions.push(...a, ...b, ...c)
    tints.push(color.r * shade, color.g * shade, color.b * shade)
    for (let i = 0; i < 2; i++) tints.push(color.r * edgeShade, color.g * edgeShade, color.b * edgeShade)
  }

  const level = (point: Point, height: number, inset = 0): Vertex => [
    point[0] * (1 - inset), height, point[1] * (1 - inset),
  ]

  const top = -0.012
  for (const [i, point] of rim.entries()) {
    const next = rim[(i + 1) % rim.length]!
    const a = level(point, top)
    const b = level(next, top)
    const c = level(point, -0.19, -0.012)
    const d = level(next, -0.19, -0.012)
    const e = level(point, -0.54 - (i % 3) * 0.042, 0.005)
    const f = level(next, -0.54 - ((i + 1) % rim.length % 3) * 0.042, 0.005)
    const g = level(point, -0.78, 0.032)
    const h = level(next, -0.78, 0.032)
    face([0, top, 0], b, a, surface, 0.96 + (i % 4) * 0.019)
    face(a, b, d, surface, 0.67)
    face(a, d, c, surface, 0.76)
    face(c, d, f, middle)
    face(c, f, e, middle, 0.87)
    face(e, f, h, base, 0.91)
    face(e, h, g, base)
  }

  dressGround(context, face)

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(tints, 3))
  geometry.computeVertexNormals()
  return geometry
}

export function ContextTerrain({ context, width, depth }: { context: ContextPackKey; width: number; depth: number }) {
  const geometry = useMemo(() => cutawayGeometry(context, width, depth), [context, width, depth])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  )
}
