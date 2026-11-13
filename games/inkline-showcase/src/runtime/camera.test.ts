import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { CameraClearance, CameraMotion, fitPerspectiveBox, minimumBodyDistance } from './camera'

function naiveObstruction(objects: readonly THREE.Object3D[], from: THREE.Vector3, to: THREE.Vector3, startClearance = .18): number | null {
  const direction = to.clone().sub(from)
  const distance = direction.length()
  if (distance <= startClearance) return null
  const ray = new THREE.Raycaster(from, direction.multiplyScalar(1 / distance), startClearance, distance)
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
  const hits: THREE.Intersection[] = []
  let nearest = distance
  let blocked = false
  for (const root of objects) {
    root.updateMatrixWorld(true)
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.SkinnedMesh) return
      const mesh = new THREE.Mesh(object.geometry, material)
      mesh.matrixAutoUpdate = false
      mesh.matrix.copy(object.matrixWorld)
      mesh.matrixWorld.copy(object.matrixWorld)
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
      const bounds = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld)
      if (!ray.ray.intersectsBox(bounds)) return
      hits.length = 0
      mesh.raycast(ray, hits)
      for (const hit of hits) {
        if (hit.distance < nearest) { nearest = hit.distance; blocked = true }
      }
    })
  }
  material.dispose()
  return blocked ? nearest : null
}

describe('camera clearance against visible geometry', () => {
  it('shortens the boom at a thin post without changing the requested angle', () => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(.12, 5, .12), new THREE.MeshBasicMaterial())
    post.position.set(0, 2.5, 3)
    const probes = new CameraClearance([post])
    const focus = new THREE.Vector3(0, 1, 0), desired = new THREE.Vector3(0, 2, 6)
    const safe = probes.resolve(focus, desired)
    expect(safe.z).toBeGreaterThan(0)
    expect(safe.distanceTo(focus)).toBeGreaterThan(2.5)
    expect(safe.clone().sub(focus).normalize().distanceTo(desired.clone().sub(focus).normalize())).toBeLessThan(1e-6)
    expect(probes.isOccluded(focus, safe)).toBe(true)
    probes.dispose(); post.geometry.dispose(); (post.material as THREE.Material).dispose()
  })
  it('keeps a clear view through an open rail frame instead of blocking its whole bounds', () => {
    const rail = new THREE.Group()
    for (const x of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(.1, 2, .1), new THREE.MeshBasicMaterial())
      post.position.set(x, 1, 3); rail.add(post)
    }
    const probes = new CameraClearance([rail])
    const focus = new THREE.Vector3(0, 1, 0), desired = new THREE.Vector3(0, 1.5, 6)
    expect(probes.resolve(focus, desired).distanceTo(desired)).toBeLessThan(1e-6)
    probes.dispose()
    rail.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose() } })
  })

  it('preserves parallel view direction when focus and aim have different heights', () => {
    const material = new THREE.MeshBasicMaterial()
    const wall = new THREE.Mesh(new THREE.BoxGeometry(.12, 5, 5), material)
    wall.position.set(2, 2.5, 0)
    const probes = new CameraClearance([wall])
    const focus = new THREE.Vector3(0, .9, 0), aim = new THREE.Vector3(0, 1, 0)
    const desired = new THREE.Vector3(12, 2.4, 0)
    const safe = probes.resolve(focus, desired, new THREE.Vector3(), 1.8, true, aim)
    expect(safe.distanceTo(desired)).toBeGreaterThan(1)
    expect(safe.distanceTo(aim)).toBeCloseTo(1.8 * 1.85, 6)
    expect(safe.clone().sub(aim).normalize().distanceTo(desired.clone().sub(aim).normalize())).toBeLessThan(1e-6)
    expect(probes.isOccluded(focus, safe, 1.8, true, aim)).toBe(true)
    probes.dispose(); wall.geometry.dispose(); material.dispose()
  })

  it('detects a narrow rail between the feet and chest samples', () => {
    const material = new THREE.MeshBasicMaterial()
    const rail = new THREE.Mesh(new THREE.BoxGeometry(.12, .04, 3), material)
    rail.position.set(2, .9 - 1.8 * .24 + 1.4 * 2 / 12, 0)
    const probes = new CameraClearance([rail])
    const focus = new THREE.Vector3(0, .9, 0), aim = new THREE.Vector3(0, 1, 0), desired = new THREE.Vector3(12, 2.4, 0)
    const offset = desired.clone().sub(aim)
    for (const y of [-.47, 0, .47]) {
      const point = focus.clone(); point.y += y * 1.8
      expect(probes.obstruction(point, point.clone().add(offset), .08)).toBeNull()
    }
    expect(probes.isOccluded(focus, desired, 1.8, true, aim)).toBe(true)
    const safe = probes.resolve(focus, desired, new THREE.Vector3(), 1.8, true, aim)
    expect(safe.distanceTo(aim)).toBeCloseTo(1.8 * 1.85, 6)
    expect(safe.clone().sub(aim).normalize().distanceTo(offset.normalize())).toBeLessThan(1e-6)
    probes.dispose(); rail.geometry.dispose(); material.dispose()
  })

  it('keeps top-view pitch and full-body distance under an overhead beam', () => {
    const material = new THREE.MeshBasicMaterial()
    const beam = new THREE.Mesh(new THREE.BoxGeometry(20, .2, 20), material)
    beam.position.set(0, 3, 2)
    const probes = new CameraClearance([beam])
    const focus = new THREE.Vector3(0, 1, 0), desired = new THREE.Vector3(0, 8, 4)
    const safe = probes.resolve(focus, desired, new THREE.Vector3(), 1.8, true)
    expect(safe.distanceTo(focus)).toBeCloseTo(1.8 * 1.85, 6)
    expect(safe.clone().sub(focus).normalize().distanceTo(desired.clone().sub(focus).normalize())).toBeLessThan(1e-6)
    expect(probes.isOccluded(focus, safe, 1.8, true)).toBe(true)
    probes.dispose(); beam.geometry.dispose(); material.dispose()
  })

  it('matches the original triangle query on deterministic synthetic many-mesh rays', () => {
    const scene = new THREE.Group()
    const geometry = new THREE.BoxGeometry(.35, 1.6, .35)
    const material = new THREE.MeshBasicMaterial()
    for (let row = 0; row < 8; row++) for (let column = 0; column < 7; column++) {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set((column - 3) * 1.2, .8 + (row % 2) * .05, 2 + row * 1.15)
      mesh.rotation.y = (row * 7 + column) % 3 * .1
      scene.add(mesh)
    }
    const probes = new CameraClearance([scene])
    const rays: Array<[THREE.Vector3, THREE.Vector3]> = [
      [new THREE.Vector3(0, .8, 0), new THREE.Vector3(0, .8, 12)],
      [new THREE.Vector3(2.4, .8, 0), new THREE.Vector3(2.4, .8, 12)],
      [new THREE.Vector3(-4, .8, 0), new THREE.Vector3(4, .8, 12)],
      [new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, 3, 12)],
      [new THREE.Vector3(-4, .35, 1), new THREE.Vector3(4, .35, 11)],
    ]
    const expected = rays.map(([from, to]) => naiveObstruction([scene], from, to))
    const raycastSpy = vi.spyOn(THREE.Mesh.prototype, 'raycast')
    const boundsSpy = vi.spyOn(THREE.Ray.prototype, 'intersectsBox')
    try {
      raycastSpy.mockClear()
      boundsSpy.mockClear()
      for (const [index, [from, to]] of rays.entries()) {
        const actual = probes.obstruction(from, to)
        if (expected[index] === null) expect(actual).toBeNull()
        else expect(actual).toBeCloseTo(expected[index]!, 8)
      }
      const acceleratedProbes = raycastSpy.mock.calls.length
      const acceleratedBounds = boundsSpy.mock.calls.length
      raycastSpy.mockClear()
      boundsSpy.mockClear()
      for (const [from, to] of rays) naiveObstruction([scene], from, to)
      expect(acceleratedProbes).toBeLessThanOrEqual(raycastSpy.mock.calls.length)
      expect(acceleratedBounds).toBeLessThan(boundsSpy.mock.calls.length)
    } finally {
      raycastSpy.mockRestore()
      boundsSpy.mockRestore()
    }
    probes.dispose(); material.dispose(); geometry.dispose()
  })

  it('does not dispose shared source geometry and stays safe after disposal', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshBasicMaterial()
    const first = new THREE.Mesh(geometry, material)
    const second = new THREE.Mesh(geometry, material)
    second.position.z = 3
    let disposed = 0
    geometry.addEventListener('dispose', () => { disposed++ })
    const probes = new CameraClearance([first, second])
    expect(probes.obstruction(new THREE.Vector3(0, 0, -2), new THREE.Vector3(0, 0, 5))).not.toBeNull()
    probes.dispose()
    expect(disposed).toBe(0)
    expect(probes.obstruction(new THREE.Vector3(0, 0, -2), new THREE.Vector3(0, 0, 5))).toBeNull()
    material.dispose(); geometry.dispose()
    expect(disposed).toBe(1)
  })
})

describe('perspective scene framing', () => {
  it('keeps all box corners inside a narrow and a wide viewport', () => {
    for (const aspect of [.46, 1.6]) {
      const camera = new THREE.PerspectiveCamera(38, aspect, .05, 180)
      const target = new THREE.Vector3(0, 2, 0)
      camera.position.set(20, 17, 28)
      const bounds = new THREE.Box3(new THREE.Vector3(-14, 0, -11), new THREE.Vector3(14, 10, 11))
      fitPerspectiveBox(camera, bounds, target)
      camera.updateMatrixWorld(true)
      for (const x of [-14, 14]) for (const y of [0, 10]) for (const z of [-11, 11]) {
        const point = new THREE.Vector3(x, y, z).project(camera)
        expect(Math.abs(point.x)).toBeLessThan(1)
        expect(Math.abs(point.y)).toBeLessThan(1)
        expect(point.z).toBeLessThan(1)
      }
    }
  })
})

describe('continuous camera motion', () => {
  function wall() {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(5, 5, .2), new THREE.MeshBasicMaterial())
    mesh.position.set(0, 2.5, 2)
    const clearance = new CameraClearance([mesh])
    return { clearance, dispose() { clearance.dispose(); mesh.geometry.dispose(); mesh.material.dispose() } }
  }

  it('bounds camera speed while entering a wall and keeps the requested direction', () => {
    const obstacle = wall(), motion = new CameraMotion()
    const target = new THREE.Vector3(-5, 1, 0), offset = new THREE.Vector3(0, 2, 6)
    motion.reset(target.clone().add(offset), target)
    let previous = motion.pose.position.clone()
    for (let frame = 0; frame < 240; frame++) {
      target.x += 1 / 30
      const pose = motion.update({ position: target.clone().add(offset), target, focus: target, bodyHeight: 1.8, parallel: false, delta: 1 / 60 }, obstacle.clearance)
      expect(pose.position.distanceTo(previous)).toBeLessThanOrEqual(22 / 60 + 1e-6)
      expect(pose.position.clone().sub(pose.target).normalize().distanceTo(offset.clone().normalize())).toBeLessThan(1e-6)
      expect(pose.position.distanceTo(pose.target)).toBeGreaterThanOrEqual(1.8 * 1.85 - 1e-6)
      previous.copy(pose.position)
    }
    obstacle.dispose()
  })

  it('does not extend the boom for a brief clear gap and later returns to the preferred distance', () => {
    const obstacle = wall(), motion = new CameraMotion()
    const target = new THREE.Vector3(0, 1, 0), position = new THREE.Vector3(0, 3, 6)
    const input = { position, target, focus: target, bodyHeight: 1.8, parallel: false, delta: 1 / 60 }
    motion.reset(position, target)
    for (let frame = 0; frame < 180; frame++) motion.update(input, obstacle.clearance)
    const shortDistance = motion.pose.position.distanceTo(motion.pose.target)
    expect(motion.occluded).toBe(true)
    for (let frame = 0; frame < 6; frame++) motion.update(input, null)
    expect(motion.pose.position.distanceTo(motion.pose.target)).toBeCloseTo(shortDistance, 6)
    motion.update(input, obstacle.clearance)
    for (let frame = 0; frame < 6; frame++) motion.update(input, null)
    expect(motion.pose.position.distanceTo(motion.pose.target)).toBeCloseTo(shortDistance, 6)
    for (let frame = 0; frame < 180; frame++) motion.update(input, null)
    expect(motion.pose.position.distanceTo(position)).toBeLessThan(.001)
    expect(motion.occluded).toBe(false)
    obstacle.dispose()
  })

  it('settles behind actual obstructions without flipping side or top view', () => {
    const material = new THREE.MeshBasicMaterial()
    const overhead = new THREE.Mesh(new THREE.BoxGeometry(20, .2, 20), material)
    overhead.position.set(0, 3, 0)
    const side = new THREE.Mesh(new THREE.BoxGeometry(.2, 20, 20), material)
    side.position.set(2, 10, 0)
    const clearance = new CameraClearance([overhead, side])
    for (const offset of [new THREE.Vector3(12, 1.4, 0), new THREE.Vector3(0, 16, 5)]) {
      const motion = new CameraMotion(), target = new THREE.Vector3(0, 1, 0), position = target.clone().add(offset)
      const input = { position, target, focus: target, bodyHeight: 1.8, parallel: true, delta: 1 / 60 }
      motion.reset(position, target)
      for (let frame = 0; frame < 240; frame++) motion.update(input, clearance)
      const previous = motion.pose.position.clone()
      expect(motion.occluded).toBe(true)
      expect(previous.distanceTo(target)).toBeCloseTo(1.8 * 1.85, 5)
      for (let frame = 0; frame < 120; frame++) {
        const pose = motion.update(input, clearance)
        expect(pose.position.distanceTo(previous)).toBeLessThan(.001)
        expect(pose.position.clone().sub(pose.target).normalize().distanceTo(offset.clone().normalize())).toBeLessThan(1e-6)
      }
    }
    clearance.dispose(); overhead.geometry.dispose(); side.geometry.dispose(); material.dispose()
  })

  it('keeps a viewport-specific minimum distance and resets without retaining the previous wall response', () => {
    const obstacle = wall(), motion = new CameraMotion()
    const target = new THREE.Vector3(0, 1, 0), position = new THREE.Vector3(0, 3, 8)
    const input = { position, target, focus: target, bodyHeight: 1.8, parallel: false, delta: 1 / 60, minimumDistance: 5.5 }
    motion.reset(position, target)
    for (let frame = 0; frame < 180; frame++) motion.update(input, obstacle.clearance)
    expect(motion.pose.position.distanceTo(motion.pose.target)).toBeCloseTo(5.5, 5)
    const nextTarget = new THREE.Vector3(20, 1, 0), nextPosition = new THREE.Vector3(20, 4, 12)
    motion.reset(nextPosition, nextTarget)
    expect(motion.pose.position.distanceTo(nextPosition)).toBeLessThan(1e-6)
    expect(motion.pose.target).toEqual(nextTarget)
    expect(motion.occluded).toBe(false)
    motion.update({ ...input, position: nextPosition, target: nextTarget, focus: nextTarget }, obstacle.clearance)
    expect(motion.pose.position.distanceTo(nextPosition)).toBeLessThan(1e-6)
    expect(motion.pose.target).toEqual(nextTarget)
    obstacle.dispose()
  })

  it('smooths a sudden target change and leaves a paused camera still', () => {
    const motion = new CameraMotion(), start = new THREE.Vector3(0, 1, 0), offset = new THREE.Vector3(4, 3, 6)
    motion.reset(start.clone().add(offset), start)
    const target = new THREE.Vector3(10, 1, 0), position = target.clone().add(offset)
    const before = motion.pose.position.clone()
    const pose = motion.update({ position, target, focus: target, bodyHeight: 1.8, parallel: false, delta: 1 / 60 }, null)
    expect(pose.target.x).toBeCloseTo(12 / 60, 6)
    expect(pose.position.distanceTo(before)).toBeCloseTo(12 / 60, 6)
    const pausedPosition = pose.position.clone(), pausedTarget = pose.target.clone()
    motion.update({ position, target, focus: target, bodyHeight: 1.8, parallel: false, delta: 0 }, null)
    expect(motion.pose.position).toEqual(pausedPosition)
    expect(motion.pose.target).toEqual(pausedTarget)
  })

  it('gives the same settled result at 30, 60, and 120 frames per second', () => {
    const obstacle = wall(), outputs: THREE.Vector3[] = []
    for (const rate of [30, 60, 120]) {
      const motion = new CameraMotion(), target = new THREE.Vector3(0, 1, 0), position = new THREE.Vector3(0, 3, 6)
      motion.reset(position, target)
      for (let frame = 0; frame < rate * 4; frame++) motion.update({ position, target, focus: target, bodyHeight: 1.8, parallel: false, delta: 1 / rate }, obstacle.clearance)
      outputs.push(motion.pose.position.clone())
    }
    expect(outputs[0].distanceTo(outputs[1])).toBeLessThan(.001)
    expect(outputs[1].distanceTo(outputs[2])).toBeLessThan(.001)
    obstacle.dispose()
  })
})


describe('fixed gameplay framing envelope', () => {
  it('keeps the recorded wall-stop foot inside the view while the target lags', () => {
    const target = new THREE.Vector3(2.8699999999989596, 1.05, 2.9748561553250954)
    const oldPosition = new THREE.Vector3(4.508334710048942, 2.4866935149669116, 5.495371093863529)
    const foot = new THREE.Vector3(3.036247198043011, .03262185344669177, 3.528917779688327)
    const camera = new THREE.PerspectiveCamera(38, 1.6, .05, 180)
    camera.position.copy(oldPosition); camera.lookAt(target); camera.updateMatrixWorld()
    expect(foot.clone().project(camera).y).toBeLessThan(-1)
    const offset = oldPosition.clone().sub(target)
    const minimum = minimumBodyDistance(1.801, 1.05, offset, camera.fov, camera.aspect)
    camera.position.copy(target).addScaledVector(offset.normalize(), minimum); camera.lookAt(target); camera.updateMatrixWorld()
    expect(Math.abs(foot.clone().project(camera).y)).toBeLessThan(.95)
  })
  it('fits the fixed body box for both viewports and the full horizontal tracking allowance', () => {
    const height = 1.801, aimHeight = 1.05, width = height * .3 + 1
    for (const aspect of [1440 / 900, 390 / 844]) for (const offset of [new THREE.Vector3(4.2, 2.8, 5.6), new THREE.Vector3(4.8, 2.7, 7.2)]) {
      const camera = new THREE.PerspectiveCamera(38, aspect, .05, 180)
      const distance = minimumBodyDistance(height, aimHeight, offset, camera.fov, aspect)
      camera.position.copy(offset).normalize().multiplyScalar(distance); camera.lookAt(0, 0, 0); camera.updateMatrixWorld()
      for (const x of [-width, width]) for (const y of [-aimHeight - .05, height - aimHeight + .05]) for (const z of [-width, width]) {
        const p = new THREE.Vector3(x, y, z).project(camera)
        expect(Math.abs(p.x)).toBeLessThan(.96); expect(Math.abs(p.y)).toBeLessThan(.96)
        expect(p.z).toBeGreaterThan(-1); expect(p.z).toBeLessThan(1)
      }
    }
  })
})
