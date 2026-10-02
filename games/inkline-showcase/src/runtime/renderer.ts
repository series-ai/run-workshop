import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { AnimationEntry, PackManifest, StageSettings, StageStats } from '../types'
import { AssetLibrary, addOutlines, applyAvatar, animationBounds, disposeInstance, equipmentContactPoint, equipmentPose, mountEquipment, supportEquipment } from './assets'
import { CHECKPOINTS, createDistrict, DISTRICT_COLLISION } from './district'
import { EXTRA_LAYOUTS } from './layouts'
import { ROLE_BY_ID } from './roles'
import { EFFECTS, EFFECT_BY_ID, effectPreviewBounds, InkEffects } from './effects'
import { CameraClearance, CameraMotion, fitPerspectiveBox, minimumBodyDistance } from './camera'
import { ForegroundCutaway } from './cutaway'
import { InkTrails } from './trails'
import { ACTION_BUFFER_SECONDS, getImpactProfile, sampleRecoil, sampleKnockdown, selectReaction, stepActionBuffer, type ImpactProfile } from './kinetics'
import { moveBody, supportAt, type Body } from './physics'
import { advanceAttack, attackContactBone, cameraImpulse, combatMove, startAttack, type AttackBeat, type AttackKind } from './presentation'

interface ReactionBase { profile: ImpactProfile; age: number; direction: THREE.Vector3; startOffset: THREE.Vector3; rotation: THREE.Quaternion }
type Reaction = (ReactionBase & { kind: 'hit' }) | (ReactionBase & { kind: 'fall'; facing: THREE.Quaternion; clip: 'knockdown' | 'death' })
interface Actor {
  root: THREE.Group; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>
  clips: Map<string, THREE.AnimationClip>
  active: string; shadow: THREE.Mesh; hold: number; health: number; respawn: number
  spawn: THREE.Vector3; spawnRotation: THREE.Quaternion | null; origin: THREE.Vector3; recoil: THREE.Vector3; sequencePhase: number; reaction: Reaction | null
}
type InputAction = 'left' | 'right' | 'forward' | 'back' | 'jump' | 'attack' | 'dash' | 'reset'
const CAMERA_POSE_BONES = ['Head', 'Chest', 'Hips', 'Forearm_L', 'Forearm_R', 'Hand_L', 'Hand_R', 'Shin_L', 'Shin_R', 'Foot_L', 'Foot_R'] as const
const SHOWCASE_SEQUENCE = [
  { clip: 'punch-right', recovery: .12 },
  { clip: 'punch-left', recovery: .12 },
  { clip: 'kick-roundhouse', recovery: .18 },
  { clip: 'punch-heavy', recovery: .38 },
] as const
const SHOWCASE_POSITIONS = { hero: [-.65, 0, 3], rival: [.3, 0, 3] } as const
const ACROBAT_SEQUENCE = [
  { duration: .7, clip: 'idle', from: [2.8, .8, -3], to: [2.8, .8, -3], arc: 0 },
  { duration: .62, clip: 'run', from: [2.8, .8, -3], to: [2.8, .8, -2.15], arc: 0 },
  { duration: .65, clip: 'run', from: [2.8, .8, -2.15], to: [2.8, 0, .35], arc: 0 },
  { duration: .14, clip: 'jump-start', from: [2.8, 0, .35], to: [2.8, .3, .62], arc: 0 },
  { duration: .55, clip: 'jump-loop', from: [2.8, .3, .62], to: [2.8, 0, 2.15], arc: .8 },
  { duration: .32, clip: 'jump-land', from: [2.8, 0, 2.15], to: [2.8, 0, 2.15], arc: 0 },
  { duration: .45, clip: 'turn-right', from: [2.8, 0, 2.15], to: [2.8, 0, 2.15], arc: 0 },
  { duration: .5, clip: 'run', from: [2.8, 0, 2.15], to: [2.8, 0, .35], arc: 0 },
  { duration: .7, clip: 'run', from: [2.8, 0, .35], to: [2.8, .8, -2.15], arc: 0 },
  { duration: .45, clip: 'run', from: [2.8, .8, -2.15], to: [2.8, .8, -3], arc: 0 },
] as const
const OVERVIEW_BOUNDS = new THREE.Box3().setFromPoints([
  ...Object.values(SHOWCASE_POSITIONS).map(position => new THREE.Vector3(...position)),
  ...ACROBAT_SEQUENCE.flatMap(phase => [phase.from, phase.to].map(position => new THREE.Vector3(position[0], position[1] + phase.arc, position[2]))),
]).expandByVector(new THREE.Vector3(.95, 0, .95))
OVERVIEW_BOUNDS.max.y += 2.05
const INPUT_KEYS: Record<string, InputAction> = {
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
  Space: 'jump', KeyJ: 'attack', ShiftLeft: 'dash', ShiftRight: 'dash', KeyR: 'reset',
}
const emptyStats = (): StageStats => ({ fps: 0, frameMs: 0, calls: 0, triangles: 0, geometries: 0,
  textures: 0, elapsed: 0, figures: 0, effects: 0, score: 0, message: '', loading: true, error: null })

export class InklineRenderer {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = new THREE.PerspectiveCamera(38, 1, .05, 180)
  private viewRadius = 4
  private readonly controls: OrbitControls
  private readonly library: AssetLibrary
  private readonly effects = new InkEffects()
  private readonly trails = new InkTrails()
  private readonly trailInner = new THREE.Vector3()
  private readonly trailOuter = new THREE.Vector3()
  private readonly trailAxis = new THREE.Vector3()
  private trailTime = 0
  private trailClipTime = 0
  private readonly content = new THREE.Group()
  private readonly grid: THREE.GridHelper
  private readonly resizeObserver: ResizeObserver
  private readonly clock = new THREE.Clock()
  private readonly input = new Set<InputAction>()
  private readonly clips: Map<string, AnimationEntry>
  private readonly body: Body = { position: { x: 0, y: 0, z: 8 }, velocityY: 0, grounded: true, facing: Math.PI }
  private readonly target = new THREE.Vector3()
  private settings: StageSettings
  private actors: Actor[] = []
  private outlines: THREE.Group[] = []
  private pickups: THREE.Mesh[] = []
  private clearance: CameraClearance | null = null
  private equipment: THREE.Object3D | null = null
  private previewFrame: { key: string; bounds: THREE.Box3 } | null = null
  private previewAspect = Infinity
  private sceneKey = ''
  private generation = 0
  private equipmentGeneration = 0
  private contextUnavailable = false
  private disposed = false
  private raf = 0
  private elapsed = 0
  private animationElapsed = 0
  private effectTimer = 0
  private effectSlots: number[] = []
  private attack: AttackBeat | null = null
  private impactHold = 0
  private impulseAge = 1
  private impulseStrength = 0
  private impulseZoom = 0
  private readonly cameraLead = new THREE.Vector3()
  private readonly cameraMotion = new CameraMotion()
  private readonly preferredOrbitCamera = new THREE.PerspectiveCamera(38, 1, .05, 180)
  private readonly preferredCameraPosition = new THREE.Vector3()
  private readonly preferredCameraTarget = new THREE.Vector3()
  private readonly bodyFocus = new THREE.Vector3()
  private readonly foregroundCutaway = new ForegroundCutaway()
  private secondaryCutawayTarget: Actor | null = null
  private readonly desiredCameraLead = new THREE.Vector3()
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  private readonly contacts: { clip: string; clipTime: number; expectedTime: number; hits: number }[] = []
  private showcasePhase = -1
  private showcaseTime = 0
  private showcaseAttack: AttackBeat | null = null
  private pendingContact: AttackBeat | null = null
  private stepTimer = 0
  private moving = false
  private dashing = false
  private movementAccentCooldown = 0
  private combo = 0
  private checkpoint = 0
  private score = 0
  private sampleFrames: number[] = []
  private statsTimer = 0
  private stats = emptyStats()
  private jumpQueued = false
  private bufferRemaining = 0
  private readonly reactionAxis = new THREE.Vector3()
  private readonly reactionRotation = new THREE.Quaternion()
  private floor: THREE.Mesh
  constructor(private readonly container: HTMLElement, manifest: PackManifest, settings: StageSettings,
    private readonly onStats: (stats: StageStats) => void) {
    this.settings = settings
    this.library = new AssetLibrary(manifest)
    this.clips = new Map(manifest.animations.map(clip => [clip.id, clip]))
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor('#eeece5')
    this.renderer.setPixelRatio(1)
    this.renderer.domElement.setAttribute('aria-label', 'Interactive 3D asset view. Drag to orbit. Use the labeled controls to change the scene.')
    this.renderer.domElement.setAttribute('role', 'application')
    this.renderer.domElement.tabIndex = 0
    this.container.appendChild(this.renderer.domElement)
    this.scene.background = new THREE.Color('#eeece5')
    this.scene.fog = new THREE.Fog('#eeece5', 95, 175)
    this.camera.position.set(5, 3, 6)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.addEventListener('start', () => { this.previewAspect = this.container.clientWidth / Math.max(1, this.container.clientHeight) })
    this.controls.enableDamping = true; this.controls.dampingFactor = .12
    this.controls.minDistance = 1; this.controls.maxDistance = 160
    this.controls.maxPolarAngle = Math.PI / 2 - .015
    this.controls.target.set(0, 1, 0)
    this.scene.add(this.content, this.effects.group, this.trails.group)
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshBasicMaterial({ color: '#eeece5' }))
    this.floor.rotation.x = -Math.PI / 2; this.floor.position.y = -.025; this.scene.add(this.floor)
    this.grid = new THREE.GridHelper(40, 40, '#ccd0c4', '#dfe1d7')
    this.grid.position.y = -.02; this.scene.add(this.grid)
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeReviewView()
    })
    this.resizeObserver.observe(container); this.resize()
    window.addEventListener('keydown', this.keyDown)
    window.addEventListener('keyup', this.keyUp)
    window.addEventListener('blur', this.clearInput)
    window.addEventListener('inkline-input', this.customInput)
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost)
    void this.rebuild()
    this.tick()
  }
  private readonly contextLost = (event: Event) => {
    event.preventDefault(); this.contextUnavailable = true; this.stats.error = 'The graphics context was lost. Reload this page to restore the view.'; this.emitStats()
  }
  private isGame(): boolean { return this.settings.mode === 'combat' || this.settings.mode === 'parkour' }
  private motionReduced(): boolean { return this.reducedMotion.matches || this.settings.motion === 'reduced' }
  private readonly keyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) { this.clearInput(); return }
    if (!this.isGame() || (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(event.target.tagName)))) return
    const action = INPUT_KEYS[event.code]
    if (!action) return
    event.preventDefault()
    if (!event.repeat) this.setInput(action, true)
  }
  private readonly keyUp = (event: KeyboardEvent) => { const action = INPUT_KEYS[event.code]; if (action) this.setInput(action, false) }
  private readonly clearInput = () => { this.input.clear(); this.jumpQueued = false; this.bufferRemaining = 0 }
  private readonly customInput = (event: Event) => {
    if (!(event instanceof CustomEvent) || !event.detail || typeof event.detail !== 'object') return
    const detail: unknown = event.detail
    const data = detail as Record<string, unknown>
    if (typeof data.action === 'string' && ['left', 'right', 'forward', 'back', 'jump', 'attack', 'dash', 'reset'].includes(data.action) && typeof data.pressed === 'boolean') this.setInput(data.action as InputAction, data.pressed)
  }
  private setInput(action: InputAction, pressed: boolean): void {
    if (pressed) {
      if (!this.settings.playing && (action === 'attack' || action === 'jump')) return
      if (this.input.has(action)) return
      this.input.add(action)
      if (action === 'jump') this.jumpQueued = true
      if (action === 'attack') this.bufferRemaining = ACTION_BUFFER_SECONDS
      if (action === 'reset') this.resetGame()
    } else this.input.delete(action)
  }
  private resize(): void {
    const width = Math.max(1, this.container.clientWidth), height = Math.max(1, this.container.clientHeight)
    const pixelScale = this.settings.quality === 'high' ? Math.min(window.devicePixelRatio, 1.5) : Math.min(1, 720 / height)
    this.renderer.setPixelRatio(pixelScale); this.renderer.setSize(width, height)
    if (this.camera instanceof THREE.PerspectiveCamera) this.camera.aspect = width / height
    else { this.camera.left = -this.viewRadius * width / height; this.camera.right = this.viewRadius * width / height; this.camera.top = this.viewRadius; this.camera.bottom = -this.viewRadius }
    this.camera.updateProjectionMatrix()
  }
  private previewSceneBounds(): THREE.Box3 | null {
    const mode = this.settings.mode
    return mode === 'overview' ? OVERVIEW_BOUNDS : this.getPreviewBounds() ?? (['assets', 'district', 'performance'].includes(mode) ? new THREE.Box3().setFromObject(this.content) : null)
  }
  /** Keep the user's framing. A narrower view expands only by its aspect change. */
  private resizeReviewView(): void {
    const previousAspect = this.camera instanceof THREE.PerspectiveCamera ? this.camera.aspect : (this.camera.right - this.camera.left) / (this.camera.top - this.camera.bottom)
    const aspect = Math.max(1, this.container.clientWidth) / Math.max(1, this.container.clientHeight)
    const ratio = Math.min(previousAspect, this.previewAspect) / aspect
    if (!this.isGame() && this.sceneKey && !this.stats.loading && ratio > 1) {
      if (this.camera instanceof THREE.OrthographicCamera) this.viewRadius *= ratio
      else {
        const offset = this.camera.position.clone().sub(this.controls.target)
        const distance = offset.length(), axis = offset.normalize()
        let backExtent = 0
        const bounds = this.previewSceneBounds()
        if (bounds && !bounds.isEmpty()) {
          const point = new THREE.Vector3()
          for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) backExtent = Math.min(backExtent, point.set(x, y, z).sub(this.controls.target).dot(axis))
        } else if (this.settings.mode === 'effects') {
          const effect = effectPreviewBounds(EFFECT_BY_ID.get(this.settings.effectId)!, this.settings.effectScale, this.settings.effectLifetime)
          backExtent = Math.min(0, effect.center.clone().add(new THREE.Vector3(0, 1, 0)).sub(this.controls.target).dot(axis) - effect.radius)
        }
        this.camera.position.copy(this.controls.target).addScaledVector(axis, (distance - backExtent) * ratio + backExtent)
      }
    }
    this.previewAspect = Math.min(this.previewAspect, aspect)
    this.resize()
  }
  /** Refit content without changing the chosen orbit or reducing the visible area. */
  private refitPreviewCamera(recenter = false, expandOnly = true): void {
    if (this.isGame()) return
    const mode = this.settings.mode
    const effect = mode === 'effects'
      ? effectPreviewBounds(EFFECT_BY_ID.get(this.settings.effectId)!, this.settings.effectScale, this.settings.effectLifetime)
      : null
    const bounds = this.previewSceneBounds()
    if (!effect && (!bounds || bounds.isEmpty())) return
    const offset = this.camera.position.clone().sub(this.controls.target)
    if (recenter) {
      if (effect) this.controls.target.copy(effect.center).add(new THREE.Vector3(0, 1, 0))
      else bounds!.getCenter(this.controls.target)
      this.camera.position.copy(this.controls.target).add(offset)
    }
    this.target.copy(this.controls.target)
    this.camera.lookAt(this.target)
    const margin = mode === 'district' ? 1.06 : 1.12
    const aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight)
    if (this.camera instanceof THREE.PerspectiveCamera) {
      const fit = this.camera.clone()
      fit.fov = this.camera.getEffectiveFOV(); fit.zoom = 1
      if (effect) {
        const vertical = THREE.MathUtils.degToRad(fit.fov * .5)
        const halfFov = Math.min(vertical, Math.atan(Math.tan(vertical) * aspect))
        fit.position.copy(this.target).addScaledVector(offset.clone().normalize(), Math.max(.16, effect.radius) * margin / Math.sin(halfFov))
      } else fitPerspectiveBox(fit, bounds!, this.target, margin)
      if (!expandOnly || fit.position.distanceToSquared(this.target) > this.camera.position.distanceToSquared(this.target)) this.camera.position.copy(fit.position)
    } else {
      let halfWidth = effect ? Math.max(.16, effect.radius) : 0
      let halfHeight = halfWidth
      let frontExtent = halfWidth
      let orbitExtent = halfWidth
      const axis = offset.lengthSq() > .0001 ? offset.clone().normalize() : this.camera.getWorldDirection(new THREE.Vector3()).negate()
      if (bounds) {
        const orientation = this.camera.getWorldQuaternion(new THREE.Quaternion())
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(orientation)
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(orientation)
        const point = new THREE.Vector3()
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
          point.set(x, y, z).sub(this.target)
          halfWidth = Math.max(halfWidth, Math.abs(point.dot(right)))
          halfHeight = Math.max(halfHeight, Math.abs(point.dot(up)))
          frontExtent = Math.max(frontExtent, point.dot(axis))
          orbitExtent = Math.max(orbitExtent, point.length())
        }
      }
      const radius = Math.max(.2, halfHeight, halfWidth / aspect) * margin * this.camera.zoom
      this.viewRadius = expandOnly ? Math.max(this.viewRadius, radius) : radius
      const boom = expandOnly ? offset.length() : Math.max(1, orbitExtent + this.camera.near + .1)
      this.camera.position.copy(this.target).addScaledVector(axis, Math.max(boom, frontExtent + this.camera.near + .1))
      this.resize()
    }
    this.previewAspect = aspect
    this.camera.lookAt(this.target)
  }
  update(settings: StageSettings): void {
    const previous = this.settings; this.settings = settings
    if (!settings.playing && previous.playing) this.clearInput()
    if (settings.motion !== previous.motion) this.trails.clear()
    if (previous.quality !== settings.quality) this.resize()
    const key = this.getSceneKey()
    if (key !== this.sceneKey || settings.reset !== previous.reset) {
      const preserveView = !this.isGame() && settings.mode === previous.mode && settings.camera === previous.camera && settings.reset === previous.reset
      void this.rebuild(preserveView); return
    }
    if (settings.camera !== previous.camera) this.frameCamera()
    if (settings.animationId !== previous.animationId && !this.isGame()) {
      this.trails.clear(); this.trailClipTime = 0
      try { this.animationElapsed = 0; this.actors.forEach(actor => this.play(actor, settings.animationId, true)); if (['animations', 'avatars', 'assets'].includes(settings.mode)) this.refitPreviewCamera(true) } catch (error) { this.fail(error) }
    }
    if (settings.seek !== previous.seek && settings.seek !== null && settings.mode === 'animations') {
      this.trails.clear(); this.trailClipTime = 0
      const time = settings.seek
      this.animationElapsed = time
      this.actors.forEach(actor => { const action = actor.actions.get(actor.active); if (action) action.time = Math.min(time, Math.max(0, action.getClip().duration - 1e-6)); actor.mixer.update(0) })
      this.emitStats()
    }
    if (['avatars', 'animations', 'combat', 'parkour'].includes(settings.mode) && JSON.stringify(settings.avatar) !== JSON.stringify(previous.avatar)) {
      try { if (this.actors[0]) applyAvatar(this.actors[0].root, settings.avatar); this.setWireframe() } catch (error) { this.fail(error) }
      if (settings.avatar.equipment !== previous.avatar.equipment) {
        if (this.isGame()) { this.attack = null; this.pendingContact = null; this.bufferRemaining = 0; this.impactHold = 0; if (this.actors[0]) this.actors[0].hold = 0 }
        void this.attachEquipment(this.generation)
      }
      else if ((settings.mode === 'avatars' || settings.mode === 'animations') &&
        (settings.avatar.height !== previous.avatar.height || settings.avatar.thickness !== previous.avatar.thickness || settings.avatar.headScale !== previous.avatar.headScale || settings.avatar.headwear !== previous.avatar.headwear)) this.refitPreviewCamera(true)
    }
    if (settings.wireframe !== previous.wireframe) this.setWireframe()
    if (settings.outlines !== previous.outlines) {
      this.outlines.forEach(outline => { outline.visible = settings.outlines })
      const outline = this.equipment?.getObjectByName('ink-outlines'); if (outline) outline.visible = settings.outlines
    }
    if (!settings.ambientEffects && previous.ambientEffects && settings.mode === 'district') this.effects.clear()
    if (settings.trigger !== previous.trigger) this.triggerEffect()
    if (settings.effectId !== previous.effectId) { this.effects.clear(); this.triggerEffect() }
    if (settings.mode === 'effects' && (settings.effectId !== previous.effectId || settings.effectScale !== previous.effectScale || settings.effectLifetime !== previous.effectLifetime)) this.refitPreviewCamera(true, settings.effectId === previous.effectId)
  }
  private getSceneKey(): string {
    const s = this.settings
    return [s.mode, s.mode === 'assets' ? s.modelId : '', ['avatars', 'animations', 'combat', 'parkour'].includes(s.mode) ? s.avatar.preset : '', s.mode === 'performance' ? s.figureCount : '', s.mode === 'district' ? s.districtLayout : ''].join('|')
  }
  private clearScene(): void {
    this.clearance?.dispose(); this.clearance = null; this.foregroundCutaway.reset(); this.secondaryCutawayTarget = null
    this.equipmentGeneration++
    for (const actor of this.actors) { actor.mixer.stopAllAction(); actor.mixer.uncacheRoot(actor.root) }
    for (const child of [...this.content.children]) disposeInstance(child)
    this.content.clear(); this.actors = []; this.outlines = []; this.pickups = []; this.equipment = null; this.previewFrame = null
    this.effects.clear(); this.trails.clear(); this.trailTime = 0; this.trailClipTime = 0; this.effectSlots = []; this.clearInput()
  }
  private async rebuild(preserveView = false): Promise<void> {
    if (this.contextUnavailable) return
    const previousView = preserveView ? { offset: this.camera.position.clone().sub(this.controls.target), zoom: this.camera.zoom, radius: this.viewRadius } : null
    const generation = ++this.generation
    this.sceneKey = this.getSceneKey(); this.clearScene(); this.resetGame()
    this.stats.loading = true; this.stats.error = null; this.emitStats()
    this.animationElapsed = 0; this.elapsed = 0; this.sampleFrames = []
    const mode = this.settings.mode
    this.grid.visible = mode === 'assets' || mode === 'performance'
    try {
      if (['overview', 'district', 'combat', 'parkour'].includes(mode)) {
        const district = await createDistrict(this.library, mode === 'overview', mode === 'district' ? this.settings.districtLayout : 'district')
        if (this.disposed || generation !== this.generation) { disposeInstance(district.root); district.clearance.dispose(); return }
        this.content.add(district.root); this.outlines.push(district.outlines); this.clearance = district.clearance
        if (this.isGame()) this.foregroundCutaway.apply(district.root)
      }
      if (mode === 'assets') {
        const entry = this.library.entry(this.settings.modelId)
        if (entry.kind === 'character') await this.addActor(entry.id, new THREE.Vector3(), generation)
        else {
          const model = await this.library.create(entry.id)
          if (generation !== this.generation || this.disposed) { disposeInstance(model.root); return }
          this.content.add(model.root); this.outlines.push(addOutlines(model.root))
        }
      } else if (mode === 'performance') {
        const count = Math.max(1, Math.min(100, Math.round(this.settings.figureCount)))
        const columns = Math.ceil(Math.sqrt(count))
        for (let i = 0; i < count; i++) {
          await this.addActor('stick-standard', new THREE.Vector3((i % columns - (columns - 1) / 2) * 1.55, 0, (Math.floor(i / columns) - (columns - 1) / 2) * 1.55), generation, i % 2 ? 'run' : 'punch-right')
          if (generation !== this.generation || this.disposed) return
        }
      } else if (mode === 'overview') {
        const hero = await this.addActor('stick-fighter', new THREE.Vector3(...SHOWCASE_POSITIONS.hero), generation, 'block')
        const rival = await this.addActor('stick-striker', new THREE.Vector3(...SHOWCASE_POSITIONS.rival), generation, 'block')
        if (hero) hero.root.rotation.y = Math.PI / 2
        if (rival) { rival.root.rotation.y = -Math.PI / 2; applyAvatar(rival.root, { ...this.settings.avatar, height: 1, thickness: 1, headScale: 1, color: '#a63e2c', headwear: 'none', equipment: null }) }
        const acrobat = await this.addActor('stick-acrobat', new THREE.Vector3(2.8, .8, -3), generation, 'vault')
        if (acrobat) acrobat.root.rotation.y = Math.PI / 2
      } else if (mode === 'district') {
        const layout = EXTRA_LAYOUTS.find(item => item.id === this.settings.districtLayout)
        if (layout) {
          for (const [index, placement] of layout.actors.entries()) {
            const actor = await this.addActor(index % 2 ? 'stick-runner' : 'stick-worker', new THREE.Vector3(...placement.at), generation, placement.animation)
            if (generation !== this.generation || this.disposed) return
            if (actor) actor.root.rotation.y = placement.yaw
          }
        } else {
          await this.addActor('stick-worker', new THREE.Vector3(-3, 0, 2), generation, 'idle')
          await this.addActor('stick-runner', new THREE.Vector3(4, 3.125, -3), generation, 'idle')
        }
      } else if (mode === 'combat' || mode === 'parkour') {
        await this.addActor(this.settings.avatar.preset, new THREE.Vector3(0, 0, 8), generation, 'idle')
        if (generation !== this.generation || this.disposed) return
        if (mode === 'combat') for (const [x, z] of [[0, 5], [-2, 2], [1.5, -1], [-1.5, -5]]) {
          const actor = await this.addActor('stick-fighter', new THREE.Vector3(x, 0, z), generation, 'block')
          if (generation !== this.generation || this.disposed) return
          if (actor) {
            applyAvatar(actor.root, { ...this.settings.avatar, color: '#bd4c34', headwear: 'none', equipment: null })
            actor.root.rotation.y = 0
            actor.spawnRotation = actor.root.quaternion.clone()
          }
        }
        if (mode === 'parkour' && generation === this.generation && !this.disposed) this.createCheckpoints()
      } else if (mode !== 'effects') await this.addActor(this.settings.avatar.preset, new THREE.Vector3(), generation)
      if (generation !== this.generation || this.disposed) return
      if (this.actors[0] && ['avatars', 'animations', 'combat', 'parkour'].includes(mode)) {
        applyAvatar(this.actors[0].root, this.settings.avatar); await this.attachEquipment(generation)
      }
      if (generation !== this.generation || this.disposed || this.stats.error) return
      this.setWireframe(); this.outlines.forEach(outline => { outline.visible = this.settings.outlines })
      this.frameCamera()
      if (previousView) {
        this.camera.position.copy(this.controls.target).add(previousView.offset)
        this.camera.zoom = previousView.zoom; this.viewRadius = previousView.radius; this.resize()
        this.refitPreviewCamera(true, mode !== 'assets' && mode !== 'district')
      }
      this.stats.loading = false; this.emitStats()
      if (mode === 'effects') this.triggerEffect()
    } catch (error) {
      if (generation !== this.generation || this.disposed) return
      this.stats.loading = false; this.stats.error = error instanceof Error ? error.message : 'The scene could not load.'; this.emitStats()
    }
  }
  private async addActor(id: string, position: THREE.Vector3, generation: number, clip = this.settings.animationId): Promise<Actor | null> {
    const model = await this.library.create(id)
    if (generation !== this.generation || this.disposed) { disposeInstance(model.root); return null }
    model.root.position.copy(position)
    const mixer = new THREE.AnimationMixer(model.root)
    const clips = new Map(model.clips.map(animation => [animation.name, animation]))
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.34, 18), new THREE.MeshBasicMaterial({ color: '#b8bcb1', transparent: true, opacity: .38, depthWrite: false }))
    shadow.rotation.x = -Math.PI / 2; shadow.position.copy(position); shadow.position.y += .012
    shadow.scale.set(1, .65, 1); shadow.userData.ownedGeometry = true
    this.content.add(model.root, shadow)
    const actor: Actor = { root: model.root, mixer, actions: new Map(), clips, active: '', shadow, hold: 0, health: 3, respawn: 0, spawn: position.clone(), spawnRotation: null, origin: position.clone(), recoil: new THREE.Vector3(), sequencePhase: -1, reaction: null }
    this.actors.push(actor); this.play(actor, clip, true)
    this.updateActorAnimation(actor, (this.actors.length % 7) * .09)
    return actor
  }
  private play(actor: Actor, id: string, force = false): void {
    if (actor.active === id && !force) return
    let action = actor.actions.get(id)
    if (!action) {
      const clip = actor.clips.get(id)
      if (!clip) throw new Error(`Animation '${id}' is missing from ${actor.root.name}.`)
      action = actor.mixer.clipAction(clip); actor.actions.set(id, action)
    }
    const previous = actor.actions.get(actor.active)
    if (this.settings.mode === 'animations') actor.mixer.stopAllAction()
    const clip = this.clips.get(id)
    action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1)
    const loop = (!this.isGame() && this.settings.mode !== 'overview') || (clip?.loop ?? false)
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
    action.clampWhenFinished = !loop; action.play()
    if (clip?.travelSpeed) action.time = action.getClip().tracks[0].times[0]
    if (previous && previous !== action && this.settings.mode !== 'animations') { previous.fadeOut(.055); action.fadeIn(.055) }
    actor.active = id
    if (this.settings.mode === 'animations') actor.mixer.update(0)
  }
  private updateActorAnimation(actor: Actor, delta: number): void {
    const action = actor.actions.get(actor.active)
    const before = action?.time ?? 0, rate = action?.getEffectiveTimeScale() ?? 1
    actor.mixer.update(delta)
    if (!action || !this.clips.get(actor.active)?.travelSpeed) return
    const clip = action.getClip(), start = clip.tracks[0].times[0]
    if (start > 0 && before + delta * rate >= clip.duration) {
      action.time = start + (before - start + delta * rate) % (clip.duration - start)
      actor.mixer.update(0)
    }
  }
  private async attachEquipment(generation: number): Promise<void> {
    this.trails.clear(); this.trailClipTime = 0
    const equipmentGeneration = ++this.equipmentGeneration
    let model: Awaited<ReturnType<AssetLibrary['create']>> | null = null
    try {
      if (this.equipment) { disposeInstance(this.equipment); this.equipment = null }
      const id = this.settings.avatar.equipment, actor = this.actors[0]
      if (!id || !actor) {
        if (actor && this.settings.mode === 'avatars') { this.play(actor, this.avatarPreviewClip(), true); actor.mixer.update(0) }
        if (actor && !this.stats.loading && (this.settings.mode === 'avatars' || this.settings.mode === 'animations')) this.refitPreviewCamera(true)
        return
      }
      model = await this.library.create(id)
      if (generation !== this.generation || equipmentGeneration !== this.equipmentGeneration || this.disposed || this.settings.avatar.equipment !== id) { disposeInstance(model.root); return }
      mountEquipment(actor.root, model, [...actor.clips.values()], [...this.clips.values()])
      this.equipment = model.root
      addOutlines(model.root).visible = this.settings.outlines
      if (this.settings.mode === 'avatars') {
        this.play(actor, this.avatarPreviewClip(), true)
        actor.mixer.update(0)
      }
      if (!this.stats.loading && (this.settings.mode === 'avatars' || this.settings.mode === 'animations')) this.refitPreviewCamera(true)
      this.setWireframe()
    } catch (error) {
      if (model && model.root !== this.equipment) disposeInstance(model.root)
      if (generation === this.generation && equipmentGeneration === this.equipmentGeneration && !this.disposed) this.fail(error)
    }
  }
  private setWireframe(): void {
    this.content.traverse(object => { if (object.userData.inkContour) { object.visible = Boolean(object.userData.pale) && !this.settings.wireframe; return }; if (object instanceof THREE.Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) if ('wireframe' in material) material.wireframe = this.settings.wireframe })
  }
  private getPreviewBounds(): THREE.Box3 | null {
    if (!['avatars', 'animations', 'assets'].includes(this.settings.mode)) return null
    const actor = this.actors[0]
    if (!actor) return null
    const clip = actor.clips.get(actor.active)
    if (!clip) return null
    const { height, thickness, headScale, headwear } = this.settings.avatar
    const key = JSON.stringify([actor.root.uuid, actor.active, height, thickness, headScale, headwear, this.equipment?.uuid])
    if (this.previewFrame?.key !== key) {
      this.previewFrame = { key, bounds: animationBounds(actor.root, clip, this.clips.get(actor.active)?.contactTime) }
    }
    return this.previewFrame.bounds
  }
  private frameCamera(): void {
    const mode = this.settings.mode
    const wide = ['overview', 'district', 'combat', 'parkour', 'performance'].includes(mode)
    let radius = wide ? (mode === 'performance' ? 4 + Math.sqrt(this.actors.length) * 1.1 : mode === 'overview' ? 6.5 : 43) : 3.1
    let centerY = wide ? 1.5 : .95
    let effectBounds: ReturnType<typeof effectPreviewBounds> | null = null
    const sceneBounds = mode === 'district' ? new THREE.Box3().setFromObject(this.content) : null
    if (sceneBounds) { const size = sceneBounds.getSize(new THREE.Vector3()); radius = Math.max(size.x, size.z, size.y * 1.4) * 1.25; centerY = sceneBounds.getCenter(new THREE.Vector3()).y }
    if (mode === 'assets') { const size = this.library.entry(this.settings.modelId).dimensions; radius = Math.max(...size) * 1.8; centerY = size[1] * .45 }
    const previewBounds = this.getPreviewBounds()
    if (previewBounds) {
      const size = previewBounds.getSize(new THREE.Vector3())
      centerY = previewBounds.getCenter(new THREE.Vector3()).y
      radius = Math.max(3.1, size.y * 1.5, size.x * 1.4, size.z * 1.4)
    }
    if (mode === 'effects') {
      const effect = EFFECT_BY_ID.get(this.settings.effectId)!
      effectBounds = effectPreviewBounds(effect, this.settings.effectScale, this.settings.effectLifetime)
      radius = effectBounds.frameRadius; centerY = 1
    }
    this.target.set(mode === 'overview' ? .55 : 0, centerY, mode === 'overview' ? 1.8 : 0)
    if (previewBounds) previewBounds.getCenter(this.target)
    if (sceneBounds) { sceneBounds.getCenter(this.target); this.target.y = sceneBounds.min.y + (sceneBounds.max.y - sceneBounds.min.y) * .25 }
    if (effectBounds) this.target.copy(effectBounds.center).add(new THREE.Vector3(0, 1, 0))
    if (this.isGame()) { radius = 6; this.target.set(this.body.position.x, this.body.position.y + 1, this.body.position.z) }
    this.controls.enabled = !this.isGame() || this.settings.camera === 'perspective'
    const aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight)
    this.previewAspect = aspect
    const aspectFit = Math.max(1, .85 / aspect)
    radius *= aspectFit
    const orthographic = this.settings.camera === 'side' || this.settings.camera === 'top'
    if (orthographic !== (this.camera instanceof THREE.OrthographicCamera)) {
      this.camera = orthographic ? new THREE.OrthographicCamera(-4, 4, 4, -4, .05, 180) : new THREE.PerspectiveCamera(38, aspect, .05, 180)
      this.controls.object = this.camera
    }
    this.camera.zoom = 1
    this.viewRadius = this.isGame() ? (aspect < .8 ? 4.2 : 3.8) : radius * .43
    this.resize()
    switch (this.settings.camera) {
      case 'side': this.camera.position.copy(this.target).add(mode === 'overview' ? new THREE.Vector3(0, radius * .03, radius * 1.2) : new THREE.Vector3(radius * 1.2, this.isGame() ? 1.4 : radius * .03, 0)); break
      case 'top': this.camera.position.copy(this.target).add(new THREE.Vector3(0, radius * 1.45, this.isGame() ? 3.8 : .001)); break
      case 'third-person': this.camera.position.copy(this.target).add(this.chaseOffset()); break
      default: this.camera.position.copy(this.target).add(new THREE.Vector3(radius * (wide ? .65 : mode === 'animations' ? 1.3 : .8), radius * (mode === 'overview' ? .32 : wide ? .57 : .23), radius * (wide ? 1 : mode === 'animations' ? .45 : 1)))
    }
    if (this.isGame() && this.settings.camera === 'perspective') {
      this.preferredOrbitCamera.copy(this.camera as THREE.PerspectiveCamera)
      this.controls.object = this.preferredOrbitCamera
    } else this.controls.object = this.camera
    this.controls.target.copy(this.target); this.camera.lookAt(this.target); this.controls.update()
    if (!this.isGame()) this.refitPreviewCamera(mode === 'assets', false)
    this.cameraMotion.reset(this.camera.position, this.target)
    this.foregroundCutaway.reset(); this.secondaryCutawayTarget = null
  }
  private createCheckpoints(): void {
    for (const point of CHECKPOINTS) {
      const pickup = new THREE.Mesh(new THREE.OctahedronGeometry(.2), new THREE.MeshBasicMaterial({ color: '#d45538' }))
      pickup.position.set(...point); pickup.userData.ownedGeometry = true; this.content.add(pickup); this.pickups.push(pickup)
    }
  }
  private avatarPreviewClip(): string {
    if (this.settings.mode === 'avatars' && this.settings.animationId) {
      return this.settings.animationId
    }
    const role = ROLE_BY_ID.get(this.settings.avatar.preset)
    return role && role.equipment === this.settings.avatar.equipment ? role.preview : this.avatarIdleClip()
  }
  private avatarIdleClip(): string {
    return this.settings.avatar.equipment ? equipmentPose(this.library.entry(this.settings.avatar.equipment)) : 'idle'
  }
  private resetGame(): void {
    this.clearInput()
    this.foregroundCutaway.reset(); this.secondaryCutawayTarget = null
    this.trails.clear(); this.trailTime = 0; this.trailClipTime = 0
    this.body.position = { x: 0, y: 0, z: 8 }; this.body.velocityY = 0; this.body.grounded = true; this.body.facing = Math.PI
    this.score = 0; this.checkpoint = 0; this.combo = 0
    this.attack = null; this.pendingContact = null; this.impactHold = 0; this.impulseAge = 1; this.impulseZoom = 0; this.cameraLead.set(0, 0, 0); this.contacts.length = 0
    this.effects.clear(); this.effectSlots.length = 0; this.effectTimer = 0; this.stepTimer = 0
    this.moving = false; this.dashing = false; this.movementAccentCooldown = 0
    this.showcasePhase = -1; this.showcaseTime = 0; this.showcaseAttack = null
    this.pickups.forEach(pickup => { pickup.visible = true })
    for (const [index, actor] of this.actors.entries()) {
      actor.health = 3; actor.respawn = 0; actor.sequencePhase = -1; actor.hold = 0; actor.root.visible = true
      if (actor.spawnRotation) actor.root.quaternion.copy(actor.spawnRotation)
      if (this.isGame() && index === 0) actor.root.rotation.set(0, this.body.facing, 0)
      actor.origin.copy(actor.spawn); actor.reaction = null; actor.recoil.set(0, 0, 0); actor.root.position.copy(actor.origin)
      const clip = this.isGame()
        ? index > 0 || this.settings.mode === 'combat' && !this.settings.avatar.equipment ? 'block' : this.avatarIdleClip()
        : this.settings.mode === 'overview' ? index < 2 ? 'block' : 'idle' : actor.active
      actor.mixer.stopAllAction(); actor.active = ''
      this.play(actor, clip, true); actor.mixer.update(0)
      this.updateReaction(actor, 0)
    }
    if (this.equipment && this.actors[0]) supportEquipment(this.actors[0].root, this.equipment, this.actors[0].active, 0)
    if (this.isGame() && this.actors.length > 0) this.frameCamera()
  }
  private triggerEffect(): void {
    if (this.settings.mode === 'effects') this.effects.clear()
    const point = this.isGame() ? new THREE.Vector3(this.body.position.x, this.body.position.y + 1, this.body.position.z) : new THREE.Vector3(0, 1, 0)
    this.effects.trigger(this.settings.effectId, point, this.settings.effectColor, this.settings.effectScale, 0, this.settings.effectLifetime)
  }
  private chaseOffset(): THREE.Vector3 {
    return new THREE.Vector3(4.2, 2.8, 5.6)
  }
  private beginAttack(actor: Actor, clip: string, kind: AttackKind, facing: number): AttackBeat {
    const entry = this.clips.get(clip)
    if (!entry) throw new Error(`Attack clip is missing: ${clip}`)
    this.play(actor, clip, true)
    this.trails.clear(0); this.trailClipTime = 0
    actor.hold = entry.duration
    return startAttack(entry, kind, facing)
  }
  private sampleAttackTrail(): void {
    if (this.motionReduced()) { this.trails.clear(); return }
    if (!this.isGame() && this.settings.mode !== 'overview' && this.settings.mode !== 'animations') return
    const actor = this.actors[0]
    if (!actor) return
    const entry = this.clips.get(actor.active)
    if (entry?.contactTime === undefined || /^(rifle|pistol|shotgun|bow|throw)/.test(actor.active)) return
    const time = actor.actions.get(actor.active)?.time ?? 0
    if (time < this.trailClipTime) this.trails.clear(0)
    this.trailClipTime = time
    const kind = /^(sword|staff|dagger|hammer)/.test(actor.active) ? 'blade' : 'unarmed'
    const profile = getImpactProfile(actor.active, kind, this.equipment ? this.settings.avatar.equipment : null)
    if (time < Math.max(0, entry.contactTime - profile.trailBefore) || time > entry.contactTime + profile.trailAfter) return
    actor.root.updateMatrixWorld(true)
    const gear = this.settings.avatar.equipment ? this.library.entry(this.settings.avatar.equipment) : null
    const family = actor.active.split('-')[0]
    const weaponAction = ['sword', 'staff', 'dagger', 'hammer', 'shield'].includes(family)
    const matches = gear && (family === 'sword' ? gear.tags.includes('melee') && !['staff', 'dagger', 'hammer', 'axe', 'shield'].some(tag => gear.tags.includes(tag))
      : family === 'hammer' ? gear.tags.includes('hammer') || gear.tags.includes('axe') : gear.tags.includes(family))
    if (weaponAction && !matches) return
    const weapon = weaponAction ? this.equipment : null
    if (weapon) {
      this.trailOuter.fromArray(weapon.userData.contactTip as number[]).applyMatrix4(weapon.matrixWorld)
      this.trailInner.fromArray(weapon.userData.contactBase as number[]).applyMatrix4(weapon.matrixWorld)
      this.trailAxis.copy(this.trailInner).sub(this.trailOuter)
      this.trailInner.copy(this.trailOuter).addScaledVector(this.trailAxis.normalize(), Math.min(.38, profile.trailWidth * 2.5) * this.settings.avatar.height)
    } else {
      const name = attackContactBone(actor.active)
      const bone = actor.root.getObjectByName(name)
      if (!bone?.parent) return
      bone.getWorldPosition(this.trailOuter); bone.parent.getWorldPosition(this.trailInner)
      this.trailAxis.copy(this.trailInner).sub(this.trailOuter).normalize()
      this.trailInner.copy(this.trailOuter).addScaledVector(this.trailAxis, actor.active.startsWith('kick') ? profile.trailWidth : Math.min(.065, profile.trailWidth))
    }
    this.trails.sample(0, this.trailInner, this.trailOuter, this.trailTime, weapon ? this.settings.avatar.accent : '#151716', profile.trailDuration)
  }
  private resolveContact(beat: AttackBeat): void {
    const actor = this.actors[0]
    const direction = new THREE.Vector3(Math.sin(beat.facing), 0, Math.cos(beat.facing))
    actor.root.updateMatrixWorld(true)
    const limb = actor.root.getObjectByName(attackContactBone(beat.clip))
    const strike = limb?.getWorldPosition(new THREE.Vector3()) ?? actor.root.position.clone().add(new THREE.Vector3(0, 1, 0))
    strike.addScaledVector(direction, .12)
    const ranged = beat.kind === 'ranged'
    const profile = getImpactProfile(beat.clip, beat.kind, this.settings.mode === 'overview' ? null : this.settings.avatar.equipment)
    let impactProfile = profile
    const heldStrike = this.equipment && (ranged || beat.kind === 'blade' || beat.clip.startsWith('shield')) ? this.equipment : null
    if (heldStrike) strike.copy(equipmentContactPoint(heldStrike))
    if (ranged) this.effects.trigger(beat.clip === 'bow-release' ? 'arrow-trail' : beat.clip === 'pistol-fire' ? 'pistol-flash' : beat.clip === 'shotgun-fire' ? 'shotgun-flash' : 'rifle-flash', strike, this.settings.avatar.accent, .8)

    let hits = 0
    const targets = this.settings.mode === 'overview' ? this.actors.slice(1, 2) : this.actors.slice(1)
    if (ranged) targets.sort((a, b) => a.root.position.distanceToSquared(actor.root.position) - b.root.position.distanceToSquared(actor.root.position))
    let rangedEnd: THREE.Vector3 | null = null
    const actorChest = actor.root.getObjectByName('Chest')!.getWorldPosition(new THREE.Vector3())
    for (const target of targets) {
      if (target.respawn > 0 || !target.root.visible) continue
      const toTarget = target.root.position.clone().sub(actor.root.position)
      const distance = toTarget.length()
      const scale = this.settings.mode === 'overview' ? 1 : this.settings.avatar.height
      const weaponExtent = heldStrike && !ranged ? Math.min(1.8, Math.max(...this.library.entry(this.settings.avatar.equipment!).dimensions)) * scale : 0
      const reach = ranged ? profile.reach : profile.reach * scale + weaponExtent
      if (distance >= reach || (distance >= .45 && toTarget.normalize().dot(direction) <= profile.facingDot)) continue
      target.root.updateMatrixWorld(true)
      const targetPoint = target.root.getObjectByName('Chest')!.getWorldPosition(new THREE.Vector3())
      if (heldStrike && !ranged && equipmentContactPoint(heldStrike, targetPoint).distanceTo(targetPoint) > .5 * scale) continue
      if (this.clearance?.obstruction(actorChest, targetPoint, .02) != null || (ranged && this.clearance?.obstruction(strike, targetPoint, .02) != null)) continue
      hits++
      const showcase = this.settings.mode === 'overview'
      if (!showcase) { target.health--; this.score += 10 }
      const heavy = target.health <= 0 || beat.clip.includes('heavy') || beat.clip.startsWith('kick')
      const rotation = target.reaction?.rotation.clone() ?? target.root.quaternion.clone()
      if (!target.spawnRotation) target.spawnRotation = rotation.clone()
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation)
      const force = ranged ? direction.clone() : target.root.position.clone().sub(actor.root.position).setY(0).normalize()
      if (force.lengthSq() < .001) force.copy(direction)
      const reactionChoice = selectReaction(force, Math.atan2(forward.x, forward.z), target.health <= 0)
      this.play(target, reactionChoice.clip, true)
      target.hold = this.clips.get(reactionChoice.clip)!.duration
      const reactionProfile = target.health <= 0 ? getImpactProfile('punch-heavy', 'unarmed') : profile
      if (reactionProfile.hitHold > impactProfile.hitHold) impactProfile = reactionProfile
      const base = { profile: reactionProfile, age: 0, direction: force, startOffset: target.root.position.clone().sub(target.origin), rotation }
      target.reaction = reactionChoice.clip === 'death' || reactionChoice.clip === 'knockdown'
        ? { ...base, kind: 'fall', clip: reactionChoice.clip, facing: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), reactionChoice.facing) }
        : { ...base, kind: 'hit' }
      const contact = ranged ? targetPoint : heldStrike ? equipmentContactPoint(heldStrike, targetPoint) : strike.clone().lerp(targetPoint, .35)
      this.effects.trigger(beat.clip.startsWith('shield') ? 'guard-shock' : beat.kind === 'blade' ? 'blade-contact' : heavy ? 'heavy-impact' : 'punch-impact', contact, this.settings.avatar.accent, heavy ? .88 : .75)
      if (target.health <= 0) { this.score += 50; target.respawn = 3 }
      if (ranged) { rangedEnd = contact; break }
    }
    if (ranged) {
      if (!rangedEnd) {
        rangedEnd = strike.clone().addScaledVector(direction, profile.reach)
        const obstruction = this.clearance?.obstruction(strike, rangedEnd, .02)
        if (obstruction != null) {
          rangedEnd.copy(strike).addScaledVector(direction, obstruction)
          this.effects.trigger('bullet-impact', rangedEnd, this.settings.avatar.accent, .36)
        }
      }
      if (!this.motionReduced()) this.shotTrace(strike, rangedEnd)
    }
    if (hits) {
      this.impactHold = impactProfile.hitHold
      this.impulseAge = 0; this.impulseStrength = impactProfile.cameraKick; this.impulseZoom = impactProfile.cameraZoom
      this.emitStats()
    }
    this.contacts.push({ clip: beat.clip, clipTime: beat.elapsed, expectedTime: beat.contact, hits })
    if (this.contacts.length > 24) this.contacts.shift()
  }
  private shotTrace(start: THREE.Vector3, end: THREE.Vector3): void {
    this.camera.updateMatrixWorld()
    this.trailAxis.copy(end).sub(start).cross(this.camera.getWorldDirection(this.trailOuter))
    if (this.trailAxis.lengthSq() < .0001) this.trailAxis.setFromMatrixColumn(this.camera.matrixWorld, 0)
    this.trailAxis.normalize().multiplyScalar(.018)
    this.trails.line(3, start, end, this.trailAxis, this.trailTime, this.settings.avatar.accent, .075)
  }
  private updateShowcase(delta: number): void {
    const hero = this.actors[0], rival = this.actors[1]
    if (!hero || !rival) return
    this.showcaseTime += delta
    const cycleDuration = SHOWCASE_SEQUENCE.reduce((sum, beat) => sum + this.clips.get(beat.clip)!.duration + beat.recovery, 0)
    let cycleTime = this.showcaseTime % cycleDuration
    let phase = 0
    for (; phase < SHOWCASE_SEQUENCE.length - 1; phase++) {
      const beat = SHOWCASE_SEQUENCE[phase]
      const duration = this.clips.get(beat.clip)!.duration + beat.recovery
      if (cycleTime < duration) break
      cycleTime -= duration
    }
    if (phase !== this.showcasePhase) {
      this.showcasePhase = phase
      this.showcaseAttack = this.beginAttack(hero, SHOWCASE_SEQUENCE[phase].clip, 'unarmed', Math.PI / 2)
    }
    if (this.showcaseAttack) {
      const result = advanceAttack(this.showcaseAttack, delta)
      this.showcaseAttack = result.finished ? null : result.beat
      if (result.contact) this.pendingContact = result.beat
      if (result.finished) this.play(hero, 'block')
    }
    rival.hold = Math.max(0, rival.hold - delta)
    if (!rival.hold) this.play(rival, 'block')
    this.updateReaction(rival, delta)
    if (this.actors[2]) this.updateAcrobat(this.actors[2])
  }
  private updateReaction(actor: Actor, delta: number): void {
    const reaction = actor.reaction
    if (reaction) {
      reaction.age += delta
      const pose = reaction.kind === 'fall' ? sampleKnockdown(reaction.profile, reaction.age) : sampleRecoil(reaction.profile, reaction.age)
      const carry = Math.max(0, 1 - reaction.age / reaction.profile.recoilDuration)
      actor.recoil.copy(reaction.direction).multiplyScalar(pose.travel).addScaledVector(reaction.startOffset, reaction.kind === 'fall' ? 1 : carry * carry)
      actor.recoil.y += pose.lift
      actor.root.quaternion.copy(reaction.rotation)
      if (reaction.kind === 'fall') actor.root.quaternion.slerp(reaction.facing, Math.min(1, reaction.age / .22))
      else if (!this.motionReduced()) {
        this.reactionAxis.set(reaction.direction.z, 0, -reaction.direction.x)
        this.reactionRotation.setFromAxisAngle(this.reactionAxis, pose.tilt)
        actor.root.quaternion.premultiply(this.reactionRotation)
      }
      if (pose.done && reaction.kind === 'hit') { actor.reaction = null; actor.recoil.set(0, 0, 0) }
    }
    actor.root.position.copy(actor.origin).add(actor.recoil)
    actor.shadow.position.set(actor.root.position.x, actor.origin.y + .016, actor.root.position.z)
    const height = Math.max(0, actor.recoil.y)
    actor.shadow.scale.set(1 + height * .4, .65 + height * .2, 1)
    ;(actor.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(.12, .38 - height * .4)
  }
  private jumpStartTime(): number {
    const clip = this.clips.get('jump-start')!
    const takeoff = clip.motion?.phases.find(phase => phase.name === 'takeoff')
    return Math.min(clip.duration, takeoff ? takeoff.frame / 30 : clip.duration * .5)
  }
  private updateAcrobat(actor: Actor): void {
    const duration = ACROBAT_SEQUENCE.reduce((total, phase) => total + phase.duration, 0)
    let time = this.showcaseTime % duration
    let index = 0
    while (index < ACROBAT_SEQUENCE.length - 1 && time >= ACROBAT_SEQUENCE[index].duration) time -= ACROBAT_SEQUENCE[index++].duration
    const phase = ACROBAT_SEQUENCE[index]
    if (actor.sequencePhase !== index) {
      this.play(actor, phase.clip, true); actor.sequencePhase = index
      if (phase.clip === 'jump-start') {
        actor.actions.get('jump-start')!.time = this.jumpStartTime()
        this.effects.trigger('jump-puff', actor.root.position, undefined, .38)
      }
      if (phase.clip === 'jump-land') this.effects.trigger('landing-dust', actor.root.position, undefined, .62)
    }
    const authoredSpeed = this.clips.get(phase.clip)?.travelSpeed
    if (authoredSpeed) actor.actions.get(phase.clip)!.setEffectiveTimeScale(Math.hypot(phase.to[0] - phase.from[0], phase.to[2] - phase.from[2]) / phase.duration / authoredSpeed)
    const t = time / phase.duration
    actor.root.position.set(
      THREE.MathUtils.lerp(phase.from[0], phase.to[0], t),
      THREE.MathUtils.lerp(phase.from[1], phase.to[1], t) + Math.sin(t * Math.PI) * phase.arc,
      THREE.MathUtils.lerp(phase.from[2], phase.to[2], t),
    )
    if (index < 6) actor.root.rotation.y = 0
    else if (index > 6) actor.root.rotation.y = Math.PI
    else actor.root.rotation.y = t * Math.PI
    const ground = actor.root.position.z < -2.15 ? .8 : actor.root.position.z > .35 ? 0 : (.35 - actor.root.position.z) / 2.5 * .8
    actor.shadow.position.set(actor.root.position.x, ground + .014, actor.root.position.z)
    const height = Math.max(0, actor.root.position.y - ground)
    actor.shadow.scale.set(1 + height * .2, .65 + height * .1, 1)
    ;(actor.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(.12, .38 - height * .16)
  }
  private updateGame(delta: number, animationDelta: number, inputDelta: number): void {
    const actor = this.actors[0]
    if (!actor) return
    const x = Number(this.input.has('right')) - Number(this.input.has('left'))
    const z = Number(this.input.has('back')) - Number(this.input.has('forward'))
    const landingHold = actor.active === 'jump-land' && actor.hold > 0 && !this.jumpQueued
    const mobility = this.body.grounded && (this.attack || landingHold) ? 0 : 1
    const previousX = this.body.position.x, previousZ = this.body.position.z
    const step = moveBody(this.body, { x: x * mobility, z: z * mobility, jump: this.jumpQueued, dash: this.input.has('dash') }, DISTRICT_COLLISION, delta)
    this.jumpQueued = false
    actor.root.position.set(this.body.position.x, this.body.position.y, this.body.position.z)
    actor.root.rotation.y = this.attack?.facing ?? this.body.facing
    const ground = supportAt(DISTRICT_COLLISION, this.body.position.x, this.body.position.z, this.body.position.y + .05)
    actor.shadow.position.set(this.body.position.x, ground + .016, this.body.position.z)
    const air = this.body.position.y - ground
    actor.shadow.scale.set(1 + air * .18, .65 + air * .1, 1)
    ;(actor.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(.08, .34 - air * .12)
    actor.hold = Math.max(0, actor.hold - animationDelta)
    if (step.jumped) {
      this.effects.trigger('jump-puff', actor.root.position, undefined, .7)
      if (!this.attack) {
        this.play(actor, 'jump-start', true)
        const start = this.jumpStartTime()
        actor.actions.get('jump-start')!.time = start
        actor.hold = this.clips.get('jump-start')!.duration - start
      }
    }
    if (step.landed) {
      this.effects.trigger('landing-dust', actor.root.position, undefined, .86)
      if (!this.attack) { this.play(actor, 'jump-land', true); actor.hold = .36 }
      this.impulseAge = 0; this.impulseStrength = .025; this.impulseZoom = .006
    }
    const buffered = stepActionBuffer(this.bufferRemaining, inputDelta, !this.attack)
    this.bufferRemaining = buffered.remaining
    if (buffered.consume) {
      const gear = this.settings.avatar.equipment ? this.library.entry(this.settings.avatar.equipment) : null
      const move = combatMove(gear, this.settings.avatar.preset, this.combo++)
      this.attack = this.beginAttack(actor, move.clip, move.kind, this.body.facing)
      this.bufferRemaining = 0
    }
    if (this.attack) {
      const result = advanceAttack(this.attack, animationDelta)
      this.attack = result.finished ? null : result.beat
      if (result.contact) this.pendingContact = result.beat
    }
    const groundSpeed = delta > 0 ? Math.hypot(this.body.position.x - previousX, this.body.position.z - previousZ) / delta : 0
    if (actor.hold === 0 && !this.attack) {
      this.play(actor, !this.body.grounded ? 'jump-loop' : groundSpeed > .01 ? this.input.has('dash') ? 'sprint' : 'run' : this.settings.mode === 'combat' && !this.settings.avatar.equipment ? 'block' : this.avatarIdleClip())
      const authoredSpeed = this.clips.get(actor.active)?.travelSpeed
      if (authoredSpeed && groundSpeed > .01) actor.actions.get(actor.active)!.setEffectiveTimeScale(groundSpeed / (authoredSpeed * this.settings.avatar.height))
    }
    this.stepTimer -= delta
    this.movementAccentCooldown = Math.max(0, this.movementAccentCooldown - delta)
    if (delta > 0) {
      const moving = Math.hypot(this.body.position.x - previousX, this.body.position.z - previousZ) > .0001
      const dashing = moving && this.input.has('dash')
      if (this.body.grounded && !this.motionReduced() && this.movementAccentCooldown === 0) {
        if (dashing && !this.dashing) { this.effects.trigger('dash-ring', actor.root.position, undefined, .9); this.movementAccentCooldown = .3 }
        else if (!moving && this.moving) { this.effects.trigger('hard-stop', actor.root.position, undefined, .9); this.movementAccentCooldown = .3 }
      }
      if (this.body.grounded && moving && this.stepTimer < 0) {
        this.effects.trigger('footstep-dust', actor.root.position, undefined, dashing ? .85 : .65)
        this.stepTimer = dashing ? .17 : .24
      }
      this.moving = moving; this.dashing = dashing
    }
    for (const target of this.actors.slice(1)) {
      if (target.respawn > 0) {
        target.respawn -= delta
        if (target.respawn <= 0) {
          const forwardFall = target.reaction?.kind === 'fall' && target.reaction.clip === 'death'
          target.origin.copy(target.root.position); target.recoil.set(0, 0, 0); target.reaction = null
          target.health = 3
          const clip = forwardFall ? 'get-up-forward' : 'get-up'
          this.play(target, clip, true)
          const action = target.actions.get(clip)!
          target.hold = action.getClip().duration
        }
      } else {
        target.hold = Math.max(0, target.hold - animationDelta)
        if (target.hold === 0) this.play(target, 'block')
      }
      this.updateReaction(target, animationDelta)
    }
    if (this.settings.mode === 'parkour') {
      const pickup = this.pickups[this.checkpoint]
      if (pickup && actor.root.position.clone().add(new THREE.Vector3(0, .8, 0)).distanceTo(pickup.position) < .8) {
        pickup.visible = false; this.score += 100; this.checkpoint++
        this.effects.trigger('checkpoint', actor.root.position.clone().add(new THREE.Vector3(0, .04, 0)), this.settings.avatar.accent, .72)
      }
    }
  }
  private isReactionCutawayTarget(actor: Actor): boolean {
    return (actor.reaction !== null || actor.hold > 0 && (actor.active === 'get-up' || actor.active === 'get-up-forward'))
      && actor.root.position.distanceToSquared(this.actors[0].root.position) <= 4.5 * 4.5
  }
  private updateReactionCutaway(delta: number): void {
    if (this.secondaryCutawayTarget && !this.isReactionCutawayTarget(this.secondaryCutawayTarget) && this.foregroundCutaway.secondaryAmount < .01) this.secondaryCutawayTarget = null
    if (!this.secondaryCutawayTarget) {
      let nearest = Infinity
      for (let index = 1; index < this.actors.length; index++) {
        const actor = this.actors[index]
        if (!this.isReactionCutawayTarget(actor)) continue
        const distance = actor.root.position.distanceToSquared(this.actors[0].root.position)
        if (distance < nearest) { nearest = distance; this.secondaryCutawayTarget = actor }
      }
    }
    const target = this.secondaryCutawayTarget
    const active = target && this.isReactionCutawayTarget(target)
    const height = target ? this.library.entry('stick-fighter').dimensions[1] * target.root.scale.y : 0
    this.foregroundCutaway.updateSecondary(this.camera, active ? target.root.position : null, height, target?.origin.y ?? 0, delta)
  }
  private updateGameCamera(delta: number): void {
    const actor = this.actors[0]
    if (!actor) return
    const lead = this.motionReduced() ? 0 : this.attack ? .25 : this.moving ? .18 : 0
    const facing = this.attack?.facing ?? this.body.facing
    this.desiredCameraLead.set(Math.sin(facing) * lead, 0, Math.cos(facing) * lead)
    this.cameraLead.lerp(this.desiredCameraLead, 1 - Math.exp(-delta * 8))
    const aim = this.preferredCameraTarget.copy(actor.root.position).add(this.cameraLead)
    aim.y += this.settings.camera === 'top' ? .9 : 1.05
    const desired = this.preferredCameraPosition
    if (this.settings.camera === 'perspective') {
      this.preferredOrbitCamera.position.add(aim.clone().sub(this.controls.target))
      this.controls.target.copy(aim); this.controls.update()
      desired.copy(this.preferredOrbitCamera.position)
    } else if (this.settings.camera === 'third-person') desired.copy(aim).add(this.chaseOffset())
    else if (this.settings.camera === 'side') desired.copy(aim).add(new THREE.Vector3(12, 1.4, 0))
    else desired.copy(aim).add(new THREE.Vector3(0, 16, 5))
    const height = this.library.entry(this.settings.avatar.preset).dimensions[1] * this.settings.avatar.height
    this.bodyFocus.copy(actor.root.position); this.bodyFocus.y += height * .5
    const minimumDistance = this.camera instanceof THREE.PerspectiveCamera
      ? minimumBodyDistance(height, aim.y - actor.root.position.y, desired.clone().sub(aim), this.camera.fov, this.camera.aspect)
      : desired.distanceTo(aim)
    const pose = this.cameraMotion.update({ position: desired, target: aim, focus: this.bodyFocus,
      bodyHeight: height, parallel: this.camera instanceof THREE.OrthographicCamera, delta, minimumDistance }, this.clearance)
    this.camera.position.copy(pose.position); this.target.copy(pose.target); this.camera.lookAt(this.target)
    this.foregroundCutaway.update(this.camera, this.bodyFocus, height, delta)
    this.updateReactionCutaway(delta)
  }
  private readonly tick = (): void => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.tick)
    const realDelta = this.clock.getDelta()
    const delta = Math.min(realDelta, .05)
    this.elapsed += delta; this.statsTimer += realDelta
    try { if (!this.stats.loading && !this.stats.error) {
      if (this.settings.playing) {
        const speed = delta * this.settings.speed
        if (this.isGame() || this.settings.mode === 'overview') {
          let remaining = speed
          while (remaining > 0) {
            const substep = Math.min(remaining, 1 / 60)
            const animationDelta = this.impactHold > 0 ? 0 : substep
            this.impactHold = Math.max(0, this.impactHold - substep)
            this.animationElapsed += animationDelta
            if (this.isGame()) this.updateGame(animationDelta, animationDelta, remaining === speed ? realDelta : 0)
            else this.updateShowcase(animationDelta)
            this.actors.forEach(actor => this.updateActorAnimation(actor, animationDelta))
            if (this.pendingContact) { const contact = this.pendingContact; this.pendingContact = null; this.resolveContact(contact) }
            this.trailTime += substep; this.sampleAttackTrail()
            remaining -= substep
          }
        } else {
          this.animationElapsed += speed
          this.actors.forEach(actor => this.updateActorAnimation(actor, speed))
          this.trailTime += speed; this.sampleAttackTrail()
        }
        this.pickups.forEach((pickup, i) => { pickup.rotation.y += speed * 1.5; pickup.scale.setScalar(i === this.checkpoint ? 1.3 : .7) })
        this.effectTimer -= speed
        if (this.settings.mode === 'district' && this.settings.ambientEffects) {
          const sources = EXTRA_LAYOUTS.find(item => item.id === this.settings.districtLayout)?.effects ?? [
            { id: 'steam-burst', at: [8.5, 5.3, -9] as [number, number, number], scale: .6 },
            { id: 'electric-arc', at: [-6.4, 1.2, 3] as [number, number, number], scale: .45 },
          ]
          for (const [i, source] of sources.entries()) {
            this.effectSlots[i] = (this.effectSlots[i] ?? i * .7) - speed
            if (this.effectSlots[i] <= 0) {
              const duration = this.effects.trigger(source.id, new THREE.Vector3(...source.at), undefined, source.scale)
              this.effectSlots[i] = duration + 1.2 + i * .35
            }
          }
        }
        if (this.settings.mode === 'performance') {
          for (let i = 0; i < Math.min(40, this.settings.effectCount); i++) {
            this.effectSlots[i] = (this.effectSlots[i] ?? 0) - speed
            if (this.effectSlots[i] > 0) continue
            const actor = this.actors[i % this.actors.length]
            if (actor) this.effectSlots[i] = this.effects.trigger(EFFECTS[i % EFFECTS.length].id, actor.root.position.clone().add(new THREE.Vector3(0, .9, 0)), this.settings.effectColor)
          }
        }
        this.effects.update(speed, this.camera)
      }
      if (this.equipment && this.actors[0]) {
        const actor = this.actors[0]
        supportEquipment(actor.root, this.equipment, actor.active, actor.actions.get(actor.active)?.time ?? 0)
      }
      if (this.isGame()) this.updateGameCamera(delta)
      else this.controls.update()
    } } catch (error) { this.fail(error) }
    this.impulseAge += realDelta
    if (this.motionReduced()) this.trails.clear()
    this.trails.update(this.trailTime)
    const [shakeX, shakeY] = this.motionReduced() ? [0, 0] : cameraImpulse(this.impulseAge, this.impulseStrength)
    this.camera.translateX(shakeX); this.camera.translateY(shakeY)
    const zoom = this.motionReduced() ? 0 : this.impulseZoom * Math.max(0, 1 - this.impulseAge / .18) ** 3
    const baseZoom = this.camera.zoom
    if (zoom > 0) { this.camera.zoom = baseZoom * (1 + zoom); this.camera.updateProjectionMatrix() }
    this.renderer.render(this.scene, this.camera)
    if (zoom > 0) { this.camera.zoom = baseZoom; this.camera.updateProjectionMatrix() }
    this.camera.translateX(-shakeX); this.camera.translateY(-shakeY)
    if (realDelta > 0 && realDelta < 1 && !this.stats.loading) this.sampleFrames.push(realDelta * 1000)
    if (this.sampleFrames.length > 120) this.sampleFrames.shift()
    if (this.statsTimer >= .4) { this.statsTimer = 0; this.emitStats() }
  }
  private emitStats(): void {
    const average = this.sampleFrames.length ? this.sampleFrames.reduce((sum, value) => sum + value, 0) / this.sampleFrames.length : 0
    const info = this.renderer.info
    this.stats = { ...this.stats, fps: average ? Math.round(1000 / average) : 0, frameMs: Math.round(average * 10) / 10,
      calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures,
      elapsed: this.settings.mode === 'animations' ? this.actors[0]?.actions.get(this.actors[0].active)?.time ?? this.animationElapsed : this.elapsed, figures: this.actors.length, effects: this.effects.activeBursts, score: this.score,
      message: this.settings.mode === 'parkour' ? this.checkpoint === CHECKPOINTS.length ? 'Route complete. Press R to run again.' : `Checkpoint ${this.checkpoint + 1} of ${CHECKPOINTS.length}`
        : this.settings.mode === 'combat' ? 'Move close to a red target. Face it and strike.' : '',
    }
    this.onStats(this.stats)
  }
  /** Read-only pose and contact evidence for the local art review harness. */
  inspect() {
    this.camera.updateMatrixWorld(true)
    const width = this.container.clientWidth, height = this.container.clientHeight
    const project = (point: THREE.Vector3) => {
      const p = point.project(this.camera)
      return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2, depth: p.z }
    }
    const sceneBox = new THREE.Box3().setFromObject(this.content)
    const sceneFrame = []
    if (!sceneBox.isEmpty()) for (const x of [sceneBox.min.x, sceneBox.max.x]) for (const y of [sceneBox.min.y, sceneBox.max.y]) for (const z of [sceneBox.min.z, sceneBox.max.z]) sceneFrame.push(project(new THREE.Vector3(x, y, z)))
    return {
      viewport: { width, height }, sceneFrame,
      camera: { position: this.camera.position.toArray(), target: (this.isGame() ? this.target : this.controls.target).toArray(), occluded: this.cameraMotion.occluded, cutaway: this.foregroundCutaway.amount, reactionCutaway: this.foregroundCutaway.secondaryAmount },
      body: { ...this.body, position: { ...this.body.position } }, checkpoint: this.checkpoint,
      attack: this.attack ? { ...this.attack } : null, impactHold: this.impactHold, bufferRemaining: this.bufferRemaining,
      equipmentContact: this.equipment ? project(equipmentContactPoint(this.equipment)) : null,
      trails: { active: this.trails.activeCount, triangles: this.trails.triangleCount }, motionReduced: this.motionReduced(),
      contacts: this.contacts.map(contact => ({ ...contact })),
      actors: this.actors.map(actor => {
        actor.root.updateMatrixWorld(true)
        const joints: Record<string, ReturnType<typeof project>> = {}
        for (const name of CAMERA_POSE_BONES) {
          const bone = actor.root.getObjectByName(name)
          if (bone) joints[name] = project(bone.getWorldPosition(new THREE.Vector3()))
        }
        const blocked = Object.fromEntries(CAMERA_POSE_BONES.map(name => {
          const bone = actor.root.getObjectByName(name)
          const point = bone?.getWorldPosition(new THREE.Vector3())
          return [name, point ? this.clearance !== null && !this.clearance.inView(point, this.camera) : false]
        }))
        return { clip: actor.active, health: actor.health, position: actor.root.position.toArray(), facing: actor.root.rotation.y, worldJoints: Object.fromEntries(CAMERA_POSE_BONES.map(name => [name, actor.root.getObjectByName(name)?.getWorldPosition(new THREE.Vector3()).toArray()])), joints, blocked, reaction: { magnitude: actor.recoil.length(), done: actor.reaction === null, age: actor.reaction?.age ?? 0, kind: actor.reaction?.kind ?? null, direction: actor.reaction?.direction.toArray() ?? null } }
      }),
    }
  }
  private fail(error: unknown): void {
    this.stats.error = error instanceof Error ? error.message : 'The scene stopped because of an unexpected error.'
    this.stats.loading = false; this.clearInput(); this.emitStats()
  }
  dispose(): void {
    this.disposed = true; this.generation++; cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect(); this.controls.dispose(); this.clearScene(); this.effects.dispose(); this.trails.dispose(); this.library.dispose()
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp)
    window.removeEventListener('blur', this.clearInput); window.removeEventListener('inkline-input', this.customInput)
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost)
    this.floor.geometry.dispose(); (this.floor.material as THREE.Material).dispose(); this.grid.geometry.dispose()
    for (const material of Array.isArray(this.grid.material) ? this.grid.material : [this.grid.material]) material.dispose()
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove()
  }
}
