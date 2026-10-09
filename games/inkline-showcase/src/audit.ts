import * as THREE from 'three'
import { InklineRenderer } from './runtime/renderer'
import { AssetLibrary, applyAvatar, disposeInstance, mountEquipment, supportEquipment } from './runtime/assets'
import { DEFAULT_AVATAR, DEFAULT_SETTINGS, type StageSettings, type StageStats } from './types'
import { parseManifest } from './catalog'

const manifest = parseManifest(await fetch('./assets/manifest.json').then(response => response.json()))
let settings: StageSettings = { ...DEFAULT_SETTINGS, mode: 'performance' }
let stats: StageStats | null = null
const stage = new InklineRenderer(document.getElementById('stage')!, manifest, settings, value => { stats = { ...value } })
let frames: number[] = [], measuring = false, last = 0
function frame(time: number): void {
  if (measuring && last) frames.push(time - last)
  last = time; requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
const api = {
  set(patch: Partial<StageSettings>) { settings = { ...settings, ...patch }; stage.update(settings) },
  artState() { return stage.inspect() },
  state() {
    const gl = stage.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info')
    return { stats, settings, buffer: { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight },
      gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string : gl.getParameter(gl.RENDERER) as string }
  },
  start() { frames = []; last = 0; measuring = true },
  finish() { measuring = false; return { frames, ...api.state() } },
  async verifyAvatars() {
    const library = new AssetLibrary(manifest)
    const results: { id: string; handError: number; finite: boolean; repeatedPositionsMatch: boolean; paleContours: number; blackContours: number; paleRepeatedPositionsMatch: boolean }[] = []
    for (const entry of manifest.models.filter(model => model.kind === 'character')) {
      const character = await library.create(entry.id), rifle = await library.create('rifle')
      const config = { ...DEFAULT_AVATAR, preset: entry.id, thickness: 1.3, height: 1.15, headScale: 1.2, headwear: 'cap' as const, equipment: 'rifle' }
      applyAvatar(character.root, config)
      const positions = new Map<THREE.SkinnedMesh, number[]>()
      character.root.traverse(object => { if (object instanceof THREE.SkinnedMesh) positions.set(object, [...object.geometry.getAttribute('position').array]) })
      applyAvatar(character.root, config)
      let repeatedPositionsMatch = true
      for (const [mesh, first] of positions) repeatedPositionsMatch &&= first.every((value, i) => value === mesh.geometry.getAttribute('position').array[i])
      const visibleContours = () => {
        let count = 0
        character.root.traverse(object => { if (object.userData.inkContour && object.visible) count++ })
        return count
      }
      applyAvatar(character.root, { ...config, color: '#faf9f5' })
      const paleContours = visibleContours()
      applyAvatar(character.root, { ...config, color: '#faf9f5' })
      const paleRepeatedPositionsMatch = [...positions].every(([mesh, first]) => first.every((value, i) => value === mesh.geometry.getAttribute('position').array[i])) && visibleContours() === paleContours
      applyAvatar(character.root, config)
      const blackContours = visibleContours()
      const mixer = new THREE.AnimationMixer(character.root), clip = character.clips.find(item => item.name === 'rifle-idle')!
      mixer.clipAction(clip).play(); mixer.update(0)
      mountEquipment(character.root, rifle, character.clips, manifest.animations)
      let handError = 0, finite = true
      for (let i = 0; i < 60; i++) {
        mixer.update(1 / 60); supportEquipment(character.root, rifle.root, 'rifle-idle')
        character.root.updateMatrixWorld(true)
        const grip = new THREE.Vector3(0, -.015, .19).applyMatrix4(rifle.root.matrixWorld)
        const palm = new THREE.Vector3(0, .04, 0).applyMatrix4(character.root.getObjectByName('Hand_L')!.matrixWorld)
        handError = Math.max(handError, grip.distanceTo(palm))
        character.root.traverse(object => { finite &&= object.matrixWorld.elements.every(Number.isFinite) })
      }
      results.push({ id: entry.id, handError, finite, repeatedPositionsMatch, paleContours, blackContours, paleRepeatedPositionsMatch })
      mixer.stopAllAction(); mixer.uncacheRoot(character.root); disposeInstance(character.root)
    }
    library.dispose()
    return results
  },
}
declare global { interface Window { inklineAudit: typeof api } }
window.inklineAudit = api
