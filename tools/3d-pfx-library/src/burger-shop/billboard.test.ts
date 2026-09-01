import { describe, expect, it } from 'vitest'
import { toLocalCameraPosition, verticalBillboardYaw } from './billboard'

describe('particle facing', () => {
  it('converts the world camera into the scaled effect space', () => {
    const local = toLocalCameraPosition(1.2, 0.96, 1.8, 0.24)
    expect(local[0]).toBeCloseTo(5)
    expect(local[1]).toBeCloseTo(4)
    expect(local[2]).toBeCloseTo(7.5)
  })

  it('yaws a vertical billboard so +Z faces the camera on the XZ plane', () => {
    expect(verticalBillboardYaw(0, 5, 0, 0)).toBeCloseTo(0)
    expect(verticalBillboardYaw(5, 0, 0, 0)).toBeCloseTo(Math.PI / 2)
  })

  it('uses the particle local position, not a mixed world camera', () => {
    const mixed = verticalBillboardYaw(1.2, 1.8, 1, 0)
    const local = verticalBillboardYaw(1.2 / 0.24, 1.8 / 0.24, 1, 0)
    expect(mixed).not.toBeCloseTo(local)
  })
})
