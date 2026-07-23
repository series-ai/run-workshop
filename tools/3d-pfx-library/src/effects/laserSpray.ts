import * as THREE from 'three'

export function createPfxLaserSprayMaterial(
  opacity: number,
  geometryKind: 'bolts' | 'nozzle' = 'bolts',
  primaryColor: THREE.ColorRepresentation = '#ff3d1f',
  secondaryColor: THREE.ColorRepresentation = '#ffb23c',
  density = 0.6,
  styleEdgeHardness = 0.54,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uNozzle: { value: geometryKind === 'nozzle' ? 1 : 0 },
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
      uniform float uNozzle;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      attribute float spraySequence;
      attribute float sprayShell;
      varying vec3 vSprayColor;
      varying vec3 vSprayNormal;
      varying vec3 vSprayPosition;
      varying vec3 vViewPosition;
      varying float vSpraySequence;
      varying float vSprayShell;
      void main() {
        vec3 animatedPosition = position;
        float nozzleBreath = 1.0 + uNozzle * (
          0.035 + 0.075 * (0.5 + 0.5 * sin(uCycle * 44.0 + position.x * 8.0))
        );
        animatedPosition.yz *= nozzleBreath;
        float recoveryRetraction = 1.0 - (1.0 - uNozzle) * 0.62 * smoothstep(0.48, 0.76, uCycle);
        animatedPosition = mix(vec3(-1.4, 0.0, 0.0), animatedPosition, recoveryRetraction);
        vec4 viewPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
        vSprayColor = color;
        vSprayNormal = normalize(normalMatrix * normal);
        vSprayPosition = animatedPosition;
        vViewPosition = viewPosition.xyz;
        vSpraySequence = spraySequence;
        vSprayShell = sprayShell;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform float uNozzle;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      varying vec3 vSprayColor;
      varying vec3 vSprayNormal;
      varying vec3 vSprayPosition;
      varying vec3 vViewPosition;
      varying float vSpraySequence;
      varying float vSprayShell;
      void main() {
        vec3 normal = normalize(vSprayNormal);
        vec3 viewDirection = normalize(-vViewPosition);
        float fresnel = pow(1.0 - abs(dot(normal, viewDirection)), 1.7);
        float shotStart = 0.005 + vSpraySequence * 0.22;
        float shotAttack = smoothstep(shotStart, shotStart + 0.035, uCycle);
        float shotRelease = 1.0 - smoothstep(0.5, 0.66, uCycle);
        float recoveryGhost = smoothstep(0.6, 0.68, uCycle)
          * (1.0 - smoothstep(0.68, 0.8, uCycle))
          * 0.28;
        float salvoEnvelope = max(shotAttack * shotRelease, recoveryGhost);
        float nozzleEnvelope = smoothstep(0.0, 0.035, uCycle) * (1.0 - smoothstep(0.58, 0.8, uCycle));
        float axialScan = 0.5 + 0.5 * sin(vSprayPosition.x * 13.0 - uCycle * 86.0 + vSpraySequence * 11.0);
        float filamentThreshold = mix(0.82, 0.62, uDensity);
        float filamentBand = smoothstep(filamentThreshold, mix(0.99, 0.9, uStyleEdgeHardness), 0.5 + 0.5 * sin(vSprayPosition.x * 27.0 - uCycle * 118.0 + vSpraySequence * 17.0));
        float microPulse = 0.5 + 0.5 * sin(vSprayPosition.x * 51.0 + vSprayPosition.y * 23.0 - uCycle * 152.0);
        vec3 hotCore = mix(uSecondaryColor, vec3(1.0), 0.28);
        vec3 laserRed = uPrimaryColor;
        vec3 nozzleAmber = uSecondaryColor;
        vec3 nozzleWhite = mix(uSecondaryColor, vec3(1.0), 0.62);
        vec3 controlledLaserColor = mix(vSprayColor, laserRed, 0.72);
        vec3 boltEnergy = controlledLaserColor;
        boltEnergy += hotCore * (0.18 + axialScan * 0.24 + filamentBand * 0.3 + microPulse * 0.08 + fresnel * 0.2);
        float beamHalo = mix(0.0, 1.0, vSprayShell);
        float coreEdgeGradient = mix(0.72 + fresnel * 0.2, 0.1 + fresnel * 0.16, beamHalo);
        boltEnergy = mix(boltEnergy, hotCore + laserRed * 0.34, beamHalo * 0.42);
        vec3 nozzleEnergy = mix(vSprayColor, nozzleAmber, 0.42) + nozzleWhite * (fresnel * 0.42 + axialScan * 0.12);
        vec3 color = mix(boltEnergy, nozzleEnergy, uNozzle);
        float visibility = mix(salvoEnvelope, nozzleEnvelope, uNozzle);
        float terminalDissolve = 1.0 - 0.72 * smoothstep(1.36, 1.9, vSprayPosition.x);
        float edgeAlpha = 0.58 + fresnel * 0.22 + axialScan * 0.14;
        float alpha = uOpacity * visibility * edgeAlpha * coreEdgeGradient * mix(terminalDissolve, 1.0, uNozzle);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.92));
      }
    `,
  })
  material.userData['pfxLaserSprayMaterial'] = 'sequenced-world-space-salvo'
  material.userData['pfxLaserSprayShotCount'] = 5
  material.userData['pfxLaserSprayPeakStrandCount'] = 5
  material.userData['pfxLaserSprayBlendDiscipline'] = 'crisp-alpha-bolts-with-additive-endpoint-ricochets'
  material.userData['pfxLaserSprayPalette'] = 'unified-red-orange-amber-energy'
  material.userData['pfxLaserSprayUnifiedWarmPalette'] = true
  material.userData['pfxLaserSprayUniformRecovery'] = true
  material.userData['pfxLaserSprayIntegratedEndpointEnergyCount'] = 5
  material.userData['pfxLaserSprayParticleCount'] = 0
  material.userData['pfxLaserSprayControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxLaserSprayTemporalStructure'] = 'staggered-five-shot-attack-hold-release'
  return material
}
