import * as THREE from 'three'

export function createPfxPlasmaHitMaterial(
  opacity: number,
  layer: 'contact' | 'filament' = 'contact',
  primaryColor: THREE.ColorRepresentation = '#4ff7ff',
  secondaryColor: THREE.ColorRepresentation = '#8a42ff',
  density = 0.72,
  styleEdgeHardness = 0.54,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: opacity },
      uCycle: { value: 0 },
      uFilamentLayer: { value: layer === 'filament' ? 1 : 0 },
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
      uniform float uCycle;
      uniform float uDensity;
      varying vec3 vColor;
      varying vec3 vNormalView;
      varying vec3 vLocal;
      varying vec3 vView;
      void main() {
        float attack = smoothstep(0.0, 0.08, uCycle);
        float breakup = smoothstep(0.42, 0.76, uCycle);
        float impactOrigin = 0.14;
        float directionalPeel = smoothstep(0.08, 1.5, impactOrigin - position.x);
        vec3 contactCompression = mix(vec3(0.38, 0.7, 0.7), vec3(1.0), attack);
        vec3 animated = position;
        animated.x = impactOrigin + (position.x - impactOrigin) * mix(0.08, 1.0, attack);
        animated.yz *= contactCompression.yz;
        animated.x -= breakup * directionalPeel * 0.24;
        animated.yz *= 1.0 + breakup * (0.08 + directionalPeel * 0.16);
        vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
        vColor = color;
        vNormalView = normalize(normalMatrix * normal);
        vLocal = animated;
        vView = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform float uFilamentLayer;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      varying vec3 vColor;
      varying vec3 vNormalView;
      varying vec3 vLocal;
      varying vec3 vView;
      void main() {
        vec3 viewDirection = normalize(-vView);
        float fresnel = pow(1.0 - abs(dot(normalize(vNormalView), viewDirection)), mix(1.25, 2.25, uStyleEdgeHardness));
        float plasmaFilament = 0.5 + 0.5 * sin(vLocal.y * mix(22.0, 34.0, uDensity) + vLocal.z * 21.0 - uCycle * 104.0);
        float erosionFront = smoothstep(0.42, 0.78, uCycle) * (0.5 + 0.5 * sin(vLocal.x * 19.0 + vLocal.y * 15.0));
        vec3 hotWhite = mix(uPrimaryColor, vec3(1.0), 0.66);
        vec3 violet = uSecondaryColor;
        float axialHeat = 1.0 - smoothstep(0.02, 0.72, abs(vLocal.x - 0.14));
        float softCorona = pow(fresnel, 0.7) * (0.65 + plasmaFilament * 0.35);
        float tubeRoundLight = 0.42 + 0.58 * abs(dot(normalize(vNormalView), normalize(vec3(0.32, 0.72, 0.61))));
        float filamentLayer = uFilamentLayer;
        vec3 controlledPlasmaColor = mix(vColor, uPrimaryColor, 0.42);
        float rootWhiteEnergyBudget = 0.16;
        vec3 plasma = mix(controlledPlasmaColor, violet, fresnel * 0.28) + hotWhite * (0.08 + plasmaFilament * mix(0.06, 0.12, uDensity) + softCorona * 0.18 + axialHeat * rootWhiteEnergyBudget + filamentLayer * 0.06);
        plasma *= mix(0.72, 1.06, tubeRoundLight);
        float release = 1.0 - smoothstep(0.7, 0.82, uCycle);
        float alpha = uOpacity * release * (0.36 + softCorona * 0.22 + plasmaFilament * mix(0.04, 0.1, uDensity) + axialHeat * 0.12 + filamentLayer * 0.14) * (1.0 - erosionFront * 0.82);
        float erosionCutoff = mix(0.014, 0.06, smoothstep(0.42, 0.72, uCycle)) * mix(0.82, 1.08, uStyleEdgeHardness);
        if (alpha < erosionCutoff) discard;
        gl_FragColor = vec4(plasma, clamp(alpha, 0.0, 0.94));
      }
    `,
  })
  material.userData['pfxPlasmaHitMaterial'] = 'cyan-violet-hot-white-discharge'
  material.userData['pfxPlasmaHitMaterialLayer'] = layer === 'filament' ? 'electric-filament' : 'volumetric-contact'
  material.userData['pfxPlasmaHitRingDiscipline'] = 'three-primary-three-fork-asymmetric-magnetic-streamers'
  material.userData['pfxPlasmaHitGlowModel'] = 'controlled-flipbook-contact-additive-closed-flux-corona'
  material.userData['pfxPlasmaHitControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxPlasmaHitOpaqueClosedFlux'] = layer === 'filament'
  material.userData['pfxPlasmaHitRootWhiteEnergyBudget'] = 0.16
  return material
}
