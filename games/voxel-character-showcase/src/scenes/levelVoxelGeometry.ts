import { z } from 'zod'

const cellIndex = z.number().int().nonnegative()
const prefabSchema = z.object({
  size: z.tuple([z.number().int().positive(), z.number().int().positive(), z.number().int().positive()]),
  origin: z.tuple([z.number(), z.number(), z.number()]),
  runs: z.array(z.tuple([cellIndex, cellIndex, cellIndex, z.number().int().positive(), z.number().int().positive().max(2368)])),
})

export const voxelSceneSchema = z.object({
  format: z.literal('cubix-level-voxels'),
  version: z.literal(1),
  voxelSize: z.number().positive(),
  prefabs: z.record(z.string(), prefabSchema),
})

type VoxelPrefab = z.infer<typeof prefabSchema>

export interface VoxelGeometry {
  positions: Float32Array<ArrayBuffer>
  normals: Float32Array<ArrayBuffer>
  uv: Float32Array<ArrayBuffer>
  grain: Float32Array<ArrayBuffer>
  indices: Uint32Array<ArrayBuffer>
}

const axes = [[1, 2], [0, 2], [0, 1]] as const

/** Rebuild the exported GLB surface from the occupied cells and their authored finish codes. */
export function meshVoxelPrefab(prefab: VoxelPrefab, voxelSize: number): VoxelGeometry {
  const { size, origin, runs } = prefab
  const [nx, ny, nz] = size
  const grid = new Uint16Array(nx * ny * nz)
  const strides = [ny * nz, nz, 1]
  const index = (x: number, y: number, z: number) => x * ny * nz + y * nz + z
  for (const [x, y, z, span, code] of runs) {
    const shade = ((code - 1) >> 1) & 127
    if (x + span > nx || y >= ny || z >= nz || (shade > 24 && shade !== 31)) {
      throw new Error('A voxel run is outside its prefab or has an invalid shade.')
    }
    for (let i = 0; i < span; i++) grid[index(x + i, y, z)] = code
  }
  const positions: number[] = []
  const normals: number[] = []
  const uv: number[] = []
  const grain: number[] = []
  const indices: number[] = []

  for (const [axis, [uAxis, vAxis]] of axes.entries()) {
    const [depth, width, height] = [size[axis]!, size[uAxis], size[vAxis]]
    const keys = new Uint16Array(width * height)
    const depthStride = strides[axis]!
    const rowStride = strides[uAxis]!
    const columnStride = strides[vAxis]!
    const cell = (d: number, u: number, v: number) => (
      d < 0 || d >= depth || u < 0 || u >= width || v < 0 || v >= height
        ? 0 : grid[d * depthStride + u * rowStride + v * columnStride]!
    )
    for (const sign of [1, -1]) {
      for (let plane = 0; plane <= depth; plane++) {
        const outside = sign > 0 ? plane : plane - 1
        const inside = outside - sign
        if (inside < 0 || inside >= depth) continue
        const outsideInBounds = outside >= 0 && outside < depth
        let hasFaces = false
        for (let u = 0; u < width; u++) {
          const insideRow = inside * depthStride + u * rowStride
          const outsideRow = outside * depthStride + u * rowStride
          for (let v = 0; v < height; v++) {
            const column = v * columnStride
            const code = grid[insideRow + column]!
            if (!code || (outsideInBounds && grid[outsideRow + column])) continue
            const offset = u * height + v
            hasFaces = true
            const raw = code - 1
            const shade = (raw >> 1) & 127
            if (shade === 31) {
              keys[offset] = 1 + ((raw >> 8) << 8) + (63 << 1)
              continue
            }
            const occupied = (i: number, j: number) => Number(cell(outside, i, j) !== 0)
            const edge = occupied(u - 1, v) + occupied(u + 1, v) + occupied(u, v - 1) + occupied(u, v + 1)
            const diagonal = occupied(u - 1, v - 1) + occupied(u - 1, v + 1)
              + occupied(u + 1, v - 1) + occupied(u + 1, v + 1)
            const weight = 2 * edge + diagonal
            let occlusion = weight >= 6 ? 2 : weight >= 2 ? 1 : 0
            if (axis === 1) {
              occlusion += sign < 0 || cell(outside + 1, u, v) ? 2 : edge === 0 ? -1 : 0
            } else {
              occlusion += 2 * (axis === 0 ? occupied(u + 1, v) : occupied(u, v + 1))
            }
            const tone = Math.max(0, Math.min(16, Math.round(shade * 16 / 24) - occlusion))
            keys[offset] = 1 + ((raw >> 8) << 8) + (tone << 1) + (raw & 1)
          }
        }

        // The greedy pass clears every face key before the next plane.
        if (!hasFaces) continue
        for (let u = 0; u < width; u++) {
          for (let v = 0; v < height; v++) {
            const key = keys[u * height + v]!
            if (!key) continue
            let highV = v + 1
            while (highV < height && keys[u * height + highV] === key) highV++
            let highU = u + 1
            rows: while (highU < width) {
              for (let j = v; j < highV; j++) {
                if (keys[highU * height + j] !== key) break rows
              }
              highU++
            }
            for (let i = u; i < highU; i++) keys.fill(0, i * height + v, i * height + highV)
            const corners = [[u, v], [highU, v], [highU, highV], [u, highV]] as const
            const order = (sign > 0) === (axis !== 1) ? corners : [...corners].reverse()
            const first = positions.length / 3
            const raw = key - 1
            const tone = (raw >> 1) & 127
            const normal = [0, 0, 0]
            normal[axis] = sign
            for (const [cornerU, cornerV] of order) {
              const point = [...origin]
              point[axis]! += plane * voxelSize
              point[uAxis] = origin[uAxis] + cornerU * voxelSize
              point[vAxis] = origin[vAxis] + cornerV * voxelSize
              positions.push(...point)
              normals.push(...normal)
              uv.push(((raw >> 8) + 0.5) / 10, tone === 63 ? 0.96 : 0.15 + 0.7 * tone / 16)
              if (raw & 1) grain.push(cornerU + 17 * plane + 53 * axis, cornerV + 31 * plane + 97 * axis)
              else grain.push(-999, -999)
            }
            indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
          }
        }
      }
    }
  }
  return {
    positions: new Float32Array(positions), normals: new Float32Array(normals),
    uv: new Float32Array(uv), grain: new Float32Array(grain), indices: new Uint32Array(indices),
  }
}
