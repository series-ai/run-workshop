import { CanvasTexture, Color, FrontSide, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from 'three'
import { PALETTE_REGIONS, resolvePaletteColors, type PaletteColors } from '@voxchar/contracts/palette'

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
  mottleAmplitude: 0.12,
  emissiveGain: 1.65,
} as const

const glsl = (value: number) => value.toFixed(3)

interface PolyUniforms {
  uPolyPalette: { value: Color[] }
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

export function createPolyMaterial(palette: PaletteColors): MeshStandardMaterial {
  const resolved = resolvePaletteColors(palette)
  const uniforms: PolyUniforms = {
    uPolyPalette: { value: PALETTE_REGIONS.map((region) => new Color(resolved[region])) },
  }
  const material = new MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.8, side: FrontSide })
  material.name = 'VoxChar_Atlas_Mat'
  material.userData.polyUniforms = uniforms
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPolyPalette = uniforms.uPolyPalette
    let vertex = inject(
      shader.vertexShader,
      '#include <common>',
      '#include <common>\nattribute vec2 uv1;\nvarying vec2 vPolyUv;\nvarying vec2 vVoxelGrid;',
    )
    vertex = inject(vertex, '#include <begin_vertex>', '#include <begin_vertex>\nvPolyUv = uv;\nvVoxelGrid = uv1;')
    shader.vertexShader = vertex

    let fragment = inject(
      shader.fragmentShader,
      '#include <common>',
      '#include <common>\nuniform vec3 uPolyPalette[10];\nvarying vec2 vPolyUv;\nvarying vec2 vVoxelGrid;',
    )
    fragment = inject(
      fragment,
      '#include <color_fragment>',
      `#include <color_fragment>
        int polyRegion = int(clamp(floor(vPolyUv.x * 10.0), 0.0, 9.0));
        float polyEmissive = step(0.92, vPolyUv.y);
        float polyRamp = clamp((vPolyUv.y - 0.15) / 0.7, 0.0, 1.0);
        float polyMetal = polyRegion == 5 ? 1.0 : 0.0;
        float polySkin = polyRegion == 0 ? 1.0 : 0.0;
        float polyLeather = polyRegion == 7 ? 1.0 : 0.0;
        float polyGloss = polyRegion == 8 ? 1.0 : 0.0;
        vec3 polyBase = uPolyPalette[polyRegion];
        float polyLuma = dot(polyBase, vec3(0.2126, 0.7152, 0.0722));
        float polyDark = 1.0 - smoothstep(0.0, ${glsl(LOOK.darkFloorLuma)}, polyLuma);
        polyBase += ${LOOK.darkFloor} * polyDark;
        float voxMottle = 0.0;
        vec3 voxHueShift = vec3(1.0);
        if (vVoxelGrid.x > -100.0 && polyEmissive < 0.5) {
          vec2 voxCell = floor(vVoxelGrid + 0.001);
          float voxHash = fract(sin(dot(voxCell, vec2(127.1, 311.7))) * 43758.5453123);
          float voxHash2 = fract(sin(dot(voxCell, vec2(269.5, 183.3))) * 19283.7131);
          float voxGain = mix(1.0, ${glsl(LOOK.skinMottle)}, polySkin) * mix(1.0, ${glsl(LOOK.darkMottleGain)}, polyDark);
          voxMottle = (voxHash - 0.5) * ${glsl(LOOK.mottleAmplitude)} * voxGain;
          vec3 clothHue = 1.0 + vec3(voxHash2 - 0.5, 0.5 - voxHash, (voxHash - voxHash2) * 0.5) * 0.032;
          vec3 skinHue = 1.0 + vec3(0.6, -0.5, -1.0) * (voxHash2 - 0.5) * ${glsl(LOOK.skinHueJitter)};
          voxHueShift = mix(clothHue, skinHue, polySkin);
        }
        float voxCurve = pow(polyRamp, 0.85);
        float voxTone = clamp(mix(${glsl(LOOK.rampDark)}, ${glsl(LOOK.rampBright)}, voxCurve) + voxMottle, ${glsl(LOOK.toneFloor)}, 1.36);
        vec3 skinDeepTint = mix(${LOOK.skinShadowTint}, ${LOOK.skinBlushTint}, smoothstep(0.10, 0.30, polyRamp));
        vec3 skinShadeTint = mix(skinDeepTint, vec3(1.0), smoothstep(0.30, 0.52, polyRamp));
        vec3 coolShadowTint = mix(vec3(0.88, 0.93, 1.05), vec3(1.0), smoothstep(0.0, 0.60, polyRamp));
        vec3 shadeTint = mix(coolShadowTint, skinShadeTint, polySkin);
        diffuseColor.rgb = polyBase * voxHueShift * shadeTint * voxTone * mix(1.0, ${glsl(LOOK.metalBoost)}, polyMetal);`,
    )
    fragment = inject(
      fragment,
      '#include <metalnessmap_fragment>',
      `#include <metalnessmap_fragment>
        float regionRough = mix(0.82, 0.86, polySkin);
        regionRough = mix(regionRough, 0.78, polyRegion == 1 ? 1.0 : 0.0);
        regionRough = mix(regionRough, 0.46, polyLeather);
        regionRough = mix(regionRough, ${glsl(LOOK.metalRoughness)}, polyMetal);
        regionRough = mix(regionRough, 0.16, polyGloss);
        roughnessFactor = regionRough;
        metalnessFactor = mix(0.0, 0.06, polyLeather);
        metalnessFactor = mix(metalnessFactor, 0.12, polyGloss);
        metalnessFactor = mix(metalnessFactor, ${glsl(LOOK.metalness)}, polyMetal);`,
    )
    fragment = inject(
      fragment,
      '#include <opaque_fragment>',
      `vec3 polyView = normalize(vViewPosition);
        vec3 polyNormal = normalize(normal);
        float polyRim = pow(1.0 - clamp(dot(polyNormal, polyView), 0.0, 1.0), ${glsl(LOOK.rimPower)});
        outgoingLight += (diffuseColor.rgb * 0.65 + ${LOOK.rimTint}) * polyRim * ${glsl(LOOK.rimStrength)};
        float polySky = smoothstep(-0.25, 0.9, reflect(-polyView, polyNormal).y);
        outgoingLight += diffuseColor.rgb * (polyMetal * 0.52 + polyGloss * 0.35) * polySky;
        outgoingLight += uPolyPalette[4] * polyEmissive * ${glsl(LOOK.emissiveGain)};
        #include <opaque_fragment>`,
    )
    shader.fragmentShader = fragment
  }
  material.customProgramCacheKey = () => PROGRAM_KEY
  return material
}

/** Change the palette colors in place. No shader compile occurs. */
export function updatePolyMaterialPalette(material: MeshStandardMaterial, palette: PaletteColors): void {
  const resolved = resolvePaletteColors(palette)
  const colors = uniformsOf(material).uPolyPalette.value
  PALETTE_REGIONS.forEach((region, index) => colors[index]!.set(resolved[region]))
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
