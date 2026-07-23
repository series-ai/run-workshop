import * as THREE from 'three'

export function createPfxElectricCriticalMaterial(
  opacity: number,
  layer: 'core' | 'halo' = 'core',
  primaryColor = '#5eeaff',
  secondaryColor = '#ffd45a',
  density = 0.56,
  styleEdgeHardness = 0.54,
): THREE.ShaderMaterial {
  const haloLayer = layer === 'halo' ? 1 : 0
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: opacity },
      uCycle: { value: 0 },
      uHaloLayer: { value: haloLayer },
      uPrimaryColor: { value: new THREE.Color(primaryColor) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uDensity: { value: THREE.MathUtils.clamp(density, 0, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
    },
    vertexColors: true,
    transparent: true,
    blending: layer === 'halo' ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: layer === 'core',
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      uniform float uHaloLayer;
      varying vec3 vColor;
      varying vec3 vNormalView;
      varying vec3 vView;
      varying vec3 vLocal;
      void main() {
        float strikeBuild = smoothstep(0.0, 0.045, uCycle);
        float recovery = smoothstep(0.48, 0.76, uCycle);
        float reachBand = smoothstep(0.1, 1.0, length(position));
        float recoveryFlicker = sin(position.x * 11.0 + position.y * 13.0 + position.z * 7.0 + uCycle * 31.0) * recovery;
        vec3 animated = position;
        animated = position * mix(0.12, 1.0, strikeBuild);
        animated.x += recoveryFlicker * reachBand * 0.06;
        animated.z -= recoveryFlicker * reachBand * 0.045;
        animated += normal * uHaloLayer * 0.025;
        vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
        vColor = color;
        vNormalView = normalize(normalMatrix * normal);
        vView = viewPosition.xyz;
        vLocal = animated;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform float uHaloLayer;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      varying vec3 vColor;
      varying vec3 vNormalView;
      varying vec3 vView;
      varying vec3 vLocal;
      void main() {
        vec3 viewDirection = normalize(-vView);
        vec3 surfaceNormal = normalize(vNormalView);
        float surfaceFacing = abs(dot(surfaceNormal, viewDirection));
        float rim = 1.0 - surfaceFacing;
        float fresnel = pow(rim, mix(2.8, 1.6, uStyleEdgeHardness));
        float facetLight = 0.16 + 0.84 * max(dot(surfaceNormal, normalize(vec3(0.32, 0.72, 0.62))), 0.0);
        float fillLight = 0.12 * max(dot(surfaceNormal, normalize(vec3(-0.78, 0.24, 0.34))), 0.0);
        float depthShading = facetLight + fillLight;
        float voltagePulse = 0.84 + 0.16 * sin(vLocal.y * 18.0 - uCycle * 82.0);
        float filamentWave = sin((vLocal.x * 1.7 + vLocal.y + vLocal.z * 1.3) * 38.0 - uCycle * 92.0);
        float filamentBand = step(0.15, filamentWave);
        float filamentCrackle = mix(0.72, 0.62, uDensity) + mix(0.2, 0.38, uDensity) * filamentBand;
        float filamentFlash = step(0.76, sin((vLocal.x - vLocal.y * 0.8 + vLocal.z) * 54.0 - uCycle * 118.0));
        float hotCore = 1.0 - smoothstep(0.0, 0.42, length(vLocal - vec3(0.0)));
        float release = 1.0 - smoothstep(0.4, 0.82, uCycle);
        vec3 hotWhite = vec3(0.88, 1.0, 1.0);
        vec3 controlledVoltageColor = mix(vColor, uPrimaryColor, 0.68);
        vec3 controlledCriticalAccent = mix(hotWhite, uSecondaryColor, 0.24);
        float tipExposure = 0.2;
        vec3 coreColor = controlledVoltageColor * voltagePulse * filamentCrackle * (depthShading + tipExposure) + controlledCriticalAccent * (0.08 + hotCore * 0.7 + fresnel * 0.32 + filamentFlash * 0.22);
        vec3 haloColor = controlledVoltageColor * (0.66 + voltagePulse * filamentCrackle * 0.34) + controlledCriticalAccent * (0.3 + hotCore * 0.56 + fresnel * 0.5);
        vec3 color = mix(coreColor, haloColor, uHaloLayer);
        float coreAlpha = 0.84 + hotCore * 0.12 + fresnel * 0.04;
        float haloAlpha = 0.16 + hotCore * 0.24 + fresnel * 0.36;
        float alpha = uOpacity * release * mix(coreAlpha, haloAlpha, uHaloLayer);
        if (alpha < 0.025) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.96));
      }
    `,
  })
  material.userData['pfxElectricCriticalMaterial'] = 'directional-cyan-violet-voltage'
  material.userData['pfxElectricCriticalMobileFragmentModel'] = 'vertex-color-faceted-core'
  material.userData['pfxElectricCriticalDepthOcclusion'] = 'closed-volumetric-burst-depth-test'
  material.userData['pfxElectricCriticalLayering'] = 'depth-writing-faceted-core-plus-coplanar-additive-energy'
  material.userData['pfxElectricCriticalTemporalShaping'] = 'radial-snap-build-and-recovery-flicker'
  material.userData['pfxElectricCriticalMaterialLayer'] = layer === 'halo' ? 'coplanar-additive-energy' : 'faceted-core'
  material.userData['pfxElectricCriticalCrackleModel'] = 'binary-filament-bands'
  material.userData['pfxElectricCriticalControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxElectricCriticalTextureSamples'] = 0
  return material
}

export function applyPfxElectricCriticalAppearance(material: THREE.ShaderMaterial, opacity: number, cycle: number): void {
  material.uniforms['uOpacity']!.value = THREE.MathUtils.clamp(opacity, 0, 1)
  material.uniforms['uCycle']!.value = THREE.MathUtils.clamp(cycle, 0, 1)
}
