import { expect, test } from 'vitest'
import { meshVoxelPrefab } from './levelVoxelGeometry'

test('merges compatible faces and keeps the local voxel offset', () => {
  const result = meshVoxelPrefab({ size: [2, 1, 1], origin: [-0.13, 0.03, -0.05], runs: [[0, 0, 0, 2, 25]] }, 0.1)
  expect(result.indices).toHaveLength(36)
  const positions = Array.from(result.positions)
  expect(Math.min(...positions.filter((_, i) => i % 3 === 0))).toBeCloseTo(-0.13)
  expect(Math.max(...positions.filter((_, i) => i % 3 === 0))).toBeCloseTo(0.07)
  expect(Math.min(...positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(0.03)
  expect(result.grain.every(value => value === -999)).toBe(true)
})

test('keeps authored face regions and emissive cells separate', () => {
  const result = meshVoxelPrefab({ size: [2, 1, 1], origin: [0, 0, 0], runs: [[0, 0, 0, 1, 26], [1, 0, 0, 1, 1087]] }, 0.1)
  expect(result.indices).toHaveLength(60)
  expect(Array.from(result.uv).some(value => Math.abs(value - 0.96) < 1e-6)).toBe(true)
  expect(Array.from(result.grain).some(value => value >= 0)).toBe(true)
})
