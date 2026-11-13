import { describe, expect, it } from 'vitest'
import { chunkTriangles } from './shatter'

const tri = (x: number, y: number, z: number) => [x, y, z, x + .02, y, z, x, y + .02, z]

describe('figure shatter pieces', () => {
  it('groups triangles by the cell of their centroid and keeps every vertex', () => {
    const triangles = new Float32Array([...tri(.01, .01, .01), ...tri(.03, .02, .01), ...tri(.51, 1.2, .01)])
    const pieces = chunkTriangles(triangles, .11)
    expect(pieces).toHaveLength(2)
    expect(pieces.reduce((sum, piece) => sum + piece.positions.length, 0)).toBe(triangles.length)
  })
  it('centres each piece so world vertex = centre + local vertex', () => {
    const triangles = new Float32Array(tri(.51, 1.2, .01))
    const [piece] = chunkTriangles(triangles, .11)
    for (let i = 0; i < 9; i += 3) {
      expect(piece.center.x + piece.positions[i]).toBeCloseTo(triangles[i], 6)
      expect(piece.center.y + piece.positions[i + 1]).toBeCloseTo(triangles[i + 1], 6)
    }
  })
  it('cuts long triangles so no piece holds an edge longer than the cell', () => {
    const sliver = new Float32Array([0, 0, 0, 0, .5, 0, .02, 0, 0])
    const pieces = chunkTriangles(sliver, .11)
    expect(pieces.length).toBeGreaterThan(3)
    for (const { positions } of pieces) for (let t = 0; t < positions.length; t += 9) {
      const edge = (i: number, j: number) => Math.hypot(positions[t + i] - positions[t + j], positions[t + i + 1] - positions[t + j + 1], positions[t + i + 2] - positions[t + j + 2])
      expect(Math.max(edge(0, 3), edge(3, 6), edge(6, 0))).toBeLessThanOrEqual(.11 + 1e-6)
    }
  })
  it('rejects data that is not whole triangles', () => {
    expect(() => chunkTriangles(new Float32Array(8), .1)).toThrow(/three xyz vertices/)
  })
})
