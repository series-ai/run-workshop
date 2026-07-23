import * as THREE from 'three'

export function createPfxFrostAuraCrystalGlintMaterial(
  opacity: number,
  primaryColor = '#8ee8ff',
  secondaryColor = '#e8fbff',
  density = 0.56,
  styleEdgeHardness = 0.54,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uPrimaryColor: { value: new THREE.Color(primaryColor) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uDensity: { value: THREE.MathUtils.clamp(density, 0, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 vGlintNormal;
      varying vec3 vGlintViewPosition;
      varying float vGlintPulse;
      attribute float pfxFrostPhase;
      uniform float uCycle;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vGlintNormal = normalize(normalMatrix * normal);
        vGlintViewPosition = viewPosition.xyz;
        vGlintPulse = 0.72 + sin((uCycle + pfxFrostPhase) * 6.2831853) * 0.28;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      varying vec3 vGlintNormal;
      varying vec3 vGlintViewPosition;
      varying float vGlintPulse;
      void main() {
        vec3 normal = normalize(vGlintNormal);
        vec3 viewDirection = normalize(-vGlintViewPosition);
        vec3 flashLight = normalize(vec3(0.58, 0.64, 0.5));
        float rimBase = 1.0 - abs(dot(normal, viewDirection));
        float rimGlint = rimBase * rimBase * mix(0.72, 1.22, uStyleEdgeHardness);
        float facetFlash = smoothstep(0.78, 0.96, max(dot(normal, flashLight), 0.0));
        float glintEnergy = rimGlint * 0.58 + facetFlash * vGlintPulse * 0.72;
        vec3 controlledGlintColor = mix(uPrimaryColor, uSecondaryColor, facetFlash);
        gl_FragColor = vec4(controlledGlintColor * glintEnergy * mix(1.42, 1.9, uDensity), uOpacity * glintEnergy);
      }
    `,
  })
  material.userData['pfxFrostAuraMaterial'] = 'additive-crystal-edge-glint'
  material.userData['pfxFrostAuraCrystalGlintMaterial'] = true
  material.userData['pfxFrostAuraControlBinding'] = 'primary-secondary-density-style'
  return material
}
