import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { HalfFloatType, Mesh, Vector2, WebGLRenderTarget } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

class OpaqueContactShadows extends GTAOPass {
  override overrideVisibility() {
    super.overrideVisibility()
    this.scene.traverse((node) => {
      if (node instanceof Mesh && !Array.isArray(node.material) && node.material.transparent) {
        node.visible = false
      }
    })
  }
}

/** Add contact shadows and lamp glow to the eye-level views on supported renderers. */
export function LevelLightingEffects() {
  const supported = useThree((state) => state.size.width >= 640
    && state.gl.extensions.has('EXT_color_buffer_float'))
  return supported ? <LightingEffectsPass /> : null
}

function LightingEffectsPass() {
  const { gl, camera, scene, invalidate } = useThree()
  const { width, height } = useThree((state) => state.size)
  const dpr = useThree((state) => state.viewport.dpr)
  const pipeline = useRef<{
    composer: EffectComposer
    occlusion: GTAOPass
    bloom: UnrealBloomPass
  } | null>(null)

  useEffect(() => {
    const target = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      samples: Math.min(gl.capabilities.maxSamples, 4),
    })
    const composer = new EffectComposer(gl, target)
    const base = new RenderPass(scene, camera)
    const occlusion = new OpaqueContactShadows(scene, camera, 1, 1)
    const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.18, 0.26, 1.15)
    const output = new OutputPass()
    occlusion.blendIntensity = 0.58
    occlusion.updateGtaoMaterial({ radius: 0.72, thickness: 0.3, scale: 1.2, samples: 12 })
    occlusion.updatePdMaterial({ radius: 4, depthPhi: 0.8, normalPhi: 4, samples: 12 })
    composer.addPass(base)
    composer.addPass(occlusion)
    composer.addPass(bloom)
    composer.addPass(output)
    pipeline.current = { composer, occlusion, bloom }
    return () => {
      pipeline.current = null
      composer.dispose()
      base.dispose()
      output.dispose()
      bloom.dispose()
      bloom.materialHighPassFilter.dispose()
      occlusion.dispose()
      occlusion.gtaoMaterial.dispose()
      occlusion.blendMaterial.dispose()
    }
  }, [gl, scene, camera])

  useEffect(() => {
    const current = pipeline.current
    if (!current) return
    current.composer.setPixelRatio(dpr)
    current.composer.setSize(width, height)
    const effectWidth = Math.ceil(width * dpr / 2)
    const effectHeight = Math.ceil(height * dpr / 2)
    current.occlusion.setSize(effectWidth, effectHeight)
    current.bloom.setSize(effectWidth, effectHeight)
    invalidate()
  }, [camera, dpr, height, invalidate, width])

  useFrame((state, delta) => {
    const current = pipeline.current
    if (current) current.composer.render(delta)
    else state.gl.render(state.scene, state.camera)
  }, 1)

  return null
}
