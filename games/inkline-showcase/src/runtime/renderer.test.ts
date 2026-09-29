import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { InklineRenderer } from './renderer'
import type { Body } from './physics'

function landingStage() {
  // Use the real game update without a WebGL canvas.
  const stage = Object.create(InklineRenderer.prototype) as InklineRenderer
  const body: Body = { position: { x: 0, y: 0, z: 8 }, velocityY: 0, grounded: true, facing: 0 }
  const actor = {
    root: new THREE.Group(), shadow: new THREE.Mesh(undefined, new THREE.MeshBasicMaterial()),
    active: 'jump-land', hold: .36,
    actions: new Map(['run', 'sprint', 'jump-start'].map(id => [id, { time: 0, setEffectiveTimeScale: vi.fn() }])),
  }
  const input = new Set(['right'])
  Object.assign(stage, {
    actors: [actor], body, input, attack: null, jumpQueued: false, bufferRemaining: 0,
    settings: { mode: 'combat', motion: 'full', avatar: { equipment: null, height: 1 } },
    reducedMotion: { matches: false }, effects: { trigger: vi.fn() }, stepTimer: 1,
    moving: false, dashing: false, movementAccentCooldown: 1,
    clips: new Map([
      ['run', { travelSpeed: 3 }], ['sprint', { travelSpeed: 4.5 }],
      ['jump-start', { duration: .5, motion: { phases: [{ name: 'takeoff', frame: 6 }] } }],
    ]),
    play: (_actor: typeof actor, id: string) => { actor.active = id },
  })
  return { stage, body, actor, input, step: () => stage['updateGame'](1 / 60, 1 / 60, 1 / 60) }
}

describe('landing movement', () => {
  it.each([false, true])('holds the landing position until recovery ends (dash=%s)', dash => {
    const { body, actor, input, step } = landingStage()
    if (dash) input.add('dash')
    const landing = { ...body.position }
    for (let frame = 0; frame < 22; frame++) {
      step()
      expect(body.position).toEqual(landing)
    }
    expect(actor.hold).toBe(0)
    step()
    expect(body.position.x).toBeGreaterThan(landing.x)
    expect(actor.active).toBe(dash ? 'sprint' : 'run')
  })

  it('keeps steering in the air and then holds the landing position', () => {
    const { body, actor, step } = landingStage()
    body.position.y = .04; body.velocityY = -1; body.grounded = false
    step()
    expect(body.grounded).toBe(false)
    expect(body.position.x).toBeGreaterThan(0)
    step()
    expect(body.grounded).toBe(true)
    expect(actor.active).toBe('jump-land')
    const landing = { ...body.position }
    step()
    expect(body.position).toEqual(landing)
  })

  it('allows a new jump and horizontal steering during landing recovery', () => {
    const { stage, body, actor, step } = landingStage()
    Object.assign(stage, { jumpQueued: true })
    step()
    expect(body.grounded).toBe(false)
    expect(body.position.y).toBeGreaterThan(0)
    expect(body.position.x).toBeGreaterThan(0)
    expect(actor.active).toBe('jump-start')
  })
})
