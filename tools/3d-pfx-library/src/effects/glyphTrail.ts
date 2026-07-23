import * as THREE from 'three'
import { roundMetric } from '../constants/03'
import type { PfxGlyphTrailRuntimeState } from '../types/02'

export function createPfxGlyphTrailLifecycle(cycle: number): { progress: number; opacity: number; inscription: number; hold: number; erode: number; stage: 'write' | 'hold' | 'erode' } {
  const progress = THREE.MathUtils.clamp(cycle, 0, 1)
  if (progress < 0.12) { const inscription = roundMetric(progress / 0.12); return { progress, opacity: roundMetric(0.65 + inscription * 0.35), inscription, hold: 0, erode: 0, stage: 'write' } }
  if (progress <= 0.3) { const hold = roundMetric((progress - 0.12) / 0.18); return { progress, opacity: 1, inscription: 1, hold, erode: 0, stage: 'hold' } }
  const erode = roundMetric(THREE.MathUtils.clamp((progress - 0.3) / 0.38, 0, 1)); return { progress, opacity: roundMetric(Math.pow(1 - erode, 2)), inscription: 1, hold: 1, erode, stage: 'erode' }
}

export function createPfxGlyphTrailRuntimeState(elapsedSeconds: number, timing: number, lifetime: number, tempo: number, motionMultiplier: number, target?: PfxGlyphTrailRuntimeState): PfxGlyphTrailRuntimeState {
  const rate = Math.max(.05, timing) * Math.max(.1, tempo) * Math.max(.1, motionMultiplier); const periodSeconds = 1.35 * Math.max(.25, lifetime); const cycle = roundMetric(THREE.MathUtils.clamp((Math.max(0, elapsedSeconds) * rate) / periodSeconds, 0, 1)); const lifecycle = createPfxGlyphTrailLifecycle(cycle)
  const state = target ?? { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, inscription: 0, hold: 0, erode: 0, stage: 'write' }; Object.assign(state, lifecycle, { cycle, periodSeconds }); return state
}

export function createPfxGlyphTrailMaterial(opacity: number, colorA: THREE.ColorRepresentation='#61e7ff', colorB: THREE.ColorRepresentation='#a78bfa', density=.55, styleEdgeHardness=.22): THREE.ShaderMaterial {
  const primary = new THREE.Color(colorA)
  const secondary = new THREE.Color(colorB)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uColorA: { value: new THREE.Vector3(primary.r, primary.g, primary.b) },
      uColorB: { value: new THREE.Vector3(secondary.r, secondary.g, secondary.b) },
      uDensity: { value: THREE.MathUtils.clamp(density, .05, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
    },
    vertexColors: true,
    transparent: false,
    blending: THREE.NormalBlending,
    depthWrite: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 vRuneColor;
      varying vec3 vRuneNormal;
      attribute float pfxRuneOrder;
      varying float vRuneOrder;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vRuneColor = color;
        vRuneNormal = normalize(normalMatrix * normal);
        vRuneOrder = pfxRuneOrder;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying vec3 vRuneColor;
      varying vec3 vRuneNormal;
      varying float vRuneOrder;
      void main() {
        float hardStyle = step(.65, uStyleEdgeHardness);
        float staggeredHandwriting = smoothstep(.008 + vRuneOrder * .018, .048 + vRuneOrder * .018, uCycle);
        float synchronizedInscription = smoothstep(.015, .075, uCycle);
        float handwrittenReveal = mix(staggeredHandwriting, synchronizedInscription, hardStyle);
        float featheredInkCooling = 1.0 - smoothstep(.28 + (4.0 - vRuneOrder) * .055, .41 + (4.0 - vRuneOrder) * .055, uCycle);
        float hardScriptDissolve = 1.0 - smoothstep(.3 + (4.0 - vRuneOrder) * .045, .39 + (4.0 - vRuneOrder) * .045, uCycle);
        float oldestRuneErode = mix(featheredInkCooling, hardScriptDissolve, hardStyle);
        float densityReveal = smoothstep(.05, .38, uDensity);
        float densityMask = 1.0 - step(mix(1.5, 4.5, densityReveal), vRuneOrder);
        float earlyVisibility = uOpacity * handwrittenReveal * oldestRuneErode * densityMask;
        if (earlyVisibility < .08) discard;
        vec3 normal = normalize(vRuneNormal);
        vec3 keyLight = vec3(0.361, 0.822, 0.441);
        float facet = 0.82 + max(dot(normal, keyLight), 0.0) * 0.28;
        float rimLight = 1.0 - abs(normal.z);
        float runeGlow = 0.42 + rimLight * rimLight * .88;
        float softInkFacets = mix(.82, 1.04, facet);
        float edgeLitRuneFacets = max(.68 + facet * .28, rimLight * 1.18);
        float materialResponse = mix(softInkFacets, edgeLitRuneFacets, hardStyle);
        float palettePosition = clamp(vRuneOrder / 4.0, 0.0, 1.0);
        float inkAge = clamp((palettePosition - .08) / .7, 0.0, 1.0) * .9 + rimLight * .06;
        vec3 controlledInk = mix(uColorA, uColorB, inkAge);
        vec3 authoredFacet = mix(vec3(1.0), vRuneColor, .16);
        vec3 arcane = controlledInk * authoredFacet * materialResponse * (1.06 + runeGlow * .22);
        arcane += mix(uColorA, uColorB, .38) * rimLight * mix(.18, .5, hardStyle);
        gl_FragColor = vec4(arcane, 1.0);
      }
    `,
  })
  material.userData['pfxGlyphTrailMaterial'] = true
  material.userData['pfxGlyphTrailDrawCalls'] = 1
  material.userData['pfxGlyphTrailParticleCount'] = 0
  material.userData['pfxGlyphTrailFragmentTextureSamples'] = 0
  material.userData['pfxGlyphTrailFragmentNormalizeOps'] = 1
  material.userData['pfxGlyphTrailTransientAllocationsPerFrame'] = 0
  material.userData['pfxGlyphTrailMeshJustification'] = 'integrated-arcane-nib-with-sequential-closed-prism-handwriting-wake'
  return material
}
