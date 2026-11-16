import { describe, expect, it } from 'vitest'
import { AnimationClip, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three'
import { clipCloses } from './clipCloses'

const turn = (deg: number) => new Quaternion().setFromAxisAngle({ x: 0, y: 1, z: 0 } as never, (deg * Math.PI) / 180).toArray()

describe('clipCloses', () => {
  it('accepts a clip that returns to its first pose', () => {
    const clip = new AnimationClip('loop', 1, [
      new QuaternionKeyframeTrack('Arm.R.quaternion', [0, 0.5, 1], [...turn(0), ...turn(40), ...turn(0)]),
      new VectorKeyframeTrack('Root.position', [0, 1], [0, 0, 0, 0, 0, 0]),
    ])
    expect(clipCloses(clip)).toBe(true)
  })

  it('accepts q and -q as the same pose', () => {
    const q = turn(30)
    const clip = new AnimationClip('spin', 1, [new QuaternionKeyframeTrack('Arm.R.quaternion', [0, 1], [...q, ...q.map((v) => -v)])])
    expect(clipCloses(clip)).toBe(true)
  })

  it('rejects a clip that ends in another pose', () => {
    const rot = new AnimationClip('aim', 1, [new QuaternionKeyframeTrack('Arm.R.quaternion', [0, 1], [...turn(0), ...turn(60)])])
    const move = new AnimationClip('rise', 1, [new VectorKeyframeTrack('Root.position', [0, 1], [0, 0, 0, 0, 0.2, 0])])
    expect(clipCloses(rot)).toBe(false)
    expect(clipCloses(move)).toBe(false)
  })
})
