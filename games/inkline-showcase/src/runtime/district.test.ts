import { describe, it, expect } from 'vitest'
import { CHECKPOINTS, DISTRICT_COLLISION } from './district'
import { moveBody, type Body } from './physics'

describe('industrial route', () => {
  it('reaches all seven checkpoints with movement, ramps, and a controlled drop', () => {
    const body: Body = { position: { x: 0, y: 0, z: 8 }, velocityY: 0, grounded: true, facing: Math.PI }
    let checkpoint = 0
    const waypoints = [[0, 9], [4, 9], [4, 4.5], [4, -.5], [4, -4.5], [0, -7], [-3, -3], [-3, 4]]
    for (const [x, z] of waypoints) {
      for (let step = 0; step < 500; step++) {
        const dx = x - body.position.x, dz = z - body.position.z
        const arrived = Math.hypot(dx, dz) < .08
        moveBody(body, { x: arrived ? 0 : dx, z: arrived ? 0 : dz, jump: false, dash: false }, DISTRICT_COLLISION, 1 / 60)
        const point = CHECKPOINTS[checkpoint]
        if (point && Math.hypot(body.position.x - point[0], body.position.y + .8 - point[1], body.position.z - point[2]) < .8) checkpoint++
        if (arrived && body.grounded) break
      }
    }
    expect(checkpoint).toBe(CHECKPOINTS.length)
    expect(body.grounded).toBe(true)
    expect(body.position.y).toBe(0)
  })
})
