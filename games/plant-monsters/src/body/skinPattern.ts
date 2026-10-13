import * as THREE from 'three'

/**
 * Two-colour pattern layer for the monster's skin (arms and legs), like the leaf variegation: the skin colour plus ONE
 * pattern colour with crisp (anti-aliased) edges. The limbs have no UVs, so the pattern is drawn in the shader from each
 * vertex's rest-pose position: it sticks to the skin while the limbs bend, and stretches with them when they're
 * lengthened. Patterns lean on the plants so monster and plant feel like one creature.
 */

export const SKIN_PATTERNS = {
  none: 'plain skin',
  vitiligo: 'pale patches (Monstera Albo)',
  marble: 'streaky marbling (Marble Queen pothos)',
  splash: 'patches + daubs (N’Joy pothos)',
  spots: 'round daubs (Thai Constellation, whale fin)',
  speckle: 'fine freckles (peace lily Domino)',
  brindle: 'broken stripes round the limb',
  wavy: 'wavy bands (snake plant)',
  pinstripe: 'fine stripes down the limb (calathea)',
} as const

export type SkinPattern = keyof typeof SKIN_PATTERNS
const IDS: Record<SkinPattern, number> = { none: 0, vitiligo: 1, marble: 2, splash: 3, spots: 4, speckle: 5, brindle: 6, wavy: 7, pinstripe: 8 }

const NOISE = /* glsl */ `
  float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  vec3 h33(vec3 p) { return vec3(h31(p), h31(p + 17.3), h31(p + 41.7)); }
  float vnoise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }
  // distance to the nearest jittered cell point, minus that point's own radius (< 0 inside a dot of varying size)
  float dots(vec3 p, float keep) {
    vec3 i = floor(p); vec3 f = fract(p); float d = 9.0;
    for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec3 g = vec3(x, y, z); vec3 c = i + g; vec3 o = h33(c);
      if (h31(c + 7.1) > keep) continue;
      float r = 0.18 + 0.3 * h31(c + 3.3);
      d = min(d, length(g + o - f) - r);
    }
    return d;
  }
  // signed pattern field: > 0 = pattern colour
  // p: rest position shifted by the seed (noise), r: unshifted rest position (angle round the limb's own axis)
  float skinField(vec3 p, vec3 r) {
    float ang = atan(r.z, r.x);
    #if SKIN_PATTERN == 1
      return fbm(p * 5.5) - (0.6 - 0.25 * uAmount);
    #elif SKIN_PATTERN == 2
      return fbm(p * vec3(11.0, 3.5, 11.0) + fbm(p * 4.0) * 1.5) - (0.62 - 0.2 * uAmount);
    #elif SKIN_PATTERN == 3
      return max(fbm(p * 4.5) - (0.66 - 0.2 * uAmount), -dots(p * 13.0, 0.25 + 0.3 * uAmount));
    #elif SKIN_PATTERN == 4
      return -dots(p * 12.0, 0.45 + 0.45 * uAmount);
    #elif SKIN_PATTERN == 5
      return -dots(p * 26.0, 0.35 + 0.4 * uAmount) - 0.06;
    #elif SKIN_PATTERN == 6
      return sin(p.y * 46.0 + fbm(p * 7.0) * 7.0) * 0.5 + fbm(p * 14.0) * 0.6 - (0.75 - 0.4 * uAmount);
    #elif SKIN_PATTERN == 7
      return sin((p.y + 0.02 * sin(ang * 5.0 + p.y * 18.0)) * 48.0) - (0.55 - 0.9 * uAmount);
    #elif SKIN_PATTERN == 8
      return sin(ang * 9.0 + fbm(p * 3.0) * 1.5) - (0.82 - 0.5 * uAmount);
    #else
      return -1.0;
    #endif
  }
`

export interface SkinOptions {
  skin: string
  pattern?: SkinPattern
  patternColor?: string
  /** 0..1: how much of the skin the pattern covers. */
  amount?: number
  /** Shifts the pattern so left/right limbs and different monsters don't match. */
  seed?: number
}

const cache = new Map<string, THREE.MeshStandardMaterial>()

export function skinMaterial(o: SkinOptions): THREE.MeshStandardMaterial {
  const pattern = o.pattern ?? 'none'
  const key = `${o.skin}|${pattern}|${o.patternColor}|${o.amount}|${o.seed}`
  const hit = cache.get(key)
  if (hit) return hit
  const m = new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.7, vertexColors: true })
  if (pattern !== 'none') {
    const uniforms = {
      uPatternColor: { value: new THREE.Color(o.patternColor ?? '#f1ead4') },
      uAmount: { value: o.amount ?? 0.5 },
      uSeed: { value: new THREE.Vector3((o.seed ?? 0) * 3.17, (o.seed ?? 0) * 1.31, (o.seed ?? 0) * 2.53) },
    }
    m.defines = { SKIN_PATTERN: IDS[pattern] }
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;') // rest pose: before skinning
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vRest;\nuniform vec3 uPatternColor;\nuniform float uAmount;\nuniform vec3 uSeed;\n${NOISE}`)
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          {
            float f = skinField(vRest + uSeed, vRest);
            float w = fwidth(f) * 0.75 + 1e-4;
            float k = smoothstep(-w, w, f); // crisp, anti-aliased two-colour edge
            vec3 shadeK = vec3(1.0);
            #ifdef USE_COLOR
              shadeK = vColor.rgb; // keep the soft gradient on the pattern colour too
            #endif
            diffuseColor.rgb = mix(diffuseColor.rgb, uPatternColor * shadeK, k);
          }`,
        )
    }
    m.customProgramCacheKey = () => `skin-${pattern}`
  }
  cache.set(key, m)
  return m
}
