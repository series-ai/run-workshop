import * as THREE from 'three'
import { PFX_PLASMA_IMPACT_FLIPBOOK_ATLAS } from '../plasmaImpactFlipbook'
import { getPfxPlasmaImpactFlipbookTexture } from '../constants/05'

export function createPfxPlasmaImpactFlipbookMaterial(
  opacity: number,
  primaryColor: THREE.ColorRepresentation = '#4ff7ff',
  secondaryColor: THREE.ColorRepresentation = '#8a42ff',
  density = 0.72,
  styleEdgeHardness = 0.54,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: getPfxPlasmaImpactFlipbookTexture() },
      uOpacity: { value: opacity },
      uCycle: { value: 0 },
      uPrimaryColor: { value: new THREE.Color(primaryColor) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uDensity: { value: THREE.MathUtils.clamp(density, 0.05, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
      uColumns: { value: PFX_PLASMA_IMPACT_FLIPBOOK_ATLAS.columns },
      uRows: { value: PFX_PLASMA_IMPACT_FLIPBOOK_ATLAS.rows },
      uFrameCount: { value: PFX_PLASMA_IMPACT_FLIPBOOK_ATLAS.frameCount },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    // Avoid card-edge depth wedges as the crossed volume rotates. Grazing
    // planes are suppressed in-shader instead of writing transparent depth.
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vCardFacing;
      void main() {
        vUv = uv;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vec3 viewNormal = normalize(normalMatrix * normal);
        vCardFacing = abs(dot(viewNormal, normalize(-viewPosition.xyz)));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      uniform float uOpacity;
      uniform float uCycle;
      uniform float uColumns;
      uniform float uRows;
      uniform float uFrameCount;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      varying vec2 vUv;
      varying float vCardFacing;
      void main() {
        float playback = clamp(uCycle / 0.76, 0.0, 0.9999);
        // Use the authored formation-through-breakup range. The final six
        // atlas cells are intentionally omitted because their isolated dots
        // lost the plasma filament identity during the recovery beat.
        float frame = 2.0 + floor(playback * 8.0);
        float column = mod(frame, uColumns);
        float row = floor(frame / uColumns);
        vec2 cellSize = vec2(1.0 / uColumns, 1.0 / uRows);
        vec2 insetUv = mix(vec2(0.012), vec2(0.988), vUv);
        vec2 cellOrigin = vec2(column, uRows - 1.0 - row) * cellSize;
        vec4 sprite = texture2D(uAtlas, cellOrigin + insetUv * cellSize);
        float sourceEnergy = max(sprite.r, max(sprite.g, sprite.b));
        float violetWeight = smoothstep(0.02, 0.52, sprite.b - sprite.g * 0.48);
        vec3 controlledPlasmaColor = mix(uPrimaryColor, uSecondaryColor, violetWeight);
        vec3 controlledHotCore = mix(uPrimaryColor, vec3(1.0), 0.72);
        sprite.rgb = controlledPlasmaColor * sourceEnergy * 0.72 + controlledHotCore * sourceEnergy * sourceEnergy * 0.32;
        vec2 plasmaUv = vUv - vec2(0.5);
        float ellipticalRadius = length(vec2(plasmaUv.x, plasmaUv.y * 1.12));
        float fieldRadius = 0.23 + plasmaUv.x * 0.045;
        float arcLine = 1.0 - smoothstep(0.008, 0.026, abs(ellipticalRadius - fieldRadius));
        float arcBreaks = max(smoothstep(0.02, 0.15, plasmaUv.x), smoothstep(0.03, 0.16, -plasmaUv.y));
        float brokenMagneticArc = arcLine * arcBreaks;
        float trunk = 1.0 - smoothstep(0.007, 0.024, abs(plasmaUv.y - plasmaUv.x * 0.1));
        float forkGate = smoothstep(-0.02, 0.14, plasmaUv.x);
        float forkA = (1.0 - smoothstep(0.007, 0.025, abs(plasmaUv.y - plasmaUv.x * 0.52))) * forkGate;
        float forkB = (1.0 - smoothstep(0.007, 0.025, abs(plasmaUv.y + plasmaUv.x * 0.45))) * forkGate;
        float filamentMask = max(brokenMagneticArc, max(trunk * 0.42, max(forkA, forkB) * 0.58))
          * smoothstep(0.018, 0.12, sourceEnergy);
        float filamentStrength = mix(0.38, 0.72, uDensity) * mix(0.86, 1.14, uStyleEdgeHardness);
        sprite.rgb += mix(uPrimaryColor, controlledHotCore, 0.24) * filamentMask * filamentStrength;
        float cardFacing = vCardFacing;
        float facingFade = smoothstep(0.08, 0.26, cardFacing);
        sprite.rgb *= mix(0.72, 1.0, cardFacing);
        float energy = max(sprite.r, max(sprite.g, sprite.b));
        float crossedCardEnergyBudget = 0.64;
        float alpha = smoothstep(mix(0.018, 0.008, uDensity), mix(0.13, 0.09, uStyleEdgeHardness), energy) * uOpacity * facingFade * crossedCardEnergyBudget;
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(sprite.rgb * 0.94, alpha);
      }
    `,
  })
  material.userData['pfxPlasmaImpactFlipbook'] = PFX_PLASMA_IMPACT_FLIPBOOK_ATLAS.id
  material.userData['pfxPlasmaImpactFlipbookLicense'] = PFX_PLASMA_IMPACT_FLIPBOOK_ATLAS.license
  material.userData['pfxPlasmaImpactVolumePlanes'] = 3
  material.userData['pfxPlasmaImpactBillboardCount'] = 0
  material.userData['pfxPlasmaImpactTextureBudget'] = '512-square-208381-bytes'
  material.userData['pfxPlasmaImpactControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxPlasmaImpactCrossedCardEnergyBudget'] = 0.64
  return material
}

export function applyPfxPlasmaImpactFlipbookAppearance(material: THREE.ShaderMaterial, opacity: number, cycle: number): void {
  material.uniforms['uOpacity']!.value = THREE.MathUtils.clamp(opacity, 0, 1)
  material.uniforms['uCycle']!.value = THREE.MathUtils.clamp(cycle, 0, 1)
}
