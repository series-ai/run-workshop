import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  DoubleSide,
  DynamicDrawUsage,
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
import { toLocalCameraPosition, verticalBillboardYaw } from './billboard'
import { BURGER_SHOP_RECIPES } from './recipes'
import {
  createBurgerShopSimulation,
  createSeededRandom,
  liveSize,
  sheetFrame,
  stepBurgerShopSimulation,
} from './simulate'
import { BURGER_SHOP_TEXTURE_URLS } from './textures'
import { BURGER_SHOP_WORLD_SCALE, type BurgerShopBlend, type BurgerShopRecipe } from './types'

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

const vertexShader = `
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
  }
`

const fragmentShader = `
  uniform sampler2D uMap;
  uniform float uCutoff;
  uniform float uAlphaClip;
  uniform float uLumaAlpha;
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
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

  useEffect(() => {
    simulation.particles = []
    simulation.time = 0
    if (recipe.looping) {
      for (let step = 0; step < 40; step += 1) stepBurgerShopSimulation(simulation, 0.05, random)
    } else {
      stepBurgerShopSimulation(simulation, 0.001, random)
    }
  }, [random, recipe, simulation])

  useFrame((_, delta) => {
    stepBurgerShopSimulation(simulation, Math.min(0.05, delta), random)
    const localCam = toLocalCameraPosition(
      camera.position.x,
      camera.position.y,
      camera.position.z,
      BURGER_SHOP_WORLD_SCALE,
    )
    cameraLocal.set(localCam[0], localCam[1], localCam[2])
    cameraQuat.copy(camera.quaternion)
    layerMeta.forEach((layer, layerIndex) => {
      const mesh = meshes.current[layerIndex]
      const colorAttr = colors.current[layerIndex]
      const uvAttr = uvs.current[layerIndex]
      if (!mesh || !colorAttr || !uvAttr) return
      const living = simulation.particles.filter((particle) => particle.emitter === layerIndex)
      living.forEach((particle, instance) => {
        const size = Math.max(0.02, liveSize(particle, layer.emitter))
        const isTrail = Boolean(layer.emitter.trailLife && layer.emitter.size.max === 0)
        const speed = Math.hypot(particle.vx, particle.vy, particle.vz)
        const trailLength = isTrail ? Math.max(0.35, speed * (layer.emitter.trailLife ?? 0.5) * 0.35) : size
        dummy.position.set(particle.x, particle.y, particle.z)
        dummy.rotation.set(0, 0, 0)
        if (isTrail) {
          dummy.scale.set(0.07, trailLength, 1)
          if (speed > 0.001) {
            velocityDir.set(particle.vx / speed, particle.vy / speed, particle.vz / speed)
            dummy.quaternion.setFromUnitVectors(localY, velocityDir)
            toCamera.copy(cameraLocal).sub(dummy.position)
            toCamera.applyQuaternion(dummy.quaternion.clone().invert())
            dummy.rotateY(Math.atan2(toCamera.x, toCamera.z))
          }
        } else {
          dummy.scale.set(size, size, 1)
          if (layer.emitter.billboard === 'horizontal') {
            dummy.rotation.set(-Math.PI / 2, 0, 0)
          } else if (layer.emitter.billboard === 'vertical') {
            dummy.rotation.set(
              0,
              verticalBillboardYaw(cameraLocal.x, cameraLocal.z, particle.x, particle.z),
              0,
            )
          } else if (layer.emitter.billboard === 'mesh') {
            const euler = layer.emitter.localEuler ?? [0, 0, 0]
            dummy.rotation.set(
              (euler[0] * Math.PI) / 180,
              (euler[1] * Math.PI) / 180,
              (euler[2] * Math.PI) / 180 + particle.roll,
            )
          } else {
            dummy.quaternion.copy(cameraQuat)
            dummy.rotateZ(particle.roll)
          }
        }
        dummy.updateMatrix()
        mesh.setMatrixAt(instance, dummy.matrix)
        const color = particle.color
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

  return (
    <group scale={BURGER_SHOP_WORLD_SCALE}>
      {layerMeta.map((layer, index) => (
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
          <planeGeometry args={[1, 1]} />
          <primitive attach="material" object={layer.material} />
        </instancedMesh>
      ))}
    </group>
  )
}
