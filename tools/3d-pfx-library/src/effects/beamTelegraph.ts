import * as THREE from 'three'

export function createPfxBeamTelegraphMaterial(
  opacity: number,
  geometryKind: 'lane' | 'aperture' = 'lane',
  primaryColor: THREE.ColorRepresentation = '#f04418',
  secondaryColor: THREE.ColorRepresentation = '#8eefff',
  density = 0.56,
  styleEdgeHardness = 0.54,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uAperture: { value: geometryKind === 'aperture' ? 1 : 0 },
      uPrimaryColor: { value: new THREE.Color(primaryColor) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uDensity: { value: THREE.MathUtils.clamp(density, 0.05, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
    },
    vertexColors: true,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 vWarningColor;
      varying vec3 vWarningNormal;
      varying vec3 vWarningPosition;
      varying vec3 vViewPosition;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vWarningColor = color;
        vWarningNormal = normalize(normalMatrix * normal);
        vWarningPosition = position;
        vViewPosition = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform float uAperture;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      varying vec3 vWarningColor;
      varying vec3 vWarningNormal;
      varying vec3 vWarningPosition;
      varying vec3 vViewPosition;
      float warningHash(vec2 coordinate) {
        return fract(sin(dot(coordinate, vec2(127.1, 311.7))) * 43758.5453);
      }
      void main() {
        vec3 normal = normalize(vWarningNormal);
        vec3 viewDirection = normalize(-vViewPosition);
        float fresnel = pow(1.0 - abs(dot(normal, viewDirection)), 1.8);
        float lanePulse = 0.5 + 0.5 * sin(vWarningPosition.x * 6.2 - uCycle * 48.0);
        float countdown = smoothstep(0.02, 0.38, uCycle) * (1.0 - smoothstep(0.48, 0.58, uCycle));
        float energyNoise = warningHash(floor((vWarningPosition.xz + vec2(uCycle * 8.0, -uCycle * 3.0)) * 9.0));
        energyNoise = mix(energyNoise, 0.5 + 0.5 * sin(vWarningPosition.x * 13.0 + vWarningPosition.z * 17.0 - uCycle * 72.0), 0.55);
        float scanThreshold = mix(0.78, 0.62, uDensity);
        float scanSoftness = mix(0.12, 0.025, uStyleEdgeHardness);
        float scanRibbon = smoothstep(scanThreshold, scanThreshold + scanSoftness, lanePulse) * countdown;
        float charge = smoothstep(0.0, 0.3, uCycle);
        float revealHead = mix(-1.18, 1.94, charge);
        float fieldReveal = mix(1.0 - smoothstep(revealHead - 0.16, revealHead + 0.08, vWarningPosition.x), 1.0, uAperture);
        float dissolveNoise = smoothstep(0.48 + energyNoise * 0.08, 0.78, uCycle);
        float irisAngle = atan(vWarningPosition.z, vWarningPosition.y);
        float irisPulse = (0.5 + 0.5 * sin(irisAngle * 3.0 - uCycle * 38.0)) * uAperture;
        vec3 threatRed = uPrimaryColor;
        vec3 threatAmber = mix(uPrimaryColor, vec3(1.0, 0.62, 0.12), 0.42);
        vec3 warningWhite = mix(uPrimaryColor, vec3(1.0), 0.72);
        vec3 sourceCyan = uSecondaryColor;
        vec3 sourceWhite = mix(uSecondaryColor, vec3(1.0), 0.68);
        float current = 0.46 + countdown * 0.2 + energyNoise * 0.16 + scanRibbon * 0.26;
        vec3 controlledThreatColor = mix(vWarningColor, threatRed, 0.72);
        vec3 warning = controlledThreatColor * (0.52 + countdown * 0.3 + energyNoise * 0.12);
        warning += threatAmber * (fresnel * 0.32 + energyNoise * 0.16);
        warning += warningWhite * scanRibbon * 0.38;
        warning += warningWhite * irisPulse * 0.24;
        vec3 sourceEnergy = vWarningColor * (0.58 + energyNoise * 0.18)
          + sourceCyan * (0.24 + fresnel * 0.46)
          + sourceWhite * irisPulse * 0.34;
        warning = mix(warning, sourceEnergy, uAperture);
        float energyAlpha = clamp(current + fresnel * 0.18 + uAperture * 0.08 + irisPulse * 0.08, 0.0, 0.9);
        gl_FragColor = vec4(warning, uOpacity * fieldReveal * (1.0 - dissolveNoise) * energyAlpha);
      }
    `,
  })
  material.userData['pfxBeamTelegraphMaterial'] = 'directional-countdown-scan-with-fresnel-rails'
  material.userData['pfxBeamTelegraphEnergyTexture'] = 'procedural-scrolling-multiband-field'
  material.userData['pfxBeamTelegraphPalette'] = 'warm-threat-with-cool-source-accent'
  material.userData['pfxBeamTelegraphProjection'] = 'source-to-target-reveal-and-noise-dissolve'
  material.userData['pfxBeamTelegraphBloomDiscipline'] = 'crisp-alpha-field-with-additive-soft-current'
  material.userData['pfxBeamTelegraphControlBinding'] = 'primary-secondary-density-style'
  return material
}
