import { readFileSync } from 'node:fs'
import { AnimationMixer, Box3, LoopOnce, Mesh, MeshStandardMaterial, PropertyBinding, SpotLight, type Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { LevelPropEntry } from '../contracts/catalog'

function localPose(node: Object3D) {
  return { position: node.position.clone(), rotation: node.quaternion.clone(), scale: node.scale.clone() }
}

type Pose = ReturnType<typeof localPose>

function poseDistance(node: Object3D, pose: Pose): number {
  return Math.max(
    node.position.distanceTo(pose.position),
    node.quaternion.angleTo(pose.rotation),
    node.scale.distanceTo(pose.scale),
  )
}

function hasMesh(node: Object3D | undefined): boolean {
  let found = false
  node?.traverse((part) => { if (part instanceof Mesh) found = true })
  return found
}

export async function assertVehicleMotion(path: string, expected: NonNullable<LevelPropEntry['motion']>): Promise<void> {
  const bytes = Uint8Array.from(readFileSync(path))
  const { scene, animations } = await new GLTFLoader().parseAsync(bytes.buffer, '')
  const root = scene.getObjectByName('vehicle_root')
  const radius = root?.userData.wheelRadiusMeters
  if (!root || root.userData.forward !== '+Z' || root.userData.up !== '+Y'
    || typeof radius !== 'number' || !Number.isFinite(radius) || radius <= 0) {
    throw new Error(`${path}: invalid vehicle pivot or wheel radius.`)
  }
  if (Math.abs(new Box3().setFromObject(root).min.y) > 0.001) {
    throw new Error(`${path}: vehicle must rest on Y = 0.`)
  }
  if (animations.length !== expected.clips.length
    || expected.clips.some((name) => !animations.some((clip) => clip.name === name))) {
    throw new Error(`${path}: vehicle clips do not match the catalog.`)
  }

  const lightNames: string[] = []
  const materials = new Set<string>()
  root.traverse((node) => {
    if (node instanceof SpotLight) lightNames.push(node.name)
    if (!(node instanceof Mesh)) return
    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material]
    for (const material of nodeMaterials) {
      if (!(material instanceof MeshStandardMaterial) || material.map || material.normalMap
        || !node.geometry.hasAttribute('color')) {
        throw new Error(`${path}: vehicle surfaces must use texture-free vertex colors.`)
      }
      materials.add(material.name)
    }
  })
  if (materials.size < 2) throw new Error(`${path}: vehicle needs distinct physical surfaces.`)
  if (lightNames.length !== expected.lights.length || expected.lights.some((name) => !lightNames.includes(name))) {
    throw new Error(`${path}: vehicle lights do not match the catalog.`)
  }
  for (const name of expected.lights) {
    const lamp = root.getObjectByName(name)
    const lens = root.getObjectByName(name.replace(/_light$/, '_lens'))
    const intensity = lamp?.userData.intensityOn
    const color = lens?.userData.emissiveOn
    if (!(lamp instanceof SpotLight) || lamp.intensity !== 0
      || typeof intensity !== 'number' || !Number.isFinite(intensity) || intensity <= 0
      || lamp.target.parent !== lamp || !(lens instanceof Mesh) || lens.parent !== lamp.parent
      || !Array.isArray(color) || color.length !== 3
      || color.some((channel) => typeof channel !== 'number' || !Number.isFinite(channel) || channel < 0 || channel > 1)) {
      throw new Error(`${path}: invalid lamp or lens mounts for "${name}".`)
    }
  }

  const drive = animations.find((clip) => clip.name === 'Drive')
  const wheels = drive?.tracks.map(({ name }) => PropertyBinding.parseTrackName(name))
  if (wheels?.length !== 4 || new Set(wheels.map((wheel) => wheel.nodeName)).size !== 4
    || wheels.some((wheel) => wheel.propertyName !== 'quaternion'
      || !wheel.nodeName.endsWith('_spin') || !hasMesh(root.getObjectByName(wheel.nodeName)))) {
    throw new Error(`${path}: Drive must rotate four independent wheel pivots.`)
  }

  const mixer = new AnimationMixer(scene)
  for (const clip of animations) {
    if (!clip.validate() || clip.duration <= 0 || clip.tracks.length === 0) {
      throw new Error(`${path}: invalid animation "${clip.name}".`)
    }
    const targets = clip.tracks.map(({ name }) => {
      const { nodeName } = PropertyBinding.parseTrackName(name)
      const node = root.getObjectByName(nodeName)
      if (!node || node === root) throw new Error(`${path}: animation has an invalid pivot "${nodeName}".`)
      return { node, rest: localPose(node) }
    })
    const action = mixer.clipAction(clip).setLoop(LoopOnce, 1)
    action.clampWhenFinished = true
    action.reset().play()
    mixer.setTime(clip.duration / 3)
    if (!targets.some(({ node, rest }) => poseDistance(node, rest) > 0.01)) {
      throw new Error(`${path}: animation "${clip.name}" must move its mechanism.`)
    }
    mixer.setTime(clip.duration)
    if (targets.some(({ node, rest }) => poseDistance(node, rest) > 0.002)) {
      throw new Error(`${path}: animation "${clip.name}" must end in its parked pose.`)
    }
    action.stop()
  }
  mixer.uncacheRoot(scene)
}
