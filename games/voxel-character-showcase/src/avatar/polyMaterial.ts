import {
  CanvasTexture, Color, DataTexture, DoubleSide, FrontSide, LinearMipmapLinearFilter, MeshBasicMaterial,
  MeshStandardMaterial, NearestFilter, PlaneGeometry, RepeatWrapping, ShaderChunk, SRGBColorSpace, Vector2,
} from 'three'
import { PALETTE_REGIONS, resolvePaletteColors, type PaletteColors } from '@voxchar/contracts/palette'
import { LEVEL_FINISHES } from '@voxchar/contracts/levelFinishes'
import type { WaterReflection } from '../scenes/useLevelWater'

/**
 * 10-region UV palette + orthogonal voxel micro-mottle shader:
 *   TEXCOORD_0 (uv):
 *     u selects one of ten palette colors (skin, hair, primary, secondary, accent, metal, trim, leather, visor, detail).
 *     v in [0.15, 0.85] supplies baked crevice + directional overhang AO; v >= 0.92 marks emissive accent voxels.
 *   TEXCOORD_1 (uv1):
 *     integer voxel-grid coordinates (or -999, -999 when mottle=False) so greedy-merged quads still
 *     render crisp per-voxel tonal variation across 1x1 voxel cells with zero extra triangles.
 */

const PROGRAM_KEY = 'run-voxchar-atlas-v4'

/**
 * Look constants. `docs/art-direction.md` section 7 gives the reason for each group.
 *  - Tone ramp: `rampDark` (0.44) and `toneFloor` (0.38) give crisp downward/overhang facet contrast.
 *  - Dark floor: a palette color below `darkFloorLuma` gets `darkFloor` added and `darkMottleGain` on its
 *    mottle, thus a charcoal tee keeps visible 1x1 voxel facets.
 *  - Skin: `skinMottle` scales the tone mottle of skin and `skinHueJitter` gives each skin voxel a small
 *    warm / cool hue offset. Together they make the warm voxel mosaic.
 *  - Skin ramp: shades below the base tone go to `skinBlushTint` (rosy cheek, lip), then to
 *    `skinShadowTint` (warm brown socket and crevice).
 */
const LOOK = {
  rampDark: 0.44,
  rampBright: 1.20,
  toneFloor: 0.38,
  darkFloor: 'vec3(0.030, 0.031, 0.037)',
  darkFloorLuma: 0.1,
  darkMottleGain: 2.0,
  skinMottle: 0.8,
  skinHueJitter: 0.05,
  skinBlushTint: 'vec3(1.15, 0.77, 0.85)',
  skinShadowTint: 'vec3(1.10, 0.84, 0.76)',
  rimStrength: 0.44,
  rimPower: 2.6,
  rimTint: 'vec3(0.036, 0.050, 0.072)',
  metalBoost: 1.18,
  metalRoughness: 0.26,
  metalness: 0.48,
  metalSky: 0.52,
  glossSky: 0.35,
  woodRoughness: 0.46,
  glassRoughness: 0.16,
  shadowTint: 'vec3(0.88, 0.93, 1.05)',
  mottleAmplitude: 0.12,
  emissiveGain: 1.65,
} as const

const LEVEL_DARK_FLOOR = [0.017, 0.019, 0.022] as const

const LEVEL_LOOK = {
  ...LOOK,
  rampDark: 0.49,
  rampBright: 1.16,
  darkFloor: `vec3(${LEVEL_DARK_FLOOR.join(', ')})`,
  darkMottleGain: 1.24,
  rimStrength: 0.14,
  metalBoost: 1.1,
  metalSky: 0.24,
  glossSky: 0.25,
  shadowTint: 'vec3(0.96, 0.98, 1.03)',
  emissiveGain: LEVEL_FINISHES.emissiveStrength,
} as const

const glsl = (value: number) => value.toFixed(3)

interface PolyUniforms {
  uPolyPalette: { value: Color[] }
  uLiftedPalette?: { value: Color[] }
}

function liftLevelColor(color: Color, target = new Color()): Color {
  const luma = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b
  const t = Math.max(0, Math.min(1, luma / LEVEL_LOOK.darkFloorLuma))
  const lift = 1 - t * t * (3 - 2 * t)
  return target.setRGB(
    color.r + LEVEL_DARK_FLOOR[0] * lift,
    color.g + LEVEL_DARK_FLOOR[1] * lift,
    color.b + LEVEL_DARK_FLOOR[2] * lift,
  )
}

function uniformsOf(material: MeshStandardMaterial): PolyUniforms {
  const uniforms = material.userData.polyUniforms as PolyUniforms | undefined
  if (!uniforms) throw new Error('This material is not a poly palette material. Make it with createPolyMaterial().')
  return uniforms
}

/** Replace one shader chunk. A missing chunk is an error: a silent miss gives a wrong look. */
function inject(source: string, chunk: string, replacement: string): string {
  if (!source.includes(chunk)) throw new Error(`The three.js shader has no "${chunk}" chunk for the voxchar palette shader.`)
  return source.replace(chunk, replacement)
}

type PolySurface = 'avatar' | 'level' | 'glass' | { water: { zenith: string; horizon: string; reflection?: WaterReflection } }

function createGrainTexture() {
  const pixels = Uint8Array.from(LEVEL_FINISHES.grain.flat().flatMap((tone) => [tone, tone, tone, 255]))
  const size = LEVEL_FINISHES.grain.length
  const texture = new DataTexture(pixels, size, size)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.magFilter = NearestFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

let levelGrain: DataTexture | undefined

export function createPolyMaterial(palette: PaletteColors, surface: PolySurface = 'avatar', optimizeLevel = false): MeshStandardMaterial {
  const isLevel = surface !== 'avatar'
  const optimized = isLevel && optimizeLevel
  const glass = surface === 'glass'
  const look = isLevel ? LEVEL_LOOK : LOOK
  const grain = isLevel ? (levelGrain ??= createGrainTexture()) : undefined
  const waterSky = typeof surface === 'object' ? {
    zenith: { value: new Color(surface.water.zenith) },
    horizon: { value: new Color(surface.water.horizon) },
  } : undefined
  const reflection = typeof surface === 'object' ? surface.water.reflection : undefined
  const regionFinishes = isLevel ? {
    value: PALETTE_REGIONS.map((region) => new Vector2(
      ...(glass ? LEVEL_FINISHES.glass : waterSky ? LEVEL_FINISHES.water : LEVEL_FINISHES.regions[region]),
    )),
  } : undefined
  const resolved = resolvePaletteColors(palette)
  const uniforms: PolyUniforms = {
    uPolyPalette: { value: PALETTE_REGIONS.map((region) => new Color(resolved[region])) },
  }
  const liftedPalette = optimized
    ? { value: uniforms.uPolyPalette.value.map(color => liftLevelColor(color)) }
    : undefined
  uniforms.uLiftedPalette = liftedPalette
  const material = new MeshStandardMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.8, side: glass ? DoubleSide : FrontSide,
    opacity: glass ? LEVEL_FINISHES.glassOpacity : 1,
    transparent: glass,
    depthWrite: !glass,
  })
  material.name = 'VoxChar_Atlas_Mat'
  material.userData.polyUniforms = uniforms
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPolyPalette = uniforms.uPolyPalette
    if (liftedPalette) shader.uniforms.uLiftedPalette = liftedPalette
    if (grain) shader.uniforms.uLevelGrain = { value: grain }
    if (regionFinishes) shader.uniforms.uLevelFinishes = regionFinishes
    if (waterSky) {
      shader.uniforms.uWaterZenith = waterSky.zenith
      shader.uniforms.uWaterHorizon = waterSky.horizon
    }
    if (reflection) {
      shader.uniforms.uWaterReflection = reflection.texture
      shader.uniforms.uWaterProjection = reflection.projection
      shader.uniforms.uWaterReflectEnabled = reflection.enabled
    }
    let vertex = inject(
      shader.vertexShader,
      '#include <common>',
      '#include <common>\nattribute vec2 uv1;\nvarying vec2 vPolyUv;\nvarying vec2 vVoxelGrid;',
    )
    vertex = inject(vertex, '#include <begin_vertex>', '#include <begin_vertex>\nvPolyUv = uv;\nvVoxelGrid = uv1;')
    if (reflection) {
      vertex = inject(vertex, '#include <common>', `#include <common>
        uniform mat4 uWaterProjection;
        varying vec4 vWaterProjection;`)
      vertex = inject(vertex, '#include <begin_vertex>', `#include <begin_vertex>
        vec4 waterPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          waterPosition = instanceMatrix * waterPosition;
        #endif
        vWaterProjection = uWaterProjection * modelMatrix * waterPosition;`)
    }
    shader.vertexShader = vertex

    let fragment = inject(
      shader.fragmentShader,
      '#include <common>',
      `#include <common>
        uniform vec3 uPolyPalette[10];
        ${liftedPalette ? 'uniform vec3 uLiftedPalette[10];' : ''}
        varying vec2 vPolyUv;
        varying vec2 vVoxelGrid;
        ${grain ? 'uniform sampler2D uLevelGrain;' : ''}
        ${regionFinishes ? 'uniform vec2 uLevelFinishes[10];' : ''}
        ${reflection ? 'uniform sampler2D uWaterReflection;\nuniform float uWaterReflectEnabled;\nvarying vec4 vWaterProjection;' : ''}
        ${waterSky ? 'uniform vec3 uWaterZenith;\nuniform vec3 uWaterHorizon;' : ''}`,
    )
    fragment = inject(
      fragment,
      '#include <color_fragment>',
      `#include <color_fragment>
        int polyRegion = int(clamp(floor(vPolyUv.x * 10.0), 0.0, 9.0));
        float polyEmissive = step(0.92, vPolyUv.y);
        float polyRamp = clamp((vPolyUv.y - 0.15) / 0.7, 0.0, 1.0);
        float polyMetal = polyRegion == 5 ? 1.0 : 0.0;
        float polySkin = ${surface === 'avatar' ? '(polyRegion == 0 ? 1.0 : 0.0)' : '0.0'};
        float polyLeather = polyRegion == 7 ? 1.0 : 0.0;
        float polyGloss = ${waterSky ? '0.0' : '(polyRegion == 8 ? 1.0 : 0.0)'};
        ${liftedPalette ? 'vec3 polyBase = uLiftedPalette[polyRegion];' : `vec3 polyBase = uPolyPalette[polyRegion];
        float polyLuma = dot(polyBase, vec3(0.2126, 0.7152, 0.0722));
        float polyDark = 1.0 - smoothstep(0.0, ${glsl(look.darkFloorLuma)}, polyLuma);
        polyBase += ${look.darkFloor} * polyDark;`}
        float voxMottle = 0.0;
        vec3 voxHueShift = vec3(1.0);
        if (vVoxelGrid.x > -100.0 && polyEmissive < 0.5) {
          ${grain ? `float voxelGrain = texture2D(uLevelGrain, vVoxelGrid / ${glsl(LEVEL_FINISHES.grain.length)}).r;
          voxHueShift *= 1.07 * voxelGrain;` : `
          vec2 voxCell = floor(vVoxelGrid + 0.001);
          float voxHash = fract(sin(dot(voxCell, vec2(127.1, 311.7))) * 43758.5453123);
          float voxHash2 = fract(sin(dot(voxCell, vec2(269.5, 183.3))) * 19283.7131);
          float voxGain = mix(1.0, ${glsl(look.skinMottle)}, polySkin) * mix(1.0, ${glsl(look.darkMottleGain)}, polyDark);
          voxMottle = (voxHash - 0.5) * ${glsl(look.mottleAmplitude)} * voxGain;
          vec3 clothHue = 1.0 + vec3(voxHash2 - 0.5, 0.5 - voxHash, (voxHash - voxHash2) * 0.5) * 0.032;
          vec3 skinHue = 1.0 + vec3(0.6, -0.5, -1.0) * (voxHash2 - 0.5) * ${glsl(look.skinHueJitter)};
          voxHueShift = mix(clothHue, skinHue, polySkin);`}
        }
        float voxCurve = pow(polyRamp, 0.85);
        float voxTone = clamp(mix(${glsl(look.rampDark)}, ${glsl(look.rampBright)}, voxCurve) + voxMottle, ${glsl(look.toneFloor)}, 1.36);
        vec3 skinDeepTint = mix(${look.skinShadowTint}, ${look.skinBlushTint}, smoothstep(0.10, 0.30, polyRamp));
        vec3 skinShadeTint = mix(skinDeepTint, vec3(1.0), smoothstep(0.30, 0.52, polyRamp));
        vec3 coolShadowTint = mix(${look.shadowTint}, vec3(1.0), smoothstep(0.0, 0.60, polyRamp));
        vec3 shadeTint = mix(coolShadowTint, skinShadeTint, polySkin);
        diffuseColor.rgb = polyBase * voxHueShift * shadeTint * voxTone * mix(1.0, ${glsl(look.metalBoost)}, polyMetal);`,
    )
    fragment = inject(
      fragment,
      '#include <metalnessmap_fragment>',
      `#include <metalnessmap_fragment>
        ${regionFinishes ? `vec2 finish = uLevelFinishes[polyRegion];
        roughnessFactor = finish.x;
        metalnessFactor = finish.y;` : `float regionRough = mix(0.82, 0.86, polySkin);
        regionRough = mix(regionRough, 0.78, polyRegion == 1 ? 1.0 : 0.0);
        regionRough = mix(regionRough, ${glsl(look.woodRoughness)}, polyLeather);
        regionRough = mix(regionRough, ${glsl(look.metalRoughness)}, polyMetal);
        regionRough = mix(regionRough, ${glsl(look.glassRoughness)}, polyGloss);
        roughnessFactor = regionRough;
        metalnessFactor = mix(0.0, 0.06, polyLeather);
        metalnessFactor = mix(metalnessFactor, 0.12, polyGloss);
        metalnessFactor = mix(metalnessFactor, ${glsl(look.metalness)}, polyMetal);`}`,
    )
    fragment = inject(
      fragment,
      '#include <opaque_fragment>',
      `vec3 polyView = normalize(vViewPosition);
        vec3 polyNormal = normalize(normal);
        float polyRim = pow(1.0 - clamp(dot(polyNormal, polyView), 0.0, 1.0), ${glsl(look.rimPower)});
        outgoingLight += (diffuseColor.rgb * 0.65 + ${look.rimTint}) * polyRim * ${glsl(look.rimStrength)};
        float polySky = smoothstep(-0.25, 0.9, reflect(-polyView, polyNormal).y);
        outgoingLight += diffuseColor.rgb * (polyMetal * ${glsl(look.metalSky)} + polyGloss * ${glsl(look.glossSky)}) * polySky;
        outgoingLight += uPolyPalette[4] * polyEmissive * ${glsl(look.emissiveGain)};
        ${waterSky ? `vec3 waterNormal = inverseTransformDirection(polyNormal, viewMatrix);
        vec3 waterRay = inverseTransformDirection(reflect(-polyView, polyNormal), viewMatrix);
        vec3 waterReflection = mix(uWaterHorizon, uWaterZenith, smoothstep(0.0, 0.8, waterRay.y));
        ${reflection ? `vec2 reflectedUv = vWaterProjection.xy / max(vWaterProjection.w, 0.001);
        vec2 ripple = vec2(sin(reflectedUv.y * 210.0), cos(reflectedUv.x * 127.0)) * 0.0025;
        vec3 reflected = texture2D(uWaterReflection, reflectedUv + ripple).rgb;
        waterReflection = mix(waterReflection, reflected, uWaterReflectEnabled * 0.9);` : ''}
        float waterFresnel = pow(1.0 - clamp(dot(polyNormal, polyView), 0.0, 1.0), 3.4);
        outgoingLight = mix(outgoingLight, waterReflection * (0.28 + 0.4 * polyRamp),
          max(waterNormal.y, 0.0) * (0.07 + 0.44 * waterFresnel));` : ''}
        #include <opaque_fragment>`,
    )
    if (optimized) {
      const lights = inject(ShaderChunk.lights_fragment_begin, 'pointLight = pointLights[ i ];', `{
        pointLight = pointLights[ i ];
        vec3 lightOffset = pointLight.position - geometryPosition;
        if (pointLight.distance <= 0.0 || dot(lightOffset, lightOffset) < pointLight.distance * pointLight.distance) {
      `)
      const pointEnd = 'material, reflectedLight );'
      fragment = inject(fragment, '#include <lights_fragment_begin>', inject(lights, pointEnd, pointEnd + '\n        }\n        }'))
    }
    shader.fragmentShader = fragment
  }
  const key = waterSky ? `${PROGRAM_KEY}-water${reflection ? '-reflect' : ''}`
    : isLevel ? `${PROGRAM_KEY}-${surface}` : PROGRAM_KEY
  material.customProgramCacheKey = () => optimized ? `${key}-optimized` : key
  return material
}

/** Change the palette colors in place. No shader compile occurs. */
export function updatePolyMaterialPalette(material: MeshStandardMaterial, palette: PaletteColors): void {
  const resolved = resolvePaletteColors(palette)
  const { uPolyPalette, uLiftedPalette } = uniformsOf(material)
  PALETTE_REGIONS.forEach((region, index) => {
    const color = uPolyPalette.value[index]!.set(resolved[region])
    const lifted = uLiftedPalette?.value[index]
    if (lifted) liftLevelColor(color, lifted)
  })
}

export interface BlobShadowResources {
  /** Unit square on the XZ plane. Scale it to the footprint of the object. */
  geometry: PlaneGeometry
  material: MeshBasicMaterial
}

let blobShadow: BlobShadowResources | undefined

/** One radial-gradient texture and one quad for all blob shadows (performance rule P2). */
export function getSharedBlobShadowResources(): BlobShadowResources {
  if (blobShadow) return blobShadow
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('A 2D canvas is necessary for the blob shadow texture.')
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.62)')
  gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.3)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  const geometry = new PlaneGeometry(1, 1)
  geometry.rotateX(-Math.PI / 2)
  const material = new MeshBasicMaterial({
    map: new CanvasTexture(canvas),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  blobShadow = { geometry, material }
  return blobShadow
}
