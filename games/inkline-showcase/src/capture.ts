import * as THREE from 'three'
import { AssetLibrary, addOutlines, applyAvatar, applyFigureShading, applyPropShading, disposeInstance, mountEquipment, supportEquipment } from './runtime/assets'
import { CONTACT_SHADOW, DISTRICT_OUTLINE, FLOOR, PAPER, type FigureRole } from './runtime/palette'
import { fitPerspectiveBox } from './runtime/camera'
import { EFFECT_BY_ID, effectPreviewBounds, InkEffects } from './runtime/effects'
import { DEFAULT_AVATAR, type AvatarConfig, type PackManifest } from './types'

interface MotionBounds { character: string; clip: string; minY: number; maxFloorY: number; maxExtent: number; finite: boolean }
type Vec3 = [number, number, number]
/** One posed figure in a key-art frame. */
interface KeyArtFigure { id: string; role: FigureRole; clip: string; time: number; at: Vec3; yaw: number; avatar?: Partial<AvatarConfig> }
/** A composed still from real runtime figures, for store art and promo frames. */
interface KeyArtShot {
  width: number; height: number; fov: number; eye: Vec3; target: Vec3; fog?: [number, number]
  figures: KeyArtFigure[]
  props?: { id: string; at: Vec3; yaw?: number }[]
  effects?: { id: string; at: Vec3; time: number; color?: string; scale?: number }[]
}
interface CaptureAPI {
  keyArt(shot: KeyArtShot): Promise<string>
  verifyMotion(): Promise<MotionBounds[]>
  model(id: string, animation?: string, time?: number, side?: boolean, framingHeight?: number, avatar?: AvatarConfig): Promise<{ png: string; triangles: number; calls: number }>
  effect(id: string, time: number): string
}
declare global { interface Window { inklineCapture: CaptureAPI } }
const manifest = await fetch('./assets/manifest.json').then(response => response.json()) as PackManifest
const library = new AssetLibrary(manifest)
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true })
renderer.setSize(384, 384); renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.appendChild(renderer.domElement)
const camera = new THREE.PerspectiveCamera(32, 1, .01, 200)
const scene = new THREE.Scene(); scene.background = new THREE.Color(PAPER)
let current: THREE.Object3D | null = null
let mixer: THREE.AnimationMixer | null = null
let effects: InkEffects | null = null
function clear(): void {
  if (current) { mixer?.stopAllAction(); if (mixer) mixer.uncacheRoot(current); disposeInstance(current) }
  current = null; mixer = null
  effects?.dispose(); effects = null
}
window.inklineCapture = {
  async verifyMotion() {
    clear()
    const results: MotionBounds[] = []
    for (const entry of manifest.models.filter(model => model.kind === 'character')) {
      const instance = await library.create(entry.id)
      const motion = new THREE.AnimationMixer(instance.root)
      for (const clip of instance.clips) {
        motion.stopAllAction()
        const action = motion.clipAction(clip).setLoop(THREE.LoopOnce, 1)
        action.clampWhenFinished = true
        action.reset().play()
        const result: MotionBounds = { character: entry.id, clip: clip.name, minY: Infinity, maxFloorY: -Infinity, maxExtent: 0, finite: true }
        const count = Math.ceil(clip.duration * 60)
        for (let sample = 0; sample <= count; sample++) {
          motion.setTime(clip.duration * sample / count)
          instance.root.updateMatrixWorld(true)
          instance.root.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.computeBoundingBox() })
          const bounds = new THREE.Box3().setFromObject(instance.root)
          const size = bounds.getSize(new THREE.Vector3())
          result.minY = Math.min(result.minY, bounds.min.y)
          result.maxFloorY = Math.max(result.maxFloorY, bounds.min.y)
          result.maxExtent = Math.max(result.maxExtent, size.x, size.y, size.z)
          result.finite &&= [...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)
        }
        results.push(result)
      }
      motion.stopAllAction(); motion.uncacheRoot(instance.root); disposeInstance(instance.root)
    }
    return results
  },
  async model(id, animation = 'idle', time = .35, side = false, framingHeight, avatar) {
    clear(); scene.background = new THREE.Color(PAPER)
    const model = await library.create(id)
    current = model.root; scene.add(current)
    if (model.entry.kind === 'character') {
      if (avatar) applyAvatar(model.root, avatar)
      else applyFigureShading(model.root, 'player')
      const clip = model.clips.find(item => item.name === animation)
      if (clip) { mixer = new THREE.AnimationMixer(current); mixer.clipAction(clip).play(); mixer.setTime(time) }
      if (avatar?.equipment) {
        const gear = await library.create(avatar.equipment)
        mountEquipment(model.root, gear, model.clips, manifest.animations)
        applyPropShading(gear.root); addOutlines(gear.root)
        supportEquipment(model.root, gear.root, animation, time)
      }
    } else { applyPropShading(current); addOutlines(current) }
    current.updateMatrixWorld(true)
    current.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.computeBoundingBox() })
    const box = new THREE.Box3().setFromObject(current), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3())
    const distance = Math.max(size.x, framingHeight ?? size.y, size.z) * (framingHeight ? 1.6 : 2.15)
    if (framingHeight) center.set(0, framingHeight * .46, 0)
    camera.position.copy(center).add(model.entry.kind === 'character'
      ? new THREE.Vector3(distance * (side ? 1.05 : .7), distance * .16, side ? 0 : distance * .85)
      : new THREE.Vector3(side ? distance : distance * .7, distance * .42, side ? 0 : distance))
    if (avatar?.equipment) {
      const initialDistance = camera.position.distanceTo(center)
      const offset = camera.position.clone().sub(center).normalize()
      fitPerspectiveBox(camera, box, center, 1.16)
      if (camera.position.distanceTo(center) < initialDistance) camera.position.copy(center).addScaledVector(offset, initialDistance)
    }
    camera.lookAt(center); camera.updateProjectionMatrix()
    renderer.render(scene, camera)
    return { png: renderer.domElement.toDataURL('image/png'), triangles: renderer.info.render.triangles, calls: renderer.info.render.calls }
  },
  async keyArt(shot) {
    clear(); scene.background = new THREE.Color(PAPER)
    scene.fog = shot.fog ? new THREE.Fog(PAPER, ...shot.fog) : null
    const root = new THREE.Group(); current = root; scene.add(root)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ color: FLOOR }))
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.025; floor.userData.ownedGeometry = true; root.add(floor)
    for (const placement of shot.props ?? []) {
      const prop = await library.create(placement.id)
      if (prop.entry.kind === 'character') throw new Error(`Key art prop is a character: ${placement.id}`)
      prop.root.position.set(...placement.at); prop.root.rotation.y = placement.yaw ?? 0
      applyPropShading(prop.root); root.add(prop.root); addOutlines(prop.root, DISTRICT_OUTLINE)
    }
    for (const figure of shot.figures) {
      const model = await library.create(figure.id)
      if (model.entry.kind !== 'character') throw new Error(`Key art figure is not a character: ${figure.id}`)
      applyAvatar(model.root, { ...DEFAULT_AVATAR, preset: figure.id, ...figure.avatar }, figure.role)
      const clip = model.clips.find(item => item.name === figure.clip)
      if (!clip) throw new Error(`Animation '${figure.clip}' is missing from ${figure.id}.`)
      const motion = new THREE.AnimationMixer(model.root); motion.clipAction(clip).play(); motion.setTime(figure.time)
      model.root.position.set(...figure.at); model.root.rotation.y = figure.yaw; root.add(model.root)
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(.34, 24), new THREE.MeshBasicMaterial({ color: CONTACT_SHADOW, transparent: true, opacity: .38, depthWrite: false }))
      shadow.rotation.x = -Math.PI / 2; shadow.position.set(figure.at[0], .012, figure.at[2]); shadow.scale.set(1, .65, 1); shadow.userData.ownedGeometry = true; root.add(shadow)
    }
    renderer.setSize(shot.width, shot.height)
    const view = new THREE.PerspectiveCamera(shot.fov, shot.width / shot.height, .01, 200)
    view.position.set(...shot.eye); view.lookAt(new THREE.Vector3(...shot.target)); view.updateMatrixWorld(); view.updateProjectionMatrix()
    if (shot.effects?.length) {
      effects = new InkEffects(); scene.add(effects.group)
      for (const burst of shot.effects) {
        effects.trigger(burst.id, new THREE.Vector3(...burst.at), burst.color, burst.scale ?? 1)
        for (let t = 0; t < burst.time; t += 1 / 60) effects.update(Math.min(1 / 60, burst.time - t), view)
      }
    }
    renderer.render(scene, view)
    const png = renderer.domElement.toDataURL('image/png')
    renderer.setSize(384, 384); scene.fog = null
    return png
  },
  effect(id, time) {
    clear(); scene.background = null; renderer.setClearColor(0, 0)
    effects = new InkEffects(); scene.add(effects.group)
    const preset = EFFECT_BY_ID.get(id)!
    const bounds = effectPreviewBounds(preset)
    const center = bounds.center.clone().add(new THREE.Vector3(0, 1, 0))
    const distance = Math.max(.16, bounds.radius) * 1.12 / Math.sin(THREE.MathUtils.degToRad(camera.fov * .5))
    camera.position.copy(center).add(new THREE.Vector3(0, .23, 1.3).normalize().multiplyScalar(distance))
    camera.lookAt(center); camera.updateProjectionMatrix()
    effects.trigger(id, new THREE.Vector3(0, 1, 0))
    for (let t = 0; t < time; t += 1 / 60) effects.update(Math.min(1 / 60, time - t), camera)
    renderer.render(scene, camera)
    return renderer.domElement.toDataURL('image/png')
  },
}
document.documentElement.dataset.ready = 'true'
