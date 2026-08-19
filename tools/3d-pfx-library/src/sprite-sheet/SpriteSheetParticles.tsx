import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  NormalBlending,
  Object3D,
  Quaternion,
  ShaderMaterial,
  Texture,
  TextureLoader,
} from 'three'
import {
  createSeededRandom,
  createSpriteSheetSimulation,
  liveFrame,
  stepSpriteSheetSimulation,
} from './simulate'
import { configureSpriteSheetTexture } from './textureFilter'
import type { SpriteSheet, SpriteSheetBlend, SpriteSheetEmitter } from './types'

const textureCache = new Map<string, Texture>()
const loader = new TextureLoader()

function loadTexture(url: string, pixelated: boolean): Texture {
  const key = pixelated ? `${url}#nearest` : url
  const cached = textureCache.get(key)
  if (cached) return cached
  const texture = configureSpriteSheetTexture(loader.load(url), pixelated)
  textureCache.set(key, texture)
  return texture
}

const vertexShader = `
  attribute vec4 instanceColor;
  attribute vec4 instanceUv;
  attribute float instanceRotated;
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    vec2 scale = instanceUv.zw;
    if (scale.x < 0.0001 || scale.y < 0.0001) scale = vec2(1.0);
    vec2 local = instanceRotated > 0.5 ? vec2(uv.y, 1.0 - uv.x) : uv;
    vUv = instanceUv.xy + local * scale;
    vColor = instanceColor;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform sampler2D uMap;
  uniform float uCutoff;
  uniform float uAlphaClip;
  uniform float uLumaAlpha;
  uniform float uKeyBackground;
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    vec4 texel = texture2D(uMap, vUv);
    float luma = max(texel.r, max(texel.g, texel.b));
    float chroma = luma - min(texel.r, min(texel.g, texel.b));
    float coverage = texel.a;
    if (uLumaAlpha > 0.5) coverage *= luma;
    if (uKeyBackground > 0.5) coverage *= max(chroma * 2.2, luma - 0.42);
    vec4 color = vec4(texel.rgb * vColor.rgb, coverage * vColor.a);
    if (uAlphaClip > 0.5 && color.a < uCutoff) discard;
    if (color.a < 0.1) discard;
    gl_FragColor = color;
  }
`

function createMaterial(
  texture: Texture,
  blend: SpriteSheetBlend,
  lumaAlpha: boolean,
  keyBackground: boolean,
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uCutoff: { value: blend === 'cutout' ? 0.08 : 0.001 },
      uAlphaClip: { value: blend === 'additive' ? 0 : 1 },
      uLumaAlpha: { value: lumaAlpha ? 1 : 0 },
      uKeyBackground: { value: keyBackground ? 1 : 0 },
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
const cameraQuat = new Quaternion()

export function SpriteSheetParticles({
  textureUrl,
  sheet,
  emitters,
  keyBackground = true,
  pixelated = false,
}: {
  textureUrl: string
  sheet: SpriteSheet
  emitters: SpriteSheetEmitter[]
  keyBackground?: boolean
  /** Nearest-neighbor sampling. Use for pixel-art sheets. */
  pixelated?: boolean
}) {
  const { camera } = useThree()
  const random = useMemo(() => createSeededRandom(7), [sheet, emitters])
  const simulation = useMemo(
    () => createSpriteSheetSimulation(sheet, emitters, random),
    [emitters, random, sheet],
  )
  const texture = useMemo(() => loadTexture(textureUrl, pixelated), [pixelated, textureUrl])
  const layers = useMemo(
    () =>
      emitters.map((emitter) => ({
        emitter,
        material: createMaterial(texture, emitter.blend, emitter.lumaAlpha, keyBackground),
        capacity: Math.max(1, emitter.count),
      })),
    [emitters, keyBackground, texture],
  )
  const meshes = useRef<(InstancedMesh | null)[]>([])
  const colors = useRef<InstancedBufferAttribute[]>([])
  const uvs = useRef<InstancedBufferAttribute[]>([])
  const rotated = useRef<InstancedBufferAttribute[]>([])

  useEffect(
    () => () => {
      for (const layer of layers) layer.material.dispose()
    },
    [layers],
  )

  useFrame((_, delta) => {
    stepSpriteSheetSimulation(simulation, Math.min(0.05, delta), random)
    cameraQuat.copy(camera.quaternion)
    layers.forEach((layer, layerIndex) => {
      const mesh = meshes.current[layerIndex]
      const colorAttr = colors.current[layerIndex]
      const uvAttr = uvs.current[layerIndex]
      const rotatedAttr = rotated.current[layerIndex]
      if (!mesh || !colorAttr || !uvAttr || !rotatedAttr) return
      const living = simulation.particles.filter((particle) => particle.emitter === layerIndex)
      living.forEach((particle, instance) => {
        const clip = sheet.clips[particle.clip]
        if (!clip) return
        const frame = clip.frames[liveFrame(particle, clip, layer.emitter)]
        if (!frame) return
        const lifeT = Math.min(1, particle.age / Math.max(0.0001, particle.life))
        const fade = layer.emitter.fadeOverLife
          ? lifeT < 0.15
            ? lifeT / 0.15
            : lifeT > 0.7
              ? Math.max(0, (1 - lifeT) / 0.3)
              : 1
          : layer.emitter.loop
            ? 1
            : Math.max(0, 1 - Math.max(0, lifeT - 0.7) / 0.3)
        const opacity = layer.emitter.opacity ?? 1
        const aspect = layer.emitter.verticalStreak
          ? Math.max(6, frame.width / Math.max(frame.height, 1))
          : frame.height / Math.max(1, frame.width)
        const grounded = layer.emitter.anchor === 'ground' || (layer.emitter.grounded !== false && !layer.emitter.anchor)
        dummy.position.set(particle.x, particle.y + (grounded ? (particle.size * aspect) / 2 : 0), particle.z)
        if (layer.emitter.billboard === 'horizontal') {
          dummy.rotation.set(-Math.PI / 2, 0, particle.roll)
        } else {
          dummy.quaternion.copy(cameraQuat)
          dummy.rotateZ(layer.emitter.verticalStreak ? 0 : particle.roll)
        }
        dummy.scale.set(particle.size, particle.size * aspect, 1)
        dummy.updateMatrix()
        mesh.setMatrixAt(instance, dummy.matrix)
        const tint = layer.emitter.color ?? [1, 1, 1]
        colorAttr.setXYZW(instance, tint[0], tint[1], tint[2], fade * opacity)
        uvAttr.setXYZW(instance, frame.u, frame.v, frame.du, frame.dv)
        rotatedAttr.setX(instance, frame.rotated ? 1 : 0)
      })
      mesh.count = living.length
      mesh.instanceMatrix.needsUpdate = true
      colorAttr.needsUpdate = true
      uvAttr.needsUpdate = true
      rotatedAttr.needsUpdate = true
    })
  })

  return (
    <group>
      {layers.map((layer, index) => (
        <instancedMesh
          key={`${sheet.textureFileName}-${index}`}
          ref={(node) => {
            meshes.current[index] = node
            if (node && !colors.current[index]) {
              const color = new InstancedBufferAttribute(new Float32Array(layer.capacity * 4), 4)
              const uv = new InstancedBufferAttribute(new Float32Array(layer.capacity * 4), 4)
              const rotate = new InstancedBufferAttribute(new Float32Array(layer.capacity), 1)
              color.setUsage(DynamicDrawUsage)
              uv.setUsage(DynamicDrawUsage)
              rotate.setUsage(DynamicDrawUsage)
              node.instanceMatrix.setUsage(DynamicDrawUsage)
              node.geometry.setAttribute('instanceColor', color)
              node.geometry.setAttribute('instanceUv', uv)
              node.geometry.setAttribute('instanceRotated', rotate)
              colors.current[index] = color
              uvs.current[index] = uv
              rotated.current[index] = rotate
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
