// Host depth integration example (T7). Viewer-only; it is not a library pass.
//
// A host game owns its scene depth. This stage shows the contract:
//
// - The caller owns one THREE.DepthTexture and one reusable descriptor in a
//   stable ref. The library never disposes the texture.
// - The camera rig and the opaque fixture finish their updates at priority
//   -3. PfxMaterialProvider advances its frame token at -2.
// - DepthCaptureHost captures once per canvas at -1, only at high quality. It
//   renders an explicit opaque fixture scene (shared geometry, synchronized
//   transforms). Smoke and every other transparent PFX never enter it.
// - The capture saves and restores the render target, viewport, scissor,
//   clear state, and renderer flags in finally. It invalidates the stamp
//   first, so a capture that throws leaves the hard-depth fallback.
// - PfxSurface consumers validate the source at priority 0 and switch between
//   two prebuilt materials. No positive priority; R3F renders as normal.
//
// The source selector injects host faults. Each fault must select the hard
// fallback. Diagnostics go to canvas.dataset.pfxDepthProof for the runner.

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import * as THREE from 'three'
import {
  AUTHORED_EFFECT_RECIPES,
  GamePfx,
  PFX_MATERIAL_DEPTH_CAPTURE_PRIORITY,
  PFX_MATERIAL_DEPTH_VARIANT_USERDATA_KEY,
  PfxMaterialProvider,
  createPfxMaterialDepthFrame,
  createPfxMaterialDepthSource,
  createPfxPreset,
  invalidatePfxMaterialDepthSource,
  readPfxMaterialDepthFrame,
  stampPfxMaterialDepthSource,
  usePfxMaterialContext,
  usePfxMaterialFrame,
  validatePfxMaterialDepthSource,
  type PfxAuthoredRecipe,
  type PfxMaterialDepthEncoding,
  type PfxMaterialDepthFallbackReason,
  type PfxMaterialDepthSource,
  type PfxMaterialQuality,
  type PfxRenderSurface,
} from '@pfx'
import { checkPfxPreviewResources } from './materialRuntimeStatus'
import {
  MATERIAL_PROOF_DEPTH_BUFFERS,
  MATERIAL_PROOF_DEPTH_CONTACTS,
  MATERIAL_PROOF_DEPTH_PROJECTIONS,
  MATERIAL_PROOF_DEPTH_SMOKE_LAYERS,
  MATERIAL_PROOF_DEPTH_SOURCES,
  MATERIAL_PROOF_DEPTH_STAGE_SIZES,
  MATERIAL_PROOF_SEED,
  type MaterialProofCamera,
  type MaterialProofDepthBuffer,
  type MaterialProofDepthContact,
  type MaterialProofDepthOptions,
  type MaterialProofDepthProjection,
  type MaterialProofDepthReport,
  type MaterialProofDepthSource,
  type MaterialProofDepthStageSize,
} from './materialProofContract'

const CAMERA_RIG_PRIORITY = -3
const TARGET = new THREE.Vector3(0, 0.35, 0)
const ORBITS: Record<MaterialProofCamera, { yaw: number; pitch: number; distance: number }> = {
  front: { yaw: 0, pitch: 0.24, distance: 3.2 },
  'three-quarter': { yaw: 0.72, pitch: 0.34, distance: 3.3 },
  side: { yaw: Math.PI / 2, pitch: 0.2, distance: 3.3 },
}
const AUTO_ROTATE_RADIANS_PER_SECOND = 0.6
const LATE_CAMERA_YAW = 0.08
/** Orthographic view height in world units. */
const ORTHO_VIEW_HEIGHT = 2.6

/** smoke-puff with depth fade on every alpha layer. The catalog recipe is unchanged. */
function smokeDepthRecipe(softness: number): PfxAuthoredRecipe {
  const source = AUTHORED_EFFECT_RECIPES['smoke-puff']
  if (!source) throw new Error('MaterialDepthStage: smoke-puff is not in the catalog')
  const layers = new Set<string>(MATERIAL_PROOF_DEPTH_SMOKE_LAYERS)
  return {
    ...source,
    surfaces: source.surfaces.map((surface): PfxRenderSurface => {
      if (!layers.has(surface.phase ?? '')) return surface
      return { ...surface, tuning: { ...surface.tuning, material: { softParticles: { distance: softness } } } }
    }),
  }
}

function contactPosition(contact: MaterialProofDepthContact, camera: MaterialProofCamera): [number, number, number] | null {
  switch (contact) {
    case 'none':
      return null
    // Behind the smoke core: smoke cards cut into its front face.
    case 'center':
      return [0.2, 0.35, -0.5]
    case 'left':
      return [-0.75, 0.35, -0.2]
    // Between the camera and the smoke: it must occlude the smoke.
    case 'front': {
      const { yaw } = ORBITS[camera]
      return [Math.sin(yaw) * 1.3, 0.4, Math.cos(yaw) * 1.3]
    }
    default: {
      const unreachable: never = contact
      throw new Error(`Unhandled contact ${String(unreachable)}`)
    }
  }
}

function sourceEncoding(source: MaterialProofDepthSource): PfxMaterialDepthEncoding {
  if (source === 'reversed') return 'reversed'
  if (source === 'packed') return 'packed-rgba'
  return 'standard'
}

// ---------------------------------------------------------------------------
// Camera rig (-3) and the late priority-0 update.

function CameraRig({ angle, projection, autoRotate }: { angle: MaterialProofCamera; projection: MaterialProofDepthProjection; autoRotate: boolean }) {
  useFrame((state) => {
    const { camera, clock, size } = state
    const orbit = ORBITS[angle]
    const yaw = orbit.yaw + (autoRotate ? clock.elapsedTime * AUTO_ROTATE_RADIANS_PER_SECOND : 0)
    const horizontal = Math.cos(orbit.pitch) * orbit.distance
    camera.position.set(TARGET.x + Math.sin(yaw) * horizontal, TARGET.y + Math.sin(orbit.pitch) * orbit.distance, TARGET.z + Math.cos(yaw) * horizontal)
    camera.lookAt(TARGET)
    if (projection === 'orthographic') (camera as THREE.OrthographicCamera).zoom = size.height / ORTHO_VIEW_HEIGHT
    ;(camera as THREE.PerspectiveCamera | THREE.OrthographicCamera).updateProjectionMatrix()
    camera.updateMatrixWorld()
  }, CAMERA_RIG_PRIORITY)
  return null
}

const lateOffset = new THREE.Vector3()

function LateCameraUpdate({ enabled }: { enabled: boolean }) {
  // Priority 0 and mounted after the effect, so it runs after the consumers:
  // the draw-time guard must catch it.
  useFrame(({ camera }) => {
    if (!enabled) return
    const offset = lateOffset.copy(camera.position).sub(TARGET)
    offset.applyAxisAngle(THREE.Object3D.DEFAULT_UP, LATE_CAMERA_YAW)
    camera.position.copy(TARGET).add(offset)
    camera.lookAt(TARGET)
    camera.updateMatrixWorld()
  })
  return null
}

// ---------------------------------------------------------------------------
// Opaque fixture: ground and contact box. The capture host mirrors it.

function OpaqueFixture({ fixture, contact, camera }: { fixture: React.RefObject<THREE.Group>; contact: MaterialProofDepthContact; camera: MaterialProofCamera }) {
  const position = contactPosition(contact, camera)
  return (
    <group ref={fixture} name="opaque-fixture">
      <mesh name="ground" position={[0, -0.05, 0]}>
        <boxGeometry args={[7, 0.1, 7]} />
        <meshStandardMaterial color="#3f4a5a" roughness={0.9} />
      </mesh>
      {position && (
        <mesh name="contact-box" position={position}>
          <boxGeometry args={[0.7, 0.7, 0.7]} />
          <meshStandardMaterial color="#2f6fd6" roughness={0.6} />
        </mesh>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Host capture adapter.

export interface DepthHostStats {
  captures: number
  captureErrors: number
  lastCaptureError: string | null
  restoreChecks: number
  restoreFailures: string[]
  targetSize: [number, number] | null
  targetsCreated: number
  targetsDisposed: number
  depthSceneObjects: string[]
  ownedDisposed: { targets: number; materials: number }
  depthImageRequest: number
  depthImage: MaterialProofDepthReport['depthImage']
}

function createHostStats(): DepthHostStats {
  return {
    captures: 0,
    captureErrors: 0,
    lastCaptureError: null,
    restoreChecks: 0,
    restoreFailures: [],
    targetSize: null,
    targetsCreated: 0,
    targetsDisposed: 0,
    depthSceneObjects: [],
    ownedDisposed: { targets: 0, materials: 0 },
    depthImageRequest: 0,
    depthImage: null,
  }
}

/** Preallocated renderer state. Capture allocates nothing on its success path. */
interface RendererStateSnapshot {
  target: THREE.WebGLRenderTarget | null
  cubeFace: number
  mipLevel: number
  viewport: THREE.Vector4
  scissor: THREE.Vector4
  scissorTest: boolean
  clearColor: THREE.Color
  clearAlpha: number
  autoClear: boolean
  autoClearColor: boolean
  autoClearDepth: boolean
  autoClearStencil: boolean
  sortObjects: boolean
  localClippingEnabled: boolean
  toneMapping: THREE.ToneMapping
  outputColorSpace: string
  shadowAutoUpdate: boolean
}

function createSnapshot(): RendererStateSnapshot {
  return {
    target: null, cubeFace: 0, mipLevel: 0, viewport: new THREE.Vector4(), scissor: new THREE.Vector4(), scissorTest: false,
    clearColor: new THREE.Color(), clearAlpha: 1, autoClear: true, autoClearColor: true, autoClearDepth: true, autoClearStencil: true,
    sortObjects: true, localClippingEnabled: false, toneMapping: THREE.NoToneMapping, outputColorSpace: '', shadowAutoUpdate: true,
  }
}

function saveRendererState(gl: THREE.WebGLRenderer, into: RendererStateSnapshot): void {
  into.target = gl.getRenderTarget()
  into.cubeFace = gl.getActiveCubeFace()
  into.mipLevel = gl.getActiveMipmapLevel()
  gl.getViewport(into.viewport)
  gl.getScissor(into.scissor)
  into.scissorTest = gl.getScissorTest()
  gl.getClearColor(into.clearColor)
  into.clearAlpha = gl.getClearAlpha()
  into.autoClear = gl.autoClear
  into.autoClearColor = gl.autoClearColor
  into.autoClearDepth = gl.autoClearDepth
  into.autoClearStencil = gl.autoClearStencil
  into.sortObjects = gl.sortObjects
  into.localClippingEnabled = gl.localClippingEnabled
  into.toneMapping = gl.toneMapping
  into.outputColorSpace = gl.outputColorSpace
  into.shadowAutoUpdate = gl.shadowMap.autoUpdate
}

function restoreRendererState(gl: THREE.WebGLRenderer, from: RendererStateSnapshot): void {
  gl.setRenderTarget(from.target, from.cubeFace, from.mipLevel)
  gl.setViewport(from.viewport)
  gl.setScissor(from.scissor)
  gl.setScissorTest(from.scissorTest)
  gl.setClearColor(from.clearColor, from.clearAlpha)
  gl.autoClear = from.autoClear
  gl.autoClearColor = from.autoClearColor
  gl.autoClearDepth = from.autoClearDepth
  gl.autoClearStencil = from.autoClearStencil
  gl.sortObjects = from.sortObjects
  gl.localClippingEnabled = from.localClippingEnabled
  gl.toneMapping = from.toneMapping
  gl.outputColorSpace = from.outputColorSpace as THREE.ColorSpace
  gl.shadowMap.autoUpdate = from.shadowAutoUpdate
}

/** Field names that differ. Empty when the state is fully restored. */
function snapshotDifferences(a: RendererStateSnapshot, b: RendererStateSnapshot): string[] {
  const differences: string[] = []
  if (a.target !== b.target) differences.push('target')
  if (a.cubeFace !== b.cubeFace) differences.push('cubeFace')
  if (a.mipLevel !== b.mipLevel) differences.push('mipLevel')
  if (!a.viewport.equals(b.viewport)) differences.push('viewport')
  if (!a.scissor.equals(b.scissor)) differences.push('scissor')
  if (a.scissorTest !== b.scissorTest) differences.push('scissorTest')
  if (!a.clearColor.equals(b.clearColor)) differences.push('clearColor')
  if (a.clearAlpha !== b.clearAlpha) differences.push('clearAlpha')
  if (a.autoClear !== b.autoClear) differences.push('autoClear')
  if (a.autoClearColor !== b.autoClearColor) differences.push('autoClearColor')
  if (a.autoClearDepth !== b.autoClearDepth) differences.push('autoClearDepth')
  if (a.autoClearStencil !== b.autoClearStencil) differences.push('autoClearStencil')
  if (a.sortObjects !== b.sortObjects) differences.push('sortObjects')
  if (a.localClippingEnabled !== b.localClippingEnabled) differences.push('localClippingEnabled')
  if (a.toneMapping !== b.toneMapping) differences.push('toneMapping')
  if (a.outputColorSpace !== b.outputColorSpace) differences.push('outputColorSpace')
  if (a.shadowAutoUpdate !== b.shadowAutoUpdate) differences.push('shadowAutoUpdate')
  return differences
}

const DEPTH_VIEW_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

// Linear view distance, mapped near = white, far = black. Diagnostic image only.
const DEPTH_VIEW_FRAGMENT = /* glsl */ `
uniform sampler2D uDepth;
uniform vec4 uProjection;
varying vec2 vUv;
void main() {
  float ndc = texture2D(uDepth, vUv).r * 2.0 - 1.0;
  float distance = -(uProjection.y - ndc * uProjection.w) / (ndc * uProjection.z - uProjection.x);
  float value = 1.0 - clamp((distance - 2.0) / 8.0, 0.0, 1.0);
  gl_FragColor = vec4(vec3(value), 1.0);
}
`

interface HostOwned {
  viewport: THREE.Vector4
  depthScene: THREE.Scene
  depthMaterial: THREE.MeshBasicMaterial
  twins: Map<THREE.Mesh, THREE.Mesh>
  target: THREE.WebGLRenderTarget | null
  drawing: THREE.Vector2
  saved: RendererStateSnapshot
  after: RendererStateSnapshot
  wrongCamera: THREE.Camera | null
  viewScene: THREE.Scene
  viewMaterial: THREE.ShaderMaterial
  viewTarget: THREE.WebGLRenderTarget | null
  viewCamera: THREE.OrthographicCamera
  handledImageRequest: number
}

function createHostOwned(): HostOwned {
  const depthMaterial = new THREE.MeshBasicMaterial({ colorWrite: false })
  const viewMaterial = new THREE.ShaderMaterial({
    uniforms: { uDepth: { value: null }, uProjection: { value: new THREE.Vector4() } },
    vertexShader: DEPTH_VIEW_VERTEX,
    fragmentShader: DEPTH_VIEW_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  })
  const viewScene = new THREE.Scene()
  viewScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), viewMaterial))
  return {
    viewport: new THREE.Vector4(),
    depthScene: new THREE.Scene(),
    depthMaterial,
    twins: new Map(),
    target: null,
    drawing: new THREE.Vector2(),
    saved: createSnapshot(),
    after: createSnapshot(),
    wrongCamera: null,
    viewScene,
    viewMaterial,
    viewTarget: null,
    viewCamera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    handledImageRequest: 0,
  }
}

// Dispose only what this adapter owns. The caller texture is detached from
// the render target first: WebGLRenderTarget.dispose() disposes an
// attached depthTexture.
function disposeHostOwned(owned: HostOwned, stats: DepthHostStats): void {
  if (owned.target) {
    owned.target.depthTexture = null
    owned.target.dispose()
    stats.targetsDisposed += 1
    stats.ownedDisposed.targets += 1
    owned.target = null
  }
  if (owned.viewTarget) {
    owned.viewTarget.dispose()
    stats.ownedDisposed.targets += 1
  }
  owned.depthMaterial.dispose()
  owned.viewMaterial.dispose()
  stats.ownedDisposed.materials += 2
  for (const mesh of owned.viewScene.children) (mesh as THREE.Mesh).geometry.dispose()
  owned.twins.clear()
}

function DepthCaptureHost({
  descriptorRef,
  source,
  quality,
  fixture,
  captureError,
  stats,
  releaseTextureStorage,
}: {
  descriptorRef: React.MutableRefObject<PfxMaterialDepthSource | null>
  source: MaterialProofDepthSource
  quality: PfxMaterialQuality
  fixture: React.RefObject<THREE.Group>
  captureError: boolean
  stats: DepthHostStats
  /** Owner callback: frees the caller texture's GPU storage before a new size. */
  releaseTextureStorage: () => void
}) {
  const frame = usePfxMaterialFrame()
  const gl = useThree((state) => state.gl)
  // Created and disposed in one effect, so a StrictMode remount never draws
  // with a disposed resource.
  const ownedRef = useRef<HostOwned | null>(null)
  useEffect(() => {
    const owned = createHostOwned()
    ownedRef.current = owned
    return () => {
      ownedRef.current = null
      disposeHostOwned(owned, stats)
    }
  }, [stats])

  const syncTwins = (owned: HostOwned, group: THREE.Group) => {
    // Shared geometry; the twin copies the world matrix. A twin is created
    // only when the fixture adds a mesh, never per frame.
    group.updateWorldMatrix(true, true)
    for (const child of group.children) {
      if (!(child instanceof THREE.Mesh)) continue
      let twin = owned.twins.get(child)
      if (!twin) {
        twin = new THREE.Mesh(child.geometry, owned.depthMaterial)
        twin.name = child.name
        twin.matrixAutoUpdate = false
        twin.matrixWorldAutoUpdate = false
        owned.twins.set(child, twin)
        owned.depthScene.add(twin)
        stats.depthSceneObjects = owned.depthScene.children.map((object) => object.name)
      }
      twin.geometry = child.geometry
      twin.visible = child.visible
      twin.matrixWorld.copy(child.matrixWorld)
    }
    for (const [mesh, twin] of owned.twins) {
      if (mesh.parent === group) continue
      owned.depthScene.remove(twin)
      owned.twins.delete(mesh)
      stats.depthSceneObjects = owned.depthScene.children.map((object) => object.name)
    }
  }

  const ensureTarget = (owned: HostOwned, width: number, height: number, texture: THREE.DepthTexture) => {
    const current = owned.target
    if (current && (source === 'size-hold' || (current.width === width && current.height === height))) return current
    if (current) {
      current.depthTexture = null
      current.dispose()
      stats.targetsDisposed += 1
    }
    // three r170 allocates WebGL2 depth storage once (texStorage2D), so an
    // uploaded texture needs new storage for a new size. Only the owner may
    // release it; the same texture object then uploads at the new size.
    const image = texture.image as { width: number; height: number }
    if (texture.version > 0 && (image.width !== width || image.height !== height)) releaseTextureStorage()
    const next = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true, depthTexture: texture })
    owned.target = next
    stats.targetsCreated += 1
    stats.targetSize = [width, height]
    return next
  }

  const renderDepthImage = (owned: HostOwned, descriptor: PfxMaterialDepthSource, width: number, height: number) => {
    // Diagnostic export: one extra pass on request only.
    if (!owned.viewTarget || owned.viewTarget.width !== width || owned.viewTarget.height !== height) {
      owned.viewTarget?.dispose()
      owned.viewTarget = new THREE.WebGLRenderTarget(width, height)
    }
    const projection = descriptor.projectionMatrix.elements
    owned.viewMaterial.uniforms.uDepth!.value = descriptor.texture
    ;(owned.viewMaterial.uniforms.uProjection!.value as THREE.Vector4).set(projection[10]!, projection[14]!, projection[11]!, projection[15]!)
    gl.setRenderTarget(owned.viewTarget)
    gl.render(owned.viewScene, owned.viewCamera)
    const pixels = new Uint8Array(width * height * 4)
    gl.readRenderTargetPixels(owned.viewTarget, 0, 0, width, height, pixels)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('DepthCaptureHost: no 2D context for the depth image')
    const image = context.createImageData(width, height)
    // WebGL rows start at the bottom.
    for (let row = 0; row < height; row += 1) {
      image.data.set(pixels.subarray((height - 1 - row) * width * 4, (height - row) * width * 4), row * width * 4)
    }
    context.putImageData(image, 0, 0)
    stats.depthImage = { at: frame.token, width, height, dataUri: canvas.toDataURL('image/png') }
  }

  useFrame(({ camera }) => {
    const owned = ownedRef.current
    const descriptor = descriptorRef.current
    if (!owned) return
    // One capture per canvas, high quality only. No source, no pass. A
    // paused capture (stale) and a provider without the ref add no pass.
    if (!descriptor || quality !== 'high' || source === 'stale' || source === 'no-ref') return
    const group = fixture.current
    if (!group) return
    invalidatePfxMaterialDepthSource(descriptor)
    descriptor.encoding = sourceEncoding(source)
    gl.getDrawingBufferSize(owned.drawing)
    // The main render's viewport, in drawing-buffer pixels. The capture uses
    // it too, so both renders map NDC to the same pixels.
    gl.getCurrentViewport(owned.viewport)
    let captureCamera: THREE.Camera = camera
    if (source === 'wrong-camera') {
      if (!owned.wrongCamera || owned.wrongCamera.type !== camera.type) owned.wrongCamera = camera.clone()
      owned.wrongCamera.copy(camera)
      captureCamera = owned.wrongCamera
    }
    saveRendererState(gl, owned.saved)
    try {
      const target = ensureTarget(owned, owned.drawing.x, owned.drawing.y, descriptor.texture)
      syncTwins(owned, group)
      if (captureError) {
        // Forced fault: leave the renderer in a changed state, then throw.
        gl.setRenderTarget(target)
        gl.setViewport(1, 1, 7, 7)
        gl.setScissor(2, 2, 5, 5)
        gl.setScissorTest(true)
        gl.setClearColor(0xff00ff, 0.5)
        gl.autoClear = false
        gl.sortObjects = false
        throw new Error('forced capture error')
      }
      target.viewport.copy(owned.viewport)
      gl.setRenderTarget(target)
      gl.autoClear = true
      gl.autoClearColor = true
      gl.autoClearDepth = true
      gl.autoClearStencil = true
      gl.render(owned.depthScene, captureCamera)
      stampPfxMaterialDepthSource(descriptor, {
        camera: captureCamera,
        width: target.width,
        height: target.height,
        token: frame.token,
        xr: source === 'xr',
        viewport: owned.viewport,
      })
      stats.captures += 1
      if (stats.depthImageRequest !== owned.handledImageRequest) {
        owned.handledImageRequest = stats.depthImageRequest
        renderDepthImage(owned, descriptor, target.width, target.height)
      }
    } catch (error) {
      stats.captureErrors += 1
      stats.lastCaptureError = error instanceof Error ? error.message : String(error)
    } finally {
      restoreRendererState(gl, owned.saved)
      saveRendererState(gl, owned.after)
      stats.restoreChecks += 1
      const differences = snapshotDifferences(owned.saved, owned.after)
      if (differences.length > 0) stats.restoreFailures.push(differences.join(','))
    }
  }, PFX_MATERIAL_DEPTH_CAPTURE_PRIORITY)
  return null
}

// ---------------------------------------------------------------------------
// Diagnostics. Priority 0, mounted after the effect and before the late
// camera update, so it sees what the consumers saw.

interface DiagnosticsState {
  frames: number
  lastRenderFrame: number
  passesLastFrame: number
  mainDrawCalls: number
  drawnCounts: Record<string, number>
  variantMaterials: Record<string, { disposed: boolean }>
  validity: string
  runtimeRequest: number
  handledRuntimeRequest: number
  runtimeCheck: MaterialProofDepthReport['runtimeCheck']
}

function activeSamplers(renderer: THREE.WebGLRenderer, material: THREE.Material): string[] {
  const program = (renderer.properties.get(material) as { currentProgram?: { program: WebGLProgram } }).currentProgram
  if (!program) return []
  const context = renderer.getContext()
  const count = context.getProgramParameter(program.program, context.ACTIVE_UNIFORMS) as number
  const samplers: string[] = []
  for (let index = 0; index < count; index += 1) {
    const info = context.getActiveUniform(program.program, index)
    if (info && info.type === context.SAMPLER_2D) samplers.push(info.name)
  }
  return samplers.sort()
}

function findLayerMeshes(root: THREE.Object3D): Array<{ layer: string; mesh: THREE.Mesh }> {
  const found: Array<{ layer: string; mesh: THREE.Mesh }> = []
  root.traverse((object) => {
    const surface = object.userData.pfxSurface as PfxRenderSurface | undefined
    if (surface && object instanceof THREE.Mesh) found.push({ layer: surface.phase ?? surface.kind, mesh: object })
  })
  return found
}

function drawnVariant(mesh: THREE.Mesh): 'soft' | 'soft-gated' | 'hard' | 'none' {
  const material = mesh.material as THREE.ShaderMaterial
  const variant = material.userData[PFX_MATERIAL_DEPTH_VARIANT_USERDATA_KEY] as string | undefined
  if (variant === 'soft') return material.uniforms.uPfxDepthFadeGate!.value === 1 ? 'soft' : 'soft-gated'
  if (variant === 'hard') return 'hard'
  return 'none'
}

function DepthDiagnostics({
  effectRoot,
  descriptorRef,
  options,
  quality,
  stats,
  texture,
  reasons,
  diagnostics,
}: {
  effectRoot: React.RefObject<THREE.Group>
  descriptorRef: React.MutableRefObject<PfxMaterialDepthSource | null>
  options: MaterialProofDepthOptions
  quality: PfxMaterialQuality
  stats: DepthHostStats
  texture: { texture: THREE.DepthTexture; disposeEvents: number; ownerReleases: number }
  reasons: Set<string>
  diagnostics: DiagnosticsState
}) {
  const { gl } = useThree()
  const context = usePfxMaterialContext()
  const depthFrame = useMemo(createPfxMaterialDepthFrame, [])
  const onVariantDispose = useMemo(() => (event: { target: THREE.Material }) => {
    diagnostics.variantMaterials[event.target.uuid] = { disposed: true }
  }, [diagnostics])
  useFrame((state) => {
    diagnostics.frames += 1
    const descriptor = options.source === 'no-ref' || options.source === 'no-provider' ? null : descriptorRef.current
    const validity = validatePfxMaterialDepthSource(descriptor, readPfxMaterialDepthFrame(depthFrame, gl, state.camera, context.frame?.token ?? -1))
    diagnostics.validity = validity.reason ?? 'valid'
    const root = effectRoot.current
    const layers = root ? findLayerMeshes(root) : []
    for (const { mesh } of layers) {
      const variants = mesh.userData.pfxDepthVariants as { soft: string; hard: string } | null
      if (variants) {
        for (const uuid of [variants.soft, variants.hard]) diagnostics.variantMaterials[uuid] ??= { disposed: false }
        const material = mesh.material as THREE.Material
        if (!material.hasEventListener('dispose', onVariantDispose)) material.addEventListener('dispose', onVariantDispose)
      }
    }
    if (diagnostics.runtimeRequest !== diagnostics.handledRuntimeRequest && root) {
      diagnostics.handledRuntimeRequest = diagnostics.runtimeRequest
      diagnostics.runtimeCheck = { at: diagnostics.frames, result: checkPfxPreviewResources(root, gl) }
    }
    // Write the report every third frame: it allocates, and it is not the
    // measured capture path.
    if (diagnostics.frames % 3 !== 0) return
    const size = gl.getDrawingBufferSize(new THREE.Vector2())
    const image = texture.texture.image as { width: number; height: number }
    const report: MaterialProofDepthReport = {
      frame: diagnostics.frames,
      drawingBuffer: [size.x, size.y],
      quality,
      source: options.source,
      passesLastFrame: diagnostics.passesLastFrame,
      mainDrawCalls: diagnostics.mainDrawCalls,
      programs: gl.info.programs?.length ?? null,
      textures: gl.info.memory.textures,
      geometries: gl.info.memory.geometries,
      host: {
        captures: stats.captures,
        captureErrors: stats.captureErrors,
        lastCaptureError: stats.lastCaptureError,
        restoreChecks: stats.restoreChecks,
        restoreFailures: stats.restoreFailures.slice(-5),
        targetSize: stats.targetSize,
        targetsCreated: stats.targetsCreated,
        targetsDisposed: stats.targetsDisposed,
        depthSceneObjects: stats.depthSceneObjects,
        ownedDisposed: stats.ownedDisposed,
      },
      callerTexture: { uuid: texture.texture.uuid, disposeEvents: texture.disposeEvents, ownerReleases: texture.ownerReleases, image: [image.width, image.height] },
      validity: diagnostics.validity,
      drawnCounts: diagnostics.drawnCounts,
      layers: layers.map(({ layer, mesh }) => {
        const variants = mesh.userData.pfxDepthVariants as { soft: string; hard: string } | null
        return {
          layer,
          drawn: drawnVariant(mesh),
          soft: variants?.soft ?? null,
          hard: variants?.hard ?? null,
          samplers: activeSamplers(gl, mesh.material as THREE.Material),
        }
      }),
      variantMaterials: diagnostics.variantMaterials,
      reportedReasons: [...reasons].sort(),
      runtimeCheck: diagnostics.runtimeCheck,
      depthImage: stats.depthImage,
    }
    gl.domElement.dataset.pfxDepthProof = JSON.stringify(report)
  })
  return null
}

/** Pass counter and drawn-variant tally. Runs first in each frame (-3). */
function FrameCounters({ effectRoot, diagnostics }: { effectRoot: React.RefObject<THREE.Group> | null; diagnostics: DiagnosticsState }) {
  const gl = useThree((state) => state.gl)
  useFrame(() => {
    const renders = gl.info.render.frame
    diagnostics.passesLastFrame = renders - diagnostics.lastRenderFrame
    diagnostics.lastRenderFrame = renders
    // The last render of the previous frame is the main render.
    diagnostics.mainDrawCalls = gl.info.render.calls
    // The mesh still holds the material that the previous frame drew.
    const root = effectRoot?.current
    if (!root) return
    for (const { mesh } of findLayerMeshes(root)) {
      const drawn = drawnVariant(mesh)
      diagnostics.drawnCounts[drawn] = (diagnostics.drawnCounts[drawn] ?? 0) + 1
    }
  }, CAMERA_RIG_PRIORITY)
  return null
}

// ---------------------------------------------------------------------------
// Stage

const fieldStyle: CSSProperties = { display: 'grid', gap: 4, fontSize: 14 }
const controlsStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }

const SOURCE_LABELS: Record<MaterialProofDepthSource, string> = {
  valid: 'Valid capture',
  'no-provider': 'No provider (baseline)',
  'no-ref': 'Provider without depth source',
  null: 'Source ref is null',
  stale: 'Stale token (capture paused)',
  'wrong-camera': 'Other capture view object',
  'size-hold': 'Hold old size after resize',
  reversed: 'Reversed depth declared',
  packed: 'Packed RGBA depth declared',
  xr: 'XR capture declared',
}

export interface MaterialDepthStageProps {
  options: MaterialProofDepthOptions
  onChange: (options: MaterialProofDepthOptions) => void
  quality: PfxMaterialQuality
  camera: MaterialProofCamera
  timeSeconds: number
  /** Rendered inside the Canvas (the proof frame handshake). */
  children?: ReactNode
}

export function MaterialDepthStage({ options, onChange, quality, camera, timeSeconds, children }: MaterialDepthStageProps) {
  // Caller-owned depth texture and descriptor. They outlive every inner
  // unmount and canvas remount; only this owner disposes the texture.
  const [callerTexture] = useState(() => {
    const texture = new THREE.DepthTexture(1, 1)
    texture.name = 'caller-scene-depth'
    // ownerReleases: GPU storage releases by this owner at a resize.
    const record = { texture, disposeEvents: 0, ownerReleases: 0 }
    texture.addEventListener('dispose', () => {
      record.disposeEvents += 1
    })
    return record
  })
  // The owner keeps the texture for the page lifetime. Its GPU copy goes
  // with the WebGL context when the canvas unmounts. A dispose here would
  // also run on the StrictMode test remount and hide a library dispose.
  const releaseTextureStorage = useMemo(() => () => {
    callerTexture.ownerReleases += 1
    callerTexture.texture.dispose()
  }, [callerTexture])
  const descriptor = useMemo(() => createPfxMaterialDepthSource(callerTexture.texture), [callerTexture])
  const descriptorRef = useRef<PfxMaterialDepthSource | null>(descriptor)
  descriptorRef.current = options.source === 'null' ? null : descriptor
  const stats = useMemo(createHostStats, [])
  const reasons = useMemo(() => new Set<string>(), [])
  const diagnostics = useMemo<DiagnosticsState>(() => ({
    frames: 0, lastRenderFrame: 0, passesLastFrame: 0, mainDrawCalls: 0, drawnCounts: {}, variantMaterials: {}, validity: 'none',
    runtimeRequest: 0, handledRuntimeRequest: 0, runtimeCheck: null,
  }), [])
  const fixture = useRef<THREE.Group>(null)
  const effectRoot = useRef<THREE.Group>(null)
  const recipe = useMemo(() => smokeDepthRecipe(options.softness), [options.softness])
  const preset = useMemo(() => createPfxPreset('smoke-puff', { seed: MATERIAL_PROOF_SEED }), [])
  const set = (patch: Partial<MaterialProofDepthOptions>) => onChange({ ...options, ...patch })
  const orthographic = options.projection === 'orthographic'
  const logDepth = options.depthBuffer === 'logarithmic'
  const onDepthFallback = (reason: PfxMaterialDepthFallbackReason) => {
    reasons.add(reason)
  }
  const stageStyle: CSSProperties = {
    width: '100%',
    aspectRatio: options.stageSize === 'square' ? '1 / 1' : '16 / 9',
    background: '#111827',
  }

  const scene = (
    <>
      <OpaqueFixture fixture={fixture} contact={options.contact} camera={camera} />
      <group ref={effectRoot}>
        {options.smoke && <GamePfx preset={preset} recipeOverride={recipe} previewTimeSeconds={timeSeconds} />}
      </group>
    </>
  )

  return (
    <section aria-label="Depth fixture" style={{ display: 'grid', gap: 8 }}>
      <div style={controlsStyle} role="group" aria-label="Depth options">
        <label style={fieldStyle}>
          Depth source
          <select data-testid="material-proof-depth-source" value={options.source} onChange={(event) => set({ source: event.target.value as MaterialProofDepthSource })}>
            {MATERIAL_PROOF_DEPTH_SOURCES.map((value) => <option key={value} value={value}>{SOURCE_LABELS[value]}</option>)}
          </select>
        </label>
        <label style={fieldStyle}>
          Depth projection
          <select data-testid="material-proof-depth-projection" value={options.projection} onChange={(event) => set({ projection: event.target.value as MaterialProofDepthProjection })}>
            {MATERIAL_PROOF_DEPTH_PROJECTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label style={fieldStyle}>
          Depth buffer
          <select data-testid="material-proof-depth-buffer" value={options.depthBuffer} onChange={(event) => set({ depthBuffer: event.target.value as MaterialProofDepthBuffer })}>
            {MATERIAL_PROOF_DEPTH_BUFFERS.map((value) => <option key={value} value={value}>{value === 'standard' ? 'standard' : 'logarithmic renderer'}</option>)}
          </select>
        </label>
        <label style={fieldStyle}>
          Contact box
          <select data-testid="material-proof-depth-contact" value={options.contact} onChange={(event) => set({ contact: event.target.value as MaterialProofDepthContact })}>
            {MATERIAL_PROOF_DEPTH_CONTACTS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label style={fieldStyle}>
          Stage size
          <select data-testid="material-proof-depth-stage-size" value={options.stageSize} onChange={(event) => set({ stageSize: event.target.value as MaterialProofDepthStageSize })}>
            {MATERIAL_PROOF_DEPTH_STAGE_SIZES.map((value) => <option key={value} value={value}>{value === 'square' ? 'square (1:1)' : 'wide (16:9)'}</option>)}
          </select>
        </label>
        <label style={fieldStyle}>
          Depth fade distance (world units)
          <input
            data-testid="material-proof-depth-softness"
            type="number"
            min={0.001}
            max={10}
            step={0.05}
            value={options.softness}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (Number.isFinite(value) && value >= 0.001 && value <= 10) set({ softness: value })
            }}
          />
        </label>
        <label style={{ ...fieldStyle, gridAutoFlow: 'column', alignItems: 'center' }}>
          <input type="checkbox" data-testid="material-proof-depth-smoke" checked={options.smoke} onChange={(event) => set({ smoke: event.target.checked })} />
          Smoke visible
        </label>
        <label style={{ ...fieldStyle, gridAutoFlow: 'column', alignItems: 'center' }}>
          <input type="checkbox" data-testid="material-proof-depth-auto-rotate" checked={options.autoRotate} onChange={(event) => set({ autoRotate: event.target.checked })} />
          Auto-rotate view
        </label>
        <label style={{ ...fieldStyle, gridAutoFlow: 'column', alignItems: 'center' }}>
          <input type="checkbox" data-testid="material-proof-depth-late-camera" checked={options.lateCamera} onChange={(event) => set({ lateCamera: event.target.checked })} />
          Late view update
        </label>
        <label style={{ ...fieldStyle, gridAutoFlow: 'column', alignItems: 'center' }}>
          <input type="checkbox" data-testid="material-proof-depth-capture-error" checked={options.captureError} onChange={(event) => set({ captureError: event.target.checked })} />
          Force capture error
        </label>
        <label style={{ ...fieldStyle, gridAutoFlow: 'column', alignItems: 'center' }}>
          <input type="checkbox" data-testid="material-proof-depth-mounted" checked={options.mounted} onChange={(event) => set({ mounted: event.target.checked })} />
          Depth stage mounted
        </label>
        <button type="button" data-testid="material-proof-depth-export" onClick={() => { stats.depthImageRequest += 1 }}>
          Export depth image
        </button>
        <button type="button" data-testid="material-proof-depth-runtime-check" onClick={() => { diagnostics.runtimeRequest += 1 }}>
          Check runtime status
        </button>
      </div>
      <p style={{ margin: 0, fontSize: 13 }} data-testid="material-proof-depth-help">
        Smoke-puff override with depth fade on its three alpha layers. The host captures the opaque ground and box once per
        canvas at high quality. Every other source state uses the hard depth test.
      </p>
      <div style={stageStyle} data-testid="material-proof-stage">
        <Canvas
          key={`${options.projection}:${logDepth ? 'log' : 'standard'}`}
          dpr={1}
          orthographic={orthographic}
          camera={orthographic ? { position: [0, 1, 5], near: 0.05, far: 40, zoom: 100 } : { position: [0, 1, 5], fov: 44, near: 0.05, far: 40 }}
          gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, logarithmicDepthBuffer: logDepth }}
        >
          <color attach="background" args={['#111827']} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 5, 4]} intensity={1.2} />
          <CameraRig angle={camera} projection={options.projection} autoRotate={options.autoRotate} />
          <FrameCounters effectRoot={options.mounted ? effectRoot : null} diagnostics={diagnostics} />
          {options.mounted && (options.source === 'no-provider' ? scene : (
            <PfxMaterialProvider
              quality={quality}
              depthSource={options.source === 'no-ref' ? null : descriptorRef}
              onDepthFallback={onDepthFallback}
            >
              <DepthCaptureHost
                descriptorRef={descriptorRef}
                source={options.source}
                quality={quality}
                fixture={fixture}
                captureError={options.captureError}
                stats={stats}
                releaseTextureStorage={releaseTextureStorage}
              />
              {scene}
              <DepthDiagnostics
                effectRoot={effectRoot}
                descriptorRef={descriptorRef}
                options={options}
                quality={quality}
                stats={stats}
                texture={callerTexture}
                reasons={reasons}
                diagnostics={diagnostics}
              />
            </PfxMaterialProvider>
          ))}
          {options.mounted && options.source === 'no-provider' && (
            <DepthDiagnostics
              effectRoot={effectRoot}
              descriptorRef={descriptorRef}
              options={options}
              quality={quality}
              stats={stats}
              texture={callerTexture}
              reasons={reasons}
              diagnostics={diagnostics}
            />
          )}
          {!options.mounted && <UnmountedReport stats={stats} texture={callerTexture} diagnostics={diagnostics} />}
          <LateCameraUpdate enabled={options.lateCamera} />
          {children}
        </Canvas>
      </div>
    </section>
  )
}

/** While the stage is unmounted, the caller texture and owned-resource counts stay visible. */
function UnmountedReport({ stats, texture, diagnostics }: { stats: DepthHostStats; texture: { texture: THREE.DepthTexture; disposeEvents: number; ownerReleases: number }; diagnostics: DiagnosticsState }) {
  const gl = useThree((state) => state.gl)
  const frames = useRef(0)
  useFrame(() => {
    frames.current += 1
    const image = texture.texture.image as { width: number; height: number }
    gl.domElement.dataset.pfxDepthProof = JSON.stringify({
      unmounted: true,
      frame: frames.current,
      callerTexture: { uuid: texture.texture.uuid, disposeEvents: texture.disposeEvents, ownerReleases: texture.ownerReleases, image: [image.width, image.height] },
      host: { targetsCreated: stats.targetsCreated, targetsDisposed: stats.targetsDisposed, ownedDisposed: stats.ownedDisposed },
      variantMaterials: diagnostics.variantMaterials,
    })
  })
  return null
}
