import { createPortal, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  AdditiveBlending,
  DoubleSide,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Group,
  MeshBasicMaterial,
  InstancedBufferAttribute,
  InstancedMesh,
  NormalBlending,
  ClampToEdgeWrapping,
  Object3D,
  Quaternion,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector3,
} from 'three'
import { verticalBillboardYaw } from './billboard'
import { BURGER_SHOP_RECIPES } from './recipes'
import {
  createBurgerShopSimulation,
  type BurgerShopSimulation,
  createSeededRandom,
  liveColor,
  liveSize,
  sampleCurve,
  sheetFrame,
  stepBurgerShopSimulation,
} from './simulate'
import { BURGER_SHOP_TEXTURE_URLS } from './textures'
import { BURGER_SHOP_WORLD_SCALE, type BurgerShopBlend, type BurgerShopEmitter, type BurgerShopRecipe } from './types'

const textureCache = new Map<string, Texture>()
const loader = new TextureLoader()

function loadTexture(id: string, urls: Record<string, string>): Texture {
  const url = urls[id]
  if (!url) throw new Error(`Missing particle texture: ${id}`)
  const cached = textureCache.get(url)
  if (cached) return cached
  const texture = loader.load(url)
  texture.flipY = true
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  textureCache.set(url, texture)
  return texture
}

// The logdepthbuf chunks make particles depth-test correctly when the
// renderer uses a logarithmic depth buffer (three.js defines USE_LOGDEPTHBUF
// for ShaderMaterial then); without them particles hide behind meshes.
const vertexShader = `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec4 instanceColor;
  attribute vec4 instanceUv;
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    vec2 scale = instanceUv.zw;
    if (scale.x < 0.0001 || scale.y < 0.0001) scale = vec2(1.0);
    vUv = instanceUv.xy + uv * scale;
    vColor = instanceColor;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`

const fragmentShader = `
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uMap;
  uniform float uCutoff;
  uniform float uAlphaClip;
  uniform float uLumaAlpha;
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    #include <logdepthbuf_fragment>
    vec4 texel = texture2D(uMap, vUv);
    float luma = max(texel.r, max(texel.g, texel.b));
    float coverage = uLumaAlpha > 0.5 ? texel.a * luma : texel.a;
    vec4 color = vec4(texel.rgb * vColor.rgb, coverage * vColor.a);
    if (uAlphaClip > 0.5 && color.a < uCutoff) discard;
    gl_FragColor = color;
  }
`

function createMaterial(texture: Texture, blend: BurgerShopBlend, lumaAlpha: boolean): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uCutoff: { value: blend === 'cutout' ? 0.05 : 0.001 },
      uAlphaClip: { value: blend === 'cutout' ? 1 : 0 },
      uLumaAlpha: { value: lumaAlpha ? 1 : 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: blend === 'additive' ? AdditiveBlending : NormalBlending,
  })
}

const dummy = new Object3D()
const cameraLocal = new Vector3()
const velocityDir = new Vector3()
const toCamera = new Vector3()
const localY = new Vector3(0, 1, 0)
const cameraQuat = new Quaternion()
const cameraWorld = new Vector3()
const groupQuat = new Quaternion()
const localCameraPosition = new Vector3()
const localCameraQuat = new Quaternion()

const RIBBON_SAMPLES = 96
const ribbonTip = new Vector3()

/** A blade trail: see BurgerShopEmitter.ribbon. Drawn in world space under the scene root. */
function RibbonLayer({
  emitter,
  frame,
  root,
  texture,
  simulation,
}: {
  emitter: BurgerShopEmitter
  frame: RefObject<Group | null>
  root: Object3D
  texture: Texture
  simulation: BurgerShopSimulation
}) {
  const ribbon = emitter.ribbon!
  const { geometry, material } = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(RIBBON_SAMPLES * 2 * 3), 3).setUsage(DynamicDrawUsage))
    g.setAttribute('color', new BufferAttribute(new Float32Array(RIBBON_SAMPLES * 2 * 4), 4).setUsage(DynamicDrawUsage))
    g.setAttribute('uv', new BufferAttribute(new Float32Array(RIBBON_SAMPLES * 2 * 2), 2).setUsage(DynamicDrawUsage))
    const index: number[] = []
    for (let i = 0; i + 1 < RIBBON_SAMPLES; i += 1) index.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2)
    g.setIndex(index)
    g.setDrawRange(0, 0)
    const m = new MeshBasicMaterial({
      map: texture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: emitter.blend === 'additive' ? AdditiveBlending : NormalBlending,
    })
    return { geometry: g, material: m }
  }, [emitter.blend, texture])
  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])
  const samples = useRef<{ base: Vector3; tip: Vector3; t: number; speed: number }[]>([])
  const motion = useRef<{ lastTip: Vector3 | null; stillSince: number; angle: number; lastT: number }>({ lastTip: null, stillSince: 0, angle: 0, lastT: 0 })

  useFrame(() => {
    const node = frame.current
    if (!node) return
    node.updateWorldMatrix(true, false)
    const t = simulation.time
    const local = t - (emitter.delay ?? 0)
    const list = samples.current
    const state = motion.current
    const unit = node.matrixWorld.getMaxScaleOnAxis()
    if (local >= 0 && (emitter.looping || local <= emitter.duration)) {
      const offset = emitter.localPosition ?? [0, 0, 0]
      // Where the tip really is. While it stands still (a preview with no clip),
      // swing the line through `sweep` in the first 30% of each emitter cycle.
      ribbonTip.set(offset[0], offset[1] + ribbon.to, offset[2])
      node.localToWorld(ribbonTip)
      const moved = state.lastTip ? state.lastTip.distanceTo(ribbonTip) / unit : Infinity
      const dt = Math.max(1e-4, t - state.lastT)
      if (moved / dt > 0.2) state.stillSince = t
      state.lastTip = (state.lastTip ?? new Vector3()).copy(ribbonTip)
      const still = ribbon.sweep && t - state.stillSince > 0.4
      let angle = 0
      if (still) {
        const phase = (local % emitter.duration) / emitter.duration
        angle = ((Math.min(1, phase / 0.3) * ribbon.sweep!) * Math.PI) / 180
        if (angle < state.angle) list.length = 0 // a new sweep: do not join it to the last one
      }
      state.angle = angle
      const c = Math.cos(angle)
      const sn = Math.sin(angle)
      const at = (y: number, out: Vector3) => node.localToWorld(out.set(offset[0] - sn * y, offset[1] + c * y, offset[2]))
      const tip = at(ribbon.to, new Vector3())
      const last = list[list.length - 1]
      const speed = last ? tip.distanceTo(last.tip) / unit / Math.max(1e-4, t - last.t) : 0
      list.push({ base: at(ribbon.from, new Vector3()), tip, t, speed })
      if (list.length > RIBBON_SAMPLES) list.shift()
      state.lastT = t
    }
    while (list.length > 0 && t - list[0]!.t > ribbon.life) list.shift()

    const position = geometry.getAttribute('position') as BufferAttribute
    const colour = geometry.getAttribute('color') as BufferAttribute
    const uv = geometry.getAttribute('uv') as BufferAttribute
    const tint = emitter.color[0] ?? [1, 1, 1, 1]
    const gate = (speed: number) => (ribbon.minSpeed ? Math.min(1, Math.max(0, (speed - ribbon.minSpeed * 0.5) / (ribbon.minSpeed * 0.5))) : 1)
    for (let i = 0; i < list.length; i += 1) {
      const sample = list[i]!
      const age = Math.min(1, (t - sample.t) / ribbon.life)
      const keys = emitter.colorOverLife
      const k = [0, 1, 2, 3].map((ch) => (keys ? sampleCurve(keys.map((key) => ({ t: key.t, v: key.c[ch] ?? 1 })), age) : 1))
      const alpha = (tint[3] ?? 1) * k[3]! * gate(sample.speed)
      for (const [j, p, v] of [
        [0, sample.base, 0],
        [1, sample.tip, 1],
      ] as const) {
        position.setXYZ(2 * i + j, p.x, p.y, p.z)
        colour.setXYZW(2 * i + j, tint[0]! * k[0]!, tint[1]! * k[1]!, tint[2]! * k[2]!, alpha)
        uv.setXY(2 * i + j, age, v)
      }
    }
    position.needsUpdate = true
    colour.needsUpdate = true
    uv.needsUpdate = true
    geometry.setDrawRange(0, Math.max(0, list.length - 1) * 6)
  })

  return createPortal(<mesh geometry={geometry} material={material} frustumCulled={false} />, root)
}

export function getBurgerShopRecipe(id: string): BurgerShopRecipe {
  const recipe = BURGER_SHOP_RECIPES.find((entry) => entry.id === id)
  if (!recipe) throw new Error(`Unknown Burger Shop effect: ${id}`)
  return recipe
}

export function BurgerShopEffect({
  recipe,
  textureUrls = BURGER_SHOP_TEXTURE_URLS,
}: {
  recipe: BurgerShopRecipe
  textureUrls?: Record<string, string>
}) {
  const { camera } = useThree()
  const group = useRef<Group>(null)
  // World-space layers draw under the scene root. Inside a portal (an effect
  // on a socket) useThree().scene is the portal's container, so walk up from
  // the effect's own group to the real root once it is mounted.
  const [worldRoot, setWorldRoot] = useState<Object3D | null>(null)
  useLayoutEffect(() => {
    let node: Object3D | null = group.current
    while (node?.parent) node = node.parent
    setWorldRoot(node)
  }, [])
  const simulation = useMemo(() => createBurgerShopSimulation(recipe), [recipe])
  const random = useMemo(() => createSeededRandom(1), [recipe])
  const layerMeta = useMemo(
    () =>
      recipe.emitters.map((emitter) => {
        const texture = loadTexture(emitter.texture, textureUrls)
        return {
          emitter,
          texture,
          material: createMaterial(
            texture,
            emitter.blend,
            emitter.lumaAlpha ??
              (emitter.texture === 'poof-01' ||
                emitter.texture === 'poof-02' ||
                emitter.texture === 'smoke' ||
                emitter.texture === 'ring' ||
                emitter.texture === 'mask-01'),
          ),
          capacity: Math.max(
            32,
            (emitter.burst?.max ?? 0) *
              Math.max(1, Math.ceil(emitter.life.max / Math.max(0.05, emitter.duration)) + 1) +
              Math.ceil(emitter.rate * Math.max(1, emitter.life.max) * 3) +
              24,
          ),
        }
      }),
    [recipe, textureUrls],
  )
  const meshes = useRef<(InstancedMesh | null)[]>([])
  const colors = useRef<InstancedBufferAttribute[]>([])
  const uvs = useRef<InstancedBufferAttribute[]>([])

  /** Tell the simulation where the effect is now (world-space emitters are born there). */
  const updateFrame = () => {
    const node = group.current
    if (!node) throw new Error(`${recipe.id}: effect group is not mounted`)
    node.updateWorldMatrix(true, false)
    simulation.frame = {
      matrix: node.matrixWorld.elements,
      unit: node.matrixWorld.getMaxScaleOnAxis(),
    }
  }

  useEffect(() => {
    simulation.particles = []
    simulation.time = 0
    updateFrame()
    if (recipe.looping) {
      for (let step = 0; step < 40; step += 1) stepBurgerShopSimulation(simulation, 0.05, random)
    } else {
      stepBurgerShopSimulation(simulation, 0.001, random)
    }
  }, [random, recipe, simulation])

  useFrame((_, delta) => {
    updateFrame()
    stepBurgerShopSimulation(simulation, Math.min(0.05, delta), random)
    // Billboards face the camera in the space they are drawn in: the effect's
    // own space (moved, turned and scaled with its socket) or world space.
    camera.getWorldPosition(cameraWorld)
    camera.getWorldQuaternion(cameraQuat)
    localCameraPosition.copy(cameraWorld)
    group.current!.worldToLocal(localCameraPosition)
    group.current!.getWorldQuaternion(groupQuat)
    localCameraQuat.copy(groupQuat).invert().multiply(cameraQuat)
    layerMeta.forEach((layer, layerIndex) => {
      cameraLocal.copy(layer.emitter.worldSpace ? cameraWorld : localCameraPosition)
      const faceQuat = layer.emitter.worldSpace ? cameraQuat : localCameraQuat
      const mesh = meshes.current[layerIndex]
      const colorAttr = colors.current[layerIndex]
      const uvAttr = uvs.current[layerIndex]
      if (!mesh || !colorAttr || !uvAttr) return
      const living = simulation.particles.filter((particle) => particle.emitter === layerIndex)
      living.forEach((particle, instance) => {
        const size = Math.max(0.02, liveSize(particle, layer.emitter))
        const isTrail = Boolean(layer.emitter.trailLife && layer.emitter.size.max === 0)
        const stretch = layer.emitter.stretch ?? 0
        const speed = Math.hypot(particle.vx, particle.vy, particle.vz)
        dummy.position.set(particle.x, particle.y, particle.z)
        dummy.rotation.set(0, 0, 0)
        if (isTrail || stretch > 0) {
          if (isTrail) dummy.scale.set(0.07, Math.max(0.35, speed * (layer.emitter.trailLife ?? 0.5) * 0.35), 1)
          else dummy.scale.set(size, size + speed * stretch, layer.emitter.geometry === 'cube' ? size : 1)
          if (speed > 0.001) {
            velocityDir.set(particle.vx / speed, particle.vy / speed, particle.vz / speed)
            dummy.quaternion.setFromUnitVectors(localY, velocityDir)
            toCamera.copy(cameraLocal).sub(dummy.position)
            toCamera.applyQuaternion(dummy.quaternion.clone().invert())
            dummy.rotateY(Math.atan2(toCamera.x, toCamera.z))
          }
        } else {
          dummy.scale.set(size, size, layer.emitter.geometry === 'cube' ? size : 1)
          if (layer.emitter.billboard === 'horizontal') {
            dummy.rotation.set(-Math.PI / 2, 0, 0)
          } else if (layer.emitter.billboard === 'vertical') {
            dummy.rotation.set(0, verticalBillboardYaw(cameraLocal.x, cameraLocal.z, particle.x, particle.z), 0)
          } else if (layer.emitter.billboard === 'mesh') {
            const euler = layer.emitter.localEuler ?? [0, 0, 0]
            dummy.rotation.set(
              (euler[0] * Math.PI) / 180,
              (euler[1] * Math.PI) / 180,
              (euler[2] * Math.PI) / 180 + particle.roll,
            )
          } else {
            dummy.quaternion.copy(faceQuat)
            dummy.rotateZ(particle.roll)
          }
        }
        dummy.updateMatrix()
        mesh.setMatrixAt(instance, dummy.matrix)
        const color = liveColor(particle, layer.emitter)
        colorAttr.setXYZW(instance, color[0], color[1], color[2], color[3])
        const frame = sheetFrame(particle, layer.emitter)
        const column = frame % layer.emitter.sheet.columns
        const row = Math.floor(frame / layer.emitter.sheet.columns)
        uvAttr.setXYZW(
          instance,
          column / layer.emitter.sheet.columns,
          1 - (row + 1) / layer.emitter.sheet.rows,
          1 / layer.emitter.sheet.columns,
          1 / layer.emitter.sheet.rows,
        )
      })
      mesh.count = Math.min(living.length, layer.capacity)
      mesh.instanceMatrix.needsUpdate = true
      colorAttr.needsUpdate = true
      uvAttr.needsUpdate = true
    })
  })

  const layerMesh = (layer: (typeof layerMeta)[number], index: number) => (
    <instancedMesh
      key={`${recipe.id}-${layer.emitter.name}`}
      ref={(node) => {
        meshes.current[index] = node
        if (node && !colors.current[index]) {
          const color = new InstancedBufferAttribute(new Float32Array(layer.capacity * 4), 4)
          const uv = new InstancedBufferAttribute(new Float32Array(layer.capacity * 4), 4)
          for (let slot = 0; slot < layer.capacity; slot += 1) uv.setXYZW(slot, 0, 0, 1, 1)
          color.setUsage(DynamicDrawUsage)
          uv.setUsage(DynamicDrawUsage)
          node.instanceMatrix.setUsage(DynamicDrawUsage)
          node.geometry.setAttribute('instanceColor', color)
          node.geometry.setAttribute('instanceUv', uv)
          colors.current[index] = color
          uvs.current[index] = uv
          node.frustumCulled = false
          node.count = 0
        }
      }}
      args={[undefined, undefined, layer.capacity]}
      frustumCulled={false}
    >
      {layer.emitter.geometry === 'cube' ? <boxGeometry args={[1, 1, 1]} /> : <planeGeometry args={[1, 1]} />}
      <primitive attach="material" object={layer.material} />
    </instancedMesh>
  )

  return (
    <>
      <group ref={group} scale={BURGER_SHOP_WORLD_SCALE}>
        {layerMeta.map((layer, index) => (layer.emitter.worldSpace || layer.emitter.ribbon ? null : layerMesh(layer, index)))}
      </group>
      {worldRoot &&
        layerMeta.some((layer) => layer.emitter.worldSpace) &&
        createPortal(
          <group>{layerMeta.map((layer, index) => (layer.emitter.worldSpace && !layer.emitter.ribbon ? layerMesh(layer, index) : null))}</group>,
          worldRoot,
        )}
      {worldRoot &&
        layerMeta.map((layer) =>
          layer.emitter.ribbon ? (
            <RibbonLayer key={`${recipe.id}-${layer.emitter.name}`} emitter={layer.emitter} frame={group} root={worldRoot} texture={layer.texture} simulation={simulation} />
          ) : null,
        )}
    </>
  )
}
