import { CanvasTexture, Color, FrontSide, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from 'three'
import { PALETTE_REGIONS, type PaletteColors } from '@chisel/contracts/palette'

/**
 * 7-region UV palette shader (visual rule S3).
 *   uv.x selects one of seven palette colors (skin, hair, primary, secondary, accent, metal, eye).
 *   uv.y is a baked shade ramp: 0.15 is the darkest value and 0.85 is the brightest value.
 * All poly materials share one shader program. Only the palette uniform differs.
 * The material draws front faces only. Open cloth has a modelled inner lining (see polykit.py).
 */

const PROGRAM_KEY = 'run-chisel-atlas-v3'

/**
 * Look constants of the shared program. Every value is a GLSL literal, so all materials compile
 * to one program.
 *   ramp:       brightness at the dark end and at the bright end of the baked shade ramp.
 *   darkFloor:  linear RGB that the shader adds to very dark palette colors. Dark leather, fur and
 *               chitin then keep visible facets against a dark background.
 *   rim:        view-space rim. A facet that turns away from the camera gets a cool edge value.
 *   metal:      the metal region has lower roughness and a vertical studio reflection.
 */
const LOOK = {
  rampDark: 0.56,
  rampBright: 1.16,
  darkFloor: 'vec3(0.020, 0.022, 0.030)',
  darkFloorLuma: 0.1,
  rimStrength: 0.62,
  rimPower: 2.6,
  rimTint: 'vec3(0.030, 0.040, 0.060)',
  metalBoost: 1.18,
  metalRoughness: 0.34,
  metalness: 0.25,
  metalSky: 0.5,
  eyeRoughness: 0.26,
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
  if (!source.includes(chunk)) throw new Error(`The three.js shader has no "${chunk}" chunk for the poly palette shader.`)
  return source.replace(chunk, replacement)
}

export function createPolyMaterial(palette: PaletteColors): MeshStandardMaterial {
  const uniforms: PolyUniforms = {
    uPolyPalette: { value: PALETTE_REGIONS.map((region) => new Color(palette[region] ?? '#1f2634')) },
  }
  const material = new MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.82, side: FrontSide })
  material.name = 'Poly_Atlas_Mat'
  material.userData.polyUniforms = uniforms
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPolyPalette = uniforms.uPolyPalette
    let vertex = inject(shader.vertexShader, '#include <common>', '#include <common>\nvarying vec2 vPolyUv;')
    vertex = inject(vertex, '#include <begin_vertex>', '#include <begin_vertex>\nvPolyUv = uv;')
    shader.vertexShader = vertex

    let fragment = inject(
      shader.fragmentShader,
      '#include <common>',
      '#include <common>\nuniform vec3 uPolyPalette[7];\nvarying vec2 vPolyUv;',
    )
    fragment = inject(
      fragment,
      '#include <color_fragment>',
      `#include <color_fragment>
        int polyRegion = int(clamp(floor(vPolyUv.x * 7.0), 0.0, 6.0));
        float polyRamp = clamp((vPolyUv.y - 0.15) / 0.7, 0.0, 1.0);
        float polyMetal = polyRegion == 5 ? 1.0 : 0.0;
        float polyEye = polyRegion == 6 ? 1.0 : 0.0;
        vec3 polyBase = uPolyPalette[polyRegion];
        float polyLuma = dot(polyBase, vec3(0.2126, 0.7152, 0.0722));
        polyBase += ${LOOK.darkFloor} * (1.0 - smoothstep(0.0, ${glsl(LOOK.darkFloorLuma)}, polyLuma));
        diffuseColor.rgb = polyBase * mix(${glsl(LOOK.rampDark)}, ${glsl(LOOK.rampBright)}, polyRamp) * mix(1.0, ${glsl(LOOK.metalBoost)}, polyMetal);`,
    )
    fragment = inject(
      fragment,
      '#include <metalnessmap_fragment>',
      `#include <metalnessmap_fragment>
        roughnessFactor = mix(mix(roughnessFactor, ${glsl(LOOK.metalRoughness)}, polyMetal), ${glsl(LOOK.eyeRoughness)}, polyEye);
        metalnessFactor = mix(metalnessFactor, ${glsl(LOOK.metalness)}, polyMetal);`,
    )
    fragment = inject(
      fragment,
      '#include <opaque_fragment>',
      `vec3 polyView = normalize(vViewPosition);
        vec3 polyNormal = normalize(normal);
        float polyRim = pow(1.0 - clamp(dot(polyNormal, polyView), 0.0, 1.0), ${glsl(LOOK.rimPower)});
        outgoingLight += (diffuseColor.rgb * 0.75 + ${LOOK.rimTint}) * polyRim * ${glsl(LOOK.rimStrength)};
        float polySky = smoothstep(-0.25, 0.9, reflect(-polyView, polyNormal).y);
        outgoingLight += diffuseColor.rgb * polyMetal * polySky * ${glsl(LOOK.metalSky)};
        #include <opaque_fragment>`,
    )
    shader.fragmentShader = fragment
  }
  material.customProgramCacheKey = () => PROGRAM_KEY
  return material
}

/** Change the palette colors in place. No shader compile occurs. */
export function updatePolyMaterialPalette(material: MeshStandardMaterial, palette: PaletteColors): void {
  const colors = uniformsOf(material).uPolyPalette.value
  PALETTE_REGIONS.forEach((region, index) => colors[index]!.set(palette[region] ?? '#1f2634'))
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
