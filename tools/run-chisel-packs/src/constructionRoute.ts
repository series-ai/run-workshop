import { Raycaster, Vector3, type Mesh } from 'three'
import type { ConstructionLayout } from '../contracts/constructionKit'
import { HUMAN_SCALE } from '../contracts/worldScale'

const SAMPLE_SPACING = 0.10
const MAX_STEP_RISE = 0.21
const FOOT_CONTACT_OFFSETS = [0, -0.035, 0.035]
const HALF_BODY_WIDTH = 0.30
const BODY_PROBE_HEIGHTS = [0.30, 0.90, 1.55]
const HEADROOM_OFFSETS = [-HALF_BODY_WIDTH, -0.15, 0, 0.15, HALF_BODY_WIDTH]
const UP = new Vector3(0, 1, 0)
const DOWN = new Vector3(0, -1, 0)

interface RouteProblem {
  kind: 'floor gap' | 'step rise' | 'headroom' | 'width' | 'obstruction'
  point: [number, number, number]
}

export function measureConstructionRoute(route: ConstructionLayout['route'], meshes: Mesh[]) {
  meshes.forEach((mesh) => mesh.updateMatrixWorld(true))
  const ray = new Raycaster()
  const origin = new Vector3()
  const sample = new Vector3()
  const side = new Vector3()
  const forward = new Vector3()
  const problems: RouteProblem[] = []
  let samples = 0

  function cast(x: number, y: number, z: number, direction: Vector3, distance: number) {
    ray.set(origin.set(x, y, z), direction)
    ray.far = distance
    return ray.intersectObjects(meshes, false)[0]
  }

  function floorAt(x: number, y: number, z: number) {
    return cast(x, y + MAX_STEP_RISE, z, DOWN, 2 * MAX_STEP_RISE)?.point.y
  }

  let previous: Vector3 | undefined
  for (let i = 1; i < route.length; i++) {
    const start = new Vector3(...route[i - 1]!)
    const end = new Vector3(...route[i]!)
    side.set(end.z - start.z, 0, start.x - end.x).normalize()
    const steps = Math.max(1, Math.ceil(start.distanceTo(end) / SAMPLE_SPACING))

    for (let step = 0; step <= steps; step++) {
      const { x, y, z } = sample.lerpVectors(start, end, step / steps)
      const point: RouteProblem['point'] = [x, y, z]
      samples++
      let floor: number | undefined
      for (const offset of FOOT_CONTACT_OFFSETS) {
        const height = floorAt(x + side.x * offset, y, z + side.z * offset)
        if (height !== undefined && (floor === undefined || Math.abs(height - y) < Math.abs(floor - y))) floor = height
      }
      if (floor === undefined) {
        problems.push({ kind: 'floor gap', point })
        previous = undefined
        continue
      }
      if (previous) {
        const start = previous
        if (Math.abs(floor - start.y) > MAX_STEP_RISE) problems.push({ kind: 'step rise', point })
        forward.set(x - start.x, floor - start.y, z - start.z)
        const distance = forward.length()
        if (distance > 0.0001) {
          forward.divideScalar(distance)
          const blocked = BODY_PROBE_HEIGHTS.some((height) => [-HALF_BODY_WIDTH, 0, HALF_BODY_WIDTH].some((offset) =>
            cast(start.x + side.x * offset, start.y + height, start.z + side.z * offset, forward, distance),
          ))
          if (blocked) problems.push({ kind: 'obstruction', point })
        }
      }
      previous = new Vector3(x, floor, z)
      const soleClearance = 0.04
      const headroom = HUMAN_SCALE.referenceHeightM - soleClearance
      if (HEADROOM_OFFSETS.some((offset) => {
        const left = x + side.x * offset
        const front = z + side.z * offset
        // On a diagonal across a stair, one edge can be on the next tread.
        const tread = offset === 0 ? floor : floorAt(left, floor, front) ?? floor
        return cast(left, Math.max(tread, floor) + soleClearance, front, UP, headroom)
      })) {
        problems.push({ kind: 'headroom', point })
      }
      if (side.lengthSq() > 0 && BODY_PROBE_HEIGHTS.some((height) =>
        cast(x - side.x * HALF_BODY_WIDTH, floor + height, z - side.z * HALF_BODY_WIDTH, side, 2 * HALF_BODY_WIDTH),
      )) {
        problems.push({ kind: 'width', point })
      }
    }
  }

  return { samples, problems }
}
